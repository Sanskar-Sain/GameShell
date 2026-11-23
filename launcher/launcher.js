// GameShell Launcher — renderer script (production)

(async function () {
  'use strict';

  const api = window.gameshell;
  if (!api) return;

  // ── DOM refs ──
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

  // ── GPU Status ──
  try {
    const [gpuStatus, plat] = await Promise.all([
      api.getGpuStatus(),
      api.getPlatform(),
    ]);
    const names = { linux: 'Linux', darwin: 'macOS', win32: 'Windows' };
    const os = names[plat] || plat;

    if (gpuStatus.vulkan || gpuStatus.webgpu) {
      gpuBadge.textContent = 'GPU Active';
      gpuBadge.className = 'badge badge-success';
    } else {
      gpuBadge.textContent = 'Software';
      gpuBadge.className = 'badge badge-info';
    }

    const session = gpuStatus.session !== 'unknown' ? ` · ${gpuStatus.session}` : '';
    platformNote.textContent = `${os}${session}`;
  } catch {
    gpuBadge.textContent = 'GPU';
    gpuBadge.className = 'badge badge-info';
    platformNote.textContent = '';
  }

  // ── Render game list ──
  async function renderGames() {
    const games = await api.getGames();
    gameListEl.innerHTML = '';

    if (games.length === 0) {
      gameListEl.innerHTML = '<div class="empty-state">No games yet — add one below</div>';
      return;
    }

    games.forEach((game, index) => {
      const card = document.createElement('div');
      card.className = 'game-card';
      card.innerHTML = `
        <div class="game-info">
          <span class="game-name">${escapeHtml(game.name)}</span>
          <span class="game-url">${escapeHtml(game.url)}</span>
        </div>
        <div class="game-actions">
          <button class="btn btn-launch" data-url="${escapeAttr(game.url)}">Play</button>
          <button class="btn btn-remove" data-index="${index}" title="Remove" aria-label="Remove ${escapeAttr(game.name)}">✕</button>
        </div>
      `;
      gameListEl.appendChild(card);
    });

    // Event delegation
    gameListEl.querySelectorAll('.btn-launch').forEach((btn) => {
      btn.addEventListener('click', () => api.launchGame(btn.dataset.url));
    });

    gameListEl.querySelectorAll('.btn-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api.removeGame(parseInt(btn.dataset.index, 10));
        renderGames();
      });
    });
  }

  // ── Add game ──
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    if (!name || !url) return;

    // Basic URL validation
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
    } catch {
      return;
    }

    await api.addGame({ name: name.slice(0, 100), url: url.slice(0, 2048) });
    nameInput.value = '';
    urlInput.value = '';
    renderGames();
  });

  // ── Settings ──
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

  // ── GPU info ──
  btnGpuInfo.addEventListener('click', () => api.openGpuInfo());

  // ── Helpers ──
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Init ──
  renderGames();
})();
