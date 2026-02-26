// ─── CROSSY ROAD ─── //

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ─── State ────────────────────────────────────────────────────────────────────
const State = {
  IDLE: 'idle',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAMEOVER: 'gameover',
};

let state = State.IDLE;
let score = 0;
let coins = 0;
let totalCoins = 0;
let bestScore = parseInt(localStorage.getItem('crossy_best') || '0', 10);
let lastTime = 0;

// ─── Canvas sizing ────────────────────────────────────────────────────────────
const COLS = 9; // odd number for center start
let TILE = 48;
let W, H, ROWS;

function resize() {
  const maxW = Math.min(window.innerWidth, 480);
  W = maxW;
  H = window.innerHeight;
  TILE = Math.floor(W / COLS);
  ROWS = Math.ceil(H / TILE) + 2;
  canvas.width = W;
  canvas.height = H;
}

// ─── roundRect polyfill ───────────────────────────────────────────────────────
function roundRect(cx, x, y, w, h, r) {
  if (cx.roundRect) {
    cx.roundRect(x, y, w, h, r);
  } else {
    const minR = Math.min(r, w / 2, h / 2);
    cx.moveTo(x + minR, y);
    cx.lineTo(x + w - minR, y);
    cx.quadraticCurveTo(x + w, y, x + w, y + minR);
    cx.lineTo(x + w, y + h - minR);
    cx.quadraticCurveTo(x + w, y + h, x + w - minR, y + h);
    cx.lineTo(x + minR, y + h);
    cx.quadraticCurveTo(x, y + h, x, y + h - minR);
    cx.lineTo(x, y + minR);
    cx.quadraticCurveTo(x, y, x + minR, y);
    cx.closePath();
  }
}

// ─── World ────────────────────────────────────────────────────────────────────
const LANE_TYPES = { GRASS: 'grass', ROAD: 'road', RIVER: 'river' };

let world = [];
let cameraY = 0;
let targetCameraY = 0;

function isDarkMode() {
  return !window.matchMedia('(prefers-color-scheme: light)').matches;
}

function laneColor(type, alt) {
  const dark = isDarkMode();
  if (type === LANE_TYPES.GRASS) {
    return alt ? (dark ? '#183518' : '#43A047') : (dark ? '#1A3A1A' : '#4CAF50');
  }
  if (type === LANE_TYPES.ROAD) {
    return alt ? (dark ? '#252525' : '#666') : (dark ? '#1C1C1C' : '#555');
  }
  if (type === LANE_TYPES.RIVER) {
    return alt ? (dark ? '#0F3659' : '#1565C0') : (dark ? '#0D2E4A' : '#1976D2');
  }
  return '#333';
}

function generateLane(rowIndex) {
  if (rowIndex <= 0) {
    return { type: LANE_TYPES.GRASS, entities: [], coins: [] };
  }
  const r = Math.random();
  const grassChance = Math.max(0.2, 0.45 - rowIndex * 0.003);
  const riverChance = 0.22;

  if (r < grassChance) {
    return makeGrassLane(rowIndex);
  } else if (r < grassChance + riverChance) {
    return makeRiverLane(rowIndex);
  } else {
    return makeRoadLane(rowIndex);
  }
}

function makeGrassLane() {
  const lane = { type: LANE_TYPES.GRASS, entities: [], coins: [] };
  for (let c = 0; c < COLS; c++) {
    if (Math.random() < 0.14) {
      lane.entities.push({ col: c, kind: 'tree' });
    } else if (Math.random() < 0.09) {
      lane.coins.push({ col: c, x: c * TILE + TILE / 2, collected: false });
    }
  }
  return lane;
}

function makeRoadLane(rowIndex) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const difficulty = Math.min(1, rowIndex / 80);
  const speed = (1.5 + Math.random() * 2 + difficulty * 2) * dir;
  const gap = Math.max(1.8, 4.5 - difficulty * 1.5);
  const numCars = Math.floor(2 + Math.random() * 3);
  const cars = [];
  for (let i = 0; i < numCars; i++) {
    const cw = TILE * (1 + Math.floor(Math.random() * 2) * 0.5);
    cars.push({
      x: dir > 0 ? -cw - i * gap * TILE : W + i * gap * TILE,
      width: cw,
      height: TILE * 0.68,
      speed,
      color: randomCarColor(),
      kind: 'car',
    });
  }
  return { type: LANE_TYPES.ROAD, entities: cars, coins: [], dir, speed };
}

function makeRiverLane(rowIndex) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const difficulty = Math.min(1, rowIndex / 80);
  const speed = (1 + Math.random() * 1.5 + difficulty) * dir;
  const numLogs = Math.floor(2 + Math.random() * 2);
  const logs = [];
  for (let i = 0; i < numLogs; i++) {
    const lw = TILE * (2 + Math.floor(Math.random() * 2));
    logs.push({
      x: dir > 0 ? -lw - i * TILE * 4.5 : W + i * TILE * 4.5,
      width: lw,
      height: TILE * 0.62,
      speed,
      kind: 'log',
    });
  }
  return { type: LANE_TYPES.RIVER, entities: logs, coins: [], dir, speed };
}

function randomCarColor() {
  const colors = [
    '#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F43F5E', '#6366F1',
    '#06B6D4', '#84CC16',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ─── Player ───────────────────────────────────────────────────────────────────
const PLAYER_SIZE = 0.78;
const IDLE_WARN_MS = 6000;
const IDLE_PUSH_MS = 9500;

const player = {
  col: Math.floor(COLS / 2),
  row: 0,
  x: 0,
  y: 0,
  isMoving: false,
  onLog: null,
  alive: true,
  deathAnim: 0,
  deathCause: 'car',
  hopAnim: 0,
  hopDir: 0,
  prevCol: Math.floor(COLS / 2),
  prevRow: 0,
  faceDir: 0,
  idleTime: 0,
};

function initPlayer() {
  player.col = Math.floor(COLS / 2);
  player.row = 0;
  player.prevCol = player.col;
  player.prevRow = player.row;
  player.x = player.col * TILE + TILE / 2;
  player.y = rowToScreenY(0);
  player.isMoving = false;
  player.onLog = null;
  player.alive = true;
  player.deathAnim = 0;
  player.deathCause = 'car';
  player.hopAnim = 0;
  player.faceDir = 0;
  player.idleTime = 0;
}

// ─── World row → screen Y ──────────────────────────────────────────────────────
function rowToScreenY(worldRow) {
  const baseY = H - TILE * 2;
  return baseY - worldRow * TILE + cameraY;
}

// ─── Camera ───────────────────────────────────────────────────────────────────
function updateCamera(dt) {
  const targetScreenY = H * 0.60;
  const playerScreenY = rowToScreenY(player.row);
  const diff = playerScreenY - targetScreenY;

  if (diff < 0) {
    targetCameraY = cameraY - diff;
  }

  // Check if player was pushed off screen from below (idle push via camera)
  if (player.alive) {
    const playerScreenYNow = rowToScreenY(player.row);
    if (playerScreenYNow > H + TILE) {
      killPlayer('idle');
    }
  }

  cameraY += (targetCameraY - cameraY) * Math.min(1, dt * 9);

  // Generate new lanes ahead
  const topVisibleRow = player.row + ROWS + 6;
  while (world.length <= topVisibleRow) {
    world.push(generateLane(world.length));
  }
}

// ─── Input ────────────────────────────────────────────────────────────────────
const DIRS = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
let inputQueue = [];
let lastInputTime = 0;

function queueMove(dir) {
  if (state !== State.PLAYING) return;
  const now = performance.now();
  if (now - lastInputTime < 100) {
    if (inputQueue.length < 2) inputQueue.push(dir);
  } else {
    inputQueue = [dir];
    lastInputTime = now;
  }
}

function setupInput() {
  document.addEventListener('keydown', (e) => {
    if (state === State.PAUSED) {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') resumeGame();
      return;
    }
    if (state === State.IDLE) {
      if (e.key === 'Enter' || e.key === ' ' || e.key.startsWith('Arrow')) startGame();
      return;
    }
    if (state === State.GAMEOVER) return;
    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': queueMove(DIRS.UP);    e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': queueMove(DIRS.RIGHT); e.preventDefault(); break;
      case 'ArrowDown':  case 's': case 'S': queueMove(DIRS.DOWN);  e.preventDefault(); break;
      case 'ArrowLeft':  case 'a': case 'A': queueMove(DIRS.LEFT);  e.preventDefault(); break;
      case 'Escape': case 'p': case 'P': pauseGame(); break;
    }
  });

  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    const elapsed = Date.now() - touchStart.t;
    touchStart = null;

    if (elapsed > 500) return;

    const adx = Math.abs(dx), ady = Math.abs(dy);
    const minSwipe = 18;

    if (adx < minSwipe && ady < minSwipe) {
      // Tap
      if (state === State.IDLE) { startGame(); return; }
      if (state === State.PLAYING) queueMove(DIRS.UP);
      return;
    }
    if (state === State.IDLE) { startGame(); return; }
    if (state !== State.PLAYING) return;

    if (adx > ady) {
      queueMove(dx > 0 ? DIRS.RIGHT : DIRS.LEFT);
    } else {
      queueMove(dy > 0 ? DIRS.DOWN : DIRS.UP);
    }
    e.preventDefault();
  }, { passive: false });

  // Mobile d-pad buttons
  function addBtnListener(id, dir) {
    const btn = document.getElementById(id);
    btn.addEventListener('touchstart', (e) => { queueMove(dir); e.preventDefault(); }, { passive: false });
    btn.addEventListener('click', () => queueMove(dir));
  }
  addBtnListener('btn-up', DIRS.UP);
  addBtnListener('btn-right', DIRS.RIGHT);
  addBtnListener('btn-down', DIRS.DOWN);
  addBtnListener('btn-left', DIRS.LEFT);

  document.getElementById('pause-btn').addEventListener('click', pauseGame);
}

// ─── Movement ─────────────────────────────────────────────────────────────────
function tryMove(dir) {
  if (player.isMoving || !player.alive) return;

  let newCol = player.col;
  let newRow = player.row;

  switch (dir) {
    case DIRS.UP:    newRow += 1; break;
    case DIRS.RIGHT: newCol += 1; break;
    case DIRS.DOWN:  newRow -= 1; if (newRow < 0) return; break;
    case DIRS.LEFT:  newCol -= 1; break;
  }

  if (newCol < 0 || newCol >= COLS) return;

  const lane = world[newRow];
  if (!lane) return;

  // Blocked by tree
  if (lane.type === LANE_TYPES.GRASS) {
    if (lane.entities.some(e => e.kind === 'tree' && e.col === newCol)) {
      bumpAnim();
      return;
    }
  }

  player.prevCol = player.col;
  player.prevRow = player.row;
  player.col = newCol;
  player.row = newRow;
  player.faceDir = dir;
  player.isMoving = true;
  player.hopAnim = 0;
  player.hopDir = dir;
  player.onLog = null;
  player.idleTime = 0;

  if (player.row > score) {
    score = player.row;
    updateHUD();
  }
}

let bumpT = 0;
function bumpAnim() {
  bumpT = 1;
}

// ─── Hop animation ────────────────────────────────────────────────────────────
const HOP_DURATION = 0.14;

function updatePlayer(dt) {
  if (!player.alive) {
    player.deathAnim = Math.min(1, player.deathAnim + dt * 2.5);
    return;
  }

  bumpT = Math.max(0, bumpT - dt * 6);

  // Idle timer
  player.idleTime += dt * 1000;
  const idleWarnEl = document.getElementById('idle-warning');
  if (player.idleTime > IDLE_WARN_MS && player.idleTime < IDLE_PUSH_MS) {
    idleWarnEl.classList.add('visible');
  } else {
    idleWarnEl.classList.remove('visible');
  }

  if (player.idleTime >= IDLE_PUSH_MS) {
    idleWarnEl.classList.remove('visible');
    killPlayer('idle');
    return;
  }

  // Hop animation
  if (player.isMoving) {
    player.hopAnim += dt / HOP_DURATION;
    if (player.hopAnim >= 1) {
      player.hopAnim = 1;
      player.isMoving = false;
      checkLandingCollision();
    }
  } else {
    if (inputQueue.length > 0) {
      tryMove(inputQueue.shift());
    }
  }

  // Screen position interpolation
  const targetX = player.col * TILE + TILE / 2;
  const targetY = rowToScreenY(player.row);

  if (player.isMoving) {
    const prevX = player.prevCol * TILE + TILE / 2;
    const prevY = rowToScreenY(player.prevRow);
    const t = easeInOut(player.hopAnim);
    player.x = prevX + (targetX - prevX) * t;
    player.y = prevY + (targetY - prevY) * t;
  } else if (player.onLog) {
    // Riding a log: move with it instead of snapping to grid
    const dx = player.onLog.speed * dt * 60;
    player.x += dx;
    player.col = Math.round((player.x - TILE / 2) / TILE);
    player.y = rowToScreenY(player.row);

    // Fell off screen
    if (player.x < -TILE * 0.5 || player.x > W + TILE * 0.5) {
      killPlayer('drown');
      return;
    }

    // Verify still on a log
    const lane = world[player.row];
    if (lane && lane.type === LANE_TYPES.RIVER) {
      const log = findLogUnderPlayer(lane);
      if (log) {
        player.onLog = log;
      } else {
        killPlayer('drown');
        return;
      }
    } else {
      // Moved off river lane somehow
      player.onLog = null;
    }
  } else {
    player.x = targetX;
    player.y = rowToScreenY(player.row);

    // Just landed on river — find a log
    const lane = world[player.row];
    if (lane && lane.type === LANE_TYPES.RIVER) {
      const log = findLogUnderPlayer(lane);
      if (log) {
        player.onLog = log;
      } else {
        killPlayer('drown');
        return;
      }
    }
  }

  // Coin collection
  const curLane = world[player.row];
  if (curLane) {
    for (const coin of curLane.coins) {
      if (!coin.collected && Math.abs(player.x - coin.x) < TILE * 0.55) {
        coin.collected = true;
        coins++;
        totalCoins++;
        updateHUD();
        spawnCoinPopup(coin.x, player.y);
      }
    }
  }
}

function findLogUnderPlayer(lane, px) {
  const checkX = px !== undefined ? px : player.x;
  return lane.entities.find(log =>
    checkX >= log.x + 2 && checkX <= log.x + log.width - 2
  ) || null;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function checkLandingCollision() {
  const lane = world[player.row];
  if (!lane) return;

  // Use exact grid-aligned landing position
  const landX = player.col * TILE + TILE / 2;

  if (lane.type === LANE_TYPES.ROAD) {
    for (const car of lane.entities) {
      if (landX > car.x + 4 && landX < car.x + car.width - 4) {
        killPlayer('car');
        return;
      }
    }
  }

  if (lane.type === LANE_TYPES.RIVER) {
    const log = findLogUnderPlayer(lane, landX);
    if (log) {
      player.onLog = log;
      player.x = landX;
    } else {
      killPlayer('drown');
    }
  }
}

function killPlayer(cause) {
  if (!player.alive) return;
  player.alive = false;
  player.deathAnim = 0;
  player.deathCause = cause;
  player.isMoving = false;
  inputQueue = [];

  setTimeout(() => showGameOver(), 900);
}

// ─── Entity update ────────────────────────────────────────────────────────────
function updateEntities(dt) {
  const visTop = player.row + ROWS + 4;
  const visBot = Math.max(0, player.row - ROWS - 2);

  for (let r = visBot; r < Math.min(world.length, visTop); r++) {
    const lane = world[r];
    if (lane.type !== LANE_TYPES.ROAD && lane.type !== LANE_TYPES.RIVER) continue;

    for (const ent of lane.entities) {
      ent.x += ent.speed * dt * 60;

      // Wrap
      if (ent.speed > 0 && ent.x > W + ent.width + TILE) {
        ent.x = -ent.width - Math.random() * TILE * 3;
      } else if (ent.speed < 0 && ent.x < -ent.width - TILE) {
        ent.x = W + Math.random() * TILE * 3;
      }
    }

    // Live car collision
    if (lane.type === LANE_TYPES.ROAD && player.alive && player.row === r) {
      for (const car of lane.entities) {
        const hit = player.x + TILE * PLAYER_SIZE * 0.3;
        const hitL = player.x - TILE * PLAYER_SIZE * 0.3;
        if (hit > car.x + 3 && hitL < car.x + car.width - 3) {
          killPlayer('car');
          break;
        }
      }
    }
  }
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
function drawGame() {
  ctx.clearRect(0, 0, W, H);

  const visTop = player.row + ROWS + 4;
  const visBot = Math.max(0, player.row - ROWS - 2);

  // Lanes
  for (let r = visBot; r < Math.min(world.length, visTop); r++) {
    drawLane(r);
  }

  // Coins
  for (let r = visBot; r < Math.min(world.length, visTop); r++) {
    const lane = world[r];
    const sy = rowToScreenY(r);
    if (sy < -TILE || sy > H + TILE) continue;
    for (const coin of lane.coins) {
      if (!coin.collected) {
        const bob = Math.sin(performance.now() / 400 + coin.col) * 2;
        drawEmoji('🪙', coin.x, sy + bob, TILE * 0.52);
      }
    }
  }

  // Logs (below player)
  for (let r = visBot; r < Math.min(world.length, visTop); r++) {
    const lane = world[r];
    if (lane.type !== LANE_TYPES.RIVER) continue;
    const sy = rowToScreenY(r);
    if (sy < -TILE * 2 || sy > H + TILE * 2) continue;
    for (const log of lane.entities) drawLog(log, sy);
  }

  // Cars
  for (let r = visBot; r < Math.min(world.length, visTop); r++) {
    const lane = world[r];
    if (lane.type !== LANE_TYPES.ROAD) continue;
    const sy = rowToScreenY(r);
    if (sy < -TILE * 2 || sy > H + TILE * 2) continue;
    for (const car of lane.entities) drawCar(car, sy);
  }

  // Trees (drawn last in grass so they appear on top)
  for (let r = visBot; r < Math.min(world.length, visTop); r++) {
    const lane = world[r];
    if (lane.type !== LANE_TYPES.GRASS) continue;
    const sy = rowToScreenY(r);
    if (sy < -TILE || sy > H + TILE) continue;
    for (const tree of lane.entities) {
      if (tree.kind === 'tree') {
        drawEmoji('🌲', tree.col * TILE + TILE / 2, sy, TILE * 0.88);
      }
    }
  }

  // Player
  drawPlayer();
}

function drawLane(r) {
  const lane = world[r];
  const sy = rowToScreenY(r) - TILE / 2;
  if (sy + TILE < -2 || sy > H + 2) return;

  ctx.fillStyle = laneColor(lane.type, r % 2 === 1);
  ctx.fillRect(0, sy, W, TILE);

  if (lane.type === LANE_TYPES.ROAD) {
    ctx.save();
    ctx.setLineDash([TILE * 0.35, TILE * 0.65]);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, sy + TILE / 2);
    ctx.lineTo(W, sy + TILE / 2);
    ctx.stroke();
    ctx.restore();
  }

  if (lane.type === LANE_TYPES.RIVER) {
    const now = performance.now();
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    const t = ((now / 1000 + r * 0.7) % 1.5);
    for (let wx = -TILE * 1.5; wx < W + TILE; wx += TILE * 1.5) {
      ctx.beginPath();
      ctx.arc(wx + t * TILE * 1.5, sy + TILE / 2, TILE * 0.22, 0, Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (lane.type === LANE_TYPES.GRASS) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = isDarkMode() ? '#22C55E' : '#1B5E20';
    for (let gx = 6; gx < W; gx += 14) {
      const gh = 3 + Math.sin(gx * 0.55 + r * 1.7) * 1.5;
      ctx.fillRect(gx, sy + TILE - gh, 2, gh);
    }
    ctx.restore();
  }
}

function drawCar(car, laneY) {
  const x = Math.round(car.x);
  const y = laneY - car.height / 2;
  const w = car.width;
  const h = car.height;

  ctx.save();

  // Glow / shadow
  ctx.shadowColor = car.color + '88';
  ctx.shadowBlur = 10;

  // Body
  ctx.fillStyle = car.color;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 5);
  ctx.fill();

  ctx.shadowBlur = 0;

  // Windshield
  ctx.fillStyle = 'rgba(30,60,100,0.65)';
  const winW = w * 0.54;
  const winH = h * 0.36;
  const winX = x + (w - winW) / 2;
  ctx.beginPath();
  roundRect(ctx, winX, y + h * 0.14, winW, winH, 2);
  ctx.fill();

  // Roof stripe highlight
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  roundRect(ctx, winX + 2, y + h * 0.14 + 2, winW - 4, winH * 0.4, 1);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Wheels (4 corners)
  const wr = h * 0.19;
  ctx.fillStyle = '#1a1a1a';
  const wheelPositions = [
    [x + wr + 2, y - 1],
    [x + w - wr - 2, y - 1],
    [x + wr + 2, y + h + 1],
    [x + w - wr - 2, y + h + 1],
  ];
  for (const [wx, wy] of wheelPositions) {
    ctx.beginPath();
    ctx.arc(wx, wy, wr, 0, Math.PI * 2);
    ctx.fill();
    // Hubcap
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(wx, wy, wr * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
  }

  // Headlights
  const lightX = car.speed > 0 ? x + w - 3 : x + 3;
  const lightColor = car.speed > 0 ? '#FFFDE7' : '#FF8A80';
  ctx.fillStyle = lightColor;
  ctx.shadowColor = lightColor;
  ctx.shadowBlur = 6;
  for (const ly of [y + h * 0.28, y + h * 0.72]) {
    ctx.beginPath();
    ctx.arc(lightX, ly, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawLog(log, laneY) {
  const x = Math.round(log.x);
  const y = laneY - log.height / 2;
  const w = log.width;
  const h = log.height;

  ctx.save();

  // Log shadow
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 3, w / 2 - 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Main log body
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#A0682A');
  grad.addColorStop(0.5, '#8B5E3C');
  grad.addColorStop(1, '#6B4423');
  ctx.fillStyle = grad;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();

  // Bark lines
  ctx.strokeStyle = '#5D3A1A';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  const segs = Math.floor(w / (TILE * 0.55));
  for (let i = 1; i < segs; i++) {
    const lx = x + (w / segs) * i;
    ctx.beginPath();
    ctx.moveTo(lx, y + 5);
    ctx.lineTo(lx, y + h - 5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // End cap rings
  const capR = h * 0.42;
  for (const capX of [x + capR + 1, x + w - capR - 1]) {
    // Ring base
    ctx.fillStyle = '#7B4F2E';
    ctx.beginPath();
    ctx.ellipse(capX, y + h / 2, capR, capR, 0, 0, Math.PI * 2);
    ctx.fill();
    // Inner ring
    ctx.fillStyle = '#A0682A';
    ctx.beginPath();
    ctx.ellipse(capX, y + h / 2, capR * 0.65, capR * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    // Center
    ctx.fillStyle = '#6B4423';
    ctx.beginPath();
    ctx.ellipse(capX, y + h / 2, capR * 0.28, capR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPlayer() {
  if (!player.alive) {
    const t = player.deathAnim;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t * 0.85);
    ctx.translate(player.x, player.y);
    const scale = 1 + t * 0.6;
    ctx.scale(scale, scale);
    ctx.rotate(t * Math.PI * 0.5);
    const emoji = player.deathCause === 'car' ? '💥'
                : player.deathCause === 'drown' ? '💧'
                : '😴';
    drawEmoji(emoji, 0, 0, TILE * PLAYER_SIZE);
    ctx.restore();
    return;
  }

  // Hop arc
  let yOff = 0;
  if (player.isMoving) {
    yOff = -Math.sin(player.hopAnim * Math.PI) * TILE * 0.45;
  }

  // Bump shake (draw offset only, never mutate player position)
  let bumpDX = 0, bumpDY = 0;
  if (bumpT > 0) {
    const bumpOff = Math.sin(bumpT * Math.PI * 4) * 3 * bumpT;
    const bumpDir = player.faceDir;
    bumpDX = (bumpDir === DIRS.RIGHT ? 1 : bumpDir === DIRS.LEFT ? -1 : 0) * bumpOff;
    bumpDY = (bumpDir === DIRS.UP ? -1 : bumpDir === DIRS.DOWN ? 1 : 0) * bumpOff;
  }

  const drawX = player.x + bumpDX;
  const drawY = player.y + bumpDY;

  // Shadow
  const shadowAlpha = player.isMoving
    ? 0.2 - Math.sin(player.hopAnim * Math.PI) * 0.12
    : 0.22;
  const shadowScaleX = player.isMoving ? 0.6 + Math.sin(player.hopAnim * Math.PI) * 0.3 : 0.7;
  ctx.save();
  ctx.globalAlpha = shadowAlpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(drawX, drawY + TILE * 0.32,
    TILE * PLAYER_SIZE * 0.32 * shadowScaleX,
    TILE * PLAYER_SIZE * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Character
  ctx.save();
  ctx.translate(drawX, drawY + yOff);

  // Squash-stretch
  const hop = player.isMoving ? Math.sin(player.hopAnim * Math.PI) : 0;
  const scaleX = 1 - hop * 0.18;
  const scaleY = 1 + hop * 0.28;
  ctx.scale(scaleX, scaleY);

  // Mirror for left movement
  if (player.faceDir === DIRS.LEFT) ctx.scale(-1, 1);

  drawEmoji('🐣', 0, 0, TILE * PLAYER_SIZE);
  ctx.restore();
}

function drawEmoji(emoji, x, y, size) {
  ctx.save();
  ctx.font = `${Math.round(size)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y);
  ctx.restore();
}

// ─── Coin popup ───────────────────────────────────────────────────────────────
function spawnCoinPopup(x, y) {
  const el = document.createElement('div');
  el.className = 'coin-popup';
  el.textContent = '+1 🪙';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.getElementById('game-wrapper').appendChild(el);
  setTimeout(() => el.remove(), 850);
}

// ─── HUD ──────────────────────────────────────────────────────────────────────
function updateHUD() {
  document.getElementById('hud-score').textContent = score;
  document.getElementById('hud-coins').textContent = coins;
  document.getElementById('hud-best').textContent = '최고: ' + bestScore;
}

// ─── Overlay helpers ──────────────────────────────────────────────────────────
function showOverlay(id) {
  document.getElementById(id).classList.add('visible');
}
function hideOverlay(id) {
  document.getElementById(id).classList.remove('visible');
}

// ─── Game lifecycle ───────────────────────────────────────────────────────────
function initWorld() {
  world = [];
  cameraY = 0;
  targetCameraY = 0;
  // Safe grass start
  for (let i = 0; i <= 4; i++) {
    world.push({ type: LANE_TYPES.GRASS, entities: [], coins: [] });
  }
  // Pre-generate ahead
  for (let i = 5; i < 35; i++) {
    world.push(generateLane(i));
  }
}

function startGame() {
  if(typeof Leaderboard!=='undefined')Leaderboard.hide();
  score = 0;
  coins = 0;
  totalCoins = 0;
  inputQueue = [];
  bumpT = 0;

  initWorld();
  initPlayer();
  updateHUD();

  state = State.PLAYING;

  hideOverlay('start-screen');
  hideOverlay('gameover-screen');
  hideOverlay('pause-screen');
  hideOverlay('howto-screen');
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('mobile-controls').classList.remove('hidden');
  document.getElementById('pause-btn').classList.remove('hidden');
  document.getElementById('idle-warning').classList.remove('visible');
}

function pauseGame() {
  if (state !== State.PLAYING) return;
  state = State.PAUSED;
  document.getElementById('pause-score-val').textContent = score + '점';
  document.getElementById('pause-btn').classList.add('hidden');
  showOverlay('pause-screen');
}

function resumeGame() {
  if (state !== State.PAUSED) return;
  state = State.PLAYING;
  hideOverlay('pause-screen');
  document.getElementById('pause-btn').classList.remove('hidden');
  lastTime = performance.now();
}

function quitToMenu() {
  state = State.IDLE;
  hideOverlay('gameover-screen');
  hideOverlay('pause-screen');
  document.getElementById('hud').style.display = 'none';
  document.getElementById('mobile-controls').classList.add('hidden');
  document.getElementById('pause-btn').classList.add('hidden');
  document.getElementById('idle-warning').classList.remove('visible');

  initWorld();
  initPlayer();

  document.getElementById('start-best-score').textContent = bestScore;
  showOverlay('start-screen');
}

function showGameOver() {
  state = State.GAMEOVER;
  if(typeof Leaderboard!=='undefined')Leaderboard.ready('crossy',score);
  document.getElementById('idle-warning').classList.remove('visible');
  document.getElementById('pause-btn').classList.add('hidden');

  const isNewBest = score > bestScore;
  if (isNewBest) {
    bestScore = score;
    localStorage.setItem('crossy_best', bestScore);
  }

  document.getElementById('go-score').textContent = score;
  document.getElementById('go-best').textContent = bestScore;
  document.getElementById('go-coins').textContent = totalCoins;

  const gobestEl = document.getElementById('go-best');
  const badgeEl = document.getElementById('new-record-badge');
  if (isNewBest && score > 0) {
    gobestEl.classList.add('new-best');
    badgeEl.classList.remove('hidden');
  } else {
    gobestEl.classList.remove('new-best');
    badgeEl.classList.add('hidden');
  }

  const iconMap = { car: '🚗', drown: '🌊', idle: '😴' };
  document.getElementById('gameover-icon').textContent = iconMap[player.deathCause] || '💥';

  showOverlay('gameover-screen');
  document.getElementById('start-best-score').textContent = bestScore;
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  if (state === State.PLAYING) {
    updateCamera(dt);
    updateEntities(dt);
    updatePlayer(dt);
  } else if (state === State.GAMEOVER) {
    updatePlayer(dt);
  } else if (state === State.IDLE) {
    // Slow background drift
    updateCamera(dt * 0.25);
    updateEntities(dt * 0.25);
  }

  drawGame();
  requestAnimationFrame(gameLoop);
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
function boot() {
  resize();

  window.addEventListener('resize', () => {
    resize();
  });

  setupInput();

  initWorld();
  initPlayer();
  state = State.IDLE;

  document.getElementById('start-best-score').textContent = bestScore;
  document.getElementById('hud-best').textContent = '최고: ' + bestScore;

  showOverlay('start-screen');
  document.getElementById('hud').style.display = 'none';
  document.getElementById('mobile-controls').classList.add('hidden');
  document.getElementById('pause-btn').classList.add('hidden');

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('DOMContentLoaded', boot);
