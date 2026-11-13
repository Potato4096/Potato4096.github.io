/* ping-pong - core game: states, physics, AI, rendering */
(function () {
  'use strict';

  var PP = window.PP = window.PP || {};

  // ---------- constants ----------
  var W = 640, H = 400;
  var WALL = 6;
  var PADDLE_W = 12, PADDLE_H = 76;
  var PLAYER_X = 30, AI_X = W - 30;
  var BALL_R = 7;
  var BASE_SPEED = 260, MIN_SPEED = 150, MAX_SPEED = 640;
  var HIT_ACCEL = 1.05, ROUND_ACCEL = 0.03;
  var MAX_ANGLE = Math.PI / 3; // 60°，拍边缘回球角度上限
  var WIN_SCORE = 7;
  var SERVE_DUR = 0.5;   // 发球动画时长（秒）
  var POINT_PAUSE = 0.8; // 得分后停顿（秒）
  var TRAIL_MAX = 8;
  var PARTICLES_MAX = 80;
  var DIFFS = { easy: 18, normal: 50, hard: 85 };

  // ---------- i18n ----------
  var STR = {
    title: { zh: '乒乓球', en: 'Ping Pong' },
    tagline: {
      zh: '先得 7 分者胜。每 2 分换发球，打在拍边缘会拉出刁钻斜线！',
      en: 'First to 7 points wins. Serve switches every 2 points — hit the paddle edge for a sharp angle!'
    },
    score: { zh: '比分', en: 'Score' },
    round: { zh: '回合数', en: 'Rally' },
    diff: { zh: '难度', en: 'Difficulty' },
    best: { zh: '最高连胜', en: 'Best streak' },
    start: { zh: '开始游戏', en: 'Start' },
    restart: { zh: '重新开始', en: 'Restart' },
    resume: { zh: '继续游戏', en: 'Resume' },
    paused: { zh: '已暂停', en: 'Paused' },
    gameOver: { zh: '游戏结束', en: 'Game Over' },
    win: { zh: '胜利！', en: 'You Win!' },
    lose: { zh: '失败', en: 'You Lose' },
    again: { zh: '再玩一次', en: 'Play Again' },
    home: { zh: '返回主页', en: 'Home' },
    longestRally: { zh: '最长对拉拍数', en: 'Longest rally' },
    diffEasy: { zh: '简单', en: 'Easy' },
    diffNormal: { zh: '普通', en: 'Normal' },
    diffHard: { zh: '困难', en: 'Hard' },
    meShort: { zh: '我', en: 'Me' },
    aiShort: { zh: 'AI', en: 'AI' },
    serveHint: { zh: '发球', en: 'Serve' },
    pointFlash: { zh: '得分！', en: 'Point!' },
    newRecord: { zh: '新纪录！', en: 'New record!' },
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    pauseBtn: { zh: '暂停', en: 'Pause' },
    controls: {
      zh: '操作：鼠标 / 触摸上下拖动，或 W/S、↑/↓ 移动球拍；Esc / P 暂停。回球角度随接触点变化，对拉越久球速越快，先得 7 分者胜。',
      en: 'Controls: drag up/down with mouse / touch, or move the paddle with W/S and ↑/↓. Esc / P to pause. The return angle follows the contact point, the ball speeds up as the rally grows — first to 7 wins.'
    },
    // CheatKit 面板动态文案
    stateMenu: { zh: '菜单', en: 'Menu' },
    stateServing: { zh: '发球中', en: 'Serving' },
    statePlaying: { zh: '对打中', en: 'Playing' },
    statePointpause: { zh: '得分停顿', en: 'Point pause' },
    statePaused: { zh: '已暂停', en: 'Paused' },
    stateGameover: { zh: '已结束', en: 'Game over' }
  };
  function t(k) { return GamePlatform.i18n.t(STR[k] || { zh: k, en: k }); }

  function toast(key) {
    try { GamePlatform.ui.toast(t(key)); } catch (e) { /* ignore */ }
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // ---------- canvas ----------
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  // ---------- anti-blur fit (参考 Games/board-games/js/core/canvas.js) ----------
  var fitCache = typeof WeakMap === 'function' ? new WeakMap() : null;

  function fit(cv, cx, w, h) {
    if (!cv || !cx || !w || !h) return cx;
    var dpr = window.devicePixelRatio || 1;

    var prev = fitCache ? fitCache.get(cv) : null;
    if (!prev || prev.w !== w || prev.h !== h) {
      // 首次（或逻辑尺寸改了）：先让属性给出正确纵横比，CSS 的 height:auto 才算得对
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
    // 改 width/height 会重置上下文状态，每帧重设一次变换（幂等且便宜）
    cx.setTransform(bw / w, 0, 0, bh / h, 0, 0);
    return cx;
  }

  // ---------- world palettes (light/dark，主题切换时重建) ----------
  var WORLD = {
    light: {
      bgTop: '#3f79c4', bgBottom: '#2c5c9f',
      line: '#eaf1fb', wall: '#204b85', wallEdge: '#3d6ca8',
      paddle: '#f7fafd', paddleEdge: '#b9c9df',
      paddleAI: '#ff9f68', paddleAIEdge: '#d9713d',
      ball: '#ffffff', ballEdge: '#9db4d4',
      flash: '#ffe08a'
    },
    dark: {
      bgTop: '#24406c', bgBottom: '#152744',
      line: '#6f87b3', wall: '#0e1c33', wallEdge: '#2b4a77',
      paddle: '#e6eefb', paddleEdge: '#93a9c9',
      paddleAI: '#e8926f', paddleAIEdge: '#b3623f',
      ball: '#f4f8ff', ballEdge: '#8ba0c2',
      flash: '#ffd166'
    }
  };
  var pal = WORLD.light;
  var bgGrad = null;

  function rebuildPal() {
    pal = WORLD[GamePlatform.theme.get()] || WORLD.light;
    bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, pal.bgTop);
    bgGrad.addColorStop(1, pal.bgBottom);
  }

  // ---------- game state ----------
  var state = 'menu'; // menu | serving | playing | pointpause | paused | gameover
  var prevState = 'playing';
  var myScore = 0, aiScore = 0;
  var rallyHits = 0, longestRally = 0;
  var streak = 0, bestStreak = 0;
  var serveOwner = 'player'; // player | ai
  var pointsSinceSwitch = 0;
  var pointTimer = 0, serveT = 0, flashTimer = 0;
  var speedMult = 1;
  var playerSpeed = 420;
  var aiLevel = DIFFS.normal;
  var difficulty = 'normal';
  var cheatNoCap = false, cheatAuto = false;
  var keys = {};
  var particles = [];
  var trail = [];

  var player = { x: PLAYER_X, cy: H / 2, w: PADDLE_W, h: PADDLE_H };
  var ai = { x: AI_X, cy: H / 2, w: PADDLE_W, h: PADDLE_H, targetY: H / 2, think: 0, bias: 0 };
  var ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  var serveFrom = { x: W / 2, y: H / 2 };

  // ---------- AI 参数（由难度 / 修改器的 AI 反应值推导） ----------
  function aiMoveSpeed() { return 150 + aiLevel * 3.4; }
  function aiDelay() { return Math.max(0.02, 0.40 - aiLevel * 0.0038); }
  function aiError() { return Math.max(4, 85 - aiLevel * 0.8); }

  // ---------- ball speed helpers ----------
  function ballSpeed() { return Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy); }

  function setBallSpeed(s) {
    var cur = ballSpeed();
    if (cur < 1) {
      ball.vx = s;
      ball.vy = 0;
      return;
    }
    ball.vx = ball.vx / cur * s;
    ball.vy = ball.vy / cur * s;
  }

  function maxSpeed() {
    return cheatNoCap ? Infinity : MAX_SPEED * speedMult;
  }

  function serveSpeed() {
    var s = BASE_SPEED * (1 + (myScore + aiScore) * ROUND_ACCEL) * speedMult;
    return clamp(s, MIN_SPEED * speedMult, maxSpeed());
  }

  // ---------- particles / trail ----------
  function spawnParticles(x, y, color, count) {
    if (GamePlatform.ui.shouldReduceMotion()) return;
    for (var i = 0; i < count; i++) {
      if (particles.length >= PARTICLES_MAX) particles.shift();
      var ang = Math.random() * Math.PI * 2;
      var sp = 50 + Math.random() * 150;
      particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0.32 + Math.random() * 0.22,
        maxLife: 0.55,
        size: 2 + Math.random() * 3,
        color: color
      });
    }
  }

  // ---------- match flow ----------
  function startMatch() {
    myScore = 0;
    aiScore = 0;
    rallyHits = 0;
    longestRally = 0;
    serveOwner = 'player';
    pointsSinceSwitch = 0;
    player.cy = H / 2;
    ai.cy = H / 2;
    particles = [];
    trail = [];
    hideOverlays();
    beginServe();
    PP.audio.play('start');
    updateHUD();
  }

  function beginServe() {
    state = 'serving';
    serveT = 0;
    rallyHits = 0;
    var sx = serveOwner === 'player'
      ? player.x + player.w / 2 + BALL_R + 8
      : ai.x - ai.w / 2 - BALL_R - 8;
    var sy = serveOwner === 'player' ? player.cy : ai.cy;
    serveFrom.x = sx;
    serveFrom.y = sy;
    ball.x = sx;
    ball.y = sy;
    ball.vx = 0;
    ball.vy = 0;
    ai.targetY = H / 2;
    ai.think = 0;
    ai.bias = (Math.random() * 2 - 1) * aiError();
    trail = [];
    updateHUD();
  }

  function launchServe() {
    var dir = serveOwner === 'player' ? 1 : -1;
    var ang = (Math.random() - 0.5) * 0.6;
    var sp = serveSpeed();
    ball.vx = Math.cos(ang) * sp * dir;
    ball.vy = Math.sin(ang) * sp;
    state = 'playing';
    PP.audio.play('paddle');
    updateHUD();
  }

  function awardPoint(side) {
    if (state === 'paused') hideOverlays(); // 修改器在暂停中加分时恢复画面
    if (side === 'player') myScore++;
    else aiScore++;
    rallyHits = 0;
    flashTimer = 0.7;
    trail = [];
    PP.audio.play('score');
    updateHUD();

    if (myScore >= WIN_SCORE || aiScore >= WIN_SCORE) {
      endMatch();
      return;
    }

    // 每 2 分换发球
    pointsSinceSwitch++;
    if (pointsSinceSwitch >= 2) {
      pointsSinceSwitch = 0;
      serveOwner = serveOwner === 'player' ? 'ai' : 'player';
    }

    // 球出界：短暂停顿，随后发球动画
    ball.x = -100;
    ball.y = -100;
    pointTimer = POINT_PAUSE;
    state = 'pointpause';
  }

  function endMatch() {
    state = 'gameover';
    var won = myScore > aiScore;
    if (won) {
      streak++;
      if (streak > bestStreak) {
        bestStreak = streak;
        GamePlatform.storage.set('best:ping-pong:streak', bestStreak);
        toast('newRecord');
      }
      PP.audio.play('win');
    } else {
      streak = 0;
      PP.audio.play('lose');
    }
    document.getElementById('go-result').textContent = t(won ? 'win' : 'lose');
    document.getElementById('go-score').textContent = myScore + ' : ' + aiScore;
    document.getElementById('go-rally').textContent = String(longestRally);
    document.getElementById('go-best').textContent = String(bestStreak);
    showOverlay('ov-gameover');
    updateHUD();
  }

  // ---------- physics ----------
  function predictY() {
    if (ball.vx <= 0) return H / 2;
    var dist = ai.x - ball.x;
    if (dist <= 0) return ball.y;
    var tt = dist / ball.vx;
    var yy = ball.y + ball.vy * tt;
    var lo = WALL + BALL_R, hi = H - WALL - BALL_R;
    var span = hi - lo;
    if (span <= 0) return H / 2;
    var m = (yy - lo) % (2 * span);
    if (m < 0) m += 2 * span;
    if (m > span) m = 2 * span - m;
    return lo + m;
  }

  function bounceOff(pad, dir) {
    var rel = clamp((ball.y - pad.cy) / (pad.h / 2), -1, 1);
    var ang = rel * MAX_ANGLE; // 拍边缘 → 斜线
    var sp = ballSpeed() * HIT_ACCEL;
    sp = clamp(sp, MIN_SPEED * speedMult, maxSpeed());
    ball.x = pad.x + dir * (pad.w / 2 + BALL_R + 0.5);
    ball.vx = Math.cos(ang) * sp * dir;
    ball.vy = Math.sin(ang) * sp;
    rallyHits++;
    if (rallyHits > longestRally) longestRally = rallyHits;
    PP.audio.play('paddle');
    spawnParticles(ball.x, ball.y, pad === player ? pal.paddle : pal.paddleAI, 6);
    updateHUD();
  }

  function update(dt) {
    var i;

    // 我方球拍：键盘 / 自动接球（暂停时 update 不运行，天然不响应）
    if (state === 'playing' || state === 'serving' || state === 'pointpause') {
      var move = 0;
      if (keys.w || keys.W || keys.ArrowUp) move -= 1;
      if (keys.s || keys.S || keys.ArrowDown) move += 1;
      if (move !== 0) player.cy += move * playerSpeed * dt;
      if (cheatAuto && state === 'playing') {
        var dy = ball.y - player.cy;
        var step = playerSpeed * dt;
        if (Math.abs(dy) <= step) player.cy = ball.y;
        else player.cy += (dy > 0 ? step : -step);
      }
      player.cy = clamp(player.cy, WALL + player.h / 2, H - WALL - player.h / 2);
    }

    // AI 球拍：按反应间隔重新预判，再匀速追目标
    if (state === 'playing' || state === 'serving' || state === 'pointpause') {
      ai.think -= dt;
      if (ai.think <= 0) {
        ai.think = aiDelay();
        if (state === 'playing' && ball.vx > 0) {
          ai.targetY = clamp(predictY() + ai.bias, WALL + ai.h / 2, H - WALL - ai.h / 2);
        } else {
          ai.targetY = H / 2;
        }
      }
      var ady = ai.targetY - ai.cy;
      var astep = aiMoveSpeed() * dt;
      if (Math.abs(ady) <= astep) ai.cy = ai.targetY;
      else ai.cy += (ady > 0 ? astep : -astep);
      ai.cy = clamp(ai.cy, WALL + ai.h / 2, H - WALL - ai.h / 2);
    }

    // 得分停顿 → 发球动画 → 对打
    if (state === 'pointpause') {
      pointTimer -= dt;
      if (pointTimer <= 0) beginServe();
    } else if (state === 'serving') {
      serveT += dt / SERVE_DUR;
      var e = serveT < 1 ? serveT : 1;
      e = e * (2 - e); // ease-out
      ball.x = serveFrom.x + (W / 2 - serveFrom.x) * e;
      ball.y = serveFrom.y + (H / 2 - serveFrom.y) * e;
      if (serveT >= 1) launchServe();
    }

    if (flashTimer > 0) flashTimer -= dt;

    if (state === 'playing') {
      var sp = ballSpeed();
      var steps = Math.max(1, Math.ceil(sp * dt / 8));
      var sdt = dt / steps;
      for (var s = 0; s < steps && state === 'playing'; s++) {
        ball.x += ball.vx * sdt;
        ball.y += ball.vy * sdt;

        // 上下边
        if (ball.y - BALL_R < WALL) {
          ball.y = WALL + BALL_R;
          ball.vy = Math.abs(ball.vy);
          PP.audio.play('wall');
          spawnParticles(ball.x, ball.y, pal.wall, 4);
        } else if (ball.y + BALL_R > H - WALL) {
          ball.y = H - WALL - BALL_R;
          ball.vy = -Math.abs(ball.vy);
          PP.audio.play('wall');
          spawnParticles(ball.x, ball.y, pal.wall, 4);
        }

        // 我方球拍（左）
        if (ball.vx < 0 &&
            ball.x - BALL_R <= player.x + player.w / 2 &&
            ball.x - BALL_R >= player.x - player.w / 2 - 12 &&
            ball.y >= player.cy - player.h / 2 - BALL_R &&
            ball.y <= player.cy + player.h / 2 + BALL_R) {
          bounceOff(player, 1);
        }

        // AI 球拍（右）
        if (ball.vx > 0 &&
            ball.x + BALL_R >= ai.x - ai.w / 2 &&
            ball.x + BALL_R <= ai.x + ai.w / 2 + 12 &&
            ball.y >= ai.cy - ai.h / 2 - BALL_R &&
            ball.y <= ai.cy + ai.h / 2 + BALL_R) {
          bounceOff(ai, -1);
        }

        // 出界得分
        if (ball.x < -BALL_R * 2) {
          awardPoint('ai');
        } else if (ball.x > W + BALL_R * 2) {
          awardPoint('player');
        }
      }

      if (!GamePlatform.ui.shouldReduceMotion()) {
        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > TRAIL_MAX) trail.shift();
      } else {
        trail = [];
      }
    }

    // 粒子
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  // ---------- rendering ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPaddle(pad, color, edge) {
    var x = pad.x - pad.w / 2, y = pad.cy - pad.h / 2;
    ctx.fillStyle = color;
    roundRect(x, y, pad.w, pad.h, 6);
    ctx.fill();
    ctx.fillStyle = edge;
    roundRect(x + 2, y + pad.h - 8, pad.w - 4, 5, 2);
    ctx.fill();
  }

  function render() {
    fit(canvas, ctx, W, H);

    // 桌面
    ctx.fillStyle = bgGrad || pal.bgTop;
    ctx.fillRect(0, 0, W, H);

    // 上下边
    ctx.fillStyle = pal.wall;
    ctx.fillRect(0, 0, W, WALL);
    ctx.fillRect(0, H - WALL, W, WALL);
    ctx.fillStyle = pal.wallEdge;
    ctx.fillRect(0, WALL, W, 2);
    ctx.fillRect(0, H - WALL - 2, W, 2);

    // 中线虚线
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.moveTo(W / 2, WALL + 12);
    ctx.lineTo(W / 2, H - WALL - 12);
    ctx.stroke();
    ctx.setLineDash([]);

    // 球拍
    drawPaddle(player, pal.paddle, pal.paddleEdge);
    drawPaddle(ai, pal.paddleAI, pal.paddleAIEdge);

    // 拖影（减少动态时关闭）
    var i;
    for (i = 0; i < trail.length; i++) {
      var frac = (i + 1) / trail.length;
      ctx.globalAlpha = frac * 0.28;
      ctx.fillStyle = pal.ball;
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, BALL_R * (0.4 + 0.6 * frac), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 球
    var g = ctx.createRadialGradient(
      ball.x - BALL_R * 0.35, ball.y - BALL_R * 0.35, BALL_R * 0.2,
      ball.x, ball.y, BALL_R);
    g.addColorStop(0, pal.ball);
    g.addColorStop(1, pal.ballEdge);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    // 粒子
    for (i = 0; i < particles.length; i++) {
      var pt = particles[i];
      ctx.globalAlpha = Math.max(pt.life / pt.maxLife, 0);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // 发球提示
    if (state === 'serving' || state === 'pointpause') {
      var sx = serveOwner === 'player' ? 64 : W - 64;
      ctx.fillStyle = pal.flash;
      ctx.font = '600 15px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('serveHint'), sx, 34);
    }

    // 得分闪字
    if (flashTimer > 0) {
      ctx.globalAlpha = Math.min(flashTimer / 0.7, 1);
      ctx.fillStyle = pal.flash;
      ctx.font = '700 28px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('pointFlash'), W / 2, H / 2 - 44);
      ctx.globalAlpha = 1;
    }
  }

  // ---------- HUD / overlays / i18n ----------
  function diffLabel() {
    return t(difficulty === 'easy' ? 'diffEasy' : (difficulty === 'hard' ? 'diffHard' : 'diffNormal'));
  }

  function stateLabel() {
    var map = {
      menu: 'stateMenu', serving: 'stateServing', playing: 'statePlaying',
      pointpause: 'statePointpause', paused: 'statePaused', gameover: 'stateGameover'
    };
    return t(map[state] || 'stateMenu');
  }

  function updateHUD() {
    document.getElementById('hud-score').textContent =
      t('meShort') + ' ' + myScore + ' : ' + aiScore + ' ' + t('aiShort');
    document.getElementById('hud-round').textContent = String(rallyHits);
    document.getElementById('hud-diff').textContent = diffLabel();
  }

  function showOverlay(id) {
    var ids = ['ov-menu', 'ov-pause', 'ov-gameover'];
    for (var i = 0; i < ids.length; i++) {
      document.getElementById(ids[i]).hidden = ids[i] !== id;
    }
  }
  function hideOverlays() {
    showOverlay('');
  }

  function applyLang() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      if (STR[key]) nodes[i].textContent = t(key);
    }
    if (state === 'gameover') {
      document.getElementById('go-result').textContent = t(myScore > aiScore ? 'win' : 'lose');
    }
    updateHUD();
  }

  function setDifficulty(d) {
    difficulty = d;
    aiLevel = DIFFS[d] != null ? DIFFS[d] : DIFFS.normal;
    var btns = document.querySelectorAll('.diff-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('is-active', btns[i].getAttribute('data-diff') === d);
    }
    updateHUD();
  }

  // ---------- input ----------
  function canvasY(clientY) {
    var rect = canvas.getBoundingClientRect();
    return (clientY - rect.top) * (H / rect.height);
  }

  function onPointerMove(e) {
    if (state === 'paused' || state === 'menu' || state === 'gameover') return;
    if (e.clientY == null) return;
    player.cy = clamp(canvasY(e.clientY), WALL + player.h / 2, H - WALL - player.h / 2);
  }

  function togglePause() {
    if (state === 'paused') {
      state = prevState;
      hideOverlays();
    } else if (state === 'menu' || state === 'gameover') {
      // 菜单 / 结算中不响应暂停
    } else {
      prevState = state;
      state = 'paused';
      showOverlay('ov-pause');
    }
  }

  function bindInput() {
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', function (e) {
      PP.audio.unlock();
      onPointerMove(e);
    });

    document.addEventListener('keydown', function (e) {
      PP.audio.unlock();
      keys[e.key] = true;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (state === 'menu') startMatch();
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
      }
    });
    document.addEventListener('keyup', function (e) {
      keys[e.key] = false;
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && (state === 'playing' || state === 'serving' || state === 'pointpause')) {
        togglePause();
      }
    });

    document.addEventListener('pointerdown', function () { PP.audio.unlock(); }, { once: true });

    document.getElementById('btn-home').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-pause').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-go').onclick = function () { GamePlatform.navigate.goHome(); };

    document.getElementById('btn-start').onclick = function () {
      PP.audio.unlock();
      startMatch();
    };

    var diffBtns = document.querySelectorAll('.diff-btn');
    for (var i = 0; i < diffBtns.length; i++) {
      (function (btn) {
        btn.onclick = function () {
          setDifficulty(btn.getAttribute('data-diff'));
        };
      })(diffBtns[i]);
    }

    document.getElementById('btn-pause').onclick = togglePause;
    document.getElementById('btn-resume').onclick = togglePause;
    document.getElementById('btn-restart-pause').onclick = function () {
      hideOverlays();
      startMatch();
    };
    document.getElementById('btn-again-go').onclick = function () {
      hideOverlays();
      startMatch();
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
    if (state !== 'paused' && state !== 'menu' && state !== 'gameover') {
      update(dt);
    }
    render();
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  function init() {
    rebuildPal();
    bestStreak = GamePlatform.storage.get('best:ping-pong:streak', 0) || 0;
    setDifficulty('normal');
    player.cy = H / 2;
    ai.cy = H / 2;
    ball.x = W / 2;
    ball.y = H / 2;
    state = 'menu';
    showOverlay('ov-menu');
    document.getElementById('menu-best').textContent = String(bestStreak);
    applyLang();
    bindInput();
    updateHUD();
    requestAnimationFrame(frame);
  }

  GamePlatform.ready.then(function () {
    init();
    GamePlatform.i18n.onChange(function () { applyLang(); });
    GamePlatform.theme.onChange(function () { rebuildPal(); });
  });

  /* ------------------------------------------------------------ */
  /* 修改器钩子（暗号 potato4096，见 platform/cheat-kit.js）        */
  /* ------------------------------------------------------------ */

  if (window.CheatKit) {
    CheatKit.init({
      id: 'ping-pong',
      title: { zh: '🔧 修改器', en: '🔧 Modifier' },
      hint: { zh: '彩蛋面板 · 参数即时生效', en: 'Easter egg · changes apply instantly' },
      stats: [
        { label: { zh: '比分', en: 'Score' }, get: function () { return myScore + ' : ' + aiScore; } },
        { label: { zh: '回合数', en: 'Rally' }, get: function () { return rallyHits; } },
        { label: { zh: '球速', en: 'Ball speed' }, get: function () {
          var sp = ballSpeed();
          return Math.round(sp > 1 ? sp : serveSpeed());
        }, tone: 'success' },
        { label: { zh: '最长对拉拍数', en: 'Longest rally' }, get: function () { return longestRally; }, tone: 'warning' },
        { label: { zh: '难度', en: 'Difficulty' }, get: diffLabel },
        { label: { zh: '状态', en: 'State' }, get: stateLabel }
      ],
      params: [
        { key: 'speedMult', label: { zh: '球速倍率', en: 'Ball speed ×' },
          min: 0.5, max: 3, step: 0.1, digits: 1,
          get: function () { return speedMult; },
          set: function (v) {
            var old = speedMult;
            speedMult = v;
            var sp = ballSpeed();
            if (sp > 1 && old > 0) {
              setBallSpeed(clamp(sp * v / old, MIN_SPEED * v, maxSpeed()));
            }
          } },
        { key: 'playerSpeed', label: { zh: '我方拍移动速度', en: 'Paddle move speed' },
          min: 100, max: 1200, step: 10,
          get: function () { return playerSpeed; },
          set: function (v) { playerSpeed = v; } },
        { key: 'aiLevel', label: { zh: 'AI 反应', en: 'AI reaction' },
          min: 0, max: 100, step: 1,
          get: function () { return aiLevel; },
          set: function (v) { aiLevel = v; } }
      ],
      toggles: [
        { label: { zh: '无限加速', en: 'No speed cap' },
          on: { zh: '无限加速：开', en: 'No speed cap: ON' },
          off: { zh: '无限加速：关', en: 'No speed cap: OFF' },
          get: function () { return cheatNoCap; },
          set: function (v) { cheatNoCap = !!v; } },
        { label: { zh: '自动接球', en: 'Auto return' },
          on: { zh: '自动接球：开', en: 'Auto return: ON' },
          off: { zh: '自动接球：关', en: 'Auto return: OFF' },
          get: function () { return cheatAuto; },
          set: function (v) { cheatAuto = !!v; } }
      ],
      actions: [
        { label: { zh: '我方加 1 分', en: '+1 for me' }, tone: 'primary',
          run: function () {
            if (state === 'menu' || state === 'gameover') {
              myScore++;
              updateHUD();
              return;
            }
            awardPoint('player');
          },
          toast: { zh: '我方 +1 分', en: '+1 point for you' } },
        { label: { zh: '对手减 1 分', en: '-1 for opponent' },
          run: function () {
            aiScore = Math.max(0, aiScore - 1);
            updateHUD();
          },
          toast: { zh: '对手 -1 分', en: '-1 point for opponent' } },
        { label: { zh: '换发球', en: 'Switch serve' },
          run: function () {
            serveOwner = serveOwner === 'player' ? 'ai' : 'player';
            pointsSinceSwitch = 0;
          },
          toast: { zh: '已换发球', en: 'Serve switched' } },
        { label: { zh: '重开本局', en: 'Restart match' },
          run: function () { startMatch(); },
          toast: { zh: '本局已重开', en: 'Match restarted' } }
      ]
    });
  }
})();
