import React, { useState, useRef, useEffect } from 'react';

export default function Toolbar({ boardName, selectedCard, selectedCardData, boards, activeBoardId, onDelete, onUndo, onCopyToBoard, canUndo, cardCount, isShapePaletteOpen, onToggleShapePalette, isHighlighterActive, onToggleHighlighter }) {
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const copyMenuRef = useRef(null);

  const otherBoards = boards.filter(b => b.id !== activeBoardId);
  const isLinked = selectedCardData?.sharedId;

  // Close menu when clicking outside
  useEffect(() => {
    if (!showCopyMenu) return;

    const handleClickOutside = (e) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target)) {
        setShowCopyMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCopyMenu]);

  // Close menu when card is deselected
  useEffect(() => {
    if (!selectedCard) {
      setShowCopyMenu(false);
    }
  }, [selectedCard]);

  const handleCopyToBoard = (boardId) => {
    onCopyToBoard(boardId);
    setShowCopyMenu(false);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-title">
        <h1>{boardName}</h1>
        <span className="card-count">{cardCount} items</span>
      </div>

      <div className="toolbar-actions">
        <button
          className={`shape-palette-btn ${isShapePaletteOpen ? 'active' : ''}`}
          onClick={onToggleShapePalette}
          title="Toggle shape palette"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <rect x="3" y="3" width="7" height="7" />
            <circle cx="17.5" cy="6.5" r="3.5" />
            <polygon points="6.5,14 10,21 3,21" />
            <rect x="14" y="14" width="7" height="7" rx="2" />
          </svg>
          Shapes
        </button>
        <button
          className={`highlighter-btn ${isHighlighterActive ? 'active' : ''}`}
          onClick={onToggleHighlighter}
          title="Toggle highlighter - click checklist items or notes to highlight"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M15.5 4.5l4 4L8 20H4v-4L15.5 4.5z" />
            <path d="M12.5 7.5l4 4" />
            <path d="M4 20h5" />
          </svg>
          Highlight
        </button>
        {canUndo && (
          <button className="undo-btn" onClick={onUndo} title="Undo (⌘Z)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 10h10a5 5 0 015 5v2M3 10l5 5M3 10l5-5"/>
            </svg>
            Undo
          </button>
        )}
        {selectedCard && (
          <>
            {isLinked && (
              <span className="linked-indicator" title="This card is linked to copies on other boards">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Linked
              </span>
            )}
            <div className="copy-to-board-wrapper" ref={copyMenuRef}>
              <button
                className="copy-to-board-btn"
                onClick={() => setShowCopyMenu(!showCopyMenu)}
                title="Copy to another board (linked)"
                disabled={otherBoards.length === 0}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Copy to board
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chevron">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {showCopyMenu && otherBoards.length > 0 && (
                <div className="copy-menu">
                  {otherBoards.map(board => (
                    <button
                      key={board.id}
                      className="copy-menu-item"
                      onClick={() => handleCopyToBoard(board.id)}
                    >
                      {board.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="delete-btn" onClick={onDelete} title="Delete card">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
              </svg>
            </button>
          </>
        )}
      </div>

      <div className="toolbar-help">
        <span>Drag links here from browser or Slack</span>
      </div>
    </div>
  );
}
