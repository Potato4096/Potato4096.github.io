/* arena-survivor - input (keyboard + virtual joystick) */
(function () {
  'use strict';

  var SJ = window.SJ = window.SJ || {};

  var state = {
    up: false, down: false, left: false, right: false,
    joyX: 0, joyY: 0,
    pauseQueued: false,
    pickQueued: -1
  };

  var KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right'
  };

  function onKeyDown(e) {
    if (e.repeat) return;
    if (KEYMAP[e.code]) {
      e.preventDefault();
      state[KEYMAP[e.code]] = true;
      if (SJ.Audio && SJ.Audio.unlock) SJ.Audio.unlock();
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      state.pauseQueued = true;
      return;
    }
    if (e.code === 'Digit1' || e.code === 'Numpad1') state.pickQueued = 0;
    if (e.code === 'Digit2' || e.code === 'Numpad2') state.pickQueued = 1;
    if (e.code === 'Digit3' || e.code === 'Numpad3') state.pickQueued = 2;
  }

  function onKeyUp(e) {
    if (KEYMAP[e.code]) {
      e.preventDefault();
      state[KEYMAP[e.code]] = false;
    }
  }

  function bindJoystick() {
    var pad = document.getElementById('joystick');
    var knob = document.getElementById('joy-knob');
    if (!pad || !knob) return;
    var active = false;
    var RADIUS = 42;

    function setKnob(dx, dy) {
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }

    function handle(e) {
      var rect = pad.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = e.clientX - cx;
      var dy = e.clientY - cy;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > RADIUS) {
        dx = dx / d * RADIUS;
        dy = dy / d * RADIUS;
      }
      state.joyX = dx / RADIUS;
      state.joyY = dy / RADIUS;
      setKnob(dx, dy);
    }

    pad.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      active = true;
      pad.setPointerCapture(e.pointerId);
      handle(e);
      if (SJ.Audio && SJ.Audio.unlock) SJ.Audio.unlock();
    });
    pad.addEventListener('pointermove', function (e) {
      if (!active) return;
      e.preventDefault();
      handle(e);
    });
    function end(e) {
      if (!active) return;
      e.preventDefault();
      active = false;
      state.joyX = 0;
      state.joyY = 0;
      setKnob(0, 0);
    }
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
  }

  function init() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () {
      state.up = state.down = state.left = state.right = false;
      state.joyX = 0;
      state.joyY = 0;
      var knob = document.getElementById('joy-knob');
      if (knob) knob.style.transform = 'translate(0,0)';
    });
    bindJoystick();
  }

  SJ.Input = { state: state, init: init };
})();
