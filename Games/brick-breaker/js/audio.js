/* brick-breaker - WebAudio synthesized sound effects */
(function () {
  'use strict';

  var BB = window.BB = window.BB || {};

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
    launch: function () {
      tone({ type: 'square', from: 330, to: 660, dur: 0.12, vol: 0.05 });
    },
    paddle: function () { tone({ type: 'square', from: 420, to: 520, dur: 0.06, vol: 0.045 }); },
    wall: function () { tone({ type: 'triangle', from: 300, to: 260, dur: 0.05, vol: 0.04 }); },
    hit: function () { tone({ type: 'square', from: 520, dur: 0.05, vol: 0.045 }); },
    crack: function () {
      tone({ type: 'square', from: 300, to: 180, dur: 0.09, vol: 0.05 });
    },
    break: function () {
      tone({ type: 'square', from: 620, to: 240, dur: 0.11, vol: 0.055 });
      tone({ type: 'triangle', from: 200, to: 90, dur: 0.12, vol: 0.05 });
    },
    power: function () {
      tone({ type: 'square', from: 660, dur: 0.07, vol: 0.045 });
      tone({ type: 'square', from: 880, dur: 0.07, vol: 0.045, delay: 0.07 });
      tone({ type: 'square', from: 1175, dur: 0.12, vol: 0.045, delay: 0.14 });
    },
    lose: function () {
      tone({ type: 'sawtooth', from: 392, to: 98, dur: 0.5, vol: 0.05 });
    },
    clear: function () {
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

  BB.audio = {
    unlock: unlock,
    play: function (name) {
      if (!enabled()) return;
      unlock();
      var fn = SFX[name];
      if (fn) fn();
    }
  };
})();
