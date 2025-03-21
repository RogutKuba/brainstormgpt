import { cn } from '@/components/ui/lib/utils';
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  resizeBox,
  TLBaseShape,
  TLResizeInfo,
  TLShapeId,
  Polygon2d,
  Polyline2d,
  Group2d,
  STROKE_SIZES,
  LABEL_FONT_SIZES,
  TEXT_PROPS,
  SVGContainer,
  JsonObject,
} from 'tldraw';
import { RiCheckLine, RiCloseLine } from '@remixicon/react';
import { useChat } from '@/components/chat/ChatContext';
import { useCurrentWorkspaceId } from '@/lib/pathUtils';
import {
  cloudOutline,
  getCloudPath,
} from '@/components/shape/prediction/prediction.utils';

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
      w: 400,
      h: 250,
      text: 'Prediction',
      parentId: null,
      arrowId: null,
    };
  }

  getGeometry(shape: PredictionShape) {
    const w = Math.max(1, shape.props.w);
    const h = Math.max(1, shape.props.h);

    const body = new Polygon2d({
      points: cloudOutline(w, h, shape.id, 'm', 1),
      isFilled: false,
    });

    return new Group2d({
      children: [
        body,
        new Rectangle2d({
          x: 0,
          y: 0,
          height: h,
          width: w,
          isFilled: true,
          isLabel: false,
        }),
        // ...edges,
      ],
    });
  }

  component(shape: PredictionShape) {
    const { text, parentId } = shape.props;
    const { handleSendMessage } = useChat();
    const workspaceId = useCurrentWorkspaceId();
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
        workspaceId,
        predictionId: shape.id,
      });
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

    // Generate SVG path for cloud shape
    const cloudPoints = cloudOutline(
      shape.props.w,
      shape.props.h,
      shape.id,
      'm',
      1
    );
    const pathData =
      'M' + cloudPoints.map((p) => `${p.x},${p.y}`).join('L') + 'Z';

    return (
      <HTMLContainer
        className={cn(
          'relative flex flex-col items-center justify-center h-full',
          shouldHighlight ? 'opacity-100' : 'opacity-70'
        )}
      >
        <div className='relative flex flex-col items-center justify-center h-full'>
          <svg
            width={shape.props.w}
            height={shape.props.h}
            className='absolute top-0 left-0'
          >
            <path
              d={pathData}
              stroke='currentColor'
              className='text-primary/70'
              strokeWidth={STROKE_SIZES.m}
              fill='rgb(41 126 255)'
              fillOpacity={0.2}
            />
          </svg>

          <div className='relative z-10 flex flex-col items-center justify-center h-full p-8'>
            <div className='text-center text-xl font-medium text-primary'>
              {text}
            </div>

            {isSelected && (
              <div className='absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2'>
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
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: PredictionShape) {
    return (
      <path d={getCloudPath(shape.props.w, shape.props.h, shape.id, 'm', 1)} />
    );
  }

  /**
   * Handle confirm
   */
  handleConfirm(shape: PredictionShape) {
    this.editor.select(shape.id);
  }

  handleReject(shape: PredictionShape) {
    this.editor.deleteShapes([shape.id]);
  }

  override onDoubleClick(shape: PredictionShape):
    | void
    | ({
        id: TLShapeId;
        meta?: Partial<JsonObject> | undefined;
        props?: Partial<PredictionShapeProps> | undefined;
        type: 'prediction';
      } & Partial<Omit<PredictionShape, 'props' | 'type' | 'id' | 'meta'>>) {
    this.handleConfirm(shape);
  }

  override canEdit(_shape: PredictionShape): boolean {
    return false;
  }

  override onResize(
    shape: PredictionShape,
    info: TLResizeInfo<PredictionShape>
  ) {
    return resizeBox(shape, info);
  }
}
