/**
 * games/ludo/js/view.js - 飞行棋对局视图
 *
 * 规则（Ludo）与 AI（LudoAI）是纯逻辑模块，这里只负责对局流程、
 * 画布绘制与交互。支持四人轮流（pvp）或你执红对三家电脑（ai）。
 */
(function (global) {
  'use strict';

  var BG = global.BG;
  var i18n = BG.i18n;

  /* ---------------- 尺寸 ---------------- */
  var PAD = 18;
  var CELL = 38;
  var N = 15;

  /* ---------------- 配色 ---------------- */
  var COLORS = {
    light: {
      bg: '#f2e9d6',
      cell: '#ffffff',
      line: '#c9b58e',
      hub: '#8a6a42',
      text: '#6b4a2f'
    },
    dark: {
      bg: '#4c3d29',
      cell: '#5d4b33',
      line: '#2f2317',
      hub: '#241a10',
      text: '#c8a97c'
    }
  };
  var PCOLORS = ['#e2483c', '#e8b12c', '#2f7de0', '#2fae5e'];
  var PCOLORS_DARK = ['#ff6b5e', '#ffd15c', '#6aa8ff', '#5ed98c'];

  /* ---------------- 棋种词条 ---------------- */
  i18n.register('ludo', {
    zh: {
      hint: '点「掷骰子」，6 点起飞；同色格连跳、撞回敌机，四机到齐者胜',
      turn: '{c}行动',
      win: '{c}获胜',
      roll: '掷骰子',
      pickPlane: '点一架高亮的飞机移动',
      noMove: '没有可走的飞机，换下家',
      threeSixes: '连续三个 6，本回合作废',
      againSix: '掷出 6，再走一次',
      againHit: '撞回敌机，再走一次',
      statRed: '红方胜',
      statYellow: '黄方胜',
      statBlue: '蓝方胜',
      statGreen: '绿方胜',
      cRed: '红方',
      cYellow: '黄方',
      cBlue: '蓝方',
      cGreen: '绿方',
      aiWith: '电脑·{c}',
      planeNo: '{c}{n}号',
      takeoff: '起飞',
      jump: '跳',
      hit: '撞机',
      reach: '到达终点',
      finishedCount: '{n}/4 到达'
    },
    en: {
      hint: 'Tap "Roll". Roll a 6 to take off; jump on your own colour and bump rivals home. First to land all four wins.',
      turn: '{c} to play',
      win: '{c} wins',
      roll: 'Roll',
      pickPlane: 'Tap a highlighted plane',
      noMove: 'No plane can move — turn skipped',
      threeSixes: 'Three sixes in a row — turn forfeited',
      againSix: 'Rolled a 6 — go again',
      againHit: 'Bumped a rival — go again',
      statRed: 'Red wins',
      statYellow: 'Yellow wins',
      statBlue: 'Blue wins',
      statGreen: 'Green wins',
      cRed: 'Red',
      cYellow: 'Yellow',
      cBlue: 'Blue',
      cGreen: 'Green',
      aiWith: 'AI·{c}',
      planeNo: '{c}-{n}',
      takeoff: 'takeoff',
      jump: 'jump',
      hit: 'bump',
      reach: 'landed',
      finishedCount: '{n}/4 landed'
    }
  });

  /* ---------------- 对局状态 ---------------- */
  var L = null;
  var AI = null;
  var W = 600;
  var H = 600;

  var state = null;
  var history = [];
  var phase = 'idle';         // idle = 等掷骰 / pick = 等选飞机
  var pendingOptions = [];
  var hoverPlane = -1;
  var recorded = false;

  var mode = 'pvp';
  var difficulty = 'medium';
  var aiThinking = false;
  var gameToken = 0;
  var aiTimer = null;
  var diceTimer = null;

  var root = null;
  var canvas = null;
  var ctx = null;
  var ui = null;
  var alive = false;

  var GAME_ID = 'ludo';
  var KEYS = { stats: 'stats', session: 'session' };

  /* ---------------- 工具 ---------------- */
  function palette() {
    var theme = 'light';
    try {
      theme = global.GamePlatform ? GamePlatform.theme.get() : 'light';
    } catch (e) { /* 浅色 */ }
    return COLORS[theme] || COLORS.light;
  }
  function pcolors() {
    var theme = 'light';
    try {
      theme = global.GamePlatform ? GamePlatform.theme.get() : 'light';
    } catch (e) { /* 浅色 */ }
    return theme === 'dark' ? PCOLORS_DARK : PCOLORS;
  }

  function gridPx(x, y) {
    return {
      px: PAD + x * CELL + CELL / 2,
      py: PAD + y * CELL + CELL / 2
    };
  }

  function pointToGrid(clientX, clientY) {
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var lx = (clientX - rect.left) * (W / rect.width);
    var ly = (clientY - rect.top) * (H / rect.height);
    var gx = Math.floor((lx - PAD) / CELL);
    var gy = Math.floor((ly - PAD) / CELL);
    if (gx < 0 || gy < 0 || gx >= N || gy >= N) return null;
    return { x: gx, y: gy };
  }

  function colorKey(c) {
    return ['cRed', 'cYellow', 'cBlue', 'cGreen'][c];
  }

  function sideName(c) {
    if (mode === 'ai') {
      return c === L.RED
        ? i18n.t('you')
        : i18n.fmt('aiWith', { c: i18n.t(colorKey(c)) });
    }
    return i18n.t(colorKey(c));
  }

  function planeLabel(c, idx) {
    return i18n.fmt('planeNo', { c: i18n.t(colorKey(c)), n: idx + 1 });
  }

  function diffKey() {
    return difficulty === 'easy' ? 'diffEasy' : difficulty === 'hard' ? 'diffHard' : 'diffMedium';
  }

  function modeText() {
    return mode === 'ai' ? i18n.fmt('modeAiFull', { diff: i18n.t(diffKey()) }) : i18n.t('modePvp');
  }

  function isHumanTurn() {
    return mode === 'pvp' || state.turn === L.RED;
  }

  function canAct() {
    return alive && !cheatGod && state && !state.over &&
      phase === 'idle' && isHumanTurn() && !aiThinking;
  }

  /* ---------------- 绘制 ---------------- */
  function render() {
    if (!alive || !ctx || !state) return;
    ctx = BG.canvas.fit(canvas, ctx, W, H);
    var c = palette();
    var pc = pcolors();
    ctx.clearRect(0, 0, W, H);

    // 底
    ctx.fillStyle = c.bg;
    BG.canvas.roundRect(ctx, 0, 0, W, H, 10);
    ctx.fill();

    drawHangars(c, pc);
    drawTrack(c, pc);
    drawCenter(pc);
    drawPlanes(c, pc);
    drawDiceHint(c);
  }

  function cellRect(x, y) {
    return {
      x: PAD + x * CELL + 1.5,
      y: PAD + y * CELL + 1.5,
      w: CELL - 3,
      h: CELL - 3
    };
  }

  function drawHangars(c, pc) {
    var corners = [
      { x: 0, y: 9, color: L.RED },
      { x: 0, y: 0, color: L.YELLOW },
      { x: 9, y: 0, color: L.BLUE },
      { x: 9, y: 9, color: L.GREEN }
    ];
    for (var i = 0; i < corners.length; i++) {
      var q = corners[i];
      var r = cellRect(q.x, q.y);
      var full = {
        x: r.x, y: r.y,
        w: CELL * 6 - 3, h: CELL * 6 - 3
      };
      ctx.fillStyle = pc[q.color];
      ctx.globalAlpha = 0.30;
      BG.canvas.roundRect(ctx, full.x, full.y, full.w, full.h, 10);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pc[q.color];
      ctx.lineWidth = 2;
      BG.canvas.roundRect(ctx, full.x, full.y, full.w, full.h, 10);
      ctx.stroke();

      // 停机位
      for (var k = 0; k < 4; k++) {
        var h = L.HANGAR[q.color][k];
        var p = gridPx(h[0], h[1]);
        ctx.beginPath();
        ctx.arc(p.px, p.py, CELL * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fill();
        ctx.strokeStyle = pc[q.color];
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }
  }

  function drawTrack(c, pc) {
    var i, p, r;

    // 主跑道 52 格（按颜色着色）
    for (i = 0; i < L.PATH.length; i++) {
      r = cellRect(L.PATH[i][0], L.PATH[i][1]);
      ctx.fillStyle = pc[i % 4];
      ctx.globalAlpha = 0.22;
      BG.canvas.roundRect(ctx, r.x, r.y, r.w, r.h, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.line;
      ctx.lineWidth = 1;
      BG.canvas.roundRect(ctx, r.x, r.y, r.w, r.h, 5);
      ctx.stroke();
    }

    // 起点格加深
    for (var s = 0; s < 4; s++) {
      var st = L.PATH[L.START[s]];
      r = cellRect(st[0], st[1]);
      ctx.fillStyle = pc[s];
      ctx.globalAlpha = 0.55;
      BG.canvas.roundRect(ctx, r.x, r.y, r.w, r.h, 5);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 终点道
    for (var col = 0; col < 4; col++) {
      for (i = 0; i < 6; i++) {
        var hp = L.HOME_PATH[col][i];
        r = cellRect(hp[0], hp[1]);
        ctx.fillStyle = pc[col];
        ctx.globalAlpha = 0.28 + i * 0.10;
        BG.canvas.roundRect(ctx, r.x, r.y, r.w, r.h, 5);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = c.line;
        ctx.lineWidth = 1;
        BG.canvas.roundRect(ctx, r.x, r.y, r.w, r.h, 5);
        ctx.stroke();
      }
    }
  }

  function drawCenter(pc) {
    var cx = PAD + 7 * CELL + CELL / 2;
    var cy = PAD + 7 * CELL + CELL / 2;
    var s = CELL * 1.5;
    // 四色三角：红下、黄左、蓝上、绿右
    var tris = [
      { pts: [[-s, s], [s, s], [0, 0]], c: L.RED },
      { pts: [[-s, -s], [-s, s], [0, 0]], c: L.YELLOW },
      { pts: [[-s, -s], [s, -s], [0, 0]], c: L.BLUE },
      { pts: [[s, -s], [s, s], [0, 0]], c: L.GREEN }
    ];
    for (var i = 0; i < tris.length; i++) {
      var t = tris[i];
      ctx.beginPath();
      ctx.moveTo(cx + t.pts[0][0], cy + t.pts[0][1]);
      ctx.lineTo(cx + t.pts[1][0], cy + t.pts[1][1]);
      ctx.lineTo(cx + t.pts[2][0], cy + t.pts[2][1]);
      ctx.closePath();
      ctx.fillStyle = pc[t.c];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /** 飞机所在像素坐标（同格多架自动偏移） */
  function planePos(color, idx) {
    var rel = state.planes[color][idx];
    var g = L.coordOf(color, rel, idx);
    var p = gridPx(g.x, g.y);
    // 同格堆叠偏移
    var stack = 0;
    for (var c = 0; c < 4; c++) {
      for (var k = 0; k < 4; k++) {
        if (c === color && k === idx) return offsetPos(p, stack, color, idx);
        var q = L.coordOf(c, state.planes[c][k], k);
        if (q.x === g.x && q.y === g.y) stack++;
      }
    }
    return offsetPos(p, stack, color, idx);
  }

  function offsetPos(p, stack, color, idx) {
    if (stack <= 0) return p;
    var o = (stack - 1) * 5;
    return { px: p.px + o - 5, py: p.py + o - 5 };
  }

  function drawPlanes(c, pc) {
    for (var color = 0; color < 4; color++) {
      for (var idx = 0; idx < 4; idx++) {
        var rel = state.planes[color][idx];
        var p = planePos(color, idx);
        var r = CELL * 0.36;

        // 高亮（等待选择）
        var pickable = phase === 'pick' && color === state.turn &&
          pendingOptions.indexOf(idx) >= 0;
        if (pickable) {
          ctx.beginPath();
          ctx.arc(p.px, p.py, r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff17a';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.px, p.py, r + 7, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 220, 60, 0.55)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        if (hoverPlane === idx && pickable) {
          ctx.beginPath();
          ctx.arc(p.px, p.py, r + 10, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // 飞机
        ctx.beginPath();
        ctx.arc(p.px + 1, p.py + 2, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.20)';
        ctx.fill();

        var grd = ctx.createRadialGradient(p.px - r * 0.4, p.py - r * 0.45, r * 0.15, p.px, p.py, r);
        grd.addColorStop(0, lighten(pc[color], 0.45));
        grd.addColorStop(0.6, pc[color]);
        grd.addColorStop(1, darken(pc[color], 0.28));
        ctx.beginPath();
        ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        // 机标
        ctx.font = Math.round(CELL * 0.36) + 'px "Segoe UI Symbol", "Segoe UI Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillText('✈', p.px, p.py + 1);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';

        if (rel === L.FINISH) {
          ctx.beginPath();
          ctx.arc(p.px, p.py, r + 2, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }
    }
  }

  function lighten(hex, amt) { return mix(hex, '#ffffff', amt); }
  function darken(hex, amt) { return mix(hex, '#000000', amt); }
  function mix(hex, target, amt) {
    var h = hex.replace('#', '');
    var t = target.replace('#', '');
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    var tr = parseInt(t.slice(0, 2), 16);
    var tg = parseInt(t.slice(2, 4), 16);
    var tb = parseInt(t.slice(4, 6), 16);
    r = Math.round(r + (tr - r) * amt);
    g = Math.round(g + (tg - g) * amt);
    b = Math.round(b + (tb - b) * amt);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawDiceHint(c) {
    // 棋盘内提示当前行动方（小圆点）
    var color = state.turn;
    var p = gridPx(7, 7);
    ctx.beginPath();
    ctx.arc(p.px, p.py, 5, 0, Math.PI * 2);
    ctx.fillStyle = pcolors()[color];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ---------------- 状态文本 ---------------- */
  function statusText() {
    if (state.over) {
      if (mode === 'ai') {
        return state.winner === L.RED ? i18n.t('youWin') : i18n.t('aiWins');
      }
      return i18n.fmt('win', { c: sideName(state.winner) });
    }
    if (cheatGod) return i18n.t('frozen');
    if (aiThinking || (mode === 'ai' && !isHumanTurn())) return i18n.t('thinking');
    if (phase === 'pick') return i18n.t('pickPlane');
    return i18n.fmt('turn', { c: sideName(state.turn) });
  }

  function updateStatus() {
    if (!ui) return;
    ui.setStatus(statusText());
    ui.setMode(modeText());
    if (state.over) ui.setDot('is-win');
    else if (aiThinking || (mode === 'ai' && !isHumanTurn())) ui.setDot('is-thinking');
    else ui.setDot(['is-red', 'is-white', 'is-black', 'is-draw'][state.turn]);

    // 骰子面
    var face = ui.q('.bg-dice-face');
    if (face) {
      face.textContent = state.diceRolled && state.dice ? String(state.dice) : '-';
    }
    var btn = ui.q('.bg-dice-btn');
    if (btn) btn.disabled = !canAct();
  }

  function renderMoves() {
    if (!ui) return;
    if (!history.length) {
      ui.emptyMoves();
      return;
    }
    var rows = [];
    for (var i = 0; i < history.length; i += 2) {
      var no = Math.floor(i / 2) + 1;
      rows.push('<div class="bg-move-row"><span class="bg-move-no">' + no + '.</span>' +
        '<span>' + moveText(history[i]) + '</span><span>' + moveText(history[i + 1]) + '</span></div>');
    }
    ui.setMoves(rows.join(''));
  }

  function moveText(h) {
    if (!h) return '';
    var s = h.label;
    if (h.takeoff) s += ' ' + i18n.t('takeoff');
    else if (h.reach) s += ' ' + i18n.t('reach');
    else s += ' +' + h.dice;
    if (h.jump) s += ' ' + i18n.t('jump');
    if (h.hit) s += ' ' + i18n.t('hit');
    return s;
  }

  function renderStats() {
    if (!ui) return;
    var s = BG.store.get(GAME_ID, KEYS.stats, {});
    ui.setStats({
      red: s.red || 0,
      yellow: s.yellow || 0,
      blue: s.blue || 0,
      green: s.green || 0
    });
  }

  /* ---------------- 流程 ---------------- */
  function setDiceFace(v) {
    var face = ui && ui.q('.bg-dice-face');
    if (face) face.textContent = String(v);
  }

  function doRoll(byAi) {
    var token = gameToken;
    var steps = reduceMotionSafe() ? 1 : 8;
    var i = 0;
    if (diceTimer) clearInterval(diceTimer);
    aiThinking = byAi ? aiThinking : aiThinking;
    updateStatus();

    diceTimer = setInterval(function () {
      if (token !== gameToken) { clearInterval(diceTimer); diceTimer = null; return; }
      setDiceFace(1 + Math.floor(Math.random() * 6));
      if (++i >= steps) {
        clearInterval(diceTimer);
        diceTimer = null;
        resolveRoll(byAi);
      }
    }, steps === 1 ? 10 : 55);
  }

  function reduceMotionSafe() {
    try {
      return !!(global.GamePlatform && GamePlatform.ui && GamePlatform.ui.shouldReduceMotion());
    } catch (e) { return false; }
  }

  function resolveRoll(byAi) {
    if (!state || state.over) return;
    var dice = L.rollDice();
    state.dice = dice;
    state.sixStreak = dice === 6 ? (state.sixStreak + 1) : 0;
    setDiceFace(dice);
    BG.sfx.select();

    if (state.sixStreak >= 3) {
      ui.toast(i18n.t('threeSixes'));
      state.sixStreak = 0;
      state.diceRolled = false;
      endTurn();
      return;
    }

    state.diceRolled = true;
    var options = L.legalPlanes(state, state.turn, dice);

    if (!options.length) {
      pendingOptions = [];
      phase = 'idle';
      updateStatus();
      saveGame();
      setTimeout(function () {
        if (alive && !state.over) {
          ui.toast(i18n.t('noMove'));
          endTurn();
        }
      }, 550);
      return;
    }

    pendingOptions = options;

    if (options.length === 1) {
      phase = 'idle';
      setTimeout(function () {
        if (alive && !state.over && gameToken === tokenSafe()) commitMove(options[0], false);
      }, 320);
      return;
    }

    if (byAi || !isHumanTurn()) {
      phase = 'idle';
      updateStatus();
      var pick = AI.choose(state, state.turn, dice, { difficulty: difficulty });
      setTimeout(function () {
        if (alive && !state.over) commitMove(pick, true);
      }, 380);
      return;
    }

    phase = 'pick';
    updateStatus();
    render();
  }

  function tokenSafe() { return gameToken; }

  function commitMove(idx, byAi) {
    if (!state || state.over) return;
    if (idx < 0 || idx > 3) { endTurn(); return; }
    var color = state.turn;
    var dice = state.dice;
    var r = L.applyMove(state, color, dice, idx);
    if (!r) { endTurn(); return; }

    history.push({
      label: planeLabel(color, idx),
      dice: dice,
      takeoff: r.takeoff,
      jump: r.jumped,
      hit: r.captured.length > 0,
      reach: r.finished
    });

    if (r.captured.length) BG.sfx.place(420);
    else BG.sfx.stone();

    pendingOptions = [];
    phase = 'idle';
    hoverPlane = -1;

    if (state.over) {
      if (!recorded) {
        BG.store.bump(GAME_ID, KEYS.stats, L.COLOR_NAMES[state.winner], 1);
        recorded = true;
      }
      if (mode === 'ai' && state.winner !== L.RED) BG.sfx.lose();
      else BG.sfx.win();
      ui.toast(i18n.fmt('win', { c: sideName(state.winner) }));
      render();
      renderMoves();
      renderStats();
      updateStatus();
      saveGame();
      return;
    }

    render();
    renderMoves();
    updateStatus();
    saveGame();

    if (r.extraTurn) {
      ui.toast(dice === 6 ? i18n.t('againSix') : i18n.t('againHit'));
      if (isHumanTurn()) updateStatus();
      else scheduleAi();
      return;
    }
    endTurn();
  }

  function endTurn() {
    if (!state || state.over) return;
    L.nextTurn(state);
    state.dice = 0;
    state.diceRolled = false;
    phase = 'idle';
    pendingOptions = [];
    hoverPlane = -1;
    aiThinking = false;
    render();
    renderMoves();
    updateStatus();
    saveGame();
    if (!isHumanTurn()) scheduleAi();
  }

  function scheduleAi() {
    if (cheatGod || !state || state.over) return;
    aiThinking = true;
    updateStatus();
    var token = gameToken;
    aiTimer = setTimeout(function () {
      aiTimer = null;
      if (token !== gameToken || !alive || !state || state.over) return;
      aiThinking = false;
      doRoll(true);
    }, 320);
  }

  function newGame() {
    gameToken++;
    aiThinking = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    if (diceTimer) { clearInterval(diceTimer); diceTimer = null; }
    BG.store.remove(GAME_ID, KEYS.session);

    state = L.create();
    history = [];
    phase = 'idle';
    pendingOptions = [];
    hoverPlane = -1;
    recorded = false;

    render();
    renderMoves();
    renderStats();
    updateStatus();
    saveGame();
    announceFirst();
  }

  function announceFirst() {
    var msg = mode === 'ai'
      ? (state.turn === L.RED ? i18n.t('youFirst') : i18n.t('aiFirst'))
      : i18n.t('redFirst');
    setTimeout(function () { if (alive) ui.toast(msg); }, 200);
    if (!isHumanTurn()) scheduleAi();
  }

  /* ---------------- 续盘存档 ---------------- */
  function saveGame() {
    if (!state) return;
    BG.store.set(GAME_ID, KEYS.session, {
      v: 1,
      mode: mode,
      difficulty: difficulty,
      state: {
        planes: state.planes.map(function (row) { return row.slice(); }),
        turn: state.turn,
        dice: state.dice,
        diceRolled: state.diceRolled,
        sixStreak: state.sixStreak,
        over: state.over,
        winner: state.winner
      },
      history: history,
      recorded: recorded
    });
  }

  function loadGame() {
    var d = BG.store.get(GAME_ID, KEYS.session, null);
    if (!d || d.v !== 1) return false;
    if (d.mode !== mode || d.difficulty !== difficulty) return false;
    if (!d.state || !d.state.planes) return false;
    try {
      state = {
        planes: d.state.planes.map(function (row) { return row.slice(); }),
        turn: d.state.turn | 0,
        dice: d.state.dice | 0,
        diceRolled: !!d.state.diceRolled,
        sixStreak: d.state.sixStreak | 0,
        over: !!d.state.over,
        winner: typeof d.state.winner === 'number' ? d.state.winner : -1
      };
      history = d.history || [];
      recorded = !!d.recorded;
      phase = state.diceRolled ? 'pick' : 'idle';
      pendingOptions = state.diceRolled
        ? L.legalPlanes(state, state.turn, state.dice)
        : [];

      render();
      renderMoves();
      renderStats();
      updateStatus();
      return true;
    } catch (e) {
      console.warn('[ludo] 续盘失败，开新局', e);
      BG.store.remove(GAME_ID, KEYS.session);
      return false;
    }
  }

  /* ---------------- 交互 ---------------- */
  function onClick(e) {
    // 上帝模式：点飞机 = 直接送进终点
    if (cheatGod && global.CheatKit && CheatKit.active() === 'finish') {
      var cell0 = pointToGrid(e.clientX, e.clientY);
      if (cell0) cheatSendHome(cell0);
      return;
    }
    if (state.over) return;

    if (phase === 'pick') {
      var cell = pointToGrid(e.clientX, e.clientY);
      if (!cell) return;
      // 找到点击格上属于我方待选飞机
      for (var i = 0; i < pendingOptions.length; i++) {
        var idx = pendingOptions[i];
        var g = L.coordOf(state.turn, state.planes[state.turn][idx], idx);
        if (g.x === cell.x && g.y === cell.y) {
          commitMove(idx, false);
          return;
        }
      }
      return;
    }
  }

  function onMove(e) {
    if (phase !== 'pick') {
      if (hoverPlane >= 0) { hoverPlane = -1; render(); }
      return;
    }
    var cell = pointToGrid(e.clientX, e.clientY);
    var found = -1;
    if (cell) {
      for (var i = 0; i < pendingOptions.length; i++) {
        var idx = pendingOptions[i];
        var g = L.coordOf(state.turn, state.planes[state.turn][idx], idx);
        if (g.x === cell.x && g.y === cell.y) { found = idx; break; }
      }
    }
    if (found !== hoverPlane) {
      hoverPlane = found;
      render();
    }
  }

  function onLeave() {
    if (hoverPlane >= 0) { hoverPlane = -1; render(); }
  }

  function onResize() {
    render();
  }

  /* ------------------------------------------------------------ */
  /* 修改器                                                          */
  /* ------------------------------------------------------------ */

  var cheatGod = false;

  function cheatAllHome() {
    if (!state) return;
    for (var i = 0; i < 4; i++) state.planes[L.RED][i] = L.FINISH;
    state.over = true;
    state.winner = L.RED;
    if (!recorded) {
      BG.store.bump(GAME_ID, KEYS.stats, 'red', 1);
      recorded = true;
    }
    render();
    renderMoves();
    updateStatus();
    saveGame();
  }

  function cheatGiveSix() {
    if (!state || state.over) return;
    state.dice = 6;
    state.diceRolled = true;
    state.sixStreak = 1;
    setDiceFace(6);
    var options = L.legalPlanes(state, state.turn, 6);
    pendingOptions = options;
    if (options.length > 1 && isHumanTurn()) {
      phase = 'pick';
    } else if (options.length === 1) {
      commitMove(options[0], false);
      return;
    } else if (options.length === 0) {
      ui.toast(i18n.t('noMove'));
    }
    updateStatus();
    render();
  }

  function cheatSendHome(cell) {
    if (!state) return;
    for (var color = 0; color < 4; color++) {
      for (var idx = 0; idx < 4; idx++) {
        var g = L.coordOf(color, state.planes[color][idx], idx);
        if (g.x === cell.x && g.y === cell.y) {
          state.planes[color][idx] = L.FINISH;
          render();
          saveGame();
          return;
        }
      }
    }
  }

  function cheatPlanesDone(color) {
    return L.finishedCount(state, color);
  }

  function freezeGame() {
    gameToken++;
    aiThinking = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    if (diceTimer) { clearInterval(diceTimer); diceTimer = null; }
    phase = 'idle';
    pendingOptions = [];
    hoverPlane = -1;
    render();
    updateStatus();
  }

  function resumeGame() {
    updateStatus();
    if (!isHumanTurn() && !state.over) scheduleAi();
  }

  function setupCheat() {
    if (!global.CheatKit) return;
    CheatKit.init({
      id: GAME_ID,
      dock: root,
      title: { zh: '🔧 修改器 · 上帝模式', en: '🔧 Modifier · God Mode' },
      hint: {
        zh: '上帝模式冻结整局；「给我掷 6」直接掷出 6 点，「全部到终点」直接获胜',
        en: 'God Mode freezes the game. "Give me a 6" forces a six; "All landed" wins instantly.'
      },
      stats: [
        { label: { zh: '轮到', en: 'Turn' }, get: function () { return sideName(state.turn); } },
        { label: { zh: '点数', en: 'Dice' }, get: function () { return state.diceRolled ? state.dice : '-'; } },
        { label: { zh: '红到达', en: 'Red' }, get: function () { return cheatPlanesDone(L.RED); } },
        { label: { zh: '黄到达', en: 'Yellow' }, get: function () { return cheatPlanesDone(L.YELLOW); } },
        { label: { zh: '蓝到达', en: 'Blue' }, get: function () { return cheatPlanesDone(L.BLUE); } },
        { label: { zh: '绿到达', en: 'Green' }, get: function () { return cheatPlanesDone(L.GREEN); } }
      ],
      toggles: [
        { label: { zh: '上帝模式', en: 'God mode' },
          on: { zh: '上帝模式：开', en: 'God Mode: ON' },
          off: { zh: '上帝模式：关', en: 'God Mode: OFF' },
          get: function () { return cheatGod; },
          set: function (v) {
            cheatGod = !!v;
            if (canvas) canvas.classList.toggle('is-god', cheatGod);
            if (cheatGod) freezeGame();
            else resumeGame();
          } }
      ],
      actions: [
        { label: { zh: '给我掷 6', en: 'Give me a 6' }, run: cheatGiveSix, toast: { zh: '已掷出 6 点', en: 'Rolled a 6' } },
        { label: { zh: '全部到终点', en: 'All landed' }, run: cheatAllHome, tone: 'danger', toast: { zh: '红方已获胜', en: 'Red wins' } }
      ],
      board: {
        title: { zh: '点棋盘上的飞机 = 直接送进终点', en: 'Tap a plane to send it home' },
        palette: [
          { label: { zh: '送进终点', en: 'Send home' }, value: 'finish', swatch: '#2fae5e' }
        ],
        visible: function () { return cheatGod; },
        tip: { zh: '点一架飞机，它立刻到达终点。', en: 'Tap a plane; it lands instantly.' },
        actions: [
          { label: { zh: '恢复开局', en: 'New game' }, run: function () { newGame(); } }
        ]
      }
    });
  }

  /* ---------------- 挂载 / 卸载 ---------------- */
  function mount(host, opts) {
    L = global.Ludo;
    AI = global.LudoAI;
    if (!L || !AI) throw new Error('飞行棋模块未就绪');

    root = host;
    alive = true;
    mode = opts && opts.mode === 'ai' ? 'ai' : 'pvp';
    difficulty = (opts && opts.difficulty) || 'medium';
    W = PAD * 2 + N * CELL;
    H = PAD * 2 + N * CELL;

    ui = BG.shell.create(root, {
      id: GAME_ID,
      title: { zh: '飞行棋', en: 'Ludo' },
      hint: {
        zh: '点「掷骰子」，6 点起飞；同色格连跳、撞回敌机，四机到齐者胜',
        en: 'Tap "Roll". Roll a 6 to take off; jump on your own colour and bump rivals home. First to land all four wins.'
      },
      stats: [
        { key: 'red', labelKey: 'statRed', dot: 'red' },
        { key: 'yellow', labelKey: 'statYellow', dot: 'yellow' },
        { key: 'blue', labelKey: 'statBlue', dot: 'blue' },
        { key: 'green', labelKey: 'statGreen', dot: 'green' }
      ],
      actions: ['restart', 'clear'],
      extraHtml:
        '<div style="display:flex;align-items:center;gap:12px;justify-content:center;margin:6px 0 10px">' +
        '  <button class="pg-btn bg-dice-btn" data-act="roll">掷骰子</button>' +
        '  <span class="bg-dice-face" style="min-width:46px;text-align:center;font-size:30px;' +
        'font-weight:800;line-height:1;padding:6px 8px;border:2px solid var(--pg-border);' +
        'border-radius:12px;background:var(--pg-surface)">-</span>' +
        '</div>',
      onAction: function (act) {
        if (act === 'roll') {
          if (canAct()) doRoll(false);
        } else if (act === 'restart') {
          newGame();
        } else if (act === 'clear') {
          BG.store.clear(GAME_ID);
          saveGame();
          renderStats();
          ui.toast(i18n.t('cleared'));
        }
      },
      onExit: function () { if (opts && opts.exit) opts.exit(); },
      onThemeChange: function () { render(); },
      onLangChange: function () {
        updateStatus();
        renderMoves();
        if (!ui) return;
        var btn = ui.q('.bg-dice-btn');
        if (btn) btn.textContent = i18n.t('roll');
      },
      onResize: onResize,
      onDestroy: function () {
        canvas = null;
        ctx = null;
      }
    });

    canvas = ui.el.canvas;
    ctx = BG.canvas.setup(canvas, W, H);

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    global.addEventListener('resize', onResize);

    if (loadGame()) {
      ui.toast(i18n.t('restored'));
      if (!isHumanTurn()) scheduleAi();
    } else {
      newGame();
    }
    setupCheat();
  }

  function unmount() {
    alive = false;
    gameToken++;
    aiThinking = false;
    if (global.CheatKit) CheatKit.detach();
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    if (diceTimer) { clearInterval(diceTimer); diceTimer = null; }
    if (canvas) {
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    }
    global.removeEventListener('resize', onResize);
    if (ui) {
      ui.destroy();
      ui = null;
    }
    canvas = null;
    ctx = null;
    root = null;
  }

  BG.registerGame('ludo', { mount: mount, unmount: unmount });
})(window);
