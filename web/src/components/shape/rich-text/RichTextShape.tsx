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
  RiTextBlock,
} from '@remixicon/react';
import { Tooltip } from '@/components/ui/tooltip';
import React from 'react';

// Define the properties specific to our RichTextShape
export type RichTextShapeProps = {
  h: number;
  w: number;
  text: string;
  isLocked: boolean;
  isExpanded: boolean;
  checklistItems: Array<{
    id: string;
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
      h: 200,
      text: '# Hello World\n\nThis is a markdown text. You can use **bold**, *italic*, and more.',
      isLocked: true,
      isExpanded: false,
      checklistItems: [
        { id: '1', text: 'Lorem ipsum dolor sit amet', type: 'text' },
        { id: '2', text: 'Consectetur adipiscing elit', type: 'image' },
        { id: '3', text: 'Sed do eiusmod tempor incididunt', type: 'web' },
      ],
      minCollapsedHeight: 200,
      prevCollapsedHeight: 200,
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
    const { text, isLocked, checklistItems } = shape.props;

    const isEditing = this.editor.getEditingShapeId() === shape.id;
    const selectedIds = this.editor.getSelectedShapeIds();
    const isSelected =
      selectedIds.includes(shape.id) && selectedIds.length === 1;

    // Fixed expansion/collapse logic
    React.useEffect(() => {
      // Only trigger animation when selection state changes
      if (isSelected && !shape.props.isExpanded && checklistItems.length > 0) {
        // Expand when selected
        this.editor.animateShape(
          {
            id: shape.id,
            type: 'rich-text',
            props: {
              h: this.calculateExpandedHeight(shape),
              prevCollapsedHeight: shape.props.h,
              isExpanded: true,
            },
          },
          RichTextShapeUtil.ANIMATION_DURATION
        );
      } else if (!isSelected && shape.props.isExpanded) {
        // Collapse when deselected
        this.editor.animateShape(
          {
            id: shape.id,
            type: 'rich-text',
            props: {
              h: shape.props.prevCollapsedHeight,
              isExpanded: false,
            },
          },
          RichTextShapeUtil.ANIMATION_DURATION
        );
      }
    }, [isSelected]);

    const stopEventPropagation = (e: React.SyntheticEvent) =>
      e.stopPropagation();

    const toggleLock = (e: React.MouseEvent) => {
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
            className={`flex items-center justify-center ${
              !isSelected && !isLocked && 'hidden'
            } ${isSelected && 'cursor-pointer hover:bg-gray-100 rounded-full'}`}
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
            overflow: 'auto',
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

              {/* Checklist section with animation */}
              {checklistItems.length > 0 && (
                <div
                  className={`mt-4 border-t pt-4 pointer-events-auto overflow-hidden transition-all duration-300 ease-in-out ${
                    isSelected
                      ? 'max-h-[500px] opacity-100'
                      : 'max-h-0 opacity-0 border-t-0 pt-0'
                  }`}
                >
                  <ul className={`space-y-2 ${!isSelected && 'hidden'}`}>
                    {checklistItems.map((item) => (
                      <li
                        key={item.id}
                        className='flex items-start gap-2 hover:bg-gray-50 p-1 rounded cursor-pointer transition-colors'
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <div className='flex items-center h-5 mt-0.5'>
                          {item.type === 'image' ? (
                            <RiImageLine className='text-gray-500 h-4 w-4' />
                          ) : item.type === 'web' ? (
                            <RiGlobalLine className='text-gray-500 h-4 w-4' />
                          ) : (
                            <RiTextBlock className='text-gray-500 h-4 w-4' />
                          )}
                        </div>
                        <span className={`text-sm text-gray-700`}>
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
    return {
      id: shape.id,
      type: 'rich-text',
      props: { isLocked: true },
    };
  }

  onDoubleClick(shape: RichTextShape) {
    this.editor.setEditingShape(shape.id);
  }

  override onHandleDrag(
    shape: RichTextShape,
    info: TLHandleDragInfo<RichTextShape>
  ):
    | void
    | ({
        id: TLShapeId;
        meta?: Partial<JsonObject> | undefined;
        props?: Partial<RichTextShapeProps> | undefined;
        type: 'rich-text';
      } & Partial<Omit<RichTextShape, 'props' | 'type' | 'id' | 'meta'>>) {
    return {
      id: shape.id,
      type: 'rich-text',
      props: {
        isLocked: true,
      },
    };
  }

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
    const { minCollapsedHeight, checklistItems } = shape.props;

    // Adjusted constants for better spacing
    const Y_PADDING = 48; // Increased padding to account for borders and margins
    const ROW_HEIGHT = 32; // Adjusted for more accurate row height

    // Calculate expanded height based on number of checklist items
    const checklistHeight = checklistItems.length * ROW_HEIGHT + Y_PADDING;

    return Math.max(
      minCollapsedHeight + checklistHeight,
      shape.props.prevCollapsedHeight
    );
  }
}
