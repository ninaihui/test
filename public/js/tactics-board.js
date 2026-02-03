/*
  Tactics Board (MVP)
  - 11 players with draggable avatars
  - Formation presets
  - Save/Load to localStorage

  Note: This is intentionally dependency-free vanilla JS.
*/

(function () {
  const BOARD_ID = 'tacticsBoard';
  const TACTICS_STORAGE_KEY = 'team_management:tactics:v1';

  var activityId = (function () {
    var p = new URLSearchParams(window.location.search);
    return p.get('activityId') || null;
  })();

  function getStorageKey() {
    if (activityId) return TACTICS_STORAGE_KEY + ':activity:' + activityId;
    return TACTICS_STORAGE_KEY;
  }

  const boardEl = document.getElementById(BOARD_ID);
  if (!boardEl) return;

  var isReadOnly = false;
  var currentUserId = null;
  try {
    var userStr = localStorage.getItem('user');
    if (userStr) {
      var user = JSON.parse(userStr);
      if (user && user.role === 'user') isReadOnly = true;
      if (user && user.id) currentUserId = user.id;
    }
  } catch (e) {}

  const fieldEl = boardEl.querySelector('.field');
  const playersLayer = boardEl.querySelector('.players');
  var unassignedWrap = boardEl.querySelector('#unassignedWrap');
  var unassignedContainer = boardEl.querySelector('#unassignedUsers');

  const ui = {
    formation: boardEl.querySelector('#formationSelect'),
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

  function jerseySvg(label, color, textColor) {
    var tc = textColor || 'rgba(255,255,255,0.95)';
    // Simple 2D jersey icon
    var svg = '' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">' +
      '<defs>' +
      '  <linearGradient id="jg" x1="0" y1="0" x2="1" y2="1">' +
      '    <stop offset="0" stop-color="' + color + '" stop-opacity="1"/>' +
      '    <stop offset="1" stop-color="#0b1220" stop-opacity="1"/>' +
      '  </linearGradient>' +
      '</defs>' +
      '<path d="M34 22c6 10 16 14 30 14s24-4 30-14l18 12-10 18-10-6v58c0 6-4 10-10 10H46c-6 0-10-4-10-10V46l-10 6-10-18 18-12z" fill="url(#jg)" stroke="rgba(255,255,255,0.25)" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M46 40c5 6 11 9 18 9s13-3 18-9" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="3" stroke-linecap="round"/>' +
      '<text x="64" y="86" font-family="ui-sans-serif, system-ui" font-size="44" font-weight="900" text-anchor="middle" fill="' + tc + '">' + label + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function defaultAvatarSvg(number, color) {
    return jerseySvg(String(number), color, 'rgba(255,255,255,0.95)');
  }

  /** 没设置头像的用户：问号球衣 */
  function defaultAvatarQuestionSvg() {
    return jerseySvg('?', '#64748b', 'rgba(255,255,255,0.9)');
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
    players: [],
    unassignedUsers: [],
  };

  /** 当前活动人数（槽位数），默认 11；由 activity.maxParticipants 决定 */
  var currentSlotCount = 11;
  /** 当前阵型名称，如 '4-4-2'、'2-3-1' */
  var currentFormationName = '4-4-2';

  /** 按人数划分的阵型：每个槽位 { x, y, label, keywords }，label 用于保存/显示，keywords 用于匹配用户位置 */
  var formationsByCount = {
    5: {
      '2-2': [
        { x: 50, y: 88, label: '守门员', keywords: ['守门员'] },
        { x: 25, y: 65, label: '左后卫', keywords: ['左后卫'] },
        { x: 75, y: 65, label: '右后卫', keywords: ['右后卫'] },
        { x: 25, y: 35, label: '左前', keywords: ['左前', '左边锋'] },
        { x: 75, y: 35, label: '右前', keywords: ['右前', '右边锋'] },
      ],
      '3-1': [
        { x: 50, y: 88, label: '守门员', keywords: ['守门员'] },
        { x: 20, y: 70, label: '左后卫', keywords: ['左后卫'] },
        { x: 50, y: 70, label: '中后卫', keywords: ['中后卫'] },
        { x: 80, y: 70, label: '右后卫', keywords: ['右后卫'] },
        { x: 50, y: 25, label: '前锋', keywords: ['前锋', '中锋', '影锋'] },
      ],
    },
    6: {
      '2-2-1': [
        { x: 50, y: 88, label: '守门员', keywords: ['守门员'] },
        { x: 25, y: 70, label: '左后卫', keywords: ['左后卫'] },
        { x: 75, y: 70, label: '右后卫', keywords: ['右后卫'] },
        { x: 30, y: 50, label: '左前卫', keywords: ['左前卫', '左边锋'] },
        { x: 70, y: 50, label: '右前卫', keywords: ['右前卫', '右边锋'] },
        { x: 50, y: 28, label: '前锋', keywords: ['前锋', '中锋', '影锋'] },
      ],
      '3-2': [
        { x: 50, y: 88, label: '守门员', keywords: ['守门员'] },
        { x: 20, y: 72, label: '左后卫', keywords: ['左后卫'] },
        { x: 50, y: 72, label: '中后卫', keywords: ['中后卫'] },
        { x: 80, y: 72, label: '右后卫', keywords: ['右后卫'] },
        { x: 35, y: 35, label: '左前', keywords: ['左前', '左边锋'] },
        { x: 65, y: 35, label: '右前', keywords: ['右前', '右边锋'] },
      ],
    },
    7: {
      '2-3-1': [
        { x: 50, y: 88, label: '守门员', keywords: ['守门员'] },
        { x: 25, y: 72, label: '左后卫', keywords: ['左后卫'] },
        { x: 75, y: 72, label: '右后卫', keywords: ['右后卫'] },
        { x: 25, y: 54, label: '左前卫', keywords: ['左前卫', '左边锋'] },
        { x: 50, y: 54, label: '中前卫', keywords: ['中前卫', '后腰', '前腰'] },
        { x: 75, y: 54, label: '右前卫', keywords: ['右前卫', '右边锋'] },
        { x: 50, y: 28, label: '前锋', keywords: ['前锋', '中锋', '影锋'] },
      ],
      '3-2-1': [
        { x: 50, y: 88, label: '守门员', keywords: ['守门员'] },
        { x: 30, y: 74, label: '左中卫', keywords: ['左后卫', '中后卫'] },
        { x: 50, y: 74, label: '中后卫', keywords: ['中后卫'] },
        { x: 70, y: 74, label: '右中卫', keywords: ['右后卫', '中后卫'] },
        { x: 30, y: 50, label: '左前卫', keywords: ['左前卫', '左边锋'] },
        { x: 70, y: 50, label: '右前卫', keywords: ['右前卫', '右边锋'] },
        { x: 50, y: 26, label: '前锋', keywords: ['前锋', '中锋', '影锋'] },
      ],
    },
    8: {
      '2-3-2': [
        { x: 50, y: 88, label: '守门员', keywords: ['守门员'] },
        { x: 25, y: 72, label: '左后卫', keywords: ['左后卫'] },
        { x: 75, y: 72, label: '右后卫', keywords: ['右后卫'] },
        { x: 25, y: 54, label: '左前卫', keywords: ['左前卫', '左边锋'] },
        { x: 50, y: 54, label: '中前卫', keywords: ['中前卫', '后腰', '前腰'] },
        { x: 75, y: 54, label: '右前卫', keywords: ['右前卫', '右边锋'] },
        { x: 40, y: 28, label: '左前锋', keywords: ['前锋', '中锋', '影锋', '左'] },
        { x: 60, y: 28, label: '右前锋', keywords: ['前锋', '中锋', '影锋', '右'] },
      ],
      '3-2-2': [
        { x: 50, y: 88, label: '守门员', keywords: ['守门员'] },
        { x: 25, y: 74, label: '左中卫', keywords: ['左后卫', '中后卫'] },
        { x: 50, y: 74, label: '中后卫', keywords: ['中后卫'] },
        { x: 75, y: 74, label: '右中卫', keywords: ['右后卫', '中后卫'] },
        { x: 35, y: 52, label: '左前卫', keywords: ['左前卫', '左边锋'] },
        { x: 65, y: 52, label: '右前卫', keywords: ['右前卫', '右边锋'] },
        { x: 40, y: 26, label: '左前锋', keywords: ['前锋', '中锋', '左'] },
        { x: 60, y: 26, label: '右前锋', keywords: ['前锋', '中锋', '右'] },
      ],
    },
    11: {
      '4-4-2': [
        { x: 50, y: 88, label: '守门员', keywords: ['守门员'] },
        { x: 18, y: 72, label: '左后卫', keywords: ['左后卫'] },
        { x: 38, y: 74, label: '中后卫', keywords: ['中后卫'] },
        { x: 62, y: 74, label: '中后卫', keywords: ['中后卫'] },
        { x: 82, y: 72, label: '右后卫', keywords: ['右后卫'] },
        { x: 18, y: 54, label: '左前卫', keywords: ['左前卫', '左边锋'] },
        { x: 38, y: 56, label: '中前卫', keywords: ['中前卫', '后腰', '前腰'] },
        { x: 62, y: 56, label: '中前卫', keywords: ['中前卫', '后腰', '前腰'] },
        { x: 82, y: 54, label: '右前卫', keywords: ['右前卫', '右边锋'] },
        { x: 42, y: 30, label: '左影锋', keywords: ['左影锋', '影锋', '中锋', '前锋', '左'] },
        { x: 58, y: 30, label: '右影锋', keywords: ['右影锋', '影锋', '中锋', '前锋', '右'] },
      ],
      '4-3-3': [
        { x: 50, y: 88, label: '守门员', keywords: ['守门员'] },
        { x: 18, y: 72, label: '左后卫', keywords: ['左后卫'] },
        { x: 38, y: 74, label: '中后卫', keywords: ['中后卫'] },
        { x: 62, y: 74, label: '中后卫', keywords: ['中后卫'] },
        { x: 82, y: 72, label: '右后卫', keywords: ['右后卫'] },
        { x: 35, y: 56, label: '中前卫', keywords: ['中前卫', '后腰', '前腰'] },
        { x: 50, y: 54, label: '中前卫', keywords: ['中前卫', '后腰', '前腰'] },
        { x: 65, y: 56, label: '中前卫', keywords: ['中前卫', '后腰', '前腰'] },
        { x: 22, y: 30, label: '左边锋', keywords: ['左边锋', '左前卫'] },
        { x: 50, y: 26, label: '前锋', keywords: ['中锋', '前锋', '影锋'] },
        { x: 78, y: 30, label: '右边锋', keywords: ['右边锋', '右前卫'] },
      ],
      '3-5-2': [
        { x: 50, y: 88, label: '守门员', keywords: ['守门员'] },
        { x: 32, y: 74, label: '中后卫', keywords: ['中后卫'] },
        { x: 50, y: 76, label: '中后卫', keywords: ['中后卫'] },
        { x: 68, y: 74, label: '中后卫', keywords: ['中后卫'] },
        { x: 16, y: 54, label: '左前卫', keywords: ['左前卫', '左翼卫'] },
        { x: 36, y: 56, label: '中前卫', keywords: ['中前卫', '后腰', '前腰'] },
        { x: 50, y: 52, label: '中前卫', keywords: ['中前卫', '后腰', '前腰'] },
        { x: 64, y: 56, label: '中前卫', keywords: ['中前卫', '后腰', '前腰'] },
        { x: 84, y: 54, label: '右前卫', keywords: ['右前卫', '右翼卫'] },
        { x: 44, y: 30, label: '左影锋', keywords: ['左影锋', '影锋', '中锋', '前锋', '左'] },
        { x: 56, y: 30, label: '右影锋', keywords: ['右影锋', '影锋', '中锋', '前锋', '右'] },
      ],
    },
  };

  /** 将活动人数规范为支持的槽位数：5,6,7,8,11 */
  function normalizeSlotCount(n) {
    if (n == null || n < 5) return 5;
    if (n <= 6) return 6;
    if (n <= 7) return 7;
    if (n <= 8) return 8;
    return 11;
  }

  /** 获取某阵型名称在当前人数下的预设（槽位数组）；无则返回当前人数下第一个阵型 */
  function getPresetForFormation(formationName) {
    var count = normalizeSlotCount(currentSlotCount);
    var byCount = formationsByCount[count];
    if (!byCount) byCount = formationsByCount[11];
    var preset = formationName && byCount[formationName] ? byCount[formationName] : null;
    if (!preset) preset = byCount[currentFormationName] || byCount[Object.keys(byCount)[0]] || formationsByCount[11]['4-4-2'];
    return preset || [];
  }

  /** 获取当前阵型预设（槽位数组） */
  function getCurrentPreset() {
    return getPresetForFormation(currentFormationName);
  }

  /** 当前阵型的槽位标签数组（保存到后端用） */
  function getSlotPositionLabels() {
    var preset = getCurrentPreset();
    return preset.map(function (s) { return s.label; });
  }

  /** 根据当前人数渲染阵型选项（按钮组 + 隐藏的 select），并同步 currentFormationName */
  function renderFormationOptions() {
    var count = normalizeSlotCount(currentSlotCount);
    var byCount = formationsByCount[count];
    if (!byCount) byCount = formationsByCount[11];
    var names = Object.keys(byCount);
    var wrap = boardEl.querySelector('#formationWrap');
    if (!wrap) return;
    var pillsContainer = wrap.querySelector('.formation-pills');
    var selectEl = wrap.querySelector('#formationSelect');
    if (!pillsContainer || !selectEl) return;
    pillsContainer.innerHTML = '';
    selectEl.innerHTML = '';
    var first = names[0];
    var currentValid = names.indexOf(currentFormationName) >= 0 ? currentFormationName : first;
    currentFormationName = currentValid;
    names.forEach(function (name) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'formation-pill' + (name === currentValid ? ' active' : '');
      btn.setAttribute('data-formation', name);
      btn.setAttribute('aria-pressed', name === currentValid ? 'true' : 'false');
      btn.textContent = name;
      pillsContainer.appendChild(btn);
      var opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === currentValid) opt.selected = true;
      selectEl.appendChild(opt);
    });
    if (ui.formation) ui.formation.value = currentValid;
  }

  function toAbsoluteAvatarUrl(url) {
    if (!url) return '';
    if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) return url;
    var path = url.indexOf('/') === 0 ? url : '/' + url;
    return window.location.origin + path;
  }

  function createDefaultPlayers() {
    state.unassignedUsers = [];
    var n = normalizeSlotCount(currentSlotCount);
    state.players = Array.from({ length: n }, function (_, i) {
      var number = i + 1;
      var color = palette[i % palette.length];
      return {
        id: 'p' + number,
        number: number,
        name: '球员' + number,
        color: color,
        avatarUrl: null,
        xPct: 50,
        yPct: 50,
      };
    });
  }

  /** 判断槽位是否为空位（无真人） */
  function isSlotEmpty(playerOrSlot) {
    if (!playerOrSlot) return true;
    var id = playerOrSlot.id || '';
    var name = playerOrSlot.name || '';
    return (id && id.indexOf('slot') === 0) || (name && name.indexOf('空位') === 0);
  }

  /** 从本活动报名名单 + 上场位置 构建战术板球员；有 activityId 时调用。
   *  有位置的用户按位置匹配到当前人数槽位，没选位置的用户放入 unassignedUsers。 */
  function buildStateFromActivity(activity) {
    var attendances = (activity && activity.attendances) || [];
    currentSlotCount = normalizeSlotCount(activity && activity.maxParticipants != null ? activity.maxParticipants : 11);
    currentFormationName = (ui.formation && ui.formation.value) ? ui.formation.value : null;
    renderFormationOptions();
    var preset = getCurrentPreset();
    var saved = (function () {
      try {
        var raw = localStorage.getItem(getStorageKey());
        if (!raw) return null;
        var payload = JSON.parse(raw);
        return payload.players || null;
      } catch (e) { return null; }
    })();

    var list = attendances.map(function (a) {
      var u = a.user || {};
      var pos = ((a.position != null && a.position !== '') ? a.position : (u.playingPosition || '')).trim();
      return { id: u.id, username: u.username || '—', avatarUrl: u.avatarUrl, playingPosition: pos };
    });

    var withPosition = [];
    var withoutPosition = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].playingPosition) withPosition.push(list[i]);
      else withoutPosition.push(list[i]);
    }

    state.unassignedUsers = withoutPosition.slice();

    var assigned = [];
    var used = {};
    for (var slotIdx = 0; slotIdx < preset.length; slotIdx++) {
      var slotDef = preset[slotIdx] || {};
      var slotLabel = (slotDef.label || '').trim();
      var keywords = slotDef.keywords || [];
      var pos = { x: slotDef.x != null ? slotDef.x : 50, y: slotDef.y != null ? slotDef.y : 50 };
      var person = null;
      if (slotLabel) {
        for (var i = 0; i < withPosition.length; i++) {
          if (used[i]) continue;
          if (withPosition[i].playingPosition === slotLabel) {
            person = withPosition[i];
            used[i] = true;
            break;
          }
        }
      }
      if (!person) {
        for (var k = 0; k < keywords.length; k++) {
          for (var i = 0; i < withPosition.length; i++) {
            if (used[i]) continue;
            if (withPosition[i].playingPosition.indexOf(keywords[k]) !== -1) {
              person = withPosition[i];
              used[i] = true;
              break;
            }
          }
          if (person) break;
        }
      }
      var savedPos = saved && saved[slotIdx];
      var color = palette[slotIdx % palette.length];
      assigned.push({
        id: person ? person.id : 'slot' + (slotIdx + 1),
        number: slotIdx + 1,
        name: person ? person.username : '空位' + (slotIdx + 1),
        color: color,
        avatarUrl: person ? toAbsoluteAvatarUrl(person.avatarUrl) : null,
        xPct: savedPos && savedPos.xPct != null ? savedPos.xPct : pos.x,
        yPct: savedPos && savedPos.yPct != null ? savedPos.yPct : pos.y,
      });
    }
    state.players = assigned;
  }

  /** 从球队名单 API 加载成员，admin 可见已加入的普通用户 */
  function buildStateFromRoster(roster) {
    const members = roster.members || [];
    const saved = (function () {
      try {
        const raw = localStorage.getItem(getStorageKey());
        if (!raw) return null;
        const payload = JSON.parse(raw);
        return payload.players || null;
      } catch (e) { return null; }
    })();
    const formationName = ui.formation?.value || currentFormationName || '4-4-2';
    const preset = getPresetForFormation(formationName);
    state.players = [];
    for (let i = 0; i < preset.length; i++) {
      const member = members[i];
      const savedPos = saved && saved[i];
      const slotDef = preset[i] || {};
      const pos = { x: slotDef.x != null ? slotDef.x : 50, y: slotDef.y != null ? slotDef.y : 50 };
      const color = palette[i % palette.length];
      state.players.push({
        id: member ? (member.userId || member.user?.id || `p${i + 1}`) : `p${i + 1}`,
        number: member?.number ?? (i + 1),
        name: member?.user?.username ?? (member ? '成员' : `空位${i + 1}`),
        color,
        avatarUrl: member?.user?.avatarUrl || null,
        xPct: savedPos?.xPct ?? pos.x,
        yPct: savedPos?.yPct ?? pos.y,
      });
    }
  }

  function applyFormation(name) {
    currentFormationName = name || currentFormationName;
    const preset = getPresetForFormation(name);
    if (!preset || !preset.length) return;
    preset.forEach((pos, idx) => {
      if (state.players[idx]) {
        state.players[idx].xPct = pos.x;
        state.players[idx].yPct = pos.y;
      }
    });
    renderPlayers();
  }

  /** 将当前阵型与球员写入 localStorage；admin 拖拽结束后调用 */
  function save() {
    try {
      var formation = (ui.formation && ui.formation.value) ? ui.formation.value : currentFormationName || '4-4-2';
      var payload = { formation: formation, slotCount: currentSlotCount, players: state.players };
      localStorage.setItem(getStorageKey(), JSON.stringify(payload));
    } catch (e) {}
  }

  var savingPositionsInProgress = false;
  /** 按当前战术板槽位保存本活动的出场位置到后端（仅 admin、有 activityId 时可用）；排他：保存中不重复提交 */
  function savePositionsToServer() {
    if (!activityId || isReadOnly) return;
    if (savingPositionsInProgress) return;
    savingPositionsInProgress = true;
    var labels = getSlotPositionLabels();
    var positions = [];
    for (var i = 0; i < state.players.length; i++) {
      var p = state.players[i];
      if (!p || isSlotEmpty(p)) continue;
      var label = labels[i];
      if (label) positions.push({ userId: p.id, position: label });
    }
    var btn = boardEl.querySelector('#btnSavePositions');
    if (btn) btn.disabled = true;
    flashStatus('保存中…', 0);
    var token = getAuthToken();
    fetch('/activities/' + activityId + '/positions', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? 'Bearer ' + token : '',
      },
      body: JSON.stringify({ positions: positions }),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (err) { throw new Error(err.message || '保存失败'); });
        return r.json();
      })
      .then(function () {
        flashStatus('出场位置已保存', 2000);
      })
      .catch(function (err) {
        flashStatus(err.message || '保存失败', 2500);
      })
      .finally(function () {
        savingPositionsInProgress = false;
        if (btn) btn.disabled = false;
      });
  }

  var savingMyPositionInProgress = false;
  /** 普通用户保存本场自己的出场位置到后端；排他：保存中不重复提交 */
  function saveMyPositionToServer() {
    if (!activityId || !currentUserId) return;
    if (savingMyPositionInProgress) return;
    savingMyPositionInProgress = true;
    var slotIdx = -1;
    for (var i = 0; i < state.players.length; i++) {
      if (state.players[i] && state.players[i].id === currentUserId) { slotIdx = i; break; }
    }
    var btn = boardEl.querySelector('#btnSavePositions');
    if (btn) btn.disabled = true;
    flashStatus('保存中…', 0);
    var labels = getSlotPositionLabels();
    var label = slotIdx >= 0 ? (labels[slotIdx] || '') : '';
    var token = getAuthToken();
    fetch('/activities/' + activityId + '/my-position', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? 'Bearer ' + token : '',
      },
      body: JSON.stringify({ position: label }),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (err) { throw new Error(err.message || '保存失败'); });
        return r.json();
      })
      .then(function () {
        flashStatus('出场位置已保存', 2000);
      })
      .catch(function (err) {
        flashStatus(err.message || '保存失败', 2500);
      })
      .finally(function () {
        savingMyPositionInProgress = false;
        if (btn) btn.disabled = false;
      });
  }

  /** 根据场上坐标 (xPct, yPct) 得到最近的阵型槽位索引，若不在任何槽位附近则返回 -1 */
  function getSlotIndexAt(xPct, yPct) {
    var preset = getCurrentPreset();
    if (!preset || !preset.length) return -1;
    var best = -1;
    var bestDist = 999;
    for (var i = 0; i < preset.length; i++) {
      var dx = xPct - (preset[i].x != null ? preset[i].x : 50);
      var dy = yPct - (preset[i].y != null ? preset[i].y : 50);
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return bestDist <= 14 ? best : -1;
  }

  function renderPlayers() {
    playersLayer.innerHTML = '';
    for (var i = 0; i < state.players.length; i++) {
      var p = state.players[i];
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'player';
      el.dataset.playerId = p.id;
      el.setAttribute('aria-label', p.name + '（' + p.number + '号）');

      var avatar = document.createElement('img');
      avatar.alt = '';
      avatar.className = 'player-avatar';
      var defaultSrc = isSlotEmpty(p) ? defaultAvatarSvg(p.number, p.color) : defaultAvatarQuestionSvg();
      avatar.src = p.avatarUrl || defaultSrc;
      avatar.onerror = function () { this.src = defaultSrc; };

      var label = document.createElement('div');
      label.className = 'player-label';
      label.textContent = p.name;

      el.appendChild(avatar);
      el.appendChild(label);

      el.style.left = p.xPct + '%';
      el.style.top = p.yPct + '%';

      if (!isSlotEmpty(p) && (!isReadOnly || p.id === currentUserId)) attachDrag(el);
      playersLayer.appendChild(el);
    }
  }

  /** 渲染战术板下方的「未选位置」用户；仅 activityId 且有未选位置用户时显示 */
  function renderUnassigned() {
    if (!unassignedWrap || !unassignedContainer) return;
    if (!activityId || !state.unassignedUsers || state.unassignedUsers.length === 0) {
      unassignedWrap.classList.add('hidden');
      return;
    }
    unassignedWrap.classList.remove('hidden');
    unassignedContainer.innerHTML = '';
    for (var i = 0; i < state.unassignedUsers.length; i++) {
      var u = state.unassignedUsers[i];
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'unassigned-user';
      el.dataset.userId = u.id;
      el.setAttribute('aria-label', '未选位置：' + (u.username || '—'));

      var avatar = document.createElement('img');
      avatar.alt = '';
      avatar.className = 'player-avatar';
      var defaultSrc = defaultAvatarQuestionSvg();
      avatar.src = toAbsoluteAvatarUrl(u.avatarUrl) || defaultSrc;
      avatar.onerror = function () { this.src = defaultSrc; };

      var label = document.createElement('div');
      label.className = 'player-label';
      label.textContent = u.username || '—';

      el.appendChild(avatar);
      el.appendChild(label);
      unassignedContainer.appendChild(el);

      if (!isReadOnly || u.id === currentUserId) attachUnassignedDrag(el, u);
    }
  }

  /** 未选位置用户拖拽：admin 可拖任意已报名用户，普通用户仅可拖自己；拖到场上空位后填入该槽位并保存 */
  function attachUnassignedDrag(el, user) {
    var dragging = false;
    var pointerId = null;

    function onDown(e) {
      dragging = true;
      pointerId = e.pointerId;
      el.setPointerCapture(pointerId);
      el.classList.add('dragging');
      e.preventDefault();
    }

    function onUp(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      el.classList.remove('dragging');
      pointerId = null;

      var field = getFieldRect();
      var xPx = e.clientX - field.left;
      var yPx = e.clientY - field.top;
      var inField = xPx >= 0 && xPx <= field.width && yPx >= 0 && yPx <= field.height;
      var xy = pxToPct(xPx, yPx);
      var slotIdx = inField ? getSlotIndexAt(xy.x, xy.y) : -1;

      if (slotIdx >= 0) {
        var preset = getCurrentPreset();
        var slotDef = preset[slotIdx] || {};
        var targetSlot = state.players[slotIdx];
        if (isSlotEmpty(targetSlot)) {
          state.players[slotIdx] = {
            id: user.id,
            number: slotIdx + 1,
            name: user.username || '—',
            color: palette[slotIdx % palette.length],
            avatarUrl: toAbsoluteAvatarUrl(user.avatarUrl) || null,
            xPct: slotDef.x != null ? slotDef.x : 50,
            yPct: slotDef.y != null ? slotDef.y : 50,
          };
          state.unassignedUsers = state.unassignedUsers.filter(function (u) { return u.id !== user.id; });
          save();
          renderPlayers();
          renderUnassigned();
          flashStatus('已移至 ' + (getSlotPositionLabels()[slotIdx] || ''), 1200);
        } else if (!isReadOnly) {
          var occupant = targetSlot;
          state.players[slotIdx] = {
            id: user.id,
            number: slotIdx + 1,
            name: user.username || '—',
            color: palette[slotIdx % palette.length],
            avatarUrl: toAbsoluteAvatarUrl(user.avatarUrl) || null,
            xPct: slotDef.x != null ? slotDef.x : 50,
            yPct: slotDef.y != null ? slotDef.y : 50,
          };
          state.unassignedUsers = state.unassignedUsers.filter(function (u) { return u.id !== user.id; });
          state.unassignedUsers.push({ id: occupant.id, username: occupant.name || '—', avatarUrl: occupant.avatarUrl, playingPosition: '' });
          save();
          renderPlayers();
          renderUnassigned();
          flashStatus('已与 ' + (occupant.name || '') + ' 互换', 1200);
        } else if (inField) {
          flashStatus('请拖到空位', 1200);
        }
      } else if (inField) {
        flashStatus('请拖到空位', 1200);
      }
    }

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function attachDrag(el) {
    var dragging = false;
    var pointerId = null;
    var offsetX = 0;
    var offsetY = 0;
    var startXPct = 0;
    var startYPct = 0;

    function onDown(e) {
      dragging = true;
      pointerId = e.pointerId;
      el.setPointerCapture(pointerId);
      el.classList.add('dragging');

      var elRect = el.getBoundingClientRect();
      offsetX = e.clientX - elRect.left;
      offsetY = e.clientY - elRect.top;

      var id = el.dataset.playerId;
      var p = state.players.find(function (pp) { return pp.id === id; });
      if (p) { startXPct = p.xPct; startYPct = p.yPct; }

      el.style.zIndex = '10';
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      var field = getFieldRect();
      var xPx = clamp(e.clientX - field.left - offsetX + el.offsetWidth / 2, 0, field.width);
      var yPx = clamp(e.clientY - field.top - offsetY + el.offsetHeight / 2, 0, field.height);
      var xy = pxToPct(xPx, yPx);

      el.style.left = xy.x + '%';
      el.style.top = xy.y + '%';

      var id = el.dataset.playerId;
      var p = state.players.find(function (pp) { return pp.id === id; });
      if (p) { p.xPct = xy.x; p.yPct = xy.y; }
    }

    function onUp(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      var id = el.dataset.playerId;
      var p = state.players.find(function (pp) { return pp.id === id; });
      dragging = false;
      el.classList.remove('dragging');
      el.style.zIndex = '';
      pointerId = null;

      if (p && isSlotEmpty(p)) {
        p.xPct = startXPct;
        p.yPct = startYPct;
        el.style.left = startXPct + '%';
        el.style.top = startYPct + '%';
        flashStatus('空位不可拖拽', 1200);
        return;
      }

      var slotIdx = p ? getSlotIndexAt(p.xPct, p.yPct) : -1;
      var preset = getCurrentPreset();
      var currentIdx = p ? state.players.findIndex(function (pp) { return pp.id === id; }) : -1;

      if (slotIdx >= 0 && preset[slotIdx] && p && currentIdx >= 0) {
        var targetSlot = state.players[slotIdx];
        if (isSlotEmpty(targetSlot)) {
          var slotDefCur = preset[currentIdx] || {};
          var posCur = { x: slotDefCur.x != null ? slotDefCur.x : 50, y: slotDefCur.y != null ? slotDefCur.y : 50 };
          state.players[currentIdx] = {
            id: 'slot' + (currentIdx + 1),
            number: currentIdx + 1,
            name: '空位' + (currentIdx + 1),
            color: palette[currentIdx % palette.length],
            avatarUrl: null,
            xPct: posCur.x,
            yPct: posCur.y,
          };
          var slotDef = preset[slotIdx] || {};
          state.players[slotIdx] = {
            id: p.id,
            number: slotIdx + 1,
            name: p.name,
            color: p.color,
            avatarUrl: p.avatarUrl,
            xPct: slotDef.x != null ? slotDef.x : 50,
            yPct: slotDef.y != null ? slotDef.y : 50,
          };
          save();
          renderPlayers();
          if (unassignedContainer) renderUnassigned();
          flashStatus('已移至 ' + (getSlotPositionLabels()[slotIdx] || ''), 1200);
        } else if (!isReadOnly && currentIdx !== slotIdx) {
          var occupant = targetSlot;
          var slotDefCur = preset[currentIdx] || {};
          var slotDef = preset[slotIdx] || {};
          var posCur = { x: slotDefCur.x != null ? slotDefCur.x : 50, y: slotDefCur.y != null ? slotDefCur.y : 50 };
          var posTarget = { x: slotDef.x != null ? slotDef.x : 50, y: slotDef.y != null ? slotDef.y : 50 };
          state.players[currentIdx] = {
            id: occupant.id,
            number: currentIdx + 1,
            name: occupant.name,
            color: occupant.color,
            avatarUrl: occupant.avatarUrl,
            xPct: posCur.x,
            yPct: posCur.y,
          };
          state.players[slotIdx] = {
            id: p.id,
            number: slotIdx + 1,
            name: p.name,
            color: p.color,
            avatarUrl: p.avatarUrl,
            xPct: posTarget.x,
            yPct: posTarget.y,
          };
          save();
          renderPlayers();
          if (unassignedContainer) renderUnassigned();
          flashStatus('已与 ' + (occupant.name || '') + ' 互换位置', 1200);
        } else {
          if (p) {
            p.xPct = startXPct;
            p.yPct = startYPct;
            el.style.left = startXPct + '%';
            el.style.top = startYPct + '%';
          }
          flashStatus(isReadOnly ? '仅可拖到空位' : '请拖到空位', 1200);
        }
      } else {
        if (p) {
          p.xPct = startXPct;
          p.yPct = startYPct;
          el.style.left = startXPct + '%';
          el.style.top = startYPct + '%';
        }
        flashStatus('请拖到空位', 1200);
      }
    }

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
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
      if (payload.slotCount != null) currentSlotCount = normalizeSlotCount(payload.slotCount);
      var byCount = formationsByCount[normalizeSlotCount(currentSlotCount)];
      if (!byCount) byCount = formationsByCount[11];
      var formationValid = payload.formation && byCount[payload.formation];
      if (formationValid) {
        currentFormationName = payload.formation;
        renderFormationOptions();
      }
      state.players = payload.players;
      renderPlayers();
      if (ui.formation && payload.formation && formationValid) {
        ui.formation.value = payload.formation;
        syncFormationPills(payload.formation);
      }
      flashStatus('已从浏览器加载', 1800);
    } catch {
      flashStatus('加载失败：保存数据损坏', 2200);
    }
  }

  const statusEl = boardEl.querySelector('#saveStatus');
  function flashStatus(text, ms) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.add('show');
    clearTimeout(flashStatus._t);
    flashStatus._t = setTimeout(() => {
      statusEl.classList.remove('show');
    }, ms || 1500);
  }

  function syncFormationPills(value) {
    const pills = boardEl.querySelectorAll('.formation-pill');
    pills.forEach((btn) => {
      const active = (btn.getAttribute('data-formation') === value);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function wireUi() {
    var readOnlyHint = document.getElementById('tacticsReadOnlyHint');
    if (readOnlyHint) {
      if (isReadOnly) {
        readOnlyHint.textContent = '仅可拖动自己至空位，保存后更新本场出场位置';
        readOnlyHint.classList.remove('hidden');
      } else {
        readOnlyHint.classList.add('hidden');
      }
    }
    var savePositionsBtn = boardEl.querySelector('#btnSavePositions');
    if (savePositionsBtn) savePositionsBtn.addEventListener('click', isReadOnly ? saveMyPositionToServer : savePositionsToServer);
    if (ui.formation) {
      ui.formation.addEventListener('change', function () {
        currentFormationName = ui.formation.value;
        applyFormation(ui.formation.value);
        syncFormationPills(ui.formation.value);
        save();
        flashStatus('已保存', 1200);
      });
      boardEl.querySelectorAll('.formation-pill').forEach((btn) => {
        btn.addEventListener('click', () => {
          const v = btn.getAttribute('data-formation');
          if (v && ui.formation) {
            ui.formation.value = v;
            currentFormationName = v;
            ui.formation.dispatchEvent(new Event('change'));
          }
        });
      });
    }
    // click to select player
    playersLayer.addEventListener('click', (e) => {
      const btn = e.target.closest('.player');
      if (!btn) return;
      for (const el of playersLayer.querySelectorAll('.player')) el.classList.remove('selected');
      btn.classList.add('selected');
    });
  }

  function getAuthToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
  }

  function init() {
    function finishInit(usedActivityData) {
      if (!usedActivityData) {
        currentSlotCount = 11;
        renderFormationOptions();
        var raw = localStorage.getItem(getStorageKey());
        if (raw) load();
        else {
          if (ui.formation) ui.formation.value = currentFormationName || '4-4-2';
          applyFormation(ui.formation ? ui.formation.value : '4-4-2');
        }
      }
      wireUi();
      renderPlayers();
      renderUnassigned();
      syncFormationPills(ui.formation?.value || currentFormationName || '4-4-2');
      if (usedActivityData) {
        var savePosBtn = boardEl.querySelector('#btnSavePositions');
        if (savePosBtn) savePosBtn.classList.remove('hidden');
      }
    }

    if (activityId) {
      var token = getAuthToken();
      fetch('/activities/' + activityId, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (activity) {
          if (activity && activity.attendances && activity.attendances.length >= 0) {
            buildStateFromActivity(activity);
            finishInit(true);
          } else {
            createDefaultPlayers();
            finishInit(false);
          }
        })
        .catch(function () {
          createDefaultPlayers();
          finishInit(false);
        });
      return;
    }

    createDefaultPlayers();
    finishInit(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
