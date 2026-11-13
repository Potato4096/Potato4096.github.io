/* penalty-shootout - core game: states, aim/charge, keeper, rendering */
(function () {
  'use strict';

  var PS = window.PS = window.PS || {};

  // ---------- constants ----------
  var W = 640, H = 480;
  var GOAL_L = 132, GOAL_R = 508, GOAL_T = 96, GOAL_B = 292;
  var AIM_L = GOAL_L + 12, AIM_R = GOAL_R - 12, AIM_T = GOAL_T + 12, AIM_B = GOAL_B - 16;
  var SPOT_X = 320, SPOT_Y = 424;
  var BALL_R = 11;
  var POWER_RATE = 82;          // 蓄力速度（单位/秒）
  var FLIGHT_BASE = 0.55;       // 基础飞行时间（秒）
  var RESULT_TIME = 1.5;        // 结果展示时间（秒）
  var SAVE_HALF = 76;           // 守门员扑救半径（水平）
  var SAVE_HALF_TOP = 52;       // 球门上角扑救半径
  var KEEPER_HOME = 320;
  var ROUNDS = 5;
  var PARTICLES_MAX = 90;

  // ---------- i18n ----------
  var STR = {
    title: { zh: '足球射门', en: 'Penalty Shootout' },
    tagline: {
      zh: '五轮点球大战：移动准星瞄准球门，按住蓄力、松开射门，骗过守门员！',
      en: 'Five rounds of penalties: move the crosshair, hold to charge, release to shoot and fool the keeper!'
    },
    round: { zh: '轮次', en: 'Round' },
    goals: { zh: '进球', en: 'Goals' },
    oppScore: { zh: '对手分', en: 'Rival' },
    accuracy: { zh: '命中率', en: 'Accuracy' },
    bestGoals: { zh: '最高进球', en: 'Best Goals' },
    bestTotal: { zh: '最高总比分', en: 'Best Total' },
    start: { zh: '开始游戏', en: 'Start' },
    clearRecords: { zh: '清除记录', en: 'Clear Records' },
    cleared: { zh: '记录已清除', en: 'Records cleared' },
    paused: { zh: '已暂停', en: 'Paused' },
    resume: { zh: '继续游戏', en: 'Resume' },
    restart: { zh: '重新开始', en: 'Restart' },
    home: { zh: '返回主页', en: 'Home' },
    gameOver: { zh: '比赛结束', en: 'Match Over' },
    win: { zh: '胜利！', en: 'You Win!' },
    lose: { zh: '失败', en: 'You Lose' },
    again: { zh: '再玩一次', en: 'Play Again' },
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    pauseBtn: { zh: '暂停', en: 'Pause' },
    controls: {
      zh: '操作：点击 / 触摸球门区域瞄准，按住蓄力、松开射门（空格同理），←→ / A D 微调准星，Esc / P 暂停。力量过低或过高都会打偏，瞄太靠边容易被扑或中柱！',
      en: 'Controls: click / touch inside the goal to aim, hold to charge and release to shoot (Space works too), ←→ / A-D fine-tune, Esc / P to pause. Too little or too much power misses; tight angles get saved or hit the post!'
    },
    newRecord: { zh: '新纪录！', en: 'New record!' },
    aimHint: { zh: '移动准星瞄准球门，按住蓄力', en: 'Aim inside the goal, hold to charge' },
    chargeHint: { zh: '松开射门！', en: 'Release to shoot!' },
    resultGoal: { zh: '进球！', en: 'GOAL!' },
    resultSave: { zh: '被扑出！', en: 'SAVED!' },
    resultMiss: { zh: '射偏了！', en: 'MISSED!' },
    resultPost: { zh: '中柱！', en: 'OFF THE POST!' },
    oppScored: { zh: '对手得分 +1', en: 'Rival scores +1' },
    oppMissed: { zh: '对手未进', en: 'Rival misses' },
    suddenDeath: { zh: '突然死亡', en: 'Sudden Death' },
    sdShort: { zh: '突然死亡轮', en: 'SD' },
    'st-menu': { zh: '菜单', en: 'Menu' },
    'st-aim': { zh: '瞄准', en: 'Aiming' },
    'st-charge': { zh: '蓄力', en: 'Charging' },
    'st-flight': { zh: '飞行', en: 'In flight' },
    'st-result': { zh: '结算', en: 'Result' },
    'st-paused': { zh: '已暂停', en: 'Paused' },
    'st-gameover': { zh: '已结束', en: 'Game over' }
  };
  function t(k) { return GamePlatform.i18n.t(STR[k] || { zh: k, en: k }); }

  // ---------- canvas ----------
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  // 防模糊：缓冲区按显示宽度 × devicePixelRatio 分配（参考 board-games js/core/canvas.js）
  var fitCache = null;
  function fit(c, cx, w, h) {
    if (!c || !cx || !w || !h) return cx;
    var dpr = window.devicePixelRatio || 1;
    var prev = fitCache;
    if (!prev || prev.w !== w || prev.h !== h) {
      c.width = w;
      c.height = h;
    }
    var rect = c.getBoundingClientRect();
    var cssW = rect.width || w;
    var bw = Math.max(1, Math.round(cssW * dpr));
    var bh = Math.max(1, Math.round((h * bw) / w));
    if (!prev || prev.bw !== bw || prev.bh !== bh || prev.dpr !== dpr ||
        prev.w !== w || prev.h !== h || c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
      fitCache = { bw: bw, bh: bh, dpr: dpr, w: w, h: h };
    }
    cx.setTransform(bw / w, 0, 0, bh / h, 0, 0);
    return cx;
  }

  // ---------- world palettes ----------
  var WORLD = {
    light: {
      grassTop: '#4caf50', grassBottom: '#2e7d32', stripe: 'rgba(255,255,255,0.07)',
      line: 'rgba(255,255,255,0.75)',
      net: 'rgba(255,255,255,0.28)', netBack: '#3f6e46',
      goalFrame: '#f5f7fa', goalEdge: '#c3ccd8',
      keeperShirt: '#e53935', keeperShort: '#1a237e', keeperSkin: '#ffcc80', keeperEdge: '#b71c1c',
      ball: '#ffffff', ballEdge: '#455a64', ballSpot: '#263238',
      cross: '#ff1744', crossSoft: 'rgba(255,23,68,0.35)',
      powerBg: 'rgba(0,0,0,0.32)', powerFill: '#76ff03', powerHot: '#ff5252',
      shadow: 'rgba(0,0,0,0.22)', text: '#ffffff', textShadow: 'rgba(0,0,0,0.55)'
    },
    dark: {
      grassTop: '#2e6b33', grassBottom: '#1c4520', stripe: 'rgba(255,255,255,0.05)',
      line: 'rgba(255,255,255,0.55)',
      net: 'rgba(255,255,255,0.18)', netBack: '#24452a',
      goalFrame: '#c9d2dc', goalEdge: '#8b98a8',
      keeperShirt: '#c62828', keeperShort: '#283593', keeperSkin: '#e6a95f', keeperEdge: '#8e1c1c',
      ball: '#e8edf3', ballEdge: '#90a4ae', ballSpot: '#263238',
      cross: '#ff5277', crossSoft: 'rgba(255,82,119,0.35)',
      powerBg: 'rgba(0,0,0,0.45)', powerFill: '#b2ff59', powerHot: '#ff7043',
      shadow: 'rgba(0,0,0,0.35)', text: '#f2f5f9', textShadow: 'rgba(0,0,0,0.7)'
    }
  };
  var pal = WORLD.light;
  var bgGrad = null;

  function rebuildPal() {
    var mode = GamePlatform.theme.get();
    pal = WORLD[mode] || WORLD.light;
    bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, pal.grassTop);
    bgGrad.addColorStop(1, pal.grassBottom);
  }

  // ---------- game state ----------
  var state = 'menu'; // menu | aim | charge | flight | result | paused | gameover
  var pausedFrom = 'aim';
  var round = 1, goals = 0, oppScore = 0, shots = 0;
  var bestGoals = 0, bestTotal = 0;
  var lastResult = null; // 'win' | 'lose'
  var power = 0;
  var aimX = SPOT_X, aimY = (GOAL_T + GOAL_B) / 2;
  var flightT = 0, flightDur = 0.7;
  var shotTarget = { x: SPOT_X, y: GOAL_T + 60 };
  var outcome = null;  // goal | save | miss | post
  var resultTimer = 0;
  var oppJustScored = false;
  var keeper = { x: KEEPER_HOME, diveTo: KEEPER_HOME, tilt: 0 };
  var particles = [];
  var shakeT = 0;
  var keys = {};
  var idleT = 0;

  /* 修改器状态（见文件末尾 CheatKit.init） */
  var cheatPower = 0;        // 0=正常蓄力；>0 锁定力量
  var cheatPrecision = 70;   // 1-100，越高散布越小
  var cheatMustGoal = false;
  var cheatKeeperFrozen = false;

  function isSuddenDeath() { return round > ROUNDS; }

  function accuracyPct() {
    return shots > 0 ? Math.round(goals / shots * 100) : 0;
  }

  // ---------- particles ----------
  function spawnParticles(x, y, color, count) {
    if (GamePlatform.ui.shouldReduceMotion()) return;
    for (var i = 0; i < count; i++) {
      if (particles.length >= PARTICLES_MAX) particles.shift();
      var ang = Math.random() * Math.PI * 2;
      var sp = 60 + Math.random() * 180;
      particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        size: 2 + Math.random() * 3,
        color: color
      });
    }
  }

  function toast(key) {
    try { GamePlatform.ui.toast(t(key)); } catch (e) { /* ignore */ }
  }

  // ---------- round flow ----------
  function startRound() {
    power = 0;
    aimX = SPOT_X;
    aimY = (GOAL_T + GOAL_B) / 2;
    flightT = 0;
    outcome = null;
    resultTimer = 0;
    keeper.x = KEEPER_HOME;
    keeper.diveTo = KEEPER_HOME;
    keeper.tilt = 0;
    state = 'aim';
    PS.audio.play('whistle');
    updateHUD();
  }

  function startGame() {
    round = 1;
    goals = 0;
    oppScore = 0;
    shots = 0;
    lastResult = null;
    particles = [];
    shakeT = 0;
    hideOverlays();
    PS.audio.play('start');
    startRound();
  }

  function endGame() {
    state = 'gameover';
    lastResult = goals > oppScore ? 'win' : 'lose';
    var total = goals + oppScore;
    if (goals > bestGoals) {
      bestGoals = goals;
      GamePlatform.storage.set('best:penalty-shootout:goals', bestGoals);
      toast('newRecord');
    }
    if (total > bestTotal) {
      bestTotal = total;
      GamePlatform.storage.set('best:penalty-shootout:total', bestTotal);
      toast('newRecord');
    }
    document.getElementById('go-title').textContent = t(lastResult);
    document.getElementById('go-goals').textContent = String(goals);
    document.getElementById('go-opp').textContent = String(oppScore);
    document.getElementById('go-acc').textContent = accuracyPct() + '%';
    document.getElementById('go-best-goals').textContent = String(bestGoals);
    document.getElementById('go-best-total').textContent = String(bestTotal);
    showOverlay('ov-gameover');
    if (lastResult === 'win') PS.audio.play('win');
    else PS.audio.play('lose');
    updateHUD();
  }

  function advanceRound() {
    if (round >= ROUNDS && goals !== oppScore) {
      endGame();
      return;
    }
    round++;
    startRound();
  }

  // ---------- shooting ----------
  function shoot() {
    if (state !== 'charge') return;
    shots++;
    var p = cheatPower > 0 ? cheatPower : power;
    flightDur = FLIGHT_BASE + (1 - p / 100) * 0.28;

    // 散布：精度修正 + 力量偏差 + 瞄边惩罚
    var spread = 14 + (100 - cheatPrecision) * 0.22;
    if (p < 35) spread += (35 - p) * 0.8;
    if (p > 88) spread += (p - 88) * 0.8;
    var edgeDist = Math.min(aimX - AIM_L, AIM_R - aimX, aimY - AIM_T, AIM_B - aimY);
    if (edgeDist < 30) spread += (30 - edgeDist) * 0.7;

    var fx = aimX + (Math.random() + Math.random() - 1) * spread;
    var fy = aimY + (Math.random() + Math.random() - 1) * spread * 0.8;

    // 力量过低 / 过高直接偏出
    if (!cheatMustGoal && (p < 18 || p > 97)) {
      outcome = 'miss';
      fy = p < 18 ? GOAL_B + 40 : GOAL_T - 40;
      fx = aimX + (Math.random() - 0.5) * 60;
    } else if (cheatMustGoal) {
      outcome = 'goal';
      fx = GamePlatform.util.clamp(fx, AIM_L, AIM_R);
      fy = GamePlatform.util.clamp(fy, AIM_T, AIM_B);
    } else if (fx < GOAL_L - 4 || fx > GOAL_R + 4 || fy < GOAL_T - 4 || fy > GOAL_B) {
      // 中柱判定：贴近门框 10px 内
      var nearPost = Math.abs(fx - GOAL_L) < 12 || Math.abs(fx - GOAL_R) < 12 ||
                     (Math.abs(fy - GOAL_T) < 12 && fx > GOAL_L && fx < GOAL_R);
      outcome = nearPost ? 'post' : 'miss';
    } else if (cheatKeeperFrozen) {
      outcome = 'goal';
    } else {
      var reach = fy < GOAL_T + 70 ? SAVE_HALF_TOP : SAVE_HALF;
      outcome = Math.abs(fx - keeper.diveTo) <= reach ? 'save' : 'goal';
    }

    shotTarget.x = fx;
    shotTarget.y = fy;
    flightT = 0;

    // 守门员扑救方向（冻结时不动）
    if (cheatKeeperFrozen) {
      keeper.diveTo = KEEPER_HOME;
    } else {
      var pick = Math.random();
      keeper.diveTo = pick < 0.36 ? 185 : (pick < 0.68 ? 455 : KEEPER_HOME);
      keeper.diveTo += (Math.random() - 0.5) * 36;
    }

    state = 'flight';
    PS.audio.play('kick');
    updateHUD();
  }

  function resolveShot() {
    resultTimer = RESULT_TIME;
    if (outcome === 'goal') {
      goals++;
      PS.audio.play('goal');
      spawnParticles(shotTarget.x, shotTarget.y, pal.powerFill, 16);
      if (!GamePlatform.ui.shouldReduceMotion()) shakeT = 0.22;
    } else if (outcome === 'save') {
      PS.audio.play('save');
      spawnParticles(shotTarget.x, shotTarget.y, pal.keeperShirt, 8);
    } else if (outcome === 'post') {
      PS.audio.play('post');
      spawnParticles(shotTarget.x, shotTarget.y, pal.goalFrame, 10);
      if (!GamePlatform.ui.shouldReduceMotion()) shakeT = 0.16;
    } else {
      PS.audio.play('post');
    }

    // 对手本轮随机射门（简化）
    oppJustScored = Math.random() < 0.42;
    if (oppJustScored) oppScore++;

    state = 'result';
    updateHUD();
  }

  // ---------- update ----------
  function update(dt) {
    if (state === 'aim') {
      idleT += dt;
    } else if (state === 'charge') {
      if (cheatPower > 0) {
        power = cheatPower;
      } else {
        power = Math.min(100, power + POWER_RATE * dt);
      }
    } else if (state === 'flight') {
      flightT += dt / flightDur;
      // 守门员扑救位移动画
      var k = Math.min(flightT / 0.62, 1);
      var ease = 1 - (1 - k) * (1 - k);
      keeper.x = KEEPER_HOME + (keeper.diveTo - KEEPER_HOME) * ease;
      keeper.tilt = (keeper.diveTo - KEEPER_HOME) / 380 * ease;
      if (flightT >= 1) {
        flightT = 1;
        resolveShot();
      }
    } else if (state === 'result') {
      resultTimer -= dt;
      if (resultTimer <= 0) {
        advanceRound();
      }
    }

    // particles
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 320 * dt;
    }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
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

  function drawGrass() {
    ctx.fillStyle = bgGrad || pal.grassTop;
    ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < 8; i++) {
      if (i % 2 === 0) continue;
      ctx.fillStyle = pal.stripe;
      ctx.fillRect(0, i * (H / 8), W, H / 8);
    }
    // 禁区线
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 3;
    ctx.strokeRect(118, GOAL_B, 404, 150);
    ctx.beginPath();
    ctx.arc(SPOT_X, SPOT_Y, 72, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(SPOT_X, SPOT_Y, 5, 0, Math.PI * 2);
    ctx.fillStyle = pal.line;
    ctx.fill();
  }

  function drawGoal() {
    var gw = GOAL_R - GOAL_L, gh = GOAL_B - GOAL_T;
    // 球网底色
    ctx.fillStyle = pal.netBack;
    ctx.fillRect(GOAL_L, GOAL_T, gw, gh);
    // 网格
    ctx.strokeStyle = pal.net;
    ctx.lineWidth = 1;
    var i;
    for (i = 0; i <= 14; i++) {
      var nx = GOAL_L + (gw / 14) * i;
      ctx.beginPath();
      ctx.moveTo(nx, GOAL_T);
      ctx.lineTo(nx, GOAL_B);
      ctx.stroke();
    }
    for (i = 0; i <= 8; i++) {
      var ny = GOAL_T + (gh / 8) * i;
      ctx.beginPath();
      ctx.moveTo(GOAL_L, ny);
      ctx.lineTo(GOAL_R, ny);
      ctx.stroke();
    }
    // 门框：立柱 + 横梁
    ctx.strokeStyle = pal.goalEdge;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(GOAL_L, GOAL_B);
    ctx.lineTo(GOAL_L, GOAL_T);
    ctx.lineTo(GOAL_R, GOAL_T);
    ctx.lineTo(GOAL_R, GOAL_B);
    ctx.stroke();
    ctx.strokeStyle = pal.goalFrame;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(GOAL_L, GOAL_B);
    ctx.lineTo(GOAL_L, GOAL_T);
    ctx.lineTo(GOAL_R, GOAL_T);
    ctx.lineTo(GOAL_R, GOAL_B);
    ctx.stroke();
  }

  function drawKeeper() {
    var kx = keeper.x;
    var ky = GOAL_B - 6;
    // 阴影
    ctx.fillStyle = pal.shadow;
    ctx.beginPath();
    ctx.ellipse(kx, GOAL_B - 2, 30, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(kx, ky);
    ctx.rotate(keeper.tilt);
    // 短裤
    ctx.fillStyle = pal.keeperShort;
    ctx.fillRect(-19, -46, 38, 30);
    // 球衣（矩形）
    ctx.fillStyle = pal.keeperShirt;
    roundRect(-22, -88, 44, 48, 7);
    ctx.fill();
    // 手臂
    ctx.strokeStyle = pal.keeperSkin;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, -80);
    ctx.lineTo(-44, -58);
    ctx.moveTo(20, -80);
    ctx.lineTo(44, -58);
    ctx.stroke();
    // 头（圆）
    ctx.fillStyle = pal.keeperSkin;
    ctx.beginPath();
    ctx.arc(0, -103, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.keeperEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -103, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.lineCap = 'butt';
  }

  function ballPos() {
    if (state === 'flight') {
      var tt = flightT;
      var ctrlX = (SPOT_X + shotTarget.x) / 2;
      var ctrlY = (SPOT_Y + shotTarget.y) / 2 - 70;
      var x = (1 - tt) * (1 - tt) * SPOT_X + 2 * (1 - tt) * tt * ctrlX + tt * tt * shotTarget.x;
      var y = (1 - tt) * (1 - tt) * SPOT_Y + 2 * (1 - tt) * tt * ctrlY + tt * tt * shotTarget.y;
      return { x: x, y: y, r: BALL_R * (1 - 0.3 * tt) };
    }
    if (state === 'result' && outcome) {
      return { x: shotTarget.x, y: shotTarget.y, r: BALL_R * 0.72 };
    }
    return { x: SPOT_X, y: SPOT_Y, r: BALL_R };
  }

  function drawBall() {
    var b = ballPos();
    // 阴影
    ctx.fillStyle = pal.shadow;
    ctx.beginPath();
    ctx.ellipse(b.x, SPOT_Y + 12, b.r * 1.05, b.r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    var g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.2, b.x, b.y, b.r);
    g.addColorStop(0, pal.ball);
    g.addColorStop(1, pal.ballEdge);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.ballSpot;
    ctx.beginPath();
    ctx.arc(b.x, b.y - b.r * 0.1, b.r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCrosshair() {
    if (state !== 'aim' && state !== 'charge') return;
    ctx.strokeStyle = pal.crossSoft;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(aimX, aimY, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = pal.cross;
    ctx.beginPath();
    ctx.arc(aimX, aimY, 10, 0, Math.PI * 2);
    ctx.moveTo(aimX - 16, aimY);
    ctx.lineTo(aimX - 5, aimY);
    ctx.moveTo(aimX + 5, aimY);
    ctx.lineTo(aimX + 16, aimY);
    ctx.moveTo(aimX, aimY - 16);
    ctx.lineTo(aimX, aimY - 5);
    ctx.moveTo(aimX, aimY + 5);
    ctx.lineTo(aimX, aimY + 16);
    ctx.stroke();
  }

  function drawPowerBar() {
    if (state !== 'aim' && state !== 'charge' && state !== 'flight') return;
    var pbW = 210, pbH = 16, pbX = (W - pbW) / 2, pbY = H - 34;
    ctx.fillStyle = pal.powerBg;
    roundRect(pbX, pbY, pbW, pbH, 8);
    ctx.fill();
    // 理想区（35-88）
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    roundRect(pbX + pbW * 0.35, pbY, pbW * 0.53, pbH, 4);
    ctx.fill();
    var frac = GamePlatform.util.clamp(power / 100, 0, 1);
    if (frac > 0) {
      ctx.fillStyle = power > 88 ? pal.powerHot : pal.powerFill;
      roundRect(pbX + 2, pbY + 2, (pbW - 4) * frac, pbH - 4, 6);
      ctx.fill();
    }
    ctx.strokeStyle = pal.textShadow;
    ctx.lineWidth = 1;
    roundRect(pbX, pbY, pbW, pbH, 8);
    ctx.stroke();
  }

  function drawResultText() {
    if (state !== 'result' || !outcome) return;
    var key = outcome === 'goal' ? 'resultGoal' :
              outcome === 'save' ? 'resultSave' :
              outcome === 'post' ? 'resultPost' : 'resultMiss';
    ctx.font = 'bold 42px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = pal.textShadow;
    ctx.strokeText(t(key), W / 2, 176);
    ctx.fillStyle = outcome === 'goal' ? pal.powerFill : pal.text;
    ctx.fillText(t(key), W / 2, 176);
    ctx.font = '600 18px "Segoe UI", sans-serif';
    ctx.fillStyle = pal.text;
    ctx.strokeText(t(oppJustScored ? 'oppScored' : 'oppMissed'), W / 2, 214);
    ctx.fillText(t(oppJustScored ? 'oppScored' : 'oppMissed'), W / 2, 214);
    if (isSuddenDeath()) {
      ctx.font = '600 15px "Segoe UI", sans-serif';
      ctx.strokeText(t('suddenDeath'), W / 2, 244);
      ctx.fillText(t('suddenDeath'), W / 2, 244);
    }
  }

  function drawHint() {
    if (state !== 'aim' && state !== 'charge') return;
    ctx.font = '600 15px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = pal.textShadow;
    var msg = state === 'charge' ? t('chargeHint') : t('aimHint');
    ctx.strokeText(msg, W / 2, H - 58);
    ctx.fillStyle = pal.text;
    ctx.fillText(msg, W / 2, H - 58);
  }

  function render() {
    fit(canvas, ctx, W, H);
    var ox = 0, oy = 0;
    if (shakeT > 0 && !GamePlatform.ui.shouldReduceMotion()) {
      ox = (Math.random() - 0.5) * 8 * (shakeT / 0.22);
      oy = (Math.random() - 0.5) * 8 * (shakeT / 0.22);
    }
    ctx.save();
    ctx.translate(ox, oy);

    drawGrass();
    drawGoal();
    drawKeeper();
    drawBall();
    drawCrosshair();

    // particles
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(p.life / p.maxLife, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    drawPowerBar();
    drawHint();
    drawResultText();
    ctx.restore();
  }

  // ---------- HUD / overlays / i18n ----------
  function updateHUD() {
    var roundTxt = isSuddenDeath()
      ? t('sdShort') + ' ' + (round - ROUNDS)
      : round + ' / ' + ROUNDS;
    document.getElementById('hud-round').textContent = roundTxt;
    document.getElementById('hud-goals').textContent = String(goals);
    document.getElementById('hud-opp').textContent = String(oppScore);
    document.getElementById('hud-acc').textContent = accuracyPct() + '%';
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
    document.getElementById('go-title').textContent = lastResult ? t(lastResult) : t('gameOver');
    document.getElementById('menu-best-goals').textContent = String(bestGoals);
    document.getElementById('menu-best-total').textContent = String(bestTotal);
    updateHUD();
  }

  // ---------- input ----------
  function canvasPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height)
    };
  }

  function setAim(x, y) {
    aimX = GamePlatform.util.clamp(x, AIM_L, AIM_R);
    aimY = GamePlatform.util.clamp(y, AIM_T, AIM_B);
  }

  function startCharge() {
    if (state !== 'aim') return;
    if (cheatPower <= 0) power = 0;
    state = 'charge';
    updateHUD();
  }

  function togglePause() {
    if (state === 'aim' || state === 'charge' || state === 'flight' || state === 'result') {
      pausedFrom = state;
      state = 'paused';
      showOverlay('ov-pause');
    } else if (state === 'paused') {
      hideOverlays();
      // 蓄力中断后回到瞄准，避免误触射门
      state = pausedFrom === 'charge' ? 'aim' : pausedFrom;
      if (state === 'aim') power = 0;
    }
  }

  function bindInput() {
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      PS.audio.unlock();
      if (state === 'menu') return;
      if (state !== 'aim' && state !== 'charge') return;
      var pos = canvasPos(e);
      setAim(pos.x, pos.y);
      startCharge();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (state !== 'aim' && state !== 'charge') return;
      var pos = canvasPos(e);
      setAim(pos.x, pos.y);
    });
    window.addEventListener('pointerup', function () {
      if (state === 'charge') shoot();
    });

    document.addEventListener('keydown', function (e) {
      PS.audio.unlock();
      keys[e.key] = true;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (state === 'menu') startGame();
        else startCharge();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        if (state === 'aim' || state === 'charge') setAim(aimX - 10, aimY);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        if (state === 'aim' || state === 'charge') setAim(aimX + 10, aimY);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        if (state === 'aim' || state === 'charge') setAim(aimX, aimY - 8);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        if (state === 'aim' || state === 'charge') setAim(aimX, aimY + 8);
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
      }
    });
    document.addEventListener('keyup', function (e) {
      keys[e.key] = false;
      if ((e.key === ' ' || e.key === 'Spacebar') && state === 'charge') shoot();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden &&
          (state === 'aim' || state === 'charge' || state === 'flight' || state === 'result')) {
        togglePause();
      }
    });

    document.addEventListener('pointerdown', function () { PS.audio.unlock(); }, { once: true });

    document.getElementById('btn-home').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-pause').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-go').onclick = function () { GamePlatform.navigate.goHome(); };

    document.getElementById('btn-start').onclick = function () {
      PS.audio.unlock();
      startGame();
    };
    document.getElementById('btn-clear').onclick = function () {
      GamePlatform.storage.clear();
      bestGoals = 0;
      bestTotal = 0;
      document.getElementById('menu-best-goals').textContent = '0';
      document.getElementById('menu-best-total').textContent = '0';
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
    } else if (state === 'menu' || state === 'gameover') {
      idleT += dt;
    }
    render();
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  function init() {
    rebuildPal();
    bestGoals = GamePlatform.storage.get('best:penalty-shootout:goals', 0) || 0;
    bestTotal = GamePlatform.storage.get('best:penalty-shootout:total', 0) || 0;
    state = 'menu';
    showOverlay('ov-menu');
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

  PS.game = {
    get state() { return state; },
    get goals() { return goals; },
    get oppScore() { return oppScore; }
  };

  /* ------------------------------------------------------------ */
  /* 修改器钩子（暗号 potato4096，见 platform/cheat-kit.js）        */
  /* ------------------------------------------------------------ */

  function cheatGoalPlus() {
    goals++;
    shots++;
    updateHUD();
  }

  function cheatSkipRound() {
    if (state === 'menu' || state === 'gameover') startGame();
    if (state === 'flight' || state === 'result') {
      // 直接跳过当前结算
      resultTimer = 0;
      advanceRound();
      return;
    }
    // 未射门直接结束本轮：对手照常随机得分
    oppJustScored = Math.random() < 0.42;
    if (oppJustScored) oppScore++;
    advanceRound();
  }

  function cheatResetScore() {
    goals = 0;
    oppScore = 0;
    updateHUD();
  }

  if (window.CheatKit) {
    CheatKit.init({
      id: 'penalty-shootout',
      title: { zh: '🔧 修改器', en: '🔧 Modifier' },
      hint: { zh: '彩蛋面板 · 参数即时生效', en: 'Easter egg · changes apply instantly' },
      stats: [
        { label: { zh: '轮次', en: 'Round' }, get: function () { return round; } },
        { label: { zh: '进球', en: 'Goals' }, get: function () { return goals; }, tone: 'success' },
        { label: { zh: '射门数', en: 'Shots' }, get: function () { return shots; } },
        { label: { zh: '命中率%', en: 'Accuracy %' }, get: accuracyPct, tone: 'warning' },
        { label: { zh: '对手分', en: 'Rival' }, get: function () { return oppScore; }, tone: 'danger' },
        { label: { zh: '状态', en: 'State' }, get: function () { return t('st-' + state); } }
      ],
      params: [
        { key: 'power', label: { zh: '力量(0=自动)', en: 'Power (0=auto)' }, min: 1, max: 100, step: 1,
          get: function () { return cheatPower; },
          set: function (v) {
            cheatPower = Math.round(GamePlatform.util.clamp(v, 1, 100));
            power = cheatPower;
          } },
        { key: 'precision', label: { zh: '精度修正', en: 'Precision' }, min: 1, max: 100, step: 1,
          get: function () { return cheatPrecision; },
          set: function (v) { cheatPrecision = Math.round(GamePlatform.util.clamp(v, 1, 100)); } }
      ],
      toggles: [
        { label: { zh: '必进球（瞄准必中）', en: 'Always goal' },
          on: { zh: '必进球：开', en: 'Always goal: ON' },
          off: { zh: '必进球：关', en: 'Always goal: OFF' },
          get: function () { return cheatMustGoal; },
          set: function (v) { cheatMustGoal = !!v; } },
        { label: { zh: '守门员冻结（永不扑救）', en: 'Keeper frozen' },
          on: { zh: '守门员冻结：开', en: 'Keeper frozen: ON' },
          off: { zh: '守门员冻结：关', en: 'Keeper frozen: OFF' },
          get: function () { return cheatKeeperFrozen; },
          set: function (v) { cheatKeeperFrozen = !!v; } }
      ],
      actions: [
        { label: { zh: '直接判进球 +1', en: 'Force goal +1' }, run: cheatGoalPlus,
          toast: { zh: '已判进球 +1', en: 'Goal +1 awarded' } },
        { label: { zh: '跳过本轮', en: 'Skip round' }, run: cheatSkipRound,
          toast: { zh: '已跳过本轮', en: 'Round skipped' } },
        { label: { zh: '比分清零', en: 'Reset scores' }, run: cheatResetScore,
          toast: { zh: '比分已清零', en: 'Scores reset' } },
        { label: { zh: '重开本局', en: 'Restart match' }, run: function () { hideOverlays(); startGame(); },
          toast: { zh: '已重开本局', en: 'Match restarted' }, tone: 'danger' }
      ]
    });
  }
})();
