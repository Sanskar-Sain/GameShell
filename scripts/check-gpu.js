#!/usr/bin/env node
// GameShell — GPU diagnostics script
// Usage: npm run check-gpu  (or: node scripts/check-gpu.js)

const { execSync, spawnSync } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

console.log('╔═════════════════════════════════════════════════════════════╗');
console.log('║                GameShell — GPU Diagnostics                  ║');
console.log('╚═════════════════════════════════════════════════════════════╝\n');

console.log(`Platform : ${os.platform()} (${os.arch()})`);
console.log(`OS       : ${os.type()} ${os.release()}`);
console.log(`Node     : ${process.version}\n`);

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

const platform = os.platform();

// System GPU Detection
if (platform === 'linux') {
  const lspci = run('lspci | grep -iE "vga|3d|display"');
  if (lspci) {
    console.log('Hardware GPU(s):');
    lspci.split('\n').forEach((l) => console.log(`  • ${l.trim()}`));
  } else {
    console.log('Hardware GPU: (lspci not found)');
  }

  const session = process.env.XDG_SESSION_TYPE || 'unknown';
  const wayland = process.env.WAYLAND_DISPLAY || '';
  console.log(`\nDisplay Server : ${session}${wayland ? ` (${wayland})` : ''}`);
  console.log(`DRI_PRIME      : ${process.env.DRI_PRIME || 'not set (use `npm run start:dgpu` on hybrid laptops)'}`);
} else if (platform === 'win32') {
  const gpu = run('wmic path win32_VideoController get Name /value');
  if (gpu) console.log(`Hardware GPU: ${gpu.replace('Name=', '').trim()}`);
} else if (platform === 'darwin') {
  const gpu = run('system_profiler SPDisplaysDataType 2>/dev/null | grep "Chipset Model"');
  if (gpu) console.log(`Hardware GPU: ${gpu.replace('Chipset Model:', '').trim()}`);
}

// In-Engine GPU & WebGL / WebGPU Feature Probing
console.log('\n--- Probing Chromium Engine GPU / WebGL / WebGPU ---');
const probeScript = path.join(__dirname, 'gpu-probe.js');
let probeData = null;

try {
  const electronBin = path.join(__dirname, '..', 'node_modules', '.bin', 'electron');
  // Pass --no-sandbox if necessary for environments without user namespaces
  const res = spawnSync(electronBin, ['--no-sandbox', probeScript], {
    encoding: 'utf-8',
    timeout: 10000,
    env: { ...process.env },
  });

  const out = res.stdout || '';
  const startTag = '---GPU_PROBE_JSON_START---';
  const endTag = '---GPU_PROBE_JSON_END---';
  if (out.includes(startTag) && out.includes(endTag)) {
    const raw = out.split(startTag)[1].split(endTag)[0].trim();
    probeData = JSON.parse(raw);
  }
} catch (e) {
  // Probe failed or timed out
}

if (probeData && probeData.inBrowserInfo) {
  const info = probeData.inBrowserInfo;
  console.log(`WebGL 1 Support : ${info.webgl1 ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`WebGL 2 Support : ${info.webgl2 ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`GL Vendor       : ${info.glVendor}`);
  console.log(`GL Renderer     : ${info.glRenderer}`);
  console.log(`WebGPU Support  : ${info.webgpu ? `✅ Enabled (${info.gpuAdapter})` : '⚠️ Not available or software fallback'}`);

  if (probeData.gpuInfo && probeData.gpuInfo.gpuDevice && probeData.gpuInfo.gpuDevice[0]) {
    const dev = probeData.gpuInfo.gpuDevice[0];
    console.log(`Active Device ID: 0x${dev.deviceId ? dev.deviceId.toString(16) : 'N/A'} (Vendor 0x${dev.vendorId ? dev.vendorId.toString(16) : 'N/A'})`);
  }
} else {
  console.log('Engine probe: Run inside graphical desktop to inspect in-engine GL renderer.');
}

console.log('\n--- Applied Electron GPU Flags ---');
console.log('  • --ignore-gpu-blocklist');
console.log('  • --enable-gpu-rasterization');
console.log('  • --enable-zero-copy');
console.log('  • --enable-unsafe-webgpu');
if (platform === 'linux') {
  const sessionType = process.env.XDG_SESSION_TYPE || '';
  const waylandDisplay = process.env.WAYLAND_DISPLAY || '';
  if (sessionType === 'wayland' || waylandDisplay) {
    console.log('  • --ozone-platform=wayland');
    console.log('  • --enable-features=WebGPU');
  } else {
    console.log('  • --ozone-platform=x11');
    console.log('  • --enable-features=Vulkan,WebGPU,VulkanFromANGLE,DefaultANGLEVulkan');
  }
} else {
  console.log('  • --enable-features=Vulkan,WebGPU');
}

console.log('\nTo verify visual GPU status:');
console.log('  1. Launch GameShell (npm start) -> click "GPU Info"');
console.log('  2. Review chrome://gpu for Graphics Feature Status\n');
