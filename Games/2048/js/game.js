/* 2048 - core game: board state, moves, merge scoring, rendering, cheat kit */
(function () {
  'use strict';

  var T4 = window.T4 = window.T4 || {};

  // ---------- constants ----------
  var SIZE = 4;
  var BEST_KEY = 'best:2048';

  // ---------- i18n ----------
  var STR = {
    title: { zh: '2048', en: '2048' },
    tagline: {
      zh: '滑动方块，相同数字相撞即合并。合成 2048 即获胜，还能继续挑战更大方块。',
      en: 'Slide tiles and merge equal numbers. Reach 2048 to win - or keep going for even bigger tiles.'
    },
    score: { zh: '得分', en: 'Score' },
    best: { zh: '最高分', en: 'Best' },
    moves: { zh: '步数', en: 'Moves' },
    maxTile: { zh: '最大方块', en: 'Top tile' },
    start: { zh: '开始游戏', en: 'Start' },
    restart: { zh: '重新开始', en: 'Restart' },
    resume: { zh: '继续游戏', en: 'Resume' },
    paused: { zh: '已暂停', en: 'Paused' },
    gameOver: { zh: '游戏结束', en: 'Game Over' },
    winTitle: { zh: '2048！达成！', en: 'You made 2048!' },
    again: { zh: '再玩一次', en: 'Play Again' },
    continuePlay: { zh: '继续挑战', en: 'Keep Going' },
    home: { zh: '返回主页', en: 'Home' },
    undo: { zh: '撤销', en: 'Undo' },
    undoNone: { zh: '没有可撤销的一步', en: 'Nothing to undo' },
    clearRecords: { zh: '清除记录', en: 'Clear Records' },
    cleared: { zh: '记录已清除', en: 'Records cleared' },
    newRecord: { zh: '新纪录！', en: 'New record!' },
    controls: {
      zh: '操作：方向键 / WASD / 触屏滑动移动方块，U 或「撤销」按钮悔一步，Esc / P 暂停。相同数字相撞合并并加分。',
      en: 'Controls: arrow keys / WASD / swipe to move, U or the Undo button to take a move back, Esc / P to pause. Equal tiles merge and score.'
    },
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    pauseBtn: { zh: '暂停', en: 'Pause' }
  };
  function t(k) { return GamePlatform.i18n.t(STR[k] || { zh: k, en: k }); }

  // ---------- dom ----------
  var boardEl = document.getElementById('board');
  var scoreFloat = document.getElementById('score-float');
  var cells = [];

  // ---------- state ----------
  var grid = [];        // length SIZE*SIZE, 0 = empty
  var score = 0;
  var best = 0;
  var moves = 0;
  var over = false;
  var won = false;      // 2048 已出现过
  var keepPlaying = false;
  var playing = false;
  var history = [];     // undo stack, max 5
  var cheatGod = false;

  // ---------- helpers ----------
  function idx(r, c) { return r * SIZE + c; }
  function rc(i) { return [Math.floor(i / SIZE), i % SIZE]; }

  function maxTile() {
    var m = 0;
    for (var i = 0; i < grid.length; i++) if (grid[i] > m) m = grid[i];
    return m || 2;
  }

  function emptyCells() {
    var out = [];
    for (var i = 0; i < grid.length; i++) if (!grid[i]) out.push(i);
    return out;
  }

  function fmt(n) {
    return typeof n === 'number' ? n.toLocaleString() : String(n);
  }

  // ---------- game flow ----------
  function newGame() {
    grid = [];
    for (var i = 0; i < SIZE * SIZE; i++) grid.push(0);
    score = 0;
    moves = 0;
    over = false;
    won = false;
    keepPlaying = false;
    history = [];
    spawn();
    spawn();
    render();
    updateHUD();
  }

  function spawn() {
    var free = emptyCells();
    if (!free.length) return false;
    var pick = free[Math.floor(Math.random() * free.length)];
    grid[pick] = Math.random() < 0.9 ? 2 : 4;
    return pick;
  }

  function pushHistory() {
    history.push({ grid: grid.slice(), score: score, moves: moves, won: won });
    if (history.length > 5) history.shift();
  }

  function undo() {
    if (!history.length) { toast(t('undoNone')); return; }
    var prev = history.pop();
    grid = prev.grid;
    score = prev.score;
    moves = prev.moves;
    won = prev.won;
    over = false;
    hideOverlays();
    render();
    updateHUD();
    T4.audio.play('undo');
  }

  /** 把一行/列向 left(true) 滑动合并，返回 {moved, gained, mergedIdx[]} */
  function slideLine(line) {
    var vals = [];
    for (var i = 0; i < line.length; i++) if (line[i]) vals.push(line[i]);
    var merged = [];
    var gained = 0;
    for (var j = 0; j < vals.length - 1; j++) {
      if (vals[j] === vals[j + 1]) {
        vals[j] *= 2;
        gained += vals[j];
        merged.push(j);
        vals.splice(j + 1, 1);
      }
    }
    while (vals.length < line.length) vals.push(0);
    var moved = false;
    for (var k = 0; k < line.length; k++) if (vals[k] !== line[k]) moved = true;
    return { line: vals, moved: moved, gained: gained, merged: merged };
  }

  /** dir: 0 上 1 右 2 下 3 左 */
  function move(dir) {
    if (!playing || over) return false;
    pushHistory();
    var gained = 0;
    var moved = false;
    var popCells = [];

    for (var i = 0; i < SIZE; i++) {
      var line = [];
      for (var j = 0; j < SIZE; j++) {
        if (dir === 0) line.push(grid[idx(j, i)]);
        else if (dir === 2) line.push(grid[idx(SIZE - 1 - j, i)]);
        else if (dir === 3) line.push(grid[idx(i, j)]);
        else line.push(grid[idx(i, SIZE - 1 - j)]);
      }
      var res = slideLine(line);
      if (res.moved) moved = true;
      gained += res.gained;
      for (var k = 0; k < SIZE; k++) {
        var target;
        if (dir === 0) target = idx(k, i);
        else if (dir === 2) target = idx(SIZE - 1 - k, i);
        else if (dir === 3) target = idx(i, k);
        else target = idx(i, SIZE - 1 - k);
        grid[target] = res.line[k];
        if (res.merged.indexOf(k) !== -1) popCells.push(target);
      }
    }

    if (!moved) {
      history.pop();
      return false;
    }

    moves++;
    if (gained > 0) {
      score += gained;
      showScoreFloat(gained);
      T4.audio.play(gained >= 128 ? 'big' : 'merge');
    } else {
      T4.audio.play('move');
    }

    var np = spawn();
    render(np, popCells);
    updateHUD();

    if (maxTile() >= 2048 && !won) {
      won = true;
      if (!keepPlaying) {
        showOverlay('ov-win');
        T4.audio.play('win');
      }
    }

    if (!canMove() && !cheatGod) {
      over = true;
      showOverlay('ov-gameover');
      T4.audio.play('lose');
      saveBest();
    } else if (!canMove() && cheatGod) {
      // 无敌模式：没得走了就自动腾一格，游戏不结束
      var free = emptyCells();
      if (!free.length) grid[Math.floor(Math.random() * grid.length)] = 2;
    }
    return true;
  }

  function canMove() {
    if (emptyCells().length) return true;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = grid[idx(r, c)];
        if (c + 1 < SIZE && grid[idx(r, c + 1)] === v) return true;
        if (r + 1 < SIZE && grid[idx(r + 1, c)] === v) return true;
      }
    }
    return false;
  }

  // ---------- storage ----------
  function loadBest() {
    var v = GamePlatform.storage.get(BEST_KEY, 0);
    best = typeof v === 'number' ? v : (parseInt(v, 10) || 0);
    return best;
  }

  function saveBest() {
    if (score > best) {
      best = score;
      GamePlatform.storage.set(BEST_KEY, best);
    }
    updateHUD();
  }

  function clearRecords() {
    best = 0;
    GamePlatform.storage.set(BEST_KEY, 0);
    updateHUD();
    toast(t('cleared'));
    GamePlatform.ui.toast(t('cleared'));
  }

  // ---------- render ----------
  function render(popIdx, popCells) {
    if (!cells.length) {
      for (var i = 0; i < SIZE * SIZE; i++) {
        var d = document.createElement('div');
        d.className = 'cell is-empty';
        boardEl.appendChild(d);
        cells.push(d);
      }
    }
    var pops = popCells || [];
    for (var j = 0; j < cells.length; j++) {
      var v = grid[j];
      var cell = cells[j];
      cell.classList.remove('is-pop');
      if (!v) {
        cell.textContent = '';
        cell.removeAttribute('data-v');
        cell.className = 'cell is-empty';
      } else {
        cell.textContent = String(v);
        cell.setAttribute('data-v', String(v));
        cell.className = 'cell';
        if (!GamePlatform.ui.shouldReduceMotion() &&
            (popIdx === j || pops.indexOf(j) !== -1)) {
          void cell.offsetWidth;
          cell.classList.add('is-pop');
        }
      }
    }
  }

  function updateHUD() {
    if (score > best) best = score;   // 实时显示，刷新页面前未保存
    set('hud-score', fmt(score));
    set('hud-best', fmt(best));
    set('hud-moves', fmt(moves));
    set('hud-max', fmt(maxTile()));
    set('menu-best', fmt(best));
    var b = document.getElementById('btn-undo');
    if (b) b.disabled = !history.length;
  }

  function set(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function showScoreFloat(gained) {
    if (GamePlatform.ui.shouldReduceMotion()) return;
    scoreFloat.hidden = false;
    scoreFloat.textContent = '+' + fmt(gained);
    scoreFloat.style.animation = 'none';
    void scoreFloat.offsetWidth;
    scoreFloat.style.animation = '';
  }

  // ---------- overlays ----------
  function hideOverlays() {
    ['ov-menu', 'ov-pause', 'ov-win', 'ov-gameover'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }

  function showOverlay(id) {
    hideOverlays();
    var el = document.getElementById(id);
    if (el) el.hidden = false;
    if (id === 'ov-win') {
      set('win-score', fmt(score));
      set('win-best', fmt(best));
    }
    if (id === 'ov-gameover') {
      saveBest();
      set('go-score', fmt(score));
      set('go-moves', fmt(moves));
      set('go-best', fmt(best));
    }
    if (id === 'ov-menu') {
      loadBest();
      set('menu-best', fmt(best));
    }
  }

  function toast(msg) {
    if (GamePlatform.ui && GamePlatform.ui.toast) GamePlatform.ui.toast(msg);
  }

  function startGame() {
    newGame();
    playing = true;
    hideOverlays();
    T4.audio.play('start');
  }

  function togglePause() {
    if (!playing || over) return;
    var pv = document.getElementById('ov-pause');
    if (pv && !pv.hidden) {
      pv.hidden = true;
    } else {
      showOverlay('ov-pause');
    }
  }

  // ---------- input ----------
  var DIR_KEYS = {
    ArrowUp: 0, KeyW: 0,
    ArrowRight: 1, KeyD: 1,
    ArrowDown: 2, KeyS: 2,
    ArrowLeft: 3, KeyA: 3
  };

  function onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
    if (e.code === 'KeyU') { undo(); return; }
    if (DIR_KEYS[e.code] != null) {
      e.preventDefault();
      var pv = document.getElementById('ov-pause');
      if (pv && !pv.hidden) return;
      move(DIR_KEYS[e.code]);
    }
  }

  // 触屏滑动
  var touchStart = null;
  function onTouchStart(e) {
    var p = e.touches ? e.touches[0] : e;
    touchStart = { x: p.clientX, y: p.clientY };
  }
  function onTouchEnd(e) {
    if (!touchStart) return;
    var p = (e.changedTouches ? e.changedTouches[0] : e);
    var dx = p.clientX - touchStart.x;
    var dy = p.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : 3);
    else move(dy > 0 ? 2 : 0);
  }

  // ---------- cheat ----------
  function cheatUndo() { undo(); }

  function cheatWinNow() {
    // 摆出一个 2048，其余保留
    var free = emptyCells();
    if (free.length) {
      grid[free[0]] = 2048;
    } else {
      grid[0] = 2048;
    }
    render(free.length ? free[0] : 0);
    updateHUD();
  }

  function cheatClear() {
    for (var i = 0; i < grid.length; i++) grid[i] = 0;
    grid[0] = 2;
    grid[1] = 2;
    over = false;
    render();
    updateHUD();
  }

  function cheatRestart() {
    startGame();
  }

  // ---------- boot ----------
  function applyLang() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
  }

  function bind() {
    document.getElementById('btn-home').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-pause').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-go').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-start').onclick = startGame;
    document.getElementById('btn-again-go').onclick = startGame;
    document.getElementById('btn-restart-pause').onclick = startGame;
    document.getElementById('btn-restart-win').onclick = startGame;
    document.getElementById('btn-continue').onclick = function () {
      keepPlaying = true;
      hideOverlays();
    };
    document.getElementById('btn-resume').onclick = togglePause;
    document.getElementById('btn-pause').onclick = togglePause;
    document.getElementById('btn-undo').onclick = undo;
    document.getElementById('btn-clear').onclick = clearRecords;
    document.getElementById('btn-fullscreen').onclick = function () {
      GamePlatform.ui.requestFullscreen(document.documentElement);
    };
    document.addEventListener('keydown', onKeyDown);
    boardEl.addEventListener('touchstart', onTouchStart, { passive: true });
    boardEl.addEventListener('touchend', onTouchEnd, { passive: true });
    boardEl.addEventListener('mousedown', function (e) {
      touchStart = { x: e.clientX, y: e.clientY };
    });
    document.addEventListener('mouseup', function (e) {
      if (touchStart) onTouchEnd(e);
    });
  }

  GamePlatform.ready.then(function () {
    loadBest();
    applyLang();
    bind();
    newGame();
    playing = false;
    showOverlay('ov-menu');

    GamePlatform.settings.onChange(function (s, changed) {
      if (changed.indexOf('sound') !== -1 || changed.indexOf('reduceMotion') !== -1) { /* 状态即取 */ }
    });
    GamePlatform.i18n.onChange(function () { applyLang(); updateHUD(); });
  });

  // ---------- cheat kit ----------
  if (window.CheatKit) {
    CheatKit.init({
      id: '2048',
      title: { zh: '🔧 修改器', en: '🔧 Modifier' },
      hint: { zh: '彩蛋面板 · 参数即时生效', en: 'Easter egg · changes apply instantly' },
      stats: [
        { label: { zh: '得分', en: 'Score' }, get: function () { return score; }, tone: 'success' },
        { label: { zh: '最高分', en: 'Best' }, get: function () { return best; } },
        { label: { zh: '最大方块', en: 'Top tile' }, get: maxTile, tone: 'warning' },
        { label: { zh: '步数', en: 'Moves' }, get: function () { return moves; } },
        { label: { zh: '空格数', en: 'Empty cells' }, get: function () { return emptyCells().length; } },
        { label: { zh: '状态', en: 'State' }, get: function () { return over ? t('gameOver') : (playing ? 'playing' : t('paused')); } }
      ],
      params: [
        { key: 'score', label: { zh: '得分', en: 'Score' }, min: 0, max: 999999, step: 10,
          get: function () { return score; },
          set: function (v) { score = Math.max(0, Math.round(v)); if (score > best) saveBest(); render(); updateHUD(); } },
        { key: 'moves', label: { zh: '步数', en: 'Moves' }, min: 0, max: 99999, step: 1,
          get: function () { return moves; },
          set: function (v) { moves = Math.max(0, Math.round(v)); updateHUD(); } }
      ],
      toggles: [
        { label: { zh: '无敌', en: 'God mode' },
          on: { zh: '无敌：开', en: 'God: ON' },
          off: { zh: '无敌：关', en: 'God: OFF' },
          get: function () { return cheatGod; },
          set: function (v) { cheatGod = !!v; } }
      ],
      actions: [
        { label: { zh: '撤销一步', en: 'Undo' }, run: cheatUndo },
        { label: { zh: '摆出 2048', en: 'Spawn 2048' }, run: cheatWinNow,
          toast: { zh: '已摆出 2048', en: '2048 placed' } },
        { label: { zh: '清空棋盘', en: 'Clear board' }, run: cheatClear,
          toast: { zh: '棋盘已清空', en: 'Board cleared' } },
        { label: { zh: '重开本局', en: 'Restart' }, run: cheatRestart, tone: 'danger' }
      ]
    });
  }
})();
