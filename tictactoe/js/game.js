'use strict';

// ──────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────
const PLAYER = 'X';
const AI = 'O';
const EMPTY = null;

const WIN_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

// Line coords as percentages of board [x1%, y1%, x2%, y2%]
const LINE_COORDS = {
  '0,1,2': [16.5, 16.5, 83.5, 16.5],
  '3,4,5': [16.5, 50,   83.5, 50],
  '6,7,8': [16.5, 83.5, 83.5, 83.5],
  '0,3,6': [16.5, 16.5, 16.5, 83.5],
  '1,4,7': [50,   16.5, 50,   83.5],
  '2,5,8': [83.5, 16.5, 83.5, 83.5],
  '0,4,8': [16.5, 16.5, 83.5, 83.5],
  '2,4,6': [83.5, 16.5, 16.5, 83.5],
};

const DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
};

const DIFFICULTY_LABEL = {
  easy: '쉬움',
  medium: '보통',
  hard: '어려움',
};

// ──────────────────────────────────────
// STATE
// ──────────────────────────────────────
let board = Array(9).fill(EMPTY);
let currentTurn = PLAYER;
let gameActive = false;
let difficulty = DIFFICULTY.HARD;
let score = { wins: 0, losses: 0, draws: 0 };
let aiThinkTimer = null;

// ──────────────────────────────────────
// DOM REFS
// ──────────────────────────────────────
const startScreen    = document.getElementById('start-screen');
const resultScreen   = document.getElementById('result-screen');
const cells          = document.querySelectorAll('.cell');
const statusDot      = document.getElementById('status-dot');
const statusText     = document.getElementById('status-text');
const scoreWins      = document.getElementById('score-wins');
const scoreLosses    = document.getElementById('score-losses');
const scoreDraws     = document.getElementById('score-draws');
const diffBtns       = document.querySelectorAll('.diff-btn');
const winLineOverlay = document.getElementById('win-line-overlay');

const resultEmoji    = document.getElementById('result-emoji');
const resultTitle    = document.getElementById('result-title');
const resultSubtitle = document.getElementById('result-subtitle');

// ──────────────────────────────────────
// INIT
// ──────────────────────────────────────
function init() {
  loadScore();
  renderScore();
  updateDiffButtons();

  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-new').addEventListener('click', startGame);
  document.getElementById('btn-menu').addEventListener('click', goToMenu);
  document.getElementById('btn-result-new').addEventListener('click', startGame);
  document.getElementById('btn-result-menu').addEventListener('click', goToMenu);

  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      difficulty = btn.dataset.diff;
      updateDiffButtons();
    });
  });

  cells.forEach((cell, idx) => {
    cell.addEventListener('click', () => handleCellClick(idx));
  });
}

// ──────────────────────────────────────
// SCORE PERSISTENCE
// ──────────────────────────────────────
function loadScore() {
  try {
    const saved = localStorage.getItem('ttt_score');
    if (saved) score = JSON.parse(saved);
  } catch (_) {
    score = { wins: 0, losses: 0, draws: 0 };
  }
}

function saveScore() {
  try {
    localStorage.setItem('ttt_score', JSON.stringify(score));
  } catch (_) {}
}

function renderScore() {
  scoreWins.textContent   = score.wins;
  scoreLosses.textContent = score.losses;
  scoreDraws.textContent  = score.draws;
}

// ──────────────────────────────────────
// SCREEN MANAGEMENT
// ──────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  if (id) {
    document.getElementById(id).classList.remove('hidden');
  }
}

function goToMenu() {
  clearAiTimer();
  gameActive = false;
  showScreen('start-screen');
}

// ──────────────────────────────────────
// GAME FLOW
// ──────────────────────────────────────
function startGame() {
  clearAiTimer();
  board = Array(9).fill(EMPTY);
  currentTurn = PLAYER;
  gameActive = true;

  clearBoard();
  clearWinLine();
  showScreen(null);
  setStatus('player');
}

function clearBoard() {
  cells.forEach(cell => {
    cell.classList.remove('taken', 'winning');
    const mark = cell.querySelector('.cell-mark');
    mark.textContent = '';
    mark.className = 'cell-mark';
  });
}

function handleCellClick(idx) {
  if (!gameActive) return;
  if (currentTurn !== PLAYER) return;
  if (board[idx] !== EMPTY) return;

  placeMove(idx, PLAYER);

  const result = checkResult();
  if (result) {
    endGame(result);
    return;
  }

  currentTurn = AI;
  setStatus('ai');
  scheduleAiMove();
}

function placeMove(idx, who) {
  board[idx] = who;
  const cell = cells[idx];
  const mark = cell.querySelector('.cell-mark');
  mark.textContent = who;
  mark.className = `cell-mark ${who === PLAYER ? 'x-mark' : 'o-mark'}`;
  cell.classList.add('taken');
  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => mark.classList.add('visible'));
  });
}

function scheduleAiMove() {
  // Small delay so player can see status change
  const delay = difficulty === DIFFICULTY.EASY ? 400 : 600;
  aiThinkTimer = setTimeout(doAiMove, delay);
}

function clearAiTimer() {
  if (aiThinkTimer !== null) {
    clearTimeout(aiThinkTimer);
    aiThinkTimer = null;
  }
}

function doAiMove() {
  if (!gameActive) return;
  const idx = getAiMove();
  if (idx === -1) return;

  placeMove(idx, AI);

  const result = checkResult();
  if (result) {
    endGame(result);
    return;
  }

  currentTurn = PLAYER;
  setStatus('player');
}

// ──────────────────────────────────────
// AI DIFFICULTY
// ──────────────────────────────────────
function getAiMove() {
  const empty = board.reduce((acc, v, i) => v === EMPTY ? [...acc, i] : acc, []);
  if (empty.length === 0) return -1;

  if (difficulty === DIFFICULTY.EASY) {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  if (difficulty === DIFFICULTY.MEDIUM) {
    // 50% chance of best move, otherwise random
    if (Math.random() < 0.5) {
      return minimaxBestMove();
    }
    return empty[Math.floor(Math.random() * empty.length)];
  }

  // HARD: always minimax
  return minimaxBestMove();
}

function minimaxBestMove() {
  let bestVal = -Infinity;
  let bestIdx = -1;

  for (let i = 0; i < 9; i++) {
    if (board[i] !== EMPTY) continue;
    board[i] = AI;
    const val = minimax(board, 0, false, -Infinity, Infinity);
    board[i] = EMPTY;
    if (val > bestVal) {
      bestVal = val;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function minimax(b, depth, isMaximizing, alpha, beta) {
  const winner = getWinner(b);
  if (winner === AI)     return 10 - depth;
  if (winner === PLAYER) return depth - 10;
  if (b.every(v => v !== EMPTY)) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] !== EMPTY) continue;
      b[i] = AI;
      best = Math.max(best, minimax(b, depth + 1, false, alpha, beta));
      b[i] = EMPTY;
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i] !== EMPTY) continue;
      b[i] = PLAYER;
      best = Math.min(best, minimax(b, depth + 1, true, alpha, beta));
      b[i] = EMPTY;
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ──────────────────────────────────────
// WIN / DRAW DETECTION
// ──────────────────────────────────────
function getWinner(b) {
  for (const [a, c, d] of WIN_COMBOS) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return null;
}

function getWinCombo(b) {
  for (const combo of WIN_COMBOS) {
    const [a, c, d] = combo;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return combo;
  }
  return null;
}

function checkResult() {
  const winner = getWinner(board);
  if (winner) return { type: 'win', who: winner, combo: getWinCombo(board) };
  if (board.every(v => v !== EMPTY)) return { type: 'draw' };
  return null;
}

// ──────────────────────────────────────
// END GAME
// ──────────────────────────────────────
function endGame(result) {
  gameActive = false;

  if (result.type === 'win') {
    highlightWinners(result.combo);
    drawWinLine(result.combo, result.who);

    if (result.who === PLAYER) {
      score.wins++;
      showResult('win');
    } else {
      score.losses++;
      showResult('lose');
    }
  } else {
    score.draws++;
    showResult('draw');
  }

  saveScore();
  renderScore();
}

function highlightWinners(combo) {
  combo.forEach(idx => cells[idx].classList.add('winning'));
}

function drawWinLine(combo, who) {
  const key = combo.join(',');
  const coords = LINE_COORDS[key];
  if (!coords) return;

  const [x1p, y1p, x2p, y2p] = coords;

  clearWinLine();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('win-line-svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', x1p);
  line.setAttribute('y1', y1p);
  line.setAttribute('x2', x2p);
  line.setAttribute('y2', y2p);
  line.classList.add('win-line-path', who === PLAYER ? 'x-line' : 'o-line');

  svg.appendChild(line);
  winLineOverlay.appendChild(svg);
}

function clearWinLine() {
  winLineOverlay.innerHTML = '';
}

// ──────────────────────────────────────
// RESULT OVERLAY
// ──────────────────────────────────────
const RESULT_CONFIG = {
  win: {
    emoji: '🏆',
    title: '승리!',
    titleClass: 'win',
    subtitle: 'AI를 이겼습니다! 대단해요!',
  },
  lose: {
    emoji: '😢',
    title: '패배',
    titleClass: 'lose',
    subtitle: 'AI가 이겼습니다. 다시 도전해보세요!',
  },
  draw: {
    emoji: '🤝',
    title: '무승부',
    titleClass: 'draw',
    subtitle: '팽팽한 대결이었습니다!',
  },
};

function showResult(type) {
  const cfg = RESULT_CONFIG[type];
  resultEmoji.textContent = cfg.emoji;
  resultTitle.textContent = cfg.title;
  resultTitle.className = `result-title ${cfg.titleClass}`;
  resultSubtitle.textContent = cfg.subtitle;

  setTimeout(() => showScreen('result-screen'), 700);
}

// ──────────────────────────────────────
// STATUS BAR
// ──────────────────────────────────────
function setStatus(who) {
  if (who === 'player') {
    statusDot.className = 'status-indicator player-turn';
    statusText.className = 'status-text player-turn';
    statusText.innerHTML = '당신의 차례 (X)';
  } else {
    statusDot.className = 'status-indicator ai-turn';
    statusText.className = 'status-text ai-turn';
    statusText.innerHTML = 'AI 생각 중 <span class="thinking-dots"><span></span><span></span><span></span></span>';
  }
}

// ──────────────────────────────────────
// DIFFICULTY BUTTONS
// ──────────────────────────────────────
function updateDiffButtons() {
  diffBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.diff === difficulty);
  });
  const diffLabel = document.getElementById('current-diff');
  if (diffLabel) diffLabel.textContent = DIFFICULTY_LABEL[difficulty];
}

// ──────────────────────────────────────
// BOOTSTRAP
// ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
