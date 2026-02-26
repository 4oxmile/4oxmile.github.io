/* ================================================================
   RHYTHM TAP — game.js
   4-lane falling-note rhythm game with Web Audio API
   ================================================================ */

'use strict';

// ─── Constants ───────────────────────────────────────────────────

const LANE_COUNT   = 4;
const HUD_HEIGHT   = 52;         // px reserved at top for HUD
const HIT_ZONE_Y   = 0.82;       // fraction from top where hit zone lives
const NOTE_SPEED_BASE = 420;     // px / second at BPM 120

// Timing windows (ms from ideal hit time)
const WINDOW = {
  PERFECT: 45,
  GREAT:   90,
  GOOD:    145,
  MISS:    200,
};

const GRADE_COLOR = {
  PERFECT: '#3b82f6',
  GREAT:   '#22c55e',
  GOOD:    '#eab308',
  MISS:    '#ef4444',
};

const GRADE_SCORE = {
  PERFECT: 300,
  GREAT:   200,
  GOOD:    100,
  MISS:    0,
};

const GRADE_HEALTH = {
  PERFECT: +4,
  GREAT:   +2,
  GOOD:    0,
  MISS:    -18,
};

// Lane accent colours (index 0–3)
const LANE_COLORS = ['#3b82f6', '#a78bfa', '#ec4899', '#f59e0b'];
// Frequencies for beep sounds per lane
const LANE_FREQ   = [261.6, 329.6, 392.0, 523.3]; // C4 E4 G4 C5

// ─── Song Library ────────────────────────────────────────────────
// Notes: [beat, lane] — beat is in quarter-note units, lane 0-3
// generatePattern() turns these into real ms timestamps at a given BPM.

function generatePattern(beats, bpm) {
  const msPerBeat = 60000 / bpm;
  return beats.map(([beat, lane]) => ({ time: beat * msPerBeat, lane }));
}

const SONGS = [
  {
    id: 'groove_easy',
    name: '그루브 비트',
    artist: 'Easy Mode',
    icon: '🎵',
    bpm: 100,
    difficulty: 'easy',
    beats: (() => {
      // Simple 4/4 alternating pattern, 32 beats
      const arr = [];
      for (let b = 0; b < 32; b++) {
        arr.push([b, b % 4]);
      }
      return arr;
    })(),
  },
  {
    id: 'neon_dance',
    name: '네온 댄스',
    artist: 'Normal Mode',
    icon: '💜',
    bpm: 130,
    difficulty: 'normal',
    beats: (() => {
      const arr = [];
      const pat = [0, 2, 1, 3, 0, 1, 2, 3, 2, 1, 0, 3];
      for (let b = 0; b < 48; b++) {
        arr.push([b * 0.5, pat[b % pat.length]]);
      }
      return arr;
    })(),
  },
  {
    id: 'electric_rush',
    name: '일렉트릭 러쉬',
    artist: 'Hard Mode',
    icon: '⚡',
    bpm: 160,
    difficulty: 'hard',
    beats: (() => {
      const arr = [];
      const pat = [0, 1, 2, 3, 2, 1, 0, 2, 3, 0, 1, 3, 0, 3, 1, 2];
      for (let b = 0; b < 64; b++) {
        arr.push([b * 0.5, pat[b % pat.length]]);
      }
      // Add some doubles
      [4, 8, 12, 16, 20].forEach(b => arr.push([b * 0.5, (pat[b % pat.length] + 2) % 4]));
      arr.sort((a, b2) => a[0] - b2[0]);
      return arr;
    })(),
  },
  {
    id: 'chaos_expert',
    name: '카오스 마스터',
    artist: 'Expert Mode',
    icon: '🔥',
    bpm: 190,
    difficulty: 'expert',
    beats: (() => {
      const arr = [];
      const pat = [0,1,2,3,0,2,1,3,0,3,2,1,2,0,3,1,0,1,3,2,0,2,3,1,1,3,0,2,3,2,1,0];
      for (let b = 0; b < 96; b++) {
        arr.push([b * 0.25, pat[b % pat.length]]);
        if (b % 8 === 7) {
          arr.push([b * 0.25 + 0.125, (pat[b % pat.length] + 1) % 4]);
        }
      }
      arr.sort((a, b2) => a[0] - b2[0]);
      return arr;
    })(),
  },
];

// Pre-compute ms note times
SONGS.forEach(song => {
  song.notes = generatePattern(song.beats, song.bpm);
  song.duration = song.notes[song.notes.length - 1].time + 3000;
});

// ─── Audio Engine ─────────────────────────────────────────────────

class AudioEngine {
  constructor() {
    this._ctx = null;
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._ctx;
  }

  resume() {
    const ctx = this._getCtx();
    if (ctx.state === 'suspended') ctx.resume();
  }

  playHit(lane, grade) {
    try {
      const ctx = this._getCtx();
      const now = ctx.currentTime;
      const freq = LANE_FREQ[lane];

      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // Grade affects pitch offset + volume
      const pitchMult = grade === 'PERFECT' ? 1.0 : grade === 'GREAT' ? 0.98 : 0.95;
      osc.frequency.setValueAtTime(freq * pitchMult, now);

      const vol = grade === 'MISS' ? 0 : 0.28;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc.start(now);
      osc.stop(now + 0.15);

      // Optional overtone
      if (grade === 'PERFECT') {
        const osc2  = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 2, now);
        gain2.gain.setValueAtTime(0.1, now);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        osc2.start(now);
        osc2.stop(now + 0.1);
      }
    } catch (e) {
      // Silently swallow audio errors
    }
  }

  playMiss() {
    try {
      const ctx  = this._getCtx();
      const now  = ctx.currentTime;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  playBeat(bpm) {
    try {
      const ctx  = this._getCtx();
      const now  = ctx.currentTime;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }
}

const audio = new AudioEngine();

// ─── Storage ──────────────────────────────────────────────────────

const Storage = {
  key: id => `rhythm_best_${id}`,
  getBest(id) {
    return parseInt(localStorage.getItem(Storage.key(id)) || '0', 10);
  },
  setBest(id, score) {
    const prev = Storage.getBest(id);
    if (score > prev) {
      localStorage.setItem(Storage.key(id), String(score));
      return true;
    }
    return false;
  },
};

// ─── Game State ───────────────────────────────────────────────────

const State = {
  phase: 'start',    // start | select | countdown | playing | paused | result
  song: null,
  notes: [],         // working copy of notes, enriched with state flags
  startTime: 0,      // performance.now() when music "began"
  elapsedPaused: 0,  // ms paused so far
  pauseStart: 0,
  score: 0,
  combo: 0,
  maxCombo: 0,
  health: 100,
  grades: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 },
  animId: null,
  selectedSongIdx: 0,
};

// ─── DOM References ───────────────────────────────────────────────

const $ = id => document.getElementById(id);

const DOM = {
  app:          $('app'),
  canvas:       $('game-canvas'),
  screenStart:  $('screen-start'),
  screenSelect: $('screen-select'),
  screenPause:  $('screen-pause'),
  screenResult: $('screen-result'),
  countdown:    $('countdown'),
  songList:     $('song-list'),
  hudCombo:     $('combo-value'),
  hudSongName:  $('hud-song-name'),
  hudScore:     $('score-value'),
  healthFill:   $('health-bar-fill'),
  btnPause:     $('btn-pause'),
  pauseScore:   $('pause-score'),
  resultTitle:  $('result-title'),
  resultScore:  $('result-score-value'),
  resultNewBest: $('result-new-best'),
  resultPerfect: $('result-perfect'),
  resultGreat:   $('result-great'),
  resultGood:    $('result-good'),
  resultMiss:    $('result-miss'),
  resultMaxCombo: $('result-max-combo'),
};

const ctx2d = DOM.canvas.getContext('2d');

// ─── Screen Manager ───────────────────────────────────────────────

function showScreen(name) {
  ['screen-start','screen-select','screen-pause','screen-result'].forEach(id => {
    const el = $(id);
    if (el) el.classList.toggle('hidden', id !== `screen-${name}`);
  });
  State.phase = name;
  DOM.btnPause.style.display = (name === 'playing') ? 'flex' : 'none';
}

// ─── Song Selector ────────────────────────────────────────────────

function buildSongList() {
  DOM.songList.innerHTML = '';
  SONGS.forEach((song, idx) => {
    const best = Storage.getBest(song.id);
    const card = document.createElement('div');
    card.className = 'song-card' + (idx === State.selectedSongIdx ? ' selected' : '');
    card.dataset.idx = idx;

    card.innerHTML = `
      <span class="song-icon">${song.icon}</span>
      <div class="song-info">
        <div class="song-name">${song.name}</div>
        <div class="song-meta">${song.artist} · BPM ${song.bpm}</div>
        ${best > 0 ? `<div class="song-best">최고 ${best.toLocaleString()}점</div>` : ''}
      </div>
      <span class="difficulty-badge diff-${song.difficulty}">${diffLabel(song.difficulty)}</span>
    `;

    card.addEventListener('click', () => selectSong(idx));
    DOM.songList.appendChild(card);
  });
}

function diffLabel(d) {
  return { easy: 'EASY', normal: 'NORMAL', hard: 'HARD', expert: 'EXPERT' }[d] || d.toUpperCase();
}

function selectSong(idx) {
  State.selectedSongIdx = idx;
  document.querySelectorAll('.song-card').forEach((c, i) => {
    c.classList.toggle('selected', i === idx);
  });
}

// ─── Canvas Resize ────────────────────────────────────────────────

function resizeCanvas() {
  const rect = DOM.app.getBoundingClientRect();
  DOM.canvas.width  = rect.width;
  DOM.canvas.height = rect.height;
}

// ─── Note Spawning ────────────────────────────────────────────────

function buildNotes(song) {
  const speed = NOTE_SPEED_BASE * (song.bpm / 120);
  return song.notes.map(n => ({
    lane:      n.lane,
    hitTime:   n.time,         // ms after game start when note should be at hit zone
    y:         -60,
    hit:       false,
    missed:    false,
    speed,
  }));
}

// ─── Game Loop ────────────────────────────────────────────────────

function gameTime() {
  const raw = performance.now() - State.startTime - State.elapsedPaused;
  return raw;
}

function startGame(song) {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  audio.resume();

  State.song          = song;
  State.notes         = buildNotes(song);
  State.score         = 0;
  State.combo         = 0;
  State.maxCombo      = 0;
  State.health        = 100;
  State.grades        = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
  State.elapsedPaused = 0;
  State.pauseStart    = 0;

  resizeCanvas();
  updateHUD();
  DOM.hudSongName.textContent = song.name;
  DOM.healthFill.style.width  = '100%';
  DOM.healthFill.classList.remove('low');

  showScreen('playing');
  runCountdown(3, () => {
    State.startTime = performance.now();
    loop();
  });
}

function runCountdown(from, cb) {
  DOM.countdown.classList.add('visible');
  DOM.countdown.textContent = from;
  audio.playBeat(State.song?.bpm || 120);

  let count = from - 1;
  const iv = setInterval(() => {
    if (count > 0) {
      DOM.countdown.textContent = count;
      audio.playBeat(State.song?.bpm || 120);
      count--;
    } else {
      clearInterval(iv);
      DOM.countdown.textContent = 'GO!';
      audio.playBeat(State.song?.bpm || 120);
      setTimeout(() => {
        DOM.countdown.classList.remove('visible');
        cb();
      }, 400);
    }
  }, 700);
}

function loop() {
  if (State.phase !== 'playing') return;
  State.animId = requestAnimationFrame(loop);

  const t = gameTime();
  const W = DOM.canvas.width;
  const H = DOM.canvas.height;
  const laneW = W / LANE_COUNT;
  const hitY  = H * HIT_ZONE_Y;
  const noteH = Math.max(28, laneW * 0.3);
  const noteW = laneW * 0.72;

  // ── Process note positions ──
  const speed = State.notes[0]?.speed || NOTE_SPEED_BASE;
  State.notes.forEach(note => {
    if (note.hit || note.missed) return;

    // y position: note should be at hitY exactly at hitTime
    const travelTime = note.hitTime - t;
    note.y = hitY - (travelTime / 1000) * speed;

    // Auto-miss if note falls past the window
    if (t > note.hitTime + WINDOW.MISS) {
      note.missed = true;
      registerGrade(note.lane, 'MISS', note.y);
    }
  });

  // ── End of song ──
  const allDone = State.notes.every(n => n.hit || n.missed);
  if (allDone && t > (State.song.duration - 1500)) {
    endGame();
    return;
  }

  // ── Draw ──
  ctx2d.clearRect(0, 0, W, H);

  // Board background
  ctx2d.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--board-bg').trim() || '#0A0E14';
  ctx2d.fillRect(0, 0, W, H);

  // Lane dividers
  ctx2d.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx2d.lineWidth   = 1;
  for (let i = 1; i < LANE_COUNT; i++) {
    ctx2d.beginPath();
    ctx2d.moveTo(i * laneW, HUD_HEIGHT);
    ctx2d.lineTo(i * laneW, H);
    ctx2d.stroke();
  }

  // Hit zone line
  ctx2d.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx2d.lineWidth   = 2;
  ctx2d.beginPath();
  ctx2d.moveTo(0, hitY + noteH / 2 + 4);
  ctx2d.lineTo(W, hitY + noteH / 2 + 4);
  ctx2d.stroke();

  // Hit zone glow per lane
  for (let i = 0; i < LANE_COUNT; i++) {
    const x = i * laneW + laneW / 2;
    const grad = ctx2d.createRadialGradient(x, hitY + noteH / 2, 0, x, hitY + noteH / 2, laneW * 0.6);
    grad.addColorStop(0, LANE_COLORS[i] + '28');
    grad.addColorStop(1, 'transparent');
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(i * laneW, hitY, laneW, noteH + 8);
  }

  // Tap buttons
  for (let i = 0; i < LANE_COUNT; i++) {
    const x = i * laneW + (laneW - noteW) / 2;
    const y = hitY;
    drawRoundRect(ctx2d, x, y, noteW, noteH, 8,
      `${LANE_COLORS[i]}30`, `${LANE_COLORS[i]}60`, 2);
  }

  // Notes
  State.notes.forEach(note => {
    if (note.hit || note.missed) return;
    if (note.y + noteH < HUD_HEIGHT) return; // not visible yet
    if (note.y > H + 20) return;

    const x = note.lane * laneW + (laneW - noteW) / 2;
    const col = LANE_COLORS[note.lane];

    // Glow
    const grd = ctx2d.createLinearGradient(x, note.y, x, note.y + noteH);
    grd.addColorStop(0, col + 'ff');
    grd.addColorStop(1, col + '99');

    drawRoundRect(ctx2d, x, note.y, noteW, noteH, 8, grd, '#ffffff22', 1.5);

    // Inner highlight
    ctx2d.fillStyle = 'rgba(255,255,255,0.15)';
    ctx2d.fillRect(x + 4, note.y + 3, noteW - 8, 5);
  });
}

function drawRoundRect(ctx, x, y, w, h, r, fill, stroke, sw) {
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
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw || 1; ctx.stroke(); }
}

// ─── Input Handling ───────────────────────────────────────────────

function handleLaneTap(lane) {
  if (State.phase !== 'playing') return;
  audio.resume();

  const t = gameTime();
  const W = DOM.canvas.width;
  const H = DOM.canvas.height;
  const hitY = H * HIT_ZONE_Y;

  // Find closest unhit note in this lane within miss window
  let best = null;
  let bestDelta = Infinity;

  State.notes.forEach(note => {
    if (note.hit || note.missed || note.lane !== lane) return;
    const delta = Math.abs(t - note.hitTime);
    if (delta < WINDOW.MISS && delta < bestDelta) {
      best = note;
      bestDelta = delta;
    }
  });

  const noteH = Math.max(28, (W / LANE_COUNT) * 0.3);

  if (!best) {
    // Pressed but no note — show lane flash only
    flashLane(lane, H, hitY, noteH);
    return;
  }

  const grade =
    bestDelta <= WINDOW.PERFECT ? 'PERFECT' :
    bestDelta <= WINDOW.GREAT   ? 'GREAT'   :
    bestDelta <= WINDOW.GOOD    ? 'GOOD'    : 'MISS';

  best.hit = true;
  registerGrade(lane, grade, hitY);
  flashLane(lane, H, hitY, noteH);
}

function registerGrade(lane, grade, noteY) {
  State.grades[grade]++;

  if (grade === 'MISS') {
    State.combo = 0;
    adjustHealth(GRADE_HEALTH.MISS);
    audio.playMiss();
    showFeedback(lane, 'MISS', noteY);
    if (State.health <= 0) endGame(true);
    updateHUD();
    return;
  }

  State.score += GRADE_SCORE[grade] * (1 + Math.floor(State.combo / 10) * 0.1);
  State.combo++;
  if (State.combo > State.maxCombo) State.maxCombo = State.combo;
  adjustHealth(GRADE_HEALTH[grade]);
  audio.playHit(lane, grade);
  showFeedback(lane, grade, noteY);
  updateHUD();
}

function adjustHealth(delta) {
  State.health = Math.max(0, Math.min(100, State.health + delta));
  DOM.healthFill.style.width = State.health + '%';
  DOM.healthFill.classList.toggle('low', State.health < 30);
}

// ─── Feedback Popup ───────────────────────────────────────────────

function showFeedback(lane, grade, y) {
  const W = DOM.canvas.width;
  const laneW = W / LANE_COUNT;
  const x = lane * laneW + laneW / 2;

  const el = document.createElement('div');
  el.className = 'hit-feedback';
  el.textContent = grade;
  el.style.color = GRADE_COLOR[grade];
  el.style.left  = `${x}px`;
  el.style.top   = `${y - 20}px`;
  el.style.transform = 'translateX(-50%)';

  DOM.app.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ─── Lane Flash ───────────────────────────────────────────────────

function flashLane(lane, canvasH, hitY, noteH) {
  const W = DOM.canvas.width;
  const laneW = W / LANE_COUNT;

  const el = document.createElement('div');
  el.className = 'lane-flash';
  el.style.left    = `${lane * laneW}px`;
  el.style.width   = `${laneW}px`;
  el.style.height  = `${canvasH - hitY + noteH}px`;
  el.style.bottom  = '0';
  el.style.background = `linear-gradient(to top, ${LANE_COLORS[lane]}55, transparent)`;
  DOM.app.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ─── HUD Update ───────────────────────────────────────────────────

function updateHUD() {
  DOM.hudScore.textContent = Math.floor(State.score).toLocaleString();
  DOM.hudCombo.textContent = State.combo;

  // Bump animation
  DOM.hudCombo.classList.remove('bump');
  void DOM.hudCombo.offsetWidth; // reflow
  if (State.combo > 0) DOM.hudCombo.classList.add('bump');
}

// ─── Pause / Resume ───────────────────────────────────────────────

function pauseGame() {
  if (State.phase !== 'playing') return;
  State.phase      = 'paused';
  State.pauseStart = performance.now();
  cancelAnimationFrame(State.animId);
  DOM.pauseScore.textContent = Math.floor(State.score).toLocaleString() + '점';
  DOM.btnPause.style.display = 'none';
  showScreen('pause');
}

function resumeGame() {
  if (State.phase !== 'pause') return;
  State.elapsedPaused += performance.now() - State.pauseStart;
  showScreen('playing');
  DOM.btnPause.style.display = 'flex';
  loop();
}

// ─── End Game ─────────────────────────────────────────────────────

function endGame(failed = false) {
  cancelAnimationFrame(State.animId);
  State.animId = null;

  const finalScore = Math.floor(State.score);
  const isNewBest  = Storage.setBest(State.song.id, finalScore);

  DOM.resultTitle.textContent     = failed ? '게임 오버' : '결과';
  DOM.resultScore.textContent     = finalScore.toLocaleString();
  DOM.resultNewBest.style.display = isNewBest ? 'block' : 'none';
  DOM.resultPerfect.textContent   = State.grades.PERFECT;
  DOM.resultGreat.textContent     = State.grades.GREAT;
  DOM.resultGood.textContent      = State.grades.GOOD;
  DOM.resultMiss.textContent      = State.grades.MISS;
  DOM.resultMaxCombo.textContent  = State.maxCombo;

  if(typeof Leaderboard!=='undefined')Leaderboard.ready('rhythm',finalScore,{});
  showScreen('result');
  buildSongList(); // refresh best scores
}

// ─── Touch / Mouse Events ────────────────────────────────────────

function laneFromX(x) {
  const W = DOM.canvas.width;
  return Math.min(LANE_COUNT - 1, Math.max(0, Math.floor((x / W) * LANE_COUNT)));
}

DOM.canvas.addEventListener('pointerdown', e => {
  if (State.phase !== 'playing') return;
  e.preventDefault();
  const rect = DOM.canvas.getBoundingClientRect();
  const x    = e.clientX - rect.left;
  handleLaneTap(laneFromX(x));
}, { passive: false });

// Keyboard support (A S D F for lanes 0-3)
const KEY_LANES = { KeyA: 0, KeyS: 1, KeyD: 2, KeyF: 3,
                    ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
document.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Escape') {
    if (State.phase === 'playing') pauseGame();
    else if (State.phase === 'pause') resumeGame();
    return;
  }
  if (KEY_LANES[e.code] !== undefined && State.phase === 'playing') {
    handleLaneTap(KEY_LANES[e.code]);
  }
});

// ─── Button Wiring ────────────────────────────────────────────────

$('btn-play').addEventListener('click', () => showScreen('select'));
$('btn-select-back').addEventListener('click', () => showScreen('start'));
$('btn-start-song').addEventListener('click', () => {
  const song = SONGS[State.selectedSongIdx];
  if (song) startGame(song);
});

DOM.btnPause.addEventListener('click', pauseGame);
$('btn-resume').addEventListener('click', resumeGame);
$('btn-quit').addEventListener('click', () => {
  cancelAnimationFrame(State.animId);
  State.animId = null;
  showScreen('select');
});
$('btn-retry').addEventListener('click', () => {
  startGame(State.song);
});
$('btn-back-to-select').addEventListener('click', () => {
  showScreen('select');
  buildSongList();
});

// ─── Boot ─────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  if (State.phase === 'playing' || State.phase === 'paused') resizeCanvas();
});

buildSongList();
showScreen('start');
