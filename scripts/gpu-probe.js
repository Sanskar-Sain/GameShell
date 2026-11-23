// Electron GPU probe — outputs JSON with GPU, WebGL, and WebGPU status
// Used by: npm run check-gpu
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Apply the same GPU flags as main.js
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan,WebGPU');

if (process.platform === 'linux') {
  const sessionType = process.env.XDG_SESSION_TYPE || '';
  const waylandDisplay = process.env.WAYLAND_DISPLAY || '';
  if (sessionType === 'wayland' || waylandDisplay) {
    app.commandLine.appendSwitch('ozone-platform', 'wayland');
  } else {
    app.commandLine.appendSwitch('ozone-platform', 'x11');
  }
}

app.whenReady().then(async () => {
  try {
    const gpuInfo = await app.getGPUInfo('basic').catch(() => ({}));

    // Create a minimal hidden window for probing — we need a renderer to
    // test WebGL/WebGPU APIs. We load a blank data URL instead of any file.
    const win = new BrowserWindow({
      show: false,
      width: 100,
      height: 100,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    await win.loadURL('data:text/html,<html></html>');

    const inBrowserInfo = await win.webContents
      .executeJavaScript(
        `(async () => {
        const result = {
          webgl1: false, webgl2: false, webgpu: false,
          glVendor: 'N/A', glRenderer: 'N/A', gpuAdapter: 'N/A',
        };
        try {
          const c1 = document.createElement('canvas');
          const gl1 = c1.getContext('webgl');
          if (gl1) {
            result.webgl1 = true;
            const ext = gl1.getExtension('WEBGL_debug_renderer_info');
            if (ext) {
              result.glVendor = gl1.getParameter(ext.UNMASKED_VENDOR_WEBGL);
              result.glRenderer = gl1.getParameter(ext.UNMASKED_RENDERER_WEBGL);
            }
          }
        } catch {}
        try {
          const c2 = document.createElement('canvas');
          if (c2.getContext('webgl2')) result.webgl2 = true;
        } catch {}
        try {
          if (navigator.gpu) {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
              result.webgpu = true;
              const info = adapter.info || {};
              result.gpuAdapter = ((info.vendor || '') + ' ' + (info.architecture || info.device || '')).trim() || 'Available';
            } else {
              result.gpuAdapter = 'Adapter unavailable';
            }
          } else {
            result.gpuAdapter = 'navigator.gpu not available';
          }
        } catch (e) {
          result.gpuAdapter = 'Error: ' + e.message;
        }
        return result;
      })()`
      )
      .catch((err) => ({ error: err.message }));

    const featureStatus = app.getGPUFeatureStatus();
    inBrowserInfo.vulkanActive =
      featureStatus.vulkan === 'enabled_on' ||
      featureStatus.vulkan === 'enabled' ||
      inBrowserInfo.webgpu;

    console.log('---GPU_PROBE_JSON_START---');
    console.log(
      JSON.stringify({ featureStatus, gpuInfo, inBrowserInfo }, null, 2)
    );
    console.log('---GPU_PROBE_JSON_END---');

    win.destroy();
  } catch (err) {
    console.error('Probe error:', err);
  } finally {
    app.quit();
  }
});
