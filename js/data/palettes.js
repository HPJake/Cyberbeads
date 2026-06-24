// ========== COLOR PALETTE ==========
const PALETTE_SETS = {
  'macaron': {
    label: '🍬 马卡龙',
    colors: [
      { name: '草莓奶昔', hex: '#FFA9AD' },
      { name: '蜜桃',     hex: '#F4C3A5' },
      { name: '柠檬',     hex: '#F7F8A2' },
      { name: '薄荷',     hex: '#9FE4DF' },
      { name: '蓝莓酸奶', hex: '#BBCFED' },
      { name: '薰衣草',   hex: '#D8C3D7' },
      { name: '奶油',     hex: '#FCF9E0' },
      { name: '可可',     hex: '#D6AA87' },
      { name: '抹茶',     hex: '#D0CCAA' },
      { name: '香芋',     hex: '#D8C3D7' },
      { name: '天蓝',     hex: '#A9E5E5' },
      { name: '奶白',     hex: '#FCF7F8' },
    ]
  },
  'morandi': {
    label: '🏺 莫兰迪',
    colors: [
      { name: '烟粉',   hex: '#BD9DA1' },
      { name: '灰紫',   hex: '#B6B1BA' },
      { name: '雾蓝',   hex: '#B6B1BA' },
      { name: '鼠尾绿', hex: '#BCC6B8' },
      { name: '燕麦',   hex: '#E3D2BC' },
      { name: '枯玫瑰', hex: '#BD9DA1' },
      { name: '灰绿',   hex: '#B0A9AC' },
      { name: '驼色',   hex: '#C1BD8D' },
      { name: '灰蓝',   hex: '#B6B1BA' },
      { name: '豆沙',   hex: '#BD9DA1' },
      { name: '烟灰',   hex: '#BCC6B8' },
      { name: '暖白',   hex: '#EEE9EA' },
    ]
  },
  'candy': {
    label: '🍭 糖果',
    colors: [
      { name: '樱桃红', hex: '#FD7C72' },
      { name: '橙子',   hex: '#FEAC4C' },
      { name: '芒果黄', hex: '#FFDA45' },
      { name: '青柠',   hex: '#7FCD9D' },
      { name: '海蓝',   hex: '#50AAF0' },
      { name: '葡萄紫', hex: '#AEB4F2' },
      { name: '热粉',   hex: '#EA8CB1' },
      { name: '珊瑚',   hex: '#FD957B' },
      { name: '薄荷绿', hex: '#65E2A6' },
      { name: '天空蓝', hex: '#7CC4FF' },
      { name: '柠檬绿', hex: '#ADE946' },
      { name: '纯白',   hex: '#FFFFFF' },
    ]
  },
  'nature': {
    label: '🌿 自然',
    colors: [
      { name: '陶土',   hex: '#D19066' },
      { name: '橄榄绿', hex: '#B0A782' },
      { name: '芥末黄', hex: '#E1B383' },
      { name: '苔绿',   hex: '#8AA386' },
      { name: '沙色',   hex: '#D0CCAA' },
      { name: '砖红',   hex: '#C77362' },
      { name: '深海蓝', hex: '#8490A6' },
      { name: '木棕',   hex: '#B0A782' },
      { name: '草绿',   hex: '#B0A782' },
      { name: '赭石',   hex: '#D19066' },
      { name: '石板灰', hex: '#9A9D94' },
      { name: '米白',   hex: '#F6EFE2' },
    ]
  },
  'custom': {
    label: '🎨 自定义',
    colors: [] // dynamically filled
  }
};

// Default active palette and colors
let ACTIVE_PALETTE_KEY = 'macaron';

// ========== 当前调色板 ==========
const PALETTE = PALETTE_SETS[ACTIVE_PALETTE_KEY].colors;
const ERASER_COLOR = 'transparent';
