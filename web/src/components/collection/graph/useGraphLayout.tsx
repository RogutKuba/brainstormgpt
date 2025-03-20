import { useEditor } from 'tldraw';
import { useEffect, useRef } from 'react';
import './dev-ui.css';
import { useCollection } from '../base/useCollection';

export const GraphLayout = () => {
  const editor = useEditor();
  const { collection, size } = useCollection('graph');
  const handlersRegistered = useRef(false);

  useEffect(() => {
    if (collection && editor && !handlersRegistered.current) {
      collection.add(editor.getCurrentPageShapes());

      // register event handlers for shapes added to the page
      editor.store.sideEffects.registerAfterCreateHandler('shape', (shape) => {
        collection.add([shape]);
      });

      // register event handlers for shapes removed from the page
      editor.store.sideEffects.registerAfterDeleteHandler('shape', (shape) => {
        collection.remove([shape]);
      });

      // register event handlers for bindings added to the page
      editor.store.sideEffects.registerAfterCreateHandler(
        'binding',
        (binding) => {
          // get the shape associated
          const arrowBindings = editor.getBindingsInvolvingShape(
            binding.fromId
          );

          // if the arrow has the two bindings, add it to the collection
          if (arrowBindings.length === 2) {
            const shape = editor.getShape(binding.fromId);
            if (shape) {
              collection.add([shape]);
            }
          }
        }
      );

      // register event handlers for bindings removed from the page
      editor.store.sideEffects.registerAfterDeleteHandler(
        'binding',
        (binding) => {
          const arrowShape = editor.getShape(binding.fromId);
          if (arrowShape) {
            collection.remove([arrowShape]);
          }
        }
      );

      // Mark that handlers have been registered
      handlersRegistered.current = true;
    }
  }, [collection, editor]);

  return null;
};
