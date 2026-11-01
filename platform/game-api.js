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
    theme: 'system',       // 'light' | 'dark' | 'system'
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
    if (keys.indexOf('theme') !== -1) {
      themeListeners.forEach(function (fn) {
        try { fn(resolveTheme(s.theme), s.theme); } catch (e) { console.error('[GamePlatform]', e); }
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
      /** 订阅主题(解析后)变化。fn(resolvedTheme, pref) */
      onChange: function (fn) {
        themeListeners.push(fn);
        return function () {
          var i = themeListeners.indexOf(fn);
          if (i !== -1) themeListeners.splice(i, 1);
        };
      },
      apply: applyDocumentMeta
    },
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
