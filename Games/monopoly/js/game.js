/**
 * game.js - 大富翁 · 界面与对局流程
 * 依赖：platform/game-api.js（GamePlatform）、js/data.js、js/rules.js、js/ai.js、
 *       js/audio.js、js/map.js
 *
 * 流程：开局配置 → 逐回合进行（掷骰 / 移动 / 结算 / 买卖 / 建房）→ 破产或回合上限结算
 * 所有规则判定都在 rules.js，本文件只负责驱动、动画与渲染。
 */
(function () {
  'use strict';

  var D = window.MonopolyData;
  var R = window.MonopolyRules;
  var AI = window.MonopolyAI;
  var S = window.MonopolySound;
  var Map2D = window.MonopolyMap;
  var GP = window.GamePlatform;

  var COLORS = ['#e5484d', '#3b7ded', '#22a06b', '#e0a020'];
  var CPU_LETTERS = ['A', 'B', 'C', 'D'];

  /* ============================================================
   * 文案
   * ========================================================== */

  var TEXT = {
    zh: {
      back: '返回主页',
      rulesBtn: '规则',
      newGame: '新对局',
      logTitle: '对局记录',
      mapWatermark: '大富翁',
      boardKicker: '对局棋盘',
      boardHint: '点击格子查看详情 · 棋子会跟着走',
      boardSub: '第 {n} 回合 · 共 {max} 回合',
      inspectTip: '点击棋盘任意格子查看地块详情',
      boardSwipe: '← 左右滑动查看整圈 →',
      boardIdle: '选好人数，掷出第一把骰子',
      backToHere: '看当前玩家',
      roundBadge: '第 {n} / {max} 回合',
      turnFocus: '轮到 {name}',
      turnFocusHint: '镜头正在对准你的位置',
      rollTotal: '{n} 点',
      rollUnit: '点',
      drawChance: '机会',
      drawChest: '命运',
      drawKicker: '抽一张卡',
      drawOk: '知道了',
      drawShuffling: '洗牌中…',
      resumed: '已恢复上次对局 · 第 {n} 回合',

      setupTitle: '大富翁',
      setupSub: '选好人数就能开局，真人与电脑可以混坐同一张桌子。',
      humans: '真人玩家',
      humansHint: '同屏轮流操作',
      computers: '电脑玩家',
      computersHint: '由电脑自动决策',
      difficulty: '电脑难度',
      difficultyHint: '影响买地、保释与建房',
      diffEasy: '简单',
      diffMedium: '普通',
      diffHard: '困难',
      start: '开始游戏',
      clearStats: '清除记录',
      totalPlayers: '本局共 {n} 位玩家（{h} 真人 + {c} 电脑）',
      tooFew: '至少需要 2 位玩家',
      tooMany: '最多 4 位玩家',
      cleared: '记录已清除',
      statsLine: '已完成 {games} 局 · 真人胜 {wins} 局',
      noStats: '还没有对局记录',
      humanName: '玩家 {n}',
      cpuName: '电脑 {n}',

      backToHere: '看当前玩家',
      turnOf: '轮到 {name}',
      yourTurn: '轮到你了',
      aiThinking: '{name} 正在思考…',
      rollPrompt: '点击「掷骰子」开始行动',
      jailPrompt: '你在监狱中：交出狱卡、缴保释金，或掷骰求双',
      buyPrompt: '这块地无人拥有，要买下吗？',
      endPrompt: '本回合结束',
      waiting: '处理中…',
      bankruptNow: '已破产',

      roll: '掷骰子',
      jailPay: '交 {amount} 保释',
      jailCard: '出狱卡（{n}）',
      jailRoll: '掷骰求双',
      buy: '买下 {price}',
      decline: '放弃',
      viewEnd: '查看结算',
      build: '建房 {cost}',
      sell: '卖房 {refund}',
      maxHotel: '该地块已建成旅馆',
      groupHint: '集齐同色整组后可建房',
      notEnough: '现金不足',

      price: '售价',
      ownerLabel: '业主',
      unowned: '未售出',
      housesLabel: '建筑',
      hotel: '旅馆',
      houseN: '{n} 栋',
      rentNow: '当前租金',
      rentTable: '租金表',
      rentBase: '空地',
      rentFull: '整组空地',
      rentH: '{n} 栋',
      rentHotel: '旅馆',
      salary: '经过奖励',
      railCount: '已拥有 {n} 条铁路',
      utilCount: '已拥有 {n} 家公用事业',
      tileIndex: '第 {n} 格',
      ownerNone: '无人拥有',

      descPropertyFree: '售价 {price} · 空地租金 {rent}',
      descPropertyOwned: '{owner} 的地产 · 当前租金 {rent}',
      descRailroadFree: '售价 {price} · 铁路租金随持有条数上涨',
      descRailroadOwned: '{owner} 的铁路 · 当前租金 {rent}',
      descUtilityFree: '售价 {price} · 租金为骰子点数 ×4（两家 ×10）',
      descUtilityOwned: '{owner} 的公用事业 · 本次租金 {rent}',
      descTax: '停留即缴纳 {amount}',
      descChance: '抽一张机会卡：移动、收付款或入狱',
      descChest: '抽一张命运卡：意外之财或突发支出',
      descGo: '经过或停在起点，领取 {amount}',
      descJail: '路过这里只是探监，不会被关押',
      descParking: '安全区，不产生任何费用',
      descGoToJail: '直接进监狱，不经过起点',
      descGoToJailShort: '踩到即被押往监狱',

      endTitle: '{name} 获胜！',
      endTitleYou: '你赢了！',
      endSubWin: '其余玩家全部破产 · 共 {n} 回合',
      endSubSettle: '达到 {n} 回合上限，按净资产结算',
      rankWorth: '净资产',
      again: '再来一局',

      logEmpty: '还没有记录，掷骰子开始吧。',
      logTurnStart: '轮到 {name}',
      logJailTurn: '{name} 在监狱中（第 {turns} 次尝试）',
      logRoll: '{name} 掷出 {d1} + {d2} = {sum}',
      logRollAgain: '{name} 掷出双数，可以再掷一次',
      logExtraRoll: '{name} 获得额外回合',
      logTripleDoubles: '{name} 连续三次双数，被送进监狱',
      logPassGo: '{name} 经过起点，领取 {amount}',
      logLandedFree: '{name} 停在 {tile}，售价 {price}',
      logCannotBuy: '{name} 停在 {tile}，现金不足以购买（{price}）',
      logOwnTile: '{name} 回到自己的 {tile}',
      logPayRent: '{name} 向 {owner} 支付 {amount} 租金（{tile}）',
      logPayTax: '{name} 缴纳 {amount}（{tile}）',
      logDrawChance: '{name} 抽到机会：{card}',
      logDrawChest: '{name} 抽到命运：{card}',
      logLandGoToJail: '{name} 踩到「入狱」',
      logGoToJail: '{name} 被押往监狱',
      logJustVisiting: '{name} 路过监狱',
      logFreeParking: '{name} 在免费停车场休息',
      logOnGo: '{name} 停在起点',
      logPayBail: '{name} 支付 {amount} 保释金出狱',
      logStayJail: '{name} 没掷出双数，留在监狱（{turns}/3）',
      logJailDoubles: '{name} 掷出双数，走出监狱',
      logForcedBail: '{name} 三次未掷出双数，缴纳 {amount} 后出狱',
      logUseJailCard: '{name} 使用出狱卡',
      logJailRoll: '{name} 在狱中掷出 {d1} + {d2}',
      logBuy: '{name} 买下 {tile}（{price}）',
      logDecline: '{name} 放弃购买 {tile}',
      logBuild: '{name} 在 {tile} 建造{what}（-{cost}）',
      logSellHouse: '{name} 卖掉 {tile} 的一栋房屋（+{refund}）',
      logAutoSell: '{name} 现金不足，自动卖掉 {tile} 的房屋（+{refund}）',
      logBankrupt: '{name} 破产退出对局',
      logWin: '{name} 成为最后的赢家！',
      logSettle: '回合上限到达，{name} 以最高净资产获胜',
      logRepair: '{name} 支付维修费 {amount}（{houses} 房 / {hotels} 旅馆）',
      logPayEach: '{name} 付给 {to} {amount}',

      rulesTitle: '玩法说明',
      rules: [
        {
          h: '目标与回合',
          items: [
            '每人初始现金 $1500，轮流掷两枚骰子沿棋盘前进。',
            '经过或停在起点领取 $200；掷出双数可再掷一次，连续三次双数直接进监狱。',
            '30 回合内未分出胜负时，按净资产（现金 + 地产 + 建筑）排名结算。'
          ]
        },
        {
          h: '地产与租金',
          items: [
            '停在无人拥有的地产、铁路或公用事业时，可以按售价买下。',
            '停在他人地产需付租金：房屋越多租金越高；集齐同色整组后，空地租金翻倍。',
            '铁路租金按拥有条数 25 / 50 / 100 / 200；公用事业为骰子点数 ×4，两家齐时为 ×10。'
          ]
        },
        {
          h: '建房',
          items: [
            '集齐同色整组后，可在自己回合开始、掷骰之前建房。',
            '必须均衡建造：同组各地块房屋数差不超过 1。每块地最多 4 栋房屋 + 1 座旅馆。',
            '现金不足会自动半价卖房抵债；仍不足则破产退出。'
          ]
        },
        {
          h: '监狱与卡牌',
          items: [
            '入狱后可交出狱卡、付 $50 保释，或掷骰求双；三次未掷出双数将强制缴纳 $50。',
            '机会与命运卡可能带来移动、收付款、房屋维修或直接入狱。'
          ]
        }
      ]
    },

    en: {
      back: 'Home',
      rulesBtn: 'Rules',
      newGame: 'New game',
      logTitle: 'Game log',
      mapWatermark: 'MONOPOLY',
      boardKicker: 'Game board',
      boardHint: 'Click any tile for details · tokens follow the dice',
      boardSub: 'Round {n} of {max}',
      inspectTip: 'Click any tile to inspect it',
      boardSwipe: '← swipe to see the whole board →',
      boardIdle: 'Pick your players and roll',
      backToHere: 'Show current player',
      roundBadge: 'Round {n} / {max}',
      turnFocus: '{name}’s turn',
      turnFocusHint: 'Camera is homing in on you',
      rollTotal: '{n}',
      rollUnit: '',
      drawChance: 'Chance',
      drawChest: 'Community Chest',
      drawKicker: 'Draw one card',
      drawOk: 'Got it',
      drawShuffling: 'Shuffling…',
      resumed: 'Resumed · round {n}',

      setupTitle: 'Monopoly',
      setupSub: 'Pick how many humans and CPUs share the table, then roll.',
      humans: 'Human players',
      humansHint: 'Take turns on this device',
      computers: 'CPU players',
      computersHint: 'Decided automatically',
      difficulty: 'CPU difficulty',
      difficultyHint: 'Affects buying, bail and building',
      diffEasy: 'Easy',
      diffMedium: 'Normal',
      diffHard: 'Hard',
      start: 'Start game',
      clearStats: 'Clear records',
      totalPlayers: '{n} players this game ({h} human + {c} CPU)',
      tooFew: 'At least 2 players are required',
      tooMany: 'At most 4 players',
      cleared: 'Records cleared',
      statsLine: '{games} games played · humans won {wins}',
      noStats: 'No games played yet',
      humanName: 'Player {n}',
      cpuName: 'CPU {n}',

      backToHere: 'Show current player',
      turnOf: "{name}'s turn",
      yourTurn: 'Your turn',
      aiThinking: '{name} is thinking…',
      rollPrompt: 'Roll the dice to start your turn',
      jailPrompt: 'In jail: use a card, pay bail, or roll for doubles',
      buyPrompt: 'This property is unowned. Buy it?',
      endPrompt: 'Turn ending',
      waiting: 'Working…',
      bankruptNow: 'Bankrupt',

      roll: 'Roll dice',
      jailPay: 'Pay {amount} bail',
      jailCard: 'Jail card ({n})',
      jailRoll: 'Roll for doubles',
      buy: 'Buy {price}',
      decline: 'Pass',
      viewEnd: 'View results',
      build: 'Build {cost}',
      sell: 'Sell {refund}',
      maxHotel: 'This lot already has a hotel',
      groupHint: 'Own the full colour group to build',
      notEnough: 'Not enough cash',

      price: 'Price',
      ownerLabel: 'Owner',
      unowned: 'Unowned',
      housesLabel: 'Buildings',
      hotel: 'Hotel',
      houseN: '{n} houses',
      rentNow: 'Current rent',
      rentTable: 'Rent table',
      rentBase: 'Base',
      rentFull: 'Full group',
      rentH: '{n} house(s)',
      rentHotel: 'Hotel',
      salary: 'Salary',
      railCount: '{n} railroads owned',
      utilCount: '{n} utilities owned',
      tileIndex: 'Tile {n}',
      ownerNone: 'Unowned',

      descPropertyFree: 'Price {price} · base rent {rent}',
      descPropertyOwned: "{owner}'s property · current rent {rent}",
      descRailroadFree: 'Price {price} · rent grows with each railroad you own',
      descRailroadOwned: "{owner}'s railroad · current rent {rent}",
      descUtilityFree: 'Price {price} · rent is dice ×4 (×10 with both utilities)',
      descUtilityOwned: "{owner}'s utility · rent this time {rent}",
      descTax: 'Pay {amount} when you land here',
      descChance: 'Draw a Chance card: move, gain, pay or go to jail',
      descChest: 'Draw a Community Chest card: a windfall or a bill',
      descGo: 'Pass or land on GO to collect {amount}',
      descJail: 'Just visiting — you are not detained here',
      descParking: 'A safe corner. Nothing happens here.',
      descGoToJail: 'Go directly to jail. Do not pass GO.',
      descGoToJailShort: 'Landing here sends you to jail',

      endTitle: '{name} wins!',
      endTitleYou: 'You win!',
      endSubWin: 'Everyone else went bankrupt · {n} rounds',
      endSubSettle: 'Round limit reached · settled by net worth',
      rankWorth: 'Net worth',
      again: 'Play again',

      logEmpty: 'No moves yet. Roll the dice to begin.',
      logTurnStart: "{name}'s turn",
      logJailTurn: '{name} is in jail (attempt {turns})',
      logRoll: '{name} rolled {d1} + {d2} = {sum}',
      logRollAgain: '{name} rolled doubles and rolls again',
      logExtraRoll: '{name} gets an extra roll',
      logTripleDoubles: '{name} rolled doubles three times and goes to jail',
      logPassGo: '{name} passed GO and collected {amount}',
      logLandedFree: '{name} landed on {tile} — price {price}',
      logCannotBuy: '{name} landed on {tile} but cannot afford it ({price})',
      logOwnTile: '{name} landed on their own {tile}',
      logPayRent: '{name} paid {amount} rent to {owner} ({tile})',
      logPayTax: '{name} paid {amount} ({tile})',
      logDrawChance: '{name} drew Chance: {card}',
      logDrawChest: '{name} drew Community Chest: {card}',
      logLandGoToJail: '{name} landed on Go To Jail',
      logGoToJail: '{name} was sent to jail',
      logJustVisiting: '{name} is just visiting the jail',
      logFreeParking: '{name} rests at Free Parking',
      logOnGo: '{name} landed on GO',
      logPayBail: '{name} paid {amount} bail and left jail',
      logStayJail: '{name} rolled no doubles and stays in jail ({turns}/3)',
      logJailDoubles: '{name} rolled doubles and left jail',
      logForcedBail: '{name} failed three times and paid {amount} to leave jail',
      logUseJailCard: '{name} used a Get Out of Jail Free card',
      logJailRoll: '{name} rolled {d1} + {d2} in jail',
      logBuy: '{name} bought {tile} ({price})',
      logDecline: '{name} passed on {tile}',
      logBuild: '{name} built {what} on {tile} (-{cost})',
      logSellHouse: '{name} sold a house on {tile} (+{refund})',
      logAutoSell: '{name} was short on cash and sold a house on {tile} (+{refund})',
      logBankrupt: '{name} went bankrupt and left the game',
      logWin: '{name} is the last player standing!',
      logSettle: 'Round limit reached — {name} wins on net worth',
      logRepair: '{name} paid {amount} for repairs ({houses} houses / {hotels} hotels)',
      logPayEach: '{name} paid {to} {amount}',

      rulesTitle: 'How to play',
      rules: [
        {
          h: 'Goal and turns',
          items: [
            'Everyone starts with $1500 and takes turns rolling two dice.',
            'Pass or land on GO to collect $200. Doubles grant another roll; three doubles in a row send you to jail.',
            'If nobody wins within 30 rounds, the highest net worth (cash + property + buildings) wins.'
          ]
        },
        {
          h: 'Property and rent',
          items: [
            'Landing on an unowned property, railroad or utility lets you buy it at the listed price.',
            "Landing on someone else's property means paying rent — more with houses. Owning a full colour group doubles the base rent.",
            'Railroad rent is 25 / 50 / 100 / 200 by count; utilities charge dice ×4, or ×10 with both.'
          ]
        },
        {
          h: 'Building',
          items: [
            'With a full colour group you may build at the start of your turn, before rolling.',
            'Building must stay even across the group (max difference of 1). Up to 4 houses plus a hotel per lot.',
            'Short on cash? Houses sell automatically at half price; if still short, you go bankrupt.'
          ]
        },
        {
          h: 'Jail and cards',
          items: [
            'In jail you may use a card, pay $50 bail, or roll for doubles. After three failed tries you pay $50.',
            'Chance and Community Chest cards can move you, pay you, bill repairs, or send you to jail.'
          ]
        }
      ]
    }
  };

  function lang() {
    return (GP && GP.i18n.getLang()) || 'zh';
  }

  function t(key, params) {
    var pack = TEXT[lang()] || TEXT.zh;
    var s = pack[key];
    if (s == null) s = TEXT.zh[key];
    if (s == null) return key;
    if (typeof s !== 'string') return s;
    if (!params) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      return params[k] != null ? params[k] : m;
    });
  }

  function money(n) {
    var v = Math.round(n || 0);
    var s = GP && GP.util ? GP.util.formatNumber(v) : String(v);
    return '$' + s;
  }

  function tileName(pos) {
    var tile = D.TILES[pos];
    if (!tile) return '';
    return lang() === 'en' ? tile.name.en : tile.name.zh;
  }

  function typeName(tile) {
    var meta = D.TYPES[tile.type] || D.TYPES.property;
    return lang() === 'en' ? meta.en : meta.zh;
  }

  var CARD_BY_ID = {};
  D.CHANCE.concat(D.CHEST).forEach(function (c) { CARD_BY_ID[c.id] = c; });

  function cardText(id) {
    var c = CARD_BY_ID[id];
    if (!c) return '';
    return lang() === 'en' ? c.text.en : c.text.zh;
  }

  /* ============================================================
   * 状态
   * ========================================================== */

  var G = {
    state: null,
    config: { humans: 1, computers: 3, difficulty: 'medium' },
    stats: { games: 0, wins: 0 },
    preview: -1,
    busy: false,
    rolling: false,
    ended: false,
    drawDone: null,
    focusing: false,
    token: 0,
    timers: [],
    reduceMotion: false,
    diceEls: []
  };

  var PIP = {
    1: [4], 2: [0, 8], 3: [0, 4, 8],
    4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
  };

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function button(label, opts) {
    opts = opts || {};
    var b = el('button', 'pg-btn' + (opts.ghost ? ' pg-btn--ghost' : ''), label);
    if (opts.disabled) b.disabled = true;
    if (opts.title) b.title = opts.title;
    if (opts.onClick) b.addEventListener('click', opts.onClick);
    return b;
  }

  function current() {
    return G.state ? G.state.players[G.state.turn] : null;
  }

  function clearTimers() {
    G.timers.forEach(function (id) { clearTimeout(id); });
    G.timers = [];
    G.token += 1;
    G.focusing = false;
    G.drawDone = null;
    closeModal('draw-modal');
  }

  function schedule(fn, ms) {
    var token = G.token;
    var id = setTimeout(function () {
      if (token !== G.token) return;
      fn();
    }, ms);
    G.timers.push(id);
  }

  function toast(msg) {
    if (GP && GP.ui) GP.ui.toast(msg, 1800);
  }

  /* ============================================================
   * 开局配置
   * ========================================================== */

  function loadConfig() {
    var saved = GP.storage.get('config', null);
    if (saved && typeof saved === 'object') {
      var h = parseInt(saved.humans, 10);
      var c = parseInt(saved.computers, 10);
      if (h >= 1 && h <= 4) G.config.humans = h;
      if (c >= 0 && c <= 4) G.config.computers = c;
      if (saved.difficulty === 'easy' || saved.difficulty === 'medium' || saved.difficulty === 'hard') {
        G.config.difficulty = saved.difficulty;
      }
    }
    var total = G.config.humans + G.config.computers;
    if (total > 4) { G.config.computers = 4 - G.config.humans; }
    if (G.config.humans + G.config.computers < 2) { G.config.computers = 1; }

    var stats = GP.storage.get('stats', null);
    if (stats && typeof stats === 'object') {
      G.stats.games = parseInt(stats.games, 10) || 0;
      G.stats.wins = parseInt(stats.wins, 10) || 0;
    }
  }

  function saveConfig() {
    GP.storage.set('config', G.config);
  }

  function saveStats() {
    GP.storage.set('stats', G.stats);
  }

  /* ============================================================
   * 存档：对局状态整份存进 localStorage，刷新后接着打
   * ========================================================== */

  var SAVE_KEY = 'save';
  var SAVE_VER = 1;
  var SAVE_LOG_MAX = 60;          // 日志只留最近若干条，别把存储撑爆
  var STABLE_PHASES = ['roll', 'jail', 'buy'];
  var saveTimer = null;

  function snapshot() {
    var st = G.state;
    return {
      v: SAVE_VER,
      at: Date.now(),
      config: {
        humans: G.config.humans,
        computers: G.config.computers,
        difficulty: G.config.difficulty
      },
      state: {
        players: st.players,
        owners: st.owners,
        houses: st.houses,
        turn: st.turn,
        round: st.round,
        turnCount: st.turnCount,
        phase: st.phase,
        dice: st.dice,
        doublesCount: st.doublesCount,
        rentBoost: st.rentBoost,
        lastRoll: st.lastRoll,
        pending: st.pending,
        log: st.log.slice(-SAVE_LOG_MAX),
        over: st.over,
        winner: st.winner,
        maxRounds: st.maxRounds,
        seq: st.seq
      }
    };
  }

  /** 只在"玩家要决策"的稳定状态落盘，动画/结算中途存下来会存成半截 */
  function saveNow() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    var st = G.state;
    if (!st || st.over || G.busy) return;
    if (STABLE_PHASES.indexOf(st.phase) === -1) return;
    GP.storage.set(SAVE_KEY, snapshot());
  }

  /** 延后一点再存，避免一次结算里连写十几遍 localStorage */
  function queueSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 140);
  }

  function clearSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    GP.storage.remove(SAVE_KEY);
  }

  function num(v, fallback) {
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }

  /** 读档：把缺字段补全，坏档直接丢掉，别让玩家卡在空棋盘上 */
  function loadSave() {
    var saved = GP.storage.get(SAVE_KEY, null);
    if (!saved) return false;
    if (saved.v !== SAVE_VER || !saved.state) { clearSave(); return false; }

    var st = saved.state;
    if (!st.players || !st.players.length) { clearSave(); return false; }
    if (st.over || STABLE_PHASES.indexOf(st.phase) === -1) { clearSave(); return false; }

    st.players.forEach(function (p, i) {
      p.id = i;
      p.cash = num(p.cash, D.START_CASH);
      p.pos = num(p.pos, 0);
      p.jailFree = num(p.jailFree, 0);
      p.jailTurns = num(p.jailTurns, 0);
      p.doubles = num(p.doubles, 0);
      p.bankruptAt = num(p.bankruptAt, -1);
      p.inJail = !!p.inJail;
      p.alive = p.alive !== false;
      if (!p.name) p.name = t(p.isAi ? 'cpuName' : 'humanName', { n: p.n || i + 1 });
    });

    var total = D.TILES.length;
    st.owners = st.owners || [];
    st.houses = st.houses || [];
    for (var i = 0; i < total; i += 1) {
      if (typeof st.owners[i] !== 'number') st.owners[i] = -1;
      if (typeof st.houses[i] !== 'number') st.houses[i] = 0;
    }
    st.owners.length = total;
    st.houses.length = total;
    st.log = st.log || [];
    st.dice = st.dice && st.dice.length === 2 ? st.dice : [0, 0];
    st.turn = Math.min(num(st.turn, 0), st.players.length - 1);
    st.round = num(st.round, 1);
    st.turnCount = num(st.turnCount, 0);
    st.doublesCount = num(st.doublesCount, 0);
    st.rentBoost = num(st.rentBoost, 1);
    st.maxRounds = num(st.maxRounds, D.MAX_ROUNDS);
    st.seq = num(st.seq, 0);
    st.over = false;

    if (saved.config) {
      var h = parseInt(saved.config.humans, 10);
      var c = parseInt(saved.config.computers, 10);
      if (h >= 1 && h <= 4) G.config.humans = h;
      if (c >= 0 && c <= 4) G.config.computers = c;
      if (saved.config.difficulty) G.config.difficulty = saved.config.difficulty;
    }

    G.state = st;
    G.preview = -1;
    G.busy = false;
    G.rolling = false;
    G.ended = false;
    G.focusing = false;
    return true;
  }

  function renderSetup() {
    $('humans-val').textContent = G.config.humans;
    $('computers-val').textContent = G.config.computers;

    var total = G.config.humans + G.config.computers;
    $('setup-total').textContent = t('totalPlayers', {
      n: total, h: G.config.humans, c: G.config.computers
    });

    Array.prototype.forEach.call($('diff-seg').children, function (b) {
      b.classList.toggle('active', b.getAttribute('data-diff') === G.config.difficulty);
    });

    $('setup-stats').textContent = G.stats.games
      ? t('statsLine', { games: G.stats.games, wins: G.stats.wins })
      : t('noStats');

    $('btn-start').disabled = total < 2 || total > 4;
  }

  function changeCount(kind, dir) {
    var c = G.config;
    var min = kind === 'humans' ? 1 : 0;
    var next = c[kind] + dir;
    if (next < min || next > 4) return;

    var other = kind === 'humans' ? 'computers' : 'humans';
    var otherMin = other === 'humans' ? 1 : 0;
    if (next + c[other] > 4) {
      if (c[other] > otherMin) c[other] -= 1;
      else return;
    }
    if (next + c[other] < 2) return;

    c[kind] = next;
    saveConfig();
    renderSetup();
  }

  /* ============================================================
   * 建局
   * ========================================================== */

  function startGame() {
    var total = G.config.humans + G.config.computers;
    if (total < 2) { toast(t('tooFew')); return; }
    if (total > 4) { toast(t('tooMany')); return; }

    clearTimers();
    G.preview = -1;
    G.busy = false;
    G.rolling = false;
    G.ended = false;
    G.drawDone = null;
    G.focusing = false;
    $('roll-total').classList.remove('show');

    var defs = [];
    var hi = 0, ci = 0;
    while (hi < G.config.humans || ci < G.config.computers) {
      if (hi < G.config.humans) {
        defs.push({ name: t('humanName', { n: hi + 1 }), isAi: false, color: COLORS[defs.length % COLORS.length], kind: 'human', n: hi + 1 });
        hi += 1;
      }
      if (ci < G.config.computers) {
        defs.push({ name: t('cpuName', { n: CPU_LETTERS[ci] }), isAi: true, color: COLORS[defs.length % COLORS.length], kind: 'cpu', n: CPU_LETTERS[ci] });
        ci += 1;
      }
    }

    G.state = R.createGame({ players: defs });
    closeModal('setup-modal');
    closeModal('end-modal');
    saveConfig();

    renderAll();
    saveNow();               // 新开一局立刻落盘，刷新后能从第一回合接着打
    schedule(afterTurnStart, 0);
  }

  /** 语言切换后重建玩家名，并同步历史日志里的称呼 */
  function refreshNames() {
    if (!G.state) return;
    var map = {};
    G.state.players.forEach(function (p) {
      if (!p.kind) return;
      var old = p.name;
      var next = p.kind === 'cpu' ? t('cpuName', { n: p.n }) : t('humanName', { n: p.n });
      if (next !== old) map[old] = next;
      p.name = next;
    });
    if (!Object.keys(map).length) return;
    G.state.log.forEach(function (entry) {
      ['name', 'owner', 'to'].forEach(function (key) {
        var v = entry.params[key];
        if (v && map[v]) entry.params[key] = map[v];
      });
    });
  }

  /* 节奏：一次掷骰的所有停顿都在这里调 */
  var PACE = {
    focusHold: 760,   // 推近后停在玩家区域（推近本身是瞬时的，不做放大补间）
    focusOut: 520,    // 退回全景
    tumble: 13,       // 骰子翻滚帧数
    total: 720,       // 点数停留
    step: 232,        // 每格用时
    arrive: 420       // 落定后喘一口气
  };

  function afterTurnStart() {
    if (!G.state || G.state.over) return;
    var p = current();
    if (!p) return;

    G.busy = true;
    G.focusing = true;
    G.preview = -1;
    renderAll();
    Map2D.revealTile(p.pos);

    // 减少动画：不做任何镜头推拉，喊一声是谁的回合就把控制权交回去
    if (G.reduceMotion) {
      G.focusing = false;
      G.busy = false;
      flashBoard(t('turnFocus', { name: p.name }), 'turn', 320);
      renderControls();
      queueSave();
      if (p.isAi) schedule(aiTurn, 160);
      return;
    }

    // 回合开场：镜头直接切到玩家所在区域的最大推近（不做放大补间），看一眼周围再退回全景
    var quick = p.isAi;
    var hold = quick ? 440 : PACE.focusHold;
    Map2D.focus(p.pos, quick ? 1.85 : 2.05, 0);
    flashBoard(t('turnFocus', { name: p.name }), 'turn', hold);

    schedule(function () {
      Map2D.unfocus(quick ? 340 : PACE.focusOut);
      schedule(function () {
        G.focusing = false;
        G.busy = false;
        renderControls();
        queueSave();
        if (p.isAi) schedule(aiTurn, 160);
      }, quick ? 280 : 460);
    }, hold);
  }

  /* ============================================================
   * 回合驱动
   * ========================================================== */

  function animateDice(dice, cb, quick) {
    G.rolling = true;
    var els = G.diceEls;
    els.forEach(function (e) { e.classList.add('rolling'); e.classList.remove('settled'); });

    var frames = G.reduceMotion ? 1 : (quick ? 6 : PACE.tumble);
    var n = 0;

    function frame() {
      n += 1;
      if (n < frames) {
        setDie(els[0], 1 + Math.floor(Math.random() * 6));
        setDie(els[1], 1 + Math.floor(Math.random() * 6));
        // 越滚越慢，最后几帧拖出一点悬念
        var gap = 46 + Math.pow(n / frames, 2) * 92;
        schedule(frame, gap);
        return;
      }
      els.forEach(function (e) { e.classList.remove('rolling'); e.classList.add('settled'); });
      setDie(els[0], dice[0]);
      setDie(els[1], dice[1]);
      G.rolling = false;
      schedule(cb, G.reduceMotion ? 40 : (quick ? 120 : 200));
    }
    frame();
  }

  /** 点数大字弹出，停留一下再继续 */
  function showRollTotal(n, cb, quick) {
    var box = $('roll-total');
    if (!box) { cb(); return; }
    box.innerHTML = '';
    box.appendChild(el('b', '', String(n)));
    box.appendChild(el('i', '', t('rollUnit')));
    box.classList.add('show');
    schedule(function () {
      box.classList.remove('show');
      schedule(cb, 90);
    }, G.reduceMotion ? 160 : (quick ? 320 : PACE.total));
  }

  function doRoll() {
    if (!G.state || G.state.over || G.busy || G.state.phase !== 'roll') return;
    G.busy = true;
    G.preview = -1;

    var ai = !!current().isAi;
    var res = R.roll(G.state);
    if (!res) { G.busy = false; return; }

    S.dice();
    renderControls();
    Map2D.unfocus(G.reduceMotion ? 0 : 400);

    animateDice(res.roll.dice, function () {
      var sum = res.roll.dice[0] + res.roll.dice[1];
      showRollTotal(sum, function () {
        if (res.roll.jailed) {
          handleEvents(res.events);
          renderAll();
          schedule(function () { G.busy = false; endTurnAndContinue(); }, 820);
          return;
        }
        moveSteps(res.roll.steps, function (stepEvents) {
          resolveLanding(stepEvents);
        });
      }, ai);
    }, ai);
  }

  /** 一格一格走：镜头跟着棋子，每步一个小跳 */
  function moveSteps(steps, done) {
    var acc = [];

    if (G.reduceMotion) {
      for (var i = 0; i < steps; i++) {
        acc = acc.concat(R.step(G.state));
      }
      G.preview = -1;
      renderAll();
      done(acc);
      return;
    }

    var p = current();
    Map2D.focus(p.pos, 1.72, 400);

    var walked = 0;

    function tick() {
      if (walked >= steps) {
        Map2D.unfocus(560);
        schedule(function () { done(acc); }, PACE.arrive);
        return;
      }
      acc = acc.concat(R.step(G.state));
      walked += 1;
      S.step();
      G.preview = -1;
      renderAll();
      Map2D.follow(current().pos, 1.72, 210);
      schedule(tick, PACE.step);
    }
    schedule(tick, 260);
  }

  function resolveLanding(moveEvents) {
    var before = G.state.log.length;
    var out = R.land(G.state);
    var events = moveEvents.concat(out.events || []);
    var fresh = G.state.log.slice(before);

    // 先把"刚刚发生了什么"讲清楚，再把状态变化落到界面上
    promptLanding(events, fresh, function () {
      handleEvents(events);
      renderAll();
      settleLanding(out);
    });
  }

  function settleLanding(out) {
    if (G.state.over) {
      G.busy = false;
      finishGame();
      return;
    }

    if (G.state.phase === 'buy') {
      if (current().isAi) {
        schedule(aiBuy, 480);
      } else {
        G.busy = false;
        renderAll();
      }
      return;
    }

    schedule(function () {
      G.busy = false;
      endTurnAndContinue();
    }, 640);
  }

  /** 落点提示：抽卡走弹窗，其余用棋盘上的一条浮动提示 */
  function promptLanding(events, fresh, done) {
    var card = null;
    for (var i = events.length - 1; i >= 0; i--) {
      if (events[i] && events[i].type === 'card') { card = events[i]; break; }
    }

    if (card) {
      openDraw(card, done);
      return;
    }

    var line = effectLine(fresh);
    if (!line) { done(); return; }

    flashBoard(line.text, line.tone, G.reduceMotion ? 560 : 1150);
    schedule(done, G.reduceMotion ? 260 : 940);
  }

  /** 棋盘上方的一条浮动提示 */
  function flashBoard(text, tone, ms) {
    var b = $('board-flash');
    if (!b) return;
    b.className = 'board-flash' + (tone === 'gain' || tone === 'loss' ? ' ' + tone : '');
    b.textContent = text;
    void b.offsetWidth;              // 强制重排，保证连续提示也能重新播动画
    b.classList.add('show');
    schedule(function () { b.classList.remove('show'); }, ms || 1200);
  }

  /** 这些日志不必单独提示：买地有按钮、踩空地无事发生 */
  var LAND_QUIET = {
    turnStart: 1, ownTile: 1, landedFree: 1, justVisiting: 1,
    freeParking: 1, onGo: 1, jailTurn: 1
  };

  function effectLine(fresh) {
    var parts = [], tone = '';
    for (var i = 0; i < fresh.length && parts.length < 2; i++) {
      var e = fresh[i];
      if (!e || LAND_QUIET[e.key]) continue;
      var info = describeLog(e);
      if (!info || !info.text) continue;
      parts.push(info.text);
      if (e.key === 'payRent' || e.key === 'payTax' ||
        e.key === 'landGoToJail' || e.key === 'cannotBuy') tone = 'loss';
      else if (e.key === 'passGo' && !tone) tone = 'gain';
    }
    if (!parts.length) return null;
    return { text: parts.join(' · '), tone: tone };
  }

  /* ---------------- 抽卡弹窗 ---------------- */

  /** 卡面符号：一眼看出这张卡是给钱、走路还是进监狱 */
  function cardGlyph(id) {
    var c = CARD_BY_ID[id];
    if (!c || !c.effect) return '?';
    var eff = c.effect;
    if (eff.kind === 'money') return eff.amount >= 0 ? '💰' : '💸';
    if (eff.kind === 'move' || eff.kind === 'moveBy' || eff.kind === 'nearest') return '➡️';
    if (eff.kind === 'jail') return '🚓';
    if (eff.kind === 'jailFree') return '🔑';
    if (eff.kind === 'repair') return '🔧';
    if (eff.kind === 'payEach') return '🤝';
    return '?';
  }

  function openDraw(card, done) {
    var deckName = card.deck === 'chance' ? 'chance' : 'chest';
    var deck = $('draw-deck');
    var textEl = $('draw-text');
    var okBtn = $('btn-draw-ok');
    if (!deck || !textEl) { done(); return; }

    deck.innerHTML = '';
    textEl.textContent = '';
    textEl.classList.remove('show');
    okBtn.classList.remove('show');
    $('draw-kicker').textContent = deckName === 'chance' ? t('drawChance') : t('drawChest');
    $('draw-hint').textContent = t('drawShuffling');

    var total = 5, pick = 2, cards = [];
    for (var i = 0; i < total; i++) {
      var node = el('div', 'draw-card shuffling');
      node.style.setProperty('--dx', ((i - (total - 1) / 2) * 31) + 'px');
      node.style.setProperty('--rot', ((i - (total - 1) / 2) * 7) + 'deg');
      node.style.setProperty('--i', String(i));
      var inner = el('div', 'draw-inner');
      inner.appendChild(el('div', 'draw-face draw-back', deckName === 'chance' ? '?' : '★'));
      inner.appendChild(el('div', 'draw-face draw-front', cardGlyph(card.card)));
      node.appendChild(inner);
      deck.appendChild(node);
      cards.push(node);
    }

    G.drawDone = done;
    openModal('draw-modal');

    // 洗牌 → 抽中一张 → 翻开 → 揭示内容
    schedule(function () {
      cards.forEach(function (c, idx) {
        c.classList.remove('shuffling');
        if (idx !== pick) c.classList.add('gone');
      });
      var picked = cards[pick];
      picked.classList.add('picked');
      schedule(function () { picked.classList.add('flip'); }, G.reduceMotion ? 30 : 200);
      schedule(function () {
        $('draw-hint').textContent = t('drawKicker');
        textEl.textContent = cardText(card.card);
        textEl.classList.add('show');
        okBtn.classList.add('show');
        var p = current();
        if (p && p.isAi) schedule(closeDraw, 1900);   // 电脑自动收下
      }, G.reduceMotion ? 90 : 900);
    }, G.reduceMotion ? 240 : 1050);
  }

  function closeDraw() {
    var fn = G.drawDone;
    G.drawDone = null;
    if (!fn) return;
    closeModal('draw-modal');
    schedule(fn, 220);
  }

  function endTurnAndContinue() {
    if (!G.state || G.state.over) return;
    var res = R.endTurn(G.state);

    if (G.state.over) {
      finishGame();
      return;
    }

    if (res.again) {
      G.preview = -1;
      G.busy = false;
      renderAll();
      if (current().isAi) schedule(aiTurn, 400);
      return;
    }

    afterTurnStart();
  }

  function doJail(action) {
    if (!G.state || G.state.over || G.busy || G.state.phase !== 'jail') return;
    G.busy = true;

    var p = current();
    var res = R.jailAction(G.state, action);
    if (!res) { G.busy = false; return; }

    handleEvents(res.events);
    renderAll();

    if (G.state.over) {
      G.busy = false;
      finishGame();
      return;
    }

    // 交保释金时破产：不再移动，直接结束回合
    if (!p.alive) {
      G.busy = false;
      schedule(function () { endTurnAndContinue(); }, 780);
      return;
    }

    if (res.roll && res.roll.steps > 0) {
      animateDice(res.roll.dice, function () {
        moveSteps(res.roll.steps, function (evs) { resolveLanding(evs); });
      });
      return;
    }

    if (action === 'roll') {
      animateDice(res.roll.dice, function () {
        G.busy = false;
        renderAll();
        if (res.staying) {
          schedule(function () { endTurnAndContinue(); }, 820);
        }
      });
      return;
    }

    G.busy = false;
    renderAll();

    // 电脑交完保释金 / 用完卡后，还要继续掷骰
    if (p.isAi && G.state.phase === 'roll') schedule(aiTurn, 460);
  }

  function humanBuy(choice) {
    if (!G.state || G.state.phase !== 'buy' || G.busy) return;
    var ev = choice === 'buy' ? R.buy(G.state) : R.decline(G.state);
    if (choice === 'buy' && !ev) { toast(t('notEnough')); return; }
    if (ev) handleEvents([ev]);
    G.busy = true;
    renderAll();
    schedule(function () { G.busy = false; endTurnAndContinue(); }, 720);
  }

  function aiBuy() {
    if (!G.state || G.state.phase !== 'buy') return;
    var decision = AI.buyDecision(G.state, G.config.difficulty);
    var ev = decision === 'buy' ? R.buy(G.state) : R.decline(G.state);
    if (!ev && decision === 'buy') ev = R.decline(G.state);
    if (ev) handleEvents([ev]);
    renderAll();
    schedule(function () { endTurnAndContinue(); }, 760);
  }

  function aiTurn() {
    if (!G.state || G.state.over || G.busy) return;
    var p = current();
    if (!p || !p.isAi) return;

    if (G.state.phase === 'jail') {
      doJail(AI.jailDecision(G.state, G.config.difficulty));
      return;
    }
    if (G.state.phase === 'buy') { aiBuy(); return; }
    if (G.state.phase !== 'roll') return;

    var pos = AI.buildPlan(G.state, G.config.difficulty);
    if (pos >= 0) {
      var ev = R.build(G.state, pos);
      if (ev) {
        handleEvents([ev]);
        renderAll();
        schedule(aiTurn, 430);
        return;
      }
    }
    doRoll();
  }

  function finishGame() {
    if (G.ended) return;
    G.ended = true;
    G.busy = false;
    clearSave();                 // 打完的局不用再恢复，刷新鲜开来下一把
    renderAll();

    var winner = G.state.players[G.state.winner];
    if (winner && !winner.isAi) S.win(); else S.lose();

    G.stats.games += 1;
    if (winner && !winner.isAi) G.stats.wins += 1;
    saveStats();

    showEnd();
  }

  function handleEvents(events) {
    (events || []).forEach(function (e) {
      if (!e) return;
      if (e.type === 'money') {
        if (e.delta > 0) S.coin(); else S.pay();
        Map2D.pop(e.player, (e.delta > 0 ? '+' : '−') + money(Math.abs(e.delta)), e.delta > 0 ? 'gain' : 'loss');
      } else if (e.type === 'jail') {
        S.jail();
      } else if (e.type === 'buy' || e.type === 'build' || e.type === 'sell') {
        S.buy();
      } else if (e.type === 'card') {
        S.card();
      } else if (e.type === 'win') {
        S.win();
      }
    });
  }

  /* ============================================================
   * 渲染
   * ========================================================== */

  function renderAll() {
    renderPlayers();
    renderBoardHead();
    renderControls();
    renderMap();
    renderLog();
    renderTileCard();
    renderRound();
    queueSave();
  }

  function renderRound() {
    if (!G.state) {
      $('round-badge').textContent = '';
      $('log-round').textContent = '';
      return;
    }
    var label = t('roundBadge', { n: G.state.round, max: G.state.maxRounds });
    $('round-badge').textContent = label;
    $('log-round').textContent = label;
  }

  function renderPlayers() {
    var box = $('players');
    box.innerHTML = '';
    if (!G.state) return;

    G.state.players.forEach(function (p, i) {
      var card = el('div', 'pcard');
      if (i === G.state.turn && p.alive) card.classList.add('active');
      if (!p.alive) card.classList.add('dead');

      var top = el('div', 'pcard-top');
      var dot = el('span', 'token-dot');
      dot.style.background = p.color;
      top.appendChild(dot);
      top.appendChild(el('span', 'pcard-name', p.name));
      if (p.isAi) top.appendChild(el('span', 'pcard-tag', lang() === 'en' ? 'CPU' : '电脑'));
      card.appendChild(top);

      var cash = el('div', 'pcard-cash', money(p.cash));
      if (!p.alive) cash.textContent = t('bankruptNow');
      card.appendChild(cash);

      var meta = el('div', 'pcard-meta');
      var pos = el('span', '', p.alive ? tileName(p.pos) : '—');
      var props = el('span', '', p.alive ? (R.propertyCount(G.state, p.id) + (lang() === 'en' ? ' props' : ' 处地产')) : '');
      meta.appendChild(pos);
      meta.appendChild(props);
      card.appendChild(meta);

      if (p.alive && p.inJail) {
        var jail = el('div', 'pcard-meta');
        jail.appendChild(el('span', 'pcard-jail', (lang() === 'en' ? 'In jail ' : '监狱 ') + p.jailTurns + '/3'));
        if (p.jailFree > 0) {
          jail.appendChild(el('span', '', lang() === 'en' ? p.jailFree + ' jail card' : '出狱卡 ×' + p.jailFree));
        }
        card.appendChild(jail);
      }

      box.appendChild(card);
    });
  }

  /** 棋盘头部：回合说明 + 玩家图例（棋子上的数字与颜色对应） */
  function renderBoardHead() {
    var sub = $('board-sub');
    var legend = $('board-legend');
    legend.innerHTML = '';
    if (!G.state) {
      sub.textContent = '';
      return;
    }
    sub.textContent = t('boardSub', { n: G.state.round, max: G.state.maxRounds });

    G.state.players.forEach(function (p) {
      var chip = el('span', 'legend-item');
      if (p.alive && p.id === G.state.turn) chip.classList.add('active');
      if (!p.alive) chip.classList.add('dead');
      var dot = el('span', 'legend-dot', String(p.id + 1));
      dot.style.background = p.color;
      chip.appendChild(dot);
      chip.appendChild(el('span', 'legend-name', p.name));
      chip.title = p.name;
      legend.appendChild(chip);
    });
  }

  function tileDesc(pos, tile, owner) {
    var s = G.state;
    if (tile.type === 'property') {
      if (owner < 0) {
        return t('descPropertyFree', { price: money(tile.price), rent: money(tile.rent[0]) });
      }
      return t('descPropertyOwned', {
        owner: s.players[owner].name,
        rent: money(R.rentOf(s, pos, 1))
      });
    }
    if (tile.type === 'railroad') {
      if (owner < 0) return t('descRailroadFree', { price: money(tile.price) });
      return t('descRailroadOwned', {
        owner: s.players[owner].name,
        rent: money(R.rentOf(s, pos, 1))
      });
    }
    if (tile.type === 'utility') {
      if (owner < 0) return t('descUtilityFree', { price: money(tile.price) });
      return t('descUtilityOwned', {
        owner: s.players[owner].name,
        rent: money(R.rentOf(s, pos, 1))
      });
    }
    if (tile.type === 'tax') return t('descTax', { amount: money(tile.amount) });
    if (tile.type === 'chance') return t('descChance');
    if (tile.type === 'chest') return t('descChest');
    if (tile.type === 'go') return t('descGo', { amount: money(D.GO_SALARY) });
    if (tile.type === 'jail') return t('descJail');
    if (tile.type === 'parking') return t('descParking');
    if (tile.type === 'gotojail') return t('descGoToJail');
    return '';
  }

  function doBuild(pos) {
    if (!G.state || G.busy) return;
    var ev = R.build(G.state, pos);
    if (!ev) return;
    handleEvents([ev]);
    renderAll();
  }

  function doSell(pos) {
    if (!G.state || G.busy) return;
    var ev = R.sellHouse(G.state, pos);
    if (!ev) return;
    handleEvents([ev]);
    renderAll();
  }

  function renderControls() {
    var actions = $('actions');
    actions.innerHTML = '';
    var turnName = $('turn-name');
    var turnSub = $('turn-sub');
    turnName.innerHTML = '';

    if (!G.state) {
      turnSub.textContent = '';
      renderDice([0, 0]);
      return;
    }

    var p = current();

    if (!G.rolling) renderDice(G.state.dice);

    var dot = el('span', 'dot');
    dot.style.background = p.color;
    turnName.appendChild(dot);
    turnName.appendChild(document.createTextNode(p.name));

    if (G.state.over) {
      turnSub.textContent = '';
      actions.appendChild(button(t('viewEnd'), { onClick: showEnd }));
      return;
    }

    if (!p.alive) {
      turnSub.textContent = t('bankruptNow');
      return;
    }

    if (p.isAi) {
      turnSub.textContent = t('aiThinking', { name: p.name });
      return;
    }

    if (G.focusing) {
      turnSub.textContent = t('turnFocusHint');
      actions.appendChild(button(t('roll'), { ghost: true, disabled: true }));
      return;
    }

    if (G.state.phase === 'roll') {
      turnSub.textContent = t('rollPrompt');
      actions.appendChild(button(t('roll'), {
        disabled: G.busy,
        onClick: doRoll
      }));
      return;
    }

    if (G.state.phase === 'jail') {
      turnSub.textContent = t('jailPrompt');
      if (p.jailFree > 0) {
        actions.appendChild(button(t('jailCard', { n: p.jailFree }), {
          disabled: G.busy,
          onClick: function () { doJail('card'); }
        }));
      }
      actions.appendChild(button(t('jailPay', { amount: money(D.JAIL_FINE) }), {
        ghost: true,
        disabled: G.busy,
        onClick: function () { doJail('pay'); }
      }));
      actions.appendChild(button(t('jailRoll'), {
        ghost: true,
        disabled: G.busy,
        onClick: function () { doJail('roll'); }
      }));
      return;
    }

    if (G.state.phase === 'buy') {
      var pend = G.state.pending;
      turnSub.textContent = t('buyPrompt');
      if (pend) {
        actions.appendChild(button(t('buy', { price: money(pend.price) }), {
          disabled: G.busy,
          onClick: function () { humanBuy('buy'); }
        }));
        actions.appendChild(button(t('decline'), {
          ghost: true,
          disabled: G.busy,
          onClick: function () { humanBuy('decline'); }
        }));
      }
      return;
    }

    turnSub.textContent = t('waiting');
    actions.appendChild(button(t('waiting'), { ghost: true, disabled: true }));
  }

  function renderDice(dice) {
    if (!G.diceEls.length) return;
    setDie(G.diceEls[0], dice[0] || 0);
    setDie(G.diceEls[1], dice[1] || 0);
  }

  function setDie(die, value) {
    if (!die) return;
    var cells = die.children;
    var on = PIP[value] || [];
    for (var i = 0; i < cells.length; i++) {
      cells[i].classList.toggle('on', on.indexOf(i) !== -1);
    }
    die.setAttribute('data-v', value);
  }

  function boardLabels() {
    var p = current();
    var notes = [];
    for (var i = G.state.log.length - 1; i >= 0 && notes.length < 2; i--) {
      var txt = describeLog(G.state.log[i]).text || '';
      if (txt.length > 32) txt = txt.slice(0, 32) + '…';
      notes.push(txt);
    }
    return {
      title: t('mapWatermark'),
      round: t('boardSub', { n: G.state.round, max: G.state.maxRounds }),
      turn: p ? p.name : '',
      turnColor: p ? p.color : '',
      cash: p ? money(p.cash) : '',
      dice: G.state.dice || [0, 0],
      hint: t('boardHint'),
      notes: notes
    };
  }

  function renderIdleBoard() {
    Map2D.idle({
      lang: lang(),
      labels: {
        title: t('mapWatermark'),
        round: '',
        turn: '',
        turnColor: '',
        cash: '',
        dice: [0, 0],
        hint: t('boardIdle'),
        notes: []
      }
    });
  }

  function renderMap() {
    if (!G.state) {
      renderIdleBoard();
      return;
    }
    Map2D.update(G.state, G.state.players, {
      labels: boardLabels(),
      lang: lang(),
      selected: G.preview
    });
  }

  function renderLog() {
    var box = $('log');
    box.innerHTML = '';

    if (!G.state || !G.state.log.length) {
      box.appendChild(el('div', 'log-item system', t('logEmpty')));
      return;
    }

    var entries = G.state.log.slice(-40);
    entries.forEach(function (entry) {
      var info = describeLog(entry);
      var item = el('div', 'log-item ' + info.cls);
      item.appendChild(el('span', 'log-dot'));
      item.appendChild(el('span', '', info.text));
      box.appendChild(item);
    });

    box.scrollTop = box.scrollHeight;
  }

  function describeLog(entry) {
    var p = entry.params || {};
    var text = '';
    var cls = '';

    switch (entry.key) {
      case 'turnStart':
        text = t('logTurnStart', { name: p.name }); cls = 'system'; break;
      case 'jailTurn':
        text = t('logJailTurn', { name: p.name, turns: p.turns }); cls = 'warn'; break;
      case 'roll':
        text = t('logRoll', { name: p.name, d1: p.d1, d2: p.d2, sum: (p.d1 || 0) + (p.d2 || 0) }); break;
      case 'rollAgain':
        text = t('logRollAgain', { name: p.name }); cls = 'warn'; break;
      case 'extraRoll':
        text = t('logExtraRoll', { name: p.name }); cls = 'system'; break;
      case 'tripleDoubles':
        text = t('logTripleDoubles', { name: p.name }); cls = 'warn'; break;
      case 'passGo':
        text = t('logPassGo', { name: p.name, amount: money(p.amount) }); cls = 'gain'; break;
      case 'landedFree':
        text = t('logLandedFree', { name: p.name, tile: tileName(p.tile), price: money(p.price) }); break;
      case 'cannotBuy':
        text = t('logCannotBuy', { name: p.name, tile: tileName(p.tile), price: money(p.price) }); cls = 'warn'; break;
      case 'ownTile':
        text = t('logOwnTile', { name: p.name, tile: tileName(p.tile) }); break;
      case 'payRent':
        text = t('logPayRent', {
          name: p.name, owner: p.owner, tile: tileName(p.tile), amount: money(p.amount)
        }); cls = 'loss'; break;
      case 'payTax':
        text = t('logPayTax', { name: p.name, tile: tileName(p.tile), amount: money(p.amount) }); cls = 'loss'; break;
      case 'drawChance':
        text = t('logDrawChance', { name: p.name, card: cardText(p.card) }); break;
      case 'drawChest':
        text = t('logDrawChest', { name: p.name, card: cardText(p.card) }); break;
      case 'landGoToJail':
        text = t('logLandGoToJail', { name: p.name }); cls = 'warn'; break;
      case 'goToJail':
        text = t('logGoToJail', { name: p.name }); cls = 'warn'; break;
      case 'justVisiting':
        text = t('logJustVisiting', { name: p.name }); break;
      case 'freeParking':
        text = t('logFreeParking', { name: p.name }); break;
      case 'onGo':
        text = t('logOnGo', { name: p.name }); break;
      case 'payBail':
        text = t('logPayBail', { name: p.name, amount: money(p.amount) }); cls = 'loss'; break;
      case 'stayJail':
        text = t('logStayJail', { name: p.name, turns: p.turns }); cls = 'warn'; break;
      case 'jailDoubles':
        text = t('logJailDoubles', { name: p.name }); cls = 'gain'; break;
      case 'forcedBail':
        text = t('logForcedBail', { name: p.name, amount: money(p.amount) }); cls = 'loss'; break;
      case 'useJailCard':
        text = t('logUseJailCard', { name: p.name }); break;
      case 'jailRoll':
        text = t('logJailRoll', { name: p.name, d1: p.d1, d2: p.d2 }); break;
      case 'buy':
        text = t('logBuy', { name: p.name, tile: tileName(p.tile), price: money(p.price) }); cls = 'gain'; break;
      case 'decline':
        text = t('logDecline', { name: p.name, tile: tileName(p.tile) }); break;
      case 'build':
        text = t('logBuild', {
          name: p.name, tile: tileName(p.tile),
          what: p.houses >= 5 ? t('hotel') : t('houseN', { n: p.houses }),
          cost: money(p.cost)
        }); break;
      case 'sellHouse':
        text = t('logSellHouse', { name: p.name, tile: tileName(p.tile), refund: money(p.refund) }); cls = 'gain'; break;
      case 'autoSell':
        text = t('logAutoSell', { name: p.name, tile: tileName(p.tile), refund: money(p.refund) }); cls = 'warn'; break;
      case 'bankrupt':
        text = t('logBankrupt', { name: p.name }); cls = 'loss'; break;
      case 'win':
        text = t('logWin', { name: p.name }); cls = 'gain'; break;
      case 'settle':
        text = t('logSettle', { name: p.name }); cls = 'gain'; break;
      case 'repair':
        text = t('logRepair', {
          name: p.name, amount: money(p.amount), houses: p.houses, hotels: p.hotels
        }); cls = 'loss'; break;
      case 'payEach':
        text = t('logPayEach', { name: p.name, to: p.to, amount: money(p.amount) }); cls = 'loss'; break;
      default:
        text = entry.key;
    }

    return { text: text, cls: cls };
  }

  function renderTileCard() {
    var box = $('tile-card');
    box.innerHTML = '';
    if (!G.state) return;

    var pos = G.preview >= 0 ? G.preview : current().pos;
    var tile = D.TILES[pos];
    var owner = G.state.owners[pos];
    var houses = G.state.houses[pos];

    var head = el('div', 'tile-head');
    var nameBox = el('div');
    nameBox.appendChild(el('div', 'tile-name', tileName(pos)));
    nameBox.appendChild(el('div', 'tile-row', t('tileIndex', { n: pos })));
    head.appendChild(nameBox);
    head.appendChild(el('span', 'tile-type', typeName(tile)));
    box.appendChild(head);

    var buyable = tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility';
    if (buyable) {
      box.appendChild(row(t('price'), money(tile.price)));
      box.appendChild(row(t('ownerLabel'), owner >= 0 ? G.state.players[owner].name : t('unowned')));
    }

    if (tile.type === 'property') {
      box.appendChild(row(t('housesLabel'), houses >= 5 ? t('hotel') : t('houseN', { n: houses })));
      box.appendChild(row(t('rentNow'), money(owner >= 0 ? R.rentOf(G.state, pos, 1) : tile.rent[0])));

      var table = el('div', 'rent-table');
      var rows = [
        [t('rentBase'), tile.rent[0]],
        [t('rentFull'), tile.rent[0] * 2],
        [t('rentH', { n: 1 }), tile.rent[1]],
        [t('rentH', { n: 2 }), tile.rent[2]],
        [t('rentH', { n: 3 }), tile.rent[3]],
        [t('rentH', { n: 4 }), tile.rent[4]],
        [t('rentHotel'), tile.rent[5]]
      ];
      rows.forEach(function (r, i) {
        table.appendChild(el('span', i === 1 ? 'full' : '', r[0]));
        table.appendChild(el('b', i === 1 ? 'full' : '', money(r[1])));
      });
      box.appendChild(table);
    } else if (tile.type === 'railroad') {
      var railN = owner >= 0 ? R.countOwnedOfType(G.state, owner, 'railroad') : 0;
      box.appendChild(row(t('railCount', { n: railN }), money(R.rentOf(G.state, pos, 1))));
      var rt = el('div', 'rent-table');
      [1, 2, 3, 4].forEach(function (n) {
        rt.appendChild(el('span', '', lang() === 'en' ? n + ' railroad(s)' : n + ' 条'));
        rt.appendChild(el('b', '', money(25 * Math.pow(2, n - 1))));
      });
      box.appendChild(rt);
    } else if (tile.type === 'utility') {
      var utilN = owner >= 0 ? R.countOwnedOfType(G.state, owner, 'utility') : 0;
      box.appendChild(row(t('utilCount', { n: utilN }), ''));
      var ut = el('div', 'rent-table');
      ut.appendChild(el('span', '', lang() === 'en' ? '1 utility' : '1 家'));
      ut.appendChild(el('b', '', lang() === 'en' ? 'dice ×4' : '骰子 ×4'));
      ut.appendChild(el('span', '', lang() === 'en' ? '2 utilities' : '2 家'));
      ut.appendChild(el('b', '', lang() === 'en' ? 'dice ×10' : '骰子 ×10'));
      box.appendChild(ut);
    } else if (tile.type === 'tax') {
      box.appendChild(row(lang() === 'en' ? 'Tax' : '税费', money(tile.amount)));
    } else if (tile.type === 'go') {
      box.appendChild(row(t('salary'), money(D.GO_SALARY)));
    }

    box.appendChild(el('div', 'tile-hint', tileDesc(pos, tile, owner)));

    renderTileActions(box, pos);

    if (G.preview >= 0) {
      var back = button(t('backToHere'), { ghost: true, onClick: backToHere });
      back.classList.add('tile-back');
      box.appendChild(back);
    } else {
      box.appendChild(el('div', 'tile-tip', t('inspectTip')));
    }
  }

  /** 当前真人对这块地可执行的操作（建房 / 卖房） */
  function renderTileActions(box, pos) {
    if (!G.state || G.state.over) return;
    var p = current();
    if (!p || !p.alive || p.isAi || G.busy) return;
    if (G.state.phase !== 'roll' || pos !== p.pos) return;

    var tile = D.TILES[pos];
    if (tile.type !== 'property') return;

    var wrap = el('div', 'tile-actions');
    var cb = R.canBuild(G.state, pos, p.id);
    if (cb.ok) {
      wrap.appendChild(button(t('build', { cost: money(cb.cost) }), {
        onClick: function () { doBuild(pos); }
      }));
    }
    var cs = R.canSellHouse(G.state, pos, p.id);
    if (cs.ok) {
      wrap.appendChild(button(t('sell', { refund: '+' + money(cs.refund) }), {
        ghost: true,
        onClick: function () { doSell(pos); }
      }));
    }
    if (!wrap.children.length) {
      if (G.state.houses[pos] >= 5) {
        wrap.appendChild(el('span', 'tile-hint', t('maxHotel')));
      } else if (G.state.owners[pos] === p.id && tile.group && R.ownsGroup(G.state, p.id, tile.group)) {
        if (cb.reason === 'even') wrap.appendChild(el('span', 'tile-hint', t('groupHint')));
        else if (cb.reason === 'cash') wrap.appendChild(el('span', 'tile-hint', t('notEnough')));
      }
    }
    if (wrap.children.length) box.appendChild(wrap);
  }

  function row(label, value) {
    var r = el('div', 'tile-row');
    r.appendChild(el('span', '', label));
    r.appendChild(el('b', '', value));
    return r;
  }

  function renderRules() {
    var box = $('rules-body');
    box.innerHTML = '';
    var items = t('rules');
    if (!Array.isArray(items)) return;
    items.forEach(function (sec) {
      box.appendChild(el('h3', '', sec.h));
      var ul = el('ul');
      sec.items.forEach(function (line) { ul.appendChild(el('li', '', line)); });
      box.appendChild(ul);
    });
  }

  /* ============================================================
   * 结算
   * ========================================================== */

  function showEnd() {
    if (!G.state) return;
    var s = G.state;
    var winner = s.players[s.winner];
    var lastKey = s.log.length ? s.log[s.log.length - 1].key : '';

    $('end-title').textContent = winner && !winner.isAi
      ? t('endTitleYou')
      : t('endTitle', { name: winner ? winner.name : '—' });
    $('end-sub').textContent = lastKey === 'settle'
      ? t('endSubSettle', { n: s.maxRounds })
      : t('endSubWin', { n: s.round });

    var rank = $('end-rank');
    rank.innerHTML = '';
    R.ranking(s).forEach(function (p, i) {
      var rowEl = el('div', 'rank-row' + (i === 0 ? ' first' : ''));
      rowEl.appendChild(el('span', 'rank-no', String(i + 1)));
      var dot = el('span', 'token-dot');
      dot.style.background = p.color;
      rowEl.appendChild(dot);
      rowEl.appendChild(el('span', 'rank-name', p.name));
      rowEl.appendChild(el('span', 'rank-worth', money(R.netWorth(s, p))));
      rank.appendChild(rowEl);
    });

    openModal('end-modal');
  }

  /* ============================================================
   * 弹窗与交互
   * ========================================================== */

  function openModal(id) {
    var m = $(id);
    if (m) m.classList.add('show');
  }

  function closeModal(id) {
    var m = $(id);
    if (m) m.classList.remove('show');
  }

  /** 点击棋盘格子：选中查看详情，再点一次取消 */
  function previewTile(idx) {
    if (!G.state) return;
    G.preview = G.preview === idx ? -1 : idx;
    renderTileCard();
    renderMap();
  }

  function backToHere() {
    G.preview = -1;
    renderTileCard();
    renderMap();
  }

  /* ============================================================
   * 初始化
   * ========================================================== */

  function buildDice() {
    var box = $('dice');
    box.innerHTML = '';
    G.diceEls = [];
    for (var d = 0; d < 2; d++) {
      var die = el('div', 'die');
      for (var i = 0; i < 9; i++) {
        var cell = el('div', 'cell');
        cell.appendChild(el('span', 'pip'));
        die.appendChild(cell);
      }
      box.appendChild(die);
      G.diceEls.push(die);
    }
    renderDice([0, 0]);
  }

  function applyText() {
    var nodes = document.querySelectorAll('[data-t]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-t');
      nodes[i].textContent = t(key);
    }
    document.documentElement.lang = lang() === 'en' ? 'en' : 'zh-CN';
  }

  function syncTheme() {
    var colors = GP.themePacks.colors();
    var dark = GP.theme.get() === 'dark';
    G.reduceMotion = GP.ui.shouldReduceMotion();
    Map2D.setTheme(colors, dark);
    Map2D.setReduceMotion(G.reduceMotion);
  }

  function bind() {
    $('btn-back').addEventListener('click', function () { GP.navigate.goHome(); });
    $('btn-home').addEventListener('click', function () { GP.navigate.goHome(); });
    $('btn-rules').addEventListener('click', function () {
      renderRules();
      openModal('rules-modal');
    });
    $('btn-rules-close').addEventListener('click', function () { closeModal('rules-modal'); });
    $('btn-draw-ok').addEventListener('click', closeDraw);
    $('btn-new').addEventListener('click', function () {
      clearTimers();
      G.busy = false;
      renderSetup();
      openModal('setup-modal');
    });

    $('btn-start').addEventListener('click', startGame);
    $('btn-again').addEventListener('click', function () {
      closeModal('end-modal');
      startGame();
    });
    $('btn-clear').addEventListener('click', function () {
      GP.storage.remove('stats');       // 只清战绩，别把进行中的存档一起抹了
      G.stats = { games: 0, wins: 0 };
      renderSetup();
      toast(t('cleared'));
    });

    // 关标签页 / 切后台时再兜一次，防止防抖窗口里刷新丢掉最后一步
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) saveNow();
    });

    var setup = $('setup-modal');
    setup.addEventListener('click', function (ev) {
      if (ev.target === setup) {
        if (G.state && !G.state.over) setup.classList.remove('show');
        return;
      }
      var step = ev.target.getAttribute && ev.target.getAttribute('data-step');
      if (step) {
        var dir = parseInt(ev.target.getAttribute('data-dir'), 10);
        changeCount(step, dir);
        return;
      }
      var diff = ev.target.getAttribute && ev.target.getAttribute('data-diff');
      if (diff) {
        G.config.difficulty = diff;
        saveConfig();
        renderSetup();
      }
    });

    [ $('rules-modal') ].forEach(function (m) {
      m.addEventListener('click', function (ev) {
        if (ev.target === m) m.classList.remove('show');
      });
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        closeModal('rules-modal');
        if (G.state && !G.state.over) closeModal('setup-modal');
      }
    });
  }

  function initCheatKit() {
    if (!window.CheatKit) return;
    try {
      window.CheatKit.init({
        id: 'monopoly',
        title: { zh: '🔧 修改器', en: '🔧 Modifier' },
        hint: { zh: '彩蛋面板 · 即时生效', en: 'Easter egg · instant' },
        stats: [
          {
            label: { zh: '回合', en: 'Round' },
            get: function () { return G.state ? G.state.round + ' / ' + G.state.maxRounds : '—'; }
          },
          {
            label: { zh: '当前玩家', en: 'Current' },
            get: function () { var p = current(); return p ? p.name : '—'; }
          },
          {
            label: { zh: '现金', en: 'Cash' },
            tone: 'success',
            get: function () { var p = current(); return p ? money(p.cash) : '—'; }
          },
          {
            label: { zh: '地产', en: 'Properties' },
            get: function () { var p = current(); return p ? R.propertyCount(G.state, p.id) : '—'; }
          }
        ],
        params: [
          {
            key: 'cash',
            label: { zh: '当前玩家现金', en: 'Current cash' },
            min: 0, max: 20000, step: 100,
            get: function () { var p = current(); return p ? p.cash : 0; },
            set: function (v) {
              var p = current();
              if (!p) return;
              p.cash = Math.round(v);
              renderAll();
            }
          }
        ],
        actions: [
          {
            label: { zh: '💰 加 $500', en: '💰 Add $500' },
            run: function () {
              var p = current();
              if (!p) return;
              p.cash += 500;
              renderAll();
            }
          },
          {
            label: { zh: '🏁 立即结算', en: '🏁 Settle now' },
            tone: 'danger',
            run: function () {
              if (!G.state || G.state.over) return;
              R.settle(G.state);
              G.ended = false;
              finishGame();
            }
          }
        ]
      });
    } catch (e) {
      console.warn('[Monopoly] CheatKit init failed', e);
    }
  }

  function start() {
    applyText();
    buildDice();
    bind();

    Map2D.attach($('board'), { onPick: previewTile });

    syncTheme();
    loadConfig();
    var resumed = loadSave();
    renderSetup();
    renderRules();
    renderAll();

    if (resumed) {
      closeModal('setup-modal');
      toast(t('resumed', { n: G.state.round }));
      // 存档可能停在电脑的回合，直接把它的行动接上
      if (current() && current().isAi) schedule(aiTurn, 800);
    }

    GP.settings.onChange(function (settings, keys) {
      if (keys && keys.indexOf('reduceMotion') !== -1) syncTheme();
      if (keys && keys.indexOf('lang') !== -1) {
        applyText();
        refreshNames();
        renderSetup();
        renderRules();
        renderAll();
      }
    });
    GP.theme.onChange(syncTheme);
    GP.themePacks.onChange(syncTheme);
    window.addEventListener('resize', function () { Map2D.resize(); });

    initCheatKit();

    GP.ready.then(function () { syncTheme(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      GP.ready.then(start);
    });
  } else {
    GP.ready.then(start);
  }
})();
