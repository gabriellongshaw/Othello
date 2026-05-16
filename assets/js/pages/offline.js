import { applySystemTheme } from '../core/theme.js';
import { initPageFadeIn, navigateTo } from '../core/transition.js';
import { initConfetti, resizeConfetti } from '../components/confetti.js';
import {
  initOfflineRefs, startOfflineGame,
  handleOfflineHover, handleOfflineSelect, commitMove,
  cancelOfflineMove, restartOfflineGame, clearOfflineBoard
} from '../modes/offline.js';
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

document.addEventListener('DOMContentLoaded', () => {
  applySystemTheme();
  initPageFadeIn();
  initConfetti();

  const boardEl = document.getElementById('board');
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.insertAdjacentHTML('afterbegin', sendIcon);

  initOfflineRefs({
    boardEl,
    infoEl: document.getElementById('info'),
    subInfoEl: document.getElementById('sub-info'),
    restartBtn: document.getElementById('restart-btn'),
    leaderboardEl: document.getElementById('leaderboard'),
    scoreBarEl: document.getElementById('score-bar'),
    sendBtn,
  });

  boardEl.style.display = 'grid';
  startOfflineGame();

  document.getElementById('leave-btn').addEventListener('click', () => {
    clearOfflineBoard();
    navigateTo('../');
  });

  document.getElementById('restart-btn').addEventListener('click', () => restartOfflineGame());

  if (sendBtn) sendBtn.addEventListener('click', () => commitMove());

  document.addEventListener('pointerdown', e => {
    if (!boardEl.contains(e.target) && !sendBtn?.contains(e.target)) cancelOfflineMove();
  });

  boardEl.addEventListener('mouseover', e => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    handleOfflineHover(Number(cell.dataset.row), Number(cell.dataset.col));
  });

  boardEl.addEventListener('mouseleave', () => handleOfflineHover(-1, -1));

  boardEl.addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    handleOfflineSelect(Number(cell.dataset.row), Number(cell.dataset.col));
  });

  window.addEventListener('resize', resizeConfetti);
  addTouchHover('.secondary-button, .leave-button, .send-btn');
});