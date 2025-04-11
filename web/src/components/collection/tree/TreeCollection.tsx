import { BaseCollection } from '../base/BaseCollection';
import {
  Editor,
  TLArrowBinding,
  TLArrowShape,
  TLShape,
  TLShapeId,
} from 'tldraw';

export class TreeCollection extends BaseCollection {
  override id = 'tree';

  // Maps to track tree structure
  private nodeParents: Map<TLShapeId, Set<TLShapeId>> = new Map();
  private nodeChildren: Map<TLShapeId, Set<TLShapeId>> = new Map();
  private arrowMap: Map<TLShapeId, TLArrowShape> = new Map();
  private arrowSources: Map<TLShapeId, TLShapeId> = new Map();
  private arrowTargets: Map<TLShapeId, TLShapeId> = new Map();

  constructor(editor: Editor) {
    super(editor);
  }

  /**
   * Get all ancestors of a node (parents, grandparents, etc.)
   */
  getAncestors(nodeId: TLShapeId): TLShapeId[] {
    const ancestors: TLShapeId[] = [];
    const visited = new Set<TLShapeId>();

    const processParents = (id: TLShapeId) => {
      if (visited.has(id)) return;
      visited.add(id);

      const parents = this.nodeParents.get(id);
      if (!parents) return;

      for (const parentId of parents) {
        ancestors.push(parentId);
        processParents(parentId);
      }
    };

    processParents(nodeId);
    return ancestors;
  }

  /**
   * Get all descendants of a node (children, grandchildren, etc.)
   */
  getDescendants(nodeId: TLShapeId): TLShapeId[] {
    const descendants: TLShapeId[] = [];
    const visited = new Set<TLShapeId>();

    const processChildren = (id: TLShapeId) => {
      if (visited.has(id)) return;
      visited.add(id);

      const children = this.nodeChildren.get(id);
      if (!children) return;

      for (const childId of children) {
        descendants.push(childId);
        processChildren(childId);
      }
    };

    processChildren(nodeId);
    return descendants;
  }

  /**
   * Get the source shape ID of an arrow
   */
  getArrowSource(arrowId: TLShapeId): TLShapeId | undefined {
    return this.arrowSources.get(arrowId);
  }

  /**
   * Get the target shape ID of an arrow
   */
  getArrowTarget(arrowId: TLShapeId): TLShapeId | undefined {
    return this.arrowTargets.get(arrowId);
  }

  /**
   * Get all arrows in the tree
   */
  getArrows(): Map<TLShapeId, TLArrowShape> {
    return this.arrowMap;
  }

  /**
   * Get the parents of a node
   */
  getParentNodes(nodeId: TLShapeId): Set<TLShapeId> | undefined {
    return this.nodeParents.get(nodeId);
  }

  /**
   * Gets the parent shapes and parent arrows of a node
   * Returns all ancestors and the arrows connecting them
   */
  getTotalParents(nodeId: TLShapeId): {
    parents: Set<TLShapeId>;
    arrows: Set<TLShapeId>;
  } {
    const directParents = this.getParentNodes(nodeId);
    if (!directParents) return { parents: new Set(), arrows: new Set() };

    const allParents = new Set<TLShapeId>(directParents);
    const allArrows = new Set<TLShapeId>();

    // Queue for breadth-first traversal
    const queue: TLShapeId[] = Array.from(directParents);
    // Track visited nodes to avoid cycles
    const visited = new Set<TLShapeId>([nodeId, ...directParents]);

    // Find arrows connecting the node to its direct parents
    for (const parentId of directParents) {
      // Find arrows from parent to this node
      for (const arrowId of this.arrowMap.keys()) {
        const source = this.arrowSources.get(arrowId);
        const target = this.arrowTargets.get(arrowId);

        if (source === parentId && target === nodeId) {
          allArrows.add(arrowId);
        }
      }
    }

    // Process the queue to find all ancestors and connecting arrows
    while (queue.length > 0) {
      const currentId = queue.shift()!;

      // Get parents of the current node
      const parents = this.nodeParents.get(currentId);
      if (!parents) continue;

      for (const parentId of parents) {
        // Skip if already visited to prevent cycles
        if (visited.has(parentId)) continue;

        // Add to results and mark as visited
        allParents.add(parentId);
        visited.add(parentId);
        queue.push(parentId);

        // Find the arrow connecting current node to this parent
        for (const arrowId of this.arrowMap.keys()) {
          const source = this.arrowSources.get(arrowId);
          const target = this.arrowTargets.get(arrowId);

          if (source === parentId && target === currentId) {
            allArrows.add(arrowId);
          }
        }
      }
    }

    return { parents: allParents, arrows: allArrows };
  }

  /**
   * Get the children of a node
   */
  getChildren(nodeId: TLShapeId): Set<TLShapeId> | undefined {
    return this.nodeChildren.get(nodeId);
  }

  /**
   * Called when shapes are added to the collection
   */
  override onAdd(shapes: TLShape[]) {
    for (const shape of shapes) {
      if (shape.type === 'arrow') {
        this.addArrow(shape as TLArrowShape);
      } else {
        // For non-arrow shapes, just add them to the shapes map
        this.shapes.set(shape.id, shape);
      }
    }

    // Rebuild the tree structure
    this.buildTreeStructure();
  }

  /**
   * Called when shapes are removed from the collection
   */
  override onRemove(shapes: TLShape[]) {
    const removedIds = new Set(shapes.map((s) => s.id));
    const arrowsToDelete = new Set<TLShapeId>();

    // First identify all arrows connected to removed shapes
    for (const id of removedIds) {
      // Find arrows where this shape is source or target
      for (const arrowId of this.arrowMap.keys()) {
        const source = this.arrowSources.get(arrowId);
        const target = this.arrowTargets.get(arrowId);

        if (source === id || target === id) {
          arrowsToDelete.add(arrowId);
        }
      }
    }

    // Delete connected arrows from the editor
    if (arrowsToDelete.size > 0) {
      this.editor.deleteShapes([...arrowsToDelete]);
    }

    // Clean up internal data structures
    for (const id of removedIds) {
      this.shapes.delete(id);
      this.arrowMap.delete(id);
      this.arrowSources.delete(id);
      this.arrowTargets.delete(id);

      // Clean up parent-child relationships
      const children = this.nodeChildren.get(id);
      if (children) {
        for (const childId of children) {
          const childParents = this.nodeParents.get(childId);
          if (childParents) {
            childParents.delete(id);
            if (childParents.size === 0) {
              this.nodeParents.delete(childId);
            }
          }
        }
        this.nodeChildren.delete(id);
      }

      // Remove this node from its parents' children sets
      const parents = this.nodeParents.get(id);
      if (parents) {
        for (const parentId of parents) {
          const parentChildren = this.nodeChildren.get(parentId);
          if (parentChildren) {
            parentChildren.delete(id);
            if (parentChildren.size === 0) {
              this.nodeChildren.delete(parentId);
            }
          }
        }
        this.nodeParents.delete(id);
      }
    }

    // Rebuild the tree structure
    this.buildTreeStructure();
  }

  /**
   * Called when bindings are added
   */
  override onBindingAdd(bindings: TLArrowBinding[]) {
    // Process new bindings
    for (const binding of bindings) {
      const arrowShape = this.editor.getShape(binding.fromId);
      if (arrowShape && arrowShape.type === 'arrow') {
        this.arrowMap.set(arrowShape.id, arrowShape as TLArrowShape);
      }
    }

    // Rebuild the tree structure
    this.buildTreeStructure();
  }

  /**
   * Called when bindings are removed
   */
  override onBindingRemove(bindings: TLArrowBinding[]) {
    // Process removed bindings
    const arrowIds = new Set(bindings.map((b) => b.fromId));

    // Check if any arrows need to be removed from our tracking
    for (const arrowId of arrowIds) {
      const remainingBindings = this.editor.getBindingsInvolvingShape(arrowId);
      if (remainingBindings.length < 2) {
        // Arrow doesn't have both start and end bindings anymore
        this.arrowMap.delete(arrowId);
      }
    }

    // Rebuild the tree structure
    this.buildTreeStructure();
  }

  /**
   * Add an arrow to the collection
   */
  private addArrow(arrow: TLArrowShape) {
    const bindings = this.editor.getBindingsInvolvingShape(
      arrow.id
    ) as TLArrowBinding[];

    const sourceBinding = bindings.find((b) => b.props.terminal === 'start');
    const targetBinding = bindings.find((b) => b.props.terminal === 'end');

    if (sourceBinding && targetBinding) {
      const sourceId = sourceBinding.toId;
      const targetId = targetBinding.toId;

      this.shapes.set(arrow.id, arrow);
      this.arrowMap.set(arrow.id, arrow);
      this.arrowSources.set(arrow.id, sourceId);
      this.arrowTargets.set(arrow.id, targetId);

      // Update parent-child relationships (now supporting multiple parents)
      if (!this.nodeChildren.has(sourceId)) {
        this.nodeChildren.set(sourceId, new Set<TLShapeId>());
      }
      this.nodeChildren.get(sourceId)!.add(targetId);

      if (!this.nodeParents.has(targetId)) {
        this.nodeParents.set(targetId, new Set<TLShapeId>());
      }
      this.nodeParents.get(targetId)!.add(sourceId);
    }
  }

  /**
   * Build the tree structure from arrows and bindings
   */
  private buildTreeStructure() {
    // Clear existing structure
    this.nodeParents.clear();
    this.nodeChildren.clear();

    // Process all arrows to build parent-child relationships
    for (const [arrowId, _] of this.arrowMap.entries()) {
      const sourceId = this.getArrowSource(arrowId);
      const targetId = this.getArrowTarget(arrowId);

      if (!sourceId || !targetId) continue;

      // Set parent-child relationship (source is parent, target is child)
      if (!this.nodeParents.has(targetId)) {
        this.nodeParents.set(targetId, new Set<TLShapeId>());
      }
      this.nodeParents.get(targetId)!.add(sourceId);

      // Add to children set
      if (!this.nodeChildren.has(sourceId)) {
        this.nodeChildren.set(sourceId, new Set<TLShapeId>());
      }
      this.nodeChildren.get(sourceId)!.add(targetId);
    }
  }

  /**
   * Called when a shape changes
   */
  override onShapeChange(prev: TLShape, next: TLShape) {
    // Update our internal maps
    this.shapes.set(next.id, next);

    if (next.type === 'arrow') {
      this.arrowMap.set(next.id, next as TLArrowShape);
    }
  }
}
