import { TLBaseShape } from 'tldraw';
import { BaseContentShapeProps } from './BaseContent.shape';

type RichTextShapeProps = {
  title: string;
  text: string;
} & BaseContentShapeProps;

export type RichTextShape = TLBaseShape<'rich-text', RichTextShapeProps>;
