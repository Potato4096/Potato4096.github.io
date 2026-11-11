/**
 * ai.js - 五子棋 AI（启发式棋型评分 + 可选二层校验）
 * 依赖：js/rules.js（Gomoku）
 *
 * 思路：
 *   1. 以落点为中心取 ±4 格，四个方向各生成 9 字模式串，查表取最高棋型分；
 *   2. 攻击分（自己下）与防守分（对手下）加权求和；
 *   3. 必胜点 / 必防点优先返回，避免低级失误；
 *   4. 困难档再做一层"对手最佳回应"校验，避开送四送三的走法。
 */
(function (global) {
  'use strict';

  var G = global.Gomoku;
  var SIZE = G.SIZE;
  var EMPTY = G.EMPTY;
  var BLACK = G.BLACK;
  var WHITE = G.WHITE;
  var DIRS = G.DIRS;

  var FIVE = 5000000;
  var LIVE_FOUR = 300000;

  /* 棋型模式串：X = 己方，. = 空点，O = 对手或边界；中心恒为 X */
  var PATTERNS = [
    ['XXXXX', FIVE],
    ['.XXXX.', LIVE_FOUR],
    ['XXXX.', 26000], ['.XXXX', 26000],
    ['XXX.X', 25000], ['X.XXX', 25000], ['XX.XX', 25000],
    ['.XXX.', 12000],
    ['.X.XX.', 9000], ['.XX.X.', 9000],
    ['XXX..', 1600], ['..XXX', 1600],
    ['XX.X.', 1500], ['.X.XX', 1500], ['X.XX.', 1500], ['.XX.X', 1500],
    ['X.X.X', 1400],
    ['..XX..', 900], ['.XX.', 850],
    ['.X.X.', 700], ['..X.X..', 650],
    ['.X..X.', 300],
    ['..X..', 120]
  ];

  var WEIGHTS = {
    easy: { attack: 1.0, defense: 0.40, noise: 0.55 },
    medium: { attack: 1.0, defense: 0.82, noise: 0.06 },
    hard: { attack: 1.0, defense: 0.98, noise: 0 }
  };

  /** 中心偏好：避免无威胁时把子下到边角，改善棋形 */
  function centerBonus(x, y) {
    var d = Math.abs(x - 7) + Math.abs(y - 7);
    return Math.max(0, 14 - d) * 6;
  }

  /** 以 (x,y) 为中心、沿 (dx,dy) 生成 9 格模式串 */
  function dirString(board, x, y, dx, dy, color) {
    var s = '';
    for (var i = -4; i <= 4; i++) {
      if (i === 0) { s += 'X'; continue; }
      var v = G.get(board, x + dx * i, y + dy * i);
      s += v === color ? 'X' : (v === EMPTY ? '.' : 'O');
    }
    return s;
  }

  /** 单个方向取最高棋型分 */
  function dirScore(board, x, y, dx, dy, color) {
    var s = dirString(board, x, y, dx, dy, color);
    for (var i = 0; i < PATTERNS.length; i++) {
      if (s.indexOf(PATTERNS[i][0]) !== -1) return PATTERNS[i][1];
    }
    return 0;
  }

  /** 在空点落 color 后的四方向棋型总分 */
  function pointScore(board, x, y, color) {
    if (!G.isEmpty(board, x, y)) return -1;
    var total = 0;
    for (var d = 0; d < DIRS.length; d++) {
      total += dirScore(board, x, y, DIRS[d][0], DIRS[d][1], color);
    }
    return total;
  }

  /** 空盘判断（无子） */
  function isEmptyBoard(board) {
    for (var i = 0; i < board.length; i++) {
      if (board[i] !== EMPTY) return false;
    }
    return true;
  }

  /** 候选点：距离已有棋子 Chebyshev ≤ radius 的空点；空盘返回天元 */
  function candidates(board, radius) {
    var r = radius || 2;
    if (isEmptyBoard(board)) return [{ x: 7, y: 7 }];

    var out = [];
    var x, y, dx, dy;
    for (y = 0; y < SIZE; y++) {
      for (x = 0; x < SIZE; x++) {
        if (board[G.idx(x, y)] !== EMPTY) continue;
        var near = false;
        for (dy = -r; dy <= r && !near; dy++) {
          for (dx = -r; dx <= r; dx++) {
            if (!dx && !dy) continue;
            if (!G.inBoard(x + dx, y + dy)) continue;
            if (board[G.idx(x + dx, y + dy)] !== EMPTY) { near = true; break; }
          }
        }
        if (near) out.push({ x: x, y: y });
      }
    }
    if (!out.length) {
      for (y = 0; y < SIZE; y++) {
        for (x = 0; x < SIZE; x++) {
          if (board[G.idx(x, y)] === EMPTY) out.push({ x: x, y: y });
        }
      }
    }
    return out;
  }

  function pickByWeight(list, weights) {
    var total = 0;
    var i;
    for (i = 0; i < list.length; i++) total += weights[i];
    var r = Math.random() * total;
    for (i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r <= 0) return list[i];
    }
    return list[0];
  }

  /**
   * 选择落子点。
   * @param {Int8Array} board 当前棋局（AI 不修改）
   * @param {number} color BLACK | WHITE
   * @param {{difficulty?: string}} options
   * @returns {{x:number,y:number}|null}
   */
  function findMove(board, color, options) {
    var opts = options || {};
    var diff = WEIGHTS[opts.difficulty] ? opts.difficulty : 'medium';
    var w = WEIGHTS[diff];
    var opp = color === BLACK ? WHITE : BLACK;

    var cands = candidates(board, 2);
    if (!cands.length) return null;
    if (isEmptyBoard(board)) return { x: 7, y: 7 };

    var scored = [];
    for (var i = 0; i < cands.length; i++) {
      var p = cands[i];
      var my = pointScore(board, p.x, p.y, color);
      var op = pointScore(board, p.x, p.y, opp);
      scored.push({
        x: p.x,
        y: p.y,
        attack: my,
        defense: op,
        score: my * w.attack + op * w.defense + centerBonus(p.x, p.y)
      });
    }

    // 1) 己方一步成五 → 直接赢
    var best = scored[0];
    for (i = 1; i < scored.length; i++) {
      if (scored[i].attack > best.attack) best = scored[i];
    }
    if (best.attack >= FIVE) return { x: best.x, y: best.y };

    // 2) 对手一步成五 → 必须挡（挡在对手分值最高处）
    var block = scored[0];
    for (i = 1; i < scored.length; i++) {
      if (scored[i].defense > block.defense) block = scored[i];
    }
    if (block.defense >= FIVE) return { x: block.x, y: block.y };

    // 3) 己方能成活四 → 优先做活四（几乎等于获胜）
    var maxAttack = 0;
    var maxDefense = 0;
    for (i = 0; i < scored.length; i++) {
      if (scored[i].attack > maxAttack) maxAttack = scored[i].attack;
      if (scored[i].defense > maxDefense) maxDefense = scored[i].defense;
    }
    if (maxAttack >= LIVE_FOUR) {
      var fours = scored.filter(function (s) { return s.attack >= LIVE_FOUR; });
      fours.sort(function (a, b) { return b.score - a.score; });
      return { x: fours[0].x, y: fours[0].y };
    }

    // 4) 对手能成活四 → 必须抢先堵
    if (maxDefense >= LIVE_FOUR) {
      var blocks = scored.filter(function (s) { return s.defense >= LIVE_FOUR; });
      blocks.sort(function (a, b) { return b.defense - a.defense; });
      return { x: blocks[0].x, y: blocks[0].y };
    }

    scored.sort(function (a, b) { return b.score - a.score; });

    if (diff === 'hard') {
      // 对手没有立即可致命的三/四时，主动造势优先于被动跟防
      if (maxDefense < 25000 && maxAttack >= 12000) {
        var offense = scored.filter(function (s) { return s.attack >= 12000; });
        offense.sort(function (a, b) {
          return (b.attack + b.score * 0.2) - (a.attack + a.score * 0.2);
        });
        return { x: offense[0].x, y: offense[0].y };
      }
      // 二层校验：排除落子后对手立即成五的走法，并轻度惩罚送三
      var pool = scored.slice(0, 6);
      var bestNet = -Infinity;
      var bestMove = pool[0];
      for (i = 0; i < pool.length; i++) {
        var m = pool[i];
        var trial = G.clone(board);
        G.set(trial, m.x, m.y, color);
        var reply = maxPointValue(trial, opp);
        var net = m.score - reply * 0.6;
        if (reply >= FIVE) net -= FIVE * 4;
        if (net > bestNet) { bestNet = net; bestMove = m; }
      }
      return { x: bestMove.x, y: bestMove.y };
    }

    if (diff === 'easy') {
      // 简单档：前 5 个候选按分值加权随机，制造可赢的破绽
      var pool2 = scored.slice(0, 5);
      var weights = pool2.map(function (s, k) {
        return Math.max(1, s.score) / Math.pow(k + 1, 2);
      });
      var chosen = pickByWeight(pool2, weights);
      // 少量纯随机，避免每局应对雷同
      if (Math.random() < 0.12) {
        return cands[Math.floor(Math.random() * cands.length)];
      }
      return { x: chosen.x, y: chosen.y };
    }

    // 中等：最优与次优之间留一点变化
    if (scored.length > 1 && Math.random() < 0.08 &&
        scored[1].score > scored[0].score * 0.94) {
      return { x: scored[1].x, y: scored[1].y };
    }
    return { x: scored[0].x, y: scored[0].y };
  }

  /** 在候选点中取某方下一手的最大单点棋型分（用于二层校验） */
  function maxPointValue(board, color) {
    var cands = candidates(board, 2);
    var best = 0;
    for (var i = 0; i < cands.length; i++) {
      var v = pointScore(board, cands[i].x, cands[i].y, color);
      if (v > best) best = v;
    }
    return best;
  }

  var api = {
    findMove: findMove,
    pointScore: pointScore,
    candidates: candidates,
    PATTERNS: PATTERNS,
    FIVE: FIVE,
    LIVE_FOUR: LIVE_FOUR
  };

  global.GomokuAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
