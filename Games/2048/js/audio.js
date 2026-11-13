/* 2048 - WebAudio synthesized sound effects */
(function () {
  'use strict';

  var T4 = window.T4 = window.T4 || {};

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
    start: function () {
      tone({ type: 'square', from: 392, dur: 0.09, vol: 0.04 });
      tone({ type: 'square', from: 523, dur: 0.12, vol: 0.04, delay: 0.09 });
    },
    move: function () { tone({ type: 'triangle', from: 240, to: 300, dur: 0.06, vol: 0.035 }); },
    merge: function () {
      tone({ type: 'square', from: 420, to: 620, dur: 0.09, vol: 0.045 });
      tone({ type: 'triangle', from: 620, dur: 0.1, vol: 0.035, delay: 0.05 });
    },
    big: function () {
      tone({ type: 'square', from: 523, dur: 0.1, vol: 0.045 });
      tone({ type: 'square', from: 659, dur: 0.1, vol: 0.045, delay: 0.08 });
      tone({ type: 'square', from: 784, dur: 0.16, vol: 0.05, delay: 0.16 });
    },
    undo: function () { tone({ type: 'triangle', from: 320, to: 210, dur: 0.12, vol: 0.04 }); },
    win: function () {
      var notes = [523, 659, 784, 1047, 1319];
      for (var i = 0; i < notes.length; i++) {
        tone({ type: 'square', from: notes[i], dur: 0.16, vol: 0.045, delay: i * 0.13 });
      }
    },
    lose: function () {
      tone({ type: 'sawtooth', from: 330, to: 92, dur: 0.55, vol: 0.05 });
    },
    click: function () { tone({ type: 'square', from: 520, dur: 0.05, vol: 0.035 }); }
  };

  T4.audio = {
    unlock: unlock,
    play: function (name) {
      if (!enabled()) return;
      unlock();
      var fn = SFX[name];
      if (fn) fn();
    }
  };
})();
