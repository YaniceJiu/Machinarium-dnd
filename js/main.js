// 圣状dnd 主站交互
(function () {
  'use strict';

  const CFG = window.CONFIG;
  const DATA = window.DATA || { stories: {}, status: {}, locations: {} };
  const SCENES = window.SCENES || { locContent: {}, shop: { street: {}, shops: {}, interior: {}, products: [] } };
  const POSITIONS = window.POSITIONS || { extra: {}, data: {} };

  // ---- 状态 ----
  const state = {
    expandedWeek: 'W1',
    selectedPoints: new Set(),
    selectedPlayers: new Set(),
    lastPointId: null,
    mode: 'concise',            // 'concise' | 'full'
    view: { s: 1, tx: 0, ty: 0 },
  };

  // ---- 便捷查找 ----
  const locById = {};
  CFG.locations.forEach((l) => { locById[l.id] = l; });
  const playerById = {};
  CFG.players.forEach((p) => { playerById[p.id] = p; });

  const allPoints = [];          // 按顺序展开的时间点 {id,label,weekId}
  const weekById = {};
  CFG.timeline.weeks.forEach((w) => {
    weekById[w.id] = w;
    w.points.forEach((p) => allPoints.push({ id: p.id, label: p.label, hint: p.hint, weekId: w.id }));
  });

  // ---- DOM ----
  const $ = (sel) => document.querySelector(sel);
  const timelineBar = $('#timelineBar');
  const world = $('#world');
  const viewport = $('#viewport');
  const mapStage = $('#mapStage');
  const playerListEl = $('#playerList');
  const storyListEl = $('#storyList');
  const attrPanel = $('#attrPanel');
  const sidebar = $('#sidebar');
  const sidebarHandle = $('#sidebarHandle');
  const modeSeg = $('#modeSeg');
  const locationModal = $('#locationModal');
  const lmBack = $('#lmBack');
  const lmTitle = $('#lmTitle');
  const lmText = $('#lmText');
  const lmScenes = $('#lmScenes');
  const lmProducts = $('#lmProducts');
  const lmToast = $('#lmToast');
  let routeLayer;

  // ================= 时间轴 =================
  function buildTimeline() {
    timelineBar.innerHTML = '';
    CFG.timeline.weeks.forEach((week) => {
      const wEl = document.createElement('div');
      wEl.className = 'week';
      wEl.dataset.week = week.id;

      const title = document.createElement('span');
      title.className = 'week-title';
      title.textContent = week.label;
      wEl.appendChild(title);

      const pointsEl = document.createElement('div');
      pointsEl.className = 'week-points';
      wEl.appendChild(pointsEl);

      wEl.addEventListener('click', () => {
        state.expandedWeek = (state.expandedWeek === week.id) ? null : week.id;
        renderTimeline();
      });

      timelineBar.appendChild(wEl);
    });
    renderTimeline();
  }

  function renderTimeline() {
    const weeks = timelineBar.querySelectorAll('.week');
    weeks.forEach((wEl) => {
      const week = weekById[wEl.dataset.week];
      const isExpanded = state.expandedWeek === week.id;
      wEl.classList.toggle('expanded', isExpanded);

      const pointsEl = wEl.querySelector('.week-points');
      pointsEl.innerHTML = '';

      if (!isExpanded) return;

      if (week.points.length === 0) {
        const hint = document.createElement('span');
        hint.className = 'week-empty-hint';
        hint.textContent = '暂无内容';
        pointsEl.appendChild(hint);
        return;
      }

      week.points.forEach((p) => {
        const pEl = document.createElement('div');
        pEl.className = 'point' + (state.selectedPoints.has(p.id) ? ' selected' : '');
        pEl.innerHTML =
          `<span class="p-label">${p.label}</span>` +
          (p.hint ? `<span class="p-hint">${p.hint}</span>` : '');
        pEl.addEventListener('click', (e) => {
          e.stopPropagation();
          togglePoint(p.id);
        });
        pointsEl.appendChild(pEl);
      });
    });
  }

  function togglePoint(id) {
    if (state.selectedPoints.has(id)) {
      state.selectedPoints.delete(id);
      if (state.lastPointId === id) state.lastPointId = null;
    } else {
      state.selectedPoints.add(id);
      state.lastPointId = id;
    }
    renderTimeline();
    renderMarkers();
    renderStory();
    renderAttr();
  }

  // 属性卡/故事共用的"当前关注时间点"
  function activePointId() {
    if (state.lastPointId && state.selectedPoints.has(state.lastPointId)) {
      return state.lastPointId;
    }
    // 取按时间顺序最后一个已选
    for (let i = allPoints.length - 1; i >= 0; i--) {
      if (state.selectedPoints.has(allPoints[i].id)) return allPoints[i].id;
    }
    return null;
  }

  // ================= 地图 / 平移缩放 =================
  function buildWorld() {
    // 地图图
    const mapImg = $('#mapImg');
    mapImg.src = CFG.map.src;

    // 绿线图层（画在图标下面）
    routeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    routeLayer.setAttribute('class', 'route-layer');
    routeLayer.setAttribute('width', CFG.map.w);
    routeLayer.setAttribute('height', CFG.map.h);
    world.appendChild(routeLayer);

    // 地点图标
    CFG.locations.forEach((loc) => {
      const img = document.createElement('img');
      img.className = 'loc-icon';
      img.src = loc.icon;
      img.style.left = loc.x + 'px';
      img.style.top = loc.y + 'px';
      img.style.width = (loc.w * loc.scale) + 'px';
      img.style.height = (loc.h * loc.scale) + 'px';
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        onLocationClick(loc.id);
      });
      world.appendChild(img);
    });

    // 地名文字标签
    CFG.labels.forEach((lb) => {
      const el = document.createElement('div');
      el.className = 'map-label';
      el.textContent = lb.text;
      el.style.left = lb.x + 'px';
      el.style.top = lb.y + 'px';
      world.appendChild(el);
    });
  }

  function fitView() {
    const rect = viewport.getBoundingClientRect();
    const s = Math.max(rect.width / CFG.map.w, rect.height / CFG.map.h); // cover：地图铺满全屏
    state.view.s = s;
    state.view.tx = (rect.width - CFG.map.w * s) / 2;
    state.view.ty = (rect.height - CFG.map.h * s) / 2;
    applyView();
  }

  function applyView() {
    world.style.transform = `translate(${state.view.tx}px, ${state.view.ty}px) scale(${state.view.s})`;
  }

  function initPanZoom() {
    let dragging = false;
    let moved = false;
    let sx = 0, sy = 0, ox = 0, oy = 0;

    viewport.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      // 点图标/标记时不抓取指针，让图标的 click 事件正常触发
      if (e.target.closest('.loc-icon') || e.target.closest('.marker')) return;
      dragging = true;
      moved = false;
      sx = e.clientX; sy = e.clientY;
      ox = state.view.tx; oy = state.view.ty;
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add('dragging');
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      state.view.tx = ox + dx;
      state.view.ty = oy + dy;
      applyView();
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove('dragging');
    };
    viewport.addEventListener('pointerup', end);
    viewport.addEventListener('pointercancel', end);

    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newS = Math.min(8, Math.max(0.15, state.view.s * factor));
      const wx = (px - state.view.tx) / state.view.s;
      const wy = (py - state.view.ty) / state.view.s;
      state.view.tx = px - wx * newS;
      state.view.ty = py - wy * newS;
      state.view.s = newS;
      applyView();
    }, { passive: false });
  }

  // ================= 玩家位置标记（含绿线） =================
  function resolveAnchor(placeKey) {
    if (POSITIONS.extra && POSITIONS.extra[placeKey]) return POSITIONS.extra[placeKey];
    const loc = locById[placeKey];
    if (!loc) return null;
    return { x: loc.x, y: loc.y, lift: loc.h * loc.scale + 8 };
  }

  function placeMarker(player, p, x, y) {
    const marker = document.createElement('div');
    marker.className = 'marker';
    marker.style.left = x + 'px';
    marker.style.top = y + 'px';
    marker.title = `${player.name} · ${p.label}`;
    marker.innerHTML =
      `<div class="dot" style="background:${player.color}"></div>` +
      `<div class="m-time">${p.label}</div>`;
    world.appendChild(marker);
  }

  function renderMarkers() {
    world.querySelectorAll('.marker').forEach((m) => m.remove());
    if (routeLayer) routeLayer.innerHTML = '';

    if (state.selectedPlayers.size === 0 || state.selectedPoints.size === 0) return;

    const selectedPoints = allPoints.filter((p) => state.selectedPoints.has(p.id));
    const byLoc = {};    // 地点键 -> [{player, p, a}]
    const byRoute = {};  // 'from->to' -> [{player, p, a, b}]

    state.selectedPlayers.forEach((pid) => {
      const player = playerById[pid];
      selectedPoints.forEach((p) => {
        const pos = POSITIONS.data[`${pid}@${p.id}`];
        if (!pos) return;
        if (pos.from && pos.to) {
          const a = resolveAnchor(pos.from);
          const b = resolveAnchor(pos.to);
          if (!a || !b) return;
          const key = pos.from + '->' + pos.to;
          (byRoute[key] = byRoute[key] || []).push({ player, p, a, b });
        } else if (pos.loc) {
          const a = resolveAnchor(pos.loc);
          if (!a) return;
          (byLoc[pos.loc] = byLoc[pos.loc] || []).push({ player, p, a });
        }
      });
    });

    // 绿线 + 中点标记
    Object.keys(byRoute).forEach((key) => {
      const entries = byRoute[key];
      const a = entries[0].a, b = entries[0].b;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x);
      line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x);
      line.setAttribute('y2', b.y);
      line.setAttribute('class', 'route-line');
      routeLayer.appendChild(line);
      const n = entries.length;
      entries.forEach((e, i) => {
        const off = (i - (n - 1) / 2) * 22;
        placeMarker(e.player, e.p, (a.x + b.x) / 2 + off, (a.y + b.y) / 2);
      });
    });

    // 单点标记（按地点分组铺开，标在图标上方）
    Object.keys(byLoc).forEach((key) => {
      const entries = byLoc[key];
      const n = entries.length;
      entries.forEach((e, i) => {
        const off = (i - (n - 1) / 2) * 22;
        placeMarker(e.player, e.p, e.a.x + off, e.a.y - (e.a.lift || 0));
      });
    });
  }

  // ================= 右侧栏：玩家 =================
  function buildPlayerList() {
    CFG.players.forEach((p) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      chip.dataset.pid = p.id;
      chip.innerHTML = `<span class="dot" style="background:${p.color}"></span>${p.name}`;
      chip.addEventListener('click', () => {
        if (state.selectedPlayers.has(p.id)) state.selectedPlayers.delete(p.id);
        else state.selectedPlayers.add(p.id);
        renderPlayerList();
        renderMarkers();
        renderStory();
        renderAttr();
      });
      playerListEl.appendChild(chip);
    });
    renderPlayerList();
  }

  function renderPlayerList() {
    playerListEl.querySelectorAll('.player-chip').forEach((chip) => {
      chip.classList.toggle('selected', state.selectedPlayers.has(chip.dataset.pid));
    });
    $('#selectAllBtn').textContent =
      state.selectedPlayers.size === CFG.players.length ? '全不选' : '全选';
  }

  $('#selectAllBtn').addEventListener('click', () => {
    const allSelected = state.selectedPlayers.size === CFG.players.length;
    state.selectedPlayers = new Set(allSelected ? [] : CFG.players.map((p) => p.id));
    renderPlayerList();
    renderMarkers();
    renderStory();
    renderAttr();
  });

  // ================= 右侧栏：故事 =================
  function renderStory() {
    storyListEl.innerHTML = '';
    if (state.selectedPlayers.size === 0 || state.selectedPoints.size === 0) {
      storyListEl.innerHTML = '<div id="storyEmpty">请选择玩家和时间点</div>';
      return;
    }
    const selectedPoints = allPoints.filter((p) => state.selectedPoints.has(p.id));
    let rendered = 0;

    CFG.players.forEach((player) => {
      if (!state.selectedPlayers.has(player.id)) return;
      selectedPoints.forEach((p) => {
        const story = DATA.stories[`${player.id}@${p.id}`];
        if (!story) return;
        rendered++;
        const locName = (story.loc && locById[story.loc]) ? locById[story.loc].name : (story.loc || '');
        const text = state.mode === 'full' ? (story.full || story.concise) : (story.concise || story.full);
        const block = document.createElement('div');
        block.className = 'story-block';
        block.innerHTML =
          `<div class="sb-head">` +
            `<span class="dot" style="background:${player.color}"></span>` +
            `<span class="who">${player.name}</span>` +
            `<span class="time-chip">${p.label}</span>` +
            (locName ? `<span class="loc-name">@ ${locName}</span>` : '') +
          `</div>` +
          (text ? `<p>${text}</p>` : `<div class="no-story">暂无故事</div>`);
        storyListEl.appendChild(block);
      });
    });

    if (rendered === 0) {
      storyListEl.innerHTML = '<div id="storyEmpty">所选玩家在所选时间点暂无故事</div>';
    }
  }

  // ================= 左侧属性卡 =================
  function renderAttr() {
    attrPanel.innerHTML = '';
    if (state.selectedPlayers.size === 0 || state.selectedPoints.size === 0) return;

    const ap = activePointId();
    if (!ap) return;

    CFG.players.forEach((player) => {
      if (!state.selectedPlayers.has(player.id)) return;
      const status = DATA.status[`${player.id}@${ap}`];

      const card = document.createElement('div');
      card.className = 'attr-card';

      let body = '';
      if (status) {
        const items = (status.items && status.items.length)
          ? status.items.join('、')
          : '无';
        body =
          `<div class="ac-head">` +
            `<span class="dot" style="background:${player.color}"></span>` +
            `<span>${player.name}</span>` +
            `<span class="ac-time">${ap}</span>` +
          `</div>` +
          `<div class="ac-grid">` +
            `<span class="k">财富</span><span class="v">${status.wealth ?? '?'}</span>` +
            `<span class="k">力量</span><span class="v">${status.strength ?? '?'}</span>` +
            `<span class="k">魅力</span><span class="v">${status.charm ?? '?'}</span>` +
            `<span class="k">洞察</span><span class="v">${status.insight ?? '?'}</span>` +
          `</div>` +
          `<div class="ac-row"><span class="k">金钱：</span>${status.money ?? '?'}</div>` +
          `<div class="ac-row"><span class="k">血量：</span>${status.hp ?? '?'}</div>` +
          `<div class="ac-row"><span class="k">所有物：</span><span class="ac-items">${items}</span></div>`;
      } else {
        body =
          `<div class="ac-head">` +
            `<span class="dot" style="background:${player.color}"></span>` +
            `<span>${player.name}</span>` +
            `<span class="ac-time">${ap}</span>` +
          `</div>` +
          `<div class="ac-none">暂无该时间点的状态数据</div>`;
      }
      card.innerHTML = body;
      attrPanel.appendChild(card);
    });
  }

  // ================= 精简/完整切换 =================
  modeSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    state.mode = btn.dataset.mode;
    modeSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    renderStory();
  });

  // ================= 地点弹窗（场景/商店/文字 统一） =================
  let toastTimer = null;

  function openModal() { locationModal.classList.add('open'); }

  function resetModal() {
    lmBack.style.display = 'none';
    lmText.innerHTML = '';
    lmScenes.innerHTML = '';
    lmProducts.innerHTML = '';
  }

  function closeModal() {
    locationModal.classList.remove('open');
    resetModal();
  }

  function onLocationClick(id) {
    const content = SCENES.locContent[id];
    if (content && content.type === 'shop') { openShopStreet(); return; }
    if (content && content.type === 'scene') { openSceneContent(content); return; }
    openLocationText(id);
  }

  // 文字卡（无场景图地点）
  function openLocationText(id) {
    openModal(); resetModal();
    const loc = locById[id];
    const info = DATA.locations[id] || {};
    lmTitle.textContent = info.title || (loc ? loc.name : id);
    lmText.innerHTML = info.text
      ? `<div class="lm-text">${info.text}</div>`
      : `<div class="lm-empty">暂无该地点的图文信息</div>`;
  }

  // 场景图（单图或竖排多图，带小标题分隔）
  function openSceneContent(content) {
    openModal(); resetModal();
    lmTitle.textContent = content.title || '';
    content.images.forEach((im) => {
      if (im.title) {
        const sub = document.createElement('div');
        sub.className = 'lm-subtitle';
        sub.textContent = im.title;
        lmScenes.appendChild(sub);
      }
      const img = document.createElement('img');
      img.className = 'lm-scene-img';
      img.src = im.img;
      lmScenes.appendChild(img);
    });
  }

  // ===== 商店互动（在弹窗框内） =====
  function openShopStreet() {
    openModal(); resetModal();
    lmBack.style.display = 'none';
    renderShopScene(SCENES.shop.street);
  }

  function enterShop(shopId) {
    const shop = SCENES.shop.shops[shopId];
    if (!shop) return;
    if (!shop.interior) { toast(shop.name + ' 暂未开放'); return; }
    lmBack.style.display = 'inline-block';
    renderShopScene(SCENES.shop.interior);
  }

  function renderShopScene(scene) {
    lmTitle.textContent = scene.title;
    lmText.innerHTML = '';
    lmScenes.innerHTML = '';
    lmProducts.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'lm-scene';
    const img = document.createElement('img');
    img.src = scene.img;
    wrap.appendChild(img);
    (scene.hotspots || []).forEach((h) => {
      const b = document.createElement('button');
      b.className = 'hotspot';
      b.style.left = h.x + '%';
      b.style.top = h.y + '%';
      b.style.width = (h.w || 12) + '%';
      b.style.height = (h.h || 14) + '%';
      b.textContent = h.label || '进入';
      b.addEventListener('click', () => onShopHotspot(h));
      wrap.appendChild(b);
    });
    lmScenes.appendChild(wrap);
  }

  function onShopHotspot(h) {
    if (h.action === 'shelf') { openProducts(); return; }
    if (h.shop) { enterShop(h.shop); return; }
  }

  function openProducts() {
    // 只渲染一次；之后再点货架，只滚动到商品处
    if (lmProducts.childElementCount === 0) {
      const title = document.createElement('div');
      title.className = 'lm-products-title';
      title.textContent = '货架商品';
      lmProducts.appendChild(title);
      const list = document.createElement('div');
      list.className = 'lm-products-list';
      SCENES.shop.products.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML =
          `<img src="${p.img}" alt="${p.name}">` +
          `<div class="p-info">` +
            `<div class="p-name">${p.name}</div>` +
            `<div class="p-price">${p.price} 块</div>` +
          `</div>`;
        list.appendChild(card);
      });
      lmProducts.appendChild(list);
    }
    lmProducts.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toast(msg) {
    lmToast.textContent = msg;
    lmToast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => lmToast.classList.remove('show'), 1600);
  }

  lmBack.addEventListener('click', openShopStreet);
  $('#lmClose').addEventListener('click', closeModal);
  locationModal.addEventListener('click', (e) => {
    if (e.target === locationModal) closeModal();
  });

  // ================= 侧栏折叠 =================
  function updateSidebarHandle() {
    const collapsed = sidebar.classList.contains('collapsed');
    sidebarHandle.textContent = collapsed ? '◀' : '▶';
    // 让手柄贴着侧栏左边缘（用侧栏实际宽度，避免 min-width 时错位）
    sidebarHandle.style.right = collapsed ? '0px' : (sidebar.offsetWidth + 'px');
  }
  sidebarHandle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    updateSidebarHandle();
  });

  // ================= 启动 =================
  buildTimeline();
  buildWorld();
  buildPlayerList();
  initPanZoom();
  updateSidebarHandle();

  window.addEventListener('resize', () => {
    updateSidebarHandle();
  });
  requestAnimationFrame(fitView);
  fitView();
})();
