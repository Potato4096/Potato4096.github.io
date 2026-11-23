/**
 * rules.js - 中国象棋规则引擎（纯逻辑，无 DOM 依赖，浏览器 / Node 通用）
 *
 * 棋盘坐标：x = 0..8（列，左→右），y = 0..9（行，上→下）。
 * 黑方在上（y=0 为黑方底线），红方在下（y=9 为红方底线）。
 * 棋子：{ t: 'K'|'A'|'E'|'H'|'R'|'C'|'P', s: 'r'|'b' }
 *   K 帅/将  A 仕/士  E 相/象  H 马  R 车  C 炮  P 兵/卒
 */
(function (global) {
  'use strict';

  var ROWS = 10, COLS = 9;

  var PIECE_CHARS = {
    r: { K: '帅', A: '仕', E: '相', H: '马', R: '车', C: '炮', P: '兵' },
    b: { K: '将', A: '士', E: '象', H: '马', R: '车', C: '炮', P: '卒' }
  };

  function makePiece(t, s) { return { t: t, s: s }; }

  function initialBoard() {
    var b = [], y, x;
    for (y = 0; y < ROWS; y++) b.push(new Array(COLS).fill(null));
    var back = ['R', 'H', 'E', 'A', 'K', 'A', 'E', 'H', 'R'];
    for (x = 0; x < COLS; x++) {
      b[0][x] = makePiece(back[x], 'b');
      b[9][x] = makePiece(back[x], 'r');
    }
    b[2][1] = makePiece('C', 'b'); b[2][7] = makePiece('C', 'b');
    b[7][1] = makePiece('C', 'r'); b[7][7] = makePiece('C', 'r');
    [0, 2, 4, 6, 8].forEach(function (x2) {
      b[3][x2] = makePiece('P', 'b');
      b[6][x2] = makePiece('P', 'r');
    });
    return b;
  }

  function cloneBoard(board) {
    return board.map(function (row) {
      return row.map(function (p) { return p ? { t: p.t, s: p.s } : null; });
    });
  }

  function inBoard(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

  function inPalace(x, y, side) {
    if (x < 3 || x > 5) return false;
    return side === 'r' ? (y >= 7 && y <= 9) : (y >= 0 && y <= 2);
  }

  /** 是否仍在己方半场（未过河）。相/象不得过河，兵/卒过河后可横走。 */
  function ownSide(y, side) {
    return side === 'r' ? y >= 5 : y <= 4;
  }

  /** to 是否相对 from 向敌方推进 */
  function isForward(fromY, toY, side) {
    return side === 'r' ? toY < fromY : toY > fromY;
  }

  // 方向表提到模块级：避免每次生成着法都新建数组与闭包（AI 每节点都要跑）
  var K_STEPS = [1, 0, -1, 0, 0, 1, 0, -1];
  var A_STEPS = [1, 1, 1, -1, -1, 1, -1, -1];
  var E_STEPS = [2, 2, 2, -2, -2, 2, -2, -2];
  var H_STEPS = [
    1, 2, 0, 1, 1, -2, 0, -1, -1, 2, 0, 1, -1, -2, 0, -1,
    2, 1, 1, 0, 2, -1, 1, 0, -2, 1, -1, 0, -2, -1, -1, 0
  ];
  var R_DIRS = [1, 0, -1, 0, 0, 1, 0, -1];

  /** 伪合法着法（不检验己方将帅是否被将） */
  function pseudoMoves(board, x, y) {
    var p = board[y][x];
    if (!p) return [];
    var moves = [];
    var s = p.s;
    var t = p.t;
    var i, tx, ty, q;

    if (t === 'K') {
      // 帅/将：九宫内直走一步
      for (i = 0; i < 8; i += 2) {
        tx = x + K_STEPS[i]; ty = y + K_STEPS[i + 1];
        if (!inPalace(tx, ty, s)) continue;
        q = board[ty][tx];
        if (!q || q.s !== s) moves.push({ x: tx, y: ty });
      }
    } else if (t === 'A') {
      // 仕/士：九宫内斜走一步
      for (i = 0; i < 8; i += 2) {
        tx = x + A_STEPS[i]; ty = y + A_STEPS[i + 1];
        if (!inPalace(tx, ty, s)) continue;
        q = board[ty][tx];
        if (!q || q.s !== s) moves.push({ x: tx, y: ty });
      }
    } else if (t === 'E') {
      // 相/象：田字，塞象眼、不过河
      for (i = 0; i < 8; i += 2) {
        tx = x + E_STEPS[i]; ty = y + E_STEPS[i + 1];
        if (!inBoard(tx, ty)) continue;
        if (!ownSide(ty, s)) continue; // 不过河
        if (board[y + E_STEPS[i + 1] / 2][x + E_STEPS[i] / 2]) continue; // 塞象眼
        q = board[ty][tx];
        if (!q || q.s !== s) moves.push({ x: tx, y: ty });
      }
    } else if (t === 'H') {
      // 马：日字，蹩马腿
      for (i = 0; i < 32; i += 4) {
        tx = x + H_STEPS[i]; ty = y + H_STEPS[i + 1];
        if (!inBoard(tx, ty)) continue;
        if (board[y + H_STEPS[i + 3]][x + H_STEPS[i + 2]]) continue; // 蹩马腿
        q = board[ty][tx];
        if (!q || q.s !== s) moves.push({ x: tx, y: ty });
      }
    } else if (t === 'R') {
      // 车：直线滑行，遇子即止（可吃第一枚敌子）
      for (i = 0; i < 8; i += 2) {
        var rdx = R_DIRS[i], rdy = R_DIRS[i + 1];
        tx = x; ty = y;
        for (;;) {
          tx += rdx; ty += rdy;
          if (!inBoard(tx, ty)) break;
          q = board[ty][tx];
          if (!q) { moves.push({ x: tx, y: ty }); continue; }
          if (q.s !== s) moves.push({ x: tx, y: ty });
          break;
        }
      }
    } else if (t === 'C') {
      // 炮：不吃子走直线；吃子须隔恰好一枚棋子（炮架），目标为炮架后第一枚棋子
      for (i = 0; i < 8; i += 2) {
        var cdx = R_DIRS[i], cdy = R_DIRS[i + 1];
        tx = x; ty = y;
        var screen = false;
        for (;;) { // 不吃子行进，直到碰到第一枚棋子（炮架）
          tx += cdx; ty += cdy;
          if (!inBoard(tx, ty)) break;
          q = board[ty][tx];
          if (q) { screen = true; break; }
          moves.push({ x: tx, y: ty });
        }
        if (!screen) continue;
        for (;;) { // 炮架之后的第一枚棋子才是可吃目标
          tx += cdx; ty += cdy;
          if (!inBoard(tx, ty)) break;
          q = board[ty][tx];
          if (q) {
            if (q.s !== s) moves.push({ x: tx, y: ty });
            break;
          }
        }
      }
    } else if (t === 'P') {
      // 兵/卒：向前一步；过河后可横走；永不后退
      ty = y + (s === 'r' ? -1 : 1);
      if (inBoard(x, ty)) {
        q = board[ty][x];
        if (!q || q.s !== s) moves.push({ x: x, y: ty });
      }
      if (!ownSide(y, s)) {
        if (x > 0) {
          q = board[y][x - 1];
          if (!q || q.s !== s) moves.push({ x: x - 1, y: y });
        }
        if (x < COLS - 1) {
          q = board[y][x + 1];
          if (!q || q.s !== s) moves.push({ x: x + 1, y: y });
        }
      }
    }
    return moves;
  }

  function findGeneral(board, side) {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var p = board[y][x];
        if (p && p.t === 'K' && p.s === side) return { x: x, y: y };
      }
    }
    return null;
  }

  /** 将帅对脸（同一列且中间无子） */
  function generalsFaced(board) {
    var r = findGeneral(board, 'r'), b = findGeneral(board, 'b');
    if (!r || !b || r.x !== b.x) return false;
    for (var y = b.y + 1; y < r.y; y++) {
      if (board[y][r.x]) return false;
    }
    return true;
  }

  /** side 的将帅是否正被攻击（含将帅对脸） */
  function inCheck(board, side) {
    var g = findGeneral(board, side);
    if (!g) return true;
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var p = board[y][x];
        if (!p || p.s === side) continue;
        var ms = pseudoMoves(board, x, y);
        for (var i = 0; i < ms.length; i++) {
          if (ms[i].x === g.x && ms[i].y === g.y) return true;
        }
      }
    }
    return generalsFaced(board);
  }

  /** 合法着法：走后己方将帅不被将（含不走进对脸） */
  function legalMoves(board, x, y) {
    var p = board[y][x];
    if (!p) return [];
    return pseudoMoves(board, x, y).filter(function (m) {
      var nb = cloneBoard(board);
      nb[m.y][m.x] = nb[y][x];
      nb[y][x] = null;
      return !inCheck(nb, p.s);
    });
  }

  /** side 的全部合法着法 */
  function allLegalMoves(board, side) {
    var res = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var p = board[y][x];
        if (!p || p.s !== side) continue;
        legalMoves(board, x, y).forEach(function (m) {
          res.push({ from: { x: x, y: y }, to: m });
        });
      }
    }
    return res;
  }

  /** 执行走子（就地修改），返回被吃棋子（可能为 null） */
  function applyMove(board, from, to) {
    var captured = board[to.y][to.x];
    board[to.y][to.x] = board[from.y][from.x];
    board[from.y][from.x] = null;
    return captured;
  }

  /**
   * 对局状态：走完 move 后轮到 turn 时的判定。
   * 返回 { over: false, check: bool } 或 { over: true, winner, reason: 'capture'|'checkmate'|'stalemate', check }
   */
  function statusAfter(board, turn) {
    if (!findGeneral(board, turn)) {
      return { over: true, winner: turn === 'r' ? 'b' : 'r', reason: 'capture', check: false };
    }
    var check = inCheck(board, turn);
    if (allLegalMoves(board, turn).length === 0) {
      // 将死（被将且无着）或困毙（未被将但无着）——均判负
      return {
        over: true,
        winner: turn === 'r' ? 'b' : 'r',
        reason: check ? 'checkmate' : 'stalemate',
        check: check
      };
    }
    return { over: false, check: check };
  }

  /* ---------------- 中文记谱 ---------------- */

  var CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

  /**
   * 生成中文记谱，如「炮二平五」「马8进7」「前马进七」。
   * board 为走子前的棋盘。
   */
  function notation(board, from, to) {
    var p = board[from.y][from.x];
    if (!p) return '';
    var ch = PIECE_CHARS[p.s][p.t];
    var fileNum = function (x) { return p.s === 'r' ? 9 - x : x + 1; };
    var num = function (n) { return p.s === 'r' ? CN_NUM[n - 1] : String(n); };

    var action, dest;
    if (to.y === from.y) {
      action = '平';
      dest = num(fileNum(to.x));
    } else if (p.t === 'H' || p.t === 'E' || p.t === 'A') {
      // 斜走子：进/退 + 目标纵线
      action = isForward(from.y, to.y, p.s) ? '进' : '退';
      dest = num(fileNum(to.x));
    } else {
      // 直走子：进/退 + 步数
      action = isForward(from.y, to.y, p.s) ? '进' : '退';
      dest = num(Math.abs(to.y - from.y));
    }

    // 同纵线同兵种：前/中/后 区分
    var sameFile = [];
    for (var y = 0; y < ROWS; y++) {
      var q = board[y][from.x];
      if (q && q.s === p.s && q.t === p.t) sameFile.push(y);
    }
    var prefix;
    if (sameFile.length >= 2 && sameFile.length <= 3) {
      // 「前」为更靠近敌方一侧
      sameFile.sort(function (a, b) { return p.s === 'r' ? a - b : b - a; });
      var idx = sameFile.indexOf(from.y);
      var labels = sameFile.length === 2 ? ['前', '后'] : ['前', '中', '后'];
      prefix = labels[idx] + ch;
    } else if (sameFile.length > 3) {
      // 极罕见情形（如同线四兵），退化为坐标记法
      prefix = ch + num(fileNum(from.x));
    } else {
      prefix = ch + num(fileNum(from.x));
    }
    return prefix + action + dest;
  }

  var api = {
    ROWS: ROWS,
    COLS: COLS,
    PIECE_CHARS: PIECE_CHARS,
    initialBoard: initialBoard,
    cloneBoard: cloneBoard,
    inBoard: inBoard,
    inPalace: inPalace,
    ownSide: ownSide,
    pseudoMoves: pseudoMoves,
    legalMoves: legalMoves,
    allLegalMoves: allLegalMoves,
    findGeneral: findGeneral,
    generalsFaced: generalsFaced,
    inCheck: inCheck,
    applyMove: applyMove,
    statusAfter: statusAfter,
    notation: notation
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Xiangqi = api;
})(typeof window !== 'undefined' ? window : globalThis);
