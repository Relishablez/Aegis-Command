const { 
  GAME_WIDTH, 
  GAME_HEIGHT, 
  WAVE_DURATIONS,
  DRONE
} = require('../config/constants');
const { dist, angle, clamp } = require('../utils/helpers');
const { 
  spawnEnemy, 
  spawnAsteroid, 
  spawnProjectile, 
  spawnPickup, 
  spawnDrone 
} = require('./entityFactory');
const ACHIEVEMENTS = require('../config/achievements');

function updatePlayer(p, room) {
  const gs = room.gameState;
  if (!p.alive) {
    if (p.lives <= 0) return; // Permanent death
    
    p.respawnTimer--;
    if (p.respawnTimer <= 0) {
      p.alive = true;
      p.respawning = false;
      p.hull = p.maxHull;
      p.shield = p.shieldMax;
      p.x = room.gameState.mothership.x;
      p.y = room.gameState.mothership.y;
    }
    return;
  }

  let dx = 0, dy = 0;
  if (p.keys.w) dy -= 1;
  if (p.keys.s) dy += 1;
  if (p.keys.a) dx -= 1;
  if (p.keys.d) dx += 1;
  
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len; dy /= len;
    
    // Dash handling
    if (p.keys.shift && p.dashCooldown <= 0) {
      p.dashDuration = 10;
      p.dashCooldown = 90; // 1.5s cooldown
    }
    
    let currentSpeed = p.speed;
    if (p.powerups.turbo > 0) currentSpeed *= 1.5;
    if (room.gameState.hyperDriveBoost) currentSpeed *= room.gameState.hyperDriveBoost;
    if (p.merchantSpeed) currentSpeed *= p.merchantSpeed;
    
    if (p.dashDuration > 0) {
      currentSpeed *= 3;
      p.dashDuration--;
    }
    
    p.x += dx * currentSpeed;
    p.y += dy * currentSpeed;
  }
  
  if (p.dashCooldown > 0) p.dashCooldown--;
  
  p.x = clamp(p.x, p.radius, GAME_WIDTH - p.radius);
  p.y = clamp(p.y, p.radius, GAME_HEIGHT - p.radius);
  
  // Aiming with Arrow Keys or Mouse
  if (p.keys.ArrowUp || p.keys.ArrowDown || p.keys.ArrowLeft || p.keys.ArrowRight) {
    let adx = 0, ady = 0;
    if (p.keys.ArrowUp) ady -= 1;
    if (p.keys.ArrowDown) ady += 1;
    if (p.keys.ArrowLeft) adx -= 1;
    if (p.keys.ArrowRight) adx += 1;
    if (adx !== 0 || ady !== 0) {
      p.angle = Math.atan2(ady, adx);
    }
  } else if (p.mouseX !== undefined && p.mouseY !== undefined) {
    p.angle = Math.atan2(p.mouseY - p.y, p.mouseX - p.x);
  }
  
  // Powerup timers
  if (p.powerups.rapidFire > 0) p.powerups.rapidFire--;
  if (p.powerups.invincible > 0) p.powerups.invincible--;
  if (p.powerups.doubleGold > 0) p.powerups.doubleGold--;
  if (p.powerups.turbo > 0) p.powerups.turbo--;
  if (p.powerups.megaShot > 0) p.powerups.megaShot--;
  
  let effectiveFireRate = p.powerups.rapidFire > 0 ? Math.max(2, p.fireRate / 2) : p.fireRate;
  effectiveFireRate = Math.max(4, effectiveFireRate); // Cap at 4 frames to prevent massive overlap
  
  if (p.fireCooldown > 0) p.fireCooldown--;
  if (p.mouseDown && p.fireCooldown <= 0 && room.gameState.projectiles.length < 500) {
    const spread = 0.15 + (p.spread || 0);
    const baseAngle = p.angle;
    const damage = (p.damage || 1) * (p.powerups.megaShot > 0 ? 3 : 1);
    const healing = p.healing || 0;
    const piercing = p.piercing || 0;
    
    for (let i = 0; i < p.multiShot; i++) {
      const offset = p.multiShot > 1 ? (i - (p.multiShot - 1) / 2) * spread : 0;
      const angle = baseAngle + offset;

      if (p.weaponType === 'laser') {
        // Hitscan Laser Logic
        const range = p.laserRange || 500;
        const targetX = p.x + Math.cos(angle) * range;
        const targetY = p.y + Math.sin(angle) * range;
        
        // Spawn a visual-only hitscan projectile (fades out over 10 frames)
        const projectile = spawnProjectile(p.x, p.y, angle, true, 100);
        projectile.type = 'laser';
        projectile.life = 20; 
        projectile.maxLife = 20;
        projectile.damage = damage;
        projectile.ownerId = p.id;
        room.gameState.projectiles.push(projectile);

        // Check immediate damage to all entities in path
        const laserWidth = 10 + (p.bulletSize || 1) * 5; // Tighter collision
        const gs = room.gameState;
        
        // Pass range and width to visual projectile
        projectile.range = range;
        projectile.width = laserWidth;
        
        // Damage enemies
        gs.enemies.forEach(e => {
          if (isPointOnLine(e.x, e.y, p.x, p.y, targetX, targetY, e.radius + laserWidth)) {
            e.hull -= damage;
            e.lastHitBy = p.id;
            p.stats.damageDealt += damage;
          }
        });

        // Damage asteroids
        gs.asteroids.forEach(a => {
          if (isPointOnLine(a.x, a.y, p.x, p.y, targetX, targetY, a.radius + laserWidth)) {
            a.hull -= damage;
          }
        });

        // PVP Damage
        if (gs.encounterType === 'pvp') {
          room.players.forEach(other => {
            if (other.id !== p.id && other.alive) {
              if (isPointOnLine(other.x, other.y, p.x, p.y, targetX, targetY, other.radius + laserWidth)) {
                if (other.shield > 0) {
                  other.shield -= damage;
                  if (other.shield < 0) {
                    other.hull += other.shield;
                    other.shield = 0;
                  }
                } else {
                  other.hull -= damage;
                }
                if (other.hull <= 0) {
                  other.hull = 0;
                  other.lives--;
                  other.alive = false;
                  other.respawning = other.lives > 0;
                  other.respawnTimer = 180;
                  p.stats.kills++;
                  gs.pvpScores[p.id]++;
                }
              }
            }
          });
        }
      } else {
        const projectile = spawnProjectile(
          p.x + Math.cos(angle) * 20,
          p.y + Math.sin(angle) * 20,
          angle,
          true,
          12
        );
        projectile.damage = damage;
        projectile.healing = healing;
        projectile.pierce = p.piercing || 0;
        projectile.homing = p.homing || 0;
        projectile.aoe = (p.explosive || 0) * 100;
        projectile.bulletSize = p.bulletSize || 1;
        projectile.critChance = p.critChance || 0;
        projectile.ownerId = p.id;
        projectile.type = p.weaponType || 'bullet';
        
        if (projectile.type === 'homing_missile') {
          projectile.homing = Math.max(0.1, p.homing || 0); // Intrinsic homing
          // Chaining mechanic: homing upgrades give extra hits
          projectile.pierce = (p.piercing || 0) + Math.floor((p.homing || 0) * 10);
          projectile.color = '#e74c3c'; // Distinct missile color
          projectile.isMissile = true;
        }
        
        if (projectile.type === 'laser') {
          projectile.isLaser = true;
          projectile.pierce = (projectile.pierce || 0) + 10;
          projectile.range = p.laserRange || 500;
          // Lasers are fast
          projectile.vx *= 4;
          projectile.vy *= 4;
        }

        if (projectile.type === 'pulse_wave') {
          projectile.isPulse = true;
          projectile.arc = p.pulseArc || (Math.PI / 4);
          projectile.radius = 20; // Starting radius
          projectile.maxRadius = 120 + (p.bulletSize || 1) * 40;
          projectile.life = 25; // Slightly longer life
          projectile.damage = damage;
          projectile.ownerId = p.id;
          projectile.color = '#00f2ff';
          projectile.homing = 0;
          projectile.vx = 0;
          projectile.vy = 0;
        }
        
        if (gs.projectiles.length < 1500) {
          gs.projectiles.push(projectile);
        }
      }
    }
    p.fireCooldown = effectiveFireRate;
  }
  
  // Proximity Mines
  const minesLevel = gs.playerUpgrades[p.id]?.mines || 0;
  if (p.alive && minesLevel > 0) {
    if (!p.mineCooldown) p.mineCooldown = 0;
    if (p.mineCooldown > 0) p.mineCooldown--;
    if (p.mineCooldown <= 0 && gs.projectiles.length < 500) {
      const { spawnProjectile } = require('./entityFactory');
      
      // Spawn away from player at random spot
      const spawnAngle = Math.random() * Math.PI * 2;
      const spawnDist = 60 + Math.random() * 80; // 60-140 units away
      const mineX = p.x + Math.cos(spawnAngle) * spawnDist;
      const mineY = p.y + Math.sin(spawnAngle) * spawnDist;

      const mine = spawnProjectile(mineX, mineY, 0, true, 0); // speed 0
      mine.type = 'mine';
      mine.damage = (p.damage || 1) * 2 * minesLevel;
      mine.explosive = 0.5 + minesLevel * 0.1;
      mine.life = 600; // 10 seconds
      mine.ownerId = p.id;
      mine.radius = 15 + minesLevel * 2;
      mine.bulletSize = 1 + minesLevel * 0.2;
      mine.homing = p.homing || 0;
      
      gs.projectiles.push(mine);
      const cooldownTime = Math.max(60, 300 - minesLevel * 30); // 5s base, -0.5s per level, min 1s
      p.mineCooldown = cooldownTime;
      p.mineMaxCooldown = cooldownTime;
      
      // Indicator for mine spawn
      if (room.broadcastToRoom) {
        room.broadcastToRoom({ type: 'pickup_text', x: p.x, y: p.y, text: 'MINE DEPLOYED', color: '#f1c40f', playerId: p.id });
      }
    }
  }
  
  // Melee Spikes (Ramming Logic)
  const ramSpikesLevel = gs.playerUpgrades[p.id]?.ram_spikes || 0;
  if (p.alive && ramSpikesLevel > 0) {
    if (!p.ramCooldowns) p.ramCooldowns = {};
    const currentVel = Math.hypot(dx, dy) * (p.speed + (p.dashDuration > 0 ? p.speed * 2 : 0));
    
    gs.enemies.forEach(e => {
      // Cooldown check
      if (p.ramCooldowns[e.id] && p.ramCooldowns[e.id] > 0) {
        p.ramCooldowns[e.id]--;
        return;
      }
      
      if (dist(p, e) < p.radius + e.radius + 15) {
        const damage = ramSpikesLevel * 25 * (1 + currentVel * 1.5);
        e.hull -= damage;
        e.lastHitBy = p.id;
        p.ramCooldowns[e.id] = 20; // 0.33s cooldown at 60Hz
      }
    });
    
    gs.asteroids.forEach(a => {
      if (dist(p, a) < p.radius + a.radius + 15) {
        a.hull -= ramSpikesLevel * 15 * (1 + currentVel * 0.8);
      }
    });
  }

  // Track time alive
  p.stats.timeAlive++;
  p.stats.maxWave = Math.max(p.stats.maxWave, gs.wave);
  
  // Check achievements
  checkAchievements(p, room);
}

function checkAchievements(p, room) {
  ACHIEVEMENTS.forEach(ach => {
    if (p.achievements.includes(ach.id)) return;
    
    let qualified = false;
    if (ach.requirement.type === 'time' && p.stats.timeAlive >= ach.requirement.value) qualified = true;
    if (ach.requirement.type === 'kills' && p.stats.kills >= ach.requirement.value) qualified = true;
    if (ach.requirement.type === 'wave' && p.stats.maxWave >= ach.requirement.value) qualified = true;
    
    if (qualified) {
      p.achievements.push(ach.id);
      
      // Apply bonus
      if (ach.bonus.type === 'speed') p.speed += (p.speed * ach.bonus.value);
      if (ach.bonus.type === 'damage') p.damage = (p.damage || 1) + ach.bonus.value;
      if (ach.bonus.type === 'hull') {
        p.maxHull += 10; // Simple increment for hp
        p.hull += 10;
      }
      
      // Notify player
      if (p.ws && p.ws.readyState === 1) {
        p.ws.send(JSON.stringify({
          type: 'achievement_unlocked',
          achievement: ach
        }));
      }
    }
  });
}

function updateMothership(room) {
  const m = room.gameState.mothership;
  const gs = room.gameState;
  const anyPlayerAlive = Array.from(room.players.values()).some(p => p.alive);
  
  // Mission: Escort Movement
  if (gs.encounterType === 'escort' && gs.currentPhase === 'COMBAT') {
    const targetX = GAME_WIDTH * 0.85;
    const targetY = GAME_HEIGHT / 2;
    const a = angle(m, { x: targetX, y: targetY });
    let currentMSpeed = m.speed || 0.4;
    if (gs.hyperDriveBoost) currentMSpeed *= gs.hyperDriveBoost;
    
    m.x += Math.cos(a) * currentMSpeed;
    m.y += Math.sin(a) * currentMSpeed;
    
    if (dist(m, { x: targetX, y: targetY }) < 60) {
      const { endWave } = require('./waveManager');
      room.players.forEach(p => { if (p.alive) p.gold += 250; });
      endWave(room);
    }
  }

  // Final Boss (W15) Evasive Maneuvers
  if (gs.wave >= 15 && gs.currentPhase === 'COMBAT') {
    const boss = gs.enemies.find(e => e.isBoss);
    if (boss) {
      const distToBoss = dist(m, boss);
      if (distToBoss < 400) {
        // Move away from boss
        const a = angle(boss, m);
        m.x += Math.cos(a) * 0.5;
        m.y += Math.sin(a) * 0.5;
      }
      // Sway slightly to "dodge"
      m.y += Math.sin(gs.waveTimer * 0.05) * 1;
    }
  }
  
  m.ringAngle += 0.01;
  
  // Orbital Strike Logic
  if (gs.orbitalStrikeUnlocked && gs.currentPhase === 'COMBAT' && gs.enemies.length > 0) {
    if (!m.orbitalCooldown) m.orbitalCooldown = 0;
    if (m.orbitalCooldown <= 0) {
      const target = gs.enemies.find(e => e.isBoss) || gs.enemies.reduce((prev, current) => (prev.hull > current.hull) ? prev : current);
      
      const a = angle(m, target);
      // removed require here
      const proj = spawnProjectile(m.x, m.y, a, true, 20);
      proj.damage = 1000;
      proj.bulletSize = 8;
      proj.type = 'orbital';
      proj.aoe = 300;
      proj.homing = 0.8;
      proj.color = '#ff00ff';
      room.gameState.projectiles.push(proj);
      
      m.orbitalCooldown = 300; // 10 seconds
    } else {
      m.orbitalCooldown--;
    }
  }
  
  // Last Stand / Auto-defense
  if (gs.currentPhase === 'COMBAT') {
    // Mothership can defend itself if players are dead or even if alive (if upgraded)
    const canFireAuto = !anyPlayerAlive || (m.autoTurret > 0);
    
    if (canFireAuto && gs.enemies.length > 0 && gs.encounterType !== 'pvp') {
      if (!m.autoCooldown) m.autoCooldown = 0;
      m.autoCooldown--;
      if (m.autoCooldown <= 0) {
        let nearest = gs.enemies.sort((a, b) => dist(m, a) - dist(m, b))[0];
        const range = m.turretRange || 500;
        if (nearest && dist(m, nearest) < range) {
          const a = angle(m, nearest);
          // removed require here
          
          // Use Ultra Pulse Laser if players bought it and they are dead
          if (!anyPlayerAlive && gs.purchasedMerchantUpgrades?.some(u => u.id === 'laser')) {
            const b = spawnProjectile(m.x, m.y, a, true, 15);
            b.type = 'laser';
            b.damage = 25;
            b.range = 800;
            b.width = 15;
            b.life = 20;
            gs.projectiles.push(b);
            m.autoCooldown = 40;
          } else {
            const b = spawnProjectile(m.x + Math.cos(a) * 50, m.y + Math.sin(a) * 50, a, true, 10);
            b.damage = 10 + (m.autoTurret || 0) * 5;
            gs.projectiles.push(b);
            m.autoCooldown = Math.max(15, 60 - (m.autoTurret || 0) * 10);
          }
        }
      }
    }

    // Auto-Orbital Strike in Last Stand
    if (!anyPlayerAlive && gs.orbitalStrikeUnlocked) {
      if (!m.lastStandOrbitalCooldown) m.lastStandOrbitalCooldown = 0;
      m.lastStandOrbitalCooldown--;
      if (m.lastStandOrbitalCooldown <= 0) {
        const targets = [...gs.enemies, ...gs.asteroids];
        if (targets.length > 0) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          // removed require here
          const b = spawnProjectile(target.x, target.y, 0, true, 0);
          b.type = 'orbital';
          b.life = 30;
          b.damage = 150;
          b.radius = 200;
          b.exploded = true;
          gs.projectiles.push(b);
          m.lastStandOrbitalCooldown = 180;
        }
      }
    }
  }
  
  // Shield regeneration
  if (m.shieldRegen > 0 && m.shield < m.shieldMax) {
    m.shield = Math.min(m.shieldMax, m.shield + m.shieldRegen * 0.016);
  }
}

function updateBossAI(boss, room) {
  const gs = room.gameState;
  const m = gs.mothership;
  
  // Basic movement (patrol or hover near top)
  boss.phaseTimer = (boss.phaseTimer || 0) + 1;
  boss.fireCooldown = (boss.fireCooldown || 0) - 1;
  
  if (boss.patrolAxis === 'x') {
    boss.x += 2 * boss.patrolDir;
    if (boss.x > 1500) boss.patrolDir = -1;
    if (boss.x < 100) boss.patrolDir = 1;
  } else {
    boss.y += 1 * boss.patrolDir;
    if (boss.y > 600) boss.patrolDir = -1;
    if (boss.y < 100) boss.patrolDir = 1;
  }

  const { spawnBullet } = require('./entityFactory');
  
  // Boss drone spawning (Hard & Extreme)
  if ((gs.wave === 30 || gs.wave >= 50) && boss.phaseTimer % 300 === 0) {
    const { spawnEnemy } = require('./entityFactory');
    for (let i = 0; i < (gs.wave >= 50 ? 4 : 2); i++) {
      const drone = spawnEnemy(room);
      drone.x = boss.x + (Math.random() - 0.5) * 100;
      drone.y = boss.y + (Math.random() - 0.5) * 100;
      drone.hull = 300;
      drone.speed = 3;
      gs.enemies.push(drone);
    }
  }

  if (gs.wave >= 50) {
    // Extreme Boss Mechanics
    if (boss.phaseTimer % 400 < 200) {
      // Phase 1: Heavy barrage
      if (boss.fireCooldown <= 0) {
        const a = angle(boss, m);
        for (let i = -2; i <= 2; i++) {
          const b = spawnBullet(boss, a + i * 0.15, 12, true);
          b.radius = 8;
          b.damage = 30;
          gs.bullets.push(b);
        }
        boss.fireCooldown = 25;
      }
    } else {
      // Phase 2: Big Orbs + Dodging
      if (boss.fireCooldown <= 0) {
        const a = angle(boss, m);
        const b = spawnBullet(boss, a, 6, true);
        b.radius = 30;
        b.type = 'big_orb';
        b.damage = 80;
        gs.bullets.push(b);
        boss.fireCooldown = 50;
      }
      if (Math.random() < 0.05) {
        boss.x += (Math.random() > 0.5 ? 150 : -150);
        boss.y += (Math.random() > 0.5 ? 80 : -80);
      }
    }
  } else if (gs.wave >= 30) {
    // Hard Boss Mechanics
    if (boss.phaseTimer % 300 < 150) {
      if (boss.fireCooldown <= 0) {
        const a = angle(boss, m);
        for (let i = -1; i <= 1; i++) {
          gs.bullets.push(spawnBullet(boss, a + i * 0.2, 10, true));
        }
        boss.fireCooldown = 30;
      }
    } else {
      if (boss.fireCooldown <= 0) {
        const a = angle(boss, m);
        const b = spawnBullet(boss, a, 5, true);
        b.radius = 20;
        b.type = 'big_orb';
        gs.bullets.push(b);
        boss.fireCooldown = 60;
      }
    }
  } else if (gs.wave >= 10) {
    // Normal Boss Mechanics
    if (boss.fireCooldown <= 0) {
      const a = angle(boss, m);
      for (let i = -1; i <= 1; i++) {
        gs.bullets.push(spawnBullet(boss, a + i * 0.15, 8, true));
      }
      boss.fireCooldown = 40;
    }
  } else {
    // Easy Boss Mechanics (If wave 5 still spawns boss)
    if (boss.fireCooldown <= 0) {
      gs.bullets.push(spawnBullet(boss, angle(boss, m), 6, true));
      boss.fireCooldown = 60;
    }
  }
  
  boss.x = Math.max(100, Math.min(GAME_WIDTH - 100, boss.x));
  boss.y = Math.max(100, Math.min(GAME_HEIGHT - 100, boss.y));
}

function updateEnemies(room) {
  const gs = room.gameState;
  const m = gs.mothership;
  
  for (let i = gs.enemies.length - 1; i >= 0; i--) {
    const e = gs.enemies[i];
    
    if (e.isBoss) {
      if (gs.waveTimer % 120 === 0) {
        console.log(`[BOSS] HP: ${Math.floor(e.hull)}/${e.maxHull} Pos: ${Math.floor(e.x)},${Math.floor(e.y)}`);
      }
      updateBossAI(e, room);
    } else {
      const a = angle(e, m);
      e.angle = a;
      e.x += Math.cos(a) * e.speed;
      e.y += Math.sin(a) * e.speed;
      
      const dx = e.x - m.x;
      const dy = e.y - m.y;
      const hitRadius = e.radius + m.radius;
      // Check collision with mothership (AABB then squared dist)
      if (Math.abs(dx) < hitRadius && Math.abs(dy) < hitRadius && (dx * dx + dy * dy < hitRadius * hitRadius)) {
        if (!m.godMode) {
            if (m.shield > 0) {
              m.shield -= 10;
              if (m.shield < 0) {
                m.hull += m.shield;
                m.shield = 0;
              }
            } else {
              m.hull -= 10;
            }
        }
        e.hull = 0;
      }
    }
    
    room.players.forEach(p => {
      const pdx = e.x - p.x;
      const pdy = e.y - p.y;
      const pHitRadius = e.radius + p.radius;
      if (p.alive && Math.abs(pdx) < pHitRadius && Math.abs(pdy) < pHitRadius && (pdx * pdx + pdy * pdy < pHitRadius * pHitRadius)) {
        if (p.godMode) {
            e.hull -= 100; // Ramming damage
            return;
        }
        let pDamage = 20 * (p.cursedDamageTaken || 1);
        if (p.shield > 0) {
          p.shield -= pDamage;
          if (p.shield < 0) {
            p.hull += p.shield;
            p.shield = 0;
          }
        } else {
          if (p.powerups.invincible > 0) {
            e.hull -= 100; // Ramming damage
          } else {
            p.hull -= pDamage;
            e.hull -= 5;
          }
        }
        if (p.hull <= 0) {
          p.hull = 0;
          p.lives--;
          if (p.lives > 0) {
            p.alive = false;
            p.respawning = true;
            p.respawnTimer = 180; // 3 seconds
          } else {
            p.alive = false;
            p.respawning = false;
          }
        }
      }
    });
    
    // Remove dead enemies and handle drops
    if (e.hull <= 0) {
      if (e.isBoss) {
        const { triggerSuperUpgrade } = require('./waveManager');
        triggerSuperUpgrade(room);
      }
      
      const playerScale = Math.max(1, Math.sqrt(room.players.size)); // Reduces gold per player as group size increases
      const hostScale = room.settings?.goldMultiplier || 1.0;
      let baseGold = Math.floor((e.diamond ? 100 : 50) * gs.goldMultiplier * hostScale / playerScale);
      const teamXP = e.diamond ? 50 : 25;
      
      // Double Gold Powerup
      room.players.forEach(p => {
        if (p.id === e.lastHitBy && p.powerups.doubleGold > 0) {
          baseGold *= 2;
        }
      });
      
      // Update team XP
      gs.teamXP += teamXP;
      if (gs.teamXP >= gs.teamXPNext) {
        gs.teamLevel++;
        gs.teamXP -= gs.teamXPNext;
        gs.teamXPNext = Math.floor(gs.teamXPNext * 1.6);
        // Queue Mid-wave upgrade
        gs.pendingLevelUps = (gs.pendingLevelUps || 0) + 1;
        
        // Level up announcement
        if (room.broadcastToRoom) {
          room.broadcastToRoom({ 
            type: 'announcement', 
            text: 'LEVEL UP!', 
            sub: `TEAM LEVEL ${gs.teamLevel}`,
            color: '#f1c40f'
          });
        }
        
        // Bonus for leveling up (e.g. heal everyone)
        room.players.forEach(p => {
          if (p.alive) p.hull = Math.min(p.maxHull, p.hull + 10);
        });
      }

      // Shared + Bonus Gold
      const killerId = e.lastHitBy;
      room.players.forEach(p => {
        if (p.alive) {
          // Everyone gets a base amount
          p.gold += Math.floor(baseGold * 0.5);
          // Killer gets a bonus
          if (p.id === killerId) {
            p.gold += Math.floor(baseGold * 0.7);
            p.stats.kills++;
          }
        }
      });
      
      const ownerPlayer = room.players.get(e.lastHitBy);
      const dropChance = 0.2 + gs.dropRateBonus + (ownerPlayer ? (ownerPlayer.luck || 0) * 0.05 : 0);
      
      if (Math.random() < dropChance) {
        let type;
        const rand = Math.random();
        if (rand < 0.6) type = 'gold'; // 60% gold
        else if (rand < 0.8) type = 'health'; // 20% health
        else if (rand < 0.9) type = 'mothership_health'; // 10% mothership health
        else {
          // 10% powerups
          const pTypes = ['rapidFire', 'invincible', 'doubleGold', 'turbo', 'megaShot'];
          type = pTypes[Math.floor(Math.random() * pTypes.length)];
        }
        gs.pickups.push(spawnPickup(e.x, e.y, type));
      }
      gs.enemies.splice(i, 1);
    }
  }
}

function updateAsteroids(room) {
  const gs = room.gameState;
  const m = gs.mothership;
  
  for (let i = gs.asteroids.length - 1; i >= 0; i--) {
    const a = gs.asteroids[i];
    const ang = angle(a, m);
    a.x += Math.cos(ang) * a.speed;
    a.y += Math.sin(ang) * a.speed;
    a.rot += a.rotSpeed;
    const adx = a.x - m.x;
    const ady = a.y - m.y;
    const aHitRadius = a.radius + m.radius - 10;
    
    // Check collision with mothership
    const anyPlayerAlive = Array.from(room.players.values()).some(p => p.alive);
    if (Math.abs(adx) < aHitRadius && Math.abs(ady) < aHitRadius && (adx * adx + ady * ady < aHitRadius * aHitRadius)) {
      if (anyPlayerAlive || m.godMode) {
        // Invulnerable!
        a.hull = 0; // Asteroid still breaks but MS takes no damage
      } else {
        if (m.shield > 0) {
          m.shield -= 15;
          if (m.shield < 0) {
            m.hull += m.shield;
            m.shield = 0;
          }
        } else {
          m.hull -= 15;
        }
        a.hull = 0;
      }
    }
    
    room.players.forEach(p => {
      const apdx = a.x - p.x;
      const apdy = a.y - p.y;
      const apHitRadius = a.radius + p.radius - 5;
      if (p.alive && Math.abs(apdx) < apHitRadius && Math.abs(apdy) < apHitRadius && (apdx * apdx + apdy * apdy < apHitRadius * apHitRadius)) {
        if (p.powerups.invincible > 0 || p.godMode) return; // Invincible!
        
        let pDamage = 25 * (p.cursedDamageTaken || 1);
        if (p.shield > 0) {
          p.shield -= pDamage;
          if (p.shield < 0) {
            p.hull += p.shield;
            p.shield = 0;
          }
        } else {
          p.hull -= pDamage;
        }
        a.hull -= 2;
        if (p.hull <= 0) {
          p.alive = false;
          p.respawnTimer = 180;
          p.hull = 0;
        }
      }
    });
    
    if (a.hull <= 0) {
      const playerScale = Math.max(1, Math.sqrt(room.players.size));
      const hostScale = room.settings?.goldMultiplier || 1.0;
      const goldGain = Math.floor(40 * gs.goldMultiplier * hostScale / playerScale);
      
      gs.teamXP += 10;
      room.players.forEach(p => {
        if (p.alive) {
          p.gold += Math.floor(goldGain * 0.5);
          if (p.id === a.lastHitBy) p.gold += Math.floor(goldGain * 0.5);
        }
      });
      gs.asteroids.splice(i, 1);
    }
  }
}

function updateProjectiles(room) {
  const gs = room.gameState;
  
  for (let i = gs.projectiles.length - 1; i >= 0; i--) {
    const b = gs.projectiles[i];
    b.x += b.vx || 0;
    b.y += b.vy || 0;
    b.life--;
    
    // Safety: Prevent NaN coordinates
    if (isNaN(b.x) || isNaN(b.y)) {
      gs.projectiles.splice(i, 1);
      continue;
    }

    if (b.isPulse) {
        b.radius += 10; // Expanding wave speed
        const owner = room.players.get(b.ownerId);
        if (owner && owner.alive) {
            b.x = owner.x;
            b.y = owner.y;
        }
        
        // Collision logic for arc - check in a ring
        const waveThickness = 40;
        gs.enemies.forEach(e => {
                const dx = e.x - b.x;
                const dy = e.y - b.y;
                const distSq = dx * dx + dy * dy;
                const hitRadius = b.radius + e.radius;
                
                if (distSq < hitRadius * hitRadius && distSq > (b.radius - waveThickness) * (b.radius - waveThickness)) {
                    const angleToEnemy = Math.atan2(dy, dx);
                
                let angleDiff = Math.atan2(Math.sin(angleToEnemy - b.angle), Math.cos(angleToEnemy - b.angle));
                
                if (Math.abs(angleDiff) < b.arc / 2) {
                    if (!b.hitEnemies) b.hitEnemies = new Set();
                    if (!b.hitEnemies.has(e.id)) {
                        e.hull -= b.damage;
                        e.lastHitBy = b.ownerId;
                        b.hitEnemies.add(e.id);
                        if (owner) owner.stats.damageDealt += b.damage;
                    }
                }
            }
        });
        
        // Check asteroid collision in arc
        gs.asteroids.forEach(a => {
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const distSq = dx * dx + dy * dy;
            const hitRadius = b.radius + a.radius;
            
            if (distSq < hitRadius * hitRadius && distSq > (b.radius - waveThickness) * (b.radius - waveThickness)) {
                const angleToAsteroid = Math.atan2(dy, dx);
                let angleDiff = Math.atan2(Math.sin(angleToAsteroid - b.angle), Math.cos(angleToAsteroid - b.angle));
                if (Math.abs(angleDiff) < b.arc / 2) {
                    a.hull -= 1;
                }
            }
        });

        if (b.life <= 0) {
            gs.projectiles.splice(i, 1);
        }
        continue;
    }
    
    // Homing logic
    if (b.friendly && (b.homing > 0 || gs.teamHomingBoost) && gs.enemies.length > 0) {
      let nearest = null;
      let nearestDistSq = (b.type === 'mine' ? 600 : 400) ** 2;
      gs.enemies.forEach(e => {
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (Math.abs(dx) > 600 || Math.abs(dy) > 600) return;
        const dSq = dx * dx + dy * dy;
        if (dSq < nearestDistSq) {
          nearestDistSq = dSq;
          nearest = e;
        }
      });
      
      if (nearest) {
        const nearestDist = Math.sqrt(nearestDistSq);
        let targetX = nearest.x;
        let targetY = nearest.y;
        
        // Predictive tracking if homing > 0.15 (level 3+)
        if (b.homing >= 0.15) {
          const timeToReach = nearestDist / (Math.hypot(b.vx, b.vy) || 5);
          targetX += (nearest.vx || 0) * timeToReach * 0.5;
          targetY += (nearest.vy || 0) * timeToReach * 0.5;
        }

        const targetAngle = Math.atan2(targetY - b.y, targetX - b.x);
        let speed = Math.hypot(b.vx, b.vy) || (b.type === 'mine' ? 3 : 12); // Mines move slower
        
        // Smooth rotation
        let angleDiff = Math.atan2(Math.sin(targetAngle - b.angle), Math.cos(targetAngle - b.angle));
        
        b.angle += Math.max(-0.15, Math.min(0.15, angleDiff));
        b.vx = Math.cos(b.angle) * speed;
        b.vy = Math.sin(b.angle) * speed;
      }
    }
    
    // Boundary check with buffer to prevent premature clipping
    const buffer = 400;
    if (b.life <= 0 || b.x < -buffer || b.x > GAME_WIDTH + buffer || b.y < -buffer || b.y > GAME_HEIGHT + buffer) {
      gs.projectiles.splice(i, 1);
      continue;
    }
    
    if (b.friendly) {
      if (gs.encounterType === 'pvp') {
        let hit = false;
        for (const p of room.players.values()) {
          if (p.id !== b.ownerId && p.alive && dist(b, p) < p.radius + 10) {
            if (p.godMode) continue;
            p.hull -= (b.damage || 1) * 2;
            if (p.hull <= 0) {
              p.alive = false;
              p.respawnTimer = 60;
              if (gs.pvpScores) {
                gs.pvpScores[b.ownerId] = (gs.pvpScores[b.ownerId] || 0) + 1;
              }
            }
            gs.projectiles.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (hit) continue;
      }

      // Check enemy collisions
      for (let j = gs.enemies.length - 1; j >= 0; j--) {
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        // Increased collision radius for mines to make them more reliable
        const mineBonus = b.type === 'mine' ? 15 : 0;
        const hitRadius = (b.bulletSize || 1) * 5 + e.radius + mineBonus;
        const hitRadiusSq = hitRadius * hitRadius;
        
        // CCD (Continuous Collision Detection) to prevent tunneling at high speeds
        const prevX = b.x - (b.vx || 0);
        const prevY = b.y - (b.vy || 0);
        
        // Check if the enemy is near the line segment from prev position to current
        if (isPointOnLine(e.x, e.y, prevX, prevY, b.x, b.y, hitRadius)) {
          let damage = b.damage || 1;
          
          // Critical hit chance
          if (b.critChance > 0 && Math.random() < b.critChance) {
            damage *= 2;
          }
          
          e.hull -= damage;
          e.lastHitBy = b.ownerId;
          
          // Track damage
          const owner = room.players.get(b.ownerId);
          if (owner) {
            owner.stats.damageDealt += damage;
          }
          
          // Optimized Secondary Effects (AoE, Explosive, Chaining)
          const aoeRadius = b.aoe || 0;
          const explosiveRadius = (b.explosive > 0) ? 50 : 0;
          const blastRadius = Math.max(aoeRadius, explosiveRadius, b.isMissile ? 120 : 0);
          
          if (blastRadius > 0) {
            gs.enemies.forEach(other => {
              if (other === e) return;
              const odx = b.x - other.x;
              const ody = b.y - other.y;
              if (Math.abs(odx) > blastRadius || Math.abs(ody) > blastRadius) return;
              
              const dSq = odx * odx + ody * ody;
              if (dSq < blastRadius * blastRadius) {
                const aoeDmg = aoeRadius > 0 ? (damage * 0.5) : 0;
                const expDmg = explosiveRadius > 0 ? (damage * b.explosive) : 0;
                const totalExtraDmg = aoeDmg + expDmg;
                
                other.hull -= totalExtraDmg;
                other.lastHitBy = b.ownerId;
                if (owner) owner.stats.damageDealt += totalExtraDmg;
              }
            });
            b.exploded = true;
          }
          
          // Shrapnel logic
          if (owner && owner.shrapnel > 0 && !b.isShrapnelFragment) {
            const shardCount = 2 + Math.floor(owner.shrapnel / 2);
            for (let k = 0; k < shardCount; k++) {
              const shardAngle = b.angle + (Math.random() - 0.5) * 2;
              const shard = spawnProjectile(b.x, b.y, shardAngle, true, 8);
              shard.damage = damage * 0.25;
              shard.isShrapnelFragment = true;
              shard.type = 'shrapnel';
              shard.life = 30;
              shard.ownerId = owner.id;
              shard.color = '#f1c40f';
              shard.bulletSize = 1.0 + (owner.shrapnel * 0.2);
              shard.homing = 0; // Shrapnel doesn't home
              gs.projectiles.push(shard);
            }
          }
          
          // Chain Lightning Logic (Optimized with AABB)
          if (owner && owner.chainLightning > 0 && !b.hasChained) {
            const nextTarget = gs.enemies.find(ne => {
              if (ne === e) return false;
              if (Math.abs(ne.x - e.x) > 400 || Math.abs(ne.y - e.y) > 400) return false;
              return dist(ne, e) < 400;
            });
            
            if (nextTarget) {
              const a = angle(e, nextTarget);
              const chain = spawnProjectile(e.x, e.y, a, true, 25);
              chain.damage = damage * 0.75;
              chain.hasChained = true;
              chain.type = 'lightning';
              chain.color = '#00ffff';
              chain.bulletSize = 2;
              chain.ownerId = owner.id;
              gs.projectiles.push(chain);
            }
          }
          
          // Life steal
          if (b.healing > 0) {
            room.players.forEach(p => {
              if (p.alive) p.hull = Math.min(p.maxHull, p.hull + damage * b.healing);
            });
          }
          
          if (b.pierce > 0) {
            b.pierce--;
            // Missile Synergy: Homing missiles keep seeking new targets
            if (b.isMissile || b.homing > 0) {
              b.homing = Math.min(0.3, (b.homing || 0) + 0.1); 
              b.vx *= 0.5; b.vy *= 0.5; 
              // Boost longevity and damage based on homing upgrades
              const ownerHoming = owner ? (owner.homing || 0) : 0;
              b.life = Math.max(b.life, 120 + ownerHoming * 60); 
              b.damage *= (1.1 + ownerHoming * 0.5);
            }
          } else {
            if (b.exploded && b.life > 3) {
              b.life = 3;
              b.damage = 0;
            } else {
              gs.projectiles.splice(i, 1);
              b.removed = true;
            }
          }
          break;
        }
      }
      
      // Check asteroid collisions if projectile still exists
      if (gs.projectiles[i] && !b.removed) {
        for (let j = gs.asteroids.length - 1; j >= 0; j--) {
          const a = gs.asteroids[j];
          if (dist(b, a) < a.radius) {
            a.hull -= 1;
            if (b.pierce > 0) {
              b.pierce--;
            } else {
              gs.projectiles.splice(i, 1);
            }
            break;
          }
        }
      }
    } else {
      // Enemy projectile logic
      const m = gs.mothership;
      const anyPlayerAlive = Array.from(room.players.values()).some(p => p.alive);
      
      const playerScale = 1 + (Math.max(1, room.players.size) - 1) * 0.15;
      const hostScale = room.settings?.damageMultiplier || 1.0;
      let damage = (b.damage || 1) * playerScale * hostScale;
      
      if (dist(b, m) < m.radius + 10) {
        if (anyPlayerAlive) {
          // Invulnerable!
          gs.projectiles.splice(i, 1);
          continue;
        }
        
        if (m.shield > 0) {
          m.shield -= damage;
          if (m.shield < 0) {
            m.hull += m.shield;
            m.shield = 0;
          }
        } else {
          m.hull -= damage;
        }
        gs.projectiles.splice(i, 1);
        continue;
      }

      // Check player collisions
      let playerHit = false;
      for (const p of room.players.values()) {
        if (p.alive && dist(b, p) < p.radius + 5) {
          if (p.powerups.invincible > 0) {
             gs.projectiles.splice(i, 1);
             playerHit = true;
             break;
          }
          
          let pDamage = damage * (p.cursedDamageTaken || 1);
          if (p.shield > 0) {
            p.shield -= pDamage;
            if (p.shield < 0) {
              p.hull += p.shield;
              p.shield = 0;
            }
          } else {
            p.hull -= pDamage;
          }
          
          if (p.hull <= 0) {
            p.alive = false;
            p.respawnTimer = 180;
            p.hull = 0;
            p.lives--;
          }
          gs.projectiles.splice(i, 1);
          playerHit = true;
          break;
        }
      }
      if (playerHit) continue;
    }
  }
}
function updateDrones(room) {
  const gs = room.gameState;
  const m = gs.mothership;
  const anyPlayerAlive = Array.from(room.players.values()).some(p => p.alive);
  const isBossFight = gs.enemies.some(e => e.isBoss);
  
  gs.drones.forEach(d => {
    if (isBossFight) {
      // Free movement: Wander toward boss or asteroids
      let target = gs.enemies.find(e => e.isBoss) || gs.asteroids[0];
      if (target) {
        const a = angle(d, target);
        const targetDist = 150;
        const currentDist = dist(d, target);
        
        if (currentDist > targetDist) {
          d.x += Math.cos(a) * 2;
          d.y += Math.sin(a) * 2;
        } else {
          // Orbit target loosely
          d.x += Math.cos(a + Math.PI/2) * 1.5;
          d.y += Math.sin(a + Math.PI/2) * 1.5;
        }
      }
    } else {
      // Standard formation
      let orbitSpeed = d.orbitSpeed || 0.02;
      if (gs.hyperDriveBoost) orbitSpeed *= gs.hyperDriveBoost;
      d.angle = (d.angle || 0) + orbitSpeed;
      d.x = m.x + Math.cos(d.angle) * (d.dist || 100);
      d.y = m.y + Math.sin(d.angle) * (d.dist || 100);
    }
    
    if (d.fireCooldown > 0) d.fireCooldown--;
    
    if (d.fireCooldown <= 0 && gs.encounterType !== 'pvp') {
      let target = null;
      let nearestDist = 500;
      
      gs.enemies.forEach(e => {
        const dToE = dist(d, e);
        if (dToE < nearestDist) {
          nearestDist = dToE;
          target = e;
        }
      });
      
      if (!target) {
        gs.asteroids.forEach(a => {
          const dToA = dist(d, a);
          if (dToA < nearestDist) {
            nearestDist = dToA;
            target = a;
          }
        });
      }
      
      if (target) {
        const a = angle(d, target);
        const { spawnProjectile } = require('./entityFactory');
        const proj = spawnProjectile(d.x, d.y, a, true, 10);
        proj.damage = 10 + (gs.droneDamageBonus || 0);
        proj.fireRate = 30 - (gs.droneFireRateBonus || 0);
        if (gs.teamHomingBoost) proj.homing = 0.1;
        gs.projectiles.push(proj);
        d.fireCooldown = 30;
      }
    }
  });
}
// (Duplicate updateMothership removed)
function updatePickups(room) {
  const gs = room.gameState;
  
  for (let i = gs.pickups.length - 1; i >= 0; i--) {
    const p = gs.pickups[i];
    if (!p) continue; // Safety check if array was modified (e.g. wave ended)
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    
    if (p.x < 0 || p.x > GAME_WIDTH) p.vx *= -1;
    if (p.y < 0 || p.y > GAME_HEIGHT) p.vy *= -1;
    
    room.players.forEach(pPlayer => {
      if (pPlayer.alive) {
        const pickupRange = p.radius + pPlayer.radius + (pPlayer.pickupRange || 0) + (gs.teamPickupRange || 0);
        if (dist(p, pPlayer) < pickupRange) {
          if (p.type === 'health') {
            pPlayer.hull = Math.min(pPlayer.maxHull, pPlayer.hull + 20);
          } else if (p.type === 'team_health') {
            room.players.forEach(ally => {
              if (ally.alive) ally.hull = Math.min(ally.maxHull, ally.hull + 15);
            });
          } else if (p.type === 'mothership_health') {
            gs.mothership.hull = Math.min(gs.mothership.maxHull, gs.mothership.hull + 50);
          } else if (p.type === 'xp') {
            gs.teamXP += 25;
            if (gs.teamXP >= gs.teamXPNext) {
              gs.teamLevel++;
              gs.teamXP -= gs.teamXPNext;
              gs.teamXPNext = Math.floor(gs.teamXPNext * 1.6);
              gs.pendingLevelUps = (gs.pendingLevelUps || 0) + 1;
              room.players.forEach(ally => {
                if (ally.alive) ally.hull = Math.min(ally.maxHull, ally.hull + 10);
              });
            }
          } else if (p.type === 'gold') {
            const salvageScale = gs.encounterType === 'salvage' ? Math.floor(1 + gs.wave * 0.2) : 1;
            const goldAmount = 25 * salvageScale;
            p.goldAmount = goldAmount; // For the text map
            room.players.forEach(ally => ally.gold += goldAmount); // Shared gold
            if (gs.encounterType === 'salvage') {
              gs.salvageCollected = (gs.salvageCollected || 0) + 1;
              // Check if salvage goal met (e.g. 10 items)
              if (gs.salvageCollected >= 10) {
                const { endWave } = require('./waveManager');
                endWave(room);
              }
            }
          } else if (p.type === 'rapidFire') {
            pPlayer.powerups.rapidFire = 600;
          } else if (p.type === 'invincible') {
            pPlayer.powerups.invincible = 600;
          } else if (p.type === 'doubleGold') {
            pPlayer.powerups.doubleGold = 600;
          } else if (p.type === 'turbo') {
            pPlayer.powerups.turbo = 600;
          } else if (p.type === 'megaShot') {
            pPlayer.powerups.megaShot = 400;
          }
          
          if (room.broadcastToRoom) {
            let textMap = {
              'health': '+20 HULL',
              'team_health': '+15 TEAM HULL',
              'mothership_health': '+50 BASE HULL',
              'xp': '+25 XP',
              'gold': `+${p.goldAmount || 25} GOLD`,
              'rapidFire': 'RAPID FIRE!',
              'invincible': 'INVINCIBLE!',
              'doubleGold': 'DOUBLE GOLD!',
              'turbo': 'TURBO BOOST!',
              'megaShot': 'MEGA SHOT!'
            };
            room.broadcastToRoom({ type: 'pickup_text', x: p.x, y: p.y, text: textMap[p.type] || p.type, playerId: pPlayer.id });
          }
          p.life = 0;
        }
      }
    });
    
    if (p.life <= 0) {
      gs.pickups.splice(i, 1);
    }
  }
}
function updateBossAI(boss, room) {
  const gs = room.gameState;
  const m = gs.mothership;
  
  if (boss.aiType === 'boss_tactical') {
    // Movement: Smooth vertical patrol with slight horizontal sway
    boss.y += (boss.patrolDir || 1) * 2;
    if (boss.y > 650) boss.patrolDir = -1;
    if (boss.y < 250) boss.patrolDir = 1;
    boss.x = 1350 + Math.sin(gs.waveTimer * 0.02) * 50;

    boss.phaseTimer = (boss.phaseTimer || 0) + 1;
    if (boss.phaseTimer > 180) { // Phase change every 3 seconds
      boss.phaseTimer = 0;
      boss.weaponPhase = ((boss.weaponPhase || 0) + 1) % 3;
    }

    boss.fireCooldown = (boss.fireCooldown || 0) - 1;
    if (boss.fireCooldown <= 0) {
      // Targeted selection
      let target = room.players.values().next().value;
      room.players.forEach(p => { if (p.alive) target = p; });
      if (!target || !target.alive) target = m;

      const a = angle(boss, target);
      boss.angle = a;

      const { spawnProjectile } = require('./entityFactory');
      if (boss.weaponPhase === 0) {
        // Pattern 1: Targeted Triple Pulse (Dodgeable)
        for (let i = -1; i <= 1; i++) {
          const p = spawnProjectile(boss.x, boss.y, a + i * 0.15, false, 10);
          p.radius = 15;
          gs.projectiles.push(p);
        }
        boss.fireCooldown = 45;
      } else if (boss.weaponPhase === 1) {
        // Pattern 2: Circular Nova (With Gaps)
        for (let i = 0; i < 12; i++) {
          if (i % 4 === 0) continue; // Create safety gaps
          const p = spawnProjectile(boss.x, boss.y, i * Math.PI / 6, false, 7);
          gs.projectiles.push(p);
        }
        boss.fireCooldown = 90;
      } else {
        // Pattern 3: Slow Homing Torpedo (Telegraphed)
        const p = spawnProjectile(boss.x, boss.y, a, false, 5);
        p.type = 'homing';
        p.homing = 0.05;
        p.life = 300;
        p.radius = 20;
        p.color = '#e74c3c';
        gs.projectiles.push(p);
        boss.fireCooldown = 120;
      }
    }
  }
}

function isPointOnLine(px, py, x1, y1, x2, y2, tolerance) {
  const lineDist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const distToLine = Math.abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1) / lineDist;
  
  if (distToLine > tolerance) return false;
  
  // Check if point is within the segment bounds
  const dotProduct = (px - x1) * (x2 - x1) + (py - y1) * (y2 - y1);
  if (dotProduct < 0) return false;
  
  const squaredLength = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (dotProduct > squaredLength) return false;
  
  return true;
}

module.exports = {
  updatePlayer,
  updateMothership,
  updateEnemies,
  updateAsteroids,
  updateProjectiles,
  updateDrones,
  updatePickups
};
