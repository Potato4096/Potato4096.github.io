/**
 * Potato4096 Arcade - 平台级配置
 * 部署到 GitHub Pages 后可按需修改
 */
window.PLATFORM_CONFIG = {
  name: 'Potato4096 Arcade',
  tagline: {
    zh: '简单 · 通用 · 即点即玩',
    en: 'Simple · Universal · Instant Play'
  },

  /**
   * 游戏发现方式:
   *  - 'manifest'      读取 games.json 清单 (由 scripts/generate-games-json.mjs 生成)
   *  - 'github-api'    通过 GitHub API 遍历仓库 Games/ 目录 (仅部署到 GitHub Pages 时可用)
   *  - 'auto'          先读清单，失败时回退 GitHub API  ← 推荐
   */
  discoveryMode: 'auto',

  github: {
    owner: 'Potato4096',
    repo: 'Potato4096.github.io',
    branch: 'main'
  },

  /** 手动指定游戏目录名（可选，留空则自动发现）。例: ['number-guess', 'reaction-test'] */
  manualGames: []
};
