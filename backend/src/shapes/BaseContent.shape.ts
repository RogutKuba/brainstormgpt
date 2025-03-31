export type BaseContentShapeProps = {
  h: number;
  w: number;
  isLocked: boolean;
  isExpanded: boolean;
  predictions: Array<{
    text: string;
    type: 'text' | 'image' | 'web';
  }>;
  minCollapsedHeight: number;
  prevCollapsedHeight: number;
  isRoot?: boolean;
};
