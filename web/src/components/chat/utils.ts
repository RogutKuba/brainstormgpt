export const calculateNodeSize = (text: string) => {
  // Calculate width and height based on text length
  const MIN_HEIGHT = 200;
  const MIN_WIDTH = 300;
  const CHARS_PER_LINE = 50;
  const HEIGHT_PER_LINE = 75;

  // Scale width based on text length
  const textLength = text.length;
  const widthScale = Math.min(2, 1 + textLength / 500); // Cap at 2x original width
  const width = Math.ceil(MIN_WIDTH * widthScale);

  // Calculate height based on text length and adjusted width
  const charsPerWidthAdjustedLine = CHARS_PER_LINE * (width / MIN_WIDTH);
  const numLines = Math.ceil(textLength / charsPerWidthAdjustedLine);
  const height = Math.max(numLines * HEIGHT_PER_LINE, MIN_HEIGHT);

  return {
    height,
    width,
  };
};
