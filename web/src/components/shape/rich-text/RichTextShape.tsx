import {
  BaseBoxShapeUtil,
  HTMLContainer,
  IndexKey,
  JsonObject,
  Rectangle2d,
  resizeBox,
  TLBaseShape,
  TLParentId,
  TLResizeInfo,
  TLShapeId,
} from 'tldraw';
import { useState, useRef } from 'react';
import { debounce } from 'lodash';
import {
  RiCloseLine,
  RiEditLine,
  RiExternalLinkLine,
  RiLink,
  RiLoader2Line,
  RiSaveLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { Textarea } from '@/components/ui/textarea';

// Define the properties specific to our RichTextShape
export type RichTextShapeProps = {
  h: number;
  w: number;
  text: string;
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
    const { text } = shape.props;

    const isEditing = this.editor.getEditingShapeId() === shape.id;

    const stopEventPropagation = (e: React.SyntheticEvent) =>
      e.stopPropagation();

    return (
      <HTMLContainer
        style={{
          width: '100%',
          height: '100%',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          pointerEvents: 'all',
        }}
      >
        {/* Content area */}
        <div
          style={{
            flexGrow: 1,
            overflow: 'auto',
            padding: '16px',
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
              className='w-full h-full resize-none border-none focus:ring-0'
              autoFocus
            />
          ) : (
            <div className='markdown-content prose prose-sm max-w-none'>
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

  onDoubleClick(shape: RichTextShape) {
    this.editor.setEditingShape(shape.id);
  }

  override onResize(shape: RichTextShape, info: TLResizeInfo<RichTextShape>) {
    return resizeBox(shape, info);
  }
}
