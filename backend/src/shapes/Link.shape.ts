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
};

export type LinkShape = TLBaseShape<'link', LinkShapeProps>;
