import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Board from './components/Board';
import Toolbar from './components/Toolbar';
import ArchiveBoard from './components/ArchiveBoard';
import { useArchive } from './hooks/useArchive';
import {
  createBoardSnapshot,
  createCardSnapshot,
  createCategorySnapshot,
  createShapeSnapshot,
} from './utils/archiveHelpers';

// Special ID for the Archive board
export const ARCHIVE_BOARD_ID = '__archive__';

// Get today's date string (YYYY-MM-DD) - cached for the session
const getTodayString = () => new Date().toISOString().split('T')[0];

const COLORS = [
  { name: 'None', value: null },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
];

const createNewBoard = (name = 'Untitled Board') => ({
  id: crypto.randomUUID(),
  name,
  cards: [],
  connections: [],
  categories: [],
  shapes: [],
  createdAt: Date.now(),
});

// URLs that definitely won't return useful metadata (require auth with no public fallback)
const AUTH_REQUIRED_PATTERNS = [
  /mail\.google\.com/i,
  /calendar\.google\.com/i,
  /app\.slack\.com/i,
  /notion\.so/i,
  /figma\.com/i,
  /linear\.app/i,
  /asana\.com/i,
];
// Note: Google Docs/Sheets/Slides/Drive are NOT in this list anymore - we'll try to fetch them

const shouldFetchMetadata = (url) => {
  if (!url) return false;
  return !AUTH_REQUIRED_PATTERNS.some(pattern => pattern.test(url));
};

export default function App() {
  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [todayString, setTodayString] = useState(getTodayString);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const [undoStack, setUndoStack] = useState([]);
  const [isShapePaletteOpen, setIsShapePaletteOpen] = useState(false);
  const [isHighlighterActive, setIsHighlighterActive] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Archive hook for logging create/delete events
  const { archiveEvents, logEvent, updateItemName, updateItemColor, updateCardCategory } = useArchive();

  // Check once per day if the date has changed (checks at midnight)
  useEffect(() => {
    const checkDateChange = () => {
      const newToday = getTodayString();
      if (newToday !== todayString) {
        setTodayString(newToday);
      }
    };

    // Calculate ms until midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    const msUntilMidnight = midnight - now;

    // Set timeout for midnight, then check daily
    const midnightTimeout = setTimeout(() => {
      checkDateChange();
      // After first midnight, check every 24 hours
      const dailyInterval = setInterval(checkDateChange, 24 * 60 * 60 * 1000);
      return () => clearInterval(dailyInterval);
    }, msUntilMidnight);

    return () => clearTimeout(midnightTimeout);
  }, [todayString]);

  const activeBoard = boards.find(b => b.id === activeBoardId);
  const cards = activeBoard?.cards || [];
  const connections = activeBoard?.connections || [];
  const categories = activeBoard?.categories || [];
  const shapes = activeBoard?.shapes || [];

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      if (window.electronAPI) {
        const data = await window.electronAPI.loadData();

        // Migration: convert old single-board format to multi-board
        if (data.cards && !data.boards) {
          const migratedBoard = createNewBoard('My Board');
          migratedBoard.cards = data.cards;
          setBoards([migratedBoard]);
          setActiveBoardId(migratedBoard.id);
        } else if (data.boards && data.boards.length > 0) {
          // Migrate boards to have connections, categories, and shapes arrays if missing
          const migratedBoards = data.boards.map(board => ({
            ...board,
            connections: board.connections || [],
            categories: board.categories || [],
            shapes: board.shapes || [],
          }));
          setBoards(migratedBoards);
          setActiveBoardId(data.activeBoardId || migratedBoards[0].id);
        } else {
          // Fresh start - create default board
          const defaultBoard = createNewBoard('My Board');
          setBoards([defaultBoard]);
          setActiveBoardId(defaultBoard.id);
        }
      } else {
        // No electron API (dev without electron)
        const defaultBoard = createNewBoard('My Board');
        setBoards([defaultBoard]);
        setActiveBoardId(defaultBoard.id);
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Auto-save when boards change (debounced)
  useEffect(() => {
    if (isLoading) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (window.electronAPI) {
        window.electronAPI.saveData({ boards, activeBoardId });
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [boards, activeBoardId, isLoading]);

  // Board management
  const addBoard = useCallback(() => {
    const newBoard = createNewBoard();
    setBoards(prev => [...prev, newBoard]);
    setActiveBoardId(newBoard.id);
    setSelectedCard(null);

    // Log to archive
    logEvent('created', 'board', createBoardSnapshot(newBoard), {
      boardId: null,
      boardName: null,
    });
  }, [logEvent]);

  const deleteBoard = useCallback((boardId) => {
    // Capture board data before deletion for archive
    const boardToDelete = boards.find(b => b.id === boardId);
    if (boardToDelete) {
      logEvent('deleted', 'board', createBoardSnapshot(boardToDelete), {
        boardId: null,
        boardName: null,
        cardCount: boardToDelete.cards?.length || 0,
        categoryCount: boardToDelete.categories?.length || 0,
      });
    }

    setBoards(prev => {
      const filtered = prev.filter(b => b.id !== boardId);
      // If deleting active board, switch to another
      if (boardId === activeBoardId && filtered.length > 0) {
        setActiveBoardId(filtered[0].id);
      } else if (filtered.length === 0) {
        // Don't allow deleting the last board - create a new one
        const newBoard = createNewBoard('My Board');
        setActiveBoardId(newBoard.id);
        return [newBoard];
      }
      return filtered;
    });
    setSelectedCard(null);
  }, [activeBoardId, boards, logEvent]);

  const renameBoard = useCallback((boardId, newName) => {
    const board = boards.find(b => b.id === boardId);
    const oldName = board?.name;

    setBoards(prev => prev.map(b =>
      b.id === boardId ? { ...b, name: newName } : b
    ));

    // Update archive events with new name (tracks previous names internally)
    if (oldName && oldName !== 'Untitled Board' && oldName !== newName) {
      updateItemName('board', boardId, newName, oldName);
    } else {
      updateItemName('board', boardId, newName, null);
    }
  }, [boards, updateItemName]);

  const switchBoard = useCallback((boardId) => {
    setActiveBoardId(boardId);
    setSelectedCard(null);
    setViewOffset({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const reorderBoards = useCallback((newBoards) => {
    setBoards(newBoards);
  }, []);

  // Card management (scoped to active board)
  const addCard = useCallback(async (cardData) => {
    if (!activeBoardId) return;

    const willFetchMetadata = shouldFetchMetadata(cardData.url);
    const cardId = crypto.randomUUID();
    const newCard = {
      id: cardId,
      ...cardData,
      x: cardData.x || 100 + Math.random() * 200,
      y: cardData.y || 100 + Math.random() * 200,
      color: null,
      note: '',
      description: null,
      image: null,
      isLoadingMetadata: willFetchMetadata,
      portal: null,
      createdAt: Date.now(),
    };

    // Add card immediately for responsiveness
    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? { ...board, cards: [...board.cards, newCard] }
        : board
    ));

    // Log to archive (include category if card was created in one)
    const category = newCard.categoryId ? categories.find(c => c.id === newCard.categoryId) : null;
    logEvent('created', 'card', createCardSnapshot(newCard), {
      boardId: activeBoardId,
      boardName: activeBoard?.name || null,
      categoryId: newCard.categoryId || null,
      categoryTitle: category?.title || null,
    });

    // Fetch metadata in background if there's a URL that doesn't require auth
    if (willFetchMetadata && window.electronAPI?.fetchUrlMetadata) {
      try {
        const metadata = await window.electronAPI.fetchUrlMetadata(cardData.url);
        setBoards(prev => prev.map(board =>
          board.id === activeBoardId
            ? {
                ...board,
                cards: board.cards.map(card =>
                  card.id === cardId
                    ? {
                        ...card,
                        title: metadata.title || card.title,
                        hasRealTitle: !!metadata.title || card.hasRealTitle,
                        description: metadata.description,
                        image: metadata.image,
                        isLoadingMetadata: false,
                      }
                    : card
                ),
              }
            : board
        ));
        // Update archive with fetched title
        if (metadata.title) {
          updateItemName('card', cardId, metadata.title, null);
        }
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
        setBoards(prev => prev.map(board =>
          board.id === activeBoardId
            ? {
                ...board,
                cards: board.cards.map(card =>
                  card.id === cardId ? { ...card, isLoadingMetadata: false } : card
                ),
              }
            : board
        ));
      }
    }
  }, [activeBoardId, activeBoard, categories, logEvent, updateItemName]);

  // Fields that sync across linked cards
  const SYNCED_FIELDS = ['title', 'hasRealTitle', 'note', 'checklist', 'color', 'dueDate', 'customEmoji', 'url', 'description', 'image', 'source', 'noteHeight', 'portal'];

  const updateCard = useCallback((cardId, updates) => {
    // If user is updating the title, mark it as a real title
    if (updates.title !== undefined) {
      updates.hasRealTitle = true;
      // Note: Archive title updates happen via finalizeCardTitle, not here
      // This prevents per-keystroke archive updates while typing
    }

    // Update archive events with new color (no logging, just update)
    if (updates.color !== undefined) {
      updateItemColor('card', cardId, updates.color);
    }

    // Update archive events with new category
    if (updates.categoryId !== undefined) {
      const category = updates.categoryId ? categories.find(c => c.id === updates.categoryId) : null;
      updateCardCategory(cardId, updates.categoryId, category?.title || null);
    }

    // Find the card to check if it's linked
    const currentCard = cards.find(c => c.id === cardId);
    const sharedId = currentCard?.sharedId;

    // Extract synced updates
    const syncedUpdates = {};
    for (const key of SYNCED_FIELDS) {
      if (updates[key] !== undefined) {
        syncedUpdates[key] = updates[key];
      }
    }

    setBoards(prev => prev.map(board => {
      // Update the target card on active board
      if (board.id === activeBoardId) {
        return {
          ...board,
          cards: board.cards.map(card =>
            card.id === cardId ? { ...card, ...updates } : card
          ),
        };
      }

      // If card is linked and has synced updates, update linked cards on other boards
      if (sharedId && Object.keys(syncedUpdates).length > 0) {
        const hasLinkedCard = board.cards.some(c => c.sharedId === sharedId);
        if (hasLinkedCard) {
          return {
            ...board,
            cards: board.cards.map(card =>
              card.sharedId === sharedId ? { ...card, ...syncedUpdates } : card
            ),
          };
        }
      }

      return board;
    }));
  }, [activeBoardId, cards, categories, updateItemColor, updateCardCategory]);

  // Copy a card to another board as a linked copy
  const copyCardToBoard = useCallback((cardId, targetBoardId) => {
    const sourceCard = cards.find(c => c.id === cardId);
    if (!sourceCard || targetBoardId === activeBoardId) return;

    // Generate a sharedId if the source card doesn't have one
    const sharedId = sourceCard.sharedId || crypto.randomUUID();

    // Create the linked copy
    const linkedCopy = {
      ...sourceCard,
      id: crypto.randomUUID(),
      sharedId,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      categoryId: null, // Categories are per-board
      createdAt: Date.now(),
    };

    setBoards(prev => prev.map(board => {
      // Add sharedId to source card if it didn't have one
      if (board.id === activeBoardId && !sourceCard.sharedId) {
        return {
          ...board,
          cards: board.cards.map(card =>
            card.id === cardId ? { ...card, sharedId } : card
          ),
        };
      }

      // Add linked copy to target board
      if (board.id === targetBoardId) {
        return {
          ...board,
          cards: [...board.cards, linkedCopy],
        };
      }

      return board;
    }));

    // Log to archive
    const targetBoard = boards.find(b => b.id === targetBoardId);
    logEvent('created', 'card', createCardSnapshot(linkedCopy), {
      boardId: targetBoardId,
      boardName: targetBoard?.name || null,
    });
  }, [activeBoardId, boards, cards, logEvent]);

  // Called when title editing is complete (on blur) to update archive
  const finalizeCardTitle = useCallback((cardId, newTitle) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    const oldTitle = card.title;
    // Only update archive if title actually changed and card had a real title before
    if (card.hasRealTitle && oldTitle !== newTitle) {
      updateItemName('card', cardId, newTitle, oldTitle);
    } else {
      updateItemName('card', cardId, newTitle, null);
    }
  }, [cards, updateItemName]);

  const deleteCard = useCallback((cardId) => {
    // Capture card data before deletion for archive
    const cardToDelete = cards.find(c => c.id === cardId);
    if (cardToDelete) {
      // Find connected connections (to restore them on undo)
      const connectedConns = connections.filter(
        c => c.fromCardId === cardId || c.toCardId === cardId
      );
      const connectedCardIds = connectedConns.map(c =>
        c.fromCardId === cardId ? c.toCardId : c.fromCardId
      );
      const connectedCardTitles = connectedCardIds.map(id =>
        cards.find(c => c.id === id)?.title || 'Unknown'
      );

      // Find category info
      const category = categories.find(cat => cat.id === cardToDelete.categoryId);

      logEvent('deleted', 'card', createCardSnapshot(cardToDelete), {
        boardId: activeBoardId,
        boardName: activeBoard?.name || null,
        connectedCardIds,
        connectedCardTitles,
        categoryId: cardToDelete.categoryId || null,
        categoryTitle: category?.title || null,
      });

      // Push to undo stack
      setUndoStack(prev => [...prev, {
        type: 'card',
        boardId: activeBoardId,
        item: cardToDelete,
        connections: connectedConns,
      }]);
    }

    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? {
            ...board,
            cards: board.cards.filter(card => card.id !== cardId),
            // Also remove any connections involving this card
            connections: board.connections.filter(
              conn => conn.fromCardId !== cardId && conn.toCardId !== cardId
            ),
          }
        : board
    ));
    setSelectedCard(null);
  }, [activeBoardId, cards, connections, categories, activeBoard, logEvent]);

  // Connection management
  const addConnection = useCallback((fromCardId, toCardId) => {
    if (!activeBoardId || fromCardId === toCardId) return;

    // Check if connection already exists
    const exists = connections.some(
      conn => (conn.fromCardId === fromCardId && conn.toCardId === toCardId) ||
              (conn.fromCardId === toCardId && conn.toCardId === fromCardId)
    );
    if (exists) return;

    const newConnection = {
      id: crypto.randomUUID(),
      fromCardId,
      toCardId,
    };

    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? { ...board, connections: [...board.connections, newConnection] }
        : board
    ));
  }, [activeBoardId, connections]);

  const deleteConnection = useCallback((connectionId) => {
    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? { ...board, connections: board.connections.filter(conn => conn.id !== connectionId) }
        : board
    ));
  }, [activeBoardId]);

  // Category management
  const addCategory = useCallback((categoryData) => {
    if (!activeBoardId) return;

    const newCategory = {
      id: crypto.randomUUID(),
      title: categoryData.title || 'New Category',
      color: categoryData.color || '#4ECDC4',
      x: categoryData.x,
      y: categoryData.y,
      width: categoryData.width,
      height: categoryData.height,
      createdAt: Date.now(),
    };

    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? { ...board, categories: [...board.categories, newCategory] }
        : board
    ));

    // Log to archive
    logEvent('created', 'category', createCategorySnapshot(newCategory), {
      boardId: activeBoardId,
      boardName: activeBoard?.name || null,
    });

    return newCategory.id;
  }, [activeBoardId, activeBoard, logEvent]);

  const updateCategory = useCallback((categoryId, updates) => {
    // Check if title is being updated
    if (updates.title !== undefined) {
      const category = categories.find(cat => cat.id === categoryId);
      const oldTitle = category?.title;

      // Update archive events with new title (tracks previous titles internally)
      if (oldTitle && oldTitle !== 'New Category' && oldTitle !== updates.title) {
        updateItemName('category', categoryId, updates.title, oldTitle);
      } else {
        updateItemName('category', categoryId, updates.title, null);
      }
    }

    // Update archive events with new color (no logging, just update)
    if (updates.color !== undefined) {
      updateItemColor('category', categoryId, updates.color);
    }

    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? {
            ...board,
            categories: board.categories.map(cat =>
              cat.id === categoryId ? { ...cat, ...updates } : cat
            ),
          }
        : board
    ));
  }, [activeBoardId, categories, updateItemName, updateItemColor]);

  const deleteCategory = useCallback((categoryId) => {
    // Capture category data before deletion for archive
    const categoryToDelete = categories.find(cat => cat.id === categoryId);
    if (categoryToDelete) {
      logEvent('deleted', 'category', createCategorySnapshot(categoryToDelete), {
        boardId: activeBoardId,
        boardName: activeBoard?.name || null,
      });

      // Push to undo stack
      setUndoStack(prev => [...prev, {
        type: 'category',
        boardId: activeBoardId,
        item: categoryToDelete,
      }]);
    }

    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? { ...board, categories: board.categories.filter(cat => cat.id !== categoryId) }
        : board
    ));
  }, [activeBoardId, categories, activeBoard, logEvent]);

  // Shape management
  const addShape = useCallback((shapeData) => {
    if (!activeBoardId) return;

    const isTable = shapeData.type === 'table';
    const isDouble = shapeData.type === 'double-rounded';
    const newShape = {
      id: crypto.randomUUID(),
      type: shapeData.type || 'rectangle',
      x: shapeData.x,
      y: shapeData.y,
      width: shapeData.width || (isTable ? 280 : 120),
      height: isTable ? 140 : isDouble ? (shapeData.height || 160) : (shapeData.height || 80),
      label: '',
      labelBottom: isDouble ? '' : undefined,
      tableData: isTable ? [['', '', ''], ['', '', ''], ['', '', '']] : undefined,
      colWidths: isTable ? [93, 93, 94] : undefined,
      rowHeights: isTable ? [44, 44, 44] : undefined,
      color: null,
      linkedItemId: null,
      linkedItemType: null,
      portal: null,
      createdAt: Date.now(),
    };

    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? { ...board, shapes: [...board.shapes, newShape] }
        : board
    ));

    logEvent('created', 'shape', createShapeSnapshot(newShape), {
      boardId: activeBoardId,
      boardName: activeBoard?.name || null,
    });

    return newShape.id;
  }, [activeBoardId, activeBoard, logEvent]);

  const updateShape = useCallback((shapeId, updates) => {
    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? {
            ...board,
            shapes: board.shapes.map(s =>
              s.id === shapeId ? { ...s, ...updates } : s
            ),
          }
        : board
    ));
  }, [activeBoardId]);

  const deleteShape = useCallback((shapeId) => {
    const shapeToDelete = shapes.find(s => s.id === shapeId);
    if (shapeToDelete) {
      const connectedConns = connections.filter(
        c => c.fromCardId === shapeId || c.toCardId === shapeId
      );

      logEvent('deleted', 'shape', createShapeSnapshot(shapeToDelete), {
        boardId: activeBoardId,
        boardName: activeBoard?.name || null,
      });

      setUndoStack(prev => [...prev, {
        type: 'shape',
        boardId: activeBoardId,
        item: shapeToDelete,
        connections: connectedConns,
      }]);
    }

    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? {
            ...board,
            shapes: board.shapes.filter(s => s.id !== shapeId),
            connections: board.connections.filter(
              conn => conn.fromCardId !== shapeId && conn.toCardId !== shapeId
            ),
          }
        : board
    ));
  }, [activeBoardId, shapes, connections, activeBoard, logEvent]);

  // Undo last deletion
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    if (lastAction.type === 'card') {
      setBoards(prev => prev.map(board =>
        board.id === lastAction.boardId
          ? {
              ...board,
              cards: [...board.cards, lastAction.item],
              connections: [...board.connections, ...lastAction.connections],
            }
          : board
      ));
    } else if (lastAction.type === 'category') {
      setBoards(prev => prev.map(board =>
        board.id === lastAction.boardId
          ? { ...board, categories: [...board.categories, lastAction.item] }
          : board
      ));
    } else if (lastAction.type === 'shape') {
      setBoards(prev => prev.map(board =>
        board.id === lastAction.boardId
          ? {
              ...board,
              shapes: [...board.shapes, lastAction.item],
              connections: [...board.connections, ...lastAction.connections],
            }
          : board
      ));
    } else if (lastAction.type === 'checklist-item') {
      setBoards(prev => prev.map(board =>
        board.id === lastAction.boardId
          ? {
              ...board,
              cards: board.cards.map(card =>
                card.id === lastAction.cardId
                  ? {
                      ...card,
                      checklist: (() => {
                        const checklist = [...(card.checklist || [])];
                        // Insert at original index, or at end if index invalid
                        const insertAt = Math.min(lastAction.index, checklist.length);
                        checklist.splice(insertAt, 0, lastAction.item);
                        return checklist;
                      })(),
                    }
                  : card
              ),
            }
          : board
      ));
    }
  }, [undoStack]);

  // Keyboard shortcut for undo (Cmd+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  const handleColorChange = useCallback((color) => {
    if (selectedCard) {
      updateCard(selectedCard, { color });
    }
  }, [selectedCard, updateCard]);

  // Sync linked checklist items across all cards (for checked state)
  const syncLinkedChecklistItem = useCallback((sharedId, checked) => {
    if (!activeBoardId || !sharedId) return;

    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? {
            ...board,
            cards: board.cards.map(card => {
              if (!card.checklist) return card;
              const hasLinkedItem = card.checklist.some(item => item.sharedId === sharedId);
              if (!hasLinkedItem) return card;
              return {
                ...card,
                checklist: card.checklist.map(item =>
                  item.sharedId === sharedId ? { ...item, checked } : item
                ),
              };
            }),
          }
        : board
    ));
  }, [activeBoardId]);

  // Sync linked checklist item text across all cards
  const syncLinkedChecklistItemText = useCallback((sharedId, text) => {
    if (!activeBoardId || !sharedId) return;

    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? {
            ...board,
            cards: board.cards.map(card => {
              if (!card.checklist) return card;
              const hasLinkedItem = card.checklist.some(item => item.sharedId === sharedId);
              if (!hasLinkedItem) return card;
              return {
                ...card,
                checklist: card.checklist.map(item =>
                  item.sharedId === sharedId ? { ...item, text } : item
                ),
              };
            }),
          }
        : board
    ));
  }, [activeBoardId]);

  // Add a checklist item to a specific card (for drag-drop between cards)
  const addChecklistItemToCard = useCallback((cardId, item) => {
    if (!activeBoardId) return;

    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? {
            ...board,
            cards: board.cards.map(card =>
              card.id === cardId
                ? {
                    ...card,
                    checklist: [...(card.checklist || []), item],
                  }
                : card
            ),
          }
        : board
    ));
  }, [activeBoardId]);

  // Delete a checklist item (with undo support)
  const deleteChecklistItem = useCallback((cardId, itemId) => {
    if (!activeBoardId) return;

    // Find the item to delete for undo stack
    const card = cards.find(c => c.id === cardId);
    const itemToDelete = card?.checklist?.find(item => item.id === itemId);
    const itemIndex = card?.checklist?.findIndex(item => item.id === itemId) ?? -1;

    if (itemToDelete) {
      // Push to undo stack
      setUndoStack(prev => [...prev, {
        type: 'checklist-item',
        boardId: activeBoardId,
        cardId,
        item: itemToDelete,
        index: itemIndex,
      }]);
    }

    // Remove the item
    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? {
            ...board,
            cards: board.cards.map(c =>
              c.id === cardId
                ? { ...c, checklist: (c.checklist || []).filter(item => item.id !== itemId) }
                : c
            ),
          }
        : board
    ));
  }, [activeBoardId, cards]);

  // Update a checklist item's sharedId (when it becomes linked)
  const updateChecklistItemSharedId = useCallback((cardId, itemId, sharedId) => {
    if (!activeBoardId) return;

    setBoards(prev => prev.map(board =>
      board.id === activeBoardId
        ? {
            ...board,
            cards: board.cards.map(card =>
              card.id === cardId
                ? {
                    ...card,
                    checklist: (card.checklist || []).map(item =>
                      item.id === itemId ? { ...item, sharedId } : item
                    ),
                  }
                : card
            ),
          }
        : board
    ));
  }, [activeBoardId]);

  if (isLoading) {
    return (
      <div className="loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        boards={boards}
        activeBoardId={activeBoardId}
        cards={cards}
        categories={categories}
        shapes={shapes}
        viewOffset={viewOffset}
        zoom={zoom}
        viewportSize={viewportSize}
        onNavigate={setViewOffset}
        onSelectBoard={switchBoard}
        onAddBoard={addBoard}
        onDeleteBoard={deleteBoard}
        onRenameBoard={renameBoard}
        onReorderBoards={reorderBoards}
        archiveEventCount={archiveEvents.length}
      />
      <div className="main-content">
        {activeBoardId === ARCHIVE_BOARD_ID ? (
          <ArchiveBoard events={archiveEvents} />
        ) : (
          <>
            <Toolbar
              boardName={activeBoard?.name || 'Untitled'}
              selectedCard={selectedCard}
              selectedCardData={cards.find(c => c.id === selectedCard)}
              colors={COLORS}
              boards={boards}
              activeBoardId={activeBoardId}
              onColorChange={handleColorChange}
              onDelete={() => selectedCard && deleteCard(selectedCard)}
              onUndo={undo}
              onCopyToBoard={(targetBoardId) => selectedCard && copyCardToBoard(selectedCard, targetBoardId)}
              canUndo={undoStack.length > 0}
              cardCount={cards.length}
              isShapePaletteOpen={isShapePaletteOpen}
              onToggleShapePalette={() => setIsShapePaletteOpen(prev => !prev)}
              isHighlighterActive={isHighlighterActive}
              onToggleHighlighter={() => setIsHighlighterActive(prev => !prev)}
            />
            <Board
              cards={cards}
              connections={connections}
              categories={categories}
              shapes={shapes}
              selectedCard={selectedCard}
              todayString={todayString}
              viewOffset={viewOffset}
              zoom={zoom}
              isShapePaletteOpen={isShapePaletteOpen}
              onToggleShapePalette={() => setIsShapePaletteOpen(prev => !prev)}
              isHighlighterActive={isHighlighterActive}
              onViewOffsetChange={setViewOffset}
              onZoomChange={setZoom}
              onViewportSizeChange={setViewportSize}
              onSelectCard={setSelectedCard}
              onAddCard={addCard}
              onUpdateCard={updateCard}
              onFinalizeCardTitle={finalizeCardTitle}
              onDeleteCard={deleteCard}
              onAddConnection={addConnection}
              onDeleteConnection={deleteConnection}
              onAddCategory={addCategory}
              onUpdateCategory={updateCategory}
              onDeleteCategory={deleteCategory}
              onAddShape={addShape}
              onUpdateShape={updateShape}
              onDeleteShape={deleteShape}
              onSyncLinkedChecklistItem={syncLinkedChecklistItem}
              onSyncLinkedChecklistItemText={syncLinkedChecklistItemText}
              onAddChecklistItemToCard={addChecklistItemToCard}
              onUpdateChecklistItemSharedId={updateChecklistItemSharedId}
              onDeleteChecklistItem={deleteChecklistItem}
            />
          </>
        )}
      </div>
    </div>
  );
}
