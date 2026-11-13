/* fishing - core game: cast / bite / reel fight / catch / gear upgrades */
(function () {
  'use strict';

  var FS = window.FS = window.FS || {};

  // ---------- constants ----------
  var W = 640, H = 480;
  var WATER_Y = 264;
  var ROD_TIP_X = 212, ROD_TIP_Y = 236;
  var CAST_MIN_X = 262, CAST_MAX_X = 612;
  var CAST_TIME = 0.55;
  var BITE_WINDOW = 1.05;
  var SLACK_LIMIT = 2.4, SLACK_TENSION = 14;
  var CHARGE_SPEED = 0.85;
  var REEL_TICK = 0.32;

  var GEAR_COST = [120, 320, 800];
  var GEAR_KEYS = ['rod', 'line', 'bait'];

  // ---------- i18n ----------
  var STR = {
    title: { zh: '钓鱼', en: 'Fishing' },
    tagline: {
      zh: '抛竿蓄力看落点，浮漂下沉瞬间提竿，拉杆时管好张力线！',
      en: 'Charge your cast, strike when the bobber dips, and keep the tension under control!'
    },
    controls: {
      zh: '操作：按住蓄力、松开抛竿；咬钩时点击 / 空格提竿；拉杆时按住收线、松开放线；Esc / P 暂停。远水出大鱼，赚金币升级渔具。',
      en: 'Controls: hold to charge, release to cast; click / Space to hook a bite; hold to reel, release to give line; Esc / P to pause. Farther casts land bigger fish — earn coins and upgrade your gear.'
    },
    home: { zh: '返回主页', en: 'Home' },
    pauseBtn: { zh: '暂停', en: 'Pause' },
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    start: { zh: '开始游戏', en: 'Start' },
    restart: { zh: '重新开始', en: 'Restart' },
    resume: { zh: '继续游戏', en: 'Resume' },
    paused: { zh: '已暂停', en: 'Paused' },
    gameOver: { zh: '本局结束', en: 'Run Summary' },
    again: { zh: '再玩一次', en: 'Play Again' },
    endRun: { zh: '结束本局', en: 'End Run' },
    clearRecords: { zh: '清除记录', en: 'Clear Records' },
    cleared: { zh: '记录已清除', en: 'Records cleared' },
    newRecord: { zh: '新纪录！', en: 'New record!' },
    coins: { zh: '金币', en: 'Coins' },
    bestWeight: { zh: '最大鱼', en: 'Best fish' },
    caught: { zh: '已钓数', en: 'Caught' },
    status: { zh: '当前状态', en: 'Status' },
    recWeight: { zh: '最大单尾', en: 'Best single' },
    recCoins: { zh: '累计最高金币', en: 'Peak coins' },
    recLegend: { zh: '传说鱼数量', en: 'Legendaries' },
    runCaught: { zh: '本局钓获', en: 'Caught this run' },
    runBest: { zh: '本局最大', en: 'Best this run' },
    runCoins: { zh: '本局金币', en: 'Coins this run' },
    shop: { zh: '渔具升级', en: 'Gear Shop' },
    gearRod: { zh: '鱼竿', en: 'Rod' },
    gearLine: { zh: '鱼线', en: 'Line' },
    gearBait: { zh: '鱼饵', en: 'Bait' },
    gearRodDesc: { zh: '提升拉杆力量', en: 'Stronger reel power' },
    gearLineDesc: { zh: '提升断线上限', en: 'Higher snap limit' },
    gearBaitDesc: { zh: '加快咬钩、提高大鱼概率', en: 'Faster bites, bigger fish' },
    buy: { zh: '购买', en: 'Buy' },
    maxed: { zh: '已满级', en: 'MAX' },
    needCoins: { zh: '金币不足', en: 'Not enough coins' },
    bought: { zh: '升级成功！', en: 'Upgrade done!' },
    statusWait: { zh: '等待', en: 'Waiting' },
    statusBite: { zh: '咬钩', en: 'Bite!' },
    statusReel: { zh: '拉杆中', en: 'Reeling' },
    holdHint: { zh: '按住蓄力，松开抛竿', en: 'Hold to charge, release to cast' },
    waitHint: { zh: '等待咬钩……', en: 'Waiting for a bite...' },
    biteAlert: { zh: '咬钩了！', en: 'Bite!' },
    hookHint: { zh: '快提竿！', en: 'Hook it now!' },
    reelHint: { zh: '按住收线 · 松开放线', en: 'Hold to reel · release to give line' },
    msgSnap: { zh: '断线了！', en: 'The line snapped!' },
    msgEscape: { zh: '鱼脱钩了！', en: 'The fish got away!' },
    msgTimeout: { zh: '提竿太慢，鱼跑了！', en: 'Too slow — the fish escaped!' },
    catchTitle: { zh: '钓获', en: 'Caught' },
    gainCoins: { zh: '获得金币', en: 'Coins earned' },
    fishCommon: { zh: '普通鱼', en: 'Common Fish' },
    fishRare: { zh: '稀有鱼', en: 'Rare Fish' },
    fishEpic: { zh: '史诗鱼', en: 'Epic Fish' },
    fishLegend: { zh: '传说鱼', en: 'Legendary Fish' },
    cheatTitle: { zh: '🔧 修改器', en: '🔧 Modifier' },
    cheatHint: { zh: '彩蛋面板 · 参数即时生效', en: 'Easter egg · changes apply instantly' },
    cheatBit: { zh: '已触发咬钩', en: 'Bite triggered' },
    cheatNoBite: { zh: '当前状态无需上钩', en: 'No hook needed right now' },
    cheatLegendCaught: { zh: '传说鱼到手！', en: 'Legendary fish caught!' },
    cheatCoins: { zh: '金币 +1000', en: 'Coins +1000' },
    cheatGearMax: { zh: '渔具已全部满级', en: 'All gear maxed out' },
    cheatRestart: { zh: '已重开本局', en: 'Run restarted' },
    cheatTglBite: { zh: '必咬钩', en: 'Instant bite' },
    cheatTglBiteOn: { zh: '必咬钩：开（抛竿立即上钩）', en: 'Instant bite: ON' },
    cheatTglBiteOff: { zh: '必咬钩：关', en: 'Instant bite: OFF' },
    cheatTglLegend: { zh: '必出传说鱼', en: 'Always legendary' },
    cheatTglLegendOn: { zh: '必出传说鱼：开', en: 'Always legendary: ON' },
    cheatTglLegendOff: { zh: '必出传说鱼：关', en: 'Always legendary: OFF' },
    cheatTglTension: { zh: '张力不涨', en: 'Tension frozen' },
    cheatTglTensionOn: { zh: '张力不涨：开（不会断线）', en: 'Tension frozen: ON' },
    cheatTglTensionOff: { zh: '张力不涨：关', en: 'Tension frozen: OFF' }
  };
  function t(k) { return GamePlatform.i18n.t(STR[k] || { zh: k, en: k }); }

  // ---------- fish ----------
  var RARITY = [
    { nameKey: 'fishCommon', wMin: 0.4, wMax: 3.2, price: 12, struggle: 1.0, color: '#8aa9b8' },
    { nameKey: 'fishRare', wMin: 2.4, wMax: 9.5, price: 26, struggle: 1.35, color: '#4f9df5' },
    { nameKey: 'fishEpic', wMin: 8, wMax: 27, price: 62, struggle: 1.8, color: '#9b5de5' },
    { nameKey: 'fishLegend', wMin: 24, wMax: 85, price: 145, struggle: 2.35, color: '#f0a63c' }
  ];

  // ---------- canvas / fit (anti-blur) ----------
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var fitCache = null;

  function fit(c, g, w, h) {
    var dpr = window.devicePixelRatio || 1;
    var rect = c.getBoundingClientRect();
    var cssW = rect.width || w;
    var bw = Math.max(1, Math.round(cssW * dpr));
    var bh = Math.max(1, Math.round((h * bw) / w));
    if (!fitCache || fitCache.bw !== bw || fitCache.bh !== bh ||
        c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
      fitCache = { bw: bw, bh: bh };
    }
    g.setTransform(bw / w, 0, 0, bh / h, 0, 0);
  }

  // ---------- world palettes ----------
  var WORLD = {
    light: {
      skyTop: '#bfe3f7', skyBottom: '#e9f4fb',
      sun: '#fff3c4', cloud: 'rgba(255,255,255,0.85)',
      mtnFar: '#a8c3cf', mtnNear: '#7fa3b5',
      waterTop: '#5aa7cf', waterBottom: '#2e6f9e', wave: '#8fd0e8',
      shore: '#8a6f4d', shoreDark: '#6b5335',
      angler: '#3a4a5c', rod: '#5b4632', line: 'rgba(255,255,255,0.8)',
      bobber: '#e8453c', bobberTop: '#ffffff',
      fishShadow: 'rgba(20,50,70,0.32)',
      barTrack: 'rgba(20,40,60,0.25)', barGood: '#3fae6c', barWarn: '#e2a03f',
      barBad: '#e5484d', barFill: '#4f9df5',
      popupBg: 'rgba(255,255,255,0.94)', popupText: '#1c3040', popupMuted: '#5b6474'
    },
    dark: {
      skyTop: '#16273c', skyBottom: '#2b4a68',
      sun: '#dfe9f2', cloud: 'rgba(200,220,240,0.18)',
      mtnFar: '#2c4a63', mtnNear: '#1f3549',
      waterTop: '#24506e', waterBottom: '#132c42', wave: '#3d7396',
      shore: '#2c2418', shoreDark: '#1d170f',
      angler: '#0d1520', rod: '#4a3826', line: 'rgba(220,235,245,0.55)',
      bobber: '#e8453c', bobberTop: '#f2f2f2',
      fishShadow: 'rgba(200,225,240,0.16)',
      barTrack: 'rgba(220,235,245,0.18)', barGood: '#4cc38a', barWarn: '#e2a03f',
      barBad: '#ef6b6b', barFill: '#7fb2ff',
      popupBg: 'rgba(18,28,40,0.94)', popupText: '#e8f1f8', popupMuted: '#9aa4b5'
    }
  };
  var pal = WORLD.light;
  var skyGrad = null;

  function rebuildPal() {
    var mode = GamePlatform.theme.get();
    pal = WORLD[mode] || WORLD.light;
    skyGrad = ctx.createLinearGradient(0, 0, 0, WATER_Y);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(1, pal.skyBottom);
  }

  // ---------- game state ----------
  // menu | idle | charging | casting | waiting | bite | reeling | caught | paused | gameover
  var state = 'menu';
  var resumeState = 'idle';
  var animT = 0;

  var coins = 0, bestWeight = 0, bestCoins = 0, legendCount = 0;
  var gear = { rod: 0, line: 0, bait: 0 };
  var runCount = 0, runCoins = 0, runMaxWeight = 0;

  var power = 0, landX = 420, castT = 0;
  var waitT = 0, biteT = 0, catchT = 0;
  var tension = 0, progress = 0, slackT = 0, fightT = 0, fightPhase = 0;
  var holding = false, reelTick = 0;
  var fish = null; // { rarity, weight }
  var msg = '', msgT = 0;
  var particles = [];
  var shadows = [];

  /* 修改器状态（见文件末尾 CheatKit.init） */
  var cheatBite = false, cheatLegend = false, cheatNoRise = false;
  var cheatBiteSpeed = 0, cheatReelPower = 0;
  var forceBite = false; // 立即上钩：一次性加速咬钩

  // ---------- storage ----------
  function loadStore() {
    bestWeight = GamePlatform.storage.get('best:fishing:weight', 0) || 0;
    bestCoins = GamePlatform.storage.get('best:fishing:coins', 0) || 0;
    legendCount = GamePlatform.storage.get('best:fishing:legend', 0) || 0;
    var g = GamePlatform.storage.get('gear:fishing', null);
    if (g && typeof g === 'object') {
      gear.rod = Math.max(0, Math.min(3, g.rod | 0));
      gear.line = Math.max(0, Math.min(3, g.line | 0));
      gear.bait = Math.max(0, Math.min(3, g.bait | 0));
      coins = Math.max(0, Math.round(g.coins || 0));
    }
  }

  function saveGear() {
    GamePlatform.storage.set('gear:fishing', {
      rod: gear.rod, line: gear.line, bait: gear.bait, coins: coins
    });
  }

  function saveBest() {
    GamePlatform.storage.set('best:fishing:weight', bestWeight);
    GamePlatform.storage.set('best:fishing:coins', bestCoins);
    GamePlatform.storage.set('best:fishing:legend', legendCount);
  }

  // ---------- helpers ----------
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function toast(key) {
    try { GamePlatform.ui.toast(t(key)); } catch (e) { /* ignore */ }
  }

  function reduceMotion() {
    return GamePlatform.ui.shouldReduceMotion();
  }

  function statusText() {
    if (state === 'bite') return t('statusBite');
    if (state === 'reeling') return t('statusReel');
    if (state === 'menu' || state === 'gameover') return '-';
    return t('statusWait');
  }

  function setMsg(key, dur) {
    msg = key ? t(key) : '';
    msgT = key ? (dur || 1.6) : 0;
  }

  // ---------- fish rolling ----------
  function rollRarity() {
    if (cheatLegend) return 3;
    var d = power;
    var baitBonus = gear.bait * 0.05;
    var w = [
      Math.max(0.06, 0.72 - 0.44 * d),
      0.20 + 0.16 * d + baitBonus,
      0.055 + 0.19 * d + baitBonus * 1.2,
      0.02 + 0.09 * d + baitBonus * 1.1
    ];
    var sum = w[0] + w[1] + w[2] + w[3];
    var r = Math.random() * sum;
    for (var i = 0; i < 4; i++) {
      r -= w[i];
      if (r <= 0) return i;
    }
    return 0;
  }

  function rollFish() {
    var ri = rollRarity();
    var spec = RARITY[ri];
    var bias = 0.3 + 0.7 * power;
    var w = spec.wMin + (spec.wMax - spec.wMin) * bias * (0.55 + 0.45 * Math.random());
    w = Math.max(spec.wMin, Math.min(spec.wMax, w));
    return { rarity: ri, weight: Math.round(w * 10) / 10 };
  }

  function computeWait() {
    if (cheatBite || forceBite) return 0.05;
    var w = rand(1, 6);
    w *= (1 - 0.14 * gear.bait);
    if (cheatBiteSpeed > 0) w *= Math.max(0.05, 1 - cheatBiteSpeed / 100);
    return Math.max(0.2, w);
  }

  // ---------- flow ----------
  function startGame() {
    runCount = 0;
    runCoins = 0;
    runMaxWeight = 0;
    fish = null;
    power = 0;
    tension = 0;
    progress = 0;
    holding = false;
    msg = '';
    msgT = 0;
    particles = [];
    state = 'idle';
    hideOverlays();
    FS.audio.play('start');
    updateHUD();
  }

  function endRun() {
    state = 'gameover';
    document.getElementById('go-count').textContent = String(runCount);
    document.getElementById('go-best').textContent = runMaxWeight > 0 ? runMaxWeight.toFixed(1) + ' kg' : '-';
    document.getElementById('go-coins').textContent = GamePlatform.util.formatNumber(runCoins);
    document.getElementById('go-best-weight').textContent = bestWeight > 0 ? bestWeight.toFixed(1) + ' kg' : '-';
    showOverlay('ov-gameover');
  }

  function doCast() {
    power = clamp(power, 0.12, 1);
    landX = CAST_MIN_X + (CAST_MAX_X - CAST_MIN_X) * power;
    castT = 0;
    state = 'casting';
    holding = false;
    FS.audio.play('cast');
    updateHUD();
  }

  function landCast() {
    state = 'waiting';
    waitT = computeWait();
    FS.audio.play('splash');
    spawnSplash(landX, WATER_Y + 4);
    updateHUD();
  }

  function triggerBite() {
    forceBite = false;
    fish = rollFish();
    state = 'bite';
    biteT = BITE_WINDOW;
    fightPhase = Math.random() * Math.PI * 2;
    FS.audio.play('bite');
    updateHUD();
  }

  function hookFish() {
    if (state !== 'bite' || !fish) return;
    state = 'reeling';
    tension = 26;
    progress = 0;
    slackT = 0;
    fightT = 0;
    reelTick = 0;
    FS.audio.play('reel');
    setMsg('reelHint', 2);
    updateHUD();
  }

  function failFish(kind) {
    fish = null;
    tension = 0;
    progress = 0;
    holding = false;
    state = 'idle';
    if (kind === 'snap') {
      FS.audio.play('snap');
      setMsg('msgSnap', 1.8);
    } else if (kind === 'escape') {
      FS.audio.play('splash');
      setMsg('msgEscape', 1.8);
    } else {
      FS.audio.play('splash');
      setMsg('msgTimeout', 1.8);
    }
    updateHUD();
  }

  function landFish() {
    var spec = RARITY[fish.rarity];
    var gain = Math.round(fish.weight * spec.price);
    coins += gain;
    runCoins += gain;
    runCount++;
    if (fish.weight > runMaxWeight) runMaxWeight = fish.weight;
    if (fish.weight > bestWeight) {
      bestWeight = fish.weight;
      toast('newRecord');
    }
    if (coins > bestCoins) bestCoins = coins;
    if (fish.rarity === 3) legendCount++;
    saveBest();
    saveGear();
    state = 'caught';
    catchT = 2.8;
    holding = false;
    tension = 0;
    progress = 0;
    FS.audio.play('catch');
    FS.audio.play('coin');
    updateHUD();
  }

  function dismissCatch() {
    if (state !== 'caught') return;
    fish = null;
    catchT = 0;
    state = 'idle';
    updateHUD();
  }

  // ---------- particles ----------
  function spawnSplash(x, y) {
    var n = reduceMotion() ? 3 : 9;
    for (var i = 0; i < n; i++) {
      particles.push({
        x: x + rand(-8, 8), y: y,
        vx: rand(-70, 70), vy: rand(-160, -50),
        life: rand(0.35, 0.7), maxLife: 0.7,
        size: rand(2, 4)
      });
    }
  }

  function initShadows() {
    shadows = [];
    for (var i = 0; i < 4; i++) {
      shadows.push({
        x: rand(CAST_MIN_X, W - 30),
        y: rand(WATER_Y + 46, H - 60),
        vx: rand(12, 30) * (Math.random() < 0.5 ? -1 : 1),
        size: rand(14, 26),
        wob: Math.random() * Math.PI * 2
      });
    }
  }

  // ---------- update ----------
  function update(dt) {
    var i;

    if (state === 'charging') {
      power += CHARGE_SPEED * dt;
      if (power > 1) power = 1;
    } else if (state === 'casting') {
      castT += dt / CAST_TIME;
      if (castT >= 1) {
        castT = 1;
        landCast();
      }
    } else if (state === 'waiting') {
      waitT -= dt;
      if (waitT <= 0) triggerBite();
    } else if (state === 'bite') {
      biteT -= dt;
      if (biteT <= 0) failFish('timeout');
    } else if (state === 'reeling' && fish) {
      fightT += dt;
      var spec = RARITY[fish.rarity];
      var pull = 0.5 + 0.5 * Math.sin(fightT * (1.4 + spec.struggle * 0.8) + fightPhase);
      if (Math.random() < 0.008 * spec.struggle) pull = 1;

      if (holding) {
        if (!cheatNoRise) {
          tension += (20 + pull * 26 * spec.struggle) * dt;
        }
        var rodEff = cheatReelPower > 0 ? (cheatReelPower / 50) : (1 + gear.rod * 0.22);
        progress += 12 * rodEff * dt / spec.struggle;
        reelTick -= dt;
        if (reelTick <= 0) {
          reelTick = REEL_TICK;
          FS.audio.play('reel');
        }
      } else {
        tension -= 40 * dt;
        progress -= 5 * dt;
        if (progress < 0) progress = 0;
      }
      if (tension < 0) tension = 0;

      var limit = 100 + 25 * gear.line;
      if (tension >= limit) {
        failFish('snap');
      } else if (tension < SLACK_TENSION) {
        slackT += dt;
        if (slackT > SLACK_LIMIT) failFish('escape');
      } else {
        slackT = 0;
      }

      if (state === 'reeling' && progress >= 100) landFish();
    } else if (state === 'caught') {
      catchT -= dt;
      if (catchT <= 0) dismissCatch();
    }

    if (msgT > 0) {
      msgT -= dt;
      if (msgT <= 0) msg = '';
    }

    // particles
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 380 * dt;
    }

    // fish shadows wander
    if (!reduceMotion()) {
      for (i = 0; i < shadows.length; i++) {
        var s = shadows[i];
        s.x += s.vx * dt;
        s.wob += dt * 1.4;
        s.y += Math.sin(s.wob) * 6 * dt;
        if (s.x < CAST_MIN_X - 40) { s.x = CAST_MIN_X - 40; s.vx = Math.abs(s.vx); }
        if (s.x > W - 12) { s.x = W - 12; s.vx = -Math.abs(s.vx); }
        s.y = clamp(s.y, WATER_Y + 40, H - 50);
      }
    }
  }

  // ---------- draw ----------
  function roundRect(x, y, w, h, r) {
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
    ctx.fillRect(0, 0, W, WATER_Y);
    // sun
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(528, 74, 34, 0, Math.PI * 2);
    ctx.fill();
    // clouds
    ctx.fillStyle = pal.cloud;
    var drift = reduceMotion() ? 0 : (animT * 6) % (W + 240);
    drawCloud(150 + drift * 0.4, 70, 1.1);
    drawCloud(380 + drift * 0.25 - 120, 110, 0.85);
  }

  function drawCloud(x, y, s) {
    if (x > W + 140) x -= (W + 280);
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 26 * s, y - 8 * s, 18 * s, 0, Math.PI * 2);
    ctx.arc(x + 52 * s, y, 20 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMountains() {
    ctx.fillStyle = pal.mtnFar;
    ctx.beginPath();
    ctx.moveTo(0, WATER_Y);
    ctx.lineTo(0, 210);
    ctx.lineTo(90, 150);
    ctx.lineTo(180, 208);
    ctx.lineTo(280, 138);
    ctx.lineTo(390, 205);
    ctx.lineTo(490, 148);
    ctx.lineTo(640, 212);
    ctx.lineTo(640, WATER_Y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.mtnNear;
    ctx.beginPath();
    ctx.moveTo(0, WATER_Y);
    ctx.lineTo(0, 236);
    ctx.lineTo(110, 196);
    ctx.lineTo(220, 240);
    ctx.lineTo(340, 188);
    ctx.lineTo(470, 242);
    ctx.lineTo(580, 200);
    ctx.lineTo(640, 238);
    ctx.lineTo(640, WATER_Y);
    ctx.closePath();
    ctx.fill();
  }

  function drawWater() {
    var g = ctx.createLinearGradient(0, WATER_Y, 0, H);
    g.addColorStop(0, pal.waterTop);
    g.addColorStop(1, pal.waterBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, WATER_Y, W, H - WATER_Y);

    ctx.strokeStyle = pal.wave;
    ctx.lineWidth = 2;
    var phase = reduceMotion() ? 0 : animT;
    for (var i = 0; i < 5; i++) {
      var y = WATER_Y + 16 + i * 38;
      ctx.globalAlpha = 0.5 - i * 0.06;
      ctx.beginPath();
      for (var x = 0; x <= W; x += 16) {
        var yy = y + Math.sin(x * 0.02 + phase * 1.6 + i) * 3;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawShore() {
    ctx.fillStyle = pal.shore;
    ctx.beginPath();
    ctx.moveTo(0, WATER_Y + 40);
    ctx.quadraticCurveTo(90, WATER_Y + 60, 150, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.shoreDark;
    ctx.beginPath();
    ctx.moveTo(0, WATER_Y + 78);
    ctx.quadraticCurveTo(60, WATER_Y + 100, 96, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // reeds
    ctx.strokeStyle = pal.shoreDark;
    ctx.lineWidth = 3;
    for (var i = 0; i < 3; i++) {
      var rx = 24 + i * 16;
      ctx.beginPath();
      ctx.moveTo(rx, WATER_Y + 88 + i * 10);
      ctx.quadraticCurveTo(rx + 6, WATER_Y + 52, rx + 2, WATER_Y + 30 + i * 6);
      ctx.stroke();
    }
  }

  function drawAngler() {
    var ax = 96, ay = WATER_Y + 128;
    ctx.fillStyle = pal.angler;
    // legs
    ctx.fillRect(ax - 10, ay, 7, 34);
    ctx.fillRect(ax + 3, ay, 7, 34);
    // body
    roundRect(ax - 13, ay - 40, 26, 44, 8);
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.arc(ax, ay - 52, 11, 0, Math.PI * 2);
    ctx.fill();
    // arm + rod
    ctx.strokeStyle = pal.angler;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(ax + 8, ay - 30);
    ctx.lineTo(ROD_TIP_X - 40, ROD_TIP_Y + 28);
    ctx.stroke();

    var bend = state === 'reeling' ? 16 : 0;
    ctx.strokeStyle = pal.rod;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ROD_TIP_X - 40, ROD_TIP_Y + 28);
    ctx.quadraticCurveTo(ROD_TIP_X - 8, ROD_TIP_Y + 2 - bend, ROD_TIP_X, ROD_TIP_Y);
    ctx.stroke();
  }

  function drawShadows() {
    for (var i = 0; i < shadows.length; i++) {
      var s = shadows[i];
      drawFishShadow(s.x, s.y, s.size, s.vx >= 0 ? 1 : -1, pal.fishShadow);
    }
    // hooked fish shadow near bobber
    if ((state === 'reeling' || state === 'bite') && fish) {
      var bx = bobberX(), by = WATER_Y + 30;
      drawFishShadow(bx + Math.sin(fightT * 4) * 10, by, 20 + fish.weight * 0.25, 1, pal.fishShadow);
    }
  }

  function drawFishShadow(x, y, size, dir, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.9, 0);
    ctx.lineTo(-size * 1.45, -size * 0.32);
    ctx.lineTo(-size * 1.45, size * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function bobberX() {
    if (state === 'casting') {
      return ROD_TIP_X + (landX - ROD_TIP_X) * castT;
    }
    if (state === 'idle' || state === 'charging' || state === 'menu' || state === 'gameover') {
      return ROD_TIP_X;
    }
    return landX;
  }

  function bobberY() {
    if (state === 'casting') {
      return ROD_TIP_Y + (WATER_Y + 6 - ROD_TIP_Y) * castT - Math.sin(castT * Math.PI) * 110;
    }
    if (state === 'idle' || state === 'charging' || state === 'menu' || state === 'gameover') {
      return ROD_TIP_Y;
    }
    var bob = reduceMotion() ? 0 : Math.sin(animT * 2.2) * 2.5;
    var dip = state === 'bite' ? (10 + Math.sin(animT * 18) * 3) : 0;
    if (state === 'reeling') {
      var pull = 0.5 + 0.5 * Math.sin(fightT * 4 + fightPhase);
      return WATER_Y + 8 + bob + dip + pull * 10;
    }
    return WATER_Y + 6 + bob + dip;
  }

  function drawLine() {
    var bx = bobberX(), by = bobberY();
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ROD_TIP_X, ROD_TIP_Y);
    if (state === 'reeling' && tension > 40) {
      ctx.lineTo(bx, by);
    } else {
      ctx.quadraticCurveTo((ROD_TIP_X + bx) / 2, (ROD_TIP_Y + by) / 2 + 34, bx, by);
    }
    ctx.stroke();

    // bobber
    ctx.fillStyle = pal.bobber;
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.bobberTop;
    ctx.beginPath();
    ctx.arc(bx, by - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles() {
    ctx.fillStyle = pal.wave;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(p.life / p.maxLife, 0);
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawBar(x, y, w, h, ratio, fill) {
    ctx.fillStyle = pal.barTrack;
    roundRect(x, y, w, h, h / 2);
    ctx.fill();
    if (ratio > 0) {
      ctx.fillStyle = fill;
      roundRect(x, y, Math.max(h, w * clamp(ratio, 0, 1)), h, h / 2);
      ctx.fill();
    }
  }

  function drawHUD() {
    var i;

    // floating hints
    if (state === 'idle' || state === 'charging') {
      drawHint(t('holdHint'));
      // power bar
      var pw = 260;
      drawBar((W - pw) / 2, H - 52, pw, 14, power, pal.barFill);
    } else if (state === 'waiting') {
      drawHint(t('waitHint'));
    } else if (state === 'bite') {
      drawHint(t('biteAlert'), true);
    } else if (state === 'reeling') {
      // tension + progress bars
      var bw = 300, bx = (W - bw) / 2, by = H - 64;
      var limit = 100 + 25 * gear.line;
      var ratio = tension / limit;
      var col = ratio < 0.55 ? pal.barGood : (ratio < 0.8 ? pal.barWarn : pal.barBad);
      ctx.fillStyle = pal.popupText;
      ctx.font = '600 12px "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('statusReel'), bx, by - 10);
      drawBar(bx, by, bw, 14, ratio, col);
      drawBar(bx, by + 26, bw, 14, progress / 100, pal.barFill);
      ctx.fillStyle = pal.popupMuted;
      ctx.font = '12px "Segoe UI", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(progress) + '%', bx + bw, by + 46);
    }

    // message line
    if (msg && state !== 'bite') {
      drawHint(msg);
    }

    // catch popup
    if (state === 'caught' && fish) drawCatchPopup();
  }

  function drawHint(text, pulse) {
    var w = 320, h = 34;
    var x = (W - w) / 2, y = H * 0.18;
    ctx.fillStyle = pal.popupBg;
    roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.fillStyle = pulse && !reduceMotion() && Math.sin(animT * 8) > 0 ? pal.barBad : pal.popupText;
    ctx.font = '600 15px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, y + h / 2 + 1);
  }

  function drawCatchPopup() {
    var spec = RARITY[fish.rarity];
    var w = 320, h = 172;
    var x = (W - w) / 2, y = (H - h) / 2;
    ctx.fillStyle = pal.popupBg;
    roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = 3;
    roundRect(x, y, w, h, 14);
    ctx.stroke();

    ctx.fillStyle = pal.popupMuted;
    ctx.font = '600 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('catchTitle'), W / 2, y + 26);

    ctx.fillStyle = spec.color;
    ctx.font = 'bold 24px "Segoe UI", sans-serif';
    ctx.fillText(t(spec.nameKey), W / 2, y + 58);

    ctx.fillStyle = pal.popupText;
    ctx.font = '600 26px "Segoe UI", sans-serif';
    ctx.fillText(fish.weight.toFixed(1) + ' kg', W / 2, y + 94);

    ctx.fillStyle = pal.popupMuted;
    ctx.font = '13px "Segoe UI", sans-serif';
    ctx.fillText(t('gainCoins'), W / 2, y + 122);
    ctx.fillStyle = pal.barWarn;
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.fillText('+' + GamePlatform.util.formatNumber(Math.round(fish.weight * spec.price)), W / 2, y + 146);
  }

  function draw() {
    fit(canvas, ctx, W, H);
    drawSky();
    drawMountains();
    drawWater();
    drawShadows();
    drawShore();
    drawAngler();
    drawLine();
    drawParticles();
    drawHUD();
  }

  // ---------- HUD / overlays / i18n ----------
  function updateHUD() {
    document.getElementById('hud-coins').textContent = GamePlatform.util.formatNumber(coins);
    document.getElementById('hud-best').textContent = bestWeight > 0 ? bestWeight.toFixed(1) + ' kg' : '0 kg';
    document.getElementById('hud-count').textContent = String(runCount);
    document.getElementById('hud-state').textContent = statusText();
  }

  function showOverlay(id) {
    var ids = ['ov-menu', 'ov-pause', 'ov-gameover'];
    for (var i = 0; i < ids.length; i++) {
      document.getElementById(ids[i]).hidden = ids[i] !== id;
    }
  }
  function hideOverlays() { showOverlay(''); }

  function updateShop() {
    for (var i = 0; i < GEAR_KEYS.length; i++) {
      var key = GEAR_KEYS[i];
      var lv = gear[key];
      document.getElementById('lv-' + key).textContent = 'Lv.' + lv;
      var btn = document.getElementById('buy-' + key);
      if (lv >= 3) {
        btn.textContent = t('maxed');
        btn.disabled = true;
      } else {
        btn.textContent = t('buy') + ' ' + GEAR_COST[lv];
        btn.disabled = false;
      }
    }
  }

  function updateMenuRecords() {
    document.getElementById('menu-best-weight').textContent = bestWeight > 0 ? bestWeight.toFixed(1) + ' kg' : '0 kg';
    document.getElementById('menu-best-coins').textContent = GamePlatform.util.formatNumber(bestCoins);
    document.getElementById('menu-best-legend').textContent = String(legendCount);
  }

  function applyLang() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      if (STR[key]) nodes[i].textContent = t(key);
    }
    updateShop();
    updateMenuRecords();
    updateHUD();
  }

  function buyGear(key) {
    var lv = gear[key];
    if (lv >= 3) return;
    var cost = GEAR_COST[lv];
    if (coins < cost) {
      toast('needCoins');
      return;
    }
    coins -= cost;
    gear[key] = lv + 1;
    saveGear();
    FS.audio.play('coin');
    toast('bought');
    updateShop();
    updateHUD();
  }

  // ---------- input ----------
  function press() {
    FS.audio.unlock();
    if (state === 'menu') return;
    if (state === 'idle') {
      state = 'charging';
      power = 0;
      holding = true;
      updateHUD();
    } else if (state === 'charging') {
      holding = true;
    } else if (state === 'bite') {
      hookFish();
    } else if (state === 'reeling') {
      holding = true;
    } else if (state === 'caught') {
      dismissCatch();
    }
  }

  function release() {
    if (state === 'charging') {
      doCast();
    } else if (state === 'reeling') {
      holding = false;
    }
  }

  function togglePause() {
    if (state === 'paused') {
      state = resumeState;
      hideOverlays();
      updateHUD();
      return;
    }
    if (state === 'idle' || state === 'charging' || state === 'casting' ||
        state === 'waiting' || state === 'bite' || state === 'reeling') {
      resumeState = state;
      holding = false;
      state = 'paused';
      showOverlay('ov-pause');
      updateHUD();
    }
  }

  function bindInput() {
    canvas.addEventListener('mousedown', function (e) {
      e.preventDefault();
      press();
    });
    window.addEventListener('mouseup', function () {
      release();
    });
    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      press();
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
      e.preventDefault();
      release();
    }, { passive: false });

    document.addEventListener('keydown', function (e) {
      FS.audio.unlock();
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (e.repeat) return;
        if (state === 'menu') { startGame(); return; }
        press();
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (e.repeat) return;
        e.preventDefault();
        togglePause();
      }
    });
    document.addEventListener('keyup', function (e) {
      if (e.key === ' ' || e.key === 'Spacebar') release();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && state !== 'paused' && state !== 'menu' && state !== 'gameover') {
        togglePause();
      }
    });

    document.addEventListener('pointerdown', function () { FS.audio.unlock(); }, { once: true });

    document.getElementById('btn-home').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-pause').onclick = function () { GamePlatform.navigate.goHome(); };
    document.getElementById('btn-home-go').onclick = function () { GamePlatform.navigate.goHome(); };

    document.getElementById('btn-start').onclick = function () {
      FS.audio.unlock();
      startGame();
    };
    document.getElementById('btn-clear').onclick = function () {
      coins = 0;
      bestWeight = 0;
      bestCoins = 0;
      legendCount = 0;
      gear = { rod: 0, line: 0, bait: 0 };
      saveBest();
      saveGear();
      updateShop();
      updateMenuRecords();
      updateHUD();
      toast('cleared');
    };
    document.getElementById('btn-pause').onclick = togglePause;
    document.getElementById('btn-resume').onclick = togglePause;
    document.getElementById('btn-restart-pause').onclick = function () {
      hideOverlays();
      startGame();
    };
    document.getElementById('btn-endrun').onclick = function () {
      hideOverlays();
      endRun();
    };
    document.getElementById('btn-again-go').onclick = function () {
      hideOverlays();
      startGame();
    };
    document.getElementById('btn-fullscreen').onclick = function () {
      if (GamePlatform.ui.isFullscreen()) GamePlatform.ui.exitFullscreen();
      else GamePlatform.ui.requestFullscreen();
    };

    document.getElementById('buy-rod').onclick = function () { buyGear('rod'); };
    document.getElementById('buy-line').onclick = function () { buyGear('line'); };
    document.getElementById('buy-bait').onclick = function () { buyGear('bait'); };
  }

  // ---------- main loop ----------
  var lastTs = 0;
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 1 / 30);
    lastTs = ts;
    if (state !== 'paused' && state !== 'menu' && state !== 'gameover') {
      animT += dt;
      update(dt);
    }
    draw();
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  function init() {
    rebuildPal();
    loadStore();
    initShadows();
    state = 'menu';
    showOverlay('ov-menu');
    updateShop();
    updateMenuRecords();
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

  FS.game = {
    get state() { return state; },
    get coins() { return coins; }
  };

  /* ------------------------------------------------------------ */
  /* 修改器钩子（暗号 potato4096，见 platform/cheat-kit.js）        */
  /* ------------------------------------------------------------ */

  function cheatNowBite() {
    if (state === 'waiting') {
      waitT = 0.01;
    } else if (state === 'casting') {
      forceBite = true;
    } else if (state === 'idle' || state === 'charging') {
      forceBite = true;
      power = 1;
      doCast();
    } else if (state === 'bite') {
      hookFish();
    } else {
      toast('cheatNoBite');
      return;
    }
    toast('cheatBit');
  }

  function cheatCatchLegend() {
    if (state === 'caught') dismissCatch();
    hideOverlays();
    fish = { rarity: 3, weight: Math.round(rand(28, 82) * 10) / 10 };
    tension = 0;
    progress = 0;
    holding = false;
    landFish();
  }

  function cheatCoinsAdd() {
    coins += 1000;
    if (coins > bestCoins) bestCoins = coins;
    saveBest();
    saveGear();
    updateHUD();
    updateShop();
  }

  function cheatGearMax() {
    gear = { rod: 3, line: 3, bait: 3 };
    saveGear();
    updateShop();
  }

  if (window.CheatKit) {
    CheatKit.init({
      id: 'fishing',
      title: STR.cheatTitle,
      hint: STR.cheatHint,
      stats: [
        { label: STR.coins, get: function () { return coins; }, format: function (v) { return GamePlatform.util.formatNumber(v); } },
        { label: { zh: '当前鱼稀有度', en: 'Current rarity' },
          get: function () { return fish ? t(RARITY[fish.rarity].nameKey) : '-'; } },
        { label: { zh: '当前重量', en: 'Current weight' },
          get: function () { return fish ? fish.weight.toFixed(1) + ' kg' : '-'; } },
        { label: STR.recWeight,
          get: function () { return bestWeight.toFixed(1) + ' kg'; }, tone: 'success' },
        { label: STR.caught, get: function () { return runCount; }, tone: 'warning' },
        { label: STR.status, get: statusText }
      ],
      params: [
        { key: 'coins', label: STR.coins, min: 0, max: 999999, step: 100,
          get: function () { return coins; },
          set: function (v) {
            coins = Math.max(0, Math.round(v));
            if (coins > bestCoins) bestCoins = coins;
            saveBest();
            saveGear();
            updateHUD();
            updateShop();
          } },
        { key: 'biteSpeed', label: { zh: '咬钩速度(0-100)', en: 'Bite speed (0-100)' }, min: 0, max: 100, step: 5,
          get: function () { return cheatBiteSpeed; },
          set: function (v) { cheatBiteSpeed = clamp(Math.round(v), 0, 100); } },
        { key: 'reelPower', label: { zh: '拉杆力量(0-100)', en: 'Reel power (0-100)' }, min: 0, max: 100, step: 5,
          get: function () { return cheatReelPower; },
          set: function (v) { cheatReelPower = clamp(Math.round(v), 0, 100); } }
      ],
      toggles: [
        { label: STR.cheatTglBite, on: STR.cheatTglBiteOn, off: STR.cheatTglBiteOff,
          get: function () { return cheatBite; },
          set: function (v) { cheatBite = !!v; } },
        { label: STR.cheatTglLegend, on: STR.cheatTglLegendOn, off: STR.cheatTglLegendOff,
          get: function () { return cheatLegend; },
          set: function (v) { cheatLegend = !!v; } },
        { label: STR.cheatTglTension, on: STR.cheatTglTensionOn, off: STR.cheatTglTensionOff,
          get: function () { return cheatNoRise; },
          set: function (v) {
            cheatNoRise = !!v;
            if (cheatNoRise) tension = 0;
          } }
      ],
      actions: [
        { label: { zh: '立即上钩', en: 'Instant bite' }, run: cheatNowBite },
        { label: { zh: '钓一条传说鱼', en: 'Catch a legend' }, run: cheatCatchLegend, toast: STR.cheatLegendCaught },
        { label: { zh: '金币+1000', en: 'Coins +1000' }, run: cheatCoinsAdd, toast: STR.cheatCoins },
        { label: { zh: '渔具全满级', en: 'Max all gear' }, run: cheatGearMax, toast: STR.cheatGearMax },
        { label: { zh: '重开本局', en: 'Restart run' }, run: startGame, toast: STR.cheatRestart }
      ]
    });
  }
})();
