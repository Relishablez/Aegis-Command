const { generateUpgradeOptions } = require('./upgradeSystem');
const { 
  spawnEnemy, 
  spawnProjectile, 
  spawnMerchant,
  spawnAsteroid,
  spawnPickup,
  spawnDrone
} = require('./entityFactory');
const { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  WAVE_DURATIONS,
  UPGRADE_MAX_TIME
} = require('../config/constants');

function updateWave(room) {
  const gs = room.gameState;
  if (!gs) return;
  if (gs.gameOver || !gs.gameStarted) {
    // Log every 5 seconds if game is stuck
    if (Date.now() % 5000 < 20) {
      console.log(`[WAVE] Waiting: gameStarted=${gs.gameStarted}, gameOver=${gs.gameOver}, phase=${gs.currentPhase}`);
    }
    return;
  }

  // PROCESS TIMERS (Real-time based)
  const now = Date.now();
  if (!gs.lastTimerTick) gs.lastTimerTick = now;
  const deltaSeconds = (now - gs.lastTimerTick) / 1000;
  gs.lastTimerTick = now;
  
  // Jump Sequence / Catch-up Pause
  if (gs.jumpTimer > 0) {
      gs.jumpTimer -= deltaSeconds * 60;
      if (gs.jumpTimer <= 0) {
          gs.jumpTimer = 0;
          // When jump ends, we effectively "catch up" by resetting the lastTimerTick
          gs.lastTimerTick = Date.now();
      }
      return; // Skip everything while jumping
  }

  // PROCESS TIMERS
  if (gs.currentPhase === 'COMBAT') {
    gs.waveTimer += deltaSeconds * 60; 
  } else if (gs.currentPhase === 'UPGRADE') {
    gs.upgradeTimer += deltaSeconds * 60;
    const timeLeft = Math.max(0, Math.ceil((UPGRADE_MAX_TIME - gs.upgradeTimer) / 60));
    if (timeLeft !== gs.lastBroadcastTimeLeft) {
      gs.lastBroadcastTimeLeft = timeLeft;
      if (room.broadcastToRoom) {
        room.broadcastToRoom({
          type: 'upgrade_timer_update',
          timeLeft: timeLeft
        });
      }
    }
      
    // Re-sync upgrade menu every 3 seconds for players who haven't picked
    if (Math.floor(gs.upgradeTimer) % 180 === 0) {
      room.players.forEach((player, playerId) => {
        if (!player.upgradeReady && player.pendingUpgrades) {
          player.ws.send(JSON.stringify({
            type: 'upgrade',
            gold: player.gold,
            levels: gs.playerUpgrades[playerId] || {},
            options: player.pendingUpgrades,
            playerId: playerId,
            pinnedIds: player.pinnedIds
          }));
        }
      });
    }
  }

  // Handle phase-specific logic (exit if not in combat)
  if (gs.currentPhase !== 'COMBAT') return;
  
  // COMBAT Phase
  
  // Process pending level ups (queueing ensures we don't trigger multiple at once or conflict with wave end)
  if (gs.pendingLevelUps && gs.pendingLevelUps > 0) {
    gs.pendingLevelUps--;
    endWave(room, true);
    return;
  }
  
  // Scaling Difficulty Factors
  let diffSettingMult = 1.0;
  if (room.settings?.difficulty === 'easy') diffSettingMult = 0.6;
  if (room.settings?.difficulty === 'hard') diffSettingMult = 1.5;
  if (room.settings?.difficulty === 'insane') diffSettingMult = 2.5;

  const difficultyMultiplier = (1 + (gs.wave - 1) * 0.15) * diffSettingMult; // +15% per wave
  const playerFactor = 1 + (Math.max(1, room.players.size) - 1) * 0.25;
  
  // Enemy Spawning Logic
  if (gs.encounterType !== 'salvage' && gs.encounterType !== 'merchant' && gs.encounterType !== 'pvp') {
    gs.spawnTimer++;
    // Get faster as waves progress and more players join
    const spawnRate = Math.max(20, (120 - gs.wave * 4) / playerFactor); 
    if (gs.spawnTimer >= spawnRate) {
      gs.spawnTimer = 0;
      const hasBoss = gs.enemies.some(e => e.isBoss);
      if (!hasBoss) {
        // removed require('./entityFactory') from here
        const enemy = spawnEnemy(room);
        
        // Scale enemy stats
        enemy.maxHull *= difficultyMultiplier;
        enemy.hull = enemy.maxHull;
        enemy.speed *= (1 + (gs.wave - 1) * 0.05); // Speed increases 5% per wave
        
        gs.enemies.push(enemy);
      }
    }
  } else if (gs.encounterType === 'salvage') {
    gs.spawnTimer++;
    if (gs.spawnTimer >= 60) {
      gs.spawnTimer = 0;
      const { spawnPickup } = require('./entityFactory');
      const types = ['gold', 'gold', 'health', 'team_health', 'mothership_health', 'xp'];
      const pType = types[Math.floor(Math.random() * types.length)];
      gs.pickups.push(spawnPickup(
        50 + Math.random() * (GAME_WIDTH - 100),
        50 + Math.random() * (GAME_HEIGHT - 100),
        pType
      ));
    }
  }
  
  // Asteroid Spawning Logic
  if (gs.encounterType !== 'merchant' && gs.encounterType !== 'pvp') {
    const asteroidRate = Math.max(120, (600 - gs.wave * 30) / playerFactor);
    if (!gs.lastAsteroidSpawn) gs.lastAsteroidSpawn = 0;
    if (gs.waveTimer - gs.lastAsteroidSpawn >= asteroidRate) {
      gs.lastAsteroidSpawn = gs.waveTimer;
      const { spawnAsteroid } = require('./entityFactory');
      const asteroid = spawnAsteroid(room);
      asteroid.speed *= (1 + (gs.wave - 1) * 0.03); // Asteroids get faster too
      gs.asteroids.push(asteroid);
    }
  }
  
  // Update wave display text
  if (gs.encounterNames) {
    gs.waveDisplayName = `WAVE ${gs.wave}`;
    gs.encounterDisplayName = gs.encounterNames[gs.encounterType] || 'MISSION';
  }
  
  // Check mission completion
  if (gs.waveTimer >= gs.waveDuration) {
    if (gs.encounterType !== 'boss' && gs.encounterType !== 'merchant' && gs.encounterType !== 'escort') {
      endWave(room, false);
    }
  }
  
  // Check game over
  if (gs.mothership.hull <= 0) {
    gameOver(room, false);
  }
  

}

function triggerSuperUpgrade(room) {
  const gs = room.gameState;
  gs.currentPhase = 'SUPER_UPGRADE';
  
  // Clear map before super upgrade appears
  gs.enemies = [];
  gs.asteroids = [];
  gs.projectiles = [];
  gs.pickups = [];
  
  const superOptions = [
    { id: 'super_fire_rate', name: 'OMEGA: OVERCLOCK CORE', desc: 'Double your current Fire Rate and +100% Damage.', cost: 0, type: 'omega' },
    { id: 'super_homing', name: 'OMEGA: TARGETING MATRIX', desc: 'Max Tracking and projectiles explode on impact.', cost: 0, type: 'omega' },
    { id: 'super_drones', name: 'OMEGA: DRONE SWARM', desc: 'Double your current Drone count and triple their fire rate.', cost: 0, type: 'omega' },
    { id: 'super_weapons', name: 'OMEGA: TITAN BATTERY', desc: 'Triple projectiles per shot and +200% Bullet Size.', cost: 0, type: 'omega' },
    { id: 'omega_kamehameha', name: 'OMEGA KAMEHAMEHA', desc: 'REPLACES LASER: Massive, auto-tracking plasma beam of destruction.', cost: 0, type: 'omega' }
  ];

  room.players.forEach(p => {
    p.gold = (p.gold || 0) + 5000;
    p.superUpgradeSelected = false;
    
    // Give each player 2 random super options
    const shuffled = [...superOptions].sort(() => Math.random() - 0.5);
    p.pendingSuperUpgrades = shuffled.slice(0, 2);
    
    p.ws.send(JSON.stringify({
      type: 'super_upgrade',
      options: p.pendingSuperUpgrades
    }));
  });

  if (room.broadcastToRoom) {
    room.broadcastToRoom({
      type: 'super_upgrade_phase'
    });
    room.broadcastToRoom({
      type: 'announcement',
      text: 'BOSS DEFEATED',
      sub: 'REWARD: +5000 GOLD & SUPER UPGRADE'
    });
  }
}

function endWave(room, isMidWave = false) {
  const gs = room.gameState;
  
  // Prevent double-triggering endWave for the same wave (except for mid-wave upgrades)
  if (gs.currentPhase !== 'COMBAT' && gs.currentPhase !== 'SUPER_UPGRADE' && !isMidWave) {
    console.log(`[WAVE] endWave ignored: Already in ${gs.currentPhase} phase.`);
    return;
  }

  console.log(`[WAVE] Ending Wave ${gs.wave} (MidWave: ${isMidWave}) Node: ${gs.encounterType}`);
  
  
  // Clear entities for fresh start (unless mid-wave)
  if (!isMidWave) {
    gs.enemies = [];
    gs.asteroids = [];
    gs.projectiles = [];
    gs.pickups = [];
  }
  
  if (isMidWave) {
    triggerUpgradePhase(room, true);
  } else {
    // Reward players with +1 life every successful jump
    room.players.forEach(p => {
      p.lives = (p.lives || 0) + 1;
    });
    triggerNavigation(room);
  }
}

function triggerNavigation(room) {
  const gs = room.gameState;
  if (gs.currentPhase === 'NAVIGATION') return;
  
  try {
      console.log(`[NAV] Triggering navigation phase for room ${room.id}`);
  } catch (err) {
      console.error(`Error in gameTick for room ${room.code}:`, err);
      if (err.stack) console.error(err.stack);
  }
  
  gs.currentPhase = 'NAVIGATION';
  gs.navigationPhase = true;
  gs.nodeVotes = {}; 
  
  // Clear map entities
  gs.enemies = [];
  gs.asteroids = [];
  gs.projectiles = [];
  gs.pickups = [];
  gs.merchants = [];
  
  const options = [];
  const nextWave = gs.wave + 1;
  
  const isForcedBoss = (nextWave === 10 || nextWave === 30 || nextWave === 50);
  const isOptionalBoss = (nextWave > 50 && nextWave % 10 === 0);
  
  if (isForcedBoss) {
    options.push({
      id: 'node_boss',
      type: 'boss',
      name: 'FLAGSHIP SIGNAL',
      description: 'CRITICAL THREAT DETECTED. FLAGSHIP IS HERE.',
      icon: '☠️',
      votes: 0,
      locked: false
    });
    console.log(`[NAV] Boss wave approaching. Forcing boss node.`);
  } else {
    const nodeTypes = ['defense', 'escort', 'salvage', 'merchant'];
    if (Math.random() < 0.25 || isOptionalBoss) nodeTypes.push('pvp');
    if (isOptionalBoss) nodeTypes.push('boss');
    
    const available = [...nodeTypes];
    for (let i = 0; i < 3; i++) {
      const idx = Math.floor(Math.random() * available.length);
      const type = available.splice(idx, 1)[0] || 'defense';
      
      let isLocked = false;
      let lockReason = '';
      // Merchant node is never locked anymore, as per user request
      if (type === 'merchant') {
        isLocked = false;
        lockReason = '';
      }

      options.push({
        id: `node_${i}`,
        type: type,
        name: type.toUpperCase(),
        description: `Jump to ${type} sector`,
        icon: type === 'merchant' ? '🛒' : type === 'salvage' ? '💎' : '⚔️',
        votes: 0,
        locked: isLocked,
        lockReason: lockReason
      });
    }

    // Add "FINISH MISSION" option every 10 waves
    if (nextWave % 10 === 0 && !isForcedBoss) {
      options.push({
        id: 'node_finish',
        type: 'finish',
        name: 'FINISH MISSION',
        description: 'Complete your run and return to base with your current rewards.',
        icon: '🏆',
        votes: 0,
        locked: false
      });
    }
  }
  
  gs.navigationOptions = options;
  
  if (room.broadcastToRoom) {
    room.broadcastToRoom({
      type: 'navigation_options',
      options: options,
      votes: {}
    });
    room.broadcastToRoom({
      type: 'announcement',
      text: 'MISSION COMPLETE',
      sub: 'Select next jump destination'
    });
  }
}

function handleVoteNode(room, playerId, nodeId) {
  const gs = room.gameState;
  if (gs.currentPhase !== 'NAVIGATION') return;

  // Clear previous votes
  for (const nid in gs.nodeVotes) {
    gs.nodeVotes[nid] = (gs.nodeVotes[nid] || []).filter(id => id !== playerId);
  }

  // Add new vote
  if (!gs.nodeVotes[nodeId]) gs.nodeVotes[nodeId] = [];
  gs.nodeVotes[nodeId].push(playerId);

  // Sync vote counts in options
  gs.navigationOptions.forEach(opt => {
    opt.votes = gs.nodeVotes[opt.id]?.length || 0;
  });

  if (room.broadcastToRoom) {
    room.broadcastToRoom({
      type: 'navigation_options',
      options: gs.navigationOptions,
      votes: gs.nodeVotes
    });
  }

  checkNavigationVotes(room);
}

function checkNavigationVotes(room) {
  const gs = room.gameState;
  const totalPlayers = room.players.size;
  if (totalPlayers === 0) return;

  let winner = null;
  let maxVotes = 0;
  let totalVotes = 0;

  gs.navigationOptions.forEach(opt => {
    const votes = gs.nodeVotes[opt.id]?.length || 0;
    totalVotes += votes;
    if (votes > maxVotes) {
      maxVotes = votes;
      winner = opt;
    }
  });

  if (!winner) return;

  const majority = Math.floor(totalPlayers / 2) + 1;
  const allVoted = totalVotes >= totalPlayers;

  if (maxVotes >= majority || allVoted) {
    selectNode(room, winner.type);
  }
}

function selectNode(room, nodeType) {
  const gs = room.gameState;
  
  if (gs.isJumping) return; // Prevent multiple triggers
  gs.isJumping = true;

  // 5-second countdown before jump
  let countdown = 5;
  const interval = setInterval(() => {
    if (room.broadcastToRoom) {
      room.broadcastToRoom({ 
        type: 'announcement', 
        text: `WARP IN ${countdown}...`, 
        sub: `Preparing jump to ${nodeType.toUpperCase()}`
      });
    }
    countdown--;
    if (countdown < 0) {
      clearInterval(interval);
      finalizeNodeSelection(room, nodeType);
    }
  }, 1000);
}

function finalizeNodeSelection(room, nodeType) {
  const gs = room.gameState;
  gs.isJumping = false;
  
  // Trigger Jump Sequence (Visual only)
  gs.jumpTimer = 120; // 2 seconds at 60 FPS
  if (room.broadcastToRoom) {
      room.broadcastToRoom({ type: 'nav_transition', nodeType: nodeType });
  }

  const validNodes = ['defense', 'escort', 'salvage', 'merchant', 'pvp', 'boss', 'finish'];
  if (!validNodes.includes(nodeType)) {
    console.error(`[NAV] Invalid node selection: ${nodeType}. Defaulting to defense.`);
    nodeType = 'defense';
  }

  gs.encounterType = nodeType;
  console.log(`[NAV] Transitioning to: ${nodeType}`);
  
  if (nodeType === 'finish') {
    gameOver(room, true);
    return;
  }
  
  if (nodeType === 'merchant') {
    gs.merchantVisited = true;
  }
  
  // Clear merchant ready status
  room.players.forEach(p => p.merchantReady = false);
  
  triggerUpgradePhase(room, false);
}

function triggerUpgradePhase(room, isMidWave) {
  const gs = room.gameState;
  gs.currentPhase = 'UPGRADE';
  gs.waitingForUpgrade = true;
  gs.isMidWaveUpgrade = isMidWave;
  gs.upgradeTimer = 0;
  
  // Only clear the map when it's a full wave-end upgrade (NOT a mid-wave level-up)
  // Clearing on level-up removes enemies the players were fighting, reducing fun and XP opportunities.
  if (!isMidWave) {
    gs.enemies = [];
    gs.asteroids = [];
    gs.projectiles = [];
    gs.pickups = [];
  }
  
  room.players.forEach((player, playerId) => {
    player.upgradeReady = false;
    const playerUpgrades = gs.playerUpgrades[playerId] || {};
    const upgradeOptions = generateUpgradeOptions(playerUpgrades, player.pinnedIds);
    player.pendingUpgrades = upgradeOptions;
    
    player.ws.send(JSON.stringify({
      type: 'upgrade',
      gold: player.gold,
      levels: playerUpgrades,
      options: upgradeOptions,
      playerId: playerId,
      pinnedIds: player.pinnedIds
    }));
  });
  
  if (room.broadcastToRoom) {
    room.broadcastToRoom({
      type: 'announcement',
      text: isMidWave ? 'LEVEL UP!' : 'PREPARE FOR JUMP',
      sub: isMidWave ? 'New power available!' : 'Spend your GOLD before we warp!'
    });
    room.broadcastToRoom({
      type: 'upgrade_timer_start',
      maxTime: UPGRADE_MAX_TIME
    });
  }
}

function startNextWave(room) {
  const gs = room.gameState;
  gs.waitingForUpgrade = false;
  gs.currentPhase = 'COMBAT';
  
  const skippedPlayers = [];
  room.players.forEach((player) => {
    if (!player.upgradeReady) {
      player.upgradeReady = true;
      skippedPlayers.push(player.name || `Player ${player.id.slice(-4)}`);
    }
  });

  if (skippedPlayers.length > 0 && room.broadcastToRoom) {
    room.broadcastToRoom({
      type: 'announcement',
      text: 'UPGRADE PHASE ENDED',
      sub: `${skippedPlayers.join(', ')} missed their upgrade window!`
    });
  }
  
  if (!gs.isMidWaveUpgrade) {
    gs.wave++;
    gs.waveTimer = 0;
    
    // Reset mothership to center for the new jump destination
    if (gs.mothership) {
      gs.mothership.x = GAME_WIDTH / 2;
      gs.mothership.y = GAME_HEIGHT / 2;
    }
    
    startSelectedNode(room, gs.encounterType);
  }
  
  gs.isMidWaveUpgrade = false;
}

function startSelectedNode(room, nodeType) {
  const gs = room.gameState;
  gs.currentPhase = 'COMBAT'; // Ensure we are in combat phase
  gs.waveTimer = 0; // RESET TIMER FOR NEW WAVE
  gs.spawnTimer = 0;
  gs.encounterType = nodeType;
  
  const defaultDuration = WAVE_DURATIONS[nodeType] || 1800;
  const customDuration = room.settings && room.settings.waveDuration ? room.settings.waveDuration * 30 : defaultDuration;
  // If it's a boss, duration doesn't matter (ends on kill), but for others use the custom one.
  gs.waveDuration = (nodeType === 'defense' || nodeType === 'escort' || nodeType === 'salvage') ? customDuration : defaultDuration;
  
  gs.salvageCollected = 0;
  gs.merchants = [];
  gs.pickups = [];
  
  if (nodeType === 'escort') {
    gs.mothership.x = GAME_WIDTH * 0.15;
    gs.mothership.y = GAME_HEIGHT / 2;
    gs.targetX = GAME_WIDTH * 0.85;
    gs.targetY = GAME_HEIGHT / 2;
  } else {
    gs.mothership.x = GAME_WIDTH / 2;
    gs.mothership.y = GAME_HEIGHT / 2;
  }
  
    if (nodeType === 'merchant') {
    gs.merchantVisited = true;
    gs.merchantVisitCount = (gs.merchantVisitCount || 0) + 1;
    const costMultiplier = 1 + (gs.merchantVisitCount - 1) * 0.5; // +50% cost each subsequent visit
    
    // removed require('./entityFactory') from here
    // Pool of powerful upgrades with scaling costs
    const upgradesPool = [
      { id: 'titanium_hull', name: 'Titanium Hull', desc: '+1500 Mothership Max Hull. Stacks infinitely.', cost: Math.floor(400 * costMultiplier) },
      { id: 'orbital_strike', name: 'Orbital Strike', desc: 'Mothership fires massive orbital blasts. Stacks reduce cooldown.', cost: Math.floor(600 * costMultiplier) },
      { id: 'hyper_drives', name: 'Hyper Drives', desc: 'Boosts Move Speed for Drones, Mothership, and YOU. Stacks infinitely.', cost: Math.floor(500 * costMultiplier) },
      { id: 'homing_missiles', name: 'Tracking Protocol', desc: 'Projectiles track targets. If you already have tracking, greatly improves cornering and re-tracking. Stacks infinitely.', cost: Math.floor(450 * costMultiplier) },
      { id: 'quantum_shield', name: 'Quantum Shield', desc: '+1000 Shield to Mothership. Stacks infinitely.', cost: Math.floor(550 * costMultiplier) },
      { id: 'double_projectiles', name: 'Twin Cannons', desc: 'x2 Projectiles per shot for YOU. Stacks infinitely.', cost: Math.floor(400 * costMultiplier) },
      { id: 'double_damage', name: 'Dark Matter Core', desc: 'x2 Damage for YOU. Stacks infinitely.', cost: Math.floor(500 * costMultiplier) },
      { id: 'rate_of_fire', name: 'Overclocked Relays', desc: '+50% Fire Rate for YOU. Stacks infinitely.', cost: Math.floor(350 * costMultiplier) },
      { id: 'chain_lightning', name: 'Tesla Modulator', desc: 'Your weapons arc chain lightning on hit. Stacks infinitely.', cost: Math.floor(600 * costMultiplier) },
      { id: 'shrapnel_burst', name: 'Shrapnel Burst', desc: 'Your projectiles explode into shrapnel on hit. Stacks infinitely.', cost: Math.floor(500 * costMultiplier) },
      { id: 'cursed_relic', name: 'Cursed Relic', desc: 'x5 Damage, +5 Projectiles, but Halves your Fire Rate. Stacks infinitely.', cost: Math.floor(1500 * costMultiplier) },
      { id: 'laser_weapon', name: 'Plasma Laser', desc: 'Converts weapon to Laser. Stacks increase range and collision width.', cost: Math.floor(600 * costMultiplier) },
      { id: 'drone_overclock', name: 'Drone Overclock', desc: 'Significantly increases Drone & Mothership speed, but not yours.', cost: Math.floor(300 * costMultiplier) }
    ];
    // Shuffle and take first 5
    const shuffled = upgradesPool.sort(() => Math.random() - 0.5);
    const positions = [
      { x: GAME_WIDTH * 0.2, y: GAME_HEIGHT * 0.3 },
      { x: GAME_WIDTH * 0.5, y: GAME_HEIGHT * 0.2 },
      { x: GAME_WIDTH * 0.8, y: GAME_HEIGHT * 0.3 },
      { x: GAME_WIDTH * 0.35, y: GAME_HEIGHT * 0.6 },
      { x: GAME_WIDTH * 0.65, y: GAME_HEIGHT * 0.6 }
    ];
    for (let i = 0; i < 5; i++) {
      const merch = spawnMerchant(positions[i].x, positions[i].y, shuffled[i]);
      gs.merchants.push(merch);
    }
    gs.waveDuration = 1800; // 30 seconds merchant phase
  } else if (nodeType === 'pvp') {
    gs.waveDuration = 3600; // 60 seconds
    gs.pvpScores = gs.pvpScores || {};
    room.players.forEach((p, id) => {
      gs.pvpScores[id] = gs.pvpScores[id] || 0;
      p.maxHull = Math.max(p.maxHull || 100, 300);
      p.hull = p.maxHull;
    });
  } else if (nodeType !== 'salvage') {
    // removed require('./entityFactory') from here
    const playerFactor = 1 + (Math.max(1, room.players.size) - 1) * 0.25;
    const isBossWave = (gs.wave === 10 || gs.wave === 30 || gs.wave === 50) || (gs.wave > 50 && gs.wave % 10 === 0);
    
    if (isBossWave || nodeType === 'boss') {
      // Spawn Boss
      const boss = spawnEnemy(room);
      boss.radius = 120 + (gs.wave >= 50 ? 30 : 0); // Bigger at extreme
      
      let baseHealth = 2500 * (gs.wave / 10);
      if (gs.wave === 10) baseHealth = 3500; // Specific reduction for Alpha
      else if (gs.wave >= 30) baseHealth *= 2; // Hard
      else if (gs.wave >= 50) baseHealth *= 3; // Extreme
      if (gs.wave > 50) baseHealth *= Math.pow(1.5, Math.floor((gs.wave - 50) / 10)); 
      
      boss.maxHull = baseHealth * playerFactor; // Scale with player count too
      boss.hull = boss.maxHull;
      boss.isBoss = true;
      boss.aiType = gs.wave >= 50 ? 'boss_extreme' : 'boss_tactical'; // Extreme AI spawns drones
      boss.patrolAxis = 'y';
      boss.patrolDir = 1;
      
      // Force position inside bounds to prevent sticking
      if (boss.patrolAxis === 'x') {
        boss.x = 800;
        boss.y = 150;
      } else {
        boss.x = 1450;
        boss.y = 450;
      }

      boss.fireCooldown = 0;
      boss.weaponPhase = 0;
      boss.phaseTimer = 0;
      gs.enemies.push(boss);
      
      // Clear any remaining minions
      gs.enemies = gs.enemies.filter(e => e.isBoss);
    } else {
      const initialEnemies = 5 + Math.floor(gs.wave / 1.5);
      for (let i = 0; i < initialEnemies; i++) {
        gs.enemies.push(spawnEnemy(room));
      }
    }
  }

  if (room.broadcastToRoom) {
    room.broadcastToRoom({
      type: 'announcement',
      text: `JUMP COMPLETE: ${nodeType.toUpperCase()}`,
      sub: `Entering Node ${gs.wave}`,
      wave: gs.wave,
      nodeType: nodeType
    });
  }
}

function gameOver(room, victory) {
  room.gameState.gameOver = true;
  const gs = room.gameState;
  
  if (room.broadcastToRoom) {
    let totalKills = 0;
    let totalGold = 0;
    const playerNames = [];
    const pveStats = [];
    
    // Combine active player stats with historical stats for departed players
    const combinedStats = [];
    
    // Process active players
    room.players.forEach((p, id) => {
      totalGold += p.gold;
      totalKills += (p.stats?.kills || 0);
      playerNames.push(p.name || 'Pilot');
      combinedStats.push({
        id: id,
        name: p.name || 'Pilot',
        kills: p.stats?.kills || 0,
        damage: Math.floor(p.stats?.damageDealt || 0),
        gold: p.gold,
        color: p.color,
        isPvp: false
      });
    });

    // Add historical stats for players who left
    if (gs.historicalStats) {
      Object.entries(gs.historicalStats).forEach(([id, stats]) => {
        // Don't duplicate if they re-joined
        if (!room.players.has(id)) {
          totalKills += stats.kills;
          totalGold += stats.gold;
          combinedStats.push({
            id: id,
            name: stats.name + ' (Left)',
            kills: stats.kills,
            damage: stats.damage,
            gold: stats.gold,
            color: stats.color,
            isPvp: false,
            departed: true
          });
        }
      });
    }
    
    const timeElapsed = Math.floor((Date.now() - (room.createdAt || Date.now())) / 1000);
    
    room.broadcastToRoom({
      type: 'gameover',
      title: victory ? 'MISSION COMPLETE' : 'MISSION FAILED',
      stats: `Survived ${gs.wave} nodes • ${totalGold} GOLD earned`,
      pveStats: combinedStats,
      pvpScores: gs.pvpScores || null
    });
    
    // Record to global leaderboard
    if (typeof global.addLeaderboardEntry === 'function') {
      const isDevRun = Array.from(room.players.values()).some(p => p.isDev);
      global.addLeaderboardEntry({
        names: (isDevRun ? '[DEV] ' : '') + playerNames.join(' & '),
        playerCount: room.players.size,
        isCoop: !room.isSinglePlayer && room.players.size > 1,
        waves: gs.wave,
        kills: totalKills,
        timeSeconds: timeElapsed,
        victory,
        isDev: isDevRun,
        timestamp: Date.now()
      });
    }
  }
}

function restartGame(room) {
  const { createGameState } = require('./entityFactory');
  room.gameState = createGameState();
  room.gameState.gameStarted = true;
  room.gameState.currentPhase = 'COMBAT';
  
  if (room.broadcastToRoom) {
    room.broadcastToRoom({
      type: 'announcement',
      text: 'MISSION RESTARTED',
      sub: 'Protect the Mothership'
    });
  }
}

function triggerEndgameVoting(room) {
  const gs = room.gameState;
  gs.currentPhase = 'NAVIGATION';
  gs.navigationPhase = true;
  gs.nodeVotes = {};
  
  gs.navigationOptions = [
    {
      id: 'node_finish',
      type: 'finish',
      name: 'FINISH MISSION',
      description: 'Return to base with honors.',
      icon: '🏆',
      votes: 0,
      locked: false
    },
    {
      id: 'node_pvp',
      type: 'pvp',
      name: 'PVP SHOWDOWN',
      description: 'Settle the score. Last man standing.',
      icon: '⚔️',
      votes: 0,
      locked: false
    },
    {
      id: 'node_continue',
      type: 'defense', // Uses defense as the continue node
      name: 'CONTINUE RUN',
      description: 'Push further into the unknown.',
      icon: '🚀',
      votes: 0,
      locked: false
    }
  ];

  if (room.broadcastToRoom) {
    room.broadcastToRoom({
      type: 'navigation_options',
      options: gs.navigationOptions,
      votes: {}
    });
    room.broadcastToRoom({
      type: 'announcement',
      text: 'BOSS DEFEATED',
      sub: 'What is your next move?'
    });
  }
}



module.exports = {
  updateWave,
  endWave,
  startNextWave,
  handleVoteNode,
  gameOver,
  restartGame,
  triggerSuperUpgrade,
  startSelectedNode,
  triggerNavigation,
  triggerUpgradePhase,
  selectNode,
  triggerEndgameVoting
};
