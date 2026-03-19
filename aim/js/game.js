'use strict';

const TOTAL_ROUNDS = 5;
const MIN_DELAY    = 800;
const MAX_DELAY    = 2500;
const TARGET_SIZE  = 60;
const STORAGE_KEY  = 'aim_best_avg';

// ── State ──
let state       = 'idle'; // idle | waiting | go | result
let currentRound = 0;
let roundTimes   = [];
let goStartTime  = null;
let waitTimeout  = null;
let _gameStartTs = 0;

// ── DOM ──
const startScreen    = document.getElementById('start-screen');
const resultsScreen  = document.getElementById('results-screen');
const playField      = document.getElementById('play-field');
const fieldMessage   = document.getElementById('field-message');
const target         = document.getElementById('target');
const roundDotsEl    = document.getElementById('round-dots');
const roundLog       = document.getElementById('round-log');
const bestDisplay    = document.getElementById('best-display');
const bestValue      = document.getElementById('best-value');
const startBest      = document.getElementById('start-best');
const startBestValue = document.getElementById('start-best-value');

const resultsAvgTime     = document.getElementById('results-avg-time');
const resultsRating      = document.getElementById('results-rating');
const resultsBestTime    = document.getElementById('results-best-time');
const resultsFastestRound = document.getElementById('results-fastest-round');
const roundsList         = document.getElementById('rounds-list');
const newRecordBanner    = document.getElementById('new-record-banner');

// ── Audio ──
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playHitSound() {
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.15;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.stop(audioCtx.currentTime + 0.1);
  } catch (_) {}
}

function playAppearSound() {
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 520;
    osc.type = 'triangle';
    gain.gain.value = 0.1;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
    osc.stop(audioCtx.currentTime + 0.08);
  } catch (_) {}
}

// ── Utils ──
function getRating(ms) {
  if (ms < 300) return '번개! ⚡';
  if (ms < 450) return '빠름! 🚀';
  if (ms < 600) return '보통 👍';
  return '느림 🐢';
}

function loadBest() {
  const val = localStorage.getItem(STORAGE_KEY);
  return val ? parseFloat(val) : null;
}

function saveBest(ms) {
  localStorage.setItem(STORAGE_KEY, String(ms));
}

function updateBestDisplay() {
  const best = loadBest();
  if (best) {
    startBest.style.display = 'flex';
    startBestValue.textContent = best.toFixed(1) + 'ms';
    bestDisplay.style.display = 'flex';
    bestValue.textContent = best.toFixed(1) + 'ms';
  } else {
    startBest.style.display = 'none';
    bestDisplay.style.display = 'none';
  }
}

// ── Round dots ──
function buildRoundDots() {
  roundDotsEl.innerHTML = '';
  for (let i = 0; i < TOTAL_ROUNDS; i++) {
    const dot = document.createElement('div');
    dot.className = 'round-dot';
    dot.dataset.round = i;
    roundDotsEl.appendChild(dot);
  }
}

function updateRoundDots() {
  const dots = roundDotsEl.querySelectorAll('.round-dot');
  dots.forEach((dot, i) => {
    dot.classList.remove('done', 'current');
    if (i < currentRound) dot.classList.add('done');
    else if (i === currentRound) dot.classList.add('current');
  });
}

// ── Target positioning ──
function showTarget() {
  const fieldRect = playField.getBoundingClientRect();
  const pad = 10;
  const maxX = playField.clientWidth - TARGET_SIZE - pad;
  const maxY = playField.clientHeight - TARGET_SIZE - pad;
  const x = pad + Math.random() * maxX;
  const y = pad + Math.random() * maxY;

  target.style.left = x + 'px';
  target.style.top = y + 'px';
  target.style.display = 'block';
  target.classList.remove('hit');

  // Force reflow for animation
  void target.offsetWidth;
  target.style.animation = 'none';
  void target.offsetWidth;
  target.style.animation = '';
}

function hideTarget() {
  target.style.display = 'none';
}

// ── Game flow ──
function startGame() {
  if (typeof Leaderboard !== 'undefined') Leaderboard.hide();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  currentRound = 0;
  roundTimes = [];
  _gameStartTs = Date.now();
  roundLog.innerHTML = '';

  startScreen.classList.add('hidden');
  resultsScreen.classList.add('hidden');

  buildRoundDots();
  updateRoundDots();
  updateBestDisplay();

  startRound();
}

function startRound() {
  clearTimeout(waitTimeout);

  state = 'waiting';
  hideTarget();
  fieldMessage.textContent = '기다리세요...';
  fieldMessage.classList.remove('result');
  fieldMessage.style.display = 'block';

  updateRoundDots();

  const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  waitTimeout = setTimeout(triggerGo, delay);
}

function triggerGo() {
  state = 'go';
  goStartTime = performance.now();

  fieldMessage.style.display = 'none';
  showTarget();
  playAppearSound();

  if (navigator.vibrate) navigator.vibrate(50);
}

function handleTargetHit() {
  if (state !== 'go') return;

  const elapsed = Math.round((performance.now() - goStartTime) * 10) / 10;
  roundTimes.push(elapsed);

  playHitSound();
  if (navigator.vibrate) navigator.vibrate(30);

  // Hit animation
  target.classList.add('hit');

  // Show time
  fieldMessage.textContent = elapsed.toFixed(1) + 'ms';
  fieldMessage.classList.add('result');
  fieldMessage.style.display = 'block';

  // Log
  addRoundLogItem(currentRound + 1, elapsed);

  currentRound++;
  updateRoundDots();

  state = 'result';

  // Next round or results
  setTimeout(() => {
    if (currentRound >= TOTAL_ROUNDS) {
      showResults();
    } else {
      startRound();
    }
  }, 800);
}

function handleFieldClick() {
  // Clicked the field but missed the target while it's showing
  if (state === 'go') {
    // Miss penalty — flash red
    playField.style.borderColor = '#EF4444';
    setTimeout(() => {
      playField.style.borderColor = '';
    }, 200);
  }
}

function addRoundLogItem(round, ms) {
  const item = document.createElement('div');
  item.className = 'round-log-item';

  const prev = roundLog.querySelector('.latest');
  if (prev) prev.classList.remove('latest');

  item.classList.add('latest');
  item.textContent = `R${round}: ${ms.toFixed(1)}ms`;
  roundLog.appendChild(item);
}

function showResults() {
  const avg = Math.round((roundTimes.reduce((a, b) => a + b, 0) / roundTimes.length) * 10) / 10;
  const best = Math.min(...roundTimes);
  const bestIdx = roundTimes.indexOf(best);

  resultsAvgTime.innerHTML = avg.toFixed(1) + '<span class="unit"> ms</span>';
  resultsRating.textContent = getRating(avg);
  resultsBestTime.innerHTML = best.toFixed(1) + '<span class="unit"> ms</span>';
  resultsFastestRound.textContent = `R${bestIdx + 1}`;

  // Rounds list
  roundsList.innerHTML = '';
  roundTimes.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'round-row';
    if (i === bestIdx) row.classList.add('best-round');
    row.innerHTML = `
      <span class="round-row-label">라운드 ${i + 1}${i === bestIdx ? ' 🏆' : ''}</span>
      <span class="round-row-time">${t.toFixed(1)}<span class="unit"> ms</span></span>
    `;
    roundsList.appendChild(row);
  });

  // New record?
  const prevBest = loadBest();
  let isNewRecord = false;
  if (!prevBest || avg < prevBest) {
    saveBest(avg);
    isNewRecord = true;
  }

  newRecordBanner.classList.toggle('show', isNewRecord);

  resultsScreen.classList.remove('hidden');
  updateBestDisplay();

  if (typeof Leaderboard !== 'undefined') {
    Leaderboard._setProof({game:'aim',rounds:roundTimes.slice(),startTs:_gameStartTs});
    Leaderboard.ready('aim', Math.round(avg * 10), { ascending: true, format: 'ms10', label: '시간' });
  }
}

// ── Events ──
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', startGame);

target.addEventListener('click', (e) => {
  e.stopPropagation();
  handleTargetHit();
});

target.addEventListener('touchstart', (e) => {
  e.preventDefault();
  e.stopPropagation();
  handleTargetHit();
}, { passive: false });

playField.addEventListener('click', handleFieldClick);

// ── Init ──
updateBestDisplay();
