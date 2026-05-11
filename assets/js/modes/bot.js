import {
  SIZE, createStartBoard, getValidMoves, getFlips, applyMove,
  countDiscs, isGameOver, getWinner,
  initBoardElement, renderBoardFull, showValidMoves, clearValidMoves,
  showPreview, clearPreview,
  animatePlaceAndFlip, highlightWinners, clearWinnerHighlight,
  animateRestart, updateScoreBar
} from '../components/board.js';
import { startConfetti, stopConfetti } from '../components/confetti.js';

let boardEl, infoEl, subInfoEl, restartBtn, leaderboardEl, scoreBarEl, sendBtn;

let boardState = createStartBoard();
let currentPlayer = 1;
let gameActive = false;
let isAnimating = false;
let isRestarting = false;
let firstInit = true;
let difficulty = 'medium';

let pendingRow = -1;
let pendingCol = -1;
let pendingFlips = [];

export const leaderboard = { player: 0, bot: 0, draws: 0 };

export function initBotRefs(els) {
  boardEl = els.boardEl;
  infoEl = els.infoEl;
  subInfoEl = els.subInfoEl;
  restartBtn = els.restartBtn;
  leaderboardEl = els.leaderboardEl;
  scoreBarEl = els.scoreBarEl;
  sendBtn = els.sendBtn;
}

export function setBotDifficulty(d) { difficulty = d; }

export function clearBotBoard() {
  gameActive = false;
  isAnimating = false;
  pendingRow = -1;
  pendingCol = -1;
  pendingFlips = [];
  if (boardEl) boardEl.innerHTML = '';
}

export function startBotGame() {
  boardState = createStartBoard();
  currentPlayer = 1;
  gameActive = true;
  isAnimating = false;
  pendingRow = -1;
  pendingCol = -1;
  pendingFlips = [];

  clearWinnerHighlight(boardEl);
  stopConfetti();
  initBoardElement(boardEl, firstInit);
  firstInit = false;
  boardEl.style.opacity = '1';
  renderBoardFull(boardEl, boardState);

  showValidMoves(boardEl, getValidMoves(boardState, 1));
  updateScoreBar(scoreBarEl, boardState);
  restartBtn.style.display = 'inline-flex';
  if (sendBtn) sendBtn.disabled = true;
  setInfo('Your turn (Black)');
  setSubInfo('');
  renderLeaderboard();
}

export function handleBotHover(row, col) {
  if (!gameActive || isAnimating || currentPlayer !== 1) return;
  if (row === -1 || pendingRow !== -1) {
    if (pendingRow === -1) showPreview(boardEl, -1, -1, [], 1);
    return;
  }
  const flips = getFlips(boardState, row, col, 1);
  if (flips.length === 0) {
    showPreview(boardEl, -1, -1, [], 1);
    return;
  }
  showPreview(boardEl, row, col, flips, 1);
}

export function handleBotSelect(row, col) {
  if (!gameActive || isAnimating || currentPlayer !== 1) return;
  const flips = getFlips(boardState, row, col, 1);
  if (flips.length === 0) return;

  if (pendingRow === row && pendingCol === col) return;

  pendingRow = row;
  pendingCol = col;
  pendingFlips = flips;

  showPreview(boardEl, row, col, flips, 1);
  if (sendBtn) sendBtn.disabled = false;
  setSubInfo('Click Send to confirm, or pick a different square.');
}

export function cancelBotMove() {
  if (pendingRow === -1) return;
  pendingRow = -1; pendingCol = -1; pendingFlips = [];
  if (sendBtn) sendBtn.disabled = true;
  clearPreview(boardEl);
  setSubInfo('');
}

export async function commitBotMove() {
  if (!gameActive || isAnimating || pendingRow === -1 || currentPlayer !== 1) return;
  const row = pendingRow;
  const col = pendingCol;
  const flips = pendingFlips;

  pendingRow = -1;
  pendingCol = -1;
  pendingFlips = [];
  if (sendBtn) sendBtn.disabled = true;
  setSubInfo('');

  isAnimating = true;
  clearValidMoves(boardEl);

  await animatePlaceAndFlip(boardEl, row, col, 1, flips);
  boardState = applyMove(boardState, row, col, 1);
  renderBoardFull(boardEl, boardState);
  updateScoreBar(scoreBarEl, boardState);

  if (isGameOver(boardState)) {
    endBotGame();
    isAnimating = false;
    return;
  }

  const botMoves = getValidMoves(boardState, 2);
  if (botMoves.length === 0) {
    const myMoves = getValidMoves(boardState, 1);
    if (myMoves.length === 0) {
      endBotGame();
      isAnimating = false;
      return;
    }
    setInfo('Bot has no moves — your turn again');
    setSubInfo('');
    showValidMoves(boardEl, myMoves);
    isAnimating = false;
    return;
  }

  currentPlayer = 2;
  setInfo('Bot is thinking…');
  setSubInfo('');
  isAnimating = false;

  const thinkTime = difficulty === 'easy' ? 350 : 600;
  setTimeout(doBotMove, thinkTime);
}

async function doBotMove() {
  if (!gameActive) return;
  isAnimating = true;
  clearValidMoves(boardEl);

  const [row, col] = chooseBotMove(boardState, difficulty);
  const flips = getFlips(boardState, row, col, 2);

  await animatePlaceAndFlip(boardEl, row, col, 2, flips);
  boardState = applyMove(boardState, row, col, 2);
  renderBoardFull(boardEl, boardState);
  updateScoreBar(scoreBarEl, boardState);

  if (isGameOver(boardState)) {
    endBotGame();
    isAnimating = false;
    return;
  }

  const playerMoves = getValidMoves(boardState, 1);
  if (playerMoves.length === 0) {
    const botMoves2 = getValidMoves(boardState, 2);
    if (botMoves2.length === 0) {
      endBotGame();
      isAnimating = false;
      return;
    }
    setInfo('You have no moves — bot plays again');
    setSubInfo('');
    currentPlayer = 2;
    isAnimating = false;
    setTimeout(doBotMove, 600);
    return;
  }

  currentPlayer = 1;
  showValidMoves(boardEl, playerMoves);
  setInfo('Your turn (Black)');
  setSubInfo('');
  isAnimating = false;
}

function endBotGame() {
  const winner = getWinner(boardState);
  const { p1, p2 } = countDiscs(boardState);
  gameActive = false;
  clearValidMoves(boardEl);
  if (sendBtn) sendBtn.disabled = true;

  if (winner === 0) {
    setInfo(`Draw! ${p1}–${p2}`);
    leaderboard.draws++;
  } else if (winner === 1) {
    highlightWinners(boardEl, boardState, 1);
    setInfo(`You win! ${p1}–${p2} 🎉`);
    leaderboard.player++;
  } else {
    highlightWinners(boardEl, boardState, 2);
    setInfo(`Bot wins! ${p2}–${p1} 🤖`);
    leaderboard.bot++;
  }
  setSubInfo('Press Restart to play again.');
  renderLeaderboard();
  startConfetti();
}

export async function restartBotGame() {
  if (isRestarting || isAnimating) return;
  isRestarting = true;

  pendingRow = -1;
  pendingCol = -1;
  pendingFlips = [];
  if (sendBtn) sendBtn.disabled = true;

  await animateRestart(boardEl);

  boardState = createStartBoard();
  currentPlayer = 1;
  gameActive = true;
  isAnimating = false;

  clearWinnerHighlight(boardEl);
  stopConfetti();
  initBoardElement(boardEl, false);
  boardEl.style.opacity = '1';
  renderBoardFull(boardEl, boardState);
  updateScoreBar(scoreBarEl, boardState);
  showValidMoves(boardEl, getValidMoves(boardState, 1));
  setInfo('Your turn (Black)');
  setSubInfo('');
  renderLeaderboard();

  setTimeout(() => { isRestarting = false; }, 200);
}

export function resetBotLeaderboard() {
  leaderboard.player = 0;
  leaderboard.bot = 0;
  leaderboard.draws = 0;
  renderLeaderboard();
}

function renderLeaderboard() {
  if (!leaderboardEl) return;
  const diffLabels = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert', impossible: 'Impossible' };
  leaderboardEl.classList.remove('lb-visible');
  leaderboardEl.innerHTML = `
    <div class="lb-row">
      <span class="lb-dot lb-dot-player"></span>
      <span class="lb-name">You</span>
      <span class="lb-score">${leaderboard.player}</span>
    </div>
    <div class="lb-divider"></div>
    <div class="lb-row">
      <span class="lb-dot lb-dot-bot"></span>
      <span class="lb-name">Bot <span class="lb-diff">${diffLabels[difficulty]}</span></span>
      <span class="lb-score">${leaderboard.bot}</span>
    </div>
    <div class="lb-divider"></div>
    <div class="lb-row lb-row-draws">
      <span class="lb-name">Draws</span>
      <span class="lb-score">${leaderboard.draws}</span>
    </div>
  `;
  requestAnimationFrame(() => leaderboardEl.classList.add('lb-visible'));
}

let infoTimeout = null;
function setInfo(text) {
  if (infoTimeout) { clearTimeout(infoTimeout); infoTimeout = null; }
  infoEl.style.opacity = '0';
  infoTimeout = setTimeout(() => {
    infoEl.textContent = text;
    infoEl.style.opacity = '1';
    infoTimeout = null;
  }, 180);
}

function setSubInfo(text) {
  subInfoEl.textContent = text;
  if (text) subInfoEl.classList.add('has-text');
  else subInfoEl.classList.remove('has-text');
}

const CORNER_WEIGHTS = [
  [120, -20, 20, 5, 5, 20, -20, 120],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [5, -5, 3, 3, 3, 3, -5, 5],
  [20, -5, 15, 3, 3, 15, -5, 20],
  [-20, -40, -5, -5, -5, -5, -40, -20],
  [120, -20, 20, 5, 5, 20, -20, 120],
];

function staticScore(board, player) {
  const opp = player === 1 ? 2 : 1;
  let score = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === player) score += CORNER_WEIGHTS[r][c];
      else if (board[r][c] === opp) score -= CORNER_WEIGHTS[r][c];
    }
  }
  const myMoves = getValidMoves(board, player).length;
  const oppMoves = getValidMoves(board, opp).length;
  score += 10 * (myMoves - oppMoves);
  return score;
}

function minimax(board, depth, alpha, beta, maximizing, player) {
  if (depth === 0 || isGameOver(board)) {
    return { score: staticScore(board, player) };
  }
  const current = maximizing ? player : (player === 1 ? 2 : 1);
  const moves = getValidMoves(board, current);
  if (moves.length === 0) {
    return minimax(board, depth - 1, alpha, beta, !maximizing, player);
  }
  let best = maximizing ? { score: -Infinity } : { score: Infinity };
  for (const [r, c] of moves) {
    const next = applyMove(board, r, c, current);
    const result = minimax(next, depth - 1, alpha, beta, !maximizing, player);
    if (maximizing) {
      if (result.score > best.score) best = { score: result.score, row: r, col: c };
      alpha = Math.max(alpha, best.score);
    } else {
      if (result.score < best.score) best = { score: result.score, row: r, col: c };
      beta = Math.min(beta, best.score);
    }
    if (alpha >= beta) break;
  }
  return best;
}

function chooseBotMove(board, diff) {
  const moves = getValidMoves(board, 2);
  if (moves.length === 0) return null;
  const rand = () => moves[Math.floor(Math.random() * moves.length)];

  if (diff === 'easy') {
    if (Math.random() < 0.75) return rand();
    const r = minimax(board, 2, -Infinity, Infinity, true, 2);
    return r.row !== undefined ? [r.row, r.col] : rand();
  }
  if (diff === 'medium') {
    if (Math.random() < 0.2) return rand();
    const r = minimax(board, 3, -Infinity, Infinity, true, 2);
    return r.row !== undefined ? [r.row, r.col] : rand();
  }
  if (diff === 'hard') {
    const r = minimax(board, 5, -Infinity, Infinity, true, 2);
    return r.row !== undefined ? [r.row, r.col] : rand();
  }
  if (diff === 'expert') {
    const r = minimax(board, 7, -Infinity, Infinity, true, 2);
    return r.row !== undefined ? [r.row, r.col] : rand();
  }
  const r = minimax(board, 9, -Infinity, Infinity, true, 2);
  return r.row !== undefined ? [r.row, r.col] : rand();
}