import { TLBaseShape } from 'tldraw';
import { BaseContentShapeProps } from './BaseContent.shape';
type RichTextShapeProps = {
  text: string;
} & BaseContentShapeProps;

export type RichTextShape = TLBaseShape<'rich-text', RichTextShapeProps>;
