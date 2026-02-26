'use strict';

// ─── Compat: rounded rect path ────────────────────────────────────────────────
function roundedRect(ctx2d, x, y, w, h, radii) {
  // radii: [topLeft, topRight, bottomRight, bottomLeft]
  const [tl, tr, br, bl] = radii;
  ctx2d.beginPath();
  ctx2d.moveTo(x + tl, y);
  ctx2d.lineTo(x + w - tr, y);
  ctx2d.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx2d.lineTo(x + w, y + h - br);
  ctx2d.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx2d.lineTo(x + bl, y + h);
  ctx2d.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx2d.lineTo(x, y + tl);
  ctx2d.quadraticCurveTo(x, y, x + tl, y);
  ctx2d.closePath();
}

// ─── Canvas & Context ───────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ─── DOM refs ────────────────────────────────────────────────────────────────
const scoreEl       = document.getElementById('score-value');
const bestEl        = document.getElementById('best-value');
const startOverlay  = document.getElementById('start-overlay');
const gameoverOverlay = document.getElementById('gameover-overlay');
const pauseOverlay  = document.getElementById('pause-overlay');
const pauseBtn      = document.getElementById('pause-btn');
const diffFill      = document.getElementById('diff-fill');
const goScore       = document.getElementById('go-score');
const goBest        = document.getElementById('go-best');
const newRecordEl   = document.getElementById('new-record');

// ─── Game state ───────────────────────────────────────────────────────────────
const STATE = { IDLE: 0, PLAYING: 1, DEAD: 2, PAUSED: 3 };
let state = STATE.IDLE;
let score = 0;
let bestScore = parseInt(localStorage.getItem('flappy_best') || '0', 10);
let animId = null;
let lastTime = 0;

// ─── Physics constants ────────────────────────────────────────────────────────
const GRAVITY       = 1800;   // px/s²
const FLAP_FORCE    = -520;   // px/s (upward)
const BASE_SPEED    = 220;    // px/s pipe scroll speed
const SPEED_INC     = 4;      // px/s per score point
const MAX_SPEED     = 420;
const BASE_GAP      = 180;    // px between pipes
const MIN_GAP       = 110;
const GAP_DEC       = 1.2;    // px gap reduction per score point
const PIPE_INTERVAL = 1.5;    // seconds between pipe spawns
const PIPE_WIDTH    = 64;

// ─── Bird ─────────────────────────────────────────────────────────────────────
const bird = {
  x: 0, y: 0,
  radius: 18,
  vy: 0,
  angle: 0,
  flapAnim: 0,  // wing animation progress
  deadAnim: 0,
  trail: [],    // [{x,y,alpha}]
  reset(cx, cy) {
    this.x = cx;
    this.y = cy;
    this.vy = 0;
    this.angle = 0;
    this.flapAnim = 0;
    this.deadAnim = 0;
    this.trail = [];
  },
  flap() {
    this.vy = FLAP_FORCE;
    this.flapAnim = 1;
  },
  update(dt) {
    this.vy += GRAVITY * dt;
    this.y  += this.vy * dt;
    // Target angle based on velocity
    const targetAngle = Math.max(-30, Math.min(80, this.vy * 0.06)) * Math.PI / 180;
    this.angle += (targetAngle - this.angle) * Math.min(1, dt * 10);
    // Flap animation decay
    this.flapAnim = Math.max(0, this.flapAnim - dt * 5);
    // Trail
    this.trail.unshift({ x: this.x, y: this.y, alpha: 0.35 });
    if (this.trail.length > 8) this.trail.pop();
    this.trail.forEach(t => t.alpha *= 0.75);
  },
  draw(cW) {
    ctx.save();
    // Trail
    this.trail.forEach((t, i) => {
      const r = this.radius * (1 - i * 0.1);
      ctx.globalAlpha = t.alpha;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Shadow
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.ellipse(0, this.radius + 4, this.radius * 0.9, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    // Body glow
    const glow = ctx.createRadialGradient(-4, -4, 2, 0, 0, this.radius * 1.4);
    glow.addColorStop(0, 'rgba(252,211,77,0.5)');
    glow.addColorStop(1, 'rgba(245,158,11,0)');
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 1.4, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Body
    const bodyGrad = ctx.createRadialGradient(-5, -6, 2, 0, 0, this.radius);
    bodyGrad.addColorStop(0, '#FDE68A');
    bodyGrad.addColorStop(0.5, '#F59E0B');
    bodyGrad.addColorStop(1, '#D97706');
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Wing
    const wingOffset = Math.sin(Date.now() * 0.015) * 4 + this.flapAnim * 8;
    ctx.save();
    ctx.translate(-4, 0);
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.ellipse(0, wingOffset, 10, 6, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#FCD34D';
    ctx.fill();
    ctx.restore();

    // Belly
    ctx.beginPath();
    ctx.ellipse(3, 4, 8, 6, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(7, -5, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(8.5, -5.5, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#1C1917';
    ctx.fill();
    // Eye shine
    ctx.beginPath();
    ctx.arc(9.5, -6.5, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(12, -3);
    ctx.lineTo(20, 0);
    ctx.lineTo(12, 4);
    ctx.closePath();
    ctx.fillStyle = '#FB923C';
    ctx.fill();
    ctx.strokeStyle = '#EA580C';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.restore();
  }
};

// ─── Pipes ────────────────────────────────────────────────────────────────────
let pipes = [];
let pipeTimer = 0;
let pipesPassed = 0;

function pipeGap() {
  return Math.max(MIN_GAP, BASE_GAP - score * GAP_DEC);
}

function pipeSpeed() {
  return Math.min(MAX_SPEED, BASE_SPEED + score * SPEED_INC);
}

function spawnPipe(cW, cH) {
  const gap  = pipeGap();
  const minY = 80;
  const maxY = cH - 80 - gap;
  const gapY = minY + Math.random() * (maxY - minY);
  pipes.push({ x: cW + PIPE_WIDTH, gapY, gap, scored: false });
}

function updatePipes(dt, cW, cH) {
  pipeTimer += dt;
  if (pipeTimer >= PIPE_INTERVAL) {
    spawnPipe(cW, cH);
    pipeTimer = 0;
  }
  const speed = pipeSpeed();
  pipes.forEach(p => { p.x -= speed * dt; });
  pipes = pipes.filter(p => p.x + PIPE_WIDTH > -20);

  // Scoring
  pipes.forEach(p => {
    if (!p.scored && p.x + PIPE_WIDTH < bird.x) {
      p.scored = true;
      score++;
      scoreEl.textContent = score;
      pipesPassed++;
      updateDifficulty();
    }
  });
}

function drawPipe(p, cH) {
  const pw = PIPE_WIDTH;
  const capH = 24;

  // Pipe color based on score / theme
  const hue = (score * 15) % 360;
  const pipeColor  = `hsl(${hue}, 60%, 35%)`;
  const pipeDark   = `hsl(${hue}, 60%, 22%)`;
  const pipeLight  = `hsl(${hue}, 60%, 50%)`;

  // Top pipe
  const topH = p.gapY;
  drawPipeSegment(p.x, 0, pw, topH, capH, pipeColor, pipeDark, pipeLight, 'top');

  // Bottom pipe
  const botY = p.gapY + p.gap;
  const botH = cH - botY;
  drawPipeSegment(p.x, botY, pw, botH, capH, pipeColor, pipeDark, pipeLight, 'bottom');

  // Gap glow / highlight
  ctx.save();
  const glowGrad = ctx.createLinearGradient(p.x, p.gapY, p.x, p.gapY + p.gap);
  glowGrad.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.08)`);
  glowGrad.addColorStop(0.5, `hsla(${hue}, 80%, 60%, 0.02)`);
  glowGrad.addColorStop(1, `hsla(${hue}, 80%, 60%, 0.08)`);
  ctx.fillStyle = glowGrad;
  ctx.fillRect(p.x, p.gapY, pw, p.gap);
  ctx.restore();
}

function drawPipeSegment(x, y, w, h, capH, fill, dark, light, side) {
  if (h <= 0) return;
  ctx.save();

  // Main body
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, dark);
  grad.addColorStop(0.15, light);
  grad.addColorStop(0.5, fill);
  grad.addColorStop(0.85, fill);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.fillRect(x + 4, y, w - 8, h);

  // Cap (wider nub at gap edge)
  const capY = side === 'top' ? y + h - capH : y;
  const capGrad = ctx.createLinearGradient(x, 0, x + w, 0);
  capGrad.addColorStop(0, dark);
  capGrad.addColorStop(0.1, light);
  capGrad.addColorStop(0.5, fill);
  capGrad.addColorStop(0.9, fill);
  capGrad.addColorStop(1, dark);
  ctx.fillStyle = capGrad;
  if (side === 'top') {
    roundedRect(ctx, x, capY, w, capH, [0, 0, 6, 6]);
  } else {
    roundedRect(ctx, x, capY, w, capH, [6, 6, 0, 0]);
  }
  ctx.fill();

  // Highlight stripe
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x + 8, y, 6, h);

  // Edge shadows
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x + 4, y, 3, h);
  ctx.fillRect(x + w - 7, y, 3, h);

  ctx.restore();
}

// ─── Background ───────────────────────────────────────────────────────────────
const bgLayers = [
  // [speedFactor, numStars, starSizeRange, alpha]
  { sf: 0.05, stars: [], count: 60, size: [1, 2],   alpha: 0.3 },
  { sf: 0.15, stars: [], count: 30, size: [1.5, 3], alpha: 0.5 },
  { sf: 0.3,  stars: [], count: 15, size: [2, 4],   alpha: 0.7 },
];
let bgInit = false;

function initBg(cW, cH) {
  bgLayers.forEach(layer => {
    layer.stars = Array.from({ length: layer.count }, () => ({
      x: Math.random() * cW,
      y: Math.random() * cH,
      r: layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]),
      flicker: Math.random() * Math.PI * 2,
    }));
  });
  bgInit = true;
}

function drawBg(cW, cH, dt) {
  // Sky gradient
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches ||
    !window.matchMedia('(prefers-color-scheme: light)').matches;

  if (isDark) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, cH);
    skyGrad.addColorStop(0, '#040810');
    skyGrad.addColorStop(0.5, '#0A0E14');
    skyGrad.addColorStop(1, '#060A10');
    ctx.fillStyle = skyGrad;
  } else {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, cH);
    skyGrad.addColorStop(0, '#BFDBFE');
    skyGrad.addColorStop(0.5, '#DBEAFE');
    skyGrad.addColorStop(1, '#EFF6FF');
    ctx.fillStyle = skyGrad;
  }
  ctx.fillRect(0, 0, cW, cH);

  if (!isDark) return;

  // Parallax star layers
  const speed = pipeSpeed();
  bgLayers.forEach(layer => {
    layer.stars.forEach(s => {
      if (state === STATE.PLAYING) {
        s.x -= speed * layer.sf * dt;
        if (s.x < 0) s.x += cW;
        s.flicker += dt * 2;
      }
      const alpha = layer.alpha * (0.7 + 0.3 * Math.sin(s.flicker));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = '#C7D2FE';
      ctx.fill();
      ctx.restore();
    });
  });
}

// ─── Ground ───────────────────────────────────────────────────────────────────
let groundOffset = 0;

function drawGround(cW, cH, dt) {
  const gh = 0; // no visible ground strip; canvas fills entire height
  // subtle bottom horizon line
  ctx.save();
  const grad = ctx.createLinearGradient(0, cH - 50, 0, cH);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, cH - 50, cW, 50);
  ctx.restore();
}

// ─── Collision ────────────────────────────────────────────────────────────────
function checkCollision(cW, cH) {
  const r = bird.radius - 3; // slight forgiveness
  // Ceiling
  if (bird.y - r < 0) return true;
  // Floor
  if (bird.y + r > cH) return true;
  // Pipes
  return pipes.some(p => {
    const inX = bird.x + r > p.x && bird.x - r < p.x + PIPE_WIDTH;
    if (!inX) return false;
    const inTopPipe  = bird.y - r < p.gapY;
    const inBotPipe  = bird.y + r > p.gapY + p.gap;
    return inTopPipe || inBotPipe;
  });
}

// ─── Score & difficulty ───────────────────────────────────────────────────────
function updateDifficulty() {
  const maxScore = 50;
  const pct = Math.min(1, score / maxScore) * 100;
  diffFill.style.width = pct + '%';
}

// ─── Game lifecycle ───────────────────────────────────────────────────────────
function resize() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  if (!bgInit) initBg(canvas.width, canvas.height);
}

function showOverlay(el) {
  [startOverlay, gameoverOverlay, pauseOverlay].forEach(o => o.classList.add('hidden'));
  if (el) el.classList.remove('hidden');
}

function startGame() {
  score = 0;
  pipes = [];
  pipeTimer = 0;
  scoreEl.textContent = '0';
  diffFill.style.width = '0%';

  const cW = canvas.width, cH = canvas.height;
  bird.reset(cW * 0.28, cH * 0.45);

  showOverlay(null);
  pauseBtn.classList.add('visible');
  state = STATE.PLAYING;
  lastTime = performance.now();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(gameLoop);
}

function triggerDeath() {
  state = STATE.DEAD;
  pauseBtn.classList.remove('visible');

  const isNew = score > bestScore;
  if (isNew) {
    bestScore = score;
    localStorage.setItem('flappy_best', bestScore);
    bestEl.textContent = bestScore;
  }

  goScore.textContent = score;
  goBest.textContent  = bestScore;
  newRecordEl.style.display = isNew ? 'flex' : 'none';

  // Brief delay before showing game over
  setTimeout(() => {
    showOverlay(gameoverOverlay);
  }, 600);
}

function togglePause() {
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
    pauseBtn.textContent = '▶';
    showOverlay(pauseOverlay);
  } else if (state === STATE.PAUSED) {
    state = STATE.PLAYING;
    pauseBtn.textContent = '⏸';
    showOverlay(null);
    lastTime = performance.now();
    animId = requestAnimationFrame(gameLoop);
  }
}

function handleInput() {
  if (state === STATE.IDLE) {
    startGame();
  } else if (state === STATE.PLAYING) {
    bird.flap();
  } else if (state === STATE.PAUSED) {
    togglePause();
  }
}

// ─── Draw score in canvas during gameplay ─────────────────────────────────────
function drawInGameScore(cW) {
  // Just keep the DOM overlay, no extra canvas drawing needed
}

// ─── Particle effects on death ────────────────────────────────────────────────
let particles = [];

function spawnDeathParticles() {
  for (let i = 0; i < 18; i++) {
    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.3;
    const speed = 80 + Math.random() * 160;
    particles.push({
      x: bird.x, y: bird.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 100,
      life: 1,
      r: 3 + Math.random() * 5,
      color: ['#FCD34D', '#F59E0B', '#FB923C', '#FBBF24'][Math.floor(Math.random() * 4)],
    });
  }
}

function updateParticles(dt) {
  particles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 400 * dt;
    p.life -= dt * 2;
    p.r *= 0.99;
  });
  particles = particles.filter(p => p.life > 0);
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  });
}

let deathParticlesSpawned = false;

// ─── Main loop ────────────────────────────────────────────────────────────────
function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = now;

  const cW = canvas.width, cH = canvas.height;
  ctx.clearRect(0, 0, cW, cH);

  drawBg(cW, cH, dt);

  if (state === STATE.PLAYING) {
    updatePipes(dt, cW, cH);
    bird.update(dt);
    updateParticles(dt);

    if (checkCollision(cW, cH)) {
      deathParticlesSpawned = false;
      state = STATE.DEAD;
      triggerDeath();
    }
  } else if (state === STATE.DEAD) {
    if (!deathParticlesSpawned) {
      spawnDeathParticles();
      deathParticlesSpawned = true;
    }
    updateParticles(dt);
  }

  // Draw pipes
  pipes.forEach(p => drawPipe(p, cH));

  // Draw bird (only if not fully dead-animated)
  if (state !== STATE.DEAD || particles.length > 0) {
    bird.draw(cW);
  }

  drawParticles();
  drawGround(cW, cH, dt);

  animId = requestAnimationFrame(gameLoop);
}

// ─── Idle animation (before game starts) ─────────────────────────────────────
function idleLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  const cW = canvas.width, cH = canvas.height;
  ctx.clearRect(0, 0, cW, cH);
  drawBg(cW, cH, 0);

  // Gently bob bird
  bird.y = cH * 0.45 + Math.sin(now * 0.002) * 12;
  bird.angle = Math.sin(now * 0.002) * 0.15;
  bird.draw(cW);
  drawGround(cW, cH, 0);

  if (state === STATE.IDLE) {
    animId = requestAnimationFrame(idleLoop);
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    handleInput();
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === STATE.PLAYING || state === STATE.PAUSED) togglePause();
  }
});

canvas.addEventListener('click', () => handleInput());
canvas.addEventListener('touchstart', e => { e.preventDefault(); handleInput(); }, { passive: false });

// Allow tapping overlays to trigger input (mobile fix)
[startOverlay, gameoverOverlay, pauseOverlay].forEach(el => {
  el.addEventListener('click', e => {
    if (e.target.closest('button')) return; // let buttons handle themselves
    handleInput();
  });
  el.addEventListener('touchstart', e => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    handleInput();
  }, { passive: false });
});

pauseBtn.addEventListener('click', e => {
  e.stopPropagation();
  togglePause();
});

// Restart / menu buttons
document.getElementById('btn-restart').addEventListener('click', startGame);
document.getElementById('btn-menu').addEventListener('click', () => {
  state = STATE.IDLE;
  cancelAnimationFrame(animId);
  showOverlay(startOverlay);
  const cW = canvas.width, cH = canvas.height;
  bird.reset(cW * 0.28, cH * 0.45);
  pipes = [];
  particles = [];
  lastTime = performance.now();
  animId = requestAnimationFrame(idleLoop);
});

document.getElementById('btn-resume').addEventListener('click', () => {
  if (state === STATE.PAUSED) togglePause();
});

document.getElementById('btn-pause-menu').addEventListener('click', () => {
  state = STATE.IDLE;
  cancelAnimationFrame(animId);
  showOverlay(startOverlay);
  const cW = canvas.width, cH = canvas.height;
  bird.reset(cW * 0.28, cH * 0.45);
  pipes = [];
  particles = [];
  pauseBtn.classList.remove('visible');
  pauseBtn.textContent = '⏸';
  lastTime = performance.now();
  animId = requestAnimationFrame(idleLoop);
});

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  resize();
  if (!bgInit) initBg(canvas.width, canvas.height);
});

bestEl.textContent = bestScore;

resize();
showOverlay(startOverlay);

const cW = canvas.width, cH = canvas.height;
bird.reset(cW * 0.28, cH * 0.45);
lastTime = performance.now();
animId = requestAnimationFrame(idleLoop);
