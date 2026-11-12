/**
 * core/canvas.js - 棋盘画布底座
 *
 * 各棋种的逻辑坐标系各不相同，这里只处理通用部分：
 * 高分屏适配、圆角矩形、按主题取平台色值。
 */
(function (global) {
  'use strict';

  var BG = global.BG || (global.BG = {});

  var accentCache = null;

  /**
   * 按"实际显示尺寸 × devicePixelRatio"分配画布缓冲区，再把绘制坐标系
   * 缩放到逻辑尺寸（w × h）。
   *
   * 早先的写法是 canvas.width = w * dpr，但 CSS 是 width:100%，容器比 w 大
   * 时画布被整体拉伸，缓冲区分辨率不够 → 线条和棋子都发虚、带锯齿。
   * 现在缓冲区永远等于屏幕上的物理像素数，逻辑坐标不变，所以各棋种的
   * 绘制代码不需要改任何一行。
   */
  var fitCache = typeof WeakMap === 'function' ? new WeakMap() : null;

  function fit(canvas, ctx, w, h) {
    if (!canvas || !ctx || !w || !h) return ctx;
    var dpr = global.devicePixelRatio || 1;

    var prev = fitCache ? fitCache.get(canvas) : null;
    if (!prev || prev.w !== w || prev.h !== h) {
      // 首次（或逻辑尺寸改了）：先让属性给出正确纵横比，CSS 的 height:auto 才算得对
      canvas.width = w;
      canvas.height = h;
    }

    var rect = canvas.getBoundingClientRect();
    var cssW = rect.width || w;
    var bw = Math.max(1, Math.round(cssW * dpr));
    var bh = Math.max(1, Math.round((h * bw) / w));

    if (!prev || prev.bw !== bw || prev.bh !== bh || prev.dpr !== dpr ||
        prev.w !== w || prev.h !== h || canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
      if (fitCache) fitCache.set(canvas, { bw: bw, bh: bh, dpr: dpr, w: w, h: h });
    }
    // 改 width/height 会重置上下文状态，这里每帧重设一次变换（幂等且便宜）
    ctx.setTransform(bw / w, 0, 0, bh / h, 0, 0);
    return ctx;
  }

  /** 设置逻辑尺寸并按显示尺寸适配物理像素，返回已缩放的 2D 上下文 */
  function setup(canvas, w, h) {
    var ctx = canvas.getContext('2d');
    return fit(canvas, ctx, w, h);
  }

  /** 尺寸变化（窗口缩放 / 切换棋盘路数 / 换屏）时重新适配 */
  function resize(canvas, ctx, w, h) {
    return fit(canvas, ctx, w, h);
  }

  function readVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name);
      v = (v || '').trim();
      return v || fallback;
    } catch (e) {
      return fallback;
    }
  }

  /** 平台语义色（随主题和外观包变化），带缓存，主题切换时调用 invalidate() */
  function accent() {
    if (!accentCache) {
      accentCache = {
        accent: readVar('--pg-accent', '#4f6df5'),
        accentSoft: readVar('--pg-accent-soft', 'rgba(79,109,245,0.14)'),
        danger: readVar('--pg-danger', '#e5484d'),
        success: readVar('--pg-success', '#22a06b'),
        warning: readVar('--pg-warning', '#d97706'),
        text: readVar('--pg-text', '#1f2430'),
        muted: readVar('--pg-text-muted', '#5b6474'),
        surface: readVar('--pg-surface', '#ffffff'),
        border: readVar('--pg-border', 'rgba(0,0,0,0.12)')
      };
    }
    return accentCache;
  }

  function invalidate() { accentCache = null; }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /** 画布内的坐标标签（列 A-… 行 1-…），供各棋种复用 */
  function drawLabels(ctx, opts) {
    var o = opts || {};
    ctx.save();
    ctx.fillStyle = o.color || accent().muted;
    ctx.font = (o.fontSize || 11) + 'px ' + (o.font || '"Segoe UI", system-ui, sans-serif');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var i;
    if (o.cols) {
      for (i = 0; i < o.cols.length; i++) {
        ctx.fillText(o.cols[i].text, o.cols[i].x, o.cols[i].y);
      }
    }
    if (o.rows) {
      for (i = 0; i < o.rows.length; i++) {
        ctx.fillText(o.rows[i].text, o.rows[i].x, o.rows[i].y);
      }
    }
    ctx.restore();
  }

  BG.canvas = {
    setup: setup,
    fit: fit,
    resize: resize,
    accent: accent,
    invalidate: invalidate,
    roundRect: roundRect,
    drawLabels: drawLabels
  };
})(window);
