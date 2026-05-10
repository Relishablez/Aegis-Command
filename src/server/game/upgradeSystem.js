const UPGRADES = require('../config/upgrades');
const { spawnDrone } = require('./entityFactory');

function applyUpgrade(room, playerId, upgradeId, force = false) {
  const gs = room.gameState;
  const player = room.players.get(playerId);
  if (!player) return false;

  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  if (!upgrade) return false;

  if (!force && gs.currentPhase !== 'UPGRADE') {
    if (player.ws) {
      player.ws.send(JSON.stringify({ type: 'error', message: 'Upgrade phase is over!' }));
    }
    return false;
  }

  // Initialize player upgrades if needed
  if (!gs.playerUpgrades[playerId]) {
    gs.playerUpgrades[playerId] = {};
  }

  const currentLevel = gs.playerUpgrades[playerId][upgradeId] || 0;
  if (!force && currentLevel >= upgrade.max) return false;

  const cost = upgrade.costs[currentLevel] || 0;
  if (!force && player.gold < cost) return false;

  if (!force) player.gold -= cost;
  gs.playerUpgrades[playerId][upgradeId] = currentLevel + 1;

  // Mark player as ready for next wave
  player.upgradeReady = true;

  // Broadcast player selection status
  if (room.broadcastToRoom) {
    room.broadcastToRoom({
      type: 'player_upgrade_selected',
      playerId: playerId,
      playerName: player.name || `Player ${playerId.slice(-4)}`,
      upgradeName: upgrade.name
    });
  }

  // Note: All players ready check should be handled by roomManager

  // Apply upgrade effects
  const level = gs.playerUpgrades[playerId][upgradeId];

  // Player Ship Upgrades
  if (upgradeId === 'fire_rate') {
    const { PLAYER: playerConsts } = require('../config/constants');
    player.fireRate = Math.max(2.0, playerConsts.FIRE_RATE - level * 1.5);
  } else if (upgradeId === 'speed') {
    player.speed = 4 + level * 0.5;
  } else if (upgradeId === 'multishot') {
    player.multiShot = 1 + level;
  } else if (upgradeId === 'shield') {
    player.shieldMax = level * 25;
    player.shield = player.shieldMax;
  } else if (upgradeId === 'damage') {
    player.damage = 1 + level * 0.15;
  } else if (upgradeId === 'healing') {
    player.healing = level * 0.05;
  } else if (upgradeId === 'piercing') {
    player.piercing = level;
  } else if (upgradeId === 'spread') {
    player.spread = level * 0.05;
  } else if (upgradeId === 'homing') {
    player.homing = level * 0.05;
  } else if (upgradeId === 'explosive') {
    player.explosive = level * 0.1;
  } else if (upgradeId === 'lifesteal') {
    player.lifesteal = level * 0.02;
  } else if (upgradeId === 'bullet_size') {
    player.bulletSize = 1 + level * 0.3;
  }

  // Mothership Upgrades
  else if (upgradeId === 'hull_max') {
    const upgradeVal = 75 + (gs.mothership.titaniumBonus ? 100 : 0);
    gs.mothership.maxHull += upgradeVal;
    gs.mothership.hull += upgradeVal;
  } else if (upgradeId === 'hull_repair') {
    gs.mothership.hull = Math.min(gs.mothership.maxHull, gs.mothership.hull + level * 50);
  } else if (upgradeId === 'turret') {
    gs.mothership.autoTurret = level;
  } else if (upgradeId === 'drone') {
    gs.drones.push(spawnDrone(gs.mothership));
  } else if (upgradeId === 'support_drone') {
    const drone = spawnDrone(gs.mothership);
    drone.isSupport = true;
    gs.drones.push(drone);
  } else if (upgradeId === 'drone_speed') {
    gs.droneFireRateBonus = (gs.droneFireRateBonus || 0) + 0.1;
  } else if (upgradeId === 'drone_damage') {
    gs.droneDamageBonus = (gs.droneDamageBonus || 0) + 0.15;
  } else if (upgradeId === 'shield_gen') {
    gs.mothership.shieldRegen = (gs.mothership.shieldRegen || 0) + 0.5;
    gs.mothership.shieldMax = (gs.mothership.shieldMax || 0) + level * 30;
    if (gs.mothership.shield === 0) {
      gs.mothership.shield = gs.mothership.shieldMax;
    }
  } else if (upgradeId === 'mothership_speed') {
    gs.mothership.speed = 0.4 + level * 0.1;
  }

  // Special Upgrades
  else if (upgradeId === 'reroll') {
    // Handled separately - just tracks reroll count
  } else if (upgradeId === 'xp_boost') {
    gs.xpMultiplier = (gs.xpMultiplier || 1) + 0.15;
  } else if (upgradeId === 'luck') {
    gs.dropRateBonus = (gs.dropRateBonus || 0) + 0.10;
  } else if (upgradeId === 'crit_chance') {
    player.critChance = (player.critChance || 0) + 0.05;
  } else if (upgradeId === 'pickup_range') {
    gs.teamPickupRange = (gs.teamPickupRange || 0) + 25;
  } else if (upgradeId === 'hull_repair_instant') {
    gs.mothership.hull = Math.min(gs.mothership.maxHull, gs.mothership.hull + gs.mothership.maxHull * 0.25);
  } else if (upgradeId === 'gold_stash_instant') {
    player.gold += 500;
  } else if (upgradeId === 'luck_boost_instant') {
    gs.dropRateBonus = (gs.dropRateBonus || 0) + 0.5;
  } else if (upgradeId === 'fractal_shrapnel') {
    player.fractalShrapnel = true;
  }

  // Update weapon preference if a weapon was bought
  if (['laser', 'homing_missile', 'pulse_wave'].includes(upgradeId)) {
    player.weaponType = upgradeId;
  }

  // Recalculate all stats to keep them consistent
  recalculatePlayerStats(player, gs);

  return true;
}

function generateUpgradeOptions(playerUpgrades = {}, pinnedIds = []) {
  if (!Array.isArray(pinnedIds)) pinnedIds = pinnedIds ? [pinnedIds] : [];
  
  let pinnedUpgrades = pinnedIds.map(id => UPGRADES.find(u => u.id === id)).filter(Boolean);

  const availableUpgrades = UPGRADES.filter(upgrade => {
    const currentLevel = playerUpgrades[upgrade.id] || 0;
    return currentLevel < upgrade.max && !pinnedIds.includes(upgrade.id) && upgrade.type !== 'omega';
  });

  // Shuffle and pick random upgrades
  const shuffled = availableUpgrades.sort(() => Math.random() - 0.5);
  const optionsNeeded = Math.max(0, 3 - pinnedUpgrades.length);
  const options = shuffled.slice(0, optionsNeeded);

  pinnedUpgrades.reverse().forEach(pu => options.unshift(pu));

  // Ensure at least 3 options always exist
  if (options.length < 3) {
    const fallbacks = [
      { id: 'hull_repair_instant', name: 'Emergency Repair', description: 'Instantly restore 25% mothership hull', type: 'special', max: 99, costs: [0] },
      { id: 'gold_stash_instant', name: 'Gold Reserves', description: 'Receive 500 gold bonus instantly', type: 'special', max: 99, costs: [0] },
      { id: 'luck_boost_instant', name: 'Scrap Magnet', description: 'Significant temporary drop rate boost', type: 'special', max: 99, costs: [0] }
    ];
    let safety = 0;
    while (options.length < 3 && safety < 100) {
      safety++;
      const fb = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      if (!options.find(o => o.id === fb.id)) {
        options.push(fb);
      } else {
        if (options.length >= availableUpgrades.length + fallbacks.length) break;
      }
    }
  }

  return options;
}

function rerollUpgrades(playerUpgrades = {}, pinnedIds = []) {
  return generateUpgradeOptions(playerUpgrades, pinnedIds);
}

function pinUpgrade(player, upgradeId) {
  if (!player.pinnedIds) player.pinnedIds = [];
  player.pinnedIds.push(upgradeId);
  return true;
}

function recalculatePlayerStats(player, gs) {
  const playerId = player.id;
  if (!gs.playerUpgrades) return;
  const upgrades = gs.playerUpgrades[playerId] || {};

  const frLevel = upgrades['fire_rate'] || 0;
  const dmgLevel = upgrades['damage'] || 0;
  const msLevel = upgrades['multishot'] || 0;
  const bsLevel = upgrades['bullet_size'] || 0;
  const laserLevel = upgrades['laser'] || 0;
  const homingLevel = upgrades['homing_missile'] || 0;
  const pulseLevel = upgrades['pulse_wave'] || 0;

  const { PLAYER: playerConsts } = require('../config/constants');
  player.fireRate = Math.max(2.0, playerConsts.FIRE_RATE - frLevel * 1.5);
  player.damage = 1 + dmgLevel * 0.15;
  player.multiShot = 1 + msLevel;
  player.bulletSize = 1 + bsLevel * 0.3;
  
  if (player.multiShot >= 10) {
    player.fireRate *= 1.5; // Natural reduction to prevent lag
    player.fireRateWarning = true;
  } else {
    player.fireRateWarning = false;
  }
  
  const speedLevel = upgrades['speed'] || 0;
  player.pickupRange = speedLevel * 20;

  player.hasLaser = laserLevel > 0;
  player.hasMissile = homingLevel > 0;
  player.hasPulse = pulseLevel > 0;
  player.hasDefault = !player.hasLaser && !player.hasMissile && !player.hasPulse;

  // Keep weaponType for backward compatibility / icon if needed
  if (!player.weaponType || player.hasDefault) {
    if (player.hasLaser) player.weaponType = 'laser';
    else if (player.hasMissile) player.weaponType = 'homing_missile';
    else if (player.hasPulse) player.weaponType = 'pulse_wave';
    else player.weaponType = 'default';
  }

  // Base stats that affect all weapons
  const totalLaserLevel = laserLevel + (player.merchantLaser || 0);
  player.laserRange = 500 + (totalLaserLevel * 80);
  player.laserDamageMult = 1.8;
  player.laserThickness = 0.15 + (totalLaserLevel * 0.1);

  player.pulseArc = (Math.PI / 4) + (pulseLevel * (Math.PI * 1.75 / 10)); // Scaled arc up to ~360 deg
  
  if (player.hasLaser) player.fireRate *= 1.1;
  if (player.hasMissile) player.fireRate *= 1.4;
  if (player.hasPulse) player.fireRate *= 1.5;

  if (player.superFireRateActive) {
    player.fireRate *= 0.5;
    player.damage *= 2;
  }
  if (player.superWeaponsActive) {
    player.multiShot *= 3;
    player.bulletSize *= 3;
  }
  if (player.superHomingActive) {
    player.homing = 100;
    player.superExplosive = true;
  }

  if (player.merchantMultiShot) player.multiShot *= player.merchantMultiShot;
  if (player.merchantDamage) player.damage *= player.merchantDamage;
  if (player.merchantFireRate) player.fireRate *= player.merchantFireRate;
  if (player.merchantHoming) player.homing = (player.homing || 0) + 0.2;

  player.ramSpikes = upgrades['ram_spikes'] || 0;
  player.shrapnel = upgrades['shrapnel'] || 0;
  player.fractalShrapnel = player.fractalShrapnel || false;
  player.chainLightning = upgrades['chain_lightning'] || 0;
  player.mines = upgrades['mines'] || 0;

  // Drone Global Bonuses
  const droneSpeedLevel = upgrades['drone_speed'] || 0;
  const droneDamageLevel = upgrades['drone_damage'] || 0;
  gs.droneFireRateBonus = 1 + (droneSpeedLevel * 0.1);
  gs.droneSpeedBonus = 1 + (droneSpeedLevel * 0.15);
  gs.droneDamageBonus = 1 + (droneDamageLevel * 0.2);
}

module.exports = {
  applyUpgrade,
  generateUpgradeOptions,
  rerollUpgrades,
  pinUpgrade,
  recalculatePlayerStats
};
