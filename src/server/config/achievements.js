module.exports = [
  {
    id: 'survivor_30',
    name: 'Survivor',
    description: 'Survive for 30 seconds',
    requirement: { type: 'time', value: 1800 }, // 30s * 60fps
    bonus: { type: 'speed', value: 0.1 } // +10% speed
  },
  {
    id: 'slayer_100',
    name: 'Enemy Slayer',
    description: 'Destroy 100 enemies',
    requirement: { type: 'kills', value: 100 },
    bonus: { type: 'damage', value: 0.1 } // +10% damage
  },
  {
    id: 'wave_15',
    name: 'Veteran',
    description: 'Reach Wave 15',
    requirement: { type: 'wave', value: 15 },
    bonus: { type: 'hull', value: 1 } // +1 max hp (relative to whatever base)
  }
];
