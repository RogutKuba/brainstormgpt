import {
  RichTextShape,
  RichTextShapeUtil,
} from '@/components/shape/rich-text/RichTextShape';
import {
  Editor,
  useEditor,
  TLShapeId,
  TLArrowBinding,
  TLShape,
  TLBinding,
} from 'tldraw';

type BrainstormResult = {
  type: 'add-text';
  text: string;
  parentId?: TLShapeId;
  id?: TLShapeId;
  predictions?: string[];
};

export const BrainstormToolCalls = {
  handleBrainstormResult: async (params: {
    result: BrainstormResult[];
    editor: Editor;
  }) => {
    const { result, editor } = params;

    console.log('got result', result);

    for (const r of result) {
      if (r.parentId) {
        // Add to existing parent
        const parentShape = editor.getShape(r.parentId);
        if (!parentShape) continue;

        addMultipleIdeasWithIds([r], parentShape, editor);
      } else {
        console.log('adding standalone', r);
        // Add to standalone
        addStandaloneIdeas([r], editor);
      }
    }
  },
};

// Function to add multiple ideas using server-generated IDs
function addMultipleIdeasWithIds(
  results: BrainstormResult[],
  parentShape: TLShape,
  editor: Editor
) {
  const parentBounds = editor.getShapePageBounds(parentShape.id)!;

  // Process each result individually
  for (const result of results) {
    if (result.type !== 'add-text') continue;

    // Use the server-generated ID instead of creating a new one
    const textShapeID =
      result.id || (`shape:${crypto.randomUUID()}` as TLShapeId);
    const arrowShapeID = `shape:${crypto.randomUUID()}` as TLShapeId;

    // Find optimal position for this idea
    const { x: newTextX, y: newTextY } = findOptimalPosition(
      parentShape,
      editor
    );

    // Calculate box size based on text content
    const boxSize = (() => {
      const CHARS_PER_LINE = 40;
      const LINE_HEIGHT = 20;

      const numLines = Math.ceil(result.text.length / CHARS_PER_LINE);
      const height = Math.max(numLines * LINE_HEIGHT, 40);
      const width = Math.min(result.text.length * 8, CHARS_PER_LINE * 10);

      return {
        width: Math.max(width, 150),
        height: Math.max(height, 40),
      };
    })();

    // Create the text shape with the server-generated ID
    editor.createShapes([
      {
        id: textShapeID,
        type: 'geo',
        props: {
          text: result.text,
          geo: 'rectangle',
          h: boxSize.height,
          w: boxSize.width,
        },
        x: newTextX,
        y: newTextY,
      },
    ]);

    // Get the bounds of the new text shape
    const textBounds = editor.getShapePageBounds(textShapeID)!;

    // Determine the best arrow connection points
    const dx = textBounds.center.x - parentBounds.center.x;
    const dy = textBounds.center.y - parentBounds.center.y;
    const angle = Math.atan2(dy, dx);

    // Calculate parent connection point based on angle
    const parentPosForArrow = {
      x: parentBounds.center.x,
      y: parentBounds.center.y,
    };

    // Create the arrow
    editor.createShapes([
      {
        id: arrowShapeID,
        type: 'arrow',
        props: {
          dash: 'draw',
          size: 'm',
          fill: 'none',
          color: 'black',
          bend: 0,
          start: parentPosForArrow,
          end: {
            x: textBounds.center.x,
            y: textBounds.center.y,
          },
          arrowheadStart: 'none',
          arrowheadEnd: 'arrow',
        },
      },
    ]);

    // Create bindings
    editor.createBindings([
      // parent to arrow binding
      {
        fromId: arrowShapeID,
        toId: parentShape.id,
        type: 'arrow',
        props: {
          terminal: 'start',
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact: false,
        },
      },
      // arrow to new text shape binding
      {
        fromId: arrowShapeID,
        toId: textShapeID,
        type: 'arrow',
        props: {
          terminal: 'end',
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact: false,
        },
      },
    ]);

    // If there are predictions, create prediction shapes
    if (result.predictions && result.predictions.length > 0) {
      createPredictionShapes(textShapeID, result.predictions, editor);
    }
  }
}

// Function to add standalone ideas (without a parent)
function addStandaloneIdeas(results: BrainstormResult[], editor: Editor) {
  // Get the current viewport center
  const viewport = editor.getViewportPageBounds();
  const centerX = viewport.center.x;
  const centerY = viewport.center.y;

  // Arrange standalone ideas in a grid or circle around the viewport center
  results.forEach((result, index) => {
    // Use the server-generated ID
    const textShapeID =
      result.id || (`shape:${crypto.randomUUID()}` as TLShapeId);

    // Calculate position in a circle or grid
    const angle = (index / results.length) * Math.PI * 2;
    const radius = 200; // Distance from center
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    // Calculate box size
    const boxSize = (() => {
      const CHARS_PER_LINE = 40;
      const LINE_HEIGHT = 20;

      const numLines = Math.ceil(result.text.length / CHARS_PER_LINE);
      const height = Math.max(numLines * LINE_HEIGHT, 40);
      const width = Math.min(result.text.length * 8, CHARS_PER_LINE * 10);

      return {
        width: Math.max(width, 150),
        height: Math.max(height, 40),
      };
    })();

    // Create the shape
    editor.createShapes<RichTextShape>([
      {
        id: textShapeID,
        type: 'rich-text',
        props: {
          text: result.text,
          h: boxSize.height,
          w: boxSize.width,
        },
        x,
        y,
      },
    ]);

    // If there are predictions, create prediction shapes
    if (result.predictions && result.predictions.length > 0) {
      createPredictionShapes(textShapeID, result.predictions, editor);
    }
  });
}

// Helper function to create prediction shapes
function createPredictionShapes(
  parentId: TLShapeId,
  predictions: string[],
  editor: Editor
) {
  // Implementation for creating prediction shapes
  // This would depend on your existing prediction shape implementation
}

// Function to find the optimal position for a new shape
function findOptimalPosition(parentShape: TLShape, editor: Editor) {
  // Get the parent shape's position
  const parentBounds = editor.getShapePageBounds(parentShape.id)!;
  const parentX = parentBounds.center.x;
  const parentY = parentBounds.center.y;

  // Find all shapes that are connected to the parent (children)
  const childBindings = editor.getBindingsInvolvingShape(
    parentShape.id,
    'arrow'
  ) as TLArrowBinding[];

  // Calculate existing angles of arrows connected to the parent
  const existingAngles: number[] = [];
  const childAngles: number[] = [];
  const parentAngles: number[] = [];

  childBindings.forEach((binding) => {
    // Get the arrow shape
    const arrowId =
      binding.props.terminal === 'start' ? binding.toId : binding.fromId;
    const arrow = editor.getShape(arrowId);
    if (!arrow || arrow.type !== 'arrow') return;

    // Get the other shape connected to the arrow
    const otherShapeId =
      binding.props.terminal === 'start' ? binding.fromId : binding.toId;
    if (otherShapeId === parentShape.id) return; // Skip if it's the parent itself

    const otherShape = editor.getShape(otherShapeId);
    if (!otherShape) return;

    const otherBounds = editor.getShapePageBounds(otherShapeId)!;

    // Calculate angle from parent to child
    const dx = otherBounds.center.x - parentBounds.center.x;
    const dy = otherBounds.center.y - parentBounds.center.y;
    const angle = Math.atan2(dy, dx);

    existingAngles.push(angle);

    // Track whether this is a child or parent connection
    if (
      binding.props.terminal === 'start' &&
      binding.fromId === parentShape.id
    ) {
      // Arrow going from parent to child
      childAngles.push(angle);
    } else if (
      binding.props.terminal === 'end' &&
      binding.toId === parentShape.id
    ) {
      // Arrow coming into parent
      parentAngles.push(angle);
    }
  });

  // Base distance from parent
  const baseDistance = 300;

  // Find the best angle with the least crowding
  let bestAngle = 0;
  let maxScore = -Infinity;

  // Try 24 different angles (every 15 degrees)
  for (let i = 0; i < 24; i++) {
    const testAngle = (i * Math.PI) / 12;
    let score = 0;

    // Prefer angles where there are fewer existing connections
    existingAngles.forEach((existingAngle) => {
      // Calculate angular distance (considering the circular nature)
      let angleDiff = Math.abs(testAngle - existingAngle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

      // Higher score for angles further from existing ones
      score += angleDiff;
    });

    // Bias towards the opposite direction of incoming arrows
    parentAngles.forEach((parentAngle) => {
      // Opposite angle would be parentAngle + PI
      const oppositeAngle = (parentAngle + Math.PI) % (2 * Math.PI);
      let angleDiff = Math.abs(testAngle - oppositeAngle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

      // Bonus for being close to the opposite of incoming arrows
      score -= angleDiff * 2; // Higher weight to this factor
    });

    // Bias towards areas where there are already children
    childAngles.forEach((childAngle) => {
      let angleDiff = Math.abs(testAngle - childAngle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

      // Small bonus for being in the same general area as existing children
      if (angleDiff < Math.PI / 4) {
        // Within 45 degrees
        score += 0.5;
      }
    });

    // Add some randomness to prevent predictable patterns
    score += Math.random() * 0.5;

    if (score > maxScore) {
      maxScore = score;
      bestAngle = testAngle;
    }
  }

  // Add a small random variation to the chosen angle (±15 degrees)
  const finalAngle = bestAngle + (Math.random() - 0.5) * (Math.PI / 6);

  // Calculate position using the chosen angle
  let finalX = parentX + Math.cos(finalAngle) * baseDistance;
  let finalY = parentY + Math.sin(finalAngle) * baseDistance;

  // Check for overlaps with existing shapes and adjust if needed
  let hasOverlap = true;
  let attempts = 0;
  const maxAttempts = 12;
  const allShapes = editor.getCurrentPageShapes();

  // Try to find a position without overlaps by increasing distance
  while (hasOverlap && attempts < maxAttempts) {
    hasOverlap = false;

    // Create a temporary bounds for our new shape (approximate size)
    const newShapeBounds = {
      minX: finalX - 100,
      minY: finalY - 50,
      maxX: finalX + 100,
      maxY: finalY + 50,
      width: 200,
      height: 100,
    };

    // Check for overlaps with existing shapes
    for (const shape of allShapes) {
      if (shape.id === parentShape.id) continue;

      const shapeBounds = editor.getShapePageBounds(shape.id);
      if (!shapeBounds) continue;

      // Simple overlap check
      const overlap = !(
        newShapeBounds.minX > shapeBounds.maxX ||
        newShapeBounds.maxX < shapeBounds.minX ||
        newShapeBounds.minY > shapeBounds.maxY ||
        newShapeBounds.maxY < shapeBounds.minY
      );

      if (overlap) {
        hasOverlap = true;
        // Increase distance to avoid overlap
        const currentDistance = baseDistance + attempts * 50;
        finalX = parentX + Math.cos(finalAngle) * (currentDistance + 50);
        finalY = parentY + Math.sin(finalAngle) * (currentDistance + 50);
        break;
      }
    }

    attempts++;
  }

  return { x: finalX, y: finalY };
}

/**
 * Calculates positions for nodes in a radial tree layout
 * @param rootX - X coordinate of the root node
 * @param rootY - Y coordinate of the root node
 * @param nodes - Array of nodes to position
 * @param parentChildMap - Map of parent IDs to arrays of child IDs
 * @param nodeIdToIndex - Map of node IDs to their index in the nodes array
 * @param options - Configuration options
 */
function calculateRadialTreeLayout(
  rootX: number,
  rootY: number,
  nodes: any[],
  parentChildMap: Map<string, string[]>,
  nodeIdToIndex: Map<string, number>,
  options: {
    levelDistance?: number; // Distance between tree levels
    siblingDistance?: number; // Minimum distance between siblings
    angleSpread?: number; // Angle in radians for distributing children
    startAngle?: number; // Starting angle in radians
  } = {}
) {
  // Default options
  const {
    levelDistance = 200,
    siblingDistance = 100,
    angleSpread = 2 * Math.PI,
    startAngle = -Math.PI / 2, // Start from top (-90 degrees)
  } = options;

  // Result array with positions
  const positions: Array<{ id: string; x: number; y: number }> = [];

  // Process the tree recursively
  function processNode(
    nodeId: string,
    level: number,
    angle: number,
    angleRange: number,
    parentX: number,
    parentY: number
  ) {
    const nodeIndex = nodeIdToIndex.get(nodeId);
    if (nodeIndex === undefined) return;

    const node = nodes[nodeIndex];

    // Calculate position based on level and angle
    const distance = level * levelDistance;
    const x = parentX + Math.cos(angle) * distance;
    const y = parentY + Math.sin(angle) * distance;

    // Store the position
    positions.push({
      id: nodeId,
      x,
      y,
    });

    // Process children
    const children = parentChildMap.get(nodeId) || [];
    if (children.length > 0) {
      const childAngleStep = angleRange / children.length;
      let childStartAngle = angle - angleRange / 2;

      children.forEach((childId, index) => {
        const childAngle =
          childStartAngle + index * childAngleStep + childAngleStep / 2;
        processNode(
          childId,
          level + 1,
          childAngle,
          childAngleStep * 0.95, // Slightly reduce angle range for children
          x,
          y
        );
      });
    }
  }

  // Start with the root node
  const rootId = nodes[0]?.id;
  if (rootId) {
    processNode(rootId, 0, startAngle, angleSpread, rootX, rootY);
  }

  // Check for overlaps and adjust if needed
  resolveOverlaps(positions, nodes, nodeIdToIndex, siblingDistance);

  return positions;
}

/**
 * Resolves overlaps between nodes by adjusting positions
 */
function resolveOverlaps(
  positions: Array<{ id: string; x: number; y: number }>,
  nodes: any[],
  nodeIdToIndex: Map<string, number>,
  minDistance: number
) {
  const iterations = 30;
  const dampingFactor = 0.9;

  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const nodeA = positions[i];
        const nodeB = positions[j];

        const dx = nodeB.x - nodeA.x;
        const dy = nodeB.y - nodeA.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          moved = true;

          // Calculate repulsion force
          const force = (minDistance - distance) / distance;
          const moveX = dx * force * 0.5 * dampingFactor;
          const moveY = dy * force * 0.5 * dampingFactor;

          // Apply forces in opposite directions
          nodeA.x -= moveX;
          nodeA.y -= moveY;
          nodeB.x += moveX;
          nodeB.y += moveY;
        }
      }
    }

    if (!moved) break;
  }
}

/*

shapes [
  {
    x: 623.0673339504222,
    y: 241.6817821676629,
    rotation: 0,
    isLocked: false,
    opacity: 1,
    meta: {},
    id: 'shape:ryxKF1dB6u9kl0KBsKJ9_',
    type: 'text',
    props: {
      color: 'black',
      size: 'm',
      w: 260.109375,
      text: 'Vertical B2B AI Idea',
      font: 'draw',
      textAlign: 'start',
      autoSize: true,
      scale: 1.8823495191002768
    },
    parentId: 'page:dXH7ox3D9EWEeDzCPE_iN',
    index: 'a81i5',
    typeName: 'shape'
  },
  {
    x: 884.419716361837,
    y: 213.473483993775,
    rotation: 0,
    isLocked: false,
    opacity: 1,
    meta: {},
    id: 'shape:QtImZWJbiLgDYLXcOzaZo',
    type: 'arrow',
    props: {
      dash: 'draw',
      size: 'm',
      fill: 'none',
      color: 'black',
      labelColor: 'black',
      bend: 0,
      start: [Object],
      end: [Object],
      arrowheadStart: 'none',
      arrowheadEnd: 'arrow',
      text: '',
      labelPosition: 0.5,
      font: 'draw',
      scale: 1
    },
    parentId: 'page:dXH7ox3D9EWEeDzCPE_iN',
    index: 'aK8G5',
    typeName: 'shape'
  },
  {
    x: 732.9664237043158,
    y: -70.8691796689522,
    rotation: 0,
    isLocked: false,
    opacity: 1,
    meta: {},
    id: 'shape:xzS2NLUCOgZId4bZ0aroC',
    type: 'text',
    props: {
      color: 'black',
      size: 'm',
      w: 105.046875,
      text: 'Logistics',
      font: 'draw',
      textAlign: 'start',
      autoSize: true,
      scale: 2.519366614154775
    },
    parentId: 'page:dXH7ox3D9EWEeDzCPE_iN',
    index: 'aJ0mM',
    typeName: 'shape'
  }
]

*/
