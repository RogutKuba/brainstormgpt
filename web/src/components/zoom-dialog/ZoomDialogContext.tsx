import React, { createContext, useContext, useState } from 'react';

interface ZoomDialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
  title: React.ReactNode | null;
  content: React.ReactNode | null;
  openZoomDialog: (title: React.ReactNode, content: React.ReactNode) => void;
}

const ZoomDialogContext = createContext<ZoomDialogContextType | undefined>(
  undefined
);

export const ZoomDialogProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState<React.ReactNode | null>(null);
  const [content, setContent] = useState<React.ReactNode | null>(null);

  const openZoomDialog = (title: React.ReactNode, content: React.ReactNode) => {
    setTitle(title);
    setContent(content);
    setOpen(true);
  };

  return (
    <ZoomDialogContext.Provider
      value={{
        open,
        setOpen,
        title,
        content,
        openZoomDialog,
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
