import { RoomSnapshot } from '@tldraw/sync-core';
import {
  TLArrowBinding,
  TLDocument,
  TLGeoShape,
  TLPage,
  TLShape,
  TLShapeId,
} from 'tldraw';
import { Layout } from 'webcola';

type ColaNode = {
  id: TLShapeId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
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

/**
 * Graph service is responsible for rebalancing the graph to make it visually appealing.
 * - Uses webcola under the hood
 * - Takes in snapshot of the room and updates all the stores with the new positions
 *
 * TODOS:
 * - User should be able to lock node in place
 */
export class GraphService {
  private graph: Layout;

  shapeMap: Map<TLShapeId, TLShape> = new Map();
  colaNodes: Map<TLShapeId, ColaNode> = new Map();
  colaLinks: ColaNodeLink[] = [];
  colaConstraints: ColaConstraint[] = [];

  constructor(params: { snapshot: RoomSnapshot }) {
    const { snapshot } = params;

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
      .map((doc) => doc.state as TLGeoShape);

    if (!_document || !_page || !_shapes) {
      throw new Error(
        `No ${_document ? '' : 'document'} ${_page ? '' : 'page'} ${
          _shapes ? '' : 'shapes'
        } found in snapshot!.`
      );
    }

    this.buildColaNodes(_shapes);
    this.buildColaLinks(_bindings);

    this.graph = new Layout();
  }

  /**
   * Builds the cola nodes from the shapes
   */
  private buildColaNodes(shapes: TLGeoShape[]) {
    shapes.forEach((shape) => {
      const node: ColaNode = {
        id: shape.id,
        x: shape.x,
        y: shape.y,
        width: shape.props.w,
        height: shape.props.h,
        rotation: shape.rotation,
      };

      this.colaNodes.set(shape.id, node);
      this.shapeMap.set(shape.id, shape);
    });
  }

  /**
   * Builds the cola links from the bindings
   */
  private buildColaLinks(bindings: TLArrowBinding[]) {
    /**
     * Arrow bindings work like this:
     * - sourceId is the id of the arrow
     * - targetId is the id of the shape it is pointing to
     * - terminal = 'start' or 'end' depending on which end of the arrow it is
     *
     * thus we need to build a map that skips the arrow id and only returns shapeId to shapeId
     */

    const startMap = new Map<TLShapeId, TLShapeId>();
    const endMap = new Map<TLShapeId, TLShapeId>();

    // build the maps
    bindings.forEach((binding) => {
      if (binding.props.terminal === 'start') {
        startMap.set(binding.fromId, binding.toId);
      } else {
        endMap.set(binding.fromId, binding.toId);
      }
    });

    // build the actual links skipping the arrow id
    startMap.forEach((startId, arrowId) => {
      const endId = endMap.get(arrowId);

      if (!endId) {
        return;
      }

      const start = this.colaNodes.get(startId);
      const end = this.colaNodes.get(endId);

      if (!start || !end) {
        return;
      }

      const link: ColaNodeLink = {
        source: start,
        target: end,
      };

      this.colaLinks.push(link);
    });
  }

  public rebalance(): { id: TLShapeId; x: number; y: number }[] {
    const nodes = Array.from(this.colaNodes.values());

    this.graph
      .nodes(nodes)
      .links(this.colaLinks) // Fix type issue without using 'any'
      .constraints(this.colaConstraints)
      // you could use .linkDistance(250) too, which is stable but does not handle size/rotation
      .linkDistance((edge) => calcEdgeDistance(edge as ColaNodeLink))
      .avoidOverlaps(true)
      .handleDisconnected(true);

    // Start the layout and run it for a number of iterations
    this.graph.start(50, 0, 10, 0);

    // Return the updated node positions
    return nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
    }));
  }
}

function calcEdgeDistance(edge: ColaNodeLink) {
  const LINK_DISTANCE = 250;

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
