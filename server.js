/**
 * Aegis Command - Authoritative Multiplayer Server with Room Support
 * 
 * Architecture:
 * - Room-based multiplayer: Players create/join rooms with unique codes
 * - Optional password protection for private rooms
 * - Shareable room links (e.g., /?room=ABCD)
 * - 60 ticks/second simulation per room
 * - 60Hz state broadcast to room members
 * - Rooms auto-clean when empty
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

// Import modular components
const { TICK_RATE, BROADCAST_RATE, ROOM_INACTIVITY_TIMEOUT } = require('./src/server/config/constants');
const RoomManager = require('./src/server/room/roomManager');
const setupWebSocketHandlers = require('./src/server/networking/websocketHandlers');
const { broadcastState } = require('./src/server/networking/stateBroadcast');
const {
  updatePlayer,
  updateMothership,
  updateEnemies,
  updateAsteroids,
  updateProjectiles,
  updateDrones,
  updatePickups
} = require('./src/server/game/gameLogic');
const { updateWave } = require('./src/server/game/waveManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize room manager
const roomManager = new RoomManager();

// Global in-memory leaderboard (max 100 entries, FIFO)
const leaderboard = [];
global.addLeaderboardEntry = (entry) => {
  leaderboard.push(entry);
  if (leaderboard.length > 100) leaderboard.shift();
  if (global.azureDbActive) {
    // Don't await here to avoid blocking the main game loop
    require('./src/server/db/azureDb').saveScore(entry);
  }
};
global.getRoomManager = () => roomManager;

console.log('[BOOT] Aegis Command Server starting...');

// Initialize Azure DB
const azureDb = require('./src/server/db/azureDb');
azureDb.initDB().then(async (success) => {
  if (success) {
    global.azureDbActive = true;
    const scores = await azureDb.getScores();
    if (scores && scores.length > 0) {
      leaderboard.push(...scores);
      leaderboard.sort((a,b) => b.waves - a.waves);
      if (leaderboard.length > 100) leaderboard.length = 100;
    }
  }
});

// Setup WebSocket handlers
setupWebSocketHandlers(wss, roomManager);

// Game loop - runs at 60 FPS for all rooms
function gameTick() {
  for (const room of roomManager.rooms.values()) {
    try {
      if (room.players.size === 0) continue;
      
      const gs = room.gameState;
      if (gs.isPaused) continue;
      
      if (!gs.gameOver && gs.currentPhase === 'COMBAT') {
        // Update all game entities safely to prevent a crash in one system from halting the entire game loop
        try { room.players.forEach(p => updatePlayer(p, room)); } catch(e) { console.error(`[CRASH] updatePlayer: ${e.message}`, e.stack); }
        try { updateMothership(room); } catch(e) { console.error(`[CRASH] updateMothership: ${e.message}`, e.stack); }
        try { updateEnemies(room); } catch(e) { console.error(`[CRASH] updateEnemies: ${e.message}`, e.stack); }
        try { updateAsteroids(room); } catch(e) { console.error(`[CRASH] updateAsteroids: ${e.message}`, e.stack); }
        try { updateProjectiles(room); } catch(e) { console.error(`[CRASH] updateProjectiles: ${e.message}`, e.stack); }
        try { updateDrones(room); } catch(e) { console.error(`[CRASH] updateDrones: ${e.message}`, e.stack); }
        try { updatePickups(room); } catch(e) { console.error(`[CRASH] updatePickups: ${e.message}`, e.stack); }
        
        // Pass room with broadcastToRoom method to waveManager
        try { updateWave(room); } catch(e) { console.error(`[CRASH] updateWave: ${e.message}`, e.stack); }
      } else if (gs.waitingForUpgrade || gs.currentPhase === 'NAVIGATION') {
        // Still call updateWave to handle timers and transitions
        try { updateWave(room); } catch(e) { console.error(`[CRASH] updateWave (non-combat): ${e.message}`, e.stack); }
      }
      
      // Clamp mothership hull to max
      if (gs.mothership) {
        gs.mothership.hull = Math.min(gs.mothership.maxHull, gs.mothership.hull);
      }
    } catch (err) {
      console.error(`Error in gameTick for room ${room.code}:`, err);
      if (err.stack) console.error(err.stack);
    }
  }
}

// State broadcast - runs at 60 FPS
function broadcastLoop() {
  try {
    broadcastState(roomManager);
  } catch (err) {
    console.error('Error in broadcastLoop:', err);
  }
}

// Cleanup inactive rooms
function cleanupLoop() {
  try {
    roomManager.cleanupInactiveRooms();
  } catch (err) {
    console.error('Error in cleanupLoop:', err);
  }
}

// Start game loops
setInterval(gameTick, TICK_RATE);
setInterval(broadcastLoop, BROADCAST_RATE);
setInterval(cleanupLoop, ROOM_INACTIVITY_TIMEOUT);

// HTTP routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/rooms', (req, res) => {
  res.json(roomManager.getRoomList());
});

// Live player stats
app.get('/api/stats', (req, res) => {
  let soloPlayers = 0;
  let coopPlayers = 0;
  let activeRooms = 0;
  for (const room of roomManager.rooms.values()) {
    if (room.players.size === 0) continue;
    activeRooms++;
    if (room.isSinglePlayer || room.players.size === 1) {
      soloPlayers += room.players.size;
    } else {
      coopPlayers += room.players.size;
    }
  }
  res.json({ soloPlayers, coopPlayers, totalPlayers: soloPlayers + coopPlayers, activeRooms });
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboard);
});

// Health check for deployment platforms
app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: roomManager.rooms.size });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[READY] Aegis Command v2.0-STABLE running on port ${PORT}`);
  console.log(`[INFO] Process ID: ${process.pid}`);
});
