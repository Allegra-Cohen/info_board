// Archive helper utilities for date grouping and snapshot creation

/**
 * Get the start of the week (Sunday) for a given date
 */
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Group archive events by time period
 * - Events within last month: grouped by week
 * - Older events: grouped by month
 */
export function groupEventsByPeriod(events) {
  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const weekGroups = new Map();
  const monthGroups = new Map();

  // Sort events by timestamp descending (newest first)
  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);

  for (const event of sorted) {
    const eventDate = new Date(event.timestamp);

    if (eventDate >= oneMonthAgo) {
      // Group by week
      const weekStart = getWeekStart(eventDate);
      const weekKey = weekStart.toISOString();
      if (!weekGroups.has(weekKey)) {
        weekGroups.set(weekKey, {
          type: 'week',
          start: weekStart,
          key: weekKey,
          events: []
        });
      }
      weekGroups.get(weekKey).events.push(event);
    } else {
      // Group by month
      const monthKey = `${eventDate.getFullYear()}-${eventDate.getMonth()}`;
      if (!monthGroups.has(monthKey)) {
        monthGroups.set(monthKey, {
          type: 'month',
          year: eventDate.getFullYear(),
          month: eventDate.getMonth(),
          key: monthKey,
          events: []
        });
      }
      monthGroups.get(monthKey).events.push(event);
    }
  }

  // Combine: weeks first (sorted by date desc), then months (sorted by date desc)
  const weekArray = Array.from(weekGroups.values()).sort(
    (a, b) => b.start.getTime() - a.start.getTime()
  );
  const monthArray = Array.from(monthGroups.values()).sort(
    (a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month)
  );

  return [...weekArray, ...monthArray];
}

/**
 * Format a week range for display (e.g., "Jan 6 - Jan 12, 2026")
 */
export function formatWeekRange(startDate) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);

  const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const year = endDate.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

/**
 * Format a month for display (e.g., "November 2025")
 */
export function formatMonth(year, month) {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Format relative time (e.g., "2 hours ago", "3 days ago")
 */
export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  // For older events, show the date
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Create a snapshot of a board for archiving
 */
export function createBoardSnapshot(board) {
  return {
    id: board.id,
    name: board.name,
    createdAt: board.createdAt,
    cardCount: board.cards?.length || 0,
    categoryCount: board.categories?.length || 0,
  };
}

/**
 * Create a snapshot of a card for archiving
 */
export function createCardSnapshot(card) {
  return {
    id: card.id,
    title: card.title,
    url: card.url || null,
    note: card.note || '',
    color: card.color || null,
    source: card.source || null,
    x: card.x,
    y: card.y,
    width: card.width || null,
    height: card.height || null,
    dueDate: card.dueDate || null,
    customEmoji: card.customEmoji || null,
    checklist: card.checklist || null,
    description: card.description || null,
    categoryId: card.categoryId || null,
    createdAt: card.createdAt,
  };
}

/**
 * Create a snapshot of a category for archiving
 */
export function createCategorySnapshot(category) {
  return {
    id: category.id,
    title: category.title,
    color: category.color,
    x: category.x,
    y: category.y,
    width: category.width,
    height: category.height,
    collapsed: category.collapsed || false,
    createdAt: category.createdAt,
  };
}

/**
 * Create a snapshot of a shape for archiving
 */
export function createShapeSnapshot(shape) {
  return {
    id: shape.id,
    type: shape.type,
    label: shape.label || '',
    color: shape.color || null,
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    linkedItemId: shape.linkedItemId || null,
    linkedItemType: shape.linkedItemType || null,
    createdAt: shape.createdAt,
  };
}
