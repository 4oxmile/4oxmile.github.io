'use strict';

/* ===========================
   State
   =========================== */
const state = {
  size: 4,           // 3, 4, or 5
  tiles: [],         // flat array; 0 = empty
  emptyIndex: 0,
  moves: 0,
  seconds: 0,
  timerInterval: null,
  gameActive: false,
  gameStarted: false,
};

/* ===========================
   DOM refs
   =========================== */
const screens = {
  start:   document.getElementById('screen-start'),
  game:    document.getElementById('screen-game'),
  victory: document.getElementById('screen-victory'),
};

const board          = document.getElementById('board');
const moveCountEl    = document.getElementById('move-count');
const timerEl        = document.getElementById('timer-display');
const sizeIndicator  = document.getElementById('size-indicator');
const bestRecordsEl  = document.getElementById('best-records');
const resultMovesEl  = document.getElementById('result-moves');
const resultTimeEl   = document.getElementById('result-time');
const resultBestEl   = document.getElementById('result-best');

/* ===========================
   Screen management
   =========================== */
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
}

/* ===========================
   Storage helpers
   =========================== */
function storageKey(size) {
  return `puzzle_best_${size}`;
}

function getBest(size) {
  try {
    const raw = localStorage.getItem(storageKey(size));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveBest(size, moves, seconds) {
  const existing = getBest(size);
  const record = {
    moves:   (existing && existing.moves   <= moves)   ? existing.moves   : moves,
    seconds: (existing && existing.seconds <= seconds) ? existing.seconds : seconds,
  };
  try {
    localStorage.setItem(storageKey(size), JSON.stringify(record));
  } catch { /* storage full or blocked */ }
  return record;
}

/* ===========================
   Timer
   =========================== */
function startTimer() {
  stopTimer();
  state.seconds = 0;
  timerEl.textContent = '0:00';
  state.timerInterval = setInterval(() => {
    state.seconds++;
    timerEl.textContent = formatTime(state.seconds);
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/* ===========================
   Puzzle generation
   =========================== */
function goalState(size) {
  const n = size * size;
  const arr = [];
  for (let i = 1; i < n; i++) arr.push(i);
  arr.push(0); // empty last
  return arr;
}

/**
 * Count inversions for solvability check.
 * Inversions: pairs (i,j) where i<j and arr[i]>arr[j] (excluding 0).
 */
function countInversions(arr) {
  const flat = arr.filter(v => v !== 0);
  let inv = 0;
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[i] > flat[j]) inv++;
    }
  }
  return inv;
}

/**
 * Solvability rule:
 * - Grid width odd:  solvable if inversions even.
 * - Grid width even: solvable if (inversions + row-of-blank-from-bottom) is odd.
 *   Row from bottom = size - Math.floor(emptyIdx / size).
 */
function isSolvable(arr, size) {
  const inv = countInversions(arr);
  if (size % 2 === 1) {
    return inv % 2 === 0;
  } else {
    const emptyIdx = arr.indexOf(0);
    const rowFromBottom = size - Math.floor(emptyIdx / size);
    return (inv + rowFromBottom) % 2 === 1;
  }
}

function shuffle(arr, size) {
  const a = [...arr];
  // Fisher-Yates
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  if (!isSolvable(a, size)) {
    // Fix: swap first two non-zero elements
    let swapped = false;
    for (let i = 0; i < a.length - 1 && !swapped; i++) {
      if (a[i] !== 0 && a[i + 1] !== 0) {
        [a[i], a[i + 1]] = [a[i + 1], a[i]];
        swapped = true;
      }
    }
  }
  return a;
}

function isGoal(arr) {
  const n = arr.length;
  for (let i = 0; i < n - 1; i++) {
    if (arr[i] !== i + 1) return false;
  }
  return arr[n - 1] === 0;
}

/* ===========================
   Board rendering
   =========================== */
function tileGroup(value, size) {
  // Assign color group: divide tiles into 4 groups
  const n = size * size - 1;
  const quarter = Math.ceil(n / 4);
  return Math.min(Math.ceil(value / quarter), 4);
}

function tileFontSize(size) {
  if (size === 3) return '1.6rem';
  if (size === 4) return '1.35rem';
  return '1rem';
}

function boardSize(size) {
  // Target board pixel size fitting most screens
  // We use CSS to do the heavy lifting; here we compute grid template sizes
  return size;
}

function renderBoard() {
  const { size, tiles } = state;

  // Compute board pixel size from available space
  const container = document.getElementById('board-container');
  const availW = container.clientWidth - 32;   // 2*padding 16px
  const availH = container.clientHeight - 32;
  const available = Math.min(availW, availH, 440);
  const gap = 6;
  const padding = 8;
  const tileSize = Math.floor((available - padding * 2 - gap * (size - 1)) / size);

  board.style.gridTemplateColumns = `repeat(${size}, ${tileSize}px)`;
  board.style.gridTemplateRows    = `repeat(${size}, ${tileSize}px)`;
  board.style.gap                 = `${gap}px`;

  board.innerHTML = '';

  const fontSize = tileFontSize(size);

  tiles.forEach((value, index) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.index = index;

    if (value === 0) {
      tile.classList.add('empty');
    } else {
      tile.textContent = value;
      tile.dataset.group = tileGroup(value, size);
      tile.style.fontSize = fontSize;
      tile.addEventListener('click', () => onTileClick(index));
      tile.addEventListener('touchend', e => {
        e.preventDefault();
        onTileClick(index);
      }, { passive: false });
    }

    board.appendChild(tile);
  });
}

/* ===========================
   Move logic
   =========================== */
function getAdjacentEmpty(clickedIndex) {
  const { size, emptyIndex } = state;
  const clickedRow = Math.floor(clickedIndex / size);
  const clickedCol = clickedIndex % size;
  const emptyRow   = Math.floor(emptyIndex / size);
  const emptyCol   = emptyIndex % size;

  // Must be in same row or same column and directly adjacent
  if (clickedRow === emptyRow) {
    // Same row — slide horizontally (supports only direct neighbor)
    if (Math.abs(clickedCol - emptyCol) === 1) {
      return true;
    }
  }
  if (clickedCol === emptyCol) {
    if (Math.abs(clickedRow - emptyRow) === 1) {
      return true;
    }
  }
  return false;
}

function slideDirection(tileIndex, emptyIndex, size) {
  const tileRow  = Math.floor(tileIndex / size);
  const tileCol  = tileIndex % size;
  const emptyRow = Math.floor(emptyIndex / size);
  const emptyCol = emptyIndex % size;

  if (tileRow === emptyRow) {
    return tileCol < emptyCol ? 'slide-right' : 'slide-left';
  }
  return tileRow < emptyRow ? 'slide-down' : 'slide-up';
}

function onTileClick(clickedIndex) {
  if (!state.gameActive) return;

  const { emptyIndex } = state;
  if (!getAdjacentEmpty(clickedIndex)) return;

  // Start timer on first move
  if (!state.gameStarted) {
    state.gameStarted = true;
    startTimer();
  }

  // Determine animation direction before swapping
  const dir = slideDirection(clickedIndex, emptyIndex, state.size);

  // Animate clicked tile
  const tileEl = board.children[clickedIndex];
  tileEl.classList.add(dir);
  tileEl.addEventListener('animationend', () => {
    tileEl.classList.remove(dir);
  }, { once: true });

  // Swap in state
  [state.tiles[clickedIndex], state.tiles[emptyIndex]] =
    [state.tiles[emptyIndex], state.tiles[clickedIndex]];
  state.emptyIndex = clickedIndex;

  // Update move count
  state.moves++;
  moveCountEl.textContent = state.moves;

  // Re-render board (lightweight)
  renderBoard();

  // Check victory
  if (isGoal(state.tiles)) {
    setTimeout(onVictory, 200);
  }
}

/* ===========================
   Victory
   =========================== */
function onVictory() {
  stopTimer();
  state.gameActive = false;

  // Pulse all tiles
  Array.from(board.children).forEach((el, i) => {
    if (!el.classList.contains('empty')) {
      setTimeout(() => el.classList.add('victory-pulse'), i * 30);
    }
  });

  setTimeout(() => {
    resultMovesEl.textContent = `${state.moves}번`;
    resultTimeEl.textContent  = formatTime(state.seconds);

    const record = saveBest(state.size, state.moves, state.seconds);
    const isBestMoves   = record.moves   === state.moves;
    const isBestSeconds = record.seconds === state.seconds;

    if (isBestMoves && isBestSeconds) {
      resultBestEl.textContent = '최고 기록 달성! 🏆';
    } else if (isBestMoves) {
      resultBestEl.textContent = '최소 이동 기록! 🥇';
    } else if (isBestSeconds) {
      resultBestEl.textContent = '최고 속도 기록! ⚡';
    } else {
      resultBestEl.textContent = '';
    }

    showScreen('victory');
  }, 500);
}

/* ===========================
   Game init / shuffle
   =========================== */
function initGame(size) {
  state.size = size;
  stopTimer();

  const goal = goalState(size);
  let arr;
  // Keep shuffling until we get something actually different from goal
  do {
    arr = shuffle(goal, size);
  } while (isGoal(arr));

  state.tiles        = arr;
  state.emptyIndex   = arr.indexOf(0);
  state.moves        = 0;
  state.seconds      = 0;
  state.gameActive   = true;
  state.gameStarted  = false;

  moveCountEl.textContent = '0';
  timerEl.textContent     = '0:00';
  sizeIndicator.textContent = `${size}×${size} 슬라이딩 퍼즐`;

  renderBoard();
}

/* ===========================
   Start screen best records
   =========================== */
function renderBestRecords(selectedSize) {
  const sizes = [3, 4, 5];
  const hasAny = sizes.some(s => getBest(s) !== null);

  if (!hasAny) {
    bestRecordsEl.innerHTML = `
      <p class="best-records-title">베스트 기록</p>
      <p class="no-record">아직 기록이 없습니다</p>
    `;
    return;
  }

  const rows = sizes.map(s => {
    const best = getBest(s);
    const label = `${s}×${s}`;
    if (!best) {
      return `
        <div class="best-record-row">
          <span class="best-record-label">${label}</span>
          <span class="best-record-val" style="color:var(--text-muted)">미완성</span>
        </div>
      `;
    }
    return `
      <div class="best-record-row">
        <span class="best-record-label">${label}</span>
        <div class="best-record-values">
          <span class="best-record-val">${best.moves}<span>번</span></span>
          <span class="best-record-val">${formatTime(best.seconds)}</span>
        </div>
      </div>
    `;
  }).join('');

  bestRecordsEl.innerHTML = `
    <p class="best-records-title">베스트 기록</p>
    ${rows}
  `;
}

/* ===========================
   Event listeners
   =========================== */

// Size buttons on start screen
let selectedSize = 4;
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedSize = parseInt(btn.dataset.size, 10);
    renderBestRecords(selectedSize);
  });
});

// Start button
document.getElementById('btn-start').addEventListener('click', () => {
  initGame(selectedSize);
  showScreen('game');
});

// Back button
document.getElementById('btn-back').addEventListener('click', () => {
  stopTimer();
  state.gameActive = false;
  renderBestRecords(selectedSize);
  showScreen('start');
});

// Shuffle button
document.getElementById('btn-shuffle').addEventListener('click', () => {
  initGame(state.size);
});

// Victory: play again
document.getElementById('btn-play-again').addEventListener('click', () => {
  initGame(state.size);
  showScreen('game');
});

// Victory: to menu
document.getElementById('btn-to-menu').addEventListener('click', () => {
  renderBestRecords(selectedSize);
  showScreen('start');
});

/* ===========================
   Keyboard support
   =========================== */
document.addEventListener('keydown', e => {
  if (!state.gameActive) return;

  const { size, emptyIndex } = state;
  const row = Math.floor(emptyIndex / size);
  const col = emptyIndex % size;

  let targetIndex = -1;

  switch (e.key) {
    case 'ArrowUp':
      // Move tile from below into empty (tile moves up)
      if (row < size - 1) targetIndex = emptyIndex + size;
      break;
    case 'ArrowDown':
      if (row > 0) targetIndex = emptyIndex - size;
      break;
    case 'ArrowLeft':
      if (col < size - 1) targetIndex = emptyIndex + 1;
      break;
    case 'ArrowRight':
      if (col > 0) targetIndex = emptyIndex - 1;
      break;
    default:
      return;
  }

  if (targetIndex >= 0 && targetIndex < size * size) {
    e.preventDefault();
    onTileClick(targetIndex);
  }
});

/* ===========================
   Resize handler — re-render board on window resize
   =========================== */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state.tiles.length > 0) renderBoard();
  }, 150);
});

/* ===========================
   Boot
   =========================== */
renderBestRecords(selectedSize);
showScreen('start');
