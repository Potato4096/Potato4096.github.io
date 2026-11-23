/**
 * ai.js - 大富翁 · 电脑玩家决策
 * 只做决策不做操作，返回动作字符串由界面执行。
 * 难度只影响现金储备、成组价值权重与保释倾向，不改变规则。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.MonopolyAI = factory(root.MonopolyData);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D) {
  'use strict';

  var TILES = D.TILES;

  /* 橙色与红色地段回报最高，绿色次之；AI 建房时优先 */
  var GROUP_PRIORITY = {
    orange: 10, red: 9, lightblue: 8, pink: 8, yellow: 7, green: 7, darkblue: 6, brown: 4
  };

  var LEVELS = {
    easy:   { reserve: 40,  completeBonus: 40,  jailCash: 500, buildCash: 400 },
    medium: { reserve: 140, completeBonus: 90,  jailCash: 320, buildCash: 550 },
    hard:   { reserve: 220, completeBonus: 140, jailCash: 260, buildCash: 620 }
  };

  function levelOf(difficulty) { return LEVELS[difficulty] || LEVELS.medium; }

  function ownsGroup(state, playerId, group) {
    var list = D.groupIndexes(group);
    for (var i = 0; i < list.length; i++) {
      if (state.owners[list[i]] !== playerId) return false;
    }
    return true;
  }

  function groupOwnedCount(state, playerId, group) {
    var list = D.groupIndexes(group);
    var n = 0;
    for (var i = 0; i < list.length; i++) {
      if (state.owners[list[i]] === playerId) n += 1;
    }
    return n;
  }

  /** 买地意愿评分：越高越想买 */
  function desire(state, pos, playerId, difficulty) {
    var t = TILES[pos];
    var lv = levelOf(difficulty);
    var p = state.players[playerId];
    var score = t.price;

    if (t.type === 'property') {
      var owned = groupOwnedCount(state, playerId, t.group);
      var size = D.GROUPS[t.group].size;
      score += lv.completeBonus * owned;
      if (owned === size - 1) score += lv.completeBonus; // 差一块成组
      if (owned === 0) score -= 20;
    } else if (t.type === 'railroad') {
      var rrs = 0;
      for (var i = 0; i < TILES.length; i++) {
        if (TILES[i].type === 'railroad' && state.owners[i] === playerId) rrs += 1;
      }
      score += rrs * 45;
    } else if (t.type === 'utility') {
      score -= 30; // 公用事业收益不稳，优先级最低
    }

    if (p.cash - t.price < lv.reserve) score -= 400;
    return score;
  }

  /** 是否买下当前待购地块 */
  function buyDecision(state, difficulty) {
    var pend = state.pending;
    if (!pend || pend.kind !== 'buy') return 'decline';
    var p = state.players[pend.playerId];
    var t = TILES[pend.pos];
    if (p.cash < t.price) return 'decline';

    var lv = levelOf(difficulty);
    var d = desire(state, pend.pos, p.id, difficulty);

    // 简单档偶尔也会犯懒，但不会把自己掏空
    if (difficulty === 'easy') {
      return (p.cash - t.price >= lv.reserve && d > 0) ? 'buy' : 'decline';
    }
    if (d <= 0) return 'decline';
    return (p.cash - t.price >= lv.reserve) ? 'buy' : 'decline';
  }

  /** 狱中选择：优先出狱卡，其次按现金与阶段决定保释还是赌豹子 */
  function jailDecision(state, difficulty) {
    var p = state.players[state.turn];
    if (p.jailFree > 0) return 'card';

    var lv = levelOf(difficulty);
    if (difficulty === 'easy') return 'roll';

    // 后期地产都建起来了，待在狱里反而安全
    if (state.round > 32) return 'roll';
    return p.cash >= lv.jailCash ? 'pay' : 'roll';
  }

  /**
   * 建房计划：返回本轮要建的格子（一次一个），没有则 -1。
   * 只在自己整组、现金充足且符合均衡建房时出手。
   */
  function buildPlan(state, difficulty) {
    var p = state.players[state.turn];
    var lv = levelOf(difficulty);
    if (p.cash < lv.buildCash) return -1;

    var best = -1, bestScore = -1;
    for (var i = 0; i < TILES.length; i++) {
      var t = TILES[i];
      if (t.type !== 'property') continue;
      if (state.owners[i] !== p.id) continue;
      if (!ownsGroup(state, p.id, t.group)) continue;
      if (state.houses[i] >= 5) continue;
      if (p.cash - t.houseCost < lv.buildCash - 200) continue;

      var list = D.groupIndexes(t.group);
      var min = 9;
      for (var k = 0; k < list.length; k++) min = Math.min(min, state.houses[list[k]]);
      if (state.houses[i] > min) continue;

      var score = (GROUP_PRIORITY[t.group] || 0) * 10 + (5 - state.houses[i]) * 3;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  /** 卖房自救：现金过低且名下有房时返回最该卖的一格 */
  function sellPlan(state) {
    var p = state.players[state.turn];
    if (p.cash > 120) return -1;
    var best = -1, bestHouse = 6;
    for (var i = 0; i < TILES.length; i++) {
      if (state.owners[i] !== p.id || state.houses[i] <= 0) continue;
      if (state.houses[i] < bestHouse) { bestHouse = state.houses[i]; best = i; }
    }
    return best;
  }

  return {
    buyDecision: buyDecision,
    jailDecision: jailDecision,
    buildPlan: buildPlan,
    sellPlan: sellPlan,
    desire: desire,
    ownsGroup: ownsGroup
  };
});
