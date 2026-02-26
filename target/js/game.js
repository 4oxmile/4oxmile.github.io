'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const GAME_DURATION   = 30;      // seconds
const BASE_SPAWN_MS   = 1200;    // initial spawn interval
const MIN_SPAWN_MS    = 350;     // minimum spawn interval
const BASE_LIFE_MS    = 2200;    // how long a target lives
const MIN_LIFE_MS     = 900;
const BASE_TARGET_R   = 52;      // initial max radius
const MIN_TARGET_R    = 22;
const MAX_TARGETS     = 6;
const SCORE_BULLSEYE  = 100;
const SCORE_INNER     = 50;
const SCORE_OUTER     = 25;
const LS_KEY          = 'targetShooterHS';

// Zone ratios (fraction of target radius)
const BULLSEYE_RATIO  = 0.22;
const INNER_RATIO     = 0.55;

// ── State ─────────────────────────────────────────────────────────────────
let canvas, ctx;
let targets       = [];
let score         = 0;
let hits          = 0;
let misses        = 0;
let combo         = 0;
let bestCombo     = 0;
let timeLeft      = GAME_DURATION;
let gameRunning   = false;
let gameOver      = false;
let spawnTimer    = null;
let countdownTimer = null;
let animFrameId   = null;
let lastTimestamp  = 0;
let difficulty     = 0;   // 0-1, increases with score

// Ripple effects drawn on canvas
let ripples = [];

// ── DOM refs ──────────────────────────────────────────────────────────────
const appEl          = document.getElementById('app');
const scoreValueEl   = document.getElementById('scoreValue');
const missValueEl    = document.getElementById('missValue');
const accuracyEl     = document.getElementById('accuracyValue');
const timerEl        = document.getElementById('timerValue');
const comboEl        = document.getElementById('comboDisplay');
const startOverlay   = document.getElementById('startOverlay');
const resultOverlay  = document.getElementById('resultOverlay');
const highscoreBadge = document.getElementById('highscoreBadge');
const startHsEl      = document.getElementById('startHs');

// Result screen
const resScoreEl     = document.getElementById('resScore');
const resHitsEl      = document.getElementById('resHits');
const resMissesEl    = document.getElementById('resMisses');
const resAccEl       = document.getElementById('resAccuracy');
const resComboEl     = document.getElementById('resCombo');
const resHsEl        = document.getElementById('resHighscore');
const newRecordEl    = document.getElementById('newRecord');

// ── Helpers ───────────────────────────────────────────────────────────────
function getHighScore() {
  return parseInt(localStorage.getItem(LS_KEY) || '0', 10);
}

function setHighScore(v) {
  localStorage.setItem(LS_KEY, String(v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function calcDifficulty() {
  // Ramps up with score: 0 at score 0, ~1 at score 500
  return clamp(score / 500, 0, 1);
}

function calcSpawnInterval() {
  return lerp(BASE_SPAWN_MS, MIN_SPAWN_MS, difficulty);
}

function calcLifeMs() {
  return lerp(BASE_LIFE_MS, MIN_LIFE_MS, difficulty);
}

function calcTargetRadius() {
  return lerp(BASE_TARGET_R, MIN_TARGET_R, difficulty);
}

function calcAccuracy() {
  const total = hits + misses;
  if (total === 0) return 100;
  return Math.round((hits / total) * 100);
}

function updateHUD() {
  scoreValueEl.textContent = score;
  missValueEl.textContent  = misses;
  accuracyEl.textContent   = calcAccuracy() + '%';
  timerEl.textContent      = timeLeft;
  timerEl.classList.toggle('urgent', timeLeft <= 5);
}

// ── Target factory ────────────────────────────────────────────────────────
function spawnTarget() {
  if (!gameRunning) return;
  if (targets.length >= MAX_TARGETS) return;

  const r = calcTargetRadius();
  const W = canvas.width;
  const H = canvas.height;

  // Keep target fully inside canvas
  const margin = r + 10;
  const x = margin + Math.random() * (W - margin * 2);
  const y = margin + 70 + Math.random() * (H - margin * 2 - 70); // below HUD

  const lifeMs = calcLifeMs();

  targets.push({
    x, y,
    r,
    born: performance.now(),
    life: lifeMs,
    dead: false,
    // animation: scale-in on birth, scale-out before death
    scale: 0,
  });
}

function scheduleSpawn() {
  if (!gameRunning) return;
  const interval = calcSpawnInterval();
  spawnTimer = setTimeout(() => {
    spawnTarget();
    scheduleSpawn();
  }, interval);
}

// ── Drawing ───────────────────────────────────────────────────────────────
// Color theme helpers: read CSS vars
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawTarget(t, now) {
  const age     = now - t.born;
  const lifeRatio = age / t.life;  // 0 -> 1

  // Scale animation: pop in (0-0.15), stay, shrink out (0.85-1)
  let scale;
  if (lifeRatio < 0.15) {
    scale = lifeRatio / 0.15;
    scale = 1 - Math.pow(1 - scale, 3); // ease-out cubic
  } else if (lifeRatio > 0.82) {
    scale = (1 - lifeRatio) / 0.18;
    scale = Math.max(0, scale);
  } else {
    scale = 1;
  }
  t.scale = scale;

  const r = t.r * scale;
  if (r < 1) return;

  ctx.save();
  ctx.translate(t.x, t.y);

  // Outer ring (ring countdown: arc shrinks as time runs out)
  const remainRatio = 1 - lifeRatio;
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remainRatio);
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 3 * scale;
  ctx.stroke();

  // Concentric circles - outer zone (green)
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  // Inner zone (amber)
  const innerR = r * INNER_RATIO;
  ctx.beginPath();
  ctx.arc(0, 0, innerR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  // Bullseye (red)
  const bsR = r * BULLSEYE_RATIO;
  ctx.beginPath();
  ctx.arc(0, 0, bsR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
  ctx.fill();
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  // Crosshair lines
  ctx.strokeStyle = 'rgba(240, 246, 252, 0.3)';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
  ctx.moveTo(0, -r); ctx.lineTo(0, r);
  ctx.stroke();

  ctx.restore();
}

function drawRipples(now) {
  ripples = ripples.filter(rp => now - rp.born < rp.duration);
  for (const rp of ripples) {
    const t = (now - rp.born) / rp.duration;
    const r = rp.startR + (rp.endR - rp.startR) * t;
    const alpha = (1 - t) * 0.8;
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = rp.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}

// ── Game loop ─────────────────────────────────────────────────────────────
function gameLoop(timestamp) {
  if (!gameRunning) return;

  const dt = timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update + draw targets
  const now = performance.now();
  targets = targets.filter(t => {
    if (t.dead) return false;
    const age = now - t.born;
    if (age >= t.life) {
      t.dead = true;
      return false;
    }
    drawTarget(t, now);
    return true;
  });

  // Draw ripples
  drawRipples(now);

  animFrameId = requestAnimationFrame(gameLoop);
}

// ── Hit detection ─────────────────────────────────────────────────────────
function handleShot(x, y) {
  if (!gameRunning) return;

  const now = performance.now();
  let hitTarget = null;
  let hitZone = null;
  let hitDist = Infinity;

  // Find the topmost (most recent) target that was hit
  // Iterate in reverse so latest spawned is checked first
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i];
    if (t.dead) continue;
    const dist = Math.hypot(x - t.x, y - t.y);
    const r = t.r * t.scale;
    if (dist <= r && dist < hitDist) {
      hitDist = dist;
      hitTarget = t;
      hitTarget._idx = i;
      // Determine zone
      if (dist <= r * BULLSEYE_RATIO) {
        hitZone = 'bullseye';
      } else if (dist <= r * INNER_RATIO) {
        hitZone = 'inner';
      } else {
        hitZone = 'outer';
      }
    }
  }

  if (hitTarget) {
    hitTarget.dead = true;
    targets.splice(hitTarget._idx, 1);

    const pts = hitZone === 'bullseye' ? SCORE_BULLSEYE
              : hitZone === 'inner'    ? SCORE_INNER
              :                          SCORE_OUTER;

    combo++;
    bestCombo = Math.max(bestCombo, combo);
    hits++;

    // Combo bonus (every 5 hits)
    let bonus = 0;
    if (combo > 0 && combo % 5 === 0) {
      bonus = 50;
    }

    score += pts + bonus;
    difficulty = calcDifficulty();
    updateHUD();
    updateComboDisplay();

    // Ripple effect
    const zoneColor = hitZone === 'bullseye' ? 'rgb(239, 68, 68)'
                    : hitZone === 'inner'    ? 'rgb(245, 158, 11)'
                    :                          'rgb(16, 185, 129)';
    ripples.push({
      x: hitTarget.x, y: hitTarget.y,
      startR: hitTarget.r * hitTarget.scale * 0.3,
      endR: hitTarget.r * hitTarget.scale * 1.8,
      born: now,
      duration: 500,
      color: zoneColor,
    });

    // Score popup
    const label = bonus > 0 ? `+${pts} COMBO +${bonus}!` : `+${pts}`;
    spawnScorePopup(x, y - 10, label, hitZone);

    if (combo > 1) {
      updateComboDisplay();
    }

  } else {
    // Miss
    misses++;
    combo = 0;
    updateHUD();
    updateComboDisplay();
    spawnScorePopup(x, y, 'MISS', 'miss');
  }
}

// ── Combo display ─────────────────────────────────────────────────────────
let comboHideTimer = null;

function updateComboDisplay() {
  if (combo >= 3) {
    comboEl.textContent = `COMBO x${combo}`;
    comboEl.classList.add('visible');
    clearTimeout(comboHideTimer);
    comboHideTimer = setTimeout(() => comboEl.classList.remove('visible'), 1200);
  } else {
    comboEl.classList.remove('visible');
  }
}

// ── Score popups (DOM) ────────────────────────────────────────────────────
function spawnScorePopup(x, y, text, zone) {
  const el = document.createElement('div');
  el.className = `score-popup ${zone}`;
  el.textContent = text;

  // Position relative to #app
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = x / scaleX;
  const py = y / scaleY;

  el.style.left = `${px}px`;
  el.style.top  = `${py}px`;
  el.style.transform = 'translate(-50%, -50%)';

  appEl.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ── Timer countdown ───────────────────────────────────────────────────────
function startCountdown() {
  countdownTimer = setInterval(() => {
    timeLeft--;
    updateHUD();
    if (timeLeft <= 0) {
      clearInterval(countdownTimer);
      endGame();
    }
  }, 1000);
}

// ── Game lifecycle ────────────────────────────────────────────────────────
function startGame() {
  // Reset state
  score     = 0;
  hits      = 0;
  misses    = 0;
  combo     = 0;
  bestCombo = 0;
  timeLeft  = GAME_DURATION;
  difficulty = 0;
  targets   = [];
  ripples   = [];
  gameRunning = true;
  gameOver    = false;

  // Hide overlays
  startOverlay.classList.add('hidden');
  resultOverlay.classList.add('hidden');

  // Init canvas size
  resizeCanvas();
  updateHUD();

  // Start loop
  lastTimestamp = performance.now();
  animFrameId = requestAnimationFrame(gameLoop);

  // Spawn & countdown
  spawnTarget(); // immediate first target
  scheduleSpawn();
  startCountdown();
}

function endGame() {
  gameRunning = false;
  gameOver    = true;

  clearTimeout(spawnTimer);
  cancelAnimationFrame(animFrameId);

  // Final canvas clear with targets removed
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  targets = [];
  ripples = [];

  // High score
  const hs = getHighScore();
  const isNew = score > hs;
  if (isNew) setHighScore(score);

  // Populate result screen
  const accuracy = calcAccuracy();
  resScoreEl.textContent  = score;
  resHitsEl.textContent   = hits;
  resMissesEl.textContent = misses;
  resAccEl.textContent    = accuracy + '%';
  resComboEl.textContent  = `x${bestCombo}`;
  resHsEl.textContent     = isNew ? score : hs;
  newRecordEl.textContent = isNew ? '신기록 달성!' : '';

  highscoreBadge.classList.toggle('visible', isNew);

  resultOverlay.classList.remove('hidden');
}

// ── Canvas resize ─────────────────────────────────────────────────────────
function resizeCanvas() {
  const rect = appEl.getBoundingClientRect();
  canvas.width  = rect.width;
  canvas.height = rect.height;
}

// ── Event listeners ───────────────────────────────────────────────────────
function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  let clientX, clientY;
  if (e.touches) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top)  * scaleY,
  };
}

canvas.addEventListener('click', (e) => {
  const { x, y } = getCanvasCoords(e);
  handleShot(x, y);
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const { x, y } = getCanvasCoords(e);
  handleShot(x, y);
}, { passive: false });

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

window.addEventListener('resize', () => {
  if (gameRunning) resizeCanvas();
});

// ── Init ──────────────────────────────────────────────────────────────────
function init() {
  canvas = document.getElementById('gameCanvas');
  ctx    = canvas.getContext('2d');

  resizeCanvas();

  // Show best score on start screen
  const hs = getHighScore();
  startHsEl.textContent = hs;

  // Initial canvas: draw a faint crosshair hint
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

init();
