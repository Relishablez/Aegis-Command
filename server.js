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

// Setup WebSocket handlers
setupWebSocketHandlers(wss, roomManager);

// Game loop - runs at 60 FPS for all rooms
function gameTick() {
  try {
    for (const room of roomManager.rooms.values()) {
      if (room.players.size === 0) continue;
      
      const gs = room.gameState;
      if (!gs.gameOver && gs.currentPhase === 'COMBAT') {
        // Update all game entities
        room.players.forEach(p => updatePlayer(p, room));
        updateMothership(room);
        updateEnemies(room);
        updateAsteroids(room);
        updateProjectiles(room);
        updateDrones(room);
        updatePickups(room);
        
        // Pass room with broadcastToRoom method to waveManager
        updateWave(room);
      } else if (gs.waitingForUpgrade) {
        // Still call updateWave to handle upgrade timer
        updateWave(room);
      }
      
      // Clamp mothership hull to max
      gs.mothership.hull = Math.min(gs.mothership.maxHull, gs.mothership.hull);
    }
  } catch (err) {
    console.error('Error in gameTick:', err);
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

// Health check for deployment platforms
app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: roomManager.rooms.size });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Aegis Command server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to play`);
});
