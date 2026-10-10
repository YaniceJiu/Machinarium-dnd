// 股票看板（金融街）：4 条线，每天 50% 上/下，DM 可锁定某天的方向
// 天数与群众板共用（结算群众板时股票也推进一天）；价格累加连续；localStorage 持久化
(function () {
  'use strict';

  const BASE = 100;          // 每股初始价
  const PCT = 0.05;          // 每天涨跌幅（固定百分比 5%）
  const TOTAL_DAYS = 12;     // 与群众板一致
  const LINES = [
    { id: 'port',  name: '港口运货' },
    { id: 'arms',  name: '国家军火' },
    { id: 'water', name: '生命之水外贸' },
    { id: 'sci',   name: '科研' },
  ];
  const LS_KEY = 'machinarium_stock_v1';

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

  function historyChips(lineId, idx) {
    let html = '';
    for (let i = 0; i < idx; i++) {
      const s = state.days[i].signs[lineId];
      if (s === 1) html += '<span class="stock-chip up">D' + (i + 1) + ' ↑</span>';
      else if (s === -1) html += '<span class="stock-chip down">D' + (i + 1) + ' ↓</span>';
    }
    return html || '<span class="stock-none">暂无历史</span>';
  }

  function renderFinance(container) {
    syncLength();
    const cur = (window.BOARD && window.BOARD.getCurrent) ? window.BOARD.getCurrent().index : 0;
    const idx = Math.min(cur, state.days.length - 1);
    const day = state.days[idx];
    if (!day) return;

    container.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'stock-head';
    head.innerHTML = '第 <b>' + (idx + 1) + '</b> / ' + TOTAL_DAYS + ' 天 · 每日 ±' + Math.round(PCT * 100) +
      '%（自动 = 50% 上/下，锁定则按你填的来，结算群众板时生效）';
    container.appendChild(head);

    LINES.forEach((l) => {
      const prevIdx = idx - 1;
      const now = prevIdx < 0 ? BASE : state.days[prevIdx].price[l.id];
      const lock = day.locks[l.id] || null;

      const row = document.createElement('div');
      row.className = 'stock-row';

      const top = document.createElement('div');
      top.className = 'stock-top';
      top.innerHTML = '<span class="stock-name">' + l.name + '</span><span class="stock-now">现价 ' + fmtPrice(now) + '</span>';
      row.appendChild(top);

      const hist = document.createElement('div');
      hist.className = 'stock-hist';
      hist.innerHTML = historyChips(l.id, idx);
      row.appendChild(hist);

      const ctrl = document.createElement('div');
      ctrl.className = 'stock-ctrl';
      [['auto', '自动'], ['up', '上'], ['down', '下']].forEach((pair) => {
        const val = pair[0], label = pair[1];
        const active = (val === 'auto') ? !lock : (lock === val);
        const b = document.createElement('button');
        b.className = 'stock-btn' + (active ? ' active' : '');
        b.textContent = label;
        b.addEventListener('click', () => {
          day.locks[l.id] = (val === 'auto') ? null : val;
          save();
          renderFinance(container);
        });
        ctrl.appendChild(b);
      });
      row.appendChild(ctrl);
      container.appendChild(row);
    });
  }

  window.STOCK = {
    renderFinance,
    onSettle: (idx) => { syncLength(); resolveDay(idx); recomputePrices(); save(); },
    onUndo: () => { syncLength(); recomputePrices(); save(); },
    onReset: () => { state = initState(); save(); },
  };
})();
