/* super-jump - WebAudio synthesized sound effects */
(function () {
  'use strict';

  var SJ = window.SJ = window.SJ || {};

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
    jump: function () { tone({ type: 'square', from: 340, to: 720, dur: 0.14, vol: 0.05 }); },
    coin: function () {
      tone({ type: 'square', from: 988, dur: 0.07, vol: 0.045 });
      tone({ type: 'square', from: 1319, dur: 0.16, vol: 0.045, delay: 0.07 });
    },
    stomp: function () { tone({ type: 'square', from: 240, to: 90, dur: 0.12, vol: 0.06 }); },
    bump: function () { tone({ type: 'triangle', from: 180, to: 110, dur: 0.09, vol: 0.07 }); },
    die: function () {
      tone({ type: 'sawtooth', from: 440, to: 70, dur: 0.55, vol: 0.05 });
      tone({ type: 'square', from: 330, to: 60, dur: 0.55, vol: 0.03 });
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

  function play(name) {
    if (!enabled()) return;
    unlock();
    if (!ctx) return;
    var fn = SFX[name];
    if (fn) fn();
  }

  SJ.Audio = { play: play, unlock: unlock };
})();
