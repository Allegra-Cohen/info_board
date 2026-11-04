// Preload script to make Electron look like Chrome to Slack

// Remove Electron-specific properties
delete window.process;
delete window.require;
delete window.module;
delete window.exports;

// Override navigator properties that might reveal Electron
Object.defineProperty(navigator, 'webdriver', {
  get: () => false,
});

// Add Chrome-specific properties
Object.defineProperty(navigator, 'plugins', {
  get: () => [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
    { name: 'Native Client', filename: 'internal-nacl-plugin' },
  ],
});

Object.defineProperty(navigator, 'languages', {
  get: () => ['en-US', 'en'],
});

// Chrome runtime mock
window.chrome = {
  runtime: {},
  loadTimes: () => ({}),
  csi: () => ({}),
};
