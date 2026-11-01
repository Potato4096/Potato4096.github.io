# Potato4096 Arcade 🎮

一个轻量的静态在线游戏平台（项目起草阶段）。设计目标：**每个游戏独立开发、独立配置，主页自动发现并展示，全局设置跨游戏共享**。

## 快速开始

```bash
# 本地预览（推荐用静态服务器，fetch 需要 http 环境）
cd Potato4096.github.io
npx serve .
# 或
python -m http.server 8080
```

打开浏览器访问 `http://localhost:3000`（或 8080）。

## 目录结构

```
Potato4096.github.io/
├── index.html                 # 平台首页（游戏发现 + 全局设置）
├── 404.html                   # GitHub Pages 错误页（自动生效）
├── .nojekyll                  # 禁用 Jekyll，纯静态发布
├── games.json                 # 游戏清单（脚本生成，勿手改）
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
├── scripts/
│   └── generate-games-json.mjs # 游戏清单生成脚本
└── docs/
    ├── GAME_SPEC.md           # ★ 游戏开发规范
    └── API.md                 # ★ GamePlatform API 文档
```

## 它是怎么工作的

1. **游戏发现**：主页读取 `games.json` 清单拿到游戏目录列表；部署到 GitHub Pages 后即使清单缺失，也会自动回退到 GitHub API 遍历 `Games/` 目录（见 `js/config.js` 的 `discoveryMode`）。
2. **读取配置**：主页对每个游戏目录请求 `game.json`，用其中的标题、简介、标签、图标等渲染成卡片。
3. **跳转入口**：点击卡片 → 跳转到 `Games/<id>/<entry>`（默认 `index.html`）。
4. **全局协调**：主页与所有游戏共享同一份全局设置（语言 / 深浅主题 / 减少动画 / 音效），存于 `localStorage`，跨页面、跨标签页实时同步。游戏通过 `GamePlatform` API 读取并响应变化。

## 添加一个新游戏（3 步）

1. 在 `Games/` 下新建目录，例如 `Games/my-game/`，放入 `game.json` 和 `index.html`（详见 [docs/GAME_SPEC.md](docs/GAME_SPEC.md)）。
2. 在游戏页面中引入框架并调用 API（详见 [docs/API.md](docs/API.md)）：

   ```html
   <link rel="stylesheet" href="../../platform/game-base.css">
   <script src="../../platform/game-api.js"></script>
   <script>
     GamePlatform.ready.then(function () {
       console.log('当前语言:', GamePlatform.settings.get('lang'));
     });
   </script>
   ```

3. 重新生成游戏清单：

   ```bash
   node scripts/generate-games-json.mjs
   ```

## 部署到 GitHub Pages

本仓库名 `Potato4096.github.io` 是 GitHub 的**用户主页站点**命名，推送后无需额外构建即可托管。

### 1. 创建仓库并推送

```bash
cd Potato4096.github.io
git add -A
git commit -m "feat: Potato4096 Arcade platform"
git branch -M main
git remote add origin https://github.com/Potato4096/Potato4096.github.io.git
git push -u origin main
```

> 仓库必须是 **Public**（Private 仓库需要 GitHub Pro 才能用 Pages）。

### 2. 开启 Pages

仓库 **Settings → Pages → Build and deployment**：

- Source: `Deploy from a branch`
- Branch: `main` / `(root)`

保存后等待 1~2 分钟，站点地址：`https://potato4096.github.io/`

### 3. 托管相关约定

- 根目录已放置 `.nojekyll`：禁用 Jekyll 处理，保证纯静态资源原样发布（避免 markdown/下划线目录被转换或忽略）。
- 根目录的 `404.html` 会被 GitHub Pages 自动用于所有错误路径，其中资源引用使用 `/` 根绝对路径（因为 404 会挂在任意深度的 URL 上）。
- `js/config.js` 中 `github.owner/repo/branch` 需与实际仓库一致，"游戏列表自动遍历"的 GitHub API 回退通道依赖它。
- 推送前记得运行 `node scripts/generate-games-json.mjs`，把最新游戏清单一并提交。
- 站点内文档链接（`docs/*.md`）在 Pages 上以纯文本展示；完整渲染效果可在 GitHub 仓库页面查看。

## 全局设置说明

| 设置项 | 取值 | 存储键 | 游戏如何感知 |
|--------|------|--------|--------------|
| 语言 | `zh` / `en` | `p4096:settings.lang` | `GamePlatform.i18n` / `settings.onChange` |
| 主题 | `light` / `dark` / `system` | `p4096:settings.theme` | `<html data-theme>` + `GamePlatform.theme.onChange` |
| 减少动画 | `true` / `false` | `p4096:settings.reduceMotion` | `<html data-reduce-motion>` + `GamePlatform.ui.shouldReduceMotion()` |
| 音效 | `true` / `false` | `p4096:settings.sound` | `GamePlatform.ui.isSoundEnabled()` |

设置持久化于 `localStorage`，主页设置面板可随时修改，所有已打开的游戏页面会实时响应。

## 文档

- [游戏开发规范](docs/GAME_SPEC.md) — 目录结构、配置文件格式、生命周期、主题适配、发布检查清单
- [GamePlatform API](docs/API.md) — 游戏内可调用的全部 API
