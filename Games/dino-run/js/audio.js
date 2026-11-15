/* dino-run - WebAudio synthesized sound effects */
(function () {
  'use strict';

  var DR = window.DR = window.DR || {};

  var ctx = null;

  function unlock() {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* ignore */ }
  }

  function enabled() {
    return typeof GamePlatform !== 'undefined' && GamePlatform.ui.isSoundEnabled();
  }

  function tone(opts) {
    if (!ctx) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(opts.from, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(opts.to, 20), t0 + opts.dur);
    gain.gain.setValueAtTime(opts.vol || 0.05, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + opts.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  }

  function thud() {
    if (!ctx) return;
    var len = Math.floor(ctx.sampleRate * 0.18);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    gain.gain.value = 0.09;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  var SFX = {
    jump: function () {
      tone({ type: 'square', from: 380, to: 720, dur: 0.11, vol: 0.045 });
    },
    land: function () {
      tone({ type: 'triangle', from: 180, to: 120, dur: 0.06, vol: 0.03 });
    },
    point: function () {
      tone({ type: 'square', from: 1046, dur: 0.07, vol: 0.04 });
      tone({ type: 'square', from: 1568, dur: 0.1, vol: 0.035, delay: 0.08 });
    },
    hit: function () {
      thud();
      tone({ type: 'sawtooth', from: 220, to: 60, dur: 0.3, vol: 0.055 });
    },
    start: function () {
      tone({ type: 'square', from: 440, dur: 0.08, vol: 0.04 });
      tone({ type: 'square', from: 660, dur: 0.12, vol: 0.04, delay: 0.08 });
    },
    night: function () {
      tone({ type: 'sine', from: 880, to: 440, dur: 0.5, vol: 0.03 });
    }
  };

  DR.audio = {
    unlock: unlock,
    play: function (name) {
      if (!enabled()) return;
      unlock();
      var fn = SFX[name];
      if (fn) fn();
    }
  };
})();
