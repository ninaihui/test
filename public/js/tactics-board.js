/*
  Tactics Board (Team Split)
  - Vertical full pitch split into 1..4 horizontal bands (team 1..N)
  - Bench area for unassigned (teamNo = null)
  - Drag/drop on mobile + desktop (pointer-based)
  - Save to DB: PATCH /activities/:id/teams
*/

(function () {
  const ROOT_ID = 'tacticsBoard';
  const TOKEN_KEY = 'authToken';

  const root = document.getElementById(ROOT_ID);
  if (!root) return;

  const bandsEl = root.querySelector('#teamBands');
  const saveBtn = root.querySelector('#btnSaveTeams');
  const saveStatus = root.querySelector('#saveStatus');
  const readOnlyHint = root.querySelector('#tacticsReadOnlyHint');
  const positionsLink = root.querySelector('#btnOpenPositions');
  // positionsLink removed in merged UI; keep optional

  const activityId = (function () {
    const p = new URLSearchParams(window.location.search);
    return p.get('activityId');
  })();

  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  function showStatus(text) {
    if (!saveStatus) return;
    saveStatus.textContent = text;
    saveStatus.classList.add('show');
    clearTimeout(showStatus._t);
    showStatus._t = setTimeout(() => saveStatus.classList.remove('show'), 1800);
  }

  function safeJson(res) {
    return res.text().then((t) => {
      try { return t ? JSON.parse(t) : null; } catch (e) { return null; }
    });
  }

  function getDefaultTeamNames(count) {
    if (count === 1) return ['队伍'];
    if (count === 2) return ['红队', '蓝队'];
    if (count === 3) return ['红队', '蓝队', '紫队'];
    return ['红队', '蓝队', '紫队', '黄队'];
  }

  let state = {
    teamCount: 2,
    teamNames: ['红队', '蓝队'],
    canEdit: false,
    roster: [], // [{userId, teamNo, user:{username,avatarUrl}}]
    dirty: false,
  };

  function render() {
    if (!bandsEl) return;
    bandsEl.innerHTML = '';

    const tc = Math.max(1, Math.min(4, Number(state.teamCount) || 2));
    let names = Array.isArray(state.teamNames) ? state.teamNames.slice(0) : [];
    const defaults = getDefaultTeamNames(tc);
    while (names.length < tc) names.push(defaults[names.length] || ('队伍' + (names.length + 1)));
    if (names.length > tc) names = names.slice(0, tc);

    // Group roster by teamNo
    const byTeam = {};
    for (let i = 1; i <= tc; i++) byTeam[i] = [];
    const bench = [];

    (state.roster || []).forEach((r) => {
      const t = r.teamNo;
      if (t && t >= 1 && t <= tc) byTeam[t].push(r);
      else bench.push(r);
    });

    function mkToken(r) {
      const el = document.createElement('div');
      el.className = 'player-token';
      el.setAttribute('data-user-id', r.userId);
      el.setAttribute('data-team-no', (r.teamNo != null ? String(r.teamNo) : ''));

      // Tap-to-cycle team (helps on mobile when drag is hard)
      el.addEventListener('click', (ev) => {
        if (!state.canEdit) return;
        // If click comes right after a drag end, ignore
        if (Date.now() - lastDropAt < 250) return;
        const uid = el.getAttribute('data-user-id');
        if (!uid) return;
        cycleUserTeam(uid);
        ev.stopPropagation();
      });

      const hasAvatar = !!(r.user && r.user.avatarUrl);
      let avatarEl;
      if (hasAvatar) {
        const img = document.createElement('img');
        img.className = 'avatar-media';
        img.src = r.user.avatarUrl;
        img.alt = r.user && r.user.username ? r.user.username : 'player';
        avatarEl = img;
      } else {
        const ph = document.createElement('div');
        ph.className = 'avatar-media avatar-placeholder';
        ph.textContent = '?';
        ph.setAttribute('aria-label', 'no avatar');
        avatarEl = ph;
      }

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = (r.user && r.user.username) ? r.user.username : r.userId;

      el.appendChild(avatarEl);
      el.appendChild(name);

      if (!state.canEdit) {
        el.style.cursor = 'default';
      } else {
        enableDrag(el);
      }
      return el;
    }

    function mkBand(teamNo, title) {
      const band = document.createElement('div');
      band.className = 'team-band';
      band.setAttribute('data-team-no', String(teamNo));

      const header = document.createElement('div');
      header.className = 'team-band-header';

      const left = document.createElement('div');

      const titleRow = document.createElement('div');
      titleRow.className = 'team-band-title-row';

      const h = document.createElement('div');
      h.className = 'team-band-title';
      h.textContent = title;

      const badge = document.createElement('span');
      badge.className = 'team-count-badge';
      badge.textContent = String((byTeam[teamNo] || []).length);

      titleRow.appendChild(h);
      titleRow.appendChild(badge);

      const sub = document.createElement('div');
      sub.className = 'team-band-sub';
      sub.textContent = state.canEdit ? '拖拽到这里 / 点击队员可切换队伍' : '只读';

      left.appendChild(titleRow);
      left.appendChild(sub);

      header.appendChild(left);

      const drop = document.createElement('div');
      drop.className = 'team-band-drop';
      drop.setAttribute('data-drop-team-no', String(teamNo));

      (byTeam[teamNo] || []).forEach((r) => drop.appendChild(mkToken(r)));

      band.appendChild(header);
      band.appendChild(drop);

      return band;
    }

    // Create bands (top to bottom = team 1..N)
    for (let i = 1; i <= tc; i++) {
      bandsEl.appendChild(mkBand(i, names[i - 1] || ('队伍' + i)));
    }

    // Bench lives in roster panel
    renderBench(bench);

    // Read-only UI
    if (readOnlyHint) {
      readOnlyHint.classList.toggle('hidden', !!state.canEdit);
    }
    if (saveBtn) {
      saveBtn.disabled = !state.canEdit;
      saveBtn.classList.toggle('opacity-50', !state.canEdit);
      saveBtn.classList.toggle('cursor-not-allowed', !state.canEdit);
    }

    // Update roster headings with counts
    const benchCount = bench.length;
    const rosterTitleEls = document.querySelectorAll('.roster-title');
    rosterTitleEls.forEach((el) => {
      if (!el) return;
      // Only update texts that contain 未选位置/候补
      const t = (el.textContent || '').trim();
      if (t.includes('未选位置') || t.includes('候补')) {
        el.textContent = `未选位置（${benchCount}）`;
      }
    });

    // Dirty indicator
    if (state.dirty) showStatus('未保存');

  }

  function renderBench(benchList) {
    // Desktop + mobile containers
    const d = document.getElementById('unassignedUsers');
    const m = document.getElementById('unassignedUsersMobile');
    const wrapD = document.getElementById('unassignedWrap');
    const wrapM = document.getElementById('unassignedWrapMobile');
    const emptyD = document.getElementById('unassignedEmptyHint');
    const emptyM = document.getElementById('unassignedEmptyHintMobile');

    function fill(container) {
      if (!container) return;
      container.innerHTML = '';
      benchList.forEach((r) => {
        const token = document.createElement('div');
        token.className = 'unassigned-user';
        token.setAttribute('data-user-id', r.userId);
        token.setAttribute('data-team-no', (r.teamNo != null ? String(r.teamNo) : ''));

        const hasAvatar = !!(r.user && r.user.avatarUrl);
        let avatarEl;
        if (hasAvatar) {
          const img = document.createElement('img');
          img.className = 'player-avatar avatar-media';
          img.src = r.user.avatarUrl;
          img.alt = r.user && r.user.username ? r.user.username : 'player';
          avatarEl = img;
        } else {
          const ph = document.createElement('div');
          ph.className = 'player-avatar avatar-media avatar-placeholder';
          ph.textContent = '?';
          ph.setAttribute('aria-label', 'no avatar');
          avatarEl = ph;
        }

        const name = document.createElement('div');
        name.className = 'player-label';
        name.textContent = (r.user && r.user.username) ? r.user.username : r.userId;

        token.appendChild(avatarEl);
        token.appendChild(name);

        if (state.canEdit) enableDrag(token);
        else token.style.cursor = 'default';

        container.appendChild(token);
      });
    }

    const has = benchList && benchList.length;
    if (wrapD) wrapD.classList.toggle('hidden', !has);
    if (wrapM) wrapM.classList.toggle('hidden', !has);
    if (emptyD) emptyD.classList.toggle('hidden', !!has);
    if (emptyM) emptyM.classList.toggle('hidden', !!has);

    fill(d);
    fill(m);
  }

  // ===== Drag/Drop (Pointer-based) =====

  let drag = null;
  let lastDropAt = 0;

  function findDropTarget(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const drop = el.closest('[data-drop-team-no], #unassignedUsers, #unassignedUsersMobile');
    return drop;
  }

  function clearHighlights() {
    document.querySelectorAll('.drop-highlight').forEach((n) => n.classList.remove('drop-highlight'));
  }

  function enableDrag(el) {
    el.addEventListener('pointerdown', (ev) => {
      if (!state.canEdit) return;
      ev.preventDefault();

      const target = ev.currentTarget;
      const rect = target.getBoundingClientRect();

      drag = {
        source: target,
        pointerId: ev.pointerId,
        startX: ev.clientX,
        startY: ev.clientY,
        offsetX: ev.clientX - rect.left,
        offsetY: ev.clientY - rect.top,
        ghost: null,
      };

      // ghost
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

    el.addEventListener('pointermove', (ev) => {
      if (!drag || drag.pointerId !== ev.pointerId) return;
      if (drag.ghost) {
        drag.ghost.style.left = (ev.clientX - drag.offsetX) + 'px';
        drag.ghost.style.top = (ev.clientY - drag.offsetY) + 'px';
      }

      clearHighlights();
      const drop = findDropTarget(ev.clientX, ev.clientY);
      if (drop && drop.getAttribute) {
        drop.classList.add('drop-highlight');
      }
    });

    el.addEventListener('pointerup', (ev) => {
      if (!drag || drag.pointerId !== ev.pointerId) return;
      finishDrop(ev.clientX, ev.clientY);
      try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch (e) {}
    });

    el.addEventListener('pointercancel', (ev) => {
      if (!drag || drag.pointerId !== ev.pointerId) return;
      finishDrop(null, null, true);
      try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch (e) {}
    });
  }

  function finishDrop(x, y, cancelled) {
    clearHighlights();
    if (!drag) return;

    const source = drag.source;
    const ghost = drag.ghost;

    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    if (source) source.classList.remove('dragging');

    if (!cancelled && x != null && y != null) {
      const drop = findDropTarget(x, y);
      if (drop) {
        // Determine roster item by userId
        const userId = source.getAttribute('data-user-id');
        if (userId) {
          if (drop.id === 'unassignedUsers' || drop.id === 'unassignedUsersMobile') {
            setUserTeamNo(userId, null);
          } else {
            const tn = parseInt(drop.getAttribute('data-drop-team-no') || '0', 10);
            setUserTeamNo(userId, (tn >= 1 ? tn : null));
          }
        }
      }
    }

    lastDropAt = Date.now();
    drag = null;
  }

  function setUserTeamNo(userId, teamNo) {
    const tc = Math.max(1, Math.min(4, Number(state.teamCount) || 2));
    if (teamNo != null && (teamNo < 1 || teamNo > tc)) return;

    let changed = false;
    state.roster = (state.roster || []).map((r) => {
      if (r.userId === userId) {
        if ((r.teamNo ?? null) !== (teamNo ?? null)) changed = true;
        return { ...r, teamNo: teamNo };
      }
      return r;
    });
    if (changed) {
      state.dirty = true;
    }
    render();
    if (changed) scheduleAutoSave();
  }

  function cycleUserTeam(userId) {
    const tc = Math.max(1, Math.min(4, Number(state.teamCount) || 2));
    const cur = (state.roster || []).find((r) => r.userId === userId);
    const curNo = cur ? (cur.teamNo ?? null) : null;
    // bench -> team1 -> team2 ... -> teamN -> bench
    let next = null;
    if (curNo == null) next = 1;
    else if (curNo >= 1 && curNo < tc) next = curNo + 1;
    else next = null;
    setUserTeamNo(userId, next);
  }

  // ===== Data =====

  async function load() {
    if (!activityId) {
      showStatus('缺少 activityId');
      return;
    }

    // Use /activities/:id/teams for roster + edit permission + team config
    const res = await fetch('/activities/' + encodeURIComponent(activityId) + '/teams', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) {
      const body = await safeJson(res);
      showStatus((body && body.message) ? body.message : '加载失败');
      return;
    }

    const data = await res.json();
    state.teamCount = data.teamCount || 2;
    state.teamNames = data.teamNames || [];
    state.canEdit = !!data.canEdit;
    state.roster = data.roster || [];
    state.dirty = false;

    // Subtitle
    const subtitleEl = document.getElementById('tacticsSubtitle');
    if (subtitleEl) subtitleEl.textContent = '拖拽分队（会保存到数据库）';

    // positions page link removed (merged UI)

    render();
  }

  // ===== Save (manual + auto) =====

  let autoSaveTimer = null;
  let saving = false;
  let pendingSave = false;

  function scheduleAutoSave() {
    if (!state.canEdit) return;
    if (!state.dirty) return;
    if (!activityId) return;

    // Debounce: user may drag multiple times
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      // Only auto-save when still dirty
      if (!state.dirty) return;
      save({ mode: 'auto' }).catch(() => {
        // save() already shows status
      });
    }, 1200);
  }

  async function save(opts) {
    opts = opts || { mode: 'manual' };
    if (!state.canEdit) return;
    if (!activityId) return;

    if (saving) {
      pendingSave = true;
      return;
    }

    const tc = Math.max(1, Math.min(4, Number(state.teamCount) || 2));

    const assignments = (state.roster || []).map((r) => {
      const t = r.teamNo;
      if (t && t >= 1 && t <= tc) return { userId: r.userId, teamNo: t };
      return { userId: r.userId };
    });

    saving = true;
    pendingSave = false;

    if (opts.mode === 'auto') showStatus('自动保存中…');
    else showStatus('保存中…');

    if (saveBtn) saveBtn.disabled = true;

    try {
      const res = await fetch('/activities/' + encodeURIComponent(activityId) + '/teams', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignments }),
      });
      const body = await safeJson(res);
      if (!res.ok) {
        showStatus((body && body.message) ? body.message : '保存失败');
        return;
      }

      state.dirty = false;
      showStatus('已保存');

      // Refresh from server (keeps authoritative ordering & permissions)
      await load();
    } catch (e) {
      showStatus('保存失败（网络错误）');
      // keep dirty = true
    } finally {
      saving = false;
      if (saveBtn) saveBtn.disabled = !state.canEdit;

      if (pendingSave && state.dirty) {
        // Run one more save cycle if changes happened while saving
        pendingSave = false;
        scheduleAutoSave();
      }
    }
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => save({ mode: 'manual' }));
  }

  // Warn on leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (!state.canEdit) return;
    if (!state.dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  load().catch(() => showStatus('加载失败'));
})();
