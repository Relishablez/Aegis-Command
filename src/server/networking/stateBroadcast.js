function buildStateSnapshot(room) {
  const gs = room.gameState;
  return {
    type: 'state',
    p: Array.from(room.players.values()).map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      angle: p.angle,
      hull: p.hull,
      maxHull: p.maxHull,
      shield: p.shield,
      shieldMax: p.shieldMax,
      alive: p.alive,
      respawnTimer: p.respawnTimer,
      color: p.color,
      name: p.name || `Player ${p.id.slice(-4)}`,
      radius: p.radius,
      powerups: p.powerups,
      upgradeReady: p.upgradeReady,
      gold: p.gold,
      stats: p.stats,
      upgradeLevels: gs.playerUpgrades[p.id] || {}
    })),
    m: {
      x: gs.mothership.x,
      y: gs.mothership.y,
      ringAngle: gs.mothership.ringAngle,
      hull: gs.mothership.hull,
      maxHull: gs.mothership.maxHull,
      shield: gs.mothership.shield,
      shieldMax: gs.mothership.shieldMax,
      radius: gs.mothership.radius
    },
    e: gs.enemies.map(e => ({
      x: e.x,
      y: e.y,
      angle: e.angle,
      hull: e.hull,
      maxHull: e.maxHull,
      radius: e.radius,
      diamond: e.diamond,
      isBoss: e.isBoss
    })),
    a: gs.asteroids.map(a => ({
      x: a.x,
      y: a.y,
      rot: a.rot,
      verts: a.verts,
      radius: a.radius
    })),
    b: gs.projectiles.map(b => ({
      x: b.x,
      y: b.y,
      angle: b.angle,
      friendly: b.friendly,
      damage: b.damage,
      bulletSize: b.bulletSize || 1,
      exploded: b.exploded || false,
      type: b.type || 'bullet'
    })),
    c: gs.pickups.map(c => ({
      x: c.x,
      y: c.y,
      type: c.type
    })),
    d: gs.drones.map(d => ({
      x: d.x,
      y: d.y,
      cooldown: d.fireCooldown
    })),
    w: {
      wave: gs.wave,
      encounterType: gs.encounterType,
      timer: gs.waveTimer,
      duration: gs.waveDuration,
      salvageCollected: gs.salvageCollected || 0,
      targetX: gs.encounterType === 'escort' ? 1360 : null,
      targetY: gs.encounterType === 'escort' ? 450 : null,
      teamXP: gs.teamXP,
      teamLevel: gs.teamLevel,
      teamXPNext: gs.teamXPNext
    },
    merchants: gs.merchants || [],
    purchasedMerchantUpgrades: gs.purchasedMerchantUpgrades || [],
    pvpScores: gs.pvpScores || null,
    xp: gs.xp,
    gameOver: gs.gameOver,
    currentPhase: gs.currentPhase,
    waitingForUpgrade: gs.waitingForUpgrade,
    navigationPhase: gs.navigationPhase,
    navigationOptions: gs.navigationOptions
  };
}

function broadcastState(roomManager) {
  for (const room of roomManager.rooms.values()) {
    if (room.players.size === 0) continue;
    const state = buildStateSnapshot(room);
    roomManager.broadcastToRoom(room, state);
  }
}

module.exports = {
  buildStateSnapshot,
  broadcastState
};
