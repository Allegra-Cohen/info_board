import '@testing-library/jest-dom';

// Mock window.electronAPI
window.electronAPI = {
  loadData: vi.fn().mockResolvedValue({ boards: [] }),
  saveData: vi.fn().mockResolvedValue({ success: true }),
  loadArchive: vi.fn().mockResolvedValue({ version: 1, events: [] }),
  saveArchive: vi.fn().mockResolvedValue({ success: true }),
  fetchUrlMetadata: vi.fn().mockResolvedValue({ title: null, description: null, image: null }),
  openUrlInSafari: vi.fn().mockResolvedValue({ success: true }),
  googleSignIn: vi.fn(),
  checkGoogleAuth: vi.fn().mockResolvedValue({ authenticated: false }),
  googleSignOut: vi.fn(),
  slackSignIn: vi.fn(),
  checkSlackAuth: vi.fn().mockResolvedValue({ authenticated: false }),
  slackSignOut: vi.fn(),
};

// Mock crypto.randomUUID
let uuidCounter = 0;
if (!crypto.randomUUID) {
  crypto.randomUUID = () => `test-uuid-${++uuidCounter}`;
}
