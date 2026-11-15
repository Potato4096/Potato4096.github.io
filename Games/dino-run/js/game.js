/* dino-run - core game: endless runner, cacti & pterodactyls, day/night cycle */
(function () {
  'use strict';

  var DR = window.DR = window.DR || {};

  // ---------- constants ----------
  var W = 800, H = 300;
  var GROUND_Y = 252;
  var DINO_X = 84;
  var DINO_S = 1.4; // 精灵缩放（碰撞盒同步缩放）
  var GRAVITY = 2600, JUMP_V = -890, MAX_FALL = 1600;
  var SPEED_BASE = 380, SPEED_MAX = 880;
  var SCORE_RATE = 0.025;
  var NIGHT_EVERY = 700;
  var START_GAP = 560;

  // ---------- i18n ----------
  var STR = {
    title: { zh: '断网恐龙', en: 'Dino Run' },
    tagline: {
      zh: '向 Chrome 断网页致敬：跳过仙人掌、低头躲翼龙，跑得越远速度越快，还会昼夜交替。',
      en: 'A tribute to the Chrome offline page: leap cacti, duck under pterodactyls, and outrun the night.'
    },
    score: { zh: '得分', en: 'Score' },
    best: { zh: '最高分', en: 'Best' },
    speed: { zh: '速度', en: 'Speed' },
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
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    pauseBtn: { zh: '暂停', en: 'Pause' },
    jump: { zh: '跳跃', en: 'Jump' },
    duck: { zh: '下蹲', en: 'Duck' },
    tapHint: { zh: '空格 / 点击 起跑', en: 'Space / Tap to run' },
    controls: {
      zh: '操作：空格 / ↑ / 点击跳跃（按住跳更高），↓ 下蹲，Esc / P 暂停。每 100 分闪一次，每 700 分进入夜间。',
      en: 'Controls: Space / Up / tap to jump (hold for height), Down to duck, Esc / P to pause. Milestone every 100, night falls every 700.'
    }
  };
  function t(k) { return GamePlatform.i18n.t(STR[k] || { zh: k, en: k }); }

  // ---------- canvas ----------
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  var fitCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function fit(cv, cx, w, h) {
    if (!cv || !cx || !w || !h) return cx;
    var dpr = window.devicePixelRatio || 1;
    var prev = fitCache ? fitCache.get(cv) : null;
    if (!prev || prev.w !== w || prev.h !== h) {
      cv.width = w;
      cv.height = h;
    }
    var rect = cv.getBoundingClientRect();
    var cssW = rect.width || w;
    var bw = Math.max(1, Math.round(cssW * dpr));
    var bh = Math.max(1, Math.round((h * bw) / w));
    if (!prev || prev.bw !== bw || prev.bh !== bh || prev.dpr !== dpr ||
        prev.w !== w || prev.h !== h || cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
      if (fitCache) fitCache.set(cv, { bw: bw, bh: bh, dpr: dpr, w: w, h: h });
    }
    cx.setTransform(bw / w, 0, 0, bh / h, 0, 0);
    return cx;
  }

  // ---------- palettes (day / night × light / dark) ----------
  var SKIN = {
    lightDay: {
      skyTop: '#fbfdff', skyBottom: '#ffffff',
      ground: '#f4f5f7', line: '#535353', dino: '#535353',
      cactus: '#5a9e4a', cactusDark: '#3f7a33',
      mountain: '#e6edf5', score: '#535353', accentTint: '#4f6df5'
    },
    lightNight: {
      skyTop: '#2a3a4d', skyBottom: '#17202b',
      ground: '#1a2431', line: '#c7d3e0', dino: '#e9eef5',
      cactus: '#5da84c', cactusDark: '#417a37',
      mountain: '#243447', score: '#e9eef5', accentTint: '#8fb4ff'
    },
    darkDay: {
      skyTop: '#101824', skyBottom: '#0b121b',
      ground: '#1a2331', line: '#8fa0b4', dino: '#dbe4ef',
      cactus: '#4f8f42', cactusDark: '#356b2c',
      mountain: '#16233a', score: '#dbe4ef', accentTint: '#7c93ff'
    },
    darkNight: {
      skyTop: '#050a11', skyBottom: '#0a1018',
      ground: '#0a1018', line: '#9fb0c3', dino: '#dfe8f2',
      cactus: '#4c8f40', cactusDark: '#2f6a28',
      mountain: '#101a28', score: '#dfe8f2', accentTint: '#a8c0ff'
    }
  };
  var daySrc = SKIN.lightDay, nightSrc = SKIN.lightNight;
  var cur = {}, nightLevel = 0, nightTarget = 0;
  var isDark = false;
  var skyGrad = null, gradNight = -1;

  function parseRGB(c) {
    if (c == null) return null;
    var s = String(c).trim();
    if (s.charAt(0) === '#') {
      var h = s.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      if (h.length < 6) return null;
      var n = parseInt(h.slice(0, 6), 16);
      if (isNaN(n)) return null;
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      var p = m[1].split(',');
      var r = parseFloat(p[0]), g = parseFloat(p[1]), b = parseFloat(p[2]);
      if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
      return [r, g, b];
    }
    return null;
  }
  function mix(a, b, tt) {
    var ca = parseRGB(a), cb = parseRGB(b);
    if (!ca || !cb) return a;
    return 'rgb(' + Math.round(ca[0] + (cb[0] - ca[0]) * tt) + ',' +
      Math.round(ca[1] + (cb[1] - ca[1]) * tt) + ',' +
      Math.round(ca[2] + (cb[2] - ca[2]) * tt) + ')';
  }
  function tint(hex, bg, amount) {
    return mix(hex, bg, amount);
  }

  function rebuildPal() {
    var mode = GamePlatform.theme.get();
    isDark = mode === 'dark';
    var day = isDark ? SKIN.darkDay : SKIN.lightDay;
    var night = isDark ? SKIN.darkNight : SKIN.lightNight;
    var packBg = isDark ? '#12151d' : '#f6f7fb';
    var accent = isDark ? '#7c93ff' : '#4f6df5';
    try {
      var c = GamePlatform.themePacks.colors();
      packBg = c.bg;
      accent = c.accent;
    } catch (e) { /* fallback */ }

    var k;
    daySrc = {}; nightSrc = {};
    for (k in day) daySrc[k] = day[k];
    for (k in night) nightSrc[k] = night[k];
    daySrc.skyTop = tint(day.skyTop, packBg, 0.18);
    daySrc.skyBottom = tint(day.skyBottom, packBg, 0.10);
    daySrc.mountain = tint(day.mountain, packBg, 0.18);
    daySrc.accentTint = accent;
    nightSrc.accentTint = accent;
    gradNight = -1;
    refreshColors();
  }

  function refreshColors() {
    var k;
    for (k in daySrc) cur[k] = mix(daySrc[k], nightSrc[k], nightLevel);
    if (Math.abs(nightLevel - gradNight) > 0.008) {
      gradNight = nightLevel;
      try {
        var grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
        grad.addColorStop(0, cur.skyTop);
        grad.addColorStop(1, cur.skyBottom);
        skyGrad = grad;
      } catch (e) {
        skyGrad = cur.skyTop;
      }
    }
  }

  // ---------- state ----------
  var state = 'menu'; // menu | ready | playing | paused | dying | gameover
  var dino, obstacles, clouds, groundDots, stars;
  var distance = 0, score = 0, best = 0, speed = SPEED_BASE;
  var obstacleGap = START_GAP, sinceSpawn = 0;
  var nextMilestone = 100, nextNight = NIGHT_EVERY;
  var blink = 0, flash = 0, shake = 0, dieTimer = 0;
  var jumpHeld = false, duckHeld = false;
  var timeSec = 0;

  /* 修改器状态 */
  var cheatGod = false;
  var cheatSpeedVal = 0;
  var cheatForceNight = false;

  function currentSpeed() {
    if (cheatSpeedVal > 0) return cheatSpeedVal;
    return Math.min(SPEED_BASE + score * 0.85, SPEED_MAX);
  }

  function resetScene() {
    dino = { y: GROUND_Y, vy: 0, onGround: true, ducking: false, run: 0, blinkTimer: 2 + Math.random() * 3, blink: 0 };
    obstacles = [];
    distance = 0;
    score = 0;
    speed = SPEED_BASE;
    obstacleGap = START_GAP;
    sinceSpawn = 0;
    nextMilestone = 100;
    nextNight = NIGHT_EVERY;
    nightLevel = cheatForceNight ? 1 : 0;
    nightTarget = nightLevel;
    blink = 0;
    flash = 0;
    shake = 0;
    dieTimer = 0;
    jumpHeld = false;
    duckHeld = false;

    clouds = [];
    for (var i = 0; i < 5; i++) {
      clouds.push({ x: Math.random() * W, y: 24 + Math.random() * 90, s: 0.6 + Math.random() * 0.8, sp: 0.16 + Math.random() * 0.18 });
    }

    groundDots = [];
    for (var j = 0; j < 90; j++) {
      groundDots.push({
        x: Math.random() * 1600,
        y: GROUND_Y + 8 + Math.random() * 38,
        w: 2 + Math.random() * 10,
        h: 1 + Math.random() * 2
      });
    }

    stars = [];
    for (var s = 0; s < 60; s++) {
      stars.push({ x: Math.random() * W, y: 12 + Math.random() * 150, r: 0.7 + Math.random() * 1.3, p: Math.random() * 6.28 });
    }

    refreshColors();
    updateHUD();
  }

  function startGame() {
    best = GamePlatform.storage.get('best', 0) || 0;
    resetScene();
    state = 'ready';
    hideOverlays();
    DR.audio.play('start');
    updateHUD();
  }

  // ---------- obstacles ----------
  function makeCactus(x) {
    var large = Math.random() < 0.38;
    var count = Math.random() < 0.18 ? 3 : (Math.random() < 0.42 ? 2 : 1);
    var unitW = large ? 26 : 18;
    var unitH = large ? 58 : 40;
    var parts = [];
    var totalW = 0;
    for (var i = 0; i < count; i++) {
      var h = unitH * (0.86 + Math.random() * 0.22);
      parts.push({ dx: totalW, w: unitW, h: Math.round(h) });
      totalW += unitW + 6;
    }
    totalW -= 6;
    return { kind: 'cactus', x: x, w: totalW, h: unitH, parts: parts };
  }

  function makeBird(x) {
    var tops = [GROUND_Y - 118, GROUND_Y - 72, GROUND_Y - 40];
    var idx = Math.floor(Math.random() * tops.length);
    return { kind: 'bird', x: x, w: 38, h: 26, top: tops[idx], phase: Math.random() * 6.28 };
  }

  function scheduleGap() {
    var sp = currentSpeed();
    var secs = 0.82 + Math.random() * 0.72;
    return Math.max(260, sp * secs);
  }

  function spawnObstacle() {
    var useBird = score >= 250 && Math.random() < 0.32;
    var o = useBird ? makeBird(W + 20) : makeCactus(W + 20);
    obstacles.push(o);
    sinceSpawn = 0;
    obstacleGap = scheduleGap();
  }

  // ---------- physics ----------
  function jump() {
    if (state === 'menu' || state === 'paused' || state === 'dying' || state === 'gameover') return;
    if (state === 'ready') state = 'playing';
    if (dino.onGround) {
      dino.vy = JUMP_V;
      dino.onGround = false;
      dino.ducking = false;
      DR.audio.play('jump');
    }
  }

  function obstacleBox(o) {
    if (o.kind === 'bird') return { x: o.x + 5, y: o.top + 6, w: o.w - 12, h: 16 };
    return { x: o.x + 3, y: GROUND_Y - o.h + 3, w: o.w - 6, h: o.h - 3 };
  }
  function dinoBox() {
    if (dino.ducking && dino.onGround) {
      return { x: DINO_X + 2 * DINO_S, y: dino.y - 25 * DINO_S, w: 48 * DINO_S, h: 25 * DINO_S };
    }
    return { x: DINO_X + 8 * DINO_S, y: dino.y - 46 * DINO_S, w: 40 * DINO_S, h: 44 * DINO_S };
  }
  function rectsHit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function die() {
    if (state === 'dying' || state === 'gameover') return;
    state = 'dying';
    dieTimer = 0;
    flash = 0.5;
    shake = 0.9;
    DR.audio.play('hit');
  }

  function endGame() {
    state = 'gameover';
    var isNew = score > best;
    if (isNew) {
      best = score;
      GamePlatform.storage.set('best', best);
      try { GamePlatform.ui.toast(t('newRecord')); } catch (e) { /* ignore */ }
    }
    document.getElementById('go-score').textContent = GamePlatform.util.formatNumber(score);
    document.getElementById('go-best').textContent = GamePlatform.util.formatNumber(best);
    document.getElementById('menu-best').textContent = GamePlatform.util.formatNumber(best);
    document.getElementById('go-record').hidden = !isNew;
    updateHUD();
    showOverlay('ov-gameover');
  }

  function updateHUD() {
    document.getElementById('hud-score').textContent = GamePlatform.util.formatNumber(score);
    document.getElementById('hud-best').textContent = GamePlatform.util.formatNumber(best);
    document.getElementById('hud-speed').textContent = (currentSpeed() / SPEED_BASE).toFixed(1) + 'x';
  }

  function update(dt) {
    timeSec += dt;
    blink = Math.max(0, blink - dt);
    flash = Math.max(0, flash - dt * 2);
    shake = Math.max(0, shake - dt * 2.2);

    // 昼夜过渡
    var target = cheatForceNight ? 1 : nightTarget;
    if (Math.abs(nightLevel - target) > 0.001) {
      nightLevel += (target - nightLevel) * Math.min(1, dt * 1.6);
      if (Math.abs(nightLevel - target) < 0.002) nightLevel = target;
      refreshColors();
    }

    // 眼睛眨动
    if (dino) {
      dino.blinkTimer -= dt;
      if (dino.blinkTimer <= 0) {
        dino.blink = 0.12;
        dino.blinkTimer = 2.4 + Math.random() * 3.4;
      }
      dino.blink = Math.max(0, dino.blink - dt);
    }

    if (state === 'ready' || state === 'menu') {
      speed = SPEED_BASE;
      for (var i = 0; i < clouds.length; i++) {
        clouds[i].x -= 8 * dt;
        if (clouds[i].x < -120) clouds[i].x = W + 40;
      }
      return;
    }

    if (state === 'dying') {
      dieTimer += dt;
      if (dieTimer > 0.52) endGame();
      return;
    }

    if (state !== 'playing') return;

    // 世界滚动
    speed = currentSpeed();
    distance += speed * dt;
    sinceSpawn += speed * dt;

    for (var c = 0; c < clouds.length; c++) {
      clouds[c].x -= speed * clouds[c].sp * dt;
      if (clouds[c].x < -120) clouds[c].x = W + 40;
    }

    // 恐龙纵向运动
    var g = GRAVITY;
    if (dino.vy < 0 && jumpHeld) g *= 0.56;
    if (!dino.onGround && duckHeld) g *= 1.5;
    dino.vy = Math.min(dino.vy + g * dt, MAX_FALL);
    dino.y += dino.vy * dt;
    if (dino.y >= GROUND_Y) {
      if (!dino.onGround) { DR.audio.play('land'); }
      dino.y = GROUND_Y;
      dino.vy = 0;
      dino.onGround = true;
    }
    dino.ducking = dino.onGround && duckHeld;
    dino.run += dt * (dino.onGround ? 9 + speed / 90 : 0);

    // 障碍物
    for (var k = obstacles.length - 1; k >= 0; k--) {
      var o = obstacles[k];
      o.x -= speed * dt;
      if (o.kind === 'bird') o.phase += dt * 9;
      if (o.x + o.w < -30) obstacles.splice(k, 1);
    }
    if (sinceSpawn >= obstacleGap) spawnObstacle();

    // 分数
    var newScore = Math.floor(distance * SCORE_RATE);
    if (newScore !== score) {
      score = newScore;
      if (score >= nextMilestone) {
        nextMilestone += 100;
        blink = 0.92;
        DR.audio.play('point');
      }
      if (score >= nextNight) {
        nextNight += NIGHT_EVERY;
        nightTarget = nightTarget > 0.5 ? 0 : 1;
        DR.audio.play('night');
      }
      updateHUD();
    }

    // 碰撞
    if (!cheatGod) {
      var box = dinoBox();
      for (var m = 0; m < obstacles.length; m++) {
        var ob = obstacles[m];
        if (ob.x > DINO_X + 80 || ob.x + ob.w < DINO_X - 20) continue;
        if (rectsHit(box, obstacleBox(ob))) { die(); return; }
      }
    }
  }

  // ---------- rendering ----------
  function px(x, y, w, h) {
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSky() {
    ctx.fillStyle = skyGrad || cur.skyTop;
    ctx.fillRect(0, 0, W, H);

    // 星星
    if (nightLevel > 0.02) {
      ctx.globalAlpha = nightLevel * 0.85;
      ctx.fillStyle = '#ffffff';
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.globalAlpha = nightLevel * (0.45 + Math.sin(timeSec * 1.4 + s.p) * 0.35);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 太阳 / 月亮
    if (nightLevel < 0.98) {
      ctx.globalAlpha = 1 - nightLevel;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(430, 56, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (nightLevel > 0.02) {
      ctx.globalAlpha = nightLevel;
      ctx.fillStyle = '#f2f6ff';
      ctx.beginPath();
      ctx.arc(430, 56, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = cur.skyTop;
      ctx.beginPath();
      ctx.arc(423, 50, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 云
    for (var c = 0; c < clouds.length; c++) {
      var cl = clouds[c];
      ctx.globalAlpha = 0.9 - nightLevel * 0.66;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(cl.x, cl.y, 26 * cl.s, 11 * cl.s, 0, 0, Math.PI * 2);
      ctx.ellipse(cl.x + 20 * cl.s, cl.y + 3 * cl.s, 18 * cl.s, 9 * cl.s, 0, 0, Math.PI * 2);
      ctx.ellipse(cl.x - 20 * cl.s, cl.y + 4 * cl.s, 15 * cl.s, 8 * cl.s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 远山
    drawMountains();
  }

  function drawMountains() {
    var off = distance * 0.16;
    ctx.fillStyle = cur.mountain;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 2);
    for (var x = 0; x <= W; x += 10) {
      var y = GROUND_Y - 34
        - Math.abs(Math.sin((x + off) / 150)) * 42
        - Math.abs(Math.sin((x + off) / 61)) * 12;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, GROUND_Y + 2);
    ctx.closePath();
    ctx.fill();
  }

  function drawGround() {
    ctx.fillStyle = cur.ground;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    ctx.fillStyle = cur.line;
    ctx.fillRect(0, GROUND_Y, W, 2);

    // 地面碎石（两层视差）
    var off1 = distance % 1600;
    ctx.globalAlpha = 0.35;
    for (var i = 0; i < groundDots.length; i++) {
      var d = groundDots[i];
      var x = d.x - off1;
      if (x < -30) x += 1600;
      if (x > W + 30) continue;
      ctx.fillRect(Math.round(x), Math.round(d.y), Math.round(d.w), Math.round(d.h));
    }
    ctx.globalAlpha = 1;
  }

  function drawDino() {
    var bx = DINO_X, by = dino.y;

    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(DINO_S, DINO_S);
    ctx.translate(-bx, -by);
    ctx.fillStyle = cur.dino;

    // P(dx, y, w, h)：x 相对恐龙左边界，y 为矩形底边离地高度
    function P(dx, y, w, h) {
      px(bx + dx, by - (y + h), w, h);
    }

    if (dino.ducking) {
      P(-8, 4, 12, 7);          // 尾巴
      P(0, 8, 30, 14);          // 身体
      P(4, 20, 24, 6);          // 背脊
      P(28, 10, 16, 12);        // 头
      P(42, 13, 8, 6);          // 吻部
      ctx.fillStyle = cur.skyTop;
      P(40, 15, 5, 5);          // 眼白
      ctx.fillStyle = cur.dino;
      P(41, 16, 2, 2);          // 瞳孔
      P(4, 0, 5, 10);           // 腿
      P(16, 0, 5, 10);
      P(4, 0, 9, 3);            // 脚
      P(16, 0, 9, 3);
      ctx.restore();
      return;
    }

    // 尾巴（左后，尖朝左上）
    P(0, 27, 8, 7);
    P(5, 23, 10, 8);
    // 身体
    P(10, 12, 26, 18);
    P(14, 28, 16, 5);
    // 脖子
    P(28, 28, 10, 9);
    // 头
    P(32, 36, 16, 12);
    // 吻部 / 下颚
    P(46, 38, 9, 6);
    P(46, 34, 6, 4);
    // 眼睛
    if (dino.blink > 0) {
      ctx.fillStyle = cur.skyTop;
      P(39, 43, 5, 2);
      ctx.fillStyle = cur.dino;
    } else {
      ctx.fillStyle = cur.skyTop;
      P(39, 41, 5, 5);
      ctx.fillStyle = cur.dino;
      P(41, 42, 2, 2);
    }
    // 手臂
    P(34, 19, 8, 3);

    // 腿
    if (!dino.onGround) {
      // 跳跃：双腿微收
      P(13, 4, 5, 10);
      P(13, 2, 9, 3);
      P(23, 3, 5, 11);
      P(23, 2, 9, 3);
    } else {
      var moving = state === 'playing';
      var ph = Math.floor(dino.run) % 2;
      var liftA = 0, liftB = 0;
      if (moving) {
        liftA = ph === 0 ? 0 : 7;
        liftB = ph === 1 ? 0 : 7;
      }
      drawLeg(13, liftA);
      drawLeg(23, liftB);
    }

    ctx.restore();
  }

  function drawLeg(ox, lift) {
    var bx = DINO_X, by = dino.y;
    px(bx + ox, by - 14, 5, 14 - lift);                   // 小腿：底边抬到 y=lift
    px(bx + ox, by - (Math.max(0, lift - 1) + 3), 9, 3);  // 脚掌
  }

  function drawCactus(o) {
    for (var i = 0; i < o.parts.length; i++) {
      var p = o.parts[i];
      var cx = o.x + p.dx;
      var top = GROUND_Y - p.h;
      var trunkW = Math.max(7, Math.round(p.w * 0.46));
      var tx = cx + Math.round((p.w - trunkW) / 2);
      var armTh = Math.max(4, Math.round(trunkW * 0.55));
      var armY = top + p.h * 0.42;

      ctx.fillStyle = cur.cactusDark;
      roundRect(tx + 1, top + 2, trunkW, p.h, 3);
      ctx.fill();

      ctx.fillStyle = cur.cactus;
      roundRect(tx, top, trunkW, p.h, 3);
      ctx.fill();

      // 左臂
      roundRect(cx, armY, tx - cx + trunkW * 0.5, armTh, 2);
      ctx.fill();
      roundRect(cx, armY - p.h * 0.18, armTh, p.h * 0.18 + armTh, 2);
      ctx.fill();

      // 右臂
      var rEnd = cx + p.w;
      roundRect(tx + trunkW * 0.5, armY + p.h * 0.1, rEnd - tx - trunkW * 0.5, armTh, 2);
      ctx.fill();
      roundRect(rEnd - armTh, armY - p.h * 0.1, armTh, p.h * 0.1 + armTh, 2);
      ctx.fill();

      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      px(tx + 2, top + 4, 2, p.h - 8);
    }
  }

  function drawBird(o) {
    var x = o.x, top = o.top;
    var up = Math.sin(o.phase) > 0;
    ctx.fillStyle = cur.dino;

    // 翅膀
    ctx.beginPath();
    if (up) {
      ctx.moveTo(x + 9, top + 14);
      ctx.lineTo(x + 19, top - 6);
      ctx.lineTo(x + 26, top + 14);
    } else {
      ctx.moveTo(x + 9, top + 13);
      ctx.lineTo(x + 19, top + 30);
      ctx.lineTo(x + 26, top + 13);
    }
    ctx.closePath();
    ctx.fill();

    // 身体
    px(x + 4, top + 10, 22, 9);
    // 头
    px(x + 18, top + 6, 12, 10);
    // 嘴
    ctx.beginPath();
    ctx.moveTo(x + 28, top + 9);
    ctx.lineTo(x + 40, top + 12);
    ctx.lineTo(x + 28, top + 15);
    ctx.closePath();
    ctx.fill();
    // 眼
    ctx.fillStyle = cur.skyTop;
    px(x + 22, top + 8, 3, 3);
  }

  function drawScore() {
    if (state === 'menu') return;
    ctx.save();
    ctx.font = '700 24px "Consolas", "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    var alpha = 1;
    if (blink > 0) alpha = Math.floor(blink * 12) % 2 === 0 ? 0.28 : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = cur.score;
    ctx.fillText('HI ' + pad(best) + '   ' + pad(score), W - 24, 46);
    ctx.restore();
  }

  function pad(n) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < 5) s = '0' + s;
    return s;
  }

  function drawHint() {
    if (state !== 'ready') return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 17px "Segoe UI", "PingFang SC", sans-serif';
    var label = t('tapHint');
    var w = ctx.measureText(label).width + 44;
    ctx.fillStyle = nightLevel > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(20, 28, 40, 0.72)';
    roundRect(W / 2 - w / 2, 100, w, 40, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, W / 2, 121);
    ctx.restore();
  }

  function draw() {
    fit(canvas, ctx, W, H);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (shake > 0.01) {
      var amp = shake * 6;
      ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
    }

    drawSky();
    drawGround();

    for (var i = 0; i < obstacles.length; i++) {
      if (obstacles[i].kind === 'bird') drawBird(obstacles[i]);
      else drawCactus(obstacles[i]);
    }

    if (dino) drawDino();

    drawScore();
    drawHint();

    if (flash > 0) {
      ctx.fillStyle = 'rgba(255, 92, 92, ' + (flash * 0.4).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // ---------- overlays / i18n ----------
  function showOverlay(id) {
    var ids = ['ov-menu', 'ov-pause', 'ov-gameover'];
    for (var i = 0; i < ids.length; i++) {
      document.getElementById(ids[i]).hidden = ids[i] !== id;
    }
  }
  function hideOverlays() { showOverlay(''); }

  function applyLang() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      if (STR[key]) nodes[i].textContent = t(key);
    }
  }

  // ---------- input ----------
  function togglePause() {
    if (state === 'playing' || state === 'ready') {
      state = 'paused';
      showOverlay('ov-pause');
    } else if (state === 'paused') {
      hideOverlays();
      state = 'ready';
    }
  }

  function bindInput() {
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      DR.audio.unlock();
      jumpHeld = true;
      if (state === 'menu') { startGame(); return; }
      jump();
    });
    canvas.addEventListener('pointerup', function () { jumpHeld = false; });
    canvas.addEventListener('pointercancel', function () { jumpHeld = false; });

    document.addEventListener('keydown', function (e) {
      DR.audio.unlock();
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (e.repeat) return;
        jumpHeld = true;
        if (state === 'menu') { startGame(); return; }
        jump();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        duckHeld = true;
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
      }
    });

    document.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        jumpHeld = false;
      }
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') duckHeld = false;
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && (state === 'playing' || state === 'ready')) togglePause();
    });

    var btnJump = document.getElementById('btn-jump');
    btnJump.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      DR.audio.unlock();
      jumpHeld = true;
      if (state === 'menu') { startGame(); return; }
      jump();
    });
    btnJump.addEventListener('pointerup', function () { jumpHeld = false; });
    btnJump.addEventListener('pointercancel', function () { jumpHeld = false; });

    var btnDuck = document.getElementById('btn-duck');
    btnDuck.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      duckHeld = true;
    });
    btnDuck.addEventListener('pointerup', function () { duckHeld = false; });
    btnDuck.addEventListener('pointercancel', function () { duckHeld = false; });

    document.getElementById('btn-home').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-pause').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-go').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-start').onclick = function () { DR.audio.unlock(); startGame(); };
    document.getElementById('btn-clear').onclick = function () {
      GamePlatform.storage.clear();
      best = 0;
      document.getElementById('menu-best').textContent = '0';
      updateHUD();
      GamePlatform.ui.toast(t('cleared'));
    };
    document.getElementById('btn-pause').onclick = togglePause;
    document.getElementById('btn-resume').onclick = togglePause;
    document.getElementById('btn-restart-pause').onclick = function () { hideOverlays(); startGame(); };
    document.getElementById('btn-again-go').onclick = function () { hideOverlays(); startGame(); };
    document.getElementById('btn-fullscreen').onclick = function () {
      if (GamePlatform.ui.isFullscreen()) GamePlatform.ui.exitFullscreen();
      else GamePlatform.ui.requestFullscreen();
    };
  }

  // ---------- main loop ----------
  var lastTs = 0;
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 1 / 30);
    lastTs = ts;
    // 单帧异常不应终结整个循环（否则画面会永久卡死）
    try {
      if (state !== 'paused') update(dt);
      draw();
    } catch (err) {
      if (window.console && window.console.error) window.console.error('[dino-run]', err);
    }
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  function init() {
    rebuildPal();
    best = GamePlatform.storage.get('best', 0) || 0;
    resetScene();
    state = 'menu';
    showOverlay('ov-menu');
    document.getElementById('menu-best').textContent = GamePlatform.util.formatNumber(best);
    applyLang();
    bindInput();
    updateHUD();
    requestAnimationFrame(frame);
  }

  GamePlatform.ready.then(function () {
    init();
    GamePlatform.settings.onChange(function (settings, changedKeys) {
      if (changedKeys.indexOf('lang') !== -1) applyLang();
    });
    GamePlatform.theme.onChange(function () { rebuildPal(); });
    GamePlatform.themePacks.onChange(function () { rebuildPal(); });
    GamePlatform.i18n.onChange(function () { applyLang(); });
  });

  DR.game = {
    get state() { return state; },
    get score() { return score; },
    get obstacles() { return obstacles ? obstacles.length : 0; }
  };

  /* ------------------------------------------------------------ */
  /* 修改器钩子（暗号 potato4096，见 platform/cheat-kit.js）        */
  /* ------------------------------------------------------------ */

  if (window.CheatKit) {
    CheatKit.init({
      id: 'dino-run',
      title: { zh: '🔧 修改器', en: '🔧 Modifier' },
      hint: { zh: '彩蛋面板 · 参数即时生效', en: 'Easter egg · changes apply instantly' },
      stats: [
        { label: { zh: '得分', en: 'Score' }, get: function () { return score; }, format: function (v) { return GamePlatform.util.formatNumber(v); } },
        { label: { zh: '最高分', en: 'Best' }, get: function () { return best; }, tone: 'success' },
        { label: { zh: '速度', en: 'Speed' }, get: function () { return Math.round(currentSpeed()); }, tone: 'warning' },
        { label: { zh: '障碍物', en: 'Obstacles' }, get: function () { return obstacles ? obstacles.length : 0; } },
        { label: { zh: '昼夜', en: 'Time' }, get: function () { return nightLevel > 0.5 ? 'N' : 'D'; } }
      ],
      params: [
        { key: 'score', label: { zh: '得分', en: 'Score' }, min: 0, max: 99999, step: 100,
          get: function () { return score; },
          set: function (v) {
            var target = Math.round(v);
            distance = target / SCORE_RATE;
            score = target;
            nextMilestone = (Math.floor(score / 100) + 1) * 100;
            nextNight = (Math.floor(score / NIGHT_EVERY) + 1) * NIGHT_EVERY;
            updateHUD();
          } },
        { key: 'speed', label: { zh: '速度 (0=自动)', en: 'Speed (0=auto)' }, min: 0, max: 1600, step: 10,
          get: function () { return cheatSpeedVal; },
          set: function (v) { cheatSpeedVal = v > 0 ? v : 0; updateHUD(); } }
      ],
      toggles: [
        { label: { zh: '无敌（不撞障碍）', en: 'God mode' },
          on: { zh: '无敌：开', en: 'God Mode: ON' },
          off: { zh: '无敌：关', en: 'God Mode: OFF' },
          get: function () { return cheatGod; },
          set: function (v) { cheatGod = !!v; } },
        { label: { zh: '强制夜晚', en: 'Force night' },
          on: { zh: '夜晚：开', en: 'Night: ON' },
          off: { zh: '夜晚：关', en: 'Night: OFF' },
          get: function () { return cheatForceNight; },
          set: function (v) {
            cheatForceNight = !!v;
            nightTarget = cheatForceNight ? 1 : 0;
            refreshColors();
          } }
      ],
      actions: [
        { label: { zh: '分数 +1000', en: '+1000 score' }, run: function () {
          distance += 1000 / SCORE_RATE;
          score = Math.floor(distance * SCORE_RATE);
          nextMilestone = (Math.floor(score / 100) + 1) * 100;
          updateHUD();
        } },
        { label: { zh: '立刻放一只翼龙', en: 'Spawn pterodactyl' }, run: function () {
          obstacles.push(makeBird(W + 10));
        } },
        { label: { zh: '清空障碍', en: 'Clear obstacles' }, run: function () { obstacles.length = 0; sinceSpawn = 0; } }
      ]
    });
  }
})();
