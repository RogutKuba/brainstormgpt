import {
  HTMLContainer,
  Rectangle2d,
  resizeBox,
  ShapeUtil,
  TLBaseShape,
  TLResizeInfo,
} from 'tldraw';

// Define the properties specific to our LinkShape
export type LinkShapeProps = {
  url: string;
  text: string;
  w: number;
  h: number;
};

// Define the shape type by extending TLBaseShape with our props
export type LinkShape = TLBaseShape<'link', LinkShapeProps>;

export class LinkShapeUtil extends ShapeUtil<LinkShape> {
  static override type = 'link' as const;

  getDefaultProps(): LinkShape['props'] {
    return {
      w: 100,
      h: 100,
      url: 'https://www.google.com',
      text: 'Google',
    };
  }

  getGeometry(shape: LinkShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: false,
    });
  }

  component(shape: LinkShape) {
    return <HTMLContainer>Hello</HTMLContainer>;
  }

  indicator(shape: LinkShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  override onResize(shape: LinkShape, info: TLResizeInfo<LinkShape>) {
    return resizeBox(shape, info);
  }
}
