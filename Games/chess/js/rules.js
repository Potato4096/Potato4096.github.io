/**
 * rules.js - 国际象棋规则引擎（纯逻辑，无 DOM 依赖，浏览器 / Node 通用）
 *
 * 棋盘坐标：x = 0..7（列，左→右 = a..h 文件），y = 0..7（行，上→下 = 8..1 秩）。
 * 白方在下（y=7 为第 1 秩），黑方在上（y=0 为第 8 秩）。
 * 棋子：{ t: 'K'|'Q'|'R'|'B'|'N'|'P', s: 'w'|'b' }
 *   K 王  Q 后  R 车  B 象  N 马  P 兵
 *
 * 局面状态 state = {
 *   board, turn: 'w'|'b',
 *   castling: { K, Q, k, q },   // 白/黑 王翼/后翼 易位权
 *   ep: null | {x, y},          // 吃过路兵目标格
 *   halfmove, fullmove
 * }
 */
(function (global) {
  'use strict';

  var ROWS = 8, COLS = 8;

  var PIECE_CHARS = {
    w: { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: 'P' },
    b: { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: 'P' }
  };

  var PROMO_TYPES = ['Q', 'R', 'B', 'N'];

  function makePiece(t, s) { return { t: t, s: s }; }

  function inBoard(x, y) { return x >= 0 && x < COLS && y >= 0 && y < ROWS; }

  function other(s) { return s === 'w' ? 'b' : 'w'; }

  function squareName(x, y) {
    return 'abcdefgh'[x] + String(8 - y);
  }

  function initialState() {
    var b = [], y, x;
    for (y = 0; y < ROWS; y++) b.push(new Array(COLS).fill(null));
    var back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (x = 0; x < COLS; x++) {
      b[0][x] = makePiece(back[x], 'b');
      b[7][x] = makePiece(back[x], 'w');
      b[1][x] = makePiece('P', 'b');
      b[6][x] = makePiece('P', 'w');
    }
    return {
      board: b,
      turn: 'w',
      castling: { K: true, Q: true, k: true, q: true },
      ep: null,
      halfmove: 0,
      fullmove: 1
    };
  }

  function cloneState(st) {
    return {
      board: st.board.map(function (row) {
        return row.map(function (p) { return p ? { t: p.t, s: p.s } : null; });
      }),
      turn: st.turn,
      castling: { K: st.castling.K, Q: st.castling.Q, k: st.castling.k, q: st.castling.q },
      ep: st.ep ? { x: st.ep.x, y: st.ep.y } : null,
      halfmove: st.halfmove,
      fullmove: st.fullmove
    };
  }

  /* ---------------- 攻击判定 ---------------- */

  var KNIGHT_D = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  var KING_D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  var ORTHO_D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var DIAG_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

  /** 格 (x,y) 是否被 bySide 攻击 */
  function isAttacked(state, x, y, bySide) {
    var b = state.board, p, i, d, sx, sy, k;

    // 兵：白兵在 (x±1, y+1) 攻击 (x,y)；黑兵在 (x±1, y-1)
    var py = bySide === 'w' ? y + 1 : y - 1;
    for (i = -1; i <= 1; i += 2) {
      if (inBoard(x + i, py)) {
        p = b[py][x + i];
        if (p && p.s === bySide && p.t === 'P') return true;
      }
    }
    // 马
    for (i = 0; i < KNIGHT_D.length; i++) {
      d = KNIGHT_D[i]; sx = x + d[0]; sy = y + d[1];
      if (inBoard(sx, sy)) {
        p = b[sy][sx];
        if (p && p.s === bySide && p.t === 'N') return true;
      }
    }
    // 王
    for (i = 0; i < KING_D.length; i++) {
      d = KING_D[i]; sx = x + d[0]; sy = y + d[1];
      if (inBoard(sx, sy)) {
        p = b[sy][sx];
        if (p && p.s === bySide && p.t === 'K') return true;
      }
    }
    // 车/后（直线）
    for (i = 0; i < ORTHO_D.length; i++) {
      d = ORTHO_D[i]; sx = x + d[0]; sy = y + d[1];
      while (inBoard(sx, sy)) {
        p = b[sy][sx];
        if (p) {
          if (p.s === bySide && (p.t === 'R' || p.t === 'Q')) return true;
          break;
        }
        sx += d[0]; sy += d[1];
      }
    }
    // 象/后（斜线）
    for (i = 0; i < DIAG_D.length; i++) {
      d = DIAG_D[i]; sx = x + d[0]; sy = y + d[1];
      while (inBoard(sx, sy)) {
        p = b[sy][sx];
        if (p) {
          if (p.s === bySide && (p.t === 'B' || p.t === 'Q')) return true;
          break;
        }
        sx += d[0]; sy += d[1];
      }
    }
    return false;
  }

  function findKing(state, side) {
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var p = state.board[y][x];
        if (p && p.s === side && p.t === 'K') return { x: x, y: y };
      }
    }
    return null;
  }

  function inCheck(state, side) {
    var k = findKing(state, side);
    return k ? isAttacked(state, k.x, k.y, other(side)) : true;
  }

  /* ---------------- 着法生成 ---------------- */

  /** 伪合法着法（不含王安全过滤）；升变生成 4 个 promo 着法 */
  function pseudoMoves(state, x, y) {
    var b = state.board;
    var p = b[y][x];
    if (!p) return [];
    var moves = [], i, d, sx, sy, t;

    function add(tx, ty, extra) {
      var mv = { from: { x: x, y: y }, to: { x: tx, y: ty } };
      if (extra) {
        if (extra.promo) mv.promo = extra.promo;
      }
      moves.push(mv);
    }

    function addPawn(tx, ty) {
      var lastRank = p.s === 'w' ? 0 : 7;
      if (ty === lastRank) {
        PROMO_TYPES.forEach(function (pt) { add(tx, ty, { promo: pt }); });
      } else {
        add(tx, ty);
      }
    }

    if (p.t === 'P') {
      var dy = p.s === 'w' ? -1 : 1;
      var startRank = p.s === 'w' ? 6 : 1;
      // 前进
      if (inBoard(x, y + dy) && !b[y + dy][x]) {
        addPawn(x, y + dy);
        if (y === startRank && !b[y + 2 * dy][x]) addPawn(x, y + 2 * dy);
      }
      // 吃子 / 吃过路兵
      for (i = -1; i <= 1; i += 2) {
        sx = x + i; sy = y + dy;
        if (!inBoard(sx, sy)) continue;
        t = b[sy][sx];
        if (t && t.s !== p.s) {
          addPawn(sx, sy);
        } else if (!t && state.ep && state.ep.x === sx && state.ep.y === sy) {
          add(sx, sy);
        }
      }
    } else if (p.t === 'N') {
      for (i = 0; i < KNIGHT_D.length; i++) {
        d = KNIGHT_D[i]; sx = x + d[0]; sy = y + d[1];
        if (!inBoard(sx, sy)) continue;
        t = b[sy][sx];
        if (!t || t.s !== p.s) add(sx, sy);
      }
    } else if (p.t === 'K') {
      for (i = 0; i < KING_D.length; i++) {
        d = KING_D[i]; sx = x + d[0]; sy = y + d[1];
        if (!inBoard(sx, sy)) continue;
        t = b[sy][sx];
        if (!t || t.s !== p.s) add(sx, sy);
      }
      // 王车易位
      var right = p.s === 'w' ? state.castling : { K: state.castling.k, Q: state.castling.q };
      var opp = other(p.s);
      if (!isAttacked(state, x, y, opp)) {
        // 王翼：f g 格空且不受攻击
        if (right.K && !b[y][5] && !b[y][6] &&
            !isAttacked(state, 5, y, opp) && !isAttacked(state, 6, y, opp) &&
            b[y][7] && b[y][7].t === 'R' && b[y][7].s === p.s) {
          add(6, y);
        }
        // 后翼：b c d 格空且不受攻击
        if (right.Q && !b[y][1] && !b[y][2] && !b[y][3] &&
            !isAttacked(state, 3, y, opp) && !isAttacked(state, 2, y, opp) &&
            b[y][0] && b[y][0].t === 'R' && b[y][0].s === p.s) {
          add(2, y);
        }
      }
    } else {
      var dirs = p.t === 'R' ? ORTHO_D : p.t === 'B' ? DIAG_D : ORTHO_D.concat(DIAG_D);
      for (i = 0; i < dirs.length; i++) {
        d = dirs[i]; sx = x + d[0]; sy = y + d[1];
        while (inBoard(sx, sy)) {
          t = b[sy][sx];
          if (!t) {
            add(sx, sy);
          } else {
            if (t.s !== p.s) add(sx, sy);
            break;
          }
          sx += d[0]; sy += d[1];
        }
      }
    }
    return moves;
  }

  /* ---------------- 走子 / 撤销 ---------------- */

  /** 执行着法（就地修改 state），返回撤销信息 */
  function makeMove(state, m) {
    var b = state.board;
    var from = m.from, to = m.to;
    var piece = b[from.y][from.x];
    var undo = {
      captured: null, capSq: null,
      castling: { K: state.castling.K, Q: state.castling.Q, k: state.castling.k, q: state.castling.q },
      ep: state.ep, halfmove: state.halfmove, fullmove: state.fullmove,
      rookFrom: null, rookTo: null
    };
    var captured = b[to.y][to.x];

    // 吃过路兵
    if (piece.t === 'P' && !captured && to.x !== from.x &&
        state.ep && to.x === state.ep.x && to.y === state.ep.y) {
      captured = b[from.y][to.x];
      b[from.y][to.x] = null;
      undo.capSq = { x: to.x, y: from.y };
    }
    undo.captured = captured;

    b[to.y][to.x] = piece;
    b[from.y][from.x] = null;

    // 升变
    if (piece.t === 'P' && m.promo) {
      b[to.y][to.x] = makePiece(m.promo, piece.s);
    }

    // 王车易位：移动车
    if (piece.t === 'K' && Math.abs(to.x - from.x) === 2) {
      var ry = from.y;
      if (to.x === 6) {
        undo.rookFrom = { x: 7, y: ry }; undo.rookTo = { x: 5, y: ry };
      } else {
        undo.rookFrom = { x: 0, y: ry }; undo.rookTo = { x: 3, y: ry };
      }
      b[undo.rookTo.y][undo.rookTo.x] = b[undo.rookFrom.y][undo.rookFrom.x];
      b[undo.rookFrom.y][undo.rookFrom.x] = null;
    }

    // 易位权更新
    if (piece.t === 'K') {
      if (piece.s === 'w') { state.castling.K = false; state.castling.Q = false; }
      else { state.castling.k = false; state.castling.q = false; }
    }
    if (piece.t === 'R') {
      if (from.x === 0 && from.y === 7) state.castling.Q = false;
      if (from.x === 7 && from.y === 7) state.castling.K = false;
      if (from.x === 0 && from.y === 0) state.castling.q = false;
      if (from.x === 7 && from.y === 0) state.castling.k = false;
    }
    if (to.x === 0 && to.y === 7) state.castling.Q = false;
    if (to.x === 7 && to.y === 7) state.castling.K = false;
    if (to.x === 0 && to.y === 0) state.castling.q = false;
    if (to.x === 7 && to.y === 0) state.castling.k = false;

    // 过路兵目标格
    if (piece.t === 'P' && Math.abs(to.y - from.y) === 2) {
      state.ep = { x: from.x, y: (from.y + to.y) / 2 };
    } else {
      state.ep = null;
    }

    if (piece.t === 'P' || captured) state.halfmove = 0;
    else state.halfmove++;
    if (state.turn === 'b') state.fullmove++;
    state.turn = other(state.turn);
    return undo;
  }

  /** 撤销着法 */
  function undoMove(state, m, undo) {
    var b = state.board;
    state.turn = other(state.turn);
    state.castling.K = undo.castling.K;
    state.castling.Q = undo.castling.Q;
    state.castling.k = undo.castling.k;
    state.castling.q = undo.castling.q;
    state.ep = undo.ep;
    state.halfmove = undo.halfmove;
    state.fullmove = undo.fullmove;

    var piece = b[m.to.y][m.to.x];
    if (m.promo) piece = makePiece('P', piece.s);
    b[m.from.y][m.from.x] = piece;

    if (undo.rookFrom) {
      b[undo.rookFrom.y][undo.rookFrom.x] = b[undo.rookTo.y][undo.rookTo.x];
      b[undo.rookTo.y][undo.rookTo.x] = null;
    }

    if (undo.capSq) {
      b[undo.capSq.y][undo.capSq.x] = undo.captured;
      b[m.to.y][m.to.x] = null;
    } else {
      b[m.to.y][m.to.x] = undo.captured;
    }
  }

  /* ---------------- 合法着法 ---------------- */

  function legalMovesFrom(state, x, y) {
    var p = state.board[y][x];
    if (!p) return [];
    var pseudo = pseudoMoves(state, x, y);
    var res = [];
    for (var i = 0; i < pseudo.length; i++) {
      var undo = makeMove(state, pseudo[i]);
      if (!inCheck(state, p.s)) res.push(pseudo[i]);
      undoMove(state, pseudo[i], undo);
    }
    return res;
  }

  function legalMoves(state, x, y) { return legalMovesFrom(state, x, y); }

  function allLegalMoves(state) {
    var res = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var p = state.board[y][x];
        if (p && p.s === state.turn) {
          res = res.concat(legalMovesFrom(state, x, y));
        }
      }
    }
    return res;
  }

  /* ---------------- 局面判定 ---------------- */

  function positionKey(state) {
    var parts = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var p = state.board[y][x];
        parts.push(p ? (p.s === 'w' ? p.t : p.t.toLowerCase()) : '.');
      }
    }
    var c = state.castling;
    parts.push(state.turn);
    parts.push((c.K ? 'K' : '') + (c.Q ? 'Q' : '') + (c.k ? 'k' : '') + (c.q ? 'q' : '') || '-');
    parts.push(state.ep ? squareName(state.ep.x, state.ep.y) : '-');
    return parts.join('');
  }

  /** 子力不足和棋：K vs K / K+N vs K / K+B vs K / K+B vs K+B（同色格象） */
  function insufficientMaterial(state) {
    var minors = [], count = 0;
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        var p = state.board[y][x];
        if (!p || p.t === 'K') continue;
        count++;
        if (p.t === 'P' || p.t === 'R' || p.t === 'Q') return false;
        if (p.t === 'N' || p.t === 'B') minors.push({ t: p.t, sq: (x + y) % 2 });
      }
    }
    if (count === 0) return true;
    if (count === 1) return minors[0].t === 'N' || minors[0].t === 'B';
    if (count === 2 && minors.length === 2 &&
        minors[0].t === 'B' && minors[1].t === 'B' && minors[0].sq === minors[1].sq) {
      return true;
    }
    return false;
  }

  /**
   * 局面状态判定。
   * repKeys：可选，历史 positionKey 数组，用于三次重复判和。
   */
  function statusAfter(state, repKeys) {
    var chk = inCheck(state, state.turn);
    var moves = allLegalMoves(state);
    if (!moves.length) {
      if (chk) return { over: true, winner: other(state.turn), reason: 'checkmate', check: true };
      return { over: true, winner: null, reason: 'stalemate', check: false };
    }
    if (state.halfmove >= 100) return { over: true, winner: null, reason: 'fifty', check: chk };
    if (repKeys) {
      var key = positionKey(state), n = 0;
      for (var i = 0; i < repKeys.length; i++) if (repKeys[i] === key) n++;
      if (n >= 3) return { over: true, winner: null, reason: 'repetition', check: chk };
    }
    if (insufficientMaterial(state)) return { over: true, winner: null, reason: 'insufficient', check: chk };
    return { over: false, winner: null, reason: null, check: chk };
  }

  /* ---------------- 标准记谱（SAN） ---------------- */

  function notation(state, m) {
    var b = state.board;
    var piece = b[m.from.y][m.from.x];
    if (!piece) return '?';

    // 王车易位
    if (piece.t === 'K' && Math.abs(m.to.x - m.from.x) === 2) {
      return m.to.x === 6 ? withCheckSuffix(state, m, 'O-O') : withCheckSuffix(state, m, 'O-O-O');
    }

    var dest = squareName(m.to.x, m.to.y);
    var isCapture = !!(b[m.to.y][m.to.x]) ||
      (piece.t === 'P' && state.ep && m.to.x === state.ep.x && m.to.y === state.ep.y);
    var s;

    if (piece.t === 'P') {
      s = (isCapture ? 'abcdefgh'[m.from.x] + 'x' : '') + dest;
      if (m.promo) s += '=' + m.promo;
    } else {
      s = piece.t + disambiguation(state, m) + (isCapture ? 'x' : '') + dest;
    }
    return withCheckSuffix(state, m, s);
  }

  /** 同类棋子同目标格的消歧：文件 / 秩 / 全坐标 */
  function disambiguation(state, m) {
    var piece = state.board[m.from.y][m.from.x];
    var rivals = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (x === m.from.x && y === m.from.y) continue;
        var p = state.board[y][x];
        if (!p || p.s !== piece.s || p.t !== piece.t) continue;
        var lm = legalMovesFrom(state, x, y);
        for (var i = 0; i < lm.length; i++) {
          if (lm[i].to.x === m.to.x && lm[i].to.y === m.to.y) {
            rivals.push({ x: x, y: y });
            break;
          }
        }
      }
    }
    if (!rivals.length) return '';
    var sameFile = rivals.some(function (r) { return r.x === m.from.x; });
    var sameRank = rivals.some(function (r) { return r.y === m.from.y; });
    if (!sameFile) return 'abcdefgh'[m.from.x];
    if (!sameRank) return String(8 - m.from.y);
    return squareName(m.from.x, m.from.y);
  }

  /** 追加 + / # 后缀（就地试走判定） */
  function withCheckSuffix(state, m, s) {
    var undo = makeMove(state, m);
    if (inCheck(state, state.turn)) {
      s += allLegalMoves(state).length ? '+' : '#';
    }
    undoMove(state, m, undo);
    return s;
  }

  var api = {
    ROWS: ROWS,
    COLS: COLS,
    PIECE_CHARS: PIECE_CHARS,
    PROMO_TYPES: PROMO_TYPES,
    initialState: initialState,
    cloneState: cloneState,
    inBoard: inBoard,
    other: other,
    squareName: squareName,
    isAttacked: isAttacked,
    findKing: findKing,
    inCheck: inCheck,
    pseudoMoves: pseudoMoves,
    legalMoves: legalMoves,
    allLegalMoves: allLegalMoves,
    makeMove: makeMove,
    undoMove: undoMove,
    positionKey: positionKey,
    insufficientMaterial: insufficientMaterial,
    statusAfter: statusAfter,
    notation: notation
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Chess = api;
})(typeof window !== 'undefined' ? window : globalThis);
