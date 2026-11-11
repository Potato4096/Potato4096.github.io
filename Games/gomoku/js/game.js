/**
 * game.js - 五子棋 UI 与对局流程
 * 依赖：platform/game-api.js（GamePlatform）、js/rules.js（Gomoku）、js/ai.js（GomokuAI）
 */
(function () {
  'use strict';

  var G = Gomoku;
  var AI = GomokuAI;

  /* ---------------- 布局常量（逻辑坐标） ---------------- */
  var PAD = 34;
  var CELL = 38;
  var W = PAD * 2 + CELL * (G.SIZE - 1); // 600

  /* ---------------- 棋盘配色（明暗两套） ---------------- */
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

  /* ---------------- 文案 ---------------- */
  var TEXT = {
    zh: {
      back: '返回主页',
      title: '五子棋 · 双人对弈',
      titleAi: '五子棋 · 人机对战',
      black: '黑方',
      white: '白方',
      you: '你',
      ai: '电脑',
      turn: '{side}落子',
      win: '{side}获胜',
      draw: '平局，棋盘已满',
      undo: '悔棋',
      restart: '重新开始',
      clear: '清除记录',
      record: '棋谱',
      blackWins: '黑方胜',
      whiteWins: '白方胜',
      draws: '和棋',
      noMoves: '尚未落子',
      undoEmpty: '没有可悔的棋',
      cleared: '对局记录已清除',
      restarted: '已重新开始',
      hint: '点击交叉点落子，任意方向先连成五子者获胜',
      modeTitle: '选择对局模式',
      modePvp: '双人对弈',
      modePvpSub: '两人轮流落子',
      modeAi: '人机对战',
      modeAiSub: '你执黑先行，电脑执白',
      modeLabel: '模式',
      switchMode: '切换模式',
      chooseMode: '请选择对局模式',
      diffEasy: '简单',
      diffMedium: '中等',
      diffHard: '困难',
      modeAiFull: '人机对战（{diff}）',
      thinking: '电脑思考中…',
      yourTurn: '轮到你落子',
      aiWins: '电脑获胜',
      youWin: '你赢了！',
      winLine: '{side}五子连珠'
    },
    en: {
      back: 'Back to Home',
      title: 'Gomoku · Two Players',
      titleAi: 'Gomoku · VS Computer',
      black: 'Black',
      white: 'White',
      you: 'You',
      ai: 'AI',
      turn: '{side} to play',
      win: '{side} wins',
      draw: 'Draw - board is full',
      undo: 'Undo',
      restart: 'New Game',
      clear: 'Clear Records',
      record: 'Move Record',
      blackWins: 'Black wins',
      whiteWins: 'White wins',
      draws: 'Draws',
      noMoves: 'No moves yet',
      undoEmpty: 'Nothing to undo',
      cleared: 'Records cleared',
      restarted: 'New game started',
      hint: 'Click an intersection. Five in a row in any direction wins.',
      modeTitle: 'Choose Game Mode',
      modePvp: 'Two Players',
      modePvpSub: 'Take turns on this device',
      modeAi: 'VS Computer',
      modeAiSub: 'You play Black and move first',
      modeLabel: 'Mode',
      switchMode: 'Switch Mode',
      chooseMode: 'Choose a game mode to start',
      diffEasy: 'Easy',
      diffMedium: 'Medium',
      diffHard: 'Hard',
      modeAiFull: 'VS Computer ({diff})',
      thinking: 'AI is thinking…',
      yourTurn: 'Your move',
      aiWins: 'AI wins',
      youWin: 'You win!',
      winLine: '{side} connects five'
    }
  };

  function t(key) {
    var lang = GamePlatform.i18n.getLang();
    return (TEXT[lang] || TEXT.zh)[key] || key;
  }

  function fmt(key, map) {
    var s = t(key);
    Object.keys(map).forEach(function (k) {
      s = s.replace('{' + k + '}', map[k]);
    });
    return s;
  }

  /* ---------------- 对局状态 ---------------- */
  var board;
  var turn;
  var history;
  var lastMove;
  var hover;
  var winCells;
  var over;
  var winner;
  var anim;
  var recorded;
  var mode = null;            // 'pvp' | 'ai'
  var difficulty = 'medium';
  var aiColor = G.WHITE;
  var aiThinking = false;
  var gameToken = 0;

  var canvas, ctx;
  var el = {};
  var accentCache = null;

  /* ---------------- 音效 ---------------- */
  var audioCtx = null;

  function beep(freq, dur, type, gain) {
    if (!GamePlatform.ui.isSoundEnabled()) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain || 0.07, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    } catch (e) { /* 忽略 */ }
  }

  function sfxPlace() { beep(660, 0.05, 'triangle', 0.08); }
  function sfxAiPlace() { beep(520, 0.06, 'triangle', 0.07); }
  function sfxUndo() { beep(300, 0.08, 'sine', 0.06); }
  function sfxWin() {
    [523, 659, 784, 1046].forEach(function (f, i) {
      setTimeout(function () { beep(f, 0.18, 'triangle', 0.08); }, i * 130);
    });
  }

  /* ---------------- 取色 ---------------- */
  function palette() {
    return BOARDS[GamePlatform.theme.get()] || BOARDS.light;
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    v = (v || '').trim();
    return v || fallback;
  }

  function accentColor() {
    if (!accentCache) {
      accentCache = {
        accent: cssVar('--pg-accent', '#4f6df5'),
        danger: cssVar('--pg-danger', '#e5484d'),
        success: cssVar('--pg-success', '#22a06b'),
        muted: cssVar('--pg-text-muted', '#5b6474')
      };
    }
    return accentCache;
  }

  /* ---------------- 坐标换算 ---------------- */
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
    if (!G.inBoard(x, y)) return null;
    var c = cellPx(x, y);
    if (Math.abs(lx - c.px) > CELL * 0.62 || Math.abs(ly - c.py) > CELL * 0.62) return null;
    return { x: x, y: y };
  }

  /* ---------------- 绘制 ---------------- */
  function render() {
    var c = palette();
    var ac = accentColor();
    ctx.clearRect(0, 0, W, W);

    // 木质底
    var grad = ctx.createLinearGradient(0, 0, W, W);
    grad.addColorStop(0, c.bgFrom);
    grad.addColorStop(1, c.bgTo);
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, W, W, 10);
    ctx.fill();

    // 细木纹
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

    // 悬停预览
    if (hover && !over && !aiThinking && canHumanPlay() && G.isEmpty(board, hover.x, hover.y)) {
      var hp = cellPx(hover.x, hover.y);
      ctx.globalAlpha = 0.28;
      drawStone(hp.px, hp.py, turn, 1);
      ctx.globalAlpha = 1;
    }

    // 胜利连线（画在棋子下方，避免盖住棋面）
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
      else animStone = { x: anim.x, y: anim.y, color: anim.color, scale: 0.55 + 0.45 * easeOut(p) };
    }

    for (var y = 0; y < G.SIZE; y++) {
      for (var x = 0; x < G.SIZE; x++) {
        var v = board[G.idx(x, y)];
        if (!v) continue;
        var pt = cellPx(x, y);
        if (animStone && animStone.x === x && animStone.y === y) {
          drawStone(pt.px, pt.py, v, animStone.scale);
        } else {
          drawStone(pt.px, pt.py, v, 1);
        }
      }
    }

    // 最后一手标记
    if (lastMove && !winCells) {
      var lp = cellPx(lastMove.x, lastMove.y);
      ctx.beginPath();
      ctx.arc(lp.px, lp.py, CELL * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = ac.danger;
      ctx.fill();
    }

    // 胜利棋子高亮圆环
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

  function roundRect(ctx2, x, y, w, h, r) {
    ctx2.beginPath();
    ctx2.moveTo(x + r, y);
    ctx2.arcTo(x + w, y, x + w, y + h, r);
    ctx2.arcTo(x + w, y + h, x, y + h, r);
    ctx2.arcTo(x, y + h, x, y, r);
    ctx2.arcTo(x, y, x + w, y, r);
    ctx2.closePath();
  }

  function drawGrid(c) {
    var end = PAD + CELL * (G.SIZE - 1);
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    for (var i = 0; i < G.SIZE; i++) {
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
    // 外框略粗，视觉收边
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
    for (var i = 0; i < G.SIZE; i++) {
      var p = PAD + i * CELL;
      ctx.fillText(G.colName(i), p, PAD - 17);
      ctx.fillText(String(G.SIZE - i), PAD - 19, p);
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  function drawStone(px, py, color, scale) {
    var r = CELL * 0.44 * (scale || 1);
    // 投影
    ctx.beginPath();
    ctx.arc(px + 1, py + 2.2, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fill();

    var g = ctx.createRadialGradient(px - r * 0.35, py - r * 0.42, r * 0.12, px, py, r);
    if (color === G.BLACK) {
      g.addColorStop(0, '#7b838f');
      g.addColorStop(0.45, '#333a44');
      g.addColorStop(1, '#11151a');
    } else {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.55, '#f4f6f9');
      g.addColorStop(1, '#c6ccd7');
    }
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = color === G.BLACK ? 'rgba(0,0,0,0.5)' : 'rgba(140,150,165,0.55)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  /* ---------------- 对局流程 ---------------- */
  function isAiSeat(color) {
    return mode === 'ai' && color === aiColor;
  }

  function canHumanPlay() {
    if (!mode || over) return false;
    if (aiThinking) return false;
    if (mode === 'ai' && turn === aiColor) return false;
    return true;
  }

  function place(x, y, byAi) {
    if (!G.isEmpty(board, x, y)) return false;
    if (over) return false;

    var color = turn;
    G.set(board, x, y, color);
    history.push({ x: x, y: y, color: color });
    lastMove = { x: x, y: y };
    anim = { x: x, y: y, color: color, start: performance.now(), dur: 190 };

    var line = G.winLine(board, x, y);
    if (line) {
      winCells = line;
      over = true;
      winner = color;
      if (!recorded) {
        recordResult(color);
        recorded = true;
      }
      sfxWin();
      GamePlatform.ui.toast(fmt('win', { side: sideName(color) }));
    } else if (G.isFull(board)) {
      over = true;
      winner = G.EMPTY;
      if (!recorded) {
        recordResult(G.EMPTY);
        recorded = true;
      }
      sfxWin();
      GamePlatform.ui.toast(t('draw'));
    } else {
      turn = turn === G.BLACK ? G.WHITE : G.BLACK;
      if (byAi) sfxAiPlace(); else sfxPlace();
    }

    render();
    renderMoveList();
    renderStats();
    updateStatusUI();

    if (mode === 'ai' && !over && turn === aiColor) scheduleAi();
    return true;
  }

  function undoOne() {
    var h = history.pop();
    if (!h) return;
    board[G.idx(h.x, h.y)] = G.EMPTY;
    turn = h.color;
    if (over && recorded) {
      unrecordResult(winner);
      recorded = false;
    }
    over = false;
    winner = G.EMPTY;
    winCells = null;
    anim = null;
  }

  function undo() {
    if (aiThinking) {
      gameToken++;
      aiThinking = false;
    }
    if (!history.length) {
      GamePlatform.ui.toast(t('undoEmpty'));
      return;
    }
    var n = 1;
    if (mode === 'ai' && history[history.length - 1].color === aiColor) n = 2;
    for (var i = 0; i < n && history.length; i++) undoOne();

    var prev = history[history.length - 1];
    lastMove = prev ? { x: prev.x, y: prev.y } : null;
    hover = null;
    sfxUndo();
    render();
    renderMoveList();
    renderStats();
    updateStatusUI();
  }

  function resetGame() {
    gameToken++;
    aiThinking = false;
    board = G.create();
    turn = G.BLACK;
    history = [];
    lastMove = null;
    hover = null;
    winCells = null;
    over = false;
    winner = G.EMPTY;
    anim = null;
    recorded = false;
    render();
    renderMoveList();
    renderStats();
    updateStatusUI();
  }

  function restart() {
    if (!mode) return;
    resetGame();
    GamePlatform.ui.toast(t('restarted'));
  }

  function scheduleAi() {
    aiThinking = true;
    updateStatusUI();
    var token = gameToken;
    setTimeout(function () {
      if (token !== gameToken) return;
      var mv = null;
      try {
        mv = AI.findMove(board, aiColor, { difficulty: difficulty });
      } catch (e) {
        console.error('[gomoku] AI error', e);
      }
      if (token !== gameToken) return;
      aiThinking = false;
      if (mv && G.isEmpty(board, mv.x, mv.y)) {
        place(mv.x, mv.y, true);
      } else {
        // 兜底：任取一个空点，避免对局卡死
        for (var y = 0; y < G.SIZE; y++) {
          for (var x = 0; x < G.SIZE; x++) {
            if (G.isEmpty(board, x, y)) { place(x, y, true); return; }
          }
        }
      }
    }, 260);
  }

  function startGame(m, diff) {
    mode = m;
    if (diff) difficulty = diff;
    el.overlay.style.display = 'none';
    resetGame();
    applyText();
  }

  function showOverlay() {
    gameToken++;
    aiThinking = false;
    mode = null;
    el.overlay.style.display = 'flex';
    applyText();
    render();
  }

  /* ---------------- 存档 ---------------- */
  function loadStats() {
    var s = GamePlatform.storage.get('stats', null);
    if (!s || typeof s !== 'object') s = { black: 0, white: 0, draw: 0 };
    return {
      black: s.black || 0,
      white: s.white || 0,
      draw: s.draw || 0
    };
  }

  function recordResult(color) {
    var s = loadStats();
    if (color === G.BLACK) s.black++;
    else if (color === G.WHITE) s.white++;
    else s.draw++;
    GamePlatform.storage.set('stats', s);
  }

  function unrecordResult(color) {
    var s = loadStats();
    if (color === G.BLACK) s.black = Math.max(0, s.black - 1);
    else if (color === G.WHITE) s.white = Math.max(0, s.white - 1);
    else s.draw = Math.max(0, s.draw - 1);
    GamePlatform.storage.set('stats', s);
  }

  /* ---------------- UI ---------------- */
  function sideName(color) {
    if (mode === 'ai') return color === aiColor ? t('ai') : t('you');
    return color === G.BLACK ? t('black') : t('white');
  }

  function statusText() {
    if (!mode) return t('chooseMode');
    if (over) {
      if (winner === G.EMPTY) return t('draw');
      if (mode === 'ai') return winner === aiColor ? t('aiWins') : t('youWin');
      return fmt('win', { side: sideName(winner) });
    }
    if (mode === 'ai') {
      return aiThinking || turn === aiColor ? t('thinking') : t('yourTurn');
    }
    return fmt('turn', { side: sideName(turn) });
  }

  function modeLabelText() {
    if (mode === 'pvp') return t('modePvp');
    if (mode === 'ai') {
      return fmt('modeAiFull', {
        diff: t(difficulty === 'easy' ? 'diffEasy' : difficulty === 'hard' ? 'diffHard' : 'diffMedium')
      });
    }
    return '-';
  }

  function updateStatusUI() {
    el.statusText.textContent = statusText();
    el.modeLabel.textContent = modeLabelText();
    el.hint.textContent = t('hint');
    if (over) {
      el.turnDot.className = 'turn-dot is-win';
    } else {
      el.turnDot.className = 'turn-dot ' + (turn === G.BLACK ? 'is-black' : 'is-white');
    }
    document.title = GamePlatform.i18n.t({
      zh: '五子棋 · Potato4096 Arcade',
      en: 'Gomoku · Potato4096 Arcade'
    });
  }

  function renderMoveList() {
    if (!history.length) {
      el.moveList.innerHTML = '<div class="move-empty">' + t('noMoves') + '</div>';
      return;
    }
    var rows = [];
    for (var i = 0; i < history.length; i += 2) {
      var no = Math.floor(i / 2) + 1;
      var first = history[i] ? G.coordName(history[i].x, history[i].y) : '';
      var second = history[i + 1] ? G.coordName(history[i + 1].x, history[i + 1].y) : '';
      rows.push(
        '<div class="move-row"><span class="move-no">' + no + '.</span>' +
        '<span class="move-black">' + first + '</span>' +
        '<span class="move-white">' + second + '</span></div>'
      );
    }
    el.moveList.innerHTML = rows.join('');
    el.moveList.scrollTop = el.moveList.scrollHeight;
  }

  function renderStats() {
    var s = loadStats();
    el.statBlack.textContent = String(s.black);
    el.statWhite.textContent = String(s.white);
    el.statDraw.textContent = String(s.draw);
  }

  function applyText() {
    document.querySelectorAll('[data-t]').forEach(function (node) {
      node.textContent = t(node.dataset.t);
    });
    el.badge.textContent = GamePlatform.i18n.getLang() === 'en' ? 'EN' : '中文';
    el.title.textContent = mode === 'ai' ? t('titleAi') : t('title');
    updateStatusUI();
    renderMoveList();
  }

  /* ---------------- 交互 ---------------- */
  function onClick(e) {
    if (!canHumanPlay()) return;
    var cell = pointToCell(e.clientX, e.clientY);
    if (!cell) return;
    if (!G.isEmpty(board, cell.x, cell.y)) return;
    hover = null;
    place(cell.x, cell.y, false);
  }

  function onMove(e) {
    if (!canHumanPlay()) {
      if (hover) { hover = null; render(); }
      return;
    }
    var cell = pointToCell(e.clientX, e.clientY);
    var changed = (!cell && hover) || (cell && (!hover || hover.x !== cell.x || hover.y !== cell.y));
    if (!cell) {
      if (hover) { hover = null; render(); }
      return;
    }
    if (G.isEmpty(board, cell.x, cell.y)) {
      if (changed) { hover = cell; render(); }
    } else if (hover) {
      hover = null;
      render();
    }
  }

  function onLeave() {
    if (hover) { hover = null; render(); }
  }

  /* ---------------- 初始化 ---------------- */
  function setupCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = W * dpr;
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function init() {
    canvas = document.getElementById('board');
    el = {
      statusText: document.getElementById('status-text'),
      turnDot: document.getElementById('turn-dot'),
      hint: document.getElementById('hint'),
      moveList: document.getElementById('move-list'),
      statBlack: document.getElementById('stat-black'),
      statWhite: document.getElementById('stat-white'),
      statDraw: document.getElementById('stat-draw'),
      badge: document.getElementById('lang-badge'),
      title: document.getElementById('game-title'),
      overlay: document.getElementById('mode-overlay'),
      modeLabel: document.getElementById('mode-label')
    };

    setupCanvas();
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    document.getElementById('btn-back').addEventListener('click', function () {
      GamePlatform.navigate.goHome();
    });
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-restart').addEventListener('click', restart);
    document.getElementById('btn-switch-mode').addEventListener('click', showOverlay);
    document.getElementById('btn-mode-pvp').addEventListener('click', function () {
      startGame('pvp');
    });
    document.querySelectorAll('[data-diff]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startGame('ai', btn.dataset.diff);
      });
    });
    document.getElementById('btn-clear').addEventListener('click', function () {
      GamePlatform.storage.clear();
      renderStats();
      GamePlatform.ui.toast(t('cleared'));
    });

    GamePlatform.theme.onChange(function () {
      accentCache = null;
      render();
    });
    GamePlatform.settings.onChange(function () {
      accentCache = null;
      applyText();
      render();
    });
    window.addEventListener('resize', function () { render(); });

    board = G.create();
    turn = G.BLACK;
    history = [];
    lastMove = null;
    hover = null;
    winCells = null;
    over = false;
    winner = G.EMPTY;
    anim = null;
    recorded = false;

    applyText();
    render();
    renderStats();
    renderMoveList();
    updateStatusUI();
  }

  GamePlatform.ready.then(init);
})();
