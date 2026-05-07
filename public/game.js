// Aegis Command - Multiplayer Client Game Logic

// Game Constants
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;

// Game State
let ws = null;
let gameState = null;
let playerId = null;
let roomCode = null;
let isHost = false;
let compendiumData = [];
let unlockedAchievements = JSON.parse(localStorage.getItem('aegis_achievements') || '[]');

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Input handling
const keys = { w: false, a: false, s: false, d: false, space: false };
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;

// UI Elements
const lobby = document.getElementById('lobby');
const joinRoomForm = document.getElementById('joinRoomForm');
const roomInfo = document.getElementById('roomInfo');
const upgradeMenu = document.getElementById('upgradeMenu');
const gameOverScreen = document.getElementById('gameOver');
const navigationMenu = document.getElementById('navigationMenu');
const nodeOptions = document.getElementById('nodeOptions');

// Initialize canvas size
function resizeCanvas() {
    const container = document.getElementById('gameContainer');
    const aspectRatio = GAME_WIDTH / GAME_HEIGHT;
    
    let width = container.clientWidth;
    let height = container.clientHeight;
    
    if (width / height > aspectRatio) {
        width = height * aspectRatio;
    } else {
        height = width / aspectRatio;
    }
    
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
}

// WebSocket connection
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('Connected to server');
        
        // Setup UI event listeners
        document.getElementById('toggleStatusBtn')?.addEventListener('click', () => {
            toggleStatusPanel();
        });

        // Hotkey for Status Panel
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' || e.key === '`') {
                e.preventDefault();
                toggleStatusPanel();
            }
        });

        // Check if we should auto-join a room from URL
        const urlParams = new URLSearchParams(window.location.search);
        const autoRoomCode = urlParams.get('room');
        if (autoRoomCode) {
            document.getElementById('roomCode').value = autoRoomCode;
            joinRoom();
        }
        
        // Start ping interval
        if (window.pingInterval) clearInterval(window.pingInterval);
        window.pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping', clientTime: Date.now() }));
            }
        }, 2000);
    };
    
    ws.onmessage = (event) => {
        // Prevent massive JSON parsing queue lockup when tabbed out
        // We only drop 'state' messages, keeping important events like 'upgrade' or 'gameover'
        if (document.hidden && event.data.includes('"type":"state"')) {
            return;
        }
        
        const msg = JSON.parse(event.data);
        handleMessage(msg);
    };
    
    ws.onclose = () => {
        console.log('Disconnected from server');
        setTimeout(() => connectWebSocket(), 3000);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Message handling
function handleMessage(msg) {
    switch (msg.type) {
        case 'room_created':
            handleRoomCreated(msg);
            break;
        case 'room_joined':
            handleRoomJoined(msg);
            break;
        case 'player_joined':
            handlePlayerJoined(msg);
            break;
        case 'player_left':
            handlePlayerLeft(msg);
            break;
        case 'game_started':
            handleGameStarted();
            break;
        case 'state':
            gameState = msg;
            break;
        case 'upgrade':
            handleUpgradeMenu(msg);
            break;
        case 'upgrade_applied':
            handleUpgradeApplied(msg);
            break;
        case 'upgrade_rerolled':
            handleUpgradeRerolled(msg);
            break;
        case 'upgrade_pinned':
            handleUpgradePinned(msg);
            break;
        case 'upgrade_skipped':
            handleUpgradeSkipped(msg);
            break;
        case 'navigation_options':
            handleNavigationOptions(msg);
            break;
        case 'warp_start':
            handleWarpStart(msg);
            break;
        case 'upgrade_timer_start':
            handleUpgradeTimerStart(msg);
            break;
        case 'upgrade_timer_update':
            handleUpgradeTimerUpdate(msg);
            break;
        case 'player_upgrade_selected':
            handlePlayerUpgradeSelected(msg);
            break;
        case 'achievement_unlocked':
            handleAchievementUnlocked(msg);
            break;
        case 'compendium_data':
            compendiumData = msg.upgrades;
            renderCompendium();
            break;
        case 'announcement':
            handleAnnouncement(msg);
            break;
        case 'gameover':
            handleGameOver(msg);
            break;
        case 'error':
            handleError(msg);
            break;
        case 'super_upgrade':
            handleSuperUpgradeMenu(msg);
            break;
        case 'pong':
            const latency = Date.now() - msg.clientTime;
            const debugPing = document.getElementById('debugPing');
            if (debugPing) debugPing.textContent = latency + 'ms';
            break;
    }
}

// Room management
function createRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        alert("You MUST enter a name to create a room.");
        return;
    }
    const password = document.getElementById('roomPassword').value;
    const maxPlayersInput = document.getElementById('roomMaxPlayers');
    const maxPlayers = maxPlayersInput ? parseInt(maxPlayersInput.value, 10) : 4;
    
    // Advanced settings
    const waveDurationInput = document.getElementById('waveDuration');
    const damageMultiplierInput = document.getElementById('damageMultiplier');
    const goldMultiplierInput = document.getElementById('goldMultiplier');
    
    ws.send(JSON.stringify({
        type: 'create_room',
        password: password,
        playerName: playerName,
        maxPlayers: maxPlayers,
        settings: {
            waveDuration: waveDurationInput ? parseInt(waveDurationInput.value, 10) : 60,
            damageMultiplier: damageMultiplierInput ? parseFloat(damageMultiplierInput.value) : 1.0,
            goldMultiplier: goldMultiplierInput ? parseFloat(goldMultiplierInput.value) : 1.0
        }
    }));
}

function joinRoom() {
    const roomCodeInput = document.getElementById('roomCode').value.toUpperCase();
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!playerName) {
        alert("You MUST enter a name to join a room.");
        return;
    }
    const password = document.getElementById('roomPassword').value;
    
    if (roomCodeInput.length !== 4) {
        alert('Please enter a valid 4-letter room code');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'join_room',
        roomCode: roomCodeInput,
        playerName: playerName,
        password: password
    }));
}

function leaveRoom() {
    if (ws) {
        ws.close();
    }
    location.reload();
}

function startGame() {
    if (isHost) {
        ws.send(JSON.stringify({ type: 'start_game' }));
    }
}

// Room event handlers
function handleRoomCreated(msg) {
    roomCode = msg.roomCode;
    playerId = msg.playerId;
    isHost = true;
    
    if (msg.isSinglePlayer) {
        // Single player mode - skip lobby
        lobby.classList.add('hidden');
        handleGameStarted();
        return;
    }
    
    // Multiplayer mode - show lobby
    lobby.classList.remove('hidden');
    joinRoomForm.classList.add('hidden');
    roomInfo.classList.remove('hidden');
    
    document.getElementById('currentRoomCodeDisplay').textContent = roomCode;
    const link = document.getElementById('shareableLink');
    if (link) {
        link.href = msg.shareableLink;
        link.textContent = msg.shareableLink;
    }
    
    updatePlayerList(msg.players);
    
    joinRoomForm.classList.add('hidden');
    roomInfo.classList.remove('hidden');
    document.getElementById('startGameBtn').style.display = 'block';
}

function handleRoomJoined(msg) {
    roomCode = msg.roomCode;
    playerId = msg.playerId;
    
    document.getElementById('currentRoomCodeDisplay').textContent = roomCode;
    updatePlayerList(msg.players);
    
    joinRoomForm.classList.add('hidden');
    roomInfo.classList.remove('hidden');
    
    // Check if we're the host (first player)
    isHost = msg.players[0]?.id === playerId;
    document.getElementById('startGameBtn').style.display = isHost ? 'block' : 'none';
}

function copyRoomLink() {
    const link = document.getElementById('shareableLink').textContent;
    navigator.clipboard.writeText(link).then(() => {
        const copyBtn = document.querySelector('button[onclick="copyRoomLink()"]');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        copyBtn.style.background = '#2ecc71';
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = '';
        }, 2000);
    });
}

function handlePlayerJoined(msg) {
    updatePlayerList([...Array.from(gameState?.p || []), msg.player]);
}

function handlePlayerLeft(msg) {
    // Player left - will be handled in next state update
}

function handleGameStarted() {
    lobby.classList.add('hidden');
    // Hide any modals if open
    hideCompendium();
    hideAchievements();
    gameLoop();
}

function updatePlayerList(players) {
    const playerList = document.getElementById('roomPlayerList');
    playerList.innerHTML = '';
    
    players.forEach(player => {
        const li = document.createElement('li');
        li.style.color = player.color;
        li.textContent = player.name || `Player ${player.id.slice(-4)}`;
        playerList.appendChild(li);
    });
}

// Game loop
function gameLoop() {
    if (!gameState) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Draw game entities
    drawGame();
    
    // Update UI
    updateUI();

    // Update upgrade status if menu is open
    if (!upgradeMenu.classList.contains('hidden')) {
        updateUpgradeReadyStatus();
    }
    
    // Render escort target if applicable
    if (gameState.w && gameState.w.encounterType === 'escort' && gameState.w.targetX) {
        ctx.save();
        
        // Draw animated path from mothership to jump gate
        if (gameState.m) {
            ctx.beginPath();
            ctx.moveTo(gameState.m.x, gameState.m.y);
            ctx.lineTo(gameState.w.targetX, gameState.w.targetY);
            ctx.strokeStyle = 'rgba(52, 152, 219, 0.3)';
            ctx.lineWidth = 4;
            ctx.setLineDash([15, 15]);
            ctx.lineDashOffset = -(Date.now() / 50); // Scrolling dash effect
            ctx.stroke();
            
            // Draw progress text halfway
            const totalDist = Math.hypot(gameState.w.targetX - (GAME_WIDTH / 2), gameState.w.targetY - (GAME_HEIGHT / 2));
            const currDist = Math.hypot(gameState.w.targetX - gameState.m.x, gameState.w.targetY - gameState.m.y);
            const progress = Math.max(0, Math.min(1, 1 - (currDist / totalDist)));
            
            const midX = (gameState.m.x + gameState.w.targetX) / 2;
            const midY = (gameState.m.y + gameState.w.targetY) / 2;
            
            ctx.setLineDash([]);
            ctx.fillStyle = '#3498db';
            ctx.font = 'bold 14px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(`JUMP DISTANCE: ${Math.floor(currDist)}m`, midX, midY - 20);
            ctx.fillText(`[ ${Math.floor(progress * 100)}% ]`, midX, midY);
        }

        ctx.translate(gameState.w.targetX, gameState.w.targetY);
        
        // Draw jump gate icon
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.stroke();
        
        // Outer rotating ring
        ctx.setLineDash([15, 10]);
        ctx.beginPath();
        ctx.arc(0, 0, 60, Date.now() / 500, Date.now() / 500 + Math.PI * 2);
        ctx.stroke();
        
        // Inner fast rotating ring
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, 50, -(Date.now() / 200), -(Date.now() / 200) + Math.PI * 2);
        ctx.stroke();
        
        // Inner portal glow
        const glowPulse = (Math.sin(Date.now() / 300) + 1) / 2;
        ctx.fillStyle = `rgba(52, 152, 219, ${0.1 + glowPulse * 0.2})`;
        ctx.beginPath();
        ctx.arc(0, 0, 38, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.setLineDash([]);
        ctx.fillStyle = '#3498db';
        ctx.font = 'bold 14px Orbitron';
        ctx.textAlign = 'center';
        ctx.fillText('JUMP GATE', 0, -80);
        
        ctx.restore();
    }
    
    requestAnimationFrame(gameLoop);
}

// Drawing functions
function drawGame() {
    if (!gameState) return;
    
    // Draw pickups
    gameState.c?.forEach(pickup => {
        ctx.save();
        ctx.translate(pickup.x, pickup.y);
        
        if (pickup.type === 'xp') {
            ctx.fillStyle = '#f39c12';
            ctx.shadowColor = '#f39c12';
        } else if (pickup.type === 'gold') {
            ctx.fillStyle = '#f1c40f'; // Yellow
            ctx.shadowColor = '#f1c40f';
        } else if (pickup.type === 'health') {
            ctx.fillStyle = '#2ecc71'; // Green
            ctx.shadowColor = '#2ecc71';
        } else if (pickup.type === 'team_health') {
            ctx.fillStyle = '#1abc9c'; // Teal
            ctx.shadowColor = '#1abc9c';
        } else if (pickup.type === 'mothership_health') {
            ctx.fillStyle = '#3498db'; // Blue
            ctx.shadowColor = '#3498db';
        } else {
            ctx.fillStyle = '#9b59b6'; // Default Purple
            ctx.shadowColor = '#9b59b6';
        }
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner circle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    });
    
    // Draw asteroids
    gameState.a?.forEach(asteroid => {
        ctx.save();
        ctx.translate(asteroid.x, asteroid.y);
        ctx.rotate(asteroid.rot);
        
        ctx.strokeStyle = '#7f8c8d';
        ctx.fillStyle = '#34495e';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        asteroid.verts.forEach((vert, i) => {
            if (i === 0) {
                ctx.moveTo(vert.x, vert.y);
            } else {
                ctx.lineTo(vert.x, vert.y);
            }
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    });
    
    // Draw enemies
    gameState.e?.forEach(enemy => {
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(enemy.angle);
        
        ctx.fillStyle = enemy.diamond ? '#e67e22' : '#e74c3c';
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 2;
        
        if (enemy.diamond) {
            // Diamond shape
            ctx.beginPath();
            ctx.moveTo(0, -enemy.radius);
            ctx.lineTo(enemy.radius, 0);
            ctx.lineTo(0, enemy.radius);
            ctx.lineTo(-enemy.radius, 0);
            ctx.closePath();
        } else {
            // Triangle shape
            ctx.beginPath();
            ctx.moveTo(0, -enemy.radius);
            ctx.lineTo(enemy.radius, enemy.radius);
            ctx.lineTo(-enemy.radius, enemy.radius);
            ctx.closePath();
        }
        
        ctx.fill();
        ctx.stroke();
        
        // Health bar
        if (enemy.hull < enemy.maxHull) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(-20, -enemy.radius - 10, 40, 4);
            ctx.fillStyle = '#e74c3c';
            ctx.fillRect(-20, -enemy.radius - 10, 40 * (enemy.hull / enemy.maxHull), 4);
        }
        
        ctx.restore();
    });
    
    // Draw pickups
    gameState.c?.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        
        let color = '#f1c40f'; // Default gold
        if (p.type === 'health') color = '#e74c3c';
        else if (p.type === 'rapidFire') color = '#3498db';
        else if (p.type === 'invincible') color = '#9b59b6';
        else if (p.type === 'doubleGold') color = '#e67e22';
        
        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner white dot for "sparkle"
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-2, -2, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    });
    
    // Draw drones
    gameState.d?.forEach(drone => {
        ctx.save();
        ctx.translate(drone.x, drone.y);
        
        ctx.fillStyle = drone.cooldown > 0 ? '#34495e' : '#9b59b6';
        ctx.strokeStyle = '#8e44ad';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Cooldown indicator
        if (drone.cooldown > 0) {
            ctx.strokeStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, (drone.cooldown / 60) * Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.restore();
    });
    
    // Draw mothership
    if (gameState.m) {
        ctx.save();
        ctx.translate(gameState.m.x, gameState.m.y);
        
        // Shield
        if (gameState.m.shield > 0) {
            ctx.strokeStyle = `rgba(155, 89, 182, ${gameState.m.shield / gameState.m.shieldMax})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, (gameState.m.radius || 60) + 10, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Main body
        ctx.fillStyle = '#3498db';
        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.arc(0, 0, (gameState.m.radius || 60), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Rotating ring
        ctx.rotate(gameState.m.ringAngle);
        ctx.strokeStyle = '#5dade2';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, (gameState.m.radius || 60) + 5, i * Math.PI / 4, i * Math.PI / 4 + Math.PI / 8);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    // Draw Merchants
    gameState.merchants?.forEach(merch => {
        ctx.save();
        ctx.translate(merch.x, merch.y);
        
        // Glow
        const pulse = (Math.sin(Date.now() / 400) + 1) / 2;
        ctx.shadowBlur = 15 + pulse * 10;
        ctx.shadowColor = '#f39c12';
        
        // Outer ring
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.stroke();
        
        // Inner rotating bits
        ctx.rotate(Date.now() / 1000);
        ctx.fillStyle = '#f39c12';
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.fillRect(30, -5, 15, 10);
        }
        
        // Center core
        ctx.rotate(-Date.now() / 1000);
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        
        // Icon/Text
        ctx.fillStyle = '#000';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, 0);
        
        // Label
        ctx.fillStyle = '#f39c12';
        ctx.font = 'bold 14px Orbitron';
        ctx.fillText('MERCHANT', 0, 60);
        ctx.font = '10px Arial';
        ctx.fillText(merch.upgrade.name, 0, 75);
        
        ctx.restore();
    });
    
    // Draw players
    gameState.p?.forEach(player => {
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(player.angle);
        
        // Shield
        if (player.shield > 0) {
            ctx.strokeStyle = `rgba(155, 89, 182, ${player.shield / player.shieldMax})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, (player.radius || 20) + 5, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Ship body
        ctx.fillStyle = player.color;
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        
        const pr = (player.radius || 20);
        
        // Hyper Drive Visual
        if (gameState.hyperDriveBoost && player.alive) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#3498db';
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, pr + 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(pr, 0);
        ctx.lineTo(-pr, -pr * 0.7);
        ctx.lineTo(-pr * 0.5, 0);
        ctx.lineTo(-pr, pr * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
        
        // Draw invincibility shield
        if (player.powerups && player.powerups.invincible > 0) {
            ctx.save();
            ctx.translate(player.x, player.y);
            ctx.strokeStyle = '#9b59b6';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, (player.radius || 20) + 10, 0, Math.PI * 2);
            ctx.stroke();
            
            // Pulsing effect
            const pulse = (Math.sin(Date.now() / 100) + 1) / 2;
            ctx.strokeStyle = `rgba(155, 89, 182, ${pulse * 0.5})`;
            ctx.beginPath();
            ctx.arc(0, 0, (player.radius || 20) + 15, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        
        // Player name
        if (player.alive) {
            ctx.fillStyle = player.color;
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(player.name || `Player ${player.id.slice(-4)}`, player.x, player.y - pr - 10);
        }
    });
    
    // Draw projectiles
    gameState.b?.forEach(bullet => {
        ctx.save();
        ctx.translate(bullet.x, bullet.y);
        
        const size = 3 * (bullet.bulletSize || 1);
        
        // Optimization: Skip shadows for regular small bullets to save CPU/GPU
        if (size > 5 || bullet.type === 'laser' || bullet.type === 'homing_missile') {
            if (bullet.friendly) {
                ctx.fillStyle = '#f39c12';
                ctx.shadowColor = '#f39c12';
            } else {
                ctx.fillStyle = '#e74c3c';
                ctx.shadowColor = '#e74c3c';
            }
            ctx.shadowBlur = 5;
        } else {
            ctx.fillStyle = bullet.friendly ? '#f39c12' : '#e74c3c';
            ctx.shadowBlur = 0;
        }
        
        if (bullet.angle !== undefined) {
            ctx.rotate(bullet.angle);
        }
        
        if (bullet.type === 'laser') {
            const range = bullet.range || 500;
            const thickness = (bullet.width || 2) * 0.8;
            const alpha = (bullet.life / (bullet.maxLife || 20));
            
            ctx.save();
            ctx.globalAlpha = alpha;
            
            // Outer tight glow (Cyan)
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#00f2ff';
            ctx.strokeStyle = 'rgba(0, 242, 255, 0.6)';
            ctx.lineWidth = thickness * 1.5;
            ctx.lineCap = 'butt';
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(range, 0);
            ctx.stroke();

            // Sharp core (Pure White)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = thickness * 0.4;
            ctx.shadowBlur = 0;
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(range, 0);
            ctx.stroke();

            // Needle tip (Tiny sharp point)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(range, 0, thickness * 0.3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        } else if (bullet.type === 'homing_missile') {
            const length = size * 3;
            const width = size * 1.2;
            
            ctx.save();
            // Exhaust Glow
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#f39c12';
            ctx.fillStyle = 'rgba(243, 156, 18, 0.6)';
            ctx.beginPath();
            ctx.moveTo(-length * 0.5, 0);
            ctx.lineTo(-length * 1.8, -width * 0.6);
            ctx.lineTo(-length * 1.8, width * 0.6);
            ctx.fill();

            // Missile Body (Sleek Metal)
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath();
            ctx.moveTo(length * 0.6, 0); // Tip
            ctx.lineTo(-length * 0.4, width * 0.6);
            ctx.lineTo(-length * 0.4, -width * 0.6);
            ctx.closePath();
            ctx.fill();
            
            // Nose Cone (Danger Red)
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(length * 0.6, 0);
            ctx.lineTo(length * 0.2, width * 0.3);
            ctx.lineTo(length * 0.2, -width * 0.3);
            ctx.fill();
            
            ctx.restore();
        } else if (bullet.type === 'orbital') {
            const alpha = bullet.life / 20;
            const radius = bullet.radius || 150;
            ctx.strokeStyle = `rgba(52, 152, 219, ${alpha})`;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(0, 0, radius * (1 - alpha), 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = `rgba(52, 152, 219, ${alpha * 0.2})`;
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Render explosion if marked
        if (bullet.exploded) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#f39c12';
            
            // Outer blast
            ctx.fillStyle = 'rgba(231, 76, 60, 0.6)';
            ctx.beginPath();
            ctx.arc(0, 0, 60, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner core
            ctx.fillStyle = 'rgba(241, 196, 15, 0.9)'; // Bright yellow
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fill();
            
            // White flash
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowBlur = 0; // Reset
        }
        
        ctx.restore();
    });
}

// UI updates
function updateUI() {
    if (!gameState) return;
    
    // Update player health
    const player = gameState.p?.find(p => p.id === playerId);
    if (player) {
        const healthPercent = (player.hull / player.maxHull) * 100;
        const healthFill = document.getElementById('playerHealth');
        if (healthFill) healthFill.style.width = healthPercent + '%';
        
        const shieldPercent = player.shieldMax > 0 ? (player.shield / player.shieldMax) * 100 : 0;
        const shieldFill = document.getElementById('playerShield');
        if (shieldFill) shieldFill.style.width = shieldPercent + '%';
    }
    
    // Update mothership health
    if (gameState.m) {
        const healthPercent = (gameState.m.hull / gameState.m.maxHull) * 100;
        const mHealthFill = document.getElementById('mothershipHealth');
        if (mHealthFill) mHealthFill.style.width = healthPercent + '%';
        
        const mHullText = document.getElementById('mothershipHullText');
        if (mHullText) mHullText.textContent = `${Math.floor(gameState.m.hull)}/${gameState.m.maxHull}`;
        
        const shieldPercent = (gameState.m.shield / (gameState.m.shieldMax || 1)) * 100;
        const mShieldFill = document.getElementById('mothershipShield');
        if (mShieldFill) mShieldFill.style.width = (gameState.m.shieldMax > 0 ? shieldPercent : 0) + '%';
    }

    // Update Boss HUD
    const bossHud = document.getElementById('bossHud');
    const boss = gameState.e?.find(e => e.isBoss);
    if (boss && bossHud) {
        bossHud.classList.remove('hidden');
        const bossHealth = document.getElementById('bossHealth');
        if (bossHealth) {
            const percent = (boss.hull / boss.maxHull) * 100;
            bossHealth.style.width = Math.max(0, percent) + '%';
        }
    } else if (bossHud) {
        bossHud.classList.add('hidden');
    }
    
    // Update wave display
    if (gameState.w) {
        const waveDisplay = document.getElementById('waveDisplay');
        if (waveDisplay) waveDisplay.textContent = `WAVE ${gameState.w.wave}`;
        
        const encounterType = document.getElementById('encounterType');
        if (encounterType) {
            let objectiveText = gameState.w.encounterType === 'defense' ? 'DEFENSE WAVE' :
                               gameState.w.encounterType === 'escort' ? 'ESCORT MISSION' : 'SALVAGE FIELD';
            
            if (gameState.w.encounterType === 'salvage' && gameState.salvageCollected !== undefined) {
                objectiveText += ` (${gameState.salvageCollected}/10)`;
            }
            encounterType.textContent = objectiveText;
        }
    }
    
    // Update Gold
    const displayGold = player ? player.gold : (gameState.gold || 0);
    const goldDisplay = document.getElementById('xpDisplay');
    if (goldDisplay) goldDisplay.textContent = `GOLD: ${displayGold}`;
    
    // Update Wave Progress & Team XP
    if (gameState.w) {
        const wavePercent = (gameState.w.timer / gameState.w.duration) * 100;
        const waveFill = document.getElementById('waveProgress');
        if (waveFill) {
            waveFill.style.width = Math.min(100, wavePercent) + '%';
            
            // Add numeric countdown if wanted
            const secondsLeft = Math.ceil((gameState.w.duration - gameState.w.timer) / 60);
            if (secondsLeft >= 0) {
                const waveDisplay = document.getElementById('waveDisplay');
                if (waveDisplay) waveDisplay.textContent = `WAVE ${gameState.w.wave} (${secondsLeft}s)`;
            }
        }
        
        // Team XP Bar
        const teamLevel = document.getElementById('teamLevel');
        if (teamLevel) teamLevel.textContent = gameState.w.teamLevel || 1;
        
        const xpPercent = ((gameState.w.teamXP || 0) / (gameState.w.teamXPNext || 100)) * 100;
        const xpFill = document.getElementById('teamXPBar');
        if (xpFill) xpFill.style.width = xpPercent + '%';
    }
    // Update player list and vitals
    if (gameState.p) {
        const playerList = document.getElementById('playerList');
        if (playerList) {
            playerList.innerHTML = gameState.p.map(p => 
                `<div style="color: ${p.color}">${p.name || `Player ${p.id.slice(-4)}`}</div>`
            ).join('');
        }

        const vitalsList = document.getElementById('vitalsList');
        if (vitalsList) {
            vitalsList.innerHTML = gameState.p.map(p => {
                const hPercent = (p.hull / p.maxHull) * 100;
                const sPercent = p.shieldMax > 0 ? (p.shield / p.shieldMax) * 100 : 0;
                return `
                    <div style="margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; font-size: 10px; color: ${p.color}; margin-bottom: 2px;">
                            <span>${p.name || 'Pilot'} [LIVES: ${p.lives || 0}]</span>
                            <span>${p.alive ? Math.floor(p.hull) + ' HP' : '<span style="color:#e74c3c">DESTROYED</span>'}</span>
                        </div>
                        <div style="height: 3px; background: rgba(255,255,255,0.1); border-radius: 1px; overflow: hidden;">
                            <div style="height: 100%; width: ${p.alive ? hPercent : 0}%; background: ${p.color};"></div>
                        </div>
                        ${p.shieldMax > 0 ? `
                        <div style="height: 2px; background: rgba(255,255,255,0.05); border-radius: 1px; overflow: hidden; margin-top: 1px;">
                            <div style="height: 100%; width: ${sPercent}%; background: #3498db;"></div>
                        </div>` : ''}
                    </div>
                `;
            }).join('');
        }
    }

    // Update PVP Scoreboard
    const pvpBoard = document.getElementById('pvpScoreboard');
    if (gameState.w && gameState.w.encounterType === 'pvp' && gameState.pvpScores) {
        pvpBoard.classList.remove('hidden');
        const pvpScoresList = document.getElementById('pvpScoresList');
        pvpScoresList.innerHTML = Object.entries(gameState.pvpScores).map(([id, score]) => {
            const p = gameState.p.find(player => player.id === id);
            const name = p ? p.name : 'Unknown';
            const color = p ? p.color : '#fff';
            return `<div style="color: ${color}; display: flex; justify-content: space-between;"><span>${name}</span> <span>${score} KILLS</span></div>`;
        }).join('');
        
        const encounterType = document.getElementById('encounterType');
        if (encounterType) encounterType.textContent = 'FREE FOR ALL ARENA';
    } else {
        pvpBoard.classList.add('hidden');
    }

    // Auto-hide upgrade menu if not in UPGRADE phase
    if (gameState.currentPhase !== 'UPGRADE' && !upgradeMenu.classList.contains('hidden')) {
        console.log(`[UI] Hiding upgrade menu (Phase: ${gameState.currentPhase})`);
        upgradeMenu.classList.add('hidden');
        lastUpgradeMsg = null;
    }
    
    // Auto-show upgrade menu if in UPGRADE phase but hidden
    if (gameState.currentPhase === 'UPGRADE' && upgradeMenu.classList.contains('hidden') && lastUpgradeMsg) {
        console.log('[UI] Showing upgrade menu (Force Restore)');
        upgradeMenu.classList.remove('hidden');
    }
    
    // Auto-hide navigation menu if not in NAVIGATION phase
    if (gameState.currentPhase !== 'NAVIGATION' && !navigationMenu.classList.contains('hidden')) {
        console.log(`[UI] Hiding navigation menu (Phase: ${gameState.currentPhase})`);
        navigationMenu.classList.add('hidden');
    }

    // Auto-show navigation menu if in NAVIGATION phase but hidden
    if (gameState.currentPhase === 'NAVIGATION' && navigationMenu.classList.contains('hidden') && gameState.navigationOptions) {
        console.log('[UI] Showing navigation menu (Force Restore)');
        handleNavigationOptions({
            options: gameState.navigationOptions,
            votes: gameState.nodeVotes || {}
        });
    }
    
    // Update Debug Monitor
    const debugPhase = document.getElementById('debugPhase');
    if (debugPhase) debugPhase.textContent = gameState.currentPhase;
    
    const debugEntities = document.getElementById('debugEntities');
    if (debugEntities) {
        const count = (gameState.p?.length || 0) + 
                     (gameState.e?.length || 0) + 
                     (gameState.a?.length || 0) + 
                     (gameState.b?.length || 0);
        debugEntities.textContent = count;
    }
    
    // Simple FPS calculation
    if (!window._lastLoopTime) window._lastLoopTime = performance.now();
    const now = performance.now();
    const frameTime = now - window._lastLoopTime;
    window._lastLoopTime = now;
    const fps = Math.round(1000 / Math.max(1, frameTime));
    const debugFPS = document.getElementById('debugFPS');
    if (debugFPS) debugFPS.textContent = fps;

    // Real-time update of status panel if visible
    const statusPanel = document.getElementById('statusPanel');
    if (statusPanel && !statusPanel.classList.contains('hidden')) {
        updateStatusPanel();
    }

    // Merchant Proximity Check
    const merchantPanel = document.getElementById('merchantPanel');
    if (gameState.merchants && player) {
        let nearestMerch = null;
        let minDist = 120; // Interaction radius
        
        gameState.merchants.forEach(m => {
            const d = Math.hypot(m.x - player.x, m.y - player.y);
            if (d < minDist) {
                minDist = d;
                nearestMerch = m;
            }
        });

        if (nearestMerch) {
            showMerchantUI(nearestMerch, player);
        } else if (merchantPanel) {
            merchantPanel.classList.add('hidden');
        }

        // Mothership Proximity Check for Jumping
        const jumpPanel = document.getElementById('jumpPanel') || createJumpPanel();
        const distToMothership = Math.hypot(gameState.m.x - player.x, gameState.m.y - player.y);
        
        if (gameState.currentPhase === 'COMBAT' && gameState.w && gameState.w.encounterType === 'merchant' && distToMothership < 150) {
            jumpPanel.classList.remove('hidden');
            updateJumpUI();
        } else {
            jumpPanel.classList.add('hidden');
        }
    } else if (merchantPanel) {
        merchantPanel.classList.add('hidden');
    }
}

function createJumpPanel() {
    const panel = document.createElement('div');
    panel.id = 'jumpPanel';
    panel.className = 'interaction-panel hidden';
    panel.style.position = 'absolute';
    panel.style.bottom = '150px';
    panel.style.left = '50%';
    panel.style.transform = 'translateX(-50%)';
    panel.style.textAlign = 'center';
    panel.innerHTML = `
        <div class="panel-header">MOTHERSHIP SYSTEMS</div>
        <div id="jumpStatus" style="margin: 10px 0; color: #3498db; font-size: 14px;">READY FOR JUMP?</div>
        <button id="readyJumpBtn" class="btn btn-primary" style="width: 200px;">READY TO JUMP</button>
    `;
    document.body.appendChild(panel);
    return panel;
}

function updateJumpUI() {
    const readyBtn = document.getElementById('readyJumpBtn');
    const me = gameState.p?.find(p => p.id === playerId);
    const isReady = me && me.merchantReady;
    
    if (readyBtn) {
        readyBtn.textContent = isReady ? 'WAITING FOR TEAM...' : 'SIGNAL READY';
        readyBtn.className = `btn ${isReady ? 'btn-secondary' : 'btn-primary'}`;
        readyBtn.onclick = () => {
            ws.send(JSON.stringify({ type: 'merchant_ready' }));
        };
    }
}

function showMerchantUI(merch, player) {
    const panel = document.getElementById('merchantPanel');
    if (!panel) return;
    
    panel.classList.remove('hidden');
    document.getElementById('merchUpgradeName').textContent = merch.upgrade.name;
    document.getElementById('merchUpgradeDesc').textContent = merch.upgrade.desc;
    
    const cost = merch.upgrade.cost;
    const costEl = document.getElementById('merchUpgradeCost');
    costEl.textContent = `Cost: ${cost} GOLD`;
    costEl.style.color = player.gold >= cost ? '#2ecc71' : '#e74c3c';
    
    const buyBtn = document.getElementById('buyMerchBtn');
    buyBtn.disabled = player.gold < cost;
    buyBtn.onclick = () => {
        ws.send(JSON.stringify({
            type: 'buy_merchant',
            merchantId: merch.id
        }));
    };
}

function toggleStatusPanel() {
    const panel = document.getElementById('statusPanel');
    if (panel) {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) updateStatusPanel();
    }
}

function updateStatusPanel() {
    if (!gameState) return;
    
    // Mothership Upgrades (Merchant + Shared Ship Upgrades)
    const mList = document.getElementById('mothershipUpgradesList');
    const merchantUpgrades = gameState.purchasedMerchantUpgrades || [];
    
    // Mothership upgrade ID map
    const mothershipUpgradeIds = ['hull_max', 'hull_repair', 'turret', 'drone', 'drone_speed', 'drone_damage', 'shield_gen', 'mothership_speed', 'pickup_range'];
    const upgradeNameMap = {
        'titanium_hull': 'Titanium Hull (+1500 HP)',
        'orbital_strike': 'Orbital Strike (Active)',
        'hyper_drives': 'Hyper Drives (+300% Speed)',
        'black_market_laser': 'Black Market Laser',
        'quantum_shield': 'Quantum Shield (+1000 Shield)',
        'hull_max': 'Hull Integrity',
        'hull_repair': 'Repair Bots',
        'turret': 'Auto-Turret',
        'drone': 'Support Drone',
        'drone_speed': 'Drone Fire Rate',
        'drone_damage': 'Drone Damage',
        'shield_gen': 'Shield Generator',
        'mothership_speed': 'Engine Power',
        'pickup_range': 'Magnet Pull'
    };

    let mHtml = '';
    
    // Add Merchant mods
    merchantUpgrades.forEach(mod => {
        mHtml += `<li><span style="color: #f39c12;">${mod.buyerName}:</span> ${upgradeNameMap[mod.id] || mod.id.replace('_', ' ').toUpperCase()}</li>`;
    });

    // Add Shared Mothership Upgrades from all players
    if (gameState.p) {
        gameState.p.forEach(p => {
            const upgrades = p.upgradeLevels || {};
            Object.entries(upgrades).forEach(([id, lvl]) => {
                if (mothershipUpgradeIds.includes(id)) {
                    mHtml += `<li><span style="color: ${p.color};">${p.name || 'Pilot'}:</span> ${upgradeNameMap[id] || id.replace('_', ' ').toUpperCase()} v${lvl}</li>`;
                }
            });
        });
    }

    if (!mHtml) mHtml = '<li>No specialized hull/shield mods</li>';
    mList.innerHTML = mHtml;
    
    // Player Loadout
    const pList = document.getElementById('playerUpgradesList');
    if (gameState.p) {
        pList.innerHTML = gameState.p.map(p => {
            const isMe = p.id === playerId;
            const name = p.name || `Player ${p.id.slice(-4)}`;
            const stats = p.stats || {};
            const upgrades = p.upgradeLevels || {};
            
            // Filter only player upgrades
            let upgradeItems = Object.entries(upgrades)
                .filter(([id, lvl]) => !mothershipUpgradeIds.includes(id))
                .map(([id, lvl]) => 
                    `<span style="font-size: 10px; color: #7f8c8d; margin-right: 5px;">${id.toUpperCase()} v${lvl}</span>`
                ).join('');
            
            if (!upgradeItems) upgradeItems = '<span style="font-size: 10px; color: #7f8c8d;">Standard Issue</span>';

            return `
                <div style="margin-bottom: 15px; padding: 10px; background: rgba(255,255,255,0.05); border-left: 3px solid ${p.color};">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span style="color: ${p.color}; font-weight: bold;">${name} ${isMe ? '(YOU)' : ''}</span>
                        <span style="color: #2ecc71;">${Math.floor(p.hull)} / ${p.maxHull} HP</span>
                    </div>
                    <div style="font-size: 11px; color: #ecf0f1; margin-bottom: 5px;">
                        Kills: ${stats.kills || 0} | Damage: ${Math.floor(stats.damageDealt || 0)}
                    </div>
                    <div style="display: flex; flex-wrap: wrap;">
                        ${upgradeItems}
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Upgrade system
let lastUpgradeMsg = null;

function handleUpgradeMenu(msg) {
    console.log('Opening/Updating upgrade menu...', msg);
    
    // Optimistically fix race condition with state packets
    if (gameState && gameState.p) {
        const me = gameState.p.find(p => p.id === playerId);
        if (me) me.upgradeReady = false;
    }
    
    // Prevent DOM thrashing: don't rebuild if nothing changed
    const optionsContainer = document.getElementById('upgradeOptions');
    if (lastUpgradeMsg) {
        const sameOptions = JSON.stringify(msg.options) === JSON.stringify(lastUpgradeMsg.options);
        const sameGold = msg.gold === lastUpgradeMsg.gold;
        const samePinned = msg.pinnedId === lastUpgradeMsg.pinnedId;
        if (sameOptions && sameGold && samePinned && !upgradeMenu.classList.contains('hidden') && optionsContainer.children.length > 0) {
            return; // Already rendering this exact state
        }
    }
    
    lastUpgradeMsg = msg;
    upgradeMenu.classList.remove('hidden');
    upgradeMenu.style.display = 'block'; // Force display if hidden via inline style
    optionsContainer.innerHTML = '';
    
    msg.options?.forEach(option => {
        const div = document.createElement('div');
        div.className = 'upgrade-option';
        if (msg.pinnedId === option.id) {
            div.style.border = '2px solid #f1c40f';
            div.style.boxShadow = '0 0 15px rgba(241, 196, 15, 0.3)';
            div.style.background = 'rgba(241, 196, 15, 0.05)';
        }
        
        // Check if player has enough gold
        const currentLevel = (msg.levels && msg.levels[option.id]) || 0;
        const cost = option.costs[currentLevel];
        const me = gameState.p?.find(p => p.id === playerId);
        const canAfford = (me ? me.gold : 0) >= cost;
        
        if (!canAfford) {
            div.style.opacity = '0.5';
            div.style.cursor = 'not-allowed';
        } else {
            div.onclick = () => selectUpgrade(option.id);
        }
        div.innerHTML = `
            <h3>${option.name}</h3>
            <p>${option.description}</p>
            <div class="upgrade-cost" style="color: ${canAfford ? '#e67e22' : '#e74c3c'}">Cost: ${cost} GOLD</div>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
                <button class="btn btn-sm buy-btn" style="flex: 1; padding: 5px; font-size: 12px; ${!canAfford ? 'opacity: 0.5; pointer-events: none;' : ''}" onclick="event.stopPropagation(); selectUpgrade('${option.id}')">Buy</button>
                <button class="btn btn-sm btn-secondary pin-btn" style="flex: 1; padding: 5px; font-size: 12px; ${msg.pinnedId === option.id ? 'border-color: #f1c40f; color: #f1c40f;' : ''}" onclick="event.stopPropagation(); pinUpgrade('${option.id}')">${msg.pinnedId === option.id ? '★ Pinned' : '☆ Pin'}</button>
            </div>
        `;
        
        optionsContainer.appendChild(div);
    });
    
    // Add Skip button if not already there
    let skipBtn = document.getElementById('skipUpgradeBtn');
    if (!skipBtn) {
        skipBtn = document.createElement('button');
        skipBtn.id = 'skipUpgradeBtn';
        skipBtn.className = 'btn btn-secondary';
        skipBtn.style.marginTop = '10px';
        skipBtn.style.width = '100%';
        skipBtn.textContent = 'Skip (Keep Gold)';
        skipBtn.onclick = () => skipUpgrade();
        upgradeMenu.appendChild(skipBtn);
    }
    
    updateUpgradeReadyStatus();
}

function pinUpgrade(upgradeId) {
    ws.send(JSON.stringify({
        type: 'pin_upgrade',
        upgradeId: upgradeId
    }));
}

function skipUpgrade() {
    ws.send(JSON.stringify({ type: 'skip_upgrade' }));
}

function updateUpgradeReadyStatus() {
    if (!gameState || !gameState.p) return;
    
    // Check if we are ready
    const skipBtn = document.getElementById('skipUpgradeBtn');
    const me = gameState.p.find(p => p.id === playerId);
    
    if (me && me.upgradeReady) {
        // Disable only BUY options if already selected or skipped
        const options = document.querySelectorAll('.upgrade-option');
        options.forEach(opt => {
            opt.style.borderColor = '#7f8c8d';
            opt.style.background = 'rgba(0,0,0,0.2)';
            
            const buyBtn = opt.querySelector('.buy-btn');
            if (buyBtn) {
                buyBtn.style.pointerEvents = 'none';
                buyBtn.style.opacity = '0.3';
                buyBtn.textContent = 'Selected';
            }
            opt.onclick = null; // Disable the container click
        });
        
        if (skipBtn) {
            skipBtn.style.pointerEvents = 'none';
            skipBtn.style.opacity = '0.5';
            skipBtn.textContent = 'Waiting for others...';
        }
    } else {
        // Unskip / Re-enable if they rerolled
        if (skipBtn) {
            skipBtn.style.pointerEvents = 'auto';
            skipBtn.style.opacity = '1';
            skipBtn.textContent = 'Skip (Keep Gold)';
        }
        // (Options are naturally enabled when rendered via handleUpgradeMenu)
    }

    // Add status list
    let statusDiv = document.getElementById('upgradeStatus');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'upgradeStatus';
        statusDiv.style.marginTop = '20px';
        statusDiv.style.borderTop = '1px solid #34495e';
        statusDiv.style.paddingTop = '10px';
        upgradeMenu.appendChild(statusDiv);
    }
    
    statusDiv.innerHTML = '<h4 style="margin-bottom: 5px;">Player Status:</h4>';
    gameState.p.forEach(p => {
        const pDiv = document.createElement('div');
        pDiv.style.color = p.color;
        pDiv.textContent = `${p.name || `Player ${p.id.slice(-4)}`}: ${p.upgradeReady ? '✅ READY' : '⏳ SELECTING...'}`;
        statusDiv.appendChild(pDiv);
    });
}

function selectUpgrade(upgradeId) {
    ws.send(JSON.stringify({
        type: 'upgrade_select',
        upgradeId: upgradeId
    }));
    // Optimistically lock UI to prevent double clicks and improve feedback
    const options = document.querySelectorAll('.upgrade-option');
    options.forEach(opt => {
        opt.style.pointerEvents = 'none';
        opt.style.borderColor = '#7f8c8d';
    });
}

function rerollUpgrades() {
    ws.send(JSON.stringify({ type: 'reroll_upgrades' }));
}

function handleUpgradeApplied(msg) {
    // Already handled via state update
    updateUpgradeReadyStatus();
}

function handleUpgradeRerolled(msg) {
    handleUpgradeMenu(msg);
}

function handleUpgradePinned(msg) {
    // Force a re-render of the menu with the new pinned status
    // We need to keep the options from the previous message
    const msgCopy = Object.assign({}, lastUpgradeMsg);
    msgCopy.pinnedId = msg.pinnedId;
    lastUpgradeMsg = null; // Force rebuild
    handleUpgradeMenu(msgCopy);
}

function handleUpgradeSkipped(msg) {
    // Optimistically update UI without waiting for state packet
    if (gameState && gameState.p) {
        const me = gameState.p.find(p => p.id === playerId);
        if (me) me.upgradeReady = true;
    }
    updateUpgradeReadyStatus();
}

function handleUpgradeTimerStart(msg) {
    document.getElementById('upgradeTimer').textContent = Math.ceil(msg.maxTime / 30);
}

function handleUpgradeTimerUpdate(msg) {
    document.getElementById('upgradeTimer').textContent = msg.timeLeft;
}

function handlePlayerUpgradeSelected(msg) {
    console.log(`${msg.playerName} selected ${msg.upgradeName}`);
    updateUpgradeReadyStatus();
}

// Achievement logic
function handleAchievementUnlocked(msg) {
    const ach = msg.achievement;
    if (!unlockedAchievements.includes(ach.id)) {
        unlockedAchievements.push(ach.id);
        localStorage.setItem('aegis_achievements', JSON.stringify(unlockedAchievements));
    }
    
    const popup = document.getElementById('achievementPopup');
    const desc = document.getElementById('achPopDesc');
    if (popup && desc) {
        desc.textContent = `${ach.name}: ${ach.description}`;
        popup.classList.remove('hidden');
        
        setTimeout(() => {
            popup.classList.add('hidden');
        }, 5000);
    }
}

function showAchievements() {
    const modal = document.getElementById('achievementsModal');
    const list = document.getElementById('achievementsList');
    list.innerHTML = '';
    
    // We'll need a list of all achievements to show locked ones
    // For now, just show unlocked ones
    if (unlockedAchievements.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No achievements unlocked yet. Keep playing!</p>';
    } else {
        // In a real app, we'd fetch the full list from server
        // For now, we'll use a static list to show what's earned vs locked
        const allPossible = [
            { id: 'survivor_30', name: 'Survivor', desc: 'Survive 30 seconds' },
            { id: 'slayer_100', name: 'Enemy Slayer', desc: 'Destroy 100 enemies' },
            { id: 'wave_15', name: 'Veteran', desc: 'Reach Wave 15' }
        ];

        allPossible.forEach(ach => {
            const isUnlocked = unlockedAchievements.includes(ach.id);
            const div = document.createElement('div');
            div.style.background = isUnlocked ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255, 255, 255, 0.05)';
            div.style.border = `1px solid ${isUnlocked ? '#2ecc71' : '#34495e'}`;
            div.style.padding = '15px';
            div.style.borderRadius = '8px';
            div.style.display = 'flex';
            div.style.justifyContent = 'space-between';
            div.style.alignItems = 'center';
            div.style.opacity = isUnlocked ? '1' : '0.5';

            div.innerHTML = `
                <div>
                    <h4 style="color: ${isUnlocked ? '#2ecc71' : '#bdc3c7'}; margin-bottom: 5px;">${ach.name}</h4>
                    <p style="font-size: 13px; color: #7f8c8d;">${ach.desc}</p>
                </div>
                <div style="font-size: 24px;">${isUnlocked ? '🏆' : '🔒'}</div>
            `;
            list.appendChild(div);
        });
    }
    
    modal.classList.remove('hidden');
}

function hideAchievements() {
    document.getElementById('achievementsModal').classList.add('hidden');
}

// Compendium logic
function showCompendium() {
    if (compendiumData.length === 0) {
        ws.send(JSON.stringify({ type: 'get_compendium' }));
    }
    document.getElementById('compendiumModal').classList.remove('hidden');
    renderCompendium();
}

function hideCompendium() {
    document.getElementById('compendiumModal').classList.add('hidden');
}

function renderCompendium() {
    const content = document.getElementById('compendiumContent');
    content.innerHTML = '';
    
    if (compendiumData.length === 0) {
        content.innerHTML = '<p>Loading upgrade data...</p>';
        return;
    }
    
    // Group by type
    const groups = {
        player: compendiumData.filter(u => u.type === 'player'),
        mothership: compendiumData.filter(u => u.type === 'mothership'),
        special: compendiumData.filter(u => u.type === 'special')
    };
    
    Object.keys(groups).forEach(type => {
        const section = document.createElement('div');
        section.style.gridColumn = '1 / -1';
        section.innerHTML = `<h3 style="color: #3498db; border-bottom: 1px solid #3498db; margin-top: 20px; padding-bottom: 5px;">${type.toUpperCase()} UPGRADES</h3>`;
        content.appendChild(section);
        
        groups[type].forEach(u => {
            const div = document.createElement('div');
            div.style.background = 'rgba(255, 255, 255, 0.05)';
            div.style.border = '1px solid #34495e';
            div.style.padding = '15px';
            div.style.borderRadius = '8px';
            div.innerHTML = `
                <h4 style="color: #f39c12; margin-bottom: 5px;">${u.name}</h4>
                <p style="font-size: 13px; color: #bdc3c7;">${u.description}</p>
                <div style="font-size: 11px; margin-top: 10px; color: #7f8c8d;">Max Level: ${u.max}</div>
            `;
            content.appendChild(div);
        });
    });
}

// Game events
function handleAnnouncement(msg) {
    // Hide upgrade menu when a new wave starts (but not when it just ended)
    if (msg.text.startsWith('WAVE') && msg.text !== 'WAVE COMPLETE') {
        upgradeMenu.classList.add('hidden');
    }
    
    const announcement = document.createElement('div');
    announcement.className = 'announcement';
    announcement.innerHTML = `
        <h1>${msg.text}</h1>
        <h2>${msg.sub}</h2>
    `;
    
    document.getElementById('gameContainer').appendChild(announcement);
    
    setTimeout(() => {
        announcement.remove();
    }, 2000);
}

function handleGameOver(msg) {
    gameOverScreen.classList.remove('hidden');
    document.getElementById('gameOverTitle').textContent = msg.title;
    
    // Create tabs for PvE and PvP
    let statsHtml = `<p>${msg.stats}</p>`;
    
    if (msg.pveStats || msg.pvpScores) {
        statsHtml += `<div style="display: flex; gap: 10px; margin: 15px 0; justify-content: center;">
            <button onclick="document.getElementById('pveStatsDiv').style.display='block'; document.getElementById('pvpStatsDiv').style.display='none';" style="padding: 10px; background: #3498db; color: white; border: none; cursor: pointer;">PvE Stats</button>
            <button onclick="document.getElementById('pveStatsDiv').style.display='none'; document.getElementById('pvpStatsDiv').style.display='block';" style="padding: 10px; background: #e74c3c; color: white; border: none; cursor: pointer;">PvP Stats</button>
        </div>`;
        
        // PvE
        statsHtml += `<div id="pveStatsDiv" style="display: block; text-align: left; background: rgba(0,0,0,0.5); padding: 15px; border-radius: 5px;">
            <h3 style="margin: 0 0 10px 0; color: #3498db;">Co-op Performance</h3>`;
        if (msg.pveStats) {
            msg.pveStats.forEach(s => {
                statsHtml += `<div style="margin-bottom: 5px;"><strong>${s.name}</strong>: ${s.kills} Kills | ${s.damage} Damage</div>`;
            });
        }
        statsHtml += `</div>`;
        
        // PvP
        statsHtml += `<div id="pvpStatsDiv" style="display: none; text-align: left; background: rgba(0,0,0,0.5); padding: 15px; border-radius: 5px;">
            <h3 style="margin: 0 0 10px 0; color: #e74c3c;">PvP Showdown Results</h3>`;
        if (msg.pvpScores && Object.keys(msg.pvpScores).length > 0) {
            Object.keys(msg.pvpScores).forEach(id => {
                const name = msg.pveStats?.find(p => p.id === id)?.name || `Player ${id.slice(-4)}`;
                statsHtml += `<div style="margin-bottom: 5px;"><strong>${name}</strong>: ${msg.pvpScores[id]} Wins</div>`;
            });
        } else {
            statsHtml += `<div>No PvP data recorded.</div>`;
        }
        statsHtml += `</div>`;
    }
    
    document.getElementById('gameOverStats').innerHTML = statsHtml;
}

function handleError(msg) {
    alert(msg.message);
}

// Game controls
function restartGame() {
    ws.send(JSON.stringify({ type: 'restart_game' }));
    gameOverScreen.classList.add('hidden');
}

function backToLobby() {
    location.reload();
}

function playSinglePlayer() {
    const name = document.getElementById('playerName').value.trim();
    if (!name) {
        alert("You MUST enter a name to play.");
        return;
    }
    connectWebSocket();
    
    // Wait for connection before sending create_room
    const checkOpen = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'create_room',
                playerName: name,
                singlePlayer: true
            }));
            clearInterval(checkOpen);
        }
    }, 100);
    
    showGame();
}

// Input handling
function setupInputHandlers() {
    // Keyboard input
    document.addEventListener('keydown', (e) => {
        if (e.key === 'w' || e.key === 'W') keys.w = true;
        if (e.key === 'a' || e.key === 'A') keys.a = true;
        if (e.key === 's' || e.key === 'S') keys.s = true;
        if (e.key === 'd' || e.key === 'D') keys.d = true;
        if (e.key === 'ArrowUp') keys.ArrowUp = true;
        if (e.key === 'ArrowDown') keys.ArrowDown = true;
        if (e.key === 'ArrowLeft') keys.ArrowLeft = true;
        if (e.key === 'ArrowRight') keys.ArrowRight = true;
        if (e.key === 'Shift') keys.shift = true;
        if (e.key === ' ') {
            keys.space = true;
            mouseDown = true; // Space also triggers shooting
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'w' || e.key === 'W') keys.w = false;
        if (e.key === 'a' || e.key === 'A') keys.a = false;
        if (e.key === 's' || e.key === 'S') keys.s = false;
        if (e.key === 'd' || e.key === 'D') keys.d = false;
        if (e.key === 'ArrowUp') keys.ArrowUp = false;
        if (e.key === 'ArrowDown') keys.ArrowDown = false;
        if (e.key === 'ArrowLeft') keys.ArrowLeft = false;
        if (e.key === 'ArrowRight') keys.ArrowRight = false;
        if (e.key === 'Shift') keys.shift = false;
        if (e.key === ' ') {
            keys.space = false;
            mouseDown = false;
        }
    });

    // Mouse input
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = GAME_WIDTH / rect.width;
        const scaleY = GAME_HEIGHT / rect.height;
        
        mouseX = (e.clientX - rect.left) * scaleX;
        mouseY = (e.clientY - rect.top) * scaleY;
    });
    
    canvas.addEventListener('mousedown', () => {
        mouseDown = true;
    });
    
    canvas.addEventListener('mouseup', () => {
        mouseDown = false;
    });
    
    // Send input updates
    let lastInputString = "";
    setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN && gameState && !gameState.waitingForUpgrade) {
            const currentInput = {
                type: 'input',
                keys: keys,
                mouseX: mouseX,
                mouseY: mouseY,
                mouseDown: mouseDown
            };
            const currentInputString = JSON.stringify(currentInput);
            if (currentInputString !== lastInputString) {
                ws.send(currentInputString);
                lastInputString = currentInputString;
            }
        }
    }, 1000 / 60); // Check 60 times a sec, but only send if dirty
}

// Initialize
window.addEventListener('load', () => {
    resizeCanvas();
    setupInputHandlers();
    connectWebSocket();
});

window.addEventListener('resize', resizeCanvas);
function handleNavigationOptions(msg) {
    console.log('Opening navigation menu...', msg);
    navigationMenu.classList.remove('hidden');
    const nodeOptions = document.getElementById('nodeOptions');
    nodeOptions.innerHTML = '';
    
    msg.options?.forEach(node => {
        const div = document.createElement('div');
        div.className = `upgrade-option ${node.locked ? 'locked' : ''}`;
        div.style.flex = '1';
        div.style.padding = '15px';
        div.style.cursor = node.locked ? 'not-allowed' : 'pointer';
        div.style.border = node.locked ? '1px solid rgba(231, 76, 60, 0.5)' : '1px solid rgba(52, 152, 219, 0.3)';
        div.style.borderRadius = '8px';
        div.style.background = node.locked ? 'rgba(231, 76, 60, 0.1)' : 'rgba(20, 20, 20, 0.5)';
        div.style.position = 'relative';
        div.style.transition = 'all 0.2s ease';
        div.style.opacity = node.locked ? '0.6' : '1';

        // Voter names list
        const votersList = document.createElement('div');
        votersList.style.marginTop = '10px';
        votersList.style.fontSize = '10px';
        votersList.style.color = '#3498db';
        votersList.style.display = 'flex';
        votersList.style.flexWrap = 'wrap';
        votersList.style.gap = '5px';
        
        const voterIds = msg.votes && msg.votes[node.id] ? msg.votes[node.id] : [];
        voterIds.forEach(vid => {
            const player = gameState.p?.find(p => p.id === vid);
            if (player) {
                const badge = document.createElement('span');
                badge.style.background = 'rgba(52, 152, 219, 0.2)';
                badge.style.padding = '2px 6px';
                badge.style.borderRadius = '4px';
                badge.style.border = `1px solid ${player.color || '#3498db'}`;
                const displayName = (player.name || 'Pilot').split(' ')[0];
                badge.textContent = displayName;
                votersList.appendChild(badge);
            }
        });

        let content = `
            <div style="font-size: 14px; font-weight: bold; color: ${node.locked ? '#e74c3c' : '#fff'}; margin-bottom: 5px;">
                ${node.locked ? '[ LOCKED ]' : node.name}
            </div>
            ${node.locked ? `<div style="font-size: 10px; color: #e74c3c; margin-bottom: 10px;">${node.lockReason}</div>` : ''}
            <div style="font-size: 11px; color: #95a5a6;">${(node.description || node.desc || 'No description available').split('.')[0]}</div>
        `;
        div.innerHTML = content;
        div.appendChild(votersList);
        
        if (!node.locked) {
            div.onclick = () => voteNode(node.id);
        }
        
        div.onmouseenter = () => { 
            if (!node.locked) {
                div.style.borderColor = '#3498db'; 
                div.style.transform = 'translateY(-2px)'; 
            }
        };
        div.onmouseleave = () => { 
            div.style.borderColor = node.locked ? 'rgba(231, 76, 60, 0.5)' : 'rgba(52, 152, 219, 0.3)'; 
            div.style.transform = 'translateY(0)'; 
        };
        
        if (voterIds.includes(playerId)) {
            div.style.borderColor = '#3498db';
            div.style.boxShadow = '0 0 10px rgba(52, 152, 219, 0.3)';
            div.style.background = 'rgba(52, 152, 219, 0.1)';
        }
        
        nodeOptions.appendChild(div);
    });
    
    // Update status text
    const totalVoters = Object.values(msg.votes || {}).reduce((s, v) => s + v.length, 0);
    const totalPlayers = gameState.p?.length || 1;
    document.getElementById('navStatus').textContent = `Votes: ${totalVoters} / ${totalPlayers} pilots confirmed`;
}

function voteNode(nodeId) {
    ws.send(JSON.stringify({
        type: 'vote_node',
        nodeId: nodeId
    }));
}

function handleWarpStart(msg) {
    const overlay = document.getElementById('warpOverlay');
    overlay.classList.remove('hidden');
    overlay.style.opacity = '1';
    
    setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.classList.add('hidden'), 500);
    }, 1000);
}

function handleSuperUpgradeMenu(msg) {
    console.log('[UI] Showing Super Upgrade Menu');
    const menu = document.getElementById('superUpgradeMenu');
    const optionsContainer = document.getElementById('superUpgradeOptions');
    
    if (!menu || !optionsContainer) return;

    menu.classList.remove('hidden');
    optionsContainer.innerHTML = '';

    msg.options.forEach(opt => {
        const div = document.createElement('div');
        div.className = 'nav-option';
        div.style.border = '2px solid #f1c40f';
        div.style.width = '250px';
        div.style.padding = '20px';
        div.style.textAlign = 'center';
        div.style.cursor = 'pointer';
        div.style.background = 'rgba(241, 196, 15, 0.05)';
        
        div.innerHTML = `
            <h3 style="color: #f1c40f;">${opt.name}</h3>
            <p style="font-size: 12px; color: #ecf0f1;">${opt.desc}</p>
            <div style="margin-top: 15px; color: #f1c40f; font-weight: bold;">SELECT</div>
        `;

        div.onclick = () => {
            ws.send(JSON.stringify({
                type: 'select_super_upgrade',
                upgradeId: opt.id
            }));
            menu.classList.add('hidden');
        };

        optionsContainer.appendChild(div);
    });
}

// ─── Live Stats & Leaderboard ───────────────────────────────────────────────

let _lbSortField = 'waves';

function pollLiveStats() {
    fetch('/api/stats')
        .then(r => r.json())
        .then(data => {
            const solo  = document.getElementById('statsSolo');
            const coop  = document.getElementById('statsCoop');
            const total = document.getElementById('statsTotal');
            if (solo)  solo.textContent  = data.soloPlayers  || 0;
            if (coop)  coop.textContent  = data.coopPlayers  || 0;
            if (total) total.textContent = data.totalPlayers || 0;
        })
        .catch(() => {}); // silently ignore when offline
}

// Poll every 5 seconds while on the lobby screen
setInterval(() => {
    const lobby = document.getElementById('lobby');
    if (lobby && !lobby.classList.contains('hidden')) {
        pollLiveStats();
    }
}, 5000);
pollLiveStats(); // initial call

function showLeaderboard() {
    document.getElementById('leaderboardModal').classList.remove('hidden');
    loadLeaderboard(_lbSortField);
}

function hideLeaderboard() {
    document.getElementById('leaderboardModal').classList.add('hidden');
}

function loadLeaderboard(sortField) {
    _lbSortField = sortField || 'waves';
    
    // Highlight active sort button
    ['waves','kills','time'].forEach(f => {
        const btn = document.getElementById('lb-sort-' + f);
        if (btn) btn.style.borderColor = f === _lbSortField ? '#f1c40f' : '';
    });
    
    fetch('/api/leaderboard')
        .then(r => r.json())
        .then(entries => {
            // Sort entries
            entries.sort((a, b) => {
                if (_lbSortField === 'waves') return b.waves - a.waves;
                if (_lbSortField === 'kills') return b.kills - a.kills;
                if (_lbSortField === 'time')  return b.timeSeconds - a.timeSeconds;
                return 0;
            });
            
            const tbody = document.getElementById('leaderboardBody');
            if (!entries.length) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#7f8c8d;padding:30px;">No entries yet. Complete a run to appear here!</td></tr>';
                return;
            }
            
            tbody.innerHTML = entries.map((e, i) => {
                const mins = Math.floor(e.timeSeconds / 60).toString().padStart(2,'0');
                const secs = (e.timeSeconds % 60).toString().padStart(2,'0');
                const rowBg = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
                const goldColor = i === 0 ? '#f1c40f' : i === 1 ? '#bdc3c7' : i === 2 ? '#e67e22' : '#7f8c8d';
                const resultBadge = e.victory
                    ? '<span style="color:#2ecc71;font-weight:bold;">✓ WIN</span>'
                    : '<span style="color:#e74c3c;">✗ FAIL</span>';
                const modeBadge = e.isCoop
                    ? `<span style="color:#3498db;font-size:11px;">CO-OP ${e.playerCount}P</span>`
                    : '<span style="color:#95a5a6;font-size:11px;">SOLO</span>';
                return `
                    <tr style="background:${rowBg}; border-bottom:1px solid rgba(255,255,255,0.05);">
                        <td style="padding:10px 6px; color:${goldColor}; font-weight:bold;">${i+1}</td>
                        <td style="padding:10px 6px; color:#ecf0f1;">${e.names || 'Unknown'}</td>
                        <td style="padding:10px 6px; text-align:center;">${modeBadge}</td>
                        <td style="padding:10px 6px; text-align:center; color:#2ecc71; font-weight:bold;">${e.waves}</td>
                        <td style="padding:10px 6px; text-align:center; color:#e74c3c;">${e.kills}</td>
                        <td style="padding:10px 6px; text-align:center; color:#bdc3c7; font-family:monospace;">${mins}:${secs}</td>
                        <td style="padding:10px 6px; text-align:center;">${resultBadge}</td>
                    </tr>`;
            }).join('');
        })
        .catch(() => {
            document.getElementById('leaderboardBody').innerHTML =
                '<tr><td colspan="7" style="text-align:center;color:#e74c3c;padding:20px;">Failed to load leaderboard.</td></tr>';
        });
}
