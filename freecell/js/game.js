/**
 * FreeCell — Vanilla JS, no frameworks.
 * Rules:
 *   - 52 cards dealt face-up into 8 tableau columns (cols 0-3: 7 cards, cols 4-7: 6 cards)
 *   - 4 free cells: each holds exactly 1 card
 *   - 4 foundations: build up by suit A→K
 *   - Tableau: build down by alternating colours
 *   - Supermove: max movable sequence = (1 + emptyFreeCells) * 2^(emptyTableauCols)
 *     When moving TO an empty column, that column doesn't count as empty for the calc.
 */
(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────────

  const SUITS      = ['hearts', 'diamonds', 'clubs', 'spades'];
  const SUIT_SYM   = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  const SUIT_COLOR = { hearts: 'red', diamonds: 'red', clubs: 'black', spades: 'black' };
  const RANKS      = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const RANK_VAL   = {};
  RANKS.forEach((r, i) => { RANK_VAL[r] = i + 1; });

  const NUM_FREECELLS   = 4;
  const NUM_FOUNDATIONS = 4;
  const NUM_TABLEAU     = 8;

  // ─── State ────────────────────────────────────────────────────────────────

  let freeCells   = [null, null, null, null]; // each slot: null or card object
  let foundations = [[], [], [], []];
  let tableau     = [[], [], [], [], [], [], [], []];
  let history     = [];        // undo stack (snapshots)
  let selected    = null;      // { source, cards } — source: { type, index }
  let moves       = 0;
  let timerSecs   = 0;
  let timerActive = false;
  let timerHandle = null;
  let autoRunning = false;
  let dragState   = null;
  let lastClickTime   = 0;
  let lastClickTarget = null;
  let lastDragMoved   = false;

  // ─── Card Factory ─────────────────────────────────────────────────────────

  function makeCard(suit, rank) {
    return { suit, rank, faceUp: true, id: `${rank}-${suit}` };
  }

  function makeDeck() {
    const deck = [];
    for (const suit of SUITS)
      for (const rank of RANKS)
        deck.push(makeCard(suit, rank));
    return deck;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ─── Deal ─────────────────────────────────────────────────────────────────

  function deal() {
    const deck = shuffle(makeDeck());
    freeCells   = [null, null, null, null];
    foundations = [[], [], [], []];
    tableau     = [[], [], [], [], [], [], [], []];
    history     = [];
    moves       = 0;
    timerSecs   = 0;
    timerActive = false;
    autoRunning = false;
    selected    = null;
    dragState   = null;
    stopTimer();

    // Cols 0-3 get 7 cards, cols 4-7 get 6 cards
    // Deal round-robin: card 0 → col 0, card 1 → col 1, ..., card 7 → col 0, etc.
    deck.forEach((card, i) => {
      tableau[i % NUM_TABLEAU].push(card);
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function rankVal(card) { return RANK_VAL[card.rank]; }

  function canStackOnTableau(card, targetCard) {
    if (!targetCard) return true; // any card goes to empty column
    return rankVal(card) === rankVal(targetCard) - 1 &&
           SUIT_COLOR[card.suit] !== SUIT_COLOR[targetCard.suit];
  }

  function canMoveToFoundation(card, foundation) {
    if (!foundation.length) return card.rank === 'A';
    const top = foundation[foundation.length - 1];
    return card.suit === top.suit && rankVal(card) === rankVal(top) + 1;
  }

  function bestFoundationIndex(card) {
    for (let i = 0; i < NUM_FOUNDATIONS; i++) {
      if (canMoveToFoundation(card, foundations[i])) return i;
    }
    return -1;
  }

  function isComplete() {
    return foundations.every(f => f.length === 13);
  }

  /**
   * Count empty free cells and empty tableau columns.
   * When targetColIdx is provided, don't count that column as empty
   * (we're moving into it, so it won't be empty after the move).
   */
  function countEmpties(targetColIdx) {
    const emptyFC = freeCells.filter(c => c === null).length;
    let emptyTC = 0;
    for (let i = 0; i < NUM_TABLEAU; i++) {
      if (i === targetColIdx) continue;
      if (tableau[i].length === 0) emptyTC++;
    }
    return { emptyFC, emptyTC };
  }

  /**
   * Supermove: max cards movable as a sequence.
   * Formula: (1 + emptyFreeCells) * 2^(emptyTableauCols)
   * When moving to an empty tableau col, exclude it from emptyTC count.
   */
  function maxMovable(targetColIdx) {
    const { emptyFC, emptyTC } = countEmpties(
      typeof targetColIdx === 'number' ? targetColIdx : -1
    );
    return (1 + emptyFC) * Math.pow(2, emptyTC);
  }

  /**
   * Check whether a slice of tableau[col] starting at cardIndex forms
   * a valid descending alternating-colour sequence.
   */
  function isValidSequence(col, cardIndex) {
    for (let i = cardIndex; i < col.length - 1; i++) {
      const a = col[i], b = col[i + 1];
      if (rankVal(b) !== rankVal(a) - 1) return false;
      if (SUIT_COLOR[a.suit] === SUIT_COLOR[b.suit]) return false;
    }
    return true;
  }

  // ─── Timer ────────────────────────────────────────────────────────────────

  function startTimer() {
    if (timerActive) return;
    timerActive = true;
    timerHandle = setInterval(() => { timerSecs++; updateTimerEl(); }, 1000);
  }

  function stopTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    timerActive = false;
  }

  function updateTimerEl() {
    const el = document.getElementById('timer-val');
    if (!el) return;
    const m = String(Math.floor(timerSecs / 60)).padStart(2, '0');
    const s = String(timerSecs % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
  }

  function formatTime(secs) {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateStats() {
    const el = document.getElementById('moves-val');
    if (el) el.textContent = moves;
    updateTimerEl();
  }

  // ─── Snapshot / Undo ──────────────────────────────────────────────────────

  function snapshot() {
    return {
      freeCells:   freeCells.map(c => c ? { ...c } : null),
      foundations: foundations.map(f => f.map(c => ({ ...c }))),
      tableau:     tableau.map(col => col.map(c => ({ ...c }))),
      moves,
    };
  }

  function pushHistory() {
    history.push(snapshot());
  }

  function undo() {
    if (!history.length) return;
    const prev = history.pop();
    freeCells   = prev.freeCells;
    foundations = prev.foundations;
    tableau     = prev.tableau;
    moves       = prev.moves;
    selected    = null;
    renderAll();
    updateStats();
  }

  // ─── Move Execution ───────────────────────────────────────────────────────

  /**
   * Execute a validated move.
   * source: { type: 'freecell'|'tableau'|'foundation', index }
   * target: { type: 'freecell'|'tableau'|'foundation', index }
   * cards:  array of card objects being moved (single card except tableau→tableau sequences)
   */
  function executeMove(source, target, cards) {
    pushHistory();

    // Remove from source
    if (source.type === 'freecell') {
      freeCells[source.index] = null;
    } else if (source.type === 'foundation') {
      foundations[source.index].splice(foundations[source.index].length - cards.length);
    } else { // tableau
      tableau[source.index].splice(tableau[source.index].length - cards.length);
    }

    // Add to target
    if (target.type === 'freecell') {
      freeCells[target.index] = cards[0];
    } else if (target.type === 'foundation') {
      foundations[target.index].push(...cards);
    } else { // tableau
      tableau[target.index].push(...cards);
    }

    moves++;
    startTimer();
    selected = null;
    updateStats();
    renderAll();

    if (isComplete()) {
      stopTimer();
      setTimeout(showWin, 400);
      return;
    }

    if (!autoRunning) {
      checkAutoAvailable();
    }
  }

  // ─── Auto-complete ────────────────────────────────────────────────────────

  function canAutoComplete() {
    // All free cells must be empty and all tableau cards must be fully sorted
    // (i.e. each column is already in descending alternating order from bottom to top)
    // Simpler heuristic: all tableau top cards can go to foundation and free cells are all empty
    // Proper check: no card in tableau blocks another card that needs to go first
    if (freeCells.some(c => c !== null)) return false;

    // Check if all remaining cards can be moved to foundations by greedy scan
    // Build a simulation
    const simFound = foundations.map(f => f.slice());
    const simTab   = tableau.map(col => col.slice());
    let progress = true;
    while (progress) {
      progress = false;
      for (let i = 0; i < NUM_TABLEAU; i++) {
        const col = simTab[i];
        if (!col.length) continue;
        const card = col[col.length - 1];
        for (let fi = 0; fi < NUM_FOUNDATIONS; fi++) {
          if (canMoveToFoundation(card, simFound[fi])) {
            simFound[fi].push(col.pop());
            progress = true;
            break;
          }
        }
      }
    }
    return simFound.every(f => f.length === 13);
  }

  function checkAutoAvailable() {
    const btn = document.getElementById('auto-btn');
    if (!btn) return;
    if (canAutoComplete()) {
      btn.classList.add('available');
    } else {
      btn.classList.remove('available');
    }
  }

  function tryAutoComplete() {
    if (!canAutoComplete()) return;
    autoRunning = true;
    const btn = document.getElementById('auto-btn');
    if (btn) btn.classList.remove('available');
    scheduleAutoStep();
  }

  function scheduleAutoStep() {
    setTimeout(autoStep, 80);
  }

  function autoStep() {
    if (isComplete()) {
      stopTimer();
      setTimeout(showWin, 600);
      return;
    }

    // Move free cells to foundation first
    for (let i = 0; i < NUM_FREECELLS; i++) {
      const card = freeCells[i];
      if (!card) continue;
      const fi = bestFoundationIndex(card);
      if (fi >= 0) {
        const srcEl = document.getElementById(`free-${i}`);
        const dstEl = document.getElementById(`foundation-${fi}`);
        animateFly(getTopCardEl2(srcEl), dstEl, () => {
          freeCells[i] = null;
          foundations[fi].push(card);
          moves++;
          updateStats();
          renderAll();
          scheduleAutoStep();
        });
        return;
      }
    }

    // Move tableau top cards to foundation
    for (let i = 0; i < NUM_TABLEAU; i++) {
      const col = tableau[i];
      if (!col.length) continue;
      const card = col[col.length - 1];
      const fi = bestFoundationIndex(card);
      if (fi >= 0) {
        const srcEl = document.getElementById(`tableau-${i}`);
        const dstEl = document.getElementById(`foundation-${fi}`);
        animateFly(getTopCardEl2(srcEl), dstEl, () => {
          col.pop();
          foundations[fi].push(card);
          moves++;
          updateStats();
          renderAll();
          scheduleAutoStep();
        });
        return;
      }
    }

    autoRunning = false;
  }

  function getTopCardEl2(containerEl) {
    if (!containerEl) return null;
    const cards = containerEl.querySelectorAll('.card');
    return cards.length ? cards[cards.length - 1] : null;
  }

  function animateFly(srcEl, dstEl, cb) {
    if (!srcEl || !dstEl) { cb(); return; }

    const sr = srcEl.getBoundingClientRect();
    const dr = dstEl.getBoundingClientRect();

    const clone = srcEl.cloneNode(true);
    clone.style.cssText = [
      'position:fixed',
      `left:${sr.left}px`,
      `top:${sr.top}px`,
      `width:${sr.width}px`,
      `height:${sr.height}px`,
      'margin:0',
      'z-index:9999',
      'pointer-events:none',
      'transition:left 0.25s ease-in-out,top 0.25s ease-in-out,transform 0.25s ease-in-out',
      'will-change:left,top',
    ].join(';');
    document.body.appendChild(clone);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      clone.style.left      = `${dr.left}px`;
      clone.style.top       = `${dr.top}px`;
      clone.style.transform = 'scale(0.88)';
    }));

    clone.addEventListener('transitionend', () => { clone.remove(); cb(); }, { once: true });
    setTimeout(() => { if (clone.parentNode) { clone.remove(); cb(); } }, 600);
  }

  // ─── Hint ─────────────────────────────────────────────────────────────────

  function findHint() {
    // 1. Tableau/freecell top card → foundation
    for (let i = 0; i < NUM_TABLEAU; i++) {
      const col = tableau[i];
      if (!col.length) continue;
      const card = col[col.length - 1];
      const fi = bestFoundationIndex(card);
      if (fi >= 0) return { srcId: `tableau-${i}`, dstId: `foundation-${fi}` };
    }
    for (let i = 0; i < NUM_FREECELLS; i++) {
      const card = freeCells[i];
      if (!card) continue;
      const fi = bestFoundationIndex(card);
      if (fi >= 0) return { srcId: `free-${i}`, dstId: `foundation-${fi}` };
    }

    // 2. Free cell card → tableau
    for (let i = 0; i < NUM_FREECELLS; i++) {
      const card = freeCells[i];
      if (!card) continue;
      for (let j = 0; j < NUM_TABLEAU; j++) {
        const col = tableau[j];
        const top = col.length ? col[col.length - 1] : null;
        if (canStackOnTableau(card, top) && !(card.rank !== 'K' && !top)) {
          // Avoid pointless free-cell to empty col move for non-Kings
          if (!top && card.rank !== 'K') continue;
          return { srcId: `free-${i}`, dstId: `tableau-${j}` };
        }
      }
    }

    // 3. Tableau sequence → tableau (prefer moves that free buried cards or fill empty cols usefully)
    for (let i = 0; i < NUM_TABLEAU; i++) {
      const col = tableau[i];
      if (!col.length) continue;
      // Find the longest valid sequence from the bottom
      let seqStart = col.length - 1;
      while (seqStart > 0) {
        const a = col[seqStart - 1], b = col[seqStart];
        if (rankVal(b) === rankVal(a) - 1 && SUIT_COLOR[a.suit] !== SUIT_COLOR[b.suit]) {
          seqStart--;
        } else {
          break;
        }
      }
      for (let k = seqStart; k < col.length; k++) {
        const card = col[k];
        const seqLen = col.length - k;
        for (let j = 0; j < NUM_TABLEAU; j++) {
          if (i === j) continue;
          const tcol = tableau[j];
          const top = tcol.length ? tcol[tcol.length - 1] : null;
          if (!canStackOnTableau(card, top)) continue;
          const maxMov = maxMovable(tcol.length === 0 ? j : -1);
          if (seqLen > maxMov) continue;
          // Skip pointless king-to-empty moves
          if (card.rank === 'K' && !top && seqStart === 0) continue;
          return { srcId: `tableau-${i}`, dstId: `tableau-${j}` };
        }
      }
    }

    // 4. Tableau top card → free cell
    for (let i = 0; i < NUM_TABLEAU; i++) {
      const col = tableau[i];
      if (!col.length) continue;
      const fi = freeCells.findIndex(c => c === null);
      if (fi >= 0) return { srcId: `tableau-${i}`, dstId: `free-${fi}` };
    }

    return null;
  }

  function showHint() {
    clearHighlights();
    const hint = findHint();
    if (!hint) return;
    const srcEl = document.getElementById(hint.srcId);
    const dstEl = document.getElementById(hint.dstId);
    const srcCard = srcEl ? getTopCardEl2(srcEl) || srcEl : null;
    if (srcCard) srcCard.classList.add('hint-source');
    if (dstEl) dstEl.classList.add('hint-target');
    setTimeout(clearHighlights, 1600);
  }

  function clearHighlights() {
    document.querySelectorAll('.hint-source,.hint-target').forEach(el => {
      el.classList.remove('hint-source', 'hint-target');
    });
  }

  function getTopCardEl(pileId) {
    const pile = document.getElementById(pileId);
    if (!pile) return null;
    const cards = pile.querySelectorAll('.card');
    return cards.length ? cards[cards.length - 1] : null;
  }

  // ─── Rendering ────────────────────────────────────────────────────────────

  function buildCardEl(card) {
    const el  = document.createElement('div');
    const sym = SUIT_SYM[card.suit];
    const color = SUIT_COLOR[card.suit];
    const isFace = ['J', 'Q', 'K'].includes(card.rank);
    el.className = `card ${card.faceUp ? 'face-up' : 'face-down'} suit-${color}`;
    if (isFace) el.classList.add('face-card');
    if (card.rank === 'A') el.classList.add('rank-A');
    el.dataset.suit  = card.suit;
    el.dataset.rank  = card.rank;
    el.dataset.color = color;
    el.dataset.id    = card.id;
    el.innerHTML = `
      <div class="card-inner">
        <div class="card-face">
          <span class="card-corner-tl"><span class="card-rank">${card.rank}</span><span class="card-suit-corner">${sym}</span></span>
          <span class="card-suit-center">${sym}</span>
          <span class="card-corner-br"><span class="card-rank">${card.rank}</span><span class="card-suit-corner">${sym}</span></span>
        </div>
      </div>
    `;
    return el;
  }

  function renderFreeCells() {
    for (let i = 0; i < NUM_FREECELLS; i++) {
      const el = document.getElementById(`free-${i}`);
      if (!el) continue;
      el.innerHTML = '';
      const card = freeCells[i];
      if (card) {
        el.appendChild(buildCardEl(card));
      } else {
        el.innerHTML = '<div class="empty-placeholder"></div>';
      }
    }
  }

  function renderFoundations() {
    for (let i = 0; i < NUM_FOUNDATIONS; i++) {
      const el = document.getElementById(`foundation-${i}`);
      if (!el) continue;
      el.innerHTML = '';
      const f = foundations[i];
      if (f.length) {
        el.appendChild(buildCardEl(f[f.length - 1]));
      } else {
        el.innerHTML = '<div class="empty-placeholder"></div>';
      }
    }
  }

  function renderTableau() {
    const FACE_UP_OFFSET = 26; // All cards are face-up in FreeCell

    for (let i = 0; i < NUM_TABLEAU; i++) {
      const el = document.getElementById(`tableau-${i}`);
      if (!el) continue;
      el.innerHTML = '';
      const col = tableau[i];

      if (!col.length) {
        el.classList.add('empty-col');
        el.style.minHeight = '';
        continue;
      }

      el.classList.remove('empty-col');
      let offset = 0;
      col.forEach((card, idx) => {
        const cardEl = buildCardEl(card);
        cardEl.style.top    = `${offset}px`;
        cardEl.style.zIndex = idx + 1;
        el.appendChild(cardEl);
        offset += FACE_UP_OFFSET;
      });
      el.style.minHeight = `${offset + 78}px`;
    }
  }

  function renderAll() {
    renderFreeCells();
    renderFoundations();
    renderTableau();

    // Re-apply selection highlights
    if (selected) {
      selected.cards.forEach(card => {
        const el = document.querySelector(`[data-id="${card.id}"]`);
        if (el) el.classList.add('selected');
      });
    }
  }

  // ─── Location Resolution ──────────────────────────────────────────────────

  /**
   * Given a .card element, determine where it lives.
   * Returns { type: 'freecell'|'tableau'|'foundation', index, cardIndex? } or null.
   */
  function locateCard(cardEl) {
    const id = cardEl.dataset.id;
    if (!id) return null;

    // Free cells
    for (let i = 0; i < NUM_FREECELLS; i++) {
      if (freeCells[i] && freeCells[i].id === id)
        return { type: 'freecell', index: i };
    }

    // Foundations
    for (let i = 0; i < NUM_FOUNDATIONS; i++) {
      const f = foundations[i];
      if (f.length && f[f.length - 1].id === id)
        return { type: 'foundation', index: i };
    }

    // Tableau
    for (let i = 0; i < NUM_TABLEAU; i++) {
      const col = tableau[i];
      const ci = col.findIndex(c => c.id === id);
      if (ci >= 0) return { type: 'tableau', index: i, cardIndex: ci };
    }

    return null;
  }

  /**
   * Given any element, determine which pile it belongs to.
   * Returns { type, index } or null.
   */
  function locatePile(el) {
    if (!el) return null;
    const id = el.id;
    const fm = id && id.match(/^free-(\d)$/);
    if (fm) return { type: 'freecell', index: parseInt(fm[1], 10) };
    const fnm = id && id.match(/^foundation-(\d)$/);
    if (fnm) return { type: 'foundation', index: parseInt(fnm[1], 10) };
    const tm = id && id.match(/^tableau-(\d)$/);
    if (tm) return { type: 'tableau', index: parseInt(tm[1], 10) };
    return null;
  }

  // ─── Selection & Move Logic ───────────────────────────────────────────────

  function selectCards(cards, source) {
    clearSelection();
    selected = { cards, source };
    cards.forEach(c => {
      const el = document.querySelector(`[data-id="${c.id}"]`);
      if (el) el.classList.add('selected');
    });
  }

  function clearSelection() {
    if (!selected) return;
    selected.cards.forEach(c => {
      const el = document.querySelector(`[data-id="${c.id}"]`);
      if (el) el.classList.remove('selected');
    });
    selected = null;
  }

  function tryMoveSelectedTo(target) {
    if (!selected) return false;
    const { cards, source } = selected;

    if (target.type === 'foundation') {
      if (cards.length === 1 && canMoveToFoundation(cards[0], foundations[target.index])) {
        executeMove(source, target, cards);
        return true;
      }
    } else if (target.type === 'freecell') {
      // Only single cards can go to free cell
      if (cards.length === 1 && freeCells[target.index] === null) {
        executeMove(source, target, cards);
        return true;
      }
    } else if (target.type === 'tableau') {
      // Same column: deselect
      if (source.type === 'tableau' && source.index === target.index) {
        clearSelection();
        return false;
      }
      const col = tableau[target.index];
      const top = col.length ? col[col.length - 1] : null;
      if (!canStackOnTableau(cards[0], top)) {
        clearSelection();
        return false;
      }
      // Supermove check
      const isEmptyTarget = col.length === 0;
      const maxMov = maxMovable(isEmptyTarget ? target.index : -1);
      if (cards.length > maxMov) {
        clearSelection();
        return false;
      }
      executeMove(source, target, cards);
      return true;
    }

    clearSelection();
    return false;
  }

  function onCardTap(cardEl) {
    const loc = locateCard(cardEl);
    if (!loc) return;

    // If something is selected, try to move it to this card's pile
    if (selected) {
      let target = null;
      if (loc.type === 'freecell') {
        target = { type: 'freecell', index: loc.index };
      } else if (loc.type === 'foundation') {
        target = { type: 'foundation', index: loc.index };
      } else if (loc.type === 'tableau') {
        target = { type: 'tableau', index: loc.index };
      }
      if (target && tryMoveSelectedTo(target)) return;
      // Move failed — fall through to new selection
    }

    // Select this card
    if (loc.type === 'freecell') {
      const card = freeCells[loc.index];
      if (card) selectCards([card], { type: 'freecell', index: loc.index });
    } else if (loc.type === 'foundation') {
      const f = foundations[loc.index];
      if (f.length) selectCards([f[f.length - 1]], { type: 'foundation', index: loc.index });
    } else if (loc.type === 'tableau') {
      const col = tableau[loc.index];
      const ci = loc.cardIndex;
      if (ci < 0) return;
      // Build the sequence from ci to end
      const seqLen = col.length - ci;
      // Verify it's a valid sequence
      if (!isValidSequence(col, ci)) {
        // Can only select from the valid sequence bottom; find lowest valid start
        // Actually: try selecting just the tapped card if it's the bottom card
        if (ci !== col.length - 1) {
          clearSelection();
          return;
        }
        selectCards([col[ci]], { type: 'tableau', index: loc.index });
        return;
      }
      // Check if supermove would allow this many cards at all (loose check — actual target unknown)
      const { emptyFC, emptyTC } = countEmpties(-1);
      const maxMov = (1 + emptyFC) * Math.pow(2, emptyTC);
      if (seqLen > maxMov) {
        // Select only what can potentially be moved (bottom card)
        selectCards([col[col.length - 1]], { type: 'tableau', index: loc.index });
        return;
      }
      selectCards(col.slice(ci), { type: 'tableau', index: loc.index });
    }
  }

  function onPileTap(pileEl) {
    const loc = locatePile(pileEl);
    if (!loc) { clearSelection(); return; }

    if (selected) {
      if (tryMoveSelectedTo(loc)) return;
    }
    clearSelection();
  }

  function onDoubleTap(cardEl) {
    const loc = locateCard(cardEl);
    if (!loc) return;

    let card   = null;
    let source = null;

    if (loc.type === 'freecell') {
      card   = freeCells[loc.index];
      source = { type: 'freecell', index: loc.index };
    } else if (loc.type === 'tableau') {
      const col = tableau[loc.index];
      if (loc.cardIndex !== col.length - 1) return; // only bottom card
      card   = col[col.length - 1];
      source = { type: 'tableau', index: loc.index };
    } else {
      return;
    }

    if (!card) return;
    const fi = bestFoundationIndex(card);
    if (fi >= 0) {
      clearSelection();
      executeMove(source, { type: 'foundation', index: fi }, [card]);
    }
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  const FACE_UP_OFFSET = 26;

  function initPointerDrag(root) {
    root.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }

  function onPointerDown(e) {
    if (e.pointerType === 'touch') return;

    const cardEl = e.target.closest('.card');
    if (!cardEl) return;

    const now = Date.now();
    if (now - lastClickTime < 280 && lastClickTarget === cardEl) {
      lastClickTime   = 0;
      lastClickTarget = null;
      onDoubleTap(cardEl);
      return;
    }
    lastClickTime   = now;
    lastClickTarget = cardEl;

    const loc = locateCard(cardEl);
    if (!loc) return;

    let cards  = [];
    let source = null;

    if (loc.type === 'freecell') {
      const card = freeCells[loc.index];
      if (!card) return;
      cards  = [card];
      source = { type: 'freecell', index: loc.index };
    } else if (loc.type === 'foundation') {
      const f = foundations[loc.index];
      if (!f.length) return;
      cards  = [f[f.length - 1]];
      source = { type: 'foundation', index: loc.index };
    } else if (loc.type === 'tableau') {
      const col = tableau[loc.index];
      const ci  = loc.cardIndex;
      if (!isValidSequence(col, ci)) {
        // Only allow single bottom card
        if (ci !== col.length - 1) return;
        cards = [col[ci]];
      } else {
        cards = col.slice(ci);
      }
      source = { type: 'tableau', index: loc.index };
    }

    if (!cards.length) return;

    const rect  = cardEl.getBoundingClientRect();
    const ghost = buildGhost(cards, rect.width, rect.height);
    document.body.appendChild(ghost);

    dragState = {
      cards,
      source,
      ghost,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
    };
    positionGhost(e.clientX, e.clientY);

    cards.forEach(c => {
      const el = document.querySelector(`[data-id="${c.id}"]`);
      if (el) el.classList.add('dragging');
    });

    e.preventDefault();
    cardEl.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragState) return;
    dragState.moved = true;
    positionGhost(e.clientX, e.clientY);
    highlightDropTarget(e.clientX, e.clientY);
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!dragState) return;
    const { cards, source, ghost, moved } = dragState;
    dragState = null;
    lastDragMoved = moved;
    setTimeout(() => { lastDragMoved = false; }, 100);

    ghost.remove();
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    cards.forEach(c => {
      const el = document.querySelector(`[data-id="${c.id}"]`);
      if (el) el.classList.remove('dragging');
    });

    if (moved) {
      const target = dropTargetAt(e.clientX, e.clientY);
      if (target) {
        clearSelection();
        if (target.type === 'foundation') {
          if (cards.length === 1 && canMoveToFoundation(cards[0], foundations[target.index])) {
            executeMove(source, target, cards);
          }
        } else if (target.type === 'freecell') {
          if (cards.length === 1 && freeCells[target.index] === null) {
            executeMove(source, target, cards);
          }
        } else if (target.type === 'tableau') {
          if (source.type === 'tableau' && source.index === target.index) return;
          const col = tableau[target.index];
          const top = col.length ? col[col.length - 1] : null;
          if (canStackOnTableau(cards[0], top)) {
            const isEmptyTarget = col.length === 0;
            const maxMov = maxMovable(isEmptyTarget ? target.index : -1);
            if (cards.length <= maxMov) {
              executeMove(source, target, cards);
            }
          }
        }
      }
    }
  }

  function buildGhost(cards, w, h) {
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.cssText = `position:fixed;z-index:10000;pointer-events:none;width:${w}px;`;
    cards.forEach((card, i) => {
      const el = buildCardEl(card);
      el.style.position = 'absolute';
      el.style.top = `${i * FACE_UP_OFFSET}px`;
      ghost.appendChild(el);
    });
    ghost.style.height = `${h + (cards.length - 1) * FACE_UP_OFFSET}px`;
    return ghost;
  }

  function positionGhost(x, y) {
    if (!dragState) return;
    dragState.ghost.style.left = `${x - dragState.offsetX}px`;
    dragState.ghost.style.top  = `${y - dragState.offsetY}px`;
  }

  function dropTargetAt(x, y) {
    const pileIds = [];
    for (let i = 0; i < NUM_FREECELLS;   i++) pileIds.push(`free-${i}`);
    for (let i = 0; i < NUM_FOUNDATIONS;  i++) pileIds.push(`foundation-${i}`);
    for (let i = 0; i < NUM_TABLEAU;      i++) pileIds.push(`tableau-${i}`);

    for (const id of pileIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return locatePile(el);
      }
    }
    return null;
  }

  function highlightDropTarget(x, y) {
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    const t = dropTargetAt(x, y);
    if (!t) return;
    let id = null;
    if (t.type === 'freecell')   id = `free-${t.index}`;
    if (t.type === 'foundation') id = `foundation-${t.index}`;
    if (t.type === 'tableau')    id = `tableau-${t.index}`;
    if (id) document.getElementById(id)?.classList.add('drag-over');
  }

  // ─── Touch Tap ────────────────────────────────────────────────────────────

  function initTouchTap(root) {
    let tx0, ty0, tt0;
    let lastTap = { time: 0, el: null };

    root.addEventListener('touchstart', e => {
      const t = e.touches[0];
      tx0 = t.clientX; ty0 = t.clientY; tt0 = Date.now();
    }, { passive: true });

    root.addEventListener('touchend', e => {
      const t = e.changedTouches[0];
      const dx = t.clientX - tx0;
      const dy = t.clientY - ty0;
      const dt = Date.now() - tt0;
      if (Math.abs(dx) > 12 || Math.abs(dy) > 12 || dt > 500) return;

      const el = document.elementFromPoint(t.clientX, t.clientY);
      if (!el) return;

      const cardEl = el.closest('.card');
      const pileEl = el.closest('[id^="free-"], [id^="foundation-"], [id^="tableau-"]');

      const now = Date.now();
      if (cardEl && now - lastTap.time < 360 && lastTap.el === cardEl) {
        lastTap = { time: 0, el: null };
        onDoubleTap(cardEl);
        e.preventDefault();
        return;
      }
      lastTap = { time: now, el: cardEl };

      if (cardEl) {
        onCardTap(cardEl);
        e.preventDefault();
      } else if (pileEl) {
        onPileTap(pileEl);
        e.preventDefault();
      }
    }, { passive: false });
  }

  // ─── Screens & UI ─────────────────────────────────────────────────────────

  function showScreen(id) {
    ['start-screen', 'game-screen', 'win-screen'].forEach(sid => {
      const el = document.getElementById(sid);
      if (el) el.classList.toggle('active', sid === id);
    });
  }

  function showWin() {
    const movesEl = document.getElementById('win-moves');
    const timeEl  = document.getElementById('win-time');
    if (movesEl) movesEl.textContent = moves;
    if (timeEl)  timeEl.textContent  = formatTime(timerSecs);

    showScreen('win-screen');

    if (typeof Leaderboard !== 'undefined') {
      Leaderboard.ready('freecell', moves, { ascending: true, label: '이동' });
    }
  }

  function startGame() {
    stopTimer();
    clearSelection();
    autoRunning = false;

    if (typeof Leaderboard !== 'undefined') Leaderboard.hide();

    deal();
    renderAll();
    updateStats();
    checkAutoAvailable();
    showScreen('game-screen');
  }

  // ─── Event Wiring ─────────────────────────────────────────────────────────

  function initEvents() {
    const gameScreen = document.getElementById('game-screen');
    if (!gameScreen) return;

    initTouchTap(gameScreen);
    initPointerDrag(gameScreen);

    gameScreen.addEventListener('click', e => {
      if (dragState || lastDragMoved) return;
      const cardEl = e.target.closest('.card');
      const pileEl = e.target.closest('[id^="free-"], [id^="foundation-"], [id^="tableau-"]');
      if (cardEl) {
        onCardTap(cardEl);
      } else if (pileEl) {
        onPileTap(pileEl);
      } else {
        clearSelection();
      }
    });

    bindBtn('undo-btn',         undo);
    bindBtn('hint-btn',         showHint);
    bindBtn('auto-btn',         () => { if (!autoRunning) tryAutoComplete(); });
    bindBtn('restart-btn',      startGame);
    bindBtn('restart-icon-btn', startGame);
    bindBtn('win-again-btn',    startGame);

    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
      startScreen.addEventListener('click', startGame);
      startScreen.addEventListener('touchend', e => { e.preventDefault(); startGame(); });
    }
  }

  function bindBtn(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────

  function boot() {
    initEvents();
    showScreen('start-screen');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  if (window.Leaderboard) {
    window.Leaderboard.init?.('freecell');
  }

})();
