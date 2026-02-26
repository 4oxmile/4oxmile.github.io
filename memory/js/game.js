'use strict';

// ─── EMOJI POOL ───────────────────────────────────────────────────────────────
const EMOJI_POOL = [
  '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼',
  '🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈',
  '🦋','🐙','🦑','🦀','🐡','🦄','🐲','🦕',
  '🌸','🌺','🌻','🌹','🍀','🌈','⭐','🍄',
];

// ─── GRID CONFIGS ─────────────────────────────────────────────────────────────
const GRID_CONFIGS = {
  '3x4': { cols: 3, rows: 4, pairs: 6,  label: '3×4', desc: '12장' },
  '4x4': { cols: 4, rows: 4, pairs: 8,  label: '4×4', desc: '16장' },
  '4x5': { cols: 4, rows: 5, pairs: 10, label: '4×5', desc: '20장' },
};

// ─── STATE ────────────────────────────────────────────────────────────────────
let state = {
  selectedSize: '4x4',
  cards: [],           // { id, emoji, flipped, matched, el }
  flipped: [],         // indices of currently face-up unmatched cards
  moves: 0,
  matched: 0,
  totalPairs: 0,
  timerInterval: null,
  elapsedSeconds: 0,
  locked: false,       // block input during mismatch delay
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'memory_best';

function getBests() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveBest(size, moves) {
  const bests = getBests();
  bests[size] = moves;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bests));
}

function getBest(size) {
  return getBests()[size] ?? null;
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function startTimer() {
  stopTimer();
  state.elapsedSeconds = 0;
  updateTimerDisplay();
  state.timerInterval = setInterval(() => {
    state.elapsedSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const m = Math.floor(state.elapsedSeconds / 60).toString().padStart(2, '0');
  const s = (state.elapsedSeconds % 60).toString().padStart(2, '0');
  document.getElementById('timer-val').textContent = `${m}:${s}`;
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── SHUFFLE ──────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── BUILD BOARD ──────────────────────────────────────────────────────────────
function buildBoard(sizeKey) {
  const cfg = GRID_CONFIGS[sizeKey];
  const chosen = shuffle(EMOJI_POOL).slice(0, cfg.pairs);
  const pairs = shuffle([...chosen, ...chosen]);

  state.cards = pairs.map((emoji, i) => ({
    id: i,
    emoji,
    flipped: false,
    matched: false,
    el: null,
  }));
  state.flipped = [];
  state.moves = 0;
  state.matched = 0;
  state.totalPairs = cfg.pairs;
  state.locked = false;

  const board = document.getElementById('board');
  board.className = `board grid-${sizeKey}`;
  board.innerHTML = '';

  state.cards.forEach((card, idx) => {
    const el = createCardElement(card, idx);
    card.el = el;
    board.appendChild(el);
  });

  updateStats();
  updateProgress();
}

function createCardElement(card, idx) {
  const el = document.createElement('div');
  el.className = 'card';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', '카드');
  el.dataset.idx = idx;

  el.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-back">
        <span class="card-back-icon">✦</span>
      </div>
      <div class="card-face card-front">${card.emoji}</div>
    </div>`;

  el.addEventListener('click', () => handleCardClick(idx));
  return el;
}

// ─── CARD LOGIC ───────────────────────────────────────────────────────────────
function handleCardClick(idx) {
  const card = state.cards[idx];

  // Block if locked, already flipped, or already matched
  if (state.locked) return;
  if (card.flipped || card.matched) return;
  if (state.flipped.length >= 2) return;

  // Start timer on first flip
  if (state.moves === 0 && state.flipped.length === 0) {
    startTimer();
  }

  flipCard(card, true);
  state.flipped.push(idx);

  if (state.flipped.length === 2) {
    state.moves++;
    updateStats();
    checkMatch();
  }
}

function flipCard(card, faceUp) {
  card.flipped = faceUp;
  if (faceUp) {
    card.el.classList.add('flipped');
  } else {
    card.el.classList.remove('flipped');
  }
}

function checkMatch() {
  const [a, b] = state.flipped;
  const cardA = state.cards[a];
  const cardB = state.cards[b];

  if (cardA.emoji === cardB.emoji) {
    // Match!
    state.locked = true;
    setTimeout(() => {
      setMatched(cardA);
      setMatched(cardB);
      state.flipped = [];
      state.matched++;
      state.locked = false;
      updateProgress();

      if (state.matched === state.totalPairs) {
        stopTimer();
        setTimeout(showVictory, 400);
      }
    }, 300);
  } else {
    // Mismatch
    state.locked = true;
    cardA.el.classList.add('wrong');
    cardB.el.classList.add('wrong');
    setTimeout(() => {
      cardA.el.classList.remove('wrong');
      cardB.el.classList.remove('wrong');
      flipCard(cardA, false);
      flipCard(cardB, false);
      state.flipped = [];
      state.locked = false;
    }, 800);
  }
}

function setMatched(card) {
  card.matched = true;
  card.el.classList.remove('flipped');
  card.el.classList.add('matched');
  card.el.setAttribute('aria-label', `매칭됨: ${card.emoji}`);
}

// ─── STATS / PROGRESS ─────────────────────────────────────────────────────────
function updateStats() {
  document.getElementById('moves-val').textContent = state.moves;
}

function updateProgress() {
  const pct = state.totalPairs > 0
    ? (state.matched / state.totalPairs) * 100
    : 0;
  document.getElementById('progress-fill').style.width = pct + '%';
}

// ─── VICTORY ──────────────────────────────────────────────────────────────────
function showVictory() {
  if(typeof Leaderboard!=='undefined')Leaderboard.ready('memory',state.moves,{ascending:true,label:'이동'});
  const size = state.selectedSize;
  const moves = state.moves;
  const time  = state.elapsedSeconds;
  const prevBest = getBest(size);
  const isNewBest = prevBest === null || moves < prevBest;

  if (isNewBest) saveBest(size, moves);

  const bestVal = isNewBest ? moves : prevBest;

  document.getElementById('v-size').textContent   = GRID_CONFIGS[size].label;
  document.getElementById('v-moves').textContent  = moves + '번';
  document.getElementById('v-time').textContent   = formatTime(time);

  const bestEl = document.getElementById('v-best');
  const badgeEl = document.getElementById('v-best-badge');
  bestEl.textContent = bestVal + '번';
  bestEl.className = 'stat-value' + (isNewBest ? ' new-best' : '');
  badgeEl.style.display = isNewBest ? 'inline' : 'none';

  showOverlay('victory-screen');
}

// ─── OVERLAY HELPERS ──────────────────────────────────────────────────────────
function showOverlay(id) {
  document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hideOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// ─── START SCREEN ─────────────────────────────────────────────────────────────
function renderStartScreen() {
  // Size buttons
  const bests = getBests();
  document.querySelectorAll('.size-btn').forEach(btn => {
    const sz = btn.dataset.size;
    btn.classList.toggle('active', sz === state.selectedSize);
  });

  // Best records panel
  const recordsEl = document.getElementById('best-records');
  recordsEl.innerHTML = '';
  Object.entries(GRID_CONFIGS).forEach(([sz, cfg]) => {
    const best = bests[sz];
    const row = document.createElement('div');
    row.className = 'best-row';
    row.innerHTML = `
      <span class="best-row-label">${cfg.label} 최고 기록</span>
      <span class="best-row-val">${best !== undefined ? best + '번' : '—'}</span>`;
    recordsEl.appendChild(row);
  });

  showOverlay('start-screen');
}

// ─── NEW GAME ─────────────────────────────────────────────────────────────────
function startNewGame(size) {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  stopTimer();
  state.selectedSize = size;
  buildBoard(size);

  // Update header label
  document.getElementById('header-size-label').textContent = GRID_CONFIGS[size].label;

  hideOverlay('start-screen');
  hideOverlay('victory-screen');
}

function restartCurrentGame() {
  stopTimer();
  startNewGame(state.selectedSize);
}

// ─── EVENT BINDING ────────────────────────────────────────────────────────────
function bindEvents() {
  // Size selector buttons
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedSize = btn.dataset.size;
      document.querySelectorAll('.size-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.size === state.selectedSize)
      );
    });
  });

  // Start button
  document.getElementById('start-btn').addEventListener('click', () => {
    startNewGame(state.selectedSize);
  });

  // Victory: play again (same size)
  document.getElementById('v-again-btn').addEventListener('click', () => {
    startNewGame(state.selectedSize);
  });

  // Victory: change size -> back to start screen
  document.getElementById('v-menu-btn').addEventListener('click', () => {
    stopTimer();
    renderStartScreen();
  });

  // In-game: home button
  document.getElementById('home-btn').addEventListener('click', () => {
    stopTimer();
    renderStartScreen();
  });

  // In-game: restart button (header icon)
  document.getElementById('restart-icon-btn').addEventListener('click', () => {
    restartCurrentGame();
  });

  // In-game: restart button (footer)
  document.getElementById('restart-btn').addEventListener('click', () => {
    restartCurrentGame();
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  bindEvents();
  renderStartScreen();
}

document.addEventListener('DOMContentLoaded', init);
