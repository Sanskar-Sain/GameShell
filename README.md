# GameShell

Minimal fullscreen Electron wrapper for WebGL & WebGPU browser games.  
Strips away all browser chrome so nearly all CPU/GPU resources go to the game.

**Platforms:** Linux · macOS · Windows

---

## Quick Start

```bash
npm install
npm start
```

Launch a URL directly (skip the launcher):

```bash
npm start -- --url=https://memorycardflipgame.netlify.app/
```

Dev mode (Ctrl+Shift+I opens DevTools):

```bash
npm run dev
```

Linux hybrid-GPU laptops:

```bash
npm run start:dgpu          # launches with DRI_PRIME=1
```

## Keyboard Shortcuts

| Key            | Action                              |
| -------------- | ----------------------------------- |
| F11            | Toggle fullscreen                   |
| F3             | Toggle FPS / frame-time overlay     |
| Esc            | Return to launcher (with confirm)   |
| Ctrl+Shift+I   | DevTools (dev mode only)           |

## Default Games

| Game              | URL                                           |
| ----------------- | --------------------------------------------- |
| Memory Card Flip  | https://memorycardflipgame.netlify.app/        |
| Tic Tac Toe       | https://tictactoe-sanskar.netlify.app/          |
| Sudoku Master     | https://sudoku-master-rouge.vercel.app/         |

Add or remove games from the launcher UI.  
Games are stored in `~/.config/gameshell/games.json` (Linux).

## Settings

Configured in the launcher Settings panel. Stored in `~/.config/gameshell/settings.json`.

| Setting            | Default | Note                                      |
| ------------------ | ------- | ----------------------------------------- |
| V-Sync             | OFF     | Uncapped FPS; restart required to change   |
| High-Mem WASM      | ON      | 8 GB heap + 2 GB shader cache              |
| Fullscreen         | ON      | Games launch in fullscreen by default       |
| FPS Overlay        | OFF     | Toggle anytime with F3                     |

## GPU & Performance

GameShell applies aggressive GPU flags before the app window opens:

- `--ignore-gpu-blocklist` — force hardware acceleration
- `--enable-gpu-rasterization` / `--enable-zero-copy`
- `--enable-unsafe-webgpu` + `--enable-dawn-features=allow_unsafe_apis`
- Vulkan + WebGPU + SharedArrayBuffer + WASM tiering enabled
- Background throttling and vsync disabled (configurable)
- Unused Chromium subsystems stripped (spellcheck, extensions, translate, sync)

### Verify GPU

```bash
npm run check-gpu
```

Or click **GPU Info** in the launcher to open `chrome://gpu`.

## Per-OS Notes

### Linux

- Wayland and X11 are auto-detected via `XDG_SESSION_TYPE` / `WAYLAND_DISPLAY`.
- Vulkan is enabled on both display servers.
- Hybrid-GPU laptops: `npm run start:dgpu` sets `DRI_PRIME=1`.
- If you see the sandbox error, run with `--no-sandbox` or configure the SUID sandbox per [Electron docs](https://www.electronjs.org/docs/latest/tutorial/sandbox#linux-sandbox-suid).

### macOS

- Metal is automatic for WebGPU.
- `powerSaveBlocker` prevents App Nap and display sleep during gameplay.

### Windows

- D3D11 backend by default; Vulkan enabled via feature flags.
- For best performance, set GameShell to **High performance** in Windows Settings → System → Display → Graphics.

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on all windows.
- Game window has **zero** Node/IPC access (no preload script).
- Navigation is locked to the game's origin; other links open in the system browser.
- All permission requests (camera, mic, geolocation) are denied.
- CSP headers, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` injected.
- IPC handlers validate and whitelist all inputs; preload uses a channel allowlist.
- No `webviewTag`, no `allowRunningInsecureContent`, no `remote` module.
- No API keys, tokens, or secrets anywhere in the codebase.

## Build

```bash
npm run build:linux    # AppImage + pacman
npm run build:mac      # dmg (run on macOS)
npm run build:win      # nsis (run on Windows or cross-compile)
```

Linux outputs land in `dist/`.

## Project Structure

```
main.js              Main process — window management, GPU flags, security
preload.js           Secure IPC bridge for the launcher (channel allowlist)
games.json           Default game list (copied to userData on first run)
launcher/
  index.html         Launcher UI
  launcher.js        Renderer logic
  style.css          Minimalist dark theme
overlay/
  overlay.js         FPS / frame-time HUD (injected into game page)
  overlay.css         Overlay styles
scripts/
  check-gpu.js       CLI GPU diagnostics
  gpu-probe.js       Headless Electron GPU probe
  dev-run.sh         Dev launch helper
build/
  icon.png           App icon (512×512)
  icon.ico           Windows icon
```

## Limitations

- This wrapper removes browser overhead but cannot exceed what the game's own WebGL/WebGPU code allows.
- WebGPU games require a compatible GPU and up-to-date drivers.
- Some Wayland compositors may show a Vulkan surface warning in stderr — this is cosmetic and does not affect WebGPU functionality.
- Cross-origin game iframes are blocked by design.

## License

MIT
