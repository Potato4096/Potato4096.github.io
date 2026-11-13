/**
 * rules.js - 飞行棋核心规则（纯函数，无平台依赖）
 *
 * 四色（红 0 / 黄 1 / 蓝 2 / 绿 3），每色 4 架飞机。
 * 位置用 rel 表示：-1 机库；0..51 主跑道（rel 0 = 该色起点）；52..57 终点道（57 = 终点）。
 *
 * 规则要点：
 *   · 掷出 6 才能从机库起飞到起点；掷 6 额外获得一回合（连续 3 个 6 本回合作废）
 *   · 在跑道上按点数前进；需要精确点数进终点（超出则不能走）
 *   · 落在与自己同色的格子（每 4 格一色）自动连跳 4 格
 *   · 落到有敌机的环格（含起点）把敌机撞回机库，并获得额外回合
 *   · 四架飞机全部到达终点即获胜
 */
(function (global) {
  'use strict';

  var RED = 0, YELLOW = 1, BLUE = 2, GREEN = 3;
  var HOME = -1;
  var FINISH = 57;

  /* 主跑道 52 格（15×15 棋盘坐标），红起点 index 0 在 (6,13) */
  var PATH = [
    [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
    [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
    [0, 7], [0, 6],
    [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
    [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
    [7, 0], [8, 0],
    [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
    [14, 7], [14, 8],
    [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
    [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
    [7, 14], [6, 14]
  ];

  /* 各色起点在主跑道上的 index */
  var START = [0, 13, 26, 39];

  /* 各色终点道 6 格（最后一格贴住中心） */
  var HOME_PATH = [
    [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
    [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
    [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
    [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]]
  ];

  /* 各色机库 4 个停机位 */
  var HANGAR = [
    [[2, 11], [4, 11], [2, 13], [4, 13]],
    [[2, 1], [4, 1], [2, 3], [4, 3]],
    [[10, 1], [12, 1], [10, 3], [12, 3]],
    [[10, 11], [12, 11], [10, 13], [12, 13]]
  ];

  var COLOR_NAMES = ['red', 'yellow', 'blue', 'green'];

  function create() {
    return {
      planes: [
        [HOME, HOME, HOME, HOME],
        [HOME, HOME, HOME, HOME],
        [HOME, HOME, HOME, HOME],
        [HOME, HOME, HOME, HOME]
      ],
      turn: RED,
      dice: 0,
      diceRolled: false,
      sixStreak: 0,
      over: false,
      winner: -1
    };
  }

  function clone(s) {
    return {
      planes: s.planes.map(function (row) { return row.slice(); }),
      turn: s.turn,
      dice: s.dice,
      diceRolled: s.diceRolled,
      sixStreak: s.sixStreak,
      over: s.over,
      winner: s.winner
    };
  }

  /** rel（0..51）→ 主跑道绝对格 */
  function absRel(color, rel) {
    return (START[color] + rel) % PATH.length;
  }

  /** rel（任意）→ 棋盘坐标；机库返回该色对应停机位的近似坐标 */
  function coordOf(color, rel, planeIdx) {
    if (rel === HOME) {
      var h = HANGAR[color][planeIdx || 0];
      return { x: h[0], y: h[1] };
    }
    if (rel <= 51) {
      var a = PATH[absRel(color, rel)];
      return { x: a[0], y: a[1] };
    }
    var hp = HOME_PATH[color][rel - 52];
    return { x: hp[0], y: hp[1] };
  }

  function hasWon(s, color) {
    for (var i = 0; i < 4; i++) {
      if (s.planes[color][i] !== FINISH) return false;
    }
    return true;
  }

  function finishedCount(s, color) {
    var n = 0;
    for (var i = 0; i < 4; i++) {
      if (s.planes[color][i] === FINISH) n++;
    }
    return n;
  }

  /** 当前玩家掷出 dice 后，可以移动的飞机下标 */
  function legalPlanes(s, color, dice) {
    var out = [];
    for (var i = 0; i < 4; i++) {
      var p = s.planes[color][i];
      if (p === HOME) {
        if (dice === 6) out.push(i);        // 起飞
      } else if (p + dice <= FINISH) {
        out.push(i);                         // 前进（需精确进终点）
      }
    }
    return out;
  }

  /**
   * 执行一次走子（原地改 state）。
   * @return result|null 不合法时 null；否则
   *   { takeoff, jumped, finished, captured:[{color,plane}], extraTurn, from, to }
   */
  function applyMove(s, color, dice, planeIdx) {
    var pos = s.planes[color][planeIdx];
    var result = {
      takeoff: false,
      jumped: false,
      finished: false,
      captured: [],
      extraTurn: false,
      from: pos,
      to: pos
    };

    if (pos === HOME) {
      if (dice !== 6) return null;
      s.planes[color][planeIdx] = 0;
      result.takeoff = true;
    } else {
      var np = pos + dice;
      if (np > FINISH) return null;
      s.planes[color][planeIdx] = np;

      // 同色格连跳 4（只在主跑道上跳；允许跳进终点道入口）
      if (np > 0 && np <= 51 && np % 4 === 0) {
        np += 4;
        s.planes[color][planeIdx] = np;
        result.jumped = true;
      }
      if (np === FINISH) result.finished = true;
    }

    result.to = s.planes[color][planeIdx];

    // 撞机：主跑道同格的敌机回机库
    if (result.to <= 51) {
      var abs = absRel(color, result.to);
      for (var c = 0; c < 4; c++) {
        if (c === color) continue;
        for (var k = 0; k < 4; k++) {
          var q = s.planes[c][k];
          if (q >= 0 && q <= 51 && absRel(c, q) === abs) {
            s.planes[c][k] = HOME;
            result.captured.push({ color: c, plane: k });
          }
        }
      }
    }

    if (dice === 6 || result.captured.length) result.extraTurn = true;

    if (hasWon(s, color)) {
      s.over = true;
      s.winner = color;
    }
    return result;
  }

  /** 轮到下一家（跳过已获胜方） */
  function nextTurn(s) {
    var c = s.turn;
    for (var i = 0; i < 4; i++) {
      c = (c + 1) % 4;
      if (!hasWon(s, c)) {
        s.turn = c;
        s.dice = 0;
        s.diceRolled = false;
        return c;
      }
    }
    return s.turn;
  }

  function rollDice() {
    return 1 + Math.floor(Math.random() * 6);
  }

  var api = {
    RED: RED,
    YELLOW: YELLOW,
    BLUE: BLUE,
    GREEN: GREEN,
    HOME: HOME,
    FINISH: FINISH,
    PATH: PATH,
    START: START,
    HOME_PATH: HOME_PATH,
    HANGAR: HANGAR,
    COLOR_NAMES: COLOR_NAMES,
    create: create,
    clone: clone,
    absRel: absRel,
    coordOf: coordOf,
    hasWon: hasWon,
    finishedCount: finishedCount,
    legalPlanes: legalPlanes,
    applyMove: applyMove,
    nextTurn: nextTurn,
    rollDice: rollDice
  };

  global.Ludo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
