// 圣状dnd 全局配置（唯一真源，主站和编辑器都读这里）
// 注意：locations 的 x/y 是"图标底部中心"在地图(1773x887)上的像素坐标，
//       scale 是图标缩放倍数（1 = 图标原始像素大小）。
//       摆好位置后，把编辑器导出的 JSON 填回下面的 x/y/scale 和 labels 即可。
window.CONFIG = {
  map: { src: '波城地图.png', w: 1773, h: 887 },

  // 9 个地点图标（icons/*.png 由 crop_icons.py 从 地点图标.png 裁出，透明底）
  // w/h = 图标 PNG 的原始宽高（用于按 scale 缩放渲染）
  locations: [
    { id: 'rest',    name: '绿线员工休息室', icon: 'icons/rest.png',    w: 316, h: 151, x: 804,  y: 305, scale: 0.35 },
    { id: 'bar',     name: '酒吧',           icon: 'icons/bar.png',     w: 261, h: 210, x: 348,  y: 550, scale: 0.35 },
    { id: 'factory', name: '机械工厂',       icon: 'icons/factory.png', w: 322, h: 225, x: 391,  y: 280, scale: 0.4 },
    { id: 'dock',    name: '码头',           icon: 'icons/dock.png',    w: 342, h: 193, x: 1297, y: 181, scale: 0.4 },
    { id: 'prison',  name: '监狱',           icon: 'icons/prison.png',  w: 281, h: 200, x: 1544, y: 252, scale: 0.4 },
    { id: 'finance', name: '办公区/金融街',  icon: 'icons/finance.png', w: 407, h: 244, x: 1194, y: 663, scale: 0.4 },
    { id: 'gov',     name: '政府',           icon: 'icons/gov.png',     w: 405, h: 256, x: 1300, y: 434, scale: 0.35 },
    { id: 'bc',      name: '波士顿学院',     icon: 'icons/bc.png',      w: 432, h: 221, x: 131,  y: 760, scale: 0.35 },
    { id: 'church',  name: '教堂',           icon: 'icons/church.png',  w: 377, h: 277, x: 800,  y: 759, scale: 0.35 },
    { id: 'alley',   name: '暗巷',           icon: '暗巷.png',           w: 2172, h: 724, x: 517,  y: 508, scale: 0.1 },
  ],

  // 用户在地图上额外标注的地名文字（编辑器里添加、导出后填回这里）
  labels: [
    { text: '·40 Kirkland Str', x: 731, y: 120 },
    { text: '机械工厂', x: 392, y: 290 },
    { text: '研究所', x: 131, y: 773 },
    { text: '绿线休息室', x: 808, y: 319 },
    { text: '酒吧', x: 350, y: 564 },
    { text: '码头', x: 1291, y: 205 },
    { text: '监狱', x: 1542, y: 263 },
    { text: '金融街', x: 1188, y: 675 },
    { text: '政府', x: 1297, y: 448 },
    { text: '教堂', x: 799, y: 769 },
    { text: '暗巷', x: 511, y: 520 },
  ],

  // 9 个玩家
  players: [
    { id: 'soviet',    name: '苏联老兵',   color: '#e53935' },
    { id: 'shettler',  name: '谢特勒',     color: '#fb8c00' },
    { id: 'wolf',      name: '华尔街之狼', color: '#f9a825' },
    { id: 'zhong',     name: '老钟',       color: '#43a047' },
    { id: 'alchemist', name: '炼金术士',   color: '#00897b' },
    { id: 'hunter',    name: '猎人',       color: '#8e24aa' },
    { id: 'worker',    name: '技术工人',   color: '#1e88e5' },
    { id: 'sonia',     name: 'Sonia',      color: '#d81b60' },
    { id: 'an',        name: '安姐',       color: '#00acc1' },
  ],

  // 时间轴
  timeline: {
    weeks: [
      {
        id: 'W1', label: 'W1',
        points: [
          { id: '1.1', label: '1.1', hint: 'D1 早' },
          { id: '1.2', label: '1.2', hint: 'D1 午' },
          { id: '1.3', label: '1.3', hint: 'D1 晚' },
          { id: '2.1', label: '2.1', hint: 'D2 前半' },
          { id: '2.2', label: '2.2', hint: 'D2 后半' },
        ],
      },
      { id: 'W2', label: 'W2', points: [] },
      { id: 'W3', label: 'W3', points: [] },
      { id: 'W4', label: 'W4', points: [] },
    ],
  },
};
