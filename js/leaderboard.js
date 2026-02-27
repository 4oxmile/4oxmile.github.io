/**
 * Leaderboard module for 4ox.kr games
 * Uses Supabase for score storage and retrieval
 */
window.Leaderboard = (() => {
  'use strict';

  const NICKNAME_KEY  = 'lb_nickname';
  const SCORES_TABLE  = 'scores';

  /* Game-specific options for ascending/format/label */
  const GAME_OPTS = {
    memory:      { ascending: true, label: '이동' },
    puzzle:      { ascending: true, label: '이동' },
    sokoban:     { ascending: true, label: '이동' },
    maze:        { ascending: true, format: 'time', label: '시간' },
    minesweeper: { ascending: true, format: 'time', label: '시간' },
    sudoku:      { ascending: true, format: 'time', label: '시간' },
    reaction:    { ascending: true, format: 'ms',   label: '시간' },
  };

  /* All possible start screen element IDs across games */
  const START_IDS = [
    'start-screen', 'startScreen', 'start-overlay', 'startOverlay',
    'overlay-start', 'overlayStart', 'screen-start',
  ];

  let currentGame    = '';
  let currentScore   = 0;
  let opts           = { ascending: false, format: null, label: '점수' };
  let client         = null;
  let overlayEl      = null;
  let fabEl          = null;
  let submitted      = false;
  let startRankEl    = null;

  /* ── Supabase client ───────────────────────────── */
  function getClient() {
    if (client) return client;
    try {
      if (window.supabase &&
          window.SUPABASE_URL &&
          window.SUPABASE_ANON_KEY &&
          window.SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
        client = window.supabase.createClient(
          window.SUPABASE_URL,
          window.SUPABASE_ANON_KEY
        );
      }
    } catch (e) {
      console.warn('[Leaderboard] Supabase init failed:', e);
    }
    return client;
  }

  /* ── Nickname persistence ──────────────────────── */
  function getSavedNickname() {
    return localStorage.getItem(NICKNAME_KEY) || '';
  }

  function saveNickname(name) {
    localStorage.setItem(NICKNAME_KEY, name.trim());
  }

  /* ── Format score ──────────────────────────────── */
  function formatScore(val) {
    if (opts.format === 'ms') {
      return (val / 1000).toFixed(2) + '초';
    }
    if (opts.format === 'time') {
      const m = Math.floor(val / 60);
      const s = val % 60;
      return m > 0 ? m + '분 ' + s + '초' : s + '초';
    }
    return String(val);
  }

  /* ── Escape HTML ───────────────────────────────── */
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ── FAB ────────────────────────────────────────── */
  function createFAB() {
    if (fabEl) return;
    fabEl = document.createElement('button');
    fabEl.id = 'lb-fab';
    fabEl.textContent = '🏆 랭킹';
    fabEl.addEventListener('click', openOverlay);
    document.body.appendChild(fabEl);
  }

  function showFAB() {
    createFAB();
    requestAnimationFrame(() => fabEl.classList.add('lb-fab-visible'));
  }

  function hideFAB() {
    if (fabEl) fabEl.classList.remove('lb-fab-visible');
  }

  /* ── Overlay ───────────────────────────────────── */
  function buildOverlay() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }

    overlayEl = document.createElement('div');
    overlayEl.id = 'lb-overlay';
    overlayEl.className = 'lb-overlay';
    overlayEl.innerHTML =
      '<div class="lb-card">' +
        '<div class="lb-header">' +
          '<div class="lb-title">🏆 랭킹</div>' +
          '<button class="lb-close" aria-label="닫기">✕</button>' +
        '</div>' +
        '<div class="lb-my">' +
          '<span class="lb-my-label">' + esc(opts.label) + '</span>' +
          '<span class="lb-my-value">' + esc(formatScore(currentScore)) + '</span>' +
        '</div>' +
        '<div class="lb-submit-row">' +
          '<input class="lb-input" type="text" placeholder="닉네임" maxlength="12" value="' + esc(getSavedNickname()) + '" />' +
          '<button class="lb-submit-btn">등록</button>' +
        '</div>' +
        '<div class="lb-submitted-msg">✅ 등록 완료!</div>' +
        '<div class="lb-sep"></div>' +
        '<div class="lb-list-head">' +
          '<span class="lb-col-rank">#</span>' +
          '<span class="lb-col-name">닉네임</span>' +
          '<span class="lb-col-score">' + esc(opts.label) + '</span>' +
        '</div>' +
        '<div class="lb-list"></div>' +
        '<div class="lb-status"></div>' +
      '</div>';

    document.body.appendChild(overlayEl);

    /* Events */
    overlayEl.querySelector('.lb-close').addEventListener('click', closeOverlay);
    overlayEl.addEventListener('click', function (e) {
      if (e.target === overlayEl) closeOverlay();
    });
    overlayEl.querySelector('.lb-submit-btn').addEventListener('click', handleSubmit);
    overlayEl.querySelector('.lb-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleSubmit();
    });
  }

  function openOverlay() {
    buildOverlay();
    requestAnimationFrame(function () {
      overlayEl.classList.add('lb-visible');
    });
    loadLeaderboard();
  }

  function closeOverlay() {
    if (overlayEl) overlayEl.classList.remove('lb-visible');
  }

  /* ── Submit ────────────────────────────────────── */
  async function handleSubmit() {
    var input = overlayEl.querySelector('.lb-input');
    var btn   = overlayEl.querySelector('.lb-submit-btn');
    var nickname = input.value.trim();

    if (!nickname) {
      input.focus();
      input.style.borderColor = '#EF4444';
      setTimeout(function () { input.style.borderColor = ''; }, 1000);
      return;
    }

    saveNickname(nickname);
    btn.textContent = '등록 중...';
    btn.disabled = true;

    var db = getClient();
    if (!db) {
      btn.textContent = '연결 실패';
      setTimeout(function () { btn.textContent = '등록'; btn.disabled = false; }, 2000);
      return;
    }

    try {
      var result = await db.from(SCORES_TABLE).insert({
        game: currentGame,
        nickname: nickname,
        score: currentScore,
      });

      if (result.error) throw result.error;

      submitted = true;
      overlayEl.querySelector('.lb-submit-row').style.display = 'none';
      overlayEl.querySelector('.lb-submitted-msg').style.display = 'block';
      loadLeaderboard();
    } catch (e) {
      console.error('[Leaderboard] Submit error:', e);
      btn.textContent = '실패 — 재시도';
      btn.disabled = false;
    }
  }

  /* ── Load leaderboard ──────────────────────────── */
  async function loadLeaderboard() {
    var listEl   = overlayEl.querySelector('.lb-list');
    var statusEl = overlayEl.querySelector('.lb-status');

    listEl.innerHTML = '';
    statusEl.textContent = '불러오는 중...';
    statusEl.style.display = 'block';

    var db = getClient();
    if (!db) {
      statusEl.textContent = '리더보드 서비스 준비 중';
      return;
    }

    try {
      var res = await db
        .from(SCORES_TABLE)
        .select('nickname, score, created_at')
        .eq('game', currentGame)
        .order('score', { ascending: opts.ascending })
        .limit(20);

      if (res.error) throw res.error;

      var data = res.data || [];
      statusEl.style.display = 'none';

      if (data.length === 0) {
        statusEl.textContent = '아직 기록이 없습니다. 첫 번째 도전자가 되세요!';
        statusEl.style.display = 'block';
        return;
      }

      var savedNick = getSavedNickname();
      var highlighted = false;

      for (var i = 0; i < data.length; i++) {
        var row   = data[i];
        var rowEl = document.createElement('div');
        rowEl.className = 'lb-row';

        if (!highlighted && row.nickname === savedNick && row.score === currentScore) {
          rowEl.classList.add('lb-row-mine');
          highlighted = true;
        }

        var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);

        rowEl.innerHTML =
          '<span class="lb-col-rank">' + medal + '</span>' +
          '<span class="lb-col-name">' + esc(row.nickname) + '</span>' +
          '<span class="lb-col-score">' + formatScore(row.score) + '</span>';

        listEl.appendChild(rowEl);
      }
    } catch (e) {
      console.error('[Leaderboard] Fetch error:', e);
      statusEl.textContent = '랭킹을 불러올 수 없습니다';
    }
  }

  /* ── Start Screen Ranking ─────────────────────── */
  function detectGame() {
    var parts = window.location.pathname.split('/').filter(Boolean);
    return parts[0] || '';
  }

  function findStartScreen() {
    for (var i = 0; i < START_IDS.length; i++) {
      var el = document.getElementById(START_IDS[i]);
      if (el) return el;
    }
    return null;
  }

  function getGameOpts(game) {
    return GAME_OPTS[game] || {};
  }

  function formatWithOpts(val, gameOpts) {
    if (gameOpts.format === 'ms') {
      return (val / 1000).toFixed(2) + '초';
    }
    if (gameOpts.format === 'time') {
      var m = Math.floor(val / 60);
      var s = val % 60;
      return m > 0 ? m + '분 ' + s + '초' : s + '초';
    }
    return String(val);
  }

  function injectStartRanking() {
    var game = detectGame();
    if (!game) return;

    var screen = findStartScreen();
    if (!screen) return;

    /* Find the inner content container */
    var container = screen.querySelector('.overlay-content')
                 || screen.querySelector('.screen-content')
                 || screen;

    /* Don't double-inject */
    if (container.querySelector('.lb-start-ranking')) return;

    startRankEl = document.createElement('div');
    startRankEl.className = 'lb-start-ranking';
    startRankEl.innerHTML =
      '<div class="lb-start-title">TOP 5</div>' +
      '<div class="lb-start-list"></div>' +
      '<div class="lb-start-status">불러오는 중...</div>';
    container.appendChild(startRankEl);

    loadStartRanking(game);
  }

  async function loadStartRanking(game) {
    if (!startRankEl) return;
    var listEl   = startRankEl.querySelector('.lb-start-list');
    var statusEl = startRankEl.querySelector('.lb-start-status');
    var gameOpts = getGameOpts(game);
    var asc      = gameOpts.ascending || false;

    var db = getClient();
    if (!db) {
      statusEl.textContent = '';
      statusEl.style.display = 'none';
      return;
    }

    try {
      var res = await db
        .from(SCORES_TABLE)
        .select('nickname, score')
        .eq('game', game)
        .order('score', { ascending: asc })
        .limit(5);

      if (res.error) throw res.error;

      var data = res.data || [];
      statusEl.style.display = 'none';

      if (data.length === 0) {
        statusEl.textContent = '아직 기록이 없습니다';
        statusEl.style.display = 'block';
        return;
      }

      var medals = ['🥇', '🥈', '🥉', '4', '5'];
      for (var i = 0; i < data.length; i++) {
        var row = document.createElement('div');
        row.className = 'lb-start-row';
        row.innerHTML =
          '<span class="lb-start-rank">' + medals[i] + '</span>' +
          '<span class="lb-start-name">' + esc(data[i].nickname) + '</span>' +
          '<span class="lb-start-score">' + formatWithOpts(data[i].score, gameOpts) + '</span>';
        listEl.appendChild(row);
      }
    } catch (e) {
      console.warn('[Leaderboard] Start ranking fetch error:', e);
      statusEl.textContent = '';
      statusEl.style.display = 'none';
    }
  }

  /* Auto-init on page load */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStartRanking);
  } else {
    injectStartRanking();
  }

  /* ── Public API ────────────────────────────────── */
  return {
    /**
     * Show the leaderboard FAB button.
     * @param {string} game  — game identifier slug
     * @param {number} score — player's score
     * @param {object} [options]
     * @param {boolean} [options.ascending=false] — true if lower score is better
     * @param {string}  [options.format=null]     — 'ms' | 'time' | null
     * @param {string}  [options.label='점수']    — column label
     */
    ready: function (game, score, options) {
      currentGame  = game;
      currentScore = score;
      opts = {
        ascending: false,
        format:    null,
        label:     '점수',
      };
      if (options) {
        if (options.ascending !== undefined) opts.ascending = options.ascending;
        if (options.format    !== undefined) opts.format    = options.format;
        if (options.label     !== undefined) opts.label     = options.label;
      }
      submitted = false;
      showFAB();
    },

    hide: function () {
      hideFAB();
      closeOverlay();
    },

    show: openOverlay,
  };
})();
