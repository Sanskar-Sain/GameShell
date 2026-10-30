// Electron GPU probe - outputs JSON with active GPU, WebGL, and WebGPU status
const { app, BrowserWindow } = require('electron');

// Apply the same GPU flags as main.js
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-unsafe-webgpu');

const sessionType = process.env.XDG_SESSION_TYPE || '';
const waylandDisplay = process.env.WAYLAND_DISPLAY || '';
if (process.platform === 'linux') {
  if (sessionType === 'wayland' || waylandDisplay) {
    app.commandLine.appendSwitch('ozone-platform', 'wayland');
    app.commandLine.appendSwitch('enable-features', 'WebGPU');
  } else {
    app.commandLine.appendSwitch('ozone-platform', 'x11');
    app.commandLine.appendSwitch('enable-features', 'Vulkan,WebGPU,VulkanFromANGLE,DefaultANGLEVulkan');
  }
} else {
  app.commandLine.appendSwitch('enable-features', 'Vulkan,WebGPU');
}

app.whenReady().then(async () => {
  try {
    const featureStatus = app.getGPUFeatureStatus();
    const gpuInfo = await app.getGPUInfo('basic').catch(() => ({}));

    // Probe in-browser WebGL and WebGPU
    const win = new BrowserWindow({
      show: false,
      width: 400,
      height: 300,
      webPreferences: {
        offscreen: true,
        contextIsolation: false,
        nodeIntegration: true,
      },
    });

    await win.loadURL('about:blank');

    const inBrowserInfo = await win.webContents.executeJavaScript(`
      (async () => {
        const result = {
          webgl1: false,
          webgl2: false,
          webgpu: false,
          glVendor: 'N/A',
          glRenderer: 'N/A',
          gpuAdapter: 'N/A'
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
              if (adapter.info) {
                result.gpuAdapter = (adapter.info.vendor || '') + ' ' + (adapter.info.architecture || adapter.info.device || '');
              } else {
                result.gpuAdapter = 'Available (Adapter acquired)';
              }
            }
          }
        } catch (e) {
          result.gpuAdapterError = e.message;
        }

        return result;
      })()
    `).catch((err) => ({ error: err.message }));

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
