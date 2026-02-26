'use strict';

// ═══════════════════════════════════════════════
//  CHESS ENGINE
// ═══════════════════════════════════════════════

const EMPTY = 0;
const W_PAWN   = 1,  W_KNIGHT = 2,  W_BISHOP = 3,
      W_ROOK   = 4,  W_QUEEN  = 5,  W_KING   = 6;
const B_PAWN   = 7,  B_KNIGHT = 8,  B_BISHOP = 9,
      B_ROOK   = 10, B_QUEEN  = 11, B_KING   = 12;

const WHITE = 'white', BLACK = 'black';

const PIECE_UNICODE = {
  [W_KING]:   '♔', [W_QUEEN]:  '♕', [W_ROOK]:   '♖',
  [W_BISHOP]: '♗', [W_KNIGHT]: '♘', [W_PAWN]:   '♙',
  [B_KING]:   '♚', [B_QUEEN]:  '♛', [B_ROOK]:   '♜',
  [B_BISHOP]: '♝', [B_KNIGHT]: '♞', [B_PAWN]:   '♟',
};

const PIECE_VALUE = {
  [W_PAWN]: 100, [W_KNIGHT]: 320, [W_BISHOP]: 330,
  [W_ROOK]: 500, [W_QUEEN]: 900,  [W_KING]: 20000,
  [B_PAWN]: 100, [B_KNIGHT]: 320, [B_BISHOP]: 330,
  [B_ROOK]: 500, [B_QUEEN]: 900,  [B_KING]: 20000,
};

function isWhite(p) { return p >= W_PAWN && p <= W_KING; }
function isBlack(p) { return p >= B_PAWN && p <= B_KING; }
function colorOf(p) { return isWhite(p) ? WHITE : BLACK; }
function isEnemy(p, color) {
  return color === WHITE ? isBlack(p) : isWhite(p);
}
function isFriend(p, color) {
  return color === WHITE ? isWhite(p) : isBlack(p);
}
function pieceType(p) {
  if (p <= 0) return 0;
  return isWhite(p) ? p : p - 6;
}

// Position tables (for evaluation, white's perspective)
const PAWN_TABLE = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];
const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];
const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];
const ROOK_TABLE = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
];
const QUEEN_TABLE = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];
const KING_MID_TABLE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
];

function positionBonus(piece, row, col) {
  const idx = row * 8 + col;
  const mirIdx = (7 - row) * 8 + col;
  const t = pieceType(piece);
  if (isWhite(piece)) {
    switch(t) {
      case W_PAWN:   return PAWN_TABLE[mirIdx];
      case W_KNIGHT: return KNIGHT_TABLE[mirIdx];
      case W_BISHOP: return BISHOP_TABLE[mirIdx];
      case W_ROOK:   return ROOK_TABLE[mirIdx];
      case W_QUEEN:  return QUEEN_TABLE[mirIdx];
      case W_KING:   return KING_MID_TABLE[mirIdx];
    }
  } else {
    switch(t) {
      case W_PAWN:   return PAWN_TABLE[idx];
      case W_KNIGHT: return KNIGHT_TABLE[idx];
      case W_BISHOP: return BISHOP_TABLE[idx];
      case W_ROOK:   return ROOK_TABLE[idx];
      case W_QUEEN:  return QUEEN_TABLE[idx];
      case W_KING:   return KING_MID_TABLE[idx];
    }
  }
  return 0;
}

// ── Board State ──────────────────────────────
class ChessGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = this._initialBoard();
    this.turn = WHITE;
    this.enPassant = null;        // {row, col} target square
    this.castlingRights = {
      whiteKingSide: true, whiteQueenSide: true,
      blackKingSide: true, blackQueenSide: true,
    };
    this.halfMoveClock = 0;
    this.fullMoveNum = 1;
    this.moveHistory = [];        // {from, to, piece, captured, notation, special}
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.status = 'playing';      // playing | check | checkmate | stalemate | draw
    this.winner = null;
    this.lastMove = null;
  }

  _initialBoard() {
    const b = Array(8).fill(null).map(() => Array(8).fill(EMPTY));
    // Black back rank
    const backBlack = [B_ROOK, B_KNIGHT, B_BISHOP, B_QUEEN, B_KING, B_BISHOP, B_KNIGHT, B_ROOK];
    b[0] = [...backBlack];
    b[1] = Array(8).fill(B_PAWN);
    // White back rank
    const backWhite = [W_ROOK, W_KNIGHT, W_BISHOP, W_QUEEN, W_KING, W_BISHOP, W_KNIGHT, W_ROOK];
    b[7] = [...backWhite];
    b[6] = Array(8).fill(W_PAWN);
    return b;
  }

  piece(r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return this.board[r][c];
  }

  // Returns all pseudo-legal moves (may leave king in check)
  _pseudoMoves(r, c, board, enPassant, castling) {
    const p = board[r][c];
    if (!p) return [];
    const color = colorOf(p);
    const moves = [];
    const add = (tr, tc, special) => {
      if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return;
      moves.push({ from: [r, c], to: [tr, tc], special });
    };
    const slide = (dr, dc) => {
      let nr = r + dr, nc = c + dc;
      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const t = board[nr][nc];
        if (!t) { add(nr, nc); nr += dr; nc += dc; }
        else { if (isEnemy(t, color)) add(nr, nc, 'capture'); break; }
      }
    };

    switch (pieceType(p)) {
      case W_PAWN: {
        const dir = color === WHITE ? -1 : 1;
        const startRow = color === WHITE ? 6 : 1;
        // Forward
        if (!board[r+dir]?.[c]) {
          add(r+dir, c, (r+dir===0||r+dir===7)?'promote':null);
          if (r === startRow && !board[r+2*dir]?.[c])
            add(r+2*dir, c, 'pawn2');
        }
        // Diagonal captures
        for (const dc of [-1, 1]) {
          const nr = r+dir, nc = c+dc;
          if (nc<0||nc>7) continue;
          const t = board[nr]?.[nc];
          if (t && isEnemy(t, color))
            add(nr, nc, (nr===0||nr===7)?'promote-capture':'capture');
          // En passant
          if (enPassant && nr===enPassant.row && nc===enPassant.col)
            add(nr, nc, 'enpassant');
        }
        break;
      }
      case W_KNIGHT: {
        for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
          const nr=r+dr, nc=c+dc;
          if (nr<0||nr>7||nc<0||nc>7) continue;
          const t = board[nr][nc];
          if (!t || isEnemy(t, color)) add(nr, nc, t?'capture':null);
        }
        break;
      }
      case W_BISHOP:
        slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); break;
      case W_ROOK:
        slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break;
      case W_QUEEN:
        slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1);
        slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break;
      case W_KING: {
        for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
          const nr=r+dr, nc=c+dc;
          if (nr<0||nr>7||nc<0||nc>7) continue;
          const t = board[nr][nc];
          if (!t || isEnemy(t, color)) add(nr, nc, t?'capture':null);
        }
        // Castling
        if (color === WHITE && r===7 && c===4) {
          if (castling.whiteKingSide &&
              !board[7][5] && !board[7][6] &&
              board[7][7]===W_ROOK)
            add(7, 6, 'castle-kingside');
          if (castling.whiteQueenSide &&
              !board[7][3] && !board[7][2] && !board[7][1] &&
              board[7][0]===W_ROOK)
            add(7, 2, 'castle-queenside');
        }
        if (color === BLACK && r===0 && c===4) {
          if (castling.blackKingSide &&
              !board[0][5] && !board[0][6] &&
              board[0][7]===B_ROOK)
            add(0, 6, 'castle-kingside');
          if (castling.blackQueenSide &&
              !board[0][3] && !board[0][2] && !board[0][1] &&
              board[0][0]===B_ROOK)
            add(0, 2, 'castle-queenside');
        }
        break;
      }
    }
    return moves;
  }

  // Clone board
  _cloneBoard(board) {
    return board.map(r => [...r]);
  }

  // Apply move to a board clone (for legality checking)
  _applyMove(board, move, promoPiece) {
    const { from, to, special } = move;
    const [fr, fc] = from;
    const [tr, tc] = to;
    const p = board[fr][fc];
    const color = colorOf(p);

    board[tr][tc] = p;
    board[fr][fc] = EMPTY;

    if (special === 'enpassant') {
      const dir = color === WHITE ? 1 : -1;
      board[tr + dir][tc] = EMPTY;
    }
    if (special === 'castle-kingside') {
      const row = color === WHITE ? 7 : 0;
      board[row][5] = board[row][7];
      board[row][7] = EMPTY;
    }
    if (special === 'castle-queenside') {
      const row = color === WHITE ? 7 : 0;
      board[row][3] = board[row][0];
      board[row][0] = EMPTY;
    }
    if (special === 'promote' || special === 'promote-capture') {
      board[tr][tc] = promoPiece || (color === WHITE ? W_QUEEN : B_QUEEN);
    }
  }

  // Find king position
  _kingPos(board, color) {
    const king = color === WHITE ? W_KING : B_KING;
    for (let r=0;r<8;r++) for(let c=0;c<8;c++)
      if (board[r][c]===king) return [r,c];
    return null;
  }

  // Is square attacked by the given color?
  _isAttacked(board, row, col, byColor, ep, castling) {
    for (let r=0;r<8;r++) for(let c=0;c<8;c++) {
      const p = board[r][c];
      if (!p || colorOf(p)!==byColor) continue;
      const moves = this._pseudoMoves(r, c, board, ep, castling);
      if (moves.some(m => m.to[0]===row && m.to[1]===col)) return true;
    }
    return false;
  }

  // Get legal moves from a square
  legalMovesFrom(r, c) {
    const p = this.board[r][c];
    if (!p || colorOf(p) !== this.turn) return [];
    const pseudo = this._pseudoMoves(r, c, this.board, this.enPassant, this.castlingRights);
    const legal = [];
    for (const move of pseudo) {
      const b = this._cloneBoard(this.board);
      this._applyMove(b, move);
      const kp = this._kingPos(b, this.turn);
      if (!kp) continue;
      const opp = this.turn === WHITE ? BLACK : WHITE;
      // For castling, also check king doesn't pass through check
      if (move.special === 'castle-kingside' || move.special === 'castle-queenside') {
        const row = this.turn === WHITE ? 7 : 0;
        const passCols = move.special === 'castle-kingside' ? [4,5,6] : [4,3,2];
        let safe = true;
        for (const pc of passCols) {
          if (this._isAttacked(this.board, row, pc, opp, this.enPassant, this.castlingRights)) {
            safe = false; break;
          }
        }
        if (!safe) continue;
      }
      if (!this._isAttacked(b, kp[0], kp[1], opp, null, {
        whiteKingSide: false, whiteQueenSide: false,
        blackKingSide: false, blackQueenSide: false,
      })) legal.push(move);
    }
    return legal;
  }

  // All legal moves for current player
  allLegalMoves() {
    const moves = [];
    for (let r=0;r<8;r++) for(let c=0;c<8;c++) {
      const p = this.board[r][c];
      if (p && colorOf(p)===this.turn)
        moves.push(...this.legalMovesFrom(r, c));
    }
    return moves;
  }

  isInCheck(color) {
    color = color || this.turn;
    const kp = this._kingPos(this.board, color);
    if (!kp) return false;
    const opp = color === WHITE ? BLACK : WHITE;
    return this._isAttacked(this.board, kp[0], kp[1], opp, this.enPassant, this.castlingRights);
  }

  // Execute a move (modifies state)
  makeMove(move, promoPiece) {
    const { from, to, special } = move;
    const [fr, fc] = from;
    const [tr, tc] = to;
    const p = this.board[fr][fc];
    const color = colorOf(p);
    const captured = this.board[tr][tc];

    // En passant capture piece
    let epCaptured = null;
    if (special === 'enpassant') {
      const dir = color === WHITE ? 1 : -1;
      epCaptured = this.board[tr+dir][tc];
    }

    // Apply to board
    const b = this._cloneBoard(this.board);
    this._applyMove(b, move, promoPiece);
    this.board = b;

    // Record captures
    if (captured) {
      color === WHITE
        ? this.capturedByWhite.push(captured)
        : this.capturedByBlack.push(captured);
    }
    if (epCaptured) {
      color === WHITE
        ? this.capturedByWhite.push(epCaptured)
        : this.capturedByBlack.push(epCaptured);
    }

    // Update castling rights
    if (p === W_KING) { this.castlingRights.whiteKingSide = false; this.castlingRights.whiteQueenSide = false; }
    if (p === B_KING) { this.castlingRights.blackKingSide = false; this.castlingRights.blackQueenSide = false; }
    if (p === W_ROOK && fr===7 && fc===7) this.castlingRights.whiteKingSide = false;
    if (p === W_ROOK && fr===7 && fc===0) this.castlingRights.whiteQueenSide = false;
    if (p === B_ROOK && fr===0 && fc===7) this.castlingRights.blackKingSide = false;
    if (p === B_ROOK && fr===0 && fc===0) this.castlingRights.blackQueenSide = false;
    // Rook captured on its start square
    if (tr===7&&tc===7) this.castlingRights.whiteKingSide = false;
    if (tr===7&&tc===0) this.castlingRights.whiteQueenSide = false;
    if (tr===0&&tc===7) this.castlingRights.blackKingSide = false;
    if (tr===0&&tc===0) this.castlingRights.blackQueenSide = false;

    // En passant square
    if (special === 'pawn2') {
      const dir = color === WHITE ? 1 : -1;
      this.enPassant = { row: tr+dir, col: tc };
    } else {
      this.enPassant = null;
    }

    // Half-move clock
    if (pieceType(p) === W_PAWN || captured || epCaptured) this.halfMoveClock = 0;
    else this.halfMoveClock++;

    // Full move
    if (color === BLACK) this.fullMoveNum++;

    // Build notation
    const notation = this._buildNotation(move, p, captured||epCaptured, promoPiece);

    // Switch turn
    this.turn = color === WHITE ? BLACK : WHITE;

    // Update status
    this.lastMove = { from, to };
    this._updateStatus();

    // Record history
    this.moveHistory.push({
      from, to, piece: p, captured: captured||epCaptured,
      notation, special, promoPiece,
    });

    return notation;
  }

  _updateStatus() {
    const moves = this.allLegalMoves();
    const inCheck = this.isInCheck(this.turn);

    if (moves.length === 0) {
      if (inCheck) {
        this.status = 'checkmate';
        this.winner = this.turn === WHITE ? BLACK : WHITE;
      } else {
        this.status = 'stalemate';
      }
    } else if (inCheck) {
      this.status = 'check';
    } else if (this.halfMoveClock >= 100) {
      this.status = 'draw';
    } else {
      this.status = 'playing';
    }
  }

  _buildNotation(move, piece, captured, promoPiece) {
    const { from, to, special } = move;
    const files = 'abcdefgh';
    const fromStr = files[from[1]] + (8-from[0]);
    const toStr   = files[to[1]]  + (8-to[0]);
    if (special === 'castle-kingside')  return 'O-O';
    if (special === 'castle-queenside') return 'O-O-O';
    const cap = captured ? 'x' : '';
    const pt = pieceType(piece);
    const pieceName = ['','','N','B','R','Q','K'][pt] || '';
    const promo = (special==='promote'||special==='promote-capture') ? '=Q' : '';
    return `${pieceName}${pt===W_PAWN&&captured?fromStr[0]:''}${cap}${toStr}${promo}`;
  }

  // Evaluate board for minimax (positive = white advantage)
  evaluate() {
    let score = 0;
    for (let r=0;r<8;r++) for(let c=0;c<8;c++) {
      const p = this.board[r][c];
      if (!p) continue;
      const v = (PIECE_VALUE[p] || 0) + positionBonus(p, r, c);
      score += isWhite(p) ? v : -v;
    }
    return score;
  }
}

// ═══════════════════════════════════════════════
//  AI - Minimax with Alpha-Beta
// ═══════════════════════════════════════════════

function minimax(game, depth, alpha, beta, maximizing) {
  if (depth === 0 || game.status === 'checkmate' || game.status === 'stalemate' || game.status === 'draw') {
    if (game.status === 'checkmate') return maximizing ? -100000 : 100000;
    if (game.status === 'stalemate' || game.status === 'draw') return 0;
    return game.evaluate();
  }

  const moves = game.allLegalMoves();
  // Move ordering: captures first
  moves.sort((a, b) => {
    const ca = game.board[a.to[0]][a.to[1]] ? 1 : 0;
    const cb = game.board[b.to[0]][b.to[1]] ? 1 : 0;
    return cb - ca;
  });

  if (maximizing) {
    let best = -Infinity;
    for (const move of moves) {
      // Save state
      const saved = saveState(game);
      game.makeMove(move);
      const val = minimax(game, depth-1, alpha, beta, false);
      restoreState(game, saved);
      best = Math.max(best, val);
      alpha = Math.max(alpha, val);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const saved = saveState(game);
      game.makeMove(move);
      const val = minimax(game, depth-1, alpha, beta, true);
      restoreState(game, saved);
      best = Math.min(best, val);
      beta = Math.min(beta, val);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function saveState(game) {
  return {
    board: game.board.map(r => [...r]),
    turn: game.turn,
    enPassant: game.enPassant ? {...game.enPassant} : null,
    castlingRights: {...game.castlingRights},
    halfMoveClock: game.halfMoveClock,
    fullMoveNum: game.fullMoveNum,
    capturedByWhite: [...game.capturedByWhite],
    capturedByBlack: [...game.capturedByBlack],
    status: game.status,
    winner: game.winner,
    lastMove: game.lastMove,
    moveHistory: [...game.moveHistory],
  };
}

function restoreState(game, saved) {
  game.board = saved.board.map(r => [...r]);
  game.turn = saved.turn;
  game.enPassant = saved.enPassant ? {...saved.enPassant} : null;
  game.castlingRights = {...saved.castlingRights};
  game.halfMoveClock = saved.halfMoveClock;
  game.fullMoveNum = saved.fullMoveNum;
  game.capturedByWhite = [...saved.capturedByWhite];
  game.capturedByBlack = [...saved.capturedByBlack];
  game.status = saved.status;
  game.winner = saved.winner;
  game.lastMove = saved.lastMove;
  game.moveHistory = [...saved.moveHistory];
}

function getBestMove(game, depth) {
  const moves = game.allLegalMoves();
  if (!moves.length) return null;

  let bestMove = null;
  let bestVal = Infinity;  // AI is black = minimizing

  // Move ordering
  moves.sort((a, b) => {
    const ca = game.board[a.to[0]][a.to[1]] ? 1 : 0;
    const cb = game.board[b.to[0]][b.to[1]] ? 1 : 0;
    return cb - ca;
  });

  for (const move of moves) {
    const saved = saveState(game);
    game.makeMove(move);
    const val = minimax(game, depth-1, -Infinity, Infinity, true);
    restoreState(game, saved);
    if (val < bestVal) {
      bestVal = val;
      bestMove = move;
    }
  }
  return bestMove;
}

// ═══════════════════════════════════════════════
//  UI CONTROLLER
// ═══════════════════════════════════════════════

class ChessUI {
  constructor() {
    this.game = new ChessGame();
    this.selectedCell = null;
    this.validMoves = [];
    this.aiThinking = false;
    this.difficulty = 2; // depth: easy=1, normal=2, hard=3
    this.stats = this._loadStats();
    this.pendingPromotion = null;

    this._buildDOM();
    this._bindEvents();
    this._showScreen('start-screen');
    this._renderStats();
  }

  // ── DOM Building ──────────────────────────────

  _buildDOM() {
    const app = document.getElementById('app');

    // Start screen
    app.innerHTML = `
      <div id="start-screen" class="screen">
        <div class="game-title">CHESS</div>
        <div class="game-subtitle">1인 플레이 · AI 대전</div>

        <div class="stats-card">
          <div class="stat-item">
            <div class="stat-value wins" id="stat-wins">0</div>
            <div class="stat-label">승리</div>
          </div>
          <div class="stat-item">
            <div class="stat-value losses" id="stat-losses">0</div>
            <div class="stat-label">패배</div>
          </div>
          <div class="stat-item">
            <div class="stat-value draws" id="stat-draws">0</div>
            <div class="stat-label">무승부</div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;align-items:center;gap:0.4rem;">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.2rem;">난이도</div>
          <div class="difficulty-row">
            <button class="diff-btn ${this.difficulty===1?'selected':''}" data-diff="1">쉬움</button>
            <button class="diff-btn ${this.difficulty===2?'selected':''}" data-diff="2">보통</button>
            <button class="diff-btn ${this.difficulty===3?'selected':''}" data-diff="3">어려움</button>
          </div>
        </div>

        <button class="btn btn-primary" id="start-btn">게임 시작</button>
        <button class="btn btn-secondary" id="reset-stats-btn">기록 초기화</button>
      </div>

      <div id="result-screen" class="screen hidden">
        <div class="result-emoji" id="result-emoji"></div>
        <div class="result-title" id="result-title"></div>
        <div class="result-subtitle" id="result-subtitle"></div>
        <button class="btn btn-primary" id="play-again-btn">다시 시작</button>
        <button class="btn btn-secondary" id="to-menu-btn">메뉴로</button>
      </div>

      <div id="game-header" style="display:none;">
        <div class="header-left">
          <span class="header-title">CHESS</span>
        </div>
        <div class="header-controls">
          <button class="btn btn-icon" id="undo-btn" title="무르기">↩</button>
          <button class="btn btn-icon" id="menu-btn" title="메뉴">☰</button>
        </div>
      </div>

      <div id="player-bar-top" class="player-bar top" style="display:none;">
        <div class="player-info">
          <div class="player-indicator black" id="black-indicator"></div>
          <div>
            <div class="player-name">AI (흑)</div>
            <div class="player-status" id="black-status"></div>
          </div>
        </div>
        <div class="captured-pieces" id="captured-by-black"></div>
      </div>

      <div id="board-container" style="display:none;">
        <div id="board-wrap">
          <div id="chess-board"></div>
          <div id="promotion-modal">
            <div class="promo-title">폰 승진 선택</div>
            <div class="promo-pieces" id="promo-pieces"></div>
          </div>
        </div>
      </div>

      <div id="player-bar-bottom" class="player-bar bottom" style="display:none;">
        <div class="player-info">
          <div class="player-indicator white" id="white-indicator"></div>
          <div>
            <div class="player-name">나 (백)</div>
            <div class="player-status" id="white-status"></div>
          </div>
        </div>
        <div class="captured-pieces" id="captured-by-white"></div>
      </div>

      <div id="bottom-panel" style="display:none;">
        <div class="panel-tabs">
          <button class="tab-btn active" data-tab="history">기보</button>
          <button class="tab-btn" data-tab="info">정보</button>
        </div>
        <div class="tab-content active" id="tab-history">
          <div id="move-list"></div>
        </div>
        <div class="tab-content" id="tab-info">
          <div style="font-size:0.75rem;color:var(--text-secondary);padding:0.25rem;">
            <div>백 기물값: <span id="info-white-val">--</span></div>
            <div>흑 기물값: <span id="info-black-val">--</span></div>
            <div>이동 횟수: <span id="info-moves">--</span></div>
          </div>
        </div>
        <div id="ai-thinking">
          <div class="thinking-dots"><span></span><span></span><span></span></div>
          <span>AI가 생각 중...</span>
        </div>
      </div>
    `;
  }

  // ── Board Rendering ───────────────────────────

  _buildBoard() {
    const board = document.getElementById('chess-board');
    board.innerHTML = '';
    const size = this._boardSize();
    board.style.width  = size + 'px';
    board.style.height = size + 'px';

    const cellSize = size / 8;
    // Precompute font size based on cell
    const fontSize = Math.floor(cellSize * 0.72) + 'px';

    for (let r=0; r<8; r++) {
      for (let c=0; c<8; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell ' + ((r+c)%2===0 ? 'light' : 'dark');
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.style.fontSize = fontSize;

        const p = this.game.board[r][c];
        if (p) {
          const span = document.createElement('span');
          span.className = 'piece';
          span.textContent = PIECE_UNICODE[p] || '';
          cell.appendChild(span);
        }

        board.appendChild(cell);
      }
    }
  }

  _boardSize() {
    const container = document.getElementById('board-container');
    if (!container) return 320;
    const w = container.clientWidth  - 16;
    const h = container.clientHeight - 16;
    return Math.min(w, h, 440);
  }

  _renderBoard() {
    const board = document.getElementById('chess-board');
    if (!board) return;

    const size = this._boardSize();
    board.style.width  = size + 'px';
    board.style.height = size + 'px';

    const cells = board.querySelectorAll('.cell');
    const cellSize = size / 8;
    const fontSize = Math.floor(cellSize * 0.72) + 'px';

    const lm = this.game.lastMove;
    const checkPos = this._getCheckPos();

    cells.forEach(cell => {
      const r = +cell.dataset.r;
      const c = +cell.dataset.c;

      // Reset classes
      cell.className = 'cell ' + ((r+c)%2===0 ? 'light' : 'dark');
      cell.style.fontSize = fontSize;

      // Last move highlight
      if (lm && ((lm.from[0]===r&&lm.from[1]===c)||(lm.to[0]===r&&lm.to[1]===c)))
        cell.classList.add('last-move');

      // Check highlight
      if (checkPos && checkPos[0]===r && checkPos[1]===c)
        cell.classList.add('in-check');

      // Selected
      if (this.selectedCell && this.selectedCell[0]===r && this.selectedCell[1]===c)
        cell.classList.add('selected');

      // Valid moves
      const isValid = this.validMoves.find(m => m.to[0]===r && m.to[1]===c);
      if (isValid) {
        const hasPiece = this.game.board[r][c] || isValid.special==='enpassant';
        cell.classList.add(hasPiece ? 'valid-capture' : 'valid-move');
      }

      // Piece
      const p = this.game.board[r][c];
      const existing = cell.querySelector('.piece');
      if (p) {
        const ch = PIECE_UNICODE[p] || '';
        if (existing) { existing.textContent = ch; }
        else {
          const span = document.createElement('span');
          span.className = 'piece';
          span.textContent = ch;
          cell.appendChild(span);
        }
      } else {
        if (existing) existing.remove();
      }
    });
  }

  _getCheckPos() {
    if (this.game.status !== 'check' && this.game.status !== 'checkmate') return null;
    const color = this.game.turn;
    const king = color === WHITE ? W_KING : B_KING;
    for (let r=0;r<8;r++) for(let c=0;c<8;c++)
      if (this.game.board[r][c]===king) return [r,c];
    return null;
  }

  _renderCaptured() {
    const byCap = {
      white: document.getElementById('captured-by-white'),
      black: document.getElementById('captured-by-black'),
    };
    // White captured black pieces
    byCap.white.innerHTML = this.game.capturedByWhite
      .map(p => `<span>${PIECE_UNICODE[p]||''}</span>`).join('');
    // Black captured white pieces
    byCap.black.innerHTML = this.game.capturedByBlack
      .map(p => `<span>${PIECE_UNICODE[p]||''}</span>`).join('');
  }

  _renderMoveHistory() {
    const list = document.getElementById('move-list');
    const history = this.game.moveHistory;
    if (!history.length) { list.innerHTML = '<span style="color:var(--text-muted);font-size:0.7rem;">아직 이동 없음</span>'; return; }

    let html = '';
    for (let i=0; i<history.length; i+=2) {
      const num = Math.floor(i/2)+1;
      const w = history[i]?.notation || '';
      const b = history[i+1]?.notation || '';
      const wLast = i===history.length-1 && history.length%2===1;
      const bLast = i+1===history.length-1;
      html += `<span class="move-num">${num}.</span>
               <span class="move-text${wLast?' last':''}">${w}</span>
               <span class="move-text${bLast?' last':''}">${b}</span>`;
    }
    list.innerHTML = html;
    list.scrollTop = list.scrollHeight;
  }

  _renderPlayerBars() {
    const wInd = document.getElementById('white-indicator');
    const bInd = document.getElementById('black-indicator');
    const wStat = document.getElementById('white-status');
    const bStat = document.getElementById('black-status');

    wInd.classList.toggle('active', this.game.turn === WHITE && this.game.status !== 'checkmate');
    bInd.classList.toggle('active', this.game.turn === BLACK && this.game.status !== 'checkmate');

    const inCheck = this.game.isInCheck(this.game.turn);
    if (this.game.status === 'check') {
      if (this.game.turn === WHITE) {
        wStat.textContent = '체크!'; wStat.className = 'player-status in-check';
        bStat.textContent = ''; bStat.className = 'player-status';
      } else {
        bStat.textContent = '체크!'; bStat.className = 'player-status in-check';
        wStat.textContent = ''; wStat.className = 'player-status';
      }
    } else {
      wStat.textContent = this.game.turn===WHITE && !this.aiThinking ? '이동 차례' : '';
      wStat.className = 'player-status';
      bStat.textContent = this.game.turn===BLACK || this.aiThinking ? (this.aiThinking?'생각 중...':'이동 차례') : '';
      bStat.className = 'player-status';
    }
  }

  _renderInfo() {
    let wVal = 0, bVal = 0;
    for (let r=0;r<8;r++) for(let c=0;c<8;c++) {
      const p = this.game.board[r][c];
      if (!p) continue;
      const v = PIECE_VALUE[p] || 0;
      isWhite(p) ? (wVal+=v) : (bVal+=v);
    }
    const wi = document.getElementById('info-white-val');
    const bi = document.getElementById('info-black-val');
    const mi = document.getElementById('info-moves');
    if (wi) wi.textContent = wVal;
    if (bi) bi.textContent = bVal;
    if (mi) mi.textContent = this.game.fullMoveNum - 1;
  }

  _renderAll() {
    this._renderBoard();
    this._renderCaptured();
    this._renderMoveHistory();
    this._renderPlayerBars();
    this._renderInfo();
  }

  // ── Screens ───────────────────────────────────

  _showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
  }

  _showGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.add('hidden');
    ['game-header','player-bar-top','board-container','player-bar-bottom','bottom-panel']
      .forEach(id => { const el=document.getElementById(id); if(el) el.style.display=''; });
  }

  _renderStats() {
    document.getElementById('stat-wins').textContent   = this.stats.wins;
    document.getElementById('stat-losses').textContent = this.stats.losses;
    document.getElementById('stat-draws').textContent  = this.stats.draws;
  }

  _showResult(status, winner) {
    let emoji, title, subtitle;
    if (status === 'checkmate') {
      if (winner === WHITE) {
        emoji='🏆'; title='승리!'; subtitle='체크메이트! 당신이 이겼습니다.';
        this.stats.wins++;
      } else {
        emoji='😞'; title='패배'; subtitle='체크메이트! AI가 이겼습니다.';
        this.stats.losses++;
      }
    } else if (status === 'stalemate') {
      emoji='🤝'; title='스테일메이트'; subtitle='무승부입니다.';
      this.stats.draws++;
    } else {
      emoji='🤝'; title='무승부'; subtitle='50수 규칙에 의한 무승부.';
      this.stats.draws++;
    }
    this._saveStats();
    document.getElementById('result-emoji').textContent = emoji;
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-subtitle').textContent = subtitle;
    this._showScreen('result-screen');
  }

  // ── Event Binding ─────────────────────────────

  _bindEvents() {
    // Start button
    document.getElementById('start-btn').addEventListener('click', () => {
      this._startGame();
    });

    // Difficulty
    document.addEventListener('click', e => {
      const btn = e.target.closest('.diff-btn');
      if (!btn) return;
      this.difficulty = +btn.dataset.diff;
      document.querySelectorAll('.diff-btn').forEach(b => {
        b.classList.toggle('selected', +b.dataset.diff === this.difficulty);
      });
    });

    // Stats reset
    document.getElementById('reset-stats-btn').addEventListener('click', () => {
      this.stats = {wins:0,losses:0,draws:0};
      this._saveStats();
      this._renderStats();
    });

    // Play again
    document.getElementById('play-again-btn').addEventListener('click', () => {
      this._startGame();
    });

    // To menu
    document.getElementById('to-menu-btn').addEventListener('click', () => {
      this._renderStats();
      this._showScreen('start-screen');
      ['game-header','player-bar-top','board-container','player-bar-bottom','bottom-panel']
        .forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
    });

    // Undo
    document.getElementById('undo-btn').addEventListener('click', () => {
      this._undoMove();
    });

    // Menu
    document.getElementById('menu-btn').addEventListener('click', () => {
      this._renderStats();
      this._showScreen('start-screen');
      ['game-header','player-bar-top','board-container','player-bar-bottom','bottom-panel']
        .forEach(id => { const el=document.getElementById(id); if(el) el.style.display='none'; });
    });

    // Board clicks
    document.getElementById('chess-board').addEventListener('click', e => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      this._handleCellClick(+cell.dataset.r, +cell.dataset.c);
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-'+tab).classList.add('active');
      });
    });

    // Resize
    window.addEventListener('resize', () => {
      this._renderBoard();
    });
  }

  // ── Game Flow ─────────────────────────────────

  _startGame() {
    this.game.reset();
    this.selectedCell = null;
    this.validMoves = [];
    this.aiThinking = false;
    this.pendingPromotion = null;
    this._showGame();
    this._buildBoard();
    setTimeout(() => this._renderAll(), 50);
  }

  _handleCellClick(r, c) {
    if (this.aiThinking) return;
    if (this.game.turn !== WHITE) return;
    if (this.game.status === 'checkmate' || this.game.status === 'stalemate' || this.game.status === 'draw') return;

    // If a cell is already selected, try to move there
    if (this.selectedCell) {
      const move = this.validMoves.find(m => m.to[0]===r && m.to[1]===c);
      if (move) {
        // Handle promotion
        if (move.special === 'promote' || move.special === 'promote-capture') {
          this._showPromotion(move, WHITE);
          return;
        }
        this._executePlayerMove(move);
        return;
      }
    }

    // Select piece
    const p = this.game.board[r][c];
    if (p && colorOf(p) === WHITE) {
      this.selectedCell = [r, c];
      this.validMoves = this.game.legalMovesFrom(r, c);
    } else {
      this.selectedCell = null;
      this.validMoves = [];
    }
    this._renderBoard();
    this._renderPlayerBars();
  }

  _executePlayerMove(move, promoPiece) {
    this.selectedCell = null;
    this.validMoves = [];
    this.game.makeMove(move, promoPiece);
    this._renderAll();

    if (this.game.status === 'checkmate' || this.game.status === 'stalemate' || this.game.status === 'draw') {
      setTimeout(() => this._showResult(this.game.status, this.game.winner), 800);
      return;
    }

    // AI turn
    this._doAIMove();
  }

  _doAIMove() {
    if (this.game.turn !== BLACK) return;
    this.aiThinking = true;
    document.getElementById('ai-thinking').classList.add('visible');
    this._renderPlayerBars();

    setTimeout(() => {
      const depth = this.difficulty;
      const best = getBestMove(this.game, depth);
      this.aiThinking = false;
      document.getElementById('ai-thinking').classList.remove('visible');

      if (best) {
        // Check if AI promotion
        if (best.special === 'promote' || best.special === 'promote-capture') {
          this.game.makeMove(best, B_QUEEN);
        } else {
          this.game.makeMove(best);
        }
      }
      this._renderAll();

      if (this.game.status === 'checkmate' || this.game.status === 'stalemate' || this.game.status === 'draw') {
        setTimeout(() => this._showResult(this.game.status, this.game.winner), 600);
      }
    }, 50);
  }

  _showPromotion(move, color) {
    const modal = document.getElementById('promotion-modal');
    const pieces = document.getElementById('promo-pieces');
    const options = color === WHITE
      ? [W_QUEEN, W_ROOK, W_BISHOP, W_KNIGHT]
      : [B_QUEEN, B_ROOK, B_BISHOP, B_KNIGHT];

    pieces.innerHTML = '';
    options.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'promo-piece';
      btn.textContent = PIECE_UNICODE[p];
      btn.addEventListener('click', () => {
        modal.classList.remove('visible');
        this._executePlayerMove(move, p);
      });
      pieces.appendChild(btn);
    });
    modal.classList.add('visible');
  }

  _undoMove() {
    if (this.aiThinking) return;
    // Undo 2 moves (player + AI)
    const hist = this.game.moveHistory;
    if (hist.length < 2) return;

    this.game.reset();
    const movesToReplay = hist.slice(0, -2);

    for (const entry of movesToReplay) {
      // Find matching move
      const moves = this.game.allLegalMoves();
      const m = moves.find(mv =>
        mv.from[0]===entry.from[0] && mv.from[1]===entry.from[1] &&
        mv.to[0]===entry.to[0]   && mv.to[1]===entry.to[1]
      );
      if (m) this.game.makeMove(m, entry.promoPiece);
    }

    this.selectedCell = null;
    this.validMoves = [];
    this._buildBoard();
    this._renderAll();
  }

  // ── Stats ─────────────────────────────────────

  _loadStats() {
    try {
      const s = localStorage.getItem('chess_stats');
      return s ? JSON.parse(s) : {wins:0,losses:0,draws:0};
    } catch { return {wins:0,losses:0,draws:0}; }
  }

  _saveStats() {
    try { localStorage.setItem('chess_stats', JSON.stringify(this.stats)); } catch {}
  }
}

// ─── Init ──────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  window._chessUI = new ChessUI();
});
