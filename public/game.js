// Aegis Command - Multiplayer Client Game Logic
console.log("[SYSTEM] Aegis Command - v5.0.0-PRO");

// Game Constants
const GAME_WIDTH = 1600;
const GAME_HEIGHT = 900;

// Lightweight Procedural Audio Engine
class AudioEngine {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.initialized = false;
        this.isMusicPlaying = false;
        this.lastShootTime = 0;
        this.isSFXEnabled = true;
        this.isMusicEnabled = true;
        this.menuMusicActive = false;
        this.musicGain = null;
        this.sfxGain = null;
    }

    init() {
        if (this.initialized) return;
        try {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
            this.masterGain.connect(this.audioCtx.destination);
            
            this.musicGain = this.audioCtx.createGain();
            this.musicGain.connect(this.masterGain);
            
            this.sfxGain = this.audioCtx.createGain();
            this.sfxGain.connect(this.masterGain);
            
            this.initialized = true;
            console.log("[AUDIO] System Initialized");
            
            // Auto-trigger menu music if enabled
            if (this.isMusicEnabled) this.playMenuMusic();
        } catch (e) { console.error("Audio failed", e); }
    }

    toggleMusic(enabled) {
        this.isMusicEnabled = enabled;
        if (this.musicGain) {
            this.musicGain.gain.setTargetAtTime(enabled ? 1 : 0, this.audioCtx.currentTime, 0.1);
        }
        if (!enabled) {
            this.isMusicPlaying = false;
            this.menuMusicActive = false;
        } else {
            if (gameState) this.startMusic();
            else this.playMenuMusic();
        }
    }

    toggleSFX(enabled) {
        this.isSFXEnabled = enabled;
        if (this.sfxGain) {
            this.sfxGain.gain.setTargetAtTime(enabled ? 1 : 0, this.audioCtx.currentTime, 0.1);
        }
    }

    playShoot(type = 'default') {
        if (!this.initialized || !this.isSFXEnabled) return;
        const now = this.audioCtx.currentTime;
        // Throttling
        if (now - this.lastShootTime < 0.07) return; 
        this.lastShootTime = now;

        const osc = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        
        let duration = 0.1;

        switch(type) {
            case 'laser':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
                g.gain.setValueAtTime(0.04, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
                duration = 0.1;
                break;
            case 'homing_missile':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(440, now + 0.2);
                g.gain.setValueAtTime(0.06, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                duration = 0.2;
                break;
            case 'pulse_wave':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
                g.gain.setValueAtTime(0.12, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                duration = 0.3;
                break;
            case 'mine':
                osc.type = 'square';
                osc.frequency.setValueAtTime(60, now);
                osc.frequency.exponentialRampToValueAtTime(150, now + 0.08);
                g.gain.setValueAtTime(0.08, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                duration = 0.1;
                break;
            case 'lightning':
                this.playTeslaChain();
                return;
            default:
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600 + Math.random() * 200, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
                g.gain.setValueAtTime(0.07, now);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                duration = 0.05;
                break;
        }

        osc.connect(g);
        g.connect(this.sfxGain || this.masterGain);
        osc.start();
        osc.stop(now + duration);
    }

    playBossSpawn() {
        if (!this.initialized || !this.isSFXEnabled) return;
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.linearRampToValueAtTime(30, now + 2);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.4, now + 0.5);
        g.gain.linearRampToValueAtTime(0, now + 2.5);
        osc.connect(g);
        g.connect(this.sfxGain || this.masterGain);
        osc.start();
        osc.stop(now + 2.5);
    }

    playLevelUp() {
        if (!this.initialized || !this.isSFXEnabled) return;
        const now = this.audioCtx.currentTime;
        const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5 arpeggio
        notes.forEach((freq, i) => {
            const osc = this.audioCtx.createOscillator();
            const g = this.audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.1);
            g.gain.setValueAtTime(0, now + i * 0.1);
            g.gain.linearRampToValueAtTime(0.1, now + i * 0.1 + 0.05);
            g.gain.linearRampToValueAtTime(0, now + i * 0.1 + 0.3);
            osc.connect(g); g.connect(this.sfxGain || this.masterGain);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        });
    }

    playExplosion() {
        if (!this.initialized || !this.isSFXEnabled) return;
        const osc = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.audioCtx.currentTime + 0.4);
        g.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.4);
        osc.connect(g);
        g.connect(this.sfxGain || this.masterGain);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.4);
    }

    playPickup() {
        if (!this.initialized || !this.isSFXEnabled) return;
        const osc = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, this.audioCtx.currentTime + 0.1);
        g.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
        osc.connect(g);
        g.connect(this.sfxGain || this.masterGain);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
    }

    playJump() {
        if (!this.initialized || !this.isSFXEnabled) return;
        const osc = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, this.audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(880, this.audioCtx.currentTime + 1.5);
        g.gain.setValueAtTime(0, this.audioCtx.currentTime);
        g.gain.linearRampToValueAtTime(0.2, this.audioCtx.currentTime + 0.5);
        g.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 1.5);
        osc.connect(g);
        g.connect(this.sfxGain || this.masterGain);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 1.5);
    }

    playTeslaChain() {
        if (!this.initialized || !this.isSFXEnabled) return;
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200 + Math.random() * 400, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(g);
        g.connect(this.sfxGain || this.masterGain);
        osc.start();
        osc.stop(now + 0.05);
    }

    playMenuMusic() {
        if (!this.isMusicEnabled) return;
        this.init();
        if (this.menuMusicActive) return;
        this.menuMusicActive = true;
        this.playMenuLoop();
    }

    playMenuLoop() {
        if (!this.menuMusicActive || !this.isMusicEnabled) return;
        const now = this.audioCtx.currentTime;
        const freq = 73.42; // D2 (Deep Interstellar tone)
        const osc = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 1.01, now + 4);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.12, now + 4);
        g.gain.linearRampToValueAtTime(0, now + 8);
        osc.connect(g); g.connect(this.musicGain || this.masterGain); osc.start(now); osc.stop(now + 8);
        setTimeout(() => this.playMenuLoop(), 7500);
    }

    startMusic() {
        this.menuMusicActive = false; // Stop menu drone
        if (!this.initialized || this.isMusicPlaying || !this.isMusicEnabled) return;
        this.isMusicPlaying = true;
        this.playMusicLoop();
    }

    playMusicLoop() {
        if (!this.isMusicPlaying || !this.isMusicEnabled) return;
        const now = this.audioCtx.currentTime;
        const notes = [110, 146.83, 164.81, 196.00, 220]; 
        const freq = notes[Math.floor(Math.random() * notes.length)];
        
        const carrier = this.audioCtx.createOscillator();
        const modulator = this.audioCtx.createOscillator();
        const modGain = this.audioCtx.createGain();
        const g = this.audioCtx.createGain();

        carrier.type = 'sine'; modulator.type = 'sine';
        carrier.frequency.setValueAtTime(freq, now);
        modulator.frequency.setValueAtTime(freq * 0.5, now);
        modGain.gain.setValueAtTime(freq * 0.2, now);
        
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.06, now + 3);
        g.gain.linearRampToValueAtTime(0, now + 6);
        
        modulator.connect(modGain); modGain.connect(carrier.frequency);
        carrier.connect(g); g.connect(this.musicGain || this.masterGain);
        carrier.start(now); modulator.start(now);
        carrier.stop(now + 6); modulator.stop(now + 6);
        
        setTimeout(() => this.playMusicLoop(), 5000);
    }
}
const audio = new AudioEngine();
window.audio = audio;

// Game State
let ws = null;
let gameState = null;
let playerId = null;
let roomCode = null;
let isHost = false;
let isDev = false;
let compendiumData = [];
let unlockedAchievements = JSON.parse(localStorage.getItem('aegis_achievements') || '[]');
let floatingTexts = [];

// Network Smoothing
let stateHistory = [];
const INTERPOLATION_DELAY = 50; // Reduced from 100 for better responsiveness
let renderState = null;
let serverTimeOffset = 0;
let ping = 0;
let lastFrameTime = 0;
const MAX_FPS = 160;
const FRAME_MIN_TIME = 1000 / MAX_FPS;

window.setFpsLimit = function(limit) {
    const fps = parseInt(limit, 10);
    const minTime = 1000 / fps;
    // We update the local constants used in gameLoop
    window.currentFrameMinTime = minTime;
    console.log(`[SYSTEM] FPS limit set to ${fps} (${minTime.toFixed(2)}ms per frame)`);
};
window.currentFrameMinTime = FRAME_MIN_TIME;

// Screen Shake
let shakeIntensity = 0;
function applyShake(amount) {
    shakeIntensity = Math.min(shakeIntensity + amount, 20);
}

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
    const aspectRatio = GAME_WIDTH / GAME_HEIGHT;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowRatio = windowWidth / windowHeight;

    let targetWidth, targetHeight;

    if (windowRatio > aspectRatio) {
        // Window is wider than game
        targetHeight = windowHeight;
        targetWidth = targetHeight * aspectRatio;
    } else {
        // Window is taller than game
        targetWidth = windowWidth;
        targetHeight = targetWidth / aspectRatio;
    }

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    
    // Smooth responsive scaling
    canvas.style.width = `${targetWidth}px`;
    canvas.style.height = `${targetHeight}px`;
    
    // Center it
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
}

// Initialize Audio on any click
document.addEventListener('click', () => {
    if (!audio.initialized) {
        audio.init();
        audio.playMenuMusic();
    }
}, { once: false });

// WebSocket connection
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('Connected to server');
        
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
        if (window.pingInterval) clearInterval(window.pingInterval);
        
        const overlay = document.getElementById('reconnectOverlay');
        if (overlay) overlay.style.display = 'flex';
        
        // Try to reconnect in the background
        setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                connectWebSocket();
            }
        }, 3000);
        
        // Auto kick to main menu after 60s if not connected
        setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                location.href = '/';
            }
        }, 60000);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

// Message handling
function rerollUpgrades() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'reroll_upgrades' }));
    }
}

function handleMessage(msg) {
    switch (msg.type) {
        case 'room_created':
            handleRoomCreated(msg);
            break;
        case 'room_joined':
            handleRoomJoined(msg);
            const rcDisplay = document.getElementById('roomCodeDisplay');
            if (rcDisplay) {
                rcDisplay.innerText = `ROOM: ${msg.roomCode}`;
                rcDisplay.classList.remove('hidden');
            }
            // Hide overlay if it was visible
            const overlay = document.getElementById('reconnectOverlay');
            if (overlay) overlay.style.display = 'none';
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
            handleState(msg);
            break;
        case 'pong':
            handlePong(msg);
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
        case 'pickup_effect':
            handlePickupEffect(msg);
            break;
        case 'upgrade_skipped':
            handleUpgradeSkipped(msg);
            break;
        case 'navigation_options':
            handleNavigationOptions(msg);
            break;
        case 'super_upgrade_phase':
            handleSuperUpgradePhase(msg);
            break;
        case 'pause_state':
            gamePaused = msg.isPaused;
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
        case 'pickup_text':
            floatingTexts.push({
                x: msg.x,
                y: msg.y,
                text: msg.text,
                life: 60,
                color: msg.playerId === playerId ? '#f1c40f' : '#bdc3c7'
            });
            if (msg.text.includes('GOLD') || msg.text.includes('XP') || msg.text.includes('HULL')) {
                audio.playPickup();
            }
            break;
        case 'game_over':
            gameOverScreen.classList.remove('hidden');
            audio.playExplosion();
            break;
        case 'nav_transition':
            audio.playJump();
            break;
        case 'achievement_unlocked':
            handleAchievementUnlocked(msg);
            break;
        case 'compendium_data':
            compendiumData = msg.upgrades.sort((a, b) => a.name.localeCompare(b.name));
            renderCompendium();
            // Populate dev menu if it exists
            const devSelect = document.getElementById('devUpgradeSelect');
            if (devSelect && compendiumData) {
                devSelect.innerHTML = compendiumData.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
                updateDevUpgradeDescription();
            }
            break;
        case 'announcement':
            handleAnnouncement(msg);
            if (msg.text === 'LEVEL UP!') {
                audio.playLevelUp();
            }
            break;
        case 'endgame_vote_start':
            handleEndgameVoteStart(msg);
            break;
        case 'endgame_vote_update':
            handleEndgameVoteUpdate(msg);
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
            handlePong(msg);
            break;
    }
}

function handleState(msg) {
    const now = Date.now();
    
    // Buffer the state
    stateHistory.push({
        state: msg,
        receiveTime: now
    });
    
    // Limit buffer size
    if (stateHistory.length > 30) stateHistory.shift();
    
    // Set immediate gameState for non-positional UI elements
    gameState = msg;

    // Update debug monitor
    const debugPhase = document.getElementById('debugPhase');
    if (debugPhase) debugPhase.textContent = msg.currentPhase || 'COMBAT';
    const debugEntities = document.getElementById('debugEntities');
    if (debugEntities) {
        const count = (msg.b?.length || 0) + (msg.e?.length || 0) + (msg.a?.length || 0);
        debugEntities.textContent = count;
    }
    const debugFPS = document.getElementById('debugFPS');
    if (debugFPS) debugFPS.textContent = Math.round(1000 / (now - (window._lastFrameTime || now)));
    window._lastFrameTime = now;
    
    // Play sounds for new projectiles
    if (msg.b) {
        if (!window.seenProjectiles) window.seenProjectiles = new Set();
        msg.b.forEach(b => {
            if (!window.seenProjectiles.has(b.id)) {
                window.seenProjectiles.add(b.id);
                // Play sound based on bullet type
                audio.playShoot(b.type || 'default');
            }
        });
        
        // Optimized cleanup: Only run once per second
        const nowMs = Date.now();
        if (!window._lastSeenCleanup || nowMs - window._lastSeenCleanup > 1000) {
            window._lastSeenCleanup = nowMs;
            if (window.seenProjectiles.size > 2000) {
                const currentIds = new Set(msg.b.map(p => p.id));
                for (const id of window.seenProjectiles) {
                    if (!currentIds.has(id)) window.seenProjectiles.delete(id);
                }
            }
        }
    }
}

function handlePong(msg) {
    const now = Date.now();
    const latency = now - msg.clientTime;
    
    // Simple clock sync: serverTimeOffset + now = serverTime
    // msg.serverTime is when the server processed our ping
    serverTimeOffset = msg.serverTime - (now - latency / 2);
    
    ping = latency;
    const debugPing = document.getElementById('debugPing');
    if (debugPing) debugPing.textContent = latency + 'ms';
}

function handlePickupEffect(msg) {
    floatingTexts.push({
        x: msg.x,
        y: msg.y,
        text: msg.text,
        color: msg.color || '#f1c40f',
        life: 120,
        maxLife: 120
    });
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

function getCurrentRenderState() {
    if (stateHistory.length < 2) return gameState;
    
    const serverRenderTime = Date.now() + serverTimeOffset - INTERPOLATION_DELAY;
    
    // Find two states to interpolate between using server timestamps
    let i = stateHistory.length - 1;
    while (i > 0 && stateHistory[i].state.t > serverRenderTime) {
        i--;
    }
    
    const s1 = stateHistory[i];
    const s2 = stateHistory[i + 1];
    
    if (!s1 || !s2) return s1 ? s1.state : gameState;
    
    const duration = s2.state.t - s1.state.t;
    if (duration <= 0) return s1.state;
    
    // Clamp t between 0 and 1
    const t = Math.max(0, Math.min(1, (serverRenderTime - s1.state.t) / duration));
    
    // Debug variables attached to window for monitor
    window._debugInterp = { t: t.toFixed(2), buf: stateHistory.length, offset: serverTimeOffset };
    
    // Interpolate positions
    // Shallow copy the state to avoid expensive JSON operations
    // We only need to interpolate specific values
    const interpolated = { ...s1.state };
    
    // Create new arrays for entities we will modify
    interpolated.p = s1.state.p ? s1.state.p.map(p => ({ ...p })) : [];
    interpolated.m = s1.state.m ? { ...s1.state.m } : {};
    interpolated.e = s1.state.e ? s1.state.e.map(e => ({ ...e })) : [];
    interpolated.a = s1.state.a ? s1.state.a.map(a => ({ ...a })) : [];
    interpolated.b = s1.state.b ? s1.state.b.map(b => ({ ...b })) : [];
    
    // Interpolate players by ID
    if (s1.state.p && s2.state.p) {
        interpolated.p = s1.state.p.map(p1 => {
            const p2 = s2.state.p.find(p => p.id === p1.id);
            if (p2) {
                return {
                    ...p1,
                    x: lerp(p1.x, p2.x, t),
                    y: lerp(p1.y, p2.y, t),
                    angle: (() => {
                        let diff = p2.angle - p1.angle;
                        while (diff < -Math.PI) diff += Math.PI * 2;
                        while (diff > Math.PI) diff -= Math.PI * 2;
                        return p1.angle + diff * t;
                    })()
                };
            }
            return p1;
        });
    }
    
    // Interpolate mothership
    if (s1.state.m && s2.state.m) {
        interpolated.m = {
            ...s1.state.m,
            x: lerp(s1.state.m.x, s2.state.m.x, t),
            y: lerp(s1.state.m.y, s2.state.m.y, t)
        };
    }
    
    // Interpolate enemies by ID
    if (s1.state.e && s2.state.e) {
        interpolated.e = s1.state.e.map(e1 => {
            const e2 = s2.state.e.find(e => e.id === e1.id);
            if (e2) {
                return {
                    ...e1,
                    x: lerp(e1.x, e2.x, t),
                    y: lerp(e1.y, e2.y, t)
                };
            }
            return e1;
        });
    }
    
    // Interpolate asteroids by ID
    if (s1.state.a && s2.state.a) {
        interpolated.a = s1.state.a.map(a1 => {
            const a2 = s2.state.a.find(a => a.id === a1.id);
            if (a2) {
                return {
                    ...a1,
                    x: lerp(a1.x, a2.x, t),
                    y: lerp(a1.y, a2.y, t),
                    rot: lerp(a1.rot, a2.rot, t)
                };
            }
            return a1;
        });
    }
    
    // Interpolate projectiles by ID (Fixes vibrating)
    if (s1.state.b && s2.state.b) {
        interpolated.b = s1.state.b.map(b1 => {
            const b2 = s2.state.b.find(b => b.id === b1.id);
            if (b2) {
                return {
                    ...b1,
                    x: lerp(b1.x, b2.x, t),
                    y: lerp(b1.y, b2.y, t)
                };
            } else {
                // If it died in s2, extrapolate for the remaining bit of t
                return {
                    ...b1,
                    x: b1.x + (b1.vx || 0) * t * 2, // approximation
                    y: b1.y + (b1.vy || 0) * t * 2
                };
            }
        });
    }
    
    return interpolated;
}

// Room management
function createRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        showLobbyError("You MUST enter a name to create a room.");
        return;
    }
    const password = document.getElementById('roomPassword').value;
    const maxPlayersInput = document.getElementById('roomMaxPlayers');
    const maxPlayers = maxPlayersInput ? parseInt(maxPlayersInput.value, 10) : 8;
    
    // Advanced settings
    const waveDurationInput = document.getElementById('waveDuration');
    const damageMultiplierInput = document.getElementById('damageMultiplier');
    const goldMultiplierInput = document.getElementById('goldMultiplier');
    const difficultyInput = document.getElementById('difficulty');
    
    ws.send(JSON.stringify({
        type: 'create_room',
        password: password,
        playerName: playerName,
        maxPlayers: maxPlayers,
        settings: {
            waveDuration: waveDurationInput ? parseInt(waveDurationInput.value, 10) : 60,
            damageMultiplier: damageMultiplierInput ? parseFloat(damageMultiplierInput.value) : 1.0,
            goldMultiplier: goldMultiplierInput ? parseFloat(goldMultiplierInput.value) : 1.0,
            difficulty: difficultyInput ? difficultyInput.value : 'normal'
        }
    }));
}

function playSinglePlayer() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        showLobbyError("You MUST enter a name to play.");
        return;
    }
    
    // Advanced settings
    const waveDurationInput = document.getElementById('waveDuration');
    const damageMultiplierInput = document.getElementById('damageMultiplier');
    const goldMultiplierInput = document.getElementById('goldMultiplier');
    const difficultyInput = document.getElementById('difficulty');
    
    ws.send(JSON.stringify({
        type: 'create_room',
        playerName: playerName,
        password: '',
        maxPlayers: 1, // Restrict to 1 player for single-player
        settings: {
            waveDuration: waveDurationInput ? parseInt(waveDurationInput.value, 10) : 60,
            damageMultiplier: damageMultiplierInput ? parseFloat(damageMultiplierInput.value) : 1.0,
            goldMultiplier: goldMultiplierInput ? parseFloat(goldMultiplierInput.value) : 1.0,
            difficulty: difficultyInput ? difficultyInput.value : 'normal'
        }
    }));
}

function joinRoom() {
    const roomCodeInput = document.getElementById('roomCode').value.toUpperCase();
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!playerName) {
        showLobbyError("You MUST enter a name to join a room.");
        return;
    }
    const password = document.getElementById('roomPassword').value;
    
    if (roomCodeInput.length !== 4) {
        showLobbyError('Please enter a valid 4-letter room code');
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
    isDev = msg.players.find(p => p.id === playerId)?.isDev || false;
    console.log(`[DEBUG] Room Created: ${roomCode}, PlayerID: ${playerId}, isDev: ${isDev}`);
    
    const devStatusEl = document.getElementById('devStatus');
    if (devStatusEl) devStatusEl.style.display = isDev ? 'block' : 'none';
    
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
    isDev = msg.players.find(p => p.id === playerId)?.isDev || false;
    console.log(`[DEBUG] Room Joined: ${roomCode}, PlayerID: ${playerId}, isDev: ${isDev}`);
    
    const devStatusEl = document.getElementById('devStatus');
    if (devStatusEl) devStatusEl.style.display = isDev ? 'block' : 'none';
    
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

window.setFpsLimit = function(fps) {
    const val = parseInt(fps);
    if (val >= 240) {
        window.currentFrameMinTime = 0; // Uncapped
    } else {
        window.currentFrameMinTime = 1000 / val;
    }
};

// Game loop
function gameLoop(currentTime) {
    // FPS Limiter
    const delta = currentTime - lastFrameTime;
    if (delta < (window.currentFrameMinTime || FRAME_MIN_TIME)) {
        requestAnimationFrame(gameLoop);
        return;
    }
    lastFrameTime = currentTime;

    // LOCAL PREDICTION (Solo/Responsive Movement)
    if (gameState && !gamePaused) {
        predictLocalPlayer();
    }

    // Get the interpolated state for rendering
    renderState = getCurrentRenderState();
    
    if (!renderState) {
        requestAnimationFrame(gameLoop);
        return;
    }
    
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // Screen Shake
    if (shakeIntensity > 0) {
        ctx.save();
        const sx = (Math.random() - 0.5) * shakeIntensity;
        const sy = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(sx, sy);
        shakeIntensity *= 0.9;
        if (shakeIntensity < 0.1) shakeIntensity = 0;
    }

    // Draw game entities
    drawGame(renderState);

    if (shakeIntensity > 0) {
        ctx.restore();
    }
    
    // Update UI
    updateUI();

    // Update upgrade status if menu is open
    if (!upgradeMenu.classList.contains('hidden')) {
        updateUpgradeReadyStatus();
    }
    
    // Render escort target if applicable
    if (renderState.w && renderState.w.encounterType === 'escort' && renderState.w.targetX) {
        ctx.save();
        
        // Draw animated path from mothership to jump gate
        if (renderState.m) {
            ctx.beginPath();
            ctx.moveTo(renderState.m.x, renderState.m.y);
            ctx.lineTo(renderState.w.targetX, renderState.w.targetY);
            ctx.strokeStyle = 'rgba(52, 152, 219, 0.3)';
            ctx.lineWidth = 4;
            ctx.setLineDash([15, 15]);
            ctx.lineDashOffset = -(Date.now() / 50); // Scrolling dash effect
            ctx.stroke();
            
            // Draw distance text halfway
            const currDist = Math.hypot(renderState.w.targetX - renderState.m.x, renderState.w.targetY - renderState.m.y);
            const midX = (renderState.m.x + renderState.w.targetX) / 2;
            const midY = (renderState.m.y + renderState.w.targetY) / 2;
            
            ctx.setLineDash([]);
            ctx.fillStyle = '#3498db';
            ctx.font = 'bold 14px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(`JUMP DISTANCE: ${Math.floor(currDist)}m`, midX, midY - 20);
        }

        ctx.translate(renderState.w.targetX, renderState.w.targetY);
        
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
function drawGame(gs) {
    if (!gs) return;
    
    // Draw pickups
    gs.c?.forEach(pickup => {
        ctx.save();
        ctx.translate(pickup.x, pickup.y);
        
        let icon = '?';
        
        if (pickup.type === 'xp') {
            ctx.fillStyle = '#f39c12';
            ctx.shadowColor = '#f39c12';
            icon = '⭐';
        } else if (pickup.type === 'gold') {
            ctx.fillStyle = '#f1c40f'; // Yellow
            ctx.shadowColor = '#f1c40f';
            icon = '💰';
        } else if (pickup.type === 'health') {
            ctx.fillStyle = '#e74c3c'; // Red (changed from green)
            ctx.shadowColor = '#e74c3c';
            icon = '❤️';
        } else if (pickup.type === 'team_health') {
            ctx.fillStyle = '#1abc9c'; // Teal
            ctx.shadowColor = '#1abc9c';
            icon = '🤝';
        } else if (pickup.type === 'mothership_health') {
            ctx.fillStyle = '#3498db'; // Blue
            ctx.shadowColor = '#3498db';
            icon = '🛡️';
        } else if (pickup.type === 'rapidFire') {
            ctx.fillStyle = '#3498db';
            ctx.shadowColor = '#3498db';
            icon = '⚡';
        } else if (pickup.type === 'invincible') {
            ctx.fillStyle = '#9b59b6';
            ctx.shadowColor = '#9b59b6';
            icon = '⭐';
        } else if (pickup.type === 'doubleGold') {
            ctx.fillStyle = '#e67e22';
            ctx.shadowColor = '#e67e22';
            icon = 'x2';
        } else if (pickup.type === 'turbo') {
            ctx.fillStyle = '#1abc9c';
            ctx.shadowColor = '#1abc9c';
            icon = '🚀';
        } else if (pickup.type === 'megaShot') {
            ctx.fillStyle = '#c0392b';
            ctx.shadowColor = '#c0392b';
            icon = '💥';
        } else {
            ctx.fillStyle = '#9b59b6'; // Default Purple
            ctx.shadowColor = '#9b59b6';
        }
        ctx.shadowBlur = 10;
        
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner icon
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, 0, 1);
        
        ctx.restore();
    });
    
    // Draw asteroids
    gs.a?.forEach(asteroid => {
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
    gs.e?.forEach(enemy => {
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
        } else if (enemy.isVoidBreaker) {
            // Octagon shape for Void Breakers (Juggernauts)
            ctx.fillStyle = '#8e44ad'; // Deep purple to show tankiness
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2 + (Date.now() / 1000); // slow spin
                const r = enemy.radius;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            
            // We will also draw the reflect shield later
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

        // Draw Boss Boundary if applicable
        if (enemy.drawBoundary) {
            ctx.save();
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, enemy.boundaryRadius || enemy.radius + 30, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Draw Void Breaker Reflect Shield & Armor Details
        if (enemy.isVoidBreaker) {
            ctx.save();
            const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
            ctx.strokeStyle = `rgba(142, 68, 173, ${0.4 + pulse * 0.4})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, enemy.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
            
            // Draw thick armor cross inside
            ctx.strokeStyle = '#95a5a6';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-enemy.radius/2, -enemy.radius/2);
            ctx.lineTo(enemy.radius/2, enemy.radius/2);
            ctx.moveTo(enemy.radius/2, -enemy.radius/2);
            ctx.lineTo(-enemy.radius/2, enemy.radius/2);
            ctx.stroke();
            ctx.restore();
        }
        
        ctx.restore();
    });
    

    gs.d?.forEach(drone => {
        ctx.save();
        ctx.translate(drone.x, drone.y);
        
        if (drone.isSupport) {
            // Support Drone Rendering: Cross/Plus shape, Green/Teal
            ctx.fillStyle = '#1abc9c';
            ctx.strokeStyle = '#16a085';
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // White cross
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-6, -2, 12, 4);
            ctx.fillRect(-2, -6, 4, 12);
        } else {
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
        }
        
        ctx.restore();
    });
    
    // Draw mothership
    if (gs.m) {
        ctx.save();
        ctx.translate(gs.m.x, gs.m.y);
        
        // Auto-Turret Range Indicator
        if (gs.m.autoTurret > 0) {
            const range = gs.m.turretRange || 500;
            const pulse = (Math.sin(Date.now() / 500) + 1) / 2;
            ctx.strokeStyle = `rgba(52, 152, 219, ${0.1 + pulse * 0.1})`;
            ctx.setLineDash([10, 10]);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, range, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]); // Reset
        }
        
        // Shield
        if (gs.m.shield > 0) {
            ctx.strokeStyle = `rgba(155, 89, 182, ${gs.m.shield / gs.m.shieldMax})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, (gs.m.radius || 60) + 10, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Main body
        ctx.fillStyle = '#3498db';
        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.arc(0, 0, (gs.m.radius || 60), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Rotating ring
        ctx.rotate(gs.m.ringAngle);
        ctx.strokeStyle = '#5dade2';
        ctx.lineWidth = 2;
        
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, (gs.m.radius || 60) + 5, i * Math.PI / 4, i * Math.PI / 4 + Math.PI / 8);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    // Draw Merchants
    gs.merchants?.forEach(merch => {
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
        ctx.font = 'bold 18px Orbitron';
        ctx.fillText(merch.upgrade.name, 0, 75);
        
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(`${merch.upgrade.cost} GOLD`, 0, 95);
        
        ctx.font = '14px Arial';
        ctx.fillStyle = '#ecf0f1';
        // Simple wrap for description if too long
        const words = merch.upgrade.desc.split(' ');
        let line = '';
        let y = 115;
        const maxWidth = 160;
        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            if (ctx.measureText(testLine).width > maxWidth && i > 0) {
                ctx.fillText(line, 0, y);
                line = words[i] + ' ';
                y += 16;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, 0, y);
        
        ctx.restore();
    });
    
    // Draw players
    gs.p?.forEach(player => {
        ctx.save();
        
        // Use predicted position for local player if available
        let px = player.x;
        let py = player.y;
        if (player.id === playerId && window.localPredictedPos) {
            px = window.localPredictedPos.x;
            py = window.localPredictedPos.y;
        }

        ctx.translate(px, py);
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
        if (gs.hyperDriveBoost && player.alive) {
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

        // Draw Melee Spikes if upgraded
        if (player.upgradeLevels?.ram_spikes > 0) {
            ctx.strokeStyle = '#bdc3c7';
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                const sAngle = -Math.PI/4 + (i * Math.PI/4);
                ctx.beginPath();
                ctx.moveTo(Math.cos(sAngle) * pr, Math.sin(sAngle) * pr);
                ctx.lineTo(Math.cos(sAngle) * (pr + 8), Math.sin(sAngle) * (pr + 8));
                ctx.stroke();
            }
            
            // Trigger screen shake if close to enemy (local player only)
            if (player.id === playerId) {
                gs.e?.forEach(enemy => {
                    if (dist(player, enemy) < pr + enemy.radius + 10) {
                        applyShake(0.3);
                    }
                });
            }
        }
        
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
        
        // Player name and powerup timers
        if (player.alive) {
            ctx.fillStyle = player.color;
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(player.name || `Player ${player.id.slice(-4)}`, player.x, player.y - pr - 10);
            
            // Powerup timers
            if (player.powerups) {
                let yOffset = player.y - pr - 25;
                const activePowerups = Object.entries(player.powerups).filter(([_, time]) => time > 0);
                activePowerups.forEach(([type, time]) => {
                    const seconds = Math.ceil(time / 60);
                    let label = type.toUpperCase();
                    if (type === 'rapidFire') label = 'RAPID FIRE';
                    if (type === 'doubleGold') label = '2X GOLD';
                    if (type === 'megaShot') label = 'MEGA SHOT';
                    
                    ctx.fillStyle = '#f1c40f';
                    ctx.font = '10px Arial';
                    ctx.fillText(`${label}: ${seconds}s`, player.x, yOffset);
                    yOffset -= 12;
                });
            }
        }
    });
    
    // Entity Capping for Optimization
    const entityCap = window.isGraphicsOptimized ? 200 : 5000;
    
    // Draw projectiles
    const bulletsToDraw = (gs.b || []).slice(0, entityCap);
    bulletsToDraw.forEach(bullet => {
        ctx.save();
        ctx.translate(bullet.x, bullet.y);
        
        const size = 3 * (bullet.bulletSize || 1);
        
        let pColor = bullet.ownerColor || null;
        if (!pColor && bullet.ownerId) {
            const owner = gs.p?.find(p => p.id === bullet.ownerId);
            if (owner) pColor = owner.color;
        }
        
        // Optimization: Skip shadows for regular small bullets to save CPU/GPU
        if (size > 5 || bullet.type === 'laser' || bullet.type === 'homing_missile' || bullet.type === 'pulse_wave') {
            if (bullet.friendly) {
                ctx.fillStyle = pColor || '#f39c12';
                ctx.shadowColor = pColor || '#f39c12';
                ctx.strokeStyle = pColor || '#f39c12';
            } else {
                ctx.fillStyle = '#e74c3c';
                ctx.shadowColor = '#e74c3c';
                ctx.strokeStyle = '#e74c3c';
            }
            ctx.shadowBlur = 10;
        } else {
            ctx.fillStyle = bullet.friendly ? (pColor || '#f39c12') : '#e74c3c';
            ctx.shadowBlur = 0;
        }
        
        if (bullet.angle !== undefined) {
            ctx.rotate(bullet.angle);
        }
        
        if (bullet.type === 'laser') {
            const range = bullet.range || 500;
            const thickness = (bullet.width || 10) * 0.8;
            const alpha = (bullet.life / (bullet.maxLife || 20));
            
            ctx.save();
            ctx.globalAlpha = alpha;
            
            // Outer tight glow (Player Color)
            ctx.shadowBlur = 12;
            ctx.shadowColor = pColor || '#00f2ff';
            ctx.strokeStyle = pColor || 'rgba(0, 242, 255, 0.6)';
            ctx.lineWidth = thickness;
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(range, 0);
            ctx.stroke();
            
            // Core white line
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = thickness * 0.3;
            ctx.shadowBlur = 0;
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(range, 0);
            ctx.stroke();
            
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
        } else if (bullet.type === 'lightning') {
            const length = 40;
            ctx.save();
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00ffff';
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            
            // Draw jagged line
            let curX = 0;
            let curY = 0;
            const segments = 4;
            const step = length / segments;
            
            for (let i = 1; i <= segments; i++) {
                curX -= step;
                curY = (Math.random() - 0.5) * 15;
                ctx.lineTo(curX, curY);
            }
            ctx.stroke();
            
            // Core white line
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0;
            ctx.stroke();
            
            ctx.stroke();
            
            ctx.restore();
        } else if (bullet.type === 'pulse_wave') {
            const alpha = bullet.life / 25;
            const radius = bullet.radius || 20;
            const arc = bullet.arc || (Math.PI / 4);
            
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = pColor || '#00f2ff';
            ctx.shadowColor = pColor || '#00f2ff';
            ctx.shadowBlur = 10;
            ctx.lineWidth = 4;
            
            ctx.beginPath();
            ctx.arc(0, 0, radius, -arc/2, arc/2);
            ctx.stroke();
            
            ctx.restore();
        } else if (bullet.type === 'mine') {
            ctx.beginPath();
            ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Spikes
            ctx.strokeStyle = bullet.isArmed ? '#e74c3c' : '#f39c12';
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + (Date.now() / 1000);
                ctx.beginPath();
                ctx.moveTo(Math.cos(angle) * size * 1.5, Math.sin(angle) * size * 1.5);
                ctx.lineTo(Math.cos(angle) * size * 2.5, Math.sin(angle) * size * 2.5);
                ctx.stroke();
            }
            
            // Core blink
            if (Date.now() % 400 < 200) {
                ctx.fillStyle = bullet.isArmed ? '#ff0000' : '#f1c40f';
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (bullet.type === 'orbital') {
            const alpha = Math.max(0, Math.min(1, bullet.life / 20));
            const radius = bullet.radius || 150;
            
            ctx.restore(); // use global coordinates
            ctx.save();
            ctx.translate(bullet.x, bullet.y);
            
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#e74c3c';
            ctx.strokeStyle = `rgba(231, 76, 60, ${alpha})`;
            ctx.lineWidth = 10 * alpha;
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(0, radius * (1 - alpha)), 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = `rgba(231, 76, 60, ${alpha * 0.3})`;
            ctx.fill();
            
            ctx.restore();
            return;
        } else if (bullet.isShrapnelFragment || bullet.type === 'shrapnel') {
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#f39c12';
            ctx.fillStyle = '#f1c40f'; 
            
            ctx.beginPath();
            ctx.moveTo(size, 0);
            ctx.lineTo(size/2, size);
            ctx.lineTo(-size, size/2);
            ctx.lineTo(-size/2, -size);
            ctx.closePath();
            ctx.fill();
        } else if (bullet.type === 'blackhole_rift') {
            ctx.restore(); // Undo the translate/rotate
            ctx.save();
            ctx.translate(bullet.x, bullet.y);
            
            const pulse = (Math.sin(Date.now() / 150) + 1) / 2;
            const radius = bullet.radius || 150;
            const coreRadius = 20 + (radius * 0.1);
            
            // Outer Pull Radius Area
            const pullGrad = ctx.createRadialGradient(0, 0, coreRadius, 0, 0, radius);
            pullGrad.addColorStop(0, `rgba(142, 68, 173, ${0.15 + pulse * 0.1})`);
            pullGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = pullGrad;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fill();

            // Outer Edge Border
            ctx.strokeStyle = `rgba(142, 68, 173, ${0.4 + pulse * 0.3})`;
            ctx.setLineDash([10, 15]);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Inner Core
            const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, coreRadius);
            grad.addColorStop(0, '#000000');
            grad.addColorStop(0.5, '#4a235a');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, coreRadius + pulse * 5, 0, Math.PI * 2);
            ctx.fill();
            
            // Swirl particles (scaling with core)
            ctx.rotate(Date.now() / 200);
            ctx.strokeStyle = '#8e44ad';
            ctx.lineWidth = 3;
            for (let i = 0; i < 4; i++) {
                ctx.rotate(Math.PI / 2);
                ctx.beginPath();
                ctx.moveTo(coreRadius * 0.25, 0);
                ctx.quadraticCurveTo(coreRadius * 0.75, coreRadius * 0.5, coreRadius * 1.25, 0);
                ctx.stroke();
            }
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
    
    // Draw floating texts
    floatingTexts.forEach(ft => {
        ctx.save();
        ctx.translate(ft.x, ft.y - (ft.maxLife - ft.life) * 0.5);
        ctx.globalAlpha = ft.life / ft.maxLife;
        ctx.fillStyle = ft.playerId === playerId ? '#f1c40f' : '#bdc3c7';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, 0, 0);
        ctx.restore();
        ft.life--;
    });
    floatingTexts = floatingTexts.filter(ft => ft.life > 0);
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
        if (mHealthFill) mHealthFill.style.width = Math.max(0, healthPercent) + '%';
        
        // Also update the header bar if visible (used for quick status)
        const mHealthHeaderFill = document.getElementById('mothershipHealthHeader');
        if (mHealthHeaderFill) mHealthHeaderFill.style.width = Math.max(0, healthPercent) + '%';

        const mHullText = document.getElementById('mothershipHullText');
        if (mHullText) mHullText.textContent = `${Math.floor(gameState.m.hull)}/${gameState.m.maxHull}`;
        
        const shieldPercent = (gameState.m.shield / (gameState.m.shieldMax || 1)) * 100;
        const mShieldFill = document.getElementById('mothershipShield');
        if (mShieldFill) mShieldFill.style.width = (gameState.m.shieldMax > 0 ? Math.max(0, shieldPercent) : 0) + '%';
    }

    // Update Boss HUD
    const bossHud = document.getElementById('bossHud');
    const boss = gameState.e?.find(e => e.isBoss);
    if (boss && bossHud) {
        bossHud.classList.remove('hidden');
        
        // Dynamic Boss Naming
        const bossNameEl = document.getElementById('bossName');
        if (bossNameEl) {
            let name = "FLAGSHIP ALPHA";
            if (gameState.w.wave >= 50) name = "OVERLORD ULTRON";
            else if (gameState.w.wave >= 30) name = "COMMANDER CHARLIE";
            else if (gameState.w.wave >= 20) name = "SENTINEL BETA";
            bossNameEl.textContent = `${name} DETECTED`;
        }

        const bossHealth = document.getElementById('bossHealth');
        const bossHealthText = document.getElementById('bossHealthText');
        if (bossHealth) {
            const percent = (boss.hull / boss.maxHull) * 100;
            bossHealth.style.width = Math.max(0, percent) + '%';
            if (bossHealthText) bossHealthText.textContent = `${Math.floor(boss.hull)} / ${boss.maxHull} Hull HP`;
        }
        
        const phaseLabel = document.getElementById('bossPhaseLabel');
        if (phaseLabel) {
            const phase = boss.hull > boss.maxHull * 0.6 ? 1 : boss.hull > boss.maxHull * 0.3 ? 2 : 3;
            phaseLabel.textContent = `PHASE ${phase}: ${phase === 1 ? 'Shielding' : phase === 2 ? 'Overclocking' : 'Desperation'}`;
        }
    } else if (bossHud) {
        bossHud.classList.add('hidden');
    }
    
    // Update wave display
    if (gameState.w) {
        const waveDisplay = document.getElementById('waveDisplay');
        if (waveDisplay) waveDisplay.textContent = `WAVE ${gameState.w.wave}`;
        
        const encounterTypeTop = document.getElementById('encounterTypeTop');
        const encounterTypeBottom = document.getElementById('encounterTypeBottom');
        
        let objectiveText = gameState.w.encounterType === 'defense' ? 'DEFENSE WAVE' :
                           gameState.w.encounterType === 'escort' ? 'ESCORT MISSION' : 'SALVAGE FIELD';
        
        if (gameState.w.encounterType === 'salvage' && gameState.salvageCollected !== undefined) {
            objectiveText += ` (${gameState.salvageCollected}/10)`;
        }
        
        if (encounterTypeTop) encounterTypeTop.textContent = objectiveText;
        if (encounterTypeBottom) encounterTypeBottom.textContent = objectiveText;
    }
    
    // Update Gold
    const me = gameState.p?.find(p => p.id === playerId);
    const displayGold = me ? me.gold : (gameState.gold || 0);
    const goldDisplay = document.getElementById('xpDisplay');
    if (goldDisplay) goldDisplay.textContent = `GOLD: ${displayGold}`;
    
    // Update Wave Progress & Team XP
    if (gameState.w) {
        let wavePercent = (gameState.w.timer / gameState.w.duration) * 100;
        let progressText = '';
        
        if (gameState.w.encounterType === 'escort' && gameState.m && gameState.w.targetX) {
            const startDist = Math.hypot(gameState.w.targetX - (GAME_WIDTH * 0.15), gameState.w.targetY - (GAME_HEIGHT / 2));
            const currDist = Math.hypot(gameState.w.targetX - gameState.m.x, gameState.w.targetY - gameState.m.y);
            wavePercent = Math.max(0, Math.min(100, (1 - (currDist / startDist)) * 100));
            progressText = `ESCORTING... ${Math.floor(wavePercent)}%`;
        }
        const waveFill = document.getElementById('waveProgress');
        if (waveFill) {
            waveFill.style.width = Math.min(100, wavePercent) + '%';
            
            const waveDisplay = document.getElementById('waveDisplay');
            if (gameState.currentPhase === 'UPGRADE') {
                const upgradeTimeLeft = 60 - Math.floor((gameState.w.timer || 0) / 60);
                if (upgradeTimeLeft <= 0) {
                    upgradeMenu.classList.add('hidden');
                }
                if (waveDisplay) {
                    waveDisplay.textContent = `UPGRADE TIME (${Math.max(0, upgradeTimeLeft)}s)`;
                    waveDisplay.style.color = '#f1c40f';
                }
            } else {
                const secondsLeft = Math.ceil((gameState.w.duration - gameState.w.timer) / 60);
                if (waveDisplay) {
                    if (gameState.w.encounterType === 'merchant') {
                        waveDisplay.textContent = `WAVE ${gameState.w.wave} (SAFE ZONE)`;
                    } else {
                        waveDisplay.textContent = `WAVE ${gameState.w.wave}`;
                    }
                    waveDisplay.style.color = '#2ecc71';
                }
            }
        }
        
        // Timer HUD - Move inside progress bar
        const missionTimerEl = document.getElementById('missionTimerText');
        if (missionTimerEl && gameState.w) {
            const totalSeconds = Math.max(0, Math.ceil((gameState.w.duration - gameState.w.timer) / 60));
            const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
            const secs = (totalSeconds % 60).toString().padStart(2, '0');
            missionTimerEl.textContent = `${mins}:${secs}`;
        }

        // Visibility check for Lobby and Upgrade Phase
        const missionStatus = document.querySelector('.mission-status-container');
        const topHUD = document.querySelector('.top-center');
        const lobbyEl = document.getElementById('lobby');
        const upgradeMenuEl = document.getElementById('upgradeMenu');
        
        const isLobbyVisible = lobbyEl && !lobbyEl.classList.contains('hidden');
        const isUpgradeVisible = upgradeMenuEl && !upgradeMenuEl.classList.contains('hidden');
        
        if (isLobbyVisible || isUpgradeVisible) {
            if (missionStatus) missionStatus.classList.add('hidden');
            if (topHUD) topHUD.classList.add('hidden');
        } else {
            if (missionStatus) missionStatus.classList.remove('hidden');
            if (topHUD) topHUD.classList.remove('hidden');
        }
        
        const teamLevelLabel = document.getElementById('teamLevel');
        if (teamLevelLabel) teamLevelLabel.textContent = gameState.w.teamLevel || 1;
        
        const xpPercent = ((gameState.w.teamXP || 0) / (gameState.w.teamXPNext || 100)) * 100;
        const xpFill = document.getElementById('teamXPBar');
        if (xpFill) xpFill.style.width = xpPercent + '%';
        
        const xpLabel = document.getElementById('xpLabel');
        if (xpLabel) xpLabel.textContent = `XP: ${Math.floor(gameState.w.teamXP)} / ${gameState.w.teamXPNext}`;
    }
    
    // Update player list and vitals
    if (gameState.p) {
        const playerList = document.getElementById('playerList');
        if (playerList) {
            playerList.innerHTML = ''; // Redundant, already in vitals
        }

        const vitalsList = document.getElementById('vitalsList');
        if (vitalsList) {
            let html = gameState.p.map(p => {
                const hPercent = (p.hull / p.maxHull) * 100;
                const sPercent = p.shieldMax > 0 ? (p.shield / p.shieldMax) * 100 : 0;
                return `
                    <div style="margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; font-size: 10px; color: ${p.color}; margin-bottom: 2px;">
                            <span>${p.name || 'Pilot'}</span>
                            <span>${p.alive ? Math.floor(p.hull) + ' HP' : '<span style="color:#e74c3c">DESTROYED</span>'}</span>
                        </div>
                        <div style="height: 3px; background: rgba(255,255,255,0.1); border-radius: 1px; overflow: hidden;">
                            <div style="height: 100%; width: ${p.alive ? hPercent : 0}%; background: ${p.color};"></div>
                        </div>
                        ${p.shieldMax > 0 ? `
                        <div style="height: 2px; background: rgba(255,255,255,0.05); border-radius: 1px; overflow: hidden; margin-top: 1px;">
                            <div style="height: 100%; width: ${sPercent}%; background: #3498db;"></div>
                        </div>` : ''}
                        ${(p.mineCooldown !== undefined && p.mineMaxCooldown > 0) ? `
                        <div style="height: 2px; background: rgba(0,0,0,0.3); border-radius: 1px; overflow: hidden; margin-top: 1px;">
                            <div style="height: 100%; width: ${((p.mineMaxCooldown - p.mineCooldown) / p.mineMaxCooldown) * 100}%; background: #f39c12; transition: width 0.1s linear;"></div>
                        </div>` : ''}
                    </div>
                `;
            }).join('');
            
            const me = gameState.p.find(p => p.id === playerId);
            if (me) {
                if (me.fireRateWarning) {
                    html += `<div style="margin-top: 10px; padding: 10px; border-radius: 5px; background: rgba(231, 76, 60, 0.2); border-left: 3px solid #e74c3c;">`;
                    html += `<div style="font-size: 10px; color: #e74c3c; font-weight: bold; margin-bottom: 2px;">SYSTEM OVERLOAD WARNING</div>`;
                    html += `<div style="font-size: 9px; color: #ecf0f1;">High projectile count (10+) detected. Weapon fire rate has been dynamically throttled to prevent core meltdown.</div>`;
                    html += `</div>`;
                }
                
                if (me.powerups) {
                const activeBuffs = Object.entries(me.powerups).filter(([_, time]) => time > 0);
                if (activeBuffs.length > 0) {
                    html += `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">`;
                    html += `<div style="font-size: 10px; color: #f1c40f; font-weight: bold; margin-bottom: 5px;">ACTIVE BUFFS (TEAM)</div>`;
                    activeBuffs.forEach(([type, time]) => {
                        const seconds = Math.ceil(time / 60);
                        let label = type.toUpperCase();
                        if (type === 'rapidFire') label = 'RAPID FIRE (2x Fire Rate)';
                        if (type === 'invincible') label = 'INVINCIBLE (No Damage)';
                        if (type === 'doubleGold') label = 'DOUBLE GOLD (2x Drops)';
                        if (type === 'turbo') label = 'TURBO BOOST (1.5x Speed)';
                        if (type === 'megaShot') label = 'MEGA SHOT (3x Damage)';
                        html += `<div style="font-size: 10px; color: #ecf0f1; display: flex; justify-content: space-between; margin-bottom: 2px;">
                            <span>${label}</span>
                            <span style="color: #f1c40f;">${seconds}s</span>
                        </div>`;
                    });
                    html += `</div>`;
                }
            }
            } // Close if (me)
            
            vitalsList.innerHTML = html;
            
            // Drone Status Update
            const droneStatusDiv = document.getElementById('droneStatus');
            const droneBars = document.getElementById('droneBars');
            if (droneStatusDiv && droneBars && gameState.drones && gameState.drones.length > 0) {
                droneStatusDiv.style.display = 'block';
                droneBars.innerHTML = gameState.drones.map((d, idx) => {
                    if (d.isSupport) {
                        return `
                            <div style="margin-bottom: 4px;">
                                <div style="display: flex; justify-content: space-between; font-size: 8px; color: #2ecc71;">
                                    <span>SUPPORT UNIT ${idx+1}</span>
                                    <span>ACTIVE</span>
                                </div>
                                <div style="height: 3px; background: rgba(46, 204, 113, 0.2); border-radius: 1px; overflow: hidden;">
                                    <div style="height: 100%; width: 100%; background: #2ecc71; box-shadow: 0 0 5px #2ecc71;"></div>
                                </div>
                            </div>
                        `;
                    } else {
                        const reloadPercent = d.fireCooldown ? (1 - (d.fireCooldown / 30)) * 100 : 100;
                        return `
                            <div style="margin-bottom: 4px;">
                                <div style="display: flex; justify-content: space-between; font-size: 8px; color: #9b59b6;">
                                    <span>COMBAT UNIT ${idx+1}</span>
                                    <span>${reloadPercent < 100 ? 'RELOADING' : 'READY'}</span>
                                </div>
                                <div style="height: 3px; background: rgba(155, 89, 182, 0.2); border-radius: 1px; overflow: hidden;">
                                    <div style="height: 100%; width: ${reloadPercent}%; background: #9b59b6;"></div>
                                </div>
                            </div>
                        `;
                    }
                }).join('');
            } else if (droneStatusDiv) {
                droneStatusDiv.style.display = 'none';
            }
            
            // Powerup Notifications Check
            if (me && me.powerups) {
                if (!window.lastPowerupState) window.lastPowerupState = {};
                
                Object.entries(me.powerups).forEach(([type, time]) => {
                    if (time > 0 && (!window.lastPowerupState[type] || window.lastPowerupState[type] <= 0)) {
                        showPowerupNotification(type);
                    }
                });
                window.lastPowerupState = { ...me.powerups };
            }
        }
    }

    // Update PVP Scoreboard
    const pvpBoard = document.getElementById('pvpScoreboard');
    if (pvpBoard) {
        if (gameState.w && gameState.w.encounterType === 'pvp' && gameState.pvpScores) {
            pvpBoard.classList.remove('hidden');
            const pvpScoresList = document.getElementById('pvpScoresList');
            if (pvpScoresList) {
                pvpScoresList.innerHTML = Object.entries(gameState.pvpScores).map(([id, score]) => {
                    const p = gameState.p.find(player => player.id === id);
                    const name = p ? p.name : 'Unknown';
                    const color = p ? p.color : '#fff';
                    return `<div style="color: ${color}; display: flex; justify-content: space-between;"><span>${name}</span> <span>${score} KILLS</span></div>`;
                }).join('');
            }
            
            const encounterTypeTop = document.getElementById('encounterTypeTop');
            if (encounterTypeTop) encounterTypeTop.textContent = 'FREE FOR ALL ARENA';
        } else {
            pvpBoard.classList.add('hidden');
        }
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
    
    const debugPing = document.getElementById('debugPing');
    if (debugPing) {
        const interp = window._debugInterp || { t: 0, buf: 0, offset: 0 };
        debugPing.textContent = `${ping}ms (t:${interp.t} buf:${interp.buf})`;
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
        
        if (gameState.w && gameState.w.encounterType === 'merchant') {
            updateJumpUI();
            if (gameState.currentPhase === 'COMBAT' && distToMothership < 150) {
                jumpPanel.classList.remove('hidden');
            } else {
                jumpPanel.classList.add('hidden');
            }
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
    
    // Also update the static button in the merchant panel
    const merchReadyBtn = document.getElementById('merchReadyBtn');
    if (merchReadyBtn) {
        merchReadyBtn.textContent = isReady ? 'READY!' : 'READY TO JUMP';
        merchReadyBtn.className = `btn ${isReady ? 'btn-secondary' : 'btn-primary'}`;
        merchReadyBtn.onclick = () => {
            ws.send(JSON.stringify({ type: 'merchant_ready' }));
        };
    }
}

function showPowerupNotification(type) {
    const container = document.getElementById('powerupNotifications');
    if (!container) return;
    
    const notifications = {
        rapidFire: { name: 'RAPID FIRE', desc: 'Weapon fire rate doubled for 15s', color: '#e74c3c' },
        invincible: { name: 'INVINCIBILITY', desc: 'Phase shift active: No damage for 10s', color: '#3498db' },
        doubleGold: { name: '2X GOLD', desc: 'Resource extraction doubled for 20s', color: '#f1c40f' },
        turbo: { name: 'TURBO BOOST', desc: 'Engine output increased by 50% for 12s', color: '#2ecc71' },
        megaShot: { name: 'MEGA SHOT', desc: 'Projectile mass and damage tripled for 10s', color: '#9b59b6' }
    };
    
    const info = notifications[type] || { name: type.toUpperCase(), desc: 'Active powerup', color: '#f1c40f' };
    
    const div = document.createElement('div');
    div.style.background = 'rgba(0,0,0,0.7)';
    div.style.borderLeft = `4px solid ${info.color}`;
    div.style.padding = '8px';
    div.style.borderRadius = '0 4px 4px 0';
    div.style.animation = 'slideInRight 0.3s ease-out';
    div.style.pointerEvents = 'none';
    div.innerHTML = `
        <div style="font-size: 11px; color: ${info.color}; font-weight: bold; margin-bottom: 2px;">${info.name} ACTIVATED</div>
        <div style="font-size: 9px; color: #bdc3c7;">${info.desc}</div>
    `;
    
    container.appendChild(div);
    
    setTimeout(() => {
        div.style.animation = 'fadeOut 1s ease-out forwards';
        setTimeout(() => div.remove(), 1000);
    }, 5000);
}

function showMerchantUI(merch, player) {
    const panel = document.getElementById('merchantPanel');
    if (!panel) return;
    
    panel.classList.remove('hidden');
    document.getElementById('merchUpgradeName').textContent = merch.upgrade.name;
    document.getElementById('merchUpgradeDesc').textContent = merch.upgrade.description;
    
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
    
    window.isSelectingUpgrade = false;
    
    // Prevent DOM thrashing: don't rebuild if nothing changed
    const optionsContainer = document.getElementById('upgradeOptions');
    if (lastUpgradeMsg) {
        const sameOptions = JSON.stringify(msg.options) === JSON.stringify(lastUpgradeMsg.options);
        const sameGold = msg.gold === lastUpgradeMsg.gold;
        const samePinned = JSON.stringify(msg.pinnedIds || []) === JSON.stringify(lastUpgradeMsg.pinnedIds || []);
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
        div.className = 'upgrade-option-new';
        const isPinned = msg.pinnedIds && msg.pinnedIds.includes(option.id);
        
        // Category data
        let category = 'PLAYER';
        let badgeColor = '#95a5a6';
        let icon = 'fa-rocket';
        
        if (option.type === 'mothership') { 
            category = 'MOTHERSHIP'; 
            badgeColor = '#e67e22'; 
            icon = 'fa-shield-alt';
        } else if (option.type === 'special' || option.type === 'omega') { 
            category = 'OMEGA'; 
            badgeColor = '#9b59b6'; 
            icon = 'fa-crown';
        } else {
            const weapons = ['laser', 'pulse_wave', 'homing_missile', 'mines'];
            const augments = ['homing', 'explosive', 'bullet_size', 'shrapnel', 'chain_lightning', 'multishot', 'piercing', 'damage', 'fire_rate'];
            if (weapons.includes(option.id)) { category = 'WEAPON'; badgeColor = '#e74c3c'; icon = 'fa-crosshairs'; }
            else if (augments.includes(option.id)) { category = 'AUGMENT'; badgeColor = '#3498db'; icon = 'fa-microchip'; }
            else { category = 'STAT'; badgeColor = '#2ecc71'; icon = 'fa-bolt'; }
        }

        const currentLevel = (msg.levels && msg.levels[option.id]) || 0;
        const cost = option.costs[currentLevel];
        const me = gameState.p?.find(p => p.id === playerId);
        const canAfford = (me ? me.gold : 0) >= cost;
        
        div.innerHTML = `
            <div class="upgrade-icon-container" style="background: ${badgeColor}22; color: ${badgeColor};">
                <i class="fas ${icon}"></i>
            </div>
            <div class="upgrade-content">
                <div class="upgrade-header">
                    <span class="upgrade-category" style="color: ${badgeColor}">${category}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${currentLevel > 0 ? `<span class="upgrade-level" style="color: #2ecc71;">OWNED (LVL ${currentLevel})</span>` : ''}
                        <span class="upgrade-level">${currentLevel > 0 ? 'NEXT:' : ''} LVL ${currentLevel + 1}</span>
                    </div>
                </div>
                <h3 class="upgrade-title">${option.name}</h3>
                <p class="upgrade-desc">${option.description}</p>
                <div class="upgrade-footer">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button class="pin-btn ${isPinned ? 'active' : ''}" 
                                onclick="event.stopPropagation(); ws.send(JSON.stringify({type: 'pin_upgrade', upgradeId: '${option.id}'}))"
                                title="${isPinned ? 'Unlock Upgrade' : 'Lock Upgrade (Keep in pool)'}">
                            <i class="fas ${isPinned ? 'fa-lock' : 'fa-lock-open'}"></i>
                        </button>
                        ${isPinned ? '<span style="color: #f1c40f; font-size: 10px; font-weight: bold; letter-spacing: 1px;">LOCKED</span>' : ''}
                    </div>
                    <div class="upgrade-cost ${canAfford ? 'affordable' : 'expensive'}">
                        <i class="fas fa-coins"></i> ${cost}
                    </div>
                </div>
            </div>
            ${!canAfford ? '<div class="locked-overlay"><i class="fas fa-lock"></i></div>' : ''}
        `;
        
        if (canAfford) {
            div.onclick = () => {
                if (window.isSelectingUpgrade) return;
                
                // Visual feedback
                div.style.transform = 'scale(0.95)';
                div.style.boxShadow = `0 0 30px ${badgeColor}aa`;
                div.style.borderColor = badgeColor;
                
                selectUpgrade(option.id);
            };
        } else {
            div.classList.add('disabled');
        }
        
        if (isPinned) div.classList.add('pinned-border');
        
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
    if (window.isSelectingUpgrade) return;
    window.isSelectingUpgrade = true;
    
    ws.send(JSON.stringify({
        type: 'upgrade_select',
        upgradeId: upgradeId
    }));
    // Optimistically lock UI to prevent double clicks and improve feedback
    const options = document.querySelectorAll('.upgrade-option-new');
    options.forEach(opt => {
        opt.style.pointerEvents = 'none';
        opt.style.opacity = '0.5';
    });
}

function rerollUpgrades() {
    ws.send(JSON.stringify({ type: 'reroll_upgrades' }));
}

function handleUpgradeApplied(msg) {
    // Already handled via state update
    updateUpgradeReadyStatus();
}

function handleSuperUpgradePhase(msg) {
    console.log('[UI] Showing super upgrade menu');
    const superUpgradeMenu = document.getElementById('superUpgradeMenu');
    if (superUpgradeMenu) {
        superUpgradeMenu.classList.remove('hidden');
        superUpgradeMenu.style.display = 'block';
    }
}

function selectSuperUpgrade(upgradeId) {
    ws.send(JSON.stringify({
        type: 'select_super_upgrade',
        upgradeId: upgradeId
    }));
    
    // Hide menu optimistically
    const superUpgradeMenu = document.getElementById('superUpgradeMenu');
    if (superUpgradeMenu) {
        superUpgradeMenu.classList.add('hidden');
        superUpgradeMenu.style.display = 'none';
    }
}

function handleUpgradeRerolled(msg) {
    handleUpgradeMenu(msg);
}

function handleUpgradePinned(msg) {
    // Force a re-render of the menu with the new pinned status
    // We need to keep the options from the previous message
    const msgCopy = Object.assign({}, lastUpgradeMsg);
    msgCopy.pinnedIds = msg.pinnedIds;
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
    
    const allPossible = [
        { id: 'survivor_30', name: 'Survivor', desc: 'Survive 30 seconds', hint: 'Survive for at least 30 seconds in any wave.' },
        { id: 'slayer_100', name: 'Enemy Slayer', desc: 'Destroy 100 enemies', hint: 'Rack up 100 kills across your session.' },
        { id: 'wave_15', name: 'Veteran', desc: 'Reach Wave 15', hint: 'Complete the final wave and face the boss.' },
        { id: 'mothership_hero', name: 'Fleet Guardian', desc: 'Mothership hull never below 50%', hint: 'Keep the mothership well-protected until wave 10.' },
        { id: 'gold_hoarder', name: 'Gold Hoarder', desc: 'Collect 5000 Gold', hint: 'Accumulate 5000 total gold in a single run.' },
        { id: 'speed_demon', name: 'Speed Demon', desc: 'Reach Max Speed Upgrade', hint: 'Upgrade your ship speed to level 10.' }
    ];

    allPossible.forEach(ach => {
        const isUnlocked = unlockedAchievements.includes(ach.id);
        const div = document.createElement('div');
        div.className = 'achievement-item';
        div.title = ach.hint; // Hover hint
        div.style.background = isUnlocked ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255, 255, 255, 0.05)';
        div.style.border = `1px solid ${isUnlocked ? '#2ecc71' : '#34495e'}`;
        div.style.padding = '15px';
        div.style.borderRadius = '8px';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.opacity = isUnlocked ? '1' : '0.6';
        div.style.cursor = 'help';
        div.style.transition = 'all 0.2s ease';

        div.onclick = () => {
            alert(`${ach.name}: ${ach.hint}\nStatus: ${isUnlocked ? 'UNLOCKED' : 'LOCKED'}`);
        };

        div.innerHTML = `
            <div style="pointer-events: none;">
                <h4 style="color: ${isUnlocked ? '#2ecc71' : '#bdc3c7'}; margin: 0 0 5px 0; font-size: 16px;">${ach.name}</h4>
                <p style="font-size: 12px; color: #7f8c8d; margin: 0;">${ach.desc}</p>
            </div>
            <div style="font-size: 24px; pointer-events: none;">${isUnlocked ? '🏆' : '🔒'}</div>
        `;
        list.appendChild(div);
    });
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
        showLobbyError("You MUST enter a name to play.");
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
}
    
function onGameStarted() {
    const lobby = document.getElementById('lobby');
    const gameContainer = document.getElementById('gameContainer');
    const ui = document.getElementById('ui');

    if (lobby) lobby.classList.add('hidden');
    if (gameContainer) gameContainer.classList.remove('hidden');
    if (ui) ui.classList.remove('hidden');
    
    console.log("[DEBUG] Game Started, Hotkeys Active");
}

let gamePaused = false;
function togglePauseMenu() {
    const pauseMenu = document.getElementById('pauseMenu');
    if (!pauseMenu) return;
    
    ws.send(JSON.stringify({ type: 'toggle_pause' }));
    
    if (pauseMenu.classList.contains('hidden')) {
        pauseMenu.classList.remove('hidden');
        pauseMenu.style.display = 'block';
        
        // Update room code text based on visibility toggle
        const codeSpan = document.getElementById('pauseRoomCodeText');
        if (codeSpan) {
            const icon = document.getElementById('toggleRoomCodeIcon');
            const isHidden = icon && icon.classList.contains('fa-eye-slash');
            codeSpan.textContent = `ROOM: ${isHidden ? '****' : (roomCode || 'SINGLE PLAYER')}`;
        } else {
            // Fallback for older UI
            const prc = document.getElementById('pauseRoomCode');
            if (prc) prc.textContent = roomCode ? `ROOM: ${roomCode}` : 'SINGLE PLAYER';
        }
    } else {
        pauseMenu.classList.add('hidden');
        pauseMenu.style.display = 'none';
    }
}

// Input handling
function setupInputHandlers() {
    console.log("[DEBUG] Setting up input handlers...");
    // Keyboard input
    window.addEventListener('keydown', (e) => {
        if (e.key === 'w' || e.key === 'W') keys.w = true;
        if (e.key === 'a' || e.key === 'A') keys.a = true;
        if (e.key === 's' || e.key === 'S') keys.s = true;
        if (e.key === 'd' || e.key === 'D') keys.d = true;
        if (e.key === 'ArrowUp') keys.ArrowUp = true;
        if (e.key === 'ArrowDown') keys.ArrowDown = true;
        if (e.key === 'ArrowLeft') keys.ArrowLeft = true;
        if (e.key === 'ArrowRight') keys.ArrowRight = true;
        // Game-only Hotkeys
        if (!document.getElementById('lobby').classList.contains('hidden')) return;

        if (e.key === 'Tab') {
            console.log(`[DEBUG] Status Hotkey Pressed: ${e.key}`);
            e.preventDefault();
            toggleStatusPanel();
        }
        if (e.key === 'Escape') togglePauseMenu();
        if (e.key === '`') {
            console.log(`[DEBUG] Dev Panel Hotkey Pressed: ${e.key}`);
            e.preventDefault();
            // Toggle Dev Panel if player is DevMode
            if (isDev) {
                const devPanel = document.getElementById('devPanel');
                if (devPanel) {
                    devPanel.classList.toggle('hidden');
                    if (!devPanel.classList.contains('hidden')) {
                        // Populate upgrade select if empty
                        const select = document.getElementById('devUpgradeSelect');
                        if (select && (select.options.length <= 1 || compendiumData.length > 0)) {
                            if (compendiumData.length === 0) {
                                ws.send(JSON.stringify({ type: 'get_compendium' }));
                            } else {
                                // Already sorted in compendium_data handler
                                const currentVal = select.value;
                                select.innerHTML = compendiumData.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
                                if (currentVal) select.value = currentVal;
                                updateDevUpgradeDescription();
                            }
                        }
                    }
                }
            }
        }
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

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // Prevent browser right-click menu
    });
    
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
            // Right click
            if (ws && ws.readyState === WebSocket.OPEN && !gamePaused) {
                ws.send(JSON.stringify({ type: 'right_click', x: mouseX, y: mouseY }));
            }
            return;
        }
        
        mouseDown = true;
        
        // Merchant click check
        if (gameState && gameState.merchants) {
            for (let i = 0; i < gameState.merchants.length; i++) {
                const merch = gameState.merchants[i];
                const d = Math.hypot(mouseX - merch.x, mouseY - merch.y);
                if (d < 50) { // Merchant hit radius
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'buy_merchant',
                            merchantId: merch.id
                        }));
                    }
                    break;
                }
            }
        }
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

            // Audio init on interaction
            if (mouseDown || keys.w || keys.a || keys.s || keys.d) {
                audio.init();
                audio.startMusic();
            }

            const currentInputString = JSON.stringify(currentInput);
            if (currentInputString !== lastInputString) {
                ws.send(currentInputString);
                lastInputString = currentInputString;
                
                const localPlayer = gameState.p.find(p => p.id === playerId);
                // Boss check
                if (!window.bossSpawning && gameState.e.some(e => e.isBoss)) {
                    window.bossSpawning = true;
                    audio.playBossSpawn();
                } else if (window.bossSpawning && !gameState.e.some(e => e.isBoss)) {
                    window.bossSpawning = false;
                }
            }
        }
    }, 1000 / 60); // Check 60 times a sec, but only send if dirty
}

// Initialize
window.addEventListener('load', () => {
    resizeCanvas();
    setupInputHandlers();
    
    // Setup UI event listeners
    const statusBtn = document.getElementById('toggleStatusBtn');
    statusBtn?.addEventListener('click', () => {
        toggleStatusPanel();
    });

    // Make panels draggable
    const devPanel = document.getElementById('devPanel');
    const devHandle = document.getElementById('devPanelHandle');
    if (devPanel && devHandle) makeDraggable(devPanel, devHandle);

    const statusPanel = document.getElementById('statusPanel');
    if (statusPanel) makeDraggable(statusPanel, statusPanel.querySelector('h3'));

    // Upgrade select listener
    const devUpgradeSelect = document.getElementById('devUpgradeSelect');
    devUpgradeSelect?.addEventListener('change', updateDevUpgradeDescription);

    connectWebSocket();
    gameLoop();
});

function updateDevUpgradeDescription() {
    const select = document.getElementById('devUpgradeSelect');
    const desc = document.getElementById('devUpgradeDesc');
    if (!select || !desc || !compendiumData) return;
    
    const upgrade = compendiumData.find(u => u.id === select.value);
    if (upgrade) {
        desc.innerHTML = `<strong>${upgrade.name}</strong> (MAX: ${upgrade.max})<br>${upgrade.description}`;
        desc.style.borderLeftColor = '#e74c3c';
        desc.style.display = 'block'; // Ensure visible
    }
}

function makeDraggable(el, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
        el.style.transform = 'none'; // Remove centring transform once dragged
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// Global debug helper
window.forceShowDev = () => {
    console.log("[DEBUG] Manually forcing dev panel show");
    const devPanel = document.getElementById('devPanel');
    if (devPanel) devPanel.classList.remove('hidden');
    const devStatus = document.getElementById('devStatus');
    if (devStatus) devStatus.style.display = 'block';
    isDev = true;
};

function showLobbyError(text) {
    const err = document.getElementById('lobbyError');
    if (err) {
        err.textContent = text;
        setTimeout(() => { if (err.textContent === text) err.textContent = ''; }, 3000);
    }
}

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
                const displayName = player.name || 'Pilot';
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

function handleEndgameVoteStart(msg) {
    const modal = document.getElementById('endgameVoteModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    
    document.getElementById('endgameTitle').textContent = msg.text || 'VICTORY!';
    document.getElementById('endgameSub').textContent = msg.sub || 'Choose your final path:';
    
    // Bind buttons
    document.getElementById('voteFinishBtn').onclick = () => {
        ws.send(JSON.stringify({ type: 'vote_endgame', choice: 'finish' }));
    };
    document.getElementById('votePvpBtn').onclick = () => {
        ws.send(JSON.stringify({ type: 'vote_endgame', choice: 'pvp' }));
    };
    
    const endlessBtn = document.getElementById('voteEndlessBtn');
    if (endlessBtn) {
        endlessBtn.onclick = () => {
            ws.send(JSON.stringify({ type: 'vote_endgame', choice: 'endless' }));
        };
    }
}

function handleEndgameVoteUpdate(msg) {
    const statsDiv = document.getElementById('endgameVoteStats');
    if (!statsDiv) return;
    
    const votes = msg.votes || {};
    const totalVotes = Object.keys(votes).length;
    const totalPlayers = gameState.p?.length || 1;
    
    statsDiv.textContent = `Votes: ${totalVotes} / ${totalPlayers} pilots confirmed`;
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
                const isDev = e.isDev || (e.names && e.names.includes('[DEV]'));
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
                
                // Dev runs don't get a rank number
                const rankDisplay = isDev ? '<span style="color:#e74c3c;font-size:10px;">DEV</span>' : (i + 1);
                const nameDisplay = isDev ? `<span style="color:#e74c3c;font-style:italic;">${e.names}</span>` : e.names;

                return `
                    <tr style="background:${rowBg}; border-bottom:1px solid rgba(255,255,255,0.05); ${isDev ? 'opacity: 0.8;' : ''}">
                        <td style="padding:10px 6px; color:${isDev ? '#e74c3c' : goldColor}; font-weight:bold;">${rankDisplay}</td>
                        <td style="padding:10px 6px; color:#ecf0f1;">${nameDisplay}</td>
                        <td style="padding:10px 6px; text-align:center;">${modeBadge}</td>
                        <td style="padding:10px 6px; text-align:center; color:#2ecc71; font-weight:bold;">${e.waves}</td>
                        <td style="padding:10px 6px; text-align:center; color:#e74c3c;">${e.kills}</td>
                        <td style="padding:10px 6px; text-align:center; color:#bdc3c7; font-family:monospace;">${mins}:${secs}</td>
                        <td style="padding:10px 6px; text-align:center;">${resultBadge}</td>
                    </tr>`;
            }).join('');
        })
        .catch(() => {
        });
}



function toggleRoomCodeVisibility() {
    const codeSpan = document.getElementById('pauseRoomCodeText');
    const icon = document.getElementById('toggleRoomCodeIcon');
    if (!codeSpan || !icon) return;
    
    if (icon.classList.contains('fa-eye-slash')) {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
        codeSpan.textContent = `ROOM: ${roomCode || 'SINGLE PLAYER'}`;
    } else {
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        codeSpan.textContent = `ROOM: ****`;
    }
}




// Ensure gameover also hides the endgame modal
const originalHandleGameOver = handleGameOver;
handleGameOver = (msg) => {
    document.getElementById('endgameVoteModal').classList.add('hidden');
    originalHandleGameOver(msg);
};

function sendDevAction(action, data = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'dev_action',
            action: action,
            data: data
        }));
    }
}

// Helper functions for interpolation
function dist(p1, p2) {
    if (!p1 || !p2) return 0;
    return Math.hypot((p2.x || 0) - (p1.x || 0), (p2.y || 0) - (p1.y || 0));
}

function angle(p1, p2) {
    if (!p1 || !p2) return 0;
    return Math.atan2((p2.y || 0) - (p1.y || 0), (p2.x || 0) - (p1.x || 0));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function predictLocalPlayer() {
    const me = gameState?.p?.find(p => p.id === playerId);
    if (!me || !me.alive) {
        window.localPredictedPos = null;
        return;
    }

    if (!window.localPredictedPos) {
        window.localPredictedPos = { x: me.x, y: me.y };
    }

    // Base speed from PLAYER.SPEED = 2.8, plus upgrades
    const speed = me.speed || 2.8;
    let dx = 0;
    let dy = 0;

    if (keys.w) dy -= 1;
    if (keys.s) dy += 1;
    if (keys.a) dx -= 1;
    if (keys.d) dx += 1;

    if (dx !== 0 || dy !== 0) {
        const mag = Math.sqrt(dx * dx + dy * dy);
        window.localPredictedPos.x += (dx / mag) * speed;
        window.localPredictedPos.y += (dy / mag) * speed;
    }

    // Bounds check
    window.localPredictedPos.x = Math.max(0, Math.min(GAME_WIDTH, window.localPredictedPos.x));
    window.localPredictedPos.y = Math.max(0, Math.min(GAME_HEIGHT, window.localPredictedPos.y));

    // Smooth Reconciliation
    // Gently pull predicted position toward server authoritative position
    const distToMe = Math.hypot(window.localPredictedPos.x - me.x, window.localPredictedPos.y - me.y);
    if (distToMe > 120) {
        window.localPredictedPos.x = me.x;
        window.localPredictedPos.y = me.y;
    } else if (distToMe > 0.5) {
        window.localPredictedPos.x = lerp(window.localPredictedPos.x, me.x, 0.15);
        window.localPredictedPos.y = lerp(window.localPredictedPos.y, me.y, 0.15);
    }
}
