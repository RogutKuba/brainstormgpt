import { LinkShape } from '@/components/shape/link/LinkShape';
import { createShapeId, Editor, TLUrlExternalContent } from 'tldraw';

export const handleCustomUrlPaste = (
  editor: Editor,
  { type, url }: TLUrlExternalContent,
  callback: (params: { shapeId: string; url: string }) => void
) => {
  // Only handle URLs
  if (type !== 'url' || !url) return;

  // Get the current pointer position for placement
  const point = editor.inputs.currentPagePoint;

  // Create the link shape
  const shapeId = createShapeId();
  editor.createShape<LinkShape>({
    id: shapeId,
    type: 'link',
    x: point.x,
    y: point.y,
    props: {
      title: url,
      description: url,
      url: url,
      isLoading: true,
      w: 240,
      h: 160,
      isLocked: true,
      isExpanded: false,
      predictions: [],
      minCollapsedHeight: 160,
      prevCollapsedHeight: 160,
      status: 'scraping',
      error: null,
      previewImageUrl: null,
    },
  });

  callback({ shapeId, url });
};
