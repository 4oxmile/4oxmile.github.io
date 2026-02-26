/* ── Constants ── */
const GRID = 15;
const EMPTY = 0, BLACK = 1, WHITE = 2;

/* ── State ── */
let board = [];
let history = []; // [{row, col, player}]
let currentPlayer = BLACK;
let gameOver = false;
let aiThinking = false;
let winLine = null; // [{r,c}, ...]
let lastMove = null; // {r, c}
let stats = loadStats();

/* ── Canvas setup ── */
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
let cellSize = 0;
let padding = 0;

/* ── DOM refs ── */
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const gameScreen = document.getElementById('game-screen');
const statusText = document.getElementById('status-text');
const turnDot = document.getElementById('turn-dot');
const turnLabel = document.getElementById('turn-label');
const resultTitle = document.getElementById('result-title');
const resultSubtitle = document.getElementById('result-subtitle');
const resultEmoji = document.getElementById('result-emoji');
const statWin = document.getElementById('stat-win');
const statLoss = document.getElementById('stat-loss');
const statTotal = document.getElementById('stat-total');
const miniWin = document.getElementById('mini-win');
const miniLoss = document.getElementById('mini-loss');
const miniTotal = document.getElementById('mini-total');

/* ══════════════════════════════════════════
   STATS & STORAGE
══════════════════════════════════════════ */
function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem('omok_stats') || '{}');
    return { wins: s.wins || 0, losses: s.losses || 0, games: s.games || 0 };
  } catch { return { wins: 0, losses: 0, games: 0 }; }
}

function saveStats() {
  localStorage.setItem('omok_stats', JSON.stringify(stats));
}

function updateStatsUI() {
  statWin.textContent = stats.wins;
  statLoss.textContent = stats.losses;
  statTotal.textContent = stats.games;
  miniWin.textContent = stats.wins;
  miniLoss.textContent = stats.losses;
  miniTotal.textContent = stats.games;
}

/* ══════════════════════════════════════════
   BOARD SIZING
══════════════════════════════════════════ */
function resizeCanvas() {
  const wrapper = document.querySelector('.canvas-wrapper');
  const wrapW = wrapper.clientWidth;
  const wrapH = wrapper.clientHeight;
  const size = Math.min(wrapW, wrapH, 460);

  canvas.width = size;
  canvas.height = size;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';

  padding = size / (GRID + 1);
  cellSize = (size - 2 * padding) / (GRID - 1);

  drawBoard();
}

/* ══════════════════════════════════════════
   DRAWING
══════════════════════════════════════════ */
function drawBoard() {
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);

  // Board background
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--board-bg').trim();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 12);
  ctx.fill();

  // Grid lines
  const lineColor = isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 0.8;

  for (let i = 0; i < GRID; i++) {
    const x = padding + i * cellSize;
    const y = padding + i * cellSize;
    // vertical
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, padding + (GRID - 1) * cellSize);
    ctx.stroke();
    // horizontal
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(padding + (GRID - 1) * cellSize, y);
    ctx.stroke();
  }

  // Star points (tengen + 8 hoshi)
  const stars = [3, 7, 11];
  const dotColor = isDark() ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
  for (const r of stars) {
    for (const c of stars) {
      drawDot(r, c, dotColor, cellSize * 0.12);
    }
  }

  // Win line highlight
  if (winLine) {
    ctx.save();
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = cellSize * 0.22;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    const [first, ...rest] = winLine;
    ctx.moveTo(colToX(first.c), rowToY(first.r));
    for (const pt of rest) ctx.lineTo(colToX(pt.c), rowToY(pt.r));
    ctx.stroke();
    ctx.restore();
  }

  // Stones
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (board[r][c] !== EMPTY) {
        drawStone(r, c, board[r][c]);
      }
    }
  }

  // Last move indicator
  if (lastMove && !winLine) {
    const x = colToX(lastMove.c);
    const y = rowToY(lastMove.r);
    const r = cellSize * 0.15;
    ctx.save();
    ctx.fillStyle = lastMove.player === BLACK ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function isDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function colToX(c) { return padding + c * cellSize; }
function rowToY(r) { return padding + r * cellSize; }

function drawDot(r, c, color, radius) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(colToX(c), rowToY(r), radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawStone(r, c, player) {
  const x = colToX(c);
  const y = rowToY(r);
  const radius = cellSize * 0.44;

  ctx.save();
  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = cellSize * 0.3;
  ctx.shadowOffsetX = cellSize * 0.06;
  ctx.shadowOffsetY = cellSize * 0.1;

  if (player === BLACK) {
    const grad = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, radius * 0.05,
      x, y, radius
    );
    grad.addColorStop(0, '#666');
    grad.addColorStop(0.4, '#222');
    grad.addColorStop(1, '#000');
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, radius * 0.05,
      x, y, radius
    );
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.5, '#e8e8e8');
    grad.addColorStop(1, '#bbb');
    ctx.fillStyle = grad;
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Highlight gloss
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  const gloss = ctx.createRadialGradient(
    x - radius * 0.3, y - radius * 0.35, 0,
    x - radius * 0.1, y - radius * 0.1, radius * 0.65
  );
  gloss.addColorStop(0, player === BLACK ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.7)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/* ══════════════════════════════════════════
   GAME LOGIC
══════════════════════════════════════════ */
function initBoard() {
  board = Array.from({ length: GRID }, () => new Array(GRID).fill(EMPTY));
  history = [];
  winLine = null;
  lastMove = null;
  gameOver = false;
  aiThinking = false;
  currentPlayer = BLACK;
}

function inBounds(r, c) {
  return r >= 0 && r < GRID && c >= 0 && c < GRID;
}

const DIRS = [[0,1],[1,0],[1,1],[1,-1]];

function getLine(r, c, dr, dc, player) {
  // Returns array of cells in the line centered at (r,c)
  const cells = [{r, c}];
  for (let step = 1; step < 5; step++) {
    const nr = r + dr * step, nc = c + dc * step;
    if (!inBounds(nr, nc) || board[nr][nc] !== player) break;
    cells.push({r: nr, c: nc});
  }
  for (let step = 1; step < 5; step++) {
    const nr = r - dr * step, nc = c - dc * step;
    if (!inBounds(nr, nc) || board[nr][nc] !== player) break;
    cells.unshift({r: nr, c: nc});
  }
  return cells;
}

function checkWin(r, c, player) {
  for (const [dr, dc] of DIRS) {
    const cells = getLine(r, c, dr, dc, player);
    if (cells.length >= 5) return cells.slice(0, 5);
  }
  return null;
}

function placePiece(r, c, player) {
  board[r][c] = player;
  history.push({ r, c, player });
  lastMove = { r, c, player };

  const win = checkWin(r, c, player);
  if (win) {
    winLine = win;
    gameOver = true;
    return 'win';
  }

  // Check draw
  const full = board.every(row => row.every(cell => cell !== EMPTY));
  if (full) {
    gameOver = true;
    return 'draw';
  }

  return 'continue';
}

/* ── Undo ── */
function undoMove() {
  if (gameOver || aiThinking || history.length < 2) return;

  // Remove AI move + player move
  const aiMove = history.pop();
  board[aiMove.r][aiMove.c] = EMPTY;
  const playerMove = history.pop();
  board[playerMove.r][playerMove.c] = EMPTY;

  lastMove = history.length > 0 ? history[history.length - 1] : null;
  winLine = null;
  currentPlayer = BLACK;
  drawBoard();
  setStatus('당신의 차례 (흑)', false);
}

/* ══════════════════════════════════════════
   AI (HEURISTIC SCORING)
══════════════════════════════════════════ */

// Score table: [open ends 0|1|2][count 1..5]
const SCORES = {
  attack: [0, 10, 100, 1000, 50000, 999999],
  defend: [0,  5,  50,  500, 25000, 999999]
};

function scoreDir(r, c, dr, dc, player) {
  const opponent = player === WHITE ? BLACK : WHITE;
  let count = 1;
  let openEnds = 0;
  let blocked = 0;

  // Forward
  let nr = r + dr, nc = c + dc;
  while (inBounds(nr, nc) && board[nr][nc] === player) {
    count++;
    nr += dr; nc += dc;
  }
  if (inBounds(nr, nc) && board[nr][nc] === EMPTY) openEnds++;
  else if (!inBounds(nr, nc) || board[nr][nc] === opponent) blocked++;

  // Backward
  nr = r - dr; nc = c - dc;
  while (inBounds(nr, nc) && board[nr][nc] === player) {
    count++;
    nr -= dr; nc -= dc;
  }
  if (inBounds(nr, nc) && board[nr][nc] === EMPTY) openEnds++;
  else if (!inBounds(nr, nc) || board[nr][nc] === opponent) blocked++;

  if (count >= 5) return { count, openEnds };
  if (blocked === 2) return { count: 0, openEnds: 0 }; // fully blocked
  return { count, openEnds };
}

function evalCell(r, c, player) {
  if (board[r][c] !== EMPTY) return -1;
  let score = 0;
  board[r][c] = player;
  for (const [dr, dc] of DIRS) {
    const { count, openEnds } = scoreDir(r, c, dr, dc, player);
    if (count >= 5) { score += 999999; continue; }
    const base = SCORES.attack[count] || 0;
    score += base * (openEnds === 2 ? 2 : 1);
  }
  board[r][c] = EMPTY;
  return score;
}

function evalCellDefend(r, c) {
  if (board[r][c] !== EMPTY) return -1;
  let score = 0;
  board[r][c] = BLACK; // simulate player move
  for (const [dr, dc] of DIRS) {
    const { count, openEnds } = scoreDir(r, c, dr, dc, BLACK);
    if (count >= 5) { score += 999999; continue; }
    const base = SCORES.defend[count] || 0;
    score += base * (openEnds === 2 ? 2 : 1);
  }
  board[r][c] = EMPTY;
  return score;
}

function aiMove() {
  let bestScore = -1;
  let bestCells = [];

  // Find candidates: cells adjacent to existing stones
  const candidates = new Set();
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (board[r][c] !== EMPTY) {
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = r + dr, nc = c + dc;
            if (inBounds(nr, nc) && board[nr][nc] === EMPTY) {
              candidates.add(nr * GRID + nc);
            }
          }
        }
      }
    }
  }

  // If board is empty, play near center
  if (candidates.size === 0) {
    const center = Math.floor(GRID / 2);
    const offset = Math.floor(Math.random() * 3) - 1;
    return { r: center + offset, c: center + offset };
  }

  for (const key of candidates) {
    const r = Math.floor(key / GRID);
    const c = key % GRID;

    const attackScore = evalCell(r, c, WHITE);
    const defendScore = evalCellDefend(r, c);

    // Check if AI wins immediately
    if (attackScore >= 999999) return { r, c };

    // Blend: slightly prefer attacking but don't ignore critical defense
    const combined = attackScore + defendScore * 0.9;

    if (combined > bestScore) {
      bestScore = combined;
      bestCells = [{ r, c }];
    } else if (combined === bestScore) {
      bestCells.push({ r, c });
    }
  }

  // Break ties randomly for variety
  return bestCells[Math.floor(Math.random() * bestCells.length)];
}

/* ══════════════════════════════════════════
   GAME FLOW
══════════════════════════════════════════ */
function startGame() {
  initBoard();
  updateStatsUI();
  showScreen('game');
  resizeCanvas();
  setStatus('당신의 차례 (흑)', false);
  canvas.classList.remove('disabled');
}

function setStatus(text, thinking) {
  if (thinking) {
    statusText.innerHTML = `<span class="thinking-dots"><span></span><span></span><span></span></span> AI 생각 중`;
    turnDot.className = 'stone-dot white';
    turnLabel.textContent = 'AI (백)';
  } else if (gameOver) {
    statusText.textContent = text;
  } else {
    statusText.textContent = text;
    turnDot.className = 'stone-dot black';
    turnLabel.textContent = '당신 (흑)';
  }
}

function showScreen(which) {
  startScreen.classList.toggle('hidden', which !== 'start');
  resultScreen.classList.toggle('hidden', which !== 'result');
  // game screen is always visible
}

function handleWin(result, playerIsWinner) {
  stats.games++;
  if (result === 'win' && playerIsWinner) { stats.wins++; }
  else if (result === 'win' && !playerIsWinner) { stats.losses++; }
  saveStats();
  updateStatsUI();

  setTimeout(() => {
    drawBoard(); // draw win line
    if (result === 'draw') {
      resultEmoji.textContent = '🤝';
      resultTitle.textContent = '무승부';
      resultTitle.className = 'result-title';
      resultSubtitle.textContent = '팽팽한 승부였습니다!';
    } else if (playerIsWinner) {
      resultEmoji.textContent = '🎉';
      resultTitle.textContent = '승리!';
      resultTitle.className = 'result-title win';
      resultSubtitle.textContent = '축하합니다! AI를 이겼습니다.';
    } else {
      resultEmoji.textContent = '💭';
      resultTitle.textContent = '패배';
      resultTitle.className = 'result-title lose';
      resultSubtitle.textContent = '다시 도전해보세요.';
    }
    showScreen('result');
  }, 600);
}

/* ══════════════════════════════════════════
   INPUT HANDLING
══════════════════════════════════════════ */
function getCell(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;

  const c = Math.round((x - padding) / cellSize);
  const r = Math.round((y - padding) / cellSize);
  if (r < 0 || r >= GRID || c < 0 || c >= GRID) return null;
  return { r, c };
}

function handleTap(clientX, clientY) {
  if (gameOver || aiThinking || currentPlayer !== BLACK) return;
  const cell = getCell(clientX, clientY);
  if (!cell) return;
  const { r, c } = cell;
  if (board[r][c] !== EMPTY) return;

  const result = placePiece(r, c, BLACK);
  drawBoard();

  if (result === 'win') {
    handleWin('win', true);
    return;
  }
  if (result === 'draw') {
    handleWin('draw', false);
    return;
  }

  // AI turn
  currentPlayer = WHITE;
  canvas.classList.add('disabled');
  setStatus('', true);

  setTimeout(() => {
    const move = aiMove();
    const aiResult = placePiece(move.r, move.c, WHITE);
    currentPlayer = BLACK;
    canvas.classList.remove('disabled');
    drawBoard();

    if (aiResult === 'win') {
      handleWin('win', false);
    } else if (aiResult === 'draw') {
      handleWin('draw', false);
    } else {
      setStatus('당신의 차례 (흑)', false);
    }
  }, 200);
}

canvas.addEventListener('click', e => {
  handleTap(e.clientX, e.clientY);
});

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  handleTap(t.clientX, t.clientY);
}, { passive: false });

/* ══════════════════════════════════════════
   BUTTON HANDLERS
══════════════════════════════════════════ */
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-play-again').addEventListener('click', startGame);
document.getElementById('btn-home').addEventListener('click', () => {
  updateStatsUI();
  showScreen('start');
});
document.getElementById('btn-home-result').addEventListener('click', () => {
  updateStatsUI();
  showScreen('start');
});
document.getElementById('btn-undo').addEventListener('click', undoMove);
document.getElementById('btn-restart').addEventListener('click', startGame);

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
window.addEventListener('resize', () => {
  if (!startScreen.classList.contains('hidden') === false) return; // on game screen
  resizeCanvas();
});

// Observe media query for redraw
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawBoard);

updateStatsUI();
showScreen('start');
