/*
  Lineup mode inside /tactics.html
  - A队/B队两套阵容，固定 11 槽位（按位置）
  - stores Attendance.position as encoded value: "A:GK" / "B:ST2" etc.
  - load: GET /activities/:id (expects canEdit)
  - save: PATCH /activities/:id/positions (server enforces permission)
*/

(function(){
  const root = document.getElementById('lineupModeRoot');
  if (!root) return;

  const TOKEN_KEY = 'authToken';
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  if (!token) { window.location.href = '/login.html'; return; }

  const qs = new URLSearchParams(window.location.search);
  const activityId = qs.get('activityId');

  const slotsEl = document.getElementById('lineupSlots');
  const saveBtn = document.getElementById('btnSaveLineup');
  const saveStatus = document.getElementById('lineupSaveStatus');
  const teamSeg = document.getElementById('lineupTeamSeg');
  const formationSeg = document.getElementById('lineupFormationSeg');

  const benchList = document.getElementById('lineupBenchList');
  const benchEmpty = document.getElementById('lineupBenchEmpty');
  const benchTitle = document.getElementById('lineupBenchTitle');

  // mobile drawer
  const benchListMobile = document.getElementById('lineupBenchListMobile');
  const benchEmptyMobile = document.getElementById('lineupBenchEmptyMobile');

  function showStatus(t){
    if (!saveStatus) return;
    saveStatus.textContent = t;
    saveStatus.classList.add('show');
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(()=>saveStatus.classList.remove('show'), 2000);
  }

  function safeJson(res){
    return res.text().then((t)=>{ try { return t ? JSON.parse(t) : null; } catch(e){ return null; } });
  }

  const FORMATIONS = {
    '4-4-2': [
      { key:'GK',  label:'GK',  x:50, y:88 },
      { key:'LB',  label:'LB',  x:22, y:72 },
      { key:'LCB', label:'LCB', x:40, y:74 },
      { key:'RCB', label:'RCB', x:60, y:74 },
      { key:'RB',  label:'RB',  x:78, y:72 },
      { key:'LM',  label:'LM',  x:22, y:52 },
      { key:'LCM', label:'LCM', x:40, y:54 },
      { key:'RCM', label:'RCM', x:60, y:54 },
      { key:'RM',  label:'RM',  x:78, y:52 },
      { key:'ST1', label:'ST',  x:44, y:26 },
      { key:'ST2', label:'ST',  x:56, y:26 },
    ],
    '4-3-3': [
      { key:'GK',  label:'GK',  x:50, y:88 },
      { key:'LB',  label:'LB',  x:22, y:72 },
      { key:'LCB', label:'LCB', x:40, y:74 },
      { key:'RCB', label:'RCB', x:60, y:74 },
      { key:'RB',  label:'RB',  x:78, y:72 },
      { key:'LCM', label:'LCM', x:38, y:54 },
      { key:'CM',  label:'CM',  x:50, y:58 },
      { key:'RCM', label:'RCM', x:62, y:54 },
      { key:'LW',  label:'LW',  x:24, y:28 },
      { key:'ST',  label:'ST',  x:50, y:24 },
      { key:'RW',  label:'RW',  x:76, y:28 },
    ],
    '3-5-2': [
      { key:'GK',  label:'GK',  x:50, y:88 },
      { key:'LCB', label:'LCB', x:35, y:74 },
      { key:'CB',  label:'CB',  x:50, y:76 },
      { key:'RCB', label:'RCB', x:65, y:74 },
      { key:'LWB', label:'LWB', x:20, y:56 },
      { key:'LCM', label:'LCM', x:38, y:56 },
      { key:'CM',  label:'CM',  x:50, y:60 },
      { key:'RCM', label:'RCM', x:62, y:56 },
      { key:'RWB', label:'RWB', x:80, y:56 },
      { key:'ST1', label:'ST',  x:44, y:26 },
      { key:'ST2', label:'ST',  x:56, y:26 },
    ],
  };

  let state = {
    canEdit: false,
    activeTeam: 'A',
    formation: '4-4-2',
    activityAttendances: [],
    activityUsers: {},
    lineup: { A: {}, B: {} },
    assigned: {},
    dirty: false,
  };

  // ===== drag/drop =====
  let drag = null;

  function enableDrag(el){
    el.addEventListener('pointerdown', (ev)=>{
      if (!state.canEdit) return;
      ev.preventDefault();

      const target = ev.currentTarget;
      const rect = target.getBoundingClientRect();
      drag = {
        source: target,
        pointerId: ev.pointerId,
        offsetX: ev.clientX - rect.left,
        offsetY: ev.clientY - rect.top,
        ghost: null,
      };

      const g = target.cloneNode(true);
      g.classList.add('dragging');
      g.style.position = 'fixed';
      g.style.left = (ev.clientX - drag.offsetX) + 'px';
      g.style.top = (ev.clientY - drag.offsetY) + 'px';
      g.style.width = rect.width + 'px';
      g.style.zIndex = 9999;
      g.style.pointerEvents = 'none';
      document.body.appendChild(g);
      drag.ghost = g;
      target.classList.add('dragging');
      target.setPointerCapture(ev.pointerId);
    });

    el.addEventListener('pointermove', (ev)=>{
      if (!drag || drag.pointerId !== ev.pointerId) return;
      if (drag.ghost) {
        drag.ghost.style.left = (ev.clientX - drag.offsetX) + 'px';
        drag.ghost.style.top = (ev.clientY - drag.offsetY) + 'px';
      }
      clearHighlights();
      const drop = findDrop(ev.clientX, ev.clientY);
      if (drop) drop.classList.add('drop-highlight');
    });

    el.addEventListener('pointerup', (ev)=>{
      if (!drag || drag.pointerId !== ev.pointerId) return;
      finishDrop(ev.clientX, ev.clientY);
      try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch(e){}
    });

    el.addEventListener('pointercancel', (ev)=>{
      if (!drag || drag.pointerId !== ev.pointerId) return;
      finishDrop(null, null, true);
      try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch(e){}
    });
  }

  function clearHighlights(){
    document.querySelectorAll('.drop-highlight').forEach((n)=>n.classList.remove('drop-highlight'));
  }

  function findDrop(x,y){
    const el = document.elementFromPoint(x,y);
    if (!el) return null;
    return el.closest('[data-slot-key], #lineupBenchList');
  }

  function finishDrop(x,y,cancelled){
    clearHighlights();
    if (!drag) return;

    const src = drag.source;
    const ghost = drag.ghost;
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    if (src) src.classList.remove('dragging');

    if (!cancelled && x!=null && y!=null) {
      const drop = findDrop(x,y);
      if (drop) {
        const uid = src.getAttribute('data-user-id');
        if (uid) {
          if (drop.id === 'lineupBenchList') {
            unassignUser(uid);
          } else {
            const slotKey = drop.getAttribute('data-slot-key');
            if (slotKey) assignToSlot(uid, state.activeTeam, slotKey);
          }
        }
      }
    }
    drag = null;
  }

  function unassignUser(userId){
    const cur = state.assigned[userId];
    if (!cur) return;
    delete state.lineup[cur.team][cur.slotKey];
    delete state.assigned[userId];
    state.dirty = true;
    render();
    scheduleAutoSave();
  }

  function assignToSlot(userId, team, slotKey){
    const existingUid = state.lineup[team][slotKey];
    const cur = state.assigned[userId];

    if (cur && cur.team === team && cur.slotKey === slotKey) return;

    if (cur) delete state.lineup[cur.team][cur.slotKey];

    if (existingUid && existingUid !== userId) {
      delete state.assigned[existingUid];
    }

    state.lineup[team][slotKey] = userId;
    state.assigned[userId] = { team, slotKey };

    state.dirty = true;
    render();
    scheduleAutoSave();
  }

  // ===== Save =====
  let autoSaveTimer = null;
  let saving = false;
  let pendingSave = false;

  function scheduleAutoSave(){
    if (!state.canEdit) return;
    if (!state.dirty) return;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(()=>{
      if (!state.dirty) return;
      save({mode:'auto'}).catch(()=>{});
    }, 1200);
  }

  function encodePosition(team, slotKey){
    return `${team}:${slotKey}`;
  }

  function decodePosition(pos){
    if (!pos) return null;
    const s = String(pos).trim();
    const m = s.match(/^([AB]):([A-Z0-9]+)$/);
    if (!m) return null;
    return { team: m[1], slotKey: m[2] };
  }

  async function save(opts){
    opts = opts || {mode:'manual'};
    if (!state.canEdit) return;
    if (!activityId) return;
    if (saving) { pendingSave = true; return; }

    const positions = [];
    for (const team of ['A','B']) {
      const lineup = state.lineup[team] || {};
      for (const slotKey of Object.keys(lineup)) {
        const uid = lineup[slotKey];
        if (!uid) continue;
        positions.push({ userId: uid, position: encodePosition(team, slotKey) });
      }
    }

    saving = true;
    pendingSave = false;
    showStatus(opts.mode === 'auto' ? '自动保存中…' : '保存中…');
    if (saveBtn) saveBtn.disabled = true;

    try {
      const res = await fetch('/activities/' + encodeURIComponent(activityId) + '/positions', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ positions }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        showStatus((body && body.message) ? body.message : '保存失败');
        return;
      }
      state.dirty = false;
      showStatus('已保存');
      await load();
    } catch(e){
      showStatus('保存失败（网络错误）');
    } finally {
      saving = false;
      if (saveBtn) saveBtn.disabled = !state.canEdit;
      if (pendingSave && state.dirty) { pendingSave = false; scheduleAutoSave(); }
    }
  }

  // ===== render =====
  function mkAvatar(user){
    const hasAvatar = !!(user && user.avatarUrl);
    if (hasAvatar) {
      const img = document.createElement('img');
      img.className = 'avatar-media';
      img.src = user.avatarUrl;
      img.alt = user.username || 'player';
      return img;
    }
    const ph = document.createElement('div');
    ph.className = 'avatar-media avatar-placeholder';
    ph.textContent = '?';
    return ph;
  }

  function mkToken(userId, team, user){
    const el = document.createElement('div');
    el.className = 'token';
    el.setAttribute('data-user-id', userId);
    el.setAttribute('data-team', team || 'bench');

    el.appendChild(mkAvatar(user));

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = user && user.username ? user.username : userId;
    el.appendChild(name);

    el.addEventListener('click', ()=>{
      if (!state.canEdit) return;
      unassignUser(userId);
    });

    if (state.canEdit) enableDrag(el);
    else el.style.cursor = 'default';

    return el;
  }

  function renderSlots(){
    if (!slotsEl) return;
    slotsEl.innerHTML = '';
    const slots = FORMATIONS[state.formation] || FORMATIONS['4-4-2'];

    for (const s of slots) {
      const wrapper = document.createElement('div');
      wrapper.className = 'slot';
      wrapper.style.left = s.x + '%';
      wrapper.style.top = s.y + '%';
      wrapper.setAttribute('data-slot-key', s.key);

      const pos = document.createElement('div');
      pos.className = 'pos';
      pos.textContent = s.label;
      wrapper.appendChild(pos);

      const uid = (state.lineup[state.activeTeam] || {})[s.key];
      if (uid) {
        const u = (state.activityUsers || {})[uid];
        wrapper.appendChild(mkToken(uid, state.activeTeam, u));
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'token';
        placeholder.style.cursor = state.canEdit ? 'pointer' : 'default';
        placeholder.setAttribute('data-team', state.activeTeam);
        placeholder.innerHTML = '<div class="avatar-media avatar-placeholder">+</div><div class="name">空位</div>';
        wrapper.appendChild(placeholder);
      }

      slotsEl.appendChild(wrapper);
    }
  }

  function getTeamOfUser(userId){
    const a = (state.activityAttendances || []).find((r)=>r.userId === userId);
    const tn = a ? a.teamNo : null;
    if (tn === 1) return 'A';
    if (tn === 2) return 'B';
    return 'bench';
  }

  function renderBench(){
    const users = state.activityUsers || {};
    const attendances = state.activityAttendances || [];
    const activeTeam = state.activeTeam;

    const bench = [];
    for (const r of attendances) {
      const uid = r.userId;
      const belong = getTeamOfUser(uid);
      if (belong !== activeTeam) continue;
      const ass = state.assigned[uid];
      if (ass && ass.team === activeTeam) continue;
      bench.push({ userId: uid, user: users[uid], team: belong });
    }

    function fill(container, emptyEl){
      if (!container) return;
      container.innerHTML = '';
      if (!bench.length) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
      }
      if (emptyEl) emptyEl.classList.add('hidden');
      for (const b of bench) {
        container.appendChild(mkToken(b.userId, b.team, b.user));
      }
    }

    if (benchTitle) benchTitle.textContent = `候补（${bench.length}）`;
    fill(benchList, benchEmpty);
    fill(benchListMobile, benchEmptyMobile);
  }

  function render(){
    renderSlots();
    renderBench();
    if (state.dirty) showStatus('未保存');
  }

  // ===== load =====
  async function load(){
    if (!activityId) { showStatus('缺少 activityId'); return; }

    const res = await fetch('/activities/' + encodeURIComponent(activityId), {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) {
      const body = await safeJson(res);
      showStatus((body && body.message) ? body.message : '加载失败');
      return;
    }

    const data = await res.json();
    state.canEdit = !!data.canEdit;
    if (saveBtn) saveBtn.disabled = !state.canEdit;

    const atts = Array.isArray(data.attendances) ? data.attendances : [];
    state.activityAttendances = atts;

    const users = {};
    atts.forEach((a)=>{ if (a && a.user) users[a.userId] = a.user; });
    state.activityUsers = users;

    state.lineup = { A: {}, B: {} };
    state.assigned = {};

    atts.forEach((a)=>{
      const decoded = decodePosition(a.position);
      if (!decoded) return;
      const { team, slotKey } = decoded;
      state.lineup[team][slotKey] = a.userId;
      state.assigned[a.userId] = { team, slotKey };
    });

    state.dirty = false;
    if (!state.canEdit) showStatus('只读：无编辑权限');

    render();
  }

  // ===== UI wiring =====
  if (teamSeg) {
    teamSeg.addEventListener('click', (ev)=>{
      const btn = ev.target && ev.target.closest ? ev.target.closest('[data-team]') : null;
      if (!btn) return;
      const t = btn.getAttribute('data-team');
      if (!t) return;
      state.activeTeam = t;
      Array.from(teamSeg.querySelectorAll('.seg-btn')).forEach((b)=>b.classList.toggle('active', b.getAttribute('data-team') === t));
      render();
    });
  }

  if (formationSeg) {
    formationSeg.addEventListener('click', (ev)=>{
      const btn = ev.target && ev.target.closest ? ev.target.closest('[data-formation]') : null;
      if (!btn) return;
      const f = btn.getAttribute('data-formation');
      if (!f) return;
      state.formation = f;
      Array.from(formationSeg.querySelectorAll('.seg-btn')).forEach((b)=>b.classList.toggle('active', b.getAttribute('data-formation') === f));
      render();
    });
  }

  if (saveBtn) saveBtn.addEventListener('click', ()=>save({mode:'manual'}));

  window.addEventListener('beforeunload', (e)=>{
    if (!state.canEdit) return;
    if (!state.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  // Expose reload for mode switch
  window.__tacticsLineupReload = load;

  load().catch(()=>showStatus('加载失败'));
})();
