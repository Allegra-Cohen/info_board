import React, { useState, useMemo } from 'react';
import { formatRelativeTime, groupEventsByPeriod, formatWeekRange, formatMonth } from '../utils/archiveHelpers';

function ArchiveCard({ event }) {
  const card = event.snapshot;
  const isDeleted = event.eventType === 'deleted';

  return (
    <div className={`archive-card ${isDeleted ? 'deleted' : 'created'}`}>
      <div
        className="archive-card-color-bar"
        style={{ backgroundColor: card.color || 'var(--accent)' }}
      />
      <div className="archive-card-content">
        <div className="archive-card-header">
          <span className="archive-card-emoji">
            {card.customEmoji || (card.source?.type === 'note' ? '📝' : '🔗')}
          </span>
          <span className="archive-card-title">{card.title || 'Untitled'}</span>
          <span className={`archive-card-badge ${event.eventType}`}>
            {isDeleted ? 'deleted' : 'created'}
          </span>
        </div>
        {card.previousTitles && card.previousTitles.length > 0 && (
          <div className="archive-previous-names">
            Previously: {card.previousTitles.join(' → ')}
          </div>
        )}
        {card.url && (
          <div className="archive-card-url">{card.url}</div>
        )}
        {card.note && (
          <div className="archive-card-note">{card.note}</div>
        )}
        {card.checklist && card.checklist.length > 0 && (
          <div className="archive-card-checklist">
            {card.checklist.slice(0, 3).map((item, i) => (
              <div key={i} className="archive-checklist-item">
                <span className={item.checked ? 'checked' : ''}>
                  {item.checked ? '☑' : '☐'} {item.text}
                </span>
              </div>
            ))}
            {card.checklist.length > 3 && (
              <div className="archive-checklist-more">
                +{card.checklist.length - 3} more
              </div>
            )}
          </div>
        )}
        <div className="archive-card-meta">
          <span className="archive-card-time">{formatRelativeTime(event.timestamp)}</span>
          <div className="archive-card-labels">
            {event.context.boardName && (
              <span className="archive-label board-label">{event.context.boardName}</span>
            )}
            {event.context.categoryTitle && (
              <span className="archive-label category-label">{event.context.categoryTitle}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchiveCategoryItem({ event }) {
  const category = event.snapshot;
  const isDeleted = event.eventType === 'deleted';

  return (
    <div className={`archive-category-item ${isDeleted ? 'deleted' : 'created'}`}>
      <span className="archive-item-type-label">Category</span>
      <div
        className="archive-category-color"
        style={{ backgroundColor: category.color || 'var(--accent)' }}
      />
      <div className="archive-category-info">
        <span className="archive-category-title">{category.title}</span>
        <span className={`archive-card-badge ${event.eventType}`}>
          {isDeleted ? 'deleted' : 'created'}
        </span>
        {category.previousTitles && category.previousTitles.length > 0 && (
          <span className="archive-previous-names">
            Previously: {category.previousTitles.join(' → ')}
          </span>
        )}
      </div>
      <div className="archive-item-meta">
        {event.context.boardName && (
          <span className="archive-label board-label">{event.context.boardName}</span>
        )}
        <span className="archive-card-time">{formatRelativeTime(event.timestamp)}</span>
      </div>
    </div>
  );
}

function ArchiveBoardItem({ event }) {
  const board = event.snapshot;
  const isDeleted = event.eventType === 'deleted';

  return (
    <div className={`archive-board-item ${isDeleted ? 'deleted' : 'created'}`}>
      <span className="archive-item-type-label">Board</span>
      <span className="archive-board-icon">📋</span>
      <div className="archive-board-info">
        <span className="archive-board-name">{board.name}</span>
        <span className={`archive-card-badge ${event.eventType}`}>
          {isDeleted ? 'deleted' : 'created'}
        </span>
        {board.previousNames && board.previousNames.length > 0 && (
          <span className="archive-previous-names">
            Previously: {board.previousNames.join(' → ')}
          </span>
        )}
        {isDeleted && (event.context.cardCount > 0 || event.context.categoryCount > 0) && (
          <span className="archive-board-stats">
            {event.context.cardCount} cards, {event.context.categoryCount} categories
          </span>
        )}
      </div>
      <span className="archive-card-time">{formatRelativeTime(event.timestamp)}</span>
    </div>
  );
}

function ArchiveEvent({ event }) {
  if (event.itemType === 'card') {
    return <ArchiveCard event={event} />;
  } else if (event.itemType === 'category') {
    return <ArchiveCategoryItem event={event} />;
  } else if (event.itemType === 'board') {
    return <ArchiveBoardItem event={event} />;
  }
  return null;
}

function TimelineGroup({ group, isCollapsed, onToggle }) {
  const title = group.type === 'week'
    ? formatWeekRange(group.start)
    : formatMonth(group.year, group.month);

  return (
    <div className={`timeline-group ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="timeline-group-header" onClick={onToggle}>
        <svg className="collapse-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
        <span className="timeline-group-title">{title}</span>
        <span className="timeline-group-count">{group.events.length}</span>
      </div>

      {!isCollapsed && (
        <div className="timeline-group-events">
          {group.events.map(event => (
            <ArchiveEvent key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ArchiveBoard({ events }) {
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [itemTypeFilter, setItemTypeFilter] = useState('all');

  // Filter events (exclude legacy 'renamed' events)
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      // Exclude legacy renamed events
      if (e.eventType === 'renamed') return false;
      if (eventTypeFilter !== 'all' && e.eventType !== eventTypeFilter) return false;
      if (itemTypeFilter !== 'all' && e.itemType !== itemTypeFilter) return false;
      return true;
    });
  }, [events, eventTypeFilter, itemTypeFilter]);

  // Group events by time period
  const groups = useMemo(() => groupEventsByPeriod(filteredEvents), [filteredEvents]);

  const toggleGroup = (groupKey) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  return (
    <div className="archive-board">
      <div className="archive-header">
        <h2>Archive</h2>
        <span className="archive-count">{events.length} events</span>

        <div className="archive-filters">
          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="archive-filter-select"
          >
            <option value="all">All Actions</option>
            <option value="created">Created</option>
            <option value="deleted">Deleted</option>
          </select>

          <select
            value={itemTypeFilter}
            onChange={(e) => setItemTypeFilter(e.target.value)}
            className="archive-filter-select"
          >
            <option value="all">All Types</option>
            <option value="board">Boards</option>
            <option value="card">Cards</option>
            <option value="category">Categories</option>
          </select>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="archive-empty">
          <div className="archive-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 8v13H3V8" />
              <path d="M1 3h22v5H1z" />
              <path d="M10 12h4" />
            </svg>
          </div>
          <p>No archived events yet</p>
          <p className="hint">Events are logged when you create or delete boards, cards, and categories</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="archive-empty">
          <div className="archive-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <p>No events match your filters</p>
          <p className="hint">Try adjusting the filters above</p>
        </div>
      ) : (
        <div className="archive-timeline">
          {groups.map(group => (
            <TimelineGroup
              key={group.key}
              group={group}
              isCollapsed={collapsedGroups.has(group.key)}
              onToggle={() => toggleGroup(group.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
