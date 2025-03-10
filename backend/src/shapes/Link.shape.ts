import { TLBaseShape } from 'tldraw';

type LinkShapeProps = {
  h: number;
  w: number;
  url: string;
  title: string;
  content: string;
  isLoading: boolean;
  error: string | null;
  previewImageUrl: string | null;
};

export type LinkShape = TLBaseShape<'link', LinkShapeProps>;
