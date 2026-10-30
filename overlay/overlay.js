// GameShell — FPS & frame-time overlay (injected into the game page)
// This runs inside the game renderer — no Node, no preload APIs.
(function () {
  'use strict';

  if (document.getElementById('gs-overlay')) return; // already injected

  const el = document.createElement('div');
  el.id = 'gs-overlay';
  el.textContent = 'FPS: --  |  Frame: -- ms';
  document.documentElement.appendChild(el);

  let frames = 0;
  let lastTime = performance.now();
  let lastFrameTime = lastTime;

  function tick(now) {
    frames++;
    const frameDelta = now - lastFrameTime;
    lastFrameTime = now;

    const elapsed = now - lastTime;
    if (elapsed >= 1000) {
      const fps = Math.round((frames * 1000) / elapsed);
      const ft = frameDelta.toFixed(1);
      el.textContent = `FPS: ${fps}  |  Frame: ${ft} ms`;
      frames = 0;
      lastTime = now;
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
