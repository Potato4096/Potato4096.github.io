/* happy-bird - WebAudio synthesized sound effects */
(function () {
  'use strict';

  var HB = window.HB = window.HB || {};

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

  function noise(dur, vol) {
    if (!ctx) return;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    gain.gain.value = vol || 0.06;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  var SFX = {
    flap: function () {
      tone({ type: 'square', from: 520, to: 880, dur: 0.07, vol: 0.045 });
    },
    score: function () {
      tone({ type: 'square', from: 880, dur: 0.06, vol: 0.04 });
      tone({ type: 'square', from: 1320, dur: 0.09, vol: 0.035, delay: 0.06 });
    },
    hit: function () {
      noise(0.12, 0.07);
      tone({ type: 'sawtooth', from: 260, to: 90, dur: 0.18, vol: 0.05 });
    },
    die: function () {
      tone({ type: 'sawtooth', from: 380, to: 70, dur: 0.45, vol: 0.05, delay: 0.08 });
    },
    swoosh: function () {
      noise(0.18, 0.04);
    },
    start: function () {
      tone({ type: 'square', from: 523, dur: 0.08, vol: 0.04 });
      tone({ type: 'square', from: 784, dur: 0.12, vol: 0.04, delay: 0.08 });
    },
    medal: function () {
      var notes = [784, 988, 1319];
      for (var i = 0; i < notes.length; i++) {
        tone({ type: 'triangle', from: notes[i], dur: 0.14, vol: 0.04, delay: i * 0.1 });
      }
    }
  };

  HB.audio = {
    unlock: unlock,
    play: function (name) {
      if (!enabled()) return;
      unlock();
      var fn = SFX[name];
      if (fn) fn();
    }
  };
})();
