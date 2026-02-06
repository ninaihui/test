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

  // For smaller team sizes (8-10), we trim a base 11-slot formation by a removal priority list.
  const TRIM_PRIORITY = {
    '4-4-2': ['ST2','RM','LM','RCM','LCM','RB','LB'],
    '4-3-3': ['RW','LW','CM','RCM','LCM','RB','LB'],
    '3-5-2': ['ST2','RWB','LWB','RCM','LCM','CB'],
  };

  function getTeamSizeCap(activity, teamNo){
    const maxP = activity && activity.maxParticipants != null ? Number(activity.maxParticipants) : 14;
    const teamCount = activity && activity.teamCount != null ? Number(activity.teamCount) : 2;
    const tc = (Number.isFinite(teamCount) && teamCount >= 1) ? teamCount : 2;
    const mp = (Number.isFinite(maxP) && maxP >= 1) ? maxP : 14;

    const base = Math.floor(mp / tc);
    const rem = mp % tc;
    const idx = Math.max(1, Math.floor(Number(teamNo) || 1));
    return base + (idx <= rem ? 1 : 0);
  }

  function clamp(n, a, b){
    n = Number(n);
    if (!Number.isFinite(n)) return a;
    return Math.max(a, Math.min(b, n));
  }

  function getSlotsForTeam(teamKey){
    const formation = state.formation[teamKey] || '4-4-2';
    const raw = FORMATIONS[formation] || FORMATIONS['4-4-2'];
    const size = clamp((state.teamSizes && state.teamSizes[teamKey]) ? state.teamSizes[teamKey] : 11, 8, 11);
    if (size >= raw.length) return raw;

    const remove = TRIM_PRIORITY[formation] || [];
    const keep = raw.slice();
    let needRemove = raw.length - size;
    for (const rk of remove) {
      if (needRemove <= 0) break;
      const i = keep.findIndex((x)=>x.key === rk);
      if (i >= 0) { keep.splice(i,1); needRemove--; }
    }
    // fallback: remove from end
    while (needRemove > 0 && keep.length > size) { keep.pop(); needRemove--; }
    return keep;
  }

  let state = {
    canEdit: false,
    canLineup: true,
    activeTeam: '1',
    formation: { '1': '4-4-2', '2': '4-4-2', '3': '4-4-2', '4': '4-4-2' },
    teamSizes: { '1': 11, '2': 11 },
    activityAttendances: [],
    activityUsers: {},
    lineup: { '1': {}, '2': {}, '3': {}, '4': {} },
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
    if (state.lineup[cur.team]) delete state.lineup[cur.team][cur.slotKey];
    delete state.assigned[userId];
    state.dirty = true;
    render();
    scheduleAutoSave();
  }

  function assignToSlot(userId, team, slotKey){
    if (!state.lineup[team]) state.lineup[team] = {};
    const existingUid = state.lineup[team][slotKey];
    const cur = state.assigned[userId];
    if (cur && !state.lineup[cur.team]) state.lineup[cur.team] = {};

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
    const allowed = new Set(getSlotsForTeam(teamKey).map(s=>s.key));
    const slots = Object.keys(lineup)
      .filter((slotKey)=>allowed.has(slotKey))
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
  function mkAvatar(user, team, jerseyNo){
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
        img.replaceWith(mkAvatar(null, team, jerseyNo));
      }, { once: true });
      return img;
    }

    // jersey placeholder (team color)
    const ph = document.createElement('div');
    ph.className = 'avatar-media jersey';

    const color = (team === '1' || team === 'A')
      ? 'rgba(239,68,68,0.92)'
      : ((team === '2' || team === 'B')
          ? 'rgba(59,130,246,0.92)'
          : (team === '3'
              ? 'rgba(168,85,247,0.92)'
              : (team === '4'
                  ? 'rgba(234,179,8,0.92)'
                  : 'rgba(148,163,184,0.65)')));

    const num = jerseyNo != null ? String(jerseyNo) : '';
    const label = num ? num : '?';
    ph.innerHTML = `
      <svg width="42" height="42" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M22 9l-10 6-6 10 10 6v24c0 4 3 7 7 7h18c4 0 7-3 7-7V31l10-6-6-10-10-6-8 6h-4l-8-6z" fill="${color}" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
        <text x="32" y="40" text-anchor="middle" font-size="22" font-weight="900" fill="rgba(255,255,255,0.92)">${label}</text>
      </svg>
    `;

    return ph;
  }

  function mkToken(userId, team, user, jerseyNo){
    const el = document.createElement('div');
    el.className = 'token';
    el.setAttribute('data-user-id', userId);
    el.setAttribute('data-team', team || 'bench');

    el.appendChild(mkAvatar(user, team, jerseyNo));

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
    const slots = getSlotsForTeam(state.activeTeam);

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
        // jerseyNo = slot order number in current formation
        wrapper.appendChild(mkToken(uid, state.activeTeam, u, slots.findIndex(x=>x.key===s.key) + 1));
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'token';
        placeholder.style.cursor = state.canEdit ? 'pointer' : 'default';
        placeholder.setAttribute('data-team', state.activeTeam);
        placeholder.appendChild(mkAvatar(null, state.activeTeam, '+'));
        const nm = document.createElement('div');
        nm.className = 'name';
        nm.textContent = '空位';
        placeholder.appendChild(nm);
        wrapper.appendChild(placeholder);
      }

      slotsEl.appendChild(wrapper);
    }
  }

  function getTeamOfUser(userId){
    const a = (state.activityAttendances || []).find((r)=>r.userId === userId);
    const tn = a ? Number(a.teamNo) : 0;
    if (Number.isFinite(tn) && tn >= 1) return String(tn);
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
        // bench: jerseyNo not needed
        container.appendChild(mkToken(b.userId, b.team, b.user));
      }
    }

    const cap = (state.teamSizes && state.teamSizes[activeTeam]) ? state.teamSizes[activeTeam] : '';
    if (benchTitle) benchTitle.textContent = `候补（${bench.length}）${cap ? (' · 本队上限' + cap + '人') : ''}`;
    fill(benchList, benchEmpty);
    fill(benchListMobile, benchEmptyMobile);
  }

  function normalizePosText(s){
    return String(s || '').trim().toUpperCase()
      .replace(/\s+/g,'')
      .replace(/　/g,'');
  }

  function slotCandidatesForPosition(posText, formation){
    const p = normalizePosText(posText);
    if (!p) return [];

    // Chinese + common abbreviations
    if (/(门将|守门员|GK)/.test(p)) return ['GK'];

    if (/(左后卫|左边后卫|LB)/.test(p)) return ['LB'];
    if (/(右后卫|右边后卫|RB)/.test(p)) return ['RB'];

    // Center backs
    if (/(中后卫|中卫|CB|后卫)/.test(p)) return ['LCB','RCB','CB'];

    // Wing backs
    if (/(左翼卫|LWB)/.test(p)) return ['LWB','LB'];
    if (/(右翼卫|RWB)/.test(p)) return ['RWB','RB'];

    // Midfield
    if (/(后腰|防守中场|DM|CDM)/.test(p)) return ['CM','LCM','RCM'];
    if (/(中场|中前卫|CM)/.test(p)) return ['CM','LCM','RCM'];
    if (/(左中场|LM)/.test(p)) return ['LM'];
    if (/(右中场|RM)/.test(p)) return ['RM'];

    // Wingers
    if (/(左边锋|左翼|LW)/.test(p)) return ['LW','LM'];
    if (/(右边锋|右翼|RW)/.test(p)) return ['RW','RM'];

    // Forwards
    if (/(前锋|中锋|ST|CF)/.test(p)) return ['ST','ST1','ST2'];

    return [];
  }

  function autoFillFromRegistration(){
    const filledCount = (team)=>Object.keys((state.lineup && state.lineup[team]) || {}).length;

    const teams = Object.keys(state.teamSizes || {}).filter(k=>k !== 'bench');
    if (!teams.length) return;

    // Only fill when all teams are empty (avoid overriding manual lineup)
    const alreadyFilled = teams.reduce((sum,t)=>sum + filledCount(t), 0);
    if (alreadyFilled > 0) return;

    const atts = state.activityAttendances || [];
    for (const team of teams) {
      if (!state.lineup[team]) state.lineup[team] = {};
      const formation = state.formation[team] || '4-4-2';
      const slots = getSlotsForTeam(team);
      const availableSlotKeys = new Set(slots.map(s=>s.key));

      // Fill by attendance.position (registration-selected position)
      const teamNo = Number(team);
      const teamUsers = atts
        .filter(a => a && a.userId && Number(a.teamNo) === teamNo && a.status !== 'waitlist')
        .map(a => ({ userId: a.userId, pos: a.position }));

      for (const tu of teamUsers) {
        if (state.assigned[tu.userId]) continue;
        const cands = slotCandidatesForPosition(tu.pos, formation);
        for (const sk of cands) {
          if (!availableSlotKeys.has(sk)) continue;
          if (state.lineup[team][sk]) continue;
          // assign
          state.lineup[team][sk] = tu.userId;
          state.assigned[tu.userId] = { team, slotKey: sk };
          break;
        }
      }
    }

    // If we filled anything, mark dirty and autosave (if allowed)
    let anyFilled = false;
    const teams2 = Object.keys(state.teamSizes || {}).filter(k=>k !== 'bench');
    for (const t of teams2) {
      if (filledCount(t) > 0) { anyFilled = true; break; }
    }
    if (anyFilled) {
      state.dirty = true;
      if (state.canEdit) scheduleAutoSave();
    }
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

    // team labels are rendered by renderTeamTabs

    // load roster for bench from /activities/:id (need users + teamNo)
    const r2 = await fetch('/activities/' + encodeURIComponent(activityId), { headers: { Authorization: 'Bearer ' + token } });
    const activity = r2.ok ? await r2.json() : null;

    // lineup availability rule: maxParticipants >= 8
    const maxParticipants = activity && activity.maxParticipants != null ? Number(activity.maxParticipants) : 14;
    state.canLineup = Number.isFinite(maxParticipants) ? (maxParticipants >= 8) : true;

    // team size caps derived from activity settings (maxParticipants + teamCount)
    // Map A->teamNo=1, B->teamNo=2
    if (activity) {
      const tc = (activity.teamCount != null && Number(activity.teamCount) >= 1) ? Math.min(4, Math.max(1, Number(activity.teamCount))) : 2;
      const sizes = {};
      for (let i = 1; i <= tc; i++) sizes[String(i)] = getTeamSizeCap(activity, i);
      state.teamSizes = sizes;
      if (!state.teamSizes[state.activeTeam]) state.activeTeam = '1';
      // rebuild team tabs
      renderTeamTabs(tc);
      // keep formation seg in sync
      const f0 = state.formation[state.activeTeam] || '4-4-2';
      Array.from(formationSeg.querySelectorAll('.seg-btn')).forEach((b)=>b.classList.toggle('active', b.getAttribute('data-formation') === f0));

    }
    if (!state.canLineup) {
      showStatus('人数上限低于 8：不展示阵容/不管理位置');
      if (saveBtn) saveBtn.disabled = true;
      if (exportBtn) exportBtn.disabled = true;
      if (slotsEl) slotsEl.innerHTML = '<div style="padding:14px;color:rgba(255,255,255,.75);font-weight:800">人数上限低于 8：不展示阵容，也无需管理位置</div>';
      state.activityAttendances = [];
      state.activityUsers = {};
      return;
    }

    const atts = activity && Array.isArray(activity.attendances) ? activity.attendances : [];
    state.activityAttendances = atts;

    const users = {};
    atts.forEach((a)=>{ if (a && a.user) users[a.userId] = a.user; });
    state.activityUsers = users;

    // formations
    // formations per teamKey ("1".."4")
    const f = (data && data.formation && typeof data.formation === 'object') ? data.formation : {};
    state.formation = {
      '1': (f['1'] ? String(f['1']) : '4-4-2'),
      '2': (f['2'] ? String(f['2']) : '4-4-2'),
      '3': (f['3'] ? String(f['3']) : '4-4-2'),
      '4': (f['4'] ? String(f['4']) : '4-4-2'),
    };

    state.lineup = { '1': {}, '2': {}, '3': {}, '4': {} };
    state.assigned = {};

    const slots = Array.isArray(data.slots) ? data.slots : [];
    const allowedA = new Set(getSlotsForTeam('1').map(s=>s.key));
    const allowedB = new Set(getSlotsForTeam('2').map(s=>s.key));
    slots.forEach((s)=>{
      if (!s || !s.teamKey || !s.slotKey || !s.userId) return;
      let team = String(s.teamKey);
      if (team === 'A') team = '1';
      if (team === 'B') team = '2';
      const slotKey = String(s.slotKey);
      const uid = String(s.userId);
      const allowed = team === '1' ? allowedA : (team === '2' ? allowedB : new Set(getSlotsForTeam(team).map(x=>x.key)));
      if (!allowed.has(slotKey)) return; // ignore slots not used by current team size
      if (!state.lineup[team]) state.lineup[team] = {};
      state.lineup[team][slotKey] = uid;
      state.assigned[uid] = { team, slotKey };
    });

    // Auto-fill empty slots from registration position (e.g. "中后卫") if lineup empty.
    if (state.canLineup !== false) autoFillFromRegistration();

    state.dirty = false;
    if (!state.canEdit) showStatus('只读：无编辑权限');

    render();
  }

  // ===== UI wiring =====
  function renderTeamTabs(teamCount){
    if (!teamSeg) return;
    const tc = clamp(teamCount || 2, 1, 4);
    teamSeg.innerHTML = '';

    for (let i = 1; i <= tc; i++) {
      const k = String(i);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seg-btn';
      btn.setAttribute('data-team', k);
      btn.textContent = teamLabel(k);
      btn.classList.toggle('active', state.activeTeam === k);
      teamSeg.appendChild(btn);
    }
  }

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

  function teamLabel(teamKey){
    const i = Math.max(1, Math.floor(Number(teamKey) || 1));
    const name = state.teamNames && state.teamNames[i - 1] ? String(state.teamNames[i - 1]) : ('队伍' + i);
    return name;
  }

  async function exportPng(){
    if (!slotsEl) return;

    const team = state.activeTeam;
    const formation = state.formation[team] || '4-4-2';
    const slots = getSlotsForTeam(team);

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

    async function toDataUrl(url){
      if (!url) return null;
      try {
        const abs = url.startsWith('/') ? (window.location.origin + url) : url;
        const res = await fetch(abs, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise((resolve)=>{
          const r = new FileReader();
          r.onload = ()=>resolve(String(r.result||''));
          r.onerror = ()=>resolve(null);
          r.readAsDataURL(blob);
        });
      } catch(e){
        return null;
      }
    }

    // Preload avatars as data URLs (avoid canvas taint). External URLs may fail; fallback to placeholder.
    const avatarData = {};
    for (const p of slots) {
      const uid = (state.lineup[team]||{})[p.key];
      const u = uid ? (state.activityUsers||{})[uid] : null;
      const url = u && u.avatarUrl ? String(u.avatarUrl) : '';
      if (uid && url && !avatarData[uid]) {
        avatarData[uid] = await toDataUrl(url);
      }
    }

    const playersSvg = slots.map((p)=>{
      const uid = (state.lineup[team]||{})[p.key];
      const u = uid ? (state.activityUsers||{})[uid] : null;
      const name = u && u.username ? u.username : '';
      const x = Math.round((p.x/100) * width);
      const y = Math.round((p.y/100) * height);
      const r = 54;
      const ring = (team === '1' || team === 'A')
        ? 'rgba(239,68,68,0.95)'
        : ((team === '2' || team === 'B')
            ? 'rgba(59,130,246,0.95)'
            : (team === '3'
                ? 'rgba(168,85,247,0.95)'
                : (team === '4'
                    ? 'rgba(234,179,8,0.95)'
                    : 'rgba(148,163,184,0.85)')));
      const img = uid ? avatarData[uid] : null;

      const clipId = `c_${team}_${p.key}`;
      const imgEl = img ? `<image href="${img}" x="${x-r+6}" y="${y-r+6}" width="${(r-6)*2}" height="${(r-6)*2}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>` : '';
      const placeholder = !img ? `
        <path d="M${x-40} ${y-44} l-12 8-10 16 18 10v38c0 6 4 10 10 10h68c6 0 10-4 10-10V${y-10}l18-10-10-16-12-8-16 12h-8l-16-12z" fill="${ring}" opacity="0.9"/>
        <text x="${x}" y="${y+18}" text-anchor="middle" font-size="54" font-weight="900" fill="rgba(255,255,255,0.92)">?</text>
      ` : '';

      return `
        <g>
          <defs>
            <clipPath id="${clipId}"><circle cx="${x}" cy="${y}" r="${r-6}"/></clipPath>
          </defs>
          <circle cx="${x}" cy="${y}" r="${r}" fill="rgba(0,0,0,0.22)" stroke="${ring}" stroke-width="10"/>
          ${imgEl}
          ${placeholder}
          <text x="${x}" y="${y+102}" text-anchor="middle" font-size="28" font-weight="800" fill="rgba(255,255,255,0.92)">${esc(name)}</text>
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
