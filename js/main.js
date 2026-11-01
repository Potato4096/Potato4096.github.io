/**
 * Potato4096 Arcade - 首页主逻辑
 * 职责: 游戏发现(读取 games.json 注册表) → 渲染卡片 → 跳转入口；全局设置面板
 */
(function () {
  'use strict';

  var I18N = window.I18N;
  var GP = window.GamePlatform;

  /* ========== i18n ========== */

  function t(key) {
    var lang = GP.settings.get('lang');
    var dict = I18N[lang] || I18N.zh;
    return dict[key] != null ? dict[key] : (I18N.zh[key] || key);
  }

  function applyI18n() {
    document.getElementById('games-title').textContent = t('games.title');
    document.getElementById('refresh-label').textContent = t('refresh');
    document.getElementById('footer-github').textContent = t('footer.github');
    document.getElementById('footer-notice').textContent = t('footer.notice');
    document.getElementById('panel-title').textContent = t('panel.title');
    document.getElementById('label-lang').textContent = t('label.lang');
    document.getElementById('label-lang-hint').textContent = t('label.lang.hint');
    document.getElementById('label-theme').textContent = t('label.theme');
    document.getElementById('label-theme-hint').textContent = t('label.theme.hint');
    document.getElementById('label-skin').textContent = t('label.skin');
    document.getElementById('label-skin-hint').textContent = t('label.skin.hint');
    document.getElementById('label-motion').textContent = t('label.motion');
    document.getElementById('label-motion-hint').textContent = t('label.motion.hint');
    document.getElementById('label-sound').textContent = t('label.sound');
    document.getElementById('label-sound-hint').textContent = t('label.sound.hint');
    document.getElementById('btn-reset-settings').textContent = t('panel.reset');

    // 主题按钮图标
    var pref = GP.settings.get('theme');
    document.getElementById('btn-theme').textContent =
      pref === 'dark' ? '🌙' : pref === 'light' ? '☀️' : '🖥️';

    renderSegmented();
  }

  /* ========== 游戏发现 ========== */

  var state = {
    games: [] // [{ id, dir, config }]
  };

  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
      return res.json();
    });
  }

  /** 读取 games.json 全局注册表（node scripts/generate-games-json.mjs 生成） */
  function discoverGames() {
    return fetchJson('games.json').then(function (data) {
      var list = (data && data.games) || [];
      return list.map(function (item) {
        return typeof item === 'string' ? { id: item, dir: 'Games/' + item } : item;
      });
    });
  }

  /** 读取每个游戏的 game.json 配置（主程序读取配置文件） */
  function loadGameConfigs(list) {
    var tasks = list.map(function (item) {
      return fetchJson(item.dir + '/game.json').then(function (config) {
        if (config.published === false) {
          console.info('[Arcade] hidden (published:false)', item.id);
          return null;
        }
        return { id: config.id || item.id, dir: item.dir, config: config };
      }).catch(function (err) {
        console.warn('[Arcade] skip', item.id, err);
        return null;
      });
    });
    return Promise.all(tasks).then(function (results) {
      return results.filter(Boolean);
    });
  }

  /* ========== 渲染 ========== */

  function pickLocalized(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    return GP.i18n.t(value);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderGames() {
    var grid = document.getElementById('game-grid');
    grid.innerHTML = '';

    if (!state.games.length) {
      var empty = document.createElement('div');
      empty.className = 'empty-card';
      empty.textContent = t('games.empty');
      grid.appendChild(empty);
      return;
    }

    state.games.forEach(function (game) {
      var cfg = game.config || {};
      var card = document.createElement('article');
      card.className = 'game-card';
      card.tabIndex = 0;

      var iconHtml = cfg.icon
        ? '<img class="card-icon" src="' + game.dir + '/' + cfg.icon + '" alt="">'
        : '<div class="card-icon card-icon--emoji">' + (cfg.emoji || '🎮') + '</div>';

      var tags = (cfg.tags || []).slice(0, 3).map(function (tag) {
        return '<span class="tag">' + escapeHtml(tag) + '</span>';
      }).join('');

      card.innerHTML =
        iconHtml +
        '<h3 class="card-title">' + escapeHtml(pickLocalized(cfg.title) || game.id) + '</h3>' +
        '<p class="card-desc">' + escapeHtml(pickLocalized(cfg.description) || '') + '</p>' +
        '<div class="card-tags">' + tags + '</div>' +
        '<div class="card-foot">' +
          '<span class="card-meta">v' + escapeHtml(cfg.version || '0.0.0') +
          (cfg.players ? ' · ' + escapeHtml(t('card.players')) + ' ' + escapeHtml(String(cfg.players)) : '') +
          '</span>' +
          '<button class="play-btn" type="button">' + escapeHtml(t('card.play')) + '</button>' +
        '</div>';

      var open = function () {
        var entry = cfg.entry || 'index.html';
        location.href = game.dir + '/' + entry;
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(); }
      });

      grid.appendChild(card);
    });
  }

  function loadAndRender() {
    var grid = document.getElementById('game-grid');
    grid.innerHTML = '<div class="loading-card">' + escapeHtml(t('games.loading')) + '</div>';

    discoverGames().then(loadGameConfigs).then(function (games) {
      state.games = games;
      renderGames();
    }).catch(function (err) {
      console.error('[Arcade]', err);
      grid.innerHTML = '<div class="empty-card error">' + escapeHtml(t('games.error')) + '</div>';
    });
  }

  /* ========== 设置面板 ========== */

  var panel = document.getElementById('settings-panel');
  var backdrop = document.getElementById('panel-backdrop');

  function openPanel() {
    panel.hidden = false;
    backdrop.hidden = false;
    requestAnimationFrame(function () {
      panel.classList.add('open');
      backdrop.classList.add('open');
    });
  }

  function closePanel() {
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    setTimeout(function () {
      panel.hidden = true;
      backdrop.hidden = true;
    }, 180);
  }

  function renderSegmented() {
    var lang = GP.settings.get('lang');
    var theme = GP.settings.get('theme');
    Array.prototype.forEach.call(document.querySelectorAll('#seg-lang button'), function (btn) {
      btn.classList.toggle('active', btn.dataset.value === lang);
    });
    Array.prototype.forEach.call(document.querySelectorAll('#seg-theme button'), function (btn) {
      btn.classList.toggle('active', btn.dataset.value === theme);
    });
    document.getElementById('toggle-motion').checked = !!GP.settings.get('reduceMotion');
    document.getElementById('toggle-sound').checked = !!GP.settings.get('sound');
    renderSkinGrid();
  }

  /** 主题外观包选择器 */
  function renderSkinGrid() {
    var grid = document.getElementById('skin-grid');
    if (!grid) return;
    var active = GP.settings.get('skin');
    grid.innerHTML = '';

    GP.themePacks.list().forEach(function (id) {
      var pack = GP.themePacks.get(id);
      var name = GP.i18n.t(pack.name || { zh: id, en: id });
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skin-swatch' + (id === active ? ' active' : '');
      btn.dataset.skin = id;
      btn.title = name;
      btn.innerHTML =
        '<span class="skin-dot" style="background: linear-gradient(135deg, ' +
          pack.light.accent + ' 0 50%, ' + pack.dark.accent + ' 50% 100%)"></span>' +
        '<span class="skin-name">' + escapeHtml(name) + '</span>';
      btn.addEventListener('click', function () {
        GP.settings.set('skin', id);
      });
      grid.appendChild(btn);
    });
  }

  function bindSettingsUI() {
    document.getElementById('btn-settings').addEventListener('click', openPanel);
    document.getElementById('btn-close-panel').addEventListener('click', closePanel);
    backdrop.addEventListener('click', closePanel);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !panel.hidden) closePanel();
    });

    // 快捷切换语言
    document.getElementById('btn-lang').addEventListener('click', function () {
      var next = GP.settings.get('lang') === 'zh' ? 'en' : 'zh';
      GP.settings.set('lang', next);
    });

    // 快捷切换主题: system -> light -> dark -> system
    document.getElementById('btn-theme').addEventListener('click', function () {
      var order = ['system', 'light', 'dark'];
      var cur = GP.settings.get('theme');
      var next = order[(order.indexOf(cur) + 1) % order.length];
      GP.settings.set('theme', next);
    });

    document.getElementById('seg-lang').addEventListener('click', function (ev) {
      var btn = ev.target.closest('button');
      if (btn) GP.settings.set('lang', btn.dataset.value);
    });

    document.getElementById('seg-theme').addEventListener('click', function (ev) {
      var btn = ev.target.closest('button');
      if (btn) GP.settings.set('theme', btn.dataset.value);
    });

    document.getElementById('toggle-motion').addEventListener('change', function (ev) {
      GP.settings.set('reduceMotion', ev.target.checked);
    });

    document.getElementById('toggle-sound').addEventListener('change', function (ev) {
      GP.settings.set('sound', ev.target.checked);
    });

    document.getElementById('btn-reset-settings').addEventListener('click', function () {
      GP.settings.set({
        lang: GP.settings.defaults.lang,
        theme: GP.settings.defaults.theme,
        skin: GP.settings.defaults.skin,
        reduceMotion: GP.settings.defaults.reduceMotion,
        sound: GP.settings.defaults.sound
      });
      GP.ui.toast(t('toast.reset'));
    });

    document.getElementById('btn-refresh').addEventListener('click', loadAndRender);
  }

  /* ========== 启动 ========== */

  GP.ready.then(function () {
    applyI18n();
    bindSettingsUI();
    loadAndRender();

    // 设置变化 -> 刷新文案与卡片（语言切换需要重渲染游戏标题/描述）
    GP.settings.onChange(function (settings, keys) {
      applyI18n();
      if (keys.indexOf('lang') !== -1 && state.games.length) renderGames();
    });
  });
})();
