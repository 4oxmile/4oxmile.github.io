/* =====================================================
   SOKOBAN - Game Logic
   ===================================================== */

// ── Tile constants ──────────────────────────────────────
const TILE = {
  EMPTY:    0,
  WALL:     1,
  FLOOR:    2,
  GOAL:     3,
  BOX:      4,
  BOX_ON:   5,  // box on goal
  PLAYER:   6,
  PLAYER_ON:7,  // player on goal
};

// ── Color palette (canvas drawing) ─────────────────────
function getPalette() {
  const isDark = !window.matchMedia('(prefers-color-scheme: light)').matches;
  return isDark ? {
    wall:      '#2D3748',
    wallEdge:  '#1A202C',
    floor:     '#141A24',
    floorLine: '#1A2234',
    goal:      '#1E3A5F',
    goalDot:   '#3B82F6',
    box:       '#B45309',
    boxEdge:   '#78350F',
    boxOn:     '#065F46',
    boxOnEdge: '#064E3B',
    boxOnAccent:'#10B981',
    player:    '#3B82F6',
    playerOn:  '#2563EB',
    playerEye: '#fff',
    bg:        '#0A0E14',
    shadow:    'rgba(0,0,0,0.6)',
  } : {
    wall:      '#9CA3AF',
    wallEdge:  '#6B7280',
    floor:     '#F3F4F6',
    floorLine: '#E5E7EB',
    goal:      '#DBEAFE',
    goalDot:   '#3182F6',
    box:       '#D97706',
    boxEdge:   '#B45309',
    boxOn:     '#D1FAE5',
    boxOnEdge: '#A7F3D0',
    boxOnAccent:'#10B981',
    player:    '#3182F6',
    playerOn:  '#2563EB',
    playerEye: '#fff',
    bg:        '#F0F2F5',
    shadow:    'rgba(0,0,0,0.15)',
  };
}

// ── Level data ──────────────────────────────────────────
// Format: string array. # = wall, ' ' = floor, . = goal,
// $ = box, * = box on goal, @ = player, + = player on goal
const LEVELS_RAW = [
  // Level 1 – Tutorial (5×5)
  [
    '#####',
    '#@$.#',
    '#   #',
    '#   #',
    '#####',
  ],
  // Level 2 – One step aside
  [
    '#####',
    '# @ #',
    '# $ #',
    '# . #',
    '#####',
  ],
  // Level 3 – Two boxes
  [
    '#######',
    '#  @  #',
    '# $$  #',
    '# ..  #',
    '#     #',
    '#######',
  ],
  // Level 4 – Corner maneuver
  [
    '#######',
    '#.    #',
    '#  ## #',
    '# #$  #',
    '# @ . #',
    '#######',
  ],
  // Level 5 – Hallway
  [
    '#######',
    '#     #',
    '# .$. #',
    '# $@$ #',
    '# ... #',
    '#     #',
    '#######',
  ],
  // Level 6 – Three boxes, compact
  [
    '########',
    '#   @  #',
    '# $$$  #',
    '#   ## #',
    '##...  #',
    '########',
  ],
  // Level 7 – Corridor push
  [
    '########',
    '#  .   #',
    '#  #   #',
    '#  $   #',
    '#### @ #',
    '#  $   #',
    '#  .   #',
    '#      #',
    '########',
  ],
  // Level 8 – Four boxes
  [
    '#########',
    '#   @   #',
    '#  $$$  #',
    '#   $   #',
    '##      #',
    '# ....  #',
    '#       #',
    '#########',
  ],
  // Level 9 – Maze-like
  [
    '#########',
    '#   #   #',
    '# $ . # #',
    '# # . $ #',
    '# $   # #',
    '# # . @ #',
    '#       #',
    '#########',
  ],
  // Level 10 – Expert (6 boxes)
  [
    '##########',
    '#   @    #',
    '#  ####  #',
    '# $    $ #',
    '# $ ## $ #',
    '# $    $ #',
    '#  ####  #',
    '#  ....  #',
    '#  ....  #',
    '##########',
  ],
];

// Parse raw string level into a 2D array + player/box positions
function parseLevel(raw) {
  const grid = [];
  let player = null;
  const boxes = [];
  const goals = [];

  for (let r = 0; r < raw.length; r++) {
    const row = [];
    for (let c = 0; c < raw[r].length; c++) {
      const ch = raw[r][c];
      switch (ch) {
        case '#': row.push(TILE.WALL); break;
        case ' ': row.push(TILE.FLOOR); break;
        case '.':
          row.push(TILE.GOAL);
          goals.push({ r, c });
          break;
        case '$':
          row.push(TILE.FLOOR);
          boxes.push({ r, c });
          break;
        case '*':
          row.push(TILE.GOAL);
          goals.push({ r, c });
          boxes.push({ r, c });
          break;
        case '@':
          row.push(TILE.FLOOR);
          player = { r, c };
          break;
        case '+':
          row.push(TILE.GOAL);
          goals.push({ r, c });
          player = { r, c };
          break;
        default:
          row.push(TILE.EMPTY);
      }
    }
    grid.push(row);
  }

  return { grid, player, boxes, goals };
}

// Deep clone game state
function cloneState(state) {
  return {
    grid: state.grid.map(r => [...r]),
    player: { ...state.player },
    boxes: state.boxes.map(b => ({ ...b })),
  };
}

// ── Storage helpers ─────────────────────────────────────
const STORAGE_KEY = 'sokoban_best';

function getBest(levelIdx) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return data[levelIdx] ?? null;
  } catch { return null; }
}

function setBest(levelIdx, moves) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const prev = data[levelIdx] ?? Infinity;
    if (moves < prev) {
      data[levelIdx] = moves;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true; // new best!
    }
    return false;
  } catch { return false; }
}

function getCompletedLevels() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return Object.keys(data).map(Number);
  } catch { return []; }
}

// ── Canvas renderer ─────────────────────────────────────
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = 48;
  }

  resize(cols, rows) {
    const wrapper = document.getElementById('board-wrapper');
    const wrapW = wrapper.clientWidth;
    const wrapH = wrapper.clientHeight;
    const margin = 8;
    const maxTile = Math.floor(Math.min(
      (wrapW - margin * 2) / cols,
      (wrapH - margin * 2) / rows,
    ));
    this.tileSize = Math.max(24, Math.min(56, maxTile));
    this.canvas.width  = cols * this.tileSize;
    this.canvas.height = rows * this.tileSize;
  }

  draw(state, goals) {
    const { ctx, tileSize: T } = this;
    const { grid, player, boxes } = state;
    const pal = getPalette();
    const rows = grid.length;
    const cols = grid[0].length;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const boxSet = new Set(boxes.map(b => `${b.r},${b.c}`));
    const goalSet = new Set(goals.map(g => `${g.r},${g.c}`));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * T;
        const y = r * T;
        const tile = grid[r][c];
        const key = `${r},${c}`;

        if (tile === TILE.EMPTY) continue;

        if (tile === TILE.WALL) {
          this._drawWall(x, y, T, pal);
        } else {
          this._drawFloor(x, y, T, pal);
          if (tile === TILE.GOAL || goalSet.has(key)) {
            this._drawGoal(x, y, T, pal);
          }
        }
      }
    }

    // Draw boxes
    boxes.forEach(b => {
      const x = b.c * T;
      const y = b.r * T;
      const onGoal = goalSet.has(`${b.r},${b.c}`);
      this._drawBox(x, y, T, pal, onGoal);
    });

    // Draw player
    {
      const x = player.c * T;
      const y = player.r * T;
      const onGoal = goalSet.has(`${player.r},${player.c}`);
      this._drawPlayer(x, y, T, pal, onGoal);
    }
  }

  _drawWall(x, y, T, pal) {
    const ctx = this.ctx;
    const pad = 1;
    // Main wall face
    ctx.fillStyle = pal.wall;
    ctx.beginPath();
    ctx.roundRect(x + pad, y + pad, T - pad * 2, T - pad * 2, 3);
    ctx.fill();
    // Top-left highlight
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(x + pad, y + pad, T - pad * 2, 3);
    // Bottom shadow
    ctx.fillStyle = pal.wallEdge;
    ctx.fillRect(x + pad, y + T - pad - 3, T - pad * 2, 3);
  }

  _drawFloor(x, y, T, pal) {
    const ctx = this.ctx;
    ctx.fillStyle = pal.floor;
    ctx.fillRect(x, y, T, T);
    // Subtle grid lines
    ctx.strokeStyle = pal.floorLine;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.25, y + 0.25, T - 0.5, T - 0.5);
  }

  _drawGoal(x, y, T, pal) {
    const ctx = this.ctx;
    const cx = x + T / 2;
    const cy = y + T / 2;
    const r = T * 0.22;
    // Background tint
    ctx.fillStyle = pal.goal;
    ctx.fillRect(x, y, T, T);
    // Cross marker
    ctx.strokeStyle = pal.goalDot;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const arm = r * 0.9;
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
    ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
    ctx.stroke();
    // Center dot
    ctx.fillStyle = pal.goalDot;
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBox(x, y, T, pal, onGoal) {
    const ctx = this.ctx;
    const pad = 3;
    const r = 6;
    const bx = x + pad;
    const by = y + pad;
    const bw = T - pad * 2;
    const bh = T - pad * 2;

    // Shadow
    ctx.fillStyle = pal.shadow;
    ctx.beginPath();
    ctx.roundRect(bx + 2, by + 3, bw, bh, r);
    ctx.fill();

    // Main body
    ctx.fillStyle = onGoal ? pal.boxOn : pal.box;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, r);
    ctx.fill();

    // Edge / border
    ctx.strokeStyle = onGoal ? pal.boxOnEdge : pal.boxEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, r);
    ctx.stroke();

    // Top highlight
    ctx.fillStyle = onGoal
      ? 'rgba(255,255,255,0.15)'
      : 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(bx + 3, by + 3, bw - 6, bh * 0.35, r * 0.5);
    ctx.fill();

    // Accent line if on goal
    if (onGoal) {
      ctx.strokeStyle = pal.boxOnAccent;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      const ck = bw * 0.22;
      ctx.beginPath();
      ctx.moveTo(cx - ck, cy);
      ctx.lineTo(cx - ck * 0.25, cy + ck * 0.7);
      ctx.lineTo(cx + ck, cy - ck * 0.5);
      ctx.stroke();
    }
  }

  _drawPlayer(x, y, T, pal, onGoal) {
    const ctx = this.ctx;
    const cx = x + T / 2;
    const cy = y + T / 2;
    const bodyR = T * 0.28;
    const headR  = T * 0.16;
    const color  = onGoal ? pal.playerOn : pal.player;

    // Shadow
    ctx.fillStyle = pal.shadow;
    ctx.beginPath();
    ctx.ellipse(cx + 1, cy + bodyR + 3, bodyR * 0.8, bodyR * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (circle)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy + headR * 0.5, bodyR, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy - bodyR * 0.5, headR, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeY = cy - bodyR * 0.5 - headR * 0.1;
    const eyeOffset = headR * 0.38;
    ctx.fillStyle = pal.playerEye;
    [cx - eyeOffset, cx + eyeOffset].forEach(ex => {
      ctx.beginPath();
      ctx.arc(ex, eyeY, headR * 0.28, 0, Math.PI * 2);
      ctx.fill();
    });

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(cx - headR * 0.2, cy - bodyR * 0.7, headR * 0.55, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();
  }
}

// ── Game Engine ─────────────────────────────────────────
class Game {
  constructor() {
    this.levels = LEVELS_RAW.map(parseLevel);
    this.currentLevel = 0;
    this.state = null;       // { grid, player, boxes }
    this.history = [];       // undo stack
    this.moves = 0;
    this.isComplete = false;
    this.renderer = null;
    this.touchStart = null;
    this.playerFacing = 'right'; // for animation hints

    this._initDOM();
    this._bindEvents();
    this._showScreen('start');
  }

  _initDOM() {
    this.screens = {
      start:      document.getElementById('start-screen'),
      levelSelect:document.getElementById('level-select-screen'),
      game:       document.getElementById('game-screen'),
      victory:    document.getElementById('victory-screen'),
      allclear:   document.getElementById('allclear-screen'),
    };

    const canvas = document.getElementById('game-canvas');
    this.renderer = new Renderer(canvas);
    this.canvas = canvas;
  }

  _showScreen(name) {
    Object.entries(this.screens).forEach(([key, el]) => {
      el.classList.toggle('hidden', key !== name);
    });
    this.activeScreen = name;
  }

  _bindEvents() {
    // Start screen
    document.getElementById('btn-start').addEventListener('click', () => {
      this._showLevelSelect();
    });
    document.getElementById('btn-continue').addEventListener('click', () => {
      this._loadLevel(this.currentLevel);
      this._showScreen('game');
    });

    // Level select screen
    document.getElementById('btn-back-start').addEventListener('click', () => {
      this._showScreen('start');
    });

    // Game screen buttons
    document.getElementById('btn-menu').addEventListener('click', () => {
      this._showScreen('start');
    });
    document.getElementById('btn-undo').addEventListener('click', () => {
      this._undo();
    });
    document.getElementById('btn-restart').addEventListener('click', () => {
      this._restartLevel();
    });
    document.getElementById('btn-levels').addEventListener('click', () => {
      this._showLevelSelect();
    });

    // D-pad
    const dpadMap = {
      'dpad-up':    { dr: -1, dc: 0 },
      'dpad-down':  { dr:  1, dc: 0 },
      'dpad-left':  { dr:  0, dc: -1 },
      'dpad-right': { dr:  0, dc:  1 },
    };
    Object.entries(dpadMap).forEach(([id, dir]) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => this._move(dir.dr, dir.dc));
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (this.activeScreen !== 'game') return;
      const map = {
        'ArrowUp': [-1, 0], 'KeyW': [-1, 0],
        'ArrowDown': [1, 0], 'KeyS': [1, 0],
        'ArrowLeft': [0, -1], 'KeyA': [0, -1],
        'ArrowRight': [0, 1], 'KeyD': [0, 1],
        'KeyZ': null, 'KeyU': null,
        'KeyR': 'restart',
      };
      const action = map[e.code];
      if (action === undefined) return;
      e.preventDefault();
      if (action === null) { this._undo(); return; }
      if (action === 'restart') { this._restartLevel(); return; }
      this._move(action[0], action[1]);
    });

    // Touch/swipe on canvas
    this.canvas.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      this.touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });

    this.canvas.addEventListener('touchend', e => {
      if (!this.touchStart || e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - this.touchStart.x;
      const dy = e.changedTouches[0].clientY - this.touchStart.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const threshold = 20;
      if (adx < threshold && ady < threshold) return;
      if (adx > ady) {
        this._move(0, dx > 0 ? 1 : -1);
      } else {
        this._move(dy > 0 ? 1 : -1, 0);
      }
      this.touchStart = null;
    }, { passive: true });

    // Victory buttons
    document.getElementById('btn-next-level').addEventListener('click', () => {
      const next = this.currentLevel + 1;
      if (next < this.levels.length) {
        this._loadLevel(next);
        this._showScreen('game');
      } else {
        this._showScreen('allclear');
      }
    });
    document.getElementById('btn-victory-restart').addEventListener('click', () => {
      this._restartLevel();
      this._showScreen('game');
    });
    document.getElementById('btn-victory-levels').addEventListener('click', () => {
      this._showLevelSelect();
    });

    // All clear button
    document.getElementById('btn-allclear-menu').addEventListener('click', () => {
      this._showScreen('start');
    });
    document.getElementById('btn-allclear-levels').addEventListener('click', () => {
      this._showLevelSelect();
    });

    // Resize
    window.addEventListener('resize', () => {
      if (this.activeScreen === 'game' && this.state) {
        this._resizeAndDraw();
      }
    });
  }

  _showLevelSelect() {
    const completed = new Set(getCompletedLevels());
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    this.levels.forEach((_, i) => {
      const card = document.createElement('div');
      card.className = 'level-card';
      const isCompleted = completed.has(i);
      const isCurrent = i === this.currentLevel;
      if (isCompleted) card.classList.add('completed');
      if (isCurrent && !isCompleted) card.classList.add('current');

      const best = getBest(i);
      const numEl = document.createElement('div');
      numEl.className = 'level-num';
      numEl.textContent = i + 1;

      const starEl = document.createElement('div');
      starEl.className = 'level-star';
      starEl.textContent = isCompleted ? '⭐' : '';

      const bestEl = document.createElement('div');
      bestEl.className = 'level-best';
      bestEl.textContent = best !== null ? `${best}이동` : '';

      card.appendChild(numEl);
      card.appendChild(starEl);
      card.appendChild(bestEl);
      card.addEventListener('click', () => {
        this._loadLevel(i);
        this._showScreen('game');
      });
      grid.appendChild(card);
    });
    this._showScreen('levelSelect');
  }

  _loadLevel(idx) {
    if(typeof Leaderboard!=='undefined')Leaderboard.hide();
    this.currentLevel = idx;
    const parsed = this.levels[idx];
    this.state = cloneState(parsed);
    this.goals = parsed.goals.map(g => ({ ...g }));
    this.history = [];
    this.moves = 0;
    this.isComplete = false;
    this._updateHeader();
    this._resizeAndDraw();
    this._updateContinueBtn();
  }

  _updateContinueBtn() {
    const btn = document.getElementById('btn-continue');
    btn.style.display = 'flex';
  }

  _restartLevel() {
    this._loadLevel(this.currentLevel);
  }

  _resizeAndDraw() {
    if (!this.state) return;
    const cols = this.state.grid[0].length;
    const rows = this.state.grid.length;
    this.renderer.resize(cols, rows);
    this.renderer.draw(this.state, this.goals);
  }

  _updateHeader() {
    document.getElementById('current-level-num').textContent = this.currentLevel + 1;
    document.getElementById('move-count').textContent = this.moves;
    const best = getBest(this.currentLevel);
    document.getElementById('best-value').textContent = best !== null ? best : '-';
  }

  _move(dr, dc) {
    if (this.isComplete) return;
    const { state, goals } = this;
    const { player, boxes, grid } = state;

    const nr = player.r + dr;
    const nc = player.c + dc;

    // Bounds + wall check
    if (nr < 0 || nr >= grid.length || nc < 0 || nc >= grid[0].length) return;
    if (grid[nr][nc] === TILE.WALL || grid[nr][nc] === TILE.EMPTY) return;

    const boxIdx = boxes.findIndex(b => b.r === nr && b.c === nc);
    let moved = false;

    if (boxIdx === -1) {
      // Simple move
      this.history.push(cloneState(state));
      player.r = nr;
      player.c = nc;
      moved = true;
    } else {
      // Push box
      const br = nr + dr;
      const bc = nc + dc;
      if (br < 0 || br >= grid.length || bc < 0 || bc >= grid[0].length) return;
      if (grid[br][bc] === TILE.WALL || grid[br][bc] === TILE.EMPTY) return;
      // Check no other box at (br, bc)
      if (boxes.some((b, i) => i !== boxIdx && b.r === br && b.c === bc)) return;

      this.history.push(cloneState(state));
      boxes[boxIdx].r = br;
      boxes[boxIdx].c = bc;
      player.r = nr;
      player.c = nc;
      moved = true;
    }

    if (moved) {
      this.moves++;
      this._updateHeader();
      this.renderer.draw(state, goals);
      this._checkVictory();
    }
  }

  _undo() {
    if (this.history.length === 0) return;
    const prev = this.history.pop();
    this.state = prev;
    this.moves = Math.max(0, this.moves - 1);
    this.isComplete = false;
    this._updateHeader();
    this.renderer.draw(this.state, this.goals);
  }

  _checkVictory() {
    const { boxes } = this.state;
    const goalSet = new Set(this.goals.map(g => `${g.r},${g.c}`));
    const allOn = boxes.every(b => goalSet.has(`${b.r},${b.c}`));
    if (!allOn) return;

    this.isComplete = true;
    if(typeof Leaderboard!=='undefined')Leaderboard.ready('sokoban',this.moves,{ascending:true,label:'이동'});
    const isNewBest = setBest(this.currentLevel, this.moves);

    // Populate victory screen
    document.getElementById('victory-level-num').textContent = this.currentLevel + 1;
    document.getElementById('victory-moves').textContent = this.moves;

    const best = getBest(this.currentLevel);
    const bestEl = document.getElementById('victory-best');
    bestEl.textContent = best;
    bestEl.className = 'stat-value' + (isNewBest ? ' new-best' : '');

    const badge = document.getElementById('new-best-badge');
    badge.style.display = isNewBest ? 'inline-block' : 'none';

    // Hide/show next level button
    const nextBtn = document.getElementById('btn-next-level');
    nextBtn.style.display = this.currentLevel + 1 < this.levels.length ? 'flex' : 'none';

    // Short delay for satisfaction
    setTimeout(() => this._showScreen('victory'), 300);
  }
}

// ── Boot ────────────────────────────────────────────────
let game;
document.addEventListener('DOMContentLoaded', () => {
  game = new Game();
});
