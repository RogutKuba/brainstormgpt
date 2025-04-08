import { useSync } from '@tldraw/sync';
import {
  ArrowToolbarItem,
  Box,
  DefaultMainMenu,
  DefaultToolbar,
  EditSubmenu,
  EraserToolbarItem,
  ExportFileContentSubMenu,
  HandToolbarItem,
  SelectToolbarItem,
  TLComponents,
  TLUiOverrides,
  Tldraw,
  TldrawUiMenuGroup,
  TldrawUiMenuItem,
  ViewSubmenu,
  defaultShapeUtils,
  useBreakpoint,
  useEditor,
  usePassThroughWheelEvents,
  useIsToolSelected,
  useTools,
  useValue,
  useTldrawUiComponents,
  PORTRAIT_BREAKPOINT,
  TldrawUiButton,
  TLUiTranslationKey,
  TLUiEventSource,
  Editor,
  UndoRedoGroup,
  DefaultQuickActions,
} from 'tldraw';
import { multiplayerAssetStore } from './multiplayerAssetStore';
import { BrainstormTool } from '@/components/brainstorm-tool/BrainstormTool';
import { BrainstormDragging } from '@/components/brainstorm-tool/child-states/Dragging';
import { API_URL } from '@/lib/constants';
import { LinkShapeUtil } from '@/components/shape/link/LinkShape';
import { LinkTool } from '@/components/shape/link/LinkTool';
import { memo, useMemo, useRef, useState } from 'react';
import { ChatWindowPlugin } from '@/components/chat/ChatWindow';
import { handleCustomUrlPaste } from '@/components/handleUrlPaste';
import {
  RiArrowLeftLine,
  RiRefreshLine,
  RiAlertFill,
  RiMenuLine,
} from '@remixicon/react';
import { useUpdateLinkShape } from '@/query/shape.query';
import { RichTextTool } from '@/components/shape/rich-text/RichTextTool';
import { Collection } from '@/components/collection/base/CollectionProvider';
import { RichTextShapeUtil } from '@/components/shape/rich-text/RichTextShape';
import { useRouter } from 'next/navigation';
import { CollectionProvider } from '@/components/collection/base/CollectionProvider';
import { GraphLayout } from '@/components/collection/graph/useGraphLayout';
import { D3ForceGraphLayoutCollection } from '@/components/collection/graph/D3ForceGraphLayoutCollection';
import { Tooltip } from '@/components/ui/tooltip';
import { useWorkspaceStatus } from '@/query/workspace.query';
import { Button } from '@/components/ui/button';
import { TreeCollection } from '@/components/collection/tree/TreeCollection';
import { TreeHighlight } from '@/components/collection/tree/useTreeHighlight';
import { useSidebar } from '@/components/sidebar/SideBarContext';

const ALLOWED_TOOLS = ['select', 'hand', 'eraser', 'arrow'];

const collections: Collection[] = [
  D3ForceGraphLayoutCollection,
  TreeCollection,
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
        kbd: 'w',
        onSelect() {
          editor.setCurrentTool('link');
        },
      },
      'rich-text': {
        id: RichTextTool.id,
        label: 'Rich Text',
        icon: 'rich-text',
        kbd: 'r',
        onSelect() {
          editor.setCurrentTool('rich-text');
        },
      },
      lock: {
        id: 'lock',
        label: 'Lock',
        icon: 'lock',
        kbd: 'l',
        onSelect() {
          // set all shapes to locked
          const selectedShapes = editor.getSelectedShapes();
          editor.updateShapes(
            selectedShapes
              .filter((shape) => 'isLocked' in shape.props)
              .map((shape) => ({
                ...shape,
                props: {
                  isLocked: true,
                },
              }))
          );
        },
      },
      unlock: {
        id: 'unlock',
        label: 'Unlock',
        icon: 'unlock',
        kbd: 'u',
        onSelect() {
          // set all shapes to unlocked
          const selectedShapes = editor.getSelectedShapes();
          editor.updateShapes(
            selectedShapes
              .filter((shape) => 'isLocked' in shape.props)
              .map((shape) => ({
                ...shape,
                props: {
                  isLocked: false,
                },
              }))
          );
        },
      },
    };
  },
  actions(_editor, actions) {
    actions['toggle-graph-layout'] = {
      id: 'toggle-graph-layout',
      label: 'Toggle Graph Layout' as TLUiTranslationKey,
      readonlyOk: true,
      kbd: 'g',
      onSelect(_source: TLUiEventSource) {
        const event = new CustomEvent('toggleGraphLayoutEvent');
        window.dispatchEvent(event);
      },
    };
    return actions;
  },
};

function CustomToolbar() {
  const editor = useEditor();
  const tools = useTools();
  // const isAiBrainstormSelected = useIsToolSelected(tools['brainstorm']);
  const isLinkSelected = useIsToolSelected(tools['link']);
  const isRichTextSelected = useIsToolSelected(tools['rich-text']);
  // const isLockSelected = useIsToolSelected(tools['lock']);
  // const isUnlockSelected = useIsToolSelected(tools['unlock']);
  return (
    <DefaultToolbar>
      <SelectToolbarItem />
      <HandToolbarItem />
      <EraserToolbarItem />
      {/* <RectangleToolbarItem /> */}
      {/* <EllipseToolbarItem /> */}
      {/* <TldrawUiMenuItem
        {...tools['brainstorm']}
        isSelected={isAiBrainstormSelected}
        /> */}
      {/* <DefaultToolbarContent /> */}
      <TldrawUiMenuItem
        {...tools['rich-text']}
        isSelected={isRichTextSelected}
        icon='tool-text'
      />
      <TldrawUiMenuItem {...tools['link']} isSelected={isLinkSelected} />
      <ArrowToolbarItem />
      <Tooltip content='Lock selected shapes' triggerAsChild>
        <TldrawUiMenuItem {...tools['lock']} isSelected={false} />
      </Tooltip>
      <Tooltip content='Unlock selected shapes' triggerAsChild>
        <TldrawUiMenuItem {...tools['unlock']} isSelected={false} />
      </Tooltip>
    </DefaultToolbar>
  );
}

const CustomMainMenu = () => {
  const router = useRouter();

  return (
    <DefaultMainMenu>
      {/* <TldrawUiMenuGroup id='example'>
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
      </TldrawUiMenuGroup> */}
      <EditSubmenu />
      <ViewSubmenu />
      <ExportFileContentSubMenu />
      <TldrawUiMenuGroup id='exit'>
        <TldrawUiMenuItem
          id='exit'
          label='Exit workspace'
          icon='exit'
          onSelect={() => {
            router.push('/app');
          }}
        />
      </TldrawUiMenuGroup>
      {/* <ExtrasGroup /> */}
    </DefaultMainMenu>
  );
};

const customTools = [LinkTool, RichTextTool];
const customShapes = [LinkShapeUtil, RichTextShapeUtil];

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

const CustomMenuPanel = memo(function MenuPanel() {
  const breakpoint = useBreakpoint();
  const { isOpen: isSidebarOpen, toggleSidebar } = useSidebar();

  const ref = useRef<HTMLDivElement>(null);
  usePassThroughWheelEvents(ref as React.RefObject<HTMLElement>);

  const { MainMenu, QuickActions, ActionsMenu, PageMenu } =
    useTldrawUiComponents();
  const editor = useEditor();

  const showQuickActions =
    editor.options.actionShortcutsLocation === 'menu'
      ? true
      : editor.options.actionShortcutsLocation === 'toolbar'
      ? false
      : breakpoint >= PORTRAIT_BREAKPOINT.TABLET;

  // Don't render the menu panel at all if sidebar is open or if there are no menu items
  if (isSidebarOpen || (!MainMenu && !PageMenu && !showQuickActions))
    return null;

  return (
    <div ref={ref} className='tlui-menu-zone'>
      <div className='tlui-buttons__horizontal'>
        {/* {MainMenu && <MainMenu />} */}

        <TldrawUiButton
          type='normal'
          onClick={toggleSidebar}
          aria-label='Open sidebar'
        >
          <RiMenuLine className='w-[15px] h-[15px]' />
        </TldrawUiButton>
        <DefaultQuickActions>
          {showQuickActions ? <UndoRedoGroup /> : null}
        </DefaultQuickActions>
      </div>
    </div>
  );
});

function InFrontOfTheCanvas() {
  return (
    <>
      <AiBrainstormBox />
      <ChatWindowPlugin />
    </>
  );
}

const customComponents: TLComponents = {
  InFrontOfTheCanvas: () => <InFrontOfTheCanvas />,
  Toolbar: CustomToolbar,
  MainMenu: CustomMainMenu,
  PageMenu: null,
  ActionsMenu: null,
  MenuPanel: CustomMenuPanel,
  StylePanel: null,
  CursorChatBubble: null,
  Cursor: null,
  SharePanel: null,
};

const RawWhiteboard = ({ workspaceCode }: { workspaceCode: string }) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const shapeUtils = useMemo(() => [...customShapes, ...defaultShapeUtils], []);
  const { updateLinkShape } = useUpdateLinkShape();
  const { workspaceStatus } = useWorkspaceStatus();

  // Create a store connected to multiplayer.
  const store = useSync({
    shapeUtils,
    // We need to know the websockets URI...
    uri: `${API_URL}/workspace/${workspaceCode}/connect`,
    // ...and how to handle static assets like images & videos
    assets: multiplayerAssetStore,
  });

  return (
    <Tldraw
      tools={customTools}
      overrides={customUiOverrides}
      components={customComponents}
      // we can pass the connected store into the Tldraw component which will handle
      // loading states & enable multiplayer UX like cursors & a presence menu
      store={store}
      shapeUtils={customShapes}
      options={{
        createTextOnCanvasDoubleClick: false,
      }}
      onMount={(editor) => {
        // set the editor
        setEditor(editor);

        // zoom to bounds on load
        const bounds =
          editor.getSelectionPageBounds() ?? editor.getCurrentPageBounds();
        if (bounds) {
          editor.zoomToBounds(bounds, {
            targetZoom: Math.min(1, editor.getZoomLevel()),
          });
        }

        editor.registerExternalContentHandler('tldraw', (content) => {
          // only create shapes that dont have isRoot set to true
          editor.createShapes(
            content.content.shapes.filter(
              (shape) => (shape.props as any).isRoot !== true
            )
          );
        });

        // when the editor is ready, we need to register our bookmark unfurling service
        editor.registerExternalContentHandler('url', (content) =>
          handleCustomUrlPaste(editor, content, (params) => {
            // timeout for 2.5 seconds to allow the server to update the shape
            setTimeout(() => {
              updateLinkShape(params);
            }, 2500);
          })
        );

        editor.sideEffects.registerBeforeDeleteHandler('shape', (shape) => {
          console.log('before delete handler', shape);
          // @ts-ignore
          if ((shape.props as any).isRoot === true) {
            return false;
          }
          return;
        });
      }}
    >
      {editor && (
        <CollectionProvider editor={editor} collections={collections}>
          <GraphLayout />
          <TreeHighlight />
        </CollectionProvider>
      )}
    </Tldraw>
  );
};

const ErrorWhiteboard = ({ error }: { error: string }) => {
  const router = useRouter();

  return (
    <div className='min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-12'>
      <div className='max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100'>
        <div className='flex flex-col items-center text-center'>
          <div className='relative w-20 h-20'>
            <div
              className='absolute inset-0 bg-red-100 rounded-full animate-pulse'
              style={{ animationDuration: '3s' }}
            ></div>
            <RiAlertFill className='absolute inset-0 w-20 h-20 text-red-500 p-5' />
          </div>

          <h2 className='mt-2 text-2xl font-bold text-gray-900'>Error</h2>
          <p className='mt-2 text-gray-600'>
            We encountered a problem loading this workspace.
          </p>

          <div className='mt-4 p-4 bg-red-50 border border-red-100 rounded-lg text-left w-full'>
            <p className='text-sm text-red-700 font-medium'>Error details:</p>
            <p className='text-sm text-red-600 mt-1 break-words'>{error}</p>
          </div>

          <div className='mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 w-full'>
            <Button onClick={() => router.push('/')} variant='light'>
              <RiArrowLeftLine className='w-4 h-4' />
              Go Home
            </Button>

            <Button variant='light' onClick={() => window.location.reload()}>
              Try Again
              <RiRefreshLine className='w-4 h-4' />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const Whiteboard = ({ workspaceCode }: { workspaceCode: string }) => {
  const { workspaceStatus } = useWorkspaceStatus();

  if (workspaceStatus?.status === 'error') {
    return <ErrorWhiteboard error={workspaceStatus.error} />;
  }

  return <RawWhiteboard workspaceCode={workspaceCode} />;
};
