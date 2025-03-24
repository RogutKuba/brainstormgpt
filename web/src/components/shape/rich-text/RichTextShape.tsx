import {
  BaseBoxShapeUtil,
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

    const isEditing = this.editor.getEditingShapeId() === shape.id;
    const selectedIds = this.editor.getSelectedShapeIds();
    const isSelected =
      selectedIds.includes(shape.id) && selectedIds.length === 1;

    // make useEffect to react to selection state
    useEffect(() => {
      if (isSelected && selectedIds.length === 1) {
        this.editor.updateShape<RichTextShape>({
          id: shape.id,
          type: 'rich-text',
          props: { isExpanded: true },
        });
      } else if (!isSelected) {
        this.editor.updateShape<RichTextShape>({
          id: shape.id,
          type: 'rich-text',
          props: { isExpanded: false },
        });
      }
    }, [isSelected, selectedIds]);

    // Expansion/collapse logic based on isExpanded state
    useEffect(() => {
      if (isExpanded && predictions.length > 0) {
        // Expand the shape
        this.editor.animateShape(
          {
            id: shape.id,
            type: 'rich-text',
            props: {
              h: this.calculateExpandedHeight(shape),
              prevCollapsedHeight: shape.props.h,
            },
          },
          RichTextShapeUtil.ANIMATION_DURATION
        );
      } else if (!isExpanded) {
        // Collapse the shape
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
                        className='flex items-center gap-2 hover:bg-gray-50 p-1 rounded cursor-pointer transition-colors'
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
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
                        <span className={`text-lg text-gray-700`}>
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
    // Only lock the shape and set isExpanded to false
    // Don't modify the height directly to avoid interrupting animations
    return {
      id: shape.id,
      type: 'rich-text',
      props: {
        isLocked: true,
        isExpanded: true,
        h: this.calculateExpandedHeight(shape),
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
    // animate shape open
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
    return {
      id: shape.id,
      type: 'rich-text',
      props: {
        // prevCollapsedHeight: shape.props.h,
        isExpanded: true,
        // Don't set isExpanded: true here to avoid immediate re-expansion
      },
    };
  }

  onDoubleClick(shape: RichTextShape) {
    this.editor.setEditingShape(shape.id);
  }

  // override onHandleDrag(
  //   shape: RichTextShape,
  //   info: TLHandleDragInfo<RichTextShape>
  // ):
  //   | void
  //   | ({
  //       id: TLShapeId;
  //       meta?: Partial<JsonObject> | undefined;
  //       props?: Partial<RichTextShapeProps> | undefined;
  //       type: 'rich-text';
  //     } & Partial<Omit<RichTextShape, 'props' | 'type' | 'id' | 'meta'>>) {
  //   return {
  //     id: shape.id,
  //     type: 'rich-text',
  //     props: {
  //       isLocked: true,
  //     },
  //   };
  // }

  override onResize(shape: RichTextShape, info: TLResizeInfo<RichTextShape>) {
    const resized = resizeBox(shape, info);

    // Update prevCollapsedHeight when resizing while expanded
    if (shape.props.isExpanded) {
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

  private calculateExpandedHeight(shape: RichTextShape): number {
    const { minCollapsedHeight, predictions } = shape.props;

    // Adjusted constants for better spacing
    const Y_PADDING = 48; // Increased padding to account for borders and margins
    const ROW_HEIGHT = 40; // Adjusted for more accurate row height

    // Calculate expanded height based on number of checklist items
    const predictionsHeight = predictions.length * ROW_HEIGHT + Y_PADDING;

    // we want the height to only ever be as tall as it needs to be.
    // if prev collapsed is greater than min collapsed, then use prev collapsed.
    const minHeight = minCollapsedHeight + predictionsHeight;

    return Math.max(minHeight, shape.props.prevCollapsedHeight);
  }
}
