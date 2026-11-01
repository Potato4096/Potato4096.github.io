/* brick-breaker - core game: states, physics, bricks, power-ups, rendering */
(function () {
  'use strict';

  var BB = window.BB = window.BB || {};

  // ---------- constants ----------
  var W = 640, H = 480;
  var PADDLE_H = 14, PADDLE_BASE_W = 112, PADDLE_Y = H - 32;
  var BALL_R = 8;
  var BRICK_TOP = 76, BRICK_H = 22, BRICK_GAP = 6, BRICK_MARGIN_X = 26;
  var MAX_BALLS = 12;
  var MAX_SPEED = 680, MIN_SPEED = 220;
  var CAPSULE_VY = 150, CAPSULE_W = 42, CAPSULE_H = 20;
  var WIDE_DURATION = 15, WIDE_MULT = 1.6;
  var SPEED_MULT = 1.22, SLOW_MULT = 0.82;
  var BASE_SPEED = 320;
  var MAX_LIVES = 9;
  var PARTICLES_MAX = 120;

  var EFFECTS = ['multi', 'speed', 'wide', 'slow', 'life'];
  var EFFECT_COLOR = {
    multi: '#ff9f43',
    speed: '#ee5253',
    wide: '#10ac84',
    slow: '#54a0ff',
    life: '#ff6b9d'
  };
  var EFFECT_GLYPH = {
    multi: '×3',
    speed: '»',
    wide: 'W',
    slow: '«',
    life: '+'
  };

  // ---------- i18n ----------
  var STR = {
    title: { zh: '弹球打砖块', en: 'Brick Breaker' },
    tagline: {
      zh: '移动鼠标操控平台反弹小球，击碎所有砖块！特殊砖块会掉落道具。',
      en: 'Move the mouse to bounce the ball and smash every brick! Special bricks drop power-ups.'
    },
    score: { zh: '得分', en: 'Score' },
    level: { zh: '关卡', en: 'Level' },
    lives: { zh: '生命', en: 'Lives' },
    balls: { zh: '小球', en: 'Balls' },
    best: { zh: '最高分', en: 'Best' },
    start: { zh: '开始游戏', en: 'Start' },
    restart: { zh: '重新开始', en: 'Restart' },
    resume: { zh: '继续游戏', en: 'Resume' },
    paused: { zh: '已暂停', en: 'Paused' },
    gameOver: { zh: '游戏结束', en: 'Game Over' },
    levelClear: { zh: '通关！', en: 'Level Clear!' },
    again: { zh: '再玩一次', en: 'Play Again' },
    nextLevel: { zh: '下一关', en: 'Next Level' },
    home: { zh: '返回主页', en: 'Home' },
    clearRecords: { zh: '清除记录', en: 'Clear Records' },
    cleared: { zh: '记录已清除', en: 'Records cleared' },
    newRecord: { zh: '新纪录！', en: 'New record!' },
    launchHint: { zh: '点击 / 空格 发球', en: 'Click / Space to launch' },
    controls: {
      zh: '操作：鼠标 / 触摸拖动移动平台，点击 / 空格发球，←→ / A D 也可移动，Esc / P 暂停。接住道具：×3 小球分身、» 加速、W 加宽平台、« 减速、+ 额外生命。',
      en: 'Controls: mouse / touch drag to move the paddle, click / Space to launch, ←→ / A-D also work, Esc / P to pause. Catch power-ups: ×3 multi-ball, » speed up, W wide paddle, « slow down, + extra life.'
    },
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    pauseBtn: { zh: '暂停', en: 'Pause' },
    'power-multi': { zh: '小球分身', en: 'Multi-ball' },
    'power-speed': { zh: '加速', en: 'Speed up' },
    'power-wide': { zh: '加宽平台', en: 'Wide paddle' },
    'power-slow': { zh: '减速', en: 'Slow down' },
    'power-life': { zh: '额外生命', en: 'Extra life' },
    toastMulti: { zh: '小球分身！', en: 'Multi-ball!' },
    toastSpeed: { zh: '小球加速！', en: 'Speed up!' },
    toastWide: { zh: '平台加宽 15 秒！', en: 'Wide paddle for 15s!' },
    toastSlow: { zh: '小球减速！', en: 'Slow down!' },
    toastLife: { zh: '生命 +1！', en: 'Extra life!' }
  };
  function t(k) { return GamePlatform.i18n.t(STR[k] || { zh: k, en: k }); }

  // ---------- canvas ----------
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  // ---------- world palettes (keyed by resolved light/dark, tinted by theme pack) ----------
  var WORLD = {
    light: {
      bgTop: '#dfe7f5', bgBottom: '#b9c9e8',
      wall: '#9fb2d4', wallEdge: '#7d92bb',
      paddle: '#3b6fd4', paddleEdge: '#274e9c', paddleGlow: '#8fb4ff',
      ball: '#ffffff', ballEdge: '#5b6474',
      rowColors: ['#ef6461', '#f4a259', '#ffd166', '#8ac926', '#4cc9a7', '#4f9df5', '#9b5de5', '#f368e0', '#574b90'],
      tough: '#8d99ae', toughEdge: '#5c6b82', toughCrack: '#41506b',
      capsuleText: '#ffffff'
    },
    dark: {
      bgTop: '#1a2233', bgBottom: '#101726',
      wall: '#2c3a55', wallEdge: '#46587c',
      paddle: '#4f7fe0', paddleEdge: '#2c4f9e', paddleGlow: '#6f9bff',
      ball: '#eef2fa', ballEdge: '#93a1bb',
      rowColors: ['#c8504d', '#c97f3e', '#c7a23c', '#6da327', '#33997f', '#3f7fd0', '#7f4bc4', '#c255a9', '#4a4077'],
      tough: '#6b7a92', toughEdge: '#4a5872', toughCrack: '#2f3b52',
      capsuleText: '#ffffff'
    }
  };
  var pal = WORLD.light;
  var bgGrad = null;

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
    pal.bgTop = mix(base.bgTop, packBg, 0.28);
    pal.bgBottom = mix(base.bgBottom, packBg, 0.2);
    bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, pal.bgTop);
    bgGrad.addColorStop(1, pal.bgBottom);
  }

  // ---------- game state ----------
  var state = 'menu'; // menu | ready | playing | paused | gameover | levelclear
  var score = 0, lives = 3, level = 1, best = 0;
  var paddle, balls, bricks, capsules, particles;
  var wideTimer = 0;
  var aliveBricks = 0;
  var keys = {};

  function baseSpeed() {
    return Math.min(BASE_SPEED + (level - 1) * 16, 520);
  }

  function resetBallOnPaddle() {
    balls = [{
      x: paddle.cx,
      y: PADDLE_Y - BALL_R - 1,
      vx: 0, vy: 0,
      stuck: true
    }];
    state = 'ready';
    updateHUD();
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var tt = Math.imul(a ^ (a >>> 15), 1 | a);
      tt = (tt + Math.imul(tt ^ (tt >>> 7), 61 | tt)) ^ tt;
      return ((tt ^ (tt >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildLevel(lv) {
    bricks = [];
    aliveBricks = 0;
    var cols = 10;
    var rows = Math.min(5 + Math.floor((lv - 1) / 2), 9);
    var bw = (W - BRICK_MARGIN_X * 2 - BRICK_GAP * (cols - 1)) / cols;
    var rand = mulberry32(lv * 7919 + 13);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        // subtle layout pattern per level
        var skip = false;
        if (lv % 3 === 2 && (r + c) % 2 === 1) skip = true; // checker
        if (lv % 3 === 0 && Math.abs(c - (cols - 1) / 2) > r * 0.9) skip = true; // pyramid (narrow top)
        if (skip && rand() < 0.65) continue;

        var roll = rand();
        var kind = 'normal', hp = 1, effect = null;
        if (roll < 0.12) {
          kind = 'special';
          effect = EFFECTS[Math.floor(rand() * EFFECTS.length)];
        } else if (roll < 0.12 + 0.16 + Math.min(lv * 0.012, 0.1)) {
          kind = 'tough';
          hp = 2;
        }
        bricks.push({
          cx: BRICK_MARGIN_X + bw / 2 + c * (bw + BRICK_GAP),
          cy: BRICK_TOP + BRICK_H / 2 + r * (BRICK_H + BRICK_GAP),
          w: bw, h: BRICK_H,
          row: r, kind: kind, hp: hp, effect: effect,
          alive: true
        });
        aliveBricks++;
      }
    }
    // guarantee at least 3 special bricks
    var specials = 0, i;
    for (i = 0; i < bricks.length; i++) if (bricks[i].kind === 'special') specials++;
    for (i = 0; i < bricks.length && specials < 3; i++) {
      if (bricks[i].kind === 'normal' && bricks[i].alive) {
        bricks[i].kind = 'special';
        bricks[i].effect = EFFECTS[specials % EFFECTS.length];
        specials++;
      }
    }
  }

  function startLevel(lv) {
    level = lv;
    paddle = {
      cx: W / 2,
      baseW: PADDLE_BASE_W,
      w: PADDLE_BASE_W,
      h: PADDLE_H
    };
    wideTimer = 0;
    capsules = [];
    particles = [];
    buildLevel(level);
    resetBallOnPaddle();
  }

  function startGame() {
    score = 0;
    lives = 3;
    best = GamePlatform.storage.get('best', 0) || 0;
    startLevel(1);
    state = 'ready';
    hideOverlays();
    BB.audio.play('start');
    updateHUD();
  }

  // ---------- particles ----------
  function spawnParticles(x, y, color, count) {
    if (GamePlatform.ui.shouldReduceMotion()) count = Math.min(count, 3);
    for (var i = 0; i < count; i++) {
      if (particles.length >= PARTICLES_MAX) particles.shift();
      var ang = Math.random() * Math.PI * 2;
      var sp = 60 + Math.random() * 180;
      particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.75,
        size: 2 + Math.random() * 3,
        color: color
      });
    }
  }

  // ---------- power-ups ----------
  function dropCapsule(brick) {
    capsules.push({
      x: brick.cx,
      y: brick.cy,
      vy: CAPSULE_VY,
      type: brick.effect || EFFECTS[0],
      rot: 0
    });
  }

  function applyEffect(type) {
    if (type === 'multi') {
      var added = [];
      for (var i = 0; i < balls.length && balls.length + added.length < MAX_BALLS; i++) {
        var b = balls[i];
        if (b.stuck) continue;
        var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || baseSpeed();
        var ang = Math.atan2(b.vy, b.vx);
        for (var s = -1; s <= 1; s += 2) {
          if (balls.length + added.length >= MAX_BALLS) break;
          var na = ang + s * 0.42;
          added.push({ x: b.x, y: b.y, vx: Math.cos(na) * sp, vy: Math.sin(na) * sp, stuck: false });
        }
      }
      for (var j = 0; j < added.length; j++) balls.push(added[j]);
      toast('toastMulti');
    } else if (type === 'speed') {
      for (var k = 0; k < balls.length; k++) scaleBallSpeed(balls[k], SPEED_MULT);
      toast('toastSpeed');
    } else if (type === 'slow') {
      for (var m = 0; m < balls.length; m++) scaleBallSpeed(balls[m], SLOW_MULT);
      toast('toastSlow');
    } else if (type === 'wide') {
      wideTimer = WIDE_DURATION;
      paddle.w = paddle.baseW * WIDE_MULT;
      toast('toastWide');
    } else if (type === 'life') {
      lives = Math.min(lives + 1, MAX_LIVES);
      toast('toastLife');
    }
    BB.audio.play('power');
    updateHUD();
  }

  function scaleBallSpeed(b, mult) {
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp < 1) {
      var a = -Math.PI / 2 + (Math.random() - 0.5);
      b.vx = Math.cos(a) * baseSpeed();
      b.vy = Math.sin(a) * baseSpeed();
      return;
    }
    var target = GamePlatform.util.clamp(sp * mult, MIN_SPEED, MAX_SPEED);
    var f = target / sp;
    b.vx *= f;
    b.vy *= f;
  }

  function toast(key) {
    try { GamePlatform.ui.toast(t(key)); } catch (e) { /* ignore */ }
  }

  // ---------- physics ----------
  function update(dt) {
    // paddle keyboard movement
    var move = 0;
    if (keys.ArrowLeft || keys.a || keys.A) move -= 1;
    if (keys.ArrowRight || keys.d || keys.D) move += 1;
    if (move !== 0) {
      paddle.cx += move * 540 * dt;
    }
    paddle.cx = GamePlatform.util.clamp(paddle.cx, paddle.w / 2 + 6, W - paddle.w / 2 - 6);

    if (wideTimer > 0) {
      wideTimer -= dt;
      if (wideTimer <= 0) {
        wideTimer = 0;
        paddle.w = paddle.baseW;
      }
    }

    // stuck ball follows paddle
    var i, b;
    for (i = 0; i < balls.length; i++) {
      b = balls[i];
      if (b.stuck) {
        b.x = paddle.cx;
        b.y = PADDLE_Y - BALL_R - 1;
      }
    }

    if (state === 'playing') {
      // balls
      for (i = balls.length - 1; i >= 0; i--) {
        b = balls[i];
        if (b.stuck) continue;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // walls
        if (b.x - BALL_R < 6) { b.x = 6 + BALL_R; b.vx = Math.abs(b.vx); BB.audio.play('wall'); }
        if (b.x + BALL_R > W - 6) { b.x = W - 6 - BALL_R; b.vx = -Math.abs(b.vx); BB.audio.play('wall'); }
        if (b.y - BALL_R < 6) { b.y = 6 + BALL_R; b.vy = Math.abs(b.vy); BB.audio.play('wall'); }

        // paddle
        if (b.vy > 0 &&
            b.y + BALL_R >= PADDLE_Y && b.y + BALL_R <= PADDLE_Y + PADDLE_H + 12 &&
            b.x >= paddle.cx - paddle.w / 2 - BALL_R && b.x <= paddle.cx + paddle.w / 2 + BALL_R) {
          b.y = PADDLE_Y - BALL_R;
          var rel = GamePlatform.util.clamp((b.x - paddle.cx) / (paddle.w / 2), -1, 1);
          var ang = rel * (Math.PI / 3); // up to 60 degrees
          var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || baseSpeed();
          sp = GamePlatform.util.clamp(sp, MIN_SPEED, MAX_SPEED);
          b.vx = Math.sin(ang) * sp;
          b.vy = -Math.cos(ang) * sp;
          BB.audio.play('paddle');
        }

        // bricks
        for (var j = 0; j < bricks.length; j++) {
          var br = bricks[j];
          if (!br.alive) continue;
          var dx = b.x - br.cx, dy = b.y - br.cy;
          var ox = (br.w / 2 + BALL_R) - Math.abs(dx);
          var oy = (br.h / 2 + BALL_R) - Math.abs(dy);
          if (ox > 0 && oy > 0) {
            // reflect on axis of least penetration
            if (ox < oy) {
              b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
              b.x += dx > 0 ? ox : -ox;
            } else {
              b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
              b.y += dy > 0 ? oy : -oy;
            }
            hitBrick(br);
            break; // one brick per ball per frame
          }
        }

        // fell off bottom
        if (b.y - BALL_R > H + 20) {
          balls.splice(i, 1);
        }
      }

      // all balls lost -> lose a life
      if (balls.length === 0) {
        lives--;
        BB.audio.play('lose');
        updateHUD();
        if (lives <= 0) {
          endGame();
        } else {
          resetBallOnPaddle();
        }
      }

      // capsules
      for (i = capsules.length - 1; i >= 0; i--) {
        var cp = capsules[i];
        cp.y += cp.vy * dt;
        cp.rot += dt * 2;
        if (cp.y - CAPSULE_H > H + 10) {
          capsules.splice(i, 1);
          continue;
        }
        if (cp.y + CAPSULE_H / 2 >= PADDLE_Y && cp.y - CAPSULE_H / 2 <= PADDLE_Y + PADDLE_H &&
            cp.x >= paddle.cx - paddle.w / 2 - CAPSULE_W / 2 && cp.x <= paddle.cx + paddle.w / 2 + CAPSULE_W / 2) {
          capsules.splice(i, 1);
          applyEffect(cp.type);
          spawnParticles(cp.x, cp.y, EFFECT_COLOR[cp.type], 8);
        }
      }

      // level clear
      if (aliveBricks <= 0 && state === 'playing') {
        levelClear();
      }
    }

    // particles (update in any active state for visual polish)
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
    }
  }

  function hitBrick(br) {
    br.hp--;
    if (br.hp > 0) {
      BB.audio.play('crack');
      spawnParticles(br.cx, br.cy, pal.tough, 4);
      return;
    }
    br.alive = false;
    aliveBricks--;
    var color = brickColor(br);
    spawnParticles(br.cx, br.cy, color, 9);
    score += br.kind === 'special' ? 100 : (br.kind === 'tough' ? 80 : 50);
    if (br.kind === 'special') dropCapsule(br);
    BB.audio.play('break');
    updateHUD();
  }

  function endGame() {
    state = 'gameover';
    if (score > best) {
      best = score;
      GamePlatform.storage.set('best', best);
      toast('newRecord');
    }
    document.getElementById('go-score').textContent = GamePlatform.util.formatNumber(score);
    document.getElementById('go-level').textContent = String(level);
    document.getElementById('go-best').textContent = GamePlatform.util.formatNumber(best);
    showOverlay('ov-gameover');
  }

  function levelClear() {
    state = 'levelclear';
    if (score > best) {
      best = score;
      GamePlatform.storage.set('best', best);
      toast('newRecord');
    }
    BB.audio.play('clear');
    document.getElementById('clear-score').textContent = GamePlatform.util.formatNumber(score);
    document.getElementById('clear-best').textContent = GamePlatform.util.formatNumber(best);
    showOverlay('ov-clear');
  }

  // ---------- rendering ----------
  function brickColor(br) {
    if (br.kind === 'special') return EFFECT_COLOR[br.effect] || pal.rowColors[br.row % pal.rowColors.length];
    if (br.kind === 'tough') return pal.tough;
    return pal.rowColors[br.row % pal.rowColors.length];
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    // background
    ctx.fillStyle = bgGrad || pal.bgTop;
    ctx.fillRect(0, 0, W, H);

    // walls
    ctx.fillStyle = pal.wall;
    ctx.fillRect(0, 0, 6, H);
    ctx.fillRect(W - 6, 0, 6, H);
    ctx.fillRect(0, 0, W, 6);
    ctx.fillStyle = pal.wallEdge;
    ctx.fillRect(6, 0, 2, H);
    ctx.fillRect(W - 8, 0, 2, H);
    ctx.fillRect(0, 6, W, 2);

    var i;
    // bricks
    for (i = 0; i < bricks.length; i++) {
      var br = bricks[i];
      if (!br.alive) continue;
      var x = br.cx - br.w / 2, y = br.cy - br.h / 2;
      var color = brickColor(br);
      ctx.fillStyle = color;
      roundRect(x, y, br.w, br.h, 5);
      ctx.fill();
      // top gloss
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(x + 2, y + 2, br.w - 4, br.h * 0.38, 3);
      ctx.fill();

      if (br.kind === 'tough') {
        if (br.hp >= 2) {
          ctx.strokeStyle = pal.toughEdge;
          ctx.lineWidth = 2;
          roundRect(x + 1, y + 1, br.w - 2, br.h - 2, 4);
          ctx.stroke();
        } else {
          // cracked look after first hit
          ctx.strokeStyle = pal.toughCrack;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + br.w * 0.25, y + 2);
          ctx.lineTo(x + br.w * 0.42, y + br.h * 0.55);
          ctx.lineTo(x + br.w * 0.3, y + br.h - 2);
          ctx.moveTo(x + br.w * 0.62, y + 2);
          ctx.lineTo(x + br.w * 0.52, y + br.h * 0.5);
          ctx.lineTo(x + br.w * 0.72, y + br.h - 2);
          ctx.stroke();
        }
      } else if (br.kind === 'special') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 13px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(EFFECT_GLYPH[br.effect] || '?', br.cx, br.cy + 1);
      }
    }

    // capsules
    for (i = 0; i < capsules.length; i++) {
      var cp = capsules[i];
      var cw = CAPSULE_W, ch = CAPSULE_H;
      var cx = cp.x, cy = cp.y;
      ctx.save();
      ctx.translate(cx, cy);
      var bob = GamePlatform.ui.shouldReduceMotion() ? 0 : Math.sin(cp.rot * 2) * 1.5;
      ctx.fillStyle = EFFECT_COLOR[cp.type];
      roundRect(-cw / 2, -ch / 2 + bob, cw, ch, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      roundRect(-cw / 2 + 3, -ch / 2 + bob + 2, cw - 6, ch * 0.36, 4);
      ctx.fill();
      ctx.fillStyle = pal.capsuleText;
      ctx.font = 'bold 12px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(EFFECT_GLYPH[cp.type], 0, bob + 1);
      ctx.restore();
    }

    // paddle
    var px = paddle.cx - paddle.w / 2;
    ctx.fillStyle = pal.paddle;
    roundRect(px, PADDLE_Y, paddle.w, PADDLE_H, 7);
    ctx.fill();
    ctx.fillStyle = pal.paddleGlow;
    roundRect(px + 4, PADDLE_Y + 2, paddle.w - 8, 4, 2);
    ctx.fill();
    ctx.fillStyle = pal.paddleEdge;
    roundRect(px + 2, PADDLE_Y + PADDLE_H - 4, paddle.w - 4, 3, 2);
    ctx.fill();

    // balls
    for (i = 0; i < balls.length; i++) {
      var b = balls[i];
      var g = ctx.createRadialGradient(b.x - BALL_R * 0.35, b.y - BALL_R * 0.35, BALL_R * 0.2, b.x, b.y, BALL_R);
      g.addColorStop(0, pal.ball);
      g.addColorStop(1, pal.ballEdge);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
    }

    // particles
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(p.life / p.maxLife, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // launch hint
    if (state === 'ready') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      roundRect(W / 2 - 130, H / 2 - 18, 260, 36, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 16px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('launchHint'), W / 2, H / 2 + 1);
    }

    // wide paddle timer bar
    if (wideTimer > 0) {
      var frac = wideTimer / WIDE_DURATION;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      roundRect(px, PADDLE_Y - 8, paddle.w, 4, 2);
      ctx.fill();
      ctx.fillStyle = EFFECT_COLOR.wide;
      roundRect(px, PADDLE_Y - 8, paddle.w * frac, 4, 2);
      ctx.fill();
    }
  }

  // ---------- HUD / overlays / i18n ----------
  function updateHUD() {
    document.getElementById('hud-score').textContent = GamePlatform.util.formatNumber(score);
    document.getElementById('hud-level').textContent = String(level);
    document.getElementById('hud-lives').textContent = String(Math.max(lives, 0));
    document.getElementById('hud-balls').textContent = String(balls ? balls.length : 0);
  }

  function showOverlay(id) {
    var ids = ['ov-menu', 'ov-pause', 'ov-gameover', 'ov-clear'];
    for (var i = 0; i < ids.length; i++) {
      document.getElementById(ids[i]).hidden = ids[i] !== id;
    }
  }
  function hideOverlays() {
    showOverlay('');
  }

  function buildLegend() {
    var el = document.getElementById('menu-legend');
    el.innerHTML = '';
    for (var i = 0; i < EFFECTS.length; i++) {
      var eff = EFFECTS[i];
      var span = document.createElement('span');
      span.className = 'legend-item';
      var dot = document.createElement('span');
      dot.className = 'legend-dot';
      dot.style.background = EFFECT_COLOR[eff];
      dot.textContent = EFFECT_GLYPH[eff];
      span.appendChild(dot);
      span.appendChild(document.createTextNode(t('power-' + eff)));
      el.appendChild(span);
    }
  }

  function applyLang() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      if (STR[key]) nodes[i].textContent = t(key);
    }
    buildLegend();
  }

  // ---------- input ----------
  function canvasX(clientX) {
    var rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) * (W / rect.width);
  }

  function onPointerMove(e) {
    if (state !== 'ready' && state !== 'playing') return;
    var cx = e.touches ? e.touches[0].clientX : e.clientX;
    paddle.cx = GamePlatform.util.clamp(canvasX(cx), paddle.w / 2 + 6, W - paddle.w / 2 - 6);
    if (balls && balls.length && balls[0].stuck) {
      balls[0].x = paddle.cx;
    }
  }

  function launch() {
    if (state !== 'ready') return;
    var sp = baseSpeed();
    var ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
    for (var i = 0; i < balls.length; i++) {
      balls[i].stuck = false;
      balls[i].vx = Math.cos(ang) * sp;
      balls[i].vy = Math.sin(ang) * sp;
    }
    state = 'playing';
    BB.audio.play('launch');
    updateHUD();
  }

  function togglePause() {
    if (state === 'playing' || state === 'ready') {
      state = 'paused';
      showOverlay('ov-pause');
    } else if (state === 'paused') {
      hideOverlays();
      // resume: if any ball stuck -> ready else playing
      var stuck = false;
      for (var i = 0; i < balls.length; i++) if (balls[i].stuck) stuck = true;
      state = stuck ? 'ready' : 'playing';
    }
  }

  function bindInput() {
    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      onPointerMove(e);
    }, { passive: false });
    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      BB.audio.unlock();
      onPointerMove(e);
      if (state === 'ready') launch();
    }, { passive: false });

    canvas.addEventListener('mousedown', function () {
      BB.audio.unlock();
      if (state === 'ready') launch();
    });

    document.addEventListener('keydown', function (e) {
      BB.audio.unlock();
      keys[e.key] = true;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (state === 'ready') launch();
        else if (state === 'menu') startGame();
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
      }
    });
    document.addEventListener('keyup', function (e) {
      keys[e.key] = false;
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && (state === 'playing' || state === 'ready')) togglePause();
    });

    document.addEventListener('pointerdown', function () { BB.audio.unlock(); }, { once: true });

    document.getElementById('btn-home').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-pause').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-go').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-clear').onclick = function () { GamePlatform.navigate.goHome(); };

    document.getElementById('btn-start').onclick = function () {
      BB.audio.unlock();
      startGame();
    };
    document.getElementById('btn-clear').onclick = function () {
      GamePlatform.storage.clear();
      best = 0;
      document.getElementById('menu-best').textContent = '0';
      GamePlatform.ui.toast(t('cleared'));
    };
    document.getElementById('btn-pause').onclick = togglePause;
    document.getElementById('btn-resume').onclick = togglePause;
    document.getElementById('btn-restart-pause').onclick = function () {
      hideOverlays();
      startGame();
    };
    document.getElementById('btn-again-go').onclick = function () {
      hideOverlays();
      startGame();
    };
    document.getElementById('btn-next').onclick = function () {
      hideOverlays();
      startLevel(level + 1);
      updateHUD();
    };
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
    if (state === 'playing' || state === 'ready') {
      update(dt);
    }
    draw();
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  function init() {
    rebuildPal();
    best = GamePlatform.storage.get('best', 0) || 0;
    startLevel(1);
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
      if (changedKeys.indexOf('lang') !== -1) {
        applyLang();
      }
    });
    GamePlatform.theme.onChange(function () { rebuildPal(); });
    GamePlatform.themePacks.onChange(function () { rebuildPal(); });
    GamePlatform.i18n.onChange(function () { applyLang(); });
  });

  BB.game = {
    // exposed for debugging / tests
    get state() { return state; },
    get score() { return score; }
  };
})();
