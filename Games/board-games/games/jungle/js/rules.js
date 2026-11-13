/**
 * rules.js - 斗兽棋核心规则（纯函数，无平台依赖）
 *
 * 7×9 棋盘。y=0 为黑方（顶部），y=8 为红方（底部）。
 * 棋子等级：鼠1 < 猫2 < 狗3 < 狼4 < 豹5 < 虎6 < 狮7 < 象8。
 *
 * 规则要点：
 *   · 每步上下左右走一格；大吃小、同级互吃（等级数字大者吃小者）
 *   · 鼠可入水（其他子不可），鼠可吃象、象不可吃鼠
 *   · 虎、狮可跳河：沿直线跳过整段水域，河中有鼠挡路则不能跳
 *   · 水中与陆上的子不能互相吃（只有同域才能吃）
 *   · 敌子落进我方陷阱（共 3 处）后，我方任何子都能吃它
 *   · 任一子进入对方兽穴即胜；己方兽穴不可进入
 *   · 吃光对方、或对方无子可动，同样获胜
 */
(function (global) {
  'use strict';

  var COLS = 7;
  var ROWS = 9;
  var EMPTY = 0;
  var RED = 1;
  var BLACK = 2;

  /* 棋子类型（数字即等级） */
  var RAT = 1, CAT = 2, DOG = 3, WOLF = 4, LEOPARD = 5, TIGER = 6, LION = 7, ELEPHANT = 8;
  var TYPE_NAMES = ['', 'rat', 'cat', 'dog', 'wolf', 'leopard', 'tiger', 'lion', 'elephant'];

  /* 地形：河、陷阱、兽穴 */
  var WATER = {
    '1,3': 1, '2,3': 1, '4,3': 1, '5,3': 1,
    '1,4': 1, '2,4': 1, '4,4': 1, '5,4': 1,
    '1,5': 1, '2,5': 1, '4,5': 1, '5,5': 1
  };
  var TRAPS = [
    { x: 2, y: 0, s: BLACK }, { x: 4, y: 0, s: BLACK }, { x: 3, y: 1, s: BLACK },
    { x: 2, y: 8, s: RED }, { x: 4, y: 8, s: RED }, { x: 3, y: 7, s: RED }
  ];
  var DENS = [
    { x: 3, y: 0, s: BLACK },
    { x: 3, y: 8, s: RED }
  ];

  function idx(x, y) { return y * COLS + x; }
  function inBoard(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS; }
  function get(board, x, y) { return inBoard(x, y) ? board[idx(x, y)] : undefined; }

  function isWater(x, y) { return !!WATER[x + ',' + y]; }

  /** 格子所属陷阱的主人（0 = 不是陷阱） */
  function trapOwner(x, y) {
    for (var i = 0; i < TRAPS.length; i++) {
      if (TRAPS[i].x === x && TRAPS[i].y === y) return TRAPS[i].s;
    }
    return EMPTY;
  }

  /** 格子所属兽穴的主人（0 = 不是兽穴） */
  function denOwner(x, y) {
    for (var i = 0; i < DENS.length; i++) {
      if (DENS[i].x === x && DENS[i].y === y) return DENS[i].s;
    }
    return EMPTY;
  }

  function create() {
    var b = new Array(COLS * ROWS);
    for (var i = 0; i < b.length; i++) b[i] = null;
    function put(x, y, s, t) { b[idx(x, y)] = { s: s, t: t }; }

    // 黑方（顶部）
    put(0, 0, BLACK, TIGER);
    put(6, 0, BLACK, LION);
    put(1, 1, BLACK, DOG);
    put(5, 1, BLACK, CAT);
    put(0, 2, BLACK, RAT);
    put(2, 2, BLACK, WOLF);
    put(4, 2, BLACK, LEOPARD);
    put(6, 2, BLACK, ELEPHANT);

    // 红方（底部，180° 对称）
    put(0, 6, RED, ELEPHANT);
    put(2, 6, RED, LEOPARD);
    put(4, 6, RED, WOLF);
    put(6, 6, RED, RAT);
    put(1, 7, RED, CAT);
    put(5, 7, RED, DOG);
    put(0, 8, RED, LION);
    put(6, 8, RED, TIGER);
    return b;
  }

  function clone(board) { return board.slice(); }

  /** attack 能否吃掉 defend（defend 位于 to 格） */
  function canCapture(board, from, to) {
    var a = get(board, from.x, from.y);
    var d = get(board, to.x, to.y);
    if (!a || !d) return false;
    if (a.s === d.s) return false;

    // 水陆不能互吃（水中鼠 vs 陆上子）
    if (isWater(from.x, from.y) !== isWater(to.x, to.y)) return false;

    // 敌子在我方陷阱里：任何子都能吃
    if (trapOwner(to.x, to.y) === a.s) return true;

    // 鼠吃象 / 象不能吃鼠
    if (a.t === RAT && d.t === ELEPHANT) return true;
    if (a.t === ELEPHANT && d.t === RAT) return false;

    return a.t >= d.t;
  }

  /** 虎/狮跳河：返回落点或 null */
  function jumpTarget(board, x, y, dx, dy) {
    var p = get(board, x, y);
    if (!p || (p.t !== TIGER && p.t !== LION)) return null;
    var nx = x + dx, ny = y + dy;
    if (!isWater(nx, ny)) return null;
    // 河中有鼠挡路则跳不过去
    while (inBoard(nx, ny) && isWater(nx, ny)) {
      if (get(board, nx, ny)) return null;
      nx += dx;
      ny += dy;
    }
    return inBoard(nx, ny) ? { x: nx, y: ny } : null;
  }

  /** 一个子的全部合法落点 */
  function movesFrom(board, x, y) {
    var p = get(board, x, y);
    var out = [];
    if (!p) return out;

    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var i = 0; i < dirs.length; i++) {
      var dx = dirs[i][0], dy = dirs[i][1];
      var nx = x + dx, ny = y + dy;
      if (!inBoard(nx, ny)) continue;

      // 跳河（虎/狮）：整段河跳过去
      var jumped = jumpTarget(board, x, y, dx, dy);
      if (jumped) {
        nx = jumped.x;
        ny = jumped.y;
      }

      if (!inBoard(nx, ny)) continue;
      if (isWater(nx, ny) && p.t !== RAT) continue;        // 只有鼠能进水
      if (denOwner(nx, ny) === p.s) continue;               // 不进己方兽穴

      var d = get(board, nx, ny);
      if (!d) out.push({ x: nx, y: ny, capture: false, jump: !!jumped });
      else if (canCapture(board, { x: x, y: y }, { x: nx, y: ny })) {
        out.push({ x: nx, y: ny, capture: true, jump: !!jumped });
      }
    }
    return out;
  }

  /** 一方全部合法着法 [{from:{x,y}, to:{x,y}, capture, jump}] */
  function legalMoves(board, side) {
    var out = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var p = board[idx(x, y)];
        if (!p || p.s !== side) continue;
        var ms = movesFrom(board, x, y);
        for (var i = 0; i < ms.length; i++) {
          out.push({
            from: { x: x, y: y },
            to: { x: ms[i].x, y: ms[i].y },
            capture: ms[i].capture,
            jump: ms[i].jump
          });
        }
      }
    }
    return out;
  }

  /** 执行走子，返回被吃的棋子（无则 null） */
  function applyMove(board, mv) {
    var p = board[idx(mv.from.x, mv.from.y)];
    var eaten = board[idx(mv.to.x, mv.to.y)];
    board[idx(mv.to.x, mv.to.y)] = p;
    board[idx(mv.from.x, mv.from.y)] = null;
    return eaten;
  }

  function pieceCount(board, side) {
    var n = 0;
    for (var i = 0; i < board.length; i++) {
      if (board[i] && board[i].s === side) n++;
    }
    return n;
  }

  /**
   * 判定胜负（不依赖行棋方）。
   * 返回 RED / BLACK 表示获胜方，0 表示未分胜负。
   */
  function winnerOf(board, nextSide) {
    // 任一方走进对方兽穴
    var i;
    for (i = 0; i < DENS.length; i++) {
      var p = get(board, DENS[i].x, DENS[i].y);
      if (p && p.s !== DENS[i].s) return p.s;
    }
    // 吃光对方
    if (!pieceCount(board, RED)) return BLACK;
    if (!pieceCount(board, BLACK)) return RED;
    // 轮走方无子可动则输
    if (nextSide === RED || nextSide === BLACK) {
      if (legalMoves(board, nextSide).length === 0) {
        return nextSide === RED ? BLACK : RED;
      }
    }
    return EMPTY;
  }

  /** 坐标名，如 a1（列 a-g，行 1-9 自上而下） */
  function colName(x) { return 'abcdefg'[x]; }
  function coordName(x, y) { return colName(x) + (y + 1); }

  function typeName(t) { return TYPE_NAMES[t] || ''; }

  var api = {
    COLS: COLS,
    ROWS: ROWS,
    EMPTY: EMPTY,
    RED: RED,
    BLACK: BLACK,
    RAT: RAT, CAT: CAT, DOG: DOG, WOLF: WOLF,
    LEOPARD: LEOPARD, TIGER: TIGER, LION: LION, ELEPHANT: ELEPHANT,
    WATER: WATER,
    TRAPS: TRAPS,
    DENS: DENS,
    idx: idx,
    inBoard: inBoard,
    get: get,
    isWater: isWater,
    trapOwner: trapOwner,
    denOwner: denOwner,
    create: create,
    clone: clone,
    canCapture: canCapture,
    movesFrom: movesFrom,
    legalMoves: legalMoves,
    applyMove: applyMove,
    pieceCount: pieceCount,
    winnerOf: winnerOf,
    colName: colName,
    coordName: coordName,
    typeName: typeName
  };

  global.Jungle = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
