import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook for managing archive events
 * Handles loading, saving, and logging archive events
 */
export function useArchive() {
  const [archiveEvents, setArchiveEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef(null);

  // Load archive on mount
  useEffect(() => {
    const loadArchive = async () => {
      if (window.electronAPI?.loadArchive) {
        try {
          const data = await window.electronAPI.loadArchive();
          setArchiveEvents(data.events || []);
        } catch (error) {
          console.error('Error loading archive:', error);
          setArchiveEvents([]);
        }
      }
      setIsLoading(false);
    };
    loadArchive();
  }, []);

  // Debounced save whenever archiveEvents changes
  useEffect(() => {
    if (isLoading) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (window.electronAPI?.saveArchive) {
        window.electronAPI.saveArchive({ version: 1, events: archiveEvents });
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [archiveEvents, isLoading]);

  /**
   * Log an archive event
   * @param {'created' | 'deleted'} eventType - The type of event
   * @param {'board' | 'card' | 'category'} itemType - The type of item
   * @param {object} snapshot - A snapshot of the item's data
   * @param {object} context - Relational context (board, connections, etc.)
   */
  const logEvent = useCallback((eventType, itemType, snapshot, context) => {
    const event = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      eventType,
      itemType,
      snapshot,
      context: {
        boardId: context.boardId ?? null,
        boardName: context.boardName ?? null,
        connectedCardIds: context.connectedCardIds || [],
        connectedCardTitles: context.connectedCardTitles || [],
        categoryId: context.categoryId ?? null,
        categoryTitle: context.categoryTitle ?? null,
        cardCount: context.cardCount ?? 0,
        categoryCount: context.categoryCount ?? 0,
      },
    };

    setArchiveEvents(prev => [event, ...prev]);
  }, []);

  /**
   * Update item color in archive events
   * @param {'card' | 'category'} itemType - The type of item
   * @param {string} itemId - The ID of the item
   * @param {string} newColor - The new color
   */
  const updateItemColor = useCallback((itemType, itemId, newColor) => {
    setArchiveEvents(prev => prev.map(event => {
      if (event.itemType === itemType && event.snapshot.id === itemId) {
        return {
          ...event,
          snapshot: { ...event.snapshot, color: newColor },
        };
      }
      return event;
    }));
  }, []);

  /**
   * Update card's category context in archive events
   * @param {string} cardId - The card ID
   * @param {string|null} categoryId - The new category ID
   * @param {string|null} categoryTitle - The new category title
   */
  const updateCardCategory = useCallback((cardId, categoryId, categoryTitle) => {
    setArchiveEvents(prev => prev.map(event => {
      if (event.itemType === 'card' && event.snapshot.id === cardId) {
        return {
          ...event,
          snapshot: { ...event.snapshot, categoryId },
          context: { ...event.context, categoryId, categoryTitle },
        };
      }
      return event;
    }));
  }, []);

  /**
   * Update item names in archive events when items are renamed
   * Also tracks previous names on the item's own events
   * @param {'board' | 'card' | 'category'} itemType - The type of item being renamed
   * @param {string} itemId - The ID of the item being renamed
   * @param {string} newName - The new name/title
   * @param {string} oldName - The previous name/title (to track history)
   */
  const updateItemName = useCallback((itemType, itemId, newName, oldName) => {
    setArchiveEvents(prev => prev.map(event => {
      let updated = { ...event };

      // Update snapshot if this event is for the renamed item
      if (event.itemType === itemType) {
        if (itemType === 'board' && event.snapshot.id === itemId) {
          // Track previous names
          const previousNames = event.snapshot.previousNames || [];
          if (oldName && !previousNames.includes(oldName)) {
            previousNames.push(oldName);
          }
          updated.snapshot = { ...event.snapshot, name: newName, previousNames };
        } else if ((itemType === 'card' || itemType === 'category') && event.snapshot.id === itemId) {
          // Track previous titles
          const previousTitles = event.snapshot.previousTitles || [];
          if (oldName && !previousTitles.includes(oldName)) {
            previousTitles.push(oldName);
          }
          updated.snapshot = { ...event.snapshot, title: newName, previousTitles };
        }
      }

      // Update context references
      if (itemType === 'board' && event.context.boardId === itemId) {
        updated.context = { ...event.context, boardName: newName };
      } else if (itemType === 'category' && event.context.categoryId === itemId) {
        updated.context = { ...event.context, categoryTitle: newName };
      } else if (itemType === 'card') {
        // Update connected card titles
        const connectedIndex = event.context.connectedCardIds?.indexOf(itemId);
        if (connectedIndex !== undefined && connectedIndex >= 0) {
          const newTitles = [...(event.context.connectedCardTitles || [])];
          newTitles[connectedIndex] = newName;
          updated.context = { ...event.context, connectedCardTitles: newTitles };
        }
      }

      return updated;
    }));
  }, []);

  return {
    archiveEvents,
    logEvent,
    updateItemName,
    updateItemColor,
    updateCardCategory,
    isLoading,
  };
}
