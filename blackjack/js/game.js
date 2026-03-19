/**
 * Blackjack — Vanilla JS, no frameworks.
 * Rules:
 *   - 6-deck shoe, reshuffled when < 52 cards remain
 *   - Player: Hit, Stand, Double Down (first two cards), Split (same rank)
 *   - Dealer: hits on soft 16, stands on hard/soft 17+
 *   - Blackjack (natural A+10-value) pays 3:2
 *   - Push: bet returned
 *   - Split: each hand gets its own bet equal to original; can split up to 4 hands
 *   - Double Down: bet doubles, receive exactly 1 more card then auto-stand
 */
(function () {
  'use strict';

  const SUITS     = ['hearts', 'diamonds', 'clubs', 'spades'];
  const SUIT_SYM  = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  const SUIT_COLOR= { hearts: 'red', diamonds: 'red', clubs: 'black', spades: 'black' };
  const RANKS     = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const NUM_DECKS = 6;
  const MIN_SHOE  = 52; // reshuffle below this

  // State
  let shoe = [];
  let playerHands   = []; // [{cards:[], bet:0, status:'active'|'stand'|'bust'|'blackjack'|'win'|'lose'|'push'}]
  let activeHandIdx = 0;
  let dealerHand    = [];
  let chips         = 1000;
  let maxChips      = 1000;
  let bet           = 0;
  let phase         = 'bet'; // 'bet' | 'player' | 'dealer' | 'result'
  let rounds        = 0;

  // ─── Shoe ───────────────────────────────────────────────────────────────────
  function makeShoe() {
    const deck = [];
    for (let d = 0; d < NUM_DECKS; d++)
      for (const suit of SUITS)
        for (const rank of RANKS)
          deck.push({ suit, rank });
    return deck;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildShoe() {
    shoe = shuffle(makeShoe());
  }

  function drawCard() {
    if (shoe.length < MIN_SHOE) buildShoe();
    return shoe.pop();
  }

  // ─── Hand Value ─────────────────────────────────────────────────────────────
  function cardValue(rank) {
    if (rank === 'A') return 11;
    if (['J','Q','K'].includes(rank)) return 10;
    return parseInt(rank, 10);
  }

  function handValue(cards) {
    let val = 0, aces = 0;
    for (const c of cards) {
      if (c._hidden) continue;
      if (c.rank === 'A') { val += 11; aces++; }
      else val += cardValue(c.rank);
    }
    while (val > 21 && aces > 0) { val -= 10; aces--; }
    return val;
  }

  function isSoft(cards) {
    let val = 0, aces = 0;
    for (const c of cards) {
      if (c.rank === 'A') { val += 11; aces++; } else val += cardValue(c.rank);
    }
    return aces > 0 && val <= 21;
  }

  function isBlackjack(cards) { return cards.length === 2 && handValue(cards) === 21; }

  // ─── Card DOM ───────────────────────────────────────────────────────────────
  function buildCardEl(card) {
    const el = document.createElement('div');
    if (card._hidden) {
      el.className = 'card face-down';
      el.innerHTML = '<div class="card-inner"></div>';
    } else {
      el.className = `card face-up suit-${SUIT_COLOR[card.suit]}`;
      el.dataset.suit = card.suit;
      el.dataset.rank = card.rank;
      el.innerHTML = `
        <div class="card-inner">
          <div class="card-face">
            <span class="card-corner-tl">
              <span class="card-rank">${card.rank}</span>
              <span class="card-suit-corner">${SUIT_SYM[card.suit]}</span>
            </span>
            <span class="card-suit-center">${SUIT_SYM[card.suit]}</span>
            <span class="card-corner-br">
              <span class="card-rank">${card.rank}</span>
              <span class="card-suit-corner">${SUIT_SYM[card.suit]}</span>
            </span>
          </div>
        </div>`;
    }
    return el;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  function renderDealer() {
    const container = document.getElementById('dealer-cards');
    const scoreEl   = document.getElementById('dealer-score');
    container.innerHTML = '';
    dealerHand.forEach(c => container.appendChild(buildCardEl(c)));
    const vis = dealerHand.filter(c => !c._hidden);
    if (vis.length === 0) { scoreEl.textContent = ''; return; }
    const val = handValue(vis);
    scoreEl.textContent = dealerHand.some(c => c._hidden) ? '?' : val;
    scoreEl.className = 'hand-score' +
      (val > 21 ? ' bust' :
       val === 21 && dealerHand.length === 2 ? ' blackjack-score' : '');
  }

  function renderHands() {
    const wrap = document.getElementById('player-hands-wrap');
    wrap.innerHTML = '';
    playerHands.forEach((hand, idx) => {
      const div = document.createElement('div');
      div.className = 'player-hand' +
        (idx === activeHandIdx && phase === 'player' ? ' active-hand' : '');

      const label = document.createElement('div');
      label.className = 'hand-label';
      let labelText = playerHands.length > 1 ? `핸드 ${idx + 1} ` : '플레이어 ';
      if (phase === 'player' && idx === activeHandIdx) {
        labelText += '<span class="active-indicator"></span> ';
      }
      const val = handValue(hand.cards);
      let scoreClass = 'hand-score';
      if (val > 21) scoreClass += ' bust';
      else if (val === 21 && hand.cards.length === 2) scoreClass += ' blackjack-score';
      labelText += `<span class="${scoreClass}">${val}</span>`;

      if (hand.status !== 'active') {
        const map = {
          stand:     '스탠드',
          bust:      '버스트',
          blackjack: '블랙잭',
          win:       '승 +' + hand.payout,
          lose:      '패',
          push:      '푸시 환급',
        };
        const cls = (hand.status === 'win' || hand.status === 'blackjack') ? 'win' :
                    (hand.status === 'lose' || hand.status === 'bust')     ? 'lose' : 'push';
        labelText += ` <span class="hand-result-badge ${cls}">${map[hand.status] || hand.status}</span>`;
      }
      label.innerHTML = labelText;
      div.appendChild(label);

      const row = document.createElement('div');
      row.className = 'card-row';
      hand.cards.forEach(c => row.appendChild(buildCardEl(c)));
      div.appendChild(row);
      wrap.appendChild(div);
    });
  }

  function renderStats() {
    document.getElementById('chips-val').textContent     = chips.toLocaleString();
    document.getElementById('bet-val').textContent       = bet > 0 ? bet.toLocaleString() : '0';
    document.getElementById('round-val').textContent     = rounds;
    document.getElementById('max-chips-val').textContent = maxChips.toLocaleString();
  }

  function renderControls() {
    const betCtrl    = document.getElementById('bet-controls');
    const actionCtrl = document.getElementById('action-controls');

    if (phase === 'bet') {
      betCtrl.classList.remove('hidden');
      actionCtrl.classList.add('hidden');
      document.querySelectorAll('.chip-btn').forEach(btn => {
        const val = parseInt(btn.dataset.val);
        btn.disabled = val > chips;
      });
      document.getElementById('deal-btn').disabled = (bet === 0 || bet > chips);
    } else {
      betCtrl.classList.add('hidden');
      actionCtrl.classList.remove('hidden');
      if (phase === 'player') {
        const hand    = playerHands[activeHandIdx];
        const isFirst = hand && hand.cards.length === 2;
        const canDouble = isFirst && chips >= hand.bet;
        const canSplit  = isFirst &&
                          hand.cards[0].rank === hand.cards[1].rank &&
                          playerHands.length < 4 &&
                          chips >= hand.bet;
        document.getElementById('double-btn').disabled = !canDouble;
        document.getElementById('split-btn').disabled  = !canSplit;
      }
    }
  }

  function renderAll() {
    renderDealer();
    renderHands();
    renderStats();
    renderControls();
  }

  // ─── Deal ────────────────────────────────────────────────────────────────────
  function startRound() {
    if (shoe.length < MIN_SHOE) buildShoe();
    rounds++;
    playerHands   = [{ cards: [], bet: bet, status: 'active', payout: 0 }];
    activeHandIdx = 0;
    dealerHand    = [];
    phase         = 'player';

    // Deal: p1, d1, p2, d2(hidden)
    playerHands[0].cards.push(drawCard(), drawCard());
    dealerHand.push(drawCard());
    const hidden = drawCard();
    hidden._hidden = true;
    dealerHand.push(hidden);

    bet = 0; // displayed bet reset; hand.bet holds the stake
    renderAll();

    // Natural blackjack check
    if (isBlackjack(playerHands[0].cards)) {
      playerHands[0].status = 'blackjack';
      setTimeout(dealerPlay, 600);
      return;
    }

    // Dealer peek for blackjack
    const dealerFull = dealerHand.map(c => ({ ...c, _hidden: false }));
    if (isBlackjack(dealerFull)) {
      dealerHand.forEach(c => delete c._hidden);
      renderAll();
      setTimeout(resolveHands, 800);
      return;
    }
  }

  // ─── Player Actions ─────────────────────────────────────────────────────────
  function hit() {
    if (phase !== 'player') return;
    const hand = playerHands[activeHandIdx];
    hand.cards.push(drawCard());
    if (handValue(hand.cards) > 21) {
      hand.status = 'bust';
      nextHand();
    }
    renderAll();
  }

  function stand() {
    if (phase !== 'player') return;
    playerHands[activeHandIdx].status = 'stand';
    nextHand();
    renderAll();
  }

  function doubleDown() {
    if (phase !== 'player') return;
    const hand = playerHands[activeHandIdx];
    if (hand.cards.length !== 2 || chips < hand.bet) return;
    chips -= hand.bet;
    hand.bet *= 2;
    hand.cards.push(drawCard());
    if (handValue(hand.cards) > 21) hand.status = 'bust';
    else hand.status = 'stand';
    nextHand();
    renderAll();
  }

  function split() {
    if (phase !== 'player') return;
    const hand = playerHands[activeHandIdx];
    if (hand.cards.length !== 2 || hand.cards[0].rank !== hand.cards[1].rank) return;
    if (playerHands.length >= 4 || chips < hand.bet) return;
    chips -= hand.bet;
    const c2 = hand.cards.pop();
    const newHand = { cards: [c2, drawCard()], bet: hand.bet, status: 'active', payout: 0 };
    hand.cards.push(drawCard());
    playerHands.splice(activeHandIdx + 1, 0, newHand);
    renderAll();
  }

  function nextHand() {
    for (let i = activeHandIdx + 1; i < playerHands.length; i++) {
      if (playerHands[i].status === 'active') {
        activeHandIdx = i;
        renderAll();
        return;
      }
    }
    // All hands resolved — dealer plays
    dealerPlay();
  }

  // ─── Dealer ─────────────────────────────────────────────────────────────────
  function dealerPlay() {
    phase = 'dealer';
    dealerHand.forEach(c => delete c._hidden);
    renderAll();

    const allBust = playerHands.every(h => h.status === 'bust');
    if (allBust) {
      setTimeout(resolveHands, 600);
      return;
    }

    function dealerStep() {
      const val = handValue(dealerHand);
      if (val < 17 || (val === 17 && isSoft(dealerHand))) {
        dealerHand.push(drawCard());
        renderAll();
        setTimeout(dealerStep, 500);
      } else {
        resolveHands();
      }
    }
    setTimeout(dealerStep, 600);
  }

  // ─── Resolve ────────────────────────────────────────────────────────────────
  function resolveHands() {
    const dVal     = handValue(dealerHand);
    const dealerBust = dVal > 21;
    const dealerBJ   = isBlackjack(dealerHand);
    let totalDelta   = 0;

    playerHands.forEach(hand => {
      const pVal = handValue(hand.cards);
      const pBJ  = isBlackjack(hand.cards) && hand.cards.length === 2;

      if (hand.status === 'bust') {
        hand.payout = -hand.bet;
        totalDelta -= hand.bet;
        hand.status = 'lose';
      } else if (pBJ && !dealerBJ) {
        // Natural blackjack pays 3:2
        const payout = Math.floor(hand.bet * 1.5);
        hand.payout = payout;
        chips += hand.bet + payout;
        totalDelta += payout;
        hand.status = 'blackjack';
      } else if (pBJ && dealerBJ) {
        chips += hand.bet;
        hand.payout = 0;
        hand.status = 'push';
      } else if (!pBJ && dealerBJ) {
        hand.payout = -hand.bet;
        totalDelta -= hand.bet;
        hand.status = 'lose';
      } else if (dealerBust || pVal > dVal) {
        chips += hand.bet * 2;
        hand.payout = hand.bet;
        totalDelta += hand.bet;
        hand.status = 'win';
      } else if (pVal === dVal) {
        chips += hand.bet;
        hand.payout = 0;
        hand.status = 'push';
      } else {
        hand.payout = -hand.bet;
        totalDelta -= hand.bet;
        hand.status = 'lose';
      }
    });

    if (chips > maxChips) maxChips = chips;

    phase = 'result';
    renderAll();
    showResultMsg(totalDelta);

    setTimeout(() => {
      hideResultMsg();
      if (chips <= 0) {
        endGame();
        return;
      }
      phase = 'bet';
      bet   = 0;
      renderAll();
    }, 1800);
  }

  // ─── UI Helpers ─────────────────────────────────────────────────────────────
  function showResultMsg(delta) {
    const el = document.getElementById('result-msg');
    el.classList.remove('hidden', 'win', 'lose', 'push', 'blackjack');
    if (delta > 0) {
      el.textContent = `+${delta} 칩 획득! 🎉`;
      el.classList.add('win');
    } else if (delta < 0) {
      el.textContent = `${delta} 칩 패배`;
      el.classList.add('lose');
    } else {
      el.textContent = '푸시 — 베팅 환급';
      el.classList.add('push');
    }
  }

  function hideResultMsg() {
    document.getElementById('result-msg').classList.add('hidden');
  }

  function endGame() {
    document.getElementById('win-chips').textContent     = chips.toLocaleString();
    document.getElementById('win-rounds').textContent    = rounds;
    document.getElementById('win-max-chips').textContent = maxChips.toLocaleString();
    document.getElementById('win-icon').textContent      = maxChips > 1000 ? '🏆' : maxChips === 1000 ? '😐' : '💸';
    document.getElementById('win-title').textContent     = maxChips > 1000 ? '대박!' : chips > 0 ? '게임 종료' : '파산!';

    document.getElementById('win-screen').classList.add('active');

    Leaderboard.ready('blackjack', maxChips, {
      ascending: false,
      label: '칩',
    });
  }

  // ─── Init & Events ──────────────────────────────────────────────────────────
  function initGame() {
    if (typeof Leaderboard !== 'undefined') Leaderboard.hide();

    buildShoe();
    chips    = 1000;
    maxChips = 1000;
    bet      = 0;
    rounds   = 0;
    phase  = 'bet';
    dealerHand  = [];
    playerHands = [];

    document.getElementById('dealer-cards').innerHTML     = '';
    document.getElementById('player-hands-wrap').innerHTML = '';
    document.getElementById('result-msg').classList.add('hidden');
    document.getElementById('win-screen').classList.remove('active');
    document.getElementById('start-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Start screen
    document.querySelector('.start-btn').addEventListener('click', initGame);

    // Restart
    document.getElementById('restart-icon-btn').addEventListener('click', () => {
      if (confirm('새 게임을 시작하시겠습니까?')) initGame();
    });
    document.getElementById('win-again-btn').addEventListener('click', initGame);

    // Chip buttons
    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (phase !== 'bet') return;
        const val = parseInt(btn.dataset.val);
        if (val > chips) return;
        bet = Math.min(bet + val, chips);
        renderStats();
        document.getElementById('deal-btn').disabled = (bet === 0);
        renderControls();
      });
    });

    document.getElementById('clear-bet-btn').addEventListener('click', () => {
      bet = 0;
      renderStats();
      document.getElementById('deal-btn').disabled = true;
      renderControls();
    });

    document.getElementById('deal-btn').addEventListener('click', () => {
      if (bet <= 0 || bet > chips || phase !== 'bet') return;
      chips -= bet;
      startRound();
    });

    // Action buttons
    document.getElementById('hit-btn').addEventListener('click', hit);
    document.getElementById('stand-btn').addEventListener('click', stand);
    document.getElementById('double-btn').addEventListener('click', doubleDown);
    document.getElementById('split-btn').addEventListener('click', split);

  });
})();
