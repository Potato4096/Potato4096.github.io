/**
 * ai.js - 围棋 AI（启发式评估，非神经网络）
 * 依赖：js/rules.js（GoRules）
 *
 * 评估维度：
 *   提子收益 / 己方块的气 / 救援只剩一气的己方块 / 连接与接触 /
 *   位置价值（三线四线优先）/ 避免自陷虎口 / 避开自己的真眼。
 * 困难档额外做一次"对手最佳应手"的局部校验。
 */
(function (global) {
  'use strict';

  var R = global.GoRules;
  var EMPTY = R.EMPTY;
  var BLACK = R.BLACK;
  var WHITE = R.WHITE;

  function isEmptyBoard(board) {
    for (var i = 0; i < board.length; i++) {
      if (board[i] !== EMPTY) return false;
    }
    return true;
  }

  /** 位置价值：三线、四线优先，边线与中腹递减 */
  function positionValue(size, x, y) {
    var dx = Math.min(x, size - 1 - x);
    var dy = Math.min(y, size - 1 - y);
    var line = Math.min(dx, dy);      // 距最近边线的格数（0 = 一线）
    var edge = [0, 4, 9, 12, 8, 5, 3][Math.min(line, 6)];
    var cx = (size - 1) / 2;
    var center = 6 - (Math.abs(x - cx) + Math.abs(y - cy(size))) / size * 6;
    return edge + center;
  }

  function cy(size) {
    return (size - 1) / 2;
  }

  /** 是否是自己的真眼（四邻皆己方、对角最多一个对手子） */
  function isEye(board, size, x, y, color) {
    var nb = R.neighbors(size, x, y);
    for (var i = 0; i < nb.length; i++) {
      if (R.get(board, size, nb[i][0], nb[i][1]) !== color) return false;
    }
    var diag = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    var opp = 0;
    for (i = 0; i < diag.length; i++) {
      if (R.get(board, size, x + diag[i][0], y + diag[i][1]) === R.opponent(color)) opp++;
    }
    return opp <= 1;
  }

  /** 候选空点：距已有棋子 Chebyshev ≤ 2 */
  function candidates(board, size, radius) {
    var r = radius || 2;
    var out = [];
    var x, y, dx, dy;
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        if (board[R.idx(size, x, y)] !== EMPTY) continue;
        var near = false;
        for (dy = -r; dy <= r && !near; dy++) {
          for (dx = -r; dx <= r; dx++) {
            if (!dx && !dy) continue;
            if (!R.inBoard(size, x + dx, y + dy)) continue;
            if (board[R.idx(size, x + dx, y + dy)] !== EMPTY) { near = true; break; }
          }
        }
        if (near) out.push({ x: x, y: y });
      }
    }
    return out;
  }

  /** 全部空点（开局阶段用于占角、展开，避免只贴着已有棋子下） */
  function allEmpty(board, size) {
    var out = [];
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        if (board[R.idx(size, x, y)] === EMPTY) out.push({ x: x, y: y });
      }
    }
    return out;
  }

  function stoneCount(board) {
    var n = 0;
    for (var i = 0; i < board.length; i++) {
      if (board[i] !== EMPTY) n++;
    }
    return n;
  }

  /**
   * 单点评估。
   * @returns {{score:number, captured:number, board:Int8Array, ko:number}|null}
   */
  function evaluate(board, size, x, y, color, ko, opts) {
    var res = R.play(board, size, x, y, color, ko);
    if (!res.ok) return null;
    var o = opts || {};
    var posWeight = o.posWeight == null ? 1 : o.posWeight;
    var contactWeight = o.contactWeight == null ? 1 : o.contactWeight;
    var libWeight = o.libWeight == null ? 1 : o.libWeight;
    var spreadWeight = o.spreadWeight == null ? 1 : o.spreadWeight;

    var opp = R.opponent(color);
    var captured = res.captured.length;
    var score = captured * 150;

    var nb = R.neighbors(size, x, y);
    var friendly = 0;
    var enemy = 0;
    for (var i = 0; i < nb.length; i++) {
      var nx = nb[i][0];
      var ny = nb[i][1];
      var v = board[R.idx(size, nx, ny)];
      if (v === color) {
        friendly++;
        var g = R.groupAt(board, size, nx, ny);
        if (g.liberties === 1) score += 95;        // 救活垂死的己方块
        else if (g.liberties === 2) score += 14;
      } else if (v === opp) {
        enemy++;
      }
    }

    // 气数只在贴身缠斗时才有意义：孤立落子的气恒为 3~4，不构成差别
    var mine = R.groupAt(res.board, size, x, y);
    if (friendly > 0 || enemy > 0) score += Math.min(mine.liberties, 8) * 3 * libWeight;

    score += (friendly * 5 + enemy * 6) * contactWeight;
    score += positionValue(size, x, y) * posWeight;

    // 与最近己方棋子的距离惩罚：避免把棋子一路贴着铺开（"爬行"），鼓励展开
    var nearest = 99;
    for (var ddy = -3; ddy <= 3; ddy++) {
      for (var ddx = -3; ddx <= 3; ddx++) {
        if (!ddx && !ddy) continue;
        if (!R.inBoard(size, x + ddx, y + ddy)) continue;
        if (board[R.idx(size, x + ddx, y + ddy)] !== color) continue;
        var dist = Math.max(Math.abs(ddx), Math.abs(ddy));
        if (dist < nearest) nearest = dist;
      }
    }
    if (nearest === 1) score -= 30 * o.spreadWeight;
    else if (nearest === 2) score -= 13 * o.spreadWeight;
    else if (nearest === 3) score -= 4 * o.spreadWeight;
    else score += 3;

    // 自陷虎口：落子后仅一口气且没有提子
    if (mine.liberties === 1 && captured === 0) score -= 220;
    else if (mine.liberties === 2 && captured === 0) score -= 40;
    // 下在自己的真眼里（自毁），除非能提子
    if (captured === 0 && isEye(board, size, x, y, color)) score -= 260;
    // 送到对手的眼位/包围圈里（送吃），除非能提子
    if (captured === 0 && isEye(board, size, x, y, opp)) score -= 300;

    return { score: score, captured: captured, board: res.board, ko: res.ko };
  }

  /** 对手在我落子后能提掉的最大子数（仅检查落点周边局部） */
  function maxOppCapture(placedBoard, size, color, ko, x, y, radius) {
    var opp = R.opponent(color);
    var r = radius || 3;
    var best = 0;
    for (var dy = -r; dy <= r; dy++) {
      for (var dx = -r; dx <= r; dx++) {
        var nx = x + dx;
        var ny = y + dy;
        if (!R.inBoard(size, nx, ny)) continue;
        if (placedBoard[R.idx(size, nx, ny)] !== EMPTY) continue;
        var res = R.play(placedBoard, size, nx, ny, opp, ko);
        if (res.ok && res.captured.length > best) best = res.captured.length;
      }
    }
    return best;
  }

  function emptyBoardMove(size) {
    var stars = R.starPoints(size);
    if (stars.length) {
      var pick = stars[Math.floor(Math.random() * stars.length)];
      return { x: pick[0], y: pick[1] };
    }
    var c = Math.floor(size / 2);
    return { x: c, y: c };
  }

  /**
   * 选择落子。
   * @returns {{x:number,y:number}|null} null 表示建议 pass
   */
  function findMove(board, size, color, options) {
    var opts = options || {};
    var diff = opts.difficulty === 'easy' || opts.difficulty === 'hard' ? opts.difficulty : 'medium';
    var ko = (opts.ko == null) ? -1 : opts.ko;
    var opp = R.opponent(color);

    if (isEmptyBoard(board)) return emptyBoardMove(size);

    var stones = stoneCount(board);
    // 开局阶段：优先占角占边，压低贴身接触的权重；进入接触战后恢复正常权重
    var opening = stones < Math.max(14, Math.round(size * 1.1));
    var evalOpts = opening
      ? { posWeight: 3, contactWeight: 0.35, libWeight: 0.4, spreadWeight: 1.7 }
      : { posWeight: 1, contactWeight: 1, libWeight: 1, spreadWeight: 1 };

    // 开局（子少）在全盘空点中择优，便于占角展开；进入接触战后只看邻域，控制计算量
    var cands = stones < 14
      ? allEmpty(board, size)
      : candidates(board, size, 2);
    if (!cands.length) return null;

    var scored = [];
    for (var i = 0; i < cands.length; i++) {
      var p = cands[i];
      // 己方真眼不填（除非能提子），先做廉价过滤
      if (isEye(board, size, p.x, p.y, color)) continue;
      var ev = evaluate(board, size, p.x, p.y, color, ko, evalOpts);
      if (!ev) continue;
      ev.score += Math.random() * 1.2; // 打破完全平局，避免每局同型
      ev.x = p.x;
      ev.y = p.y;
      scored.push(ev);
    }

    if (!scored.length) {
      // 只剩眼位等极端情况：退回任意合法点
      for (i = 0; i < cands.length; i++) {
        var fallback = evaluate(board, size, cands[i].x, cands[i].y, color, ko, evalOpts);
        if (fallback) return { x: cands[i].x, y: cands[i].y };
      }
      return null;
    }

    scored.sort(function (a, b) { return b.score - a.score; });

    // 全盘无值得下的一手（多为终局或只剩自家眼位）→ 建议 pass
    if (scored[0].score <= 0) return null;

    if (diff === 'easy') {
      var pool = scored.slice(0, Math.min(8, scored.length));
      var total = 0;
      var weights = pool.map(function (s, k) {
        var wgt = Math.max(1, s.score + 40) / Math.pow(k + 1, 1.6);
        total += wgt;
        return wgt;
      });
      var r = Math.random() * total;
      for (i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) return { x: pool[i].x, y: pool[i].y };
      }
      return { x: pool[0].x, y: pool[0].y };
    }

    if (diff === 'medium') {
      // 只在次优与最优接近时才做变化，避免选到明显更差的一手
      if (scored.length > 1 && scored[0].score - scored[1].score < 20 && Math.random() < 0.2) {
        return { x: scored[1].x, y: scored[1].y };
      }
      return { x: scored[0].x, y: scored[0].y };
    }

    // hard：对前 4 手做局部对手应手校验
    var bestNet = -Infinity;
    var bestMove = scored[0];
    var top = scored.slice(0, Math.min(4, scored.length));
    for (i = 0; i < top.length; i++) {
      var m = top[i];
      var threat = maxOppCapture(m.board, size, color, m.ko, m.x, m.y, 3);
      var net = m.score - threat * 150;
      // 自己这块气很少时，对手一紧气就危险
      if (m.captured === 0) {
        var g = R.groupAt(m.board, size, m.x, m.y);
        if (g.liberties === 1) net -= 80;
      }
      if (net > bestNet) { bestNet = net; bestMove = m; }
    }
    return { x: bestMove.x, y: bestMove.y };
  }

  var api = {
    findMove: findMove,
    evaluate: evaluate,
    candidates: candidates,
    isEye: isEye,
    positionValue: positionValue
  };

  global.GoAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
