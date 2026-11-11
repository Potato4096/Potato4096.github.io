/**
 * rules.js - 围棋核心规则（纯函数，无平台依赖）
 *
 * 棋盘为一维 Int8Array：0 空 / 1 黑 / 2 白。
 * 实现范围：气、整块提子、禁自杀、简单劫（ko）、虚手、中国规则数子法计分。
 */
(function (global) {
  'use strict';

  var EMPTY = 0;
  var BLACK = 1;
  var WHITE = 2;
  var SIZES = [9, 13, 19];
  var KOMI = 7.5; // 黑贴 3 又 3/4 子，折算 7.5 目

  function create(size) {
    return new Int8Array(size * size);
  }

  function clone(board) {
    return Int8Array.from(board);
  }

  function idx(size, x, y) {
    return y * size + x;
  }

  function inBoard(size, x, y) {
    return x >= 0 && y >= 0 && x < size && y < size;
  }

  function get(board, size, x, y) {
    return inBoard(size, x, y) ? board[idx(size, x, y)] : -1;
  }

  function opponent(color) {
    return color === BLACK ? WHITE : BLACK;
  }

  /** 交点四邻（只返回盘内） */
  function neighbors(size, x, y) {
    var out = [];
    if (x > 0) out.push([x - 1, y]);
    if (x < size - 1) out.push([x + 1, y]);
    if (y > 0) out.push([x, y - 1]);
    if (y < size - 1) out.push([x, y + 1]);
    return out;
  }

  /**
   * 收集 (x,y) 所在整块棋的同色棋子与气。
   * 返回 { color, stones: [index], liberties: 数量, libertyPoints: [index] }
   */
  function groupAt(board, size, x, y) {
    var color = get(board, size, x, y);
    if (color !== BLACK && color !== WHITE) {
      return { color: EMPTY, stones: [], liberties: 0, libertyPoints: [] };
    }
    var start = idx(size, x, y);
    var seen = new Uint8Array(size * size);
    var libSeen = new Uint8Array(size * size);
    var stones = [];
    var libs = [];
    var stack = [start];
    seen[start] = 1;

    while (stack.length) {
      var i = stack.pop();
      stones.push(i);
      var cx = i % size;
      var cy = (i / size) | 0;
      var nb = neighbors(size, cx, cy);
      for (var k = 0; k < nb.length; k++) {
        var ni = idx(size, nb[k][0], nb[k][1]);
        var v = board[ni];
        if (v === EMPTY) {
          if (!libSeen[ni]) { libSeen[ni] = 1; libs.push(ni); }
        } else if (v === color && !seen[ni]) {
          seen[ni] = 1;
          stack.push(ni);
        }
      }
    }
    return { color: color, stones: stones, liberties: libs.length, libertyPoints: libs };
  }

  /**
   * 尝试落子（不修改原盘）。
   * @returns {{ok:boolean, reason?:string, board?:Int8Array, captured?:number[], ko?:number}}
   *   reason: 'occupied' | 'ko' | 'suicide'
   */
  function play(board, size, x, y, color, ko) {
    if (!inBoard(size, x, y)) return { ok: false, reason: 'out' };
    var pos = idx(size, x, y);
    if (board[pos] !== EMPTY) return { ok: false, reason: 'occupied' };
    if (ko != null && ko >= 0 && pos === ko) return { ok: false, reason: 'ko' };

    var next = clone(board);
    next[pos] = color;
    var opp = opponent(color);
    var captured = [];

    var nb = neighbors(size, x, y);
    for (var k = 0; k < nb.length; k++) {
      var ni = idx(size, nb[k][0], nb[k][1]);
      if (next[ni] === opp) {
        var g = groupAt(next, size, nb[k][0], nb[k][1]);
        if (g.liberties === 0) {
          for (var j = 0; j < g.stones.length; j++) {
            next[g.stones[j]] = EMPTY;
            captured.push(g.stones[j]);
          }
        }
      }
    }

    var mine = groupAt(next, size, x, y);
    if (mine.liberties === 0 && captured.length === 0) {
      return { ok: false, reason: 'suicide' };
    }

    var newKo = -1;
    if (captured.length === 1 && mine.stones.length === 1 && mine.liberties === 1) {
      newKo = captured[0];
    }

    return { ok: true, board: next, captured: captured, ko: newKo };
  }

  /**
   * 中国规则数子法：我方棋子数 + 我方单独围住的空点数。
   * 被双方共同包围的空点（单官 / 双活）不计。
   */
  function score(board, size, komi) {
    var n = size * size;
    var visited = new Uint8Array(n);
    var blackStones = 0;
    var whiteStones = 0;
    var blackTerritory = 0;
    var whiteTerritory = 0;
    var neutral = 0;

    for (var i = 0; i < n; i++) {
      if (board[i] === BLACK) blackStones++;
      else if (board[i] === WHITE) whiteStones++;
    }

    for (i = 0; i < n; i++) {
      if (board[i] !== EMPTY || visited[i]) continue;

      var region = [];
      var stack = [i];
      var touchesBlack = false;
      var touchesWhite = false;
      visited[i] = 1;

      while (stack.length) {
        var p = stack.pop();
        region.push(p);
        var px = p % size;
        var py = (p / size) | 0;
        var nb = neighbors(size, px, py);
        for (var k = 0; k < nb.length; k++) {
          var ni = idx(size, nb[k][0], nb[k][1]);
          var v = board[ni];
          if (v === EMPTY) {
            if (!visited[ni]) { visited[ni] = 1; stack.push(ni); }
          } else if (v === BLACK) {
            touchesBlack = true;
          } else {
            touchesWhite = true;
          }
        }
      }

      if (touchesBlack && !touchesWhite) blackTerritory += region.length;
      else if (touchesWhite && !touchesBlack) whiteTerritory += region.length;
      else neutral += region.length;
    }

    var k = (komi == null) ? KOMI : komi;
    var blackTotal = blackStones + blackTerritory;
    var whiteTotal = whiteStones + whiteTerritory + k;
    var diff = blackTotal - whiteTotal;

    return {
      komi: k,
      black: { stones: blackStones, territory: blackTerritory, total: blackTotal },
      white: { stones: whiteStones, territory: whiteTerritory, total: whiteTotal },
      neutral: neutral,
      diff: diff,
      winner: diff > 0 ? BLACK : diff < 0 ? WHITE : EMPTY,
      margin: Math.abs(diff)
    };
  }

  /** 列字母：跳过 I，与围棋惯例一致 */
  function colName(x) {
    var code = 65 + x + (x >= 8 ? 1 : 0);
    return String.fromCharCode(code);
  }

  function colIndex(letter) {
    var code = letter.toUpperCase().charCodeAt(0) - 65;
    if (code > 8) code -= 1; // 跳过 I
    return code >= 0 && code < 25 ? code : -1;
  }

  /** 坐标名，如 D4：列字母 + 行号（自下而上） */
  function coordName(size, x, y) {
    return colName(x) + (size - y);
  }

  function parseCoord(size, text) {
    var m = String(text || '').toUpperCase().match(/^([A-HJ-T])(\d{1,2})$/);
    if (!m) return null;
    var x = colIndex(m[1]);
    var y = size - parseInt(m[2], 10);
    if (!inBoard(size, x, y)) return null;
    return { x: x, y: y };
  }

  /** 星位（含天元），按棋盘大小返回 */
  function starPoints(size) {
    if (size === 19) {
      var p = [3, 9, 15];
      var out = [];
      for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
          if (p[i] === 9 && p[j] === 9) out.push([9, 9]);
          else out.push([p[i], p[j]]);
        }
      }
      return out;
    }
    if (size === 13) {
      return [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]];
    }
    if (size === 9) {
      return [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]];
    }
    return [];
  }

  function stoneCount(board) {
    var b = 0, w = 0;
    for (var i = 0; i < board.length; i++) {
      if (board[i] === BLACK) b++;
      else if (board[i] === WHITE) w++;
    }
    return { black: b, white: w };
  }

  var api = {
    EMPTY: EMPTY,
    BLACK: BLACK,
    WHITE: WHITE,
    SIZES: SIZES,
    KOMI: KOMI,
    create: create,
    clone: clone,
    idx: idx,
    inBoard: inBoard,
    get: get,
    opponent: opponent,
    neighbors: neighbors,
    groupAt: groupAt,
    play: play,
    score: score,
    colName: colName,
    colIndex: colIndex,
    coordName: coordName,
    parseCoord: parseCoord,
    starPoints: starPoints,
    stoneCount: stoneCount
  };

  global.GoRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
