/**
 * game.js - 国际象棋 · 双人/人机对弈 UI
 * 依赖：platform/game-api.js（GamePlatform）、js/rules.js（Chess）、js/ai.js（ChessAI）
 */
(function () {
  'use strict';

  var X = Chess;

  /* ---------------- 布局常量（逻辑坐标） ---------------- */
  var PAD = 32, CELL = 64;
  var W = PAD * 2 + CELL * 8; // 576
  var H = PAD * 2 + CELL * 8;

  /* ---------------- 主题配色（canvas 用） ---------------- */
  var COLORS = {
    light: {
      sqLight: '#f0d9b5',
      sqDark: '#b58863',
      frame: '#7c5326',
      coord: '#7c5326',
      pieceFillW: '#f7ecd9',
      pieceLineW: '#3a3128',
      glyphW: '#2b2b33',
      pieceFillB: '#2f2b28',
      pieceLineB: '#12100d',
      glyphB: '#f2e6d0',
      selRing: '#4f6df5',
      dot: 'rgba(79, 109, 245, 0.55)',
      captureRing: 'rgba(214, 69, 69, 0.9)',
      lastMove: 'rgba(79, 109, 245, 0.22)',
      check: 'rgba(214, 69, 69, 0.5)'
    },
    dark: {
      sqLight: '#c9a373',
      sqDark: '#845c3a',
      frame: '#3c2c18',
      coord: '#e0c8a0',
      pieceFillW: '#f4e7cf',
      pieceLineW: '#4a4038',
      glyphW: '#26262e',
      pieceFillB: '#22262e',
      pieceLineB: '#0c0e12',
      glyphB: '#f0e2c8',
      selRing: '#7c93ff',
      dot: 'rgba(124, 147, 255, 0.6)',
      captureRing: 'rgba(229, 72, 77, 0.95)',
      lastMove: 'rgba(124, 147, 255, 0.26)',
      check: 'rgba(229, 72, 77, 0.55)'
    }
  };

  /* ---------------- 文案 ---------------- */
  var TEXT = {
    zh: {
      back: '返回主页',
      title: '国际象棋 · 双人对弈',
      white: '白方',
      black: '黑方',
      turn: '{side}走棋',
      check: '{side}被将军！',
      win: '{side}获胜（{reason}）',
      draw: '和棋（{reason}）',
      reasonCheckmate: '将死',
      reasonStalemate: '逼和',
      reasonFifty: '50 回合规则',
      reasonRepetition: '三次重复',
      reasonInsufficient: '子力不足',
      undo: '悔棋',
      restart: '重新开始',
      clear: '清除记录',
      record: '棋谱',
      whiteWins: '白方胜',
      blackWins: '黑方胜',
      draws: '和棋',
      noMoves: '尚未走棋',
      undoEmpty: '没有可悔的棋',
      cleared: '对局记录已清除',
      restarted: '已重新开始',
      hint: '点击己方棋子选中，再点击目标位置落子',
      modeTitle: '选择对局模式',
      modePvp: '双人对弈',
      modePvpSub: '两人轮流走棋',
      modeAi: '人机对战',
      modeAiSub: '你执白先行，电脑执黑',
      modeLabel: '模式',
      switchMode: '切换模式',
      chooseMode: '请选择对局模式',
      diffEasy: '简单',
      diffMedium: '中等',
      diffHard: '困难',
      modeAiFull: '人机对战（{diff}）',
      thinking: '电脑思考中…',
      yourTurn: '轮到你走棋',
      yourCheck: '你被将军！',
      aiCheck: '电脑被将军！',
      youName: '你',
      aiName: '电脑',
      promoTitle: '选择升变棋子'
    },
    en: {
      back: 'Back to Home',
      title: 'Chess · Two Players',
      white: 'White',
      black: 'Black',
      turn: '{side} to move',
      check: '{side} is in check!',
      win: '{side} wins ({reason})',
      draw: 'Draw ({reason})',
      reasonCheckmate: 'checkmate',
      reasonStalemate: 'stalemate',
      reasonFifty: 'fifty-move rule',
      reasonRepetition: 'threefold repetition',
      reasonInsufficient: 'insufficient material',
      undo: 'Undo',
      restart: 'New Game',
      clear: 'Clear Records',
      record: 'Move Record',
      whiteWins: 'White wins',
      blackWins: 'Black wins',
      draws: 'Draws',
      noMoves: 'No moves yet',
      undoEmpty: 'Nothing to undo',
      cleared: 'Records cleared',
      restarted: 'New game started',
      hint: 'Click your piece, then click the destination',
      modeTitle: 'Choose Game Mode',
      modePvp: 'Two Players',
      modePvpSub: 'Take turns on this device',
      modeAi: 'VS Computer',
      modeAiSub: 'You play White and move first',
      modeLabel: 'Mode',
      switchMode: 'Switch Mode',
      chooseMode: 'Choose a game mode to start',
      diffEasy: 'Easy',
      diffMedium: 'Medium',
      diffHard: 'Hard',
      modeAiFull: 'VS Computer ({diff})',
      thinking: 'AI is thinking…',
      yourTurn: 'Your move',
      yourCheck: 'You are in check!',
      aiCheck: 'AI is in check!',
      youName: 'You',
      aiName: 'AI',
      promoTitle: 'Choose Promotion Piece'
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

  function sideName(s) {
    if (mode === 'ai') return s === aiSide ? t('aiName') : t('youName');
    return s === 'w' ? t('white') : t('black');
  }

  /* ---------------- 状态 ---------------- */
  var state, repKeys, selected, legalTargets, history, status, lastMove;
  var anim = null;
  var resultRecorded = false;
  var mode = null;            // 'pvp' | 'ai'，null 表示尚未选择
  var difficulty = 'medium';  // 'easy' | 'medium' | 'hard'
  var aiThinking = false;
  var gameToken = 0;          // 撤销/重开/切换模式后递增，用于作废在途 AI 思考
  var aiSide = 'b';           // 电脑执黑，玩家执白
  var pendingPromo = null;    // 升变待选 { from, to }

  var canvas, ctx;
  var el = {};

  /* ---------------- 音效（WebAudio 程序合成） ---------------- */
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
      g.gain.setValueAtTime(gain || 0.07, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + dur);
    } catch (e) { /* 忽略音频错误 */ }
  }
  function sfxMove() { beep(520, 0.06, 'triangle', 0.09); }
  function sfxCapture() { beep(190, 0.11, 'square', 0.06); }
  function sfxCheck() {
    beep(680, 0.09, 'triangle', 0.09);
    setTimeout(function () { beep(680, 0.11, 'triangle', 0.09); }, 130);
  }
  function sfxWin() {
    [523, 659, 784, 1046].forEach(function (f, i) {
      setTimeout(function () { beep(f, 0.18, 'triangle', 0.08); }, i * 150);
    });
  }
  function sfxDraw() {
    beep(392, 0.16, 'triangle', 0.08);
    setTimeout(function () { beep(330, 0.2, 'triangle', 0.08); }, 180);
  }

  /* ---------------- 坐标换算 ---------------- */
  function cellPx(x, y) {
    return { px: PAD + x * CELL + CELL / 2, py: PAD + y * CELL + CELL / 2 };
  }

  function pointToCell(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var lx = (clientX - rect.left) * (W / rect.width);
    var ly = (clientY - rect.top) * (H / rect.height);
    var x = Math.floor((lx - PAD) / CELL);
    var y = Math.floor((ly - PAD) / CELL);
    if (!X.inBoard(x, y)) return null;
    return { x: x, y: y };
  }

  /* ---------------- 绘制 ---------------- */
  function colors() {
    return COLORS[GamePlatform.theme.get()] || COLORS.light;
  }

  function render() {
    var c = colors();
    ctx.clearRect(0, 0, W, H);

    // 外框
    ctx.fillStyle = c.frame;
    roundRect(ctx, 0, 0, W, H, 10);
    ctx.fill();

    // 棋盘格
    for (var y = 0; y < 8; y++) {
      for (var x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? c.sqLight : c.sqDark;
        ctx.fillRect(PAD + x * CELL, PAD + y * CELL, CELL, CELL);
      }
    }

    drawCoords(c);

    // 上一手高亮
    if (lastMove) {
      [lastMove.from, lastMove.to].forEach(function (m) {
        ctx.fillStyle = c.lastMove;
        ctx.fillRect(PAD + m.x * CELL, PAD + m.y * CELL, CELL, CELL);
      });
    }

    // 被将军的王高亮
    if (!status.over && status.check) {
      var g = X.findKing(state, state.turn);
      if (g) {
        ctx.fillStyle = c.check;
        ctx.fillRect(PAD + g.x * CELL, PAD + g.y * CELL, CELL, CELL);
      }
    }

    // 选中与合法着法
    if (selected) {
      ctx.fillStyle = c.lastMove;
      ctx.fillRect(PAD + selected.x * CELL, PAD + selected.y * CELL, CELL, CELL);
      ctx.strokeStyle = c.selRing;
      ctx.lineWidth = 3;
      ctx.strokeRect(PAD + selected.x * CELL + 2, PAD + selected.y * CELL + 2, CELL - 4, CELL - 4);

      legalTargets.forEach(function (m) {
        var tp = cellPx(m.to.x, m.to.y);
        if (state.board[m.to.y][m.to.x]) {
          ctx.strokeStyle = c.captureRing;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(tp.px, tp.py, CELL * 0.44, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = c.dot;
          ctx.beginPath();
          ctx.arc(tp.px, tp.py, CELL * 0.15, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // 棋子
    for (var y2 = 0; y2 < X.ROWS; y2++) {
      for (var x2 = 0; x2 < X.COLS; x2++) {
        if (anim && anim.to.x === x2 && anim.to.y === y2) continue; // 行进中的棋子稍后画
        var piece = state.board[y2][x2];
        if (piece) {
          var p2 = cellPx(x2, y2);
          drawPiece(p2.px, p2.py, piece, c);
        }
      }
    }

    // 行进动画
    if (anim) {
      var t0 = Math.min(1, (performance.now() - anim.start) / anim.dur);
      var ease = t0 < 0.5 ? 2 * t0 * t0 : -1 + (4 - 2 * t0) * t0;
      var fp = cellPx(anim.from.x, anim.from.y);
      var tp2 = cellPx(anim.to.x, anim.to.y);
      drawPiece(fp.px + (tp2.px - fp.px) * ease, fp.py + (tp2.py - fp.py) * ease, anim.piece, c);
    }
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

  function drawCoords(c) {
    ctx.fillStyle = c.coord;
    ctx.font = '600 13px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var i;
    for (i = 0; i < 8; i++) {
      ctx.fillText('abcdefgh'[i], PAD + i * CELL + CELL / 2, PAD - 16);
      ctx.fillText('abcdefgh'[i], PAD + i * CELL + CELL / 2, PAD + 8 * CELL + 16);
    }
    for (i = 0; i < 8; i++) {
      ctx.fillText(String(8 - i), PAD - 16, PAD + i * CELL + CELL / 2);
      ctx.fillText(String(8 - i), PAD + 8 * CELL + 16, PAD + i * CELL + CELL / 2);
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  function drawPiece(px, py, piece, c) {
    var r = CELL * 0.42;
    var isW = piece.s === 'w';
    // 底圆
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = isW ? c.pieceFillW : c.pieceFillB;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = isW ? c.pieceLineW : c.pieceLineB;
    ctx.stroke();
    // 内圈
    ctx.beginPath();
    ctx.arc(px, py, r * 0.82, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.stroke();
    // 字母
    var ch = X.PIECE_CHARS[piece.s][piece.t];
    ctx.fillStyle = isW ? c.glyphW : c.glyphB;
    ctx.font = 'bold ' + Math.round(CELL * 0.48) + 'px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, px, py + 1);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  /* ---------------- 动画 ---------------- */
  function startAnim(from, to, piece) {
    if (GamePlatform.ui.shouldReduceMotion()) { anim = null; return; }
    anim = { from: from, to: to, piece: piece, start: performance.now(), dur: 160 };
    requestAnimationFrame(animFrame);
  }

  function animFrame() {
    if (!anim) { render(); return; }
    if (performance.now() - anim.start >= anim.dur) {
      anim = null;
      render();
      return;
    }
    render();
    requestAnimationFrame(animFrame);
  }

  /* ---------------- 游戏流程 ---------------- */
  function select(cell) {
    selected = cell;
    legalTargets = X.legalMoves(state, cell.x, cell.y);
    render();
  }

  function deselect() {
    selected = null;
    legalTargets = [];
    render();
  }

  function doMove(from, to, promo) {
    var piece = state.board[from.y][from.x];
    var move = { from: from, to: to };
    if (promo) move.promo = promo;
    var nota = X.notation(state, move);
    var undo = X.makeMove(state, move);
    history.push({ move: move, undo: undo, notation: nota, side: piece.s, captured: undo.captured });
    repKeys.push(X.positionKey(state));
    lastMove = { from: from, to: to };
    selected = null;
    legalTargets = [];
    pendingPromo = null;
    status = X.statusAfter(state, repKeys);

    if (status.over) {
      if (!resultRecorded) {
        saveStats(status.winner);
        resultRecorded = true;
      }
      if (status.winner) sfxWin(); else sfxDraw();
      GamePlatform.ui.toast(statusText());
    } else if (status.check) {
      sfxCheck();
      GamePlatform.ui.toast(statusText());
    } else if (undo.captured) {
      sfxCapture();
    } else {
      sfxMove();
    }

    startAnim(from, to, piece);
    renderMoveList();
    renderStats();
    updateStatusUI();
    render();

    // 人机模式：轮到电脑时调度 AI 思考
    if (mode === 'ai' && !status.over && state.turn === aiSide) scheduleAi();
  }

  function undoOne() {
    var h = history.pop();
    X.undoMove(state, h.move, h.undo);
    repKeys.pop();
    if (resultRecorded) {
      unsaveStats(status.winner);
      resultRecorded = false;
    }
  }

  function undo() {
    // 若 AI 正在思考，作废在途思考
    if (aiThinking) {
      gameToken++;
      aiThinking = false;
    }
    if (!history.length) {
      GamePlatform.ui.toast(t('undoEmpty'));
      return;
    }
    // 人机模式：若最后一手是电脑的，连撤两手把回合交还玩家
    var n = 1;
    if (mode === 'ai' && history[history.length - 1].side === aiSide) n = 2;
    for (var i = 0; i < n && history.length; i++) undoOne();
    selected = null;
    legalTargets = [];
    pendingPromo = null;
    anim = null;
    var prev = history[history.length - 1];
    lastMove = prev ? { from: prev.move.from, to: prev.move.to } : null;
    status = X.statusAfter(state, repKeys);
    render();
    renderMoveList();
    renderStats();
    updateStatusUI();
  }

  function resetGame() {
    gameToken++;
    aiThinking = false;
    state = X.initialState();
    repKeys = [X.positionKey(state)];
    selected = null;
    legalTargets = [];
    history = [];
    lastMove = null;
    anim = null;
    pendingPromo = null;
    resultRecorded = false;
    status = X.statusAfter(state, repKeys);
    render();
    renderMoveList();
    renderStats();
    updateStatusUI();
  }

  function restart() {
    if (!mode) return;
    resetGame();
    GamePlatform.ui.toast(t('restarted'));
    // 重开后白方先行；若将来支持换边可在此扩展
  }

  /** AI 思考调度：异步执行以免卡住 UI */
  function scheduleAi() {
    aiThinking = true;
    updateStatusUI();
    var token = gameToken;
    setTimeout(function () {
      if (token !== gameToken) return; // 已被撤销/重开/切换模式
      var mv = ChessAI.findBestMove(state, { difficulty: difficulty });
      if (token !== gameToken) return;
      aiThinking = false;
      if (mv) doMove(mv.from, mv.to, mv.promo);
    }, 220);
  }

  function startGame(m, diff) {
    mode = m;
    if (diff) difficulty = diff;
    el.overlay.style.display = 'none';
    resetGame();
    updateStatusUI();
  }

  function showOverlay() {
    gameToken++;
    aiThinking = false;
    mode = null;
    el.overlay.style.display = 'flex';
    updateStatusUI();
    render();
  }

  /* ---------------- 存档 ---------------- */
  function loadStats() {
    return GamePlatform.storage.get('stats', { white: 0, black: 0, draw: 0 });
  }

  function saveStats(winner) {
    var s = loadStats();
    if (winner === 'w') s.white = (s.white || 0) + 1;
    else if (winner === 'b') s.black = (s.black || 0) + 1;
    else s.draw = (s.draw || 0) + 1;
    GamePlatform.storage.set('stats', s);
  }

  function unsaveStats(winner) {
    var s = loadStats();
    if (winner === 'w') s.white = Math.max(0, (s.white || 0) - 1);
    else if (winner === 'b') s.black = Math.max(0, (s.black || 0) - 1);
    else s.draw = Math.max(0, (s.draw || 0) - 1);
    GamePlatform.storage.set('stats', s);
  }

  /* ---------------- UI 更新 ---------------- */
  function drawReasonText(reason) {
    return reason === 'stalemate' ? t('reasonStalemate')
      : reason === 'fifty' ? t('reasonFifty')
      : reason === 'repetition' ? t('reasonRepetition')
      : t('reasonInsufficient');
  }

  function statusText() {
    if (!mode) return t('chooseMode');
    if (status.over) {
      if (status.winner) {
        return fmt('win', { side: sideName(status.winner), reason: t('reasonCheckmate') });
      }
      return fmt('draw', { reason: drawReasonText(status.reason) });
    }
    if (mode === 'ai') {
      if (aiThinking || state.turn === aiSide) {
        return status.check ? t('aiCheck') : t('thinking');
      }
      return status.check ? t('yourCheck') : t('yourTurn');
    }
    if (status.check) return fmt('check', { side: sideName(state.turn) });
    return fmt('turn', { side: sideName(state.turn) });
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
    if (status.over) {
      el.turnDot.className = 'turn-dot is-win';
    } else {
      el.turnDot.className = 'turn-dot ' + (state.turn === 'w' ? 'is-white' : 'is-black');
    }
    el.hint.textContent = t('hint');
  }

  function renderMoveList() {
    if (!history.length) {
      el.moveList.innerHTML = '<div class="move-empty">' + t('noMoves') + '</div>';
      return;
    }
    var rows = [];
    for (var i = 0; i < history.length; i += 2) {
      var no = Math.floor(i / 2) + 1;
      var w = history[i] ? history[i].notation : '';
      var b = history[i + 1] ? history[i + 1].notation : '';
      rows.push(
        '<div class="move-row"><span class="move-no">' + no + '.</span>' +
        '<span class="move-white">' + w + '</span>' +
        '<span class="move-black">' + b + '</span></div>'
      );
    }
    el.moveList.innerHTML = rows.join('');
    el.moveList.scrollTop = el.moveList.scrollHeight;
  }

  function renderStats() {
    var s = loadStats();
    el.statWhite.textContent = String(s.white || 0);
    el.statBlack.textContent = String(s.black || 0);
    el.statDraw.textContent = String(s.draw || 0);
  }

  function applyText() {
    document.querySelectorAll('[data-t]').forEach(function (node) {
      node.textContent = t(node.dataset.t);
    });
    el.badge.textContent = GamePlatform.i18n.getLang() === 'en' ? 'EN' : '中文';
    el.title.textContent = t('title');
    updateStatusUI();
    renderMoveList();
    document.title = GamePlatform.i18n.t({
      zh: '国际象棋 · Potato4096 Arcade',
      en: 'Chess · Potato4096 Arcade'
    });
  }

  /* ---------------- 初始化 ---------------- */
  function setupCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function onClick(e) {
    if (!mode || aiThinking || anim || status.over || pendingPromo) return;
    var cell = pointToCell(e.clientX, e.clientY);
    if (!cell) return;
    var piece = state.board[cell.y][cell.x];

    if (selected) {
      var candidates = legalTargets.filter(function (m) {
        return m.to.x === cell.x && m.to.y === cell.y;
      });
      if (candidates.length) {
        // 升变：弹出棋子选择
        if (candidates.some(function (m) { return m.promo; })) {
          pendingPromo = { from: selected, to: cell };
          el.promoOverlay.style.display = 'flex';
          return;
        }
        doMove(selected, cell);
        return;
      }
      if (piece && piece.s === state.turn) {
        select(cell);
        return;
      }
      deselect();
      return;
    }
    if (piece && piece.s === state.turn) select(cell);
  }

  function onPromoClick(e) {
    var btn = e.currentTarget;
    if (!pendingPromo) return;
    var promo = btn.dataset.promo;
    el.promoOverlay.style.display = 'none';
    doMove(pendingPromo.from, pendingPromo.to, promo);
  }

  function init() {
    canvas = document.getElementById('board');
    el = {
      statusText: document.getElementById('status-text'),
      turnDot: document.getElementById('turn-dot'),
      hint: document.getElementById('hint'),
      moveList: document.getElementById('move-list'),
      statWhite: document.getElementById('stat-white'),
      statBlack: document.getElementById('stat-black'),
      statDraw: document.getElementById('stat-draw'),
      badge: document.getElementById('lang-badge'),
      title: document.getElementById('game-title'),
      overlay: document.getElementById('mode-overlay'),
      modeLabel: document.getElementById('mode-label'),
      promoOverlay: document.getElementById('promo-overlay')
    };

    setupCanvas();
    canvas.addEventListener('click', onClick);

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
    document.querySelectorAll('[data-promo]').forEach(function (btn) {
      btn.addEventListener('click', onPromoClick);
    });
    document.getElementById('btn-clear').addEventListener('click', function () {
      GamePlatform.storage.clear();
      renderStats();
      GamePlatform.ui.toast(t('cleared'));
    });

    // 主题 / 语言变化
    GamePlatform.theme.onChange(function () { render(); });
    GamePlatform.settings.onChange(function () {
      applyText();
      render();
    });

    resetGame();
    // mode 保持 null：显示模式选择浮层，选择后才开始

    applyText();
    render();
    renderStats();
    renderMoveList();
    updateStatusUI();
  }

  GamePlatform.ready.then(init);
})();
