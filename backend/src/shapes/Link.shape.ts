import { TLBaseShape } from 'tldraw';

type LinkShapeProps = {
  h: number;
  w: number;
  url: string;
  title: string;
  description: string;
  isLoading: boolean;
  status: 'success' | 'error' | 'scraping' | 'analyzing';
  error: string | null;
  previewImageUrl: string | null;
  isLocked: boolean;
  isExpanded: boolean;
  minCollapsedHeight: number;
  prevCollapsedHeight: number;
  predictions: { text: string; type: 'text' | 'image' | 'web' }[];
};

export type LinkShape = TLBaseShape<'link', LinkShapeProps>;
