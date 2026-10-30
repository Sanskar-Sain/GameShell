// GameShell — preload script
// Exposes a minimal API to the launcher via contextBridge.
// No Node access leaks into the renderer.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gameshell', {
  // Games
  getGames: () => ipcRenderer.invoke('get-games'),
  addGame: (game) => ipcRenderer.invoke('add-game', game),
  removeGame: (index) => ipcRenderer.invoke('remove-game', index),
  launchGame: (url) => ipcRenderer.invoke('launch-game', url),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.invoke('save-settings', s),

  // Diagnostics
  openGpuInfo: () => ipcRenderer.invoke('open-gpu-info'),
  getGpuStatus: () => ipcRenderer.invoke('get-gpu-status'),

  // Platform info
  getPlatform: () => ipcRenderer.invoke('get-platform'),
});
