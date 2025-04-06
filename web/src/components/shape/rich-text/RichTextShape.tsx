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

// Define the properties specific to our RichTextShape
export type RichTextShapeProps = ContentShapeProps & {
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
      text: '# JavaScript Promises\n\nPromises are objects representing the eventual completion or failure of an asynchronous operation.',
      isLocked: true,
      isExpanded: false,
      predictions: [
        {
          text: 'How do Promises compare to async/await syntax?',
          type: 'text',
        },
        {
          text: 'Can you show a flowchart of Promise resolution states?',
          type: 'image',
        },
        {
          text: 'What are the latest Promise features in modern browsers?',
          type: 'web',
        },
        {
          text: 'How can Promises be used for better error handling?',
          type: 'text',
        },
        {
          text: 'What performance considerations exist when using Promises?',
          type: 'web',
        },
      ],
      minCollapsedHeight: 250,
      prevCollapsedHeight: 250,
      isRoot: true,
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
    const { text, isLocked, predictions, isExpanded } = shape.props;
    const { handleSendMessage } = useChat();
    const workspaceCode = useCurrentWorkspaceCode();

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

    return (
      <HTMLContainer
        className={`w-full h-full p-0 flex flex-col rounded-lg overflow-hidden bg-white shadow-lg border border-2 ${
          isRoot
            ? 'border-primary shadow-[0_0_0_3px_rgba(59,130,246,0.3),0_0_15px_rgba(59,130,246,0.25)]'
            : isLocked
            ? 'border-primary/30 shadow-[0_0_0_2px_rgba(59,130,246,0.2)]'
            : 'border-gray-200'
        } pointer-events-auto`}
      >
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
            padding: '24px', // Increased padding from 16px to 24px
            position: 'relative',
          }}
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
                <div className='markdown-content max-w-none text-center py-4 text-4xl font-bold'>
                  {text}
                </div>
              ) : (
                <div className='markdown-content prose prose-sm max-w-none text-xl mb-4'>
                  <ReactMarkdown>{text}</ReactMarkdown>
                </div>
              )}

              {renderPredictionsList(
                predictions,
                isSelected,
                onPredictionClick
              )}
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

  onTranslate(
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
