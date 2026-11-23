/**
 * audio.js - 大富翁 · WebAudio 合成音效
 * 不引用任何音频文件；全局音效关闭时静默。
 */
(function (root) {
  'use strict';

  var actx = null;
  var master = null;

  function enabled() {
    try {
      return !root.GamePlatform || root.GamePlatform.ui.isSoundEnabled();
    } catch (e) {
      return true;
    }
  }

  function ensure() {
    if (!enabled()) return null;
    if (!actx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0.22;
      master.connect(actx.destination);
    }
    if (actx.state === 'suspended' && actx.resume) actx.resume();
    return actx;
  }

  /** 单音：freq 起始频率，dur 时长，type 波形，slide 结束频率 */
  function tone(freq, dur, type, gain, slide) {
    var ac = ensure();
    if (!ac) return;
    var t0 = ac.currentTime;
    var osc = ac.createOscillator();
    var g = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.25, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** 噪声脉冲：用于骰子、脚步 */
  function noise(dur, gain, filterFreq) {
    var ac = ensure();
    if (!ac) return;
    var len = Math.floor(ac.sampleRate * dur);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    var src = ac.createBufferSource();
    src.buffer = buf;
    var flt = ac.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = filterFreq || 1200;
    flt.Q.value = 0.8;
    var g = ac.createGain();
    g.gain.value = gain || 0.12;
    src.connect(flt);
    flt.connect(g);
    g.connect(master);
    src.start();
  }

  var Sound = {
    unlock: function () { ensure(); },
    step: function () { noise(0.05, 0.05, 900); },
    dice: function () {
      noise(0.07, 0.10, 1400);
      root.setTimeout(function () { noise(0.06, 0.08, 1000); }, 90);
      root.setTimeout(function () { noise(0.05, 0.06, 800); }, 180);
    },
    coin: function () {
      tone(880, 0.09, 'triangle', 0.18);
      root.setTimeout(function () { tone(1320, 0.14, 'triangle', 0.14); }, 70);
    },
    buy: function () {
      tone(523, 0.10, 'triangle', 0.16);
      root.setTimeout(function () { tone(659, 0.10, 'triangle', 0.16); }, 90);
      root.setTimeout(function () { tone(880, 0.20, 'triangle', 0.16); }, 180);
    },
    pay: function () {
      tone(330, 0.12, 'sine', 0.18, 220);
      root.setTimeout(function () { tone(220, 0.24, 'sine', 0.16, 150); }, 110);
    },
    jail: function () {
      tone(160, 0.18, 'square', 0.14, 110);
      root.setTimeout(function () { noise(0.18, 0.12, 500); }, 120);
    },
    card: function () { noise(0.12, 0.07, 2400); },
    win: function () {
      var notes = [523, 659, 784, 1046];
      notes.forEach(function (n, i) {
        root.setTimeout(function () { tone(n, 0.26, 'triangle', 0.18); }, i * 130);
      });
    },
    lose: function () {
      tone(392, 0.22, 'sine', 0.16, 300);
      root.setTimeout(function () { tone(294, 0.3, 'sine', 0.15, 200); }, 160);
    },
    click: function () { tone(660, 0.05, 'square', 0.08); }
  };

  root.MonopolySound = Sound;
})(typeof window !== 'undefined' ? window : this);
