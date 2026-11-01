/**
 * 扫描 Games/ 目录，校验各游戏 game.json，生成 games.json 全局注册表。
 * 用法: node scripts/generate-games-json.mjs
 * 新增/删除游戏后运行一次，把 games.json 一并提交即可。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gamesDir = join(root, 'Games');

const REQUIRED = ['id', 'title', 'description', 'entry', 'version'];
const games = [];

for (const name of readdirSync(gamesDir, { withFileTypes: true })) {
  if (!name.isDirectory()) continue;
  const dir = 'Games/' + name.name;
  const cfgPath = join(gamesDir, name.name, 'game.json');

  if (!existsSync(cfgPath)) {
    console.warn(`[skip] ${name.name}: 缺少 game.json`);
    continue;
  }

  let cfg;
  try {
    cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  } catch (e) {
    console.warn(`[skip] ${name.name}: game.json 解析失败 - ${e.message}`);
    continue;
  }

  const missing = REQUIRED.filter((k) => cfg[k] == null || cfg[k] === '');
  if (missing.length) {
    console.warn(`[skip] ${name.name}: 缺少必填字段 ${missing.join(', ')}`);
    continue;
  }

  const entryPath = join(gamesDir, name.name, cfg.entry);
  if (!existsSync(entryPath)) {
    console.warn(`[skip] ${name.name}: 入口文件不存在 (${cfg.entry})`);
    continue;
  }

  games.push({ id: cfg.id, dir });
  console.log(`[ok]   ${name.name} -> ${cfg.id}`);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  count: games.length,
  games
};

writeFileSync(join(root, 'games.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\ngames.json 已生成，共 ${games.length} 个游戏`);
