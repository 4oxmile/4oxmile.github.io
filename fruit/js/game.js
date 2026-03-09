// ─── FRUIT NINJA GAME ─────────────────────────────────────────────────────────

const FRUITS = ['🍎','🍊','🍋','🍇','🍉','🍓','🍑','🥝'];
const FRUIT_COLORS = {
  '🍎': '#EF4444',
  '🍊': '#F97316',
  '🍋': '#EAB308',
  '🍇': '#A855F7',
  '🍉': '#22C55E',
  '🍓': '#F43F5E',
  '🍑': '#FB923C',
  '🥝': '#84CC16',
};
const GAME_DURATION = 60;
const MAX_LIVES = 3;
const GRAVITY = 0.26;
const FRUIT_SCORE = 10;
const COMBO_WINDOW = 400; // ms
const MAX_ACTIVE_FRUITS = 8;
const MIN_SPAWN_GAP = 68;
const LAUNCH_SPEED_MIN = 16.5;
const LAUNCH_SPEED_MAX = 21.5;

// ─── STATE ────────────────────────────────────────────────────────────────────
let state = {
  phase: 'start', // start | playing | paused | gameover
  score: 0,
  highScore: parseInt(localStorage.getItem('fruitHighScore') || '0'),
  lives: MAX_LIVES,
  timeLeft: GAME_DURATION,
  fruits: [],
  particles: [],
  slashTrail: [],
  slashBursts: [],
  sliceVelocity: { x: 0, y: 0 },
  lastMousePos: null,
  isDragging: false,
  combo: 0,
  lastSliceTime: 0,
  comboTimeout: null,
  totalSliced: 0,
  bombsHit: 0,
  gameOverReason: '',
  spawnTimer: 0,
  spawnInterval: 90, // frames
  frameCount: 0,
  animId: null,
  timerInterval: null,
  pausedAt: null,
};

// ─── CANVAS ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || '').replace('#', '');
  if (clean.length !== 6) return `rgba(255,255,255,${alpha})`;
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function resizeCanvas() {
  const wrapper = document.getElementById('game-wrapper');
  W = wrapper.clientWidth;
  H = wrapper.clientHeight;
  canvas.width = W;
  canvas.height = H;
}

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const overlayStart    = document.getElementById('overlay-start');
const overlayGameover = document.getElementById('overlay-gameover');
const overlayPause    = document.getElementById('overlay-pause');
const hudScore        = document.getElementById('hud-score');
const hudHighScore    = document.getElementById('hud-highscore');
const timerProgress   = document.getElementById('timer-progress');
const timerText       = document.getElementById('timer-text');
const livesDisplay    = document.getElementById('lives-display');
const comboDisplay    = document.getElementById('combo-display');
const bombFlash       = document.getElementById('bomb-flash');
const startHighScore  = document.getElementById('start-highscore');
const resultScore     = document.getElementById('result-score');
const resultRecord    = document.getElementById('result-record');
const resultSliced    = document.getElementById('result-sliced');
const resultCombo     = document.getElementById('result-combo');
const goTitle         = document.getElementById('go-title');
const goReason        = document.getElementById('go-reason');

// ─── TIMER RING ───────────────────────────────────────────────────────────────
const TIMER_RADIUS = 18;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;

function updateTimerRing(seconds) {
  const fraction = seconds / GAME_DURATION;
  const offset = TIMER_CIRCUMFERENCE * (1 - fraction);
  timerProgress.style.strokeDasharray = TIMER_CIRCUMFERENCE;
  timerProgress.style.strokeDashoffset = offset;
  timerText.textContent = seconds;
  if (seconds <= 10) {
    timerProgress.style.stroke = '#EF4444';
  } else if (seconds <= 20) {
    timerProgress.style.stroke = '#F97316';
  } else {
    timerProgress.style.stroke = 'var(--accent)';
  }
}

function updateLives() {
  const icons = livesDisplay.querySelectorAll('.life-icon');
  icons.forEach((icon, i) => {
    icon.classList.toggle('lost', i >= state.lives);
  });
}

function updateHUD() {
  hudScore.textContent = state.score;
  hudHighScore.textContent = Math.max(state.score, state.highScore);
  updateTimerRing(state.timeLeft);
  updateLives();
}

// ─── OVERLAYS ─────────────────────────────────────────────────────────────────
function showOverlay(id) {
  [overlayStart, overlayGameover, overlayPause].forEach(el => el.classList.add('hidden'));
  if (id) document.getElementById(id).classList.remove('hidden');
}

function hideAllOverlays() {
  [overlayStart, overlayGameover, overlayPause].forEach(el => el.classList.add('hidden'));
}

// ─── FRUIT CLASS ──────────────────────────────────────────────────────────────
let fruitIdCounter = 0;

class Fruit {
  constructor(opts = {}) {
    this.id = fruitIdCounter++;
    this.isBomb = opts.isBomb ?? (Math.random() < 0.12);
    this.emoji = this.isBomb ? '💣' : FRUITS[Math.floor(Math.random() * FRUITS.length)];
    this.color = this.isBomb ? '#6B7280' : (FRUIT_COLORS[this.emoji] || '#fff');
    this.radius = 28 + Math.random() * 8;

    const minX = this.radius + 6;
    const maxX = W - this.radius - 6;
    const initialX = typeof opts.x === 'number'
      ? opts.x
      : this.radius + Math.random() * (W - this.radius * 2);

    this.x = clamp(initialX, minX, maxX);
    this.y = H + this.radius;

    // Arc trajectory: toss up from bottom
    const angle = typeof opts.angle === 'number'
      ? opts.angle
      : -Math.PI / 2 + (Math.random() - 0.5) * 1.1;
    const speed = typeof opts.speed === 'number' ? opts.speed : (LAUNCH_SPEED_MIN + Math.random() * (LAUNCH_SPEED_MAX - LAUNCH_SPEED_MIN));

    this.vx = typeof opts.vx === 'number' ? opts.vx : Math.cos(angle) * speed;
    this.vy = typeof opts.vy === 'number' ? opts.vy : Math.sin(angle) * speed;

    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.12;
    this.sliced = false;
    this.alive = true;
    this.halfA = null; // after slice
    this.halfB = null;
    this.glowAlpha = 0;
  }

  update() {
    this.vy += GRAVITY;
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotSpeed;
    if (this.y > H + this.radius * 2) {
      this.alive = false;
    }
  }

  isOffScreen() {
    return this.y > H + this.radius * 2 || this.x < -this.radius * 3 || this.x > W + this.radius * 3;
  }

  draw() {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    // soft shadow
    ctx.beginPath();
    ctx.arc(2, 5, this.radius * 0.95, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();

    // vivid color plate under emoji so fruits don't look dull.
    if (!this.isBomb) {
      const aura = ctx.createRadialGradient(
        -this.radius * 0.25, -this.radius * 0.35, this.radius * 0.12,
        0, 0, this.radius * 1.05
      );
      aura.addColorStop(0, hexToRgba(this.color, 0.6));
      aura.addColorStop(0.55, hexToRgba(this.color, 0.32));
      aura.addColorStop(1, hexToRgba(this.color, 0));

      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.98, 0, Math.PI * 2);
      ctx.fillStyle = aura;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.95, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(this.color, 0.55);
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // top highlight
      ctx.beginPath();
      ctx.ellipse(-this.radius * 0.22, -this.radius * 0.28, this.radius * 0.2, this.radius * 0.1, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fill();
    }

    if (this.glowAlpha > 0) {
      ctx.shadowBlur = 24;
      ctx.shadowColor = this.color;
      ctx.globalAlpha = this.glowAlpha;
      this.glowAlpha *= 0.85;
    } else {
      ctx.globalAlpha = 1;
    }

    // emoji
    ctx.font = `${this.radius * 1.8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, 0, 0);

    ctx.restore();
  }
}

// ─── FRUIT HALF ───────────────────────────────────────────────────────────────
class FruitHalf {
  constructor(fruit, side) {
    this.emoji = fruit.emoji;
    this.x = fruit.x + (side === 'left' ? -8 : 8);
    this.y = fruit.y;
    this.vx = fruit.vx * 0.4 + (side === 'left' ? -3 : 3);
    // Keep pieces from unnaturally popping upward on slice.
    this.vy = Math.max(0.6, fruit.vy * 0.3 + 1.1);
    this.rotation = fruit.rotation;
    this.rotSpeed = fruit.rotSpeed + (side === 'left' ? -0.12 : 0.12);
    this.radius = fruit.radius * 0.85;
    this.alpha = 1;
    this.side = side;
    this.alive = true;
  }

  update() {
    this.vy += GRAVITY * 0.8;
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotSpeed;
    this.alpha -= 0.025;
    if (this.alpha <= 0 || this.y > H + 100) this.alive = false;
  }

  draw() {
    if (!this.alive) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.globalAlpha = this.alpha;

    // clip to half
    ctx.beginPath();
    if (this.side === 'left') {
      ctx.rect(-this.radius * 2, -this.radius * 2, this.radius * 2, this.radius * 4);
    } else {
      ctx.rect(0, -this.radius * 2, this.radius * 2, this.radius * 4);
    }
    ctx.clip();

    ctx.font = `${this.radius * 1.8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.emoji, 0, 0);
    ctx.restore();
  }
}

// ─── PARTICLE ─────────────────────────────────────────────────────────────────
class Particle {
  constructor(x, y, color, isBomb) {
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = isBomb ? 4 + Math.random() * 8 : 2 + Math.random() * 5;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - (isBomb ? 3 : 2);
    this.color = isBomb ? `hsl(${20 + Math.random() * 40}, 90%, ${40 + Math.random() * 30}%)` : color;
    this.radius = isBomb ? 3 + Math.random() * 5 : 2 + Math.random() * 4;
    this.alpha = 1;
    this.decay = isBomb ? 0.03 : 0.035 + Math.random() * 0.02;
    this.alive = true;
  }

  update() {
    this.vy += GRAVITY * 0.3;
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
    if (this.alpha <= 0) this.alive = false;
  }

  draw() {
    if (!this.alive) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.restore();
  }
}

class SlashBurst {
  constructor(x, y, angle, length = 90) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.length = length;
    this.width = 10;
    this.life = 1;
    this.alive = true;
  }

  update() {
    this.life -= 0.12;
    this.length *= 0.92;
    this.width *= 0.88;
    if (this.life <= 0.02) this.alive = false;
  }

  draw() {
    if (!this.alive) return;
    const alpha = Math.max(0, this.life);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const grad = ctx.createLinearGradient(-this.length / 2, 0, this.length / 2, 0);
    grad.addColorStop(0, `rgba(255,255,255,0)`);
    grad.addColorStop(0.35, `rgba(255,255,255,${0.75 * alpha})`);
    grad.addColorStop(0.7, `rgba(130,220,255,${0.95 * alpha})`);
    grad.addColorStop(1, `rgba(255,255,255,0)`);

    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.lineWidth = this.width;
    ctx.shadowBlur = 16;
    ctx.shadowColor = `rgba(120,210,255,${0.65 * alpha})`;
    ctx.beginPath();
    ctx.moveTo(-this.length * 0.5, 0);
    ctx.lineTo(this.length * 0.5, 0);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1.2, this.width * 0.3);
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * alpha})`;
    ctx.beginPath();
    ctx.moveTo(-this.length * 0.42, 0);
    ctx.lineTo(this.length * 0.42, 0);
    ctx.stroke();

    ctx.restore();
  }
}

function spawnSlashBurst(x, y, angle, length) {
  state.slashBursts.push(new SlashBurst(x, y, angle, length));
}
// ─── SPAWN ────────────────────────────────────────────────────────────────────
function spawnFruit() {
  const activeFruits = state.fruits.filter(f => f instanceof Fruit && f.alive && !f.sliced);
  const availableSlots = MAX_ACTIVE_FRUITS - activeFruits.length;
  if (availableSlots <= 0) return;

  const spawnCount = Math.min(availableSlots, Math.random() < 0.22 ? 2 : 1);
  const launchZoneXs = activeFruits
    .filter(f => f.y > H * 0.58)
    .map(f => f.x);

  const chosenXs = [];
  const left = 30;
  const right = Math.max(left + 1, W - 30);

  for (let i = 0; i < spawnCount; i++) {
    let x = randomRange(left, right);
    let tries = 0;

    while (tries < 12) {
      const tooCloseToExisting = launchZoneXs.some(px => Math.abs(px - x) < MIN_SPAWN_GAP);
      const tooCloseToNew = chosenXs.some(px => Math.abs(px - x) < MIN_SPAWN_GAP);
      if (!tooCloseToExisting && !tooCloseToNew) break;
      x = randomRange(left, right);
      tries++;
    }

    chosenXs.push(x);

    // Slightly curve toss direction toward center to reduce overlap in trajectory.
    const centerBias = (W / 2 - x) / (W / 2);
    const angle = -Math.PI / 2 + centerBias * 0.2 + randomRange(-0.22, 0.22);
    const speed = randomRange(LAUNCH_SPEED_MIN, LAUNCH_SPEED_MAX);

    state.fruits.push(new Fruit({ x, angle, speed }));
  }
}

// ─── SLASH DETECTION ──────────────────────────────────────────────────────────
function checkSlice(x1, y1, x2, y2) {
  if (!state.isDragging) return;
  const sliceLength = Math.hypot(x2 - x1, y2 - y1);
  if (sliceLength < 10) return;

  for (const fruit of state.fruits) {
    // Score/collision applies only to original Fruit, not sliced halves.
    if (!(fruit instanceof Fruit)) continue;
    if (!fruit.alive || fruit.sliced) continue;

    // Line-circle intersection
    if (lineIntersectsCircle(x1, y1, x2, y2, fruit.x, fruit.y, fruit.radius * 0.85)) {
      const slashAngle = Math.atan2(y2 - y1, x2 - x1);
      spawnSlashBurst(fruit.x, fruit.y, slashAngle, fruit.radius * 2.1);
      fruit.sliced = true;
      fruit.alive = false;

      if (fruit.isBomb) {
        handleBombSlice(fruit);
        return;
      }

      // Slice fruit
      state.totalSliced++;

      // Halves
      state.fruits.push(new FruitHalf(fruit, 'left'));
      state.fruits.push(new FruitHalf(fruit, 'right'));

      // Juice particles
      const col = fruit.color;
      for (let i = 0; i < 18; i++) {
        state.particles.push(new Particle(fruit.x, fruit.y, col, false));
      }

      // Combo
      const now = Date.now();
      if (now - state.lastSliceTime < COMBO_WINDOW) {
        state.combo++;
      } else {
        state.combo = 1;
      }
      state.lastSliceTime = now;
      state.maxCombo = Math.max(state.maxCombo || 0, state.combo);

      clearTimeout(state.comboTimeout);
      state.comboTimeout = setTimeout(() => {
        state.combo = 0;
        comboDisplay.style.opacity = '0';
      }, COMBO_WINDOW + 200);

      const points = FRUIT_SCORE + (state.combo > 1 ? (state.combo - 1) * 5 : 0);
      state.score += points;

      showScorePopup(fruit.x, fruit.y - fruit.radius, points, state.combo);

      if (state.combo > 1) {
        comboDisplay.textContent = `${state.combo}x COMBO!`;
        comboDisplay.style.opacity = '1';
        setTimeout(() => { comboDisplay.style.opacity = '0'; }, 800);
      }
    }
  }

  updateHUD();
}

function handleBombSlice(bomb) {
  // Explosion particles
  for (let i = 0; i < 40; i++) {
    state.particles.push(new Particle(bomb.x, bomb.y, '#EF4444', true));
  }

  // Flash
  bombFlash.classList.add('active');
  setTimeout(() => bombFlash.classList.remove('active'), 120);
  setTimeout(() => {
    bombFlash.classList.add('active');
    setTimeout(() => bombFlash.classList.remove('active'), 80);
  }, 180);

  // Shake
  shakeWrapper();

  // End game
  setTimeout(() => {
    endGame('폭탄을 잘랐습니다!');
  }, 300);
}

function lineIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) return Math.hypot(fx, fy) <= r;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return false;
  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

function shakeWrapper() {
  const wrapper = document.getElementById('game-wrapper');
  wrapper.style.transition = 'transform 0.05s ease';
  const shake = [
    [6, -4], [-6, 4], [4, 6], [-4, -6], [3, -3], [-3, 3], [0, 0]
  ];
  let i = 0;
  const interval = setInterval(() => {
    if (i >= shake.length) {
      clearInterval(interval);
      wrapper.style.transform = '';
      return;
    }
    wrapper.style.transform = `translate(${shake[i][0]}px, ${shake[i][1]}px)`;
    i++;
  }, 50);
}

// ─── SCORE POPUP ──────────────────────────────────────────────────────────────
function showScorePopup(x, y, points, combo) {
  const el = document.createElement('div');
  el.className = 'score-popup';
  el.style.left = `${Math.max(20, Math.min(W - 80, x - 20))}px`;
  el.style.top = `${Math.max(60, y)}px`;
  el.textContent = combo > 1 ? `+${points} ×${combo}` : `+${points}`;
  if (combo >= 3) el.style.color = '#F59E0B';
  if (combo >= 5) el.style.color = '#EF4444';
  document.getElementById('game-wrapper').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ─── MISSED FRUIT ─────────────────────────────────────────────────────────────
function handleMissedFruit(fruit) {
  if (fruit.isBomb) return; // bombs don't cost lives when missed
  state.lives--;
  updateLives();
  if (state.lives <= 0) {
    endGame('과일을 놓쳤습니다!');
  }
}

// ─── GAME LOOP ────────────────────────────────────────────────────────────────
function gameLoop() {
  if (state.phase !== 'playing') return;

  ctx.clearRect(0, 0, W, H);

  // Spawn
  state.spawnTimer++;
  if (state.spawnTimer >= state.spawnInterval) {
    state.spawnTimer = 0;
    spawnFruit();
    // Speed up as time progresses
    const progress = (GAME_DURATION - state.timeLeft) / GAME_DURATION;
    state.spawnInterval = Math.max(40, 90 - progress * 40);
  }

  // Draw slash trail
  if (state.slashTrail.length > 1) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < state.slashTrail.length; i++) {
      const t = i / state.slashTrail.length;
      const alpha = t * 0.8;
      const width = t * 4;
      ctx.beginPath();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = width;
      ctx.moveTo(state.slashTrail[i - 1].x, state.slashTrail[i - 1].y);
      ctx.lineTo(state.slashTrail[i].x, state.slashTrail[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Fade trail
    state.slashTrail.shift();
  }

  // Update and draw slash bursts
  for (let i = state.slashBursts.length - 1; i >= 0; i--) {
    const slash = state.slashBursts[i];
    slash.update();
    slash.draw();
    if (!slash.alive) state.slashBursts.splice(i, 1);
  }

  // Update and draw particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    state.particles[i].update();
    state.particles[i].draw();
    if (!state.particles[i].alive) state.particles.splice(i, 1);
  }

  // Update and draw fruits
  for (let i = state.fruits.length - 1; i >= 0; i--) {
    const f = state.fruits[i];

    if (f instanceof FruitHalf) {
      f.update();
      f.draw();
      if (!f.alive) state.fruits.splice(i, 1);
      continue;
    }

    f.update();

    if (!f.alive) {
      if (!f.sliced && f.isOffScreen()) {
        handleMissedFruit(f);
        if (state.phase !== 'playing') return;
      }
      state.fruits.splice(i, 1);
      continue;
    }

    f.draw();
  }

  state.frameCount++;
  state.animId = requestAnimationFrame(gameLoop);
}

// ─── TIMER ────────────────────────────────────────────────────────────────────
function startTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    if (state.phase !== 'playing') return;
    state.timeLeft--;
    updateTimerRing(state.timeLeft);
    if (state.timeLeft <= 0) {
      endGame('시간 종료!', true);
    }
  }, 1000);
}

// ─── GAME CONTROL ─────────────────────────────────────────────────────────────
function startGame() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  state.score = 0;
  state.lives = MAX_LIVES;
  state.timeLeft = GAME_DURATION;
  state.fruits = [];
  state.particles = [];
  state.slashTrail = [];
  state.slashBursts = [];
  state.isDragging = false;
  state.combo = 0;
  state.maxCombo = 0;
  state.totalSliced = 0;
  state.spawnTimer = 0;
  state.spawnInterval = 90;
  state.frameCount = 0;
  state.phase = 'playing';
  state.gameOverReason = '';
  fruitIdCounter = 0;

  cancelAnimationFrame(state.animId);
  cancelAnimationFrame(idleAnimId);
  clearInterval(state.timerInterval);
  clearTimeout(state.comboTimeout);

  hideAllOverlays();
  updateHUD();
  updateTimerRing(GAME_DURATION);
  timerProgress.style.stroke = 'var(--accent)';

  startTimer();
  gameLoop();
}

function pauseGame() {
  if (state.phase !== 'playing') return;
  state.phase = 'paused';
  cancelAnimationFrame(state.animId);
  clearInterval(state.timerInterval);
  showOverlay('overlay-pause');
}

function resumeGame() {
  if (state.phase !== 'paused') return;
  state.phase = 'playing';
  hideAllOverlays();
  startTimer();
  gameLoop();
}

function endGame(reason, timeUp = false) {
  state.phase = 'gameover';
  state.gameOverReason = reason;
  cancelAnimationFrame(state.animId);
  clearInterval(state.timerInterval);

  // Save high score
  const isNewRecord = state.score > state.highScore;
  if (isNewRecord) {
    state.highScore = state.score;
    localStorage.setItem('fruitHighScore', state.highScore);
  }

  // Update result overlay
  goTitle.textContent = timeUp ? '타임 업!' : '게임 오버';
  goTitle.style.color = timeUp ? 'var(--accent)' : '#EF4444';
  goReason.textContent = reason;
  resultScore.textContent = state.score;
  resultSliced.textContent = state.totalSliced;
  resultCombo.textContent = state.maxCombo || 0;

  if (isNewRecord && state.score > 0) {
    resultRecord.classList.add('show');
    resultRecord.textContent = '최고 기록 갱신!';
  } else {
    resultRecord.classList.remove('show');
    resultRecord.textContent = `최고 기록: ${state.highScore}`;
    if (state.highScore > 0) resultRecord.classList.add('show');
  }

  showOverlay('overlay-gameover');
  if(typeof Leaderboard!=='undefined')Leaderboard.ready('fruit',state.score);
}

// ─── INPUT ────────────────────────────────────────────────────────────────────
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  if (e.changedTouches) {
    const t = e.changedTouches[0];
    return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
  }
  return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function onPointerDown(e) {
  if (state.phase !== 'playing') return;
  e.preventDefault();
  const pos = getPos(e);
  state.isDragging = true;
  state.lastMousePos = pos;
  state.slashTrail = [pos];
}

function onPointerMove(e) {
  if (state.phase !== 'playing' || !state.isDragging) return;
  e.preventDefault();
  const pos = getPos(e);
  const prev = state.lastMousePos || pos;

  state.slashTrail.push(pos);
  if (state.slashTrail.length > 20) state.slashTrail.shift();

  checkSlice(prev.x, prev.y, pos.x, pos.y);
  state.lastMousePos = pos;
}

function onPointerUp(e) {
  e.preventDefault();
  state.isDragging = false;
  state.lastMousePos = null;
  // Trail fades naturally
}

// Mouse
canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('mousemove', onPointerMove);
canvas.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('mouseleave', onPointerUp);

// Touch
canvas.addEventListener('touchstart', onPointerDown, { passive: false });
canvas.addEventListener('touchmove', onPointerMove, { passive: false });
canvas.addEventListener('touchend', onPointerUp, { passive: false });

// ─── BUTTONS ──────────────────────────────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-menu').addEventListener('click', () => {
  state.phase = 'start';
  cancelAnimationFrame(state.animId);
  clearInterval(state.timerInterval);
  clearTimeout(state.comboTimeout);
  state.highScore = parseInt(localStorage.getItem('fruitHighScore') || '0');
  startHighScore.textContent = state.highScore;
  showOverlay('overlay-start');
  cancelAnimationFrame(idleAnimId);
  idleLoop();
});
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-quit').addEventListener('click', () => {
  state.phase = 'start';
  cancelAnimationFrame(state.animId);
  clearInterval(state.timerInterval);
  clearTimeout(state.comboTimeout);
  state.highScore = parseInt(localStorage.getItem('fruitHighScore') || '0');
  startHighScore.textContent = state.highScore;
  showOverlay('overlay-start');
  cancelAnimationFrame(idleAnimId);
  idleLoop();
});
document.getElementById('pause-btn').addEventListener('click', pauseGame);

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (state.phase === 'playing') pauseGame();
    else if (state.phase === 'paused') resumeGame();
  }
  if (e.key === 'Enter') {
    if (state.phase === 'start' || state.phase === 'gameover') startGame();
  }
});

// ─── RESIZE ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  resizeCanvas();
  if (state.phase !== 'playing') {
    ctx.clearRect(0, 0, W, H);
  }
});

// ─── IDLE ANIMATION (Start Screen) ────────────────────────────────────────────
let idleFruits = [];
let idleAnimId = null;

function spawnIdleFruit() {
  const f = new Fruit();
  f.isBomb = false;
  f.emoji = FRUITS[Math.floor(Math.random() * FRUITS.length)];
  f.color = FRUIT_COLORS[f.emoji];
  idleFruits.push(f);
}

function idleLoop() {
  if (state.phase !== 'start') {
    idleFruits = [];
    return;
  }
  ctx.clearRect(0, 0, W, H);

  if (Math.random() < 0.018) spawnIdleFruit();

  for (let i = idleFruits.length - 1; i >= 0; i--) {
    const f = idleFruits[i];
    f.update();
    f.draw();
    if (f.isOffScreen()) idleFruits.splice(i, 1);
  }

  idleAnimId = requestAnimationFrame(idleLoop);
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  resizeCanvas();
  state.highScore = parseInt(localStorage.getItem('fruitHighScore') || '0');
  startHighScore.textContent = state.highScore;
  updateTimerRing(GAME_DURATION);
  showOverlay('overlay-start');
  cancelAnimationFrame(idleAnimId);
  idleLoop();
}

init();
