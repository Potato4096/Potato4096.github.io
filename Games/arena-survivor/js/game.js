/* arena-survivor - core game: waves, combat, upgrades, rendering */
(function () {
  'use strict';

  var SJ = window.SJ = window.SJ || {};

  // ---------- constants ----------
  var VIEW_W = 480, VIEW_H = 320;
  var STEP = 1 / 120;
  var PLAYER_R = 11;
  var ENEMY_DEFS = {
    slime: { r: 11, hp: 22, speed: 42, dmg: 8, xp: 2 },
    runner: { r: 8, hp: 13, speed: 88, dmg: 6, xp: 2 },
    brute: { r: 17, hp: 72, speed: 30, dmg: 16, xp: 5 }
  };

  // ---------- i18n ----------
  var STR = {
    title: { zh: '竞技场幸存者', en: 'Arena Survivor' },
    tagline: {
      zh: '自动攻击 · 击杀刷怪 · 升级强化 · 撑过一波波怪物潮',
      en: 'Auto-attack - farm monsters - upgrade - survive the waves'
    },
    hp: { zh: '生命', en: 'HP' },
    xp: { zh: '经验', en: 'XP' },
    wave: { zh: '波次', en: 'Wave' },
    kills: { zh: '击杀', en: 'Kills' },
    score: { zh: '得分', en: 'Score' },
    best: { zh: '最高分', en: 'Best' },
    bestWave: { zh: '最高波次', en: 'Best wave' },
    waveReached: { zh: '到达波次', en: 'Wave reached' },
    start: { zh: '开始游戏', en: 'Start' },
    restart: { zh: '重新开始', en: 'Restart' },
    resume: { zh: '继续游戏', en: 'Resume' },
    paused: { zh: '已暂停', en: 'Paused' },
    gameOver: { zh: '游戏结束', en: 'Game Over' },
    again: { zh: '再玩一次', en: 'Play Again' },
    home: { zh: '返回主页', en: 'Home' },
    clearRecords: { zh: '清除记录', en: 'Clear Records' },
    cleared: { zh: '记录已清除', en: 'Records cleared' },
    newRecord: { zh: '新纪录！', en: 'New record!' },
    chooseUpgrade: { zh: '选择强化', en: 'Choose an Upgrade' },
    levelUpTo: { zh: '升级！当前等级', en: 'Level up! Now level' },
    waveBanner: { zh: '第 {n} 波', en: 'Wave {n}' },
    waveIncoming: { zh: '怪物来袭…', en: 'Incoming…' },
    waveCleared: { zh: '波次清空！', en: 'Wave cleared!' },
    controls: {
      zh: '操作：WASD / 方向键移动，自动攻击最近敌人；升级时点击卡片或按 1/2/3 选择；Esc / P 暂停。触屏使用游戏框下方的虚拟摇杆。',
      en: 'Controls: WASD / Arrows to move (auto-attacks the nearest enemy); click a card or press 1/2/3 to pick upgrades; Esc / P to pause. On touch, use the virtual joystick below the game frame.'
    },
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    pauseBtn: { zh: '暂停', en: 'Pause' }
  };
  function t(k) {
    return GamePlatform.i18n.t(STR[k] || { zh: k, en: k });
  }
  function tMap(map) {
    return GamePlatform.i18n.t(map);
  }

  // ---------- canvas ----------
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---------- world palettes ----------
  var WORLD = {
    light: {
      bg: '#cfd9c3', grid: '#b9c5ab', wall: '#7a8a66', wallDark: '#5d6b4c',
      player: '#e8b84a', playerHi: '#f5d27a', playerDark: '#c4922e', playerFace: '#4a3414',
      slime: '#6fbf6a', slimeDark: '#4e9449',
      runner: '#e0734f', runnerDark: '#a84a2c',
      brute: '#8a6bbf', bruteDark: '#5f4590',
      bullet: '#f4d35e', bulletHi: '#fff6d0',
      xp: '#4fc97f', xpHi: '#a2ecc0',
      hpBar: '#e5484d', hpBarBg: 'rgba(30,36,28,0.35)',
      text: '#2b3428', spark: '#ffffff'
    },
    dark: {
      bg: '#242c22', grid: '#2f3a2c', wall: '#46523c', wallDark: '#323c2b',
      player: '#c99a34', playerHi: '#e8b84a', playerDark: '#8f6c1c', playerFace: '#2c1e08',
      slime: '#4e9449', slimeDark: '#356b32',
      runner: '#b85232', runnerDark: '#7e341c',
      brute: '#6b4e99', bruteDark: '#4a346b',
      bullet: '#d9b845', bulletHi: '#f0e0a0',
      xp: '#3da366', xpHi: '#7cd4a0',
      hpBar: '#c73f44', hpBarBg: 'rgba(0,0,0,0.4)',
      text: '#d7e0cf', spark: '#cfd8c8'
    }
  };
  var pal = WORLD.light;

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
    var packBg = mode === 'dark' ? '#12151d' : '#f6f7fb';
    try { packBg = GamePlatform.themePacks.colors().bg; } catch (e) { /* fallback */ }
    pal = {};
    for (var k in base) pal[k] = base[k];
    pal.bg = mix(base.bg, packBg, 0.28);
    pal.grid = mix(base.grid, packBg, 0.18);
  }

  // ---------- game state ----------
  var gameState = 'menu'; // menu | playing | levelup | paused | gameover
  var player, enemies, bullets, orbs, particles, floaters;
  var wave = 0, waveState = 'break', waveTimer = 0, spawnQueue = 0, spawnTimer = 0;
  var kills = 0, score = 0, level = 1, xp = 0, xpNeed = 18;
  var bestScore = 0, bestWave = 0;
  var upgradeChoices = [];
  var uidSeq = 1;
  var bannerTimer = 0;
  var nowSec = 0;
  var godMode = false; // easter-egg cheat toggle (see js/cheats.js)

  function makePlayer() {
    return {
      x: VIEW_W / 2, y: VIEW_H / 2, r: PLAYER_R,
      hp: 100, maxHp: 100,
      speed: 122,
      damage: 10,
      fireInterval: 0.52, fireTimer: 0.2,
      bulletSpeed: 250, bulletLife: 1.05,
      projectiles: 1, pierce: 0, crit: 0.05,
      pickupR: 38,
      invuln: 0,
      faceX: 1, faceY: 0,
      walkT: 0
    };
  }

  function resetRun() {
    player = makePlayer();
    enemies = [];
    bullets = [];
    orbs = [];
    particles = [];
    floaters = [];
    wave = 0;
    waveState = 'break';
    waveTimer = 2.2;
    spawnQueue = 0;
    spawnTimer = 0;
    kills = 0;
    score = 0;
    level = 1;
    xp = 0;
    xpNeed = 18;
    bannerTimer = 0;
  }

  // ---------- helpers ----------
  function rand(a, b) { return a + Math.random() * (b - a); }

  function reduceMotion() {
    try { return GamePlatform.ui.shouldReduceMotion(); } catch (e) { return false; }
  }

  function spawnParticles(x, y, color, n, speed) {
    if (reduceMotion()) return;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = rand(speed * 0.4, speed);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.32, maxLife: 0.32,
        color: color, size: rand(1.5, 3.2)
      });
    }
  }

  function addFloater(x, y, text, color) {
    floaters.push({ x: x, y: y, vy: -34, text: text, life: 0.75, maxLife: 0.75, color: color });
  }

  function showBanner(text) {
    var el = document.getElementById('wave-banner');
    el.textContent = text;
    el.classList.add('show');
    bannerTimer = 1.7;
  }

  // ---------- waves ----------
  function waveCount(n) {
    return 6 + Math.floor(n * 3.2);
  }
  function waveSpawnInterval(n) {
    return Math.max(0.26, 0.92 - n * 0.042);
  }
  function hpMul(n) { return 1 + (n - 1) * 0.3; }
  function speedMul(n) { return 1 + (n - 1) * 0.035; }
  function dmgMul(n) { return 1 + (n - 1) * 0.14; }

  function startWave() {
    wave += 1;
    waveState = 'active';
    spawnQueue = waveCount(wave);
    spawnTimer = 0.35;
    showBanner(t('waveBanner').replace('{n}', String(wave)));
    SJ.Audio.play('wave');
  }

  function completeWave() {
    waveState = 'break';
    waveTimer = 3.6;
    score += wave * 140;
    player.hp = Math.min(player.maxHp, player.hp + player.maxHp * 0.12);
    showBanner(t('waveCleared'));
    SJ.Audio.play('wave');
    saveBest();
  }

  function pickEnemyType() {
    var r = Math.random();
    if (wave >= 5 && r < 0.22) return 'brute';
    if (wave >= 3 && r < 0.48) return 'runner';
    return 'slime';
  }

  function spawnEnemy() {
    var type = pickEnemyType();
    var def = ENEMY_DEFS[type];
    var side = Math.floor(Math.random() * 4);
    var x, y;
    if (side === 0) { x = rand(-30, VIEW_W + 30); y = -28; }
    else if (side === 1) { x = VIEW_W + 28; y = rand(-20, VIEW_H + 20); }
    else if (side === 2) { x = rand(-30, VIEW_W + 30); y = VIEW_H + 28; }
    else { x = -28; y = rand(-20, VIEW_H + 20); }

    // keep a minimum distance from the player
    var dx = x - player.x, dy = y - player.y;
    if (dx * dx + dy * dy < 130 * 130) {
      x = player.x + (dx > 0 ? 150 : -150);
      y = player.y + (dy > 0 ? 110 : -110);
    }

    enemies.push({
      uid: uidSeq++,
      type: type,
      x: x, y: y, r: def.r,
      hp: def.hp * hpMul(wave),
      maxHp: def.hp * hpMul(wave),
      speed: def.speed * speedMul(wave),
      dmg: def.dmg * dmgMul(wave),
      xp: def.xp,
      hitFlash: 0
    });
  }

  // ---------- combat ----------
  function fireAtNearest() {
    var target = null, bestD = Infinity;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      var dx = e.x - player.x, dy = e.y - player.y;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; target = e; }
    }
    if (!target) return;

    var baseAng = Math.atan2(target.y - player.y, target.x - player.x);
    player.faceX = Math.cos(baseAng);
    player.faceY = Math.sin(baseAng);

    var n = player.projectiles;
    var spread = 0.16;
    for (var k = 0; k < n; k++) {
      var ang = baseAng + (k - (n - 1) / 2) * spread;
      var dmg = player.damage;
      var isCrit = Math.random() < player.crit;
      if (isCrit) dmg *= 2;
      bullets.push({
        x: player.x + Math.cos(ang) * (player.r + 3),
        y: player.y + Math.sin(ang) * (player.r + 3),
        vx: Math.cos(ang) * player.bulletSpeed,
        vy: Math.sin(ang) * player.bulletSpeed,
        dmg: dmg,
        crit: isCrit,
        pierce: player.pierce,
        life: player.bulletLife,
        hit: []
      });
    }
    SJ.Audio.play('shoot');
    spawnParticles(player.x + player.faceX * 12, player.y + player.faceY * 12, pal.bullet, 2, 60);
  }

  function killEnemy(idx) {
    var e = enemies[idx];
    kills += 1;
    score += 10 + wave * 2;
    SJ.Audio.play('kill');
    spawnParticles(e.x, e.y, e.type === 'brute' ? pal.brute : (e.type === 'runner' ? pal.runner : pal.slime), 8, 130);
    // drop xp orbs
    var remain = e.xp;
    while (remain > 0) {
      var v = Math.min(remain, 3);
      remain -= v;
      orbs.push({
        x: e.x + rand(-6, 6), y: e.y + rand(-6, 6),
        vx: rand(-40, 40), vy: rand(-40, 40),
        value: v, phase: Math.random() * Math.PI * 2
      });
    }
    enemies.splice(idx, 1);
  }

  function damagePlayer(amount, fromX, fromY) {
    if (godMode || player.invuln > 0) return;
    player.hp -= amount;
    player.invuln = 0.72;
    SJ.Audio.play('hurt');
    addFloater(player.x, player.y - 14, '-' + Math.round(amount), pal.hpBar);
    spawnParticles(player.x, player.y, pal.hpBar, 6, 110);
    // knockback
    var dx = player.x - fromX, dy = player.y - fromY;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    player.x += dx / d * 12;
    player.y += dy / d * 12;
    if (player.hp <= 0) {
      player.hp = 0;
      gameOver();
    }
  }

  // ---------- xp & level up ----------
  function addXp(v) {
    xp += v;
    if (xp >= xpNeed) {
      xp -= xpNeed;
      level += 1;
      xpNeed = Math.floor(18 + level * 11);
      if (gameState === 'playing') openLevelUp();
    }
  }

  function openLevelUp() {
    gameState = 'levelup';
    SJ.Audio.play('levelup');
    upgradeChoices = SJ.pickUpgrades(3);
    renderLevelUp();
    showOverlay('ov-levelup');
  }

  function renderLevelUp() {
    var grid = document.getElementById('upgrade-grid');
    grid.innerHTML = '';
    document.getElementById('levelup-sub').textContent =
      t('levelUpTo') + ' ' + level;

    for (var i = 0; i < upgradeChoices.length; i++) {
      (function (idx) {
        var up = upgradeChoices[idx];
        var btn = document.createElement('button');
        btn.className = 'upgrade-card';
        btn.innerHTML =
          '<span class="up-icon"></span>' +
          '<span class="up-name"></span>' +
          '<span class="up-desc"></span>' +
          '<span class="up-key"></span>';
        btn.querySelector('.up-icon').textContent = up.icon;
        btn.querySelector('.up-name').textContent = tMap(up.name);
        btn.querySelector('.up-desc').textContent = tMap(up.desc);
        btn.querySelector('.up-key').textContent = String(idx + 1);
        btn.onclick = function () { chooseUpgrade(idx); };
        grid.appendChild(btn);
      })(i);
    }
  }

  function chooseUpgrade(idx) {
    if (gameState !== 'levelup') return;
    var up = upgradeChoices[idx];
    if (up) up.apply(player);
    gameState = 'playing';
    showOverlay(null);
    // catch-up: if still over threshold, level again next kill
    if (xp >= xpNeed) {
      xp -= xpNeed;
      level += 1;
      xpNeed = Math.floor(18 + level * 11);
      openLevelUp();
    }
  }

  // ---------- flow ----------
  function startGame() {
    resetRun();
    SJ.Input.state.pauseQueued = false;
    SJ.Input.state.pickQueued = -1;
    gameState = 'playing';
    showOverlay(null);
    updateHUD();
    SJ.Audio.play('start');
    SJ.Audio.unlock();
    showBanner(t('waveIncoming'));
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

  function gameOver() {
    gameState = 'gameover';
    SJ.Audio.play('gameover');
    saveBest();
    document.getElementById('go-wave').textContent = String(wave);
    document.getElementById('go-kills').textContent = String(kills);
    document.getElementById('go-score').textContent = String(score);
    document.getElementById('go-best').textContent = String(bestScore);
    showOverlay('ov-gameover');
  }

  function saveBest() {
    var improved = false;
    if (score > bestScore) {
      bestScore = score;
      GamePlatform.storage.set('bestScore', bestScore);
      improved = true;
    }
    if (wave > bestWave) {
      bestWave = wave;
      GamePlatform.storage.set('bestWave', bestWave);
      improved = true;
    }
    if (improved) GamePlatform.ui.toast(t('newRecord'));
  }

  // ---------- update ----------
  function update(dt) {
    nowSec += dt;
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) {
        document.getElementById('wave-banner').classList.remove('show');
      }
    }

    if (gameState !== 'playing') {
      updateEffects(dt);
      return;
    }

    // ----- player movement -----
    var input = SJ.Input.state;
    var mx = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joyX;
    var my = (input.down ? 1 : 0) - (input.up ? 1 : 0) + input.joyY;
    var ml = Math.sqrt(mx * mx + my * my);
    if (ml > 1) { mx /= ml; my /= ml; }
    if (ml > 0.08) {
      player.faceX = mx / (ml || 1);
      player.faceY = my / (ml || 1);
      player.walkT += dt;
    }
    player.x += mx * player.speed * dt;
    player.y += my * player.speed * dt;
    if (player.x < player.r) player.x = player.r;
    if (player.x > VIEW_W - player.r) player.x = VIEW_W - player.r;
    if (player.y < player.r) player.y = player.r;
    if (player.y > VIEW_H - player.r) player.y = VIEW_H - player.r;

    if (player.invuln > 0) player.invuln -= dt;

    // ----- auto fire -----
    player.fireTimer -= dt;
    if (player.fireTimer <= 0) {
      fireAtNearest();
      player.fireTimer = player.fireInterval;
    }

    // ----- wave manager -----
    if (waveState === 'break') {
      waveTimer -= dt;
      if (waveTimer <= 0) startWave();
    } else {
      spawnTimer -= dt;
      if (spawnQueue > 0 && spawnTimer <= 0) {
        spawnEnemy();
        spawnQueue -= 1;
        spawnTimer = waveSpawnInterval(wave);
      }
      if (spawnQueue <= 0 && enemies.length === 0) {
        completeWave();
      }
    }

    // ----- enemies -----
    for (var i = enemies.length - 1; i >= 0; i--) {
      var e = enemies[i];
      if (e.hitFlash > 0) e.hitFlash -= dt;
      var dx = player.x - e.x, dy = player.y - e.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      e.x += dx / d * e.speed * dt;
      e.y += dy / d * e.speed * dt;
      if (d < player.r + e.r - 2) {
        damagePlayer(e.dmg, e.x, e.y);
      }
    }
    // light separation so enemies don't fully stack
    for (var a = 0; a < enemies.length; a++) {
      for (var b = a + 1; b < enemies.length; b++) {
        var ea = enemies[a], eb = enemies[b];
        var sx = eb.x - ea.x, sy = eb.y - ea.y;
        var sd = Math.sqrt(sx * sx + sy * sy) || 1;
        var min = (ea.r + eb.r) * 0.82;
        if (sd < min) {
          var push = (min - sd) / 2;
          ea.x -= sx / sd * push;
          ea.y -= sy / sd * push;
          eb.x += sx / sd * push;
          eb.y += sy / sd * push;
        }
      }
    }

    // ----- bullets -----
    for (var j = bullets.length - 1; j >= 0; j--) {
      var bt = bullets[j];
      bt.x += bt.vx * dt;
      bt.y += bt.vy * dt;
      bt.life -= dt;
      if (bt.life <= 0 || bt.x < -20 || bt.x > VIEW_W + 20 || bt.y < -20 || bt.y > VIEW_H + 20) {
        bullets.splice(j, 1);
        continue;
      }
      for (var k = enemies.length - 1; k >= 0; k--) {
        var e2 = enemies[k];
        if (bt.hit.indexOf(e2.uid) >= 0) continue;
        var tdx = e2.x - bt.x, tdy = e2.y - bt.y;
        if (tdx * tdx + tdy * tdy < (e2.r + 4) * (e2.r + 4)) {
          e2.hp -= bt.dmg;
          e2.hitFlash = 0.12;
          bt.hit.push(e2.uid);
          SJ.Audio.play('hit');
          spawnParticles(bt.x, bt.y, bt.crit ? pal.bulletHi : pal.spark, bt.crit ? 6 : 3, 90);
          if (bt.crit) addFloater(e2.x, e2.y - 12, '×2', pal.bullet);
          if (e2.hp <= 0) {
            addFloater(e2.x, e2.y - 8, '+' + (10 + wave * 2), pal.xp);
            killEnemy(k);
          }
          if (bt.pierce > 0) {
            bt.pierce -= 1;
          } else {
            bullets.splice(j, 1);
          }
          break;
        }
      }
    }

    // ----- xp orbs -----
    for (var o = orbs.length - 1; o >= 0; o--) {
      var orb = orbs[o];
      var odx = player.x - orb.x, ody = player.y - orb.y;
      var od = Math.sqrt(odx * odx + ody * ody) || 1;
      // gentle drift decay
      orb.vx *= 0.92;
      orb.vy *= 0.92;
      if (od < player.pickupR) {
        var pull = 210 + (player.pickupR - od) * 8;
        orb.x += odx / od * pull * dt;
        orb.y += ody / od * pull * dt;
      } else {
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
      }
      if (od < player.r + 7) {
        orbs.splice(o, 1);
        addXp(orb.value);
        SJ.Audio.play('pickup');
        spawnParticles(orb.x, orb.y, pal.xp, 3, 70);
      }
    }

    updateEffects(dt);
    updateHUD();
  }

  function updateEffects(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    for (var j = floaters.length - 1; j >= 0; j--) {
      var f = floaters[j];
      f.life -= dt;
      if (f.life <= 0) { floaters.splice(j, 1); continue; }
      f.y += f.vy * dt;
      f.vy *= 0.96;
    }
  }

  // ---------- render ----------
  function circle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFloor() {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = pal.grid;
    var g = 24;
    for (var x = g; x < VIEW_W; x += g) {
      for (var y = g; y < VIEW_H; y += g) {
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    // arena border walls
    ctx.fillStyle = pal.wall;
    ctx.fillRect(0, 0, VIEW_W, 6);
    ctx.fillRect(0, VIEW_H - 6, VIEW_W, 6);
    ctx.fillRect(0, 0, 6, VIEW_H);
    ctx.fillRect(VIEW_W - 6, 0, 6, VIEW_H);
    ctx.fillStyle = pal.wallDark;
    ctx.fillRect(0, 5, VIEW_W, 2);
    ctx.fillRect(0, VIEW_H - 7, VIEW_W, 2);
    ctx.fillRect(5, 0, 2, VIEW_H);
    ctx.fillRect(VIEW_W - 7, 0, 2, VIEW_H);
  }

  function drawEnemy(e) {
    var col = e.type === 'brute' ? pal.brute : (e.type === 'runner' ? pal.runner : pal.slime);
    var dark = e.type === 'brute' ? pal.bruteDark : (e.type === 'runner' ? pal.runnerDark : pal.slimeDark);
    if (e.hitFlash > 0) col = pal.spark;

    if (e.type === 'runner') {
      // teardrop-ish runner
      circle(e.x, e.y + 1, e.r, col);
      circle(e.x, e.y - 3, e.r * 0.72, col);
    } else {
      circle(e.x, e.y + e.r * 0.12, e.r, col);
      circle(e.x - e.r * 0.35, e.y - e.r * 0.55, e.r * 0.52, col);
      circle(e.x + e.r * 0.35, e.y - e.r * 0.55, e.r * 0.52, col);
    }

    // eyes
    var lookX = (player.x - e.x) * 0.02;
    var lookY = (player.y - e.y) * 0.02;
    circle(e.x - e.r * 0.32 + lookX, e.y - e.r * 0.12 + lookY, e.r * 0.22, '#ffffff');
    circle(e.x + e.r * 0.32 + lookX, e.y - e.r * 0.12 + lookY, e.r * 0.22, '#ffffff');
    circle(e.x - e.r * 0.32 + lookX * 1.6, e.y - e.r * 0.12 + lookY * 1.6, e.r * 0.11, '#1c1c1c');
    circle(e.x + e.r * 0.32 + lookX * 1.6, e.y - e.r * 0.12 + lookY * 1.6, e.r * 0.11, '#1c1c1c');

    // hp bar when damaged
    if (e.hp < e.maxHp) {
      var w = e.r * 2;
      var ratio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = pal.hpBarBg;
      ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w, 4);
      ctx.fillStyle = pal.hpBar;
      ctx.fillRect(e.x - w / 2, e.y - e.r - 9, w * ratio, 4);
    }
  }

  function drawPlayer() {
    var blink = player.invuln > 0 && Math.floor(nowSec * 16) % 2 === 0;
    if (blink) return;

    var bob = Math.sin(player.walkT * 9) * 1.2;
    // shadow
    ctx.fillStyle = pal.hpBarBg;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + player.r * 0.85, player.r * 0.95, player.r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    circle(player.x, player.y + bob * 0.3, player.r, pal.player);
    circle(player.x - player.r * 0.25, player.y - player.r * 0.35 + bob * 0.3, player.r * 0.55, pal.playerHi);

    // face
    var fx = player.faceX * 2.6;
    var fy = player.faceY * 2.0;
    circle(player.x - 3.4 + fx, player.y - 1.2 + fy + bob * 0.3, 1.7, pal.playerFace);
    circle(player.x + 3.4 + fx, player.y - 1.2 + fy + bob * 0.3, 1.7, pal.playerFace);
    // smile
    ctx.strokeStyle = pal.playerFace;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(player.x + fx * 0.7, player.y + 2.6 + fy * 0.7 + bob * 0.3, 3.4, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // feet
    var step = Math.sin(player.walkT * 10) * 2.2;
    circle(player.x - 5, player.y + player.r - 2 + step * 0.4, 2.6, pal.playerDark);
    circle(player.x + 5, player.y + player.r - 2 - step * 0.4, 2.6, pal.playerDark);
  }

  function drawOrb(o) {
    var bobY = Math.sin(nowSec * 4 + o.phase) * 1.6;
    circle(o.x, o.y + bobY, 4.6, pal.xp);
    circle(o.x - 1.2, o.y - 1.2 + bobY, 1.8, pal.xpHi);
  }

  function drawBullet(b) {
    circle(b.x, b.y, 4, pal.bullet);
    circle(b.x - b.vx * 0.012, b.y - b.vy * 0.012, 2.4, pal.bulletHi);
  }

  function render() {
    drawFloor();

    for (var i = 0; i < orbs.length; i++) drawOrb(orbs[i]);
    for (var j = 0; j < bullets.length; j++) drawBullet(bullets[j]);
    for (var k = 0; k < enemies.length; k++) drawEnemy(enemies[k]);
    drawPlayer();

    for (var p = 0; p < particles.length; p++) {
      var pa = particles[p];
      ctx.globalAlpha = Math.max(0, pa.life / pa.maxLife);
      circle(pa.x, pa.y, pa.size, pa.color);
    }
    ctx.globalAlpha = 1;

    for (var f = 0; f < floaters.length; f++) {
      var fl = floaters[f];
      ctx.globalAlpha = Math.max(0, fl.life / fl.maxLife);
      ctx.fillStyle = fl.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fl.text, fl.x, fl.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- HUD / overlays ----------
  function updateHUD() {
    var hpRatio = Math.max(0, player.hp / player.maxHp);
    document.getElementById('hp-bar').style.width = (hpRatio * 100).toFixed(1) + '%';
    document.getElementById('hp-text').textContent =
      Math.ceil(player.hp) + '/' + Math.round(player.maxHp);
    var xpRatio = Math.min(1, xp / xpNeed);
    document.getElementById('xp-bar').style.width = (xpRatio * 100).toFixed(1) + '%';
    document.getElementById('xp-text').textContent = 'Lv.' + level;
    document.getElementById('hud-wave').textContent = String(wave);
    document.getElementById('hud-kills').textContent = String(kills);
    document.getElementById('hud-score').textContent = String(score);
  }

  function showOverlay(id) {
    ['ov-menu', 'ov-levelup', 'ov-pause', 'ov-gameover'].forEach(function (oid) {
      document.getElementById(oid).hidden = oid !== id;
    });
  }

  function applyI18n() {
    var nodes = document.querySelectorAll('[data-i18n]');
    Array.prototype.forEach.call(nodes, function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.getElementById('menu-best-wave').textContent = String(bestWave);
    document.getElementById('menu-best-score').textContent = String(bestScore);
    if (gameState === 'levelup') renderLevelUp();
  }

  function bindUI() {
    document.getElementById('btn-home').onclick = function () {
      GamePlatform.navigate.goHome();
    };
    document.getElementById('btn-start').onclick = function () { startGame(); };
    document.getElementById('btn-clear').onclick = function () {
      GamePlatform.storage.clear();
      bestScore = 0;
      bestWave = 0;
      document.getElementById('menu-best-wave').textContent = '0';
      document.getElementById('menu-best-score').textContent = '0';
      GamePlatform.ui.toast(t('cleared'));
    };
    document.getElementById('btn-pause').onclick = togglePause;
    document.getElementById('btn-fullscreen').onclick = function () {
      GamePlatform.ui.requestFullscreen(document.getElementById('stage'));
    };
    document.getElementById('btn-resume').onclick = function () { resumeGame(); };
    document.getElementById('btn-restart-pause').onclick = function () { startGame(); };
    document.getElementById('btn-home-pause').onclick = function () {
      GamePlatform.navigate.goHome();
    };
    document.getElementById('btn-again').onclick = function () { startGame(); };
    document.getElementById('btn-home-go').onclick = function () {
      GamePlatform.navigate.goHome();
    };
  }

  function togglePause() {
    if (gameState === 'playing') pauseGame();
    else if (gameState === 'paused') resumeGame();
  }

  // ---------- easter egg hooks (driven by js/cheats.js) ----------
  SJ.CheatAPI = {
    getPlayer: function () { return player; },
    getDefaults: function () { return makePlayer(); },
    getState: function () { return gameState; },
    pause: pauseGame,
    resume: resumeGame,
    isGod: function () { return godMode; },
    setGod: function (v) { godMode = !!v; },
    fullHeal: function () {
      player.hp = player.maxHp;
      updateHUD();
    },
    clearEnemies: function () { enemies.length = 0; },
    addScore: function (v) {
      score += v;
      updateHUD();
    },
    getScore: function () { return score; }
  };

  // ---------- main loop ----------
  var lastTs = 0, acc = 0;

  function frame(ts) {
    if (!lastTs) lastTs = ts;
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.1) dt = 0.1;

    var input = SJ.Input.state;
    if (input.pauseQueued) {
      input.pauseQueued = false;
      togglePause();
    }
    if (input.pickQueued >= 0) {
      var pick = input.pickQueued;
      input.pickQueued = -1;
      if (gameState === 'levelup') chooseUpgrade(pick);
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
    bestScore = GamePlatform.storage.get('bestScore', 0);
    bestWave = GamePlatform.storage.get('bestWave', 0);
    rebuildPal();
    resetRun();
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
