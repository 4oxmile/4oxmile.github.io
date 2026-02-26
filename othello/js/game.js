'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const EMPTY = 0, BLACK = 1, WHITE = 2;
const SIZE  = 8;
const DIRS  = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

// Positional weight table (corners high, edges medium, near-corners negative)
const WEIGHT_TABLE = [
  [120, -20,  20,  5,  5,  20, -20, 120],
  [-20, -40,  -5, -5, -5,  -5, -40, -20],
  [ 20,  -5,  15,  3,  3,  15,  -5,  20],
  [  5,  -5,   3,  3,  3,   3,  -5,   5],
  [  5,  -5,   3,  3,  3,   3,  -5,   5],
  [ 20,  -5,  15,  3,  3,  15,  -5,  20],
  [-20, -40,  -5, -5, -5,  -5, -40, -20],
  [120, -20,  20,  5,  5,  20, -20, 120],
];

// Difficulty configs: { depth, useRandom }
const DIFFICULTY = {
  easy:   { depth: 1, noise: 0.6 },
  normal: { depth: 3, noise: 0.0 },
  hard:   { depth: 5, noise: 0.0 },
};

// ── State ──────────────────────────────────────────────────────────────────
let board       = [];
let currentTurn = BLACK;
let gameActive  = false;
let difficulty  = 'normal';
let aiThinking  = false;
let stats       = { wins: 0, losses: 0, draws: 0 };
let consecutivePass = 0;

// ── DOM refs ───────────────────────────────────────────────────────────────
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelector(sel);

let cellEls = [];

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  buildBoard();
  bindUI();
  showScreen('start');
});

// ── Screen management ──────────────────────────────────────────────────────
function showScreen(name) {
  ['start-screen', 'result-screen'].forEach(id => {
    const el = $(id);
    if (el) el.classList.toggle('hidden', id !== name + '-screen');
  });
}

function hideOverlays() {
  [  'start-screen', 'result-screen'].forEach(id => {
    const el = $(id);
    if (el) el.classList.add('hidden');
  });
}

// ── Board construction ─────────────────────────────────────────────────────
function buildBoard() {
  const boardEl = $('board');
  boardEl.innerHTML = '';
  cellEls = [];
  for (let r = 0; r < SIZE; r++) {
    cellEls[r] = [];
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', () => onCellClick(r, c));
      boardEl.appendChild(cell);
      cellEls[r][c] = cell;
    }
  }
}

// ── Game start ─────────────────────────────────────────────────────────────
function startGame() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  // Standard starting position
  board[3][3] = WHITE; board[3][4] = BLACK;
  board[4][3] = BLACK; board[4][4] = WHITE;
  currentTurn    = BLACK;
  gameActive     = true;
  aiThinking     = false;
  consecutivePass = 0;
  hideOverlays();
  renderBoard();
  updateScorePanel();
  updateStatus();
}

// ── Board rendering ────────────────────────────────────────────────────────
function renderBoard(flippedCells = [], placedCell = null) {
  const validMoves = gameActive && currentTurn === BLACK
    ? getValidMoves(board, BLACK)
    : [];
  const validSet = new Set(validMoves.map(([r, c]) => `${r},${c}`));

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      renderCell(r, c, validSet, flippedCells, placedCell);
    }
  }
}

function renderCell(r, c, validSet, flippedCells = [], placedCell = null) {
  const cell    = cellEls[r][c];
  const value   = board[r][c];
  const key     = `${r},${c}`;
  const isValid = validSet && validSet.has(key);

  cell.classList.toggle('valid-move', isValid);

  // Manage disc element
  let disc = cell.querySelector('.disc');

  if (value === EMPTY) {
    if (disc) disc.remove();
    return;
  }

  const colorClass = value === BLACK ? 'black' : 'white';

  if (!disc) {
    disc = document.createElement('div');
    disc.className = `disc ${colorClass}`;
    cell.appendChild(disc);
    if (placedCell && placedCell[0] === r && placedCell[1] === c) {
      disc.classList.add('placing');
      disc.addEventListener('animationend', () => disc.classList.remove('placing'), { once: true });
    }
    return;
  }

  // Flip if needed
  const wasBlack = disc.classList.contains('black');
  const nowBlack = value === BLACK;
  if (wasBlack !== nowBlack) {
    const isFlipped = flippedCells.some(([fr, fc]) => fr === r && fc === c);
    if (isFlipped) {
      const animClass = nowBlack ? 'flip-to-black' : 'flip-to-white';
      disc.classList.remove('black', 'white', 'flip-to-black', 'flip-to-white');
      disc.classList.add(colorClass, animClass);
      disc.addEventListener('animationend', () => disc.classList.remove(animClass), { once: true });
    } else {
      disc.classList.remove('black', 'white');
      disc.classList.add(colorClass);
    }
  }
}

// ── Score & status ─────────────────────────────────────────────────────────
function countDiscs() {
  let b = 0, w = 0;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === BLACK) b++;
      else if (board[r][c] === WHITE) w++;
    }
  return { black: b, white: w };
}

function updateScorePanel() {
  const { black, white } = countDiscs();
  $('black-count').textContent = black;
  $('white-count').textContent = white;

  const blackPanel = $$('.player-score.black-side');
  const whitePanel = $$('.player-score.white-side');
  blackPanel.classList.toggle('active', currentTurn === BLACK && gameActive);
  whitePanel.classList.toggle('active', currentTurn === WHITE && gameActive);

  const dot = $('turn-dot');
  dot.className = 'turn-dot ' + (currentTurn === BLACK ? 'black' : 'white');
}

function updateStatus(msg) {
  const bar = $('status-bar');
  if (msg) {
    bar.innerHTML = msg;
  } else if (!gameActive) {
    bar.textContent = '';
  } else if (aiThinking) {
    bar.innerHTML = `<span class="thinking-indicator">AI 생각 중<span class="thinking-dots"><span></span><span></span><span></span></span></span>`;
  } else if (currentTurn === BLACK) {
    bar.textContent = '당신의 차례입니다';
  } else {
    bar.textContent = 'AI 차례';
  }
}

// ── Game logic ─────────────────────────────────────────────────────────────
function getValidMoves(bd, player) {
  const opp  = player === BLACK ? WHITE : BLACK;
  const moves = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (bd[r][c] !== EMPTY) continue;
      for (const [dr, dc] of DIRS) {
        let nr = r + dr, nc = c + dc, found = false;
        while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && bd[nr][nc] === opp) {
          nr += dr; nc += dc; found = true;
        }
        if (found && nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && bd[nr][nc] === player) {
          moves.push([r, c]);
          break;
        }
      }
    }
  }
  return moves;
}

function applyMove(bd, r, c, player) {
  const opp     = player === BLACK ? WHITE : BLACK;
  const newBd   = bd.map(row => [...row]);
  newBd[r][c]   = player;
  const flipped = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && newBd[nr][nc] === opp) {
      line.push([nr, nc]);
      nr += dr; nc += dc;
    }
    if (line.length && nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && newBd[nr][nc] === player) {
      for (const [lr, lc] of line) {
        newBd[lr][lc] = player;
        flipped.push([lr, lc]);
      }
    }
  }
  return { board: newBd, flipped };
}

// ── Player move ────────────────────────────────────────────────────────────
function onCellClick(r, c) {
  if (!gameActive || currentTurn !== BLACK || aiThinking) return;
  const valid = getValidMoves(board, BLACK);
  if (!valid.some(([vr, vc]) => vr === r && vc === c)) return;

  const { board: newBoard, flipped } = applyMove(board, r, c, BLACK);
  board = newBoard;
  consecutivePass = 0;
  currentTurn = WHITE;
  updateScorePanel();
  renderBoard(flipped, [r, c]);

  // Check board full
  let empty = 0;
  for (let r2 = 0; r2 < SIZE; r2++)
    for (let c2 = 0; c2 < SIZE; c2++)
      if (board[r2][c2] === EMPTY) empty++;
  if (empty === 0) { endGame(); return; }

  scheduleAI();
}

// ── AI move ────────────────────────────────────────────────────────────────
function scheduleAI() {
  if (!gameActive || currentTurn !== WHITE) return;
  const moves = getValidMoves(board, WHITE);

  // AI must pass
  if (moves.length === 0) {
    consecutivePass++;
    if (consecutivePass >= 2) { endGame(); return; }
    updateStatus('AI가 놓을 곳이 없어 패스합니다');
    setTimeout(() => {
      if (!gameActive) return;
      currentTurn = BLACK;
      updateScorePanel();
      renderBoard();
      updateStatus();
    }, 900);
    return;
  }

  aiThinking = true;
  consecutivePass = 0;
  updateStatus();
  updateScorePanel();

  const delay = 450 + Math.random() * 250;
  setTimeout(() => {
    if (!gameActive) return;
    const move = getBestMove(board, difficulty);
    const { board: newBoard, flipped } = applyMove(board, move[0], move[1], WHITE);
    board = newBoard;
    currentTurn = BLACK;
    aiThinking = false;
    updateScorePanel();
    renderBoard(flipped, [move[0], move[1]]);

    // Check if game ended after AI move
    let empty = 0;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (board[r][c] === EMPTY) empty++;
    if (empty === 0) { endGame(); return; }

    // Check if player has moves
    const playerMoves = getValidMoves(board, BLACK);
    if (playerMoves.length === 0) {
      // Player must pass
      consecutivePass++;
      if (consecutivePass >= 2) { endGame(); return; }
      updateStatus('놓을 곳이 없어 AI에게 차례를 넘깁니다');
      setTimeout(() => {
        if (!gameActive) return;
        currentTurn = WHITE;
        updateScorePanel();
        renderBoard();
        scheduleAI();
      }, 950);
    } else {
      consecutivePass = 0;
      updateStatus();
    }
  }, delay);
}


function endGame() {
  gameActive = false;
  const { black, white } = countDiscs();
  let outcome;
  if (black > white)       outcome = 'win';
  else if (white > black)  outcome = 'loss';
  else                     outcome = 'draw';

  stats[outcome === 'win' ? 'wins' : outcome === 'loss' ? 'losses' : 'draws']++;
  saveStats();
  updateStatsDisplay();

  setTimeout(() => showResult(outcome, black, white), 500);
}

// ── Result screen ──────────────────────────────────────────────────────────
function showResult(outcome, black, white) {
  const icons   = { win: '🏆', loss: '😔', draw: '🤝' };
  const titles  = { win: '승리!', loss: '패배', draw: '무승부' };
  $('result-icon').textContent  = icons[outcome];
  $('result-title').textContent = titles[outcome];
  $('result-black').textContent = black;
  $('result-white').textContent = white;
  showScreen('result');
}

// ── AI (minimax + alpha-beta) ──────────────────────────────────────────────
function getBestMove(bd, diff) {
  const cfg   = DIFFICULTY[diff] || DIFFICULTY.normal;
  const moves = getValidMoves(bd, WHITE);
  if (moves.length === 0) return null;

  // Easy: sometimes pick random
  if (cfg.noise > 0 && Math.random() < cfg.noise) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  let best = -Infinity, bestMove = moves[0];
  for (const [r, c] of moves) {
    const { board: nb } = applyMove(bd, r, c, WHITE);
    const score = minimax(nb, cfg.depth - 1, -Infinity, Infinity, false);
    if (score > best) { best = score; bestMove = [r, c]; }
  }
  return bestMove;
}

function minimax(bd, depth, alpha, beta, isMaximizing) {
  const player = isMaximizing ? WHITE : BLACK;
  const moves  = getValidMoves(bd, player);

  if (depth === 0 || moves.length === 0) {
    return evaluate(bd);
  }

  if (isMaximizing) {
    let val = -Infinity;
    for (const [r, c] of moves) {
      const { board: nb } = applyMove(bd, r, c, WHITE);
      val = Math.max(val, minimax(nb, depth - 1, alpha, beta, false));
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return val;
  } else {
    let val = Infinity;
    for (const [r, c] of moves) {
      const { board: nb } = applyMove(bd, r, c, BLACK);
      val = Math.min(val, minimax(nb, depth - 1, alpha, beta, true));
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return val;
  }
}

function evaluate(bd) {
  let score = 0;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if      (bd[r][c] === WHITE) score += WEIGHT_TABLE[r][c];
      else if (bd[r][c] === BLACK) score -= WEIGHT_TABLE[r][c];
    }
  // Mobility bonus
  const wMoves = getValidMoves(bd, WHITE).length;
  const bMoves = getValidMoves(bd, BLACK).length;
  score += (wMoves - bMoves) * 5;
  return score;
}

// ── Stats persistence ──────────────────────────────────────────────────────
function loadStats() {
  try {
    const saved = localStorage.getItem('othello-stats');
    if (saved) stats = { ...stats, ...JSON.parse(saved) };
  } catch (e) { /* ignore */ }
  updateStatsDisplay();
}

function saveStats() {
  try { localStorage.setItem('othello-stats', JSON.stringify(stats)); } catch (e) {}
}

function updateStatsDisplay() {
  ['wins', 'losses', 'draws'].forEach(key => {
    // Update both start screen and result screen stat displays
    const startEl  = $(`start-stat-${key}`);
    const resultEl = $(`result-stat-${key}`);
    if (startEl)  startEl.textContent  = stats[key];
    if (resultEl) resultEl.textContent = stats[key];
  });
}

// ── UI bindings ────────────────────────────────────────────────────────────
function bindUI() {
  // Difficulty pills
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.dataset.diff;
    });
  });

  // Start button
  $('start-btn').addEventListener('click', startGame);

  // Play again / home from result
  $('play-again-btn').addEventListener('click', startGame);
  $('home-btn').addEventListener('click', () => {
    gameActive = false;
    showScreen('start');
  });

  // In-game home
  $('game-home-btn').addEventListener('click', () => {
    gameActive = false;
    aiThinking = false;
    showScreen('start');
  });

  // In-game restart (header icon)
  $('game-restart-btn').addEventListener('click', startGame);

  // Footer new game button
  $('footer-new-game-btn').addEventListener('click', startGame);
}
