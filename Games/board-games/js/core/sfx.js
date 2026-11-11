/**
 * core/sfx.js - 程序合成音效（不加载音频文件）
 *
 * 平台设置里关掉音效时所有发声静默；AudioContext 延迟创建，
 * 首次交互时才初始化，避免自动播放策略告警。
 */
(function (global) {
  'use strict';

  var BG = global.BG || (global.BG = {});

  var ctx = null;

  function enabled() {
    try {
      return !(global.GamePlatform && global.GamePlatform.ui) ||
        global.GamePlatform.ui.isSoundEnabled();
    } catch (e) {
      return true;
    }
  }

  function ac() {
    if (!ctx) {
      var Ctor = global.AudioContext || global.webkitAudioContext;
      if (!Ctor) return null;
      try { ctx = new Ctor(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) { /* 忽略 */ }
    }
    return ctx;
  }

  /** 单个音：freq 频率、dur 时长、type 波形、gain 音量、delay 延迟(ms) */
  function tone(freq, dur, type, gain, delay) {
    if (!enabled()) return;
    var c = ac();
    if (!c) return;
    var startAt = c.currentTime + (delay || 0) / 1000;
    try {
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, startAt);
      g.gain.exponentialRampToValueAtTime(gain || 0.07, startAt + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(startAt);
      o.stop(startAt + dur + 0.02);
    } catch (e) { /* 忽略音频异常，不影响对局 */ }
  }

  function seq(notes) {
    (notes || []).forEach(function (n) {
      tone(n[0], n[1], n[2], n[3], n[4]);
    });
  }

  BG.sfx = {
    enabled: enabled,
    tone: tone,
    seq: seq,

    /** 落子 / 走子 */
    place: function (freq) { tone(freq || 620, 0.055, 'triangle', 0.075); },
    /** 落子后的木质回响，棋盘类游戏更贴切 */
    stone: function () {
      tone(430, 0.045, 'square', 0.035);
      tone(760, 0.03, 'triangle', 0.03, 12);
    },
    /** 吃子 / 提子 */
    capture: function () {
      tone(300, 0.07, 'sawtooth', 0.05);
      tone(200, 0.09, 'sine', 0.045, 45);
    },
    /** 按钮、选中 */
    click: function () { tone(520, 0.03, 'sine', 0.04); },
    select: function () { tone(700, 0.04, 'triangle', 0.05); },
    /** 悔棋、退格 */
    undo: function () { tone(300, 0.09, 'sine', 0.055); },
    /** 将军、威胁提示 */
    alert: function () {
      tone(880, 0.08, 'square', 0.05);
      tone(660, 0.1, 'square', 0.045, 90);
    },
    /** 获胜 */
    win: function () {
      seq([[523, 0.16, 'triangle', 0.075, 0],
        [659, 0.16, 'triangle', 0.075, 120],
        [784, 0.16, 'triangle', 0.075, 240],
        [1046, 0.24, 'triangle', 0.08, 360]]);
    },
    /** 落败 */
    lose: function () {
      seq([[392, 0.18, 'sine', 0.06, 0],
        [330, 0.2, 'sine', 0.06, 140],
        [262, 0.3, 'sine', 0.055, 300]]);
    },
    /** 平局 */
    draw: function () {
      seq([[440, 0.14, 'triangle', 0.06, 0],
        [440, 0.18, 'triangle', 0.05, 160]]);
    }
  };
})(window);
