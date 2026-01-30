/*
  Tactics Board (MVP)
  - 11 players with draggable avatars
  - Formation presets
  - Save/Load to localStorage

  Note: This is intentionally dependency-free vanilla JS.
*/

(function () {
  const BOARD_ID = 'tacticsBoard';
  const CURRENT_TEAM_KEY = 'team_management:currentTeamId';

  function getStorageKey() {
    const teamId = localStorage.getItem(CURRENT_TEAM_KEY) || 'default';
    // keep per-team local saves isolated
    return `team_management:tactics:v1:${teamId}`;
  }

  const boardEl = document.getElementById(BOARD_ID);
  if (!boardEl) return;

  const fieldEl = boardEl.querySelector('.field');
  const playersLayer = boardEl.querySelector('.players');

  const ui = {
    formation: document.getElementById('formationSelect'),
    reset: document.getElementById('btnReset'),
    save: document.getElementById('btnSave'),
    load: document.getElementById('btnLoad'),
    edit: document.getElementById('btnEditPlayer'),
    status: document.getElementById('saveStatus'),
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function getFieldRect() {
    return fieldEl.getBoundingClientRect();
  }

  function pctToPx(xPct, yPct) {
    const r = getFieldRect();
    return { x: (xPct / 100) * r.width, y: (yPct / 100) * r.height };
  }

  function pxToPct(xPx, yPx) {
    const r = getFieldRect();
    return {
      x: (xPx / r.width) * 100,
      y: (yPx / r.height) * 100,
    };
  }

  function defaultAvatarSvg(number, color) {
    // simple circular avatar svg (data uri)
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${color}" stop-opacity="1"/>
            <stop offset="1" stop-color="#0b1220" stop-opacity="1"/>
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r="62" fill="url(#g)"/>
        <circle cx="64" cy="64" r="60" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="3"/>
        <text x="64" y="78" font-family="ui-sans-serif, system-ui" font-size="54" font-weight="800" text-anchor="middle" fill="rgba(255,255,255,0.95)">${number}</text>
      </svg>
    `.trim();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  const palette = [
    '#22c55e', // green
    '#3b82f6', // blue
    '#a855f7', // purple
    '#f97316', // orange
    '#ec4899', // pink
    '#eab308', // yellow
    '#14b8a6', // teal
    '#ef4444', // red
  ];

  const state = {
    players: [], // { id, number, name, color, xPct, yPct }
  };

  // Formation presets. Coordinates are percentages relative to field.
  // y increases from top (opponent goal) to bottom (our goal). We'll place GK near bottom.
  const formations = {
    '4-4-2': [
      { role: 'GK', x: 50, y: 88 },
      { role: 'LB', x: 18, y: 72 },
      { role: 'LCB', x: 38, y: 74 },
      { role: 'RCB', x: 62, y: 74 },
      { role: 'RB', x: 82, y: 72 },
      { role: 'LM', x: 18, y: 54 },
      { role: 'LCM', x: 38, y: 56 },
      { role: 'RCM', x: 62, y: 56 },
      { role: 'RM', x: 82, y: 54 },
      { role: 'ST1', x: 42, y: 30 },
      { role: 'ST2', x: 58, y: 30 },
    ],
    '4-3-3': [
      { role: 'GK', x: 50, y: 88 },
      { role: 'LB', x: 18, y: 72 },
      { role: 'LCB', x: 38, y: 74 },
      { role: 'RCB', x: 62, y: 74 },
      { role: 'RB', x: 82, y: 72 },
      { role: 'LCM', x: 35, y: 56 },
      { role: 'CM', x: 50, y: 54 },
      { role: 'RCM', x: 65, y: 56 },
      { role: 'LW', x: 22, y: 30 },
      { role: 'ST', x: 50, y: 26 },
      { role: 'RW', x: 78, y: 30 },
    ],
    '3-5-2': [
      { role: 'GK', x: 50, y: 88 },
      { role: 'LCB', x: 32, y: 74 },
      { role: 'CB', x: 50, y: 76 },
      { role: 'RCB', x: 68, y: 74 },
      { role: 'LWB', x: 16, y: 54 },
      { role: 'LCM', x: 36, y: 56 },
      { role: 'CM', x: 50, y: 52 },
      { role: 'RCM', x: 64, y: 56 },
      { role: 'RWB', x: 84, y: 54 },
      { role: 'ST1', x: 44, y: 30 },
      { role: 'ST2', x: 56, y: 30 },
    ],
  };

  function createDefaultPlayers() {
    state.players = Array.from({ length: 11 }, (_, i) => {
      const number = i + 1;
      const color = palette[i % palette.length];
      return {
        id: `p${number}`,
        number,
        name: `球员${number}`,
        color,
        xPct: 50,
        yPct: 50,
      };
    });
  }

  function applyFormation(name) {
    const preset = formations[name];
    if (!preset) return;
    // Keep player identity (number/name/color) but move positions.
    preset.forEach((pos, idx) => {
      if (state.players[idx]) {
        state.players[idx].xPct = pos.x;
        state.players[idx].yPct = pos.y;
      }
    });
    renderPlayers();
  }

  function renderPlayers() {
    playersLayer.innerHTML = '';
    for (const p of state.players) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'player';
      el.dataset.playerId = p.id;
      el.setAttribute('aria-label', `${p.name}（${p.number}号）`);

      const avatar = document.createElement('img');
      avatar.alt = '';
      avatar.className = 'player-avatar';
      avatar.src = defaultAvatarSvg(p.number, p.color);

      const label = document.createElement('div');
      label.className = 'player-label';
      label.textContent = p.name;

      el.appendChild(avatar);
      el.appendChild(label);

      // Position
      el.style.left = `${p.xPct}%`;
      el.style.top = `${p.yPct}%`;

      // Drag
      attachDrag(el);

      playersLayer.appendChild(el);
    }
  }

  function attachDrag(el) {
    let dragging = false;
    let pointerId = null;
    let offsetX = 0;
    let offsetY = 0;

    function onDown(e) {
      // left click / touch
      dragging = true;
      pointerId = e.pointerId;
      el.setPointerCapture(pointerId);
      el.classList.add('dragging');

      const field = getFieldRect();
      const elRect = el.getBoundingClientRect();
      offsetX = e.clientX - elRect.left;
      offsetY = e.clientY - elRect.top;

      // bring to front
      el.style.zIndex = '10';

      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      const field = getFieldRect();

      const xPx = clamp(e.clientX - field.left - offsetX + el.offsetWidth / 2, 0, field.width);
      const yPx = clamp(e.clientY - field.top - offsetY + el.offsetHeight / 2, 0, field.height);
      const { x, y } = pxToPct(xPx, yPx);

      el.style.left = `${x}%`;
      el.style.top = `${y}%`;

      // update state (throttle not needed for 11 items)
      const id = el.dataset.playerId;
      const p = state.players.find((pp) => pp.id === id);
      if (p) {
        p.xPct = x;
        p.yPct = y;
      }
    }

    function onUp(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      el.classList.remove('dragging');
      el.style.zIndex = '';
      pointerId = null;

      // small UX hint
      flashStatus('已移动（可点击保存）', 1200);
    }

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function save() {
    const payload = {
      v: 1,
      savedAt: Date.now(),
      teamId: localStorage.getItem(CURRENT_TEAM_KEY) || 'default',
      formation: ui.formation?.value || 'custom',
      players: state.players,
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(payload));
    flashStatus('已保存到浏览器', 1800);
  }

  function load() {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) {
      flashStatus('没有找到已保存的阵型', 2000);
      return;
    }
    try {
      const payload = JSON.parse(raw);
      if (!payload || !payload.players) throw new Error('bad payload');
      state.players = payload.players;
      renderPlayers();
      if (ui.formation && payload.formation && formations[payload.formation]) {
        ui.formation.value = payload.formation;
      }
      flashStatus('已从浏览器加载', 1800);
    } catch {
      flashStatus('加载失败：保存数据损坏', 2200);
    }
  }

  function reset() {
    createDefaultPlayers();
    applyFormation(ui.formation?.value || '4-4-2');
    flashStatus('已重置', 1200);
  }

  function editSelectedPlayer() {
    const selected = boardEl.querySelector('.player.selected');
    if (!selected) {
      flashStatus('先点选一个球员', 1600);
      return;
    }
    const id = selected.dataset.playerId;
    const p = state.players.find((pp) => pp.id === id);
    if (!p) return;

    const newName = prompt('球员名字（用于显示）', p.name);
    if (newName === null) return;
    p.name = (newName || '').trim() || p.name;

    const newColor = prompt('球员颜色（HEX，如 #22c55e）', p.color);
    if (newColor !== null && newColor.trim()) {
      p.color = newColor.trim();
    }

    renderPlayers();
    // keep selection
    const after = boardEl.querySelector(`[data-player-id="${id}"]`);
    if (after) after.classList.add('selected');
    flashStatus('已更新球员信息', 1500);
  }

  function flashStatus(text, ms) {
    if (!ui.status) return;
    ui.status.textContent = text;
    ui.status.classList.add('show');
    clearTimeout(flashStatus._t);
    flashStatus._t = setTimeout(() => {
      ui.status.classList.remove('show');
    }, ms || 1500);
  }

  function wireUi() {
    if (ui.formation) {
      ui.formation.addEventListener('change', () => applyFormation(ui.formation.value));
    }
    ui.reset?.addEventListener('click', reset);
    ui.save?.addEventListener('click', save);
    ui.load?.addEventListener('click', load);
    ui.edit?.addEventListener('click', editSelectedPlayer);

    // click to select player
    playersLayer.addEventListener('click', (e) => {
      const btn = e.target.closest('.player');
      if (!btn) return;
      for (const el of playersLayer.querySelectorAll('.player')) el.classList.remove('selected');
      btn.classList.add('selected');
    });
  }

  function init() {
    createDefaultPlayers();
    wireUi();

    // load saved if exists, else apply default formation
    const raw = localStorage.getItem(getStorageKey());
    if (raw) {
      load();
    } else {
      if (ui.formation) ui.formation.value = '4-4-2';
      applyFormation('4-4-2');
    }
  }

  init();
})();
