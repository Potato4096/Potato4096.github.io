/* super-jump - core game: states, physics, entities, rendering */
(function () {
  'use strict';

  var SJ = window.SJ = window.SJ || {};

  // ---------- constants ----------
  var TILE = 16;
  var VIEW_W = 480, VIEW_H = 272;
  var STEP = 1 / 120;
  var GRAVITY = 2300, JUMP_VEL = -620, JUMP_CUT = 0.42, MAX_FALL = 780;
  var RUN_MAX = 175, RUN_ACCEL = 1500, AIR_ACCEL = 950, FRICTION = 1700;
  var COYOTE = 0.09, BUFFER = 0.12, STOMP_BOUNCE = -430;
  var PLAYER_W = 12, PLAYER_H = 15;
  var ENEMY_W = 14, ENEMY_H = 14, ENEMY_SPEED = 42;

  // ---------- i18n ----------
  var STR = {
    title: { zh: '超级跳跃', en: 'Super Jump' },
    tagline: { zh: '踩怪 · 顶砖 · 吃金币 · 冲向旗杆', en: 'Stomp, bump, collect - race to the flagpole' },
    score: { zh: '得分', en: 'Score' },
    coins: { zh: '金币', en: 'Coins' },
    lives: { zh: '生命', en: 'Lives' },
    best: { zh: '最高分', en: 'Best' },
    start: { zh: '开始游戏', en: 'Start' },
    restart: { zh: '重新开始', en: 'Restart' },
    resume: { zh: '继续游戏', en: 'Resume' },
    paused: { zh: '已暂停', en: 'Paused' },
    gameOver: { zh: '游戏结束', en: 'Game Over' },
    levelClear: { zh: '通关！', en: 'Level Clear!' },
    again: { zh: '再玩一次', en: 'Play Again' },
    home: { zh: '返回主页', en: 'Home' },
    clearRecords: { zh: '清除记录', en: 'Clear Records' },
    cleared: { zh: '记录已清除', en: 'Records cleared' },
    newRecord: { zh: '新纪录！', en: 'New record!' },
    controls: {
      zh: '操作：←→ / A D 移动，空格 / ↑ / W 跳跃，Esc / P 暂停。触屏设备可使用屏幕按钮。',
      en: 'Controls: Arrows / A-D to move, Space / Up / W to jump, Esc / P to pause. On-screen buttons on touch devices.'
    },
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    pauseBtn: { zh: '暂停', en: 'Pause' }
  };
  function t(k) { return GamePlatform.i18n.t(STR[k] || { zh: k, en: k }); }

  // ---------- canvas ----------
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---------- world palettes (keyed by resolved light/dark, tinted by theme pack) ----------
  var WORLD = {
    light: {
      skyTop: '#4f9fe8', skyBottom: '#a8dcf7',
      hillFar: '#79c267', hillNear: '#5aab4c', cloud: '#ffffff',
      grass: '#6fbf3c', dirt: '#9c6236', dirtDark: '#7d4c28',
      hard: '#c9b183', hardDark: '#a88f63',
      brick: '#c1662f', brickLine: '#8f4520',
      q: '#e8b23a', qDark: '#b8842a', qMark: '#7a4c12',
      used: '#a8814f',
      pipe: '#3faa4d', pipeDark: '#2c8038', pipeLight: '#79d17f',
      pole: '#c9ced6', poleDark: '#8f96a3', flag: '#e5484d',
      enemy: '#a5622f', enemyDark: '#7c431c', enemyLight: '#c9824a',
      coin: '#f4c542', coinDark: '#c79a22', coinLight: '#fff3c4',
      skin: '#f2c79b', hair: '#3a2a1a', shirt: '#e5484d', overall: '#3b6fd4', shoe: '#6b3d1e'
    },
    dark: {
      skyTop: '#16233f', skyBottom: '#2a3f66',
      hillFar: '#2c5238', hillNear: '#24422c', cloud: '#b9c4d6',
      grass: '#3e7a35', dirt: '#6b4222', dirtDark: '#52321a',
      hard: '#8d7a58', hardDark: '#6f5f42',
      brick: '#8e4520', brickLine: '#5f2c12',
      q: '#b8842a', qDark: '#8c6420', qMark: '#4a2c08',
      used: '#7a5c39',
      pipe: '#2c8038', pipeDark: '#1e5c27', pipeLight: '#4aa858',
      pole: '#8a919c', poleDark: '#5f6672', flag: '#c73f44',
      enemy: '#7c431c', enemyDark: '#5a2f12', enemyLight: '#a5622f',
      coin: '#c79a22', coinDark: '#9a7418', coinLight: '#e8cf8a',
      skin: '#c99a72', hair: '#241a12', shirt: '#b03538', overall: '#2c4f96', shoe: '#4a2c14'
    }
  };
  var pal = WORLD.light;
  var skyGrad = null;

  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(a, b, tt) {
    try {
      var ca = hexToRgb(a), cb = hexToRgb(b);
      return 'rgb(' + Math.round(ca[0] + (cb[0] - ca[0]) * tt) + ',' +
        Math.round(ca[1] + (cb[1] - ca[1]) * tt) + ',' +
        Math.round(ca[2] + (cb[2] - ca[2]) * tt) + ')';
    } catch (e) {
      return a;
    }
  }
  function rebuildPal() {
    var mode = GamePlatform.theme.get();
    var base = WORLD[mode] || WORLD.light;
    var packBg = '#8899aa';
    try { packBg = GamePlatform.themePacks.colors().bg; } catch (e) { /* fallback */ }
    pal = {};
    for (var k in base) pal[k] = base[k];
    pal.skyTop = mix(base.skyTop, packBg, 0.22);
    pal.skyBottom = mix(base.skyBottom, packBg, 0.16);
    skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(1, pal.skyBottom);
  }

  // ---------- game state ----------
  var L = SJ.Level.build();
  var gameState = 'menu';
  var player, enemies, coins, pops, particles, bumps;
  var camX = 0;
  var score = 0, coinCount = 0, lives = 3, best = 0;
  var dyingTimer = 0, winTimer = 0, flagY = 0, nowSec = 0;
  var clouds = [];

  function initClouds() {
    clouds = [];
    for (var i = 0; i < 14; i++) {
      clouds.push({
        x: 40 + i * 230 + (i % 3) * 60,
        y: 24 + (i % 4) * 26,
        s: 1 + (i % 3) * 0.35
      });
    }
  }

  function resetLevel() {
    player = {
      x: L.spawn.x, y: L.spawn.y, w: PLAYER_W, h: PLAYER_H,
      vx: 0, vy: 0, face: 1, onGround: false, jumping: false,
      coyote: 0, buffer: 0, walkT: 0
    };
    enemies = L.enemies.map(function (e) {
      return {
        x: e.tx * TILE, y: e.fy * TILE - ENEMY_H,
        w: ENEMY_W, h: ENEMY_H,
        vx: -ENEMY_SPEED, vy: 0,
        onGround: false, squash: 0, alive: true
      };
    });
    coins = L.coins.map(function (c) {
      return { x: c.x * TILE + 3, y: c.y * TILE + 1, w: 10, h: 14, taken: false, phase: (c.x + c.y) * 0.7 };
    });
    pops = [];
    particles = [];
    bumps = [];
    camX = 0;
    flagY = L.flag.topY;
  }

  function startGame() {
    score = 0;
    coinCount = 0;
    lives = 3;
    SJ.Input.state.jumpQueued = false;
    resetLevel();
    gameState = 'playing';
    showOverlay(null);
    updateHUD();
    SJ.Audio.play('start');
    SJ.Audio.unlock();
  }

  function pauseGame() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    showOverlay('ov-pause');
  }

  function resumeGame() {
    if (gameState !== 'paused') return;
    gameState = 'playing';
    showOverlay(null);
  }

  function killPlayer() {
    if (gameState !== 'playing') return;
    gameState = 'dying';
    dyingTimer = 1.35;
    player.vy = -430;
    player.vx = 0;
    lives -= 1;
    updateHUD();
    SJ.Audio.play('die');
  }

  function winLevel() {
    if (gameState !== 'playing') return;
    gameState = 'levelclear';
    winTimer = 0;
    score += 1500 + lives * 300;
    SJ.Audio.play('clear');
    saveBest();
    updateHUD();
    setTimeout(function () {
      if (gameState !== 'levelclear') return;
      document.getElementById('clear-score').textContent = String(score);
      document.getElementById('clear-coins').textContent = String(coinCount);
      document.getElementById('clear-best').textContent = String(best);
      showOverlay('ov-clear');
    }, 900);
  }

  function gameOver() {
    gameState = 'gameover';
    saveBest();
    document.getElementById('go-score').textContent = String(score);
    document.getElementById('go-best').textContent = String(best);
    showOverlay('ov-gameover');
  }

  function saveBest() {
    if (score > best) {
      best = score;
      GamePlatform.storage.set('bestScore', best);
      GamePlatform.ui.toast(t('newRecord'));
    }
  }

  // ---------- tiles ----------
  function tileAt(tx, ty) {
    if (tx < 0) return SJ.Level.T.GROUND;
    if (tx >= L.W || ty < 0 || ty >= L.H) return SJ.Level.T.AIR;
    return L.tiles[ty * L.W + tx];
  }
  function solidAt(px, py) {
    return SJ.Level.isSolid(tileAt(Math.floor(px / TILE), Math.floor(py / TILE)));
  }

  function moveX(ent) {
    ent.x += ent.vx * STEP;
    var y0 = Math.floor(ent.y / TILE);
    var y1 = Math.floor((ent.y + ent.h - 0.01) / TILE);
    if (ent.vx > 0) {
      var tx = Math.floor((ent.x + ent.w - 0.01) / TILE);
      for (var ty = y0; ty <= y1; ty++) {
        if (SJ.Level.isSolid(tileAt(tx, ty))) {
          ent.x = tx * TILE - ent.w;
          ent.vx = 0;
          ent.hitWall = true;
          break;
        }
      }
    } else if (ent.vx < 0) {
      var tx2 = Math.floor(ent.x / TILE);
      for (var ty2 = y0; ty2 <= y1; ty2++) {
        if (SJ.Level.isSolid(tileAt(tx2, ty2))) {
          ent.x = (tx2 + 1) * TILE;
          ent.vx = 0;
          ent.hitWall = true;
          break;
        }
      }
    }
  }

  function moveY(ent, isPlayer) {
    ent.y += ent.vy * STEP;
    ent.onGround = false;
    var x0 = Math.floor(ent.x / TILE);
    var x1 = Math.floor((ent.x + ent.w - 0.01) / TILE);
    if (ent.vy > 0) {
      var ty = Math.floor((ent.y + ent.h - 0.01) / TILE);
      for (var tx = x0; tx <= x1; tx++) {
        if (SJ.Level.isSolid(tileAt(tx, ty))) {
          ent.y = ty * TILE - ent.h;
          ent.vy = 0;
          ent.onGround = true;
          break;
        }
      }
    } else if (ent.vy < 0) {
      var ty2 = Math.floor(ent.y / TILE);
      for (var tx2 = x0; tx2 <= x1; tx2++) {
        var tt = tileAt(tx2, ty2);
        if (SJ.Level.isSolid(tt)) {
          ent.y = (ty2 + 1) * TILE;
          ent.vy = 0;
          if (isPlayer) bumpTile(tx2, ty2, tt);
          break;
        }
      }
    }
  }

  function bumpTile(tx, ty, tt) {
    var T = SJ.Level.T;
    if (tt === T.QUESTION) {
      L.tiles[ty * L.W + tx] = T.USED;
      pops.push({ x: tx * TILE + 3, y: ty * TILE - 2, vy: -360, life: 0.55 });
      coinCount += 1;
      score += 200;
      updateHUD();
      SJ.Audio.play('coin');
      spawnSparkles(tx * TILE + 8, ty * TILE - 4);
    } else if (tt === T.BRICK) {
      bumps.push({ tx: tx, ty: ty, t: 0 });
      SJ.Audio.play('bump');
    } else {
      SJ.Audio.play('bump');
    }
  }

  // ---------- particles ----------
  function reduceMotion() {
    try { return GamePlatform.ui.shouldReduceMotion(); } catch (e) { return false; }
  }
  function spawnSparkles(x, y) {
    if (reduceMotion()) return;
    for (var i = 0; i < 5; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 130,
        vy: -Math.random() * 150 - 30,
        life: 0.4, maxLife: 0.4,
        color: pal.coinLight, size: 2 + Math.random() * 2
      });
    }
  }
  function spawnDust(x, y) {
    if (reduceMotion()) return;
    for (var i = 0; i < 3; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 8, y: y,
        vx: (Math.random() - 0.5) * 60,
        vy: -Math.random() * 40,
        life: 0.28, maxLife: 0.28,
        color: pal.dirtDark, size: 2 + Math.random() * 2
      });
    }
  }

  // ---------- update ----------
  function update(dt) {
    nowSec += dt;

    if (gameState === 'dying') {
      player.vy += GRAVITY * dt;
      player.y += player.vy * dt;
      dyingTimer -= dt;
      if (dyingTimer <= 0) {
        if (lives > 0) {
          resetLevel();
          gameState = 'playing';
        } else {
          gameOver();
        }
      }
      updateEffects(dt);
      return;
    }

    if (gameState === 'levelclear') {
      winTimer += dt;
      var target = L.flag.bottomY - 40;
      if (flagY < target) flagY = Math.min(target, flagY + 120 * dt);
      player.vx *= 0.9;
      player.vy += GRAVITY * dt;
      if (player.y + player.h < L.flag.bottomY - 2) {
        moveY(player, false);
      }
      updateEffects(dt);
      return;
    }

    if (gameState !== 'playing') {
      SJ.Input.state.jumpQueued = false;
      updateEffects(dt);
      return;
    }

    // ----- player -----
    var input = SJ.Input.state;
    var want = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var accel = player.onGround ? RUN_ACCEL : AIR_ACCEL;
    if (want !== 0) {
      player.vx += want * accel * dt;
      player.face = want;
    } else if (player.onGround) {
      var f = FRICTION * dt;
      if (Math.abs(player.vx) <= f) player.vx = 0;
      else player.vx -= (player.vx > 0 ? 1 : -1) * f;
    }
    if (player.vx > RUN_MAX) player.vx = RUN_MAX;
    if (player.vx < -RUN_MAX) player.vx = -RUN_MAX;

    if (player.onGround) player.coyote = COYOTE;
    else player.coyote -= dt;

    if (input.jumpQueued) {
      player.buffer = BUFFER;
      input.jumpQueued = false;
    } else {
      player.buffer -= dt;
    }

    if (player.buffer > 0 && player.coyote > 0) {
      player.vy = JUMP_VEL;
      player.jumping = true;
      player.onGround = false;
      player.coyote = 0;
      player.buffer = 0;
      SJ.Audio.play('jump');
    }

    if (!input.jump && player.jumping && player.vy < 0) {
      player.vy *= JUMP_CUT;
      player.jumping = false;
    }

    player.vy += GRAVITY * dt;
    if (player.vy > MAX_FALL) player.vy = MAX_FALL;

    var wasAir = !player.onGround;
    moveX(player);
    moveY(player, true);
    if (wasAir && player.onGround && player.vy === 0) {
      spawnDust(player.x + player.w / 2, player.y + player.h);
    }
    if (player.onGround && Math.abs(player.vx) > 10) player.walkT += dt;

    // fell into a pit
    if (player.y > L.H * TILE + 40) {
      killPlayer();
      updateEffects(dt);
      return;
    }

    // flag
    if (player.x + player.w > L.flag.x && player.x < L.flag.x + TILE &&
        player.y + player.h > L.flag.topY && player.y < L.flag.bottomY) {
      winLevel();
      updateEffects(dt);
      return;
    }

    // ----- enemies -----
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) continue;
      if (e.squash > 0) {
        e.squash -= dt;
        if (e.squash <= 0) e.alive = false;
        continue;
      }
      e.hitWall = false;
      e.vy += GRAVITY * dt;
      if (e.vy > MAX_FALL) e.vy = MAX_FALL;
      moveX(e);
      if (e.hitWall) e.vx = -e.vx;
      moveY(e, false);
      if (e.onGround) {
        var aheadX = e.vx > 0 ? e.x + e.w + 2 : e.x - 2;
        if (!solidAt(aheadX, e.y + e.h + 3)) e.vx = -e.vx;
      }
      if (e.y > L.H * TILE + 60) e.alive = false;

      // player interaction
      if (gameState !== 'playing') break;
      if (player.x < e.x + e.w && player.x + player.w > e.x &&
          player.y < e.y + e.h && player.y + player.h > e.y) {
        var playerBottom = player.y + player.h;
        if (player.vy > 0 && playerBottom - e.y < 11) {
          e.squash = 0.26;
          e.vx = 0;
          player.vy = STOMP_BOUNCE;
          player.jumping = true;
          score += 100;
          updateHUD();
          SJ.Audio.play('stomp');
          spawnSparkles(e.x + e.w / 2, e.y);
        } else {
          killPlayer();
          updateEffects(dt);
          return;
        }
      }
    }

    // ----- coins -----
    for (var c = 0; c < coins.length; c++) {
      var cn = coins[c];
      if (cn.taken) continue;
      if (player.x < cn.x + cn.w && player.x + player.w > cn.x &&
          player.y < cn.y + cn.h && player.y + player.h > cn.y) {
        cn.taken = true;
        coinCount += 1;
        score += 200;
        updateHUD();
        SJ.Audio.play('coin');
        spawnSparkles(cn.x + 5, cn.y + 7);
      }
    }

    updateEffects(dt);

    // ----- camera -----
    var target = player.x + player.w / 2 - VIEW_W * 0.42;
    var maxCam = L.W * TILE - VIEW_W;
    if (target < 0) target = 0;
    if (target > maxCam) target = maxCam;
    camX += (target - camX) * Math.min(1, dt * 7);
  }

  function updateEffects(dt) {
    for (var i = pops.length - 1; i >= 0; i--) {
      var p = pops[i];
      p.life -= dt;
      p.y += p.vy * dt;
      p.vy += 900 * dt;
      if (p.life <= 0) pops.splice(i, 1);
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var q = particles[j];
      q.life -= dt;
      if (q.life <= 0) { particles.splice(j, 1); continue; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 320 * dt;
    }
    for (var k = bumps.length - 1; k >= 0; k--) {
      bumps[k].t += dt;
      if (bumps[k].t > 0.16) bumps.splice(k, 1);
    }
  }

  // ---------- render ----------
  function px(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function drawBackground() {
    ctx.fillStyle = skyGrad || pal.skyTop;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // clouds (parallax 0.35)
    for (var i = 0; i < clouds.length; i++) {
      var cl = clouds[i];
      var cx = cl.x - camX * 0.35;
      var span = L.W * TILE * 0.5;
      cx = ((cx % span) + span) % span - 60;
      if (cx > VIEW_W + 60) continue;
      var s = cl.s;
      px(cx, cl.y, 34 * s, 10 * s, pal.cloud);
      px(cx + 8 * s, cl.y - 8 * s, 20 * s, 10 * s, pal.cloud);
    }

    // far hills (parallax 0.45)
    for (var h1 = 0; h1 < 8; h1++) {
      var hx = h1 * 320 - camX * 0.45;
      hx = ((hx % (320 * 8)) + 320 * 8) % (320 * 8) - 200;
      if (hx > VIEW_W + 120) continue;
      ctx.fillStyle = pal.hillFar;
      ctx.beginPath();
      ctx.moveTo(hx - 110, VIEW_H);
      ctx.quadraticCurveTo(hx, VIEW_H - 130, hx + 110, VIEW_H);
      ctx.closePath();
      ctx.fill();
    }
    // near hills (parallax 0.7)
    for (var h2 = 0; h2 < 8; h2++) {
      var nx = h2 * 420 + 120 - camX * 0.7;
      nx = ((nx % (420 * 8)) + 420 * 8) % (420 * 8) - 260;
      if (nx > VIEW_W + 160) continue;
      ctx.fillStyle = pal.hillNear;
      ctx.beginPath();
      ctx.moveTo(nx - 150, VIEW_H);
      ctx.quadraticCurveTo(nx, VIEW_H - 95, nx + 150, VIEW_H);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawTile(tt, x, y, offY) {
    var T = SJ.Level.T;
    y += offY;
    if (tt === T.GROUND) {
      px(x, y, 16, 16, pal.dirt);
      px(x, y, 16, 5, pal.grass);
      px(x, y + 5, 16, 2, pal.dirtDark);
      px(x + 2, y + 9, 3, 3, pal.dirtDark);
      px(x + 10, y + 12, 3, 2, pal.dirtDark);
    } else if (tt === T.HARD) {
      px(x, y, 16, 16, pal.hard);
      px(x, y, 16, 2, pal.hardDark);
      px(x, y + 14, 16, 2, pal.hardDark);
      px(x + 12, y + 4, 3, 3, pal.hardDark);
    } else if (tt === T.BRICK) {
      px(x, y, 16, 16, pal.brick);
      px(x, y + 7, 16, 1, pal.brickLine);
      px(x + 7, y, 1, 7, pal.brickLine);
      px(x + 3, y + 8, 1, 8, pal.brickLine);
      px(x + 11, y + 8, 1, 8, pal.brickLine);
    } else if (tt === T.QUESTION) {
      var shimmer = 0.5 + 0.5 * Math.sin(nowSec * 4);
      px(x, y, 16, 16, pal.q);
      px(x, y, 16, 2, pal.qDark);
      px(x, y + 14, 16, 2, pal.qDark);
      px(x, y, 2, 16, pal.qDark);
      px(x + 14, y, 2, 16, pal.qDark);
      // "?" mark
      px(x + 6, y + 4, 4, 2, pal.qMark);
      px(x + 9, y + 5, 2, 3, pal.qMark);
      px(x + 7, y + 8, 3, 2, pal.qMark);
      px(x + 7, y + 11, 2, 2, pal.qMark);
      if (shimmer > 0.75) px(x + 2, y + 2, 3, 3, pal.coinLight);
    } else if (tt === T.USED) {
      px(x, y, 16, 16, pal.used);
      px(x, y, 16, 2, pal.dirtDark);
      px(x, y + 14, 16, 2, pal.dirtDark);
    } else if (tt === T.PIPE_TL) {
      px(x, y, 16, 16, pal.pipe);
      px(x, y, 16, 3, pal.pipeLight);
      px(x, y, 3, 16, pal.pipeLight);
      px(x + 13, y, 3, 16, pal.pipeDark);
    } else if (tt === T.PIPE_TR) {
      px(x, y, 16, 16, pal.pipe);
      px(x, y, 16, 3, pal.pipeLight);
      px(x + 13, y, 3, 16, pal.pipeDark);
    } else if (tt === T.PIPE_BL) {
      px(x + 2, y, 14, 16, pal.pipe);
      px(x + 2, y, 3, 16, pal.pipeLight);
      px(x + 13, y, 3, 16, pal.pipeDark);
    } else if (tt === T.PIPE_BR) {
      px(x, y, 14, 16, pal.pipe);
      px(x, y, 3, 16, pal.pipeLight);
      px(x + 11, y, 3, 16, pal.pipeDark);
    }
  }

  function drawFlag() {
    var x = L.flag.x - camX + 8;
    if (x < -30 || x > VIEW_W + 30) return;
    px(x, L.flag.topY, 3, L.flag.bottomY - L.flag.topY, pal.pole);
    px(x + 3, L.flag.topY, 1, L.flag.bottomY - L.flag.topY, pal.poleDark);
    px(x - 2, L.flag.topY - 6, 7, 7, pal.pole);
    // flag cloth
    var fy = flagY;
    px(x - 22, fy, 22, 14, pal.flag);
    px(x - 22, fy, 22, 2, '#ffffff');
    px(x - 22, fy + 12, 22, 2, pal.poleDark);
  }

  function drawCoinItem(cn) {
    var t0 = nowSec * 5 + cn.phase;
    var w = Math.max(3, Math.round(10 * Math.abs(Math.cos(t0))));
    var x = cn.x - camX + (10 - w) / 2;
    var y = cn.y + Math.sin(nowSec * 2.4 + cn.phase) * 1.5;
    px(x, y, w, 14, pal.coin);
    if (w > 5) {
      px(x + 2, y + 3, Math.max(1, w - 6), 8, pal.coinLight);
      px(x + w - 2, y + 2, 1, 10, pal.coinDark);
    }
  }

  function drawEnemy(e) {
    var x = e.x - camX;
    var y = e.y;
    if (x < -20 || x > VIEW_W + 20) return;
    if (e.squash > 0) {
      px(x, y + ENEMY_H - 6, ENEMY_W, 6, pal.enemy);
      px(x + 2, y + ENEMY_H - 4, 4, 2, '#ffffff');
      px(x + 8, y + ENEMY_H - 4, 4, 2, '#ffffff');
      return;
    }
    // body
    px(x + 1, y + 3, 12, 9, pal.enemy);
    px(x + 3, y + 1, 8, 3, pal.enemy);
    px(x, y + 6, 1, 5, pal.enemyDark);
    px(x + 13, y + 6, 1, 5, pal.enemyDark);
    // feet
    var step = Math.sin(nowSec * 10) > 0 ? 0 : 2;
    px(x + 1, y + 12, 4, 2, pal.enemyDark);
    px(x + 9, y + 12 - step, 4, 2 + step, pal.enemyDark);
    // eyes
    px(x + 3, y + 5, 3, 4, '#ffffff');
    px(x + 8, y + 5, 3, 4, '#ffffff');
    px(x + 4, y + 7, 2, 2, '#222222');
    px(x + 8, y + 7, 2, 2, '#222222');
    // brows
    px(x + 3, y + 4, 3, 1, pal.enemyDark);
    px(x + 8, y + 4, 3, 1, pal.enemyDark);
  }

  function drawPlayer() {
    var x = Math.round(player.x - camX);
    var y = Math.round(player.y);
    var f = player.face;

    function spr(ox, oy, w, h, color) {
      var sx = f >= 0 ? x + ox : x + (PLAYER_W - ox - w);
      px(sx, y + oy, w, h, color);
    }

    var running = player.onGround && Math.abs(player.vx) > 12;
    var legFrame = running ? (Math.floor(player.walkT * 10) % 2) : 0;
    var inAir = !player.onGround;

    // cap
    spr(2, 0, 8, 3, pal.shirt);
    spr(0, 3, 12, 2, pal.shirt);
    // face
    spr(2, 5, 8, 4, pal.skin);
    spr(f >= 0 ? 8 : 2, 5, 2, 2, pal.hair);
    spr(f >= 0 ? 7 : 3, 6, 2, 2, '#222222');
    // body
    spr(2, 9, 8, 4, pal.overall);
    spr(0, 9, 2, 3, pal.shirt);
    spr(10, 9, 2, 3, pal.shirt);
    if (inAir) {
      spr(f >= 0 ? 10 : 0, 7, 2, 3, pal.skin);
      spr(f >= 0 ? 0 : 10, 10, 2, 3, pal.skin);
    } else {
      spr(0, 10, 2, 2, pal.skin);
      spr(10, 10, 2, 2, pal.skin);
    }
    // legs + shoes
    if (inAir) {
      spr(2, 13, 3, 2, pal.shoe);
      spr(7, 12, 3, 3, pal.shoe);
    } else if (running && legFrame === 1) {
      spr(1, 13, 4, 2, pal.shoe);
      spr(8, 13, 4, 2, pal.shoe);
    } else {
      spr(2, 13, 3, 2, pal.shoe);
      spr(7, 13, 3, 2, pal.shoe);
    }
  }

  function render() {
    drawBackground();

    // visible tiles
    var startX = Math.floor(camX / TILE) - 1;
    var endX = startX + Math.ceil(VIEW_W / TILE) + 2;
    var bumpMap = {};
    for (var b = 0; b < bumps.length; b++) {
      bumpMap[bumps[b].ty * L.W + bumps[b].tx] = -Math.sin(bumps[b].t / 0.16 * Math.PI) * 5;
    }
    for (var ty = 0; ty < L.H; ty++) {
      for (var tx = startX; tx <= endX; tx++) {
        if (tx < 0 || tx >= L.W) continue;
        var tt = L.tiles[ty * L.W + tx];
        if (tt === SJ.Level.T.AIR) continue;
        drawTile(tt, tx * TILE - camX, ty * TILE, bumpMap[ty * L.W + tx] || 0);
      }
    }

    drawFlag();

    for (var i = 0; i < coins.length; i++) {
      if (!coins[i].taken) drawCoinItem(coins[i]);
    }

    for (var e = 0; e < enemies.length; e++) {
      if (enemies[e].alive) drawEnemy(enemies[e]);
    }

    // block coin pops
    for (var p = 0; p < pops.length; p++) {
      var pp = pops[p];
      var pw = 8;
      px(pp.x - camX + 1, pp.y, pw, 12, pal.coin);
      px(pp.x - camX + 3, pp.y + 2, 4, 8, pal.coinLight);
    }

    // particles
    for (var q = 0; q < particles.length; q++) {
      var pa = particles[q];
      ctx.globalAlpha = Math.max(0, pa.life / pa.maxLife);
      px(pa.x - camX, pa.y, pa.size, pa.size, pa.color);
    }
    ctx.globalAlpha = 1;

    drawPlayer();
  }

  // ---------- HUD / overlays / i18n ----------
  function updateHUD() {
    document.getElementById('hud-score').textContent = String(score);
    document.getElementById('hud-coins').textContent = String(coinCount);
    document.getElementById('hud-lives').textContent = String(Math.max(0, lives));
  }

  function showOverlay(id) {
    ['ov-menu', 'ov-pause', 'ov-gameover', 'ov-clear'].forEach(function (oid) {
      document.getElementById(oid).hidden = oid !== id;
    });
  }

  function applyI18n() {
    var nodes = document.querySelectorAll('[data-i18n]');
    Array.prototype.forEach.call(nodes, function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.getElementById('menu-best').textContent = String(best);
  }

  function bindUI() {
    document.getElementById('btn-home').onclick = function () {
      GamePlatform.navigate.goHome();
    };
    document.getElementById('btn-start').onclick = function () { startGame(); };
    document.getElementById('btn-clear').onclick = function () {
      GamePlatform.storage.clear();
      best = 0;
      document.getElementById('menu-best').textContent = '0';
      GamePlatform.ui.toast(t('cleared'));
    };
    document.getElementById('btn-pause').onclick = function () {
      if (gameState === 'playing') pauseGame();
      else if (gameState === 'paused') resumeGame();
    };
    document.getElementById('btn-fullscreen').onclick = function () {
      GamePlatform.ui.requestFullscreen(document.getElementById('stage'));
    };
    document.getElementById('btn-resume').onclick = function () { resumeGame(); };
    document.getElementById('btn-restart-pause').onclick = function () { startGame(); };
    document.getElementById('btn-home-pause').onclick = function () {
      GamePlatform.navigate.goHome();
    };
    document.getElementById('btn-again-go').onclick = function () { startGame(); };
    document.getElementById('btn-home-go').onclick = function () {
      GamePlatform.navigate.goHome();
    };
    document.getElementById('btn-again-clear').onclick = function () { startGame(); };
    document.getElementById('btn-home-clear').onclick = function () {
      GamePlatform.navigate.goHome();
    };
  }

  // ---------- main loop ----------
  var lastTs = 0, acc = 0;

  function frame(ts) {
    if (!lastTs) lastTs = ts;
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.1) dt = 0.1;

    if (SJ.Input.state.pauseQueued) {
      SJ.Input.state.pauseQueued = false;
      if (gameState === 'playing') pauseGame();
      else if (gameState === 'paused') resumeGame();
    }

    acc += dt;
    var guard = 0;
    while (acc >= STEP && guard < 16) {
      update(STEP);
      acc -= STEP;
      guard++;
    }
    if (acc > STEP * 16) acc = 0;

    render();
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  function boot() {
    best = GamePlatform.storage.get('bestScore', 0);
    rebuildPal();
    initClouds();
    resetLevel();
    SJ.Input.init();
    applyI18n();
    updateHUD();
    bindUI();
    showOverlay('ov-menu');

    GamePlatform.settings.onChange(function (settings, keys) {
      if (keys.indexOf('lang') !== -1) applyI18n();
    });
    GamePlatform.theme.onChange(function () { rebuildPal(); });
    GamePlatform.themePacks.onChange(function () { rebuildPal(); });

    requestAnimationFrame(frame);
  }

  GamePlatform.ready.then(boot);
})();
