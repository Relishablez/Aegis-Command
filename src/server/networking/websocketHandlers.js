const UPGRADES = require('../config/upgrades');
const { generateUpgradeOptions } = require('../game/upgradeSystem');
const { verifyPassword } = require('../utils/helpers');

function setupWebSocketHandlers(wss, roomManager) {
  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    let currentRoom = null;
    let playerId = null;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);

        // Create Room
        if (msg.type === 'create_room') {
          const room = roomManager.createRoom(msg.password, msg.singlePlayer, msg.maxPlayers, msg.settings);

          // Sanitize and validate player name
          let sanitizedName = (msg.playerName || 'Host').trim().substring(0, 26);
          playerId = 'player_' + Math.random().toString(36).substr(2, 9);
          if (roomManager.addPlayerToRoom(room, playerId, ws, { name: sanitizedName })) {
            currentRoom = room;

            // Send room created success with player info
            ws.send(JSON.stringify({
              type: 'room_created',
              roomCode: room.code,
              playerId: playerId,
              isPrivate: room.isPrivate,
              isSinglePlayer: room.isSinglePlayer,
              shareableLink: `${req.headers.origin || ''}/?room=${room.code}`,
              players: [{
                id: playerId,
                name: sanitizedName,
                color: room.players.get(playerId).color,
                isDev: room.players.get(playerId).isDev || false
              }]
            }));

            // Set game status
            if (msg.singlePlayer) {
              room.gameState.gameStarted = true;
              room.gameRunning = true;
            } else {
              room.gameState.gameStarted = false; // Wait for host to start
              room.gameRunning = false;
            }
          }
          return;
        }

        // Join Room
        if (msg.type === 'join_room') {
          const roomCode = msg.roomCode?.toUpperCase();
          const room = roomManager.getRoom(roomCode);

          if (!room) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Room not found. Check the code and try again.'
            }));
            return;
          }

          if (room.players.size >= 4) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Room is full (max 4 players).'
            }));
            return;
          }

          if (!verifyPassword(msg.password, room.passwordHash)) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Incorrect password.'
            }));
            return;
          }

          // Generate player ID
          playerId = 'player_' + Math.random().toString(36).substr(2, 9);

          // Sanitize and validate player name
          let sanitizedName = (msg.playerName || `Player ${Math.floor(Math.random() * 1000)}`).trim().substring(0, 26);
          
          // Add player to room
          if (roomManager.addPlayerToRoom(room, playerId, ws, { name: sanitizedName })) {
            currentRoom = room;

            // Send join success
            ws.send(JSON.stringify({
              type: 'room_joined',
              roomCode: room.code,
              playerId: playerId,
              players: Array.from(room.players.values()).map(p => ({
                id: p.id,
                name: p.name || `Player ${p.id.slice(-4)}`,
                color: p.color,
                isDev: p.isDev || false
              }))
            }));

            // Broadcast to other players
            roomManager.broadcastToRoom(room, {
              type: 'player_joined',
              player: {
                id: playerId,
                name: sanitizedName,
                color: room.players.get(playerId).color,
                isDev: room.players.get(playerId).isDev || false
              }
            });

            // If game already started, send game_started to the new player
            if (room.gameState.gameStarted) {
              ws.send(JSON.stringify({ type: 'game_started' }));
            }
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: room.isSinglePlayer ? 'This is a private single-player session.' : 'Room is full or unavailable.'
            }));
          }
          return;
        }

        // Player input
        if (msg.type === 'input') {
          if (currentRoom && playerId) {
            const player = currentRoom.players.get(playerId);
            if (player) {
              if (msg.keys) player.keys = msg.keys;
              if (msg.mouseX !== undefined) player.mouseX = msg.mouseX;
              if (msg.mouseY !== undefined) player.mouseY = msg.mouseY;
              if (msg.mouseDown !== undefined) player.mouseDown = msg.mouseDown;
            }
          }
          return;
        }

        // Upgrade selection
        if (msg.type === 'upgrade_select') {
          if (currentRoom && playerId) {
            roomManager.handleUpgradeSelect(currentRoom, playerId, msg.upgradeId);
          }
          return;
        }

        // Reroll upgrades
        if (msg.type === 'reroll_upgrades') {
          if (currentRoom && playerId) {
            roomManager.handleRerollUpgrades(currentRoom, playerId);
          }
          return;
        }

        // Pin upgrade
        if (msg.type === 'pin_upgrade') {
          if (currentRoom && playerId) {
            roomManager.handlePinUpgrade(currentRoom, playerId, msg.upgradeId);
          }
          return;
        }

        // Skip upgrade
        if (msg.type === 'skip_upgrade') {
          if (currentRoom && playerId) {
            roomManager.handleSkipUpgrade(currentRoom, playerId);
          }
          return;
        }

        // Merchant Ready
        if (msg.type === 'merchant_ready') {
          if (currentRoom && playerId) {
            roomManager.handleMerchantReady(currentRoom, playerId);
          }
          return;
        }

        // Super Upgrade Selection
        if (msg.type === 'select_super_upgrade') {
          if (currentRoom && playerId) {
            roomManager.handleSelectSuperUpgrade(currentRoom, playerId, msg.upgradeId);
          }
          return;
        }

        // Vote for node
        if (msg.type === 'vote_node') {
          if (currentRoom && playerId) {
            roomManager.handleVoteNode(currentRoom, playerId, msg.nodeId);
          }
          return;
        }

        // Vote for endgame
        if (msg.type === 'vote_endgame') {
          if (currentRoom && playerId) {
            roomManager.handleVoteEndgame(currentRoom, playerId, msg.choice);
          }
          return;
        }

        // Restart game
        if (msg.type === 'restart_game') {
          if (currentRoom && currentRoom.players.get(playerId)) {
            roomManager.handleRestartGame(currentRoom);
          }
          return;
        }

        // Dev actions
        if (msg.type === 'dev_action') {
          if (currentRoom && playerId) {
            roomManager.handleDevAction(currentRoom, playerId, msg.action, msg.data);
          }
          return;
        }

        // Ping for latency check
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({
            type: 'pong',
            clientTime: msg.clientTime
          }));
          return;
        }

        // Start game (host only)
        if (msg.type === 'start_game') {
          if (currentRoom && playerId && currentRoom.ownerId === playerId) {
            const { startSelectedNode } = require('../game/waveManager');
            currentRoom.gameState.gameStarted = true;
            currentRoom.gameRunning = true;
            startSelectedNode(currentRoom, 'defense');
            roomManager.broadcastToRoom(currentRoom, {
              type: 'game_started'
            });
          }
          return;
        }

        // Buy merchant upgrade
        if (msg.type === 'buy_merchant') {
          if (currentRoom && playerId) {
            roomManager.handleBuyMerchant(currentRoom, playerId, msg.merchantId);
          }
          return;
        }

        // Get Compendium
        if (msg.type === 'get_compendium') {
          ws.send(JSON.stringify({
            type: 'compendium_data',
            upgrades: UPGRADES
          }));
          return;
        }

      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      if (currentRoom && playerId) {
        // Broadcast player left
        roomManager.broadcastToRoom(currentRoom, {
          type: 'player_left',
          playerId: playerId
        });

        // Remove player from room
        roomManager.removePlayerFromRoom(currentRoom, playerId);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
}


module.exports = setupWebSocketHandlers;
