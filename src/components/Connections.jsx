import React, { useMemo } from 'react';

// Default card dimensions for calculating connection points
const CARD_WIDTH = 280;
const CARD_HEIGHT_ESTIMATE = 120;

// Get dimensions for an element (card or category)
function getElementDimensions(element) {
  // Categories have explicit width/height, cards use fixed dimensions
  return {
    width: element.width || CARD_WIDTH,
    height: element.height || CARD_HEIGHT_ESTIMATE,
  };
}

function getElementCenter(element) {
  const dims = getElementDimensions(element);
  return {
    x: element.x + dims.width / 2,
    y: element.y + dims.height / 2,
  };
}

function getConnectionPoints(fromElement, toElement) {
  const from = getElementCenter(fromElement);
  const to = getElementCenter(toElement);
  const fromDims = getElementDimensions(fromElement);
  const toDims = getElementDimensions(toElement);

  // Determine which sides to connect based on relative positions
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  let fromPoint, toPoint;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    if (dx > 0) {
      fromPoint = { x: fromElement.x + fromDims.width, y: from.y };
      toPoint = { x: toElement.x, y: to.y };
    } else {
      fromPoint = { x: fromElement.x, y: from.y };
      toPoint = { x: toElement.x + toDims.width, y: to.y };
    }
  } else {
    // Vertical connection
    if (dy > 0) {
      fromPoint = { x: from.x, y: fromElement.y + fromDims.height };
      toPoint = { x: to.x, y: toElement.y };
    } else {
      fromPoint = { x: from.x, y: fromElement.y };
      toPoint = { x: to.x, y: toElement.y + toDims.height };
    }
  }

  return { fromPoint, toPoint };
}

function generateSquigglyPath(fromPoint, toPoint) {
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Control point offset for the curve (makes it squiggly)
  const curvature = Math.min(distance * 0.3, 80);

  // Calculate perpendicular offset for the curve
  const midX = (fromPoint.x + toPoint.x) / 2;
  const midY = (fromPoint.y + toPoint.y) / 2;

  // Add some waviness based on the angle
  const angle = Math.atan2(dy, dx);
  const perpX = Math.sin(angle) * curvature;
  const perpY = -Math.cos(angle) * curvature;

  // Create a smooth curve with a slight wave
  const cp1x = fromPoint.x + dx * 0.25 + perpX * 0.5;
  const cp1y = fromPoint.y + dy * 0.25 + perpY * 0.5;
  const cp2x = fromPoint.x + dx * 0.75 - perpX * 0.5;
  const cp2y = fromPoint.y + dy * 0.75 - perpY * 0.5;

  return `M ${fromPoint.x} ${fromPoint.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toPoint.x} ${toPoint.y}`;
}

const DEFAULT_COLOR = '#a0a0a0';

function Connections({
  connections,
  cards,
  categories,
  shapes = [],
  connectingFrom,
  mousePosition,
  getViewportCenter,
  onDeleteConnection,
  onNavigateToElement,
}) {
  // Memoize expensive lookups
  const elementMap = useMemo(() => new Map([
    ...cards.map(card => [card.id, card]),
    ...categories.map(cat => [cat.id, cat]),
    ...shapes.map(shape => [shape.id, shape]),
  ]), [cards, categories, shapes]);

  const shapeIds = useMemo(
    () => new Set(shapes.map(s => s.id)),
    [shapes]
  );

  const isShapeConnection = (conn) =>
    shapeIds.has(conn.fromCardId) || shapeIds.has(conn.toCardId);

  // Both endpoints are shapes (no cards/categories involved)
  const isShapeOnlyConnection = (conn) =>
    shapeIds.has(conn.fromCardId) && shapeIds.has(conn.toCardId);

  const connectingFromIsShape = connectingFrom && shapeIds.has(connectingFrom);

  return (
    <svg className="connections-layer">
      <defs>
        {/* Stick arrowhead marker for shape connections */}
        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polyline points="0 0, 6 3, 0 6" fill="none" stroke="#a0a0a0" strokeWidth="1.5" />
        </marker>

        {/* Generate gradient definitions for each connection */}
        {connections.map(conn => {
          const fromElement = elementMap.get(conn.fromCardId);
          const toElement = elementMap.get(conn.toCardId);
          if (!fromElement || !toElement) return null;

          const fromColor = fromElement.color || DEFAULT_COLOR;
          const toColor = toElement.color || DEFAULT_COLOR;
          const fromCenter = getElementCenter(fromElement);
          const toCenter = getElementCenter(toElement);

          // For shape connections, also create a colored arrowhead marker
          if (isShapeConnection(conn)) {
            return (
              <React.Fragment key={`gradient-${conn.id}`}>
                <linearGradient
                  id={`gradient-${conn.id}`}
                  gradientUnits="userSpaceOnUse"
                  x1={fromCenter.x}
                  y1={fromCenter.y}
                  x2={toCenter.x}
                  y2={toCenter.y}
                >
                  <stop offset="0%" stopColor={fromColor} />
                  <stop offset="100%" stopColor={toColor} />
                </linearGradient>
                <marker
                  id={`arrowhead-${conn.id}`}
                  markerWidth="6"
                  markerHeight="6"
                  refX="6"
                  refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polyline points="0 0, 6 3, 0 6" fill="none" stroke={toColor} strokeWidth="1.5" />
                </marker>
              </React.Fragment>
            );
          }

          return (
            <linearGradient
              key={`gradient-${conn.id}`}
              id={`gradient-${conn.id}`}
              gradientUnits="userSpaceOnUse"
              x1={fromCenter.x}
              y1={fromCenter.y}
              x2={toCenter.x}
              y2={toCenter.y}
            >
              <stop offset="0%" stopColor={fromColor} />
              <stop offset="100%" stopColor={toColor} />
            </linearGradient>
          );
        })}

        {/* Gradient for in-progress connection */}
        {connectingFrom && (() => {
          const fromElement = elementMap.get(connectingFrom);
          const fromCenter = fromElement ? getElementCenter(fromElement) : { x: 0, y: 0 };
          return (
            <linearGradient
              id="gradient-connecting"
              gradientUnits="userSpaceOnUse"
              x1={fromCenter.x}
              y1={fromCenter.y}
              x2={mousePosition.x}
              y2={mousePosition.y}
            >
              <stop offset="0%" stopColor={fromElement?.color || DEFAULT_COLOR} />
              <stop offset="100%" stopColor={DEFAULT_COLOR} stopOpacity="0.5" />
            </linearGradient>
          );
        })()}
      </defs>

      {/* Render existing connections */}
      {connections.map(conn => {
        const fromElement = elementMap.get(conn.fromCardId);
        const toElement = elementMap.get(conn.toCardId);
        if (!fromElement || !toElement) return null;

        const { fromPoint, toPoint } = getConnectionPoints(fromElement, toElement);
        const shapeConn = isShapeConnection(conn);

        // Straight line for shape connections, squiggly for others
        const path = shapeConn
          ? `M ${fromPoint.x} ${fromPoint.y} L ${toPoint.x} ${toPoint.y}`
          : generateSquigglyPath(fromPoint, toPoint);

        const shapeOnly = isShapeOnlyConnection(conn);

        const handleClick = (e) => {
          e.stopPropagation();
          if (shapeOnly) return; // shape-only: no action on single click
          if (!onNavigateToElement || !getViewportCenter) return;
          const viewportCenter = getViewportCenter();
          // Navigate to whichever end is farther from the viewport center
          const fromCenter = getElementCenter(fromElement);
          const toCenter = getElementCenter(toElement);
          const distFrom = Math.sqrt((fromCenter.x - viewportCenter.x) ** 2 + (fromCenter.y - viewportCenter.y) ** 2);
          const distTo = Math.sqrt((toCenter.x - viewportCenter.x) ** 2 + (toCenter.y - viewportCenter.y) ** 2);
          // If we're very close to one endpoint, always navigate to the other
          const NEAR_THRESHOLD = 50;
          if (distFrom < NEAR_THRESHOLD) {
            onNavigateToElement(conn.toCardId);
          } else if (distTo < NEAR_THRESHOLD) {
            onNavigateToElement(conn.fromCardId);
          } else {
            onNavigateToElement(distTo >= distFrom ? conn.toCardId : conn.fromCardId);
          }
        };

        const handleContextMenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          onDeleteConnection(conn.id);
        };

        return (
          <g key={conn.id} className="connection-group">
            {/* Invisible wider path for easier clicking */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth="20"
              className="connection-hitarea"
              style={{ cursor: shapeOnly ? 'default' : 'pointer' }}
              onClick={handleClick}
              onContextMenu={handleContextMenu}
            />
            {/* Visible path */}
            <path
              d={path}
              fill="none"
              stroke={`url(#gradient-${conn.id})`}
              strokeWidth="3"
              strokeLinecap="round"
              className="connection-line"
              markerEnd={shapeConn ? `url(#arrowhead-${conn.id})` : undefined}
            />
          </g>
        );
      })}

      {/* Render in-progress connection while dragging */}
      {connectingFrom && mousePosition && (() => {
        const fromElement = elementMap.get(connectingFrom);
        const fromCenter = fromElement ? getElementCenter(fromElement) : { x: 0, y: 0 };

        // Straight dashed line for shapes, squiggly for others
        const path = connectingFromIsShape
          ? `M ${fromCenter.x} ${fromCenter.y} L ${mousePosition.x} ${mousePosition.y}`
          : generateSquigglyPath(fromCenter, mousePosition);

        return (
          <path
            d={path}
            fill="none"
            stroke="url(#gradient-connecting)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="8 4"
            className="connection-line connecting"
            markerEnd={connectingFromIsShape ? 'url(#arrowhead)' : undefined}
          />
        );
      })()}
    </svg>
  );
}

export default React.memo(Connections);
