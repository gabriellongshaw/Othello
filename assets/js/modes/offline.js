import {
  SIZE, createStartBoard, getValidMoves, getFlips, applyMove,
  countDiscs, isGameOver, getWinner,
  initBoardElement, renderBoardFull, showValidMoves, clearValidMoves,
  showPreview, clearPreview,
  animatePlaceAndFlip, highlightWinners, clearWinnerHighlight,
  animateRestart, updateScoreBar
} from '../components/board.js';
import { startConfetti, stopConfetti } from '../components/confetti.js';

const NAMES = { 1: 'Black', 2: 'White' };

let boardState = createStartBoard();
let currentPlayer = 1;
let gameActive = false;
let isAnimating = false;
let isRestarting = false;
let firstInit = true;

let pendingRow = -1;
let pendingCol = -1;
let pendingFlips = [];

let boardEl, infoEl, subInfoEl, restartBtn, leaderboardEl, scoreBarEl, sendBtn;

export const leaderboard = { p1: 0, p2: 0, draws: 0 };

export function initOfflineRefs(els) {
  boardEl = els.boardEl;
  infoEl = els.infoEl;
  subInfoEl = els.subInfoEl;
  restartBtn = els.restartBtn;
  leaderboardEl = els.leaderboardEl;
  scoreBarEl = els.scoreBarEl;
  sendBtn = els.sendBtn;
}

export function clearOfflineBoard() {
  gameActive = false;
  isAnimating = false;
  pendingRow = -1;
  pendingCol = -1;
  pendingFlips = [];
  if (boardEl) boardEl.innerHTML = '';
}

export function startOfflineGame() {
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

  const moves = getValidMoves(boardState, currentPlayer);
  showValidMoves(boardEl, moves);
  updateScoreBar(scoreBarEl, boardState);

  restartBtn.style.display = 'inline-flex';
  if (sendBtn) sendBtn.disabled = true;
  setInfo(`Black's turn`);
  setSubInfo('');
  renderLeaderboard();
}

export function handleOfflineHover(row, col) {
  if (!gameActive || isAnimating) return;
  if (row === -1 || pendingRow !== -1) {
    if (pendingRow === -1) showPreview(boardEl, -1, -1, [], currentPlayer);
    return;
  }
  const flips = getFlips(boardState, row, col, currentPlayer);
  if (flips.length === 0) {
    showPreview(boardEl, -1, -1, [], currentPlayer);
    return;
  }
  showPreview(boardEl, row, col, flips, currentPlayer);
}

export function handleOfflineSelect(row, col) {
  if (!gameActive || isAnimating) return;
  const flips = getFlips(boardState, row, col, currentPlayer);
  if (flips.length === 0) return;

  if (pendingRow === row && pendingCol === col) return;

  pendingRow = row;
  pendingCol = col;
  pendingFlips = flips;

  showPreview(boardEl, row, col, flips, currentPlayer);

  if (sendBtn) sendBtn.disabled = false;
  setSubInfo('Click Send to confirm, or pick a different square.');
}

export async function commitMove() {
  if (!gameActive || isAnimating || pendingRow === -1) return;
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
  clearPreview(boardEl);

  await animatePlaceAndFlip(boardEl, row, col, currentPlayer, flips);
  boardState = applyMove(boardState, row, col, currentPlayer);
  renderBoardFull(boardEl, boardState);
  updateScoreBar(scoreBarEl, boardState);

  if (isGameOver(boardState)) {
    endGame();
    isAnimating = false;
    return;
  }

  const next = currentPlayer === 1 ? 2 : 1;
  const nextMoves = getValidMoves(boardState, next);

  if (nextMoves.length === 0) {
    const sameMoves = getValidMoves(boardState, currentPlayer);
    if (sameMoves.length === 0) {
      endGame();
      isAnimating = false;
      return;
    }
    setInfo(`${NAMES[next]} has no moves — ${NAMES[currentPlayer]} plays again`);
    setSubInfo('');
    showValidMoves(boardEl, sameMoves);
    isAnimating = false;
    return;
  }

  currentPlayer = next;
  showValidMoves(boardEl, nextMoves);
  setInfo(`${NAMES[currentPlayer]}'s turn`);
  isAnimating = false;
}

function endGame() {
  const winner = getWinner(boardState);
  const { p1, p2 } = countDiscs(boardState);
  gameActive = false;
  clearValidMoves(boardEl);
  if (sendBtn) sendBtn.disabled = true;

  if (winner === 0) {
    setInfo(`Draw! ${p1}–${p2}`);
    leaderboard.draws++;
  } else {
    highlightWinners(boardEl, boardState, winner);
    setInfo(`${NAMES[winner]} wins! ${winner === 1 ? p1 : p2}–${winner === 1 ? p2 : p1}`);
    if (winner === 1) leaderboard.p1++;
    else leaderboard.p2++;
  }
  setSubInfo('Press Restart to play again.');
  renderLeaderboard();
  startConfetti();
}

export async function restartOfflineGame() {
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
  setInfo(`Black's turn`);
  setSubInfo('');
  renderLeaderboard();

  setTimeout(() => { isRestarting = false; }, 200);
}

function renderLeaderboard() {
  if (!leaderboardEl) return;
  leaderboardEl.classList.remove('lb-visible');
  leaderboardEl.innerHTML = `
    <div class="lb-row">
      <span class="lb-dot lb-dot-player"></span>
      <span class="lb-name">Black</span>
      <span class="lb-score">${leaderboard.p1}</span>
    </div>
    <div class="lb-divider"></div>
    <div class="lb-row">
      <span class="lb-dot lb-dot-player2"></span>
      <span class="lb-name">White</span>
      <span class="lb-score">${leaderboard.p2}</span>
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