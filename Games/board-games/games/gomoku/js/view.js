/**
 * games/gomoku/js/view.js - 五子棋对局视图
 *
 * 规则（Gomoku）与 AI（GomokuAI）是纯逻辑模块，这里只负责对局流程、
 * 画布绘制与交互。界面骨架、棋谱、战绩面板由 core/shell.js 提供。
 */
(function (global) {
  'use strict';

  var BG = global.BG;
  var i18n = BG.i18n;

  /* ---------------- 尺寸 ---------------- */
  var PAD = 34;
  var CELL = 38;

  /* ---------------- 棋盘木色（深浅两套，跟随平台主题） ---------------- */
  var BOARDS = {
    light: {
      bgFrom: '#edcf9a',
      bgTo: '#ddb377',
      edge: '#b98e55',
      line: '#8a6234',
      star: '#7b5427',
      label: '#7b5427',
      woodGrain: 'rgba(150, 104, 48, 0.10)'
    },
    dark: {
      bgFrom: '#6f5539',
      bgTo: '#5b432b',
      edge: '#3f2d1c',
      line: '#d9bd92',
      star: '#cfb083',
      label: '#c8a97c',
      woodGrain: 'rgba(255, 226, 178, 0.06)'
    }
  };

  /* ---------------- 棋种词条 ---------------- */
  i18n.register('gomoku', {
    zh: {
      hint: '点击交叉点落子，任意方向先连成五子者获胜',
      turn: '{side}落子',
      win: '{side}获胜',
      winLine: '{side}五子连珠',
      statBlack: '黑方胜',
      statWhite: '白方胜',
      statDraw: '和棋',
      chipAi: '人机'
    },
    en: {
      hint: 'Tap an intersection. Five in a row in any direction wins.',
      turn: '{side} to play',
      win: '{side} wins',
      winLine: '{side} connects five',
      statBlack: 'Black wins',
      statWhite: 'White wins',
      statDraw: 'Draws',
      chipAi: 'VS AI'
    }
  });

  /* ---------------- 对局状态 ---------------- */
  var g = null;
  var ai = null;
  var W = 600;

  var board = null;
  var turn = 1;
  var history = [];
  var lastMove = null;
  var hover = null;
  var winCells = null;
  var over = false;
  var winner = 0;
  var anim = null;
  var recorded = false;

  var mode = 'pvp';
  var difficulty = 'medium';
  var aiColor = 2;
  var aiThinking = false;
  var gameToken = 0;
  var aiTimer = null;

  var root = null;
  var canvas = null;
  var ctx = null;
  var ui = null;
  var alive = false;

  var GAME_ID = 'gomoku';
  var KEYS = { stats: 'stats', session: 'session' };

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
    } catch (e) { /* 保持浅色 */ }
    return BOARDS[theme] || BOARDS.light;
  }

  function cellPx(x, y) {
    return { px: PAD + x * CELL, py: PAD + y * CELL };
  }

  function pointToCell(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var lx = (clientX - rect.left) * (W / rect.width);
    var ly = (clientY - rect.top) * (W / rect.height);
    var x = Math.round((lx - PAD) / CELL);
    var y = Math.round((ly - PAD) / CELL);
    if (!g.inBoard(x, y)) return null;
    var c = cellPx(x, y);
    if (Math.abs(lx - c.px) > CELL * 0.62 || Math.abs(ly - c.py) > CELL * 0.62) return null;
    return { x: x, y: y };
  }

  function sideName(color) {
    if (mode === 'ai') return color === aiColor ? i18n.t('ai') : i18n.t('you');
    return color === g.BLACK ? i18n.t('black') : i18n.t('white');
  }

  function diffKey() {
    return difficulty === 'easy' ? 'diffEasy' : difficulty === 'hard' ? 'diffHard' : 'diffMedium';
  }

  function modeText() {
    return mode === 'ai' ? i18n.fmt('modeAiFull', { diff: i18n.t(diffKey()) }) : i18n.t('modePvp');
  }

  /* ---------------- 绘制 ---------------- */
  function render() {
    if (!alive || !ctx) return;
    ctx = BG.canvas.fit(canvas, ctx, W, W);   // 缓冲区跟随实际显示尺寸，避免被 CSS 放大发虚
    var c = palette();
    var ac = BG.canvas.accent();
    ctx.clearRect(0, 0, W, W);

    var grad = ctx.createLinearGradient(0, 0, W, W);
    grad.addColorStop(0, c.bgFrom);
    grad.addColorStop(1, c.bgTo);
    ctx.fillStyle = grad;
    BG.canvas.roundRect(ctx, 0, 0, W, W, 10);
    ctx.fill();

    // 木纹
    ctx.strokeStyle = c.woodGrain;
    ctx.lineWidth = 6;
    for (var i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(PAD * 0.4, PAD + i * CELL * 3.4 + 6);
      ctx.bezierCurveTo(W * 0.35, PAD + i * CELL * 3.4 - 10,
        W * 0.62, PAD + i * CELL * 3.4 + 22,
        W - PAD * 0.4, PAD + i * CELL * 3.4 + 4);
      ctx.stroke();
    }

    drawGrid(c);
    drawStars(c);
    drawLabels(c);

    // 悬停预落子（仅鼠标设备有意义）
    if (hover && !over && !aiThinking && canHumanPlay() && g.isEmpty(board, hover.x, hover.y)) {
      var hp = cellPx(hover.x, hover.y);
      ctx.globalAlpha = 0.28;
      drawStone(hp.px, hp.py, turn, 1);
      ctx.globalAlpha = 1;
    }

    // 五连提示线（画在棋子下面）
    if (winCells && winCells.length > 1) {
      var a = cellPx(winCells[0].x, winCells[0].y);
      var b = cellPx(winCells[winCells.length - 1].x, winCells[winCells.length - 1].y);
      ctx.strokeStyle = ac.danger;
      ctx.lineWidth = CELL * 0.16;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 棋子
    var animStone = null;
    if (anim) {
      var p = Math.min(1, (performance.now() - anim.start) / anim.dur);
      if (p >= 1) anim = null;
      else animStone = { x: anim.x, y: anim.y, scale: 0.55 + 0.45 * easeOut(p) };
    }

    for (var y = 0; y < g.SIZE; y++) {
      for (var x = 0; x < g.SIZE; x++) {
        var v = board[g.idx(x, y)];
        if (!v) continue;
        var pt = cellPx(x, y);
        var scale = (animStone && animStone.x === x && animStone.y === y) ? animStone.scale : 1;
        drawStone(pt.px, pt.py, v, scale);
      }
    }

    // 最后一手
    if (lastMove && !over) {
      var lp = cellPx(lastMove.x, lastMove.y);
      ctx.beginPath();
      ctx.arc(lp.px, lp.py, CELL * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = ac.danger;
      ctx.fill();
    }

    // 获胜棋子高亮
    if (winCells && winCells.length) {
      winCells.forEach(function (cell) {
        var cp = cellPx(cell.x, cell.y);
        ctx.beginPath();
        ctx.arc(cp.px, cp.py, CELL * 0.47, 0, Math.PI * 2);
        ctx.strokeStyle = ac.danger;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      });
    }

    if (anim) requestAnimationFrame(render);
  }

  function easeOut(p) {
    return 1 - Math.pow(1 - p, 3);
  }

  function drawGrid(c) {
    var end = PAD + CELL * (g.SIZE - 1);
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    for (var i = 0; i < g.SIZE; i++) {
      var p = PAD + i * CELL;
      ctx.beginPath();
      ctx.moveTo(PAD, p);
      ctx.lineTo(end, p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, PAD);
      ctx.lineTo(p, end);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD, PAD, end - PAD, end - PAD);
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(3, 3, W - 6, W - 6);
  }

  function drawStars(c) {
    var pts = [[3, 3], [11, 3], [3, 11], [11, 11], [7, 7]];
    ctx.fillStyle = c.star;
    pts.forEach(function (p) {
      var q = cellPx(p[0], p[1]);
      ctx.beginPath();
      ctx.arc(q.px, q.py, 3.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawLabels(c) {
    ctx.fillStyle = c.label;
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < g.SIZE; i++) {
      var p = PAD + i * CELL;
      ctx.fillText(g.colName(i), p, PAD - 17);
      ctx.fillText(String(g.SIZE - i), PAD - 19, p);
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  function drawStone(px, py, color, scale) {
    var r = CELL * 0.44 * (scale || 1);
    ctx.beginPath();
    ctx.arc(px + 1, py + 2.2, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fill();

    var grd = ctx.createRadialGradient(px - r * 0.35, py - r * 0.42, r * 0.12, px, py, r);
    if (color === g.BLACK) {
      grd.addColorStop(0, '#7b838f');
      grd.addColorStop(0.45, '#333a44');
      grd.addColorStop(1, '#11151a');
    } else {
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.55, '#f4f6f9');
      grd.addColorStop(1, '#c6ccd7');
    }
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = color === g.BLACK ? 'rgba(0,0,0,0.5)' : 'rgba(140,150,165,0.55)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
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
      if (winner === g.EMPTY) return i18n.t('drawText');
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
    if (over) {
      ui.setDot('is-win');
    } else if (mode === 'ai' && (aiThinking || turn === aiColor)) {
      ui.setDot('is-thinking');
    } else {
      ui.setDot(turn === g.BLACK ? 'is-black' : 'is-white');
    }
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
      var first = history[i] ? g.coordName(history[i].x, history[i].y) : '';
      var second = history[i + 1] ? g.coordName(history[i + 1].x, history[i + 1].y) : '';
      rows.push('<div class="bg-move-row"><span class="bg-move-no">' + no + '.</span>' +
        '<span>' + first + '</span><span>' + second + '</span></div>');
    }
    ui.setMoves(rows.join(''));
  }

  function renderStats() {
    if (!ui) return;
    var s = BG.store.get(GAME_ID, KEYS.stats, {});
    ui.setStats({
      black: s.black || 0,
      white: s.white || 0,
      draw: s.draw || 0
    });
  }

  function place(x, y, byAi) {
    if (cheatGod) return false;   // 上帝模式：整局冻结，不落子
    if (over || !g.isEmpty(board, x, y)) return false;

    var color = turn;
    g.set(board, x, y, color);
    history.push({ x: x, y: y, color: color });
    lastMove = { x: x, y: y };
    anim = reduceMotion() ? null : { x: x, y: y, start: performance.now(), dur: 190 };

    var line = g.winLine(board, x, y);
    if (line) {
      winCells = line;
      over = true;
      winner = color;
      if (!recorded) {
        BG.store.bump(GAME_ID, KEYS.stats,
          color === g.BLACK ? 'black' : 'white', 1);
        recorded = true;
      }
      if (mode === 'ai' && color === aiColor) BG.sfx.lose();
      else BG.sfx.win();
      ui.toast(i18n.fmt('win', { side: sideName(color) }));
    } else if (g.isFull(board)) {
      over = true;
      winner = g.EMPTY;
      if (!recorded) {
        BG.store.bump(GAME_ID, KEYS.stats, 'draw', 1);
        recorded = true;
      }
      BG.sfx.draw();
      ui.toast(i18n.t('drawText'));
    } else {
      turn = color === g.BLACK ? g.WHITE : g.BLACK;
      if (byAi) BG.sfx.place(500);
      else BG.sfx.stone();
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
    var h = history.pop();
    if (!h) return false;
    board[g.idx(h.x, h.y)] = g.EMPTY;
    turn = h.color;
    if (over && recorded) {
      BG.store.bump(GAME_ID, KEYS.stats,
        winner === g.EMPTY ? 'draw' : winner === g.BLACK ? 'black' : 'white', -1);
      recorded = false;
    }
    over = false;
    winner = g.EMPTY;
    winCells = null;
    anim = null;
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
    if (mode === 'ai' && history[history.length - 1].color === aiColor) n = 2;
    for (var i = 0; i < n && history.length; i++) undoOne();

    var prev = history[history.length - 1];
    lastMove = prev ? { x: prev.x, y: prev.y } : null;
    hover = null;

    BG.sfx.undo();
    render();
    renderMoves();
    renderStats();
    updateStatus();
    saveGame();

    // 撤回后若又轮到电脑（玩家撤了自己的最后一手），让电脑补上
    if (mode === 'ai' && !over && turn === aiColor) scheduleAi();
  }

  function newGame() {
    gameToken++;
    aiThinking = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    BG.store.remove(GAME_ID, KEYS.session);

    board = g.create();
    turn = g.BLACK;
    history = [];
    lastMove = null;
    hover = null;
    winCells = null;
    over = false;
    winner = g.EMPTY;
    anim = null;
    recorded = false;

    render();
    renderMoves();
    renderStats();
    updateStatus();
  }

  /* ---------------- 续盘存档：刷新后保留棋盘 ---------------- */
  function boardToArray() {
    var a = [];
    for (var i = 0; i < board.length; i++) a.push(board[i]);
    return a;
  }

  function saveGame() {
    if (!board) return;
    BG.store.set(GAME_ID, KEYS.session, {
      v: 1,
      mode: mode,
      difficulty: difficulty,
      board: boardToArray(),
      turn: turn,
      history: history,
      lastMove: lastMove,
      winCells: winCells,
      over: over,
      winner: winner,
      recorded: recorded
    });
  }

  function loadGame() {
    var d = BG.store.get(GAME_ID, KEYS.session, null);
    if (!d || d.v !== 1) return false;
    if (d.mode !== mode || d.difficulty !== difficulty) return false;
    if (!d.board || d.board.length !== g.SIZE * g.SIZE || !d.history) return false;
    try {
      board = new Int8Array(d.board);
      turn = d.turn === g.WHITE ? g.WHITE : g.BLACK;
      history = d.history;
      lastMove = d.lastMove || null;
      winCells = d.winCells || null;
      over = !!d.over;
      winner = d.winner || g.EMPTY;
      recorded = !!d.recorded;

      render();
      renderMoves();
      renderStats();
      updateStatus();
      return true;
    } catch (e) {
      console.warn('[gomoku] 续盘失败，开新局', e);
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
        console.error('[gomoku] AI error', e);
      }
      if (token !== gameToken) return;

      aiThinking = false;
      if (mv && g.isEmpty(board, mv.x, mv.y)) {
        place(mv.x, mv.y, true);
        return;
      }
      // 兜底：任意空点，避免对局卡死
      for (var y = 0; y < g.SIZE; y++) {
        for (var x = 0; x < g.SIZE; x++) {
          if (g.isEmpty(board, x, y)) { place(x, y, true); return; }
        }
      }
    }, 240);
  }

  /* ---------------- 交互 ---------------- */
  function onClick(e) {
    // 上帝模式：点原棋盘直接摆子 / 拿子，不判空点、不判轮次
    if (cheatGod && global.CheatKit && global.CheatKit.hasPalette()) {
      var pt = pointToCell(e.clientX, e.clientY);
      if (pt) { hover = null; cheatSetPiece(pt.y, pt.x, global.CheatKit.active()); }
      return;
    }
    if (!canHumanPlay()) return;
    var cell = pointToCell(e.clientX, e.clientY);
    if (!cell || !g.isEmpty(board, cell.x, cell.y)) return;
    hover = null;
    place(cell.x, cell.y, false);
  }

  function onMove(e) {
    if (!canHumanPlay()) {
      if (hover) { hover = null; render(); }
      return;
    }
    var cell = pointToCell(e.clientX, e.clientY);
    if (!cell) {
      if (hover) { hover = null; render(); }
      return;
    }
    if (g.isEmpty(board, cell.x, cell.y)) {
      if (!hover || hover.x !== cell.x || hover.y !== cell.y) {
        hover = cell;
        render();
      }
    } else if (hover) {
      hover = null;
      render();
    }
  }

  function onLeave() {
    if (hover) { hover = null; render(); }
  }

  function onResize() {
    render();
  }

  /* ---------------- 挂载 / 卸载 ---------------- */
  /* ------------------------------------------------------------ */
  /* 修改器：暗号 potato4096 唤出（platform/cheat-kit.js）          */
  /* ------------------------------------------------------------ */

  var cheatGod = false;      // 上帝模式：允许任意摆子 + 冻结整局（落子/AI/悔棋全停）

  function cheatPalette() {
    return [
      { label: { zh: '空', en: 'Empty' }, value: '', swatch: '#0000' },
      { label: { zh: '● 黑子', en: '● Black' }, value: '1', swatch: '#22252c' },
      { label: { zh: '○ 白子', en: '○ White' }, value: '2', swatch: '#f6f6f6' }
    ];
  }

  function cheatSetPiece(r, c, v) {
    if (!cheatGod || !board) return;
    board[g.idx(c, r)] = v === '' || v == null ? g.EMPTY : Number(v);
    render();
    saveGame();
  }

  function cheatWipe() {
    if (!board) return;
    for (var i = 0; i < board.length; i++) board[i] = g.EMPTY;
    over = false;
    winCells = null;
    history.length = 0;
    render();
    renderMoves();
    updateStatus();
    saveGame();
  }

  function cheatFour() {
    if (!board) return;
    // 在中间偏下摆一条四连，留出两端让玩家补第五子
    for (var i = 0; i < 4; i++) board[g.idx(5 + i, 9)] = g.BLACK;
    render();
    saveGame();
    ui.toast(i18n.lang() === 'en' ? 'Four in a row placed — add the fifth' : '已摆好四连，补第五子即可获胜');
  }

  function cheatCount(color) {
    if (!board) return 0;
    var n = 0;
    for (var i = 0; i < board.length; i++) if (board[i] === color) n++;
    return n;
  }

  /* 上帝模式 = 整局冻结：落子/AI/悔棋全停；解除后继续 */
  function freezeGame() {
    gameToken++;
    aiThinking = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
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
        zh: '打开上帝模式后，下面选黑/白，直接点原棋盘交叉点就能摆/拿子；棋局整体冻结，关闭后继续',
        en: 'Turn on God Mode, pick black or white below, then tap the real board. The game freezes; turn it off to continue.'
      },
      stats: [
        { label: { zh: '手数', en: 'Moves' }, get: function () { return history.length; } },
        { label: { zh: '轮到', en: 'Turn' }, get: function () { return sideName(turn); } },
        { label: { zh: '黑子', en: 'Black' }, get: function () { return cheatCount(g.BLACK); } },
        { label: { zh: '白子', en: 'White' }, get: function () { return cheatCount(g.WHITE); } },
        { label: { zh: '空点', en: 'Empty' }, get: function () { return cheatCount(g.EMPTY); }, tone: 'warning' },
        { label: { zh: '状态', en: 'State' }, get: function () {
          if (over) return i18n.lang() === 'en' ? 'Finished' : '已结束';
          return i18n.lang() === 'en' ? 'Live' : '进行中';
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
      actions: [
        { label: { zh: '给我方四连', en: 'Give me four' }, run: cheatFour, toast: { zh: '四连已就位', en: 'Four placed' } }
      ],
      board: {
        title: { zh: '取子：选黑/白，然后点原棋盘落子', en: 'Pick a stone, then tap the real board' },
        palette: cheatPalette(),
        // 取子栏只在上帝模式开启后显示
        visible: function () { return cheatGod; },
        tip: {
          zh: '选「空」后点交叉点 = 拿走该子。可以直接摆出五连。',
          en: 'Pick "Empty" and tap to remove a stone. You can even build five in a row.'
        },
        actions: [
          { label: { zh: '清空棋盘', en: 'Clear board' }, run: cheatWipe },
          { label: { zh: '恢复开局', en: 'New game' }, run: function () { newGame(); } }
        ]
      }
    });
  }

  function mount(host, opts) {
    g = global.Gomoku;
    ai = global.GomokuAI;
    if (!g || !ai) throw new Error('五子棋模块未就绪');

    root = host;
    alive = true;
    mode = opts && opts.mode === 'ai' ? 'ai' : 'pvp';
    difficulty = (opts && opts.difficulty) || 'medium';
    aiColor = g.WHITE;
    W = PAD * 2 + CELL * (g.SIZE - 1);

    ui = BG.shell.create(root, {
      id: GAME_ID,
      title: { zh: '五子棋', en: 'Gomoku' },
      hint: { zh: '点击交叉点落子，任意方向先连成五子者获胜', en: 'Tap an intersection. Five in a row in any direction wins.' },
      stats: [
        { key: 'black', labelKey: 'statBlack', dot: 'black' },
        { key: 'white', labelKey: 'statWhite', dot: 'white' },
        { key: 'draw', labelKey: 'statDraw', dot: 'draw' }
      ],
      actions: ['undo', 'restart', 'clear'],
      onAction: function (act) {
        if (act === 'undo') undo();
        else if (act === 'restart') { newGame(); ui.toast(i18n.t('restarted')); }
        else if (act === 'clear') {
          BG.store.clear(GAME_ID);
          saveGame();          // 只清战绩，当前这盘继续留着
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
    ctx = BG.canvas.setup(canvas, W, W);

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

  BG.registerGame('gomoku', { mount: mount, unmount: unmount });
})(window);
