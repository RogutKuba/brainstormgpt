import { useEditor } from 'tldraw';
import { useEffect, useRef } from 'react';
import { useCollection } from '../base/useCollection';
import { GraphLayoutCollection } from './GraphLayoutCollection';
import debounce from 'lodash/debounce';
import './dev-ui.css';

export const GraphLayout = () => {
  const editor = useEditor();
  const { collection, size } = useCollection<GraphLayoutCollection>('graph');
  const handlersRegistered = useRef(false);

  useEffect(() => {
    if (collection && editor && !handlersRegistered.current) {
      collection.add(editor.getCurrentPageShapes());

      // Debounced handler for shape creation
      const debouncedShapeCreateHandler = debounce((shape) => {
        collection.add([shape]);
      }, 300);

      // Debounced handler for shape updates
      const debouncedShapeChangeHandler = debounce((prev, next) => {
        collection._onShapeChange(prev, next);
      }, 300);

      // Debounced handler for shape deletion
      const debouncedShapeDeleteHandler = debounce((shape) => {
        collection.remove([shape]);
      }, 300);

      // register event handlers for shapes added to the page
      editor.store.sideEffects.registerAfterCreateHandler(
        'shape',
        debouncedShapeCreateHandler
      );

      // register event handler for updated shape
      editor.store.sideEffects.registerAfterChangeHandler(
        'shape',
        debouncedShapeChangeHandler
      );

      // register event handlers for shapes removed from the page
      editor.store.sideEffects.registerAfterDeleteHandler(
        'shape',
        debouncedShapeDeleteHandler
      );

      // Debounced handler for binding creation
      const debouncedBindingCreateHandler = debounce((binding) => {
        console.log('binding created', binding);
        // get the shape associated
        const arrowBindings = editor.getBindingsInvolvingShape(binding.fromId);

        // if the arrow has the two bindings, add it to the collection
        if (arrowBindings.length === 2) {
          const shape = editor.getShape(binding.fromId);
          if (shape) {
            collection.add([shape]);
          }
        }
      }, 300);

      // Debounced handler for binding deletion
      const debouncedBindingDeleteHandler = debounce((binding) => {
        const arrowShape = editor.getShape(binding.fromId);
        if (arrowShape) {
          collection.remove([arrowShape]);
        }
      }, 300);

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
