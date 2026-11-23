// GameShell Launcher — Cyber Gamer Runtime Script

(async function () {
  'use strict';

  const api = window.gameshell;
  if (!api) return;

  // ── DOM refs ──
  const gameListEl = document.getElementById('game-list');
  const gameCountEl = document.getElementById('game-count');
  const addForm = document.getElementById('add-game-form');
  const nameInput = document.getElementById('game-name');
  const urlInput = document.getElementById('game-url');
  const btnGpuInfo = document.getElementById('btn-gpu-info');
  const platformNote = document.getElementById('platform-note');
  const gpuBadge = document.getElementById('gpu-badge');
  const gpuBadgeText = document.getElementById('gpu-badge-text');

  // Modal refs
  const diagModal = document.getElementById('diag-modal');
  const modalClose = document.getElementById('modal-close');
  const btnOpenChromeGpu = document.getElementById('btn-open-chrome-gpu');
  const statVulkan = document.getElementById('stat-vulkan');
  const statWebgpu = document.getElementById('stat-webgpu');
  const statSession = document.getElementById('stat-session');
  const statCompositing = document.getElementById('stat-compositing');

  // Settings
  const settingVsync = document.getElementById('setting-vsync');
  const settingHighmem = document.getElementById('setting-highmem');
  const settingFullscreen = document.getElementById('setting-fullscreen');
  const settingOverlay = document.getElementById('setting-overlay');

  let cachedGpuStatus = null;
  let cachedPlatform = '';

  // ── GPU Status & Hardware Detection ──
  try {
    const [gpuStatus, plat] = await Promise.all([
      api.getGpuStatus(),
      api.getPlatform(),
    ]);
    cachedGpuStatus = gpuStatus;
    cachedPlatform = plat;

    const names = { linux: 'LINUX', darwin: 'MACOS', win32: 'WINDOWS' };
    const os = names[plat] || (plat ? plat.toUpperCase() : 'UNKNOWN');

    if (gpuStatus.vulkan && gpuStatus.webgpu) {
      gpuBadgeText.textContent = 'VULKAN + WEBGPU ACTIVE';
    } else if (gpuStatus.webgpu) {
      gpuBadgeText.textContent = 'WEBGPU ACTIVE';
    } else if (gpuStatus.vulkan) {
      gpuBadgeText.textContent = 'VULKAN ACTIVE';
    } else {
      gpuBadgeText.textContent = 'HARDWARE ACCELERATED';
    }

    const session = gpuStatus.session && gpuStatus.session !== 'unknown' 
      ? ` // ${gpuStatus.session.toUpperCase()}` 
      : '';
    platformNote.textContent = `${os}${session} // READY`;
  } catch {
    gpuBadgeText.textContent = 'HARDWARE ENGINE';
    platformNote.textContent = 'SYSTEM READY';
  }

  // ── Game Icon Resolver ──
  function getGameIcon(name, url) {
    const n = name.toLowerCase();
    const u = url.toLowerCase();
    if (n.includes('memory') || n.includes('card') || u.includes('memory')) return '🃏';
    if (n.includes('tic') || n.includes('toe') || u.includes('tictactoe')) return '⚔️';
    if (n.includes('sudoku') || u.includes('sudoku')) return '🔢';
    if (n.includes('cyberpunk') || u.includes('cyberpunk')) return '⚡';
    if (n.includes('race') || n.includes('speed') || n.includes('hex')) return '🏎️';
    return '🎮';
  }

  // ── Render game list ──
  async function renderGames() {
    const games = await api.getGames();
    gameListEl.innerHTML = '';
    gameCountEl.textContent = `${games.length} GAME${games.length === 1 ? '' : 'S'}`;

    if (games.length === 0) {
      gameListEl.innerHTML = '<div class="empty-state">// NO GAMES IN REGISTRY — DEPLOY ONE BELOW</div>';
      return;
    }

    games.forEach((game, index) => {
      const card = document.createElement('div');
      card.className = 'game-card';
      const icon = getGameIcon(game.name, game.url);

      card.innerHTML = `
        <div class="game-main">
          <div class="game-icon-box">${icon}</div>
          <div class="game-details">
            <div class="game-title-row">
              <span class="game-name">${escapeHtml(game.name)}</span>
              <span class="tag-badge">ZERO OVERHEAD</span>
            </div>
            <div class="game-url">${escapeHtml(game.url)}</div>
          </div>
        </div>
        <div class="game-actions">
          <button class="btn btn-play" data-url="${escapeAttr(game.url)}">
            <span>▶ PLAY</span>
          </button>
          <button class="btn btn-delete" data-index="${index}" title="Remove Game" aria-label="Remove ${escapeAttr(game.name)}">✕</button>
        </div>
      `;
      gameListEl.appendChild(card);
    });

    // Launch handlers
    gameListEl.querySelectorAll('.btn-play').forEach((btn) => {
      btn.addEventListener('click', () => api.launchGame(btn.dataset.url));
    });

    // Remove handlers
    gameListEl.querySelectorAll('.btn-delete').forEach((btn) => {
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

  // ── Diagnostics Cyber HUD Modal ──
  function openDiagModal() {
    if (cachedGpuStatus) {
      statVulkan.textContent = cachedGpuStatus.vulkan ? 'ENABLED (HARDWARE)' : 'SOFTWARE / DISPATCH';
      statVulkan.className = cachedGpuStatus.vulkan ? 'stat-value stat-active' : 'stat-value';

      statWebgpu.textContent = cachedGpuStatus.webgpu ? 'ACTIVE (DAWN API)' : 'SOFTWARE COMPOSITOR';
      statWebgpu.className = cachedGpuStatus.webgpu ? 'stat-value stat-active' : 'stat-value';

      statSession.textContent = (cachedGpuStatus.session || 'NATIVE').toUpperCase();
      statCompositing.textContent = (cachedGpuStatus.compositing || 'ENABLED').toUpperCase();
    }
    diagModal.classList.remove('hidden');
  }

  function closeDiagModal() {
    diagModal.classList.add('hidden');
  }

  btnGpuInfo.addEventListener('click', openDiagModal);
  modalClose.addEventListener('click', closeDiagModal);
  diagModal.addEventListener('click', (e) => {
    if (e.target === diagModal) closeDiagModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !diagModal.classList.contains('hidden')) {
      closeDiagModal();
    }
  });

  btnOpenChromeGpu.addEventListener('click', () => {
    closeDiagModal();
    api.openGpuInfo();
  });

  // ── Helpers ──
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function escapeAttr(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Init ──
  renderGames();
})();
