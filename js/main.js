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
    document.getElementById('label-styles').textContent = t('theme.styles');
    document.getElementById('label-palettes').textContent = t('theme.palettes');
    document.getElementById('skin-open-label').textContent = t('theme.open');
    document.getElementById('btn-theme-reset').textContent = t('theme.reset');

    // 顶部按钮：主题（🎨）+ 黑白（☀️/🌙 独立按钮）
    var themeBtn = document.getElementById('btn-theme');
    themeBtn.title = t('theme.title');
    themeBtn.setAttribute('aria-label', t('theme.title'));

    var schemeBtn = document.getElementById('btn-scheme');
    var isDark = GP.theme.get() === 'dark';
    schemeBtn.textContent = isDark ? '🌙' : '☀️';
    schemeBtn.title = t('theme.toggleScheme');
    schemeBtn.setAttribute('aria-label', t('theme.toggleScheme'));
    schemeBtn.classList.toggle('is-dark', isDark);

    renderSegmented();
    renderThemeCurrent();
    if (!themeModal.hidden) renderThemePanel();
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

  /* ========== 主题面板（上：方案，下：配色） ========== */

  var themeModal = document.getElementById('theme-modal');
  var themeBackdrop = document.getElementById('theme-backdrop');

  function openThemeModal() {
    closePanel();
    renderThemePanel();
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

  /** #rrggbb -> rgba(r, g, b, a) */
  function hexA(hex, a) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return 'rgba(136, 136, 136, ' + a + ')';
    return 'rgba(' + parseInt(h.slice(0, 2), 16) + ', ' + parseInt(h.slice(2, 4), 16) + ', ' +
      parseInt(h.slice(4, 6), 16) + ', ' + a + ')';
  }

  /** 预览窗口里的常见控件：标题栏 + 标题 + 两行正文 + 按钮（带"文字"） */
  function uiKit(c, styleId) {
    var btnBg = styleId === 'line' ? 'transparent' : c.accent;
    var btnBorder = styleId === 'line' ? '2px solid ' + c.accent : '1px solid ' + c.accent;
    var btnShadow = styleId === 'cyber' ? 'box-shadow:0 0 12px ' + c.accentSoft + ';' : '';
    var label = styleId === 'line' ? c.accent : c.bg;
    return '<i class="ui-tbar" style="background:' + c.surface2 + ';border-color:' + c.border + '"></i>' +
      '<i class="ui-dots" style="background:' + c.textMuted +
        ';box-shadow:5px 0 0 ' + c.textMuted + ',10px 0 0 ' + c.textMuted + '"></i>' +
      '<i class="ui-h1" style="background:' + c.text + '"></i>' +
      '<i class="ui-p1" style="background:' + c.textMuted + '"></i>' +
      '<i class="ui-p2" style="background:' + c.textMuted + '"></i>' +
      '<i class="ui-btn" style="background:' + btnBg + ';border:' + btnBorder + ';' + btnShadow + '">' +
        '<i class="ui-btn-label" style="background:' + label + '"></i>' +
      '</i>';
  }

  /** 迷你窗口预览：底色 + 窗口（按方案呈现填充 / 描边 / 辉光 / 磨砂） */
  function miniPreview(styleId, d) {
    var c = d.colors;
    var wrapStyle = 'background-color:' + c.bg + ';background-image:' + d.bgTexture + ';';
    if (styleId === 'cyber') {
      wrapStyle += 'box-shadow:inset 0 0 0 1px ' + c.border + ',inset 0 0 26px ' + c.accentSoft + ';';
    } else if (styleId === 'glass') {
      wrapStyle += 'box-shadow:inset 0 1px 0 rgba(255,255,255,0.45);';
    }
    var winStyle = 'background:' + c.surface + ';border:' +
      (styleId === 'line' ? '2px solid ' + c.accent : '1px solid ' + c.border) + ';';
    return '<span class="mini mini--' + styleId + '" style="' + wrapStyle + '">' +
      '<i class="mini-win" style="' + winStyle + '">' + uiKit(c, styleId) + '</i>' +
      (styleId === 'cyber' ? '<i class="mini-scan"></i>' : '') +
      '</span>';
  }

  /** 面板整体重绘（任何选择变化都会走这里，实现实时预览） */
  function renderThemePanel() {
    renderThemeStyles();
    renderThemePalettes();
  }

  /** 上半部分：4 个固定方案，用当前配色 + 当前黑白渲染预览 */
  function renderThemeStyles() {
    var wrap = document.getElementById('theme-styles');
    if (!wrap) return;
    wrap.innerHTML = '';
    var palId = GP.settings.get('palette');
    var mode = GP.theme.get();
    var active = GP.settings.get('style');

    GP.themePacks.styles().forEach(function (st) {
      var d = GP.themePacks.derive(st.id, palId, mode);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sty-card' + (st.id === active ? ' active' : '');
      btn.dataset.style = st.id;
      btn.title = GP.i18n.t(st.desc);
      btn.setAttribute('aria-label', GP.i18n.t(st.name));
      btn.innerHTML =
        miniPreview(st.id, d) +
        '<span class="sty-name">' + escapeHtml(GP.i18n.t(st.name)) + '</span>' +
        '<span class="theme-check" aria-hidden="true">✓</span>';
      btn.addEventListener('click', function () {
        GP.settings.set('style', st.id);
      });
      wrap.appendChild(btn);
    });
  }

  /** 下半部分：15 套固定配色，每块对角线分割 —— 左上白、右下黑 */
  function renderThemePalettes() {
    var wrap = document.getElementById('theme-palettes');
    if (!wrap) return;
    wrap.innerHTML = '';
    var styleId = GP.settings.get('style');
    var active = GP.settings.get('palette');

    GP.themePacks.palettes().forEach(function (pal) {
      var L = GP.themePacks.derive(styleId, pal.id, 'light');
      var D = GP.themePacks.derive(styleId, pal.id, 'dark');
      var name = GP.i18n.t(pal.name);

      // 两半画同一个窗口（同坐标、同控件），靠对角线裁剪拼成「一整个窗口」；
      // 白方案用浅色 token，黑方案用深色 token
      function half(kind, d) {
        var c = d.colors;
        var white = kind === 'light';
        // 黑白两半用纯白 / 纯黑打底，只叠一层淡强调色光晕，保证一眼分清清白
        var bg = 'background-color:' + (white ? '#ffffff' : '#000000') + ';' +
          'background-image:radial-gradient(130% 95% at 12% 0%, ' +
          hexA(c.accent, white ? 0.20 : 0.30) + ' 0%, rgba(0, 0, 0, 0) 62%);';
        var win = 'background:' + c.surface + ';border:' +
          (styleId === 'line' ? '2px solid ' + c.accent : '1px solid ' + c.border) + ';' +
          (styleId === 'cyber' ? 'box-shadow:inset 0 0 14px ' + c.accentSoft + ';' : '');
        return '<span class="pal-half pal-half--' + kind + '" style="' + bg + '">' +
          '<i class="pal-win" style="' + win + '">' + uiKit(c, styleId) + '</i>' +
        '</span>';
      }

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pal-card' + (pal.id === active ? ' active' : '');
      btn.dataset.palette = pal.id;
      btn.title = name;
      btn.innerHTML =
        '<span class="pal-split">' + half('light', L) + half('dark', D) + '</span>' +
        '<span class="pal-name">' + escapeHtml(name) + '</span>' +
        '<span class="theme-check" aria-hidden="true">✓</span>';
      btn.addEventListener('click', function () {
        GP.settings.set('palette', pal.id);
      });
      wrap.appendChild(btn);
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

  /** 设置面板里显示当前组合：方案 · 配色 · 黑白 */
  function renderThemeCurrent() {
    var el = document.getElementById('skin-open-current');
    if (!el) return;
    var st = GP.themePacks.style(GP.settings.get('style'));
    var pal = GP.themePacks.palette(GP.settings.get('palette'));
    var scheme = GP.theme.get() === 'dark' ? t('theme.dark') : t('theme.light');
    el.textContent = GP.i18n.t(st.name) + ' · ' + GP.i18n.t(pal.name) + ' · ' + scheme;
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

    // 主题入口：右上角图标 + 设置面板按钮，都打开主题面板
    document.getElementById('btn-theme').addEventListener('click', openThemeModal);
    document.getElementById('btn-open-theme').addEventListener('click', openThemeModal);
    document.getElementById('btn-close-theme').addEventListener('click', closeThemeModal);
    themeBackdrop.addEventListener('click', closeThemeModal);

    // 黑白是独立按钮：直接在白 / 黑之间切换
    document.getElementById('btn-scheme').addEventListener('click', function () {
      var next = GP.theme.get() === 'dark' ? 'light' : 'dark';
      GP.settings.set('theme', next);
      GP.ui.toast(next === 'dark' ? t('theme.nowDark') : t('theme.nowLight'));
    });

    // 恢复默认主题（方案 + 配色 + 黑白，不动语言等）
    document.getElementById('btn-theme-reset').addEventListener('click', function () {
      GP.settings.set({
        theme: GP.settings.defaults.theme,
        style: GP.settings.defaults.style,
        palette: GP.settings.defaults.palette
      });
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
        style: GP.settings.defaults.style,
        palette: GP.settings.defaults.palette,
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
