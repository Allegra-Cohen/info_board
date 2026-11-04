const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  loadArchive: () => ipcRenderer.invoke('load-archive'),
  saveArchive: (data) => ipcRenderer.invoke('save-archive', data),
  fetchUrlMetadata: (url) => ipcRenderer.invoke('fetch-url-metadata', url),
  openUrlInSafari: (url) => ipcRenderer.invoke('open-url-in-safari', url),
  googleSignIn: () => ipcRenderer.invoke('google-sign-in'),
  checkGoogleAuth: () => ipcRenderer.invoke('check-google-auth'),
  googleSignOut: () => ipcRenderer.invoke('google-sign-out'),
  slackSignIn: () => ipcRenderer.invoke('slack-sign-in'),
  checkSlackAuth: () => ipcRenderer.invoke('check-slack-auth'),
  slackSignOut: () => ipcRenderer.invoke('slack-sign-out'),
});
