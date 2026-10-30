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

  const settingVsync = document.getElementById('setting-vsync');
  const settingFullscreen = document.getElementById('setting-fullscreen');
  const settingOverlay = document.getElementById('setting-overlay');

  // ------------------------------------------------------------------
  // Render game list
  // ------------------------------------------------------------------
  async function renderGames() {
    const games = await api.getGames();
    gameListEl.innerHTML = '';

    if (games.length === 0) {
      gameListEl.innerHTML = '<div class="empty-state">No games yet. Add one below!</div>';
      return;
    }

    games.forEach((game, index) => {
      const card = document.createElement('div');
      card.className = 'game-card';
      card.innerHTML = `
        <div class="game-info">
          <div class="game-name">${escapeHtml(game.name)}</div>
          <div class="game-url">${escapeHtml(game.url)}</div>
        </div>
        <div class="game-actions">
          <button class="btn btn-launch" data-url="${escapeAttr(game.url)}">Launch</button>
          <button class="btn btn-remove" data-index="${index}">✕</button>
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
  settingFullscreen.checked = settings.fullscreenDefault;
  settingOverlay.checked = settings.overlayDefault;

  async function onSettingChange() {
    await api.saveSettings({
      vsync: settingVsync.checked,
      fullscreenDefault: settingFullscreen.checked,
      overlayDefault: settingOverlay.checked,
    });
  }

  settingVsync.addEventListener('change', onSettingChange);
  settingFullscreen.addEventListener('change', onSettingChange);
  settingOverlay.addEventListener('change', onSettingChange);

  // ------------------------------------------------------------------
  // GPU info
  // ------------------------------------------------------------------
  btnGpuInfo.addEventListener('click', () => api.openGpuInfo());

  // ------------------------------------------------------------------
  // Platform note
  // ------------------------------------------------------------------
  const plat = await api.getPlatform();
  const platNames = { linux: 'Linux', darwin: 'macOS', win32: 'Windows' };
  platformNote.textContent = `Running on ${platNames[plat] || plat}`;

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
