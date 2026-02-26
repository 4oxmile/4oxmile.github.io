/* ─── Constants ─────────────────────────────────────── */
const GAME_DURATION   = 30;     // seconds
const HOLES           = 9;
const LS_KEY          = 'mole_best';

/* Speed schedule: [elapsed seconds, mole visible ms, interval ms] */
const SPEED_SCHEDULE = [
  { after:  0, visibleMs: 1100, intervalMs: 1200 },
  { after:  5, visibleMs:  950, intervalMs: 1050 },
  { after: 10, visibleMs:  800, intervalMs:  900 },
  { after: 15, visibleMs:  650, intervalMs:  750 },
  { after: 20, visibleMs:  520, intervalMs:  620 },
  { after: 25, visibleMs:  400, intervalMs:  500 },
];

/* ─── State ─────────────────────────────────────────── */
let score     = 0;
let bestScore = parseInt(localStorage.getItem(LS_KEY) || '0', 10);
let combo     = 0;
let timeLeft  = GAME_DURATION;
let running   = false;

let moleTimers   = Array(HOLES).fill(null);   // per-hole hide timers
let tickInterval = null;
let spawnInterval= null;
let lastSpawnCfg = null;

/* ─── DOM Refs ──────────────────────────────────────── */
const $ = id => document.getElementById(id);
const startOverlay    = $('start-overlay');
const gameoverOverlay = $('gameover-overlay');
const scoreValue      = $('score-value');
const timerValue      = $('timer-value');
const comboDisplay    = $('combo-display');
const finalScore      = $('final-score');
const finalBest       = $('final-best');
const newRecordBadge  = $('new-record-badge');
const bestScoreStart  = $('best-score-start');
const bestScoreBottom = $('best-score-bottom');
const board           = $('board');

/* ─── Build Grid ────────────────────────────────────── */
const holes = [];
for (let i = 0; i < HOLES; i++) {
  const hole = document.createElement('div');
  hole.className = 'hole';
  hole.dataset.idx = i;

  const mole = document.createElement('div');
  mole.className = 'mole';
  mole.textContent = '🐹';
  mole.dataset.idx = i;
  hole.appendChild(mole);

  hole.addEventListener('pointerdown', onHolePress);
  board.appendChild(hole);
  holes.push({ hole, mole, up: false });
}

/* ─── Input ─────────────────────────────────────────── */
function onHolePress(e) {
  if (!running) return;
  e.preventDefault();
  const idx  = parseInt(e.currentTarget.dataset.idx, 10);
  const cell = holes[idx];

  if (cell.up) {
    hitMole(idx);
  } else {
    missHole(idx);
  }
}

/* ─── Hit / Miss ────────────────────────────────────── */
function hitMole(idx) {
  const cell = holes[idx];
  cell.up = false;
  clearTimeout(moleTimers[idx]);
  moleTimers[idx] = null;

  combo++;
  const points = comboPoints();
  score += points;

  cell.mole.classList.remove('up');
  cell.mole.classList.add('hit');
  cell.mole.addEventListener('animationend', () => {
    cell.mole.classList.remove('hit');
  }, { once: true });

  showScorePopup(cell.hole, points);
  updateHud();
  updateCombo();
}

function missHole(idx) {
  const cell = holes[idx];
  cell.hole.classList.add('miss-flash');
  cell.hole.addEventListener('animationend', () => {
    cell.hole.classList.remove('miss-flash');
  }, { once: true });

  if (combo > 0) {
    combo = 0;
    updateCombo();
  }
}

function comboPoints() {
  if (combo >= 10) return 5;
  if (combo >= 6)  return 3;
  if (combo >= 3)  return 2;
  return 1;
}

/* ─── Score Popup ───────────────────────────────────── */
function showScorePopup(holeEl, pts) {
  const pop = document.createElement('div');
  pop.className = 'score-popup';
  pop.textContent = pts === 1 ? '+1' : `+${pts} 콤보!`;
  if (pts > 1) pop.style.color = '#F59E0B';
  holeEl.style.position = 'relative';
  holeEl.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove(), { once: true });
}

/* ─── Combo Display ─────────────────────────────────── */
function updateCombo() {
  comboDisplay.innerHTML = '';
  if (combo >= 3) {
    const el = document.createElement('span');
    el.className = 'combo-text';
    el.textContent = `${combo} 콤보!`;
    comboDisplay.appendChild(el);
  }
}

/* ─── HUD ───────────────────────────────────────────── */
function updateHud() {
  scoreValue.textContent = score;
}

function updateTimer() {
  timerValue.textContent = timeLeft;
  timerValue.classList.toggle('urgent', timeLeft <= 10);
}

function updateBestBar() {
  bestScoreStart.textContent  = bestScore;
  bestScoreBottom.textContent = bestScore;
}

/* ─── Spawn ─────────────────────────────────────────── */
function currentSpeedConfig() {
  const elapsed = GAME_DURATION - timeLeft;
  let cfg = SPEED_SCHEDULE[0];
  for (const s of SPEED_SCHEDULE) {
    if (elapsed >= s.after) cfg = s;
  }
  return cfg;
}

function spawnMole() {
  /* pick a hole that is currently empty */
  const empties = holes
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.up);

  if (empties.length === 0) return;

  const { c, i } = empties[Math.floor(Math.random() * empties.length)];
  const cfg = currentSpeedConfig();

  c.up = true;
  c.mole.classList.add('up');

  moleTimers[i] = setTimeout(() => {
    if (c.up) {
      c.up = false;
      c.mole.classList.remove('up');
    }
  }, cfg.visibleMs);
}

function restartSpawnLoop() {
  const cfg = currentSpeedConfig();
  if (lastSpawnCfg && cfg.intervalMs === lastSpawnCfg.intervalMs) return;
  lastSpawnCfg = cfg;

  clearInterval(spawnInterval);
  spawnInterval = setInterval(spawnMole, cfg.intervalMs);
}

/* ─── Game Lifecycle ────────────────────────────────── */
function startGame() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  score    = 0;
  combo    = 0;
  timeLeft = GAME_DURATION;
  running  = true;
  lastSpawnCfg = null;

  updateHud();
  updateTimer();
  updateCombo();

  /* hide overlays */
  startOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');

  /* countdown tick */
  tickInterval = setInterval(() => {
    timeLeft--;
    updateTimer();
    restartSpawnLoop();    // adjust speed as time changes
    if (timeLeft <= 0) endGame();
  }, 1000);

  /* initial spawn */
  spawnMole();
  restartSpawnLoop();
}

function endGame() {
  running = false;
  clearInterval(tickInterval);
  clearInterval(spawnInterval);
  moleTimers.forEach((t, i) => {
    clearTimeout(t);
    moleTimers[i] = null;
  });

  /* hide any remaining moles */
  holes.forEach(({ mole, c }, idx) => {
    holes[idx].up = false;
    mole.classList.remove('up', 'hit');
  });

  /* update best */
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    localStorage.setItem(LS_KEY, bestScore);
    updateBestBar();
  }

  /* show game over */
  finalScore.textContent = score;
  finalBest.textContent  = bestScore;
  newRecordBadge.hidden  = !isRecord;
  gameoverOverlay.classList.remove('hidden');
  if(typeof Leaderboard!=='undefined')Leaderboard.ready('mole',score);
}

/* ─── Button Listeners ──────────────────────────────── */
$('btn-start').addEventListener('click', startGame);
$('btn-restart').addEventListener('click', startGame);

/* ─── Init ──────────────────────────────────────────── */
updateBestBar();
