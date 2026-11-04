import React, { useState, useRef, useEffect } from 'react';
import Minimap from './Minimap';
import { ARCHIVE_BOARD_ID } from '../App';

export default function Sidebar({
  boards,
  activeBoardId,
  cards,
  categories,
  shapes = [],
  viewOffset,
  zoom,
  viewportSize,
  onNavigate,
  onSelectBoard,
  onAddBoard,
  onDeleteBoard,
  onRenameBoard,
  onReorderBoards,
  archiveEventCount = 0,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [draggedBoardId, setDraggedBoardId] = useState(null);
  const [dragOverBoardId, setDragOverBoardId] = useState(null);
  const inputRef = useRef(null);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (window.electronAPI?.checkGoogleAuth) {
        const result = await window.electronAPI.checkGoogleAuth();
        setIsGoogleSignedIn(result.authenticated);
      }
    };
    checkAuth();
  }, []);

  const handleGoogleSignIn = async () => {
    if (!window.electronAPI?.googleSignIn) return;
    setIsSigningIn(true);
    try {
      const result = await window.electronAPI.googleSignIn();
      setIsGoogleSignedIn(result.success);
    } catch (error) {
      console.error('Sign-in error:', error);
    }
    setIsSigningIn(false);
  };

  const handleGoogleSignOut = async () => {
    if (!window.electronAPI?.googleSignOut) return;
    await window.electronAPI.googleSignOut();
    setIsGoogleSignedIn(false);
  };

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (board) => {
    setEditingId(board.id);
    setEditValue(board.name);
  };

  const handleFinishRename = () => {
    if (editingId && editValue.trim()) {
      onRenameBoard(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleFinishRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditValue('');
    }
  };

  const handleDragStart = (e, boardId) => {
    setDraggedBoardId(boardId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, boardId) => {
    e.preventDefault();
    if (boardId !== draggedBoardId) {
      setDragOverBoardId(boardId);
    }
  };

  const handleDragLeave = () => {
    setDragOverBoardId(null);
  };

  const handleDrop = (e, targetBoardId) => {
    e.preventDefault();
    if (draggedBoardId && targetBoardId !== draggedBoardId) {
      const draggedIndex = boards.findIndex(b => b.id === draggedBoardId);
      const targetIndex = boards.findIndex(b => b.id === targetBoardId);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newBoards = [...boards];
        const [removed] = newBoards.splice(draggedIndex, 1);
        newBoards.splice(targetIndex, 0, removed);
        onReorderBoards(newBoards);
      }
    }
    setDraggedBoardId(null);
    setDragOverBoardId(null);
  };

  const handleDragEnd = () => {
    setDraggedBoardId(null);
    setDragOverBoardId(null);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Boards</h2>
        <button className="add-board-btn" onClick={onAddBoard} title="New board">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="board-list">
        {boards.map(board => (
          <div
            key={board.id}
            className={`board-item ${board.id === activeBoardId ? 'active' : ''} ${draggedBoardId === board.id ? 'dragging' : ''} ${dragOverBoardId === board.id ? 'drag-over' : ''}`}
            onClick={() => onSelectBoard(board.id)}
            draggable={editingId !== board.id}
            onDragStart={(e) => handleDragStart(e, board.id)}
            onDragOver={(e) => handleDragOver(e, board.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, board.id)}
            onDragEnd={handleDragEnd}
          >
            <div className="board-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M8 7h8M8 12h8M8 17h4" />
              </svg>
            </div>

            {editingId === board.id ? (
              <input
                ref={inputRef}
                type="text"
                className="board-name-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="board-name">{board.name}</span>
            )}

            <div className="board-actions">
              <button
                className="board-action-btn"
                onClick={(e) => { e.stopPropagation(); handleStartRename(board); }}
                title="Rename"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                className="board-action-btn delete"
                onClick={(e) => { e.stopPropagation(); onDeleteBoard(board.id); }}
                title="Delete"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>

            <span className="board-card-count">{board.cards.length}</span>
          </div>
        ))}
      </div>

      <div className="archive-link-container">
        <button
          className={`archive-link ${activeBoardId === ARCHIVE_BOARD_ID ? 'active' : ''}`}
          onClick={() => onSelectBoard(ARCHIVE_BOARD_ID)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 8v13H3V8" />
            <path d="M1 3h22v5H1z" />
            <path d="M10 12h4" />
          </svg>
          <span>Archive</span>
          {archiveEventCount > 0 && (
            <span className="archive-count-badge">{archiveEventCount}</span>
          )}
        </button>
      </div>

      <Minimap
        cards={cards}
        categories={categories}
        shapes={shapes}
        viewOffset={viewOffset}
        zoom={zoom}
        viewportWidth={viewportSize.width}
        viewportHeight={viewportSize.height}
        onNavigate={onNavigate}
      />

      <div className="sidebar-footer">
        <p className="auth-label">Connections</p>

        {isGoogleSignedIn ? (
          <button className="service-auth-btn signed-in" onClick={handleGoogleSignOut}>
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Google</span>
          </button>
        ) : (
          <button
            className="service-auth-btn"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{isSigningIn ? 'Signing in...' : 'Google'}</span>
          </button>
        )}

        <button
          className="service-auth-btn slack unavailable"
          disabled
          title="Coming soon"
        >
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="#999" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
            <path fill="#999" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
            <path fill="#999" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/>
            <path fill="#999" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
          </svg>
          <span>Slack (coming soon)</span>
        </button>
      </div>
    </div>
  );
}
