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

  /* 主题风格分类：纯色 / 线条 / 赛博朋克 / 液态玻璃 */
  var THEME_CATEGORIES = [
    {
      id: 'solid',
      name: { zh: '纯色', en: 'Solid' },
      desc: { zh: '纯色底 + 单一强调色，干净直接', en: 'Flat fills with a single accent — clean and direct' }
    },
    {
      id: 'line',
      name: { zh: '线条', en: 'Outline' },
      desc: { zh: '无填充、强描边，工程图纸般的线稿感', en: 'No fills, strong strokes — a blueprint line-art feel' }
    },
    {
      id: 'cyber',
      name: { zh: '赛博朋克', en: 'Cyberpunk' },
      desc: { zh: '暗底霓虹、辉光与扫描线', en: 'Neon glow and scanlines over dark surfaces' }
    },
    {
      id: 'glass',
      name: { zh: '液态玻璃', en: 'Liquid Glass' },
      desc: { zh: '半透明磨砂面板，背景透出彩色光晕', en: 'Frosted translucent panels over colorful light' }
    }
  ];

  var THEME_PACKS = {
    /* ================= 纯色 Solid ================= */
    'default': {
      id: 'default',
      cat: 'solid',
      name: { zh: '曜石蓝', en: 'Obsidian Blue' },
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
      cat: 'solid',
      name: { zh: '深海青', en: 'Deep Ocean' },
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
      cat: 'solid',
      name: { zh: '林间绿', en: 'Forest' },
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
      cat: 'solid',
      name: { zh: '落日橙', en: 'Sunset' },
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
      cat: 'solid',
      name: { zh: '糖果粉', en: 'Candy' },
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
    'mono': {
      id: 'mono',
      cat: 'solid',
      name: { zh: '极简黑白', en: 'Mono' },
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
    },

    /* ================= 线条 Outline ================= */
    'line-ink': {
      id: 'line-ink',
      cat: 'line',
      name: { zh: '墨线', en: 'Ink Line' },
      light: {
        bg: '#ffffff',
        bgTexture: 'none',
        surface: 'transparent', surface2: 'rgba(17, 19, 24, 0.05)',
        text: '#111318', textMuted: '#565b66', border: '#1b1e26',
        accent: '#1b1e26', accentHover: '#000000', accentSoft: 'rgba(17, 19, 24, 0.08)',
        accentTexture: 'none',
        success: '#1a7f4f', warning: '#a86b00', danger: '#c02b2b',
        shadow: 'none'
      },
      dark: {
        bg: '#0b0b0d',
        bgTexture: 'none',
        surface: 'transparent', surface2: 'rgba(255, 255, 255, 0.06)',
        text: '#f4f5f7', textMuted: '#a0a5b0', border: '#e8eaee',
        accent: '#f4f5f7', accentHover: '#ffffff', accentSoft: 'rgba(255, 255, 255, 0.12)',
        accentTexture: 'none',
        success: '#5fd39b', warning: '#e0b050', danger: '#ff8070',
        shadow: 'none'
      }
    },
    'line-blueprint': {
      id: 'line-blueprint',
      cat: 'line',
      name: { zh: '工程蓝图', en: 'Blueprint' },
      light: {
        bg: '#f4f8ff',
        bgTexture: 'linear-gradient(rgba(37, 99, 235, 0.10) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, rgba(37, 99, 235, 0.10) 1px, transparent 1px) 0 0 / 24px 24px',
        surface: 'transparent', surface2: 'rgba(37, 99, 235, 0.07)',
        text: '#0f2a4a', textMuted: '#4a6b8f', border: '#2f6fd0',
        accent: '#2563eb', accentHover: '#1d4fd0', accentSoft: 'rgba(37, 99, 235, 0.12)',
        accentTexture: 'none',
        success: '#0f7a54', warning: '#a86700', danger: '#c02b2b',
        shadow: 'none'
      },
      dark: {
        bg: '#081426',
        bgTexture: 'linear-gradient(rgba(120, 170, 255, 0.13) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, rgba(120, 170, 255, 0.13) 1px, transparent 1px) 0 0 / 24px 24px',
        surface: 'transparent', surface2: 'rgba(120, 170, 255, 0.10)',
        text: '#dbe8ff', textMuted: '#7d9cc4', border: '#5b8fd6',
        accent: '#6ea8ff', accentHover: '#9cc4ff', accentSoft: 'rgba(110, 168, 255, 0.18)',
        accentTexture: 'none',
        success: '#4fd3a0', warning: '#e0b050', danger: '#ff8070',
        shadow: 'none'
      }
    },
    'line-violet': {
      id: 'line-violet',
      cat: 'line',
      name: { zh: '紫墨线', en: 'Violet Line' },
      light: {
        bg: '#fcf7ff',
        bgTexture: 'none',
        surface: 'transparent', surface2: 'rgba(124, 58, 237, 0.07)',
        text: '#2a1145', textMuted: '#6b4f8a', border: '#7c3aed',
        accent: '#7c3aed', accentHover: '#6a2dd1', accentSoft: 'rgba(124, 58, 237, 0.12)',
        accentTexture: 'none',
        success: '#0f7a54', warning: '#a86700', danger: '#c02b2b',
        shadow: 'none'
      },
      dark: {
        bg: '#120d1d',
        bgTexture: 'none',
        surface: 'transparent', surface2: 'rgba(196, 181, 253, 0.10)',
        text: '#ede6ff', textMuted: '#a08cbd', border: '#c4b5fd',
        accent: '#c4b5fd', accentHover: '#ded3ff', accentSoft: 'rgba(196, 181, 253, 0.18)',
        accentTexture: 'none',
        success: '#4fd3a0', warning: '#e0b050', danger: '#ff8070',
        shadow: 'none'
      }
    },

    /* ================= 赛博朋克 Cyberpunk ================= */
    'cyber-cyan': {
      id: 'cyber-cyan',
      cat: 'cyber',
      name: { zh: '霓虹青', en: 'Neon Cyan' },
      light: {
        bg: '#eafaff',
        bgTexture: 'radial-gradient(900px 600px at 10% -10%, rgba(0, 194, 224, 0.20) 0%, rgba(0, 194, 224, 0) 60%), linear-gradient(180deg, #eafaff 0%, #f4feff 100%)',
        surface: 'rgba(255, 255, 255, 0.82)', surface2: 'rgba(0, 194, 224, 0.10)',
        text: '#04222b', textMuted: '#3d6b7a', border: '#59d7ec',
        accent: '#00a6c0', accentHover: '#008fa6', accentSoft: 'rgba(0, 166, 192, 0.15)',
        accentTexture: 'linear-gradient(135deg, #00c2e0 0%, #00ffd0 100%)',
        success: '#0f9d6a', warning: '#c07a00', danger: '#d02b3f',
        shadow: '0 0 0 1px rgba(0, 194, 224, 0.20), 0 8px 26px rgba(0, 194, 224, 0.18)'
      },
      dark: {
        bg: '#04121a',
        bgTexture: 'radial-gradient(1000px 700px at 8% -10%, rgba(0, 255, 208, 0.16) 0%, rgba(0, 255, 208, 0) 55%), linear-gradient(180deg, #04121a 0%, #061c26 100%)',
        surface: 'rgba(9, 32, 42, 0.88)', surface2: 'rgba(0, 255, 208, 0.08)',
        text: '#c8fbff', textMuted: '#5fa8b8', border: '#0e6a80',
        accent: '#00ffd0', accentHover: '#5cffe3', accentSoft: 'rgba(0, 255, 208, 0.16)',
        accentTexture: 'linear-gradient(135deg, #00ffd0 0%, #00b3ff 100%)',
        success: '#39e6a0', warning: '#e0c050', danger: '#ff5c7a',
        shadow: '0 0 0 1px rgba(0, 255, 208, 0.25), 0 0 26px rgba(0, 255, 208, 0.20)'
      }
    },
    'cyber-magenta': {
      id: 'cyber-magenta',
      cat: 'cyber',
      name: { zh: '霓虹紫红', en: 'Neon Magenta' },
      light: {
        bg: '#fff4f9',
        bgTexture: 'radial-gradient(900px 600px at 10% -10%, rgba(255, 45, 149, 0.16) 0%, rgba(255, 45, 149, 0) 60%), linear-gradient(180deg, #fff4f9 0%, #fdf7ff 100%)',
        surface: 'rgba(255, 255, 255, 0.85)', surface2: 'rgba(214, 0, 110, 0.08)',
        text: '#33061c', textMuted: '#7a3a58', border: '#ff9ccb',
        accent: '#d6006e', accentHover: '#b8005f', accentSoft: 'rgba(214, 0, 110, 0.13)',
        accentTexture: 'linear-gradient(135deg, #ff2d95 0%, #a855f7 100%)',
        success: '#0f9d6a', warning: '#c07a00', danger: '#d02b3f',
        shadow: '0 0 0 1px rgba(255, 45, 149, 0.18), 0 8px 26px rgba(255, 45, 149, 0.16)'
      },
      dark: {
        bg: '#12040d',
        bgTexture: 'radial-gradient(1000px 700px at 8% -10%, rgba(255, 45, 149, 0.20) 0%, rgba(255, 45, 149, 0) 55%), radial-gradient(800px 600px at 110% 20%, rgba(168, 85, 247, 0.16) 0%, rgba(168, 85, 247, 0) 60%), linear-gradient(180deg, #12040d 0%, #1a0616 100%)',
        surface: 'rgba(32, 10, 24, 0.90)', surface2: 'rgba(255, 45, 149, 0.09)',
        text: '#ffd9ec', textMuted: '#b06a8f', border: '#7a1f4e',
        accent: '#ff2d95', accentHover: '#ff6bb2', accentSoft: 'rgba(255, 45, 149, 0.18)',
        accentTexture: 'linear-gradient(135deg, #ff2d95 0%, #a855f7 100%)',
        success: '#39e6a0', warning: '#e0c050', danger: '#ff5c7a',
        shadow: '0 0 0 1px rgba(255, 45, 149, 0.28), 0 0 26px rgba(255, 45, 149, 0.22)'
      }
    },
    'cyber-lime': {
      id: 'cyber-lime',
      cat: 'cyber',
      name: { zh: '荧光绿', en: 'Neon Lime' },
      light: {
        bg: '#f6ffe9',
        bgTexture: 'radial-gradient(900px 600px at 10% -10%, rgba(124, 255, 46, 0.18) 0%, rgba(124, 255, 46, 0) 60%), linear-gradient(180deg, #f6ffe9 0%, #f9fff2 100%)',
        surface: 'rgba(255, 255, 255, 0.85)', surface2: 'rgba(77, 156, 0, 0.09)',
        text: '#152400', textMuted: '#4f6b28', border: '#a8e05a',
        accent: '#4d9c00', accentHover: '#3f8000', accentSoft: 'rgba(77, 156, 0, 0.13)',
        accentTexture: 'linear-gradient(135deg, #7cff2e 0%, #00d0a0 100%)',
        success: '#0f9d6a', warning: '#c07a00', danger: '#d02b3f',
        shadow: '0 0 0 1px rgba(124, 255, 46, 0.20), 0 8px 26px rgba(124, 255, 46, 0.16)'
      },
      dark: {
        bg: '#0a1004',
        bgTexture: 'radial-gradient(1000px 700px at 8% -10%, rgba(163, 255, 46, 0.14) 0%, rgba(163, 255, 46, 0) 55%), linear-gradient(180deg, #0a1004 0%, #0d1606 100%)',
        surface: 'rgba(18, 26, 8, 0.90)', surface2: 'rgba(163, 255, 46, 0.08)',
        text: '#eaffd0', textMuted: '#93b06a', border: '#3f6a10',
        accent: '#a3ff2e', accentHover: '#c2ff70', accentSoft: 'rgba(163, 255, 46, 0.16)',
        accentTexture: 'linear-gradient(135deg, #a3ff2e 0%, #00d0a0 100%)',
        success: '#39e6a0', warning: '#e0c050', danger: '#ff5c7a',
        shadow: '0 0 0 1px rgba(163, 255, 46, 0.25), 0 0 26px rgba(163, 255, 46, 0.20)'
      }
    },

    /* ================= 液态玻璃 Liquid Glass ================= */
    'glass': {
      id: 'glass',
      cat: 'glass',
      name: { zh: '蓝玻璃', en: 'Blue Glass' },
      light: {
        bg: '#f2f6ff',
        bgTexture: 'radial-gradient(1200px 800px at 12% -10%, rgba(126, 168, 255, 0.45) 0%, rgba(126, 168, 255, 0) 55%), radial-gradient(900px 700px at 110% 20%, rgba(255, 158, 196, 0.38) 0%, rgba(255, 158, 196, 0) 60%), radial-gradient(800px 600px at 50% 120%, rgba(140, 230, 200, 0.32) 0%, rgba(140, 230, 200, 0) 60%), linear-gradient(180deg, #f2f6ff 0%, #f8faff 100%)',
        surface: 'rgba(255, 255, 255, 0.32)', surface2: 'rgba(255, 255, 255, 0.18)',
        text: '#16202e', textMuted: '#5c6b80', border: 'rgba(255, 255, 255, 0.45)',
        accent: '#0a84ff', accentHover: '#0071e3', accentSoft: 'rgba(10, 132, 255, 0.14)',
        accentTexture: 'linear-gradient(135deg, #0a84ff 0%, #5ac8fa 100%)',
        success: '#248a3d', warning: '#c77500', danger: '#d70015',
        backdropFilter: 'blur(5px) saturate(1.4)',
        shadow: '0 10px 30px rgba(60, 110, 200, 0.12)'
      },
      dark: {
        bg: '#121b2e',
        bgTexture: 'radial-gradient(1200px 800px at 10% -10%, rgba(64, 120, 255, 0.35) 0%, rgba(64, 120, 255, 0) 55%), radial-gradient(900px 700px at 115% 15%, rgba(160, 90, 255, 0.28) 0%, rgba(160, 90, 255, 0) 60%), radial-gradient(800px 600px at 55% 125%, rgba(40, 190, 180, 0.22) 0%, rgba(40, 190, 180, 0) 60%), linear-gradient(180deg, #121b2e 0%, #16203a 100%)',
        surface: 'rgba(28, 34, 48, 0.35)', surface2: 'rgba(255, 255, 255, 0.07)',
        text: '#eef2f8', textMuted: '#93a1b5', border: 'rgba(255, 255, 255, 0.12)',
        accent: '#64b5ff', accentHover: '#8ac8ff', accentSoft: 'rgba(100, 181, 255, 0.18)',
        accentTexture: 'linear-gradient(135deg, #4aa8ff 0%, #7d8cff 100%)',
        success: '#30d158', warning: '#e6a700', danger: '#ff6961',
        backdropFilter: 'blur(5px) saturate(1.4)',
        shadow: '0 10px 30px rgba(0, 0, 0, 0.35)'
      }
    },
    'glass-rose': {
      id: 'glass-rose',
      cat: 'glass',
      name: { zh: '玫瑰玻璃', en: 'Rose Glass' },
      light: {
        bg: '#fff4f8',
        bgTexture: 'radial-gradient(1200px 800px at 8% -10%, rgba(255, 120, 180, 0.40) 0%, rgba(255, 120, 180, 0) 55%), radial-gradient(900px 700px at 110% 15%, rgba(190, 120, 255, 0.30) 0%, rgba(190, 120, 255, 0) 60%), radial-gradient(800px 600px at 50% 120%, rgba(255, 200, 120, 0.24) 0%, rgba(255, 200, 120, 0) 60%), linear-gradient(180deg, #fff4f8 0%, #fff9fb 100%)',
        surface: 'rgba(255, 255, 255, 0.34)', surface2: 'rgba(255, 255, 255, 0.20)',
        text: '#33121f', textMuted: '#7d5a68', border: 'rgba(255, 255, 255, 0.50)',
        accent: '#e0447f', accentHover: '#c93a70', accentSoft: 'rgba(224, 68, 127, 0.14)',
        accentTexture: 'linear-gradient(135deg, #ff7aae 0%, #c86bff 100%)',
        success: '#248a3d', warning: '#c77500', danger: '#d70015',
        backdropFilter: 'blur(5px) saturate(1.4)',
        shadow: '0 10px 30px rgba(224, 68, 127, 0.12)'
      },
      dark: {
        bg: '#1c0f17',
        bgTexture: 'radial-gradient(1200px 800px at 10% -10%, rgba(255, 90, 160, 0.30) 0%, rgba(255, 90, 160, 0) 55%), radial-gradient(900px 700px at 115% 15%, rgba(150, 80, 255, 0.26) 0%, rgba(150, 80, 255, 0) 60%), radial-gradient(800px 600px at 55% 125%, rgba(255, 160, 90, 0.18) 0%, rgba(255, 160, 90, 0) 60%), linear-gradient(180deg, #1c0f17 0%, #24131f 100%)',
        surface: 'rgba(48, 26, 38, 0.36)', surface2: 'rgba(255, 255, 255, 0.07)',
        text: '#fbe9f1', textMuted: '#b891a2', border: 'rgba(255, 255, 255, 0.12)',
        accent: '#ff7ab2', accentHover: '#ffa0c8', accentSoft: 'rgba(255, 122, 178, 0.18)',
        accentTexture: 'linear-gradient(135deg, #ff6fa8 0%, #c07bff 100%)',
        success: '#30d158', warning: '#e6a700', danger: '#ff6961',
        backdropFilter: 'blur(5px) saturate(1.4)',
        shadow: '0 10px 30px rgba(0, 0, 0, 0.35)'
      }
    },
    'glass-mint': {
      id: 'glass-mint',
      cat: 'glass',
      name: { zh: '薄荷玻璃', en: 'Mint Glass' },
      light: {
        bg: '#effcf7',
        bgTexture: 'radial-gradient(1200px 800px at 10% -10%, rgba(110, 231, 190, 0.40) 0%, rgba(110, 231, 190, 0) 55%), radial-gradient(900px 700px at 112% 18%, rgba(120, 200, 255, 0.32) 0%, rgba(120, 200, 255, 0) 60%), radial-gradient(800px 600px at 50% 120%, rgba(255, 240, 160, 0.24) 0%, rgba(255, 240, 160, 0) 60%), linear-gradient(180deg, #effcf7 0%, #f7fffc 100%)',
        surface: 'rgba(255, 255, 255, 0.34)', surface2: 'rgba(255, 255, 255, 0.20)',
        text: '#0d2b23', textMuted: '#4f7268', border: 'rgba(255, 255, 255, 0.50)',
        accent: '#0fae83', accentHover: '#0b9671', accentSoft: 'rgba(15, 174, 131, 0.14)',
        accentTexture: 'linear-gradient(135deg, #22d3a6 0%, #38bdf8 100%)',
        success: '#248a3d', warning: '#c77500', danger: '#d70015',
        backdropFilter: 'blur(5px) saturate(1.4)',
        shadow: '0 10px 30px rgba(15, 174, 131, 0.12)'
      },
      dark: {
        bg: '#08181a',
        bgTexture: 'radial-gradient(1200px 800px at 10% -10%, rgba(60, 220, 180, 0.24) 0%, rgba(60, 220, 180, 0) 55%), radial-gradient(900px 700px at 115% 15%, rgba(70, 140, 255, 0.22) 0%, rgba(70, 140, 255, 0) 60%), radial-gradient(800px 600px at 55% 125%, rgba(240, 200, 90, 0.14) 0%, rgba(240, 200, 90, 0) 60%), linear-gradient(180deg, #08181a 0%, #0b2024 100%)',
        surface: 'rgba(18, 40, 40, 0.36)', surface2: 'rgba(255, 255, 255, 0.07)',
        text: '#e6fbf5', textMuted: '#8fb5ab', border: 'rgba(255, 255, 255, 0.12)',
        accent: '#4fe3bb', accentHover: '#7defcd', accentSoft: 'rgba(79, 227, 187, 0.18)',
        accentTexture: 'linear-gradient(135deg, #3ee0b0 0%, #5cc8ff 100%)',
        success: '#30d158', warning: '#e6a700', danger: '#ff6961',
        backdropFilter: 'blur(5px) saturate(1.4)',
        shadow: '0 10px 30px rgba(0, 0, 0, 0.35)'
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
    danger: '--pg-danger',
    shadow: '--pg-shadow'
  };

  function getPack(id) {
    return THEME_PACKS[id] || THEME_PACKS[DEFAULT_SETTINGS.skin];
  }

  /** 按强调色亮度选前景色，保证霓虹/浅色强调色上的文字可读 */
  function onAccentColor(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return '#ffffff';
    function lin(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var r = lin(parseInt(h.slice(0, 2), 16) / 255);
    var g = lin(parseInt(h.slice(2, 4), 16) / 255);
    var b = lin(parseInt(h.slice(4, 6), 16) / 255);
    var L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return L > 0.45 ? '#0b0f14' : '#ffffff';
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
    root.style.setProperty('--pg-on-accent', onAccentColor(d.accent));
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
        category: pack.cat || 'solid',
        mode: mode,
        colors: colors,
        bgTexture: d.bgTexture || 'none',
        accentTexture: d.accentTexture || 'none',
        backdropFilter: d.backdropFilter || 'none',
        font: d.font || null
      };
    },
    /** 全部风格分类：[{ id, name:{zh,en}, desc:{zh,en} }] */
    categories: function () {
      return THEME_CATEGORIES.slice();
    },
    /** 某分类下的包 id 列表（按定义顺序） */
    byCategory: function (catId) {
      var out = [];
      for (var id in THEME_PACKS) {
        if (THEME_PACKS[id].cat === catId) out.push(id);
      }
      return out;
    },
    /** 取某个包所属分类 id */
    categoryOf: function (id) {
      var pack = getPack(id);
      return pack.cat || 'solid';
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
