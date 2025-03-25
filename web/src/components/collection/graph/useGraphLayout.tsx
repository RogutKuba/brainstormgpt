import { useEditor } from 'tldraw';
import { useEffect, useRef } from 'react';
import { useCollection } from '../base/useCollection';
import { GraphLayoutCollection } from './GraphLayoutCollection';
import debounce from 'lodash/debounce';
import './dev-ui.css';

// debounce time should be really short to avoid waiting for any updates
const DEBOUNCE_TIME = 50;

export const GraphLayout = () => {
  const editor = useEditor();
  const { collection, size } = useCollection<GraphLayoutCollection>('graph');
  const handlersRegistered = useRef(false);
  // Add refs to store debounced functions per shape
  const shapeHandlers = useRef(
    new Map<
      string,
      {
        create: (shape: any) => void;
        change: (prev: any, next: any) => void;
        delete: (shape: any) => void;
      }
    >()
  );

  useEffect(() => {
    if (collection && editor && !handlersRegistered.current) {
      collection.add(editor.getCurrentPageShapes());

      // Handler factory that creates or retrieves debounced handlers for a shape
      const getShapeHandlers = (shapeId: string) => {
        if (!shapeHandlers.current.has(shapeId)) {
          shapeHandlers.current.set(shapeId, {
            create: debounce((shape) => {
              console.log('debouncedShapeCreateHandler', shape.id);
              collection.add([shape]);
            }, DEBOUNCE_TIME),
            change: (prev, next) => {
              collection._onShapeChange(prev, next);
            },
            delete: debounce((shape) => {
              collection.remove([shape]);
              // Cleanup handlers when shape is deleted
              shapeHandlers.current.delete(shapeId);
            }, DEBOUNCE_TIME),
          });
        }
        return shapeHandlers.current.get(shapeId)!;
      };

      // Modified handlers that use per-shape debounced functions
      const shapeCreateHandler = (shape: any) => {
        const handlers = getShapeHandlers(shape.id);
        handlers.create(shape);
      };

      const shapeChangeHandler = (prev: any, next: any) => {
        const handlers = getShapeHandlers(next.id);
        handlers.change(prev, next);
      };

      const shapeDeleteHandler = (shape: any) => {
        const handlers = getShapeHandlers(shape.id);
        handlers.delete(shape);
      };

      // Register event handlers with the new per-shape debounced functions
      editor.store.sideEffects.registerAfterCreateHandler(
        'shape',
        shapeCreateHandler
      );

      editor.store.sideEffects.registerAfterChangeHandler(
        'shape',
        shapeChangeHandler
      );

      editor.store.sideEffects.registerAfterDeleteHandler(
        'shape',
        shapeDeleteHandler
      );

      // Debounced handler for binding creation
      const debouncedBindingCreateHandler = debounce((binding) => {
        // get the shape associated
        const arrowBindings = editor.getBindingsInvolvingShape(binding.fromId);

        // if the arrow has the two bindings, add it to the collection
        if (arrowBindings.length === 2) {
          const shape = editor.getShape(binding.fromId);
          if (shape) {
            collection.add([shape]);
          }
        }
      }, DEBOUNCE_TIME);

      // Debounced handler for binding deletion
      const debouncedBindingDeleteHandler = debounce((binding) => {
        const arrowShape = editor.getShape(binding.fromId);
        if (arrowShape) {
          collection.remove([arrowShape]);
        }
      }, DEBOUNCE_TIME);

      // register event handlers for bindings added to the page
      editor.store.sideEffects.registerAfterCreateHandler(
        'binding',
        debouncedBindingCreateHandler
      );

      // register event handlers for bindings removed from the page
      editor.store.sideEffects.registerAfterDeleteHandler(
        'binding',
        debouncedBindingDeleteHandler
      );

      // Mark that handlers have been registered
      handlersRegistered.current = true;
    }
  }, [collection, editor]);

  return null;
};
