/* ═══════════════════════════════════════════════════════
   GRAVITY RUNNER — game.js
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── DOM refs ── */
  const canvas   = document.getElementById('game-canvas');
  const ctx      = canvas.getContext('2d');
  const hudScore = document.getElementById('hud-score');
  const hudBest  = document.getElementById('hud-best');
  const pauseBtn = document.getElementById('pause-btn');
  const toast    = document.getElementById('milestone-toast');

  /* Overlays */
  const startOverlay  = document.getElementById('start-overlay');
  const gameOverOverlay = document.getElementById('gameover-overlay');
  const pauseOverlay  = document.getElementById('pause-overlay');

  /* GameOver overlay elements */
  const goScore    = document.getElementById('go-score');
  const goHiScore  = document.getElementById('go-hi-score');
  const newRecordBadge = document.getElementById('new-record-badge');

  /* Start overlay hi-score */
  const startHiScore = document.getElementById('start-hi-score');

  /* Pause overlay score */
  const pauseScoreSpan = document.getElementById('pause-score-val');

  /* ── Constants ── */
  const PLAYER_SIZE   = 22;
  const WALL_THICK    = 28;        // floor/ceiling thickness
  const GRAVITY_BASE  = 0.55;
  const JUMP_FORCE    = -12;       // applied when flipping to ceiling
  const SPEED_INIT    = 4.5;
  const SPEED_MAX     = 12;
  const SPEED_INC     = 0.0008;    // per frame
  const OBS_MIN_H     = 18;
  const OBS_MAX_H     = 90;
  const OBS_WIDTH     = 22;
  const GAP_WIDTH_MIN = 55;
  const GAP_WIDTH_MAX = 120;
  const PARTICLE_MAX  = 80;
  const MILESTONE_SCORES = [100, 250, 500, 1000, 2000, 3500, 5000];

  /* ── State ── */
  let W, H;            // canvas logical size
  let state = 'start'; // 'start' | 'playing' | 'paused' | 'dead'
  let score = 0;
  let hiScore = parseInt(localStorage.getItem('gravity_hi') || '0', 10);
  let speed = SPEED_INIT;
  let frame = 0;
  let lastMilestone = -1;
  let toastTimer = null;
  let colorPhase = 0;   // 0-6 colour shift index
  let animId = null;

  /* Player */
  let player = {};

  /* Obstacle / gap segments on floor and ceiling */
  // Each item: { x, w, h, onCeiling }
  let obstacles = [];
  // Gap segments: { x, w, onCeiling }  — openings in the platform
  let gaps = [];

  /* Particles */
  let particles = [];

  /* Scroll offset for background parallax */
  let bgOffset = 0;

  /* ── Colour palettes per phase ── */
  const PALETTES = [
    { player: '#3B82F6', trail: '#60A5FA', obs: '#EF4444', wall: '#1E293B' },
    { player: '#8B5CF6', trail: '#A78BFA', obs: '#F59E0B', wall: '#1E1B2E' },
    { player: '#10B981', trail: '#34D399', obs: '#F472B6', wall: '#0F2018' },
    { player: '#F59E0B', trail: '#FCD34D', obs: '#6366F1', wall: '#1A1500' },
    { player: '#EC4899', trail: '#F9A8D4', obs: '#06B6D4', wall: '#1A0010' },
    { player: '#06B6D4', trail: '#67E8F9', obs: '#F97316', wall: '#001A1F' },
    { player: '#F97316', trail: '#FDBA74', obs: '#84CC16', wall: '#1A0900' },
  ];

  let palette = PALETTES[0];

  /* ── Resize ── */
  function resize() {
    const wrapper = document.getElementById('game-wrapper');
    const rect = wrapper.getBoundingClientRect();
    W = Math.floor(rect.width);
    H = Math.floor(rect.height);
    canvas.width  = W;
    canvas.height = H;
    if (state === 'start' || state === 'dead' || state === 'paused') {
      drawBackground();
    }
  }

  /* ── Init / reset ── */
  function initGame() {
    score        = 0;
    speed        = SPEED_INIT;
    frame        = 0;
    lastMilestone = -1;
    colorPhase   = 0;
    palette      = PALETTES[0];
    bgOffset     = 0;
    obstacles    = [];
    gaps         = [];
    particles    = [];
    nextObsX     = W + 100;

    player = {
      x: Math.floor(W * 0.2),
      y: H - WALL_THICK - PLAYER_SIZE,
      vy: 0,
      onCeiling: false,   // false = floor side
      flipProgress: 1,    // 1 = settled, 0-1 = flipping
      flipDir: 1,         // 1 = going to floor, -1 = going to ceiling
      dead: false,
    };

    updateHUD();
  }

  /* ── HUD ── */
  function updateHUD() {
    hudScore.textContent = Math.floor(score);
    hudBest.innerHTML = `최고 <span>${hiScore}</span>`;
  }

  /* ── Show overlay ── */
  function showOverlay(id) {
    [startOverlay, gameOverOverlay, pauseOverlay].forEach(o => o.classList.add('hidden'));
    if (id) document.getElementById(id).classList.remove('hidden');
  }

  /* ── Input handling ── */
  function handleFlip() {
    if (state !== 'playing') return;
    flipGravity();
  }

  function flipGravity() {
    player.onCeiling = !player.onCeiling;
    // Set velocity toward new surface
    player.vy = player.onCeiling ? Math.abs(JUMP_FORCE) : JUMP_FORCE;
    player.flipProgress = 0;
    player.flipDir = player.onCeiling ? -1 : 1;
    spawnFlipParticles();
  }

  /* ── Input listeners ── */
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (state === 'start') startGame();
      else if (state === 'playing') handleFlip();
      else if (state === 'dead') restartGame();
      else if (state === 'paused') resumeGame();
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === 'playing') pauseGame();
      else if (state === 'paused') resumeGame();
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state === 'start') startGame();
    else if (state === 'playing') handleFlip();
    else if (state === 'dead') restartGame();
    else if (state === 'paused') resumeGame();
  });

  pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  });

  /* Overlay buttons wired in HTML via onclick */
  window.startGame = function () {
    if (state !== 'start') return;
    if(typeof Leaderboard!=='undefined')Leaderboard.hide();
    showOverlay(null);
    state = 'playing';
    initGame();
    loop();
  };

  window.restartGame = function () {
    if (state !== 'dead') return;
    if(typeof Leaderboard!=='undefined')Leaderboard.hide();
    showOverlay(null);
    state = 'playing';
    initGame();
    loop();
  };

  window.pauseGame = function () {
    if (state !== 'playing') return;
    state = 'paused';
    pauseScoreSpan.textContent = Math.floor(score);
    showOverlay('pause-overlay');
    pauseBtn.textContent = '▶';
    if (animId) { cancelAnimationFrame(animId); animId = null; }
  };

  window.resumeGame = function () {
    if (state !== 'paused') return;
    state = 'playing';
    showOverlay(null);
    pauseBtn.textContent = '⏸';
    loop();
  };

  window.goToStart = function () {
    state = 'start';
    startHiScore.textContent = hiScore;
    showOverlay('start-overlay');
    pauseBtn.textContent = '⏸';
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    drawBackground();
  };

  /* ── Obstacle/Gap generation ── */
  let nextObsX = 0;

  function maybeSpawn() {
    // Keep a buffer of spawned content ahead of the screen
    const horizon = W + 300;

    if (nextObsX < horizon) {
      spawnSegment(nextObsX);
    }
  }

  function spawnSegment(x) {
    // Decide what goes on floor and ceiling for this zone
    const roll = Math.random();

    // Gap in floor?
    if (roll < 0.25) {
      const gw = rand(GAP_WIDTH_MIN, GAP_WIDTH_MAX);
      gaps.push({ x, w: gw, onCeiling: false });
      nextObsX = x + gw + rand(200, 350);
    }
    // Gap in ceiling?
    else if (roll < 0.45) {
      const gw = rand(GAP_WIDTH_MIN, GAP_WIDTH_MAX);
      gaps.push({ x, w: gw, onCeiling: true });
      nextObsX = x + gw + rand(200, 350);
    }
    // Obstacle on floor?
    else if (roll < 0.65) {
      const oh = rand(OBS_MIN_H, OBS_MAX_H);
      obstacles.push({ x, w: OBS_WIDTH, h: oh, onCeiling: false });
      nextObsX = x + OBS_WIDTH + rand(220, 380);
    }
    // Obstacle on ceiling?
    else if (roll < 0.80) {
      const oh = rand(OBS_MIN_H, OBS_MAX_H);
      obstacles.push({ x, w: OBS_WIDTH, h: oh, onCeiling: true });
      nextObsX = x + OBS_WIDTH + rand(220, 380);
    }
    // Double obstacle (one each)
    else if (roll < 0.93) {
      const oh1 = rand(OBS_MIN_H, OBS_MAX_H * 0.7);
      const oh2 = rand(OBS_MIN_H, OBS_MAX_H * 0.7);
      obstacles.push({ x, w: OBS_WIDTH, h: oh1, onCeiling: false });
      obstacles.push({ x, w: OBS_WIDTH, h: oh2, onCeiling: true });
      nextObsX = x + OBS_WIDTH + rand(260, 420);
    }
    // Paired gaps
    else {
      const gw = rand(GAP_WIDTH_MIN, GAP_WIDTH_MAX * 0.8);
      gaps.push({ x, w: gw, onCeiling: false });
      gaps.push({ x, w: gw, onCeiling: true });
      nextObsX = x + gw + rand(240, 380);
    }
  }

  /* ── Particles ── */
  function spawnFlipParticles() {
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: player.x + PLAYER_SIZE / 2,
        y: player.y + PLAYER_SIZE / 2,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 1,
        decay: 0.04 + Math.random() * 0.04,
        size: 3 + Math.random() * 4,
        color: palette.trail,
      });
    }
  }

  function spawnTrailParticle() {
    if (particles.length >= PARTICLE_MAX) return;
    particles.push({
      x: player.x,
      y: player.y + PLAYER_SIZE / 2 + (Math.random() - 0.5) * PLAYER_SIZE * 0.6,
      vx: -speed * 0.3 + (Math.random() - 0.5),
      vy: (Math.random() - 0.5) * 1.5,
      life: 0.7,
      decay: 0.05 + Math.random() * 0.04,
      size: 2 + Math.random() * 3,
      color: palette.trail,
    });
  }

  /* ── Death ── */
  function killPlayer() {
    if (player.dead) return;
    player.dead = true;
    state = 'dead';

    const finalScore = Math.floor(score);
    const isNewRecord = finalScore > hiScore;
    if (isNewRecord) {
      hiScore = finalScore;
      localStorage.setItem('gravity_hi', hiScore);
    }

    goScore.textContent = finalScore;
    goHiScore.textContent = hiScore;
    newRecordBadge.classList.toggle('hidden', !isNewRecord);

    startHiScore.textContent = hiScore;
    hudBest.innerHTML = `최고 <span>${hiScore}</span>`;

    if(typeof Leaderboard!=='undefined')Leaderboard.ready('gravity',finalScore,{});
    setTimeout(() => {
      showOverlay('gameover-overlay');
    }, 350);
  }

  /* ── Collision helpers ── */
  function playerRect() {
    const margin = 3; // slight forgiveness
    return {
      x1: player.x + margin,
      y1: player.y + margin,
      x2: player.x + PLAYER_SIZE - margin,
      y2: player.y + PLAYER_SIZE - margin,
    };
  }

  function rectsOverlap(a, b) {
    return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
  }

  /* ── Milestone toasts ── */
  function checkMilestones() {
    const s = Math.floor(score);
    for (let i = 0; i < MILESTONE_SCORES.length; i++) {
      if (s >= MILESTONE_SCORES[i] && lastMilestone < i) {
        lastMilestone = i;
        showToast(`🎉 ${MILESTONE_SCORES[i].toLocaleString()} 돌파!`);
        // Shift colour palette
        colorPhase = (colorPhase + 1) % PALETTES.length;
        palette = PALETTES[colorPhase];
        break;
      }
    }
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  /* ── Update ── */
  function update() {
    frame++;
    bgOffset += speed * 0.3;

    // Speed up
    speed = Math.min(SPEED_MAX, speed + SPEED_INC);

    // Score
    score += speed * 0.04;
    checkMilestones();
    updateHUD();

    // Player physics
    const gravity = player.onCeiling ? -GRAVITY_BASE : GRAVITY_BASE;
    player.vy += gravity;
    player.vy = Math.max(-18, Math.min(18, player.vy));
    player.y += player.vy;

    // Flip animation progress
    if (player.flipProgress < 1) {
      player.flipProgress = Math.min(1, player.flipProgress + 0.15);
    }

    // Clamp to walls
    const floorY  = H - WALL_THICK - PLAYER_SIZE;
    const ceilY   = WALL_THICK;

    if (!player.onCeiling && player.y >= floorY) {
      player.y  = floorY;
      player.vy = 0;
    }
    if (player.onCeiling && player.y <= ceilY) {
      player.y  = ceilY;
      player.vy = 0;
    }

    // Scroll obstacles & gaps
    obstacles.forEach(o => { o.x -= speed; });
    gaps.forEach(g => { g.x -= speed; });

    // Cull off-screen
    obstacles = obstacles.filter(o => o.x + o.w > -50);
    gaps      = gaps.filter(g => g.x + g.w > -50);

    // Spawn
    maybeSpawn();

    // Trail particle
    if (frame % 2 === 0) spawnTrailParticle();

    // Update particles
    particles.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.life -= p.decay;
    });
    particles = particles.filter(p => p.life > 0);

    // ── Collision detection ──

    // 1. Boundary (fall through floor / hit ceiling wall)
    if (player.y > floorY + 8 || player.y < ceilY - 8) {
      killPlayer(); return;
    }

    const pr = playerRect();

    // 2. Obstacles
    for (const o of obstacles) {
      const or = obstacleRect(o);
      if (rectsOverlap(pr, or)) { killPlayer(); return; }
    }

    // 3. Gaps — if player is resting on floor/ceiling and gap is beneath/above
    for (const g of gaps) {
      if (!g.onCeiling && !player.onCeiling) {
        // Player on floor side; check if they're in a gap area
        const playerLeft  = player.x;
        const playerRight = player.x + PLAYER_SIZE;
        const gapLeft  = g.x;
        const gapRight = g.x + g.w;
        const inGapX   = playerRight > gapLeft + 4 && playerLeft < gapRight - 4;
        const onFloor  = player.y >= floorY - 2;
        if (inGapX && onFloor) { killPlayer(); return; }
      }
      if (g.onCeiling && player.onCeiling) {
        const playerLeft  = player.x;
        const playerRight = player.x + PLAYER_SIZE;
        const gapLeft  = g.x;
        const gapRight = g.x + g.w;
        const inGapX   = playerRight > gapLeft + 4 && playerLeft < gapRight - 4;
        const onCeil   = player.y <= ceilY + 2;
        if (inGapX && onCeil) { killPlayer(); return; }
      }
    }
  }

  /* ── Obstacle rect ── */
  function obstacleRect(o) {
    if (o.onCeiling) {
      return { x1: o.x, y1: WALL_THICK, x2: o.x + o.w, y2: WALL_THICK + o.h };
    } else {
      return { x1: o.x, y1: H - WALL_THICK - o.h, x2: o.x + o.w, y2: H - WALL_THICK };
    }
  }

  /* ── Draw ── */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawGaps();
    drawWalls();
    drawObstacles();
    drawParticles();
    drawPlayer();
  }

  function drawBackground() {
    // Dark board fill
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--board-bg').trim() || '#0A0E14';
    ctx.fillRect(0, 0, W, H);

    // Subtle scrolling grid lines
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = palette.trail;
    ctx.lineWidth = 1;
    const gridSize = 60;
    const ox = bgOffset % gridSize;
    for (let x = -ox; x < W; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawWalls() {
    // Floor
    ctx.fillStyle = palette.wall;
    ctx.fillRect(0, H - WALL_THICK, W, WALL_THICK);

    // Ceiling
    ctx.fillRect(0, 0, W, WALL_THICK);

    // Wall edge highlights
    ctx.fillStyle = palette.player + '44';
    ctx.fillRect(0, H - WALL_THICK, W, 2);
    ctx.fillRect(0, WALL_THICK - 2, W, 2);
  }

  function drawGaps() {
    // Gaps punch holes in the wall — draw the gap as board background colour
    const boardBg = getComputedStyle(document.documentElement)
      .getPropertyValue('--board-bg').trim() || '#0A0E14';
    ctx.fillStyle = boardBg;

    gaps.forEach(g => {
      if (g.onCeiling) {
        ctx.fillRect(g.x, 0, g.w, WALL_THICK);
        // Danger tint at gap edge
        ctx.fillStyle = '#EF444422';
        ctx.fillRect(g.x, 0, g.w, WALL_THICK);
        ctx.fillStyle = boardBg;
      } else {
        ctx.fillRect(g.x, H - WALL_THICK, g.w, WALL_THICK);
        ctx.fillStyle = '#EF444422';
        ctx.fillRect(g.x, H - WALL_THICK, g.w, WALL_THICK);
        ctx.fillStyle = boardBg;
      }
    });
  }

  function drawObstacles() {
    obstacles.forEach(o => {
      const or = obstacleRect(o);
      const grd = ctx.createLinearGradient(or.x1, or.y1, or.x2, or.y2);
      grd.addColorStop(0, palette.obs);
      grd.addColorStop(1, palette.obs + 'BB');
      ctx.fillStyle = grd;
      ctx.beginPath();
      roundRect(ctx, or.x1, or.y1, o.w, or.y2 - or.y1, 4);
      ctx.fill();

      // Highlight edge
      ctx.fillStyle = '#ffffff22';
      ctx.fillRect(or.x1, or.y1, 2, or.y2 - or.y1);
    });
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawPlayer() {
    const cx = player.x + PLAYER_SIZE / 2;
    const cy = player.y + PLAYER_SIZE / 2;

    ctx.save();
    ctx.translate(cx, cy);

    // Visual flip: rotate 180° during the transition
    const flipAngle = player.onCeiling
      ? lerp(0, Math.PI, player.flipProgress)
      : lerp(Math.PI, 0, player.flipProgress);
    ctx.rotate(flipAngle);

    // Slight tilt wobble during flip
    const tilt = player.flipProgress < 1 ? Math.sin(player.flipProgress * Math.PI) * 0.2 : 0;
    ctx.rotate(tilt * player.flipDir * -1);

    // Squish/stretch on land
    const scaleY = player.flipProgress < 1
      ? lerp(1.3, 1, player.flipProgress)
      : 1 + Math.abs(player.vy) * 0.008;
    const scaleX = player.flipProgress < 1
      ? lerp(0.75, 1, player.flipProgress)
      : 1 / (1 + Math.abs(player.vy) * 0.008);
    ctx.scale(scaleX, scaleY);

    // Glow
    ctx.shadowColor = palette.player;
    ctx.shadowBlur  = 14;

    // Body gradient
    const half = PLAYER_SIZE / 2;
    const grd = ctx.createLinearGradient(-half, -half, half, half);
    grd.addColorStop(0, lighten(palette.player, 0.3));
    grd.addColorStop(1, palette.player);
    ctx.fillStyle = grd;

    // Rounded square body
    ctx.beginPath();
    roundRect(ctx, -half, -half, PLAYER_SIZE, PLAYER_SIZE, 5);
    ctx.fill();

    // "Eyes" always at top of local space (rotation handles orientation)
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    const eyeY = -half * 0.3;
    ctx.beginPath();
    ctx.arc(-half * 0.3, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(half * 0.3, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* ── Main loop ── */
  function loop() {
    if (state !== 'playing') return;
    update();
    draw();
    animId = requestAnimationFrame(loop);
  }

  /* ── Helpers ── */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function lighten(hex, amount) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const to255 = v => Math.min(255, Math.round(v + (255 - v) * amount));
    return `rgb(${to255(r)},${to255(g)},${to255(b)})`;
  }

  function roundRect(ctx, x, y, w, h, r) {
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
  }

  /* ── Init display ── */
  function initDisplay() {
    resize();
    startHiScore.textContent = hiScore;
    showOverlay('start-overlay');
    drawBackground();
  }

  window.addEventListener('resize', resize);
  initDisplay();

})();
