/*
  Tactics Board (Formation slots on pitch)
  - Per team: formation pitch with fixed slot coordinates (like footballgo.club)
  - Supports formations: 4-4-2 / 4-3-3 / 3-5-2 (others fall back to 4-4-2)
  - Drag/drop players into slots
  - Persist to DB: Attendance.teamNo + Attendance.slotNo
  - Persist formations (per team): Activity.teamFormations[]

  Rules:
  - Slots on pitch are fixed 11. Extra players stay in subs/bench area.
  - Read-only for non-admin users (canEdit=false)
*/

(function () {
  const TOKEN_KEY = 'authToken';
  const CURRENT_TEAM_KEY = 'team_management:currentTeamId';

  const boardEl = document.getElementById('tacticsBoard');
  if (!boardEl) return;

  const fieldEl = boardEl.querySelector('.field');
  const bandsLayer = boardEl.querySelector('.players');
  const benchEl = document.getElementById('benchPlayers');

  const ui = {
    activitySelect: document.getElementById('activitySelect'),
    save: document.getElementById('btnSave'),
    status: document.getElementById('saveStatus'),
    editHint: document.getElementById('editHint'),
  };

  function flashStatus(text, ms) {
    if (!ui.status) return;
    ui.status.textContent = text;
    ui.status.classList.add('show');
    clearTimeout(flashStatus._t);
    flashStatus._t = setTimeout(() => ui.status.classList.remove('show'), ms || 1500);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  async function apiFetch(path, opts) {
    const token = getToken();
    const res = await fetch(path, {
      ...(opts || {}),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...((opts && opts.headers) || {}),
      },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(txt || `HTTP ${res.status}`);
    }
    return res.json();
  }

  function qs() {
    return new URLSearchParams(window.location.search);
  }

  function getActivityId() {
    return qs().get('activityId') || '';
  }

  function setActivityId(id) {
    const u = new URL(window.location.href);
    u.searchParams.set('activityId', id);
    window.location.href = u.toString();
  }

  function defaultAvatarUrl() {
    return '/assets/default-avatar.svg';
  }

  const FORMATIONS = ['4-4-2', '4-3-3', '3-5-2'];

  function normalizeFormation(f) {
    const s = (f || '').trim();
    if (FORMATIONS.includes(s)) return s;
    return '4-4-2';
  }

  function slotPositions(formation) {
    // slotNo: 1..11
    // coordinates are percentage positions relative to the pitch container
    // y: 0(top)->100(bottom) (we defend at bottom)
    const f = normalizeFormation(formation);

    // shared GK
    const gk = [{ slotNo: 1, x: 50, y: 86 }];

    if (f === '4-4-2') {
      return gk.concat([
        // DEF 2-5
        { slotNo: 2, x: 20, y: 70 },
        { slotNo: 3, x: 40, y: 72 },
        { slotNo: 4, x: 60, y: 72 },
        { slotNo: 5, x: 80, y: 70 },
        // MID 6-9
        { slotNo: 6, x: 15, y: 50 },
        { slotNo: 7, x: 38, y: 52 },
        { slotNo: 8, x: 62, y: 52 },
        { slotNo: 9, x: 85, y: 50 },
        // ATT 10-11
        { slotNo: 10, x: 42, y: 28 },
        { slotNo: 11, x: 58, y: 28 },
      ]);
    }

    if (f === '4-3-3') {
      return gk.concat([
        // DEF 2-5
        { slotNo: 2, x: 20, y: 70 },
        { slotNo: 3, x: 40, y: 72 },
        { slotNo: 4, x: 60, y: 72 },
        { slotNo: 5, x: 80, y: 70 },
        // MID 6-8
        { slotNo: 6, x: 28, y: 52 },
        { slotNo: 7, x: 50, y: 50 },
        { slotNo: 8, x: 72, y: 52 },
        // ATT 9-11
        { slotNo: 9, x: 25, y: 28 },
        { slotNo: 10, x: 50, y: 24 },
        { slotNo: 11, x: 75, y: 28 },
      ]);
    }

    // 3-5-2
    return gk.concat([
      // DEF 2-4
      { slotNo: 2, x: 28, y: 72 },
      { slotNo: 3, x: 50, y: 74 },
      { slotNo: 4, x: 72, y: 72 },
      // MID 5-9
      { slotNo: 5, x: 15, y: 52 },
      { slotNo: 6, x: 32, y: 50 },
      { slotNo: 7, x: 50, y: 52 },
      { slotNo: 8, x: 68, y: 50 },
      { slotNo: 9, x: 85, y: 52 },
      // ATT 10-11
      { slotNo: 10, x: 42, y: 28 },
      { slotNo: 11, x: 58, y: 28 },
    ]);
  }

  const state = {
    activityId: '',
    teamCount: 2,
    teamNames: ['队伍1', '队伍2'],
    teamFormations: ['4-4-2', '4-4-2'],
    canEdit: false,
    roster: [], // {attendanceId,userId,username,avatarUrl,number,status,teamNo,slotNo}
    dirty: new Map(), // attendanceId -> {teamNo, slotNo}
    formationsDirty: false,
  };

  function normalizeTeamName(i) {
    return (state.teamNames[i] || '').trim() || `队伍${i + 1}`;
  }

  function getTeamPlayers(teamNo) {
    return state.roster.filter((p) => (p.teamNo || 0) === teamNo);
  }

  function findByAttendanceId(attendanceId) {
    return state.roster.find((x) => x.attendanceId === attendanceId);
  }

  function markDirty(p) {
    state.dirty.set(p.attendanceId, { teamNo: p.teamNo || 0, slotNo: p.slotNo || 0 });
  }

  function renderToken(p) {
    const el = document.createElement('div');
    el.className = 'player-token';
    el.dataset.attendanceId = p.attendanceId;

    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = p.avatarUrl || defaultAvatarUrl();
    img.onerror = () => {
      img.onerror = null;
      img.src = defaultAvatarUrl();
    };

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = p.username || '未命名';

    const no = document.createElement('div');
    no.className = 'no';
    no.textContent = p.number ? `#${p.number}` : '';

    el.appendChild(img);
    el.appendChild(name);
    el.appendChild(no);

    el.draggable = !!state.canEdit;
    el.setAttribute('draggable', state.canEdit ? 'true' : 'false');

    if (state.canEdit) {
      el.addEventListener('dragstart', (e) => {
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', p.attendanceId);
      });
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
    }

    return el;
  }

  function attachSlotDrop(slotEl, teamNo, slotNo) {
    if (!slotEl) return;

    slotEl.addEventListener('dragover', (e) => {
      if (!state.canEdit) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      slotEl.classList.add('drag-over');
    });

    slotEl.addEventListener('dragleave', () => slotEl.classList.remove('drag-over'));

    slotEl.addEventListener('drop', (e) => {
      if (!state.canEdit) return;
      e.preventDefault();
      slotEl.classList.remove('drag-over');

      const attendanceId = e.dataTransfer.getData('text/plain');
      if (!attendanceId) return;

      const dragged = findByAttendanceId(attendanceId);
      if (!dragged) return;

      // occupant in this slot?
      const occupant = state.roster.find((p) => (p.teamNo || 0) === teamNo && (p.slotNo || 0) === slotNo);
      if (occupant && occupant.attendanceId !== dragged.attendanceId) {
        // bump occupant to subs
        occupant.slotNo = 0;
        markDirty(occupant);
      }

      dragged.teamNo = teamNo;
      dragged.slotNo = slotNo;
      markDirty(dragged);
      render();
    });
  }

  function attachTeamSubsDrop(container, teamNo) {
    if (!container) return;

    container.addEventListener('dragover', (e) => {
      if (!state.canEdit) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    container.addEventListener('drop', (e) => {
      if (!state.canEdit) return;
      e.preventDefault();
      const attendanceId = e.dataTransfer.getData('text/plain');
      if (!attendanceId) return;
      const item = findByAttendanceId(attendanceId);
      if (!item) return;

      item.teamNo = teamNo;
      item.slotNo = 0;
      markDirty(item);
      render();
    });
  }

  function attachGlobalBenchDrop(container) {
    if (!container) return;

    container.addEventListener('dragover', (e) => {
      if (!state.canEdit) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    container.addEventListener('drop', (e) => {
      if (!state.canEdit) return;
      e.preventDefault();
      const attendanceId = e.dataTransfer.getData('text/plain');
      if (!attendanceId) return;
      const item = findByAttendanceId(attendanceId);
      if (!item) return;

      item.teamNo = 0;
      item.slotNo = 0;
      markDirty(item);
      render();
    });
  }

  function renderPitchSlot(slotNo, pos, occupant, teamNo) {
    const el = document.createElement('div');
    el.className = 'pitch-slot';
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;
    el.dataset.teamNo = String(teamNo);
    el.dataset.slotNo = String(slotNo);

    attachSlotDrop(el, teamNo, slotNo);

    // jersey
    const jersey = document.createElement('div');
    jersey.className = 'jersey';

    const num = document.createElement('div');
    num.className = 'jersey-num';
    num.textContent = String(slotNo);
    jersey.appendChild(num);

    el.appendChild(jersey);

    if (occupant) {
      const avatar = document.createElement('img');
      avatar.className = 'slot-avatar';
      avatar.alt = '';
      avatar.loading = 'lazy';
      avatar.decoding = 'async';
      avatar.src = occupant.avatarUrl || defaultAvatarUrl();
      avatar.onerror = () => {
        avatar.onerror = null;
        avatar.src = defaultAvatarUrl();
      };
      el.appendChild(avatar);

      const name = document.createElement('div');
      name.className = 'slot-name';
      name.textContent = occupant.username || '';
      el.appendChild(name);

      // make the whole slot draggable by dragging the avatar
      if (state.canEdit) {
        el.draggable = false;
        avatar.draggable = true;
        avatar.addEventListener('dragstart', (e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', occupant.attendanceId);
        });
      }
    } else {
      const empty = document.createElement('div');
      empty.className = 'slot-empty';
      empty.textContent = `空位${slotNo}`;
      el.appendChild(empty);
    }

    return el;
  }

  function renderFormationButtons(i) {
    const wrap = document.createElement('div');
    wrap.className = 'formation-buttons';

    const current = normalizeFormation(state.teamFormations[i]);

    for (const f of FORMATIONS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'formation-btn' + (f === current ? ' active' : '');
      btn.textContent = f;
      btn.disabled = !state.canEdit;
      btn.addEventListener('click', () => {
        state.teamFormations[i] = f;
        state.formationsDirty = true;
        render();
      });
      wrap.appendChild(btn);
    }

    return wrap;
  }

  function render() {
    if (!bandsLayer) return;
    bandsLayer.innerHTML = '';
    if (benchEl) benchEl.innerHTML = '';

    const n = Math.max(2, Math.min(4, state.teamCount || 2));
    const bandH = 100 / n;

    for (let i = 0; i < n; i++) {
      const teamNo = i + 1;

      const band = document.createElement('div');
      band.className = 'team-band';
      band.dataset.teamNo = String(teamNo);
      band.style.top = `${i * bandH}%`;
      band.style.height = `${bandH}%`;

      const header = document.createElement('div');
      header.className = 'team-band-header';

      const title = document.createElement('div');
      title.className = 'team-band-title';
      title.textContent = normalizeTeamName(i);

      const right = document.createElement('div');
      right.className = 'team-band-right';

      const teamPlayers = getTeamPlayers(teamNo);
      const count = document.createElement('div');
      count.className = 'team-band-count';
      count.textContent = `${teamPlayers.length}人`;

      right.appendChild(count);
      header.appendChild(title);
      header.appendChild(right);

      const formationBar = renderFormationButtons(i);

      // pitch overlay
      const pitch = document.createElement('div');
      pitch.className = 'team-pitch';

      const formation = normalizeFormation(state.teamFormations[i]);
      const positions = slotPositions(formation);

      const bySlot = new Map();
      for (const p of teamPlayers) {
        const s = p.slotNo || 0;
        if (s > 0 && s <= 11) bySlot.set(s, p);
      }

      for (const p of positions) {
        pitch.appendChild(renderFormationSlot(p.slotNo, p, bySlot.get(p.slotNo), teamNo));
      }

      // subs
      const subs = teamPlayers.filter((p) => !p.slotNo || p.slotNo === 0 || p.slotNo > 11);
      const subsEl = document.createElement('div');
      subsEl.className = 'subs';
      const subsTitle = document.createElement('div');
      subsTitle.className = 'subs-title';
      subsTitle.textContent = '替补区（拖拽到球场槽位）';
      const subsList = document.createElement('div');
      subsList.className = 'subs-list';
      attachTeamSubsDrop(subsList, teamNo);
      for (const p of subs) subsList.appendChild(renderToken(p));
      subsEl.appendChild(subsTitle);
      subsEl.appendChild(subsList);

      band.appendChild(header);
      band.appendChild(formationBar);
      band.appendChild(pitch);
      band.appendChild(subsEl);

      bandsLayer.appendChild(band);
    }

    // global bench (unassigned)
    const benchPlayers = state.roster.filter((p) => !p.teamNo || p.teamNo === 0);
    if (benchEl) {
      attachGlobalBenchDrop(benchEl);
      for (const p of benchPlayers) benchEl.appendChild(renderToken(p));
    }

    if (ui.save) ui.save.disabled = !state.canEdit || (state.dirty.size === 0 && !state.formationsDirty);
    if (ui.editHint) {
      ui.editHint.textContent = state.canEdit
        ? '拖拽球员到球场槽位，点击保存'
        : '只读：仅管理员/创建者可调整阵型与站位';
    }
  }

  function renderFormationSlot(slotNo, pos, occupant, teamNo) {
    return renderPitchSlot(slotNo, pos, occupant, teamNo);
  }

  async function loadActivities() {
    const teamId = localStorage.getItem(CURRENT_TEAM_KEY);
    if (!teamId) {
      flashStatus('请先选择球队', 2000);
      return;
    }

    const list = await apiFetch(`/activities?teamId=${encodeURIComponent(teamId)}`);
    if (!ui.activitySelect) return;

    ui.activitySelect.innerHTML = '<option value="">选择活动…</option>';

    for (const a of list) {
      const opt = document.createElement('option');
      opt.value = a.id;
      const d = a.date ? new Date(a.date) : null;
      const ds = d ? `${d.getMonth() + 1}/${d.getDate()}` : '';
      opt.textContent = `${ds} ${a.name}`.trim();
      ui.activitySelect.appendChild(opt);
    }

    const current = getActivityId();
    if (current) {
      ui.activitySelect.value = current;
      return;
    }

    if (list && list[0]) {
      setActivityId(list[0].id);
    }
  }

  async function loadTeams(activityId) {
    const payload = await apiFetch(`/activities/${encodeURIComponent(activityId)}/teams`);

    state.activityId = activityId;
    state.teamCount = payload.teamCount || 2;
    state.teamNames = payload.teamNames || [];
    state.teamFormations = (payload.teamFormations || []).map(normalizeFormation);
    state.canEdit = !!payload.canEdit;
    state.roster = (payload.roster || []).slice().sort((a, b) => {
      const ta = a.teamNo || 0;
      const tb = b.teamNo || 0;
      if (ta !== tb) return ta - tb;
      const sa = a.slotNo || 0;
      const sb = b.slotNo || 0;
      if (sa !== sb) return sa - sb;
      const na = (a.number || 9999) - (b.number || 9999);
      if (na !== 0) return na;
      return (a.username || '').localeCompare(b.username || '');
    });

    // normalize formations length
    const n = Math.max(2, Math.min(4, state.teamCount || 2));
    state.teamFormations = Array.from({ length: n }, (_, i) => normalizeFormation(state.teamFormations[i]));

    state.dirty.clear();
    state.formationsDirty = false;

    render();
    flashStatus(state.canEdit ? '已加载，可拖拽站位' : '已加载（只读）', 1200);
  }

  async function save() {
    if (!state.canEdit) return;

    if (state.dirty.size === 0 && !state.formationsDirty) {
      flashStatus('没有更改', 1200);
      return;
    }

    const assignments = Array.from(state.dirty.entries()).map(([attendanceId, v]) => ({
      attendanceId,
      teamNo: v.teamNo,
      slotNo: v.slotNo,
    }));

    const body = { assignments };
    if (state.formationsDirty) body.formations = state.teamFormations.slice(0, 4);

    await apiFetch(`/activities/${encodeURIComponent(state.activityId)}/teams`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });

    state.dirty.clear();
    state.formationsDirty = false;
    render();
    flashStatus('已保存阵型/站位', 1600);
  }

  function wireUi() {
    ui.activitySelect?.addEventListener('change', () => {
      const id = ui.activitySelect.value;
      if (id) setActivityId(id);
    });

    ui.save?.addEventListener('click', () =>
      save().catch((e) => flashStatus(`保存失败：${e.message}`, 2500)),
    );

    // Prevent accidental scroll-jank while dragging
    if (fieldEl) {
      fieldEl.addEventListener('dragstart', (e) => e.preventDefault());
    }
  }

  async function init() {
    wireUi();

    await loadActivities().catch((e) => flashStatus(`加载活动失败：${e.message}`, 2500));

    const activityId = getActivityId();
    if (!activityId) return;

    if (ui.activitySelect) ui.activitySelect.value = activityId;
    await loadTeams(activityId).catch((e) => flashStatus(`加载战术板失败：${e.message}`, 2500));
  }

  init();
})();
