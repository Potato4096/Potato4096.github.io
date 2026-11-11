/**
 * core/shell.js - 对局页外壳
 *
 * 四个棋种的棋盘、规则、AI 完全不同，但"顶栏 + 状态条 + 棋盘 + 侧栏
 * （模式、战绩、操作、棋谱）"这套骨架一致。这里生成骨架并接管
 * 语言/主题订阅、按钮派发、棋谱渲染，棋种只填内容。
 *
 * 用法：
 *   var ui = BG.shell.create(root, {
 *     id: 'gomoku', title: {zh:'五子棋', en:'Gomoku'}, hint: {...},
 *     stats: [{key:'black', label:{...}, dot:'black'}],
 *     actions: ['undo', 'restart', 'clear'],
 *     extraHtml: '<div class="bg-seg">…</div>',
 *     onAction: function(name) { … }
 *   });
 */
(function (global) {
  'use strict';

  var BG = global.BG || (global.BG = {});

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function create(root, spec) {
    var i18n = BG.i18n;
    var alive = true;

    i18n.setActive(spec.id);

    var title = i18n.text(spec.title);
    var actions = (spec.actions || ['undo', 'restart']).map(function (a) {
      return typeof a === 'string' ? { key: a } : a;
    });

    var actionHtml = actions.map(function (a) {
      var cls = 'pg-btn' + (a.ghost === false ? '' : ' pg-btn--ghost');
      return '<button class="' + cls + ' bg-action" data-act="' + a.key + '" data-t="' +
        (a.label || a.key) + '"></button>';
    }).join('');

    var statHtml = (spec.stats || []).map(function (s) {
      var label = s.labelKey
        ? '<span data-t="' + esc(s.labelKey) + '"></span>'
        : '<span>' + esc(i18n.text(s.label)) + '</span>';
      return '<span class="bg-stat"><i class="bg-dot ' + esc(s.dot || '') + '"></i>' +
        label + '<b data-stat="' + esc(s.key) + '">0</b></span>';
    }).join('');

    root.innerHTML = '' +
      '<div class="bg-stage">' +
      '  <div class="bg-topbar">' +
      '    <button class="pg-btn pg-btn--ghost bg-back" data-act="exit">← <span data-t="back"></span></button>' +
      '    <span class="bg-crumb"><span data-t="hub"></span><i>/</i><b class="bg-crumb-name">' + esc(title) + '</b></span>' +
      '    <span class="pg-tag bg-lang"></span>' +
      '  </div>' +
      '  <div class="bg-layout">' +
      '    <div class="bg-main">' +
      '      <div class="bg-status pg-card">' +
      '        <span class="bg-turn-dot"></span>' +
      '        <span class="bg-status-text"></span>' +
      '        <span class="bg-mode-chip"></span>' +
      '      </div>' +
      '      <div class="bg-board-frame"><canvas class="bg-board"></canvas></div>' +
      '      <p class="bg-hint"></p>' +
      '    </div>' +
      '    <aside class="bg-side">' +
      '      <div class="bg-panel pg-card">' +
      '        <div class="bg-mode-row">' +
      '          <span class="pg-muted" data-t="modeLabel"></span>' +
      '          <b class="bg-mode-label">-</b>' +
      '          <button class="pg-btn pg-btn--ghost bg-switch" data-act="exit" data-t="switchMode"></button>' +
      '        </div>' +
      '        <div class="bg-stats">' + statHtml + '</div>' +
      '        <div class="bg-actions">' + actionHtml + '</div>' +
      '        <div class="bg-extra">' + (spec.extraHtml || '') + '</div>' +
      '        <h2 class="bg-panel-title" data-t="record"></h2>' +
      '        <div class="bg-moves"></div>' +
      '      </div>' +
      '    </aside>' +
      '  </div>' +
      '</div>';

    var q = function (sel) { return root.querySelector(sel); };
    var qa = function (sel) { return root.querySelectorAll(sel); };

    var el = {
      stage: q('.bg-stage'),
      statusBar: q('.bg-status'),
      statusText: q('.bg-status-text'),
      crumbName: q('.bg-crumb-name'),
      turnDot: q('.bg-turn-dot'),
      modeChip: q('.bg-mode-chip'),
      modeLabel: q('.bg-mode-label'),
      hint: q('.bg-hint'),
      canvas: q('canvas'),
      moves: q('.bg-moves'),
      stats: q('.bg-stats'),
      actions: q('.bg-actions'),
      extra: q('.bg-extra'),
      lang: q('.bg-lang')
    };

    /* ---------- 文本 ---------- */
    function refreshText() {
      if (!alive) return;
      i18n.applyText(root);
      el.lang.textContent = i18n.lang() === 'en' ? 'EN' : '中文';
      el.hint.textContent = i18n.text(spec.hint);
      el.crumbName.textContent = i18n.text(spec.title);
      document.title = i18n.text(spec.title) + ' · Potato4096 Arcade';
      if (spec.onLangChange) spec.onLangChange();
    }

    /* ---------- 状态栏 ---------- */
    function setStatus(text) {
      el.statusText.textContent = text;
    }

    function setDot(cls) {
      el.turnDot.className = 'bg-turn-dot' + (cls ? ' ' + cls : '');
    }

    function setModeChip(text) {
      el.modeChip.textContent = text || '';
      el.modeChip.style.display = text ? '' : 'none';
    }

    function setMode(text) {
      el.modeLabel.textContent = text;
    }

    /* ---------- 棋谱 ---------- */
    function setMoves(html) {
      el.moves.innerHTML = html;
      el.moves.scrollTop = el.moves.scrollHeight;
    }

    function emptyMoves() {
      el.moves.innerHTML = '<div class="bg-move-empty" data-t="noMoves">' +
        esc(i18n.t('noMoves')) + '</div>';
    }

    /* ---------- 战绩 ---------- */
    function setStats(values) {
      Object.keys(values || {}).forEach(function (k) {
        var node = root.querySelector('[data-stat="' + k + '"]');
        if (node) node.textContent = String(values[k]);
      });
    }

    /* ---------- 事件 ---------- */
    function onClick(e) {
      var btn = e.target.closest('[data-act]');
      if (!btn || !root.contains(btn)) return;
      var act = btn.getAttribute('data-act');
      if (!act) return;
      if (act !== 'exit') BG.sfx.click();
      if (act === 'exit') {
        if (spec.onExit) spec.onExit();
        return;
      }
      if (spec.onAction) spec.onAction(act, btn);
    }

    el.stage.addEventListener('click', onClick);

    /* ---------- 语言 / 主题订阅 ---------- */
    var offs = [];
    function track(off) { if (typeof off === 'function') offs.push(off); }

    if (global.GamePlatform) {
      track(GamePlatform.theme.onChange(function () {
        if (!alive) return;
        BG.canvas.invalidate();
        if (spec.onThemeChange) spec.onThemeChange();
      }));
      track(GamePlatform.settings.onChange(function () {
        if (!alive) return;
        BG.canvas.invalidate();
        refreshText();
        if (spec.onSettingsChange) spec.onSettingsChange();
        if (spec.onThemeChange) spec.onThemeChange();
      }));
      track(GamePlatform.i18n.onChange(function () {
        if (!alive) return;
        refreshText();
        if (spec.onResize) spec.onResize();
        if (spec.onThemeChange) spec.onThemeChange();
      }));
    }

    refreshText();
    emptyMoves();

    return {
      root: root,
      el: el,
      q: q,
      qa: qa,
      setStatus: setStatus,
      setDot: setDot,
      setMode: setMode,
      setModeChip: setModeChip,
      setMoves: setMoves,
      emptyMoves: emptyMoves,
      setStats: setStats,
      refreshText: refreshText,
      toast: function (msg) {
        if (global.GamePlatform && GamePlatform.ui) GamePlatform.ui.toast(msg);
      },
      destroy: function () {
        alive = false;
        el.stage.removeEventListener('click', onClick);
        offs.forEach(function (off) { try { off(); } catch (e) { /* 忽略 */ } });
        if (spec.onDestroy) spec.onDestroy();
        root.innerHTML = '';
      }
    };
  }

  BG.shell = { create: create };
})(window);
