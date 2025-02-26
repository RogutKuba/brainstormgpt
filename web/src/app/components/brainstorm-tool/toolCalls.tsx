import { Editor, useEditor } from 'tldraw';

type BrainstormResult =
  | {
      type: 'add-shape';
    }
  | {
      type: 'add-text';
      text: string;
    };
export const BrainstormToolCalls = {
  handleBrainstormResult: async (params: {
    result: BrainstormResult[];
    editor: Editor;
  }) => {
    const { result, editor } = params;

    console.log('handleBrainstormResult', result);

    for (const r of result) {
      switch (r.type) {
        case 'add-shape':
          console.log('adding shape', r);
          editor.createShape({
            type: 'geo',
            x: 0,
            y: 0,
            props: {
              geo: 'rectangle',
            },
          });
          break;
        case 'add-text':
          console.log('adding text', r.text);
          editor.createShape({
            type: 'text',
            props: {
              text: r.text,
            },
          });
          break;
      }
    }
  },
};
