/**
 * rules.js - 大富翁 · 纯规则引擎
 * 只处理状态与事件，不碰 DOM、不做文案翻译（日志只给 key + 参数，由 UI 渲染）。
 * 浏览器挂 window.MonopolyRules，Node 走 module.exports，便于直接跑回归测试。
 *
 * 事件（events）用于驱动音效与动画，日志（log）用于渲染文字：
 *   { type:'roll'|'step'|'money'|'jail'|'buy'|'build'|'bankrupt'|'win' ... }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.MonopolyRules = factory(root.MonopolyData);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D) {
  'use strict';

  var TILES = D.TILES;

  function randomDie() { return Math.floor(Math.random() * 6) + 1; }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /* ---------------- 建局 ---------------- */

  /**
   * opts: { players:[{name,isAi,color}], startCash?, maxRounds? }
   * 返回初始 state（已经调用 beginTurn，phase 为 roll 或 jail）
   */
  function createGame(opts) {
    opts = opts || {};
    var defs = opts.players || [];
    var startCash = opts.startCash || D.START_CASH;

    var state = {
      players: defs.map(function (p, i) {
        return {
          id: i,
          name: p.name,
          isAi: !!p.isAi,
          color: p.color,
          kind: p.kind || (p.isAi ? 'cpu' : 'human'),
          n: p.n,
          cash: startCash,
          pos: 0,
          inJail: false,
          jailTurns: 0,
          jailFree: 0,
          doubles: 0,
          alive: true,
          bankruptAt: -1
        };
      }),
      owners: [],
      houses: [],
      turn: 0,
      round: 1,
      turnCount: 0,
      phase: 'roll',
      dice: [0, 0],
      doublesCount: 0,
      rentBoost: 1,
      lastRoll: null,
      pending: null,
      log: [],
      over: false,
      winner: null,
      maxRounds: opts.maxRounds || D.MAX_ROUNDS,
      seq: 0
    };

    for (var i = 0; i < TILES.length; i++) {
      state.owners.push(-1);
      state.houses.push(0);
    }

    beginTurn(state);
    return state;
  }

  function current(state) { return state.players[state.turn]; }

  function alivePlayers(state) {
    return state.players.filter(function (p) { return p.alive; });
  }

  function aliveCount(state) { return alivePlayers(state).length; }

  function tileAt(pos) { return TILES[pos]; }

  /* ---------------- 日志 ---------------- */

  function log(state, key, params) {
    state.seq += 1;
    var entry = { id: state.seq, key: key, params: params || {} };
    state.log.push(entry);
    if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
    return entry;
  }

  /** 进入结算结束态；已分出胜负时保留 over，不被覆盖 */
  function toEnd(state) {
    if (!state.over) state.phase = 'end';
  }

  /* ---------------- 回合 ---------------- */

  function beginTurn(state) {
    var p = current(state);
    state.dice = [0, 0];
    state.doublesCount = 0;
    state.rentBoost = 1;
    state.lastRoll = null;
    state.pending = null;

    if (p.inJail) {
      state.phase = 'jail';
      state.pending = { kind: 'jail', playerId: p.id };
      log(state, 'jailTurn', { name: p.name, turns: p.jailTurns });
    } else {
      state.phase = 'roll';
      log(state, 'turnStart', { name: p.name });
    }
    return [];
  }

  /**
   * 掷骰。phase 必须为 roll。
   * 返回 { events, roll:{dice, steps, doubles, jailed} }
   */
  function roll(state, dice) {
    if (state.phase !== 'roll') return null;
    var p = current(state);
    var d = dice || [randomDie(), randomDie()];
    d = [clamp(d[0] | 0, 1, 6), clamp(d[1] | 0, 1, 6)];

    state.dice = d;
    var doubles = d[0] === d[1];
    state._cardChain = 0;
    var events = [{ type: 'roll', player: p.id, dice: d, doubles: doubles }];
    log(state, 'roll', { name: p.name, d1: d[0], d2: d[1] });

    if (doubles) {
      state.doublesCount += 1;
      if (state.doublesCount >= 3) {
        log(state, 'tripleDoubles', { name: p.name });
        sendToJail(state, p, events);
        state.lastRoll = { dice: d, steps: 0, doubles: true, jailed: true };
        return { events: events, roll: state.lastRoll };
      }
      log(state, 'rollAgain', { name: p.name });
    }

    var steps = d[0] + d[1];
    state.lastRoll = { dice: d, steps: steps, doubles: doubles, jailed: false };
    state.phase = 'moving';
    return { events: events, roll: state.lastRoll };
  }

  /** 前进一步（UI 逐格调用，便于动画）。过起点发薪。 */
  function step(state) {
    var p = current(state);
    p.pos = (p.pos + 1) % TILES.length;
    var events = [{ type: 'step', player: p.id, pos: p.pos }];
    if (p.pos === 0) {
      p.cash += D.GO_SALARY;
      log(state, 'passGo', { name: p.name, amount: D.GO_SALARY });
      events.push({ type: 'money', player: p.id, delta: D.GO_SALARY, reason: 'go' });
    }
    return events;
  }

  /** 直接移动（卡牌用）。collectGo 为真时跨过起点发薪。 */
  function moveTo(state, pos, collectGo) {
    var p = current(state);
    var events = [];
    var passedGo = pos < p.pos;
    p.pos = pos;
    if (passedGo && collectGo) {
      p.cash += D.GO_SALARY;
      log(state, 'passGo', { name: p.name, amount: D.GO_SALARY });
      events.push({ type: 'money', player: p.id, delta: D.GO_SALARY, reason: 'go' });
    }
    events.push({ type: 'jump', player: p.id, pos: pos });
    return events;
  }

  function moveBy(state, steps, collectGo) {
    var p = current(state);
    var target = p.pos + steps;
    while (target < 0) target += TILES.length;
    target = target % TILES.length;
    return moveTo(state, target, collectGo);
  }

  /* ---------------- 落点结算 ---------------- */

  /**
   * 结算当前格。返回 { events, pending }。
   * boost 用于「付双倍租金」类卡牌。
   */
  function land(state, boost, eventsIn) {
    var p = current(state);
    var idx = p.pos;
    var t = TILES[idx];
    var events = eventsIn || [];
    var mul = boost || 1;

    state.phase = 'resolve';

    if (t.type === 'property' || t.type === 'railroad' || t.type === 'utility') {
      var ownerId = state.owners[idx];
      if (ownerId === -1) {
        if (p.cash >= t.price) {
          state.pending = { kind: 'buy', playerId: p.id, pos: idx, price: t.price };
          state.phase = 'buy';
          log(state, 'landedFree', { name: p.name, tile: idx, price: t.price });
        } else {
          log(state, 'cannotBuy', { name: p.name, tile: idx, price: t.price });
          toEnd(state);
        }
      } else if (ownerId === p.id) {
        log(state, 'ownTile', { name: p.name, tile: idx });
        toEnd(state);
      } else {
        var owner = state.players[ownerId];
        var rent = rentOf(state, idx, mul);
        var paid = pay(state, p, rent, ownerId, events);
        log(state, 'payRent', {
          name: p.name, owner: owner.name, tile: idx, amount: paid, rent: rent
        });
        events.push({ type: 'money', player: p.id, delta: -paid, reason: 'rent' });
        toEnd(state);
      }
      return { events: events, pending: state.pending };
    }

    if (t.type === 'tax') {
      var amount = t.amount;
      var paidTax = pay(state, p, amount, -1, events);
      log(state, 'payTax', { name: p.name, tile: idx, amount: paidTax });
      events.push({ type: 'money', player: p.id, delta: -paidTax, reason: 'tax' });
      toEnd(state);
      return { events: events, pending: null };
    }

    if (t.type === 'chance' || t.type === 'chest') {
      return drawCard(state, t.type === 'chance' ? 'chance' : 'chest', events);
    }

    if (t.type === 'gotojail') {
      log(state, 'landGoToJail', { name: p.name });
      sendToJail(state, p, events);
      return { events: events, pending: null };
    }

    if (t.type === 'go') {
      log(state, 'onGo', { name: p.name });
      toEnd(state);
      return { events: events, pending: null };
    }

    if (t.type === 'jail') {
      log(state, 'justVisiting', { name: p.name });
      toEnd(state);
      return { events: events, pending: null };
    }

    if (t.type === 'parking') {
      log(state, 'freeParking', { name: p.name });
      toEnd(state);
      return { events: events, pending: null };
    }

    toEnd(state);
    return { events: events, pending: null };
  }

  /** 抽卡并结算。卡牌可能继续移动，用 _cardChain 限制连锁深度。 */
  function drawCard(state, deckName, events) {
    state._cardChain = (state._cardChain || 0) + 1;
    if (state._cardChain > 4) {
      toEnd(state);
      return { events: events, pending: state.pending };
    }

    var p = current(state);
    var deck = deckName === 'chance' ? D.CHANCE : D.CHEST;
    var card = deck[Math.floor(Math.random() * deck.length)];

    log(state, deckName === 'chance' ? 'drawChance' : 'drawChest', {
      name: p.name, card: card.id
    });
    events.push({ type: 'card', player: p.id, deck: deckName, card: card.id });

    var eff = card.effect;
    var boost = 1;

    if (eff.kind === 'money') {
      if (eff.amount >= 0) {
        p.cash += eff.amount;
        events.push({ type: 'money', player: p.id, delta: eff.amount, reason: 'card' });
      } else {
        var paid = pay(state, p, -eff.amount, -1, events);
        events.push({ type: 'money', player: p.id, delta: -paid, reason: 'card' });
      }
      toEnd(state);
    } else if (eff.kind === 'move') {
      moveTo(state, eff.to, true).forEach(function (e) { events.push(e); });
      return land(state, 1, events);
    } else if (eff.kind === 'moveBy') {
      moveBy(state, eff.steps, false).forEach(function (e) { events.push(e); });
      return land(state, 1, events);
    } else if (eff.kind === 'nearest') {
      var target = nearestOfType(state, p.pos, eff.type);
      moveTo(state, target, true).forEach(function (e) { events.push(e); });
      boost = eff.doubleRent ? 2 : 1;
      return land(state, boost, events);
    } else if (eff.kind === 'jail') {
      sendToJail(state, p, events);
    } else if (eff.kind === 'jailFree') {
      p.jailFree += 1;
      toEnd(state);
    } else if (eff.kind === 'repair') {
      var bill = repairBill(state, p, eff.perHouse, eff.perHotel);
      var paidRepair = pay(state, p, bill.total, -1, events);
      log(state, 'repair', { name: p.name, amount: paidRepair, houses: bill.houses, hotels: bill.hotels });
      events.push({ type: 'money', player: p.id, delta: -paidRepair, reason: 'repair' });
      toEnd(state);
    } else if (eff.kind === 'payEach') {
      var others = alivePlayers(state).filter(function (o) { return o.id !== p.id; });
      for (var k = 0; k < others.length && p.alive; k++) {
        var paidEach = pay(state, p, eff.amount, others[k].id, events);
        log(state, 'payEach', { name: p.name, to: others[k].name, amount: paidEach });
      }
      toEnd(state);
    } else {
      toEnd(state);
    }

    return { events: events, pending: state.pending };
  }

  function nearestOfType(state, from, type) {
    for (var i = 1; i <= TILES.length; i++) {
      var idx = (from + i) % TILES.length;
      if (TILES[idx].type === type) return idx;
    }
    return from;
  }

  function repairBill(state, p, perHouse, perHotel) {
    var houses = 0, hotels = 0, i;
    for (i = 0; i < TILES.length; i++) {
      if (state.owners[i] !== p.id) continue;
      var h = state.houses[i];
      if (h >= 5) hotels += 1;
      else houses += h;
    }
    return { houses: houses, hotels: hotels, total: houses * perHouse + hotels * perHotel };
  }

  /* ---------------- 金钱 / 破产 ---------------- */

  /**
   * p 付 amount 给 creditorId（-1 表示银行）。
   * 现金不足先按半价卖房，仍不足则破产。返回实际支付额。
   */
  function pay(state, p, amount, creditorId, events) {
    if (amount <= 0) return 0;
    events = events || [];

    if (p.cash < amount) liquidate(state, p, amount - p.cash, events);

    var paid = Math.min(p.cash, amount);
    p.cash -= paid;
    if (creditorId >= 0 && state.players[creditorId]) {
      state.players[creditorId].cash += paid;
    }

    if (paid < amount) {
      bankrupt(state, p, creditorId, events);
      return paid;
    }
    return paid;
  }

  /** 半价卖房直到凑够 need（或卖光） */
  function liquidate(state, p, need, events) {
    var guard = 0;
    while (p.cash < need && guard < 200) {
      guard += 1;
      var best = -1;
      for (var i = 0; i < TILES.length; i++) {
        if (state.owners[i] === p.id && state.houses[i] > 0) {
          if (best < 0 || state.houses[i] > state.houses[best]) best = i;
        }
      }
      if (best < 0) break;
      var refund = Math.floor(TILES[best].houseCost / 2);
      state.houses[best] -= 1;
      p.cash += refund;
      log(state, 'autoSell', { name: p.name, tile: best, refund: refund });
      events.push({ type: 'money', player: p.id, delta: refund, reason: 'sell' });
    }
  }

  function bankrupt(state, p, creditorId, events) {
    if (!p.alive) return;
    p.alive = false;
    p.bankruptAt = state.turnCount;
    var creditor = creditorId >= 0 ? state.players[creditorId] : null;

    for (var i = 0; i < TILES.length; i++) {
      if (state.owners[i] !== p.id) continue;
      if (creditor && creditor.alive) {
        state.owners[i] = creditor.id;
      } else {
        state.owners[i] = -1;
        state.houses[i] = 0;
      }
    }

    log(state, 'bankrupt', { name: p.name, to: creditor ? creditor.name : null });
    events.push({ type: 'bankrupt', player: p.id });

    checkWin(state, events);
  }

  function checkWin(state, events) {
    var alive = alivePlayers(state);
    if (alive.length === 1 && state.players.length > 1) {
      state.over = true;
      state.winner = alive[0].id;
      state.phase = 'over';
      log(state, 'win', { name: alive[0].name });
      (events || []).push({ type: 'win', player: alive[0].id });
    }
  }

  /* ---------------- 买卖 / 建房 ---------------- */

  function buy(state) {
    var pend = state.pending;
    if (!pend || pend.kind !== 'buy') return null;
    var p = state.players[pend.playerId];
    var t = TILES[pend.pos];
    if (p.cash < t.price) return null;

    p.cash -= t.price;
    state.owners[pend.pos] = p.id;
    state.pending = null;
    state.phase = 'end';
    log(state, 'buy', { name: p.name, tile: pend.pos, price: t.price });
    return { type: 'buy', player: p.id, pos: pend.pos, price: t.price };
  }

  function decline(state) {
    var pend = state.pending;
    if (!pend || pend.kind !== 'buy') return null;
    var p = state.players[pend.playerId];
    log(state, 'decline', { name: p.name, tile: pend.pos });
    state.pending = null;
    state.phase = 'end';
    return { type: 'decline', player: p.id };
  }

  function ownsGroup(state, playerId, group) {
    var list = D.groupIndexes(group);
    for (var i = 0; i < list.length; i++) {
      if (state.owners[list[i]] !== playerId) return false;
    }
    return true;
  }

  function groupHouseRange(state, group) {
    var list = D.groupIndexes(group);
    var min = 99, max = -1;
    for (var i = 0; i < list.length; i++) {
      var h = state.houses[list[i]];
      if (h < min) min = h;
      if (h > max) max = h;
    }
    return { min: min, max: max, list: list };
  }

  /** 能否建房：自己的地产、整组在手、现金够、未到旅馆、且符合均衡建房 */
  function canBuild(state, pos, playerId) {
    var t = TILES[pos];
    if (!t || t.type !== 'property') return { ok: false, reason: 'type' };
    if (state.owners[pos] !== playerId) return { ok: false, reason: 'owner' };
    if (!ownsGroup(state, playerId, t.group)) return { ok: false, reason: 'group' };
    if (state.houses[pos] >= 5) return { ok: false, reason: 'max' };
    var range = groupHouseRange(state, t.group);
    if (state.houses[pos] > range.min) return { ok: false, reason: 'even' };
    if (state.players[playerId].cash < t.houseCost) return { ok: false, reason: 'cash' };
    return { ok: true, cost: t.houseCost };
  }

  function build(state, pos) {
    var p = current(state);
    if (state.phase === 'moving' || state.phase === 'over') return null;
    var chk = canBuild(state, pos, p.id);
    if (!chk.ok) return null;

    p.cash -= chk.cost;
    state.houses[pos] += 1;
    log(state, 'build', { name: p.name, tile: pos, cost: chk.cost, houses: state.houses[pos] });
    return { type: 'build', player: p.id, pos: pos, cost: chk.cost };
  }

  function canSellHouse(state, pos, playerId) {
    var t = TILES[pos];
    if (!t || t.type !== 'property') return { ok: false, reason: 'type' };
    if (state.owners[pos] !== playerId) return { ok: false, reason: 'owner' };
    if (state.houses[pos] <= 0) return { ok: false, reason: 'none' };
    var range = groupHouseRange(state, t.group);
    if (state.houses[pos] < range.max) return { ok: false, reason: 'even' };
    return { ok: true, refund: Math.floor(t.houseCost / 2) };
  }

  function sellHouse(state, pos) {
    var p = current(state);
    var chk = canSellHouse(state, pos, p.id);
    if (!chk.ok) return null;
    state.houses[pos] -= 1;
    p.cash += chk.refund;
    log(state, 'sellHouse', { name: p.name, tile: pos, refund: chk.refund });
    return { type: 'sell', player: p.id, pos: pos, refund: chk.refund };
  }

  /* ---------------- 租金 ---------------- */

  function countOwnedOfType(state, playerId, type) {
    var n = 0;
    for (var i = 0; i < TILES.length; i++) {
      if (TILES[i].type === type && state.owners[i] === playerId) n += 1;
    }
    return n;
  }

  function rentOf(state, pos, boost) {
    var t = TILES[pos];
    var ownerId = state.owners[pos];
    var mul = boost || 1;
    if (ownerId < 0) return 0;

    if (t.type === 'property') {
      var h = state.houses[pos];
      var base = t.rent[h];
      if (h === 0 && ownsGroup(state, ownerId, t.group)) base *= 2;
      return Math.round(base * mul);
    }
    if (t.type === 'railroad') {
      var n = countOwnedOfType(state, ownerId, 'railroad');
      return Math.round(25 * Math.pow(2, Math.max(0, n - 1)) * mul);
    }
    if (t.type === 'utility') {
      var u = countOwnedOfType(state, ownerId, 'utility');
      var diceSum = state.dice[0] + state.dice[1];
      return Math.round(diceSum * (u === 2 ? 10 : 4) * mul);
    }
    return 0;
  }

  /* ---------------- 监狱 ---------------- */

  function sendToJail(state, p, events) {
    p.pos = 10;
    p.inJail = true;
    p.jailTurns = 0;
    p.doubles = 0;
    if (state.lastRoll) state.lastRoll.jailed = true;
    log(state, 'goToJail', { name: p.name });
    (events || []).push({ type: 'jail', player: p.id });
    state.phase = 'end';
  }

  /**
   * 狱中操作：'pay' 交保释金 / 'card' 用出狱卡 / 'roll' 掷骰求豹子。
   * 返回 { events, roll, staying }
   */
  function jailAction(state, action) {
    if (state.phase !== 'jail') return null;
    var p = current(state);
    var events = [];

    if (action === 'card' && p.jailFree > 0) {
      p.jailFree -= 1;
      p.inJail = false;
      p.jailTurns = 0;
      state.phase = 'roll';
      state.pending = null;
      log(state, 'useJailCard', { name: p.name });
      return { events: events, roll: null, staying: false };
    }

    if (action === 'pay') {
      var paid = pay(state, p, D.JAIL_FINE, -1, events);
      p.inJail = false;
      p.jailTurns = 0;
      state.phase = 'roll';
      state.pending = null;
      log(state, 'payBail', { name: p.name, amount: paid });
      events.push({ type: 'money', player: p.id, delta: -paid, reason: 'jail' });
      return { events: events, roll: null, staying: false };
    }

    if (action === 'roll') {
      var d = [randomDie(), randomDie()];
      var doubles = d[0] === d[1];
      state.dice = d;
      state._cardChain = 0;
      log(state, 'jailRoll', { name: p.name, d1: d[0], d2: d[1] });
      events.push({ type: 'roll', player: p.id, dice: d, doubles: doubles });

      if (doubles) {
        p.inJail = false;
        p.jailTurns = 0;
        state.pending = null;
        state.phase = 'moving';
        state.lastRoll = { dice: d, steps: d[0] + d[1], doubles: false, jailed: false, fromJail: true };
        log(state, 'jailDoubles', { name: p.name });
        return { events: events, roll: state.lastRoll, staying: false };
      }

      p.jailTurns += 1;
      if (p.jailTurns >= 3) {
        var forced = pay(state, p, D.JAIL_FINE, -1, events);
        p.inJail = false;
        p.jailTurns = 0;
        state.pending = null;
        state.phase = 'moving';
        state.lastRoll = { dice: d, steps: d[0] + d[1], doubles: false, jailed: false };
        log(state, 'forcedBail', { name: p.name, amount: forced });
        events.push({ type: 'money', player: p.id, delta: -forced, reason: 'jail' });
        return { events: events, roll: state.lastRoll, staying: false };
      }

      state.phase = 'end';
      state.pending = null;
      log(state, 'stayJail', { name: p.name, turns: p.jailTurns });
      return { events: events, roll: { dice: d, steps: 0, doubles: false, jailed: false }, staying: true };
    }

    return null;
  }

  /* ---------------- 回合结束 ---------------- */

  /**
   * 结束当前回合。豹子且未被关押则同一玩家再掷一次。
   * 返回 { again, next }。
   */
  function endTurn(state) {
    if (state.over) return { again: false, next: null };
    var p = current(state);
    state.pending = null;

    if (p.alive && state.lastRoll && state.lastRoll.doubles && !state.lastRoll.jailed && !p.inJail) {
      state.phase = 'roll';
      log(state, 'extraRoll', { name: p.name });
      return { again: true, next: p.id };
    }

    state.turnCount += 1;
    var n = state.players.length;
    for (var i = 1; i <= n; i++) {
      var idx = (state.turn + i) % n;
      if (state.players[idx].alive) { state.turn = idx; break; }
    }
    state.round = Math.floor(state.turnCount / n) + 1;

    if (state.round > state.maxRounds && !state.over) settle(state);
    if (!state.over) beginTurn(state);
    return { again: false, next: state.turn };
  }

  /** 回合上限到达：净资产最高者获胜 */
  function settle(state) {
    var alive = alivePlayers(state);
    if (!alive.length) return;
    var best = alive[0];
    for (var i = 1; i < alive.length; i++) {
      if (netWorth(state, alive[i]) > netWorth(state, best)) best = alive[i];
    }
    state.over = true;
    state.phase = 'over';
    state.winner = best.id;
    log(state, 'settle', { name: best.name, rounds: state.maxRounds });
  }

  /* ---------------- 统计 ---------------- */

  function propertyCount(state, playerId) {
    var n = 0;
    for (var i = 0; i < TILES.length; i++) {
      if (state.owners[i] === playerId) n += 1;
    }
    return n;
  }

  function netWorth(state, p) {
    var total = p.cash;
    for (var i = 0; i < TILES.length; i++) {
      if (state.owners[i] !== p.id) continue;
      total += TILES[i].price || 0;
      total += state.houses[i] * (TILES[i].houseCost || 0);
    }
    return total;
  }

  function ranking(state) {
    return state.players.slice().sort(function (a, b) {
      return netWorth(state, b) - netWorth(state, a);
    });
  }

  return {
    createGame: createGame,
    current: current,
    alivePlayers: alivePlayers,
    aliveCount: aliveCount,
    tileAt: tileAt,
    beginTurn: beginTurn,
    roll: roll,
    step: step,
    moveTo: moveTo,
    moveBy: moveBy,
    land: land,
    buy: buy,
    decline: decline,
    build: build,
    canBuild: canBuild,
    sellHouse: sellHouse,
    canSellHouse: canSellHouse,
    rentOf: rentOf,
    ownsGroup: ownsGroup,
    countOwnedOfType: countOwnedOfType,
    jailAction: jailAction,
    endTurn: endTurn,
    netWorth: netWorth,
    propertyCount: propertyCount,
    ranking: ranking,
    settle: settle,
    pay: pay,
    log: log
  };
});
