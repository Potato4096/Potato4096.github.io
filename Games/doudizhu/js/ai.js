/**
 * ai.js - 斗地主电脑玩家
 * 叫分决策 + 出牌决策（简单 / 中等 / 困难三档）
 * 依赖：rules.js（DDZ）
 */
(function (global) {
  'use strict';

  var D = global.DDZ;
  var T = D.T;

  /* ---------------- 牌力评估 ---------------- */

  function handStrength(hand) {
    var m = D.byRank(hand);
    var score = 0;

    Object.keys(m).forEach(function (key) {
      var r = Number(key);
      var n = m[key].length;
      if (r === 17) score += 6;
      else if (r === 16) score += 4;
      else if (r === 15) score += 2;
      else if (r === 14) score += 1;
      if (n === 4) score += 5;
      else if (n === 3) score += 0.6;
    });

    if (m[16] && m[17]) score += 4;

    /* 顺子潜力：手上小牌多且连得起来 */
    var small = 0;
    for (var r = 3; r <= 10; r++) if (m[r]) small++;
    if (small >= 6) score += 1.5;

    return score;
  }

  /**
   * 叫分
   * @returns {number} 0 = 不叫，1~3 = 叫几分
   */
  function bid(hand, difficulty, highest) {
    var s = handStrength(hand);
    var noise = difficulty === 'easy' ? (Math.random() * 5 - 2.5)
      : difficulty === 'hard' ? (Math.random() * 1.2 - 0.6)
        : (Math.random() * 3 - 1.5);
    var v = s + noise;

    var want = v >= 10 ? 3 : v >= 7 ? 2 : v >= 4.5 ? 1 : 0;
    if (want <= highest) return 0;
    return want;
  }

  /* ---------------- 出牌评估 ---------------- */

  function opponentMin(ctx) {
    var min = 99;
    for (var i = 0; i < 3; i++) {
      if (i === ctx.mySeat) continue;
      var enemy = (ctx.landlord === ctx.mySeat) || (i === ctx.landlord);
      if (enemy && ctx.counts[i] < min) min = ctx.counts[i];
    }
    return min === 99 ? 20 : min;
  }

  function isTeammatePlay(ctx) {
    if (!ctx.last || ctx.lastSeat === ctx.mySeat) return false;
    return ctx.landlord !== ctx.mySeat && ctx.landlord !== ctx.lastSeat;
  }

  /** 这手牌会拆散多少原本连着的牌 */
  function breakPenalty(cand, hand) {
    var m = D.byRank(hand);
    var use = {};
    cand.forEach(function (c) { use[c.rank] = (use[c.rank] || 0) + 1; });

    var penalty = 0;
    Object.keys(use).forEach(function (key) {
      var r = Number(key);
      var have = (m[r] || []).length;
      var used = use[key];
      if (have === 4 && used < 4) penalty += 35;
      else if (have === 3 && used < 3) penalty += 8;
      else if (have === 2 && used < 2) penalty += 4;
    });
    return penalty;
  }

  function cost(cand, hand, leading) {
    var p = D.identify(cand);
    var score;

    if (p.type === T.ROCKET) score = 320;
    else if (p.type === T.BOMB) score = 160;
    else score = p.main;

    score += breakPenalty(cand, hand);

    if (leading) score -= cand.length * 2.4;
    else score -= cand.length * 0.3;

    if (p.type === T.SINGLE && p.main === 17) score += 45;
    else if (p.type === T.SINGLE && p.main === 16) score += 32;
    else if (p.type === T.SINGLE && p.main === 15) score += 14;

    if (cand.length === hand.length) score -= 500;

    return score;
  }

  function isBomb(play) {
    return play.type === T.BOMB || play.type === T.ROCKET;
  }

  /**
   * 选择要出的牌
   * ctx = { hand, last, lastSeat, mySeat, landlord, counts, difficulty }
   * @returns {null | Array} null 表示不要
   */
  function choose(ctx) {
    var hand = ctx.hand;
    var cands = D.findPlays(hand, ctx.last);
    if (!cands.length) return null;

    var scored = cands.map(function (c) {
      var p = D.identify(c);
      return { cards: c, play: p, cost: cost(c, hand, !ctx.last) };
    });

    /* 能一把走完就直接走 */
    var finishing = scored.filter(function (s) { return s.cards.length === hand.length; });
    if (finishing.length) {
      finishing.sort(function (a, b) { return a.play.main - b.play.main; });
      return finishing[0].cards;
    }

    /* 队友出的牌一般不压 */
    if (isTeammatePlay(ctx)) return null;

    var urgent = opponentMin(ctx) <= 2;
    var danger = opponentMin(ctx) <= 4;

    /* 过滤炸弹的使用时机 */
    var pool = scored.filter(function (s) {
      if (!isBomb(s.play)) return true;
      if (ctx.difficulty === 'easy') return false;
      if (ctx.difficulty === 'hard') return urgent || danger;
      return danger;
    });
    if (!pool.length) {
      if (ctx.difficulty === 'easy') return null;
      pool = scored;
    }

    if (ctx.difficulty === 'easy') {
      if (!ctx.last) {
        pool.sort(function (a, b) { return a.cost - b.cost; });
        var pick = pool.slice(0, Math.min(3, pool.length));
        return pick[Math.floor(Math.random() * pick.length)].cards;
      }
      if (Math.random() < 0.22 && !urgent) return null;
      pool.sort(function (a, b) { return a.cost - b.cost; });
      var top = pool.slice(0, Math.min(4, pool.length));
      return top[Math.floor(Math.random() * top.length)].cards;
    }

    pool.sort(function (a, b) { return a.cost - b.cost; });

    /* 困难：对手只剩一两张时，直接甩最大的同型牌压制 */
    if (ctx.difficulty === 'hard' && urgent && ctx.last) {
      var sameType = pool.filter(function (s) {
        return !isBomb(s.play) && s.play.type === ctx.last.type && s.play.len === ctx.last.len;
      });
      if (sameType.length) {
        sameType.sort(function (a, b) { return b.play.main - a.play.main; });
        return sameType[0].cards;
      }
    }

    return pool[0].cards;
  }

  global.DDZAI = {
    handStrength: handStrength,
    bid: bid,
    choose: choose
  };
})(typeof window !== 'undefined' ? window : globalThis);
