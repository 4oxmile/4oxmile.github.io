/**
 * SUDOKU — Complete Browser Game
 * Puzzle generation via backtracking solver + hole-punching.
 * Features: difficulty levels, notes mode, hints, timer, best times, localStorage.
 */

'use strict';

/* ============================================================
   CONSTANTS
   ============================================================ */
const DIFFICULTY = {
  easy:   { label: '쉬움',   removals: 35 },
  normal: { label: '보통',   removals: 46 },
  hard:   { label: '어려움', removals: 54 },
};

const STORAGE_KEY = 'sudoku_best_times';
const MAX_HINTS   = 3;

/* ============================================================
   STATE
   ============================================================ */
let state = {
  difficulty: 'normal',
  solution:   [],   // 81-element flat array (1-9)
  puzzle:     [],   // 81-element flat array (1-9 or 0 = empty)
  board:      [],   // current board (user filled values, 0 = empty)
  notes:      [],   // 81 sets of note numbers
  given:      [],   // bool[81] — clue cells
  selected:   -1,   // index 0-80, -1 = none
  notesMode:  false,
  hintsLeft:  MAX_HINTS,
  timerSecs:  0,
  timerHandle: null,
  running:    false,
  bestTimes:  {},   // { easy: secs, normal: secs, hard: secs }
};

/* ============================================================
   UTILITY — SUDOKU LOGIC
   ============================================================ */

/** Fisher-Yates shuffle */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** row / col / box peers set for index i */
function peers(i) {
  const row = Math.floor(i / 9);
  const col = i % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  const set = new Set();

  for (let c = 0; c < 9; c++) set.add(row * 9 + c);
  for (let r = 0; r < 9; r++) set.add(r * 9 + col);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      set.add((boxRow + r) * 9 + (boxCol + c));

  set.delete(i);
  return set;
}

/** Same row / col / box as index i */
function sameRegion(i, j) {
  const ri = Math.floor(i / 9), ci = i % 9;
  const rj = Math.floor(j / 9), cj = j % 9;
  return ri === rj || ci === cj ||
    (Math.floor(ri / 3) === Math.floor(rj / 3) &&
     Math.floor(ci / 3) === Math.floor(cj / 3));
}

/** Solve board[] in-place with backtracking, randomized.
 *  Returns true if a solution was found. */
function solve(board, randomize = false) {
  const empty = board.indexOf(0);
  if (empty === -1) return true;

  const used = new Set();
  for (const p of peers(empty)) {
    if (board[p]) used.add(board[p]);
  }

  let digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => !used.has(d));
  if (randomize) shuffle(digits);

  for (const d of digits) {
    board[empty] = d;
    if (solve(board, randomize)) return true;
    board[empty] = 0;
  }

  return false;
}

/** Count solutions — capped at 2 for performance (unique = 1) */
function countSolutions(board, limit = 2) {
  const empty = board.indexOf(0);
  if (empty === -1) return 1;

  const used = new Set();
  for (const p of peers(empty)) {
    if (board[p]) used.add(board[p]);
  }

  let count = 0;
  for (let d = 1; d <= 9 && count < limit; d++) {
    if (used.has(d)) continue;
    board[empty] = d;
    count += countSolutions(board, limit - count);
    board[empty] = 0;
  }
  return count;
}

/** Generate a full valid solved grid */
function generateSolution() {
  const board = new Array(81).fill(0);
  solve(board, true);
  return board;
}

/** Remove `removals` cells while keeping unique solution */
function generatePuzzle(solution, removals) {
  const puzzle = [...solution];
  const indices = shuffle([...Array(81).keys()]);
  let removed = 0;

  for (const idx of indices) {
    if (removed >= removals) break;
    const backup = puzzle[idx];
    puzzle[idx] = 0;

    const test = [...puzzle];
    if (countSolutions(test) === 1) {
      removed++;
    } else {
      puzzle[idx] = backup;
    }
  }

  return puzzle;
}

/* ============================================================
   TIMER
   ============================================================ */
function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer() {
  clearInterval(state.timerHandle);
  state.timerSecs = 0;
  state.running   = true;
  updateTimerUI();
  state.timerHandle = setInterval(() => {
    if (state.running) {
      state.timerSecs++;
      updateTimerUI();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerHandle);
  state.running = false;
}

function updateTimerUI() {
  document.getElementById('timer').textContent = formatTime(state.timerSecs);
}

/* ============================================================
   BEST TIMES — localStorage
   ============================================================ */
function loadBestTimes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.bestTimes = raw ? JSON.parse(raw) : {};
  } catch (_) {
    state.bestTimes = {};
  }
}

function saveBestTime(diff, secs) {
  if (!state.bestTimes[diff] || secs < state.bestTimes[diff]) {
    state.bestTimes[diff] = secs;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bestTimes));
    } catch (_) {}
    return true; // new record
  }
  return false;
}

function renderBestTimes() {
  const container = document.getElementById('best-times-display');
  const rows = Object.entries(DIFFICULTY).map(([key, cfg]) => {
    const best = state.bestTimes[key];
    const val  = best !== undefined ? formatTime(best) : '--:--';
    return `<div class="best-time-row">
      <span class="label">${cfg.label}</span>
      <span class="value">${val}</span>
    </div>`;
  });

  container.innerHTML = `
    <div class="best-times-title">최고 기록</div>
    ${rows.join('')}
  `;
}

/* ============================================================
   BOARD RENDERING
   ============================================================ */
function buildBoardDOM() {
  const board = document.getElementById('sudoku-board');
  board.innerHTML = '';

  for (let i = 0; i < 81; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.idx = i;

    // value span
    const val = document.createElement('span');
    val.className = 'cell-value';
    cell.appendChild(val);

    // notes grid
    const notes = document.createElement('div');
    notes.className = 'cell-notes';
    notes.style.display = 'none';
    for (let n = 1; n <= 9; n++) {
      const nd = document.createElement('span');
      nd.className = 'note-digit';
      nd.dataset.n  = n;
      nd.textContent = n;
      notes.appendChild(nd);
    }
    cell.appendChild(notes);

    cell.addEventListener('click', () => selectCell(i));
    board.appendChild(cell);
  }
}

function renderBoard() {
  const cells = document.querySelectorAll('.cell');

  cells.forEach((cell, i) => {
    const v      = state.board[i];
    const given  = state.given[i];
    const sol    = state.solution[i];
    const valEl  = cell.querySelector('.cell-value');
    const noteEl = cell.querySelector('.cell-notes');

    // classes
    cell.className = 'cell';
    if (given) cell.classList.add('given');

    const noteSet = state.notes[i];
    const hasNote = noteSet && noteSet.size > 0;

    if (v) {
      // show value
      valEl.textContent = v;
      valEl.style.display = '';
      noteEl.style.display = 'none';

      if (!given) {
        cell.classList.add('user-filled');
        // conflict check
        if (v !== sol) {
          cell.classList.add('error');
        }
      }
    } else if (hasNote) {
      // show notes
      valEl.style.display = 'none';
      noteEl.style.display = '';
      noteEl.querySelectorAll('.note-digit').forEach(nd => {
        nd.classList.toggle('visible', noteSet.has(Number(nd.dataset.n)));
        nd.textContent = noteSet.has(Number(nd.dataset.n)) ? nd.dataset.n : '';
      });
    } else {
      valEl.textContent   = '';
      valEl.style.display = '';
      noteEl.style.display = 'none';
    }
  });

  applyHighlights();
  updateNumpadCompletion();
}

function applyHighlights() {
  const sel  = state.selected;
  const cells = document.querySelectorAll('.cell');
  const selVal = sel >= 0 ? state.board[sel] : 0;

  cells.forEach((cell, i) => {
    cell.classList.remove('selected', 'highlight-region', 'highlight-same');

    if (sel < 0) return;

    if (i === sel) {
      cell.classList.add('selected');
    } else if (selVal && state.board[i] === selVal) {
      cell.classList.add('highlight-same');
    } else if (sameRegion(sel, i)) {
      cell.classList.add('highlight-region');
    }
  });
}

function updateNumpadCompletion() {
  // Grey out numbers that are fully placed (9 of each)
  const count = new Array(10).fill(0);
  state.board.forEach(v => { if (v) count[v]++; });
  document.querySelectorAll('.num-btn').forEach(btn => {
    const n = Number(btn.dataset.num);
    btn.classList.toggle('complete', count[n] >= 9);
  });
}

/* ============================================================
   GAME LOGIC
   ============================================================ */
function newGame(difficulty) {
  state.difficulty = difficulty;
  state.hintsLeft  = MAX_HINTS;
  state.notesMode  = false;
  state.selected   = -1;

  // Generate
  const solution = generateSolution();
  const puzzle   = generatePuzzle(solution, DIFFICULTY[difficulty].removals);

  state.solution = solution;
  state.puzzle   = [...puzzle];
  state.board    = [...puzzle];
  state.given    = puzzle.map(v => v !== 0);
  state.notes    = Array.from({ length: 81 }, () => new Set());

  // UI updates
  document.getElementById('diff-label').textContent  = DIFFICULTY[difficulty].label;
  document.getElementById('hint-count').textContent  = state.hintsLeft;
  document.getElementById('btn-notes').classList.remove('active');

  buildBoardDOM();
  renderBoard();
  startTimer();
  showScreen('game');
}

function selectCell(idx) {
  state.selected = (state.selected === idx) ? -1 : idx;
  applyHighlights();
}

function inputNumber(num) {
  const idx = state.selected;
  if (idx < 0) return;
  if (state.given[idx]) return;

  if (state.notesMode) {
    // Toggle note
    const noteSet = state.notes[idx];
    if (noteSet.has(num)) {
      noteSet.delete(num);
    } else {
      noteSet.add(num);
      // clear value if set
      state.board[idx] = 0;
    }
  } else {
    // Set value
    state.notes[idx].clear();
    state.board[idx] = num;

    // Remove this number from notes in same region
    for (const p of peers(idx)) {
      state.notes[p].delete(num);
    }

    checkVictory();
  }

  renderBoard();
}

function eraseCell() {
  const idx = state.selected;
  if (idx < 0 || state.given[idx]) return;
  state.board[idx] = 0;
  state.notes[idx].clear();
  renderBoard();
}

function useHint() {
  if (state.hintsLeft <= 0) return;
  const idx = state.selected;
  if (idx < 0 || state.given[idx]) return;
  if (state.board[idx] === state.solution[idx]) return; // already correct

  state.board[idx] = state.solution[idx];
  state.notes[idx].clear();
  state.hintsLeft--;
  document.getElementById('hint-count').textContent = state.hintsLeft;

  // Brief animation
  const cell = document.querySelector(`.cell[data-idx="${idx}"]`);
  if (cell) {
    cell.classList.add('complete-anim');
    cell.addEventListener('animationend', () => cell.classList.remove('complete-anim'), { once: true });
  }

  renderBoard();
  checkVictory();
}

function checkVictory() {
  const complete = state.board.every((v, i) => v === state.solution[i]);
  if (!complete) return;

  stopTimer();
  state.running = false;

  const isNew = saveBestTime(state.difficulty, state.timerSecs);
  const best  = state.bestTimes[state.difficulty];

  document.getElementById('result-time').textContent = formatTime(state.timerSecs);
  document.getElementById('result-diff').textContent = DIFFICULTY[state.difficulty].label;
  const bestEl = document.getElementById('result-best');
  bestEl.textContent = formatTime(best);
  bestEl.classList.toggle('new-record', isNew);

  // Victory animation — stagger cells
  document.querySelectorAll('.cell').forEach((cell, i) => {
    setTimeout(() => {
      cell.classList.add('complete-anim');
      cell.addEventListener('animationend', () => cell.classList.remove('complete-anim'), { once: true });
    }, i * 8);
  });

  setTimeout(() => showOverlay('victory'), 750);
}

/* ============================================================
   KEYBOARD SUPPORT
   ============================================================ */
document.addEventListener('keydown', e => {
  const screen = document.getElementById('screen-game');
  if (!screen.classList.contains('active')) return;

  if (e.key >= '1' && e.key <= '9') {
    inputNumber(Number(e.key));
    return;
  }

  switch (e.key) {
    case 'Backspace':
    case 'Delete':
    case '0':
      eraseCell();
      break;
    case 'n':
    case 'N':
      toggleNotesMode();
      break;
    case 'h':
    case 'H':
      useHint();
      break;
    case 'ArrowUp':    moveSelection(-9); e.preventDefault(); break;
    case 'ArrowDown':  moveSelection(+9); e.preventDefault(); break;
    case 'ArrowLeft':  moveSelection(-1); e.preventDefault(); break;
    case 'ArrowRight': moveSelection(+1); e.preventDefault(); break;
    case 'Escape':
      state.selected = -1;
      applyHighlights();
      break;
  }
});

function moveSelection(delta) {
  if (state.selected < 0) {
    state.selected = 0;
  } else {
    let next = state.selected + delta;
    if (next < 0)  next = 0;
    if (next > 80) next = 80;
    state.selected = next;
  }
  applyHighlights();
}

/* ============================================================
   NOTES MODE TOGGLE
   ============================================================ */
function toggleNotesMode() {
  state.notesMode = !state.notesMode;
  document.getElementById('btn-notes').classList.toggle('active', state.notesMode);
}

/* ============================================================
   SCREEN / OVERLAY MANAGEMENT
   ============================================================ */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${name}`);
  if (target) target.classList.add('active');
}

function showOverlay(name) {
  document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
  const target = document.getElementById(`overlay-${name}`);
  if (target) target.classList.remove('hidden');
}

function hideOverlay(name) {
  const target = document.getElementById(`overlay-${name}`);
  if (target) target.classList.add('hidden');
}

/* ============================================================
   EVENT WIRING
   ============================================================ */
function initEvents() {
  // --- Start screen ---
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.difficulty = btn.dataset.diff;
    });
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    newGame(state.difficulty);
  });

  // --- Game header ---
  document.getElementById('btn-home').addEventListener('click', () => {
    stopTimer();
    loadBestTimes();
    renderBestTimes();
    showScreen('start');
  });

  document.getElementById('btn-new-game').addEventListener('click', () => {
    stopTimer();
    showOverlay('confirm');
  });

  // --- Action buttons ---
  document.getElementById('btn-erase').addEventListener('click', eraseCell);

  document.getElementById('btn-notes').addEventListener('click', toggleNotesMode);

  document.getElementById('btn-hint').addEventListener('click', useHint);

  // --- Number pad ---
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => inputNumber(Number(btn.dataset.num)));
  });

  // --- Victory overlay ---
  document.getElementById('btn-victory-home').addEventListener('click', () => {
    hideOverlay('victory');
    loadBestTimes();
    renderBestTimes();
    showScreen('start');
  });

  document.getElementById('btn-victory-new').addEventListener('click', () => {
    hideOverlay('victory');
    newGame(state.difficulty);
  });

  // --- Confirm overlay ---
  document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
    hideOverlay('confirm');
    if (state.running) startResumeTimer();
  });

  document.getElementById('btn-confirm-ok').addEventListener('click', () => {
    hideOverlay('confirm');
    newGame(state.difficulty);
  });
}

/** Resume timer after cancel — re-use existing count */
function startResumeTimer() {
  clearInterval(state.timerHandle);
  state.running = true;
  state.timerHandle = setInterval(() => {
    if (state.running) {
      state.timerSecs++;
      updateTimerUI();
    }
  }, 1000);
}

/* ============================================================
   INIT
   ============================================================ */
(function init() {
  loadBestTimes();
  renderBestTimes();
  initEvents();
  showScreen('start');
})();
