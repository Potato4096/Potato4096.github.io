/**
 * ai.js - 飞行棋 AI（选子策略）
 * 依赖：js/rules.js（Ludo）
 *
 * 骰子本身随机，AI 决定「掷出点数后动哪架飞机」。
 * easy = 随机；medium/hard = 按收益排序：撞敌 > 起飞 > 进终点 > 跳板 > 跑得远
 */
(function (global) {
  'use strict';

  var L = global.Ludo;

  /** 估算动某架飞机的收益（越大越好） */
  function scoreMove(s, color, dice, planeIdx) {
    // 模拟走子
    var sim = L.clone(s);
    var r = L.applyMove(sim, color, dice, planeIdx);
    if (!r) return -Infinity;

    var score = 0;
    if (r.captured.length) score += 120 * r.captured.length;   // 撞回敌机
    if (r.takeoff) score += 70;                                 // 起飞
    if (r.finished) score += 90;                                // 进终点
    if (r.jumped) score += 45;                                  // 跳板
    score += r.to;                                              // 越靠前越好

    // 风险：落点若在环上且靠近敌机，扣一点分（粗略）
    if (r.to >= 0 && r.to <= 51 && !r.captured.length) {
      var abs = L.absRel(color, r.to);
      for (var c = 0; c < 4; c++) {
        if (c === color) continue;
        for (var k = 0; k < 4; k++) {
          var q = s.planes[c][k];
          if (q < 0 || q > 51) continue;
          if (L.absRel(c, q) === abs) score += 20;   // 已经同格（会被算成撞它）——不该到这里
        }
      }
      // 飞在最前的飞机别送：略微偏好中段飞机
      if (r.to > 44) score -= 6;
    }
    return score;
  }

  /**
   * 选择要走的飞机下标。
   * @param s       对局状态
   * @param color   行棋方
   * @param dice    点数
   * @param opts    { difficulty }
   */
  function choose(s, color, dice, opts) {
    var options = L.legalPlanes(s, color, dice);
    if (!options.length) return -1;
    if (options.length === 1) return options[0];

    var difficulty = (opts && opts.difficulty) || 'medium';
    if (difficulty === 'easy') {
      return options[Math.floor(Math.random() * options.length)];
    }

    var best = options[0];
    var bestScore = -Infinity;
    for (var i = 0; i < options.length; i++) {
      var sc = scoreMove(s, color, dice, options[i]);
      if (difficulty === 'medium') sc += (Math.random() - 0.5) * 10;
      if (sc > bestScore) {
        bestScore = sc;
        best = options[i];
      }
    }
    return best;
  }

  var api = { choose: choose };
  global.LudoAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
