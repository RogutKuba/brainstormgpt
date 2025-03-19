import { BaseBoxShapeTool, TLClickEventInfo } from 'tldraw';

export class PredictionTool extends BaseBoxShapeTool {
  static override id = 'prediction';
  static override initial = 'idle';
  override shapeType = 'prediction';

  override onDoubleClick(info: TLClickEventInfo) {}
}
