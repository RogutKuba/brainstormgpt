import { BrainstormToolCalls } from '@/app/components/brainstorm-tool/toolCalls';
import { roomId } from '@/app/components/Whiteboard';
import { Box, StateNode, atom, copyAs, exportAs } from 'tldraw';

// There's a guide at the bottom of this file!

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is not set');
}

export class BrainstormDragging extends StateNode {
  static override id = 'dragging';

  // [1]
  brainstormBox = atom('brainstorm brush', new Box());

  // [2]
  override onEnter() {
    this.update();
  }

  override onPointerMove() {
    this.update();
  }

  override onKeyDown() {
    this.update();
  }

  override onKeyUp() {
    this.update();
  }

  private update() {
    const {
      inputs: { shiftKey, altKey, originPagePoint, currentPagePoint },
    } = this.editor;

    const box = Box.FromPoints([originPagePoint, currentPagePoint]);

    if (shiftKey) {
      if (box.w > box.h * (16 / 9)) {
        box.h = box.w * (9 / 16);
      } else {
        box.w = box.h * (16 / 9);
      }

      if (currentPagePoint.x < originPagePoint.x) {
        box.x = originPagePoint.x - box.w;
      }

      if (currentPagePoint.y < originPagePoint.y) {
        box.y = originPagePoint.y - box.h;
      }
    }

    if (altKey) {
      box.w *= 2;
      box.h *= 2;
      box.x = originPagePoint.x - box.w / 2;
      box.y = originPagePoint.y - box.h / 2;
    }

    this.brainstormBox.set(box);
  }

  // [3]
  override onPointerUp() {
    const { editor } = this;
    const box = this.brainstormBox.get();

    // get all shapes contained by or intersecting the box
    const shapes = editor.getCurrentPageShapes().filter((s) => {
      const pageBounds = editor.getShapeMaskedPageBounds(s);
      if (!pageBounds) return false;
      return box.includes(pageBounds);
    });
    // make the editor have all the shapes selected
    editor.setSelectedShapes(shapes.map((s) => s.id));

    // get prompt from user
    console.log('getting prompt', shapes);
    const text = prompt('Enter a prompt');

    // send prompt to backend
    const url = `${API_URL}/brainstorm/${roomId}`;

    (async () => {
      console.log('sending prompt', text, shapes);
      try {
        const response = await fetch(url, {
          method: 'POST',
          body: JSON.stringify({ prompt: text, shapes }),
        });
        const data = await response.json();
        console.log('brainstorm result', data);

        // handle the result
        BrainstormToolCalls.handleBrainstormResult({
          result: data,
          editor: this.editor,
        });
      } catch (error) {
        console.error('Error during brainstorming:', error);
      }
    })();

    this.editor.setCurrentTool('select');
  }

  // [4]
  override onCancel() {
    this.editor.setCurrentTool('select');
  }
}

/*
[1] 
This state has a reactive property (an Atom) called "screenshotBox". This is the box
that the user is drawing on the screen as they drag their pointer. We use an Atom here
so that our UI can subscribe to this property using `useValue` (see the ScreenshotBox
component in ScreenshotToolExample).

[2]
When the user enters this state, or when they move their pointer, we update the 
screenshotBox property to be drawn between the place where the user started pointing
and the place where their pointer is now. If the user is holding Shift, then we modify
the dimensions of this box so that it is in a 16:9 aspect ratio.

[3]
When the user makes a pointer up and stops dragging, we export the shapes contained by
the screenshot box as a png. If the user is holding the ctrl key, we copy the shapes
to the clipboard instead.

[4]
When the user cancels (esc key) or makes a pointer up event, we transition back to the
select tool.
*/
