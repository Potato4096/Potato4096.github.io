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

  /** 设置逻辑尺寸并按 DPR 放大物理像素，返回已缩放的 2D 上下文 */
  function setup(canvas, w, h) {
    var dpr = global.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  /** 尺寸变化（如切换棋盘路数）时重设，逻辑尺寸不变只重建缓冲 */
  function resize(canvas, ctx, w, h) {
    var dpr = global.devicePixelRatio || 1;
    if (canvas.width === Math.round(w * dpr) && canvas.height === Math.round(h * dpr)) return ctx;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
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
    resize: resize,
    accent: accent,
    invalidate: invalidate,
    roundRect: roundRect,
    drawLabels: drawLabels
  };
})(window);
