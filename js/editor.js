// 圣状dnd 摆放编辑器（一次性工具，用完可删）
(function () {
  'use strict';

  const CFG = window.CONFIG;
  const $ = (sel) => document.querySelector(sel);

  const world = $('#world');
  const viewport = $('#viewport');
  const mapImg = $('#mapImg');
  const tbSel = $('#tbSel');
  const tbScale = $('#tbScale');
  const tbScaleVal = $('#tbScaleVal');
  const tbText = $('#tbText');
  const modeSeg = $('#modeSeg');
  const exportPanel = $('#exportPanel');
  const exportText = $('#exportText');

  const view = { s: 1, tx: 0, ty: 0 };
  let mode = 'icon'; // 'icon' 摆图标 | 'label' 标文字

  // 可编辑对象
  const icons = [];   // { loc, el }
  const labels = [];  // { el, text, x, y }

  let selection = null; // { type:'icon'|'label', ref }

  // ================= 构建 =================
  function build() {
    CFG.locations.forEach((loc) => {
      const img = document.createElement('img');
      img.className = 'loc-icon editable';
      img.src = loc.icon;
      applyIconStyle(img, loc);
      img.addEventListener('pointerdown', (e) => {
        if (mode !== 'icon') return;
        startDrag(e, { type: 'icon', ref: loc, el: img });
      });
      world.appendChild(img);
      icons.push({ loc, el: img });
    });

    CFG.labels.forEach((lb) => {
      createLabelEl(lb.text, lb.x, lb.y);
    });
  }

  function applyIconStyle(img, loc) {
    img.style.left = loc.x + 'px';
    img.style.top = loc.y + 'px';
    img.style.width = (loc.w * loc.scale) + 'px';
    img.style.height = (loc.h * loc.scale) + 'px';
  }

  function createLabelEl(text, x, y) {
    const el = document.createElement('div');
    el.className = 'map-label editable';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    world.appendChild(el);
    const rec = { el, text, x, y };
    labels.push(rec);
    el.addEventListener('pointerdown', (e) => {
      if (mode !== 'label') return;
      startDrag(e, { type: 'label', ref: rec, el });
    });
    return rec;
  }

  // ================= 拖拽 =================
  function startDrag(e, item) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    select(item);
    const startX = e.clientX, startY = e.clientY;
    const base = { x: item.ref.x, y: item.ref.y };
    let moved = false;

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / view.s;
      const dy = (ev.clientY - startY) / view.s;
      if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 3) moved = true;
      const nx = base.x + dx, ny = base.y + dy;
      if (item.type === 'icon') {
        item.ref.x = Math.round(nx);
        item.ref.y = Math.round(ny);
        applyIconStyle(item.el, item.ref);
      } else {
        item.ref.x = Math.round(nx);
        item.ref.y = Math.round(ny);
        item.el.style.left = item.ref.x + 'px';
        item.el.style.top = item.ref.y + 'px';
      }
    };
    const onUp = () => {
      viewport.removeEventListener('pointermove', onMove);
      viewport.removeEventListener('pointerup', onUp);
      viewport.removeEventListener('pointercancel', onUp);
      if (!moved && item.type === 'label') {
        tbText.focus();
        tbText.select();
      }
    };
    viewport.addEventListener('pointermove', onMove);
    viewport.addEventListener('pointerup', onUp);
    viewport.addEventListener('pointercancel', onUp);
  }

  // ================= 选中 =================
  function select(item) {
    selection = item;
    // 高亮
    world.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
    if (item.type === 'icon') {
      item.el.classList.add('selected');
      tbSel.textContent = `已选：${item.ref.name}（图标）`;
      tbScale.disabled = false;
      tbScale.value = item.ref.scale;
      tbScaleVal.textContent = item.ref.scale;
      tbText.value = '';
      tbText.disabled = true;
      tbText.placeholder = '（图标没有文字）';
    } else {
      item.el.classList.add('selected');
      tbSel.textContent = '已选：文字标签';
      tbScale.disabled = true;
      tbText.disabled = false;
      tbText.value = item.ref.text;
      tbText.placeholder = '输入标签文字';
    }
  }

  function deselect() {
    selection = null;
    world.querySelectorAll('.selected').forEach((el) => el.classList.remove('selected'));
    tbSel.textContent = '未选中';
    tbScale.disabled = true;
    tbText.disabled = true;
    tbText.value = '';
    tbText.placeholder = '选中文字标签后在这里改内容';
  }

  // 模式切换
  function setMode(m) {
    mode = m;
    deselect();
    modeSeg.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === m);
    });
    world.querySelectorAll('.loc-icon').forEach((el) => {
      el.classList.toggle('editable', m === 'icon');
      el.style.pointerEvents = m === 'icon' ? 'auto' : 'none';
    });
    world.querySelectorAll('.map-label').forEach((el) => {
      el.classList.toggle('editable', m === 'label');
    });
  }
  modeSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode]');
    if (btn) setMode(btn.dataset.mode);
  });

  // Delete/Backspace 删除选中的文字标签
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;
    if (selection && selection.type === 'label') {
      const rec = selection.ref;
      selection.el.remove();
      const i = labels.indexOf(rec);
      if (i >= 0) labels.splice(i, 1);
      deselect();
    }
  });

  // ================= 工具栏 =================
  tbScale.addEventListener('input', () => {
    const v = parseFloat(tbScale.value);
    tbScaleVal.textContent = v;
    if (selection && selection.type === 'icon') {
      selection.ref.scale = v;
      applyIconStyle(selection.el, selection.ref);
    }
  });

  tbText.addEventListener('input', () => {
    if (selection && selection.type === 'label') {
      selection.ref.text = tbText.value;
      selection.el.textContent = tbText.value;
    }
  });

  function addLabelAt(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const x = Math.round((clientX - rect.left - view.tx) / view.s);
    const y = Math.round((clientY - rect.top - view.ty) / view.s);
    const rec = createLabelEl('新地名', x, y);
    select({ type: 'label', ref: rec, el: rec.el });
    tbText.focus();
    tbText.select();
  }

  $('#btnAddLabel').addEventListener('click', () => {
    // 在地图中央（略微向下错开，避免重叠）创建一个标签
    const rect = viewport.getBoundingClientRect();
    const cx = ((rect.width / 2) - view.tx) / view.s;
    const cy = ((rect.height / 2) - view.ty) / view.s + labels.length * 28;
    const rec = createLabelEl('新地名', Math.round(cx), Math.round(cy));
    select({ type: 'label', ref: rec, el: rec.el });
    tbText.focus();
    tbText.select();
  });

  $('#btnDel').addEventListener('click', () => {
    if (!selection) return;
    if (selection.type === 'icon') {
      alert('地点图标不能删除（9 个图标都要摆）。');
      return;
    }
    const rec = selection.ref;
    selection.el.remove();
    const i = labels.indexOf(rec);
    if (i >= 0) labels.splice(i, 1);
    deselect();
  });

  // ================= 导出 =================
  $('#btnExport').addEventListener('click', () => {
    const out = {
      locations: icons.map(({ loc }) => ({ id: loc.id, x: loc.x, y: loc.y, scale: loc.scale })),
      labels: labels.map((l) => ({ text: l.text, x: l.x, y: l.y })),
    };
    exportText.value = JSON.stringify(out, null, 2);
    exportPanel.classList.add('open');
  });

  $('#btnCloseExport').addEventListener('click', () => exportPanel.classList.remove('open'));
  exportPanel.addEventListener('click', (e) => {
    if (e.target === exportPanel) exportPanel.classList.remove('open');
  });

  $('#btnCopy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(exportText.value);
      $('#btnCopy').textContent = '已复制 ✓';
      setTimeout(() => { $('#btnCopy').textContent = '复制'; }, 1500);
    } catch (err) {
      exportText.select();
      document.execCommand('copy');
      $('#btnCopy').textContent = '已复制 ✓';
      setTimeout(() => { $('#btnCopy').textContent = '复制'; }, 1500);
    }
  });

  // ================= 平移缩放（同主站） =================
  function fitView() {
    const rect = viewport.getBoundingClientRect();
    const s = Math.max(rect.width / CFG.map.w, rect.height / CFG.map.h); // cover：地图铺满全屏
    view.s = s;
    view.tx = (rect.width - CFG.map.w * s) / 2;
    view.ty = (rect.height - CFG.map.h * s) / 2;
    applyView();
  }
  function applyView() {
    world.style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`;
  }

  function initPanZoom() {
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
    viewport.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.editable')) return; // 图标/标签自己处理拖拽
      dragging = true;
      moved = false;
      sx = e.clientX; sy = e.clientY;
      ox = view.tx; oy = view.ty;
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      view.tx = ox + dx;
      view.ty = oy + dy;
      applyView();
    });
    viewport.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      if (!moved) {
        if (mode === 'label') addLabelAt(e.clientX, e.clientY);
        else deselect();
      }
    });
    viewport.addEventListener('pointercancel', () => { dragging = false; });

    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newS = Math.min(8, Math.max(0.15, view.s * factor));
      const wx = (px - view.tx) / view.s, wy = (py - view.ty) / view.s;
      view.tx = px - wx * newS;
      view.ty = py - wy * newS;
      view.s = newS;
      applyView();
    }, { passive: false });
  }

  build();
  initPanZoom();
  deselect();
  fitView();
})();
