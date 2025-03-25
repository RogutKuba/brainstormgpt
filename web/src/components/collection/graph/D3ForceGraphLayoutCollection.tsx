import { BaseCollection } from '../base/BaseCollection';
import {
  Editor,
  TLArrowBinding,
  TLArrowShape,
  TLShape,
  TLShapeId,
} from 'tldraw';
import * as d3 from 'd3';
import { debounce } from 'lodash';

type ForceNode = {
  id: TLShapeId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fixed: boolean; // true means fixed, false means movable
  fx?: number; // fixed x position (d3 specific)
  fy?: number; // fixed y position (d3 specific)
};

type ForceLink = {
  source: TLShapeId;
  target: TLShapeId;
  id: TLShapeId; // arrow id
};

export class D3ForceGraphLayoutCollection extends BaseCollection {
  override id = 'graph';
  simulation: d3.Simulation<ForceNode, ForceLink>;
  animFrame = -1;
  forceNodes: Map<TLShapeId, ForceNode> = new Map();
  forceLinks: Map<TLShapeId, ForceLink> = new Map();
  isRunning = true;

  // Track pending operations to batch updates
  private pendingOperations = {
    additions: new Set<TLShape>(),
    removals: new Set<TLShape>(),
  };

  // Track if a refresh is already scheduled
  private refreshScheduled = false;

  // Track hierarchical relationships
  nodeParents: Map<TLShapeId, TLShapeId> = new Map();
  nodeChildren: Map<TLShapeId, Set<TLShapeId>> = new Map();
  rootNodes: Set<TLShapeId> = new Set();

  // Configuration options
  linkDistance = 100; // Shorter distance for hierarchical layout
  linkStrength = 0.9; // Stronger links for hierarchical structure
  chargeStrength = -300;
  collisionRadius = 5;
  alphaDecay = 0.015; // Slightly slower cooling for better hierarchical positioning

  // Hierarchical layout specific options
  hierarchyLevelDistance = 120; // Vertical distance between hierarchy levels
  siblingDistance = 80; // Horizontal distance between siblings

  // Radial layout specific options
  radialRadius = 200; // Base radius for the first level
  radiusIncrement = 150; // How much to increase radius per level
  angularSpread = 0.8; // How much of the circle to use (0.8 = 80% of the circle)

  constructor(editor: Editor) {
    super(editor);

    // Initialize the simulation with forces appropriate for hierarchical layout
    this.simulation = d3
      .forceSimulation<ForceNode, ForceLink>()
      .force(
        'link',
        d3
          .forceLink<ForceNode, ForceLink>()
          .id((d) => d.id)
          .distance(this.linkDistance)
          .strength(this.linkStrength)
      )
      .force('charge', d3.forceManyBody().strength(this.chargeStrength))
      .force(
        'collide',
        d3
          .forceCollide()
          .radius(
            (d) =>
              Math.sqrt(
                (d as ForceNode).width * (d as ForceNode).width +
                  (d as ForceNode).height * (d as ForceNode).height
              ) /
                2 +
              this.collisionRadius
          )
      )
      // Remove center force to allow hierarchical positioning
      // .force('center', d3.forceCenter(0, 0))
      // Add y-positioning force to create levels
      .force(
        'y',
        d3
          .forceY<ForceNode>()
          .strength(0.1)
          .y((d) => this.getHierarchyLevel(d.id) * this.hierarchyLevelDistance)
      )
      // Add x-positioning force to separate siblings
      .force(
        'x',
        d3
          .forceX<ForceNode>()
          .strength(0.05)
          .x((d) => this.getSiblingPosition(d.id))
      )
      .alphaTarget(0) // Set initial alphaTarget to 0
      .alphaDecay(this.alphaDecay);

    // Start animation loop
    this.startAnimationLoop();

    // Create debounced refresh method
    this.debouncedRefreshGraph = debounce(this.refreshGraph, 100);
  }

  // Debounced version of refreshGraph to prevent too many updates
  private debouncedRefreshGraph = () => this.refreshGraph();

  startAnimationLoop() {
    const animate = () => {
      if (this.isRunning) {
        // Run a single iteration of the simulation if it's running
        if (this.simulation) {
          // Tick the simulation
          this.simulation.tick();
          this.updateShapePositions();
        }
      }

      // Continue the animation loop
      this.animFrame = requestAnimationFrame(animate);
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

  // Process any pending operations and then refresh the graph
  private processPendingOperations() {
    // Process additions
    if (this.pendingOperations.additions.size > 0) {
      const shapesToAdd = Array.from(this.pendingOperations.additions);
      this.pendingOperations.additions.clear();

      for (const shape of shapesToAdd) {
        if (shape.type !== 'arrow') {
          this.addGeo(shape);
        } else {
          this.addArrow(shape as TLArrowShape);
        }
      }
    }

    // Process removals
    if (this.pendingOperations.removals.size > 0) {
      const shapesToRemove = Array.from(this.pendingOperations.removals);
      this.pendingOperations.removals.clear();

      const removedShapeIds = new Set(shapesToRemove.map((shape) => shape.id));

      // Important: Preserve current positions of remaining nodes before deletion
      const positionSnapshot = new Map<TLShapeId, { x: number; y: number }>();
      for (const [id, node] of this.forceNodes.entries()) {
        if (!removedShapeIds.has(id)) {
          positionSnapshot.set(id, { x: node.x, y: node.y });
        }
      }

      for (const shape of shapesToRemove) {
        this.forceNodes.delete(shape.id);
        this.forceLinks.delete(shape.id);

        // Clean up hierarchical relationships
        this.rootNodes.delete(shape.id);
        this.nodeParents.delete(shape.id);

        // Remove from children lists
        if (this.nodeChildren.has(shape.id)) {
          this.nodeChildren.delete(shape.id);
        }
      }

      // Filter out links where either source or target has been removed
      for (const [key, link] of this.forceLinks) {
        if (
          removedShapeIds.has(link.source) ||
          removedShapeIds.has(link.target)
        ) {
          this.forceLinks.delete(key);
        }
      }

      // Restore positions after deletion
      for (const [id, pos] of positionSnapshot.entries()) {
        const node = this.forceNodes.get(id);
        if (node) {
          node.x = pos.x;
          node.y = pos.y;
          // If the node is fixed, also update fx and fy
          if (node.fixed) {
            node.fx = pos.x;
            node.fy = pos.y;
          }
        }
      }
    }

    // Update hierarchical relationships and refresh the graph
    this.updateHierarchicalRelationships();
    this.refreshGraph();

    // Reset the scheduled flag
    this.refreshScheduled = false;
  }

  // Schedule a refresh if one isn't already scheduled
  private scheduleRefresh() {
    if (!this.refreshScheduled) {
      this.refreshScheduled = true;
      setTimeout(() => this.processPendingOperations(), 0);
    }
  }

  override onAdd(shapes: TLShape[]) {
    // Add shapes to pending operations
    for (const shape of shapes) {
      this.pendingOperations.additions.add(shape);
    }

    // Schedule a refresh
    this.scheduleRefresh();
  }

  override onRemove(shapes: TLShape[]) {
    // Add shapes to pending operations
    for (const shape of shapes) {
      this.pendingOperations.additions.delete(shape); // Remove from additions if pending
      this.pendingOperations.removals.add(shape);
    }

    // Schedule a refresh
    this.scheduleRefresh();
  }

  // Override onShapeChange to handle property changes efficiently
  override onShapeChange(prev: TLShape, next: TLShape) {
    // Only update the specific node properties that changed
    const node = this.forceNodes.get(next.id);
    if (node) {
      // Update locked status if it changed
      if ('isLocked' in next.props) {
        const isLocked = !!next.props.isLocked;
        if (node.fixed !== isLocked) {
          node.fixed = isLocked;
          if (isLocked) {
            node.fx = node.x;
            node.fy = node.y;
          } else {
            node.fx = undefined;
            node.fy = undefined;
          }
        }
      }

      // If position changed significantly, use debounced refresh
      if (Math.abs(prev.x - next.x) > 1 || Math.abs(prev.y - next.y) > 1) {
        this.debouncedRefreshGraph();
      }
    }
  }

  refreshGraph() {
    this.isRunning = true;

    const nodes = Array.from(this.forceNodes.values());
    const links = Array.from(this.forceLinks.values());

    // Only proceed if we have nodes
    if (nodes.length === 0) {
      this.isRunning = false;
      return;
    }

    // Mark selected nodes as fixed
    const selectedIds = new Set(this.editor.getSelectedShapeIds());

    // Keep track of new nodes that need special positioning
    const newNodes: ForceNode[] = [];

    // Preserve existing positions before updating the simulation
    const positionSnapshot = new Map<TLShapeId, { x: number; y: number }>();
    for (const node of nodes) {
      positionSnapshot.set(node.id, { x: node.x, y: node.y });

      // Get the actual shape to ensure we have the latest position
      const shape = this.editor.getShape(node.id);
      if (!shape) continue;

      // Check if this is a node that was just added (no fx/fy and not selected)
      const isNewNode =
        !node.fx && !node.fy && !selectedIds.has(node.id) && !node.fixed;

      if (isNewNode) {
        newNodes.push(node);
      }

      if (selectedIds.has(node.id) || node.fixed) {
        // Set fixed position for d3
        node.fx = node.x;
        node.fy = node.y;
      } else {
        // Allow node to move freely
        node.fx = undefined;
        node.fy = undefined;
      }
    }

    // Position new nodes intelligently
    this.positionNewNodes(newNodes);

    // Configure and restart the simulation
    this.simulation.stop(); // Stop the simulation first
    this.simulation.nodes(nodes);

    // Update the link force with new links
    const linkForce = this.simulation.force('link') as d3.ForceLink<
      ForceNode,
      ForceLink
    >;
    linkForce.links(links);

    // Update y-force to reflect hierarchy levels
    const yForce = this.simulation.force('y') as d3.ForceY<ForceNode>;
    if (yForce) {
      yForce.y(
        (d) => this.getHierarchyLevel(d.id) * this.hierarchyLevelDistance
      );
    }

    // Update x-force to position siblings
    const xForce = this.simulation.force('x') as d3.ForceX<ForceNode>;
    if (xForce) {
      xForce.x((d) => this.getSiblingPosition(d.id));
    }

    // Restore positions after updating the simulation
    for (const node of nodes) {
      const savedPos = positionSnapshot.get(node.id);
      if (savedPos) {
        node.x = savedPos.x;
        node.y = savedPos.y;
        if (node.fixed) {
          node.fx = savedPos.x;
          node.fy = savedPos.y;
        }
      }
    }

    // Heat the simulation temporarily when graph is refreshed
    this.simulation.alphaTarget(0.3).restart();

    // After a short delay, set alphaTarget back to 0 to allow cooling
    setTimeout(() => {
      this.simulation.alphaTarget(0);
    }, 300);
  }

  updateShapePositions() {
    const selectedIds = this.editor.getSelectedShapeIds();
    const selectedIdsSet = new Set(selectedIds);
    let hasSelectedNodeMoved = false;

    for (const node of this.simulation.nodes()) {
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
      node.fixed = 'isLocked' in shape.props && !!shape.props.isLocked;

      // Fix positions if we're dragging them
      if (selectedIdsSet.has(node.id)) {
        const newX = shape.x + x;
        const newY = shape.y + y;

        // Check if the selected node has moved
        if (Math.abs(node.x - newX) > 1 || Math.abs(node.y - newY) > 1) {
          hasSelectedNodeMoved = true;
        }

        node.x = newX;
        node.y = newY;
        node.fx = node.x;
        node.fy = node.y;
      } else {
        // Don't update position if locked
        if ('isLocked' in shape.props && shape.props.isLocked) {
          node.x = shape.x + x;
          node.y = shape.y + y;
          node.fx = node.x;
          node.fy = node.y;
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

    // If a selected node has moved, heat the simulation
    if (hasSelectedNodeMoved && selectedIds.length > 0) {
      // Set alphaTarget to heat the simulation when dragging
      this.simulation.alphaTarget(0.3);

      // Release fixed positions for children of moved nodes
      for (const selectedId of selectedIds) {
        this.releaseChildrenPositions(selectedId);
      }
    } else {
      // Cool down the simulation when not dragging
      this.simulation.alphaTarget(0);
    }
  }

  // Add this new method to release fixed positions of children when a parent moves
  releaseChildrenPositions(parentId: TLShapeId) {
    const children = this.nodeChildren.get(parentId);
    if (!children || children.size === 0) return;

    for (const childId of children) {
      const childNode = this.forceNodes.get(childId);
      if (childNode && !childNode.fixed) {
        // Release fixed position to allow movement
        childNode.fx = undefined;
        childNode.fy = undefined;

        // Recursively release positions of descendants
        this.releaseChildrenPositions(childId);
      }
    }
  }

  startSimulation() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.simulation.alpha(1).restart(); // Restart with high alpha
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
      const link: ForceLink = {
        source,
        target,
        id: arrow.id,
      };
      this.forceLinks.set(arrow.id, link);

      // Update hierarchical relationships when adding an arrow
      this.nodeParents.set(target, source);

      if (!this.nodeChildren.has(source)) {
        this.nodeChildren.set(source, new Set<TLShapeId>());
      }
      this.nodeChildren.get(source)!.add(target);

      // If target was a root node, it's no longer a root
      this.rootNodes.delete(target);

      // If source has no parent, it's a root node
      if (!this.nodeParents.has(source)) {
        this.rootNodes.add(source);
      }
    }
  };

  addGeo = (shape: TLShape) => {
    const bounds = this.editor.getShapeGeometry(shape)?.bounds;
    if (!bounds) return;

    const { w, h } = bounds;
    const { x, y } = getCornerToCenterOffset(w, h, shape.rotation);

    // Use the shape's actual position instead of defaulting to (0,0)
    const node: ForceNode = {
      id: shape.id,
      x: shape.x + x,
      y: shape.y + y,
      width: w,
      height: h,
      rotation: shape.rotation,
      // default to movable
      fixed: false,
    };

    // If shape is locked, fix its position
    if ('isLocked' in shape.props && shape.props.isLocked) {
      node.fixed = true;
      node.fx = node.x;
      node.fy = node.y;
    }

    this.forceNodes.set(shape.id, node);
  };

  // Get all descendants (children, grandchildren, etc.) of a shape
  getDescendants(
    shapeId: TLShapeId,
    visited = new Set<TLShapeId>()
  ): Set<TLShapeId> {
    if (visited.has(shapeId)) return visited;
    visited.add(shapeId);

    // Find all links where this shape is the source
    for (const [_, link] of this.forceLinks.entries()) {
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

  // Configure the simulation parameters
  setSimulationParams(params: {
    linkDistance?: number;
    linkStrength?: number;
    chargeStrength?: number;
    collisionRadius?: number;
    alphaDecay?: number;
    hierarchyLevelDistance?: number;
    siblingDistance?: number;
  }) {
    const {
      linkDistance,
      linkStrength,
      chargeStrength,
      collisionRadius,
      alphaDecay,
      hierarchyLevelDistance,
      siblingDistance,
    } = params;

    if (linkDistance !== undefined) this.linkDistance = linkDistance;
    if (linkStrength !== undefined) this.linkStrength = linkStrength;
    if (chargeStrength !== undefined) this.chargeStrength = chargeStrength;
    if (collisionRadius !== undefined) this.collisionRadius = collisionRadius;
    if (alphaDecay !== undefined) this.alphaDecay = alphaDecay;
    if (hierarchyLevelDistance !== undefined)
      this.hierarchyLevelDistance = hierarchyLevelDistance;
    if (siblingDistance !== undefined) this.siblingDistance = siblingDistance;

    // Update the forces with new parameters
    const linkForce = this.simulation.force('link') as d3.ForceLink<
      ForceNode,
      ForceLink
    >;
    if (linkForce) {
      linkForce.distance(this.linkDistance).strength(this.linkStrength);
    }

    const chargeForce = this.simulation.force(
      'charge'
    ) as d3.ForceManyBody<ForceNode>;
    if (chargeForce) {
      chargeForce.strength(this.chargeStrength);
    }

    const collideForce = this.simulation.force(
      'collide'
    ) as d3.ForceCollide<ForceNode>;
    if (collideForce) {
      collideForce.radius(
        (d) =>
          Math.sqrt(
            (d as ForceNode).width * (d as ForceNode).width +
              (d as ForceNode).height * (d as ForceNode).height
          ) /
            2 +
          this.collisionRadius
      );
    }

    this.simulation.alphaDecay(this.alphaDecay);

    // Restart the simulation to apply changes
    if (this.isRunning) {
      this.simulation.alpha(1).restart();
    }
  }

  // Get the hierarchy level of a node (depth in the tree)
  getHierarchyLevel(nodeId: TLShapeId, visited = new Set<TLShapeId>()): number {
    // Prevent cycles
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);

    let level = 0;
    let currentId = nodeId;

    // Traverse up the tree to count levels
    while (
      this.nodeParents.has(currentId) &&
      !visited.has(this.nodeParents.get(currentId)!)
    ) {
      level++;
      currentId = this.nodeParents.get(currentId)!;
      visited.add(currentId);
    }

    return level;
  }

  // Get a suggested x-position based on sibling order
  getSiblingPosition(nodeId: TLShapeId): number {
    const parentId = this.nodeParents.get(nodeId);

    // If no parent, this is a root node
    if (!parentId) {
      // Position root nodes evenly
      const rootArray = Array.from(this.rootNodes);
      const index = rootArray.indexOf(nodeId);
      return index * this.siblingDistance * 2;
    }

    // Get siblings (children of the same parent)
    const siblings = this.nodeChildren.get(parentId) || new Set<TLShapeId>();
    const siblingArray = Array.from(siblings);
    const index = siblingArray.indexOf(nodeId);

    // Get parent's position as base
    const parentNode = this.forceNodes.get(parentId);
    const baseX = parentNode ? parentNode.x : 0;

    // Position relative to parent, with siblings spread out
    const offset =
      (index - (siblingArray.length - 1) / 2) * this.siblingDistance;
    return baseX + offset;
  }

  // Update the hierarchical relationships based on current links
  updateHierarchicalRelationships() {
    // Save current positions
    const positionSnapshot = new Map<TLShapeId, { x: number; y: number }>();
    for (const [id, node] of this.forceNodes.entries()) {
      positionSnapshot.set(id, { x: node.x, y: node.y });
    }

    // Clear existing relationships
    this.nodeParents.clear();
    this.nodeChildren.clear();
    this.rootNodes.clear();

    // Build parent-child relationships from links
    for (const link of this.forceLinks.values()) {
      const sourceId = link.source;
      const targetId = link.target;

      // In our hierarchy, source is parent, target is child
      this.nodeParents.set(targetId, sourceId);

      // Add to children set
      if (!this.nodeChildren.has(sourceId)) {
        this.nodeChildren.set(sourceId, new Set<TLShapeId>());
      }
      this.nodeChildren.get(sourceId)!.add(targetId);
    }

    // Identify root nodes (nodes without parents)
    for (const nodeId of this.forceNodes.keys()) {
      if (!this.nodeParents.has(nodeId)) {
        this.rootNodes.add(nodeId);
      }
    }

    // Apply initial positioning based on hierarchy, but preserve existing positions
    this.applyHierarchicalPositioning(positionSnapshot);
  }

  // Apply initial positions based on hierarchy
  applyHierarchicalPositioning(
    positionSnapshot?: Map<TLShapeId, { x: number; y: number }>
  ) {
    // First position root nodes
    let rootIndex = 0;
    const rootSpacing = 300; // Space between root nodes

    for (const rootId of this.rootNodes) {
      const rootNode = this.forceNodes.get(rootId);
      if (rootNode) {
        // Only set position if we don't have a saved position
        if (!positionSnapshot || !positionSnapshot.has(rootId)) {
          rootNode.x = rootIndex * rootSpacing;
          rootNode.y = 0;
        } else {
          const savedPos = positionSnapshot.get(rootId)!;
          rootNode.x = savedPos.x;
          rootNode.y = savedPos.y;
        }
        rootIndex++;

        // Then position all descendants
        this.positionDescendants(rootId, 1, positionSnapshot);
      }
    }
  }

  // Recursively position descendants of a node
  positionDescendants(
    nodeId: TLShapeId,
    level: number,
    positionSnapshot?: Map<TLShapeId, { x: number; y: number }>
  ) {
    const children = this.nodeChildren.get(nodeId);
    if (!children || children.size === 0) return;

    const parentNode = this.forceNodes.get(nodeId);
    if (!parentNode) return;

    const childArray = Array.from(children);
    const totalWidth = (childArray.length - 1) * this.siblingDistance;
    const startX = parentNode.x - totalWidth / 2;

    // Create a set to track visited nodes to prevent cycles
    const visited = new Set<TLShapeId>([nodeId]);

    childArray.forEach((childId, index) => {
      const childNode = this.forceNodes.get(childId);
      if (childNode) {
        // Only set position if we don't have a saved position
        if (!positionSnapshot || !positionSnapshot.has(childId)) {
          childNode.x = startX + index * this.siblingDistance;
          childNode.y = level * this.hierarchyLevelDistance;
        } else {
          const savedPos = positionSnapshot.get(childId)!;
          childNode.x = savedPos.x;
          childNode.y = savedPos.y;
        }

        // Recursively position this node's children, but only if we haven't visited this node before
        if (!visited.has(childId)) {
          visited.add(childId);
          this.positionDescendants(childId, level + 1, positionSnapshot);
        }
      }
    });
  }

  // Add a new method to position new nodes intelligently
  positionNewNodes(newNodes: ForceNode[]) {
    if (newNodes.length === 0) return;

    // Get the viewport center as a fallback position
    const viewport = this.editor.getViewportPageBounds();
    const viewportCenter = { x: viewport.center.x, y: viewport.center.y };

    for (const node of newNodes) {
      // Try to position based on connected nodes
      let positioned = false;

      // Check if this node has a parent in the hierarchy
      const parentId = this.nodeParents.get(node.id);
      if (parentId) {
        const parentNode = this.forceNodes.get(parentId);
        if (parentNode) {
          // Position below parent with a slight offset
          node.x = parentNode.x + (Math.random() - 0.5) * 50;
          node.y = parentNode.y + this.hierarchyLevelDistance;
          positioned = true;
        }
      }

      // Check if this node has children
      if (!positioned && this.nodeChildren.has(node.id)) {
        const childrenIds = this.nodeChildren.get(node.id)!;
        if (childrenIds.size > 0) {
          // Calculate average position of children
          let sumX = 0,
            sumY = 0,
            count = 0;
          for (const childId of childrenIds) {
            const childNode = this.forceNodes.get(childId);
            if (childNode) {
              sumX += childNode.x;
              sumY += childNode.y;
              count++;
            }
          }

          if (count > 0) {
            // Position above the average of children
            node.x = sumX / count;
            node.y = sumY / count - this.hierarchyLevelDistance;
            positioned = true;
          }
        }
      }

      // If still not positioned, use viewport center with random offset
      if (!positioned) {
        // Get existing nodes to avoid overlap
        const existingNodes = Array.from(this.forceNodes.values()).filter(
          (n) => n.id !== node.id
        );

        if (existingNodes.length > 0) {
          // Calculate average position of all existing nodes
          const avgX =
            existingNodes.reduce((sum, n) => sum + n.x, 0) /
            existingNodes.length;
          const avgY =
            existingNodes.reduce((sum, n) => sum + n.y, 0) /
            existingNodes.length;

          // Position with a random offset from the average
          const angle = Math.random() * Math.PI * 2;
          const distance = 150 + Math.random() * 100;
          node.x = avgX + Math.cos(angle) * distance;
          node.y = avgY + Math.sin(angle) * distance;
        } else {
          // If no existing nodes, use viewport center with random offset
          const angle = Math.random() * Math.PI * 2;
          const distance = 100 + Math.random() * 50;
          node.x = viewportCenter.x + Math.cos(angle) * distance;
          node.y = viewportCenter.y + Math.sin(angle) * distance;
        }
      }
    }
  }

  // Add this method to allow configuring the radial layout
  setRadialLayoutParams(params: {
    radialRadius?: number;
    radiusIncrement?: number;
    angularSpread?: number;
  }) {
    const { radialRadius, radiusIncrement, angularSpread } = params;

    if (radialRadius !== undefined) this.radialRadius = radialRadius;
    if (radiusIncrement !== undefined) this.radiusIncrement = radiusIncrement;
    if (angularSpread !== undefined) this.angularSpread = angularSpread;

    // Update the radial force with new parameters
    const radialForce = this.simulation.force(
      'radial'
    ) as d3.ForceRadial<ForceNode>;
    if (radialForce) {
      radialForce.radius(
        (d) =>
          this.getHierarchyLevel(d.id) * this.radiusIncrement +
          this.radialRadius
      );
    }

    // Restart the simulation to apply changes
    if (this.isRunning) {
      this.simulation.alpha(1).restart();
    }
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
