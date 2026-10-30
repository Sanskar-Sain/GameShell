# 🎮 GameShell

A minimal, fullscreen Electron wrapper engineered specifically for WebGL and WebGPU browser games (such as the Cyberpunk 2077 web port by developer omonkeyzz) with near-zero browser overhead, ensuring maximum CPU, GPU, and memory resources go directly to the game.

**Supported platforms:** Linux (Arch, Debian, Fedora) · macOS · Windows

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
| **F3**           | Toggle live FPS & frame-time HUD         |
| **Esc**          | Return to launcher (with confirmation)   |
| **Ctrl+Shift+I** | Open DevTools (dev mode only)            |

## WebGPU & Cyberpunk 2077 Web Optimization

The Cyberpunk 2077 browser port is rendered **locally on your graphics card** using **WebGPU** and **WebAssembly (WASM)**. GameShell includes specific optimizations tailored for heavy WebGPU/WASM workloads:

1. **Hardware Vulkan Backend for Dawn**: On Linux, Chromium's WebGPU engine (Dawn) requires native Vulkan to execute compute and render pipelines on your GPU. GameShell enables full Vulkan ICD hardware acceleration (`vulkan-intel` for Intel Iris Xe, `vulkan-radeon` for AMD, `nvidia-utils` for NVIDIA).
2. **4 GB WebGPU Storage Buffers**: Unlocks maximum WebGPU adapter limits (`maxBufferSize: 4GB`, `maxStorageBufferBindingSize: 4GB`), allowing massive vertex and texture data without CPU thrashing.
3. **8 GB High-Performance WASM Heap**: Configured with `--max-old-space-size=8192` and `--wasm-tier-up` to prevent out-of-memory crashes and GC stutter during high-intensity scenes.
4. **2 GB Persistent Shader & Asset Disk Cache**: `--disk-cache-size=2147483648` caches compiled WebGPU WGSL shaders and game assets locally so subsequent game launches load dramatically faster.
5. **Unlocked Framerate (Zero V-Sync Lag)**: V-Sync is disabled by default to eliminate input lag and frame pacing stutters on 120Hz/144Hz monitors.

> 💡 **Initial Load Note**: On first launch, the game must download assets and compile shaders into the local cache. Once cached, loading times and frame pacing improve significantly.

## Settings

Settings are stored in `<userData>/settings.json` and can be adjusted directly from the launcher UI:

| Setting           | Default | Description |
| ----------------- | ------- | ----------- |
| `vsync`           | `false` | Unlocked framerate. Disable V-Sync for lowest input lag; enable to prevent tearing on 60Hz panels. |
| `highMemWasm`     | `true`  | 8GB WASM heap + 2GB shader cache. Crucial for Cyberpunk 2077 web. |
| `fullscreenDefault` | `true` | Launch games directly in fullscreen kiosk mode. |
| `overlayDefault`  | `false` | Display FPS / frame-time HUD automatically on game launch. |
| `lastGameUrl`     | `""`    | Remembered last played game. |

## GPU Diagnostics & Verification

### In-App Verification
1. Launch GameShell (`npm start`).
2. Check the top header badge: **⚡ Vulkan & WebGPU Active**.
3. Click **Open chrome://gpu** to view the full Chromium GPU feature matrix:
   - **Vulkan**: Enabled
   - **WebGPU**: Enabled
   - **Compositing**: Hardware Accelerated

### CLI Verification (`npm run check-gpu`)
Run our diagnostic suite anytime from the terminal:
```bash
npm run check-gpu
```
Example output on Arch Linux (Intel Iris Xe):
```
--- Probing Chromium Engine GPU / WebGL / WebGPU ---
Vulkan Backend  : ✅ Active (Hardware accelerated)
WebGPU Support  : ✅ Enabled (intel gen-12lp)
WebGL 1 Support : ✅ Enabled
WebGL 2 Support : ✅ Enabled
GL Vendor       : Google Inc. (Intel)
GL Renderer     : ANGLE (Intel, Mesa Intel(R) Iris(R) Xe Graphics (TGL GT2), OpenGL ES 3.2)
Active Device ID: 0x9a49 (Vendor 0x8086)
```

## Per-OS Notes

### Linux (Arch Linux tested)
- **Wayland vs X11**: Automatically detected from `$XDG_SESSION_TYPE` and `$WAYLAND_DISPLAY`. Uses `--ozone-platform=wayland` natively with Vulkan & WebGPU enabled for Dawn.
- **Hybrid GPUs (Intel + NVIDIA / AMD)**: Run `npm run start:dgpu` (sets `DRI_PRIME=1`) or use `prime-run npm start` on NVIDIA Optimus laptops.
- **Vulkan Drivers**: Ensure your GPU's driver is installed (`sudo pacman -S vulkan-intel vulkan-icd-loader` for Intel, `vulkan-radeon` for AMD, or `nvidia-utils` for NVIDIA).

### macOS
- **Metal** is utilized automatically for WebGPU.
- **App Nap** and display sleep are prevented while a game is running using `powerSaveBlocker`.
- Build target: `npm run build:mac` (`.dmg`).

### Windows
- Uses DirectX 12 / Dawn for WebGPU and D3D11 for ANGLE WebGL.
- For dual-GPU laptops, ensure GameShell is set to **High performance** in Windows Display Settings.
- Build target: `npm run build:win` (NSIS installer).

## Building Standalone Packages

```bash
# Linux (generates AppImage and pacman package)
npm run build:linux

# macOS
npm run build:mac

# Windows
npm run build:win
```

Packaged output appears in `dist/`:
- **AppImage**: `dist/GameShell-1.0.0.AppImage` (portable executable)
- **Arch Pacman**: `dist/gameshell-1.0.0.pacman` (install with `sudo pacman -U dist/gameshell-1.0.0.pacman`)

## Security Architecture

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- The game window has **zero** Node.js or Electron IPC access.
- Navigation is strictly locked to the chosen game's origin; external links automatically open in your default system browser.
- The launcher only loads local files with strict Content Security Policy.

## Limitations

> **Honest Note:** GameShell strips away browser chrome overhead (tabs, URL bar, extensions, background sync) and applies extreme GPU & WASM optimization flags, but it **cannot exceed** the game's own code or hardware limits. Performance depends on:
> - The game port's optimization (the Cyberpunk 2077 web port is experimental)
> - Your GPU hardware (e.g. integrated Iris Xe vs dedicated RTX)
> - Thermal headroom and available RAM

## License

MIT
