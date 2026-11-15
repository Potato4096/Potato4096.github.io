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
    lang: 'zh',              // 'zh' | 'en'
    theme: 'system',         // 'light' | 'dark' | 'system' —— 黑白方案
    style: 'solid',          // 主题方案: 'solid' | 'line' | 'cyber' | 'glass'
    palette: 'obsidian',     // 配色 id（15 套，见 THEME_PALETTES）
    reduceMotion: false,     // 减少动画
    sound: true              // 全局音效开关
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
    // 兼容 1.0 的单一 skin id（'default' / 'cyber-cyan' / 'glass-rose' ...）
    if (!('style' in stored) || !('palette' in stored)) {
      var legacy = LEGACY_SKINS[stored.skin];
      if (legacy) {
        out.style = legacy[0];
        out.palette = legacy[1];
      }
    }
    if (!isStyle(out.style)) out.style = DEFAULT_SETTINGS.style;
    if (!isPalette(out.palette)) out.palette = DEFAULT_SETTINGS.palette;
    // 只读兼容字段：'solid-obsidian'
    out.skin = out.style + '-' + out.palette;
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
    delete next.skin; // 只读兼容字段，不落盘
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
    var skinChanged = keys.indexOf('style') !== -1 || keys.indexOf('palette') !== -1;
    settingsListeners.forEach(function (fn) {
      try { fn(s, keys, source); } catch (e) { console.error('[GamePlatform]', e); }
    });
    if (keys.indexOf('theme') !== -1 || skinChanged) {
      themeListeners.forEach(function (fn) {
        try { fn(resolveTheme(s.theme), s.theme); } catch (e) { console.error('[GamePlatform]', e); }
      });
    }
    if (skinChanged) {
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
  /* 主题：方案（风格） × 配色 × 黑白                              */
  /* 方案决定结构（填充 / 描边 / 辉光 / 磨砂），配色决定色相，       */
  /* 黑白决定明暗 —— 三个维度正交，可任意组合                      */
  /* ---------------------------------------------------------- */

  /* 4 种固定方案 */
  var THEME_STYLES = [
    {
      id: 'solid',
      name: { zh: '纯色', en: 'Solid' },
      desc: { zh: '纯色底 + 单一强调色，干净直接', en: 'Flat fills with one accent — clean and direct' }
    },
    {
      id: 'line',
      name: { zh: '线条', en: 'Outline' },
      desc: { zh: '简约描边 + 淡色填充，线稿感', en: 'Minimal strokes over pale fills' }
    },
    {
      id: 'cyber',
      name: { zh: '赛博朋克', en: 'Cyberpunk' },
      desc: { zh: '霓虹描边 + 整体辉光，高对比', en: 'Neon strokes, glow everywhere, high contrast' }
    },
    {
      id: 'glass',
      name: { zh: '液态玻璃', en: 'Liquid Glass' },
      desc: { zh: '半透明磨砂面板，透出彩色光晕', en: 'Frosted translucent panels over colored light' }
    }
  ];

  /* 15 套固定配色：accent 浅色主色 / neon 深色荧光 / accent2 渐变副色 */
  var THEME_PALETTES = [
    { id: 'obsidian',  name: { zh: '曜石蓝', en: 'Obsidian Blue' }, accent: '#4f6df5', neon: '#7c93ff', accent2: '#7c5cf0' },
    { id: 'ocean',     name: { zh: '深海青', en: 'Deep Ocean' },    accent: '#0e9bc9', neon: '#3ec0e4', accent2: '#43c4e0' },
    { id: 'forest',    name: { zh: '林间绿', en: 'Forest' },        accent: '#3f9a4f', neon: '#62c274', accent2: '#7fbf5c' },
    { id: 'sunset',    name: { zh: '落日橙', en: 'Sunset' },        accent: '#e8703a', neon: '#f0854e', accent2: '#f0a03c' },
    { id: 'candy',     name: { zh: '糖果粉', en: 'Candy' },         accent: '#c2559c', neon: '#e074c0', accent2: '#7b6ef0' },
    { id: 'mono',      name: { zh: '极简灰', en: 'Mono' },          accent: '#3f3f46', neon: '#d4d4d8', accent2: '#71717a' },
    { id: 'ink',       name: { zh: '墨黑', en: 'Ink' },             accent: '#1b1e26', neon: '#e8eaee', accent2: '#4a4f5a' },
    { id: 'blueprint', name: { zh: '工程蓝', en: 'Blueprint' },     accent: '#2563eb', neon: '#6ea8ff', accent2: '#0ea5e9' },
    { id: 'violet',    name: { zh: '紫罗兰', en: 'Violet' },        accent: '#7c3aed', neon: '#c4b5fd', accent2: '#a855f7' },
    { id: 'cyan',      name: { zh: '霓虹青', en: 'Neon Cyan' },     accent: '#00a6c0', neon: '#00ffd0', accent2: '#00b3ff' },
    { id: 'magenta',   name: { zh: '霓虹紫红', en: 'Neon Magenta' },accent: '#d6006e', neon: '#ff2d95', accent2: '#a855f7' },
    { id: 'lime',      name: { zh: '荧光绿', en: 'Neon Lime' },     accent: '#4d9c00', neon: '#a3ff2e', accent2: '#00d0a0' },
    { id: 'azure',     name: { zh: '冰蓝', en: 'Ice Blue' },        accent: '#0a84ff', neon: '#64b5ff', accent2: '#5ac8fa' },
    { id: 'rose',      name: { zh: '玫瑰粉', en: 'Rose' },          accent: '#d81b60', neon: '#ff7ab2', accent2: '#c86bff' },
    { id: 'mint',      name: { zh: '薄荷绿', en: 'Mint' },          accent: '#0fae83', neon: '#4fe3bb', accent2: '#38bdf8' }
  ];

  /** 1.0 版单一 skin id -> [方案, 配色]，仅用于读取旧设置 */
  var LEGACY_SKINS = {
    'default': ['solid', 'obsidian'],
    'ocean': ['solid', 'ocean'],
    'forest': ['solid', 'forest'],
    'sunset': ['solid', 'sunset'],
    'candy': ['solid', 'candy'],
    'mono': ['solid', 'mono'],
    'line-ink': ['line', 'ink'],
    'line-blueprint': ['line', 'blueprint'],
    'line-violet': ['line', 'violet'],
    'cyber-cyan': ['cyber', 'cyan'],
    'cyber-magenta': ['cyber', 'magenta'],
    'cyber-lime': ['cyber', 'lime'],
    'glass': ['glass', 'azure'],
    'glass-rose': ['glass', 'rose'],
    'glass-mint': ['glass', 'mint']
  };

  /* ---------- 颜色工具 ---------- */

  function hex2rgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return { r: 136, g: 136, b: 136 };
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgb2hex(c) {
    function p(n) {
      var v = Math.round(Math.min(255, Math.max(0, n)));
      return (v < 16 ? '0' : '') + v.toString(16);
    }
    return '#' + p(c.r) + p(c.g) + p(c.b);
  }

  /** 线性混色：t=0 取 a，t=1 取 b */
  function mix(a, b, t) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex({
      r: A.r + (B.r - A.r) * t,
      g: A.g + (B.g - A.g) * t,
      b: A.b + (B.b - A.b) * t
    });
  }

  function fade(hex, alpha) {
    var c = hex2rgb(hex);
    return 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + alpha + ')';
  }

  function findStyle(id) {
    for (var i = 0; i < THEME_STYLES.length; i++) {
      if (THEME_STYLES[i].id === id) return THEME_STYLES[i];
    }
    return null;
  }

  function findPalette(id) {
    for (var i = 0; i < THEME_PALETTES.length; i++) {
      if (THEME_PALETTES[i].id === id) return THEME_PALETTES[i];
    }
    return null;
  }

  function isStyle(id) { return !!findStyle(id); }
  function isPalette(id) { return !!findPalette(id); }

  /** 中性色阶：由配色的强调色推导出成套底色/文字/描边 */
  function neutralScale(pal, mode) {
    if (mode === 'dark') {
      return {
        bg: mix('#0b0f16', pal.accent, 0.06),
        surface: mix('#171d28', pal.accent, 0.07),
        surface2: mix('#212936', pal.accent, 0.09),
        text: mix('#eef3fb', pal.accent, 0.05),
        textMuted: mix('#9aa5b6', pal.accent, 0.10),
        border: mix('#2d3543', pal.accent, 0.18),
        accent: pal.neon,
        accentHover: mix(pal.neon, '#ffffff', 0.18)
      };
    }
    return {
      bg: mix('#ffffff', pal.accent, 0.045),
      surface: '#ffffff',
      surface2: mix('#ffffff', pal.accent, 0.09),
      text: mix('#111621', pal.accent, 0.10),
      textMuted: mix('#5c6676', pal.accent, 0.10),
      border: mix('#dde2ea', pal.accent, 0.22),
      accent: pal.accent,
      accentHover: mix(pal.accent, '#000000', 0.14)
    };
  }

  /**
   * 生成一套完整外观 token
   * 方案（solid/line/cyber/glass） × 配色 × 黑白
   */
  function buildTokens(styleId, pal, mode) {
    var n = neutralScale(pal, mode);
    var dark = mode === 'dark';
    var t = {
      bg: n.bg,
      bgTexture: 'none',
      surface: n.surface,
      surface2: n.surface2,
      text: n.text,
      textMuted: n.textMuted,
      border: n.border,
      accent: n.accent,
      accentHover: n.accentHover,
      accentSoft: fade(n.accent, dark ? 0.18 : 0.13),
      accentTexture: 'linear-gradient(135deg, ' + n.accent + ' 0%, ' + pal.accent2 + ' 100%)',
      success: dark ? '#3ecf8e' : '#1f9d63',
      warning: dark ? '#e3b455' : '#c98a1e',
      danger: dark ? '#ff6b6b' : '#d64545',
      shadow: dark ? '0 10px 30px rgba(0, 0, 0, 0.36)' : '0 10px 30px rgba(15, 23, 42, 0.10)',
      shadowHover: dark ? '0 18px 44px rgba(0, 0, 0, 0.50)' : '0 16px 40px rgba(15, 23, 42, 0.16)',
      backdropFilter: 'none',
      borderWidth: '1px'
    };

    if (styleId === 'line') {
      /* 线条：近白/近黑底 + 淡色填充 + 明确描边 */
      var lb = dark ? mix('#0a0c11', pal.accent, 0.04) : mix('#ffffff', pal.accent, 0.02);
      var grid = fade(n.border, dark ? 0.16 : 0.13);
      t.bg = lb;
      t.bgTexture = 'linear-gradient(' + grid + ' 1px, transparent 1px) 0 0 / 26px 26px, ' +
                    'linear-gradient(90deg, ' + grid + ' 1px, transparent 1px) 0 0 / 26px 26px';
      t.surface = mix(lb, n.accent, dark ? 0.10 : 0.05);
      t.surface2 = mix(lb, n.accent, dark ? 0.16 : 0.10);
      t.border = mix(n.accent, lb, dark ? 0.28 : 0.22);
      t.text = dark ? mix('#f5f7fb', pal.accent, 0.05) : mix('#0d1116', pal.accent, 0.12);
      t.textMuted = dark ? mix('#a6b0bf', pal.accent, 0.10) : mix('#4d5765', pal.accent, 0.12);
      t.accentTexture = 'none';
      t.shadow = 'none';
      t.shadowHover = 'none';
      t.borderWidth = '2px';
    } else if (styleId === 'cyber') {
      /* 赛博朋克：线条骨架 + 霓虹描边 + 整体辉光，高对比 */
      var cyberAccent = dark ? pal.neon : mix(pal.accent, '#000000', 0.06);
      var glow = dark ? 0.26 : 0.18;
      t.bg = dark ? mix('#04070c', pal.neon, 0.06) : mix('#ffffff', pal.neon, 0.05);
      t.bgTexture =
        'radial-gradient(1200px 720px at 8% -12%, ' + fade(pal.neon, dark ? 0.24 : 0.20) + ' 0%, transparent 58%), ' +
        'radial-gradient(900px 620px at 108% 6%, ' + fade(pal.accent2, dark ? 0.20 : 0.14) + ' 0%, transparent 62%)';
      t.surface = dark ? fade(mix('#0a121b', pal.neon, 0.10), 0.88) : 'rgba(255, 255, 255, 0.84)';
      t.surface2 = fade(pal.neon, dark ? 0.10 : 0.09);
      t.text = dark ? mix('#ffffff', pal.neon, 0.10) : mix('#05080e', pal.neon, 0.10);
      t.textMuted = dark ? fade(pal.neon, 0.66) : mix('#49525f', pal.accent, 0.16);
      t.border = fade(pal.neon, dark ? 0.48 : 0.58);
      t.accent = cyberAccent;
      t.accentHover = dark ? mix(pal.neon, '#ffffff', 0.20) : mix(pal.accent, '#000000', 0.20);
      t.accentSoft = fade(cyberAccent, dark ? 0.20 : 0.14);
      t.accentTexture = 'linear-gradient(135deg, ' + cyberAccent + ' 0%, ' + pal.neon + ' 100%)';
      t.shadow = '0 0 0 1px ' + fade(pal.neon, 0.40) + ', 0 0 22px ' + fade(pal.neon, glow) +
                 ', 0 12px 30px rgba(0, 0, 0, ' + (dark ? 0.36 : 0.14) + ')';
      t.shadowHover = '0 0 0 1px ' + fade(pal.neon, 0.62) + ', 0 0 34px ' + fade(pal.neon, glow + 0.10) +
                      ', 0 18px 42px rgba(0, 0, 0, ' + (dark ? 0.46 : 0.18) + ')';
      t.borderWidth = '1px';
    } else if (styleId === 'glass') {
      /* 液态玻璃：彩色光晕 + 半透明磨砂 */
      t.bg = dark ? mix('#101828', pal.accent, 0.10) : mix('#f4f7ff', pal.accent, 0.05);
      t.bgTexture =
        'radial-gradient(1100px 760px at 10% -10%, ' + fade(pal.accent, dark ? 0.38 : 0.44) + ' 0%, transparent 58%), ' +
        'radial-gradient(900px 700px at 112% 12%, ' + fade(pal.accent2, dark ? 0.30 : 0.34) + ' 0%, transparent 60%), ' +
        'radial-gradient(820px 620px at 48% 122%, ' + fade(pal.neon, dark ? 0.22 : 0.26) + ' 0%, transparent 62%)';
      t.surface = dark ? 'rgba(30, 38, 54, 0.34)' : 'rgba(255, 255, 255, 0.32)';
      t.surface2 = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.20)';
      t.text = dark ? '#eef2f9' : mix('#0e1622', pal.accent, 0.10);
      t.textMuted = dark ? 'rgba(226, 234, 246, 0.72)' : mix('#55637a', pal.accent, 0.12);
      t.border = dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.50)';
      t.accentSoft = fade(n.accent, dark ? 0.20 : 0.16);
      t.backdropFilter = 'blur(14px) saturate(1.5)';
      t.shadow = dark ? '0 12px 34px rgba(0, 0, 0, 0.34)' : '0 12px 32px rgba(31, 58, 110, 0.12)';
      t.shadowHover = dark ? '0 18px 46px rgba(0, 0, 0, 0.46)' : '0 18px 44px rgba(31, 58, 110, 0.18)';
    } else {
      /* 纯色：纯色底 + 单强调色（浅色渐变底） */
      t.bgTexture = dark
        ? 'linear-gradient(160deg, ' + mix(n.bg, pal.accent, 0.10) + ' 0%, ' + n.bg + ' 52%, ' + mix(n.bg, pal.accent2, 0.08) + ' 100%)'
        : 'linear-gradient(160deg, ' + mix(n.bg, pal.accent, 0.10) + ' 0%, ' + n.bg + ' 48%, ' + mix(n.bg, pal.accent2, 0.07) + ' 100%)';
    }
    return t;
  }

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

  /** 运行时注册的自定义外观（旧 API 兼容，按配色 id 直接取整套 token） */
  var CUSTOM_SKINS = Object.create(null);

  var deriveCache = Object.create(null);

  /** 解析一套外观快照：{ style, palette, mode, colors, bgTexture, accentTexture, backdropFilter, shadow } */
  function deriveSkin(styleId, paletteId, mode) {
    var st = findStyle(styleId) || findStyle('solid');
    var pal = findPalette(paletteId) || findPalette('obsidian');
    var m = (mode === 'light' || mode === 'dark') ? mode : resolveTheme(readSettings().theme);
    var key = st.id + '|' + pal.id + '|' + m;
    if (deriveCache[key]) return deriveCache[key];

    var tokens;
    var custom = CUSTOM_SKINS[pal.id];
    if (custom) {
      var cd = custom[m] || custom.light;
      tokens = {};
      tokens.bg = cd.bg;
      tokens.bgTexture = cd.bgTexture || 'none';
      tokens.surface = cd.surface;
      tokens.surface2 = cd.surface2;
      tokens.text = cd.text;
      tokens.textMuted = cd.textMuted;
      tokens.border = cd.border;
      tokens.accent = cd.accent;
      tokens.accentHover = cd.accentHover || cd.accent;
      tokens.accentSoft = cd.accentSoft || 'transparent';
      tokens.accentTexture = cd.accentTexture || 'none';
      tokens.success = cd.success || '#22a06b';
      tokens.warning = cd.warning || '#e2a03f';
      tokens.danger = cd.danger || '#e5484d';
      tokens.shadow = cd.shadow || 'none';
      tokens.shadowHover = cd.shadow || 'none';
      tokens.backdropFilter = cd.backdropFilter || 'none';
    } else {
      tokens = buildTokens(st.id, pal, m);
    }

    var colors = {};
    for (var k in SKIN_VAR_MAP) colors[k] = tokens[k];

    var out = {
      id: st.id + '-' + pal.id,
      style: st.id,
      palette: pal.id,
      mode: m,
      colors: colors,
      bgTexture: tokens.bgTexture || 'none',
      accentTexture: tokens.accentTexture || 'none',
      backdropFilter: tokens.backdropFilter || 'none',
      shadowHover: tokens.shadowHover || tokens.shadow || 'none'
    };
    deriveCache[key] = out;
    return out;
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

  /** 把一套外观写入 <html> 的 CSS 变量与 data 属性 */
  function applySkinVars(root, styleId, paletteId, mode) {
    var d = deriveSkin(styleId, paletteId, mode);
    for (var key in SKIN_VAR_MAP) {
      if (d.colors[key] != null) root.style.setProperty(SKIN_VAR_MAP[key], d.colors[key]);
    }
    root.style.setProperty('--pg-bg-image', d.bgTexture || 'none');
    root.style.setProperty('--pg-accent-image', d.accentTexture || 'none');
    root.style.setProperty('--pg-backdrop-filter', d.backdropFilter || 'none');
    root.style.setProperty('--pg-on-accent', onAccentColor(d.colors.accent));
    root.style.setProperty('--pg-shadow-hover', d.shadowHover);
    root.setAttribute('data-skin', d.style);          // 方案（结构）
    root.setAttribute('data-palette', d.palette);     // 配色（色相）
    root.setAttribute('data-skin-id', d.id);          // 组合 id，便于调试
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

  /* 黑白切换过渡：只在切换的那一下挂到 <html> 上，避免影响平时的 hover / 动效 */
  var lastResolvedTheme = null;
  var themeAnimTimer = null;

  function startThemeTransition(root) {
    root.classList.add('pg-theme-anim');
    void root.offsetHeight; // 先让带 transition 的样式落地，再改颜色变量才会真的过渡
    if (themeAnimTimer) global.clearTimeout(themeAnimTimer);
    themeAnimTimer = global.setTimeout(function () {
      root.classList.remove('pg-theme-anim');
      themeAnimTimer = null;
    }, 520);
  }

  function applyDocumentMeta() {
    if (!global.document) return;
    var s = readSettings();
    var resolved = resolveTheme(s.theme);
    var root = document.documentElement;
    var switched = lastResolvedTheme !== null && lastResolvedTheme !== resolved;
    if (switched && !s.reduceMotion) startThemeTransition(root);
    lastResolvedTheme = resolved;
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-pref', s.theme);
    root.setAttribute('data-lang', s.lang);
    if (s.reduceMotion) root.setAttribute('data-reduce-motion', '1');
    else root.removeAttribute('data-reduce-motion');
    if (!root.getAttribute('lang')) root.setAttribute('lang', s.lang === 'en' ? 'en' : 'zh-CN');
    applySkinVars(root, s.style, s.palette, resolved);
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
      notifySettings(['lang', 'theme', 'style', 'palette', 'reduceMotion', 'sound'], 'storage');
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
  /* 主题 API：方案 × 配色 × 黑白                                 */
  /* ---------------------------------------------------------- */

  var themePacks = {
    /** 全部方案（风格）：[{ id, name:{zh,en}, desc:{zh,en} }] */
    styles: function () { return THEME_STYLES.slice(); },
    /** 全部配色：[{ id, name:{zh,en} }] */
    palettes: function () {
      return THEME_PALETTES.map(function (p) { return { id: p.id, name: p.name }; });
    },
    /** 取方案定义 */
    style: function (id) { return findStyle(id) || findStyle(DEFAULT_SETTINGS.style); },
    /** 取配色定义 */
    palette: function (id) { return findPalette(id) || findPalette(DEFAULT_SETTINGS.palette); },
    /** 组合 id 列表：方案-配色（共 60 种，不含黑白） */
    list: function () {
      var out = [];
      THEME_STYLES.forEach(function (s) {
        THEME_PALETTES.forEach(function (p) { out.push(s.id + '-' + p.id); });
      });
      return out;
    },
    /**
     * 解析任意组合，用于预览与自定义渲染：
     * derive('cyber', 'cyan', 'dark') => { style, palette, mode, colors, bgTexture, ... }
     */
    derive: function (styleId, paletteId, mode) { return deriveSkin(styleId, paletteId, mode); },
    /** 取某个组合的定义（兼容旧 API） */
    get: function (id) {
      var styleId = readSettings().style;
      var paletteId = readSettings().palette;
      if (id && LEGACY_SKINS[id]) {
        styleId = LEGACY_SKINS[id][0];
        paletteId = LEGACY_SKINS[id][1];
      } else if (id && id.indexOf('-') > 0) {
        var idx = id.indexOf('-');
        var s = id.slice(0, idx), p = id.slice(idx + 1);
        if (isStyle(s) && isPalette(p)) { styleId = s; paletteId = p; }
      }
      var st = findStyle(styleId) || findStyle('solid');
      var pal = findPalette(paletteId) || findPalette('obsidian');
      return {
        id: st.id + '-' + pal.id,
        style: st.id,
        palette: pal.id,
        name: {
          zh: GP_NAME(st.name).zh + ' · ' + GP_NAME(pal.name).zh,
          en: GP_NAME(st.name).en + ' · ' + GP_NAME(pal.name).en
        },
        light: deriveSkin(st.id, pal.id, 'light').colors,
        dark: deriveSkin(st.id, pal.id, 'dark').colors
      };
    },
    /**
     * 当前激活外观（已按黑白方案解析）
     * => { id, style, palette, name, mode, colors: {...}, bgTexture, accentTexture, backdropFilter, shadow }
     */
    getActive: function () {
      var s = readSettings();
      var mode = resolveTheme(s.theme);
      var d = deriveSkin(s.style, s.palette, mode);
      var st = findStyle(d.style);
      var pal = findPalette(d.palette);
      return {
        id: d.id,
        style: d.style,
        palette: d.palette,
        category: d.style,
        name: {
          zh: GP_NAME(st.name).zh + ' · ' + GP_NAME(pal.name).zh,
          en: GP_NAME(st.name).en + ' · ' + GP_NAME(pal.name).en
        },
        mode: mode,
        colors: d.colors,
        bgTexture: d.bgTexture,
        accentTexture: d.accentTexture,
        backdropFilter: d.backdropFilter,
        font: null
      };
    },
    /** 兼容旧命名：方案列表 */
    categories: function () { return THEME_STYLES.slice(); },
    /** 兼容旧命名：某方案下可选配色（配色与方案正交，返回全部） */
    byCategory: function () {
      return THEME_PALETTES.map(function (p) { return p.id; });
    },
    /** 兼容旧命名：组合所属方案 */
    categoryOf: function (id) {
      if (isStyle(id)) return id;
      var hit = LEGACY_SKINS[id];
      if (hit) return hit[0];
      if (id && id.indexOf('-') > 0) {
        var s = id.slice(0, id.indexOf('-'));
        if (isStyle(s)) return s;
      }
      return readSettings().style;
    },
    /** 仅取当前已解析颜色表 (canvas 等场景常用) */
    colors: function () { return themePacks.getActive().colors; },
    /** 订阅外观变化，fn(activeInfo)；返回取消订阅函数 */
    onChange: function (fn) {
      skinListeners.push(fn);
      return function () {
        var i = skinListeners.indexOf(fn);
        if (i !== -1) skinListeners.splice(i, 1);
      };
    },
    /**
     * 运行时注册自定义配色（兼容旧 API）
     * pack = { id, name: {zh,en}, light: {...}, dark: {...} }
     * 注册后该配色在四种方案下都会直接使用 pack 自带的 light/dark token。
     */
    register: function (pack) {
      if (!pack || !pack.id || !pack.light || !pack.dark) {
        throw new Error('[GamePlatform] themePacks.register: pack needs id/light/dark');
      }
      CUSTOM_SKINS[pack.id] = pack;
      deriveCache = Object.create(null);
      if (!findPalette(pack.id)) {
        THEME_PALETTES.push({ id: pack.id, name: pack.name || { zh: pack.id, en: pack.id }, accent: pack.light.accent, neon: pack.dark.accent, accent2: pack.light.accent2 || pack.light.accent });
      }
      if (readSettings().palette === pack.id) applyDocumentMeta();
      return pack;
    }
  };

  /** 统一的 {zh,en} 取名（兼容字符串） */
  function GP_NAME(map) {
    if (!map) return { zh: '', en: '' };
    if (typeof map === 'string') return { zh: map, en: map };
    return { zh: map.zh || map.en || '', en: map.en || map.zh || '' };
  }

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
