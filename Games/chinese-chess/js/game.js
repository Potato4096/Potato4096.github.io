/**
 * game.js - 中国象棋 · 双人对弈 UI
 * 依赖：platform/game-api.js（GamePlatform）、js/rules.js（Xiangqi）
 */
(function () {
  'use strict';

  var X = Xiangqi;

  /* ---------------- 布局常量（逻辑坐标） ---------------- */
  var PAD = 44, CELL = 56;
  var W = PAD * 2 + CELL * 8; // 536
  var H = PAD * 2 + CELL * 9; // 592

  /* ---------------- 主题配色（canvas 用） ---------------- */
  var COLORS = {
    light: {
      board: '#e9c78d',
      boardEdge: '#b0834c',
      line: '#7c5326',
      mark: '#7c5326',
      river: '#7c5326',
      pieceFill: '#fdf3dd',
      pieceRed: '#c62828',
      pieceBlack: '#263238',
      selRing: '#4f6df5',
      dot: 'rgba(79, 109, 245, 0.55)',
      captureRing: 'rgba(214, 69, 69, 0.9)',
      lastMove: 'rgba(79, 109, 245, 0.22)',
      check: 'rgba(214, 69, 69, 0.5)'
    },
    dark: {
      board: '#6d5137',
      boardEdge: '#43301c',
      line: '#dcbd8f',
      mark: '#dcbd8f',
      river: '#dcbd8f',
      pieceFill: '#f4e7cf',
      pieceRed: '#e25656',
      pieceBlack: '#22262e',
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
      title: '中国象棋 · 双人对弈',
      red: '红方',
      black: '黑方',
      turn: '{side}走棋',
      check: '{side}被将军！',
      win: '{side}获胜（{reason}）',
      reasonCheckmate: '将死',
      reasonStalemate: '困毙',
      reasonCapture: '将被吃',
      undo: '悔棋',
      restart: '重新开始',
      clear: '清除记录',
      record: '棋谱',
      redWins: '红方胜',
      blackWins: '黑方胜',
      noMoves: '尚未走棋',
      undoEmpty: '没有可悔的棋',
      cleared: '对局记录已清除',
      restarted: '已重新开始',
      hint: '点击己方棋子选中，再点击目标位置落子'
    },
    en: {
      back: 'Back to Home',
      title: 'Chinese Chess · Two Players',
      red: 'Red',
      black: 'Black',
      turn: '{side} to move',
      check: '{side} is in check!',
      win: '{side} wins ({reason})',
      reasonCheckmate: 'checkmate',
      reasonStalemate: 'stalemate',
      reasonCapture: 'general captured',
      undo: 'Undo',
      restart: 'New Game',
      clear: 'Clear Records',
      record: 'Move Record',
      redWins: 'Red wins',
      blackWins: 'Black wins',
      noMoves: 'No moves yet',
      undoEmpty: 'Nothing to undo',
      cleared: 'Records cleared',
      restarted: 'New game started',
      hint: 'Click your piece, then click the destination'
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

  function sideName(s) { return s === 'r' ? t('red') : t('black'); }

  /* ---------------- 状态 ---------------- */
  var board, turn, selected, legalTargets, history, status, lastMove;
  var anim = null;
  var resultRecorded = false;

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

  /* ---------------- 坐标换算 ---------------- */
  function cellPx(x, y) {
    return { px: PAD + x * CELL, py: PAD + y * CELL };
  }

  function pointToCell(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var lx = (clientX - rect.left) * (W / rect.width);
    var ly = (clientY - rect.top) * (H / rect.height);
    var x = Math.round((lx - PAD) / CELL);
    var y = Math.round((ly - PAD) / CELL);
    if (!X.inBoard(x, y)) return null;
    // 允许落在交点附近（半个格子内）
    var c = cellPx(x, y);
    if (Math.abs(lx - c.px) > CELL * 0.55 || Math.abs(ly - c.py) > CELL * 0.55) return null;
    return { x: x, y: y };
  }

  /* ---------------- 绘制 ---------------- */
  function colors() {
    return COLORS[GamePlatform.theme.get()] || COLORS.light;
  }

  function render() {
    var c = colors();
    ctx.clearRect(0, 0, W, H);

    // 棋盘底
    ctx.fillStyle = c.board;
    roundRect(ctx, 0, 0, W, H, 10);
    ctx.fill();

    drawGrid(c);
    drawMarks(c);
    drawRiver(c);

    // 高亮
    if (lastMove) {
      [lastMove.from, lastMove.to].forEach(function (m) {
        var p = cellPx(m.x, m.y);
        ctx.fillStyle = c.lastMove;
        ctx.beginPath();
        ctx.arc(p.px, p.py, CELL * 0.46, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (selected) {
      var sp = cellPx(selected.x, selected.y);
      ctx.strokeStyle = c.selRing;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sp.px, sp.py, CELL * 0.47, 0, Math.PI * 2);
      ctx.stroke();

      legalTargets.forEach(function (m) {
        var tp = cellPx(m.x, m.y);
        if (board[m.y][m.x]) {
          // 吃子目标
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

    // 被将军的将帅高亮
    if (!status.over && status.check) {
      var g = X.findGeneral(board, turn);
      if (g) {
        var gp = cellPx(g.x, g.y);
        ctx.strokeStyle = c.check;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(gp.px, gp.py, CELL * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 棋子
    for (var y = 0; y < X.ROWS; y++) {
      for (var x = 0; x < X.COLS; x++) {
        if (anim && anim.to.x === x && anim.to.y === y) continue; // 行进中的棋子稍后画
        var piece = board[y][x];
        if (piece) {
          var p2 = cellPx(x, y);
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

  function drawGrid(c) {
    var x0 = PAD, y0 = PAD, x1 = PAD + 8 * CELL, y1 = PAD + 9 * CELL;
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1.4;

    // 横线（10 条）
    for (var y = 0; y <= 9; y++) {
      line(x0, y0 + y * CELL, x1, y0 + y * CELL);
    }
    // 竖线：边列贯通，中间列在河界断开
    for (var x = 0; x <= 8; x++) {
      if (x === 0 || x === 8) {
        line(x0 + x * CELL, y0, x0 + x * CELL, y1);
      } else {
        line(x0 + x * CELL, y0, x0 + x * CELL, y0 + 4 * CELL);
        line(x0 + x * CELL, y0 + 5 * CELL, x0 + x * CELL, y1);
      }
    }
    // 外框加粗
    ctx.lineWidth = 2.4;
    ctx.strokeRect(x0, y0, 8 * CELL, 9 * CELL);

    // 九宫斜线
    ctx.lineWidth = 1.4;
    line(x0 + 3 * CELL, y0, x0 + 5 * CELL, y0 + 2 * CELL);
    line(x0 + 5 * CELL, y0, x0 + 3 * CELL, y0 + 2 * CELL);
    line(x0 + 3 * CELL, y0 + 7 * CELL, x0 + 5 * CELL, y0 + 9 * CELL);
    line(x0 + 5 * CELL, y0 + 7 * CELL, x0 + 3 * CELL, y0 + 9 * CELL);
  }

  function line(ax, ay, bx, by) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  /** 炮位 / 兵位 的四角标记 */
  function drawMarks(c) {
    var points = [
      [1, 2], [7, 2], [1, 7], [7, 7],
      [0, 3], [2, 3], [4, 3], [6, 3], [8, 3],
      [0, 6], [2, 6], [4, 6], [6, 6], [8, 6]
    ];
    ctx.strokeStyle = c.mark;
    ctx.lineWidth = 1.4;
    points.forEach(function (pt) {
      var p = cellPx(pt[0], pt[1]);
      var g = 5, arm = 8;
      var quads = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      quads.forEach(function (q) {
        if ((pt[0] === 0 && q[0] === -1) || (pt[0] === 8 && q[0] === 1)) return; // 贴边不画
        ctx.beginPath();
        ctx.moveTo(p.px + q[0] * g, p.py + q[1] * (g + arm));
        ctx.lineTo(p.px + q[0] * g, p.py + q[1] * g);
        ctx.lineTo(p.px + q[0] * (g + arm), p.py + q[1] * g);
        ctx.stroke();
      });
    });
  }

  function drawRiver(c) {
    var riverY = PAD + 4.5 * CELL;
    ctx.fillStyle = c.river;
    ctx.font = 'bold 26px "KaiTi", "STKaiti", "Microsoft YaHei", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('楚  河', PAD + 2 * CELL, riverY);
    ctx.fillText('汉  界', PAD + 6 * CELL, riverY);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  function drawPiece(px, py, piece, c) {
    var r = CELL * 0.42;
    // 底圆
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = c.pieceFill;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = piece.s === 'r' ? c.pieceRed : c.pieceBlack;
    ctx.stroke();
    // 内圈
    ctx.beginPath();
    ctx.arc(px, py, r * 0.82, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.stroke();
    // 文字
    var ch = X.PIECE_CHARS[piece.s][piece.t];
    ctx.fillStyle = piece.s === 'r' ? c.pieceRed : c.pieceBlack;
    ctx.font = 'bold ' + Math.round(CELL * 0.5) + 'px "KaiTi", "STKaiti", "Microsoft YaHei", serif';
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
    legalTargets = X.legalMoves(board, cell.x, cell.y);
    render();
  }

  function deselect() {
    selected = null;
    legalTargets = [];
    render();
  }

  function doMove(from, to) {
    var piece = board[from.y][from.x];
    var captured = board[to.y][to.x];
    var nota = X.notation(board, from, to);
    X.applyMove(board, from, to);
    history.push({ from: from, to: to, piece: piece, captured: captured, notation: nota });
    lastMove = { from: from, to: to };
    selected = null;
    legalTargets = [];
    turn = turn === 'r' ? 'b' : 'r';
    status = X.statusAfter(board, turn);

    if (status.over) {
      if (!resultRecorded) {
        saveStats(status.winner);
        resultRecorded = true;
      }
      sfxWin();
      GamePlatform.ui.toast(statusText());
    } else if (status.check) {
      sfxCheck();
      GamePlatform.ui.toast(statusText());
    } else if (captured) {
      sfxCapture();
    } else {
      sfxMove();
    }

    startAnim(from, to, piece);
    renderMoveList();
    renderStats();
    updateStatusUI();
    render();
  }

  function undo() {
    if (!history.length) {
      GamePlatform.ui.toast(t('undoEmpty'));
      return;
    }
    var h = history.pop();
    board[h.from.y][h.from.x] = h.piece;
    board[h.to.y][h.to.x] = h.captured;
    turn = h.piece.s;
    selected = null;
    legalTargets = [];
    anim = null;
    if (resultRecorded) {
      unsaveStats(status.winner);
      resultRecorded = false;
    }
    var prev = history[history.length - 1];
    lastMove = prev ? { from: prev.from, to: prev.to } : null;
    status = X.statusAfter(board, turn);
    render();
    renderMoveList();
    renderStats();
    updateStatusUI();
  }

  function restart() {
    board = X.initialBoard();
    turn = 'r';
    selected = null;
    legalTargets = [];
    history = [];
    lastMove = null;
    anim = null;
    resultRecorded = false;
    status = X.statusAfter(board, turn);
    render();
    renderMoveList();
    renderStats();
    updateStatusUI();
    GamePlatform.ui.toast(t('restarted'));
  }

  /* ---------------- 存档 ---------------- */
  function loadStats() {
    return GamePlatform.storage.get('stats', { red: 0, black: 0 });
  }

  function saveStats(winner) {
    var s = loadStats();
    if (winner === 'r') s.red = (s.red || 0) + 1;
    else s.black = (s.black || 0) + 1;
    GamePlatform.storage.set('stats', s);
  }

  function unsaveStats(winner) {
    var s = loadStats();
    if (winner === 'r') s.red = Math.max(0, (s.red || 0) - 1);
    else s.black = Math.max(0, (s.black || 0) - 1);
    GamePlatform.storage.set('stats', s);
  }

  /* ---------------- UI 更新 ---------------- */
  function statusText() {
    if (status.over) {
      return fmt('win', {
        side: sideName(status.winner),
        reason: status.reason === 'checkmate' ? t('reasonCheckmate')
          : status.reason === 'stalemate' ? t('reasonStalemate')
          : t('reasonCapture')
      });
    }
    if (status.check) return fmt('check', { side: sideName(turn) });
    return fmt('turn', { side: sideName(turn) });
  }

  function updateStatusUI() {
    el.statusText.textContent = statusText();
    if (status.over) {
      el.turnDot.className = 'turn-dot is-win';
    } else {
      el.turnDot.className = 'turn-dot ' + (turn === 'r' ? 'is-red' : 'is-black');
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
      var red = history[i] ? history[i].notation : '';
      var black = history[i + 1] ? history[i + 1].notation : '';
      rows.push(
        '<div class="move-row"><span class="move-no">' + no + '.</span>' +
        '<span class="move-red">' + red + '</span>' +
        '<span class="move-black">' + black + '</span></div>'
      );
    }
    el.moveList.innerHTML = rows.join('');
    el.moveList.scrollTop = el.moveList.scrollHeight;
  }

  function renderStats() {
    var s = loadStats();
    el.statRed.textContent = String(s.red || 0);
    el.statBlack.textContent = String(s.black || 0);
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
      zh: '中国象棋 · Potato4096 Arcade',
      en: 'Chinese Chess · Potato4096 Arcade'
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
    if (anim || status.over) return;
    var cell = pointToCell(e.clientX, e.clientY);
    if (!cell) return;
    var piece = board[cell.y][cell.x];

    if (selected) {
      var isTarget = legalTargets.some(function (m) {
        return m.x === cell.x && m.y === cell.y;
      });
      if (isTarget) {
        doMove(selected, cell);
        return;
      }
      if (piece && piece.s === turn) {
        select(cell);
        return;
      }
      deselect();
      return;
    }
    if (piece && piece.s === turn) select(cell);
  }

  function init() {
    canvas = document.getElementById('board');
    el = {
      statusText: document.getElementById('status-text'),
      turnDot: document.getElementById('turn-dot'),
      hint: document.getElementById('hint'),
      moveList: document.getElementById('move-list'),
      statRed: document.getElementById('stat-red'),
      statBlack: document.getElementById('stat-black'),
      badge: document.getElementById('lang-badge'),
      title: document.getElementById('game-title')
    };

    setupCanvas();
    canvas.addEventListener('click', onClick);

    document.getElementById('btn-back').addEventListener('click', function () {
      GamePlatform.navigate.goHome();
    });
    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-restart').addEventListener('click', restart);
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

    board = X.initialBoard();
    turn = 'r';
    history = [];
    lastMove = null;
    status = X.statusAfter(board, turn);

    applyText();
    render();
    renderStats();
    renderMoveList();
    updateStatusUI();
  }

  GamePlatform.ready.then(init);
})();
