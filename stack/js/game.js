'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const BLOCK_HEIGHT = 28;
const INITIAL_WIDTH = 220;
const CANVAS_COLS = 320;          // logical width for block math
const PERFECT_TOLERANCE = 6;      // px within which placement = perfect
const SHRINK_RATIO = 0.85;        // excess/delta kept on miss
const SPEED_BASE = 2.2;           // starting slide speed (px/frame)
const SPEED_INCREMENT = 0.07;     // speed increase per block
const SPEED_MAX = 7.5;
const SCROLL_EASE = 0.12;         // camera smoothing factor
const GROUND_BLOCKS = 2;          // initial platform blocks
const BLOCK_ALPHA = 0.92;

// Rainbow hue progression per block
const HUE_START = 200;
const HUE_STEP = 11;

// ─── State ────────────────────────────────────────────────────────────────────
let canvas, ctx;
let animId = null;

let blocks = [];       // { x, y, w, hue }
let moving = null;     // { x, w, dir, hue }
let cameraY = 0;       // world Y that maps to canvas bottom
let targetCameraY = 0;
let score = 0;
let bestScore = 0;
let phase = 'start';   // 'start' | 'playing' | 'over'
let gameWidth = 320;   // canvas logical/physical (updated on resize)
let gameHeight = 600;
let dpr = 1;

// ─── Overlay/DOM refs ─────────────────────────────────────────────────────────
let overlayStart, overlayOver;
let scoreEl, bestEl;
let overScoreEl, overBestEl;
let perfectEl;

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  canvas       = document.getElementById('game-canvas');
  ctx          = canvas.getContext('2d');
  overlayStart = document.getElementById('overlay-start');
  overlayOver  = document.getElementById('overlay-over');
  scoreEl      = document.getElementById('score-val');
  bestEl       = document.getElementById('best-val');
  overScoreEl  = document.getElementById('over-score-val');
  overBestEl   = document.getElementById('over-best-val');
  perfectEl    = document.getElementById('perfect-text');

  bestScore = parseInt(localStorage.getItem('stack_best') || '0', 10);
  bestEl.textContent = bestScore;

  setupEvents();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  showOverlay(overlayStart);
  rafLoop();
});

// ─── Resize ───────────────────────────────────────────────────────────────────
function resizeCanvas() {
  dpr = window.devicePixelRatio || 1;
  const wrapper = canvas.parentElement;
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight;

  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.scale(dpr, dpr);

  gameWidth  = w;
  gameHeight = h;
}

// ─── Events ───────────────────────────────────────────────────────────────────
function setupEvents() {
  canvas.addEventListener('pointerdown', onTap);
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      onTap();
    }
  });

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', startGame);
}

function onTap() {
  if (phase === 'playing') drop();
  else if (phase === 'start') startGame();
  else if (phase === 'over') startGame();
}

// ─── Game lifecycle ───────────────────────────────────────────────────────────
function startGame() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  hideOverlay(overlayStart);
  hideOverlay(overlayOver);
  phase = 'playing';
  score = 0;
  scoreEl.textContent = '0';
  blocks = [];
  cameraY = 0;
  targetCameraY = 0;

  // Build ground platform blocks
  const cx = gameWidth / 2;
  for (let i = 0; i < GROUND_BLOCKS; i++) {
    const y = -(BLOCK_HEIGHT * i);
    blocks.push({ x: cx - INITIAL_WIDTH / 2, y, w: INITIAL_WIDTH, hue: HUE_START });
  }
  cameraY = blocks[blocks.length - 1].y;
  targetCameraY = cameraY;

  spawnMoving();
}

function spawnMoving() {
  const topBlock = blocks[blocks.length - 1];
  const newY = topBlock.y - BLOCK_HEIGHT;
  const hue = (HUE_START + (blocks.length - GROUND_BLOCKS) * HUE_STEP) % 360;
  const speed = Math.min(SPEED_BASE + score * SPEED_INCREMENT, SPEED_MAX);
  // alternate starting direction
  const dir = blocks.length % 2 === 0 ? 1 : -1;

  moving = {
    x: dir > 0 ? -topBlock.w : gameWidth,
    y: newY,
    w: topBlock.w,
    hue,
    dir,
    speed,
  };

  // Nudge camera up for new row
  targetCameraY = newY;
}

function drop() {
  if (!moving) return;

  const top = blocks[blocks.length - 1];
  const mx = moving.x;
  const mw = moving.w;
  const tx = top.x;
  const tw = top.w;

  // Overlap
  const overlapLeft  = Math.max(mx, tx);
  const overlapRight = Math.min(mx + mw, tx + tw);
  const overlapW = overlapRight - overlapLeft;

  if (overlapW <= 0) {
    // Missed completely
    triggerGameOver();
    return;
  }

  const delta = Math.abs(mx - tx);

  if (delta <= PERFECT_TOLERANCE) {
    // Perfect – keep same width, snap x
    addBlock(tx, moving.y, tw, moving.hue);
    showPerfect();
    addScore(2); // bonus
  } else {
    // Partial
    const newW = overlapW;
    addBlock(overlapLeft, moving.y, newW, moving.hue);
    addScore(1);
    // Spawn falling chunk (visual only)
    spawnFallingChunk(mx, mw, overlapLeft, overlapW, moving.y, moving.hue);
  }

  moving = null;
  spawnMoving();
}

function addBlock(x, y, w, hue) {
  blocks.push({ x, y, w, hue });
}

function addScore(pts) {
  score += pts;
  scoreEl.textContent = score;
  if (score > bestScore) {
    bestScore = score;
    bestEl.textContent = bestScore;
    localStorage.setItem('stack_best', bestScore);
  }
}

// ─── Falling chunks ───────────────────────────────────────────────────────────
let fallingChunks = [];

function spawnFallingChunk(mx, mw, overlapLeft, overlapW, y, hue) {
  // Left chunk
  if (overlapLeft > mx) {
    fallingChunks.push({
      x: mx, y,
      w: overlapLeft - mx,
      h: BLOCK_HEIGHT,
      hue,
      vy: 0,
      vx: -0.5,
      life: 1.0,
    });
  }
  // Right chunk
  const overlapRight = overlapLeft + overlapW;
  const chunkRight = mx + mw;
  if (chunkRight > overlapRight) {
    fallingChunks.push({
      x: overlapRight, y,
      w: chunkRight - overlapRight,
      h: BLOCK_HEIGHT,
      hue,
      vy: 0,
      vx: 0.5,
      life: 1.0,
    });
  }
}

function updateFallingChunks() {
  const gravity = 0.45;
  fallingChunks = fallingChunks.filter(c => c.life > 0.01);
  for (const c of fallingChunks) {
    c.vy += gravity;
    c.y  += c.vy;
    c.x  += c.vx;
    c.life -= 0.022;
  }
}

// ─── Game over ────────────────────────────────────────────────────────────────
function triggerGameOver() {
  phase = 'over';
  moving = null;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('stack_best', bestScore);
  }
  overScoreEl.textContent = score;
  overBestEl.textContent  = '최고 기록: ' + bestScore;
  bestEl.textContent = bestScore;
  if(typeof Leaderboard!=='undefined')Leaderboard.ready('stack',score);
  setTimeout(() => showOverlay(overlayOver), 320);
}

// ─── Overlays ─────────────────────────────────────────────────────────────────
function showOverlay(el) {
  el.classList.remove('hidden');
}
function hideOverlay(el) {
  el.classList.add('hidden');
}

// ─── Perfect feedback ─────────────────────────────────────────────────────────
let perfectTimeout = null;

function showPerfect() {
  perfectEl.classList.remove('show');
  void perfectEl.offsetWidth; // reflow
  perfectEl.classList.add('show');
  clearTimeout(perfectTimeout);
  perfectTimeout = setTimeout(() => perfectEl.classList.remove('show'), 900);
}

// ─── RAF loop ─────────────────────────────────────────────────────────────────
function rafLoop() {
  animId = requestAnimationFrame(rafLoop);
  update();
  render();
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update() {
  if (phase !== 'playing') return;

  // Move sliding block
  if (moving) {
    moving.x += moving.dir * moving.speed;
    // Bounce off edges (with overshoot room)
    if (moving.x + moving.w > gameWidth + 60) moving.dir = -1;
    if (moving.x < -60) moving.dir = 1;
  }

  // Smooth camera
  cameraY += (targetCameraY - cameraY) * SCROLL_EASE;

  updateFallingChunks();
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  const W = gameWidth;
  const H = gameHeight;

  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    || !window.matchMedia('(prefers-color-scheme: light)').matches;
  if (isDark) {
    grad.addColorStop(0, '#0A0E14');
    grad.addColorStop(1, '#0D1117');
  } else {
    grad.addColorStop(0, '#F0F2F5');
    grad.addColorStop(1, '#E9ECF0');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // World-to-screen transform:
  // The top of the latest block should sit ~20% from the top of the canvas.
  const worldToScreen = (worldY) => {
    // worldY: negative = higher up
    // cameraY: world Y of the "view top reference"
    const viewTop = cameraY - H * 0.20;
    return (worldY - viewTop);
  };

  // Draw placed blocks
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const sy = worldToScreen(b.y);
    if (sy > H + BLOCK_HEIGHT * 2 || sy < -BLOCK_HEIGHT * 10) continue;
    drawBlock(ctx, b.x, sy, b.w, BLOCK_HEIGHT, b.hue, 1.0, i < GROUND_BLOCKS);
  }

  // Draw moving block
  if (moving && phase === 'playing') {
    const sy = worldToScreen(moving.y);
    drawBlock(ctx, moving.x, sy, moving.w, BLOCK_HEIGHT, moving.hue, 0.95, false);
  }

  // Draw falling chunks
  for (const c of fallingChunks) {
    const sy = worldToScreen(c.y);
    drawBlock(ctx, c.x, sy, c.w, c.h, c.hue, c.life * 0.8, false);
  }

  // Guide line (faint vertical center of top block)
  if (phase === 'playing' && blocks.length > 0) {
    const top = blocks[blocks.length - 1];
    const cx = top.x + top.w / 2;
    const topY = worldToScreen(top.y);
    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, topY);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBlock(ctx, x, y, w, h, hue, alpha, isGround) {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * BLOCK_ALPHA;

  // Main fill
  const fill = hslToRgb(hue, isGround ? 20 : 65, isGround ? 30 : 52);
  ctx.fillStyle = fill;
  const r = Math.min(5, h / 3);
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  // Top highlight
  ctx.globalAlpha = alpha * 0.35;
  const hiGrad = ctx.createLinearGradient(x, y, x, y + h * 0.5);
  hiGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
  hiGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hiGrad;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  // Edge stroke
  ctx.globalAlpha = alpha * 0.25;
  ctx.strokeStyle = hslToRgb(hue, 70, 70);
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();

  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,     y + h, x,     y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const r = Math.round(f(0) * 255);
  const g = Math.round(f(8) * 255);
  const b = Math.round(f(4) * 255);
  return `rgb(${r},${g},${b})`;
}
