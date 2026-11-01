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
//   theme: 'system',     // 'light' | 'dark' | 'system'
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
