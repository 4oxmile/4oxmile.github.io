/* ============================================================
   SKIPPITY — game.js
   Core game logic, AI, rendering. Exposes window.Game for online.js
   ============================================================ */

'use strict';

window.Game = (function () {

  /* ── Constants ──────────────────────────────────────── */
  const SIZE = 10;
  const NUM_COLORS = 5;
  const COLOR_CSS = ['c0', 'c1', 'c2', 'c3', 'c4'];
  const DIR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const STATS_KEY = 'skippity_stats';
  const DIFF_KEY = 'skippity_diff';

  /* ── State ──────────────────────────────────────────── */
  let board = [];
  let playerCap = [0, 0, 0, 0, 0];
  let aiCap = [0, 0, 0, 0, 0];
  let turn = 'player';
  let selected = null;
  let jumping = null;
  let gameActive = false;
  let difficulty = 'normal';
  let stats = { wins: 0, losses: 0, draws: 0 };
  let aiThinking = false;

  /* ── Online mode hooks ─────────────────────────────── */
  let onlineMode = false;
  let turnMoves = [];          // records jumps during player's turn
  let onTurnEndCb = null;      // callback when player finishes turn

  /* ── DOM Helpers ────────────────────────────────────── */
  const $ = (id) => document.getElementById(id);

  /* ── Init ───────────────────────────────────────────── */
  function init() {
    loadStats();
    loadDifficulty();
    renderStats();
    buildScoreDots();
    setupListeners();
  }

  function setupListeners() {
    $('start-btn').addEventListener('click', startGame);
    $('play-again-btn').addEventListener('click', () => {
      if (onlineMode) { showMenu(); return; }
      startGame();
    });
    $('back-btn').addEventListener('click', showMenu);
    $('restart-btn').addEventListener('click', () => {
      if (onlineMode) return; // no restart in online
      startGame();
    });
    $('menu-btn').addEventListener('click', showMenu);
    $('end-turn-btn').addEventListener('click', endPlayerTurn);

    document.querySelectorAll('.diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.diff-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        difficulty = btn.dataset.diff;
        saveDifficulty();
      });
    });
  }

  /* ── Score Dot Elements ─────────────────────────────── */
  function buildScoreDots() {
    ['player-counts', 'ai-counts'].forEach((id) => {
      const el = $(id);
      el.innerHTML = '';
      for (let c = 0; c < NUM_COLORS; c++) {
        const wrap = document.createElement('div');
        wrap.className = 'color-count';
        wrap.innerHTML = `<div class="color-dot ${COLOR_CSS[c]}"></div><span class="color-val" data-color="${c}">0</span>`;
        el.appendChild(wrap);
      }
    });
  }

  /* ── Game Start ─────────────────────────────────────── */
  function startGame() {
    onlineMode = false;
    turnMoves = [];
    board = createBoard();
    playerCap = [0, 0, 0, 0, 0];
    aiCap = [0, 0, 0, 0, 0];
    turn = 'player';
    selected = null;
    jumping = null;
    gameActive = true;
    aiThinking = false;

    // Restore labels for AI mode
    const aiLabel = $('ai-label');
    if (aiLabel) aiLabel.textContent = 'AI';

    hideAllOverlays();
    hideEndTurn();
    renderBoard();
    renderScores();
    updateTurnUI();
  }

  function startOnline(flatBoard, iAmFirst) {
    onlineMode = true;
    turnMoves = [];
    board = unflattenBoard(flatBoard);
    playerCap = [0, 0, 0, 0, 0];
    aiCap = [0, 0, 0, 0, 0];
    turn = iAmFirst ? 'player' : 'ai';
    selected = null;
    jumping = null;
    gameActive = true;
    aiThinking = false;

    // Update labels for online
    const aiLabel = $('ai-label');
    if (aiLabel) aiLabel.textContent = '상대';
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) headerTitle.textContent = 'ONLINE';

    hideAllOverlays();
    hideEndTurn();
    renderBoard();
    renderScores();
    updateTurnUI();
  }

  function createBoard() {
    const pieces = [];
    for (let c = 0; c < NUM_COLORS; c++)
      for (let i = 0; i < 20; i++) pieces.push(c);
    shuffle(pieces);

    const b = [];
    let idx = 0;
    for (let r = 0; r < SIZE; r++) {
      b[r] = [];
      for (let c = 0; c < SIZE; c++) b[r][c] = pieces[idx++];
    }
    b[4][4] = b[4][5] = b[5][4] = b[5][5] = null;
    return b;
  }

  function flattenBoard() {
    const flat = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        flat.push(board[r][c]);
    return flat;
  }

  function unflattenBoard(flat) {
    const b = [];
    for (let r = 0; r < SIZE; r++) {
      b[r] = [];
      for (let c = 0; c < SIZE; c++)
        b[r][c] = flat[r * SIZE + c];
    }
    return b;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  /* ── Board Logic ────────────────────────────────────── */
  function getJumps(r, c) {
    const jumps = [];
    if (board[r][c] === null) return jumps;
    for (const [dr, dc] of DIR) {
      const mr = r + dr, mc = c + dc;
      const lr = r + 2 * dr, lc = c + 2 * dc;
      if (lr < 0 || lr >= SIZE || lc < 0 || lc >= SIZE) continue;
      if (board[mr][mc] === null || board[lr][lc] !== null) continue;
      jumps.push({ tr: lr, tc: lc, cr: mr, cc: mc });
    }
    return jumps;
  }

  function hasAnyJumps() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (board[r][c] !== null && getJumps(r, c).length > 0) return true;
    return false;
  }

  function getJumpablePieces() {
    const pieces = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (board[r][c] !== null && getJumps(r, c).length > 0) pieces.push({ r, c });
    return pieces;
  }

  /* ── Player Interaction ─────────────────────────────── */
  function onCellClick(r, c) {
    if (!gameActive || turn !== 'player' || aiThinking) return;

    // In multi-jump mode
    if (jumping) {
      const jumps = getJumps(jumping.r, jumping.c);
      const jump = jumps.find((j) => j.tr === r && j.tc === c);
      if (jump) {
        executeJump(jumping.r, jumping.c, jump, 'player');
        jumping = { r: jump.tr, c: jump.tc };

        const nextJumps = getJumps(jumping.r, jumping.c);
        if (nextJumps.length > 0) {
          renderBoard();
          showJumpingState();
        } else {
          endPlayerTurn();
        }
      }
      return;
    }

    // Check if clicking a valid jump destination for selected piece
    if (selected) {
      const jumps = getJumps(selected.r, selected.c);
      const jump = jumps.find((j) => j.tr === r && j.tc === c);
      if (jump) {
        executeJump(selected.r, selected.c, jump, 'player');
        jumping = { r: jump.tr, c: jump.tc };
        selected = null;

        const nextJumps = getJumps(jumping.r, jumping.c);
        if (nextJumps.length > 0) {
          renderBoard();
          showJumpingState();
        } else {
          endPlayerTurn();
        }
        return;
      }
    }

    // Select a new piece
    if (board[r][c] !== null && getJumps(r, c).length > 0) {
      selected = { r, c };
      renderBoard();
    }
  }

  function executeJump(fr, fc, jump, who) {
    const capturedColor = board[jump.cr][jump.cc];
    board[jump.tr][jump.tc] = board[fr][fc];
    board[fr][fc] = null;
    board[jump.cr][jump.cc] = null;

    if (who === 'player') playerCap[capturedColor]++;
    else aiCap[capturedColor]++;

    // Record move for online sync
    turnMoves.push({ fr, fc, tr: jump.tr, tc: jump.tc, cr: jump.cr, cc: jump.cc, color: capturedColor });

    renderScores();
  }

  function showJumpingState() {
    showEndTurn();
    highlightJumping();
    showValidJumps(jumping.r, jumping.c);
  }

  function endPlayerTurn() {
    const moves = [...turnMoves];
    turnMoves = [];
    jumping = null;
    selected = null;
    hideEndTurn();

    if (onlineMode) {
      // Send moves to opponent, disable board
      turn = 'ai';
      updateTurnUI();
      renderBoard();
      if (onTurnEndCb) onTurnEndCb(moves);
      return;
    }

    // AI mode
    if (!hasAnyJumps()) { endGame(); return; }
    turn = 'ai';
    updateTurnUI();
    renderBoard();
    aiThinking = true;
    setTimeout(aiTurn, 500);
  }

  /* ── Receive opponent moves (online) ────────────────── */
  function applyOpponentMoves(moves, idx) {
    if (!gameActive) return;
    if (idx >= moves.length) {
      if (!hasAnyJumps()) { endGame(); return; }
      turn = 'player';
      updateTurnUI();
      renderBoard();
      return;
    }

    const m = moves[idx];
    const capturedColor = board[m.cr][m.cc];
    board[m.tr][m.tc] = board[m.fr][m.fc];
    board[m.fr][m.fc] = null;
    board[m.cr][m.cc] = null;
    aiCap[capturedColor]++;
    renderScores();
    renderBoard();

    // Highlight opponent's piece
    const cell = getCellEl(m.tr, m.tc);
    const piece = cell && cell.querySelector('.piece');
    if (piece) piece.classList.add('ai-active');

    setTimeout(() => applyOpponentMoves(moves, idx + 1), 400);
  }

  /* ── AI ─────────────────────────────────────────────── */
  function aiTurn() {
    if (!gameActive) return;

    const jumpable = getJumpablePieces();
    if (jumpable.length === 0) { endGame(); return; }

    const sequences = [];
    for (const piece of jumpable) {
      findSequences(piece.r, piece.c, piece.r, piece.c, [], sequences, 0);
    }

    if (sequences.length === 0) { endGame(); return; }

    let chosen;
    if (difficulty === 'easy') {
      const singles = sequences.filter((s) => s.moves.length === 1);
      const pool = singles.length > 0 ? singles : sequences;
      chosen = pool[Math.floor(Math.random() * pool.length)];
    } else {
      const scored = sequences.map((s) => ({ s, score: scoreSeq(s) }));
      scored.sort((a, b) => b.score - a.score);
      if (difficulty === 'normal') {
        const top = Math.min(3, scored.length);
        chosen = scored[Math.floor(Math.random() * top)].s;
      } else {
        chosen = scored[0].s;
      }
    }

    animateAiSequence(chosen, 0);
  }

  function findSequences(origR, origC, r, c, moves, results, depth) {
    if (depth > 8) return;
    const jumps = getJumps(r, c);

    for (const jump of jumps) {
      const color = board[jump.cr][jump.cc];
      const move = { fr: r, fc: c, tr: jump.tr, tc: jump.tc, cr: jump.cr, cc: jump.cc, color };

      const origPiece = board[r][c];
      board[jump.tr][jump.tc] = origPiece;
      board[r][c] = null;
      board[jump.cr][jump.cc] = null;

      moves.push(move);
      results.push({ origR, origC, moves: [...moves] });
      findSequences(origR, origC, jump.tr, jump.tc, moves, results, depth + 1);

      board[r][c] = origPiece;
      board[jump.tr][jump.tc] = null;
      board[jump.cr][jump.cc] = color;
      moves.pop();
    }
  }

  function scoreSeq(seq) {
    let score = 0;
    const tempCap = [...aiCap];
    const minBefore = Math.min(...aiCap);

    for (const move of seq.moves) {
      tempCap[move.color]++;
      score += 1;
      if (aiCap[move.color] <= minBefore) score += 3;
    }

    const setsAfter = Math.min(...tempCap);
    score += (setsAfter - minBefore) * 15;
    score += seq.moves.length * 0.3;

    if (difficulty === 'hard') {
      const playerMin = Math.min(...playerCap);
      for (const move of seq.moves) {
        if (playerCap[move.color] <= playerMin) score += 2;
      }
    }

    return score;
  }

  function animateAiSequence(seq, idx) {
    if (!gameActive) return;
    if (idx >= seq.moves.length) {
      aiThinking = false;
      if (!hasAnyJumps()) { endGame(); return; }
      turn = 'player';
      updateTurnUI();
      renderBoard();
      return;
    }

    const move = seq.moves[idx];
    executeJump(move.fr, move.fc, { tr: move.tr, tc: move.tc, cr: move.cr, cc: move.cc }, 'ai');
    renderBoard();

    const cell = getCellEl(move.tr, move.tc);
    const piece = cell && cell.querySelector('.piece');
    if (piece) piece.classList.add('ai-active');

    setTimeout(() => animateAiSequence(seq, idx + 1), 400);
  }

  /* ── Game End ───────────────────────────────────────── */
  function endGame() {
    gameActive = false;
    aiThinking = false;

    const playerSets = Math.min(...playerCap);
    const aiSets = Math.min(...aiCap);
    const playerTotal = playerCap.reduce((a, b) => a + b, 0);
    const aiTotal = aiCap.reduce((a, b) => a + b, 0);

    const oppLabel = onlineMode ? '상대' : 'AI';
    let result, title, subtitle, icon;
    if (playerSets > aiSets || (playerSets === aiSets && playerTotal > aiTotal)) {
      result = 'win'; title = '승리!'; icon = '🏆';
      subtitle = `${playerSets}세트 (${playerTotal}개) vs ${oppLabel} ${aiSets}세트 (${aiTotal}개)`;
      stats.wins++;
    } else if (playerSets < aiSets || (playerSets === aiSets && playerTotal < aiTotal)) {
      result = 'lose'; title = '패배'; icon = '😢';
      subtitle = `${playerSets}세트 (${playerTotal}개) vs ${oppLabel} ${aiSets}세트 (${aiTotal}개)`;
      stats.losses++;
    } else {
      result = 'draw'; title = '무승부'; icon = '🤝';
      subtitle = `양쪽 모두 ${playerSets}세트, ${playerTotal}개`;
      stats.draws++;
    }

    saveStats();
    renderStats();
    showResult(result, title, subtitle, icon);
  }

  /* ── Rendering ──────────────────────────────────────── */
  function renderBoard() {
    const boardEl = $('board');
    boardEl.innerHTML = '';
    const isMyTurn = turn === 'player' && !jumping && !aiThinking;
    const jumpablePieces = isMyTurn ? getJumpablePieces() : [];

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell' + ((r + c) % 2 === 1 ? ' dark' : '');
        cell.dataset.row = r;
        cell.dataset.col = c;

        if (board[r][c] !== null) {
          const piece = document.createElement('div');
          piece.className = 'piece ' + COLOR_CSS[board[r][c]];

          if (jumpablePieces.some((p) => p.r === r && p.c === c)) {
            piece.classList.add('jumpable');
          }
          if (selected && selected.r === r && selected.c === c) {
            piece.classList.add('selected');
          }
          if (jumping && jumping.r === r && jumping.c === c) {
            piece.classList.add('jumping');
          }

          cell.appendChild(piece);
        }

        cell.addEventListener('click', () => onCellClick(r, c));
        boardEl.appendChild(cell);
      }
    }

    if (selected) showValidJumps(selected.r, selected.c);
    if (jumping) showValidJumps(jumping.r, jumping.c);
  }

  function showValidJumps(r, c) {
    const jumps = getJumps(r, c);
    for (const jump of jumps) {
      const cell = getCellEl(jump.tr, jump.tc);
      if (cell) {
        const dot = document.createElement('div');
        dot.className = 'jump-dot';
        cell.appendChild(dot);
      }
    }
  }

  function highlightJumping() {
    if (!jumping) return;
    const cell = getCellEl(jumping.r, jumping.c);
    const piece = cell && cell.querySelector('.piece');
    if (piece) piece.classList.add('jumping');
  }

  function getCellEl(r, c) {
    const boardEl = $('board');
    const idx = r * SIZE + c;
    return boardEl.children[idx] || null;
  }

  function renderScores() {
    for (let c = 0; c < NUM_COLORS; c++) {
      const pEl = $('player-counts').querySelector(`[data-color="${c}"]`);
      const aEl = $('ai-counts').querySelector(`[data-color="${c}"]`);
      if (pEl) pEl.textContent = playerCap[c];
      if (aEl) aEl.textContent = aiCap[c];
    }
    $('player-sets').textContent = Math.min(...playerCap);
    $('ai-sets').textContent = Math.min(...aiCap);
  }

  function updateTurnUI() {
    const disc = $('turn-disc');
    const text = $('turn-text');
    if (turn === 'player') {
      disc.className = 'turn-disc player';
      text.textContent = onlineMode ? '내 차례 — 말을 선택하세요' : '당신의 차례 — 말을 선택하세요';
    } else {
      disc.className = 'turn-disc ai';
      text.textContent = onlineMode ? '상대방의 차례...' : 'AI 생각 중...';
    }
    $('player-row').classList.toggle('active', turn === 'player');
    $('ai-row').classList.toggle('active', turn === 'ai');
  }

  function showEndTurn() {
    $('end-turn-btn').classList.remove('hidden');
    $('turn-text').textContent = '연속 점프 가능 — 계속하거나 턴 종료';
  }

  function hideEndTurn() {
    $('end-turn-btn').classList.add('hidden');
  }

  /* ── Overlays ───────────────────────────────────────── */
  function hideAllOverlays() {
    $('start-overlay').classList.add('hidden');
    $('result-overlay').classList.add('hidden');
    const lobby = $('lobby-screen');
    if (lobby) lobby.classList.add('hidden');
  }

  function showResult(result, title, subtitle, icon) {
    $('result-icon').textContent = icon;
    const titleEl = $('result-title');
    titleEl.textContent = title;
    titleEl.className = 'over-title result-title ' + result;
    $('result-subtitle').textContent = subtitle;

    const oppLabel = onlineMode ? '상대' : 'AI';
    const scoresEl = $('result-scores');
    scoresEl.innerHTML = '';
    [{ label: '나', cap: playerCap }, { label: oppLabel, cap: aiCap }].forEach(({ label, cap }) => {
      const row = document.createElement('div');
      row.className = 'result-score-row';
      row.innerHTML = `<span class="rs-label">${label}</span><div class="rs-dots">${
        cap.map((n, i) => `<div class="rs-dot" style="background:var(--piece-${['red','blue','green','yellow','purple'][i]})">${n}</div>`).join('')
      }</div><span class="rs-sets">${Math.min(...cap)}세트</span>`;
      scoresEl.appendChild(row);
    });

    $('result-overlay').classList.remove('hidden');
  }

  function showMenu() {
    gameActive = false;
    aiThinking = false;
    onlineMode = false;
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) headerTitle.textContent = 'SKIPPITY';
    const aiLabel = $('ai-label');
    if (aiLabel) aiLabel.textContent = 'AI';
    renderStats();
    hideAllOverlays();
    $('start-overlay').classList.remove('hidden');
  }

  /* ── Stats Persistence ──────────────────────────────── */
  function loadStats() {
    try {
      const saved = JSON.parse(localStorage.getItem(STATS_KEY));
      if (saved) stats = saved;
    } catch (e) { /* ignore */ }
  }

  function saveStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }

  function renderStats() {
    $('stat-wins').textContent = stats.wins;
    $('stat-draws').textContent = stats.draws;
    $('stat-losses').textContent = stats.losses;
  }

  function loadDifficulty() {
    const saved = localStorage.getItem(DIFF_KEY);
    if (saved && ['easy', 'normal', 'hard'].includes(saved)) {
      difficulty = saved;
      document.querySelectorAll('.diff-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.diff === difficulty);
      });
    }
  }

  function saveDifficulty() {
    localStorage.setItem(DIFF_KEY, difficulty);
  }

  /* ── Bootstrap ──────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Public API ─────────────────────────────────────── */
  return {
    // Online mode
    startOnline,
    createBoard,
    flattenBoard,
    applyOpponentMoves,
    hasAnyJumps,
    renderBoard,
    renderScores,
    updateTurnUI,
    showResult,
    showMenu,
    hideAllOverlays,
    endGame,
    isOnline: () => onlineMode,
    isActive: () => gameActive,
    setActive: (v) => { gameActive = v; },
    setOnline: (v) => { onlineMode = v; },
    setOnTurnEnd: (cb) => { onTurnEndCb = cb; },
    getBoard: () => board,
    setBoard: (b) => { board = b; },
  };
})();
