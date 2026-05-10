import { applySystemTheme } from '../core/theme.js';
import { initPageFadeIn, navigateTo } from '../core/transition.js';
import { initConfetti, resizeConfetti } from '../components/confetti.js';
import { stopConfetti } from '../components/confetti.js';
import {
  initBotRefs, setBotDifficulty, startBotGame,
  handleBotHover, handleBotSelect, commitBotMove,
  restartBotGame, resetBotLeaderboard, clearBotBoard
} from '../modes/bot.js';

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

  const params = new URLSearchParams(location.search);
  const difficulty = params.get('difficulty') || 'medium';

  const boardEl = document.getElementById('board');
  const sendBtn = document.getElementById('send-btn');

  initBotRefs({
    boardEl,
    infoEl: document.getElementById('info'),
    subInfoEl: document.getElementById('sub-info'),
    restartBtn: document.getElementById('restart-btn'),
    leaderboardEl: document.getElementById('leaderboard'),
    scoreBarEl: document.getElementById('score-bar'),
    sendBtn,
  });

  setBotDifficulty(difficulty);
  resetBotLeaderboard();
  boardEl.style.display = 'grid';
  startBotGame();

  document.getElementById('leave-btn').addEventListener('click', () => {
    stopConfetti();
    clearBotBoard();
    navigateTo('../../');
  });

  document.getElementById('restart-btn').addEventListener('click', () => restartBotGame());

  if (sendBtn) sendBtn.addEventListener('click', () => commitBotMove());

  boardEl.addEventListener('mouseover', e => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    handleBotHover(Number(cell.dataset.row), Number(cell.dataset.col));
  });

  boardEl.addEventListener('mouseleave', () => handleBotHover(-1, -1));

  boardEl.addEventListener('click', e => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    handleBotSelect(Number(cell.dataset.row), Number(cell.dataset.col));
  });

  window.addEventListener('resize', resizeConfetti);
  addTouchHover('.secondary-button, .leave-button, .send-btn');
});