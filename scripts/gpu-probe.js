// Electron GPU probe - outputs JSON with active GPU, WebGL, and WebGPU status
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Apply the same GPU flags as main.js
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan,WebGPU');

const sessionType = process.env.XDG_SESSION_TYPE || '';
const waylandDisplay = process.env.WAYLAND_DISPLAY || '';
if (process.platform === 'linux') {
  if (sessionType === 'wayland' || waylandDisplay) {
    app.commandLine.appendSwitch('ozone-platform', 'wayland');
  } else {
    app.commandLine.appendSwitch('ozone-platform', 'x11');
  }
}

app.whenReady().then(async () => {
  try {
    const gpuInfo = await app.getGPUInfo('basic').catch(() => ({}));

    const win = new BrowserWindow({
      show: false,
      width: 600,
      height: 400,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
    });

    const probeHtml = path.join(__dirname, '..', 'launcher', 'index.html');
    await win.loadFile(probeHtml);

    const inBrowserInfo = await win.webContents.executeJavaScript(`
      (async () => {
        const result = {
          webgl1: false,
          webgl2: false,
          webgpu: false,
          glVendor: 'N/A',
          glRenderer: 'N/A',
          gpuAdapter: 'N/A',
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
        } catch (e) {}

        try {
          const c2 = document.createElement('canvas');
          const gl2 = c2.getContext('webgl2');
          if (gl2) result.webgl2 = true;
        } catch (e) {}

        try {
          if (navigator.gpu) {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
              result.webgpu = true;
              const info = adapter.info || (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo() : {});
              result.gpuAdapter = ((info.vendor || '') + ' ' + (info.architecture || info.device || '')).trim() || 'Hardware Adapter (Available)';
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
      })()
    `).catch((err) => ({ error: err.message }));

    // Read feature status AFTER WebGPU adapter initialization
    const featureStatus = app.getGPUFeatureStatus();
    inBrowserInfo.vulkanActive = featureStatus.vulkan === 'enabled_on' || featureStatus.vulkan === 'enabled' || inBrowserInfo.webgpu;

    console.log('---GPU_PROBE_JSON_START---');
    console.log(JSON.stringify({
      featureStatus,
      gpuInfo,
      inBrowserInfo,
    }, null, 2));
    console.log('---GPU_PROBE_JSON_END---');

    win.destroy();
  } catch (err) {
    console.error('Probe error:', err);
  } finally {
    app.quit();
  }
});
