/* ============================================================
   BATTLESHIP - game.js
   1P vs AI, 10x10 grid, standard ship set
   ============================================================ */

'use strict';

// ── Constants ────────────────────────────────────────────────
const GRID_SIZE = 10;
const SHIPS_CONFIG = [
  { name: '항공모함', size: 5 },
  { name: '전함',   size: 4 },
  { name: '순양함', size: 3 },
  { name: '구축함', size: 3 },
  { name: '잠수함', size: 2 },
];

// ── State ─────────────────────────────────────────────────────
let state = {};

function freshState() {
  return {
    // boards: 2D arrays [row][col]
    //   0 = empty, 1 = ship, -1 = miss, 2 = hit, 3 = sunk-part
    playerBoard: makeBoard(),
    enemyBoard:  makeBoard(),
    playerShips: [],   // {id, cells:[], sunk}
    enemyShips:  [],
    placedCount: 0,
    currentShipIdx: 0,
    orientation: 'H',  // H | V
    phase: 'start',    // start | place | game | result
    turn: 'player',
    // AI state
    ai: {
      mode: 'hunt',     // hunt | target
      hits: [],         // ordered hits on same ship
      candidates: [],   // cells to try next
      lastHit: null,
    },
    // stats for this game
    playerShots: 0,
    playerHits: 0,
    aiShots: 0,
    aiHits: 0,
    won: null,  // true = player won
  };
}

// ── Persistent stats ─────────────────────────────────────────
function loadStats() {
  try {
    return JSON.parse(localStorage.getItem('bs_stats') || '{"wins":0,"losses":0,"games":0}');
  } catch { return { wins: 0, losses: 0, games: 0 }; }
}

function saveStats(won) {
  const s = loadStats();
  s.games++;
  if (won) s.wins++; else s.losses++;
  localStorage.setItem('bs_stats', JSON.stringify(s));
}

// ── Board helpers ─────────────────────────────────────────────
function makeBoard() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

function inBounds(r, c) {
  return r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;
}

function cellsForShip(row, col, size, orientation) {
  const cells = [];
  for (let i = 0; i < size; i++) {
    const r = orientation === 'H' ? row : row + i;
    const c = orientation === 'H' ? col + i : col;
    cells.push([r, c]);
  }
  return cells;
}

function canPlace(board, cells) {
  for (const [r, c] of cells) {
    if (!inBounds(r, c)) return false;
    if (board[r][c] !== 0) return false;
    // check adjacency (no touching ships)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc] === 1) return false;
      }
    }
  }
  return true;
}

function placeShip(board, cells, shipList, id) {
  for (const [r, c] of cells) board[r][c] = 1;
  shipList.push({ id, cells: cells.map(([r, c]) => ({ r, c })), sunk: false });
}

// ── Random placement ──────────────────────────────────────────
function randomPlacement(board, shipsConfig) {
  const ships = [];
  const b = makeBoard();
  for (let idx = 0; idx < shipsConfig.length; idx++) {
    const { size } = shipsConfig[idx];
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 1000) {
      attempts++;
      const ori = Math.random() < 0.5 ? 'H' : 'V';
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      const cells = cellsForShip(row, col, size, ori);
      if (canPlace(b, cells)) {
        placeShip(b, cells, ships, idx);
        placed = true;
      }
    }
  }
  // copy to given board
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      board[r][c] = b[r][c];
  return ships;
}

// ── DOM shortcuts ─────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Screens ───────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(name + '-screen').classList.add('active');
  state.phase = name;
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, cls = '') {
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = 'toast' + (cls ? ' ' + cls : '');
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2100);
}

// ── Status bar ────────────────────────────────────────────────
function setStatus(msg, cls = '') {
  const bar = $('status-bar');
  bar.innerHTML = msg;
  bar.className = 'status-bar' + (cls ? ' ' + cls : '');
}

// ── Build grid DOM ─────────────────────────────────────────────
function buildGrid(containerId, isEnemy) {
  const container = $(containerId);
  container.innerHTML = '';

  const cols = 'ABCDEFGHIJ';

  // corner
  const corner = document.createElement('div');
  corner.className = 'axis-label corner';
  container.appendChild(corner);

  // col labels A-J
  for (let c = 0; c < GRID_SIZE; c++) {
    const lbl = document.createElement('div');
    lbl.className = 'axis-label';
    lbl.textContent = cols[c];
    container.appendChild(lbl);
  }

  for (let r = 0; r < GRID_SIZE; r++) {
    // row label
    const rowLbl = document.createElement('div');
    rowLbl.className = 'axis-label';
    rowLbl.textContent = r + 1;
    container.appendChild(rowLbl);

    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;

      if (isEnemy) {
        cell.addEventListener('click', () => handleEnemyClick(r, c));
      } else {
        cell.addEventListener('click', () => handlePlaceClick(r, c));
        cell.addEventListener('mouseenter', () => handlePlaceHover(r, c));
        cell.addEventListener('touchstart', (e) => {
          e.preventDefault();
          handlePlaceClick(r, c);
        }, { passive: false });
      }
      container.appendChild(cell);
    }
  }
}

function getCell(containerId, r, c) {
  return $(containerId).querySelector(`[data-r="${r}"][data-c="${c}"]`);
}

// ── Render boards ─────────────────────────────────────────────
function renderPlayerBoard() {
  const board = state.playerBoard;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = getCell('player-board', r, c);
      if (!cell) continue;
      cell.className = 'cell';
      cell.innerHTML = '';
      const v = board[r][c];
      if (v === 1) cell.classList.add('ship');
      else if (v === -1) cell.classList.add('miss');
      else if (v === 2) {
        cell.classList.add('hit');
        cell.innerHTML = '<span class="marker">✕</span>';
      } else if (v === 3) {
        cell.classList.add('sunk');
        cell.innerHTML = '<span class="marker">✕</span>';
      }
    }
  }
}

function renderEnemyBoard(revealShips = false) {
  const board = state.enemyBoard;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = getCell('enemy-board', r, c);
      if (!cell) continue;
      cell.className = 'cell';
      cell.innerHTML = '';
      const v = board[r][c];
      if (v === -1) cell.classList.add('miss');
      else if (v === 2) {
        cell.classList.add('hit');
        cell.innerHTML = '<span class="marker">✕</span>';
      } else if (v === 3) {
        cell.classList.add('sunk');
        cell.innerHTML = '<span class="marker">✕</span>';
      } else if (revealShips && v === 1) {
        cell.classList.add('ship');
      }
    }
  }
}

// ── Place screen ──────────────────────────────────────────────
function renderPlaceScreen() {
  buildGrid('place-board', false);
  renderPlaceBoard();
  renderShipList();
  updatePlaceButtons();
}

function renderPlaceBoard() {
  // Just show placed ships (value=1)
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = getCell('place-board', r, c);
      if (!cell) continue;
      cell.className = 'cell';
      if (state.playerBoard[r][c] === 1) cell.classList.add('ship');
    }
  }
}

function handlePlaceHover(r, c) {
  if (state.currentShipIdx >= SHIPS_CONFIG.length) return;
  clearPreview();
  const { size } = SHIPS_CONFIG[state.currentShipIdx];
  const cells = cellsForShip(r, c, size, state.orientation);
  const valid = canPlace(state.playerBoard, cells);
  for (const [cr, cc] of cells) {
    if (!inBounds(cr, cc)) continue;
    const cell = getCell('place-board', cr, cc);
    if (cell) cell.classList.add(valid ? 'preview-valid' : 'preview-invalid');
  }
}

function clearPreview() {
  document.querySelectorAll('#place-board .preview-valid, #place-board .preview-invalid').forEach(c => {
    c.classList.remove('preview-valid', 'preview-invalid');
  });
}

function handlePlaceClick(r, c) {
  if (state.currentShipIdx >= SHIPS_CONFIG.length) return;
  const { size } = SHIPS_CONFIG[state.currentShipIdx];
  const cells = cellsForShip(r, c, size, state.orientation);
  if (!canPlace(state.playerBoard, cells)) {
    toast('배치할 수 없는 위치입니다');
    return;
  }
  placeShip(state.playerBoard, cells, state.playerShips, state.currentShipIdx);
  state.placedCount++;
  state.currentShipIdx++;
  clearPreview();
  renderPlaceBoard();
  renderShipList();
  updatePlaceButtons();

  if (state.currentShipIdx >= SHIPS_CONFIG.length) {
    setStatus('모든 함선이 배치되었습니다. 전투 시작!');
  }
}

function renderShipList() {
  const list = $('ship-list');
  list.innerHTML = '';
  SHIPS_CONFIG.forEach((ship, idx) => {
    const item = document.createElement('div');
    item.className = 'ship-item';
    if (idx < state.currentShipIdx) item.classList.add('placed');
    if (idx === state.currentShipIdx) item.classList.add('current');

    const dots = Array.from({ length: ship.size }, () =>
      '<span class="ship-dot"></span>'
    ).join('');

    item.innerHTML = `
      <span class="ship-name">${ship.name}</span>
      <span class="ship-size-dots">${dots}</span>
      <span class="ship-status">${idx < state.currentShipIdx ? '완료' : (idx === state.currentShipIdx ? '배치 중' : '대기')}</span>
    `;
    list.appendChild(item);
  });
}

function updatePlaceButtons() {
  $('btn-rotate').disabled = state.currentShipIdx >= SHIPS_CONFIG.length;
  $('btn-start-game').disabled = state.currentShipIdx < SHIPS_CONFIG.length;
  $('btn-rotate').textContent = `회전 (${state.orientation === 'H' ? '가로' : '세로'})`;
}

function rotateShip() {
  state.orientation = state.orientation === 'H' ? 'V' : 'H';
  updatePlaceButtons();
  clearPreview();
}

function autoPlace() {
  state.playerBoard = makeBoard();
  state.playerShips = randomPlacement(state.playerBoard, SHIPS_CONFIG);
  state.placedCount = SHIPS_CONFIG.length;
  state.currentShipIdx = SHIPS_CONFIG.length;
  state.orientation = 'H';
  clearPreview();
  renderPlaceBoard();
  renderShipList();
  updatePlaceButtons();
}

// ── Start game ────────────────────────────────────────────────
function startGame() {
  // Place enemy ships randomly
  state.enemyBoard = makeBoard();
  state.enemyShips = randomPlacement(state.enemyBoard, SHIPS_CONFIG);
  // Reset enemy board display (keep internal 1s hidden from player)
  // We track internally but don't show
  state.turn = 'player';
  state.phase = 'game';
  state.playerShots = 0;
  state.playerHits = 0;
  state.aiShots = 0;
  state.aiHits = 0;

  showScreen('game');
  buildGrid('player-board', false);
  buildGrid('enemy-board', true);
  renderPlayerBoard();
  renderEnemyBoard();
  renderShipsHud();
  setTurnIndicator();
  setStatus('공격할 적 함선을 선택하세요', '');
}

// ── Turn indicator ────────────────────────────────────────────
function setTurnIndicator() {
  const el = $('turn-indicator');
  const enemyLabel = $('enemy-board-label');
  const playerLabel = $('player-board-label');

  if (state.turn === 'player') {
    el.textContent = '내 차례';
    el.className = 'turn-indicator player-turn';
    enemyLabel.classList.add('active');
    playerLabel.classList.remove('active');
  } else {
    el.textContent = 'AI 차례';
    el.className = 'turn-indicator';
    playerLabel.classList.add('active');
    enemyLabel.classList.remove('active');
  }
}

// ── Ships HUD ─────────────────────────────────────────────────
function renderShipsHud() {
  // enemy ships remaining
  const enemyRow = $('enemy-ships-row');
  const playerRow = $('player-ships-row');
  enemyRow.innerHTML = '';
  playerRow.innerHTML = '';

  state.enemyShips.forEach((ship, idx) => {
    const badge = document.createElement('div');
    badge.className = 'ship-badge' + (ship.sunk ? ' sunk' : '');
    badge.id = 'enemy-badge-' + idx;
    badge.innerHTML = Array.from({ length: SHIPS_CONFIG[idx].size }, () => '<span class="block"></span>').join('');
    enemyRow.appendChild(badge);
  });

  state.playerShips.forEach((ship, idx) => {
    const badge = document.createElement('div');
    badge.className = 'ship-badge' + (ship.sunk ? ' sunk' : '');
    badge.id = 'player-badge-' + idx;
    badge.innerHTML = Array.from({ length: SHIPS_CONFIG[idx].size }, () => '<span class="block"></span>').join('');
    playerRow.appendChild(badge);
  });
}

function updateShipBadge(prefix, idx, sunk) {
  const badge = $(prefix + '-badge-' + idx);
  if (badge) {
    if (sunk) badge.classList.add('sunk');
  }
}

// ── Attack logic ──────────────────────────────────────────────
function handleEnemyClick(r, c) {
  if (state.turn !== 'player') return;
  if (state.phase !== 'game') return;
  const board = state.enemyBoard;
  if (board[r][c] === -1 || board[r][c] === 2 || board[r][c] === 3) {
    toast('이미 공격한 위치입니다');
    return;
  }

  state.playerShots++;
  const isHit = board[r][c] === 1;

  if (isHit) {
    board[r][c] = 2;
    state.playerHits++;
    // check sunk
    const ship = findShipByCell(state.enemyShips, r, c);
    if (ship && isShipSunk(state.enemyBoard, ship)) {
      sinkShip(state.enemyBoard, ship);
      ship.sunk = true;
      const idx = state.enemyShips.indexOf(ship);
      updateShipBadge('enemy', idx, true);
      flashSunkCells('enemy-board', ship);
      toast(`적 ${SHIPS_CONFIG[idx].name} 격침!`, 'sunk-toast');
      setStatus(`적 ${SHIPS_CONFIG[idx].name}을(를) 격침했습니다!`, 'sunk');
    } else {
      setStatus('명중!', 'hit');
    }
    renderEnemyBoard();

    if (allSunk(state.enemyShips)) {
      endGame(true);
      return;
    }
  } else {
    board[r][c] = -1;
    setStatus('빗나갔습니다', 'miss');
    renderEnemyBoard();
  }

  // Switch to AI turn
  state.turn = 'ai';
  setTurnIndicator();
  // Short delay for AI to "think"
  setTimeout(aiTurn, 700 + Math.random() * 400);
}

// ── AI turn ───────────────────────────────────────────────────
function aiTurn() {
  if (state.phase !== 'game') return;

  const ai = state.ai;
  let r, c;

  if (ai.mode === 'hunt' || ai.candidates.length === 0) {
    // Random untried cell
    [r, c] = pickRandomCell(state.playerBoard);
    ai.mode = 'hunt';
    ai.candidates = [];
  } else {
    // Target mode: use next candidate
    [r, c] = ai.candidates.shift();
    // Verify it's valid
    while ((state.playerBoard[r][c] === -1 || state.playerBoard[r][c] === 2 || state.playerBoard[r][c] === 3) && ai.candidates.length > 0) {
      [r, c] = ai.candidates.shift();
    }
    if (state.playerBoard[r][c] === -1 || state.playerBoard[r][c] === 2 || state.playerBoard[r][c] === 3) {
      // Fallback
      [r, c] = pickRandomCell(state.playerBoard);
    }
  }

  state.aiShots++;
  const board = state.playerBoard;
  const isHit = board[r][c] === 1;

  if (isHit) {
    board[r][c] = 2;
    state.aiHits++;
    ai.hits.push([r, c]);
    ai.lastHit = [r, c];

    const ship = findShipByCell(state.playerShips, r, c);
    if (ship && isShipSunk(board, ship)) {
      sinkShip(board, ship);
      ship.sunk = true;
      const idx = state.playerShips.indexOf(ship);
      updateShipBadge('player', idx, true);
      flashSunkCells('player-board', ship);
      toast(`내 ${SHIPS_CONFIG[idx].name} 격침당했습니다`, 'sunk-toast');
      setStatus(`AI가 ${SHIPS_CONFIG[idx].name}을(를) 격침했습니다!`, 'sunk');
      // Reset AI to hunt mode
      ai.mode = 'hunt';
      ai.hits = [];
      ai.candidates = [];
    } else {
      setStatus(`AI 공격 - 명중!`, 'hit');
      // Build candidates around all current hits (smart targeting)
      ai.mode = 'target';
      ai.candidates = buildCandidates(ai.hits, board);
    }
    renderPlayerBoard();

    if (allSunk(state.playerShips)) {
      endGame(false);
      return;
    }
  } else {
    board[r][c] = -1;
    setStatus(`AI 공격 - 빗나감`, 'ai');
    if (ai.mode === 'target' && ai.candidates.length === 0) {
      // All candidates exhausted without sinking - fallback to hunt
      ai.mode = 'hunt';
      ai.hits = [];
    }
    renderPlayerBoard();
  }

  state.turn = 'player';
  setTurnIndicator();
}

function pickRandomCell(board) {
  const options = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0 || board[r][c] === 1) options.push([r, c]);
    }
  }
  return options[Math.floor(Math.random() * options.length)];
}

function buildCandidates(hits, board) {
  const candidates = [];
  // If 2+ hits in a line, extend along that line first
  if (hits.length >= 2) {
    const dirs = inferDirection(hits);
    if (dirs) {
      for (const [dr, dc] of dirs) {
        // extend beyond both ends of the hit chain
        const sortedHits = [...hits].sort((a, b) => dr !== 0 ? a[0] - b[0] : a[1] - b[1]);
        const first = sortedHits[0];
        const last = sortedHits[sortedHits.length - 1];

        // try before first
        const r0 = first[0] - dr, c0 = first[1] - dc;
        if (inBounds(r0, c0) && isUntried(board, r0, c0)) candidates.push([r0, c0]);
        // try after last
        const r1 = last[0] + dr, c1 = last[1] + dc;
        if (inBounds(r1, c1) && isUntried(board, r1, c1)) candidates.push([r1, c1]);
      }
      if (candidates.length > 0) return candidates;
    }
  }

  // Fall back: try all 4 neighbors of last hit
  const dirs4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [r, c] of hits) {
    for (const [dr, dc] of dirs4) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && isUntried(board, nr, nc)) {
        if (!candidates.some(([cr, cc]) => cr === nr && cc === nc))
          candidates.push([nr, nc]);
      }
    }
  }
  return candidates;
}

function inferDirection(hits) {
  // Are all hits in the same row?
  if (hits.every(([r]) => r === hits[0][0])) return [[0, 1]];
  // Are all hits in the same col?
  if (hits.every(([, c]) => c === hits[0][1])) return [[1, 0]];
  return null;
}

function isUntried(board, r, c) {
  return board[r][c] === 0 || board[r][c] === 1;
}

// ── Ship helpers ──────────────────────────────────────────────
function findShipByCell(ships, r, c) {
  return ships.find(s => s.cells.some(cell => cell.r === r && cell.c === c)) || null;
}

function isShipSunk(board, ship) {
  return ship.cells.every(({ r, c }) => board[r][c] === 2);
}

function sinkShip(board, ship) {
  for (const { r, c } of ship.cells) board[r][c] = 3;
}

function allSunk(ships) {
  return ships.every(s => s.sunk);
}

function flashSunkCells(boardId, ship) {
  for (const { r, c } of ship.cells) {
    const cell = getCell(boardId, r, c);
    if (cell) {
      cell.classList.add('sunk-flash');
      setTimeout(() => cell.classList.remove('sunk-flash'), 1500);
    }
  }
}

// ── End game ──────────────────────────────────────────────────
function endGame(won) {
  state.phase = 'result';
  state.won = won;

  saveStats(won);
  const stats = loadStats();

  // Reveal enemy ships
  renderEnemyBoard(true);

  setTimeout(() => {
    $('result-emoji').textContent = won ? '🏆' : '💥';
    $('result-title').textContent = won ? '승리!' : '패배';
    $('result-title').className = 'result-title ' + (won ? 'win' : 'lose');
    $('result-desc').textContent = won
      ? `모든 적 함선을 격침했습니다!`
      : `모든 내 함선이 격침당했습니다.`;

    $('result-shots').textContent = state.playerShots;
    $('result-accuracy').textContent = state.playerShots > 0
      ? Math.round(state.playerHits / state.playerShots * 100) + '%'
      : '0%';
    $('result-total-wins').textContent = stats.wins;
    $('result-total-losses').textContent = stats.losses;

    showScreen('result');
    if (won && typeof Leaderboard !== 'undefined') {
      Leaderboard.ready('battleship', state.playerShots, { ascending: true, label: '공격 횟수' });
    }
  }, 400);
}

// ── Start screen stats ────────────────────────────────────────
function updateStartStats() {
  const stats = loadStats();
  $('stat-wins').textContent = stats.wins;
  $('stat-losses').textContent = stats.losses;
  $('stat-games').textContent = stats.games;
}

// ── Init ──────────────────────────────────────────────────────
function initGame() {
  state = freshState();
  showScreen('start');
  updateStartStats();
}

function goToPlaceScreen() {
  if (typeof Leaderboard !== 'undefined') Leaderboard.hide();
  state = freshState();
  state.phase = 'place';
  showScreen('place');
  renderPlaceScreen();
  setStatus('배치할 위치를 선택하세요');
}

function goToStartScreen() {
  initGame();
}

// ── Event wiring ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Build grids
  buildGrid('place-board', false);
  buildGrid('player-board', false);
  buildGrid('enemy-board', true);

  // Start screen
  $('btn-new-game').addEventListener('click', goToPlaceScreen);

  // Place screen
  $('btn-rotate').addEventListener('click', rotateShip);
  $('btn-auto-place').addEventListener('click', autoPlace);
  $('btn-start-game').addEventListener('click', () => {
    if (state.currentShipIdx < SHIPS_CONFIG.length) {
      toast('모든 함선을 배치해주세요');
      return;
    }
    startGame();
  });
  $('btn-reset-place').addEventListener('click', () => {
    state.playerBoard = makeBoard();
    state.playerShips = [];
    state.placedCount = 0;
    state.currentShipIdx = 0;
    state.orientation = 'H';
    renderPlaceBoard();
    renderShipList();
    updatePlaceButtons();
  });

  // Result screen
  $('btn-play-again').addEventListener('click', goToPlaceScreen);
  $('btn-home').addEventListener('click', goToStartScreen);

  // Place board mouse leave - clear preview
  $('place-board').addEventListener('mouseleave', clearPreview);

  // Keyboard: R = rotate during placement
  document.addEventListener('keydown', e => {
    if (state.phase === 'place' && (e.key === 'r' || e.key === 'R')) {
      rotateShip();
    }
  });

  initGame();
});
