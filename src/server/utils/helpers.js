const { GAME_WIDTH, GAME_HEIGHT } = require('../config/constants');

// Utility functions
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angle(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function getDifficulty(wave, difficultySetting = 'normal') {
  const t = Math.min(1, (wave - 1) / 14);
  
  let hMult = 1.0; // Health
  let sMult = 1.0; // Speed
  let rMult = 1.0; // Spawn Rate (lower is faster)
  
  if (difficultySetting === 'easy') { hMult = 0.6; sMult = 0.8; rMult = 1.3; }
  if (difficultySetting === 'hard') { hMult = 1.5; sMult = 1.2; rMult = 0.8; }
  if (difficultySetting === 'insane') { hMult = 2.5; sMult = 1.4; rMult = 0.5; }
  
  return {
    enemySpeed: (1.5 + Math.sqrt(t) * 2.0) * sMult, // Use sqrt for non-linear, controlled growth
    asteroidSpeed: 0.8 + t * 1.5,
    spawnRate: Math.max(10, (70 - t * 50) * rMult),
    enemyHealth: Math.max(1, (1 + Math.floor(t * 4)) * hMult),
    asteroidHealth: Math.max(1, (2 + Math.floor(t * 3)) * hMult)
  };
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes I, O, 0, 1 to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function hashPassword(password) {
  if (!password) return null;
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(password).digest('hex').substring(0, 16);
}

function verifyPassword(password, hash) {
  if (!hash) return true; // No password required
  if (!password) return false;
  return hashPassword(password) === hash;
}

function isPointOnLine(px, py, x1, y1, x2, y2, tolerance) {
  const lineDist = dist({ x: x1, y: y1 }, { x: x2, y: y2 });
  if (lineDist === 0) return dist({ x: px, y: py }, { x: x1, y: y1 }) <= tolerance;
  
  const t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / (lineDist * lineDist);
  const clampedT = Math.max(0, Math.min(1, t));
  
  const closestX = x1 + clampedT * (x2 - x1);
  const closestY = y1 + clampedT * (y2 - y1);
  
  return dist({ x: px, y: py }, { x: closestX, y: closestY }) <= tolerance;
}

module.exports = {
  dist,
  angle,
  clamp,
  getDifficulty,
  generateRoomCode,
  hashPassword,
  verifyPassword,
  isPointOnLine
};
