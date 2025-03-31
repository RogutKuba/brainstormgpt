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
} from 'tldraw';
import { multiplayerAssetStore } from './multiplayerAssetStore';
import { BrainstormTool } from '@/components/brainstorm-tool/BrainstormTool';
import { BrainstormDragging } from '@/components/brainstorm-tool/child-states/Dragging';
import { API_URL } from '@/lib/constants';
import { LinkShapeUtil } from '@/components/shape/link/LinkShape';
import { LinkTool } from '@/components/shape/link/LinkTool';
import { memo, useMemo, useRef, useState, useEffect } from 'react';
import { ChatWindowPlugin } from '@/components/chat/ChatWindow';
import { handleCustomUrlPaste } from '@/components/handleUrlPaste';
import { RiShare2Line } from '@remixicon/react';
import { useUpdateLinkShape } from '@/query/shape.query';
import { RichTextTool } from '@/components/shape/rich-text/RichTextTool';
import { Collection } from '@/components/collection/base/CollectionProvider';
import { RichTextShapeUtil } from '@/components/shape/rich-text/RichTextShape';
import { useRouter } from 'next/navigation';
import { CollectionProvider } from '@/components/collection/base/CollectionProvider';
import { GraphLayout } from '@/components/collection/graph/useGraphLayout';
import { D3ForceGraphLayoutCollection } from '@/components/collection/graph/D3ForceGraphLayoutCollection';
import { toast } from 'sonner';
import { Tooltip } from '@/components/ui/tooltip';
const ALLOWED_TOOLS = ['select', 'hand', 'eraser', 'arrow'];

const collections: Collection[] = [D3ForceGraphLayoutCollection];
// const collections: Collection[] = [ConstraintGraphLayoutCollection];

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

  if (!MainMenu && !PageMenu && !showQuickActions) return null;

  return (
    <div ref={ref} className='tlui-menu-zone'>
      <div className='tlui-buttons__horizontal'>
        {MainMenu && <MainMenu />}
        {showQuickActions ? (
          <>
            {QuickActions && <QuickActions />}
            {ActionsMenu && <ActionsMenu />}
          </>
        ) : null}

        <TldrawUiButton
          type='normal'
          onClick={() => {
            // copy current page url
            const url = window.location.href;
            navigator.clipboard.writeText(url);

            toast.success('Link copied to clipboard. Share it with your team!');
          }}
        >
          <RiShare2Line className='w-[15px] h-[15px]' />
        </TldrawUiButton>
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
};

export const Whiteboard = ({ workspaceId }: { workspaceId: string }) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const shapeUtils = useMemo(() => [...customShapes, ...defaultShapeUtils], []);
  const { updateLinkShape } = useUpdateLinkShape();

  // Create a store connected to multiplayer.
  const store = useSync({
    shapeUtils,
    // We need to know the websockets URI...
    uri: `${API_URL}/connect/${workspaceId}`,
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
        </CollectionProvider>
      )}
    </Tldraw>
  );
};
