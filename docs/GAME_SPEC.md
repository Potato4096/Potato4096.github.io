# 游戏开发规范 (Game Dev Spec) v1.0

本规范定义了 Potato4096 Arcade 平台下游戏的目录结构、配置格式、运行约定与 API 使用边界。**任何进入 `Games/` 目录的游戏都必须遵守本规范**。

---

## 1. 核心原则

1. **独立自治**：每个游戏是独立目录，自带入口、资源与配置，不依赖其他游戏的任何文件。
2. **配置驱动**：主页只读 `game.json` 渲染游戏卡片；游戏的一切平台侧元信息都写进配置文件，不在主页硬编码。
3. **全局协调**：语言、主题等全局设置由平台管理，游戏通过 `GamePlatform` API 读取并响应，不自行实现持久化设置。
4. **纯静态**：游戏必须是纯静态资源（HTML/CSS/JS/图片/音频），不依赖服务端；直接打开 `index.html` 即可运行。

---

## 2. 目录结构

```
Games/<game-id>/
├── game.json        # 必填。游戏配置文件
├── index.html       # 必填。游戏入口（文件名由 game.json 的 entry 指定）
├── assets/          # 推荐。图片、音频、字体等资源
├── css/             # 可选。游戏私有样式
└── js/              # 可选。游戏私有脚本
```

**命名规则（game-id / 目录名）**：

- 只使用小写字母、数字和连字符：`[a-z0-9-]+`
- 长度 2 ~ 40，如 `number-guess`、`snake-deluxe`
- 目录名必须与 `game.json` 的 `id` 字段一致

---

## 3. 配置文件 `game.json`

游戏的"身份证"。主页读取它渲染卡片。完整字段如下：

```json
{
  "id": "number-guess",
  "title": { "zh": "猜数字", "en": "Number Guess" },
  "description": {
    "zh": "经典猜数字游戏……",
    "en": "Classic number guessing……"
  },
  "version": "1.0.0",
  "author": "Potato4096",
  "entry": "index.html",
  "icon": "assets/icon.svg",
  "emoji": "🔢",
  "tags": ["puzzle", "singleplayer"],
  "category": "casual",
  "players": 1,
  "controls": { "zh": "鼠标点击", "en": "Mouse click" },
  "api": ["settings", "storage", "i18n"],
  "published": true,
  "created": "2026-11-01",
  "updated": "2026-11-01"
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 游戏唯一标识，必须与目录名一致 |
| `title` | object \| string | ✅ | 标题。推荐 `{ "zh": "...", "en": "..." }` 双语对象 |
| `description` | object \| string | ✅ | 简介，1~3 句话。同样推荐双语对象 |
| `version` | string | ✅ | 语义化版本 `x.y.z` |
| `entry` | string | ✅ | 入口文件，相对游戏目录。惯例为 `index.html` |
| `author` | string |  | 作者 |
| `icon` | string |  | 图标路径（相对游戏目录）。建议 128×128 或更大，svg/png |
| `emoji` | string |  | 无图标时的兜底表情符号 |
| `tags` | string[] |  | 标签，小写英文单词，最多 5 个 |
| `category` | string |  | 分类：`casual` / `puzzle` / `action` / `arcade` / `strategy` / `demo` |
| `players` | number \| string |  | 人数或描述，如 `1`、`"1-2"` |
| `controls` | object \| string |  | 操作说明（双语） |
| `api` | string[] |  | 声明用到的 GamePlatform 能力，便于审查。见 §6 |
| `published` | boolean |  | `false` 时主页隐藏不展示（注册表仍收录）。默认 `true` |
| `created` / `updated` | string |  | 日期 `YYYY-MM-DD` |

**双语字段规则**：`title` / `description` / `controls` 支持两种写法——

```json
"title": "纯字符串（两种语言共用）"
"title": { "zh": "中文", "en": "English" }
```

缺少当前语言时回退 `zh` → `en` → 任意首个值。

**发现与校验**：主页通过 `games.json` 全局注册表获取游戏列表（运行 `node scripts/generate-games-json.mjs` 生成，脚本会扫描 `Games/` 目录并校验各游戏的 `game.json`）。解析失败或缺少必填字段的游戏会被**静默跳过**，不影响其他游戏展示；终端与控制台会打印跳过原因。

---

## 4. 入口页面约定

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Game · Potato4096 Arcade</title>
  <!-- 引入平台基础样式：主题变量 + 通用组件 + toast -->
  <link rel="stylesheet" href="../../platform/game-base.css">
</head>
<body>
  <!-- 游戏内容 -->

  <script src="../../platform/game-api.js"></script>
  <script>
    // 1. 等待平台就绪
    GamePlatform.ready.then(function () {
      // 2. 读取全局设置并开始游戏
      startGame();
    });

    // 3. 响应全局设置变化（玩家在其他标签页改了主题/语言）
    GamePlatform.settings.onChange(function (settings, keys) {
      if (keys.indexOf('lang') !== -1) retranslate();
    });
  </script>
</body>
</html>
```

要点：

- 引入路径为 `../../platform/game-api.js`（深度固定为 `Games/<id>/`，两级上级即站点根）
- **必须**使用 `GamePlatform.ready` 后再读取设置 / 应用文本
- 入口页不要用 `<frameset>` / 跳转中转页；保持单页直达
- 提供"返回主页"按钮，调用 `GamePlatform.navigate.goHome()`

---

## 5. 主题与语言适配（必做）

平台的外观由两个正交维度决定：**深浅模式**（light/dark/system）× **主题外观包**（skin，每个包含深浅两套配色与纹理）。平台会自动把解析结果应用到页面：

| 载体 | 内容 | 含义 |
|------|------|------|
| `<html data-theme>` | `light` / `dark` | **已解析**的深浅模式（`system` 会被解析为具体值） |
| `<html data-theme-pref>` | `light` / `dark` / `system` | 深浅偏好原始值 |
| `<html data-skin>` | 如 `ocean` | 当前主题外观包 id |
| `<html data-lang>` | `zh` / `en` | 当前语言 |
| `<html data-reduce-motion>` | `1` 或移除 | 减少动画 |
| CSS 变量 `--pg-*` | 颜色/纹理/字体等 | 当前主题包 × 深浅模式解析后的资源 |

**游戏必须遵守**：

1. 颜色、纹理一律使用 `game-base.css` 语义化 CSS 变量（`--pg-bg` / `--pg-bg-image` / `--pg-text` / `--pg-accent` / `--pg-accent-image` / `--pg-surface` …），不要硬编码色值。这样任意主题包 + 深浅模式自动适配。
2. 需要 JS 取色时（如 canvas 绘制、内联样式），用 `GamePlatform.themePacks.colors()` / `getActive()` 获取背景色、背景纹理、强调色、强调色纹理等资源，并订阅 `GamePlatform.themePacks.onChange`（主题包变化）与 `GamePlatform.theme.onChange`（深浅或主题包变化）重绘。
3. 所有面向用户的文本提供中英双语，通过 `GamePlatform.i18n.t({ zh, en })` 取值，并监听 `GamePlatform.settings.onChange` 重渲染。
4. 动画尊重减少动画设置：用 CSS 变量过渡即可被 `game-base.css` 自动压制；JS 动画请检查 `GamePlatform.ui.shouldReduceMotion()`。
5. 音效尊重 `GamePlatform.ui.isSoundEnabled()`，关闭时不播放声音。

### 主题外观包资源清单

每个主题包（`light`/`dark` 各一套）定义：

- **背景**：`bg` 背景色、`bgTexture` 背景纹理（CSS `background-image` 值，渐变/图案/`none`）
- **强调**：`accent` 强调色、`accentTexture` 强调纹理、`accentHover`、`accentSoft`
- **面板**：`surface`、`surface2`
- **文字/边框**：`text`、`textMuted`、`border`
- **状态色**：`success`、`warning`、`danger`

完整结构与 API 见 [API.md](API.md#主题外观包-gameplatformthemepacks)。游戏也可用 `GamePlatform.themePacks.register()` 注册临时自定义包（一般仅特殊场景使用）。

---

## 6. API 使用声明

`game.json` 的 `api` 数组声明游戏用到的平台能力，取值：

| 值 | 对应 API |
|----|----------|
| `settings` | `GamePlatform.settings.*` |
| `storage` | `GamePlatform.storage.*` |
| `i18n` | `GamePlatform.i18n.*` |
| `theme` | `GamePlatform.theme.*` |
| `themePacks` | `GamePlatform.themePacks.*` |
| `toast` | `GamePlatform.ui.toast` |
| `fullscreen` | `GamePlatform.ui.requestFullscreen` 等 |
| `sound` | `GamePlatform.ui.isSoundEnabled` |
| `reduceMotion` | `GamePlatform.ui.shouldReduceMotion` |
| `events` | `GamePlatform.events.*` |
| `navigate` | `GamePlatform.navigate.*` |

这不影响运行，纯粹用于文档与审查。

---

## 7. 资源规范

- 所有资源放在游戏目录内，**禁止**引用其他游戏目录或平台目录下的私有文件（`platform/` 公共文件除外）
- 图片：优先 SVG / WebP / PNG；单张不超过 500KB；提供 `assets/` 子目录
- 音频：优先 WebAudio 程序合成（如示例所示）；文件音频用 `.mp3` / `.ogg`，单个不超过 1MB
- 体积：整个游戏目录建议 < 5MB
- 文件名使用小写英文 + 连字符，避免中文/空格文件名

---

## 8. 存档与数据

- 游戏进度、最高分等一律使用 `GamePlatform.storage`（自动按游戏 id 隔离，前缀 `p4096:game:<id>:`）
- **禁止**直接写 `localStorage` 其他键，禁止写 `p4096:settings`（那是全局设置）
- 存档值使用 JSON 可序列化结构；提供"清除记录"入口调用 `GamePlatform.storage.clear()`
- 数据格式变化时通过 `version` 字段自行迁移

---

## 9. 发布检查清单

- [ ] 目录名与 `game.json` 的 `id` 一致，符合 `[a-z0-9-]+`
- [ ] `game.json` 必填字段齐全，双语文案无错别字
- [ ] 入口文件存在且可独立打开运行
- [ ] 已运行 `node scripts/generate-games-json.mjs` 更新注册表，`games.json` 随游戏一并提交
- [ ] 刷新主页确认游戏已出现在游戏库
- [ ] 各主题外观包（含深浅两套配色）下均可正常游玩，无硬编码颜色
- [ ] 深色 / 浅色模式下均可正常游玩，无硬编码颜色
- [ ] 中 / 英文切换正常
- [ ] 减少动画开启时无大幅动效
- [ ] 音效开关生效
- [ ] 存档使用 `GamePlatform.storage`，清除记录功能正常
- [ ] 有"返回主页"按钮
- [ ] 控制台无报错
- [ ] `api` 字段声明完整

---

## 10. 版本演进

- 本规范当前版本 **v1.0**，与 `platform/game-api.js` 的 `GamePlatform.version` 同步演进
- 新增 API 一律向后兼容；破坏性变更会提升主版本号并在此文档标注迁移说明
