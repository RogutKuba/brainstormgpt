import { cn } from '@/components/ui/lib/utils';
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  resizeBox,
  TLBaseShape,
  TLResizeInfo,
  TLShapeId,
} from 'tldraw';
import { RiCheckLine, RiCloseLine } from '@remixicon/react';
import { useChat } from '@/components/chat/ChatContext';

// Define the properties specific to our PredictionShape
export type PredictionShapeProps = {
  h: number;
  w: number;
  text: string;
  parentId: TLShapeId | null;
  arrowId: TLShapeId | null;
};

// Define the shape type by extending TLBaseShape with our props
export type PredictionShape = TLBaseShape<'prediction', PredictionShapeProps>;

export class PredictionShapeUtil extends BaseBoxShapeUtil<PredictionShape> {
  static override type = 'prediction' as const;

  getDefaultProps(): PredictionShape['props'] {
    return {
      w: 300,
      h: 300,
      text: 'Prediction',
      parentId: null,
      arrowId: null,
    };
  }

  getGeometry(shape: PredictionShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: PredictionShape) {
    const { text, parentId } = shape.props;
    const { handleSendMessage } = useChat();

    const selectedIds = this.editor.getSelectedShapeIds();

    const isSelected =
      selectedIds.includes(shape.id) && selectedIds.length === 1;

    const shouldHighlight = selectedIds.some(
      (id) => id === shape.id || id === parentId
    );

    const handleConfirm = async () => {
      await handleSendMessage({
        message: text,
        selectedItemIds: parentId ? [parentId] : [],
      });

      // handle reject will just delete the shape and arrow
      handleReject();
    };

    const handleReject = () => {
      if (shape.props.arrowId) {
        this.editor.deleteShapes([shape.id, shape.props.arrowId]);
      } else {
        this.editor.deleteShapes([shape.id]);
      }
    };

    const stopEventPropagation = (e: React.SyntheticEvent) =>
      e.stopPropagation();

    return (
      <HTMLContainer
        className={cn(
          'w-full h-full flex flex-col rounded-lg overflow-hidden pointer-events-all',
          shouldHighlight ? 'opacity-100' : 'opacity-70'
        )}
      >
        {/* Main container with dashed border and subtle gradient */}
        <div
          className={`w-full h-full flex flex-col items-center justify-center p-4 rounded-lg border-4 border-dashed bg-gradient-to-br from-primary/10 to-primary/20 backdrop-blur-sm relative`}
        >
          <div className='text-center text-xl font-medium text-primary'>
            {text}
          </div>

          {isSelected && (
            <div className='absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-3 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md'>
              <button
                className='pointer-events-auto cursor-pointer p-1.5 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-all duration-200 flex items-center justify-center'
                onClick={handleReject}
                onPointerDown={stopEventPropagation}
                onTouchStart={stopEventPropagation}
                onTouchEnd={stopEventPropagation}
              >
                <RiCloseLine className='w-5 h-5' />
              </button>
              <button
                className='pointer-events-auto cursor-pointer p-1.5 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-all duration-200 flex items-center justify-center'
                onClick={handleConfirm}
                onPointerDown={stopEventPropagation}
                onTouchStart={stopEventPropagation}
                onTouchEnd={stopEventPropagation}
              >
                <RiCheckLine className='w-5 h-5' />
              </button>
            </div>
          )}
        </div>

        {/* Subtle decorative elements */}
        <div className='absolute -z-10 inset-0 bg-white/10 backdrop-blur-[1px] rounded-lg'></div>
      </HTMLContainer>
    );
  }

  indicator(shape: PredictionShape) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={8}
        ry={8}
        style={{
          strokeDasharray: '4,3',
          strokeWidth: 2.5,
          stroke: 'hsl(var(--primary))',
        }}
      />
    );
  }

  override onResize(
    shape: PredictionShape,
    info: TLResizeInfo<PredictionShape>
  ) {
    return resizeBox(shape, info);
  }
}
