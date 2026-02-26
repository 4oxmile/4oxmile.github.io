// ============================================================
// 2D Rubik's Cube Game
// Faces index: 0=U(White) 1=L(Green) 2=F(Red) 3=R(Blue) 4=B(Orange) 5=D(Yellow)
// Standard Western color scheme:
//   U=White, F=Red, R=Blue, D=Yellow, L=Green, B=Orange
// ============================================================

const FACE = { U: 0, L: 1, F: 2, R: 3, B: 4, D: 5 };
const FACE_NAMES = ['U', 'L', 'F', 'R', 'B', 'D'];
const SOLVED_COLORS = ['W', 'G', 'R', 'B', 'O', 'Y'];

// ---- Cube state: state[faceIdx][row][col] ----
function makeSolvedCube() {
  return SOLVED_COLORS.map(color =>
    Array.from({ length: 3 }, () => Array(3).fill(color))
  );
}

function cloneCube(cube) {
  return cube.map(face => face.map(row => [...row]));
}

// ---- Rotate a 3x3 matrix clockwise / counter-clockwise ----
function rotateCW(m) {
  return [
    [m[2][0], m[1][0], m[0][0]],
    [m[2][1], m[1][1], m[0][1]],
    [m[2][2], m[1][2], m[0][2]],
  ];
}

function rotateCCW(m) {
  return [
    [m[0][2], m[1][2], m[2][2]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][0], m[1][0], m[2][0]],
  ];
}

// ---- Generic move: rotate one face and cycle 4 edge strips ----
// strips = [{face, cells: [[r,c],...]}, ...] — 4 strips in CW order
// CW direction: strip[0] <- strip[3], strip[1] <- strip[0], ...
function cycleStrips(cube, strips, cw) {
  const c = cloneCube(cube);
  const get = (strip) => strip.cells.map(([r, col]) => cube[strip.face][r][col]);
  if (cw) {
    // strip[n] gets values from strip[n-1]
    const saved = get(strips[3]);
    for (let i = 3; i > 0; i--) {
      const src = get(strips[i - 1]);
      strips[i].cells.forEach(([r, col], k) => { c[strips[i].face][r][col] = src[k]; });
    }
    strips[0].cells.forEach(([r, col], k) => { c[strips[0].face][r][col] = saved[k]; });
  } else {
    // strip[n] gets values from strip[n+1]
    const saved = get(strips[0]);
    for (let i = 0; i < 3; i++) {
      const src = get(strips[i + 1]);
      strips[i].cells.forEach(([r, col], k) => { c[strips[i].face][r][col] = src[k]; });
    }
    strips[3].cells.forEach(([r, col], k) => { c[strips[3].face][r][col] = saved[k]; });
  }
  return c;
}

function applyFaceMove(cube, faceIdx, cw, strips) {
  let c = cloneCube(cube);
  c[faceIdx] = cw ? rotateCW(cube[faceIdx]) : rotateCCW(cube[faceIdx]);
  c = cycleStrips(c, strips, cw);
  return c;
}

// Helper constructors
const row = (f, r) => ({ face: FACE[f], cells: [[r,0],[r,1],[r,2]] });
const rowR = (f, r) => ({ face: FACE[f], cells: [[r,2],[r,1],[r,0]] }); // reversed
const col = (f, c) => ({ face: FACE[f], cells: [[0,c],[1,c],[2,c]] });
const colR = (f, c) => ({ face: FACE[f], cells: [[2,c],[1,c],[0,c]] }); // reversed

// ============================================================
// The 6 face moves (each exists in CW and CCW form)
// Strips listed in CW order as seen from the moving face's side
// ============================================================

function moveU(cube, cw) {
  // U CW (viewed from top): F-top -> L-top -> B-top -> R-top (the row that faces U)
  // CW from top: F row0 goes to R row0, R->B, B->L, L->F
  // Standard: CW strips order: F R B L (each row 0)
  return applyFaceMove(cube, FACE.U, cw, [row('F',0), row('R',0), row('B',0), row('L',0)]);
}

function moveD(cube, cw) {
  // D CW (viewed from bottom): F-bot -> R-bot -> B-bot -> L-bot
  // CW from bottom = CCW from front perspective
  // Strips CW (from bottom view): F row2 -> L row2 -> B row2 -> R row2
  return applyFaceMove(cube, FACE.D, cw, [row('F',2), row('L',2), row('B',2), row('R',2)]);
}

function moveL(cube, cw) {
  // L CW (viewed from left): U-col0 -> F-col0 -> D-col0 -> B-col2(reversed)
  // Because B faces opposite direction, its col2 aligns with L side but rows are flipped
  return applyFaceMove(cube, FACE.L, cw, [
    col('U', 0), col('F', 0), col('D', 0), colR('B', 2)
  ]);
}

function moveR(cube, cw) {
  // R CW (viewed from right): U-col2 -> B-col0(reversed) -> D-col2 -> F-col2
  // CW order: U col2 -> F col2 is wrong; correct CW from right:
  // top goes back: U-col2 -> B-col0(rev) -> D-col2(rev since D-bottom aligns) -> F-col2
  // Actually: R CW from right: U-col2 -> F-col2 -> D-col2 -> B-col0(rev)? No.
  // Standard Rubik's R CW (viewed from right face):
  //   U right col goes to B left col (reversed), B left col (reversed) to D right col, D right col to F right col, F right col to U right col
  // CW strips for R: U-col2, B-col0(rev), D-col2, F-col2
  return applyFaceMove(cube, FACE.R, cw, [
    col('U', 2), colR('B', 0), col('D', 2), col('F', 2)
  ]);
}

function moveF(cube, cw) {
  // F CW (viewed from front): U-row2 -> R-col0 -> D-row0(rev) -> L-col2(rev)
  // CW: U bottom row -> R left col -> D top row (reversed) -> L right col (reversed)
  return applyFaceMove(cube, FACE.F, cw, [
    row('U', 2), col('R', 0), rowR('D', 0), colR('L', 2)
  ]);
}

function moveB(cube, cw) {
  // B CW (viewed from back = from behind the cube):
  // U-row0(rev) -> L-col0 -> D-row2(rev) -> R-col2  -- wait, let's be careful
  // Standard B CW viewed from back:
  //   U top row goes to L left col, L left col to D bottom row, D bottom row to R right col, R right col to U top row
  // But the directions of those strips matter:
  // U-row0: left-to-right from front = right-to-left from back, so reversed
  // So CW strips (from B face perspective): U-row0(rev) -> L-col0 -> D-row2(rev) -> R-col2
  return applyFaceMove(cube, FACE.B, cw, [
    rowR('U', 0), col('L', 0), rowR('D', 2), col('R', 2)
  ]);
}

// Middle slices (no face rotation, just strip cycling)
function moveM(cube, cw) {
  // M slice = middle column, like L direction
  // CW (same as L): U-col1 -> F-col1 -> D-col1 -> B-col1(rev)
  return cycleStrips(cloneCube(cube), [
    col('U', 1), col('F', 1), col('D', 1), colR('B', 1)
  ], cw);
}

function moveE(cube, cw) {
  // E slice = middle row, like D direction
  // CW (same as D): F-row1 -> L-row1 -> B-row1 -> R-row1
  return cycleStrips(cloneCube(cube), [
    row('F', 1), row('L', 1), row('B', 1), row('R', 1)
  ], cw);
}

// ============================================================
// Move map
// ============================================================
const MOVES = {
  U_CW:  c => moveU(c, true),
  U_CCW: c => moveU(c, false),
  D_CW:  c => moveD(c, true),
  D_CCW: c => moveD(c, false),
  L_CW:  c => moveL(c, true),
  L_CCW: c => moveL(c, false),
  R_CW:  c => moveR(c, true),
  R_CCW: c => moveR(c, false),
  F_CW:  c => moveF(c, true),
  F_CCW: c => moveF(c, false),
  B_CW:  c => moveB(c, true),
  B_CCW: c => moveB(c, false),
  M_CW:  c => moveM(c, true),
  M_CCW: c => moveM(c, false),
  E_CW:  c => moveE(c, true),
  E_CCW: c => moveE(c, false),
};

const SCRAMBLE_MOVES = ['U_CW','U_CCW','D_CW','D_CCW','L_CW','L_CCW','R_CW','R_CCW','F_CW','F_CCW','B_CW','B_CCW'];

// ============================================================
// Game state
// ============================================================
let cube = makeSolvedCube();
let moveCount = 0;
let timerSecs = 0;
let timerInterval = null;
let gameActive = false;
let history = [];

// ============================================================
// LocalStorage
// ============================================================
const STORAGE_KEY = 'rubik2d_v1_records';

function loadRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveRecord(moves, time) {
  const r = loadRecords();
  let changed = false;
  if (r.bestMoves == null || moves < r.bestMoves) { r.bestMoves = moves; changed = true; }
  if (r.bestTime == null || time < r.bestTime) { r.bestTime = time; changed = true; }
  if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  return r;
}

// ============================================================
// Timer
// ============================================================
function startTimer() {
  stopTimer();
  timerSecs = 0;
  renderTimer();
  timerInterval = setInterval(() => { timerSecs++; renderTimer(); }, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function renderTimer() {
  const m = String(Math.floor(timerSecs / 60)).padStart(2, '0');
  const s = String(timerSecs % 60).padStart(2, '0');
  document.getElementById('timer-display').textContent = `${m}:${s}`;
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

// ============================================================
// Solved check
// ============================================================
function isSolved(cube) {
  return cube.every(face => {
    const c = face[0][0];
    return face.every(r => r.every(v => v === c));
  });
}

// ============================================================
// Apply move
// ============================================================
function doMove(key) {
  if (!gameActive) return;
  history.push(cloneCube(cube));
  cube = MOVES[key](cube);
  moveCount++;
  document.getElementById('move-display').textContent = moveCount;
  renderCube();
  if (isSolved(cube)) handleSolved();
}

function undo() {
  if (!gameActive || history.length === 0) return;
  cube = history.pop();
  moveCount = Math.max(0, moveCount - 1);
  document.getElementById('move-display').textContent = moveCount;
  renderCube();
}

// ============================================================
// Scramble
// ============================================================
function scramble() {
  if (!gameActive) return;
  // Apply 20 random moves without counting or recording
  const n = 20;
  let prev = '';
  for (let i = 0; i < n; i++) {
    let key;
    do {
      key = SCRAMBLE_MOVES[Math.floor(Math.random() * SCRAMBLE_MOVES.length)];
    } while (key[0] === prev[0]); // avoid same-axis repeat
    prev = key;
    cube = MOVES[key](cube);
  }
  // Reset counters
  moveCount = 0;
  history = [];
  document.getElementById('move-display').textContent = '0';
  startTimer();
  renderCube();
}

// ============================================================
// Win
// ============================================================
function handleSolved() {
  stopTimer();
  gameActive = false;
  const records = saveRecord(moveCount, timerSecs);

  document.querySelectorAll('.face').forEach(f => f.classList.add('solved'));
  setTimeout(() => {
    document.querySelectorAll('.face').forEach(f => f.classList.remove('solved'));
    showVictoryOverlay(records);
  }, 1800);
}

function showVictoryOverlay(records) {
  document.getElementById('v-moves').textContent = moveCount;
  document.getElementById('v-time').textContent = fmtTime(timerSecs);
  document.getElementById('v-best-moves').textContent = records.bestMoves != null ? `${records.bestMoves}번` : '-';
  document.getElementById('v-best-time').textContent = records.bestTime != null ? fmtTime(records.bestTime) : '-';
  document.getElementById('victory-overlay').classList.remove('hidden');
}

// ============================================================
// Render cube
// ============================================================
const COLOR_CLS = { W: 'color-W', R: 'color-R', B: 'color-B', O: 'color-O', G: 'color-G', Y: 'color-Y' };

function renderCube() {
  FACE_NAMES.forEach((name, fi) => {
    const el = document.getElementById(`face-${name}`);
    if (!el) return;
    el.querySelectorAll('.cell').forEach((cell, idx) => {
      const r = Math.floor(idx / 3), c = idx % 3;
      const color = cube[fi][r][c];
      cell.className = `cell ${COLOR_CLS[color]}`;
    });
  });
}

// ============================================================
// Build DOM layout
// ============================================================
function buildFaceEl(name) {
  const LABELS = { U: '위', L: '왼', F: '앞', R: '오른', B: '뒤', D: '아래' };
  const wrap = document.createElement('div');
  wrap.className = 'face-wrapper';

  const lbl = document.createElement('div');
  lbl.className = 'face-label';
  lbl.textContent = LABELS[name];
  wrap.appendChild(lbl);

  const face = document.createElement('div');
  face.className = 'face';
  face.id = `face-${name}`;
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    face.appendChild(cell);
  }
  wrap.appendChild(face);
  return wrap;
}

function arrowBtn(symbol, key, w, h) {
  const btn = document.createElement('button');
  btn.className = 'arrow-btn';
  btn.textContent = symbol;
  btn.style.width = w + 'px';
  btn.style.height = h + 'px';
  btn.style.fontSize = Math.round(Math.min(w, h) * 0.55) + 'px';
  btn.setAttribute('aria-label', key);
  btn.addEventListener('click', () => doMove(key));
  return btn;
}

function div(style, ...children) {
  const el = document.createElement('div');
  if (style) el.style.cssText = style;
  children.forEach(ch => el.appendChild(ch));
  return el;
}

function gap(w, h) {
  const el = document.createElement('div');
  el.style.cssText = `width:${w}px;height:${h}px;flex-shrink:0;pointer-events:none`;
  return el;
}

function buildLayout() {
  const area = document.getElementById('board-area');
  area.innerHTML = '';

  // Measure available space
  const AW = Math.min(area.clientWidth || 460, 460) - 8;
  const AH = (area.clientHeight || 380) - 8;

  const AR = 24;  // arrow button size
  const G = 2;    // gap

  // Cross layout columns: [AR] [face] [face] [face] [face] [AR]
  // Cross layout rows:    [AR] [face-U] [faces L/F/R/B] [face-D] [AR]
  // Width for 4 faces: AW - 2*AR - 5*G
  // Height for 3 faces: AH - 2*AR - 4*G
  const FW = Math.min(
    Math.floor((AW - 2 * AR - 5 * G) / 4),
    Math.floor((AH - 2 * AR - 4 * G) / 3),
    90
  );
  const FH = FW;

  // Cell size inside face (3 cells + 2 gaps of 2px + 4px border/padding)
  const CELL = Math.floor((FW - 8) / 3);

  // Apply face/cell sizes via CSS custom properties
  area.style.setProperty('--face-size', FW + 'px');
  area.style.setProperty('--cell-size', CELL + 'px');

  // We'll layout like:
  //
  //   [gap]        [col-up: L M R for U columns]
  //   [gap]        [U face]
  //   [row-left]   [L face] [F face] [R face] [B face]  [row-right]
  //   [gap]        [D face]
  //   [gap]        [col-dn: L M R for D columns]
  //
  // Row-left/right arrows: 3 buttons (for rows 0,1,2) stacked vertically
  // Col-up/down arrows: 3 buttons (for cols 0,1,2) side by side

  const colArrowW = Math.floor((FW - 4) / 3);
  const rowArrowH = Math.floor((FH - 4) / 3);

  // Column arrows above U (↑ moves a column up)
  // Col 0 (L-side column): L_CW moves left col up
  // Col 1 (middle): M_CW moves middle col up
  // Col 2 (R-side column): R_CCW moves right col up
  function colUpRow() {
    return div(
      `display:flex;gap:${G}px;margin-left:${G + FW + G}px`,
      arrowBtn('▲', 'L_CW', colArrowW, AR),
      arrowBtn('▲', 'M_CW', colArrowW, AR),
      arrowBtn('▲', 'R_CCW', colArrowW, AR)
    );
  }

  function colDnRow() {
    return div(
      `display:flex;gap:${G}px;margin-left:${G + FW + G}px`,
      arrowBtn('▼', 'L_CCW', colArrowW, AR),
      arrowBtn('▼', 'M_CCW', colArrowW, AR),
      arrowBtn('▼', 'R_CW', colArrowW, AR)
    );
  }

  // Row arrows left side (← moves row left/CW depending on row)
  // Row 0 (top): U_CCW rotates top row left when viewed from front
  // Row 1 (middle): E_CCW
  // Row 2 (bottom): D_CW
  function rowLeftArrows() {
    return div(
      `display:flex;flex-direction:column;gap:${G}px`,
      arrowBtn('◀', 'U_CCW', AR, rowArrowH),
      arrowBtn('◀', 'E_CCW', AR, rowArrowH),
      arrowBtn('◀', 'D_CW', AR, rowArrowH)
    );
  }

  function rowRightArrows() {
    return div(
      `display:flex;flex-direction:column;gap:${G}px`,
      arrowBtn('▶', 'U_CW', AR, rowArrowH),
      arrowBtn('▶', 'E_CW', AR, rowArrowH),
      arrowBtn('▶', 'D_CCW', AR, rowArrowH)
    );
  }

  // U face row (just face, padded to align with F in middle strip)
  function uRow() {
    return div(
      `display:flex;gap:${G}px;align-items:center`,
      gap(AR, FH),       // left gutter (aligns with row arrows)
      gap(FW, FH),       // L face placeholder
      buildFaceEl('U')
    );
  }

  // Main middle row: L F R B with row arrows
  function midRow() {
    return div(
      `display:flex;gap:${G}px;align-items:center`,
      rowLeftArrows(),
      buildFaceEl('L'),
      buildFaceEl('F'),
      buildFaceEl('R'),
      buildFaceEl('B'),
      rowRightArrows()
    );
  }

  // D face row
  function dRow() {
    return div(
      `display:flex;gap:${G}px;align-items:center`,
      gap(AR, FH),
      gap(FW, FH),
      buildFaceEl('D')
    );
  }

  const cross = div(
    `display:flex;flex-direction:column;gap:${G}px;align-items:flex-start`,
    colUpRow(),
    uRow(),
    midRow(),
    dRow(),
    colDnRow()
  );

  area.appendChild(cross);

  // Apply sizes to face and cell elements
  document.querySelectorAll('.face').forEach(f => {
    f.style.width = FW + 'px';
    f.style.height = FH + 'px';
  });
  document.querySelectorAll('.cell').forEach(c => {
    c.style.width = CELL + 'px';
    c.style.height = CELL + 'px';
  });

  renderCube();
}

// ============================================================
// Game flow
// ============================================================
function startGame() {
  cube = makeSolvedCube();
  moveCount = 0;
  history = [];
  timerSecs = 0;
  renderTimer();
  document.getElementById('move-display').textContent = '0';
  gameActive = true;

  document.getElementById('start-overlay').classList.add('hidden');
  document.getElementById('victory-overlay').classList.add('hidden');

  buildLayout();
  scramble();
}

function restartGame() {
  document.getElementById('victory-overlay').classList.add('hidden');
  startGame();
}

// ============================================================
// Init
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  // Populate start screen best records
  const r = loadRecords();
  const el = (id) => document.getElementById(id);
  el('start-best-moves').textContent = r.bestMoves != null ? `${r.bestMoves}번` : '-';
  el('start-best-time').textContent = r.bestTime != null ? fmtTime(r.bestTime) : '-';

  el('btn-start').addEventListener('click', startGame);
  el('btn-restart').addEventListener('click', restartGame);
  el('btn-scramble').addEventListener('click', () => {
    if (!gameActive) return;
    cube = makeSolvedCube();
    scramble();
  });
  el('btn-undo').addEventListener('click', undo);

  // Show start overlay
  el('start-overlay').classList.remove('hidden');

  // Rebuild on resize
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (gameActive) buildLayout(); }, 120);
  });
});
