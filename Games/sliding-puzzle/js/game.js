/* sliding-puzzle - core game: grid, sliding, timer, best records, cheats */
(function () {
  'use strict';

  var SLP = window.SLP = window.SLP || {};

  // ---------- constants ----------
  var SIZES = [3, 4, 5];
  var SHUFFLE_FACTOR = 30;   // 洗牌：从完成态做 N²×30 次随机合法移动
  var SCRAMBLE_FACTOR = 20;  // 修改器「打乱」：当前局面再走 N²×20 步

  // ---------- i18n ----------
  var STR = {
    title: { zh: '数字华容道', en: 'Sliding Puzzle' },
    tagline: {
      zh: '点击与空格相邻的方块滑动，把数字按 1 到 N²-1 排好、右下角留空即可过关。',
      en: 'Tap a tile next to the blank to slide it. Put 1 through N²-1 in order with the blank at the bottom right to win.'
    },
    size: { zh: '阶数', en: 'Size' },
    moves: { zh: '步数', en: 'Moves' },
    time: { zh: '用时', en: 'Time' },
    bestSteps: { zh: '最佳步数', en: 'Best Moves' },
    bestTime: { zh: '最佳用时', en: 'Best Time' },
    paused: { zh: '已暂停', en: 'Paused' },
    resume: { zh: '继续游戏', en: 'Resume' },
    restart: { zh: '重新开始', en: 'Restart' },
    toMenu: { zh: '返回菜单', en: 'Menu' },
    home: { zh: '返回主页', en: 'Home' },
    win: { zh: '拼图完成！', en: 'Puzzle Solved!' },
    again: { zh: '再玩一次', en: 'Play Again' },
    clearRecords: { zh: '清除记录', en: 'Clear Records' },
    cleared: { zh: '记录已清除', en: 'Records cleared' },
    newRecord: { zh: '新纪录！', en: 'New record!' },
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    pauseBtn: { zh: '暂停', en: 'Pause' },
    controls: {
      zh: '操作：点击与空格相邻的方块滑动；方向键也可移动（方向即方块滑动方向），Esc / P 暂停。目标：把 1 到 N²-1 按顺序排好，右下角留空。',
      en: 'Controls: tap a tile next to the blank to slide it; arrow keys move tiles too (arrow = slide direction), Esc / P to pause. Goal: order 1..N²-1 with the blank at the bottom right.'
    },
    // ---- 修改器文案 ----
    placed: { zh: '已归位数', en: 'Placed' },
    progress: { zh: '完成度', en: 'Progress' },
    state: { zh: '状态', en: 'State' },
    statusMenu: { zh: '未开始', en: 'Not started' },
    statusPlaying: { zh: '进行中', en: 'In progress' },
    statusPaused: { zh: '已暂停', en: 'Paused' },
    statusWon: { zh: '胜利', en: 'Won' },
    showAnswer: { zh: '显示答案', en: 'Show Answer' },
    showAnswerOn: { zh: '显示答案：开', en: 'Show Answer: ON' },
    showAnswerOff: { zh: '显示答案：关', en: 'Show Answer: OFF' },
    freezeTimer: { zh: '冻结计时', en: 'Freeze Timer' },
    freezeTimerOn: { zh: '冻结计时：开', en: 'Freeze Timer: ON' },
    freezeTimerOff: { zh: '冻结计时：关', en: 'Freeze Timer: OFF' },
    cheatSolve: { zh: '自动复原', en: 'Auto Solve' },
    cheatScramble: { zh: '打乱', en: 'Scramble' },
    cheatOneAway: { zh: '差一步完成', en: 'One Move Away' },
    cheatRestart: { zh: '重开本局', en: 'Restart Round' },
    toastSolved: { zh: '已自动复原', en: 'Auto-solved' },
    toastScrambled: { zh: '已打乱', en: 'Scrambled' },
    toastOneAway: { zh: '已置为差一步完成', en: 'Set one move away' }
  };
  function t(k) { return GamePlatform.i18n.t(STR[k] || { zh: k, en: k }); }

  // ---------- dom ----------
  var boardEl = document.getElementById('board');
  var cellsEl = document.getElementById('cells');
  var tileEls = []; // 按数字编号索引，0 位不使用

  // ---------- state ----------
  var gameState = 'menu'; // menu | playing | paused | won
  var size = 4;
  var tiles = [];    // 每格数字，0 = 空格
  var emptyIdx = 0;
  var moves = 0, elapsed = 0, started = false, timerId = null;
  var showAnswer = false, freezeTimer = false;

  /* 修改器状态（见文件末尾 CheatKit.init） */

  function bestStepsKey(n) { return 'best:sliding-puzzle:' + n + ':steps'; }
  function bestTimeKey(n) { return 'best:sliding-puzzle:' + n + ':time'; }

  function fmtBest(v) { return v == null ? '--' : String(v); }

  // ---------- board ----------
  function buildBoard() {
    var n = size, total = n * n, i;
    boardEl.style.setProperty('--n', String(n));

    // 背景格（含答案提示数字）
    cellsEl.innerHTML = '';
    for (i = 0; i < total; i++) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      if (i < total - 1) {
        var ghost = document.createElement('span');
        ghost.className = 'ghost';
        ghost.textContent = String(i + 1);
        cell.appendChild(ghost);
      }
      cellsEl.appendChild(cell);
    }

    // 方块
    var old = boardEl.querySelectorAll('.tile');
    for (i = 0; i < old.length; i++) boardEl.removeChild(old[i]);
    tileEls = [];
    for (i = 1; i < total; i++) {
      var tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('data-value', String(i));
      var face = document.createElement('div');
      face.className = 'tile-face';
      face.textContent = String(i);
      tile.appendChild(face);
      boardEl.appendChild(tile);
      tileEls[i] = tile;
    }
  }

  function solvedTiles() {
    var arr = [], i;
    for (i = 1; i < size * size; i++) arr.push(i);
    arr.push(0);
    return arr;
  }

  function adjacent(idx) {
    var n = size, list = [], r = Math.floor(idx / n), c = idx % n;
    if (r > 0) list.push(idx - n);
    if (r < n - 1) list.push(idx + n);
    if (c > 0) list.push(idx - 1);
    if (c < n - 1) list.push(idx + 1);
    return list;
  }

  function swap(a, b) {
    var tmp = tiles[a]; tiles[a] = tiles[b]; tiles[b] = tmp;
  }

  function isSolved() {
    for (var i = 0; i < tiles.length - 1; i++) if (tiles[i] !== i + 1) return false;
    return tiles[tiles.length - 1] === 0;
  }

  function homeCount() {
    var n = 0;
    for (var i = 0; i < tiles.length - 1; i++) if (tiles[i] === i + 1) n++;
    return n;
  }

  // 在当前局面随机走 steps 次合法移动（可解性不变，且不走回头路）
  function randomWalk(steps) {
    var prev = -1, s, i;
    for (s = 0; s < steps; s++) {
      var opts = adjacent(emptyIdx), pick = [];
      for (i = 0; i < opts.length; i++) if (opts[i] !== prev) pick.push(opts[i]);
      if (!pick.length) pick = opts;
      var idx = pick[Math.floor(Math.random() * pick.length)];
      prev = emptyIdx;
      swap(idx, emptyIdx);
      emptyIdx = idx;
    }
  }

  // 保证可解的洗牌：从完成态做 N²×30 次随机合法移动
  function shuffleFromSolved() {
    tiles = solvedTiles();
    emptyIdx = tiles.length - 1;
    randomWalk(size * size * SHUFFLE_FACTOR);
    if (isSolved()) {
      var opts = adjacent(emptyIdx);
      swap(opts[0], emptyIdx);
      emptyIdx = opts[0];
    }
  }

  function render() {
    var n = size, i, v, el, near;
    for (i = 0; i < tiles.length; i++) {
      v = tiles[i];
      if (!v) { emptyIdx = i; continue; }
      el = tileEls[v];
      el.style.transform = 'translate(' + (i % n) * 100 + '%,' + Math.floor(i / n) * 100 + '%)';
      el.classList.toggle('is-home', v === i + 1);
    }
    near = adjacent(emptyIdx);
    for (i = 0; i < tiles.length; i++) {
      v = tiles[i];
      if (!v) continue;
      tileEls[v].classList.toggle('movable', near.indexOf(i) !== -1);
    }
    boardEl.classList.toggle('answer-on', !!showAnswer);
    updateAnim();
  }

  function updateAnim() {
    boardEl.classList.toggle('no-anim', !!GamePlatform.ui.shouldReduceMotion());
  }

  // ---------- moves ----------
  function tryMove(idx) {
    if (gameState !== 'playing') return;
    if (idx < 0 || idx >= tiles.length || tiles[idx] === 0) return;
    if (adjacent(emptyIdx).indexOf(idx) === -1) return;
    swap(idx, emptyIdx);
    emptyIdx = idx;
    moves++;
    if (!started) { started = true; startTimer(); }
    SLP.audio.play('move');
    render();
    updateHUD();
    checkWin();
  }

  // 方向键：方向即方块滑动方向
  function moveByDir(dir) {
    var n = size, r = Math.floor(emptyIdx / n), c = emptyIdx % n, idx = -1;
    if (dir === 'left' && c < n - 1) idx = emptyIdx + 1;
    else if (dir === 'right' && c > 0) idx = emptyIdx - 1;
    else if (dir === 'up' && r < n - 1) idx = emptyIdx + n;
    else if (dir === 'down' && r > 0) idx = emptyIdx - n;
    if (idx >= 0) tryMove(idx);
  }

  // ---------- timer ----------
  function startTimer() {
    stopTimer();
    timerId = setInterval(function () {
      if (gameState !== 'playing' || !started || freezeTimer) return;
      elapsed++;
      updateHUD();
    }, 1000);
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  // ---------- win ----------
  function checkWin() {
    if (gameState !== 'playing' || !isSolved()) return;
    winGame();
  }

  function winGame() {
    gameState = 'won';
    stopTimer();
    SLP.audio.play('win');
    var rec = false;
    var bs = GamePlatform.storage.get(bestStepsKey(size), null);
    if (bs == null || moves < bs) { GamePlatform.storage.set(bestStepsKey(size), moves); rec = true; }
    var bt = GamePlatform.storage.get(bestTimeKey(size), null);
    if (bt == null || elapsed < bt) { GamePlatform.storage.set(bestTimeKey(size), elapsed); rec = true; }
    if (rec) GamePlatform.ui.toast(t('newRecord'));
    document.getElementById('go-moves').textContent = String(moves);
    document.getElementById('go-time').textContent = String(elapsed);
    document.getElementById('go-best-steps').textContent = fmtBest(GamePlatform.storage.get(bestStepsKey(size), null));
    document.getElementById('go-best-time').textContent = fmtBest(GamePlatform.storage.get(bestTimeKey(size), null));
    updateHUD();
    showOverlay('ov-gameover');
  }

  // ---------- game flow ----------
  function newGame(n) {
    size = n;
    buildBoard();
    shuffleFromSolved();
    moves = 0;
    elapsed = 0;
    started = false;
    stopTimer();
    gameState = 'playing';
    hideOverlays();
    SLP.audio.play('start');
    render();
    updateHUD();
  }

  function backToMenu() {
    stopTimer();
    started = false;
    gameState = 'menu';
    renderBests();
    showOverlay('ov-menu');
    updateHUD();
  }

  function togglePause() {
    if (gameState === 'playing') {
      gameState = 'paused';
      showOverlay('ov-pause');
    } else if (gameState === 'paused') {
      gameState = 'playing';
      hideOverlays();
    }
  }

  // ---------- hud / overlays / i18n ----------
  function updateHUD() {
    document.getElementById('hud-size').textContent = size + '×' + size;
    document.getElementById('hud-moves').textContent = String(moves);
    document.getElementById('hud-time').textContent = String(elapsed);
  }

  function renderBests() {
    for (var i = 0; i < SIZES.length; i++) {
      var s = SIZES[i];
      document.getElementById('best-steps-' + s).textContent = fmtBest(GamePlatform.storage.get(bestStepsKey(s), null));
      document.getElementById('best-time-' + s).textContent = fmtBest(GamePlatform.storage.get(bestTimeKey(s), null));
    }
  }

  function showOverlay(id) {
    var ids = ['ov-menu', 'ov-pause', 'ov-gameover'];
    for (var i = 0; i < ids.length; i++) {
      document.getElementById(ids[i]).hidden = ids[i] !== id;
    }
  }
  function hideOverlays() { showOverlay(''); }

  function applyLang() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      if (STR[key]) nodes[i].textContent = t(key);
    }
    document.title = t('title') + ' · Potato4096 Arcade';
    updateHUD();
    renderBests();
  }

  // ---------- input ----------
  function bindInput() {
    boardEl.addEventListener('click', function (e) {
      SLP.audio.unlock();
      var el = e.target && e.target.closest ? e.target.closest('.tile') : null;
      if (!el) return;
      var v = +el.getAttribute('data-value');
      var idx = tiles.indexOf(v);
      if (idx >= 0) tryMove(idx);
    });

    document.addEventListener('keydown', function (e) {
      SLP.audio.unlock();
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
        return;
      }
      if (gameState !== 'playing') return;
      var dir = null;
      if (e.key === 'ArrowLeft') dir = 'left';
      else if (e.key === 'ArrowRight') dir = 'right';
      else if (e.key === 'ArrowUp') dir = 'up';
      else if (e.key === 'ArrowDown') dir = 'down';
      if (!dir) return;
      e.preventDefault();
      moveByDir(dir);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && gameState === 'playing') togglePause();
    });

    document.addEventListener('pointerdown', function () { SLP.audio.unlock(); }, { once: true });

    function goHome() { GamePlatform.navigate.goHome(); }

    for (var i = 0; i < SIZES.length; i++) {
      (function (n) {
        document.getElementById('btn-size-' + n).onclick = function () {
          SLP.audio.unlock();
          SLP.audio.play('click');
          newGame(n);
        };
      })(SIZES[i]);
    }

    document.getElementById('btn-clear').onclick = function () {
      SLP.audio.play('clear');
      for (var j = 0; j < SIZES.length; j++) {
        GamePlatform.storage.remove(bestStepsKey(SIZES[j]));
        GamePlatform.storage.remove(bestTimeKey(SIZES[j]));
      }
      renderBests();
      GamePlatform.ui.toast(t('cleared'));
    };

    document.getElementById('btn-home').onclick = goHome;
    document.getElementById('btn-home-pause').onclick = goHome;
    document.getElementById('btn-home-go').onclick = goHome;

    document.getElementById('btn-pause').onclick = function () {
      SLP.audio.play('click');
      togglePause();
    };
    document.getElementById('btn-resume').onclick = function () {
      SLP.audio.play('click');
      togglePause();
    };
    document.getElementById('btn-restart-pause').onclick = function () {
      SLP.audio.play('lose');
      newGame(size);
    };
    document.getElementById('btn-again-go').onclick = function () {
      SLP.audio.play('click');
      newGame(size);
    };
    document.getElementById('btn-menu-pause').onclick = function () {
      SLP.audio.play('click');
      backToMenu();
    };
    document.getElementById('btn-menu-go').onclick = function () {
      SLP.audio.play('click');
      backToMenu();
    };
    document.getElementById('btn-fullscreen').onclick = function () {
      SLP.audio.play('click');
      if (GamePlatform.ui.isFullscreen()) GamePlatform.ui.exitFullscreen();
      else GamePlatform.ui.requestFullscreen();
    };
  }

  // ---------- boot ----------
  function init() {
    buildBoard();
    tiles = solvedTiles();
    emptyIdx = tiles.length - 1;
    render();
    renderBests();
    applyLang();
    bindInput();
    gameState = 'menu';
    showOverlay('ov-menu');
    updateHUD();
  }

  GamePlatform.ready.then(function () {
    init();
    GamePlatform.settings.onChange(function (settings, changedKeys) {
      if (changedKeys.indexOf('lang') !== -1) applyLang();
      if (changedKeys.indexOf('reduceMotion') !== -1) updateAnim();
    });
    GamePlatform.i18n.onChange(function () { applyLang(); });
  });

  SLP.game = {
    get state() { return gameState; },
    get moves() { return moves; },
    get elapsed() { return elapsed; }
  };

  /* ------------------------------------------------------------ */
  /* 修改器钩子（暗号 potato4096，见 platform/cheat-kit.js）        */
  /* ------------------------------------------------------------ */

  var CHEAT_STATUS = {
    menu: 'statusMenu',
    playing: 'statusPlaying',
    paused: 'statusPaused',
    won: 'statusWon'
  };

  function cheatStatus() { return t(CHEAT_STATUS[gameState] || 'statusMenu'); }

  // 菜单 / 已完成时先开一局，动作再改局面
  function cheatArm() {
    if (gameState === 'menu' || gameState === 'won') newGame(size);
    return true;
  }

  function cheatSolve() {
    if (!cheatArm()) return;
    tiles = solvedTiles();
    emptyIdx = tiles.length - 1;
    render();
    winGame();
  }

  function cheatScramble() {
    if (!cheatArm()) return;
    randomWalk(size * size * SCRAMBLE_FACTOR);
    if (isSolved()) {
      var opts = adjacent(emptyIdx);
      swap(opts[0], emptyIdx);
      emptyIdx = opts[0];
    }
    render();
    updateHUD();
  }

  function cheatOneAway() {
    if (!cheatArm()) return;
    tiles = solvedTiles();
    emptyIdx = tiles.length - 1;
    var opts = adjacent(emptyIdx);
    var pick = opts[Math.floor(Math.random() * opts.length)];
    swap(pick, emptyIdx);
    emptyIdx = pick;
    render();
    updateHUD();
  }

  if (window.CheatKit) {
    CheatKit.init({
      id: 'sliding-puzzle',
      title: { zh: '🔧 修改器', en: '🔧 Modifier' },
      hint: { zh: '彩蛋面板 · 参数即时生效', en: 'Easter egg · changes apply instantly' },
      stats: [
        { label: STR.size, get: function () { return size + '×' + size; } },
        { label: STR.moves, get: function () { return moves; } },
        { label: STR.time, get: function () { return elapsed; } },
        { label: STR.placed, get: homeCount, tone: 'success' },
        { label: STR.progress, get: function () {
            return tiles.length > 1 ? homeCount() / (tiles.length - 1) * 100 : 0;
          }, format: function (v) { return v.toFixed(1) + '%'; } },
        { label: STR.state, get: cheatStatus, tone: 'warning' }
      ],
      params: [
        { key: 'moves', label: STR.moves, min: 0, max: 99999, step: 1,
          get: function () { return moves; },
          set: function (v) { moves = Math.round(v); updateHUD(); } },
        { key: 'time', label: STR.time, min: 0, max: 99999, step: 1,
          get: function () { return elapsed; },
          set: function (v) { elapsed = Math.round(v); updateHUD(); } }
      ],
      toggles: [
        { label: STR.showAnswer, on: STR.showAnswerOn, off: STR.showAnswerOff,
          get: function () { return showAnswer; },
          set: function (v) { showAnswer = !!v; render(); } },
        { label: STR.freezeTimer, on: STR.freezeTimerOn, off: STR.freezeTimerOff,
          get: function () { return freezeTimer; },
          set: function (v) { freezeTimer = !!v; } }
      ],
      actions: [
        { label: STR.cheatSolve, tone: 'danger', run: cheatSolve, toast: STR.toastSolved },
        { label: STR.cheatScramble, run: cheatScramble, toast: STR.toastScrambled },
        { label: STR.cheatOneAway, run: cheatOneAway, toast: STR.toastOneAway },
        { label: STR.cheatRestart, run: function () { newGame(size); } }
      ]
    });
  }
})();
