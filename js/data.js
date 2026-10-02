// 圣状dnd 数据（故事 + 状态数值 + 地点图文）
// —— 目前是【占位格式】，你之后把处理好的故事和数值按下面的格式填进来即可。
//
// 键的写法：`玩家id@时间点id`，例如 'soviet@1.1' 表示苏联老兵在 1.1 时间点。
// 玩家id 见 js/config.js 里的 players；时间点id 见 timeline（1.1/1.2/1.3/2.1/2.2）。
//
// ============ 故事 stories ============
//   '玩家id@时间点id': {
//     loc: '地点id',            // 该时间点玩家所在的地点（对应 config.locations 的 id）
//     concise: '精简版故事',     // 精简版
//     full: '完整版故事',        // 完整版
//   }
// ============ 状态 status ============
//   '玩家id@时间点id': {
//     wealth: 0,   // 财富(0-3)
//     strength: 0, // 力量(0-3)
//     charm: 0,    // 魅力(0-3)
//     insight: 0,  // 洞察(0-3)
//     money: 20,   // 金钱数
//     hp: 5,       // 血量
//     items: ['冰镐'], // 所有物（字符串数组）
//   }
// ============ 地点图文 locations ============
//   '地点id': { title:'地点名', img:'大图路径', text:'介绍文字' }
//   img 留空 '' 时只显示文字。

window.DATA = {
  stories: {
    // —— 以下两条是演示占位，之后整体替换 ——
    'soviet@1.1': {
      loc: 'rest',
      concise: '（示例·精简）开局就冲向谢特勒想杀他，检定大失败，撞在了墙上。',
      full: '（示例·完整）苏联老兵是二战穿越者。开局他冲向谢特勒想杀人，检定大失败，撞在了四十坑的墙上，场面一度尴尬。',
    },
    'shettler@1.1': {
      loc: 'rest',
      concise: '（示例·精简）用魅力劝苏联老兵共谋大业，失败，反被激怒。',
      full: '（示例·完整）谢特勒试图用魅力劝苏联老兵"一起共谋大业、把天下改造成更好的地方"，检定失败，老兵反而被激怒。',
    },
  },

  status: {
    // —— 以下是开局属性（每人初始 20 块、5 格血），其余时间点待你提供 ——
    'soviet@1.1':   { wealth: 0, strength: 2, charm: 1, insight: 3, money: 20, hp: 5, items: [] },
    'shettler@1.1': { wealth: 0, strength: 2, charm: 2, insight: 2, money: 27, hp: 5, items: [] },
    'wolf@1.1':     { wealth: 1, strength: 1, charm: 2, insight: 2, money: 20, hp: 5, items: [] },
  },

  locations: {
    // —— 示例：酒吧，其余地点留空（点击时会显示"暂无信息"）——
    'bar': {
      title: '酒吧',
      img: '',
      text: '（示例占位）谢特勒在这里演讲、招兵买马的地方，也在暗巷旁边。',
    },
  },
};

// ============ 位置数据（每个人每个回合的位置 / 绿线） ============
// 地点键：40k=40 Kirkland(含MBTA站) / alley暗巷 / bar酒吧 / finance金融街 / bc研究所 / dock码头 / rest绿线休息室
// { loc: '地点键' } 表示单点；{ from:'A', to:'B' } 表示该回合在绿线上，A→B 之间画绿线，玩家点放中点
window.POSITIONS = {
  extra: { '40k': { x: 731, y: 120, lift: 26 } },
  data: {
    // 苏联老兵
    'soviet@1.1': { loc: '40k' },
    'soviet@1.2': { from: '40k', to: 'alley' },
    'soviet@1.3': { loc: 'alley' },
    'soviet@2.1': { loc: 'bar' },
    'soviet@2.2': { loc: 'bar' },
    // 华尔街之狼
    'wolf@1.1': { from: '40k', to: 'finance' },
    'wolf@1.2': { loc: 'finance' },
    'wolf@1.3': { loc: 'finance' },
    'wolf@2.1': { loc: 'finance' },
    'wolf@2.2': { loc: 'finance' },
    // 谢特勒
    'shettler@1.1': { loc: '40k' },
    'shettler@1.2': { from: '40k', to: 'bar' },
    'shettler@1.3': { loc: 'bar' },
    'shettler@2.1': { loc: 'bar' },
    'shettler@2.2': { loc: 'bar' },
    // 老钟
    'zhong@1.1': { loc: '40k' },
    'zhong@1.2': { from: '40k', to: 'bc' },
    'zhong@1.3': { loc: 'bc' },
    'zhong@2.1': { loc: 'bc' },
    'zhong@2.2': { loc: 'bc' },
    // 炼金术士
    'alchemist@1.1': { from: '40k', to: 'alley' },
    'alchemist@1.2': { loc: 'alley' },
    'alchemist@1.3': { loc: 'alley' },
    'alchemist@2.1': { loc: 'alley' },
    'alchemist@2.2': { from: 'alley', to: 'bc' },
    // 猎人
    'hunter@1.1': { from: '40k', to: 'dock' },
    'hunter@1.2': { loc: 'dock' },
    'hunter@1.3': { loc: 'dock' },
    'hunter@2.1': { loc: 'dock' },
    'hunter@2.2': { from: 'dock', to: 'finance' },
    // 技术工人
    'worker@1.1': { loc: '40k' },
    'worker@1.2': { from: '40k', to: 'bc' },
    'worker@1.3': { loc: 'bc' },
    'worker@2.1': { loc: 'bc' },
    'worker@2.2': { loc: 'bc' },
    // Sonia
    'sonia@1.1': { loc: '40k' },
    'sonia@1.2': { loc: '40k' },
    'sonia@1.3': { loc: 'rest' },
    'sonia@2.1': { from: 'rest', to: 'alley' },
    'sonia@2.2': { from: 'alley', to: 'bc' },
    // 安姐
    'an@1.1': { from: '40k', to: 'bc' },
    'an@1.2': { loc: 'bc' },
    'an@1.3': { loc: 'bc' },
    'an@2.1': { loc: 'bc' },
    'an@2.2': { loc: 'bc' },
  },
};
