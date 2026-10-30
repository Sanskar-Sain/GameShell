// GameShell — main process
// Minimal fullscreen Electron wrapper for WebGL/WebGPU browser games.

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  powerSaveBlocker,
} = require('electron');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// 0. Helpers
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

/** Resolve a path inside the app (works both in dev and packaged). */
function appPath(...segments) {
  return path.join(__dirname, ...segments);
}

/** User-data directory path for settings. */
function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

/** Read settings.json; returns defaults when the file is missing. */
function readSettings() {
  const defaults = {
    vsync: false, // Defaulting vsync to false gives unlocked framerate
    overlayDefault: false,
    fullscreenDefault: true,
    highMemWasm: true,
    lastGameUrl: '',
  };
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8');
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

/** Persist settings. */
function writeSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

/** Read the games list. In dev we use the project file; packaged builds use
 *  the copy in userData so user-added games persist across updates. */
function gamesJsonPath() {
  const userCopy = path.join(app.getPath('userData'), 'games.json');
  if (fs.existsSync(userCopy)) return userCopy;
  const bundled = appPath('games.json');
  if (app.isPackaged) {
    const res = path.join(process.resourcesPath, 'games.json');
    if (fs.existsSync(res)) {
      try {
        fs.copyFileSync(res, userCopy);
        return userCopy;
      } catch {
        return bundled;
      }
    }
  }
  return bundled;
}

function readGames() {
  try {
    return JSON.parse(fs.readFileSync(gamesJsonPath(), 'utf-8'));
  } catch {
    return [];
  }
}

function writeGames(games) {
  fs.writeFileSync(gamesJsonPath(), JSON.stringify(games, null, 2));
}

// ---------------------------------------------------------------------------
// 1. CLI: --url shortcut
// ---------------------------------------------------------------------------

let directUrl = null;
for (let i = 0; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--url=')) {
    directUrl = arg.slice(6);
  } else if (arg === '--url' && i + 1 < process.argv.length) {
    directUrl = process.argv[i + 1];
  }
}

// ---------------------------------------------------------------------------
// 2. High-Performance GPU, Vulkan, WebGPU, and WASM Flags
//    (MUST be applied before app.whenReady)
// ---------------------------------------------------------------------------

const settings = readSettings();

// Core GPU acceleration flags
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-unsafe-webgpu');

// V-sync / frame-rate control
if (!settings.vsync) {
  app.commandLine.appendSwitch('disable-frame-rate-limit');
  app.commandLine.appendSwitch('disable-gpu-vsync');
}

// Uncap memory & WebAssembly compiler tiers for complex games (Cyberpunk 2077 web port)
if (settings.highMemWasm) {
  app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192 --wasm-tier-up');
  app.commandLine.appendSwitch('disk-cache-size', '2147483648'); // 2GB shader/asset disk cache
}

// Enable Vulkan, WebGPU, SharedArrayBuffer and multi-threaded WASM compilation
const features = [
  'Vulkan',
  'WebGPU',
  'SharedArrayBuffer',
  'WebAssemblyLazyCompilation',
  'WebAssemblyTiering',
];

// Dawn (Chromium's WebGPU engine) optimizations
app.commandLine.appendSwitch('enable-dawn-features', 'allow_unsafe_apis');

// Prevent background throttling & stutter
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Disable unneeded Chromium subsystems
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-translate');
app.commandLine.appendSwitch('disable-extensions');

// ---------------------------------------------------------------------------
// 3. Per-OS tuning
// ---------------------------------------------------------------------------

const platform = process.platform;

if (platform === 'linux') {
  const sessionType = process.env.XDG_SESSION_TYPE || '';
  const waylandDisplay = process.env.WAYLAND_DISPLAY || '';

  if (sessionType === 'wayland' || waylandDisplay) {
    app.commandLine.appendSwitch('ozone-platform', 'wayland');
    console.log('[GameShell] Wayland session detected — using ozone-platform=wayland with hardware Vulkan & WebGPU');
  } else {
    app.commandLine.appendSwitch('ozone-platform', 'x11');
    console.log('[GameShell] X11 session detected — using ozone-platform=x11 with hardware Vulkan & WebGPU');
  }

  app.commandLine.appendSwitch('enable-features', features.join(','));

  if (!process.env.DRI_PRIME) {
    console.log('[GameShell] Tip: On hybrid-GPU laptops run with DRI_PRIME=1 or use `npm run start:dgpu`');
  }
} else if (platform === 'win32') {
  app.commandLine.appendSwitch('enable-features', features.join(','));
} else if (platform === 'darwin') {
  // macOS uses Metal for WebGPU
  app.commandLine.appendSwitch('enable-features', 'WebGPU,SharedArrayBuffer,WebAssemblyLazyCompilation,WebAssemblyTiering');
}

// ---------------------------------------------------------------------------
// 4. App lifecycle
// ---------------------------------------------------------------------------

let launcherWindow = null;
let gameWindow = null;
let powerBlockerId = null;
let overlayVisible = false;

function startPowerBlock() {
  if (powerBlockerId === null) {
    powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    console.log('[GameShell] powerSaveBlocker active (prevent-display-sleep)');
  }
}

function stopPowerBlock() {
  if (powerBlockerId !== null) {
    powerSaveBlocker.stop(powerBlockerId);
    powerBlockerId = null;
  }
}

// ---------------------------------------------------------------------------
// 5. Launcher window
// ---------------------------------------------------------------------------

function createLauncherWindow() {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.show();
    launcherWindow.focus();
    return;
  }

  launcherWindow = new BrowserWindow({
    width: 920,
    height: 700,
    minWidth: 640,
    minHeight: 480,
    title: 'GameShell',
    backgroundColor: '#0d0d0d',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: appPath('preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  launcherWindow.setMenuBarVisibility(false);
  launcherWindow.loadFile(appPath('launcher', 'index.html'));

  launcherWindow.once('ready-to-show', () => launcherWindow.show());

  launcherWindow.on('closed', () => {
    launcherWindow = null;
    if (!gameWindow || gameWindow.isDestroyed()) app.quit();
  });
}

// ---------------------------------------------------------------------------
// 6. Game window
// ---------------------------------------------------------------------------

function createGameWindow(url) {
  const s = readSettings();
  s.lastGameUrl = url;
  writeSettings(s);

  if (gameWindow && !gameWindow.isDestroyed()) {
    gameWindow.loadURL(url);
    gameWindow.focus();
    return;
  }

  const fullscreen = s.fullscreenDefault;
  overlayVisible = s.overlayDefault;

  gameWindow = new BrowserWindow({
    fullscreen,
    frame: false,
    title: 'GameShell',
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      // Game window has NO Node access and NO preload
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });

  gameWindow.setMenuBarVisibility(false);

  let allowedOrigin = '';
  try {
    allowedOrigin = new URL(url).origin;
  } catch {
    allowedOrigin = '';
  }

  gameWindow.webContents.on('will-navigate', (e, navUrl) => {
    try {
      if (allowedOrigin && new URL(navUrl).origin !== allowedOrigin) {
        e.preventDefault();
        shell.openExternal(navUrl);
      }
    } catch {
      e.preventDefault();
    }
  });

  gameWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    try {
      if (allowedOrigin && new URL(openUrl).origin !== allowedOrigin) {
        shell.openExternal(openUrl);
      }
    } catch { /* ignore */ }
    return { action: 'deny' };
  });

  gameWindow.loadURL(url);

  gameWindow.once('ready-to-show', () => {
    gameWindow.show();
    startPowerBlock();
    injectOverlay();
  });

  gameWindow.webContents.on('dom-ready', () => {
    injectOverlay();
  });

  gameWindow.on('closed', () => {
    gameWindow = null;
    stopPowerBlock();
  });

  registerGameShortcuts();
}

// ---------------------------------------------------------------------------
// 7. FPS overlay
// ---------------------------------------------------------------------------

function injectOverlay() {
  if (!gameWindow || gameWindow.isDestroyed()) return;

  try {
    const overlayCSS = fs.readFileSync(appPath('overlay', 'overlay.css'), 'utf-8');
    const overlayJS = fs.readFileSync(appPath('overlay', 'overlay.js'), 'utf-8');

    gameWindow.webContents.insertCSS(overlayCSS);
    gameWindow.webContents.executeJavaScript(overlayJS).catch(() => {});

    const cmd = overlayVisible
      ? `document.getElementById('gs-overlay')?.style.setProperty('display','block')`
      : `document.getElementById('gs-overlay')?.style.setProperty('display','none')`;
    gameWindow.webContents.executeJavaScript(cmd).catch(() => {});
  } catch { /* ignore */ }
}

function toggleOverlay() {
  if (!gameWindow || gameWindow.isDestroyed()) return;
  overlayVisible = !overlayVisible;
  const display = overlayVisible ? 'block' : 'none';
  gameWindow.webContents
    .executeJavaScript(
      `document.getElementById('gs-overlay')?.style.setProperty('display','${display}')`
    )
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// 8. Keyboard shortcuts (game window)
// ---------------------------------------------------------------------------

function registerGameShortcuts() {
  if (!gameWindow || gameWindow.isDestroyed()) return;

  gameWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (input.key === 'F11') {
      gameWindow.setFullScreen(!gameWindow.isFullScreen());
      event.preventDefault();
    }

    if (input.key === 'F3') {
      toggleOverlay();
      event.preventDefault();
    }

    if (input.key === 'Escape') {
      event.preventDefault();
      dialog
        .showMessageBox(gameWindow, {
          type: 'question',
          buttons: ['Return to Launcher', 'Stay in Game'],
          defaultId: 1,
          title: 'GameShell',
          message: 'Return to the launcher?',
        })
        .then(({ response }) => {
          if (response === 0) {
            gameWindow.close();
            createLauncherWindow();
          }
        });
    }

    if (isDev && input.control && input.shift && input.key === 'I') {
      gameWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

// ---------------------------------------------------------------------------
// 9. IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('get-games', () => readGames());

ipcMain.handle('add-game', (_e, game) => {
  const games = readGames();
  games.push(game);
  writeGames(games);
  return games;
});

ipcMain.handle('remove-game', (_e, index) => {
  const games = readGames();
  if (index >= 0 && index < games.length) {
    games.splice(index, 1);
    writeGames(games);
  }
  return games;
});

ipcMain.handle('launch-game', (_e, url) => {
  createGameWindow(url);
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.hide();
  }
});

ipcMain.handle('get-settings', () => readSettings());

ipcMain.handle('save-settings', (_e, newSettings) => {
  const current = readSettings();
  const merged = { ...current, ...newSettings };
  writeSettings(merged);
  return merged;
});

ipcMain.handle('get-gpu-status', () => {
  const featureStatus = app.getGPUFeatureStatus();
  return {
    vulkan: featureStatus.vulkan === 'enabled_on' || featureStatus.vulkan === 'enabled',
    webgpu: featureStatus.webgpu === 'enabled_on' || featureStatus.webgpu === 'enabled',
    compositing: featureStatus.gpu_compositing,
    platform: process.platform,
    session: process.env.XDG_SESSION_TYPE || 'unknown',
  };
});

ipcMain.handle('open-gpu-info', () => {
  const gpuWin = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'GPU Info — chrome://gpu',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  gpuWin.setMenuBarVisibility(false);
  gpuWin.loadURL('chrome://gpu');
});

ipcMain.handle('get-platform', () => process.platform);

// ---------------------------------------------------------------------------
// 10. App ready
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  if (directUrl) {
    createGameWindow(directUrl);
  } else {
    createLauncherWindow();
  }

  app.on('activate', () => {
    if (!launcherWindow && !gameWindow) createLauncherWindow();
  });
});

app.on('window-all-closed', () => {
  stopPowerBlock();
  if (platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url: openUrl }) => {
    shell.openExternal(openUrl);
    return { action: 'deny' };
  });
});
