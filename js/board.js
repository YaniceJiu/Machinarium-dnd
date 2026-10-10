// 群众板（W2）：500万人口，精英15%/学生35%/民众50%
// 政治态度：灰(无感)/红(喜欢)/蓝(讨厌)；真相：红(知情)/蓝(不知情)
// 每天：知情的人各传播 3 个（同阶级）；DM 记加减（数字或百分比）→ 当天最终
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);

  const TOTAL = 5000000;
  const GROUPS = [
    { id: 'elite', name: '精英', pct: 0.15 },
    { id: 'student', name: '学生', pct: 0.35 },
    { id: 'public', name: '民众', pct: 0.50 },
  ];
  const LS_KEY = 'machinarium_board_v1';

  function initState() {
    return {
      day: 1,
      groups: GROUPS.map((g) => ({
        id: g.id,
        total: Math.round(TOTAL * g.pct),
        red: 0, blue: 0, known: 0,
      })),
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.groups && s.groups.length === GROUPS.length) return s;
      }
    } catch (e) { /* ignore */ }
    return null;
  }
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  let state = load() || initState();

  const grey = (g) => g.total - g.red - g.blue;
  const unknown = (g) => g.total - g.known;

  function fmtWan(n) {
    if (n >= 10000) {
      const w = n / 10000;
      return (Number.isInteger(w) ? String(w) : w.toFixed(2)) + '万';
    }
    if (n === 0) return '0';
    return n + '人';
  }

  // 传播：每个知情的人传 3 个不知情（同阶级）
  function propagate() {
    state.groups.forEach((g) => {
      const spread = Math.min(g.known * 3, unknown(g));
      g.known += spread;
    });
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

  function applyDelta(g, metric, delta) {
    if (metric === 'red') {
      g.red = Math.max(0, Math.min(g.total - g.blue, g.red + delta));
    } else if (metric === 'blue') {
      g.blue = Math.max(0, Math.min(g.total - g.red, g.blue + delta));
    } else if (metric === 'known') {
      g.known = Math.max(0, Math.min(g.total, g.known + delta));
    }
  }

  function barSeg(cls, flex, text) {
    return `<div class="seg ${cls}" style="flex:${flex || 0}">${text || ''}</div>`;
  }

  function render() {
    $('#boardDay').textContent = '第 ' + state.day + ' 天';
    const wrap = $('#boardGroups');
    wrap.innerHTML = '';
    state.groups.forEach((g, gi) => {
      const gr = grey(g), r = g.red, b = g.blue, k = g.known, u = unknown(g);
      const gname = (GROUPS.find((x) => x.id === g.id) || {}).name || g.id;
      const el = document.createElement('div');
      el.className = 'board-group';
      el.innerHTML =
        `<div class="bg-head"><span>${gname}</span><span class="bg-total">${fmtWan(g.total)}</span></div>` +
        `<div class="bg-row"><span class="bg-label">政治</span><div class="bg-bar pol">` +
          barSeg('grey', gr) + barSeg('red', r) + barSeg('blue', b) +
        `</div></div>` +
        `<div class="bg-counts">灰 ${fmtWan(gr)} · 红 ${fmtWan(r)} · 蓝 ${fmtWan(b)}</div>` +
        `<div class="bg-row"><span class="bg-label">真相</span><div class="bg-bar truth">` +
          barSeg('known', k) + barSeg('unknown', u) +
        `</div></div>` +
        `<div class="bg-counts">知情 ${fmtWan(k)} · 不知情 ${fmtWan(u)}</div>` +
        `<div class="bg-inputs">` +
          `<label>红<input data-g="${gi}" data-m="red" placeholder="+/- 或%"></label>` +
          `<label>蓝<input data-g="${gi}" data-m="blue" placeholder="+/- 或%"></label>` +
          `<label>知情<input data-g="${gi}" data-m="known" placeholder="+/- 或%"></label>` +
        `</div>`;
      wrap.appendChild(el);
    });
  }

  function settle() {
    document.querySelectorAll('#boardGroups input').forEach((inp) => {
      const gi = parseInt(inp.dataset.g, 10);
      const metric = inp.dataset.m;
      const delta = parseDelta(inp.value, state.groups[gi].total);
      if (delta) applyDelta(state.groups[gi], metric, delta);
    });
    state.day += 1;
    propagate();
    save();
    render();
  }

  function reset() {
    state = initState();
    save();
    render();
  }

  window.BOARD = {
    show: () => $('#boardPanel').classList.add('open'),
    hide: () => $('#boardPanel').classList.remove('open'),
    toggle: () => $('#boardPanel').classList.toggle('open'),
  };

  $('#boardSettle').addEventListener('click', settle);
  $('#boardReset').addEventListener('click', reset);
  $('#boardClose').addEventListener('click', () => window.BOARD.hide());

  render();
})();
