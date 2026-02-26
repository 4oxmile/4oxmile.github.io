'use strict';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const WINNING_SCORE    = 11;
const PADDLE_W         = 12;
const PADDLE_H         = 80;
const PADDLE_RADIUS    = 6;
const BALL_RADIUS      = 6;
const INITIAL_SPEED    = 5;
const SPEED_INCREMENT  = 0.25;
const MAX_SPEED        = 14;
const CANVAS_W         = 480;
const CANVAS_H         = 520;
const PADDLE_MARGIN    = 16; // distance from edge to paddle leading face

const DIFFICULTY_CFG = {
  easy:   { speed: 3.5, reaction: 0.40 },
  normal: { speed: 5.5, reaction: 0.65 },
  hard:   { speed: 8.5, reaction: 0.90 },
};

// ─────────────────────────────────────────────
// Game state
// ─────────────────────────────────────────────
const state = {
  phase: 'start',      // 'start' | 'playing' | 'paused' | 'gameover'
  difficulty: localStorage.getItem('pong_difficulty') || 'normal',
  playerScore: 0,
  aiScore: 0,
  bestScore: parseInt(localStorage.getItem('pong_best') || '0', 10),

  // Paddles — y = top edge
  player: { y: CANVAS_H / 2 - PADDLE_H / 2 },
  ai:     { y: CANVAS_H / 2 - PADDLE_H / 2 },

  // Ball
  ball: { x: CANVAS_W / 2, y: CANVAS_H / 2, vx: 0, vy: 0, speed: INITIAL_SPEED },

  // Input
  keys: {},
  touchStartY: null,
  touchPaddleStartY: null,

  // Loop
  animId: null,
  lastTime: 0,
};

// ─────────────────────────────────────────────
// DOM refs
// ─────────────────────────────────────────────
const canvas          = document.getElementById('gameCanvas');
const ctx             = canvas.getContext('2d');
const startScreen     = document.getElementById('start-screen');
const pauseScreen     = document.getElementById('pause-screen');
const gameoverScreen  = document.getElementById('gameover-screen');
const playerScoreEl   = document.getElementById('player-score');
const aiScoreEl       = document.getElementById('ai-score');
const resultTitleEl   = document.getElementById('result-title');
const finalScoreEl    = document.getElementById('final-score');
const resultSubEl     = document.getElementById('result-subtitle');
const bestBadgeEl     = document.getElementById('best-badge-value');
const startBestEl     = document.getElementById('start-best-value');
const pauseBtn        = document.getElementById('pause-btn');
const diffBtns        = document.querySelectorAll('.diff-btn');

// All overlay screens
const overlays = [startScreen, pauseScreen, gameoverScreen];

// ─────────────────────────────────────────────
// Canvas sizing
// ─────────────────────────────────────────────
function resizeCanvas() {
  const container = document.getElementById('canvas-container');
  const rect = container.getBoundingClientRect();
  const ratio = Math.min(rect.width / CANVAS_W, rect.height / CANVAS_H);
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  canvas.style.width  = Math.floor(CANVAS_W * ratio) + 'px';
  canvas.style.height = Math.floor(CANVAS_H * ratio) + 'px';
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function clamp(val, lo, hi) { return Math.max(lo, Math.min(hi, val)); }

function clampPaddleY(y) { return clamp(y, 0, CANVAS_H - PADDLE_H); }

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function showOnly(overlay) {
  overlays.forEach(o => o.classList.toggle('hidden', o !== overlay));
}

// ─────────────────────────────────────────────
// Ball launch
// ─────────────────────────────────────────────
function launchBall(towardPlayer) {
  const b = state.ball;
  b.x     = CANVAS_W / 2;
  b.y     = CANVAS_H / 2;
  b.speed = INITIAL_SPEED;

  // Random angle between -30° and +30° relative to horizontal
  const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
  const dirX  = towardPlayer ? -1 : 1;
  b.vx = dirX * b.speed * Math.cos(angle);
  b.vy =        b.speed * Math.sin(angle);
}

function resetPaddles() {
  state.player.y = CANVAS_H / 2 - PADDLE_H / 2;
  state.ai.y     = CANVAS_H / 2 - PADDLE_H / 2;
}

// ─────────────────────────────────────────────
// Score / persistence
// ─────────────────────────────────────────────
function updateScoreUI() {
  playerScoreEl.textContent = state.playerScore;
  aiScoreEl.textContent     = state.aiScore;
}

function saveBest() {
  if (state.playerScore > state.bestScore) {
    state.bestScore = state.playerScore;
    localStorage.setItem('pong_best', state.bestScore);
  }
}

// ─────────────────────────────────────────────
// Difficulty
// ─────────────────────────────────────────────
function setDifficulty(d) {
  state.difficulty = d;
  localStorage.setItem('pong_difficulty', d);
  diffBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.diff === d));
}

// ─────────────────────────────────────────────
// Game flow
// ─────────────────────────────────────────────
function startGame() {
  state.playerScore = 0;
  state.aiScore     = 0;
  updateScoreUI();
  resetPaddles();
  launchBall(Math.random() < 0.5);
  state.phase = 'playing';
  showOnly(null);
  pauseBtn.textContent = '일시정지';
  cancelAnimationFrame(state.animId);
  state.lastTime = performance.now();
  state.animId   = requestAnimationFrame(loop);
}

function pauseGame() {
  if (state.phase !== 'playing') return;
  state.phase = 'paused';
  cancelAnimationFrame(state.animId);
  showOnly(pauseScreen);
  pauseBtn.textContent = '재개';
}

function resumeGame() {
  if (state.phase !== 'paused') return;
  state.phase = 'playing';
  showOnly(null);
  pauseBtn.textContent = '일시정지';
  state.lastTime = performance.now();
  state.animId   = requestAnimationFrame(loop);
}

function endGame(playerWon) {
  state.phase = 'gameover';
  cancelAnimationFrame(state.animId);
  saveBest();

  resultTitleEl.textContent = playerWon ? '승리!' : '패배';
  resultTitleEl.className   = 'result-title ' + (playerWon ? 'win' : 'lose');
  finalScoreEl.textContent  = state.playerScore + ' : ' + state.aiScore;
  resultSubEl.textContent   = playerWon ? '완벽한 플레이! 멋져요!' : '다시 도전해보세요!';
  bestBadgeEl.textContent   = state.bestScore;

  showOnly(gameoverScreen);
}

function goToMenu() {
  state.phase = 'start';
  cancelAnimationFrame(state.animId);
  startBestEl.textContent = state.bestScore;
  showOnly(startScreen);
  drawStatic();
}

// ─────────────────────────────────────────────
// Physics update
// ─────────────────────────────────────────────
function update(dt) {
  const b   = state.ball;
  const p   = state.player;
  const ai  = state.ai;
  const cfg = DIFFICULTY_CFG[state.difficulty];

  // ── Apply key input (frame-rate independent via dt) ──
  const keySpeed = 480; // pixels per second
  if (state.keys['ArrowUp']   || state.keys['w'] || state.keys['W']) {
    p.y = clampPaddleY(p.y - keySpeed * dt);
  }
  if (state.keys['ArrowDown'] || state.keys['s'] || state.keys['S']) {
    p.y = clampPaddleY(p.y + keySpeed * dt);
  }

  // ── Ball movement ──
  b.x += b.vx * dt * 60;
  b.y += b.vy * dt * 60;

  // ── Top / bottom wall bounce ──
  if (b.y - BALL_RADIUS <= 0) {
    b.y  = BALL_RADIUS;
    b.vy = Math.abs(b.vy);
  } else if (b.y + BALL_RADIUS >= CANVAS_H) {
    b.y  = CANVAS_H - BALL_RADIUS;
    b.vy = -Math.abs(b.vy);
  }

  // ── Player paddle: x range [PADDLE_MARGIN, PADDLE_MARGIN + PADDLE_W] ──
  const pLeft  = PADDLE_MARGIN;
  const pRight = PADDLE_MARGIN + PADDLE_W;

  if (
    b.vx < 0 &&
    b.x - BALL_RADIUS <= pRight &&
    b.x + BALL_RADIUS >= pLeft &&
    b.y + BALL_RADIUS >= p.y &&
    b.y - BALL_RADIUS <= p.y + PADDLE_H
  ) {
    const relHit  = (b.y - (p.y + PADDLE_H / 2)) / (PADDLE_H / 2); // -1 to +1
    const angle   = relHit * (Math.PI / 3.5); // max ~51°
    b.speed = Math.min(b.speed + SPEED_INCREMENT, MAX_SPEED);
    b.vx    =  Math.cos(angle) * b.speed;
    b.vy    =  Math.sin(angle) * b.speed;
    b.x     = pRight + BALL_RADIUS + 1; // push out of paddle
  }

  // ── AI paddle: x range [CANVAS_W - PADDLE_MARGIN - PADDLE_W, CANVAS_W - PADDLE_MARGIN] ──
  const aLeft  = CANVAS_W - PADDLE_MARGIN - PADDLE_W;
  const aRight = CANVAS_W - PADDLE_MARGIN;

  if (
    b.vx > 0 &&
    b.x + BALL_RADIUS >= aLeft &&
    b.x - BALL_RADIUS <= aRight &&
    b.y + BALL_RADIUS >= ai.y &&
    b.y - BALL_RADIUS <= ai.y + PADDLE_H
  ) {
    const relHit = (b.y - (ai.y + PADDLE_H / 2)) / (PADDLE_H / 2);
    const angle  = relHit * (Math.PI / 3.5);
    b.speed = Math.min(b.speed + SPEED_INCREMENT, MAX_SPEED);
    b.vx    = -Math.cos(angle) * b.speed;
    b.vy    =  Math.sin(angle) * b.speed;
    b.x     = aLeft - BALL_RADIUS - 1;
  }

  // ── Scoring ──
  if (b.x + BALL_RADIUS < 0) {
    // AI scores
    state.aiScore++;
    updateScoreUI();
    if (state.aiScore >= WINNING_SCORE) { endGame(false); return; }
    resetPaddles();
    launchBall(true); // toward player (punish player)
    return;
  }
  if (b.x - BALL_RADIUS > CANVAS_W) {
    // Player scores
    state.playerScore++;
    updateScoreUI();
    if (state.playerScore >= WINNING_SCORE) { endGame(true); return; }
    resetPaddles();
    launchBall(false); // toward AI next
    return;
  }

  // ── AI paddle movement (pursuit with prediction) ──
  let targetY;
  if (b.vx > 0) {
    // Ball heading toward AI: predict intercept via linear extrapolation + bounce fold
    const dist   = aLeft - b.x;
    const ticks  = dist / (b.vx * 60);
    let predictY = b.y + b.vy * 60 * ticks;
    const range  = CANVAS_H * 2;
    predictY = ((predictY % range) + range) % range;
    if (predictY > CANVAS_H) predictY = range - predictY;
    targetY = predictY;
  } else {
    // Ball moving away: drift toward center
    targetY = CANVAS_H / 2;
  }

  const aiCenter   = ai.y + PADDLE_H / 2;
  const diff       = targetY - aiCenter;
  const maxStep    = cfg.speed * dt * 60;
  const step       = clamp(diff * cfg.reaction, -maxStep, maxStep);
  ai.y = clampPaddleY(ai.y + step);
}

// ─────────────────────────────────────────────
// Rendering helpers
// ─────────────────────────────────────────────
function fillRoundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

// ─────────────────────────────────────────────
// Draw
// ─────────────────────────────────────────────
function draw() {
  const b  = state.ball;
  const p  = state.player;
  const ai = state.ai;

  const boardBg    = getCSSVar('--board-bg');
  const mutedColor = getCSSVar('--text-muted');
  const accentCol  = getCSSVar('--accent');
  const textCol    = getCSSVar('--text-primary');

  // Background
  ctx.fillStyle = boardBg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Dashed center line
  ctx.save();
  ctx.strokeStyle = mutedColor;
  ctx.lineWidth   = 3;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.moveTo(CANVAS_W / 2, 0);
  ctx.lineTo(CANVAS_W / 2, CANVAS_H);
  ctx.stroke();
  ctx.restore();

  // Player paddle (left) – accent with glow
  ctx.save();
  ctx.shadowColor = accentCol;
  ctx.shadowBlur  = 16;
  ctx.fillStyle   = accentCol;
  fillRoundRect(PADDLE_MARGIN, p.y, PADDLE_W, PADDLE_H, PADDLE_RADIUS);
  ctx.restore();

  // AI paddle (right) – white/text-primary
  ctx.save();
  ctx.fillStyle = textCol;
  fillRoundRect(CANVAS_W - PADDLE_MARGIN - PADDLE_W, ai.y, PADDLE_W, PADDLE_H, PADDLE_RADIUS);
  ctx.restore();

  // Ball – white with glow
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,0.9)';
  ctx.shadowBlur  = 18;
  ctx.fillStyle   = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStatic() {
  ctx.fillStyle = getCSSVar('--board-bg');
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.save();
  ctx.strokeStyle = getCSSVar('--text-muted');
  ctx.lineWidth   = 3;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.moveTo(CANVAS_W / 2, 0);
  ctx.lineTo(CANVAS_W / 2, CANVAS_H);
  ctx.stroke();
  ctx.restore();
}

// ─────────────────────────────────────────────
// Game loop
// ─────────────────────────────────────────────
function loop(timestamp) {
  if (state.phase !== 'playing') return;

  const raw = timestamp - state.lastTime;
  const dt  = Math.min(raw / 1000, 0.05); // cap to 50 ms to avoid spiral-of-death
  state.lastTime = timestamp;

  update(dt);

  if (state.phase === 'playing') {
    draw();
    state.animId = requestAnimationFrame(loop);
  }
}

// ─────────────────────────────────────────────
// Input: keyboard
// ─────────────────────────────────────────────
window.addEventListener('keydown', e => {
  state.keys[e.key] = true;

  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (state.phase === 'playing') pauseGame();
    else if (state.phase === 'paused') resumeGame();
  }
  if (e.key === 'Enter') {
    if (state.phase === 'start' || state.phase === 'gameover') startGame();
    else if (state.phase === 'paused') resumeGame();
  }
  // Prevent page scroll for arrow keys
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', e => { delete state.keys[e.key]; });

// ─────────────────────────────────────────────
// Input: touch (drag to move paddle)
// ─────────────────────────────────────────────
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  const rect  = canvas.getBoundingClientRect();
  const scaleY = CANVAS_H / rect.height;
  state.touchStartY        = touch.clientY * scaleY;
  state.touchPaddleStartY  = state.player.y;
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (state.phase !== 'playing') return;
  const touch  = e.changedTouches[0];
  const rect   = canvas.getBoundingClientRect();
  const scaleY = CANVAS_H / rect.height;
  const delta  = touch.clientY * scaleY - state.touchStartY;
  state.player.y = clampPaddleY(state.touchPaddleStartY + delta);
}, { passive: false });

// Tap: pause / resume
canvas.addEventListener('click', () => {
  if (state.phase === 'playing')  pauseGame();
  else if (state.phase === 'paused') resumeGame();
});

// ─────────────────────────────────────────────
// Button wiring
// ─────────────────────────────────────────────
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('menu-btn').addEventListener('click', goToMenu);
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('pause-menu-btn').addEventListener('click', goToMenu);

pauseBtn.addEventListener('click', () => {
  if (state.phase === 'playing')  pauseGame();
  else if (state.phase === 'paused') resumeGame();
});

diffBtns.forEach(btn => {
  btn.addEventListener('click', () => setDifficulty(btn.dataset.diff));
});

// ─────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────
function init() {
  resizeCanvas();
  setDifficulty(state.difficulty);
  startBestEl.textContent = state.bestScore;
  showOnly(startScreen);
  drawStatic();
}

window.addEventListener('resize', () => {
  resizeCanvas();
  if (state.phase !== 'playing') drawStatic();
});

init();
