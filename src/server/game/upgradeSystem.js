const UPGRADES = require('../config/upgrades');
const { spawnDrone } = require('./entityFactory');

function applyUpgrade(room, playerId, upgradeId) {
  const gs = room.gameState;
  const player = room.players.get(playerId);
  if (!player) return false;
  
  const upgrade = UPGRADES.find(u => u.id === upgradeId);
  if (!upgrade) return false;
  
  // Initialize player upgrades if needed
  if (!gs.playerUpgrades[playerId]) {
    gs.playerUpgrades[playerId] = {};
  }
  
  const currentLevel = gs.playerUpgrades[playerId][upgradeId] || 0;
  if (currentLevel >= upgrade.max) return false;
  
  const cost = upgrade.costs[currentLevel];
  if (player.gold < cost) return false;
  
  player.gold -= cost;
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
    player.fireRate = Math.max(2, 8 - level * 0.7);
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
    player.bulletSize = 1 + level * 0.1;
  }
  
  // Mothership Upgrades
  else if (upgradeId === 'hull_max') {
    const oldMax = gs.mothership.maxHull;
    gs.mothership.maxHull = 300 + level * 75;
    gs.mothership.hull += gs.mothership.maxHull - oldMax;
  } else if (upgradeId === 'hull_repair') {
    gs.mothership.hull = Math.min(gs.mothership.maxHull, gs.mothership.hull + level * 50);
  } else if (upgradeId === 'turret') {
    gs.mothership.autoTurret = level;
  } else if (upgradeId === 'drone') {
    gs.drones.push(spawnDrone(gs.mothership));
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
    gs.dropRateBonus = (gs.dropRateBonus || 0) + 0.05;
  } else if (upgradeId === 'crit_chance') {
    player.critChance = (player.critChance || 0) + 0.05;
  } else if (upgradeId === 'pickup_range') {
    gs.teamPickupRange = (gs.teamPickupRange || 0) + 25;
  // Recalculate stats based on level
  const frLevel = gs.playerUpgrades[playerId]['fire_rate'] || 0;
  const dmgLevel = gs.playerUpgrades[playerId]['damage'] || 0;
  const msLevel = gs.playerUpgrades[playerId]['multishot'] || 0;
  const bsLevel = gs.playerUpgrades[playerId]['bullet_size'] || 0;
  const laserLevel = gs.playerUpgrades[playerId]['laser'] || 0;
  const homingLevel = gs.playerUpgrades[playerId]['homing_missile'] || 0;
  
  // Base
  player.fireRate = Math.max(2, 8 - frLevel * 0.7);
  player.damage = 1 + dmgLevel * 0.15;
  player.multiShot = 1 + msLevel;
  player.bulletSize = 1 + bsLevel * 0.1;
  
  // Weapons
  if (player.weaponType === 'laser') {
    player.fireRate *= 1.1;
    player.bulletSize = 0.15 + (laserLevel * 0.1);
    player.damage *= 1.8;
    player.laserRange = 500 + (laserLevel * 80);
  } else if (player.weaponType === 'homing_missile') {
    player.damage *= 1.5;
    player.fireRate *= 1.4;
  }

  // Super Upgrades
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
  }

  // Merchant Upgrades
  if (player.merchantMultiShot) player.multiShot *= player.merchantMultiShot;
  if (player.merchantDamage) player.damage *= player.merchantDamage;
  if (player.merchantFireRate) player.fireRate *= player.merchantFireRate;
  
  return true;
}

function generateUpgradeOptions(playerUpgrades = {}, pinnedId = null) {
  let pinnedUpgrade = null;
  if (pinnedId) {
    pinnedUpgrade = UPGRADES.find(u => u.id === pinnedId);
  }

  const availableUpgrades = UPGRADES.filter(upgrade => {
    const currentLevel = playerUpgrades[upgrade.id] || 0;
    return currentLevel < upgrade.max && upgrade.id !== pinnedId;
  });
  
  // Shuffle and pick random upgrades
  const shuffled = availableUpgrades.sort(() => Math.random() - 0.5);
  const options = shuffled.slice(0, pinnedUpgrade ? 2 : 3);
  
  if (pinnedUpgrade) {
    options.unshift(pinnedUpgrade);
  }
  
  return options;
}

function rerollUpgrades(playerUpgrades = {}, pinnedId = null) {
  return generateUpgradeOptions(playerUpgrades, pinnedId);
}

function pinUpgrade(player, upgradeId) {
  player.pinnedUpgradeId = upgradeId;
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
  
  player.fireRate = Math.max(2, 8 - frLevel * 0.7);
  player.damage = 1 + dmgLevel * 0.15;
  player.multiShot = 1 + msLevel;
  player.bulletSize = 1 + bsLevel * 0.1;
  
  if (player.weaponType === 'laser') {
    player.fireRate *= 1.1;
    player.bulletSize = 0.15 + (laserLevel * 0.1);
    player.damage *= 1.8;
    player.laserRange = 500 + (laserLevel * 80);
  } else if (player.weaponType === 'homing_missile') {
    player.damage *= 1.5;
    player.fireRate *= 1.4;
  }

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
  }

  if (player.merchantMultiShot) player.multiShot *= player.merchantMultiShot;
  if (player.merchantDamage) player.damage *= player.merchantDamage;
  if (player.merchantFireRate) player.fireRate *= player.merchantFireRate;
}

module.exports = {
  applyUpgrade,
  generateUpgradeOptions,
  rerollUpgrades,
  pinUpgrade,
  recalculatePlayerStats
};
