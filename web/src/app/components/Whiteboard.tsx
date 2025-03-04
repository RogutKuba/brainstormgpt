import { useSync } from '@tldraw/sync';
import {
  ArrowToolbarItem,
  Box,
  CloudToolbarItem,
  DefaultMainMenu,
  DefaultMainMenuContent,
  DefaultToolbar,
  DefaultToolbarContent,
  EditSubmenu,
  EllipseToolbarItem,
  EraserToolbarItem,
  ExportFileContentSubMenu,
  ExtrasGroup,
  HandToolbarItem,
  OvalToolbarItem,
  RectangleToolbarItem,
  SelectToolbarItem,
  TLComponents,
  TLUiAssetUrlOverrides,
  TLUiOverrides,
  Tldraw,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  ViewSubmenu,
  defaultShapeUtils,
  useDialogs,
  useEditor,
  useIsToolSelected,
  useTools,
  useValue,
} from 'tldraw';
import { multiplayerAssetStore } from './multiplayerAssetStore';
import { BrainstormTool } from '@/app/components/brainstorm-tool/BrainstormTool';
import { BrainstormDragging } from '@/app/components/brainstorm-tool/child-states/Dragging';
import { SystemGoalDialog } from '@/app/components/SystemGoalDialog';
import { API_URL } from '@/lib/constants';
import { LinkShapeUtil } from '@/app/components/shape/link/LinkShape';
import { LinkTool } from '@/app/components/shape/link/LinkTool';
import { useMemo } from 'react';

const ALLOWED_TOOLS = [
  'select',
  'hand',
  'eraser',
  'rectangle',
  'ellipse',
  'arrow',
];

const customUiOverrides: TLUiOverrides = {
  tools: (editor, tools) => {
    return {
      // ...tools,
      ...Object.fromEntries(
        Object.entries(tools).filter(([key]) => ALLOWED_TOOLS.includes(key))
      ),
      brainstorm: {
        id: BrainstormTool.id,
        label: 'AI Brainstorm',
        icon: 'brainstorm',
        kbd: 'b',
        onSelect() {
          editor.setCurrentTool('brainstorm');
        },
      },
      link: {
        id: LinkTool.id,
        label: 'Link',
        icon: 'link',
        kbd: 'l',
        onSelect() {
          editor.setCurrentTool('link');
        },
      },
    };
  },
};

function CustomToolbar() {
  const tools = useTools();
  const isAiBrainstormSelected = useIsToolSelected(tools['brainstorm']);
  // const isLinkSelected = useIsToolSelected(tools['link']);

  return (
    <DefaultToolbar>
      <SelectToolbarItem />
      <HandToolbarItem />
      <EraserToolbarItem />
      <ArrowToolbarItem />
      <RectangleToolbarItem />
      <EllipseToolbarItem />
      <TldrawUiMenuItem
        {...tools['brainstorm']}
        isSelected={isAiBrainstormSelected}
      />
      {/* <DefaultToolbarContent /> */}
      {/* <TldrawUiMenuItem {...tools['link']} isSelected={isLinkSelected} /> */}
    </DefaultToolbar>
  );
}

const CustomMainMenu = () => {
  const { addDialog } = useDialogs();

  return (
    <DefaultMainMenu>
      <TldrawUiMenuGroup id='example'>
        <TldrawUiMenuItem
          id='system-goal'
          label='Edit Workspace Goal'
          icon='external-link'
          readonlyOk
          onSelect={() => {
            addDialog({
              component: SystemGoalDialog,
              onClose() {
                void null;
              },
            });
          }}
        />
      </TldrawUiMenuGroup>
      <EditSubmenu />
      <ViewSubmenu />
      <ExportFileContentSubMenu />
      {/* <ExtrasGroup /> */}
    </DefaultMainMenu>
  );
};

// [3]
const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    brainstorm: '/ai-brainstorm.svg',
  },
};

const customTools = [BrainstormTool, LinkTool];
const customShapes = [LinkShapeUtil];

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
  MainMenu: CustomMainMenu,
  PageMenu: null,
  // MenuPanel: null,
  // QuickActions: null,
};

export const Whiteboard = ({ workspaceId }: { workspaceId: string }) => {
  const shapeUtils = useMemo(() => [...customShapes, ...defaultShapeUtils], []);

  // Create a store connected to multiplayer.
  const store = useSync({
    shapeUtils,
    // We need to know the websockets URI...
    uri: `${API_URL}/connect/${workspaceId}`,
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
        shapeUtils={customShapes}
      />
    </div>
  );
};
