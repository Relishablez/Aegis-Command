// Game Constants
module.exports = {
  GAME_WIDTH: 1600,
  GAME_HEIGHT: 900,
  TICK_RATE: 1000 / 30, // Slow down physics to 30 FPS for more stable network
  BROADCAST_RATE: 1000 / 30, // 30 FPS broadcast
  ROOM_CODE_LENGTH: 4,
  MAX_PLAYERS_PER_ROOM: 4,
  ROOM_INACTIVITY_TIMEOUT: 5 * 60 * 1000, // 5 minutes
  
  // Player colors
  PLAYER_COLORS: ['#2ecc71', '#3498db', '#9b59b6', '#e67e22'],
  
  // Wave durations (in frames at 30 FPS)
  WAVE_DURATIONS: {
    defense: 1800,  // 60 seconds
    escort: 1350,   // 45 seconds
    salvage: 900    // 30 seconds
  },
  
  // Upgrade timer
  UPGRADE_MAX_TIME: 20 * 30, // 20 seconds at 30 FPS
  
  // Spawn rates
  BASE_SPAWN_RATE: 35,
  MIN_SPAWN_RATE: 10,
  
  // Entity stats
  PLAYER: {
    RADIUS: 12,
    SPEED: 4,
    HULL: 100,
    FIRE_RATE: 8
  },
  
  MOTHERSHIP: {
    RADIUS: 45,
    SPEED: 0.4,
    HULL: 300
  },
  
  ENEMY: {
    FIGHTER_RADIUS: 16,
    ELITE_RADIUS: 14,
    BASE_SPEED: 1.5,
    MAX_SPEED: 4.0
  },
  
  ASTEROID: {
    RADIUS: 30,
    BASE_SPEED: 0.8,
    MAX_SPEED: 2.3
  },
  
  PROJECTILE: {
    SPEED: 12,
    LIFE: 120,
    RADIUS: 5
  },
  
  PICKUP: {
    RADIUS: 12,
    LIFE: 600
  },
  
  DRONE: {
    RADIUS: 10,
    ORBIT_SPEED: 0.02,
    FIRE_RATE: 15,
    RANGE: 250
  }
};
