const { 
  MAX_PLAYERS_PER_ROOM, 
  ROOM_INACTIVITY_TIMEOUT 
} = require('../config/constants');
const { 
  generateRoomCode, 
  hashPassword, 
  verifyPassword 
} = require('../utils/helpers');
const { createGameState } = require('../game/entityFactory');
const { applyUpgrade, generateUpgradeOptions, rerollUpgrades } = require('../game/upgradeSystem');
const { endWave, startNextWave, gameOver, restartGame, selectNode, handleVoteNode } = require('../game/waveManager');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> room object
  }

  createRoom(password = null, isSinglePlayer = false, maxPlayers = MAX_PLAYERS_PER_ROOM, settings = null) {
    const code = generateRoomCode();
    
    // Ensure uniqueness
    if (this.rooms.has(code)) {
      return this.createRoom(password, isSinglePlayer, maxPlayers, settings);
    }
    
    const roomSettings = settings || {
      waveDuration: 60,
      damageMultiplier: 1.0,
      goldMultiplier: 1.0
    };
    
    const room = {
      code,
      passwordHash: password ? hashPassword(password) : null,
      isPrivate: !!password,
      isSinglePlayer: !!isSinglePlayer,
      maxPlayers: Math.min(Math.max(1, maxPlayers), 8), // clamp between 1 and 8
      settings: roomSettings,
      players: new Map(),
      ownerId: null,
      gameState: createGameState(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      gameRunning: false,
      broadcastToRoom: (msg) => this.broadcastToRoom(room, msg)
    };
    
    this.rooms.set(code, room);
    console.log(`Room ${code} created${password ? ' (password protected)' : ''} [Max: ${room.maxPlayers}]`);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code.toUpperCase());
  }

  deleteRoom(code) {
    const room = this.rooms.get(code);
    if (room) {
      // Close all connections
      room.players.forEach((player, id) => {
        if (player.ws && player.ws.readyState === 1) { // WebSocket.OPEN
          player.ws.close();
        }
      });
      this.rooms.delete(code);
      console.log(`Room ${code} deleted`);
    }
  }

  cleanupInactiveRooms() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (room.players.size === 0 && now - room.lastActivity > ROOM_INACTIVITY_TIMEOUT) {
        this.deleteRoom(code);
      }
    }
  }

  addPlayerToRoom(room, playerId, ws, playerData = {}) {
    if (room.players.size >= room.maxPlayers) {
      return false;
    }
    
    if (room.isSinglePlayer && room.players.size > 0) {
      return false;
    }

    const { spawnPlayer } = require('../game/entityFactory');
    const playerIndex = room.players.size;
    const player = spawnPlayer(playerId, playerIndex, room.gameState.mothership);
    
    // Apply additional player data
    Object.assign(player, playerData);
    player.ws = ws;
    
    room.players.set(playerId, player);
    room.lastActivity = Date.now();
    
    // Set first player as owner
    if (!room.ownerId) {
      room.ownerId = playerId;
    }
    
    return true;
  }

  removePlayerFromRoom(room, playerId) {
    room.players.delete(playerId);
    room.lastActivity = Date.now();
    
    // If owner leaves, assign new owner
    if (room.ownerId === playerId && room.players.size > 0) {
      room.ownerId = room.players.keys().next().value;
    }
    
    // Delete room if empty
    if (room.players.size === 0) {
      setTimeout(() => {
        if (room.players.size === 0) {
          this.deleteRoom(room.code);
        }
      }, ROOM_INACTIVITY_TIMEOUT);
    }
  }

  getRoomList() {
    return Array.from(this.rooms.values()).map(room => ({
      code: room.code,
      playerCount: room.players.size,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      isPrivate: room.isPrivate,
      gameRunning: room.gameRunning,
      wave: room.gameState.wave
    }));
  }

  broadcastToRoom(room, msg) {
    const data = JSON.stringify(msg);
    room.players.forEach(p => {
      if (p.ws && p.ws.readyState === 1) { // WebSocket.OPEN
        p.ws.send(data);
      }
    });
  }

  handleUpgradeSelect(room, playerId, upgradeId) {
    if (applyUpgrade(room, playerId, upgradeId)) {
      const playerUpgrades = room.gameState.playerUpgrades[playerId] || {};
      const player = room.players.get(playerId);
      if (player) {
        player.ws.send(JSON.stringify({
          type: 'upgrade_applied',
          levels: playerUpgrades,
          gold: player.gold
        }));
        
        player.upgradeReady = true;
        player.pendingUpgrades = null; // Clear pending upgrades after purchase
        
        // Clear pin if this was the pinned upgrade
        if (player.pinnedUpgradeId === upgradeId) {
          player.pinnedUpgradeId = null;
        }
      }
      
      // Check if all players are ready
      const allReady = Array.from(room.players.values()).every(p => p.upgradeReady);
      if (allReady) {
        setTimeout(() => {
          startNextWave(room);
        }, 1000);
      }
    }
  }

  handlePinUpgrade(room, playerId, upgradeId) {
    const player = room.players.get(playerId);
    if (player) {
      if (player.pinnedUpgradeId === upgradeId) {
        player.pinnedUpgradeId = null;
      } else {
        player.pinnedUpgradeId = upgradeId;
      }
      player.ws.send(JSON.stringify({
        type: 'upgrade_pinned',
        pinnedId: player.pinnedUpgradeId
      }));
    }
  }

  handleSkipUpgrade(room, playerId) {
    const player = room.players.get(playerId);
    if (player) {
      player.upgradeReady = true;
      player.pendingUpgrades = null; // Clear pending upgrades after skip
      player.ws.send(JSON.stringify({
        type: 'upgrade_skipped'
      }));
      
      // Check if all players are ready
      const allReady = Array.from(room.players.values()).every(p => p.upgradeReady);
      if (allReady) {
        const { startNextWave } = require('../game/waveManager');
        setTimeout(() => {
          startNextWave(room);
        }, 1000);
      }
    }
  }

  handleRerollUpgrades(room, playerId) {
    const playerUpgrades = room.gameState.playerUpgrades[playerId] || {};
    const player = room.players.get(playerId);
    if (player && player.gold >= 100) {
      player.gold -= 100;
      const { generateUpgradeOptions } = require('../game/upgradeSystem');
      const newOptions = generateUpgradeOptions(playerUpgrades, player.pinnedUpgradeId);
      player.pendingUpgrades = newOptions; // Update stored options
      player.upgradeReady = false; // Unskip player
      player.ws.send(JSON.stringify({
        type: 'upgrade_rerolled',
        options: newOptions,
        gold: player.gold,
        levels: playerUpgrades,
        pinnedId: player.pinnedUpgradeId
      }));
    }
  }

  handleEndWave(room) {
    // Send upgrade menu to each player with their individual upgrades and options
    room.players.forEach((player, playerId) => {
      const playerUpgrades = room.gameState.playerUpgrades[playerId] || {};
      const upgradeOptions = generateUpgradeOptions(playerUpgrades, player.pinnedUpgradeId);
      
      player.ws.send(JSON.stringify({
        type: 'upgrade',
        gold: player.gold,
        levels: playerUpgrades,
        options: upgradeOptions,
        playerId: playerId,
        pinnedId: player.pinnedUpgradeId
      }));
    });
    
    // Broadcast timer start to all
    if (room.broadcastToRoom) {
      const { UPGRADE_MAX_TIME } = require('../game/waveManager');
      room.broadcastToRoom({
        type: 'upgrade_timer_start',
        maxTime: UPGRADE_MAX_TIME
      });
    }
  }

  handleGameOver(room, victory) {
    gameOver(room, victory);
  }

  handleVoteNode(room, playerId, nodeId) {
    handleVoteNode(room, playerId, nodeId);
  }

  handleRestartGame(room) {
    restartGame(room);
  }

  handleBuyMerchant(room, playerId, merchantId) {
    const gs = room.gameState;
    const player = room.players.get(playerId);
    if (!player) return;

    const merchantIndex = gs.merchants.findIndex(m => m.id === merchantId);
    if (merchantIndex === -1) return;
    
    const merchant = gs.merchants[merchantIndex];
    const upgrade = merchant.upgrade;
    
    if (player.gold >= upgrade.cost) {
      player.gold -= upgrade.cost;
      
      // Store persistent upgrade with buyer attribution
      if (!gs.purchasedMerchantUpgrades) gs.purchasedMerchantUpgrades = [];
      gs.purchasedMerchantUpgrades.push({ 
        id: upgrade.id, 
        buyerName: player.name || 'Anonymous' 
      });
      
      // Apply immediate effect if needed
      if (upgrade.id === 'titanium_hull') {
        gs.mothership.maxHull += 1500;
        gs.mothership.hull += 1500;
      }
      if (upgrade.id === 'orbital_strike') gs.orbitalStrikeUnlocked = true;
      if (upgrade.id === 'hyper_drives') {
        if (!gs.hyperDriveLevel) gs.hyperDriveLevel = 0;
        if (gs.hyperDriveLevel < 2) { // Cap at +100% (2.0 multiplier)
          gs.hyperDriveLevel++;
          gs.hyperDriveBoost = 1.0 + (gs.hyperDriveLevel * 0.5);
        } else {
          // Cap reached, refund gold + bonus
          player.gold += 3000;
          player.ws.send(JSON.stringify({
            type: 'announcement',
            text: 'SPEED CAP REACHED',
            sub: '+3000 GOLD COMPENSATED'
          }));
        }
      }
      if (upgrade.id === 'homing_missiles') gs.teamHomingBoost = true;
      
      if (gs.mothership.hull > gs.mothership.maxHull) gs.mothership.hull = gs.mothership.maxHull;
      
      // Remove merchant after purchase
      gs.merchants.splice(merchantIndex, 1);
      
      // Notify player
      player.ws.send(JSON.stringify({
        type: 'merchant_bought',
        upgradeId: upgrade.id,
        gold: player.gold
      }));
      
      // Broadcast update
      this.broadcastToRoom(room, {
        type: 'announcement',
        text: 'UPGRADE ACQUIRED',
        sub: `${player.name || 'A pilot'} bought ${upgrade.name}`
      });
    } else {
      player.ws.send(JSON.stringify({
        type: 'error',
        message: 'Not enough GOLD!'
      }));
    }
  }

  handleMerchantReady(room, playerId) {
    const gs = room.gameState;
    const player = room.players.get(playerId);
    if (!player || gs.encounterType !== 'merchant') return;

    player.merchantReady = !player.merchantReady;
    
    room.broadcastToRoom({
      type: 'player_merchant_ready',
      playerId: playerId,
      ready: player.merchantReady
    });

    let allReady = true;
    room.players.forEach(p => {
      if (!p.merchantReady) allReady = false;
    });

    if (allReady) {
      // Lazy load to avoid circular dependency
      const { endWave } = require('../game/waveManager');
      endWave(room, false);
    }
  }

  handleSelectSuperUpgrade(room, playerId, upgradeId) {
    const gs = room.gameState;
    const player = room.players.get(playerId);
    if (!player || gs.currentPhase !== 'SUPER_UPGRADE') return;

    // Apply super upgrade
    if (upgradeId === 'super_fire_rate') {
      player.superFireRateActive = true;
      player.fireRate *= 0.5;
      player.damage *= 2;
    } else if (upgradeId === 'super_homing') {
      player.superHomingActive = true;
      player.homing = 100;
      player.explosive = (player.explosive || 0) + 1;
    } else if (upgradeId === 'super_drones') {
      const droneCount = gs.drones.filter(d => d.ownerId === playerId).length;
      const { spawnDrone } = require('../game/entityFactory');
      for (let i = 0; i < droneCount; i++) {
        gs.drones.push(spawnDrone(gs.mothership));
      }
      gs.droneFireRateBonus += 2;
    } else if (upgradeId === 'super_weapons') {
      player.superWeaponsActive = true;
      player.multiShot *= 3;
      player.bulletSize *= 3;
    }

    player.superUpgradeSelected = true;

    // Check if everyone has selected
    let allSelected = true;
    room.players.forEach(p => {
      if (!p.superUpgradeSelected) allSelected = false;
    });

    if (allSelected) {
      const { endWave } = require('../game/waveManager');
      // After boss and super upgrade, the wave is effectively over, proceed to navigation
      endWave(room, false);
    }
  }
}

module.exports = RoomManager;
