/**
 * data.js - 大富翁 · 静态数据
 * 40 格标准环形棋盘、8 组地产、租金表、机会/命运卡组与类型元信息。
 * 无 DOM 依赖，浏览器挂 window.MonopolyData，Node 走 module.exports。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MonopolyData = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* 地产分组：颜色是棋盘语义色，明暗模式只调整明度，不替换色相 */
  var GROUPS = {
    brown:     { zh: '棕色', en: 'Brown',      color: '#8a5a3c', houseCost: 50,  size: 2 },
    lightblue: { zh: '浅蓝', en: 'Light Blue', color: '#79c2e6', houseCost: 50,  size: 3 },
    pink:      { zh: '粉色', en: 'Pink',       color: '#d65d8e', houseCost: 100, size: 3 },
    orange:    { zh: '橙色', en: 'Orange',     color: '#e08a37', houseCost: 100, size: 3 },
    red:       { zh: '红色', en: 'Red',        color: '#d4484b', houseCost: 150, size: 3 },
    yellow:    { zh: '黄色', en: 'Yellow',     color: '#d9b12e', houseCost: 150, size: 3 },
    green:     { zh: '绿色', en: 'Green',      color: '#379a6b', houseCost: 200, size: 3 },
    darkblue:  { zh: '深蓝', en: 'Dark Blue',  color: '#3d5cc0', houseCost: 200, size: 2 }
  };

  function prop(i, id, zh, en, group, price, rent) {
    return {
      i: i, id: id, type: 'property',
      name: { zh: zh, en: en },
      group: group, price: price, rent: rent, houseCost: GROUPS[group].houseCost
    };
  }

  var TILES = [
    { i: 0, id: 'go', type: 'go', name: { zh: '起点', en: 'GO' }, amount: 200 },
    prop(1, 'mediterranean', '地中海大道', 'Mediterranean Ave', 'brown', 60, [2, 10, 30, 90, 160, 250]),
    { i: 2, id: 'chest-1', type: 'chest', name: { zh: '社区宝箱', en: 'Community Chest' } },
    prop(3, 'baltic', '波罗的海大道', 'Baltic Ave', 'brown', 60, [4, 20, 60, 180, 320, 450]),
    { i: 4, id: 'income-tax', type: 'tax', name: { zh: '所得税', en: 'Income Tax' }, amount: 200 },
    { i: 5, id: 'reading-rr', type: 'railroad', name: { zh: '雷丁铁路', en: 'Reading Railroad' }, price: 200 },
    prop(6, 'oriental', '东方大道', 'Oriental Ave', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
    { i: 7, id: 'chance-1', type: 'chance', name: { zh: '机会', en: 'Chance' } },
    prop(8, 'vermont', '佛蒙特大道', 'Vermont Ave', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
    prop(9, 'connecticut', '康涅狄格大道', 'Connecticut Ave', 'lightblue', 120, [8, 40, 100, 300, 450, 600]),
    { i: 10, id: 'jail', type: 'jail', name: { zh: '监狱 / 探监', en: 'Jail / Just Visiting' } },
    prop(11, 'st-charles', '圣查尔斯广场', 'St. Charles Place', 'pink', 140, [10, 50, 150, 450, 625, 750]),
    { i: 12, id: 'electric', type: 'utility', name: { zh: '电力公司', en: 'Electric Company' }, price: 150 },
    prop(13, 'states', '州立大道', 'States Ave', 'pink', 140, [10, 50, 150, 450, 625, 750]),
    prop(14, 'virginia', '弗吉尼亚大道', 'Virginia Ave', 'pink', 160, [12, 60, 180, 500, 700, 900]),
    { i: 15, id: 'pennsylvania-rr', type: 'railroad', name: { zh: '宾夕法尼亚铁路', en: 'Pennsylvania Railroad' }, price: 200 },
    prop(16, 'st-james', '圣詹姆斯广场', 'St. James Place', 'orange', 180, [14, 70, 200, 550, 750, 950]),
    { i: 17, id: 'chest-2', type: 'chest', name: { zh: '社区宝箱', en: 'Community Chest' } },
    prop(18, 'tennessee', '田纳西大道', 'Tennessee Ave', 'orange', 180, [14, 70, 200, 550, 750, 950]),
    prop(19, 'new-york', '纽约大道', 'New York Ave', 'orange', 200, [16, 80, 220, 600, 800, 1000]),
    { i: 20, id: 'parking', type: 'parking', name: { zh: '免费停车', en: 'Free Parking' } },
    prop(21, 'kentucky', '肯塔基大道', 'Kentucky Ave', 'red', 220, [18, 90, 250, 700, 875, 1050]),
    { i: 22, id: 'chance-2', type: 'chance', name: { zh: '机会', en: 'Chance' } },
    prop(23, 'indiana', '印第安纳大道', 'Indiana Ave', 'red', 220, [18, 90, 250, 700, 875, 1050]),
    prop(24, 'illinois', '伊利诺伊大道', 'Illinois Ave', 'red', 240, [20, 100, 300, 750, 925, 1100]),
    { i: 25, id: 'bo-rr', type: 'railroad', name: { zh: 'B&O 铁路', en: 'B. & O. Railroad' }, price: 200 },
    prop(26, 'atlantic', '大西洋大道', 'Atlantic Ave', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
    prop(27, 'ventnor', '文特诺大道', 'Ventnor Ave', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
    { i: 28, id: 'water', type: 'utility', name: { zh: '自来水厂', en: 'Water Works' }, price: 150 },
    prop(29, 'marvin', '马文花园', 'Marvin Gardens', 'yellow', 280, [24, 120, 360, 850, 1025, 1200]),
    { i: 30, id: 'gotojail', type: 'gotojail', name: { zh: '入狱', en: 'Go To Jail' } },
    prop(31, 'pacific', '太平洋大道', 'Pacific Ave', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
    prop(32, 'north-carolina', '北卡罗来纳大道', 'North Carolina Ave', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
    { i: 33, id: 'chest-3', type: 'chest', name: { zh: '社区宝箱', en: 'Community Chest' } },
    prop(34, 'pennsylvania', '宾夕法尼亚大道', 'Pennsylvania Ave', 'green', 320, [28, 150, 450, 1000, 1200, 1400]),
    { i: 35, id: 'short-line', type: 'railroad', name: { zh: '短线铁路', en: 'Short Line' }, price: 200 },
    { i: 36, id: 'chance-3', type: 'chance', name: { zh: '机会', en: 'Chance' } },
    prop(37, 'park-place', '公园广场', 'Park Place', 'darkblue', 350, [35, 175, 500, 1100, 1300, 1500]),
    { i: 38, id: 'luxury-tax', type: 'tax', name: { zh: '奢侈税', en: 'Luxury Tax' }, amount: 100 },
    prop(39, 'boardwalk', '木板路', 'Boardwalk', 'darkblue', 400, [50, 200, 600, 1400, 1700, 2000])
  ];

  /* 机会卡：移动 / 收付 / 入狱 / 出狱卡 / 维修 */
  var CHANCE = [
    { id: 'c-go', text: { zh: '前进到起点，领取 $200', en: 'Advance to GO. Collect $200.' }, effect: { kind: 'move', to: 0 } },
    { id: 'c-illinois', text: { zh: '前进到伊利诺伊大道', en: 'Advance to Illinois Ave.' }, effect: { kind: 'move', to: 24 } },
    { id: 'c-stcharles', text: { zh: '前进到圣查尔斯广场', en: 'Advance to St. Charles Place.' }, effect: { kind: 'move', to: 11 } },
    { id: 'c-rr', text: { zh: '前进到最近的铁路，并付双倍租金', en: 'Advance to the nearest railroad and pay double rent.' }, effect: { kind: 'nearest', type: 'railroad', doubleRent: true } },
    { id: 'c-dividend', text: { zh: '银行分红，收 $50', en: 'Bank pays you a dividend of $50.' }, effect: { kind: 'money', amount: 50 } },
    { id: 'c-jailfree', text: { zh: '获得一张「出狱卡」，可留用', en: 'Get a Get Out of Jail Free card.' }, effect: { kind: 'jailFree' } },
    { id: 'c-back3', text: { zh: '后退三格', en: 'Go back 3 spaces.' }, effect: { kind: 'moveBy', steps: -3 } },
    { id: 'c-jail', text: { zh: '直接进监狱，不经过起点', en: 'Go directly to Jail. Do not pass GO.' }, effect: { kind: 'jail' } },
    { id: 'c-repair', text: { zh: '房屋维修：每栋房屋 $25，每座旅馆 $100', en: 'Make general repairs: $25 per house, $100 per hotel.' }, effect: { kind: 'repair', perHouse: 25, perHotel: 100 } },
    { id: 'c-fine', text: { zh: '超速罚款 $15', en: 'Speeding fine. Pay $15.' }, effect: { kind: 'money', amount: -15 } },
    { id: 'c-chairman', text: { zh: '当选董事长，付给每位玩家 $50', en: 'You are elected chairman. Pay each player $50.' }, effect: { kind: 'payEach', amount: 50 } }
  ];

  /* 命运卡 */
  var CHEST = [
    { id: 'h-go', text: { zh: '前进到起点，领取 $200', en: 'Advance to GO. Collect $200.' }, effect: { kind: 'move', to: 0 } },
    { id: 'h-bank', text: { zh: '银行结算错误，收 $200', en: 'Bank error in your favor. Collect $200.' }, effect: { kind: 'money', amount: 200 } },
    { id: 'h-medical', text: { zh: '支付医药费 $50', en: 'Doctor fee. Pay $50.' }, effect: { kind: 'money', amount: -50 } },
    { id: 'h-stock', text: { zh: '出售股票，收 $50', en: 'From sale of stock you get $50.' }, effect: { kind: 'money', amount: 50 } },
    { id: 'h-jailfree', text: { zh: '获得一张「出狱卡」，可留用', en: 'Get a Get Out of Jail Free card.' }, effect: { kind: 'jailFree' } },
    { id: 'h-jail', text: { zh: '直接进监狱，不经过起点', en: 'Go directly to Jail. Do not pass GO.' }, effect: { kind: 'jail' } },
    { id: 'h-holiday', text: { zh: '假日基金到期，收 $100', en: 'Holiday fund matures. Collect $100.' }, effect: { kind: 'money', amount: 100 } },
    { id: 'h-school', text: { zh: '缴纳学校税费 $150', en: 'School tax. Pay $150.' }, effect: { kind: 'money', amount: -150 } },
    { id: 'h-beauty', text: { zh: '选美比赛获得亚军，收 $10', en: 'You won second prize in a beauty contest. Collect $10.' }, effect: { kind: 'money', amount: 10 } },
    { id: 'h-inherit', text: { zh: '继承遗产 $100', en: 'You inherit $100.' }, effect: { kind: 'money', amount: 100 } },
    { id: 'h-hospital', text: { zh: '支付住院费 $100', en: 'Hospital fees. Pay $100.' }, effect: { kind: 'money', amount: -100 } }
  ];

  /* 类型元信息：名称、图标与场景主色（主色为语义色，不随主题变） */
  var TYPES = {
    go:       { zh: '起点', en: 'GO', icon: '🏁', color: '#2f9e6e' },
    property: { zh: '地产', en: 'Property', icon: '🏠', color: '#8a5a3c' },
    railroad: { zh: '铁路', en: 'Railroad', icon: '🚂', color: '#6b7280' },
    utility:  { zh: '公用事业', en: 'Utility', icon: '💡', color: '#b08a2e' },
    chance:   { zh: '机会', en: 'Chance', icon: '❓', color: '#d97b28' },
    chest:    { zh: '命运', en: 'Community Chest', icon: '🎁', color: '#3f8fc4' },
    tax:      { zh: '税务', en: 'Tax', icon: '💰', color: '#c25a4a' },
    jail:     { zh: '监狱', en: 'Jail', icon: '🔒', color: '#5b6474' },
    parking:  { zh: '免费停车', en: 'Free Parking', icon: '🅿️', color: '#3f9e6b' },
    gotojail: { zh: '入狱', en: 'Go To Jail', icon: '🚔', color: '#c0453f' }
  };

  /** 某组地产的格子索引 */
  function groupIndexes(group) {
    var out = [];
    for (var i = 0; i < TILES.length; i++) {
      if (TILES[i].type === 'property' && TILES[i].group === group) out.push(i);
    }
    return out;
  }

  /** 棋盘坐标：0 在右下角，逆时针一圈 */
  function cellOf(index) {
    if (index === 0) return { x: 10, y: 10 };
    if (index < 10) return { x: 10 - index, y: 10 };
    if (index === 10) return { x: 0, y: 10 };
    if (index < 20) return { x: 0, y: 10 - (index - 10) };
    if (index === 20) return { x: 0, y: 0 };
    if (index < 30) return { x: index - 20, y: 0 };
    if (index === 30) return { x: 10, y: 0 };
    return { x: 10, y: index - 30 };
  }

  return {
    GROUPS: GROUPS,
    TILES: TILES,
    CHANCE: CHANCE,
    CHEST: CHEST,
    TYPES: TYPES,
    START_CASH: 1500,
    GO_SALARY: 200,
    JAIL_FINE: 50,
    MAX_ROUNDS: 30,
    groupIndexes: groupIndexes,
    cellOf: cellOf
  };
});
