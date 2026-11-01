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
   *  - 'manifest'      读取 games.json 全局注册表（由 scripts/generate-games-json.mjs 生成）  ← 推荐
   *  - 'listing'       仅本地目录列表（需要支持目录列表的静态服务器）
   *  - 'github-api'    仅 GitHub API 遍历仓库 Games/ 目录（需仓库已推送且可访问）
   *  - 'manual'        仅 manualGames 手动指定
   *  - 'auto'          注册表优先，失败依次回退 目录列表 → GitHub API → manualGames
   */
  discoveryMode: 'manifest',

  github: {
    owner: 'Potato4096',
    repo: 'Potato4096.github.io',
    branch: 'main'
  },

  /** 手动指定游戏目录名（可选，留空则自动发现）。例: ['number-guess', 'reaction-test'] */
  manualGames: []
};
