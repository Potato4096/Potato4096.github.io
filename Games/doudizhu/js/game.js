/**
 * game.js - 斗地主 · 界面与对局流程
 * 依赖：platform/game-api.js（GamePlatform）、js/rules.js（DDZ）、js/ai.js（DDZAI）
 */
(function () {
  'use strict';

  var D = DDZ, AI = DDZAI, T = DDZ.T;

  /* ============================================================
   * 文案
   * ========================================================== */
  var TEXT = {
    zh: {
      back: '返回主页',
      modeBtn: '模式',
      counterBtn: '记牌器',
      autoBtn: '托管',
      autoOff: '取消托管',
      restart: '重新开始',
      hint: '提示',
      play: '出牌',
      pass: '不要',
      bidPass: '不叫',
      bidScore: '{n} 分',
      you: '你',
      aiA: '电脑·甲',
      aiB: '电脑·乙',
      pN: '玩家 {n}',
      landlord: '地主',
      farmer: '农民',
      thinking: '思考中…',
      bottom: '底牌',
      mult: '倍数 ×{n}',
      waiting: '等待 {name} 出牌',
      bidWaiting: '等待 {name} 叫分',
      bidYourTurn: '轮到你叫分',
      yourTurn: '轮到你出牌',
      allPass: '三家都不叫，重新发牌',
      becameLandlord: '{name} 成为地主（{n} 分）',
      spring: '春天',
      antiSpring: '反春天',
      landlordWin: '地主胜',
      farmerWin: '农民胜',
      nextRound: '下一局',
      noSelect: '请先选牌',
      badPlay: '这不是合法牌型',
      cannotBeat: '压不过上家的牌',
      cannotPass: '你是首家，必须出牌',
      chooseMode: '选择对局模式',
      modeSolo: '单人挑战',
      modeSoloSub: '你 vs 两个电脑',
      modeDuo: '两人热座',
      modeDuoSub: '两位真人 + 一个电脑',
      modeTrio: '三人热座',
      modeTrioSub: '三个人挨个上阵',
      difficulty: '电脑难度',
      diffEasy: '简单',
      diffMedium: '中等',
      diffHard: '困难',
      curtainTitle: '轮到 {name}',
      curtainSub: '点一下继续，别让旁人看到手牌',
      curtainOk: '我准备好了',
      cleared: '记录已清除',
      clearStats: '清除战绩',
      statsLine: '共 {games} 局 · 地主胜 {lw} · 农民胜 {fw}',
      streakLine: '连胜 {n} · 最高 {best} 倍',
      counterTitle: '记牌器（剩余未知牌）',
      bigJoker: '大王',
      smallJoker: '小王',
      type_single: '单张',
      type_pair: '对子',
      type_trio: '三张',
      type_trio_single: '三带一',
      type_trio_pair: '三带二',
      type_straight: '顺子',
      type_straight_pair: '连对',
      type_plane: '飞机',
      type_plane_single: '飞机带单',
      type_plane_pair: '飞机带对',
      type_four_two: '四带二',
      type_four_two_pair: '四带二对',
      type_bomb: '炸弹',
      type_rocket: '王炸'
    },
    en: {
      back: 'Back to Home',
      modeBtn: 'Mode',
      counterBtn: 'Counter',
      autoBtn: 'Autoplay',
      autoOff: 'Stop Autoplay',
      restart: 'New Deal',
      hint: 'Hint',
      play: 'Play',
      pass: 'Pass',
      bidPass: 'No bid',
      bidScore: '{n} pt',
      you: 'You',
      aiA: 'CPU A',
      aiB: 'CPU B',
      pN: 'Player {n}',
      landlord: 'Landlord',
      farmer: 'Farmer',
      thinking: 'thinking…',
      bottom: 'Kitty',
      mult: 'Multiplier ×{n}',
      waiting: 'Waiting for {name}',
      bidWaiting: 'Waiting for {name} to bid',
      bidYourTurn: 'Your turn to bid',
      yourTurn: 'Your turn',
      allPass: 'Nobody bid — dealing again',
      becameLandlord: '{name} is the landlord ({n} pt)',
      spring: 'Spring',
      antiSpring: 'Anti-spring',
      landlordWin: 'Landlord wins',
      farmerWin: 'Farmers win',
      nextRound: 'Next Deal',
      noSelect: 'Select some cards first',
      badPlay: 'Not a valid pattern',
      cannotBeat: 'Too small to beat that',
      cannotPass: 'You lead — you must play',
      chooseMode: 'Choose a game mode',
      modeSolo: 'Solo',
      modeSoloSub: 'You vs two CPUs',
      modeDuo: 'Two players',
      modeDuoSub: 'Two humans + one CPU',
      modeTrio: 'Three players',
      modeTrioSub: 'Three people taking turns',
      difficulty: 'CPU difficulty',
      diffEasy: 'Easy',
      diffMedium: 'Normal',
      diffHard: 'Hard',
      curtainTitle: '{name}, your turn',
      curtainSub: 'Tap to continue and keep your hand private',
      curtainOk: 'Ready',
      cleared: 'Records cleared',
      clearStats: 'Clear Records',
      statsLine: '{games} deals · landlord {lw} · farmers {fw}',
      streakLine: 'Streak {n} · best ×{best}',
      counterTitle: 'Card counter (unseen)',
      bigJoker: 'Big',
      smallJoker: 'Small',
      type_single: 'Single',
      type_pair: 'Pair',
      type_trio: 'Trio',
      type_trio_single: 'Trio + one',
      type_trio_pair: 'Trio + pair',
      type_straight: 'Straight',
      type_straight_pair: 'Pairs run',
      type_plane: 'Plane',
      type_plane_single: 'Plane + singles',
      type_plane_pair: 'Plane + pairs',
      type_four_two: 'Four + two',
      type_four_two_pair: 'Four + two pairs',
      type_bomb: 'Bomb',
      type_rocket: 'Rocket'
    }
  };

  function t(key, map) {
    var lang = GamePlatform.i18n.getLang();
    var s = (TEXT[lang] || TEXT.zh)[key];
    if (s == null) s = TEXT.zh[key];
    if (s == null) return key;
    if (map) {
      Object.keys(map).forEach(function (k) {
        s = s.split('{' + k + '}').join(map[k]);
      });
    }
    return s;
  }

  function typeLabel(type) {
    return t('type_' + type);
  }

  /* ============================================================
   * 音效
   * ========================================================== */
  var audioCtx = null;

  function beep(freq, dur, type, gain) {
    if (!GamePlatform.ui.isSoundEnabled()) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = type || 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain || 0.06, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    } catch (e) { /* 忽略音频错误 */ }
  }

  function sfxSelect() { beep(880, 0.04, 'sine', 0.05); }
  function sfxPlay() { beep(560, 0.06, 'triangle', 0.07); }
  function sfxPass() { beep(300, 0.09, 'sine', 0.05); }
  function sfxBid() { beep(700, 0.08, 'triangle', 0.07); }
  function sfxBomb() {
    beep(120, 0.18, 'square', 0.09);
    setTimeout(function () { beep(80, 0.22, 'square', 0.08); }, 90);
  }
  function sfxWin() {
    [523, 659, 784, 1046].forEach(function (f, i) {
      setTimeout(function () { beep(f, 0.18, 'triangle', 0.07); }, i * 130);
    });
  }
  function sfxLose() {
    [392, 330, 262].forEach(function (f, i) {
      setTimeout(function () { beep(f, 0.2, 'sine', 0.07); }, i * 150);
    });
  }

  /* ============================================================
   * 状态
   * ========================================================== */
  var MODES = {
    solo: [{ ai: false, key: 'you' }, { ai: true, key: 'aiA' }, { ai: true, key: 'aiB' }],
    duo: [{ ai: false, key: 'p1' }, { ai: false, key: 'p2' }, { ai: true, key: 'aiA' }],
    trio: [{ ai: false, key: 'p1' }, { ai: false, key: 'p2' }, { ai: false, key: 'p3' }]
  };

  var G = {
    mode: 'solo',
    difficulty: 'medium',
    parts: [],
    seats: [],
    bottom: [],
    landlord: -1,
    turn: 0,
    phase: 'idle',
    bid: { highest: 0, best: -1, count: 0 },
    last: null,
    passCount: 0,
    multiplier: 1,
    base: 1,
    viewSeat: 0,
    selected: {},
    hintList: [],
    hintIdx: -1,
    revealBottom: false,
    auto: [false, false, false],
    played: {},
    stats: { games: 0, lw: 0, fw: 0, best: 0, streak: 0 },
    showCounter: true,
    token: 0,
    roundIndex: 0,
    curtainOpen: false,
    aiTimer: null
  };

  var el = {};

  /* ============================================================
   * 工具
   * ========================================================== */
  function toast(msg) { GamePlatform.ui.toast(msg); }

  function isAI(seat) { return G.parts[seat] ? G.parts[seat].ai : true; }
  function isAuto(seat) { return !isAI(seat) && G.auto[seat]; }

  function seatName(i) {
    var p = G.parts[i];
    if (!p) return '';
    if (p.key === 'p1') return t('pN', { n: 1 });
    if (p.key === 'p2') return t('pN', { n: 2 });
    if (p.key === 'p3') return t('pN', { n: 3 });
    return t(p.key);
  }

  function humanCount() {
    return G.parts.filter(function (p) { return !p.ai; }).length;
  }

  function firstHuman() {
    for (var i = 0; i < G.parts.length; i++) if (!G.parts[i].ai) return i;
    return 0;
  }

  function rankLabel(rank) {
    if (rank === 17) return t('bigJoker');
    if (rank === 16) return t('smallJoker');
    if (rank === 11) return 'J';
    if (rank === 12) return 'Q';
    if (rank === 13) return 'K';
    if (rank === 14) return 'A';
    if (rank === 15) return '2';
    return String(rank);
  }

  var SUIT_CHAR = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' };

  /* ============================================================
   * 卡牌 DOM
   * ========================================================== */
  function cardNode(card, mini) {
    var d = document.createElement('div');
    d.className = 'card' + (mini ? ' card--mini' : '');

    if (card.rank >= 16) {
      d.className += ' card--joker' + (card.rank === 17 ? ' card--big' : '');
      d.innerHTML = '<span class="c-rank c-rank--joker">' + rankLabel(card.rank) + '</span>';
    } else {
      var red = card.suit === 'heart' || card.suit === 'diamond';
      if (red) d.className += ' card--red';
      d.innerHTML = '<span class="c-rank">' + rankLabel(card.rank) + '</span>' +
                    '<span class="c-suit">' + (SUIT_CHAR[card.suit] || '') + '</span>';
    }
    return d;
  }

  function backNode(mini) {
    var d = document.createElement('div');
    d.className = 'card card--back' + (mini ? ' card--mini' : '');
    return d;
  }

  /* ============================================================
   * 渲染
   * ========================================================== */
  function render() {
    renderSeats();
    renderCenter();
    renderHand();
    renderActions();
    renderBidBar();
    renderCounter();
    syncCurtain();
  }

  function syncCurtain() {
    if (G.curtainOpen) {
      el.curtainTitle.textContent = t('curtainTitle', { name: seatName(G.viewSeat) });
      el.curtainSub.textContent = t('curtainSub');
      el.curtainOk.textContent = t('curtainOk');
      el.curtain.classList.add('is-open');
    } else {
      el.curtain.classList.remove('is-open');
    }
  }

  function seatHtml(idx) {
    var s = G.seats[idx];
    var active = G.phase !== 'over' && G.turn === idx;
    var role = s.landlord ? t('landlord') : (G.landlord >= 0 ? t('farmer') : '');

    var bubble = '';
    if (s.passed) bubble = t('pass');
    else if (active && G.phase === 'bidding' && s.bid === 0) bubble = t('bidPass');
    else if (active && (isAI(idx) || isAuto(idx))) bubble = t('thinking');
    else if (active && G.phase === 'bidding' && s.bid > 0) bubble = fmtScore(s.bid);

    return {
      cls: 'seat' + (s.landlord ? ' is-landlord' : '') + (active ? ' is-active' : '') +
           (s.passed ? ' is-passed' : ''),
      html: '<div class="seat-avatar">' + (isAI(idx) ? '🤖' : '🙂') + '</div>' +
            '<div class="seat-name">' + seatName(idx) + '</div>' +
            (role ? '<div class="seat-role">' + role + '</div>' : '') +
            '<div class="seat-count">' + s.cards.length + '</div>' +
            (bubble ? '<div class="seat-bubble">' + bubble + '</div>' : '')
    };
  }

  function fmtScore(n) { return t('bidScore', { n: n }); }

  function renderSeats() {
    var v = G.viewSeat;
    ['left', 'right'].forEach(function (side) {
      var idx = side === 'left' ? (v + 2) % 3 : (v + 1) % 3;
      var node = el['seat_' + side];
      var info = seatHtml(idx);
      node.className = info.cls;
      node.innerHTML = info.html;
    });
  }

  function renderCenter() {
    var bb = el.bottomCards;
    bb.innerHTML = '';
    G.bottom.forEach(function (c) {
      bb.appendChild(G.revealBottom ? cardNode(c, true) : backNode(true));
    });

    el.playArea.innerHTML = '';
    if (G.last) {
      var wrap = document.createElement('div');
      wrap.className = 'play-wrap';
      var who = document.createElement('div');
      who.className = 'play-who';
      who.textContent = seatName(G.last.seat) + ' · ' + typeLabel(G.last.type);
      var row = document.createElement('div');
      row.className = 'play-cards';
      D.sortDesc(G.last.cards).forEach(function (c) { row.appendChild(cardNode(c, true)); });
      wrap.appendChild(who);
      wrap.appendChild(row);
      el.playArea.appendChild(wrap);
    }

    el.centerTip.textContent = centerTip();
  }

  function centerTip() {
    if (G.phase === 'bidding') {
      if (G.turn === G.viewSeat && !isAI(G.turn) && !isAuto(G.turn)) return t('bidYourTurn');
      return t('bidWaiting', { name: seatName(G.turn) });
    }
    if (G.phase === 'playing') {
      if (G.turn === G.viewSeat && !isAI(G.turn) && !isAuto(G.turn)) return t('yourTurn');
      return t('waiting', { name: seatName(G.turn) });
    }
    return '';
  }

  function renderHand() {
    var seat = G.viewSeat;
    var s = G.seats[seat];
    el.handName.textContent = seatName(seat);
    var role = s.landlord ? t('landlord') : (G.landlord >= 0 ? t('farmer') : '');
    el.handRole.textContent = role;
    el.handRole.style.visibility = role ? 'visible' : 'hidden';
    el.mult.textContent = t('mult', { n: G.multiplier });

    var hand = el.hand;
    hand.innerHTML = '';
    if (G.curtainOpen || !s) {
      hand.style.setProperty('--step', '0px');
      return;
    }

    var cards = D.sortDesc(s.cards);
    cards.forEach(function (c, i) {
      var node = cardNode(c, false);
      node.dataset.id = c.id;
      if (G.selected[c.id]) node.classList.add('is-selected');
      node.style.zIndex = G.selected[c.id] ? 1000 + i : i;
      node.addEventListener('click', onCardClick);
      hand.appendChild(node);
    });
    layoutHand();
  }

  function layoutHand() {
    var hand = el.hand;
    var nodes = hand.children;
    var n = nodes.length;
    if (n < 2) { hand.style.setProperty('--step', '0px'); return; }
    var cardW = nodes[0].offsetWidth || 62;
    var width = hand.clientWidth;
    var step = Math.min(cardW * 0.52, (width - cardW) / (n - 1));
    step = Math.max(cardW * 0.15, step);
    hand.style.setProperty('--step', step + 'px');
  }

  function selectedCards() {
    var s = G.seats[G.viewSeat];
    if (!s) return [];
    return s.cards.filter(function (c) { return G.selected[c.id]; });
  }

  function selectionPlay() {
    var cards = selectedCards();
    if (!cards.length) return null;
    var p = D.identify(cards);
    if (!p) return null;
    if (G.last && G.last.seat !== G.viewSeat && !D.canBeat(p, G.last)) return null;
    return p;
  }

  function myTurn() {
    return G.phase === 'playing' && G.turn === G.viewSeat &&
           !isAI(G.viewSeat) && !isAuto(G.viewSeat) && !G.curtainOpen;
  }

  function renderActions() {
    var turn = myTurn();
    var bidding = G.phase === 'bidding';
    el.btnPlay.style.display = bidding ? 'none' : '';
    el.btnHint.style.display = bidding ? 'none' : '';
    el.btnPass.style.display = bidding ? 'none' : '';
    el.btnPlay.disabled = !turn || !selectionPlay();
    el.btnPass.disabled = !turn || !G.last || G.last.seat === G.viewSeat;
    el.btnHint.disabled = !turn;
    el.btnAuto.textContent = G.auto[G.viewSeat] ? t('autoOff') : t('autoBtn');
    el.btnAuto.classList.toggle('is-on', !!G.auto[G.viewSeat]);
  }

  function renderBidBar() {
    var show = G.phase === 'bidding' && G.turn === G.viewSeat &&
               !isAI(G.viewSeat) && !isAuto(G.viewSeat) && !G.curtainOpen;
    el.bidBar.innerHTML = '';
    el.bidBar.style.display = show ? 'flex' : 'none';
    if (!show) return;

    [0, 1, 2, 3].forEach(function (score) {
      var b = document.createElement('button');
      b.className = 'pg-btn' + (score === 0 ? ' pg-btn--ghost' : '');
      b.textContent = score === 0 ? t('bidPass') : fmtScore(score);
      b.disabled = score !== 0 && score <= G.bid.highest;
      b.addEventListener('click', function () { applyBid(G.viewSeat, score); });
      el.bidBar.appendChild(b);
    });
  }

  var COUNTER_RANKS = [17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3];

  function renderCounter() {
    if (!G.showCounter) { el.counter.style.display = 'none'; return; }
    el.counter.style.display = 'flex';
    var s = G.seats[G.viewSeat];
    var mine = s ? D.rankCounts(s.cards) : {};

    el.counter.innerHTML = '';
    var label = document.createElement('span');
    label.className = 'counter-label';
    label.textContent = t('counterTitle');
    el.counter.appendChild(label);

    COUNTER_RANKS.forEach(function (r) {
      var left = D.totalOf(r) - (G.played[r] || 0) - (mine[r] || 0);
      if (left <= 0) return;
      var b = document.createElement('span');
      b.className = 'counter-item' + (r >= 15 ? ' is-big' : '');
      b.innerHTML = '<b>' + rankLabel(r) + '</b><span>×' + left + '</span>';
      el.counter.appendChild(b);
    });
  }

  function applyText() {
    document.querySelectorAll('[data-t]').forEach(function (node) {
      node.textContent = t(node.dataset.t);
    });
    el.btnPass.textContent = t('pass');
    el.btnHint.textContent = t('hint');
    el.btnPlay.textContent = t('play');
    el.btnRestart.textContent = t('restart');
    el.btnMode.textContent = t('modeBtn');
    el.btnCounter.textContent = t('counterBtn');
    el.langBadge.textContent = GamePlatform.i18n.getLang() === 'en' ? 'EN' : '中文';
    document.title = GamePlatform.i18n.t({
      zh: '斗地主 · Potato4096 Arcade',
      en: 'Dou Dizhu · Potato4096 Arcade'
    });
    renderActions();
  }

  /* ============================================================
   * 对局流程
   * ========================================================== */
  function buildParts(mode) {
    return MODES[mode].map(function (p) { return { ai: p.ai, key: p.key }; });
  }

  function rotateParts() {
    var first = G.parts.shift();
    G.parts.push(first);
  }

  function newRound() {
    G.token++;
    if (G.aiTimer) { clearTimeout(G.aiTimer); G.aiTimer = null; }

    if (humanCount() > 1) rotateParts();

    var d = D.deal();
    G.seats = [0, 1, 2].map(function (i) {
      return { cards: D.sortDesc(d.hands[i]), landlord: false, passed: false, plays: 0, bid: null };
    });
    G.bottom = d.bottom;
    G.landlord = -1;
    G.last = null;
    G.passCount = 0;
    G.multiplier = 1;
    G.base = 1;
    G.revealBottom = false;
    G.selected = {};
    G.hintList = [];
    G.hintIdx = -1;
    G.played = {};
    G.phase = 'bidding';
    G.bid = { highest: 0, best: -1, count: 0 };
    G.curtainOpen = false;
    G.auto = [false, false, false];
    G.turn = G.roundIndex % 3;
    G.roundIndex++;
    G.viewSeat = isAI(G.turn) ? firstHuman() : G.turn;

    el.overlay.classList.remove('is-open');
    setTurnUI();
  }

  function setTurnUI() {
    var seat = G.turn;
    if (!isAI(seat) && !isAuto(seat)) {
      if (G.viewSeat !== seat) {
        G.viewSeat = seat;
        if (humanCount() > 1) G.curtainOpen = true;
      }
    }
    render();
    scheduleAI();
  }

  function scheduleAI() {
    if (G.aiTimer) { clearTimeout(G.aiTimer); G.aiTimer = null; }
    if (G.phase === 'over') return;
    var seat = G.turn;
    if (!isAI(seat) && !isAuto(seat)) return;
    if (G.curtainOpen) return;

    var token = G.token;
    G.aiTimer = setTimeout(function () {
      if (token !== G.token) return;
      if (G.phase === 'bidding') aiBid(seat);
      else if (G.phase === 'playing') aiPlay(seat);
    }, 650 + Math.random() * 550);
  }

  function aiBid(seat) {
    if (G.phase !== 'bidding' || G.turn !== seat) return;
    var score = AI.bid(G.seats[seat].cards, G.difficulty, G.bid.highest);
    applyBid(seat, score);
  }

  function applyBid(seat, score) {
    if (G.phase !== 'bidding' || G.turn !== seat) return;
    G.seats[seat].bid = score;
    G.bid.count++;
    if (score > G.bid.highest) {
      G.bid.highest = score;
      G.bid.best = seat;
      sfxBid();
    }
    render();

    if (score === 3 || G.bid.count >= 3) {
      setTimeout(finishBidding, 480);
      return;
    }
    G.turn = (seat + 1) % 3;
    setTurnUI();
  }

  function finishBidding() {
    if (G.phase !== 'bidding') return;
    if (G.bid.best < 0) {
      toast(t('allPass'));
      setTimeout(function () { if (G.phase === 'bidding') newRound(); }, 950);
      return;
    }

    G.landlord = G.bid.best;
    G.seats[G.landlord].landlord = true;
    G.seats[G.landlord].cards = D.sortDesc(G.seats[G.landlord].cards.concat(G.bottom));
    G.revealBottom = true;
    G.base = G.bid.highest;
    G.multiplier = G.bid.highest;
    G.phase = 'playing';
    G.turn = G.landlord;
    G.last = null;
    G.passCount = 0;

    toast(t('becameLandlord', {
      name: seatName(G.landlord),
      n: G.bid.highest
    }));
    sfxWin();

    if (isAI(G.turn)) {
      render();
      scheduleAI();
    } else {
      setTurnUI();
    }
  }

  function aiPlay(seat) {
    if (G.phase !== 'playing' || G.turn !== seat) return;
    var hand = G.seats[seat].cards;
    var ctxLast = (G.last && G.last.seat !== seat) ? G.last : null;

    var cards = AI.choose({
      hand: hand,
      last: ctxLast,
      lastSeat: G.last ? G.last.seat : -1,
      mySeat: seat,
      landlord: G.landlord,
      counts: G.seats.map(function (s) { return s.cards.length; }),
      difficulty: G.difficulty
    });

    if (cards && cards.length && doPlay(seat, cards)) return;
    if (doPassAction(seat)) return;

    /* 兜底：任何情况下都不能让轮次停住 */
    var cands = D.findPlays(hand, ctxLast);
    if (cands.length) {
      if (doPlay(seat, cands[0])) return;
    }
    G.last = null;
    G.passCount = 0;
    if (hand.length) doPlay(seat, [hand[0]]);
  }

  function doPlay(seat, cards) {
    var play = D.identify(cards);
    if (!play) return false;

    var s = G.seats[seat];
    s.cards = D.remove(s.cards, cards);
    s.plays++;
    G.seats.forEach(function (x) { x.passed = false; });

    G.last = { seat: seat, cards: cards, type: play.type, main: play.main, len: play.len };
    G.passCount = 0;
    cards.forEach(function (c) { G.played[c.rank] = (G.played[c.rank] || 0) + 1; });

    if (play.type === T.BOMB || play.type === T.ROCKET) {
      G.multiplier *= 2;
      sfxBomb();
    } else {
      sfxPlay();
    }

    G.selected = {};
    G.hintList = [];
    G.hintIdx = -1;

    if (!s.cards.length) {
      render();
      endRound(seat);
      return true;
    }

    G.turn = (seat + 1) % 3;
    setTurnUI();
    return true;
  }

  function doPassAction(seat) {
    if (!G.last || G.last.seat === seat) return false;

    G.seats[seat].passed = true;
    G.passCount++;
    sfxPass();

    if (G.passCount >= 2) {
      G.last = null;
      G.passCount = 0;
      G.seats.forEach(function (x) { x.passed = false; });
    }

    G.turn = (seat + 1) % 3;
    setTurnUI();
    return true;
  }

  function endRound(winner) {
    G.phase = 'over';
    if (G.aiTimer) { clearTimeout(G.aiTimer); G.aiTimer = null; }

    var landlordWin = winner === G.landlord;
    var spring = false;

    if (landlordWin) {
      spring = G.seats.every(function (x, i) { return i === G.landlord || x.plays === 0; });
    } else {
      spring = G.seats[G.landlord].plays <= 1;
    }
    if (spring) G.multiplier *= 2;

    var viewerWon = landlordWin ? (G.landlord === G.viewSeat) : (G.landlord !== G.viewSeat);
    if (viewerWon) sfxWin(); else sfxLose();

    saveStats(landlordWin, viewerWon);
    render();
    setTimeout(function () { showResult(landlordWin, spring); }, 480);
  }

  /* ============================================================
   * 存档
   * ========================================================== */
  function loadData() {
    var prefs = GamePlatform.storage.get('prefs', null);
    if (prefs) {
      if (prefs.mode && MODES[prefs.mode]) G.mode = prefs.mode;
      if (prefs.difficulty) G.difficulty = prefs.difficulty;
      if (typeof prefs.showCounter === 'boolean') G.showCounter = prefs.showCounter;
    }
    var st = GamePlatform.storage.get('stats', null);
    if (st) {
      G.stats = {
        games: st.games || 0,
        lw: st.lw || 0,
        fw: st.fw || 0,
        best: st.best || 0,
        streak: st.streak || 0
      };
    }
    return !!prefs;
  }

  function savePrefs() {
    GamePlatform.storage.set('prefs', {
      mode: G.mode,
      difficulty: G.difficulty,
      showCounter: G.showCounter
    });
  }

  function saveStats(landlordWin, viewerWon) {
    var st = G.stats;
    st.games++;
    if (landlordWin) st.lw++; else st.fw++;
    if (G.multiplier > st.best) st.best = G.multiplier;
    if (G.mode === 'solo') st.streak = viewerWon ? (st.streak || 0) + 1 : 0;
    GamePlatform.storage.set('stats', st);
  }

  /* ============================================================
   * 浮层
   * ========================================================== */
  function showModeOverlay() {
    el.overlayTitle.textContent = t('chooseMode');
    var body = el.overlayBody;
    body.innerHTML = '';

    Object.keys(MODES).forEach(function (id) {
      var b = document.createElement('button');
      b.className = 'mode-opt' + (G.mode === id ? ' is-current' : '');
      b.innerHTML = '<b>' + t('mode' + id.charAt(0).toUpperCase() + id.slice(1)) + '</b>' +
                    '<span>' + t('mode' + id.charAt(0).toUpperCase() + id.slice(1) + 'Sub') + '</span>';
      b.addEventListener('click', function () {
        el.overlay.classList.remove('is-open');
        if (G.mode !== id) { G.mode = id; G.parts = buildParts(id); savePrefs(); G.roundIndex = 0; newRound(); }
      });
      body.appendChild(b);
    });

    var dTitle = document.createElement('div');
    dTitle.className = 'sub-title';
    dTitle.textContent = t('difficulty');
    body.appendChild(dTitle);

    var row = document.createElement('div');
    row.className = 'diff-row';
    [['easy', 'diffEasy'], ['medium', 'diffMedium'], ['hard', 'diffHard']].forEach(function (d) {
      var b = document.createElement('button');
      b.className = 'pg-btn' + (G.difficulty === d[0] ? '' : ' pg-btn--ghost');
      b.textContent = t(d[1]);
      b.addEventListener('click', function () {
        G.difficulty = d[0];
        savePrefs();
        showModeOverlay();
      });
      row.appendChild(b);
    });
    body.appendChild(row);

    var stats = document.createElement('p');
    stats.className = 'stats-line pg-muted';
    stats.textContent = t('statsLine', {
      games: G.stats.games, lw: G.stats.lw, fw: G.stats.fw
    }) + ' · ' + t('streakLine', { n: G.stats.streak || 0, best: G.stats.best || 0 });
    body.appendChild(stats);

    var clear = document.createElement('button');
    clear.className = 'pg-btn pg-btn--ghost clear-btn';
    clear.textContent = t('clearStats');
    clear.addEventListener('click', function () {
      G.stats = { games: 0, lw: 0, fw: 0, best: 0, streak: 0 };
      GamePlatform.storage.set('stats', G.stats);
      toast(t('cleared'));
      showModeOverlay();
    });
    body.appendChild(clear);

    el.overlay.classList.add('is-open');
  }

  function showResult(landlordWin, spring) {
    el.overlayTitle.textContent = landlordWin ? t('landlordWin') : t('farmerWin');
    var body = el.overlayBody;
    body.innerHTML = '';

    var line = document.createElement('p');
    line.className = 'result-line';
    line.textContent = t('mult', { n: G.multiplier }) + (spring ? ' · ' + t('spring') : '');
    body.appendChild(line);

    var again = document.createElement('button');
    again.className = 'pg-btn';
    again.textContent = t('nextRound');
    again.addEventListener('click', function () {
      el.overlay.classList.remove('is-open');
      newRound();
    });
    body.appendChild(again);

    el.overlay.classList.add('is-open');
  }

  /* ============================================================
   * 交互
   * ========================================================== */
  function onCardClick(e) {
    if (!myTurn()) return;
    var node = e.currentTarget;
    var id = Number(node.dataset.id);
    var i = Array.prototype.indexOf.call(el.hand.children, node);
    if (G.selected[id]) delete G.selected[id];
    else G.selected[id] = true;
    node.classList.toggle('is-selected');
    node.style.zIndex = G.selected[id] ? 1100 : i;
    sfxSelect();
    renderActions();
  }

  function onPlayClick() {
    if (!myTurn()) return;
    var cards = selectedCards();
    if (!cards.length) { toast(t('noSelect')); return; }
    var p = D.identify(cards);
    if (!p) { toast(t('badPlay')); return; }
    if (G.last && G.last.seat !== G.viewSeat && !D.canBeat(p, G.last)) {
      toast(t('cannotBeat'));
      return;
    }
    doPlay(G.viewSeat, cards);
  }

  function onPassClick() {
    if (!myTurn()) return;
    if (!G.last || G.last.seat === G.viewSeat) { toast(t('cannotPass')); return; }
    G.selected = {};
    doPassAction(G.viewSeat);
  }

  function onHintClick() {
    if (!myTurn()) return;
    var hand = G.seats[G.viewSeat].cards;

    if (!G.hintList.length) {
      G.hintList = D.findPlays(hand, G.last && G.last.seat !== G.viewSeat ? G.last : null);
      G.hintList.sort(function (a, b) {
        var pa = D.identify(a), pb = D.identify(b);
        if (pa.main !== pb.main) return pa.main - pb.main;
        return a.length - b.length;
      });
      G.hintIdx = -1;
    }

    if (!G.hintList.length) { toast(t('cannotBeat')); return; }

    G.hintIdx = (G.hintIdx + 1) % G.hintList.length;
    var pick = G.hintList[G.hintIdx];
    G.selected = {};
    pick.forEach(function (c) { G.selected[c.id] = true; });
    sfxSelect();
    render();
  }

  function onAutoClick() {
    var v = G.viewSeat;
    if (isAI(v)) return;
    G.auto[v] = !G.auto[v];
    G.curtainOpen = false;
    render();
    scheduleAI();
  }

  function onCurtainOk() {
    G.curtainOpen = false;
    render();
    scheduleAI();
  }

  /* ============================================================
   * 初始化
   * ========================================================== */
  function init() {
    el = {
      seat_left: document.getElementById('seat-left'),
      seat_right: document.getElementById('seat-right'),
      hand: document.getElementById('hand'),
      handName: document.getElementById('hand-name'),
      handRole: document.getElementById('hand-role'),
      mult: document.getElementById('mult-badge'),
      bottomCards: document.getElementById('bottom-cards'),
      playArea: document.getElementById('play-area'),
      centerTip: document.getElementById('center-tip'),
      counter: document.getElementById('counter-strip'),
      btnPlay: document.getElementById('btn-play'),
      btnPass: document.getElementById('btn-pass'),
      btnHint: document.getElementById('btn-hint'),
      btnRestart: document.getElementById('btn-restart'),
      btnMode: document.getElementById('btn-mode'),
      btnCounter: document.getElementById('btn-counter'),
      btnAuto: document.getElementById('btn-auto'),
      btnBack: document.getElementById('btn-back'),
      langBadge: document.getElementById('lang-badge'),
      bidBar: document.getElementById('bid-bar'),
      overlay: document.getElementById('overlay'),
      overlayTitle: document.getElementById('overlay-title'),
      overlayBody: document.getElementById('overlay-body'),
      curtain: document.getElementById('curtain'),
      curtainTitle: document.getElementById('curtain-title'),
      curtainSub: document.getElementById('curtain-sub'),
      curtainOk: document.getElementById('curtain-ok')
    };

    var hadPrefs = loadData();
    if (!G.parts.length) G.parts = buildParts(G.mode);

    el.btnBack.addEventListener('click', function () { GamePlatform.navigate.goHome(); });
    el.btnPlay.addEventListener('click', onPlayClick);
    el.btnPass.addEventListener('click', onPassClick);
    el.btnHint.addEventListener('click', onHintClick);
    el.btnAuto.addEventListener('click', onAutoClick);
    el.btnRestart.addEventListener('click', function () { newRound(); });
    el.btnMode.addEventListener('click', showModeOverlay);
    el.btnCounter.addEventListener('click', function () {
      G.showCounter = !G.showCounter;
      savePrefs();
      render();
    });
    el.curtainOk.addEventListener('click', onCurtainOk);

    GamePlatform.settings.onChange(function () { applyText(); render(); });

    window.addEventListener('resize', layoutHand);

    applyText();
    newRound();

    if (!hadPrefs) setTimeout(showModeOverlay, 260);
  }

  GamePlatform.ready.then(init);
})();
