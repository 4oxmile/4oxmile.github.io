/* ============================================================
   MAZE RUNNER - Toss WebView Tilt Maze Game
   ============================================================ */

// ── Constants ────────────────────────────────────────────────
const MAZE_COLS = 10;
const MAZE_ROWS = 14;
const BALL_RADIUS_RATIO = 0.28;  // relative to cell size
const FRICTION = 0.96;           // per-frame at 60fps
const MAX_SPEED = 280;           // pixels/second
const TILT_SENSITIVITY = 28;     // tilt-to-acceleration multiplier
const KEY_ACCEL = 600;           // keyboard acceleration (px/s²)
const TRAIL_LENGTH = 14;
const WIN_DISTANCE_RATIO = 0.38; // how close to goal center to win

// ── Utility ──────────────────────────────────────────────────
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function formatTime(ms) {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const millis = Math.floor(ms % 1000);
  return `${min}:${String(sec).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function formatTimeShort(ms) {
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${min}:${String(sec).padStart(2, '0')}.${tenths}`;
}

// ── Maze Generator (Recursive Backtracker) ───────────────────
class MazeGenerator {
  generate(rows, cols) {
    // Initialize grid: every cell has all 4 walls
    const grid = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = { top: true, right: true, bottom: true, left: true, visited: false };
      }
    }

    // DFS carving
    const stack = [{ r: 0, c: 0 }];
    grid[0][0].visited = true;

    while (stack.length > 0) {
      const { r, c } = stack[stack.length - 1];
      const neighbors = this._getUnvisited(grid, r, c, rows, cols);

      if (neighbors.length === 0) {
        stack.pop();
      } else {
        const { nr, nc } = neighbors[Math.floor(Math.random() * neighbors.length)];
        this._removeWall(grid, r, c, nr, nc);
        grid[nr][nc].visited = true;
        stack.push({ r: nr, c: nc });
      }
    }

    return grid;
  }

  _getUnvisited(grid, r, c, rows, cols) {
    const n = [];
    if (r > 0 && !grid[r - 1][c].visited) n.push({ nr: r - 1, nc: c });
    if (r < rows - 1 && !grid[r + 1][c].visited) n.push({ nr: r + 1, nc: c });
    if (c > 0 && !grid[r][c - 1].visited) n.push({ nr: r, nc: c - 1 });
    if (c < cols - 1 && !grid[r][c + 1].visited) n.push({ nr: r, nc: c + 1 });
    return n;
  }

  _removeWall(grid, r1, c1, r2, c2) {
    if (r2 === r1 - 1) { grid[r1][c1].top = false; grid[r2][c2].bottom = false; }
    if (r2 === r1 + 1) { grid[r1][c1].bottom = false; grid[r2][c2].top = false; }
    if (c2 === c1 - 1) { grid[r1][c1].left = false; grid[r2][c2].right = false; }
    if (c2 === c1 + 1) { grid[r1][c1].right = false; grid[r2][c2].left = false; }
  }
}

// ── Sound Manager ────────────────────────────────────────────
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastHitTime = 0;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
    }
  }

  play(type) {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      switch (type) {
        case 'hit': {
          // Throttle hit sounds
          const t = performance.now();
          if (t - this.lastHitTime < 80) return;
          this.lastHitTime = t;
          osc.frequency.value = 180;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.04);
          break;
        }
        case 'victory': {
          osc.frequency.setValueAtTime(523, now);
          osc.frequency.setValueAtTime(659, now + 0.1);
          osc.frequency.setValueAtTime(784, now + 0.2);
          osc.frequency.setValueAtTime(1047, now + 0.3);
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
          break;
        }
        case 'start': {
          osc.frequency.setValueAtTime(330, now);
          osc.frequency.setValueAtTime(440, now + 0.08);
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.start(now);
          osc.stop(now + 0.15);
          break;
        }
      }
    } catch (e) { /* ignore audio errors */ }
  }

  haptic(style) {
    try {
      if (window.AppBridge && window.AppBridge.generateHapticFeedback) {
        window.AppBridge.generateHapticFeedback({ style: style || 'light' });
      } else if (navigator.vibrate) {
        const durations = { light: 10, medium: 20, heavy: 40 };
        navigator.vibrate(durations[style] || 10);
      }
    } catch (e) { /* ignore */ }
  }
}

// ── Game Engine ──────────────────────────────────────────────
class MazeGame {
  constructor() {
    this.rows = MAZE_ROWS;
    this.cols = MAZE_COLS;
    this.grid = null;
    this.cellSize = 0;
    this.ballRadius = 0;

    // Ball state
    this.ballX = 0;
    this.ballY = 0;
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.trail = [];
    this.wallHit = false;

    // Game state
    this.isPlaying = false;
    this.isWon = false;
    this.startTime = 0;
    this.elapsedTime = 0;
    this.bestTime = parseFloat(localStorage.getItem('maze_best_time') || '0');

    this.generator = new MazeGenerator();
  }

  init() {
    this.grid = this.generator.generate(this.rows, this.cols);
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.trail = [];
    this.wallHit = false;
    this.isWon = false;
    this.isPlaying = true;

    // Place ball at center of start cell (0, 0)
    this.ballX = this.cellSize * 0.5;
    this.ballY = this.cellSize * 0.5;

    this.startTime = performance.now();
    this.elapsedTime = 0;
  }

  setCellSize(cs) {
    this.cellSize = cs;
    this.ballRadius = cs * BALL_RADIUS_RATIO;
  }

  update(dt) {
    if (!this.isPlaying || this.isWon) return;

    this.elapsedTime = performance.now() - this.startTime;
    this.wallHit = false;

    // Cap dt to prevent tunneling on lag spikes
    const dtSec = Math.min(dt / 1000, 0.033);

    // Apply tilt/keyboard acceleration
    this.vx += this.ax * dtSec;
    this.vy += this.ay * dtSec;

    // Frame-rate-independent friction
    const frictionFactor = Math.pow(FRICTION, dtSec * 60);
    this.vx *= frictionFactor;
    this.vy *= frictionFactor;

    // Dead zone
    if (Math.abs(this.vx) < 0.3) this.vx = 0;
    if (Math.abs(this.vy) < 0.3) this.vy = 0;

    // Cap speed
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > MAX_SPEED) {
      this.vx = (this.vx / speed) * MAX_SPEED;
      this.vy = (this.vy / speed) * MAX_SPEED;
    }

    // Move ball
    const newX = this.ballX + this.vx * dtSec;
    const newY = this.ballY + this.vy * dtSec;

    // Resolve collisions
    const resolved = this._resolveCollisions(newX, newY);
    this.ballX = resolved.x;
    this.ballY = resolved.y;

    // Update trail
    if (speed > 3) {
      this.trail.push({ x: this.ballX, y: this.ballY });
      if (this.trail.length > TRAIL_LENGTH) this.trail.shift();
    } else if (this.trail.length > 0) {
      this.trail.shift();
    }

    // Win check
    this._checkWin();
  }

  _resolveCollisions(x, y) {
    const cs = this.cellSize;
    const r = this.ballRadius;

    // Clamp to maze boundaries
    x = clamp(x, r, cs * this.cols - r);
    y = clamp(y, r, cs * this.rows - r);

    // Multiple passes to handle corners
    for (let pass = 0; pass < 3; pass++) {
      const col = clamp(Math.floor(x / cs), 0, this.cols - 1);
      const row = clamp(Math.floor(y / cs), 0, this.rows - 1);
      const cell = this.grid[row][col];

      const cellLeft = col * cs;
      const cellRight = (col + 1) * cs;
      const cellTop = row * cs;
      const cellBottom = (row + 1) * cs;

      if (cell.left && x - r < cellLeft) {
        x = cellLeft + r;
        this.vx = 0;
        this.wallHit = true;
      }
      if (cell.right && x + r > cellRight) {
        x = cellRight - r;
        this.vx = 0;
        this.wallHit = true;
      }
      if (cell.top && y - r < cellTop) {
        y = cellTop + r;
        this.vy = 0;
        this.wallHit = true;
      }
      if (cell.bottom && y + r > cellBottom) {
        y = cellBottom - r;
        this.vy = 0;
        this.wallHit = true;
      }
    }

    return { x, y };
  }

  _checkWin() {
    const cs = this.cellSize;
    const endCX = (this.cols - 0.5) * cs;
    const endCY = (this.rows - 0.5) * cs;
    const dist = Math.sqrt((this.ballX - endCX) ** 2 + (this.ballY - endCY) ** 2);

    if (dist < cs * WIN_DISTANCE_RATIO) {
      this.isWon = true;
      this.isPlaying = false;

      if (this.bestTime === 0 || this.elapsedTime < this.bestTime) {
        this.bestTime = this.elapsedTime;
        localStorage.setItem('maze_best_time', String(this.bestTime));
      }
    }
  }
}

// ── Renderer ─────────────────────────────────────────────────
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = 0;
    this.dpr = window.devicePixelRatio || 1;
    this.endPulse = 0;
  }

  resize(game) {
    const wrapper = document.getElementById('maze-wrapper');
    const ww = wrapper.clientWidth - 16;  // padding
    const wh = wrapper.clientHeight - 8;

    const maxCellW = Math.floor(ww / game.cols);
    const maxCellH = Math.floor(wh / game.rows);
    this.cellSize = Math.max(18, Math.min(maxCellW, maxCellH));

    const bw = this.cellSize * game.cols;
    const bh = this.cellSize * game.rows;

    this.canvas.style.width = bw + 'px';
    this.canvas.style.height = bh + 'px';
    this.canvas.width = bw * this.dpr;
    this.canvas.height = bh * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    game.setCellSize(this.cellSize);
    return this.cellSize;
  }

  draw(game, now) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const w = cs * game.cols;
    const h = cs * game.rows;

    ctx.clearRect(0, 0, w, h);

    if (!game.grid) return;

    this._drawMarkers(ctx, game, cs, now);
    this._drawWalls(ctx, game, cs);
    this._drawTrail(ctx, game, cs);
    this._drawBall(ctx, game, cs);
  }

  _drawMarkers(ctx, game, cs, now) {
    // Start marker (top-left cell)
    const startCX = cs * 0.5;
    const startCY = cs * 0.5;
    const markerR = cs * 0.35;

    ctx.save();
    const startGrad = ctx.createRadialGradient(startCX, startCY, 0, startCX, startCY, markerR);
    startGrad.addColorStop(0, 'rgba(34, 197, 94, 0.35)');
    startGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
    ctx.fillStyle = startGrad;
    ctx.beginPath();
    ctx.arc(startCX, startCY, markerR, 0, Math.PI * 2);
    ctx.fill();

    // "S" label
    ctx.fillStyle = 'rgba(34, 197, 94, 0.5)';
    ctx.font = `bold ${Math.round(cs * 0.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', startCX, startCY);
    ctx.restore();

    // End marker (bottom-right cell) with pulse
    const endCX = (game.cols - 0.5) * cs;
    const endCY = (game.rows - 0.5) * cs;
    this.endPulse = (this.endPulse + 0.03) % (Math.PI * 2);
    const pulse = 0.7 + 0.3 * Math.sin(this.endPulse);
    const endR = markerR * pulse;

    ctx.save();
    const endGrad = ctx.createRadialGradient(endCX, endCY, 0, endCX, endCY, endR);
    endGrad.addColorStop(0, `rgba(245, 158, 11, ${0.45 * pulse})`);
    endGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = endGrad;
    ctx.beginPath();
    ctx.arc(endCX, endCY, endR, 0, Math.PI * 2);
    ctx.fill();

    // Star icon
    ctx.fillStyle = `rgba(245, 158, 11, ${0.5 * pulse})`;
    ctx.font = `${Math.round(cs * 0.35)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2605', endCX, endCY);
    ctx.restore();
  }

  _drawWalls(ctx, game, cs) {
    const grid = game.grid;
    const rows = game.rows;
    const cols = game.cols;

    // Read wall color from CSS variable
    const wallColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--wall-color').trim() || 'rgba(203, 213, 225, 0.75)';

    const wallThickness = Math.max(2, cs * 0.1);

    ctx.save();
    ctx.strokeStyle = wallColor;
    ctx.lineWidth = wallThickness;
    ctx.lineCap = 'round';

    ctx.beginPath();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const x = c * cs;
        const y = r * cs;

        // Top wall (drawn for every cell that has it)
        if (cell.top) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + cs, y);
        }
        // Left wall
        if (cell.left) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + cs);
        }
        // Right wall (only for rightmost column)
        if (c === cols - 1 && cell.right) {
          ctx.moveTo(x + cs, y);
          ctx.lineTo(x + cs, y + cs);
        }
        // Bottom wall (only for bottom row)
        if (r === rows - 1 && cell.bottom) {
          ctx.moveTo(x, y + cs);
          ctx.lineTo(x + cs, y + cs);
        }
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  _drawTrail(ctx, game) {
    const trail = game.trail;
    if (trail.length < 2) return;

    ctx.save();
    for (let i = 0; i < trail.length; i++) {
      const alpha = ((i + 1) / trail.length) * 0.25;
      const size = game.ballRadius * (0.2 + 0.6 * ((i + 1) / trail.length));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--ball-color').trim() || '#60A5FA';
      ctx.beginPath();
      ctx.arc(trail[i].x, trail[i].y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawBall(ctx, game, cs) {
    if (!game.isPlaying && !game.isWon) return;

    const x = game.ballX;
    const y = game.ballY;
    const r = game.ballRadius;

    ctx.save();

    // Ball shadow
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.15, y + r * 0.2, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Main ball gradient (3D effect)
    const grad = ctx.createRadialGradient(
      x - r * 0.3, y - r * 0.3, r * 0.1,
      x, y, r
    );

    const ballColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--ball-color').trim() || '#60A5FA';
    const ballHighlight = getComputedStyle(document.documentElement)
      .getPropertyValue('--ball-highlight').trim() || '#BFDBFE';
    const ballShadow = getComputedStyle(document.documentElement)
      .getPropertyValue('--ball-shadow').trim() || '#1E40AF';

    grad.addColorStop(0, ballHighlight);
    grad.addColorStop(0.4, ballColor);
    grad.addColorStop(1, ballShadow);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Specular highlight
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}

// ── App Controller ───────────────────────────────────────────
class App {
  constructor() {
    this.game = new MazeGame();
    this.renderer = new Renderer(document.getElementById('maze-canvas'));
    this.sound = new SoundManager();
    this.state = 'start'; // start | playing | winning | victory

    // Orientation
    this.orientationActive = false;
    this.lastBeta = null;
    this.lastGamma = null;
    this.calibBeta = 0;
    this.calibGamma = 0;
    this.orientationCheckTimer = null;

    // Keyboard
    this.keysPressed = {};

    // Timing
    this.lastFrameTime = 0;
    this.animFrameId = null;
    this.winAnimStart = 0;
    this.loopInterval = null;

    this._bindEvents();
    this._updateBestTimeDisplay();
    this._showHint('게임 시작 버튼을 눌러주세요');
  }

  _bindEvents() {
    // Start button
    document.getElementById('btn-start').addEventListener('click', () => {
      this._requestPermissionAndStart();
    });

    // Restart button
    document.getElementById('btn-restart').addEventListener('click', () => {
      this._startGame();
    });

    // New game button (in header)
    document.getElementById('btn-new-game').addEventListener('click', () => {
      if (this.state === 'playing' || this.state === 'victory') {
        this._startGame();
      }
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      this.keysPressed[e.code] = true;

      // Space to restart
      if (e.code === 'Space' && (this.state === 'start' || this.state === 'victory')) {
        this._requestPermissionAndStart();
      }
    });
    document.addEventListener('keyup', (e) => {
      this.keysPressed[e.code] = false;
    });

    // Device orientation
    window.addEventListener('deviceorientation', (e) => this._onOrientation(e));

    // Visibility change: pause timer when hidden, resume loop when visible
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._stopLoop();
        // Pause game time
        if (this.state === 'playing' && this.game.isPlaying) {
          this.game._pauseTime = this.game.elapsedTime;
        }
      } else {
        if (this.state === 'playing' || this.state === 'winning') {
          // Restore game time
          if (this.game._pauseTime != null) {
            this.game.startTime = performance.now() - this.game._pauseTime;
            this.game._pauseTime = null;
          }
          this.lastFrameTime = performance.now();
          this._startLoop();
        }
      }
    });

    // Resize
    window.addEventListener('resize', () => {
      this.renderer.resize(this.game);
      if (this.game.grid) {
        // Re-place ball proportionally
        this.game.setCellSize(this.renderer.cellSize);
      }
    });

    // Initial resize
    this.renderer.resize(this.game);
  }

  async _requestPermissionAndStart() {
    // Request DeviceOrientation permission (iOS 13+)
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response !== 'granted') {
          this._showHint('기울기 권한이 거부됨 - 방향키를 사용하세요');
        }
      } catch (e) {
        this._showHint('방향키로 구슬을 움직이세요');
      }
    }

    this._startGame();
  }

  _startGame() {
    if(typeof Leaderboard!=='undefined')Leaderboard.hide();
    this.sound.init();
    this.renderer.resize(this.game);
    this.game.init();
    this.state = 'playing';

    // Calibrate tilt
    this.calibBeta = this.lastBeta || 0;
    this.calibGamma = this.lastGamma || 0;
    this.orientationActive = false;

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('victory-screen').classList.add('hidden');

    this.sound.play('start');
    this.sound.haptic('light');

    // Check for orientation support after a short delay
    this.orientationCheckTimer = setTimeout(() => {
      if (!this.orientationActive) {
        this._showHint('방향키(←↑↓→)로 구슬을 움직이세요');
      }
    }, 1500);

    this._showHint('구슬을 굴려 ★까지 도달하세요!');
    this.lastFrameTime = performance.now();
    this._startLoop();
  }

  _startLoop() {
    this._stopLoop();
    const tick = () => this._gameLoop();
    // Use rAF as primary loop
    this.animFrameId = requestAnimationFrame(tick);
    // setInterval fallback for background tabs / WebView edge cases
    this.loopInterval = setInterval(() => {
      if (this.state === 'playing' || this.state === 'winning') {
        this._gameLoop();
      }
    }, 32);
  }

  _stopLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }

  _onOrientation(e) {
    if (e.gamma === null || e.beta === null) return;

    this.lastBeta = e.beta;
    this.lastGamma = e.gamma;

    if (this.state === 'playing' && this.game.isPlaying) {
      if (!this.orientationActive) {
        this.orientationActive = true;
        this.calibBeta = e.beta;
        this.calibGamma = e.gamma;
        this._showHint('기울여서 구슬을 움직이세요!');
      }

      const relGamma = e.gamma - this.calibGamma;
      const relBeta = e.beta - this.calibBeta;

      this.game.ax = clamp(relGamma, -35, 35) * TILT_SENSITIVITY;
      this.game.ay = clamp(relBeta, -35, 35) * TILT_SENSITIVITY;
    }
  }

  _updateKeyboardInput() {
    if (this.orientationActive) return;

    let kx = 0, ky = 0;
    if (this.keysPressed['ArrowLeft'] || this.keysPressed['KeyA']) kx -= 1;
    if (this.keysPressed['ArrowRight'] || this.keysPressed['KeyD']) kx += 1;
    if (this.keysPressed['ArrowUp'] || this.keysPressed['KeyW']) ky -= 1;
    if (this.keysPressed['ArrowDown'] || this.keysPressed['KeyS']) ky += 1;

    this.game.ax = kx * KEY_ACCEL;
    this.game.ay = ky * KEY_ACCEL;
  }

  _gameLoop() {
    if (this.state !== 'playing' && this.state !== 'winning') {
      this._stopLoop();
      return;
    }

    const now = performance.now();
    const dt = Math.min(now - this.lastFrameTime, 100); // cap to prevent spiral
    if (dt < 4) return; // skip if called too fast (rAF + setInterval overlap)
    this.lastFrameTime = now;

    if (this.state === 'playing') {
      this._updateKeyboardInput();
      this.game.update(dt);

      // Wall hit feedback
      if (this.game.wallHit) {
        this.sound.play('hit');
        this.sound.haptic('light');
      }

      // Check win
      if (this.game.isWon) {
        this.state = 'winning';
        this.winAnimStart = now;
        this.sound.play('victory');
        this.sound.haptic('heavy');
      }

      // Update timer display
      document.getElementById('timer').textContent =
        formatTimeShort(this.game.elapsedTime);
    }

    if (this.state === 'winning') {
      // Brief celebration, then show overlay
      if (now - this.winAnimStart > 800) {
        this._showVictory();
        this.renderer.draw(this.game, now);
        this._stopLoop();
        return;
      }
    }

    this.renderer.draw(this.game, now);
  }

  _showVictory() {
    this.state = 'victory';
    if(typeof Leaderboard!=='undefined')Leaderboard.ready('maze',this.game.elapsedTime,{ascending:true,format:'time',label:'시간'});

    const time = this.game.elapsedTime;
    document.getElementById('final-time-value').textContent = formatTime(time);

    const isRecord = this.game.bestTime > 0 && time <= this.game.bestTime;
    document.getElementById('new-record').classList.toggle('hidden', !isRecord);

    this._updateBestTimeDisplay();
    document.getElementById('victory-screen').classList.remove('hidden');
  }

  _updateBestTimeDisplay() {
    const best = this.game.bestTime;
    const text = best > 0 ? formatTime(best) : '--:--.---';
    const startEl = document.getElementById('start-best');
    const victoryEl = document.getElementById('victory-best');
    if (startEl) startEl.textContent = text;
    if (victoryEl) victoryEl.textContent = text;
  }

  _showHint(text) {
    const el = document.getElementById('hint-text');
    if (el) el.textContent = text;
  }
}

// ── Initialize ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
