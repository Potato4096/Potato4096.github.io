/**
 * games/chinese-chess/js/view.js - 中国象棋对局视图
 *
 * 规则（Xiangqi）与 AI（XiangqiAI）是纯逻辑模块，这里只负责对局流程、
 * 画布绘制与交互。界面骨架、棋谱、战绩面板由 core/shell.js 提供。
 *
 * 坐标沿用 rules.js：x = 0..8（列，左→右），y = 0..9（行，上→下），
 * 黑方在上（y=0 为黑方底线），红方在下（y=9 为红方底线）。
 * 玩家执红先行，人机模式电脑执黑。
 */
(function (global) {
  'use strict';

  var BG = global.BG;
  var i18n = BG.i18n;

  var X = null;   // rules.js
  var ai = null;  // ai.js

  /* ---------------- 尺寸（9 列 × 10 行交叉点） ---------------- */
  var PAD = 44;
  var CELL = 56;
  var W = PAD * 2 + CELL * 8;
  var H = PAD * 2 + CELL * 9;

  /* ---------------- 棋盘木色（深浅两套，跟随平台主题） ---------------- */
  var BOARDS = {
    light: {
      board: '#e9c78d',
      boardTo: '#dfb878',
      boardEdge: '#b0834c',
      line: '#7c5326',
      mark: '#7c5326',
      river: '#7c5326',
      pieceFill: '#fdf3dd',
      pieceRed: '#c62828',
      pieceBlack: '#263238'
    },
    dark: {
      board: '#6d5137',
      boardTo: '#5e4530',
      boardEdge: '#43301c',
      line: '#dcbd8f',
      mark: '#dcbd8f',
      river: '#dcbd8f',
      pieceFill: '#f4e7cf',
      pieceRed: '#e25656',
      pieceBlack: '#22262e'
    }
  };

  /* ---------------- 棋种词条 ---------------- */
  i18n.register('chinese-chess', {
    zh: {
      hint: '点击己方棋子选中，再点击目标位置落子',
      turn: '{side}走棋',
      check: '{side}被将军！',
      youCheck: '你被将军！',
      aiCheck: '电脑被将军！',
      win: '{side}获胜（{reason}）',
      reasonCheckmate: '将死',
      reasonStalemate: '困毙',
      reasonCapture: '将被吃',
      statRed: '红方胜',
      statBlack: '黑方胜',
      statDraw: '和棋',
      riverLeft: '楚 河',
      riverRight: '汉 界'
    },
    en: {
      hint: 'Click your piece, then click the destination point',
      turn: '{side} to move',
      check: '{side} is in check!',
      youCheck: 'You are in check!',
      aiCheck: 'AI is in check!',
      win: '{side} wins ({reason})',
      reasonCheckmate: 'checkmate',
      reasonStalemate: 'stalemate',
      reasonCapture: 'general captured',
      statRed: 'Red wins',
      statBlack: 'Black wins',
      statDraw: 'Draws',
      riverLeft: 'Chu River',
      riverRight: 'Han Border'
    }
  });

  /* ---------------- 对局状态 ---------------- */
  var root = null;
  var canvas = null;
  var ctx = null;
  var ui = null;
  var alive = false;

  var board = null;
  var turn = 'r';
  var status = null;
  var history = [];

  var selected = null;
  var legalTargets = [];
  var lastMove = null;

  var anim = null;
  var rafId = null;

  var mode = 'pvp';
  var difficulty = 'medium';
  var aiColor = 'b';

  var aiThinking = false;
  var aiTimer = null;
  var gameToken = 0;
  var recorded = false;

  var GAME_ID = 'chinese-chess';
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
    return { px: PAD + x * CELL, py: PAD + y * CELL };
  }

  function pointToCell(clientX, clientY) {
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var lx = (clientX - rect.left) * (W / rect.width);
    var ly = (clientY - rect.top) * (H / rect.height);
    var x = Math.round((lx - PAD) / CELL);
    var y = Math.round((ly - PAD) / CELL);
    if (!X.inBoard(x, y)) return null;
    // 允许落在交叉点附近（半个格子内）
    var c = cellPx(x, y);
    if (Math.abs(lx - c.px) > CELL * 0.55 || Math.abs(ly - c.py) > CELL * 0.55) return null;
    return { x: x, y: y };
  }

  function sideName(color) {
    if (mode === 'ai') return color === aiColor ? i18n.t('ai') : i18n.t('you');
    return color === 'r' ? i18n.t('red') : i18n.t('black');
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
        : i18n.t('reasonCapture');
  }

  function resultField(winner) {
    return winner === 'r' ? 'red' : winner === 'b' ? 'black' : 'draw';
  }

  /* ---------------- 绘制 ---------------- */
  function render() {
    if (!alive || !ctx || !board) return;
    ctx = BG.canvas.fit(canvas, ctx, W, H);   // 缓冲区跟随实际显示尺寸，避免被 CSS 放大发虚
    var c = palette();
    var ac = BG.canvas.accent();
    var x, y;

    ctx.clearRect(0, 0, W, H);

    // 木色棋盘底
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, c.board);
    grad.addColorStop(1, c.boardTo);
    ctx.fillStyle = grad;
    BG.canvas.roundRect(ctx, 0, 0, W, H, 10);
    ctx.fill();
    ctx.strokeStyle = c.boardEdge;
    ctx.lineWidth = 2;
    BG.canvas.roundRect(ctx, 1, 1, W - 2, H - 2, 10);
    ctx.stroke();

    drawGrid(c);
    drawMarks(c);
    drawRiver(c);

    // 最后一手（起止点淡色圆）
    if (lastMove) {
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = ac.accent;
      [lastMove.from, lastMove.to].forEach(function (m) {
        var p = cellPx(m.x, m.y);
        ctx.beginPath();
        ctx.arc(p.px, p.py, CELL * 0.46, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // 选中棋子与合法落点
    if (selected) {
      var sp = cellPx(selected.x, selected.y);
      ctx.strokeStyle = ac.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sp.px, sp.py, CELL * 0.47, 0, Math.PI * 2);
      ctx.stroke();

      legalTargets.forEach(function (m) {
        var tp = cellPx(m.x, m.y);
        if (board[m.y][m.x]) {
          ctx.strokeStyle = ac.danger;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(tp.px, tp.py, CELL * 0.44, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = ac.accent;
          ctx.beginPath();
          ctx.arc(tp.px, tp.py, CELL * 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });
    }

    // 被将军的将帅
    if (status && !status.over && status.check) {
      var g = X.findGeneral(board, turn);
      if (g) {
        var gp = cellPx(g.x, g.y);
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = ac.danger;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(gp.px, gp.py, CELL * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // 棋子（行进中的棋子稍后单独画）
    for (y = 0; y < X.ROWS; y++) {
      for (x = 0; x < X.COLS; x++) {
        if (anim && anim.to.x === x && anim.to.y === y) continue;
        var piece = board[y][x];
        if (!piece) continue;
        var p = cellPx(x, y);
        drawPiece(p.px, p.py, piece, c);
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

  function drawGrid(c) {
    var x0 = PAD, y0 = PAD;
    var x1 = PAD + 8 * CELL, y1 = PAD + 9 * CELL;
    var i;

    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1.4;

    // 横线 10 条
    for (i = 0; i <= 9; i++) line(x0, y0 + i * CELL, x1, y0 + i * CELL);

    // 竖线：边列贯通，中间列在河界断开
    for (i = 0; i <= 8; i++) {
      if (i === 0 || i === 8) {
        line(x0 + i * CELL, y0, x0 + i * CELL, y1);
      } else {
        line(x0 + i * CELL, y0, x0 + i * CELL, y0 + 4 * CELL);
        line(x0 + i * CELL, y0 + 5 * CELL, x0 + i * CELL, y1);
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
      var gap = 5, arm = 8;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
        if ((pt[0] === 0 && q[0] === -1) || (pt[0] === 8 && q[0] === 1)) return; // 贴边不画
        ctx.beginPath();
        ctx.moveTo(p.px + q[0] * gap, p.py + q[1] * (gap + arm));
        ctx.lineTo(p.px + q[0] * gap, p.py + q[1] * gap);
        ctx.lineTo(p.px + q[0] * (gap + arm), p.py + q[1] * gap);
        ctx.stroke();
      });
    });
  }

  function drawRiver(c) {
    var riverY = PAD + 4.5 * CELL;
    var isEn = i18n.lang() === 'en';
    ctx.fillStyle = c.river;
    ctx.font = 'bold ' + Math.round(CELL * (isEn ? 0.29 : 0.46)) +
      'px "KaiTi", "STKaiti", "Microsoft YaHei", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i18n.t('riverLeft'), PAD + 2 * CELL, riverY);
    ctx.fillText(i18n.t('riverRight'), PAD + 6 * CELL, riverY);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  /** 圆形棋子 + 汉字（字号随格子大小） */
  function drawPiece(px, py, piece, c) {
    var r = CELL * 0.42;
    var ink = piece.s === 'r' ? c.pieceRed : c.pieceBlack;

    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = c.pieceFill;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = ink;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, r * 0.82, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = ink;
    ctx.font = 'bold ' + Math.round(CELL * 0.5) +
      'px "KaiTi", "STKaiti", "Microsoft YaHei", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(X.PIECE_CHARS[piece.s][piece.t], px, py + 1);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
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
      dur: 160
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
    if (!board || !status) return false;
    if (status.over || aiThinking || anim) return false;
    if (mode === 'ai' && turn === aiColor) return false;
    return true;
  }

  function statusText() {
    if (!board || !status) return '';
    if (status.over) {
      if (mode === 'ai') return status.winner === aiColor ? i18n.t('aiWins') : i18n.t('youWin');
      return i18n.fmt('win', { side: sideName(status.winner), reason: reasonText(status.reason) });
    }
    if (status.check) {
      if (mode === 'ai') return turn === aiColor ? i18n.t('aiCheck') : i18n.t('youCheck');
      return i18n.fmt('check', { side: sideName(turn) });
    }
    if (mode === 'ai' && (aiThinking || turn === aiColor)) return i18n.t('thinking');
    return i18n.fmt('turn', { side: sideName(turn) });
  }

  function updateStatus() {
    if (!ui) return;
    ui.setStatus(statusText());
    ui.setMode(modeText());
    if (status && status.over) {
      ui.setDot('is-win');
    } else if (mode === 'ai' && (aiThinking || turn === aiColor)) {
      ui.setDot('is-thinking');
    } else {
      ui.setDot(turn === 'r' ? 'is-red' : 'is-black');
    }
  }

  function refreshHint() {
    if (!ui) return;
    ui.el.hint.textContent = i18n.t('hint');
  }

  /** 单列棋谱：每一手一行，最近一步高亮 */
  function renderMoves() {
    if (!ui) return;
    if (!history.length) {
      ui.emptyMoves();
      return;
    }
    var rows = [];
    for (var i = 0; i < history.length; i++) {
      var cls = 'bg-move-line' + (i === history.length - 1 ? ' is-latest' : '');
      rows.push('<div class="' + cls + '">' +
        '<span class="bg-move-no">' + (i + 1) + '.</span>' +
        '<span>' + history[i].notation + '</span></div>');
    }
    ui.setMoves(rows.join(''));
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

  function doMove(from, to, byAi) {
    if (!board || !status || status.over) return;
    var piece = board[from.y][from.x];
    if (!piece) return;

    var captured = board[to.y][to.x];
    var nota = X.notation(board, from, to);
    X.applyMove(board, from, to);

    history.push({
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      piece: piece,
      captured: captured,
      notation: nota
    });

    lastMove = { from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } };
    selected = null;
    legalTargets = [];
    turn = turn === 'r' ? 'b' : 'r';
    status = X.statusAfter(board, turn);

    if (status.over) {
      if (!recorded) {
        BG.store.bump(GAME_ID, KEYS.stats, resultField(status.winner), 1);
        recorded = true;
      }
      if (mode === 'ai' && status.winner === aiColor) BG.sfx.lose();
      else BG.sfx.win();
      if (ui) ui.toast(i18n.fmt('win', {
        side: sideName(status.winner),
        reason: reasonText(status.reason)
      }));
    } else if (status.check) {
      BG.sfx.alert();
      if (ui) ui.toast(statusText());
    } else if (captured) {
      BG.sfx.capture();
    } else {
      BG.sfx.place(byAi ? 480 : 620);
    }

    startAnim(from, to, piece);
    render();
    renderMoves();
    renderStats();
    updateStatus();

    if (mode === 'ai' && !status.over && turn === aiColor) scheduleAi();
  }

  function undoOne() {
    var h = history.pop();
    if (!h) return false;
    board[h.from.y][h.from.x] = h.piece;
    board[h.to.y][h.to.x] = h.captured;
    turn = h.piece.s;
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
      if (ui) ui.toast(i18n.t('undoEmpty'));
      return;
    }
    // 人机模式：最后一手是电脑的就连撤两手，把回合交还玩家
    var n = 1;
    if (mode === 'ai' && history[history.length - 1].piece.s === aiColor) n = 2;
    for (var i = 0; i < n && history.length; i++) undoOne();

    selected = null;
    legalTargets = [];
    cancelAnim();

    var prev = history[history.length - 1];
    lastMove = prev ? { from: prev.from, to: prev.to } : null;
    status = X.statusAfter(board, turn);

    BG.sfx.undo();
    render();
    renderMoves();
    renderStats();
    updateStatus();

    if (mode === 'ai' && !status.over && turn === aiColor) scheduleAi();
  }

  function newGame() {
    gameToken++;
    aiThinking = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    cancelAnim();

    board = X.initialBoard();
    turn = 'r';
    selected = null;
    legalTargets = [];
    history = [];
    lastMove = null;
    recorded = false;
    status = X.statusAfter(board, turn);

    render();
    renderMoves();
    renderStats();
    updateStatus();
  }

  function scheduleAi() {
    if (mode !== 'ai' || !board || !status || status.over) return;
    if (cheatFreeze || cheatGod) return;
    if (turn !== aiColor || aiThinking) return;

    aiThinking = true;
    updateStatus();
    var token = gameToken;
    aiTimer = setTimeout(function () {
      aiTimer = null;
      if (!alive || token !== gameToken) return;

      var mv = null;
      try {
        mv = ai.findBestMove(board, aiColor, { difficulty: difficulty });
      } catch (e) {
        console.error('[chinese-chess] AI error', e);
      }
      if (!alive || token !== gameToken) return;

      aiThinking = false;

      var picked = null;
      if (mv && mv.from && mv.to &&
        X.inBoard(mv.from.x, mv.from.y) && X.inBoard(mv.to.x, mv.to.y)) {
        var pc = board[mv.from.y][mv.from.x];
        if (pc && pc.s === aiColor) picked = mv;
      }
      if (!picked) {
        // 兜底：取任意一条合法着法，避免对局卡死
        var all = X.allLegalMoves(board, aiColor);
        picked = all.length ? all[0] : null;
      }
      if (!picked) {
        updateStatus();
        render();
        return;
      }
      doMove(picked.from, picked.to, true);
    }, 220);
  }

  /* ---------------- 交互 ---------------- */
  function select(cell) {
    selected = { x: cell.x, y: cell.y };
    legalTargets = X.legalMoves(board, cell.x, cell.y);
    BG.sfx.select();
    render();
  }

  function deselect() {
    selected = null;
    legalTargets = [];
    render();
  }

  function onClick(e) {
    // 上帝模式：点原棋盘交叉点直接摆子，跳过正常走子与轮次限制
    if (cheatGod && global.CheatKit && global.CheatKit.hasPalette()) {
      var pt = pointToCell(e.clientX, e.clientY);
      if (pt) cheatSetPiece(pt.y, pt.x, global.CheatKit.active());
      return;
    }
    if (!canHumanPlay()) return;
    var cell = pointToCell(e.clientX, e.clientY);
    if (!cell) return;
    var piece = board[cell.y][cell.x];

    if (selected) {
      var isTarget = legalTargets.some(function (m) {
        return m.x === cell.x && m.y === cell.y;
      });
      if (isTarget) {
        doMove(selected, cell, false);
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

  function onResize() {
    render();
  }

  /* ---------------- 挂载 / 卸载 ---------------- */
  /* ------------------------------------------------------------ */
  /* 修改器：暗号 potato4096 唤出（platform/cheat-kit.js）          */
  /* ------------------------------------------------------------ */

  var cheatGod = false;
  var cheatFreeze = false;

  function cheatPalette() {
    var out = [{ label: { zh: '空', en: 'Empty' }, value: '', swatch: '#0000' }];
    var types = ['K', 'A', 'E', 'H', 'R', 'C', 'P'];
    var nameR = { K: '帅', A: '仕', E: '相', H: '马', R: '车', C: '炮', P: '兵' };
    var nameB = { K: '将', A: '士', E: '象', H: '马', R: '车', C: '炮', P: '卒' };
    types.forEach(function (t) {
      out.push({
        label: { zh: X.PIECE_CHARS.r[t] + ' 红' + nameR[t], en: 'Red ' + t },
        value: 'r:' + t,
        swatch: '#c8402f'
      });
    });
    types.forEach(function (t) {
      out.push({
        label: { zh: X.PIECE_CHARS.b[t] + ' 黑' + nameB[t], en: 'Black ' + t },
        value: 'b:' + t,
        swatch: '#24272e'
      });
    });
    return out;
  }

  function cheatRefresh() {
    if (!board) return;
    status = X.statusAfter(board, turn);
    render();
    updateStatus();
  }

  function cheatSetPiece(r, c, v) {
    if (!cheatGod || !board) return;
    var parts = v ? String(v).split(':') : null;
    board[r][c] = parts ? { t: parts[1], s: parts[0] } : null;
    cheatRefresh();
  }

  function cheatKeepGenerals() {
    if (!board) return;
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 9; x++) board[y][x] = null;
    }
    board[9][4] = { t: 'K', s: 'r' };
    board[0][4] = { t: 'K', s: 'b' };
    turn = 'r';
    cheatRefresh();
  }

  function cheatAddRook() {
    if (!board) return;
    for (var x = 0; x < 9; x++) {
      if (!board[9][x]) { board[9][x] = { t: 'R', s: 'r' }; break; }
    }
    cheatRefresh();
  }

  function cheatCrush() {
    if (!board) return;
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 9; x++) {
        var p = board[y][x];
        if (p && p.s === 'b' && p.t !== 'K') board[y][x] = null;
      }
    }
    if (!board[0][4] || board[0][4].s !== 'b') board[0][4] = { t: 'K', s: 'b' };
    if (!board[9][4] || board[9][4].s !== 'r') board[9][4] = { t: 'K', s: 'r' };
    cheatRefresh();
  }

  function countSide(side) {
    if (!board) return 0;
    var n = 0;
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 9; x++) {
        if (board[y][x] && board[y][x].s === side) n++;
      }
    }
    return n;
  }

  function materialDiff() {
    if (!board) return 0;
    var val = { K: 0, A: 2, E: 2, H: 4, R: 9, C: 4.5, P: 1 };
    var d = 0;
    for (var y = 0; y < 10; y++) {
      for (var x = 0; x < 9; x++) {
        var p = board[y][x];
        if (p) d += (p.s === 'r' ? 1 : -1) * (val[p.t] || 0);
      }
    }
    return d > 0 ? '+' + (Math.round(d * 10) / 10) : String(Math.round(d * 10) / 10);
  }

  function setupCheat() {
    if (!global.CheatKit) return;
    CheatKit.init({
      id: GAME_ID,
      dock: root,
      title: { zh: '🔧 修改器 · 上帝模式', en: '🔧 Modifier · God Mode' },
      hint: {
        zh: '打开上帝模式后，下面选一个子，直接点原棋盘交叉点就能摆/拿；AI 同时冻结',
        en: 'Turn on God Mode, pick a piece below, then tap any point on the real board. AI freezes too.'
      },
      stats: [
        { label: { zh: '手数', en: 'Moves' }, get: function () { return history.length; } },
        { label: { zh: '轮到', en: 'Turn' }, get: function () { return sideName(turn); } },
        { label: { zh: '红方子', en: 'Red pieces' }, get: function () { return countSide('r'); }, tone: 'danger' },
        { label: { zh: '黑方子', en: 'Black pieces' }, get: function () { return countSide('b'); } },
        { label: { zh: '子力差', en: 'Material' }, get: materialDiff, tone: 'warning' },
        { label: { zh: '状态', en: 'State' }, get: function () {
          if (!status) return '-';
          if (status.over) return status.winner ? sideName(status.winner) + (i18n.lang() === 'en' ? ' wins' : '胜') : '-';
          return status.check ? (i18n.lang() === 'en' ? 'Check' : '将军') : (i18n.lang() === 'en' ? 'Live' : '进行中');
        } }
      ],
      toggles: [
        { label: { zh: '上帝模式', en: 'God mode' },
          on: { zh: '上帝模式：开', en: 'God Mode: ON' },
          off: { zh: '上帝模式：关', en: 'God Mode: OFF' },
          get: function () { return cheatGod; },
          set: function (v) {
            cheatGod = !!v;
            if (cheatGod) cheatFreeze = true;
            if (canvas) canvas.classList.toggle('is-god', cheatGod);
          } },
        { label: { zh: '冻结 AI', en: 'Freeze AI' },
          on: { zh: 'AI：已冻结', en: 'AI: frozen' },
          off: { zh: 'AI：正常', en: 'AI: live' },
          get: function () { return cheatFreeze; },
          set: function (v) { cheatFreeze = !!v; } }
      ],
      actions: [
        { label: { zh: '红方加车', en: 'Add a chariot' }, run: cheatAddRook, toast: { zh: '红方底线已加车', en: 'Chariot added' } },
        { label: { zh: '黑方只剩将', en: 'Leave general only' }, run: cheatCrush, tone: 'danger', toast: { zh: '黑方已被清空', en: 'Black wiped' } }
      ],
      board: {
        title: { zh: '取子：选一个子，然后点原棋盘交叉点落子', en: 'Pick a piece, then tap the real board' },
        palette: cheatPalette(),
        // 取子栏只在上帝模式开启后显示
        visible: function () { return cheatGod; },
        tip: {
          zh: '选「空」后点交叉点 = 移走该子。摆完直接接着下，AI 已冻结。',
          en: 'Pick "Empty" and tap a point to remove a piece. AI stays frozen while God Mode is on.'
        },
        actions: [
          { label: { zh: '清空棋盘（留双将）', en: 'Clear (keep generals)' }, run: cheatKeepGenerals },
          { label: { zh: '恢复开局', en: 'Reset position' }, run: function () { newGame(); } }
        ]
      }
    });
  }

  function mount(host, opts) {
    X = global.Xiangqi;
    ai = global.XiangqiAI;
    if (!X || !ai) throw new Error('中国象棋模块未就绪');

    root = host;
    alive = true;
    mode = opts && opts.mode === 'ai' ? 'ai' : 'pvp';
    difficulty = (opts && opts.difficulty) || 'medium';
    aiColor = 'b';

    ui = BG.shell.create(root, {
      id: GAME_ID,
      title: { zh: '中国象棋', en: 'Chinese Chess' },
      stats: [
        { key: 'red', labelKey: 'statRed', dot: 'red' },
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
        refreshHint();
        updateStatus();
        renderMoves();
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
    global.addEventListener('resize', onResize);

    refreshHint();
    newGame();
    setupCheat();

    if (mode === 'ai' && turn === aiColor) scheduleAi();
  }

  function unmount() {
    alive = false;
    gameToken++;
    aiThinking = false;
    if (global.CheatKit) CheatKit.detach();
    if (aiTimer) {
      clearTimeout(aiTimer);
      aiTimer = null;
    }
    cancelAnim();

    if (canvas) canvas.removeEventListener('click', onClick);
    global.removeEventListener('resize', onResize);

    if (ui) {
      ui.destroy();
      ui = null;
    }

    canvas = null;
    ctx = null;
    root = null;
    board = null;
    status = null;
    history = [];
    selected = null;
    legalTargets = [];
    lastMove = null;
  }

  BG.registerGame('chinese-chess', { mount: mount, unmount: unmount });
})(window);
