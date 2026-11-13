/* penalty-shootout - slingshot pitch: pull the ball backward, it flies at constant
   speed forever, bounces off the edges, goals are gaps in the left/right walls */
(function () {
  'use strict';

  var PS = window.PS = window.PS || {};

  // ---------- constants ----------
  var W = 640, H = 400;
  var MARGIN = 26;                 // 边墙
  var BALL_R = 12;
  var SPEED = 620;                 // 恒定球速（无力度概念，稍快）
  var MIN_DRAG = 24;               // 拉得太短则取消
  var SHOTS = 5;
  var BEST_KEY = 'best:penalty-shootout:goals';

  // ---------- i18n ----------
  var STR = {
    title: { zh: '足球射门', en: 'Soccer Shootout' },
    tagline: {
      zh: '按住球向后拉，松手弹射。球速恒定永不减速，撞边就弹，球门只有一个，左右侧与高度每脚随机换位置。',
      en: 'Pull the ball backward and release to slingshot it. Constant speed, bounces off every edge — the single goal switches sides and height every shot.'
    },
    shot: { zh: '射门', en: 'Shots' },
    goals: { zh: '进球', en: 'Goals' },
    streak: { zh: '连进', en: 'Streak' },
    bestStreak: { zh: '最长连进', en: 'Best streak' },
    accuracy: { zh: '命中率', en: 'Accuracy' },
    best: { zh: '最高进球', en: 'Best' },
    start: { zh: '开始游戏', en: 'Start' },
    restart: { zh: '重新开始', en: 'Restart' },
    resume: { zh: '继续游戏', en: 'Resume' },
    paused: { zh: '已暂停', en: 'Paused' },
    gameOver: { zh: '比赛结束', en: 'Full Time' },
    again: { zh: '再玩一次', en: 'Play Again' },
    home: { zh: '返回主页', en: 'Home' },
    clearRecords: { zh: '清除记录', en: 'Clear Records' },
    cleared: { zh: '记录已清除', en: 'Records cleared' },
    newRecord: { zh: '新纪录！', en: 'New record!' },
    goalBanner: { zh: '进球！', en: 'GOAL!' },
    missBanner: { zh: '射偏了', en: 'Missed' },
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    pauseBtn: { zh: '暂停', en: 'Pause' },
    controls: {
      zh: '操作：按住球向后拉（往目标的反方向），松手弹射。球速恒定、永不减速，撞到边缘反弹；球门只有一个，左右侧与高度每脚随机换位置。共 5 脚，Esc / P 暂停。',
      en: 'Controls: pull the ball backward (away from the target) and release to slingshot it. Constant speed, never slows, bounces off edges. There is a single goal that switches side and height every shot. 5 shots per round, Esc / P to pause.'
    }
  };
  function t(k) { return GamePlatform.i18n.t(STR[k] || { zh: k, en: k }); }

  // ---------- canvas ----------
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  function fit(cv, g, w, h) {
    var dpr = window.devicePixelRatio || 1;
    var rect = cv.getBoundingClientRect();
    var bw = Math.max(1, Math.round((rect.width || w) * dpr));
    var bh = Math.max(1, Math.round((h * bw) / w));
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    g.setTransform(bw / w, 0, 0, bh / h, 0, 0);
    return g;
  }

  // ---------- palettes ----------
  var WORLD = {
    light: {
      grassA: '#79c267', grassB: '#6cb55c', line: '#f4f8f2',
      net: '#dfe8da', netLine: '#b9c9b2', post: '#f7faf6', postEdge: '#8aa07f',
      gap: '#1d3323',
      ball: '#ffffff', ballEdge: '#6c7a68', seam: '#9aa894',
      aim: '#1f6fd0', aimSoft: '#1f6fd055', pull: '#ff6b6b99', banner: '#12321c', shadow: '#1c332233'
    },
    dark: {
      grassA: '#2f7a45', grassB: '#2a6d3e', line: '#dcecd7',
      net: '#24402c', netLine: '#3c6347', post: '#e6f0e2', postEdge: '#4a6b52',
      gap: '#0c1a11',
      ball: '#f2f7ef', ballEdge: '#8fa38c', seam: '#a9baa4',
      aim: '#7fb2ff', aimSoft: '#7fb2ff55', pull: '#ff9b9b99', banner: '#e9f5e6', shadow: '#00000044'
    }
  };
  var pal = WORLD.light;
  function rebuildPal() {
    pal = GamePlatform.theme.get() === 'dark' ? WORLD.dark : WORLD.light;
  }

  // ---------- state ----------
  var state = 'menu';        // menu | aim | flying | result | paused | over
  var beforePause = 'aim';
  var ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  var goal = { side: 1, y: H / 2 - 70, h: 140 };   // 唯一球门：side -1 左 / 1 右
  var dragging = false;
  var pointer = { x: W / 2, y: H / 2 + 80 };
  var shotsUsed = 0;
  var goals = 0;
  var streak = 0;
  var bestStreak = 0;
  var best = 0;
  var banner = '';
  var bannerT = 0;
  var resultT = 0;
  var cheatSpeed = 1;
  var cheatGoalH = 0;        // 0 = 自动随机
  var cheatGoal = false;     // 必进球
  var cheatAim = false;      // 自动瞄准

  // ---------- goals / ball ----------
  function randomGoal() {
    var h = cheatGoalH > 0 ? cheatGoalH : (150 - goals * 8 + Math.random() * 30);
    h = Math.max(80, Math.min(230, h));
    goal.side = Math.random() < 0.5 ? -1 : 1;
    goal.h = h;
    goal.y = 56 + Math.random() * (H - 112 - h);
  }

  function resetBall() {
    ball.x = W / 2;
    ball.y = H / 2;
    ball.vx = 0;
    ball.vy = 0;
    dragging = false;
    canvas.classList.remove('is-dragging');
    randomGoal();
    state = 'aim';
  }

  function newGame() {
    shotsUsed = 0;
    goals = 0;
    streak = 0;
    bestStreak = 0;
    banner = '';
    resetBall();
  }

  // ---------- input ----------
  function toLogical(e) {
    var rect = canvas.getBoundingClientRect();
    var p = e.touches ? e.touches[0] : e;
    return {
      x: (p.clientX - rect.left) * (W / rect.width),
      y: (p.clientY - rect.top) * (H / rect.height)
    };
  }

  function nearBall(pt) {
    var dx = pt.x - ball.x, dy = pt.y - ball.y;
    return dx * dx + dy * dy <= 80 * 80;
  }

  function onDown(e) {
    if (state !== 'aim' && state !== 'flying') return;
    var pt = toLogical(e);
    if (!nearBall(pt)) return;
    dragging = true;
    if (state === 'flying') { ball.vx = 0; ball.vy = 0; }   // 飞行中抓住球 = 停下重新瞄准
    state = 'aim';
    pointer = pt;
    canvas.classList.add('is-dragging');
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging) return;
    pointer = toLogical(e);
    e.preventDefault();
  }

  function onUp(e) {
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('is-dragging');
    if (e && e.changedTouches) {
      var rect = canvas.getBoundingClientRect();
      var p = e.changedTouches[0];
      pointer = {
        x: (p.clientX - rect.left) * (W / rect.width),
        y: (p.clientY - rect.top) * (H / rect.height)
      };
    } else if (e && typeof e.clientX === 'number') {
      var r2 = canvas.getBoundingClientRect();
      pointer = { x: (e.clientX - r2.left) * (W / r2.width), y: (e.clientY - r2.top) * (H / r2.height) };
    }
    launch();
  }

  /** 向后拉：发射方向 = 球 - 指针（与拖拽方向相反） */
  function launch() {
    var dx = ball.x - pointer.x;
    var dy = ball.y - pointer.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < MIN_DRAG) return;

    var nx = dx / dist, ny = dy / dist;
    if (cheatAim) {
      // 自动瞄准唯一球门的中心
      var tx = goal.side < 0 ? MARGIN : W - MARGIN;
      var ty = goal.y + goal.h / 2;
      var adx = tx - ball.x, ady = ty - ball.y;
      var al = Math.sqrt(adx * adx + ady * ady) || 1;
      nx = adx / al;
      ny = ady / al;
    }

    var sp = SPEED * cheatSpeed;
    ball.vx = nx * sp;
    ball.vy = ny * sp;
    shotsUsed++;
    state = 'flying';
    PS.audio.play('kick');
    updateHUD();
  }

  // ---------- physics：恒定速度，无减速 ----------
  function step(dt) {
    if (state !== 'flying') return;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // 上下墙
    if (ball.y < MARGIN + BALL_R) { ball.y = MARGIN + BALL_R; ball.vy = Math.abs(ball.vy); PS.audio.play('bounce'); }
    if (ball.y > H - MARGIN - BALL_R) { ball.y = H - MARGIN - BALL_R; ball.vy = -Math.abs(ball.vy); PS.audio.play('bounce'); }

    // 左右墙：只有球门那一侧有门洞
    if (ball.x < MARGIN + BALL_R) {
      var inL = goal.side < 0 && ball.y > goal.y && ball.y < goal.y + goal.h;
      if (inL || cheatGoal) { resolveShot(true); return; }
      ball.x = MARGIN + BALL_R;
      ball.vx = Math.abs(ball.vx);
      PS.audio.play('bounce');
    }
    if (ball.x > W - MARGIN - BALL_R) {
      var inR = goal.side > 0 && ball.y > goal.y && ball.y < goal.y + goal.h;
      if (inR || cheatGoal) { resolveShot(true); return; }
      ball.x = W - MARGIN - BALL_R;
      ball.vx = -Math.abs(ball.vx);
      PS.audio.play('bounce');
    }
  }

  function resolveShot(scored) {
    if (state !== 'flying') return;
    state = 'result';
    resultT = 0.95;
    if (scored) {
      goals++;
      streak++;
      if (streak > bestStreak) bestStreak = streak;
      banner = t('goalBanner');
      PS.audio.play('goal');
      if (goals > best) {
        best = goals;
        GamePlatform.storage.set(BEST_KEY, best);
      }
    } else {
      streak = 0;
      banner = t('missBanner');
      PS.audio.play('miss');
    }
    bannerT = 0.95;
    updateHUD();
  }

  function endGame() {
    state = 'over';
    saveBest();
    set('go-goals', String(goals));
    set('go-shots', String(SHOTS));
    set('go-acc', shotsUsed ? Math.round(goals / shotsUsed * 100) + '%' : '0%');
    set('go-streak', String(bestStreak));
    set('go-best', String(best));
    showOverlay('ov-gameover');
    PS.audio.play(goals >= 3 ? 'win' : 'lose');
  }

  // ---------- storage ----------
  function loadBest() {
    var v = GamePlatform.storage.get(BEST_KEY, 0);
    best = typeof v === 'number' ? v : (parseInt(v, 10) || 0);
  }
  function saveBest() {
    if (goals > best) {
      best = goals;
      GamePlatform.storage.set(BEST_KEY, best);
    }
    updateHUD();
  }
  function clearRecords() {
    best = 0;
    GamePlatform.storage.set(BEST_KEY, 0);
    updateHUD();
    GamePlatform.ui.toast(t('cleared'));
  }

  // ---------- hud ----------
  function set(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function updateHUD() {
    if (goals > best) best = goals;
    set('hud-shot', shotsUsed + '/' + SHOTS);
    set('hud-goals', String(goals));
    set('hud-streak', String(streak));
    set('hud-acc', shotsUsed ? Math.round(goals / shotsUsed * 100) + '%' : '0%');
    set('menu-best', String(best));
  }

  // ---------- overlays ----------
  function hideOverlays() {
    ['ov-menu', 'ov-pause', 'ov-gameover'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }
  function showOverlay(id) {
    hideOverlays();
    var el = document.getElementById(id);
    if (el) el.hidden = false;
    if (id === 'ov-menu') { loadBest(); set('menu-best', String(best)); }
  }

  function togglePause() {
    if (state === 'menu' || state === 'over') return;
    var pv = document.getElementById('ov-pause');
    if (state === 'paused') {
      if (pv) pv.hidden = true;
      state = beforePause;
    } else {
      beforePause = state;
      state = 'paused';
      dragging = false;
      canvas.classList.remove('is-dragging');
      showOverlay('ov-pause');
    }
  }

  // ---------- rendering ----------
  function drawNet(x, y, w, h) {
    ctx.fillStyle = pal.net;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = pal.netLine;
    ctx.lineWidth = 1;
    for (var i = 1; i < 6; i++) {
      var gx = x + (w / 6) * i;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }
    for (var j = 1; j < 5; j++) {
      var gy = y + (h / 5) * j;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
  }

  function drawPitch() {
    var g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, pal.grassA);
    g.addColorStop(1, pal.grassB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (var i = 0; i < 8; i++) {
      if (i % 2 === 0) continue;
      ctx.fillRect((W / 8) * i, 0, W / 8, H);
    }

    // 边墙
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 3;
    ctx.strokeRect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);

    // 中线 + 中圈
    ctx.beginPath();
    ctx.moveTo(W / 2, MARGIN);
    ctx.lineTo(W / 2, H - MARGIN);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 58, 0, Math.PI * 2);
    ctx.stroke();

    // 唯一球门：暗色开口 + 外伸球网 + 门柱
    var gx = goal.side < 0 ? MARGIN - 2 : W - MARGIN - 4;
    var nx0 = goal.side < 0 ? MARGIN - 34 : W - MARGIN + 2;
    var px = goal.side < 0 ? MARGIN - 6 : W - MARGIN - 4;
    ctx.fillStyle = pal.gap;
    ctx.fillRect(gx, goal.y, 6, goal.h);
    drawNet(nx0, goal.y, 32, goal.h);
    ctx.fillStyle = pal.post;
    ctx.fillRect(px, goal.y - 5, 10, 5);
    ctx.fillRect(px, goal.y + goal.h, 10, 5);
    ctx.strokeStyle = pal.postEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(px, goal.y - 5, 10, goal.h + 10);
  }

  function drawBall() {
    ctx.save();
    ctx.fillStyle = pal.shadow;
    ctx.beginPath();
    ctx.ellipse(ball.x + 3, ball.y + 4, BALL_R * 1.05, BALL_R * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    var g = ctx.createRadialGradient(ball.x - 4, ball.y - 5, 2, ball.x, ball.y, BALL_R);
    g.addColorStop(0, pal.ball);
    g.addColorStop(1, pal.ballEdge);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.ballEdge;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.strokeStyle = pal.seam;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** 瞄准：拉力线（红）+ 发射方向箭头（蓝）+ 虚线弹道 */
  function drawAim() {
    if (state !== 'aim') return;
    var dx = ball.x - pointer.x, dy = ball.y - pointer.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (!dragging || dist < 8) {
      if (!GamePlatform.ui.shouldReduceMotion()) {
        ctx.strokeStyle = pal.aimSoft;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R + 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    var nx = dx / dist, ny = dy / dist;

    // 拉力线：球 → 指针（向后拉的那一端）
    ctx.save();
    ctx.strokeStyle = pal.pull;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(pointer.x, pointer.y);
    ctx.stroke();
    ctx.restore();

    // 发射方向：与拉力相反
    var tipX = ball.x + nx * 130;
    var tipY = ball.y + ny * 130;
    ctx.save();
    ctx.strokeStyle = pal.aim;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(ball.x + nx * (BALL_R + 6), ball.y + ny * (BALL_R + 6));
    ctx.lineTo(ball.x + nx * 300, ball.y + ny * 300);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = pal.aim;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ball.x + nx * (BALL_R + 4), ball.y + ny * (BALL_R + 4));
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    var ang = Math.atan2(ny, nx);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - 13 * Math.cos(ang - 0.45), tipY - 13 * Math.sin(ang - 0.45));
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - 13 * Math.cos(ang + 0.45), tipY - 13 * Math.sin(ang + 0.45));
    ctx.stroke();
  }

  function drawBanner() {
    if (bannerT <= 0 || !banner) return;
    var alpha = Math.min(1, bannerT * 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pal.banner;
    ctx.fillText(banner, W / 2, H / 2 - 70);
    ctx.restore();
  }

  function render() {
    ctx = fit(canvas, ctx, W, H);
    drawPitch();
    drawBall();
    drawAim();
    drawBanner();
  }

  // ---------- loop ----------
  var lastT = 0;
  function loop(ts) {
    var dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016);
    lastT = ts;
    if (state !== 'paused' && state !== 'menu' && state !== 'over') {
      step(dt);
      if (bannerT > 0) bannerT -= dt;
      if (state === 'result') {
        resultT -= dt;
        if (resultT <= 0) {
          if (shotsUsed >= SHOTS) endGame();
          else resetBall();
        }
      }
    }
    render();
    requestAnimationFrame(loop);
  }

  // ---------- i18n ----------
  function applyLang() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
    updateHUD();
  }

  // ---------- boot ----------
  function bind() {
    document.getElementById('btn-home').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-pause').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-go').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-start').onclick = function () {
      hideOverlays();
      newGame();
      PS.audio.play('start');
    };
    document.getElementById('btn-again-go').onclick = function () {
      hideOverlays();
      newGame();
      PS.audio.play('start');
    };
    document.getElementById('btn-restart-pause').onclick = function () {
      hideOverlays();
      newGame();
      PS.audio.play('start');
    };
    document.getElementById('btn-resume').onclick = togglePause;
    document.getElementById('btn-pause').onclick = togglePause;
    document.getElementById('btn-clear').onclick = clearRecords;
    document.getElementById('btn-fullscreen').onclick = function () {
      GamePlatform.ui.requestFullscreen(document.documentElement);
    };
    document.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    });
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: false });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    canvas.addEventListener('touchend', onUp, { passive: false });
  }

  GamePlatform.ready.then(function () {
    rebuildPal();
    loadBest();
    applyLang();
    bind();
    randomGoal();
    updateHUD();
    showOverlay('ov-menu');

    GamePlatform.theme.onChange(function () { rebuildPal(); });
    GamePlatform.i18n.onChange(function () { applyLang(); });
  });

  requestAnimationFrame(loop);

  // ---------- cheat kit ----------
  if (window.CheatKit) {
    CheatKit.init({
      id: 'penalty-shootout',
      title: { zh: '🔧 修改器', en: '🔧 Modifier' },
      hint: { zh: '彩蛋面板 · 参数即时生效', en: 'Easter egg · changes apply instantly' },
      stats: [
        { label: { zh: '进球', en: 'Goals' }, get: function () { return goals; }, tone: 'success' },
        { label: { zh: '射门', en: 'Shots' }, get: function () { return shotsUsed + '/' + SHOTS; } },
        { label: { zh: '命中率', en: 'Accuracy' }, get: function () {
          return shotsUsed ? Math.round(goals / shotsUsed * 100) + '%' : '0%';
        }, tone: 'warning' },
        { label: { zh: '连进', en: 'Streak' }, get: function () { return streak; } },
        { label: { zh: '球速', en: 'Ball speed' }, get: function () {
          return Math.round(Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy));
        } },
        { label: { zh: '球门', en: 'Goal' }, get: function () {
          return (goal.side < 0 ? 'L ' : 'R ') + Math.round(goal.y) + ' + ' + Math.round(goal.h);
        } },
        { label: { zh: '状态', en: 'State' }, get: function () {
          return { menu: 'menu', aim: 'aim', flying: 'flying', result: 'result', paused: 'paused', over: 'over' }[state] || state;
        } }
      ],
      params: [
        { key: 'speed', label: { zh: '球速倍率', en: 'Speed ×' }, min: 0.3, max: 3, step: 0.1,
          get: function () { return cheatSpeed; },
          set: function (v) {
            cheatSpeed = Math.max(0.3, Math.min(3, v));
            // 恒定速度：飞行中立即按新倍率重标定
            var sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (sp > 1 && state === 'flying') {
              var target = SPEED * cheatSpeed;
              ball.vx = ball.vx / sp * target;
              ball.vy = ball.vy / sp * target;
            }
          } },
        { key: 'goalh', label: { zh: '球门高度(0=随机)', en: 'Goal height (0=auto)' }, min: 0, max: 230, step: 10,
          get: function () { return cheatGoalH; },
          set: function (v) {
            cheatGoalH = Math.max(0, Math.min(230, Math.round(v)));
            if (state === 'aim') randomGoal();
          } }
      ],
      toggles: [
        { label: { zh: '必进球', en: 'Auto goal' },
          on: { zh: '必进球：开', en: 'Auto goal: ON' },
          off: { zh: '必进球：关', en: 'Auto goal: OFF' },
          get: function () { return cheatGoal; },
          set: function (v) { cheatGoal = !!v; } },
        { label: { zh: '自动瞄准', en: 'Auto aim' },
          on: { zh: '自动瞄准：开', en: 'Auto aim: ON' },
          off: { zh: '自动瞄准：关', en: 'Auto aim: OFF' },
          get: function () { return cheatAim; },
          set: function (v) { cheatAim = !!v; } }
      ],
      actions: [
        { label: { zh: '直接判进球 +1', en: 'Force goal +1' }, tone: 'danger', run: function () {
          if (state === 'result') return;
          shotsUsed++;
          state = 'flying';
          resolveShot(true);
        }, toast: { zh: '已判进球', en: 'Goal awarded' } },
        { label: { zh: '换个球门位置', en: 'Move goal' }, run: function () { randomGoal(); },
          toast: { zh: '球门已换位置', en: 'Goal moved' } },
        { label: { zh: '球回中心（不计射门）', en: 'Reset ball' }, run: function () {
          banner = ''; bannerT = 0;
          resetBall();
        } },
        { label: { zh: '重开本局', en: 'Restart round' }, run: function () {
          hideOverlays();
          newGame();
        } }
      ]
    });
  }
})();
