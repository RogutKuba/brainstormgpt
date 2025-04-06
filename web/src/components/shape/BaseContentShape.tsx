import { SyntheticEvent } from 'react';
import { TLBaseShape, TLShapeId, useEditor } from 'tldraw';
import { cx } from '@/components/ui/lib/utils';
import { RiGlobalLine, RiImage2Line, RiQuestionLine } from '@remixicon/react';

// Define the common properties for content shapes with predictions
export interface ContentShapeProps {
  h: number;
  w: number;
  isLocked: boolean;
  isExpanded: boolean;
  predictions: Array<{
    text: string;
    type: 'text' | 'image' | 'web';
  }>;
  minCollapsedHeight: number;
  prevCollapsedHeight: number;
  isHighlighted?: boolean;
  isRoot?: boolean;
}

// Animation duration constant for shape animations
export const ANIMATION_DURATION = {
  animation: {
    duration: 200,
  },
};

// Calculate expanded height based on predictions content
// This is outside the hook since it doesn't depend on editor state
export const calculateExpandedHeight = <
  T extends TLBaseShape<string, ContentShapeProps>
>(
  shape: T,
  options?: {
    yPadding?: number;
    baseRowHeight?: number;
    fontSize?: number;
    predictionPadding?: number;
    headerHeight?: number;
  }
): number => {
  const { minCollapsedHeight, predictions, w, prevCollapsedHeight } =
    shape.props;

  // Base padding constants with defaults that can be overridden
  const Y_PADDING = options?.yPadding ?? 24; // Padding for borders and margins
  const BASE_ROW_HEIGHT = options?.baseRowHeight ?? 32; // Base height for a single line
  const ROW_PADDING = 4; // Padding between prediction items
  const FONT_SIZE = options?.fontSize ?? 12; // Font size in pixels
  const PREDICTION_PADDING = options?.predictionPadding ?? 8; // Padding between prediction items
  const PREDICTION_HEADER_HEIGHT = options?.headerHeight ?? 24; // Height for the predictions section header

  // Calculate expanded height based on predictions content
  let predictionsHeight = 0;

  if (predictions.length > 0) {
    // Calculate characters per line based on width and font size
    const charsPerLine = Math.floor((w - 48) / (FONT_SIZE * 0.6)); // Account for padding and character width

    // Calculate height for each prediction based on its text length
    for (const prediction of predictions) {
      const textLength = prediction.text.length;
      const estimatedLines = Math.max(1, Math.ceil(textLength / charsPerLine));
      const itemHeight =
        BASE_ROW_HEIGHT * estimatedLines + ROW_PADDING * (estimatedLines - 1);
      predictionsHeight += itemHeight;
    }

    // Add padding between items
    predictionsHeight += (predictions.length - 1) * PREDICTION_PADDING;
  } else {
    // Add height for "No predictions available" message
    predictionsHeight = BASE_ROW_HEIGHT + PREDICTION_PADDING;
  }

  // Add header space for predictions section
  predictionsHeight += PREDICTION_HEADER_HEIGHT;

  // Add overall padding
  predictionsHeight += Y_PADDING;

  // Use the larger of calculated height or previous collapsed height
  return Math.max(prevCollapsedHeight + predictionsHeight, minCollapsedHeight);
};

// Handle resize end for content shapes - moved outside the hook
export const handleResizeEnd = <
  T extends TLBaseShape<string, ContentShapeProps>
>(
  current: T,
  calculateHeightFn: (shape: T) => number
): {
  id: TLShapeId;
  type: string;
  props: Partial<ContentShapeProps>;
} | void => {
  // If the shape is expanded and was resized
  if (current.props.isExpanded) {
    // Calculate what the collapsed height should be based on the current expanded height
    // We need to subtract the height needed for predictions
    const tempShape = { ...current } as T;
    const predictionsHeight =
      calculateHeightFn(tempShape) - current.props.prevCollapsedHeight;

    return {
      id: current.id,
      type: current.type,
      props: {
        prevCollapsedHeight: current.props.h - predictionsHeight,
      },
    };
  }

  // Update prevCollapsedHeight when not expanded
  if (!current.props.isExpanded) {
    return {
      id: current.id,
      type: current.type,
      props: {
        prevCollapsedHeight: current.props.h,
      },
    };
  }

  return;
};

// Handle translation start (dragging) - moved outside the hook
export const handleTranslateStart = <
  T extends TLBaseShape<string, ContentShapeProps>
>(
  shape: T
): {
  id: TLShapeId;
  type: string;
  props: Partial<ContentShapeProps>;
} | void => {
  // If the shape is a root, prevent dragging by locking it
  if (shape.props.isRoot) {
    return {
      id: shape.id,
      type: shape.type,
      props: {
        isLocked: true,
      },
    };
  }

  // For non-root shapes, lock during translation but maintain current expansion state
  return {
    id: shape.id,
    type: shape.type,
    props: {
      isLocked: true,
      h: calculateExpandedHeight(shape),
    },
  };
};

export const useContentShape = <
  T extends TLBaseShape<string, ContentShapeProps>
>() => {
  const editor = useEditor();

  // Helper to stop event propagation
  const stopEventPropagation = (e: SyntheticEvent) => e.stopPropagation();

  // Toggle lock state for a shape
  const toggleLock = (shape: T, e: SyntheticEvent) => {
    e.stopPropagation();

    // Don't allow unlocking root shapes
    if (shape.props.isRoot) {
      return;
    }

    editor.updateShape({
      id: shape.id,
      type: shape.type,
      props: { isLocked: !shape.props.isLocked },
    });
  };

  // Check if a shape is a root
  const isRoot = (shape: T) => {
    return !!shape.props.isRoot;
  };

  // Prevent deletion of root shapes
  const handleDelete = (shape: T) => {
    return shape.props.isRoot;
  };

  // Handle selection and expansion state
  const handleSelectionState = (shape: T, isSelected: boolean) => {
    const { isExpanded } = shape.props;

    if (isSelected && !isExpanded) {
      // Expand when selected, regardless of predictions
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        props: {
          isExpanded: true,
          isLocked: true,
          prevCollapsedHeight: shape.props.h, // Store current height before expanding
        },
      });
    } else if (!isSelected && isExpanded) {
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        props: { isExpanded: false },
      });
    }
  };

  // Handle expansion/collapse animation
  const handleExpansionAnimation = (
    shape: T,
    isExpanded: boolean,
    predictionsLength: number,
    calculateHeightFn: (shape: T) => number
  ) => {
    if (isExpanded) {
      // Expand the shape, even if there are no predictions
      editor.animateShape(
        {
          id: shape.id,
          type: shape.type,
          props: {
            h: calculateHeightFn(shape),
          },
        },
        ANIMATION_DURATION
      );
    } else if (!isExpanded) {
      // Collapse the shape back to previous height
      editor.animateShape(
        {
          id: shape.id,
          type: shape.type,
          props: {
            h: shape.props.prevCollapsedHeight,
          },
        },
        ANIMATION_DURATION
      );
    }
  };

  // Handle prediction click
  const handlePredictionClick = async <MessageHandlerParams,>(
    shape: T,
    prediction: {
      text: string;
      type: 'text' | 'image' | 'web';
    },
    calculateHeightFn: (shape: T) => number,
    handleSendMessage: (params: MessageHandlerParams) => Promise<void>,
    messageParams: Omit<MessageHandlerParams, 'message'>
  ) => {
    // Get updated predictions array by filtering out the clicked prediction
    const updatedPredictions = shape.props.predictions.filter(
      (p) => p.text !== prediction.text
    );

    // Create a temporary shape with updated predictions to calculate the new height
    const tempShape = {
      ...shape,
      props: {
        ...shape.props,
        predictions: updatedPredictions,
      },
    } as T;

    // Calculate new height based on remaining predictions
    const newHeight = calculateHeightFn(tempShape);

    // Update the shape with both the new predictions array
    editor.updateShape({
      id: shape.id,
      type: shape.type,
      props: {
        predictions: updatedPredictions,
      },
    });

    // Animate to the new height
    editor.animateShape(
      {
        id: shape.id,
        type: shape.type,
        props: {
          h:
            updatedPredictions.length > 0
              ? newHeight
              : shape.props.prevCollapsedHeight,
          isExpanded: updatedPredictions.length > 0, // Auto-collapse if no predictions left
        },
      },
      ANIMATION_DURATION
    );

    // Handle sending the message
    await handleSendMessage({
      message: prediction.text,
      ...messageParams,
    } as MessageHandlerParams);
  };

  // Render predictions list
  const renderPredictionsList = (
    predictions: Array<{
      text: string;
      type: 'text' | 'image' | 'web';
    }>,
    isSelected: boolean,
    onPredictionClick: (prediction: {
      text: string;
      type: 'text' | 'image' | 'web';
    }) => void,
    className?: {
      container?: string;
      activeContainer?: string;
    }
  ) => {
    return (
      <div
        className={cx(
          'mt-4 border-t pt-4 pointer-events-auto overflow-hidden transition-all duration-300 ease-in-out',
          className?.container ?? '',
          isSelected
            ? `max-h-[500px] opacity-100 ${className?.activeContainer}`
            : 'max-h-0 opacity-0 border-t-0 pt-0'
        )}
      >
        <ul className={cx('space-y-2', !isSelected && 'hidden')}>
          {predictions.length > 0 ? (
            predictions.map((item) => (
              <li
                key={item.text}
                className='flex items-center gap-2 hover:bg-gray-50 p-1 rounded cursor-pointer transition-colors pointer-events-auto'
                onClick={(e) => {
                  e.stopPropagation();
                  onPredictionClick(item);
                }}
                onPointerDown={stopEventPropagation}
                onTouchStart={stopEventPropagation}
                onTouchEnd={stopEventPropagation}
              >
                {/* Render icon based on prediction type */}
                <div className='flex items-center h-5'>
                  {item.type === 'image' ? (
                    <RiImage2Line className='text-pink-500 h-5 w-5' />
                  ) : item.type === 'web' ? (
                    <RiGlobalLine className='text-yellow-500 h-5 w-5' />
                  ) : (
                    <RiQuestionLine className='text-green-500 h-5 w-5' />
                  )}
                </div>
                <span className='text-lg text-gray-700 pointer-events-auto'>
                  {item.text}
                </span>
              </li>
            ))
          ) : (
            <li className='text-center p-2 text-gray-500 text-lg'>
              No predictions available
            </li>
          )}
        </ul>
      </div>
    );
  };

  return {
    stopEventPropagation,
    toggleLock,
    handleSelectionState,
    handleExpansionAnimation,
    handlePredictionClick,
    renderPredictionsList,
    isRoot,
    handleDelete,
  };
};
