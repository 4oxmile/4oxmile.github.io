'use strict';

/* ===========================
   Constants
   =========================== */
const GRID_SIZE = 4;
const STORAGE_KEY = '2048_best_score';

/* ===========================
   State
   =========================== */
let grid = [];        // 4x4 array of values (0 = empty)
let score = 0;
let bestScore = 0;
let gameActive = false;
let tileIdCounter = 0;

// Tile DOM tracking: { id, value, row, col, el }
let tiles = [];

/* ===========================
   DOM References
   =========================== */
const startScreen    = document.getElementById('start-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const startBtn       = document.getElementById('start-btn');
const restartBtn     = document.getElementById('restart-btn');
const newGameBtn     = document.getElementById('new-game-btn');
const scoreEl        = document.getElementById('score');
const bestScoreEl    = document.getElementById('best-score');
const finalScoreEl   = document.getElementById('final-score');
const finalBestEl    = document.getElementById('final-best');
const newRecordBadge = document.getElementById('new-record-badge');
const tileContainer  = document.getElementById('tile-container');

/* ===========================
   Helpers
   =========================== */
function cellPixel(index) {
  // Compute pixel position (top/left) for a given row/col index
  // Must mirror CSS: padding 12px, gap 10px, cell size = (boardInner - gap*3) / 4
  const boardEl  = document.getElementById('board');
  const inner    = boardEl.clientWidth - 24; // padding 12 each side
  const gap      = 10;
  const cellSize = (inner - gap * (GRID_SIZE - 1)) / GRID_SIZE;
  return index * (cellSize + gap);
}

function tileSize() {
  const boardEl  = document.getElementById('board');
  const inner    = boardEl.clientWidth - 24;
  const gap      = 10;
  return (inner - gap * (GRID_SIZE - 1)) / GRID_SIZE;
}

function createGrid() {
  grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function emptyPositions() {
  const positions = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 0) positions.push({ r, c });
    }
  }
  return positions;
}

function spawnTile(animate = true) {
  const empty = emptyPositions();
  if (empty.length === 0) return;
  const pos   = empty[Math.floor(Math.random() * empty.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  grid[pos.r][pos.c] = value;
  addTileDOM(pos.r, pos.c, value, animate ? 'tile-new' : '');
}

/* ===========================
   DOM Tile Management
   =========================== */
function addTileDOM(row, col, value, animClass = '') {
  const id   = tileIdCounter++;
  const el   = document.createElement('div');
  el.className = 'tile' + (animClass ? ' ' + animClass : '');
  el.dataset.value = value;

  const size = tileSize();
  const px   = cellPixel(col);
  const py   = cellPixel(row);

  el.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    left: ${px}px;
    top: ${py}px;
    font-size: ${tileFontSize(value, size)}px;
  `;
  el.textContent = value;

  // Remove animation class after it fires so it can be re-added on merge
  if (animClass) {
    el.addEventListener('animationend', () => el.classList.remove(animClass), { once: true });
  }

  tileContainer.appendChild(el);
  tiles.push({ id, value, row, col, el });
  return id;
}

function tileFontSize(value, size) {
  const len = String(value).length;
  if (len <= 2) return Math.round(size * 0.44);
  if (len === 3) return Math.round(size * 0.36);
  if (len === 4) return Math.round(size * 0.28);
  return Math.round(size * 0.22);
}

function moveTileDOM(tileObj, newRow, newCol) {
  tileObj.row = newRow;
  tileObj.col = newCol;
  tileObj.el.style.left = cellPixel(newCol) + 'px';
  tileObj.el.style.top  = cellPixel(newRow) + 'px';
}

function removeTileDOM(tileObj) {
  tileObj.el.remove();
  tiles = tiles.filter(t => t !== tileObj);
}

function upgradeTileDOM(tileObj, newValue) {
  tileObj.value = newValue;
  tileObj.el.dataset.value = newValue;
  tileObj.el.textContent   = newValue;

  const size = tileSize();
  tileObj.el.style.fontSize = tileFontSize(newValue, size) + 'px';

  // Merge animation
  tileObj.el.classList.remove('tile-merge');
  // Force reflow to restart animation
  void tileObj.el.offsetWidth;
  tileObj.el.classList.add('tile-merge');
  tileObj.el.addEventListener('animationend', () => tileObj.el.classList.remove('tile-merge'), { once: true });
}

function clearAllTiles() {
  tiles.forEach(t => t.el.remove());
  tiles = [];
}

/* ===========================
   Score
   =========================== */
function updateScore(delta) {
  score += delta;
  scoreEl.textContent = score;
  scoreEl.classList.remove('score-pop');
  void scoreEl.offsetWidth;
  scoreEl.classList.add('score-pop');

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(STORAGE_KEY, bestScore);
    bestScoreEl.textContent = bestScore;
  }
}

/* ===========================
   Game Logic: Move
   =========================== */

// Slide and merge one row/column line (left-to-right logic)
// Returns { line: new array, gained: score delta, merged: boolean[] }
function slideLine(line) {
  const filtered = line.filter(v => v !== 0);
  const merged   = Array(GRID_SIZE).fill(false);
  let gained     = 0;
  const result   = [];

  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1] && !merged[i]) {
      const newVal = filtered[i] * 2;
      result.push(newVal);
      gained += newVal;
      merged[result.length - 1] = true;
      i++; // skip next
    } else {
      result.push(filtered[i]);
    }
  }

  while (result.length < GRID_SIZE) result.push(0);
  return { line: result, gained };
}

// Extract a row from grid
function getRow(r) {
  return grid[r].slice();
}

// Extract a column from grid
function getCol(c) {
  return grid.map(row => row[c]);
}

// Set a row in grid
function setRow(r, line) {
  for (let c = 0; c < GRID_SIZE; c++) grid[r][c] = line[c];
}

// Set a column in grid
function setCol(c, line) {
  for (let r = 0; r < GRID_SIZE; r++) grid[r][c] = line[r];
}

// Move direction: 'left' | 'right' | 'up' | 'down'
function move(direction) {
  if (!gameActive) return;

  let moved  = false;
  let gained = 0;

  // Snapshot tile positions by grid cell for matching
  const snapshot = {};
  tiles.forEach(t => {
    snapshot[`${t.row},${t.col}`] = t;
  });

  // For each line, compute the slide result and update DOM
  if (direction === 'left' || direction === 'right') {
    for (let r = 0; r < GRID_SIZE; r++) {
      let line = getRow(r);
      if (direction === 'right') line = line.reverse();

      const { line: newLine, gained: g } = slideLine(line);
      let finalLine = direction === 'right' ? newLine.reverse() : newLine;

      // Check if anything changed
      const origLine = direction === 'right' ? getRow(r).reverse() : getRow(r);
      const origFinal = direction === 'right' ? origLine.reverse() : origLine;

      if (finalLine.join(',') !== getRow(r).join(',')) moved = true;
      gained += g;
      applyLineToDOM(r, null, direction, finalLine, snapshot, g > 0 ? newLine : null, direction === 'right' ? line.reverse() : line);
      setRow(r, finalLine);
    }
  } else {
    for (let c = 0; c < GRID_SIZE; c++) {
      let line = getCol(c);
      if (direction === 'down') line = line.reverse();

      const { line: newLine, gained: g } = slideLine(line);
      let finalLine = direction === 'down' ? newLine.reverse() : newLine;

      if (finalLine.join(',') !== getCol(c).join(',')) moved = true;
      gained += g;
      applyColToDOM(c, direction, finalLine, snapshot, g > 0 ? newLine : null, direction === 'down' ? line.reverse() : line);
      setCol(c, finalLine);
    }
  }

  if (!moved) return;

  if (gained > 0) updateScore(gained);

  // Spawn new tile after transition
  setTimeout(() => {
    spawnTile(true);
    if (isGameOver()) endGame();
  }, 140);
}

// Apply the computed line back to DOM for a row
function applyLineToDOM(r, _c, direction, finalLine, snapshot, mergedNewLine, origLine) {
  // We need to figure out which tile moved where.
  // Strategy: match original non-zero tiles in order to final positions.
  reconcileLine(
    origLine,
    finalLine,
    (origIdx) => snapshot[`${r},${origIdx}`],
    (origIdx, destIdx, isMerge, mergeValue) => {
      const tile = snapshot[`${r},${origIdx}`];
      if (!tile) return;
      moveTileDOM(tile, r, destIdx);
      if (isMerge) {
        // Will upgrade after transition
        setTimeout(() => {
          // Remove the other merging tile (already moved here)
          const others = tiles.filter(t => t !== tile && t.row === r && t.col === destIdx);
          others.forEach(o => removeTileDOM(o));
          upgradeTileDOM(tile, mergeValue);
        }, 115);
      }
    }
  );
}

// Apply the computed line back to DOM for a column
function applyColToDOM(c, direction, finalLine, snapshot, mergedNewLine, origLine) {
  reconcileLine(
    origLine,
    finalLine,
    (origIdx) => snapshot[`${origIdx},${c}`],
    (origIdx, destIdx, isMerge, mergeValue) => {
      const tile = snapshot[`${origIdx},${c}`];
      if (!tile) return;
      moveTileDOM(tile, destIdx, c);
      if (isMerge) {
        setTimeout(() => {
          const others = tiles.filter(t => t !== tile && t.row === destIdx && t.col === c);
          others.forEach(o => removeTileDOM(o));
          upgradeTileDOM(tile, mergeValue);
        }, 115);
      }
    }
  );
}

// Reconcile: map original non-zero tile indices to final positions
// orig: original line values, final: resulting line values
// getTile(origIdx): returns tile object at original index
// applyFn(origIdx, destIdx, isMerge, mergeValue): apply movement
function reconcileLine(orig, final, getTile, applyFn) {
  // Build list of source tiles (original non-zero positions)
  const sources = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    if (orig[i] !== 0) sources.push(i);
  }

  // Build list of destination slots from final line (non-zero)
  // Track merges: a dest slot with value 2x means two sources merged there
  const dests = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    if (final[i] !== 0) dests.push(i);
  }

  // Match sources to dests greedily (same order after sliding)
  // For each dest that is a merge result (value = 2 * source value),
  // it consumed two consecutive sources.
  let si = 0;
  for (let di = 0; di < dests.length; di++) {
    const destIdx  = dests[di];
    const destVal  = final[destIdx];

    if (si >= sources.length) break;

    const srcIdx1 = sources[si];
    const srcVal1 = orig[srcIdx1];

    if (destVal === srcVal1 * 2 && si + 1 < sources.length && orig[sources[si + 1]] === srcVal1) {
      // Merge: two tiles combine into dest
      const srcIdx2 = sources[si + 1];
      // Move both to destIdx; first one will survive and get upgraded
      applyFn(srcIdx1, destIdx, true,  destVal);
      applyFn(srcIdx2, destIdx, false, destVal);
      si += 2;
    } else {
      // Normal slide
      applyFn(srcIdx1, destIdx, false, destVal);
      si++;
    }
  }
}

/* ===========================
   Game Over Check
   =========================== */
function isGameOver() {
  // Any empty cell?
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (grid[r][c] === 0) return false;

  // Any possible merge?
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = grid[r][c];
      if (c + 1 < GRID_SIZE && grid[r][c + 1] === v) return false;
      if (r + 1 < GRID_SIZE && grid[r + 1][c] === v) return false;
    }
  }
  return true;
}

/* ===========================
   Game Lifecycle
   =========================== */
function startGame() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  bestScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  bestScoreEl.textContent = bestScore;
  score = 0;
  scoreEl.textContent = '0';
  tileIdCounter = 0;

  clearAllTiles();
  createGrid();

  // Small delay so board is painted before placing tiles
  requestAnimationFrame(() => {
    spawnTile(false);
    spawnTile(false);
  });

  hideOverlay(startScreen);
  hideOverlay(gameoverScreen);
  gameActive = true;
}

function endGame() {
  gameActive = false;
  const isNewRecord = score >= bestScore && score > 0;
  finalScoreEl.textContent = score;
  finalBestEl.textContent  = bestScore;
  newRecordBadge.classList.toggle('hidden', !isNewRecord);
  showOverlay(gameoverScreen);
  if(typeof Leaderboard!=='undefined')Leaderboard.ready('2048',score);
}

function showOverlay(el) {
  el.classList.add('active');
}

function hideOverlay(el) {
  el.classList.remove('active');
}

/* ===========================
   Input Handling: Keyboard
   =========================== */
document.addEventListener('keydown', (e) => {
  if (!gameActive) return;
  switch (e.key) {
    case 'ArrowLeft':  e.preventDefault(); move('left');  break;
    case 'ArrowRight': e.preventDefault(); move('right'); break;
    case 'ArrowUp':    e.preventDefault(); move('up');    break;
    case 'ArrowDown':  e.preventDefault(); move('down');  break;
  }
});

/* ===========================
   Input Handling: Touch/Swipe
   =========================== */
let touchStartX = 0;
let touchStartY = 0;
const SWIPE_THRESHOLD = 30;

document.addEventListener('touchstart', (e) => {
  if (!gameActive) return;
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  if (!gameActive) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  if (Math.max(adx, ady) < SWIPE_THRESHOLD) return;

  if (adx > ady) {
    move(dx > 0 ? 'right' : 'left');
  } else {
    move(dy > 0 ? 'down' : 'up');
  }
}, { passive: true });

/* ===========================
   Button Handlers
   =========================== */
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
newGameBtn.addEventListener('click', () => {
  if (!gameActive) {
    startGame();
  } else {
    // Confirm or just restart immediately for snappy feel
    startGame();
  }
});

/* ===========================
   Window Resize: Reposition Tiles
   =========================== */
window.addEventListener('resize', () => {
  if (!gameActive) return;
  const size = tileSize();
  tiles.forEach(t => {
    t.el.style.width    = size + 'px';
    t.el.style.height   = size + 'px';
    t.el.style.left     = cellPixel(t.col) + 'px';
    t.el.style.top      = cellPixel(t.row) + 'px';
    t.el.style.fontSize = tileFontSize(t.value, size) + 'px';
  });
});

/* ===========================
   Init
   =========================== */
(function init() {
  bestScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  bestScoreEl.textContent = bestScore;
  // Show start screen on load (already active via HTML)
})();
