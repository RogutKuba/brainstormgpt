import { TLBaseShape } from 'tldraw';
import { BaseContentShapeProps } from './BaseContent.shape';

type LinkShapeProps = {
  url: string;
  title: string;
  description: string;
  isLoading: boolean;
  status: 'success' | 'error' | 'scraping' | 'analyzing';
  error: string | null;
  previewImageUrl: string | null;
  isDefault: boolean;
} & BaseContentShapeProps;

export type LinkShape = TLBaseShape<'link', LinkShapeProps>;
