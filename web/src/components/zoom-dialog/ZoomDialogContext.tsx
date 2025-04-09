import React, { createContext, useContext, useState } from 'react';
import { TLShapeId } from 'tldraw';

export interface RichTextContentType {
  type: 'rich-text';
  content: string;
  shapeId: TLShapeId;
}
export interface LinkContentType {
  type: 'link';
  url: string;
  title: string;
  description: string;
  previewImageUrl: string | null;
  shapeId: TLShapeId;
}

interface PredictionsType {
  text: string;
  type: 'text' | 'image' | 'web';
}
[];

export interface ZoomDialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  title: React.ReactNode | null;
  content:
    | ((RichTextContentType | LinkContentType) & {
        predictions: PredictionsType[];
      })
    | null;
  openRichTextZoomDialog: (
    title: React.ReactNode,
    content: RichTextContentType,
    predictions: PredictionsType[]
  ) => void;
  openLinkZoomDialog: (
    title: React.ReactNode,
    content: LinkContentType,
    predictions: PredictionsType[]
  ) => void;
}

const ZoomDialogContext = createContext<ZoomDialogContextType | undefined>(
  undefined
);

export const ZoomDialogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState<React.ReactNode | null>(null);
  const [content, setContent] = useState<
    ZoomDialogContextType['content'] | null
  >(null);
  const [predictions, setPredictions] = useState<PredictionsType[]>([]);

  const openRichTextZoomDialog = (
    title: React.ReactNode,
    content: RichTextContentType,
    predictions: PredictionsType[]
  ) => {
    setTitle(title);
    setContent({
      ...content,
      predictions,
    });
    setOpen(true);
  };

  const openLinkZoomDialog = (
    title: React.ReactNode,
    content: LinkContentType,
    predictions: PredictionsType[]
  ) => {
    setTitle(title);
    setContent({
      ...content,
      predictions,
    });
    setOpen(true);
  };

  return (
    <ZoomDialogContext.Provider
      value={{
        open,
        setOpen,
        title,
        content,
        openRichTextZoomDialog,
        openLinkZoomDialog,
      }}
    >
      {children}
    </ZoomDialogContext.Provider>
  );
};

export const useZoomDialog = (): ZoomDialogContextType => {
  const context = useContext(ZoomDialogContext);
  if (context === undefined) {
    throw new Error('useZoomDialog must be used within a ZoomDialogProvider');
  }
  return context;
};
