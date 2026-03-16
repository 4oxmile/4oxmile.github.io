/* ============================================================
   OMOK ONLINE - online.js
   P2P multiplayer via Supabase Realtime Broadcast
   Room list via Supabase DB (game_rooms table)
   ============================================================ */

'use strict';

const Online = (() => {
  let channel = null;
  let sb = null;
  let roomCode = null;
  let isHost = false;    // host = BLACK, guest = WHITE
  let myColor = null;    // BLACK or WHITE constant from game.js
  let myTurn = false;
  let active = false;
  let joinTimeout = null;
  let refreshTimer = null;

  /* ── Helpers ─────────────────────────────────────────── */

  function isActive() { return active; }

  function $(id) { return document.getElementById(id); }

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

  function getTimeAgo(iso) {
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return '방금 전';
    const min = Math.floor(sec / 60);
    return `${min}분 전`;
  }

  /* ── Toast ───────────────────────────────────────────── */

  function toast(msg) {
    const container = $('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 2200);
  }

  /* ── Room DB ─────────────────────────────────────────── */

  async function dbCreateRoom(code) {
    const client = getSb();
    await client.from('game_rooms').insert({ game: 'omok', code, host_name: '대기 중' });
  }

  async function dbDeleteRoom(code) {
    if (!code) return;
    const client = getSb();
    await client.from('game_rooms').delete().eq('game', 'omok').eq('code', code);
  }

  async function dbListRooms() {
    const client = getSb();
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await client
      .from('game_rooms')
      .select('code, host_name, created_at')
      .eq('game', 'omok')
      .gt('created_at', tenMinAgo)
      .order('created_at', { ascending: false });
    return data || [];
  }

  /* ── Lobby ───────────────────────────────────────────── */

  function showLobby() {
    active = true;
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

  /* ── Create / Join ───────────────────────────────────── */

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

  /* ── Channel ─────────────────────────────────────────── */

  function connectChannel() {
    const client = getSb();
    channel = client.channel('omok-' + roomCode, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'joined' }, onOpponentJoined);
    channel.on('broadcast', { event: 'move' }, (msg) => onOpponentMove(msg.payload));
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
      dbDeleteRoom(roomCode);
    } else {
      toast('방에 입장했습니다!');
      dbDeleteRoom(roomCode);
    }
    startOnlineGame();
  }

  /* ── Game Start ──────────────────────────────────────── */

  function startOnlineGame() {
    myColor = isHost ? BLACK : WHITE;
    myTurn = isHost; // host = BLACK goes first

    initBoard();
    updateStatsUI();
    showScreen('game');
    resizeCanvas();

    // Update header to show ONLINE
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) headerTitle.textContent = 'ONLINE';

    // Disable undo in online mode
    const btnUndo = $('btn-undo');
    if (btnUndo) btnUndo.disabled = true;

    updateOnlineTurnUI();
  }

  function updateOnlineTurnUI() {
    const dot = $('turn-dot');
    const label = $('turn-label');
    const statusEl = $('status-text');

    if (myTurn) {
      if (dot) dot.className = myColor === BLACK ? 'stone-dot black' : 'stone-dot white';
      if (label) label.textContent = myColor === BLACK ? '나 (흑)' : '나 (백)';
      if (statusEl) statusEl.textContent = '내 차례 — 착수하세요';
      canvas.classList.remove('disabled');
    } else {
      const oppColor = myColor === BLACK ? WHITE : BLACK;
      if (dot) dot.className = oppColor === BLACK ? 'stone-dot black' : 'stone-dot white';
      if (label) label.textContent = oppColor === BLACK ? '상대 (흑)' : '상대 (백)';
      if (statusEl) statusEl.textContent = '상대방의 차례...';
      canvas.classList.add('disabled');
    }
  }

  /* ── My Move ─────────────────────────────────────────── */

  function handleTap(clientX, clientY) {
    if (!active || !myTurn || gameOver) return;
    const cell = getCell(clientX, clientY);
    if (!cell) return;
    const { r, c } = cell;
    if (board[r][c] !== EMPTY) return;

    // Send move to opponent
    channel.send({ type: 'broadcast', event: 'move', payload: { r, c } });

    // Place locally
    applyMove(r, c, myColor);
  }

  /* ── Opponent's Move ─────────────────────────────────── */

  function onOpponentMove(payload) {
    if (!active) return;
    const { r, c } = payload;
    const oppColor = myColor === BLACK ? WHITE : BLACK;
    applyMove(r, c, oppColor);
  }

  /* ── Apply Move (shared logic) ───────────────────────── */

  function applyMove(r, c, player) {
    currentPlayer = player;
    const result = placePiece(r, c, player);
    drawBoard();

    if (result === 'win') {
      const iWon = (player === myColor);
      endOnlineGame(iWon ? 'win' : 'loss');
      return;
    }
    if (result === 'draw') {
      endOnlineGame('draw');
      return;
    }

    // Switch turns
    myTurn = (player !== myColor);
    currentPlayer = myTurn ? myColor : (myColor === BLACK ? WHITE : BLACK);
    updateOnlineTurnUI();
  }

  /* ── End Game ────────────────────────────────────────── */

  function endOnlineGame(outcome) {
    gameOver = true;
    canvas.classList.add('disabled');

    // Update stats (online games count too)
    stats.games++;
    if (outcome === 'win') stats.wins++;
    else if (outcome === 'loss') stats.losses++;
    saveStats();
    updateStatsUI();

    setTimeout(() => {
      drawBoard();

      if (outcome === 'draw') {
        resultEmoji.textContent = '🤝';
        resultTitle.textContent = '무승부';
        resultTitle.className = 'result-title';
        resultSubtitle.textContent = '팽팽한 승부였습니다!';
      } else if (outcome === 'win') {
        resultEmoji.textContent = '🏆';
        resultTitle.textContent = '승리!';
        resultTitle.className = 'result-title win';
        resultSubtitle.textContent = '온라인 대전에서 이겼습니다!';
      } else {
        resultEmoji.textContent = '💭';
        resultTitle.textContent = '패배';
        resultTitle.className = 'result-title lose';
        resultSubtitle.textContent = '다시 도전해보세요.';
      }
      showScreen('result');
    }, 600);

    cleanup(false);
  }

  /* ── Opponent Left ───────────────────────────────────── */

  function onOpponentLeft() {
    if (!active) return;
    toast('상대방이 나갔습니다');
    cleanup(false);
    setTimeout(() => {
      // Restore header and return to start
      const headerTitle = document.querySelector('.header-title');
      if (headerTitle) headerTitle.textContent = 'OMOK';
      const btnUndo = $('btn-undo');
      if (btnUndo) btnUndo.disabled = false;
      updateStatsUI();
      showScreen('start');
    }, 2000);
  }

  /* ── Cleanup ─────────────────────────────────────────── */

  function cleanup(notify) {
    if (notify === undefined) notify = true;
    stopRefresh();

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
    myColor = null;
    myTurn = false;

    // Restore UI state
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) headerTitle.textContent = 'OMOK';
    const btnUndo = $('btn-undo');
    if (btnUndo) btnUndo.disabled = false;
  }

  function goBack() {
    cleanup();
    updateStatsUI();
    showScreen('start');
  }

  /* ── Tab close ───────────────────────────────────────── */

  window.addEventListener('beforeunload', () => {
    if (active && channel) {
      try { channel.send({ type: 'broadcast', event: 'left', payload: {} }); } catch (e) {}
    }
  });

  /* ── Wire up DOM ─────────────────────────────────────── */

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

    // Notify opponent if user navigates away mid-game via game buttons
    const cleanupIfActive = () => { if (active) cleanup(); };
    $('btn-home').addEventListener('click', cleanupIfActive);
    $('btn-restart').addEventListener('click', cleanupIfActive);
    $('btn-home-result').addEventListener('click', cleanupIfActive);
    $('btn-play-again').addEventListener('click', cleanupIfActive);
  });

  return { isActive, handleTap };
})();
