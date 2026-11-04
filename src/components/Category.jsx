import React, { useState, useRef, useEffect, useCallback } from 'react';

const CATEGORY_COLORS = [
  '#FF6B6B', // Coral
  '#FFA94D', // Mango
  '#FFE066', // Lemon sherbet
  '#63E6BE', // Mint
  '#4ECDC4', // Turquoise
  '#74B9FF', // Ocean blue
  '#A29BFE', // Amethyst
  '#F78FB3', // Hibiscus
];

// Card dimensions for overlap detection
const CARD_WIDTH = 240;
const CARD_HEIGHT = 120;

function Category({
  category,
  zoom,
  cards,
  shapes,
  isSelected,
  isConnecting,
  onSelect,
  onUpdate,
  onUpdateCard,
  onUpdateShape,
  onDelete,
  onStartConnection,
  onEndConnection,
}) {
  // Stable wrappers binding category.id
  const select = useCallback(() => onSelect(category.id), [category.id, onSelect]);
  const update = useCallback((updates) => onUpdate(category.id, updates), [category.id, onUpdate]);
  const deleteSelf = useCallback(() => onDelete(category.id), [category.id, onDelete]);
  const startConn = useCallback((e) => onStartConnection(category.id, e), [category.id, onStartConnection]);
  const endConn = useCallback(() => onEndConnection(category.id), [category.id, onEndConnection]);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(category.title);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, catX: 0, catY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, catX: 0, catY: 0 });
  const internalCardsRef = useRef([]);
  const internalShapesRef = useRef([]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditValue(category.title);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== category.title) {
      update({ title: editValue.trim() });
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(category.title);
    }
  };

  // Check if a card's center is inside the category bounds
  const isCardInside = (card) => {
    const cardCenterX = card.x + CARD_WIDTH / 2;
    const cardCenterY = card.y + CARD_HEIGHT / 2;
    return (
      cardCenterX >= category.x &&
      cardCenterX <= category.x + category.width &&
      cardCenterY >= category.y &&
      cardCenterY <= category.y + category.height
    );
  };

  const handleMouseDown = (e) => {
    if (e.target.classList.contains('category-resize-handle')) return;
    if (e.target.classList.contains('category-color-btn')) return;
    if (e.target.closest('.category-color-picker')) return;
    if (e.target.closest('.category-connection-handle')) return;
    if (isEditing) return;

    e.stopPropagation();
    select();
    setShowColorPicker(false);
    setIsDragging(true);

    // Capture cards explicitly assigned to this category at drag start
    internalCardsRef.current = cards
      .filter(card => card.categoryId === category.id)
      .map(card => ({
        id: card.id,
        startX: card.x,
        startY: card.y,
      }));

    // Capture shapes explicitly assigned to this category at drag start
    internalShapesRef.current = (shapes || [])
      .filter(shape => shape.categoryId === category.id)
      .map(shape => ({
        id: shape.id,
        startX: shape.x,
        startY: shape.y,
      }));

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      catX: category.x,
      catY: category.y,
    };
  };

  const handleResizeMouseDown = (e, handle) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: category.width,
      height: category.height,
      catX: category.x,
      catY: category.y,
    };
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e) => {
      const z = zoom || 1;
      if (isDragging) {
        const dx = (e.clientX - dragStartRef.current.x) / z;
        const dy = (e.clientY - dragStartRef.current.y) / z;
        update({
          x: dragStartRef.current.catX + dx,
          y: dragStartRef.current.catY + dy,
        });

        // Move internal cards along with the category
        internalCardsRef.current.forEach(({ id, startX, startY }) => {
          onUpdateCard(id, {
            x: startX + dx,
            y: startY + dy,
          });
        });

        // Move internal shapes along with the category
        internalShapesRef.current.forEach(({ id, startX, startY }) => {
          onUpdateShape(id, {
            x: startX + dx,
            y: startY + dy,
          });
        });
      } else if (isResizing) {
        const dx = (e.clientX - resizeStartRef.current.x) / z;
        const dy = (e.clientY - resizeStartRef.current.y) / z;
        const start = resizeStartRef.current;

        let newX = start.catX;
        let newY = start.catY;
        let newWidth = start.width;
        let newHeight = start.height;

        if (resizeHandle.includes('e')) {
          newWidth = Math.max(100, start.width + dx);
        }
        if (resizeHandle.includes('w')) {
          newWidth = Math.max(100, start.width - dx);
          newX = start.catX + (start.width - newWidth);
        }
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(60, start.height + dy);
        }
        if (resizeHandle.includes('n')) {
          newHeight = Math.max(60, start.height - dy);
          newY = start.catY + (start.height - newHeight);
        }

        update({ x: newX, y: newY, width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeHandle, update, onUpdateCard, onUpdateShape, zoom]);

  const handleDelete = (e) => {
    e.stopPropagation();
    deleteSelf();
  };

  const handleColorClick = (e) => {
    e.stopPropagation();
    setShowColorPicker(!showColorPicker);
  };

  const handleColorSelect = (color) => {
    update({ color });
    setShowColorPicker(false);
  };

  const handleToggleCollapse = (e) => {
    e.stopPropagation();
    update({ collapsed: !category.collapsed });
  };

  const handleConnectionMouseUp = (e) => {
    if (isConnecting) {
      e.stopPropagation();
      endConn();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`category ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${category.collapsed ? 'collapsed' : ''} ${isConnecting ? 'connect-target' : ''}`}
      style={{
        left: category.x,
        top: category.y,
        width: category.width,
        height: category.height,
        borderColor: category.color,
        backgroundColor: category.color + '15',
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleConnectionMouseUp}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Connection handle on right side */}
      <div
        className="category-connection-handle"
        onMouseDown={startConn}
        title="Drag to connect"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="4" />
        </svg>
      </div>

      <div className="category-header" style={{ backgroundColor: category.color }}>
        <button className="category-collapse-btn" onClick={handleToggleCollapse}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {category.collapsed ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M6 9l6 6 6-6" />
            )}
          </svg>
        </button>

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="category-title-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="category-title">{category.title}</span>
        )}

        {isSelected && (
          <button className="category-color-btn" onClick={handleColorClick}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
            </svg>
          </button>
        )}

        <button className="category-delete-btn" onClick={handleDelete} title="Delete category">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {showColorPicker && (
          <div className="category-color-picker" onClick={(e) => e.stopPropagation()}>
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${category.color === color ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
              />
            ))}
          </div>
        )}
      </div>

      {isSelected && (
        <>
          <div className="category-resize-handle nw" onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
          <div className="category-resize-handle ne" onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
          <div className="category-resize-handle sw" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
          <div className="category-resize-handle se" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
          <div className="category-resize-handle n" onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
          <div className="category-resize-handle s" onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
          <div className="category-resize-handle e" onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
          <div className="category-resize-handle w" onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
        </>
      )}
    </div>
  );
}

export default React.memo(Category);
