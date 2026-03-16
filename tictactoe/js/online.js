/* ============================================================
   TICTACTOE ONLINE - online.js
   P2P multiplayer via Supabase Realtime Broadcast
   Room list via Supabase DB (game_rooms table)
   ============================================================ */

'use strict';

const Online = (() => {
  const $ = id => document.getElementById(id);

  let channel = null;
  let sb = null;
  let roomCode = null;
  let isHost = false;
  let myMark = null;      // 'X' (host) or 'O' (guest)
  let oppMark = null;
  let myTurn = false;
  let active = false;
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

  /* ── Toast ─────────────────────────────────────────── */

  function toast(msg) {
    const container = $('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('visible'));
    });
    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 350);
    }, 3000);
  }

  /* ── Room DB ───────────────────────────────────────── */

  async function dbCreateRoom(code) {
    const client = getSb();
    await client.from('game_rooms').insert({ game: 'tictactoe', code, host_name: '대기 중' });
  }

  async function dbDeleteRoom(code) {
    if (!code) return;
    const client = getSb();
    await client.from('game_rooms').delete().eq('game', 'tictactoe').eq('code', code);
  }

  async function dbListRooms() {
    const client = getSb();
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data } = await client
      .from('game_rooms')
      .select('code, host_name, created_at')
      .eq('game', 'tictactoe')
      .gt('created_at', tenMinAgo)
      .order('created_at', { ascending: false });
    return data || [];
  }

  /* ── Lobby ─────────────────────────────────────────── */

  function showLobby() {
    active = true;
    showScreen('lobby-screen');
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

  function getTimeAgo(iso) {
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return '방금 전';
    const min = Math.floor(sec / 60);
    return `${min}분 전`;
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

  /* ── Create / Join ─────────────────────────────────── */

  async function createRoom() {
    roomCode = genCode();
    isHost = true;
    myMark = 'X';
    oppMark = 'O';
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
    roomCode = code.toUpperCase().trim();
    isHost = false;
    myMark = 'O';
    oppMark = 'X';
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
    channel = client.channel('ttt-' + roomCode, {
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

  /* ── Game Start ────────────────────────────────────── */

  function startOnlineGame() {
    myTurn = isHost; // Host (X) goes first

    // Reset and show game board
    clearBoard();
    clearWinLine();
    board.fill(null);
    gameActive = true;
    currentTurn = 'X'; // X always goes first

    showScreen(null);
    updateOnlineHeader();
    updateOnlineStatus();
  }

  function updateOnlineHeader() {
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) headerTitle.textContent = 'ONLINE';

    const headerDiff = document.getElementById('current-diff');
    if (headerDiff) headerDiff.textContent = isHost ? 'X (나)' : 'O (나)';

    // Update scoreboard labels
    const scoreLabels = document.querySelectorAll('.score-label');
    const scoreNames = document.querySelectorAll('.score-name');
    if (scoreLabels.length >= 2 && scoreNames.length >= 2) {
      scoreLabels[0].textContent = '플레이어';
      scoreNames[0].textContent = '나 (X)';
      scoreLabels[1].textContent = '상대방';
      scoreNames[1].textContent = '상대 (O)';
    }
  }

  function updateOnlineStatus() {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    if (!statusDot || !statusText) return;

    if (myTurn) {
      statusDot.className = 'status-indicator player-turn';
      statusText.className = 'status-text player-turn';
      statusText.textContent = `내 차례 (${myMark})`;
    } else {
      statusDot.className = 'status-indicator ai-turn';
      statusText.className = 'status-text ai-turn';
      statusText.innerHTML = `상대방 차례 (${oppMark}) <span class="thinking-dots"><span></span><span></span><span></span></span>`;
    }
  }

  /* ── My Move ───────────────────────────────────────── */

  function handleCellClick(idx) {
    if (!active) return;
    if (!gameActive) return;
    if (!myTurn) {
      toast('상대방의 차례입니다');
      return;
    }
    if (board[idx] !== null) return;

    placeMove(idx, myMark);
    channel.send({ type: 'broadcast', event: 'move', payload: { idx } });

    const result = checkResult();
    if (result) {
      endOnlineGame(result);
      return;
    }

    myTurn = false;
    currentTurn = oppMark;
    updateOnlineStatus();
  }

  /* ── Opponent Move ─────────────────────────────────── */

  function onOpponentMove(payload) {
    const { idx } = payload;
    if (!gameActive) return;

    placeMove(idx, oppMark);

    const result = checkResult();
    if (result) {
      endOnlineGame(result);
      return;
    }

    myTurn = true;
    currentTurn = myMark;
    updateOnlineStatus();
  }

  /* ── End Game ──────────────────────────────────────── */

  function endOnlineGame(result) {
    gameActive = false;

    if (result.type === 'win') {
      highlightWinners(result.combo);
      drawWinLine(result.combo, result.who);

      const won = result.who === myMark;
      if (won) {
        score.wins++;
        showOnlineResult('win');
      } else {
        score.losses++;
        showOnlineResult('lose');
      }
    } else {
      score.draws++;
      showOnlineResult('draw');
    }

    saveScore();
    renderScore();
    cleanup(false);
  }

  function showOnlineResult(type) {
    const configs = {
      win:  { emoji: '🏆', title: '승리!',   titleClass: 'win',  subtitle: '상대방을 이겼습니다!' },
      lose: { emoji: '😢', title: '패배',     titleClass: 'lose', subtitle: '상대방이 이겼습니다. 다시 도전해보세요!' },
      draw: { emoji: '🤝', title: '무승부',   titleClass: 'draw', subtitle: '팽팽한 대결이었습니다!' },
    };
    const cfg = configs[type];
    const resultEmoji    = document.getElementById('result-emoji');
    const resultTitle    = document.getElementById('result-title');
    const resultSubtitle = document.getElementById('result-subtitle');

    resultEmoji.textContent = cfg.emoji;
    resultTitle.textContent = cfg.title;
    resultTitle.className = `result-title ${cfg.titleClass}`;
    resultSubtitle.textContent = cfg.subtitle;

    setTimeout(() => showScreen('result-screen'), 700);
  }

  /* ── Opponent Left ─────────────────────────────────── */

  function onOpponentLeft() {
    toast('상대방이 게임을 나갔습니다');
    gameActive = false;
    cleanup(false);
    setTimeout(() => {
      showScreen('start-screen');
      restoreNormalHeader();
    }, 2000);
  }

  /* ── Cleanup ───────────────────────────────────────── */

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
    myMark = null;
    oppMark = null;
    myTurn = false;
  }

  function restoreNormalHeader() {
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) headerTitle.textContent = 'TICTACTOE';

    const headerDiff = document.getElementById('current-diff');
    if (headerDiff) {
      const DIFFICULTY_LABEL = { easy: '쉬움', medium: '보통', hard: '어려움' };
      if (headerDiff) headerDiff.textContent = DIFFICULTY_LABEL[difficulty] || '어려움';
    }

    // Restore scoreboard labels
    const scoreLabels = document.querySelectorAll('.score-label');
    const scoreNames = document.querySelectorAll('.score-name');
    if (scoreLabels.length >= 2 && scoreNames.length >= 2) {
      scoreLabels[0].textContent = '플레이어';
      scoreNames[0].textContent = '나 (X)';
      scoreLabels[1].textContent = '컴퓨터';
      scoreNames[1].textContent = 'AI (O)';
    }
  }

  function goBack() {
    cleanup();
    restoreNormalHeader();
    showScreen('start-screen');
  }

  /* ── Tab close ─────────────────────────────────────── */

  window.addEventListener('beforeunload', () => {
    if (active && channel) {
      try { channel.send({ type: 'broadcast', event: 'left', payload: {} }); } catch (e) {}
    }
  });

  /* ── Wire up lobby DOM ─────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    const btnOnline = $('btn-online');
    if (btnOnline) btnOnline.addEventListener('click', showLobby);

    const btnCreate = $('btn-create-room');
    if (btnCreate) btnCreate.addEventListener('click', createRoom);

    const btnJoin = $('btn-join-room');
    if (btnJoin) btnJoin.addEventListener('click', joinRoom);

    const btnLobbyBack = $('btn-lobby-back');
    if (btnLobbyBack) btnLobbyBack.addEventListener('click', goBack);

    const btnWaitingCancel = $('btn-waiting-cancel');
    if (btnWaitingCancel) btnWaitingCancel.addEventListener('click', goBack);

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
  });

  return { isActive, handleCellClick, cleanup };
})();
