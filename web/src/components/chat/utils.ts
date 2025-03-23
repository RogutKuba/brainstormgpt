export const calculateNodeSize = (text: string) => {
  // since we render markdown, we need to calculate the size of the node based on the markdown
  // consider how - becomes its own line item
  const numHyphens = (text.match(/-/g) || []).length;

  // Calculate width and height based on text length
  const MIN_HEIGHT = 200;
  const MIN_WIDTH = 300;
  const CHARS_PER_LINE = 75;
  const HEIGHT_PER_LINE = 85;

  // Scale width based on text length with a reasonable cap
  const textLength = text.length;
  const widthScale = Math.min(2.5, 1 + textLength / 500); // Cap width growth
  const width = Math.ceil(MIN_WIDTH * widthScale);

  // Calculate height based on text length and adjusted width
  const charsPerWidthAdjustedLine = CHARS_PER_LINE * (width / MIN_WIDTH);
  const numLines =
    Math.ceil(textLength / charsPerWidthAdjustedLine) + numHyphens;
  const contentHeight = numLines * HEIGHT_PER_LINE;

  // Use a more balanced height calculation that doesn't grow too rapidly
  // Linear growth instead of quadratic to maintain better proportions
  const heightScale = Math.min(1.5, 1 + textLength / 1000); // Cap height growth
  const calculatedHeight = MIN_HEIGHT * heightScale;

  // Use the larger of content height or calculated height, but with a reasonable maximum
  const height = Math.min(
    Math.max(contentHeight, calculatedHeight, MIN_HEIGHT),
    MIN_HEIGHT * 2 // Cap at 2x minimum height to prevent excessive vertical space
  );

  const padding = 10;

  return {
    height: height + padding,
    width: width + padding,
  };
};

export const calculatePredictionSize = (text: string) => {
  const MIN_HEIGHT = 200;
  const MIN_WIDTH = 300;
  const CHARS_PER_LINE = 50;
  const HEIGHT_PER_LINE = 75;

  const textLength = text.length;
  const widthScale = Math.min(2, 1 + textLength / 500); // Cap at 2x original width
  const width = Math.ceil(MIN_WIDTH * widthScale);

  const charsPerWidthAdjustedLine = CHARS_PER_LINE * (width / MIN_WIDTH);
  const numLines = Math.ceil(textLength / charsPerWidthAdjustedLine);
  const height = Math.max(numLines * HEIGHT_PER_LINE, MIN_HEIGHT);

  const padding = 25;

  return {
    height: height + padding,
    width: width + padding,
  };
};
