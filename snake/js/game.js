'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const GRID_SIZE   = 20;       // cells across / down
const CELL_PX     = 18;       // logical cell size (canvas is sized from this)
const BASE_SPEED  = 160;      // ms per tick at length 1
const MIN_SPEED   = 60;       // fastest possible tick
const SPEED_STEP  = 4;        // ms reduction per extra cell
const LS_KEY      = 'snake_best';

// ── Direction constants ────────────────────────────────────────────────────────
const DIR = { UP: 'UP', DOWN: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT' };
const OPPOSITE = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
const VECTORS  = {
  UP:    { x:  0, y: -1 },
  DOWN:  { x:  0, y:  1 },
  LEFT:  { x: -1, y:  0 },
  RIGHT: { x:  1, y:  0 },
};

// ── Colours ────────────────────────────────────────────────────────────────────
const PALETTE = {
  snakeHead:   '#3B82F6',
  snakeBody:   '#1D4ED8',
  snakeTail:   '#1E3A8A',
  foodOuter:   '#EC4899',
  foodInner:   '#F9A8D4',
  gridLine:    'rgba(255,255,255,0.03)',
};

// Light-mode overrides (read from CSS variable after DOM ready)
function resolveColours() {
  const style = getComputedStyle(document.body);
  const board  = style.getPropertyValue('--board-bg').trim();
  // Keep snake/food colours vivid regardless of colour scheme
  return board; // used only to verify we read CSS vars; actual board colour set via CSS
}

// ── State ──────────────────────────────────────────────────────────────────────
let snake, direction, nextDir, food, score, bestScore, gameActive, animFrame, tickTimer, foodPulse;

// ── DOM refs ───────────────────────────────────────────────────────────────────
const canvas        = document.getElementById('gameCanvas');
const ctx           = canvas.getContext('2d');
const startScreen   = document.getElementById('startScreen');
const gameOverScreen= document.getElementById('gameOverScreen');
const scoreEl       = document.getElementById('score');
const bestEl        = document.getElementById('best');
const overScoreEl   = document.getElementById('overScore');
const overBestEl    = document.getElementById('overBest');
const newRecordEl   = document.getElementById('newRecord');

// ── Canvas sizing ──────────────────────────────────────────────────────────────
function sizeCanvas() {
  const wrapper  = document.querySelector('.canvas-wrapper');
  const wrapRect = wrapper.getBoundingClientRect();
  const available = Math.min(wrapRect.width - 24, wrapRect.height - 24);
  const cellSize  = Math.floor(available / GRID_SIZE);
  const px        = cellSize * GRID_SIZE;

  canvas.width  = px;
  canvas.height = px;
  canvas.style.width  = px + 'px';
  canvas.style.height = px + 'px';

  // Store for render
  canvas._cell = cellSize;
}

// ── Initialise game state ──────────────────────────────────────────────────────
function initGame() {
  const mid = Math.floor(GRID_SIZE / 2);
  snake     = [
    { x: mid,     y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  direction  = DIR.RIGHT;
  nextDir    = DIR.RIGHT;
  score      = 0;
  gameActive = false;
  foodPulse  = 0;
  spawnFood();
  updateScoreUI();
}

// ── Food ───────────────────────────────────────────────────────────────────────
function spawnFood() {
  const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
  let pos;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (occupied.has(`${pos.x},${pos.y}`));
  food = pos;
}

// ── Speed ──────────────────────────────────────────────────────────────────────
function tickInterval() {
  return Math.max(MIN_SPEED, BASE_SPEED - (snake.length - 3) * SPEED_STEP);
}

// ── Game loop (tick) ───────────────────────────────────────────────────────────
function startTick() {
  clearTimeout(tickTimer);
  tickTimer = setTimeout(function tick() {
    if (!gameActive) return;
    update();
    render();
    tickTimer = setTimeout(tick, tickInterval());
  }, tickInterval());
}

function update() {
  direction = nextDir;
  const head = snake[0];
  const vec  = VECTORS[direction];
  const newHead = { x: head.x + vec.x, y: head.y + vec.y };

  // Wall collision
  if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
    return triggerGameOver();
  }

  // Self collision (skip last tail since it will move)
  for (let i = 0; i < snake.length - 1; i++) {
    if (snake[i].x === newHead.x && snake[i].y === newHead.y) {
      return triggerGameOver();
    }
  }

  snake.unshift(newHead);

  const ate = newHead.x === food.x && newHead.y === food.y;
  if (ate) {
    score++;
    updateScoreUI();
    spawnFood();
  } else {
    snake.pop();
  }
}

// ── Rendering ──────────────────────────────────────────────────────────────────
function render() {
  const cell = canvas._cell || Math.floor(canvas.width / GRID_SIZE);
  const W = canvas.width;
  const H = canvas.height;
  const isDark = !window.matchMedia('(prefers-color-scheme: light)').matches;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = isDark
    ? 'rgba(255,255,255,0.035)'
    : 'rgba(0,0,0,0.04)';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < GRID_SIZE; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(W, i * cell); ctx.stroke();
  }

  // Food (pulsing glow)
  foodPulse = (foodPulse + 0.06) % (Math.PI * 2);
  const pulse = 0.6 + 0.4 * Math.sin(foodPulse);
  const fx = food.x * cell + cell / 2;
  const fy = food.y * cell + cell / 2;
  const fr = cell * 0.32 * pulse;

  ctx.save();
  ctx.shadowColor = PALETTE.foodOuter;
  ctx.shadowBlur  = 10 * pulse;
  const foodGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr + 2);
  foodGrad.addColorStop(0, PALETTE.foodInner);
  foodGrad.addColorStop(1, PALETTE.foodOuter);
  ctx.fillStyle = foodGrad;
  ctx.beginPath();
  ctx.arc(fx, fy, fr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Snake
  const total = snake.length;
  for (let i = total - 1; i >= 0; i--) {
    const seg = snake[i];
    const t   = i / (total - 1 || 1); // 0 = head, 1 = tail

    const r = cell * 0.42;
    const cx2 = seg.x * cell + cell / 2;
    const cy2 = seg.y * cell + cell / 2;

    if (i === 0) {
      // Head — bright with glow
      ctx.save();
      ctx.shadowColor = PALETTE.snakeHead;
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = PALETTE.snakeHead;
      roundRect(ctx, seg.x * cell + 1, seg.y * cell + 1, cell - 2, cell - 2, r * 0.7);
      ctx.fill();
      ctx.restore();

      // Eyes
      drawEyes(seg, cell, direction);
    } else {
      // Body gradient head->tail
      const alpha = 1 - t * 0.4;
      const bodyCol = isDark
        ? `rgba(29, 78, 216, ${alpha})`
        : `rgba(59,130,246,${alpha})`;
      ctx.fillStyle = bodyCol;
      roundRect(ctx, seg.x * cell + 2, seg.y * cell + 2, cell - 4, cell - 4, r * 0.5);
      ctx.fill();
    }
  }
}

function drawEyes(head, cell, dir) {
  const offsets = {
    RIGHT: [{ x: 0.65, y: 0.28 }, { x: 0.65, y: 0.72 }],
    LEFT:  [{ x: 0.35, y: 0.28 }, { x: 0.35, y: 0.72 }],
    UP:    [{ x: 0.28, y: 0.35 }, { x: 0.72, y: 0.35 }],
    DOWN:  [{ x: 0.28, y: 0.65 }, { x: 0.72, y: 0.65 }],
  };
  const eyes = offsets[dir] || offsets.RIGHT;
  const r = cell * 0.09;

  ctx.fillStyle = '#fff';
  for (const e of eyes) {
    ctx.beginPath();
    ctx.arc(head.x * cell + e.x * cell, head.y * cell + e.y * cell, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  if (r > w / 2) r = w / 2;
  if (r > h / 2) r = h / 2;
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

// ── Score UI ───────────────────────────────────────────────────────────────────
function updateScoreUI() {
  const display = score; // length above starting 3? Show raw score counter
  scoreEl.textContent = display;
  bestEl.textContent  = bestScore;
}

// ── Game over ──────────────────────────────────────────────────────────────────
function triggerGameOver() {
  gameActive = false;
  clearTimeout(tickTimer);

  const isNewRecord = score > bestScore;
  if (isNewRecord) {
    bestScore = score;
    localStorage.setItem(LS_KEY, bestScore);
  }

  overScoreEl.textContent = score;
  overBestEl.textContent  = bestScore;
  newRecordEl.classList.toggle('hidden', !isNewRecord);
  bestEl.textContent = bestScore;

  gameOverScreen.classList.remove('hidden');
  if(typeof Leaderboard!=='undefined')Leaderboard.ready('snake',score);
}

// ── Start / restart ────────────────────────────────────────────────────────────
function startGame() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  sizeCanvas();
  initGame();
  gameActive = true;
  render();
  startTick();
}

// ── Input: keyboard ────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const map = {
    ArrowUp:    DIR.UP,
    ArrowDown:  DIR.DOWN,
    ArrowLeft:  DIR.LEFT,
    ArrowRight: DIR.RIGHT,
    w: DIR.UP, a: DIR.LEFT, s: DIR.DOWN, d: DIR.RIGHT,
  };
  const d = map[e.key];
  if (d && d !== OPPOSITE[direction]) {
    nextDir = d;
    e.preventDefault();
  }
});

// ── Input: touch swipe ─────────────────────────────────────────────────────────
let touchStart = null;

document.addEventListener('touchstart', e => {
  const t = e.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: true });

document.addEventListener('touchend', e => {
  if (!touchStart || !gameActive) return;
  const t  = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;

  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // tap, not swipe

  let d;
  if (Math.abs(dx) > Math.abs(dy)) {
    d = dx > 0 ? DIR.RIGHT : DIR.LEFT;
  } else {
    d = dy > 0 ? DIR.DOWN : DIR.UP;
  }
  if (d !== OPPOSITE[direction]) nextDir = d;
}, { passive: true });

// ── D-pad buttons ──────────────────────────────────────────────────────────────
function bindDpad(id, dir) {
  const btn = document.getElementById(id);
  if (!btn) return;

  function press(e) {
    e.preventDefault();
    if (!gameActive) return;
    if (dir !== OPPOSITE[direction]) nextDir = dir;
    btn.classList.add('pressed');
  }
  function release() {
    btn.classList.remove('pressed');
  }

  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend',   release, { passive: true });
  btn.addEventListener('mousedown',  press);
  btn.addEventListener('mouseup',    release);
  btn.addEventListener('mouseleave', release);
}

bindDpad('dpad-up',    DIR.UP);
bindDpad('dpad-down',  DIR.DOWN);
bindDpad('dpad-left',  DIR.LEFT);
bindDpad('dpad-right', DIR.RIGHT);

// ── Start / game-over button wiring ───────────────────────────────────────────
document.getElementById('startBtn').addEventListener('click', () => {
  startScreen.classList.add('hidden');
  startGame();
});

document.getElementById('retryBtn').addEventListener('click', () => {
  gameOverScreen.classList.add('hidden');
  startGame();
});

// Also allow tapping anywhere on start screen overlay
startScreen.addEventListener('click', e => {
  if (e.target === startScreen || e.target.classList.contains('overlay')) {
    startScreen.classList.add('hidden');
    startGame();
  }
});

// ── Resize ─────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  sizeCanvas();
  render();
});

// ── Boot ───────────────────────────────────────────────────────────────────────
(function init() {
  bestScore = parseInt(localStorage.getItem(LS_KEY) || '0', 10);
  sizeCanvas();
  initGame();
  render(); // draw initial state behind the overlay
  bestEl.textContent = bestScore;
})();
