/* ============================================================
   TETRIS - Apps in Toss WebView Game
   ============================================================ */

// ── Constants ────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const HIDDEN_ROWS = 2; // rows above visible area
const TOTAL_ROWS = ROWS + HIDDEN_ROWS;

const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  O: [[1,1],[1,1]],
  T: [[0,1,0],[1,1,1],[0,0,0]],
  S: [[0,1,1],[1,1,0],[0,0,0]],
  Z: [[1,1,0],[0,1,1],[0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]],
  L: [[0,0,1],[1,1,1],[0,0,0]],
};

const PIECE_NAMES = ['I','O','T','S','Z','J','L'];

const COLORS = {
  I: '#00D8FF',
  O: '#FFD500',
  T: '#B15DFF',
  S: '#51E066',
  Z: '#FF4757',
  J: '#3B82F6',
  L: '#FF8A00',
};

// Darker shade for block borders
const COLORS_DARK = {
  I: '#00A8CC',
  O: '#CCB000',
  T: '#8A3FCC',
  S: '#3AB050',
  Z: '#CC3845',
  J: '#2D66CC',
  L: '#CC6F00',
};

const COLORS_LIGHT = {
  I: '#66EAFF',
  O: '#FFE566',
  T: '#CFA0FF',
  S: '#8AF09A',
  Z: '#FF8A94',
  J: '#7EB3FF',
  L: '#FFB54D',
};

// Scoring (Tetris Guideline)
const SCORE_TABLE = {
  0: 0,
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

// Speed curve: milliseconds per drop per level
const SPEED_CURVE = [
  800, 720, 630, 550, 470, 380, 300, 220, 150, 100,
  80, 80, 80, 70, 70, 70, 50, 50, 50, 30,
];

const DAS_DELAY = 170;  // Delayed Auto Shift
const ARR_RATE = 50;    // Auto Repeat Rate
const LOCK_DELAY = 500; // ms before locking
const MAX_LOCK_RESETS = 15;

// ── SRS Wall Kick Data ───────────────────────────────────────
// (dcol, drow) in game coords: +col=right, +row=down
const KICKS_JLSTZ = {
  '0>1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '1>2': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  '2>3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '3>0': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '1>0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  '2>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
  '3>2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  '0>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
};

const KICKS_I = {
  '0>1': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  '1>2': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  '2>3': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  '3>0': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
  '1>0': [[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
  '2>1': [[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
  '3>2': [[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
  '0>3': [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
};

// ── Utility Functions ────────────────────────────────────────
function rotateMatrix(matrix) {
  const N = matrix.length;
  const result = [];
  for (let r = 0; r < N; r++) {
    result[r] = [];
    for (let c = 0; c < N; c++) {
      result[r][c] = matrix[N - 1 - c][r];
    }
  }
  return result;
}

function rotateMatrixCCW(matrix) {
  const N = matrix.length;
  const result = [];
  for (let r = 0; r < N; r++) {
    result[r] = [];
    for (let c = 0; c < N; c++) {
      result[r][c] = matrix[c][N - 1 - r];
    }
  }
  return result;
}

function getShapeRotation(shape, rotation) {
  let m = shape.map(r => [...r]);
  for (let i = 0; i < rotation; i++) {
    m = rotateMatrix(m);
  }
  return m;
}

// 7-bag randomizer
function createBag() {
  const bag = [...PIECE_NAMES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// ── Sound Manager ────────────────────────────────────────────
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
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
        case 'move':
          osc.frequency.value = 200;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
          osc.start(now);
          osc.stop(now + 0.05);
          break;
        case 'rotate':
          osc.frequency.value = 400;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.1, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
          break;
        case 'drop':
          osc.frequency.value = 150;
          osc.type = 'triangle';
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.start(now);
          osc.stop(now + 0.12);
          break;
        case 'lock':
          osc.frequency.value = 120;
          osc.type = 'square';
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
          osc.start(now);
          osc.stop(now + 0.1);
          break;
        case 'clear':
          osc.frequency.setValueAtTime(523, now);
          osc.frequency.linearRampToValueAtTime(1047, now + 0.15);
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.start(now);
          osc.stop(now + 0.2);
          break;
        case 'tetris':
          osc.frequency.setValueAtTime(523, now);
          osc.frequency.setValueAtTime(659, now + 0.08);
          osc.frequency.setValueAtTime(784, now + 0.16);
          osc.frequency.setValueAtTime(1047, now + 0.24);
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
          break;
        case 'gameover':
          osc.frequency.setValueAtTime(400, now);
          osc.frequency.linearRampToValueAtTime(100, now + 0.5);
          osc.type = 'sawtooth';
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
          break;
        case 'hold':
          osc.frequency.value = 300;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.start(now);
          osc.stop(now + 0.06);
          break;
        case 'levelup':
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(554, now + 0.1);
          osc.frequency.setValueAtTime(659, now + 0.2);
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.35);
          break;
      }
    } catch (e) { /* ignore audio errors */ }
  }

  // Try Toss Bedrock haptic feedback
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
class TetrisGame {
  constructor() {
    this.board = [];
    this.currentPiece = null;
    this.currentX = 0;
    this.currentY = 0;
    this.currentRotation = 0;
    this.currentType = '';
    this.holdType = null;
    this.holdUsed = false;
    this.bag = [];
    this.nextQueue = [];
    this.score = 0;
    this.level = 1;
    this.linesCleared = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.isGameOver = false;
    this.lastDropTime = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.isLocking = false;
    this.combo = -1;
    this.clearedRows = [];       // rows being animated
    this.clearAnimTimer = 0;
    this.clearAnimDuration = 250; // ms
    this.highScore = parseInt(localStorage.getItem('tetris_highscore') || '0', 10);
  }

  init() {
    this.board = Array.from({ length: TOTAL_ROWS }, () => Array(COLS).fill(null));
    this.bag = [];
    this.nextQueue = [];
    this.holdType = null;
    this.holdUsed = false;
    this.score = 0;
    this.level = 1;
    this.linesCleared = 0;
    this.combo = -1;
    this.clearedRows = [];
    this.clearAnimTimer = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.isPlaying = true;

    // Fill next queue
    for (let i = 0; i < 3; i++) {
      this.nextQueue.push(this._nextFromBag());
    }
    this._spawnPiece();
  }

  _nextFromBag() {
    if (this.bag.length === 0) {
      this.bag = createBag();
    }
    return this.bag.pop();
  }

  _spawnPiece() {
    const type = this.nextQueue.shift();
    this.nextQueue.push(this._nextFromBag());

    this.currentType = type;
    this.currentRotation = 0;
    this.currentPiece = getShapeRotation(SHAPES[type], 0);

    const size = this.currentPiece.length;
    this.currentX = Math.floor((COLS - size) / 2);
    this.currentY = 0; // top of total (hidden area)

    this.lockTimer = 0;
    this.lockResets = 0;
    this.isLocking = false;
    this.holdUsed = false;

    // Check if spawn position is valid
    if (!this._isValid(this.currentPiece, this.currentX, this.currentY)) {
      this.isGameOver = true;
      this.isPlaying = false;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem('tetris_highscore', String(this.highScore));
      }
    }
  }

  _isValid(piece, x, y) {
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (!piece[r][c]) continue;
        const bx = x + c;
        const by = y + r;
        if (bx < 0 || bx >= COLS || by >= TOTAL_ROWS) return false;
        if (by >= 0 && this.board[by][bx] !== null) return false;
      }
    }
    return true;
  }

  _lockPiece() {
    const piece = this.currentPiece;
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (!piece[r][c]) continue;
        const bx = this.currentX + c;
        const by = this.currentY + r;
        if (by >= 0 && by < TOTAL_ROWS) {
          this.board[by][bx] = this.currentType;
        }
      }
    }

    // Check for line clears
    this.clearedRows = [];
    for (let r = TOTAL_ROWS - 1; r >= 0; r--) {
      if (this.board[r].every(cell => cell !== null)) {
        this.clearedRows.push(r);
      }
    }

    if (this.clearedRows.length > 0) {
      this.clearAnimTimer = performance.now();
      this.combo++;
      return 'clearing';
    }

    this.combo = -1;
    this._spawnPiece();
    return 'locked';
  }

  _finishClear() {
    const count = this.clearedRows.length;

    // Remove cleared rows
    for (const row of this.clearedRows.sort((a, b) => b - a)) {
      this.board.splice(row, 1);
    }
    // Add empty rows at top
    for (let i = 0; i < count; i++) {
      this.board.unshift(Array(COLS).fill(null));
    }

    // Scoring
    const base = SCORE_TABLE[count] || 0;
    const comboBonus = this.combo > 0 ? 50 * this.combo * this.level : 0;
    this.score += base * this.level + comboBonus;
    this.linesCleared += count;

    // Level up
    const newLevel = Math.floor(this.linesCleared / 10) + 1;
    const leveledUp = newLevel > this.level;
    this.level = Math.min(newLevel, SPEED_CURVE.length);

    this.clearedRows = [];
    this.clearAnimTimer = 0;
    this._spawnPiece();

    return { count, leveledUp };
  }

  getDropInterval() {
    return SPEED_CURVE[Math.min(this.level - 1, SPEED_CURVE.length - 1)];
  }

  getGhostY() {
    let gy = this.currentY;
    while (this._isValid(this.currentPiece, this.currentX, gy + 1)) {
      gy++;
    }
    return gy;
  }

  // ── Actions ──
  moveLeft() {
    if (!this.isPlaying || this.isPaused || this.clearedRows.length > 0) return false;
    if (this._isValid(this.currentPiece, this.currentX - 1, this.currentY)) {
      this.currentX--;
      this._resetLockIfNeeded();
      return true;
    }
    return false;
  }

  moveRight() {
    if (!this.isPlaying || this.isPaused || this.clearedRows.length > 0) return false;
    if (this._isValid(this.currentPiece, this.currentX + 1, this.currentY)) {
      this.currentX++;
      this._resetLockIfNeeded();
      return true;
    }
    return false;
  }

  softDrop() {
    if (!this.isPlaying || this.isPaused || this.clearedRows.length > 0) return false;
    if (this._isValid(this.currentPiece, this.currentX, this.currentY + 1)) {
      this.currentY++;
      this.score += 1;
      this.lastDropTime = performance.now();
      this.isLocking = false;
      return true;
    }
    return false;
  }

  hardDrop() {
    if (!this.isPlaying || this.isPaused || this.clearedRows.length > 0) return 'none';
    let distance = 0;
    while (this._isValid(this.currentPiece, this.currentX, this.currentY + 1)) {
      this.currentY++;
      distance++;
    }
    this.score += distance * 2;
    return this._lockPiece();
  }

  rotate(clockwise = true) {
    if (!this.isPlaying || this.isPaused || this.clearedRows.length > 0) return false;
    if (this.currentType === 'O') return false;

    const oldRotation = this.currentRotation;
    const newRotation = clockwise
      ? (oldRotation + 1) % 4
      : (oldRotation + 3) % 4;

    const newPiece = clockwise
      ? rotateMatrix(this.currentPiece)
      : rotateMatrixCCW(this.currentPiece);

    const kickKey = `${oldRotation}>${newRotation}`;
    const kicks = this.currentType === 'I' ? KICKS_I[kickKey] : KICKS_JLSTZ[kickKey];

    if (!kicks) return false;

    for (const [dx, dy] of kicks) {
      if (this._isValid(newPiece, this.currentX + dx, this.currentY + dy)) {
        this.currentPiece = newPiece;
        this.currentX += dx;
        this.currentY += dy;
        this.currentRotation = newRotation;
        this._resetLockIfNeeded();
        return true;
      }
    }
    return false;
  }

  hold() {
    if (!this.isPlaying || this.isPaused || this.holdUsed || this.clearedRows.length > 0) return false;
    const prevHold = this.holdType;
    this.holdType = this.currentType;
    this.holdUsed = true;

    if (prevHold) {
      this.currentType = prevHold;
      this.currentRotation = 0;
      this.currentPiece = getShapeRotation(SHAPES[prevHold], 0);
      const size = this.currentPiece.length;
      this.currentX = Math.floor((COLS - size) / 2);
      this.currentY = 0;
      this.lockTimer = 0;
      this.lockResets = 0;
      this.isLocking = false;
    } else {
      this._spawnPiece();
    }
    return true;
  }

  _resetLockIfNeeded() {
    if (this.isLocking && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = performance.now();
      this.lockResets++;
    }
  }

  // Called each frame
  update(now) {
    if (!this.isPlaying || this.isPaused) return null;

    // Handle clear animation
    if (this.clearedRows.length > 0) {
      if (now - this.clearAnimTimer >= this.clearAnimDuration) {
        return { event: 'clearDone', ...this._finishClear() };
      }
      return { event: 'clearing' };
    }

    // Gravity
    const interval = this.getDropInterval();
    if (now - this.lastDropTime >= interval) {
      if (this._isValid(this.currentPiece, this.currentX, this.currentY + 1)) {
        this.currentY++;
        this.isLocking = false;
        this.lastDropTime = now;
      } else {
        // Start lock delay
        if (!this.isLocking) {
          this.isLocking = true;
          this.lockTimer = now;
        } else if (now - this.lockTimer >= LOCK_DELAY) {
          const result = this._lockPiece();
          return { event: result === 'clearing' ? 'startClear' : 'lock' };
        }
        this.lastDropTime = now;
      }
    }

    return { event: 'tick' };
  }
}

// ── Renderer ─────────────────────────────────────────────────
class Renderer {
  constructor(boardCanvas, holdCanvas, nextCanvas) {
    this.boardCanvas = boardCanvas;
    this.boardCtx = boardCanvas.getContext('2d');
    this.holdCanvas = holdCanvas;
    this.holdCtx = holdCanvas.getContext('2d');
    this.nextCanvas = nextCanvas;
    this.nextCtx = nextCanvas.getContext('2d');
    this.cellSize = 0;
    this.dpr = window.devicePixelRatio || 1;
  }

  resize() {
    const wrapper = document.getElementById('game-board-wrapper');
    const ww = wrapper.clientWidth;
    const wh = wrapper.clientHeight;

    // Calculate cell size to fit
    const maxCellW = Math.floor(ww / COLS);
    const maxCellH = Math.floor(wh / ROWS);
    this.cellSize = Math.min(maxCellW, maxCellH);

    const bw = this.cellSize * COLS;
    const bh = this.cellSize * ROWS;

    this.boardCanvas.style.width = bw + 'px';
    this.boardCanvas.style.height = bh + 'px';
    this.boardCanvas.width = bw * this.dpr;
    this.boardCanvas.height = bh * this.dpr;
    this.boardCtx.scale(this.dpr, this.dpr);

    // Hold & Next canvases (cap preview size for compact header)
    const previewCell = Math.min(Math.floor(this.cellSize * 0.5), 16);
    const holdSize = previewCell * 4 + 8;
    this.holdCanvas.style.width = holdSize + 'px';
    this.holdCanvas.style.height = holdSize + 'px';
    this.holdCanvas.width = holdSize * this.dpr;
    this.holdCanvas.height = holdSize * this.dpr;
    this.holdCtx.scale(this.dpr, this.dpr);

    const nextH = previewCell * 4 * 3 + 16;
    this.nextCanvas.style.width = holdSize + 'px';
    this.nextCanvas.style.height = nextH + 'px';
    this.nextCanvas.width = holdSize * this.dpr;
    this.nextCanvas.height = nextH * this.dpr;
    this.nextCtx.scale(this.dpr, this.dpr);

    this.previewCell = previewCell;
    this.holdSize = holdSize;
  }

  drawBoard(game) {
    const ctx = this.boardCtx;
    const cs = this.cellSize;
    const w = cs * COLS;
    const h = cs * ROWS;

    ctx.clearRect(0, 0, w, h);

    // Draw grid
    ctx.strokeStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--board-grid').trim();
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cs, 0);
      ctx.lineTo(c * cs, h);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cs);
      ctx.lineTo(w, r * cs);
      ctx.stroke();
    }

    // Draw locked blocks
    if (!game.board || game.board.length === 0) return;
    for (let r = HIDDEN_ROWS; r < TOTAL_ROWS; r++) {
      if (!game.board[r]) continue;
      for (let c = 0; c < COLS; c++) {
        const type = game.board[r][c];
        if (type) {
          const isClearing = game.clearedRows.includes(r);
          if (isClearing) {
            const elapsed = performance.now() - game.clearAnimTimer;
            const progress = Math.min(elapsed / game.clearAnimDuration, 1);
            ctx.globalAlpha = 1 - progress;
          }
          this._drawBlock(ctx, c * cs, (r - HIDDEN_ROWS) * cs, cs, type);
          ctx.globalAlpha = 1;
        }
      }
    }

    if (!game.isPlaying || game.isGameOver || game.isPaused) return;
    if (!game.currentPiece) return;

    // Draw ghost piece
    const ghostY = game.getGhostY();
    if (ghostY !== game.currentY) {
      ctx.globalAlpha = 0.2;
      const piece = game.currentPiece;
      for (let r = 0; r < piece.length; r++) {
        for (let c = 0; c < piece[r].length; c++) {
          if (!piece[r][c]) continue;
          const dr = ghostY + r - HIDDEN_ROWS;
          if (dr < 0) continue;
          this._drawBlock(ctx, (game.currentX + c) * cs, dr * cs, cs, game.currentType);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Draw current piece
    const cPiece = game.currentPiece;
    for (let r = 0; r < cPiece.length; r++) {
      for (let c = 0; c < cPiece[r].length; c++) {
        if (!cPiece[r][c]) continue;
        const dr = game.currentY + r - HIDDEN_ROWS;
        if (dr < 0) continue;
        this._drawBlock(ctx, (game.currentX + c) * cs, dr * cs, cs, game.currentType);
      }
    }
  }

  drawHold(type) {
    const ctx = this.holdCtx;
    const cs = this.previewCell;
    const size = this.holdSize;

    ctx.clearRect(0, 0, size, size);

    if (!type) return;
    const shape = SHAPES[type];
    this._drawPreviewPiece(ctx, shape, type, size, cs);
  }

  drawNext(queue) {
    const ctx = this.nextCtx;
    const cs = this.previewCell;
    const w = this.holdSize;
    const h = cs * 4 * 3 + 24;

    ctx.clearRect(0, 0, w, h);

    queue.forEach((type, i) => {
      const shape = SHAPES[type];
      const yOffset = i * (cs * 4 + 8) + 4;

      ctx.save();
      ctx.translate(0, yOffset);
      this._drawPreviewPiece(ctx, shape, type, w, cs);
      ctx.restore();
    });
  }

  _drawPreviewPiece(ctx, shape, type, boxSize, cs) {
    const rows = shape.length;
    const cols = shape[0].length;

    // Find bounding box of actual blocks
    let minR = rows, maxR = 0, minC = cols, maxC = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (shape[r][c]) {
          minR = Math.min(minR, r);
          maxR = Math.max(maxR, r);
          minC = Math.min(minC, c);
          maxC = Math.max(maxC, c);
        }
      }
    }

    const pw = (maxC - minC + 1) * cs;
    const ph = (maxR - minR + 1) * cs;
    const ox = (boxSize - pw) / 2;
    const oy = (cs * 4 - ph) / 2;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (shape[r][c]) {
          this._drawBlock(ctx, ox + (c - minC) * cs, oy + (r - minR) * cs, cs, type);
        }
      }
    }
  }

  _drawBlock(ctx, x, y, size, type) {
    const pad = 1;
    const s = size - pad * 2;
    const radius = Math.max(2, size * 0.12);

    // Main fill
    ctx.fillStyle = COLORS[type];
    this._roundRect(ctx, x + pad, y + pad, s, s, radius);
    ctx.fill();

    // Top-left highlight
    ctx.fillStyle = COLORS_LIGHT[type];
    ctx.globalAlpha = 0.4;
    this._roundRect(ctx, x + pad, y + pad, s, s * 0.35, radius);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Bottom-right shadow
    ctx.fillStyle = COLORS_DARK[type];
    ctx.globalAlpha = 0.3;
    ctx.fillRect(x + pad, y + pad + s * 0.75, s, s * 0.25);
    ctx.globalAlpha = 1;

    // Inner shine
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    const ip = size * 0.22;
    const is = size - ip * 2;
    if (is > 0) {
      this._roundRect(ctx, x + ip, y + ip, is, is, radius * 0.6);
      ctx.fill();
    }
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
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
}

// ── Input Handler ────────────────────────────────────────────
class InputHandler {
  constructor(callbacks) {
    this.cb = callbacks;
    this.repeatTimers = {};
    this._bindButtons();
    this._bindKeyboard();
    this._bindSwipe();
  }

  _bindButtons() {
    const bind = (id, action, repeatable = false) => {
      const el = document.getElementById(id);
      if (!el) return;

      const start = (e) => {
        e.preventDefault();
        action();
        if (repeatable) {
          this.repeatTimers[id] = {
            timeout: setTimeout(() => {
              this.repeatTimers[id].interval = setInterval(action, ARR_RATE);
            }, DAS_DELAY),
          };
        }
      };

      const stop = (e) => {
        e.preventDefault();
        if (this.repeatTimers[id]) {
          clearTimeout(this.repeatTimers[id].timeout);
          clearInterval(this.repeatTimers[id].interval);
          delete this.repeatTimers[id];
        }
      };

      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', stop, { passive: false });
      el.addEventListener('touchcancel', stop, { passive: false });
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', stop);
      el.addEventListener('mouseleave', stop);
    };

    bind('btn-left', () => this.cb.moveLeft(), true);
    bind('btn-right', () => this.cb.moveRight(), true);
    bind('btn-down', () => this.cb.softDrop(), true);
    bind('btn-rotate', () => this.cb.rotate());
    bind('btn-drop', () => this.cb.hardDrop());
  }

  _bindKeyboard() {
    const pressed = {};

    document.addEventListener('keydown', (e) => {
      if (pressed[e.code]) return;
      pressed[e.code] = true;

      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          this.cb.moveLeft();
          this.repeatTimers['kl'] = {
            timeout: setTimeout(() => {
              this.repeatTimers['kl'].interval = setInterval(() => this.cb.moveLeft(), ARR_RATE);
            }, DAS_DELAY),
          };
          break;
        case 'ArrowRight':
          e.preventDefault();
          this.cb.moveRight();
          this.repeatTimers['kr'] = {
            timeout: setTimeout(() => {
              this.repeatTimers['kr'].interval = setInterval(() => this.cb.moveRight(), ARR_RATE);
            }, DAS_DELAY),
          };
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.cb.softDrop();
          this.repeatTimers['kd'] = {
            timeout: setTimeout(() => {
              this.repeatTimers['kd'].interval = setInterval(() => this.cb.softDrop(), ARR_RATE);
            }, DAS_DELAY),
          };
          break;
        case 'ArrowUp':
        case 'KeyX':
          e.preventDefault();
          this.cb.rotate();
          break;
        case 'KeyZ':
          e.preventDefault();
          this.cb.rotateCCW();
          break;
        case 'Space':
          e.preventDefault();
          this.cb.hardDrop();
          break;
        case 'KeyC':
        case 'ShiftLeft':
          e.preventDefault();
          this.cb.hold();
          break;
        case 'Escape':
        case 'KeyP':
          e.preventDefault();
          this.cb.pause();
          break;
      }
    });

    document.addEventListener('keyup', (e) => {
      pressed[e.code] = false;
      const map = { ArrowLeft: 'kl', ArrowRight: 'kr', ArrowDown: 'kd' };
      const key = map[e.code];
      if (key && this.repeatTimers[key]) {
        clearTimeout(this.repeatTimers[key].timeout);
        clearInterval(this.repeatTimers[key].interval);
        delete this.repeatTimers[key];
      }
    });
  }

  _bindSwipe() {
    const canvas = document.getElementById('board-canvas');
    let startX, startY, startTime;
    const threshold = 30;

    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
      if (startX === undefined) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startTime;

      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold && dt < 300) {
        // Tap = rotate
        this.cb.rotate();
      } else if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > threshold) this.cb.moveRight();
        else if (dx < -threshold) this.cb.moveLeft();
      } else {
        if (dy > threshold) this.cb.softDrop();
        else if (dy < -threshold) this.cb.hardDrop();
      }

      startX = startY = undefined;
    }, { passive: true });
  }

  stopAll() {
    for (const key of Object.keys(this.repeatTimers)) {
      clearTimeout(this.repeatTimers[key].timeout);
      clearInterval(this.repeatTimers[key].interval);
    }
    this.repeatTimers = {};
  }
}

// ── App Controller ───────────────────────────────────────────
class App {
  constructor() {
    this.game = new TetrisGame();
    this.renderer = new Renderer(
      document.getElementById('board-canvas'),
      document.getElementById('hold-canvas'),
      document.getElementById('next-canvas'),
    );
    this.sound = new SoundManager();
    this.state = 'start'; // start | playing | paused | gameover
    this.animFrameId = null;

    this.input = new InputHandler({
      moveLeft: () => this._onMove('left'),
      moveRight: () => this._onMove('right'),
      softDrop: () => this._onSoftDrop(),
      hardDrop: () => this._onHardDrop(),
      rotate: () => this._onRotate(true),
      rotateCCW: () => this._onRotate(false),
      hold: () => this._onHold(),
      pause: () => this._togglePause(),
    });

    this._bindOverlays();

    // Display high score on start screen
    document.getElementById('start-highscore').textContent =
      this.game.highScore.toLocaleString();

    // Resize & start render
    this.renderer.resize();
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this._render();
    });

    this._render();
  }

  _bindOverlays() {
    document.getElementById('start-screen').addEventListener('click', () => {
      this._startGame();
    });
    document.getElementById('start-screen').addEventListener('touchend', (e) => {
      e.preventDefault();
      this._startGame();
    });

    document.getElementById('gameover-screen').addEventListener('click', () => {
      this._startGame();
    });
    document.getElementById('gameover-screen').addEventListener('touchend', (e) => {
      e.preventDefault();
      this._startGame();
    });

    document.getElementById('pause-screen').addEventListener('click', () => {
      this._togglePause();
    });
    document.getElementById('pause-screen').addEventListener('touchend', (e) => {
      e.preventDefault();
      this._togglePause();
    });
  }

  _startGame() {
    this.sound.init();
    this.game.init();
    this.game.lastDropTime = performance.now();
    this.state = 'playing';

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');

    this._updateUI();
    this._gameLoop();
  }

  _togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.game.isPaused = true;
      this.input.stopAll();
      document.getElementById('pause-screen').classList.remove('hidden');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.game.isPaused = false;
      this.game.lastDropTime = performance.now();
      if (this.game.isLocking) {
        this.game.lockTimer = performance.now();
      }
      document.getElementById('pause-screen').classList.add('hidden');
      this._gameLoop();
    }
  }

  _gameOver() {
    this.state = 'gameover';
    this.input.stopAll();
    this.sound.play('gameover');
    this.sound.haptic('heavy');

    document.getElementById('final-score-value').textContent =
      this.game.score.toLocaleString();
    document.getElementById('final-level').textContent = this.game.level;
    document.getElementById('final-lines').textContent = this.game.linesCleared;

    const isRecord = this.game.score > 0 &&
      this.game.score >= this.game.highScore;
    document.getElementById('new-record').classList.toggle('hidden', !isRecord);

    document.getElementById('start-highscore').textContent =
      this.game.highScore.toLocaleString();

    document.getElementById('gameover-screen').classList.remove('hidden');
  }

  _gameLoop() {
    if (this.state !== 'playing') return;

    const now = performance.now();
    const result = this.game.update(now);

    if (this.game.isGameOver) {
      this._render();
      this._gameOver();
      return;
    }

    if (result) {
      switch (result.event) {
        case 'lock':
          this.sound.play('lock');
          this.sound.haptic('light');
          this._updateUI();
          break;
        case 'startClear':
          this.sound.play('clear');
          this.sound.haptic('medium');
          break;
        case 'clearDone':
          if (result.count === 4) {
            this.sound.play('tetris');
            this.sound.haptic('heavy');
            this._shakeBoard();
          }
          if (result.leveledUp) {
            this.sound.play('levelup');
          }
          this._updateUI();
          this._animateScore();
          break;
      }
    }

    this._render();
    this.animFrameId = requestAnimationFrame(() => this._gameLoop());
  }

  _render() {
    this.renderer.drawBoard(this.game);
    this.renderer.drawHold(this.game.holdType);
    this.renderer.drawNext(this.game.nextQueue);
  }

  _updateUI() {
    document.getElementById('score').textContent =
      this.game.score.toLocaleString();
    document.getElementById('level').textContent = this.game.level;
    document.getElementById('lines').textContent = this.game.linesCleared;
  }

  _animateScore() {
    const el = document.getElementById('score');
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 150);
  }

  _shakeBoard() {
    const wrapper = document.getElementById('game-board-wrapper');
    wrapper.classList.add('shake');
    setTimeout(() => wrapper.classList.remove('shake'), 300);
  }

  // ── Input callbacks ──
  _onMove(dir) {
    const moved = dir === 'left' ? this.game.moveLeft() : this.game.moveRight();
    if (moved) {
      this.sound.play('move');
      this.sound.haptic('light');
    }
  }

  _onSoftDrop() {
    if (this.game.softDrop()) {
      this.sound.play('move');
    }
  }

  _onHardDrop() {
    const result = this.game.hardDrop();
    if (result !== 'none') {
      this.sound.play('drop');
      this.sound.haptic('medium');
      this._updateUI();
      if (result === 'clearing') {
        this.sound.play('clear');
      }
    }
  }

  _onRotate(clockwise) {
    if (this.game.rotate(clockwise)) {
      this.sound.play('rotate');
      this.sound.haptic('light');
    }
  }

  _onHold() {
    if (this.game.hold()) {
      this.sound.play('hold');
      this.sound.haptic('light');
    }
  }
}

// ── Initialize ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  new App();
});
