/**
 * Mahjong Solitaire — Vanilla JS, no frameworks.
 * 144 tiles, turtle layout, 5 layers.
 * Match free pairs to clear the board.
 */
(function () {
  'use strict';

  // ─── Tile data ─────────────────────────────────────────────────────────────
  const MAN_CHARS    = ['一','二','三','四','五','六','七','八','九'];
  const CIRCLE_CHARS = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨'];

  function makeTileSet() {
    const set = [];
    // Man 1-9 × 4
    for (let v=1;v<=9;v++) for (let i=0;i<4;i++)
      set.push({type:'man', value:v, display:MAN_CHARS[v-1]+'萬', color:'red'});
    // Sou 1-9 × 4
    for (let v=1;v<=9;v++) for (let i=0;i<4;i++)
      set.push({type:'sou', value:v, display:v+'索', color:'green'});
    // Pin 1-9 × 4
    for (let v=1;v<=9;v++) for (let i=0;i<4;i++)
      set.push({type:'pin', value:v, display:CIRCLE_CHARS[v-1], color:'blue'});
    // Winds × 4
    [['east','東'],['south','南'],['west','西'],['north','北']].forEach(function(w) {
      for (let i=0;i<4;i++) set.push({type:'wind',value:w[0],display:w[1],color:'dark'});
    });
    // Dragons × 4
    [['red','中','crimson'],['green','發','forest'],['white','白','gray']].forEach(function(d) {
      for (let i=0;i<4;i++) set.push({type:'dragon',value:d[0],display:d[1],color:d[2]});
    });
    // Flowers × 1
    [['plum','梅'],['orchid','蘭'],['chrysanthemum','菊'],['bamboo_f','竹']].forEach(function(f) {
      set.push({type:'flower',value:f[0],display:f[1],color:'gold'});
    });
    // Seasons × 1
    [['spring','春'],['summer','夏'],['autumn','秋'],['winter','冬']].forEach(function(s) {
      set.push({type:'season',value:s[0],display:s[1],color:'gold'});
    });
    return set; // 144
  }

  function tilesMatch(a, b) {
    if (a.id === b.id) return false;
    if (a.type !== b.type) return false;
    if (a.type === 'flower' || a.type === 'season') return true;
    return a.value === b.value;
  }

  // ─── Layout ────────────────────────────────────────────────────────────────
  function buildLayout() {
    const pos = [];
    // Layer 0: 84
    for (let x=4;x<=11;x++) pos.push({x:x,y:0,z:0});
    for (let x=3;x<=14;x++) pos.push({x:x,y:1,z:0});
    for (let x=2;x<=15;x++) pos.push({x:x,y:2,z:0});
    for (let x=1;x<=16;x++) pos.push({x:x,y:3,z:0});
    for (let x=2;x<=15;x++) pos.push({x:x,y:4,z:0});
    for (let x=3;x<=14;x++) pos.push({x:x,y:5,z:0});
    for (let x=4;x<=11;x++) pos.push({x:x,y:6,z:0});
    // Layer 1: 36
    for (let x=4;x<=13;x++) pos.push({x:x,y:1,z:1});
    for (let x=4;x<=13;x++) pos.push({x:x,y:2,z:1});
    for (let x=4;x<=13;x++) pos.push({x:x,y:3,z:1});
    for (let x=5;x<=10;x++) pos.push({x:x,y:4,z:1});
    // Layer 2: 16
    for (let x=5;x<=12;x++) pos.push({x:x,y:2,z:2});
    for (let x=5;x<=12;x++) pos.push({x:x,y:3,z:2});
    // Layer 3: 4
    pos.push({x:7,y:2,z:3},{x:8,y:2,z:3},{x:7,y:3,z:3},{x:8,y:3,z:3});
    // Layer 4: 4
    pos.push({x:7,y:2,z:4},{x:8,y:2,z:4},{x:7,y:3,z:4},{x:8,y:3,z:4});
    return pos; // 84+36+16+4+4 = 144
  }

  function shuffle(arr) {
    for (let i=arr.length-1;i>0;i--) {
      const j = Math.floor(Math.random()*(i+1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  // ─── State ─────────────────────────────────────────────────────────────────
  let tiles       = [];
  let selected    = null;
  let history     = [];
  let moves       = 0;
  let timerSecs   = 0;
  let timerHandle = null;
  let timerActive = false;
  let hintTimeout = null;

  // ─── Init ──────────────────────────────────────────────────────────────────
  function deal() {
    const positions = buildLayout();
    const tileData  = shuffle(makeTileSet());
    tiles = positions.map(function(pos, i) {
      return {
        id: i,
        type:    tileData[i].type,
        value:   tileData[i].value,
        display: tileData[i].display,
        color:   tileData[i].color,
        x: pos.x, y: pos.y, z: pos.z,
        removed: false,
      };
    });
    selected    = null;
    history     = [];
    moves       = 0;
    timerSecs   = 0;
    timerActive = false;
    clearHint();
    stopTimer();
  }

  // ─── Free check ────────────────────────────────────────────────────────────
  function isFree(tile) {
    if (tile.removed) return false;
    // Not covered: no tile directly above (same x,y, z+1)
    const covered = tiles.some(function(t) {
      return !t.removed && t.x === tile.x && t.y === tile.y && t.z === tile.z + 1;
    });
    if (covered) return false;
    // Has open side: no tile at x-1 OR no tile at x+1 (same y, same z)
    const leftBlocked  = tiles.some(function(t) {
      return !t.removed && t.x === tile.x - 1 && t.y === tile.y && t.z === tile.z;
    });
    const rightBlocked = tiles.some(function(t) {
      return !t.removed && t.x === tile.x + 1 && t.y === tile.y && t.z === tile.z;
    });
    return !leftBlocked || !rightBlocked;
  }

  // ─── Win / No-move check ───────────────────────────────────────────────────
  function isWon() {
    return tiles.every(function(t) { return t.removed; });
  }

  function hasValidMoves() {
    const freeTiles = tiles.filter(function(t) { return !t.removed && isFree(t); });
    for (let i=0; i<freeTiles.length; i++) {
      for (let j=i+1; j<freeTiles.length; j++) {
        if (tilesMatch(freeTiles[i], freeTiles[j])) return true;
      }
    }
    return false;
  }

  // ─── Timer ─────────────────────────────────────────────────────────────────
  function startTimer() {
    if (timerActive) return;
    timerActive = true;
    timerHandle = setInterval(function() { timerSecs++; updateTimerEl(); }, 1000);
  }

  function stopTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    timerActive = false;
  }

  function updateTimerEl() {
    const el = document.getElementById('timer-val');
    if (!el) return;
    el.textContent = formatTime(timerSecs);
  }

  function formatTime(secs) {
    const m = String(Math.floor(secs/60)).padStart(2,'0');
    const s = String(secs%60).padStart(2,'0');
    return m + ':' + s;
  }

  function updateStats() {
    const remaining = tiles.filter(function(t) { return !t.removed; }).length;
    const pairsEl = document.getElementById('pairs-val');
    if (pairsEl) pairsEl.textContent = Math.floor(remaining/2);
    const movesEl = document.getElementById('moves-val');
    if (movesEl) movesEl.textContent = moves;
    updateTimerEl();
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  function getTileSize() {
    const style = getComputedStyle(document.documentElement);
    const w = parseInt(style.getPropertyValue('--tile-w')) || 38;
    const h = parseInt(style.getPropertyValue('--tile-h')) || 50;
    const fs = style.getPropertyValue('--tile-fs').trim() || '14px';
    return {w: w, h: h, fs: fs};
  }

  function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';

    const {w: tw, h: th, fs: tfs} = getTileSize();
    const LAYER_OFFSET_X = 3;
    const LAYER_OFFSET_Y = 3;

    // Find bounds
    let maxX = 0, maxY = 0;
    tiles.forEach(function(t) {
      if (t.x > maxX) maxX = t.x;
      if (t.y > maxY) maxY = t.y;
    });

    const boardW = (maxX + 1) * (tw + 2) + 20;
    const boardH = (maxY + 1) * (th + 2) + 20;
    board.style.width  = boardW + 'px';
    board.style.height = boardH + 'px';

    tiles.forEach(function(tile) {
      const el = document.createElement('div');
      el.className = 'mj-tile layer-' + tile.z + ' color-' + tile.color;

      if (!tile.removed) {
        if (isFree(tile)) el.classList.add('free');
        else el.classList.add('blocked');
      } else {
        el.classList.add('removed');
      }

      if (tile.id === selected) el.classList.add('selected');

      el.textContent = tile.display;
      el.dataset.id  = tile.id;

      const left = tile.x * (tw + 2) + tile.z * LAYER_OFFSET_X;
      const top  = tile.y * (th + 2) - tile.z * LAYER_OFFSET_Y;
      el.style.left    = left + 'px';
      el.style.top     = top  + 'px';
      el.style.width   = tw + 'px';
      el.style.height  = th + 'px';
      el.style.zIndex  = tile.z * 50 + (tile.removed ? 0 : 10);
      el.style.fontSize = tfs;

      el.addEventListener('click', function() { onTileClick(tile.id); });
      board.appendChild(el);
    });
  }

  // ─── Interactions ──────────────────────────────────────────────────────────
  function onTileClick(id) {
    const tile = tiles.find(function(t) { return t.id === id; });
    if (!tile || tile.removed || !isFree(tile)) return;
    clearHint();

    if (selected === null) {
      selected = id;
      startTimer();
      renderBoard();
      updateStats();
      return;
    }

    if (selected === id) {
      selected = null;
      renderBoard();
      return;
    }

    const selTile = tiles.find(function(t) { return t.id === selected; });
    if (tilesMatch(selTile, tile)) {
      // Remove pair
      history.push({ removedIds: [selected, id] });
      selTile.removed = true;
      tile.removed    = true;
      selected = null;
      moves++;
      renderBoard();
      updateStats();

      if (isWon()) {
        stopTimer();
        setTimeout(showWin, 400);
        return;
      }
      if (!hasValidMoves()) {
        showNoMoves();
      }
    } else {
      // Mismatch: switch selection to new tile
      selected = id;
      renderBoard();
    }
  }

  // ─── Hint ──────────────────────────────────────────────────────────────────
  function clearHint() {
    if (hintTimeout) { clearTimeout(hintTimeout); hintTimeout = null; }
    document.querySelectorAll('.mj-tile.hint-a, .mj-tile.hint-b').forEach(function(el) {
      el.classList.remove('hint-a','hint-b');
    });
  }

  function hint() {
    clearHint();
    selected = null;
    renderBoard();
    const freeTiles = tiles.filter(function(t) { return !t.removed && isFree(t); });
    for (let i=0;i<freeTiles.length;i++) {
      for (let j=i+1;j<freeTiles.length;j++) {
        if (tilesMatch(freeTiles[i], freeTiles[j])) {
          const elA = document.querySelector('.mj-tile[data-id="' + freeTiles[i].id + '"]');
          const elB = document.querySelector('.mj-tile[data-id="' + freeTiles[j].id + '"]');
          if (elA) elA.classList.add('hint-a');
          if (elB) elB.classList.add('hint-b');
          hintTimeout = setTimeout(clearHint, 1500);
          return;
        }
      }
    }
  }

  // ─── Undo ──────────────────────────────────────────────────────────────────
  function undo() {
    if (!history.length) return;
    clearHint();
    const last = history.pop();
    last.removedIds.forEach(function(id) {
      const t = tiles.find(function(t) { return t.id === id; });
      if (t) t.removed = false;
    });
    selected = null;
    moves = Math.max(0, moves - 1);
    renderBoard();
    updateStats();
  }

  // ─── Shuffle remaining ─────────────────────────────────────────────────────
  function shuffleRemaining() {
    clearHint();
    selected = null;
    const remaining = tiles.filter(function(t) { return !t.removed; });
    const tileData  = remaining.map(function(t) {
      return {type:t.type, value:t.value, display:t.display, color:t.color};
    });
    shuffle(tileData);
    remaining.forEach(function(tile, i) {
      tile.type    = tileData[i].type;
      tile.value   = tileData[i].value;
      tile.display = tileData[i].display;
      tile.color   = tileData[i].color;
    });
    hideNoMoves();
    renderBoard();
    updateStats();
  }

  // ─── No moves ──────────────────────────────────────────────────────────────
  function showNoMoves() {
    const el = document.getElementById('no-moves-msg');
    if (el) el.style.display = 'block';
  }

  function hideNoMoves() {
    const el = document.getElementById('no-moves-msg');
    if (el) el.style.display = 'none';
  }

  // ─── Win ───────────────────────────────────────────────────────────────────
  function showWin() {
    const timeEl  = document.getElementById('win-time');
    const pairsEl = document.getElementById('win-pairs');
    if (timeEl)  timeEl.textContent  = formatTime(timerSecs);
    if (pairsEl) pairsEl.textContent = moves;
    document.getElementById('win-screen').classList.add('active');

    if (typeof Leaderboard !== 'undefined') {
      Leaderboard.ready('mahjong', timerSecs * 100, {
        ascending: true,
        format: 'time',
        label: '시간',
      });
    }
  }

  // ─── Game lifecycle ────────────────────────────────────────────────────────
  function initGame() {
    deal();
    document.getElementById('win-screen').classList.remove('active');
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    hideNoMoves();
    renderBoard();
    updateStats();
  }

  // ─── DOM ready ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    // Add no-moves message to game-area
    const gameArea  = document.getElementById('game-area');
    const noMovesEl = document.createElement('div');
    noMovesEl.id = 'no-moves-msg';
    noMovesEl.innerHTML = '<h3>이동할 수 없습니다</h3><button id="shuffle-now-btn">타일 섞기</button>';
    gameArea.appendChild(noMovesEl);
    noMovesEl.querySelector('#shuffle-now-btn').addEventListener('click', shuffleRemaining);

    document.querySelector('.start-btn').addEventListener('click', initGame);
    document.getElementById('win-again-btn').addEventListener('click', initGame);

    document.getElementById('restart-icon-btn').addEventListener('click', function() {
      if (confirm('새 게임을 시작하시겠습니까?')) initGame();
    });
    document.getElementById('restart-btn').addEventListener('click', function() {
      if (confirm('새 게임을 시작하시겠습니까?')) initGame();
    });

    document.getElementById('hint-btn').addEventListener('click', hint);
    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('shuffle-btn').addEventListener('click', shuffleRemaining);

    // Re-render on viewport resize for responsive tile sizing
    window.addEventListener('resize', function() {
      if (tiles.length > 0) renderBoard();
    });

    // Load leaderboard on start screen (no score submission)
    if (typeof Leaderboard !== 'undefined') {
      Leaderboard.ready('mahjong', null, { ascending: true, format: 'time', label: '시간' });
    }
  });
})();
