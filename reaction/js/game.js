'use strict';

const TOTAL_ROUNDS = 5;
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 5000;
const STORAGE_KEY = 'reaction_best_avg';

const GameState = {
  IDLE: 'idle',
  WAITING: 'waiting',
  GO: 'go',
  RESULT: 'result',
  EARLY: 'early',
};

let state = GameState.IDLE;
let currentRound = 0;
let roundTimes = [];
let goStartTime = null;
let waitTimeout = null;
let earlyTimeout = null;
let _gameStartTs = 0;

// DOM refs
const startScreen = document.getElementById('start-screen');
const resultsScreen = document.getElementById('results-screen');
const gameArea = document.getElementById('game-area');
const stateLabel = document.getElementById('state-label');
const stateSublabel = document.getElementById('state-sublabel');
const resultTimeDisplay = document.getElementById('result-time-display');
const ratingBadge = document.getElementById('rating-badge');
const roundLog = document.getElementById('round-log');
const roundDots = document.querySelectorAll('.round-dot');
const tapHint = document.getElementById('tap-hint');
const bestDisplay = document.getElementById('best-display');
const bestValue = document.getElementById('best-value');
const startBestBadge = document.getElementById('start-best-badge');
const startBestValue = document.getElementById('start-best-value');

// Results DOM
const resultsAvgTime = document.getElementById('results-avg-time');
const resultsRating = document.getElementById('results-rating');
const resultsBestTime = document.getElementById('results-best-time');
const resultsFastestRound = document.getElementById('results-fastest-round');
const roundsList = document.getElementById('rounds-list');
const newRecordBanner = document.getElementById('new-record-banner');
const btnRetry = document.getElementById('btn-retry');
const btnStart = document.getElementById('btn-start');

// ===== AUDIO =====

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.value = 880;
  osc.type = 'square';
  gain.gain.value = 0.3;
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
  osc.stop(audioCtx.currentTime + 0.15);
}

function vibrate() {
  if (navigator.vibrate) {
    navigator.vibrate(100);
  }
}

// ===== UTILS =====

function getRating(ms) {
  if (ms < 200) return '번개! ⚡';
  if (ms < 300) return '빠름! 🚀';
  if (ms < 400) return '보통 👍';
  return '느림 🐢';
}

function getRatingShort(ms) {
  if (ms < 200) return '번개!';
  if (ms < 300) return '빠름!';
  if (ms < 400) return '보통';
  return '느림';
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
    startBestBadge.style.display = 'flex';
    startBestValue.textContent = best.toFixed(1) + 'ms';
    bestDisplay.style.display = 'flex';
    bestValue.textContent = best.toFixed(1) + 'ms';
  } else {
    startBestBadge.style.display = 'none';
    bestDisplay.style.display = 'none';
  }
}

// ===== STATE TRANSITIONS =====

function setGameAreaState(s) {
  gameArea.className = 'game-area';
  gameArea.classList.add('state-' + s);
}

function updateRoundDots() {
  roundDots.forEach((dot, i) => {
    dot.classList.remove('done', 'current');
    if (i < currentRound) {
      dot.classList.add('done');
    } else if (i === currentRound) {
      dot.classList.add('current');
    }
  });
}

function clearContent() {
  resultTimeDisplay.style.display = 'none';
  ratingBadge.style.display = 'none';
  tapHint.style.display = 'none';
}

function showContent(opts = {}) {
  if (opts.showTime) {
    resultTimeDisplay.style.display = 'block';
    ratingBadge.style.display = 'inline-flex';
    tapHint.style.display = 'block';
  } else {
    resultTimeDisplay.style.display = 'none';
    ratingBadge.style.display = 'none';
    tapHint.style.display = opts.showTapHint ? 'block' : 'none';
  }
}

// ===== GAME FLOW =====

function startGame() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  currentRound = 0;
  roundTimes = [];
  _gameStartTs = Date.now();

  // Hide overlays
  startScreen.classList.add('hidden');
  resultsScreen.classList.add('hidden');

  // Clear round log
  roundLog.innerHTML = '';

  // Update dots
  updateRoundDots();
  updateBestDisplay();

  startRound();
}

function startRound() {
  clearTimeout(waitTimeout);
  clearTimeout(earlyTimeout);

  state = GameState.WAITING;
  setGameAreaState('waiting');
  clearContent();

  stateLabel.textContent = '기다리세요...';
  stateLabel.classList.remove('pulse-go', 'shake');
  stateSublabel.textContent = `라운드 ${currentRound + 1} / ${TOTAL_ROUNDS}`;

  const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);

  waitTimeout = setTimeout(() => {
    triggerGo();
  }, delay);
}

function triggerGo() {
  state = GameState.GO;
  setGameAreaState('go');
  clearContent();

  goStartTime = performance.now();

  // 비프음 + 진동으로 알림
  playBeep();
  vibrate();

  void stateLabel.offsetWidth; // reflow to restart animation
  stateLabel.classList.add('pulse-go');
  stateLabel.textContent = '지금 탭하세요!';
  stateSublabel.textContent = '';
}

function handleTap() {
  if (state === GameState.WAITING) {
    // Tapped too early
    clearTimeout(waitTimeout);
    state = GameState.EARLY;
    setGameAreaState('early');

    void stateLabel.offsetWidth;
    stateLabel.classList.add('shake');
    stateLabel.textContent = '너무 빨라요! ❌';
    stateSublabel.textContent = '잠시 후 다시 시도합니다...';
    clearContent();

    earlyTimeout = setTimeout(() => {
      startRound();
    }, 1800);
    return;
  }

  if (state === GameState.GO) {
    const elapsed = Math.round((performance.now() - goStartTime) * 10) / 10;
    roundTimes.push(elapsed);

    state = GameState.RESULT;
    setGameAreaState('go'); // keep green

    // Update result display
    resultTimeDisplay.innerHTML = elapsed.toFixed(1) + '<span class="result-time-unit">ms</span>';
    ratingBadge.textContent = getRating(elapsed);

    showContent({ showTime: true });

    stateLabel.textContent = '측정 완료!';
    stateSublabel.textContent = '';

    // Add to round log
    addRoundLogItem(currentRound + 1, elapsed);

    currentRound++;
    updateRoundDots();

    if (currentRound >= TOTAL_ROUNDS) {
      tapHint.textContent = '탭하여 결과 보기';
      tapHint.style.display = 'block';
    } else {
      tapHint.textContent = '탭하여 다음 라운드';
      tapHint.style.display = 'block';
    }
    return;
  }

  if (state === GameState.RESULT) {
    if (currentRound >= TOTAL_ROUNDS) {
      showResults();
    } else {
      startRound();
    }
    return;
  }
}

function addRoundLogItem(round, ms) {
  const item = document.createElement('div');
  item.className = 'round-log-item';

  // Remove 'latest' from previous
  const prev = roundLog.querySelector('.latest');
  if (prev) prev.classList.remove('latest');

  item.classList.add('latest');
  item.textContent = `R${round}: ${ms.toFixed(1)}ms`;
  roundLog.appendChild(item);
}

function showResults() {
  const avg = Math.round((roundTimes.reduce((a, b) => a + b, 0) / roundTimes.length) * 10) / 10;
  const best = Math.min(...roundTimes);
  const bestRoundIndex = roundTimes.indexOf(best);

  resultsAvgTime.innerHTML = avg.toFixed(1) + '<span class="results-avg-unit"> ms</span>';
  resultsRating.textContent = getRating(avg);

  resultsBestTime.innerHTML = best.toFixed(1) + '<span class="unit"> ms</span>';
  resultsFastestRound.textContent = `R${bestRoundIndex + 1}`;

  // Build rounds list
  roundsList.innerHTML = '';
  roundTimes.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'round-row';
    if (i === bestRoundIndex) row.classList.add('best-round');

    row.innerHTML = `
      <span class="round-row-label">라운드 ${i + 1}${i === bestRoundIndex ? ' 🏆' : ''}</span>
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

  // Show results overlay
  resultsScreen.classList.remove('hidden');
  updateBestDisplay();
  if(typeof Leaderboard!=='undefined'){
    Leaderboard._setProof({game:'reaction',rounds:roundTimes.slice(),startTs:_gameStartTs});
    Leaderboard.ready('reaction',Math.round(avg*10),{ascending:true,format:'ms10',label:'시간'});
  }
}

// ===== EVENT LISTENERS =====

btnStart.addEventListener('click', (e) => {
  e.stopPropagation();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  startGame();
});

btnRetry.addEventListener('click', (e) => {
  e.stopPropagation();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  startGame();
});

// Game area tap handler
gameArea.addEventListener('click', () => {
  handleTap();
});

gameArea.addEventListener('touchstart', (e) => {
  e.preventDefault();
  handleTap();
}, { passive: false });

// Keyboard support (spacebar)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (!startScreen.classList.contains('hidden')) return;
    if (!resultsScreen.classList.contains('hidden')) return;
    handleTap();
  }
});

// ===== INIT =====

function init() {
  updateBestDisplay();
  setGameAreaState('idle');
  clearContent();
  stateLabel.textContent = '';
  stateSublabel.textContent = '';

  // Make sure screens are visible/hidden correctly
  startScreen.classList.remove('hidden');
  resultsScreen.classList.add('hidden');
}

init();
