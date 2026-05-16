import { applySystemTheme } from '../core/theme.js';
import { initPageFadeIn, navigateTo } from '../core/transition.js';
import { initConfetti, resizeConfetti } from '../components/confetti.js';
import { stopConfetti } from '../components/confetti.js';
import {
  initOnlineRefs, loadGameSession, clearGameSession,
  startOnlineGame, handleOnlineHover, handleOnlineSelect, commitOnlineMove,
  cancelPendingMove, requestOnlineRestart, leaveOnlineGame, clearOnlineBoard
} from '../modes/online.js';
import { initBoardElement } from '../components/board.js';
import { waitForAuth } from '../core/firebase.js';
import { sendIcon } from '../core/icons.js';

function addTouchHover(selector) {
  document.querySelectorAll(selector).forEach(el => {
    el.addEventListener('touchstart', () => el.classList.add('hover'), { passive: true });
    const rem = () => el.classList.remove('hover');
    el.addEventListener('touchend', rem, { passive: true });
    el.addEventListener('touchcancel', rem, { passive: true });
    el.addEventListener('touchmove', rem, { passive: true });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  applySystemTheme();
  initPageFadeIn();
  initConfetti();

  const boardEl = document.getElementById('board');
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.insertAdjacentHTML('afterbegin', sendIcon);

  initOnlineRefs({
    boardEl,
    infoEl: document.getElementById('info'),
    subInfoEl: document.getElementById('sub-info'),
    restartBtn: document.getElementById('restart-btn'),
    statusEl: null,
    leaderboardEl: document.getElementById('leaderboard'),
    scoreBarEl: document.getElementById('score-bar'),
    sendBtn,
  });

  try {
    await waitForAuth();
  } catch (err) {
    console.error('Auth failed:', err);
    navigateTo('../../');
    return;
  }

  const sessionLoaded = loadGameSession();
  if (!sessionLoaded) { navigateTo('../../'); return; }

  clearGameSession();

  boardEl.style.display = 'grid';
  initBoardElement(boardEl, true);
  startOnlineGame();

  document.getElementById('leave-btn').addEventListener('click', async () => {
    await leaveOnlineGame();
    stopConfetti();
    clearOnlineBoard();
    navigateTo('../../');
  });

  document.getElementById('restart-btn').addEventListener('click', () => requestOnlineRestart());

  if (sendBtn) sendBtn.addEventListener('click', () => commitOnlineMove());

  document.addEventListener('pointerdown', e => {
    if (!boardEl.contains(e.target) && !sendBtn?.contains(e.target)) cancelPendingMove();
  });

  boardEl.addEventListener('mouseover', e => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    handleOnlineHover(Number(cell.dataset.row), Number(cell.dataset.col));
  });

  boardEl.addEventListener('mouseleave', () => handleOnlineHover(-1, -1));

  boardEl.addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    handleOnlineSelect(Number(cell.dataset.row), Number(cell.dataset.col));
  });

  window.addEventListener('resize', resizeConfetti);
  addTouchHover('.secondary-button, .leave-button, .send-btn');
});