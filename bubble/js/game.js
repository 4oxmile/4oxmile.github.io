(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────
  const COLORS = [
    '#EF4444', // red
    '#3B82F6', // blue
    '#22C55E', // green
    '#F59E0B', // yellow
    '#A855F7', // purple
    '#EC4899', // pink
  ];

  const BUBBLE_RADIUS = 16;
  const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
  const ROW_HEIGHT = BUBBLE_DIAMETER * 0.866; // sqrt(3)/2
  const SHOOT_SPEED = 14;
  const MIN_MATCH = 3;
  const INITIAL_ROWS = 5;
  const SHOTS_PER_PUSH = 5; // push rows down every N shots

  // ─── DOM ────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('nextBubbleCanvas');
  const nextCtx = nextCanvas.getContext('2d');
  const wrapper = document.getElementById('canvas-wrapper');

  const scoreEl = document.getElementById('score-val');
  const levelEl = document.getElementById('level-val');
  const bestEl = document.getElementById('best-val');

  const overlayStart = document.getElementById('overlay-start');
  const overlayPause = document.getElementById('overlay-pause');
  const overlayLose = document.getElementById('overlay-lose');

  const btnStart = document.getElementById('btn-start');
  const btnResume = document.getElementById('btn-resume');
  const btnQuit = document.getElementById('btn-quit');
  const btnRestart = document.getElementById('btn-restart');

  // ─── State ──────────────────────────────────────────────
  let grid = []; // grid[row][col] = colorIndex or -1
  let cols, rows;
  let score, level, best, shotCount;
  let shooterBubble, nextBubbleColor;
  let aimAngle = -Math.PI / 2;
  let shooterX, shooterY;
  let flying = null; // { x, y, dx, dy, color }
  let state = 'start'; // start, playing, paused, over
  let animFrame;
  let particles = [];
  let fallingBubbles = [];
  let pushOffset = 0; // pixel offset for smooth push animation
  let rowOffset = 0;  // tracks parity across row pushes

  // ─── Init ───────────────────────────────────────────────
  best = parseInt(localStorage.getItem('bubble_best') || '0', 10);
  bestEl.textContent = best;

  function resize() {
    const rect = wrapper.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    cols = Math.floor(w / BUBBLE_DIAMETER);
    rows = Math.floor(h / ROW_HEIGHT) + 2;
    shooterX = w / 2;
    shooterY = h - BUBBLE_RADIUS - 10;
  }

  resize();
  window.addEventListener('resize', () => {
    resize();
    if (state === 'playing') draw();
  });

  // ─── Grid helpers ───────────────────────────────────────
  function isOddRow(r) {
    return (r + rowOffset) % 2 === 1;
  }

  function getColCount(r) {
    return isOddRow(r) ? cols - 1 : cols;
  }

  function bubbleX(r, c) {
    const offset = isOddRow(r) ? BUBBLE_RADIUS : 0;
    return BUBBLE_RADIUS + c * BUBBLE_DIAMETER + offset;
  }

  function bubbleY(r) {
    return BUBBLE_RADIUS + r * ROW_HEIGHT + pushOffset;
  }

  function randomColor() {
    // Only pick from colors currently on the board
    const active = new Set();
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] >= 0) active.add(grid[r][c]);
      }
    }
    if (active.size === 0) {
      return Math.floor(Math.random() * Math.min(3 + level, COLORS.length));
    }
    const arr = [...active];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function initGrid() {
    grid = [];
    const numColors = Math.min(3 + level, COLORS.length);
    for (let r = 0; r < INITIAL_ROWS + level - 1; r++) {
      const cc = getColCount(r);
      const row = [];
      for (let c = 0; c < cc; c++) {
        row.push(Math.floor(Math.random() * numColors));
      }
      grid.push(row);
    }
    // Fill remaining rows as empty
    const totalRows = rows;
    while (grid.length < totalRows) {
      grid.push(new Array(getColCount(grid.length)).fill(-1));
    }
  }

  function getNeighbors(r, c) {
    const neighbors = [];
    const odd = isOddRow(r);
    // Same row
    if (c > 0) neighbors.push([r, c - 1]);
    if (c < getColCount(r) - 1) neighbors.push([r, c + 1]);
    // Row above
    if (r > 0) {
      if (odd) {
        if (c < getColCount(r - 1)) neighbors.push([r - 1, c]);
        if (c + 1 < getColCount(r - 1)) neighbors.push([r - 1, c + 1]);
      } else {
        if (c - 1 >= 0) neighbors.push([r - 1, c - 1]);
        if (c < getColCount(r - 1)) neighbors.push([r - 1, c]);
      }
    }
    // Row below
    if (r < grid.length - 1) {
      if (odd) {
        if (c < getColCount(r + 1)) neighbors.push([r + 1, c]);
        if (c + 1 < getColCount(r + 1)) neighbors.push([r + 1, c + 1]);
      } else {
        if (c - 1 >= 0) neighbors.push([r + 1, c - 1]);
        if (c < getColCount(r + 1)) neighbors.push([r + 1, c]);
      }
    }
    return neighbors;
  }

  // ─── Find matching cluster ──────────────────────────────
  function findCluster(r, c, color) {
    const visited = new Set();
    const queue = [[r, c]];
    const cluster = [];
    visited.add(r + ',' + c);

    while (queue.length) {
      const [cr, cc] = queue.shift();
      if (cr < 0 || cr >= grid.length) continue;
      if (cc < 0 || cc >= getColCount(cr)) continue;
      if (grid[cr][cc] !== color) continue;
      cluster.push([cr, cc]);
      for (const [nr, nc] of getNeighbors(cr, cc)) {
        const key = nr + ',' + nc;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push([nr, nc]);
        }
      }
    }
    return cluster;
  }

  // ─── Find floating (orphan) bubbles ─────────────────────
  function findFloating() {
    const connected = new Set();
    const queue = [];

    // Start from top row
    for (let c = 0; c < getColCount(0); c++) {
      if (grid[0][c] >= 0) {
        queue.push([0, c]);
        connected.add('0,' + c);
      }
    }

    while (queue.length) {
      const [cr, cc] = queue.shift();
      for (const [nr, nc] of getNeighbors(cr, cc)) {
        const key = nr + ',' + nc;
        if (!connected.has(key) && nr >= 0 && nr < grid.length && nc >= 0 && nc < getColCount(nr) && grid[nr][nc] >= 0) {
          connected.add(key);
          queue.push([nr, nc]);
        }
      }
    }

    const floating = [];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] >= 0 && !connected.has(r + ',' + c)) {
          floating.push([r, c]);
        }
      }
    }
    return floating;
  }

  // ─── Snap flying bubble to grid ─────────────────────────
  function snapToGrid(x, y) {
    let bestR = 0, bestC = 0, bestDist = Infinity;
    for (let r = 0; r < grid.length; r++) {
      const cc = getColCount(r);
      for (let c = 0; c < cc; c++) {
        if (grid[r][c] >= 0) continue;
        const bx = bubbleX(r, c);
        const by = bubbleY(r);
        const dist = Math.hypot(x - bx, y - by);
        if (dist < bestDist) {
          bestDist = dist;
          bestR = r;
          bestC = c;
        }
      }
    }
    return [bestR, bestC];
  }

  // ─── Particles ──────────────────────────────────────────
  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particles.push({
        x, y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        color,
        radius: 2 + Math.random() * 3,
      });
    }
  }

  // ─── Push rows down ─────────────────────────────────────
  function pushRowsDown() {
    // Flip rowOffset so existing rows keep their parity after index shift
    rowOffset = (rowOffset + 1) % 2;

    const numColors = Math.min(3 + level, COLORS.length);
    const cc = getColCount(0); // column count for new row 0 (uses updated rowOffset)
    const freshRow = [];
    for (let c = 0; c < cc; c++) {
      freshRow.push(Math.floor(Math.random() * numColors));
    }
    grid.unshift(freshRow);

    // Trim to prevent grid from growing beyond screen
    if (grid.length > rows) {
      grid.pop();
    }
  }

  // ─── Check game over ───────────────────────────────────
  function checkGameOver() {
    // Game over if any bubble is at or below the shooter line
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] >= 0) {
          const by = bubbleY(r);
          if (by + BUBBLE_RADIUS >= shooterY - BUBBLE_RADIUS) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // ─── Check level clear ─────────────────────────────────
  function checkLevelClear() {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] >= 0) return false;
      }
    }
    return true;
  }

  // ─── Drawing ────────────────────────────────────────────
  function drawBubble(context, x, y, colorIdx, radius) {
    radius = radius || BUBBLE_RADIUS;
    const color = COLORS[colorIdx];
    if (!color) return;

    context.beginPath();
    context.arc(x, y, radius - 1, 0, Math.PI * 2);

    const grad = context.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
    grad.addColorStop(0, lightenColor(color, 40));
    grad.addColorStop(1, color);
    context.fillStyle = grad;
    context.fill();

    // Shine
    context.beginPath();
    context.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.25, 0, Math.PI * 2);
    context.fillStyle = 'rgba(255,255,255,0.3)';
    context.fill();
  }

  function lightenColor(hex, percent) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (num >> 16) + percent);
    const g = Math.min(255, ((num >> 8) & 0xFF) + percent);
    const b = Math.min(255, (num & 0xFF) + percent);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  function drawAimLine() {
    const color = COLORS[shooterBubble] || '#3B82F6';
    const dotCount = 8;
    const dotSpacing = 18;
    ctx.save();
    for (let i = 1; i <= dotCount; i++) {
      const t = i / dotCount;
      const x = shooterX + Math.cos(aimAngle) * dotSpacing * i;
      const y = shooterY + Math.sin(aimAngle) * dotSpacing * i;
      const radius = 3.5 - i * 0.3;
      const alpha = 0.8 - t * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(radius, 1.5), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid bubbles
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c] >= 0) {
          drawBubble(ctx, bubbleX(r, c), bubbleY(r), grid[r][c]);
        }
      }
    }

    // Draw falling bubbles
    for (const fb of fallingBubbles) {
      drawBubble(ctx, fb.x, fb.y, fb.color);
    }

    // Draw flying bubble
    if (flying) {
      drawBubble(ctx, flying.x, flying.y, flying.color);
    }

    // Draw particles
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
      ctx.fillStyle = COLORS[p.color] || p.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw shooter bubble
    if (!flying && state === 'playing') {
      drawBubble(ctx, shooterX, shooterY, shooterBubble);
      drawAimLine();
    }

    // Danger line
    const dangerY = shooterY - BUBBLE_RADIUS * 3;
    ctx.strokeStyle = 'rgba(239,68,68,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, dangerY);
    ctx.lineTo(canvas.width, dangerY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawNextBubble() {
    nextCtx.clearRect(0, 0, 40, 40);
    drawBubble(nextCtx, 20, 20, nextBubbleColor, 16);
  }

  // ─── Game loop ──────────────────────────────────────────
  function update() {
    if (state !== 'playing') return;

    // Process held keys
    if (keysDown['ArrowLeft']) aimLeft();
    if (keysDown['ArrowRight']) aimRight();

    // Update flying bubble
    if (flying) {
      flying.x += flying.dx;
      flying.y += flying.dy;

      // Wall bounces
      if (flying.x - BUBBLE_RADIUS <= 0) {
        flying.x = BUBBLE_RADIUS;
        flying.dx = Math.abs(flying.dx);
      }
      if (flying.x + BUBBLE_RADIUS >= canvas.width) {
        flying.x = canvas.width - BUBBLE_RADIUS;
        flying.dx = -Math.abs(flying.dx);
      }

      // Check collision with ceiling
      if (flying.y - BUBBLE_RADIUS <= 0) {
        flying.y = BUBBLE_RADIUS;
        placeBubble();
        return;
      }

      // Check collision with grid bubbles
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          if (grid[r][c] < 0) continue;
          const bx = bubbleX(r, c);
          const by = bubbleY(r);
          const dist = Math.hypot(flying.x - bx, flying.y - by);
          if (dist < BUBBLE_DIAMETER - 2) {
            placeBubble();
            return;
          }
        }
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.dx;
      p.y += p.dy;
      p.dy += 0.15;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Update falling bubbles
    for (let i = fallingBubbles.length - 1; i >= 0; i--) {
      const fb = fallingBubbles[i];
      fb.y += fb.dy;
      fb.dy += 0.5;
      fb.x += fb.dx;
      if (fb.y > canvas.height + 50) {
        fallingBubbles.splice(i, 1);
      }
    }
  }

  function placeBubble() {
    const [r, c] = snapToGrid(flying.x, flying.y);

    // Ensure the grid row exists
    while (grid.length <= r) {
      grid.push(new Array(getColCount(grid.length)).fill(-1));
    }

    grid[r][c] = flying.color;
    flying = null;

    // Find matching cluster
    const cluster = findCluster(r, c, grid[r][c]);

    if (cluster.length >= MIN_MATCH) {
      // Pop matched bubbles
      for (const [cr, cc] of cluster) {
        spawnParticles(bubbleX(cr, cc), bubbleY(cr), grid[cr][cc], 6);
        grid[cr][cc] = -1;
      }
      score += cluster.length * 10;

      // Find and drop floating bubbles
      const floating = findFloating();
      for (const [fr, fc] of floating) {
        fallingBubbles.push({
          x: bubbleX(fr, fc),
          y: bubbleY(fr),
          dx: (Math.random() - 0.5) * 2,
          dy: -1 - Math.random() * 2,
          color: grid[fr][fc],
        });
        spawnParticles(bubbleX(fr, fc), bubbleY(fr), grid[fr][fc], 3);
        grid[fr][fc] = -1;
      }
      score += floating.length * 15;

      // Level clear check
      if (checkLevelClear()) {
        level++;
        score += 100 * level;
        updateUI();
        initGrid();
        shotCount = 0;
        shooterBubble = randomColor();
        nextBubbleColor = randomColor();
        drawNextBubble();
        return;
      }
    }

    // Increment shot count and push rows
    shotCount++;
    if (shotCount >= SHOTS_PER_PUSH) {
      shotCount = 0;
      pushRowsDown();
    }

    // Game over check
    if (checkGameOver()) {
      endGame();
      return;
    }

    // Next bubble
    shooterBubble = nextBubbleColor;
    nextBubbleColor = randomColor();
    drawNextBubble();
    updateUI();
  }

  function shoot() {
    if (flying || state !== 'playing') return;
    flying = {
      x: shooterX,
      y: shooterY,
      dx: Math.cos(aimAngle) * SHOOT_SPEED,
      dy: Math.sin(aimAngle) * SHOOT_SPEED,
      color: shooterBubble,
    };
  }

  // ─── Game control ───────────────────────────────────────
  function startGame() {
    score = 0;
    level = 1;
    shotCount = 0;
    pushOffset = 0;
    rowOffset = 0;
    particles = [];
    fallingBubbles = [];
    flying = null;
    resize();
    initGrid();
    shooterBubble = randomColor();
    nextBubbleColor = randomColor();
    drawNextBubble();
    updateUI();
    state = 'playing';
    hideAllOverlays();
    if(typeof Leaderboard!=='undefined')Leaderboard.hide();
    gameLoop();
  }

  function endGame() {
    state = 'over';
    if (score > best) {
      best = score;
      localStorage.setItem('bubble_best', best);
    }
    document.getElementById('lose-score').textContent = score;
    document.getElementById('lose-level').textContent = level;
    document.getElementById('lose-best').textContent = best;
    bestEl.textContent = best;
    overlayLose.classList.remove('hidden');
    if(typeof Leaderboard!=='undefined')Leaderboard.ready('bubble',score);
  }

  function updateUI() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    bestEl.textContent = best;
  }

  function hideAllOverlays() {
    overlayStart.classList.add('hidden');
    overlayPause.classList.add('hidden');
    overlayLose.classList.add('hidden');
  }

  function gameLoop() {
    if (state !== 'playing') return;
    update();
    draw();
    animFrame = requestAnimationFrame(gameLoop);
  }

  // ─── Input handling ─────────────────────────────────────
  const AIM_STEP = 0.04;
  const AIM_MIN = -Math.PI + 0.1;
  const AIM_MAX = -0.1;

  function aimLeft() {
    aimAngle = Math.max(aimAngle - AIM_STEP, AIM_MIN);
  }
  function aimRight() {
    aimAngle = Math.min(aimAngle + AIM_STEP, AIM_MAX);
  }

  // Touch/mouse aim + shoot on canvas
  function getAngle(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let angle = Math.atan2(y - shooterY, x - shooterX);
    if (angle > AIM_MAX) angle = AIM_MAX;
    if (angle < AIM_MIN) angle = AIM_MIN;
    return angle;
  }

  let aiming = false;

  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'playing') return;
    e.preventDefault();
    aiming = true;
    aimAngle = getAngle(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!aiming || state !== 'playing') return;
    e.preventDefault();
    aimAngle = getAngle(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!aiming || state !== 'playing') return;
    e.preventDefault();
    aiming = false;
    aimAngle = getAngle(e.clientX, e.clientY);
    shoot();
  });

  // Keyboard — hold to repeat
  const keysDown = {};

  document.addEventListener('keydown', (e) => {
    if (state === 'playing') {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        keysDown[e.key] = true;
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        shoot();
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        state = 'paused';
        overlayPause.classList.remove('hidden');
      }
    } else if (state === 'paused') {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        resumeGame();
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    delete keysDown[e.key];
  });

  // On-screen buttons — repeat while held
  const btnLeft = document.getElementById('btn-left');
  const btnRight = document.getElementById('btn-right');
  const btnShoot = document.getElementById('btn-shoot');

  function setupRepeatButton(btn, action) {
    let interval = null;
    function start(e) {
      e.preventDefault();
      if (state !== 'playing') return;
      action();
      clearInterval(interval);
      interval = setInterval(() => {
        if (state !== 'playing') { clearInterval(interval); return; }
        action();
      }, 60);
    }
    function stop(e) {
      e.preventDefault();
      clearInterval(interval);
      interval = null;
    }
    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('pointercancel', stop);
  }

  setupRepeatButton(btnLeft, aimLeft);
  setupRepeatButton(btnRight, aimRight);

  btnShoot.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    shoot();
  });

  function resumeGame() {
    overlayPause.classList.add('hidden');
    state = 'playing';
    gameLoop();
  }

  // ─── Button handlers ────────────────────────────────────
  btnStart.addEventListener('click', startGame);
  btnRestart.addEventListener('click', startGame);
  btnResume.addEventListener('click', resumeGame);
  btnQuit.addEventListener('click', () => {
    state = 'start';
    hideAllOverlays();
    overlayStart.classList.remove('hidden');
    cancelAnimationFrame(animFrame);
  });

  // ─── Leaderboard ────────────────────────────────────────
  if (typeof window.loadScores === 'function') {
    window.loadScores('bubble');
  }
})();
