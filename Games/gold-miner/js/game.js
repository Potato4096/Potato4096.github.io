/**
 * 黄金矿工 gold-miner
 * 矿工的钩爪左右摆动，看准时机出钩抓回地下的金块/钻石/石头。
 * 限时内凑够目标金额过关；金子重拉得慢，钻石轻拉得快。
 */
(function () {
  'use strict';

  var GM = window.GM = window.GM || {};

  // ---------- i18n ----------
  var STR = {
    title: { zh: '黄金矿工', en: 'Gold Miner' },
    tagline: {
      zh: '看准时机出钩，把值钱的都拉上来。',
      en: 'Drop the claw at the right moment and haul up the valuables.'
    },
    start: { zh: '开始游戏', en: 'Start' },
    again: { zh: '再玩一次', en: 'Play again' },
    nextLevel: { zh: '下一关', en: 'Next level' },
    gameOver: { zh: '时间到', en: "Time's up" },
    levelClear: { zh: '过关！', en: 'Level clear!' },
    paused: { zh: '已暂停', en: 'Paused' },
    resume: { zh: '继续', en: 'Resume' },
    restart: { zh: '重新开始', en: 'Restart' },
    home: { zh: '返回主页', en: 'Home' },
    score: { zh: '得分', en: 'Score' },
    best: { zh: '最高分', en: 'Best' },
    level: { zh: '关卡', en: 'Level' },
    time: { zh: '时间', en: 'Time' },
    target: { zh: '目标', en: 'Target' },
    clearRecords: { zh: '清除记录', en: 'Clear records' },
    pauseBtn: { zh: '暂停', en: 'Pause' },
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    controls: {
      zh: '操作：点击 / 触摸 / 空格 / ↓ 出钩，Esc / P 暂停。金块重拉得慢、钻石轻拉得快，限时内凑够目标金额过关。',
      en: 'Controls: click / tap / Space / ↓ drops the claw, Esc / P pauses. Gold is heavy and slow, diamonds are light and fast — reach the target before time runs out.'
    },
    newRecord: { zh: '新纪录！', en: 'New record!' },
    reached: { zh: '已达标，可以继续捞！', en: 'Target reached — keep hauling!' },
    grab: { zh: '抓到了！', en: 'Grabbed!' },
    toLose: { zh: '还差 ¥', en: 'Short by ¥' },
    'item-goldB': { zh: '大金块', en: 'Big gold' },
    'item-goldS': { zh: '小金块', en: 'Small gold' },
    'item-diamond': { zh: '钻石', en: 'Diamond' },
    'item-stoneB': { zh: '大石头', en: 'Big stone' },
    'item-stoneS': { zh: '小石头', en: 'Small stone' },
    'item-bone': { zh: '骨头', en: 'Bone' },
    'item-bag': { zh: '钱袋', en: 'Money bag' }
  };
  function t(k) { return GamePlatform.i18n.t(STR[k] || { zh: k, en: k }); }

  // ---------- canvas ----------
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;

  var GROUND_Y = 112;          // 地表线
  var PIVOT = { x: W / 2, y: 92 };   // 钩爪挂点（矿工手边）
  var MAX_LEN = 660;
  var SHOOT_SPEED = 640;       // 出钩速度 px/s
  var RETRACT_BASE = 430;      // 收钩基数（除以重量）
  var SWING_AMP = 1.32;        // 摆动幅度（弧度，±75°左右）
  var SWING_SPEED = 1.15;      // 摆动角速度
  var LEVEL_TIME = 62;         // 每关限时（秒）

  // ---------- 道具定义 ----------
  var ITEM_TYPES = {
    goldB:   { r: 26, value: 500, weight: 3.2, color: '#f2b632', edge: '#b8862a', label: 'goldB' },
    goldS:   { r: 15, value: 200, weight: 1.9, color: '#f6c95a', edge: '#c49a34', label: 'goldS' },
    diamond: { r: 13, value: 800, weight: 1.0, color: '#7fe3ff', edge: '#3aa6c9', label: 'diamond' },
    stoneB:  { r: 30, value: 20,  weight: 5.6, color: '#9aa3ad', edge: '#6c757e', label: 'stoneB' },
    stoneS:  { r: 18, value: 10,  weight: 3.4, color: '#aeb6bf', edge: '#7d858e', label: 'stoneS' },
    bone:    { r: 16, value: 5,   weight: 1.5, color: '#e8e2d4', edge: '#b3aa96', label: 'bone' },
    bag:     { r: 18, value: 0,   weight: 2.2, color: '#b0724a', edge: '#7c4c2e', label: 'bag' } // 价值随机
  };

  // ---------- 世界配色（深浅主题） ----------
  var WORLD = {
    light: {
      skyTop: '#cfe6f7', skyBottom: '#e8f2fb',
      ground: '#7a5230', groundDark: '#5c3c22', groundLine: '#4a3018',
      pebble: 'rgba(255,255,255,0.10)', pebble2: 'rgba(0,0,0,0.12)',
      rope: '#2c2c2c', claw: '#3a3f46', clawEdge: '#22262b',
      minerBody: '#3f6fb5', minerSkin: '#e8b48a', minerHat: '#d9a441',
      text: '#243044', floatGood: '#1f7a3f', floatBad: '#b3402a',
      vignette: 'rgba(0,0,0,0.14)'
    },
    dark: {
      skyTop: '#141c2a', skyBottom: '#1d2838',
      ground: '#3d2c1c', groundDark: '#2a1d12', groundLine: '#1a120a',
      pebble: 'rgba(255,255,255,0.06)', pebble2: 'rgba(0,0,0,0.22)',
      rope: '#c9d2e0', claw: '#c2cad6', clawEdge: '#8b95a3',
      minerBody: '#5b86d1', minerSkin: '#d9a37c', minerHat: '#e0b054',
      text: '#dfe6f2', floatGood: '#6fdd97', floatBad: '#ff8f6b',
      vignette: 'rgba(0,0,0,0.32)'
    }
  };
  var pal = WORLD.light;
  var pebbles = [];

  function rebuildPal() {
    var mode = 'light';
    try { mode = GamePlatform.theme.get(); } catch (e) { /* fallback */ }
    pal = WORLD[mode] || WORLD.light;
    if (!pebbles.length) {
      for (var i = 0; i < 90; i++) {
        pebbles.push({
          x: Math.random() * W,
          y: GROUND_Y + Math.random() * (H - GROUND_Y),
          r: 1 + Math.random() * 3.2,
          dark: Math.random() > 0.5
        });
      }
    }
  }

  // ---------- 游戏状态 ----------
  var state = 'menu';           // menu | playing | paused | clear | over
  var score = 0;                // 累计总分
  var best = 0;
  var level = 1;
  var levelScore = 0;           // 本关已捞金额
  var target = 0;               // 本关目标
  var timeLeft = LEVEL_TIME;
  var timeFrozen = false;       // 修改器：时间冻结
  var items = [];
  var floats = [];              // 飘字
  var reachToastShown = false;

  var claw = {
    mode: 'swing',              // swing | shoot | retract
    angle: 0,                   // 相对垂直向下（正=向右）
    swingT: 0,
    len: 0,
    item: null,                 // 抓住的道具
    tipX: 0,
    tipY: 0
  };

  function targetFor(lv) { return 650 + (lv - 1) * 450; }

  // ---------- 音效（迷你 WebAudio） ----------
  var actx = null;
  function beep(freq, dur, type, vol) {
    if (!GamePlatform.ui.isSoundEnabled()) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = vol || 0.05;
      o.connect(g); g.connect(actx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.stop(actx.currentTime + dur);
    } catch (e) { /* ignore */ }
  }
  function sndDrop()  { beep(320, 0.12, 'square', 0.04); }
  function sndGrab()  { beep(520, 0.1, 'triangle', 0.06); setTimeout(function () { beep(700, 0.12, 'triangle', 0.05); }, 90); }
  function sndCoin(v) { beep(660 + Math.min(400, v / 2), 0.14, 'triangle', 0.06); }
  function sndClear() { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { beep(f, 0.16, 'triangle', 0.06); }, i * 130); }); }
  function sndFail()  { beep(300, 0.25, 'sawtooth', 0.05); setTimeout(function () { beep(210, 0.35, 'sawtooth', 0.05); }, 200); }

  // ---------- 关卡生成 ----------
  function genLevel(lv) {
    items = [];
    target = targetFor(lv);
    levelScore = 0;
    timeLeft = LEVEL_TIME;
    reachToastShown = false;
    claw.mode = 'swing'; claw.len = 0; claw.item = null; claw.swingT = 0; claw.angle = 0;

    var plan = [];
    var goldB = Math.min(1 + Math.floor(lv / 2), 4);
    var goldS = 2 + Math.min(lv, 5);
    var diamond = Math.min(Math.floor((lv + 1) / 2), 4);
    var stoneB = 1 + Math.min(Math.floor(lv / 2), 3);
    var stoneS = 1 + Math.min(lv, 3);
    var bone = 1 + (lv % 2);
    var bag = Math.min(1 + Math.floor(lv / 3), 3);
    var i;
    for (i = 0; i < goldB; i++) plan.push('goldB');
    for (i = 0; i < goldS; i++) plan.push('goldS');
    for (i = 0; i < diamond; i++) plan.push('diamond');
    for (i = 0; i < stoneB; i++) plan.push('stoneB');
    for (i = 0; i < stoneS; i++) plan.push('stoneS');
    for (i = 0; i < bone; i++) plan.push('bone');
    for (i = 0; i < bag; i++) plan.push('bag');

    for (var p = 0; p < plan.length; p++) {
      var def = ITEM_TYPES[plan[p]];
      var it = null;
      for (var tries = 0; tries < 60; tries++) {
        var x = 34 + Math.random() * (W - 68);
        var y = GROUND_Y + 46 + Math.random() * (H - GROUND_Y - 92);
        var ok = true;
        for (var k = 0; k < items.length; k++) {
          var o = items[k];
          var dx = o.x - x, dy = o.y - y;
          if (dx * dx + dy * dy < (o.r + def.r + 16) * (o.r + def.r + 16)) { ok = false; break; }
        }
        if (!ok) continue;
        it = {
          type: plan[p], x: x, y: y, r: def.r,
          value: plan[p] === 'bag' ? (50 + Math.floor(Math.random() * 16) * 50) : def.value,
          weight: def.weight, color: def.color, edge: def.edge, label: def.label,
          grabbed: false
        };
        break;
      }
      if (it) items.push(it);
    }
    updateHUD();
  }

  // ---------- 飘字 ----------
  function addFloat(x, y, text, color) {
    if (GamePlatform.ui.shouldReduceMotion()) return;
    floats.push({ x: x, y: y, text: text, color: color, t: 0 });
  }

  // ---------- 出钩 / 收钩 ----------
  function dropClaw() {
    if (state !== 'playing' || claw.mode !== 'swing') return;
    claw.mode = 'shoot';
    claw.len = 26;
    claw.item = null;
    sndDrop();
  }

  function collectItem() {
    if (!claw.item) return;
    var it = claw.item;
    score += it.value;
    levelScore += it.value;
    addFloat(PIVOT.x, PIVOT.y + 26, '+' + it.value, pal.floatGood);
    sndCoin(it.value);
    // 移除道具
    for (var i = 0; i < items.length; i++) {
      if (items[i] === it) { items.splice(i, 1); break; }
    }
    claw.item = null;
    if (!reachToastShown && levelScore >= target) {
      reachToastShown = true;
      try { GamePlatform.ui.toast(t('reached')); } catch (e) { /* ignore */ }
    }
    updateHUD();
    saveBest();
  }

  // ---------- 更新 ----------
  function update(dt) {
    if (state !== 'playing') return;

    if (!timeFrozen) {
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateHUD();
        endLevel();
        return;
      }
    }

    // 摆动
    if (claw.mode === 'swing') {
      claw.swingT += dt * SWING_SPEED;
      claw.angle = Math.sin(claw.swingT) * SWING_AMP;
      claw.len = 26;
    }

    // 出钩
    if (claw.mode === 'shoot') {
      claw.len += SHOOT_SPEED * dt;
      var dirX = Math.sin(claw.angle), dirY = Math.cos(claw.angle);
      claw.tipX = PIVOT.x + dirX * claw.len;
      claw.tipY = PIVOT.y + dirY * claw.len;

      // 碰撞检测
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var dx = it.x - claw.tipX, dy = it.y - claw.tipY;
        if (dx * dx + dy * dy <= (it.r + 11) * (it.r + 11)) {
          claw.item = it;
          it.grabbed = true;
          claw.mode = 'retract';
          sndGrab();
          break;
        }
      }
      if (claw.len >= MAX_LEN || claw.tipY > H + 20 || claw.tipX < -20 || claw.tipX > W + 20) {
        claw.mode = 'retract';
      }
    }

    // 收钩
    if (claw.mode === 'retract') {
      var w = claw.item ? claw.item.weight : 0.85;
      var speed = Math.max(90, RETRACT_BASE / w);
      claw.len -= speed * dt;
      if (claw.len <= 26) {
        claw.len = 26;
        if (claw.item) collectItem();
        claw.mode = 'swing';
      } else {
        var dX = Math.sin(claw.angle), dY = Math.cos(claw.angle);
        claw.tipX = PIVOT.x + dX * claw.len;
        claw.tipY = PIVOT.y + dY * claw.len;
        if (claw.item) {
          claw.item.x = claw.tipX;
          claw.item.y = claw.tipY + claw.item.r * 0.55;
        }
      }
    }

    // 飘字
    for (var f = floats.length - 1; f >= 0; f--) {
      floats[f].t += dt;
      floats[f].y -= dt * 46;
      if (floats[f].t > 1.1) floats.splice(f, 1);
    }
  }

  function endLevel() {
    if (levelScore >= target) {
      state = 'clear';
      sndClear();
      document.getElementById('clear-score').textContent = GamePlatform.util.formatNumber(score);
      document.getElementById('clear-best').textContent = GamePlatform.util.formatNumber(best);
      showOverlay('ov-clear');
    } else {
      state = 'over';
      sndFail();
      saveBest();
      document.getElementById('go-score').textContent = GamePlatform.util.formatNumber(score);
      document.getElementById('go-best').textContent = GamePlatform.util.formatNumber(best);
      showOverlay('ov-over');
    }
    updateHUD();
  }

  function saveBest() {
    if (score > best) {
      best = score;
      GamePlatform.storage.set('best', best);
    }
    updateHUD();
  }

  // ---------- 绘制 ----------
  function draw() {
    // 天空
    var g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(1, pal.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // 地下
    var g2 = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    g2.addColorStop(0, pal.ground);
    g2.addColorStop(1, pal.groundDark);
    ctx.fillStyle = g2;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // 地表线
    ctx.fillStyle = pal.groundLine;
    ctx.fillRect(0, GROUND_Y - 3, W, 5);

    // 碎石纹理
    for (var i = 0; i < pebbles.length; i++) {
      var pb = pebbles[i];
      ctx.fillStyle = pb.dark ? pal.pebble2 : pal.pebble;
      ctx.beginPath();
      ctx.arc(pb.x, pb.y, pb.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 道具
    for (var j = 0; j < items.length; j++) drawItem(items[j]);

    // 矿工 + 钩爪
    drawMiner();
    drawClaw();

    // 飘字
    ctx.textAlign = 'center';
    ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
    for (var f = 0; f < floats.length; f++) {
      var fl = floats[f];
      ctx.globalAlpha = Math.max(0, 1 - fl.t / 1.1);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x, fl.y);
    }
    ctx.globalAlpha = 1;

    // 顶部暗角，让矿工更突出
    var vg = ctx.createLinearGradient(0, 0, 0, 90);
    vg.addColorStop(0, pal.vignette);
    vg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, 90);
  }

  function drawItem(it) {
    var x = it.x, y = it.y, r = it.r;

    if (it.type === 'diamond') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = it.color;
      ctx.fillRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
      ctx.strokeStyle = it.edge;
      ctx.lineWidth = 2.4;
      ctx.strokeRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-r * 0.4, -r * 0.4, r * 0.5, r * 0.5);
      ctx.restore();
      return;
    }

    if (it.type === 'bone') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.5);
      ctx.fillStyle = it.color;
      roundRect(-r * 1.15, -r * 0.34, r * 2.3, r * 0.68, r * 0.34);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-r * 1.05, -r * 0.42, r * 0.36, 0, Math.PI * 2);
      ctx.arc(-r * 1.05, r * 0.42, r * 0.36, 0, Math.PI * 2);
      ctx.arc(r * 1.05, -r * 0.42, r * 0.36, 0, Math.PI * 2);
      ctx.arc(r * 1.05, r * 0.42, r * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (it.type === 'bag') {
      // 袋身
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.12, r * 0.92, r * 0.98, 0, 0, Math.PI * 2);
      ctx.fill();
      // 扎口
      ctx.fillStyle = it.edge;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y - r * 0.62);
      ctx.quadraticCurveTo(x, y - r * 1.28, x + r * 0.5, y - r * 0.62);
      ctx.closePath();
      ctx.fill();
      // ¥ 标
      ctx.fillStyle = '#f7e7c3';
      ctx.font = '700 ' + Math.round(r * 0.95) + 'px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('¥', x, y + r * 0.16);
      ctx.textBaseline = 'alphabetic';
      return;
    }

    // 金块 / 石头：圆 + 高光
    ctx.fillStyle = it.color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = it.edge;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // 刻面
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.34, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    if (it.type === 'goldB' || it.type === 'goldS') {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(x - r * 0.36, y - r * 0.4, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
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

  function drawMiner() {
    var mx = PIVOT.x, my = PIVOT.y;

    // 绞盘
    ctx.fillStyle = pal.claw;
    ctx.beginPath();
    ctx.arc(mx, my - 6, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.clawEdge;
    ctx.beginPath();
    ctx.arc(mx, my - 6, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // 身体
    ctx.fillStyle = pal.minerBody;
    roundRect(mx - 17, my - 52, 34, 40, 9);
    ctx.fill();

    // 头
    ctx.fillStyle = pal.minerSkin;
    ctx.beginPath();
    ctx.arc(mx, my - 66, 14, 0, Math.PI * 2);
    ctx.fill();

    // 帽子
    ctx.fillStyle = pal.minerHat;
    ctx.beginPath();
    ctx.arc(mx, my - 70, 15, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(mx - 19, my - 71, 38, 5);

    // 眼睛
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(mx - 5, my - 66, 1.9, 0, Math.PI * 2);
    ctx.arc(mx + 5, my - 66, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawClaw() {
    var dirX = Math.sin(claw.angle), dirY = Math.cos(claw.angle);
    var tipX = claw.tipX || (PIVOT.x + dirX * claw.len);
    var tipY = claw.tipY || (PIVOT.y + dirY * claw.len);

    // 绳
    ctx.strokeStyle = pal.rope;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(PIVOT.x, PIVOT.y);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // 钩爪（朝运动方向的 V 形）
    var a = claw.angle;
    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(a);
    ctx.strokeStyle = pal.claw;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-11, -2);
    ctx.quadraticCurveTo(0, 12, 0, 16);
    ctx.quadraticCurveTo(0, 12, 11, -2);
    ctx.stroke();
    ctx.strokeStyle = pal.clawEdge;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-11, -2);
    ctx.quadraticCurveTo(0, 12, 0, 16);
    ctx.quadraticCurveTo(0, 12, 11, -2);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- HUD / 覆盖层 ----------
  function updateHUD() {
    document.getElementById('hud-score').textContent = GamePlatform.util.formatNumber(score);
    document.getElementById('hud-best').textContent = GamePlatform.util.formatNumber(best);
    document.getElementById('hud-level').textContent = String(level);
    document.getElementById('hud-time').textContent = String(Math.ceil(timeLeft));
    document.getElementById('hud-target').textContent = GamePlatform.util.formatNumber(target);
  }

  function showOverlay(id) {
    ['ov-menu', 'ov-pause', 'ov-clear', 'ov-over'].forEach(function (oid) {
      var el = document.getElementById(oid);
      if (oid === id) el.removeAttribute('hidden');
      else el.setAttribute('hidden', '');
    });
  }

  function applyLang() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      nodes[i].textContent = t(key);
    }
    // 图例
    var legend = document.getElementById('menu-legend');
    if (legend) {
      var rows = [
        ['goldB', 500], ['goldS', 200], ['diamond', 800],
        ['stoneB', 20], ['stoneS', 10], ['bag', '?']
      ];
      legend.innerHTML = rows.map(function (r) {
        var def = ITEM_TYPES[r[0]];
        return '<div class="legend-item"><span class="legend-dot" style="background:' + def.color + '"></span>' +
          '<span>' + t('item-' + def.label) + ' · ¥' + r[1] + '</span></div>';
      }).join('');
    }
  }

  // ---------- 流程 ----------
  function startGame() {
    score = 0;
    level = 1;
    genLevel(level);
    state = 'playing';
    showOverlay(null);
    updateHUD();
  }

  function nextLevel() {
    level++;
    genLevel(level);
    state = 'playing';
    showOverlay(null);
    updateHUD();
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    showOverlay('ov-pause');
    var btn = document.getElementById('btn-pause');
    if (btn) btn.textContent = t('resume');
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    showOverlay(null);
    var btn = document.getElementById('btn-pause');
    if (btn) btn.textContent = t('pauseBtn');
  }

  function togglePause() {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }

  // ---------- 输入 ----------
  function bindInput() {
    document.getElementById('btn-start').onclick = startGame;
    document.getElementById('btn-again').onclick = startGame;
    document.getElementById('btn-next').onclick = nextLevel;
    document.getElementById('btn-resume').onclick = resumeGame;
    document.getElementById('btn-restart-pause').onclick = function () {
      var btn = document.getElementById('btn-pause');
      if (btn) btn.textContent = t('pauseBtn');
      startGame();
    };
    document.getElementById('btn-pause').onclick = togglePause;
    document.getElementById('btn-home').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-go').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-clear').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-fullscreen').onclick = function () { GamePlatform.ui.fullscreen(); };
    document.getElementById('btn-clear').onclick = function () {
      best = 0;
      GamePlatform.storage.set('best', 0);
      document.getElementById('menu-best').textContent = '0';
      updateHUD();
      try { GamePlatform.ui.toast(t('clearRecords') + ' ✓'); } catch (e) { /* ignore */ }
    };

    // 出钩：点击 / 触摸
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      dropClaw();
    });

    // 键盘
    window.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === ' ' || k === 'ArrowDown' || k === 'Enter' || k === 's' || k === 'S') {
        e.preventDefault();
        dropClaw();
      } else if (k === 'Escape' || k === 'p' || k === 'P') {
        e.preventDefault();
        togglePause();
      }
    });
  }

  // ---------- 主循环 ----------
  var lastTs = 0;
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 1 / 30);
    lastTs = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  // ---------- 启动 ----------
  function init() {
    rebuildPal();
    best = GamePlatform.storage.get('best', 0) || 0;
    genLevel(1);
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
    GamePlatform.i18n.onChange(function () { applyLang(); });
  });

  // ---------- 修改器（暗号 potato4096 / 移动手势） ----------
  function cheatAddTime(v) {
    timeLeft = Math.max(timeLeft, Math.round(v));
    updateHUD();
  }
  function cheatPassLevel() {
    levelScore = Math.max(levelScore, target);
    timeLeft = 0.001;
    updateHUD();
    try { GamePlatform.ui.toast(t('reached')); } catch (e) { /* ignore */ }
  }

  GM.game = {
    get score() { return score; },
    get level() { return level; },
    get timeLeft() { return timeLeft; }
  };

  if (window.CheatKit) {
    CheatKit.init({
      id: 'gold-miner',
      title: { zh: '🔧 修改器', en: '🔧 Modifier' },
      hint: { zh: '彩蛋面板 · 参数即时生效', en: 'Easter egg · changes apply instantly' },
      stats: [
        { label: { zh: '得分', en: 'Score' }, get: function () { return score; }, format: function (v) { return GamePlatform.util.formatNumber(v); } },
        { label: { zh: '本关', en: 'Level $' }, get: function () { return levelScore; }, tone: 'success' },
        { label: { zh: '目标', en: 'Target' }, get: function () { return target; }, tone: 'warning' },
        { label: { zh: '时间', en: 'Time' }, get: function () { return Math.ceil(timeLeft); }, tone: 'danger' },
        { label: { zh: '关卡', en: 'Level' }, get: function () { return level; } },
        { label: { zh: '场上道具', en: 'Items' }, get: function () { return items.length; } }
      ],
      params: [
        { key: 'score', label: { zh: '总得分', en: 'Score' }, min: 0, max: 999999, step: 100,
          get: function () { return score; },
          set: function (v) { score = Math.round(v); updateHUD(); } },
        { key: 'levelScore', label: { zh: '本关金额', en: 'Level $' }, min: 0, max: 99999, step: 50,
          get: function () { return levelScore; },
          set: function (v) { levelScore = Math.round(v); updateHUD(); } },
        { key: 'time', label: { zh: '剩余时间', en: 'Time left' }, min: 0, max: 300, step: 5,
          get: function () { return Math.ceil(timeLeft); },
          set: cheatAddTime },
        { key: 'level', label: { zh: '关卡', en: 'Level' }, min: 1, max: 30, step: 1,
          get: function () { return level; },
          set: function (v) {
            level = Math.max(1, Math.round(v));
            genLevel(level);
            state = 'playing';
            showOverlay(null);
          } }
      ],
      toggles: [
        { label: { zh: '时间冻结', en: 'Freeze time' },
          on: { zh: '时间冻结：开', en: 'Freeze time: ON' },
          off: { zh: '时间冻结：关', en: 'Freeze time: OFF' },
          get: function () { return timeFrozen; },
          set: function (v) { timeFrozen = !!v; } }
      ],
      actions: [
        { label: { zh: '+30 秒', en: '+30s' }, run: function () { cheatAddTime(timeLeft + 30); }, toast: { zh: '时间 +30 秒', en: '+30 seconds' } },
        { label: { zh: '直接过关', autoHide: true, en: 'Pass level' }, run: cheatPassLevel, toast: { zh: '本关已达标', en: 'Target met' } },
        { label: { zh: '重排道具', en: 'Reshuffle items' }, run: function () { genLevel(level); }, toast: { zh: '道具已重排', en: 'Items reshuffled' } }
      ]
    });
  }
})();
