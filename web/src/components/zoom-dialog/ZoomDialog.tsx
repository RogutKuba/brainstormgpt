import { Button } from '@/components/ui/button';
import {
  DialogContent,
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogClose,
} from '@/components/ui/dialog';
import { useZoomDialog } from '@/components/zoom-dialog/ZoomDialogContext';
import {
  RiCloseLine,
  RiFilePdfLine,
  RiExternalLinkLine,
  RiGlobalLine,
  RiImage2Line,
  RiQuestionLine,
} from '@remixicon/react';
import {
  RichTextContentType,
  LinkContentType,
} from '@/components/zoom-dialog/ZoomDialogContext';
import ReactMarkdown from 'react-markdown';
import {
  ContentShapeProps,
  useContentShape,
} from '@/components/shape/BaseContentShape';
import { TLBaseShape, TLShapeId, useEditor } from 'tldraw';

export const ContentZoomDialog = () => {
  const {
    open,
    setOpen,
    shapeId,
    setShapeId,
    content,
    removePrediction,
    title: rawTitle,
  } = useZoomDialog();

  const { handlePredictionClick } = useContentShape();
  const editor = useEditor();

  const body = (() => {
    switch (content?.type) {
      case 'rich-text':
        return <RichTextBody content={content} />;
      case 'link':
        return <LinkBody content={content} />;
    }
  })();

  const title = (() => {
    if (typeof rawTitle === 'string') {
      return <div className='text-2xl font-bold'>{rawTitle}</div>;
    }

    // is already react node
    return rawTitle;
  })();

  const onPredictionClick = (params: { index: number; shapeId: TLShapeId }) => {
    const shape = editor.getShape(params.shapeId) as TLBaseShape<
      string,
      ContentShapeProps
    > | null;
    const prediction = content?.predictions[params.index];

    if (!shape || !prediction) return;

    handlePredictionClick(shape, prediction, () => 500);

    removePrediction(params.index);
  };

  const handleOnOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setShapeId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent className='max-w-4xl'>
        <DialogHeader className='flex flex-row items-center justify-between'>
          <DialogTitle>{title}</DialogTitle>
          <DialogClose asChild>
            <Button variant='icon'>
              <RiCloseLine className='h-4 w-4 shrink-0' />
            </Button>
          </DialogClose>
        </DialogHeader>

        {content && shapeId ? (
          <div className='overflow-y-auto max-h-[80vh]'>
            {body}
            {content?.predictions && content.predictions.length > 0 && (
              <PredictionsList
                predictions={content.predictions}
                onPredictionClick={(index) =>
                  onPredictionClick({
                    index,
                    shapeId,
                  })
                }
              />
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const RichTextBody = ({ content }: { content: RichTextContentType }) => {
  return (
    <div className='markdown-content prose prose-lg max-w-none'>
      <ReactMarkdown>{content.content}</ReactMarkdown>
    </div>
  );
};

const LinkBody = ({ content }: { content: LinkContentType }) => {
  const contentType = (() => {
    try {
      const url = new URL(content.url);

      // Check for YouTube
      if (
        url.hostname.includes('youtube.com') ||
        url.hostname.includes('youtu.be')
      ) {
        return 'youtube';
      }

      // Check for PDF
      if (url.pathname.toLowerCase().endsWith('.pdf')) {
        return 'pdf';
      }

      return 'website';
    } catch (e) {
      return 'other';
    }
  })();

  // Extract YouTube video ID if applicable
  const getYoutubeVideoId = (url: string): string | null => {
    try {
      const urlObj = new URL(url);

      if (urlObj.hostname.includes('youtube.com')) {
        return urlObj.searchParams.get('v');
      } else if (urlObj.hostname.includes('youtu.be')) {
        return urlObj.pathname.substring(1);
      }

      return null;
    } catch (e) {
      return null;
    }
  };

  // Get domain for favicon
  const domain = (() => {
    try {
      return new URL(content.url).hostname;
    } catch (e) {
      return '';
    }
  })();

  return (
    <div className='flex flex-col w-full'>
      {/* Content area based on content type */}
      {contentType === 'youtube' && getYoutubeVideoId(content.url) ? (
        <div className='w-full aspect-video bg-black rounded-xl overflow-hidden'>
          <iframe
            src={`https://www.youtube.com/embed/${getYoutubeVideoId(
              content.url
            )}`}
            title={content.title || 'YouTube video'}
            allow='accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
            allowFullScreen
            className='w-full h-full rounded-lg'
          />
        </div>
      ) : contentType === 'pdf' ? (
        <div className='w-full flex-grow flex flex-col items-center justify-center bg-gray-100 p-8'>
          {/* PDF Viewer with iframe */}
          <div className='w-full aspect-[4/3] mb-4 rounded-lg overflow-hidden shadow-md'>
            <iframe
              src={`${content.url}#toolbar=0&navpanes=0`}
              title={content.title || 'PDF Document'}
              className='w-full h-full border-0'
              loading='lazy'
            />
          </div>
        </div>
      ) : content.previewImageUrl ? (
        <div className='w-full max-h-[500px] bg-gray-100 flex justify-center overflow-hidden'>
          <a
            href={content.url}
            target='_blank'
            rel='noopener noreferrer'
            className='w-full h-full flex items-center justify-center'
          >
            <img
              src={content.previewImageUrl}
              alt={content.title || 'Preview'}
              className='object-contain max-h-[500px] w-full h-full'
            />
          </a>
        </div>
      ) : (
        <div className='flex flex-col items-center justify-center p-8 bg-gray-50'>
          <RiGlobalLine className='w-12 h-12 text-gray-400 mb-3' />
          <div className='text-lg font-medium text-gray-700'>
            {content.description || 'No preview available'}
          </div>
          <div className='text-sm text-gray-500 mt-2'>
            {domain && `From ${domain}`}
          </div>
        </div>
      )}

      {/* URL and external link */}
      <div className='flex items-center justify-between p-4 border-t'>
        <div className='text-sm text-gray-600 truncate flex-grow'>
          {content.url}
        </div>
        <a
          href={content.url}
          target='_blank'
          rel='noopener noreferrer'
          className='ml-2 p-2 rounded-full hover:bg-gray-200 transition-colors'
        >
          <RiExternalLinkLine className='w-5 h-5 text-gray-600' />
        </a>
      </div>
    </div>
  );
};

// This component can be removed or updated to be more generic
const PredictionsList = ({
  predictions,
  onPredictionClick,
}: {
  predictions: Array<{ text: string; type: 'text' | 'image' | 'web' }>;
  onPredictionClick: (index: number) => void;
}) => {
  if (!predictions || predictions.length === 0) return null;

  return (
    <div className='mt-6 border-t pt-4'>
      <h3 className='text-md font-medium mb-3'>Related questions</h3>
      <ul className='space-y-2'>
        {predictions.map((prediction, index) => (
          <li
            key={prediction.text}
            className='flex items-center gap-2 hover:bg-gray-50 p-2 rounded cursor-pointer transition-colors'
            onClick={() => onPredictionClick(index)}
          >
            {/* Icon based on prediction type */}
            <div className='flex items-center h-5'>
              {prediction.type === 'image' ? (
                <RiImage2Line className='text-pink-500 h-5 w-5' />
              ) : prediction.type === 'web' ? (
                <RiGlobalLine className='text-yellow-500 h-5 w-5' />
              ) : (
                <RiQuestionLine className='text-green-500 h-5 w-5' />
              )}
            </div>
            <span className='text-md text-gray-700'>{prediction.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
