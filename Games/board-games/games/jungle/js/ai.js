/**
 * ai.js - 斗兽棋 AI（评分 + 两层极小化极大）
 * 依赖：js/rules.js（Jungle）
 *
 * easy   = 随机合法着
 * medium = 启发式评分（吃子 / 靠近敌穴 / 护家 / 避免送子）
 * hard   = 两层 alpha-beta + 同样的静态评分
 */
(function (global) {
  'use strict';

  var G = global.Jungle;

  function sideOf(s) { return s; }
  function opp(s) { return s === G.RED ? G.BLACK : G.RED; }

  /** 距离（曼哈顿） */
  function dist(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /** 敌方兽穴坐标 */
  function enemyDen(side) {
    return side === G.RED ? { x: 3, y: 0 } : { x: 3, y: 8 };
  }
  function ownDen(side) {
    return side === G.RED ? { x: 3, y: 8 } : { x: 3, y: 0 };
  }

  /** 一个子的静态价值（等级越高越值钱，象稍溢价） */
  function pieceValue(t) {
    var base = t * 10;
    if (t === G.RAT) base += 6;        // 鼠有吃象的战术价值
    if (t === G.ELEPHANT) base += 4;
    return base;
  }

  /** 局面评分（side 视角，越大越好） */
  function evaluate(board, side) {
    var score = 0;
    var i, p;
    for (i = 0; i < board.length; i++) {
      p = board[i];
      if (!p) continue;
      var cell = { x: i % G.COLS, y: Math.floor(i / G.COLS) };
      var mine = p.s === side;
      var v = pieceValue(p.t);

      // 靠近敌方兽穴（进攻）；在己方兽穴附近（防守）
      var dEnemy = dist(cell, enemyDen(p.s));
      var dOwn = dist(cell, ownDen(p.s));
      v += (12 - dEnemy) * 1.6;
      v += Math.max(0, 4 - dOwn) * 1.2;

      // 踩在敌方陷阱里会被吃，扣分；占住我方陷阱加分
      var trap = G.trapOwner(cell.x, cell.y);
      if (trap === p.s) v += 8;
      else if (trap && trap !== p.s) v -= 12;

      // 入水的象很弱，入水的鼠灵活
      if (G.isWater(cell.x, cell.y)) {
        v += (p.t === G.RAT) ? 5 : -14;
      }

      score += mine ? v : -v;
    }
    return score;
  }

  function sortedMoves(board, side) {
    var ms = G.legalMoves(board, side);
    // 吃子优先排序，利于 alpha-beta 剪枝
    ms.sort(function (a, b) {
      return (b.capture ? 1 : 0) - (a.capture ? 1 : 0);
    });
    return ms;
  }

  function minimax(board, side, depth, alpha, beta, rootSide) {
    var win = G.winnerOf(board, side);
    if (win === rootSide) return 100000 - (4 - depth) * 50;
    if (win && win !== rootSide) return -100000 + (4 - depth) * 50;
    if (depth <= 0) return evaluate(board, rootSide);

    var ms = sortedMoves(board, side);
    if (!ms.length) return side === rootSide ? -90000 : 90000;

    if (side === rootSide) {
      var best = -Infinity;
      for (var i = 0; i < ms.length; i++) {
        var b1 = G.clone(board);
        G.applyMove(b1, ms[i]);
        var v = minimax(b1, opp(side), depth - 1, alpha, beta, rootSide);
        if (v > best) best = v;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
      }
      return best;
    }
    var worst = Infinity;
    for (var j = 0; j < ms.length; j++) {
      var b2 = G.clone(board);
      G.applyMove(b2, ms[j]);
      var w = minimax(b2, opp(side), depth - 1, alpha, beta, rootSide);
      if (w < worst) worst = w;
      if (worst < beta) beta = worst;
      if (alpha >= beta) break;
    }
    return worst;
  }

  function randomMove(board, side) {
    var ms = G.legalMoves(board, side);
    if (!ms.length) return null;
    return ms[Math.floor(Math.random() * ms.length)];
  }

  /**
   * 选择一个着法。
   * @param board 棋盘
   * @param side  行棋方
   * @param opts  { difficulty: 'easy'|'medium'|'hard' }
   */
  function findMove(board, side, opts) {
    var difficulty = (opts && opts.difficulty) || 'medium';
    var ms = G.legalMoves(board, side);
    if (!ms.length) return null;

    if (difficulty === 'easy') {
      // 20% 概率走出吃子，其余随机
      var caps = ms.filter(function (m) { return m.capture; });
      if (caps.length && Math.random() < 0.2) {
        return caps[Math.floor(Math.random() * caps.length)];
      }
      return ms[Math.floor(Math.random() * ms.length)];
    }

    var depth = difficulty === 'hard' ? 3 : 2;
    var best = null;
    var bestScore = -Infinity;

    for (var i = 0; i < ms.length; i++) {
      var b = G.clone(board);
      G.applyMove(b, ms[i]);
      var score = minimax(b, opp(side), depth - 1, -Infinity, Infinity, side);
      if (difficulty === 'medium') {
        // medium 档加一点噪声，避免每盘下得一模一样
        score += (Math.random() - 0.5) * 12;
      }
      if (score > bestScore) {
        bestScore = score;
        best = ms[i];
      }
    }
    return best || randomMove(board, side);
  }

  var api = {
    findMove: findMove,
    evaluate: evaluate
  };

  global.JungleAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
