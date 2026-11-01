/* minesweeper - core game: grid, reveal/flag/chord, timer, best times */
(function () {
  'use strict';

  var MS = window.MS = window.MS || {};

  // ---------- constants ----------
  var DIFFS = {
    easy:   { cols: 9,  rows: 9,  mines: 10, cell: 38 },
    medium: { cols: 16, rows: 16, mines: 40, cell: 30 },
    hard:   { cols: 30, rows: 16, mines: 99, cell: 25 }
  };
  var DIFF_ORDER = ['easy', 'medium', 'hard'];

  var MINE_SVG = '<svg class="glyph mine-glyph" viewBox="0 0 24 24" aria-hidden="true">' +
    '<g fill="currentColor">' +
    '<circle cx="12" cy="12" r="6.2"/>' +
    '<rect x="10.9" y="1.2" width="2.2" height="21.6" rx="1.1"/>' +
    '<rect x="1.2" y="10.9" width="21.6" height="2.2" rx="1.1"/>' +
    '<rect x="10.9" y="1.2" width="2.2" height="21.6" rx="1.1" transform="rotate(45 12 12)"/>' +
    '<rect x="1.2" y="10.9" width="21.6" height="2.2" rx="1.1" transform="rotate(45 12 12)"/>' +
    '</g>' +
    '<circle cx="9.4" cy="9.4" r="1.9" fill="#ffffff" opacity="0.85"/></svg>';
  var FLAG_SVG = '<svg class="glyph flag-glyph" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="currentColor" d="M7.5 2.2h1.8v19.6H7.5z"/>' +
    '<path fill="currentColor" d="M9.3 3.2h8.2l-3 3.9 3 3.9H9.3z"/>' +
    '<path fill="currentColor" d="M5 21.8h7v-2H5z"/></svg>';

  // ---------- i18n ----------
  var STR = {
    title: { zh: '扫雷', en: 'Minesweeper' },
    tagline: {
      zh: '翻开所有安全格子，避开地雷。数字代表周围 8 格中的地雷数量。',
      en: 'Reveal every safe cell and avoid the mines. Each number counts mines in the 8 surrounding cells.'
    },
    minesLeft: { zh: '剩余地雷', en: 'Mines' },
    time: { zh: '用时', en: 'Time' },
    difficulty: { zh: '难度', en: 'Difficulty' },
    bestTime: { zh: '最佳', en: 'Best' },
    'diff-easy': { zh: '初级', en: 'Easy' },
    'diff-medium': { zh: '中级', en: 'Medium' },
    'diff-hard': { zh: '高级', en: 'Hard' },
    flagMode: { zh: '插旗模式', en: 'Flag Mode' },
    pauseBtn: { zh: '暂停', en: 'Pause' },
    paused: { zh: '已暂停', en: 'Paused' },
    resume: { zh: '继续游戏', en: 'Resume' },
    restart: { zh: '重新开始', en: 'Restart' },
    again: { zh: '再玩一次', en: 'Play Again' },
    toMenu: { zh: '返回菜单', en: 'Menu' },
    home: { zh: '返回主页', en: 'Home' },
    gameOver: { zh: '踩到雷了', en: 'Boom! Game Over' },
    win: { zh: '排雷成功！', en: 'All Clear!' },
    clearRecords: { zh: '清除记录', en: 'Clear Records' },
    cleared: { zh: '记录已清除', en: 'Records cleared' },
    newRecord: { zh: '新纪录！', en: 'New record!' },
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    controls: {
      zh: '操作：左键翻开格子，右键插旗 / 问号，点击已翻开的数字可快速展开周围；触屏长按插旗，或用顶部"插旗模式"切换。',
      en: 'Controls: left-click to reveal, right-click to flag / question-mark, click revealed numbers to chord open neighbors. Touch: long-press to flag or toggle Flag Mode.'
    }
  };
  function t(k) { return GamePlatform.i18n.t(STR[k] || { zh: k, en: k }); }

  // ---------- dom ----------
  var gridEl = document.getElementById('grid');
  var cells = []; // { mine, revealed, flagged, question, adj, el }
  var cols = 0, rows = 0, mineTotal = 0;
  var diffKey = 'easy';
  // gameState: menu | ready | playing | paused | won | lost
  var gameState = 'menu';
  var started = false;
  var revealedSafe = 0, flagCount = 0;
  var elapsed = 0, timerId = null;
  var flagMode = false;
  var bests = {};

  function bestKey(key) { return 'best-' + key; }

  function fmtTime(sec) {
    if (sec == null) return '--';
    var s = Math.max(0, Math.floor(sec));
    if (s < 1000) return ('00' + s).slice(-3);
    return String(s);
  }

  // ---------- build / reset ----------
  function buildGrid() {
    var d = DIFFS[diffKey];
    cols = d.cols; rows = d.rows; mineTotal = d.mines;
    gridEl.style.setProperty('--cell', d.cell + 'px');
    gridEl.style.gridTemplateColumns = 'repeat(' + cols + ', var(--cell))';
    gridEl.innerHTML = '';
    cells = [];
    for (var i = 0; i < cols * rows; i++) {
      var el = document.createElement('div');
      el.className = 'cell covered';
      el.dataset.idx = String(i);
      gridEl.appendChild(el);
      cells.push({ mine: false, revealed: false, flagged: false, question: false, adj: 0, el: el });
    }
    started = false;
    revealedSafe = 0;
    flagCount = 0;
    elapsed = 0;
    stopTimer();
  }

  function neighbors(idx) {
    var r = Math.floor(idx / cols), c = idx % cols;
    var list = [];
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        var nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) list.push(nr * cols + nc);
      }
    }
    return list;
  }

  function placeMines(safeIdx) {
    var banned = {};
    banned[safeIdx] = true;
    var nb = neighbors(safeIdx);
    for (var b = 0; b < nb.length; b++) banned[nb[b]] = true;

    var pool = [];
    for (var i = 0; i < cells.length; i++) if (!banned[i]) pool.push(i);
    for (var j = pool.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = pool[j]; pool[j] = pool[k]; pool[k] = tmp;
    }
    var count = Math.min(mineTotal, pool.length);
    for (var m = 0; m < count; m++) cells[pool[m]].mine = true;

    for (var q = 0; q < cells.length; q++) {
      if (cells[q].mine) continue;
      var adj = 0;
      var ns = neighbors(q);
      for (var w = 0; w < ns.length; w++) if (cells[ns[w]].mine) adj++;
      cells[q].adj = adj;
    }
  }

  // ---------- reveal ----------
  function revealCell(idx) {
    var c = cells[idx];
    if (c.revealed || c.flagged) return 'skip';
    c.revealed = true;
    c.el.classList.remove('covered', 'question');
    c.el.classList.add('revealed');
    if (c.mine) {
      c.el.innerHTML = MINE_SVG;
      return 'mine';
    }
    revealedSafe++;
    if (c.adj > 0) {
      c.el.textContent = String(c.adj);
      c.el.classList.add('n' + c.adj);
    } else {
      c.el.textContent = '';
    }
    return 'safe';
  }

  function floodReveal(idx) {
    var queue = [idx];
    while (queue.length) {
      var cur = queue.shift();
      var r = revealCell(cur);
      if (r !== 'safe') continue;
      if (cells[cur].adj > 0) continue;
      var ns = neighbors(cur);
      for (var i = 0; i < ns.length; i++) {
        var n = cells[ns[i]];
        if (n.revealed || n.flagged || n.mine) continue;
        if (n.adj === 0) queue.push(ns[i]);
        else revealCell(ns[i]);
      }
    }
  }

  function doReveal(idx) {
    if (gameState !== 'ready' && gameState !== 'playing') return;
    if (!started) {
      placeMines(idx);
      started = true;
      gameState = 'playing';
      startTimer();
    }
    var c = cells[idx];
    if (c.flagged) return;
    if (c.revealed) {
      if (c.adj > 0) doChord(idx);
      return;
    }
    if (c.mine) {
      revealCell(idx);
      lose(idx);
      return;
    }
    MS.audio.play('reveal');
    floodReveal(idx);
    checkWin();
  }

  function doChord(idx) {
    if (gameState !== 'playing') return;
    var c = cells[idx];
    if (!c.revealed || c.adj === 0) return;
    var ns = neighbors(idx);
    var flagged = 0, i;
    for (i = 0; i < ns.length; i++) if (cells[ns[i]].flagged) flagged++;
    if (flagged !== c.adj) return;
    var hitMine = false;
    for (i = 0; i < ns.length; i++) {
      var n = cells[ns[i]];
      if (n.revealed || n.flagged) continue;
      if (n.mine) {
        revealCell(ns[i]);
        hitMine = true;
      } else {
        floodReveal(ns[i]);
      }
    }
    if (hitMine) { lose(-1); return; }
    MS.audio.play('chord');
    checkWin();
  }

  function toggleFlag(idx) {
    if (gameState !== 'ready' && gameState !== 'playing') return;
    var c = cells[idx];
    if (c.revealed) return;
    if (c.flagged) {
      c.flagged = false;
      c.question = true;
      c.el.classList.remove('flagged');
      c.el.classList.add('question');
      c.el.textContent = '?';
      flagCount--;
      MS.audio.play('unflag');
    } else if (c.question) {
      c.question = false;
      c.el.classList.remove('question');
      c.el.textContent = '';
    } else {
      c.flagged = true;
      c.el.classList.add('flagged');
      c.el.innerHTML = FLAG_SVG;
      flagCount++;
      MS.audio.play('flag');
    }
    updateHUD();
  }

  // ---------- win / lose ----------
  function checkWin() {
    if (gameState === 'won' || gameState === 'lost') return;
    if (revealedSafe >= cells.length - mineTotal) {
      gameState = 'won';
      stopTimer();
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        if (c.mine && !c.flagged) {
          c.flagged = true;
          c.el.classList.add('flagged');
          c.el.innerHTML = FLAG_SVG;
          flagCount++;
        }
      }
      MS.audio.play('win');
      var isNew = saveBest();
      if (isNew) GamePlatform.ui.toast(t('newRecord'));
      document.getElementById('win-time').textContent = fmtTime(elapsed);
      document.getElementById('win-best').textContent = fmtTime(bests[diffKey]);
      updateHUD();
      showOverlay('ov-win');
    }
  }

  function lose(idx) {
    gameState = 'lost';
    stopTimer();
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (c.mine && !c.flagged) {
        c.revealed = true;
        c.el.classList.remove('covered', 'question');
        c.el.classList.add('revealed');
        c.el.innerHTML = MINE_SVG;
      } else if (!c.mine && c.flagged) {
        c.el.classList.add('wrong');
      }
      if (idx >= 0 && i === idx) c.el.classList.add('exploded');
    }
    MS.audio.play('boom');
    document.getElementById('go-time').textContent = fmtTime(elapsed);
    document.getElementById('go-best').textContent = fmtTime(bests[diffKey]);
    updateHUD();
    showOverlay('ov-gameover');
  }

  function saveBest() {
    var prev = GamePlatform.storage.get(bestKey(diffKey), null);
    if (prev == null || elapsed < prev) {
      GamePlatform.storage.set(bestKey(diffKey), elapsed);
      bests[diffKey] = elapsed;
      return true;
    }
    return false;
  }

  // ---------- timer ----------
  function startTimer() {
    stopTimer();
    timerId = setInterval(function () {
      if (gameState !== 'playing') return;
      elapsed++;
      updateHUD();
    }, 1000);
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  // ---------- hud / overlays ----------
  function updateHUD() {
    document.getElementById('hud-mines').textContent = String(mineTotal - flagCount);
    document.getElementById('hud-time').textContent = fmtTime(elapsed);
    document.getElementById('hud-diff').textContent = t('diff-' + diffKey);
  }

  function renderBests() {
    for (var i = 0; i < DIFF_ORDER.length; i++) {
      var k = DIFF_ORDER[i];
      var v = GamePlatform.storage.get(bestKey(k), null);
      bests[k] = v;
      document.getElementById('best-' + k).textContent = fmtTime(v);
    }
  }

  function showOverlay(id) {
    var ids = ['ov-menu', 'ov-pause', 'ov-gameover', 'ov-win'];
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
    updateHUD();
    renderBests();
  }

  // ---------- game flow ----------
  function newGame(key) {
    diffKey = key;
    buildGrid();
    gameState = 'ready';
    hideOverlays();
    MS.audio.play('start');
    updateHUD();
    renderBests();
  }

  function backToMenu() {
    stopTimer();
    gameState = 'menu';
    renderBests();
    showOverlay('ov-menu');
    updateHUD();
  }

  function togglePause() {
    if (gameState === 'paused') {
      hideOverlays();
      gameState = started ? 'playing' : 'ready';
      if (started) startTimer();
      return;
    }
    if (gameState !== 'playing' && gameState !== 'ready') return;
    var wasStarted = started;
    gameState = 'paused';
    stopTimer();
    showOverlay('ov-pause');
    started = wasStarted;
  }

  function setFlagMode(on) {
    flagMode = on;
    document.getElementById('btn-flag').classList.toggle('is-on', on);
  }

  // ---------- input ----------
  function idxOf(target) {
    var el = target && target.closest ? target.closest('.cell') : target;
    if (!el || !el.dataset || el.dataset.idx == null) return -1;
    return +el.dataset.idx;
  }

  function bindInput() {
    var pressTimer = null, pressIdx = -1, longFired = false;

    gridEl.addEventListener('click', function (e) {
      MS.audio.unlock();
      var idx = idxOf(e.target);
      if (idx < 0) return;
      if (longFired) { longFired = false; return; }
      if (flagMode) { toggleFlag(idx); return; }
      doReveal(idx);
    });

    gridEl.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      MS.audio.unlock();
      var idx = idxOf(e.target);
      if (idx >= 0) toggleFlag(idx);
    });

    gridEl.addEventListener('mousedown', function (e) {
      if (e.button === 1) {
        e.preventDefault();
        var idx = idxOf(e.target);
        if (idx >= 0) doChord(idx);
      }
    });

    gridEl.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      var idx = idxOf(e.target);
      if (idx < 0) return;
      pressIdx = idx;
      longFired = false;
      pressTimer = setTimeout(function () {
        longFired = true;
        toggleFlag(pressIdx);
      }, 450);
    });
    gridEl.addEventListener('pointerup', function () {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    });
    gridEl.addEventListener('pointermove', function () {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    });
    gridEl.addEventListener('pointercancel', function () {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && gameState === 'playing') togglePause();
    });

    document.addEventListener('pointerdown', function () { MS.audio.unlock(); }, { once: true });

    for (var i = 0; i < DIFF_ORDER.length; i++) {
      (function (key) {
        document.getElementById('btn-' + key).onclick = function () {
          MS.audio.unlock();
          newGame(key);
        };
      })(DIFF_ORDER[i]);
    }

    document.getElementById('btn-home').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-pause').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-go').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-win').onclick = function () { GamePlatform.navigate.goHome(); };

    document.getElementById('btn-flag').onclick = function () {
      MS.audio.unlock();
      setFlagMode(!flagMode);
    };
    document.getElementById('btn-pause').onclick = togglePause;
    document.getElementById('btn-resume').onclick = togglePause;

    document.getElementById('btn-restart-pause').onclick = function () { newGame(diffKey); };
    document.getElementById('btn-again-go').onclick = function () { newGame(diffKey); };
    document.getElementById('btn-again-win').onclick = function () { newGame(diffKey); };

    document.getElementById('btn-menu-pause').onclick = backToMenu;
    document.getElementById('btn-menu-go').onclick = backToMenu;
    document.getElementById('btn-menu-win').onclick = backToMenu;

    document.getElementById('btn-clear').onclick = function () {
      GamePlatform.storage.clear();
      renderBests();
      GamePlatform.ui.toast(t('cleared'));
    };

    document.getElementById('btn-fullscreen').onclick = function () {
      if (GamePlatform.ui.isFullscreen()) GamePlatform.ui.exitFullscreen();
      else GamePlatform.ui.requestFullscreen();
    };
  }

  // ---------- boot ----------
  function init() {
    buildGrid();
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
    });
    GamePlatform.i18n.onChange(function () { applyLang(); });
  });

  MS.game = {
    get state() { return gameState; },
    get elapsed() { return elapsed; },
    get flags() { return flagCount; }
  };
})();
