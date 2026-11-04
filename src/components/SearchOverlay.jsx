import React, { useState, useRef, useEffect, useCallback } from 'react';

export default function SearchOverlay({ cards, onNavigateToCard, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search cards whenever query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setActiveIndex(0);
      return;
    }

    const q = query.toLowerCase();
    const matched = cards.filter(card => {
      const title = (card.title || '').toLowerCase();
      const note = (card.note || '').replace(/<\/?mark>/g, '').toLowerCase();
      const desc = (card.description || '').toLowerCase();
      const text = (card.text || '').toLowerCase();
      const checklistText = (card.checklist || [])
        .map(item => (item.text || '').replace(/<\/?mark>/g, ''))
        .join(' ')
        .toLowerCase();
      return title.includes(q) || note.includes(q) || desc.includes(q) || text.includes(q) || checklistText.includes(q);
    });

    setResults(matched);
    setActiveIndex(0);
  }, [query, cards]);

  const navigateTo = useCallback((card) => {
    if (card) {
      onNavigateToCard(card.id);
    }
  }, [onNavigateToCard]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) {
        navigateTo(results[activeIndex]);
        if (e.shiftKey) {
          // Shift+Enter = previous
          setActiveIndex(prev => (prev - 1 + results.length) % results.length);
        } else {
          // Enter = next
          setActiveIndex(prev => (prev + 1) % results.length);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length > 0) {
        const next = (activeIndex + 1) % results.length;
        setActiveIndex(next);
        navigateTo(results[next]);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length > 0) {
        const prev = (activeIndex - 1 + results.length) % results.length;
        setActiveIndex(prev);
        navigateTo(results[prev]);
      }
    }
  }, [results, activeIndex, navigateTo, onClose]);

  // Navigate to first result when results change
  useEffect(() => {
    if (results.length > 0 && activeIndex === 0) {
      navigateTo(results[0]);
    }
  }, [results]);

  return (
    <div className="search-overlay">
      <div className="search-box">
        <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search cards..."
        />
        {query && (
          <span className="search-count">
            {results.length > 0 ? `${activeIndex + 1}/${results.length}` : 'No results'}
          </span>
        )}
        <button className="search-close-btn" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
