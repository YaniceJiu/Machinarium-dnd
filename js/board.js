// 群众板（W2）：500万人口，精英15%/学生35%/民众50%
// 政治态度：灰(无感)/红(喜欢)/蓝(讨厌)；真相：红(知情)/蓝(不知情)
// 每天结算：先传播（知情×3，仅同阶级）→ DM 填加减（数字或百分比）→ 当天最终
// 共 12 天；每天存快照，◀▶ 回看并可修改，撤销=回上一天
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);

  const TOTAL = 5000000;
  const TOTAL_DAYS = 12;
  const GROUPS = [
    { id: 'elite', name: '精英', pct: 0.15 },
    { id: 'student', name: '学生', pct: 0.35 },
    { id: 'public', name: '民众', pct: 0.50 },
  ];
  const LS_KEY = 'machinarium_board_v2';
  const TOTALS = {};
  GROUPS.forEach((g) => { TOTALS[g.id] = Math.round(TOTAL * g.pct); });

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function zeroDeltas() {
    const d = {};
    GROUPS.forEach((g) => { d[g.id] = { red: 0, blue: 0, known: 0 }; });
    return d;
  }
  function zeroFinal() {
    const f = {};
    GROUPS.forEach((g) => { f[g.id] = { red: 0, blue: 0, known: 0 }; });
    return f;
  }
  function makeDay(n) {
    return { day: n, deltas: zeroDeltas(), final: zeroFinal() };
  }

  // 传播：每个知情者传 3 个不知情（仅同阶级）；政治红/蓝不自动扩散
  function propagateFinal(final) {
    const out = {};
    GROUPS.forEach((g) => {
      const f = final[g.id] || { red: 0, blue: 0, known: 0 };
      const total = TOTALS[g.id];
      const known = Math.min(total, f.known + Math.min(f.known * 3, total - f.known));
      out[g.id] = { red: f.red, blue: f.blue, known };
    });
    return out;
  }

  function applyDeltas(final, deltas) {
    const out = {};
    GROUPS.forEach((g) => {
      const f = final[g.id] || { red: 0, blue: 0, known: 0 };
      const d = deltas[g.id] || { red: 0, blue: 0, known: 0 };
      const total = TOTALS[g.id];
      let red = clamp(f.red + d.red, 0, total);
      let blue = clamp(f.blue + d.blue, 0, total);
      if (red + blue > total) {
        const scale = total / (red + blue);
        red = Math.floor(red * scale);
        blue = total - red;
      }
      const known = clamp(f.known + d.known, 0, total);
      out[g.id] = { red, blue, known };
    });
    return out;
  }

  function recomputeFrom(from, days) {
    for (let i = from; i < days.length; i++) {
      const base = i === 0 ? zeroFinal() : propagateFinal(days[i - 1].final);
      days[i].final = applyDeltas(base, days[i].deltas || zeroDeltas());
    }
  }

  function initState() {
    const days = [makeDay(1)];
    recomputeFrom(0, days);
    return { days, current: 0 };
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.days) && s.days.length) {
        s.current = clamp(s.current || 0, 0, s.days.length - 1);
        recomputeFrom(0, s.days);
        return s;
      }
    } catch (e) { /* ignore */ }
    return null;
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  let state = load() || initState();

  function fmtWan(n) {
    if (n >= 10000) {
      const w = n / 10000;
      return (Number.isInteger(w) ? String(w) : parseFloat(w.toFixed(2)).toString()) + '万';
    }
    if (n === 0) return '0';
    return n + '人';
  }

  function parseDelta(str, total) {
    const s = String(str).trim();
    if (!s) return 0;
    if (s.includes('%')) {
      const pct = parseFloat(s.replace('%', ''));
      if (isNaN(pct)) return 0;
      return Math.round((total * pct) / 100);
    }
    const n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  }

  function signed(n) {
    if (n > 0) return '+' + n;
    if (n < 0) return String(n);
    return '0';
  }
  function deltaClass(n) {
    return n > 0 ? 'd-pos' : (n < 0 ? 'd-neg' : 'd-zero');
  }

  function segHtml(cls, count, text) {
    if (count <= 0) return '';
    return `<div class="seg ${cls}" style="flex-grow:${count};flex-basis:0;min-width:3.2em" title="${text}">${text}</div>`;
  }

  function render() {
    const day = state.days[state.current];
    $('#boardDay').textContent = '第 ' + day.day + ' / ' + TOTAL_DAYS + ' 天';
    const prev = $('#boardPrev'), next = $('#boardNext');
    if (prev) prev.disabled = state.current === 0;
    if (next) next.disabled = state.current === state.days.length - 1;

    const wrap = $('#boardGroups');
    wrap.innerHTML = '';
    GROUPS.forEach((g) => {
      const f = day.final[g.id] || { red: 0, blue: 0, known: 0 };
      const d = day.deltas[g.id] || { red: 0, blue: 0, known: 0 };
      const total = TOTALS[g.id];
      const gr = total - f.red - f.blue;
      const u = total - f.known;

      const el = document.createElement('div');
      el.className = 'board-group';
      el.innerHTML =
        `<div class="bg-head"><span>${g.name}</span><span class="bg-total">${fmtWan(total)}</span></div>` +
        `<div class="bg-row"><span class="bg-label">政治</span><div class="bg-bar pol">` +
          segHtml('grey', gr, fmtWan(gr)) + segHtml('red', f.red, fmtWan(f.red)) + segHtml('blue', f.blue, fmtWan(f.blue)) +
        `</div></div>` +
        `<div class="bg-counts">灰 ${fmtWan(gr)} · 红 ${fmtWan(f.red)} · 蓝 ${fmtWan(f.blue)}</div>` +
        `<div class="bg-row"><span class="bg-label">真相</span><div class="bg-bar truth">` +
          segHtml('unknown', u, fmtWan(u)) + segHtml('known', f.known, fmtWan(f.known)) +
        `</div></div>` +
        `<div class="bg-counts">知情 ${fmtWan(f.known)} · 不知情 ${fmtWan(u)}</div>` +
        `<div class="bg-delta">本日变化：` +
          `<span class="${deltaClass(d.red)}">红 ${signed(d.red)}</span> · ` +
          `<span class="${deltaClass(d.blue)}">蓝 ${signed(d.blue)}</span> · ` +
          `<span class="${deltaClass(d.known)}">知情 ${signed(d.known)}</span>` +
        `</div>` +
        `<div class="bg-inputs">` +
          `<label>红<input data-g="${g.id}" data-m="red" placeholder="+/- 或%" value="${d.red ? d.red : ''}"></label>` +
          `<label>蓝<input data-g="${g.id}" data-m="blue" placeholder="+/- 或%" value="${d.blue ? d.blue : ''}"></label>` +
          `<label>知情<input data-g="${g.id}" data-m="known" placeholder="+/- 或%" value="${d.known ? d.known : ''}"></label>` +
        `</div>`;
      wrap.appendChild(el);
    });
  }

  function readDeltas() {
    const deltas = zeroDeltas();
    document.querySelectorAll('#boardGroups input').forEach((inp) => {
      const gid = inp.dataset.g;
      const m = inp.dataset.m;
      if (!gid || !deltas[gid]) return;
      deltas[gid][m] = parseDelta(inp.value, TOTALS[gid]);
    });
    return deltas;
  }

  function settle() {
    const settledIdx = state.current;
    const day = state.days[state.current];
    day.deltas = readDeltas();
    recomputeFrom(state.current, state.days);
    // 若在最后一天且未到 12 天 → 新增下一天并前进
    if (state.current === state.days.length - 1 && state.days.length < TOTAL_DAYS) {
      state.days.push(makeDay(state.days.length + 1));
      recomputeFrom(state.days.length - 1, state.days);
      state.current = state.days.length - 1;
    }
    save();
    render();
    flashDelta();
    if (window.STOCK) window.STOCK.onSettle(settledIdx);
  }

  function flashDelta() {
    document.querySelectorAll('#boardGroups .bg-delta').forEach((el) => {
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
    });
  }

  function go(i) {
    state.current = clamp(i, 0, state.days.length - 1);
    render();
  }

  function undo() {
    if (state.current === state.days.length - 1) {
      if (state.days.length <= 1) return;
      state.days.pop();
      state.current = state.days.length - 1;
    } else {
      if (state.current <= 0) return;
      state.current -= 1;
    }
    save();
    render();
    if (window.STOCK) window.STOCK.onUndo();
  }

  function reset() {
    state = initState();
    save();
    render();
    if (window.STOCK) window.STOCK.onReset();
  }

  const panel = $('#boardPanel');
  const handle = $('#boardHandle');

  function updateHandle() {
    if (!handle) return;
    const collapsed = panel.classList.contains('collapsed');
    handle.textContent = collapsed ? '▶' : '◀';
    handle.title = collapsed ? '展开群众板' : '收起群众板';
    handle.style.left = collapsed ? '0px' : (panel.offsetWidth + 'px');
  }

  window.BOARD = {
    show: () => { panel.classList.remove('collapsed'); updateHandle(); },
    hide: () => { panel.classList.add('collapsed'); updateHandle(); },
    toggle: () => { panel.classList.toggle('collapsed'); updateHandle(); },
    isOpen: () => !panel.classList.contains('collapsed'),
    getCurrent: () => ({ index: state.current, day: state.days[state.current].day }),
    getDays: () => state.days.length,
    goTo: (i) => go(i),
  };

  if (handle) handle.addEventListener('click', () => window.BOARD.toggle());

  $('#boardPrev').addEventListener('click', () => go(state.current - 1));
  $('#boardNext').addEventListener('click', () => go(state.current + 1));
  $('#boardUndo').addEventListener('click', undo);
  $('#boardSettle').addEventListener('click', settle);
  $('#boardReset').addEventListener('click', reset);
  $('#boardClose').addEventListener('click', () => window.BOARD.hide());

  render();
  updateHandle();
})();
