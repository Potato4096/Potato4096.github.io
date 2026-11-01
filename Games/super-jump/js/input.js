/* super-jump - input (keyboard + touch) */
(function () {
  'use strict';

  var SJ = window.SJ = window.SJ || {};

  var state = {
    left: false,
    right: false,
    jump: false,
    jumpQueued: false,
    pauseQueued: false
  };

  function press(name) {
    if (name === 'jump') {
      if (!state.jump) state.jumpQueued = true;
      state.jump = true;
    } else {
      state[name] = true;
    }
  }

  function release(name) {
    if (name === 'jump') state.jump = false;
    else state[name] = false;
  }

  var KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump'
  };

  function onKeyDown(e) {
    if (e.repeat) return;
    if (KEYMAP[e.code]) {
      e.preventDefault();
      press(KEYMAP[e.code]);
      if (SJ.Audio && SJ.Audio.unlock) SJ.Audio.unlock();
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      state.pauseQueued = true;
    }
  }

  function onKeyUp(e) {
    if (KEYMAP[e.code]) {
      e.preventDefault();
      release(KEYMAP[e.code]);
    }
  }

  function bindTouch() {
    var buttons = document.querySelectorAll('[data-touch]');
    Array.prototype.forEach.call(buttons, function (btn) {
      var name = btn.getAttribute('data-touch');
      var down = function (e) {
        e.preventDefault();
        press(name);
        if (SJ.Audio && SJ.Audio.unlock) SJ.Audio.unlock();
      };
      var up = function (e) {
        e.preventDefault();
        release(name);
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    });
  }

  function init() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () {
      state.left = state.right = state.jump = false;
    });
    bindTouch();
  }

  SJ.Input = { state: state, init: init };
})();
