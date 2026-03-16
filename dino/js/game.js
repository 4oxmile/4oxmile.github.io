// ============================================================
//  DINO RUN — Chrome T-Rex Runner Clone
// ============================================================
(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────
  const PX          = 3;       // pixel-art scale
  const GRAVITY     = 0.55;
  const JUMP_VEL    = -10.5;
  const INIT_SPEED  = 6;
  const MAX_SPEED   = 13;
  const SPEED_INC   = 0.001;
  const GROUND_PCT  = 0.84;    // ground Y as % of canvas height
  const NIGHT_EVERY = 700;     // score interval for night toggle
  const MILE_EVERY  = 100;     // score interval for milestone flash

  // ── Sprite helper ──────────────────────────────────────────
  function S(str) {
    const lines = str.split('\n').filter(l => l.length > 0);
    const min = Math.min(...lines.map(l => { const m = l.match(/^\s*/); return m[0].length; }));
    return lines.map(l => l.slice(min));
  }
  function sW(s) { return Math.max(...s.map(r => r.length)); }
  function sH(s) { return s.length; }

  // ── Sprites ────────────────────────────────────────────────
  // T-Rex standing / jump
  const D_STAND = S(`
          ######
         ########
         #.######
         ########
         #####
      #  ######
      # ########
      ###########
      ###########
       ##########
        ########
        #######
         ## ##
         ## ##
         ##  ##
  `);

  // T-Rex run frame 1 (right foot forward)
  const D_RUN1 = S(`
          ######
         ########
         #.######
         ########
         #####
      #  ######
      # ########
      ###########
      ###########
       ##########
        ########
        #######
         ##  #
         ##
         ###
  `);

  // T-Rex run frame 2 (left foot forward)
  const D_RUN2 = S(`
          ######
         ########
         #.######
         ########
         #####
      #  ######
      # ########
      ###########
      ###########
       ##########
        ########
        #######
          # ##
            ##
            ###
  `);

  // T-Rex duck frame 1
  const D_DUCK1 = S(`
                       ######
         #############.######
         ###################
         ##################
         ################
          ##############
           ######  #
           ######
           #####
  `);

  // T-Rex duck frame 2
  const D_DUCK2 = S(`
                       ######
         #############.######
         ###################
         ##################
         ################
          ##############
           #   ######
               ######
               #####
  `);

  // Small cactus
  const C_SM = S(`
      ##
      ##
    # ## #
    # ## #
    ######
    ######
     ####
      ##
      ##
      ##
      ##
      ##
      ##
  `);

  // Large cactus
  const C_LG = S(`
        ##
        ##
        ##
     #  ##  #
     #  ##  #
     #  ##  #
     ########
     ########
        ##
        ##
        ##
        ##
        ##
        ##
        ##
        ##
        ##
  `);

  // Pterodactyl wing up
  const P_UP = S(`
      #
      ##
      ###
     #####
    ########
     ##########
      ##########
       #####
        ##
  `);

  // Pterodactyl wing down
  const P_DN = S(`
       #####
      ##########
     ##########
    ########
     #####
      ###
      ##
      #
        ##
  `);

  // Cloud
  const CLOUD = S(`
         ####
       ########
      ##########
    ##############
       ########
  `);

  // ── Canvas ─────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');
  let groundY  = 0;

  function resize() {
    const area = document.querySelector('.canvas-area');
    canvas.width  = area.clientWidth;
    canvas.height = area.clientHeight;
    groundY = Math.floor(canvas.height * GROUND_PCT);
  }
  resize();
  window.addEventListener('resize', () => {
    resize();
    if (state !== 'play') render();
  });

  // ── State ──────────────────────────────────────────────────
  let state        = 'idle';   // idle | play | dead
  let score        = 0;
  let dispScore    = 0;
  let hiScore      = +(localStorage.getItem('dino_hi') || 0);
  let speed        = INIT_SPEED;
  let isNight      = false;
  let groundOff    = 0;
  let mileFlash    = 0;
  let lastTs       = 0;
  let raf          = null;
  let deathFlashId = null;
  let obstacles    = [];
  let clouds       = [];
  let stars        = [];
  let groundBumps  = [];
  let spawnTimer   = 80;

  document.getElementById('hiscoreVal').textContent = pad5(hiScore);
  document.getElementById('startHiscore').textContent = hiScore;

  // ── Utilities ──────────────────────────────────────────────
  function pad5(n) { return String(n).padStart(5, '0'); }

  function fgColor() { return isNight ? '#aaa' : getCSS('--dino-fg'); }
  function bgColor() { return isNight ? '#1a1a2e' : getCSS('--dino-bg'); }
  function getCSS(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  // ── Sprite renderer ───────────────────────────────────────
  function drawSprite(spr, x, y, col, dotCol) {
    const dc = dotCol || bgColor();
    for (let r = 0; r < spr.length; r++) {
      const row = spr[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '#') {
          ctx.fillStyle = col;
          ctx.fillRect(x + c * PX | 0, y + r * PX | 0, PX, PX);
        } else if (ch === '.') {
          ctx.fillStyle = dc;
          ctx.fillRect(x + c * PX | 0, y + r * PX | 0, PX, PX);
        }
      }
    }
  }

  // ── Dino ───────────────────────────────────────────────────
  const dino = {
    x: 0, y: 0, vy: 0,
    ducking: false,
    grounded: true,
    frame: 0,
    animT: 0,
    blinkT: 0,

    get spr() {
      if (this.ducking) return this.frame ? D_DUCK2 : D_DUCK1;
      if (!this.grounded) return D_STAND;
      return this.frame ? D_RUN2 : D_RUN1;
    },
    get w()  { return sW(this.spr) * PX; },
    get h()  { return sH(this.spr) * PX; },

    reset() {
      this.x = Math.max(40, canvas.width * 0.1 | 0);
      this.vy = 0;
      this.ducking = false;
      this.grounded = true;
      this.frame = 0;
      this.animT = 0;
      this.y = groundY - sH(D_STAND) * PX;
    },

    jump() {
      if (this.grounded && !this.ducking) {
        this.vy = JUMP_VEL;
        this.grounded = false;
        playJump();
      }
    },

    duck(on) {
      if (on && this.grounded) {
        this.ducking = true;
        this.y = groundY - sH(D_DUCK1) * PX;
      } else if (!on) {
        this.ducking = false;
        if (this.grounded) this.y = groundY - sH(D_STAND) * PX;
      }
    },

    update() {
      if (!this.grounded) {
        this.vy += GRAVITY;
        this.y  += this.vy;
        const gy = groundY - sH(D_STAND) * PX;
        if (this.y >= gy) {
          this.y = gy;
          this.vy = 0;
          this.grounded = true;
        }
      } else {
        const s = this.ducking ? D_DUCK1 : D_STAND;
        this.y = groundY - sH(s) * PX;
      }

      // animate legs
      this.animT++;
      if (this.animT > (this.ducking ? 4 : 6)) {
        this.animT = 0;
        this.frame = 1 - this.frame;
      }

      // random blink
      this.blinkT = Math.max(0, this.blinkT - 1);
      if (Math.random() < 0.005) this.blinkT = 8;
    },

    draw() {
      const col = fgColor();
      drawSprite(this.spr, this.x, this.y, col);

      // blink: cover eye ('.' pixel)
      if (this.blinkT > 0) {
        const row = this.spr[2];
        if (row) {
          const ei = row.indexOf('.');
          if (ei >= 0) {
            ctx.fillStyle = col;
            ctx.fillRect(this.x + ei * PX | 0, this.y + 2 * PX | 0, PX, PX);
          }
        }
      }
    },

    get hitbox() {
      const w = sW(this.spr) * PX;
      const h = sH(this.spr) * PX;
      const p = PX * 2;
      return { x: this.x + p, y: this.y + p, w: w - p * 2, h: h - p * 2 };
    },
  };

  // ── Obstacles ──────────────────────────────────────────────
  function spawnObstacle() {
    if (score > 250 && Math.random() > 0.55) {
      spawnPtera();
    } else {
      spawnCactus();
    }
  }

  function spawnCactus() {
    const large = Math.random() > 0.45;
    const spr   = large ? C_LG : C_SM;
    const count = 1 + (Math.random() * 2.5 | 0);   // 1-3
    const sw    = sW(spr) * PX;
    const sh    = sH(spr) * PX;
    const gap   = PX;
    obstacles.push({
      type: 'cactus', spr, count,
      x: canvas.width + 20,
      y: groundY - sh,
      w: sw * count + gap * (count - 1),
      h: sh,
      unitW: sw, gap,
    });
  }

  function spawnPtera() {
    const dinoH   = sH(D_STAND) * PX;
    const pteraH  = sH(P_UP) * PX;
    // Three heights: low (jump), mid (duck), high (run under)
    const yOptions = [
      groundY - pteraH,                    // low
      groundY - dinoH + PX * 3,            // mid (must duck)
      groundY - dinoH - PX * 8,            // high (run under)
    ];
    const y = yOptions[Math.random() * 3 | 0];
    obstacles.push({
      type: 'ptera',
      x: canvas.width + 20,
      y,
      w: sW(P_UP) * PX,
      h: pteraH,
      wingFrame: 0, wingT: 0,
    });
  }

  function updateObstacles() {
    obstacles.forEach(o => {
      o.x -= speed;
      if (o.type === 'ptera') {
        o.wingT++;
        if (o.wingT > 10) { o.wingT = 0; o.wingFrame = 1 - o.wingFrame; }
      }
    });
    obstacles = obstacles.filter(o => o.x + o.w > -30);

    spawnTimer--;
    if (spawnTimer <= 0) {
      spawnObstacle();
      const minGap = Math.max(45, 95 - speed * 3);
      spawnTimer = minGap + Math.random() * 60;
    }
  }

  function drawObstacles() {
    const col = fgColor();
    const cactusCol = isNight ? '#7a7' : '#595';

    obstacles.forEach(o => {
      if (o.type === 'cactus') {
        for (let i = 0; i < o.count; i++) {
          drawSprite(o.spr, o.x + i * (o.unitW + o.gap), o.y, cactusCol);
        }
      } else {
        const spr = o.wingFrame ? P_DN : P_UP;
        drawSprite(spr, o.x, o.y, col);
      }
    });
  }

  // ── Ground ─────────────────────────────────────────────────
  function initGround() {
    groundBumps = [];
    for (let i = 0; i < 300; i++) {
      if (Math.random() > 0.65) {
        groundBumps.push({
          off: i * 10,
          w: 1 + (Math.random() * 3 | 0),
          h: 1 + (Math.random() * 2 | 0),
        });
      }
    }
  }
  initGround();

  function drawGround() {
    const col = fgColor();
    ctx.fillStyle = col;
    ctx.fillRect(0, groundY, canvas.width, 2);

    const total = 300 * 10;
    const off   = groundOff % total;
    ctx.fillStyle = isNight ? 'rgba(170,170,170,0.4)' : 'rgba(83,83,83,0.35)';
    groundBumps.forEach(b => {
      let bx = b.off - off;
      if (bx < -20) bx += total;
      if (bx > canvas.width + 20) return;
      ctx.fillRect(bx, groundY + 3, b.w * 2, b.h);
    });
  }

  // ── Clouds ─────────────────────────────────────────────────
  function initClouds() {
    clouds = [];
    for (let i = 0; i < 5; i++) {
      clouds.push({
        x: Math.random() * canvas.width,
        y: 20 + Math.random() * (groundY * 0.35),
        sp: 0.4 + Math.random() * 0.4,
      });
    }
  }
  initClouds();

  function updateClouds() {
    const cw = sW(CLOUD) * PX;
    clouds.forEach(c => {
      c.x -= c.sp;
      if (c.x + cw < 0) {
        c.x = canvas.width + 20;
        c.y = 20 + Math.random() * (groundY * 0.35);
      }
    });
  }

  function drawClouds() {
    const col = isNight ? '#2a2a40' : '#ddd';
    clouds.forEach(c => drawSprite(CLOUD, c.x, c.y, col));
  }

  // ── Night sky ──────────────────────────────────────────────
  function initStars() {
    stars = [];
    for (let i = 0; i < 25; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * (groundY * 0.45),
        ph: Math.random() * Math.PI * 2,
      });
    }
  }
  initStars();

  function drawNight() {
    if (!isNight) return;
    // stars
    stars.forEach(s => {
      s.ph += 0.02;
      const a = 0.35 + Math.sin(s.ph) * 0.35;
      ctx.fillStyle = `rgba(200,210,230,${a})`;
      ctx.fillRect(s.x, s.y, PX, PX);
    });
    // moon
    const mx = canvas.width * 0.78, my = groundY * 0.1;
    ctx.beginPath(); ctx.arc(mx, my, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#ccc'; ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 5, my - 3, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e'; ctx.fill();
  }

  // ── Collision ──────────────────────────────────────────────
  function collides() {
    const d = dino.hitbox;
    for (const o of obstacles) {
      const p  = o.type === 'ptera' ? PX * 2 : PX;
      const ox = o.x + p, oy = o.y + p;
      const ow = o.w - p * 2, oh = o.h - p;
      if (d.x < ox + ow && d.x + d.w > ox && d.y < oy + oh && d.y + d.h > oy) return true;
    }
    return false;
  }

  // ── Score ──────────────────────────────────────────────────
  function updateScore() {
    score += speed * 0.02;
    const ns = score | 0;

    // milestone flash
    if ((ns / MILE_EVERY | 0) > (dispScore / MILE_EVERY | 0)) {
      mileFlash = 20;
      playMilestone();
    }
    dispScore = ns;

    // night toggle
    const prevNight = isNight;
    isNight = ((score / NIGHT_EVERY | 0) % 2) === 1;
    if (isNight !== prevNight) {
      document.getElementById('nightBadge').classList.toggle('visible', isNight);
    }

    // speed
    speed = Math.min(MAX_SPEED, INIT_SPEED + score * SPEED_INC);

    // display
    const el = document.getElementById('scoreVal');
    el.textContent = pad5(dispScore);
    if (mileFlash > 0) {
      mileFlash--;
      el.style.visibility = (mileFlash % 4 < 2) ? 'hidden' : 'visible';
    } else {
      el.style.visibility = 'visible';
    }

    if (dispScore > hiScore) {
      hiScore = dispScore;
      document.getElementById('hiscoreVal').textContent = pad5(hiScore);
    }
  }

  // ── Audio ──────────────────────────────────────────────────
  let audioCtx = null;
  function aCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playJump() {
    try {
      const a = aCtx(), o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.frequency.value = 600; o.type = 'triangle';
      g.gain.value = 0.12;
      o.start();
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.08);
      o.stop(a.currentTime + 0.08);
    } catch (_) {}
  }

  function playMilestone() {
    try {
      const a = aCtx();
      [660, 880].forEach((f, i) => {
        const o = a.createOscillator(), g = a.createGain();
        o.connect(g); g.connect(a.destination);
        o.frequency.value = f; o.type = 'square'; g.gain.value = 0.08;
        o.start(a.currentTime + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + i * 0.08 + 0.08);
        o.stop(a.currentTime + i * 0.08 + 0.08);
      });
    } catch (_) {}
  }

  function playDeath() {
    try {
      const a = aCtx(), o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.frequency.value = 200; o.type = 'sawtooth'; g.gain.value = 0.12;
      o.start();
      o.frequency.exponentialRampToValueAtTime(50, a.currentTime + 0.25);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.25);
      o.stop(a.currentTime + 0.25);
    } catch (_) {}
  }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    // background
    ctx.fillStyle = bgColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawNight();
    drawClouds();
    drawGround();
    drawObstacles();
    dino.draw();

    // milestone flash overlay
    if (mileFlash > 12) {
      ctx.fillStyle = `rgba(255,255,255,${(mileFlash - 12) * 0.025})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // ── Game loop ──────────────────────────────────────────────
  function loop(ts) {
    lastTs = ts;
    groundOff += speed;
    dino.update();
    updateObstacles();
    updateClouds();
    updateScore();

    if (collides()) { die(); return; }

    render();
    raf = requestAnimationFrame(loop);
  }

  // ── Start / Die ────────────────────────────────────────────
  function startGame() {
    if (deathFlashId) { clearInterval(deathFlashId); deathFlashId = null; }
    if (typeof Leaderboard !== 'undefined') Leaderboard.hide();

    state      = 'play';
    score      = 0;
    dispScore  = 0;
    speed      = INIT_SPEED;
    isNight    = false;
    groundOff  = 0;
    mileFlash  = 0;
    obstacles  = [];
    spawnTimer = 80;

    initClouds();
    initStars();
    initGround();
    dino.reset();

    document.getElementById('nightBadge').classList.remove('visible');
    document.getElementById('overlayStart').classList.add('hidden');
    document.getElementById('overlayDead').classList.add('hidden');
    document.getElementById('scoreVal').textContent = '00000';
    document.getElementById('scoreVal').style.visibility = 'visible';

    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    lastTs = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function die() {
    if (raf) cancelAnimationFrame(raf);
    raf   = null;
    state = 'dead';
    playDeath();

    // save hi
    if (dispScore > hiScore) hiScore = dispScore;
    localStorage.setItem('dino_hi', hiScore);
    document.getElementById('hiscoreVal').textContent = pad5(hiScore);

    // flash then overlay
    let n = 0;
    deathFlashId = setInterval(() => {
      if (++n > 6) { clearInterval(deathFlashId); deathFlashId = null; showDead(); return; }
      render();
      if (n % 2 === 0) {
        ctx.fillStyle = 'rgba(239,68,68,0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }, 80);
  }

  function showDead() {
    document.getElementById('deadScore').textContent  = pad5(dispScore);
    document.getElementById('deadHiscore').textContent = pad5(hiScore);
    document.getElementById('deadHiscore').classList.toggle('accent', dispScore >= hiScore);
    document.getElementById('overlayDead').classList.remove('hidden');
    if (typeof Leaderboard !== 'undefined') Leaderboard.ready('dino', dispScore);
  }

  // ── Input ──────────────────────────────────────────────────
  function doJump() {
    if (state === 'idle' || state === 'dead') {
      if (raf) cancelAnimationFrame(raf);
      startGame();
    } else if (state === 'play') {
      dino.jump();
    }
  }

  function doDuckOn() {
    if (state === 'play') {
      if (dino.grounded) dino.duck(true);
      else dino.vy = Math.max(dino.vy, 8);   // fast-fall
    }
  }

  function doDuckOff() {
    if (state === 'play') dino.duck(false);
  }

  // keyboard
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); doJump(); }
    if (e.code === 'ArrowDown') { e.preventDefault(); doDuckOn(); }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'ArrowDown') doDuckOff();
  });

  // touch: tap = jump, swipe down = duck
  let touchStartY = 0;
  let touchActive = false;

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchStartY = e.touches[0].clientY;
    touchActive = true;
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!touchActive) return;
    const dy = e.touches[0].clientY - touchStartY;
    if (dy > 20) {
      doDuckOn();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (!touchActive) return;
    const endY = e.changedTouches[0].clientY;
    const dy = endY - touchStartY;
    touchActive = false;

    if (dy > 20) {
      // was a swipe down → release duck
      doDuckOff();
    } else {
      // tap → jump
      doJump();
    }
  }, { passive: false });

  // buttons
  document.getElementById('btnJump').addEventListener('pointerdown', e => { e.preventDefault(); doJump(); });

  const btnDuck = document.getElementById('btnDuck');
  btnDuck.addEventListener('pointerdown', e => { e.preventDefault(); doDuckOn();  btnDuck.classList.add('active'); });
  btnDuck.addEventListener('pointerup',   () => { doDuckOff(); btnDuck.classList.remove('active'); });
  btnDuck.addEventListener('pointerleave',() => { doDuckOff(); btnDuck.classList.remove('active'); });

  // overlay buttons
  document.getElementById('btnStart').addEventListener('click', () => { if (raf) cancelAnimationFrame(raf); startGame(); });
  document.getElementById('btnRestart').addEventListener('click', () => { if (raf) cancelAnimationFrame(raf); startGame(); });

  // ── Init ───────────────────────────────────────────────────
  dino.reset();
  render();
})();
