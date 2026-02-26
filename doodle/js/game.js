'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const CANVAS_W = 480;
const CANVAS_H = 800;
const GRAVITY = 0.45;
const JUMP_VEL = -13.5;
const PLAYER_W = 36;
const PLAYER_H = 36;
const PLAT_H = 12;
const PLAT_W_MIN = 60;
const PLAT_W_MAX = 90;
const PLAT_GAP_MIN = 60;
const PLAT_GAP_MAX = 110;
const MOVE_SPEED_MAX = 2.5;
const H_SPEED = 5.5;
const LS_KEY = 'doodlejump_best';

// Platform types
const PT_NORMAL = 0;
const PT_MOVING = 1;
const PT_BREAKABLE = 2;

// Colors (CSS vars resolved at runtime for canvas)
let COLORS = {};
function resolveColors() {
  const s = getComputedStyle(document.documentElement);
  const get = v => s.getPropertyValue(v).trim();
  COLORS = {
    bg:         get('--board-bg')    || '#0A0E14',
    platNormal: '#4ade80',
    platMoving: '#60a5fa',
    platBreak:  '#a78060',
    platCrack:  '#7a5040',
    player:     '#facc15',
    playerEye:  '#1a1a2e',
    playerFace: '#fde68a',
    accent:     get('--accent')      || '#3B82F6',
    textMuted:  get('--text-muted')  || '#484F58',
    starColor:  get('--text-muted')  || '#484F58',
  };
}

// ─── State ────────────────────────────────────────────────────────────────────
let canvas, ctx;
let scale = 1;
let animId = null;
let gameState = 'start'; // start | playing | paused | over
let score = 0;
let bestScore = 0;
let cameraY = 0;       // world Y of top of screen
let player = {};
let platforms = [];
let particles = [];
let stars = [];
let tiltX = 0;         // -1..1 from device orientation or touch
let touchStartX = null;
let touchCurrentX = null;
let frameCount = 0;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const startOverlay   = () => document.getElementById('start-overlay');
const resultOverlay  = () => document.getElementById('result-overlay');
const hudScore       = () => document.getElementById('score-value');
const hudBest        = () => document.getElementById('best-value');
const resultScore    = () => document.getElementById('result-score');
const resultBest     = () => document.getElementById('result-best');
const resultMsg      = () => document.getElementById('result-msg');
const pauseBtn       = () => document.getElementById('pause-btn');
const tiltIndicator  = () => document.getElementById('tilt-indicator');
const tiltBar        = () => document.getElementById('tilt-bar');

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  resizeCanvas();
  resolveColors();

  bestScore = parseInt(localStorage.getItem(LS_KEY) || '0', 10);
  hudBest().textContent = bestScore;

  generateStars();
  bindEvents();
  showOverlay('start');

  // Idle animation on start screen
  requestAnimationFrame(idleLoop);
}

function resizeCanvas() {
  const wrapper = document.getElementById('game-wrapper');
  const rect = wrapper.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width  = rect.width  + 'px';
  canvas.style.height = rect.height + 'px';

  scale = (rect.width / CANVAS_W) * dpr;
}

function generateStars() {
  stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * CANVAS_W,
      y: Math.random() * CANVAS_H * 4,
      r: Math.random() * 1.5 + 0.5,
      a: Math.random() * 0.5 + 0.1,
    });
  }
}

// ─── Overlays ─────────────────────────────────────────────────────────────────
function showOverlay(name) {
  ['start-overlay', 'result-overlay'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  if (name) {
    document.getElementById(name + '-overlay').classList.remove('hidden');
  }
  pauseBtn().style.display = (name === null && gameState === 'playing') ? 'block' : 'none';
}

function hideAllOverlays() {
  ['start-overlay', 'result-overlay'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  pauseBtn().style.display = 'block';
}

// ─── Game lifecycle ───────────────────────────────────────────────────────────
function startGame() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  score = 0;
  cameraY = 0;
  tiltX = 0;
  particles = [];
  frameCount = 0;

  player = {
    x: CANVAS_W / 2 - PLAYER_W / 2,
    y: CANVAS_H - 160,
    vx: 0,
    vy: JUMP_VEL,
    facing: 1,
    squish: 1,
    squishV: 0,
    trail: [],
  };

  platforms = [];
  generateInitialPlatforms();

  gameState = 'playing';
  hideAllOverlays();

  hudScore().textContent = '0';
  hudBest().textContent = bestScore;

  if (animId) cancelAnimationFrame(animId);
  animId = requestAnimationFrame(gameLoop);
}

function gameOver() {
  gameState = 'over';

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(LS_KEY, bestScore);
    hudBest().textContent = bestScore;
  }

  resultScore().textContent = score;
  resultBest().textContent  = bestScore;
  resultMsg().textContent   = score >= bestScore && score > 0 ? '최고 기록 갱신!' : '다시 도전해보세요!';

  pauseBtn().style.display = 'none';
  showOverlay('result');
  if(typeof Leaderboard!=='undefined')Leaderboard.ready('doodle',score);

  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

function pauseGame() {
  if (gameState !== 'playing') return;
  gameState = 'paused';
  pauseBtn().textContent = '▶ 계속';
  if (animId) { cancelAnimationFrame(animId); animId = null; }
}

function resumeGame() {
  if (gameState !== 'paused') return;
  gameState = 'playing';
  pauseBtn().textContent = '⏸ 일시정지';
  animId = requestAnimationFrame(gameLoop);
}

// ─── Platform generation ──────────────────────────────────────────────────────
function makePlatform(x, y, type) {
  const w = PLAT_W_MIN + Math.random() * (PLAT_W_MAX - PLAT_W_MIN);
  return {
    x, y, w,
    type,
    broken: false,
    breakAnim: 0,
    // moving platform state
    mx: x,
    mdir: Math.random() < 0.5 ? 1 : -1,
    mspeed: 0.8 + Math.random() * (MOVE_SPEED_MAX - 0.8),
    mrange: 40 + Math.random() * 60,
  };
}

function generateInitialPlatforms() {
  // Floor platform so player always starts on something
  platforms.push({ x: CANVAS_W / 2 - 50, y: CANVAS_H - 140, w: 100, type: PT_NORMAL, broken: false, breakAnim: 0, mx: CANVAS_W/2-50, mdir:1, mspeed:1, mrange:0 });

  let y = CANVAS_H - 200;
  while (y > -CANVAS_H * 0.5) {
    spawnPlatformAt(y);
    y -= PLAT_GAP_MIN + Math.random() * (PLAT_GAP_MAX - PLAT_GAP_MIN);
  }
}

function spawnPlatformAt(y) {
  const x = 20 + Math.random() * (CANVAS_W - 110);
  // Difficulty: more moving/breakable as score increases
  const diff = Math.min(score / 500, 1);
  const r = Math.random();
  let type;
  if (r < 0.55 - diff * 0.1) type = PT_NORMAL;
  else if (r < 0.55 - diff * 0.1 + 0.25 + diff * 0.15) type = PT_MOVING;
  else type = PT_BREAKABLE;

  platforms.push(makePlatform(x, y, type));
}

function managePlatforms() {
  // Remove platforms that fell off bottom of camera view
  platforms = platforms.filter(p => p.y < cameraY + CANVAS_H + 100);

  // Add platforms above camera top
  const topmost = platforms.reduce((m, p) => Math.min(m, p.y), Infinity);
  let nextY = topmost;
  while (nextY > cameraY - CANVAS_H) {
    nextY -= PLAT_GAP_MIN + Math.random() * (PLAT_GAP_MAX - PLAT_GAP_MIN);
    spawnPlatformAt(nextY);
  }
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function gameLoop() {
  if (gameState !== 'playing') return;
  update();
  render();
  frameCount++;
  animId = requestAnimationFrame(gameLoop);
}

function idleLoop() {
  if (gameState === 'playing') return;
  renderIdle();
  requestAnimationFrame(idleLoop);
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update() {
  updatePlayer();
  updatePlatforms();
  updateParticles();
  updateCamera();
  updateScore();
  managePlatforms();
  checkDeath();
}

function updatePlayer() {
  // Horizontal input: tilt or keyboard or touch drag
  let hInput = tiltX; // -1..1

  // keyboard override
  if (keys['ArrowLeft'])  hInput = -1;
  if (keys['ArrowRight']) hInput =  1;

  // Touch drag
  if (touchCurrentX !== null && touchStartX !== null) {
    const dx = touchCurrentX - touchStartX;
    hInput = Math.max(-1, Math.min(1, dx / 60));
  }

  player.vx = hInput * H_SPEED;
  if (Math.abs(hInput) > 0.1) player.facing = hInput > 0 ? 1 : -1;

  // Horizontal wrap
  player.x += player.vx;
  if (player.x + PLAYER_W < 0)        player.x = CANVAS_W;
  if (player.x > CANVAS_W)            player.x = -PLAYER_W;

  // Gravity
  player.vy += GRAVITY;
  player.y  += player.vy;

  // Squish recovery
  if (player.squish !== 1) {
    player.squishV += (1 - player.squish) * 0.3;
    player.squish  += player.squishV;
    player.squishV *= 0.6;
    if (Math.abs(player.squish - 1) < 0.01) { player.squish = 1; player.squishV = 0; }
  }

  // Trail
  player.trail.unshift({ x: player.x + PLAYER_W/2, y: player.y + PLAYER_H/2, a: 0.35 });
  if (player.trail.length > 6) player.trail.pop();
  player.trail.forEach((t, i) => { t.a -= 0.04; });

  // Collision with platforms (only when falling)
  if (player.vy > 0) {
    for (let p of platforms) {
      if (p.broken) continue;
      const px = p.x, py = p.y, pw = p.w;
      // Player bottom vs platform top
      const prevBottom = player.y + PLAYER_H - player.vy;
      const curBottom  = player.y + PLAYER_H;
      if (
        curBottom >= py &&
        prevBottom <= py + PLAT_H + 2 &&
        player.x + PLAYER_W > px + 4 &&
        player.x < px + pw - 4
      ) {
        if (p.type === PT_BREAKABLE) {
          p.broken = true;
          p.breakAnim = 1;
          spawnBreakParticles(px + pw/2, py);
        } else {
          player.vy = JUMP_VEL;
          player.y  = py - PLAYER_H;
          player.squish = 0.6;
          player.squishV = 0;
          spawnBounceParticles(player.x + PLAYER_W/2, player.y + PLAYER_H);
        }
      }
    }
  }
}

function updatePlatforms() {
  for (let p of platforms) {
    if (p.type === PT_MOVING && !p.broken) {
      p.x += p.mdir * p.mspeed;
      if (p.x < 10 || p.x + p.w > CANVAS_W - 10) {
        p.mdir *= -1;
      }
    }
    if (p.broken && p.breakAnim > 0) {
      p.breakAnim -= 0.06;
    }
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.18;
    p.a  -= p.da;
    p.r  *= 0.95;
    if (p.a <= 0 || p.r < 0.3) particles.splice(i, 1);
  }
}

function updateCamera() {
  // Camera follows player upward only
  const targetY = player.y - CANVAS_H * 0.45;
  if (targetY < cameraY) {
    cameraY = targetY;
  }
}

function updateScore() {
  const h = Math.round(-cameraY / 10);
  if (h > score) {
    score = h;
    hudScore().textContent = score;
  }
}

function checkDeath() {
  if (player.y - cameraY > CANVAS_H + 100) {
    gameOver();
  }
}

// ─── Particles ────────────────────────────────────────────────────────────────
function spawnBounceParticles(x, y) {
  for (let i = 0; i < 5; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 3,
      vy: -Math.random() * 2 - 0.5,
      r: Math.random() * 3 + 2,
      a: 0.7,
      da: 0.05,
      color: COLORS.platNormal,
    });
  }
}

function spawnBreakParticles(x, y) {
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
    const speed = 2 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      r: Math.random() * 4 + 2,
      a: 0.9,
      da: 0.04,
      color: COLORS.platBreak,
    });
  }
}

// ─── Keys ─────────────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.preventDefault();
  if ((e.key === ' ' || e.key === 'Enter') && gameState === 'start') startGame();
  if ((e.key === 'p' || e.key === 'P') && gameState === 'playing') pauseGame();
  if ((e.key === 'p' || e.key === 'P') && gameState === 'paused')  resumeGame();
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

// ─── Events ───────────────────────────────────────────────────────────────────
function bindEvents() {
  window.addEventListener('resize', () => {
    resizeCanvas();
    resolveColors();
  });

  // Device orientation (tilt)
  window.addEventListener('deviceorientation', e => {
    if (e.gamma !== null) {
      tiltX = Math.max(-1, Math.min(1, e.gamma / 25));
      showTiltIndicator(tiltX);
    }
  }, { passive: true });

  // Touch for drag control
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchStartX   = e.touches[0].clientX;
    touchCurrentX = e.touches[0].clientX;
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    touchCurrentX = e.touches[0].clientX;
    const dx = touchCurrentX - touchStartX;
    const norm = Math.max(-1, Math.min(1, dx / 60));
    showTiltIndicator(norm);
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    touchStartX   = null;
    touchCurrentX = null;
    hideTiltIndicator();
  }, { passive: false });

  // Buttons
  document.getElementById('start-btn').addEventListener('click', startGame);
  document.getElementById('restart-btn').addEventListener('click', startGame);
  document.getElementById('menu-btn').addEventListener('click', () => {
    gameState = 'start';
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    showOverlay('start');
    requestAnimationFrame(idleLoop);
  });

  pauseBtn().addEventListener('click', () => {
    if (gameState === 'playing') pauseGame();
    else if (gameState === 'paused') resumeGame();
  });
}

let tiltHideTimer = null;
function showTiltIndicator(norm) {
  if (gameState !== 'playing') return;
  const ind = tiltIndicator();
  ind.classList.add('visible');
  tiltBar().style.left = (50 + norm * 38) + '%';
  clearTimeout(tiltHideTimer);
  tiltHideTimer = setTimeout(hideTiltIndicator, 1500);
}

function hideTiltIndicator() {
  tiltIndicator().classList.remove('visible');
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function render() {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  drawBackground();
  drawStars();

  ctx.save();
  ctx.translate(0, -cameraY);
  drawPlatforms();
  drawParticles();
  drawPlayer();
  ctx.restore();

  ctx.restore();
}

function renderIdle() {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawBackground();
  drawStars();
  ctx.restore();
}

function drawBackground() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawStars() {
  for (let s of stars) {
    const sy = ((s.y - cameraY * 0.3) % (CANVAS_H * 4) + CANVAS_H * 4) % (CANVAS_H * 4);
    if (sy < 0 || sy > CANVAS_H) continue;
    ctx.beginPath();
    ctx.arc(s.x, sy, s.r, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(COLORS.starColor, s.a);
    ctx.fill();
  }
}

function drawPlatforms() {
  for (let p of platforms) {
    if (p.y < cameraY - 20 || p.y > cameraY + CANVAS_H + 20) continue;

    ctx.save();

    let color, shadowColor;
    if (p.type === PT_NORMAL) {
      color = COLORS.platNormal;
      shadowColor = '#22c55e';
    } else if (p.type === PT_MOVING) {
      color = COLORS.platMoving;
      shadowColor = '#3b82f6';
    } else {
      color = p.broken ? COLORS.platCrack : COLORS.platBreak;
      shadowColor = '#92400e';
    }

    if (p.broken) {
      // Break animation: scale out and fade
      const ba = Math.max(0, p.breakAnim);
      ctx.globalAlpha = ba;
      ctx.translate(p.x + p.w/2, p.y + PLAT_H/2);
      ctx.scale(1 + (1 - ba) * 0.5, 1 - (1 - ba) * 0.5);
      ctx.translate(-(p.x + p.w/2), -(p.y + PLAT_H/2));
    }

    // Shadow/glow
    ctx.shadowColor  = shadowColor;
    ctx.shadowBlur   = 8;

    // Platform body
    roundRect(ctx, p.x, p.y, p.w, PLAT_H, 6);
    ctx.fillStyle = color;
    ctx.fill();

    // Top shine
    ctx.shadowBlur = 0;
    roundRect(ctx, p.x + 4, p.y + 2, p.w - 8, 3, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();

    // Moving platform arrows
    if (p.type === PT_MOVING && !p.broken) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('◄ ►', p.x + p.w/2, p.y + 9);
    }

    // Breakable crack lines
    if (p.type === PT_BREAKABLE && !p.broken) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * 0.3, p.y);
      ctx.lineTo(p.x + p.w * 0.4, p.y + PLAT_H);
      ctx.moveTo(p.x + p.w * 0.6, p.y);
      ctx.lineTo(p.x + p.w * 0.7, p.y + PLAT_H);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawPlayer() {
  const px = player.x;
  const py = player.y;
  const pw = PLAYER_W;
  const ph = PLAYER_H;
  const cx = px + pw / 2;
  const cy = py + ph / 2;

  // Trail
  for (let i = 0; i < player.trail.length; i++) {
    const t = player.trail[i];
    const a = Math.max(0, t.a);
    ctx.beginPath();
    const tr = (PLAYER_W / 2) * (1 - i / player.trail.length) * 0.6;
    ctx.arc(t.x, t.y, tr, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(COLORS.accent, a * 0.4);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(cx, cy);

  // Squish
  const sx = player.facing * (2 - player.squish);
  const sy = player.squish;
  ctx.scale(sx, sy);

  // Body (rounded square)
  ctx.shadowColor = COLORS.accent;
  ctx.shadowBlur  = 12;

  roundRect(ctx, -pw/2, -ph/2, pw, ph, 10);
  ctx.fillStyle = COLORS.player;
  ctx.fill();

  ctx.shadowBlur = 0;

  // Face highlight
  roundRect(ctx, -pw/2 + 4, -ph/2 + 3, pw - 8, ph * 0.45, 6);
  ctx.fillStyle = COLORS.playerFace;
  ctx.fill();

  // Eyes
  ctx.fillStyle = COLORS.playerEye;
  ctx.beginPath(); ctx.arc(-6, -ph/2 + 10, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 6, -ph/2 + 10, 3.5, 0, Math.PI * 2); ctx.fill();

  // Eye shine
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(-5, -ph/2 + 8.5, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 7, -ph/2 + 8.5, 1.2, 0, Math.PI * 2); ctx.fill();

  // Smile
  ctx.strokeStyle = COLORS.playerEye;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -ph/2 + 16, 5, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Legs (animated)
  const legPhase = frameCount * 0.15;
  const legSwing = Math.sin(legPhase) * 5;
  ctx.fillStyle = COLORS.player;
  roundRect(ctx, -pw/2 + 4, ph/2 - 8, 10, 10, 3);
  ctx.fill();
  roundRect(ctx, pw/2 - 14, ph/2 - 8, 10, 10, 3);
  ctx.fill();

  ctx.restore();
}

function drawParticles() {
  for (let p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(p.color, Math.max(0, p.a));
    ctx.fill();
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  if (!hex || hex[0] !== '#') return `rgba(150,150,150,${alpha})`;
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
