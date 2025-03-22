import { EventType, Layout } from 'webcola';
import { BaseCollection } from '../base/BaseCollection';
import {
  Editor,
  TLArrowBinding,
  TLArrowShape,
  TLGeoShape,
  TLShape,
  TLShapeId,
} from 'tldraw';

type ColaNode = {
  id: TLShapeId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fixed: number; // 1 means fixed, 0 means movable
};
type ColaIdLink = {
  source: TLShapeId;
  target: TLShapeId;
};
type ColaNodeLink = {
  source: ColaNode;
  target: ColaNode;
};

type AlignmentConstraint = {
  type: 'alignment';
  axis: 'x' | 'y';
  offsets: { node: TLShapeId; offset: number }[];
};

type ColaConstraint = AlignmentConstraint;

export class GraphLayoutCollection extends BaseCollection {
  override id = 'graph';
  graphSim: Layout;
  animFrame = -1;
  colaNodes: Map<TLShapeId, ColaNode> = new Map();
  colaLinks: Map<TLShapeId, ColaIdLink> = new Map();
  colaConstraints: ColaConstraint[] = [];
  isRunning = true;
  iterationCount = 0;
  maxIterations = 300; // Limit iterations to prevent infinite loops

  constructor(editor: Editor) {
    super(editor);
    this.graphSim = new Layout().avoidOverlaps(true).handleDisconnected(true);

    // Start animation loop
    this.startAnimationLoop();
  }

  startAnimationLoop() {
    const animate = () => {
      if (this.isRunning) {
        // Run a single iteration of the simulation if it's running
        if (this.graphSim && this.iterationCount < this.maxIterations) {
          // Instead of calling tick directly, we'll restart with a single iteration
          this.graphSim.start(1, 0, 0, 0, false);
          this.updateShapePositions();
        }

        // Continue the animation loop
        this.animFrame = requestAnimationFrame(animate);
      }
    };

    // Start the animation loop
    this.animFrame = requestAnimationFrame(animate);
  }

  stopAnimationLoop() {
    if (this.animFrame !== -1) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = -1;
    }
  }

  override onAdd(shapes: TLShape[]) {
    for (const shape of shapes) {
      if (shape.type !== 'arrow') {
        this.addGeo(shape);
      } else {
        this.addArrow(shape as TLArrowShape);
      }
    }
    this.refreshGraph();
  }

  override onRemove(shapes: TLShape[]) {
    const removedShapeIds = new Set(shapes.map((shape) => shape.id));

    for (const shape of shapes) {
      this.colaNodes.delete(shape.id);
      this.colaLinks.delete(shape.id);
    }

    // Filter out links where either source or target has been removed
    for (const [key, link] of this.colaLinks) {
      if (
        removedShapeIds.has(link.source) ||
        removedShapeIds.has(link.target)
      ) {
        this.colaLinks.delete(key);
      }
    }

    this.refreshGraph();
  }

  // override onShapeChange(prev: TLShape, next: TLShape) {
  //   if (prev.type === 'geo' && next.type === 'geo') {
  //     const prevShape = prev as TLGeoShape;
  //     const nextShape = next as TLGeoShape;
  //     // update color if its changed and refresh constraints which use this
  //     if (prevShape.props.color !== nextShape.props.color) {
  //       const existingNode = this.colaNodes.get(next.id);
  //       if (existingNode) {
  //         this.colaNodes.set(next.id, {
  //           ...existingNode,
  //           color: nextShape.props.color,
  //         });
  //       }
  //       this.refreshGraph();
  //     }
  //   }
  // }

  refreshGraph() {
    // Reset iteration counter when refreshing the graph
    this.iterationCount = 0;
    this.isRunning = true;

    // Cancel any existing animation frame
    this.stopAnimationLoop();

    // TODO: remove this hardcoded behaviour
    this.editor.selectNone();

    const nodes = [...this.colaNodes.values()];
    const nodeIdToIndex = new Map(nodes.map((n, i) => [n.id, i]));

    // Convert the Map values to an array for processing
    const links = Array.from(this.colaLinks.values())
      .map((l) => {
        const sourceIndex = nodeIdToIndex.get(l.source);
        const targetIndex = nodeIdToIndex.get(l.target);

        // Only include links where both source and target exist
        if (sourceIndex !== undefined && targetIndex !== undefined) {
          return {
            source: sourceIndex,
            target: targetIndex,
          };
        }
        return null;
      })
      .filter(
        (link): link is { source: number; target: number } => link !== null
      );

    // Only proceed if we have nodes
    if (nodes.length === 0) {
      this.isRunning = false;
      return;
    }

    // Configure force-directed layout
    this.graphSim = new Layout() // Create a new layout instance to avoid state issues
      .nodes(nodes)
      .links(links)
      .linkDistance((edge) => calcEdgeDistance(edge as ColaNodeLink))
      .avoidOverlaps(true)
      .handleDisconnected(true)
      .jaccardLinkLengths(300, 0.7) // Increased from 150 to 300 for more spacing
      .symmetricDiffLinkLengths(200) // Added to further increase spacing
      .convergenceThreshold(0.001); // Set convergence threshold

    // Initialize the layout
    this.graphSim.start(0, 0, 0, 0, false);

    // Start the animation loop
    this.startAnimationLoop();
  }

  updateShapePositions() {
    const selectedIds = this.editor.getSelectedShapeIds();

    for (const node of this.graphSim.nodes() as ColaNode[]) {
      const shape = this.editor.getShape(node.id);
      if (!shape) continue;
      const { w, h } = this.editor.getShapeGeometry(node.id)?.bounds || {
        w: 0,
        h: 0,
      };

      const { x, y } = getCornerToCenterOffset(w, h, shape.rotation);

      // Update shape props
      node.width = w;
      node.height = h;
      node.rotation = shape.rotation;

      // Fix positions if we're dragging them
      if (selectedIds.includes(node.id)) {
        node.x = shape.x + x;
        node.y = shape.y + y;
        Layout.dragStart(node); // Fix selected nodes
      } else {
        // Allow non-selected nodes to move
        this.editor.updateShape({
          id: node.id,
          type: shape.type,
          x: node.x - x,
          y: node.y - y,
        });
      }
    }
  }

  startSimulation() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.iterationCount = 0;
      this.startAnimationLoop();
    }
  }

  stopSimulation() {
    if (this.isRunning) {
      this.isRunning = false;
      this.stopAnimationLoop();
    }
  }

  addArrow = (arrow: TLArrowShape) => {
    const getBindings = this.editor.getBindingsInvolvingShape(
      arrow.id
    ) as TLArrowBinding[];

    const source = getBindings.find((b) => b.props.terminal === 'start')?.toId;
    const target = getBindings.find((b) => b.props.terminal === 'end')?.toId;

    if (source && target) {
      const link: ColaIdLink = {
        source,
        target,
      };
      this.colaLinks.set(arrow.id, link);
    }
  };

  addGeo = (shape: TLShape) => {
    const bounds = this.editor.getShapeGeometry(shape)?.bounds;
    if (!bounds) return;

    const { w, h } = bounds;
    const { x, y } = getCornerToCenterOffset(w, h, shape.rotation);
    const node: ColaNode = {
      id: shape.id,
      x: shape.x + x,
      y: shape.y + y,
      width: w,
      height: h,
      rotation: shape.rotation,
      // default to movable
      fixed: 0,
    };
    this.colaNodes.set(shape.id, node);
  };

  refreshConstraints() {
    const alignmentConstraintX: AlignmentConstraint = {
      type: 'alignment',
      axis: 'x',
      offsets: [],
    };
    const alignmentConstraintY: AlignmentConstraint = {
      type: 'alignment',
      axis: 'y',
      offsets: [],
    };

    this.colaConstraints = [];
  }

  // Get all descendants (children, grandchildren, etc.) of a shape
  getDescendants(
    shapeId: TLShapeId,
    visited = new Set<TLShapeId>()
  ): Set<TLShapeId> {
    if (visited.has(shapeId)) return visited;
    visited.add(shapeId);

    // Find all links where this shape is the source
    for (const [_, link] of this.colaLinks.entries()) {
      if (link.source === shapeId) {
        const targetId = link.target;
        if (!visited.has(targetId)) {
          // Recursively get descendants of the target
          this.getDescendants(targetId, visited);
        }
      }
    }

    return visited;
  }
}

function getCornerToCenterOffset(w: number, h: number, rotation: number) {
  // Calculate the center coordinates relative to the top-left corner
  const centerX = w / 2;
  const centerY = h / 2;

  // Apply rotation to the center coordinates
  const rotatedCenterX =
    centerX * Math.cos(rotation) - centerY * Math.sin(rotation);
  const rotatedCenterY =
    centerX * Math.sin(rotation) + centerY * Math.cos(rotation);

  return { x: rotatedCenterX, y: rotatedCenterY };
}

function calcEdgeDistance(edge: ColaNodeLink) {
  const LINK_DISTANCE = 400; // Increased from 250 to 400

  // horizontal and vertical distances between centers
  const dx = edge.target.x - edge.source.x;
  const dy = edge.target.y - edge.source.y;

  // the angles of the nodes in radians
  const sourceAngle = edge.source.rotation;
  const targetAngle = edge.target.rotation;

  // Calculate the rotated dimensions of the nodes
  const sourceWidth =
    Math.abs(edge.source.width * Math.cos(sourceAngle)) +
    Math.abs(edge.source.height * Math.sin(sourceAngle));
  const sourceHeight =
    Math.abs(edge.source.width * Math.sin(sourceAngle)) +
    Math.abs(edge.source.height * Math.cos(sourceAngle));
  const targetWidth =
    Math.abs(edge.target.width * Math.cos(targetAngle)) +
    Math.abs(edge.target.height * Math.sin(targetAngle));
  const targetHeight =
    Math.abs(edge.target.width * Math.sin(targetAngle)) +
    Math.abs(edge.target.height * Math.cos(targetAngle));

  // Calculate edge-to-edge distances
  const horizontalGap = Math.max(
    0,
    Math.abs(dx) - (sourceWidth + targetWidth) / 2
  );
  const verticalGap = Math.max(
    0,
    Math.abs(dy) - (sourceHeight + targetHeight) / 2
  );

  // Calculate straight-line distance between the centers of the nodes
  const centerToCenterDistance = Math.sqrt(dx * dx + dy * dy);

  // Adjust the distance by subtracting the edge-to-edge distance and adding the desired travel distance
  const adjustedDistance =
    centerToCenterDistance -
    Math.sqrt(horizontalGap * horizontalGap + verticalGap * verticalGap) +
    LINK_DISTANCE;

  return adjustedDistance;
}
