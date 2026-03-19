'use strict';

/* ============================================================
   Simon Game
   Mechanics: growing color sequence, player must repeat exactly.
   Speed tiers: normal / fast (>5) / faster (>10) / fastest (>15)
   Score = rounds completed (sequence length reached - 1).
   ============================================================ */

(function () {

  /* ----------------------------------------------------------
     Audio (Web Audio API)
     ---------------------------------------------------------- */
  const TONES = {
    red:    262,   // C4
    blue:   330,   // E4
    green:  392,   // G4
    yellow: 523,   // C5
    error:  100,   // buzzer
  };

  let audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  /**
   * Play a tone for `duration` ms.
   * @param {number} freq   - Hz
   * @param {number} duration - ms
   * @param {'sine'|'square'} [type]
   */
  function playTone(freq, duration, type = 'sine') {
    try {
      const ctx  = getAudioCtx();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type      = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const attack  = 0.01;
      const release = 0.08;
      const dur     = duration / 1000;

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + attack);
      gain.gain.setValueAtTime(0.5, ctx.currentTime + dur - release);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + dur);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur);
    } catch (e) {
      // Audio might be unavailable; fail silently.
    }
  }

  function playColor(color) {
    playTone(TONES[color], 300, 'sine');
  }

  function playError() {
    playTone(TONES.error, 500, 'square');
  }

  /* ----------------------------------------------------------
     DOM References
     ---------------------------------------------------------- */
  const startScreen    = document.getElementById('start-screen');
  const gameOverScreen = document.getElementById('gameover-screen');
  const gameArea       = document.getElementById('game-area');

  const startBtn       = document.getElementById('start-btn');
  const retryBtn       = document.getElementById('retry-btn');

  const startBestEl    = document.getElementById('start-best-score');
  const finalScoreEl   = document.getElementById('final-score');
  const finalBestEl    = document.getElementById('final-best-score');
  const scoreDisplayEl = document.getElementById('score-display');
  const bestDisplayEl  = document.getElementById('best-display');
  const roundDisplayEl = document.getElementById('round-display');
  const statusEl       = document.getElementById('status-text');

  const colorBtns = {
    red:    document.getElementById('btn-red'),
    blue:   document.getElementById('btn-blue'),
    green:  document.getElementById('btn-green'),
    yellow: document.getElementById('btn-yellow'),
  };

  /* ----------------------------------------------------------
     State
     ---------------------------------------------------------- */
  const COLORS = ['red', 'blue', 'green', 'yellow'];

  let sequence     = [];   // full sequence so far
  let playerIndex  = 0;   // how far through the sequence the player is
  let score        = 0;
  let bestScore    = 0;
  let isPlaying    = false;
  let playerTurn   = false;

  /* ----------------------------------------------------------
     Persistence
     ---------------------------------------------------------- */
  const STORAGE_KEY = 'simon_best';

  function loadBest() {
    const saved = localStorage.getItem(STORAGE_KEY);
    bestScore = saved ? parseInt(saved, 10) || 0 : 0;
  }

  function saveBest() {
    localStorage.setItem(STORAGE_KEY, String(bestScore));
  }

  /* ----------------------------------------------------------
     Speed schedule
     sequence length → { flashOn, flashOff }  (ms)
     ---------------------------------------------------------- */
  function getSpeed(len) {
    if (len > 15) return { on: 250, off: 100 };
    if (len > 10) return { on: 300, off: 150 };
    if (len > 5)  return { on: 400, off: 200 };
    return             { on: 500, off: 250 };
  }

  /* ----------------------------------------------------------
     Visual helpers
     ---------------------------------------------------------- */
  function lightUp(color) {
    colorBtns[color].classList.add('active');
  }

  function lightDown(color) {
    colorBtns[color].classList.remove('active');
  }

  function setStatus(text, className) {
    statusEl.textContent = text;
    statusEl.className   = 'status-text' + (className ? ' ' + className : '');
  }

  function updateScoreDisplay() {
    scoreDisplayEl.textContent = score;
    bestDisplayEl.textContent  = bestScore;
    roundDisplayEl.textContent = sequence.length;
  }

  function disableButtons() {
    Object.values(colorBtns).forEach(btn => btn.disabled = true);
  }

  function enableButtons() {
    Object.values(colorBtns).forEach(btn => btn.disabled = false);
  }

  /* ----------------------------------------------------------
     Wait utility
     ---------------------------------------------------------- */
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ----------------------------------------------------------
     Sequence playback
     ---------------------------------------------------------- */
  async function playSequence() {
    setStatus('지켜보세요...', 'watching');
    disableButtons();

    const speed = getSpeed(sequence.length);

    for (const color of sequence) {
      await wait(speed.off);       // gap before each flash
      lightUp(color);
      playColor(color);
      await wait(speed.on);
      lightDown(color);
    }

    await wait(200);

    // Hand off to player
    playerIndex = 0;
    playerTurn  = true;
    setStatus('따라하세요!', 'player');
    enableButtons();
  }

  /* ----------------------------------------------------------
     Round management
     ---------------------------------------------------------- */
  function addToSequence() {
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    sequence.push(color);
  }

  async function startRound() {
    playerTurn = false;
    addToSequence();
    updateScoreDisplay();
    await wait(600);
    await playSequence();
  }

  /* ----------------------------------------------------------
     Correct / Wrong handling
     ---------------------------------------------------------- */
  async function handleCorrect() {
    score = sequence.length - 1;
    if (score > bestScore) {
      bestScore = score;
      saveBest();
    }

    setStatus('정답!', 'correct');
    updateScoreDisplay();

    // Brief "정답" flash on the grid
    gameArea.classList.add('anim-correct');
    await wait(400);
    gameArea.classList.remove('anim-correct');

    await startRound();
  }

  async function handleWrong(tappedColor) {
    playerTurn = false;
    disableButtons();

    // Flash the wrong button red then do error sound
    const btn = colorBtns[tappedColor];
    btn.classList.add('active');
    playError();

    setStatus('틀렸습니다!', 'wrong');

    gameArea.classList.add('anim-wrong');
    await wait(500);
    btn.classList.remove('active');
    gameArea.classList.remove('anim-wrong');

    await wait(300);
    endGame();
  }

  /* ----------------------------------------------------------
     Player input
     ---------------------------------------------------------- */
  function handlePlayerTap(color) {
    if (!playerTurn) return;

    const expected = sequence[playerIndex];

    // Flash + sound regardless of correct/wrong
    lightUp(color);
    playColor(color);
    setTimeout(() => lightDown(color), 200);

    if (color !== expected) {
      handleWrong(color);
      return;
    }

    playerIndex++;

    if (playerIndex === sequence.length) {
      // Completed the full sequence for this round
      playerTurn = false;
      handleCorrect();
    }
    // else: wait for next tap
  }

  /* ----------------------------------------------------------
     Game lifecycle
     ---------------------------------------------------------- */
  function startGame() {
    isPlaying   = true;
    playerTurn  = false;
    score       = 0;
    sequence    = [];

    updateBestDisplays();

    // Hide overlays, show game
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    gameArea.classList.remove('hidden');

    updateScoreDisplay();
    setStatus('준비...', '');

    // Leaderboard integration
    if (typeof Leaderboard !== 'undefined') {
      Leaderboard.hide();
    }

    // Resume / unlock AudioContext on user gesture
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    startRound();
  }

  function endGame() {
    isPlaying  = false;
    playerTurn = false;

    finalScoreEl.textContent    = score;
    finalBestEl.textContent     = bestScore;

    gameArea.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');

    // Leaderboard integration
    if (typeof Leaderboard !== 'undefined') {
      Leaderboard.ready('simon', score);
    }
  }

  function updateBestDisplays() {
    startBestEl.textContent  = bestScore;
    bestDisplayEl.textContent = bestScore;
  }

  /* ----------------------------------------------------------
     Event listeners
     ---------------------------------------------------------- */
  startBtn.addEventListener('click', () => {
    // Unlock audio on first user gesture
    getAudioCtx();
    startGame();
  });

  retryBtn.addEventListener('click', () => {
    getAudioCtx();
    startGame();
  });

  Object.entries(colorBtns).forEach(([color, btn]) => {
    btn.addEventListener('click', () => handlePlayerTap(color));

    // Touch: prevent double-fire on mobile
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handlePlayerTap(color);
    }, { passive: false });
  });

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */
  loadBest();
  updateBestDisplays();

  // Ensure start screen is visible
  startScreen.classList.remove('hidden');
  gameArea.classList.add('hidden');
  gameOverScreen.classList.add('hidden');

}());
