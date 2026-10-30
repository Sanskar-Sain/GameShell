# 🎮 GameShell

A minimal, fullscreen Electron wrapper that loads WebGL/WebGPU browser games with as little overhead as possible, so nearly all CPU/GPU resources go to the website.

**Supported platforms:** Linux · macOS · Windows (no mobile)

---

## Quick Start

```bash
# Install dependencies
npm install

# Run the launcher
npm start

# Run with a specific URL directly (no launcher)
npm start -- --url=https://cyberpunk2077.lol

# Dev mode (Ctrl+Shift+I opens DevTools)
npm run dev

# Linux: launch with discrete GPU on hybrid laptops
npm run start:dgpu
```

## Keyboard Shortcuts

| Key              | Action                                   |
| ---------------- | ---------------------------------------- |
| **F11**          | Toggle fullscreen                        |
| **F3**           | Toggle FPS / frame-time overlay          |
| **Esc**          | Return to launcher (with confirmation)   |
| **Ctrl+Shift+I** | Open DevTools (dev mode only)            |

## Adding Games

1. In the launcher, fill in the **Game name** and **URL** fields and click **+ Add**.
2. Or edit `games.json` directly (in dev) or the copy in your user-data directory (when packaged).

```json
[
  { "name": "Cyberpunk 2077 (Web)", "url": "https://cyberpunk2077.lol" },
  { "name": "HexGL", "url": "https://hexgl.bkcore.com/play/" }
]
```

## Settings

Settings are saved in `<userData>/settings.json` and can also be changed from the launcher UI:

| Setting           | Default | Description                                        |
| ----------------- | ------- | -------------------------------------------------- |
| `vsync`           | `true`  | V-Sync on/off (restart required). Off = uncapped FPS but may tear. |
| `fullscreenDefault` | `true` | Launch games in fullscreen                          |
| `overlayDefault`  | `false` | Show FPS overlay automatically on game launch       |
| `lastGameUrl`     | `""`    | Remembered last-played game URL                     |

## GPU & Performance

GameShell applies aggressive Chromium GPU flags before the app window opens:

- `--ignore-gpu-blocklist` — force GPU acceleration even on "blocklisted" drivers
- `--enable-gpu-rasterization` — GPU-accelerated page rasterization
- `--enable-zero-copy` — zero-copy GPU memory buffers
- `--enable-unsafe-webgpu` — enable WebGPU API
- `--enable-features=Vulkan,WebGPU` — Vulkan backend + WebGPU (plus VulkanFromANGLE on Linux)
- Disables: spellcheck, extensions, translate, background networking, component updates, sync

### Verifying GPU Acceleration

1. Click **GPU Info** in the launcher to open `chrome://gpu`.
2. Look for **Hardware accelerated** next to WebGL, Rasterization, Video Decode, etc.
3. WebGPU should show **Enabled** (requires supported hardware/drivers).
4. Or run: `npm run check-gpu`

## Per-OS Notes

### Linux (your platform)

- **Wayland vs X11**: Auto-detected from `$XDG_SESSION_TYPE` and `$WAYLAND_DISPLAY`. Uses `--ozone-platform=wayland` or `x11` accordingly.
- **Hybrid GPU (laptop with Intel + NVIDIA/AMD)**: Use `npm run start:dgpu` which sets `DRI_PRIME=1`. For NVIDIA Optimus with the proprietary driver, use `prime-run npm start` instead.
- **Vulkan**: Install `vulkan-icd-loader` and your GPU's Vulkan driver (`vulkan-radeon`, `nvidia-utils`, or `vulkan-intel`).
- **Sandbox error**: If you see `chrome-sandbox is not configured correctly`, either:
  - Set the SUID bit: `sudo chown root:root node_modules/electron/dist/chrome-sandbox && sudo chmod 4755 node_modules/electron/dist/chrome-sandbox`
  - Or run with `--no-sandbox` (less secure): `npm start -- --no-sandbox`
  - The packaged AppImage handles sandboxing automatically.

### macOS

- **Metal** is used automatically — no extra flags needed.
- **App Nap** is prevented via `powerSaveBlocker` while a game is running.
- Build: `npm run build:mac` (produces a `.dmg`).

### Windows

- Uses the default **D3D11** backend (D3D12 for WebGPU via Dawn).
- For best performance, open **Windows Settings → System → Display → Graphics** and set GameShell to **High performance** (selects your discrete GPU).
- Build: `npm run build:win` (produces an NSIS installer `.exe`).

## Building / Packaging

```bash
# Linux (AppImage + pacman package)
npm run build:linux

# macOS
npm run build:mac

# Windows
npm run build:win
```

Output appears in the `dist/` folder.

## Project Structure

```
├── main.js              # Electron main process (window, GPU flags, per-OS tuning)
├── preload.js           # Secure context bridge (no Node leaks)
├── games.json           # Default game list
├── launcher/
│   ├── index.html       # Launcher UI
│   ├── launcher.js      # Launcher logic
│   └── style.css        # Dark theme styles
├── overlay/
│   ├── overlay.js       # FPS/frame-time counter (injected into game)
│   └── overlay.css      # Overlay styles
├── scripts/
│   ├── dev-run.sh       # Dev launch helper
│   ├── check-gpu.js     # GPU diagnostics CLI
│   └── gpu-probe.js     # Electron in-engine WebGL/WebGPU probing helper
├── build/               # Application icons (512x512 PNG, ICO)
├── dist/                # Packaged binaries (AppImage, pacman)
├── package.json         # Dependencies + build config
└── README.md
```

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- The game window has **no** Node.js access
- Navigation is locked to the game's origin — other links open in the system browser
- The launcher loads only local files (CSP blocks remote content)

## Limitations

> **Honest note:** GameShell removes browser chrome overhead (tabs, extensions, address bar) and applies aggressive GPU flags, but it **cannot exceed** what the game's own WebGL/WebGPU code allows. Performance depends on:
> - The game's rendering code quality
> - Your GPU hardware and drivers
> - Chromium's WebGL/WebGPU implementation
>
> This is a "kiosk mode" wrapper, not a game engine optimizer.

## License

MIT
