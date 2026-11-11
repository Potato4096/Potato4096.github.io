/**
 * game.js - 围棋 UI 与对局流程
 * 依赖：platform/game-api.js（GamePlatform）、js/rules.js（GoRules）、js/ai.js（GoAI）
 */
(function () {
  'use strict';

  var R = GoRules;
  var AI = GoAI;

  var W = 600;

  /* ---------------- 棋盘配色（明暗两套） ---------------- */
  var BOARDS = {
    light: {
      bgFrom: '#eed3a1',
      bgTo: '#dfb87c',
      edge: '#b98e55',
      line: '#8a6234',
      star: '#6f4a20',
      label: '#7b5427',
      grain: 'rgba(150, 104, 48, 0.09)'
    },
    dark: {
      bgFrom: '#71573b',
      bgTo: '#5c442c',
      edge: '#3f2d1c',
      line: '#d9bd92',
      star: '#d3b487',
      label: '#c8a97c',
      grain: 'rgba(255, 226, 178, 0.05)'
    }
  };

  /* ---------------- 文案 ---------------- */
  var TEXT = {
    zh: {
      back: '返回主页',
      title: '围棋 · 双人对弈',
      titleAi: '围棋 · 人机对战',
      black: '黑方',
      white: '白方',
      you: '你',
      ai: '电脑',
      turn: '{side}落子',
      thinking: '电脑思考中…',
      yourTurn: '轮到你落子',
      undo: '悔棋',
      pass: '虚手',
      resign: '认输',
      restart: '重新开始',
      clear: '清除记录',
      record: '棋谱',
      noMoves: '尚未落子',
      undoEmpty: '没有可悔的棋',
      cleared: '对局记录已清除',
      restarted: '已重新开始',
      hint: '点击交叉点落子；连续两次虚手即进入终局计分（中国规则数子法）',
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
      boardSize: '棋盘',
      blackCaptures: '黑提',
      whiteCaptures: '白提',
      komiLabel: '贴目',
      moveCount: '第 {n} 手',
      passMove: '虚手',
      passToast: '{side}虚手',
      passBoth: '双方连续虚手，进入终局计分',
      resigned: '{side}认输',
      resignResult: '{loser}认输，{winner}获胜',
      scoreResult: '{winner}胜 {margin} 目',
      draw: '和棋',
      again: '再来一局',
      review: '查看棋盘',
      resultTitle: '对局结束',
      scoreDetail: '子 {stones} + 空 {territory}',
      scoreDetailKomi: '子 {stones} + 空 {territory} + 贴目 {komi}',
      komiNote: '中国规则数子法，黑贴 7.5 目；终局按当前盘面估算，未收完的边界可能影响结果。',
      resignNote: '本局以认输结束，未进行数子。',
      statsNote: '累计战绩：黑胜 {black} · 白胜 {white}',
      illegalKo: '打劫：不能立即回提',
      illegalSuicide: '禁着点：不能自杀',
      illegalOccupied: '该点已有棋子',
      boardChanged: '已切换为 {n} 路棋盘',
      captured: '提 {n} 子'
    },
    en: {
      back: 'Back to Home',
      title: 'Go · Two Players',
      titleAi: 'Go · VS Computer',
      black: 'Black',
      white: 'White',
      you: 'You',
      ai: 'AI',
      turn: '{side} to play',
      thinking: 'AI is thinking…',
      yourTurn: 'Your move',
      undo: 'Undo',
      pass: 'Pass',
      resign: 'Resign',
      restart: 'New Game',
      clear: 'Clear Records',
      record: 'Move Record',
      noMoves: 'No moves yet',
      undoEmpty: 'Nothing to undo',
      cleared: 'Records cleared',
      restarted: 'New game started',
      hint: 'Click an intersection. Two consecutive passes end the game and trigger Chinese area scoring.',
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
      boardSize: 'Board',
      blackCaptures: 'Black caps',
      whiteCaptures: 'White caps',
      komiLabel: 'Komi',
      moveCount: 'Move {n}',
      passMove: 'pass',
      passToast: '{side} passes',
      passBoth: 'Both sides passed - scoring the board',
      resigned: '{side} resigned',
      resignResult: '{loser} resigned - {winner} wins',
      scoreResult: '{winner} wins by {margin}',
      draw: 'Draw',
      again: 'Play Again',
      review: 'View Board',
      resultTitle: 'Game Over',
      scoreDetail: 'stones {stones} + territory {territory}',
      scoreDetailKomi: 'stones {stones} + territory {territory} + komi {komi}',
      komiNote: 'Chinese area scoring, komi 7.5. Final count is estimated from the current board; unfinished borders may affect the result.',
      resignNote: 'The game ended by resignation, so no counting was performed.',
      statsNote: 'Record: Black {black} · White {white}',
      illegalKo: 'Ko: cannot recapture immediately',
      illegalSuicide: 'Suicide is not allowed here',
      illegalOccupied: 'That point is occupied',
      boardChanged: 'Switched to {n}x{n} board',
      captured: 'captured {n}'
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

  /* ---------------- 状态 ---------------- */
  var size = 19;
  var board;
  var turn;
  var captures;      // [_, 黑提子数, 白提子数]
  var ko;
  var passes;
  var history;       // {x,y,color,captured} 或 {pass:true,color}
  var snapshots;     // 每手前的完整状态
  var lastMove;
  var over;
  var winner;
  var resultInfo;
  var anim;

  var mode = null;
  var difficulty = 'medium';
  var aiColor = R.WHITE;
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

  function sfxPlace() { beep(600, 0.05, 'triangle', 0.08); }
  function sfxCapture() { beep(260, 0.12, 'square', 0.055); }
  function sfxPass() { beep(380, 0.07, 'sine', 0.05); }
  function sfxError() { beep(160, 0.12, 'sawtooth', 0.05); }
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
        muted: cssVar('--pg-text-muted', '#5b6474')
      };
    }
    return accentCache;
  }

  /* ---------------- 几何 ---------------- */
  function metrics() {
    var pad = size >= 19 ? 32 : size >= 13 ? 38 : 46;
    return { pad: pad, cell: (W - pad * 2) / (size - 1) };
  }

  function cellPx(x, y) {
    var m = metrics();
    return { px: m.pad + x * m.cell, py: m.pad + y * m.cell };
  }

  function pointToCell(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !board) return null;
    var m = metrics();
    var lx = (clientX - rect.left) * (W / rect.width);
    var ly = (clientY - rect.top) * (W / rect.height);
    var x = Math.round((lx - m.pad) / m.cell);
    var y = Math.round((ly - m.pad) / m.cell);
    if (!R.inBoard(size, x, y)) return null;
    var p = cellPx(x, y);
    if (Math.abs(lx - p.px) > m.cell * 0.5 || Math.abs(ly - p.py) > m.cell * 0.5) return null;
    return { x: x, y: y };
  }

  /* ---------------- 绘制 ---------------- */
  function render() {
    if (!ctx) return;
    var c = palette();
    var ac = accentColor();
    var m = metrics();
    var end = m.pad + m.cell * (size - 1);

    ctx.clearRect(0, 0, W, W);

    var grad = ctx.createLinearGradient(0, 0, W, W);
    grad.addColorStop(0, c.bgFrom);
    grad.addColorStop(1, c.bgTo);
    ctx.fillStyle = grad;
    roundRect(ctx, 0, 0, W, W, 10);
    ctx.fill();

    // 木纹
    ctx.strokeStyle = c.grain;
    ctx.lineWidth = 7;
    for (var i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(10, 80 + i * 150);
      ctx.bezierCurveTo(W * 0.3, 60 + i * 150, W * 0.68, 110 + i * 150, W - 10, 78 + i * 150);
      ctx.stroke();
    }

    drawGrid(c, m, end);
    drawStars(c, m);
    drawLabels(c, m);

    // 悬停预览
    if (hover && !over && canHumanPlay() && board[R.idx(size, hover.x, hover.y)] === R.EMPTY) {
      var hp = cellPx(hover.x, hover.y);
      ctx.globalAlpha = 0.3;
      drawStone(hp.px, hp.py, turn, m.cell);
      ctx.globalAlpha = 1;
    }

    var animStone = null;
    if (anim) {
      var p = Math.min(1, (performance.now() - anim.start) / anim.dur);
      if (p >= 1) anim = null;
      else animStone = { x: anim.x, y: anim.y, color: anim.color, scale: 0.6 + 0.4 * easeOut(p) };
    }

    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var v = board[R.idx(size, x, y)];
        if (!v) continue;
        var pt = cellPx(x, y);
        if (animStone && animStone.x === x && animStone.y === y) {
          drawStone(pt.px, pt.py, v, m.cell, animStone.scale);
        } else {
          drawStone(pt.px, pt.py, v, m.cell);
        }
      }
    }

    if (lastMove) {
      var lp = cellPx(lastMove.x, lastMove.y);
      ctx.beginPath();
      ctx.arc(lp.px, lp.py, Math.max(2.5, m.cell * 0.11), 0, Math.PI * 2);
      ctx.fillStyle = ac.danger;
      ctx.fill();
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

  function drawGrid(c, m, end) {
    ctx.strokeStyle = c.line;
    ctx.lineWidth = size >= 19 ? 0.9 : 1.1;
    for (var i = 0; i < size; i++) {
      var p = m.pad + i * m.cell;
      ctx.beginPath();
      ctx.moveTo(m.pad, p);
      ctx.lineTo(end, p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, m.pad);
      ctx.lineTo(p, end);
      ctx.stroke();
    }
    ctx.lineWidth = size >= 19 ? 1.7 : 2;
    ctx.strokeRect(m.pad, m.pad, end - m.pad, end - m.pad);
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(3, 3, W - 6, W - 6);
  }

  function drawStars(c, m) {
    var stars = R.starPoints(size);
    ctx.fillStyle = c.star;
    stars.forEach(function (s) {
      var q = cellPx(s[0], s[1]);
      ctx.beginPath();
      ctx.arc(q.px, q.py, Math.max(2.2, m.cell * 0.1), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawLabels(c, m) {
    ctx.fillStyle = c.label;
    ctx.font = (size >= 19 ? 10 : 11) + 'px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < size; i++) {
      var p = m.pad + i * m.cell;
      ctx.fillText(R.colName(i), p, W - m.pad * 0.45);
      ctx.fillText(String(size - i), m.pad * 0.45, p);
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  function drawStone(px, py, color, cell, scale) {
    var r = cell * 0.47 * (scale || 1);
    ctx.beginPath();
    ctx.arc(px + 0.8, py + 1.8, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.fill();

    var g = ctx.createRadialGradient(px - r * 0.35, py - r * 0.4, r * 0.1, px, py, r);
    if (color === R.BLACK) {
      g.addColorStop(0, '#7d858f');
      g.addColorStop(0.45, '#343b45');
      g.addColorStop(1, '#12161b');
    } else {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.55, '#f3f5f8');
      g.addColorStop(1, '#c7cdd8');
    }
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = color === R.BLACK ? 'rgba(0,0,0,0.5)' : 'rgba(140,150,165,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  /* ---------------- 对局流程 ---------------- */
  function canHumanPlay() {
    if (!mode || over || aiThinking) return false;
    if (mode === 'ai' && turn === aiColor) return false;
    return true;
  }

  function snapshot() {
    return {
      board: R.clone(board),
      captures: captures.slice(),
      ko: ko,
      turn: turn,
      passes: passes,
      lastMove: lastMove
    };
  }

  function restore(s) {
    board = s.board;
    captures = s.captures.slice();
    ko = s.ko;
    turn = s.turn;
    passes = s.passes;
    lastMove = s.lastMove;
    anim = null;
  }

  function reasonText(reason) {
    if (reason === 'ko') return t('illegalKo');
    if (reason === 'suicide') return t('illegalSuicide');
    if (reason === 'occupied') return t('illegalOccupied');
    return String(reason || '');
  }

  function tryPlace(x, y, byAi) {
    if (over) return false;
    var res = R.play(board, size, x, y, turn, ko);
    if (!res.ok) {
      if (!byAi) {
        sfxError();
        GamePlatform.ui.toast(reasonText(res.reason));
      }
      return false;
    }

    snapshots.push(snapshot());
    var color = turn;
    board = res.board;
    captures[color] += res.captured.length;
    ko = res.ko;
    passes = 0;
    lastMove = { x: x, y: y };
    history.push({ x: x, y: y, color: color, captured: res.captured.length });
    anim = { x: x, y: y, color: color, start: performance.now(), dur: 170 };
    turn = R.opponent(color);

    if (res.captured.length) sfxCapture();
    else if (byAi) beep(540, 0.05, 'triangle', 0.06);
    else sfxPlace();

    if (res.captured.length && !byAi) {
      GamePlatform.ui.toast(fmt('captured', { n: res.captured.length }));
    }

    render();
    renderMoveList();
    renderStats();
    updateStatusUI();
    scheduleAi();
    return true;
  }

  function doPass(color, byAi) {
    if (over) return;
    snapshots.push(snapshot());
    history.push({ pass: true, color: color });
    passes++;
    ko = -1;
    lastMove = null;
    turn = R.opponent(color);
    anim = null;
    sfxPass();

    render();
    renderMoveList();
    renderStats();
    updateStatusUI();

    if (passes >= 2) {
      GamePlatform.ui.toast(t('passBoth'));
      endByScore();
      return;
    }
    if (!byAi) GamePlatform.ui.toast(fmt('passToast', { side: sideName(color) }));
    scheduleAi();
  }

  function resign() {
    if (!mode || over) return;
    gameToken++;
    aiThinking = false;
    over = true;
    winner = R.opponent(turn);
    resultInfo = { type: 'resign', loser: turn, winner: winner };
    history.push({ pass: false, resign: true, color: turn });
    recordResult(winner);
    showResult();
    updateStatusUI();
    renderMoveList();
    GamePlatform.ui.toast(fmt('resigned', { side: sideName(turn) }));
  }

  function endByScore() {
    var s = R.score(board, size, R.KOMI);
    over = true;
    winner = s.winner;
    resultInfo = { type: 'score', score: s };
    recordResult(winner);
    sfxWin();
    showResult();
    updateStatusUI();
    render();
  }

  function undo() {
    gameToken++;
    aiThinking = false;
    if (!snapshots.length) {
      GamePlatform.ui.toast(t('undoEmpty'));
      return;
    }
    restore(snapshots.pop());
    history.pop();
    over = false;
    winner = R.EMPTY;
    resultInfo = null;
    hideResult();

    // 人机模式：撤回后若轮到电脑，再撤一手把回合交还玩家
    if (mode === 'ai' && turn === aiColor && snapshots.length) {
      restore(snapshots.pop());
      history.pop();
    }

    render();
    renderMoveList();
    renderStats();
    updateStatusUI();
  }

  function resetGame() {
    gameToken++;
    aiThinking = false;
    board = R.create(size);
    turn = R.BLACK;
    captures = [0, 0, 0];
    ko = -1;
    passes = 0;
    history = [];
    snapshots = [];
    lastMove = null;
    over = false;
    winner = R.EMPTY;
    resultInfo = null;
    anim = null;
    hover = null;
    hideResult();
    render();
    renderMoveList();
    renderStats();
    updateStatusUI();
  }

  function setSize(n) {
    if (n === size) return;
    size = n;
    syncSizeButtons();
    resetGame();
    GamePlatform.ui.toast(fmt('boardChanged', { n: n }));
  }

  function syncSizeButtons() {
    document.querySelectorAll('[data-size]').forEach(function (btn) {
      btn.classList.toggle('is-active', Number(btn.dataset.size) === size);
    });
  }

  function scheduleAi() {
    if (mode !== 'ai' || over) return;
    if (turn !== aiColor) return;
    aiThinking = true;
    updateStatusUI();
    var token = gameToken;

    setTimeout(function () {
      if (token !== gameToken) return;

      // 对手刚虚手：若电脑已领先，一并虚手结束对局
      if (passes >= 1) {
        var s = R.score(board, size, R.KOMI);
        var mine = aiColor === R.BLACK ? s.black.total : s.white.total;
        var theirs = aiColor === R.BLACK ? s.white.total : s.black.total;
        if (mine >= theirs) {
          aiThinking = false;
          doPass(aiColor, true);
          return;
        }
      }

      var mv = null;
      try {
        mv = AI.findMove(board, size, aiColor, { difficulty: difficulty, ko: ko });
      } catch (e) {
        console.error('[go] AI error', e);
      }
      if (token !== gameToken) return;
      aiThinking = false;

      if (!mv) {
        doPass(aiColor, true);
        return;
      }
      if (!tryPlace(mv.x, mv.y, true)) {
        // 兜底：AI 给出不可落子的点，改为虚手，避免卡死
        doPass(aiColor, true);
      }
    }, 320);
  }

  function startGame(m, diff) {
    mode = m;
    if (diff) difficulty = diff;
    el.overlay.style.display = 'none';
    resetGame();
    applyText();
  }

  function showModeOverlay() {
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
    if (!s || typeof s !== 'object') s = {};
    return { black: s.black || 0, white: s.white || 0 };
  }

  function recordResult(color) {
    var s = loadStats();
    if (color === R.BLACK) s.black++;
    else if (color === R.WHITE) s.white++;
    else return;
    GamePlatform.storage.set('stats', s);
  }

  /* ---------------- UI ---------------- */
  function sideName(color) {
    if (mode === 'ai') return color === aiColor ? t('ai') : t('you');
    return color === R.BLACK ? t('black') : t('white');
  }

  function colorName(color) {
    return color === R.BLACK ? t('black') : t('white');
  }

  function resultLine() {
    if (!resultInfo) return '';
    if (resultInfo.type === 'resign') {
      return fmt('resignResult', {
        loser: sideName(resultInfo.loser),
        winner: sideName(resultInfo.winner)
      });
    }
    var s = resultInfo.score;
    if (s.winner === R.EMPTY) return t('draw');
    return fmt('scoreResult', {
      winner: colorName(s.winner),
      margin: s.margin.toFixed(1)
    });
  }

  function statusText() {
    if (!mode) return t('chooseMode');
    if (over) return resultLine() || t('resultTitle');
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
    el.moveCount.textContent = fmt('moveCount', { n: history.length });
    if (over) el.turnDot.className = 'turn-dot is-win';
    else el.turnDot.className = 'turn-dot ' + (turn === R.BLACK ? 'is-black' : 'is-white');
    el.btnPass.disabled = !mode || over || (mode === 'ai' && turn === aiColor);
    el.btnResign.disabled = !mode || over;
    document.title = GamePlatform.i18n.t({
      zh: '围棋 · Potato4096 Arcade',
      en: 'Go · Potato4096 Arcade'
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
      rows.push(
        '<div class="move-row"><span class="move-no">' + no + '.</span>' +
        '<span class="move-black">' + moveLabel(history[i]) + '</span>' +
        '<span class="move-white">' + moveLabel(history[i + 1]) + '</span></div>'
      );
    }
    el.moveList.innerHTML = rows.join('');
    el.moveList.scrollTop = el.moveList.scrollHeight;
  }

  function moveLabel(mv) {
    if (!mv) return '';
    if (mv.resign) return t('resign');
    if (mv.pass) return t('passMove');
    return R.coordName(size, mv.x, mv.y) + (mv.captured ? '×' + mv.captured : '');
  }

  function renderStats() {
    el.capBlack.textContent = String(captures[1]);
    el.capWhite.textContent = String(captures[2]);
  }

  function scoreLine(color, data, s) {
    var isWin = s.winner === color;
    var detail = color === R.WHITE
      ? fmt('scoreDetailKomi', {
          stones: data.stones,
          territory: data.territory,
          komi: s.komi.toFixed(1)
        })
      : fmt('scoreDetail', { stones: data.stones, territory: data.territory });
    return '<div class="score-line' + (isWin ? ' is-win' : '') + '">' +
      '<span class="stone-dot ' + (color === R.BLACK ? 'black' : 'white') + '"></span>' +
      '<span class="score-name">' + colorName(color) + '</span>' +
      '<span class="score-detail">' + detail + '</span>' +
      '<span class="score-total">' + data.total.toFixed(1) + '</span>' +
      '</div>';
  }

  function showResult() {
    if (!resultInfo) return;
    var html = '';
    if (resultInfo.type === 'score') {
      var s = resultInfo.score;
      html = scoreLine(R.BLACK, s.black, s) + scoreLine(R.WHITE, s.white, s) +
        '<div class="result-meta">' + t('komiNote') + '</div>';
    } else {
      html = '<div class="result-meta">' + t('resignNote') + '</div>';
    }
    var st = loadStats();
    html += '<div class="result-meta">' + fmt('statsNote', { black: st.black, white: st.white }) + '</div>';

    el.resultTitle.textContent = resultLine() || t('resultTitle');
    el.scoreTable.innerHTML = html;
    el.resultOverlay.classList.add('is-open');
  }

  function hideResult() {
    el.resultOverlay.classList.remove('is-open');
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
  var hover = null;

  function onClick(e) {
    if (!canHumanPlay()) return;
    var cell = pointToCell(e.clientX, e.clientY);
    if (!cell) return;
    hover = null;
    tryPlace(cell.x, cell.y, false);
  }

  function onMove(e) {
    if (!canHumanPlay()) {
      if (hover) { hover = null; render(); }
      return;
    }
    var cell = pointToCell(e.clientX, e.clientY);
    if (!cell || board[R.idx(size, cell.x, cell.y)] !== R.EMPTY) {
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
      moveCount: document.getElementById('move-count'),
      hint: document.getElementById('hint'),
      moveList: document.getElementById('move-list'),
      capBlack: document.getElementById('cap-black'),
      capWhite: document.getElementById('cap-white'),
      badge: document.getElementById('lang-badge'),
      title: document.getElementById('game-title'),
      overlay: document.getElementById('mode-overlay'),
      modeLabel: document.getElementById('mode-label'),
      btnPass: document.getElementById('btn-pass'),
      btnResign: document.getElementById('btn-resign'),
      resultOverlay: document.getElementById('result-overlay'),
      resultTitle: document.getElementById('result-title'),
      scoreTable: document.getElementById('score-table')
    };

    setupCanvas();
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    document.getElementById('btn-back').addEventListener('click', function () {
      GamePlatform.navigate.goHome();
    });
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-restart').addEventListener('click', function () {
      if (!mode) return;
      resetGame();
      GamePlatform.ui.toast(t('restarted'));
    });
    document.getElementById('btn-pass').addEventListener('click', function () {
      if (!canHumanPlay()) return;
      doPass(turn, false);
    });
    document.getElementById('btn-resign').addEventListener('click', resign);
    document.getElementById('btn-switch-mode').addEventListener('click', showModeOverlay);
    document.getElementById('btn-mode-pvp').addEventListener('click', function () {
      startGame('pvp');
    });
    document.querySelectorAll('[data-diff]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        startGame('ai', btn.dataset.diff);
      });
    });
    document.querySelectorAll('[data-size]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setSize(Number(btn.dataset.size));
      });
    });
    document.getElementById('btn-clear').addEventListener('click', function () {
      GamePlatform.storage.clear();
      renderStats();
      GamePlatform.ui.toast(t('cleared'));
    });
    document.getElementById('btn-again').addEventListener('click', function () {
      if (!mode) return;
      resetGame();
    });
    document.getElementById('btn-review').addEventListener('click', hideResult);

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

    resetGame();
    syncSizeButtons();
    applyText();
  }

  GamePlatform.ready.then(init);
})();
