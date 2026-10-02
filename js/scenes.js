// 场景图分配 + 商店互动数据
// hotspot 的 x/y 是「热点中心」在图片里的百分比位置（0-100），w/h 是热点大小（占图百分比）
// 之后如果热点位置不准，改这里的数字即可。
window.SCENES = {
  // 每个地点 id → 弹窗内容（点地图图标时打开）
  // type: 'scene' 场景图（单图或多图竖排）；'shop' 商店互动
  locContent: {
    alley: { type: 'shop' },
    church: { type: 'scene', title: '教堂', images: [
      { img: 'scenes/church.png' },
    ]},
    prison: { type: 'scene', title: '监狱', images: [
      { img: 'scenes/prison.png' },
    ]},
    bc: { type: 'scene', title: '研究所', images: [
      { title: '大门', img: 'scenes/institute_gate.png' },
      { title: '园区', img: 'scenes/institute.png' },
    ]},
    dock: { type: 'scene', title: '码头', images: [
      { title: '码头', img: 'scenes/dock.png' },
      { title: '海边', img: 'scenes/seaside.png' },
    ]},
  },

  // 商店互动（在弹窗框内）
  shop: {
    street: {
      title: '暗巷 · 商店街',
      img: 'scenes/street.png',
      hotspots: [
        { label: '商店1', x: 24, y: 78, w: 14, h: 18, shop: 'shop1' },
        { label: '主商店', x: 34, y: 52, w: 16, h: 20, shop: 'main' },
        { label: '商店3', x: 40, y: 30, w: 16, h: 20, shop: 'shop3' },
      ],
    },
    shops: {
      main: { name: '主商店', interior: true },
      shop1: { name: '商店1' },
      shop3: { name: '商店3' },
    },
    interior: {
      title: '主商店',
      img: 'scenes/shop.png',
      hotspots: [
        { label: '货架', x: 24, y: 46, w: 34, h: 52, action: 'shelf' },
      ],
    },
    products: [
      { name: '冥想疗愈', price: 20, img: 'items/meditation.png' },
      { name: '科学仪器', price: 35, img: 'items/instrument.png' },
      { name: '干草叉', price: 18, img: 'items/pitchfork.png' },
    ],
  },
};
