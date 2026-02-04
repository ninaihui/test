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

      const img = document.createElement('img');
      img.src = (r.user && r.user.avatarUrl) ? r.user.avatarUrl : '/assets/default-avatar.png';
      img.alt = r.user && r.user.username ? r.user.username : 'player';

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = (r.user && r.user.username) ? r.user.username : r.userId;

      el.appendChild(img);
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
      const h = document.createElement('div');
      h.className = 'team-band-title';
      h.textContent = title;
      const sub = document.createElement('div');
      sub.className = 'team-band-sub';
      sub.textContent = '拖拽到这里';
      left.appendChild(h);
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

        const img = document.createElement('img');
        img.className = 'player-avatar';
        img.src = (r.user && r.user.avatarUrl) ? r.user.avatarUrl : '/assets/default-avatar.png';
        img.alt = r.user && r.user.username ? r.user.username : 'player';

        const name = document.createElement('div');
        name.className = 'player-label';
        name.textContent = (r.user && r.user.username) ? r.user.username : r.userId;

        token.appendChild(img);
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

    drag = null;
  }

  function setUserTeamNo(userId, teamNo) {
    const tc = Math.max(1, Math.min(4, Number(state.teamCount) || 2));
    if (teamNo != null && (teamNo < 1 || teamNo > tc)) return;

    state.roster = (state.roster || []).map((r) => {
      if (r.userId === userId) return { ...r, teamNo: teamNo };
      return r;
    });
    render();
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

    // Subtitle
    const subtitleEl = document.getElementById('tacticsSubtitle');
    if (subtitleEl) subtitleEl.textContent = '拖拽分队（会保存到数据库）';

    render();
  }

  async function save() {
    if (!state.canEdit) return;
    if (!activityId) return;

    const tc = Math.max(1, Math.min(4, Number(state.teamCount) || 2));

    const assignments = (state.roster || []).map((r) => {
      const t = r.teamNo;
      if (t && t >= 1 && t <= tc) return { userId: r.userId, teamNo: t };
      return { userId: r.userId };
    });

    saveBtn.disabled = true;
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
      showStatus('已保存');
      // Refresh from server
      await load();
    } finally {
      saveBtn.disabled = !state.canEdit;
    }
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', save);
  }

  load().catch(() => showStatus('加载失败'));
})();
