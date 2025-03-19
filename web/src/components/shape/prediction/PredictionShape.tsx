import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  resizeBox,
  TLBaseShape,
  TLResizeInfo,
  TLShapeId,
} from 'tldraw';

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
      h: 200,
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
    const { text } = shape.props;

    return (
      <HTMLContainer className='w-full h-full flex flex-col rounded-lg overflow-hidden pointer-events-all'>
        {/* Main container with dashed border and subtle gradient */}
        <div className='w-full h-full flex items-center justify-center p-4 rounded-lg border-4 border-dashed border-primary/70 bg-gradient-to-br from-primary/10 to-primary/20 backdrop-blur-sm'>
          <div className='text-center text-lg font-medium text-primary'>
            {text}
          </div>
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
