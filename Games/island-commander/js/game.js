/* island-commander - 海岛奇兵 : base building + campaign counterattack */
(function () {
  'use strict';

  // ---------- i18n ----------
  var STR = {
    home: { zh: '返回主页', en: 'Home' },
    pauseBtn: { zh: '暂停', en: 'Pause' },
    fullscreen: { zh: '全屏', en: 'Fullscreen' },
    title: { zh: '海岛奇兵', en: 'Island Commander' },
    tagline: {
      zh: '蓝军兵败中原，退守东南小岛。经营积蓄力量，挥师反攻，统一中原！',
      en: 'Defeated on the mainland, Blue retreats to a southeastern island. Build up, strike back, reunify the realm!'
    },
    bestWave: { zh: '最高战绩', en: 'Best campaign' },
    start: { zh: '开始游戏', en: 'Start' },
    continueSave: { zh: '继续游戏', en: 'Continue' },
    newGame: { zh: '开始新游戏', en: 'New game' },
    saveRestored: { zh: '已恢复上次进度', en: 'Progress restored' },
    clearRecords: { zh: '清除记录', en: 'Clear records' },
    paused: { zh: '已暂停', en: 'Paused' },
    resume: { zh: '继续游戏', en: 'Resume' },
    restart: { zh: '重新开始', en: 'Restart' },
    gameOver: { zh: '海岛失守', en: 'Island Lost' },
    victory: { zh: '统一中原！', en: 'Realm Reunified!' },
    victorySub: {
      zh: '红旗落下，中原重归蓝军治下。班师回朝！',
      en: 'The red banner falls. The realm is Blue again - glory!'
    },
    again: { zh: '再玩一次', en: 'Play again' },
    reachStage: { zh: '反攻进度', en: 'Campaign progress' },
    elapsed: { zh: '用时', en: 'Time' },
    best: { zh: '最佳纪录', en: 'Best time' },
    food: { zh: '食粮', en: 'Food' },
    gold: { zh: '金币', en: 'Gold' },
    army: { zh: '兵力', en: 'Army' },
    hq: { zh: '大本营', en: 'Headquarters' },
    tabBuild: { zh: '经营', en: 'Develop' },
    tabWar: { zh: '出征', en: 'Campaign' },
    buildings: { zh: '建筑', en: 'Buildings' },
    buildHint: { zh: '点选后在岛上空地放下', en: 'Pick, then tap a free island tile' },
    units: { zh: '兵种', en: 'Units' },
    trainHint: { zh: '点击招募', en: 'Tap to recruit' },
    campaign: { zh: '反攻路线', en: 'Counterattack route' },
    warHint: { zh: '点选出征，自动战斗结算', en: 'Pick a target - battle auto-resolves' },
    armySummary: { zh: '远征军', en: 'Expeditionary force' },
    controls: {
      zh: '操作：点击 / 触摸选择建筑与兵种，点选建筑后点击岛上空地建造；出征页点目标自动战斗。红方每 90 秒反扑一次，防住可缴获资源。Esc / P 暂停。',
      en: 'Controls: click / tap to pick buildings & units, then tap a free island tile to build; pick a campaign target to auto-battle. Red raids every 90s - hold the island for loot. Esc / P to pause.'
    },
    cancel: { zh: '取消', en: 'Cancel' },
    level: { zh: '等级', en: 'Level' },
    upgrade: { zh: '升级', en: 'Upgrade' },
    defend: { zh: '防线', en: 'Defense line' },
    raidIn: { zh: '红军反扑', en: 'Red raid' },
    raidSoon: { zh: '红军即将反扑！', en: 'Red raid incoming!' },
    raidWin: { zh: '击退红军反扑，缴获资源！', en: 'Raid repelled - loot secured!' },
    raidLose: { zh: '防线被突破，资源遭洗劫！', en: 'Defense broken - resources plundered!' },
    linesDown: { zh: '防线告破！', en: 'Defense line lost!' },
    marchGo: { zh: '远征军出征：', en: 'Army marching on ' },
    marchWin: { zh: '大捷！已攻占：', en: 'Victory! Captured: ' },
    marchLose: { zh: '进攻受挫，部队溃散', en: 'Assault repelled - forces scattered' },
    needArmy: { zh: '至少需要 3 名士兵才能出征', en: 'You need at least 3 soldiers to march' },
    armyFull: { zh: '兵力已达上限', en: 'Army is at capacity' },
    marchBusy: { zh: '远征军尚未回岛', en: 'Army is still out on campaign' },
    notEnough: { zh: '资源不足', en: 'Not enough resources' },
    needHq: { zh: '需要大本营等级', en: 'Requires HQ level' },
    needBld: { zh: '需要先建造', en: 'Requires building' },
    placing: { zh: '建造中：点击岛上空地放置，Esc 取消', en: 'Placing: tap a free island tile (Esc cancels)' },
    built: { zh: '建造完成：', en: 'Built: ' },
    trained: { zh: '招募：', en: 'Recruited: ' },
    upgraded: { zh: '大本营升级至 Lv.', en: 'HQ upgraded to Lv.' },
    storageFull: { zh: '仓库已满，无法继续产出', en: 'Storage full - production stalled' },
    hqName: { zh: '大本营', en: 'HQ' },
    hqDesc: { zh: '升级解锁更多建筑，提升兵力上限', en: 'Upgrade to unlock buildings & army cap' },
    victoryBest: { zh: '新纪录！', en: 'New record!' }
  };
  function t(k) {
    if (k && typeof k === 'object') return GamePlatform.i18n.t(k);
    return GamePlatform.i18n.t(STR[k] || { zh: k, en: k });
  }

  // ---------- static data ----------
  var UNITS = {
    militia: { zh: '民兵', en: 'Militia', food: 25, gold: 0, atk: 10, hp: 30, spd: 1.1, need: null },
    shield: { zh: '盾兵', en: 'Shield', food: 45, gold: 15, atk: 9, hp: 72, spd: 0.85, need: null },
    archer: { zh: '弓兵', en: 'Archer', food: 38, gold: 32, atk: 19, hp: 28, spd: 1.05, need: 'range' },
    cavalry: { zh: '骑兵', en: 'Cavalry', food: 70, gold: 55, atk: 25, hp: 55, spd: 1.5, need: 'stable' },
    ram: { zh: '冲车', en: 'Ram', food: 95, gold: 80, atk: 35, hp: 85, spd: 0.7, need: 'workshop' }
  };
  var UNIT_KEYS = ['militia', 'shield', 'archer', 'cavalry', 'ram'];

  var BUILDINGS = {
    farm: { zh: '农田', en: 'Farm', food: 0, gold: 40, foodRate: 3, goldRate: 0, hq: 1 },
    mine: { zh: '金矿', en: 'Gold Mine', food: 45, gold: 0, foodRate: 0, goldRate: 2.2, hq: 1 },
    barracks: { zh: '兵营', en: 'Barracks', food: 70, gold: 55, foodRate: 0, goldRate: 0, cap: 10, hq: 1 },
    depot: { zh: '仓库', en: 'Depot', food: 55, gold: 35, foodRate: 0, goldRate: 0, maxFood: 250, maxGold: 200, hq: 1 },
    tower: { zh: '箭塔', en: 'Arrow Tower', food: 55, gold: 75, foodRate: 0, goldRate: 0, defend: 130, hq: 2 },
    range: { zh: '靶场', en: 'Archery Range', food: 80, gold: 90, foodRate: 0, goldRate: 0, unlock: 'archer', hq: 2 },
    stable: { zh: '马厩', en: 'Stable', food: 95, gold: 85, foodRate: 0, goldRate: 0, unlock: 'cavalry', hq: 2 },
    workshop: { zh: '工坊', en: 'Workshop', food: 110, gold: 110, foodRate: 0, goldRate: 0, unlock: 'ram', hq: 3 }
  };
  var BUILD_KEYS = ['farm', 'mine', 'barracks', 'depot', 'tower', 'range', 'stable', 'workshop'];

  var STAGES = [
    { zh: '渔村', en: 'Fishing Village', power: 220, food: 180, gold: 120, x: 585, y: 168 },
    { zh: '枫桥镇', en: 'Maple Bridge', power: 480, food: 300, gold: 230, x: 482, y: 128 },
    { zh: '铁门关', en: 'Iron Gate Pass', power: 900, food: 430, gold: 360, x: 378, y: 100 },
    { zh: '临江城', en: 'Riverhold', power: 1500, food: 580, gold: 520, x: 272, y: 82 },
    { zh: '洛京', en: 'Luojing', power: 2400, food: 800, gold: 740, x: 168, y: 66 },
    { zh: '中原·决战', en: 'Central Plains', power: 3400, food: 1100, gold: 1000, x: 66, y: 54 }
  ];

  var RAID_INTERVAL = 90;
  var HQ_MAX = 5;

  // island building grid (5 x 4 on the island)
  var GRID_COLS = 5, GRID_ROWS = 4, CELL = 54;
  var GRID_X = 452, GRID_Y = 206;

  // ---------- palette (nature scene + theme blend) ----------
  var WORLD = {
    light: {
      seaTop: '#7fc4e8', seaBottom: '#3d86c8', wave: '#bfe4f7',
      sand: '#f2d8a0', grass: '#7cc47f', grassDark: '#5aa962',
      mainland: '#c8b28a', mainlandEdge: '#a89468',
      route: '#ffffff', nodeFill: '#ffffff', nodeText: '#2c3e50',
      flagBlue: '#2f6fed', flagRed: '#d34040',
      cardBg: '#ffffff', cardEdge: '#2c3e50', gridLine: 'rgba(255,255,255,0.25)'
    },
    dark: {
      seaTop: '#1c3a5e', seaBottom: '#0f2440', wave: '#2c5580',
      sand: '#8a7448', grass: '#3d7a4a', grassDark: '#2c5c38',
      mainland: '#6b5c42', mainlandEdge: '#554832',
      route: '#c8d6e5', nodeFill: '#dfe6ee', nodeText: '#1c2733',
      flagBlue: '#5b8def', flagRed: '#e06060',
      cardBg: '#243447', cardEdge: '#9fb3c8', gridLine: 'rgba(255,255,255,0.14)'
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
    } catch (e) { return a; }
  }
  function rebuildPal() {
    var mode = GamePlatform.theme.get();
    var base = WORLD[mode] || WORLD.light;
    var packBg = null;
    try { packBg = GamePlatform.themePacks.colors().bg; } catch (e) { /* fallback */ }
    pal = {};
    for (var k in base) pal[k] = base[k];
    if (packBg) {
      pal.seaTop = mix(base.seaTop, packBg, 0.22);
      pal.seaBottom = mix(base.seaBottom, packBg, 0.18);
    }
  }

  // ---------- dom ----------
  var canvas, ctx;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- game state ----------
  var state = 'menu'; // menu | playing | paused | gameover | victory
  var G = null;

  function newGame() {
    return {
      food: 220, gold: 160,
      hq: 1,
      grid: {},            // "c,r" -> building key
      units: { militia: 0, shield: 0, archer: 0, cavalry: 0, ram: 0 },
      captured: [],        // captured stage indexes
      hqLines: 3,
      time: 0,
      raidTimer: RAID_INTERVAL,
      march: null,         // { idx, timer, total }
      placing: null,       // building key awaiting a tile
      banner: { text: '', t: 0 },
      flashes: []          // battle flash particles at nodes
    };
  }

  // ---------- persistence (localStorage auto-save) ----------
  var SAVE_KEY = 'save';
  var SAVE_VER = 1;

  function clearSave() {
    GamePlatform.storage.remove(SAVE_KEY);
  }

  function saveGame() {
    if (state !== 'playing' && state !== 'paused') return;
    GamePlatform.storage.set(SAVE_KEY, {
      v: SAVE_VER,
      food: G.food, gold: G.gold, hq: G.hq,
      grid: G.grid,
      units: G.units,
      captured: G.captured,
      hqLines: G.hqLines,
      time: G.time,
      raidTimer: G.raidTimer,
      march: G.march ? { idx: G.march.idx, total: G.march.total, timer: G.march.timer } : null,
      placing: G.placing
    });
  }

  function readSave() {
    var s = GamePlatform.storage.get(SAVE_KEY, null);
    if (!s || s.v !== SAVE_VER) return null;
    if (typeof s.food !== 'number' || typeof s.gold !== 'number') return null;
    if (!s.grid || typeof s.grid !== 'object') return null;
    if (!s.units || !Array.isArray(s.captured)) return null;
    return s;
  }

  function loadGame() {
    var s = readSave();
    if (!s) return false;
    var g = newGame();
    g.food = Math.max(0, s.food);
    g.gold = Math.max(0, s.gold);
    g.hq = Math.min(HQ_MAX, Math.max(1, s.hq | 0));
    for (var gk in s.grid) {
      var parts = gk.split(',');
      var c = parts[0] | 0, r = parts[1] | 0;
      var bkey = s.grid[gk];
      if (c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS && BUILDINGS[bkey]) {
        g.grid[c + ',' + r] = bkey;
      }
    }
    for (var i = 0; i < UNIT_KEYS.length; i++) {
      var uk = UNIT_KEYS[i];
      g.units[uk] = Math.max(0, s.units[uk] | 0);
    }
    g.captured = s.captured.filter(function (n) {
      return typeof n === 'number' && n >= 0 && n < STAGES.length;
    });
    g.hqLines = Math.min(3, Math.max(1, s.hqLines | 0));
    g.time = Math.max(0, s.time || 0);
    g.raidTimer = Math.max(1, s.raidTimer || RAID_INTERVAL);
    if (s.march && typeof s.march.idx === 'number' && s.march.idx >= 0 && s.march.idx < STAGES.length) {
      var total = Math.max(0.5, s.march.total || 7);
      g.march = {
        idx: s.march.idx | 0,
        total: total,
        timer: Math.min(total, Math.max(0, s.march.timer || total))
      };
    }
    if (s.placing && BUILDINGS[s.placing]) g.placing = s.placing;
    G = g;
    return true;
  }

  // ---------- economy helpers ----------
  function capacity() {
    var f = 800 + (G.hq - 1) * 150, g = 640 + (G.hq - 1) * 120;
    for (var key in G.grid) {
      var b = BUILDINGS[G.grid[key]];
      if (b && b.maxFood) f += b.maxFood;
      if (b && b.maxGold) g += b.maxGold;
    }
    return { food: f, gold: g };
  }
  function armyCap() {
    var cap = 20 + (G.hq - 1) * 12;
    for (var key in G.grid) {
      var b = BUILDINGS[G.grid[key]];
      if (b && b.cap) cap += b.cap;
    }
    return cap;
  }
  function armyCount() {
    var n = 0;
    for (var i = 0; i < UNIT_KEYS.length; i++) n += G.units[UNIT_KEYS[i]];
    return n;
  }
  function islandDefense() {
    var d = 0;
    for (var key in G.grid) {
      var b = BUILDINGS[G.grid[key]];
      if (b && b.defend) d += b.defend;
    }
    return d;
  }
  function armyPower(army) {
    var p = 0;
    for (var i = 0; i < UNIT_KEYS.length; i++) {
      var k = UNIT_KEYS[i], u = UNITS[k];
      p += (army[k] || 0) * Math.sqrt(u.hp * u.atk);
    }
    return p;
  }
  function fullArmyPower() {
    // units out on march do not defend
    if (G.march) return islandDefense();
    return armyPower(G.units) + islandDefense();
  }
  function canAfford(cost) {
    return G.food >= (cost.food || 0) && G.gold >= (cost.gold || 0);
  }
  function pay(cost) {
    G.food -= (cost.food || 0);
    G.gold -= (cost.gold || 0);
  }
  function fmtCost(cost) {
    var parts = [];
    if (cost.food) parts.push(t('food') + ' ' + Math.round(cost.food));
    if (cost.gold) parts.push(t('gold') + ' ' + Math.round(cost.gold));
    return parts.join(' · ') || '—';
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function toast(key, extra) {
    try { GamePlatform.ui.toast(t(key) + (extra || '')); } catch (e) { /* ignore */ }
  }
  function banner(text) {
    G.banner.text = text;
    G.banner.t = 2.6;
  }

  // ---------- train / build ----------
  function trainUnit(key) {
    if (state !== 'playing') return;
    var u = UNITS[key];
    if (u.need && !hasBuilding(u.need)) {
      toast('needBld', '：' + t(BUILDINGS[u.need]));
      return;
    }
    if (armyCount() >= armyCap()) { toast('armyFull'); return; }
    if (!canAfford(u)) { toast('notEnough'); return; }
    pay(u);
    G.units[key]++;
    if (window.ICAudio) ICAudio.train();
    renderPanels();
    updateHUD();
    saveGame();
  }
  function findKeyOf(bkey) {
    for (var gk in G.grid) if (G.grid[gk] === bkey) return gk;
    return null;
  }
  function hasBuilding(bkey) {
    return !!findKeyOf(bkey);
  }

  function upgradeHQ() {
    if (state !== 'playing') return;
    if (G.hq >= HQ_MAX) return;
    var cost = { food: 220 * G.hq, gold: 180 * G.hq };
    if (!canAfford(cost)) { toast('notEnough'); return; }
    pay(cost);
    G.hq++;
    if (window.ICAudio) ICAudio.build();
    toast('upgraded', ' ' + G.hq);
    renderPanels();
    updateHUD();
    saveGame();
  }

  function selectBuilding(key) {
    if (state !== 'playing') return;
    var b = BUILDINGS[key];
    if (G.hq < b.hq) { toast('needHq', ' ' + b.hq); return; }
    G.placing = key;
    renderPanels();
    try { GamePlatform.ui.toast(t('placing')); } catch (e) { /* ignore */ }
  }

  function placeAt(c, r) {
    var key = G.placing;
    if (!key) return;
    if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return;
    var gk = c + ',' + r;
    if (G.grid[gk]) return;
    var b = BUILDINGS[key];
    if (G.hq < b.hq) { toast('needHq', ' ' + b.hq); G.placing = null; renderPanels(); return; }
    if (!canAfford(b)) { toast('notEnough'); G.placing = null; renderPanels(); return; }
    pay(b);
    G.grid[gk] = key;
    G.placing = null;
    if (window.ICAudio) ICAudio.build();
    toast('built', ' ' + t(b));
    renderPanels();
    updateHUD();
    saveGame();
  }

  // ---------- campaign ----------
  function launchMarch(idx) {
    if (state !== 'playing') return;
    if (G.march) { toast('marchBusy'); return; }
    if (armyCount() < 3) { toast('needArmy'); return; }
    if (G.captured.indexOf(idx) !== -1) return;
    if (idx > 0 && G.captured.indexOf(idx - 1) === -1) return;
    G.march = {
      idx: idx,
      total: 7 + idx * 2.5,
      timer: 7 + idx * 2.5
    };
    if (window.ICAudio) ICAudio.march();
    banner(t('marchGo') + t(STAGES[idx]));
    renderPanels();
    saveGame();
  }

  function resolveMarch() {
    var m = G.march;
    if (!m) return;
    var st = STAGES[m.idx];
    var mine = armyPower(G.units);
    var ratio = mine / Math.max(1, st.power);
    var win = ratio > 0.85;
    var losses = ratio >= 1.6 ? 0.08 : ratio >= 1.2 ? 0.18 : ratio >= 1.0 ? 0.3 :
      ratio >= 0.85 ? 0.5 : ratio >= 0.65 ? 0.8 : 1.0;
    applyLosses(losses);
    G.march = null;
    G.flashes.push({ x: st.x, y: st.y, t: 1.2, win: win });
    if (win) {
      G.captured.push(m.idx);
      G.food = Math.min(capacity().food, G.food + st.food);
      G.gold = Math.min(capacity().gold, G.gold + st.gold);
      if (window.ICAudio) ICAudio.clash();
      banner(t('marchWin') + t(st));
      if (m.idx === STAGES.length - 1) {
        winGame();
        return;
      }
    } else {
      if (window.ICAudio) ICAudio.lose();
      banner(t('marchLose'));
    }
    renderPanels();
    updateHUD();
    saveGame();
  }

  function applyLosses(frac) {
    for (var i = 0; i < UNIT_KEYS.length; i++) {
      var k = UNIT_KEYS[i];
      var lose = Math.ceil(G.units[k] * frac);
      G.units[k] = Math.max(0, G.units[k] - lose);
    }
  }

  // ---------- raids ----------
  function raidPower() {
    return 200 + G.captured.length * 160 + G.time * 1.5;
  }
  function resolveRaid() {
    var mine = fullArmyPower();
    var theirs = raidPower() * (0.9 + Math.random() * 0.2);
    var ratio = mine / Math.max(1, theirs);
    if (ratio > 0.85) {
      var loot = 60 + G.captured.length * 40;
      G.food = Math.min(capacity().food, G.food + loot);
      G.gold = Math.min(capacity().gold, G.gold + loot * 0.8);
      applyLosses(ratio >= 1.4 ? 0.06 : 0.16);
      if (window.ICAudio) ICAudio.clash();
      toast('raidWin');
      banner(t('raidWin'));
    } else {
      applyLosses(0.5);
      G.food *= 0.55;
      G.gold *= 0.55;
      G.hqLines--;
      if (window.ICAudio) ICAudio.raid();
      toast('raidLose');
      banner(t('linesDown'));
      if (G.hqLines <= 0) {
        loseGame();
        return;
      }
    }
    updateHUD();
    saveGame();
  }

  // ---------- flow ----------
  function startGame() {
    G = newGame();
    state = 'playing';
    hideOverlays();
    renderPanels();
    updateHUD();
    saveGame();
  }
  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    showOverlay('ov-pause');
    saveGame();
  }
  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    hideOverlays();
  }
  function loseGame() {
    state = 'gameover';
    clearSave();
    if (window.ICAudio) ICAudio.lose();
    $('go-stage').textContent = G.captured.length + '/' + STAGES.length;
    $('go-time').textContent = fmtTime(G.time);
    var bestStage = GamePlatform.storage.get('best_stage', 0) || 0;
    if (G.captured.length > bestStage) GamePlatform.storage.set('best_stage', G.captured.length);
    showOverlay('ov-gameover');
  }
  function winGame() {
    state = 'victory';
    clearSave();
    if (window.ICAudio) ICAudio.win();
    var bestMs = GamePlatform.storage.get('best_time', 0) || 0;
    var ms = Math.round(G.time * 1000);
    var isRecord = !bestMs || ms < bestMs;
    if (isRecord) GamePlatform.storage.set('best_time', ms);
    GamePlatform.storage.set('best_stage', STAGES.length);
    $('vi-time').textContent = fmtTime(G.time);
    $('vi-best').textContent = isRecord ? t('victoryBest') : fmtTime(bestMs / 1000);
    showOverlay('ov-victory');
    renderPanels();
  }

  function showOverlay(id) {
    hideOverlays();
    var el = $(id);
    if (el) el.hidden = false;
  }
  function hideOverlays() {
    var list = ['ov-menu', 'ov-pause', 'ov-gameover', 'ov-victory'];
    for (var i = 0; i < list.length; i++) {
      var el = $(list[i]);
      if (el) el.hidden = true;
    }
  }

  // ---------- panels (DOM) ----------
  var panelSig = '';
  var pointerIsDown = false;
  var saveAcc = 0;

  function computeSig() {
    // hash of everything the cards display: only re-render when a button state/count changes
    var parts = [G.hq, G.placing || '-', G.hq >= HQ_MAX ? 1 : (canAfford({ food: 220 * G.hq, gold: 180 * G.hq }) ? 1 : 0), G.march ? G.march.idx : '-'];
    for (var i = 0; i < BUILD_KEYS.length; i++) {
      var b = BUILDINGS[BUILD_KEYS[i]];
      parts.push(G.hq < b.hq ? 2 : (canAfford(b) ? 1 : 0));
    }
    for (var j = 0; j < UNIT_KEYS.length; j++) {
      var u = UNITS[UNIT_KEYS[j]];
      parts.push(G.units[UNIT_KEYS[j]]);
      parts.push((!u.need || hasBuilding(u.need)) && canAfford(u) && armyCount() < armyCap() ? 1 : 0);
    }
    for (var s = 0; s < STAGES.length; s++) {
      var st = STAGES[s];
      parts.push(G.captured.indexOf(s) !== -1 ? 2 :
        (s === 0 || G.captured.indexOf(s - 1) !== -1 ? (armyPower(G.units) > st.power * 0.85 ? 1 : 0) : 0));
    }
    return parts.join('|');
  }

  function renderPanels() {
    if (!G) return;
    renderBuildGrid();
    renderUnitGrid();
    renderStageList();
    renderRaidInfo();
    panelSig = computeSig();
  }

  function renderBuildGrid() {
    var host = $('build-grid');
    if (!host) return;
    var html = '';
    // HQ upgrade card
    var hqCost = { food: 220 * G.hq, gold: 180 * G.hq };
    var hqMaxed = G.hq >= HQ_MAX;
    html += '<button class="cmd-card' + (hqMaxed ? ' disabled' : '') + '" data-act="hq">' +
      '<span class="card-name">🏛 ' + t('hqName') + ' Lv.' + G.hq + '</span>' +
      '<span class="card-cost">' + (hqMaxed ? 'MAX' : fmtCost(hqCost)) + '</span>' +
      '<span class="card-extra">' + t('hqDesc') + '</span></button>';
    for (var i = 0; i < BUILD_KEYS.length; i++) {
      var key = BUILD_KEYS[i], b = BUILDINGS[key];
      var locked = G.hq < b.hq;
      var sel = G.placing === key;
      var afford = canAfford(b);
      var cls = 'cmd-card' + (locked ? ' locked' : (sel ? ' selected' : (afford ? '' : ' disabled')));
      var costTxt = locked ? t('needHq') + ' ' + b.hq : fmtCost(b);
      var extra = b.foodRate ? '+' + b.foodRate + ' ' + t('food') + '/s'
        : b.goldRate ? '+' + b.goldRate + ' ' + t('gold') + '/s'
          : b.defend ? '+' + b.defend + ' ' + t('defend')
            : b.cap ? '+' + b.cap + ' ' + t('army')
              : b.unlock ? t(UNITS[b.unlock]) + ' ✔'
                : '+' + b.maxFood + ' ' + t('food') + ' +' + b.maxGold + ' ' + t('gold');
      html += '<button class="' + cls + '" data-act="build" data-key="' + key + '">' +
        '<span class="card-name">' + t(b) + '</span>' +
        '<span class="card-cost">' + costTxt + '</span>' +
        '<span class="card-extra">' + extra + '</span></button>';
    }
    host.innerHTML = html;
  }

  function renderUnitGrid() {
    var host = $('unit-grid');
    if (!host) return;
    var html = '';
    for (var i = 0; i < UNIT_KEYS.length; i++) {
      var key = UNIT_KEYS[i], u = UNITS[key];
      var needOk = !u.need || hasBuilding(u.need);
      var afford = canAfford(u);
      var full = armyCount() >= armyCap();
      var cls = 'cmd-card' + (!needOk ? ' locked' : (afford && !full ? '' : ' disabled'));
      var costTxt = !needOk ? t('needBld') + ' ' + t(UNITS[u.need]) : fmtCost(u);
      html += '<button class="' + cls + '" data-act="train" data-key="' + key + '">' +
        '<span class="card-name">' + t(u) + ' ×' + G.units[key] + '</span>' +
        '<span class="card-cost">' + costTxt + '</span>' +
        '<span class="card-extra">⚔' + u.atk + ' ♥' + u.hp + '</span></button>';
    }
    host.innerHTML = html;
  }

  function renderStageList() {
    var host = $('stage-list');
    if (!host) return;
    var html = '';
    for (var i = 0; i < STAGES.length; i++) {
      var st = STAGES[i];
      var done = G.captured.indexOf(i) !== -1;
      var open = i === 0 || G.captured.indexOf(i - 1) !== -1;
      var mine = armyPower(G.units);
      var canWin = mine > st.power * 0.85;
      var cls = 'cmd-card' + (done ? ' selected' : (!open ? ' locked' : (canWin ? '' : ' disabled')));
      html += '<button class="' + cls + '" data-act="march" data-key="' + i + '">' +
        '<span class="card-name">' + (done ? '✅ ' : open ? '🚩 ' : '🔒 ') + t(st) + '</span>' +
        '<span class="card-cost">' + t('defend') + ' ' + Math.round(st.power) + '</span>' +
        '<span class="card-extra">' + (done ? '—' : fmtCost({ food: st.food, gold: st.gold })) + '</span></button>';
    }
    host.innerHTML = html;
    var sum = $('army-summary');
    if (sum) {
      var parts = [];
      for (var j = 0; j < UNIT_KEYS.length; j++) {
        var k = UNIT_KEYS[j];
        if (G.units[k]) parts.push(t(UNITS[k]) + ' ×' + G.units[k]);
      }
      parts.push('⚔ ' + Math.round(armyPower(G.units)));
      if (G.march) parts.push(t('marchBusy'));
      sum.textContent = parts.join('  ·  ') || '—';
    }
  }

  function renderRaidInfo() {
    var el = $('raid-info');
    if (!el) return;
    if (G.march) {
      el.textContent = t('marchBusy') + ' (' + fmtTime(G.march.timer) + ')';
    } else {
      el.textContent = t('raidIn') + ' ' + fmtTime(G.raidTimer) + '  ·  ' +
        t('defend') + ' ' + G.hqLines + '/3';
    }
  }

  function updateHUD() {
    if (!G) return;
    var cap = capacity();
    $('hud-food').textContent = Math.floor(G.food) + '/' + cap.food;
    $('hud-gold').textContent = Math.floor(G.gold) + '/' + cap.gold;
    $('hud-army').textContent = armyCount() + '/' + armyCap();
    $('hud-hq').textContent = 'Lv.' + G.hq;
  }

  function applyLang() {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      nodes[i].textContent = t(key);
    }
    if (G) renderPanels();
  }

  // ---------- canvas ----------
  function draw() {
    if (!ctx) return;
    var W = canvas.width, H = canvas.height;
    var sea = ctx.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, pal.seaTop);
    sea.addColorStop(1, pal.seaBottom);
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, W, H);

    // waves
    ctx.strokeStyle = pal.wave;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    for (var wy = 0; wy < H; wy += 34) {
      ctx.beginPath();
      for (var wx = 0; wx <= W; wx += 24) {
        var yy = wy + Math.sin((wx + G.time * 30) * 0.02 + wy * 0.1) * 3;
        if (wx === 0) ctx.moveTo(wx, yy); else ctx.lineTo(wx, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // mainland (top-left wedge)
    ctx.fillStyle = pal.mainland;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W * 0.62, 0);
    ctx.bezierCurveTo(W * 0.52, 60, 300, 120, 170, 148);
    ctx.bezierCurveTo(90, 166, 30, 150, 0, 172);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.mainlandEdge;
    ctx.lineWidth = 3;
    ctx.stroke();

    // red capital marker on mainland
    drawFlag(STAGES[5].x, STAGES[5].y, pal.flagRed, G.captured.indexOf(5) !== -1 ? pal.flagBlue : pal.flagRed);

    // island
    var ix = 590, iy = 300, irx = 175, iry = 125;
    ctx.fillStyle = pal.sand;
    ctx.beginPath();
    ctx.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.grass;
    ctx.beginPath();
    ctx.ellipse(ix, iy - 6, irx - 16, iry - 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // grid cells
    for (var r = 0; r < GRID_ROWS; r++) {
      for (var c = 0; c < GRID_COLS; c++) {
        var x = GRID_X + c * CELL, y = GRID_Y + r * CELL;
        var gk = c + ',' + r;
        var placed = G.grid[gk];
        var isHover = G.placing && hoverCell && hoverCell.c === c && hoverCell.r === r;
        ctx.fillStyle = placed ? 'rgba(255,255,255,0.14)' : pal.gridLine;
        roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 8);
        ctx.fill();
        if (isHover) {
          ctx.fillStyle = canAfford(BUILDINGS[G.placing]) ? 'rgba(80,200,120,0.45)' : 'rgba(220,80,80,0.4)';
          roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 8);
          ctx.fill();
        }
        if (placed) {
          ctx.font = '26px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(BUILD_GLYPH[placed] || '🏠', x + CELL / 2, y + CELL / 2 + 1);
        }
      }
    }

    // HQ marker at island center-left
    ctx.font = '30px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏛', GRID_X - 42, GRID_Y + CELL * 1.6);
    ctx.fillStyle = pal.nodeText;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Lv.' + G.hq, GRID_X - 42, GRID_Y + CELL * 1.6 + 26);

    // campaign route
    ctx.strokeStyle = pal.route;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(700, 240);
    for (var s = 0; s < STAGES.length; s++) {
      ctx.lineTo(STAGES[s].x, STAGES[s].y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // stage nodes
    for (var s2 = 0; s2 < STAGES.length; s2++) {
      var st = STAGES[s2];
      var done = G.captured.indexOf(s2) !== -1;
      var open = s2 === 0 || G.captured.indexOf(s2 - 1) !== -1;
      ctx.fillStyle = done ? pal.flagBlue : (open ? pal.nodeFill : 'rgba(128,128,128,0.55)');
      ctx.beginPath();
      ctx.arc(st.x, st.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.cardEdge;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (!done) drawFlag(st.x + 10, st.y - 16, open ? pal.flagRed : 'rgba(128,128,128,0.8)', pal.flagRed);
      ctx.fillStyle = pal.nodeText;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(s2 + 1), st.x, st.y + 1);
      // label
      ctx.fillStyle = done ? pal.flagBlue : pal.nodeText;
      ctx.font = '11px sans-serif';
      ctx.fillText(t(STAGES[s2]), st.x, st.y + 26);
    }

    // march marker
    if (G.march) {
      var prog = 1 - G.march.timer / G.march.total;
      var from = { x: 700, y: 240 }, to = STAGES[G.march.idx];
      var mx = from.x + (to.x - from.x) * prog, my = from.y + (to.y - from.y) * prog;
      ctx.fillStyle = pal.flagBlue;
      ctx.beginPath();
      ctx.arc(mx, my, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚔', mx, my + 4);
    }

    // battle flashes
    for (var f = G.flashes.length - 1; f >= 0; f--) {
      var fl = G.flashes[f];
      fl.t -= 0.016;
      if (fl.t <= 0) { G.flashes.splice(f, 1); continue; }
      ctx.globalAlpha = Math.min(1, fl.t);
      ctx.fillStyle = fl.win ? pal.flagBlue : pal.flagRed;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, 16 + (1.2 - fl.t) * 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // placing hint text
    if (G.placing) {
      ctx.fillStyle = pal.nodeText;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(t('placing'), 16, H - 16);
    }
  }

  var BUILD_GLYPH = {
    farm: '🌾', mine: '⛏', barracks: '⛺', depot: '📦',
    tower: '🗼', range: '🏹', stable: '🐎', workshop: '🔨'
  };

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawFlag(x, y, color, pole) {
    ctx.strokeStyle = pole || '#8d6e63';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 22);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 16, y + 5);
    ctx.lineTo(x, y + 11);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- update ----------
  function update(dt) {
    G.time += dt;

    // production
    var cap = capacity();
    var foodRate = 0.5, goldRate = 0.35; // base trickle
    for (var key in G.grid) {
      var b = BUILDINGS[G.grid[key]];
      if (!b) continue;
      foodRate += b.foodRate || 0;
      goldRate += b.goldRate || 0;
    }
    G.food = Math.min(cap.food, G.food + foodRate * dt);
    G.gold = Math.min(cap.gold, G.gold + goldRate * dt);

    // raid timer (paused while the army is away on campaign)
    if (!G.march) {
      G.raidTimer -= dt;
      if (G.raidTimer <= 0) {
        G.raidTimer = RAID_INTERVAL;
        resolveRaid();
      } else if (G.raidTimer < 8 && G.raidTimer + dt >= 8) {
        toast('raidSoon');
      }
    }

    // march timer
    if (G.march) {
      G.march.timer -= dt;
      if (G.march.timer <= 0) resolveMarch();
    }

    // banner timer
    if (G.banner.t > 0) {
      G.banner.t -= dt;
      var bd = $('wave-banner');
      if (bd) {
        bd.textContent = G.banner.text;
        bd.className = 'wave-banner show';
        if (G.banner.t <= 0) bd.className = 'wave-banner';
      }
    }
  }

  // ---------- input ----------
  var hoverCell = null;

  function canvasPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  }
  function posToCell(p) {
    var c = Math.floor((p.x - GRID_X) / CELL);
    var r = Math.floor((p.y - GRID_Y) / CELL);
    if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return null;
    return { c: c, r: r };
  }

  function bindInput() {
    $('btn-home').onclick = function () { GamePlatform.navigate.goHome(); };
    $('btn-home-pause').onclick = function () { GamePlatform.navigate.goHome(); };
    $('btn-home-go').onclick = function () { GamePlatform.navigate.goHome(); };
    $('btn-home-vi').onclick = function () { GamePlatform.navigate.goHome(); };
    $('btn-pause').onclick = function () {
      if (state === 'playing') pauseGame();
      else if (state === 'paused') resumeGame();
    };
    $('btn-resume').onclick = resumeGame;
    $('btn-restart-pause').onclick = startGame;
    $('btn-again-go').onclick = startGame;
    $('btn-again-vi').onclick = startGame;
    $('btn-fullscreen').onclick = function () {
      if (GamePlatform.ui.isFullscreen()) GamePlatform.ui.exitFullscreen();
      else GamePlatform.ui.requestFullscreen();
    };
    $('btn-start').onclick = function () {
      startGame();
      if (window.ICAudio) ICAudio.unlock();
    };
    $('btn-clear').onclick = function () {
      GamePlatform.storage.set('best_time', 0);
      GamePlatform.storage.set('best_stage', 0);
      clearSave();
      $('menu-best').textContent = '—';
      $('btn-continue').hidden = true;
      $('btn-start').className = 'pg-btn';
      $('btn-start').setAttribute('data-i18n', 'start');
      applyLang();
      toast('clearRecords');
    };
    $('btn-continue').onclick = function () {
      if (loadGame()) {
        state = 'playing';
        hideOverlays();
        renderPanels();
        updateHUD();
        banner(t('saveRestored'));
        if (window.ICAudio) ICAudio.unlock();
      } else {
        startGame();
      }
    };

    $('tab-build').onclick = function () { switchTab('build'); };
    $('tab-war').onclick = function () { switchTab('war'); };

    // delegated clicks on dynamic cards
    $('build-grid').onclick = function (e) {
      var btn = e.target.closest ? e.target.closest('.cmd-card') : null;
      if (!btn) return;
      if (btn.getAttribute('data-act') === 'hq') { upgradeHQ(); return; }
      if (btn.classList.contains('locked') || btn.classList.contains('disabled')) return;
      selectBuilding(btn.getAttribute('data-key'));
    };
    $('unit-grid').onclick = function (e) {
      var btn = e.target.closest ? e.target.closest('.cmd-card') : null;
      if (!btn || btn.classList.contains('locked') || btn.classList.contains('disabled')) return;
      trainUnit(btn.getAttribute('data-key'));
    };
    $('stage-list').onclick = function (e) {
      var btn = e.target.closest ? e.target.closest('.cmd-card') : null;
      if (!btn || btn.classList.contains('locked') || btn.classList.contains('disabled')) return;
      var idx = parseInt(btn.getAttribute('data-key'), 10);
      if (G.captured.indexOf(idx) !== -1) return;
      launchMarch(idx);
    };

    canvas.addEventListener('mousemove', function (e) {
      hoverCell = posToCell(canvasPos(e));
    });
    canvas.addEventListener('mouseleave', function () { hoverCell = null; });
    canvas.addEventListener('click', function (e) {
      if (state !== 'playing') return;
      var cell = posToCell(canvasPos(e));
      if (cell && G.placing) placeAt(cell.c, cell.r);
      else if (G.placing) { G.placing = null; renderPanels(); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (G && G.placing) { G.placing = null; renderPanels(); }
        else if (state === 'playing') pauseGame();
        else if (state === 'paused') resumeGame();
      } else if (e.key === 'p' || e.key === 'P') {
        if (state === 'playing') pauseGame();
        else if (state === 'paused') resumeGame();
      }
    });

    // keep card re-renders from stealing an in-progress click
    document.addEventListener('pointerdown', function () { pointerIsDown = true; });
    document.addEventListener('pointerup', function () { pointerIsDown = false; });
    document.addEventListener('pointercancel', function () { pointerIsDown = false; });

    // flush save on refresh / tab close / background
    window.addEventListener('pagehide', saveGame);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) saveGame();
    });
  }

  function switchTab(which) {
    $('panel-build').hidden = which !== 'build';
    $('panel-war').hidden = which !== 'war';
    $('tab-build').classList.toggle('active', which === 'build');
    $('tab-war').classList.toggle('active', which === 'war');
  }

  // ---------- main loop ----------
  var lastTs = 0;
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    var dt = Math.min((ts - lastTs) / 1000, 1 / 30);
    lastTs = ts;
    if (state === 'playing') {
      update(dt);
      saveAcc += dt;
      if (saveAcc >= 4) { saveAcc = 0; saveGame(); }
    }
    if (G) {
      updateHUD();
      renderRaidInfo();
      if (!pointerIsDown && computeSig() !== panelSig) renderPanels();
      draw();
    }
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  function init() {
    canvas = $('game');
    ctx = canvas.getContext('2d');
    rebuildPal();
    G = newGame();
    state = 'menu';
    showOverlay('ov-menu');
    var bestMs = GamePlatform.storage.get('best_time', 0) || 0;
    var bestStage = GamePlatform.storage.get('best_stage', 0) || 0;
    $('menu-best').textContent = bestMs ? fmtTime(bestMs / 1000) :
      (bestStage ? bestStage + '/' + STAGES.length : '—');
    // offer "continue" when an in-progress run was auto-saved
    var hasSave = !!readSave();
    $('btn-continue').hidden = !hasSave;
    if (hasSave) {
      $('btn-continue').className = 'pg-btn';
      $('btn-start').className = 'pg-btn pg-btn--ghost';
      $('btn-start').setAttribute('data-i18n', 'newGame');
    }
    applyLang();
    bindInput();
    switchTab('build');
    renderPanels();
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

  // debug/testing hooks
  window.IC = {
    get state() { return state; },
    get G() { return G; },
    start: startGame,
    train: trainUnit,
    place: function (key, c, r) { G.placing = key; placeAt(c, r); },
    march: launchMarch,
    resolveRaid: resolveRaid,
    tick: function (s) { update(s); }
  };
})();
