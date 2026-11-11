/**
 * rules.js - 五子棋核心规则（纯函数，无平台依赖）
 * 棋盘为 15×15 交叉点，一维 Int8Array 存储：0 空 / 1 黑 / 2 白。
 * 采用自由规则（无禁手）：任意方向连成 5 子及以上即获胜。
 */
(function (global) {
  'use strict';

  var SIZE = 15;
  var EMPTY = 0;
  var BLACK = 1;
  var WHITE = 2;

  /** 四个扫描方向：横、竖、主对角、副对角 */
  var DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  function create() {
    return new Int8Array(SIZE * SIZE);
  }

  function clone(board) {
    return Int8Array.from(board);
  }

  function idx(x, y) {
    return y * SIZE + x;
  }

  function inBoard(x, y) {
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE;
  }

  /** 读取交点；越界返回 -1（便于用"不等于己方颜色"统一处理边界） */
  function get(board, x, y) {
    return inBoard(x, y) ? board[idx(x, y)] : -1;
  }

  function set(board, x, y, color) {
    if (!inBoard(x, y)) return false;
    board[idx(x, y)] = color;
    return true;
  }

  function isEmpty(board, x, y) {
    return inBoard(x, y) && board[idx(x, y)] === EMPTY;
  }

  function isFull(board) {
    for (var i = 0; i < board.length; i++) {
      if (board[i] === EMPTY) return false;
    }
    return true;
  }

  function stoneCount(board, color) {
    var n = 0;
    for (var i = 0; i < board.length; i++) {
      if (board[i] === color) n++;
    }
    return n;
  }

  /**
   * 判定以 (x, y) 为落点是否形成五连（含长连）。
   * 返回构成连线的全部坐标数组，未成五返回 null。
   */
  function winLine(board, x, y) {
    var color = get(board, x, y);
    if (color !== BLACK && color !== WHITE) return null;

    for (var d = 0; d < DIRS.length; d++) {
      var dx = DIRS[d][0];
      var dy = DIRS[d][1];
      var cells = [{ x: x, y: y }];
      var i, nx, ny;

      for (i = 1; i < SIZE; i++) {
        nx = x + dx * i;
        ny = y + dy * i;
        if (get(board, nx, ny) !== color) break;
        cells.push({ x: nx, y: ny });
      }
      for (i = 1; i < SIZE; i++) {
        nx = x - dx * i;
        ny = y - dy * i;
        if (get(board, nx, ny) !== color) break;
        cells.unshift({ x: nx, y: ny });
      }
      if (cells.length >= 5) return cells;
    }
    return null;
  }

  /** 全盘扫描，返回已获胜的一方（黑/白），无则 0。用于回放校验 */
  function winnerOf(board) {
    for (var y = 0; y < SIZE; y++) {
      for (var x = 0; x < SIZE; x++) {
        var c = board[idx(x, y)];
        if (c !== EMPTY && winLine(board, x, y)) return c;
      }
    }
    return EMPTY;
  }

  /** 列字母 A..O（五子棋 15 路，含 I） */
  function colName(x) {
    return String.fromCharCode(65 + x);
  }

  /** 坐标名，如 H8：列字母 + 行号（1 起，自下而上） */
  function coordName(x, y) {
    return colName(x) + (SIZE - y);
  }

  function parseCoord(text) {
    var m = String(text || '').toUpperCase().match(/^([A-O])(\d{1,2})$/);
    if (!m) return null;
    var x = m[1].charCodeAt(0) - 65;
    var y = SIZE - parseInt(m[2], 10);
    if (!inBoard(x, y)) return null;
    return { x: x, y: y };
  }

  var api = {
    SIZE: SIZE,
    EMPTY: EMPTY,
    BLACK: BLACK,
    WHITE: WHITE,
    DIRS: DIRS,
    create: create,
    clone: clone,
    idx: idx,
    inBoard: inBoard,
    get: get,
    set: set,
    isEmpty: isEmpty,
    isFull: isFull,
    stoneCount: stoneCount,
    winLine: winLine,
    winnerOf: winnerOf,
    colName: colName,
    coordName: coordName,
    parseCoord: parseCoord
  };

  global.Gomoku = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
