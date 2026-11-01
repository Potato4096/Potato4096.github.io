/* minesweeper - WebAudio synthesized sound effects */
(function () {
  'use strict';

  var MS = window.MS = window.MS || {};

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
    reveal: function () { tone({ type: 'triangle', from: 300, to: 360, dur: 0.045, vol: 0.035 }); },
    flag: function () {
      tone({ type: 'square', from: 620, dur: 0.05, vol: 0.04 });
      tone({ type: 'square', from: 820, dur: 0.06, vol: 0.035, delay: 0.05 });
    },
    unflag: function () { tone({ type: 'square', from: 500, to: 320, dur: 0.07, vol: 0.035 }); },
    chord: function () {
      tone({ type: 'triangle', from: 420, to: 560, dur: 0.07, vol: 0.04 });
    },
    boom: function () {
      tone({ type: 'sawtooth', from: 180, to: 40, dur: 0.5, vol: 0.07 });
      tone({ type: 'square', from: 120, to: 30, dur: 0.55, vol: 0.05 });
      tone({ type: 'triangle', from: 90, to: 24, dur: 0.6, vol: 0.06 });
    },
    win: function () {
      var notes = [523, 659, 784, 1047, 1319];
      for (var i = 0; i < notes.length; i++) {
        tone({ type: 'square', from: notes[i], dur: 0.16, vol: 0.045, delay: i * 0.13 });
      }
    },
    start: function () {
      tone({ type: 'square', from: 392, dur: 0.09, vol: 0.04 });
      tone({ type: 'square', from: 523, dur: 0.12, vol: 0.04, delay: 0.09 });
    }
  };

  MS.audio = {
    unlock: unlock,
    play: function (name) {
      if (!enabled()) return;
      unlock();
      var fn = SFX[name];
      if (fn) fn();
    }
  };
})();
