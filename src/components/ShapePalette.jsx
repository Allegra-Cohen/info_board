import React from 'react';

const SHAPE_TYPES = [
  { type: 'rectangle', label: 'Rectangle' },
  { type: 'rounded-rect', label: 'Rounded' },
  { type: 'diamond', label: 'Diamond' },
  { type: 'circle', label: 'Circle' },
  { type: 'double-rounded', label: 'Double' },
  { type: 'table', label: 'Table' },
];

function ShapePreview({ type, size = 40 }) {
  const w = size;
  const h = size * 0.75;

  switch (type) {
    case 'diamond':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <polygon
            points={`${w/2},1 ${w-1},${h/2} ${w/2},${h-1} 1,${h/2}`}
            fill="var(--bg-tertiary)"
            stroke="var(--text-secondary)"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'circle':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <ellipse
            cx={w/2} cy={h/2}
            rx={w/2-2} ry={h/2-2}
            fill="var(--bg-tertiary)"
            stroke="var(--text-secondary)"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'rounded-rect':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect
            x="1" y="1" width={w-2} height={h-2}
            rx="8" ry="8"
            fill="var(--bg-tertiary)"
            stroke="var(--text-secondary)"
            strokeWidth="1.5"
          />
        </svg>
      );
    case 'double-rounded': {
      const lobeH = (h - 4) / 2;
      const pinch = w * 0.18;
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x="1" y="1" width={w-2} height={lobeH} rx="6" ry="6"
            fill="var(--bg-tertiary)" stroke="var(--text-secondary)" strokeWidth="1.5" />
          <rect x="1" y={1 + lobeH + 2} width={w-2} height={lobeH} rx="6" ry="6"
            fill="var(--bg-tertiary)" stroke="var(--text-secondary)" strokeWidth="1.5" />
          <line x1={w*0.35} y1={1 + lobeH} x2={w*0.35} y2={1 + lobeH + 2}
            stroke="var(--text-secondary)" strokeWidth="1.5" />
          <line x1={w*0.65} y1={1 + lobeH} x2={w*0.65} y2={1 + lobeH + 2}
            stroke="var(--text-secondary)" strokeWidth="1.5" />
        </svg>
      );
    }
    case 'table': {
      const cols = 3, rows = 3;
      const cw = (w - 2) / cols;
      const rh = (h - 2) / rows;
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x="1" y="1" width={w-2} height={h-2} fill="var(--bg-tertiary)" stroke="var(--text-secondary)" strokeWidth="1.5" rx="2" ry="2" />
          {Array.from({ length: cols - 1 }, (_, i) => (
            <line key={`c${i}`} x1={1 + cw * (i + 1)} y1="1" x2={1 + cw * (i + 1)} y2={h - 1} stroke="var(--text-secondary)" strokeWidth="1" />
          ))}
          {Array.from({ length: rows - 1 }, (_, i) => (
            <line key={`r${i}`} x1="1" y1={1 + rh * (i + 1)} x2={w - 1} y2={1 + rh * (i + 1)} stroke="var(--text-secondary)" strokeWidth="1" />
          ))}
        </svg>
      );
    }
    case 'rectangle':
    default:
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect
            x="1" y="1" width={w-2} height={h-2}
            fill="var(--bg-tertiary)"
            stroke="var(--text-secondary)"
            strokeWidth="1.5"
          />
        </svg>
      );
  }
}

export default function ShapePalette({ onToggle }) {
  const handleDragStart = (e, shapeType) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'shape-palette', shapeType }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="shape-palette open">
      <button className="shape-palette-toggle" onClick={onToggle} title="Close shapes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      <div className="shape-palette-items">
        <div className="shape-palette-label">Shapes</div>
        {SHAPE_TYPES.map(({ type, label }) => (
          <div
            key={type}
            className="palette-item"
            draggable
            onDragStart={(e) => handleDragStart(e, type)}
            title={label}
          >
            <ShapePreview type={type} />
            <span className="palette-item-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
