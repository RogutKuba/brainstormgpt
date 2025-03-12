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
import { Input } from '@/components/ui/input';
import { useUpdateLinkShape } from '@/query/shape.query';
import { Button } from '@/components/ui/button';

// Define the properties specific to our LinkShape
export type LinkShapeProps = {
  h: number;
  w: number;
  url: string;
  title: string;
  description: string;
  isLoading: boolean;
  status: 'success' | 'error' | 'scraping' | 'analyzing';
  error: string | null;
  previewImageUrl: string | null;
};

// Define the shape type by extending TLBaseShape with our props
export type LinkShape = TLBaseShape<'link', LinkShapeProps>;

export class LinkShapeUtil extends BaseBoxShapeUtil<LinkShape> {
  static override type = 'link' as const;

  override canEdit() {
    return true;
  }

  getDefaultProps(): LinkShape['props'] {
    return {
      w: 240,
      h: 160,
      url: 'https://www.google.com',
      title: 'Google',
      description: 'Google',
      isLoading: false,
      status: 'success',
      error: null,
      previewImageUrl: null,
    };
  }

  getGeometry(shape: LinkShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  component(shape: LinkShape) {
    const {
      url,
      title,
      description,
      isLoading,
      status,
      error,
      previewImageUrl,
    } = shape.props;

    const [editing, setEditing] = useState(false);
    const { updateLinkShape } = useUpdateLinkShape();
    const inputRef = useRef<HTMLInputElement>(null);

    const domain = (() => {
      try {
        return new URL(url).hostname;
      } catch (e) {
        return '';
      }
    })();

    const handleSave = async () => {
      const newUrl = inputRef.current?.value;
      if (!newUrl || newUrl === url) return;

      try {
        this.editor.updateShape<LinkShape>({
          ...shape,
          id: shape.id,
          props: {
            ...shape.props,
            status: 'scraping',
            isLoading: true,
          },
        });

        await updateLinkShape({ shapeId: shape.id, url: newUrl });
      } catch (e) {
        console.error('error', e);

        this.editor.updateShape<LinkShape>({
          ...shape,
          id: shape.id,
          props: {
            ...shape.props,
            status: 'error',
            isLoading: false,
          },
        });
      }
    };

    const stopEventPropagation = (e: any) => e.stopPropagation();

    return (
      <HTMLContainer
        className='w-full h-full p-0 flex flex-col rounded-lg overflow-hidden bg-white border border-2 border-gray-200'
        style={{
          pointerEvents: 'all', // Allow pointer events
        }}
      >
        {/* Title section at the top */}
        <div className='flex items-center justify-center p-4 gap-4'>
          {isLoading ? (
            <div className='flex items-center justify-center'>
              <RiLoader2Line className='w-6 h-6 animate-spin' />
            </div>
          ) : (
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}`}
              alt={domain}
              className='w-6 h-6'
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onDragStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragEnd={(e) => e.stopPropagation()}
              onDrag={(e) => e.stopPropagation()}
              draggable='false'
            />
          )}
          <div className='text-2xl font-bold'>{title}</div>
        </div>

        {/* Preview image or content area */}
        {previewImageUrl ? (
          <div
            style={{
              width: '100%',
              flexGrow: 1,
              overflow: 'hidden',
              position: 'relative',
              backgroundColor: '#f0f0f0',
            }}
          >
            <img
              src={previewImageUrl}
              alt={'No preview available'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
              draggable={false}
            />
          </div>
        ) : (
          <div
            style={{
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              backgroundColor: '#f8f9fa',
              color: '#6c757d',
              textAlign: 'center',
            }}
          >
            <RiLink className='w-8 h-8 mb-2 opacity-50' />
            <div style={{ fontSize: '14px', fontWeight: 'medium' }}>
              {description || 'No preview available'}
            </div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              {domain && `From ${domain}`}
            </div>
          </div>
        )}

        {/* Bottom bar with input when editing */}
        <div className='flex items-center justify-between p-2'>
          <Input
            disabled={!editing || isLoading}
            ref={inputRef}
            type='text'
            defaultValue={url}
            className='border-none outline-none mx-2 flex-grow'
            onBlur={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            placeholder='Enter URL'
          />

          {editing ? (
            <Button
              variant='icon'
              onClick={(e) => {
                console.log('save', inputRef.current?.value);

                if (inputRef.current) {
                  // Trigger the update with the current input value
                  console.log('inputRef.current.value', inputRef.current.value);
                  handleSave();
                }
                setEditing(false);
                e.stopPropagation();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <RiSaveLine className='w-5 h-5 text-stone-500' />
            </Button>
          ) : (
            <Button
              variant='icon'
              onClick={() => setEditing(true)}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <RiEditLine className='w-5 h-5 text-stone-500' />
            </Button>
          )}

          <Button variant='icon' asChild>
            <a
              href={url}
              target='_blank'
              rel='noopener noreferrer'
              onClick={stopEventPropagation}
              onPointerDown={stopEventPropagation}
              onPointerUp={stopEventPropagation}
            >
              <RiExternalLinkLine className='w-5 h-5 text-stone-500' />
            </a>
          </Button>
        </div>

        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255,255,255,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: '14px' }}>Loading...</div>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '8px',
              color: '#d32f2f',
              fontSize: '12px',
            }}
          >
            {error}
          </div>
        )}
      </HTMLContainer>
    );
  }

  indicator(shape: LinkShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />;
  }

  onDoubleClick(shape: LinkShape) {
    // if editing and double click, we want to select focus on the input and select all the text
    if (this.editor.getEditingShapeId() === shape.id) {
      console.log('select text');
    } else {
      this.editor.setEditingShape(shape.id);
    }
  }

  override onResize(shape: LinkShape, info: TLResizeInfo<LinkShape>) {
    return resizeBox(shape, info);
  }
}
