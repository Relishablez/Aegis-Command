// All 25 upgrades from GDD with 10 levels each
module.exports = [
  // Player Ship Upgrades (12 options)
  { 
    id: 'fire_rate', 
    name: 'Rapid Fire', 
    type: 'player', 
    max: 10, 
    costs: [100,150,200,250,300,350,400,450,500,550],
    description: 'Increase fire rate'
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
    name: 'Pulse Laser', 
    type: 'player', 
    max: 5, 
    costs: [1000, 1500, 2000, 2500, 3000],
    description: 'High-frequency energy pulses. Upgrading increases damage, thickness, and range.'
  },
  { 
    id: 'homing_missile', 
    name: 'Homing Missiles', 
    type: 'player', 
    max: 5, 
    costs: [800, 1200, 1600, 2000, 2400],
    description: 'Intrinsic homing projectiles. SYNERGY: Your Homing Shot upgrades allow these missiles to hit multiple targets before breaking.'
  },
  { 
    id: 'homing', 
    name: 'Homing Shots', 
    type: 'player', 
    max: 10, 
    costs: [300,400,500,600,700,800,900,1000,1100,1200],
    description: 'Projectiles seek nearest enemies. Boosts Homing Missile chain count.'
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
    id: 'drone_speed', 
    name: 'Drone Speed', 
    type: 'mothership', 
    max: 10, 
    costs: [150,200,250,300,350,400,450,500,550,600],
    description: 'Faster drone fire rate'
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
    id: 'reroll', 
    name: 'Reroll Upgrades', 
    type: 'special', 
    max: 10, 
    costs: [100,150,200,250,300,350,400,450,500,550],
    description: 'Refresh upgrade choices (consumable)'
  },
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
    id: 'crit_chance', 
    name: 'Critical Hits', 
    type: 'special', 
    max: 10, 
    costs: [300,400,500,600,700,800,900,1000,1100,1200],
    description: 'Chance for double damage'
  },
  { 
    id: 'pickup_range', 
    name: 'Magnet Pull', 
    type: 'special', 
    max: 10, 
    costs: [150,250,350,450,550,650,750,850,950,1050],
    description: 'Expanded pickup collection radius'
  }
];
