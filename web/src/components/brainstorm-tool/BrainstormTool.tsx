import { StateNode } from 'tldraw';
import { BrainstormDragging } from './child-states/Dragging';
import { BrainstormIdle } from './child-states/Idle';
import { BrainstormPointing } from './child-states/Pointing';

// There's a guide at the bottom of this file!

export class BrainstormTool extends StateNode {
  // [1]
  static override id = 'brainstorm';
  static override initial = 'idle';
  static override children() {
    return [BrainstormIdle, BrainstormPointing, BrainstormDragging];
  }

  // [2]
  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 });
  }

  override onExit() {
    this.editor.setCursor({ type: 'default', rotation: 0 });
  }

  // [3]
  override onInterrupt() {
    this.complete();
  }

  override onCancel() {
    this.complete();
  }

  private complete() {
    this.parent.transition('select', {});
  }
}

/*
This file contains our screenshot tool. The tool is a StateNode with the `id` "screenshot".

[1]
It has three child state nodes, ScreenshotIdle, ScreenshotPointing, and ScreenshotDragging. 
Its initial state is `idle`.

[2]
When the screenshot tool is entered, we set the cursor to a crosshair. When it is exited, we
set the cursor back to the default cursor. 

[3]
When the screenshot tool is interrupted or cancelled, we transition back to the select tool.
*/
