/**
 * ai.js - 中国象棋 AI
 * 算法：NegaMax + Alpha-Beta 剪枝 + 迭代加深 + 置换表（Zobrist）+ 静态搜索(吃子延伸)
 *      + 杀手 / 历史启发排序 + 将军延伸 + MVV-LVA。
 * 搜索采用「伪合法着法 + 吃将判胜」策略，配合飞将捕捉，天然处理将帅对脸。
 * 评估为增量维护（make/unmake 更新总分），叶子取分 O(1)。
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

  /** 单枚棋子在某格的价值（含位置分），红方视角，黑子取负 */
  function pieceScore(p, x, y) {
    var v = pieceValue(p.t);
    var table = PSTS[p.t];
    if (table) v += table[p.s === 'r' ? y : 9 - y][x];
    return p.s === 'r' ? v : -v;
  }

  /** 全盘评估（红方视角），供外部 API 与搜索初始化使用 */
  function evaluateRed(board) {
    var score = 0;
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 9; x++) {
        var p = board[y][x];
        if (p) score += pieceScore(p, x, y);
      }
    }
    return score;
  }

  /** 从 side 视角的静态评估 */
  function evaluate(board, side) {
    var score = evaluateRed(board);
    return side === 'r' ? score : -score;
  }

  /**
   * 搜索期间的红方视角总分。make / unmake 按增量维护，
   * 叶子节点不再每步扫全盘，评估开销降到 O(1)。
   */
  var posScore = 0;

  /** 叶子节点取分：直接读增量分，O(1) */
  function sideScore(side) {
    return side === 'r' ? posScore : -posScore;
  }

  /* ---------------- 走子生成（伪合法 + 飞将） ---------------- */

  /** 着法生成与将军判定都要用将帅位置，搜索期间由 make/unmake 增量维护 */
  var genR = null, genB = null;
  var inSearch = false;   // 只有搜索期间才信任缓存，避免外部调用读到过期位置

  function generalOf(board, side) {
    if (inSearch) {
      var g = side === 'r' ? genR : genB;
      if (g) return g;
    }
    return X.findGeneral(board, side);
  }

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
    var g = generalOf(board, side);
    var e = generalOf(board, side === 'r' ? 'b' : 'r');
    if (g && e && g.x === e.x) {
      var clear = true;
      for (var yy = Math.min(g.y, e.y) + 1; yy < Math.max(g.y, e.y); yy++) {
        if (board[yy][g.x]) { clear = false; break; }
      }
      if (clear) moves.push({ from: { x: g.x, y: g.y }, to: { x: e.x, y: e.y } });
    }
    return moves;
  }

  /**
   * side 的将帅是否正被攻击。从九宫向外做定向探测：车 / 炮沿四条射线、
   * 马按八个来源位查马腿、兵卒查正面与过河横走、以及同列无遮挡的将帅对脸。
   * 相比"生成对方全部着法再找将帅"，单次判定的开销与棋子数量无关。
   */
  var RAYS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var HORSE_FROM = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

  function attacked(board, side) {
    var g = generalOf(board, side);
    if (!g) return true;
    var gx = g.x, gy = g.y;
    var enemy = side === 'r' ? 'b' : 'r';

    for (var i = 0; i < 4; i++) {
      var dx = RAYS[i][0], dy = RAYS[i][1];

      // 第一枚棋子：车、贴脸的敌将，或同列的敌将（飞将）
      var x = gx + dx, y = gy + dy;
      while (X.inBoard(x, y) && !board[y][x]) { x += dx; y += dy; }
      if (!X.inBoard(x, y)) continue;

      var p1 = board[y][x];
      if (p1.s === enemy) {
        if (p1.t === 'R') return true;
        if (p1.t === 'K' && (dx === 0 || Math.abs(x - gx) + Math.abs(y - gy) === 1)) return true;
      }

      // 第二枚棋子：炮（第一枚即炮架）
      x += dx; y += dy;
      while (X.inBoard(x, y) && !board[y][x]) { x += dx; y += dy; }
      if (!X.inBoard(x, y)) continue;
      var p2 = board[y][x];
      if (p2.s === enemy && p2.t === 'C') return true;
    }

    for (var h = 0; h < 8; h++) {
      var ox = HORSE_FROM[h][0], oy = HORSE_FROM[h][1];
      var hx = gx + ox, hy = gy + oy;
      if (!X.inBoard(hx, hy)) continue;
      var hp = board[hy][hx];
      if (!hp || hp.s !== enemy || hp.t !== 'H') continue;
      // 马腿：沿"长边"方向、紧贴马的那一格
      var lx, ly;
      if (Math.abs(ox) === 2) { lx = gx + ox / 2; ly = gy + oy; }
      else { lx = gx + ox; ly = gy + oy / 2; }
      if (!board[ly][lx]) return true;
    }

    // 兵 / 卒：正面一步；已过河还能横吃
    var frontY = enemy === 'b' ? gy - 1 : gy + 1;
    if (X.inBoard(gx, frontY)) {
      var fp = board[frontY][gx];
      if (fp && fp.s === enemy && fp.t === 'P') return true;
    }
    var crossed = enemy === 'b' ? gy >= 5 : gy <= 4;
    if (crossed) {
      if (gx > 0) {
        var lp = board[gy][gx - 1];
        if (lp && lp.s === enemy && lp.t === 'P') return true;
      }
      if (gx < 8) {
        var rp = board[gy][gx + 1];
        if (rp && rp.s === enemy && rp.t === 'P') return true;
      }
    }

    return false;
  }

  function make(board, mv) {
    var from = mv.from, to = mv.to;
    var moving = board[from.y][from.x];
    var captured = board[to.y][to.x];
    var fromIdx = from.y * 9 + from.x;
    var toIdx = to.y * 9 + to.x;

    // 增量维护评估分：搬走原位、吃掉目标、落到新位
    var delta = pieceScore(moving, to.x, to.y) - pieceScore(moving, from.x, from.y);
    if (captured) delta -= pieceScore(captured, to.x, to.y);
    mv._d = delta;
    posScore += delta;

    // 增量维护 Zobrist 键
    hashKey ^= ZOBRIST.pieces[pieceIndex(moving)][fromIdx];
    if (captured) hashKey ^= ZOBRIST.pieces[pieceIndex(captured)][toIdx];
    hashKey ^= ZOBRIST.pieces[pieceIndex(moving)][toIdx];
    hashKey ^= ZOBRIST.side;

    // 增量维护将帅位置
    if (moving.t === 'K') {
      var gk = moving.s === 'r' ? genR : genB;
      if (gk) { gk.x = to.x; gk.y = to.y; }
    }
    if (captured && captured.t === 'K') {
      if (captured.s === 'r') genR = null; else genB = null;
    }

    board[to.y][to.x] = moving;
    board[from.y][from.x] = null;
    return captured;
  }

  function unmake(board, mv, captured) {
    var fromIdx = mv.from.y * 9 + mv.from.x;
    var toIdx = mv.to.y * 9 + mv.to.x;
    var moving = board[mv.to.y][mv.to.x];

    hashKey ^= ZOBRIST.pieces[pieceIndex(moving)][toIdx];
    hashKey ^= ZOBRIST.pieces[pieceIndex(moving)][fromIdx];
    if (captured) hashKey ^= ZOBRIST.pieces[pieceIndex(captured)][toIdx];
    hashKey ^= ZOBRIST.side;

    board[mv.from.y][mv.from.x] = moving;
    board[mv.to.y][mv.to.x] = captured;
    posScore -= mv._d;

    if (moving.t === 'K') {
      var gu = moving.s === 'r' ? genR : genB;
      if (gu) { gu.x = mv.from.x; gu.y = mv.from.y; }
    }
    if (captured && captured.t === 'K') {
      if (captured.s === 'r') genR = { x: mv.to.x, y: mv.to.y };
      else genB = { x: mv.to.x, y: mv.to.y };
    }
  }

  /* ---------------- 着法排序 ---------------- */

  var killers = [];   // 每层两个「造成剪枝的安静着法」
  var history = {};   // 安静着法的历史得分

  function moveKey(mv) {
    return (mv.from.y * 9 + mv.from.x) * 100 + (mv.to.y * 9 + mv.to.x);
  }

  /** 排序比较器提到模块级：每节点排序时不再新建闭包 */
  function byScore(a, b) { return b._s - a._s; }

  /**
   * 排序：置换表着法置顶，吃子按 MVV-LVA 次之，安静着法先排杀手、
   * 其余按历史得分。排序质量直接决定 alpha-beta 的剪枝效率。
   */
  function scoreMoves(board, moves, ply, ttMoveKey) {
    var k = killers[ply];
    for (var i = 0; i < moves.length; i++) {
      var m = moves[i];
      var victim = board[m.to.y][m.to.x];
      if (victim) {
        var attacker = board[m.from.y][m.from.x];
        m._s = 100000 + pieceValue(victim.t) * 10 - pieceValue(attacker.t);
      } else {
        var key = moveKey(m);
        m._key = key;
        if (ttMoveKey != null && key === ttMoveKey) m._s = 200000;
        else if (k && key === k[0]) m._s = 90000;
        else if (k && key === k[1]) m._s = 80000;
        else m._s = history[key] || 0;
      }
    }
    moves.sort(byScore);
  }

  /** 记录造成剪枝的安静着法：进杀手槽 + 累积历史分 */
  function rememberCutoff(mv, ply, depth) {
    if (mv._key == null) mv._key = moveKey(mv);
    var k = killers[ply] || (killers[ply] = [0, 0]);
    if (k[0] !== mv._key) { k[1] = k[0]; k[0] = mv._key; }
    history[mv._key] = (history[mv._key] || 0) + depth * depth;
  }

  /* ---------------- 置换表 ---------------- */

  var PIECE_IDX = { K: 0, A: 1, E: 2, H: 3, R: 4, C: 5, P: 6 };

  /** Zobrist 随机键：14 种「棋子 × 颜色」× 90 格，外加一步行棋方键 */
  var ZOBRIST = (function () {
    var seed = 20261120;
    function rnd() {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      return seed | 0;
    }
    var keys = new Array(14);
    for (var s = 0; s < 14; s++) {
      var row = new Int32Array(90);
      for (var i = 0; i < 90; i++) row[i] = rnd();
      keys[s] = row;
    }
    return { pieces: keys, side: rnd() };
  })();

  function pieceIndex(p) {
    return (p.s === 'r' ? 0 : 7) + PIECE_IDX[p.t];
  }

  var hashKey = 0;

  function computeHash(board) {
    var h = 0;
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 9; x++) {
        var p = board[y][x];
        if (p) h ^= ZOBRIST.pieces[pieceIndex(p)][y * 9 + x];
      }
    }
    return h;
  }

  /** 置换表：键、深度、标志（1 精确 / 2 下界 / 3 上界）、分值、最佳着法 */
  var TT_BITS = 17;
  var TT_SIZE = 1 << TT_BITS;
  var TT_MASK = TT_SIZE - 1;
  var ttKey = new Int32Array(TT_SIZE);
  var ttDepth = new Int8Array(TT_SIZE);
  var ttFlag = new Int8Array(TT_SIZE);
  var ttScore = new Int32Array(TT_SIZE);
  var ttMove = new Int32Array(TT_SIZE);

  var MATE_GUARD = MATE - 1000; // 将杀分与层数相关，不进表也不采信

  /* ---------------- 搜索 ---------------- */

  var TIMEOUT = { timeout: true };
  var nodeCount = 0;

  function checkTime(deadline) {
    if ((++nodeCount & 255) === 0 && Date.now() >= deadline) throw TIMEOUT;
  }

  /** 静态搜索：只延伸吃子；被将军时搜索全部应着 */
  function quiesce(board, alpha, beta, side, ply, deadline) {
    checkTime(deadline);
    if (ply > 18) return sideScore(side);

    var inChk = attacked(board, side);
    var stand = -Infinity;
    if (!inChk) {
      stand = sideScore(side);
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
    }

    var moves = genMoves(board, side);
    if (!inChk) {
      // 只保留吃子着法；顺带避免 filter 产生的临时数组
      var caps = [];
      for (var j = 0; j < moves.length; j++) {
        if (board[moves[j].to.y][moves[j].to.x]) caps.push(moves[j]);
      }
      if (!caps.length) return stand; // 无吃子可搜：返回静态值
      moves = caps;
    }
    scoreMoves(board, moves, ply);

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

  /** 将军延伸的上限：避免长将序列把搜索拖成无底洞 */
  var MAX_EXTEND_PLY = 4;

  /** 空着裁剪的前提：还有大子可动（残局只剩士象时容易踩到无等着陷阱） */
  function hasHeavy(board, side) {
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 9; x++) {
        var p = board[y][x];
        if (!p || p.s !== side) continue;
        if (p.t === 'R' || p.t === 'C' || p.t === 'H' || p.t === 'P') return true;
      }
    }
    return false;
  }

  /** NegaMax + Alpha-Beta + 置换表 + 空着裁剪 + 后期着法缩减 */
  function negamax(board, depth, alpha, beta, side, ply, deadline) {
    checkTime(deadline);

    var inChk = attacked(board, side);
    // 被将军时多送半层：将杀类战术不会因为刚好落在奇数层而被漏掉
    if (inChk && ply < MAX_EXTEND_PLY) depth += 1;
    if (depth <= 0) return quiesce(board, alpha, beta, side, ply, deadline);

    // 置换表探测：同局面、深度足够即可直接裁剪
    var slot = hashKey & TT_MASK;
    var usable = ttFlag[slot] !== 0 && ttKey[slot] === hashKey && ttDepth[slot] >= depth;
    if (usable) {
      var tv = ttScore[slot];
      var tf = ttFlag[slot];
      if (tf === 1) return tv;
      if (tf === 2 && tv >= beta) return tv;
      if (tf === 3 && tv <= alpha) return tv;
    }

    var opp = side === 'r' ? 'b' : 'r';

    // 空着裁剪：让对手白走一手，若仍越界则本节点必然剪枝。
    // beta 为无穷大时是根节点开窗（首个根着法），此时期望上界无意义，跳过硬以免分值失控。
    if (!inChk && ply > 0 && depth >= 3 && beta !== Infinity && hasHeavy(board, side)) {
      var reduction = depth >= 6 ? 3 : 2;
      hashKey ^= ZOBRIST.side;
      var nullScore = -negamax(board, depth - 1 - reduction, -beta, -beta + 1, opp, ply + 1, deadline);
      hashKey ^= ZOBRIST.side;
      if (nullScore >= beta) return beta;
    }

    var moves = genMoves(board, side);
    scoreMoves(board, moves, ply, usable ? ttMove[slot] : -1);

    var alpha0 = alpha;
    var bestMove = 0;
    var best = -Infinity;

    for (var i = 0; i < moves.length; i++) {
      var mv = moves[i];
      var captured = make(board, mv);
      var score;

      // 后期安静着法先少搜一层，越界了再补搜
      var r = (!captured && depth >= 3 && i >= 3) ? 1 : 0;
      if (captured && captured.t === 'K') {
        score = MATE - ply;
      } else {
        score = -negamax(board, depth - 1 - r, -beta, -alpha, opp, ply + 1, deadline);
        if (r && score > alpha) {
          score = -negamax(board, depth - 1, -beta, -alpha, opp, ply + 1, deadline);
        }
      }

      unmake(board, mv, captured);
      if (score > best) {
        best = score;
        bestMove = moveKey(mv);
      }
      if (best > alpha) alpha = best;
      if (alpha >= beta) {
        if (!captured) rememberCutoff(mv, ply, depth);
        break;
      }
    }

    if (best === -Infinity) best = -MATE + ply; // 无着可走：将死或困毙

    // 将杀分与层数相关，不入表，避免跨层采信出错
    if (Math.abs(best) < MATE_GUARD) {
      ttKey[slot] = hashKey;
      ttDepth[slot] = depth;
      ttFlag[slot] = best <= alpha0 ? 3 : (best >= beta ? 2 : 1);
      ttScore[slot] = best;
      ttMove[slot] = bestMove;
    }

    return best;
  }

  /* ---------------- 难度与入口 ---------------- */

  var LEVELS = {
    easy: { maxDepth: 2, timeMs: 300, slack: 70 },   // 简单：浅搜索 + 随机应手
    medium: { maxDepth: 6, timeMs: 900, slack: 0 },  // 中等：搜到 5~6 层
    hard: { maxDepth: 10, timeMs: 2200, slack: 0 }   // 困难：迭代加深，把时限用满
  };

  /**
   * 为 side 找最优着法。board 不被修改。
   * options: { difficulty: 'easy'|'medium'|'hard', timeMs?: number }
   * timeMs 可覆盖该档位的默认时限，便于调试与性能对比。
   * 返回 { from, to, score, depth } 或 null（无着可走）
   */
  function findBestMove(board, side, options) {
    var level = LEVELS[(options && options.difficulty) || 'medium'] || LEVELS.medium;
    var work = X.cloneBoard(board);
    var timeMs = (options && options.timeMs) || level.timeMs;
    var deadline = Date.now() + timeMs;
    nodeCount = 0;

    // 每次搜索重置：增量分与 Zobrist 键从当前局面重建，启发表清空
    posScore = evaluateRed(work);
    hashKey = computeHash(work);
    genR = X.findGeneral(work, 'r');
    genB = X.findGeneral(work, 'b');
    killers = [];
    history = {};
    ttFlag.fill(0);
    inSearch = true;

    try {
      var rootMoves = genMoves(work, side);
      if (!rootMoves.length) return null;
      scoreMoves(work, rootMoves, 0);

      var opp = side === 'r' ? 'b' : 'r';
      var best = null;

      for (var depth = 1; depth <= level.maxDepth; depth++) {
        var alpha = -Infinity;
        var completed = true;

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
            mv._score = score;
            if (score > alpha) alpha = score;
          }
        } catch (e) {
          if (e !== TIMEOUT) throw e;
          completed = false; // 本层没搜完，结果不完整，直接沿用上一层
        }

        if (!completed) break;

        // 按本层得分排序，下一层优先展开最有希望的分支
        rootMoves.sort(function (a, b) { return b._score - a._score; });

        var topScore = rootMoves[0]._score;
        var pick = rootMoves[0];
        if (level.slack > 0) {
          // 简单模式：在最佳 slack 分内随机选，制造可战胜的失误
          var top = rootMoves.filter(function (m) { return m._score >= topScore - level.slack; });
          pick = top[Math.floor(Math.random() * top.length)];
        }
        best = { from: pick.from, to: pick.to, score: pick._score, depth: depth };

        // 找到杀棋不用再深搜
        if (Math.abs(topScore) >= MATE - 100) break;
      }

      return best;
    } finally {
      // 无论正常结束还是超时跳出，都停止信任缓存
      inSearch = false;
    }
  }

  global.XiangqiAI = {
    evaluate: evaluate,
    genMoves: genMoves,
    findBestMove: findBestMove,
    attacked: attacked   // 公开供测试对照：必须与 Xiangqi.inCheck 结论一致
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.XiangqiAI;
  }
})(typeof window !== 'undefined' ? window : globalThis);
