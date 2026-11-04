# InfoBoard

A desktop information board application for organizing links, notes, and resources visually on an infinite canvas. 

## Cards
You can copy-paste links as cards onto the board. Google Drive links work if you log into your Drive via the GUI. Cards can be color-coded and
emojis can be assigned by clicking the link symbol in the top left corner. You can also make notes on the cards, highlight parts of
your notes, and add to-do lists. You can even assign calendar dates to the cards that will turn the card a different color when you're a couple of days out from that date.

## Categories and connections
Cards can be categorized by option-click-dragging category boxes (cards need to be re-positioned within the category box to stick to it.) 
You can draw connections between cards, other cards and category boxes; clicking a connection will take you to its other end, whereas ctrl-clicking will
delete it. Don't ask about the portal pins. 

## Minimap
There is a minimap.

## Shapes
You can add flow chart shapes in addition to cards.

## Archive
This tracks the changes you make to all your boards. I added it thinking it could help me track how my ideas change over time, but I ended up just making
new boards when my framing changed.

## Known issues
- It's blurry.
- The application is called MimBoard *and* InfoBoard. MimBoard is from Mimid because I like Birds.

Remainder of documentation is Claudish.

## Tech Stack

- **Frontend**: React 18 + Vite
- **Desktop**: Electron 28
- **Packaging**: electron-builder
- **Emoji Picker**: @emoji-mart/react

## Project Structure

```
info_board/
├── electron/
│   ├── main.js           # Electron main process
│   ├── preload.js        # Context bridge for IPC
│   └── slack-preload.js  # Slack auth preload
├── src/
│   ├── App.jsx           # Main app - state management, board/card CRUD
│   ├── index.jsx         # React entry point
│   ├── components/
│   │   ├── ArchiveBoard.jsx # Timeline view of archived events
│   │   ├── Board.jsx     # Canvas with pan/zoom, drag-drop, card/category rendering
│   │   ├── Card.jsx      # Individual content cards with emoji picker
│   │   ├── Category.jsx  # Grouping regions for cards
│   │   ├── Connections.jsx # SVG lines between cards/categories
│   │   ├── Minimap.jsx   # Navigation minimap in sidebar
│   │   ├── Sidebar.jsx   # Board list + minimap + auth buttons
│   │   └── Toolbar.jsx   # Top bar with color picker
│   ├── hooks/
│   │   └── useArchive.js # Archive state management and event logging
│   ├── utils/
│   │   ├── archiveHelpers.js # Date grouping, snapshot creation utilities
│   │   └── sourceDetector.js # URL source detection (Google, Slack, etc.)
│   └── styles/
│       └── main.css      # All application styles
├── build/                # Vite build output
├── dist/                 # Electron-builder output
├── build-resources/      # App icons
└── package.json
```

## Key Features

### Board & Navigation
- **Multi-board support**: Create/switch/rename/delete boards via sidebar
- **Reorder boards**: Drag and drop boards in sidebar to reorder
- **Infinite canvas**: Pan with two-finger scroll or Shift+drag
- **Pinch-to-zoom**: 25% to 300% zoom range
- **Minimap**: Shows card/category positions, click to navigate

### Content Cards
- **Drag-drop URLs**: From browser, extracts title/description/favicon
- **Paste support**: Cmd+V to add URLs or text
- **Double-click**: Creates empty note cards
- **Custom emoji icons**: Click source icon to open searchable emoji picker
- **Card colors**: 8 color options via toolbar when selected
- **Due dates**: Click calendar icon, highlights cards due within 7 days
- **Notes**: Per-card text notes
- **Checklists**: Todo items per card, double-click to edit text
- **Linked checklists**: Drag checklist items between cards to create linked copies; checking or editing one updates all linked instances (shown with chain icon)
- **Resize**: Drag corner/edge handles when selected
- **Delete**: X button in header (visible on hover)
- **Connection handle**: Circle on right edge of card (visible on hover)

### Categories
- **Create**: Option/Alt + drag to draw a region
- **Explicit assignment**: Cards belong to categories when dragged into them
- **Move together**: Dragging a category moves its assigned cards
- **Collapse**: Hide cards inside a category
- **Colors**: 8 color options (click palette icon when selected)
- **Resize**: Drag corner/edge handles when selected
- **Delete**: X button in header (visible on hover)
- **Connection handle**: Circle on right edge (visible on hover)

### Connections
- **Create**: Drag from connection handle (circle on right edge of card/category)
- **Visual**: Curved gradient lines between connected elements
- **Delete**: Click on a connection line

### Deletion
- Cards and categories are deleted via the X button in their header
- No keyboard shortcuts for deletion (prevents accidental deletion while editing)

### Archive
- **Event logging**: Automatically logs create/delete events for boards, cards, and categories
- **Timeline view**: Events grouped by week (last month) or by month (older)
- **Visual cards**: Archived cards display with their original appearance (color, emoji, notes, checklist)
- **Context preserved**: Each event stores the board name, category, and connected cards at time of action
- **Filters**: Filter by event type (created/deleted) and item type (boards/cards/categories)
- **Collapsible groups**: Timeline sections can be collapsed/expanded
- **Separate storage**: Archive data stored in `~/Library/Application Support/info-board/board-data.json`

### Data
- **Auto-save**: Debounced 500ms save to `~/Library/Application Support/info-board/board-data.json`
- **Per-board state**: Each board has its own cards, connections, categories

## State Architecture

### App.jsx (lifted state)
- `boards[]` - All board data
- `activeBoardId` - Current board
- `viewOffset` - Pan position (shared with Minimap)
- `zoom` - Zoom level (shared with Minimap)
- `viewportSize` - Board dimensions for Minimap

### Board.jsx (local state)
- `isPanning`, `connectingFrom`, `mousePosition`
- `selectedCategory`, `isCreatingCategory`, `categoryRect`

### Card.jsx (local state)
- `isDragging`, `isResizing`, `resizeHandle`
- `isEditingNote`, `isEditingTitle`
- `showChecklist`, `isEditingDate`, `showEmojiPicker`
- `editingChecklistItemId`, `editingChecklistText`

## Card Data Model

```javascript
{
  id: string,
  url: string | null,
  title: string,
  hasRealTitle: boolean,
  text: string,
  description: string | null,
  source: { type: string, name: string, color: string },
  customEmoji: string | null,  // User-selected emoji icon
  x: number,
  y: number,
  width: number | null,   // Custom width (default: 280px)
  height: number | null,  // Custom height (default: 200px)
  color: string | null,
  note: string,
  dueDate: string | null,  // YYYY-MM-DD
  checklist: [{ id, text, checked, sharedId? }],  // sharedId links items across cards
  categoryId: string | null,  // Explicit category assignment
  createdAt: number
}
```

## Category Data Model

```javascript
{
  id: string,
  title: string,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
  collapsed: boolean,
  createdAt: number
}
```

## Archive Event Data Model

```javascript
{
  id: string,                    // UUID
  timestamp: number,             // Date.now()
  eventType: 'created' | 'deleted',
  itemType: 'board' | 'card' | 'category',
  snapshot: { ... },             // Full item data at event time
  context: {
    boardId: string | null,      // Which board (null for board events)
    boardName: string | null,
    categoryId: string | null,   // For cards: category membership
    categoryTitle: string | null,
    connectedCardIds: string[],  // For cards: connected card IDs
    connectedCardTitles: string[],
    cardCount: number,           // For boards: contained items
    categoryCount: number,
  }
}
```

## Commands

```bash
# Development
npm start           # Run Vite + Electron concurrently

# Production
npm run build       # Build and package for macOS

# Deploy to Applications
cp -R dist/mac-arm64/MimBoard.app /Applications/
```

## Source Detection

Cards auto-detect source type from URLs:
- Google Docs/Sheets/Slides/Drive
- Slack, GitHub, Notion, Figma
- Jira, Confluence, Trello, Asana, Linear
- Dropbox, generic links

Each source has a custom icon and color defined in `sourceDetector.js`.

## TODO

- **Auto-resize cards**: Automatically resize cards when their content exceeds the current bounds (notes, checklist items, long titles)
- **Auto-align/distribute**: Add a feature to pleasantly space and align cards and categories on the board (similar to PowerPoint's align/distribute functionality)
