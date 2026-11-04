import React, { useState, useRef, useEffect } from 'react';

export default function PortalPicker({ cards, shapes, categories, excludeId, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const q = query.toLowerCase();

  const matchedCards = cards.filter(c =>
    c.id !== excludeId && (c.title || '').toLowerCase().includes(q)
  );
  const matchedShapes = shapes.filter(s =>
    s.id !== excludeId && (s.label || s.type || '').toLowerCase().includes(q)
  );
  const matchedCategories = categories.filter(c =>
    c.id !== excludeId && (c.title || '').toLowerCase().includes(q)
  );

  const hasResults = matchedCards.length + matchedShapes.length + matchedCategories.length > 0;

  return (
    <div className="portal-picker-backdrop" onClick={onClose}>
      <div className="portal-picker" onClick={(e) => e.stopPropagation()}>
        <div className="portal-picker-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for target..."
            className="portal-picker-input"
          />
        </div>
        <div className="portal-picker-list">
          {matchedCards.length > 0 && (
            <div className="portal-picker-group">
              <div className="portal-picker-group-label">Cards</div>
              {matchedCards.map(c => (
                <button key={c.id} className="portal-picker-item" onClick={() => onSelect(c.id, 'card')}>
                  <span className="portal-picker-item-icon">{c.customEmoji || '🗂'}</span>
                  <span className="portal-picker-item-name">{c.title || 'Untitled'}</span>
                </button>
              ))}
            </div>
          )}
          {matchedShapes.length > 0 && (
            <div className="portal-picker-group">
              <div className="portal-picker-group-label">Shapes</div>
              {matchedShapes.map(s => (
                <button key={s.id} className="portal-picker-item" onClick={() => onSelect(s.id, 'shape')}>
                  <span className="portal-picker-item-icon">◆</span>
                  <span className="portal-picker-item-name">{s.label || s.type}</span>
                </button>
              ))}
            </div>
          )}
          {matchedCategories.length > 0 && (
            <div className="portal-picker-group">
              <div className="portal-picker-group-label">Categories</div>
              {matchedCategories.map(c => (
                <button key={c.id} className="portal-picker-item" onClick={() => onSelect(c.id, 'category')}>
                  <span className="portal-picker-item-icon" style={{ color: c.color }}>■</span>
                  <span className="portal-picker-item-name">{c.title}</span>
                </button>
              ))}
            </div>
          )}
          {!hasResults && query && (
            <div className="portal-picker-empty">No matches</div>
          )}
        </div>
      </div>
    </div>
  );
}
