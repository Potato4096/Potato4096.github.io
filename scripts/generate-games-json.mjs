#!/usr/bin/env node
/**
 * generate-games-json.mjs
 * 遍历 Games/ 下的子目录，读取每个游戏的 game.json 校验后生成 games.json 清单。
 *
 * 用法:
 *   node scripts/generate-games-json.mjs
 *
 * 添加 / 删除游戏后运行一次即可。主页 (js/main.js) 会读取 games.json，
 * 再读取每个游戏目录中的 game.json 渲染卡片。
 */
import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const GAMES_DIR = join(ROOT, 'Games');
const OUTPUT = join(ROOT, 'games.json');

const REQUIRED_FIELDS = ['id', 'title', 'description', 'version', 'entry'];

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function main() {
  if (!await exists(GAMES_DIR)) {
    console.error('Games/ 目录不存在:', GAMES_DIR);
    process.exit(1);
  }

  const entries = await readdir(GAMES_DIR, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

  const games = [];
  const errors = [];

  for (const dir of dirs) {
    const configPath = join(GAMES_DIR, dir, 'game.json');
    if (!await exists(configPath)) {
      errors.push(`[skip] Games/${dir}: 缺少 game.json`);
      continue;
    }

    let config;
    try {
      config = JSON.parse(await readFile(configPath, 'utf8'));
    } catch (err) {
      errors.push(`[skip] Games/${dir}: game.json 解析失败 - ${err.message}`);
      continue;
    }

    const missing = REQUIRED_FIELDS.filter((f) => config[f] == null);
    if (missing.length) {
      errors.push(`[skip] Games/${dir}: game.json 缺少字段 ${missing.join(', ')}`);
      continue;
    }

    const entryPath = join(GAMES_DIR, dir, config.entry);
    if (!await exists(entryPath)) {
      errors.push(`[warn] Games/${dir}: 入口文件不存在 (${config.entry})`);
    }

    games.push({
      id: config.id,
      dir: `Games/${dir}`,
      title: config.title,
      version: config.version,
      published: config.published !== false
    });

    console.log(`  ✓ Games/${dir}  (${config.id})`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    count: games.length,
    games
  };

  await writeFile(OUTPUT, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log(`\n已生成 games.json（${games.length} 个游戏）`);
  if (errors.length) {
    console.log('\n提示:');
    errors.forEach((e) => console.log('  ' + e));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
