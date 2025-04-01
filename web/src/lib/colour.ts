export const getRandomColour = (seed?: string) => {
  const hash = seed
    ? seed.split('').reduce((acc, char) => {
        return acc + char.charCodeAt(0);
      }, 0)
    : 0;

  // Using lower saturation (60-80%) and higher lightness (70-85%) for softer colors
  const saturation = 60 + (hash % 20); // 60-80%
  const lightness = 70 + (hash % 15); // 70-85%

  return `hsl(${hash % 360}, ${saturation}%, ${lightness}%)`;
};
