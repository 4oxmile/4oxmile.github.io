'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = 8;
const ROWS = 5;
const PLAYER_SPEED    = 240;   // px/s
const BULLET_SPEED    = 440;   // px/s
const ALIEN_BULLET_SPEED = 190; // px/s
const ALIEN_DROP      = 16;    // px per edge-hit
const SHOOT_MIN       = 900;   // ms
const SHOOT_MAX       = 2400;  // ms
const ALIEN_H_MARGIN  = 18;    // px from wall before reversing
const MAX_PLAYER_BULLETS = 2;
const MAX_ALIEN_BULLETS  = 4;
const PLAYER_LIVES    = 3;
const UFO_SCORE_OPTIONS = [50, 100, 150, 200, 300];

const ALIEN_TYPES = [
  { emoji: '👾', basePoints: 40 },
  { emoji: '🛸', basePoints: 20 },
  { emoji: '🛸', basePoints: 20 },
  { emoji: '👽', basePoints: 10 },
  { emoji: '👽', basePoints: 10 },
];

// ─── Globals ──────────────────────────────────────────────────────────────────
let canvas, ctx, W, H;
let cellW, cellH;

let gameState = 'start'; // 'start'|'playing'|'dead'|'levelup'|'gameover'
let score = 0;
let highScore = 0;
let lives = PLAYER_LIVES;
let level = 1;
let lastTime = 0;

// Player
const player = { x: 0, y: 0, w: 44, h: 28 };

// Collections
let pBullets   = [];  // { x, y, w, h }
let aBullets   = [];  // { x, y, w, h }
let aliens     = [];  // { col, row, alive, lx, ly, w, h, emoji, pts }
let explosions = [];  // { x, y, emoji, life, maxLife }

// Alien grid offset (accumulated)
let offX = 0, offY = 0;
let alienDir = 1;
let stepTimer = 0;
let stepInterval = 800; // ms
let aliensAlive = 0;

// UFO
let ufo = null; // { x, y, w, h, dir, speed, pts }
let ufoCountdown = 0;

// Shoot timer
let shootTimer = 0;

// Input
const keys = { left: false, right: false };
let fireTap   = false;    // single press queued
let fireHeld  = false;    // button/key held
let fireCool  = 0;        // ms remaining cooldown

// Touch drag
let drag = { active: false, lastX: 0 };

// DOM
let scoreEl, hsEl, livesEl, levelEl;
let scrStart, scrGameover, scrLevelup;
let startHighEl, goScoreEl, goHighEl, luScoreEl, luHighEl;

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  canvas   = document.getElementById('gameCanvas');
  ctx      = canvas.getContext('2d');
  scoreEl  = document.getElementById('score');
  hsEl     = document.getElementById('highScore');
  livesEl  = document.getElementById('livesDisplay');
  levelEl  = document.getElementById('level-badge');

  scrStart   = document.getElementById('startScreen');
  scrGameover= document.getElementById('gameoverScreen');
  scrLevelup = document.getElementById('levelupScreen');
  startHighEl= document.getElementById('startHigh');
  goScoreEl  = document.getElementById('goScore');
  goHighEl   = document.getElementById('goHigh');
  luScoreEl  = document.getElementById('luScore');
  luHighEl   = document.getElementById('luHigh');

  highScore = +(localStorage.getItem('inv_hi') || 0);
  updateHUD();
  resizeCanvas();
  bindInput();
  showScreen('start');
  requestAnimationFrame(tick);

  window.addEventListener('resize', () => {
    resizeCanvas();
    if (gameState === 'playing' || gameState === 'dead') clampPlayer();
  });
});

// ─── Canvas Sizing ────────────────────────────────────────────────────────────
function resizeCanvas() {
  const wrap = document.getElementById('canvas-wrapper');
  const r = wrap.getBoundingClientRect();
  W = Math.floor(r.width);
  H = Math.floor(r.height);
  canvas.width  = W;
  canvas.height = H;

  // Alien cell size based on available space
  cellW = Math.floor((W * 0.82) / COLS);
  cellH = Math.floor((H * 0.46) / ROWS);

  // Player size
  player.w = clamp(Math.floor(cellW * 0.88), 30, 52);
  player.h = Math.floor(player.w * 0.6);
}

// ─── Game Init ────────────────────────────────────────────────────────────────
function newGame() {
  score = 0;
  lives = PLAYER_LIVES;
  level = 1;
  beginLevel();
}

function beginLevel() {
  offX = 0; offY = 0;
  alienDir = 1;
  stepTimer = 0;
  shootTimer = rand(SHOOT_MIN, SHOOT_MAX);
  fireTap = false;
  fireHeld = false;
  fireCool = 0;
  pBullets   = [];
  aBullets   = [];
  explosions = [];
  ufo = null;
  ufoCountdown = rand(18000, 32000);

  const gridStartX = (W - COLS * cellW) / 2;
  const gridStartY = H * 0.07;

  aliens = [];
  for (let r = 0; r < ROWS; r++) {
    const type = ALIEN_TYPES[r];
    for (let c = 0; c < COLS; c++) {
      aliens.push({
        col: c, row: r,
        alive: true,
        lx: gridStartX + c * cellW,  // "local" position (without offset)
        ly: gridStartY + r * cellH,
        w: cellW * 0.74,
        h: cellH * 0.74,
        emoji: type.emoji,
        pts: type.basePoints + (level - 1) * 5,
      });
    }
  }
  aliensAlive = aliens.length;

  player.x = W / 2 - player.w / 2;
  player.y = H - player.h - 10;

  stepInterval = calcStepInterval();
  updateHUD();
}

function calcStepInterval() {
  const lvlF   = Math.max(0.25, 1 - (level - 1) * 0.09);
  const countF = Math.max(0.18, aliensAlive / (COLS * ROWS));
  return Math.max(75, 800 * lvlF * countF);
}

// ─── Input ────────────────────────────────────────────────────────────────────
function bindInput() {
  // Keyboard
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft'  || e.key === 'a') { keys.left  = true; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd') { keys.right = true; e.preventDefault(); }
    if ((e.key === ' ' || e.key === 'ArrowUp') && !e.repeat) {
      pressedFire();
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    if (e.key === ' ' || e.key === 'ArrowUp') fireHeld = false;
  });

  // Touch drag on canvas
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    drag.active = true;
    drag.lastX  = e.touches[0].clientX;
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!drag.active) return;
    const dx = e.touches[0].clientX - drag.lastX;
    drag.lastX = e.touches[0].clientX;
    player.x = clamp(player.x + dx, 0, W - player.w);
  }, { passive: false });
  canvas.addEventListener('touchend',   e => { e.preventDefault(); drag.active = false; }, { passive: false });
  canvas.addEventListener('touchcancel',e => { e.preventDefault(); drag.active = false; }, { passive: false });

  // On-screen buttons
  function holdBtn(id, onDown, onUp) {
    const el = document.getElementById(id);
    const dn = ev => { ev.preventDefault(); onDown(); el.classList.add('pressed'); };
    const up = ev => { ev.preventDefault(); onUp();   el.classList.remove('pressed'); };
    el.addEventListener('touchstart',  dn, { passive: false });
    el.addEventListener('touchend',    up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
    el.addEventListener('mousedown', dn);
    el.addEventListener('mouseup',   up);
    el.addEventListener('mouseleave',up);
  }

  holdBtn('leftBtn',  () => { keys.left  = true; },  () => { keys.left  = false; });
  holdBtn('rightBtn', () => { keys.right = true; },  () => { keys.right = false; });
  holdBtn('fireBtn',
    () => { pressedFire(); },
    () => { fireHeld = false; }
  );

  // Overlay buttons
  document.getElementById('startBtn').addEventListener('click',    startPlay);
  document.getElementById('restartBtn').addEventListener('click',  startPlay);
  document.getElementById('nextLevelBtn').addEventListener('click',() => {
    level++;
    beginLevel();
    showScreen('none');
    beginPlay();
  });

  // Pause on canvas tap (not drag) when playing
  let tapStartX = 0, tapStartY = 0;
  canvas.addEventListener('touchstart', e => {
    tapStartX = e.touches[0].clientX;
    tapStartY = e.touches[0].clientY;
  }, { passive: true });
}

function pressedFire() {
  if (gameState !== 'playing') return;
  fireTap  = true;
  fireHeld = true;
}

function startPlay() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  newGame();
  showScreen('none');
  beginPlay();
}

function beginPlay() {
  gameState = 'playing';
  lastTime = performance.now();
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
function tick(ts) {
  requestAnimationFrame(tick);
  if (gameState === 'playing') {
    const dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
  } else {
    lastTime = ts;
  }
  render();
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update(dt) {
  const ms = dt * 1000;

  // ── Player movement ──────────────────────────────────────────────────────
  if (keys.left  && !drag.active) player.x -= PLAYER_SPEED * dt;
  if (keys.right && !drag.active) player.x += PLAYER_SPEED * dt;
  clampPlayer();

  // ── Fire ─────────────────────────────────────────────────────────────────
  fireCool -= ms;
  if ((fireTap || fireHeld) && fireCool <= 0 && pBullets.length < MAX_PLAYER_BULLETS) {
    pBullets.push({ x: player.x + player.w / 2 - 2, y: player.y - 2, w: 4, h: 14 });
    fireCool = 360;
  }
  if (fireTap) fireTap = false;

  // ── Player bullets ────────────────────────────────────────────────────────
  for (let i = pBullets.length - 1; i >= 0; i--) {
    const b = pBullets[i];
    b.y -= BULLET_SPEED * dt;
    if (b.y + b.h < 0) { pBullets.splice(i, 1); continue; }

    // vs aliens
    let hit = false;
    for (const a of aliens) {
      if (!a.alive) continue;
      const ax = a.lx + offX, ay = a.ly + offY;
      if (overlap(b.x, b.y, b.w, b.h, ax, ay, a.w, a.h)) {
        destroyAlien(a);
        pBullets.splice(i, 1);
        hit = true;
        break;
      }
    }
    if (hit) continue;

    // vs UFO
    if (ufo && overlap(b.x, b.y, b.w, b.h, ufo.x, ufo.y, ufo.w, ufo.h)) {
      boom(ufo.x + ufo.w / 2, ufo.y + ufo.h / 2, '💥', 600);
      score += ufo.pts;
      saveHi();
      updateHUD();
      ufo = null;
      ufoCountdown = rand(18000, 32000);
      pBullets.splice(i, 1);
    }
  }

  // ── Alien step ────────────────────────────────────────────────────────────
  stepInterval = calcStepInterval();
  stepTimer   += ms;
  if (stepTimer >= stepInterval) {
    stepTimer = 0;
    stepAliens();
  }

  // ── Alien shoot ───────────────────────────────────────────────────────────
  shootTimer -= ms;
  if (shootTimer <= 0) {
    alienShoot();
    shootTimer = rand(SHOOT_MIN, SHOOT_MAX) * Math.max(0.28, 1 - (level - 1) * 0.07);
  }

  // ── Alien bullets ─────────────────────────────────────────────────────────
  for (let i = aBullets.length - 1; i >= 0; i--) {
    const b = aBullets[i];
    b.y += ALIEN_BULLET_SPEED * dt;
    if (b.y > H) { aBullets.splice(i, 1); continue; }
    if (overlap(b.x, b.y, b.w, b.h, player.x, player.y, player.w, player.h)) {
      aBullets.splice(i, 1);
      hitPlayer();
      if (gameState !== 'playing') return;
    }
  }

  // ── UFO ───────────────────────────────────────────────────────────────────
  ufoCountdown -= ms;
  if (!ufo && ufoCountdown <= 0) launchUFO();
  if (ufo) {
    ufo.x += ufo.dir * ufo.speed * dt;
    if (ufo.dir > 0 && ufo.x > W + ufo.w + 10) ufo = null;
    if (ufo.dir < 0 && ufo.x < -ufo.w - 10)    ufo = null;
    if (!ufo) ufoCountdown = rand(18000, 32000);
  }

  // ── Explosions ────────────────────────────────────────────────────────────
  for (let i = explosions.length - 1; i >= 0; i--) {
    explosions[i].life -= ms;
    if (explosions[i].life <= 0) explosions.splice(i, 1);
  }

  // ── Aliens reach bottom? ──────────────────────────────────────────────────
  for (const a of aliens) {
    if (!a.alive) continue;
    if (a.ly + offY + a.h >= player.y) { gameOver(); return; }
  }

  // ── Level clear? ──────────────────────────────────────────────────────────
  if (aliensAlive === 0) doLevelUp();
}

// ─── Alien Step ───────────────────────────────────────────────────────────────
function stepAliens() {
  // Find world bounds of living aliens
  let minX = Infinity, maxX = -Infinity;
  for (const a of aliens) {
    if (!a.alive) continue;
    const ax = a.lx + offX;
    if (ax       < minX) minX = ax;
    if (ax + a.w > maxX) maxX = ax + a.w;
  }
  if (minX === Infinity) return;

  const step = cellW * 0.32 * alienDir;
  const nextMin = minX + step;
  const nextMax = maxX + step;

  if (nextMin < ALIEN_H_MARGIN || nextMax > W - ALIEN_H_MARGIN) {
    alienDir *= -1;
    offY += ALIEN_DROP;
  } else {
    offX += step;
  }
}

// ─── Alien Shoot ──────────────────────────────────────────────────────────────
function alienShoot() {
  if (aBullets.length >= MAX_ALIEN_BULLETS) return;
  const live = aliens.filter(a => a.alive);
  if (!live.length) return;

  // Pick a random column, shoot from its bottom-most alien
  const cols = [...new Set(live.map(a => a.col))];
  const col  = cols[Math.floor(Math.random() * cols.length)];
  const inCol = live.filter(a => a.col === col).sort((a, b) => b.row - a.row);
  const s = inCol[0];
  if (!s) return;

  aBullets.push({
    x: s.lx + offX + s.w / 2 - 3,
    y: s.ly + offY + s.h,
    w: 6, h: 16,
  });
}

// ─── Entity Events ────────────────────────────────────────────────────────────
function destroyAlien(a) {
  a.alive = false;
  aliensAlive--;
  score += a.pts;
  boom(a.lx + offX + a.w / 2, a.ly + offY + a.h / 2, a.emoji, 520);
  saveHi();
  updateHUD();
}

function hitPlayer() {
  lives--;
  boom(player.x + player.w / 2, player.y + player.h / 2, '💥', 750);
  updateHUD();
  if (lives <= 0) {
    gameOver();
  } else {
    gameState = 'dead';
    pBullets = [];
    aBullets = [];
    setTimeout(() => {
      if (gameState === 'dead') {
        player.x = W / 2 - player.w / 2;
        gameState = 'playing';
        lastTime = performance.now();
      }
    }, 950);
  }
}

function gameOver() {
  gameState = 'gameover';
  saveHi();
  goScoreEl.textContent = score;
  goHighEl.textContent  = highScore;
  showScreen('gameover');
  if(typeof Leaderboard!=='undefined')Leaderboard.ready('invaders',score);
}

function doLevelUp() {
  gameState = 'levelup';
  saveHi();
  luScoreEl.textContent = score;
  luHighEl.textContent  = highScore;
  showScreen('levelup');
}

function launchUFO() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const w = 52, h = 30;
  ufo = {
    x: dir > 0 ? -w - 10 : W + 10,
    y: H * 0.04,
    w, h, dir,
    speed: 85 + level * 9,
    pts: UFO_SCORE_OPTIONS[Math.floor(Math.random() * UFO_SCORE_OPTIONS.length)],
  };
}

function boom(x, y, emoji, dur) {
  explosions.push({ x, y, emoji, life: dur, maxLife: dur });
}

// ─── Render ───────────────────────────────────────────────────────────────────
// Stars (fixed positions relative to canvas fraction)
const STARS = Array.from({ length: 60 }, (_, i) => ({
  xf: ((i * 137.508 + 19) % 97) / 97,
  yf: ((i * 79.317  + 11) % 89) / 89,
  r:  0.5 + (i % 4) * 0.4,
  a:  0.15 + (i % 6) * 0.08,
}));

function render() {
  ctx.clearRect(0, 0, W, H);
  drawStars();

  if (gameState === 'start') return;

  drawAliens();
  drawUFO();
  if (gameState !== 'dead' || Math.floor(Date.now() / 75) % 2 === 0) drawPlayer();
  drawBullets();
  drawExplosions();
  drawGround();
}

function drawStars() {
  ctx.save();
  for (const s of STARS) {
    ctx.fillStyle = `rgba(240,246,252,${s.a})`;
    ctx.beginPath();
    ctx.arc(s.xf * W, s.yf * H, s.r, 0, Math.TAU || Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAliens() {
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';
  for (const a of aliens) {
    if (!a.alive) continue;
    const ax = a.lx + offX;
    const ay = a.ly + offY;
    const fs = Math.min(a.w, a.h) * 0.84;
    ctx.font = `${fs}px sans-serif`;
    ctx.fillText(a.emoji, ax + a.w / 2, ay + a.h / 2);
  }
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';
  const fs = player.w * 1.05;
  ctx.font = `${fs}px sans-serif`;
  ctx.fillText('🚀', player.x + player.w / 2, player.y + player.h / 2);
  ctx.restore();
}

function drawBullets() {
  ctx.save();
  // Player bullets — blue glow
  for (const b of pBullets) {
    const g = ctx.createLinearGradient(b.x, b.y + b.h, b.x, b.y);
    g.addColorStop(0, 'rgba(59,130,246,0)');
    g.addColorStop(1, '#BFDBFE');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(b.x + 1, b.y, 2, 3);
  }
  // Alien bullets — orange
  for (const b of aBullets) {
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    g.addColorStop(0, 'rgba(239,68,68,0.2)');
    g.addColorStop(1, '#FB923C');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 2);
    ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.fillRect(b.x + 1, b.y + b.h - 4, 4, 3);
  }
  ctx.restore();
}

function drawUFO() {
  if (!ufo) return;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';
  ctx.font = `${ufo.h * 1.1}px sans-serif`;
  ctx.fillText('🛸', ufo.x + ufo.w / 2, ufo.y + ufo.h / 2);
  // Flicker score label
  if (Math.floor(Date.now() / 350) % 2 === 0) {
    ctx.fillStyle = '#FCD34D';
    ctx.font = `bold ${clamp(Math.round(W * 0.028), 10, 14)}px -apple-system,sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${ufo.pts}pt`, ufo.x + ufo.w / 2, ufo.y - 2);
  }
  ctx.restore();
}

function drawExplosions() {
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';
  for (const e of explosions) {
    const p = e.life / e.maxLife;
    ctx.globalAlpha = p;
    const fs = 26 + (1 - p) * 14;
    ctx.font = `${fs}px sans-serif`;
    ctx.fillText(e.emoji, e.x, e.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawGround() {
  const y = player.y + player.h + 5;
  ctx.save();
  ctx.strokeStyle = 'rgba(59,130,246,0.28)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 7]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();
  ctx.restore();
}

// ─── HUD / Screens ────────────────────────────────────────────────────────────
function updateHUD() {
  scoreEl.textContent = score;
  hsEl.textContent    = highScore;
  levelEl.textContent = `레벨 ${level}`;

  livesEl.innerHTML = '';
  for (let i = 0; i < PLAYER_LIVES; i++) {
    const s = document.createElement('span');
    s.className  = 'life-icon' + (i >= lives ? ' lost' : '');
    s.textContent = '🚀';
    livesEl.appendChild(s);
  }

  if (startHighEl) startHighEl.textContent = highScore;
}

function showScreen(which) {
  scrStart.classList.add('hidden');
  scrGameover.classList.add('hidden');
  scrLevelup.classList.add('hidden');
  if (which === 'start')    { scrStart.classList.remove('hidden');    updateHUD(); }
  if (which === 'gameover') { scrGameover.classList.remove('hidden'); }
  if (which === 'levelup')  { scrLevelup.classList.remove('hidden');  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────
function saveHi() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('inv_hi', highScore);
    updateHUD();
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clampPlayer() {
  player.x = clamp(player.x, 0, W - player.w);
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}
