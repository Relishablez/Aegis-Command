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

  // Check if player actually benefits from this (due to merchant/omega overlaps)
  if (!force && !wouldBenefitFromUpgrade(player, gs, upgradeId)) {
    if (player.ws) {
        player.ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'MAX CAPACITY REACHED: This upgrade would provide no further benefit.' 
        }));
    }
    return false;
  }

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
  if (upgrade.type === 'mothership') {
    // Also store in mothershipUpgrades for team-wide consistency
    if (!gs.mothershipUpgrades) gs.mothershipUpgrades = {};
    gs.mothershipUpgrades[upgradeId] = (gs.mothershipUpgrades[upgradeId] || 0) + 1;
    recalculateMothershipStats(gs);
  } else {
    recalculatePlayerStats(player, gs);
  }

  return true;
}

function generateUpgradeOptions(playerUpgrades = {}, pinnedIds = []) {
  if (!Array.isArray(pinnedIds)) pinnedIds = pinnedIds ? [pinnedIds] : [];
  
  let pinnedUpgrades = pinnedIds.map(id => UPGRADES.find(u => u.id === id)).filter(Boolean);

  const availableUpgrades = UPGRADES.filter(upgrade => {
    const currentLevel = playerUpgrades[upgrade.id] || 0;
    // Omega upgrades only in special phases
    if (upgrade.type === 'omega') return false;
    // Requirements
    if (upgrade.id === 'fractal_shrapnel' && (playerUpgrades['shrapnel'] || 0) === 0) return false;
    
    return currentLevel < upgrade.max && !pinnedIds.includes(upgrade.id);
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

function wouldBenefitFromUpgrade(player, gs, upgradeId) {
    // Ensure current stats are up to date before taking backup
    recalculatePlayerStats(player, gs, true);

    const backupStats = {
        fireRate: player.fireRate,
        damage: player.damage,
        multiShot: player.multiShot,
        speed: player.speed,
        bulletSize: player.bulletSize,
        homing: player.homing,
        merchantLaser: player.merchantLaser,
        weaponType: player.weaponType,
        piercing: player.piercing,
        healing: player.healing,
        explosive: player.explosive,
        ramSpikes: player.ramSpikes,
        shrapnel: player.shrapnel,
        chainLightning: player.chainLightning,
        mines: player.mines,
        hasRift: player.hasRift,
        hasLaser: player.hasLaser,
        hasMissile: player.hasMissile,
        hasPulse: player.hasPulse,
        laserRange: player.laserRange,
        laserThickness: player.laserThickness,
        pulseArc: player.pulseArc,
        pulseMaxRadius: player.pulseMaxRadius,
        pulseBeamMaxRadius: player.pulseBeamMaxRadius,
        fractalShrapnel: player.fractalShrapnel,
        droneDamage: gs.droneDamageBonus,
        droneFireRate: gs.droneFireRateBonus,
        mHull: gs.mothership?.maxHull,
        mHullRegen: gs.mothership?.hullRegen,
        mShield: gs.mothership?.shieldMax,
        mShieldRegen: gs.mothership?.shieldRegen,
        mSpeed: gs.mothership?.escortSpeed,
        mTurret: gs.mothership?.autoTurret,
        mDrones: gs.drones?.length,
        xpMult: gs.xpMultiplier,
        dropRate: gs.dropRateBonus,
        hasKamehameha: player.hasOmegaKamehameha
    };

    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade) return true; // Default to allowing if ID unknown (dev/omega)

    // Store original levels
    const originalPlayerUpgrades = JSON.parse(JSON.stringify(gs.playerUpgrades[player.id] || {}));
    const originalMothershipUpgrades = JSON.parse(JSON.stringify(gs.mothershipUpgrades || {}));
    const originalMerchantLaser = player.merchantLaser;
    const originalMerchantMultiShot = player.merchantMultiShot;
    const originalMerchantDamage = player.merchantDamage;
    const originalMerchantFireRate = player.merchantFireRate;

    // Apply temporary effect to correct system
    if (upgrade.type === 'mothership') {
        if (!gs.mothershipUpgrades) gs.mothershipUpgrades = {};
        gs.mothershipUpgrades[upgradeId] = (gs.mothershipUpgrades[upgradeId] || 0) + 1;
    } else {
        if (!gs.playerUpgrades[player.id]) gs.playerUpgrades[player.id] = {};
        gs.playerUpgrades[player.id][upgradeId] = (gs.playerUpgrades[player.id][upgradeId] || 0) + 1;
    }

    // Explicitly handle special/merchant flags that recalculatePlayerStats might miss
    if (upgradeId === 'fractal_shrapnel') player.fractalShrapnel = true;
    if (upgradeId === 'omega_kamehameha') player.hasOmegaKamehameha = true;
    if (upgradeId === 'laser_weapon') player.weaponType = 'laser';

    recalculatePlayerStats(player, gs, true); 
    recalculateMothershipStats(gs, true);

    const hasBenefit = 
        player.fireRate < backupStats.fireRate ||
        player.damage > backupStats.damage ||
        player.multiShot > backupStats.multiShot ||
        player.speed > backupStats.speed ||
        player.bulletSize > backupStats.bulletSize ||
        player.homing > backupStats.homing ||
        player.merchantLaser > backupStats.merchantLaser ||
        (upgradeId === 'laser' && backupStats.weaponType !== 'laser') ||
        player.piercing > backupStats.piercing ||
        player.healing > backupStats.healing ||
        player.explosive > backupStats.explosive ||
        player.ramSpikes > backupStats.ramSpikes ||
        player.shrapnel > backupStats.shrapnel ||
        player.chainLightning > backupStats.chainLightning ||
        player.mines > backupStats.mines ||
        player.hasRift > backupStats.hasRift ||
        (player.hasLaser && !backupStats.hasLaser) ||
        (player.hasMissile && !backupStats.hasMissile) ||
        (player.hasPulse && !backupStats.hasPulse) ||
        player.laserRange > backupStats.laserRange ||
        player.laserThickness > backupStats.laserThickness ||
        player.pulseArc > backupStats.pulseArc ||
        player.pulseMaxRadius > backupStats.pulseMaxRadius ||
        player.pulseBeamMaxRadius > backupStats.pulseBeamMaxRadius ||
        (player.fractalShrapnel && !backupStats.fractalShrapnel) ||
        (player.hasOmegaKamehameha && !backupStats.hasKamehameha) ||
        (upgradeId === 'laser_weapon' && backupStats.weaponType !== 'laser') ||
        gs.droneDamageBonus > backupStats.droneDamage ||
        gs.droneFireRateBonus > backupStats.droneFireRate ||
        (gs.mothership?.maxHull > backupStats.mHull) ||
        (gs.mothership?.hullRegen > backupStats.mHullRegen) ||
        (gs.mothership?.shieldMax > backupStats.mShield) ||
        (gs.mothership?.shieldRegen > backupStats.mShieldRegen) ||
        (gs.mothership?.escortSpeed > backupStats.mSpeed) ||
        (gs.mothership?.autoTurret > backupStats.mTurret) ||
        (gs.drones?.length > backupStats.mDrones) ||
        (gs.xpMultiplier > backupStats.xpMult) ||
        (gs.dropRateBonus > backupStats.dropRate) ||
        (upgrade.type === 'player' && (gs.playerUpgrades[player.id][upgradeId] || 0) > (originalPlayerUpgrades[upgradeId] || 0)) ||
        (upgrade.type === 'mothership' && (gs.mothershipUpgrades[upgradeId] || 0) > (originalMothershipUpgrades[upgradeId] || 0));
        // Fallback: If the level increased, allow it unless we hit a hard cap

    // Restore
    gs.playerUpgrades[player.id] = originalPlayerUpgrades;
    gs.mothershipUpgrades = originalMothershipUpgrades;
    player.merchantLaser = originalMerchantLaser;
    player.merchantMultiShot = originalMerchantMultiShot;
    player.merchantDamage = originalMerchantDamage;
    player.merchantFireRate = originalMerchantFireRate;
    player.fractalShrapnel = backupStats.fractalShrapnel;
    player.hasOmegaKamehameha = backupStats.hasKamehameha;
    
    recalculatePlayerStats(player, gs, true);
    recalculateMothershipStats(gs, true);

    return hasBenefit;
}

function recalculateMothershipStats(gs, silent = false) {
  if (!gs.mothership || !gs.mothershipUpgrades) return;
  const m = gs.mothership;
  const mu = gs.mothershipUpgrades;
  const { MOTHERSHIP: mConsts } = require('../config/constants');

  m.maxHull = mConsts.HULL + (mu['hull_max'] || 0) * 200;
  m.shieldMax = (mu['shield_gen'] || 0) * 150;
  m.shieldRegen = (mu['shield_gen'] || 0) * 0.5;
  m.hullRegen = (mu['hull_repair'] || 0) * 0.2;
  m.autoTurret = mu['turret'] || 0;
  m.escortSpeed = 0.5 + (mu['mothership_speed'] || 0) * 0.15;

  // Drone Stats (Team-wide)
  const droneSpeedLevel = mu['drone_speed'] || 0;
  const droneDamageLevel = mu['drone_damage'] || 0;
  gs.droneFireRateBonus = 1 + (droneSpeedLevel * 0.1);
  gs.droneSpeedBonus = 1 + (droneSpeedLevel * 0.15);
  gs.droneDamageBonus = 1 + (droneDamageLevel * 0.2);
}

function recalculatePlayerStats(player, gs, silent = false) {
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
  const pierceLevel = upgrades['piercing'] || 0;
  const healLevel = upgrades['healing'] || 0;
  const explodeLevel = upgrades['explosive'] || 0;
  const homingUpgradeLevel = upgrades['homing'] || 0;
  const lifestealLevel = upgrades['lifesteal'] || 0;
  const xpBoostLevel = upgrades['xp_boost'] || 0;
  const luckLevel = upgrades['luck'] || 0;

  const { PLAYER: playerConsts } = require('../config/constants');
  
  // Base stat calculation
  player.fireRate = playerConsts.FIRE_RATE - frLevel * 1.5;
  player.damage = 1 + dmgLevel * 0.15;
  player.multiShot = 1 + msLevel;
  player.bulletSize = 1 + bsLevel * 0.3;
  
  const speedLevel = upgrades['speed'] || 0;
  player.speed = 4 + speedLevel * 0.5;
  player.pickupRange = speedLevel * 20;

  const shieldLevel = upgrades['shield'] || 0;
  player.shieldMax = shieldLevel * 25;

  player.piercing = pierceLevel;
  player.healing = healLevel * 0.05;
  player.explosive = explodeLevel * 0.5;
  player.homing = homingUpgradeLevel * 0.05;
  player.lifesteal = lifestealLevel * 0.02;

  // Global Team Stats (Summed across all players)
  let totalXpBoost = 0;
  let totalLuck = 0;
  if (gs.playerUpgrades) {
    Object.values(gs.playerUpgrades).forEach(upgs => {
      totalXpBoost += (upgs['xp_boost'] || 0);
      totalLuck += (upgs['luck'] || 0);
    });
  }
  gs.xpMultiplier = 1 + (totalXpBoost * 0.15);
  gs.dropRateBonus = totalLuck * 0.10;

  player.hasLaser = laserLevel > 0;
  player.hasMissile = homingLevel > 0;
  player.hasPulse = pulseLevel > 0;
  player.hasDefault = true;

  // Weapon Penalties & Super Boosts
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

  // Merchant Buffs
  if (player.merchantMultiShot) player.multiShot *= player.merchantMultiShot;
  if (player.merchantDamage) player.damage *= player.merchantDamage;
  if (player.merchantFireRate) player.fireRate *= player.merchantFireRate;
  if (player.merchantHoming) player.homing = (player.homing || 0) + 0.2;

  // ABSOLUTE CAPS ENFORCEMENT
  let capReached = false;
  let capMsg = "";

  // 1. Projectile Cap: 10
  if (player.multiShot > 10) {
    player.multiShot = 10;
    capReached = true;
    capMsg = "MAX PROJECTILES (10) REACHED";
  }

  // 2. Fire Rate Cap: 1000% (10x Base)
  // Base is 20, so min delay is 2.0
  const minFireDelay = playerConsts.FIRE_RATE / 10;
  if (player.fireRate < minFireDelay) {
    player.fireRate = minFireDelay;
    capReached = true;
    capMsg = "MAX FIRE RATE (1000%) REACHED";
  }

  // Notify player if they hit a cap (only if not a dry-run)
  if (!silent && capReached && player.ws && player.ws.readyState === 1) {
      player.ws.send(JSON.stringify({ 
          type: 'announcement', 
          text: 'SYSTEM LIMIT', 
          sub: capMsg,
          color: '#e74c3c'
      }));
  }

  // Weapon Specifics
  const totalLaserLevel = laserLevel + (player.merchantLaser || 0);
  player.laserRange = 500 + (totalLaserLevel * 80);
  player.laserDamageMult = 1.8;
  player.laserThickness = 0.15 + (totalLaserLevel * 0.1);

  player.pulseArc = (Math.PI / 4) + (pulseLevel * (Math.PI * 1.75 / 10)); 
  player.pulseMaxRadius = 120 + (pulseLevel * 60) + (bsLevel * 40);
  player.pulseBeamMaxRadius = 300 + (pulseLevel * 120) + (bsLevel * 100);

  player.ramSpikes = upgrades['ram_spikes'] || 0;
  player.shrapnel = upgrades['shrapnel'] || 0;
  player.fractalShrapnel = player.fractalShrapnel || false;
  player.chainLightning = upgrades['chain_lightning'] || 0;
  player.mines = upgrades['mines'] || 0;
  
  const riftLevel = upgrades['blackhole_rift'] || 0;
  player.hasRift = riftLevel > 0;
  if (player.hasRift) {
    player.riftMaxCooldown = 600;
    player.riftReady = (player.riftCooldown || 0) <= 0;
  }

  // Mothership upgrades moved to recalculateMothershipStats
}

module.exports = {
  applyUpgrade,
  generateUpgradeOptions,
  rerollUpgrades,
  pinUpgrade,
  recalculatePlayerStats,
  recalculateMothershipStats,
  wouldBenefitFromUpgrade
};
