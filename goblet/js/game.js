/* ══════════════════════════════════════════
   GOBLET GOBBLERS — game.js
   Complete game logic with AI (minimax + alpha-beta)
   ══════════════════════════════════════════ */

'use strict';

/* ── Constants ── */
const PLAYER1 = 1; // Blue
const PLAYER2 = 2; // Pink / AI
const SIZE_S = 0;
const SIZE_M = 1;
const SIZE_L = 2;
const SIZE_NAMES = ['small', 'medium', 'large'];
const WIN_LINES = [
  [0,1,2],[3,4,5],[6,7,8], // rows
  [0,3,6],[1,4,7],[2,5,8], // cols
  [0,4,8],[2,4,6]          // diags
];

/* ── State ── */
let board = [];       // board[0..8] = stack of {player, size}
let reserves = {};    // reserves[1] = {0:2, 1:2, 2:2}, reserves[2] = ...
let currentPlayer = PLAYER1;
let gameOver = false;
let aiThinking = false;
let isAI = true;
let selectedPiece = null; // {type:'reserve'|'board', player, size, cellIdx}
let winCells = null;
let stats = loadStats();

/* ── DOM refs ── */
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const gameScreen = document.getElementById('game-screen');
const lobbyScreen = document.getElementById('lobby-screen');
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
const boardEl = document.getElementById('board');

/* ══════════════════════════════════════════
   STATS & STORAGE
══════════════════════════════════════════ */
function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem('goblet_stats') || '{}');
    return { wins: s.wins || 0, losses: s.losses || 0, games: s.games || 0 };
  } catch { return { wins: 0, losses: 0, games: 0 }; }
}

function saveStats() {
  localStorage.setItem('goblet_stats', JSON.stringify(stats));
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
   SCREEN MANAGEMENT
══════════════════════════════════════════ */
function showScreen(which) {
  startScreen.classList.toggle('hidden', which !== 'start');
  gameScreen.classList.toggle('hidden', which !== 'game');
  resultScreen.classList.toggle('hidden', which !== 'result');
  if (lobbyScreen) lobbyScreen.classList.toggle('hidden', which !== 'lobby');
}

/* ══════════════════════════════════════════
   GAME LOGIC
══════════════════════════════════════════ */
function initBoard() {
  board = Array.from({ length: 9 }, () => []);
  reserves = {
    1: { 0: 2, 1: 2, 2: 2 },
    2: { 0: 2, 1: 2, 2: 2 }
  };
  currentPlayer = PLAYER1;
  gameOver = false;
  aiThinking = false;
  selectedPiece = null;
  winCells = null;
}

function getTopPiece(cellIdx) {
  const stack = board[cellIdx];
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

function canPlace(cellIdx, size) {
  const top = getTopPiece(cellIdx);
  if (!top) return true;
  return size > top.size;
}

function placePiece(cellIdx, player, size, fromReserve) {
  board[cellIdx].push({ player, size });
  if (fromReserve) {
    reserves[player][size]--;
  }
}

function removePiece(cellIdx) {
  return board[cellIdx].pop();
}

function movePiece(fromIdx, toIdx) {
  const piece = removePiece(fromIdx);
  if (!piece) return null;
  board[toIdx].push(piece);
  return piece;
}

function checkWin() {
  for (const line of WIN_LINES) {
    const pieces = line.map(i => getTopPiece(i));
    if (pieces[0] && pieces[1] && pieces[2] &&
        pieces[0].player === pieces[1].player &&
        pieces[1].player === pieces[2].player) {
      return { winner: pieces[0].player, cells: line };
    }
  }
  return null;
}

function getAllLegalMoves(player) {
  const moves = [];

  // Place from reserve
  for (let size = 0; size <= 2; size++) {
    if (reserves[player][size] <= 0) continue;
    for (let cell = 0; cell < 9; cell++) {
      if (canPlace(cell, size)) {
        moves.push({ type: 'place', size, to: cell });
      }
    }
  }

  // Move from board
  for (let from = 0; from < 9; from++) {
    const top = getTopPiece(from);
    if (!top || top.player !== player) continue;
    for (let to = 0; to < 9; to++) {
      if (from === to) continue;
      if (canPlace(to, top.size)) {
        moves.push({ type: 'move', from, to, size: top.size });
      }
    }
  }

  return moves;
}

/* ══════════════════════════════════════════
   AI (MINIMAX WITH ALPHA-BETA)
══════════════════════════════════════════ */
function evaluate() {
  const result = checkWin();
  if (result) {
    return result.winner === PLAYER2 ? 10000 : -10000;
  }

  let score = 0;

  // Center control bonus
  const centerTop = getTopPiece(4);
  if (centerTop) {
    score += centerTop.player === PLAYER2 ? 30 : -30;
  }

  // 2-in-a-row bonus
  for (const line of WIN_LINES) {
    const pieces = line.map(i => getTopPiece(i));
    const p1count = pieces.filter(p => p && p.player === PLAYER1).length;
    const p2count = pieces.filter(p => p && p.player === PLAYER2).length;
    const empty = pieces.filter(p => !p).length;

    if (p2count === 2 && empty === 1) score += 50;
    if (p2count === 2 && p1count === 1) score += 15; // can gobble
    if (p1count === 2 && empty === 1) score -= 50;
    if (p1count === 2 && p2count === 1) score -= 15;
  }

  // Piece size advantage on board
  for (let i = 0; i < 9; i++) {
    const top = getTopPiece(i);
    if (top) {
      const sizeBonus = (top.size + 1) * 3;
      score += top.player === PLAYER2 ? sizeBonus : -sizeBonus;
    }
  }

  return score;
}

function minimax(depth, alpha, beta, isMaximizing) {
  const result = checkWin();
  if (result) {
    return result.winner === PLAYER2 ? 10000 + depth : -10000 - depth;
  }

  if (depth === 0) return evaluate();

  const player = isMaximizing ? PLAYER2 : PLAYER1;
  const moves = getAllLegalMoves(player);

  if (moves.length === 0) return evaluate();

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      applyMoveState(move, player);
      const eval_ = minimax(depth - 1, alpha, beta, false);
      undoMoveState(move, player);
      maxEval = Math.max(maxEval, eval_);
      alpha = Math.max(alpha, eval_);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      applyMoveState(move, player);
      const eval_ = minimax(depth - 1, alpha, beta, true);
      undoMoveState(move, player);
      minEval = Math.min(minEval, eval_);
      beta = Math.min(beta, eval_);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function applyMoveState(move, player) {
  if (move.type === 'place') {
    placePiece(move.to, player, move.size, true);
  } else {
    move._revealed = board[move.from].length > 1 ? board[move.from][board[move.from].length - 2] : null;
    movePiece(move.from, move.to);
  }
}

function undoMoveState(move, player) {
  if (move.type === 'place') {
    removePiece(move.to);
    reserves[player][move.size]++;
  } else {
    const piece = removePiece(move.to);
    board[move.from].push(piece);
  }
}

function aiMove() {
  const moves = getAllLegalMoves(PLAYER2);
  if (moves.length === 0) return null;

  let bestScore = -Infinity;
  let bestMoves = [];
  const depth = 4;

  for (const move of moves) {
    applyMoveState(move, PLAYER2);

    // Check if this move reveals opponent win
    const revealWin = checkWin();
    if (revealWin && revealWin.winner === PLAYER1 && move.type === 'move') {
      undoMoveState(move, PLAYER2);
      continue; // avoid revealing opponent's win
    }

    const score = minimax(depth - 1, -Infinity, Infinity, false);
    undoMoveState(move, PLAYER2);

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  if (bestMoves.length === 0) {
    // If all moves reveal opponent win, just pick any
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // Add randomness to equal-scored moves
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

/* ══════════════════════════════════════════
   RENDERING
══════════════════════════════════════════ */
function renderBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.idx = i;

    if (winCells && winCells.includes(i)) {
      cell.classList.add('win-cell');
    }

    const top = getTopPiece(i);
    if (top) {
      const pieceEl = document.createElement('div');
      pieceEl.className = `board-piece piece-${SIZE_NAMES[top.size]} piece-player${top.player}`;

      if (selectedPiece && selectedPiece.type === 'board' && selectedPiece.cellIdx === i) {
        pieceEl.classList.add('selected');
        cell.classList.add('selected');
      }

      cell.appendChild(pieceEl);
    }

    // Show valid targets
    if (selectedPiece && !gameOver) {
      if (canPlaceSelected(i)) {
        cell.classList.add('valid-target');
      }
    }

    cell.addEventListener('click', () => onCellClick(i));
    boardEl.appendChild(cell);
  }
}

function canPlaceSelected(cellIdx) {
  if (!selectedPiece) return false;
  if (selectedPiece.type === 'board' && selectedPiece.cellIdx === cellIdx) return false;
  return canPlace(cellIdx, selectedPiece.size);
}

function renderReserves() {
  for (let player = 1; player <= 2; player++) {
    const container = document.getElementById(`reserve-pieces-${player}`);
    container.innerHTML = '';

    for (let size = 2; size >= 0; size--) {
      const count = reserves[player][size];
      for (let i = 0; i < 2; i++) {
        const piece = document.createElement('div');
        piece.className = `reserve-piece piece-${SIZE_NAMES[size]} piece-player${player}`;

        if (i >= count) {
          piece.classList.add('disabled');
        }

        if (i < count && selectedPiece && selectedPiece.type === 'reserve' &&
            selectedPiece.player === player && selectedPiece.size === size) {
          piece.classList.add('selected');
        }

        piece.addEventListener('click', () => onReserveClick(player, size));
        container.appendChild(piece);
      }
    }
  }
}

function render() {
  renderBoard();
  renderReserves();
  updateTurnUI();
}

function updateTurnUI() {
  if (gameOver) return;

  if (currentPlayer === PLAYER1) {
    turnDot.className = 'turn-dot player1';
    turnLabel.textContent = isAI ? '당신 (파랑)' : 'P1 (파랑)';
    statusText.textContent = isAI ? '당신의 차례' : 'P1 차례';
  } else {
    turnDot.className = 'turn-dot player2';
    if (isAI && !aiThinking) {
      turnLabel.textContent = 'AI (분홍)';
      statusText.textContent = 'AI 차례';
    } else if (isAI && aiThinking) {
      turnLabel.textContent = 'AI (분홍)';
      statusText.innerHTML = '<span class="thinking-dots"><span></span><span></span><span></span></span> AI 생각 중';
    } else {
      turnLabel.textContent = 'P2 (분홍)';
      statusText.textContent = 'P2 차례';
    }
  }
}

/* ══════════════════════════════════════════
   INPUT HANDLING
══════════════════════════════════════════ */
function onReserveClick(player, size) {
  if (gameOver || aiThinking) return;
  if (typeof Online !== 'undefined' && Online.isActive()) {
    if (player !== Online.getMyPlayerNum()) return;
  } else {
    if (player !== currentPlayer) return;
  }
  if (reserves[player][size] <= 0) return;

  // Toggle selection
  if (selectedPiece && selectedPiece.type === 'reserve' &&
      selectedPiece.player === player && selectedPiece.size === size) {
    selectedPiece = null;
  } else {
    selectedPiece = { type: 'reserve', player, size };
  }
  render();
}

function onCellClick(cellIdx) {
  if (gameOver || aiThinking) return;

  const isOnline = typeof Online !== 'undefined' && Online.isActive();

  if (selectedPiece) {
    // Try to place/move to this cell
    if (canPlaceSelected(cellIdx)) {
      if (selectedPiece.type === 'reserve') {
        const player = selectedPiece.player;
        const size = selectedPiece.size;
        placePiece(cellIdx, player, size, true);
        selectedPiece = null;

        if (isOnline) {
          Online.sendMove({ type: 'place', size, to: cellIdx, player });
        }

        afterMove(player);
      } else if (selectedPiece.type === 'board') {
        const fromIdx = selectedPiece.cellIdx;
        const player = selectedPiece.player;
        const size = selectedPiece.size;
        movePiece(fromIdx, cellIdx);
        selectedPiece = null;

        if (isOnline) {
          Online.sendMove({ type: 'move', from: fromIdx, to: cellIdx, player, size });
        }

        afterMove(player);
      }
    } else {
      // Clicked same cell or invalid: try to select this cell's piece instead
      const top = getTopPiece(cellIdx);
      if (top && top.player === currentPlayer) {
        if (isOnline && top.player !== Online.getMyPlayerNum()) return;
        selectedPiece = { type: 'board', player: top.player, size: top.size, cellIdx };
        render();
      } else {
        selectedPiece = null;
        render();
      }
    }
  } else {
    // Select piece on board
    const top = getTopPiece(cellIdx);
    if (top && top.player === currentPlayer) {
      if (isOnline && top.player !== Online.getMyPlayerNum()) return;
      selectedPiece = { type: 'board', player: top.player, size: top.size, cellIdx };
      render();
    }
  }
}

function afterMove(player) {
  const isOnline = typeof Online !== 'undefined' && Online.isActive();

  // Check if moving revealed opponent's win
  const result = checkWin();

  if (result) {
    gameOver = true;
    winCells = result.cells;
    render();

    if (isOnline) {
      Online.endOnlineGame(result.winner);
    } else {
      handleGameEnd(result.winner);
    }
    return;
  }

  // Switch player
  currentPlayer = currentPlayer === PLAYER1 ? PLAYER2 : PLAYER1;
  render();

  if (isOnline) {
    // Notify online module about turn switch
    if (player === Online.getMyPlayerNum()) {
      Online.onMyMove();
    }
  } else if (isAI && currentPlayer === PLAYER2 && !gameOver) {
    doAITurn();
  }
}

function doAITurn() {
  aiThinking = true;
  updateTurnUI();
  boardEl.classList.add('disabled');
  document.getElementById('reserve-1').classList.add('disabled');

  setTimeout(() => {
    const move = aiMove();
    if (!move) {
      aiThinking = false;
      return;
    }

    if (move.type === 'place') {
      placePiece(move.to, PLAYER2, move.size, true);
    } else {
      movePiece(move.from, move.to);
    }

    aiThinking = false;
    boardEl.classList.remove('disabled');
    document.getElementById('reserve-1').classList.remove('disabled');

    afterMove(PLAYER2);
  }, 300);
}

function handleGameEnd(winner) {
  stats.games++;
  if (isAI) {
    if (winner === PLAYER1) stats.wins++;
    else stats.losses++;
  }
  saveStats();
  updateStatsUI();

  setTimeout(() => {
    if (isAI) {
      if (winner === PLAYER1) {
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
    } else {
      if (winner === PLAYER1) {
        resultEmoji.textContent = '🏆';
        resultTitle.textContent = 'P1 승리!';
        resultTitle.className = 'result-title win';
        resultSubtitle.textContent = '파랑 플레이어가 이겼습니다!';
      } else {
        resultEmoji.textContent = '🏆';
        resultTitle.textContent = 'P2 승리!';
        resultTitle.className = 'result-title lose';
        resultSubtitle.textContent = '분홍 플레이어가 이겼습니다!';
      }
    }
    showScreen('result');
  }, 800);
}

/* ══════════════════════════════════════════
   GAME FLOW
══════════════════════════════════════════ */
function startGame(vsAI) {
  isAI = vsAI !== false;
  initBoard();
  updateStatsUI();
  showScreen('game');
  render();

  const headerTitle = document.querySelector('.header-title');
  if (headerTitle) headerTitle.textContent = 'GOBLET';

  document.getElementById('reserve-1').classList.remove('disabled');
  document.getElementById('reserve-2').classList.remove('disabled');
  boardEl.classList.remove('disabled');
}

/* ══════════════════════════════════════════
   ONLINE HELPERS (exposed for online.js)
══════════════════════════════════════════ */
function applyOnlineMove(payload) {
  if (payload.type === 'place') {
    placePiece(payload.to, payload.player, payload.size, true);
    afterMove(payload.player);
  } else if (payload.type === 'move') {
    movePiece(payload.from, payload.to);
    afterMove(payload.player);
  }
}

/* ══════════════════════════════════════════
   BUTTON HANDLERS
══════════════════════════════════════════ */
document.getElementById('btn-start').addEventListener('click', () => startGame(true));
document.getElementById('btn-play-again').addEventListener('click', () => startGame(isAI));
document.getElementById('btn-home').addEventListener('click', () => {
  updateStatsUI();
  showScreen('start');
});
document.getElementById('btn-home-result').addEventListener('click', () => {
  updateStatsUI();
  showScreen('start');
});
document.getElementById('btn-restart').addEventListener('click', () => startGame(isAI));

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
updateStatsUI();
showScreen('start');
