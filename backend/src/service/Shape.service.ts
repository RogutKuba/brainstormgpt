import { RoomSnapshot } from '@tldraw/sync-core';
import {
  IndexKey,
  TLArrowBinding,
  TLArrowShape,
  TLBaseBoxShape,
  TLDocument,
  TLGeoShape,
  TLPage,
  TLShape,
  TLShapeId,
} from 'tldraw';
import { LinkShape } from '../shapes/Link.shape';
import { RichTextShape } from '../shapes/RichText.shape';
import {
  BrainStormResult,
  brainstormStreamResultSchema,
  brainstormStreamSchema,
} from './Brainstorm.service';
import { z } from 'zod';
import { generateTlBindingId, generateTlShapeId } from '../lib/id';
import { Context } from 'hono';
import { AppContext } from '..';
import { PageSummaryEntity, pageSummaryTable } from '../db/pageSummary.db';
import { getDbConnection } from '../db/client';
import { inArray } from 'drizzle-orm';

export type TreeNode = {
  id: string;
  children: TreeNode[];
} & (
  | {
      type: 'text' | 'rich-text';
      text: string;
    }
  | {
      type: 'link';
      url: string;
    }
);

export class ShapeService {
  private document: TLDocument;
  private page: TLPage;
  private shapes: TLShape[];
  private bindings: TLArrowBinding[];

  constructor(snapshot: RoomSnapshot) {
    this.document = {} as TLDocument;
    this.page = {} as TLPage;
    this.shapes = [];
    this.bindings = [];

    this.updateSnapshot(snapshot);
  }

  createRootShape(
    prompt: string,
    predictions: {
      text: string;
      type: 'text' | 'image' | 'web';
    }[]
  ): LinkShape | RichTextShape {
    // check if prompt is text or link
    const isLink = prompt.startsWith('http');

    const baseProps = {
      isLocked: false,
      isExpanded: false,
      predictions,
      isRoot: true,
      isHighlighted: false,
    };

    if (isLink) {
      return {
        id: generateTlShapeId(),
        type: 'link',
        props: {
          ...baseProps,
          w: 650,
          h: 450,
          minCollapsedHeight: 450,
          prevCollapsedHeight: 450,
          url: prompt,
          title: prompt,
          description: prompt,
          isLoading: true,
          status: 'scraping',
          error: null,
          previewImageUrl: null,
          isDefault: false,
        },
        x: 0,
        y: 0,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        meta: {},
        parentId: this.page.id,
        index: 'a2' as IndexKey,
        typeName: 'shape',
      };
    } else {
      const { width: rawWidth, height } = this.calculateNodeSize(prompt);
      const width = rawWidth + 100;

      return {
        id: generateTlShapeId(),
        type: 'rich-text',
        props: {
          ...baseProps,
          title: prompt,
          text: prompt,
          w: width,
          h: height,
          minCollapsedHeight: height,
          prevCollapsedHeight: height,
        },
        x: 0,
        y: 0,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        meta: {},
        parentId: this.page.id,
        index: 'a2' as IndexKey,
        typeName: 'shape',
      };
    }
  }

  getSelectedTree(selectedItemIds: string[]) {
    // need to construct tree of shapes from the ids and bindings between them
    const tree: TreeNode[] = [];

    // Create a Set for faster lookups of selected items
    const selectedItemsSet = new Set(selectedItemIds);

    // understand which shapes are arrows
    const arrowShapes = new Set<string>();
    for (const shape of this.shapes) {
      if (shape.type === 'arrow') {
        arrowShapes.add(shape.id);
      }
    }

    const arrowStartMap = new Map<string, string>();
    const arrowEndMap = new Map<string, string>();
    for (const binding of this.bindings) {
      const isStart = binding.props.terminal === 'start';

      if (isStart) {
        arrowStartMap.set(binding.fromId, binding.toId);
      } else {
        arrowEndMap.set(binding.fromId, binding.toId);
      }
    }

    // build a map of direct parent relationships from the arrow to shape map
    const childToParentsMap = new Map<string, string[]>();
    const parentToChildrenMap = new Map<string, string[]>();

    for (const [arrowId, fromShapeId] of arrowStartMap.entries()) {
      const toShapeId = arrowEndMap.get(arrowId);

      if (toShapeId) {
        if (!childToParentsMap.has(toShapeId)) {
          childToParentsMap.set(toShapeId, []);
        }
        childToParentsMap.get(toShapeId)?.push(fromShapeId);

        if (!parentToChildrenMap.has(fromShapeId)) {
          parentToChildrenMap.set(fromShapeId, []);
        }
        parentToChildrenMap.get(fromShapeId)?.push(toShapeId);
      }
    }

    // Create a map of shape id to shape for efficient lookup
    const shapeMap = new Map<string, TLShape>();
    for (const shape of this.shapes) {
      shapeMap.set(shape.id, shape);
    }

    // Find all ancestors of selected nodes and add them to the set
    const expandedSelectionSet = new Set(selectedItemsSet);
    this.addAncestorsToSelection(
      selectedItemIds,
      childToParentsMap,
      expandedSelectionSet,
      arrowShapes
    );

    // Find root nodes (shapes that have no parents or their parents are not in the expanded selection)
    const rootNodes = new Set<string>();

    for (const selectedId of expandedSelectionSet) {
      // Skip arrows
      if (arrowShapes.has(selectedId)) continue;

      const parents = childToParentsMap.get(selectedId) || [];
      const hasParentInSelection = parents.some((parentId) =>
        expandedSelectionSet.has(parentId)
      );

      if (!hasParentInSelection) {
        rootNodes.add(selectedId);
      }
    }

    // Convert childToParentsMap to childToParentMap for buildTreeNode
    const childToParentMap = new Map<string, string>();
    for (const [childId, parents] of childToParentsMap.entries()) {
      if (parents.length > 0) {
        // For simplicity, use the first parent if there are multiple
        childToParentMap.set(childId, parents[0]);
      }
    }

    // Build tree starting from each root
    for (const rootId of rootNodes) {
      tree.push(
        this.buildTreeNode(
          rootId,
          childToParentMap,
          parentToChildrenMap,
          shapeMap,
          expandedSelectionSet
        )
      );
    }

    return tree;
  }

  // Helper method to add all ancestors of selected nodes to the selection set
  private addAncestorsToSelection(
    nodeIds: string[],
    childToParentsMap: Map<string, string[]>,
    selectionSet: Set<string>,
    arrowShapes: Set<string>
  ): void {
    const queue = [...nodeIds];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || arrowShapes.has(currentId)) continue;

      const parents = childToParentsMap.get(currentId) || [];
      for (const parentId of parents) {
        if (!selectionSet.has(parentId) && !arrowShapes.has(parentId)) {
          selectionSet.add(parentId);
          queue.push(parentId);
        }
      }
    }
  }

  private buildTreeNode(
    shapeId: string,
    childToParentMap: Map<string, string>,
    parentToChildrenMap: Map<string, string[]>,
    shapeMap: Map<string, TLShape>,
    expandedSelectionSet: Set<string>,
    visitedNodes: Set<string> = new Set()
  ): TreeNode {
    // Check for cycles
    if (visitedNodes.has(shapeId)) {
      // Return a minimal node to break the cycle
      return {
        id: shapeId,
        type: 'text',
        text: '[Circular Reference]',
        children: [],
      };
    }

    // Mark this node as visited
    visitedNodes.add(shapeId);

    // Get the shape from the map
    const shape = shapeMap.get(shapeId);

    // Extract text and url from the shape
    let text = '';
    let url = '';

    if (shape && 'props' in shape && shape.props) {
      if ('text' in shape.props) {
        text = shape.props.text as string;
      }
      if ('url' in shape.props) {
        url = shape.props.url as string;
      }
    }

    // Build the node
    const children: TreeNode[] = [];

    // Add children recursively, but only if they are in the expanded selection
    const childIds = parentToChildrenMap.get(shapeId) || [];
    for (const childId of childIds) {
      // Only include child if it's in the expanded selection
      if (expandedSelectionSet.has(childId)) {
        children.push(
          this.buildTreeNode(
            childId,
            childToParentMap,
            parentToChildrenMap,
            shapeMap,
            expandedSelectionSet,
            new Set(visitedNodes) // Create a new copy of the visited set for each branch
          )
        );
      }
    }

    // Create either a link or text node based on whether URL exists
    if (url) {
      return {
        id: shapeId,
        type: 'link',
        url,
        children,
      };
    } else if (shape?.type === 'rich-text') {
      return {
        id: shapeId,
        type: 'rich-text',
        text,
        children,
      };
    } else {
      return {
        id: shapeId,
        type: 'text',
        text,
        children,
      };
    }
  }

  public getTlShapesAndBindings(
    shapesToCreate: z.infer<typeof brainstormStreamResultSchema>['nodes']
  ): {
    shapes: (LinkShape | RichTextShape | TLArrowShape)[];
    bindings: TLArrowBinding[];
  } {
    if (!shapesToCreate) {
      return {
        shapes: [],
        bindings: [],
      };
    }

    const shapes: (LinkShape | RichTextShape | TLArrowShape)[] = [];
    const bindings: TLArrowBinding[] = [];

    for (const shapeToCreate of shapesToCreate) {
      // Calculate width and height based on text length
      const MIN_HEIGHT = 200;
      const MIN_WIDTH = 300;
      const CHARS_PER_LINE = 50;
      const HEIGHT_PER_LINE = 75;

      // Scale width based on text length
      const textLength = shapeToCreate.text?.length ?? 0;
      const widthScale = Math.min(2, 1 + textLength / 500); // Cap at 2x original width
      const width = Math.ceil(MIN_WIDTH * widthScale);

      // Calculate height based on text length and adjusted width
      const charsPerWidthAdjustedLine = CHARS_PER_LINE * (width / MIN_WIDTH);
      const numLines = Math.ceil(textLength / charsPerWidthAdjustedLine);
      const height = Math.max(numLines * HEIGHT_PER_LINE, MIN_HEIGHT);

      const newShapeId = shapeToCreate.id;

      // Determine if this should be a link shape or rich text shape
      const isLink = shapeToCreate.type === 'link';

      // Create base shape properties
      const baseProps = {
        w: width,
        h: height,
        isLocked: false,
        isExpanded: false,
        isRoot: false,
        isHighlighted: false,
        minCollapsedHeight: height,
        prevCollapsedHeight: height,
        predictions:
          shapeToCreate.predictions?.map((pred) => ({
            text: pred.text,
            type: pred.type,
          })) ?? [],
      };

      const newShape: LinkShape | RichTextShape = isLink
        ? {
            id: newShapeId,
            type: 'link',
            props: {
              ...baseProps,
              h: 450,
              w: 650,
              url: shapeToCreate.text ?? '',
              title: shapeToCreate.text ?? '',
              description: shapeToCreate.text ?? '',
              isLoading: true,
              status: 'scraping',
              error: null,
              previewImageUrl: null,
              isDefault: false,
              isRoot: false,
            },
            x: 0,
            y: 0,
            rotation: 0,
            isLocked: false,
            opacity: 1,
            meta: {},
            parentId: this.page.id,
            index: 'a2' as IndexKey,
            typeName: 'shape',
          }
        : {
            id: newShapeId,
            type: 'rich-text',
            props: {
              ...baseProps,
              title: shapeToCreate.title ?? '',
              text: shapeToCreate.text ?? '',
            },
            x: 0,
            y: 0,
            rotation: 0,
            isLocked: false,
            opacity: 1,
            meta: {},
            parentId: this.page.id,
            index: 'a2' as IndexKey,
            typeName: 'shape',
          };

      shapes.push(newShape);
      this.shapes.push(newShape);

      // Handle parent relationship with arrow and bindings
      if (shapeToCreate.parentId) {
        const parentShape = this.shapes.find(
          (s) =>
            s.id === shapeToCreate.parentId &&
            (s.type === 'geo' || s.type === 'link' || s.type === 'rich-text')
        ) as (LinkShape | RichTextShape) | undefined;

        if (parentShape) {
          // Position the new text shape with consistent offset in random directions
          // Use a fixed distance with random direction (positive or negative)
          const offsetDistance = 150 + Math.random() * 50; // 150-200px distance
          const offsetX = offsetDistance * (Math.random() > 0.5 ? 1 : -1); // Random positive or negative
          const offsetY = offsetDistance * (Math.random() > 0.5 ? 1 : -1); // Random positive or negative
          newShape.x = parentShape.x + offsetX;
          newShape.y = parentShape.y + offsetY;

          const arrowId = generateTlShapeId('arr');
          const arrow = this.createArrowShape(arrowId, parentShape, newShape);
          const [binding1, binding2] = this.createArrowBindings(
            arrowId,
            parentShape.id,
            newShapeId
          );

          shapes.push(arrow);
          this.shapes.push(arrow);
          bindings.push(binding1, binding2);
        }
      }
    }

    return {
      shapes,
      bindings,
    };
  }

  calculateNodeSize = (text: string) => {
    // since we render markdown, we need to calculate the size of the node based on the markdown
    // consider how - becomes its own line item
    const numHyphens = (text.match(/-/g) || []).length;

    // Calculate width and height based on text length
    const MIN_HEIGHT = 200;
    const MIN_WIDTH = 300;
    const CHARS_PER_LINE = 75;
    const HEIGHT_PER_LINE = 90;

    // Scale width based on text length with a reasonable cap
    const textLength = text.length;
    const widthScale = Math.min(2.5, 1 + textLength / 500); // Cap width growth
    const width = Math.ceil(MIN_WIDTH * widthScale);

    // Calculate height based on text length and adjusted width
    const charsPerWidthAdjustedLine = CHARS_PER_LINE * (width / MIN_WIDTH);
    const numLines =
      Math.ceil(textLength / charsPerWidthAdjustedLine) + numHyphens;
    const contentHeight = numLines * HEIGHT_PER_LINE;

    // Use a more balanced height calculation that doesn't grow too rapidly
    // Linear growth instead of quadratic to maintain better proportions
    const heightScale = Math.min(1.5, 1 + textLength / 1000); // Cap height growth
    const calculatedHeight = MIN_HEIGHT * heightScale;

    // Use the larger of content height or calculated height, but with a reasonable maximum
    const height = Math.min(
      Math.max(contentHeight, calculatedHeight, MIN_HEIGHT),
      MIN_HEIGHT * 2 // Cap at 2x minimum height to prevent excessive vertical space
    );

    const padding = 10;

    return {
      height: height + padding,
      width: width + padding,
    };
  };

  getShapePlacements(shapesToCreate: BrainStormResult[]): {
    shapes: TLShape[];
    bindings: TLArrowBinding[];
  } {
    // need to figure out empty space to put the new bubbles
    const positions: { x: number; y: number }[] = [];
    const canvasBounds = this.getCanvasBounds();

    // the larger the bounds, the larger the grid size with a min of 100
    const gridSize = Math.max(
      (canvasBounds.maxX - canvasBounds.minX) / 10,
      (canvasBounds.maxY - canvasBounds.minY) / 10,
      100
    );
    // console.log('grid size', gridSize);

    // Create initial grid
    const gridInfo = this.createOccupancyGrid(canvasBounds, gridSize);
    this.markBufferZones(gridInfo, gridSize);

    // Place shapes one by one, updating the grid after each placement
    for (const shapeParams of shapesToCreate) {
      // console.log('\n\n--------------------------------');
      // console.log('placing shape', shapeParams);

      // this.prettyPrintGrid(gridInfo);

      const hasParent = shapeParams.parentId !== null;

      let position: { x: number; y: number };

      if (hasParent) {
        const parentShape = this.shapes.find(
          (shape) =>
            shape.id === shapeParams.parentId &&
            (shape.type === 'geo' ||
              shape.type === 'link' ||
              shape.type === 'rich-text')
        ) as (TLGeoShape | LinkShape | RichTextShape) | undefined;

        if (!parentShape) {
          position = this.findPositionAwayFromShapes(
            gridInfo,
            canvasBounds,
            gridSize
          );
        } else {
          position = this.findPositionNearParent(
            parentShape,
            gridInfo,
            gridSize
          );

          console.log('new shape position', position);
        }
      } else {
        position = this.findPositionAwayFromShapes(
          gridInfo,
          canvasBounds,
          gridSize
        );
      }

      positions.push(position);

      // Update grid to mark this position as occupied
      this.markPositionAsOccupied(position, gridInfo, gridSize);

      // console.log('--------------------------------\n\n');
    }

    const shapes: TLShape[] = [];
    const bindings: TLArrowBinding[] = [];

    // create new shape params
    let index = 0;
    for (const shape of shapesToCreate) {
      const { x, y } = positions[index++];

      // Calculate width and height based on text length
      const MIN_HEIGHT = 200;
      const MIN_WIDTH = 300;
      const CHARS_PER_LINE = 50;
      const HEIGHT_PER_LINE = 75;

      // Scale width based on text length
      const textLength = shape.text.length;
      const widthScale = Math.min(2, 1 + textLength / 500); // Cap at 2x original width
      const width = Math.ceil(MIN_WIDTH * widthScale);

      // Calculate height based on text length and adjusted width
      const charsPerWidthAdjustedLine = CHARS_PER_LINE * (width / MIN_WIDTH);
      const numLines = Math.ceil(textLength / charsPerWidthAdjustedLine);
      const height = Math.max(numLines * HEIGHT_PER_LINE, MIN_HEIGHT);

      const newShapeId = generateTlShapeId('rt');
      const newShape: TLShape = {
        id: newShapeId,
        x,
        y,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        meta: {},
        type: 'rich-text',
        props: {
          w: width,
          h: height,
          geo: 'rectangle',
          color: 'black',
          labelColor: 'black',
          fill: 'none',
          dash: 'dashed',
          size: 'm',
          font: 'dashed',
          text: shape.text,
          align: 'middle',
          verticalAlign: 'middle',
          growY: 0,
          url: '',
          scale: 1,
        },
        parentId: this.page.id,
        index: 'a2' as IndexKey,
        typeName: 'shape',
      };

      // Only create arrow if there's a parent and it's a geo, link, or rich-text shape
      if (shape.parentId) {
        const parentShape = this.shapes.find(
          (s) =>
            s.id === shape.parentId &&
            (s.type === 'geo' || s.type === 'link' || s.type === 'rich-text')
        ) as (TLGeoShape | LinkShape | RichTextShape) | undefined;

        if (parentShape) {
          // Calculate center points of parent and child shapes
          const parentCenterX = parentShape.x + (parentShape.props.w ?? 0) / 2;
          const parentCenterY = parentShape.y + (parentShape.props.h ?? 0) / 2;
          const childCenterX = x + width / 2;
          const childCenterY = y + height / 2;

          // Calculate midpoint for arrow placement
          const arrowX = (parentCenterX + childCenterX) / 2;
          const arrowY = (parentCenterY + childCenterY) / 2;

          const arrowId = generateTlShapeId('arr');

          // // Calculate bend based on Y-position difference
          // const yDifference = childCenterY - parentCenterY;
          // const xDifference = childCenterX - parentCenterX;

          // // Calculate bend value - more bend for larger Y differences
          // // The sign determines the direction of the bend
          // let bendValue = 0;

          // // Only apply bend if there's a significant Y difference
          // if (Math.abs(yDifference) > 50) {
          //   // Calculate bend based on the ratio of Y difference to X difference
          //   // This creates more natural-looking arrows
          //   const ratio = Math.abs(yDifference / (xDifference || 1));

          //   // Scale the bend based on the ratio, with a maximum value
          //   bendValue = Math.min(Math.max(ratio * 20, 0), 80);

          //   // Make the bend negative if the child is below the parent
          //   // This creates a more natural flow direction
          //   if (yDifference > 0) {
          //     bendValue *= -1;
          //   }
          // }

          const arrow: TLArrowShape = {
            id: arrowId,
            type: 'arrow',
            props: {
              dash: 'draw',
              size: 'm',
              fill: 'none',
              color: 'black',
              labelColor: 'black',
              bend: 0,
              start: { x: parentCenterX - arrowX, y: parentCenterY - arrowY },
              end: { x: childCenterX - arrowX, y: childCenterY - arrowY },
              arrowheadStart: 'none',
              arrowheadEnd: 'arrow',
              text: '',
              labelPosition: 0.5,
              font: 'draw',
              scale: 1,
            },
            parentId: this.page.id,
            index: 'a1' as IndexKey,
            typeName: 'shape',
            x: arrowX,
            y: arrowY,
            rotation: 0,
            isLocked: false,
            opacity: 1,
            meta: {},
          };

          // add the two bindings
          const binding1: TLArrowBinding = {
            id: generateTlBindingId(),
            typeName: 'binding',
            type: 'arrow',
            fromId: arrow.id,
            toId: parentShape.id,
            props: {
              isPrecise: false,
              isExact: false,
              normalizedAnchor: { x: 0.5, y: 0.5 },
              terminal: 'start',
            },
            meta: {},
          };

          const binding2: TLArrowBinding = {
            id: generateTlBindingId(),
            type: 'arrow',
            fromId: arrow.id,
            toId: newShapeId,
            props: {
              isPrecise: false,
              isExact: false,
              normalizedAnchor: { x: 0.5, y: 0.5 },
              terminal: 'end',
            },
            meta: {},
            typeName: 'binding',
          };

          shapes.push(newShape, arrow);
          bindings.push(binding1, binding2);
        }
      } else {
        shapes.push(newShape);
      }
    }

    return { shapes, bindings };
  }

  // Add this new method to mark a position as occupied in the grid
  private markPositionAsOccupied(
    position: { x: number; y: number },
    gridInfo: {
      grid: boolean[][];
      bounds: {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
      };
      rows: number;
      cols: number;
    },
    gridSize: number
  ) {
    const { grid, bounds } = gridInfo;

    // Convert position to grid coordinates
    const col = Math.floor((position.x - bounds.minX) / gridSize);
    const row = Math.floor((position.y - bounds.minY) / gridSize);

    // Mark the cell and surrounding buffer as occupied
    const bufferCells = 1;

    for (
      let r = Math.max(0, row - bufferCells);
      r <= Math.min(gridInfo.rows - 1, row + bufferCells);
      r++
    ) {
      for (
        let c = Math.max(0, col - bufferCells);
        c <= Math.min(gridInfo.cols - 1, col + bufferCells);
        c++
      ) {
        grid[r][c] = true;
      }
    }
  }

  private markBufferZones(
    gridInfo: {
      grid: boolean[][];
      bounds: { minX: number; minY: number; maxX: number; maxY: number };
      rows: number;
      cols: number;
    },
    gridSize: number
  ) {
    const { grid, bounds } = gridInfo;
    const bufferCells = 0; // Buffer of 0 cell around each shape

    // Create a copy of the grid to avoid modifying while iterating
    const originalGrid = grid.map((row) => [...row]);

    for (let row = 0; row < gridInfo.rows; row++) {
      for (let col = 0; col < gridInfo.cols; col++) {
        if (originalGrid[row][col]) {
          // Mark buffer zone around occupied cell
          for (
            let r = Math.max(0, row - bufferCells);
            r <= Math.min(gridInfo.rows - 1, row + bufferCells);
            r++
          ) {
            for (
              let c = Math.max(0, col - bufferCells);
              c <= Math.min(gridInfo.cols - 1, col + bufferCells);
              c++
            ) {
              grid[r][c] = true;
            }
          }
        }
      }
    }
  }

  private getCanvasBounds(): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    // Calculate the bounding box of all shapes
    if (this.shapes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    // get only geo shapes, link shapes, or rich-text shapes
    const relevantShapes = this.shapes.filter(
      (shape) =>
        shape.type === 'geo' ||
        shape.type === 'link' ||
        shape.type === 'rich-text'
    ) as (TLGeoShape | LinkShape | RichTextShape)[];

    relevantShapes.forEach((shape) => {
      // Assuming shapes have x, y, and props.w, props.h properties
      const x = shape.x;
      const y = shape.y;
      const width = shape.props.w ?? 0;
      const height = shape.props.h ?? 0;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    // Reduced padding from 200 to 100
    const padding = 100;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
    };
  }

  private createOccupancyGrid(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    gridSize: number
  ) {
    const cols = Math.ceil((bounds.maxX - bounds.minX) / gridSize);
    const rows = Math.ceil((bounds.maxY - bounds.minY) / gridSize);

    // Initialize grid with all cells empty (false)
    const grid = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));

    // get only geo shapes, link shapes, or rich-text shapes
    const relevantShapes = this.shapes.filter(
      (shape) =>
        shape.type === 'geo' ||
        shape.type === 'link' ||
        shape.type === 'rich-text'
    ) as (TLGeoShape | LinkShape | RichTextShape)[];

    // Mark cells as occupied based on shape positions
    relevantShapes.forEach((shape) => {
      const x = shape.x;
      const y = shape.y;
      const width = shape.props.w ?? 0;
      const height = shape.props.h ?? 0;

      // Convert shape bounds to grid coordinates
      const startCol = Math.floor((x - bounds.minX) / gridSize);
      const startRow = Math.floor((y - bounds.minY) / gridSize);
      const endCol = Math.ceil((x + width - bounds.minX) / gridSize);
      const endRow = Math.ceil((y + height - bounds.minY) / gridSize);

      // Mark cells as occupied
      for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
          if (row >= 0 && row < rows && col >= 0 && col < cols) {
            grid[row][col] = true;
          }
        }
      }
    });

    return { grid, bounds, rows, cols };
  }

  private findPositionNearParent(
    parentShape: {
      x: number;
      y: number;
      props: {
        w: number;
        h: number;
      };
    },
    gridInfo: {
      grid: boolean[][];
      rows: number;
      cols: number;
      bounds: { minX: number; minY: number; maxX: number; maxY: number };
    },
    gridSize: number
  ) {
    const { grid, bounds } = gridInfo;
    const parentX = parentShape.x;
    const parentY = parentShape.y;
    const parentWidth = parentShape.props.w ?? 0;
    const parentHeight = parentShape.props.h ?? 0;

    // Define search directions (right, bottom, left, top, and diagonals)
    const directions = [
      { dx: 1, dy: 0 }, // right
      { dx: 0, dy: 1 }, // bottom
      { dx: -1, dy: 0 }, // left
      { dx: 0, dy: -1 }, // top
      { dx: 1, dy: 1 }, // bottom-righto
      { dx: -1, dy: 1 }, // bottom-left
      { dx: -1, dy: -1 }, // top-left
      { dx: 1, dy: -1 }, // top-right
    ];

    // Start from parent center
    const centerX = parentX + parentWidth / 2;
    const centerY = parentY + parentHeight / 2;

    // Convert to grid coordinates
    const centerCol = Math.floor((centerX - bounds.minX) / gridSize);
    const centerRow = Math.floor((centerY - bounds.minY) / gridSize);

    // Use spiral search to find empty space
    let layer = 1;
    const maxLayers = 10; // Increased max layers to find more positions

    while (layer < maxLayers) {
      // Check each direction at current layer
      for (const dir of directions) {
        // Check positions along this direction at current layer distance
        for (let i = 0; i < layer; i++) {
          // Calculate position with offset
          const offsetX = dir.dx * layer;
          const offsetY = dir.dy * layer;

          // Apply offset and add variation within the layer
          const row = centerRow + offsetY + (dir.dy === 0 ? i : 0);
          const col = centerCol + offsetX + (dir.dx === 0 ? i : 0);

          if (
            row >= 0 &&
            row < gridInfo.rows &&
            col >= 0 &&
            col < gridInfo.cols &&
            !grid[row][col]
          ) {
            // Found empty cell, convert back to canvas coordinates
            return {
              x: bounds.minX + col * gridSize,
              y: bounds.minY + row * gridSize,
            };
          }
        }
      }
      layer++;
    }

    // Fallback if no space found
    return this.findPositionAwayFromShapes(gridInfo, bounds, gridSize);
  }

  private findPositionAwayFromShapes(
    gridInfo: { grid: boolean[][]; rows: number; cols: number },
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    gridSize: number
  ) {
    const { grid, rows, cols } = gridInfo;

    // Modified approach: prefer positions that are not too far from existing shapes
    // but still maintain some distance
    let bestRow = 0,
      bestCol = 0;
    let bestScore = -Infinity;

    // Calculate center of the canvas
    const centerRow = Math.floor(rows / 2);
    const centerCol = Math.floor(cols / 2);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!grid[row][col]) {
          // Calculate distance to nearest shape
          const distanceToShape = this.calculateDistanceToNearestShape(
            row,
            col,
            grid,
            rows,
            cols
          );

          // Calculate distance to center
          const distanceToCenter = Math.sqrt(
            Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2)
          );

          // Score formula: prefer cells that are close to existing shapes
          // but not too close, and not too far from center
          const score =
            10 - Math.abs(distanceToShape - 3) - distanceToCenter / 10;

          if (score > bestScore) {
            bestScore = score;
            bestRow = row;
            bestCol = col;
          }
        }
      }
    }

    // Convert back to canvas coordinates
    return {
      x: bounds.minX + bestCol * gridSize,
      y: bounds.minY + bestRow * gridSize,
    };
  }

  private calculateDistanceToNearestShape(
    row: number,
    col: number,
    grid: boolean[][],
    rows: number,
    cols: number
  ) {
    let minDistance = Infinity;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c]) {
          const distance = Math.sqrt(
            Math.pow(row - r, 2) + Math.pow(col - c, 2)
          );
          minDistance = Math.min(minDistance, distance);
        }
      }
    }

    return minDistance;
  }

  // make the grid extremely readable
  private prettyPrintGrid(gridInfo: {
    grid: boolean[][];
    rows: number;
    cols: number;
  }) {
    const { grid, rows, cols } = gridInfo;
    for (let row = 0; row < rows; row++) {
      let toPrint = '';
      for (let col = 0; col < cols; col++) {
        toPrint += grid[row][col] ? 'X' : '.';
      }
      console.log(toPrint);
    }
  }

  private createArrowShape(
    arrowId: TLShapeId,
    parentShape: TLBaseBoxShape,
    childShape: TLBaseBoxShape
  ): TLArrowShape {
    const parentCenterX = parentShape.x + (parentShape.props.w ?? 0) / 2;
    const parentCenterY = parentShape.y + (parentShape.props.h ?? 0) / 2;
    const childCenterX = childShape.x + (childShape.props.w ?? 0) / 2;
    const childCenterY = childShape.y + (childShape.props.h ?? 0) / 2;
    const arrowX = (parentCenterX + childCenterX) / 2;
    const arrowY = (parentCenterY + childCenterY) / 2;

    return {
      id: arrowId,
      type: 'arrow',
      props: {
        dash: 'draw',
        size: 'm',
        fill: 'none',
        color: 'black',
        labelColor: 'black',
        bend: 0,
        start: { x: parentCenterX - arrowX, y: parentCenterY - arrowY },
        end: { x: childCenterX - arrowX, y: childCenterY - arrowY },
        arrowheadStart: 'none',
        arrowheadEnd: 'arrow',
        text: '',
        labelPosition: 0.5,
        font: 'draw',
        scale: 1,
      },
      parentId: this.page.id,
      index: 'a1' as IndexKey,
      typeName: 'shape',
      x: arrowX,
      y: arrowY,
      rotation: 0,
      isLocked: false,
      opacity: 1,
      meta: {},
    };
  }

  private createArrowBindings(
    arrowId: TLShapeId,
    fromId: TLShapeId,
    toId: TLShapeId
  ): [TLArrowBinding, TLArrowBinding] {
    return [
      {
        id: generateTlBindingId(),
        typeName: 'binding',
        type: 'arrow',
        fromId: arrowId,
        toId: fromId,
        props: {
          isPrecise: false,
          isExact: false,
          normalizedAnchor: { x: 0.5, y: 0.5 },
          terminal: 'start',
        },
        meta: {},
      },
      {
        id: generateTlBindingId(),
        type: 'arrow',
        fromId: arrowId,
        toId: toId,
        props: {
          isPrecise: false,
          isExact: false,
          normalizedAnchor: { x: 0.5, y: 0.5 },
          terminal: 'end',
        },
        meta: {},
        typeName: 'binding',
      },
    ];
  }

  updateSnapshot(snapshot: RoomSnapshot) {
    // find document
    const _document = snapshot.documents.find(
      (doc) => doc.state.typeName === 'document'
    )?.state as TLDocument | undefined;

    // find page
    const _page = snapshot.documents.find(
      (doc) => doc.state.typeName === 'page'
    )?.state as TLPage | undefined;

    // find bindings
    const _bindings = snapshot.documents
      .filter((doc) => doc.state.typeName === 'binding')
      .map((doc) => doc.state as TLArrowBinding);

    // find shapes
    const _shapes = snapshot.documents
      .filter(
        (doc) => !['page', 'document', 'binding'].includes(doc.state.typeName)
      )
      .map((doc) => doc.state as TLShape);

    if (!_document || !_page || !_shapes) {
      throw new Error(
        `No ${_document ? '' : 'document'} ${_page ? '' : 'page'} ${
          _shapes ? '' : 'shapes'
        } found in snapshot!.`
      );
    }

    this.document = _document;
    this.page = _page;
    this.shapes = _shapes;
    this.bindings = _bindings;
  }

  // Helper function to extract shapes with text from the tree structure
  extractShapesWithText = async (params: {
    tree: TreeNode[];
    ctx: Context<AppContext>;
  }): Promise<string> => {
    const { tree, ctx } = params;

    /*
  the result of the function should be a string that contains the shapes with text
  the format of the string should be:
  <node id="shape-id-1" level="1">shape-text-1</node>
    <node id="shape-id-2" level="2" parent="shape-id-1">shape-text-2</node>
    <node id="shape-id-3" level="2" parent="shape-id-1">shape-text-3</node>
  ...
  */

    /**
     * Start by extracting all text out of nodes, then process link nodes in batch
     * to avoid multiple database queries
     */

    // First pass: collect all nodes and identify link nodes
    const allNodes: ({
      id: string;
      level: number;
      parentId?: string;
    } & (
      | {
          type: 'text' | 'rich-text';
          text: string;
        }
      | { type: 'link'; url: string }
    ))[] = [];

    function collectNodes(
      node: TreeNode,
      level: number,
      parentId?: string
    ): void {
      if (node.type === 'text' || node.type === 'rich-text') {
        allNodes.push({
          id: node.id,
          level,
          parentId,
          type: 'text',
          text: node.text,
        });
      } else if (node.type === 'link') {
        allNodes.push({
          id: node.id,
          level,
          parentId,
          type: 'link',
          url: node.url,
        });
      }

      // Process children recursively
      node.children.forEach((child) => collectNodes(child, level + 1, node.id));
    }

    // Collect all nodes
    tree.forEach((node) => collectNodes(node, 1));

    // Extract all unique URLs from link nodes
    const linkNodes = allNodes.filter((node) => node.type === 'link');
    const uniqueUrls = [...new Set(linkNodes.map((node) => node.url))];

    // If we have link nodes, fetch all summaries in a single query
    let urlToSummaryMap = new Map<string, PageSummaryEntity>();

    // This would be an async function in practice, but we're keeping the original function signature
    // In a real implementation, you'd need to make this function async or use a different pattern
    if (uniqueUrls.length > 0) {
      // This is a placeholder for the actual DB query
      // In a real implementation, you would:
      // 1. Get DB connection
      // 2. Query all summaries for the unique URLs in one go
      // 3. Map the results by URL for easy lookup
      const db = getDbConnection(ctx);
      const summaries = await db
        .select()
        .from(pageSummaryTable)
        .where(inArray(pageSummaryTable.url, uniqueUrls));

      summaries.forEach((summary) => {
        urlToSummaryMap.set(summary.url, summary);
      });
    }

    // Second pass: generate the final output string with all nodes in the original order
    function processNode(node: {
      id: string;
      level: number;
      parentId?: string;
      type: 'text' | 'link' | 'rich-text';
      text?: string;
      url?: string;
    }): string {
      const parentAttr = node.parentId ? ` parent="${node.parentId}"` : '';
      let nodeText = '';

      if (node.type === 'text') {
        nodeText = node.text || '';
      } else if (node.type === 'link') {
        // For link nodes, use the summary if available
        const summary = urlToSummaryMap.get(node.url || '');
        if (summary) {
          nodeText = `${summary.gist}\n\n${summary.keyPoints}`;
        } else {
          nodeText = `Link: ${node.url}`;
        }
      }

      return `<node id="${node.id}" level="${node.level}"${parentAttr}>${nodeText}</node>`;
    }

    // Generate the final output by processing each node in the original order
    return allNodes
      .sort((a, b) => {
        // Sort by level first, then by original order
        if (a.level !== b.level) return a.level - b.level;
        // Use the original index in the allNodes array as a proxy for original order
        return allNodes.indexOf(a) - allNodes.indexOf(b);
      })
      .map(processNode)
      .join('\n');
  };
}
