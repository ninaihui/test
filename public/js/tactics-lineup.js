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
  const exportBtn = document.getElementById('btnExportLineup');
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
    formation: { A: '4-4-2', B: '4-4-2' },
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

  // (removed) encoded position helpers; lineup uses dedicated /lineup API + tables.

  async function save(opts){
    opts = opts || {mode:'manual'};
    if (!state.canEdit) return;
    if (!activityId) return;
    if (saving) { pendingSave = true; return; }

    const teamKey = state.activeTeam;
    const lineup = state.lineup[teamKey] || {};
    const slots = Object.keys(lineup)
      .map((slotKey)=>({ slotKey, userId: lineup[slotKey] }))
      .filter((x)=>x.userId);

    saving = true;
    pendingSave = false;
    showStatus(opts.mode === 'auto' ? '自动保存中…' : '保存中…');
    if (saveBtn) saveBtn.disabled = true;

    try {
      const res = await fetch('/activities/' + encodeURIComponent(activityId) + '/lineup', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teamKey, formation: state.formation[teamKey] || '4-4-2', slots }),
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
    const url = user && user.avatarUrl ? String(user.avatarUrl) : '';
    const hasAvatar = !!url;

    if (hasAvatar) {
      const img = document.createElement('img');
      img.className = 'avatar-media';
      img.alt = (user && user.username) ? user.username : 'player';
      // normalize relative url
      img.src = url.startsWith('/') ? (window.location.origin + url) : url;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', ()=>{
        // fallback to placeholder
        const ph = document.createElement('div');
        ph.className = 'avatar-media avatar-placeholder';
        ph.textContent = '?';
        img.replaceWith(ph);
      }, { once: true });
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
    const slots = FORMATIONS[state.formation[state.activeTeam] || '4-4-2'] || FORMATIONS['4-4-2'];

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

    const res = await fetch('/activities/' + encodeURIComponent(activityId) + '/lineup', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) {
      const body = await safeJson(res);
      showStatus((body && body.message) ? body.message : '加载失败');
      return;
    }

    const data = await res.json();
    state.canEdit = !!data.canEdit;
    state.teamNames = Array.isArray(data.teamNames) ? data.teamNames : [];
    if (saveBtn) saveBtn.disabled = !state.canEdit;

    // update team labels
    var btnA = document.getElementById('lineupTeamBtnA');
    var btnB = document.getElementById('lineupTeamBtnB');
    if (btnA) btnA.textContent = (state.teamNames[0] ? String(state.teamNames[0]) : 'A队');
    if (btnB) btnB.textContent = (state.teamNames[1] ? String(state.teamNames[1]) : 'B队');

    // load roster for bench from /activities/:id (need users + teamNo)
    const r2 = await fetch('/activities/' + encodeURIComponent(activityId), { headers: { Authorization: 'Bearer ' + token } });
    const activity = r2.ok ? await r2.json() : null;
    const atts = activity && Array.isArray(activity.attendances) ? activity.attendances : [];
    state.activityAttendances = atts;

    const users = {};
    atts.forEach((a)=>{ if (a && a.user) users[a.userId] = a.user; });
    state.activityUsers = users;

    // formations
    state.formation = { A: (data.formation && data.formation.A) ? data.formation.A : '4-4-2', B: (data.formation && data.formation.B) ? data.formation.B : '4-4-2' };

    state.lineup = { A: {}, B: {} };
    state.assigned = {};

    const slots = Array.isArray(data.slots) ? data.slots : [];
    slots.forEach((s)=>{
      if (!s || !s.teamKey || !s.slotKey || !s.userId) return;
      const team = String(s.teamKey);
      const slotKey = String(s.slotKey);
      const uid = String(s.userId);
      if (team !== 'A' && team !== 'B') return;
      state.lineup[team][slotKey] = uid;
      state.assigned[uid] = { team, slotKey };
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
      // sync formation buttons
      const f = state.formation[t] || '4-4-2';
      Array.from(formationSeg.querySelectorAll('.seg-btn')).forEach((b)=>b.classList.toggle('active', b.getAttribute('data-formation') === f));
      render();
    });
  }

  if (formationSeg) {
    formationSeg.addEventListener('click', (ev)=>{
      const btn = ev.target && ev.target.closest ? ev.target.closest('[data-formation]') : null;
      if (!btn) return;
      const f = btn.getAttribute('data-formation');
      if (!f) return;
      state.formation[state.activeTeam] = f;
      Array.from(formationSeg.querySelectorAll('.seg-btn')).forEach((b)=>b.classList.toggle('active', b.getAttribute('data-formation') === f));
      render();
      scheduleAutoSave();
    });
  }

  if (saveBtn) saveBtn.addEventListener('click', ()=>save({mode:'manual'}));

  window.addEventListener('beforeunload', (e)=>{
    if (!state.canEdit) return;
    if (!state.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  function teamLabel(team){
    // Prefer activity.teamNames if present; fallback A/B
    // Note: in DB teamNo starts at 1; we map A->1, B->2.
    const a = state.teamNames && state.teamNames[0] ? String(state.teamNames[0]) : 'A队';
    const b = state.teamNames && state.teamNames[1] ? String(state.teamNames[1]) : 'B队';
    return team === 'A' ? a : b;
  }

  async function exportPng(){
    if (!slotsEl) return;

    const team = state.activeTeam;
    const formation = state.formation[team] || '4-4-2';
    const slots = FORMATIONS[formation] || FORMATIONS['4-4-2'];

    const width = 1080;
    const height = 1440;

    // Build simple SVG (pitch + players)
    const pitch = `
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2aa65f"/>
          <stop offset="1" stop-color="#1f8f53"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#g)"/>
      <rect x="60" y="60" width="${width-120}" height="${height-120}" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="4"/>
      <line x1="60" y1="${height/2}" x2="${width-60}" y2="${height/2}" stroke="rgba(255,255,255,0.85)" stroke-width="4"/>
      <circle cx="${width/2}" cy="${height/2}" r="140" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="4"/>
      <circle cx="${width/2}" cy="${height/2}" r="10" fill="rgba(255,255,255,0.9)"/>
    `;

    const title = `${teamLabel(team)}  ${formation}`;

    function esc(s){
      return String(s||'').replace(/[&<>"']/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    const playersSvg = slots.map((p)=>{
      const uid = (state.lineup[team]||{})[p.key];
      const u = uid ? (state.activityUsers||{})[uid] : null;
      const name = u && u.username ? u.username : '';
      const x = Math.round((p.x/100) * width);
      const y = Math.round((p.y/100) * height);
      const r = 48;
      const ring = team === 'A' ? 'rgba(239,68,68,0.95)' : 'rgba(59,130,246,0.95)';
      return `
        <g>
          <circle cx="${x}" cy="${y}" r="${r}" fill="rgba(0,0,0,0.22)" stroke="${ring}" stroke-width="8"/>
          <text x="${x}" y="${y+6}" text-anchor="middle" font-size="44" font-weight="800" fill="rgba(255,255,255,0.92)">${esc(p.label)}</text>
          <text x="${x}" y="${y+92}" text-anchor="middle" font-size="28" font-weight="700" fill="rgba(255,255,255,0.92)">${esc(name)}</text>
        </g>
      `;
    }).join('');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${pitch}
        <rect x="0" y="0" width="${width}" height="120" fill="rgba(0,0,0,0.28)"/>
        <text x="54" y="78" font-size="44" font-weight="900" fill="white">${esc(title)}</text>
        <text x="54" y="110" font-size="26" fill="rgba(255,255,255,0.75)">导出自阵容页</text>
        ${playersSvg}
      </svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((png)=>{
        if (!png) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(png);
        a.download = `lineup-${team}-${formation}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
      }, 'image/png');
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); showStatus('导出失败'); };
    img.src = url;
  }

  if (exportBtn) exportBtn.addEventListener('click', exportPng);

  // Expose reload for mode switch
  window.__tacticsLineupReload = load;

  load().catch(()=>showStatus('加载失败'));
})();
