/**
 * core/store.js - 按棋种分区的存档
 *
 * 平台 storage 是全游戏共用的，这里加 bg:<棋种>: 前缀，
 * 六个棋种的战绩、设置互不覆盖。全部走 GamePlatform.storage，
 * 因此和平台的其他存档一样跨会话保留。
 */
(function (global) {
  'use strict';

  var BG = global.BG || (global.BG = {});

  function platform() {
    return global.GamePlatform && global.GamePlatform.storage;
  }

  function keyOf(gameId, key) {
    return 'bg:' + gameId + ':' + key;
  }

  function get(gameId, key, def) {
    var s = platform();
    if (!s) return def;
    var v = s.get(keyOf(gameId, key), undefined);
    return v === undefined || v === null ? def : v;
  }

  function set(gameId, key, value) {
    var s = platform();
    if (!s) return;
    s.set(keyOf(gameId, key), value);
  }

  function remove(gameId, key) {
    var s = platform();
    if (!s) return;
    if (s.remove) s.remove(keyOf(gameId, key));
  }

  /** 清空某个棋种的全部存档（"清除记录"只影响当前棋种） */
  function clear(gameId) {
    var s = platform();
    if (!s) return;
    var prefix = 'bg:' + gameId + ':';
    if (s.keys) {
      (s.keys() || []).forEach(function (k) {
        if (String(k).indexOf(prefix) === 0) s.remove(k);
      });
      return;
    }
    // 平台未提供键枚举时，逐个删除已知键
    ['stats', 'lastResult', 'prefs', 'session'].forEach(function (k) { remove(gameId, k); });
  }

  /** 战绩自增：bump('gomoku', 'stats', 'black') */
  function bump(gameId, key, field, delta) {
    var box = get(gameId, key, null);
    if (!box || typeof box !== 'object') box = {};
    var d = delta == null ? 1 : delta;
    box[field] = Math.max(0, (box[field] || 0) + d);
    set(gameId, key, box);
    return box;
  }

  /* 跨棋种的"上次选择"，用于大厅排序与续玩提示 */
  function lastPlayed() {
    var s = platform();
    if (!s) return null;
    return s.get('bg:last', null);
  }

  function markPlayed(gameId, mode, difficulty) {
    var s = platform();
    if (!s) return;
    s.set('bg:last', { id: gameId, mode: mode, difficulty: difficulty, at: Date.now() });
  }

  BG.store = {
    get: get,
    set: set,
    remove: remove,
    clear: clear,
    bump: bump,
    keyOf: keyOf,
    lastPlayed: lastPlayed,
    markPlayed: markPlayed
  };
})(window);
