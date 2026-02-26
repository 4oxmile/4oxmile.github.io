'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'breakout_scores_v1';
const MAX_SCORES  = 5;
const PADDLE_H    = 10;
const BALL_R      = 7;
const BRICK_ROWS  = 6;
const BRICK_COLS  = 8;
const BRICK_PAD   = 4;
const BRICK_TOP   = 36;

// Brick colors per row
const ROW_COLORS = [
  '#E879F9',  // row 0 — pink
  '#F43F5E',  // row 1 — red
  '#FB923C',  // row 2 — orange
  '#FACC15',  // row 3 — yellow
  '#4ADE80',  // row 4 — green
  '#38BDF8',  // row 5 — sky
];

// Points per row (top = higher score)
const ROW_POINTS = [70, 60, 50, 40, 30, 20];

// ─── State ────────────────────────────────────────────────────────────────────
let canvas, ctx, pCanvas, pCtx;
let W, H;
let gameState = 'idle'; // idle | playing | paused | lost | won
let animId    = null;
let lastTime  = 0;

let paddle    = null;
let ball      = null;
let bricks    = null;
let lives     = 3;
let score     = 0;
let level     = 1;
let combo     = 0;
let particles = [];

let touchStartX  = null;
let paddleStartX = null;

const keys = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rand(lo, hi)     { return lo + Math.random() * (hi - lo); }
function randInt(lo, hi)  { return Math.floor(rand(lo, hi + 1)); }
function prefersDark()    { return !window.matchMedia('(prefers-color-scheme: light)').matches; }

// ─── Score storage ────────────────────────────────────────────────────────────
function loadScores() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveScore(sc, lv) {
  const scores = loadScores();
  scores.push({ score: sc, level: lv, date: Date.now() });
  scores.sort((a, b) => b.score - a.score);
  scores.splice(MAX_SCORES);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scores)); } catch {}
  return scores;
}

function getBestScore() {
  const s = loadScores();
  return s.length ? s[0].score : 0;
}

// ─── Level layouts ────────────────────────────────────────────────────────────
function buildBricks(lv) {
  const rows = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    const row = [];
    for (let c = 0; c < BRICK_COLS; c++) {
      let hp;
      if (lv === 1) {
        hp = 1;
      } else if (lv === 2) {
        hp = (r + c) % 2 === 0 ? 2 : 1;
      } else if (lv === 3) {
        const cr = Math.abs(r - 2.5);
        const cc = Math.abs(c - 3.5);
        hp = (cr + cc < 3) ? 3 : (cr + cc < 5) ? 2 : 1;
      } else if (lv === 4) {
        hp = (r < 2) ? 3 : (r < 4) ? 2 : 1;
      } else {
        const base = Math.min(lv - 2, 4);
        hp = Math.random() < 0.3 ? base : Math.ceil(base / 2);
      }
      row.push({ hp, maxHp: hp, visible: true });
    }
    rows.push(row);
  }
  return rows;
}

function countBricks(b) {
  return b.flat().filter(x => x.visible).length;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function initGame(lv) {
  level  = lv || 1;
  combo  = 0;

  const pw = Math.max(70, W * 0.22);
  paddle = {
    x: W / 2 - pw / 2,
    y: H - 28,
    w: pw,
    h: PADDLE_H,
  };

  launchBall();
  bricks = buildBricks(level);

  updateLivesUI();
  updateScoreUI();
}

function launchBall() {
  const angle = rand(-Math.PI * 0.65, -Math.PI * 0.35);
  const spd   = 280 + level * 20;
  ball = {
    x:        W / 2,
    y:        paddle.y - BALL_R - 2,
    vx:       Math.cos(angle) * spd,
    vy:       Math.sin(angle) * spd,
    attached: true,
    r:        BALL_R,
  };
}

function resetBall() {
  combo = 0;
  launchBall();
}

// ─── Resize ───────────────────────────────────────────────────────────────────
function resize() {
  const wrapper = document.getElementById('canvas-wrapper');
  W = wrapper.clientWidth;
  H = wrapper.clientHeight;

  canvas.width   = W;
  canvas.height  = H;
  pCanvas.width  = W;
  pCanvas.height = H;

  if (paddle) {
    paddle.y = H - 28;
    paddle.x = clamp(paddle.x, 0, W - paddle.w);
  }
  if (ball && ball.attached && paddle) {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - BALL_R - 2;
  }
}

// ─── Brick geometry ───────────────────────────────────────────────────────────
function brickRect(r, c) {
  const totalW = W - BRICK_PAD * 2;
  const bw     = (totalW - (BRICK_COLS - 1) * BRICK_PAD) / BRICK_COLS;
  const bh     = 18;
  return {
    x: BRICK_PAD + c * (bw + BRICK_PAD),
    y: BRICK_TOP + r * (bh + BRICK_PAD),
    w: bw,
    h: bh,
  };
}

// ─── Collision helpers ────────────────────────────────────────────────────────
function ballHitsRect(bx, by, br, rx, ry, rw, rh) {
  const nx = clamp(bx, rx, rx + rw);
  const ny = clamp(by, ry, ry + rh);
  const dx = bx - nx, dy = by - ny;
  return dx * dx + dy * dy < br * br;
}

function bounceOff(bx, by, br, rx, ry, rw, rh, vx, vy) {
  const ol = (bx + br) - rx;
  const or = (rx + rw) - (bx - br);
  const ot = (by + br) - ry;
  const ob = (ry + rh) - (by - br);
  if (Math.min(ol, or) < Math.min(ot, ob)) {
    vx = -vx;
  } else {
    vy = -vy;
  }
  return { vx, vy };
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update(dt) {
  if (gameState !== 'playing') return;

  // Keyboard paddle movement
  const kspd = 420;
  if (keys['ArrowLeft']  || keys['a'] || keys['A']) paddle.x = clamp(paddle.x - kspd * dt, 0, W - paddle.w);
  if (keys['ArrowRight'] || keys['d'] || keys['D']) paddle.x = clamp(paddle.x + kspd * dt, 0, W - paddle.w);

  // Attached ball follows paddle
  if (ball.attached) {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - BALL_R - 2;
    return;
  }

  // Move ball
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Wall collisions
  if (ball.x - ball.r < 0)  { ball.x = ball.r;      ball.vx =  Math.abs(ball.vx); }
  if (ball.x + ball.r > W)  { ball.x = W - ball.r;  ball.vx = -Math.abs(ball.vx); }
  if (ball.y - ball.r < 0)  { ball.y = ball.r;       ball.vy =  Math.abs(ball.vy); }

  // Paddle collision
  if (
    ball.vy > 0 &&
    ball.y + ball.r >= paddle.y &&
    ball.y + ball.r <= paddle.y + paddle.h + 4 &&
    ball.x + ball.r >= paddle.x &&
    ball.x - ball.r <= paddle.x + paddle.w
  ) {
    ball.y  = paddle.y - ball.r;
    ball.vy = -Math.abs(ball.vy);
    const rel = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
    const spd = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
    const ang = rel * (Math.PI * 0.38);
    ball.vx = spd * Math.sin(ang);
    ball.vy = -spd * Math.cos(ang);
    combo   = 0;
    spawnPaddleParticles();
  }

  // Brick collisions
  let bounced = false;
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const b = bricks[r][c];
      if (!b.visible) continue;
      const rect = brickRect(r, c);
      if (!ballHitsRect(ball.x, ball.y, ball.r, rect.x, rect.y, rect.w, rect.h)) continue;

      b.hp--;
      combo++;
      const pts = ROW_POINTS[r] * combo;
      score += pts;

      spawnBrickParticles(rect.x + rect.w / 2, rect.y + rect.h / 2, r);
      showScorePopup(rect.x + rect.w / 2, rect.y, `+${pts}`);

      if (b.hp <= 0) b.visible = false;

      if (!bounced) {
        const res = bounceOff(ball.x, ball.y, ball.r, rect.x, rect.y, rect.w, rect.h, ball.vx, ball.vy);
        ball.vx = res.vx;
        ball.vy = res.vy;
        bounced = true;
      }

      updateScoreUI();

      if (countBricks(bricks) === 0) { winLevel(); return; }
      break; // one brick per frame
    }
    if (bounced) break;
  }

  // Ball out of bounds
  if (ball.y - ball.r > H) {
    lives--;
    updateLivesUI();
    if (lives <= 0) {
      loseGame();
    } else {
      shakeCanvas();
      resetBall();
    }
  }

  // Speed cap
  const spd = Math.hypot(ball.vx, ball.vy);
  if (spd > 560) { ball.vx = ball.vx / spd * 560; ball.vy = ball.vy / spd * 560; }

  // Particles
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x    += p.vx * dt;
    p.y    += p.vy * dt;
    p.vy   += 380 * dt;
    p.life -= dt;
    p.r    *= 0.97;
  });
}

// ─── Win / Lose ───────────────────────────────────────────────────────────────
function winLevel() {
  gameState = 'won';
  cancelAnimationFrame(animId);
  const scores = saveScore(score, level);
  setTimeout(() => showWinOverlay(level + 1, scores), 500);
}

function loseGame() {
  gameState = 'lost';
  cancelAnimationFrame(animId);
  const scores = saveScore(score, level);
  setTimeout(() => showLoseOverlay(scores), 500);
}

// ─── Draw ─────────────────────────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);
  if (gameState === 'idle') return;
  drawBricks();
  drawPaddle();
  drawBall();
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y,     x + w, y + r,     r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x,     y + h, x,     y + h - r, r);
  c.lineTo(x,     y + r);
  c.arcTo(x,     y,     x + r, y,         r);
  c.closePath();
}

function drawBricks() {
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      const b = bricks[r][c];
      if (!b.visible) continue;

      const rect  = brickRect(r, c);
      const color = ROW_COLORS[r];
      const frac  = b.hp / b.maxHp;

      ctx.save();

      // Glow
      ctx.shadowBlur  = 10;
      ctx.shadowColor = color;

      // Background fill
      ctx.globalAlpha = 0.18 + frac * 0.55;
      ctx.fillStyle   = color;
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 4);
      ctx.fill();

      // Border
      ctx.globalAlpha = 0.55 + frac * 0.45;
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      roundRect(ctx, rect.x + 0.75, rect.y + 0.75, rect.w - 1.5, rect.h - 1.5, 3.5);
      ctx.stroke();

      // Top shine
      ctx.globalAlpha = 0.18;
      ctx.fillStyle   = '#fff';
      ctx.fillRect(rect.x + 3, rect.y + 2, rect.w - 6, 3);

      // HP pips (for bricks with more than 1 hp originally)
      if (b.maxHp > 1) {
        const pip = 4, gap = 3;
        const total = b.maxHp * pip + (b.maxHp - 1) * gap;
        let px = rect.x + (rect.w - total) / 2;
        for (let i = 0; i < b.maxHp; i++) {
          ctx.globalAlpha = i < b.hp ? 0.9 : 0.15;
          ctx.fillStyle   = '#fff';
          ctx.beginPath();
          ctx.arc(px + pip / 2, rect.y + rect.h - 5, pip / 2, 0, Math.PI * 2);
          ctx.fill();
          px += pip + gap;
        }
      }

      ctx.restore();
    }
  }
}

function drawPaddle() {
  const dark   = prefersDark();
  const accent = dark ? '#3B82F6' : '#3182F6';
  ctx.save();
  ctx.shadowBlur  = 14;
  ctx.shadowColor = accent;
  const grad = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.h);
  grad.addColorStop(0, dark ? '#93C5FD' : '#60A5FA');
  grad.addColorStop(1, dark ? '#1D4ED8' : '#2563EB');
  ctx.fillStyle = grad;
  roundRect(ctx, paddle.x, paddle.y, paddle.w, paddle.h, paddle.h / 2);
  ctx.fill();
  ctx.restore();
}

function drawBall() {
  const dark   = prefersDark();
  const accent = dark ? '#60A5FA' : '#3B82F6';
  ctx.save();

  // Trail
  if (!ball.attached) {
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      ctx.globalAlpha = 0.12 * (1 - frac);
      ctx.fillStyle   = accent;
      ctx.beginPath();
      ctx.arc(ball.x - ball.vx * 0.012 * i, ball.y - ball.vy * 0.012 * i, ball.r * (1 - frac * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Glow
  ctx.shadowBlur  = 18;
  ctx.shadowColor = accent;

  // Gradient fill
  const grad = ctx.createRadialGradient(
    ball.x - ball.r * 0.3, ball.y - ball.r * 0.3, 0.5,
    ball.x, ball.y, ball.r,
  );
  grad.addColorStop(0, '#DBEAFE');
  grad.addColorStop(1, accent);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawParticles() {
  pCtx.clearRect(0, 0, W, H);
  particles.forEach(p => {
    const a = Math.max(0, p.life / p.maxLife);
    pCtx.globalAlpha = a;
    pCtx.fillStyle   = p.color;
    pCtx.beginPath();
    pCtx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2);
    pCtx.fill();
  });
  pCtx.globalAlpha = 1;
}

// ─── Particles ────────────────────────────────────────────────────────────────
function spawnBrickParticles(x, y, row) {
  const color = ROW_COLORS[row];
  const n     = randInt(7, 13);
  for (let i = 0; i < n; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(60, 230);
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      r: rand(2, 5),
      color,
      life: rand(0.35, 0.85),
      maxLife: 0.85,
    });
  }
}

function spawnPaddleParticles() {
  for (let i = 0; i < 5; i++) {
    particles.push({
      x: ball.x, y: paddle.y,
      vx: rand(-120, 120),
      vy: rand(-150, -60),
      r: rand(2, 4),
      color: '#93C5FD',
      life: rand(0.2, 0.45),
      maxLife: 0.45,
    });
  }
}

// ─── Score popups ─────────────────────────────────────────────────────────────
function showScorePopup(x, y, text) {
  const el = document.createElement('div');
  el.className   = 'score-popup';
  el.textContent = text;
  el.style.left  = `${x}px`;
  el.style.top   = `${y}px`;
  el.style.transform = 'translateX(-50%)';
  document.getElementById('canvas-wrapper').appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

// ─── Game loop ────────────────────────────────────────────────────────────────
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  drawParticles();
  if (gameState === 'playing') {
    animId = requestAnimationFrame(loop);
  }
}

function startLoop() {
  cancelAnimationFrame(animId);
  lastTime = performance.now();
  animId   = requestAnimationFrame(loop);
}

// ─── Shake canvas wrapper ─────────────────────────────────────────────────────
function shakeCanvas() {
  const w = document.getElementById('canvas-wrapper');
  w.classList.remove('shake');
  // Force reflow
  void w.offsetWidth;
  w.classList.add('shake');
  w.addEventListener('animationend', () => w.classList.remove('shake'), { once: true });
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function updateScoreUI() {
  document.getElementById('score-val').textContent = score.toLocaleString();
  document.getElementById('level-val').textContent = level;
  document.getElementById('best-val').textContent  = Math.max(score, getBestScore()).toLocaleString();
}

function updateLivesUI() {
  const container = document.getElementById('lives-display');
  container.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const span = document.createElement('span');
    span.className   = 'life-icon' + (i >= lives ? ' lost' : '');
    span.textContent = '♥';
    container.appendChild(span);
  }
}

function buildScoresHTML(scores) {
  if (!scores || !scores.length) {
    return '<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:4px 0">기록 없음</div>';
  }
  return scores.map((s, i) =>
    `<div class="score-row">
      <span class="rank">${i + 1}</span>
      <span class="score-val">${s.score.toLocaleString()}</span>
      <span class="score-level">Lv.${s.level}</span>
    </div>`
  ).join('');
}

// ─── Overlays ─────────────────────────────────────────────────────────────────
function showOverlay(id) {
  document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hideAllOverlays() {
  document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
}

function showStartOverlay() {
  document.getElementById('start-scores').innerHTML = buildScoresHTML(loadScores());
  showOverlay('overlay-start');
}

function showWinOverlay(nextLv, scores) {
  document.getElementById('win-score').textContent = score.toLocaleString();
  document.getElementById('win-level').textContent = level;
  document.getElementById('win-best').textContent  = scores.length ? scores[0].score.toLocaleString() : score.toLocaleString();
  document.getElementById('win-scores').innerHTML  = buildScoresHTML(scores);
  document.getElementById('btn-next-level').textContent = `레벨 ${nextLv} 시작`;
  showOverlay('overlay-win');
}

function showLoseOverlay(scores) {
  document.getElementById('lose-score').textContent = score.toLocaleString();
  document.getElementById('lose-level').textContent = level;
  document.getElementById('lose-best').textContent  = scores.length ? scores[0].score.toLocaleString() : score.toLocaleString();
  document.getElementById('lose-scores').innerHTML  = buildScoresHTML(scores);
  showOverlay('overlay-lose');
  if(typeof Leaderboard!=='undefined')Leaderboard.ready('breakout',score);
}

// ─── Pause / Resume ───────────────────────────────────────────────────────────
function pauseGame() {
  if (gameState !== 'playing') return;
  gameState = 'paused';
  cancelAnimationFrame(animId);
  showOverlay('overlay-pause');
}

function resumeGame() {
  if (gameState !== 'paused') return;
  hideAllOverlays();
  gameState = 'playing';
  startLoop();
}

// ─── Input handlers ───────────────────────────────────────────────────────────
function handleKeyDown(e) {
  keys[e.key] = true;

  if ((e.key === ' ' || e.key === 'Enter') && gameState === 'playing') {
    e.preventDefault();
    if (ball && ball.attached) ball.attached = false;
  }

  if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
    e.preventDefault();
    if (gameState === 'playing') pauseGame();
    else if (gameState === 'paused') resumeGame();
  }
}

function handleKeyUp(e) {
  keys[e.key] = false;
}

function handleTouchStart(e) {
  if (gameState !== 'playing') return;
  e.preventDefault();
  const t = e.touches[0];
  touchStartX  = t.clientX;
  paddleStartX = paddle.x;
}

function handleTouchMove(e) {
  if (gameState !== 'playing') return;
  e.preventDefault();
  if (touchStartX == null) return;
  const dx = e.touches[0].clientX - touchStartX;
  paddle.x  = clamp(paddleStartX + dx, 0, W - paddle.w);
  if (ball && ball.attached && Math.abs(dx) > 4) ball.attached = false;
}

function handleTouchEnd(e) {
  e.preventDefault();
  if (ball && ball.attached && gameState === 'playing') ball.attached = false;
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
function startNewGame() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  score = 0;
  lives = 3;
  hideAllOverlays();
  initGame(1);
  gameState = 'playing';
  startLoop();
}

function continueToNextLevel(lv) {
  hideAllOverlays();
  initGame(lv);
  gameState = 'playing';
  startLoop();
}

function boot() {
  canvas  = document.getElementById('gameCanvas');
  ctx     = canvas.getContext('2d');
  pCanvas = document.getElementById('particleCanvas');
  pCtx    = pCanvas.getContext('2d');

  resize();
  window.addEventListener('resize', resize);

  // Keyboard
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup',   handleKeyUp);

  // Touch
  const wrapper = document.getElementById('canvas-wrapper');
  wrapper.addEventListener('touchstart', handleTouchStart, { passive: false });
  wrapper.addEventListener('touchmove',  handleTouchMove,  { passive: false });
  wrapper.addEventListener('touchend',   handleTouchEnd,   { passive: false });

  // Mouse drag
  let mouseDown = false, mStartX = null, pStartX = null;
  wrapper.addEventListener('mousedown', e => {
    mouseDown = true;
    mStartX   = e.clientX;
    pStartX   = paddle ? paddle.x : 0;
  });
  window.addEventListener('mousemove', e => {
    if (!mouseDown || gameState !== 'playing') return;
    const dx = e.clientX - mStartX;
    paddle.x  = clamp(pStartX + dx, 0, W - paddle.w);
    if (ball && ball.attached && Math.abs(dx) > 3) ball.attached = false;
  });
  window.addEventListener('mouseup', () => {
    if (mouseDown && ball && ball.attached && gameState === 'playing') ball.attached = false;
    mouseDown = false;
  });

  // Click to launch (when ball is attached)
  wrapper.addEventListener('click', () => {
    if (gameState === 'playing' && ball && ball.attached) ball.attached = false;
  });

  // Start screen
  document.getElementById('btn-start').addEventListener('click', startNewGame);

  // Game over restart
  document.getElementById('btn-restart').addEventListener('click', startNewGame);

  // Win — next level
  document.getElementById('btn-next-level').addEventListener('click', () => {
    continueToNextLevel(level + 1);
  });

  // Win — restart from beginning
  document.getElementById('btn-win-restart').addEventListener('click', startNewGame);

  // Pause button in header
  document.getElementById('btn-pause').addEventListener('click', () => {
    if (gameState === 'playing') pauseGame();
    else if (gameState === 'paused') resumeGame();
  });

  // Resume from pause overlay
  document.getElementById('btn-resume').addEventListener('click', resumeGame);

  // Quit from pause to start screen
  document.getElementById('btn-quit').addEventListener('click', () => {
    gameState = 'idle';
    cancelAnimationFrame(animId);
    showStartOverlay();
  });

  showStartOverlay();
}

document.addEventListener('DOMContentLoaded', boot);
