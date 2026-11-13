# Potato4096 Arcade 🎮

**在线游玩：[https://potato4096.github.io/](https://potato4096.github.io/)**

一个轻量的静态在线游戏平台，代码托管于公共仓库 [Potato4096/Potato4096.github.io](https://github.com/Potato4096/Potato4096.github.io)，通过 GitHub Pages 发布。设计目标：**每个游戏独立开发、独立配置，主页自动发现并展示，全局设置跨游戏共享**。

欢迎参与贡献游戏！玩法很简单：**Fork → 新建分支 → 添加游戏 → 发起 Pull Request**。

## 玩家

直接访问 [https://potato4096.github.io/](https://potato4096.github.io/) 即可，无需注册或安装任何东西。点击游戏卡片开始游玩，右上角可切换语言 / 深浅主题。

## 游戏库

| 游戏 | 类型 | 简介 |
|------|------|------|
| ♟ 棋类合集 | 策略 | 国际象棋 / 中国象棋 / 五子棋 / 围棋，一个入口，双人对弈或人机三档 |
| 🃏 斗地主 | 策略 | 三人叫分抢地主，含记牌器、托管与完整牌型判定 |
| 🏝️ 海岛奇兵 | 策略 | 经营岛屿、招募士兵、抵御红军反扑 |
| 👾 竞技场幸存者 | 动作 | 自动攻击 + 走位躲怪，撑过一波又一波 |
| ⭐ 超级跳跃 | 动作 | 横版跳跃闯关，踩敌人、吃金币、冲旗杆 |
| 🧱 弹球打砖块 | 街机 | 弹球击碎砖块，道具掉落小球分身 / 加宽 / 加命 |
| 🏓 乒乓球 | 体育 | 对战 AI 的球拍对决，先得 7 分者胜 |
| ⚽ 足球射门 | 体育 | 手环式弹射：向后拉球松手射出，球速恒定撞边反弹，单球门每脚随机换位 |
| 🔢 2048 | 益智 | 滑动合并数字，合成 2048，支持撤销一步 |
| 🧩 数字华容道 | 益智 | 3×3 / 4×4 / 5×5 数字推盘，计时计步挑战最佳 |
| 💣 扫雷 | 益智 | 经典扫雷，三档难度、快速展开与插旗 |
| 🎣 钓鱼 | 休闲 | 抛竿、咬钩、拉杆对抗，稀有鱼卖出好价钱 |
| ⚡ 反应力测试 | 休闲 | 看到变绿就点，测你的极限反应速度 |
| 🔢 猜数字 | 休闲 | 1~100 猜数，自动冷热提示，破纪录 |

每个游戏都支持中英双语、深浅主题、音效开关、减少动画，并内置 `potato4096` 彩蛋修改器（详见下文）。

## 贡献游戏（Fork + Pull Request）

### 流程

1. **Fork** 本仓库到你自己的 GitHub 账号。
2. **克隆你的 Fork** 并创建功能分支（不要直接在 `main` 上开发）：

   ```bash
   git clone https://github.com/<你的用户名>/Potato4096.github.io.git
   cd Potato4096.github.io
   git checkout -b feat/my-game
   ```

3. **添加游戏**：在 `Games/` 下新建目录（只动你自己的目录，不影响其他游戏），放入 `game.json` 和 `index.html`：

   ```
   Games/my-game/
   ├── game.json      # 游戏配置（必填，格式见 GAME_SPEC.md）
   ├── index.html     # 游戏入口（必填）
   └── assets/        # 资源（可选）
   ```

   入口页面引入平台框架并调用 API（详见 [docs/API.md](docs/API.md)）：

   ```html
   <link rel="stylesheet" href="../../platform/game-base.css">
   <script src="../../platform/game-api.js"></script>
   <script>
     GamePlatform.ready.then(function () {
       // 读取全局语言/主题、存档等
     });
   </script>
   ```

   开发前请完整阅读 **[docs/GAME_SPEC.md](docs/GAME_SPEC.md)**（目录与配置规范、主题适配要求、发布检查清单）。

4. **更新游戏注册表**：

   ```bash
   node scripts/generate-games-json.mjs
   ```

   该脚本会扫描 `Games/` 目录并校验各游戏的 `game.json`，重新生成 `games.json` 全局注册表（主页据此展示游戏）。

5. **本地测试**（需要静态服务器）：

   ```bash
   python -m http.server 8080
   # 或 npx serve .
   ```

   打开 `http://localhost:8080`，确认游戏出现在游戏库且游玩正常。

6. **提交并推送** 到你的 Fork：

   ```bash
   git add Games/my-game games.json
   git commit -m "feat(game): add my-game"
   git push origin feat/my-game
   ```

7. 在 GitHub 上向 `Potato4096/Potato4096.github.io` 发起 **Pull Request**，简要介绍游戏玩法与操作方式。合并到 `main` 后即自动上线。

### PR 要求

- 遵守 [docs/GAME_SPEC.md](docs/GAME_SPEC.md) 的规范与发布检查清单
- 一个 PR 专注一件事（一个游戏 / 一个修复），方便评审
- 除新增自己的游戏目录外，不改动平台公共文件；确需改动请在 PR 说明理由
- 控制台无报错，深浅主题、中英文切换正常

## 目录结构

```
Potato4096.github.io/
├── index.html                 # 平台首页（游戏发现 + 全局设置）
├── 404.html                   # GitHub Pages 错误页（自动生效）
├── .nojekyll                  # 禁用 Jekyll，纯静态发布
├── games.json                 # ★ 游戏全局注册表（脚本生成，随游戏一并提交）
├── css/
│   └── style.css              # 首页样式（含深浅主题）
├── js/
│   ├── i18n.js                # 首页文案（中/英）
│   └── main.js                # 首页逻辑
├── platform/
│   ├── game-api.js            # ★ 通用游戏框架（GamePlatform API）
│   ├── game-base.css          # 游戏基础样式（主题变量 / 通用组件）
│   ├── cheat-kit.js           # ★ 修改器面板（共用触发、数值编辑、棋盘上帝模式）
│   └── cheat-kit.css          # 修改器样式（只使用 --pg-* 变量，随主题适配）
├── Games/
│   └── number-guess/          # 示例：猜数字
│       ├── game.json          #   游戏配置（必填）
│       ├── index.html         #   游戏入口（必填）
│       ├── css/style.css      #   游戏私有样式（只用 --pg-* 变量）
│       └── js/
│           ├── audio.js       #   WebAudio 合成音效
│           └── game.js        #   游戏逻辑（IIFE）
├── scripts/
│   └── generate-games-json.mjs # 游戏注册表生成脚本
└── docs/
    ├── GAME_SPEC.md           # ★ 游戏开发规范
    └── API.md                 # ★ GamePlatform API 文档
```

### 棋类合集（`Games/board-games/`）

国际象棋、中国象棋、五子棋、围棋合并为一个入口：大厅选棋种与模式（双人 / 人机三档），共用一套对局外壳。

```
Games/board-games/
├── index.html          # 单页外壳：大厅 + 对局容器
├── game.json
├── js/
│   ├── catalog.js      # 四个棋种的元数据（卡片、图标、AI 执何方）
│   ├── main.js         # 大厅渲染、hash 路由（#/<id>/<pvp|ai>/<难度>）、懒加载与卸载
│   ├── core/           # 共享层：i18n · sfx · canvas · storage · 对局外壳 shell
│   └── games/<id>/     # rules.js · ai.js · view.js（view 只填棋盘与交互）
└── css/                # lobby.css 大厅 · shell.css 对局外壳
```

新增棋种只需在 `catalog.js` 追加一项，并提供 `games/<id>/js/{rules,ai,view}.js`；`view.js` 在末尾调用 `BG.registerGame(id, { mount, unmount })`。共享层负责顶栏、状态条、侧栏、棋谱、双语与主题，棋种只实现规则、AI 与棋盘绘制。

**刷新不丢棋盘**：四个棋种都会把当前对局存进浏览器缓存（`bg:<棋种>:session`），F5 或关掉页面再进来会接着下，并提示「已恢复上次对局」。存档含局面、棋谱、悔棋栈与手数状态，所以刷新后照样能悔棋；只在同一模式/难度下续盘，点「重新开始」即清空存档，"清除记录"只清战绩、留着当前这盘；上帝模式摆的子也会入档。

## 修改器（彩蛋）

任意游戏页面里连续敲入 **`potato4096`**（不用点输入框，棋子/画布聚焦时也算），左下角会滑出该游戏的修改器面板：

> **手机 / 平板（无物理键盘）**：改用两种手势，效果与打暗号完全一致——**三指同时轻点屏幕**（1 秒内松开），或**长按页面顶部 1.5 秒**（顶部 96px 区域，手指滑动超过 12px 则取消，不会误触）。

- **数值面板**：实时显示当前局势的关键数值（分数、生命、关卡、子力差、地主倍数……），带渐变发光条，一眼看穿
- **数值改写**：滑杆 / 数字框直接改分数、生命、重力、底分等，回车或拖动即刻生效
- **开关**：无敌、透视、免资源等作弊态
- **一键操作**：直接通关、补满资源、发王炸……
- **棋盘上帝模式**：棋类游戏开启上帝模式后，面板里才会展开取子栏（白后 / 红车 / 黑子…），**直接点原棋盘**就落子，选「空」再点就把子拿走。原棋盘会闪一圈虚线描边并换成准星光标；上帝模式期间整局冻结（走子/AI/悔棋全停），关掉上帝模式后从当前局面继续对局，取子栏整栏收起

敲入时若首字母 `p` 被游戏自身的暂停键吞掉，`CheatKit` 会把这次暂停补发回去，不会把手感搞坏。再敲一次口令或点面板右上角 × 即可关闭。

实现上，`platform/cheat-kit.js` 是一层与游戏无关的公共组件；各游戏只需在脚本末尾用闭包把自己的私有状态接进去（详见 [docs/API.md](docs/API.md#修改器-cheatkit)）：

```js
if (window.CheatKit) {
  CheatKit.init({
    id: 'brick-breaker',                 // 存储与 DOM 前缀
    dock: document.querySelector('.pg-container'),
    title: { zh: '修改器', en: 'Modifier' },
    stats: [{ label: { zh: '得分', en: 'Score' }, get: function () { return score; } }],
    params: [{ label: { zh: '生命', en: 'Lives' }, min: 1, max: 99, get: ..., set: ... }],
    toggles: [{ label: { zh: '无敌', en: 'God mode' }, get: ..., set: ... }],
    actions: [{ label: { zh: '一击通关', en: 'Instant win' }, run: ... }],
    board: { /* 可选：palette 取子栏，落子由游戏在原棋盘上处理 */ }
  });
}
```

棋盘类游戏在 `board` 里只声明"能拿哪些子"，落子逻辑仍留在游戏自己的点击处理里：

```js
// 游戏 onClick 里
if (cheatGod && CheatKit.hasPalette()) {
  var sq = pointToCell(e.clientX, e.clientY);
  if (sq) cheatSetPiece(sq.y, sq.x, CheatKit.active());   // active() = 当前选中的子
  return;
}
```

游戏若运行在会切换视图的外壳里（如棋类合集），`unmount()` 里调用 `CheatKit.detach()` 即可摘干净监听与 DOM，避免重复挂载。

### 画布为什么是清晰的

canvas 不能把固定缓冲区交给 CSS 拉伸。早先棋盘按 576×576 分配缓冲、CSS 又拉到 678～842 px，等于整块画面被放大 1.2～1.5 倍，线条和文字都会发虚、边缘出现锯齿。现在统一在每帧把缓冲区设为 **实际显示尺寸 × devicePixelRatio** 再缩放绘制坐标系，屏幕像素 1:1（高分屏 2:1），绘制代码一行不用改。写法见 `Games/board-games/js/core/canvas.js` 与 [docs/GAME_SPEC.md](docs/GAME_SPEC.md) 的「画布游戏的清晰渲染」。

## 它是怎么工作的

1. **游戏发现（注册表）**：主页读取 `games.json` 全局注册表拿到游戏列表。注册表由 `node scripts/generate-games-json.mjs` 生成——脚本扫描 `Games/` 目录、校验各游戏的 `game.json` 后输出清单。**无需构建步骤**，新增游戏后重新运行脚本并提交 `games.json` 即可。
2. **读取配置**：主页对每个游戏目录请求 `game.json`，用其中的标题、简介、标签、图标等渲染成卡片。配置损坏或缺字段的游戏会被跳过，不影响其他游戏。
3. **跳转入口**：点击卡片 → 跳转到 `Games/<id>/<entry>`（默认 `index.html`）。
4. **全局协调**：主页与所有游戏共享同一份全局设置（语言 / 深浅主题 / 减少动画 / 音效），存于 `localStorage`，跨页面、跨标签页实时同步。游戏通过 `GamePlatform` API 读取并响应变化。

## 全局设置说明

| 设置项 | 取值 | 存储键 | 游戏如何感知 |
|--------|------|--------|--------------|
| 语言 | `zh` / `en` | `p4096:settings.lang` | `GamePlatform.i18n` / `settings.onChange` |
| 深浅色 | `light` / `dark` / `system` | `p4096:settings.theme` | `<html data-theme>` + `GamePlatform.theme.onChange` |
| 主题 | 外观包 id（`default`/`ocean`/`forest`/`sunset`/`candy`/`glass`/`mono`…） | `p4096:settings.skin` | `--pg-*` CSS 变量 + `GamePlatform.themePacks` |
| 减少动画 | `true` / `false` | `p4096:settings.reduceMotion` | `<html data-reduce-motion>` + `GamePlatform.ui.shouldReduceMotion()` |
| 音效 | `true` / `false` | `p4096:settings.sound` | `GamePlatform.ui.isSoundEnabled()` |

主题与深浅色是**两个正交维度**：每个主题包内含 light/dark 两套配色与纹理（背景色/纹理、强调色/纹理、面板色、状态色等），平台解析后写入 `--pg-*` CSS 变量，游戏用 CSS 变量或 `GamePlatform.themePacks.colors()` 取用即可自动跟随。详见 [docs/API.md](docs/API.md)。

设置持久化于 `localStorage`，主页设置面板可随时修改，所有已打开的游戏页面会实时响应。

## 托管说明（维护者）

站点由 GitHub Pages 自动发布：**`main` 分支即线上版本**，PR 合并后 1~2 分钟内生效（[https://potato4096.github.io/](https://potato4096.github.io/)）。

- `.nojekyll`：禁用 Jekyll 处理，纯静态资源原样发布
- `404.html`：GitHub Pages 自动用于所有错误路径（资源引用为 `/` 根绝对路径）
- 合并新增游戏的 PR 后，确认 `games.json` 注册表已包含该游戏（PR 中应同时提交）
- 站点内文档链接（`docs/*.md`）在 Pages 上以纯文本展示，完整渲染效果见 GitHub 仓库页面

## 文档

- [游戏开发规范](docs/GAME_SPEC.md) — 目录结构、配置文件格式、生命周期、主题适配、发布检查清单
- [GamePlatform API](docs/API.md) — 游戏内可调用的全部 API

## 声明

本项目仅供学习与娱乐，不作商业用途；游戏内容仅代表作者个人观点。如有侵权或建议，请提 [Issue](https://github.com/Potato4096/Potato4096.github.io/issues)。
