# ⚡ GameShell

<p align="center">
  <strong>Next-Gen High-Performance WebGL & WebGPU Desktop Runtime</strong><br>
  <em>Zero Browser Overhead · Native Vulkan & Dawn Acceleration · Kiosk Gaming Sandbox</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Release-v1.1.0-00f0ff?style=for-the-badge" alt="Release v1.1.0">
  <img src="https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-00ff9d?style=for-the-badge" alt="Platforms">
  <img src="https://img.shields.io/badge/GPU-Vulkan%20%2B%20WebGPU-ff007f?style=for-the-badge" alt="Vulkan + WebGPU">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License MIT">
</p>

---

## 🎮 Overview

**GameShell** is an ultra-lightweight, high-performance desktop runtime built with Electron and raw JavaScript. It eliminates the heavy overhead of standard web browsers (tabs, URL bars, omniboxes, extensions, sync, background network services, telemetry), ensuring **nearly 100% of host CPU, GPU, and RAM are dedicated to the game**.

Engineered specifically for demanding 3D WebGL titles and cutting-edge WebGPU/WASM ports (such as the browser port of *Cyberpunk 2077*).

---

## 🚀 Key Features

- **⚡ Zero Overhead**: All unnecessary Chromium background tasks (spellcheck, component updates, translate, sync, background throttling) are permanently disabled.
- **🛡️ Native Hardware Acceleration**:
  - Direct hardware rasterization & zero-copy buffer transfers.
  - Chromium Dawn WebGPU backend with `allow_unsafe_apis` enabled.
  - Vulkan compositing on both Linux **Wayland** and **X11** display servers.
  - D3D11 on Windows, Metal on macOS.
- **🧠 8 GB WASM Memory Heap + 2 GB Shader Cache**:
  - `--js-flags="--max-old-space-size=8192 --wasm-tier-up"` guarantees complex WebAssembly games have ample heap space and run tier-up compilation without stutter.
- **🔒 Hardened Security & Isolation**:
  - The game window operates in complete isolation: **`contextIsolation: true`**, **`nodeIntegration: false`**, and **`sandbox: true`**.
  - **No preload script** in the game window — zero access to Node.js or internal IPC APIs.
  - **Origin Locking**: Navigation is strictly restricted to the game's origin domain. External popups and untrusted links are redirected to the system browser.
  - All device permissions (microphone, camera, geolocation, notifications) are rejected.
  - Strict security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`) applied to all requests.
- **🕹️ Cyber Gamer UI**:
  - Sleek Cyberpunk HUD launcher with real-time hardware status indicators, game registry CRUD, and responsive styling.
  - Built-in toggleable FPS and frame-time overlay (`F3`).
  - Interactive **Hardware Diagnostics Modal** with 100% on-device privacy guarantee.

---

## 🕹️ Included Games (Pre-Loaded)

| Game | Tech Stack | URL |
| :--- | :--- | :--- |
| **Memory Card Flip** | HTML5 / WebGL | [https://memorycardflipgame.netlify.app/](https://memorycardflipgame.netlify.app/) |
| **Tic Tac Toe** | HTML5 / Canvas | [https://tictactoe-sanskar.netlify.app/](https://tictactoe-sanskar.netlify.app/) |
| **Sudoku Master** | Modern WebApp | [https://sudoku-master-rouge.vercel.app/](https://sudoku-master-rouge.vercel.app/) |

> *You can add, edit, or delete any WebGL/WebGPU game via the launcher interface or through the local registry at `~/.config/gameshell/games.json`.*

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>F11</kbd> | Toggle Fullscreen | Game Window |
| <kbd>F3</kbd> | Toggle Real-Time FPS / Frame-Time HUD | Game Window |
| <kbd>Esc</kbd> | Return to Launcher (with confirmation dialog) | Game Window |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> | Toggle DevTools (*development mode only*) | Both |

---

## 🛠️ Quick Start & Installation

### Requirements
- **Node.js**: v20+ recommended (Node v26+ fully supported)
- **Linux / macOS / Windows**

### Installation

```bash
# Clone the repository
git clone https://github.com/Sanskar-Sain/GameShell.git
cd GameShell

# Install dependencies
npm install

# Start the Gamer Launcher
npm start
```

### Launch Directly (Bypass Launcher)

Launch any game URL immediately into borderless fullscreen:

```bash
npm start -- --url=https://memorycardflipgame.netlify.app/
```

### Hybrid-GPU Laptops (NVIDIA Optimus / AMD Prime)

Force execution on discrete GPU (sets `DRI_PRIME=1`):

```bash
npm run start:dgpu
```

### Development Mode

```bash
npm run dev
```

---

## 📊 Diagnostics & Privacy

### Real-Time GPU Status
Verify active hardware acceleration directly from the terminal:

```bash
npm run check-gpu
```

Or click **GPU Diagnostics** inside the launcher to view the in-app hardware HUD or launch the local `chrome://gpu` report.

### 🔒 100% On-Device Privacy Guarantee
- The GPU verification inspects **your own local machine's graphics card** only.
- GameShell contains **zero telemetry**, **zero analytics**, and **zero tracking**.
- No hardware identifiers, game sessions, or system information are ever uploaded or transmitted externally.

---

## 📦 Packaging & Distribution

GameShell is configured with `electron-builder` for multi-platform distribution:

```bash
# Linux (AppImage & pacman package)
npm run build:linux

# macOS (DMG)
npm run build:mac

# Windows (NSIS Installer)
npm run build:win
```

Packaged outputs land in the [`dist/`](dist/) directory.

---

## 📂 Repository Structure

```
├── build/
│   ├── icon.png               # 512x512 application icon
│   └── icon.ico               # Windows icon
├── launcher/
│   ├── index.html             # Cyber HUD launcher interface
│   ├── launcher.js            # Renderer logic & GPU hardware badge
│   └── style.css              # Cyberpunk dark theme & animations
├── overlay/
│   ├── overlay.js             # High-precision FPS & frame-time ticker
│   └── overlay.css            # Smoked glass neon HUD styling
├── scripts/
│   ├── check-gpu.js           # CLI GPU diagnostics probe
│   ├── gpu-probe.js           # Headless Electron graphics inspector
│   └── dev-run.sh             # Dev launch helper script
├── games.json                 # Default bundled games registry
├── main.js                    # Main process (GPU flags, lifecycle, security sandbox)
├── preload.js                 # Channel-whitelisted IPC bridge (safeInvoke)
├── package.json               # Manifest & build configuration
└── README.md                  # Project documentation
```

---

## 👤 Author

**Sanskar Sain**
- **GitHub**: [@Sanskar-Sain](https://github.com/Sanskar-Sain)
- **Repository**: [https://github.com/Sanskar-Sain/GameShell](https://github.com/Sanskar-Sain/GameShell)

---

## 📄 License

This project is licensed under the **MIT License** — feel free to use and distribute.
