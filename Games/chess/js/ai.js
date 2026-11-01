/**
 * ai.js - 国际象棋 AI（依赖 js/rules.js 的全局 Chess）
 *
 * NegaMax + Alpha-Beta 剪枝 + 迭代加深 + 静态搜索 + MVV-LVA 排序。
 * 评估：子力价值 + 位置表（兵/马/象/车/后/王）。
 * 伪合法着法搜索：以「吃掉对方王」为将死终局，省去搜索中的合法性过滤。
 */
(function (global) {
  'use strict';

  var X = global.Chess;

  var MATE = 100000;
  var VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

  /* 位置表（白方视角，y=0 为第 8 秩 / y=7 为第 1 秩；黑方镜像使用） */
  var PST = {
    P: [
      0,  0,  0,  0,  0,  0,  0,  0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5,  5, 10, 25, 25, 10,  5,  5,
      0,  0,  0, 20, 20,  0,  0,  0,
      5, -5, -10,  0,  0, -10, -5,  5,
      5, 10, 10, -20, -20, 10, 10,  5,
      0,  0,  0,  0,  0,  0,  0,  0
    ],
    N: [
      -50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50
    ],
    B: [
      -20, -10, -10, -10, -10, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -20, -10, -10, -10, -10, -10, -10, -20
    ],
    R: [
      0, 0, 0, 0, 0, 0, 0, 0,
      5, 10, 10, 10, 10, 10, 10, 5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      0, 0, 0, 5, 5, 0, 0, 0
    ],
    Q: [
      -20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20
    ],
    K: [
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20,
      -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20,
      20, 30, 10, 0, 0, 10, 30, 20
    ]
  };

  function pstValue(p, x, y) {
    // 表按白方视角（y=7 为第 1 秩在表底）；黑方镜像
    var idx = p.s === 'w' ? (7 - y) * 8 + x : y * 8 + x;
    return PST[p.t][idx];
  }

  /** 静态评估（side 视角） */
  function evaluate(state, side) {
    var b = state.board, score = 0;
    for (var y = 0; y < 8; y++) {
      for (var x = 0; x < 8; x++) {
        var p = b[y][x];
        if (!p) continue;
        var v = VALUE[p.t] + pstValue(p, x, y);
        score += p.s === side ? v : -v;
      }
    }
    return score;
  }

  /* ---------------- 搜索 ---------------- */

  function now() {
    return typeof performance !== 'undefined' && performance.now
      ? performance.now() : Date.now();
  }

  // 超时用标志位中断（而不是抛异常），保证 make/unmake 成对、局面不被污染
  var aborted = false;
  function timeUp(deadline) {
    if (aborted) return true;
    if (deadline && now() > deadline) aborted = true;
    return aborted;
  }

  function genMoves(state, side) {
    var moves = [];
    for (var y = 0; y < 8; y++) {
      for (var x = 0; x < 8; x++) {
        var p = state.board[y][x];
        if (p && p.s === side) {
          moves = moves.concat(X.pseudoMoves(state, x, y));
        }
      }
    }
    return moves;
  }

  /** MVV-LVA + 升变加成 */
  function moveScore(state, m) {
    var victim = state.board[m.to.y][m.to.x];
    var attacker = state.board[m.from.y][m.from.x];
    var s = 0;
    if (victim) s += VALUE[victim.t] * 10 - VALUE[attacker.t];
    if (m.promo) s += VALUE[m.promo] * 8;
    return s;
  }

  function orderMoves(state, moves) {
    moves.sort(function (a, b) { return moveScore(state, b) - moveScore(state, a); });
    return moves;
  }

  function quiesce(state, alpha, beta, side, ply, deadline) {
    if (timeUp(deadline)) return alpha;
    if (ply > 18) return evaluate(state, side);

    var inChk = X.inCheck(state, side);
    if (!inChk) {
      var stand = evaluate(state, side);
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
    }

    var moves = genMoves(state, side);
    if (!inChk) {
      moves = moves.filter(function (m) {
        return state.board[m.to.y][m.to.x] != null || m.promo;
      });
    }
    orderMoves(state, moves);

    var best = -Infinity;
    var opp = X.other(side);
    for (var i = 0; i < moves.length; i++) {
      var undo = X.makeMove(state, moves[i]);
      var captured = undo.captured;
      var score;
      if (captured && captured.t === 'K') {
        score = MATE - ply;
      } else {
        score = -quiesce(state, -beta, -alpha, opp, ply + 1, deadline);
      }
      X.undoMove(state, moves[i], undo);
      if (aborted) break;
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    if (best === -Infinity) {
      // 静态搜索里无着可走：被将军 = 将死；否则只是没有吃子，返回静态评估
      return inChk ? -MATE + ply : alpha;
    }
    return best;
  }

  function negamax(state, alpha, beta, depth, ply, deadline) {
    if (timeUp(deadline)) return alpha;
    if (depth <= 0) return quiesce(state, alpha, beta, state.turn, ply, deadline);

    var side = state.turn;
    var moves = orderMoves(state, genMoves(state, side));
    var best = -Infinity;
    var opp = X.other(side);

    for (var i = 0; i < moves.length; i++) {
      var undo = X.makeMove(state, moves[i]);
      var captured = undo.captured;
      var score;
      if (captured && captured.t === 'K') {
        score = MATE - ply;
      } else {
        score = -negamax(state, -beta, -alpha, depth - 1, ply + 1, deadline);
      }
      X.undoMove(state, moves[i], undo);
      if (aborted) break;
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    if (best === -Infinity) {
      // 无着可走：将死判负，逼和（stalemate）判和
      return X.inCheck(state, side) ? -MATE + ply : 0;
    }
    return best;
  }

  /**
   * 为 state.turn 找最佳着法。
   * opts: { difficulty: 'easy'|'medium'|'hard' }
   */
  function findBestMove(state, opts) {
    opts = opts || {};
    var difficulty = opts.difficulty || 'medium';
    var budget = difficulty === 'hard' ? 2200 : difficulty === 'easy' ? 0 : 900;
    var maxDepth = difficulty === 'easy' ? 2 : 20;
    var deadline = budget ? now() + budget : 0;
    aborted = false;

    var rootMoves = orderMoves(state, genMoves(state, state.turn));
    if (!rootMoves.length) return null;

    var best = null;
    var scored = [];
    for (var depth = 1; depth <= maxDepth; depth++) {
      var alpha = -Infinity, beta = Infinity;
      var partial = [];
      for (var i = 0; i < rootMoves.length; i++) {
        if (timeUp(deadline)) break;
        var undo = X.makeMove(state, rootMoves[i]);
        var captured = undo.captured;
        var score;
        if (captured && captured.t === 'K') {
          score = MATE - 1;
        } else {
          score = -negamax(state, -beta, -alpha, depth - 1, 1, deadline);
        }
        X.undoMove(state, rootMoves[i], undo);
        if (aborted) break;
        partial.push({ mv: rootMoves[i], score: score });
        if (score > alpha) alpha = score;
      }
      if (aborted || partial.length < rootMoves.length) break; // 本层未完成，弃用
      partial.sort(function (a, b) { return b.score - a.score; });
      // 按分数重排根着法，提高后续迭代剪枝效率
      rootMoves = partial.map(function (s) { return s.mv; });
      scored = partial;
      best = {
        from: scored[0].mv.from, to: scored[0].mv.to, promo: scored[0].mv.promo,
        score: scored[0].score, depth: depth
      };
      // 找到杀棋不用再深搜
      if (Math.abs(scored[0].score) >= MATE - 100) break;
    }

    // 简单难度：在接近最佳的着法里随机挑，制造失误
    if (difficulty === 'easy' && scored.length > 1) {
      var slack = 60;
      var pool = scored.filter(function (s) { return s.score >= scored[0].score - slack; });
      var pick = pool[Math.floor(Math.random() * pool.length)];
      best = { from: pick.mv.from, to: pick.mv.to, promo: pick.mv.promo, score: pick.score, depth: best ? best.depth : 0 };
    }
    // 兜底：超时未完成任何深度时退回首着
    if (!best) {
      var f = rootMoves[0];
      best = { from: f.from, to: f.to, promo: f.promo, score: 0, depth: 0 };
    }
    return best;
  }

  global.ChessAI = {
    evaluate: evaluate,
    genMoves: genMoves,
    findBestMove: findBestMove
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.ChessAI;
  }
})(typeof window !== 'undefined' ? window : globalThis);
