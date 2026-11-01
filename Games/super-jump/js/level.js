/* super-jump - level data & tile helpers */
(function () {
  'use strict';

  var SJ = window.SJ = window.SJ || {};

  var T = {
    AIR: 0,
    GROUND: 1,
    HARD: 2,
    BRICK: 3,
    QUESTION: 4,
    USED: 5,
    PIPE_TL: 6,
    PIPE_TR: 7,
    PIPE_BL: 8,
    PIPE_BR: 9
  };

  function build() {
    var W = 192, H = 17;
    var tiles = new Uint8Array(W * H);

    function set(x, y, t) {
      if (x >= 0 && x < W && y >= 0 && y < H) tiles[y * W + x] = t;
    }
    function rect(x, y, w, h, t) {
      for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) set(x + i, y + j, t);
    }
    function pipe(x, topY) {
      set(x, topY, T.PIPE_TL);
      set(x + 1, topY, T.PIPE_TR);
      for (var y = topY + 1; y < 15; y++) {
        set(x, y, T.PIPE_BL);
        set(x + 1, y, T.PIPE_BR);
      }
    }
    function stairsUp(x, steps) {
      for (var s = 0; s < steps; s++) rect(x + s, 15 - (s + 1), 1, s + 1, T.HARD);
    }
    function stairsDown(x, steps) {
      for (var s = 0; s < steps; s++) rect(x + s, 14 - (steps - 1 - s), 1, steps - s, T.HARD);
    }

    // base ground
    rect(0, 15, W, 2, T.GROUND);

    // pits (gaps in the ground)
    [[21, 3], [40, 3], [58, 2], [71, 3], [96, 3], [123, 2], [148, 3]].forEach(function (p) {
      rect(p[0], 15, p[1], 2, T.AIR);
    });

    // block / pipe / stair layout
    rect(15, 11, 1, 1, T.BRICK);
    rect(16, 11, 1, 1, T.QUESTION);
    rect(17, 11, 1, 1, T.BRICK);
    rect(18, 11, 1, 1, T.BRICK);

    pipe(26, 13);

    rect(34, 11, 1, 1, T.QUESTION);
    rect(35, 11, 1, 1, T.BRICK);
    rect(36, 11, 1, 1, T.BRICK);
    rect(37, 11, 1, 1, T.QUESTION);

    pipe(45, 12);

    stairsUp(52, 4);

    rect(62, 11, 7, 1, T.HARD);

    rect(76, 11, 1, 1, T.BRICK);
    rect(77, 11, 1, 1, T.QUESTION);
    rect(78, 11, 1, 1, T.BRICK);
    rect(79, 11, 1, 1, T.BRICK);

    pipe(85, 13);

    rect(89, 11, 7, 1, T.HARD);

    rect(104, 11, 1, 1, T.BRICK);
    rect(105, 11, 1, 1, T.BRICK);
    rect(106, 11, 1, 1, T.QUESTION);
    rect(107, 11, 1, 1, T.BRICK);

    pipe(110, 11);

    stairsDown(117, 4);

    rect(127, 12, 7, 1, T.HARD);

    rect(143, 11, 1, 1, T.QUESTION);
    rect(144, 11, 1, 1, T.BRICK);
    rect(145, 11, 1, 1, T.QUESTION);
    rect(146, 11, 1, 1, T.BRICK);

    rect(155, 11, 1, 1, T.BRICK);
    rect(156, 11, 1, 1, T.BRICK);
    rect(157, 11, 1, 1, T.BRICK);
    rect(158, 11, 1, 1, T.QUESTION);

    pipe(168, 12);

    stairsUp(172, 4);

    // flag base
    set(178, 14, T.HARD);

    // coins (tile coords). y = row of the coin's top.
    var coins = [];
    function coinRow(x, y, n) {
      for (var i = 0; i < n; i++) coins.push({ x: x + i, y: y });
    }
    coinRow(15, 8, 4);
    coinRow(35, 8, 2);
    coinRow(76, 8, 4);
    coinRow(104, 8, 3);
    coinRow(144, 8, 2);
    coinRow(155, 8, 4);
    // coins above pits (risk reward)
    coins.push({ x: 22, y: 12 });
    coins.push({ x: 41, y: 12 });
    coins.push({ x: 59, y: 12 });
    coins.push({ x: 72, y: 12 });
    coins.push({ x: 97, y: 12 });
    coins.push({ x: 124, y: 12 });
    coins.push({ x: 149, y: 12 });
    // coins on platforms (skip enemy tiles)
    coinRow(63, 10, 2);
    coinRow(66, 10, 2);
    coinRow(90, 10, 5);
    coinRow(128, 11, 2);
    coinRow(131, 11, 2);

    // enemies: tx = tile x, fy = solid row they stand on top of
    var enemies = [
      { tx: 12, fy: 15 },
      { tx: 31, fy: 15 },
      { tx: 49, fy: 15 },
      { tx: 65, fy: 11 },
      { tx: 83, fy: 15 },
      { tx: 101, fy: 15 },
      { tx: 114, fy: 15 },
      { tx: 130, fy: 12 },
      { tx: 137, fy: 15 },
      { tx: 153, fy: 15 },
      { tx: 162, fy: 15 },
      { tx: 165, fy: 15 }
    ];

    return {
      W: W,
      H: H,
      tiles: tiles,
      coins: coins,
      enemies: enemies,
      spawn: { x: 3 * 16, y: 15 * 16 - 15 },
      flag: { x: 178 * 16, topY: 4 * 16, bottomY: 15 * 16 }
    };
  }

  function isSolid(t) {
    return t !== T.AIR;
  }

  SJ.Level = { T: T, build: build, isSolid: isSolid };
})();
