import {
  BaseBoxShapeUtil,
  BoundsSnapGeometry,
  HTMLContainer,
  JsonObject,
  Rectangle2d,
  resizeBox,
  TLBaseShape,
  TLHandleDragInfo,
  TLResizeInfo,
  TLShapeId,
} from 'tldraw';
import ReactMarkdown from 'react-markdown';
import { Textarea } from '@/components/ui/textarea';
import {
  RiGlobalLine,
  RiImageLine,
  RiLock2Line,
  RiLockUnlockLine,
  RiQuestionLine,
  RiTextBlock,
} from '@remixicon/react';
import { Tooltip } from '@/components/ui/tooltip';
import { SyntheticEvent, useEffect } from 'react';
import { cx } from '@/components/ui/lib/utils';
import { useStreamMessage } from '@/query/stream.query';
import { useChat } from '@/components/chat/ChatContext';

// Define the properties specific to our RichTextShape
export type RichTextShapeProps = {
  h: number;
  w: number;
  text: string;
  isLocked: boolean;
  isExpanded: boolean;
  predictions: Array<{
    text: string;
    type: 'text' | 'image' | 'web';
  }>;
  minCollapsedHeight: number;
  prevCollapsedHeight: number;
};

// Define the shape type by extending TLBaseShape with our props
export type RichTextShape = TLBaseShape<'rich-text', RichTextShapeProps>;

export class RichTextShapeUtil extends BaseBoxShapeUtil<RichTextShape> {
  static override type = 'rich-text' as const;

  static readonly ANIMATION_DURATION = {
    animation: {
      duration: 200,
    },
  };

  override canEdit() {
    return true;
  }

  getDefaultProps(): RichTextShape['props'] {
    return {
      w: 300,
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

    const isEditing = this.editor.getEditingShapeId() === shape.id;
    const selectedIds = this.editor.getSelectedShapeIds();
    const isSelected =
      selectedIds.includes(shape.id) && selectedIds.length === 1;

    // React to selection state
    useEffect(() => {
      if (isSelected && !isExpanded && predictions.length > 0) {
        // Only expand if there are predictions to show
        this.editor.updateShape<RichTextShape>({
          id: shape.id,
          type: 'rich-text',
          props: {
            isExpanded: true,
            isLocked: true,
            prevCollapsedHeight: shape.props.h, // Store current height before expanding
          },
        });
      } else if (!isSelected && isExpanded) {
        this.editor.updateShape<RichTextShape>({
          id: shape.id,
          type: 'rich-text',
          props: { isExpanded: false },
        });
      }
    }, [isSelected, selectedIds, isExpanded, predictions.length]);

    // Expansion/collapse animation logic
    useEffect(() => {
      if (isExpanded && predictions.length > 0) {
        // Expand the shape
        this.editor.animateShape(
          {
            id: shape.id,
            type: 'rich-text',
            props: {
              h: this.calculateExpandedHeight(shape),
            },
          },
          RichTextShapeUtil.ANIMATION_DURATION
        );
      } else if (!isExpanded) {
        // Collapse the shape back to previous height
        this.editor.animateShape(
          {
            id: shape.id,
            type: 'rich-text',
            props: {
              h: shape.props.prevCollapsedHeight,
            },
          },
          RichTextShapeUtil.ANIMATION_DURATION
        );
      }
    }, [isExpanded, predictions.length]);

    const stopEventPropagation = (e: SyntheticEvent) => e.stopPropagation();

    const toggleLock = (e: SyntheticEvent) => {
      e.stopPropagation();
      this.editor.updateShape<RichTextShape>({
        id: shape.id,
        type: 'rich-text',
        props: { isLocked: !isLocked },
      });
    };

    const onPredictionClick = async (prediction: {
      text: string;
      type: 'text' | 'image' | 'web';
    }) => {
      // Get updated predictions array by filtering out the clicked prediction
      const updatedPredictions = predictions.filter(
        (p) => p.text !== prediction.text
      );

      // Create a temporary shape with updated predictions to calculate the new height
      const tempShape = {
        ...shape,
        props: {
          ...shape.props,
          predictions: updatedPredictions,
        },
      };

      // Calculate new height based on remaining predictions
      const newHeight = this.calculateExpandedHeight(tempShape);

      // Update the shape with both the new predictions array and the new height
      this.editor.updateShape<RichTextShape>({
        id: shape.id,
        type: 'rich-text',
        props: {
          predictions: updatedPredictions,
        },
      });

      // Animate to the new height
      this.editor.animateShape(
        {
          id: shape.id,
          type: 'rich-text',
          props: {
            h:
              updatedPredictions.length > 0
                ? newHeight
                : shape.props.prevCollapsedHeight,
            isExpanded: updatedPredictions.length > 0, // Auto-collapse if no predictions left
          },
        },
        RichTextShapeUtil.ANIMATION_DURATION
      );

      // Handle sending the message (commented out in original code)
      // await handleSendMessage({...});
    };

    return (
      <HTMLContainer
        className={`w-full h-full p-0 flex flex-col rounded-lg overflow-hidden bg-white shadow-lg border border-2 ${
          isLocked
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
            onClick={toggleLock}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {isLocked ? (
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

        {/* <div className='text-sm text-gray-500'>
          Current height: {shape.props.h}
          <br />
          Collapsed height: {shape.props.prevCollapsedHeight}
          <br />
          Min collapsed height: {shape.props.minCollapsedHeight}
          <br />
          Expanded height: {this.calculateExpandedHeight(shape)}
        </div> */}

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
              <div className='markdown-content prose prose-sm max-w-none text-xl mb-4'>
                <ReactMarkdown>{text}</ReactMarkdown>
              </div>

              {predictions.length > 0 && (
                <div
                  className={cx(
                    'mt-4 border-t pt-4 pointer-events-auto overflow-hidden transition-all duration-300 ease-in-out',
                    isSelected
                      ? 'max-h-[500px] opacity-100'
                      : 'max-h-0 opacity-0 border-t-0 pt-0'
                  )}
                >
                  <ul className={cx('space-y-2', !isSelected && 'hidden')}>
                    {predictions.map((item) => (
                      <li
                        key={item.text}
                        className='flex items-center gap-2 hover:bg-gray-50 p-1 rounded cursor-pointer transition-colors pointer-events-auto'
                        onClick={(e) => {
                          console.log('item', item);
                          e.stopPropagation();
                          onPredictionClick(item);
                        }}
                        onPointerDown={stopEventPropagation}
                        onTouchStart={stopEventPropagation}
                        onTouchEnd={stopEventPropagation}
                      >
                        <div className='flex items-center h-5'>
                          {item.type === 'image' ? (
                            <RiImageLine className='text-pink-500 h-5 w-5' />
                          ) : item.type === 'web' ? (
                            <RiGlobalLine className='text-yellow-500 h-5 w-5' />
                          ) : (
                            <RiQuestionLine className='text-green-500 h-5 w-5' />
                          )}
                        </div>
                        <span
                          className={`text-lg text-gray-700 pointer-events-auto`}
                        >
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
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
    // Lock the shape during translation but maintain current expansion state
    return {
      id: shape.id,
      type: 'rich-text',
      props: {
        isLocked: true,
      },
    };
  }

  onTranslateEnd(shape: RichTextShape):
    | void
    | ({
        id: TLShapeId;
        meta?: Partial<JsonObject> | undefined;
        props?: Partial<RichTextShapeProps> | undefined;
        type: 'rich-text';
      } & Partial<Omit<RichTextShape, 'props' | 'type' | 'id' | 'meta'>>) {
    // No need to change anything after translation ends
    return;
  }

  onDoubleClick(shape: RichTextShape) {
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
          prevCollapsedHeight: resized.props.h,
        },
      };
    }

    // Update prevCollapsedHeight when not expanded
    if (!shape.props.isExpanded) {
      return {
        ...resized,
        props: {
          ...resized.props,
          prevCollapsedHeight: resized.props.h,
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
    // Update prevCollapsedHeight when not expanded
    if (!current.props.isExpanded) {
      return {
        id: current.id,
        type: 'rich-text',
        props: {
          prevCollapsedHeight: current.props.h,
        },
      };
    }
    return;
  }

  private calculateExpandedHeight(shape: RichTextShape): number {
    const { minCollapsedHeight, predictions, w, prevCollapsedHeight } =
      shape.props;

    // Base padding constants
    const Y_PADDING = 24; // Padding for borders and margins
    const BASE_ROW_HEIGHT = 30; // Base height for a single line
    const FONT_SIZE = 12; // Font size in pixels
    const PREDICTION_PADDING = 8; // Padding between prediction items
    const PREDICTION_HEADER_HEIGHT = 24; // Height for the predictions section header

    // Calculate expanded height based on predictions content
    let predictionsHeight = 0;

    if (predictions.length > 0) {
      // Calculate characters per line based on width and font size
      const charsPerLine = Math.floor((w - 48) / (FONT_SIZE * 0.6)); // Account for padding and character width

      // Calculate height for each prediction based on its text length
      for (const prediction of predictions) {
        const textLength = prediction.text.length;
        const estimatedLines = Math.max(
          1,
          Math.ceil(textLength / charsPerLine)
        );
        const itemHeight = BASE_ROW_HEIGHT * estimatedLines;
        predictionsHeight += itemHeight;
      }

      // Add padding between items
      predictionsHeight += (predictions.length - 1) * PREDICTION_PADDING;

      // Add header space for predictions section
      predictionsHeight += PREDICTION_HEADER_HEIGHT;

      // Add overall padding
      predictionsHeight += Y_PADDING;

      // Use the larger of calculated height or previous collapsed height
      return Math.max(
        prevCollapsedHeight + predictionsHeight,
        minCollapsedHeight
      );
    } else {
      return prevCollapsedHeight;
    }
  }
}
