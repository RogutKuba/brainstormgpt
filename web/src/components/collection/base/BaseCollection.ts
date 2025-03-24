import { Editor, TLArrowBinding, TLShape, TLShapeId } from 'tldraw';

/**
 * A PoC abstract collections class for @tldraw.
 */
export abstract class BaseCollection {
  /** A unique identifier for the collection. */
  abstract id: string;
  /** A map containing the shapes that belong to this collection, keyed by their IDs. */
  protected shapes: Map<TLShapeId, TLShape> = new Map();
  /** A reference to the \@tldraw Editor instance. */
  protected editor: Editor;
  /** A set of listeners to be notified when the collection changes. */
  private listeners = new Set<() => void>();
  /** A map of binding functions keyed by a string identifier */
  private bindings: Map<string, TLArrowBinding> = new Map();

  // TODO: Maybe pass callback to replace updateShape so only CollectionProvider can call it
  public constructor(editor: Editor) {
    this.editor = editor;
  }

  /**
   * Called when shapes are added to the collection.
   * @param shapes The shapes being added to the collection.
   */
  protected onAdd(_shapes: TLShape[]): void {}

  /**
   * Called when shapes are removed from the collection.
   * @param shapes The shapes being removed from the collection.
   */
  protected onRemove(_shapes: TLShape[]) {}

  /**
   * Called when the membership of the collection changes (i.e., when shapes are added or removed).
   */
  protected onMembershipChange() {}

  /**
   * Called when the properties of a shape belonging to the collection change.
   * @param prev The previous version of the shape before the change.
   * @param next The updated version of the shape after the change.
   */
  protected onShapeChange(_prev: TLShape, _next: TLShape) {}

  /**
   * Called when the binding is added
   */
  protected onBindingAdd(_bindings: TLArrowBinding[]) {}

  /**
   * Called when the binding is removed
   */
  protected onBindingRemove(_bindings: TLArrowBinding[]) {}

  /**
   * Adds the specified shapes to the collection.
   * @param shapes The shapes to add to the collection.
   */
  public add(shapes: TLShape[]) {
    shapes.forEach((shape) => {
      this.shapes.set(shape.id, shape);
    });
    this.onAdd(shapes);
    this.onMembershipChange();
    this.notifyListeners();
  }

  /**
   * Removes the specified shapes from the collection.
   * @param shapes The shapes to remove from the collection.
   */
  public remove(shapes: TLShape[]) {
    shapes.forEach((shape) => {
      this.shapes.delete(shape.id);
    });
    this.onRemove(shapes);
    this.onMembershipChange();
    this.notifyListeners();
  }

  /**
   * Clears all shapes from the collection.
   */
  public clear() {
    this.remove([...this.shapes.values()]);
  }

  /**
   * Returns the map of shapes in the collection.
   * @returns The map of shapes in the collection, keyed by their IDs.
   */
  public getShapes(): Map<TLShapeId, TLShape> {
    return this.shapes;
  }

  public get size(): number {
    return this.shapes.size;
  }

  public _onShapeChange(prev: TLShape, next: TLShape) {
    this.shapes.set(next.id, next);
    this.onShapeChange(prev, next);
    this.notifyListeners();
  }

  /**
   * Adds a binding function that will be called with the collection's shapes
   * @param id A unique identifier for this binding
   * @param bindingFn The function to call with the collection's shapes
   * @returns A function to remove this binding
   */
  public addBinding(bindings: TLArrowBinding[]) {
    for (const binding of bindings) {
      this.bindings.set(binding.id, binding);
    }
    this.onBindingAdd(bindings);
    this.notifyListeners();
  }

  /**
   * Removes a binding function by its identifier
   * @param id The identifier of the binding to remove
   * @returns Whether the binding was successfully removed
   */
  public removeBinding(bindings: TLArrowBinding[]) {
    for (const binding of bindings) {
      this.bindings.delete(binding.id);
    }
    this.onBindingRemove(bindings);
    this.notifyListeners();
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
