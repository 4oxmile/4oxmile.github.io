'use strict';

// ── Constants ────────────────────────────────────────────────────────────────
const PLAYER_RADIUS     = 14;
const ARROW_RADIUS      = 7;
const ARROW_LENGTH      = 22;
const ARROW_HEAD        = 9;
const POWERUP_RADIUS    = 14;
const PARTICLE_COUNT    = 6;
const TRAIL_MAX         = 18;
const BASE_ARROW_SPEED  = 220;   // px/s at t=0
const SPEED_SCALE       = 0.28;  // speed multiplier per 10s survived
const BASE_SPAWN_INTERVAL = 1.1; // seconds between spawns at t=0
const SPAWN_MIN         = 0.28;
const POWERUP_INTERVAL  = 12;    // seconds between power-up chances
const SHIELD_DURATION   = 5000;  // ms
const SLOW_DURATION     = 5000;  // ms
const SLOW_FACTOR       = 0.38;
const LS_KEY            = 'dodge_highscore';

// ── Colours (pulled from CSS vars at runtime) ────────────────────────────────
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ── State ────────────────────────────────────────────────────────────────────
let canvas, ctx;
let W, H;
let animId = null;
let gameState = 'start'; // 'start' | 'playing' | 'dead'

let player, arrows, particles, powerups, trailPoints;
let score, lastTime, spawnTimer, powerupTimer;
let shieldActive, shieldEnd, slowActive, slowEnd;
let touchId = null, touchStart = null, playerStart = null;
let keysDown = {};

// ── DOM refs ─────────────────────────────────────────────────────────────────
let overlayStart, overlayDead, hudEl;
let hudScore, hudBest, hudShield, hudSlow;
let scoreVal, bestVal, newRecordEl;

// ── Utilities ────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function getHighScore() {
  return parseInt(localStorage.getItem(LS_KEY) || '0', 10);
}
function setHighScore(s) {
  localStorage.setItem(LS_KEY, String(s));
}

// ── Resize ───────────────────────────────────────────────────────────────────
function resize() {
  const wrapper = canvas.parentElement;
  W = wrapper.clientWidth;
  H = wrapper.clientHeight;
  canvas.width  = W;
  canvas.height = H;
  if (player) {
    player.x = clamp(player.x, PLAYER_RADIUS, W - PLAYER_RADIUS);
    player.y = clamp(player.y, PLAYER_RADIUS, H - PLAYER_RADIUS);
  }
}

// ── Initialise game objects ───────────────────────────────────────────────────
function initGame() {
  player = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  arrows   = [];
  particles = [];
  powerups  = [];
  trailPoints = [];
  score    = 0;
  lastTime = null;
  spawnTimer   = 0;
  powerupTimer = 0;
  shieldActive = false;
  shieldEnd    = 0;
  slowActive   = false;
  slowEnd      = 0;
  keysDown     = {};
  touchId      = null;
  touchStart   = null;
  playerStart  = null;
  updateHUD(0);
}

// ── Arrow factory ─────────────────────────────────────────────────────────────
function spawnArrow(t) {
  const edge = Math.floor(rand(0, 4));   // 0=top 1=right 2=bottom 3=left
  let sx, sy;
  const spread = Math.min(80, 30 + score * 1.5); // aim gets tighter over time

  // Aim point near player with spread
  const ax = player.x + rand(-spread, spread);
  const ay = player.y + rand(-spread, spread);

  switch (edge) {
    case 0: sx = rand(0, W);  sy = -20; break;
    case 1: sx = W + 20;      sy = rand(0, H); break;
    case 2: sx = rand(0, W);  sy = H + 20; break;
    case 3: sx = -20;         sy = rand(0, H); break;
  }

  const dx = ax - sx, dy = ay - sy;
  const len = Math.hypot(dx, dy) || 1;
  const spd = arrowSpeed(t);

  arrows.push({
    x: sx, y: sy,
    vx: (dx / len) * spd,
    vy: (dy / len) * spd,
    angle: Math.atan2(dy, dx),
    r: ARROW_RADIUS,
    age: 0,
  });
}

function arrowSpeed(t) {
  const base = BASE_ARROW_SPEED + (t / 10) * (BASE_ARROW_SPEED * SPEED_SCALE);
  return slowActive ? base * SLOW_FACTOR : base;
}

function spawnInterval(t) {
  const interval = Math.max(SPAWN_MIN, BASE_SPAWN_INTERVAL - (t / 10) * 0.12);
  return slowActive ? interval * (1 / SLOW_FACTOR) : interval;
}

// ── Power-up factory ──────────────────────────────────────────────────────────
function spawnPowerup() {
  const type = Math.random() < 0.5 ? 'shield' : 'slow';
  powerups.push({
    x: rand(40, W - 40),
    y: rand(80, H - 80),
    type,
    r: POWERUP_RADIUS,
    age: 0,
    life: 6000, // disappears after 6s if not collected
  });
}

// ── Particle factory ──────────────────────────────────────────────────────────
function emitParticles(x, y, color, count = PARTICLE_COUNT) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(40, 140);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: rand(2, 5),
      life: 1,
      decay: rand(1.2, 2.5),
      color,
    });
  }
}

// ── Collision ─────────────────────────────────────────────────────────────────
function circleCollide(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  const t = score; // elapsed seconds = score

  // ── Player input ──
  const ACCEL  = 1100;
  const DRAG   = 0.055;
  const MAXSPD = 340;

  let inputX = 0, inputY = 0;
  if (keysDown['ArrowLeft']  || keysDown['a'] || keysDown['A']) inputX -= 1;
  if (keysDown['ArrowRight'] || keysDown['d'] || keysDown['D']) inputX += 1;
  if (keysDown['ArrowUp']    || keysDown['w'] || keysDown['W']) inputY -= 1;
  if (keysDown['ArrowDown']  || keysDown['s'] || keysDown['S']) inputY += 1;

  // Normalise diagonal
  if (inputX !== 0 && inputY !== 0) {
    inputX *= 0.707;
    inputY *= 0.707;
  }

  player.vx += inputX * ACCEL * dt;
  player.vy += inputY * ACCEL * dt;

  // Drag
  const dragFactor = Math.pow(DRAG, dt);
  player.vx *= dragFactor;
  player.vy *= dragFactor;

  // Clamp speed
  const spd = Math.hypot(player.vx, player.vy);
  if (spd > MAXSPD) {
    player.vx = (player.vx / spd) * MAXSPD;
    player.vy = (player.vy / spd) * MAXSPD;
  }

  const prevX = player.x, prevY = player.y;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Wall bounce
  if (player.x < PLAYER_RADIUS)          { player.x = PLAYER_RADIUS;          player.vx *= -0.4; }
  if (player.x > W - PLAYER_RADIUS)      { player.x = W - PLAYER_RADIUS;      player.vx *= -0.4; }
  if (player.y < PLAYER_RADIUS)          { player.y = PLAYER_RADIUS;           player.vy *= -0.4; }
  if (player.y > H - PLAYER_RADIUS)      { player.y = H - PLAYER_RADIUS;       player.vy *= -0.4; }

  // Emit trail particles when moving significantly
  const moved = Math.hypot(player.x - prevX, player.y - prevY);
  if (moved > 1.5) {
    trailPoints.unshift({ x: player.x, y: player.y, age: 0 });
    if (trailPoints.length > TRAIL_MAX) trailPoints.pop();
  }

  // Decay trail
  for (const tp of trailPoints) tp.age += dt * 3;
  trailPoints = trailPoints.filter(tp => tp.age < 1);

  // ── Power-up timer / status ──
  const now = performance.now();
  if (shieldActive && now >= shieldEnd) { shieldActive = false; updatePowerupUI(); }
  if (slowActive   && now >= slowEnd)   { slowActive   = false; updatePowerupUI(); }

  // ── Spawn arrows ──
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    const burst = score > 30 ? (Math.random() < 0.35 ? 2 : 1) : 1;
    for (let i = 0; i < burst; i++) spawnArrow(t);
    spawnTimer = spawnInterval(t) * rand(0.7, 1.3);
  }

  // ── Spawn power-ups ──
  powerupTimer -= dt;
  if (powerupTimer <= 0) {
    if (Math.random() < 0.6) spawnPowerup();
    powerupTimer = POWERUP_INTERVAL + rand(-2, 2);
  }

  // ── Update arrows ──
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.age += dt;

    // Remove if offscreen (with margin)
    const margin = 60;
    if (a.x < -margin || a.x > W + margin || a.y < -margin || a.y > H + margin) {
      arrows.splice(i, 1);
      continue;
    }

    // Collision with player
    if (circleCollide(a.x, a.y, a.r, player.x, player.y, PLAYER_RADIUS)) {
      if (shieldActive) {
        shieldActive = false;
        updatePowerupUI();
        emitParticles(a.x, a.y, '#22C55E', 12);
        arrows.splice(i, 1);
      } else {
        triggerDeath();
        return;
      }
    }
  }

  // ── Update power-ups ──
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.age += dt * 1000;
    if (p.age >= p.life) { powerups.splice(i, 1); continue; }

    if (circleCollide(p.x, p.y, p.r, player.x, player.y, PLAYER_RADIUS + 4)) {
      collectPowerup(p);
      powerups.splice(i, 1);
    }
  }

  // ── Update particles ──
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.88;
    p.vy *= 0.88;
    p.life -= p.decay * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // ── Score ──
  score += dt;
  updateHUD(score);
}

// ── Power-up collection ───────────────────────────────────────────────────────
function collectPowerup(p) {
  const now = performance.now();
  if (p.type === 'shield') {
    shieldActive = true;
    shieldEnd    = now + SHIELD_DURATION;
    emitParticles(p.x, p.y, '#22C55E', 14);
  } else {
    slowActive = true;
    slowEnd    = now + SLOW_DURATION;
    // Re-scale existing arrow velocities
    for (const a of arrows) {
      a.vx *= SLOW_FACTOR;
      a.vy *= SLOW_FACTOR;
    }
    emitParticles(p.x, p.y, '#A855F7', 14);
  }
  updatePowerupUI();
}

function updatePowerupUI() {
  hudShield.classList.toggle('active', shieldActive);
  hudSlow.classList.toggle('active', slowActive);
}

// ── Render ────────────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);

  const bg = cssVar('--board-bg');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawGrid();
  drawTrail();
  drawPowerups();
  drawArrows();
  drawParticles();
  drawPlayer();
}

function drawGrid() {
  const step = 48;
  const alpha = 0.04;
  ctx.strokeStyle = `rgba(${isDark() ? '255,255,255' : '0,0,0'}, ${alpha})`;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let x = 0; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}

function isDark() {
  return !window.matchMedia('(prefers-color-scheme: light)').matches;
}

function drawTrail() {
  if (trailPoints.length < 2) return;
  for (let i = 0; i < trailPoints.length; i++) {
    const tp = trailPoints[i];
    const a  = (1 - tp.age) * 0.35;
    const r  = PLAYER_RADIUS * (1 - tp.age * 0.55);
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(59, 130, 246, ${a})`;
    ctx.fill();
  }
}

function drawArrows() {
  for (const a of arrows) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);

    // Fade in briefly
    const alpha = Math.min(1, a.age * 6);
    ctx.globalAlpha = alpha;

    // Shaft
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-ARROW_LENGTH, 0);
    ctx.lineTo(ARROW_HEAD, 0);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.moveTo(ARROW_HEAD + 9, 0);
    ctx.lineTo(ARROW_HEAD - 4, -6);
    ctx.lineTo(ARROW_HEAD - 4,  6);
    ctx.closePath();
    ctx.fill();

    // Tail feathers
    ctx.strokeStyle = '#FCA5A5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-ARROW_LENGTH, 0);
    ctx.lineTo(-ARROW_LENGTH + 8, -5);
    ctx.moveTo(-ARROW_LENGTH, 0);
    ctx.lineTo(-ARROW_LENGTH + 8,  5);
    ctx.stroke();

    ctx.restore();
  }
}

function drawPlayer() {
  const x = player.x, y = player.y;

  // Shield aura
  if (shieldActive) {
    const now = performance.now();
    const pct = 1 - (shieldEnd - now) / SHIELD_DURATION;
    const pulse = 0.5 + 0.5 * Math.sin(now / 150);
    const shieldR = PLAYER_RADIUS + 10 + pulse * 4;
    ctx.beginPath();
    ctx.arc(x, y, shieldR, 0, Math.PI * 2);
    const sg = ctx.createRadialGradient(x, y, PLAYER_RADIUS, x, y, shieldR);
    sg.addColorStop(0, `rgba(34, 197, 94, 0)`);
    sg.addColorStop(1, `rgba(34, 197, 94, ${0.45 * (1 - pct * 0.6)})`);
    ctx.fillStyle = sg;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, shieldR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(34, 197, 94, ${0.7 * (1 - pct * 0.4)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Glow
  const glow = ctx.createRadialGradient(x, y, 2, x, y, PLAYER_RADIUS * 2.2);
  glow.addColorStop(0, 'rgba(59, 130, 246, 0.55)');
  glow.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.beginPath();
  ctx.arc(x, y, PLAYER_RADIUS * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Body
  const grad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, PLAYER_RADIUS);
  grad.addColorStop(0, '#93C5FD');
  grad.addColorStop(1, '#1D4ED8');
  ctx.beginPath();
  ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Rim
  ctx.beginPath();
  ctx.arc(x, y, PLAYER_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Specular
  ctx.beginPath();
  ctx.arc(x - 4, y - 4, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fill();
}

function drawPowerups() {
  const now = performance.now();
  for (const p of powerups) {
    const lifeRatio = p.age / p.life;
    const alpha = lifeRatio > 0.7 ? lerp(1, 0, (lifeRatio - 0.7) / 0.3) : 1;
    const pulse = 1 + 0.08 * Math.sin(now / 250 + p.x);
    const r = POWERUP_RADIUS * pulse;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);

    // Glow ring
    const glowColor = p.type === 'shield' ? '34,197,94' : '168,85,247';
    const outerGlow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2);
    outerGlow.addColorStop(0, `rgba(${glowColor}, 0.3)`);
    outerGlow.addColorStop(1, `rgba(${glowColor}, 0)`);
    ctx.beginPath();
    ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = p.type === 'shield' ? '#15803D' : '#7E22CE';
    ctx.fill();
    ctx.strokeStyle = p.type === 'shield' ? '#22C55E' : '#A855F7';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Icon
    ctx.font = `${Math.round(r * 1.15)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(p.type === 'shield' ? '🛡' : '⏱', 0, 1);

    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }
}

// ── HUD ───────────────────────────────────────────────────────────────────────
function updateHUD(s) {
  hudScore.textContent = Math.floor(s).toString().padStart(3, '0');
  const best = getHighScore();
  hudBest.textContent  = best.toString().padStart(3, '0');
}

// ── Death ─────────────────────────────────────────────────────────────────────
function triggerDeath() {
  gameState = 'dead';
  cancelAnimationFrame(animId);
  animId = null;

  // Burst particles
  emitParticles(player.x, player.y, '#EF4444', 24);
  emitParticles(player.x, player.y, '#FCA5A5', 16);

  // Draw one last frame with particles
  draw();

  const finalScore = Math.floor(score);
  const prev = getHighScore();
  let isNew = false;
  if (finalScore > prev) { setHighScore(finalScore); isNew = true; }

  scoreVal.textContent    = finalScore;
  bestVal.textContent     = Math.max(finalScore, prev);
  newRecordEl.classList.toggle('hidden', !isNew);

  if(typeof Leaderboard!=='undefined')Leaderboard.ready('dodge',finalScore,{});
  overlayDead.classList.remove('hidden');
}

// ── Game loop ─────────────────────────────────────────────────────────────────
function loop(ts) {
  if (gameState !== 'playing') return;
  if (!lastTime) lastTime = ts;
  const rawDt = Math.min((ts - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = ts;

  update(rawDt);
  draw();

  animId = requestAnimationFrame(loop);
}

// ── Start / Restart ───────────────────────────────────────────────────────────
function startGame() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  overlayStart.classList.add('hidden');
  overlayDead.classList.add('hidden');
  initGame();
  gameState = 'playing';
  animId = requestAnimationFrame(loop);
}

// ── Controls ──────────────────────────────────────────────────────────────────
function setupControls() {
  // Keyboard
  window.addEventListener('keydown', e => {
    keysDown[e.key] = true;
    if (gameState === 'start' && (e.key === ' ' || e.key === 'Enter')) startGame();
    if (gameState === 'dead'  && (e.key === ' ' || e.key === 'Enter')) startGame();
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { delete keysDown[e.key]; });

  // Touch drag
  canvas.addEventListener('touchstart', e => {
    if (gameState === 'start' || gameState === 'dead') { startGame(); return; }
    if (touchId !== null) return;
    const t = e.changedTouches[0];
    touchId     = t.identifier;
    touchStart  = { x: t.clientX, y: t.clientY };
    playerStart = { x: player.x, y: player.y };
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    if (touchId === null || gameState !== 'playing') return;
    for (const t of e.changedTouches) {
      if (t.identifier !== touchId) continue;
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      player.x = clamp(playerStart.x + dx, PLAYER_RADIUS, W - PLAYER_RADIUS);
      player.y = clamp(playerStart.y + dy, PLAYER_RADIUS, H - PLAYER_RADIUS);
    }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === touchId) { touchId = null; break; }
    }
    // Bleed velocity from last touch delta (approximate)
    player.vx *= 0.3;
    player.vy *= 0.3;
  });

  // Mouse drag (for desktop testing alongside keys)
  let mouseDown = false;
  let mouseStart = null, playerMouseStart = null;
  canvas.addEventListener('mousedown', e => {
    if (gameState === 'start' || gameState === 'dead') { startGame(); return; }
    mouseDown = true;
    mouseStart      = { x: e.clientX, y: e.clientY };
    playerMouseStart = { x: player.x, y: player.y };
  });
  window.addEventListener('mousemove', e => {
    if (!mouseDown || gameState !== 'playing') return;
    const dx = e.clientX - mouseStart.x;
    const dy = e.clientY - mouseStart.y;
    player.x = clamp(playerMouseStart.x + dx, PLAYER_RADIUS, W - PLAYER_RADIUS);
    player.y = clamp(playerMouseStart.y + dy, PLAYER_RADIUS, H - PLAYER_RADIUS);
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  canvas       = document.getElementById('game-canvas');
  ctx          = canvas.getContext('2d');
  overlayStart = document.getElementById('overlay-start');
  overlayDead  = document.getElementById('overlay-dead');
  hudEl        = document.getElementById('hud');
  hudScore     = document.getElementById('hud-score');
  hudBest      = document.getElementById('hud-best');
  hudShield    = document.getElementById('badge-shield');
  hudSlow      = document.getElementById('badge-slow');
  scoreVal     = document.getElementById('result-score');
  bestVal      = document.getElementById('result-best');
  newRecordEl  = document.getElementById('new-record');

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', startGame);

  window.addEventListener('resize', resize);
  resize();
  setupControls();

  // Show start overlay high score
  document.getElementById('start-best').textContent = getHighScore();
  updateHUD(0);
}

document.addEventListener('DOMContentLoaded', init);
