import { TLBaseShape, TLShapeId } from 'tldraw';

type PredictionShapeProps = {
  h: number;
  w: number;
  text: string;
  parentId: TLShapeId | null;
  arrowId: TLShapeId | null;
};

export type PredictionShape = TLBaseShape<'prediction', PredictionShapeProps>;
