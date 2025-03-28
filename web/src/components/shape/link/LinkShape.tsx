import {
  BaseBoxShapeUtil,
  HTMLContainer,
  IndexKey,
  JsonObject,
  Rectangle2d,
  resizeBox,
  TLArrowShape,
  TLBaseShape,
  TLParentId,
  TLResizeInfo,
  TLShapeId,
} from 'tldraw';
import { useState, useRef, useEffect } from 'react';
import {
  RiEditLine,
  RiExternalLinkLine,
  RiLink,
  RiLoader2Line,
  RiSaveLine,
  RiLock2Line,
  RiLockUnlockLine,
  RiGlobalLine,
  RiImage2Line,
  RiQuestionLine,
  RiErrorWarningLine,
} from '@remixicon/react';
import { Input } from '@/components/ui/input';
import { useUpdateLinkShape } from '@/query/shape.query';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useCurrentWorkspaceId } from '@/lib/pathUtils';
import {
  useContentShape,
  ANIMATION_DURATION,
  calculateExpandedHeight,
  handleResizeEnd,
  handleTranslateStart,
} from '@/components/shape/BaseContentShape';
import { useChat } from '@/components/chat/ChatContext';

// Define the properties specific to our LinkShape
export type LinkShapeProps = {
  h: number;
  w: number;
  url: string;
  title: string;
  description: string;
  isLoading: boolean;
  status:
    | 'success'
    | 'error'
    | 'scraping'
    | 'analyzing'
    | 'generating-predictions';
  error: string | null;
  previewImageUrl: string | null;
  isLocked: boolean;
  isExpanded: boolean;
  minCollapsedHeight: number;
  prevCollapsedHeight: number;
  predictions: Array<{
    text: string;
    type: 'text' | 'image' | 'web';
  }>;
  isDefault: boolean;
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
      w: 400,
      h: 300,
      url: 'https://www.google.com',
      title: 'Google',
      description: 'Google',
      isLoading: false,
      status: 'error',
      error: 'Error loading content',
      previewImageUrl: null,
      isLocked: true,
      isExpanded: false,
      minCollapsedHeight: 300,
      prevCollapsedHeight: 300,
      predictions: [],
      isDefault: true,
    };
  }

  getGeometry(shape: LinkShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  // Calculate the height of the shape based on content and predictions
  calculateShapeHeight = (shape: LinkShape): number => {
    return calculateExpandedHeight(shape);
  };

  component(shape: LinkShape) {
    const {
      url,
      title,
      description,
      isLoading,
      status,
      error,
      previewImageUrl,
      isLocked,
      predictions,
      isExpanded,
      isDefault,
    } = shape.props;

    const [editing, setEditing] = useState(false);
    const { updateLinkShape } = useUpdateLinkShape();
    const { handleSendMessage } = useChat();
    const workspaceId = useCurrentWorkspaceId();
    const inputRef = useRef<HTMLInputElement>(null);
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id);

    // Get the content shape utilities
    const {
      stopEventPropagation,
      toggleLock,
      handleSelectionState,
      handleExpansionAnimation,
      handlePredictionClick,
      renderPredictionsList,
    } = useContentShape<LinkShape>();

    // React to selection state
    useEffect(() => {
      handleSelectionState(shape, isSelected);
    }, [isSelected, isExpanded, predictions.length]);

    // Modify the expansion/collapse animation logic
    useEffect(() => {
      if (!isDefault && !isLoading && !error) {
        handleExpansionAnimation(
          shape,
          isExpanded,
          predictions.length,
          this.calculateShapeHeight
        );
      }
    }, [isExpanded, predictions.length, isDefault, isLoading, error]);

    // Handle prediction click
    const onPredictionClick = async (prediction: {
      text: string;
      type: 'text' | 'image' | 'web';
    }) => {
      await handlePredictionClick(
        shape,
        prediction,
        this.calculateShapeHeight,
        handleSendMessage,
        {
          searchType: prediction.type,
          selectedItemIds: [shape.id],
          workspaceId,
          editor: this.editor,
        }
      );
    };

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

    return (
      <HTMLContainer
        className={`w-full h-full p-0 flex flex-col rounded-lg overflow-hidden bg-white border border-2 ${
          isLocked
            ? 'border-primary/30 shadow-[0_0_0_2px_rgba(59,130,246,0.2)]'
            : 'border-gray-200'
        }`}
        style={{
          pointerEvents: 'all', // Allow pointer events
        }}
      >
        {/* Lock/Unlock button in the top bar */}
        <div className='absolute top-2 right-2 z-10 pointer-events-auto'>
          <div
            className={`flex items-center justify-center ${
              !isSelected && !isLocked && 'hidden'
            } ${isSelected && 'cursor-pointer hover:bg-gray-100 rounded-full'}`}
            onClick={(e) => toggleLock(shape, e)}
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

        {/* Title section at the top */}
        <div className='flex items-center p-4 gap-4'>
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
          <div className='text-2xl font-bold'>{title}</div>
        </div>

        {/*   */}

        {/* Preview image or content area */}
        {previewImageUrl ? (
          <div
            style={{
              width: '100%',
              height: '200px',
              position: 'relative',
              backgroundColor: '#f0f0f0',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <img
              src={previewImageUrl}
              alt={'No preview available'}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
                display: 'block',
              }}
              draggable={false}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                const containerWidth = img.width;
                const idealHeight = containerWidth / aspectRatio;

                const finalHeight = Math.min(Math.max(idealHeight, 150), 300);

                (
                  e.target as HTMLImageElement
                ).parentElement!.style.height = `${finalHeight}px`;
              }}
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
            autoFocus
          />

          {editing ? (
            <Button
              variant='icon'
              onClick={(e) => {
                if (inputRef.current) {
                  // Trigger the update with the current input value
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

        {!isDefault && !isLoading && !error
          ? renderPredictionsList(predictions, isSelected, onPredictionClick, {
              container: 'px-4 mt-0',
              activeContainer: 'py-4 mt-2',
            })
          : null}

        {isLoading && (
          <div className='absolute inset-0 bottom-[46px] bg-white/70 flex flex-col items-center justify-center gap-3 backdrop-blur-sm transition-all duration-300'>
            {status === 'scraping' && (
              <>
                <div className='flex items-center justify-center'>
                  <div className='relative w-12 h-12'>
                    <div
                      className='absolute inset-0 border-l-4 border-transparent border-solid rounded-full animate-spin text-primary'
                      style={{ animationDuration: '3s' }}
                    />
                    <RiLink
                      className='absolute inset-0 w-12 h-12 text-primary p-2 animate-pulse'
                      style={{ animationDuration: '2s' }}
                    />
                  </div>
                </div>
                <div className='text-base font-medium text-primary [text-shadow:0_0_10px_rgba(59,130,246,0.2)]'>
                  Scraping website content
                </div>
              </>
            )}

            {(status === 'analyzing' ||
              status === 'generating-predictions') && (
              <>
                <div className='flex items-center justify-center'>
                  <div
                    className='absolute inset-0 border-r-4 border-transparent border-solid rounded-full animate-spin'
                    style={{
                      animationDuration: '3s',
                      animationDirection: 'reverse',
                    }}
                  ></div>
                  <div className='absolute inset-0 flex items-center justify-center gap-1'>
                    <div
                      className='w-2 h-2 bg-primary rounded-full animate-bounce'
                      style={{ animationDuration: '0.8s' }}
                    ></div>
                    <div
                      className='w-2 h-2 bg-primary rounded-full animate-bounce'
                      style={{
                        animationDuration: '0.8s',
                        animationDelay: '0.2s',
                      }}
                    ></div>
                    <div
                      className='w-2 h-2 bg-primary rounded-full animate-bounce'
                      style={{
                        animationDuration: '0.8s',
                        animationDelay: '0.4s',
                      }}
                    ></div>
                  </div>
                </div>
                <div className='mt-8 text-base font-medium text-primary [text-shadow:0_0_10px_rgba(139,92,246,0.2)]'>
                  Analyzing content
                </div>
              </>
            )}

            {status !== 'scraping' && status !== 'analyzing' && (
              <div className='flex flex-col items-center'>
                <RiLoader2Line
                  className='w-10 h-10 text-gray-500 animate-spin mb-2'
                  style={{ animationDuration: '1.2s' }}
                />
                <div
                  style={{
                    fontSize: '16px',
                    color: '#4b5563',
                    fontWeight: 'medium',
                  }}
                >
                  Loading...
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className='absolute inset-0 bottom-[46px] bg-white/70 flex flex-col items-center justify-center gap-3 backdrop-blur-sm transition-all duration-300'>
            <div className='flex items-center justify-center'>
              <div className='relative w-12 h-12'>
                <RiErrorWarningLine
                  className='absolute inset-0 w-12 h-12 text-red-500 p-2 animate-pulse'
                  style={{ animationDuration: '2s' }}
                />
              </div>
            </div>
            <div className='text-base font-medium text-red-500 [text-shadow:0_0_10px_rgba(220,38,38,0.2)]'>
              Error loading content
            </div>
            <div className='text-sm text-red-600 max-w-[80%] text-center'>
              {error}
            </div>
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

  onTranslateStart(shape: LinkShape):
    | void
    | ({
        id: TLShapeId;
        meta?: Partial<JsonObject> | undefined;
        props?: Partial<LinkShape> | undefined;
        type: 'link';
      } & Partial<Omit<LinkShape, 'props' | 'type' | 'id' | 'meta'>>) {
    if (shape.props.isDefault) {
      return {
        id: shape.id,
        type: 'link',
      };
    }

    // Use the standalone function instead of the hook
    const result = handleTranslateStart(shape);
    if (result) {
      return {
        id: shape.id,
        type: 'link',
        props: result.props,
      };
    }
    return;
  }

  override onResize(shape: LinkShape, info: TLResizeInfo<LinkShape>) {
    const resized = resizeBox(shape, info);

    // Update both minCollapsedHeight and prevCollapsedHeight if user resizes to a smaller height
    if (resized.props.h < shape.props.minCollapsedHeight) {
      const newHeight = resized.props.h;
      return {
        ...resized,
        props: {
          ...resized.props,
          minCollapsedHeight: newHeight,
          prevCollapsedHeight: newHeight,
        },
      };
    }

    // If shape is not expanded, update prevCollapsedHeight to match current height
    if (!shape.props.isExpanded) {
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

  override onResizeEnd(
    initial: LinkShape,
    current: LinkShape
  ):
    | void
    | ({
        id: TLShapeId;
        meta?: Partial<JsonObject>;
        props?: Partial<LinkShapeProps>;
        type: 'link';
      } & Partial<Omit<LinkShape, 'props' | 'type' | 'id' | 'meta'>>) {
    // If the shape isn't expanded, we want to update the prevCollapsedHeight
    if (!current.props.isExpanded) {
      return {
        id: current.id,
        type: 'link',
        props: {
          prevCollapsedHeight: current.props.h,
          minCollapsedHeight: Math.min(
            current.props.minCollapsedHeight,
            current.props.h
          ),
        },
      };
    }

    // If the shape is expanded, use the base handler
    const result = handleResizeEnd(current, this.calculateShapeHeight);
    if (result) {
      return {
        id: current.id,
        type: 'link',
        props: {
          ...result.props,
          minCollapsedHeight: Math.min(
            current.props.minCollapsedHeight,
            current.props.h
          ),
        },
      };
    }

    return;
  }
}
