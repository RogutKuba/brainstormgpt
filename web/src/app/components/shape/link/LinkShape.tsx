import {
  BaseBoxShapeUtil,
  HTMLContainer,
  JsonObject,
  Rectangle2d,
  resizeBox,
  TLBaseShape,
  TldrawUiButton,
  TldrawUiButtonLabel,
  TldrawUiDialogBody,
  TldrawUiDialogCloseButton,
  TldrawUiDialogFooter,
  TldrawUiDialogHeader,
  TldrawUiDialogTitle,
  TLResizeInfo,
  TLShapeId,
} from 'tldraw';
import { useState } from 'react';
import { debounce } from 'lodash';
import { Input } from '@/components/ui/input';
import { RiLoader2Line } from '@remixicon/react';

// Define the properties specific to our LinkShape
export type LinkShapeProps = {
  url: string;
  text: string;
  w: number;
  h: number;
  isLoading?: boolean;
  error?: string;
  previewImageUrl?: string;
  description?: string;
  tempUrl?: string; // Temporary URL for editing
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
      text: 'Google',
      isLoading: true,
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
      text,
      isLoading,
      error,
      previewImageUrl,
      description,
      tempUrl,
    } = shape.props;

    const isEditing = this.editor.getEditingShapeId() === shape.id;
    const domain = (() => {
      try {
        return new URL(url).hostname;
      } catch (e) {
        return '';
      }
    })();

    // Create a debounced update function
    const debouncedUpdateUrl = debounce((newUrl: string) => {
      this.editor.updateShape<LinkShape>({
        id: shape.id,
        type: 'link',
        props: { url: newUrl },
      });
    }, 300); // 300ms debounce time

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
          pointerEvents: 'all', // Allow pointer events
        }}
      >
        {/* Title section at the top */}
        <div
          style={{
            padding: '12px',
            borderBottom: '1px solid #eee',
          }}
        >
          <div
            style={{
              color: '#000',
              fontWeight: 'bold',
              fontSize: '18px',
              wordBreak: 'break-word',
            }}
          >
            {text}
          </div>
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
            />
          </div>
        ) : (
          <div
            style={{
              padding: '12px',
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              backgroundColor: '#f9f9f9',
            }}
          >
            {description ? (
              <div style={{ fontSize: '14px', color: '#555' }}>
                {description}
              </div>
            ) : (
              <div
                style={{ fontSize: '14px', color: '#888', fontStyle: 'italic' }}
              >
                No preview available
              </div>
            )}
          </div>
        )}

        {/* Bottom bar with favicon, domain and input when editing */}
        <div
          style={{
            padding: '12px',
            borderTop: '1px solid #eee',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '16px',
              height: '16px',
              marginRight: '8px',
              backgroundColor: '#f0f0f0',
              borderRadius: '2px',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {isLoading ? (
              <div className='w-full h-full flex items-center justify-center'>
                <RiLoader2Line className='w-4 h-4 animate-spin' />
              </div>
            ) : (
              <img
                src={`https://www.google.com/s2/favicons?domain=${domain}`}
                alt=''
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}
          </div>

          <Input
            readOnly={!isEditing}
            type='text'
            defaultValue={url}
            autoFocus
            className='border-none outline-none'
            onBlur={(e) => debouncedUpdateUrl(e.target.value)}
            placeholder='Enter URL'
          />
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

const InputDialog = ({
  onClose,
  onSubmit,
  initialValue,
  title,
  placeholder,
}: {
  onClose(): void;
  onSubmit: (value: string) => void;
  initialValue: string;
  title: string;
  placeholder: string;
}) => {
  const [value, setValue] = useState(initialValue);

  const handleSubmit = () => {
    onSubmit(value);
    onClose();
  };

  return (
    <>
      <TldrawUiDialogHeader>
        <TldrawUiDialogTitle>{title}</TldrawUiDialogTitle>
        <TldrawUiDialogCloseButton />
      </TldrawUiDialogHeader>
      <TldrawUiDialogBody style={{ maxWidth: 350 }}>
        <input
          className='w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-sans'
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
        />
      </TldrawUiDialogBody>
      <TldrawUiDialogFooter className='tlui-dialog__footer__actions'>
        <TldrawUiButton type='normal' onClick={onClose}>
          <TldrawUiButtonLabel>Cancel</TldrawUiButtonLabel>
        </TldrawUiButton>
        <TldrawUiButton
          type='primary'
          onClick={handleSubmit}
          disabled={!value.trim()}
        >
          <TldrawUiButtonLabel>Save</TldrawUiButtonLabel>
        </TldrawUiButton>
      </TldrawUiDialogFooter>
    </>
  );
};
