/**
 * main.js - 大厅、路由与棋种装载
 *
 * 路由格式：
 *   #/                    大厅
 *   #/gomoku/pvp          双人对弈
 *   #/go/ai/hard          人机（难度 easy|medium|hard）
 *
 * 每个棋种是一个独立模块（games/<id>/js/view.js），进入时才加载，
 * 返回大厅即卸载并释放监听，四个棋种互不干扰。
 */
(function (global) {
  'use strict';

  var BG = global.BG;
  var i18n = BG.i18n;

  var lobby = document.getElementById('lobby');
  var stage = document.getElementById('stage');
  var listEl = document.getElementById('game-list');
  var recentEl = document.getElementById('recent');
  var langEl = document.getElementById('lobby-lang');

  var currentId = null;
  var currentModule = null;
  var token = 0;

  BG.games = {};

  /** 棋种在 view.js 里调用，向合集登记自己 */
  BG.registerGame = function (id, mod) {
    BG.games[id] = mod;
  };

  function t(key, map) { return i18n.t(key, map); }
  function tx(map) { return i18n.text(map); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ------------------------------------------------------------ */
  /* 大厅                                                          */
  /* ------------------------------------------------------------ */

  function modePanel(g) {
    var diffs = ['easy', 'medium', 'hard'];
    var diffLabel = { easy: 'diffEasy', medium: 'diffMedium', hard: 'diffHard' };
    return '' +
      '<div class="bg-mode-panel-inner">' +
      '  <button type="button" class="bg-mode-btn bg-mode-btn--human" data-mode="pvp">' +
      '    <b>' + esc(t('vsHuman')) + '</b>' +
      '    <small>' + esc(t('vsHumanSub')) + '</small>' +
      '  </button>' +
      '  <div class="bg-mode-ai">' +
      '    <div class="bg-mode-ai-head"><b>' + esc(t('vsAi')) + '</b>' +
      '      <small>' + esc(tx(g.aiSide)) + '</small></div>' +
      '    <div class="bg-diff-row">' +
      diffs.map(function (d) {
        return '<button type="button" class="bg-diff-btn" data-mode="ai" data-diff="' + d + '">' +
          esc(t(diffLabel[d])) + '</button>';
      }).join('') +
      '    </div>' +
      '  </div>' +
      '</div>';
  }

  function renderLobby() {
    i18n.applyText(lobby);
    langEl.textContent = i18n.lang() === 'en' ? 'EN' : '中文';
    document.title = t('hubTitle') + ' · Potato4096 Arcade';

    listEl.innerHTML = BG.catalog.map(function (g) {
      return '' +
        '<div class="bg-game-item" data-id="' + g.id + '">' +
        '  <button type="button" class="bg-game-card" aria-expanded="false">' +
        '    <img class="bg-game-icon" src="' + g.icon + '" alt="" width="72" height="72">' +
        '    <span class="bg-game-body">' +
        '      <span class="bg-game-name">' + esc(tx(g.title)) + '</span>' +
        '      <span class="bg-game-desc">' + esc(tx(g.desc)) + '</span>' +
        '      <span class="bg-game-tags">' +
        '        <i>' + esc(tx(g.spec)) + '</i>' +
        g.tags.map(function (tag) { return '<i>' + esc(tx(tag)) + '</i>'; }).join('') +
        '      </span>' +
        '    </span>' +
        '    <span class="bg-game-chevron" aria-hidden="true">›</span>' +
        '  </button>' +
        '  <div class="bg-mode-panel" hidden>' + modePanel(g) + '</div>' +
        '</div>';
    }).join('');

    renderRecent();
  }

  function renderRecent() {
    var last = BG.store.lastPlayed();
    var game = last && BG.findGame(last.id);
    if (!game) {
      recentEl.hidden = true;
      recentEl.innerHTML = '';
      return;
    }
    var modeText = last.mode === 'ai'
      ? t('modeAiFull', {
        diff: t(last.difficulty === 'easy' ? 'diffEasy' : last.difficulty === 'hard' ? 'diffHard' : 'diffMedium')
      })
      : t('modePvp');
    recentEl.hidden = false;
    recentEl.innerHTML = '<span class="bg-recent-label">' +
      esc(i18n.lang() === 'en' ? 'Last played' : '上次对局') + '</span>' +
      '<button type="button" class="bg-recent-btn" data-resume="' + last.id + '" data-mode="' + last.mode +
      '" data-diff="' + (last.difficulty || '') + '">' +
      '<b>' + esc(tx(game.title)) + '</b> · ' + esc(modeText) + ' ›</button>';
  }

  function closeAllCards(except) {
    var items = listEl.querySelectorAll('.bg-game-item');
    for (var i = 0; i < items.length; i++) {
      if (items[i] === except) continue;
      items[i].classList.remove('is-open');
      var p = items[i].querySelector('.bg-mode-panel');
      if (p) p.hidden = true;
      var c = items[i].querySelector('.bg-game-card');
      if (c) c.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleCard(item) {
    var panel = item.querySelector('.bg-mode-panel');
    var card = item.querySelector('.bg-game-card');
    var open = !item.classList.contains('is-open');
    closeAllCards(item);
    item.classList.toggle('is-open', open);
    panel.hidden = !open;
    card.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      BG.sfx.select();
      // 展开后把整张卡滚进视口，手机上不必手动找
      setTimeout(function () {
        var r = item.getBoundingClientRect();
        if (r.bottom > window.innerHeight || r.top < 0) {
          item.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 60);
    }
  }

  function onLobbyClick(e) {
    var modeBtn = e.target.closest('[data-mode]');
    if (modeBtn) {
      var holder = modeBtn.closest('[data-id]') || modeBtn.closest('[data-resume]');
      var id = (holder && holder.dataset.id) || modeBtn.dataset.resume;
      var mode = modeBtn.dataset.mode;
      if (id && mode) {
        BG.sfx.click();
        location.hash = hashFor(id, mode, modeBtn.dataset.diff);
      }
      return;
    }
    var card = e.target.closest('.bg-game-card');
    if (card) {
      toggleCard(card.closest('.bg-game-item'));
    }
  }

  /* ------------------------------------------------------------ */
  /* 路由                                                          */
  /* ------------------------------------------------------------ */

  function hashFor(id, mode, diff) {
    return '#/' + id + '/' + mode + (mode === 'ai' ? '/' + (diff || 'medium') : '');
  }

  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return null;
    var parts = raw.split('/');
    var id = parts[0];
    if (!BG.findGame(id)) return null;
    var mode = parts[1] === 'ai' ? 'ai' : 'pvp';
    var diff = parts[2];
    if (['easy', 'medium', 'hard'].indexOf(diff) < 0) diff = 'medium';
    return { id: id, mode: mode, difficulty: diff };
  }

  function goLobby() {
    if (location.hash === '#/' || location.hash === '') {
      leaveGame();
      showLobby();
    } else {
      location.hash = '#/';
    }
  }

  BG.goLobby = goLobby;

  function showLobby() {
    lobby.hidden = false;
    stage.hidden = true;
    renderLobby();
  }

  function hideLobby() {
    lobby.hidden = true;
    stage.hidden = false;
    window.scrollTo(0, 0);
  }

  /* ------------------------------------------------------------ */
  /* 棋种装载                                                      */
  /* ------------------------------------------------------------ */

  var scriptCache = {};

  function loadScript(src) {
    if (scriptCache[src]) return scriptCache[src];
    scriptCache[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('脚本加载失败：' + src)); };
      document.head.appendChild(s);
    });
    return scriptCache[src];
  }

  function loadGame(id) {
    var base = 'games/' + id + '/js/';
    var files = ['rules.js', 'ai.js', 'view.js'];
    return files.reduce(function (p, f) {
      return p.then(function () { return loadScript(base + f); });
    }, Promise.resolve());
  }

  function enterGame(route) {
    var myToken = ++token;
    hideLobby();
    stage.innerHTML = '<div class="bg-loading"><span></span></div>';

    loadGame(route.id).then(function () {
      if (myToken !== token) return;
      var mod = BG.games[route.id];
      if (!mod || typeof mod.mount !== 'function') {
        throw new Error('棋种模块未注册：' + route.id);
      }
      currentId = route.id;
      currentModule = mod;
      mod.mount(stage, {
        mode: route.mode,
        difficulty: route.difficulty,
        exit: goLobby,
        goLobby: goLobby
      });
      BG.store.markPlayed(route.id, route.mode, route.difficulty);
    }).catch(function (err) {
      if (myToken !== token) return;
      console.error('[board-games]', err);
      stage.innerHTML = '<div class="bg-error pg-card">' +
        '<h2>加载失败</h2>' +
        '<p>' + esc(err && err.message ? err.message : String(err)) + '</p>' +
        '<button type="button" class="pg-btn" id="err-back">返回大厅</button>' +
        '</div>';
      var btn = document.getElementById('err-back');
      if (btn) btn.addEventListener('click', goLobby);
    });
  }

  function leaveGame() {
    token++;
    if (currentModule && typeof currentModule.unmount === 'function') {
      try {
        currentModule.unmount();
      } catch (e) {
        console.warn('[board-games] unmount failed', e);
      }
    }
    currentModule = null;
    currentId = null;
    stage.innerHTML = '';
  }

  function syncRoute() {
    var route = parseHash();
    if (!route) {
      leaveGame();
      showLobby();
      return;
    }
    enterGame(route);
  }

  /* ------------------------------------------------------------ */
  /* 启动                                                          */
  /* ------------------------------------------------------------ */

  listEl.addEventListener('click', onLobbyClick);
  recentEl.addEventListener('click', onLobbyClick);
  window.addEventListener('hashchange', syncRoute);

  if (global.GamePlatform) {
    GamePlatform.i18n.onChange(function () {
      if (!lobby.hidden) renderLobby();
    });
  }

  // 键盘：Esc 关闭展开的模式面板
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !lobby.hidden) closeAllCards(null);
  });

  syncRoute();
})(window);
