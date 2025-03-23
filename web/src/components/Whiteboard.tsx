import { useSync } from '@tldraw/sync';
import {
  ArrowToolbarItem,
  Box,
  CloudToolbarItem,
  DefaultMainMenu,
  DefaultMainMenuContent,
  DefaultMenuPanel,
  DefaultQuickActions,
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
  useBreakpoint,
  useDialogs,
  useEditor,
  usePassThroughWheelEvents,
  useIsToolSelected,
  useTools,
  useValue,
  useTldrawUiComponents,
  PORTRAIT_BREAKPOINT,
  TldrawUiButtonIcon,
  TldrawUiButton,
  DefaultQuickActionsContent,
  TldrawUiMenuActionItem,
  useToasts,
  TLBookmarkAsset,
  getHashForString,
  AssetRecordType,
  TLAsset,
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
import { memo, useMemo, useRef, useState } from 'react';
import { SystemGoalDialog } from '@/components/SystemGoalDialog';
import { ChatWindowPlugin } from '@/components/chat/ChatWindow';
import { handleCustomUrlPaste } from '@/components/handleUrlPaste';
import { RiShare2Fill, RiShare2Line } from '@remixicon/react';
import { useUpdateLinkShape } from '@/query/shape.query';
import { RichTextTool } from '@/components/shape/rich-text/RichTextTool';
import { Collection } from '@/components/collection/base/CollectionProvider';
import { RichTextShapeUtil } from '@/components/shape/rich-text/RichTextShape';
import { useRouter } from 'next/navigation';
import { CollectionProvider } from '@/components/collection/base/CollectionProvider';
import { GraphLayoutCollection } from '@/components/collection/graph/GraphLayoutCollection';
import { GraphLayout } from '@/components/collection/graph/useGraphLayout';
import { PredictionTool } from '@/components/shape/prediction/PredictionTool';
import { PredictionShapeUtil } from '@/components/shape/prediction/PredictionShape';
import { ConstraintGraphLayoutCollection } from '@/components/collection/graph/constraintGraphLayoutCollection';
const ALLOWED_TOOLS = ['select', 'hand', 'eraser', 'arrow'];

const collections: Collection[] = [GraphLayoutCollection];
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
        kbd: 'l',
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
      prediction: {
        id: PredictionTool.id,
        label: 'Prediction',
        icon: 'prediction',
        kbd: 'p',
        onSelect() {
          editor.setCurrentTool('prediction');
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
  const tools = useTools();
  // const isAiBrainstormSelected = useIsToolSelected(tools['brainstorm']);
  const isLinkSelected = useIsToolSelected(tools['link']);
  const isRichTextSelected = useIsToolSelected(tools['rich-text']);
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
    </DefaultToolbar>
  );
}

const CustomMainMenu = () => {
  const { addDialog } = useDialogs();

  const router = useRouter();

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

const customTools = [LinkTool, RichTextTool, PredictionTool];
const customShapes = [LinkShapeUtil, RichTextShapeUtil, PredictionShapeUtil];

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
  const { addToast } = useToasts();

  const editor = useEditor();
  const isSinglePageMode = useValue(
    'isSinglePageMode',
    () => editor.options.maxPages <= 1,
    [editor]
  );

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
        {PageMenu && !isSinglePageMode && <PageMenu />}
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

            addToast({
              title: 'Copied to clipboard',
              description: 'Share this link with your team',
              severity: 'success',
            });
          }}
        >
          <RiShare2Line className='w-5 h-5' />
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

        // when the editor is ready, we need to register our bookmark unfurling service
        editor.registerExternalContentHandler('url', (content) =>
          handleCustomUrlPaste(editor, content, (params) => {
            // timeout for 2.5 seconds to allow the server to update the shape
            setTimeout(() => {
              updateLinkShape(params);
            }, 2500);
          })
        );
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
