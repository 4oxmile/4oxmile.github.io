// ── Constants ──
const ROWS = 6;
const COLS = 7;
const PLAYER = 1;
const AI = 2;
const EMPTY = 0;

const DIFFICULTY = {
  easy:   { depth: 2, label: '쉬움' },
  normal: { depth: 4, label: '보통' },
  hard:   { depth: 6, label: '어려움' },
};

// ── State ──
let board = [];
let currentTurn = PLAYER;
let gameActive = false;
let isAIThinking = false;
let selectedDifficulty = 'normal';
let stats = { wins: 0, losses: 0, draws: 0 };
let hoveredCol = -1;

// ── DOM refs ──
const startOverlay    = document.getElementById('start-overlay');
const resultOverlay   = document.getElementById('result-overlay');
const gameContainer   = document.getElementById('game-container');
const boardEl         = document.getElementById('board');
const turnDisc        = document.getElementById('turn-disc');
const turnText        = document.getElementById('turn-text');
const turnHint        = document.getElementById('turn-hint');
const resultIcon      = document.getElementById('result-icon');
const resultTitle     = document.getElementById('result-title');
const resultSubtitle  = document.getElementById('result-subtitle');
const statWins        = document.getElementById('stat-wins');
const statLosses      = document.getElementById('stat-losses');
const statDraws       = document.getElementById('stat-draws');

// ── Init ──
function init() {
  loadStats();
  renderStats();
  buildBoard();
  setupDifficultyBtns();
  showStartScreen();
}

function loadStats() {
  try {
    const saved = localStorage.getItem('connect4-stats');
    if (saved) stats = JSON.parse(saved);
  } catch (_) {}
}

function saveStats() {
  try {
    localStorage.setItem('connect4-stats', JSON.stringify(stats));
  } catch (_) {}
}

function renderStats() {
  statWins.textContent   = stats.wins;
  statLosses.textContent = stats.losses;
  statDraws.textContent  = stats.draws;

  // Update in-game mini stats too
  const mini = document.querySelectorAll('.mini-stat-val');
  if (mini.length >= 3) {
    mini[0].textContent = stats.wins;
    mini[1].textContent = stats.losses;
    mini[2].textContent = stats.draws;
  }
}

// ── Board Building ──
function buildBoard() {
  boardEl.innerHTML = '';
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      const disc = document.createElement('div');
      disc.className = 'disc';
      cell.appendChild(disc);

      boardEl.appendChild(cell);
    }
  }

  // Build hover zones over columns
  buildHoverZones();
}

function buildHoverZones() {
  const wrapper = document.querySelector('.board-wrapper');
  // Remove old zones
  wrapper.querySelectorAll('.col-hover-zone').forEach(z => z.remove());

  // We'll create zones after board is rendered (need positions)
  requestAnimationFrame(() => {
    const boardRect = boardEl.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();

    for (let c = 0; c < COLS; c++) {
      const cellEl = getCell(0, c);
      if (!cellEl) continue;
      const cellRect = cellEl.getBoundingClientRect();

      const zone = document.createElement('div');
      zone.className = 'col-hover-zone';
      zone.dataset.col = c;
      zone.style.left   = (cellRect.left - wrapperRect.left) + 'px';
      zone.style.width  = cellRect.width + 'px';
      zone.style.top    = (boardRect.top - wrapperRect.top) + 'px';
      zone.style.height = boardRect.height + 'px';

      zone.addEventListener('mouseenter', () => onColHover(c));
      zone.addEventListener('mouseleave', () => onColLeave());
      zone.addEventListener('click', () => onColClick(c));
      zone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        onColClick(c);
      }, { passive: false });

      wrapper.appendChild(zone);
    }
  });
}

function getCell(row, col) {
  return boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
}

// ── Screens ──
function showStartScreen() {
  startOverlay.classList.remove('hidden');
  resultOverlay.classList.add('hidden');
  renderStats();
}

function hideStartScreen() {
  startOverlay.classList.add('hidden');
}

function showResultScreen(type) {
  // type: 'win' | 'loss' | 'draw'
  resultOverlay.classList.remove('hidden');

  if (type === 'win') {
    resultIcon.textContent = '🏆';
    resultTitle.textContent = '승리!';
    resultTitle.className = 'result-title win';
    resultSubtitle.textContent = '4개를 연결했습니다!';
    stats.wins++;
  } else if (type === 'loss') {
    resultIcon.textContent = '😔';
    resultTitle.textContent = '패배...';
    resultTitle.className = 'result-title loss';
    resultSubtitle.textContent = 'AI가 4개를 연결했습니다.';
    stats.losses++;
  } else {
    resultIcon.textContent = '🤝';
    resultTitle.textContent = '무승부!';
    resultTitle.className = 'result-title draw';
    resultSubtitle.textContent = '보드가 가득 찼습니다.';
    stats.draws++;
  }

  saveStats();
  renderStats();
}

// ── Difficulty ──
function setupDifficultyBtns() {
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDifficulty = btn.dataset.diff;
    });
  });
}

// ── Game Start ──
function startGame() {
  hideStartScreen();
  resultOverlay.classList.add('hidden');
  buildBoard();
  currentTurn = PLAYER;
  gameActive = true;
  isAIThinking = false;
  updateTurnIndicator();
}

// ── Turn Indicator ──
function updateTurnIndicator() {
  if (!gameActive) return;

  if (currentTurn === PLAYER) {
    turnDisc.className = 'turn-disc player';
    turnText.textContent = '당신의 차례';
    turnHint.innerHTML = '';
  } else {
    turnDisc.className = 'turn-disc ai';
    turnText.textContent = 'AI 생각 중';
    turnHint.innerHTML = '<span class="thinking-dots"><span></span><span></span><span></span></span>';
  }
}

// ── Hover Preview ──
function onColHover(col) {
  if (!gameActive || currentTurn !== PLAYER || isAIThinking) return;
  hoveredCol = col;
  clearPreview();
  const row = getLowestEmpty(board, col);
  if (row === -1) return;
  const cell = getCell(row, col);
  if (cell) cell.classList.add('preview-player');
}

function onColLeave() {
  hoveredCol = -1;
  clearPreview();
}

function clearPreview() {
  boardEl.querySelectorAll('.preview-player, .preview-ai').forEach(c => {
    c.classList.remove('preview-player', 'preview-ai');
  });
}

// ── Column Click ──
function onColClick(col) {
  if (!gameActive || currentTurn !== PLAYER || isAIThinking) return;
  clearPreview();
  makeMove(col, PLAYER);
}

// ── Make Move ──
function makeMove(col, who) {
  const row = getLowestEmpty(board, col);
  if (row === -1) return; // column full

  board[row][col] = who;
  dropDisc(row, col, who);

  // Check result
  const winning = checkWin(board, who);
  if (winning) {
    gameActive = false;
    setTimeout(() => {
      highlightWin(winning, who);
      setTimeout(() => showResultScreen(who === PLAYER ? 'win' : 'loss'), 700);
    }, 420);
    return;
  }

  if (isBoardFull(board)) {
    gameActive = false;
    setTimeout(() => showResultScreen('draw'), 420);
    return;
  }

  currentTurn = who === PLAYER ? AI : PLAYER;
  updateTurnIndicator();

  if (currentTurn === AI) {
    isAIThinking = true;
    // Small delay so UI updates before heavy computation
    setTimeout(() => {
      const aiCol = getBestMove(board, DIFFICULTY[selectedDifficulty].depth);
      isAIThinking = false;
      if (gameActive) makeMove(aiCol, AI);
    }, 180);
  }
}

// ── Drop Animation ──
function dropDisc(row, col, who) {
  const cell = getCell(row, col);
  if (!cell) return;
  const disc = cell.querySelector('.disc');
  disc.className = 'disc ' + (who === PLAYER ? 'player' : 'ai');

  // Calculate how far to drop (in cell units)
  const distance = (row + 1) * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell-size')) + 5);
  disc.style.setProperty('--drop-distance', distance + 'px');

  disc.classList.add('dropping');
  disc.addEventListener('animationend', () => {
    disc.classList.remove('dropping');
    disc.classList.add('placed');
  }, { once: true });
}

// ── Win Highlight ──
function highlightWin(cells, who) {
  const cls = who === PLAYER ? 'player-win' : 'ai-win';
  cells.forEach(([r, c]) => {
    const cell = getCell(r, c);
    if (cell) cell.classList.add('winning', cls);
  });
}

// ── Board Logic ──
function getLowestEmpty(b, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (b[r][col] === EMPTY) return r;
  }
  return -1;
}

function isBoardFull(b) {
  return b[0].every(cell => cell !== EMPTY);
}

function checkWin(b, who) {
  // Returns array of winning [row,col] pairs or null
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (b[r][c] !== who) continue;
      for (const [dr, dc] of dirs) {
        const cells = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || b[nr][nc] !== who) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return cells;
      }
    }
  }
  return null;
}

// ── AI: Minimax with Alpha-Beta Pruning ──
function getBestMove(b, depth) {
  // Check immediate wins / blocks first for speed
  for (let c = 0; c < COLS; c++) {
    const r = getLowestEmpty(b, c);
    if (r === -1) continue;
    b[r][c] = AI;
    if (checkWin(b, AI)) { b[r][c] = EMPTY; return c; }
    b[r][c] = EMPTY;
  }
  for (let c = 0; c < COLS; c++) {
    const r = getLowestEmpty(b, c);
    if (r === -1) continue;
    b[r][c] = PLAYER;
    if (checkWin(b, PLAYER)) { b[r][c] = EMPTY; return c; }
    b[r][c] = EMPTY;
  }

  // Center column preference order
  const order = [3, 2, 4, 1, 5, 0, 6];
  let bestScore = -Infinity;
  let bestCol = order.find(c => getLowestEmpty(b, c) !== -1) ?? 3;

  for (const col of order) {
    const row = getLowestEmpty(b, col);
    if (row === -1) continue;
    b[row][col] = AI;
    const score = minimax(b, depth - 1, -Infinity, Infinity, false);
    b[row][col] = EMPTY;
    if (score > bestScore) {
      bestScore = score;
      bestCol = col;
    }
  }
  return bestCol;
}

function minimax(b, depth, alpha, beta, maximizing) {
  const aiWin = checkWin(b, AI);
  if (aiWin) return 100000 + depth;
  const playerWin = checkWin(b, PLAYER);
  if (playerWin) return -(100000 + depth);
  if (isBoardFull(b) || depth === 0) return heuristicScore(b);

  const order = [3, 2, 4, 1, 5, 0, 6];

  if (maximizing) {
    let best = -Infinity;
    for (const col of order) {
      const row = getLowestEmpty(b, col);
      if (row === -1) continue;
      b[row][col] = AI;
      const score = minimax(b, depth - 1, alpha, beta, false);
      b[row][col] = EMPTY;
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const col of order) {
      const row = getLowestEmpty(b, col);
      if (row === -1) continue;
      b[row][col] = PLAYER;
      const score = minimax(b, depth - 1, alpha, beta, true);
      b[row][col] = EMPTY;
      best = Math.min(best, score);
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ── Heuristic ──
function heuristicScore(b) {
  let score = 0;

  // Center column bonus
  for (let r = 0; r < ROWS; r++) {
    if (b[r][3] === AI) score += 4;
    if (b[r][3] === PLAYER) score -= 4;
  }

  // Evaluate all windows of 4
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of dirs) {
        const window = [];
        for (let k = 0; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            window.push(b[nr][nc]);
          }
        }
        if (window.length === 4) score += scoreWindow(window);
      }
    }
  }
  return score;
}

function scoreWindow(w) {
  const ai     = w.filter(x => x === AI).length;
  const player = w.filter(x => x === PLAYER).length;
  const empty  = w.filter(x => x === EMPTY).length;

  if (ai === 4) return 500;
  if (ai === 3 && empty === 1) return 50;
  if (ai === 2 && empty === 2) return 10;
  if (player === 4) return -500;
  if (player === 3 && empty === 1) return -80;
  if (player === 2 && empty === 2) return -15;
  return 0;
}

// ── Global handlers ──
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', startGame);
document.getElementById('back-btn').addEventListener('click', showStartScreen);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('menu-btn').addEventListener('click', showStartScreen);

// Window resize: rebuild hover zones
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (gameActive) buildHoverZones();
  }, 200);
});

// ── Bootstrap ──
init();
