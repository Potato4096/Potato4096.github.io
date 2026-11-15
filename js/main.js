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

    // 主题面板文案
    document.getElementById('theme-modal-title').textContent = t('theme.title');
    document.getElementById('theme-modal-sub').textContent = t('theme.sub');
    document.getElementById('label-scheme').textContent = t('theme.scheme');
    document.getElementById('lbl-scheme-light').textContent = t('theme.light');
    document.getElementById('lbl-scheme-dark').textContent = t('theme.dark');
    document.getElementById('lbl-scheme-system').textContent = t('theme.system');
    document.getElementById('skin-open-label').textContent = t('theme.open');
    document.getElementById('btn-theme-reset').textContent = t('theme.reset');

    // 主题按钮图标
    var pref = GP.settings.get('theme');
    var themeBtn = document.getElementById('btn-theme');
    themeBtn.textContent = pref === 'dark' ? '🌙' : pref === 'light' ? '☀️' : '🎨';
    themeBtn.title = t('theme.title');

    renderSegmented();
    renderThemeCurrent();
    renderScheme();
    if (!themeModal.hidden) {
      renderThemeCats();
      renderThemeGrid();
    }
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

  /* ========== 主题面板（二级菜单） ========== */

  var themeModal = document.getElementById('theme-modal');
  var themeBackdrop = document.getElementById('theme-backdrop');
  var activeCat = null;

  function openThemeModal() {
    if (!activeCat) activeCat = GP.themePacks.categoryOf(GP.settings.get('skin'));
    closePanel();
    renderThemeCats();
    renderThemeGrid();
    renderScheme();
    themeModal.hidden = false;
    themeBackdrop.hidden = false;
    requestAnimationFrame(function () {
      themeModal.classList.add('open');
      themeBackdrop.classList.add('open');
    });
  }

  function closeThemeModal() {
    themeModal.classList.remove('open');
    themeBackdrop.classList.remove('open');
    setTimeout(function () {
      themeModal.hidden = true;
      themeBackdrop.hidden = true;
    }, 180);
  }

  /** 风格分类标签 */
  function renderThemeCats() {
    var wrap = document.getElementById('theme-cats');
    var cats = GP.themePacks.categories();
    wrap.innerHTML = '';
    var current = null;
    cats.forEach(function (cat) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-cat' + (cat.id === activeCat ? ' active' : '');
      btn.dataset.cat = cat.id;
      btn.setAttribute('role', 'tab');
      btn.textContent = GP.i18n.t(cat.name);
      btn.addEventListener('click', function () {
        activeCat = cat.id;
        renderThemeCats();
        renderThemeGrid();
      });
      wrap.appendChild(btn);
      if (cat.id === activeCat) current = cat;
    });
    document.getElementById('theme-cat-desc').textContent = current ? GP.i18n.t(current.desc) : '';
  }

  /** 当前分类下的配色卡片 */
  function renderThemeGrid() {
    var grid = document.getElementById('theme-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var mode = GP.theme.get();
    var active = GP.settings.get('skin');

    GP.themePacks.byCategory(activeCat).forEach(function (id) {
      var pack = GP.themePacks.get(id);
      var d = pack[mode] || pack.light;
      var name = GP.i18n.t(pack.name || { zh: id, en: id });
      var chip = (d.surface && d.surface !== 'transparent') ? d.surface : d.text;
      var texture = (d.bgTexture && d.bgTexture !== 'none') ? d.bgTexture : 'none';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-card' + (id === active ? ' active' : '');
      btn.title = name;
      btn.dataset.skin = id;
      btn.innerHTML =
        '<span class="theme-preview" style="background-color:' + d.bg +
          ';background-image:' + texture + '">' +
          '<i class="tp-surface" style="background:' + chip + ';border-color:' + d.border + '"></i>' +
          '<i class="tp-accent" style="background:' + d.accent + '"></i>' +
        '</span>' +
        '<span class="theme-card-name">' + escapeHtml(name) + '</span>' +
        '<span class="theme-check" aria-hidden="true">✓</span>';
      btn.addEventListener('click', function () {
        GP.settings.set('skin', id);
      });
      grid.appendChild(btn);
    });
  }

  /** 黑白方案（浅色 / 深色 / 跟随系统） */
  function renderScheme() {
    var pref = GP.settings.get('theme');
    Array.prototype.forEach.call(document.querySelectorAll('#seg-scheme button'), function (btn) {
      btn.classList.toggle('active', btn.dataset.value === pref);
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
    renderThemeCurrent();
  }

  /** 设置面板里显示当前主题名 */
  function renderThemeCurrent() {
    var el = document.getElementById('skin-open-current');
    if (!el) return;
    var pack = GP.themePacks.get(GP.settings.get('skin'));
    var cats = GP.themePacks.categories();
    var catName = '';
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].id === (pack.cat || 'solid')) catName = GP.i18n.t(cats[i].name);
    }
    el.textContent = catName + ' · ' + GP.i18n.t(pack.name || { zh: pack.id, en: pack.id });
  }

  function bindSettingsUI() {
    document.getElementById('btn-settings').addEventListener('click', openPanel);
    document.getElementById('btn-close-panel').addEventListener('click', closePanel);
    backdrop.addEventListener('click', closePanel);
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !panel.hidden) closePanel();
      if (ev.key === 'Escape' && !themeModal.hidden) closeThemeModal();
    });

    // 快捷切换语言
    document.getElementById('btn-lang').addEventListener('click', function () {
      var next = GP.settings.get('lang') === 'zh' ? 'en' : 'zh';
      GP.settings.set('lang', next);
    });

    // 主题入口：右上角图标 + 设置面板按钮，都打开主题二级菜单
    document.getElementById('btn-theme').addEventListener('click', openThemeModal);
    document.getElementById('btn-open-theme').addEventListener('click', openThemeModal);
    document.getElementById('btn-close-theme').addEventListener('click', closeThemeModal);
    themeBackdrop.addEventListener('click', closeThemeModal);

    // 黑白方案
    document.getElementById('seg-scheme').addEventListener('click', function (ev) {
      var btn = ev.target.closest('button');
      if (btn) GP.settings.set('theme', btn.dataset.value);
    });

    // 恢复默认主题（只重置风格与黑白，不动语言等）
    document.getElementById('btn-theme-reset').addEventListener('click', function () {
      GP.settings.set({
        theme: GP.settings.defaults.theme,
        skin: GP.settings.defaults.skin
      });
      activeCat = 'solid';
      GP.ui.toast(t('theme.resetToast'));
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
