import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import App from '../App';

// Helper: wait for the app to finish loading
const waitForApp = async () => {
  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
};

// Helper: get the board area
const getBoard = () => document.querySelector('.board');

describe('App initialization', () => {
  beforeEach(() => {
    window.electronAPI.loadData.mockResolvedValue({ boards: [] });
  });

  it('renders without crashing', async () => {
    render(<App />);
    await waitForApp();
    expect(document.querySelector('.app')).toBeInTheDocument();
  });

  it('creates a default board when no data exists', async () => {
    render(<App />);
    await waitForApp();
    expect(document.querySelector('.sidebar')).toBeInTheDocument();
    expect(document.querySelector('.board')).toBeInTheDocument();
  });

  it('loads existing boards from storage', async () => {
    window.electronAPI.loadData.mockResolvedValue({
      boards: [{
        id: 'board-1',
        name: 'Test Board',
        cards: [],
        connections: [],
        categories: [],
        shapes: [],
        createdAt: Date.now(),
      }],
      activeBoardId: 'board-1',
    });
    render(<App />);
    await waitForApp();
    expect(screen.getAllByText('Test Board').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Board management', () => {
  beforeEach(() => {
    window.electronAPI.loadData.mockResolvedValue({ boards: [] });
  });

  it('can add a new board', async () => {
    render(<App />);
    await waitForApp();
    const addBtn = document.querySelector('.add-board-btn');
    fireEvent.click(addBtn);
    const boardItems = document.querySelectorAll('.board-item');
    expect(boardItems.length).toBe(2); // default + new
  });
});

describe('Card creation', () => {
  beforeEach(() => {
    window.electronAPI.loadData.mockResolvedValue({ boards: [] });
  });

  it('creates a card on double-click', async () => {
    render(<App />);
    await waitForApp();

    const board = getBoard();
    const canvas = board.querySelector('.board-canvas');
    fireEvent.doubleClick(canvas, { clientX: 400, clientY: 300 });

    await waitFor(() => {
      expect(document.querySelector('.card')).toBeInTheDocument();
    });
  });

  it('creates a card with correct title on double-click', async () => {
    render(<App />);
    await waitForApp();

    const canvas = document.querySelector('.board-canvas');
    fireEvent.doubleClick(canvas, { clientX: 400, clientY: 300 });

    await waitFor(() => {
      expect(screen.getByText('New Note')).toBeInTheDocument();
    });
  });
});

describe('Card operations', () => {
  beforeEach(() => {
    window.electronAPI.loadData.mockResolvedValue({
      boards: [{
        id: 'board-1',
        name: 'Test Board',
        cards: [{
          id: 'card-1',
          title: 'Test Card',
          hasRealTitle: true,
          url: null,
          text: '',
          note: '',
          color: null,
          x: 100,
          y: 100,
          source: { type: 'note', name: 'Note', color: '#6B7280' },
          createdAt: Date.now(),
        }],
        connections: [],
        categories: [],
        shapes: [],
        createdAt: Date.now(),
      }],
      activeBoardId: 'board-1',
    });
  });

  it('renders existing cards', async () => {
    render(<App />);
    await waitForApp();
    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });

  it('selects a card on click', async () => {
    render(<App />);
    await waitForApp();

    const card = document.querySelector('.card');
    fireEvent.click(card);
    expect(card.classList.contains('selected')).toBe(true);
  });

  it('deletes a card via delete button', async () => {
    render(<App />);
    await waitForApp();

    // Select the card first
    const card = document.querySelector('.card');
    fireEvent.click(card);

    const deleteBtn = card.querySelector('.card-delete-btn');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(document.querySelector('.card')).not.toBeInTheDocument();
    });
  });

  it('can undo a card deletion with Cmd+Z', async () => {
    render(<App />);
    await waitForApp();

    const card = document.querySelector('.card');
    fireEvent.click(card);
    fireEvent.click(card.querySelector('.card-delete-btn'));

    await waitFor(() => {
      expect(document.querySelector('.card')).not.toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'z', metaKey: true });

    await waitFor(() => {
      expect(screen.getByText('Test Card')).toBeInTheDocument();
    });
  });

  it('sets color on a card', async () => {
    render(<App />);
    await waitForApp();

    const card = document.querySelector('.card');
    fireEvent.click(card);

    const colorBtn = card.querySelector('.card-color-circle-btn');
    fireEvent.click(colorBtn);

    const swatches = card.querySelectorAll('.color-swatch');
    // Click the red swatch (index 1, first non-null)
    fireEvent.click(swatches[1]);

    await waitFor(() => {
      expect(card.querySelector('.card-color-bar')).toBeInTheDocument();
    });
  });
});

describe('Connections', () => {
  beforeEach(() => {
    window.electronAPI.loadData.mockResolvedValue({
      boards: [{
        id: 'board-1',
        name: 'Test Board',
        cards: [
          {
            id: 'card-a', title: 'Card A', hasRealTitle: true, url: null, text: '', note: '',
            color: null, x: 100, y: 100, source: { type: 'note', name: 'Note', color: '#6B7280' },
            createdAt: Date.now(),
          },
          {
            id: 'card-b', title: 'Card B', hasRealTitle: true, url: null, text: '', note: '',
            color: null, x: 400, y: 100, source: { type: 'note', name: 'Note', color: '#6B7280' },
            createdAt: Date.now(),
          },
        ],
        connections: [{
          id: 'conn-1',
          fromCardId: 'card-a',
          toCardId: 'card-b',
        }],
        categories: [],
        shapes: [],
        createdAt: Date.now(),
      }],
      activeBoardId: 'board-1',
    });
  });

  it('renders connection lines between cards', async () => {
    render(<App />);
    await waitForApp();

    const svg = document.querySelector('.connections-layer');
    expect(svg).toBeInTheDocument();
    const paths = svg.querySelectorAll('.connection-line');
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });

  it('removes a connection on right-click', async () => {
    render(<App />);
    await waitForApp();

    const hitarea = document.querySelector('.connection-hitarea');
    fireEvent.contextMenu(hitarea);

    await waitFor(() => {
      expect(document.querySelector('.connection-hitarea')).not.toBeInTheDocument();
    });
  });
});

describe('Search', () => {
  beforeEach(() => {
    window.electronAPI.loadData.mockResolvedValue({
      boards: [{
        id: 'board-1',
        name: 'Test Board',
        cards: [
          {
            id: 'card-1', title: 'Alpha Card', hasRealTitle: true, url: null, text: '', note: 'has a note',
            color: null, x: 100, y: 100, source: { type: 'note', name: 'Note', color: '#6B7280' },
            createdAt: Date.now(),
          },
          {
            id: 'card-2', title: 'Beta Card', hasRealTitle: true, url: null, text: '', note: '',
            color: null, x: 400, y: 400, source: { type: 'note', name: 'Note', color: '#6B7280' },
            createdAt: Date.now(),
          },
        ],
        connections: [],
        categories: [],
        shapes: [],
        createdAt: Date.now(),
      }],
      activeBoardId: 'board-1',
    });
  });

  it('opens search with Cmd+F', async () => {
    render(<App />);
    await waitForApp();

    fireEvent.keyDown(window, { key: 'f', metaKey: true });

    await waitFor(() => {
      expect(document.querySelector('.search-overlay')).toBeInTheDocument();
    });
  });

  it('filters cards by title', async () => {
    render(<App />);
    await waitForApp();

    fireEvent.keyDown(window, { key: 'f', metaKey: true });

    const input = document.querySelector('.search-input');
    fireEvent.change(input, { target: { value: 'Alpha' } });

    await waitFor(() => {
      expect(document.querySelector('.search-count').textContent).toBe('1/1');
    });
  });

  it('searches note content', async () => {
    render(<App />);
    await waitForApp();

    fireEvent.keyDown(window, { key: 'f', metaKey: true });
    const input = document.querySelector('.search-input');
    fireEvent.change(input, { target: { value: 'note' } });

    await waitFor(() => {
      expect(document.querySelector('.search-count').textContent).toBe('1/1');
    });
  });

  it('shows no results for unmatched query', async () => {
    render(<App />);
    await waitForApp();

    fireEvent.keyDown(window, { key: 'f', metaKey: true });
    const input = document.querySelector('.search-input');
    fireEvent.change(input, { target: { value: 'zzzznotfound' } });

    await waitFor(() => {
      expect(document.querySelector('.search-count').textContent).toBe('No results');
    });
  });

  it('closes search with Escape', async () => {
    render(<App />);
    await waitForApp();

    fireEvent.keyDown(window, { key: 'f', metaKey: true });
    expect(document.querySelector('.search-overlay')).toBeInTheDocument();

    const input = document.querySelector('.search-input');
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(document.querySelector('.search-overlay')).not.toBeInTheDocument();
    });
  });
});

describe('Shapes', () => {
  beforeEach(() => {
    window.electronAPI.loadData.mockResolvedValue({
      boards: [{
        id: 'board-1',
        name: 'Test Board',
        cards: [],
        connections: [],
        categories: [],
        shapes: [{
          id: 'shape-1',
          type: 'rectangle',
          x: 200, y: 200,
          width: 120, height: 80,
          label: 'My Shape',
          color: null,
          createdAt: Date.now(),
        }],
        createdAt: Date.now(),
      }],
      activeBoardId: 'board-1',
    });
  });

  it('renders existing shapes', async () => {
    render(<App />);
    await waitForApp();
    expect(document.querySelector('.shape-node')).toBeInTheDocument();
  });

  it('displays shape label', async () => {
    render(<App />);
    await waitForApp();
    expect(screen.getByText('My Shape')).toBeInTheDocument();
  });
});

describe('Table shape', () => {
  beforeEach(() => {
    window.electronAPI.loadData.mockResolvedValue({
      boards: [{
        id: 'board-1',
        name: 'Test Board',
        cards: [],
        connections: [],
        categories: [],
        shapes: [{
          id: 'table-1',
          type: 'table',
          x: 100, y: 100,
          width: 280, height: 140,
          label: '',
          tableData: [['Name', 'Age', 'City'], ['Alice', '30', 'NYC'], ['Bob', '25', 'LA']],
          colWidths: [93, 93, 94],
          rowHeights: [44, 44, 44],
          color: null,
          createdAt: Date.now(),
        }],
        createdAt: Date.now(),
      }],
      activeBoardId: 'board-1',
    });
  });

  it('renders table with cells', async () => {
    render(<App />);
    await waitForApp();
    expect(document.querySelector('.shape-table-grid')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('NYC')).toBeInTheDocument();
  });

  it('renders correct number of cells', async () => {
    render(<App />);
    await waitForApp();
    const cells = document.querySelectorAll('.shape-table-cell');
    expect(cells.length).toBe(9); // 3x3
  });

  it('styles first row as header', async () => {
    render(<App />);
    await waitForApp();
    const headerCells = document.querySelectorAll('.shape-table-cell.header');
    expect(headerCells.length).toBe(3);
  });

  it('enters edit mode on cell double-click', async () => {
    render(<App />);
    await waitForApp();

    const cell = screen.getByText('Alice').closest('.shape-table-cell');
    fireEvent.doubleClick(cell);

    await waitFor(() => {
      expect(cell.querySelector('.shape-table-cell-input')).toBeInTheDocument();
    });
  });

  it('shows add/remove controls when selected', async () => {
    render(<App />);
    await waitForApp();

    // mouseDown on the shape-node (not on a cell/textarea) to select it
    const shape = document.querySelector('.shape-node');
    fireEvent.mouseDown(shape, { button: 0 });

    await waitFor(() => {
      expect(screen.getByText('+Row')).toBeInTheDocument();
      expect(screen.getByText('+Col')).toBeInTheDocument();
      expect(screen.getByText('-Row')).toBeInTheDocument();
      expect(screen.getByText('-Col')).toBeInTheDocument();
    });
  });

  it('adds a row', async () => {
    render(<App />);
    await waitForApp();

    const shape = document.querySelector('.shape-node');
    fireEvent.mouseDown(shape, { button: 0 });

    await waitFor(() => screen.getByText('+Row'));
    fireEvent.click(screen.getByText('+Row'));

    await waitFor(() => {
      const cells = document.querySelectorAll('.shape-table-cell');
      expect(cells.length).toBe(12); // 4x3
    });
  });

  it('adds a column', async () => {
    render(<App />);
    await waitForApp();

    const shape = document.querySelector('.shape-node');
    fireEvent.mouseDown(shape, { button: 0 });

    await waitFor(() => screen.getByText('+Col'));
    fireEvent.click(screen.getByText('+Col'));

    await waitFor(() => {
      const cells = document.querySelectorAll('.shape-table-cell');
      expect(cells.length).toBe(12); // 3x4
    });
  });

  it('removes a row', async () => {
    render(<App />);
    await waitForApp();

    const shape = document.querySelector('.shape-node');
    fireEvent.mouseDown(shape, { button: 0 });

    await waitFor(() => screen.getByText('-Row'));
    fireEvent.click(screen.getByText('-Row'));

    await waitFor(() => {
      const cells = document.querySelectorAll('.shape-table-cell');
      expect(cells.length).toBe(6); // 2x3
    });
  });

  it('removes a column', async () => {
    render(<App />);
    await waitForApp();

    const shape = document.querySelector('.shape-node');
    fireEvent.mouseDown(shape, { button: 0 });

    await waitFor(() => screen.getByText('-Col'));
    fireEvent.click(screen.getByText('-Col'));

    await waitFor(() => {
      const cells = document.querySelectorAll('.shape-table-cell');
      expect(cells.length).toBe(6); // 3x2
    });
  });

  it('renders dividers for resizing', async () => {
    render(<App />);
    await waitForApp();
    // 2 column dividers (3 cols - 1) + 2 row dividers (3 rows - 1)
    expect(document.querySelectorAll('.col-divider').length).toBe(2);
    expect(document.querySelectorAll('.row-divider').length).toBe(2);
  });

  it('handles tables without stored colWidths/rowHeights (migration)', async () => {
    window.electronAPI.loadData.mockResolvedValue({
      boards: [{
        id: 'board-1',
        name: 'Test Board',
        cards: [],
        connections: [],
        categories: [],
        shapes: [{
          id: 'old-table',
          type: 'table',
          x: 100, y: 100,
          width: 240, height: 120,
          label: '',
          tableData: [['A', 'B'], ['C', 'D']],
          // No colWidths or rowHeights — simulating old data
          color: null,
          createdAt: Date.now(),
        }],
        createdAt: Date.now(),
      }],
      activeBoardId: 'board-1',
    });

    render(<App />);
    await waitForApp();

    // Should still render correctly with computed fallbacks
    const cells = document.querySelectorAll('.shape-table-cell');
    expect(cells.length).toBe(4);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument();
  });
});

describe('Portal', () => {
  beforeEach(() => {
    window.electronAPI.loadData.mockResolvedValue({
      boards: [{
        id: 'board-1',
        name: 'Test Board',
        cards: [
          {
            id: 'card-1', title: 'Source Card', hasRealTitle: true, url: null, text: '', note: '',
            color: null, x: 100, y: 100,
            source: { type: 'note', name: 'Note', color: '#6B7280' },
            portal: { targetId: 'card-2', targetType: 'card' },
            createdAt: Date.now(),
          },
          {
            id: 'card-2', title: 'Target Card', hasRealTitle: true, url: null, text: '', note: '',
            color: null, x: 800, y: 800,
            source: { type: 'note', name: 'Note', color: '#6B7280' },
            createdAt: Date.now(),
          },
        ],
        connections: [],
        categories: [],
        shapes: [],
        createdAt: Date.now(),
      }],
      activeBoardId: 'board-1',
    });
  });

  it('renders portal pin on card with portal', async () => {
    render(<App />);
    await waitForApp();
    expect(document.querySelector('.portal-pin')).toBeInTheDocument();
  });

  it('shows clear button on portal pin hover', async () => {
    render(<App />);
    await waitForApp();
    // The clear button exists in DOM but hidden via CSS display:none until hover
    const clearBtn = document.querySelector('.portal-pin-clear');
    expect(clearBtn).toBeInTheDocument();
  });

  it('clears portal when clear button clicked', async () => {
    render(<App />);
    await waitForApp();

    const clearBtn = document.querySelector('.portal-pin-clear');
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(document.querySelector('.portal-pin')).not.toBeInTheDocument();
    });
  });
});

describe('Categories', () => {
  beforeEach(() => {
    window.electronAPI.loadData.mockResolvedValue({
      boards: [{
        id: 'board-1',
        name: 'Test Board',
        cards: [{
          id: 'card-1', title: 'Inside Card', hasRealTitle: true, url: null, text: '', note: '',
          color: null, x: 150, y: 150, categoryId: 'cat-1',
          source: { type: 'note', name: 'Note', color: '#6B7280' },
          createdAt: Date.now(),
        }],
        connections: [],
        categories: [{
          id: 'cat-1',
          title: 'My Category',
          color: '#4ECDC4',
          x: 50, y: 50,
          width: 300, height: 300,
          createdAt: Date.now(),
        }],
        shapes: [],
        createdAt: Date.now(),
      }],
      activeBoardId: 'board-1',
    });
  });

  it('renders categories', async () => {
    render(<App />);
    await waitForApp();
    expect(screen.getByText('My Category')).toBeInTheDocument();
  });

  it('renders cards inside categories', async () => {
    render(<App />);
    await waitForApp();
    expect(screen.getByText('Inside Card')).toBeInTheDocument();
  });

  it('hides cards when category is collapsed', async () => {
    render(<App />);
    await waitForApp();

    // Click the category to select it
    const category = document.querySelector('.category');
    fireEvent.click(category);

    // Click collapse button
    const collapseBtn = category.querySelector('.category-collapse-btn');
    fireEvent.click(collapseBtn);

    await waitFor(() => {
      // Card should be hidden (not rendered)
      const cards = document.querySelectorAll('.card');
      expect(cards.length).toBe(0);
    });
  });
});

describe('Data persistence', () => {
  it('auto-saves when boards change', async () => {
    window.electronAPI.loadData.mockResolvedValue({ boards: [] });
    render(<App />);
    await waitForApp();

    // Creating a card triggers a save
    const canvas = document.querySelector('.board-canvas');
    fireEvent.doubleClick(canvas, { clientX: 400, clientY: 300 });

    await waitFor(() => {
      expect(window.electronAPI.saveData).toHaveBeenCalled();
    }, { timeout: 2000 });
  });
});
