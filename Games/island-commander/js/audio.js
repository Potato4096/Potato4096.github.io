/* island-commander - WebAudio synth sounds (no assets needed) */
(function () {
  'use strict';

  var ctx = null;
  var master = null;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function enabled() {
    if (window.GamePlatform && GamePlatform.isSoundEnabled) {
      return GamePlatform.isSoundEnabled();
    }
    return true;
  }

  function beep(freq, dur, type, gain, slideTo, delay) {
    if (!enabled() || !ensure()) return;
    var t0 = ctx.currentTime + (delay || 0);
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(gain || 0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  var S = {
    unlock: function () { ensure(); },
    click: function () { beep(520, 0.06, 'triangle', 0.35); },
    build: function () { beep(240, 0.12, 'square', 0.3); beep(360, 0.14, 'square', 0.25, null, 0.08); },
    train: function () { beep(330, 0.08, 'triangle', 0.35); beep(440, 0.1, 'triangle', 0.3, null, 0.07); beep(550, 0.12, 'triangle', 0.28, null, 0.14); },
    march: function () {
      beep(196, 0.14, 'sawtooth', 0.22);
      beep(262, 0.14, 'sawtooth', 0.22, null, 0.16);
      beep(330, 0.2, 'sawtooth', 0.22, null, 0.32);
    },
    clash: function () {
      beep(180, 0.18, 'square', 0.3, 90);
      beep(140, 0.22, 'sawtooth', 0.25, 70, 0.05);
    },
    raid: function () {
      beep(440, 0.12, 'square', 0.3);
      beep(330, 0.12, 'square', 0.3, null, 0.13);
      beep(440, 0.12, 'square', 0.3, null, 0.26);
    },
    win: function () {
      beep(392, 0.14, 'triangle', 0.4);
      beep(494, 0.14, 'triangle', 0.4, null, 0.12);
      beep(587, 0.14, 'triangle', 0.4, null, 0.24);
      beep(784, 0.3, 'triangle', 0.42, null, 0.36);
    },
    lose: function () {
      beep(330, 0.18, 'sawtooth', 0.3, 240);
      beep(247, 0.2, 'sawtooth', 0.28, 180, 0.18);
      beep(185, 0.36, 'sawtooth', 0.26, 110, 0.38);
    }
  };

  window.ICAudio = S;
})();
