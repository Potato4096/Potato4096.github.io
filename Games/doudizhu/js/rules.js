/**
 * rules.js - 斗地主规则引擎
 * 牌型识别 / 大小比较 / 发牌 / 候选出牌生成
 * 无依赖，纯函数，浏览器与 Node 均可运行
 */
(function (global) {
  'use strict';

  var SUITS = ['spade', 'heart', 'club', 'diamond'];

  /* 牌型 id */
  var T = {
    SINGLE: 'single',
    PAIR: 'pair',
    TRIO: 'trio',
    TRIO_SINGLE: 'trio_single',
    TRIO_PAIR: 'trio_pair',
    STRAIGHT: 'straight',
    STRAIGHT_PAIR: 'straight_pair',
    PLANE: 'plane',
    PLANE_SINGLE: 'plane_single',
    PLANE_PAIR: 'plane_pair',
    FOUR_TWO: 'four_two',
    FOUR_TWO_PAIR: 'four_two_pair',
    BOMB: 'bomb',
    ROCKET: 'rocket'
  };

  /* ---------------- 发牌 ---------------- */

  function buildDeck() {
    var deck = [], id = 0, r, s;
    for (r = 3; r <= 15; r++) {
      for (s = 0; s < 4; s++) deck.push({ id: id++, rank: r, suit: SUITS[s] });
    }
    deck.push({ id: id++, rank: 16, suit: 'joker' });
    deck.push({ id: id++, rank: 17, suit: 'joker' });
    return deck;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function deal() {
    var deck = shuffle(buildDeck());
    return {
      hands: [deck.slice(0, 17), deck.slice(17, 34), deck.slice(34, 51)],
      bottom: deck.slice(51)
    };
  }

  /** 大牌在前，同点数按固定花色顺序 */
  function sortDesc(cards) {
    return cards.slice().sort(function (a, b) {
      if (b.rank !== a.rank) return b.rank - a.rank;
      return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    });
  }

  function byRank(cards) {
    var m = {};
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].rank;
      (m[r] || (m[r] = [])).push(cards[i]);
    }
    return m;
  }

  function rankCounts(cards) {
    var m = {};
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].rank;
      m[r] = (m[r] || 0) + 1;
    }
    return m;
  }

  /** 某点数在整副牌里的总张数 */
  function totalOf(rank) {
    return rank >= 16 ? 1 : 4;
  }

  /* ---------------- 牌型识别 ---------------- */

  /** 连续三张以上的点数段（3~A） */
  function findRuns(cnt) {
    var ranks = Object.keys(cnt).map(Number).filter(function (r) {
      return r <= 14 && cnt[r] >= 3;
    }).sort(function (a, b) { return a - b; });

    var runs = [], cur = [];
    for (var i = 0; i < ranks.length; i++) {
      if (!cur.length || ranks[i] === cur[cur.length - 1] + 1) cur.push(ranks[i]);
      else { if (cur.length) runs.push(cur); cur = [ranks[i]]; }
    }
    if (cur.length) runs.push(cur);
    return runs;
  }

  /**
   * 检查翅膀是否合法
   * perWing: 0 = 不带, 1 = 每份一张, 2 = 每份一对
   */
  function wingOk(cnt, seq, perWing) {
    var total = 0, ok = true;
    Object.keys(cnt).forEach(function (key) {
      var r = Number(key);
      var c = cnt[key] - (seq.indexOf(r) >= 0 ? 3 : 0);
      if (c <= 0) return;
      total += c;
      if (perWing === 2 && c % 2 !== 0) ok = false;
      if (perWing === 1 && c > 2) ok = false;
    });
    if (!ok) return false;
    return total === seq.length * perWing;
  }

  /**
   * 识别一手牌
   * @returns {null | { type, main, len, name }}
   */
  function identify(cards) {
    var n = cards.length;
    if (!n) return null;

    var cnt = rankCounts(cards);
    var ranks = Object.keys(cnt).map(Number).sort(function (a, b) { return a - b; });
    var k = ranks.length, i;

    if (n === 2 && cnt[16] === 1 && cnt[17] === 1) return { type: T.ROCKET, main: 17, len: 2 };
    if (n === 1) return { type: T.SINGLE, main: ranks[0], len: 1 };
    if (n === 2 && k === 1) return { type: T.PAIR, main: ranks[0], len: 2 };
    if (n === 3 && k === 1) return { type: T.TRIO, main: ranks[0], len: 3 };
    if (n === 4 && k === 1) return { type: T.BOMB, main: ranks[0], len: 4 };

    /* 三带一 / 三带二 */
    for (i = 0; i < k; i++) {
      if (cnt[ranks[i]] !== 3) continue;
      var trioRank = ranks[i];
      var rest = ranks.filter(function (r) { return r !== trioRank; });
      if (n === 4 && rest.length === 1) return { type: T.TRIO_SINGLE, main: trioRank, len: 4 };
      if (n === 5 && rest.length === 1 && cnt[rest[0]] === 2) {
        return { type: T.TRIO_PAIR, main: trioRank, len: 5 };
      }
    }

    /* 四带二 / 四带二对 */
    for (i = 0; i < k; i++) {
      if (cnt[ranks[i]] !== 4) continue;
      var quadRank = ranks[i];
      if (n === 6) return { type: T.FOUR_TWO, main: quadRank, len: 6 };
      if (n === 8) {
        var others = ranks.filter(function (r) { return r !== quadRank; });
        if (others.length === 2 && others.every(function (r) { return cnt[r] === 2; })) {
          return { type: T.FOUR_TWO_PAIR, main: quadRank, len: 8 };
        }
      }
    }

    /* 顺子 */
    if (n >= 5 && k === n && ranks[k - 1] <= 14 && ranks[k - 1] - ranks[0] === n - 1) {
      return { type: T.STRAIGHT, main: ranks[k - 1], len: n };
    }

    /* 连对 */
    if (n >= 6 && n % 2 === 0 && k === n / 2 && ranks[k - 1] <= 14 &&
        ranks[k - 1] - ranks[0] === k - 1 &&
        ranks.every(function (r) { return cnt[r] === 2; })) {
      return { type: T.STRAIGHT_PAIR, main: ranks[k - 1], len: n };
    }

    /* 飞机（可带单 / 带对） */
    var runs = findRuns(cnt);
    for (var ri = 0; ri < runs.length; ri++) {
      var run = runs[ri];
      for (var L = run.length; L >= 2; L--) {
        for (var s = 0; s + L <= run.length; s++) {
          var seq = run.slice(s, s + L);
          var top = seq[L - 1];
          if (n === L * 3 && wingOk(cnt, seq, 0)) return { type: T.PLANE, main: top, len: n };
          if (n === L * 4 && wingOk(cnt, seq, 1)) return { type: T.PLANE_SINGLE, main: top, len: n };
          if (n === L * 5 && wingOk(cnt, seq, 2)) return { type: T.PLANE_PAIR, main: top, len: n };
        }
      }
    }

    return null;
  }

  /** a 能否压过 b（b 为空表示自由出牌） */
  function canBeat(a, b) {
    if (!a) return false;
    if (!b) return true;
    if (a.type === T.ROCKET) return true;
    if (b.type === T.ROCKET) return false;
    if (a.type === T.BOMB && b.type !== T.BOMB) return true;
    if (b.type === T.BOMB && a.type !== T.BOMB) return false;
    if (a.type !== b.type || a.len !== b.len) return false;
    return a.main > b.main;
  }

  /* ---------------- 候选出牌生成 ---------------- */

  function straights(m, L, minMain, out) {
    for (var s = 3; s + L - 1 <= 14; s++) {
      var end = s + L - 1;
      if (end <= minMain) continue;
      var cards = [], ok = true;
      for (var r = s; r <= end; r++) {
        if (!m[r] || !m[r].length) { ok = false; break; }
        cards.push(m[r][0]);
      }
      if (ok) out.push(cards);
    }
  }

  function straightPairs(m, P, minMain, out) {
    for (var s = 3; s + P - 1 <= 14; s++) {
      var end = s + P - 1;
      if (end <= minMain) continue;
      var cards = [], ok = true;
      for (var r = s; r <= end; r++) {
        if (!m[r] || m[r].length < 2) { ok = false; break; }
        cards.push(m[r][0], m[r][1]);
      }
      if (ok) out.push(cards);
    }
  }

  /**
   * 从手牌里挑翅膀
   * @param {number} need 需要的牌张数
   * @param {number} per  1=当单张用，2=当对子用
   * @param {number} usedPer 主体点数要扣掉的张数
   */
  function pickWings(m, seq, need, per, usedPer) {
    var up = usedPer || 3;
    var pool = [];
    Object.keys(m).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
      var used = seq.indexOf(r) >= 0 ? up : 0;
      var avail = m[r].length - used;
      if (avail > 0) pool.push({ rank: r, cards: m[r].slice(used) });
    });

    var res = [];
    if (per === 1) {
      var singles = [], others = [];
      pool.forEach(function (p) { (p.cards.length === 1 ? singles : others).push(p); });
      var ordered = singles.concat(others);
      for (var i = 0; i < ordered.length && res.length < need; i++) {
        for (var j = 0; j < ordered[i].cards.length && res.length < need; j++) {
          res.push(ordered[i].cards[j]);
        }
      }
    } else {
      for (var k = 0; k < pool.length && res.length < need; k++) {
        if (pool[k].cards.length >= 2 && pool[k].rank < 16) {
          res.push(pool[k].cards[0], pool[k].cards[1]);
        }
      }
    }
    return res.length === need ? res : null;
  }

  function planes(m, k, mode, minMain, out) {
    for (var s = 3; s + k - 1 <= 14; s++) {
      var end = s + k - 1;
      if (end <= minMain) continue;
      var seq = [], cards = [], ok = true;
      for (var r = s; r <= end; r++) {
        if (!m[r] || m[r].length < 3) { ok = false; break; }
        seq.push(r);
        cards.push(m[r][0], m[r][1], m[r][2]);
      }
      if (!ok) continue;
      if (mode === 0) { out.push(cards); continue; }
      var wings = pickWings(m, seq, k * (mode === 1 ? 1 : 2), mode, 3);
      if (wings) out.push(cards.concat(wings));
    }
  }

  /**
   * 找出所有合法的出牌组合
   * @param {Array} hand 手牌
   * @param {null | {type, main, len}} last 上家出的牌（null = 自由出牌）
   */
  function findPlays(hand, last) {
    var m = byRank(hand);
    var ranks = Object.keys(m).map(Number).sort(function (a, b) { return a - b; });
    var out = [];
    var free = !last;
    var t = last ? last.type : null;
    var minMain = last ? last.main : 0;

    /* 炸弹 / 王炸 永远可以尝试 */
    ranks.forEach(function (r) {
      if (m[r].length !== 4) return;
      if (!last) out.push(m[r].slice(0, 4));
      else if (last.type === T.BOMB) { if (r > last.main) out.push(m[r].slice(0, 4)); }
      else if (last.type !== T.ROCKET) out.push(m[r].slice(0, 4));
    });
    if (m[16] && m[17] && (!last || last.type !== T.ROCKET)) {
      out.push([m[16][0], m[17][0]]);
    }

    if (free || t === T.SINGLE) {
      ranks.forEach(function (r) { if (r > minMain) out.push([m[r][0]]); });
    }
    if (free || t === T.PAIR) {
      ranks.forEach(function (r) {
        if (r > minMain && m[r].length >= 2) out.push(m[r].slice(0, 2));
      });
    }
    if (free || t === T.TRIO) {
      ranks.forEach(function (r) {
        if (r > minMain && m[r].length >= 3) out.push(m[r].slice(0, 3));
      });
    }
    if (free || (t === T.TRIO_SINGLE && last.len === 4)) {
      ranks.forEach(function (r) {
        if (r <= minMain || m[r].length < 3) return;
        var wings = pickWings(m, [r], 1, 1, 3);
        if (wings) out.push(m[r].slice(0, 3).concat(wings));
      });
    }
    if (free || (t === T.TRIO_PAIR && last.len === 5)) {
      ranks.forEach(function (r) {
        if (r <= minMain || m[r].length < 3) return;
        var wings = pickWings(m, [r], 2, 2, 3);
        if (wings) out.push(m[r].slice(0, 3).concat(wings));
      });
    }
    if (free || (t === T.FOUR_TWO && last.len === 6)) {
      ranks.forEach(function (r) {
        if (r <= minMain || m[r].length < 4) return;
        var wings = pickWings(m, [r], 2, 1, 4);
        if (wings) out.push(m[r].slice(0, 4).concat(wings));
      });
    }
    if (free || (t === T.FOUR_TWO_PAIR && last.len === 8)) {
      ranks.forEach(function (r) {
        if (r <= minMain || m[r].length < 4) return;
        var wings = pickWings(m, [r], 4, 2, 4);
        if (wings) out.push(m[r].slice(0, 4).concat(wings));
      });
    }

    /* 顺子 */
    var lens = [];
    if (free) { for (var a = 5; a <= 12; a++) lens.push(a); }
    else if (t === T.STRAIGHT) lens = [last.len];
    lens.forEach(function (L) { straights(m, L, minMain, out); });

    /* 连对 */
    lens = [];
    if (free) { for (var b = 3; b <= 10; b++) lens.push(b); }
    else if (t === T.STRAIGHT_PAIR) lens = [last.len / 2];
    lens.forEach(function (P) { straightPairs(m, P, minMain, out); });

    /* 飞机 */
    var modes = [];
    var kss = [];
    if (free) {
      for (var k = 2; k <= 6; k++) kss.push(k);
      modes = [0, 1, 2];
    } else if (t === T.PLANE) { kss = [last.len / 3]; modes = [0]; }
    else if (t === T.PLANE_SINGLE) { kss = [last.len / 4]; modes = [1]; }
    else if (t === T.PLANE_PAIR) { kss = [last.len / 5]; modes = [2]; }
    kss.forEach(function (kk) {
      modes.forEach(function (mode) { planes(m, kk, mode, minMain, out); });
    });

    return out;
  }

  /* ---------------- 其他工具 ---------------- */

  function remove(hand, cards) {
    var ids = {};
    cards.forEach(function (c) { ids[c.id] = 1; });
    return hand.filter(function (c) { return !ids[c.id]; });
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var ids = {};
    a.forEach(function (c) { ids[c.id] = 1; });
    return b.every(function (c) { return ids[c.id]; });
  }

  global.DDZ = {
    T: T,
    SUITS: SUITS,
    buildDeck: buildDeck,
    shuffle: shuffle,
    deal: deal,
    sortDesc: sortDesc,
    byRank: byRank,
    rankCounts: rankCounts,
    totalOf: totalOf,
    identify: identify,
    canBeat: canBeat,
    findPlays: findPlays,
    remove: remove,
    sameSet: sameSet
  };
})(typeof window !== 'undefined' ? window : globalThis);
