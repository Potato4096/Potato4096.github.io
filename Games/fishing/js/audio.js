/* fishing - WebAudio synthesized sound effects */
(function () {
  'use strict';

  var FS = window.FS = window.FS || {};

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
    cast: function () {
      tone({ type: 'sawtooth', from: 180, to: 520, dur: 0.22, vol: 0.04 });
      tone({ type: 'triangle', from: 240, to: 680, dur: 0.18, vol: 0.03, delay: 0.04 });
    },
    splash: function () {
      tone({ type: 'triangle', from: 320, to: 130, dur: 0.12, vol: 0.05 });
      tone({ type: 'triangle', from: 220, to: 90, dur: 0.16, vol: 0.04, delay: 0.08 });
    },
    bite: function () {
      tone({ type: 'square', from: 660, dur: 0.07, vol: 0.05 });
      tone({ type: 'square', from: 880, dur: 0.09, vol: 0.05, delay: 0.08 });
    },
    reel: function () {
      tone({ type: 'square', from: 200, to: 260, dur: 0.05, vol: 0.03 });
    },
    snap: function () {
      tone({ type: 'sawtooth', from: 700, to: 120, dur: 0.22, vol: 0.055 });
      tone({ type: 'square', from: 300, to: 80, dur: 0.26, vol: 0.04, delay: 0.05 });
    },
    catch: function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) {
        tone({ type: 'square', from: notes[i], dur: 0.14, vol: 0.045, delay: i * 0.11 });
      }
    },
    coin: function () {
      tone({ type: 'square', from: 988, dur: 0.07, vol: 0.045 });
      tone({ type: 'square', from: 1319, dur: 0.12, vol: 0.045, delay: 0.07 });
    },
    start: function () {
      tone({ type: 'triangle', from: 392, dur: 0.1, vol: 0.04 });
      tone({ type: 'triangle', from: 523, dur: 0.14, vol: 0.04, delay: 0.1 });
    }
  };

  FS.audio = {
    unlock: unlock,
    play: function (name) {
      if (!enabled()) return;
      unlock();
      var fn = SFX[name];
      if (fn) fn();
    }
  };
})();
