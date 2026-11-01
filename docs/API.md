# GamePlatform API 文档 v1.0.0

`platform/game-api.js` 提供的通用游戏框架。游戏页面引入后即获得全局对象 `GamePlatform`。

```html
<script src="../../platform/game-api.js"></script>
```

```js
GamePlatform.ready.then(function () {
  // 平台就绪后使用
});
```

---

## 总览

```js
GamePlatform = {
  version,          // '1.0.0'
  gameId,           // 'number-guess' | null（非游戏页为 null）
  isGamePage,       // boolean
  ready,            // Promise<GamePlatform>

  settings: { defaults, get, getAll, set, onChange },
  storage:  { get, set, remove, clear, keys },
  theme:    { get, getPref, onChange, apply },
  themePacks: { list, get, getActive, colors, onChange, register },
  i18n:     { getLang, t, onChange },
  ui:       { toast, requestFullscreen, exitFullscreen, isFullscreen, shouldReduceMotion, isSoundEnabled },
  events:   { on, off, emit },
  navigate: { goHome, openGame, rootUrl },
  util:     { clamp, randInt, shuffle, formatNumber }
}
```

---

## 全局设置 `GamePlatform.settings`

平台级设置，存于 `localStorage["p4096:settings"]`，**跨游戏共享、跨标签页同步**。

### 默认值

```js
GamePlatform.settings.defaults
// {
//   lang: 'zh',          // 'zh' | 'en'
//   theme: 'system',     // 'light' | 'dark' | 'system'  —— 深浅模式
//   skin: 'default',     // 主题外观包 id（见 themePacks）
//   reduceMotion: false,
//   sound: true
// }
```

### `settings.get(key?)`

```js
GamePlatform.settings.get('theme');   // 'system'
GamePlatform.settings.getAll();       // { lang, theme, reduceMotion, sound }
```

### `settings.set(key, value)` / `settings.set(object)`

```js
GamePlatform.settings.set('lang', 'en');
GamePlatform.settings.set({ theme: 'dark', sound: false });
```

> 一般只读即可。修改全局设置属于"平台行为"，建议引导玩家到主页设置面板；确需修改时可用。

### `settings.onChange(fn)` → `unsubscribe`

```js
var off = GamePlatform.settings.onChange(function (settings, changedKeys, source) {
  // settings     当前完整设置
  // changedKeys  ['lang'] 等
  // source       'api' | 'self' | 'remote' | 'storage' | 'system'
  if (changedKeys.indexOf('lang') !== -1) retranslate();
});
// off(); // 取消订阅
```

---

## 游戏存档 `GamePlatform.storage`

按游戏 id 自动隔离（键前缀 `p4096:game:<gameId>:`），值为 JSON 序列化。

| 方法 | 说明 |
|------|------|
| `get(key, fallback?)` | 读取，无值返回 `fallback`（默认 `undefined`） |
| `set(key, value)` | 写入任意 JSON 可序列化值，返回 `boolean` |
| `remove(key)` | 删除单项 |
| `clear()` | 清空本游戏全部存档 |
| `keys()` | 列出本游戏全部存档键 |

```js
var best = GamePlatform.storage.get('best', null);
GamePlatform.storage.set('best', 42);
GamePlatform.storage.set('records', [120, 98, 105]);
```

---

## 主题 `GamePlatform.theme`

| 方法 | 说明 |
|------|------|
| `get()` | **已解析**主题：`'light'` 或 `'dark'`（`system` 已按系统偏好解析） |
| `getPref()` | 用户原始偏好：`'light'` / `'dark'` / `'system'` |
| `onChange(fn)` | 订阅主题变化，`fn(resolvedTheme, pref)`；返回取消订阅函数 |
| `apply()` | 手动重新应用主题到 `<html>`（一般不需要） |

平台自动维护 `<html data-theme="light|dark">`、`data-theme-pref`、`data-reduce-motion`。
CSS 使用 `game-base.css` 的变量即可自动跟随主题：

```css
.my-panel {
  background: var(--pg-surface);
  color: var(--pg-text);
}
```

Canvas 绘制场景：

```js
var colors = { light: '#fff', dark: '#111' };
function repaint() {
  ctx.fillStyle = colors[GamePlatform.theme.get()];
}
GamePlatform.theme.onChange(repaint);
```

---

## 主题外观包 `GamePlatform.themePacks`

全局**主题包（skin）系统**：与深浅模式正交——每个主题包内含 `light` / `dark` 两套配色与纹理，最终外观 = 主题包 × 深浅模式。主题包定义背景色/纹理、强调色/纹理等资源，平台自动写入 CSS 变量，游戏按需取用。

### 包结构

```js
{
  id: 'ocean',
  name: { zh: '海洋', en: 'Ocean' },
  light: {
    bg: '#eef6fb',                  // 背景色
    bgTexture: 'linear-gradient(...)', // 背景纹理 (CSS background-image 值，可 'none')
    surface: '#ffffff', surface2: '#e2f0f8',
    text: '#0f2e40', textMuted: '#4c6f85', border: '#c2dcea',
    accent: '#0e9bc9',              // 强调色
    accentTexture: 'linear-gradient(...)', // 强调色纹理 (CSS background-image 值)
    accentHover: '#0b86ad', accentSoft: 'rgba(14,155,201,0.14)',
    success: '#1a9e6f', warning: '#d9932e', danger: '#d8524f',
    backdropFilter: 'blur(20px) saturate(1.6)' // 可选：毛玻璃滤镜（液态玻璃等），默认 'none'
  },
  dark: { /* 同结构 */ }
}
```

内置包：`default`（默认）、`ocean`（海洋）、`forest`（森林）、`sunset`（日落）、`candy`（糖果）、`glass`（液态玻璃）、`mono`（极简）。

### CSS 变量（推荐用法）

平台会把激活包按当前深浅模式解析后写入 `<html>`，CSS 直接引用即可自动跟随：

| 变量 | 含义 |
|------|------|
| `--pg-bg` / `--pg-bg-image` | 背景色 / 背景纹理 |
| `--pg-surface` / `--pg-surface-2` | 面板色 / 次级面板色 |
| `--pg-text` / `--pg-text-muted` / `--pg-border` | 文字 / 弱化文字 / 边框 |
| `--pg-accent` / `--pg-accent-hover` / `--pg-accent-soft` | 强调色 / 悬停 / 弱化底色 |
| `--pg-accent-image` | 强调色纹理（按钮背景等） |
| `--pg-success` / `--pg-warning` / `--pg-danger` | 状态色 |
| `--pg-font` / `--pg-radius` / `--pg-shadow` | 字体 / 圆角 / 阴影 |
| `--pg-backdrop-filter` | 毛玻璃滤镜（液态玻璃等主题为 `blur(...)`，其余为 `none`） |

```css
.my-panel { background: var(--pg-surface); color: var(--pg-text); }
.my-btn   { background-color: var(--pg-accent); background-image: var(--pg-accent-image); }
body      { background-color: var(--pg-bg); background-image: var(--pg-bg-image); }
```

### JS API

| 方法 | 说明 |
|------|------|
| `list()` | 所有外观包 id 数组 |
| `get(id?)` | 包定义；不传 id 返回当前激活包 |
| `getActive()` | `{ id, name, mode, colors, bgTexture, accentTexture, backdropFilter, font }`（已按当前深浅模式解析） |
| `colors()` | 仅取当前已解析颜色表（canvas 取色常用） |
| `onChange(fn)` | 订阅主题包变化，`fn(activeInfo)`；返回取消订阅函数 |
| `register(pack)` | 运行时注册自定义主题包（需 `id` / `name` / `light` / `dark`） |

```js
// canvas 场景：取强调色绘制，并跟随主题包/深浅色变化重绘
function repaint() {
  var c = GamePlatform.themePacks.colors();
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = c.accent;
  ctx.fillRect(0, 0, score * 10, 20);
}
GamePlatform.themePacks.onChange(repaint);
GamePlatform.theme.onChange(repaint); // 深浅模式变化同样会触发
```

> `GamePlatform.theme.onChange` 在**深浅模式或主题包**变化时都会触发（外观变了就该重绘）；`themePacks.onChange` 只在主题包切换时触发。

---

## 国际化 `GamePlatform.i18n`

| 方法 | 说明 |
|------|------|
| `getLang()` | 当前语言 `'zh'` / `'en'` |
| `t(map, langOverride?)` | 从 `{ zh, en }` 对象取当前语言文案，缺失自动回退 |
| `onChange(fn)` | 订阅语言变化，`fn(lang)` |

```js
var TEXT = {
  zh: { start: '开始', score: '得分' },
  en: { start: 'Start', score: 'Score' }
};
function t(key) {
  return (TEXT[GamePlatform.i18n.getLang()] || TEXT.zh)[key];
}
GamePlatform.i18n.onChange(function () { renderAll(); });

// 或者一次性取文案：
GamePlatform.i18n.t({ zh: '你好', en: 'Hello' });
```

---

## UI 辅助 `GamePlatform.ui`

| 方法 | 说明 |
|------|------|
| `toast(message, durationMs?)` | 底部轻提示，默认 2200ms |
| `requestFullscreen(element?)` | 全屏，默认 `document.documentElement`，返回 Promise |
| `exitFullscreen()` | 退出全屏 |
| `isFullscreen()` | 是否全屏中 |
| `shouldReduceMotion()` | 玩家是否开启"减少动画" |
| `isSoundEnabled()` | 全局音效是否开启 |

```js
if (GamePlatform.ui.isSoundEnabled()) beep();

if (!GamePlatform.ui.shouldReduceMotion()) {
  el.classList.add('bounce');
}

GamePlatform.ui.toast('已保存');
```

---

## 事件总线 `GamePlatform.events`

游戏内部解耦用的简易发布/订阅。

```js
var off = GamePlatform.events.on('score-changed', function (data) {
  hud.update(data.score);
});
GamePlatform.events.emit('score-changed', { score: 100 });
GamePlatform.events.off('score-changed', handler); // 或调用 off()
```

> 平台自身也通过该总线派发内部事件（如 `__lang`），游戏只需用自定义事件名即可。

---

## 导航 `GamePlatform.navigate`

| 方法 | 说明 |
|------|------|
| `goHome()` | 返回平台主页 |
| `openGame(id)` | 跳转到指定游戏（`Games/<id>/index.html`） |
| `rootUrl` | 平台根地址（字符串） |

```html
<button onclick="GamePlatform.navigate.goHome()">← 返回主页</button>
```

---

## 工具 `GamePlatform.util`

| 方法 | 说明 |
|------|------|
| `clamp(n, min, max)` | 限制数值区间 |
| `randInt(min, max)` | 闭区间随机整数 |
| `shuffle(array)` | 返回打乱后的新数组（Fisher–Yates） |
| `formatNumber(n)` | 千分位格式化 |

---

## 元信息

| 属性 | 说明 |
|------|------|
| `GamePlatform.version` | 框架版本号 |
| `GamePlatform.gameId` | 当前游戏 id（从路径 `Games/<id>/` 推断），非游戏页为 `null` |
| `GamePlatform.isGamePage` | 是否运行在游戏页 |
| `GamePlatform.ready` | `Promise<GamePlatform`>，DOM 就绪且主题已应用后 resolve |

---

## 完整示例

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Game</title>
  <link rel="stylesheet" href="../../platform/game-base.css">
</head>
<body>
  <div class="pg-container">
    <div class="pg-topbar">
      <button class="pg-btn pg-btn--ghost" id="back">← 返回主页</button>
    </div>
    <div class="pg-card">
      <h1 id="title"></h1>
      <p id="best"></p>
    </div>
  </div>

  <script src="../../platform/game-api.js"></script>
  <script>
    function render() {
      document.getElementById('title').textContent =
        GamePlatform.i18n.t({ zh: '我的游戏', en: 'My Game' });
      var best = GamePlatform.storage.get('best', null);
      document.getElementById('best').textContent =
        GamePlatform.i18n.t({ zh: '最佳: ', en: 'Best: ' }) + (best == null ? '-' : best);
    }

    document.getElementById('back').onclick = function () {
      GamePlatform.navigate.goHome();
    };

    GamePlatform.ready.then(render);
    GamePlatform.settings.onChange(render);
  </script>
</body>
</html>
```
