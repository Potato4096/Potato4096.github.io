/**
 * games/jungle/js/view.js - 斗兽棋对局视图
 *
 * 规则（Jungle）与 AI（JungleAI）是纯逻辑模块，这里只负责对局流程、
 * 画布绘制与交互。界面骨架、棋谱、战绩面板由 core/shell.js 提供。
 */
(function (global) {
  'use strict';

  var BG = global.BG;
  var i18n = BG.i18n;

  /* ---------------- 尺寸 ---------------- */
  var PAD = 30;
  var CELL = 52;

  /* ---------------- 棋盘配色 ---------------- */
  var BOARDS = {
    light: {
      bgFrom: '#e8d9bd',
      bgTo: '#d4bb8f',
      edge: '#a9895c',
      line: '#7a5b36',
      water: '#8fc4e4',
      waterLine: '#5a9cc4',
      trap: '#d98c4a',
      den: '#6b4a2f',
      label: '#6b4a2f',
      pick: '#e8532f',
      move: 'rgba(22, 128, 72, 0.85)',
      capture: 'rgba(210, 50, 40, 0.9)'
    },
    dark: {
      bgFrom: '#5c4a33',
      bgTo: '#4a3a27',
      edge: '#2f2317',
      line: '#c8a97c',
      water: '#2d6284',
      waterLine: '#77b6d8',
      trap: '#b06c33',
      den: '#241a10',
      label: '#c8a97c',
      pick: '#ff7a55',
      move: 'rgba(110, 220, 150, 0.85)',
      capture: 'rgba(255, 110, 95, 0.92)'
    }
  };

  var EMOJI = ['', '🐀', '🐈', '🐕', '🐺', '🐆', '🐅', '🦁', '🐘'];

  /* ---------------- 棋种词条 ---------------- */
  i18n.register('jungle', {
    zh: {
      hint: '点己方棋子再点目标格走棋；大吃小，鼠可吃象、虎狮能跳河，进兽穴者胜',
      turn: '{side}走棋',
      win: '{side}获胜',
      statRed: '红方胜',
      statBlack: '黑方胜',
      statDraw: '和棋',
      eat: '吃',
      jump: '跳河',
      denWin: '攻占兽穴',
      noPiece: '该子没有合法走法'
    },
    en: {
      hint: 'Tap your piece, then a destination. Bigger eats smaller; the rat beats the elephant; tigers and lions leap the river. Reach the den to win.',
      turn: '{side} to move',
      win: '{side} wins',
      statRed: 'Red wins',
      statBlack: 'Black wins',
      statDraw: 'Draws',
      eat: 'x',
      jump: 'leap',
      denWin: 'takes the den',
      noPiece: 'That piece has no legal move'
    }
  });

  /* ---------------- 对局状态 ---------------- */
  var g = null;
  var ai = null;
  var W = 500;
  var H = 620;

  var board = null;
  var turn = G_RED();
  var history = [];
  var lastMove = null;
  var selected = null;
  var legalTargets = [];
  var hover = null;
  var over = false;
  var winner = 0;
  var recorded = false;

  var mode = 'pvp';
  var difficulty = 'medium';
  var aiColor = G_BLACK();
  var boardFlip = false;
  var aiThinking = false;
  var gameToken = 0;
  var aiTimer = null;

  var root = null;
  var canvas = null;
  var ctx = null;
  var ui = null;
  var alive = false;

  var GAME_ID = 'jungle';
  var KEYS = { stats: 'stats', session: 'session' };

  function G_RED() { return 1; }
  function G_BLACK() { return 2; }

  /* ---------------- 工具 ---------------- */
  function reduceMotion() {
    try {
      return !!(global.GamePlatform && GamePlatform.ui && GamePlatform.ui.shouldReduceMotion());
    } catch (e) { return false; }
  }

  function palette() {
    var theme = 'light';
    try {
      theme = global.GamePlatform ? GamePlatform.theme.get() : 'light';
    } catch (e) { /* 浅色 */ }
    return BOARDS[theme] || BOARDS.light;
  }

  /** 逻辑坐标 → 显示坐标（AI 执红时棋盘上下翻转，让电脑的棋子始终在上方） */
  function dispY(y) {
    return boardFlip ? (g.ROWS - 1 - y) : y;
  }
  function logicY(dy) {
    return boardFlip ? (g.ROWS - 1 - dy) : dy;
  }

  function cellPx(x, y) {
    return {
      px: PAD + x * CELL + CELL / 2,
      py: PAD + dispY(y) * CELL + CELL / 2
    };
  }

  function pointToCell(clientX, clientY) {
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var lx = (clientX - rect.left) * (W / rect.width);
    var ly = (clientY - rect.top) * (H / rect.height);
    var dx = Math.floor((lx - PAD) / CELL);
    var dy = Math.floor((ly - PAD) / CELL);
    if (dx < 0 || dy < 0 || dx >= g.COLS || dy >= g.ROWS) return null;
    return { x: dx, y: logicY(dy) };
  }

  function sideName(side) {
    if (mode === 'ai') return side === aiColor ? i18n.t('ai') : i18n.t('you');
    return side === g.RED ? i18n.t('red') : i18n.t('black');
  }

  function diffKey() {
    return difficulty === 'easy' ? 'diffEasy' : difficulty === 'hard' ? 'diffHard' : 'diffMedium';
  }

  function modeText() {
    return mode === 'ai' ? i18n.fmt('modeAiFull', { diff: i18n.t(diffKey()) }) : i18n.t('modePvp');
  }

  /* ---------------- 绘制 ---------------- */
  function render() {
    if (!alive || !ctx || !board) return;
    ctx = BG.canvas.fit(canvas, ctx, W, H);
    var c = palette();
    var ac = BG.canvas.accent();
    ctx.clearRect(0, 0, W, H);

    var grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, c.bgFrom);
    grad.addColorStop(1, c.bgTo);
    ctx.fillStyle = grad;
    BG.canvas.roundRect(ctx, 0, 0, W, H, 10);
    ctx.fill();

    drawTerrain(c);
    drawGrid(c);
    drawTargets(c, ac);

    // 棋子
    for (var y = 0; y < g.ROWS; y++) {
      for (var x = 0; x < g.COLS; x++) {
        var p = board[g.idx(x, y)];
        if (!p) continue;
        drawPiece(x, y, p, c);
      }
    }

    // 最后一手标记
    if (lastMove) {
      var fp = cellPx(lastMove.from.x, lastMove.from.y);
      var tp = cellPx(lastMove.to.x, lastMove.to.y);
      ctx.strokeStyle = ac.danger;
      ctx.lineWidth = 2.4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(fp.px, fp.py);
      ctx.lineTo(tp.px, tp.py);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (hover && selected) {
      var hp = cellPx(hover.x, hover.y);
      ctx.beginPath();
      ctx.arc(hp.px, hp.py, CELL * 0.42, 0, Math.PI * 2);
      ctx.strokeStyle = c.pick;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawGrid(c) {
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1.2;
    var x, y, p;
    for (x = 0; x <= g.COLS; x++) {
      p = PAD + x * CELL;
      ctx.beginPath();
      ctx.moveTo(p, PAD);
      ctx.lineTo(p, PAD + g.ROWS * CELL);
      ctx.stroke();
    }
    for (var dy = 0; dy <= g.ROWS; dy++) {
      p = PAD + dy * CELL;
      ctx.beginPath();
      ctx.moveTo(PAD, p);
      ctx.lineTo(PAD + g.COLS * CELL, p);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = c.edge;
    ctx.strokeRect(PAD, PAD, g.COLS * CELL, g.ROWS * CELL);
    ctx.strokeRect(3, 3, W - 6, H - 6);
  }

  function drawTerrain(c) {
    var x, y, p;

    // 河流
    ctx.fillStyle = c.water;
    for (y = 0; y < g.ROWS; y++) {
      for (x = 0; x < g.COLS; x++) {
        if (!g.isWater(x, y)) continue;
        p = cellPx(x, y);
        ctx.fillRect(p.px - CELL / 2 + 1, p.py - CELL / 2 + 1, CELL - 2, CELL - 2);
      }
    }
    // 波纹
    ctx.strokeStyle = c.waterLine;
    ctx.lineWidth = 1.4;
    for (y = 0; y < g.ROWS; y++) {
      for (x = 0; x < g.COLS; x++) {
        if (!g.isWater(x, y)) continue;
        p = cellPx(x, y);
        for (var w = -1; w <= 1; w++) {
          ctx.beginPath();
          ctx.moveTo(p.px - 12, p.py + w * 9);
          ctx.quadraticCurveTo(p.px - 4, p.py + w * 9 - 4, p.px + 4, p.py + w * 9);
          ctx.quadraticCurveTo(p.px + 10, p.py + w * 9 + 4, p.px + 14, p.py + w * 9);
          ctx.stroke();
        }
      }
    }

    // 陷阱
    for (var i = 0; i < g.TRAPS.length; i++) {
      var t = g.TRAPS[i];
      p = cellPx(t.x, t.y);
      ctx.strokeStyle = c.trap;
      ctx.lineWidth = 2;
      var s = CELL * 0.30;
      ctx.beginPath();
      ctx.moveTo(p.px - s, p.py - s);
      ctx.lineTo(p.px + s, p.py + s);
      ctx.moveTo(p.px + s, p.py - s);
      ctx.lineTo(p.px - s, p.py + s);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.px, p.py, CELL * 0.44, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 兽穴
    for (var j = 0; j < g.DENS.length; j++) {
      var d = g.DENS[j];
      p = cellPx(d.x, d.y);
      ctx.beginPath();
      ctx.arc(p.px, p.py, CELL * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = c.den;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.px, p.py, CELL * 0.46, 0, Math.PI * 2);
      ctx.strokeStyle = d.s === g.RED ? 'rgba(214,72,54,0.8)' : 'rgba(40,44,52,0.8)';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
  }

  function drawTargets(c, ac) {
    if (!selected) return;
    for (var i = 0; i < legalTargets.length; i++) {
      var t = legalTargets[i];
      var p = cellPx(t.x, t.y);
      if (t.capture) {
        ctx.beginPath();
        ctx.arc(p.px, p.py, CELL * 0.42, 0, Math.PI * 2);
        ctx.strokeStyle = c.capture;
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.px, p.py, CELL * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = c.move;
        ctx.fill();
      }
    }
  }

  function drawPiece(x, y, piece, c) {
    var p = cellPx(x, y);
    var r = CELL * 0.40;

    // 阴影
    ctx.beginPath();
    ctx.arc(p.px + 1.5, p.py + 2.5, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fill();

    // 底
    var grd = ctx.createRadialGradient(p.px - r * 0.35, p.py - r * 0.42, r * 0.12, p.px, p.py, r);
    if (piece.s === g.RED) {
      grd.addColorStop(0, '#ff9d7e');
      grd.addColorStop(0.55, '#d6482e');
      grd.addColorStop(1, '#9c2c1c');
    } else {
      grd.addColorStop(0, '#8b939f');
      grd.addColorStop(0.55, '#3a424e');
      grd.addColorStop(1, '#1b2029');
    }
    ctx.beginPath();
    ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = piece.s === g.RED ? 'rgba(120,30,15,0.6)' : 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 选中描边
    if (selected && selected.x === x && selected.y === y) {
      ctx.beginPath();
      ctx.arc(p.px, p.py, r + 3, 0, Math.PI * 2);
      ctx.strokeStyle = c.pick;
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }

    // 动物
    ctx.font = Math.round(CELL * 0.42) + 'px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(EMOJI[piece.t] || '?', p.px, p.py + 1);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  /* ---------------- 流程 ---------------- */
  function canHumanPlay() {
    if (cheatGod) return false;
    if (over || aiThinking) return false;
    if (mode === 'ai' && turn === aiColor) return false;
    return true;
  }

  function statusText() {
    if (over) {
      if (mode === 'ai') return winner === aiColor ? i18n.t('aiWins') : i18n.t('youWin');
      return i18n.fmt('win', { side: sideName(winner) });
    }
    if (cheatGod) return i18n.t('frozen');
    if (mode === 'ai' && (aiThinking || turn === aiColor)) return i18n.t('thinking');
    return i18n.fmt('turn', { side: sideName(turn) });
  }

  function updateStatus() {
    if (!ui) return;
    ui.setStatus(statusText());
    ui.setMode(modeText());
    if (over) ui.setDot('is-win');
    else if (mode === 'ai' && (aiThinking || turn === aiColor)) ui.setDot('is-thinking');
    else ui.setDot(turn === g.RED ? 'is-red' : 'is-black');
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
    var s = h.name + ' ' + g.coordName(h.from.x, h.from.y) + '→' + g.coordName(h.to.x, h.to.y);
    if (h.eat) s += ' ' + i18n.t('eat');
    return s;
  }

  function renderStats() {
    if (!ui) return;
    var s = BG.store.get(GAME_ID, KEYS.stats, {});
    ui.setStats({
      red: s.red || 0,
      black: s.black || 0,
      draw: s.draw || 0
    });
  }

  function pieceName(p) {
    if (!p) return '';
    var l = i18n.lang();
    if (l === 'en') {
      return ['Rat', 'Cat', 'Dog', 'Wolf', 'Leopard', 'Tiger', 'Lion', 'Elephant'][p.t - 1];
    }
    return ['鼠', '猫', '狗', '狼', '豹', '虎', '狮', '象'][p.t - 1];
  }

  function doMove(from, to, byAi) {
    if (cheatGod) return false;
    if (over) return false;

    var p = g.get(board, from.x, from.y);
    if (!p || p.s !== turn) return false;
    var ms = g.movesFrom(board, from.x, from.y);
    var ok = false;
    for (var i = 0; i < ms.length; i++) {
      if (ms[i].x === to.x && ms[i].y === to.y) { ok = true; break; }
    }
    if (!ok) return false;

    var eaten = g.applyMove(board, { from: from, to: to });
    history.push({
      name: pieceName(p),
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      eat: !!eaten,
      eaten: eaten || null,
      side: p.s
    });
    lastMove = { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } };
    selected = null;
    legalTargets = [];
    hover = null;

    if (eaten) BG.sfx.place(byAi ? 500 : 320);
    else BG.sfx.stone();

    // 胜负判定
    var w = g.winnerOf(board, turn === g.RED ? g.BLACK : g.RED);
    if (w) {
      over = true;
      winner = w;
      if (!recorded) {
        BG.store.bump(GAME_ID, KEYS.stats, w === g.RED ? 'red' : 'black', 1);
        recorded = true;
      }
      if (mode === 'ai' && w === aiColor) BG.sfx.lose();
      else BG.sfx.win();
      var winMsg = i18n.fmt('win', { side: sideName(w) });
      if (g.denOwner(to.x, to.y)) winMsg += ' · ' + i18n.t('denWin');
      ui.toast(winMsg);
    } else {
      turn = turn === g.RED ? g.BLACK : g.RED;
    }

    render();
    renderMoves();
    renderStats();
    updateStatus();
    saveGame();

    if (mode === 'ai' && !over && turn === aiColor) scheduleAi();
    return true;
  }

  function undoOne() {
    // 斗兽棋悔棋需要回到上一手之前：这里用历史快照方式，简单可靠
    // 为控制复杂度，悔棋按「退回一步棋」实现：重放到上一手之前
    if (!history.length) return false;
    var h = history.pop();
    // 撤回：把 to 的子放回 from，被吃的子还原
    var p = board[g.idx(h.to.x, h.to.y)];
    board[g.idx(h.from.x, h.from.y)] = p;
    board[g.idx(h.to.x, h.to.y)] = h.eaten || null;
    turn = h.side;
    lastMove = history.length
      ? { from: { x: history[history.length - 1].from.x, y: history[history.length - 1].from.y },
          to: { x: history[history.length - 1].to.x, y: history[history.length - 1].to.y } }
      : null;
    if (over && recorded) {
      BG.store.bump(GAME_ID, KEYS.stats, winner === g.RED ? 'red' : 'black', -1);
      recorded = false;
    }
    over = false;
    winner = 0;
    return true;
  }

  function undo() {
    if (cheatGod) {
      ui.toast(i18n.t('frozen'));
      return;
    }
    if (aiThinking) {
      gameToken++;
      aiThinking = false;
      if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    }
    if (!history.length) {
      ui.toast(i18n.t('undoEmpty'));
      return;
    }
    var n = 1;
    if (mode === 'ai' && history[history.length - 1].side === aiColor) n = 2;
    for (var i = 0; i < n && history.length; i++) undoOne();

    selected = null;
    legalTargets = [];
    hover = null;
    BG.sfx.undo();
    render();
    renderMoves();
    renderStats();
    updateStatus();
    saveGame();

    if (mode === 'ai' && !over && turn === aiColor) scheduleAi();
  }

  function newGame() {
    gameToken++;
    aiThinking = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    BG.store.remove(GAME_ID, KEYS.session);

    // AI 模式随机分配电脑执红或执黑；先手固定红方
    if (mode === 'ai') {
      aiColor = Math.random() < 0.5 ? g.RED : g.BLACK;
      boardFlip = aiColor === g.RED;
    } else {
      boardFlip = false;
    }

    board = g.create();
    turn = g.RED;
    history = [];
    lastMove = null;
    selected = null;
    legalTargets = [];
    hover = null;
    over = false;
    winner = 0;
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
      ? (turn === aiColor ? i18n.t('aiFirst') : i18n.t('youFirst'))
      : i18n.t('redFirst');
    setTimeout(function () { if (alive) ui.toast(msg); }, 200);
  }

  /* ---------------- 续盘存档 ---------------- */
  function saveGame() {
    if (!board) return;
    BG.store.set(GAME_ID, KEYS.session, {
      v: 1,
      mode: mode,
      difficulty: difficulty,
      board: board.map(function (p) { return p ? { s: p.s, t: p.t } : null; }),
      turn: turn,
      history: history,
      lastMove: lastMove,
      over: over,
      winner: winner,
      recorded: recorded,
      aiColor: aiColor,
      boardFlip: boardFlip
    });
  }

  function loadGame() {
    var d = BG.store.get(GAME_ID, KEYS.session, null);
    if (!d || d.v !== 1) return false;
    if (d.mode !== mode || d.difficulty !== difficulty) return false;
    if (!d.board || d.board.length !== g.COLS * g.ROWS || !d.history) return false;
    try {
      board = d.board.map(function (p) { return p ? { s: p.s, t: p.t } : null; });
      turn = d.turn === g.BLACK ? g.BLACK : g.RED;
      history = d.history;
      lastMove = d.lastMove || null;
      over = !!d.over;
      winner = d.winner || 0;
      recorded = !!d.recorded;
      aiColor = (d.aiColor === g.RED || d.aiColor === g.BLACK) ? d.aiColor : g.BLACK;
      boardFlip = !!d.boardFlip;
      selected = null;
      legalTargets = [];

      render();
      renderMoves();
      renderStats();
      updateStatus();
      return true;
    } catch (e) {
      console.warn('[jungle] 续盘失败，开新局', e);
      BG.store.remove(GAME_ID, KEYS.session);
      return false;
    }
  }

  function scheduleAi() {
    if (cheatGod) return;
    aiThinking = true;
    updateStatus();
    var token = gameToken;
    aiTimer = setTimeout(function () {
      aiTimer = null;
      if (token !== gameToken || !alive) return;

      var mv = null;
      try {
        mv = ai.findMove(board, aiColor, { difficulty: difficulty });
      } catch (e) {
        console.error('[jungle] AI error', e);
      }
      if (token !== gameToken) return;
      aiThinking = false;

      if (mv) {
        doMove(mv.from, mv.to, true);
        return;
      }
      // 无子可动已在 winnerOf 中判定，兜底直接换手
      turn = turn === g.RED ? g.BLACK : g.RED;
      render();
      updateStatus();
    }, 260);
  }

  /* ---------------- 交互 ---------------- */
  function onClick(e) {
    // 上帝模式：点原棋盘直接摆子 / 拿子
    if (cheatGod && global.CheatKit && global.CheatKit.hasPalette()) {
      var cell0 = pointToCell(e.clientX, e.clientY);
      if (cell0) {
        selected = null;
        legalTargets = [];
        cheatSetPiece(cell0.x, cell0.y, global.CheatKit.active());
      }
      return;
    }
    if (!canHumanPlay()) return;

    var cell = pointToCell(e.clientX, e.clientY);
    if (!cell) return;
    var piece = g.get(board, cell.x, cell.y);

    // 已选中 → 尝试走子
    if (selected) {
      for (var i = 0; i < legalTargets.length; i++) {
        if (legalTargets[i].x === cell.x && legalTargets[i].y === cell.y) {
          var from = selected;
          selected = null;
          legalTargets = [];
          hover = null;
          doMove(from, cell, false);
          return;
        }
      }
    }

    // 选中己方棋子
    if (piece && piece.s === turn) {
      var ms = g.movesFrom(board, cell.x, cell.y);
      if (!ms.length) {
        ui.toast(i18n.t('noPiece'));
        return;
      }
      selected = cell;
      legalTargets = ms;
      hover = null;
      BG.sfx.select();
      render();
      return;
    }

    selected = null;
    legalTargets = [];
    render();
  }

  function onMove(e) {
    if (!canHumanPlay()) return;
    var cell = pointToCell(e.clientX, e.clientY);
    if (!cell || !selected) {
      if (hover) { hover = null; render(); }
      return;
    }
    if (!hover || hover.x !== cell.x || hover.y !== cell.y) {
      hover = cell;
      render();
    }
  }

  function onLeave() {
    if (hover) { hover = null; render(); }
  }

  function onResize() {
    render();
  }

  /* ------------------------------------------------------------ */
  /* 修改器：暗号 potato4096 唤出（platform/cheat-kit.js）          */
  /* ------------------------------------------------------------ */

  var cheatGod = false;

  function cheatPalette() {
    var list = [{ label: { zh: '空', en: 'Empty' }, value: '', swatch: '#0000' }];
    var names = ['鼠', '猫', '狗', '狼', '豹', '虎', '狮', '象'];
    var namesEn = ['Rat', 'Cat', 'Dog', 'Wolf', 'Leopard', 'Tiger', 'Lion', 'Elephant'];
    for (var t = 1; t <= 8; t++) {
      list.push({ label: { zh: '红·' + names[t - 1], en: 'Red ' + namesEn[t - 1] },
        value: 'r' + t, swatch: '#d6482e' });
      list.push({ label: { zh: '黑·' + names[t - 1], en: 'Black ' + namesEn[t - 1] },
        value: 'b' + t, swatch: '#3a424e' });
    }
    return list;
  }

  function cheatSetPiece(x, y, v) {
    if (!cheatGod || !board) return;
    if (!g.inBoard(x, y)) return;
    if (v == null || v === '') {
      board[g.idx(x, y)] = null;
    } else {
      var s = v.charAt(0) === 'b' ? g.BLACK : g.RED;
      var t = parseInt(v.slice(1), 10);
      if (!(t >= 1 && t <= 8)) return;
      board[g.idx(x, y)] = { s: s, t: t };
    }
    render();
    saveGame();
  }

  function cheatWipe() {
    if (!board) return;
    for (var i = 0; i < board.length; i++) board[i] = null;
    over = false;
    winner = 0;
    history.length = 0;
    lastMove = null;
    selected = null;
    legalTargets = [];
    render();
    renderMoves();
    updateStatus();
    saveGame();
  }

  function cheatCount(side) {
    return g.pieceCount(board, side);
  }

  /* 上帝模式 = 整局冻结 */
  function freezeGame() {
    gameToken++;
    aiThinking = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    selected = null;
    legalTargets = [];
    hover = null;
    render();
    updateStatus();
  }

  function resumeGame() {
    updateStatus();
    if (mode === 'ai' && !over && turn === aiColor) scheduleAi();
  }

  function setupCheat() {
    if (!global.CheatKit) return;
    CheatKit.init({
      id: GAME_ID,
      dock: root,
      title: { zh: '🔧 修改器 · 上帝模式', en: '🔧 Modifier · God Mode' },
      hint: {
        zh: '打开上帝模式后，选红/黑动物，直接点原棋盘摆/拿；棋局整体冻结，关闭后继续',
        en: 'Turn on God Mode, pick a piece, then tap the real board. The game freezes; turn it off to continue.'
      },
      stats: [
        { label: { zh: '手数', en: 'Moves' }, get: function () { return history.length; } },
        { label: { zh: '轮到', en: 'Turn' }, get: function () { return sideName(turn); } },
        { label: { zh: '红方子力', en: 'Red' }, get: function () { return cheatCount(g.RED); } },
        { label: { zh: '黑方子力', en: 'Black' }, get: function () { return cheatCount(g.BLACK); } },
        { label: { zh: '状态', en: 'State' }, get: function () {
          return over ? (i18n.lang() === 'en' ? 'Finished' : '已结束') : (i18n.lang() === 'en' ? 'Live' : '进行中');
        } }
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
      board: {
        title: { zh: '取子：选棋子，然后点原棋盘摆放', en: 'Pick a piece, then tap the real board' },
        palette: cheatPalette(),
        visible: function () { return cheatGod; },
        tip: {
          zh: '选「空」后点棋子 = 拿走该子。',
          en: 'Pick "Empty" and tap a piece to remove it.'
        },
        actions: [
          { label: { zh: '清空棋盘', en: 'Clear board' }, run: cheatWipe },
          { label: { zh: '恢复开局', en: 'New game' }, run: function () { newGame(); } }
        ]
      }
    });
  }

  /* ---------------- 挂载 / 卸载 ---------------- */
  function mount(host, opts) {
    g = global.Jungle;
    ai = global.JungleAI;
    if (!g || !ai) throw new Error('斗兽棋模块未就绪');

    root = host;
    alive = true;
    mode = opts && opts.mode === 'ai' ? 'ai' : 'pvp';
    difficulty = (opts && opts.difficulty) || 'medium';
    aiColor = g.BLACK;
    boardFlip = false;
    W = PAD * 2 + g.COLS * CELL;
    H = PAD * 2 + g.ROWS * CELL;

    ui = BG.shell.create(root, {
      id: GAME_ID,
      title: { zh: '斗兽棋', en: 'Jungle' },
      hint: {
        zh: '点己方棋子再点目标格走棋；大吃小，鼠可吃象、虎狮能跳河，进兽穴者胜',
        en: 'Tap your piece, then a destination. Bigger eats smaller; the rat beats the elephant; tigers and lions leap the river. Reach the den to win.'
      },
      stats: [
        { key: 'red', labelKey: 'statRed', dot: 'red' },
        { key: 'black', labelKey: 'statBlack', dot: 'black' },
        { key: 'draw', labelKey: 'statDraw', dot: 'draw' }
      ],
      actions: ['undo', 'restart', 'clear'],
      onAction: function (act) {
        if (act === 'undo') undo();
        else if (act === 'restart') { newGame(); }
        else if (act === 'clear') {
          BG.store.clear(GAME_ID);
          saveGame();
          renderStats();
          ui.toast(i18n.t('cleared'));
        }
      },
      onExit: function () { if (opts && opts.exit) opts.exit(); },
      onThemeChange: function () { render(); },
      onLangChange: function () { updateStatus(); renderMoves(); },
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

    if (loadGame()) ui.toast(i18n.t('restored'));
    else newGame();
    setupCheat();

    if (mode === 'ai' && !over && turn === aiColor) scheduleAi();
  }

  function unmount() {
    alive = false;
    gameToken++;
    aiThinking = false;
    if (global.CheatKit) CheatKit.detach();
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
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

  BG.registerGame('jungle', { mount: mount, unmount: unmount });
})(window);
