import { useSync } from '@tldraw/sync';
import {
  Box,
  DefaultToolbar,
  DefaultToolbarContent,
  TLComponents,
  TLUiAssetUrlOverrides,
  TLUiOverrides,
  Tldraw,
  TldrawUiMenuItem,
  useEditor,
  useIsToolSelected,
  useTools,
  useValue,
} from 'tldraw';
import { multiplayerAssetStore } from './multiplayerAssetStore';
import { BrainstormTool } from '@/app/components/brainstorm-tool/BrainstormTool';
import { BrainstormDragging } from '@/app/components/brainstorm-tool/child-states/Dragging';

// Where is our worker located? Configure this in `vite.config.ts`
const API_URL = process.env.NEXT_PUBLIC_API_URL;

// In this example, the room ID is hard-coded. You can set this however you like though.
export const roomId = 'test-room';

const customTools = [BrainstormTool];

const customUiOverrides: TLUiOverrides = {
  tools: (editor, tools) => {
    return {
      ...tools,
      brainstorm: {
        id: BrainstormTool.id,
        label: 'AI Brainstorm',
        icon: 'brainstorm',
        kbd: 'b',
        onSelect() {
          editor.setCurrentTool('brainstorm');
        },
      },
    };
  },
};

function CustomToolbar() {
  const tools = useTools();
  const isAiBrainstormSelected = useIsToolSelected(tools['brainstorm']);
  return (
    <DefaultToolbar>
      <TldrawUiMenuItem
        {...tools['brainstorm']}
        isSelected={isAiBrainstormSelected}
      />
      <DefaultToolbarContent />
    </DefaultToolbar>
  );
}

// [3]
const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    brainstorm: '/ai-brainstorm.svg',
  },
};

function AiBrainstormBox() {
  const editor = useEditor();

  const brainstormBrush = useValue(
    'brainstorm brush',
    () => {
      // Check whether the brainstorm tool (and its dragging state) is active
      if (editor.getPath() !== 'brainstorm.dragging') return null;

      // Get brainstorm.dragging state node
      const draggingState = editor.getStateDescendant<BrainstormDragging>(
        'brainstorm.dragging'
      )!;

      // Get the box from the brainstorm.dragging state node
      const box = draggingState.brainstormBox.get();

      // The box is in "page space", i.e. panned and zoomed with the canvas, but we
      // want to show it in front of the canvas, so we'll need to convert it to
      // "page space", i.e. uneffected by scale, and relative to the tldraw
      // page's top left corner.
      const zoomLevel = editor.getZoomLevel();
      const { x, y } = editor.pageToViewport({ x: box.x, y: box.y });
      return new Box(x, y, box.w * zoomLevel, box.h * zoomLevel);
    },
    [editor]
  );

  if (!brainstormBrush) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        transform: `translate(${brainstormBrush.x}px, ${brainstormBrush.y}px)`,
        width: brainstormBrush.w,
        height: brainstormBrush.h,
        border: '1px solid var(--color-text-0)',
        zIndex: 999,
      }}
    />
  );
}

const customComponents: TLComponents = {
  InFrontOfTheCanvas: AiBrainstormBox,
  Toolbar: CustomToolbar,
};

export const Whiteboard = ({ roomId }: { roomId: string }) => {
  // Create a store connected to multiplayer.
  const store = useSync({
    // We need to know the websockets URI...
    uri: `${API_URL}/connect/${roomId}`,
    // ...and how to handle static assets like images & videos
    assets: multiplayerAssetStore,
  });

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        tools={customTools}
        overrides={customUiOverrides}
        assetUrls={customAssetUrls}
        components={customComponents}
        // we can pass the connected store into the Tldraw component which will handle
        // loading states & enable multiplayer UX like cursors & a presence menu
        store={store}
      />
    </div>
  );
};
