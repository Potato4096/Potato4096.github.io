/* happy-bird - core game: states, pipe spawning, physics, rendering */
(function () {
  'use strict';

  var HB = window.HB = window.HB || {};

  // ---------- constants ----------
  var W = 480, H = 600;
  var GROUND_Y = 520;
  var BIRD_X = 132, BIRD_R = 15;
  var GRAVITY = 1680, FLAP_V = -540, MAX_FALL = 780;
  var PIPE_W = 76, PIPE_SPACING = 258, PIPE_CAP_H = 26;
  var GAP_BASE = 202, GAP_MIN = 156;
  var SPEED_BASE = 166, SPEED_MAX = 280;
  var PARTICLES_MAX = 90;

  // ---------- i18n ----------
  var STR = {
    title: { zh: '快乐小鸟', en: 'Happy Bird' },
    tagline: {
      zh: '一下一下点出节奏，从水管缝里挤过去。越飞越快，缝隙也越来越窄。',
      en: 'Tap out a rhythm and squeeze through the pipe gaps. Faster and tighter the further you fly.'
    },
    score: { zh: '得分', en: 'Score' },
    best: { zh: '最高分', en: 'Best' },
    pipes: { zh: '管道', en: 'Pipes' },
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
    flap: { zh: '拍翅', en: 'Flap' },
    tapHint: { zh: '点击 / 空格 起飞', en: 'Tap / Space to fly' },
    controls: {
      zh: '操作：点击画面、空格或 ↑ 拍翅，Esc / P 暂停。穿过水管 +1 分，每 10 分提速、缝隙收窄。',
      en: 'Controls: click, Space or Up to flap; Esc / P to pause. +1 point per pipe, every 10 points speeds up and tightens the gap.'
    },
    'grade-none': { zh: '未上榜', en: 'No medal' },
    'grade-bronze': { zh: '铜牌', en: 'Bronze' },
    'grade-silver': { zh: '银牌', en: 'Silver' },
    'grade-gold': { zh: '金牌', en: 'Gold' },
    'grade-platinum': { zh: '白金', en: 'Platinum' }
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

  // ---------- palette ----------
  var WORLD = {
    light: {
      skyTop: '#a9e4ff', skyBottom: '#eaf9ff',
      sun: '#fff2b8', sunGlow: 'rgba(255, 226, 122, 0.55)',
      cloud: 'rgba(255, 255, 255, 0.95)', cloudShade: 'rgba(198, 227, 245, 0.9)',
      hillFar: '#c6ead6', hillNear: '#9fd9b6', bush: '#7fcb9e', bushDark: '#6bb98b',
      ground: '#e4dc9d', groundTop: '#86c34c', groundDark: '#c8bd77', groundLine: '#b6a962',
      pipeLight: '#a9e06a', pipeMid: '#7dc247', pipeDark: '#4f8a2c', pipeEdge: '#3d6d21',
      star: 'rgba(255,255,255,0.9)'
    },
    dark: {
      skyTop: '#0d1e30', skyBottom: '#1d3d55',
      sun: '#f4f7ff', sunGlow: 'rgba(190, 214, 255, 0.35)',
      cloud: 'rgba(96, 128, 158, 0.55)', cloudShade: 'rgba(66, 94, 122, 0.55)',
      hillFar: '#1b3c50', hillNear: '#214a5e', bush: '#2a5b6a', bushDark: '#1f4a58',
      ground: '#243a3a', groundTop: '#38624a', groundDark: '#1b2d2d', groundLine: '#152424',
      pipeLight: '#5d9a54', pipeMid: '#417d3f', pipeDark: '#2c5a2c', pipeEdge: '#1e4220',
      star: 'rgba(255,255,255,0.85)'
    }
  };
  var pal = WORLD.light;
  var isDark = false;
  var skyGrad = null, pipeGrad = null, groundGrad = null;
  var stars = [];

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

  function rebuildPal() {
    var mode = GamePlatform.theme.get();
    isDark = mode === 'dark';
    var base = WORLD[mode] || WORLD.light;
    var packBg = isDark ? '#12151d' : '#f6f7fb';
    var accent = '#4f6df5';
    try {
      var c = GamePlatform.themePacks.colors();
      packBg = c.bg;
      accent = c.accent;
    } catch (e) { /* fallback */ }
    pal = {};
    for (var k in base) pal[k] = base[k];
    pal.skyTop = mix(base.skyTop, packBg, isDark ? 0.32 : 0.22);
    pal.skyBottom = mix(base.skyBottom, packBg, isDark ? 0.24 : 0.14);
    pal.accent = accent;

    skyGrad = null;
    pipeGrad = null;
    groundGrad = null;
    try {
      var sg = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      sg.addColorStop(0, pal.skyTop);
      sg.addColorStop(1, pal.skyBottom);
      skyGrad = sg;

      var pg = ctx.createLinearGradient(0, 0, PIPE_W, 0);
      pg.addColorStop(0, pal.pipeLight);
      pg.addColorStop(0.3, pal.pipeMid);
      pg.addColorStop(0.68, pal.pipeMid);
      pg.addColorStop(1, pal.pipeDark);
      pipeGrad = pg;

      var gg = ctx.createLinearGradient(0, GROUND_Y, 0, H);
      gg.addColorStop(0, pal.groundTop);
      gg.addColorStop(0.18, pal.ground);
      gg.addColorStop(1, pal.groundDark);
      groundGrad = gg;
    } catch (e) {
      // 颜色异常时退回纯色，至少不黑屏
      skyGrad = pal.skyTop;
      pipeGrad = pal.pipeMid;
      groundGrad = pal.ground;
    }

    if (!stars.length) {
      for (var i = 0; i < 46; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * (GROUND_Y - 180),
          r: 0.7 + Math.random() * 1.5,
          p: Math.random() * Math.PI * 2
        });
      }
    }
  }

  // ---------- state ----------
  var state = 'menu'; // menu | ready | playing | paused | dying | gameover
  var score = 0, best = 0, pipesCleared = 0;
  var bird, pipes, clouds, particles, bushes;
  var scroll = 0, timeSec = 0;
  var dieTimer = 0, deathCause = '';
  var flash = 0, shake = 0;
  var keys = {};

  /* 修改器状态 */
  var cheatGod = false;
  var cheatSpeedVal = 0;
  var cheatGapVal = 0;

  function currentGap() {
    if (cheatGapVal > 0) return cheatGapVal;
    return Math.max(GAP_BASE - score * 1.1, GAP_MIN);
  }
  function currentSpeed() {
    if (cheatSpeedVal > 0) return cheatSpeedVal;
    return Math.min(SPEED_BASE + score * 1.9, SPEED_MAX);
  }

  function resetScene() {
    bird = { y: H * 0.42, vy: 0, rot: 0, wing: 0 };
    pipes = [];
    particles = [];
    scroll = 0;
    timeSec = 0;
    dieTimer = 0;
    flash = 0;
    shake = 0;
    score = 0;
    pipesCleared = 0;

    clouds = [];
    for (var i = 0; i < 5; i++) {
      clouds.push({
        x: Math.random() * W,
        y: 60 + Math.random() * 200,
        s: 0.55 + Math.random() * 0.75,
        sp: 12 + Math.random() * 22
      });
    }
    bushes = [];
    for (var j = 0; j < 14; j++) {
      bushes.push({ x: j * 68 + Math.random() * 34, y: GROUND_Y + 2, r: 14 + Math.random() * 14 });
    }

    spawnPipe(W + 120);
    updateHUD();
  }

  function gapCenter() {
    var g = currentGap();
    var minY = 90 + g / 2;
    var maxY = GROUND_Y - 110 - g / 2;
    if (maxY < minY) maxY = minY;
    return minY + Math.random() * (maxY - minY);
  }

  function spawnPipe(x) {
    pipes.push({ x: x, gapY: gapCenter(), gapH: currentGap(), scored: false });
  }

  function startGame() {
    best = GamePlatform.storage.get('best', 0) || 0;
    resetScene();
    state = 'ready';
    hideOverlays();
    HB.audio.play('start');
    updateHUD();
  }

  function flap() {
    if (state === 'menu' || state === 'gameover') return;
    if (state === 'ready') state = 'playing';
    if (state !== 'playing') return;
    bird.vy = FLAP_V;
    bird.wing = 1;
    shake = Math.max(shake, 0.14);
    HB.audio.play('flap');
    for (var i = 0; i < 3; i++) {
      particles.push({
        x: BIRD_X - 12, y: bird.y + 6,
        vx: -60 - Math.random() * 70,
        vy: 20 + Math.random() * 60,
        life: 0.35 + Math.random() * 0.2,
        maxLife: 0.55,
        size: 2 + Math.random() * 2,
        color: 'rgba(255,255,255,0.85)'
      });
    }
  }

  // ---------- physics ----------
  function birdBox() {
    return { x: BIRD_X - 14, y: bird.y - 11, w: 28, h: 22 };
  }

  function rectsHit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function die(cause) {
    if (state === 'dying' || state === 'gameover') return;
    state = 'dying';
    dieTimer = 0;
    deathCause = cause;
    bird.vy = cause === 'ground' ? 0 : -260;
    flash = 0.55;
    shake = 0.9;
    HB.audio.play('hit');
    if (cause !== 'ground') HB.audio.play('die');
    for (var i = 0; i < 12; i++) {
      particles.push({
        x: BIRD_X, y: bird.y,
        vx: (Math.random() - 0.5) * 320,
        vy: (Math.random() - 0.7) * 320,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 3 + Math.random() * 3,
        color: i % 3 === 0 ? pal.accent : '#ffd23f'
      });
    }
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

    var grade = score >= 40 ? 'platinum' : score >= 30 ? 'gold' : score >= 20 ? 'silver' : score >= 10 ? 'bronze' : 'none';
    var medal = document.getElementById('go-medal');
    medal.setAttribute('data-grade', grade);
    medal.title = t('grade-' + grade);
    medal.querySelector('.medal-glyph').textContent = grade === 'none' ? '—' : {
      bronze: '3', silver: '2', gold: '1', platinum: '★'
    }[grade];
    if (grade !== 'none') HB.audio.play('medal');

    updateHUD();
    showOverlay('ov-gameover');
  }

  function update(dt) {
    timeSec += dt;
    var i, p;

    // 云与灌木始终缓慢移动，菜单里也有生气
    for (i = 0; i < clouds.length; i++) {
      var cl = clouds[i];
      cl.x -= cl.sp * dt * (state === 'playing' ? 1 : 0.4);
      if (cl.x < -140) { cl.x = W + 60; cl.y = 60 + Math.random() * 200; }
    }

    if (state === 'ready') {
      bird.y = H * 0.42 + Math.sin(timeSec * 3.4) * 7;
      bird.rot = Math.sin(timeSec * 3.4 + 1) * 0.08;
      bird.wing = Math.max(0, bird.wing - dt * 2.6);
      scroll += 40 * dt;
      updateParticles(dt);
      return;
    }

    if (state === 'dying') {
      dieTimer += dt;
      bird.vy = Math.min(bird.vy + GRAVITY * dt, MAX_FALL);
      bird.y += bird.vy * dt;
      bird.rot = Math.min(bird.rot + dt * 3.4, Math.PI / 2);
      if (bird.y > GROUND_Y - 14) {
        bird.y = GROUND_Y - 14;
        bird.vy = 0;
      }
      shake = Math.max(0, shake - dt * 1.6);
      flash = Math.max(0, flash - dt * 1.8);
      updateParticles(dt);
      if (dieTimer > 0.72) endGame();
      return;
    }

    if (state !== 'playing') {
      updateParticles(dt);
      return;
    }

    var sp = currentSpeed();
    scroll += sp * dt;

    // bird
    bird.vy = Math.min(bird.vy + GRAVITY * dt, MAX_FALL);
    bird.y += bird.vy * dt;
    bird.wing = Math.max(0, bird.wing - dt * 3.2);
    var targetRot = Math.max(-0.55, Math.min(1.25, bird.vy / 620));
    bird.rot += (targetRot - bird.rot) * Math.min(1, dt * 10);

    if (bird.y < 10) {
      bird.y = 10;
      bird.vy = Math.max(bird.vy, 0);
      shake = Math.max(shake, 0.2);
    }

    // pipes
    for (i = 0; i < pipes.length; i++) pipes[i].x -= sp * dt;

    var last = pipes[pipes.length - 1];
    while (!last || last.x < W - PIPE_SPACING) {
      var nx = last ? last.x + PIPE_SPACING : W + 40;
      spawnPipe(nx);
      last = pipes[pipes.length - 1];
    }
    for (i = pipes.length - 1; i >= 0; i--) {
      p = pipes[i];
      if (p.x + PIPE_W < -20) {
        pipes.splice(i, 1);
        continue;
      }
      if (!p.scored && p.x + PIPE_W < BIRD_X - 4) {
        p.scored = true;
        score++;
        pipesCleared++;
        HB.audio.play('score');
        updateHUD();
      }
    }

    // collisions
    if (!cheatGod) {
      var box = birdBox();
      if (box.y + box.h >= GROUND_Y) {
        die('ground');
        return;
      }
      for (i = 0; i < pipes.length; i++) {
        p = pipes[i];
        if (p.x > BIRD_X + 40 || p.x + PIPE_W < BIRD_X - 40) continue;
        var topH = p.gapY - p.gapH / 2;
        var botY = p.gapY + p.gapH / 2;
        if (rectsHit(box, { x: p.x, y: -100, w: PIPE_W, h: topH + 100 }) ||
            rectsHit(box, { x: p.x, y: botY, w: PIPE_W, h: GROUND_Y - botY })) {
          die('pipe');
          return;
        }
      }
    } else if (bird.y >= GROUND_Y - 14) {
      bird.y = GROUND_Y - 14;
      bird.vy = 0;
      state = 'ready';
    }

    shake = Math.max(0, shake - dt * 2.2);
    flash = Math.max(0, flash - dt * 2);
    updateParticles(dt);
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.vx *= 0.98;
    }
  }

  // ---------- rendering ----------
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
    ctx.fillStyle = skyGrad || pal.skyTop;
    ctx.fillRect(0, 0, W, GROUND_Y + 2);

    if (isDark) {
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var tw = 0.55 + Math.sin(timeSec * 1.6 + s.p) * 0.35;
        ctx.globalAlpha = Math.max(tw, 0.15);
        ctx.fillStyle = pal.star;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 月亮
      ctx.fillStyle = pal.sun;
      ctx.beginPath();
      ctx.arc(384, 92, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.skyTop;
      ctx.beginPath();
      ctx.arc(370, 80, 27, 0, Math.PI * 2);
      ctx.fill();
    } else {
      var glow = ctx.createRadialGradient(384, 92, 8, 384, 92, 68);
      glow.addColorStop(0, pal.sunGlow);
      glow.addColorStop(1, 'rgba(255, 240, 180, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(384, 92, 68, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.sun;
      ctx.beginPath();
      ctx.arc(384, 92, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    for (var c = 0; c < clouds.length; c++) {
      var cl = clouds[c];
      drawCloud(cl.x, cl.y, cl.s);
    }
  }

  function drawCloud(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = pal.cloudShade;
    ctx.beginPath();
    ctx.ellipse(4, 6, 34, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.cloud;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(20, 4, 20, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(-20, 5, 17, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHills(offset, color, baseY, amp, period) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 4);
    for (var x = 0; x <= W; x += 8) {
      var y = baseY - Math.sin((x + offset) / period) * amp
                    - Math.sin((x + offset) / (period * 0.47)) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, GROUND_Y + 4);
    ctx.closePath();
    ctx.fill();
  }

  function drawScenery() {
    drawHills(scroll * 0.22, pal.hillFar, 400, 26, 118);
    drawHills(scroll * 0.42 + 60, pal.hillNear, 452, 20, 86);

    // 灌木
    for (var i = 0; i < bushes.length; i++) {
      var b = bushes[i];
      var bx = ((b.x - scroll * 0.62) % (W + 200) + W + 200) % (W + 200) - 100;
      ctx.fillStyle = pal.bushDark;
      ctx.beginPath();
      ctx.arc(bx, b.y + 4, b.r, 0, Math.PI * 2);
      ctx.arc(bx + b.r * 0.85, b.y + 7, b.r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.bush;
      ctx.beginPath();
      ctx.arc(bx - 3, b.y, b.r * 0.86, 0, Math.PI * 2);
      ctx.arc(bx + b.r * 0.7, b.y + 3, b.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPipeBody(x, y, w, h) {
    if (h <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = pipeGrad || pal.pipeMid;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(8, 0, 7, h);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(w - 14, 0, 6, h);
    ctx.restore();
  }

  function drawPipeCap(x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = pipeGrad || pal.pipeMid;
    roundRect(0, 0, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = pal.pipeEdge;
    ctx.lineWidth = 2;
    roundRect(1, 1, w - 2, h - 2, 5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(9, 4, 8, h - 8, 3);
    ctx.fill();
    ctx.restore();
  }

  function drawPipe(p) {
    var topEnd = p.gapY - p.gapH / 2;
    var botStart = p.gapY + p.gapH / 2;
    var x = Math.round(p.x);

    drawPipeBody(x, -30, PIPE_W, topEnd - PIPE_CAP_H + 30);
    drawPipeCap(x - 6, topEnd - PIPE_CAP_H, PIPE_W + 12, PIPE_CAP_H);

    drawPipeBody(x, botStart + PIPE_CAP_H, PIPE_W, GROUND_Y - botStart - PIPE_CAP_H);
    drawPipeCap(x - 6, botStart, PIPE_W + 12, PIPE_CAP_H);
  }

  function drawGround() {
    ctx.fillStyle = groundGrad || pal.ground;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // 草皮波边
    ctx.fillStyle = pal.groundTop;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 12);
    for (var x = 0; x <= W; x += 12) {
      var off = ((x + scroll) % 24) / 24;
      ctx.lineTo(x, GROUND_Y + 6 + Math.sin(off * Math.PI) * 6);
    }
    ctx.lineTo(W, GROUND_Y + 14);
    ctx.lineTo(0, GROUND_Y + 14);
    ctx.closePath();
    ctx.fill();

    // 斜纹
    ctx.strokeStyle = pal.groundLine;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.32;
    var step = 34;
    var shift = scroll % step;
    for (var i = -1; i < W / step + 2; i++) {
      var gx = i * step - shift;
      ctx.beginPath();
      ctx.moveTo(gx, GROUND_Y + 20);
      ctx.lineTo(gx - 8, GROUND_Y + 38);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, GROUND_Y, W, 2);
  }

  function drawBird() {
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate(bird.rot);

    // 尾羽
    ctx.fillStyle = '#e9a11c';
    ctx.beginPath();
    ctx.moveTo(-12, -7);
    ctx.lineTo(-27, -14);
    ctx.lineTo(-22, -2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, 1);
    ctx.lineTo(-26, 4);
    ctx.lineTo(-21, 10);
    ctx.closePath();
    ctx.fill();

    // 身体 + 头（同色融合成一个圆胖轮廓）
    var bg = ctx.createLinearGradient(0, -20, 0, 16);
    bg.addColorStop(0, '#ffe867');
    bg.addColorStop(1, '#efa015');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(-1, 1, 16, 13, 0, 0, Math.PI * 2);
    ctx.arc(9, -8, 11, 0, Math.PI * 2);
    ctx.fill();

    // 肚皮
    ctx.fillStyle = 'rgba(255, 250, 214, 0.92)';
    ctx.beginPath();
    ctx.ellipse(3, 7, 9.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 头顶呆毛
    ctx.strokeStyle = '#e9a11c';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, -18);
    ctx.quadraticCurveTo(6, -24, 11, -23);
    ctx.stroke();

    // 翅膀（拍动）
    var wing = Math.sin(bird.wing * Math.PI) * 0.9;
    ctx.save();
    ctx.translate(-4, 2);
    ctx.rotate(-0.2 + wing * 0.75);
    ctx.fillStyle = '#ffc93c';
    ctx.strokeStyle = 'rgba(184, 116, 8, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 围巾（跟随主题强调色）
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.ellipse(0, -11, 8, 3.2, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, -10);
    ctx.lineTo(-15, -6 + Math.sin(timeSec * 9) * 1.4);
    ctx.lineTo(-7, -4);
    ctx.closePath();
    ctx.fill();

    // 眼睛
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(12, -10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.beginPath();
    ctx.arc(13.6, -10, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(12.4, -11.3, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // 嘴
    ctx.fillStyle = '#ff8f1f';
    ctx.beginPath();
    ctx.moveTo(16, -7);
    ctx.lineTo(29, -2.4);
    ctx.lineTo(16, 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e06f0d';
    ctx.beginPath();
    ctx.moveTo(16, -1.6);
    ctx.lineTo(27, -1.2);
    ctx.lineTo(16, 2.4);
    ctx.closePath();
    ctx.fill();

    // 腮红
    ctx.fillStyle = 'rgba(255, 118, 118, 0.35)';
    ctx.beginPath();
    ctx.arc(8, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(p.life / p.maxLife, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawScore() {
    if (state === 'menu') return;
    var txt = String(score);
    ctx.save();
    ctx.font = '700 56px "Segoe UI", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineJoin = 'round';
    ctx.strokeText(txt, W / 2, 92);
    ctx.fillStyle = '#2b3648';
    ctx.fillText(txt, W / 2, 92);
    ctx.restore();
  }

  function drawReadyHint() {
    if (state !== 'ready') return;
    ctx.save();
    ctx.globalAlpha = 0.72 + Math.sin(timeSec * 3) * 0.18;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 19px "Segoe UI", "PingFang SC", sans-serif';
    var label = t('tapHint');
    var w = ctx.measureText(label).width + 40;
    ctx.fillStyle = 'rgba(16, 24, 34, 0.42)';
    roundRect(W / 2 - w / 2, 296, w, 42, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, W / 2, 318);
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
    drawScenery();

    for (var i = 0; i < pipes.length; i++) drawPipe(pipes[i]);

    drawGround();

    if (state !== 'menu') {
      drawBird();
      drawParticles();
    } else {
      // 菜单里也让小鸟悬停，画面不空
      var keep = bird.y;
      bird.y = H * 0.42 + Math.sin(timeSec * 2.4) * 6;
      bird.rot = Math.sin(timeSec * 2.4 + 1) * 0.06;
      drawBird();
      bird.y = keep;
    }

    drawScore();
    drawReadyHint();

    if (flash > 0) {
      ctx.fillStyle = 'rgba(255, 92, 92, ' + (flash * 0.45).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // ---------- HUD / overlays / i18n ----------
  function updateHUD() {
    document.getElementById('hud-score').textContent = GamePlatform.util.formatNumber(score);
    document.getElementById('hud-best').textContent = GamePlatform.util.formatNumber(best);
    document.getElementById('hud-pipes').textContent = String(pipesCleared);
  }

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
    var medal = document.getElementById('go-medal');
    if (medal) medal.title = t('grade-' + (medal.getAttribute('data-grade') || 'none'));
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
      HB.audio.unlock();
      if (state === 'menu') { startGame(); return; }
      flap();
    });

    document.addEventListener('keydown', function (e) {
      HB.audio.unlock();
      keys[e.key] = true;
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (state === 'menu') startGame();
        else if (state === 'gameover') { /* 等按钮，避免误触 */ }
        else flap();
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
      }
    });
    document.addEventListener('keyup', function (e) { keys[e.key] = false; });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && (state === 'playing' || state === 'ready')) togglePause();
    });

    document.getElementById('btn-flap').addEventListener('pointerdown', function (e) {
      e.preventDefault();
      HB.audio.unlock();
      if (state === 'menu') startGame();
      else flap();
    });

    document.getElementById('btn-home').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-pause').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-go').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-start').onclick = function () { HB.audio.unlock(); startGame(); };
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
    if (state !== 'paused') update(dt);
    draw();
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

  HB.game = {
    get state() { return state; },
    get score() { return score; },
    get pipes() { return pipes ? pipes.length : 0; }
  };

  /* ------------------------------------------------------------ */
  /* 修改器钩子（暗号 potato4096，见 platform/cheat-kit.js）        */
  /* ------------------------------------------------------------ */

  function cheatAddScore(n) {
    score = Math.max(0, score + n);
    pipesCleared = score;
    updateHUD();
  }

  if (window.CheatKit) {
    CheatKit.init({
      id: 'happy-bird',
      title: { zh: '🔧 修改器', en: '🔧 Modifier' },
      hint: { zh: '彩蛋面板 · 参数即时生效', en: 'Easter egg · changes apply instantly' },
      stats: [
        { label: { zh: '得分', en: 'Score' }, get: function () { return score; }, format: function (v) { return GamePlatform.util.formatNumber(v); } },
        { label: { zh: '最高分', en: 'Best' }, get: function () { return best; }, tone: 'success' },
        { label: { zh: '已过管道', en: 'Pipes' }, get: function () { return pipesCleared; } },
        { label: { zh: '当前速度', en: 'Speed' }, get: function () { return Math.round(currentSpeed()); }, tone: 'warning' },
        { label: { zh: '缝隙高度', en: 'Gap' }, get: function () { return Math.round(currentGap()); } }
      ],
      params: [
        { key: 'score', label: { zh: '得分', en: 'Score' }, min: 0, max: 9999, step: 1,
          get: function () { return score; },
          set: function (v) { cheatAddScore(Math.round(v) - score); } },
        { key: 'speed', label: { zh: '速度 (0=自动)', en: 'Speed (0=auto)' }, min: 0, max: 900, step: 5,
          get: function () { return cheatSpeedVal; },
          set: function (v) { cheatSpeedVal = v > 0 ? v : 0; } },
        { key: 'gap', label: { zh: '缝隙 (0=自动)', en: 'Gap (0=auto)' }, min: 0, max: 420, step: 5,
          get: function () { return cheatGapVal; },
          set: function (v) {
            cheatGapVal = v > 0 ? v : 0;
            if (cheatGapVal > 0) {
              for (var i = 0; i < pipes.length; i++) pipes[i].gapH = cheatGapVal;
            }
          } }
      ],
      toggles: [
        { label: { zh: '无敌（不撞管）', en: 'God mode' },
          on: { zh: '无敌：开', en: 'God Mode: ON' },
          off: { zh: '无敌：关', en: 'God Mode: OFF' },
          get: function () { return cheatGod; },
          set: function (v) { cheatGod = !!v; } }
      ],
      actions: [
        { label: { zh: '分数 +10', en: '+10 score' }, run: function () { cheatAddScore(10); } },
        { label: { zh: '清空管道', en: 'Clear pipes' }, run: function () {
          pipes.length = 0;
          spawnPipe(W + 120);
        } },
        { label: { zh: '重置本局', en: 'Restart run' }, run: function () { startGame(); } }
      ]
    });
  }
})();
