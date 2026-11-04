import React, { useState, useRef, useCallback, useEffect } from 'react';

const MIN_WIDTH = 80;
const MIN_HEIGHT = 60;

function getShapeSVG(type, width, height) {
  switch (type) {
    case 'diamond':
      return (
        <polygon
          points={`${width/2},2 ${width-2},${height/2} ${width/2},${height-2} 2,${height/2}`}
          fill="var(--bg-secondary)"
          stroke="currentColor"
          strokeWidth="2"
        />
      );
    case 'circle':
      return (
        <ellipse
          cx={width/2}
          cy={height/2}
          rx={width/2-2}
          ry={height/2-2}
          fill="var(--bg-secondary)"
          stroke="currentColor"
          strokeWidth="2"
        />
      );
    case 'rounded-rect':
      return (
        <rect
          x="2" y="2"
          width={width-4}
          height={height-4}
          rx="16" ry="16"
          fill="var(--bg-secondary)"
          stroke="currentColor"
          strokeWidth="2"
        />
      );
    case 'double-rounded': {
      const r = 16;
      const pinch = width * 0.2;
      const midY = height / 2;
      const l = 2;
      const ri = width - 2;
      const t = 2;
      const b = height - 2;
      return (
        <path
          d={`
            M ${l + r},${t}
            L ${ri - r},${t}
            A ${r},${r} 0 0 1 ${ri},${t + r}
            L ${ri},${midY - r}
            A ${r},${r} 0 0 1 ${ri - r},${midY}
            L ${ri - pinch},${midY}
            L ${l + pinch},${midY}
            L ${l + r},${midY}
            A ${r},${r} 0 0 1 ${l},${midY - r}
            L ${l},${t + r}
            A ${r},${r} 0 0 1 ${l + r},${t}
            Z
            M ${l + r},${midY}
            L ${l + pinch},${midY}
            L ${ri - pinch},${midY}
            L ${ri - r},${midY}
            A ${r},${r} 0 0 1 ${ri},${midY + r}
            L ${ri},${b - r}
            A ${r},${r} 0 0 1 ${ri - r},${b}
            L ${l + r},${b}
            A ${r},${r} 0 0 1 ${l},${b - r}
            L ${l},${midY + r}
            A ${r},${r} 0 0 1 ${l + r},${midY}
            Z
          `}
          fill="var(--bg-secondary)"
          stroke="currentColor"
          strokeWidth="2"
          fillRule="nonzero"
        />
      );
    }
    case 'rectangle':
    default:
      return (
        <rect
          x="2" y="2"
          width={width-4}
          height={height-4}
          fill="var(--bg-secondary)"
          stroke="currentColor"
          strokeWidth="2"
        />
      );
  }
}

function ShapeNode({
  shape,
  zoom,
  isSelected,
  isConnecting,
  categories,
  onSelect,
  onUpdate,
  onDelete,
  onStartConnection,
  onEndConnection,
  onNavigateToLinkedItem,
  onNavigateToElement,
  onOpenPortalPicker,
}) {
  // Stable wrappers binding shape.id
  const select = useCallback(() => onSelect(shape.id), [shape.id, onSelect]);
  const update = useCallback((updates) => onUpdate(shape.id, updates), [shape.id, onUpdate]);
  const deleteSelf = useCallback(() => onDelete(shape.id), [shape.id, onDelete]);
  const endConn = useCallback(() => onEndConnection(shape.id), [shape.id, onEndConnection]);

  const [isDraggingPortal, setIsDraggingPortal] = useState(false);
  const portalDragRef = useRef({ startX: 0, startY: 0, pinX: 0, pinY: 0, moved: false });

  const handlePortalMouseDown = useCallback((e) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const p = shape.portal;
    portalDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      pinX: p?.x ?? -10,
      pinY: p?.y ?? -10,
      moved: false,
    };
    setIsDraggingPortal(true);
  }, [shape.portal]);

  useEffect(() => {
    if (!isDraggingPortal) return;
    const z = zoom || 1;

    const handleMouseMove = (e) => {
      const ref = portalDragRef.current;
      const dx = (e.clientX - ref.startX) / z;
      const dy = (e.clientY - ref.startY) / z;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) ref.moved = true;
      if (ref.moved) {
        update({ portal: { ...shape.portal, x: ref.pinX + dx, y: ref.pinY + dy } });
      }
    };

    const handleMouseUp = () => {
      const wasDrag = portalDragRef.current.moved;
      setIsDraggingPortal(false);
      if (!wasDrag && shape.portal && onNavigateToElement) {
        onNavigateToElement(shape.portal.targetId);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPortal, shape.portal, zoom, update, onNavigateToElement]);

  const handleOpenPortal = useCallback((e) => {
    e.stopPropagation();
    if (onOpenPortalPicker) onOpenPortalPicker(shape.id, 'shape');
  }, [shape.id, onOpenPortalPicker]);

  const handleClearPortal = useCallback((e) => {
    e.stopPropagation();
    update({ portal: null });
  }, [update]);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [isEditingLabelBottom, setIsEditingLabelBottom] = useState(false);
  const shapeRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, shapeX: 0, shapeY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, shapeX: 0, shapeY: 0 });
  const resizeHandleRef = useRef(null);
  const labelRef = useRef(null);
  const labelBottomRef = useRef(null);

  const width = shape.width || 120;
  const height = shape.height || 80;

  // Drag handling
  const handleMouseDown = useCallback((e) => {
    if (e.target.tagName === 'TEXTAREA') return;
    if (e.target.classList.contains('shape-resize-handle')) return;
    if (e.target.classList.contains('shape-connection-handle')) return;
    if (e.button !== 0) return;

    e.stopPropagation();
    select();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      shapeX: shape.x,
      shapeY: shape.y,
    };
  }, [shape.x, shape.y, select]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const z = zoom || 1;
      const dx = (e.clientX - dragStartRef.current.x) / z;
      const dy = (e.clientY - dragStartRef.current.y) / z;
      update({
        x: dragStartRef.current.shapeX + dx,
        y: dragStartRef.current.shapeY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      // Check if shape landed inside a category and assign it
      const shapeWidth = shape.width || 120;
      const shapeHeight = shape.height || 80;
      const shapeCenterX = shape.x + shapeWidth / 2;
      const shapeCenterY = shape.y + shapeHeight / 2;

      let newCategoryId = null;
      for (const category of (categories || [])) {
        if (category.collapsed) continue;
        if (
          shapeCenterX >= category.x &&
          shapeCenterX <= category.x + category.width &&
          shapeCenterY >= category.y &&
          shapeCenterY <= category.y + category.height
        ) {
          newCategoryId = category.id;
          break;
        }
      }

      if (newCategoryId !== shape.categoryId) {
        update({ categoryId: newCategoryId });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onUpdate, zoom, shape.x, shape.y, shape.width, shape.height, shape.categoryId, categories]);

  // Resize handling
  const handleResizeMouseDown = useCallback((e, handle) => {
    e.stopPropagation();
    select();
    setIsResizing(true);
    resizeHandleRef.current = handle;
    const numCols = shape.tableData?.[0]?.length || 1;
    const numRows = shape.tableData?.length || 1;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width,
      height,
      shapeX: shape.x,
      shapeY: shape.y,
      colWidths: shape.colWidths && shape.colWidths.length === numCols
        ? [...shape.colWidths] : null,
      rowHeights: shape.rowHeights && shape.rowHeights.length === numRows
        ? [...shape.rowHeights] : null,
    };
  }, [width, height, shape.x, shape.y, shape.colWidths, shape.rowHeights, shape.tableData, select]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const handle = resizeHandleRef.current;
      const start = resizeStartRef.current;
      const z = zoom || 1;
      const dx = (e.clientX - start.x) / z;
      const dy = (e.clientY - start.y) / z;

      let newWidth = start.width;
      let newHeight = start.height;
      let newX = start.shapeX;
      let newY = start.shapeY;

      if (handle.includes('e')) newWidth = Math.max(MIN_WIDTH, start.width + dx);
      if (handle.includes('w')) {
        newWidth = Math.max(MIN_WIDTH, start.width - dx);
        newX = start.shapeX + (start.width - newWidth);
      }
      if (handle.includes('s')) newHeight = Math.max(MIN_HEIGHT, start.height + dy);
      if (handle.includes('n')) {
        newHeight = Math.max(MIN_HEIGHT, start.height - dy);
        newY = start.shapeY + (start.height - newHeight);
      }

      // Circle enforces equal width/height
      if (shape.type === 'circle') {
        const size = Math.max(newWidth, newHeight);
        newWidth = size;
        newHeight = size;
      }

      const updates = { x: newX, y: newY, width: newWidth, height: newHeight };

      // Proportionally scale table columns/rows
      if (shape.type === 'table' && start.colWidths && newWidth !== start.width) {
        const scale = newWidth / start.width;
        updates.colWidths = start.colWidths.map(w => Math.max(40, Math.round(w * scale)));
      }
      if (shape.type === 'table' && start.rowHeights && newHeight !== start.height) {
        const scale = newHeight / start.height;
        updates.rowHeights = start.rowHeights.map(h => Math.max(24, Math.round(h * scale)));
      }

      update(updates);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeHandleRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, shape.type, onUpdate, zoom]);

  // Label editing
  const handleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    if (shape.type === 'table') return; // table cells handle their own double-click
    if (shape.type === 'double-rounded') {
      const rect = shapeRef.current.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      if (clickY > height / 2) {
        setIsEditingLabelBottom(true);
      } else {
        setIsEditingLabel(true);
      }
    } else {
      setIsEditingLabel(true);
    }
  }, [shape.type, height]);

  useEffect(() => {
    if (isEditingLabel && labelRef.current) {
      labelRef.current.focus();
      labelRef.current.select();
    }
  }, [isEditingLabel]);

  useEffect(() => {
    if (isEditingLabelBottom && labelBottomRef.current) {
      labelBottomRef.current.focus();
      labelBottomRef.current.select();
    }
  }, [isEditingLabelBottom]);

  const handleLabelBlur = useCallback(() => {
    setIsEditingLabel(false);
  }, []);

  const handleLabelChange = useCallback((e) => {
    update({ label: e.target.value });
  }, [onUpdate]);

  const handleLabelKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditingLabel(false);
    }
    if (e.key === 'Escape') {
      setIsEditingLabel(false);
    }
  }, []);

  const handleLabelBottomBlur = useCallback(() => {
    setIsEditingLabelBottom(false);
  }, []);

  const handleLabelBottomChange = useCallback((e) => {
    update({ labelBottom: e.target.value });
  }, [onUpdate]);

  const handleLabelBottomKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditingLabelBottom(false);
    }
    if (e.key === 'Escape') {
      setIsEditingLabelBottom(false);
    }
  }, []);

  // --- Table handlers ---
  const [editingCell, setEditingCell] = useState(null); // { row, col }
  const [draggingDivider, setDraggingDivider] = useState(null); // { axis: 'col'|'row', index, startPos, startSizes }
  const cellInputRef = useRef(null);

  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
    }
  }, [editingCell]);

  const handleCellDoubleClick = useCallback((e, row, col) => {
    e.stopPropagation();
    setEditingCell({ row, col });
  }, []);

  const handleCellChange = useCallback((e) => {
    if (!editingCell || !shape.tableData) return;
    const newData = shape.tableData.map((r, ri) =>
      ri === editingCell.row ? r.map((c, ci) => ci === editingCell.col ? e.target.value : c) : [...r]
    );
    update({ tableData: newData });
  }, [editingCell, shape.tableData, update]);

  const handleCellBlur = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleCellKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setEditingCell(null); }
    if (e.key === 'Escape') setEditingCell(null);
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!shape.tableData) return;
      const rows = shape.tableData.length;
      const cols = shape.tableData[0].length;
      let { row, col } = editingCell;
      if (e.shiftKey) {
        col--;
        if (col < 0) { col = cols - 1; row--; }
        if (row < 0) row = rows - 1;
      } else {
        col++;
        if (col >= cols) { col = 0; row++; }
        if (row >= rows) row = 0;
      }
      setEditingCell({ row, col });
    }
  }, [editingCell, shape.tableData]);

  const handleAddRow = useCallback((e) => {
    e.stopPropagation();
    if (!shape.tableData) return;
    const cols = shape.tableData[0].length;
    const newRow = Array(cols).fill('');
    const newRowHeights = [...(shape.rowHeights || []), 44];
    update({ tableData: [...shape.tableData, newRow], rowHeights: newRowHeights, height: height + 44 });
  }, [shape.tableData, shape.rowHeights, height, update]);

  const handleAddCol = useCallback((e) => {
    e.stopPropagation();
    if (!shape.tableData) return;
    const newData = shape.tableData.map(r => [...r, '']);
    const newColWidths = [...(shape.colWidths || []), 80];
    update({ tableData: newData, colWidths: newColWidths, width: width + 80 });
  }, [shape.tableData, shape.colWidths, width, update]);

  const handleRemoveRow = useCallback((e) => {
    e.stopPropagation();
    if (!shape.tableData || shape.tableData.length <= 1) return;
    const removedHeight = (shape.rowHeights || [])[shape.tableData.length - 1] || 44;
    const newData = shape.tableData.slice(0, -1);
    const newRowHeights = (shape.rowHeights || []).slice(0, -1);
    update({ tableData: newData, rowHeights: newRowHeights, height: Math.max(44, height - removedHeight) });
  }, [shape.tableData, shape.rowHeights, height, update]);

  const handleRemoveCol = useCallback((e) => {
    e.stopPropagation();
    if (!shape.tableData || shape.tableData[0].length <= 1) return;
    const removedWidth = (shape.colWidths || [])[shape.tableData[0].length - 1] || 80;
    const newData = shape.tableData.map(r => r.slice(0, -1));
    const newColWidths = (shape.colWidths || []).slice(0, -1);
    update({ tableData: newData, colWidths: newColWidths, width: Math.max(80, width - removedWidth) });
  }, [shape.tableData, shape.colWidths, width, update]);

  // Divider drag for resizing columns and rows
  const handleDividerMouseDown = useCallback((e, axis, index) => {
    e.stopPropagation();
    e.preventDefault();
    const numCols = shape.tableData?.[0]?.length || 1;
    const numRows = shape.tableData?.length || 1;
    const cw = shape.colWidths && shape.colWidths.length === numCols
      ? shape.colWidths : Array(numCols).fill(Math.floor(width / numCols));
    const rh = shape.rowHeights && shape.rowHeights.length === numRows
      ? shape.rowHeights : Array(numRows).fill(Math.floor(height / numRows));
    const sizes = axis === 'col' ? [...cw] : [...rh];
    setDraggingDivider({
      axis,
      index,
      startPos: axis === 'col' ? e.clientX : e.clientY,
      startSizes: sizes,
      startTotal: axis === 'col' ? width : height,
    });
  }, [shape.colWidths, shape.rowHeights, shape.tableData, width, height]);

  useEffect(() => {
    if (!draggingDivider) return;
    const z = zoom || 1;

    const handleMouseMove = (e) => {
      const { axis, index, startPos, startSizes, startTotal } = draggingDivider;
      const delta = ((axis === 'col' ? e.clientX : e.clientY) - startPos) / z;
      const newSizes = [...startSizes];
      const minSize = axis === 'col' ? 40 : 24;
      newSizes[index] = Math.max(minSize, startSizes[index] + delta);
      const newTotal = newSizes.reduce((a, b) => a + b, 0);

      if (axis === 'col') {
        update({ colWidths: newSizes, width: newTotal });
      } else {
        update({ rowHeights: newSizes, height: newTotal });
      }
    };

    const handleMouseUp = () => {
      setDraggingDivider(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingDivider, zoom, update]);

  // Connection handle
  const handleConnectionMouseDown = useCallback((e) => {
    e.stopPropagation();
    onStartConnection(shape.id, e);
  }, [shape.id, onStartConnection]);

  // Delete on Backspace/Delete when selected
  useEffect(() => {
    if (!isSelected) return;

    const handleKeyDown = (e) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && !isEditingLabel && !isEditingLabelBottom && !editingCell) {
        e.preventDefault();
        deleteSelf();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, isEditingLabel, isEditingLabelBottom, deleteSelf]);

  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  return (
    <div
      ref={shapeRef}
      className={`shape-node ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} ${isConnecting ? 'connect-target' : ''}`}
      style={{
        transform: `translate(${shape.x}px, ${shape.y}px)`,
        width,
        height,
        color: shape.color || 'var(--text-secondary)',
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onMouseUp={isConnecting ? () => endConn() : undefined}
    >
      {shape.type === 'table' && shape.tableData ? (() => {
        const numCols = shape.tableData[0]?.length || 1;
        const numRows = shape.tableData.length;
        const colWidths = shape.colWidths && shape.colWidths.length === numCols
          ? shape.colWidths
          : Array(numCols).fill(Math.floor(width / numCols));
        const rowHeights = shape.rowHeights && shape.rowHeights.length === numRows
          ? shape.rowHeights
          : Array(numRows).fill(Math.floor(height / numRows));

        return (
        <div className="shape-table-wrapper">
          <div
            className="shape-table-grid"
            style={{
              gridTemplateColumns: colWidths.map(w => w + 'px').join(' '),
              gridTemplateRows: rowHeights.map(h => h + 'px').join(' '),
            }}
          >
            {shape.tableData.map((row, ri) =>
              row.map((cell, ci) => (
                <div
                  key={`${ri}-${ci}`}
                  className={`shape-table-cell ${ri === 0 ? 'header' : ''} ${editingCell?.row === ri && editingCell?.col === ci ? 'editing' : ''}`}
                  onDoubleClick={(e) => handleCellDoubleClick(e, ri, ci)}
                >
                  {editingCell?.row === ri && editingCell?.col === ci ? (
                    <textarea
                      ref={cellInputRef}
                      className="shape-table-cell-input"
                      value={cell}
                      onChange={handleCellChange}
                      onBlur={handleCellBlur}
                      onKeyDown={handleCellKeyDown}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="shape-table-cell-text">{cell || '\u00A0'}</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Column dividers */}
          {colWidths.slice(0, -1).map((_, ci) => {
            const left = colWidths.slice(0, ci + 1).reduce((a, b) => a + b, 0);
            return (
              <div
                key={`cdiv-${ci}`}
                className="shape-table-divider col-divider"
                style={{ left: left - 3 }}
                onMouseDown={(e) => handleDividerMouseDown(e, 'col', ci)}
              />
            );
          })}

          {/* Row dividers */}
          {rowHeights.slice(0, -1).map((_, ri) => {
            const top = rowHeights.slice(0, ri + 1).reduce((a, b) => a + b, 0);
            return (
              <div
                key={`rdiv-${ri}`}
                className="shape-table-divider row-divider"
                style={{ top: top - 3 }}
                onMouseDown={(e) => handleDividerMouseDown(e, 'row', ri)}
              />
            );
          })}

          {isSelected && (
            <div className="shape-table-controls">
              <button className="shape-table-btn" onClick={handleAddRow} title="Add row">+Row</button>
              <button className="shape-table-btn" onClick={handleAddCol} title="Add column">+Col</button>
              {shape.tableData.length > 1 && (
                <button className="shape-table-btn danger" onClick={handleRemoveRow} title="Remove last row">-Row</button>
              )}
              {shape.tableData[0].length > 1 && (
                <button className="shape-table-btn danger" onClick={handleRemoveCol} title="Remove last column">-Col</button>
              )}
            </div>
          )}
        </div>
        );
      })() : (
        <svg
          width={width}
          height={height}
          className="shape-svg"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {getShapeSVG(shape.type, width, height)}
          {shape.type === 'double-rounded' ? (
            <>
              <foreignObject x="8" y="4" width={width - 16} height={height / 2 - 8}>
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {isEditingLabel ? (
                    <textarea ref={labelRef} className="shape-label-input" value={shape.label || ''}
                      onChange={handleLabelChange} onBlur={handleLabelBlur} onKeyDown={handleLabelKeyDown}
                      style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'center', resize: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '13px', color: 'var(--text-primary)' }} />
                  ) : (
                    <span className="shape-label" style={{ fontSize: '13px', textAlign: 'center', color: 'var(--text-primary)', userSelect: 'none', wordBreak: 'break-word', lineHeight: 1.3 }}>
                      {shape.label || ''}
                    </span>
                  )}
                </div>
              </foreignObject>
              <foreignObject x="8" y={height / 2 + 4} width={width - 16} height={height / 2 - 8}>
                <div xmlns="http://www.w3.org/1999/xhtml" style={{
                  width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {isEditingLabelBottom ? (
                    <textarea ref={labelBottomRef} className="shape-label-input" value={shape.labelBottom || ''}
                      onChange={handleLabelBottomChange} onBlur={handleLabelBottomBlur} onKeyDown={handleLabelBottomKeyDown}
                      style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'center', resize: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '13px', color: 'var(--text-primary)' }} />
                  ) : (
                    <span className="shape-label" style={{ fontSize: '13px', textAlign: 'center', color: 'var(--text-primary)', userSelect: 'none', wordBreak: 'break-word', lineHeight: 1.3 }}>
                      {shape.labelBottom || ''}
                    </span>
                  )}
                </div>
              </foreignObject>
            </>
          ) : (
            <foreignObject x="8" y="8" width={width - 16} height={height - 16}>
              <div xmlns="http://www.w3.org/1999/xhtml" style={{
                width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                {isEditingLabel ? (
                  <textarea ref={labelRef} className="shape-label-input" value={shape.label || ''}
                    onChange={handleLabelChange} onBlur={handleLabelBlur} onKeyDown={handleLabelKeyDown}
                    style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', textAlign: 'center', resize: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center' }} />
                ) : (
                  <span className="shape-label" style={{ fontSize: '13px', textAlign: 'center', color: 'var(--text-primary)', userSelect: 'none', wordBreak: 'break-word', lineHeight: 1.3 }}>
                    {shape.label || ''}
                  </span>
                )}
              </div>
            </foreignObject>
          )}
        </svg>
      )}

      {/* Portal pin */}
      {shape.portal && (
        <div
          className={`portal-pin ${isDraggingPortal ? 'dragging' : ''}`}
          style={{ left: shape.portal.x ?? -10, top: shape.portal.y ?? -10 }}
          onMouseDown={handlePortalMouseDown}
          title="Click to navigate · Drag to reposition"
        >
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
          <button className="portal-pin-clear" onClick={handleClearPortal} title="Remove portal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Set portal button (visible when selected) */}
      {isSelected && (
        <button className="shape-portal-btn" onClick={handleOpenPortal} title={shape.portal ? 'Change portal' : 'Add portal'}>
          <svg viewBox="0 0 24 24" fill={shape.portal ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
          </svg>
        </button>
      )}

      {/* Link icon */}
      {shape.linkedItemId && (
        <button
          className="shape-link-btn"
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToLinkedItem(shape.linkedItemId, shape.linkedItemType);
          }}
          title="Go to linked item"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>
      )}

      {/* Connection handle on right edge */}
      <div
        className="shape-connection-handle"
        onMouseDown={handleConnectionMouseDown}
        title="Drag to connect"
      />

      {/* Resize handles */}
      {isSelected && handles.map(handle => (
        <div
          key={handle}
          className={`shape-resize-handle handle-${handle}`}
          onMouseDown={(e) => handleResizeMouseDown(e, handle)}
        />
      ))}
    </div>
  );
}

export default React.memo(ShapeNode);
