// Game Constants
module.exports = {
  GAME_WIDTH: 1600,
  GAME_HEIGHT: 900,
  TICK_RATE: 1000 / 60, // 60 FPS physics simulation for high precision
  BROADCAST_RATE: 1000 / 30, // 30 FPS broadcast (Client will interpolate)
  ROOM_CODE_LENGTH: 4,
  MAX_PLAYERS_PER_ROOM: 8,
  ROOM_INACTIVITY_TIMEOUT: 10 * 60 * 1000, // 10 minutes
  
  // Player colors
  PLAYER_COLORS: ['#2ecc71', '#3498db', '#9b59b6', '#e67e22'],
  
  // Wave durations (in frames at 60 FPS)
  WAVE_DURATIONS: {
    defense: 3600,  // 60 seconds
    escort: 3000,   // 50 seconds
    salvage: 1800    // 30 seconds
  },
  
  // Upgrade timer
  UPGRADE_MAX_TIME: 60 * 60, // 60 seconds at 60 FPS
  
  // Spawn rates
  BASE_SPAWN_RATE: 40,
  MIN_SPAWN_RATE: 12,
  
  // Entity stats
  PLAYER: {
    RADIUS: 12,
    SPEED: 2.8,
    HULL: 100,
    FIRE_RATE: 20
  },
  
  MOTHERSHIP: {
    RADIUS: 45,
    SPEED: 0.3,
    HULL: 350
  },
  
  ENEMY: {
    FIGHTER_RADIUS: 16,
    ELITE_RADIUS: 14,
    BASE_SPEED: 1.0,
    MAX_SPEED: 4.5
  },
  
  ASTEROID: {
    RADIUS: 30,
    BASE_SPEED: 0.5,
    MAX_SPEED: 2.5
  },
  
  PROJECTILE: {
    SPEED: 15,
    LIFE: 240,
    RADIUS: 5
  },
  
  PICKUP: {
    RADIUS: 12,
    LIFE: 36000
  },
  
  DRONE: {
    RADIUS: 10,
    ORBIT_SPEED: 0.02,
    FIRE_RATE: 20,
    RANGE: 250
  }
};
