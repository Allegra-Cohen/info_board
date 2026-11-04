import React, { useState, useRef, useCallback, useEffect } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { SOURCE_ICONS } from '../utils/sourceDetector';

// Check if a date is within N days from today
const isDateWithinDays = (dateString, todayString, days) => {
  if (!dateString || !todayString) return false;
  const date = new Date(dateString);
  const today = new Date(todayString);
  const diffTime = date - today;
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
};

// Format date for display (e.g., "Jan 15")
const formatDateShort = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString + 'T00:00:00'); // Avoid timezone issues
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Card dimensions for category detection
const CARD_WIDTH = 280;
const CARD_HEIGHT = 200;

const CARD_COLORS = [
  null,         // None
  '#ef4444',    // Red
  '#f97316',    // Orange
  '#eab308',    // Yellow
  '#22c55e',    // Green
  '#3b82f6',    // Blue
  '#a855f7',    // Purple
  '#ec4899',    // Pink
];

// Escape HTML entities in text
const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Convert stored text (with <mark> tags) to safe HTML for rendering
const noteToHtml = (text) => {
  if (!text) return '';
  return text.split(/(<\/?mark>)/g).map(part => {
    if (part === '<mark>' || part === '</mark>') return part;
    return escapeHtml(part).replace(/\n/g, '<br>');
  }).join('');
};

// Extract stored format from contentEditable innerHTML
const htmlToNote = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  const extract = (node) => {
    let result = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName;
        if (tag === 'MARK') {
          const inner = extract(child);
          if (inner) result += '<mark>' + inner + '</mark>';
        } else if (tag === 'BR') {
          result += '\n';
        } else if (tag === 'DIV' || tag === 'P') {
          if (result.length > 0 && !result.endsWith('\n')) result += '\n';
          result += extract(child);
        } else {
          result += extract(child);
        }
      }
    }
    return result;
  };
  return extract(div);
};

// Strip <mark> tags from text
const stripMarks = (text) => (text || '').replace(/<\/?mark>/g, '');

// Apply or remove highlight on the current browser selection within a container.
// Returns the new stored text (with <mark> tags), or null if no valid selection.
const applyHighlightToSelection = (container) => {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;

  // Check if the entire selection is already inside a single <mark>
  let parentMark = range.commonAncestorContainer;
  if (parentMark.nodeType === Node.TEXT_NODE) parentMark = parentMark.parentElement;
  const isInsideMark = parentMark && parentMark.tagName === 'MARK';

  if (isInsideMark) {
    // Unhighlight: unwrap the <mark> by replacing it with its children
    const mark = parentMark;
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  } else {
    // Highlight: wrap selection in <mark>
    // Use extractContents + surroundContents approach that handles partial nodes
    const fragment = range.extractContents();
    // Remove any existing <mark> tags within the fragment (flatten nested highlights)
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);
    tempDiv.querySelectorAll('mark').forEach(m => {
      const parent = m.parentNode;
      while (m.firstChild) {
        parent.insertBefore(m.firstChild, m);
      }
      parent.removeChild(m);
    });
    tempDiv.normalize();
    const mark = document.createElement('mark');
    while (tempDiv.firstChild) {
      mark.appendChild(tempDiv.firstChild);
    }
    range.insertNode(mark);
    container.normalize();
  }

  sel.removeAllRanges();
  return htmlToNote(container.innerHTML);
};

function Card({ card, isSelected, isHighlighted, isConnecting, isHighlighterActive, zoom, todayString, categories, onSelect, onUpdate, onFinalizeTitle, onDelete, onStartConnection, onEndConnection, onNavigateToElement, onOpenPortalPicker, onSyncLinkedChecklistItem, onSyncLinkedChecklistItemText, onAddChecklistItemToCard, onUpdateChecklistItemSharedId, onDeleteChecklistItem }) {
  // Stable wrappers that bind card.id so parent can pass the same function references
  const select = useCallback(() => onSelect(card.id), [card.id, onSelect]);
  const update = useCallback((updates) => onUpdate(card.id, updates), [card.id, onUpdate]);
  const finalizeTitle = useCallback((title) => onFinalizeTitle(card.id, title), [card.id, onFinalizeTitle]);
  const deleteSelf = useCallback(() => onDelete(card.id), [card.id, onDelete]);
  const startConn = useCallback((e) => onStartConnection(card.id, e), [card.id, onStartConnection]);
  const endConn = useCallback(() => onEndConnection(card.id), [card.id, onEndConnection]);

  const [isDraggingPortal, setIsDraggingPortal] = useState(false);
  const portalDragRef = useRef({ startX: 0, startY: 0, pinX: 0, pinY: 0, moved: false });

  const handlePortalMouseDown = useCallback((e) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const p = card.portal;
    portalDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      pinX: p?.x ?? -10,
      pinY: p?.y ?? -10,
      moved: false,
    };
    setIsDraggingPortal(true);
  }, [card.portal]);

  useEffect(() => {
    if (!isDraggingPortal) return;
    const z = zoom || 1;

    const handleMouseMove = (e) => {
      const ref = portalDragRef.current;
      const dx = (e.clientX - ref.startX) / z;
      const dy = (e.clientY - ref.startY) / z;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) ref.moved = true;
      if (ref.moved) {
        update({ portal: { ...card.portal, x: ref.pinX + dx, y: ref.pinY + dy } });
      }
    };

    const handleMouseUp = () => {
      const wasDrag = portalDragRef.current.moved;
      setIsDraggingPortal(false);
      if (!wasDrag && card.portal && onNavigateToElement) {
        onNavigateToElement(card.portal.targetId);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPortal, card.portal, zoom, update, onNavigateToElement]);

  const handleOpenPortal = useCallback((e) => {
    e.stopPropagation();
    if (onOpenPortalPicker) onOpenPortalPicker(card.id, 'card');
  }, [card.id, onOpenPortalPicker]);

  const handleClearPortal = useCallback((e) => {
    e.stopPropagation();
    update({ portal: null });
  }, [update]);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [editingChecklistItemId, setEditingChecklistItemId] = useState(null);
  const [editingChecklistText, setEditingChecklistText] = useState('');
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggingItemId, setDraggingItemId] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const cardRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0, cardX: 0, cardY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, cardX: 0, cardY: 0 });
  const noteInputRef = useRef(null);
  const titleInputRef = useRef(null);
  const checklistInputRef = useRef(null);
  const dateInputRef = useRef(null);

  // Check if date is within a week
  const isDateSoon = isDateWithinDays(card.dueDate, todayString, 7);

  const handleMouseDown = useCallback((e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
    if (e.target.classList.contains('card-resize-handle')) return;
    // Don't start card drag if clicking on checklist items or the note area
    if (e.target.closest('.checklist-item')) return;
    if (e.target.closest('.card-note')) return;
    if (e.button !== 0) return;

    e.stopPropagation();
    select();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cardX: card.x,
      cardY: card.y,
    };
  }, [card.x, card.y, select]);

  const handleResizeMouseDown = useCallback((e, handle) => {
    e.stopPropagation();
    select();
    setIsResizing(true);
    setResizeHandle(handle);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: card.width || CARD_WIDTH,
      height: card.height || CARD_HEIGHT,
      cardX: card.x,
      cardY: card.y,
    };
  }, [card.x, card.y, card.width, card.height, select]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e) => {
      const z = zoom || 1;
      if (isDragging) {
        const dx = (e.clientX - dragStartRef.current.x) / z;
        const dy = (e.clientY - dragStartRef.current.y) / z;
        update({
          x: dragStartRef.current.cardX + dx,
          y: dragStartRef.current.cardY + dy,
        });
      } else if (isResizing) {
        const dx = (e.clientX - resizeStartRef.current.x) / z;
        const dy = (e.clientY - resizeStartRef.current.y) / z;
        const start = resizeStartRef.current;

        let newX = start.cardX;
        let newY = start.cardY;
        let newWidth = start.width;
        let newHeight = start.height;

        if (resizeHandle.includes('e')) {
          newWidth = Math.max(200, start.width + dx);
        }
        if (resizeHandle.includes('w')) {
          newWidth = Math.max(200, start.width - dx);
          newX = start.cardX + (start.width - newWidth);
        }
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(100, start.height + dy);
        }
        if (resizeHandle.includes('n')) {
          newHeight = Math.max(100, start.height - dy);
          newY = start.cardY + (start.height - newHeight);
        }

        update({ x: newX, y: newY, width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);

        // Check if card landed inside a category and assign it
        const cardWidth = card.width || CARD_WIDTH;
        const cardHeight = card.height || CARD_HEIGHT;
        const cardCenterX = card.x + cardWidth / 2;
        const cardCenterY = card.y + cardHeight / 2;

        let newCategoryId = null;
        for (const category of categories) {
          // Don't assign to collapsed categories - card would disappear
          if (category.collapsed) continue;

          if (
            cardCenterX >= category.x &&
            cardCenterX <= category.x + category.width &&
            cardCenterY >= category.y &&
            cardCenterY <= category.y + category.height
          ) {
            newCategoryId = category.id;
            break;
          }
        }

        // Only update if category assignment changed
        if (newCategoryId !== card.categoryId) {
          update({ categoryId: newCategoryId });
        }
      }
      if (isResizing) {
        setIsResizing(false);
        setResizeHandle(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeHandle, onUpdate, card.x, card.y, card.width, card.height, card.categoryId, categories, zoom]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingNote && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [isEditingNote]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingDate && dateInputRef.current) {
      dateInputRef.current.focus();
      dateInputRef.current.showPicker?.();
    }
  }, [isEditingDate]);

  // Sync contentEditable note content when card.note changes externally
  useEffect(() => {
    if (noteInputRef.current && document.activeElement !== noteInputRef.current) {
      noteInputRef.current.innerHTML = noteToHtml(card.note || '');
    }
  }, [card.note, isHighlighterActive]);

  const handleTitleDoubleClick = useCallback((e) => {
    e.stopPropagation();
    setIsEditingTitle(true);
  }, []);

  const handleTitleChange = useCallback((e) => {
    update({ title: e.target.value });
  }, [onUpdate]);

  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false);
    // Notify parent that title editing is complete (for archive updates)
    if (finalizeTitle) {
      finalizeTitle(card.title);
    }
  }, [finalizeTitle, card.title]);

  const handleTitleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      setIsEditingTitle(false);
      if (finalizeTitle) {
        finalizeTitle(card.title);
      }
    }
    if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  }, [finalizeTitle, card.title]);

  const handleDateClick = useCallback((e) => {
    e.stopPropagation();
    setIsEditingDate(true);
  }, []);

  const handleDateChange = useCallback((e) => {
    update({ dueDate: e.target.value || null });
  }, [onUpdate]);

  const handleDateBlur = useCallback(() => {
    setIsEditingDate(false);
  }, []);

  const handleClearDate = useCallback((e) => {
    e.stopPropagation();
    update({ dueDate: null });
  }, [onUpdate]);

  const handleNoteInput = useCallback(() => {
    if (noteInputRef.current) {
      const html = noteInputRef.current.innerHTML;
      if (html === '<br>' || html === '' || html === '<div><br></div>') {
        update({ note: '' });
        noteInputRef.current.innerHTML = '';
      } else {
        const newNote = htmlToNote(html);
        update({ note: newNote });
      }
    }
  }, [onUpdate]);

  const handleNotePaste = useCallback((e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  const handleNoteHighlightMouseUp = useCallback((e) => {
    e.stopPropagation();
    if (!noteInputRef.current) return;
    const newNote = applyHighlightToSelection(noteInputRef.current);
    if (newNote !== null) {
      update({ note: newNote });
    }
  }, [onUpdate]);

  const handleChecklistHighlightMouseUp = useCallback((itemId, e) => {
    e.stopPropagation();
    const container = e.currentTarget;
    const newText = applyHighlightToSelection(container);
    if (newText === null) return;
    const checklist = card.checklist || [];
    const item = checklist.find(i => i.id === itemId);
    if (!item) return;
    if (item.sharedId && onSyncLinkedChecklistItemText) {
      onSyncLinkedChecklistItemText(item.sharedId, newText);
    } else {
      const updatedChecklist = checklist.map(i =>
        i.id === itemId ? { ...i, text: newText } : i
      );
      update({ checklist: updatedChecklist });
    }
  }, [card.checklist, onUpdate, onSyncLinkedChecklistItemText]);

  const handleNoteBlur = useCallback(() => {
    setIsEditingNote(false);
    if (noteInputRef.current) {
      const html = noteInputRef.current.innerHTML;
      if (html === '<br>' || html === '' || html === '<div><br></div>') {
        update({ note: '' });
      }
    }
  }, [onUpdate]);

  const handleAddNote = useCallback((e) => {
    e.stopPropagation();
    if (!isHighlighterActive) setIsEditingNote(true);
  }, [isHighlighterActive]);

  // Checklist handlers
  const handleToggleChecklist = useCallback((e) => {
    e.stopPropagation();
    setShowChecklist(true);
  }, []);

  const handleChecklistItemToggle = useCallback((itemId) => {
    const checklist = card.checklist || [];
    const item = checklist.find(i => i.id === itemId);
    if (!item) return;

    const newChecked = !item.checked;

    // If this is a linked item, sync across all cards
    if (item.sharedId && onSyncLinkedChecklistItem) {
      onSyncLinkedChecklistItem(item.sharedId, newChecked);
    } else {
      // Otherwise just update locally
      const updatedChecklist = checklist.map(i =>
        i.id === itemId ? { ...i, checked: newChecked } : i
      );
      update({ checklist: updatedChecklist });
    }
  }, [card.checklist, onUpdate, onSyncLinkedChecklistItem]);

  const handleAddChecklistItem = useCallback((e) => {
    e.preventDefault();
    if (!newChecklistItem.trim()) return;

    const checklist = card.checklist || [];
    const newItem = {
      id: crypto.randomUUID(),
      text: newChecklistItem.trim(),
      checked: false,
    };
    update({ checklist: [...checklist, newItem] });
    setNewChecklistItem('');
    checklistInputRef.current?.focus();
  }, [newChecklistItem, card.checklist, update]);

  const handleDeleteChecklistItem = useCallback((itemId) => {
    if (onDeleteChecklistItem) {
      onDeleteChecklistItem(card.id, itemId);
    } else {
      // Fallback to old behavior if prop not provided
      const checklist = card.checklist || [];
      update({ checklist: checklist.filter(item => item.id !== itemId) });
    }
  }, [card.id, card.checklist, onUpdate, onDeleteChecklistItem]);

  const handleStartEditChecklistItem = useCallback((item, e) => {
    e.stopPropagation();
    setEditingChecklistItemId(item.id);
    setEditingChecklistText(stripMarks(item.text));
  }, []);

  const handleSaveChecklistItem = useCallback(() => {
    if (!editingChecklistItemId) return;

    const checklist = card.checklist || [];
    const item = checklist.find(i => i.id === editingChecklistItemId);
    const trimmedText = editingChecklistText.trim();

    if (trimmedText && item) {
      // If this is a linked item, sync text across all cards
      if (item.sharedId && onSyncLinkedChecklistItemText) {
        onSyncLinkedChecklistItemText(item.sharedId, trimmedText);
      } else {
        // Otherwise just update locally
        const updatedChecklist = checklist.map(i =>
          i.id === editingChecklistItemId ? { ...i, text: trimmedText } : i
        );
        update({ checklist: updatedChecklist });
      }
    }

    setEditingChecklistItemId(null);
    setEditingChecklistText('');
  }, [editingChecklistItemId, editingChecklistText, card.checklist, onUpdate, onSyncLinkedChecklistItemText]);

  const handleChecklistItemEditKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveChecklistItem();
    } else if (e.key === 'Escape') {
      setEditingChecklistItemId(null);
      setEditingChecklistText('');
    }
  }, [handleSaveChecklistItem]);

  const handleChecklistKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleAddChecklistItem(e);
    }
    if (e.key === 'Escape') {
      setShowChecklist(false);
      setNewChecklistItem('');
    }
  }, [handleAddChecklistItem]);

  // Drag handler for checklist items
  const handleChecklistItemDragStart = useCallback((e, item) => {
    e.stopPropagation();
    setDraggingItemId(item.id);
    const dragData = {
      type: 'checklist-item',
      sourceCardId: card.id,
      itemId: item.id,
      text: item.text,
      checked: item.checked,
      sharedId: item.sharedId || null,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copyMove';
  }, [card.id]);

  const handleChecklistItemDragEnd = useCallback(() => {
    setDraggingItemId(null);
    setDragOverIndex(null);
  }, []);

  const handleChecklistItemDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      // Check if it's a checklist item from the same card
      const rect = e.currentTarget.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const insertIndex = e.clientY < midY ? index : index + 1;
      setDragOverIndex(insertIndex);
    } catch {
      // Ignore parse errors
    }
  }, []);

  const handleChecklistReorder = useCallback((e) => {
    e.preventDefault();

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type !== 'checklist-item') return;

      // Only reorder if dropping on the same card
      if (data.sourceCardId === card.id && dragOverIndex !== null) {
        e.stopPropagation(); // Only stop propagation for same-card reorder
        const checklist = [...(card.checklist || [])];
        const fromIndex = checklist.findIndex(item => item.id === data.itemId);

        if (fromIndex !== -1 && fromIndex !== dragOverIndex && fromIndex !== dragOverIndex - 1) {
          const [removed] = checklist.splice(fromIndex, 1);
          const insertAt = fromIndex < dragOverIndex ? dragOverIndex - 1 : dragOverIndex;
          checklist.splice(insertAt, 0, removed);
          update({ checklist });
        }
        setDragOverIndex(null);
        setDraggingItemId(null);
      }
      // If not same card, let the event bubble up to handleChecklistDrop
    } catch {
      // Ignore parse errors
    }
  }, [card.id, card.checklist, dragOverIndex, update]);

  // Drop handler for receiving checklist items from other cards
  const handleChecklistDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type !== 'checklist-item') return;
      if (data.sourceCardId === card.id) return; // Don't drop on same card

      // Generate a sharedId if this item doesn't have one yet
      const sharedId = data.sharedId || crypto.randomUUID();

      // Create a linked copy on this card
      const newItem = {
        id: crypto.randomUUID(),
        text: data.text,
        checked: data.checked,
        sharedId: sharedId,
      };

      // Add to this card
      if (onAddChecklistItemToCard) {
        onAddChecklistItemToCard(card.id, newItem);
      }

      // Update the source item's sharedId if it didn't have one
      if (!data.sharedId && onUpdateChecklistItemSharedId) {
        onUpdateChecklistItemSharedId(data.sourceCardId, data.itemId, sharedId);
      }

      // Make sure checklist is visible
      setShowChecklist(true);
    } catch (err) {
      // Ignore non-checklist drops
    }
  }, [card.id, onAddChecklistItemToCard, onUpdateChecklistItemSharedId]);

  const handleChecklistDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleOpenUrl = useCallback((e) => {
    e.stopPropagation();
    if (card.url) {
      if (window.electronAPI?.openUrlInSafari) {
        window.electronAPI.openUrlInSafari(card.url);
      } else {
        window.open(card.url, '_blank');
      }
    }
  }, [card.url]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setIsEditingNote(false);
      setIsEditingTitle(false);
      setShowEmojiPicker(false);
      setShowColorPicker(false);
    }
  }, []);

  const handleDeleteClick = useCallback((e) => {
    e.stopPropagation();
    deleteSelf();
  }, [deleteSelf]);

  const sourceIcon = SOURCE_ICONS[card.source?.type] || SOURCE_ICONS.generic;

  const handleEmojiClick = useCallback((e) => {
    e.stopPropagation();
    setShowEmojiPicker(!showEmojiPicker);
  }, [showEmojiPicker]);

  const handleEmojiSelect = useCallback((emojiData) => {
    update({ customEmoji: emojiData.native });
    setShowEmojiPicker(false);
  }, [onUpdate]);

  const handleClearEmoji = useCallback((e) => {
    e.stopPropagation();
    update({ customEmoji: null });
    setShowEmojiPicker(false);
  }, [onUpdate]);

  const handleColorClick = useCallback((e) => {
    e.stopPropagation();
    setShowColorPicker(prev => !prev);
  }, []);

  const handleColorSelect = useCallback((color) => {
    update({ color });
    setShowColorPicker(false);
  }, [onUpdate]);

  const handleConnectionMouseUp = useCallback((e) => {
    if (isConnecting) {
      e.stopPropagation();
      endConn();
    }
  }, [isConnecting, endConn]);

  return (
    <div
      ref={cardRef}
      className={`card ${isSelected ? 'selected' : ''} ${isHighlighted ? 'search-highlight' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} ${isConnecting ? 'connect-target' : ''} ${isDateSoon ? 'date-soon' : ''}`}
      style={{
        transform: `translate(${card.x}px, ${card.y}px)`,
        width: card.width || CARD_WIDTH,
        height: card.height || CARD_HEIGHT,
        '--card-color': card.color || 'transparent',
        '--source-color': card.source?.color || '#6B7280',
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleConnectionMouseUp}
      onClick={(e) => { e.stopPropagation(); select(); }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Connection handle on right side */}
      <div
        className="connection-handle"
        onMouseDown={startConn}
        title="Drag to connect"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="4" />
        </svg>
      </div>

      {/* Portal pin overlay */}
      {card.portal && (
        <div
          className={`portal-pin ${isDraggingPortal ? 'dragging' : ''}`}
          style={{ left: card.portal.x ?? -10, top: card.portal.y ?? -10 }}
          onMouseDown={handlePortalMouseDown}
          title="Click to navigate · Drag to reposition"
        >
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/></svg>
          <button className="portal-pin-clear" onClick={handleClearPortal} title="Remove portal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {card.color && <div className="card-color-bar" />}

      <div className="card-header">
        <div className="card-source-icon-wrapper">
          <div
            className={`card-source-icon ${card.customEmoji ? 'has-emoji' : ''}`}
            onClick={handleEmojiClick}
            title="Click to change icon"
          >
            {card.customEmoji ? (
              <span className="card-custom-emoji">{card.customEmoji}</span>
            ) : (
              <span dangerouslySetInnerHTML={{ __html: sourceIcon }} />
            )}
          </div>
          {showEmojiPicker && (
            <div className="emoji-picker-wrapper" onClick={(e) => e.stopPropagation()}>
              <Picker
                data={data}
                onEmojiSelect={handleEmojiSelect}
                theme="light"
                previewPosition="none"
                skinTonePosition="none"
                perLine={8}
                maxFrequentRows={2}
              />
              {card.customEmoji && (
                <button className="emoji-clear-btn" onClick={handleClearEmoji}>
                  Reset to default
                </button>
              )}
            </div>
          )}
        </div>
        <span className="card-source-name">{card.source?.name || 'Note'}</span>
        {card.sharedId && (
          <span className="card-linked-badge" title="Linked to other boards">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </span>
        )}

        <div className="card-header-right">
          {/* Date picker */}
          <div className={`card-date ${card.dueDate ? 'has-date' : ''} ${isDateSoon ? 'date-soon' : ''}`}>
            {isEditingDate ? (
              <input
                ref={dateInputRef}
                type="date"
                className="card-date-input"
                value={card.dueDate || ''}
                onChange={handleDateChange}
                onBlur={handleDateBlur}
                onClick={(e) => e.stopPropagation()}
              />
            ) : card.dueDate ? (
              <span className="card-date-display" onClick={handleDateClick}>
                {formatDateShort(card.dueDate)}
                <button className="card-date-clear" onClick={handleClearDate}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ) : (
              <button className="card-date-add" onClick={handleDateClick} title="Add date">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </button>
            )}
          </div>

          {card.url && (
            <button className="card-open-btn" onClick={handleOpenUrl} title="Open link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </button>
          )}

          <button className="card-portal-btn" onClick={handleOpenPortal} title={card.portal ? 'Change portal' : 'Add portal'}>
            <svg viewBox="0 0 24 24" fill={card.portal ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
            </svg>
          </button>

          <div className="card-color-picker-wrapper">
            <button className="card-color-circle-btn" onClick={handleColorClick} title="Change color">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" fill={card.color || 'none'} />
              </svg>
            </button>
            {showColorPicker && (
              <div className="card-color-picker" onClick={(e) => e.stopPropagation()}>
                {CARD_COLORS.map((color) => (
                  <button
                    key={color || 'none'}
                    className={`color-swatch ${card.color === color ? 'active' : ''} ${color === null ? 'none' : ''}`}
                    style={{ backgroundColor: color || 'transparent' }}
                    onClick={() => handleColorSelect(color)}
                    title={color === null ? 'None' : ''}
                  />
                ))}
              </div>
            )}
          </div>

          <button className="card-delete-btn" onClick={handleDeleteClick} title="Delete card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="card-body">
      <div className="card-content">
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            className="card-title-input"
            value={card.title}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            placeholder="Enter a title..."
          />
        ) : card.hasRealTitle || card.title ? (
          <h3
            className={`card-title ${!card.hasRealTitle ? 'editable-hint' : ''}`}
            onDoubleClick={handleTitleDoubleClick}
            onClick={!card.hasRealTitle ? () => setIsEditingTitle(true) : undefined}
          >
            {card.title || 'Untitled'}
            {!card.hasRealTitle && (
              <span className="edit-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </span>
            )}
          </h3>
        ) : (
          <button className="set-title-btn" onClick={() => setIsEditingTitle(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Click to set title
          </button>
        )}

        {card.isLoadingMetadata && (
          <div className="card-loading">
            <div className="card-loading-spinner" />
            <span>Loading preview...</span>
          </div>
        )}

        {card.description && !card.isLoadingMetadata && (
          <p className="card-description">{card.description}</p>
        )}

        {card.text && card.text !== card.url && !card.description && (
          <p className="card-text">{card.text}</p>
        )}
      </div>

      <div className="card-note-section">
        {isEditingNote || card.note ? (
          <div
            ref={noteInputRef}
            contentEditable={!isHighlighterActive}
            suppressContentEditableWarning
            className={`card-note ${isHighlighterActive ? 'card-note-highlight-mode' : ''}`}
            onInput={isHighlighterActive ? undefined : handleNoteInput}
            onBlur={isHighlighterActive ? undefined : handleNoteBlur}
            onClick={(e) => { e.stopPropagation(); if (!isHighlighterActive) setIsEditingNote(true); }}
            onPaste={isHighlighterActive ? undefined : handleNotePaste}
            onMouseUp={isHighlighterActive ? handleNoteHighlightMouseUp : (e) => {
              const newHeight = e.currentTarget.offsetHeight;
              if (newHeight !== card.noteHeight) {
                update({ noteHeight: newHeight });
              }
            }}
            style={card.noteHeight ? { height: card.noteHeight } : undefined}
          />
        ) : (
          <button className="add-note-btn" onClick={handleAddNote}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add note
          </button>
        )}
      </div>

      {/* Checklist section */}
      <div
        className="card-checklist-section"
        onDragOver={handleChecklistDragOver}
        onDrop={handleChecklistDrop}
        onDragLeave={() => setDragOverIndex(null)}
      >
        {(showChecklist || (card.checklist && card.checklist.length > 0)) ? (
          <div className="card-checklist" onDrop={handleChecklistReorder}>
            {card.checklist?.map((item, index) => (
              <div
                key={item.id}
                className={`checklist-item ${item.checked ? 'checked' : ''} ${item.sharedId ? 'linked' : ''} ${draggingItemId === item.id ? 'dragging' : ''} ${dragOverIndex === index ? 'drop-above' : ''} ${dragOverIndex === index + 1 && index === (card.checklist?.length || 0) - 1 ? 'drop-below' : ''}`}
                draggable={!isHighlighterActive}
                onDragStart={(e) => handleChecklistItemDragStart(e, item)}
                onDragEnd={handleChecklistItemDragEnd}
                onDragOver={(e) => handleChecklistItemDragOver(e, index)}
              >
                <div className="checklist-drag-handle" title="Drag to reorder or link to another card">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                    <circle cx="9" cy="6" r="1.5" />
                    <circle cx="15" cy="6" r="1.5" />
                    <circle cx="9" cy="12" r="1.5" />
                    <circle cx="15" cy="12" r="1.5" />
                    <circle cx="9" cy="18" r="1.5" />
                    <circle cx="15" cy="18" r="1.5" />
                  </svg>
                </div>
                <label className="checklist-checkbox" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => handleChecklistItemToggle(item.id)}
                  />
                  <span className="checkmark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  </span>
                </label>
                {editingChecklistItemId === item.id ? (
                  <input
                    type="text"
                    className="checklist-edit-input"
                    value={editingChecklistText}
                    onChange={(e) => setEditingChecklistText(e.target.value)}
                    onBlur={handleSaveChecklistItem}
                    onKeyDown={handleChecklistItemEditKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <>
                    <span
                      className={`checklist-text ${isHighlighterActive ? 'highlight-selectable' : ''}`}
                      onDoubleClick={isHighlighterActive ? undefined : (e) => handleStartEditChecklistItem(item, e)}
                      onMouseUp={isHighlighterActive ? (e) => handleChecklistHighlightMouseUp(item.id, e) : undefined}
                      dangerouslySetInnerHTML={{ __html: noteToHtml(item.text) }}
                    />
                    {item.sharedId && (
                      <span className="checklist-linked-icon" title="Linked across cards">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </span>
                    )}
                  </>
                )}
                <button
                  className="checklist-delete-btn"
                  onClick={(e) => { e.stopPropagation(); handleDeleteChecklistItem(item.id); }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <div className="checklist-add" onClick={(e) => e.stopPropagation()}>
              <input
                ref={checklistInputRef}
                type="text"
                className="checklist-input"
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={handleChecklistKeyDown}
                placeholder="Add item..."
              />
              <button className="checklist-add-btn" onClick={handleAddChecklistItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          <button className="add-checklist-btn" onClick={handleToggleChecklist}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
            Add checklist
          </button>
        )}
      </div>
      </div>

      {/* Resize handles */}
      {isSelected && (
        <>
          <div className="card-resize-handle se" onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
          <div className="card-resize-handle sw" onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
          <div className="card-resize-handle ne" onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
          <div className="card-resize-handle nw" onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
          <div className="card-resize-handle e" onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
          <div className="card-resize-handle w" onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
          <div className="card-resize-handle n" onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
          <div className="card-resize-handle s" onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
        </>
      )}
    </div>
  );
}

export default React.memo(Card);
