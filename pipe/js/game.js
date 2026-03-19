'use strict';

/* ============================================================
   Pipe Puzzle – game.js
   ============================================================ */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTIES = {
  easy:   { size: 5, label: 'easy' },
  medium: { size: 7, label: 'medium' },
  hard:   { size: 9, label: 'hard' },
};

// Pipe type ids
const PIPE = {
  STRAIGHT: 'straight', // ─
  CORNER:   'corner',   // └
  T:        'T',        // ┤
  CROSS:    'cross',    // ┼
};

/**
 * For each pipe type, define which edges (T, R, B, L) are open at rotation 0.
 * Bit order: [ top, right, bottom, left ]  (index 0-3)
 */
const PIPE_OPENINGS = {
  [PIPE.STRAIGHT]: [false, true,  false, true ],  // horizontal
  [PIPE.CORNER]:   [false, true,  true,  false],  // └ (opens right+bottom)
  [PIPE.T]:        [false, true,  true,  true ],  // opens right+bottom+left
  [PIPE.CROSS]:    [true,  true,  true,  true ],  // all four
};

// Direction vectors: [dRow, dCol] for [top, right, bottom, left]
const DIR = [[-1, 0], [0, 1], [1, 0], [0, -1]];

// Opposite of direction index
const OPP = [2, 3, 0, 1];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentDifficulty = 'easy';
let grid = [];          // 2D array of cell objects
let gridSize = 5;
let timerInterval = null;
let seconds = 0;
let moves = 0;
let solved = false;
let animationQueue = null;  // setTimeout id for water animation

// ---------------------------------------------------------------------------
// Cell object factory
// ---------------------------------------------------------------------------

function makeCell(type, rotation) {
  return {
    type,
    rotation,   // 0–3 (×90°)
    el: null,   // DOM element
    isSource: false,
    isDrain:  false,
  };
}

/** Return the openings array for a cell considering its rotation. */
function cellOpenings(cell) {
  const base = PIPE_OPENINGS[cell.type];
  const r    = cell.rotation % 4;
  if (r === 0) return base;
  // Rotate the array by r positions (clockwise = shift left by r)
  return base.map((_, i) => base[(i - r + 4) % 4]);
}

/** Does this cell have an opening in direction d? */
function hasOpening(cell, d) {
  return cellOpenings(cell)[d];
}

// ---------------------------------------------------------------------------
// Puzzle generation
// ---------------------------------------------------------------------------

function generatePuzzle(size) {
  const cells = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => makeCell(PIPE.STRAIGHT, 0))
  );

  // 1. Pick source row on left edge, drain row on right edge.
  const srcRow   = Math.floor(Math.random() * size);
  const drainRow = Math.floor(Math.random() * size);

  // 2. Carve a random path from (srcRow, 0) → (drainRow, size-1).
  const path = carvePath(size, srcRow, drainRow);

  // 3. Assign pipe types to path cells based on their connections.
  assignPipeTypes(cells, size, path);

  // 4. Fill non-path cells with random valid pipes.
  fillNonPath(cells, size, path);

  // 5. Mark source / drain.
  cells[srcRow][0].isSource = true;
  cells[drainRow][size - 1].isDrain = true;

  // 6. Randomly rotate every cell (creates the puzzle).
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      // Keep source/drain with a correct alignment for aesthetics –
      // they always open toward their edge direction.
      // We still scramble them; the solver handles it correctly.
      cells[r][c].rotation = Math.floor(Math.random() * 4);
    }
  }

  return { cells, srcRow, drainRow };
}

/** Carve a simple random path using right/up/down moves only. */
function carvePath(size, srcRow, drainRow) {
  const visited = new Set();
  const path    = [];
  let r = srcRow, c = 0;

  const key = (row, col) => row * size + col;
  visited.add(key(r, c));
  path.push([r, c]);

  while (c < size - 1) {
    // Possible moves: right, up, down  (never left to avoid loops)
    const moves = [];
    // Right
    if (c + 1 < size && !visited.has(key(r, c + 1))) moves.push([0, 1]);
    // Up
    if (r - 1 >= 0 && !visited.has(key(r - 1, c))) moves.push([-1, 0]);
    // Down
    if (r + 1 < size && !visited.has(key(r + 1, c))) moves.push([1, 0]);

    if (moves.length === 0) {
      // Backtrack one step
      path.pop();
      const prev = path[path.length - 1];
      r = prev[0]; c = prev[1];
      continue;
    }

    const [dr, dc] = moves[Math.floor(Math.random() * moves.length)];
    r += dr; c += dc;
    visited.add(key(r, c));
    path.push([r, c]);
  }

  return path;
}

/**
 * Given a path (list of [row, col]), determine the pipe type and correct
 * rotation for each path cell.
 */
function assignPipeTypes(cells, size, path) {
  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];
    const cell   = cells[r][c];

    // Find which directions this cell connects to within the path
    const connects = [false, false, false, false]; // T R B L
    if (i > 0) {
      const [pr, pc] = path[i - 1];
      const d = dirBetween(pr, pc, r, c);
      if (d !== -1) connects[OPP[d]] = true; // opening toward previous
    }
    if (i < path.length - 1) {
      const [nr, nc] = path[i + 1];
      const d = dirBetween(r, c, nr, nc);
      if (d !== -1) connects[d] = true; // opening toward next
    }

    // Source: also open left (edge connector)
    if (c === 0 && i === 0) connects[3] = true;
    // Drain: also open right (edge connector)
    if (c === size - 1 && i === path.length - 1) connects[1] = true;

    const count = connects.filter(Boolean).length;
    let type, rotation;

    if (count >= 4) {
      type = PIPE.CROSS; rotation = 0;
    } else if (count === 3) {
      type = PIPE.T;
      // Find the missing direction
      const missing = connects.findIndex(v => !v);
      // T at rotation 0 = opens right+bottom+left (missing top=0)
      rotation = (missing - 0 + 4) % 4;
    } else if (count === 2) {
      const openDirs = connects.map((v, i) => v ? i : -1).filter(v => v !== -1);
      const [d0, d1] = openDirs;
      // Are they opposite?
      if (OPP[d0] === d1) {
        // Straight pipe
        type = PIPE.STRAIGHT;
        // rotation 0 = horizontal (opens right+left)
        rotation = (d0 === 0 || d0 === 2) ? 1 : 0; // vertical = rotation 1
      } else {
        // Corner pipe
        type = PIPE.CORNER;
        // rotation 0 = opens right+bottom (d0=1, d1=2)
        // We need to find which rotation maps {right,bottom} onto {d0,d1}
        rotation = cornerRotation(d0, d1);
      }
    } else {
      // 1-opening dead end – use straight, open toward the one connection
      type = PIPE.STRAIGHT;
      const od = connects.findIndex(v => v);
      rotation = (od === 0 || od === 2) ? 1 : 0;
    }

    cell.type     = type;
    cell.rotation = rotation;
  }
}

function dirBetween(r1, c1, r2, c2) {
  const dr = r2 - r1, dc = c2 - c1;
  if (dr === -1 && dc === 0) return 0; // top
  if (dr === 0  && dc === 1) return 1; // right
  if (dr === 1  && dc === 0) return 2; // bottom
  if (dr === 0  && dc === -1) return 3; // left
  return -1;
}

/** Return rotation index for a corner cell that opens to directions d0 and d1. */
function cornerRotation(d0, d1) {
  const pair = new Set([d0, d1]);
  // rotation 0: opens right(1) + bottom(2)
  if (pair.has(1) && pair.has(2)) return 0;
  // rotation 1: opens bottom(2) + left(3)
  if (pair.has(2) && pair.has(3)) return 1;
  // rotation 2: opens left(3) + top(0)
  if (pair.has(3) && pair.has(0)) return 2;
  // rotation 3: opens top(0) + right(1)
  if (pair.has(0) && pair.has(1)) return 3;
  return 0;
}

/** Fill all non-path cells with random pipes. */
function fillNonPath(cells, size, path) {
  const pathSet = new Set(path.map(([r, c]) => r * size + c));
  const types   = [PIPE.STRAIGHT, PIPE.CORNER, PIPE.T];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (pathSet.has(r * size + c)) continue;
      cells[r][c].type     = types[Math.floor(Math.random() * types.length)];
      cells[r][c].rotation = Math.floor(Math.random() * 4);
    }
  }
}

// ---------------------------------------------------------------------------
// Water-flow BFS
// ---------------------------------------------------------------------------

/**
 * Check if water can flow from source to drain.
 * Returns array of [r,c] coordinates that are on the connected water path,
 * or null if not connected.
 */
function findWaterPath(cells, size, srcRow, drainRow) {
  // BFS from source
  const visited = Array.from({ length: size }, () => new Array(size).fill(false));
  const queue   = [[srcRow, 0]];
  const parent  = {}; // key -> key of parent
  visited[srcRow][0] = true;

  const key = (r, c) => r * size + c;

  while (queue.length) {
    const [r, c] = queue.shift();

    for (let d = 0; d < 4; d++) {
      if (!hasOpening(cells[r][c], d)) continue;

      const nr = r + DIR[d][0];
      const nc = c + DIR[d][1];

      // Boundary: source exits left, drain exits right
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) {
        // Allow source to "enter" from outside-left
        if (d === 3 && c === 0) continue; // opening to left edge is ok for source
        continue;
      }

      // Neighbour must have a reciprocal opening
      if (!hasOpening(cells[nr][nc], OPP[d])) continue;
      if (visited[nr][nc]) continue;

      visited[nr][nc] = true;
      parent[key(nr, nc)] = key(r, c);
      queue.push([nr, nc]);

      // Reached drain column — check drain opens right to exit
      if (nc === size - 1 && nr === drainRow && hasOpening(cells[nr][nc], 1)) {
        // Reconstruct path from drain back to source
        const path = [];
        let cur = key(nr, nc);
        while (cur !== undefined) {
          const cr = Math.floor(cur / size);
          const cc = cur % size;
          path.unshift([cr, cc]);
          cur = parent[cur];
        }
        return path;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function buildTileDOM(cell) {
  const el = document.createElement('div');
  el.className = 'tile';
  if (cell.isSource) el.classList.add('source');
  if (cell.isDrain)  el.classList.add('drain');
  renderTileContents(el, cell);
  return el;
}

/**
 * Render pipe graphics inside the tile element.
 * Uses CSS arms (div.pipe-arm.arm-*) based on openings.
 */
function renderTileContents(el, cell) {
  el.innerHTML = '';
  const arms = cellOpenings(cell);
  const names = ['arm-top', 'arm-right', 'arm-bottom', 'arm-left'];

  let hasAny = false;
  arms.forEach((open, i) => {
    if (!open) return;
    hasAny = true;
    const arm = document.createElement('div');
    arm.className = `pipe-arm ${names[i]}`;
    el.appendChild(arm);
  });

  if (hasAny) {
    const center = document.createElement('div');
    center.className = 'pipe-center';
    el.appendChild(center);
  }
}

// ---------------------------------------------------------------------------
// Grid rendering
// ---------------------------------------------------------------------------

function renderGrid() {
  const gridEl = document.getElementById('grid');
  gridEl.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
  gridEl.style.gridTemplateRows    = `repeat(${gridSize}, 1fr)`;
  gridEl.innerHTML = '';

  // Compute tile size to fit viewport
  const wrapper   = document.getElementById('grid-wrapper');
  const wrapW     = wrapper.clientWidth  - 32;
  const wrapH     = wrapper.clientHeight - 16;
  const maxTile   = Math.min(wrapW, wrapH) / gridSize;
  const tileSize  = Math.max(Math.min(maxTile, 80), 32);

  gridEl.style.width  = `${tileSize * gridSize + 3 * (gridSize - 1)}px`;
  gridEl.style.height = `${tileSize * gridSize + 3 * (gridSize - 1)}px`;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const cell = grid[r][c];
      const el   = buildTileDOM(cell);
      el.style.width  = `${tileSize}px`;
      el.style.height = `${tileSize}px`;

      el.addEventListener('click', () => onTileClick(r, c));
      el.addEventListener('touchend', (e) => { e.preventDefault(); onTileClick(r, c); });

      cell.el = el;
      gridEl.appendChild(el);
    }
  }
}

// ---------------------------------------------------------------------------
// Tile interaction
// ---------------------------------------------------------------------------

function onTileClick(r, c) {
  if (solved) return;

  const cell = grid[r][c];
  cell.rotation = (cell.rotation + 1) % 4;
  moves++;
  document.getElementById('move-counter').textContent = moves;

  // Update visual
  renderTileContents(cell.el, cell);

  // Brief flash animation
  cell.el.classList.remove('rotating');
  void cell.el.offsetWidth; // reflow
  cell.el.classList.add('rotating');
  setTimeout(() => cell.el.classList.remove('rotating'), 200);

  // Check solution
  checkSolution();
}

// ---------------------------------------------------------------------------
// Solution checking & water animation
// ---------------------------------------------------------------------------

function checkSolution() {
  // Find source and drain rows
  let srcRow = -1, drainRow = -1;
  for (let r = 0; r < gridSize; r++) {
    if (grid[r][0].isSource)             srcRow   = r;
    if (grid[r][gridSize - 1].isDrain)   drainRow = r;
  }

  const path = findWaterPath(grid, gridSize, srcRow, drainRow);
  if (!path) {
    clearWater();
    return;
  }

  // Solved!
  solved = true;
  stopTimer();
  animateWater(path, srcRow, drainRow);
}

function clearWater() {
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      grid[r][c].el && grid[r][c].el.classList.remove('water');
    }
  }
}

function animateWater(path, srcRow, drainRow) {
  clearWater();
  let idx = 0;

  function step() {
    if (idx >= path.length) {
      // Show victory after brief pause
      setTimeout(showVictory, 400);
      return;
    }
    const [r, c] = path[idx];
    grid[r][c].el.classList.add('water');
    idx++;
    animationQueue = setTimeout(step, 80);
  }

  step();
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

function startTimer() {
  seconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    seconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function updateTimerDisplay() {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  document.getElementById('timer').textContent =
    `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Best record
// ---------------------------------------------------------------------------

function storageKey(diff) {
  return `pipe_best_${diff}`;
}

function getBest(diff) {
  const v = localStorage.getItem(storageKey(diff));
  return v !== null ? parseInt(v, 10) : null;
}

function saveBest(diff, s) {
  const prev = getBest(diff);
  if (prev === null || s < prev) {
    localStorage.setItem(storageKey(diff), String(s));
    return true; // new record
  }
  return false;
}

function loadBestDisplay() {
  ['easy', 'medium', 'hard'].forEach(diff => {
    const v = getBest(diff);
    const el = document.getElementById(`best-${diff}`);
    el.textContent = v !== null ? formatTime(v) : '--:--';
  });
}

// ---------------------------------------------------------------------------
// Victory
// ---------------------------------------------------------------------------

function showVictory() {
  document.getElementById('result-time').textContent  = formatTime(seconds);
  document.getElementById('result-moves').textContent = moves;

  const isNew = saveBest(currentDifficulty, seconds);
  document.getElementById('new-record').classList.toggle('hidden', !isNew);

  document.getElementById('victory-overlay').classList.remove('hidden');

  // Leaderboard integration
  if (typeof Leaderboard !== 'undefined') {
    Leaderboard.ready(
      `pipe_${currentDifficulty}`,
      seconds,
      { ascending: true, format: 'time', label: '시간' }
    );
  }
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

function startGame() {
  // Hide leaderboard if present
  if (typeof Leaderboard !== 'undefined') Leaderboard.hide();

  const diff     = DIFFICULTIES[currentDifficulty];
  gridSize       = diff.size;
  solved         = false;
  moves          = 0;

  // Clear previous animation
  if (animationQueue) { clearTimeout(animationQueue); animationQueue = null; }

  stopTimer();

  // Generate puzzle
  const { cells, srcRow, drainRow } = generatePuzzle(gridSize);
  grid = cells;

  // Reset counters display
  document.getElementById('move-counter').textContent = '0';

  // Switch screens
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('victory-overlay').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');

  renderGrid();
  startTimer();
}

function returnToMenu() {
  stopTimer();
  if (animationQueue) { clearTimeout(animationQueue); animationQueue = null; }

  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('victory-overlay').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  loadBestDisplay();
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

function init() {
  // Difficulty buttons
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDifficulty = btn.dataset.difficulty;
    });
  });

  document.getElementById('btn-start').addEventListener('click', startGame);

  document.getElementById('btn-new').addEventListener('click', () => {
    if (animationQueue) { clearTimeout(animationQueue); animationQueue = null; }
    startGame();
  });

  document.getElementById('btn-menu').addEventListener('click', returnToMenu);

  document.getElementById('btn-play-again').addEventListener('click', startGame);

  document.getElementById('btn-back-menu').addEventListener('click', returnToMenu);

  // Handle resize: re-render grid while preserving state
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const gameScreen = document.getElementById('game-screen');
      if (!gameScreen.classList.contains('hidden') && grid.length) {
        renderGrid();
        // Re-apply water highlight if already solved
        if (solved) {
          let srcRow = -1, drainRow = -1;
          for (let r = 0; r < gridSize; r++) {
            if (grid[r][0].isSource)           srcRow   = r;
            if (grid[r][gridSize - 1].isDrain) drainRow = r;
          }
          const waterPath = findWaterPath(grid, gridSize, srcRow, drainRow);
          if (waterPath) {
            waterPath.forEach(([r, c]) => grid[r][c].el.classList.add('water'));
          }
        }
      }
    }, 150);
  });

  loadBestDisplay();
}

document.addEventListener('DOMContentLoaded', init);
