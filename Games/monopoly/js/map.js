/**
 * map.js - 大富翁 · 主棋盘（2D 平面地图）
 *
 * 页面主体就是这张 11×11 环形棋盘：格子内直接画出名称、价格、业主、房屋，
 * 不再有单独的「景点特写」面板。玩家棋子带逐格位移动画，当前玩家有脉冲光环。
 *
 * 渲染分成两层：
 *   静态层（离屏 canvas）—— 底板、40 个格子、文字。仅在数据/主题/语言变化时重绘。
 *   帧层（每帧）—— 当前格高亮、选中框、棋子动画、金额浮字。
 */
(function (root) {
  'use strict';

  var SIZE = 660;                 // 逻辑坐标
  var CELL = SIZE / 11;
  var D = root.MonopolyData;

  var views = [];
  var state = null;
  var players = [];
  var colors = null, dark = false, lang = 'zh';
  var selected = -1, turnPos = -1;
  var reduceMotion = false;

  /**
   * 摄像机：绕 (x, y) 缩放 zoom 倍。
   * 回合开始推近玩家所在区域，走格时跟随，落定后退回全景。
   */
  var cam = { zoom: 1, x: SIZE / 2, y: SIZE / 2 };
  var camFrom = { zoom: 1, x: SIZE / 2, y: SIZE / 2 };
  var camTo = { zoom: 1, x: SIZE / 2, y: SIZE / 2 };
  var camT0 = 0, camDur = 0;

  var labels = { title: '大富翁', round: '', turn: '', cash: '', dice: [0, 0], hint: '', notes: [] };

  var layer = null, lctx = null, layerKey = '';

  /* 棋子：pid -> { x, y, pos, fromX, fromY, toX, toY, t0, dur } */
  var tokens = {};
  var floaters = [];              // { x, y, text, tone, t0, dur }

  var rafId = 0, lastFrame = 0;
  var FONT = '"Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

  /* ---------------- 颜色工具 ---------------- */

  function isHex(h) { return typeof h === 'string' && /^#[0-9a-fA-F]{6}$/.test(h); }
  function hex2rgb(h) {
    if (!isHex(h)) return { r: 120, g: 128, b: 145 };
    return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) };
  }
  function rgba(h, a) {
    var c = hex2rgb(h);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }
  function mix(a, b, t) {
    var x = hex2rgb(a), y = hex2rgb(b);
    function p(v) { return ('0' + Math.round(v).toString(16)).slice(-2); }
    return '#' + p(x.r + (y.r - x.r) * t) + p(x.g + (y.g - x.g) * t) + p(x.b + (y.b - x.b) * t);
  }
  function C() {
    var c = colors || {};
    return {
      bg: c.bg || '#f6f7fb',
      surface: c.surface || '#ffffff',
      surface2: c.surface2 || '#eef0f6',
      text: c.text || '#1c2333',
      textMuted: c.textMuted || '#5b6474',
      border: c.border || '#d9dee8',
      accent: c.accent || '#4f6df5',
      success: c.success || '#22a06b',
      danger: c.danger || '#e5484d',
      warning: c.warning || '#e2a03f'
    };
  }

  function roundRect(g, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rr, y);
    g.arcTo(x + w, y, x + w, y + h, rr);
    g.arcTo(x + w, y + h, x, y + h, rr);
    g.arcTo(x, y + h, x, y, rr);
    g.arcTo(x, y, x + w, y, rr);
    g.closePath();
  }

  function cellRect(idx) {
    var p = D.cellOf(idx);
    return { x: p.x * CELL, y: p.y * CELL, w: CELL, h: CELL, col: p.x, row: p.y };
  }

  /* ---------------- 摄像机 ---------------- */

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /** 视野约束：允许露出一点棋盘外，好让角落格也能推到画面中间 */
  function camClamp(zoom, x, y) {
    if (zoom <= 1.001) return { x: SIZE / 2, y: SIZE / 2 };
    var half = SIZE / (2 * zoom);
    var over = half * 0.62;              // 最多露出 31% 的棋盘外
    var lo = half - over, hi = SIZE - half + over;
    return {
      x: Math.max(lo, Math.min(hi, x)),
      y: Math.max(lo, Math.min(hi, y))
    };
  }

  function camTo_(zoom, x, y, ms) {
    var p = camClamp(zoom, x, y);
    camFrom.zoom = cam.zoom; camFrom.x = cam.x; camFrom.y = cam.y;
    camTo.zoom = zoom; camTo.x = p.x; camTo.y = p.y;
    camT0 = performance.now();
    camDur = reduceMotion ? 0 : (ms == null ? 620 : ms);
    if (!camDur) {
      cam.zoom = camTo.zoom; cam.x = camTo.x; cam.y = camTo.y;
    }
    kick();
  }

  /** 推进摄像机补间，返回是否还在动 */
  function camStep(now) {
    if (!camDur) return false;
    var t = (now - camT0) / camDur;
    if (t >= 1) {
      cam.zoom = camTo.zoom; cam.x = camTo.x; cam.y = camTo.y; camDur = 0;
      return false;
    }
    var e = easeInOut(t < 0 ? 0 : t);
    cam.zoom = camFrom.zoom + (camTo.zoom - camFrom.zoom) * e;
    cam.x = camFrom.x + (camTo.x - camFrom.x) * e;
    cam.y = camFrom.y + (camTo.y - camFrom.y) * e;
    return true;
  }

  function camReset(instant) {
    camDur = 0;
    cam.zoom = 1; cam.x = SIZE / 2; cam.y = SIZE / 2;
    camTo.zoom = 1; camTo.x = SIZE / 2; camTo.y = SIZE / 2;
    if (!instant) kick();
  }

  function tileLabel(t) {
    if (!t.name) return '';
    if (lang !== 'en') return t.name.zh;
    // 英文名在窄格里太长，去掉通用后缀（Ave / Place / Railroad…）
    return t.name.en.replace(/\s+(Ave|Avenue|Place|Gardens|Railroad|Company|Works)$/i, '');
  }

  /** 文本换行：拉丁文按词断，中日韩按字断 */
  function wrapLines(g, text, maxW) {
    if (!text) return [];
    var latin = /^[\x20-\x7e]+$/.test(text);
    var parts = latin ? text.split(' ') : text.split('');
    var out = [], line = '';
    for (var i = 0; i < parts.length; i++) {
      var piece = latin ? (line ? ' ' + parts[i] : parts[i]) : parts[i];
      if (line && g.measureText(line + piece).width > maxW) {
        out.push(line);
        line = latin ? parts[i] : piece;
      } else {
        line += piece;
      }

      // 单个词本身就超宽：按字符拆开，避免溢出到相邻格
      if (latin && g.measureText(line).width > maxW && line.length > 1) {
        var cut = line;
        while (cut.length > 1 && g.measureText(cut).width > maxW) cut = cut.slice(0, -1);
        out.push(cut);
        line = line.slice(cut.length);
      }
    }
    if (line) out.push(line);
    return out;
  }

  function fitLines(g, text, maxW, maxLines) {
    var lines = wrapLines(g, text, maxW);

    // 中日韩文本：按总字数均分，避免出现「末行一个字」
    if (lines.length > 1 && !/[\s]/.test(text)) {
      var per = Math.ceil(text.length / lines.length);
      var flat = [];
      for (var i = 0; i < text.length; i += per) flat.push(text.slice(i, i + per));
      var fits = flat.length <= maxLines && flat.every(function (l) { return g.measureText(l).width <= maxW; });
      if (fits) lines = flat;
    }
    if (lines.length <= maxLines) return lines;
    var cut = lines.slice(0, maxLines);
    var last = cut[maxLines - 1];
    while (last.length > 1 && g.measureText(last + '…').width > maxW) last = last.slice(0, -1);
    cut[maxLines - 1] = last + '…';
    return cut;
  }

  /* ---------------- 静态层：棋盘本体 ---------------- */

  function staticKey() {
    if (!state) return '';
    return [
      state.owners.join(','), state.houses.join(','),
      lang, dark ? 1 : 0, colors ? colors.surface : '', colors ? colors.accent : '',
      labels.title, labels.round, labels.turn, labels.cash, labels.turnColor || '',
      (labels.dice || []).join('-'), (labels.notes || []).join('~')
    ].join('|');
  }

  function buildLayer() {
    if (!layer) {
      layer = document.createElement('canvas');
      lctx = layer.getContext('2d');
    }
    var sc = 2;
    layer.width = SIZE * sc;
    layer.height = SIZE * sc;
    lctx.setTransform(sc, 0, 0, sc, 0, 0);
    lctx.clearRect(0, 0, SIZE, SIZE);
    drawBoard(lctx);
    layerKey = staticKey();
  }

  function drawBoard(g) {
    var c = C();

    // 底板
    g.fillStyle = dark ? mix(c.bg, '#000000', 0.18) : mix(c.surface2, '#ffffff', 0.55);
    roundRect(g, 0, 0, SIZE, SIZE, 16);
    g.fill();
    g.strokeStyle = rgba(c.border, dark ? 0.75 : 0.95);
    g.lineWidth = 2;
    g.stroke();

    for (var i = 0; i < D.TILES.length; i++) drawTile(g, i);
    drawCenter(g, c);
  }

  function isCorner(t) {
    var p = D.cellOf(t);
    return (p.x === 0 || p.x === 10) && (p.y === 0 || p.y === 10);
  }

  /** 格子靠棋盘内侧的那条边（色条所在），以及外侧（业主条所在） */
  function edgesOf(p) {
    if (p.y === 10) return { inner: 'top', outer: 'bottom' };
    if (p.y === 0) return { inner: 'bottom', outer: 'top' };
    if (p.x === 0) return { inner: 'right', outer: 'left' };
    return { inner: 'left', outer: 'right' };
  }

  function bandRect(r, side, thick) {
    if (side === 'top') return { x: r.x, y: r.y, w: r.w, h: thick };
    if (side === 'bottom') return { x: r.x, y: r.y + r.h - thick, w: r.w, h: thick };
    if (side === 'left') return { x: r.x, y: r.y, w: thick, h: r.h };
    return { x: r.x + r.w - thick, y: r.y, w: thick, h: r.h };
  }

  /**
   * 每格分成两个区：
   *   棋子区 —— 紧贴棋盘内侧的一条窄带，棋子永远站在这里，不会压到地名。
   *   标签区 —— 外侧剩余部分，放地名、价格与图标。
   */
  function zones(r, p, idx) {
    var inner;
    if (isCorner(idx)) inner = p.y === 10 ? 'top' : 'bottom';
    else inner = edgesOf(p).inner;

    var band = isCorner(idx) ? 0 : 8;   // 色条宽度
    var open = 0;                        // 棋子不占文字区，站在格子内缘
    var strip, plate;
    if (inner === 'top') {
      strip = { x: r.x, y: r.y + band, w: r.w, h: open };
      plate = { x: r.x, y: r.y + band + open, w: r.w, h: r.h - band - open };
    } else if (inner === 'bottom') {
      strip = { x: r.x, y: r.y + r.h - band - open, w: r.w, h: open };
      plate = { x: r.x, y: r.y, w: r.w, h: r.h - band - open };
    } else if (inner === 'left') {
      strip = { x: r.x + band, y: r.y, w: open, h: r.h };
      plate = { x: r.x + band + open, y: r.y, w: r.w - band - open, h: r.h };
    } else {
      strip = { x: r.x + r.w - band - open, y: r.y, w: open, h: r.h };
      plate = { x: r.x, y: r.y, w: r.w - band - open, h: r.h };
    }
    return { inner: inner, band: band, strip: strip, plate: plate };
  }

  /**
   * 房屋标记：一栋一个实心小方块（竖边也读得懂），第五栋合并成一条旅馆。
   * 方块比"小房子"轮廓更耐看——后者在细长窄条里会被看成箭头。
   */
  function drawHouses(g, r, bar, side, houses) {
    var c = C();
    var horizontal = side === 'top' || side === 'bottom';
    var hotel = houses >= 5;
    var n = hotel ? 1 : Math.max(1, houses);
    var unit = hotel ? 15 : 5.6, gap = hotel ? 0 : 1.5, thick = 5;
    var total = n * unit + (n - 1) * gap;
    var ink = rgba(c.text, hotel ? 0.86 : 0.66);

    for (var h = 0; h < n; h++) {
      var off = h * (unit + gap);
      var hx = horizontal ? r.x + (r.w - total) / 2 + off : bar.x + (bar.w - thick) / 2;
      var hy = horizontal ? bar.y + (bar.h - thick) / 2 : r.y + (r.h - total) / 2 + off;
      var hw = horizontal ? unit : thick;
      var hh = horizontal ? thick : unit;

      g.fillStyle = ink;
      roundRect(g, hx, hy, hw, hh, 1.2);
      g.fill();

      if (hotel) {
        // 旅馆：中间开一条浅缝，和 4 栋并排区分开
        g.fillStyle = rgba(c.bg, 0.5);
        if (horizontal) g.fillRect(hx + 2.4, hy + 1.15, hw - 4.8, 0.9);
        else g.fillRect(hx + 1.15, hy + 2.4, 0.9, hh - 4.8);
      }
    }
  }

  function drawTile(g, idx) {
    var c = C();
    var t = D.TILES[idx];
    var r = cellRect(idx);
    var p = D.cellOf(idx);
    var corner = isCorner(idx);
    var owner = state.owners[idx];
    var houses = state.houses[idx] || 0;
    var ownerColor = owner >= 0 && state.players[owner] ? state.players[owner].color : null;
    var z = zones(r, p, idx);

    // 格子一律用中性底色：分组色搬到右侧详情卡里，避免和业主色混淆
    g.fillStyle = dark ? mix(c.bg, '#000000', 0.12) : mix(c.surface, '#ffffff', 0.2);
    g.fillRect(r.x + 0.6, r.y + 0.6, r.w - 1.2, r.h - 1.2);

    g.strokeStyle = rgba(c.border, dark ? 0.5 : 0.72);
    g.lineWidth = 1;
    g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

    // 内侧留出一条淡淡的落脚带：只有盖了房才画出来
    if (houses > 0) {
      var bar = bandRect(r, z.inner, 8);
      g.fillStyle = rgba(c.text, dark ? 0.12 : 0.07);
      g.fillRect(bar.x, bar.y, bar.w, bar.h);
      drawHouses(g, r, bar, z.inner, houses);
    }

    // 业主色条（外侧）：全格唯一的颜色，谁的地一眼就分得清
    if (ownerColor) {
      var ob = bandRect(r, edgesOf(p).outer, corner ? 5.2 : 5);
      g.fillStyle = ownerColor;
      g.fillRect(ob.x, ob.y, ob.w, ob.h);
    }

    var plate = z.plate;
    var box = { x: plate.x + 3, y: plate.y + 2.8, w: plate.w - 6, h: plate.h - 5.6 };
    if (z.inner === 'left') box.x += 1;
    if (z.inner === 'right') box.w -= 1;

    g.textAlign = 'center';
    g.textBaseline = 'middle';

    if (corner) {
      drawCorner(g, t, box, c);
      return;
    }

    var priceText = t.price ? ('$' + t.price) : (t.type === 'tax' ? ('$' + t.amount) : '');
    var priceH = priceText ? 8.4 : 0;
    var cx = box.x + box.w / 2;
    var nameFont = plate.w > plate.h ? 9.4 : 9.2;
    var label = tileLabel(t);

    // 拉丁文：先按最长单词缩字号，避免单词被硬拆
    if (/\s/.test(label) || /^[\x20-\x7e]+$/.test(label)) {
      var longest = label.split(' ').reduce(function (a, b) { return b.length > a.length ? b : a; }, '');
      g.font = '600 ' + nameFont + 'px ' + FONT;
      while (nameFont > 7.2 && g.measureText(longest).width > box.w) {
        nameFont = Math.round((nameFont - 0.3) * 10) / 10;
        g.font = '600 ' + nameFont + 'px ' + FONT;
      }
    }

    if (t.type === 'property') {
      g.font = '600 ' + nameFont + 'px ' + FONT;
      g.fillStyle = rgba(c.text, 0.94);
      var lines = fitLines(g, tileLabel(t), box.w, 3);
      var lh = nameFont + 1.3;
      var startY = box.y + (box.h - priceH - lines.length * lh) / 2 + lh / 2;
      for (var i = 0; i < lines.length; i++) g.fillText(lines[i], cx, startY + i * lh);

      if (priceText) {
        g.font = '600 7.6px ' + FONT;
        g.fillStyle = ownerColor ? rgba(c.text, 0.8) : rgba(c.textMuted, 0.95);
        g.fillText(priceText, cx, box.y + box.h - 4.6);
      }
      return;
    }

    // 非地产格：图标 + 名称
    var iconY = box.y + 6.6;
    drawIcon(g, t, cx, iconY, c);

    g.font = '600 ' + (nameFont - 0.4) + 'px ' + FONT;
    g.fillStyle = rgba(c.text, 0.88);
    var nl = fitLines(g, tileLabel(t), box.w, plate.h > plate.w ? 3 : 2);
    var nlh = 9.4;
    var labelTop = iconY + 8;
    var ny = labelTop + (box.y + box.h - priceH - labelTop - nl.length * nlh) / 2 + nlh / 2;
    for (var k = 0; k < nl.length; k++) g.fillText(nl[k], cx, ny + k * nlh);

    if (priceText) {
      g.font = '600 7.4px ' + FONT;
      g.fillStyle = rgba(c.textMuted, 0.95);
      g.fillText(priceText, cx, box.y + box.h - 4.4);
    }
  }

  function drawCorner(g, t, box, c) {
    var color = (D.TYPES[t.type] || {}).color || c.text;
    var label = tileLabel(t).split(' / ')[0];
    var cx = box.x + box.w / 2;
    var midY = box.y + box.h / 2;
    var glyph = t.type === 'go' ? 'GO' : (t.type === 'parking' ? 'P' : '!');
    // 英文下 GO 的徽标与地名同名，只留居中徽标，避免重复
    var dup = lang === 'en' && t.type === 'go';
    // 内部朝向棋盘中心的那条边留给棋子，徽标与地名整体往外侧让 3.6px
    var dy = dup ? 7 : ((D.cellOf(t.i).y === 10) ? 3.6 : -3.6);

    var badge = 19;
    g.fillStyle = rgba(color, dark ? 0.22 : 0.13);
    roundRect(g, cx - badge / 2, midY - badge / 2 - 7 + dy, badge, badge, 5);
    g.fill();
    g.strokeStyle = rgba(color, 0.45);
    g.lineWidth = 1.1;
    g.stroke();

    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (t.type === 'jail') {
      g.strokeStyle = rgba(color, 0.95);
      g.lineWidth = 1.7;
      for (var b = 0; b < 3; b++) {
        g.beginPath();
        g.moveTo(cx - 4 + b * 4, midY - 12 + dy);
        g.lineTo(cx - 4 + b * 4, midY - 2 + dy);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(cx - 7, midY - 12.6 + dy);
      g.lineTo(cx + 7, midY - 12.6 + dy);
      g.stroke();
    } else {
      g.font = (glyph.length > 1 ? '700 8px ' : '700 12px ') + FONT;
      g.fillStyle = rgba(color, 0.95);
      g.fillText(glyph, cx, midY - 6.6 + dy);
    }

    if (dup) return;

    g.font = '700 9.6px ' + FONT;
    g.fillStyle = rgba(c.text, 0.9);
    var lines = fitLines(g, label, box.w - 2, 2);
    for (var i = 0; i < lines.length; i++) {
      g.fillText(lines[i], cx, midY + badge / 2 + 3 + i * 10.4 + dy);
    }
  }

  /** 非地产格的小图标（矢量，避免 emoji 跨平台差异） */
  function drawIcon(g, t, cx, cy, c) {
    var ink = rgba(c.text, 0.55);
    var s = 1;

    if (t.type === 'railroad') {
      g.strokeStyle = ink;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(cx - 3.6 * s, cy - 5.6); g.lineTo(cx - 3.6 * s, cy + 5.6);
      g.moveTo(cx + 3.6 * s, cy - 5.6); g.lineTo(cx + 3.6 * s, cy + 5.6);
      g.stroke();
      g.lineWidth = 1.1;
      for (var i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(cx - 4.6, cy - 3.6 + i * 3.6);
        g.lineTo(cx + 4.6, cy - 3.6 + i * 3.6);
        g.stroke();
      }
      return;
    }

    if (t.type === 'utility') {
      var water = t.id === 'water';
      g.fillStyle = water ? '#4a9fd0' : '#d9a12e';
      if (water) {
        g.beginPath();
        g.moveTo(cx, cy - 5.6);
        g.bezierCurveTo(cx + 4.4, cy - 0.6, cx + 3.6, cy + 5, cx, cy + 5);
        g.bezierCurveTo(cx - 3.6, cy + 5, cx - 4.4, cy - 0.6, cx, cy - 5.6);
        g.fill();
      } else {
        g.beginPath();
        g.moveTo(cx + 1.2, cy - 6.2);
        g.lineTo(cx - 3.8, cy + 0.6);
        g.lineTo(cx - 0.6, cy + 0.6);
        g.lineTo(cx - 1.8, cy + 6.2);
        g.lineTo(cx + 3.8, cy - 1.2);
        g.lineTo(cx + 0.6, cy - 1.2);
        g.closePath();
        g.fill();
      }
      return;
    }

    if (t.type === 'chance') {
      g.fillStyle = '#d97b28';
      g.font = '700 13px ' + FONT;
      g.fillText('?', cx, cy + 0.5);
      return;
    }

    if (t.type === 'chest') {
      g.fillStyle = '#3f8fc4';
      roundRect(g, cx - 5.4, cy - 2.4, 10.8, 6.6, 1.4);
      g.fill();
      g.fillStyle = '#2f6f9c';
      roundRect(g, cx - 5.4, cy - 5.6, 10.8, 4, 1.4);
      g.fill();
      g.fillStyle = '#f4d06a';
      g.fillRect(cx - 1, cy - 5.6, 2, 9.8);
      return;
    }

    if (t.type === 'tax') {
      g.fillStyle = '#c25a4a';
      g.font = '700 12px ' + FONT;
      g.fillText('$', cx, cy + 0.5);
      return;
    }

    if (t.type === 'gotojail') {
      g.fillStyle = '#d4484b';
      g.fillRect(cx - 6, cy - 2.2, 5.2, 5);
      g.fillStyle = '#3b6cff';
      g.fillRect(cx + 0.8, cy - 2.2, 5.2, 5);
      g.fillStyle = rgba(c.text, 0.45);
      g.fillRect(cx - 7, cy + 4, 14, 2);
    }
  }

  /* ---------------- 中央信息区 ---------------- */

  function drawDie(g, x, y, size, value, c) {
    g.fillStyle = dark ? mix(c.surface, '#ffffff', 0.05) : '#ffffff';
    roundRect(g, x, y, size, size, size * 0.22);
    g.fill();
    g.strokeStyle = rgba(c.border, dark ? 0.9 : 1);
    g.lineWidth = 1.6;
    g.stroke();

    if (!value) {
      // 还没掷骰：画一条短横线，避免出现两个空白方块
      g.fillStyle = rgba(c.textMuted, 0.4);
      g.font = '700 ' + Math.round(size * 0.34) + 'px ' + FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('–', x + size / 2, y + size / 2);
      return;
    }

    var pips = {
      1: [[0, 0]],
      2: [[-1, -1], [1, 1]],
      3: [[-1, -1], [0, 0], [1, 1]],
      4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
      6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]
    }[value] || [];
    var r = size * 0.075;
    var step = size * 0.235;
    g.fillStyle = value ? rgba(c.text, 0.82) : rgba(c.textMuted, 0.45);
    for (var i = 0; i < pips.length; i++) {
      g.beginPath();
      g.arc(x + size / 2 + pips[i][0] * step, y + size / 2 + pips[i][1] * step, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawCenter(g, c) {
    var cx = SIZE / 2;
    var cy = SIZE / 2;
    var inner = CELL + 13;

    // 中央底色
    var grad = g.createLinearGradient(inner, inner, SIZE - inner, SIZE - inner);
    grad.addColorStop(0, rgba(c.accent, dark ? 0.13 : 0.06));
    grad.addColorStop(1, rgba(c.accent, dark ? 0.03 : 0.015));
    g.fillStyle = grad;
    roundRect(g, inner, inner, SIZE - inner * 2, SIZE - inner * 2, 14);
    g.fill();

    g.strokeStyle = rgba(c.border, dark ? 0.55 : 0.8);
    g.lineWidth = 1.2;
    g.setLineDash([5, 5]);
    g.stroke();
    g.setLineDash([]);

    g.textAlign = 'center';
    g.textBaseline = 'middle';

    // 标题
    g.fillStyle = rgba(c.text, 0.9);
    g.font = '800 30px ' + FONT;
    g.fillText(labels.title || '', cx, cy - 118);

    g.fillStyle = rgba(c.accent, 0.9);
    g.font = '600 11px ' + FONT;
    g.fillText((labels.round || '').toUpperCase(), cx, cy - 90);

    // 当前玩家卡片
    var cardW = 214, cardH = 54;
    var cardY = cy - 68;
    g.fillStyle = dark ? mix(c.surface, '#ffffff', 0.06) : '#ffffff';
    roundRect(g, cx - cardW / 2, cardY, cardW, cardH, 12);
    g.fill();
    g.strokeStyle = rgba(c.border, dark ? 0.8 : 1);
    g.lineWidth = 1.4;
    g.stroke();

    if (labels.turn) {
      g.fillStyle = labels.turnColor || c.accent;
      g.beginPath();
      g.arc(cx - cardW / 2 + 22, cardY + cardH / 2, 8, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = dark ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.95)';
      g.lineWidth = 2;
      g.stroke();

      g.textAlign = 'start';
      g.fillStyle = rgba(c.text, 0.94);
      g.font = '700 14px ' + FONT;
      g.fillText(labels.turn, cx - cardW / 2 + 40, cardY + 20);

      g.fillStyle = rgba(c.textMuted, 0.95);
      g.font = '600 11.5px ' + FONT;
      g.fillText(labels.cash || '', cx - cardW / 2 + 40, cardY + 37);
      g.textAlign = 'center';
    }

    // 骰子
    var dsize = 40, gap = 14;
    var dy = cy + 12;
    drawDie(g, cx - gap / 2 - dsize, dy, dsize, labels.dice && labels.dice[0], c);
    drawDie(g, cx + gap / 2, dy, dsize, labels.dice && labels.dice[1], c);

    g.fillStyle = rgba(c.textMuted, 0.85);
    g.font = '11.5px ' + FONT;
    g.fillText(labels.hint || '', cx, cy + 88);

    if (labels.notes && labels.notes.length) {
      g.strokeStyle = rgba(c.border, 0.9);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx - 96, cy + 108);
      g.lineTo(cx + 96, cy + 108);
      g.stroke();

      g.font = '11px ' + FONT;
      for (var n = 0; n < labels.notes.length; n++) {
        g.fillStyle = rgba(c.textMuted, n === 0 ? 0.9 : 0.6);
        g.fillText(labels.notes[n], cx, cy + 126 + n * 17);
      }
    }
  }

  /* ---------------- 棋子 ---------------- */

  /** 棋子站位：贴着格子内缘一字排开，人多时自动缩小；角格更挤，整体收一档 */
  function tokenSlots(n, corner) {
    var k = corner ? 0.84 : 1;
    var list;
    if (n <= 1) list = [{ a: 0, d: 0, r: 8.4 }];
    else if (n === 2) list = [{ a: -9.6, d: 0, r: 7.2 }, { a: 9.6, d: 0, r: 7.2 }];
    else if (n === 3) list = [{ a: -16, d: 0, r: 6.2 }, { a: 0, d: 0, r: 6.2 }, { a: 16, d: 0, r: 6.2 }];
    else list = [
      { a: -21.6, d: 0, r: 5.6 }, { a: -7.2, d: 0, r: 5.6 },
      { a: 7.2, d: 0, r: 5.6 }, { a: 21.6, d: 0, r: 5.6 }
    ];
    if (!corner) return list;
    return list.map(function (s) { return { a: s.a * k, d: s.d, r: s.r * k }; });
  }

  function tokenAnchor(r, side, band, corner) {
    var depth = corner ? 6.6 : (band ? band - 1 : 8);
    if (side === 'top') return { x: r.x + r.w / 2, y: r.y + depth, axis: 'x' };
    if (side === 'bottom') return { x: r.x + r.w / 2, y: r.y + r.h - depth, axis: 'x' };
    if (side === 'left') return { x: r.x + depth, y: r.y + r.h / 2, axis: 'y' };
    return { x: r.x + r.w - depth, y: r.y + r.h / 2, axis: 'y' };
  }

  function syncTokens() {
    var now = performance.now();
    var groups = {};
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (!p.alive) continue;
      (groups[p.pos] = groups[p.pos] || []).push(p);
    }

    var seen = {};
    Object.keys(groups).forEach(function (posKey) {
      var pos = parseInt(posKey, 10);
      var list = groups[posKey];
      var r = cellRect(pos);
      var z = zones(r, D.cellOf(pos), pos);
      var corner = isCorner(pos);
      var anchor = tokenAnchor(r, z.inner, z.band, corner);
      var slots = tokenSlots(list.length, corner);

      list.forEach(function (p, k) {
        seen[p.id] = true;
        var slot = slots[k] || slots[0];
        // a：沿边方向；d：朝格内方向
        var tx = anchor.x + (anchor.axis === 'x' ? slot.a : slot.d);
        var ty = anchor.y + (anchor.axis === 'x' ? slot.d : slot.a);
        var rad = slot.r;
        var tk = tokens[p.id];

        if (!tk) {
          tokens[p.id] = {
            x: tx, y: ty, pos: p.pos, fromX: tx, fromY: ty, toX: tx, toY: ty,
            t0: 0, dur: 0, color: p.color, r: rad, corner: corner
          };
          return;
        }

        tk.color = p.color;
        tk.r = rad;
        tk.corner = corner;
        if (tk.pos !== p.pos) {
          // 换格：从当前显示位置滑到新格（drawTokens 里再叠一个跳跃弧线）
          tk.fromX = tk.x;
          tk.fromY = tk.y;
          tk.toX = tx;
          tk.toY = ty;
          tk.t0 = now;
          tk.dur = reduceMotion ? 0 : 210;
          tk.pos = p.pos;
        } else if (tk.dur && now - tk.t0 < tk.dur) {
          // 动画中：同步终点（同格内其它棋子离开会改变槽位）
          tk.toX = tx;
          tk.toY = ty;
        } else {
          tk.x = tx;
          tk.y = ty;
          tk.toX = tx;
          tk.toY = ty;
          tk.dur = 0;
        }
      });
    });

    Object.keys(tokens).forEach(function (pid) {
      if (!seen[pid]) delete tokens[pid];
    });
  }

  /** 返回当前显示位置；hop 为 0~1 的跳跃进度（0 表示已落定） */
  function tokenPos(tk, now) {
    if (!tk.dur) return { x: tk.x, y: tk.y, hop: 0 };
    var t = (now - tk.t0) / tk.dur;
    if (t >= 1) {
      tk.x = tk.toX; tk.y = tk.toY; tk.dur = 0;
      return { x: tk.x, y: tk.y, hop: 0 };
    }
    var e = 1 - Math.pow(1 - t, 3);
    tk.x = tk.fromX + (tk.toX - tk.fromX) * e;
    tk.y = tk.fromY + (tk.toY - tk.fromY) * e;
    return { x: tk.x, y: tk.y, hop: t };
  }

  function drawTokens(g, now) {
    var c = C();
    var t = now / 1000;
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var tk = tokens[p.id];
      if (!tk || !p.alive) continue;
      var pos = tokenPos(tk, now);
      var isTurn = p.id === state.players[state.turn].id && p.pos === turnPos;
      var r = isTurn ? (tk.corner ? tk.r + 1.5 : Math.max(8.6, tk.r + 1.2)) : tk.r;
      if (pos.hop > 0) {
        // 逐格移动：抛物线跳一下 + 轻微放大，落点更明确
        var arc = Math.sin(Math.PI * pos.hop);
        pos.y -= arc * 7.5;
        r *= 1 + 0.16 * arc;
      }
      if (isTurn && !reduceMotion) pos.y += Math.sin(t * 3.1) * 1.2;

      // 当前玩家：静态描边（减少动画时）或脉冲光环
      if (isTurn && reduceMotion) {
        g.beginPath();
        g.arc(pos.x, pos.y, r + 3, 0, Math.PI * 2);
        g.strokeStyle = rgba(p.color, 0.55);
        g.lineWidth = 2;
        g.stroke();
      }
      if (isTurn && !reduceMotion) {
        var pulse = (Math.sin(t * 3.1) + 1) / 2;
        g.beginPath();
        g.arc(pos.x, pos.y, r + 4 + pulse * 5, 0, Math.PI * 2);
        g.fillStyle = rgba(p.color, 0.16 + 0.12 * (1 - pulse));
        g.fill();
        g.beginPath();
        g.arc(pos.x, pos.y, r + 2.5 + pulse * 3, 0, Math.PI * 2);
        g.strokeStyle = rgba(p.color, 0.5 + 0.4 * (1 - pulse));
        g.lineWidth = 1.6;
        g.stroke();
      }

      // 阴影
      g.beginPath();
      g.ellipse ? g.ellipse(pos.x, pos.y + r - 1, r * 0.9, r * 0.4, 0, 0, Math.PI * 2)
        : g.arc(pos.x, pos.y + r - 1, r * 0.5, 0, Math.PI * 2);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fill();

      // 棋子本体
      g.beginPath();
      g.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      g.fillStyle = p.color;
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = dark ? 'rgba(10,14,22,0.9)' : 'rgba(255,255,255,0.98)';
      g.stroke();

      g.fillStyle = '#ffffff';
      g.font = '700 ' + (r > 7 ? 8.6 : 7.6) + 'px ' + FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(p.id + 1), pos.x, pos.y + 0.3);
    }
  }

  function drawFloaters(g, now) {
    var c = C();
    for (var i = floaters.length - 1; i >= 0; i--) {
      var f = floaters[i];
      var t = (now - f.t0) / f.dur;
      if (t >= 1) { floaters.splice(i, 1); continue; }
      var y = f.y - t * 26;
      var alpha = t < 0.15 ? t / 0.15 : 1 - Math.max(0, (t - 0.55) / 0.45);
      g.font = '700 11px ' + FONT;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 3;
      g.strokeStyle = dark ? 'rgba(6,10,18,0.75)' : 'rgba(255,255,255,0.9)';
      g.strokeText(f.text, f.x, y);
      g.fillStyle = rgba(f.tone === 'loss' ? c.danger : c.success, Math.max(0, alpha));
      g.fillText(f.text, f.x, y);
    }
  }

  /* ---------------- 帧渲染 ---------------- */

  function drawOverlay(g, now) {
    var c = C();
    var pulse = reduceMotion ? 0.5 : (Math.sin(now / 420) + 1) / 2;
    var inv = 1 / cam.zoom;   // 描边在屏幕上保持恒定粗细

    // 当前玩家所在格
    if (turnPos >= 0) {
      var r = cellRect(turnPos);
      g.fillStyle = rgba(c.accent, 0.10 + 0.07 * pulse);
      roundRect(g, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 5);
      g.fill();
      g.strokeStyle = rgba(c.accent, 0.55 + 0.4 * pulse);
      g.lineWidth = 3 * inv;
      roundRect(g, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 5);
      g.stroke();
    }

    // 选中格
    if (selected >= 0 && selected !== turnPos) {
      var sr = cellRect(selected);
      g.strokeStyle = rgba(c.warning, 0.95);
      g.lineWidth = 2.4 * inv;
      g.setLineDash([5 * inv, 4 * inv]);
      roundRect(g, sr.x + 3, sr.y + 3, sr.w - 6, sr.h - 6, 5);
      g.stroke();
      g.setLineDash([]);
    }

    drawTokens(g, now);
    drawFloaters(g, now);
  }

  function renderFrame(now) {
    if (!state) return;
    for (var vi = 0; vi < views.length; vi++) {
      var view = views[vi];
      if (!view.canvas.isConnected) continue;
      var g = view.ctx;
      var rect = view.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;

      var dpr = root.devicePixelRatio || 1;
      var bw = Math.max(1, Math.round(rect.width * dpr));
      var bh = Math.max(1, Math.round(rect.height * dpr));
      if (view.canvas.width !== bw || view.canvas.height !== bh) {
        view.canvas.width = bw;
        view.canvas.height = bh;
      }
      var scale = Math.min(bw / SIZE, bh / SIZE);
      g.setTransform(scale, 0, 0, scale, (bw - SIZE * scale) / 2, (bh - SIZE * scale) / 2);
      g.clearRect(-4, -4, SIZE + 8, SIZE + 8);

      // 摄像机变换：(cam.x, cam.y) 是"镜头对准的棋盘坐标"，始终落在画布中心
      var zoomed = cam.zoom > 1.02;
      g.save();
      if (zoomed) {
        g.translate(SIZE / 2, SIZE / 2);
        g.scale(cam.zoom, cam.zoom);
        g.translate(-cam.x, -cam.y);
      }

      if (!layer || layerKey !== staticKey()) buildLayer();
      if (zoomed) {
        // 推近时直接走矢量，避免缓存图层被拉糊；
        // 先在棋盘外铺一层比底板深一档的"桌面"，再给棋盘投一层阴影，
        // 镜头越过边缘时才不会露出一块没画完的空白。
        var cc = C();
        g.fillStyle = dark ? mix(cc.bg, '#000000', 0.52) : mix(cc.bg, cc.text, 0.1);
        g.fillRect(cam.x - SIZE, cam.y - SIZE, SIZE * 2, SIZE * 2);

        g.save();
        g.shadowColor = dark ? 'rgba(0,0,0,0.62)' : 'rgba(15,23,42,0.2)';
        g.shadowBlur = 26 / cam.zoom;          // 除以 zoom：屏幕上看起来粗细恒定
        g.shadowOffsetY = 9 / cam.zoom;
        g.fillStyle = dark ? mix(cc.bg, '#000000', 0.18) : mix(cc.surface2, '#ffffff', 0.55);
        roundRect(g, 0, 0, SIZE, SIZE, 16);
        g.fill();
        g.restore();

        drawBoard(g);
      } else {
        g.drawImage(layer, 0, 0, SIZE, SIZE);
      }
      drawOverlay(g, now);
      g.restore();
    }
  }

  function loop(now) {
    rafId = 0;
    if (!state || !views.length) return;
    var moving = camStep(now);
    if (reduceMotion && !moving) { renderFrame(now); return; }
    if (root.document.hidden) return;
    if (now - lastFrame < 24) {          // 约 40fps，够顺滑也不烧电
      rafId = requestAnimationFrame(loop);
      return;
    }
    lastFrame = now;
    renderFrame(now);
    rafId = requestAnimationFrame(loop);
  }

  function kick() {
    if (reduceMotion) {
      renderFrame(performance.now());
      return;
    }
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  function indexAt(px, py) {
    var c = Math.floor(px / CELL), r = Math.floor(py / CELL);
    if (c < 0 || c > 10 || r < 0 || r > 10) return -1;
    if (c === 10 && r === 10) return 0;
    if (c === 0 && r === 10) return 10;
    if (c === 0 && r === 0) return 20;
    if (c === 10 && r === 0) return 30;
    if (r === 10 && c >= 1 && c <= 9) return 10 - c;
    if (c === 0 && r >= 1 && r <= 9) return 10 + (10 - r);
    if (r === 0 && c >= 1 && c <= 9) return 20 + c;
    if (c === 10 && r >= 1 && r <= 9) return 30 + r;
    return -1;
  }

  var Map2D = {
    attach: function (cv, opts) {
      var view = { canvas: cv, ctx: cv.getContext('2d'), onPick: (opts && opts.onPick) || null };
      views.push(view);

      cv.addEventListener('click', function (ev) {
        if (!view.onPick) return;
        var rect = cv.getBoundingClientRect();
        var scale = Math.min(rect.width, rect.height) / SIZE;
        var ox = (rect.width - SIZE * scale) / 2;
        var oy = (rect.height - SIZE * scale) / 2;
        var lx = (ev.clientX - rect.left - ox) / scale;
        var ly = (ev.clientY - rect.top - oy) / scale;
        // 反解摄像机：x = (x' - SIZE/2) / zoom + cam.x
        if (cam.zoom > 1.001) {
          lx = (lx - SIZE / 2) / cam.zoom + cam.x;
          ly = (ly - SIZE / 2) / cam.zoom + cam.y;
        }
        var idx = indexAt(lx, ly);
        if (idx >= 0) view.onPick(idx);
      });

      kick();
      return view;
    },

    /** 空棋盘：还没开局时先画一张没有归属的棋盘，避免大块空白 */
    idle: function (opts) {
      var owners = [], houses = [];
      for (var i = 0; i < D.TILES.length; i++) { owners.push(-1); houses.push(0); }
      state = {
        owners: owners, houses: houses, players: [], turn: 0, dice: [0, 0]
      };
      players = [];
      tokens = {};
      floaters = [];
      turnPos = -1;
      selected = -1;
      camReset(true);
      if (opts && opts.lang) lang = opts.lang;
      if (opts && opts.labels) {
        for (var k in opts.labels) {
          if (Object.prototype.hasOwnProperty.call(opts.labels, k)) labels[k] = opts.labels[k];
        }
      }
      layerKey = '';
      kick();
    },

    update: function (s, playerList, opts) {
      state = s;
      players = playerList || s.players;
      turnPos = s.players[s.turn] ? s.players[s.turn].pos : -1;
      if (opts) {
        if (opts.labels) {
          for (var k in opts.labels) {
            if (Object.prototype.hasOwnProperty.call(opts.labels, k)) labels[k] = opts.labels[k];
          }
        }
        if (opts.lang) lang = opts.lang;
        if (opts.selected != null) selected = opts.selected;
      }
      syncTokens();
      kick();
    },

    select: function (idx) { selected = idx; kick(); },

    /** 推近某格（回合开始重点展示玩家所在区域） */
    focus: function (idx, zoom, ms) {
      var r = cellRect(idx);
      camTo_(zoom || 2.15, r.x + r.w / 2, r.y + r.h / 2, ms);
    },

    /** 走格时保持推近视野并跟住棋子 */
    follow: function (idx, zoom, ms) {
      var r = cellRect(idx);
      camTo_(zoom == null ? Math.max(1.6, cam.zoom) : zoom,
        r.x + r.w / 2, r.y + r.h / 2, ms == null ? 240 : ms);
    },

    /** 退回全景 */
    unfocus: function (ms) { camTo_(1, SIZE / 2, SIZE / 2, ms == null ? 700 : ms); },

    /** 当前镜头状态（调试 / 测试用） */
    cam: function () { return { zoom: cam.zoom, x: cam.x, y: cam.y, moving: camDur > 0 }; },

    /** 金额浮字：在玩家棋子位置弹出 +$200 / -$50 */
    pop: function (pid, text, tone) {
      var tk = tokens[pid];
      if (!tk) return;
      var pos = tokenPos(tk, performance.now());
      floaters.push({ x: pos.x, y: pos.y - 9, text: text, tone: tone || 'gain', t0: performance.now(), dur: 1100 });
      if (floaters.length > 12) floaters.shift();
      kick();
    },

    setTheme: function (c, isDark) {
      colors = c;
      dark = !!isDark;
      layerKey = '';
      kick();
    },

    setReduceMotion: function (v) {
      reduceMotion = !!v;
      kick();
    },

    /** 小屏上把某个格子滚进可视范围（棋盘比容器宽时才有意义） */
    revealTile: function (idx) {
      var view = views[0];
      if (!view || !view.canvas.isConnected) return;
      var scroller = view.canvas.closest ? view.canvas.closest('.board-scroll') : null;
      if (!scroller || !scroller.scrollTo) return;
      if (scroller.scrollWidth <= scroller.clientWidth + 2) return;

      var rect = view.canvas.getBoundingClientRect();
      var scale = Math.min(rect.width, rect.height) / SIZE;
      var ox = (rect.width - SIZE * scale) / 2;
      var p = D.cellOf(idx);
      var cx = ox + (p.x + 0.5) * CELL * scale;
      var left = scroller.scrollLeft;
      var pad = 26;
      if (cx > left + scroller.clientWidth - pad || cx < left + pad) {
        var target = cx - scroller.clientWidth / 2;
        var max = scroller.scrollWidth - scroller.clientWidth;
        scroller.scrollTo({ left: Math.max(0, Math.min(target, max)), behavior: 'smooth' });
      }
    },

    render: function () { kick(); },
    resize: function () { kick(); }
  };

  root.addEventListener('resize', function () { kick(); });
  if (root.document) {
    root.document.addEventListener('visibilitychange', function () {
      if (!root.document.hidden) kick();
    });
  }

  root.MonopolyMap = Map2D;
})(typeof window !== 'undefined' ? window : this);
