/* ============================================================
   BATTLESHIP ONLINE - online.js
   P2P multiplayer via Supabase Realtime Broadcast
   Room list via Supabase DB
   ============================================================ */

'use strict';

const Online = (() => {
  let channel = null;
  let sb = null;
  let roomCode = null;
  let isHost = false;
  let opponentReady = false;
  let myReady = false;
  let myTurn = false;
  let active = false;
  let waitingForResult = false;
  let joinTimeout = null;
  let refreshTimer = null;

  function isActive() { return active; }

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  }

  function getSb() {
    if (!sb) sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return sb;
  }

  /* ── Room DB ───────────────────────────────────────── */

  async function dbCreateRoom(code) {
    const client = getSb();
    await client.from('battleship_rooms').insert({ code, host_name: '대기 중' });
  }

  async function dbDeleteRoom(code) {
    if (!code) return;
    const client = getSb();
    await client.from('battleship_rooms').delete().eq('code', code);
  }

  async function dbListRooms() {
    const client = getSb();
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await client
      .from('battleship_rooms')
      .select('code, host_name, created_at')
      .gt('created_at', tenMinAgo)
      .order('created_at', { ascending: false });
    return data || [];
  }

  /* ── Lobby ─────────────────────────────────────────── */

  function showLobby() {
    active = true;
    if (typeof Leaderboard !== 'undefined') Leaderboard.hide();
    showScreen('lobby');
    $('lobby-main').style.display = '';
    $('lobby-waiting').style.display = 'none';
    $('btn-lobby-back').style.display = '';
    $('join-code-input').value = '';
    $('join-error').textContent = '';
    loadRoomList();
    startRefresh();
  }

  function startRefresh() {
    stopRefresh();
    refreshTimer = setInterval(loadRoomList, 5000);
  }

  function stopRefresh() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  async function loadRoomList() {
    const list = $('room-list');
    if (!list) return;
    try {
      const rooms = await dbListRooms();
      if (rooms.length === 0) {
        list.innerHTML = '<p class="room-list-empty">대기 중인 방이 없습니다</p>';
      } else {
        list.innerHTML = rooms.map(r => {
          const ago = getTimeAgo(r.created_at);
          return `<button class="room-item" data-code="${r.code}">
            <span class="room-item-code">${r.code}</span>
            <span class="room-item-info">${r.host_name}</span>
            <span class="room-item-time">${ago}</span>
          </button>`;
        }).join('');
        list.querySelectorAll('.room-item').forEach(btn => {
          btn.addEventListener('click', () => joinByCode(btn.dataset.code));
        });
      }
    } catch (e) {
      list.innerHTML = '<p class="room-list-empty">방 목록을 불러올 수 없습니다</p>';
    }
  }

  function getTimeAgo(iso) {
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return '방금 전';
    const min = Math.floor(sec / 60);
    return `${min}분 전`;
  }

  /* ── Create / Join ─────────────────────────────────── */

  async function createRoom() {
    roomCode = genCode();
    isHost = true;
    stopRefresh();
    $('lobby-main').style.display = 'none';
    $('lobby-waiting').style.display = 'flex';
    $('btn-lobby-back').style.display = 'none';
    $('waiting-code').textContent = roomCode;
    $('waiting-msg').textContent = '상대방을 기다리는 중...';
    await dbCreateRoom(roomCode);
    connectChannel();
  }

  function joinByCode(code) {
    roomCode = code.toUpperCase();
    isHost = false;
    stopRefresh();
    $('lobby-main').style.display = 'none';
    $('lobby-waiting').style.display = 'flex';
    $('btn-lobby-back').style.display = 'none';
    $('waiting-code').textContent = roomCode;
    $('waiting-msg').textContent = '방에 접속 중...';
    connectChannel();
  }

  function joinRoom() {
    const code = $('join-code-input').value.trim().toUpperCase();
    if (code.length !== 4) {
      $('join-error').textContent = '4자리 코드를 입력하세요';
      return;
    }
    joinByCode(code);
  }

  /* ── Channel ───────────────────────────────────────── */

  function connectChannel() {
    const client = getSb();
    channel = client.channel('bs-' + roomCode, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'joined' }, onOpponentJoined);
    channel.on('broadcast', { event: 'ready' }, onOpponentReady);
    channel.on('broadcast', { event: 'attack' }, (msg) => onAttacked(msg.payload));
    channel.on('broadcast', { event: 'result' }, (msg) => onAttackResult(msg.payload));
    channel.on('broadcast', { event: 'left' }, onOpponentLeft);

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (!isHost) {
          channel.send({ type: 'broadcast', event: 'joined', payload: {} });
          joinTimeout = setTimeout(() => {
            toast('방을 찾을 수 없습니다');
            setTimeout(goBack, 1500);
          }, 10000);
        }
      }
    });
  }

  function onOpponentJoined() {
    if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }

    if (isHost) {
      toast('상대방이 입장했습니다!');
      channel.send({ type: 'broadcast', event: 'joined', payload: {} });
      // Remove room from list since game is starting
      dbDeleteRoom(roomCode);
    } else {
      toast('방에 입장했습니다!');
      dbDeleteRoom(roomCode);
    }
    goToPlacement();
  }

  /* ── Placement ─────────────────────────────────────── */

  function goToPlacement() {
    opponentReady = false;
    myReady = false;

    state = freshState();
    state.phase = 'place';
    showScreen('place');
    renderPlaceScreen();
    setStatus('온라인 대전 — 함선을 배치하세요');

    $('btn-start-game').textContent = '준비 완료';
  }

  function onReady() {
    myReady = true;
    const btn = $('btn-start-game');
    btn.disabled = true;
    btn.textContent = '상대방 대기 중...';

    channel.send({ type: 'broadcast', event: 'ready', payload: {} });

    if (opponentReady) startOnlineGame();
    else setStatus('상대방이 준비할 때까지 대기 중...');
  }

  function onOpponentReady() {
    opponentReady = true;
    toast('상대방 준비 완료!');
    if (myReady) startOnlineGame();
  }

  /* ── Game Start ────────────────────────────────────── */

  function startOnlineGame() {
    myTurn = isHost;
    state.turn = myTurn ? 'player' : 'ai';
    state.phase = 'game';
    state.enemyBoard = makeBoard();
    state.enemyShips = SHIPS_CONFIG.map((cfg, idx) => ({
      id: idx, cells: [], sunk: false
    }));
    state.playerShots = 0;
    state.playerHits = 0;
    state.aiShots = 0;
    state.aiHits = 0;
    waitingForResult = false;

    showScreen('game');
    document.querySelector('.game-header-title').textContent = 'ONLINE';

    buildGrid('player-board', false);
    buildGrid('enemy-board', true);
    renderPlayerBoard();
    renderEnemyBoard();
    renderShipsHud();
    updateTurnUI();
  }

  function updateTurnUI() {
    const el = $('turn-indicator');
    const enemyLabel = $('enemy-board-label');
    const playerLabel = $('player-board-label');

    if (myTurn) {
      el.textContent = '내 차례';
      el.className = 'turn-indicator player-turn';
      enemyLabel.classList.add('active');
      playerLabel.classList.remove('active');
      setStatus('공격할 위치를 선택하세요');
    } else {
      el.textContent = '상대 차례';
      el.className = 'turn-indicator';
      playerLabel.classList.add('active');
      enemyLabel.classList.remove('active');
      setStatus('상대방의 공격을 기다리는 중...');
    }
  }

  /* ── My Attack ─────────────────────────────────────── */

  function handleEnemyClick(r, c) {
    if (!myTurn || waitingForResult) return;
    if (state.phase !== 'game') return;
    const board = state.enemyBoard;
    if (board[r][c] === -1 || board[r][c] === 2 || board[r][c] === 3) {
      toast('이미 공격한 위치입니다');
      return;
    }

    waitingForResult = true;
    state.playerShots++;
    setStatus('공격 결과 대기 중...');

    channel.send({
      type: 'broadcast',
      event: 'attack',
      payload: { r, c }
    });
  }

  /* ── Opponent Attacked Me ──────────────────────────── */

  function onAttacked(payload) {
    const { r, c } = payload;
    const board = state.playerBoard;
    state.aiShots++;

    const wasHit = board[r][c] === 1;

    if (wasHit) {
      board[r][c] = 2;
      state.aiHits++;
      const ship = findShipByCell(state.playerShips, r, c);
      let sunk = false;
      let shipIdx = -1;
      let shipCells = null;

      if (ship && isShipSunk(board, ship)) {
        sinkShip(board, ship);
        ship.sunk = true;
        shipIdx = state.playerShips.indexOf(ship);
        shipCells = ship.cells.map(({ r, c }) => ({ r, c }));
        sunk = true;
        updateShipBadge('player', shipIdx, true);
        flashSunkCells('player-board', ship);
        toast(`내 ${SHIPS_CONFIG[shipIdx].name} 격침!`, 'sunk-toast');
        setStatus(`상대방이 ${SHIPS_CONFIG[shipIdx].name}을(를) 격침!`, 'sunk');
      } else {
        setStatus('상대방의 공격 명중!', 'hit');
      }

      renderPlayerBoard();
      playAttackFx('player-board', r, c, true);
      const gameOver = allSunk(state.playerShips);

      channel.send({
        type: 'broadcast',
        event: 'result',
        payload: { r, c, hit: true, sunk, shipIdx, shipCells, shipName: sunk ? SHIPS_CONFIG[shipIdx].name : null, gameOver }
      });

      if (gameOver) {
        setTimeout(() => endOnlineGame(false), 500);
        return;
      }
    } else {
      board[r][c] = -1;
      renderPlayerBoard();
      playAttackFx('player-board', r, c, false);
      setStatus('상대방의 공격이 빗나감');

      channel.send({
        type: 'broadcast',
        event: 'result',
        payload: { r, c, hit: false, sunk: false, gameOver: false }
      });
    }

    myTurn = true;
    state.turn = 'player';
    setTimeout(updateTurnUI, 600);
  }

  /* ── Result of My Attack ───────────────────────────── */

  function onAttackResult(payload) {
    const { r, c, hit, sunk, shipIdx, shipCells, shipName, gameOver } = payload;
    waitingForResult = false;
    const board = state.enemyBoard;

    if (hit) {
      board[r][c] = 2;
      state.playerHits++;

      if (sunk && shipCells) {
        for (const cell of shipCells) board[cell.r][cell.c] = 3;
        state.enemyShips[shipIdx].sunk = true;
        state.enemyShips[shipIdx].cells = shipCells;
        updateShipBadge('enemy', shipIdx, true);
        renderEnemyBoard();
        playAttackFx('enemy-board', r, c, true);
        flashSunkCells('enemy-board', state.enemyShips[shipIdx]);
        toast(`적 ${shipName} 격침!`, 'sunk-toast');
        setStatus(`적 ${shipName} 격침!`, 'sunk');
      } else {
        setStatus('명중!', 'hit');
        renderEnemyBoard();
        playAttackFx('enemy-board', r, c, true);
      }

      if (gameOver) {
        setTimeout(() => endOnlineGame(true), 500);
        return;
      }
    } else {
      board[r][c] = -1;
      setStatus('빗나감', 'miss');
      renderEnemyBoard();
      playAttackFx('enemy-board', r, c, false);
    }

    myTurn = false;
    state.turn = 'ai';
    setTimeout(updateTurnUI, 600);
  }

  /* ── End Game ──────────────────────────────────────── */

  function endOnlineGame(won) {
    state.phase = 'result';
    state.won = won;
    saveStats(won);
    const stats = loadStats();

    setTimeout(() => {
      $('result-emoji').textContent = won ? '🏆' : '💥';
      $('result-title').textContent = won ? '승리!' : '패배';
      $('result-title').className = 'result-title ' + (won ? 'win' : 'lose');
      $('result-desc').textContent = won
        ? '상대방의 모든 함선을 격침했습니다!'
        : '모든 내 함선이 격침당했습니다.';
      $('result-shots').textContent = state.playerShots;
      $('result-accuracy').textContent = state.playerShots > 0
        ? Math.round(state.playerHits / state.playerShots * 100) + '%' : '0%';
      $('result-total-wins').textContent = stats.wins;
      $('result-total-losses').textContent = stats.losses;
      showScreen('result');
    }, 400);

    cleanup(false);
  }

  /* ── Opponent Left ─────────────────────────────────── */

  function onOpponentLeft() {
    toast('상대방이 나갔습니다');
    cleanup(false);
    setTimeout(initGame, 2000);
  }

  /* ── Cleanup ───────────────────────────────────────── */

  function cleanup(notify) {
    if (notify === undefined) notify = true;
    stopRefresh();

    // Delete room from DB if we're the host and still waiting
    if (isHost && roomCode) dbDeleteRoom(roomCode);

    if (channel) {
      if (notify) {
        try { channel.send({ type: 'broadcast', event: 'left', payload: {} }); } catch (e) {}
      }
      setTimeout(() => {
        try { if (channel) { channel.unsubscribe(); channel = null; } } catch (e) {}
      }, 300);
    }
    if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
    active = false;
    roomCode = null;
    opponentReady = false;
    myReady = false;
    waitingForResult = false;

    const btn = $('btn-start-game');
    if (btn) { btn.textContent = '전투 시작'; btn.disabled = false; }
    const header = document.querySelector('.game-header-title');
    if (header) header.textContent = 'BATTLESHIP';
  }

  function goBack() {
    cleanup();
    initGame();
  }

  /* ── Tab close handler ─────────────────────────────── */

  window.addEventListener('beforeunload', () => {
    if (active && channel) {
      try { channel.send({ type: 'broadcast', event: 'left', payload: {} }); } catch (e) {}
    }
    if (isHost && roomCode) {
      // Best-effort cleanup via sendBeacon is not available for Supabase,
      // but the room will expire after 10 minutes anyway
    }
  });

  /* ── Wire up lobby DOM ─────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    $('btn-online').addEventListener('click', showLobby);
    $('btn-create-room').addEventListener('click', createRoom);
    $('btn-join-room').addEventListener('click', joinRoom);
    $('btn-lobby-back').addEventListener('click', goBack);
    $('btn-waiting-cancel').addEventListener('click', goBack);
    $('btn-refresh-rooms').addEventListener('click', loadRoomList);
    $('btn-copy-code').addEventListener('click', () => {
      if (!roomCode) return;
      navigator.clipboard.writeText(roomCode)
        .then(() => toast('코드가 복사되었습니다'))
        .catch(() => {});
    });
    $('join-code-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinRoom();
    });
  });

  return { isActive, handleEnemyClick, onReady, cleanup };
})();
