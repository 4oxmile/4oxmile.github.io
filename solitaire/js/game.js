/**
 * Klondike Solitaire — Vanilla JS, no frameworks.
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

  // ─── State ────────────────────────────────────────────────────────────────

  let stock       = [];
  let waste       = [];
  let foundations = [[], [], [], []];
  let tableau     = [[], [], [], [], [], [], []];
  let history     = [];        // undo stack (snapshots)
  let selected    = null;      // { source, cards }
  let moves       = 0;
  let timerSecs   = 0;
  let timerActive = false;
  let timerHandle = null;
  let autoRunning = false;
  let dragState   = null;

  // ─── Card Factory ─────────────────────────────────────────────────────────

  function makeCard(suit, rank, faceUp = false) {
    return { suit, rank, faceUp, id: `${rank}-${suit}` };
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
    tableau     = [[], [], [], [], [], [], []];
    foundations = [[], [], [], []];
    stock       = [];
    waste       = [];
    history     = [];
    moves       = 0;
    timerSecs   = 0;
    timerActive = false;
    autoRunning = false;
    selected    = null;
    dragState   = null;
    stopTimer();

    let idx = 0;
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck[idx++];
        card.faceUp = (row === col);
        tableau[col].push(card);
      }
    }
    while (idx < deck.length) stock.push(deck[idx++]);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function rankVal(card) { return RANK_VAL[card.rank]; }

  function canStackOnTableau(card, targetCard) {
    if (!targetCard) return card.rank === 'K';
    return rankVal(card) === rankVal(targetCard) - 1 &&
           SUIT_COLOR[card.suit] !== SUIT_COLOR[targetCard.suit];
  }

  function canMoveToFoundation(card, foundation) {
    if (!foundation.length) return card.rank === 'A';
    const top = foundation[foundation.length - 1];
    return card.suit === top.suit && rankVal(card) === rankVal(top) + 1;
  }

  function bestFoundationIndex(card) {
    for (let i = 0; i < 4; i++) {
      if (canMoveToFoundation(card, foundations[i])) return i;
    }
    return -1;
  }

  function isComplete() {
    return foundations.every(f => f.length === 13);
  }

  function allFaceUp() {
    return stock.length === 0 &&
           waste.length === 0 &&
           tableau.every(col => col.every(c => c.faceUp));
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
      stock:       stock.map(c => ({ ...c })),
      waste:       waste.map(c => ({ ...c })),
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
    stock       = prev.stock;
    waste       = prev.waste;
    foundations = prev.foundations;
    tableau     = prev.tableau;
    moves       = prev.moves;
    selected    = null;
    renderAll();
    updateStats();
  }

  // ─── Move Execution ───────────────────────────────────────────────────────

  /**
   * Execute a validated move. source and target are location descriptors:
   *   { type: 'waste'|'stock'|'tableau'|'foundation', index?: number }
   * cards is an array of card objects being moved.
   */
  function executeMove(source, target, cards) {
    pushHistory();

    // Remove from source
    if (source.type === 'waste') {
      waste.splice(waste.length - 1, 1);
    } else if (source.type === 'foundation') {
      foundations[source.index].splice(foundations[source.index].length - cards.length);
    } else { // tableau
      tableau[source.index].splice(tableau[source.index].length - cards.length);
    }

    // Add to target
    if (target.type === 'foundation') {
      foundations[target.index].push(...cards);
    } else { // tableau
      tableau[target.index].push(...cards);
    }

    // Mark all moved cards face-up
    cards.forEach(c => { c.faceUp = true; });

    // Auto-flip exposed card in source tableau column
    if (source.type === 'tableau') {
      const col = tableau[source.index];
      if (col.length && !col[col.length - 1].faceUp) {
        col[col.length - 1].faceUp = true;
      }
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

    if (!autoRunning && allFaceUp()) {
      setTimeout(tryAutoComplete, 600);
    }
  }

  function drawFromStock() {
    if (autoRunning) return;
    pushHistory();
    if (!stock.length) {
      // Recycle waste → stock
      stock = waste.slice().reverse();
      waste = [];
      stock.forEach(c => { c.faceUp = false; });
    } else {
      const card = stock.pop();
      card.faceUp = true;
      waste.push(card);
    }
    moves++;
    startTimer();
    selected = null;
    updateStats();
    renderAll();
  }

  // ─── Auto-complete ────────────────────────────────────────────────────────

  function tryAutoComplete() {
    if (!allFaceUp()) return;
    autoRunning = true;
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

    // Collect candidates (waste first, then tableau left to right)
    let candidate = null;

    if (waste.length) {
      const card = waste[waste.length - 1];
      const fi = bestFoundationIndex(card);
      if (fi >= 0) candidate = { fromWaste: true, card, fi };
    }

    if (!candidate) {
      for (let i = 0; i < 7; i++) {
        const col = tableau[i];
        if (!col.length) continue;
        const card = col[col.length - 1];
        const fi = bestFoundationIndex(card);
        if (fi >= 0) { candidate = { colIdx: i, card, fi }; break; }
      }
    }

    if (!candidate) { autoRunning = false; return; }

    // Animate, then update state
    const { card, fi } = candidate;
    const srcElId = candidate.fromWaste ? 'waste-pile' : `tableau-${candidate.colIdx}`;
    const srcEl   = getTopCardEl(srcElId);
    const dstEl   = document.getElementById(`foundation-${fi}`);

    animateFly(srcEl, dstEl, () => {
      if (candidate.fromWaste) waste.pop();
      else tableau[candidate.colIdx].pop();
      foundations[fi].push(card);
      card.faceUp = true;
      moves++;
      updateStats();
      renderAll();
      scheduleAutoStep();
    });
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
    // Safety fallback in case transition doesn't fire
    setTimeout(() => { if (clone.parentNode) { clone.remove(); cb(); } }, 600);
  }

  // ─── Hint ─────────────────────────────────────────────────────────────────

  function findHint() {
    // 1. Any card to foundation
    for (let i = 0; i < 7; i++) {
      const col = tableau[i];
      if (!col.length) continue;
      const card = col[col.length - 1];
      const fi = bestFoundationIndex(card);
      if (fi >= 0) return { srcId: `tableau-${i}`, dstId: `foundation-${fi}` };
    }
    if (waste.length) {
      const card = waste[waste.length - 1];
      const fi = bestFoundationIndex(card);
      if (fi >= 0) return { srcId: 'waste-pile', dstId: `foundation-${fi}` };
    }

    // 2. Waste to tableau
    if (waste.length) {
      const card = waste[waste.length - 1];
      for (let j = 0; j < 7; j++) {
        const col = tableau[j];
        const top = col.length ? col[col.length - 1] : null;
        if (canStackOnTableau(card, top))
          return { srcId: 'waste-pile', dstId: `tableau-${j}` };
      }
    }

    // 3. Tableau to tableau (sequences)
    for (let i = 0; i < 7; i++) {
      const col = tableau[i];
      const faceUpStart = col.findIndex(c => c.faceUp);
      if (faceUpStart < 0) continue;
      for (let k = faceUpStart; k < col.length; k++) {
        const card = col[k];
        for (let j = 0; j < 7; j++) {
          if (i === j) continue;
          const tcol = tableau[j];
          const top = tcol.length ? tcol[tcol.length - 1] : null;
          if (canStackOnTableau(card, top)) {
            // Skip moving a King to an empty column unless it frees a face-down card
            if (card.rank === 'K' && !top && faceUpStart === 0) continue;
            return { srcId: `tableau-${i}`, dstId: `tableau-${j}` };
          }
        }
      }
    }

    // 4. Foundation back to tableau (rarely optimal but valid)
    for (let fi = 0; fi < 4; fi++) {
      const f = foundations[fi];
      if (!f.length) continue;
      const card = f[f.length - 1];
      for (let j = 0; j < 7; j++) {
        const top = tableau[j].length ? tableau[j][tableau[j].length - 1] : null;
        if (canStackOnTableau(card, top))
          return { srcId: `foundation-${fi}`, dstId: `tableau-${j}` };
      }
    }

    return null;
  }

  function showHint() {
    clearHighlights();
    const hint = findHint();
    if (!hint) return;
    const srcEl = getTopCardEl(hint.srcId) || document.getElementById(hint.srcId);
    const dstEl = document.getElementById(hint.dstId);
    if (srcEl) srcEl.classList.add('hint-source');
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

  const FACE_DOWN_OFFSET = 18;
  const FACE_UP_OFFSET   = 28;

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

  function renderStock() {
    const el = document.getElementById('stock-pile');
    if (!el) return;
    el.innerHTML = '';
    if (stock.length) {
      const div = document.createElement('div');
      div.className = 'card face-down';
      div.innerHTML = '<div class="card-inner"></div>';
      el.appendChild(div);
      el.classList.remove('empty');
    } else {
      el.classList.add('empty');
      el.innerHTML = '<div class="empty-placeholder"></div>';
    }
  }

  function renderWaste() {
    const el = document.getElementById('waste-pile');
    if (!el) return;
    el.innerHTML = '';
    if (waste.length) el.appendChild(buildCardEl(waste[waste.length - 1]));
  }

  function renderFoundations() {
    for (let i = 0; i < 4; i++) {
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
    for (let i = 0; i < 7; i++) {
      const el = document.getElementById(`tableau-${i}`);
      if (!el) continue;
      el.innerHTML = '';
      const col = tableau[i];
      let offset = 0;
      col.forEach((card, idx) => {
        const cardEl = buildCardEl(card);
        cardEl.style.top = `${offset}px`;
        cardEl.style.zIndex = idx + 1;
        el.appendChild(cardEl);
        offset += card.faceUp ? FACE_UP_OFFSET : FACE_DOWN_OFFSET;
      });
      // Ensure the pile is tall enough to show all cards
      el.style.minHeight = col.length ? `${offset + 100}px` : '120px';
    }
  }

  function renderAll() {
    renderStock();
    renderWaste();
    renderFoundations();
    renderTableau();
    // Re-apply selection highlight
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
   * Returns { type, index?, cardIndex? } or null.
   */
  function locateCard(cardEl) {
    const id = cardEl.dataset.id;
    if (!id) return null;

    // Waste
    if (waste.length && waste[waste.length - 1].id === id)
      return { type: 'waste' };

    // Foundation
    for (let i = 0; i < 4; i++) {
      const f = foundations[i];
      if (f.length && f[f.length - 1].id === id)
        return { type: 'foundation', index: i };
    }

    // Tableau
    for (let i = 0; i < 7; i++) {
      const col = tableau[i];
      const ci = col.findIndex(c => c.id === id);
      if (ci >= 0) return { type: 'tableau', index: i, cardIndex: ci };
    }

    return null;
  }

  /**
   * Given any element, determine which pile it belongs to.
   * Returns { type, index? } or null.
   */
  function locatePile(el) {
    if (!el) return null;
    const id = el.id;
    if (id === 'stock-pile') return { type: 'stock' };
    if (id === 'waste-pile') return { type: 'waste' };
    const fm = id && id.match(/^foundation-(\d)$/);
    if (fm) return { type: 'foundation', index: parseInt(fm[1], 10) };
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
    } else if (target.type === 'tableau') {
      if (source.type === 'tableau' && source.index === target.index) {
        clearSelection();
        return false;
      }
      const col = tableau[target.index];
      const top = col.length ? col[col.length - 1] : null;
      if (canStackOnTableau(cards[0], top)) {
        executeMove(source, target, cards);
        return true;
      }
    }

    clearSelection();
    return false;
  }

  function onCardTap(cardEl) {
    // Check if this card is inside the stock pile (face-down card has no data-id)
    if (cardEl.closest('#stock-pile')) {
      clearSelection();
      drawFromStock();
      return;
    }

    const loc = locateCard(cardEl);
    if (!loc) return;

    // Stock location fallback
    if (loc.type === 'stock') {
      clearSelection();
      drawFromStock();
      return;
    }

    // Face-down tableau card → ignore (auto-flip happens in executeMove)
    if (loc.type === 'tableau') {
      const card = tableau[loc.index][loc.cardIndex];
      if (!card || !card.faceUp) { clearSelection(); return; }
    }

    // If something is already selected, try to move it here
    if (selected) {
      // Determine the pile this card belongs to (as target)
      if (loc.type === 'foundation') {
        if (tryMoveSelectedTo({ type: 'foundation', index: loc.index })) return;
      } else if (loc.type === 'tableau') {
        if (tryMoveSelectedTo({ type: 'tableau', index: loc.index })) return;
      } else if (loc.type === 'waste') {
        // Tapping waste when something is selected — deselect and re-select waste
        clearSelection();
      }
      // If move failed, fall through to new selection below
    }

    // Nothing selected or move failed — select this card
    if (loc.type === 'waste') {
      const card = waste[waste.length - 1];
      if (card && card.faceUp) selectCards([card], { type: 'waste' });
    } else if (loc.type === 'foundation') {
      const f = foundations[loc.index];
      if (f.length) selectCards([f[f.length - 1]], { type: 'foundation', index: loc.index });
    } else if (loc.type === 'tableau') {
      const col = tableau[loc.index];
      // Select from this card to the top of the column
      const cards = col.slice(loc.cardIndex);
      if (cards.length && cards[0].faceUp) {
        selectCards(cards, { type: 'tableau', index: loc.index });
      }
    }
  }

  function onPileTap(pileEl) {
    const loc = locatePile(pileEl);
    if (!loc) { clearSelection(); return; }

    if (loc.type === 'stock') {
      clearSelection();
      drawFromStock();
      return;
    }

    if (selected) {
      if (tryMoveSelectedTo(loc)) return;
    }
    clearSelection();
  }

  function onDoubleTap(cardEl) {
    const loc = locateCard(cardEl);
    if (!loc) return;

    let card = null;
    let source = null;

    if (loc.type === 'waste') {
      if (!waste.length) return;
      card   = waste[waste.length - 1];
      source = { type: 'waste' };
    } else if (loc.type === 'tableau') {
      const col = tableau[loc.index];
      if (loc.cardIndex !== col.length - 1) return; // only top card
      card   = col[col.length - 1];
      source = { type: 'tableau', index: loc.index };
    } else {
      return;
    }

    if (!card || !card.faceUp) return;
    const fi = bestFoundationIndex(card);
    if (fi >= 0) {
      clearSelection();
      executeMove(source, { type: 'foundation', index: fi }, [card]);
    }
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────────

  let lastClickTime   = 0;
  let lastClickTarget = null;
  let lastDragMoved   = false; // suppress click after drag

  function initPointerDrag(root) {
    root.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }

  function onPointerDown(e) {
    if (e.pointerType === 'touch') return; // touch handled by tap events

    const cardEl = e.target.closest('.card');
    if (!cardEl) return;

    // Stock face-down card: handled by click event, not drag
    if (cardEl.closest('#stock-pile')) return;

    // Detect double-click
    const now = Date.now();
    if (now - lastClickTime < 280 && lastClickTarget === cardEl) {
      lastClickTime   = 0;
      lastClickTarget = null;
      onDoubleTap(cardEl);
      return;
    }
    lastClickTime   = now;
    lastClickTarget = cardEl;

    // Attempt to start drag
    const loc = locateCard(cardEl);
    if (!loc || !cardEl.classList.contains('face-up')) return;
    if (loc.type === 'stock') return;

    let cards  = [];
    let source = null;

    if (loc.type === 'waste') {
      if (!waste.length) return;
      cards  = [waste[waste.length - 1]];
      source = { type: 'waste' };
    } else if (loc.type === 'foundation') {
      const f = foundations[loc.index];
      if (!f.length) return;
      cards  = [f[f.length - 1]];
      source = { type: 'foundation', index: loc.index };
    } else if (loc.type === 'tableau') {
      const col = tableau[loc.index];
      cards  = col.slice(loc.cardIndex);
      source = { type: 'tableau', index: loc.index };
    }

    if (!cards.length) return;

    const rect   = cardEl.getBoundingClientRect();
    const ghost  = buildGhost(cards, rect.width, rect.height);
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
    lastDragMoved = moved; // suppress the click event that fires after pointerup
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
        } else if (target.type === 'tableau') {
          const col = tableau[target.index];
          const top = col.length ? col[col.length - 1] : null;
          if (canStackOnTableau(cards[0], top) &&
              !(source.type === 'tableau' && source.index === target.index)) {
            executeMove(source, target, cards);
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
    // Check piles in order: foundations first, then tableau
    const pileIds = [
      'foundation-0', 'foundation-1', 'foundation-2', 'foundation-3',
      'tableau-0', 'tableau-1', 'tableau-2', 'tableau-3',
      'tableau-4', 'tableau-5', 'tableau-6',
    ];
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
    if (t.type === 'foundation') id = `foundation-${t.index}`;
    else if (t.type === 'tableau') id = `tableau-${t.index}`;
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
      const pileEl = el.closest('#stock-pile, #waste-pile, [id^="foundation-"], [id^="tableau-"]');

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
      } else if (pileEl) {
        onPileTap(pileEl);
      }
      e.preventDefault();
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

    // Best score (fewest moves)
    const key  = 'solitaire-best-moves';
    const prev = parseInt(localStorage.getItem(key) || '999999', 10);
    if (moves < prev) localStorage.setItem(key, String(moves));

    showScreen('win-screen');

    // Leaderboard
    if (typeof Leaderboard !== 'undefined') {
      Leaderboard.ready('solitaire', moves, { ascending: true, label: '이동' });
    }
  }

  function startGame() {
    stopTimer();
    clearSelection();
    autoRunning = false;

    // Hide leaderboard if visible
    if (typeof Leaderboard !== 'undefined') Leaderboard.hide();

    deal();
    renderAll();
    updateStats();
    showScreen('game-screen');
  }

  // ─── Event Wiring ─────────────────────────────────────────────────────────

  function initEvents() {
    const gameScreen = document.getElementById('game-screen');
    if (!gameScreen) return;

    // Touch tap
    initTouchTap(gameScreen);

    // Pointer drag (mouse)
    initPointerDrag(gameScreen);

    // Mouse click (for non-drag taps on desktop)
    gameScreen.addEventListener('click', e => {
      if (dragState || lastDragMoved) return;
      const cardEl = e.target.closest('.card');
      const pileEl = e.target.closest(
        '#stock-pile, #waste-pile, [id^="foundation-"], [id^="tableau-"]'
      );
      if (cardEl) {
        onCardTap(cardEl);
      } else if (pileEl) {
        onPileTap(pileEl);
      } else {
        clearSelection();
      }
    });

    // Buttons
    bindBtn('undo-btn',          undo);
    bindBtn('hint-btn',          showHint);
    bindBtn('auto-btn',          () => { if (!autoRunning) tryAutoComplete(); });
    bindBtn('restart-btn',       startGame);
    bindBtn('restart-icon-btn',  startGame);
    bindBtn('win-again-btn',     startGame);

    // Start screen
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
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
      showScreen('start-screen');
    } else {
      startGame();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // ─── Leaderboard integration ───────────────────────────────────────────────

  if (window.Leaderboard) {
    window.Leaderboard.init?.('solitaire');
  }

})();
