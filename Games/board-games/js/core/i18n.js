/**
 * core/i18n.js - 棋类合集共享的文案层
 *
 * 每个棋种注册自己的词条（register），active id 指向当前棋种。
 * 查词顺序：当前棋种词典 -> 通用词典 -> 原样返回 key。
 * 语言源沿用平台 GamePlatform.i18n，不另建一套偏好存储。
 */
(function (global) {
  'use strict';

  var BG = global.BG || (global.BG = {});

  /* 所有棋种共用的界面词 */
  var COMMON = {
    zh: {
      hub: '棋类合集',
      back: '返回大厅',
      modeLabel: '模式',
      switchMode: '切换模式',
      record: '棋谱',
      noMoves: '尚未落子',
      undo: '悔棋',
      restart: '重新开始',
      clear: '清除记录',
      cleared: '对局记录已清除',
      restarted: '已重新开始',
      restored: '已恢复上次对局（刷新不丢棋盘）',
      frozen: '上帝模式：棋局冻结中',
      youFirst: '你先手！',
      aiFirst: '电脑先手',
      redFirst: '红方先手',
      whiteFirst: '白方先手',
      blackFirst: '黑方先手',
      undoEmpty: '没有可悔的棋',
      modePvp: '双人对弈',
      modeAi: '人机对战',
      modeAiFull: '人机对战（{diff}）',
      diffEasy: '简单',
      diffMedium: '中等',
      diffHard: '困难',
      you: '你',
      ai: '电脑',
      black: '黑方',
      white: '白方',
      red: '红方',
      backToSite: '返回站点首页',
      youWin: '你赢了！',
      aiWins: '电脑获胜',
      drawText: '和棋',
      thinking: '电脑思考中…',
      resign: '认输',
      pass: '虚手',
      hubTitle: '棋类合集',
      hubSub: '四种棋，一个入口。选好棋种和对手就能开局。',
      vsHuman: '双人对弈',
      vsHumanSub: '两人在同一台设备轮流走',
      vsAi: '人机对战',
      vsAiSub: '三档难度，电脑自动应手',
      pickMode: '选择模式',
      players: '{n} 人',
      backToHub: '返回大厅'
    },
    en: {
      hub: 'Board Games',
      back: 'Back to Lobby',
      modeLabel: 'Mode',
      switchMode: 'Switch',
      record: 'Moves',
      noMoves: 'No moves yet',
      undo: 'Undo',
      restart: 'Restart',
      clear: 'Clear',
      cleared: 'Records cleared',
      restarted: 'New game started',
      restored: 'Previous game restored',
      frozen: 'God Mode: game frozen',
      youFirst: 'You go first!',
      aiFirst: 'AI goes first',
      redFirst: 'Red goes first',
      whiteFirst: 'White goes first',
      blackFirst: 'Black goes first',
      undoEmpty: 'Nothing to undo',
      modePvp: 'Two Players',
      modeAi: 'VS Computer',
      modeAiFull: 'VS Computer ({diff})',
      diffEasy: 'Easy',
      diffMedium: 'Medium',
      diffHard: 'Hard',
      you: 'You',
      ai: 'AI',
      black: 'Black',
      white: 'White',
      red: 'Red',
      backToSite: 'Back to Site',
      youWin: 'You win!',
      aiWins: 'AI wins',
      drawText: 'Draw',
      thinking: 'AI is thinking…',
      resign: 'Resign',
      pass: 'Pass',
      hubTitle: 'Board Games',
      hubSub: 'Four classics in one place. Pick a board and an opponent.',
      vsHuman: 'Two Players',
      vsHumanSub: 'Take turns on this device',
      vsAi: 'VS Computer',
      vsAiSub: 'Three difficulty levels',
      pickMode: 'Choose a mode',
      players: '{n} players',
      backToHub: 'Back to Lobby'
    }
  };

  var dicts = {};
  var activeId = null;

  function lang() {
    if (global.GamePlatform && global.GamePlatform.i18n) {
      return global.GamePlatform.i18n.getLang() === 'en' ? 'en' : 'zh';
    }
    return 'zh';
  }

  /** 取双语对象在当前语言下的值 */
  function text(map) {
    if (map == null) return '';
    if (typeof map === 'string') return map;
    var l = lang();
    if (map[l] != null) return map[l];
    if (map.zh != null) return map.zh;
    if (map.en != null) return map.en;
    for (var k in map) return map[k];
    return '';
  }

  function lookup(key) {
    var l = lang();
    var d = activeId ? dicts[activeId] : null;
    if (d) {
      if (d[l] && d[l][key] != null) return d[l][key];
      if (d.zh && d.zh[key] != null) return d.zh[key];
    }
    if (COMMON[l] && COMMON[l][key] != null) return COMMON[l][key];
    if (COMMON.zh[key] != null) return COMMON.zh[key];
    return key;
  }

  function t(key, map) {
    var s = lookup(key);
    if (map) {
      Object.keys(map).forEach(function (k) {
        s = s.split('{' + k + '}').join(map[k]);
      });
    }
    return s;
  }

  function fmt(key, map) { return t(key, map); }

  function register(id, dict) {
    dicts[id] = dict || {};
  }

  function setActive(id) { activeId = id; }
  function getActive() { return activeId; }

  /** 扫描 root 下的 [data-t] 并写入当前语言文本 */
  function applyText(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-t]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-t'));
    }
    return nodes.length;
  }

  BG.i18n = {
    COMMON: COMMON,
    t: t,
    fmt: fmt,
    text: text,
    lang: lang,
    register: register,
    setActive: setActive,
    getActive: getActive,
    applyText: applyText
  };
})(window);
