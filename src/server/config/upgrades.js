// All 25 upgrades from GDD with 10 levels each
module.exports = [
  // Player Ship Upgrades (12 options)
  { 
    id: 'fire_rate', 
    name: 'Rapid Fire (Player)', 
    type: 'player', 
    max: 10, 
    costs: [100,150,200,250,300,350,400,450,500,550],
    description: 'Increases ship fire rate by reducing weapon cooldown between shots.'
  },
  { 
    id: 'speed', 
    name: 'Afterburners', 
    type: 'player', 
    max: 10, 
    costs: [100,150,200,250,300,350,400,450,500,550],
    description: 'Movement speed boost'
  },
  { 
    id: 'multishot', 
    name: 'Spread Shot', 
    type: 'player', 
    max: 10, 
    costs: [150,200,300,400,500,600,700,800,900,1000],
    description: 'Fire additional projectiles in a fan'
  },
  { 
    id: 'shield', 
    name: 'Aegis Shield', 
    type: 'player', 
    max: 10, 
    costs: [150,200,300,400,500,600,700,800,900,1000],
    description: 'Absorb-damage energy barrier'
  },
  { 
    id: 'damage', 
    name: 'Weapon Damage', 
    type: 'player', 
    max: 10, 
    costs: [200,250,300,400,500,600,700,800,900,1000],
    description: 'Projectile damage multiplier'
  },
  { 
    id: 'healing', 
    name: 'Repair Beam', 
    type: 'player', 
    max: 10, 
    costs: [200,250,300,350,400,450,500,550,600,650],
    description: 'Weapons heal allies for % of damage dealt'
  },
  { 
    id: 'piercing', 
    name: 'Piercing Shots', 
    type: 'player', 
    max: 10, 
    costs: [250,300,400,500,600,700,800,900,1000,1100],
    description: 'Projectiles pass through multiple enemies'
  },
  { 
    id: 'laser', 
    name: 'Laser Beam', 
    type: 'player', 
    max: 5, 
    costs: [1000, 1500, 2000, 2500, 3000],
    description: 'Continuous energy beam. Upgrading increases damage, thickness, and range. Hitscan accuracy improves with tracking upgrades.'
  },
  { 
    id: 'pulse_wave', 
    name: 'Pulse Wave', 
    type: 'player', 
    max: 10, 
    costs: [600, 800, 1000, 1200, 1500, 1800, 2100, 2400, 2700, 3000],
    description: 'Fires an expanding energy arc. Upgrades increase damage and arc angle (up to 360°). Works with Spread Shot.'
  },
  { 
    id: 'homing_missile', 
    name: 'Tracking Missiles', 
    type: 'player', 
    max: 5, 
    costs: [800, 1200, 1600, 2000, 2400],
    description: 'Intrinsic tracking projectiles. SYNERGY: Your Tracking Shot upgrades allow these missiles to hit multiple targets before breaking.'
  },
  { 
    id: 'homing', 
    name: 'Tracking Shots', 
    type: 'player', 
    max: 10, 
    costs: [300,400,500,600,700,800,900,1000,1100,1200],
    description: 'Projectiles seek nearest enemies. Boosts Tracking Missile chain count.'
  },
  { 
    id: 'explosive', 
    name: 'Explosive Rounds', 
    type: 'player', 
    max: 10, 
    costs: [400,500,600,700,800,900,1000,1100,1200,1300],
    description: 'Area damage on impact'
  },
  { 
    id: 'lifesteal', 
    name: 'Life Steal', 
    type: 'player', 
    max: 10, 
    costs: [250,350,450,550,650,750,850,950,1050,1150],
    description: 'Self-heal from damage dealt'
  },
  { 
    id: 'bullet_size', 
    name: 'Heavy Rounds', 
    type: 'player', 
    max: 10, 
    costs: [150,200,250,300,350,400,450,500,550,600],
    description: 'Larger, more visible projectiles'
  },
  { 
    id: 'blackhole_rift', 
    name: 'Blackhole Rift Anchor', 
    type: 'player', 
    max: 10, 
    costs: [1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000],
    description: 'OMEGA WEAPON: Deploy a gravity rift when standing still. Sucks in small enemies and slows larger ones. Trajectory bending at edges.'
  },
  
  // Mothership Upgrades (8 options)
  { 
    id: 'hull_max', 
    name: 'Reinforced Hull', 
    type: 'mothership', 
    max: 10, 
    costs: [100,150,200,300,400,500,600,700,800,900],
    description: 'Increase maximum hull capacity'
  },
  { 
    id: 'hull_repair', 
    name: 'Nanite Repair', 
    type: 'mothership', 
    max: 10, 
    costs: [100,150,200,250,300,350,400,450,500,550],
    description: 'Passive hull regeneration'
  },
  { 
    id: 'turret', 
    name: 'Auto-Turret', 
    type: 'mothership', 
    max: 10, 
    costs: [150,200,300,400,500,600,700,800,900,1000],
    description: 'Mothership auto-fires at nearest threat'
  },
  { 
    id: 'drone', 
    name: 'Guardian Drone', 
    type: 'mothership', 
    max: 10, 
    costs: [200,300,400,500,600,700,800,900,1000,1100],
    description: 'Deploy orbital combat drones'
  },
  { 
    id: 'support_drone', 
    name: 'Support Drone', 
    type: 'mothership', 
    max: 10, 
    costs: [200,300,400,500,600,700,800,900,1000,1100],
    description: 'Deploys a Support Drone that collects nearby powerups for the team and provides passive healing. Each drone restores 1% of Max Hull to all players and the Mothership every second (capped at 10% total healing per second).'
  },
  { 
    id: 'drone_speed', 
    name: 'Overclocked Relays (Drones)', 
    type: 'mothership', 
    max: 10, 
    costs: [150,200,250,300,350,400,450,500,550,600],
    description: 'Increases fire rate and orbital speed for all drone units.'
  },
  { 
    id: 'drone_damage', 
    name: 'Drone Damage', 
    type: 'mothership', 
    max: 10, 
    costs: [200,250,300,400,500,600,700,800,900,1000],
    description: 'Increased drone damage output'
  },
  { 
    id: 'shield_gen', 
    name: 'Shield Generator', 
    type: 'mothership', 
    max: 10, 
    costs: [250,350,450,550,650,750,850,950,1050,1150],
    description: 'Energy shield around the Mothership'
  },
  { 
    id: 'mothership_speed', 
    name: 'Ion Thrusters', 
    type: 'mothership', 
    max: 10, 
    costs: [150,200,250,300,350,400,450,500,550,600],
    description: 'Faster escort movement speed'
  },
  
  // Special Upgrades (5 options)

  { 
    id: 'xp_boost', 
    name: 'Gold Boost', 
    type: 'special', 
    max: 10, 
    costs: [200,300,400,500,600,700,800,900,1000,1100],
    description: 'Multiplier on all Gold earned'
  },
  { 
    id: 'luck', 
    name: 'Lucky Drops', 
    type: 'special', 
    max: 10, 
    costs: [250,350,450,550,650,750,850,950,1050,1150],
    description: 'Increased pickup drop rate from destroyed enemies'
  },

  { 
    id: 'ram_spikes', 
    name: 'Melee Spikes', 
    type: 'player', 
    max: 10, 
    costs: [200,300,400,500,600,700,800,900,1000,1100],
    description: 'Deal massive damage by ramming enemies. Damage scales with ship speed.'
  },
  { 
    id: 'shrapnel', 
    name: 'Shrapnel Rounds', 
    type: 'player', 
    max: 10, 
    costs: [300,400,500,600,700,800,900,1000,1100,1200],
    description: 'Projectiles split into (Level + 1) fragments on impact. SYNERGY: Unlocks Fractal Shrapnel at the Merchant.'
  },
  { 
    id: 'chain_lightning', 
    name: 'Tesla Modulator', 
    type: 'player', 
    max: 10, 
    costs: [300,400,500,600,700,800,900,1000,1100,1200],
    description: 'Shots arc chain lightning to nearby enemies. Each level increases arc range and the number of potential targets (up to 5 targets at max level).'
  },
  { 
    id: 'mines', 
    name: 'Proximity Mines', 
    type: 'player', 
    max: 10, 
    costs: [300,400,500,600,700,800,900,1000,1100,1200],
    description: 'Deploy stationary mines. Upgrading reduces cooldown. At level 2+, mines gain intrinsic tracking. Synergizes with Tracking upgrades to seek enemies even faster.'
  },
  
  // OMEGA Upgrades (Boss Drops)
  {
    id: 'super_fire_rate',
    name: 'OMEGA: OVERCLOCK CORE',
    type: 'omega',
    max: 1,
    costs: [0],
    description: 'Double your current Fire Rate and +100% Damage.'
  },
  {
    id: 'super_homing',
    name: 'OMEGA: TARGETING MATRIX',
    type: 'omega',
    max: 1,
    costs: [0],
    description: 'Max Tracking and projectiles explode on impact.'
  },
  {
    id: 'super_drones',
    name: 'OMEGA: DRONE SWARM',
    type: 'omega',
    max: 1,
    costs: [0],
    description: 'Double your current Drone count and triple their fire rate.'
  },
  {
    id: 'super_weapons',
    name: 'OMEGA: TITAN BATTERY',
    type: 'omega',
    max: 1,
    costs: [0],
    description: 'Triple projectiles per shot and +200% Bullet Size.'
  },
  
  // Merchant Specific / Special Upgrades
  {
    id: 'fractal_shrapnel',
    name: 'Fractal Shrapnel',
    type: 'merchant',
    max: 1,
    costs: [1500],
    description: 'Shrapnel fragments now also split into more fragments on impact! (Requires Shrapnel Rounds)'
  }
];
