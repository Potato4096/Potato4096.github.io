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

## 修改器 CheatKit

`platform/cheat-kit.js` 提供的共用修改器（彩蛋面板）。与 `GamePlatform` 相互独立，只依赖 `--pg-*` 变量做主题适配，可单独引入：

```html
<link rel="stylesheet" href="../../platform/game-base.css">
<link rel="stylesheet" href="../../platform/cheat-kit.css">
<script src="../../platform/game-api.js"></script>
<script src="../../platform/cheat-kit.js"></script>
```

引入后在**任意页面**连续敲入 `potato4096` 即开面板：无需聚焦输入框，棋子/画布聚焦时也算；在 `input` / `textarea` / `select` / `contenteditable` 内打字不会触发；长按（`e.repeat`）不重复计字符。字符间隔超过 700 ms 则缓冲清零（首字母 `p` 会补发一次暂停，见下）。

### 总览

```js
CheatKit = {
  init(spec),        // 注册一个修改器；重复调用先销毁旧的再重建（切棋种时用）
  detach(),          // 销毁：移除 DOM、解绑监听、清定时器 + 缓冲（SPA 卸载时必调）
  open(), close(), toggle(),
  isOpen(),          // boolean
  refresh(),         // 立即重算面板数值
  capturing(),       // boolean，面板是否展开（供游戏侧判断是否让出键盘）
  active(),          // 取子栏当前选中的子（棋盘类游戏在自己的 onClick 里用）
  hasPalette(),      // boolean，是否配置了 board.palette
  toast(text)        // 借用面板样式吐一条提示
}
```

### `spec` 字段

```js
CheatKit.init({
  id: 'brick-breaker',   // 必填，面板标识（缺失会抛错）
  dock: el,              // 可选，挂载点；缺省依次回退 .pg-container → document.body
  title: { zh, en },     // 可选，面板标题，默认「🔧 修改器」
  hint:  { zh, en },     // 可选，标题下方小字，默认「彩蛋面板 · 参数即时生效」
  stats:    [],          // 只读数值条
  params:   [],          // 可改数值（滑杆 + 数字框）
  toggles:  [],          // 开关
  actions:  [],          // 一次性按钮
  board:    null,        // 棋盘编辑区（棋类）
  onOpen, onClose        // 可选回调
});
```

面板渲染顺序固定为 `头 → 数值 → 数值改写 → 开关 → 操作 → 棋盘`，保证小屏上按钮不会被巨大的棋盘挤到下面。`label` / `title` / `hint` 均可传 `{zh, en}` 对象或纯字符串。

#### `stats[]`

| 字段 | 说明 |
|------|------|
| `label` | `{ zh, en }` 或字符串 |
| `get()` | 返回当前值（数字或字符串）；面板展开后每 500 ms 自动刷新 |
| `tone` | 可选，`'danger'` / `'success'` / `'warning'`，给数字加对应配色 |
| `format(v)` | 可选，自定义展示文本，优先级高于默认格式化 |
| `prefix` / `suffix` | 可选，拼在数值前后（如 `×`） |
| `digits` | 可选，数字保留小数位 |
| `key` | 可选，写进 `data-stat` 便于外部断言 |

#### `params[]`

| 字段 | 说明 |
|------|------|
| `label` / `get()` / `set(v)` | `set` 收到的是已 clamp 到 `[min, max]` 的 Number |
| `min` / `max` / `step` | 滑杆与数字框范围，`step` 默认 `1` |
| `digits` | 可选，数字框显示的小数位 |

拖滑杆（`input`）、松开滑杆（`change`）、改数字框（`input`）都会立即回调 `set` 并重算面板；输入框处于焦点时不会被 500 ms 轮询覆盖。

#### `toggles[]`

| 字段 | 说明 |
|------|------|
| `label` / `get()` / `set(on)` | `get` 返回布尔，`set` 收到布尔 |
| `on` / `off` | 可选，自定义开/关文案（`{zh,en}`），默认「已开启 / 已关闭」 |
| `onAfter()` | 可选，切换后执行（如重建棋盘） |

#### `actions[]`

| 字段 | 说明 |
|------|------|
| `label` / `run()` | 点击后执行 |
| `tone` | 可选，`'primary'` 实心按钮 / `'danger'` 红色危险按钮，缺省幽灵按钮 |
| `toast` | 可选，执行完后弹出的提示文案（`{zh,en}`） |

#### `board`（棋盘取子栏）

棋盘类游戏**不画第二块棋盘**：面板只提供一排"取子"按钮，玩家选好子后直接点游戏原来的棋盘落子。

```js
board: {
  title: { zh: '取子：选一个子，然后点原棋盘落子', en: 'Pick a piece, then tap the real board' },
  tip: { zh: '选「空」后点格子 = 清空该格。', en: 'Pick "Empty" and tap to clear a square.' },
  // 色板。value 会原样交给 CheatKit.active()，''/null 表示清空
  palette: [
    { value: '',    label: { zh: '空', en: 'Empty' },  swatch: '#0000' },
    { value: 'w:Q', label: { zh: '♕ 白后', en: '♕ White Q' }, swatch: '#f2efe6' }
  ],
  // 可选：取子栏下方的整盘操作（清空棋盘、恢复开局……）
  actions: [{ label: { zh: '清空棋盘', en: 'Clear board' }, run: fn, toast: { zh, en } }]
}
```

配套的取值/落子由游戏自己完成，公共层不碰棋盘数据：

```js
// games/<id>/js/view.js 的 onClick
function onClick(e) {
  if (cheatGod && global.CheatKit && global.CheatKit.hasPalette()) {
    var sq = pointToCell(e.clientX, e.clientY);      // 游戏自己的坐标换算
    if (sq) cheatSetPiece(sq.y, sq.x, global.CheatKit.active());
    return;                                          // 跳过正常走子/轮次/规则判定
  }
  // …正常对局逻辑
}
```

- `active()` 返回色板选中项的 `value`；首个色板项默认选中，面板重建时尽量保留上次选择
- 上位摆子会留下非法局面，所以棋类在 `cheatSetPiece` 里顺手清掉 `castling` / `ep` / `ko` 这类历史缓存，并在 `scheduleAi()` 里用 `cheatGod` 短路 AI
- 建议同时给原棋盘加视觉提示（本仓库用 `.bg-board.is-god`：虚线描边 + `cursor: crosshair`），玩家才知道"现在可以直接点"

### 生命周期

```js
// 挂载（通常在脚本末尾）
if (window.CheatKit) CheatKit.init({ /* spec */ });

// 卸载（SPA 内切换视图时必调，否则监听与 DOM 会残留）
if (global.CheatKit) CheatKit.detach();
```

`detach()` 会移除面板节点、解绑 capture 阶段键盘监听、清理刷新定时器与暗号缓冲；之后再 `init` 是干净的重新挂载（棋类合集切棋种就靠这一对）。

### 注意事项

- 暗号检测是 **capture 阶段** 的 `keydown`，命中前缀时会 `preventDefault + stopPropagation`。若游戏用 `p` 做暂停，首个被吞掉的 `p` 会在序列中断或超时后**自动补发**一次 `keydown`，手感不受影响
- 页面若**自动聚焦输入框**（如猜数字），字符会进到 `input` 里而进不了暗号缓冲 —— 这类页面需要自己额外挂一层键盘监听转发首字母
- 修改器只改运行时状态，不写存档；重开一局即恢复
- `refresh()` 不重建 DOM（只改文本/样式），所以行数、色板、按钮数量变化后要重新 `init`

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
