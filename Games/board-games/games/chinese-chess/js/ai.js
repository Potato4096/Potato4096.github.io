/**
 * ai.js - 中国象棋 AI
 * 算法：NegaMax + Alpha-Beta 剪枝 + 迭代加深 + 静态搜索(吃子延伸) + MVV-LVA 排序
 * 搜索采用「伪合法着法 + 吃将判胜」策略，配合飞将捕捉，天然处理将帅对脸。
 * 依赖：js/rules.js（Xiangqi），无 DOM 依赖，浏览器 / Node 通用。
 */
(function (global) {
  'use strict';

  var X = global.Xiangqi;

  /* ---------------- 评估参数 ---------------- */
  var VALUE = { K: 10000, R: 900, C: 450, H: 400, E: 200, A: 200, P: 100 };
  var MATE = 100000;

  // 位置表（红方视角，索引 [y][x]，y=0 为敌方底线）；黑方按 y 镜像
  var PST_P = [
    [0, 3, 6, 9, 12, 9, 6, 3, 0],
    [18, 36, 56, 80, 120, 80, 56, 36, 18],
    [14, 26, 42, 60, 80, 60, 42, 26, 14],
    [10, 20, 30, 34, 40, 34, 30, 20, 10],
    [6, 12, 18, 18, 20, 18, 18, 12, 6],
    [2, 0, 8, 0, 16, 0, 8, 0, 2],
    [0, 0, -2, 0, 4, 0, -2, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ];
  var PST_H = [
    [4, 8, 16, 12, 4, 12, 16, 8, 4],
    [4, 10, 28, 16, 8, 16, 28, 10, 4],
    [12, 14, 16, 20, 18, 20, 16, 14, 12],
    [8, 24, 18, 24, 20, 24, 18, 24, 8],
    [6, 16, 14, 18, 16, 18, 14, 16, 6],
    [4, 12, 16, 14, 12, 14, 16, 12, 4],
    [2, 6, 8, 6, 10, 6, 8, 6, 2],
    [4, 2, 8, 8, 4, 8, 8, 2, 4],
    [0, 2, 4, 4, -2, 4, 4, 2, 0],
    [0, -4, 0, 0, 0, 0, 0, -4, 0]
  ];
  var PST_C = [
    [6, 4, 0, -10, -12, -10, 0, 4, 6],
    [2, 2, 0, -8, -14, -8, 0, 2, 2],
    [2, 2, 0, -6, -12, -6, 0, 2, 2],
    [0, 0, -2, 4, 10, 4, -2, 0, 0],
    [0, 0, 0, 2, 8, 2, 0, 0, 0],
    [-2, 0, 4, 2, 6, 2, 4, 0, -2],
    [0, 0, 0, 2, 4, 2, 0, 0, 0],
    [4, 0, 8, 6, 10, 6, 8, 0, 4],
    [0, 2, 4, 6, 6, 6, 4, 2, 0],
    [0, 0, 2, 6, 6, 6, 2, 0, 0]
  ];
  var PST_R = [
    [14, 14, 12, 18, 16, 18, 12, 14, 14],
    [16, 20, 18, 24, 26, 24, 18, 20, 16],
    [12, 12, 12, 18, 18, 18, 12, 12, 12],
    [12, 18, 16, 22, 22, 22, 16, 18, 12],
    [12, 14, 12, 18, 18, 18, 12, 14, 12],
    [12, 16, 14, 20, 20, 20, 14, 16, 12],
    [6, 10, 8, 14, 14, 14, 8, 10, 6],
    [4, 8, 6, 14, 12, 14, 6, 8, 4],
    [8, 4, 8, 16, 8, 16, 8, 4, 8],
    [-2, 10, 6, 14, 12, 14, 6, 10, -2]
  ];
  var PSTS = { P: PST_P, H: PST_H, C: PST_C, R: PST_R };

  function pieceValue(t) { return VALUE[t] || 0; }

  /** 从 side 视角的静态评估 */
  function evaluate(board, side) {
    var score = 0;
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 9; x++) {
        var p = board[y][x];
        if (!p) continue;
        var v = pieceValue(p.t);
        var table = PSTS[p.t];
        if (table) v += table[p.s === 'r' ? y : 9 - y][x];
        score += p.s === side ? v : -v;
      }
    }
    return score;
  }

  /* ---------------- 走子生成（伪合法 + 飞将） ---------------- */

  function genMoves(board, side) {
    var moves = [];
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 9; x++) {
        var p = board[y][x];
        if (!p || p.s !== side) continue;
        var ms = X.pseudoMoves(board, x, y);
        for (var i = 0; i < ms.length; i++) {
          moves.push({ from: { x: x, y: y }, to: ms[i] });
        }
      }
    }
    // 飞将（将帅对脸视作将可吃对方将）
    var g = X.findGeneral(board, side);
    var e = X.findGeneral(board, side === 'r' ? 'b' : 'r');
    if (g && e && g.x === e.x) {
      var clear = true;
      for (var yy = Math.min(g.y, e.y) + 1; yy < Math.max(g.y, e.y); yy++) {
        if (board[yy][g.x]) { clear = false; break; }
      }
      if (clear) moves.push({ from: { x: g.x, y: g.y }, to: { x: e.x, y: e.y } });
    }
    return moves;
  }

  function make(board, mv) {
    var captured = board[mv.to.y][mv.to.x];
    board[mv.to.y][mv.to.x] = board[mv.from.y][mv.from.x];
    board[mv.from.y][mv.from.x] = null;
    return captured;
  }

  function unmake(board, mv, captured) {
    board[mv.from.y][mv.from.x] = board[mv.to.y][mv.to.x];
    board[mv.to.y][mv.to.x] = captured;
  }

  /** MVV-LVA 排序：先吃大子，被吃的子优先、吃子方价值低者优先 */
  function orderMoves(board, moves) {
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var victim = board[m.to.y][m.to.x];
      var attacker = board[m.from.y][m.from.x];
      m._s = victim ? pieceValue(victim.t) * 10 - pieceValue(attacker.t) : 0;
    }
    moves.sort(function (a, b) { return b._s - a._s; });
  }

  /* ---------------- 搜索 ---------------- */

  var TIMEOUT = { timeout: true };
  var nodeCount = 0;

  function checkTime(deadline) {
    if ((++nodeCount & 255) === 0 && Date.now() >= deadline) throw TIMEOUT;
  }

  /** 静态搜索：只延伸吃子；被将军时搜索全部应着 */
  function quiesce(board, alpha, beta, side, ply, deadline) {
    checkTime(deadline);
    if (ply > 18) return evaluate(board, side);

    var inChk = X.inCheck(board, side);
    var stand = -Infinity;
    if (!inChk) {
      stand = evaluate(board, side);
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
    }

    var moves = genMoves(board, side);
    if (!inChk) {
      moves = moves.filter(function (m) {
        return board[m.to.y][m.to.x] != null;
      });
      if (!moves.length) return stand; // 无吃子可搜：返回静态值
    }
    orderMoves(board, moves);

    var best = -Infinity;
    var opp = side === 'r' ? 'b' : 'r';
    for (var i = 0; i < moves.length; i++) {
      var captured = make(board, moves[i]);
      var score;
      if (captured && captured.t === 'K') {
        score = MATE - ply;
      } else {
        score = -quiesce(board, -beta, -alpha, opp, ply + 1, deadline);
      }
      unmake(board, moves[i], captured);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    if (best === -Infinity) {
      // 被将军且无着可走：将死/困毙均判负
      return -MATE + ply;
    }
    return best;
  }

  /** NegaMax + Alpha-Beta */
  function negamax(board, depth, alpha, beta, side, ply, deadline) {
    checkTime(deadline);
    if (depth <= 0) return quiesce(board, alpha, beta, side, ply, deadline);

    var moves = genMoves(board, side);
    orderMoves(board, moves);
    var best = -Infinity;
    var opp = side === 'r' ? 'b' : 'r';

    for (var i = 0; i < moves.length; i++) {
      var captured = make(board, moves[i]);
      var score;
      if (captured && captured.t === 'K') {
        score = MATE - ply;
      } else {
        score = -negamax(board, depth - 1, -beta, -alpha, opp, ply + 1, deadline);
      }
      unmake(board, moves[i], captured);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best === -Infinity ? -MATE + ply : best;
  }

  /* ---------------- 难度与入口 ---------------- */

  var LEVELS = {
    easy: { maxDepth: 2, timeMs: 300, slack: 70 },   // 简单：浅搜索 + 随机应手
    medium: { maxDepth: 5, timeMs: 900, slack: 0 },  // 中等
    hard: { maxDepth: 8, timeMs: 2200, slack: 0 }    // 困难：迭代加深到时限
  };

  /**
   * 为 side 找最优着法。board 不被修改。
   * options: { difficulty: 'easy'|'medium'|'hard' }
   * 返回 { from, to, score, depth } 或 null（无着可走）
   */
  function findBestMove(board, side, options) {
    var level = LEVELS[(options && options.difficulty) || 'medium'] || LEVELS.medium;
    var work = X.cloneBoard(board);
    var deadline = Date.now() + level.timeMs;
    nodeCount = 0;

    var rootMoves = genMoves(work, side);
    if (!rootMoves.length) return null;
    orderMoves(work, rootMoves);
    var opp = side === 'r' ? 'b' : 'r';

    var best = null;
    var rootScores = [];

    for (var depth = 1; depth <= level.maxDepth; depth++) {
      var alpha = -Infinity;
      var scored = [];
      try {
        for (var i = 0; i < rootMoves.length; i++) {
          var mv = rootMoves[i];
          var captured = make(work, mv);
          var score;
          if (captured && captured.t === 'K') {
            score = MATE;
          } else if (level.slack > 0) {
            // 简单模式：每个根着法用全窗口求真实分，便于随机挑选
            score = -negamax(work, depth - 1, -Infinity, Infinity, opp, 1, deadline);
          } else {
            score = -negamax(work, depth - 1, -Infinity, -alpha, opp, 1, deadline);
          }
          unmake(work, mv, captured);
          scored.push({ mv: mv, score: score });
          if (score > alpha) alpha = score;
        }
      } catch (e) {
        if (e !== TIMEOUT) throw e;
        break; // 超时保留上一深度结果
      }

      scored.sort(function (a, b) { return b.score - a.score; });
      rootScores = scored;

      if (level.slack > 0) {
        // 简单模式：在最佳 slack 分内随机选，制造可战胜的失误
        var top = scored.filter(function (s) { return s.score >= scored[0].score - level.slack; });
        var pick = top[Math.floor(Math.random() * top.length)];
        best = { from: pick.mv.from, to: pick.mv.to, score: pick.score, depth: depth };
      } else {
        best = { from: scored[0].mv.from, to: scored[0].mv.to, score: scored[0].score, depth: depth };
      }

      // 找到杀棋不用再深搜
      if (Math.abs(scored[0].score) >= MATE - 100) break;
    }

    return best;
  }

  global.XiangqiAI = {
    evaluate: evaluate,
    genMoves: genMoves,
    findBestMove: findBestMove
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.XiangqiAI;
  }
})(typeof window !== 'undefined' ? window : globalThis);
