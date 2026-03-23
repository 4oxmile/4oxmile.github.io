/* ============================================================
   SKIPPITY ONLINE — online.js
   P2P multiplayer via Supabase Realtime Broadcast
   Room list via Supabase DB (game_rooms table)
   ============================================================ */

'use strict';

const Online = (() => {
  let channel = null;
  let sb = null;
  let roomCode = null;
  let isHost = false;
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
    await client.from('game_rooms').insert({ game: 'skippity', code, host_name: '대기 중' });
  }

  async function dbDeleteRoom(code) {
    if (!code) return;
    const client = getSb();
    await client.from('game_rooms').delete().eq('game', 'skippity').eq('code', code);
  }

  async function dbListRooms() {
    const client = getSb();
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await client
      .from('game_rooms')
      .select('code, host_name, created_at')
      .eq('game', 'skippity')
      .gt('created_at', tenMinAgo)
      .order('created_at', { ascending: false });
    return data || [];
  }

  /* ── Lobby ───────────────────────────────────────────── */

  function showScreen(which) {
    $('start-overlay').classList.toggle('hidden', which !== 'start');
    $('result-overlay').classList.toggle('hidden', which !== 'result');
    const lobby = $('lobby-screen');
    if (lobby) lobby.classList.toggle('hidden', which !== 'lobby');
  }

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
    channel = client.channel('skippity-' + roomCode, {
      config: { broadcast: { self: false } }
    });

    channel.on('broadcast', { event: 'joined' }, onOpponentJoined);
    channel.on('broadcast', { event: 'board' }, (msg) => onBoardReceived(msg.payload));
    channel.on('broadcast', { event: 'turn' }, (msg) => onOpponentTurn(msg.payload));
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

      // Host generates board and sends it
      const b = Game.createBoard();
      Game.setBoard(b);
      const flat = Game.flattenBoard();
      channel.send({ type: 'broadcast', event: 'board', payload: { board: flat } });

      // Start game: host goes first
      startOnlineGame(flat, true);
    } else {
      toast('방에 입장했습니다!');
      dbDeleteRoom(roomCode);
      // Wait for host to send board
    }
  }

  function onBoardReceived(payload) {
    // Guest receives board from host
    if (!isHost) {
      startOnlineGame(payload.board, false);
    }
  }

  /* ── Game Start ──────────────────────────────────────── */

  function startOnlineGame(flatBoard, iAmFirst) {
    myTurn = iAmFirst;

    // Set callback for when player finishes a turn
    Game.setOnTurnEnd(onMyTurnEnd);
    Game.startOnline(flatBoard, iAmFirst);

    // Disable restart in online mode
    const restartBtn = $('restart-btn');
    if (restartBtn) restartBtn.disabled = true;
  }

  /* ── My Turn End ─────────────────────────────────────── */

  function onMyTurnEnd(moves) {
    if (!active || !channel) return;
    myTurn = false;

    // Send my moves to opponent
    channel.send({ type: 'broadcast', event: 'turn', payload: { moves } });

    // Check if game is over
    if (!Game.hasAnyJumps()) {
      Game.endGame();
    }
  }

  /* ── Opponent Turn ───────────────────────────────────── */

  function onOpponentTurn(payload) {
    if (!active) return;
    myTurn = true;

    // Animate opponent's moves then switch to my turn
    Game.applyOpponentMoves(payload.moves, 0);
  }

  /* ── Opponent Left ───────────────────────────────────── */

  function onOpponentLeft() {
    if (!active) return;
    toast('상대방이 나갔습니다');
    cleanup(false);
    setTimeout(() => {
      Game.showMenu();
      const restartBtn = $('restart-btn');
      if (restartBtn) restartBtn.disabled = false;
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
    myTurn = false;

    Game.setOnline(false);
    Game.setActive(false);

    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) headerTitle.textContent = 'SKIPPITY';
    const restartBtn = $('restart-btn');
    if (restartBtn) restartBtn.disabled = false;
    const aiLabel = $('ai-label');
    if (aiLabel) aiLabel.textContent = 'AI';
  }

  function goBack() {
    cleanup();
    showScreen('start');
    Game.showMenu();
  }

  /* ── Before Unload ───────────────────────────────────── */

  window.addEventListener('beforeunload', () => {
    if (active && channel) {
      try { channel.send({ type: 'broadcast', event: 'left', payload: {} }); } catch (e) {}
    }
  });

  /* ── DOM Wiring ──────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    const btnOnline = $('btn-online');
    if (btnOnline) btnOnline.addEventListener('click', showLobby);

    const btnCreate = $('btn-create-room');
    if (btnCreate) btnCreate.addEventListener('click', createRoom);

    const btnJoin = $('btn-join-room');
    if (btnJoin) btnJoin.addEventListener('click', joinRoom);

    const btnLobbyBack = $('btn-lobby-back');
    if (btnLobbyBack) btnLobbyBack.addEventListener('click', goBack);

    const btnWaitCancel = $('btn-waiting-cancel');
    if (btnWaitCancel) btnWaitCancel.addEventListener('click', goBack);

    const btnRefresh = $('btn-refresh-rooms');
    if (btnRefresh) btnRefresh.addEventListener('click', loadRoomList);

    const btnCopy = $('btn-copy-code');
    if (btnCopy) btnCopy.addEventListener('click', () => {
      if (!roomCode) return;
      navigator.clipboard.writeText(roomCode)
        .then(() => toast('코드가 복사되었습니다'))
        .catch(() => {});
    });

    const codeInput = $('join-code-input');
    if (codeInput) codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinRoom();
    });

    // Cleanup on navigation
    const cleanupIfActive = () => { if (active) cleanup(); };
    const homeBtn = document.querySelector('.home-btn');
    if (homeBtn) homeBtn.addEventListener('click', cleanupIfActive);

    const menuBtn = $('menu-btn');
    if (menuBtn) menuBtn.addEventListener('click', cleanupIfActive);

    const backBtn = $('back-btn');
    if (backBtn) backBtn.addEventListener('click', cleanupIfActive);

    const playAgainBtn = $('play-again-btn');
    if (playAgainBtn) playAgainBtn.addEventListener('click', cleanupIfActive);
  });

  /* ── Public API ──────────────────────────────────────── */

  return { isActive };
})();
