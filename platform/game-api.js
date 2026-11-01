/**
 * Potato4096 Arcade - Universal Game Framework
 * ---------------------------------------------------------------
 * 游戏通用框架 / GamePlatform API
 * Version: 1.0.0
 *
 * 用法 (Usage):
 *   <script src="../../platform/game-api.js"></script>
 *   <link rel="stylesheet" href="../../platform/game-base.css">
 *   <script>
 *     GamePlatform.ready.then(function () {
 *       // 读取全局设置 / 读写存档 / 监听主题变化 ...
 *     });
 *   </script>
 *
 * 约定:
 *   - 所有全局设置存于 localStorage["p4096:settings"]，跨页面、跨标签页同步
 *   - 游戏存档存于 localStorage["p4096:game:<gameId>:<key>"]，按游戏隔离
 *   - 主题/语言变化会自动应用到 <html data-theme> / <html lang>，并触发 onChange
 */
(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  var SETTINGS_KEY = 'p4096:settings';
  var STORAGE_PREFIX = 'p4096:game:';
  var CHANNEL_NAME = 'p4096-platform';

  var DEFAULT_SETTINGS = {
    lang: 'zh',            // 'zh' | 'en'
    theme: 'system',       // 'light' | 'dark' | 'system'  —— 深浅模式
    skin: 'default',       // 主题外观包 id —— 每个包内含深浅两套配色/纹理
    reduceMotion: false,   // 减少动画
    sound: true            // 全局音效开关
  };

  /* ---------------------------------------------------------- */
  /* 工具函数                                                    */
  /* ---------------------------------------------------------- */

  function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

  function safeParse(raw, fallback) {
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------------------------------------------------------- */
  /* gameId 推断：从路径 Games/<id>/ 提取                         */
  /* ---------------------------------------------------------- */

  function detectGameId() {
    var m = (global.location && location.pathname || '').match(/\/Games\/([^/]+)\//);
    return m ? decodeURIComponent(m[1]) : null;
  }

  /* ---------------------------------------------------------- */
  /* 设置存储 (localStorage + 跨标签页同步)                        */
  /* ---------------------------------------------------------- */

  var settingsListeners = [];
  var themeListeners = [];
  var skinListeners = [];
  var langListeners = [];
  var channel = null;

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
    }
  } catch (e) { channel = null; }

  function readSettings() {
    var stored = safeParse(localStorage.getItem(SETTINGS_KEY), {});
    if (!isObject(stored)) stored = {};
    var out = {};
    for (var k in DEFAULT_SETTINGS) {
      out[k] = (k in stored) ? stored[k] : DEFAULT_SETTINGS[k];
    }
    return out;
  }

  function writeSettings(patch, source) {
    var next = readSettings();
    var changed = [];
    for (var k in patch) {
      if (!(k in DEFAULT_SETTINGS)) continue;
      if (next[k] !== patch[k]) {
        next[k] = patch[k];
        changed.push(k);
      }
    }
    if (!changed.length) return;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (e) { /* quota */ }
    broadcast({ type: 'settings', keys: changed, source: source || 'self' });
    notifySettings(changed, source || 'self');
  }

  function broadcast(msg) {
    if (!channel) return;
    try { channel.postMessage(msg); } catch (e) { /* ignore */ }
  }

  function notifySettings(keys, source) {
    var s = readSettings();
    settingsListeners.forEach(function (fn) {
      try { fn(s, keys, source); } catch (e) { console.error('[GamePlatform]', e); }
    });
    if (keys.indexOf('theme') !== -1 || keys.indexOf('skin') !== -1) {
      themeListeners.forEach(function (fn) {
        try { fn(resolveTheme(s.theme), s.theme); } catch (e) { console.error('[GamePlatform]', e); }
      });
    }
    if (keys.indexOf('skin') !== -1) {
      skinListeners.forEach(function (fn) {
        try { fn(themePacks.getActive()); } catch (e) { console.error('[GamePlatform]', e); }
      });
    }
    if (keys.indexOf('lang') !== -1) {
      langListeners.forEach(function (fn) {
        try { fn(s.lang); } catch (e) { console.error('[GamePlatform]', e); }
      });
    }
    applyDocumentMeta();
  }

  /* ---------------------------------------------------------- */
  /* 主题外观包 (skin packs)                                     */
  /* 每个包含 light/dark 两套配色与纹理，与深浅模式正交            */
  /* ---------------------------------------------------------- */

  var THEME_PACKS = {
    'default': {
      id: 'default',
      name: { zh: '默认', en: 'Default' },
      light: {
        bg: '#f6f7fb',
        bgTexture: 'linear-gradient(160deg, #eef1ff 0%, #f6f7fb 45%, #fdf7ee 100%)',
        surface: '#ffffff', surface2: '#eef0f6',
        text: '#1c2333', textMuted: '#5b6474', border: '#d9dee8',
        accent: '#4f6df5', accentHover: '#3d59e0', accentSoft: 'rgba(79, 109, 245, 0.12)',
        accentTexture: 'linear-gradient(135deg, #4f6df5 0%, #7c5cf0 100%)',
        success: '#22a06b', warning: '#e2a03f', danger: '#e5484d'
      },
      dark: {
        bg: '#0f1219',
        bgTexture: 'linear-gradient(160deg, #171c2a 0%, #0f1219 50%, #1a1420 100%)',
        surface: '#1a202d', surface2: '#242c3c',
        text: '#e9edf5', textMuted: '#98a2b3', border: '#2e3748',
        accent: '#7c93ff', accentHover: '#93a6ff', accentSoft: 'rgba(124, 147, 255, 0.16)',
        accentTexture: 'linear-gradient(135deg, #7c93ff 0%, #a58bff 100%)',
        success: '#2eae78', warning: '#e2a03f', danger: '#e56a63'
      }
    },
    'ocean': {
      id: 'ocean',
      name: { zh: '海洋', en: 'Ocean' },
      light: {
        bg: '#eef6fb',
        bgTexture: 'linear-gradient(160deg, #d9edf7 0%, #eef6fb 40%, #e7f6f2 100%)',
        surface: '#ffffff', surface2: '#e2f0f8',
        text: '#0f2e40', textMuted: '#4c6f85', border: '#c2dcea',
        accent: '#0e9bc9', accentHover: '#0b86ad', accentSoft: 'rgba(14, 155, 201, 0.14)',
        accentTexture: 'linear-gradient(135deg, #0e9bc9 0%, #43c4e0 100%)',
        success: '#1a9e6f', warning: '#d9932e', danger: '#d8524f'
      },
      dark: {
        bg: '#0a1520',
        bgTexture: 'linear-gradient(160deg, #0d2130 0%, #0a1520 55%, #0c2622 100%)',
        surface: '#12222f', surface2: '#1b3040',
        text: '#e4f1f8', textMuted: '#8fb0c2', border: '#274456',
        accent: '#3ec0e4', accentHover: '#63d0ec', accentSoft: 'rgba(62, 192, 228, 0.16)',
        accentTexture: 'linear-gradient(135deg, #3ec0e4 0%, #5ce0c8 100%)',
        success: '#2fb98a', warning: '#e2a545', danger: '#e56a63'
      }
    },
    'forest': {
      id: 'forest',
      name: { zh: '森林', en: 'Forest' },
      light: {
        bg: '#f0f5ec',
        bgTexture: 'linear-gradient(160deg, #e3efdb 0%, #f0f5ec 45%, #f5f0e2 100%)',
        surface: '#ffffff', surface2: '#e7f0e2',
        text: '#22331f', textMuted: '#5c7254', border: '#cfdcc6',
        accent: '#3f9a4f', accentHover: '#34833f', accentSoft: 'rgba(63, 154, 79, 0.14)',
        accentTexture: 'linear-gradient(135deg, #3f9a4f 0%, #7fbf5c 100%)',
        success: '#2f9e5f', warning: '#d99a34', danger: '#d4544e'
      },
      dark: {
        bg: '#121a12',
        bgTexture: 'linear-gradient(160deg, #172417 0%, #121a12 55%, #1c2410 100%)',
        surface: '#1b261b', surface2: '#243124',
        text: '#e6f0e2', textMuted: '#93a88c', border: '#31422f',
        accent: '#62c274', accentHover: '#7ed18c', accentSoft: 'rgba(98, 194, 116, 0.16)',
        accentTexture: 'linear-gradient(135deg, #62c274 0%, #a5d95c 100%)',
        success: '#4cba6d', warning: '#e0ac4a', danger: '#e06b62'
      }
    },
    'sunset': {
      id: 'sunset',
      name: { zh: '日落', en: 'Sunset' },
      light: {
        bg: '#fdf3ec',
        bgTexture: 'linear-gradient(160deg, #fde6d8 0%, #fdf3ec 45%, #f8e8ef 100%)',
        surface: '#ffffff', surface2: '#f8e8dd',
        text: '#3c2418', textMuted: '#8a6450', border: '#edd4c2',
        accent: '#e8703a', accentHover: '#d15e2c', accentSoft: 'rgba(232, 112, 58, 0.14)',
        accentTexture: 'linear-gradient(135deg, #e8703a 0%, #f0a03c 100%)',
        success: '#2a9d68', warning: '#e0a030', danger: '#d84848'
      },
      dark: {
        bg: '#1c1210',
        bgTexture: 'linear-gradient(160deg, #291713 0%, #1c1210 55%, #261420 100%)',
        surface: '#2a1c18', surface2: '#37241e',
        text: '#f6e9e2', textMuted: '#b89482', border: '#4a322a',
        accent: '#f0854e', accentHover: '#f5a06c', accentSoft: 'rgba(240, 133, 78, 0.16)',
        accentTexture: 'linear-gradient(135deg, #f0854e 0%, #f5b25c 100%)',
        success: '#3fae7a', warning: '#e7b14e', danger: '#e56b62'
      }
    },
    'candy': {
      id: 'candy',
      name: { zh: '糖果', en: 'Candy' },
      light: {
        bg: '#f9f0f8',
        bgTexture: 'linear-gradient(160deg, #f6e4f4 0%, #f9f0f8 45%, #eef0fd 100%)',
        surface: '#ffffff', surface2: '#f4e6f3',
        text: '#3a2340', textMuted: '#7e5a88', border: '#e8d2e8',
        accent: '#c2559c', accentHover: '#ab4688', accentSoft: 'rgba(194, 85, 156, 0.14)',
        accentTexture: 'linear-gradient(135deg, #c2559c 0%, #7b6ef0 100%)',
        success: '#2aa476', warning: '#dd9a35', danger: '#d84f6d'
      },
      dark: {
        bg: '#1a1220',
        bgTexture: 'linear-gradient(160deg, #231530 0%, #1a1220 55%, #241428 100%)',
        surface: '#271b30', surface2: '#33243d',
        text: '#f2e8f5', textMuted: '#ab8fb5', border: '#453250',
        accent: '#e074c0', accentHover: '#ea8fd0', accentSoft: 'rgba(224, 116, 192, 0.16)',
        accentTexture: 'linear-gradient(135deg, #e074c0 0%, #8f8dfa 100%)',
        success: '#37b887', warning: '#e5ac4c', danger: '#e56b86'
      }
    },
    'glass': {
      id: 'glass',
      name: { zh: '液态玻璃', en: 'Liquid Glass' },
      light: {
        bg: '#f2f6ff',
        bgTexture: 'radial-gradient(1200px 800px at 12% -10%, rgba(126, 168, 255, 0.45) 0%, rgba(126, 168, 255, 0) 55%), radial-gradient(900px 700px at 110% 20%, rgba(255, 158, 196, 0.38) 0%, rgba(255, 158, 196, 0) 60%), radial-gradient(800px 600px at 50% 120%, rgba(140, 230, 200, 0.32) 0%, rgba(140, 230, 200, 0) 60%), linear-gradient(180deg, #f2f6ff 0%, #f8faff 100%)',
        surface: 'rgba(255, 255, 255, 0.32)', surface2: 'rgba(255, 255, 255, 0.18)',
        text: '#16202e', textMuted: '#5c6b80', border: 'rgba(255, 255, 255, 0.45)',
        accent: '#0a84ff', accentHover: '#0071e3', accentSoft: 'rgba(10, 132, 255, 0.14)',
        accentTexture: 'linear-gradient(135deg, #0a84ff 0%, #5ac8fa 100%)',
        success: '#248a3d', warning: '#c77500', danger: '#d70015',
        backdropFilter: 'blur(5px) saturate(1.4)'
      },
      dark: {
        bg: '#121b2e',
        bgTexture: 'radial-gradient(1200px 800px at 10% -10%, rgba(64, 120, 255, 0.35) 0%, rgba(64, 120, 255, 0) 55%), radial-gradient(900px 700px at 115% 15%, rgba(160, 90, 255, 0.28) 0%, rgba(160, 90, 255, 0) 60%), radial-gradient(800px 600px at 55% 125%, rgba(40, 190, 180, 0.22) 0%, rgba(40, 190, 180, 0) 60%), linear-gradient(180deg, #121b2e 0%, #16203a 100%)',
        surface: 'rgba(28, 34, 48, 0.35)', surface2: 'rgba(255, 255, 255, 0.07)',
        text: '#eef2f8', textMuted: '#93a1b5', border: 'rgba(255, 255, 255, 0.12)',
        accent: '#64b5ff', accentHover: '#8ac8ff', accentSoft: 'rgba(100, 181, 255, 0.18)',
        accentTexture: 'linear-gradient(135deg, #4aa8ff 0%, #7d8cff 100%)',
        success: '#30d158', warning: '#e6a700', danger: '#ff6961',
        backdropFilter: 'blur(5px) saturate(1.4)'
      }
    },
    'mono': {
      id: 'mono',
      name: { zh: '极简', en: 'Mono' },
      light: {
        bg: '#f2f2f2',
        bgTexture: 'none',
        surface: '#ffffff', surface2: '#e8e8e8',
        text: '#1a1a1a', textMuted: '#666666', border: '#d4d4d4',
        accent: '#333333', accentHover: '#111111', accentSoft: 'rgba(0, 0, 0, 0.08)',
        accentTexture: 'none',
        success: '#2a8a5b', warning: '#b8862a', danger: '#c04040'
      },
      dark: {
        bg: '#141414',
        bgTexture: 'none',
        surface: '#1e1e1e', surface2: '#2a2a2a',
        text: '#f0f0f0', textMuted: '#999999', border: '#3a3a3a',
        accent: '#e8e8e8', accentHover: '#ffffff', accentSoft: 'rgba(255, 255, 255, 0.12)',
        accentTexture: 'none',
        success: '#4cb584', warning: '#cfa13f', danger: '#d06060'
      }
    }
  };

  /** pack 颜色键 -> CSS 自定义属性名 */
  var SKIN_VAR_MAP = {
    bg: '--pg-bg',
    surface: '--pg-surface',
    surface2: '--pg-surface-2',
    text: '--pg-text',
    textMuted: '--pg-text-muted',
    border: '--pg-border',
    accent: '--pg-accent',
    accentHover: '--pg-accent-hover',
    accentSoft: '--pg-accent-soft',
    success: '--pg-success',
    warning: '--pg-warning',
    danger: '--pg-danger'
  };

  function getPack(id) {
    return THEME_PACKS[id] || THEME_PACKS[DEFAULT_SETTINGS.skin];
  }

  /** 把外观包(按当前深浅模式)写入 <html> 的 CSS 变量 */
  function applySkinVars(root, packId, mode) {
    var pack = getPack(packId);
    var d = pack[mode] || pack.light;
    for (var key in SKIN_VAR_MAP) {
      if (d[key] != null) root.style.setProperty(SKIN_VAR_MAP[key], d[key]);
    }
    root.style.setProperty('--pg-bg-image', d.bgTexture || 'none');
    root.style.setProperty('--pg-accent-image', d.accentTexture || 'none');
    root.style.setProperty('--pg-backdrop-filter', d.backdropFilter || 'none');
    if (d.font) root.style.setProperty('--pg-font', d.font);
    root.setAttribute('data-skin', pack.id);
  }

  /* ---------------------------------------------------------- */
  /* 主题                                                        */
  /* ---------------------------------------------------------- */

  var mediaQuery = null;
  try {
    if (global.matchMedia) mediaQuery = global.matchMedia('(prefers-color-scheme: dark)');
  } catch (e) { /* ignore */ }

  function resolveTheme(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return (mediaQuery && mediaQuery.matches) ? 'dark' : 'light';
  }

  function applyDocumentMeta() {
    if (!global.document) return;
    var s = readSettings();
    var resolved = resolveTheme(s.theme);
    var root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-pref', s.theme);
    root.setAttribute('data-lang', s.lang);
    if (s.reduceMotion) root.setAttribute('data-reduce-motion', '1');
    else root.removeAttribute('data-reduce-motion');
    if (!root.getAttribute('lang')) root.setAttribute('lang', s.lang === 'en' ? 'en' : 'zh-CN');
    applySkinVars(root, s.skin, resolved);
  }

  if (mediaQuery) {
    var onSystemTheme = function () {
      if (readSettings().theme === 'system') {
        notifySettings(['theme'], 'system');
      }
    };
    if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', onSystemTheme);
    else if (mediaQuery.addListener) mediaQuery.addListener(onSystemTheme);
  }

  // 跨标签页同步
  if (channel) {
    channel.onmessage = function (ev) {
      if (ev.data && ev.data.type === 'settings') {
        notifySettings(ev.data.keys || [], ev.data.source || 'remote');
      }
    };
  }
  global.addEventListener('storage', function (ev) {
    if (ev.key === SETTINGS_KEY) {
      notifySettings(['lang', 'theme', 'reduceMotion', 'sound'], 'storage');
    }
  });

  /* ---------------------------------------------------------- */
  /* 游戏存档 (按 gameId 命名空间隔离)                             */
  /* ---------------------------------------------------------- */

  var gameId = detectGameId();

  function storageKey(key) {
    return STORAGE_PREFIX + (gameId || '_shared') + ':' + key;
  }

  var storage = {
    get: function (key, fallback) {
      var v = safeParse(localStorage.getItem(storageKey(key)), undefined);
      return (v === undefined || v === null) ? fallback : v;
    },
    set: function (key, value) {
      try {
        localStorage.setItem(storageKey(key), JSON.stringify(value));
        return true;
      } catch (e) { console.warn('[GamePlatform] storage.set failed', e); return false; }
    },
    remove: function (key) {
      localStorage.removeItem(storageKey(key));
    },
    clear: function () {
      if (!gameId) return;
      var prefix = STORAGE_PREFIX + gameId + ':';
      var doomed = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) doomed.push(k);
      }
      doomed.forEach(function (k) { localStorage.removeItem(k); });
    },
    keys: function () {
      if (!gameId) return [];
      var prefix = STORAGE_PREFIX + gameId + ':';
      var out = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) out.push(k.slice(prefix.length));
      }
      return out;
    }
  };

  /* ---------------------------------------------------------- */
  /* 事件总线                                                    */
  /* ---------------------------------------------------------- */

  var eventMap = Object.create(null);

  function on(name, fn) {
    if (!eventMap[name]) eventMap[name] = [];
    eventMap[name].push(fn);
    return function () { off(name, fn); };
  }

  function off(name, fn) {
    var list = eventMap[name];
    if (!list) return;
    var i = list.indexOf(fn);
    if (i !== -1) list.splice(i, 1);
  }

  function emit(name, data) {
    var list = eventMap[name];
    if (!list) return;
    list.slice().forEach(function (fn) {
      try { fn(data); } catch (e) { console.error('[GamePlatform] event handler error', e); }
    });
  }

  /* ---------------------------------------------------------- */
  /* i18n 辅助                                                   */
  /* ---------------------------------------------------------- */

  var i18n = {
    getLang: function () { return readSettings().lang; },
    /**
     * t({ zh: '你好', en: 'Hello' }) -> 按当前语言取值，缺失时回退 zh / 首个值
     */
    t: function (map, langOverride) {
      if (map == null) return '';
      if (typeof map === 'string') return map;
      var lang = langOverride || i18n.getLang();
      if (map[lang] != null) return map[lang];
      if (map.zh != null) return map.zh;
      if (map.en != null) return map.en;
      for (var k in map) return map[k];
      return '';
    },
    onChange: function (fn) {
      return on('__lang', fn);
    }
  };

  // 把 lang 变化转发到 i18n.onChange 订阅者
  langListeners.push(function (lang) { emit('__lang', lang); });

  /* ---------------------------------------------------------- */
  /* UI 辅助                                                     */
  /* ---------------------------------------------------------- */

  var toastTimer = null;

  function toast(message, duration) {
    if (!global.document) return;
    var el = document.getElementById('p4096-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'p4096-toast';
      el.className = 'p4096-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('p4096-toast--show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('p4096-toast--show');
    }, duration || 2200);
  }

  var ui = {
    toast: toast,
    requestFullscreen: function (element) {
      var el = element || document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (req) return req.call(el);
      return Promise.reject(new Error('Fullscreen not supported'));
    },
    exitFullscreen: function () {
      var exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit && document.fullscreenElement) return exit.call(document);
      return Promise.resolve();
    },
    isFullscreen: function () { return !!document.fullscreenElement; },
    /** 当前是否应减少动画 */
    shouldReduceMotion: function () {
      return !!readSettings().reduceMotion;
    },
    /** 全局音效是否开启 */
    isSoundEnabled: function () {
      return !!readSettings().sound;
    }
  };

  /* ---------------------------------------------------------- */
  /* 导航                                                        */
  /* ---------------------------------------------------------- */

  // 平台根目录：由当前脚本路径推断 (platform/game-api.js -> 根)
  var platformRootUrl = (function () {
    if (document.currentScript && document.currentScript.src) {
      return new URL('../', document.currentScript.src);
    }
    return new URL('../../', location.href);
  })();

  var navigate = {
    /** 返回主页 */
    goHome: function () {
      location.href = new URL('index.html', platformRootUrl).href;
    },
    /** 跳转到指定游戏 (gameId 为 Games/ 下的目录名) */
    openGame: function (id) {
      location.href = new URL('Games/' + encodeURIComponent(id) + '/index.html', platformRootUrl).href;
    },
    /** 平台根 URL */
    rootUrl: platformRootUrl.href
  };

  /* ---------------------------------------------------------- */
  /* 主题外观包 API                                              */
  /* ---------------------------------------------------------- */

  var themePacks = {
    /** 所有外观包 id */
    list: function () {
      return Object.keys(THEME_PACKS);
    },
    /** 取外观包定义；不传 id 则返回当前激活包 */
    get: function (id) {
      return getPack(id || readSettings().skin);
    },
    /**
     * 当前激活包按当前深浅模式解析后的完整外观
     * => { id, name, mode, colors: {...}, bgTexture, accentTexture, backdropFilter, font }
     */
    getActive: function () {
      var pack = getPack(readSettings().skin);
      var mode = resolveTheme(readSettings().theme);
      var d = pack[mode] || pack.light;
      var colors = {};
      for (var key in SKIN_VAR_MAP) colors[key] = d[key];
      return {
        id: pack.id,
        name: pack.name,
        mode: mode,
        colors: colors,
        bgTexture: d.bgTexture || 'none',
        accentTexture: d.accentTexture || 'none',
        backdropFilter: d.backdropFilter || 'none',
        font: d.font || null
      };
    },
    /** 仅取当前已解析颜色表 (canvas 等场景常用) */
    colors: function () {
      return themePacks.getActive().colors;
    },
    /** 订阅外观包变化，fn(activeInfo)；返回取消订阅函数 */
    onChange: function (fn) {
      skinListeners.push(fn);
      return function () {
        var i = skinListeners.indexOf(fn);
        if (i !== -1) skinListeners.splice(i, 1);
      };
    },
    /**
     * 运行时注册自定义外观包
     * pack = { id, name: {zh,en}, light: {...}, dark: {...} }
     * light/dark 字段同 THEME_PACKS 内置包（bg / bgTexture / accent / accentTexture ...）
     */
    register: function (pack) {
      if (!pack || !pack.id || !pack.light || !pack.dark) {
        throw new Error('[GamePlatform] themePacks.register: pack needs id/light/dark');
      }
      THEME_PACKS[pack.id] = pack;
      if (readSettings().skin === pack.id) applyDocumentMeta();
      return pack;
    }
  };

  /* ---------------------------------------------------------- */
  /* 设置对象                                                    */
  /* ---------------------------------------------------------- */

  var settings = {
    defaults: DEFAULT_SETTINGS,
    get: function (key) {
      var s = readSettings();
      return (key === undefined) ? s : s[key];
    },
    getAll: function () { return readSettings(); },
    set: function (key, value) {
      if (typeof key === 'string') {
        var patch = {}; patch[key] = value;
        writeSettings(patch, 'api');
      } else if (isObject(key)) {
        writeSettings(key, 'api');
      }
    },
    /** 订阅设置变化，返回取消订阅函数。fn(settings, changedKeys, source) */
    onChange: function (fn) {
      settingsListeners.push(fn);
      return function () {
        var i = settingsListeners.indexOf(fn);
        if (i !== -1) settingsListeners.splice(i, 1);
      };
    }
  };

  /* ---------------------------------------------------------- */
  /* 启动                                                        */
  /* ---------------------------------------------------------- */

  var readyPromise = new Promise(function (resolve) {
    var start = function () {
      applyDocumentMeta();
      resolve(api);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  });

  var api = {
    version: VERSION,
    gameId: gameId,
    isGamePage: !!gameId,
    ready: readyPromise,
    settings: settings,
    storage: storage,
    theme: {
      get: function () { return resolveTheme(readSettings().theme); },
      getPref: function () { return readSettings().theme; },
      /** 订阅主题(解析后)变化 —— 深浅模式或外观包变化都会触发。fn(resolvedTheme, pref) */
      onChange: function (fn) {
        themeListeners.push(fn);
        return function () {
          var i = themeListeners.indexOf(fn);
          if (i !== -1) themeListeners.splice(i, 1);
        };
      },
      apply: applyDocumentMeta
    },
    themePacks: themePacks,
    i18n: i18n,
    ui: ui,
    events: { on: on, off: off, emit: emit },
    navigate: navigate,
    util: {
      clamp: clamp,
      randInt: randInt,
      shuffle: shuffle,
      formatNumber: function (n) {
        return typeof n === 'number' ? n.toLocaleString() : String(n);
      }
    }
  };

  global.GamePlatform = api;
})(typeof window !== 'undefined' ? window : this);
