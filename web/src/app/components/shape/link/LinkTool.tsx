import { BaseBoxShapeTool, TLClickEventInfo } from 'tldraw';

export class LinkTool extends BaseBoxShapeTool {
  static override id = 'link';
  static override initial = 'idle';
  override shapeType = 'link';

  override onDoubleClick(info: TLClickEventInfo) {}
}

/*
This file contains our custom tool. The tool is a StateNode with the `id` "link".

We get a lot of functionality for free by extending the BaseBoxShapeTool. but we can
handle events in out own way by overriding methods like onDoubleClick. For an example 
of a tool with more custom functionality, check out the screenshot-tool example. 
*/
