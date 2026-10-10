// 股票看板（金融街）：4 条线同一坐标图实时波动，每天 50% 上/下，DM 可锁定某天方向
// 天数与群众板共用（结算群众板时股票也推进一天）；价格累加连续；localStorage 持久化
(function () {
  'use strict';

  const BASE = 100;          // 每股初始价
  const PCT = 0.05;          // 每天涨跌幅（固定百分比 5%）
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
    return { day: n, locks: {}, signs: {}, price: {} };
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
  let chartCanvas = null, legendEl = null, ctrlEl = null;
  let currentIdx = 0;
  let livePrices = {};       // lineId -> 实时价
  let openPrices = {};       // lineId -> 今日开盘（昨日收盘）
  let trails = {};           // lineId -> 当日实时波动轨迹
  let rafId = null;

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

  // 结算某天：锁定→上/下；未锁定且未定→50% 掷币；已定则保持
  function resolveDay(idx) {
    const d = state.days[idx];
    if (!d) return;
    LINES.forEach((l) => {
      const lock = d.locks[l.id];
      if (lock === 'up') d.signs[l.id] = 1;
      else if (lock === 'down') d.signs[l.id] = -1;
      else if (d.signs[l.id] === undefined) d.signs[l.id] = Math.random() < 0.5 ? 1 : -1;
    });
  }

  function recomputePrices() {
    const prev = {};
    LINES.forEach((l) => { prev[l.id] = BASE; });
    state.days.forEach((d) => {
      d.price = d.price || {};
      LINES.forEach((l) => {
        const s = d.signs[l.id];
        if (s === undefined) { d.price[l.id] = null; return; }
        prev[l.id] = Math.round(prev[l.id] * (1 + s * PCT) * 100) / 100;
        d.price[l.id] = prev[l.id];
      });
    });
  }

  function isLiveDay(idx) { return idx === state.days.length - 1; }

  function initLive(idx) {
    livePrices = {};
    openPrices = {};
    trails = {};
    LINES.forEach((l) => {
      const prevIdx = idx - 1;
      const open = prevIdx < 0 ? BASE : (state.days[prevIdx].price[l.id] ?? BASE);
      openPrices[l.id] = open;
      livePrices[l.id] = open;
      trails[l.id] = [open];
    });
  }

  // 均值回归随机游走，把今天限制在开盘 ±5% 内
  function updateLive() {
    LINES.forEach((l) => {
      const open = openPrices[l.id];
      let p = livePrices[l.id];
      p += (open - p) * 0.04 + (Math.random() - 0.5) * open * 0.014;
      const lo = open * (1 - PCT), hi = open * (1 + PCT);
      p = Math.min(hi, Math.max(lo, p));
      livePrices[l.id] = p;
      const t = trails[l.id] || [];
      t.push(p);
      if (t.length > 40) t.shift();
      trails[l.id] = t;
    });
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
      // 已结算历史
      for (let i = 0; i < currentIdx; i++) {
        const p = state.days[i].price[l.id];
        if (p != null) pts.push({ day: i, price: p, live: false });
      }
      if (isLiveDay(currentIdx)) {
        // 今天：实时轨迹
        const t = trails[l.id] || [];
        t.forEach((p, k) => pts.push({ day: currentIdx, price: p, live: true, k: k, n: t.length }));
      } else {
        const p = state.days[currentIdx].price[l.id];
        if (p != null) pts.push({ day: currentIdx, price: p, live: false });
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
    const dayW = plotW / (TOTAL_DAYS - 1);

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

    // 4 条折线（历史 + 今日实时轨迹）
    series.forEach((s) => {
      if (!s.pts.length) return;
      ctx.strokeStyle = s.line.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      s.pts.forEach((p, k) => {
        let x, y;
        if (p.live && p.n) {
          // 轨迹铺在当天结尾前的一小段里，向右波动到当天刻度
          const span = Math.min(dayW * 0.7, plotW * 0.3);
          x = xFor(p.day) - (p.n - 1 - p.k) * (span / Math.max(p.n - 1, 1));
          y = yFor(p.price);
        } else {
          x = xFor(p.day);
          y = yFor(p.price);
        }
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // 当前点（今天用大圆点 + 白圈脉冲）
      const last = s.pts[s.pts.length - 1];
      const lx = xFor(last.day), ly = yFor(last.price);
      ctx.fillStyle = s.line.color;
      ctx.beginPath(); ctx.arc(lx, ly, last.live ? 4 : 3, 0, Math.PI * 2); ctx.fill();
      if (last.live) {
        ctx.strokeStyle = 'rgba(255,255,255,.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(lx, ly, 6, 0, Math.PI * 2); ctx.stroke();
      }
    });
  }

  // ================= 图例 =================
  function buildLegend() {
    if (!legendEl) return;
    legendEl.innerHTML = '';
    LINES.forEach((l) => {
      const row = document.createElement('div');
      row.className = 'stock-lg';
      row.innerHTML =
        '<span class="stock-lg-dot" style="background:' + l.color + '"></span>' +
        '<span class="stock-lg-name">' + l.name + '</span>' +
        '<span class="stock-lg-price" data-price></span>' +
        '<span class="stock-lg-chg" data-chg></span>';
      legendEl.appendChild(row);
    });
  }

  function updateLegend() {
    if (!legendEl) return;
    const rows = legendEl.querySelectorAll('.stock-lg');
    LINES.forEach((l, i) => {
      const row = rows[i];
      if (!row) return;
      const price = isLiveDay(currentIdx) ? livePrices[l.id] : state.days[currentIdx].price[l.id];
      const open = openPrices[l.id];
      const chg = (price - open) / open * 100;
      row.querySelector('[data-price]').textContent = fmtPrice(price);
      const chgEl = row.querySelector('[data-chg]');
      chgEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
      chgEl.className = 'stock-lg-chg ' + (chg >= 0 ? 'up' : 'down');
    });
  }

  // ================= 锁定控制 =================
  function buildControls() {
    if (!ctrlEl) return;
    ctrlEl.innerHTML = '';
    LINES.forEach((l) => {
      const g = document.createElement('div');
      g.className = 'stock-lock';
      const name = document.createElement('span');
      name.className = 'stock-lock-name';
      name.textContent = l.name;
      g.appendChild(name);
      [['auto', '自动'], ['up', '上'], ['down', '下']].forEach((pair) => {
        const val = pair[0], label = pair[1];
        const b = document.createElement('button');
        b.className = 'stock-btn';
        b.textContent = label;
        b.addEventListener('click', () => {
          const day = state.days[currentIdx];
          day.locks[l.id] = (val === 'auto') ? null : val;
          save();
          refreshControlActive();
        });
        g.appendChild(b);
      });
      ctrlEl.appendChild(g);
    });
    refreshControlActive();
  }

  function refreshControlActive() {
    if (!ctrlEl) return;
    const day = state.days[currentIdx];
    LINES.forEach((l, i) => {
      const g = ctrlEl.querySelectorAll('.stock-lock')[i];
      if (!g) return;
      const lock = day.locks[l.id] || null;
      const btns = g.querySelectorAll('.stock-btn');
      btns[0].classList.toggle('active', !lock);
      btns[1].classList.toggle('active', lock === 'up');
      btns[2].classList.toggle('active', lock === 'down');
    });
  }

  // ================= 动画循环 =================
  function stopAnim() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function tick() {
    const modal = document.querySelector('#locationModal');
    if (!modal || !modal.classList.contains('open') || !chartCanvas) { stopAnim(); return; }
    if (isLiveDay(currentIdx)) updateLive();
    drawChart();
    updateLegend();
    rafId = requestAnimationFrame(tick);
  }

  function renderFinance(container) {
    stopAnim();
    syncLength();
    const cur = (window.BOARD && window.BOARD.getCurrent) ? window.BOARD.getCurrent().index : 0;
    currentIdx = Math.min(cur, state.days.length - 1);
    const day = state.days[currentIdx];
    if (!day) return;

    container.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'stock-head';
    head.innerHTML = '第 <b>' + (currentIdx + 1) + '</b> / ' + TOTAL_DAYS + ' 天 · 每日 ±' + Math.round(PCT * 100) +
      '%（自动 = 50% 上/下，结算群众板时定格当天）';
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

    buildLegend();
    buildControls();
    initLive(currentIdx);
    sizeCanvas();
    drawChart();
    updateLegend();
    rafId = requestAnimationFrame(tick);
  }

  window.addEventListener('resize', () => {
    if (!chartCanvas) return;
    sizeCanvas();
    drawChart();
  });

  window.STOCK = {
    renderFinance,
    onSettle: (idx) => { syncLength(); resolveDay(idx); recomputePrices(); save(); },
    onUndo: () => { syncLength(); recomputePrices(); save(); },
    onReset: () => { state = initState(); save(); },
  };
})();
