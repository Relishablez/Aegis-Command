const { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  PLAYER, 
  MOTHERSHIP, 
  ENEMY, 
  ASTEROID, 
  PROJECTILE, 
  PICKUP, 
  DRONE,
  PLAYER_COLORS 
} = require('../config/constants');
const { getDifficulty } = require('../utils/helpers');

let nextEntityId = 1;

function spawnPlayer(id, playerIndex, mothership) {
  return {
    id,
    x: mothership.x,
    y: mothership.y,
    radius: PLAYER.RADIUS,
    speed: PLAYER.SPEED,
    angle: 0,
    weaponType: 'default',
    hull: PLAYER.HULL,
    maxHull: PLAYER.HULL,
    alive: true,
    respawnTimer: 0,
    fireRate: PLAYER.FIRE_RATE,
    fireCooldown: 0,
    multiShot: 1,
    shield: 0,
    shieldMax: 0,
    damage: 1,
    healing: 0,
    piercing: 0,
    spread: 0,
    homing: 0,
    explosive: 0,
    lifesteal: 0,
    bulletSize: 1,
    critChance: 0,
    pickupRange: 0,
    color: PLAYER_COLORS[playerIndex % PLAYER_COLORS.length],
    keys: { w: false, a: false, s: false, d: false },
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    ws: null,
    name: 'Pilot',
    upgradeReady: false,
    pendingUpgrades: null,
    pinnedUpgradeId: null,
    dashCooldown: 0,
    dashDuration: 0,
    gold: 100,
    powerups: {
      rapidFire: 0,
      invincible: 0,
      doubleGold: 0,
      turbo: 0,
      megaShot: 0
    },
    stats: {
      kills: 0,
      damageDealt: 0,
      timeAlive: 0,
      maxWave: 1
    },
    achievements: [], // IDs of unlocked achievements
    lives: 3,
    respawning: false
  };
}

function spawnEnemy(room) {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  switch (side) {
    case 0: x = Math.random() * GAME_WIDTH; y = -30; break;
    case 1: x = GAME_WIDTH + 30; y = Math.random() * GAME_HEIGHT; break;
    case 2: x = Math.random() * GAME_WIDTH; y = GAME_HEIGHT + 30; break;
    case 3: x = -30; y = Math.random() * GAME_HEIGHT; break;
  }
  
  const diff = getDifficulty(room.gameState.wave, room.settings?.difficulty);
  const isDiamond = Math.random() < 0.3;
  
  const playerScale = 1 + (Math.max(1, room.players.size) - 1) * 0.25; // +25% health per player
  const hostScale = room.settings?.damageMultiplier || 1.0;
  const totalScale = playerScale * hostScale;
  
  return {
    id: nextEntityId++,
    x, y,
    radius: isDiamond ? ENEMY.ELITE_RADIUS : ENEMY.FIGHTER_RADIUS,
    speed: diff.enemySpeed * (0.8 + Math.random() * 0.4),
    angle: 0,
    hull: diff.enemyHealth * totalScale * (isDiamond ? 2 : 1),
    maxHull: diff.enemyHealth * totalScale * (isDiamond ? 2 : 1),
    diamond: isDiamond,
    fireCooldown: 0
  };
}

function spawnAsteroid(room) {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  switch (side) {
    case 0: x = Math.random() * GAME_WIDTH; y = -40; break;
    case 1: x = GAME_WIDTH + 40; y = Math.random() * GAME_HEIGHT; break;
    case 2: x = Math.random() * GAME_WIDTH; y = GAME_HEIGHT + 40; break;
    case 3: x = -40; y = Math.random() * GAME_HEIGHT; break;
  }
  
  const playerScale = 1 + (Math.max(1, room.players.size) - 1) * 0.2;
  const diff = getDifficulty(room.gameState.wave, room.settings?.difficulty);
  const numVerts = 5 + Math.floor(Math.random() * 4);
  const verts = [];
  for (let i = 0; i < numVerts; i++) {
    const a = (i / numVerts) * Math.PI * 2;
    const r = 20 + Math.random() * 15;
    verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  
  return {
    id: nextEntityId++,
    x, y,
    radius: ASTEROID.RADIUS,
    verts,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.02,
    speed: diff.asteroidSpeed * (0.6 + Math.random() * 0.6),
    hull: diff.asteroidHealth * playerScale,
    maxHull: diff.asteroidHealth * playerScale
  };
}

function spawnProjectile(x, y, angle, friendly, speed = PROJECTILE.SPEED) {
  return {
    id: nextEntityId++,
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    friendly,
    life: PROJECTILE.LIFE,
    damage: 1,
    healing: 0,
    piercing: 0,
    homing: 0,
    explosive: 0,
    bulletSize: 1,
    critChance: 0,
    ownerId: null
  };
}

function spawnPickup(x, y, type = 'gold') {
  return {
    id: nextEntityId++,
    x, y,
    type,
    radius: PICKUP.RADIUS,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    life: PICKUP.LIFE
  };
}

function spawnDrone(mothership) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 80 + Math.random() * 40;
  return {
    id: nextEntityId++,
    x: mothership.x + Math.cos(angle) * dist,
    y: mothership.y + Math.sin(angle) * dist,
    radius: DRONE.RADIUS,
    angle,
    dist,
    orbitSpeed: DRONE.ORBIT_SPEED,
    fireCooldown: 0
  };
}

function spawnMerchant(x, y, upgrade) {
  const powerfulUpgrades = [
    { id: 'titanium_hull', name: 'Titanium Hull', desc: '+1500 Mothership Max Hull', cost: 400 },
    { id: 'orbital_strike', name: 'Orbital Strike', desc: 'Unlock active orbital strike', cost: 600 },
    { id: 'hyper_drives', name: 'Hyper Drives', desc: '+50% Ship Speed permanently (Stackable)', cost: 500 },
    { id: 'homing_missiles', name: 'Homing Missiles', desc: 'All projectiles track enemies with high agility', cost: 450 }
  ];

  // If an upgrade is supplied (for distinct merchants), use it; otherwise pick random
  const chosen = upgrade || powerfulUpgrades[Math.floor(Math.random() * powerfulUpgrades.length)];

  return {
    id: 'merch_' + Math.random().toString(36).substr(2, 9),
    x,
    y,
    radius: 40,
    upgrade: chosen
  };
}



function createGameState() {
  return {
    p: [],
    e: [],
    a: [],
    pr: [],
    c: [], // pickups
    d: [], // drones
    m: [], // merchants
    wave: 1,
    teamLevel: 1,
    teamXP: 0,
    teamXPNext: 100,
    w: { encounterType: 'defense', timer: 0 },
    s: {
      hull: 1000,
      maxHull: 1000,
      shield: 0,
      shieldMax: 0
    },
    // Server-only data
    players: new Map(), // playerId -> player object
    enemies: [],
    asteroids: [],
    projectiles: [],
    pickups: [],
    drones: [],
    merchants: [],
    mothership: {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT / 2,
      radius: 40,
      hull: MOTHERSHIP.HULL,
      maxHull: MOTHERSHIP.HULL,
      shield: 0,
      shieldMax: 0,
      shieldRegen: 0,
      autoTurret: 0,
      turretRange: 500,
      speed: MOTHERSHIP.SPEED,
      lives: 3 // Teams share lives? No, user said "players will then have 3 lives each"
    },
    xp: 0,
    xpMultiplier: 1,
    goldMultiplier: 1,
    dropRateBonus: 0,
    droneFireRateBonus: 0,
    droneDamageBonus: 0,
    encounterType: 'defense',
    encounterNames: {
      defense: 'DEFENSE WAVE',
      escort: 'ESCORT MISSION',
      salvage: 'SALVAGE FIELD',
      merchant: 'MERCHANT OUTPOST'
    },
    waveTimer: 0,
    waveDuration: 3600,
    purchasedMerchantUpgrades: [],
    spawnTimer: 0,
    upgradeTimer: 0,
    upgradeMaxTime: 20 * 60, // 20 seconds at 60 FPS
    playerUpgrades: {}, // playerId -> { upgradeId: level }
    gameOver: false,
    currentPhase: 'COMBAT', // 'COMBAT', 'UPGRADE', 'NAVIGATION'
    waitingForUpgrade: false,
    visitedNodes: [],
    nodeVotes: {},
    nodesVisited: 0,
    historicalStats: {}, // Store stats of players who left
    gameStarted: false
  };
}

module.exports = {
  createGameState,
  spawnPlayer,
  spawnEnemy,
  spawnAsteroid,
  spawnProjectile,
  spawnPickup,
  spawnDrone,
  spawnMerchant
};
