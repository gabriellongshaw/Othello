import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  deleteDoc, onSnapshot, query, where
} from 'https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js';

import { db, auth } from '../core/firebase.js';
import { generateCode } from '../core/utils.js';
import {
  SIZE, createStartBoard, flattenBoard, unflattenBoard,
  getValidMoves, getFlips, applyMove,
  countDiscs, isGameOver, getWinner,
  initBoardElement, renderBoardFull, showValidMoves, clearValidMoves,
  showPreview, clearPreview,
  animatePlaceAndFlip, highlightWinners, clearWinnerHighlight,
  animateRestart, updateScoreBar
} from '../components/board.js';
import { startConfetti, stopConfetti } from '../components/confetti.js';

const gamesRef = collection(db, 'othello_games');

let gameId = null;
let playerNumber = 0;
let boardState = createStartBoard();
let currentPlayer = 1;
let gameActive = false;
let isAnimating = false;
let unsubGame = null;
let unsubWaiting = null;
let isSelfLeaving = false;
let isRestarting = false;
let pendingMoveFlat = null;

let pendingRow = -1;
let pendingCol = -1;
let pendingFlips = [];

let boardEl, infoEl, subInfoEl, restartBtn, statusEl, leaderboardEl, scoreBarEl, sendBtn;

export const leaderboard = { p1: 0, p2: 0, draws: 0 };

export function initOnlineRefs(els) {
  boardEl = els.boardEl;
  infoEl = els.infoEl;
  subInfoEl = els.subInfoEl;
  restartBtn = els.restartBtn;
  statusEl = els.statusEl;
  leaderboardEl = els.leaderboardEl;
  scoreBarEl = els.scoreBarEl;
  sendBtn = els.sendBtn;
}

export async function createGame(onWaiting, onGameStart) {
  setStatus('Creating game…');
  const code = generateCode(7);
  try {
    const ref = await addDoc(gamesRef, {
      code,
      player1: auth.currentUser?.uid ?? "anonymous",
      player2: null,
      board: flattenBoard(createStartBoard()),
      currentPlayer: 1,
      status: 'waiting',
      winner: 0,
      draw: false,
      restartRequest: false,
      leftGame: false,
    });
    gameId = ref.id;
    playerNumber = 1;
    setStatus('');
    onWaiting(code);
    waitForOpponent(onGameStart);
  } catch (err) {
    setStatus('Could not create game. Please try again.', true);
    console.error(err);
  }
}

export async function joinGame(code, onGameStart, onError) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) { onError?.('Please enter a room code.'); return; }
  onError?.('Joining…');
  try {
    const q = query(gamesRef, where('code', '==', trimmed));
    const snap = await getDocs(q);
    if (snap.empty) { onError?.('Game not found. Check the code and try again.'); return; }
    const docSnap = snap.docs[0];
    const data = docSnap.data();
    if (auth.currentUser && data.player1 === auth.currentUser.uid) { onError?.('You created this game — share the code with a friend!'); return; }
    if (data.player2 && auth.currentUser && data.player2 !== auth.currentUser.uid) { onError?.('This game already has two players.'); return; }
    if (data.status === 'finished') { onError?.('This game has already ended.'); return; }
    gameId = docSnap.id;
    playerNumber = 2;
    await updateDoc(doc(db, 'othello_games', gameId), { player2: auth.currentUser?.uid ?? "anonymous", status: 'playing' });
    onError?.('');
    onGameStart();
    startOnlineGame();
  } catch (err) {
    onError?.('Error joining game. Please try again.');
    console.error(err);
  }
}

function waitForOpponent(onGameStart) {
  if (unsubWaiting) { unsubWaiting(); unsubWaiting = null; }
  if (!gameId) return;
  unsubWaiting = onSnapshot(doc(db, 'othello_games', gameId), snap => {
    if (!snap.exists()) { unsubWaiting?.(); unsubWaiting = null; return; }
    if (snap.data().status === 'playing') {
      unsubWaiting?.(); unsubWaiting = null;
      onGameStart();
      startOnlineGame();
    }
  });
}

export function startOnlineGame() {
  boardState = createStartBoard();
  currentPlayer = 1;
  gameActive = true;
  isAnimating = false;
  isSelfLeaving = false;
  isRestarting = false;
  pendingMoveFlat = null;
  pendingRow = -1; pendingCol = -1; pendingFlips = [];

  clearWinnerHighlight(boardEl);
  stopConfetti();
  setRestartVisible(false);
  if (sendBtn) sendBtn.disabled = true;
  boardEl.style.opacity = '1';
  renderBoardFull(boardEl, boardState);
  updateScoreBar(scoreBarEl, boardState);

  if (playerNumber === 1) {
    showValidMoves(boardEl, getValidMoves(boardState, 1));
    setInfo('Your turn! (Black)');
  } else {
    setInfo('Waiting for opponent… (White)');
  }
  setSubInfo('');
  renderLeaderboard();
  subscribeToGame();
}

export function handleOnlineHover(row, col) {
  if (!gameActive || isAnimating || currentPlayer !== playerNumber) return;
  if (row === -1 || pendingRow !== -1) {
    if (pendingRow === -1) showPreview(boardEl, -1, -1, [], playerNumber);
    return;
  }
  const flips = getFlips(boardState, row, col, playerNumber);
  if (flips.length === 0) { showPreview(boardEl, -1, -1, [], playerNumber); return; }
  showPreview(boardEl, row, col, flips, playerNumber);
}

export function handleOnlineSelect(row, col) {
  if (!gameActive || isAnimating || currentPlayer !== playerNumber) return;
  const flips = getFlips(boardState, row, col, playerNumber);
  if (flips.length === 0) return;
  if (pendingRow === row && pendingCol === col) return;

  pendingRow = row;
  pendingCol = col;
  pendingFlips = flips;

  showPreview(boardEl, row, col, flips, playerNumber);
  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.removeAttribute('disabled');
  }
  setSubInfo('Click Send to confirm, or pick a different square.');
}

export async function commitOnlineMove() {
  if (!gameActive || isAnimating || pendingRow === -1 || currentPlayer !== playerNumber || !gameId) return;
  const row = pendingRow; const col = pendingCol; const flips = pendingFlips;
  pendingRow = -1; pendingCol = -1; pendingFlips = [];
  if (sendBtn) sendBtn.disabled = true;
  setSubInfo('');

  isAnimating = true;
  clearValidMoves(boardEl);
  clearPreview(boardEl);

  await animatePlaceAndFlip(boardEl, row, col, playerNumber, flips);
  boardState = applyMove(boardState, row, col, playerNumber);
  renderBoardFull(boardEl, boardState);
  updateScoreBar(scoreBarEl, boardState);

  const gameOver = isGameOver(boardState);
  const winner = gameOver ? getWinner(boardState) : 0;
  const draw = gameOver && winner === 0;
  const nextPlayer = playerNumber === 1 ? 2 : 1;
  const newFlat = flattenBoard(boardState);

  if (gameOver) {
    gameActive = false;
    if (!draw) highlightWinners(boardEl, boardState, winner);
    startConfetti();
    const { p1, p2 } = countDiscs(boardState);
    if (draw) setInfo(`Draw! ${p1}–${p2}`);
    else if (winner === playerNumber) setInfo(`You win! ${winner === 1 ? p1 : p2}–${winner === 1 ? p2 : p1} 🎉`);
    else setInfo(`You lost! ${winner === 1 ? p1 : p2}–${winner === 1 ? p2 : p1}`);
    setSubInfo(playerNumber === 1 ? 'You can restart the game below.' : 'Player 1 (host) can restart the game.');
    if (playerNumber === 1) setRestartVisible(true);
  } else {
    setInfo("Opponent's turn…");
    setSubInfo('');
  }
  isAnimating = false;

  try {
    const nextMoves = !gameOver ? getValidMoves(boardState, nextPlayer) : [];
    const effectiveNext = (nextMoves.length === 0 && !gameOver) ? playerNumber : nextPlayer;
    await updateDoc(doc(db, 'othello_games', gameId), {
      board: newFlat,
      currentPlayer: gameOver ? currentPlayer : effectiveNext,
      status: gameOver ? 'finished' : 'playing',
      winner: winner,
      draw: draw,
    });
    pendingMoveFlat = newFlat;
  } catch (err) {
    console.error('Move update failed:', err);
  }
}

function subscribeToGame() {
  if (unsubGame) { unsubGame(); unsubGame = null; }
  if (!gameId) return;

  unsubGame = onSnapshot(doc(db, 'othello_games', gameId), async snap => {
    if (!snap.exists()) { if (!isSelfLeaving) opponentLeft(); return; }
    const data = snap.data();
    if (data.leftGame === true) { if (!isSelfLeaving) opponentLeft(); return; }
    if (data.restartRequest === true) { await handleRemoteRestart(data); return; }

    const newFlat = data.board;
    const oldFlat = flattenBoard(boardState);

    if (pendingMoveFlat !== null) {
      const isMine = newFlat.every((v, i) => v === pendingMoveFlat[i]);
      pendingMoveFlat = null;
      if (isMine) return;
    }

    let changedIdx = -1;
    for (let i = 0; i < newFlat.length; i++) {
      if (oldFlat[i] !== newFlat[i]) { changedIdx = i; break; }
    }

    const newBoard = unflattenBoard(newFlat);

    if (changedIdx !== -1 && !isAnimating && !isRestarting) {
      const opRow = Math.floor(changedIdx / SIZE);
      const opCol = changedIdx % SIZE;
      const opPlayer = newFlat[changedIdx];
      if (opPlayer === 1 || opPlayer === 2) {
        const opFlips = [];
        for (let i = 0; i < newFlat.length; i++) {
          if (oldFlat[i] !== newFlat[i] && i !== changedIdx) {
            opFlips.push([Math.floor(i / SIZE), i % SIZE]);
          }
        }
        isAnimating = true;
        await animatePlaceAndFlip(boardEl, opRow, opCol, opPlayer, opFlips);
        isAnimating = false;
      }
    }

    boardState = newBoard;
    currentPlayer = data.currentPlayer;
    renderBoardFull(boardEl, boardState);
    updateScoreBar(scoreBarEl, boardState);

    if (data.status === 'finished') {
      gameActive = false;
      clearValidMoves(boardEl);
      if (sendBtn) sendBtn.disabled = true;
      const winner = data.winner;
      const { p1, p2 } = countDiscs(boardState);
      if (winner !== 0) {
        highlightWinners(boardEl, boardState, winner);
        if (winner === playerNumber) { leaderboard[playerNumber === 1 ? 'p1' : 'p2']++; startConfetti(); setInfo(`You win! 🎉`); }
        else { leaderboard[playerNumber === 1 ? 'p2' : 'p1']++; setInfo(`You lost!`); }
      } else {
        leaderboard.draws++;
        startConfetti();
        setInfo(`Draw! ${p1}–${p2}`);
      }
      renderLeaderboard();
      setSubInfo(playerNumber === 1 ? 'You can restart the game below.' : 'Player 1 (host) can restart the game.');
      if (playerNumber === 1) setRestartVisible(true);
      return;
    }

    clearWinnerHighlight(boardEl);
    gameActive = true;

    if (currentPlayer === playerNumber) {
      const myMoves = getValidMoves(boardState, playerNumber);
      if (myMoves.length > 0) {
        showValidMoves(boardEl, myMoves);
        setInfo('Your turn!');
      } else {
        setInfo('No valid moves — skipping your turn');
      }
    } else {
      clearValidMoves(boardEl);
      setInfo("Opponent's turn…");
    }
    setSubInfo('');
  });
}

export async function requestOnlineRestart() {
  if (playerNumber !== 1 || !gameId) return;
  try {
    setRestartVisible(false);
    clearWinnerHighlight(boardEl);
    stopConfetti();
    await updateDoc(doc(db, 'othello_games', gameId), { restartRequest: true });
  } catch (err) {
    console.error('Restart failed:', err);
    setRestartVisible(true);
  }
}

async function handleRemoteRestart(data) {
  if (playerNumber === 1) {
    try {
      await animateRestart(boardEl);
      boardState = createStartBoard();
      currentPlayer = 1;
      gameActive = true;
      isAnimating = false;
      isRestarting = false;
      pendingMoveFlat = null;
      pendingRow = -1; pendingCol = -1; pendingFlips = [];
      if (sendBtn) sendBtn.disabled = true;
      clearWinnerHighlight(boardEl);
      initBoardElement(boardEl, false);
      boardEl.style.opacity = '1';
      renderBoardFull(boardEl, boardState);
      updateScoreBar(scoreBarEl, boardState);
      showValidMoves(boardEl, getValidMoves(boardState, 1));
      setInfo('Your turn! (Black)');
      setSubInfo('');
      renderLeaderboard();
      await updateDoc(doc(db, 'othello_games', gameId), {
        restartRequest: false,
        board: flattenBoard(createStartBoard()),
        currentPlayer: 1,
        status: 'playing',
        winner: 0,
        draw: false,
      });
    } catch (err) { console.error('Restart reset failed:', err); }
    return;
  }

  isRestarting = true;
  clearWinnerHighlight(boardEl);
  stopConfetti();
  if (sendBtn) sendBtn.disabled = true;
  setInfo('Opponent is restarting…');
  setSubInfo('');

  await new Promise(r => setTimeout(r, 600));
  await animateRestart(boardEl);

  boardState = createStartBoard();
  currentPlayer = 1;
  gameActive = false;
  isAnimating = false;
  pendingMoveFlat = null;
  pendingRow = -1; pendingCol = -1; pendingFlips = [];
  initBoardElement(boardEl, false);
  boardEl.style.opacity = '1';
  renderBoardFull(boardEl, boardState);
  updateScoreBar(scoreBarEl, boardState);
  setRestartVisible(false);
  setInfo('Waiting for opponent…');
  setSubInfo('');
  await new Promise(r => setTimeout(r, 200));
  isRestarting = false;
}

function opponentLeft() {
  gameActive = false;
  stopConfetti();
  setRestartVisible(false);
  if (sendBtn) sendBtn.disabled = true;
  setInfo('Your opponent left the game.');
  setSubInfo('');
}

export function clearOnlineBoard() {
  gameActive = false;
  isAnimating = false;
  if (boardEl) boardEl.innerHTML = '';
}

export async function leaveOnlineGame() {
  isSelfLeaving = true;
  if (unsubGame) { unsubGame(); unsubGame = null; }
  if (gameId) {
    try {
      const snap = await getDoc(doc(db, 'othello_games', gameId));
      if (snap.exists()) {
        const data = snap.data();
        if (auth.currentUser && data.player1 === auth.currentUser.uid) await deleteDoc(doc(db, 'othello_games', gameId));
        else await updateDoc(doc(db, 'othello_games', gameId), { leftGame: true });
      }
    } catch (err) { console.error('Leave error:', err); }
  }
  gameId = null; playerNumber = 0;
  boardState = createStartBoard();
  gameActive = false;
  leaderboard.p1 = 0; leaderboard.p2 = 0; leaderboard.draws = 0;
}

export async function cancelWaiting() {
  if (unsubWaiting) { unsubWaiting(); unsubWaiting = null; }
  if (unsubGame) { unsubGame(); unsubGame = null; }
  if (gameId) { try { await deleteDoc(doc(db, 'othello_games', gameId)); } catch (_) {} }
  gameId = null;
  playerNumber = 0;
  gameActive = false;
  isAnimating = false;
  isSelfLeaving = false;
  isRestarting = false;
  pendingMoveFlat = null;
  pendingRow = -1; pendingCol = -1; pendingFlips = [];
}

export function saveGameSession() {
  if (gameId && playerNumber) {
    sessionStorage.setItem('ot_gameId', gameId);
    sessionStorage.setItem('ot_playerNumber', String(playerNumber));
  }
}

export function loadGameSession() {
  const id = sessionStorage.getItem('ot_gameId');
  const num = sessionStorage.getItem('ot_playerNumber');
  if (id && num) { gameId = id; playerNumber = Number(num); return true; }
  return false;
}

export function clearGameSession() {
  sessionStorage.removeItem('ot_gameId');
  sessionStorage.removeItem('ot_playerNumber');
}

function renderLeaderboard() {
  if (!leaderboardEl) return;
  leaderboardEl.classList.remove('lb-visible');
  leaderboardEl.innerHTML = `
    <div class="lb-row">
      <span class="lb-dot lb-dot-player"></span>
      <span class="lb-name">Player 1</span>
      <span class="lb-score">${leaderboard.p1}</span>
    </div>
    <div class="lb-divider"></div>
    <div class="lb-row">
      <span class="lb-dot lb-dot-player2"></span>
      <span class="lb-name">Player 2</span>
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
function setStatus(text, isError = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  if (isError) statusEl.classList.add('status-error');
  else statusEl.classList.remove('status-error');
}
function setRestartVisible(visible) {
  restartBtn.style.display = visible ? 'inline-flex' : 'none';
}