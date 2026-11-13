/* penalty-shootout - top-down pitch, drag the ball toward the random goal and release */
(function () {
  'use strict';

  var PS = window.PS = window.PS || {};

  // ---------- constants ----------
  var W = 560, H = 760;
  var MARGIN = 26;                 // 边线
  var GOAL_LINE_Y = 34;            // 球门线（上方）
  var GOAL_DEPTH = 26;             // 球门纵深（画在门线之上）
  var BALL_R = 13;
  var BALL_X = W / 2, BALL_Y = H - 118;
  var SHOTS = 5;
  var MAX_DRAG = 260;              // 拖拽距离 → 满力
  var MAX_SPEED = 1250;
  var STOP_SPEED = 22;
  var BEST_KEY = 'best:penalty-shootout:goals';

  // ---------- i18n ----------
  var STR = {
    title: { zh: '足球射门', en: 'Soccer Shootout' },
    tagline: {
      zh: '俯视足球场，球在下方中央。按住球拖向球门方向，松手射门——球门每一脚都在随机换位置。',
      en: 'A top-down pitch with the ball at the bottom centre. Drag it toward the goal and release — the goal jumps to a random spot every shot.'
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
      zh: '操作：按住球拖向球门方向瞄准，松手射门，拖得越远力量越大。球门每脚随机换位置，共 5 脚。Esc / P 暂停。',
      en: 'Controls: drag the ball toward the goal and release to shoot — the longer the drag, the harder the strike. The goal moves every shot, 5 shots per round. Esc / P to pause.'
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
      sky: '#e8f0e2', grassA: '#79c267', grassB: '#6cb55c', line: '#f4f8f2',
      net: '#dfe8da', netLine: '#b9c9b2', post: '#f7faf6', postEdge: '#8aa07f',
      ball: '#ffffff', ballEdge: '#6c7a68', seam: '#9aa894',
      aim: '#1f6fd0', aimSoft: '#1f6fd055', powerBg: '#00000022', powerFg: '#ffb703',
      banner: '#12321c', shadow: '#1c332233'
    },
    dark: {
      sky: '#16221a', grassA: '#2f7a45', grassB: '#2a6d3e', line: '#dcecd7',
      net: '#24402c', netLine: '#3c6347', post: '#e6f0e2', postEdge: '#4a6b52',
      ball: '#f2f7ef', ballEdge: '#8fa38c', seam: '#a9baa4',
      aim: '#7fb2ff', aimSoft: '#7fb2ff55', powerBg: '#ffffff22', powerFg: '#ffd166',
      banner: '#e9f5e6', shadow: '#00000044'
    }
  };
  var pal = WORLD.light;

  function rebuildPal() {
    pal = GamePlatform.theme.get() === 'dark' ? WORLD.dark : WORLD.light;
  }

  // ---------- state ----------
  var state = 'menu';        // menu | aim | flying | result | paused | over
  var beforePause = 'aim';
  var ball = { x: BALL_X, y: BALL_Y, vx: 0, vy: 0 };
  var goal = { x: 0, w: 180 };
  var dragging = false;
  var pointer = { x: BALL_X, y: BALL_Y - 120 };
  var shotsUsed = 0;
  var goals = 0;
  var streak = 0;
  var bestStreak = 0;
  var best = 0;
  var banner = '';           // 进球/射偏提示
  var bannerT = 0;
  var resultT = 0;           // 结果停留计时
  var cheatPower = 1;
  var cheatGoalW = 0;        // 0 = 自动随机
  var cheatGoal = false;
  var cheatNoFriction = false;

  // ---------- goal / ball ----------
  function randomGoal() {
    var w = cheatGoalW > 0 ? cheatGoalW : (190 - goals * 10 + Math.random() * 40);
    w = Math.max(90, Math.min(280, w));
    var pad = MARGIN + 26;
    var x = pad + Math.random() * (W - pad * 2 - w);
    goal.x = x;
    goal.w = w;
  }

  function resetBall() {
    ball.x = BALL_X;
    ball.y = BALL_Y;
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
    return dx * dx + dy * dy <= 84 * 84;
  }

  function onDown(e) {
    if (state !== 'aim') return;
    var pt = toLogical(e);
    if (!nearBall(pt)) return;
    dragging = true;
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
    shoot();
  }

  function dragPower() {
    var dx = pointer.x - ball.x, dy = pointer.y - ball.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    return { dx: dx, dy: dy, dist: dist, power: Math.min(1, dist / MAX_DRAG) };
  }

  function shoot() {
    var d = dragPower();
    if (d.dist < 14 || d.dy > -6) { return; }   // 太短或没朝上，取消
    var speed = MAX_SPEED * d.power * cheatPower;
    var len = d.dist || 1;
    ball.vx = (d.dx / len) * speed;
    ball.vy = (d.dy / len) * speed;
    shotsUsed++;
    state = 'flying';
    PS.audio.play('kick');
    updateHUD();
  }

  // ---------- physics ----------
  function step(dt) {
    if (state !== 'flying') return;

    var friction = cheatNoFriction ? 0 : 1.15;
    if (friction > 0) {
      var k = Math.exp(-friction * dt);
      ball.vx *= k;
      ball.vy *= k;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    var left = MARGIN + BALL_R, right = W - MARGIN - BALL_R;
    if (ball.x < left) { ball.x = left; ball.vx = Math.abs(ball.vx) * 0.72; PS.audio.play('bounce'); }
    if (ball.x > right) { ball.x = right; ball.vx = -Math.abs(ball.vx) * 0.72; PS.audio.play('bounce'); }
    if (ball.y > H - MARGIN - BALL_R) { ball.y = H - MARGIN - BALL_R; ball.vy = -Math.abs(ball.vy) * 0.72; PS.audio.play('bounce'); }

    // 门线判定
    var top = GOAL_LINE_Y + BALL_R;
    if (ball.y <= top && ball.vy < 0) {
      var inGoal = ball.x > goal.x + BALL_R * 0.35 && ball.x < goal.x + goal.w - BALL_R * 0.35;
      if (inGoal || cheatGoal) {
        resolveShot(true);
      } else {
        ball.y = top;
        ball.vy = Math.abs(ball.vy) * 0.72;
        PS.audio.play('bounce');
      }
    }

    var sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (sp < STOP_SPEED) resolveShot(false);
  }

  function resolveShot(scored) {
    if (state !== 'flying') return;
    state = 'result';
    resultT = 1.05;
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
    bannerT = 1.05;
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
      showOverlay('ov-pause');
    }
  }

  // ---------- rendering ----------
  function drawPitch() {
    // 草地
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.grassA);
    g.addColorStop(1, pal.grassB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 条纹
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (var i = 0; i < 8; i++) {
      if (i % 2 === 0) continue;
      ctx.fillRect(0, (H / 8) * i, W, H / 8);
    }

    // 边线
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 3;
    ctx.strokeRect(MARGIN, MARGIN, W - MARGIN * 2, H - MARGIN * 2);

    // 中线 + 中圈
    ctx.beginPath();
    ctx.moveTo(MARGIN, H / 2);
    ctx.lineTo(W - MARGIN, H / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 78, 0, Math.PI * 2);
    ctx.stroke();

    // 禁区（围绕球门）
    ctx.strokeRect(goal.x - 70, GOAL_LINE_Y, goal.w + 140, 128);
    ctx.strokeRect(goal.x - 18, GOAL_LINE_Y, goal.w + 36, 58);

    drawGoal();
  }

  function drawGoal() {
    var x = goal.x, w = goal.w, y = GOAL_LINE_Y - GOAL_DEPTH;
    // 网
    ctx.fillStyle = pal.net;
    ctx.fillRect(x, y, w, GOAL_DEPTH);
    ctx.strokeStyle = pal.netLine;
    ctx.lineWidth = 1;
    for (var i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (w / 8) * i, y);
      ctx.lineTo(x + (w / 8) * i, y + GOAL_DEPTH);
      ctx.stroke();
    }
    for (var j = 1; j < 4; j++) {
      ctx.beginPath();
      ctx.moveTo(x, y + (GOAL_DEPTH / 4) * j);
      ctx.lineTo(x + w, y + (GOAL_DEPTH / 4) * j);
      ctx.stroke();
    }
    // 门柱
    ctx.fillStyle = pal.post;
    ctx.fillRect(x - 5, y, 5, GOAL_DEPTH);
    ctx.fillRect(x + w, y, 5, GOAL_DEPTH);
    ctx.fillRect(x - 5, y, w + 10, 4);
    ctx.strokeStyle = pal.postEdge;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 5, y, w + 10, GOAL_DEPTH + 4);
  }

  function drawBall() {
    ctx.save();
    // 影子
    ctx.fillStyle = pal.shadow;
    ctx.beginPath();
    ctx.ellipse(ball.x + 3, ball.y + 5, BALL_R * 1.05, BALL_R * 0.8, 0, 0, Math.PI * 2);
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

    // 简单缝线
    ctx.strokeStyle = pal.seam;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawAim() {
    if (state !== 'aim') return;
    var d = dragPower();
    if (!dragging || d.dist < 8) {
      // 待机提示：轻闪瞄准光圈
      if (!GamePlatform.ui.shouldReduceMotion()) {
        ctx.strokeStyle = pal.aimSoft;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_R + 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    var len = d.dist || 1;
    var nx = d.dx / len, ny = d.dy / len;
    var power = d.power;

    // 虚线弹道
    ctx.save();
    ctx.strokeStyle = pal.aim;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.globalAlpha = 0.45 + 0.45 * power;
    ctx.beginPath();
    ctx.moveTo(ball.x + nx * (BALL_R + 6), ball.y + ny * (BALL_R + 6));
    ctx.lineTo(ball.x + nx * (BALL_R + 6 + 260 * power + 90), ball.y + ny * (BALL_R + 6 + 260 * power + 90));
    ctx.stroke();
    ctx.restore();

    // 箭头
    var tipX = ball.x + nx * (BALL_R + 26 + 90 * power);
    var tipY = ball.y + ny * (BALL_R + 26 + 90 * power);
    ctx.strokeStyle = pal.aim;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ball.x + nx * (BALL_R + 4), ball.y + ny * (BALL_R + 4));
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    var ang = Math.atan2(ny, nx);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - 14 * Math.cos(ang - 0.45), tipY - 14 * Math.sin(ang - 0.45));
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - 14 * Math.cos(ang + 0.45), tipY - 14 * Math.sin(ang + 0.45));
    ctx.stroke();

    // 力量条
    var bw = 120, bh = 10;
    var bx = ball.x - bw / 2, by = ball.y + BALL_R + 26;
    ctx.fillStyle = pal.powerBg;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = pal.powerFg;
    ctx.fillRect(bx, by, bw * power, bh);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
  }

  function drawBanner() {
    if (bannerT <= 0 || !banner) return;
    var alpha = Math.min(1, bannerT * 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 46px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pal.banner;
    ctx.fillText(banner, W / 2, H / 2 - 60);
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
        { label: { zh: '球门位置', en: 'Goal at' }, get: function () {
          return Math.round(goal.x) + ' +' + Math.round(goal.w);
        } },
        { label: { zh: '状态', en: 'State' }, get: function () {
          return { menu: 'menu', aim: 'aim', flying: 'flying', result: 'result', paused: 'paused', over: 'over' }[state] || state;
        } }
      ],
      params: [
        { key: 'power', label: { zh: '力量倍率', en: 'Power ×' }, min: 0.2, max: 3, step: 0.1,
          get: function () { return cheatPower; },
          set: function (v) { cheatPower = Math.max(0.2, Math.min(3, v)); } },
        { key: 'goalw', label: { zh: '球门宽度(0=随机)', en: 'Goal width (0=auto)' }, min: 0, max: 280, step: 10,
          get: function () { return cheatGoalW; },
          set: function (v) {
            cheatGoalW = Math.max(0, Math.min(280, Math.round(v)));
            if (state === 'aim') randomGoal();
          } }
      ],
      toggles: [
        { label: { zh: '必进球', en: 'Auto goal' },
          on: { zh: '必进球：开', en: 'Auto goal: ON' },
          off: { zh: '必进球：关', en: 'Auto goal: OFF' },
          get: function () { return cheatGoal; },
          set: function (v) { cheatGoal = !!v; } },
        { label: { zh: '无摩擦', en: 'No friction' },
          on: { zh: '无摩擦：开', en: 'No friction: ON' },
          off: { zh: '无摩擦：关', en: 'No friction: OFF' },
          get: function () { return cheatNoFriction; },
          set: function (v) { cheatNoFriction = !!v; } }
      ],
      actions: [
        { label: { zh: '直接判进球 +1', en: 'Force goal +1' }, tone: 'danger', run: function () {
          if (state === 'flying' || state === 'result') return;
          if (state !== 'aim') return;
          shotsUsed++;
          state = 'flying';        // 让 resolveShot 通过状态守卫
          resolveShot(true);
        }, toast: { zh: '已判进球', en: 'Goal awarded' } },
        { label: { zh: '换一个球门', en: 'Move goal' }, run: function () { randomGoal(); },
          toast: { zh: '球门已换位置', en: 'Goal moved' } },
        { label: { zh: '下一球（不计射门）', en: 'Reset ball' }, run: function () {
          if (state === 'aim') resetBall();
          else { state = 'aim'; banner = ''; bannerT = 0; resetBall(); }
        } },
        { label: { zh: '重开本局', en: 'Restart round' }, run: function () {
          hideOverlays();
          newGame();
        } }
      ]
    });
  }
})();
