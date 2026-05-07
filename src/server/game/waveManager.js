const { generateUpgradeOptions } = require('./upgradeSystem');
const { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  WAVE_DURATIONS,
  UPGRADE_MAX_TIME
} = require('../config/constants');

function updateWave(room) {
  const gs = room.gameState;
  if (!gs || gs.gameOver || !gs.gameStarted) return;

  // Handle phase-specific logic
  if (gs.currentPhase !== 'COMBAT') {
    if (gs.currentPhase === 'UPGRADE') {
      gs.upgradeTimer++;
      const timeLeft = Math.max(0, Math.ceil((UPGRADE_MAX_TIME - gs.upgradeTimer) / 30));
      if (room.broadcastToRoom) {
        room.broadcastToRoom({
          type: 'upgrade_timer_update',
          timeLeft: timeLeft
        });
      }      
      // Re-sync upgrade menu every 3 seconds for players who haven't picked
      if (gs.upgradeTimer % 180 === 0) {
        room.players.forEach((player, playerId) => {
          if (!player.upgradeReady && player.pendingUpgrades) {
            player.ws.send(JSON.stringify({
              type: 'upgrade',
              gold: player.gold,
              levels: gs.playerUpgrades[playerId] || {},
              options: player.pendingUpgrades,
              playerId: playerId,
              pinnedId: player.pinnedUpgradeId
            }));
          }
        });
      }
    }
    return;
  }
  
  // COMBAT Phase
  
  // Process pending level ups (queueing ensures we don't trigger multiple at once or conflict with wave end)
  if (gs.pendingLevelUps && gs.pendingLevelUps > 0) {
    gs.pendingLevelUps--;
    endWave(room, true);
    return;
  }
  
  gs.waveTimer++;
  
  // Enemy Spawning Logic
  if (gs.encounterType !== 'salvage' && gs.encounterType !== 'merchant' && gs.encounterType !== 'pvp') {
    gs.spawnTimer++;
    const spawnRate = Math.max(20, 70 - gs.wave * 2); // Get faster as waves progress
    if (gs.spawnTimer >= spawnRate) {
      gs.spawnTimer = 0;
      const hasBoss = gs.enemies.some(e => e.isBoss);
      if (!hasBoss) {
        const { spawnEnemy } = require('./entityFactory');
        gs.enemies.push(spawnEnemy(room));
      }
    }
  } else if (gs.encounterType === 'salvage') {
    gs.spawnTimer++;
    if (gs.spawnTimer >= 40) {
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
    const asteroidRate = Math.max(120, 400 - gs.wave * 15);
    if (gs.waveTimer % asteroidRate === 0) {
      const { spawnAsteroid } = require('./entityFactory');
      gs.asteroids.push(spawnAsteroid(room));
    }
  }
  
  // Update wave display text
  if (gs.encounterNames) {
    gs.waveDisplayName = `WAVE ${gs.wave}`;
    gs.encounterDisplayName = gs.encounterNames[gs.encounterType] || 'MISSION';
  }
  
  // Check mission completion
  if (gs.waveTimer >= gs.waveDuration) {
    if (gs.encounterType !== 'boss') {
      endWave(room, false);
    }
  }
  
  // Check game over
  if (gs.mothership.hull <= 0) {
    gameOver(room, false);
  }
  
  // Final Boss victory condition (Wave 15)
  if (gs.encounterType === 'boss' && gs.wave >= 15 && gs.enemies.length === 0 && gs.waveTimer > 300) {
    if (!room.isSinglePlayer && room.players.size > 1 && !gs.offeredPvp) {
      gs.offeredPvp = true;
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
          text: 'MISSION ACCOMPLISHED',
          sub: 'What is your next move?'
        });
      }
    } else if (!gs.offeredPvp) {
      gameOver(room, true);
    }
  }
}

function endWave(room, isMidWave = false) {
  const gs = room.gameState;
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
  gs.currentPhase = 'NAVIGATION';
  gs.navigationPhase = true;
  gs.nodeVotes = {}; 
  
  const options = [];
  const nextWave = gs.wave + 1;
  const isBossComing = (nextWave === 5 || nextWave === 10 || nextWave === 15);
  
  if (isBossComing) {
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
    if (Math.random() < 0.25) nodeTypes.push('pvp');
    
    const available = [...nodeTypes];
    for (let i = 0; i < 3; i++) {
      const idx = Math.floor(Math.random() * available.length);
      const type = available.splice(idx, 1)[0] || 'defense';
      
      let isLocked = false;
      let lockReason = '';
      if (type === 'merchant' && gs.merchantVisited) {
        isLocked = true;
        lockReason = 'ALREADY VISITED MERCHANT';
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
    if (!gs.visitedNodes) gs.visitedNodes = [];
    gs.visitedNodes.push(winner.type);
    gs.nodesVisited++;
    selectNode(room, winner.type);
  }
}

function selectNode(room, nodeType) {
  const gs = room.gameState;
  gs.navigationPhase = false;
  gs.navigationOptions = null;
  
  if (nodeType === 'finish') {
    gameOver(room, true);
    return;
  }
  
  const validNodes = ['defense', 'escort', 'salvage', 'merchant', 'pvp', 'boss'];
  if (!validNodes.includes(nodeType)) {
    console.error(`[NAV] Invalid node selection: ${nodeType}. Defaulting to defense.`);
    nodeType = 'defense';
  }

  gs.encounterType = nodeType;
  console.log(`[NAV] Transitioning to: ${nodeType}`);
  
  if (nodeType === 'merchant') {
    gs.merchantVisited = true;
  }
  
  if (room.broadcastToRoom) {
    room.broadcastToRoom({ type: 'warp_start' });
  }

  // Clear merchant ready status
  room.players.forEach(p => p.merchantReady = false);
  
  setTimeout(() => {
    triggerUpgradePhase(room, false);
  }, 1000);
}

function triggerUpgradePhase(room, isMidWave) {
  const gs = room.gameState;
  gs.currentPhase = 'UPGRADE';
  gs.waitingForUpgrade = true;
  gs.isMidWaveUpgrade = isMidWave;
  gs.upgradeTimer = 0;
  
  room.players.forEach((player, playerId) => {
    player.upgradeReady = false;
    const playerUpgrades = gs.playerUpgrades[playerId] || {};
    const upgradeOptions = generateUpgradeOptions(playerUpgrades, player.pinnedUpgradeId);
    player.pendingUpgrades = upgradeOptions;
    
    player.ws.send(JSON.stringify({
      type: 'upgrade',
      gold: player.gold,
      levels: playerUpgrades,
      options: upgradeOptions,
      playerId: playerId,
      pinnedId: player.pinnedUpgradeId
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
  
  if (!gs.isMidWaveUpgrade) {
    gs.wave++;
    gs.waveTimer = 0;
    startSelectedNode(room, gs.encounterType);
  }
  
  gs.isMidWaveUpgrade = false;
}

function startSelectedNode(room, nodeType) {
  const gs = room.gameState;
  gs.encounterType = nodeType;
  gs.spawnTimer = 0;
  
  const defaultDuration = WAVE_DURATIONS[nodeType] || 1800;
  const customDuration = room.settings && room.settings.waveDuration ? room.settings.waveDuration * 30 : defaultDuration;
  // If it's a boss, duration doesn't matter (ends on kill), but for others use the custom one.
  gs.waveDuration = (nodeType === 'defense' || nodeType === 'escort' || nodeType === 'salvage') ? customDuration : defaultDuration;
  
  gs.salvageCollected = 0;
  gs.merchants = [];
  
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
    const { spawnMerchant } = require('./entityFactory');
    // Pool of powerful upgrades
    const upgradesPool = [
      { id: 'titanium_hull', name: 'Titanium Hull', desc: '+1500 Mothership Max Hull', cost: 400 },
      { id: 'orbital_strike', name: 'Orbital Strike', desc: 'Mothership fires massive orbital blasts', cost: 600 },
      { id: 'hyper_drives', name: 'Hyper Drives', desc: '300% Move Speed for the entire fleet', cost: 500 },
      { id: 'homing_missiles', name: 'Homing Missiles', desc: 'All projectiles track enemies with high agility', cost: 450 },
      { id: 'quantum_shield', name: 'Quantum Shield', desc: '+1000 shield to mothership', cost: 550 },
      { id: 'double_projectiles', name: 'Twin Cannons', desc: 'x2 Projectiles per shot for you', cost: 400 },
      { id: 'double_damage', name: 'Dark Matter Core', desc: 'x2 Damage for you', cost: 500 },
      { id: 'rate_of_fire', name: 'Overclocked Relays', desc: '+50% Fire Rate for you', cost: 350 },
      { id: 'chain_lightning', name: 'Tesla Modulator', desc: 'Weapons arc chain lightning on hit', cost: 600 }
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
    const { spawnEnemy } = require('./entityFactory');
    const isBossWave = gs.wave === 5 || gs.wave === 10 || gs.wave === 15;
    
    if (isBossWave) {
      // Spawn Boss
      const boss = spawnEnemy(room);
      boss.radius = 120; // Massive boss
      boss.maxHull = 3000 * (gs.wave / 5); // Reduced health
      boss.hull = boss.maxHull;
      boss.isBoss = true;
      boss.aiType = 'boss_tactical'; // New AI type
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
      const initialEnemies = 3 + Math.floor(gs.wave / 2);
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
    
    room.players.forEach((p, id) => {
      totalGold += p.gold;
      totalKills += (p.stats?.kills || 0);
      playerNames.push(p.name || 'Pilot');
      pveStats.push({
        id: id,
        name: p.name || 'Pilot',
        kills: p.stats?.kills || 0,
        damage: Math.floor(p.stats?.damageDealt || 0)
      });
    });
    
    const timeElapsed = Math.floor((Date.now() - (room.startTime || Date.now())) / 1000);
    
    room.broadcastToRoom({
      type: 'gameover',
      title: victory ? 'MISSION COMPLETE' : 'MISSION FAILED',
      stats: `Survived ${gs.wave} nodes • ${totalGold} GOLD earned`,
      pveStats: pveStats,
      pvpScores: gs.pvpScores || null
    });
    
    // Record to global leaderboard
    if (typeof global.addLeaderboardEntry === 'function') {
      global.addLeaderboardEntry({
        names: playerNames.join(' & '),
        playerCount: room.players.size,
        isCoop: !room.isSinglePlayer && room.players.size > 1,
        waves: gs.wave,
        kills: totalKills,
        timeSeconds: timeElapsed,
        victory,
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

function triggerSuperUpgrade(room) {
  const gs = room.gameState;
  gs.currentPhase = 'SUPER_UPGRADE';
  
  const superOptions = [
    { id: 'super_fire_rate', name: 'OVERCLOCK CORE', desc: 'Double your current Fire Rate and +100% Damage.', cost: 0 },
    { id: 'super_homing', name: 'OMEGA TARGETING', desc: 'Max Homing and projectiles explode on impact.', cost: 0 },
    { id: 'super_drones', name: 'DRONE SWARM', desc: 'Double your current Drone count and triple their fire rate.', cost: 0 },
    { id: 'super_weapons', name: 'TITAN BATTERY', desc: 'Triple projectiles per shot and +200% Bullet Size.', cost: 0 }
  ];

  // Give each player 2 random super options
  room.players.forEach(p => {
    const shuffled = [...superOptions].sort(() => Math.random() - 0.5);
    p.pendingSuperUpgrades = shuffled.slice(0, 2);
    
    p.ws.send(JSON.stringify({
      type: 'super_upgrade',
      options: p.pendingSuperUpgrades
    }));
  });
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
  selectNode
};
