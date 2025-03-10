import { Editor, TLUrlExternalContent } from 'tldraw';

export const handleCustomUrlPaste = (
  editor: Editor,
  { type, url }: TLUrlExternalContent
) => {
  console.log('handleCustomUrlPaste', type, url);

  // Only handle URLs
  if (type !== 'url' || !url) return;

  // Get the current pointer position for placement
  const point = editor.inputs.currentPagePoint;

  // Create a default title from the URL
  const domain = new URL(url).hostname.replace('www.', '');
  const text = domain.charAt(0).toUpperCase() + domain.slice(1);

  // Create the link shape
  editor.createShapes([
    {
      type: 'link',
      x: point.x,
      y: point.y,
      props: {
        url: url,
        text: text,
        w: 240,
        h: 160,
        isLoading: true, // Start with loading state
      },
    },
  ]);

  // Optionally, fetch metadata for the URL
  fetchUrlMetadata(editor, url);
};

// Helper function to fetch metadata for the URL
async function fetchUrlMetadata(editor: Editor, url: string) {
  try {
    // You would implement or call your URL metadata service here
    // For example:
    // const response = await fetch(`/api/url-metadata?url=${encodeURIComponent(url)}`);
    // const metadata = await response.json();

    // For now, let's simulate a delay and then update with dummy data
    setTimeout(() => {
      // Find the link shape we just created
      const linkShape = editor
        .getCurrentPageShapes()
        .find(
          (shape) =>
            shape.type === 'link' &&
            'url' in shape.props &&
            shape.props.url === url
        );

      if (linkShape) {
        // Update the shape with metadata
        editor.updateShape({
          id: linkShape.id,
          type: 'link',
          props: {
            ...linkShape.props,
            isLoading: false,
            // In a real implementation, you would use actual metadata:
            // text: metadata.title,
            // description: metadata.description,
            // previewImageUrl: metadata.image,
          },
        });
      }
    }, 1000);
  } catch (error) {
    console.error('Error fetching URL metadata:', error);

    // Update the shape to show error state
    const linkShape = editor
      .getCurrentPageShapes()
      .find(
        (shape) =>
          shape.type === 'link' &&
          'url' in shape.props &&
          shape.props.url === url
      );

    if (linkShape) {
      editor.updateShape({
        id: linkShape.id,
        type: 'link',
        props: {
          ...linkShape.props,
          isLoading: false,
          error: 'Failed to load URL preview',
        },
      });
    }
  }
}
