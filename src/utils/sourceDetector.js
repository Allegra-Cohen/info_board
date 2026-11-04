// Detect the source of a URL and return metadata
export const SOURCE_TYPES = {
  SLACK: 'slack',
  GOOGLE_DOCS: 'google-docs',
  GOOGLE_SHEETS: 'google-sheets',
  GOOGLE_SLIDES: 'google-slides',
  GOOGLE_DRIVE: 'google-drive',
  GITHUB: 'github',
  NOTION: 'notion',
  FIGMA: 'figma',
  JIRA: 'jira',
  CONFLUENCE: 'confluence',
  TRELLO: 'trello',
  ASANA: 'asana',
  LINEAR: 'linear',
  DROPBOX: 'dropbox',
  GENERIC: 'generic',
};

const SOURCE_PATTERNS = [
  { pattern: /slack\.com/i, type: SOURCE_TYPES.SLACK, name: 'Slack', color: '#4A154B' },
  { pattern: /docs\.google\.com/i, type: SOURCE_TYPES.GOOGLE_DOCS, name: 'Google Docs', color: '#4285F4' },
  { pattern: /sheets\.google\.com/i, type: SOURCE_TYPES.GOOGLE_SHEETS, name: 'Google Sheets', color: '#0F9D58' },
  { pattern: /slides\.google\.com/i, type: SOURCE_TYPES.GOOGLE_SLIDES, name: 'Google Slides', color: '#F4B400' },
  { pattern: /drive\.google\.com/i, type: SOURCE_TYPES.GOOGLE_DRIVE, name: 'Google Drive', color: '#4285F4' },
  { pattern: /github\.com/i, type: SOURCE_TYPES.GITHUB, name: 'GitHub', color: '#24292E' },
  { pattern: /notion\.so/i, type: SOURCE_TYPES.NOTION, name: 'Notion', color: '#000000' },
  { pattern: /figma\.com/i, type: SOURCE_TYPES.FIGMA, name: 'Figma', color: '#F24E1E' },
  { pattern: /atlassian\.net.*jira/i, type: SOURCE_TYPES.JIRA, name: 'Jira', color: '#0052CC' },
  { pattern: /atlassian\.net.*wiki/i, type: SOURCE_TYPES.CONFLUENCE, name: 'Confluence', color: '#172B4D' },
  { pattern: /trello\.com/i, type: SOURCE_TYPES.TRELLO, name: 'Trello', color: '#0079BF' },
  { pattern: /asana\.com/i, type: SOURCE_TYPES.ASANA, name: 'Asana', color: '#F06A6A' },
  { pattern: /linear\.app/i, type: SOURCE_TYPES.LINEAR, name: 'Linear', color: '#5E6AD2' },
  { pattern: /dropbox\.com/i, type: SOURCE_TYPES.DROPBOX, name: 'Dropbox', color: '#0061FF' },
];

export function detectSource(url) {
  if (!url) {
    return { type: SOURCE_TYPES.GENERIC, name: 'Note', color: '#6B7280' };
  }

  for (const source of SOURCE_PATTERNS) {
    if (source.pattern.test(url)) {
      return { type: source.type, name: source.name, color: source.color };
    }
  }

  // Try to extract domain for generic URLs
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return { type: SOURCE_TYPES.GENERIC, name: domain, color: '#6B7280' };
  } catch {
    return { type: SOURCE_TYPES.GENERIC, name: 'Link', color: '#6B7280' };
  }
}

export function extractTitle(url, text) {
  // If we have text content, use it
  if (text && text.trim()) {
    // Truncate if too long
    const cleaned = text.trim().split('\n')[0];
    return cleaned.length > 100 ? cleaned.substring(0, 100) + '...' : cleaned;
  }

  // Try to extract something meaningful from URL
  if (url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        // Decode and clean up
        return decodeURIComponent(lastPart).replace(/[-_]/g, ' ');
      }
      return urlObj.hostname;
    } catch {
      return 'Untitled';
    }
  }

  return 'Untitled';
}

// SVG icons for each source type
export const SOURCE_ICONS = {
  [SOURCE_TYPES.SLACK]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.52 2.521h-2.522V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.52v-2.522h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.52 2.521h-6.313z"/></svg>`,
  [SOURCE_TYPES.GOOGLE_DOCS]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 17h8v-1H8v1zm0-3h8v-1H8v1zm0-3h5v-1H8v1z"/></svg>`,
  [SOURCE_TYPES.GOOGLE_SHEETS]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 17h2v-2H8v2zm0-4h2v-2H8v2zm4 4h4v-2h-4v2zm0-4h4v-2h-4v2z"/></svg>`,
  [SOURCE_TYPES.GOOGLE_SLIDES]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 17v-6h8v6H8zm1-5v4h6v-4H9z"/></svg>`,
  [SOURCE_TYPES.GOOGLE_DRIVE]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.267 14.68l-1.6 2.76H20.2l1.6-2.76H8.267zm6.933-11.52L8.267 14.68h3.2l6.933-11.52h-3.2zM15.2 14.68l-6.933-11.52H5.067l6.933 11.52H15.2z"/></svg>`,
  [SOURCE_TYPES.GITHUB]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>`,
  [SOURCE_TYPES.NOTION]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933l3.224-.186zM2.035.376L15.92-.628c1.682-.14 2.101.046 2.801.56l3.874 2.707c.56.42.747.933.747 1.54v17.136c0 1.074-.374 1.727-1.682 1.82L5.417 24.22c-.98.047-1.448-.093-1.962-.747L.793 19.926c-.56-.746-.793-1.306-.793-1.96V2.156C0 1.29.374.516 2.035.376z"/></svg>`,
  [SOURCE_TYPES.FIGMA]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491zM12.735 7.51h3.117c1.665 0 3.019-1.355 3.019-3.019s-1.354-3.02-3.019-3.02h-3.117V7.51zm0 1.471H8.148c-2.476 0-4.49-2.014-4.49-4.49S5.672 0 8.148 0h4.587v8.981zm-4.587-7.51c-1.665 0-3.019 1.355-3.019 3.02s1.354 3.02 3.019 3.02h3.117V1.471H8.148zm4.587 15.019H8.148c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h4.587v8.98zM8.148 8.981c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h3.117V8.981H8.148zM8.172 24c-2.489 0-4.515-2.014-4.515-4.49s2.014-4.49 4.49-4.49h4.588v4.441c0 2.503-2.047 4.539-4.563 4.539zm-.024-7.51a3.023 3.023 0 0 0-3.019 3.02c0 1.665 1.365 3.019 3.044 3.019 1.705 0 3.093-1.376 3.093-3.068v-2.97H8.148zm7.704 0h-.098c-2.476 0-4.49-2.014-4.49-4.49s2.014-4.49 4.49-4.49h.098c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.49-4.49 4.49zm-.098-7.509c-1.665 0-3.019 1.355-3.019 3.019s1.354 3.02 3.019 3.02h.098c1.665 0 3.019-1.355 3.019-3.02s-1.354-3.019-3.019-3.019h-.098z"/></svg>`,
  [SOURCE_TYPES.JIRA]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/></svg>`,
  [SOURCE_TYPES.CONFLUENCE]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M.87 18.257c-.248.382-.53.875-.763 1.245a.764.764 0 0 0 .255 1.04l4.965 3.054a.764.764 0 0 0 1.058-.26c.199-.332.454-.763.733-1.221 1.967-3.247 3.945-2.853 7.508-1.146l4.957 2.377a.764.764 0 0 0 1.028-.382l2.36-5.2a.765.765 0 0 0-.382-1.003c-1.04-.497-3.121-1.494-5.11-2.45-6.086-2.912-11.156-2.62-16.609 3.946zm22.26-12.514c.249-.383.531-.876.764-1.245a.764.764 0 0 0-.256-1.04L18.673.404a.764.764 0 0 0-1.058.26c-.199.332-.454.764-.733 1.221-1.967 3.247-3.945 2.854-7.508 1.146L4.418.654a.764.764 0 0 0-1.028.382L1.03 6.237a.765.765 0 0 0 .382 1.002c1.04.498 3.121 1.495 5.11 2.451 6.086 2.911 11.156 2.619 16.609-3.947z"/></svg>`,
  [SOURCE_TYPES.TRELLO]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 0H3C1.343 0 0 1.343 0 3v18c0 1.656 1.343 3 3 3h18c1.656 0 3-1.344 3-3V3c0-1.657-1.344-3-3-3zM10.44 18.18c0 .795-.645 1.44-1.44 1.44H4.56c-.795 0-1.44-.645-1.44-1.44V4.56c0-.795.645-1.44 1.44-1.44H9c.795 0 1.44.645 1.44 1.44v13.62zm10.44-6c0 .794-.645 1.44-1.44 1.44h-4.44c-.795 0-1.44-.646-1.44-1.44V4.56c0-.795.645-1.44 1.44-1.44h4.44c.795 0 1.44.645 1.44 1.44v7.62z"/></svg>`,
  [SOURCE_TYPES.ASANA]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.78 12.653c-2.882 0-5.22 2.336-5.22 5.218s2.338 5.218 5.22 5.218 5.22-2.336 5.22-5.218-2.338-5.218-5.22-5.218zm-13.56 0c-2.882 0-5.22 2.336-5.22 5.218s2.338 5.218 5.22 5.218 5.22-2.336 5.22-5.218-2.338-5.218-5.22-5.218zM12 1.91c-2.882 0-5.22 2.336-5.22 5.218s2.338 5.218 5.22 5.218 5.22-2.336 5.22-5.218S14.882 1.91 12 1.91z"/></svg>`,
  [SOURCE_TYPES.LINEAR]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.513 10.186a9.974 9.974 0 0 0-.524 2.164.291.291 0 0 0 .081.232l9.348 9.348c.07.07.168.1.263.081a9.981 9.981 0 0 0 2.162-.524.287.287 0 0 0 .147-.467L2.98 10.01a.29.29 0 0 0-.467.176zM.905 14.93A9.985 9.985 0 0 0 12 24c.104 0 .186-.08.19-.184.076-2.312.95-4.47 2.378-6.167a.29.29 0 0 0-.021-.378l-8.82-8.818a.29.29 0 0 0-.378-.021A11.49 11.49 0 0 0 .72 14.74a.29.29 0 0 0 .185.19zm4.77-8.672l7.067 7.067c.1.1.26.105.368.013a8.835 8.835 0 0 0 3.063-5.749.29.29 0 0 0-.08-.232L11.168 2.43a.287.287 0 0 0-.232-.08 8.835 8.835 0 0 0-5.749 3.063.29.29 0 0 0 .012.368l.476.477zm6.238-4.26l5.089 5.089a.29.29 0 0 0 .354.048A10.028 10.028 0 0 0 21.858 2.1a.288.288 0 0 0-.236-.236A10.026 10.026 0 0 0 16.609.351a.287.287 0 0 0-.173.482z"/></svg>`,
  [SOURCE_TYPES.DROPBOX]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 1.807L0 5.629l6 3.822 6-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6-3.822-6-3.822-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6 3.822 6-3.822-6-3.822-6 3.822z"/></svg>`,
  [SOURCE_TYPES.GENERIC]: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>`,
};
