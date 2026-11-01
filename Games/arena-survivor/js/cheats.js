/* arena-survivor - easter egg: type "potato4096" to open the modifier panel */
(function () {
  'use strict';

  var SJ = window.SJ = window.SJ || {};

  // ---------- secret sequence ----------
  var SECRET = 'potato4096';
  var BUFFER_TIMEOUT = 700; // ms before an unfinished sequence resets
  var buffer = '';
  var bufTimer = 0;
  var pendingPause = false; // swallowed leading "p" -> replay as pause if the sequence breaks
  var panelOpen = false;

  // ---------- i18n ----------
  var STR = {
    cheatTitle: { zh: '🔧 修改器', en: '🔧 Modifier Panel' },
    cheatHint: {
      zh: '彩蛋面板 · 参数即时生效',
      en: 'Easter-egg panel - changes apply instantly'
    },
    cheatHeal: { zh: '回满血', en: 'Full Heal' },
    cheatClear: { zh: '清空敌人', en: 'Clear Enemies' },
    cheatScore: { zh: '+1000 分', en: '+1000 Score' },
    cheatGodOn: { zh: '无敌：开', en: 'God Mode: ON' },
    cheatGodOff: { zh: '无敌：关', en: 'God Mode: OFF' },
    cheatReset: { zh: '恢复默认', en: 'Reset Defaults' },
    cheatClose: { zh: '关闭', en: 'Close' }
  };
  function t(k) {
    return GamePlatform.i18n.t(STR[k] || { zh: k, en: k });
  }

  // ---------- tunable character params (all of them) ----------
  // scale: display value is player field * scale (crit 0..1 shown as %)
  var PARAMS = [
    { key: 'hp', name: { zh: '当前生命', en: 'Current HP' }, min: 0, max: 9999, step: 1 },
    { key: 'maxHp', name: { zh: '生命上限', en: 'Max HP' }, min: 1, max: 9999, step: 1 },
    { key: 'speed', name: { zh: '移动速度', en: 'Move Speed' }, min: 20, max: 600, step: 1 },
    { key: 'damage', name: { zh: '伤害', en: 'Damage' }, min: 1, max: 999, step: 1 },
    { key: 'fireInterval', name: { zh: '攻击间隔(秒)', en: 'Fire Interval (s)' }, min: 0.02, max: 2, step: 0.01, digits: 2 },
    { key: 'bulletSpeed', name: { zh: '弹速', en: 'Bullet Speed' }, min: 50, max: 1200, step: 5 },
    { key: 'bulletLife', name: { zh: '弹丸存活(秒)', en: 'Bullet Life (s)' }, min: 0.1, max: 6, step: 0.05, digits: 2 },
    { key: 'projectiles', name: { zh: '弹丸数量', en: 'Projectiles' }, min: 1, max: 12, step: 1 },
    { key: 'pierce', name: { zh: '穿透', en: 'Pierce' }, min: 0, max: 15, step: 1 },
    { key: 'crit', name: { zh: '暴击率 %', en: 'Crit %' }, min: 0, max: 100, step: 1, scale: 100 },
    { key: 'pickupR', name: { zh: '拾取范围', en: 'Pickup Range' }, min: 10, max: 400, step: 1 }
  ];

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function getVal(p) {
    var player = SJ.CheatAPI.getPlayer();
    var v = player[p.key] * (p.scale || 1);
    return p.digits ? Number(v.toFixed(p.digits)) : Math.round(v);
  }

  function setVal(p, raw) {
    var player = SJ.CheatAPI.getPlayer();
    var v = clamp(Number(raw) || 0, p.min, p.max);
    player[p.key] = v / (p.scale || 1);
    if (p.key === 'maxHp' && player.hp > player.maxHp) player.hp = player.maxHp;
    if (p.key === 'hp' && player.hp > player.maxHp) player.hp = player.maxHp;
    refreshRow(p);
  }

  // ---------- panel wiring ----------
  var rows = {}; // key -> { p, range, num, name }

  function buildRows() {
    var grid = document.getElementById('cheat-grid');
    grid.innerHTML = '';
    rows = {};
    for (var i = 0; i < PARAMS.length; i++) {
      (function (p) {
        var row = document.createElement('div');
        row.className = 'cheat-row';

        var name = document.createElement('span');
        name.className = 'cheat-name';

        var range = document.createElement('input');
        range.type = 'range';
        range.id = 'cheat-range-' + p.key;
        range.min = p.min;
        range.max = p.max;
        range.step = p.step;

        var num = document.createElement('input');
        num.type = 'number';
        num.id = 'cheat-num-' + p.key;
        num.min = p.min;
        num.max = p.max;
        num.step = p.step;

        range.addEventListener('input', function () { setVal(p, range.value); });
        num.addEventListener('change', function () { setVal(p, num.value); });
        num.addEventListener('input', function () {
          // live apply while typing, clamped
          if (num.value !== '' && !isNaN(Number(num.value))) setVal(p, num.value);
        });

        row.appendChild(name);
        row.appendChild(range);
        row.appendChild(num);
        grid.appendChild(row);
        rows[p.key] = { p: p, name: name, range: range, num: num };
      })(PARAMS[i]);
    }
  }

  function refreshRow(p) {
    var r = rows[p.key];
    if (!r) return;
    var v = getVal(p);
    r.range.value = String(v);
    r.num.value = String(v);
    r.name.textContent = GamePlatform.i18n.t(p.name);
  }

  function refreshAll() {
    for (var i = 0; i < PARAMS.length; i++) refreshRow(PARAMS[i]);
    var godBtn = document.getElementById('cheat-god');
    godBtn.textContent = SJ.CheatAPI.isGod() ? t('cheatGodOn') : t('cheatGodOff');
  }

  function applyI18n() {
    var nodes = document.querySelectorAll('[data-ci18n]');
    Array.prototype.forEach.call(nodes, function (el) {
      el.textContent = t(el.getAttribute('data-ci18n'));
    });
    for (var i = 0; i < PARAMS.length; i++) {
      var r = rows[PARAMS[i].key];
      if (r) r.name.textContent = GamePlatform.i18n.t(PARAMS[i].name);
    }
    refreshAll();
  }

  // ---------- open / close (dock outside the game frame; game keeps running) ----------
  function openCheat() {
    panelOpen = true;
    document.getElementById('ov-cheat').hidden = false;
    refreshAll();
    applyI18n();
  }

  function closeCheat() {
    panelOpen = false;
    document.getElementById('ov-cheat').hidden = true;
  }

  function toggleCheat() {
    if (panelOpen) closeCheat();
    else openCheat();
  }

  // ---------- key sequence detection ----------
  function isTypingTarget(e) {
    var el = e.target;
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function restartTimer() {
    if (bufTimer) clearTimeout(bufTimer);
    bufTimer = setTimeout(function () {
      if (pendingPause && SJ.Input && SJ.Input.state) SJ.Input.state.pauseQueued = true;
      buffer = '';
      pendingPause = false;
    }, BUFFER_TIMEOUT);
  }

  function onKeyDown(e) {
    if (isTypingTarget(e)) return;
    if (e.repeat) return;

    var ch = (e.key || '').toLowerCase();
    if (!ch || ch.length !== 1 || !/[a-z0-9]/.test(ch)) return;

    var next = buffer + ch;
    if (SECRET.indexOf(next) === 0) {
      // part of (or the start of) the secret: swallow so the game never sees it
      e.preventDefault();
      e.stopPropagation();
      buffer = next;
      if (buffer.length === 1 && ch === 'p') {
        // a lone "p" is also the pause key: hold it, replay if the sequence breaks
        pendingPause = true;
      } else {
        pendingPause = false;
      }
      restartTimer();
      if (buffer === SECRET) {
        buffer = '';
        pendingPause = false;
        if (bufTimer) clearTimeout(bufTimer);
        toggleCheat();
      }
      return;
    }

    // sequence broken: replay any swallowed pause, then maybe restart with this key
    var wasPendingPause = pendingPause;
    buffer = '';
    pendingPause = false;
    if (bufTimer) clearTimeout(bufTimer);
    if (wasPendingPause && SJ.Input && SJ.Input.state) SJ.Input.state.pauseQueued = true;

    if (ch === SECRET[0]) {
      e.preventDefault();
      e.stopPropagation();
      buffer = ch;
      pendingPause = true;
      restartTimer();
    }
  }

  // ---------- init ----------
  function bindButtons() {
    document.getElementById('cheat-heal').onclick = function () {
      SJ.CheatAPI.fullHeal();
      refreshAll();
    };
    document.getElementById('cheat-clear').onclick = function () {
      SJ.CheatAPI.clearEnemies();
    };
    document.getElementById('cheat-score').onclick = function () {
      SJ.CheatAPI.addScore(1000);
    };
    document.getElementById('cheat-god').onclick = function () {
      SJ.CheatAPI.setGod(!SJ.CheatAPI.isGod());
      refreshAll();
    };
    document.getElementById('cheat-reset').onclick = function () {
      var d = SJ.CheatAPI.getDefaults();
      for (var i = 0; i < PARAMS.length; i++) {
        var p = PARAMS[i];
        SJ.CheatAPI.getPlayer()[p.key] = d[p.key];
      }
      refreshAll();
    };
    document.getElementById('cheat-close').onclick = function () { closeCheat(); };
  }

  function init() {
    buildRows();
    bindButtons();
    applyI18n();
    window.addEventListener('keydown', onKeyDown, true);
    GamePlatform.settings.onChange(function (settings, keys) {
      if (keys.indexOf('lang') !== -1) applyI18n();
    });
  }

  GamePlatform.ready.then(init);
})();
