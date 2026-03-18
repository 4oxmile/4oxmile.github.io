/* ============================================================
   MATCH 3 - Gem Swap Puzzle Game
   ============================================================ */
(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────
  const COLS = 8;
  const ROWS = 8;
  const GEMS = ['💎', '🔴', '🟢', '🟡', '🟣', '🔵', '🟠'];
  const GEM_COLORS = [
    '#60A5FA', // 💎 blue
    '#F87171', // 🔴 red
    '#4ADE80', // 🟢 green
    '#FDE047', // 🟡 yellow
    '#C084FC', // 🟣 purple
    '#F472B6', // 🔵 pink
    '#FB923C', // 🟠 orange
  ];
  const GEM_DARK = [
    '#2563EB',
    '#DC2626',
    '#16A34A',
    '#CA8A04',
    '#9333EA',
    '#DB2777',
    '#EA580C',
  ];

  const GAME_TIME = 60; // seconds
  const SWAP_THRESHOLD = 12; // px drag to trigger swap

  // Scoring
  const BASE_SCORE = { 3: 100, 4: 300, 5: 500 };

  // Animation durations (ms)
  const ANIM_SWAP = 180;
  const ANIM_MATCH = 220;
  const ANIM_FALL = 200;

  // ── State ──────────────────────────────────────────────────
  let board = [];          // 2D array [row][col] = gemIndex (0-6) or null
  let score = 0;
  let highScore = 0;
  let totalMatches = 0;
  let maxCombo = 0;
  let timeLeft = GAME_TIME;
  let timerInterval = null;
  let gameActive = false;
  let animating = false;

  // Touch/drag state
  let dragStart = null;    // {row, col, x, y}
  let dragCurrent = null;  // {x, y}

  // Animations
  let swapAnim = null;     // {r1,c1,r2,c2, t, total, dx, dy}
  let fallAnims = [];      // [{row, col, fromY, toY, t, total}]
  let matchAnims = [];     // [{row, col, t, total}]
  let popups = [];         // [{x, y, text, t, total, alpha}]
  let newGemAnims = [];    // [{row, col, t, total}] scale-in anims

  // Canvas
  let canvas, ctx;
  let cellSize = 0;
  let boardOffsetX = 0, boardOffsetY = 0;
  let rafId = null;
  let lastTime = 0;

  // ── DOM ──────────────────────────────────────────────────
  const startScreen    = document.getElementById('start-screen');
  const gameoverScreen = document.getElementById('gameover-screen');
  const scoreDisplay   = document.getElementById('score-display');
  const highscoreDisplay = document.getElementById('highscore-display');
  const startHighscore = document.getElementById('start-highscore');
  const timerDisplay   = document.getElementById('timer-display');
  const timerBar       = document.getElementById('timer-bar');
  const finalScoreEl   = document.getElementById('final-score-value');
  const finalCombosEl  = document.getElementById('final-combos');
  const finalMatchesEl = document.getElementById('final-matches');

  // ── Initialization ──────────────────────────────────────
  function init() {
    canvas = document.getElementById('board-canvas');
    ctx = canvas.getContext('2d');

    loadHighScore();
    updateHighScoreDisplay();

    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);

    // Input
    canvas.addEventListener('touchstart',  onTouchStart,  { passive: false });
    canvas.addEventListener('touchmove',   onTouchMove,   { passive: false });
    canvas.addEventListener('touchend',    onTouchEnd,    { passive: false });
    canvas.addEventListener('touchcancel', onTouchCancel, { passive: false });
    canvas.addEventListener('mousedown',   onMouseDown);
    canvas.addEventListener('mousemove',   onMouseMove);
    canvas.addEventListener('mouseup',     onMouseUp);
    canvas.addEventListener('mouseleave',  onMouseUp);

    // Start screen tap
    startScreen.addEventListener('click', startGame);
    gameoverScreen.addEventListener('click', startGame);

    // Draw idle board
    buildBoard();
    renderFrame(0);
    startRaf();
  }

  function sizeCanvas() {
    const wrapper = document.getElementById('board-wrapper');
    const w = wrapper.clientWidth  - 16;
    const h = wrapper.clientHeight - 16;
    const maxCell = Math.floor(Math.min(w, h) / COLS);
    cellSize = Math.max(36, Math.min(maxCell, 56));
    const boardPx = cellSize * COLS;
    canvas.width  = boardPx;
    canvas.height = boardPx;
    boardOffsetX = 0;
    boardOffsetY = 0;
    // Retina / HiDPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = boardPx * dpr;
    canvas.height = boardPx * dpr;
    canvas.style.width  = boardPx + 'px';
    canvas.style.height = boardPx + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Board Generation ────────────────────────────────────
  function buildBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
      board[r] = [];
      for (let c = 0; c < COLS; c++) {
        board[r][c] = randomGem(r, c);
      }
    }
  }

  function randomGem(row, col) {
    // Exclude gems that would immediately form a match
    const exclude = new Set();
    // Check left 2
    if (col >= 2 &&
        board[row][col-1] === board[row][col-2]) {
      exclude.add(board[row][col-1]);
    }
    // Check above 2
    if (row >= 2 &&
        board[row-1] && board[row-2] &&
        board[row-1][col] === board[row-2][col]) {
      exclude.add(board[row-1][col]);
    }

    let candidates = GEMS.map((_, i) => i).filter(i => !exclude.has(i));
    if (candidates.length === 0) candidates = GEMS.map((_, i) => i);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function randomGemFree() {
    return Math.floor(Math.random() * GEMS.length);
  }

  // ── Game Flow ────────────────────────────────────────────
  function startGame() {
    score = 0;
    timeLeft = GAME_TIME;
    totalMatches = 0;
    maxCombo = 0;
    animating = false;
    swapAnim = null;
    fallAnims = [];
    matchAnims = [];
    popups = [];
    newGemAnims = [];
    dragStart = null;
    dragCurrent = null;

    buildBoard();

    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');

    updateScoreDisplay();
    updateTimerDisplay();

    gameActive = true;

    clearInterval(timerInterval);
    timerInterval = setInterval(tickTimer, 1000);
  }

  function tickTimer() {
    if (!gameActive) return;
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 0) {
      endGame();
    }
  }

  function endGame() {
    gameActive = false;
    clearInterval(timerInterval);
    animating = false;
    dragStart = null;

    if (score > highScore) {
      highScore = score;
      saveHighScore();
    }
    updateHighScoreDisplay();

    finalScoreEl.textContent  = score.toLocaleString();
    finalCombosEl.textContent = maxCombo;
    finalMatchesEl.textContent = totalMatches;
    gameoverScreen.classList.remove('hidden');

    if (typeof Leaderboard !== 'undefined') {
      Leaderboard.ready('match3', score, {});
    }
  }

  // ── Input Handling ───────────────────────────────────────
  function getCell(x, y) {
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return { row, col };
  }

  function getCanvasPos(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function onTouchStart(e) {
    e.preventDefault();
    if (!gameActive || animating) return;
    const t = e.touches[0];
    const pos = getCanvasPos(t.clientX, t.clientY);
    const cell = getCell(pos.x, pos.y);
    if (!cell) return;
    dragStart = { ...cell, x: pos.x, y: pos.y };
    dragCurrent = { x: pos.x, y: pos.y };
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (!dragStart) return;
    const t = e.touches[0];
    const pos = getCanvasPos(t.clientX, t.clientY);
    dragCurrent = pos;
    trySwipeFromDrag();
  }

  function onTouchEnd(e) {
    e.preventDefault();
    dragStart = null;
    dragCurrent = null;
  }

  function onTouchCancel(e) {
    e.preventDefault();
    dragStart = null;
    dragCurrent = null;
  }

  function onMouseDown(e) {
    if (!gameActive || animating) return;
    const pos = getCanvasPos(e.clientX, e.clientY);
    const cell = getCell(pos.x, pos.y);
    if (!cell) return;
    dragStart = { ...cell, x: pos.x, y: pos.y };
    dragCurrent = { x: pos.x, y: pos.y };
  }

  function onMouseMove(e) {
    if (!dragStart) return;
    dragCurrent = getCanvasPos(e.clientX, e.clientY);
    trySwipeFromDrag();
  }

  function onMouseUp() {
    dragStart = null;
    dragCurrent = null;
  }

  function trySwipeFromDrag() {
    if (!dragStart || !dragCurrent || animating || !gameActive) return;
    const dx = dragCurrent.x - dragStart.x;
    const dy = dragCurrent.y - dragStart.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < SWAP_THRESHOLD && absDy < SWAP_THRESHOLD) return;

    let dr = 0, dc = 0;
    if (absDx > absDy) {
      dc = dx > 0 ? 1 : -1;
    } else {
      dr = dy > 0 ? 1 : -1;
    }

    const r2 = dragStart.row + dr;
    const c2 = dragStart.col + dc;
    if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) {
      dragStart = null;
      dragCurrent = null;
      return;
    }

    const r1 = dragStart.row, c1 = dragStart.col;
    dragStart = null;
    dragCurrent = null;

    attemptSwap(r1, c1, r2, c2);
  }

  // ── Game Logic ───────────────────────────────────────────
  function attemptSwap(r1, c1, r2, c2) {
    if (animating) return;
    animating = true;

    // Start swap animation
    const totalX = (c2 - c1) * cellSize;
    const totalY = (r2 - r1) * cellSize;
    swapAnim = { r1, c1, r2, c2, t: 0, total: ANIM_SWAP, dx: totalX, dy: totalY };

    setTimeout(() => {
      // Actually do the swap
      const tmp = board[r1][c1];
      board[r1][c1] = board[r2][c2];
      board[r2][c2] = tmp;
      swapAnim = null;

      const matches = findMatches();
      if (matches.length === 0) {
        // Invalid — swap back with animation
        const totalX2 = (c1 - c2) * cellSize;
        const totalY2 = (r1 - r2) * cellSize;
        swapAnim = { r1: r2, c1: c2, r2: r1, c2: c1, t: 0, total: ANIM_SWAP, dx: totalX2, dy: totalY2 };
        setTimeout(() => {
          const tmp2 = board[r1][c1];
          board[r1][c1] = board[r2][c2];
          board[r2][c2] = tmp2;
          swapAnim = null;
          animating = false;
        }, ANIM_SWAP);
      } else {
        processMatches(matches, 1);
      }
    }, ANIM_SWAP);
  }

  function findMatches() {
    const matched = new Set();

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const gem = board[r][c];
        if (gem === null) { c++; continue; }
        let len = 1;
        while (c + len < COLS && board[r][c + len] === gem) len++;
        if (len >= 3) {
          for (let k = 0; k < len; k++) matched.add(key(r, c + k));
        }
        c += len;
      }
    }

    // Vertical
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS) {
        const gem = board[r][c];
        if (gem === null) { r++; continue; }
        let len = 1;
        while (r + len < ROWS && board[r + len][c] === gem) len++;
        if (len >= 3) {
          for (let k = 0; k < len; k++) matched.add(key(r + k, c));
        }
        r += len;
      }
    }

    return [...matched].map(k => {
      const [r, c] = k.split(',').map(Number);
      return { row: r, col: c };
    });
  }

  function key(r, c) { return r + ',' + c; }

  function processMatches(matches, combo) {
    if (matches.length === 0) {
      animating = false;
      return;
    }

    totalMatches += matches.length;
    if (combo > maxCombo) maxCombo = combo;

    // Score calculation — group by connected runs
    const scoreGained = calcScore(matches, combo);
    score += scoreGained;
    updateScoreDisplay();

    // Start match animations and show popups
    matches.forEach(m => {
      matchAnims.push({ row: m.row, col: m.col, t: 0, total: ANIM_MATCH });
    });

    // Popup in center of match
    const cx = matches.reduce((s, m) => s + m.col, 0) / matches.length;
    const cy = matches.reduce((s, m) => s + m.row, 0) / matches.length;
    const px = (cx + 0.5) * cellSize;
    const py = (cy + 0.5) * cellSize;
    const label = combo > 1 ? `+${scoreGained} x${combo}` : `+${scoreGained}`;
    popups.push({ x: px, y: py, text: label, t: 0, total: 900 });

    setTimeout(() => {
      // Remove matched gems
      matches.forEach(m => { board[m.row][m.col] = null; });
      matchAnims = [];

      // Apply gravity
      applyGravity(() => {
        // Check cascades
        const newMatches = findMatches();
        processMatches(newMatches, combo + 1);
      });
    }, ANIM_MATCH);
  }

  function calcScore(matches, combo) {
    // Group by contiguous horizontal/vertical runs to determine match lengths
    let total = 0;
    const counted = new Set();

    for (const m of matches) {
      if (counted.has(key(m.row, m.col))) continue;
      // Find run length horizontal
      let h = 1;
      while (matches.find(x => x.row === m.row && x.col === m.col + h)) h++;
      // Find run length vertical
      let v = 1;
      while (matches.find(x => x.col === m.col && x.row === m.row + v)) v++;

      if (h >= 3) {
        const pts = h >= 5 ? BASE_SCORE[5] : (BASE_SCORE[h] || BASE_SCORE[3]);
        total += pts;
        for (let i = 0; i < h; i++) counted.add(key(m.row, m.col + i));
      }
      if (v >= 3) {
        const pts = v >= 5 ? BASE_SCORE[5] : (BASE_SCORE[v] || BASE_SCORE[3]);
        total += pts;
        for (let i = 0; i < v; i++) counted.add(key(m.row + i, m.col));
      }
      if (h < 3 && v < 3) {
        // Part of a longer run counted before, or single cell in cross
        total += BASE_SCORE[3];
        counted.add(key(m.row, m.col));
      }
    }

    if (total === 0) total = matches.length * BASE_SCORE[3];

    // Cascade multiplier: +50% per combo chain above 1
    if (combo > 1) {
      total = Math.floor(total * (1 + (combo - 1) * 0.5));
    }
    return total;
  }

  function applyGravity(onDone) {
    // For each column, compact existing gems to the bottom,
    // then spawn new gems in the empty top cells.
    // We track per-gem fall distance for animation.

    fallAnims = [];
    newGemAnims = [];
    let maxFall = 0;
    let spawnCount = 0;

    for (let c = 0; c < COLS; c++) {
      // Collect non-null gems from top to bottom
      const existing = [];
      for (let r = 0; r < ROWS; r++) {
        if (board[r][c] !== null) existing.push(board[r][c]);
      }

      const nullCount = ROWS - existing.length;
      spawnCount += nullCount;

      // Write existing gems back starting from bottom
      for (let i = 0; i < existing.length; i++) {
        const newRow = nullCount + i;
        const oldRow = i; // relative index in existing array (top-down)
        // The gem was originally at some row above; compute fall distance
        // We find its original row by scanning the original board column
        // (already captured in existing[] order which is top→bottom)
        const fallDist = newRow - oldRow; // rows fallen (approximate)
        if (fallDist > maxFall) maxFall = fallDist;
        board[newRow][c] = existing[i];
        if (fallDist > 0) {
          fallAnims.push({
            row: newRow, col: c,
            fromY: oldRow * cellSize,
            toY: newRow * cellSize,
            t: 0, total: ANIM_FALL + fallDist * 18
          });
        }
      }

      // Spawn new gems in empty top cells
      for (let r = 0; r < nullCount; r++) {
        const newGem = randomGemFree();
        board[r][c] = newGem;
        newGemAnims.push({
          row: r, col: c,
          t: 0, total: ANIM_FALL + (nullCount - r) * 20
        });
      }
    }

    const wait = spawnCount > 0
      ? ANIM_FALL + maxFall * 20 + 120
      : ANIM_FALL + 60;

    setTimeout(() => {
      fallAnims = [];
      newGemAnims = [];
      onDone();
    }, wait);
  }

  // ── Display Updates ──────────────────────────────────────
  function updateScoreDisplay() {
    scoreDisplay.textContent = score.toLocaleString();
  }

  function updateHighScoreDisplay() {
    highscoreDisplay.textContent = highScore.toLocaleString();
    startHighscore.textContent   = highScore.toLocaleString();
  }

  function updateTimerDisplay() {
    timerDisplay.textContent = timeLeft;
    const pct = timeLeft / GAME_TIME;
    timerBar.style.width = (pct * 100) + '%';

    const isLow = timeLeft <= 10;
    timerBar.classList.toggle('low', isLow);
    timerDisplay.classList.toggle('low', isLow);
  }

  // ── Persistence ──────────────────────────────────────────
  function loadHighScore() {
    try {
      highScore = parseInt(localStorage.getItem('match3_highscore') || '0', 10) || 0;
    } catch (e) { highScore = 0; }
  }

  function saveHighScore() {
    try {
      localStorage.setItem('match3_highscore', String(highScore));
    } catch (e) {}
  }

  // ── Render Loop ──────────────────────────────────────────
  function startRaf() {
    lastTime = performance.now();
    function loop(now) {
      const dt = now - lastTime;
      lastTime = now;
      update(dt);
      renderFrame(dt);
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    // Advance animation timers
    if (swapAnim) {
      swapAnim.t = Math.min(swapAnim.t + dt, swapAnim.total);
    }
    matchAnims.forEach(a => { a.t = Math.min(a.t + dt, a.total); });
    fallAnims.forEach(a  => { a.t = Math.min(a.t + dt, a.total); });
    newGemAnims.forEach(a => { a.t = Math.min(a.t + dt, a.total); });
    popups.forEach(p => {
      p.t += dt;
    });
    popups = popups.filter(p => p.t < p.total);
  }

  function renderFrame() {
    const w = cellSize * COLS;
    const h = cellSize * ROWS;
    ctx.clearRect(0, 0, w, h);

    drawBoard(w, h);
    drawGems();
    drawFallAnims();
    drawSwapAnim();
    drawMatchAnims();
    drawNewGemAnims();
    drawPopups();
    drawDragHighlight();
  }

  function drawBoard(w, h) {
    // Background
    const isDark = !window.matchMedia('(prefers-color-scheme: light)').matches;
    ctx.fillStyle = isDark ? '#0A0E14' : '#F0F2F5';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = isDark ? 'rgba(48,54,61,0.35)' : 'rgba(208,215,222,0.5)';
    ctx.lineWidth = 1;
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellSize);
      ctx.lineTo(w, r * cellSize);
      ctx.stroke();
    }
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellSize, 0);
      ctx.lineTo(c * cellSize, h);
      ctx.stroke();
    }
  }

  function drawGems() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] === null) continue;

        // Skip if being swap-animated
        if (swapAnim && (
          (swapAnim.r1 === r && swapAnim.c1 === c) ||
          (swapAnim.r2 === r && swapAnim.c2 === c)
        )) continue;

        // Skip if being match-animated
        if (matchAnims.some(a => a.row === r && a.col === c)) continue;

        // Skip if new gem animating
        if (newGemAnims.some(a => a.row === r && a.col === c)) continue;

        // Skip if fall-animated (drawn separately)
        if (fallAnims.some(a => a.row === r && a.col === c)) continue;

        drawGem(board[r][c], c * cellSize, r * cellSize, cellSize, 1, 1);
      }
    }
  }

  function drawGem(gemIdx, x, y, size, alpha, scale) {
    if (gemIdx === null || gemIdx === undefined) return;

    const pad = size * 0.08;
    const cx = x + size / 2;
    const cy = y + size / 2;
    // Gem radius (not multiplied by scale here; scaling done via ctx.scale)
    const r  = (size / 2 - pad);

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    // Scale around gem center
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    const color = GEM_COLORS[gemIdx];
    const dark  = GEM_DARK[gemIdx];

    drawGemShape(ctx, cx, cy, r, color, dark);

    // Emoji on top
    const fontSize = Math.max(10, Math.floor(size * 0.52));
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(GEMS[gemIdx], cx, cy + 1);

    ctx.restore();
  }

  function drawGemShape(ctx, cx, cy, r, color, dark) {
    // Pentagon gem shape
    ctx.beginPath();
    const sides = 6;
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.05, cx, cy, r);
    grad.addColorStop(0, lighten(color, 0.3));
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.fill();

    // Border
    ctx.strokeStyle = dark;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Shine
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.2, cy - r * 0.25, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fill();
  }

  function lighten(hex, amount) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(255, r + Math.round(255 * amount))},${Math.min(255, g + Math.round(255 * amount))},${Math.min(255, b + Math.round(255 * amount))})`;
  }

  function drawSwapAnim() {
    if (!swapAnim) return;
    const p = easeInOut(swapAnim.t / swapAnim.total);
    const { r1, c1, r2, c2, dx, dy } = swapAnim;

    // Draw gem 1 moving toward gem 2 position
    const x1 = c1 * cellSize + dx * p;
    const y1 = r1 * cellSize + dy * p;
    if (board[r1][c1] !== null) drawGem(board[r1][c1], x1, y1, cellSize, 1, 1);

    // Draw gem 2 moving toward gem 1 position
    const x2 = c2 * cellSize - dx * p;
    const y2 = r2 * cellSize - dy * p;
    if (board[r2][c2] !== null) drawGem(board[r2][c2], x2, y2, cellSize, 1, 1);
  }

  function drawMatchAnims() {
    matchAnims.forEach(a => {
      const p = a.t / a.total;
      const scale = 1 + p * 0.3;
      const alpha = 1 - p;
      const gemIdx = board[a.row][a.col];
      if (gemIdx !== null && gemIdx !== undefined) {
        drawGem(gemIdx, a.col * cellSize, a.row * cellSize, cellSize, alpha, scale);
      }
    });
  }

  function drawFallAnims() {
    fallAnims.forEach(a => {
      const p = easeOut(Math.min(a.t / a.total, 1));
      const y = a.fromY + (a.toY - a.fromY) * p;
      const gemIdx = board[a.row][a.col];
      if (gemIdx !== null && gemIdx !== undefined) {
        drawGem(gemIdx, a.col * cellSize, y, cellSize, 1, 1);
      }
    });
  }

  function drawNewGemAnims() {
    newGemAnims.forEach(a => {
      const p = easeOut(Math.min(a.t / a.total, 1));
      const scale = p;
      const gemIdx = board[a.row][a.col];
      if (gemIdx !== null && gemIdx !== undefined) {
        drawGem(gemIdx, a.col * cellSize, a.row * cellSize, cellSize, p, scale);
      }
    });
  }

  function drawPopups() {
    popups.forEach(p => {
      const progress = p.t / p.total;
      const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
      const rise = progress * cellSize * 1.5;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.round(cellSize * 0.35)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(p.text, p.x + 1, p.y - rise + 1);

      ctx.fillStyle = '#FDE047';
      ctx.fillText(p.text, p.x, p.y - rise);
      ctx.restore();
    });
  }

  function drawDragHighlight() {
    if (!dragStart || !gameActive) return;
    const { row, col } = dragStart;
    const x = col * cellSize;
    const y = row * cellSize;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur = 8;
    const pad = 3;
    roundRect(ctx, x + pad, y + pad, cellSize - pad * 2, cellSize - pad * 2, 6);
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Easing ───────────────────────────────────────────────
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // ── Bootstrap ────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
