'use strict';

/* ═══════════════════════════════════════════════
   COLOR FIND — Game Logic
   ═══════════════════════════════════════════════ */

const ROUND_TIME    = 5;      // seconds per round
const MAX_LIVES     = 3;
const STORAGE_KEY   = 'colorfind_hs';

/* Delta = how many HSL lightness points the odd tile differs from the base.
   Gets harder as level increases. Minimum 3 to stay visible. */
function getDelta(level) {
  // Level 1 → ~45 pts, level 10 → ~15 pts, level 20+ → ~5 pts
  return Math.max(3, Math.round(45 - (level - 1) * 2.1));
}

/* Grid size: 2×2 → 3×3 → ... capped at 8×8 */
function getGridSize(level) {
  return Math.min(2 + Math.floor((level - 1) / 2), 6);
}

/* ── State ── */
let state = {
  level:      1,
  score:      0,
  lives:      MAX_LIVES,
  highScore:  0,
  running:    false,
  paused:     false,
  timerLeft:  ROUND_TIME,
  timerRaf:   null,
  timerStart: null,
  correctIdx: -1,
  lockInput:  false,
};

/* ── DOM refs ── */
const $ = id => document.getElementById(id);
const screens = {
  start:    $('start-screen'),
  game:     $('game-screen'),
  pause:    $('pause-screen'),
  gameover: $('gameover-screen'),
};

const dom = {
  board:        $('board'),
  timerBar:     $('timer-bar'),
  timerVal:     $('timer-value'),
  scoreVal:     $('score-value'),
  levelVal:     $('level-value'),
  livesWrap:    $('lives-display'),
  levelBadge:   $('level-badge'),
  feedFlash:    $('feedback-flash'),
  comboDisplay: $('combo-display'),

  // start
  hsValue:  $('hs-value'),
  btnStart: $('btn-start'),

  // pause
  btnPause:   $('btn-pause'),
  btnResume:  $('btn-resume'),
  btnQuitP:   $('btn-quit-pause'),

  // game over
  goScore:   $('go-score'),
  goHs:      $('go-hs'),
  goRecord:  $('go-record'),
  btnRestart: $('btn-restart'),
  btnQuitGO:  $('btn-quit-go'),
};

/* ═══════════════════════════════════════════════
   SCREEN MANAGEMENT
   ═══════════════════════════════════════════════ */

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== name);
  });
}

/* ═══════════════════════════════════════════════
   HIGH SCORE
   ═══════════════════════════════════════════════ */

function loadHS() {
  const v = parseInt(localStorage.getItem(STORAGE_KEY), 10);
  state.highScore = isNaN(v) ? 0 : v;
}

function saveHS(score) {
  if (score > state.highScore) {
    state.highScore = score;
    localStorage.setItem(STORAGE_KEY, score);
    return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════
   COLOR GENERATION
   ═══════════════════════════════════════════════ */

/* Random vivid HSL base color */
function randomBaseHSL() {
  const h = Math.floor(Math.random() * 360);
  // Avoid very dark or very light — keep in 30–70% lightness range
  const l = 35 + Math.floor(Math.random() * 35);
  const s = 55 + Math.floor(Math.random() * 30);
  return { h, s, l };
}

function hsl(h, s, l) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/* ═══════════════════════════════════════════════
   BOARD BUILDING
   ═══════════════════════════════════════════════ */

function buildBoard(level) {
  const size      = getGridSize(level);
  const delta     = getDelta(level);
  const total     = size * size;
  const base      = randomBaseHSL();

  /* Pick the odd tile index */
  state.correctIdx = Math.floor(Math.random() * total);

  /* Decide if odd tile is lighter or darker */
  const sign = Math.random() < 0.5 ? 1 : -1;
  let altL = base.l + sign * delta;
  /* Clamp and flip direction if out of range */
  if (altL > 95) altL = base.l - delta;
  if (altL < 5)  altL = base.l + delta;

  const baseColor = hsl(base.h, base.s, base.l);
  const altColor  = hsl(base.h, base.s, altL);

  /* Build grid */
  dom.board.innerHTML = '';
  dom.board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
  dom.board.style.gridTemplateRows    = `repeat(${size}, 1fr)`;

  /* Adjust gap & border-radius based on grid size */
  const gap = size <= 4 ? 6 : size <= 6 ? 5 : 4;
  const rad = size <= 4 ? 10 : size <= 6 ? 7 : 5;
  dom.board.style.gap = `${gap}px`;

  for (let i = 0; i < total; i++) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.style.backgroundColor = i === state.correctIdx ? altColor : baseColor;
    tile.style.borderRadius = `${rad}px`;
    tile.dataset.idx = i;
    tile.setAttribute('role', 'button');
    tile.setAttribute('aria-label', `타일 ${i + 1}`);
    dom.board.appendChild(tile);
  }

  dom.levelBadge.textContent = `레벨 ${level}`;
  dom.levelVal.textContent   = level;
}

/* ═══════════════════════════════════════════════
   TIMER
   ═══════════════════════════════════════════════ */

function startTimer() {
  clearTimer();
  state.timerLeft  = ROUND_TIME;
  state.timerStart = performance.now();
  state.lockInput  = false;
  tickTimer();
}

function tickTimer() {
  const elapsed = (performance.now() - state.timerStart) / 1000;
  const left    = Math.max(0, ROUND_TIME - elapsed);
  state.timerLeft = left;

  const frac = left / ROUND_TIME;
  dom.timerBar.style.transform  = `scaleX(${frac})`;
  dom.timerVal.textContent       = Math.ceil(left);

  const danger = left <= 2;
  dom.timerBar.classList.toggle('danger', danger);
  dom.timerVal.classList.toggle('timer-warning', danger);

  if (left <= 0) {
    onTimeout();
    return;
  }

  state.timerRaf = requestAnimationFrame(tickTimer);
}

function clearTimer() {
  if (state.timerRaf) {
    cancelAnimationFrame(state.timerRaf);
    state.timerRaf = null;
  }
}

/* ═══════════════════════════════════════════════
   GAME FLOW
   ═══════════════════════════════════════════════ */

function startGame() {
  loadHS();
  state.level     = 1;
  state.score     = 0;
  state.lives     = MAX_LIVES;
  state.running   = true;
  state.paused    = false;

  updateScoreHUD();
  updateLivesHUD();
  showScreen('game');
  newRound();
}

function newRound() {
  if (!state.running) return;
  buildBoard(state.level);
  startTimer();
}

function onCorrect(tileEl) {
  if (state.lockInput) return;
  state.lockInput = true;
  clearTimer();

  state.level++;
  state.score = state.level - 1;   // score = levels beaten
  updateScoreHUD();

  /* Pulse animation on correct tile */
  tileEl.classList.add('reveal');

  /* Show combo text */
  showCombo(`레벨 ${state.score}!`);

  setTimeout(() => {
    if (state.running && !state.paused) newRound();
  }, 650);
}

function onWrong(tileEl) {
  if (state.lockInput) return;
  state.lockInput = true;
  clearTimer();

  state.lives = Math.max(0, state.lives - 1);
  updateLivesHUD();

  /* Flash screen red */
  triggerFlash();
  tileEl.classList.add('wrong');

  /* Reveal correct tile */
  const correctTile = dom.board.querySelector(`[data-idx="${state.correctIdx}"]`);
  if (correctTile) {
    setTimeout(() => correctTile.classList.add('reveal'), 150);
  }

  if (state.lives <= 0) {
    setTimeout(() => endGame(), 800);
  } else {
    setTimeout(() => {
      if (state.running && !state.paused) {
        state.lockInput = false;
        newRound();
      }
    }, 900);
  }
}

function onTimeout() {
  if (state.lockInput) return;
  state.lockInput = true;
  clearTimer();

  state.lives = Math.max(0, state.lives - 1);
  updateLivesHUD();

  /* Reveal correct tile with pulse */
  const correctTile = dom.board.querySelector(`[data-idx="${state.correctIdx}"]`);
  if (correctTile) {
    correctTile.classList.add('reveal');
  }

  triggerFlash();

  if (state.lives <= 0) {
    setTimeout(() => endGame(), 900);
  } else {
    setTimeout(() => {
      if (state.running && !state.paused) {
        state.lockInput = false;
        newRound();
      }
    }, 1000);
  }
}

function endGame() {
  state.running = false;
  clearTimer();

  const isNew = saveHS(state.score);

  dom.goScore.textContent = state.score;
  dom.goHs.textContent    = state.highScore;
  dom.goRecord.classList.toggle('visible', isNew);

  showScreen('gameover');
}

function pauseGame() {
  if (!state.running || state.paused) return;
  state.paused = true;
  clearTimer();
  showScreen('pause');
}

function resumeGame() {
  if (!state.paused) return;
  state.paused    = false;
  state.lockInput = false;
  showScreen('game');
  /* Resume timer with remaining time */
  state.timerStart = performance.now() - (ROUND_TIME - state.timerLeft) * 1000;
  tickTimer();
}

/* ═══════════════════════════════════════════════
   HUD UPDATES
   ═══════════════════════════════════════════════ */

function updateScoreHUD() {
  dom.scoreVal.textContent = state.score;
}

function updateLivesHUD() {
  const hearts = dom.livesWrap.querySelectorAll('.heart');
  hearts.forEach((h, i) => {
    h.classList.toggle('lost', i >= state.lives);
  });
}

/* ═══════════════════════════════════════════════
   VISUAL EFFECTS
   ═══════════════════════════════════════════════ */

function triggerFlash() {
  dom.feedFlash.classList.remove('wrong-flash');
  void dom.feedFlash.offsetWidth; // reflow
  dom.feedFlash.classList.add('wrong-flash');
}

let comboTimeout = null;
function showCombo(text) {
  if (comboTimeout) clearTimeout(comboTimeout);
  dom.comboDisplay.textContent = text;
  dom.comboDisplay.classList.remove('show');
  void dom.comboDisplay.offsetWidth;
  dom.comboDisplay.classList.add('show');
  comboTimeout = setTimeout(() => {
    dom.comboDisplay.classList.remove('show');
  }, 700);
}

/* ═══════════════════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════════════════ */

/* Board tap — handle both click (desktop) and touch (mobile) */
function handleTileTap(e) {
  if (!state.running || state.paused || state.lockInput) return;
  const tile = e.target.closest('.tile');
  if (!tile) return;
  const idx = parseInt(tile.dataset.idx, 10);
  if (idx === state.correctIdx) {
    onCorrect(tile);
  } else {
    onWrong(tile);
  }
}

dom.board.addEventListener('click', handleTileTap);

/* On mobile: use touchend to handle tap and prevent double-tap zoom */
dom.board.addEventListener('touchend', e => {
  e.preventDefault();
  handleTileTap(e);
}, { passive: false });

/* Start button */
dom.btnStart.addEventListener('click', startGame);

/* Pause button */
dom.btnPause.addEventListener('click', pauseGame);

/* Resume */
dom.btnResume.addEventListener('click', resumeGame);

/* Quit from pause */
dom.btnQuitP.addEventListener('click', () => {
  state.running = false;
  clearTimer();
  loadHS();
  dom.hsValue.textContent = state.highScore;
  showScreen('start');
});

/* Restart from game over */
dom.btnRestart.addEventListener('click', startGame);

/* Quit from game over */
dom.btnQuitGO.addEventListener('click', () => {
  dom.hsValue.textContent = state.highScore;
  showScreen('start');
});

/* Keyboard: Space = pause/resume, Escape = pause */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' || e.key === ' ') {
    e.preventDefault();
    if (!state.running) return;
    if (state.paused) resumeGame();
    else pauseGame();
  }
});

/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */

function init() {
  loadHS();
  dom.hsValue.textContent = state.highScore;

  /* Build hearts */
  dom.livesWrap.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const span = document.createElement('span');
    span.className = 'heart';
    span.textContent = '♥';
    dom.livesWrap.appendChild(span);
  }

  showScreen('start');
}

init();
