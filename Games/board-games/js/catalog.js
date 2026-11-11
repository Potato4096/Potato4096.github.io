/**
 * catalog.js - 四个棋种的元数据
 *
 * 大厅卡片、路由白名单、页面标题都读这里，新增棋种只需在此追加一项
 * 并在 js/games/<id>/ 提供 view.js。
 */
(function (global) {
  'use strict';

  var BG = global.BG || (global.BG = {});

  BG.catalog = [
    {
      id: 'chess',
      title: { zh: '国际象棋', en: 'Chess' },
      desc: {
        zh: '王车易位、吃过路兵、兵升变，完整标准规则',
        en: 'Castling, en passant and promotion — full standard rules'
      },
      icon: 'assets/icons/chess.svg',
      spec: { zh: '8×8', en: '8×8' },
      tags: [
        { zh: '策略', en: 'Strategy' },
        { zh: '三档 AI', en: '3 AI levels' }
      ],
      aiSide: { zh: '你执白先行，电脑执黑', en: 'You play White and move first' }
    },
    {
      id: 'chinese-chess',
      title: { zh: '中国象棋', en: 'Chinese Chess' },
      desc: {
        zh: '楚河汉界，炮马象士全规则，含将军与绝杀判定',
        en: 'Xiangqi with cannons, horses and full check rules'
      },
      icon: 'assets/icons/chinese-chess.svg',
      spec: { zh: '9×10', en: '9×10' },
      tags: [
        { zh: '策略', en: 'Strategy' },
        { zh: '三档 AI', en: '3 AI levels' }
      ],
      aiSide: { zh: '你执红先行，电脑执黑', en: 'You play Red and move first' }
    },
    {
      id: 'gomoku',
      title: { zh: '五子棋', en: 'Gomoku' },
      desc: {
        zh: '15×15 无禁手，任意方向先连成五子者胜',
        en: '15×15 free-style board, five in a row wins'
      },
      icon: 'assets/icons/gomoku.svg',
      spec: { zh: '15×15', en: '15×15' },
      tags: [
        { zh: '轻量', en: 'Quick' },
        { zh: '三档 AI', en: '3 AI levels' }
      ],
      aiSide: { zh: '你执黑先行，电脑执白', en: 'You play Black and move first' }
    },
    {
      id: 'go',
      title: { zh: '围棋', en: 'Go' },
      desc: {
        zh: '19 / 13 / 9 路可选，含提子、打劫与数子法计分',
        en: '19/13/9 boards with capture, ko and area scoring'
      },
      icon: 'assets/icons/go.svg',
      spec: { zh: '19 路', en: '19×19' },
      tags: [
        { zh: '深度', en: 'Deep' },
        { zh: '数子法', en: 'Area scoring' }
      ],
      aiSide: { zh: '你执黑先行，电脑执白', en: 'You play Black and move first' }
    }
  ];

  BG.findGame = function (id) {
    for (var i = 0; i < BG.catalog.length; i++) {
      if (BG.catalog[i].id === id) return BG.catalog[i];
    }
    return null;
  };
})(window);
