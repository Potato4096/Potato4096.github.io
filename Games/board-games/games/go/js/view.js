/**
 * games/go/js/view.js - 围棋对局视图
 *
 * 规则（GoRules）与 AI（GoAI）是纯逻辑模块，这里只负责对局流程、
 * 画布绘制与交互。界面骨架、棋谱、战绩面板由 core/shell.js 提供。
 */
(function (global) {
  'use strict';

  var BG = global.BG;
  var i18n = BG.i18n;

  /* ---------------- 尺寸 ---------------- */
  var W = 600;

  /* ---------------- 棋盘木色（深浅两套，跟随平台主题） ---------------- */
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

  /* ---------------- 棋种词条 ---------------- */
  i18n.register('go', {
    zh: {
      hint: '点击交叉点落子；双方连续虚手即按中国规则数子法终局计分',
      turn: '{side}落子',
      yourTurn: '轮到你落子',
      size19: '19 路',
      size13: '13 路',
      size9: '9 路',
      boardSize: '棋盘',
      capBlack: '黑提',
      capWhite: '白提',
      captured: '提 {n} 子',
      passToast: '{side}虚手',
      passBoth: '双方连续虚手，进入终局计分',
      passMove: '虚手',
      boardChanged: '已切换为 {n} 路棋盘',
      illegalKo: '打劫：不能立即回提',
      illegalSuicide: '禁着点：不能自杀',
      illegalOccupied: '该点已有棋子',
      scoreResult: '{winner}胜 {margin} 目',
      resignResult: '{loser}认输，{winner}获胜',
      scoreDetail: '子 {stones} + 空 {territory}',
      scoreDetailKomi: '子 {stones} + 空 {territory} + 贴目 {komi}',
      komiNote: '中国规则数子法，黑贴 7.5 目；按当前盘面估算，未收完的边界可能影响结果。',
      resignNote: '本局以认输结束，未进行数子。',
      statsNote: '累计战绩：黑胜 {black} · 白胜 {white}',
      resultTitle: '对局结束',
      again: '再来一局',
      viewBoard: '查看棋盘'
    },
    en: {
      hint: 'Tap an intersection. Two consecutive passes end the game and trigger Chinese area scoring.',
      turn: '{side} to play',
      yourTurn: 'Your move',
      size19: '19×19',
      size13: '13×13',
      size9: '9×9',
      boardSize: 'Board',
      capBlack: 'Black caps',
      capWhite: 'White caps',
      captured: 'captured {n}',
      passToast: '{side} passes',
      passBoth: 'Both sides passed - scoring the board',
      passMove: 'pass',
      boardChanged: 'Switched to {n}×{n} board',
      illegalKo: 'Ko: cannot recapture immediately',
      illegalSuicide: 'Suicide is not allowed here',
      illegalOccupied: 'That point is occupied',
      scoreResult: '{winner} wins by {margin}',
      resignResult: '{loser} resigned - {winner} wins',
      scoreDetail: 'stones {stones} + territory {territory}',
      scoreDetailKomi: 'stones {stones} + territory {territory} + komi {komi}',
      komiNote: 'Chinese area scoring, komi 7.5. Estimated from the current board; unfinished borders may affect the result.',
      resignNote: 'The game ended by resignation, so no counting was performed.',
      statsNote: 'Record: Black {black} · White {white}',
      resultTitle: 'Game Over',
      again: 'Play Again',
      viewBoard: 'View Board'
    }
  });

  /* 侧栏附加控件：路数切换 + 提子统计 */
  var EXTRA_HTML =
    '<div class="bg-seg" data-size-group>' +
    '  <button type="button" class="bg-seg-btn is-active" data-size="19" data-t="size19"></button>' +
    '  <button type="button" class="bg-seg-btn" data-size="13" data-t="size13"></button>' +
    '  <button type="button" class="bg-seg-btn" data-size="9" data-t="size9"></button>' +
    '</div>' +
    '<div class="bg-field"><span data-t="capBlack"></span><b data-cap="1">0</b>' +
    '<span>·</span><span data-t="capWhite"></span><b data-cap="2">0</b></div>';

  /* 终局浮层（挂在 root 内、外壳之外，避免与按钮派发混淆） */
  var RESULT_HTML =
    '<div class="bg-overlay" hidden>' +
    '  <div class="bg-modal">' +
    '    <h2 class="bg-modal-title" data-t="resultTitle"></h2>' +
    '    <p class="bg-modal-sub" data-result-line></p>' +
    '    <div class="bg-score-list" data-result-score hidden></div>' +
    '    <p class="bg-modal-sub" data-result-note hidden></p>' +
    '    <div class="bg-modal-actions">' +
    '      <button type="button" class="pg-btn" data-result-act="again" data-t="again"></button>' +
    '      <button type="button" class="pg-btn pg-btn--ghost" data-result-act="close" data-t="viewBoard"></button>' +
    '    </div>' +
    '  </div>' +
    '</div>';

  /* ---------------- 对局状态 ---------------- */
  var R = null;
  var AI = null;

  var size = 19;
  var board = null;
  var turn = 1;
  var captures = [0, 0, 0];
  var ko = -1;
  var passes = 0;
  var history = [];
  var snapshots = [];
  var lastMove = null;
  var over = false;
  var winner = 0;
  var resultInfo = null;
  var anim = null;
  var hover = null;
  var recordedWinner = 0;

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
  var segEl = null;
  var capEls = null;
  var resultEl = null;
  var resultLineEl = null;
  var resultScoreEl = null;
  var resultNoteEl = null;

  var GAME_ID = 'go';
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

  function sideName(color) {
    if (mode === 'ai') return color === aiColor ? i18n.t('ai') : i18n.t('you');
    return color === R.BLACK ? i18n.t('black') : i18n.t('white');
  }

  function colorName(color) {
    return color === R.BLACK ? i18n.t('black') : i18n.t('white');
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

    var c = palette();
    var ac = BG.canvas.accent();
    var m = metrics();
    var end = m.pad + m.cell * (size - 1);

    ctx.clearRect(0, 0, W, W);

    var grad = ctx.createLinearGradient(0, 0, W, W);
    grad.addColorStop(0, c.bgFrom);
    grad.addColorStop(1, c.bgTo);
    ctx.fillStyle = grad;
    BG.canvas.roundRect(ctx, 0, 0, W, W, 10);
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
      drawStone(hp.px, hp.py, turn, m.cell, 1);
      ctx.globalAlpha = 1;
    }

    var animStone = null;
    if (anim) {
      var p = Math.min(1, (performance.now() - anim.start) / anim.dur);
      if (p >= 1) anim = null;
      else animStone = { x: anim.x, y: anim.y, scale: 0.6 + 0.4 * easeOut(p) };
    }

    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var v = board[R.idx(size, x, y)];
        if (!v) continue;
        var pt = cellPx(x, y);
        var scale = (animStone && animStone.x === x && animStone.y === y) ? animStone.scale : 1;
        drawStone(pt.px, pt.py, v, m.cell, scale);
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

  /* ---------------- 流程 ---------------- */
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
    if (reason === 'ko') return i18n.t('illegalKo');
    if (reason === 'suicide') return i18n.t('illegalSuicide');
    if (reason === 'occupied') return i18n.t('illegalOccupied');
    return String(reason || '');
  }

  function tryPlace(x, y, byAi) {
    if (over) return false;
    var res = R.play(board, size, x, y, turn, ko);
    if (!res.ok) {
      if (!byAi) {
        BG.sfx.alert();
        ui.toast(reasonText(res.reason));
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
    anim = reduceMotion() ? null : { x: x, y: y, start: performance.now(), dur: 170 };
    turn = R.opponent(color);

    if (res.captured.length) BG.sfx.capture();
    else if (byAi) BG.sfx.place(540);
    else BG.sfx.stone();

    if (res.captured.length && !byAi) {
      ui.toast(i18n.fmt('captured', { n: res.captured.length }));
    }

    refresh();
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
    BG.sfx.tone(380, 0.07, 'sine', 0.05);

    refresh();

    if (passes >= 2) {
      ui.toast(i18n.t('passBoth'));
      endByScore();
      return;
    }
    if (!byAi) ui.toast(i18n.fmt('passToast', { side: sideName(color) }));
    scheduleAi();
  }

  function resign() {
    if (!mode || over) return;
    gameToken++;
    aiThinking = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }

    over = true;
    winner = R.opponent(turn);
    resultInfo = { type: 'resign', loser: turn, winner: winner };
    history.push({ resign: true, color: turn });
    recordResult(winner);
    BG.sfx.lose();
    refresh();
    openResult();
    ui.toast(i18n.fmt('resignResult', {
      loser: sideName(turn),
      winner: sideName(winner)
    }));
  }

  function endByScore() {
    var s = R.score(board, size, R.KOMI);
    over = true;
    winner = s.winner;
    resultInfo = { type: 'score', score: s };
    recordResult(winner);
    BG.sfx.win();
    refresh();
    openResult();
  }

  function undo() {
    gameToken++;
    aiThinking = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }

    if (!snapshots.length) {
      ui.toast(i18n.t('undoEmpty'));
      return;
    }

    if (over && recordedWinner) {
      BG.store.bump(GAME_ID, KEYS.stats,
        recordedWinner === R.BLACK ? 'black' : 'white', -1);
      recordedWinner = 0;
    }

    restore(snapshots.pop());
    history.pop();
    over = false;
    winner = R.EMPTY;
    resultInfo = null;
    closeResult();

    // 人机模式：撤回后若轮到电脑，再撤一手把回合交还玩家
    if (mode === 'ai' && turn === aiColor && snapshots.length) {
      restore(snapshots.pop());
      history.pop();
    }

    BG.sfx.undo();
    refresh();
  }

  function resetGame() {
    gameToken++;
    aiThinking = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }

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
    recordedWinner = 0;
    anim = null;
    hover = null;

    closeResult();
    refresh();
  }

  function setSize(n) {
    if (n === size) return;
    size = n;
    syncSizeButtons();
    resetGame();
    if (cheatGod) cheatGod = false;
    setupCheat();   // 棋盘尺寸变了，重建编辑网格
    ui.toast(i18n.fmt('boardChanged', { n: n }));
  }

  function syncSizeButtons() {
    if (!root) return;
    var btns = root.querySelectorAll('[data-size]');
    for (var i = 0; i < btns.length; i++) {
      var v = Number(btns[i].getAttribute('data-size'));
      btns[i].classList.toggle('is-active', v === size);
    }
  }

  function scheduleAi() {
    if (mode !== 'ai' || over) return;
    if (cheatFreeze || cheatGod) return;
    if (turn !== aiColor) return;
    aiThinking = true;
    updateStatus();
    var token = gameToken;

    aiTimer = setTimeout(function () {
      aiTimer = null;
      if (token !== gameToken || !alive) return;

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
      if (token !== gameToken || !alive) return;
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

  /* ---------------- 存档 ---------------- */
  function loadStats() {
    var s = BG.store.get(GAME_ID, KEYS.stats, {});
    return { black: s.black || 0, white: s.white || 0 };
  }

  function recordResult(color) {
    if (color === R.BLACK) BG.store.bump(GAME_ID, KEYS.stats, 'black', 1);
    else if (color === R.WHITE) BG.store.bump(GAME_ID, KEYS.stats, 'white', 1);
    else return;
    recordedWinner = color;
  }

  /* ---------------- 界面刷新 ---------------- */
  function resultLine() {
    if (!resultInfo) return '';
    if (resultInfo.type === 'resign') {
      return i18n.fmt('resignResult', {
        loser: sideName(resultInfo.loser),
        winner: sideName(resultInfo.winner)
      });
    }
    var s = resultInfo.score;
    if (s.winner === R.EMPTY) return i18n.t('drawText');
    return i18n.fmt('scoreResult', {
      winner: colorName(s.winner),
      margin: s.margin.toFixed(1)
    });
  }

  function statusText() {
    if (!mode) return i18n.t('modePvp');
    if (over) return resultLine() || i18n.t('resultTitle');
    if (mode === 'ai' && (aiThinking || turn === aiColor)) return i18n.t('thinking');
    if (mode === 'ai') return i18n.t('yourTurn');
    return i18n.fmt('turn', { side: sideName(turn) });
  }

  function updateStatus() {
    if (!ui) return;
    ui.setStatus(statusText());
    ui.setMode(modeText());
    if (over) ui.setDot('is-win');
    else if (mode === 'ai' && (aiThinking || turn === aiColor)) ui.setDot('is-thinking');
    else ui.setDot(turn === R.BLACK ? 'is-black' : 'is-white');
    syncButtons();
  }

  function syncButtons() {
    if (!root) return;
    var passBtn = root.querySelector('[data-act="pass"]');
    if (passBtn) passBtn.disabled = over || (mode === 'ai' && turn === aiColor);
    var resignBtn = root.querySelector('[data-act="resign"]');
    if (resignBtn) resignBtn.disabled = over;
  }

  function renderCaptures() {
    if (!capEls) return;
    capEls[1].textContent = String(captures[1]);
    capEls[2].textContent = String(captures[2]);
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
        '<span>' + moveLabel(history[i]) + '</span>' +
        '<span>' + moveLabel(history[i + 1]) + '</span></div>');
    }
    ui.setMoves(rows.join(''));
  }

  function moveLabel(mv) {
    if (!mv) return '';
    if (mv.resign) return i18n.t('resign');
    if (mv.pass) return i18n.t('passMove');
    return R.coordName(size, mv.x, mv.y) + (mv.captured ? '×' + mv.captured : '');
  }

  function scoreLine(color, data, s) {
    var detail = color === R.WHITE
      ? i18n.fmt('scoreDetailKomi', {
        stones: data.stones,
        territory: data.territory,
        komi: s.komi.toFixed(1)
      })
      : i18n.fmt('scoreDetail', { stones: data.stones, territory: data.territory });
    return '<div class="bg-score-row"><span>' +
      '<i class="bg-dot ' + (color === R.BLACK ? 'black' : 'white') + '"></i> ' +
      colorName(color) + ' · ' + detail + '</span>' +
      '<b>' + data.total.toFixed(1) + '</b></div>';
  }

  function renderResult() {
    if (!resultEl || !resultInfo) return;
    resultLineEl.textContent = resultLine();

    if (resultInfo.type === 'score') {
      var s = resultInfo.score;
      resultScoreEl.hidden = false;
      resultScoreEl.innerHTML = scoreLine(R.BLACK, s.black, s) + scoreLine(R.WHITE, s.white, s);
      resultNoteEl.hidden = false;
      resultNoteEl.textContent = i18n.t('komiNote');
    } else {
      resultScoreEl.hidden = true;
      resultScoreEl.innerHTML = '';
      var st = loadStats();
      resultNoteEl.hidden = false;
      resultNoteEl.textContent = i18n.t('resignNote') + ' ' +
        i18n.fmt('statsNote', { black: st.black, white: st.white });
    }
  }

  function openResult() {
    if (!resultEl) return;
    renderResult();
    resultEl.hidden = false;
  }

  function closeResult() {
    if (!resultEl) return;
    resultEl.hidden = true;
  }

  function refresh() {
    render();
    renderMoves();
    renderCaptures();
    updateStatus();
  }

  /* ---------------- 交互 ---------------- */
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

  function onResize() {
    render();
  }

  function onExtraClick(e) {
    var btn = e.target.closest('[data-size]');
    if (!btn || !root.contains(btn)) return;
    setSize(Number(btn.getAttribute('data-size')));
  }

  function onResultClick(e) {
    var btn = e.target.closest('[data-result-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-result-act');
    BG.sfx.click();
    if (act === 'again') {
      closeResult();
      resetGame();
      ui.toast(i18n.t('restarted'));
    } else {
      closeResult();
    }
  }

  /* ---------------- 挂载 / 卸载 ---------------- */
  /* ------------------------------------------------------------ */
  /* 修改器：暗号 potato4096 唤出（platform/cheat-kit.js）          */
  /* ------------------------------------------------------------ */

  var cheatGod = false;
  var cheatFreeze = false;

  function cheatPalette() {
    return [
      { label: { zh: '空', en: 'Empty' }, value: '', swatch: '#0000' },
      { label: { zh: '● 黑子', en: '● Black' }, value: '1', swatch: '#22252c' },
      { label: { zh: '○ 白子', en: '○ White' }, value: '2', swatch: '#f6f6f6' }
    ];
  }

  function cheatAt(r, c) {
    if (!board) return R.EMPTY;
    return board[R.idx(size, c, r)];
  }

  function cheatSetPiece(r, c, v) {
    if (!cheatGod || !board) return;
    board[R.idx(size, c, r)] = v === '' || v == null ? R.EMPTY : Number(v);
    ko = -1;          // 摆子后劫争状态失效
    lastMove = null;  // 避免最后一手标记指向被改动的点
    render();
  }

  function cheatWipe() {
    if (!board) return;
    for (var i = 0; i < board.length; i++) board[i] = R.EMPTY;
    ko = -1;
    lastMove = null;
    history.length = 0;
    passes = 0;
    captures[1] = 0;
    captures[2] = 0;
    over = false;
    resultInfo = null;
    render();
    renderMoves();
    updateStatus();
  }

  function cheatCorners() {
    if (!board) return;
    var d = size >= 19 ? 3 : 2;
    var pts = [[d, d], [size - 1 - d, d], [d, size - 1 - d], [size - 1 - d, size - 1 - d]];
    for (var i = 0; i < pts.length; i++) {
      board[R.idx(size, pts[i][0], pts[i][1])] = R.BLACK;
    }
    render();
    ui.toast(i18n.lang() === 'en' ? 'Four corners claimed' : '四角已占');
  }

  function cheatCount(color) {
    if (!board) return 0;
    var n = 0;
    for (var i = 0; i < board.length; i++) if (board[i] === color) n++;
    return n;
  }

  function setupCheat() {
    if (!global.CheatKit) return;
    CheatKit.init({
      id: GAME_ID,
      dock: root,
      title: { zh: '🔧 修改器 · 上帝模式', en: '🔧 Modifier · God Mode' },
      hint: {
        zh: '开启上帝模式后，在下方棋盘点交叉点摆子；AI 同时冻结',
        en: 'Enable God Mode, then tap an intersection below to place a stone. AI freezes too.'
      },
      stats: [
        { label: { zh: '手数', en: 'Moves' }, get: function () { return history.length; } },
        { label: { zh: '轮到', en: 'Turn' }, get: function () { return sideName(turn); } },
        { label: { zh: '黑子', en: 'Black' }, get: function () { return cheatCount(R.BLACK); } },
        { label: { zh: '白子', en: 'White' }, get: function () { return cheatCount(R.WHITE); } },
        { label: { zh: '提子(黑/白)', en: 'Captures B/W' }, get: function () {
          return (captures[1] || 0) + '/' + (captures[2] || 0);
        } },
        { label: { zh: '路数', en: 'Board' }, get: function () { return size + '×' + size; } }
      ],
      toggles: [
        { label: { zh: '上帝模式', en: 'God mode' },
          on: { zh: '上帝模式：开', en: 'God Mode: ON' },
          off: { zh: '上帝模式：关', en: 'God Mode: OFF' },
          get: function () { return cheatGod; },
          set: function (v) { cheatGod = !!v; if (cheatGod) cheatFreeze = true; } },
        { label: { zh: '冻结 AI', en: 'Freeze AI' },
          on: { zh: 'AI：已冻结', en: 'AI: frozen' },
          off: { zh: 'AI：正常', en: 'AI: live' },
          get: function () { return cheatFreeze; },
          set: function (v) { cheatFreeze = !!v; } }
      ],
      actions: [
        { label: { zh: '清空棋盘', en: 'Clear board' }, run: cheatWipe },
        { label: { zh: '恢复开局', en: 'New game' }, run: function () { resetGame(); } },
        { label: { zh: '我方占四角', en: 'Claim four corners' }, run: cheatCorners }
      ],
      board: {
        title: { zh: '棋盘摆子（点交叉点放置所选棋子）', en: 'Board editor (tap to place)' },
        rows: size,
        cols: size,
        palette: cheatPalette(),
        cell: function (r, c) {
          var v = cheatAt(r, c);
          if (v === R.EMPTY || v == null) return { value: '', label: '' };
          return {
            value: String(v),
            label: v === R.BLACK ? '●' : '○',
            side: v === R.BLACK ? 'own' : 'enemy'
          };
        },
        place: cheatSetPiece
      }
    });
  }

  function mount(host, opts) {
    R = global.GoRules;
    AI = global.GoAI;
    if (!R || !AI) throw new Error('围棋模块未就绪');

    root = host;
    alive = true;
    mode = opts && opts.mode === 'ai' ? 'ai' : 'pvp';
    difficulty = (opts && opts.difficulty) || 'medium';
    aiColor = R.WHITE;
    size = 19;

    ui = BG.shell.create(root, {
      id: GAME_ID,
      title: { zh: '围棋', en: 'Go' },
      hint: {
        zh: '点击交叉点落子；双方连续虚手即按中国规则数子法终局计分',
        en: 'Tap an intersection. Two consecutive passes end the game and trigger Chinese area scoring.'
      },
      stats: [],
      actions: ['undo', 'pass', 'resign', 'restart'],
      extraHtml: EXTRA_HTML,
      onAction: function (act) {
        if (act === 'undo') undo();
        else if (act === 'pass') {
          if (!canHumanPlay()) return;
          doPass(turn, false);
        } else if (act === 'resign') resign();
        else if (act === 'restart') {
          resetGame();
          ui.toast(i18n.t('restarted'));
        }
      },
      onExit: function () { if (opts && opts.exit) opts.exit(); },
      onThemeChange: function () { render(); },
      onLangChange: function () {
        updateStatus();
        renderMoves();
        if (resultInfo && resultEl && !resultEl.hidden) renderResult();
      },
      onResize: onResize,
      onDestroy: function () {
        canvas = null;
        ctx = null;
      }
    });

    canvas = ui.el.canvas;
    ctx = BG.canvas.setup(canvas, W, W);

    segEl = ui.el.extra;
    capEls = {
      1: ui.el.extra.querySelector('[data-cap="1"]'),
      2: ui.el.extra.querySelector('[data-cap="2"]')
    };

    host.insertAdjacentHTML('beforeend', RESULT_HTML);
    resultEl = host.querySelector('.bg-overlay');
    resultLineEl = host.querySelector('[data-result-line]');
    resultScoreEl = host.querySelector('[data-result-score]');
    resultNoteEl = host.querySelector('[data-result-note]');
    i18n.applyText(host);

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    segEl.addEventListener('click', onExtraClick);
    resultEl.addEventListener('click', onResultClick);
    global.addEventListener('resize', onResize);

    syncSizeButtons();
    resetGame();
    setupCheat();

    if (mode === 'ai' && turn === aiColor) scheduleAi();
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
    if (segEl) segEl.removeEventListener('click', onExtraClick);
    if (resultEl) resultEl.removeEventListener('click', onResultClick);
    global.removeEventListener('resize', onResize);

    if (ui) {
      ui.destroy();
      ui = null;
    }
    canvas = null;
    ctx = null;
    segEl = null;
    capEls = null;
    resultEl = null;
    resultLineEl = null;
    resultScoreEl = null;
    resultNoteEl = null;
    root = null;
  }

  BG.registerGame('go', { mount: mount, unmount: unmount });
})(window);
