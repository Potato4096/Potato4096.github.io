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
    var pref = GP.settings.get('theme');              // light / dark / system
    var isDark = GP.theme.get() === 'dark';
    schemeBtn.textContent = pref === 'system' ? '🖥️' : (isDark ? '🌙' : '☀️');
    schemeBtn.title = t('theme.toggleScheme');
    schemeBtn.setAttribute('aria-label', t('theme.toggleScheme'));
    schemeBtn.dataset.pref = pref;
    schemeBtn.classList.toggle('is-dark', pref === 'dark');
    schemeBtn.classList.toggle('is-system', pref === 'system');

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

  /** 预览窗口里的常见控件：标题栏 + 标题 + 两行正文 + 按钮（带"文字"） */
  function uiKit(c, styleId, dark) {
    var btnBg = styleId === 'line' ? 'transparent' : c.accent;
    var btnBorder = styleId === 'line' ? '2px solid ' + c.accent : '1px solid ' + c.accent;
    var btnShadow = styleId === 'cyber' ? 'box-shadow:0 0 12px ' + c.accentSoft + ';' : '';
    var label = styleId === 'line' ? c.accent : c.bg;
    /* 底是主题背景色，标题栏叠一层微亮/微暗，避免和底色糊成一片 */
    var lift = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.05)';
    var tbar = 'background:' + c.surface2 + ';background-image:linear-gradient(' + lift + ',' + lift + ');' +
      'border-color:' + c.border + ';';
    /* 右侧强调色块：线条方案走描边，其余实心，赛博朋克带辉光 */
    var heroStyle = styleId === 'line'
      ? 'background:transparent;border:2px solid ' + c.accent + ';'
      : 'background:' + c.accent + ';background-image:linear-gradient(135deg, ' + c.accent + ' 0%, ' +
        c.accentHover + ' 100%);border:1px solid ' + c.accent + ';' +
        (styleId === 'cyber' ? 'box-shadow:0 0 14px ' + c.accentSoft + ';' : '');
    return '<i class="ui-tbar" style="' + tbar + '"></i>' +
      '<i class="ui-dots" style="background:' + c.textMuted +
        ';box-shadow:5px 0 0 ' + c.textMuted + ',10px 0 0 ' + c.textMuted + '"></i>' +
      '<i class="ui-h1" style="background:' + c.text + '"></i>' +
      '<i class="ui-p1" style="background:' + c.textMuted + '"></i>' +
      '<i class="ui-p2" style="background:' + c.textMuted + '"></i>' +
      '<i class="ui-btn" style="background:' + btnBg + ';border:' + btnBorder + ';' + btnShadow + '">' +
        '<i class="ui-btn-label" style="background:' + label + '"></i>' +
      '</i>' +
      /* 右侧强调色块：落在对角线的黑色一半里，让黑半也有内容 */
      '<i class="ui-hero" style="' + heroStyle + '"></i>' +
      '<i class="ui-hero-line" style="background:' + c.textMuted + '"></i>';
  }

  /** 迷你窗口预览：底色 + 窗口（按方案呈现填充 / 描边 / 辉光 / 磨砂） */
  function miniPreview(styleId, d) {
    var c = d.colors;
    var wrapStyle = 'background-color:' + c.bg + ';background-image:' + d.bgTexture + ';';
    if (styleId === 'cyber') {
      /* 预览也要看得出在发光：内描边用亮色，再压两层内部辉光 */
      wrapStyle += 'box-shadow:inset 0 0 0 1px ' + c.accent + ',inset 0 0 18px ' + c.accentSoft +
        ',inset 0 0 40px ' + c.accentSoft + ';';
    } else if (styleId === 'glass') {
      wrapStyle += 'box-shadow:inset 0 1px 0 rgba(255,255,255,0.45);';
    }
    var winStyle = 'background:' + c.surface + ';border:' +
      (styleId === 'line' ? '2px solid ' + c.accent : '1px solid ' + c.border) + ';';
    return '<span class="mini mini--' + styleId + '" style="' + wrapStyle + '">' +
      '<i class="mini-win" style="' + winStyle + '">' + uiKit(c, styleId, d.mode === 'dark') + '</i>' +
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
        // 底色用该模式的主题背景色：浅色接近纯白、深色接近纯黑，但仍是配色本身
        var bg = 'background-color:' + c.bg + ';';
        var winBorder = styleId === 'line'
          ? '2px solid ' + c.accent
          : '1px solid ' + (c.border || (white ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)'));
        var win = 'background:' + c.bg + ';border:' + winBorder + ';' +
          (styleId === 'cyber' ? 'box-shadow:inset 0 0 16px ' + c.accentSoft + ';' : '') +
          (styleId === 'glass' ? 'box-shadow:inset 0 1px 0 ' +
            (white ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.20)') + ';' : '');
        return '<span class="pal-half pal-half--' + kind + '" style="' + bg + '">' +
          '<i class="pal-win" style="' + win + '">' + uiKit(c, styleId, !white) + '</i>' +
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
    var pref = GP.settings.get('theme');
    var modeName = GP.theme.get() === 'dark' ? t('theme.dark') : t('theme.light');
    var scheme = pref === 'system' ? t('theme.system') + ' ' + modeName : modeName;
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

    // 黑白是独立按钮：白 → 黑 → 跟随系统 三态循环
    document.getElementById('btn-scheme').addEventListener('click', function () {
      var pref = GP.settings.get('theme');
      var next = pref === 'light' ? 'dark' : (pref === 'dark' ? 'system' : 'light');
      GP.settings.set('theme', next);
      GP.ui.toast(
        next === 'dark' ? t('theme.nowDark') :
        next === 'system' ? t('theme.nowSystem') : t('theme.nowLight')
      );
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
