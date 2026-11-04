import React, { useRef, useCallback, useMemo } from 'react';

const CARD_WIDTH = 280;
const CARD_HEIGHT = 120;

export default function Minimap({
  cards,
  categories,
  shapes = [],
  viewOffset,
  zoom,
  viewportWidth,
  viewportHeight,
  onNavigate,
}) {
  const minimapRef = useRef(null);

  // Calculate bounds of all elements to determine scale
  const bounds = useMemo(() => {
    if (cards.length === 0 && categories.length === 0 && shapes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    cards.forEach(card => {
      minX = Math.min(minX, card.x);
      minY = Math.min(minY, card.y);
      maxX = Math.max(maxX, card.x + CARD_WIDTH);
      maxY = Math.max(maxY, card.y + CARD_HEIGHT);
    });

    categories.forEach(cat => {
      minX = Math.min(minX, cat.x);
      minY = Math.min(minY, cat.y);
      maxX = Math.max(maxX, cat.x + cat.width);
      maxY = Math.max(maxY, cat.y + cat.height);
    });

    shapes.forEach(shape => {
      minX = Math.min(minX, shape.x);
      minY = Math.min(minY, shape.y);
      maxX = Math.max(maxX, shape.x + (shape.width || 120));
      maxY = Math.max(maxY, shape.y + (shape.height || 80));
    });

    // Add padding
    const padding = 100;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
    };
  }, [cards, categories, shapes]);

  // Calculate minimap dimensions and scale
  const minimapWidth = 188; // Fit in sidebar (220px - padding)
  const minimapHeight = 140;

  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  const scale = Math.min(minimapWidth / contentWidth, minimapHeight / contentHeight);

  // Transform coordinates to minimap space
  const toMinimapX = (x) => (x - bounds.minX) * scale;
  const toMinimapY = (y) => (y - bounds.minY) * scale;

  // Calculate viewport rectangle in minimap (smaller, centered indicator)
  const fullViewportW = (viewportWidth / zoom) * scale;
  const fullViewportH = (viewportHeight / zoom) * scale;
  const indicatorSize = Math.min(fullViewportW, fullViewportH, 20); // Small fixed-ish size
  const viewportCenterX = toMinimapX(-viewOffset.x / zoom + viewportWidth / zoom / 2);
  const viewportCenterY = toMinimapY(-viewOffset.y / zoom + viewportHeight / zoom / 2);
  const viewportX = viewportCenterX - indicatorSize / 2;
  const viewportY = viewportCenterY - indicatorSize / 2;

  // Handle click on minimap to navigate
  const handleClick = useCallback((e) => {
    const rect = minimapRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert click position to board coordinates
    const boardX = (clickX / scale) + bounds.minX;
    const boardY = (clickY / scale) + bounds.minY;

    // Center the viewport on the clicked position
    const newOffsetX = -(boardX - (viewportWidth / zoom) / 2) * zoom;
    const newOffsetY = -(boardY - (viewportHeight / zoom) / 2) * zoom;

    onNavigate({ x: newOffsetX, y: newOffsetY });
  }, [scale, bounds, viewportWidth, viewportHeight, zoom, onNavigate]);

  // Handle click on a specific element
  const handleElementClick = useCallback((e, element, isCategory) => {
    e.stopPropagation();

    const elementWidth = isCategory ? element.width : CARD_WIDTH;
    const elementHeight = isCategory ? element.height : CARD_HEIGHT;
    const centerX = element.x + elementWidth / 2;
    const centerY = element.y + elementHeight / 2;

    // Center the viewport on the element
    const newOffsetX = -(centerX - (viewportWidth / zoom) / 2) * zoom;
    const newOffsetY = -(centerY - (viewportHeight / zoom) / 2) * zoom;

    onNavigate({ x: newOffsetX, y: newOffsetY });
  }, [viewportWidth, viewportHeight, zoom, onNavigate]);

  if (cards.length === 0 && categories.length === 0 && shapes.length === 0) {
    return (
      <div className="minimap-container">
        <div className="minimap-label">Minimap</div>
        <div className="minimap-empty">No items</div>
      </div>
    );
  }

  return (
    <div className="minimap-container">
      <div className="minimap-label">Minimap</div>
      <svg
        ref={minimapRef}
        className="minimap"
        width={minimapWidth}
        height={minimapHeight}
        onClick={handleClick}
      >
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={minimapWidth}
          height={minimapHeight}
          fill="var(--bg-tertiary)"
          rx={4}
        />

        {/* Categories */}
        {categories.map(cat => (
          <rect
            key={cat.id}
            x={toMinimapX(cat.x)}
            y={toMinimapY(cat.y)}
            width={cat.width * scale}
            height={cat.height * scale}
            fill={cat.color + '40'}
            stroke={cat.color}
            strokeWidth={1}
            rx={2}
            className="minimap-element"
            onClick={(e) => handleElementClick(e, cat, true)}
          />
        ))}

        {/* Shapes */}
        {shapes.map(shape => (
          <rect
            key={shape.id}
            x={toMinimapX(shape.x)}
            y={toMinimapY(shape.y)}
            width={(shape.width || 120) * scale}
            height={(shape.height || 80) * scale}
            fill={shape.color || 'var(--bg-tertiary)'}
            stroke="var(--text-muted)"
            strokeWidth={0.5}
            strokeDasharray="2 1"
            rx={shape.type === 'circle' ? 999 : shape.type === 'rounded-rect' ? 3 : 0}
            className="minimap-element"
            onClick={(e) => handleElementClick(e, shape, true)}
          />
        ))}

        {/* Cards */}
        {cards.map(card => (
          <rect
            key={card.id}
            x={toMinimapX(card.x)}
            y={toMinimapY(card.y)}
            width={CARD_WIDTH * scale}
            height={CARD_HEIGHT * scale}
            fill={card.color || 'var(--bg-secondary)'}
            stroke="var(--border-color)"
            strokeWidth={0.5}
            rx={1}
            className="minimap-element"
            onClick={(e) => handleElementClick(e, card, false)}
          />
        ))}

        {/* Viewport indicator (small centered marker) */}
        <rect
          x={Math.max(0, Math.min(viewportX, minimapWidth - indicatorSize))}
          y={Math.max(0, Math.min(viewportY, minimapHeight - indicatorSize))}
          width={indicatorSize}
          height={indicatorSize}
          fill="var(--accent)"
          fillOpacity={0.3}
          stroke="var(--accent)"
          strokeWidth={2}
          rx={3}
          className="minimap-viewport"
        />
      </svg>
    </div>
  );
}
