// ============================================================
//  SUPER MARIO — Side-Scrolling Platformer
// ============================================================
(function () {
  'use strict';

  // ── Tile size & scale ─────────────────────────────────────
  const T = 16;  // base tile size in world units
  const COLS = 28;
  const ROWS = 14;

  // ── Physics ───────────────────────────────────────────────
  const GRAVITY     = 0.45;
  const JUMP_VEL    = -8.2;
  const MOVE_SPEED  = 2.8;
  const MAX_FALL    = 8;
  const ENEMY_SPEED = 0.8;

  // ── Colors (pixel art palette) ────────────────────────────
  const COL = {
    sky:       '#5C94FC',
    ground:    '#C84C0C',
    groundTop: '#00A800',
    brick:     '#C84C0C',
    brickLine: '#A03800',
    qBlock:    '#FFB800',
    qBlockDot: '#E87000',
    pipe:      '#00A800',
    pipeDark:  '#006800',
    coin:      '#FFD700',
    coinDark:  '#E8A000',
    mario:     '#E52521',
    marioSkin: '#FFB899',
    marioPant: '#3B3BFF',
    marioShoe: '#6B3300',
    goomba:    '#C84C0C',
    goombaDk:  '#8B3000',
    goombaFoot:'#000',
    flag:      '#00A800',
    flagPole:  '#8B8B8B',
    white:     '#FCF8E8',
    cloud:     '#FFF',
    cloudShd:  'rgba(0,0,0,0.05)',
    hillGreen: '#00D800',
    hillDark:  '#00A800',
    bushGreen: '#00D800',
    bushDark:  '#00A800',
  };

  // ── Tile types ────────────────────────────────────────────
  const EMPTY   = 0;
  const GROUND  = 1;
  const BRICK   = 2;
  const QBLOCK  = 3;
  const PIPE_TL = 4;
  const PIPE_TR = 5;
  const PIPE_BL = 6;
  const PIPE_BR = 7;
  const FLAG    = 8;
  const USED    = 9;  // hit question block

  // ── Object types ──────────────────────────────────────────
  // Entities stored in arrays: coins, enemies, particles

  // ── Canvas ────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');
  let scale    = 1;
  let canvasW  = 0;
  let canvasH  = 0;
  let worldW   = COLS * T;  // updated per level

  function resize() {
    const area = document.querySelector('.canvas-area');
    canvas.width  = area.clientWidth;
    canvas.height = area.clientHeight;
    canvasW = canvas.width;
    canvasH = canvas.height;
    scale = canvasH / (ROWS * T);
  }
  resize();
  window.addEventListener('resize', () => {
    resize();
    if (state !== 'play') render();
  });

  // ── State ─────────────────────────────────────────────────
  let state     = 'idle';  // idle | play | dead | clear
  let score     = 0;
  let coins     = 0;
  let hiScore   = +(localStorage.getItem('mario_hi') || 0);
  let stageNum  = 1;
  let raf       = null;
  let levelData = [];
  let levelCols = 0;
  let worldCoins   = [];
  let enemies      = [];
  let particles    = [];
  let floatTexts   = [];
  let cameraX      = 0;

  document.getElementById('hiscoreVal').textContent = hiScore;
  document.getElementById('startHiscore').textContent = hiScore;

  // ── Level generation ──────────────────────────────────────
  function generateLevel(stage) {
    const length = 80 + stage * 20;
    levelCols = length;
    worldW = length * T;
    const grid = [];

    for (let r = 0; r < ROWS; r++) {
      grid[r] = new Array(length).fill(EMPTY);
    }

    // Ground (bottom 2 rows)
    const groundRow1 = ROWS - 1;
    const groundRow2 = ROWS - 2;

    // Create ground with gaps
    const gaps = [];
    for (let c = 0; c < length; c++) {
      grid[groundRow1][c] = GROUND;
      grid[groundRow2][c] = GROUND;
    }

    // Add gaps (pits)
    const numGaps = 2 + stage;
    for (let g = 0; g < numGaps; g++) {
      const gapStart = 15 + Math.floor(Math.random() * (length - 30));
      const gapLen = 2 + Math.floor(Math.random() * 2);
      // Check we don't overlap with other gaps or start/end
      let ok = gapStart > 10 && gapStart + gapLen < length - 10;
      for (const prev of gaps) {
        if (Math.abs(gapStart - prev.start) < 8) ok = false;
      }
      if (ok) {
        gaps.push({ start: gapStart, len: gapLen });
        for (let c = gapStart; c < gapStart + gapLen; c++) {
          grid[groundRow1][c] = EMPTY;
          grid[groundRow2][c] = EMPTY;
        }
      }
    }

    // Pipes
    const numPipes = 3 + Math.floor(stage * 0.5);
    const pipePositions = [];
    for (let p = 0; p < numPipes; p++) {
      const pc = 12 + Math.floor(Math.random() * (length - 20));
      const pHeight = 2 + Math.floor(Math.random() * 2);
      // Check no overlap with gaps
      let ok = true;
      for (const gap of gaps) {
        if (pc >= gap.start - 2 && pc <= gap.start + gap.len + 1) ok = false;
      }
      for (const prev of pipePositions) {
        if (Math.abs(pc - prev) < 5) ok = false;
      }
      if (ok) {
        pipePositions.push(pc);
        const baseRow = groundRow2;
        for (let h = 0; h < pHeight; h++) {
          const row = baseRow - h;
          if (row >= 0) {
            grid[row][pc]     = h === pHeight - 1 ? PIPE_TL : PIPE_BL;
            grid[row][pc + 1] = h === pHeight - 1 ? PIPE_TR : PIPE_BR;
          }
        }
      }
    }

    // Brick and question block platforms
    const numPlatforms = 5 + stage * 2;
    for (let p = 0; p < numPlatforms; p++) {
      const pc = 8 + Math.floor(Math.random() * (length - 16));
      const pr = 6 + Math.floor(Math.random() * 3);  // rows 6-8
      const plen = 2 + Math.floor(Math.random() * 4);
      for (let c = pc; c < pc + plen && c < length; c++) {
        if (grid[pr][c] === EMPTY) {
          // Mix of bricks and question blocks
          grid[pr][c] = Math.random() < 0.3 ? QBLOCK : BRICK;
        }
      }
    }

    // Standalone question blocks
    const numQ = 3 + stage;
    for (let q = 0; q < numQ; q++) {
      const qc = 6 + Math.floor(Math.random() * (length - 12));
      const qr = 7 + Math.floor(Math.random() * 2);
      if (grid[qr][qc] === EMPTY) {
        grid[qr][qc] = QBLOCK;
      }
    }

    // Flag at end
    grid[groundRow2 - 1][length - 4] = FLAG;
    grid[groundRow2 - 2][length - 4] = FLAG;
    grid[groundRow2 - 3][length - 4] = FLAG;
    grid[groundRow2 - 4][length - 4] = FLAG;
    grid[groundRow2 - 5][length - 4] = FLAG;
    grid[groundRow2 - 6][length - 4] = FLAG;

    // Generate coin positions
    worldCoins = [];
    for (let c = 8; c < length - 8; c++) {
      if (Math.random() < 0.06) {
        // Find a good row for the coin
        let cr = -1;
        for (let r = 4; r < ROWS - 3; r++) {
          if (grid[r][c] === EMPTY && grid[r + 1][c] === EMPTY) {
            cr = r;
            break;
          }
        }
        if (cr >= 0) {
          worldCoins.push({ x: c * T + 4, y: cr * T + 2, w: 8, h: 12, collected: false, animT: Math.random() * Math.PI * 2 });
        }
      }
    }

    // Generate enemies
    enemies = [];
    const numEnemies = 5 + stage * 3;
    for (let e = 0; e < numEnemies; e++) {
      const ec = 15 + Math.floor(Math.random() * (length - 25));
      // Make sure on ground
      let onGround = grid[groundRow1][ec] === GROUND;
      if (onGround) {
        // Check not in a pipe
        let blocked = false;
        for (let r = groundRow2 - 3; r <= groundRow2; r++) {
          const tile = grid[r] ? grid[r][ec] : 0;
          if (tile >= PIPE_TL && tile <= PIPE_BR) blocked = true;
        }
        if (!blocked) {
          enemies.push({
            x: ec * T, y: (groundRow2 - 1) * T,
            w: T, h: T,
            vx: -ENEMY_SPEED,
            alive: true,
            squishT: 0,
            animT: 0,
          });
        }
      }
    }

    return grid;
  }

  // ── Mario ─────────────────────────────────────────────────
  const mario = {
    x: 0, y: 0,
    vx: 0, vy: 0,
    w: 14, h: 16,
    grounded: false,
    facing: 1,  // 1=right, -1=left
    animT: 0,
    invincT: 0,
    dead: false,

    reset() {
      this.x = 3 * T;
      this.y = (ROWS - 4) * T;
      this.vx = 0;
      this.vy = 0;
      this.grounded = false;
      this.facing = 1;
      this.animT = 0;
      this.invincT = 0;
      this.dead = false;
    },

    update() {
      if (this.dead) {
        this.vy += GRAVITY;
        this.y += this.vy;
        return;
      }

      // Horizontal movement
      if (keys.left)  { this.vx = -MOVE_SPEED; this.facing = -1; }
      else if (keys.right) { this.vx = MOVE_SPEED; this.facing = 1; }
      else { this.vx = 0; }

      // Jump
      if (keys.jump && this.grounded) {
        this.vy = JUMP_VEL;
        this.grounded = false;
        playJump();
      }

      // Gravity
      this.vy += GRAVITY;
      if (this.vy > MAX_FALL) this.vy = MAX_FALL;

      // Move horizontally
      this.x += this.vx;
      this.resolveH();

      // Move vertically
      this.y += this.vy;
      this.resolveV();

      // Camera boundary
      if (this.x < 0) this.x = 0;

      // Animation
      if (this.grounded && this.vx !== 0) {
        this.animT += 0.15;
      } else {
        this.animT = 0;
      }

      // Invincibility
      if (this.invincT > 0) this.invincT--;

      // Fell off
      if (this.y > ROWS * T + 32) {
        die();
      }
    },

    resolveH() {
      const tiles = getTilesAround(this.x, this.y, this.w, this.h);
      for (const t of tiles) {
        if (!isSolid(t.type)) continue;
        const tx = t.col * T, ty = t.row * T;
        if (this.x + this.w > tx && this.x < tx + T &&
            this.y + this.h > ty && this.y < ty + T) {
          if (this.vx > 0) {
            this.x = tx - this.w;
          } else if (this.vx < 0) {
            this.x = tx + T;
          }
          this.vx = 0;
        }
      }
    },

    resolveV() {
      this.grounded = false;
      const tiles = getTilesAround(this.x, this.y, this.w, this.h);
      for (const t of tiles) {
        if (!isSolid(t.type)) continue;
        const tx = t.col * T, ty = t.row * T;
        if (this.x + this.w > tx && this.x < tx + T &&
            this.y + this.h > ty && this.y < ty + T) {
          if (this.vy > 0) {
            this.y = ty - this.h;
            this.vy = 0;
            this.grounded = true;
          } else if (this.vy < 0) {
            this.y = ty + T;
            this.vy = 0;
            // Hit block from below
            hitBlock(t.row, t.col, t.type);
          }
        }
      }
    },

    draw() {
      if (this.invincT > 0 && Math.floor(this.invincT / 3) % 2 === 0) return;

      const sx = (this.x - cameraX) * scale;
      const sy = this.y * scale;
      const sw = this.w * scale;
      const sh = this.h * scale;

      ctx.save();
      if (this.facing === -1) {
        ctx.translate(sx + sw / 2, 0);
        ctx.scale(-1, 1);
        ctx.translate(-(sx + sw / 2), 0);
      }

      const px = scale;
      const running = this.grounded && this.vx !== 0;
      const frame = running ? Math.floor(this.animT) % 3 : 0;
      const jumping = !this.grounded;

      // Hat
      ctx.fillStyle = COL.mario;
      ctx.fillRect(sx + 3 * px, sy, 5 * px, px);
      ctx.fillRect(sx + 2 * px, sy + px, 8 * px, px);

      // Face
      ctx.fillStyle = COL.marioSkin;
      ctx.fillRect(sx + 2 * px, sy + 2 * px, 3 * px, px);
      ctx.fillRect(sx + px, sy + 3 * px, 6 * px, px);
      ctx.fillRect(sx + px, sy + 4 * px, 7 * px, px);
      ctx.fillRect(sx + 2 * px, sy + 5 * px, 4 * px, px);

      // Eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(sx + 5 * px, sy + 2 * px, px, 2 * px);

      // Body
      ctx.fillStyle = COL.mario;
      ctx.fillRect(sx + 2 * px, sy + 6 * px, 7 * px, px);
      ctx.fillRect(sx + px, sy + 7 * px, 9 * px, px);
      ctx.fillRect(sx + px, sy + 8 * px, 8 * px, px);

      // Belt
      ctx.fillStyle = COL.marioPant;
      ctx.fillRect(sx + 2 * px, sy + 9 * px, 7 * px, px);
      ctx.fillRect(sx + px, sy + 10 * px, 9 * px, px);

      // Legs
      ctx.fillStyle = COL.marioPant;
      if (jumping) {
        ctx.fillRect(sx + px, sy + 11 * px, 4 * px, 2 * px);
        ctx.fillRect(sx + 7 * px, sy + 11 * px, 3 * px, 2 * px);
      } else if (running && frame === 1) {
        ctx.fillRect(sx + 2 * px, sy + 11 * px, 3 * px, 2 * px);
        ctx.fillRect(sx + 7 * px, sy + 11 * px, 3 * px, 2 * px);
      } else if (running && frame === 2) {
        ctx.fillRect(sx, sy + 11 * px, 4 * px, 2 * px);
        ctx.fillRect(sx + 6 * px, sy + 11 * px, 4 * px, 2 * px);
      } else {
        ctx.fillRect(sx + 2 * px, sy + 11 * px, 3 * px, 2 * px);
        ctx.fillRect(sx + 6 * px, sy + 11 * px, 3 * px, 2 * px);
      }

      // Shoes
      ctx.fillStyle = COL.marioShoe;
      if (jumping) {
        ctx.fillRect(sx, sy + 13 * px, 4 * px, 2 * px);
        ctx.fillRect(sx + 7 * px, sy + 13 * px, 4 * px, 2 * px);
      } else if (running && frame === 1) {
        ctx.fillRect(sx + px, sy + 13 * px, 4 * px, 2 * px);
        ctx.fillRect(sx + 7 * px, sy + 13 * px, 4 * px, 2 * px);
      } else if (running && frame === 2) {
        ctx.fillRect(sx - px, sy + 13 * px, 4 * px, 2 * px);
        ctx.fillRect(sx + 6 * px, sy + 13 * px, 5 * px, 2 * px);
      } else {
        ctx.fillRect(sx + px, sy + 13 * px, 4 * px, 2 * px);
        ctx.fillRect(sx + 6 * px, sy + 13 * px, 4 * px, 2 * px);
      }

      ctx.restore();
    },
  };

  // ── Tile helpers ──────────────────────────────────────────
  function getTile(row, col) {
    if (row < 0 || row >= ROWS || col < 0 || col >= levelCols) return EMPTY;
    return levelData[row][col];
  }

  function setTile(row, col, val) {
    if (row >= 0 && row < ROWS && col >= 0 && col < levelCols) {
      levelData[row][col] = val;
    }
  }

  function isSolid(type) {
    return type === GROUND || type === BRICK || type === QBLOCK ||
           type === PIPE_TL || type === PIPE_TR || type === PIPE_BL || type === PIPE_BR ||
           type === USED;
  }

  function getTilesAround(x, y, w, h) {
    const tiles = [];
    const c1 = Math.floor(x / T);
    const c2 = Math.floor((x + w - 1) / T);
    const r1 = Math.floor(y / T);
    const r2 = Math.floor((y + h - 1) / T);
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const type = getTile(r, c);
        if (type !== EMPTY) {
          tiles.push({ row: r, col: c, type });
        }
      }
    }
    return tiles;
  }

  function hitBlock(row, col, type) {
    if (type === QBLOCK) {
      setTile(row, col, USED);
      // Spawn coin
      addCoinParticle(col * T + 4, row * T - 12);
      coins++;
      score += 200;
      playSound('coin');
    } else if (type === BRICK) {
      setTile(row, col, EMPTY);
      // Brick break particles
      for (let i = 0; i < 4; i++) {
        particles.push({
          x: col * T + (i % 2) * 8,
          y: row * T + Math.floor(i / 2) * 8,
          vx: (i % 2 === 0 ? -2 : 2) + Math.random(),
          vy: -4 - Math.random() * 2,
          size: 4,
          color: COL.brick,
          life: 30,
        });
      }
      playSound('break');
    }
  }

  function addCoinParticle(x, y) {
    floatTexts.push({ x, y, vy: -2, text: '+200', life: 30, color: '#FFD700' });
  }

  // ── Enemy logic ───────────────────────────────────────────
  function updateEnemies() {
    for (const e of enemies) {
      if (!e.alive) {
        e.squishT--;
        continue;
      }

      e.animT += 0.08;
      e.x += e.vx;

      // Gravity for enemies
      let onGround = false;
      const er = Math.floor((e.y + e.h) / T);
      const ec = Math.floor((e.x + e.w / 2) / T);
      if (er >= 0 && er < ROWS && ec >= 0 && ec < levelCols) {
        if (isSolid(getTile(er, ec))) onGround = true;
      }
      if (!onGround) {
        e.y += 2;
      } else {
        e.y = (er - 1) * T;
      }

      // Turn at walls
      const nextC = e.vx < 0 ? Math.floor(e.x / T) : Math.floor((e.x + e.w) / T);
      const checkR = Math.floor((e.y + e.h / 2) / T);
      if (isSolid(getTile(checkR, nextC))) {
        e.vx = -e.vx;
      }

      // Turn at edges (don't walk off platforms)
      const edgeC = e.vx < 0 ? Math.floor(e.x / T) : Math.floor((e.x + e.w) / T);
      const belowR = Math.floor((e.y + e.h) / T);
      if (!isSolid(getTile(belowR, edgeC)) && onGround) {
        e.vx = -e.vx;
      }

      // Remove if off screen far
      if (e.x < cameraX - 200 || e.x > cameraX + canvasW / scale + 200) continue;
    }

    enemies = enemies.filter(e => e.alive || e.squishT > 0);
  }

  function checkEnemyCollision() {
    if (mario.dead || mario.invincT > 0) return;

    for (const e of enemies) {
      if (!e.alive) continue;

      // AABB collision
      if (mario.x + mario.w > e.x + 2 && mario.x < e.x + e.w - 2 &&
          mario.y + mario.h > e.y && mario.y < e.y + e.h) {
        // Check if stomping (mario falling and feet above enemy center)
        if (mario.vy > 0 && mario.y + mario.h < e.y + e.h * 0.6) {
          // Stomp!
          e.alive = false;
          e.squishT = 20;
          mario.vy = JUMP_VEL * 0.6;
          score += 100;
          floatTexts.push({ x: e.x, y: e.y - 8, vy: -1.5, text: '100', life: 25, color: '#fff' });
          playSound('stomp');
        } else {
          // Hit - die
          die();
        }
      }
    }
  }

  // ── Coin collection ───────────────────────────────────────
  function checkCoinCollection() {
    for (const c of worldCoins) {
      if (c.collected) continue;
      if (mario.x + mario.w > c.x && mario.x < c.x + c.w &&
          mario.y + mario.h > c.y && mario.y < c.y + c.h) {
        c.collected = true;
        coins++;
        score += 100;
        floatTexts.push({ x: c.x, y: c.y - 8, vy: -1.5, text: '+100', life: 25, color: '#FFD700' });
        playSound('coin');
      }
    }
  }

  // ── Flag check ────────────────────────────────────────────
  function checkFlag() {
    const mc = Math.floor((mario.x + mario.w / 2) / T);
    const mr = Math.floor((mario.y + mario.h / 2) / T);

    if (getTile(mr, mc) === FLAG) {
      stageClear();
    }
  }

  // ── Particles & float texts ───────────────────────────────
  function updateParticles() {
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life--;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function updateFloatTexts() {
    for (const f of floatTexts) {
      f.y += f.vy;
      f.life--;
    }
    floatTexts = floatTexts.filter(f => f.life > 0);
  }

  // ── Camera ────────────────────────────────────────────────
  function updateCamera() {
    const targetX = mario.x - canvasW / scale * 0.35;
    cameraX = Math.max(0, Math.min(targetX, worldW - canvasW / scale));
  }

  // ── Drawing ───────────────────────────────────────────────
  function drawTile(row, col, type) {
    const x = (col * T - cameraX) * scale;
    const y = row * T * scale;
    const s = T * scale;
    const px = scale;

    if (x + s < 0 || x > canvasW) return;

    switch (type) {
      case GROUND:
        if (row > 0 && getTile(row - 1, col) !== GROUND) {
          // Top of ground - green
          ctx.fillStyle = COL.groundTop;
          ctx.fillRect(x, y, s, 3 * px);
          ctx.fillStyle = COL.ground;
          ctx.fillRect(x, y + 3 * px, s, s - 3 * px);
        } else {
          ctx.fillStyle = COL.ground;
          ctx.fillRect(x, y, s, s);
        }
        // Grid lines
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(x + s - px, y, px, s);
        ctx.fillRect(x, y + s - px, s, px);
        break;

      case BRICK:
        ctx.fillStyle = COL.brick;
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = COL.brickLine;
        ctx.fillRect(x, y, s, px);
        ctx.fillRect(x, y + Math.floor(s / 2), s, px);
        ctx.fillRect(x + Math.floor(s / 4), y, px, Math.floor(s / 2));
        ctx.fillRect(x + Math.floor(s * 3 / 4), y, px, Math.floor(s / 2));
        ctx.fillRect(x + Math.floor(s / 2), y + Math.floor(s / 2), px, Math.floor(s / 2));
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + px, y + px, s - 2 * px, 2 * px);
        break;

      case QBLOCK: {
        const pulse = Math.sin(performance.now() * 0.004) * 0.15 + 0.85;
        ctx.fillStyle = COL.qBlock;
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = COL.qBlockDot;
        ctx.fillRect(x + px, y + px, s - 2 * px, px);
        ctx.fillRect(x + px, y + px, px, s - 2 * px);
        // Question mark
        ctx.fillStyle = `rgba(255,255,255,${pulse})`;
        ctx.font = `bold ${Math.floor(s * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x + s / 2, y + s / 2 + px);
        break;
      }

      case USED:
        ctx.fillStyle = '#886644';
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(x + px, y + s - 2 * px, s - 2 * px, px);
        ctx.fillRect(x + s - 2 * px, y + px, px, s - 2 * px);
        break;

      case PIPE_TL:
        ctx.fillStyle = COL.pipe;
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = COL.pipeDark;
        ctx.fillRect(x, y, 2 * px, s);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x + 3 * px, y, 2 * px, s);
        // Top lip
        ctx.fillStyle = COL.pipe;
        ctx.fillRect(x - 2 * px, y, s + 2 * px, 3 * px);
        ctx.fillStyle = COL.pipeDark;
        ctx.fillRect(x - 2 * px, y, 2 * px, 3 * px);
        break;

      case PIPE_TR:
        ctx.fillStyle = COL.pipe;
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = COL.pipeDark;
        ctx.fillRect(x + s - 2 * px, y, 2 * px, s);
        // Top lip
        ctx.fillStyle = COL.pipe;
        ctx.fillRect(x, y, s + 2 * px, 3 * px);
        ctx.fillStyle = COL.pipeDark;
        ctx.fillRect(x + s, y, 2 * px, 3 * px);
        break;

      case PIPE_BL:
        ctx.fillStyle = COL.pipe;
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = COL.pipeDark;
        ctx.fillRect(x, y, 2 * px, s);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x + 3 * px, y, 2 * px, s);
        break;

      case PIPE_BR:
        ctx.fillStyle = COL.pipe;
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = COL.pipeDark;
        ctx.fillRect(x + s - 2 * px, y, 2 * px, s);
        break;

      case FLAG: {
        const fx = x + s / 2 - px;
        ctx.fillStyle = COL.flagPole;
        ctx.fillRect(fx, y, 2 * px, s);
        // Flag cloth at top
        if (row <= ROWS - 4 && getTile(row - 1, col) !== FLAG) {
          ctx.fillStyle = COL.flag;
          ctx.fillRect(fx + 2 * px, y + 2 * px, 6 * px, 4 * px);
          // Flag triangle
          ctx.fillStyle = '#fff';
          ctx.fillRect(fx + 3 * px, y + 3 * px, px, 2 * px);
        }
        break;
      }
    }
  }

  function drawBackground() {
    // Sky
    ctx.fillStyle = COL.sky;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Clouds
    const cloudY = [2, 1.5, 2.5, 1, 3];
    for (let i = 0; i < 8; i++) {
      const cx = (i * 350 + 50 - cameraX * 0.3 * scale) % (canvasW + 200) - 50;
      const cy = (cloudY[i % 5]) * T * scale;
      const cs = scale * 2;

      ctx.fillStyle = COL.cloud;
      ctx.beginPath();
      ctx.arc(cx, cy, 8 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 10 * cs, cy - 4 * cs, 10 * cs, 0, Math.PI * 2);
      ctx.arc(cx + 22 * cs, cy, 8 * cs, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hills
    for (let i = 0; i < 6; i++) {
      const hx = (i * 450 - cameraX * 0.4 * scale) % (canvasW + 500) - 100;
      const hy = (ROWS - 2) * T * scale;
      const hw = 120 * scale;
      const hh = 40 * scale;

      ctx.fillStyle = COL.hillGreen;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo(hx + hw / 2, hy - hh, hx + hw, hy);
      ctx.fill();

      // Small bush detail
      ctx.fillStyle = COL.hillDark;
      ctx.beginPath();
      ctx.arc(hx + hw * 0.3, hy - 2 * scale, 8 * scale, Math.PI, 0);
      ctx.fill();
    }
  }

  function drawCoins() {
    for (const c of worldCoins) {
      if (c.collected) continue;
      const sx = (c.x - cameraX) * scale;
      const sy = c.y * scale;
      if (sx + 12 * scale < 0 || sx > canvasW) continue;

      c.animT += 0.05;
      const stretch = Math.abs(Math.cos(c.animT));
      const w = c.w * scale * stretch;
      const h = c.h * scale;

      ctx.fillStyle = COL.coin;
      ctx.fillRect(sx + (c.w * scale - w) / 2, sy, w, h);
      ctx.fillStyle = COL.coinDark;
      ctx.fillRect(sx + (c.w * scale - w) / 2 + w * 0.3, sy + 2 * scale, w * 0.4, h - 4 * scale);
    }
  }

  function drawEnemies() {
    for (const e of enemies) {
      const sx = (e.x - cameraX) * scale;
      const sy = e.y * scale;
      const sw = e.w * scale;
      const sh = e.h * scale;
      const px = scale;

      if (sx + sw < 0 || sx > canvasW) continue;

      if (!e.alive) {
        // Squished
        ctx.fillStyle = COL.goomba;
        ctx.fillRect(sx + px, sy + sh - 4 * px, sw - 2 * px, 4 * px);
        continue;
      }

      // Body
      ctx.fillStyle = COL.goomba;
      ctx.fillRect(sx + 2 * px, sy + 2 * px, sw - 4 * px, sh - 6 * px);
      ctx.fillRect(sx + px, sy + 4 * px, sw - 2 * px, sh - 8 * px);

      // Head top
      ctx.fillStyle = COL.goombaDk;
      ctx.fillRect(sx + 3 * px, sy, sw - 6 * px, 3 * px);
      ctx.fillRect(sx + 2 * px, sy + px, sw - 4 * px, 2 * px);

      // Eyes
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx + 4 * px, sy + 4 * px, 3 * px, 3 * px);
      ctx.fillRect(sx + sw - 7 * px, sy + 4 * px, 3 * px, 3 * px);
      ctx.fillStyle = '#000';
      ctx.fillRect(sx + 5 * px, sy + 5 * px, 2 * px, 2 * px);
      ctx.fillRect(sx + sw - 6 * px, sy + 5 * px, 2 * px, 2 * px);

      // Feet
      const walkFrame = Math.floor(e.animT) % 2;
      ctx.fillStyle = COL.goombaFoot;
      if (walkFrame === 0) {
        ctx.fillRect(sx + px, sy + sh - 4 * px, 4 * px, 4 * px);
        ctx.fillRect(sx + sw - 5 * px, sy + sh - 4 * px, 4 * px, 4 * px);
      } else {
        ctx.fillRect(sx + 2 * px, sy + sh - 3 * px, 4 * px, 3 * px);
        ctx.fillRect(sx + sw - 6 * px, sy + sh - 5 * px, 4 * px, 3 * px);
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const sx = (p.x - cameraX) * scale;
      const sy = p.y * scale;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 30;
      ctx.fillRect(sx, sy, p.size * scale, p.size * scale);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloatTexts() {
    for (const f of floatTexts) {
      const sx = (f.x - cameraX) * scale;
      const sy = f.y * scale;
      ctx.globalAlpha = Math.min(1, f.life / 10);
      ctx.fillStyle = f.color;
      ctx.font = `bold ${Math.floor(10 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(f.text, sx, sy);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    drawBackground();

    // Draw tiles
    const startCol = Math.max(0, Math.floor(cameraX / T) - 1);
    const endCol = Math.min(levelCols, startCol + Math.ceil(canvasW / (T * scale)) + 2);

    for (let r = 0; r < ROWS; r++) {
      for (let c = startCol; c < endCol; c++) {
        const type = levelData[r][c];
        if (type !== EMPTY) {
          drawTile(r, c, type);
        }
      }
    }

    drawCoins();
    drawEnemies();
    mario.draw();
    drawParticles();
    drawFloatTexts();

    // HUD
    updateHUD();
  }

  function updateHUD() {
    document.getElementById('scoreVal').textContent = score;
    document.getElementById('coinVal').textContent = '×' + coins;
    if (score > hiScore) {
      hiScore = score;
      document.getElementById('hiscoreVal').textContent = hiScore;
    }
  }

  // ── Audio ─────────────────────────────────────────────────
  let audioCtx = null;
  function aCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playJump() {
    try {
      const a = aCtx(), o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.frequency.setValueAtTime(500, a.currentTime);
      o.frequency.exponentialRampToValueAtTime(800, a.currentTime + 0.08);
      o.type = 'square'; g.gain.value = 0.08;
      o.start(); o.stop(a.currentTime + 0.1);
    } catch (_) {}
  }

  function playSound(type) {
    try {
      const a = aCtx();
      if (type === 'coin') {
        const o = a.createOscillator(), g = a.createGain();
        o.connect(g); g.connect(a.destination);
        o.frequency.setValueAtTime(988, a.currentTime);
        o.frequency.setValueAtTime(1319, a.currentTime + 0.05);
        o.type = 'square'; g.gain.value = 0.07;
        o.start(); o.stop(a.currentTime + 0.1);
      } else if (type === 'stomp') {
        const o = a.createOscillator(), g = a.createGain();
        o.connect(g); g.connect(a.destination);
        o.frequency.value = 300; o.type = 'triangle'; g.gain.value = 0.1;
        o.start();
        o.frequency.exponentialRampToValueAtTime(100, a.currentTime + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.1);
        o.stop(a.currentTime + 0.1);
      } else if (type === 'break') {
        const o = a.createOscillator(), g = a.createGain();
        o.connect(g); g.connect(a.destination);
        o.frequency.value = 200; o.type = 'sawtooth'; g.gain.value = 0.06;
        o.start();
        o.frequency.exponentialRampToValueAtTime(80, a.currentTime + 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.08);
        o.stop(a.currentTime + 0.08);
      } else if (type === 'die') {
        const o = a.createOscillator(), g = a.createGain();
        o.connect(g); g.connect(a.destination);
        o.frequency.setValueAtTime(600, a.currentTime);
        o.frequency.exponentialRampToValueAtTime(100, a.currentTime + 0.5);
        o.type = 'square'; g.gain.value = 0.1;
        o.start();
        g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.5);
        o.stop(a.currentTime + 0.5);
      } else if (type === 'clear') {
        [523, 659, 784, 1047].forEach((f, i) => {
          const o = a.createOscillator(), g = a.createGain();
          o.connect(g); g.connect(a.destination);
          o.frequency.value = f; o.type = 'square'; g.gain.value = 0.06;
          o.start(a.currentTime + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + i * 0.1 + 0.15);
          o.stop(a.currentTime + i * 0.1 + 0.15);
        });
      }
    } catch (_) {}
  }

  // ── Input ─────────────────────────────────────────────────
  const keys = { left: false, right: false, jump: false };

  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.left = true; e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.right = true; e.preventDefault(); }
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      keys.jump = true;
      if (state === 'idle' || state === 'dead') {
        startGame();
      }
    }
  });

  window.addEventListener('keyup', e => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') keys.jump = false;
  });

  // Touch controls
  const btnLeft  = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnJump  = document.getElementById('btnJump');

  function addHoldListeners(btn, onDown, onUp) {
    btn.addEventListener('pointerdown', e => { e.preventDefault(); onDown(); btn.classList.add('active'); });
    btn.addEventListener('pointerup', () => { onUp(); btn.classList.remove('active'); });
    btn.addEventListener('pointerleave', () => { onUp(); btn.classList.remove('active'); });
    btn.addEventListener('pointercancel', () => { onUp(); btn.classList.remove('active'); });
  }

  addHoldListeners(btnLeft,
    () => { keys.left = true; },
    () => { keys.left = false; }
  );
  addHoldListeners(btnRight,
    () => { keys.right = true; },
    () => { keys.right = false; }
  );
  addHoldListeners(btnJump,
    () => {
      keys.jump = true;
      if (state === 'idle' || state === 'dead') startGame();
    },
    () => { keys.jump = false; }
  );

  // Touch on canvas for jump
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    keys.jump = true;
    if (state === 'idle' || state === 'dead') startGame();
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    keys.jump = false;
  }, { passive: false });

  // ── Game state ────────────────────────────────────────────
  function startGame() {
    if (typeof Leaderboard !== 'undefined') Leaderboard.hide();

    state = 'play';
    score = 0;
    coins = 0;
    stageNum = 1;
    particles = [];
    floatTexts = [];
    cameraX = 0;

    levelData = generateLevel(stageNum);
    mario.reset();

    document.getElementById('overlayStart').classList.add('hidden');
    document.getElementById('overlayDead').classList.add('hidden');
    document.getElementById('overlayClear').classList.add('hidden');

    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function nextStage() {
    stageNum++;
    particles = [];
    floatTexts = [];
    cameraX = 0;

    levelData = generateLevel(stageNum);
    mario.reset();

    document.getElementById('overlayClear').classList.add('hidden');
    state = 'play';

    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function die() {
    if (mario.dead) return;
    mario.dead = true;
    mario.vy = JUMP_VEL;
    playSound('die');

    setTimeout(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      state = 'dead';

      if (score > hiScore) hiScore = score;
      localStorage.setItem('mario_hi', hiScore);
      document.getElementById('hiscoreVal').textContent = hiScore;

      document.getElementById('deadScore').textContent = score;
      document.getElementById('deadHiscore').textContent = hiScore;
      document.getElementById('deadHiscore').classList.toggle('accent', score >= hiScore);
      document.getElementById('overlayDead').classList.remove('hidden');

      if (typeof Leaderboard !== 'undefined') Leaderboard.ready('mario', score);
    }, 1500);
  }

  function stageClear() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    state = 'clear';
    score += 1000;
    playSound('clear');

    if (score > hiScore) {
      hiScore = score;
      localStorage.setItem('mario_hi', hiScore);
    }

    document.getElementById('clearScore').textContent = score;
    document.getElementById('clearCoins').textContent = coins;
    document.getElementById('overlayClear').classList.remove('hidden');
  }

  // ── Game loop ─────────────────────────────────────────────
  function loop() {
    mario.update();
    if (!mario.dead) {
      updateEnemies();
      checkEnemyCollision();
      checkCoinCollection();
      checkFlag();
      updateCamera();
    }
    updateParticles();
    updateFloatTexts();
    render();
    raf = requestAnimationFrame(loop);
  }

  // ── Overlay buttons ───────────────────────────────────────
  document.getElementById('btnStart').addEventListener('click', () => startGame());
  document.getElementById('btnRestart').addEventListener('click', () => startGame());
  document.getElementById('btnNext').addEventListener('click', () => nextStage());

  // ── Init ──────────────────────────────────────────────────
  levelData = generateLevel(1);
  mario.reset();
  updateCamera();
  render();
})();
