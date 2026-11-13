/**
 * cheat-kit.js - 彩蛋修改器（平台级共享层）
 *
 * 触发方式与 arena-survivor 一致：直接键入暗号 "potato4096"，弹出常驻面板，
 * 游戏不暂停、参数即时生效。面板挂在页面底部，可再次输入暗号或点"关闭"收起。
 *
 * 用法（必须在 GamePlatform 之后、游戏脚本之后调用）：
 *
 *   CheatKit.init({
 *     id: 'brick-breaker',
 *     title: { zh: '🔧 修改器', en: '🔧 Modifier' },
 *     hint:  { zh: '彩蛋面板 · 参数即时生效', en: 'Easter egg · applies instantly' },
 *     stats: [ { label: { zh: '得分', en: 'Score' }, get: function () { return score; } } ],
 *     params: [ { key: 'speed', label: {...}, min: 1, max: 999, step: 1,
 *                 get: function () { return ball.speed; },
 *                 set: function (v) { ball.speed = v; } } ],
 *     toggles: [ { label: {...}, get: fn, set: fn, on: {...}, off: {...} } ],
 *     actions: [ { label: {...}, run: fn, tone: 'danger' } ],
 *     board: { title, tip, palette: [ { value, label, swatch } ], actions: [...] }
 *   });
 *
 * 棋盘类游戏不画第二块棋盘：面板只提供"取子栏"，游戏在自己的 onClick 里
 * 读取 CheatKit.active() 把子直接摆到原棋盘上。
 *
 * 棋类等需要随视图卸载的场景，调用 CheatKit.detach() 移除面板与键盘监听。
 */
(function (global) {
  'use strict';

  var SECRET = 'potato4096';
  var TIMEOUT = 700;

  var buffer = '';
  var bufTimer = 0;
  var pendingPause = false; // 被吞掉的 p 若不是暗号首字母，需还原给游戏（arena 的暂停键）

  var state = {
    spec: null,
    el: null,
    open: false,
    selected: null,   // 棋盘编辑器当前选中的棋子 value
    offLang: null,
    tick: 0,
    bound: false
  };

  /* ------------------------------------------------------------ */
  /* i18n                                                          */
  /* ------------------------------------------------------------ */

  function t(map) {
    if (map == null) return '';
    if (typeof map === 'string') return map;
    if (global.GamePlatform && GamePlatform.i18n) return GamePlatform.i18n.t(map);
    return map.zh || map.en || '';
  }

  function lang() {
    if (global.GamePlatform && GamePlatform.i18n) return GamePlatform.i18n.getLang();
    return 'zh';
  }

  /* ------------------------------------------------------------ */
  /* DOM 辅助                                                      */
  /* ------------------------------------------------------------ */

  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fmt(v, p) {
    if (v == null || (typeof v === 'number' && !isFinite(v))) return '-';
    if (typeof v !== 'number') return String(v);
    if (p && p.digits != null) return v.toFixed(p.digits);
    return String(Math.round(v * 1000) / 1000);
  }

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  /* ------------------------------------------------------------ */
  /* 面板构建                                                      */
  /* ------------------------------------------------------------ */

  function mountPoint(spec) {
    if (spec && spec.dock && spec.dock.nodeType === 1) return spec.dock;
    var c = document.querySelector('.pg-container');
    return c || document.body;
  }

  function build() {
    var spec = state.spec;
    if (!spec) return;

    detachNode();

    var dock = h('section', 'cheat-dock');
    dock.id = 'cheat-dock';
    dock.hidden = true;
    dock.setAttribute('aria-live', 'polite');

    /* 头部 */
    var head = h('div', 'cheat-head');
    var title = h('h2', 'cheat-title');
    title.textContent = t(spec.title) || (lang() === 'en' ? '🔧 Modifier' : '🔧 修改器');
    var hint = h('p', 'cheat-hint');
    hint.textContent = t(spec.hint) || (lang() === 'en' ? 'Easter egg · applies instantly' : '彩蛋面板 · 参数即时生效');
    var close = h('button', 'pg-btn pg-btn--ghost cheat-close', lang() === 'en' ? 'Close' : '关闭');
    close.addEventListener('click', function () { closePanel(); });
    head.appendChild(title);
    head.appendChild(hint);
    head.appendChild(close);
    dock.appendChild(head);

    /* 属性看板 */
    if (spec.stats && spec.stats.length) {
      var strip = h('div', 'cheat-stats');
      strip.dataset.role = 'stats';
      dock.appendChild(strip);
    }

    /* 数值滑杆 */
    if (spec.params && spec.params.length) {
      var grid = h('div', 'cheat-grid');
      grid.dataset.role = 'params';
      dock.appendChild(grid);
    }

    /* 开关（放在棋盘编辑器之前：先开上帝模式，再摆子） */
    if (spec.toggles && spec.toggles.length) {
      var tg = h('div', 'cheat-toggles');
      tg.dataset.role = 'toggles';
      dock.appendChild(tg);
    }

    /* 动作按钮 */
    if (spec.actions && spec.actions.length) {
      var acts = h('div', 'cheat-actions');
      acts.dataset.role = 'actions';
      dock.appendChild(acts);
    }

    /* 棋盘取子栏（只选子，落子回到游戏原棋盘） */
    if (spec.board) {
      dock.appendChild(buildBoardBar(spec.board));
    }

    mountPoint(spec).appendChild(dock);
    state.el = dock;

    rebuildStats();
    rebuildParams();
    rebuildToggles();
    rebuildActions();

    if (GamePlatform.i18n && !state.offLang) {
      state.offLang = GamePlatform.i18n.onChange(function () {
        if (!state.el) return;
        relabel();
      });
    }

    refresh();
  }

  function detachNode() {
    if (state.el && state.el.parentNode) state.el.parentNode.removeChild(state.el);
    state.el = null;
  }

  function relabel() {
    var spec = state.spec;
    var el = state.el;
    if (!spec || !el) return;

    el.querySelector('.cheat-title').textContent = t(spec.title);
    el.querySelector('.cheat-hint').textContent = t(spec.hint);
    el.querySelector('.cheat-close').textContent = lang() === 'en' ? 'Close' : '关闭';

    rebuildStats();
    rebuildParams();
    rebuildToggles();
    rebuildActions();

    var board = el.querySelector('.cheat-board');
    if (board && spec.board) {
      var titleEl = board.querySelector('.cheat-board-title');
      if (titleEl) titleEl.textContent = t(spec.board.title);
      buildPalette(board, spec.board);
      var tipEl = board.querySelector('.cheat-board-tip');
      if (tipEl) tipEl.textContent = t(spec.board.tip) || (lang() === 'en'
        ? 'Tap the real board to place or clear squares'
        : '直接点原棋盘落子 / 清空格');
    }
    refresh();
  }

  /* ---------- 属性看板 ---------- */

  function rebuildStats() {
    var spec = state.spec;
    var strip = state.el.querySelector('[data-role="stats"]');
    if (!strip || !spec.stats) return;
    strip.innerHTML = '';
    spec.stats.forEach(function (s) {
      var box = h('div', 'cheat-stat' + (s.tone ? ' is-' + s.tone : ''));
      var num = h('b');
      num.dataset.stat = s.key || t(s.label);
      var lab = h('span');
      lab.textContent = t(s.label);
      box.appendChild(num);
      box.appendChild(lab);
      strip.appendChild(box);
    });
  }

  /* ---------- 数值滑杆 ---------- */

  function rebuildParams() {
    var spec = state.spec;
    var grid = state.el.querySelector('[data-role="params"]');
    if (!grid || !spec.params) return;
    grid.innerHTML = '';

    spec.params.forEach(function (p) {
      var row = h('div', 'cheat-row');
      var name = h('span', 'cheat-name', t(p.label));

      var range = h('input', 'cheat-range');
      range.type = 'range';
      range.min = p.min;
      range.max = p.max;
      range.step = p.step || 1;

      var num = h('input', 'cheat-num');
      num.type = 'number';
      num.min = p.min;
      num.max = p.max;
      num.step = p.step || 1;

      var apply = function (raw) {
        var v = clamp(Number(raw), p.min, p.max);
        if (!isFinite(v)) return;
        p.set(v);
        refresh();
      };

      range.addEventListener('input', function () { apply(range.value); });
      num.addEventListener('input', function () {
        if (num.value !== '' && !isNaN(Number(num.value))) apply(num.value);
      });
      // 滑杆结束拖动后同步一次，避免被 500ms 轮询覆盖成旧值
      range.addEventListener('change', function () { apply(range.value); });

      row.appendChild(name);
      row.appendChild(range);
      row.appendChild(num);
      grid.appendChild(row);
    });
  }

  /* ---------- 开关 ---------- */

  function rebuildToggles() {
    var spec = state.spec;
    var box = state.el.querySelector('[data-role="toggles"]');
    if (!box || !spec.toggles) return;
    box.innerHTML = '';
    spec.toggles.forEach(function (tg, i) {
      var btn = h('button', 'pg-btn pg-btn--ghost cheat-toggle');
      btn.dataset.idx = String(i);
      btn.addEventListener('click', function () {
        tg.set(!tg.get());
        refresh();
        if (tg.onAfter) tg.onAfter();
      });
      box.appendChild(btn);
    });
  }

  /* ---------- 动作按钮 ---------- */

  function rebuildActions() {
    var spec = state.spec;
    var box = state.el.querySelector('[data-role="actions"]');
    if (!box || !spec.actions) return;
    box.innerHTML = '';
    spec.actions.forEach(function (a) {
      var btn = h('button', 'pg-btn' + (a.tone === 'primary' ? '' : ' pg-btn--ghost') +
        (a.tone === 'danger' ? ' cheat-danger' : '') + ' cheat-action');
      btn.textContent = t(a.label);
      btn.addEventListener('click', function () {
        a.run();
        refresh();
        if (a.toast) toast(t(a.toast));
      });
      box.appendChild(btn);
    });
  }

  /* ---------- 棋盘取子（不画棋盘，直接在游戏原棋盘上落子） ---------- */

  function buildBoardBar(board) {
    var wrap = h('div', 'cheat-board');
    wrap.appendChild(h('h3', 'cheat-board-title', t(board.title)));

    var pal = h('div', 'cheat-palette');
    pal.dataset.role = 'palette';
    wrap.appendChild(pal);
    buildPalette(wrap, board);

    wrap.appendChild(h('p', 'cheat-board-tip',
      t(board.tip) || (lang() === 'en'
        ? 'Tap the real board to place or clear squares'
        : '直接点原棋盘落子 / 清空格')));

    if (board.actions && board.actions.length) {
      var acts = h('div', 'cheat-board-actions');
      board.actions.forEach(function (a) {
        var b = h('button', 'pg-btn pg-btn--ghost cheat-action');
        b.textContent = t(a.label);
        b.addEventListener('click', function () {
          a.run();
          refresh();
          if (a.toast) toast(t(a.toast));
        });
        acts.appendChild(b);
      });
      wrap.appendChild(acts);
    }

    if (board.palette && board.palette.length) {
      // 保留上次所选的子（只在当前色板里不存在时才重置），切棋种/重开不必重选
      var keep = board.palette.some(function (p) { return p.value === state.selected; });
      if (!keep) state.selected = board.palette[0].value;
    }
    return wrap;
  }

  function buildPalette(scope, board) {
    var pal = scope.querySelector('[data-role="palette"]');
    if (!pal) return;
    pal.innerHTML = '';
    (board.palette || []).forEach(function (p) {
      var chip = h('button', 'cheat-chip');
      chip.dataset.value = String(p.value);
      if (p.swatch) chip.style.setProperty('--chip', p.swatch);
      chip.title = t(p.label);
      var dot = h('i', 'cheat-chip-dot');
      chip.appendChild(dot);
      chip.appendChild(h('span', null, t(p.label)));
      chip.addEventListener('click', function () {
        state.selected = p.value;
        markPalette();
      });
      pal.appendChild(chip);
    });
    markPalette();
  }

  function markPalette() {
    if (!state.el) return;
    var chips = state.el.querySelectorAll('.cheat-chip');
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle('is-active', chips[i].dataset.value === String(state.selected));
    }
  }

  /* ------------------------------------------------------------ */
  /* 刷新                                                          */
  /* ------------------------------------------------------------ */

  function refresh() {
    var spec = state.spec;
    var el = state.el;
    if (!spec || !el) return;

    /* 属性 */
    if (spec.stats) {
      spec.stats.forEach(function (s, i) {
        var node = el.querySelectorAll('[data-role="stats"] .cheat-stat b')[i];
        if (!node) return;
        var v = s.get();
        node.textContent = (s.prefix || '') + (s.format ? s.format(v) : fmt(v, s)) + (s.suffix || '');
      });
    }

    /* 滑杆 */
    if (spec.params) {
      var rows = el.querySelectorAll('.cheat-row');
      spec.params.forEach(function (p, i) {
        var row = rows[i];
        if (!row) return;
        var v = p.get();
        if (v == null || !isFinite(v)) return;
        var shown = p.digits != null ? Number(v).toFixed(p.digits) : String(Math.round(v * 1000) / 1000);
        var range = row.querySelector('.cheat-range');
        var num = row.querySelector('.cheat-num');
        if (range && document.activeElement !== range) range.value = String(v);
        if (num && document.activeElement !== num) num.value = shown;
        row.querySelector('.cheat-name').textContent = t(p.label);
      });
    }

    /* 开关 */
    if (spec.toggles) {
      var btns = el.querySelectorAll('.cheat-toggle');
      spec.toggles.forEach(function (tg, i) {
        var btn = btns[i];
        if (!btn) return;
        var on = !!tg.get();
        btn.textContent = on ? t(tg.on || { zh: '已开启', en: 'ON' }) : t(tg.off || { zh: '已关闭', en: 'OFF' });
        btn.classList.toggle('is-on', on);
      });
    }

    /* 取子栏可见性：board.visible() 为真才显示（如上帝模式开启后才出棋子） */
    if (spec.board) {
      var bar = el.querySelector('.cheat-board');
      if (bar && typeof spec.board.visible === 'function') {
        bar.hidden = !spec.board.visible();
      }
    }

    /* 动作按钮文案 */
    if (spec.actions) {
      var acts = el.querySelectorAll('.cheat-action');
      // 动作按钮与棋盘动作共享类名，仅按顺序重写前 N 个面板动作
      var panelActs = el.querySelectorAll('[data-role="actions"] .cheat-action');
      spec.actions.forEach(function (a, i) {
        if (panelActs[i]) panelActs[i].textContent = t(a.label);
      });
    }

  }

  /* ------------------------------------------------------------ */
  /* 开关面板                                                      */
  /* ------------------------------------------------------------ */

  /* 面板是普通文档流里的卡片，长页面（尤其手机）打开时可能落在折线以下，
     只有大部分看不见时才滚一下，已经可见就别动玩家的滚动位置 */
  function revealDock() {
    var el = state.el;
    if (!el || !el.getBoundingClientRect) return;
    var r = el.getBoundingClientRect();
    var vh = global.innerHeight || document.documentElement.clientHeight || 0;
    if (!vh || !r.height) return;
    var visible = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (visible >= Math.min(r.height, vh) * 0.6) return;
    var reduce = false;
    try {
      reduce = !!(global.GamePlatform && GamePlatform.ui && GamePlatform.ui.shouldReduceMotion &&
        GamePlatform.ui.shouldReduceMotion());
    } catch (e) { reduce = false; }
    try {
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    } catch (e) {
      el.scrollIntoView();
    }
  }

  function openPanel() {
    if (!state.el) build();
    if (!state.el) return;
    state.open = true;
    state.el.hidden = false;
    state.el.classList.add('is-open');
    refresh();
    if (state.tick) clearInterval(state.tick);
    state.tick = setInterval(refresh, 500);
    if (state.spec.onOpen) state.spec.onOpen();
    toast(lang() === 'en' ? '🔧 Modifier unlocked' : '🔧 修改器已解锁');
    // 等一帧，动画起点的高度测准了再决定要不要滚
    setTimeout(revealDock, 40);
  }

  function closePanel() {
    state.open = false;
    if (state.el) {
      state.el.hidden = true;
      state.el.classList.remove('is-open');
    }
    if (state.tick) { clearInterval(state.tick); state.tick = 0; }
    if (state.spec && state.spec.onClose) state.spec.onClose();
  }

  function togglePanel() {
    if (state.open) closePanel();
    else openPanel();
  }

  function toast(msg) {
    if (global.GamePlatform && GamePlatform.ui && GamePlatform.ui.toast) {
      GamePlatform.ui.toast(msg);
      return;
    }
    var el = document.getElementById('p4096-toast');
    if (!el) {
      el = h('div');
      el.id = 'p4096-toast';
      el.className = 'p4096-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('p4096-toast--show');
    setTimeout(function () { el.classList.remove('p4096-toast--show'); }, 1800);
  }

  /* ------------------------------------------------------------ */
  /* 暗号检测                                                      */
  /* ------------------------------------------------------------ */

  function isTypingTarget(e) {
    var el = e.target;
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function replayPause() {
    if (!pendingPause) return;
    pendingPause = false;
    // 游戏若监听 p 作为暂停键，这里补发一次
    try {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', bubbles: true }));
    } catch (e) { /* 忽略 */ }
  }

  function restartTimer() {
    if (bufTimer) clearTimeout(bufTimer);
    bufTimer = setTimeout(function () {
      replayPause();
      buffer = '';
    }, TIMEOUT);
  }

  function onKeyDown(e) {
    if (isTypingTarget(e)) return;
    if (e.repeat) return;

    var ch = (e.key || '').toLowerCase();
    if (!ch || ch.length !== 1 || !/[a-z0-9]/.test(ch)) return;

    var next = buffer + ch;
    if (SECRET.indexOf(next) === 0) {
      e.preventDefault();
      e.stopPropagation();
      buffer = next;
      pendingPause = buffer.length === 1 && ch === 'p';
      restartTimer();
      if (buffer === SECRET) {
        buffer = '';
        pendingPause = false;
        if (bufTimer) clearTimeout(bufTimer);
        togglePanel();
      }
      return;
    }

    buffer = '';
    if (bufTimer) clearTimeout(bufTimer);
    replayPause();

    if (ch === SECRET.charAt(0)) {
      e.preventDefault();
      e.stopPropagation();
      buffer = ch;
      pendingPause = true;
      restartTimer();
    }
  }

  /* ------------------------------------------------------------ */
  /* 对外接口                                                      */
  /* ------------------------------------------------------------ */

  function bindOnce() {
    if (state.bound) return;
    state.bound = true;
    window.addEventListener('keydown', onKeyDown, true);
  }

  var API = {
    /** 注册/替换当前修改器。同一页面重复调用会重建面板（棋类切棋种时用） */
    init: function (spec) {
      if (!spec || !spec.id) throw new Error('CheatKit.init 需要 spec.id');
      var wasOpen = state.open;
      if (state.offLang) { try { state.offLang(); } catch (e) {} state.offLang = null; }
      if (state.tick) { clearInterval(state.tick); state.tick = 0; }
      state.spec = spec;
      state.open = false;
      build();
      bindOnce();
      if (wasOpen) openPanel();
      return API;
    },
    /** 棋类视图卸载：移除面板与监听，避免残留 */
    detach: function () {
      if (state.tick) { clearInterval(state.tick); state.tick = 0; }
      if (state.offLang) { try { state.offLang(); } catch (e) {} state.offLang = null; }
      detachNode();
      state.spec = null;
      state.open = false;
      state.selected = null;
      if (state.bound) {
        window.removeEventListener('keydown', onKeyDown, true);
        state.bound = false;
      }
      buffer = '';
      if (bufTimer) { clearTimeout(bufTimer); bufTimer = 0; }
    },
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    refresh: refresh,
    isOpen: function () { return state.open; },
    toast: toast,
    /** 供游戏侧判断：面板打开时是否应停掉键盘操作（可选） */
    capturing: function () { return state.open; },
    /**
     * 当前取子栏选中的棋子值（棋盘类游戏在自己的 onClick 里取用）。
     * 没有配置 board.palette 时返回 null；选中「空」时返回值可能为 ''。
     */
    active: function () { return state.selected; },
    /** 是否配置了取子栏（没有就不用理会棋盘点击） */
    hasPalette: function () { return !!(state.spec && state.spec.board && state.spec.board.palette); }
  };

  global.CheatKit = API;
})(window);
