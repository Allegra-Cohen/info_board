import React, { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import Card from './Card';
import Category from './Category';
import Connections from './Connections';
import ShapeNode from './ShapeNode';
import ShapePalette from './ShapePalette';
import SearchOverlay from './SearchOverlay';
import PortalPicker from './PortalPicker';
import { detectSource, extractTitle } from '../utils/sourceDetector';

export default function Board({
  cards,
  connections,
  categories,
  shapes,
  selectedCard,
  todayString,
  viewOffset,
  zoom,
  isShapePaletteOpen,
  onToggleShapePalette,
  isHighlighterActive,
  onViewOffsetChange,
  onZoomChange,
  onViewportSizeChange,
  onSelectCard,
  onAddCard,
  onUpdateCard,
  onFinalizeCardTitle,
  onDeleteCard,
  onAddConnection,
  onDeleteConnection,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddShape,
  onUpdateShape,
  onDeleteShape,
  onSyncLinkedChecklistItem,
  onSyncLinkedChecklistItemText,
  onAddChecklistItemToCard,
  onUpdateChecklistItemSharedId,
  onDeleteChecklistItem,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedShape, setSelectedShape] = useState(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categoryStart, setCategoryStart] = useState(null);
  const [categoryRect, setCategoryRect] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedCardId, setHighlightedCardId] = useState(null);
  const [portalPickerFor, setPortalPickerFor] = useState(null);
  const boardRef = useRef(null);
  const canvasRef = useRef(null);
  const panStartRef = useRef({ x: 0, y: 0 });

  // --- Phase 1: Refs for smooth panning/zooming without React re-renders ---
  const viewOffsetRef = useRef(viewOffset);
  const zoomRef = useRef(zoom);
  const syncTimeoutRef = useRef(null);
  const lastSyncedRef = useRef(null);

  // Sync refs from props only for external changes (navigation, board switch)
  useLayoutEffect(() => {
    if (lastSyncedRef.current &&
        viewOffset === lastSyncedRef.current.viewOffset &&
        zoom === lastSyncedRef.current.zoom) {
      lastSyncedRef.current = null;
      return;
    }
    viewOffsetRef.current = viewOffset;
    zoomRef.current = zoom;
  }, [viewOffset, zoom]);

  // Direct DOM update for canvas transform — no React re-render needed
  const updateCanvasTransform = useCallback(() => {
    if (canvasRef.current) {
      const z = zoomRef.current;
      const offset = viewOffsetRef.current;
      canvasRef.current.style.zoom = z;
      canvasRef.current.style.transform = `translate(${offset.x / z}px, ${offset.y / z}px)`;
    }
  }, []);

  // Debounced sync back to React state (for minimap, sidebar)
  const scheduleSync = useCallback(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      const offset = viewOffsetRef.current;
      const z = zoomRef.current;
      lastSyncedRef.current = { viewOffset: offset, zoom: z };
      onViewOffsetChange(offset);
      onZoomChange(z);
    }, 150);
  }, [onViewOffsetChange, onZoomChange]);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  // Card dimensions for checking if inside category
  const CARD_WIDTH = 240;
  const CARD_HEIGHT = 120;

  // Check if a card is inside a collapsed category (by explicit assignment)
  const isCardHidden = useCallback((card) => {
    if (!card.categoryId) return false;
    const category = categories.find(cat => cat.id === card.categoryId);
    return category?.collapsed || false;
  }, [categories]);

  // --- Phase 3: Memoize filtered/computed data ---
  const visibleCards = useMemo(
    () => cards.filter(card => !isCardHidden(card)),
    [cards, isCardHidden]
  );

  const hiddenCardIds = useMemo(() => {
    const set = new Set();
    for (const card of cards) {
      if (isCardHidden(card)) set.add(card.id);
    }
    return set;
  }, [cards, isCardHidden]);

  const visibleConnections = useMemo(() =>
    connections.filter(conn => !hiddenCardIds.has(conn.fromCardId) && !hiddenCardIds.has(conn.toCardId)),
    [connections, hiddenCardIds]
  );

  const isConnecting = connectingFrom !== null;

  // Track viewport size for minimap
  useEffect(() => {
    const updateViewportSize = () => {
      if (boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        onViewportSizeChange({ width: rect.width, height: rect.height });
      }
    };

    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    return () => window.removeEventListener('resize', updateViewportSize);
  }, [onViewportSizeChange]);

  // Handle paste from clipboard
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      let text = clipboardData.getData('text/plain') || '';
      let url = clipboardData.getData('text/uri-list') || '';
      const html = clipboardData.getData('text/html') || '';

      if (!url && text) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (line.startsWith('http://') || line.startsWith('https://')) {
            url = line;
            break;
          }
        }
      }

      if (url || text) {
        e.preventDefault();

        let title = '';
        if (html) {
          const titleMatch = html.match(/<a[^>]*>([^<]+)<\/a>/i) ||
                            html.match(/<title>([^<]+)<\/title>/i);
          if (titleMatch && !titleMatch[1].startsWith('http')) {
            title = titleMatch[1].trim();
          }
        }

        if (!title && text && text !== url) {
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          for (const line of lines) {
            if (!line.startsWith('http://') && !line.startsWith('https://')) {
              title = line;
              break;
            }
          }
        }

        if (!title) {
          title = extractTitle(url, text);
        }

        if (title) {
          title = title
            .replace(/ - Google Docs$/i, '')
            .replace(/ - Google Sheets$/i, '')
            .replace(/ - Google Slides$/i, '')
            .replace(/ - Google Drive$/i, '')
            .replace(/ \| Slack$/i, '')
            .trim();
        }

        const hasRealTitle = title && !url?.includes(title) && title !== 'Untitled' && title.length > 0;
        const source = detectSource(url);

        const rect = boardRef.current?.getBoundingClientRect();
        const vo = viewOffsetRef.current;
        const z = zoomRef.current;
        const x = rect ? ((rect.width / 2 - vo.x) / z - 120) : 200;
        const y = rect ? ((rect.height / 2 - vo.y) / z - 60) : 200;

        onAddCard({
          url: url || null,
          title: title || (url ? 'Pasted Link' : 'Pasted Text'),
          hasRealTitle,
          text: text !== url ? text : '',
          source: source || { type: 'link', name: 'Link', color: '#6B7280' },
          x: x + Math.random() * 40,
          y: y + Math.random() * 40,
        });
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [onAddCard]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    try {
      if (e.dataTransfer.types.includes('application/json')) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }
    } catch (err) {}

    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (e.target === boardRef.current) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const data = JSON.parse(jsonData);
        if (data.type === 'checklist-item') {
          return;
        }
      }
    } catch (err) {}

    const rect = boardRef.current.getBoundingClientRect();
    const vo = viewOffsetRef.current;
    const z = zoomRef.current;

    // Handle shape palette drops
    try {
      const plainData = e.dataTransfer.getData('text/plain');
      if (plainData) {
        const parsed = JSON.parse(plainData);
        if (parsed.type === 'shape-palette') {
          const sx = (e.clientX - rect.left - vo.x) / z;
          const sy = (e.clientY - rect.top - vo.y) / z;
          onAddShape({
            type: parsed.shapeType,
            x: sx - 60,
            y: sy - 40,
          });
          return;
        }
      }
    } catch (err) {}

    const x = (e.clientX - rect.left - vo.x) / z;
    const y = (e.clientY - rect.top - vo.y) / z;

    let url = e.dataTransfer.getData('text/uri-list') ||
              e.dataTransfer.getData('text/x-moz-url')?.split('\n')[0] ||
              e.dataTransfer.getData('URL');

    let text = e.dataTransfer.getData('text/plain') || '';

    if (!url && text && (text.startsWith('http://') || text.startsWith('https://'))) {
      url = text.split('\n')[0].trim();
    }

    const html = e.dataTransfer.getData('text/html');

    let title = '';
    if (html) {
      const patterns = [
        /<a[^>]*>([^<]+)<\/a>/i,
        /<title>([^<]+)<\/title>/i,
        /aria-label="([^"]+)"/i,
        /data-title="([^"]+)"/i,
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1].trim() && !match[1].startsWith('http')) {
          title = match[1].trim();
          break;
        }
      }
    }

    if (!title && text) {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (!line.startsWith('http://') && !line.startsWith('https://') && line !== url) {
          title = line;
          break;
        }
      }
    }

    const mozUrl = e.dataTransfer.getData('text/x-moz-url');
    if (!title && mozUrl) {
      const mozLines = mozUrl.split('\n');
      if (mozLines.length >= 2 && !mozLines[1].startsWith('http')) {
        title = mozLines[1].trim();
      }
    }

    if (!title) {
      title = extractTitle(url, text);
    }

    if (title) {
      title = title
        .replace(/ - Google Docs$/i, '')
        .replace(/ - Google Sheets$/i, '')
        .replace(/ - Google Slides$/i, '')
        .replace(/ - Google Drive$/i, '')
        .trim();
    }

    const hasRealTitle = title && !url?.includes(title) && title !== 'Untitled' && title.length > 0;
    const source = detectSource(url);

    onAddCard({
      url,
      title,
      hasRealTitle,
      text: text !== url ? text : '',
      source,
      x,
      y,
    });
  }, [onAddCard, onAddShape]);

  const handleBoardClick = useCallback((e) => {
    if (e.target === boardRef.current || e.target.classList.contains('board-canvas')) {
      onSelectCard(null);
      setSelectedCategory(null);
      setSelectedShape(null);
    }
  }, [onSelectCard]);

  const handleMouseDown = useCallback((e) => {
    const vo = viewOffsetRef.current;
    const z = zoomRef.current;

    if (e.button === 0 && e.altKey && (e.target === boardRef.current || e.target.classList.contains('board-canvas'))) {
      e.preventDefault();
      const rect = boardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - vo.x) / z;
      const y = (e.clientY - rect.top - vo.y) / z;
      setIsCreatingCategory(true);
      setCategoryStart({ x, y });
      setCategoryRect({ x, y, width: 0, height: 0 });
      return;
    }

    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - vo.x, y: e.clientY - vo.y };
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isPanning) {
      const newOffset = {
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      };
      viewOffsetRef.current = newOffset;
      updateCanvasTransform();
      return;
    }

    if (connectingFrom) {
      const rect = boardRef.current.getBoundingClientRect();
      const vo = viewOffsetRef.current;
      const z = zoomRef.current;
      setMousePosition({
        x: (e.clientX - rect.left - vo.x) / z,
        y: (e.clientY - rect.top - vo.y) / z,
      });
    }

    if (isCreatingCategory && categoryStart) {
      const rect = boardRef.current.getBoundingClientRect();
      const vo = viewOffsetRef.current;
      const z = zoomRef.current;
      const currentX = (e.clientX - rect.left - vo.x) / z;
      const currentY = (e.clientY - rect.top - vo.y) / z;

      const x = Math.min(categoryStart.x, currentX);
      const y = Math.min(categoryStart.y, currentY);
      const width = Math.abs(currentX - categoryStart.x);
      const height = Math.abs(currentY - categoryStart.y);

      setCategoryRect({ x, y, width, height });
    }
  }, [isPanning, connectingFrom, isCreatingCategory, categoryStart, updateCanvasTransform]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      // Immediate sync after panning stops
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      onViewOffsetChange(viewOffsetRef.current);
    }
    if (connectingFrom) {
      setConnectingFrom(null);
    }

    if (isCreatingCategory && categoryRect && categoryRect.width > 50 && categoryRect.height > 30) {
      onAddCategory({
        x: categoryRect.x,
        y: categoryRect.y,
        width: categoryRect.width,
        height: categoryRect.height,
      });
    }
    setIsCreatingCategory(false);
    setCategoryStart(null);
    setCategoryRect(null);
  }, [isPanning, connectingFrom, isCreatingCategory, categoryRect, onAddCategory, onViewOffsetChange]);

  // Double-click to create empty note
  const handleDoubleClick = useCallback((e) => {
    if (e.target === boardRef.current || e.target.classList.contains('board-canvas')) {
      const rect = boardRef.current.getBoundingClientRect();
      const vo = viewOffsetRef.current;
      const z = zoomRef.current;
      const x = (e.clientX - rect.left - vo.x) / z;
      const y = (e.clientY - rect.top - vo.y) / z;

      onAddCard({
        url: null,
        title: 'New Note',
        text: '',
        source: { type: 'note', name: 'Note', color: '#6B7280' },
        x,
        y,
      });
    }
  }, [onAddCard]);

  // Connection handling
  const handleStartConnection = useCallback((cardId, e) => {
    e.stopPropagation();
    const rect = boardRef.current.getBoundingClientRect();
    const vo = viewOffsetRef.current;
    const z = zoomRef.current;
    setConnectingFrom(cardId);
    setMousePosition({
      x: (e.clientX - rect.left - vo.x) / z,
      y: (e.clientY - rect.top - vo.y) / z,
    });
  }, []);

  const handleEndConnection = useCallback((cardId) => {
    if (connectingFrom && connectingFrom !== cardId) {
      onAddConnection(connectingFrom, cardId);
    }
    setConnectingFrom(null);
  }, [connectingFrom, onAddConnection]);

  // --- Phase 2: Stable callbacks for memoized children ---
  const handleSelectCategory = useCallback((categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedShape(null);
    onSelectCard(null);
  }, [onSelectCard]);

  const handleSelectShape = useCallback((shapeId) => {
    setSelectedShape(shapeId);
    setSelectedCategory(null);
    onSelectCard(null);
  }, [onSelectCard]);

  const handleCardSelect = useCallback((cardId) => {
    onSelectCard(cardId);
    setSelectedCategory(null);
    setSelectedShape(null);
  }, [onSelectCard]);

  const handleNavigateToLinkedItem = useCallback((itemId, itemType) => {
    const item = itemType === 'card'
      ? cards.find(c => c.id === itemId)
      : categories.find(c => c.id === itemId);
    if (!item) return;

    const itemWidth = item.width || 280;
    const itemHeight = item.height || 120;
    const centerX = item.x + itemWidth / 2;
    const centerY = item.y + itemHeight / 2;

    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const z = zoomRef.current;
    const newOffset = {
      x: -(centerX - (rect.width / z) / 2) * z,
      y: -(centerY - (rect.height / z) / 2) * z,
    };
    viewOffsetRef.current = newOffset;
    updateCanvasTransform();
    onViewOffsetChange(newOffset);

    if (itemType === 'card') {
      onSelectCard(itemId);
      setSelectedShape(null);
    } else {
      setSelectedCategory(itemId);
      setSelectedShape(null);
      onSelectCard(null);
    }
  }, [cards, categories, onViewOffsetChange, onSelectCard, updateCanvasTransform]);

  // Navigate to any element by ID (card, category, or shape)
  const handleNavigateToElement = useCallback((elementId) => {
    const card = cards.find(c => c.id === elementId);
    const category = categories.find(c => c.id === elementId);
    const shape = shapes.find(s => s.id === elementId);
    const element = card || category || shape;
    if (!element) return;

    const elWidth = element.width || 280;
    const elHeight = element.height || 120;
    const centerX = element.x + elWidth / 2;
    const centerY = element.y + elHeight / 2;

    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const z = zoomRef.current;
    const newOffset = {
      x: -(centerX - (rect.width / z) / 2) * z,
      y: -(centerY - (rect.height / z) / 2) * z,
    };
    viewOffsetRef.current = newOffset;
    updateCanvasTransform();
    onViewOffsetChange(newOffset);

    if (card) {
      onSelectCard(elementId);
      setSelectedCategory(null);
      setSelectedShape(null);
    } else if (category) {
      setSelectedCategory(elementId);
      setSelectedShape(null);
      onSelectCard(null);
    } else if (shape) {
      setSelectedShape(elementId);
      setSelectedCategory(null);
      onSelectCard(null);
    }
  }, [cards, categories, shapes, onViewOffsetChange, onSelectCard, updateCanvasTransform]);

  // Wheel handler — reads from refs, updates DOM directly, no React re-renders
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const handleWheel = (e) => {
      e.preventDefault();

      if (e.ctrlKey) {
        const zoomFactor = Math.exp(-e.deltaY * 0.005);
        zoomRef.current = Math.min(Math.max(zoomRef.current * zoomFactor, 0.25), 3);
      } else {
        viewOffsetRef.current = {
          x: viewOffsetRef.current.x - e.deltaX,
          y: viewOffsetRef.current.y - e.deltaY,
        };
      }
      updateCanvasTransform();
      scheduleSync();
    };

    board.addEventListener('wheel', handleWheel, { passive: false });
    return () => board.removeEventListener('wheel', handleWheel);
  }, [updateCanvasTransform, scheduleSync]);

  // Cmd+F to open search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Navigate to a card from search and flash-highlight it
  const handleSearchNavigate = useCallback((cardId) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const cardWidth = card.width || 280;
    const cardHeight = card.height || 200;
    const centerX = card.x + cardWidth / 2;
    const centerY = card.y + cardHeight / 2;

    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const z = zoomRef.current;
    const newOffset = {
      x: -(centerX - (rect.width / z) / 2) * z,
      y: -(centerY - (rect.height / z) / 2) * z,
    };
    viewOffsetRef.current = newOffset;
    updateCanvasTransform();
    onViewOffsetChange(newOffset);

    onSelectCard(cardId);
    setSelectedCategory(null);
    setSelectedShape(null);

    setHighlightedCardId(cardId);
    setTimeout(() => setHighlightedCardId(null), 1200);
  }, [cards, onViewOffsetChange, onSelectCard, updateCanvasTransform]);

  // Portal picker — lifted to Board level to avoid passing data arrays to every Card/Shape
  const handleOpenPortalPicker = useCallback((elementId, elementType) => {
    setPortalPickerFor({ elementId, elementType });
  }, []);

  const handlePortalSelect = useCallback((targetId, targetType) => {
    if (!portalPickerFor) return;
    if (portalPickerFor.elementType === 'card') {
      onUpdateCard(portalPickerFor.elementId, { portal: { targetId, targetType, x: -10, y: -10 } });
    } else if (portalPickerFor.elementType === 'shape') {
      onUpdateShape(portalPickerFor.elementId, { portal: { targetId, targetType, x: -10, y: -10 } });
    }
    setPortalPickerFor(null);
  }, [portalPickerFor, onUpdateCard, onUpdateShape]);

  // Stable getter for viewport center — used by Connections on click
  const getViewportCenter = useCallback(() => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const z = zoomRef.current;
    const offset = viewOffsetRef.current;
    return {
      x: (rect.width / 2) / z - offset.x / z,
      y: (rect.height / 2) / z - offset.y / z,
    };
  }, []);

  return (
    <div className="board-area">
      <div
        ref={boardRef}
        className={`board ${isDragOver ? 'drag-over' : ''} ${isPanning ? 'panning' : ''} ${connectingFrom ? 'connecting' : ''} ${isCreatingCategory ? 'creating-category' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBoardClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <div
          ref={canvasRef}
          className="board-canvas"
          style={{ zoom: zoom, transform: `translate(${viewOffset.x / zoom}px, ${viewOffset.y / zoom}px)` }}
        >
          {/* Categories render behind cards */}
          {categories.map(category => (
            <Category
              key={category.id}
              category={category}
              zoom={zoom}
              cards={cards}
              shapes={shapes}
              isSelected={selectedCategory === category.id}
              isConnecting={isConnecting}
              onSelect={handleSelectCategory}
              onUpdate={onUpdateCategory}
              onUpdateCard={onUpdateCard}
              onUpdateShape={onUpdateShape}
              onDelete={onDeleteCategory}
              onStartConnection={handleStartConnection}
              onEndConnection={handleEndConnection}
            />
          ))}

          {/* Category creation preview */}
          {isCreatingCategory && categoryRect && (
            <div
              className="category-preview"
              style={{
                left: categoryRect.x,
                top: categoryRect.y,
                width: categoryRect.width,
                height: categoryRect.height,
              }}
            />
          )}

          {/* Shapes render between categories and connections */}
          {shapes.map(shape => (
            <ShapeNode
              key={shape.id}
              shape={shape}
              zoom={zoom}
              isSelected={selectedShape === shape.id}
              isConnecting={isConnecting}
              categories={categories}
              onSelect={handleSelectShape}
              onUpdate={onUpdateShape}
              onDelete={onDeleteShape}
              onStartConnection={handleStartConnection}
              onEndConnection={handleEndConnection}
              onNavigateToLinkedItem={handleNavigateToLinkedItem}
              onNavigateToElement={handleNavigateToElement}
              onOpenPortalPicker={handleOpenPortalPicker}
            />
          ))}

          <Connections
            connections={visibleConnections}
            cards={cards}
            categories={categories}
            shapes={shapes}
            connectingFrom={connectingFrom}
            mousePosition={mousePosition}
            getViewportCenter={getViewportCenter}
            onDeleteConnection={onDeleteConnection}
            onNavigateToElement={handleNavigateToElement}
          />

          {visibleCards.map(card => (
            <Card
              key={card.id}
              card={card}
              isSelected={selectedCard === card.id}
              isHighlighted={highlightedCardId === card.id}
              isConnecting={isConnecting}
              isHighlighterActive={isHighlighterActive}
              zoom={zoom}
              todayString={todayString}
              categories={categories}
              onSelect={handleCardSelect}
              onUpdate={onUpdateCard}
              onFinalizeTitle={onFinalizeCardTitle}
              onDelete={onDeleteCard}
              onStartConnection={handleStartConnection}
              onEndConnection={handleEndConnection}
              onNavigateToElement={handleNavigateToElement}
              onOpenPortalPicker={handleOpenPortalPicker}
              onSyncLinkedChecklistItem={onSyncLinkedChecklistItem}
              onSyncLinkedChecklistItemText={onSyncLinkedChecklistItemText}
              onAddChecklistItemToCard={onAddChecklistItemToCard}
              onUpdateChecklistItemSharedId={onUpdateChecklistItemSharedId}
              onDeleteChecklistItem={onDeleteChecklistItem}
            />
          ))}
        </div>

        {cards.length === 0 && shapes.length === 0 && !isDragOver && (
          <div className="empty-state">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 4v16m-8-8h16" />
              </svg>
            </div>
            <p>Drag or paste links from your browser or Slack</p>
            <p className="hint">Double-click for notes · ⌥ drag for categories</p>
          </div>
        )}

        {isDragOver && (
          <div className="drop-indicator">
            <div className="drop-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4v16m-8-8h16" />
              </svg>
            </div>
            <p>Drop to add</p>
          </div>
        )}
      </div>

      {isShapePaletteOpen && (
        <ShapePalette isOpen={isShapePaletteOpen} onToggle={onToggleShapePalette} />
      )}

      {isSearchOpen && (
        <SearchOverlay
          cards={cards}
          onNavigateToCard={handleSearchNavigate}
          onClose={() => setIsSearchOpen(false)}
        />
      )}

      {portalPickerFor && (
        <PortalPicker
          cards={cards}
          shapes={shapes}
          categories={categories}
          excludeId={portalPickerFor.elementId}
          onSelect={handlePortalSelect}
          onClose={() => setPortalPickerFor(null)}
        />
      )}
    </div>
  );
}
