import { RoomSnapshot } from '@tldraw/sync-core';
import {
  IndexKey,
  TLArrowBinding,
  TLArrowShape,
  TLDocument,
  TLGeoShape,
  TLPage,
  TLRecord,
  TLShape,
  TLShapeId,
} from 'tldraw';

export type CreateBubbleParams = {
  text: string;
  parentId: TLShapeId | null;
};

type TreeNode = {
  id: string;
  children: TreeNode[];
};

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

    console.log('shapes', this.shapes);
    console.log('bindings', this.bindings);

    // understand which shapes are arrows
    const arrowShapes = new Set<string>();
    for (const shape of this.shapes) {
      if (shape.type === 'arrow') {
        arrowShapes.add(shape.id);
      }
    }

    console.log('arrowShapes', arrowShapes);

    // build a map of arrow to shape
    /*

    {
    meta: {},
    id: 'binding:_2oFffiFZLXFm7xI09Jwm',
    type: 'arrow',
    fromId: 'shape:H54mIcaMJv8nrTkcxNpQW',
    toId: 'shape:bb3a5ea8-0135-42e0-a960-6a32384785de',
    props: {
      isPrecise: false,
      isExact: false,
      normalizedAnchor: [Object],
      terminal: 'start'
    },
    typeName: 'binding'
  },
  {
    meta: {},
    id: 'binding:yhbyD-fffzy7IisBxOzyC',
    type: 'arrow',
    fromId: 'shape:H54mIcaMJv8nrTkcxNpQW',
    toId: 'shape:10FObKLmJQ5B5tYxQC3aU',
    props: {
      isPrecise: true,
      isExact: false,
      normalizedAnchor: [Object],
      terminal: 'end'
    },
    typeName: 'binding'
  }*/
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

    console.log('arrowStartMap', arrowStartMap);
    console.log('arrowEndMap', arrowEndMap);

    // build a map of direct parent relationships from the arrow to shape map
    const childToParentsMap = new Map<string, string[]>();

    for (const [arrowId, fromShapeId] of arrowStartMap.entries()) {
      const toShapeId = arrowEndMap.get(arrowId);

      if (toShapeId) {
        if (!childToParentsMap.has(toShapeId)) {
          childToParentsMap.set(toShapeId, []);
        }
        childToParentsMap.get(toShapeId)?.push(fromShapeId);
      }
    }

    console.log('childToParentsMap', childToParentsMap);

    // Create a map of shape id to shape for efficient lookup
    const shapeMap = new Map<string, TLShape>();
    for (const shape of this.shapes) {
      shapeMap.set(shape.id, shape);
    }

    // Find root nodes (shapes that are selected but have no parents or their parents are not selected)
    for (const selectedId of selectedItemIds) {
      // Skip arrows
      if (arrowShapes.has(selectedId)) continue;

      // Check if this shape has a parent in the selection
      let hasSelectedParent = false;
      for (const [parentId, children] of childToParentsMap.entries()) {
        if (
          children.includes(selectedId) &&
          selectedItemIds.includes(parentId)
        ) {
          hasSelectedParent = true;
          break;
        }
      }

      // If no selected parent, this is a root node
      if (!hasSelectedParent) {
        // Convert childToParentsMap to childToParentMap for buildTreeNode
        const childToParentMap = new Map<string, string>();
        for (const [parentId, children] of childToParentsMap.entries()) {
          for (const childId of children) {
            childToParentMap.set(childId, parentId);
          }
        }

        // Build tree starting from this root
        tree.push(this.buildTreeNode(selectedId, childToParentMap, shapeMap));
      }
    }

    return tree;
  }

  private buildTreeNode(
    shapeId: string,
    childToParentMap: Map<string, string>,
    shapeMap: Map<string, TLShape>
  ): TreeNode {
    // Create a map of parent to children for efficient lookup
    const parentToChildrenMap = new Map<string, string[]>();

    for (const [childId, parentId] of childToParentMap.entries()) {
      if (!parentToChildrenMap.has(parentId)) {
        parentToChildrenMap.set(parentId, []);
      }
      parentToChildrenMap.get(parentId)?.push(childId);
    }

    // Build the node
    const node: TreeNode = {
      id: shapeId,
      children: [],
    };

    // Add children recursively
    const childIds = parentToChildrenMap.get(shapeId) || [];
    for (const childId of childIds) {
      node.children.push(
        this.buildTreeNode(childId, childToParentMap, shapeMap)
      );
    }

    return node;
  }

  getShapePlacements(shapesToCreate: CreateBubbleParams[]) {
    // need to figure out empty space to put the new bubbles
    const positions: { x: number; y: number }[] = [];
    const canvasBounds = this.getCanvasBounds();
    const gridSize = 100;

    // Create initial grid
    const gridInfo = this.createOccupancyGrid(canvasBounds, gridSize);
    this.markBufferZones(gridInfo, gridSize);

    // Place shapes one by one, updating the grid after each placement
    for (const shapeParams of shapesToCreate) {
      const hasParent = shapeParams.parentId !== null;

      let position: { x: number; y: number };

      if (hasParent) {
        const parentShape = this.shapes.find(
          (shape) => shape.id === shapeParams.parentId && shape.type === 'geo'
        ) as TLGeoShape | undefined;

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
    }

    // create new shape params
    return shapesToCreate.map((shape, index) => {
      const { x, y } = positions[index];

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

      const newShape: TLShape = {
        x,
        y,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        meta: {},
        id: this.generateShapeId(),
        type: 'geo',
        props: {
          w: width,
          h: height,
          geo: 'rectangle',
          color: 'black',
          labelColor: 'black',
          fill: 'none',
          dash: 'draw',
          size: 'm',
          font: 'draw',
          text: shape.text,
          align: 'middle',
          verticalAlign: 'middle',
          growY: 0,
          url: '',
          scale: 1,
        },
        parentId: this.page.id,
        index: 'a1' as IndexKey,
        typeName: 'shape',
      };

      return newShape;
    });
  }

  // Add this new method to mark a position as occupied in the grid
  private markPositionAsOccupied(
    position: { x: number; y: number },
    gridInfo: {
      grid: boolean[][];
      bounds: any;
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
      bounds: any;
      rows: number;
      cols: number;
    },
    gridSize: number
  ) {
    const { grid, bounds } = gridInfo;
    const bufferCells = 1; // Buffer of 1 cell around each shape

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

    // get only geo shapes
    const geoShapes = this.shapes.filter(
      (shape) => shape.type === 'geo'
    ) as TLGeoShape[];

    geoShapes.forEach((shape) => {
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

  private createOccupancyGrid(bounds: any, gridSize: number) {
    const cols = Math.ceil((bounds.maxX - bounds.minX) / gridSize);
    const rows = Math.ceil((bounds.maxY - bounds.minY) / gridSize);

    // Initialize grid with all cells empty (false)
    const grid = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));

    // get only geo shapes
    const geoShapes = this.shapes.filter(
      (shape) => shape.type === 'geo'
    ) as TLGeoShape[];

    // Mark cells as occupied based on shape positions
    geoShapes.forEach((shape) => {
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
    parentShape: TLGeoShape,
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

    // Define search directions (right, bottom, left, top)
    const directions = [
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
    ];

    // Start from parent center
    const centerX = parentX + parentWidth / 2;
    const centerY = parentY + parentHeight / 2;

    // Convert to grid coordinates
    const centerCol = Math.floor((centerX - bounds.minX) / gridSize);
    const centerRow = Math.floor((centerY - bounds.minY) / gridSize);

    // Use spiral search to find empty space
    let layer = 1;
    const maxLayers = 5; // Limit search to 5 layers to keep bubbles close

    while (layer < maxLayers) {
      for (const dir of directions) {
        for (let i = 0; i < layer; i++) {
          const row = centerRow + dir.dy * layer;
          const col = centerCol + dir.dx * layer;

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

  private generateShapeId(): TLShapeId {
    return ('shape:' + crypto.randomUUID()) as TLShapeId;
  }
}
