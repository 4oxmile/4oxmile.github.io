'use strict';

// ─── MAZE DEFINITION ──────────────────────────────────────────────────────────
// 0=dot, 1=wall, 2=empty(no dot), 3=power pellet, 4=ghost house door
const MAZE_TEMPLATE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,3,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,3,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,0,1],
  [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [1,1,1,1,0,1,1,1,2,1,1,1,2,1,1,1,0,1,1,1,1],
  [1,1,1,1,0,1,2,2,2,2,2,2,2,2,2,1,0,1,1,1,1],
  [1,1,1,1,0,1,2,1,1,4,4,4,1,1,2,1,0,1,1,1,1],
  [2,2,2,2,0,2,2,1,2,2,2,2,2,1,2,2,0,2,2,2,2],
  [1,1,1,1,0,1,2,1,1,1,1,1,1,1,2,1,0,1,1,1,1],
  [1,1,1,1,0,1,2,2,2,2,2,2,2,2,2,1,0,1,1,1,1],
  [1,1,1,1,0,1,2,1,1,1,1,1,1,1,2,1,0,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
  [1,3,0,1,0,0,0,0,0,0,2,0,0,0,0,0,0,1,0,3,1],
  [1,1,0,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,0,1,1],
  [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  [1,0,1,1,1,1,1,1,0,1,1,1,0,1,1,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const ROWS = MAZE_TEMPLATE.length;   // 22
const COLS = MAZE_TEMPLATE[0].length; // 21
const CELL = 22;
const CANVAS_W = COLS * CELL;  // 462
const CANVAS_H = ROWS * CELL;  // 484

// Directions as named constants for identity comparison
const UP    = 'up';
const DOWN  = 'down';
const LEFT  = 'left';
const RIGHT = 'right';
const NONE  = 'none';

const DX = { up: 0,  down: 0,  left: -1, right: 1,  none: 0 };
const DY = { up: -1, down: 1,  left: 0,  right: 0,  none: 0 };
const OPP = { up: DOWN, down: UP, left: RIGHT, right: LEFT, none: NONE };
const ALL_DIRS = [UP, DOWN, LEFT, RIGHT];

const GHOST_COLORS = ['#FF0000', '#FFB8FF', '#00FFFF', '#FFB852'];
const GHOST_NAMES  = ['Blinky', 'Pinky', 'Inky', 'Clyde'];

const SCORE_DOT    = 10;
const SCORE_PELLET = 50;
const GHOST_SCORES = [200, 400, 800, 1600];

const FRIGHTENED_MS    = 7000;
const FLASH_THRESHOLD  = 2000;
const PACMAN_SPEED     = 5.8;   // cells/sec
const GHOST_SPEED_NORM = 4.8;
const GHOST_SPEED_FRIT = 2.5;
const GHOST_SPEED_DEAD = 8.0;

// Tunnel row
const TUNNEL_ROW = 10;

// ─── STATE ────────────────────────────────────────────────────────────────────
let canvas, ctx;
let animFrame = 0;
let lastTime  = 0;
// 'start' | 'playing' | 'dead' | 'levelclear' | 'gameover'
let gameState = 'start';

let maze   = [];
let totalDots = 0;
let dotsEaten = 0;

let pacman = {};
let ghosts = [];
let score  = 0;
let highScore = 0;
let lives  = 3;
let level  = 1;
let ghostCombo = 0;

let frightenedMs  = 0;
let frightenedOn  = false;

let phaseTimer = 0; // ms until next phase change (dead → respawn, levelclear → next)
let readyMs    = 0; // countdown for "READY" display
let isReady    = false;

let scorePopups = [];
let swipeStart  = null;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function cellX(col) { return col * CELL + CELL / 2; }
function cellY(row) { return row * CELL + CELL / 2; }

function mazeAt(col, row) {
  if (row < 0 || row >= ROWS) return 1;
  const c = wrapCol(col);
  return maze[row][c];
}

function templateAt(col, row) {
  if (row < 0 || row >= ROWS) return 1;
  const c = wrapCol(col);
  return MAZE_TEMPLATE[row][c];
}

function wrapCol(col) {
  return ((col % COLS) + COLS) % COLS;
}

function isWall(col, row) {
  return mazeAt(col, row) === 1;
}

function canPacmanEnter(col, row) {
  const v = mazeAt(col, row);
  // Pacman cannot enter walls or ghost house door cells
  return v !== 1 && v !== 4;
}

function canGhostEnter(col, row, isEaten) {
  const v = mazeAt(col, row);
  if (v === 1) return false;
  if (v === 4) return isEaten; // only eaten ghosts re-enter house through door
  return true;
}

function dist2(ax, ay, bx, by) {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

function countTotalDots() {
  let n = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (MAZE_TEMPLATE[r][c] === 0 || MAZE_TEMPLATE[r][c] === 3) n++;
  return n;
}

// ─── SAVE / LOAD ──────────────────────────────────────────────────────────────
function saveHS() { try { localStorage.setItem('pacman_hs', highScore); } catch(_) {} }
function loadHS() { try { return Math.max(0, parseInt(localStorage.getItem('pacman_hs') || '0', 10) || 0); } catch(_) { return 0; } }

// ─── INIT ─────────────────────────────────────────────────────────────────────
function initMaze() {
  maze = MAZE_TEMPLATE.map(r => [...r]);
  totalDots = countTotalDots();
  dotsEaten = 0;
}

function initPacman() {
  pacman = {
    col: 10, row: 16,
    px: cellX(10), py: cellY(16), // pixel position (center)
    dir: NONE,
    nextDir: NONE,
    speed: PACMAN_SPEED,
    // mouth animation
    mouthT: 0,
    dead: false,
  };
}

// Ghost house inner positions
const GHOST_STARTS = [
  { col: 10, row: 8,  home: { col: 10, row: 8  }, exitDelay: 0,    startDir: LEFT },  // Blinky
  { col: 9,  row: 10, home: { col: 9,  row: 10 }, exitDelay: 3000, startDir: UP   },  // Pinky
  { col: 10, row: 10, home: { col: 10, row: 10 }, exitDelay: 6000, startDir: UP   },  // Inky
  { col: 11, row: 10, home: { col: 11, row: 10 }, exitDelay: 9000, startDir: UP   },  // Clyde
];

function initGhosts() {
  ghosts = GHOST_COLORS.map((color, i) => {
    const s = GHOST_STARTS[i];
    return {
      col: s.col, row: s.row,
      px: cellX(s.col), py: cellY(s.row),
      color,
      name: GHOST_NAMES[i],
      dir: s.startDir,
      nextDir: NONE,
      home: { ...s.home },
      exitDelay: s.exitDelay,
      exited: i === 0,  // Blinky starts already outside
      frightened: false,
      eaten: false,
      flashOn: false,
      wobblePh: i * Math.PI / 2,
    };
  });
}

function initLevel() {
  initMaze();
  initPacman();
  initGhosts();
  frightenedMs = 0;
  frightenedOn = false;
  ghostCombo   = 0;
  scorePopups  = [];
  startReady(2200);
}

function startReady(ms) {
  isReady    = true;
  readyMs    = ms;
}

// ─── MOVEMENT CORE ────────────────────────────────────────────────────────────
// Returns true when px/py is close enough to grid cell center
function nearCenter(px, py, col, row, threshold) {
  threshold = threshold || 3;
  return Math.abs(px - cellX(col)) < threshold && Math.abs(py - cellY(row)) < threshold;
}

function snapCenter(ent) {
  ent.px = cellX(ent.col);
  ent.py = cellY(ent.row);
}

// Move entity by dt seconds at given speed (cells/sec), returns new px,py,col,row
function stepEntity(ent, dir, speed, dt, canEnterFn) {
  if (dir === NONE) return false;

  const dx = DX[dir];
  const dy = DY[dir];
  const pixels = speed * CELL * dt;

  let nx = ent.px + dx * pixels;
  let ny = ent.py + dy * pixels;

  // Compute which cell center we are approaching
  const nextCol = ent.col + dx;
  const nextRow = ent.row + dy;

  // Check if we're trying to cross into a new cell
  const crossedX = dx !== 0 && (dx > 0 ? nx >= cellX(nextCol) : nx <= cellX(nextCol));
  const crossedY = dy !== 0 && (dy > 0 ? ny >= cellY(nextRow) : ny <= cellY(nextRow));
  const crossed = crossedX || crossedY;

  if (crossed) {
    if (!canEnterFn(nextCol, nextRow)) {
      // Hit wall: snap to current cell center, stop
      snapCenter(ent);
      return false;
    }
    // Enter next cell
    ent.col = wrapCol(nextCol);
    ent.row = nextRow;
  }

  ent.px = nx;
  ent.py = ny;

  // Tunnel wrap pixel
  if (ent.px < -CELL / 2) ent.px += CANVAS_W;
  if (ent.px > CANVAS_W + CELL / 2) ent.px -= CANVAS_W;

  return true;
}

// ─── PACMAN UPDATE ────────────────────────────────────────────────────────────
function updatePacman(dt) {
  if (pacman.dead) return;

  // Mouth animation
  pacman.mouthT += dt * 7;

  const speed = pacman.speed + (level - 1) * 0.2;

  // Try to apply queued direction when near a cell center
  if (pacman.nextDir !== NONE && pacman.nextDir !== pacman.dir) {
    if (nearCenter(pacman.px, pacman.py, pacman.col, pacman.row, 4)) {
      const nc = pacman.col + DX[pacman.nextDir];
      const nr = pacman.row + DY[pacman.nextDir];
      if (canPacmanEnter(nc, nr)) {
        pacman.dir = pacman.nextDir;
        snapCenter(pacman); // snap cleanly before turning
      }
    }
  }

  // Move
  if (pacman.dir !== NONE) {
    const moved = stepEntity(pacman, pacman.dir, speed, dt, canPacmanEnter);
    if (!moved) {
      pacman.dir = NONE;
    }
  }

  // Eat cells
  const col = wrapCol(pacman.col);
  const row = pacman.row;
  if (row >= 0 && row < ROWS && nearCenter(pacman.px, pacman.py, col, row, CELL * 0.55)) {
    const v = maze[row][col];
    if (v === 0) {
      maze[row][col] = 2;
      score += SCORE_DOT;
      dotsEaten++;
      updateHUD();
    } else if (v === 3) {
      maze[row][col] = 2;
      score += SCORE_PELLET;
      dotsEaten++;
      activateFrightened();
      addPopup(pacman.px, pacman.py - 10, '+' + SCORE_PELLET);
      updateHUD();
    }
  }

  // Level clear?
  if (dotsEaten >= totalDots) {
    triggerLevelClear();
  }
}

// ─── GHOST UPDATE ─────────────────────────────────────────────────────────────
function ghostCanEnter(g) {
  return (col, row) => canGhostEnter(col, row, g.eaten);
}

function ghostTargetChase(g, idx) {
  switch (idx) {
    case 0: return { col: pacman.col, row: pacman.row }; // Blinky: direct
    case 1: { // Pinky: 4 ahead
      const pd1 = pacman.dir === NONE ? RIGHT : pacman.dir;
      return { col: pacman.col + DX[pd1] * 4, row: pacman.row + DY[pd1] * 4 };
    }
    case 2: { // Inky: reflect between blinky and 2 ahead of pacman
      const pd2 = pacman.dir === NONE ? RIGHT : pacman.dir;
      const ahead = { col: pacman.col + DX[pd2] * 2, row: pacman.row + DY[pd2] * 2 };
      const bk = ghosts[0];
      return { col: ahead.col * 2 - bk.col, row: ahead.row * 2 - bk.row };
    }
    case 3: { // Clyde: direct if far, else scatter
      if (dist2(g.col, g.row, pacman.col, pacman.row) > 64) {
        return { col: pacman.col, row: pacman.row };
      }
      return { col: 1, row: ROWS - 2 };
    }
  }
  return { col: pacman.col, row: pacman.row };
}

const SCATTER_TARGETS = [
  { col: COLS - 2, row: 1        },
  { col: 1,        row: 1        },
  { col: COLS - 2, row: ROWS - 2 },
  { col: 1,        row: ROWS - 2 },
];

// Returns best direction for ghost from cell center
function bestGhostDir(g, idx) {
  let target;
  if (g.eaten) {
    // Return to ghost house entrance
    target = { col: 10, row: 9 };
  } else if (g.frightened) {
    // Pick random valid direction (no reversing unless forced)
    const opts = ALL_DIRS.filter(d => {
      if (d === OPP[g.dir]) return false;
      const nc = g.col + DX[d];
      const nr = g.row + DY[d];
      return canGhostEnter(nc, nr, false);
    });
    if (opts.length === 0) return OPP[g.dir]; // forced reverse
    return opts[Math.floor(Math.random() * opts.length)];
  } else {
    // Alternate scatter / chase based on a timer approach (simplified: chase always)
    target = ghostTargetChase(g, idx);
  }

  // Pick direction that minimises manhattan distance to target (no reversing)
  let best = null, bestD = Infinity;
  for (const d of ALL_DIRS) {
    if (d === OPP[g.dir] && !g.eaten) continue;
    const nc = g.col + DX[d];
    const nr = g.row + DY[d];
    if (!canGhostEnter(nc, nr, g.eaten)) continue;
    const dd = dist2(nc, nr, target.col, target.row);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best || g.dir;
}

function updateGhost(g, idx, dt) {
  // Handle exit delay (bouncing in house)
  if (!g.exited) {
    g.exitDelay -= dt * 1000;
    g.wobblePh += dt * 3;
    g.py = cellY(g.home.row) + Math.sin(g.wobblePh) * 3;
    if (g.exitDelay <= 0) {
      g.exited = true;
      g.col = 10; g.row = 8;
      g.px = cellX(10); g.py = cellY(8);
      g.dir = Math.random() < 0.5 ? LEFT : RIGHT;
    }
    return;
  }

  // Eaten ghost that reached house entrance: revive
  if (g.eaten && g.col === 10 && g.row === 9) {
    g.eaten = false;
    g.frightened = false;
    g.flashOn = false;
    g.col = 10; g.row = 8;
    g.px = cellX(10); g.py = cellY(8);
    g.dir = LEFT;
    return;
  }

  const speed = g.eaten ? GHOST_SPEED_DEAD : g.frightened ? GHOST_SPEED_FRIT : GHOST_SPEED_NORM + (level - 1) * 0.15;

  // Decide new direction at cell center
  if (nearCenter(g.px, g.py, g.col, g.row, 3)) {
    const chosen = bestGhostDir(g, idx);
    if (chosen !== null) g.dir = chosen;
  }

  // Move
  const moved = stepEntity(g, g.dir, speed, dt, ghostCanEnter(g));
  if (!moved) {
    // Stuck: pick any valid direction
    for (const d of ALL_DIRS) {
      const nc = g.col + DX[d];
      const nr = g.row + DY[d];
      if (canGhostEnter(nc, nr, g.eaten)) {
        g.dir = d;
        break;
      }
    }
  }
}

// ─── FRIGHTENED ───────────────────────────────────────────────────────────────
function activateFrightened() {
  frightenedOn = true;
  frightenedMs = FRIGHTENED_MS;
  ghostCombo   = 0;
  ghosts.forEach(g => {
    if (g.exited && !g.eaten) {
      g.frightened = true;
      g.flashOn    = false;
      // Reverse
      if (g.dir !== NONE) g.dir = OPP[g.dir];
    }
  });
}

function updateFrightened(dt) {
  if (!frightenedOn) return;
  frightenedMs -= dt * 1000;
  const flashing = frightenedMs < FLASH_THRESHOLD;
  const flashOn  = flashing && (Math.floor(Date.now() / 180) % 2 === 0);

  ghosts.forEach(g => {
    if (g.frightened && !g.eaten) g.flashOn = flashOn;
  });

  if (frightenedMs <= 0) {
    frightenedOn = false;
    ghostCombo   = 0;
    ghosts.forEach(g => {
      g.frightened = false;
      g.flashOn    = false;
    });
  }
}

// ─── COLLISION ────────────────────────────────────────────────────────────────
function checkCollisions() {
  if (pacman.dead) return;
  ghosts.forEach(g => {
    if (!g.exited || g.eaten) return;
    const d2 = dist2(pacman.px, pacman.py, g.px, g.py);
    const hitR = (CELL * 0.78) ** 2;
    if (d2 > hitR) return;

    if (g.frightened) {
      // Eat ghost
      g.eaten      = true;
      g.frightened = false;
      g.flashOn    = false;
      const pts    = GHOST_SCORES[Math.min(ghostCombo, 3)];
      ghostCombo++;
      score += pts;
      if (score > highScore) { highScore = score; saveHS(); }
      addPopup(g.px, g.py - 10, '+' + pts);
      updateHUD();
    } else {
      // Pacman dies
      killPacman();
    }
  });
}

function killPacman() {
  if (pacman.dead) return;
  pacman.dead = true;
  pacman.dir  = NONE;
  lives--;
  if (score > highScore) { highScore = score; saveHS(); }
  updateHUD();
  gameState  = 'dead';
  phaseTimer = 2200;
}

// ─── LEVEL CLEAR ─────────────────────────────────────────────────────────────
function triggerLevelClear() {
  if (gameState === 'levelclear') return;
  gameState  = 'levelclear';
  phaseTimer = 2800;
  if (score > highScore) { highScore = score; saveHS(); }
}

// ─── SCORE POPUPS ─────────────────────────────────────────────────────────────
function addPopup(x, y, text) {
  scorePopups.push({ x, y, text, life: 900 });
}

function updatePopups(dt) {
  const ms = dt * 1000;
  scorePopups = scorePopups.filter(p => { p.life -= ms; return p.life > 0; });
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function updateHUD() {
  document.getElementById('scoreVal').textContent = score;
  document.getElementById('hiVal').textContent    = highScore;
  document.getElementById('levelVal').textContent = level;
  const ld = document.getElementById('livesDisplay');
  ld.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const ic = document.createElement('div');
    ic.className = 'life-icon' + (i >= lives ? ' lost' : '');
    ld.appendChild(ic);
  }
}

// ─── DRAWING ─────────────────────────────────────────────────────────────────
function drawMaze() {
  ctx.fillStyle = '#000014';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const now = Date.now();

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v  = maze[r][c];
      const tv = MAZE_TEMPLATE[r][c];
      const x  = c * CELL;
      const y  = r * CELL;
      const cx = x + CELL / 2;
      const cy = y + CELL / 2;

      if (tv === 1) {
        // Wall
        ctx.fillStyle = '#1A6EBD';
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        // Highlight edges
        ctx.fillStyle = '#2585D8';
        ctx.fillRect(x + 1, y + 1, CELL - 2, 2);
        ctx.fillRect(x + 1, y + 1, 2, CELL - 2);
        ctx.fillStyle = '#0F4A8A';
        ctx.fillRect(x + 1, y + CELL - 3, CELL - 2, 2);
        ctx.fillRect(x + CELL - 3, y + 1, 2, CELL - 2);
      } else if (v === 0) {
        ctx.fillStyle = '#E8B4B0';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (v === 3) {
        const pulse = 0.75 + 0.25 * Math.sin(now / 280);
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur  = 10 * pulse;
        ctx.fillStyle   = '#FFD700';
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (v === 4) {
        // Ghost house door
        ctx.fillStyle = '#E080E0';
        ctx.fillRect(x + 2, cy - 1.5, CELL - 4, 3);
      }
    }
  }
}

function drawPacman() {
  if (pacman.dead) return;

  const cx = pacman.px;
  const cy = pacman.py;
  const r  = CELL * 0.42;

  const mouthOpen = 0.14 + 0.18 * Math.abs(Math.sin(pacman.mouthT));

  // Face angle from direction
  const faceAngle = {
    [RIGHT]: 0,
    [LEFT]:  Math.PI,
    [UP]:    -Math.PI / 2,
    [DOWN]:  Math.PI / 2,
    [NONE]:  0,
  }[pacman.dir];

  const startAngle = faceAngle + mouthOpen * Math.PI;
  const endAngle   = faceAngle + (2 - mouthOpen) * Math.PI;

  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur  = 14;

  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;

  // Eye
  const eyeAngle = faceAngle - Math.PI * 0.32;
  const ex = cx + Math.cos(eyeAngle) * r * 0.52;
  const ey = cy + Math.sin(eyeAngle) * r * 0.52;
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(ex, ey, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

function drawGhost(g, idx) {
  if (!g.exited) {
    // Draw inside ghost house at wobble position
    drawGhostShape(g.px, g.py, g.color, false, false, false);
    return;
  }

  drawGhostShape(g.px, g.py, g.color, g.frightened && !g.eaten, g.flashOn, g.eaten);
}

function drawGhostShape(x, y, color, frightened, flash, eaten) {
  const r = CELL * 0.44;

  if (eaten) {
    drawGhostEyes(x, y, r);
    return;
  }

  const bodyColor = frightened ? (flash ? '#EEEEEE' : '#2828CC') : color;

  ctx.shadowColor = bodyColor;
  ctx.shadowBlur  = 8;
  ctx.fillStyle   = bodyColor;

  // Body path
  ctx.beginPath();
  ctx.arc(x, y - r * 0.05, r, Math.PI, 0, false); // top dome
  // Right side down
  const bY = y + r * 0.95;
  ctx.lineTo(x + r, bY);
  // Wavy bottom (3 waves)
  const segW = (r * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const x1 = x + r - segW * i;
    const x2 = x + r - segW * (i + 1);
    const ctrlY = i % 2 === 0 ? bY + r * 0.3 : bY - r * 0.1;
    ctx.quadraticCurveTo((x1 + x2) / 2, ctrlY, x2, bY);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  if (!frightened) {
    drawGhostEyes(x, y, r);
  } else {
    // Scared eyes (dots)
    ctx.fillStyle = flash ? '#FF4444' : '#AAAAFF';
    ctx.beginPath();
    ctx.arc(x - r * 0.32, y - r * 0.05, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.32, y - r * 0.05, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    // Scared wavy mouth
    ctx.strokeStyle = flash ? '#FF4444' : '#AAAAFF';
    ctx.lineWidth   = 1.8;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.42, y + r * 0.32);
    for (let i = 0; i <= 5; i++) {
      const tx = x - r * 0.42 + (r * 0.84) * i / 5;
      const ty = y + r * 0.32 + (i % 2 === 0 ? r * 0.12 : -r * 0.03);
      i === 0 ? ctx.moveTo(tx, ty) : ctx.lineTo(tx, ty);
    }
    ctx.stroke();
  }
}

function drawGhostEyes(x, y, r) {
  // White sclera
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.3, y - r * 0.08, r * 0.19, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + r * 0.3, y - r * 0.08, r * 0.19, r * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pupils
  ctx.fillStyle = '#0000CC';
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.08, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + r * 0.35, y - r * 0.08, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawPopups() {
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  scorePopups.forEach(p => {
    const alpha = p.life / 900;
    const yOff  = (1 - alpha) * 28;
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#FFD700';
    ctx.font        = 'bold 11px monospace';
    ctx.fillText(p.text, p.x, p.y - yOff);
  });
  ctx.globalAlpha  = 1;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawReadyText() {
  ctx.fillStyle    = '#FFFF00';
  ctx.font         = 'bold 15px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('준 비!', CANVAS_W / 2, CANVAS_H / 2 + 16);
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawLevelFlash() {
  if (gameState !== 'levelclear') return;
  const on = Math.floor(Date.now() / 220) % 2 === 0;
  ctx.fillStyle = on ? 'rgba(255,255,255,0.07)' : 'rgba(30,80,180,0.05)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawMaze();
  drawLevelFlash();
  ghosts.forEach((g, i) => drawGhost(g, i));
  drawPacman();
  drawPopups();
  if (isReady) drawReadyText();
}

// ─── GAME LOOP ────────────────────────────────────────────────────────────────
function gameLoop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  if (gameState === 'playing') {
    if (isReady) {
      readyMs -= dt * 1000;
      if (readyMs <= 0) isReady = false;
    } else {
      updatePacman(dt);
      ghosts.forEach((g, i) => updateGhost(g, i, dt));
      updateFrightened(dt);
      checkCollisions();
    }
    updatePopups(dt);
  } else if (gameState === 'dead') {
    phaseTimer -= dt * 1000;
    updatePopups(dt);
    if (phaseTimer <= 0) {
      if (lives <= 0) {
        showGameOver();
      } else {
        initPacman();
        initGhosts();
        gameState = 'playing';
        startReady(2000);
        updateHUD();
      }
    }
  } else if (gameState === 'levelclear') {
    phaseTimer -= dt * 1000;
    if (phaseTimer <= 0) {
      level++;
      initLevel();
      gameState = 'playing';
      updateHUD();
    }
  }

  draw();
  animFrame = requestAnimationFrame(gameLoop);
}

// ─── OVERLAYS ─────────────────────────────────────────────────────────────────
function showOnly(id) {
  document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
  if (id) document.getElementById(id).classList.remove('hidden');
}

function showStart() {
  gameState = 'start';
  cancelAnimationFrame(animFrame);
  initMaze(); initPacman(); initGhosts();
  document.getElementById('overlayStart').querySelector('.hs-val').textContent = highScore;
  showOnly('overlayStart');
  // draw static preview
  draw();
}

function showGameOver() {
  gameState = 'gameover';
  const el = document.getElementById('overlayGameover');
  el.querySelector('.final-score').textContent = score;
  el.querySelector('.final-hs').textContent    = highScore;
  showOnly('overlayGameover');
}

function startGame(fresh) {
  showOnly(null);
  if (fresh) { score = 0; lives = 3; level = 1; }
  initLevel();
  gameState  = 'playing';
  lastTime   = 0;
  cancelAnimationFrame(animFrame);
  animFrame  = requestAnimationFrame(gameLoop);
  updateHUD();
}

// ─── INPUT ────────────────────────────────────────────────────────────────────
function queueDir(d) {
  if (gameState !== 'playing' || isReady) return;
  pacman.nextDir = d;
}

function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (gameState === 'start' || gameState === 'gameover') {
      if (e.code === 'Enter' || e.code === 'Space') { startGame(true); e.preventDefault(); }
      return;
    }
    switch (e.code) {
      case 'ArrowUp':    case 'KeyW': queueDir(UP);    e.preventDefault(); break;
      case 'ArrowDown':  case 'KeyS': queueDir(DOWN);  e.preventDefault(); break;
      case 'ArrowLeft':  case 'KeyA': queueDir(LEFT);  e.preventDefault(); break;
      case 'ArrowRight': case 'KeyD': queueDir(RIGHT); e.preventDefault(); break;
    }
  });
}

function setupDpad() {
  document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
    const d = { up: UP, down: DOWN, left: LEFT, right: RIGHT }[btn.dataset.dir];
    const press = e => { e.preventDefault(); btn.classList.add('pressed'); queueDir(d); };
    const release = () => btn.classList.remove('pressed');
    btn.addEventListener('touchstart',  press,   { passive: false });
    btn.addEventListener('mousedown',   press);
    btn.addEventListener('touchend',    release);
    btn.addEventListener('mouseup',     release);
    btn.addEventListener('mouseleave',  release);
  });
}

function setupSwipe() {
  const el = document.getElementById('gameCanvas');
  el.addEventListener('touchstart', e => {
    const t = e.touches[0];
    swipeStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (!swipeStart) return;
    const t  = e.changedTouches[0];
    const dx = t.clientX - swipeStart.x;
    const dy = t.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) queueDir(dx > 0 ? RIGHT : LEFT);
    else                              queueDir(dy > 0 ? DOWN  : UP);
  }, { passive: true });
}

// ─── CANVAS RESIZE ─────────────────────────────────────────────────────────────
function resizeCanvas() {
  const wrapper = document.querySelector('.canvas-wrapper');
  const scale   = Math.min(wrapper.clientWidth / CANVAS_W, wrapper.clientHeight / CANVAS_H, 1.8);
  const w = Math.floor(CANVAS_W * scale);
  const h = Math.floor(CANVAS_H * scale);
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
function boot() {
  canvas = document.getElementById('gameCanvas');
  ctx    = canvas.getContext('2d');
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;

  highScore = loadHS();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  setupKeyboard();
  setupDpad();
  setupSwipe();

  document.getElementById('btnStart').addEventListener('click',   () => startGame(true));
  document.getElementById('btnReplay').addEventListener('click',  () => startGame(true));
  document.getElementById('btnRestart').addEventListener('click', () => startGame(true));

  showStart();
  updateHUD();
}

document.addEventListener('DOMContentLoaded', boot);
