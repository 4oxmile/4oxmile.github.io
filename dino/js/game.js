// ============================================================
//  DINO RUNNER  —  game.js
// ============================================================

(function () {
  'use strict';

  // ── Canvas & Resize ──────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx    = canvas.getContext('2d');

  function resizeCanvas() {
    const area = document.querySelector('.canvas-area');
    canvas.width  = area.clientWidth;
    canvas.height = area.clientHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', () => { resizeCanvas(); if (state !== 'playing') draw(); });

  // ── Constants ────────────────────────────────────────────
  const GROUND_H   = 2;
  const GRAVITY     = 0.55;
  const JUMP_VEL    = -12.5;
  const DUCK_SCALE  = 0.55;
  const BASE_SPEED  = 5;
  const MAX_SPEED   = 14;
  const SPEED_INC   = 0.0008;
  const NIGHT_EVERY = 500;

  // ── State ─────────────────────────────────────────────────
  let state       = 'idle';    // idle | playing | dead
  let score       = 0;
  let hiScore     = parseInt(localStorage.getItem('dino_hi') || '0', 10);
  let speed       = BASE_SPEED;
  let frameCount  = 0;
  let isNight     = false;
  let groundX     = 0;
  let bgStars     = [];
  let clouds      = [];
  let obstacles   = [];
  let particles   = [];
  let raf         = null;
  let lastTime    = 0;

  // Update displayed hi-score immediately
  document.getElementById('hiscoreVal').textContent = hiScore;

  // ── Dino Object ──────────────────────────────────────────
  const dino = {
    x: 0, y: 0,
    vy: 0,
    w: 44, h: 52,
    ducking: false,
    grounded: true,
    jumpCount: 0,
    legPhase: 0,
    eyeBlink: 0,

    get groundY() {
      return canvas.height - groundLevel() - (this.ducking ? this.h * DUCK_SCALE : this.h);
    },

    reset() {
      this.x = canvas.width * 0.18;
      this.y = this.groundY;
      this.vy = 0;
      this.ducking = false;
      this.grounded = true;
      this.jumpCount = 0;
      this.legPhase = 0;
      this.eyeBlink = 0;
    },

    jump() {
      if (this.jumpCount < 2) {
        this.vy = JUMP_VEL;
        this.grounded = false;
        this.ducking = false;
        this.jumpCount++;
        spawnJumpParticles(this);
      }
    },

    duck(on) {
      if (on && !this.grounded) return;
      this.ducking = on;
      if (on) this.y = this.groundY;
    },

    update() {
      if (!this.grounded) {
        this.vy += GRAVITY;
        this.y  += this.vy;
        const gY = this.groundY;
        if (this.y >= gY) {
          this.y = gY;
          this.vy = 0;
          this.grounded = true;
          this.jumpCount = 0;
        }
      } else {
        this.y = this.groundY;
      }
      this.legPhase  = (this.legPhase + (this.grounded ? 0.25 : 0)) % (Math.PI * 2);
      this.eyeBlink  = Math.max(0, this.eyeBlink - 1);
    },

    draw() {
      const W = this.w, H = this.ducking ? this.h * DUCK_SCALE : this.h;
      const x = this.x, y = this.y;
      const cx = x + W / 2, cy = y + H / 2;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      const bodyColor   = accent || '#3B82F6';
      const darkBody    = shadeColor(bodyColor, -30);
      const lightAccent = shadeColor(bodyColor, 40);

      ctx.save();

      if (this.ducking) {
        // ── Duck form ──
        // Body (wide ellipse)
        roundRect(ctx, x + 2, y + H * 0.15, W - 4, H * 0.72, 8);
        ctx.fillStyle = bodyColor;
        ctx.fill();

        // Shell ridges
        for (let i = 0; i < 3; i++) {
          const rx = x + 6 + i * (W - 12) / 3;
          ctx.beginPath();
          ctx.moveTo(rx, y + H * 0.18);
          ctx.lineTo(rx + (W - 12) / 3 - 2, y + H * 0.18);
          ctx.strokeStyle = lightAccent;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Head
        roundRect(ctx, x + W * 0.55, y - H * 0.05, W * 0.42, H * 0.55, 7);
        ctx.fillStyle = bodyColor;
        ctx.fill();

        // Eye
        const eyeX = x + W * 0.82, eyeY = y + H * 0.12;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        if (this.eyeBlink > 0) {
          ctx.beginPath();
          ctx.moveTo(eyeX - 4, eyeY);
          ctx.lineTo(eyeX + 4, eyeY);
          ctx.strokeStyle = darkBody;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(eyeX + 0.8, eyeY + 0.8, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = '#111';
          ctx.fill();
        }

        // Legs
        for (let i = 0; i < 4; i++) {
          const lx = x + 6 + i * ((W - 12) / 3);
          const phase = this.legPhase + i * 0.8;
          const swing = Math.sin(phase) * 3;
          ctx.beginPath();
          ctx.moveTo(lx, y + H * 0.85);
          ctx.lineTo(lx + swing, y + H + 4);
          ctx.strokeStyle = darkBody;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

      } else {
        // ── Run form ──
        // Body
        roundRect(ctx, x + 4, y + H * 0.28, W - 8, H * 0.55, 10);
        ctx.fillStyle = bodyColor;
        ctx.fill();

        // Head
        roundRect(ctx, x + W * 0.3, y, W * 0.66, H * 0.46, 9);
        ctx.fillStyle = bodyColor;
        ctx.fill();

        // Beak
        ctx.beginPath();
        ctx.moveTo(x + W - 2, y + H * 0.2);
        ctx.lineTo(x + W + 8, y + H * 0.26);
        ctx.lineTo(x + W - 2, y + H * 0.32);
        ctx.closePath();
        ctx.fillStyle = lightAccent;
        ctx.fill();

        // Eye
        const eyeX = x + W * 0.76, eyeY = y + H * 0.16;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        if (this.eyeBlink > 0) {
          ctx.beginPath();
          ctx.moveTo(eyeX - 5, eyeY);
          ctx.lineTo(eyeX + 5, eyeY);
          ctx.strokeStyle = darkBody;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(eyeX + 1, eyeY + 1, 2.8, 0, Math.PI * 2);
          ctx.fillStyle = '#111';
          ctx.fill();
          // Pupil highlight
          ctx.beginPath();
          ctx.arc(eyeX + 0.5, eyeY, 1, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fill();
        }

        // Tail
        ctx.beginPath();
        ctx.moveTo(x + 6, y + H * 0.52);
        ctx.quadraticCurveTo(x - 10, y + H * 0.42, x - 4, y + H * 0.7);
        ctx.strokeStyle = darkBody;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Wing
        const wingY = y + H * 0.35 + Math.sin(this.legPhase * 2) * 3;
        ctx.beginPath();
        ctx.ellipse(x + W * 0.35, wingY, 10, 5, -0.2, 0, Math.PI * 2);
        ctx.fillStyle = darkBody;
        ctx.fill();

        // Legs
        const l1 = Math.sin(this.legPhase) * 10;
        const l2 = Math.sin(this.legPhase + Math.PI) * 10;
        drawLeg(ctx, x + W * 0.38, y + H * 0.82, l1, darkBody);
        drawLeg(ctx, x + W * 0.58, y + H * 0.82, l2, darkBody);
      }

      ctx.restore();
    },

    get hitbox() {
      const W = this.ducking ? this.w * 0.85 : this.w * 0.7;
      const H = this.ducking ? this.h * DUCK_SCALE * 0.8 : this.h * 0.75;
      const offX = (this.w - W) / 2;
      const offY = this.ducking ? this.h * DUCK_SCALE * 0.1 : this.h * 0.18;
      return { x: this.x + offX, y: this.y + offY, w: W, h: H };
    }
  };

  // ── Helpers ───────────────────────────────────────────────
  function groundLevel() {
    return Math.round(canvas.height * 0.08);
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function drawLeg(ctx, x, y, swing, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + swing * 0.5, y + 10);
    ctx.lineTo(x + swing, y + 18);
    ctx.stroke();
    ctx.restore();
  }

  function shadeColor(col, amt) {
    // simple brightness shift for hex colors
    try {
      let usePound = false;
      if (col[0] === '#') { col = col.slice(1); usePound = true; }
      const num = parseInt(col, 16);
      let r = (num >> 16) + amt;
      let g = ((num >> 8) & 0x00FF) + amt;
      let b = (num & 0x0000FF) + amt;
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      return (usePound ? '#' : '') + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    } catch { return col; }
  }

  // ── Obstacles ─────────────────────────────────────────────
  function createCactus() {
    const groundY = canvas.height - groundLevel();
    const tall    = Math.random() > 0.4;
    const h       = tall ? 60 + Math.random() * 20 : 34 + Math.random() * 14;
    const w       = 22 + Math.random() * 12;
    const clusters = Math.random() > 0.6 ? 2 : 1;
    return {
      type: 'cactus',
      x: canvas.width + 20,
      y: groundY - h,
      w: w * clusters + (clusters - 1) * 6,
      h,
      tall,
      clusters,
      color: isNight ? '#4B7A5A' : '#3A7A4A',
    };
  }

  function createBird() {
    const groundY = canvas.height - groundLevel();
    const heights = [
      groundY - 30,
      groundY - 65,
      groundY - 110,
    ];
    const hy = heights[Math.floor(Math.random() * heights.length)];
    return {
      type: 'bird',
      x: canvas.width + 20,
      y: hy - 18,
      w: 42,
      h: 20,
      wingPhase: 0,
      color: isNight ? '#9370DB' : '#E05030',
    };
  }

  function drawCactus(o) {
    const col  = o.color;
    const dark = shadeColor(col, -25);

    for (let c = 0; c < o.clusters; c++) {
      const cx = o.x + c * (o.w / o.clusters + 3);
      const baseW = o.w / o.clusters;
      const baseH = o.h;

      // Main stem
      roundRect(ctx, cx + baseW * 0.3, o.y, baseW * 0.4, baseH, 4);
      ctx.fillStyle = col;
      ctx.fill();
      // Stem shade
      roundRect(ctx, cx + baseW * 0.3, o.y, baseW * 0.15, baseH, 4);
      ctx.fillStyle = dark;
      ctx.fill();

      // Arms
      const armH = o.tall ? baseH * 0.45 : baseH * 0.35;
      const armY = o.y + baseH * (o.tall ? 0.28 : 0.32);

      if (c % 2 === 0) {
        // Left arm
        roundRect(ctx, cx, armY, baseW * 0.32, 8, 4);
        ctx.fillStyle = col; ctx.fill();
        roundRect(ctx, cx, armY - armH, 8, armH + 8, 4);
        ctx.fillStyle = col; ctx.fill();
        // tip
        roundRect(ctx, cx, armY - armH, 8, 10, 3);
        ctx.fillStyle = dark; ctx.fill();
      } else {
        // Right arm
        roundRect(ctx, cx + baseW * 0.68, armY, baseW * 0.32, 8, 4);
        ctx.fillStyle = col; ctx.fill();
        roundRect(ctx, cx + baseW * 0.6, armY - armH, 8, armH + 8, 4);
        ctx.fillStyle = col; ctx.fill();
        roundRect(ctx, cx + baseW * 0.6, armY - armH, 8, 10, 3);
        ctx.fillStyle = dark; ctx.fill();
      }

      // Top tip
      roundRect(ctx, cx + baseW * 0.28, o.y, baseW * 0.44, 10, 3);
      ctx.fillStyle = dark; ctx.fill();
    }
  }

  function drawBird(o) {
    o.wingPhase += 0.2;
    const W = o.w, H = o.h;
    const x = o.x, y = o.y;
    const wingOff = Math.sin(o.wingPhase) * 8;
    const col  = o.color;
    const dark = shadeColor(col, -30);

    // Body
    ctx.beginPath();
    ctx.ellipse(x + W / 2, y + H / 2, W * 0.36, H * 0.36, 0, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();

    // Upper wings
    ctx.beginPath();
    ctx.moveTo(x + W / 2, y + H / 2 - 3);
    ctx.quadraticCurveTo(x + W * 0.15, y + H / 2 - wingOff - 8, x + 2, y + H / 2 - 2);
    ctx.quadraticCurveTo(x + W * 0.15, y + H / 2 - wingOff + 2, x + W / 2, y + H / 2 + 4);
    ctx.fillStyle = col;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x + W / 2, y + H / 2 - 3);
    ctx.quadraticCurveTo(x + W * 0.85, y + H / 2 - wingOff - 8, x + W - 2, y + H / 2 - 2);
    ctx.quadraticCurveTo(x + W * 0.85, y + H / 2 - wingOff + 2, x + W / 2, y + H / 2 + 4);
    ctx.fillStyle = col;
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(x + W - 6, y + H / 2 - 2);
    ctx.lineTo(x + W + 6, y + H / 2 + 1);
    ctx.lineTo(x + W - 6, y + H / 2 + 4);
    ctx.closePath();
    ctx.fillStyle = '#F5A623';
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(x + W * 0.75, y + H * 0.35, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + W * 0.76, y + H * 0.36, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    // Tail feathers
    ctx.beginPath();
    ctx.moveTo(x + 6, y + H / 2);
    ctx.quadraticCurveTo(x - 8, y + H / 2 - 5, x - 4, y + H / 2 - 10);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 6, y + H / 2);
    ctx.quadraticCurveTo(x - 6, y + H / 2 + 5, x - 2, y + H / 2 + 12);
    ctx.stroke();
  }

  // ── Particles ─────────────────────────────────────────────
  function spawnJumpParticles(d) {
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: d.x + d.w / 2,
        y: d.y + (d.ducking ? d.h * DUCK_SCALE : d.h),
        vx: (Math.random() - 0.5) * 3,
        vy: -(Math.random() * 2 + 1),
        life: 18 + Math.random() * 10,
        maxLife: 28,
        r: 3 + Math.random() * 3,
        color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3B82F6',
      });
    }
  }

  function spawnDeathParticles(d) {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      particles.push({
        x: d.x + d.w / 2,
        y: d.y + (d.ducking ? d.h * DUCK_SCALE : d.h) / 2,
        vx: Math.cos(angle) * (2 + Math.random() * 3),
        vy: Math.sin(angle) * (2 + Math.random() * 3),
        life: 30,
        maxLife: 30,
        r: 3 + Math.random() * 4,
        color: '#EF4444',
      });
    }
  }

  function updateParticles() {
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.vy  += 0.15;
      p.life -= 1;
    });
  }

  function drawParticles() {
    particles.forEach(p => {
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * alpha, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(p.color, alpha);
      ctx.fill();
    });
  }

  function hexToRgba(hex, alpha) {
    try {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
    } catch { return `rgba(59,130,246,${alpha})`; }
  }

  // ── Background ────────────────────────────────────────────
  function initBackground() {
    bgStars = [];
    for (let i = 0; i < 60; i++) {
      bgStars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * (canvas.height * 0.65),
        r: Math.random() * 1.5 + 0.3,
        twinkle: Math.random() * Math.PI * 2,
      });
    }
    clouds = [];
    for (let i = 0; i < 4; i++) {
      clouds.push({
        x: Math.random() * canvas.width,
        y: canvas.height * (0.08 + Math.random() * 0.25),
        w: 60 + Math.random() * 60,
        h: 20 + Math.random() * 18,
        speed: 0.3 + Math.random() * 0.3,
      });
    }
  }

  function drawBackground() {
    const boardBg = getComputedStyle(document.documentElement).getPropertyValue('--board-bg').trim();
    ctx.fillStyle = boardBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (isNight) {
      // Night sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.7);
      grad.addColorStop(0, '#0A0E1A');
      grad.addColorStop(1, boardBg);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.7);

      // Stars
      bgStars.forEach(s => {
        s.twinkle += 0.03;
        const alpha = 0.5 + Math.sin(s.twinkle) * 0.4;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${alpha})`;
        ctx.fill();
      });

      // Moon
      const moonX = canvas.width * 0.78, moonY = canvas.height * 0.13;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 18, 0, Math.PI * 2);
      ctx.fillStyle = '#E8E0B0';
      ctx.fill();
      // Moon shadow
      ctx.beginPath();
      ctx.arc(moonX + 6, moonY - 3, 15, 0, Math.PI * 2);
      ctx.fillStyle = isNight ? '#0A0E1A' : boardBg;
      ctx.fill();
    } else {
      // Day sky
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.55);
      grad.addColorStop(0, '#CEEEFF');
      grad.addColorStop(1, boardBg);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.55);

      // Sun
      const sunX = canvas.width * 0.82, sunY = canvas.height * 0.12;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      // Sun glow
      ctx.beginPath();
      ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,215,0,0.18)';
      ctx.fill();
    }

    // Clouds
    clouds.forEach(c => {
      c.x -= c.speed * (speed / BASE_SPEED) * 0.3;
      if (c.x + c.w < 0) c.x = canvas.width + c.w;
      drawCloud(c.x, c.y, c.w, c.h);
    });
  }

  function drawCloud(x, y, w, h) {
    const alpha = isNight ? 0.25 : 0.55;
    ctx.save();
    ctx.fillStyle = isNight ? `rgba(180,190,220,${alpha})` : `rgba(255,255,255,${alpha})`;
    // Puff shapes
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, y + h * 0.55, w * 0.42, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w * 0.28, y + h * 0.65, w * 0.28, h * 0.33, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w * 0.73, y + h * 0.65, w * 0.26, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGround() {
    const groundY  = canvas.height - groundLevel();
    const textPrimary = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
    const lineCol  = isNight ? 'rgba(100,110,140,0.7)' : (textPrimary || 'rgba(100,100,100,0.6)');

    // Ground line
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.strokeStyle = lineCol;
    ctx.lineWidth = GROUND_H;
    ctx.stroke();

    // Moving ground dashes
    ctx.save();
    ctx.setLineDash([18, 24]);
    ctx.lineDashOffset = -groundX;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 6);
    ctx.lineTo(canvas.width, groundY + 6);
    ctx.strokeStyle = isNight ? 'rgba(80,90,120,0.4)' : 'rgba(150,150,150,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Small pebbles
    ctx.fillStyle = isNight ? 'rgba(120,130,160,0.5)' : 'rgba(140,140,140,0.4)';
    for (let i = 0; i < 8; i++) {
      const px = ((groundX * 0.4 + i * 61) % canvas.width);
      const py = groundY + 10 + (i % 3) * 4;
      ctx.beginPath();
      ctx.ellipse(px, py, 3, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Collision ─────────────────────────────────────────────
  function checkCollisions() {
    const d = dino.hitbox;
    for (const o of obstacles) {
      const ox = o.type === 'bird' ? o.x + 6 : o.x + 4;
      const ow = o.type === 'bird' ? o.w - 12 : o.w - 8;
      const oh = o.type === 'bird' ? o.h - 4 : o.h - 4;
      if (
        d.x < ox + ow &&
        d.x + d.w > ox &&
        d.y < o.y + oh &&
        d.y + d.h > o.y
      ) {
        return true;
      }
    }
    return false;
  }

  // ── Spawn logic ───────────────────────────────────────────
  let nextObstacleIn = 90;

  function scheduleNextObstacle() {
    const minGap = Math.max(40, 90 - score * 0.03);
    nextObstacleIn = minGap + Math.random() * 80;
  }

  // ── Score & Speed ─────────────────────────────────────────
  function updateScore(dt) {
    score += speed * 0.05;
    speed = Math.min(MAX_SPEED, BASE_SPEED + score * SPEED_INC);
    const prevNight = isNight;
    isNight = Math.floor(score / NIGHT_EVERY) % 2 === 1;
    if (isNight !== prevNight) {
      document.getElementById('nightBadge').classList.toggle('visible', isNight);
    }
    document.getElementById('scoreVal').textContent = Math.floor(score).toString().padStart(5, '0');
    if (score > hiScore) {
      hiScore = Math.floor(score);
      document.getElementById('hiscoreVal').textContent = hiScore;
    }
    // Random eye blink
    if (Math.random() < 0.003) dino.eyeBlink = 8;
  }

  // ── Main Game Loop ────────────────────────────────────────
  function gameLoop(timestamp) {
    const dt = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;
    frameCount++;

    // Scroll ground
    groundX = (groundX + speed) % canvas.width;

    // Spawn obstacles
    nextObstacleIn -= 1;
    if (nextObstacleIn <= 0) {
      const useBird = score > 150 && Math.random() > 0.55;
      obstacles.push(useBird ? createBird() : createCactus());
      scheduleNextObstacle();
    }

    // Update obstacles
    obstacles.forEach(o => { o.x -= speed; });
    obstacles = obstacles.filter(o => o.x + o.w > -10);

    // Update dino
    dino.update();

    // Score / speed
    updateScore(dt);

    // Particles
    updateParticles();

    // Collision check
    if (checkCollisions()) {
      killDino();
      return;
    }

    // Draw
    draw();

    raf = requestAnimationFrame(gameLoop);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawGround();
    obstacles.forEach(o => {
      if (o.type === 'cactus') drawCactus(o);
      else drawBird(o);
    });
    drawParticles();
    dino.draw();

    // Debug hitboxes (toggle via URL ?debug=1)
    if (new URLSearchParams(location.search).get('debug')) {
      const d = dino.hitbox;
      ctx.strokeStyle = 'red';
      ctx.strokeRect(d.x, d.y, d.w, d.h);
      obstacles.forEach(o => {
        ctx.strokeStyle = 'lime';
        ctx.strokeRect(o.x + 4, o.y, o.w - 8, o.h - 4);
      });
    }
  }

  // ── Game State Transitions ────────────────────────────────
  function startGame() {
    if(typeof Leaderboard!=='undefined')Leaderboard.hide();
    state = 'playing';
    score = 0;
    speed = BASE_SPEED;
    frameCount = 0;
    isNight = false;
    groundX = 0;
    obstacles = [];
    particles = [];
    scheduleNextObstacle();
    initBackground();
    dino.reset();
    document.getElementById('nightBadge').classList.remove('visible');
    document.getElementById('overlayStart').classList.add('hidden');
    document.getElementById('overlayDead').classList.add('hidden');
    document.getElementById('scoreVal').textContent = '00000';
    lastTime = performance.now();
    raf = requestAnimationFrame(gameLoop);
  }

  function killDino() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    state = 'dead';
    spawnDeathParticles(dino);

    // Flash effect
    let flashes = 0;
    const flashInterval = setInterval(() => {
      if (++flashes > 5) {
        clearInterval(flashInterval);
        showDeadOverlay();
        return;
      }
      draw();
      ctx.fillStyle = `rgba(239,68,68,${0.15 * (flashes % 2)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }, 80);

    // Update hi score
    if (Math.floor(score) > hiScore) {
      hiScore = Math.floor(score);
      localStorage.setItem('dino_hi', hiScore);
      document.getElementById('hiscoreVal').textContent = hiScore;
    } else {
      localStorage.setItem('dino_hi', hiScore);
    }
  }

  function showDeadOverlay() {
    document.getElementById('deadScore').textContent  = Math.floor(score).toString().padStart(5, '0');
    document.getElementById('deadHiscore').textContent = hiScore.toString().padStart(5, '0');
    const isNew = Math.floor(score) >= hiScore;
    document.getElementById('deadHiscore').classList.toggle('accent', isNew);
    document.getElementById('overlayDead').classList.remove('hidden');
    if(typeof Leaderboard!=='undefined')Leaderboard.ready('dino',Math.floor(score));
  }

  // ── Input Handling ────────────────────────────────────────
  let duckHeld = false;

  function handleJump() {
    if (state === 'idle' || state === 'dead') {
      if (raf) cancelAnimationFrame(raf);
      startGame();
    } else if (state === 'playing') {
      dino.jump();
    }
  }

  function handleDuckStart() {
    duckHeld = true;
    if (state === 'playing') dino.duck(true);
  }

  function handleDuckEnd() {
    duckHeld = false;
    if (state === 'playing') dino.duck(false);
  }

  // Keyboard
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      handleJump();
    }
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      handleDuckStart();
    }
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'ArrowDown') handleDuckEnd();
  });

  // Touch — tap canvas to jump
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    handleJump();
  }, { passive: false });

  // Buttons
  document.getElementById('btnJump').addEventListener('pointerdown', e => {
    e.preventDefault();
    handleJump();
  });
  document.getElementById('btnDuck').addEventListener('pointerdown', e => {
    e.preventDefault();
    handleDuckStart();
    document.getElementById('btnDuck').classList.add('active');
  });
  document.getElementById('btnDuck').addEventListener('pointerup', e => {
    handleDuckEnd();
    document.getElementById('btnDuck').classList.remove('active');
  });
  document.getElementById('btnDuck').addEventListener('pointerleave', e => {
    handleDuckEnd();
    document.getElementById('btnDuck').classList.remove('active');
  });

  // Overlay buttons
  document.getElementById('btnStart').addEventListener('click', () => {
    if (raf) cancelAnimationFrame(raf);
    startGame();
  });
  document.getElementById('btnRestart').addEventListener('click', () => {
    if (raf) cancelAnimationFrame(raf);
    startGame();
  });

  // ── Initial idle draw ─────────────────────────────────────
  initBackground();
  dino.reset();
  draw();

})();
