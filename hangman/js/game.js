'use strict';

// ── WORD BANK ──────────────────────────────────────────────────────────────
const WORD_BANK = [
  // 동물 (Animals)
  { word: 'ELEPHANT',   category: '동물',  icon: '🐘' },
  { word: 'TIGER',      category: '동물',  icon: '🐅' },
  { word: 'PENGUIN',    category: '동물',  icon: '🐧' },
  { word: 'DOLPHIN',    category: '동물',  icon: '🐬' },
  { word: 'GIRAFFE',    category: '동물',  icon: '🦒' },
  { word: 'KANGAROO',   category: '동물',  icon: '🦘' },
  { word: 'CROCODILE',  category: '동물',  icon: '🐊' },
  { word: 'FLAMINGO',   category: '동물',  icon: '🦩' },
  { word: 'CHEETAH',    category: '동물',  icon: '🐆' },
  { word: 'GORILLA',    category: '동물',  icon: '🦍' },
  { word: 'RACCOON',    category: '동물',  icon: '🦝' },
  { word: 'HEDGEHOG',   category: '동물',  icon: '🦔' },
  { word: 'OCTOPUS',    category: '동물',  icon: '🐙' },
  { word: 'BUTTERFLY',  category: '동물',  icon: '🦋' },
  { word: 'PEACOCK',    category: '동물',  icon: '🦚' },
  // 과일 (Fruits)
  { word: 'APPLE',      category: '과일',  icon: '🍎' },
  { word: 'BANANA',     category: '과일',  icon: '🍌' },
  { word: 'MANGO',      category: '과일',  icon: '🥭' },
  { word: 'PINEAPPLE',  category: '과일',  icon: '🍍' },
  { word: 'WATERMELON', category: '과일',  icon: '🍉' },
  { word: 'BLUEBERRY',  category: '과일',  icon: '🫐' },
  { word: 'STRAWBERRY', category: '과일',  icon: '🍓' },
  { word: 'CHERRY',     category: '과일',  icon: '🍒' },
  { word: 'PEACH',      category: '과일',  icon: '🍑' },
  { word: 'LEMON',      category: '과일',  icon: '🍋' },
  { word: 'GRAPE',      category: '과일',  icon: '🍇' },
  { word: 'COCONUT',    category: '과일',  icon: '🥥' },
  { word: 'MELON',      category: '과일',  icon: '🍈' },
  { word: 'KIWI',       category: '과일',  icon: '🥝' },
  { word: 'PAPAYA',     category: '과일',  icon: '🍈' },
  // 나라 (Countries)
  { word: 'JAPAN',      category: '나라',  icon: '🇯🇵' },
  { word: 'BRAZIL',     category: '나라',  icon: '🇧🇷' },
  { word: 'CANADA',     category: '나라',  icon: '🇨🇦' },
  { word: 'FRANCE',     category: '나라',  icon: '🇫🇷' },
  { word: 'GERMANY',    category: '나라',  icon: '🇩🇪' },
  { word: 'ITALY',      category: '나라',  icon: '🇮🇹' },
  { word: 'EGYPT',      category: '나라',  icon: '🇪🇬' },
  { word: 'MEXICO',     category: '나라',  icon: '🇲🇽' },
  { word: 'SWEDEN',     category: '나라',  icon: '🇸🇪' },
  { word: 'NORWAY',     category: '나라',  icon: '🇳🇴' },
  { word: 'GREECE',     category: '나라',  icon: '🇬🇷' },
  { word: 'TURKEY',     category: '나라',  icon: '🇹🇷' },
  { word: 'PORTUGAL',   category: '나라',  icon: '🇵🇹' },
  { word: 'VIETNAM',    category: '나라',  icon: '🇻🇳' },
  { word: 'THAILAND',   category: '나라',  icon: '🇹🇭' },
  // 음식 (Food)
  { word: 'PIZZA',      category: '음식',  icon: '🍕' },
  { word: 'BURGER',     category: '음식',  icon: '🍔' },
  { word: 'SUSHI',      category: '음식',  icon: '🍣' },
  { word: 'NOODLE',     category: '음식',  icon: '🍜' },
  { word: 'PANCAKE',    category: '음식',  icon: '🥞' },
  { word: 'DUMPLING',   category: '음식',  icon: '🥟' },
  { word: 'CROISSANT',  category: '음식',  icon: '🥐' },
  { word: 'SANDWICH',   category: '음식',  icon: '🥪' },
  { word: 'WAFFLE',     category: '음식',  icon: '🧇' },
  { word: 'BURRITO',    category: '음식',  icon: '🌯' },
  { word: 'PRETZEL',    category: '음식',  icon: '🥨' },
  { word: 'DONUT',      category: '음식',  icon: '🍩' },
  { word: 'COOKIE',     category: '음식',  icon: '🍪' },
  { word: 'CUPCAKE',    category: '음식',  icon: '🧁' },
  { word: 'BROWNIE',    category: '음식',  icon: '🍫' },
  // 직업 (Professions)
  { word: 'DOCTOR',     category: '직업',  icon: '👨‍⚕️' },
  { word: 'PILOT',      category: '직업',  icon: '🧑‍✈️' },
  { word: 'ARTIST',     category: '직업',  icon: '👩‍🎨' },
  { word: 'LAWYER',     category: '직업',  icon: '🧑‍⚖️' },
  { word: 'NURSE',      category: '직업',  icon: '👩‍⚕️' },
  { word: 'TEACHER',    category: '직업',  icon: '👩‍🏫' },
  { word: 'SCIENTIST',  category: '직업',  icon: '🧑‍🔬' },
  { word: 'ENGINEER',   category: '직업',  icon: '🧑‍💻' },
  { word: 'FARMER',     category: '직업',  icon: '🧑‍🌾' },
  { word: 'BAKER',      category: '직업',  icon: '🧑‍🍳' },
  { word: 'CHEF',       category: '직업',  icon: '👨‍🍳' },
  { word: 'JUDGE',      category: '직업',  icon: '👨‍⚖️' },
  { word: 'ACTOR',      category: '직업',  icon: '🧑‍🎤' },
  { word: 'DANCER',     category: '직업',  icon: '💃' },
  { word: 'WRITER',     category: '직업',  icon: '✍️' },
  // 스포츠 (Sports)
  { word: 'SOCCER',     category: '스포츠', icon: '⚽' },
  { word: 'TENNIS',     category: '스포츠', icon: '🎾' },
  { word: 'BOXING',     category: '스포츠', icon: '🥊' },
  { word: 'CYCLING',    category: '스포츠', icon: '🚴' },
  { word: 'SURFING',    category: '스포츠', icon: '🏄' },
  { word: 'ARCHERY',    category: '스포츠', icon: '🏹' },
  { word: 'FENCING',    category: '스포츠', icon: '🤺' },
  { word: 'BOWLING',    category: '스포츠', icon: '🎳' },
  { word: 'CLIMBING',   category: '스포츠', icon: '🧗' },
  { word: 'SKATING',    category: '스포츠', icon: '⛸️' },
  { word: 'SWIMMING',   category: '스포츠', icon: '🏊' },
  { word: 'BASEBALL',   category: '스포츠', icon: '⚾' },
  { word: 'FOOTBALL',   category: '스포츠', icon: '🏈' },
  { word: 'VOLLEYBALL', category: '스포츠', icon: '🏐' },
  { word: 'BADMINTON',  category: '스포츠', icon: '🏸' },
  // 자연 (Nature)
  { word: 'VOLCANO',    category: '자연',  icon: '🌋' },
  { word: 'GLACIER',    category: '자연',  icon: '🏔️' },
  { word: 'RAINBOW',    category: '자연',  icon: '🌈' },
  { word: 'TORNADO',    category: '자연',  icon: '🌪️' },
  { word: 'THUNDER',    category: '자연',  icon: '⛈️' },
  { word: 'CANYON',     category: '자연',  icon: '🏜️' },
  { word: 'FOREST',     category: '자연',  icon: '🌲' },
  { word: 'DESERT',     category: '자연',  icon: '🏝️' },
  { word: 'TUNDRA',     category: '자연',  icon: '❄️' },
  { word: 'MEADOW',     category: '자연',  icon: '🌿' },
  // 우주 (Space)
  { word: 'ASTEROID',   category: '우주',  icon: '☄️' },
  { word: 'NEBULA',     category: '우주',  icon: '✨' },
  { word: 'GALAXY',     category: '우주',  icon: '🌌' },
  { word: 'COMET',      category: '우주',  icon: '☄️' },
  { word: 'SATURN',     category: '우주',  icon: '🪐' },
  { word: 'JUPITER',    category: '우주',  icon: '🌍' },
  { word: 'NEPTUNE',    category: '우주',  icon: '🔵' },
  { word: 'MERCURY',    category: '우주',  icon: '⭐' },
  { word: 'QUASAR',     category: '우주',  icon: '💫' },
  { word: 'PULSAR',     category: '우주',  icon: '⚡' },
];

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const MAX_WRONG = 6;
const KEYBOARD_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M'],
];

// ── STATE ──────────────────────────────────────────────────────────────────
let state = {
  word: '',
  category: '',
  catIcon: '',
  guessed: new Set(),
  wrongCount: 0,
  gameOver: false,
  wins: 0,
  losses: 0,
  streak: 0,
};

// ── DOM REFS ───────────────────────────────────────────────────────────────
const startOverlay  = document.getElementById('startOverlay');
const resultOverlay = document.getElementById('resultOverlay');
const canvas        = document.getElementById('hangmanCanvas');
const ctx           = canvas.getContext('2d');
const wordDisplay   = document.getElementById('wordDisplay');
const categoryBadge = document.getElementById('categoryBadge');
const wrongCounter  = document.getElementById('wrongCounter');
const keyboardEl    = document.getElementById('keyboard');
const statsWin      = document.getElementById('statsWin');
const statsLose     = document.getElementById('statsLose');
const statsStreak   = document.getElementById('statsStreak');
const hsWin         = document.getElementById('hsWin');
const hsLose        = document.getElementById('hsLose');
const hsStreak      = document.getElementById('hsStreak');
const resultIcon    = document.getElementById('resultIcon');
const resultTitle   = document.getElementById('resultTitle');
const resultWord    = document.getElementById('resultWord');

// Start overlay stats
const startWin    = document.getElementById('startWin');
const startLose   = document.getElementById('startLose');
const startStreak = document.getElementById('startStreak');

// ── CANVAS SIZING ─────────────────────────────────────────────────────────
function sizeCanvas() {
  const vw = Math.min(window.innerWidth, 480);
  const size = Math.min(vw - 32, 240);
  canvas.width  = size;
  canvas.height = size * 0.72;
}

// ── HANGMAN DRAWING ───────────────────────────────────────────────────────
function getColor() {
  const dark = !window.matchMedia('(prefers-color-scheme: light)').matches;
  return dark ? '#8B949E' : '#57606A';
}

function getAccentColor() {
  const dark = !window.matchMedia('(prefers-color-scheme: light)').matches;
  return dark ? '#F0F6FC' : '#1B1E28';
}

function drawHangman(wrong) {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const col    = getColor();
  const figCol = getAccentColor();
  ctx.strokeStyle = col;
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';

  // -- Gallows structure --
  // Base
  ctx.beginPath();
  ctx.moveTo(W * 0.08, H * 0.92);
  ctx.lineTo(W * 0.92, H * 0.92);
  ctx.stroke();

  // Pole (vertical)
  ctx.beginPath();
  ctx.moveTo(W * 0.22, H * 0.92);
  ctx.lineTo(W * 0.22, H * 0.06);
  ctx.stroke();

  // Top beam (horizontal)
  ctx.beginPath();
  ctx.moveTo(W * 0.22, H * 0.06);
  ctx.lineTo(W * 0.62, H * 0.06);
  ctx.stroke();

  // Rope
  ctx.beginPath();
  ctx.moveTo(W * 0.62, H * 0.06);
  ctx.lineTo(W * 0.62, H * 0.18);
  ctx.stroke();

  // Support brace
  ctx.beginPath();
  ctx.moveTo(W * 0.22, H * 0.16);
  ctx.lineTo(W * 0.35, H * 0.06);
  ctx.stroke();

  if (wrong < 1) return;

  const cx   = W * 0.62;
  const r    = H * 0.09;
  const headT = H * 0.18;
  const headB = headT + r * 2;

  ctx.strokeStyle = figCol;
  ctx.lineWidth   = 2.5;

  // 1 — Head
  if (wrong >= 1) {
    ctx.beginPath();
    ctx.arc(cx, headT + r, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 2 — Body
  const bodyT = headB;
  const bodyB = bodyT + H * 0.28;
  if (wrong >= 2) {
    ctx.beginPath();
    ctx.moveTo(cx, bodyT);
    ctx.lineTo(cx, bodyB);
    ctx.stroke();
  }

  // 3 — Left arm
  if (wrong >= 3) {
    ctx.beginPath();
    ctx.moveTo(cx, bodyT + H * 0.06);
    ctx.lineTo(cx - W * 0.12, bodyT + H * 0.16);
    ctx.stroke();
  }

  // 4 — Right arm
  if (wrong >= 4) {
    ctx.beginPath();
    ctx.moveTo(cx, bodyT + H * 0.06);
    ctx.lineTo(cx + W * 0.12, bodyT + H * 0.16);
    ctx.stroke();
  }

  // 5 — Left leg
  if (wrong >= 5) {
    ctx.beginPath();
    ctx.moveTo(cx, bodyB);
    ctx.lineTo(cx - W * 0.12, bodyB + H * 0.14);
    ctx.stroke();
  }

  // 6 — Right leg
  if (wrong >= 6) {
    ctx.beginPath();
    ctx.moveTo(cx, bodyB);
    ctx.lineTo(cx + W * 0.12, bodyB + H * 0.14);
    ctx.stroke();
  }
}

// ── STORAGE ────────────────────────────────────────────────────────────────
function loadStats() {
  try {
    const raw = localStorage.getItem('hangman_stats');
    if (!raw) return;
    const data = JSON.parse(raw);
    state.wins   = data.wins   || 0;
    state.losses = data.losses || 0;
    state.streak = data.streak || 0;
  } catch (_) {}
}

function saveStats() {
  localStorage.setItem('hangman_stats', JSON.stringify({
    wins:   state.wins,
    losses: state.losses,
    streak: state.streak,
  }));
}

// ── UI HELPERS ─────────────────────────────────────────────────────────────
function updateHeaderStats() {
  hsWin.textContent    = state.wins;
  hsLose.textContent   = state.losses;
  hsStreak.textContent = state.streak;
}

function updateStartStats() {
  startWin.textContent    = state.wins;
  startLose.textContent   = state.losses;
  startStreak.textContent = state.streak;
}

function renderWord() {
  wordDisplay.innerHTML = '';
  for (const ch of state.word) {
    const tile = document.createElement('div');
    tile.className = 'letter-tile';

    const letterEl = document.createElement('div');
    letterEl.className = 'letter';

    const lineEl = document.createElement('div');
    lineEl.className = 'underline';

    if (state.guessed.has(ch)) {
      letterEl.textContent = ch;
      tile.classList.add('revealed');
    } else {
      letterEl.textContent = ch; // still in DOM but invisible via CSS
      letterEl.classList.add('hidden-letter');
    }

    tile.appendChild(letterEl);
    tile.appendChild(lineEl);
    wordDisplay.appendChild(tile);
  }
}

function renderKeyboard() {
  keyboardEl.innerHTML = '';
  for (const row of KEYBOARD_ROWS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'keyboard-row';
    for (const letter of row) {
      const btn = document.createElement('button');
      btn.className   = 'key-btn';
      btn.textContent = letter;
      btn.dataset.letter = letter;
      if (state.guessed.has(letter)) {
        const correct = state.word.includes(letter);
        btn.classList.add(correct ? 'correct' : 'wrong');
        btn.disabled = true;
      } else if (state.gameOver) {
        btn.disabled = true;
      }
      btn.addEventListener('click', () => handleGuess(letter));
      rowEl.appendChild(btn);
    }
    keyboardEl.appendChild(rowEl);
  }
}

function updateWrongCounter() {
  wrongCounter.innerHTML = `오답: <span>${state.wrongCount}</span> / ${MAX_WRONG}`;
}

function updateCategoryBadge() {
  categoryBadge.innerHTML = `<span class="cat-icon">${state.catIcon}</span>${state.category}`;
}

// ── GAME LOGIC ─────────────────────────────────────────────────────────────
function pickWord() {
  const idx = Math.floor(Math.random() * WORD_BANK.length);
  return WORD_BANK[idx];
}

function startGame() {
  const entry      = pickWord();
  state.word       = entry.word;
  state.category   = entry.category;
  state.catIcon    = entry.icon;
  state.guessed    = new Set();
  state.wrongCount = 0;
  state.gameOver   = false;

  hideOverlay(resultOverlay);
  hideOverlay(startOverlay);

  sizeCanvas();
  drawHangman(0);
  renderWord();
  renderKeyboard();
  updateWrongCounter();
  updateCategoryBadge();
  updateHeaderStats();
}

function handleGuess(letter) {
  if (state.gameOver || state.guessed.has(letter)) return;

  state.guessed.add(letter);

  const isCorrect = state.word.includes(letter);
  if (!isCorrect) {
    state.wrongCount++;
  }

  drawHangman(state.wrongCount);
  renderWord();
  renderKeyboard();
  updateWrongCounter();

  checkGameOver();
}

function checkGameOver() {
  const allRevealed = [...state.word].every(ch => state.guessed.has(ch));

  if (allRevealed) {
    state.gameOver = true;
    state.wins++;
    state.streak++;
    saveStats();
    updateHeaderStats();
    setTimeout(() => showResult(true), 400);
    return;
  }

  if (state.wrongCount >= MAX_WRONG) {
    state.gameOver = true;
    state.losses++;
    state.streak = 0;
    saveStats();
    updateHeaderStats();
    // Reveal all letters
    for (const ch of state.word) state.guessed.add(ch);
    renderWord();
    renderKeyboard();
    setTimeout(() => showResult(false), 400);
  }
}

// ── OVERLAYS ───────────────────────────────────────────────────────────────
function showOverlay(el) {
  el.classList.remove('hidden');
}

function hideOverlay(el) {
  el.classList.add('hidden');
}

function showResult(isWin) {
  if (isWin) {
    resultIcon.textContent  = '🎉';
    resultTitle.textContent = '정답!';
    resultTitle.className   = 'result-title win';
    resultWord.innerHTML    = `단어: <span>${state.word}</span>`;
  } else {
    resultIcon.textContent  = '💀';
    resultTitle.textContent = '게임 오버';
    resultTitle.className   = 'result-title lose';
    resultWord.innerHTML    = `정답: <span>${state.word}</span>`;
  }
  statsWin.textContent    = state.wins;
  statsLose.textContent   = state.losses;
  statsStreak.textContent = state.streak;
  showOverlay(resultOverlay);
}

// ── KEYBOARD SUPPORT ───────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (state.gameOver) return;
  const letter = e.key.toUpperCase();
  if (/^[A-Z]$/.test(letter) && !state.guessed.has(letter)) {
    handleGuess(letter);
  }
});

// ── INIT ───────────────────────────────────────────────────────────────────
function init() {
  loadStats();
  updateStartStats();

  sizeCanvas();
  drawHangman(0);

  // Button wiring
  document.getElementById('btnStart').addEventListener('click', startGame);
  document.getElementById('btnPlayAgain').addEventListener('click', startGame);
  document.getElementById('btnBackToMenu').addEventListener('click', () => {
    hideOverlay(resultOverlay);
    updateStartStats();
    showOverlay(startOverlay);
  });

  // Resize
  window.addEventListener('resize', () => {
    sizeCanvas();
    drawHangman(state.wrongCount);
  });

  // Color scheme change
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    drawHangman(state.wrongCount);
  });

  // Show start overlay
  showOverlay(startOverlay);
}

document.addEventListener('DOMContentLoaded', init);
