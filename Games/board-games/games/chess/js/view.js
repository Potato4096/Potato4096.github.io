/**
 * games/chess/js/view.js - 国际象棋对局视图
 *
 * 规则（Chess）与 AI（ChessAI）是纯逻辑模块，这里只负责对局流程、
 * 画布绘制与交互。界面骨架、棋谱、战绩面板由 core/shell.js 提供。
 *
 * 坐标沿用 rules.js：x=0..7 为 a..h，y=0..7 为第 8..1 秩，
 * 白方在下（y=7 为第 1 秩）。人机模式玩家执白先行，电脑执黑。
 */
(function (global) {
  'use strict';

  var BG = global.BG;
  var i18n = BG.i18n;

  var X = null;   // rules.js
  var ai = null;  // ai.js

  /* ---------------- 尺寸 ---------------- */
  var PAD = 32;
  var CELL = 64;
  var W = PAD * 2 + CELL * 8;

  /* ---------------- 棋盘木色（深浅两套，跟随平台主题） ---------------- */
  var BOARDS = {
    light: {
      sqLight: '#f0d9b5',
      sqDark: '#b58863',
      frame: '#7c5326',
      coord: '#6b4520',
      edge: 'rgba(124, 83, 38, 0.6)',
      pieceFillW: '#f8f1e4',
      pieceLineW: '#4a4238',
      pieceFillB: '#31343c',
      pieceLineB: '#14171c'
    },
    dark: {
      sqLight: '#c9a373',
      sqDark: '#845c3a',
      frame: '#3c2c18',
      coord: '#e6cda6',
      edge: 'rgba(0, 0, 0, 0.4)',
      pieceFillW: '#f2e6d0',
      pieceLineW: '#4a4038',
      pieceFillB: '#232833',
      pieceLineB: '#0b0e13'
    }
  };

  /* ---------------- 棋种词条 ---------------- */
  i18n.register('chess', {
    zh: {
      turn: '{side}走棋',
      check: '{side}被将军！',
      youCheck: '你被将军！',
      aiCheck: '电脑被将军！',
      win: '{side}获胜',
      winReason: '{side}获胜（{reason}）',
      drawReason: '和棋（{reason}）',
      statWhite: '白方胜',
      statBlack: '黑方胜',
      statDraw: '和棋',
      reasonCheckmate: '将死',
      reasonStalemate: '逼和',
      reasonFifty: '50 回合规则',
      reasonRepetition: '三次重复',
      reasonInsufficient: '子力不足',
      promoTitle: '选择升变棋子',
      promoQ: '后',
      promoR: '车',
      promoB: '象',
      promoN: '马'
    },
    en: {
      turn: '{side} to move',
      check: '{side} is in check!',
      youCheck: 'You are in check!',
      aiCheck: 'AI is in check!',
      win: '{side} wins',
      winReason: '{side} wins ({reason})',
      drawReason: 'Draw ({reason})',
      statWhite: 'White wins',
      statBlack: 'Black wins',
      statDraw: 'Draws',
      reasonCheckmate: 'checkmate',
      reasonStalemate: 'stalemate',
      reasonFifty: 'fifty-move rule',
      reasonRepetition: 'threefold repetition',
      reasonInsufficient: 'insufficient material',
      promoTitle: 'Choose promotion piece',
      promoQ: 'Queen',
      promoR: 'Rook',
      promoB: 'Bishop',
      promoN: 'Knight'
    }
  });

  /* ---------------- 对局状态 ---------------- */
  var root = null;
  var canvas = null;
  var ctx = null;
  var ui = null;
  var promoEl = null;
  var alive = false;

  var state = null;
  var repKeys = [];
  var history = [];
  var status = null;

  var selected = null;
  var legalTargets = [];
  var lastMove = null;
  var pendingPromo = null;

  var anim = null;
  var rafId = null;

  var mode = 'pvp';
  var difficulty = 'medium';
  var aiColor = 'b';

  var aiThinking = false;
  var aiTimer = null;
  var gameToken = 0;
  var recorded = false;

  var GAME_ID = 'chess';
  var KEYS = { stats: 'stats' };

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
    return { px: PAD + x * CELL + CELL / 2, py: PAD + y * CELL + CELL / 2 };
  }

  function pointToCell(clientX, clientY) {
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var lx = (clientX - rect.left) * (W / rect.width);
    var ly = (clientY - rect.top) * (W / rect.height);
    var x = Math.floor((lx - PAD) / CELL);
    var y = Math.floor((ly - PAD) / CELL);
    if (!X.inBoard(x, y)) return null;
    return { x: x, y: y };
  }

  function sideName(color) {
    if (mode === 'ai') return color === aiColor ? i18n.t('ai') : i18n.t('you');
    return color === 'w' ? i18n.t('white') : i18n.t('black');
  }

  function diffKey() {
    return difficulty === 'easy' ? 'diffEasy' : difficulty === 'hard' ? 'diffHard' : 'diffMedium';
  }

  function modeText() {
    return mode === 'ai' ? i18n.fmt('modeAiFull', { diff: i18n.t(diffKey()) }) : i18n.t('modePvp');
  }

  function reasonText(reason) {
    return reason === 'checkmate' ? i18n.t('reasonCheckmate')
      : reason === 'stalemate' ? i18n.t('reasonStalemate')
        : reason === 'fifty' ? i18n.t('reasonFifty')
          : reason === 'repetition' ? i18n.t('reasonRepetition')
            : i18n.t('reasonInsufficient');
  }

  /* ---------------- 绘制 ---------------- */
  function render() {
    if (!alive || !ctx || !state) return;
    var c = palette();
    var ac = BG.canvas.accent();
    var x, y;

    ctx.clearRect(0, 0, W, W);

    // 外框
    ctx.fillStyle = c.frame;
    BG.canvas.roundRect(ctx, 0, 0, W, W, 12);
    ctx.fill();

    // 棋盘格
    for (y = 0; y < 8; y++) {
      for (x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? c.sqLight : c.sqDark;
        ctx.fillRect(PAD + x * CELL, PAD + y * CELL, CELL, CELL);
      }
    }

    // 棋盘内边界
    ctx.strokeStyle = c.edge;
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD - 0.5, PAD - 0.5, CELL * 8 + 1, CELL * 8 + 1);

    drawCoords(c);

    // 上一手高亮
    if (lastMove) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = ac.accent;
      [lastMove.from, lastMove.to].forEach(function (m) {
        ctx.fillRect(PAD + m.x * CELL, PAD + m.y * CELL, CELL, CELL);
      });
      ctx.globalAlpha = 1;
    }

    // 被将军的王
    if (status && status.check) {
      var king = X.findKing(state, state.turn);
      if (king) {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = ac.danger;
        ctx.fillRect(PAD + king.x * CELL, PAD + king.y * CELL, CELL, CELL);
        ctx.globalAlpha = 1;
      }
    }

    // 选中格与合法落点
    if (selected) {
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = ac.accent;
      ctx.fillRect(PAD + selected.x * CELL, PAD + selected.y * CELL, CELL, CELL);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = ac.accent;
      ctx.lineWidth = 3;
      ctx.strokeRect(PAD + selected.x * CELL + 2, PAD + selected.y * CELL + 2, CELL - 4, CELL - 4);

      legalTargets.forEach(function (m) {
        var tp = cellPx(m.to.x, m.to.y);
        if (state.board[m.to.y][m.to.x]) {
          ctx.strokeStyle = ac.danger;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(tp.px, tp.py, CELL * 0.42, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = ac.accent;
          ctx.beginPath();
          ctx.arc(tp.px, tp.py, CELL * 0.14, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });
    }

    // 棋子（行进中的棋子稍后单独画）
    for (y = 0; y < 8; y++) {
      for (x = 0; x < 8; x++) {
        if (anim && anim.to.x === x && anim.to.y === y) continue;
        var piece = state.board[y][x];
        if (piece) {
          var p = cellPx(x, y);
          drawPiece(p.px, p.py, piece, c);
        }
      }
    }

    // 走子动画
    if (anim) {
      var t = Math.min(1, (performance.now() - anim.start) / anim.dur);
      var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      var fp = cellPx(anim.from.x, anim.from.y);
      var tp2 = cellPx(anim.to.x, anim.to.y);
      drawPiece(fp.px + (tp2.px - fp.px) * ease, fp.py + (tp2.py - fp.py) * ease, anim.piece, c);
    }
  }

  function drawCoords(c) {
    ctx.fillStyle = c.coord;
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < 8; i++) {
      ctx.fillText('abcdefgh'[i], PAD + i * CELL + CELL / 2, PAD - 17);
      ctx.fillText('abcdefgh'[i], PAD + i * CELL + CELL / 2, PAD + 8 * CELL + 17);
      ctx.fillText(String(8 - i), PAD - 17, PAD + i * CELL + CELL / 2);
      ctx.fillText(String(8 - i), PAD + 8 * CELL + 17, PAD + i * CELL + CELL / 2);
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  /**
   * 棋子剪影（矢量绘制，单位坐标：原点在棋子中心，y 向下为正）
   * 每个棋子 = 一条完整外轮廓闭合路径 + 少量细节线
   */
  function drawPiece(px, py, piece, c) {
    var isW = piece.s === 'w';
    var fill = isW ? c.pieceFillW : c.pieceFillB;
    var stroke = isW ? c.pieceLineW : c.pieceLineB;
    var s = CELL * 0.88;

    // 柔和投影
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.ellipse(0, 0.46, 0.26, 0.05, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(s, s);
    ctx.lineWidth = 0.03;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;

    var t = piece.t;
    if (t === 'P') pawnPath();
    else if (t === 'R') rookPath();
    else if (t === 'N') knightPath();
    else if (t === 'B') bishopPath();
    else if (t === 'Q') queenPath();
    else kingPath();

    ctx.fill();
    ctx.stroke();
    drawDetails(t, stroke);
    ctx.restore();
  }

  function drawDetails(t, stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.022;
    if (t === 'R') {
      ctx.beginPath();
      ctx.moveTo(-0.21, -0.26);
      ctx.lineTo(0.21, -0.26);
      ctx.moveTo(-0.225, 0.10);
      ctx.lineTo(0.225, 0.10);
      ctx.stroke();
    } else if (t === 'B') {
      ctx.beginPath();
      ctx.moveTo(0.02, -0.44);
      ctx.lineTo(0.125, -0.22);
      ctx.moveTo(-0.145, -0.045);
      ctx.lineTo(0.145, -0.045);
      ctx.stroke();
    } else if (t === 'N') {
      ctx.beginPath();
      ctx.arc(-0.115, -0.215, 0.022, 0, Math.PI * 2);
      ctx.fillStyle = stroke;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0.10, -0.28);
      ctx.quadraticCurveTo(0.15, -0.10, 0.17, 0.06);
      ctx.stroke();
    } else if (t === 'Q') {
      ctx.beginPath();
      ctx.moveTo(-0.235, -0.27);
      ctx.lineTo(0.235, -0.27);
      ctx.stroke();
    } else if (t === 'K') {
      ctx.beginPath();
      ctx.moveTo(-0.215, -0.155);
      ctx.lineTo(0.215, -0.155);
      ctx.stroke();
    }
  }

  /** 兵：圆头 + 束腰 + 底座 */
  function pawnPath() {
    ctx.beginPath();
    ctx.arc(0, -0.26, 0.135, Math.PI, 0);
    ctx.quadraticCurveTo(0.185, -0.155, 0.165, 0.02);
    ctx.quadraticCurveTo(0.155, 0.10, 0.185, 0.14);
    ctx.lineTo(0.185, 0.24);
    ctx.quadraticCurveTo(0.30, 0.28, 0.30, 0.36);
    ctx.quadraticCurveTo(0.30, 0.44, 0.20, 0.44);
    ctx.lineTo(-0.20, 0.44);
    ctx.quadraticCurveTo(-0.30, 0.44, -0.30, 0.36);
    ctx.quadraticCurveTo(-0.30, 0.28, -0.185, 0.24);
    ctx.lineTo(-0.185, 0.14);
    ctx.quadraticCurveTo(-0.155, 0.10, -0.165, 0.02);
    ctx.quadraticCurveTo(-0.185, -0.155, -0.135, -0.26);
    ctx.closePath();
  }

  /** 车：城垛 + 直身 + 底座 */
  function rookPath() {
    ctx.beginPath();
    ctx.moveTo(-0.26, -0.46);
    ctx.lineTo(-0.26, -0.34);
    ctx.lineTo(-0.155, -0.34);
    ctx.lineTo(-0.155, -0.46);
    ctx.lineTo(-0.065, -0.46);
    ctx.lineTo(-0.065, -0.34);
    ctx.lineTo(0.065, -0.34);
    ctx.lineTo(0.065, -0.46);
    ctx.lineTo(0.155, -0.46);
    ctx.lineTo(0.155, -0.34);
    ctx.lineTo(0.26, -0.34);
    ctx.lineTo(0.26, -0.46);
    ctx.lineTo(0.235, -0.26);
    ctx.lineTo(0.225, 0.10);
    ctx.lineTo(0.235, 0.14);
    ctx.lineTo(0.235, 0.24);
    ctx.quadraticCurveTo(0.315, 0.28, 0.315, 0.36);
    ctx.quadraticCurveTo(0.315, 0.44, 0.215, 0.44);
    ctx.lineTo(-0.215, 0.44);
    ctx.quadraticCurveTo(-0.315, 0.44, -0.315, 0.36);
    ctx.quadraticCurveTo(-0.315, 0.28, -0.235, 0.24);
    ctx.lineTo(-0.235, 0.14);
    ctx.lineTo(-0.225, 0.10);
    ctx.lineTo(-0.235, -0.26);
    ctx.closePath();
  }

  /** 马：马头侧影（朝左） */
  function knightPath() {
    ctx.beginPath();
    ctx.moveTo(-0.26, 0.44);
    ctx.lineTo(-0.26, 0.16);
    ctx.quadraticCurveTo(-0.12, 0.10, -0.10, 0.04);
    ctx.quadraticCurveTo(-0.28, -0.02, -0.315, -0.17);
    ctx.lineTo(-0.30, -0.235);
    ctx.quadraticCurveTo(-0.20, -0.27, -0.115, -0.30);
    ctx.quadraticCurveTo(-0.045, -0.40, 0.015, -0.475);
    ctx.lineTo(0.075, -0.335);
    ctx.lineTo(0.155, -0.43);
    ctx.lineTo(0.175, -0.26);
    ctx.quadraticCurveTo(0.145, -0.10, 0.185, 0.06);
    ctx.lineTo(0.26, 0.16);
    ctx.lineTo(0.26, 0.44);
    ctx.closePath();
  }

  /** 象：尖顶 + 主教冠 + 底座 */
  function bishopPath() {
    ctx.beginPath();
    ctx.moveTo(0, -0.52);
    ctx.quadraticCurveTo(0.115, -0.42, 0.16, -0.27);
    ctx.quadraticCurveTo(0.195, -0.155, 0.135, -0.055);
    ctx.lineTo(0.155, 0.0);
    ctx.quadraticCurveTo(0.165, 0.10, 0.19, 0.14);
    ctx.lineTo(0.19, 0.24);
    ctx.quadraticCurveTo(0.30, 0.28, 0.30, 0.36);
    ctx.quadraticCurveTo(0.30, 0.44, 0.20, 0.44);
    ctx.lineTo(-0.20, 0.44);
    ctx.quadraticCurveTo(-0.30, 0.44, -0.30, 0.36);
    ctx.quadraticCurveTo(-0.30, 0.28, -0.19, 0.24);
    ctx.lineTo(-0.19, 0.14);
    ctx.quadraticCurveTo(-0.165, 0.10, -0.155, 0.0);
    ctx.lineTo(-0.135, -0.055);
    ctx.quadraticCurveTo(-0.195, -0.155, -0.16, -0.27);
    ctx.quadraticCurveTo(-0.115, -0.42, 0, -0.52);
    ctx.closePath();
  }

  /** 后：五珠王冠 + 散裙 + 底座 */
  function queenPath() {
    ctx.beginPath();
    ctx.moveTo(-0.215, 0.44);
    ctx.quadraticCurveTo(-0.315, 0.44, -0.315, 0.36);
    ctx.quadraticCurveTo(-0.315, 0.28, -0.235, 0.24);
    ctx.lineTo(-0.235, 0.14);
    ctx.quadraticCurveTo(-0.215, 0.02, -0.195, -0.12);
    ctx.lineTo(-0.24, -0.275);
    ctx.arc(-0.24, -0.425, 0.05, Math.PI * 0.55, Math.PI * 1.45, true);
    ctx.lineTo(-0.185, -0.315);
    ctx.lineTo(-0.165, -0.485);
    ctx.arc(-0.12, -0.485, 0.05, Math.PI * 1.1, Math.PI * 1.9, true);
    ctx.lineTo(-0.065, -0.335);
    ctx.lineTo(-0.045, -0.51);
    ctx.arc(0, -0.51, 0.05, Math.PI * 1.1, Math.PI * 1.9, true);
    ctx.lineTo(0.065, -0.335);
    ctx.lineTo(0.045, -0.485);
    ctx.arc(0.12, -0.485, 0.05, Math.PI * 1.1, Math.PI * 0.1, true);
    ctx.lineTo(0.185, -0.315);
    ctx.lineTo(0.165, -0.425);
    ctx.arc(0.24, -0.425, 0.05, Math.PI * 1.45, Math.PI * 0.55, true);
    ctx.lineTo(0.24, -0.275);
    ctx.quadraticCurveTo(0.215, -0.12, 0.195, 0.02);
    ctx.quadraticCurveTo(0.215, 0.12, 0.235, 0.14);
    ctx.lineTo(0.235, 0.24);
    ctx.quadraticCurveTo(0.315, 0.28, 0.315, 0.36);
    ctx.quadraticCurveTo(0.315, 0.44, 0.215, 0.44);
    ctx.closePath();
  }

  /** 王：十字 + 圆冠 + 底座 */
  function kingPath() {
    ctx.beginPath();
    ctx.moveTo(-0.215, 0.44);
    ctx.quadraticCurveTo(-0.315, 0.44, -0.315, 0.36);
    ctx.quadraticCurveTo(-0.315, 0.28, -0.235, 0.24);
    ctx.lineTo(-0.235, 0.14);
    ctx.quadraticCurveTo(-0.215, 0.0, -0.195, -0.10);
    ctx.lineTo(-0.215, -0.155);
    ctx.quadraticCurveTo(-0.225, -0.32, -0.10, -0.375);
    ctx.lineTo(-0.10, -0.40);
    ctx.lineTo(-0.155, -0.40);
    ctx.lineTo(-0.155, -0.455);
    ctx.lineTo(-0.10, -0.455);
    ctx.lineTo(-0.10, -0.525);
    ctx.lineTo(-0.035, -0.525);
    ctx.lineTo(-0.035, -0.455);
    ctx.lineTo(0.035, -0.455);
    ctx.lineTo(0.035, -0.525);
    ctx.lineTo(0.10, -0.525);
    ctx.lineTo(0.10, -0.455);
    ctx.lineTo(0.155, -0.455);
    ctx.lineTo(0.155, -0.40);
    ctx.lineTo(0.10, -0.40);
    ctx.quadraticCurveTo(0.225, -0.32, 0.215, -0.155);
    ctx.lineTo(0.195, -0.10);
    ctx.quadraticCurveTo(0.215, 0.0, 0.235, 0.14);
    ctx.lineTo(0.235, 0.24);
    ctx.quadraticCurveTo(0.315, 0.28, 0.315, 0.36);
    ctx.quadraticCurveTo(0.315, 0.44, 0.215, 0.44);
    ctx.closePath();
  }

  /* ---------------- 动画 ---------------- */
  function cancelAnim() {
    anim = null;
    if (rafId) {
      try { global.cancelAnimationFrame(rafId); } catch (e) { /* 忽略 */ }
      rafId = null;
    }
  }

  function startAnim(from, to, piece) {
    if (reduceMotion()) {
      cancelAnim();
      render();
      return;
    }
    anim = {
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      piece: piece,
      start: performance.now(),
      dur: 170
    };
    if (!rafId) rafId = global.requestAnimationFrame(tick);
  }

  function tick() {
    rafId = null;
    if (!alive) { anim = null; return; }
    if (anim && performance.now() - anim.start >= anim.dur) anim = null;
    render();
    if (anim) rafId = global.requestAnimationFrame(tick);
  }

  /* ---------------- 流程 ---------------- */
  function canHumanPlay() {
    if (!state || !status) return false;
    if (status.over || aiThinking || anim || pendingPromo) return false;
    if (mode === 'ai' && state.turn === aiColor) return false;
    return true;
  }

  function statusText() {
    if (!state || !status) return '';
    if (status.over) {
      if (status.winner) {
        if (mode === 'ai') return status.winner === aiColor ? i18n.t('aiWins') : i18n.t('youWin');
        return i18n.fmt('win', { side: sideName(status.winner) });
      }
      return i18n.t('drawText');
    }
    if (status.check) {
      if (mode === 'ai') return state.turn === aiColor ? i18n.t('aiCheck') : i18n.t('youCheck');
      return i18n.fmt('check', { side: sideName(state.turn) });
    }
    if (mode === 'ai' && (aiThinking || state.turn === aiColor)) return i18n.t('thinking');
    return i18n.fmt('turn', { side: sideName(state.turn) });
  }

  function updateStatus() {
    if (!ui || !state || !status) return;
    ui.setStatus(statusText());
    ui.setMode(modeText());
    if (status.over) {
      ui.setDot('is-win');
    } else if (mode === 'ai' && (aiThinking || state.turn === aiColor)) {
      ui.setDot('is-thinking');
    } else {
      ui.setDot(state.turn === 'w' ? 'is-white' : 'is-black');
    }
  }

  function renderMoves() {
    if (!ui) return;
    if (!history.length) {
      ui.emptyMoves();
      return;
    }
    var rows = [];
    for (var i = 0; i < history.length; i++) {
      var no = Math.floor(i / 2) + 1;
      var label = (i % 2 === 0 ? no + '.' : no + '…');
      var cls = 'bg-move-line' + (i === history.length - 1 ? ' is-latest' : '');
      rows.push('<div class="' + cls + '"><span class="bg-move-no">' + label + '</span>' +
        '<span>' + history[i].notation + '</span></div>');
    }
    ui.setMoves(rows.join(''));
  }

  function renderStats() {
    if (!ui) return;
    var s = BG.store.get(GAME_ID, KEYS.stats, {});
    ui.setStats({
      white: s.white || 0,
      black: s.black || 0,
      draw: s.draw || 0
    });
  }

  function resultField(winner) {
    return winner === 'w' ? 'white' : winner === 'b' ? 'black' : 'draw';
  }

  /** 在 (from,target) 的合法着法里取一条；promo 用于匹配升变类型 */
  function matchMove(from, to, promo) {
    var list = X.legalMoves(state, from.x, from.y);
    var fallback = null;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.to.x !== to.x || m.to.y !== to.y) continue;
      if (!m.promo) return m;
      if (m.promo === (promo || 'Q')) return m;
      if (!fallback) fallback = m;
    }
    return fallback;
  }

  function doMove(from, to, promo, byAi) {
    if (!state || !status || status.over) return;
    var piece = state.board[from.y][from.x];
    if (!piece) return;

    var mv = { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } };
    if (promo) mv.promo = promo;

    var notation = X.notation(state, mv);
    var isCastle = piece.t === 'K' && Math.abs(to.x - from.x) === 2;
    var undo = X.makeMove(state, mv);

    history.push({
      move: mv,
      undo: undo,
      notation: notation,
      side: piece.s
    });
    repKeys.push(X.positionKey(state));

    lastMove = { from: from, to: to };
    selected = null;
    legalTargets = [];
    pendingPromo = null;
    hidePromo();

    status = X.statusAfter(state, repKeys);

    if (status.over) {
      if (!recorded) {
        BG.store.bump(GAME_ID, KEYS.stats, resultField(status.winner), 1);
        recorded = true;
      }
      if (status.winner) {
        if (mode === 'ai' && status.winner === aiColor) BG.sfx.lose();
        else BG.sfx.win();
      } else {
        BG.sfx.draw();
      }
      ui.toast(status.winner
        ? i18n.fmt('winReason', { side: sideName(status.winner), reason: reasonText(status.reason) })
        : i18n.fmt('drawReason', { reason: reasonText(status.reason) }));
    } else if (status.check) {
      BG.sfx.alert();
      ui.toast(statusText());
    } else if (isCastle) {
      BG.sfx.place(520);
      BG.sfx.tone(740, 0.05, 'triangle', 0.05, 70);
    } else if (mv.promo) {
      BG.sfx.place(780);
    } else if (undo.captured) {
      BG.sfx.capture();
    } else {
      BG.sfx.place(byAi ? 480 : 620);
    }

    startAnim(from, to, piece);
    render();
    renderMoves();
    renderStats();
    updateStatus();

    if (mode === 'ai' && !status.over && state.turn === aiColor) scheduleAi();
  }

  function undoOne() {
    var h = history.pop();
    if (!h) return false;
    X.undoMove(state, h.move, h.undo);
    repKeys.pop();
    if (recorded) {
      BG.store.bump(GAME_ID, KEYS.stats, resultField(status.winner), -1);
      recorded = false;
    }
    return true;
  }

  function undo() {
    if (aiThinking) {
      gameToken++;
      aiThinking = false;
      if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    }
    if (!history.length) {
      ui.toast(i18n.t('undoEmpty'));
      return;
    }
    // 人机模式：最后一手是电脑的就连撤两手，把回合交还玩家
    var n = 1;
    if (mode === 'ai' && history[history.length - 1].side === aiColor) n = 2;
    for (var i = 0; i < n && history.length; i++) undoOne();

    selected = null;
    legalTargets = [];
    pendingPromo = null;
    hidePromo();
    cancelAnim();

    var prev = history[history.length - 1];
    lastMove = prev ? { from: prev.move.from, to: prev.move.to } : null;
    status = X.statusAfter(state, repKeys);

    BG.sfx.undo();
    render();
    renderMoves();
    renderStats();
    updateStatus();

    if (mode === 'ai' && !status.over && state.turn === aiColor) scheduleAi();
  }

  function newGame() {
    gameToken++;
    aiThinking = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    cancelAnim();

    state = X.initialState();
    repKeys = [X.positionKey(state)];
    history = [];
    selected = null;
    legalTargets = [];
    lastMove = null;
    pendingPromo = null;
    recorded = false;
    hidePromo();

    status = X.statusAfter(state, repKeys);

    render();
    renderMoves();
    renderStats();
    updateStatus();
  }

  function scheduleAi() {
    if (mode !== 'ai' || !state || !status || status.over) return;
    if (state.turn !== aiColor || aiThinking) return;

    aiThinking = true;
    updateStatus();
    var token = gameToken;
    aiTimer = setTimeout(function () {
      aiTimer = null;
      if (!alive || token !== gameToken) return;

      var mv = null;
      try {
        mv = ai.findBestMove(state, { difficulty: difficulty });
      } catch (e) {
        console.error('[chess] AI error', e);
      }
      if (!alive || token !== gameToken) return;

      aiThinking = false;

      var picked = mv && mv.from && mv.to ? matchMove(mv.from, mv.to, mv.promo) : null;
      if (!picked) {
        // 兜底：取任意一条合法着法，避免对局卡死
        var all = X.allLegalMoves(state);
        picked = all.length ? all[0] : null;
      }
      if (!picked) {
        updateStatus();
        render();
        return;
      }
      doMove(picked.from, picked.to, picked.promo, true);
    }, 220);
  }

  /* ---------------- 升变浮层 ---------------- */
  function buildPromoHtml() {
    var btns = X.PROMO_TYPES.map(function (type) {
      return '<button type="button" class="bg-choice" data-promo="' + type + '"><b>' + type + '</b></button>';
    }).join('');
    return '<div class="bg-overlay" hidden>' +
      '<div class="bg-modal">' +
      '  <h2 class="bg-modal-title" data-t="promoTitle"></h2>' +
      '  <div class="bg-choice-grid">' + btns + '</div>' +
      '</div>' +
      '</div>';
  }

  function hidePromo() {
    if (promoEl) promoEl.hidden = true;
  }

  function openPromo(from, to) {
    if (!promoEl) return;
    pendingPromo = { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } };
    promoEl.hidden = false;
    BG.sfx.select();
  }

  function updatePromoLabels() {
    if (!root) return;
    var keys = { Q: 'promoQ', R: 'promoR', B: 'promoB', N: 'promoN' };
    var nodes = root.querySelectorAll('[data-promo]');
    for (var i = 0; i < nodes.length; i++) {
      var type = nodes[i].getAttribute('data-promo');
      var name = i18n.t(keys[type] || 'promoTitle');
      nodes[i].setAttribute('title', name);
      nodes[i].setAttribute('aria-label', name);
    }
  }

  function onPromoClick(e) {
    var btn = e.target.closest('[data-promo]');
    if (!btn) {
      // 点浮层空白处 = 放弃升变，回到选子状态之前
      if (promoEl && e.target === promoEl) {
        pendingPromo = null;
        hidePromo();
        selected = null;
        legalTargets = [];
        render();
      }
      return;
    }
    if (!pendingPromo) return;
    var from = pendingPromo.from;
    var to = pendingPromo.to;
    pendingPromo = null;
    hidePromo();
    doMove(from, to, btn.getAttribute('data-promo'), false);
  }

  /* ---------------- 交互 ---------------- */
  function onClick(e) {
    if (!canHumanPlay()) return;
    var cell = pointToCell(e.clientX, e.clientY);
    if (!cell) return;
    var piece = state.board[cell.y][cell.x];

    if (selected) {
      var candidates = legalTargets.filter(function (m) {
        return m.to.x === cell.x && m.to.y === cell.y;
      });
      if (candidates.length) {
        if (candidates.some(function (m) { return m.promo; })) {
          openPromo(selected, cell);
          return;
        }
        doMove(selected, { x: cell.x, y: cell.y }, null, false);
        return;
      }
      if (piece && piece.s === state.turn) {
        selected = { x: cell.x, y: cell.y };
        legalTargets = X.legalMoves(state, cell.x, cell.y);
        BG.sfx.select();
        render();
        return;
      }
      selected = null;
      legalTargets = [];
      render();
      return;
    }

    if (piece && piece.s === state.turn) {
      selected = { x: cell.x, y: cell.y };
      legalTargets = X.legalMoves(state, cell.x, cell.y);
      BG.sfx.select();
      render();
    }
  }

  function onResize() {
    render();
  }

  /* ---------------- 挂载 / 卸载 ---------------- */
  function mount(host, opts) {
    X = global.Chess;
    ai = global.ChessAI;
    if (!X || !ai) throw new Error('国际象棋模块未就绪');

    root = host;
    alive = true;
    mode = opts && opts.mode === 'ai' ? 'ai' : 'pvp';
    difficulty = (opts && opts.difficulty) || 'medium';
    aiColor = 'b';

    ui = BG.shell.create(root, {
      id: GAME_ID,
      title: { zh: '国际象棋', en: 'Chess' },
      hint: {
        zh: '点击己方棋子选中，再点击目标格落子',
        en: 'Click your piece, then click the destination square'
      },
      stats: [
        { key: 'white', labelKey: 'statWhite', dot: 'white' },
        { key: 'black', labelKey: 'statBlack', dot: 'black' },
        { key: 'draw', labelKey: 'statDraw', dot: 'draw' }
      ],
      actions: ['undo', 'restart', 'clear'],
      onAction: function (act) {
        if (act === 'undo') undo();
        else if (act === 'restart') {
          newGame();
          ui.toast(i18n.t('restarted'));
        } else if (act === 'clear') {
          BG.store.clear(GAME_ID);
          renderStats();
          ui.toast(i18n.t('cleared'));
        }
      },
      onExit: function () { if (opts && opts.exit) opts.exit(); },
      onThemeChange: function () { render(); },
      onLangChange: function () {
        updateStatus();
        renderMoves();
        updatePromoLabels();
      },
      onResize: onResize,
      onDestroy: function () {
        canvas = null;
        ctx = null;
      }
    });

    canvas = root.querySelector('.bg-board');
    ctx = BG.canvas.setup(canvas, W, W);
    canvas.style.cursor = 'pointer';

    root.insertAdjacentHTML('beforeend', buildPromoHtml());
    promoEl = root.querySelector('.bg-overlay');
    if (promoEl) {
      promoEl.addEventListener('click', onPromoClick);
      i18n.applyText(promoEl);
    }
    updatePromoLabels();

    canvas.addEventListener('click', onClick);
    global.addEventListener('resize', onResize);

    newGame();

    if (mode === 'ai' && state.turn === aiColor) scheduleAi();
  }

  function unmount() {
    alive = false;
    gameToken++;
    aiThinking = false;
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    cancelAnim();

    if (canvas) canvas.removeEventListener('click', onClick);
    if (promoEl) {
      promoEl.removeEventListener('click', onPromoClick);
      promoEl = null;
    }
    global.removeEventListener('resize', onResize);

    if (ui) {
      ui.destroy();
      ui = null;
    }

    canvas = null;
    ctx = null;
    root = null;
    state = null;
    status = null;
    repKeys = [];
    history = [];
    selected = null;
    legalTargets = [];
    lastMove = null;
    pendingPromo = null;
  }

  BG.registerGame('chess', { mount: mount, unmount: unmount });
})(window);
