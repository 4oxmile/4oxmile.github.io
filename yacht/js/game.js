'use strict';

/* ═══════════════════════════════════════
   YACHT DICE — game.js
   ═══════════════════════════════════════ */

const CATEGORIES = [
  // upper
  { id: 'ones',      label: '1 (에이스)',        section: 'upper' },
  { id: 'twos',      label: '2 (투스)',           section: 'upper' },
  { id: 'threes',    label: '3 (쓰리스)',         section: 'upper' },
  { id: 'fours',     label: '4 (포스)',           section: 'upper' },
  { id: 'fives',     label: '5 (파이브스)',       section: 'upper' },
  { id: 'sixes',     label: '6 (식스스)',         section: 'upper' },
  // lower
  { id: 'choice',    label: '찬스',              section: 'lower' },
  { id: 'fourkind',  label: '포커',              section: 'lower' },
  { id: 'fullhouse', label: '풀하우스',           section: 'lower' },
  { id: 'sstraight', label: '스몰 스트레이트',    section: 'lower' },
  { id: 'lstraight', label: '라지 스트레이트',    section: 'lower' },
  { id: 'yacht',     label: '요트',              section: 'lower' },
];

// ── Scoring logic ──────────────────────────────────────────────
function calcScore(catId, dice) {
  const sum = dice.reduce((a, b) => a + b, 0);
  const counts = [0, 0, 0, 0, 0, 0, 0]; // index 1-6
  dice.forEach(d => counts[d]++);

  switch (catId) {
    case 'ones':   return counts[1] * 1;
    case 'twos':   return counts[2] * 2;
    case 'threes': return counts[3] * 3;
    case 'fours':  return counts[4] * 4;
    case 'fives':  return counts[5] * 5;
    case 'sixes':  return counts[6] * 6;
    case 'choice': return sum;
    case 'fourkind': {
      const hasFour = counts.some(c => c >= 4);
      return hasFour ? sum : 0;
    }
    case 'fullhouse': {
      const hasThree = counts.some(c => c === 3);
      const hasTwo   = counts.some(c => c === 2);
      return (hasThree && hasTwo) ? sum : 0;
    }
    case 'sstraight': {
      const vals = new Set(dice);
      const straights = [
        [1,2,3,4], [2,3,4,5], [3,4,5,6]
      ];
      const ok = straights.some(s => s.every(v => vals.has(v)));
      return ok ? 15 : 0;
    }
    case 'lstraight': {
      const vals = new Set(dice);
      const ok = ([1,2,3,4,5].every(v => vals.has(v))) ||
                 ([2,3,4,5,6].every(v => vals.has(v)));
      return ok ? 30 : 0;
    }
    case 'yacht': {
      return counts.some(c => c === 5) ? 50 : 0;
    }
    default: return 0;
  }
}

// ── Dot layout map ─────────────────────────────────────────────
const DOT_CLASSES = {
  1: ['dot dot-c'],
  2: ['dot dot-tl', 'dot dot-br'],
  3: ['dot dot-tl', 'dot dot-c', 'dot dot-br'],
  4: ['dot dot-tl', 'dot dot-tr', 'dot dot-bl', 'dot dot-br'],
  5: ['dot dot-tl', 'dot dot-tr', 'dot dot-c', 'dot dot-bl', 'dot dot-br'],
  6: ['dot dot-tl', 'dot dot-tr', 'dot dot-ml', 'dot dot-mr', 'dot dot-bl', 'dot dot-br'],
};

function renderDieFace(faceEl, val) {
  faceEl.innerHTML = '';
  faceEl.setAttribute('data-val', val);
  if (val < 1 || val > 6) return;
  DOT_CLASSES[val].forEach(cls => {
    const dot = document.createElement('div');
    dot.className = cls;
    faceEl.appendChild(dot);
  });
}

// ── State ──────────────────────────────────────────────────────
const state = {
  dice: [1, 1, 1, 1, 1],
  held: [false, false, false, false, false],
  rollsLeft: 3,
  turn: 1,
  scores: {},       // catId -> number (filled when used)
  hasRolled: false, // must roll at least once before scoring
};

function resetTurn() {
  state.held = [false, false, false, false, false];
  state.rollsLeft = 3;
  state.hasRolled = false;
}

function totalScore() {
  let t = 0;
  for (const val of Object.values(state.scores)) t += val;
  // upper bonus
  const upperSum = ['ones','twos','threes','fours','fives','sixes']
    .reduce((a, id) => a + (state.scores[id] ?? 0), 0);
  if (upperSum >= 63) t += 35;
  return t;
}

function upperSum() {
  return ['ones','twos','threes','fours','fives','sixes']
    .reduce((a, id) => a + (state.scores[id] ?? 0), 0);
}

// ── DOM refs ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const screens = {
  start:  $('start-screen'),
  game:   $('game-screen'),
  result: $('result-screen'),
};

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    el.classList.toggle('hidden', k !== name);
    el.classList.toggle('active', k === name);
  });
}

// ── Dice UI ────────────────────────────────────────────────────
function getDieEl(i)  { return $(`die-${i}`);  }
function getFaceEl(i) { return $(`face-${i}`); }
function getWrapEl(i) { return document.querySelector(`.die-wrap[data-idx="${i}"]`); }

function renderDice() {
  for (let i = 0; i < 5; i++) {
    const wrap = getWrapEl(i);
    const face = getFaceEl(i);
    renderDieFace(face, state.dice[i]);
    wrap.classList.toggle('held', state.held[i]);
    wrap.classList.toggle('inactive', !state.hasRolled);
  }
}

function animateRoll(indices) {
  return new Promise(resolve => {
    indices.forEach(i => {
      const die = getDieEl(i);
      die.classList.remove('rolling');
      void die.offsetWidth; // reflow
      die.classList.add('rolling');
    });
    setTimeout(() => {
      indices.forEach(i => getDieEl(i).classList.remove('rolling'));
      resolve();
    }, 500);
  });
}

// ── Roll ───────────────────────────────────────────────────────
function doRoll() {
  if (state.rollsLeft <= 0) return;

  const rolling = [];
  for (let i = 0; i < 5; i++) {
    if (!state.held[i]) {
      state.dice[i] = Math.ceil(Math.random() * 6);
      rolling.push(i);
    }
  }

  state.rollsLeft--;
  state.hasRolled = true;

  animateRoll(rolling).then(() => {
    renderDice();
    updateRollUI();
    updateScoreRows();
    updateTotals();
  });

  // optimistic render for faces before animation ends
  for (let i = 0; i < 5; i++) {
    if (!state.held[i]) {
      renderDieFace(getFaceEl(i), state.dice[i]);
    }
  }
  updateRollUI();
}

// ── Roll UI ────────────────────────────────────────────────────
function updateRollUI() {
  const rollBtn = $('btn-roll');
  const rollLabel = $('roll-label');
  const rollBadge = $('roll-count-badge');
  const hint = $('roll-hint');
  const rollsDone = 3 - state.rollsLeft;

  // pips
  for (let p = 1; p <= 3; p++) {
    $(`pip-${p}`).classList.toggle('active', p <= rollsDone);
  }

  if (state.rollsLeft <= 0) {
    rollBtn.disabled = true;
    rollLabel.textContent = '카테고리를 선택하세요';
    rollBadge.style.display = 'none';
    hint.textContent = '점수표에서 카테고리를 선택하세요';
  } else {
    rollBtn.disabled = false;
    rollLabel.textContent = state.hasRolled ? '다시 굴리기' : '주사위 굴리기';
    rollBadge.textContent = `(${rollsDone + 1}/3)`;
    rollBadge.style.display = '';
    hint.textContent = state.hasRolled
      ? '잠글 주사위를 클릭하고 다시 굴리세요'
      : '주사위를 굴려주세요';
  }
}

// ── Score rows ─────────────────────────────────────────────────
function updateScoreRows() {
  CATEGORIES.forEach(cat => {
    const row = document.querySelector(`.score-row[data-cat="${cat.id}"]`);
    const scoreEl = $(`score-${cat.id}`);
    if (!row || !scoreEl) return;

    if (cat.id in state.scores) {
      // already used
      row.classList.remove('available', 'preview');
      row.classList.add(state.scores[cat.id] === 0 ? 'zero-used' : 'used');
      scoreEl.textContent = state.scores[cat.id];
      scoreEl.classList.remove('preview-val');
    } else {
      row.classList.remove('used', 'zero-used');
      if (state.hasRolled) {
        const preview = calcScore(cat.id, state.dice);
        row.classList.add('available');
        scoreEl.textContent = preview;
        scoreEl.classList.add('preview-val');
        row.classList.toggle('preview', preview > 0);
      } else {
        row.classList.remove('available', 'preview');
        scoreEl.textContent = '-';
        scoreEl.classList.remove('preview-val');
      }
    }
  });
}

function updateTotals() {
  const us = upperSum();
  $('upper-sum').textContent = us;
  $('current-score').textContent = totalScore();
  $('total-score-display').textContent = totalScore();

  const bonusEl = $('upper-bonus');
  if (us >= 63) {
    bonusEl.textContent = '+35 보너스 획득!';
    bonusEl.classList.add('bonus-earned');
  } else {
    const needed = 63 - us;
    bonusEl.textContent = `${needed}점 더 필요`;
    bonusEl.classList.remove('bonus-earned');
  }
}

// ── Select category ────────────────────────────────────────────
function selectCategory(catId) {
  if (!state.hasRolled) return;
  if (catId in state.scores) return;

  const score = calcScore(catId, state.dice);
  state.scores[catId] = score;

  if (state.turn >= 12) {
    endGame();
  } else {
    state.turn++;
    resetTurn();
    $('turn-num').textContent = state.turn;
    updateRollUI();
    updateScoreRows();
    updateTotals();
    renderDice();
  }
}

// ── End game ───────────────────────────────────────────────────
function endGame() {
  const total = totalScore();
  const best  = parseInt(localStorage.getItem('yacht_best') || '0', 10);
  const isNew = total > best;
  if (isNew) localStorage.setItem('yacht_best', total);

  // Fill result
  $('result-total').textContent = total;
  $('result-best-val').textContent = isNew ? total : best;
  $('new-best-badge').classList.toggle('hidden', !isNew);
  $('result-icon').textContent = total >= 200 ? '🏆' : total >= 100 ? '🎉' : '🎲';

  // Breakdown
  buildBreakdown();

  showScreen('result');

  // Leaderboard
  if (typeof Leaderboard !== 'undefined') {
    Leaderboard.ready('yacht', total);
  }
}

function buildBreakdown() {
  const upperCats = CATEGORIES.filter(c => c.section === 'upper');
  const lowerCats = CATEGORIES.filter(c => c.section === 'lower');

  function renderRows(container, cats) {
    container.innerHTML = '';
    cats.forEach(cat => {
      const val = state.scores[cat.id] ?? 0;
      const row = document.createElement('div');
      row.className = 'breakdown-row';
      row.innerHTML = `<span class="breakdown-cat">${cat.label}</span>
        <span class="breakdown-score${val === 0 ? ' zero' : ''}">${val}</span>`;
      container.appendChild(row);
    });
  }

  renderRows($('breakdown-upper'), upperCats);
  renderRows($('breakdown-lower'), lowerCats);

  const us = upperSum();
  const bonusRow = $('breakdown-bonus-row');
  if (us >= 63) {
    bonusRow.className = 'breakdown-bonus';
    bonusRow.innerHTML = `<span>보너스</span><span>+35</span>`;
  } else {
    bonusRow.className = 'breakdown-bonus no-bonus';
  }
}

// ── New game ───────────────────────────────────────────────────
function newGame() {
  Object.assign(state, {
    dice: [1, 1, 1, 1, 1],
    held: [false, false, false, false, false],
    rollsLeft: 3,
    turn: 1,
    scores: {},
    hasRolled: false,
  });

  $('turn-num').textContent = '1';
  renderDice();
  updateRollUI();
  updateScoreRows();
  updateTotals();

  // mobile: close score panel if open
  $('score-panel').classList.remove('mobile-open');
  $('btn-toggle-score').textContent = '점수표 보기 ▼';

  showScreen('game');

  if (typeof Leaderboard !== 'undefined') {
    Leaderboard.hide();
  }
}

// ── Event wiring ───────────────────────────────────────────────
function init() {
  // Start screen best score
  const best = parseInt(localStorage.getItem('yacht_best') || '0', 10);
  if (best > 0) {
    $('start-best-wrap').style.display = '';
    $('start-best-val').textContent = best;
  }

  // Start button
  $('btn-start').addEventListener('click', newGame);

  // Roll button
  $('btn-roll').addEventListener('click', () => {
    if (state.rollsLeft > 0) doRoll();
  });

  // Dice hold toggle
  $('dice-row').addEventListener('click', e => {
    const wrap = e.target.closest('.die-wrap');
    if (!wrap) return;
    if (!state.hasRolled) return;
    const idx = parseInt(wrap.dataset.idx, 10);
    state.held[idx] = !state.held[idx];
    wrap.classList.toggle('held', state.held[idx]);
  });

  // Score row clicks (event delegation)
  document.querySelector('#upper-rows').addEventListener('click', e => {
    const row = e.target.closest('.score-row');
    if (!row) return;
    selectCategory(row.dataset.cat);
  });
  document.querySelector('#lower-rows').addEventListener('click', e => {
    const row = e.target.closest('.score-row');
    if (!row) return;
    selectCategory(row.dataset.cat);
  });

  // Back to menu from game
  $('btn-menu').addEventListener('click', () => {
    showScreen('start');
    if (typeof Leaderboard !== 'undefined') Leaderboard.hide();
  });

  // Result buttons
  $('btn-restart').addEventListener('click', newGame);
  $('btn-home').addEventListener('click', () => {
    showScreen('start');
    const b = parseInt(localStorage.getItem('yacht_best') || '0', 10);
    if (b > 0) {
      $('start-best-wrap').style.display = '';
      $('start-best-val').textContent = b;
    }
  });

  // Mobile scorecard toggle
  $('btn-toggle-score').addEventListener('click', () => {
    const panel = $('score-panel');
    const open  = panel.classList.toggle('mobile-open');
    $('btn-toggle-score').textContent = open ? '점수표 닫기 ▲' : '점수표 보기 ▼';
  });

  // Initial screen
  showScreen('start');
}

document.addEventListener('DOMContentLoaded', init);
