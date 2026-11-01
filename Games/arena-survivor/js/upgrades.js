/* arena-survivor - upgrade pool */
(function () {
  'use strict';

  var SJ = window.SJ = window.SJ || {};

  SJ.Upgrades = [
    {
      id: 'dmg',
      icon: '⚔',
      name: { zh: '强力攻击', en: 'Power Shot' },
      desc: { zh: '伤害 +22%', en: '+22% damage' },
      apply: function (s) { s.damage *= 1.22; }
    },
    {
      id: 'speed',
      icon: '🔥',
      name: { zh: '快速射击', en: 'Rapid Fire' },
      desc: { zh: '攻击速度 +16%', en: '+16% attack speed' },
      apply: function (s) { s.fireInterval *= 0.86; }
    },
    {
      id: 'hp',
      icon: '❤',
      name: { zh: '生命强化', en: 'Vitality' },
      desc: { zh: '最大生命 +25 并回复', en: '+25 max HP and heal' },
      apply: function (s) { s.maxHp += 25; s.hp = Math.min(s.maxHp, s.hp + 25); }
    },
    {
      id: 'move',
      icon: '💨',
      name: { zh: '疾风步', en: 'Swift Feet' },
      desc: { zh: '移动速度 +11%', en: '+11% move speed' },
      apply: function (s) { s.speed *= 1.11; }
    },
    {
      id: 'multi',
      icon: '✦',
      name: { zh: '分裂弹', en: 'Split Shot' },
      desc: { zh: '每次多发射 1 发子弹', en: '+1 projectile per shot' },
      apply: function (s) { s.projectiles += 1; }
    },
    {
      id: 'magnet',
      icon: '🧲',
      name: { zh: '磁力吸引', en: 'Magnet' },
      desc: { zh: '拾取范围 +45', en: '+45 pickup range' },
      apply: function (s) { s.pickupR += 45; }
    },
    {
      id: 'crit',
      icon: '💥',
      name: { zh: '致命一击', en: 'Critical' },
      desc: { zh: '暴击率 +8%（双倍伤害）', en: '+8% crit (double damage)' },
      apply: function (s) { s.crit += 0.08; }
    },
    {
      id: 'pierce',
      icon: '➳',
      name: { zh: '穿透弹', en: 'Pierce' },
      desc: { zh: '子弹可多穿透 1 个敌人', en: 'Bullets pierce +1 enemy' },
      apply: function (s) { s.pierce += 1; }
    },
    {
      id: 'heal',
      icon: '✚',
      name: { zh: '急救包', en: 'First Aid' },
      desc: { zh: '立即回复 45% 生命', en: 'Heal 45% HP now' },
      apply: function (s) { s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.45); }
    },
    {
      id: 'bulletSpeed',
      icon: '➤',
      name: { zh: '高速弹头', en: 'Velocity' },
      desc: { zh: '弹速 +20%，射程更远', en: '+20% projectile speed' },
      apply: function (s) { s.bulletSpeed *= 1.2; }
    }
  ];

  SJ.pickUpgrades = function (n) {
    var pool = SJ.Upgrades.slice();
    var out = [];
    while (out.length < n && pool.length) {
      var i = Math.floor(Math.random() * pool.length);
      out.push(pool[i]);
      pool.splice(i, 1);
    }
    return out;
  };
})();
