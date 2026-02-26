'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS = 13;
const ROWS = 14;
let CELL = 40;
let CANVAS_W = COLS * CELL;
let CANVAS_H = ROWS * CELL;

// Row layout (row 0 = top)
// 0  : home
// 1  : safe grass
// 2-6: river
// 7  : safe median
// 8-12: road
// 13 : safe start

const ROW_TYPE = { HOME:'home', SAFE:'safe', RIVER:'river', ROAD:'road' };

const LANE_CONFIG = [
  { type:'home' },
  { type:'safe' },
  { type:'river', speed:1.1, dir: 1, obj:'turtle', sz:2, gap:5 },
  { type:'river', speed:1.4, dir:-1, obj:'log',    sz:3, gap:4 },
  { type:'river', speed:0.9, dir: 1, obj:'log',    sz:4, gap:5 },
  { type:'river', speed:1.6, dir:-1, obj:'turtle', sz:2, gap:4 },
  { type:'river', speed:1.2, dir: 1, obj:'log',    sz:3, gap:5 },
  { type:'safe' },
  { type:'road',  speed:1.5, dir:-1, obj:'truck',  sz:2, gap:4 },
  { type:'road',  speed:2.0, dir: 1, obj:'car',    sz:1, gap:3 },
  { type:'road',  speed:1.2, dir:-1, obj:'car',    sz:1, gap:4 },
  { type:'road',  speed:2.5, dir: 1, obj:'car',    sz:1, gap:3 },
  { type:'road',  speed:1.8, dir:-1, obj:'truck',  sz:2, gap:4 },
  { type:'safe' },
];

const HOME_SLOTS    = 5;
const MAX_LIVES     = 3;
const INVINCIBLE_MS = 1800;
const TIME_LIMIT    = 60;
const TIME_BONUS_MAX= 500;
const STEP_SCORE    = 10;

// ─── Frog uses pixel position (px) not grid col ───────────────────────────────
let frog = { px: 0, row: 13 };   // px = left edge of frog cell

// ─── Game State ───────────────────────────────────────────────────────────────
let G = {
  screen: 'start',
  score: 0,
  bestScore: 0,
  level: 1,
  lives: MAX_LIVES,
  homeFilled: [],
  lanes: [],
  invincible: 0,
  attemptStart: 0,
  elapsed: 0,
  maxRowReached: 13,
  frameId: null,
  lastTime: 0,
  touchX: 0, touchY: 0,
  dying: false,
  dyingTimer: 0,
};

// ─── DOM ──────────────────────────────────────────────────────────────────────
const canvas       = document.getElementById('gameCanvas');
const ctx          = canvas.getContext('2d');
const scoreEl      = document.getElementById('score-val');
const livesEl      = document.getElementById('lives-display');
const timerEl      = document.getElementById('timer-val');
const levelEl      = document.getElementById('level-val');
const homesFilledEl= document.getElementById('homes-filled');
const bestMiniEl   = document.getElementById('best-mini');
const timerMiniEl  = document.getElementById('timer-mini');
const levelMiniEl  = document.getElementById('level-mini');

const overlayStart   = document.getElementById('overlay-start');
const overlayDead    = document.getElementById('overlay-dead');
const overlayWin     = document.getElementById('overlay-win');
const overlayGameover= document.getElementById('overlay-gameover');

// ─── Resize ───────────────────────────────────────────────────────────────────
function resize() {
  const wrap = document.getElementById('canvas-wrapper');
  const ww = wrap.clientWidth;
  const wh = wrap.clientHeight;
  CELL = Math.floor(Math.min(ww / COLS, wh / ROWS));
  if (CELL < 20) CELL = 20;
  CANVAS_W = COLS * CELL;
  CANVAS_H = ROWS * CELL;
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
}

// ─── Lane / object generation ─────────────────────────────────────────────────
function makeLanes(level) {
  return LANE_CONFIG.map((cfg, row) => {
    if (cfg.type === 'safe' || cfg.type === 'home') {
      return { ...cfg, row, objects: [] };
    }
    const speedMult = 1 + (level - 1) * 0.2;
    const objW = cfg.sz * CELL;
    const gap  = cfg.gap * CELL;
    const period = objW + gap;
    const objects = [];
    // Seed objects across lane with phase offset
    const phaseOff = row * 137;
    let x = -(phaseOff % period);
    while (x < CANVAS_W + period) {
      objects.push({
        x,
        w: objW,
        type: cfg.obj,
        cells: cfg.sz,
        diveTimer: row * 200 + objects.length * 600,
        diving: false,
      });
      x += period;
    }
    return { ...cfg, row, objects, speed: cfg.speed * speedMult };
  });
}

// ─── HUD update ───────────────────────────────────────────────────────────────
function updateHUD() {
  const timeLeft = Math.max(0, TIME_LIMIT - Math.floor(G.elapsed));
  scoreEl.textContent = G.score;
  levelEl.textContent = G.level;
  timerEl.textContent = timeLeft;
  timerEl.style.color = timeLeft <= 10 ? '#F87171' : '';
  homesFilledEl.textContent = G.homeFilled.length;
  bestMiniEl.textContent = G.bestScore;
  timerMiniEl.textContent = timeLeft;
  levelMiniEl.textContent = G.level;

  livesEl.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const s = document.createElement('span');
    s.textContent = i < G.lives ? '🐸' : '💀';
    s.style.opacity = i < G.lives ? '1' : '0.25';
    livesEl.appendChild(s);
  }
}

// ─── Color theme ──────────────────────────────────────────────────────────────
function C() {
  const light = window.matchMedia('(prefers-color-scheme: light)').matches;
  return light ? {
    safe:'#c8e6c9', safeAlt:'#dcedc8', safeStroke:'#a5d6a7',
    river:'#bbdefb', riverStroke:'#90caf9', water:'#90caf9',
    road:'#e0e0e0', roadAlt:'#d6d6d6', roadLine:'#bdbdbd',
    homeZone:'#b9f6ca', homeOpen:'#c8e6c9', homeFill:'#00c853',
    log:'#8d6e00', logHi:'#fdd835',
    turtle:'#2e7d32', turtleHi:'#43a047',
    car:['#c62828','#1976d2','#f57c00'],
    truck:['#6a1b9a','#00838f'],
    frog:'#00c853', frogDk:'#00a040', frogEye:'#1a1a1a',
  } : {
    safe:'#1a2e1a', safeAlt:'#162512', safeStroke:'#2d4a2d',
    river:'#0a2a5c', riverStroke:'#0d3a7a', water:'#0a2540',
    road:'#1c1c1c', roadAlt:'#202020', roadLine:'#444',
    homeZone:'#0d1f0d', homeOpen:'#1a2e1a', homeFill:'#00c853',
    log:'#6d4c00', logHi:'#a67c00',
    turtle:'#1b5e20', turtleHi:'#2e7d32',
    car:['#b71c1c','#1565c0','#e65100'],
    truck:['#4a148c','#006064'],
    frog:'#00e676', frogDk:'#00b248', frogEye:'#ffffff',
  };
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawBackground(c) {
  for (let row = 0; row < ROWS; row++) {
    const lane = G.lanes[row];
    const y = row * CELL;
    if (!lane) continue;
    switch (lane.type) {
      case 'safe': {
        for (let col = 0; col < COLS; col++) {
          ctx.fillStyle = col % 2 === 0 ? c.safe : c.safeAlt;
          ctx.fillRect(col * CELL, y, CELL, CELL);
        }
        ctx.fillStyle = c.safeStroke;
        ctx.fillRect(0, y, CANVAS_W, 1);
        break;
      }
      case 'home': {
        ctx.fillStyle = c.homeZone;
        ctx.fillRect(0, y, CANVAS_W, CELL);
        drawHomeRow(c, y);
        break;
      }
      case 'river': {
        ctx.fillStyle = c.river;
        ctx.fillRect(0, y, CANVAS_W, CELL);
        // ripple lines
        ctx.strokeStyle = c.riverStroke;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5;
        for (let rx = 8; rx < CANVAS_W; rx += 22) {
          ctx.beginPath();
          ctx.moveTo(rx, y + CELL * 0.35);
          ctx.quadraticCurveTo(rx + 6, y + CELL * 0.28, rx + 12, y + CELL * 0.35);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'road': {
        ctx.fillStyle = c.road;
        ctx.fillRect(0, y, CANVAS_W, CELL);
        ctx.strokeStyle = c.roadLine;
        ctx.lineWidth = 2;
        ctx.setLineDash([14, 10]);
        ctx.beginPath();
        ctx.moveTo(0, y + CELL / 2);
        ctx.lineTo(CANVAS_W, y + CELL / 2);
        ctx.stroke();
        ctx.setLineDash([]);
        // edge lines
        ctx.strokeStyle = c.roadLine;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y+CELL); ctx.lineTo(CANVAS_W, y+CELL); ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
}

function drawHomeRow(c, y) {
  const slotW = CANVAS_W / HOME_SLOTS;
  for (let i = 0; i < HOME_SLOTS; i++) {
    const sx = Math.floor(i * slotW + slotW / 2 - CELL * 0.75 / 2);
    const sw = Math.floor(CELL * 0.75);
    const sy = Math.floor(y + CELL * 0.1);
    const sh = Math.floor(CELL * 0.8);
    if (G.homeFilled.includes(i)) {
      ctx.fillStyle = c.homeFill;
      rr(sx, sy, sw, sh, 6);
      drawFrogSprite(sx + sw / 2, sy + sh / 2, 0.55, c, false);
    } else {
      ctx.fillStyle = c.homeOpen;
      ctx.strokeStyle = c.safeStroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(sx, sy, sw, sh, 6);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawObjects(c) {
  for (const lane of G.lanes) {
    if (lane.type !== 'river' && lane.type !== 'road') continue;
    for (const obj of lane.objects) {
      drawObj(obj, lane, c);
    }
  }
}

function drawObj(obj, lane, c) {
  const y = lane.row * CELL;
  const pad = 4;

  if (obj.type === 'log') {
    ctx.fillStyle = c.log;
    rr(obj.x, y + pad, obj.w, CELL - pad * 2, 7);
    ctx.fillStyle = c.logHi;
    rr(obj.x + 5, y + pad + 3, obj.w - 10, 4, 2);
    // bark rings
    ctx.strokeStyle = c.logHi;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    for (let s = 1; s < obj.cells; s++) {
      ctx.beginPath();
      ctx.moveTo(obj.x + s * CELL, y + pad);
      ctx.lineTo(obj.x + s * CELL, y + CELL - pad);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

  } else if (obj.type === 'turtle') {
    ctx.globalAlpha = obj.diving ? 0.38 : 1;
    for (let s = 0; s < obj.cells; s++) {
      const tx = obj.x + s * CELL;
      ctx.fillStyle = c.turtle;
      rr(tx + 4, y + 5, CELL - 8, CELL - 10, 9);
      ctx.fillStyle = c.turtleHi;
      rr(tx + 8, y + 8, CELL - 16, CELL - 16, 5);
      // head
      ctx.fillStyle = c.turtle;
      ctx.beginPath();
      ctx.ellipse(tx + CELL / 2, y + 4, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // flippers
      ctx.fillStyle = c.turtle;
      ctx.beginPath(); ctx.ellipse(tx + 5, y + CELL - 7, 4, 2.5, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(tx + CELL - 5, y + CELL - 7, 4, 2.5, 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

  } else if (obj.type === 'car') {
    const ci = (Math.abs(Math.floor(obj.x / 120)) + lane.row) % 3;
    const col = c.car[ci];
    ctx.save();
    if (lane.dir === -1) {
      ctx.translate(obj.x + obj.w / 2, y + CELL / 2);
      ctx.scale(-1, 1);
      ctx.translate(-(obj.x + obj.w / 2), -(y + CELL / 2));
    }
    ctx.fillStyle = col;
    rr(obj.x + 2, y + 6, obj.w - 4, CELL - 12, 7);
    // windshield
    ctx.fillStyle = 'rgba(150,220,255,0.75)';
    rr(obj.x + obj.w - 13, y + 9, 9, CELL - 18, 3);
    // rear window
    ctx.fillStyle = 'rgba(150,220,255,0.5)';
    rr(obj.x + 4, y + 9, 9, CELL - 18, 3);
    // wheels
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(obj.x + 7, y + CELL - 5, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(obj.x + obj.w - 7, y + CELL - 5, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

  } else if (obj.type === 'truck') {
    const ci = (Math.abs(Math.floor(obj.x / 100)) + lane.row) % 2;
    const col = c.truck[ci];
    ctx.save();
    if (lane.dir === -1) {
      ctx.translate(obj.x + obj.w / 2, y + CELL / 2);
      ctx.scale(-1, 1);
      ctx.translate(-(obj.x + obj.w / 2), -(y + CELL / 2));
    }
    // trailer
    ctx.fillStyle = col;
    rr(obj.x + 2, y + 6, obj.w - CELL - 2, CELL - 12, 4);
    // cab
    ctx.fillStyle = c.truck[(ci + 1) % 2];
    rr(obj.x + obj.w - CELL + 2, y + 7, CELL - 4, CELL - 14, 6);
    // windshield
    ctx.fillStyle = 'rgba(150,220,255,0.65)';
    rr(obj.x + obj.w - CELL + 6, y + 10, CELL - 12, CELL - 20, 3);
    // wheels
    ctx.fillStyle = '#111';
    for (let w = 0; w < obj.cells; w++) {
      ctx.beginPath(); ctx.ellipse(obj.x + 10 + w * CELL, y + CELL - 5, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawFrogSprite(cx, cy, scale, c, blink) {
  if (blink) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  // back legs
  ctx.fillStyle = c.frog;
  ctx.beginPath(); ctx.ellipse(-13, 7, 5.5, 3, -0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(13, 7, 5.5, 3, 0.4, 0, Math.PI * 2); ctx.fill();
  // body
  ctx.fillStyle = c.frog;
  ctx.beginPath(); ctx.ellipse(0, 0, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
  // belly
  ctx.fillStyle = c.frogDk;
  ctx.beginPath(); ctx.ellipse(0, 3, 7.5, 6.5, 0, 0, Math.PI * 2); ctx.fill();
  // front legs
  ctx.fillStyle = c.frog;
  ctx.beginPath(); ctx.ellipse(-11, -3, 4.5, 2.5, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(11, -3, 4.5, 2.5, -0.4, 0, Math.PI * 2); ctx.fill();
  // eyes
  ctx.fillStyle = c.frogEye;
  ctx.beginPath(); ctx.arc(-5.5, -8, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5.5, -8, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-5.5, -8, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(5.5, -8, 2.2, 0, Math.PI * 2); ctx.fill();
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(-4.5, -9, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(6.5, -9, 1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFrog(c, now) {
  if (G.screen !== 'playing') return;
  const blink = G.invincible > 0 && Math.floor(now / 110) % 2 === 0;
  if (blink) return;
  const cx = frog.px + CELL / 2;
  const cy = frog.row * CELL + CELL / 2;
  // Death flash overlay
  if (G.dying) {
    ctx.globalAlpha = 0.7 * (G.dyingTimer / 500);
    ctx.fillStyle = '#F87171';
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  drawFrogSprite(cx, cy, 0.9, c, false);
}

function render(now) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const c = C();
  drawBackground(c);
  drawObjects(c);
  drawFrog(c, now);
}

// ─── Update ───────────────────────────────────────────────────────────────────
function update(dt, now) {
  if (G.screen !== 'playing') return;

  G.elapsed = (now - G.attemptStart) / 1000;
  updateHUD();

  if (G.elapsed >= TIME_LIMIT) {
    loseLife();
    return;
  }

  if (G.invincible > 0) G.invincible -= dt;

  // Move lane objects
  for (const lane of G.lanes) {
    if (lane.type !== 'river' && lane.type !== 'road') continue;
    for (const obj of lane.objects) {
      obj.x += lane.dir * lane.speed * dt * 0.06;
      // Wrap
      if (lane.dir === 1 && obj.x > CANVAS_W + 4) {
        obj.x = -obj.w - 4;
      } else if (lane.dir === -1 && obj.x + obj.w < -4) {
        obj.x = CANVAS_W + 4;
      }
      // Turtle diving
      if (obj.type === 'turtle') {
        obj.diveTimer += dt;
        const cycle = 2800 + lane.row * 400;
        obj.diving = (obj.diveTimer % cycle) > cycle * 0.65;
      }
    }
  }

  // River riding: move frog with surface
  const lane = G.lanes[frog.row];
  if (lane && lane.type === 'river') {
    const surf = getSurface(frog.row);
    if (surf) {
      frog.px += lane.dir * lane.speed * dt * 0.06;
    }
  }

  // Check physics every frame
  checkPhysics();
}

function getSurface(row) {
  const lane = G.lanes[row];
  if (!lane || lane.type !== 'river') return null;
  const fLeft  = frog.px + 4;
  const fRight = frog.px + CELL - 4;
  for (const obj of lane.objects) {
    if (obj.type === 'turtle' && obj.diving) continue;
    if (fLeft >= obj.x - 2 && fRight <= obj.x + obj.w + 2) {
      return obj;
    }
  }
  return null;
}

function checkPhysics() {
  if (G.invincible > 0 || G.dying) return;
  const lane = G.lanes[frog.row];
  if (!lane) return;

  // Check frog out of horizontal bounds (swept off log)
  if (frog.px < -CELL * 0.5 || frog.px > CANVAS_W - CELL * 0.5) {
    loseLife();
    return;
  }

  if (lane.type === 'river') {
    if (!getSurface(frog.row)) {
      loseLife();
    }
    return;
  }

  if (lane.type === 'road') {
    const fLeft  = frog.px + 5;
    const fRight = frog.px + CELL - 5;
    for (const obj of lane.objects) {
      if (fLeft < obj.x + obj.w - 2 && fRight > obj.x + 2) {
        loseLife();
        return;
      }
    }
  }
}

// ─── Frog movement ────────────────────────────────────────────────────────────
function moveFrog(dir) {
  if (G.screen !== 'playing' || G.dying) return;

  const prevRow = frog.row;

  if (dir === 'up')    frog.row = Math.max(0, frog.row - 1);
  if (dir === 'down')  frog.row = Math.min(ROWS - 1, frog.row + 1);
  if (dir === 'left')  frog.px  = Math.max(0, frog.px - CELL);
  if (dir === 'right') frog.px  = Math.min((COLS - 1) * CELL, frog.px + CELL);

  // Score for advancing upward
  if (frog.row < G.maxRowReached) {
    G.maxRowReached = frog.row;
    G.score += STEP_SCORE;
    updateHUD();
  }

  // Arrived at home row
  if (frog.row === 0) {
    checkHome();
    return;
  }

  // Immediate physics check after move
  checkPhysics();
}

function checkHome() {
  const slotW = CANVAS_W / HOME_SLOTS;
  const fCx = frog.px + CELL / 2;
  let si = Math.floor(fCx / slotW);
  si = Math.max(0, Math.min(HOME_SLOTS - 1, si));

  if (G.homeFilled.includes(si)) {
    loseLife();
    return;
  }

  G.homeFilled.push(si);
  const timeLeft = Math.max(0, TIME_LIMIT - G.elapsed);
  const bonus = Math.floor((timeLeft / TIME_LIMIT) * TIME_BONUS_MAX);
  G.score += 100 + bonus;
  updateHUD();

  if (G.homeFilled.length >= HOME_SLOTS) {
    doLevelComplete();
  } else {
    spawnFrog();
  }
}

// ─── Life / death ─────────────────────────────────────────────────────────────
function loseLife() {
  if (G.dying || G.invincible > 0) return;
  G.dying = true;
  G.dyingTimer = 500;
  G.lives--;
  updateHUD();

  // Show brief dead overlay with current stats
  document.getElementById('dead-score').textContent = G.score;
  document.getElementById('dead-best').textContent  = G.bestScore;

  setTimeout(() => {
    G.dying = false;
    if (G.lives <= 0) {
      doGameOver();
    } else {
      spawnFrog();
      // Hide dead overlay and resume
      showOverlay(null);
    }
  }, 1200);
}

function spawnFrog() {
  frog.px  = Math.floor(COLS / 2) * CELL;
  frog.row = 13;
  G.invincible   = INVINCIBLE_MS;
  G.attemptStart = performance.now();
  G.elapsed      = 0;
  G.maxRowReached= 13;
}

// ─── Level / game over ────────────────────────────────────────────────────────
function doLevelComplete() {
  G.screen = 'win';
  saveBest();
  const timeLeft = Math.max(0, TIME_LIMIT - G.elapsed);
  document.getElementById('win-score').textContent = G.score;
  document.getElementById('win-best').textContent  = G.bestScore;
  document.getElementById('win-time').textContent  = Math.floor(timeLeft) + '초';
  document.getElementById('win-bonus').textContent = '+' + Math.floor((timeLeft / TIME_LIMIT) * TIME_BONUS_MAX);
  showOverlay(overlayWin);
}

function doGameOver() {
  G.screen = 'gameover';
  saveBest();
  document.getElementById('go-score').textContent      = G.score;
  document.getElementById('go-best').textContent       = G.bestScore;
  document.getElementById('go-level').textContent      = G.level;
  document.getElementById('go-level-badge').textContent= G.level;
  showOverlay(overlayGameover);
  if(typeof Leaderboard!=='undefined')Leaderboard.ready('frogger',G.score);
}

function nextLevel() {
  G.level++;
  G.homeFilled = [];
  G.lanes      = makeLanes(G.level);
  G.screen     = 'playing';
  spawnFrog();
  G.invincible = INVINCIBLE_MS;
  showOverlay(null);
}

function saveBest() {
  if (G.score > G.bestScore) {
    G.bestScore = G.score;
    localStorage.setItem('frogger_best', G.bestScore);
  }
}

// ─── Overlay helper ───────────────────────────────────────────────────────────
function showOverlay(el) {
  [overlayStart, overlayDead, overlayWin, overlayGameover].forEach(o => {
    o.classList.toggle('hidden', o !== el);
  });
}

// ─── Game start / restart ─────────────────────────────────────────────────────
function startGame() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  G.score     = 0;
  G.level     = 1;
  G.lives     = MAX_LIVES;
  G.homeFilled= [];
  G.lanes     = makeLanes(1);
  G.dying     = false;
  G.screen    = 'playing';
  spawnFrog();
  G.invincible = INVINCIBLE_MS;
  updateHUD();
  showOverlay(null);
}

// ─── Game loop ────────────────────────────────────────────────────────────────
function gameLoop(now) {
  const dt = Math.min(now - (G.lastTime || now), 100);
  G.lastTime = now;
  if (G.dying) G.dyingTimer = Math.max(0, G.dyingTimer - dt);
  if (G.screen === 'playing') {
    update(dt, now);
  } else {
    // Still animate background on overlays
    for (const lane of G.lanes) {
      if (lane.type !== 'river' && lane.type !== 'road') continue;
      for (const obj of lane.objects) {
        obj.x += lane.dir * lane.speed * dt * 0.06;
        if (lane.dir === 1 && obj.x > CANVAS_W + 4) obj.x = -obj.w - 4;
        else if (lane.dir === -1 && obj.x + obj.w < -4) obj.x = CANVAS_W + 4;
      }
    }
  }
  render(now);
  G.frameId = requestAnimationFrame(gameLoop);
}

function startLoop() {
  if (G.frameId) cancelAnimationFrame(G.frameId);
  G.lastTime = 0;
  G.frameId  = requestAnimationFrame(gameLoop);
}

// ─── Input ────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (G.screen !== 'playing') {
    if (e.key === 'Enter' || e.key === ' ') handleAnyPress();
    return;
  }
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); moveFrog('up');    break;
    case 'ArrowDown':  case 's': case 'S': e.preventDefault(); moveFrog('down');  break;
    case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); moveFrog('left');  break;
    case 'ArrowRight': case 'd': case 'D': e.preventDefault(); moveFrog('right'); break;
  }
});

function handleAnyPress() {
  if (G.screen === 'start' || G.screen === 'gameover') startGame();
  else if (G.screen === 'win') nextLevel();
}

// D-pad
document.querySelectorAll('.dpad-btn[data-dir]').forEach(btn => {
  const dir = btn.dataset.dir;
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    btn.classList.add('pressed');
    if (G.screen === 'playing') moveFrog(dir);
    else handleAnyPress();
  });
  btn.addEventListener('pointerup',    () => btn.classList.remove('pressed'));
  btn.addEventListener('pointerleave', () => btn.classList.remove('pressed'));
});

// Swipe on canvas
canvas.addEventListener('touchstart', e => {
  G.touchX = e.touches[0].clientX;
  G.touchY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', e => {
  if (!e.changedTouches.length) return;
  const dx = e.changedTouches[0].clientX - G.touchX;
  const dy = e.changedTouches[0].clientY - G.touchY;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < 12 && ay < 12) { handleAnyPress(); return; }
  if (ax > ay) moveFrog(dx > 0 ? 'right' : 'left');
  else          moveFrog(dy > 0 ? 'down'  : 'up');
}, { passive: true });

// Start button
document.getElementById('btn-start').addEventListener('click', startGame);

document.getElementById('btn-restart-dead').addEventListener('click', () => {
  spawnFrog();
  G.screen = 'playing';
  showOverlay(null);
});

document.getElementById('btn-next-level').addEventListener('click', nextLevel);
document.getElementById('btn-restart-win').addEventListener('click', startGame);
document.getElementById('btn-restart-go').addEventListener('click', startGame);

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  resize();
  G.lanes = makeLanes(G.level);
  // Re-snap frog px to grid
  const col = Math.round(frog.px / (CELL || 40));
  frog.px = col * CELL;
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
(function boot() {
  resize();
  G.bestScore = parseInt(localStorage.getItem('frogger_best') || '0');
  document.getElementById('best-start').textContent = G.bestScore;
  G.lanes = makeLanes(1);
  frog.px  = Math.floor(COLS / 2) * CELL;
  frog.row = 13;
  showOverlay(overlayStart);
  startLoop();
})();
