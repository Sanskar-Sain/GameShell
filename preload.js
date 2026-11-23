// GameShell — preload script (production)
// Exposes a minimal, type-safe API to the launcher via contextBridge.
// No Node access leaks into the renderer.

const { contextBridge, ipcRenderer } = require('electron');

// Whitelist of allowed IPC channels
const ALLOWED_CHANNELS = new Set([
  'get-games',
  'add-game',
  'remove-game',
  'launch-game',
  'get-settings',
  'save-settings',
  'open-gpu-info',
  'get-gpu-status',
  'get-platform',
]);

function safeInvoke(channel, ...args) {
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new Error(`Blocked IPC channel: ${channel}`);
  }
  return ipcRenderer.invoke(channel, ...args);
}

contextBridge.exposeInMainWorld('gameshell', {
  // Games
  getGames: () => safeInvoke('get-games'),
  addGame: (game) => safeInvoke('add-game', game),
  removeGame: (index) => safeInvoke('remove-game', index),
  launchGame: (url) => safeInvoke('launch-game', url),

  // Settings
  getSettings: () => safeInvoke('get-settings'),
  saveSettings: (s) => safeInvoke('save-settings', s),

  // Diagnostics
  openGpuInfo: () => safeInvoke('open-gpu-info'),
  getGpuStatus: () => safeInvoke('get-gpu-status'),

  // Platform info
  getPlatform: () => safeInvoke('get-platform'),
});
