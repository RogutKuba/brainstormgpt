import React, { createContext, useEffect, useMemo, useState } from 'react';
import { TLShape, TLRecord, Editor, HistoryEntry } from 'tldraw';
import { BaseCollection } from './BaseCollection';

interface CollectionContextValue {
  get: (id: string) => BaseCollection | undefined;
}

type Collection = new (editor: Editor) => BaseCollection;

interface CollectionProviderProps {
  editor: Editor;
  collections: Collection[];
  children: React.ReactNode;
}

const CollectionContext = createContext<CollectionContextValue | undefined>(
  undefined
);

const CollectionProvider: React.FC<CollectionProviderProps> = ({
  editor,
  collections: collectionClasses,
  children,
}) => {
  const [collections, setCollections] = useState<Map<
    string,
    BaseCollection
  > | null>(null);

  // Handle shape property changes
  const handleShapeChange = (prev: TLShape, next: TLShape) => {
    if (!collections) return; // Ensure collections is not null
    for (const collection of collections.values()) {
      if (collection.getShapes().has(next.id)) {
        collection._onShapeChange(prev, next);
      }
    }
  };

  // Handle shape deletions
  const handleShapeDelete = (shape: TLShape) => {
    if (!collections) return; // Ensure collections is not null
    for (const collection of collections.values()) {
      collection.remove([shape]);
    }
  };

  useEffect(() => {
    if (editor) {
      const initializedCollections = new Map<string, BaseCollection>();
      for (const ColClass of collectionClasses) {
        const instance = new ColClass(editor);
        initializedCollections.set(instance.id, instance);
      }
      setCollections(initializedCollections);
    }
  }, [editor, collectionClasses]);

  // // Subscribe to shape changes in the editor
  // useEffect(() => {
  //   if (editor && collections) {
  //     editor.store.listen = (prev: TLRecord, next: TLRecord) => {
  //       if (next.typeName !== 'shape') return;
  //       const prevShape = prev as TLShape;
  //       const nextShape = next as TLShape;
  //       handleShapeChange(prevShape, nextShape);
  //     };
  //   }
  // }, [editor, collections]);

  // // Subscribe to shape deletions in the editor
  // useEffect(() => {
  //   if (editor && collections) {
  //     editor.store.onAfterDelete = (prev: TLRecord, _: string) => {
  //       if (prev.typeName === 'shape') handleShapeDelete(prev);
  //     };
  //   }
  // }, [editor, collections]);

  // listen to editor.store.listen
  useEffect(() => {
    if (editor && collections) {
      editor.store.listen((entry: HistoryEntry) => {
        const removed = Object.values(entry.changes.removed);
        const added = Object.values(entry.changes.added);
        const updated = Object.values(entry.changes.updated);

        if (removed.length > 0) {
          // console.log('removed', entry.changes.removed);
          for (const shape of removed) {
            handleShapeDelete(shape as TLShape);
          }
        }
        if (added.length > 0) {
          // console.log('added', entry.changes.added);
          for (const shape of added) {
            // TODO: fix this
            handleShapeChange(shape as any, shape as any);
          }
        }
        if (updated.length > 0) {
          // console.log('updated', entry.changes.updated);
          for (const shape of updated) {
            // TODO: fix this
            handleShapeChange(shape as any, shape as any);
          }
        }
      });
    }
  }, [editor, collections]);

  const value = useMemo(
    () => ({
      get: (id: string) => collections?.get(id),
    }),
    [collections]
  );

  return (
    <CollectionContext.Provider value={value}>
      {collections ? children : null}
    </CollectionContext.Provider>
  );
};

export { CollectionContext, CollectionProvider, type Collection };
