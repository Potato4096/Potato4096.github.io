/* arena-survivor - WebAudio synthesized sound effects */
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
    shoot: function () { tone({ type: 'square', from: 620, to: 880, dur: 0.06, vol: 0.028 }); },
    hit: function () { tone({ type: 'triangle', from: 300, to: 180, dur: 0.05, vol: 0.03 }); },
    kill: function () { tone({ type: 'square', from: 220, to: 90, dur: 0.1, vol: 0.045 }); },
    hurt: function () { tone({ type: 'sawtooth', from: 240, to: 110, dur: 0.16, vol: 0.05 }); },
    pickup: function () { tone({ type: 'square', from: 880, dur: 0.05, vol: 0.03 }); },
    levelup: function () {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) {
        tone({ type: 'square', from: notes[i], dur: 0.12, vol: 0.045, delay: i * 0.09 });
      }
    },
    wave: function () {
      tone({ type: 'triangle', from: 392, dur: 0.18, vol: 0.05 });
      tone({ type: 'triangle', from: 523, dur: 0.22, vol: 0.05, delay: 0.14 });
    },
    gameover: function () {
      var notes = [392, 330, 262, 196];
      for (var i = 0; i < notes.length; i++) {
        tone({ type: 'sawtooth', from: notes[i], dur: 0.22, vol: 0.045, delay: i * 0.17 });
      }
    },
    start: function () {
      tone({ type: 'square', from: 440, dur: 0.09, vol: 0.04 });
      tone({ type: 'square', from: 587, dur: 0.12, vol: 0.04, delay: 0.09 });
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
