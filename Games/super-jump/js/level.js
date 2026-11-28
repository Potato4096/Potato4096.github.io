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

  var H = 17;
  var GROUND_ROW = 15;      // 地面最上面一行（下面一行也是实心）
  var FLAG_TOP_ROW = 4;     // 旗杆顶端所在行

  /**
   * 关卡绘制工具。坐标一律是格子坐标，和物理层（16px 一格）解耦。
   * 每个关卡都先铺满地面，再用 pit() 挖坑、用平台/管道/阶梯往上堆。
   */
  function workspace(W) {
    var tiles = new Uint8Array(W * H);
    var coins = [];
    var enemies = [];

    function set(x, y, t) {
      if (x >= 0 && x < W && y >= 0 && y < H) tiles[y * W + x] = t;
    }
    function rect(x, y, w, h, t) {
      for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) set(x + i, y + j, t);
    }
    /** 水管：两格宽，从 topY 一直立到地面 */
    function pipe(x, topY) {
      set(x, topY, T.PIPE_TL);
      set(x + 1, topY, T.PIPE_TR);
      for (var y = topY + 1; y < GROUND_ROW; y++) {
        set(x, y, T.PIPE_BL);
        set(x + 1, y, T.PIPE_BR);
      }
    }
    function stairsUp(x, steps) {
      for (var s = 0; s < steps; s++) rect(x + s, GROUND_ROW - (s + 1), 1, s + 1, T.HARD);
    }
    function stairsDown(x, steps) {
      for (var s = 0; s < steps; s++) rect(x + s, GROUND_ROW - 1 - (steps - 1 - s), 1, steps - s, T.HARD);
    }
    /** 在地面上挖宽 w 的坑 */
    function pit(x, w) {
      rect(x, GROUND_ROW, w, 2, T.AIR);
    }
    /** 坑中间的落脚石（掉下去就是死，所以宽坑必须给一块） */
    function stone(x, w, row) {
      rect(x, row, w, 1, T.HARD);
    }
    function coin(x, y) { coins.push({ x: x, y: y }); }
    function coinRow(x, y, n) {
      for (var i = 0; i < n; i++) coins.push({ x: x + i, y: y });
    }
    /** 敌人：tx 是格子列，fy 是它踩着的那一行实心格 */
    function enemy(tx, fy) { enemies.push({ tx: tx, fy: fy }); }

    rect(0, GROUND_ROW, W, 2, T.GROUND);

    return {
      W: W, H: H, tiles: tiles, coins: coins, enemies: enemies,
      set: set, rect: rect, pipe: pipe,
      stairsUp: stairsUp, stairsDown: stairsDown,
      pit: pit, stone: stone,
      coin: coin, coinRow: coinRow, enemy: enemy
    };
  }

  /* ------------------------------------------------------------------
   * 关卡 1 · 草原起步（原始关卡，保留原有手感）
   * ------------------------------------------------------------------ */
  function meadow(w) {
    w.pit(21, 3); w.pit(40, 3); w.pit(58, 2); w.pit(71, 3);
    w.pit(96, 3); w.pit(123, 2); w.pit(148, 3);

    w.rect(15, 11, 1, 1, T.BRICK);
    w.rect(16, 11, 1, 1, T.QUESTION);
    w.rect(17, 11, 1, 1, T.BRICK);
    w.rect(18, 11, 1, 1, T.BRICK);

    w.pipe(26, 13);

    w.rect(34, 11, 1, 1, T.QUESTION);
    w.rect(35, 11, 1, 1, T.BRICK);
    w.rect(36, 11, 1, 1, T.BRICK);
    w.rect(37, 11, 1, 1, T.QUESTION);

    w.pipe(45, 12);
    w.stairsUp(52, 4);
    w.rect(62, 11, 7, 1, T.HARD);

    w.rect(76, 11, 1, 1, T.BRICK);
    w.rect(77, 11, 1, 1, T.QUESTION);
    w.rect(78, 11, 1, 1, T.BRICK);
    w.rect(79, 11, 1, 1, T.BRICK);

    w.pipe(85, 13);
    w.rect(89, 11, 7, 1, T.HARD);

    w.rect(104, 11, 1, 1, T.BRICK);
    w.rect(105, 11, 1, 1, T.BRICK);
    w.rect(106, 11, 1, 1, T.QUESTION);
    w.rect(107, 11, 1, 1, T.BRICK);

    w.pipe(110, 11);
    w.stairsDown(117, 4);
    w.rect(127, 12, 7, 1, T.HARD);

    w.rect(143, 11, 1, 1, T.QUESTION);
    w.rect(144, 11, 1, 1, T.BRICK);
    w.rect(145, 11, 1, 1, T.QUESTION);
    w.rect(146, 11, 1, 1, T.BRICK);

    w.rect(155, 11, 1, 1, T.BRICK);
    w.rect(156, 11, 1, 1, T.BRICK);
    w.rect(157, 11, 1, 1, T.BRICK);
    w.rect(158, 11, 1, 1, T.QUESTION);

    w.pipe(168, 12);
    w.stairsUp(172, 4);

    // flag base
    w.set(178, 14, T.HARD);

    w.coinRow(15, 8, 4);
    w.coinRow(35, 8, 2);
    w.coinRow(76, 8, 4);
    w.coinRow(104, 8, 3);
    w.coinRow(144, 8, 2);
    w.coinRow(155, 8, 4);
    w.coin(22, 12); w.coin(41, 12); w.coin(59, 12); w.coin(72, 12);
    w.coin(97, 12); w.coin(124, 12); w.coin(149, 12);
    w.coinRow(63, 10, 2);
    w.coinRow(66, 10, 2);
    w.coinRow(90, 10, 5);
    w.coinRow(128, 11, 2);
    w.coinRow(131, 11, 2);

    [[12, 15], [31, 15], [49, 15], [65, 11], [83, 15], [101, 15],
     [114, 15], [130, 12], [137, 15], [153, 15], [162, 15], [165, 15]]
      .forEach(function (p) { w.enemy(p[0], p[1]); });
  }

  /* ------------------------------------------------------------------
   * 关卡 2 · 管道迷宫：上下两段水管夹着窄台，落点要求更准
   * ------------------------------------------------------------------ */
  function pipes(w) {
    w.pit(26, 3); w.pit(52, 3); w.pit(84, 4);
    w.pit(126, 3); w.pit(150, 3); w.pit(172, 4);
    w.stone(85, 2, 13);
    w.stone(173, 2, 13);

    w.pipe(12, 13);
    w.pipe(16, 12);
    w.pipe(40, 13);
    w.pipe(74, 13);
    w.pipe(96, 12);
    w.pipe(142, 13);

    w.rect(32, 11, 4, 1, T.HARD);
    w.rect(45, 11, 1, 1, T.BRICK);
    w.rect(46, 11, 1, 1, T.QUESTION);
    w.rect(47, 11, 1, 1, T.BRICK);
    w.rect(48, 11, 1, 1, T.BRICK);

    w.rect(64, 12, 7, 1, T.HARD);

    w.rect(90, 11, 1, 1, T.QUESTION);
    w.rect(91, 11, 1, 1, T.BRICK);
    w.rect(92, 11, 1, 1, T.QUESTION);
    w.rect(93, 11, 1, 1, T.BRICK);

    w.stairsUp(108, 4);
    w.rect(112, 11, 4, 1, T.HARD);
    w.stairsDown(116, 4);

    w.rect(130, 12, 6, 1, T.HARD);

    w.rect(155, 11, 1, 1, T.BRICK);
    w.rect(156, 11, 1, 1, T.QUESTION);
    w.rect(157, 11, 1, 1, T.BRICK);
    w.rect(158, 11, 1, 1, T.QUESTION);

    w.stairsUp(164, 3);

    w.coinRow(4, 12, 4);
    w.coinRow(13, 10, 2);
    w.coin(27, 12);
    w.coinRow(32, 10, 2);
    w.coinRow(45, 9, 3);
    w.coinRow(65, 11, 3);
    w.coin(86, 11);
    w.coinRow(90, 10, 2);
    w.coinRow(113, 10, 2);
    w.coin(123, 11);
    w.coinRow(131, 11, 3);
    w.coin(151, 12);
    w.coinRow(156, 9, 3);
    w.coin(173, 11);
    w.coin(180, 12);

    [[22, 15], [33, 11], [58, 15], [66, 12], [80, 15], [102, 15],
     [124, 15], [132, 12], [146, 15], [180, 15]]
      .forEach(function (p) { w.enemy(p[0], p[1]); });
  }

  /* ------------------------------------------------------------------
   * 关卡 3 · 断崖飞跃：四格宽的深坑连成串，靠坑里的落石接力
   * ------------------------------------------------------------------ */
  function canyon(w) {
    w.pit(28, 4); w.stone(29, 2, 12);
    w.pit(58, 4); w.stone(59, 2, 13);
    w.pit(88, 4); w.stone(89, 2, 12);
    w.pit(118, 4); w.stone(119, 2, 13);
    w.pit(148, 4); w.stone(149, 2, 12);
    w.pit(178, 4); w.stone(179, 2, 13);

    w.rect(18, 11, 1, 1, T.BRICK);
    w.rect(19, 11, 1, 1, T.QUESTION);
    w.rect(20, 11, 1, 1, T.BRICK);
    w.rect(21, 11, 1, 1, T.BRICK);

    w.pipe(36, 13);
    w.rect(42, 12, 5, 1, T.HARD);

    w.stairsUp(66, 4);
    w.rect(70, 11, 4, 1, T.HARD);
    w.stairsDown(74, 4);

    w.pipe(96, 11);

    w.rect(106, 11, 1, 1, T.QUESTION);
    w.rect(107, 11, 1, 1, T.BRICK);
    w.rect(108, 11, 1, 1, T.QUESTION);

    w.rect(126, 12, 7, 1, T.HARD);
    w.pipe(142, 13);

    w.stairsUp(156, 5);
    w.rect(161, 10, 3, 1, T.HARD);
    w.stairsDown(164, 5);

    w.coinRow(4, 12, 4);
    w.coin(29, 10); w.coin(30, 10);
    w.coinRow(42, 11, 3);
    w.coin(59, 11); w.coin(60, 11);
    w.coinRow(70, 10, 3);
    w.coin(89, 10); w.coin(90, 10);
    w.coinRow(106, 10, 2);
    w.coinRow(126, 11, 3);
    w.coin(149, 10); w.coin(150, 10);
    w.coinRow(161, 9, 3);
    w.coin(179, 11); w.coin(180, 11);
    w.coin(190, 12);

    [[12, 15], [24, 15], [44, 12], [52, 15], [71, 11], [80, 15],
     [102, 15], [110, 15], [129, 12], [138, 15], [170, 15], [190, 15]]
      .forEach(function (p) { w.enemy(p[0], p[1]); });
  }

  /* ------------------------------------------------------------------
   * 关卡 4 · 阶梯王国：连续上下阶梯与高台，最高处要爬六层
   * ------------------------------------------------------------------ */
  function stairs(w) {
    w.stairsUp(20, 5);
    w.rect(25, 10, 10, 1, T.HARD);
    w.stairsDown(35, 5);

    w.pit(48, 3);

    w.stairsUp(56, 4);
    w.rect(60, 11, 6, 1, T.HARD);
    w.stairsDown(66, 4);

    w.pipe(80, 13);

    w.rect(84, 11, 1, 1, T.BRICK);
    w.rect(85, 11, 1, 1, T.QUESTION);
    w.rect(86, 11, 1, 1, T.BRICK);
    w.rect(87, 11, 1, 1, T.QUESTION);

    w.pit(92, 4); w.stone(93, 2, 12);

    w.stairsUp(102, 6);
    w.rect(108, 9, 8, 1, T.HARD);
    w.stairsDown(116, 6);

    w.pipe(128, 12);

    w.rect(132, 11, 1, 1, T.QUESTION);
    w.rect(133, 11, 1, 1, T.BRICK);
    w.rect(134, 11, 1, 1, T.QUESTION);

    w.pit(142, 3);

    w.stairsUp(150, 4);
    w.rect(154, 11, 5, 1, T.HARD);
    w.stairsDown(159, 4);

    w.pipe(170, 13);
    w.pit(180, 3);

    w.rect(188, 11, 1, 1, T.BRICK);
    w.rect(189, 11, 1, 1, T.QUESTION);
    w.rect(190, 11, 1, 1, T.BRICK);

    w.coinRow(4, 12, 4);
    w.coinRow(25, 9, 4);
    w.coinRow(60, 10, 3);
    w.coinRow(84, 10, 2);
    w.coin(93, 11); w.coin(94, 11);
    w.coinRow(108, 8, 4);
    w.coinRow(132, 10, 2);
    w.coin(143, 12);
    w.coinRow(154, 10, 3);
    w.coinRow(188, 10, 2);

    [[12, 15], [28, 10], [40, 15], [54, 15], [63, 11], [76, 15],
     [90, 15], [98, 15], [112, 9], [124, 15], [136, 15], [146, 15],
     [157, 11], [168, 15], [176, 15], [192, 15]]
      .forEach(function (p) { w.enemy(p[0], p[1]); });
  }

  /* ------------------------------------------------------------------
   * 关卡 5 · 浮空回廊：地面碎成一段段，高处架着回廊
   * ------------------------------------------------------------------ */
  function sky(w) {
    w.pit(20, 3);
    w.pit(30, 4); w.stone(31, 2, 12);
    w.pit(44, 3);
    w.pit(54, 4); w.stone(55, 2, 12);
    w.pit(68, 3);
    w.pit(78, 4); w.stone(79, 2, 12);
    w.pit(92, 3);

    w.pipe(100, 13);
    w.rect(104, 11, 6, 1, T.HARD);

    w.pit(116, 4); w.stone(117, 2, 12);
    w.pit(130, 3);

    w.rect(134, 11, 7, 1, T.HARD);

    w.pit(146, 4); w.stone(147, 2, 12);

    w.pipe(158, 12);
    w.pit(166, 3);

    w.rect(170, 11, 8, 1, T.HARD);

    w.pit(182, 4); w.stone(183, 2, 12);
    w.pit(196, 3);

    w.rect(200, 11, 5, 1, T.HARD);

    w.rect(13, 11, 1, 1, T.QUESTION);
    w.rect(60, 11, 1, 1, T.BRICK);
    w.rect(61, 11, 1, 1, T.QUESTION);
    w.rect(88, 11, 1, 1, T.QUESTION);
    w.rect(89, 11, 1, 1, T.BRICK);

    w.coinRow(4, 12, 4);
    w.coin(31, 10); w.coin(32, 10);
    w.coin(55, 10); w.coin(56, 10);
    w.coinRow(104, 10, 3);
    w.coinRow(117, 10, 2);
    w.coinRow(134, 10, 4);
    w.coin(147, 10); w.coin(148, 10);
    w.coinRow(170, 10, 4);
    w.coin(183, 10); w.coin(184, 10);
    w.coinRow(200, 10, 3);
    w.coin(210, 12);

    [[12, 15], [26, 15], [40, 15], [50, 15], [62, 15], [74, 15],
     [88, 15], [106, 11], [112, 15], [124, 15], [137, 11],
     [152, 15], [162, 15], [174, 11], [190, 15], [204, 15]]
      .forEach(function (p) { w.enemy(p[0], p[1]); });
  }

  /* ------------------------------------------------------------------
   * 关卡 6 · 终局冲刺：把前面所有地形混在一起，敌人密度最高
   * ------------------------------------------------------------------ */
  function finale(w) {
    w.pit(24, 3);
    w.pit(36, 4); w.stone(37, 2, 12);

    w.pipe(46, 13);
    w.pipe(50, 12);

    w.pit(58, 3);
    w.pit(68, 4); w.stone(69, 2, 12);

    w.rect(74, 11, 5, 1, T.HARD);

    w.stairsUp(84, 4);
    w.rect(88, 11, 5, 1, T.HARD);
    w.stairsDown(93, 4);

    w.pit(102, 3);

    w.rect(106, 11, 1, 1, T.QUESTION);
    w.rect(107, 11, 1, 1, T.BRICK);
    w.rect(108, 11, 1, 1, T.QUESTION);
    w.rect(109, 11, 1, 1, T.BRICK);

    w.stairsUp(114, 6);
    w.rect(120, 9, 8, 1, T.HARD);
    w.stairsDown(128, 6);

    w.pit(138, 4); w.stone(139, 2, 12);

    w.pipe(148, 12);
    w.rect(152, 11, 7, 1, T.HARD);

    w.pit(164, 3);
    w.pit(174, 4); w.stone(175, 2, 12);

    w.rect(180, 11, 6, 1, T.HARD);

    w.pipe(190, 13);
    w.pit(198, 3);

    w.stairsUp(206, 4);
    w.rect(210, 11, 5, 1, T.HARD);
    w.stairsDown(215, 4);

    w.pit(222, 3);

    w.coinRow(4, 12, 4);
    w.coin(37, 10); w.coin(38, 10);
    w.coinRow(74, 10, 3);
    w.coinRow(88, 10, 3);
    w.coinRow(106, 10, 2);
    w.coinRow(120, 8, 4);
    w.coin(139, 10); w.coin(140, 10);
    w.coinRow(152, 10, 4);
    w.coin(175, 10); w.coin(176, 10);
    w.coinRow(180, 10, 3);
    w.coinRow(210, 10, 3);
    w.coin(226, 12);

    [[12, 15], [20, 15], [30, 15], [42, 15], [54, 15], [62, 15],
     [76, 11], [80, 15], [90, 11], [98, 15], [112, 15], [122, 9],
     [135, 15], [144, 15], [156, 11], [160, 15], [170, 15],
     [182, 11], [192, 15], [204, 15], [212, 11], [220, 15]]
      .forEach(function (p) { w.enemy(p[0], p[1]); });
  }

  var DEFS = [
    { id: 'meadow', width: 192, name: { zh: '草原起步', en: 'Meadow Start' }, draw: meadow },
    { id: 'pipes', width: 200, name: { zh: '管道迷宫', en: 'Pipe Maze' }, draw: pipes },
    { id: 'canyon', width: 208, name: { zh: '断崖飞跃', en: 'Canyon Leap' }, draw: canyon },
    { id: 'stairs', width: 216, name: { zh: '阶梯王国', en: 'Stair Kingdom' }, draw: stairs },
    { id: 'sky', width: 224, name: { zh: '浮空回廊', en: 'Sky Gallery' }, draw: sky },
    { id: 'finale', width: 240, name: { zh: '终局冲刺', en: 'Final Rush' }, draw: finale }
  ];

  function build(index) {
    var i = index == null ? 0 : (index | 0);
    if (i < 0) i = 0;
    if (i > DEFS.length - 1) i = DEFS.length - 1;

    var def = DEFS[i];
    var ws = workspace(def.width);
    def.draw(ws);

    return {
      index: i,
      total: DEFS.length,
      id: def.id,
      name: def.name,
      W: ws.W,
      H: ws.H,
      tiles: ws.tiles,
      coins: ws.coins,
      enemies: ws.enemies,
      spawn: { x: 3 * 16, y: GROUND_ROW * 16 - 15 },
      flag: { x: (def.width - 14) * 16, topY: FLAG_TOP_ROW * 16, bottomY: GROUND_ROW * 16 }
    };
  }

  function isSolid(t) {
    return t !== T.AIR;
  }

  SJ.Level = {
    T: T,
    H: H,
    GROUND_ROW: GROUND_ROW,
    count: DEFS.length,
    defs: DEFS,
    build: build,
    isSolid: isSolid
  };
})();
