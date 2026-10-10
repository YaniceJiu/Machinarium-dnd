// 股票看板（金融街）：4 条线同图，每天动一次（50% 上/下），DM 可设定某天方向
// 天数与群众板共用；价格累加连续；localStorage 持久化
(function () {
  'use strict';

  const BASE = 100;          // 每股初始价
  const PCT = 0.05;          // 每天涨跌幅上限（0~5% 随机）
  const TOTAL_DAYS = 12;     // 与群众板一致
  const LINES = [
    { id: 'port',  name: '港口运货',     color: '#e53935' },
    { id: 'arms',  name: '国家军火',     color: '#1e88e5' },
    { id: 'water', name: '生命之水外贸', color: '#8e24aa' },
    { id: 'sci',   name: '科研',         color: '#00897b' },
  ];
  const LS_KEY = 'machinarium_stock_v1';
  const CHART_H = 280;       // 图表 CSS 高度

  function makeDay(n) {
    return { day: n, locks: {}, signs: {}, mags: {}, price: {} };
  }
  function initState() {
    return { days: [makeDay(1)] };
  }
  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.days) && s.days.length) return s;
    } catch (e) { /* ignore */ }
    return null;
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  let state = load() || initState();

  // ---- 渲染期状态 ----
  let chartCanvas = null, legendEl = null, ctrlEl = null, actionsEl = null;
  let containerEl = null;
  let currentIdx = 0;

  function fmtPrice(n) {
    if (n === null || n === undefined) return '—';
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }
  function boardDays() {
    return (window.BOARD && window.BOARD.getDays) ? window.BOARD.getDays() : 1;
  }
  function syncLength() {
    while (state.days.length < boardDays()) state.days.push(makeDay(state.days.length + 1));
    while (state.days.length > boardDays() && state.days.length > 1) state.days.pop();
  }

  // 结算某天：锁定→上/下；无锁定且未定→50% 掷币；已定则保持；涨幅 0~5% 随机
  function resolveDay(idx) {
    const d = state.days[idx];
    if (!d) return;
    LINES.forEach((l) => {
      const lock = d.locks[l.id];
      if (lock === 'up') { d.signs[l.id] = 1; if (d.mags[l.id] === undefined) d.mags[l.id] = Math.random() * PCT; }
      else if (lock === 'down') { d.signs[l.id] = -1; if (d.mags[l.id] === undefined) d.mags[l.id] = Math.random() * PCT; }
      else if (d.signs[l.id] === undefined) { d.signs[l.id] = Math.random() < 0.5 ? 1 : -1; d.mags[l.id] = Math.random() * PCT; }
    });
  }

  function recomputePrices() {
    const prev = {};
    LINES.forEach((l) => { prev[l.id] = BASE; });
    state.days.forEach((d) => {
      d.price = d.price || {};
      d.mags = d.mags || {};
      LINES.forEach((l) => {
        const s = d.signs[l.id];
        if (s === undefined) { d.price[l.id] = null; return; }
        const mag = (d.mags[l.id] === undefined) ? PCT : d.mags[l.id];
        prev[l.id] = Math.round(prev[l.id] * (1 + s * mag) * 100) / 100;
        d.price[l.id] = prev[l.id];
      });
    });
  }

  function isToday(idx) { return idx === state.days.length - 1; }

  // 把某天里所有"未定"的线掷币（生成当天 / 结算兜底），涨幅 0~5% 随机
  function rollPending(idx) {
    const d = state.days[idx];
    if (!d) return;
    LINES.forEach((l) => {
      if (d.signs[l.id] === undefined) {
        d.signs[l.id] = Math.random() < 0.5 ? 1 : -1;
        d.mags[l.id] = Math.random() * PCT;
      }
    });
  }

  // 设置某天某线方向：上/下立即定向（涨幅 0~5% 随机）；自动 → 今天回到待定、过去天随机补上
  function applyLock(idx, lineId, val) {
    const d = state.days[idx];
    if (!d) return;
    if (val === 'up') { d.locks[lineId] = 'up'; d.signs[lineId] = 1; if (d.mags[lineId] === undefined) d.mags[lineId] = Math.random() * PCT; }
    else if (val === 'down') { d.locks[lineId] = 'down'; d.signs[lineId] = -1; if (d.mags[lineId] === undefined) d.mags[lineId] = Math.random() * PCT; }
    else {
      d.locks[lineId] = null;
      if (isToday(idx)) { delete d.signs[lineId]; delete d.mags[lineId]; }
      else if (d.signs[lineId] === undefined) { d.signs[lineId] = Math.random() < 0.5 ? 1 : -1; d.mags[lineId] = Math.random() * PCT; }
    }
    recomputePrices();
    save();
  }

  // ================= 图表 =================
  function sizeCanvas() {
    if (!chartCanvas) return;
    const wrap = chartCanvas.parentElement;
    const w = Math.max(200, wrap.clientWidth || 360);
    const dpr = window.devicePixelRatio || 1;
    chartCanvas.width = Math.round(w * dpr);
    chartCanvas.height = Math.round(CHART_H * dpr);
    chartCanvas.style.width = w + 'px';
    chartCanvas.style.height = CHART_H + 'px';
    chartCanvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function collectSeries() {
    return LINES.map((l) => {
      const pts = [];
      for (let i = 0; i <= currentIdx; i++) {
        const p = state.days[i].price[l.id];
        if (p != null) pts.push({ day: i, price: p });
      }
      return { line: l, pts };
    });
  }

  function drawChart() {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = chartCanvas.width / dpr, H = chartCanvas.height / dpr;
    ctx.clearRect(0, 0, W, H);

    const padL = 42, padR = 12, padT = 12, padB = 24;
    const plotW = W - padL - padR, plotH = H - padT - padB;

    const series = collectSeries();
    let min = Infinity, max = -Infinity;
    series.forEach((s) => s.pts.forEach((p) => {
      if (p.price < min) min = p.price;
      if (p.price > max) max = p.price;
    }));
    if (!isFinite(min)) { min = BASE * (1 - PCT); max = BASE * (1 + PCT); }
    if (max - min < 1) { const mid = (max + min) / 2; min = mid - 5; max = mid + 5; }
    const padV = (max - min) * 0.12;
    min -= padV; max += padV;

    const xFor = (i) => padL + (i / (TOTAL_DAYS - 1)) * plotW;
    const yFor = (price) => padT + ((max - price) / (max - min)) * plotH;

    // 网格 + Y 轴价格刻度
    ctx.font = '10px "Segoe UI", "Microsoft YaHei", sans-serif';
    const ticks = 5;
    for (let t = 0; t <= ticks; t++) {
      const price = max - (t / ticks) * (max - min);
      const y = yFor(price);
      ctx.strokeStyle = 'rgba(61,47,27,.12)';
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillStyle = '#8a6a2f';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(fmtPrice(price), padL - 5, y);
    }

    // X 轴天数 + 竖网格
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const x = xFor(i);
      ctx.strokeStyle = 'rgba(61,47,27,.07)';
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, H - padB); ctx.stroke();
      ctx.fillStyle = '#8a6a2f';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('D' + (i + 1), x, H - padB + 5);
    }

    // 4 条折线（静止：已定格收盘点连线）
    series.forEach((s) => {
      if (!s.pts.length) return;
      ctx.strokeStyle = s.line.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      s.pts.forEach((p, k) => {
        const x = xFor(p.day), y = yFor(p.price);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      s.pts.forEach((p) => {
        ctx.fillStyle = s.line.color;
        ctx.beginPath(); ctx.arc(xFor(p.day), yFor(p.price), 3, 0, Math.PI * 2); ctx.fill();
      });
    });

    // 今天未定格的线：在当前天位置画空心圈提示"待定"
    if (isToday(currentIdx)) {
      LINES.forEach((l) => {
        if (state.days[currentIdx].price[l.id] == null) {
          const open = currentIdx > 0 ? (state.days[currentIdx - 1].price[l.id] ?? BASE) : BASE;
          ctx.strokeStyle = l.color;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(xFor(currentIdx), yFor(open), 5, 0, Math.PI * 2); ctx.stroke();
        }
      });
    }
  }

  // ================= 图例（静态：当天收盘价 + 涨跌） =================
  function buildLegend() {
    if (!legendEl) return;
    legendEl.innerHTML = '';
    LINES.forEach((l) => {
      const price = state.days[currentIdx].price[l.id];
      const prev = currentIdx > 0 ? (state.days[currentIdx - 1].price[l.id] ?? BASE) : BASE;
      let priceTxt, chgTxt, chgCls;
      if (price == null) {
        priceTxt = '待定';
        chgTxt = '—';
        chgCls = 'zero';
      } else {
        priceTxt = fmtPrice(price);
        const chg = (price - prev) / prev * 100;
        chgTxt = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
        chgCls = chg >= 0 ? 'up' : 'down';
      }
      const row = document.createElement('div');
      row.className = 'stock-lg';
      row.innerHTML =
        '<span class="stock-lg-dot" style="background:' + l.color + '"></span>' +
        '<span class="stock-lg-name">' + l.name + '</span>' +
        '<span class="stock-lg-price">' + priceTxt + '</span>' +
        '<span class="stock-lg-chg ' + chgCls + '">' + chgTxt + '</span>';
      legendEl.appendChild(row);
    });
  }

  // ================= 方向控制（每条线每天可设） =================
  function buildControls() {
    if (!ctrlEl) return;
    ctrlEl.innerHTML = '';
    LINES.forEach((l) => {
      const lock = state.days[currentIdx].locks[l.id] || null;
      const g = document.createElement('div');
      g.className = 'stock-lock';
      const name = document.createElement('span');
      name.className = 'stock-lock-name';
      name.textContent = l.name;
      g.appendChild(name);
      [['auto', '自动'], ['up', '上'], ['down', '下']].forEach((pair) => {
        const val = pair[0], label = pair[1];
        const active = (val === 'auto') ? !lock : (lock === val);
        const b = document.createElement('button');
        b.className = 'stock-btn' + (active ? ' active' : '');
        b.textContent = label;
        b.addEventListener('click', () => {
          applyLock(currentIdx, l.id, val);
          renderFinance(containerEl);
        });
        g.appendChild(b);
      });
      ctrlEl.appendChild(g);
    });
  }

  // ================= 渲染 =================
  function renderFinance(container) {
    syncLength();
    containerEl = container;
    const cur = (window.BOARD && window.BOARD.getCurrent) ? window.BOARD.getCurrent().index : 0;
    currentIdx = Math.min(cur, state.days.length - 1);
    const day = state.days[currentIdx];
    if (!day) return;

    container.innerHTML = '';

    // 头部：切换天数
    const head = document.createElement('div');
    head.className = 'stock-head';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'stock-nav';
    prevBtn.textContent = '◀';
    prevBtn.disabled = currentIdx === 0;
    prevBtn.addEventListener('click', () => {
      if (window.BOARD && window.BOARD.goTo) window.BOARD.goTo(currentIdx - 1);
      renderFinance(container);
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'stock-nav';
    nextBtn.textContent = '▶';
    nextBtn.disabled = currentIdx === state.days.length - 1;
    nextBtn.addEventListener('click', () => {
      if (window.BOARD && window.BOARD.goTo) window.BOARD.goTo(currentIdx + 1);
      renderFinance(container);
    });

    head.appendChild(prevBtn);
    const daySpan = document.createElement('span');
    daySpan.className = 'stock-day';
    daySpan.textContent = '第 ' + (currentIdx + 1) + ' / ' + TOTAL_DAYS + ' 天';
    head.appendChild(daySpan);
    head.appendChild(nextBtn);
    const hint = document.createElement('span');
    hint.className = 'stock-hint';
    hint.textContent = '每日 0~' + Math.round(PCT * 100) + '% 随机涨跌 · 自动=50%上/下 · 设上/下则按设定';
    head.appendChild(hint);
    container.appendChild(head);

    const main = document.createElement('div');
    main.className = 'stock-main';

    const chartWrap = document.createElement('div');
    chartWrap.className = 'stock-chart-wrap';
    chartCanvas = document.createElement('canvas');
    chartWrap.appendChild(chartCanvas);
    main.appendChild(chartWrap);

    legendEl = document.createElement('div');
    legendEl.className = 'stock-legend';
    main.appendChild(legendEl);
    container.appendChild(main);

    ctrlEl = document.createElement('div');
    ctrlEl.className = 'stock-ctrl';
    container.appendChild(ctrlEl);

    actionsEl = document.createElement('div');
    actionsEl.className = 'stock-actions';

    const genBtn = document.createElement('button');
    genBtn.className = 'btn primary';
    genBtn.textContent = '🎲 生成当天涨跌';
    genBtn.addEventListener('click', () => {
      rollPending(currentIdx);
      recomputePrices();
      save();
      renderFinance(container);
    });
    actionsEl.appendChild(genBtn);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn';
    resetBtn.textContent = '全部重置';
    resetBtn.addEventListener('click', () => {
      const n = boardDays();
      state.days = [];
      for (let i = 1; i <= n; i++) state.days.push(makeDay(i));
      save();
      renderFinance(container);
    });
    actionsEl.appendChild(resetBtn);

    container.appendChild(actionsEl);

    buildLegend();
    buildControls();
    sizeCanvas();
    drawChart();
  }

  window.STOCK = {
    renderFinance,
    onSettle: (idx) => { syncLength(); resolveDay(idx); recomputePrices(); save(); },
    onUndo: () => { syncLength(); recomputePrices(); save(); },
    onReset: () => { state = initState(); save(); },
  };
})();
