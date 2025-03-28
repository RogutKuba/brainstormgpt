import { RoomSnapshot } from '@tldraw/sync-core';
import {
  IndexKey,
  TLArrowBinding,
  TLArrowShape,
  TLBindingId,
  TLDocument,
  TLGeoShape,
  TLPage,
  TLShape,
  TLShapeId,
} from 'tldraw';
import { LinkShape } from '../shapes/Link.shape';
import { RichTextShape } from '../shapes/RichText.shape';
import { BrainStormResult } from './Brainstorm.service';
import { PredictionShape } from '../shapes/Prediction.shape';

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
    // this.snapshot = snapshot;

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

  getTlShapesAndBindings(shapesToCreate: BrainStormResult[]): {
    shapes: TLShape[];
    bindings: TLArrowBinding[];
  } {
    const shapes: TLShape[] = [];
    const bindings: TLArrowBinding[] = [];

    for (const shapeToCreate of shapesToCreate) {
      // Calculate width and height based on text length
      const MIN_HEIGHT = 200;
      const MIN_WIDTH = 300;
      const CHARS_PER_LINE = 50;
      const HEIGHT_PER_LINE = 75;

      // Scale width based on text length
      const textLength = shapeToCreate.text.length;
      const widthScale = Math.min(2, 1 + textLength / 500); // Cap at 2x original width
      const width = Math.ceil(MIN_WIDTH * widthScale);

      // Calculate height based on text length and adjusted width
      const charsPerWidthAdjustedLine = CHARS_PER_LINE * (width / MIN_WIDTH);
      const numLines = Math.ceil(textLength / charsPerWidthAdjustedLine);
      const height = Math.max(numLines * HEIGHT_PER_LINE, MIN_HEIGHT);

      const newShapeId = this.generateShapeId();
      const newShape: TLShape = {
        id: newShapeId,
        x: 0,
        y: 0,
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
          text: shapeToCreate.text,
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

      shapes.push(newShape);

      // Only create arrow if there's a parent and it's a geo, link, or rich-text shape
      if (shapeToCreate.parentId) {
        const parentShape = this.shapes.find(
          (s) =>
            s.id === shapeToCreate.parentId &&
            (s.type === 'geo' || s.type === 'link' || s.type === 'rich-text')
        ) as (TLGeoShape | LinkShape | RichTextShape) | undefined;

        if (parentShape) {
          // Calculate center points of parent and child shapes
          const parentCenterX = parentShape.x + (parentShape.props.w ?? 0) / 2;
          const parentCenterY = parentShape.y + (parentShape.props.h ?? 0) / 2;
          const childCenterX = 0 + width / 2;
          const childCenterY = 0 + height / 2;

          // Calculate midpoint for arrow placement
          const arrowX = (parentCenterX + childCenterX) / 2;
          const arrowY = (parentCenterY + childCenterY) / 2;

          const arrowId = this.generateShapeId('arr');

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
            id: this.generateBindingId(),
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
            id: this.generateBindingId(),
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

          shapes.push(arrow);
          bindings.push(binding1, binding2);
        }
      }

      // if there is predictions, add prediciton shape + arrow + bindings
      for (const prediction of shapeToCreate.predictions ?? []) {
        const predictionShapeId = this.generateShapeId('pr_t');
        const predictionArrowId = this.generateShapeId('pr_a');

        // Calculate width and height based on prediction text length
        const PREDICTION_MIN_HEIGHT = 200;
        const PREDICTION_MIN_WIDTH = 350;
        const PREDICTION_CHARS_PER_LINE = 35;
        const PREDICTION_HEIGHT_PER_LINE = 60;

        // Scale width based on text length - prioritize width over height
        const predictionTextLength = prediction.length;
        const predictionWidthScale = Math.min(
          2.2,
          1 + predictionTextLength / 350
        ); // Cap at 2.2x original width
        const predictionWidth = Math.ceil(
          PREDICTION_MIN_WIDTH * predictionWidthScale
        );

        // Calculate height based on text length and adjusted width
        const predictionCharsPerWidthAdjustedLine =
          PREDICTION_CHARS_PER_LINE * (predictionWidth / PREDICTION_MIN_WIDTH);
        const predictionNumLines = Math.ceil(
          predictionTextLength / predictionCharsPerWidthAdjustedLine
        );
        const predictionHeight = Math.max(
          predictionNumLines * PREDICTION_HEIGHT_PER_LINE,
          PREDICTION_MIN_HEIGHT
        );

        const predictionShape: PredictionShape = {
          id: predictionShapeId,
          type: 'prediction',
          x: 0 + Math.random() * 100,
          y: 0 + Math.random() * 100,
          rotation: 0,
          isLocked: false,
          opacity: 1,
          meta: {},
          props: {
            w: predictionWidth,
            h: predictionHeight,
            text: prediction,
            parentId: newShapeId,
            arrowId: predictionArrowId,
          },
          parentId: this.page.id,
          index: 'a2' as IndexKey,
          typeName: 'shape',
        };

        const predictionArrow: TLArrowShape = {
          id: predictionArrowId,
          type: 'arrow',
          props: {
            bend: 0,
            text: '',
            labelPosition: 0.5,
            dash: 'draw',
            size: 'm',
            fill: 'none',
            color: 'blue',
            labelColor: 'blue',
            arrowheadStart: 'none',
            arrowheadEnd: 'arrow',
            font: 'draw',
            scale: 1,
            start: { x: 0, y: 0 },
            end: { x: 0, y: 0 },
          },
          parentId: this.page.id,
          index: 'a1' as IndexKey,
          x: 0,
          y: 0,
          rotation: 0,
          isLocked: false,
          opacity: 1,
          meta: {},
          typeName: 'shape',
        };

        const predictionBindings: [TLArrowBinding, TLArrowBinding] = [
          {
            id: this.generateBindingId(),
            type: 'arrow',
            fromId: predictionArrowId,
            toId: newShapeId,
            props: {
              isPrecise: false,
              isExact: false,
              normalizedAnchor: { x: 0.5, y: 0.5 },
              terminal: 'start',
            },
            meta: {},
            typeName: 'binding',
          },
          {
            id: this.generateBindingId(),
            type: 'arrow',
            fromId: predictionArrowId,
            toId: predictionShapeId,
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

        shapes.push(predictionShape, predictionArrow);
        bindings.push(...predictionBindings);
      }
    }

    return {
      shapes,
      bindings,
    };
  }

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

      const newShapeId = this.generateShapeId('rt');
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

          const arrowId = this.generateShapeId('arr');

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
            id: this.generateBindingId(),
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
            id: this.generateBindingId(),
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

  private generateShapeId(prefix?: string): TLShapeId {
    return ('shape:' + prefix + ':' + crypto.randomUUID()) as TLShapeId;
  }

  private generateBindingId(): TLBindingId {
    return ('binding:' + crypto.randomUUID()) as TLBindingId;
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
}
