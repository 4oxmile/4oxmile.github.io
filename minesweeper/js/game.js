'use strict';

/* ============================================================
   CONSTANTS
   ============================================================ */
const ROWS = 9;
const COLS = 9;
const TOTAL_MINES = 10;
const LONG_PRESS_MS = 500;
const LS_BEST_KEY = 'mine_best_time';

/* ============================================================
   STATE
   ============================================================ */
let board = [];        // 2D array of cell objects
let mineSet = new Set(); // "r,c" strings for mine positions
let revealed = 0;
let flagCount = 0;
let gameActive = false;
let firstTap = true;
let timerInterval = null;
let elapsedSeconds = 0;
let flagMode = false;   // true = tap places flags

// Long-press tracking
let longPressTimer = null;
let longPressTriggered = false;
let touchStartX = 0;
let touchStartY = 0;

/* ============================================================
   DOM REFS
   ============================================================ */
const boardEl       = document.getElementById('board');
const mineCounterEl = document.getElementById('mine-counter');
const timerEl       = document.getElementById('timer');
const modeBtnEl     = document.getElementById('mode-toggle');
const modeIconEl    = document.getElementById('mode-icon');
const modeLabelEl   = document.getElementById('mode-label');
const newGameBtnEl  = document.getElementById('btn-new-game');

const overlayStart    = document.getElementById('overlay-start');
const overlayGameOver = document.getElementById('overlay-gameover');
const overlayWin      = document.getElementById('overlay-win');
const startBestEl     = document.getElementById('start-best-display');
const winTimeEl       = document.getElementById('win-time');
const winBestEl       = document.getElementById('win-best');
const newRecordBadge  = document.getElementById('new-record-badge');

/* ============================================================
   UTILITY
   ============================================================ */
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function getBestTime() {
  const v = localStorage.getItem(LS_BEST_KEY);
  return v !== null ? parseInt(v, 10) : null;
}

function saveBestTime(t) {
  localStorage.setItem(LS_BEST_KEY, t);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function neighbors(r, c) {
  const result = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        result.push([nr, nc]);
      }
    }
  }
  return result;
}

/* ============================================================
   TIMER
   ============================================================ */
function startTimer() {
  stopTimer();
  elapsedSeconds = 0;
  timerEl.textContent = fmtTime(0);
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    timerEl.textContent = fmtTime(elapsedSeconds);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/* ============================================================
   BOARD INIT
   ============================================================ */
function initBoard() {
  board = [];
  mineSet.clear();
  revealed = 0;
  flagCount = 0;
  firstTap = true;
  gameActive = true;
  flagMode = false;
  updateModeButton();

  stopTimer();
  timerEl.textContent = fmtTime(0);
  mineCounterEl.textContent = TOTAL_MINES;

  boardEl.innerHTML = '';

  for (let r = 0; r < ROWS; r++) {
    board[r] = [];
    for (let c = 0; c < COLS; c++) {
      const cellData = {
        r, c,
        mine: false,
        revealed: false,
        flagged: false,
        adjacent: 0,
        el: null
      };

      const el = document.createElement('div');
      el.className = 'cell hidden';
      el.dataset.r = r;
      el.dataset.c = c;

      attachCellEvents(el, r, c);

      cellData.el = el;
      board[r][c] = cellData;
      boardEl.appendChild(el);
    }
  }
}

/* ============================================================
   MINE PLACEMENT (after first tap)
   ============================================================ */
function placeMines(safeR, safeC) {
  const safeZone = new Set();
  for (const [nr, nc] of [[safeR, safeC], ...neighbors(safeR, safeC)]) {
    safeZone.add(`${nr},${nc}`);
  }

  const candidates = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!safeZone.has(`${r},${c}`)) {
        candidates.push([r, c]);
      }
    }
  }

  // Fisher-Yates shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (let i = 0; i < TOTAL_MINES; i++) {
    const [r, c] = candidates[i];
    board[r][c].mine = true;
    mineSet.add(`${r},${c}`);
  }

  // Compute adjacency counts
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c].mine) {
        let count = 0;
        for (const [nr, nc] of neighbors(r, c)) {
          if (board[nr][nc].mine) count++;
        }
        board[r][c].adjacent = count;
      }
    }
  }
}

/* ============================================================
   REVEAL LOGIC
   ============================================================ */
function revealCell(r, c) {
  const cell = board[r][c];
  if (cell.revealed || cell.flagged) return;

  cell.revealed = true;
  revealed++;

  const el = cell.el;
  el.classList.remove('hidden');
  el.classList.add('revealed');

  if (cell.adjacent > 0) {
    el.textContent = cell.adjacent;
    el.classList.add(`num-${cell.adjacent}`);
  }

  // Flood-fill for empty cells
  if (cell.adjacent === 0) {
    for (const [nr, nc] of neighbors(r, c)) {
      if (!board[nr][nc].revealed && !board[nr][nc].flagged && !board[nr][nc].mine) {
        revealCell(nr, nc);
      }
    }
  }
}

/* ============================================================
   CHORD (reveal neighbors when correct flags placed)
   ============================================================ */
function chord(r, c) {
  const cell = board[r][c];
  if (!cell.revealed || cell.adjacent === 0) return;

  let adjFlags = 0;
  for (const [nr, nc] of neighbors(r, c)) {
    if (board[nr][nc].flagged) adjFlags++;
  }
  if (adjFlags !== cell.adjacent) return;

  for (const [nr, nc] of neighbors(r, c)) {
    const nc2 = board[nr][nc];
    if (!nc2.revealed && !nc2.flagged) {
      if (nc2.mine) {
        triggerGameOver(nr, nc);
        return;
      }
      revealCell(nr, nc);
    }
  }
  checkWin();
}

/* ============================================================
   FLAG TOGGLE
   ============================================================ */
function toggleFlag(r, c) {
  const cell = board[r][c];
  if (!gameActive || cell.revealed) return;

  cell.flagged = !cell.flagged;
  flagCount += cell.flagged ? 1 : -1;

  const el = cell.el;
  if (cell.flagged) {
    el.classList.add('flagged');
  } else {
    el.classList.remove('flagged');
  }

  mineCounterEl.textContent = TOTAL_MINES - flagCount;
}

/* ============================================================
   TAP HANDLER
   ============================================================ */
function handleTap(r, c) {
  if (!gameActive) return;
  const cell = board[r][c];

  if (flagMode) {
    if (!cell.revealed) toggleFlag(r, c);
    return;
  }

  if (cell.flagged) return;

  if (cell.revealed) {
    chord(r, c);
    return;
  }

  // First tap: place mines
  if (firstTap) {
    firstTap = false;
    placeMines(r, c);
    startTimer();
  }

  if (cell.mine) {
    triggerGameOver(r, c);
    return;
  }

  revealCell(r, c);
  checkWin();
}

/* ============================================================
   WIN CHECK
   ============================================================ */
function checkWin() {
  const totalSafe = ROWS * COLS - TOTAL_MINES;
  if (revealed >= totalSafe) {
    triggerWin();
  }
}

/* ============================================================
   GAME OVER
   ============================================================ */
function triggerGameOver(hitR, hitC) {
  gameActive = false;
  stopTimer();

  // Show hit mine
  board[hitR][hitC].el.classList.remove('hidden');
  board[hitR][hitC].el.classList.add('mine-hit');

  // Reveal all other cells with delay
  let delay = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (r === hitR && c === hitC) continue;

      if (cell.mine && !cell.flagged) {
        const el = cell.el;
        const d = delay;
        setTimeout(() => {
          el.classList.remove('hidden', 'flagged');
          el.classList.add('mine-revealed');
        }, d);
        delay += 40;
      } else if (!cell.mine && cell.flagged) {
        // Wrong flag
        cell.el.classList.remove('flagged');
        cell.el.classList.add('wrong-flag');
      } else if (cell.mine && cell.flagged) {
        // Correct flag
        cell.el.classList.remove('flagged');
        cell.el.classList.add('correct-flag');
      }
    }
  }

  setTimeout(() => {
    overlayGameOver.classList.remove('hidden');
  }, Math.max(delay, 300));
}

/* ============================================================
   WIN
   ============================================================ */
function triggerWin() {
  gameActive = false;
  stopTimer();

  // Auto-flag remaining mines
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (cell.mine && !cell.flagged) {
        cell.flagged = true;
        cell.el.classList.add('flagged');
      }
    }
  }
  mineCounterEl.textContent = '0';

  // Win animation on revealed cells
  let delay = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (cell.revealed) {
        const el = cell.el;
        const d = delay;
        setTimeout(() => el.classList.add('win-reveal'), d);
        delay += 15;
      }
    }
  }

  const clearTime = elapsedSeconds;
  const best = getBestTime();
  const isNewRecord = best === null || clearTime < best;

  if (isNewRecord) saveBestTime(clearTime);

  setTimeout(() => {
    winTimeEl.textContent = fmtTime(clearTime);
    winBestEl.textContent = isNewRecord ? fmtTime(clearTime) : fmtTime(best);
    newRecordBadge.classList.toggle('hidden', !isNewRecord);
    overlayWin.classList.remove('hidden');
    if(typeof Leaderboard!=='undefined')Leaderboard.ready('minesweeper',clearTime,{ascending:true,format:'time',label:'시간'});
  }, delay + 200);
}

/* ============================================================
   MODE TOGGLE
   ============================================================ */
function updateModeButton() {
  if (flagMode) {
    modeIconEl.textContent = '🚩';
    modeLabelEl.textContent = '깃발 모드';
    modeBtnEl.classList.add('flag-mode');
  } else {
    modeIconEl.textContent = '🔍';
    modeLabelEl.textContent = '열기 모드';
    modeBtnEl.classList.remove('flag-mode');
  }
}

modeBtnEl.addEventListener('click', () => {
  flagMode = !flagMode;
  updateModeButton();
});

/* ============================================================
   CELL EVENT ATTACHMENT
   ============================================================ */
function attachCellEvents(el, r, c) {
  /* --- MOUSE (desktop) --- */
  el.addEventListener('click', (e) => {
    e.preventDefault();
    if (longPressTriggered) { longPressTriggered = false; return; }
    handleTap(r, c);
  });

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!gameActive) return;
    toggleFlag(r, c);
  });

  /* --- TOUCH (mobile) --- */
  el.addEventListener('touchstart', (e) => {
    e.preventDefault();
    longPressTriggered = false;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;

    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      if (!gameActive) return;
      toggleFlag(r, c);
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(40);
    }, LONG_PRESS_MS);
  }, { passive: false });

  el.addEventListener('touchmove', (e) => {
    const dx = Math.abs(e.touches[0].clientX - touchStartX);
    const dy = Math.abs(e.touches[0].clientY - touchStartY);
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimer);
    }
  }, { passive: true });

  el.addEventListener('touchend', (e) => {
    e.preventDefault();
    clearTimeout(longPressTimer);
    if (!longPressTriggered) {
      handleTap(r, c);
    }
    longPressTriggered = false;
  }, { passive: false });

  el.addEventListener('touchcancel', () => {
    clearTimeout(longPressTimer);
    longPressTriggered = false;
  });
}

/* ============================================================
   START / RESTART
   ============================================================ */
function startGame() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  overlayStart.classList.add('hidden');
  overlayGameOver.classList.add('hidden');
  overlayWin.classList.add('hidden');
  initBoard();
}

function showStartScreen() {
  const best = getBestTime();
  if (best !== null) {
    startBestEl.textContent = `최고 기록: ${fmtTime(best)}`;
  } else {
    startBestEl.textContent = '';
  }
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart-lose').addEventListener('click', startGame);
document.getElementById('btn-restart-win').addEventListener('click', startGame);
newGameBtnEl.addEventListener('click', () => {
  overlayGameOver.classList.add('hidden');
  overlayWin.classList.add('hidden');
  initBoard();
});

/* ============================================================
   BOOT
   ============================================================ */
showStartScreen();
// Board is pre-rendered but inactive until start is clicked
initBoard();
gameActive = false;
stopTimer();
