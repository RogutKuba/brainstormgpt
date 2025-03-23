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
import { RiLock2Line, RiLockUnlockLine } from '@remixicon/react';
import { Tooltip } from '@/components/ui/tooltip';

// Define the properties specific to our RichTextShape
export type RichTextShapeProps = {
  h: number;
  w: number;
  text: string;
  isLocked: boolean;
};

// Define the shape type by extending TLBaseShape with our props
export type RichTextShape = TLBaseShape<'rich-text', RichTextShapeProps>;

export class RichTextShapeUtil extends BaseBoxShapeUtil<RichTextShape> {
  static override type = 'rich-text' as const;

  override canEdit() {
    return true;
  }

  getDefaultProps(): RichTextShape['props'] {
    return {
      w: 300,
      h: 200,
      text: '# Hello World\n\nThis is a markdown text. You can use **bold**, *italic*, and more.',
      isLocked: true,
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
    const { text, isLocked } = shape.props;

    const isEditing = this.editor.getEditingShapeId() === shape.id;
    const selectedIds = this.editor.getSelectedShapeIds();
    const isSelected =
      selectedIds.includes(shape.id) && selectedIds.length === 1;

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
        } pointer-events-all`}
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
              className='w-full h-full resize-none border-none focus:ring-0 text-lg'
              autoFocus
            />
          ) : (
            <div className='markdown-content prose prose-sm max-w-none text-xl'>
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>
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
    return resizeBox(shape, info);
  }
}
