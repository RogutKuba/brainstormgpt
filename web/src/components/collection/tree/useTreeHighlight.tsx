import { TLShapeId, TLShape, TLBinding, useEditor, useReactor } from 'tldraw';
import { useCollection } from '../base/useCollection';
import { TreeCollection } from './TreeCollection';
import { debounce } from 'lodash';
import { useEffect, useRef } from 'react';
// Debounce time for selection changes
const DEBOUNCE_TIME = 100;

export const TreeHighlight = () => {
  const editor = useEditor();
  const handlersRegistered = useRef(false);

  const { collection } = useCollection<TreeCollection>('tree');

  useReactor(
    'selected-shapes',
    () => {
      const selectedIds = editor.getSelectedShapeIds();
      handleSelectionChange(selectedIds);
    },
    [editor]
  );

  // Create a debounced selection handler
  const handleSelectionChange = debounce((selectedIds: TLShapeId[]) => {
    resetAllArrowColors();
    resetAllNodeColors();

    const nodes: TLShapeId[] = [];
    const arrows: TLShapeId[] = [];

    // Build the selected tree paths and update colors
    selectedIds.forEach((id) => {
      const totalParents = collection.getTotalParents(id);
      nodes.push(...Array.from(totalParents.parents));
      arrows.push(...Array.from(totalParents.arrows));
    });

    // Update arrow colors based on the selected tree
    updateArrowColors(arrows);
    updateNodeColors(nodes);
  }, DEBOUNCE_TIME);

  const updateNodeColors = (nodeIds: TLShapeId[]) => {
    // update the node color to be highlighted
    nodeIds.forEach((nodeId) => {
      editor.updateShape({
        id: nodeId,
        type: 'any',
        props: { isHighlighted: true },
      });
    });
  };

  // Update arrow colors based on the selected tree
  const updateArrowColors = (arrowIds: TLShapeId[]) => {
    arrowIds.forEach((arrowId) => {
      editor.updateShape({
        id: arrowId,
        type: 'arrow',
        props: { color: 'blue', size: 'xl' },
      });
    });
  };

  // reset all node colors
  const resetAllNodeColors = () => {
    const nodeMap = collection.getShapes();
    for (const node of nodeMap.values()) {
      if (node.type === 'arrow') {
        continue;
      }

      editor.updateShape({
        id: node.id,
        type: node.type,
        props: { isHighlighted: false },
      });
    }
  };

  // Reset all arrow colors to black
  const resetAllArrowColors = () => {
    const arrowMap = collection.getArrows();

    for (const arrowId of arrowMap.keys()) {
      editor.updateShape({
        id: arrowId,
        type: 'arrow',
        props: {
          color: 'black',
          size: 'm',
        },
      });
    }
  };

  useEffect(() => {
    if (collection && editor && !handlersRegistered.current) {
      collection.add(editor.getCurrentPageShapes());

      // Create a map to store handlers for each shape
      const handlersMap = new Map<
        TLShapeId,
        {
          create: (shape: TLShape) => void;
          // change: (prev: TLShape, next: TLShape) => void;
          delete: (shape: TLShape) => void;
        }
      >();

      // Function to get or create handlers for a shape
      const getShapeHandlers = (shapeId: TLShapeId) => {
        if (!handlersMap.has(shapeId)) {
          handlersMap.set(shapeId, {
            create: (shape: TLShape) => {
              collection.add([shape]);
            },
            // change: (prev: TLShape, next: TLShape) => {
            //   collection.update([next]);
            // },
            delete: (shape: TLShape) => {
              collection.remove([shape]);
            },
          });
        }
        return handlersMap.get(shapeId)!;
      };

      // Modified handlers that use per-shape debounced functions
      const shapeCreateHandler = (shape: TLShape) => {
        const handlers = getShapeHandlers(shape.id);
        handlers.create(shape);
      };

      // const shapeChangeHandler = (prev: TLShape, next: TLShape) => {
      //   const handlers = getShapeHandlers(next.id);
      //   handlers.change(prev, next);
      // };

      const shapeDeleteHandler = (shape: TLShape) => {
        const handlers = getShapeHandlers(shape.id);
        handlers.delete(shape);
      };

      // Register event handlers with the new per-shape debounced functions
      editor.store.sideEffects.registerAfterCreateHandler(
        'shape',
        shapeCreateHandler
      );

      // editor.store.sideEffects.registerAfterChangeHandler(
      //   'shape',
      //   shapeChangeHandler
      // );

      editor.store.sideEffects.registerAfterDeleteHandler(
        'shape',
        shapeDeleteHandler
      );

      // Debounced handler for binding creation
      const debouncedBindingCreateHandler = debounce((binding: TLBinding) => {
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
      const debouncedBindingDeleteHandler = debounce((binding: TLBinding) => {
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

  // Return null as this is just a hook
  return null;
};
