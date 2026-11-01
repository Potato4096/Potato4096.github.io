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
   * 游戏发现方式（运行时动态扫描 Games/ 目录，无需静态清单文件）:
   *  - 'auto'        优先本地目录列表（本地开发），失败回退 GitHub API（GitHub Pages）  ← 推荐
   *  - 'listing'     仅本地目录列表（需要支持目录列表的静态服务器）
   *  - 'github-api'  仅 GitHub API 遍历仓库 Games/ 目录（需仓库已推送且可访问）
   *  - 'manual'      仅 manualGames 手动指定
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
