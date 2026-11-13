/* penalty-shootout - WebAudio synthesized sound effects */
(function () {
  'use strict';

  var PS = window.PS = window.PS || {};

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
    if (opts.to) osc.frequency.linearRampToValueAtTime(opts.to, t0 + opts.dur);
    gain.gain.setValueAtTime(opts.vol || 0.05, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + opts.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  }

  var SFX = {
    kick: function () {
      tone({ type: 'triangle', from: 180, to: 60, dur: 0.12, vol: 0.07 });
      tone({ type: 'square', from: 420, to: 200, dur: 0.06, vol: 0.04 });
    },
    goal: function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) {
        tone({ type: 'square', from: notes[i], dur: 0.14, vol: 0.05, delay: i * 0.1 });
      }
    },
    save: function () {
      tone({ type: 'sawtooth', from: 320, to: 140, dur: 0.18, vol: 0.055 });
    },
    post: function () {
      tone({ type: 'square', from: 900, to: 500, dur: 0.08, vol: 0.06 });
      tone({ type: 'triangle', from: 1200, to: 700, dur: 0.12, vol: 0.045, delay: 0.02 });
    },
    whistle: function () {
      tone({ type: 'sine', from: 1500, to: 1800, dur: 0.16, vol: 0.05 });
      tone({ type: 'sine', from: 1800, to: 1500, dur: 0.16, vol: 0.05, delay: 0.16 });
    },
    win: function () {
      var notes = [523, 659, 784, 1047, 1319, 1568];
      for (var i = 0; i < notes.length; i++) {
        tone({ type: 'square', from: notes[i], dur: 0.15, vol: 0.05, delay: i * 0.12 });
      }
    },
    lose: function () {
      tone({ type: 'sawtooth', from: 392, to: 98, dur: 0.55, vol: 0.055 });
      tone({ type: 'sawtooth', from: 294, to: 73, dur: 0.55, vol: 0.045, delay: 0.18 });
    },
    start: function () {
      tone({ type: 'square', from: 392, dur: 0.09, vol: 0.04 });
      tone({ type: 'square', from: 523, dur: 0.12, vol: 0.04, delay: 0.09 });
    }
  };

  PS.audio = {
    unlock: unlock,
    play: function (name) {
      if (!enabled()) return;
      unlock();
      var fn = SFX[name];
      if (fn) fn();
    }
  };
})();
