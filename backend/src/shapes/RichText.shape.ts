import { TLBaseShape } from 'tldraw';

type RichTextShapeProps = {
  h: number;
  w: number;
  text: string;
};

export type RichTextShape = TLBaseShape<'rich-text', RichTextShapeProps>;
