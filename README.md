# Potato4096 Arcade 🎮

**在线游玩：[https://potato4096.github.io/](https://potato4096.github.io/)**

一个轻量的静态在线游戏平台，代码托管于公共仓库 [Potato4096/Potato4096.github.io](https://github.com/Potato4096/Potato4096.github.io)，通过 GitHub Pages 发布。设计目标：**每个游戏独立开发、独立配置，主页自动发现并展示，全局设置跨游戏共享**。

欢迎参与贡献游戏！玩法很简单：**Fork → 新建分支 → 添加游戏 → 发起 Pull Request**。

## 玩家

直接访问 [https://potato4096.github.io/](https://potato4096.github.io/) 即可，无需注册或安装任何东西。点击游戏卡片开始游玩，右上角可切换语言 / 深浅主题。

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

4. **本地测试**（需要静态服务器）：

   ```bash
   python -m http.server 8080
   # 或 npx serve .
   ```

   打开 `http://localhost:8080`，确认游戏出现在游戏库且游玩正常。

5. **提交并推送** 到你的 Fork：

   ```bash
   git add Games/my-game
   git commit -m "feat(game): add my-game"
   git push origin feat/my-game
   ```

6. 在 GitHub 上向 `Potato4096/Potato4096.github.io` 发起 **Pull Request**，简要介绍游戏玩法与操作方式。合并到 `main` 后即自动上线。

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
├── css/
│   └── style.css              # 首页样式（含深浅主题）
├── js/
│   ├── config.js              # 平台配置（名称、发现方式、GitHub 仓库信息）
│   ├── i18n.js                # 首页文案（中/英）
│   └── main.js                # 首页逻辑
├── platform/
│   ├── game-api.js            # ★ 通用游戏框架（GamePlatform API）
│   └── game-base.css          # 游戏基础样式（主题变量 / 通用组件）
├── Games/
│   ├── number-guess/          # 示例：猜数字
│   │   ├── game.json          #   游戏配置（必填）
│   │   ├── index.html         #   游戏入口（必填）
│   │   └── assets/            #   资源目录（可选）
│   └── reaction-test/         # 示例：反应力测试
└── docs/
    ├── GAME_SPEC.md           # ★ 游戏开发规范
    └── API.md                 # ★ GamePlatform API 文档
```

## 它是怎么工作的

1. **游戏发现（动态）**：主页运行时动态扫描 `Games/` 目录——线上环境通过 GitHub API 遍历仓库的 `Games/` 目录；本地开发时解析静态服务器返回的目录列表（`python -m http.server`、`npx serve` 等均支持）。**无需任何清单文件或构建步骤**，合并 PR 后游戏自动出现在游戏库。
2. **读取配置**：主页对每个游戏目录请求 `game.json`，用其中的标题、简介、标签、图标等渲染成卡片。配置损坏或缺字段的游戏会被跳过，不影响其他游戏。
3. **跳转入口**：点击卡片 → 跳转到 `Games/<id>/<entry>`（默认 `index.html`）。
4. **全局协调**：主页与所有游戏共享同一份全局设置（语言 / 深浅主题 / 减少动画 / 音效），存于 `localStorage`，跨页面、跨标签页实时同步。游戏通过 `GamePlatform` API 读取并响应变化。

## 全局设置说明

| 设置项 | 取值 | 存储键 | 游戏如何感知 |
|--------|------|--------|--------------|
| 语言 | `zh` / `en` | `p4096:settings.lang` | `GamePlatform.i18n` / `settings.onChange` |
| 深浅色 | `light` / `dark` / `system` | `p4096:settings.theme` | `<html data-theme>` + `GamePlatform.theme.onChange` |
| 主题 | 外观包 id（`default`/`ocean`/`forest`/`sunset`/`candy`/`mono`…） | `p4096:settings.skin` | `--pg-*` CSS 变量 + `GamePlatform.themePacks` |
| 减少动画 | `true` / `false` | `p4096:settings.reduceMotion` | `<html data-reduce-motion>` + `GamePlatform.ui.shouldReduceMotion()` |
| 音效 | `true` / `false` | `p4096:settings.sound` | `GamePlatform.ui.isSoundEnabled()` |

主题与深浅色是**两个正交维度**：每个主题包内含 light/dark 两套配色与纹理（背景色/纹理、强调色/纹理、面板色、状态色等），平台解析后写入 `--pg-*` CSS 变量，游戏用 CSS 变量或 `GamePlatform.themePacks.colors()` 取用即可自动跟随。详见 [docs/API.md](docs/API.md)。

设置持久化于 `localStorage`，主页设置面板可随时修改，所有已打开的游戏页面会实时响应。

## 托管说明（维护者）

站点由 GitHub Pages 自动发布：**`main` 分支即线上版本**，PR 合并后 1~2 分钟内生效（[https://potato4096.github.io/](https://potato4096.github.io/)）。

- `.nojekyll`：禁用 Jekyll 处理，纯静态资源原样发布
- `404.html`：GitHub Pages 自动用于所有错误路径（资源引用为 `/` 根绝对路径）
- `js/config.js` 的 `github.owner/repo/branch` 必须与实际仓库一致，游戏动态发现（GitHub API 通道）依赖它
- 站点内文档链接（`docs/*.md`）在 Pages 上以纯文本展示，完整渲染效果见 GitHub 仓库页面

## 文档

- [游戏开发规范](docs/GAME_SPEC.md) — 目录结构、配置文件格式、生命周期、主题适配、发布检查清单
- [GamePlatform API](docs/API.md) — 游戏内可调用的全部 API

## 声明

本项目仅供学习与娱乐，不作商业用途；游戏内容仅代表作者个人观点。如有侵权或建议，请提 [Issue](https://github.com/Potato4096/Potato4096.github.io/issues)。
