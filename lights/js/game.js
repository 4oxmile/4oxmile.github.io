'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const SIZE = 5;
const TOTAL = SIZE * SIZE;
const MAX_HINTS = 3;
const STORAGE_KEY = 'lights_out_v1';

// Level configuration: number of random scramble moves per level
function scrambleMoves(level) {
  // Level 1: 3 moves, Level 2: 5, Level 3: 7, ...
  // Cap at 20 to avoid very long solve chains that loop back
  return Math.min(3 + (level - 1) * 2, 20);
}

// ─── State ───────────────────────────────────────────────────────────────────
let grid = [];          // Uint8Array, 25 cells (0=off, 1=on)
let solutionGrid = [];  // Tracks the scramble moves (used for hints)
let moves = 0;
let level = 1;
let hintsLeft = MAX_HINTS;
let hintCell = -1;      // index of highlighted hint cell (-1 = none)
let gameActive = false;

// Persistent storage
function loadStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// ─── DOM References ───────────────────────────────────────────────────────────
const startOverlay   = document.getElementById('start-overlay');
const victoryOverlay = document.getElementById('victory-overlay');
const gameScreen     = document.getElementById('game-screen');
const boardEl        = document.getElementById('board');
const movesEl        = document.getElementById('hud-moves');
const levelEl        = document.getElementById('hud-level');
const hintCountEl    = document.getElementById('hint-count');
const hintBtn        = document.getElementById('btn-hint');
const statsMaxLevel  = document.getElementById('stats-max-level');
const statsGamesPlayed = document.getElementById('stats-games-played');

// Victory elements
const vcMoves        = document.getElementById('vc-moves');
const vcLevel        = document.getElementById('vc-level');
const vcBest         = document.getElementById('vc-best');
const vcRecord       = document.getElementById('vc-record');
const vcRecordBadge  = document.getElementById('vc-record-badge');

// ─── Grid Helpers ─────────────────────────────────────────────────────────────
function makeGrid() { return new Uint8Array(TOTAL); }

function toggle(g, idx) {
  const r = Math.floor(idx / SIZE);
  const c = idx % SIZE;
  const affected = [idx];
  if (r > 0)        affected.push(idx - SIZE);
  if (r < SIZE - 1) affected.push(idx + SIZE);
  if (c > 0)        affected.push(idx - 1);
  if (c < SIZE - 1) affected.push(idx + 1);
  for (const i of affected) g[i] ^= 1;
}

function isAllOff(g) {
  for (let i = 0; i < TOTAL; i++) if (g[i]) return false;
  return true;
}

// ─── Puzzle Generation ────────────────────────────────────────────────────────
// Start from all-off, apply N random toggles, record moves for hint solver
function generatePuzzle(level) {
  const n = scrambleMoves(level);
  const g = makeGrid(); // all off
  const movesApplied = [];

  // Choose n distinct random cells (or repeat with care to keep it solvable)
  // We track which cells were toggled an odd number of times (those are the "solution")
  const toggleCount = new Uint8Array(TOTAL);

  for (let i = 0; i < n; i++) {
    let idx;
    // Ensure we don't trivially cancel previous move immediately
    do {
      idx = Math.floor(Math.random() * TOTAL);
    } while (i > 0 && movesApplied[movesApplied.length - 1] === idx && n > 1);

    toggle(g, idx);
    toggleCount[idx]++;
    movesApplied.push(idx);
  }

  // Solution: cells toggled an odd number of times (pressing them undoes the scramble)
  const solution = [];
  for (let i = 0; i < TOTAL; i++) {
    if (toggleCount[i] % 2 === 1) solution.push(i);
  }

  return { grid: g, solution };
}

// ─── Hint System ──────────────────────────────────────────────────────────────
// Find one cell from the solution set that is still needed.
// We use a Gaussian elimination over GF(2) to find the real solution from current state.
function solveCurrent(g) {
  // Build the 25x25 toggle matrix + current state as augmented column
  // Each row i: pressing cell i affects cells in its toggle neighborhood
  const n = TOTAL;
  // matrix: n rows, n+1 cols (last col = RHS)
  const mat = [];
  for (let i = 0; i < n; i++) {
    const row = new Uint8Array(n + 1);
    // which cells does pressing i affect?
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    row[i] = 1;
    if (r > 0)        row[i - SIZE] = 1;
    if (r < SIZE - 1) row[i + SIZE] = 1;
    if (c > 0)        row[i - 1] = 1;
    if (c < SIZE - 1) row[i + 1] = 1;
    // RHS = current cell state (we want to make all 0)
    row[n] = g[i];
    mat.push(row);
  }

  // Gaussian elimination over GF(2)
  const pivotCol = new Int32Array(n).fill(-1);
  let col = 0;
  for (let row = 0; row < n && col < n; col++) {
    // Find pivot
    let pivotRow = -1;
    for (let r = row; r < n; r++) {
      if (mat[r][col]) { pivotRow = r; break; }
    }
    if (pivotRow === -1) continue;
    // Swap
    [mat[row], mat[pivotRow]] = [mat[pivotRow], mat[row]];
    pivotCol[row] = col;
    // Eliminate
    for (let r = 0; r < n; r++) {
      if (r !== row && mat[r][col]) {
        for (let c2 = col; c2 <= n; c2++) {
          mat[r][c2] ^= mat[row][c2];
        }
      }
    }
    row++;
  }

  // Back-substitution: free variables = 0
  const sol = new Uint8Array(n);
  for (let row = 0; row < n; row++) {
    if (pivotCol[row] !== -1) {
      sol[pivotCol[row]] = mat[row][n];
    }
  }

  return sol; // sol[i] = 1 means press cell i
}

function getHintCell() {
  const sol = solveCurrent(grid);
  for (let i = 0; i < TOTAL; i++) {
    if (sol[i]) return i;
  }
  return -1; // already solved
}

// ─── Rendering ────────────────────────────────────────────────────────────────
function renderBoard() {
  const cells = boardEl.querySelectorAll('.cell');
  for (let i = 0; i < TOTAL; i++) {
    const cell = cells[i];
    cell.classList.toggle('on', grid[i] === 1);
    cell.classList.toggle('hint', i === hintCell);
  }
}

function renderHUD() {
  movesEl.textContent = moves;
  levelEl.textContent = level;
  hintCountEl.textContent = hintsLeft;
  hintBtn.classList.toggle('no-hints', hintsLeft === 0);
}

function renderStats() {
  const store = loadStorage();
  statsMaxLevel.textContent  = store.maxLevel  || 1;
  statsGamesPlayed.textContent = store.gamesPlayed || 0;
}

// ─── Cell Press ──────────────────────────────────────────────────────────────
function pressCell(idx) {
  if (!gameActive) return;

  // Clear hint highlight
  if (hintCell !== -1) {
    hintCell = -1;
  }

  toggle(grid, idx);
  moves++;
  renderBoard();
  renderHUD();

  if (isAllOff(grid)) {
    setTimeout(handleVictory, 280);
  }
}

// ─── Victory ─────────────────────────────────────────────────────────────────
function handleVictory() {
  gameActive = false;
  if(typeof Leaderboard!=='undefined')Leaderboard.ready('lights',moves,{ascending:true,label:'이동'});
  const store = loadStorage();

  // Update stats
  store.gamesPlayed = (store.gamesPlayed || 0) + 1;
  store.maxLevel    = Math.max(store.maxLevel || 1, level);

  // Best moves per level
  if (!store.bestMoves) store.bestMoves = {};
  const levelKey = 'L' + level;
  const prevBest = store.bestMoves[levelKey];
  const isRecord = prevBest === undefined || moves < prevBest;
  if (isRecord) store.bestMoves[levelKey] = moves;

  saveStorage(store);

  // Populate victory overlay
  vcMoves.textContent = moves;
  vcLevel.textContent = level;
  vcBest.textContent  = isRecord ? moves : prevBest;
  vcBest.classList.toggle('record', isRecord);
  vcRecordBadge.classList.toggle('hidden', !isRecord);
  vcRecord.classList.toggle('hidden', !isRecord);

  victoryOverlay.classList.remove('hidden');
}

// ─── New Game / Next Level ────────────────────────────────────────────────────
function startGame(lv) {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  level = lv;
  moves = 0;
  hintsLeft = MAX_HINTS;
  hintCell = -1;
  gameActive = true;

  const { grid: g } = generatePuzzle(level);
  grid = g;

  renderBoard();
  renderHUD();

  startOverlay.classList.add('hidden');
  victoryOverlay.classList.add('hidden');
}

function newGame() {
  level = 1;
  startGame(level);
}

function nextLevel() {
  startGame(level + 1);
}

// ─── Hint Button ──────────────────────────────────────────────────────────────
function useHint() {
  if (!gameActive || hintsLeft === 0) return;

  // If already showing a hint, dismiss it without spending another
  if (hintCell !== -1) {
    hintCell = -1;
    renderBoard();
    return;
  }

  hintsLeft--;
  hintCell = getHintCell();
  renderBoard();
  renderHUD();

  // Auto-dismiss hint after 3 seconds
  const thisHint = hintCell;
  setTimeout(() => {
    if (hintCell === thisHint) {
      hintCell = -1;
      renderBoard();
    }
  }, 3000);
}

// ─── Board DOM Setup ──────────────────────────────────────────────────────────
function buildBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < TOTAL; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.idx = i;
    cell.addEventListener('click', () => pressCell(i));
    boardEl.appendChild(cell);
  }
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', newGame);
document.getElementById('btn-next').addEventListener('click', nextLevel);
document.getElementById('btn-again').addEventListener('click', newGame);
document.getElementById('btn-menu').addEventListener('click', () => {
  gameActive = false;
  hintCell = -1;
  victoryOverlay.classList.add('hidden');
  startOverlay.classList.remove('hidden');
  renderStats();
});
hintBtn.addEventListener('click', useHint);

// Prevent double-tap zoom on mobile
document.addEventListener('touchend', e => e.preventDefault(), { passive: false });

// ─── Init ─────────────────────────────────────────────────────────────────────
buildBoard();
renderStats();
// Show start overlay on load
startOverlay.classList.remove('hidden');
victoryOverlay.classList.add('hidden');
