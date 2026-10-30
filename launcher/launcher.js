// GameShell Launcher — renderer script

(async function () {
  const api = window.gameshell;

  // DOM refs
  const gameListEl = document.getElementById('game-list');
  const addForm = document.getElementById('add-game-form');
  const nameInput = document.getElementById('game-name');
  const urlInput = document.getElementById('game-url');
  const btnGpuInfo = document.getElementById('btn-gpu-info');
  const platformNote = document.getElementById('platform-note');
  const gpuBadge = document.getElementById('gpu-badge');

  const settingVsync = document.getElementById('setting-vsync');
  const settingHighmem = document.getElementById('setting-highmem');
  const settingFullscreen = document.getElementById('setting-fullscreen');
  const settingOverlay = document.getElementById('setting-overlay');

  // ------------------------------------------------------------------
  // GPU Status Badge & Platform Info
  // ------------------------------------------------------------------
  try {
    const gpuStatus = await api.getGpuStatus();
    const plat = await api.getPlatform();
    const platNames = { linux: 'Linux', darwin: 'macOS', win32: 'Windows' };
    const osName = platNames[plat] || plat;

    if (gpuStatus.vulkan && gpuStatus.webgpu) {
      gpuBadge.textContent = '⚡ Vulkan & WebGPU Active';
      gpuBadge.className = 'badge badge-success';
    } else if (gpuStatus.webgpu) {
      gpuBadge.textContent = '⚡ WebGPU Active';
      gpuBadge.className = 'badge badge-success';
    } else {
      gpuBadge.textContent = 'Hardware Acceleration Active';
      gpuBadge.className = 'badge badge-info';
    }

    const sessionInfo = gpuStatus.session !== 'unknown' ? ` (${gpuStatus.session})` : '';
    platformNote.textContent = `Running on ${osName}${sessionInfo} • Compositing: ${gpuStatus.compositing}`;
  } catch (err) {
    gpuBadge.textContent = 'Hardware Acceleration';
    gpuBadge.className = 'badge badge-info';
    platformNote.textContent = 'Hardware acceleration flags loaded';
  }

  // ------------------------------------------------------------------
  // Render game list
  // ------------------------------------------------------------------
  async function renderGames() {
    const games = await api.getGames();
    gameListEl.innerHTML = '';

    if (games.length === 0) {
      gameListEl.innerHTML = '<div class="empty-state">No games added yet. Add one below!</div>';
      return;
    }

    games.forEach((game, index) => {
      const card = document.createElement('div');
      card.className = 'game-card';

      const isWebGPUGame = game.url.includes('cyberpunk') || game.name.toLowerCase().includes('cyberpunk');
      const techBadge = isWebGPUGame
        ? '<span class="pill pill-webgpu">WebGPU + WASM</span>'
        : '<span class="pill pill-webgl">WebGL</span>';

      card.innerHTML = `
        <div class="game-info">
          <div class="game-title-row">
            <span class="game-name">${escapeHtml(game.name)}</span>
            ${techBadge}
          </div>
          <div class="game-url">${escapeHtml(game.url)}</div>
        </div>
        <div class="game-actions">
          <button class="btn btn-launch" data-url="${escapeAttr(game.url)}">Launch</button>
          <button class="btn btn-remove" data-index="${index}" title="Remove game">✕</button>
        </div>
      `;
      gameListEl.appendChild(card);
    });

    // Launch buttons
    gameListEl.querySelectorAll('.btn-launch').forEach((btn) => {
      btn.addEventListener('click', () => api.launchGame(btn.dataset.url));
    });

    // Remove buttons
    gameListEl.querySelectorAll('.btn-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api.removeGame(parseInt(btn.dataset.index, 10));
        renderGames();
      });
    });
  }

  // ------------------------------------------------------------------
  // Add game
  // ------------------------------------------------------------------
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    if (!name || !url) return;

    await api.addGame({ name, url });
    nameInput.value = '';
    urlInput.value = '';
    renderGames();
  });

  // ------------------------------------------------------------------
  // Settings
  // ------------------------------------------------------------------
  const settings = await api.getSettings();
  settingVsync.checked = settings.vsync;
  settingHighmem.checked = settings.highMemWasm !== false;
  settingFullscreen.checked = settings.fullscreenDefault;
  settingOverlay.checked = settings.overlayDefault;

  async function onSettingChange() {
    await api.saveSettings({
      vsync: settingVsync.checked,
      highMemWasm: settingHighmem.checked,
      fullscreenDefault: settingFullscreen.checked,
      overlayDefault: settingOverlay.checked,
    });
  }

  settingVsync.addEventListener('change', onSettingChange);
  settingHighmem.addEventListener('change', onSettingChange);
  settingFullscreen.addEventListener('change', onSettingChange);
  settingOverlay.addEventListener('change', onSettingChange);

  // ------------------------------------------------------------------
  // GPU info
  // ------------------------------------------------------------------
  btnGpuInfo.addEventListener('click', () => api.openGpuInfo());

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  // Initial render
  renderGames();
})();
