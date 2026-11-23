// GameShell — main process (production)
// Minimal fullscreen Electron wrapper for WebGL/WebGPU browser games.

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  powerSaveBlocker,
  session,
} = require('electron');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// 0. Helpers
// ---------------------------------------------------------------------------

const isDev =
  process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

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
    vsync: false,
    overlayDefault: false,
    fullscreenDefault: true,
    highMemWasm: true,
    lastGameUrl: '',
  };
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    // Whitelist only known keys to prevent injection
    return {
      vsync: typeof parsed.vsync === 'boolean' ? parsed.vsync : defaults.vsync,
      overlayDefault:
        typeof parsed.overlayDefault === 'boolean'
          ? parsed.overlayDefault
          : defaults.overlayDefault,
      fullscreenDefault:
        typeof parsed.fullscreenDefault === 'boolean'
          ? parsed.fullscreenDefault
          : defaults.fullscreenDefault,
      highMemWasm:
        typeof parsed.highMemWasm === 'boolean'
          ? parsed.highMemWasm
          : defaults.highMemWasm,
      lastGameUrl:
        typeof parsed.lastGameUrl === 'string'
          ? parsed.lastGameUrl.slice(0, 2048)
          : defaults.lastGameUrl,
    };
  } catch {
    return defaults;
  }
}

/** Persist settings. */
function writeSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}

/** Games list path — stored in userData so user edits persist. */
function gamesJsonPath() {
  const userCopy = path.join(app.getPath('userData'), 'games.json');
  if (fs.existsSync(userCopy)) return userCopy;
  // On first run (or packaged), copy bundled games to userData
  const bundled = app.isPackaged
    ? (() => {
        const res = path.join(process.resourcesPath, 'games.json');
        return fs.existsSync(res) ? res : appPath('games.json');
      })()
    : appPath('games.json');
  try {
    fs.mkdirSync(path.dirname(userCopy), { recursive: true });
    fs.copyFileSync(bundled, userCopy);
    return userCopy;
  } catch {
    return bundled;
  }
}

function readGames() {
  try {
    const raw = JSON.parse(fs.readFileSync(gamesJsonPath(), 'utf-8'));
    if (!Array.isArray(raw)) return [];
    // Validate each entry
    return raw
      .filter(
        (g) =>
          g &&
          typeof g.name === 'string' &&
          typeof g.url === 'string' &&
          g.name.length <= 100 &&
          g.url.length <= 2048
      )
      .map((g) => ({ name: g.name, url: g.url }));
  } catch {
    return [];
  }
}

function writeGames(games) {
  fs.writeFileSync(gamesJsonPath(), JSON.stringify(games, null, 2));
}

/** Validate a URL is safe (https or http). */
function isValidGameUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
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
if (directUrl && !isValidGameUrl(directUrl)) {
  console.error(`[GameShell] Invalid URL: ${directUrl}`);
  directUrl = null;
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

// WASM memory and shader cache
if (settings.highMemWasm) {
  app.commandLine.appendSwitch(
    'js-flags',
    '--max-old-space-size=8192 --wasm-tier-up'
  );
  app.commandLine.appendSwitch('disk-cache-size', '2147483648');
}

// Enable Vulkan, WebGPU, SharedArrayBuffer and multi-threaded WASM
const features = [
  'Vulkan',
  'WebGPU',
  'SharedArrayBuffer',
  'WebAssemblyLazyCompilation',
  'WebAssemblyTiering',
];

// Dawn optimizations
app.commandLine.appendSwitch('enable-dawn-features', 'allow_unsafe_apis');

// Prevent background throttling
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
    console.log(
      '[GameShell] Wayland detected — ozone-platform=wayland, Vulkan+WebGPU active'
    );
  } else {
    app.commandLine.appendSwitch('ozone-platform', 'x11');
    console.log(
      '[GameShell] X11 detected — ozone-platform=x11, Vulkan+WebGPU active'
    );
  }

  app.commandLine.appendSwitch('enable-features', features.join(','));

  if (!process.env.DRI_PRIME) {
    console.log(
      '[GameShell] Tip: hybrid-GPU laptops — use `npm run start:dgpu`'
    );
  }
} else if (platform === 'win32') {
  app.commandLine.appendSwitch('enable-features', features.join(','));
} else if (platform === 'darwin') {
  // macOS: Metal for WebGPU, no Vulkan
  app.commandLine.appendSwitch(
    'enable-features',
    'WebGPU,SharedArrayBuffer,WebAssemblyLazyCompilation,WebAssemblyTiering'
  );
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
  }
}

function stopPowerBlock() {
  if (powerBlockerId !== null) {
    powerSaveBlocker.stop(powerBlockerId);
    powerBlockerId = null;
  }
}

// ---------------------------------------------------------------------------
// 5. Security: permission handler & CSP headers
// ---------------------------------------------------------------------------

function setupSessionSecurity() {
  const ses = session.defaultSession;

  // Deny all permission requests from game pages
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  ses.setPermissionCheckHandler(() => false);

  // Inject security headers on all responses
  ses.webRequest.onHeadersReceived((details, callback) => {
    const headers = { ...details.responseHeaders };
    headers['X-Content-Type-Options'] = ['nosniff'];
    headers['X-Frame-Options'] = ['DENY'];
    headers['Referrer-Policy'] = ['no-referrer'];
    callback({ responseHeaders: headers });
  });
}

// ---------------------------------------------------------------------------
// 6. Launcher window
// ---------------------------------------------------------------------------

function createLauncherWindow() {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.show();
    launcherWindow.focus();
    return;
  }

  launcherWindow = new BrowserWindow({
    width: 740,
    height: 660,
    minWidth: 480,
    minHeight: 400,
    title: 'GameShell',
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: appPath('preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
      webviewTag: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  launcherWindow.setMenuBarVisibility(false);
  launcherWindow.loadFile(appPath('launcher', 'index.html'));

  launcherWindow.once('ready-to-show', () => launcherWindow.show());

  // Block any navigation in the launcher window (it only loads local files)
  launcherWindow.webContents.on('will-navigate', (e) => {
    e.preventDefault();
  });

  launcherWindow.webContents.setWindowOpenHandler(() => ({
    action: 'deny',
  }));

  launcherWindow.on('closed', () => {
    launcherWindow = null;
    if (!gameWindow || gameWindow.isDestroyed()) app.quit();
  });
}

// ---------------------------------------------------------------------------
// 7. Game window
// ---------------------------------------------------------------------------

function createGameWindow(url) {
  if (!isValidGameUrl(url)) return;

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
      // Game window has NO Node access and NO preload — zero attack surface
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false,
      webviewTag: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  gameWindow.setMenuBarVisibility(false);

  let allowedOrigin = '';
  try {
    allowedOrigin = new URL(url).origin;
  } catch {
    allowedOrigin = '';
  }

  // Lock navigation to the game's origin only
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

  // Block popups — open external links in system browser
  gameWindow.webContents.setWindowOpenHandler(({ url: openUrl }) => {
    try {
      if (new URL(openUrl).protocol.startsWith('http')) {
        shell.openExternal(openUrl);
      }
    } catch {
      /* ignore */
    }
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
// 8. FPS overlay
// ---------------------------------------------------------------------------

function injectOverlay() {
  if (!gameWindow || gameWindow.isDestroyed()) return;

  try {
    const overlayCSS = fs.readFileSync(
      appPath('overlay', 'overlay.css'),
      'utf-8'
    );
    const overlayJS = fs.readFileSync(
      appPath('overlay', 'overlay.js'),
      'utf-8'
    );

    gameWindow.webContents.insertCSS(overlayCSS);
    gameWindow.webContents.executeJavaScript(overlayJS).catch(() => {});

    const display = overlayVisible ? 'block' : 'none';
    gameWindow.webContents
      .executeJavaScript(
        `document.getElementById('gs-overlay')?.style.setProperty('display','${display}')`
      )
      .catch(() => {});
  } catch {
    /* ignore */
  }
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
// 9. Keyboard shortcuts (game window)
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
          buttons: ['Return to Launcher', 'Stay'],
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
// 10. IPC handlers (with input validation)
// ---------------------------------------------------------------------------

ipcMain.handle('get-games', () => readGames());

ipcMain.handle('add-game', (_e, game) => {
  // Validate input
  if (!game || typeof game !== 'object') return readGames();
  const name =
    typeof game.name === 'string' ? game.name.trim().slice(0, 100) : '';
  const url =
    typeof game.url === 'string' ? game.url.trim().slice(0, 2048) : '';
  if (!name || !url || !isValidGameUrl(url)) return readGames();

  const games = readGames();
  // Prevent duplicates by URL
  if (games.some((g) => g.url === url)) return games;
  games.push({ name, url });
  writeGames(games);
  return games;
});

ipcMain.handle('remove-game', (_e, index) => {
  if (typeof index !== 'number' || !Number.isInteger(index)) return readGames();
  const games = readGames();
  if (index >= 0 && index < games.length) {
    games.splice(index, 1);
    writeGames(games);
  }
  return games;
});

ipcMain.handle('launch-game', (_e, url) => {
  if (typeof url !== 'string' || !isValidGameUrl(url)) return;
  createGameWindow(url);
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.hide();
  }
});

ipcMain.handle('get-settings', () => readSettings());

ipcMain.handle('save-settings', (_e, newSettings) => {
  if (!newSettings || typeof newSettings !== 'object') return readSettings();
  const current = readSettings();
  // Only allow known boolean keys
  const allowed = ['vsync', 'overlayDefault', 'fullscreenDefault', 'highMemWasm'];
  for (const key of allowed) {
    if (typeof newSettings[key] === 'boolean') {
      current[key] = newSettings[key];
    }
  }
  writeSettings(current);
  return current;
});

ipcMain.handle('get-gpu-status', () => {
  const featureStatus = app.getGPUFeatureStatus();
  return {
    vulkan:
      featureStatus.vulkan === 'enabled_on' ||
      featureStatus.vulkan === 'enabled',
    webgpu:
      featureStatus.webgpu === 'enabled_on' ||
      featureStatus.webgpu === 'enabled',
    compositing: featureStatus.gpu_compositing,
    platform: process.platform,
    session: process.env.XDG_SESSION_TYPE || 'unknown',
  };
});

ipcMain.handle('open-gpu-info', () => {
  const gpuWin = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'GPU Info',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });
  gpuWin.setMenuBarVisibility(false);
  gpuWin.loadURL('chrome://gpu');
});

ipcMain.handle('get-platform', () => process.platform);

// ---------------------------------------------------------------------------
// 11. App ready
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  setupSessionSecurity();

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

// Global: deny window opens and navigation to unexpected origins
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url: openUrl }) => {
    try {
      if (new URL(openUrl).protocol.startsWith('http')) {
        shell.openExternal(openUrl);
      }
    } catch {
      /* ignore */
    }
    return { action: 'deny' };
  });
});
