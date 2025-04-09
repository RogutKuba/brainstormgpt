import {
  BaseBoxShapeUtil,
  HTMLContainer,
  JsonObject,
  Rectangle2d,
  resizeBox,
  TLBaseShape,
  TLResizeInfo,
  TLShapeId,
} from 'tldraw';
import ReactMarkdown from 'react-markdown';
import { Textarea } from '@/components/ui/textarea';
import { RiLock2Line, RiLockUnlockLine } from '@remixicon/react';
import { Tooltip } from '@/components/ui/tooltip';
import { useEffect } from 'react';
import { useChat } from '@/components/chat/ChatContext';
import {
  useContentShape,
  ContentShapeProps,
  calculateExpandedHeight,
  handleResizeEnd,
  handleTranslateStart,
} from '@/components/shape/BaseContentShape';
import { cx } from '@/components/ui/lib/utils';
import { useCurrentWorkspaceCode } from '@/lib/pathUtils';
import { useZoomDialog } from '@/components/zoom-dialog/ZoomDialogContext';

// Define the properties specific to our RichTextShape
export type RichTextShapeProps = ContentShapeProps & {
  title: string;
  text: string;
};

// Define the shape type by extending TLBaseShape with our props
export type RichTextShape = TLBaseShape<'rich-text', RichTextShapeProps>;

export class RichTextShapeUtil extends BaseBoxShapeUtil<RichTextShape> {
  static override type = 'rich-text' as const;

  override canEdit(_shape: RichTextShape) {
    return !_shape.props.isRoot;
  }

  getDefaultProps(): RichTextShape['props'] {
    return {
      w: 450,
      h: 250,
      title: 'Your title here',
      text: '# Your text here\n\n## Your subheading\n\nYour text here',
      isLocked: true,
      isExpanded: false,
      predictions: [],
      minCollapsedHeight: 250,
      prevCollapsedHeight: 250,
      isRoot: false,
      isHighlighted: false,
    };
  }

  getGeometry(shape: RichTextShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: RichTextShape) {
    const { title, text, isLocked, predictions, isExpanded, isHighlighted } =
      shape.props;
    const { handleSendMessage } = useChat();
    const workspaceCode = useCurrentWorkspaceCode();
    const { openRichTextZoomDialog } = useZoomDialog();

    // Get the content shape utilities
    const {
      stopEventPropagation,
      toggleLock,
      handleSelectionState,
      handleExpansionAnimation,
      handlePredictionClick,
      renderPredictionsList,
    } = useContentShape<RichTextShape>();

    const isRoot = shape.props.isRoot;
    const isEditing = this.editor.getEditingShapeId() === shape.id;
    const selectedIds = this.editor.getSelectedShapeIds();
    const isSelected =
      selectedIds.includes(shape.id) && selectedIds.length === 1;

    // React to selection state
    useEffect(() => {
      handleSelectionState(shape, isSelected);
    }, [isSelected, selectedIds, isExpanded, predictions.length]);

    // Expansion/collapse animation logic
    useEffect(() => {
      handleExpansionAnimation(
        shape,
        isExpanded,
        predictions.length,
        this.calculateShapeHeight
      );
    }, [isExpanded, predictions.length]);

    // Handle prediction click
    const onPredictionClick = async (prediction: {
      text: string;
      type: 'text' | 'image' | 'web';
    }) => {
      await handlePredictionClick(
        shape,
        prediction,
        this.calculateShapeHeight,
        handleSendMessage,
        {
          selectedItemIds: [shape.id],
          workspaceCode,
          editor: this.editor,
          searchType: prediction.type,
        }
      );
    };

    // Handle zoom dialog open
    const handleOpenZoomDialog = (e: React.MouseEvent) => {
      openRichTextZoomDialog(
        '',
        {
          type: 'rich-text',
          content: text,
          shapeId: shape.id,
        },
        predictions
      );
    };

    return (
      <HTMLContainer
        className={`w-full h-full p-0 flex flex-col rounded-lg overflow-hidden bg-white shadow-lg border border-2 transition-all duration-200 ${
          isRoot
            ? 'border-primary shadow-[0_0_0_3px_rgba(59,130,246,0.3),0_0_15px_rgba(59,130,246,0.25)]'
            : isLocked
            ? 'border-primary/30 shadow-[0_0_0_2px_rgba(59,130,246,0.2)]'
            : 'border-gray-200'
        } ${
          isHighlighted
            ? 'border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.4),0_0_30px_rgba(59,130,246,0.35)]'
            : ''
        } pointer-events-auto`}
      >
        {!isRoot ? (
          <div className='p-4 border-b border-gray-200 text-2xl font-bold'>
            {title}
          </div>
        ) : null}

        {/* Lock/Unlock button - fixed positioning */}
        <div className='absolute top-2 right-2 z-10 pointer-events-auto'>
          <div
            className={cx(
              'flex items-center justify-center transition-colors duration-200',
              !isSelected && !isLocked && 'hidden',
              isSelected && 'cursor-pointer hover:bg-gray-300 rounded-full'
            )}
            onClick={(e) => toggleLock(shape, e)}
            onPointerDown={stopEventPropagation}
          >
            {isRoot ? null : isLocked ? (
              <Tooltip content='Position locked'>
                <RiLock2Line className='text-primary/80 h-5 w-5' />
              </Tooltip>
            ) : (
              isSelected && (
                <Tooltip content='Position unlocked'>
                  <RiLockUnlockLine className='text-primary/80 h-5 w-5' />
                </Tooltip>
              )
            )}
          </div>
        </div>

        {/* Content area - increased padding */}
        <div
          style={{
            flexGrow: 1,
            position: 'relative',
          }}
          className='py-4 px-8'
        >
          {isEditing ? (
            <Textarea
              value={text}
              onChange={(e) =>
                this.editor.updateShape<RichTextShape>({
                  id: shape.id,
                  type: 'rich-text',
                  props: { text: e.currentTarget.value },
                })
              }
              onClick={stopEventPropagation}
              onPointerDown={stopEventPropagation}
              onTouchStart={stopEventPropagation}
              onTouchEnd={stopEventPropagation}
              className='w-full h-full resize-none border-none focus:ring-0 text-lg pointer-events-auto'
              autoFocus
            />
          ) : (
            <>
              {isRoot ? (
                <div className='markdown-content max-w-none text-center py-4 text-4xl font-bold cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto'>
                  {text}
                </div>
              ) : (
                <div
                  className='markdown-content prose prose-sm max-w-none text-xl mb-4 cursor-pointer hover:opacity-80 transition-opacity pointer-events-auto'
                  onPointerDown={handleOpenZoomDialog}
                >
                  <ReactMarkdown>{text}</ReactMarkdown>
                </div>
              )}

              {renderPredictionsList(predictions, true, onPredictionClick)}
            </>
          )}
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: RichTextShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />;
  }

  onTranslateStart(shape: RichTextShape):
    | void
    | ({
        id: TLShapeId;
        meta?: Partial<JsonObject> | undefined;
        props?: Partial<RichTextShapeProps> | undefined;
        type: 'rich-text';
      } & Partial<Omit<RichTextShape, 'props' | 'type' | 'id' | 'meta'>>) {
    // Use the standalone function instead of the hook
    const result = handleTranslateStart(shape);
    if (result) {
      return {
        id: shape.id,
        type: 'rich-text',
        props: result.props,
      };
    }
    return;
  }

  onTranslate(initial: RichTextShape, current: RichTextShape) {
    if (initial.props.isRoot) {
      return initial;
    }
    return current;
  }

  onDoubleClick(shape: RichTextShape) {
    if (shape.props.isRoot) {
      return;
    }

    this.editor.setEditingShape(shape.id);
  }

  override onResize(shape: RichTextShape, info: TLResizeInfo<RichTextShape>) {
    const resized = resizeBox(shape, info);

    // Update minCollapsedHeight if the user resizes to a smaller height
    if (resized.props.h < shape.props.minCollapsedHeight) {
      return {
        ...resized,
        props: {
          ...resized.props,
          minCollapsedHeight: resized.props.h,
        },
      };
    }

    return resized;
  }

  override onResizeEnd(
    initial: RichTextShape,
    current: RichTextShape
  ):
    | void
    | ({
        id: TLShapeId;
        meta?: Partial<JsonObject> | undefined;
        props?: Partial<RichTextShapeProps> | undefined;
        type: 'rich-text';
      } & Partial<Omit<RichTextShape, 'props' | 'type' | 'id' | 'meta'>>) {
    // Use the standalone function instead of the hook
    const result = handleResizeEnd(current, this.calculateShapeHeight);

    if (result) {
      return {
        id: current.id,
        type: 'rich-text',
        props: result.props,
      };
    }

    return;
  }

  // Static method to calculate height that doesn't depend on the editor
  calculateShapeHeight = (shape: RichTextShape): number => {
    // Use the extracted utility function
    return calculateExpandedHeight(shape);
  };
}
