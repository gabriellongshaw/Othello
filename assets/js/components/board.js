export const SIZE = 8;

export function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}
export function createStartBoard() {
  const b = createEmptyBoard();
  b[3][3] = 2; b[3][4] = 1;
  b[4][3] = 1; b[4][4] = 2;
  return b;
}
export function flattenBoard(board) { return board.flat(); }
export function unflattenBoard(flat) {
  return Array.from({ length: SIZE }, (_, r) => flat.slice(r * SIZE, (r + 1) * SIZE));
}

const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

export function getFlips(board, row, col, player) {
  if (board[row][col] !== 0) return [];
  const opp = player === 1 ? 2 : 1;
  const flips = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r][c] === opp) {
      line.push([r, c]); r += dr; c += dc;
    }
    if (line.length && r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[r][c] === player)
      flips.push(...line);
  }
  return flips;
}

export function getValidMoves(board, player) {
  const moves = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (board[r][c] === 0 && getFlips(board, r, c, player).length > 0)
        moves.push([r, c]);
  return moves;
}

export function applyMove(board, row, col, player) {
  const b = board.map(r => [...r]);
  const flips = getFlips(b, row, col, player);
  b[row][col] = player;
  for (const [r, c] of flips) b[r][c] = player;
  return b;
}

export function countDiscs(board) {
  let p1 = 0, p2 = 0;
  for (const row of board) for (const v of row) { if (v===1) p1++; else if (v===2) p2++; }
  return { p1, p2 };
}

export function isGameOver(board) {
  return getValidMoves(board,1).length === 0 && getValidMoves(board,2).length === 0;
}

export function getWinner(board) {
  const { p1, p2 } = countDiscs(board);
  if (p1 > p2) return 1; if (p2 > p1) return 2; return 0;
}

export function initBoardElement(boardEl, firstInit) {
  boardEl.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      if (firstInit) {
        cell.style.opacity = '0';
        setTimeout(() => { cell.style.transition = 'opacity 0.3s ease'; cell.style.opacity = '1'; }, 10);
      }
      boardEl.appendChild(cell);
    }
  }
}

function getCell(boardEl, r, c) {
  return boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
}

function createDiscEl(player) {
  const disc = document.createElement('div');
  disc.className = 'disc';
  const black = document.createElement('div');
  black.className = 'disc-inner disc-black';
  const white = document.createElement('div');
  white.className = 'disc-inner disc-white';
  disc.appendChild(black);
  disc.appendChild(white);
  if (player === 2) disc.style.transform = 'rotateY(180deg)';
  return disc;
}

function createGhostEl(player) {
  const wrapper = document.createElement('div');
  wrapper.className = 'disc-ghost-wrapper';
  const face = document.createElement('div');
  face.className = player === 1 ? 'disc-ghost-face disc-ghost-black' : 'disc-ghost-face disc-ghost-white';
  wrapper.appendChild(face);
  return wrapper;
}

function createWrapper(disc) {
  const w = document.createElement('div');
  w.className = 'disc-scale-wrapper';
  w.appendChild(disc);
  return w;
}

function getRealDisc(cell) {
  const wrapper = cell.querySelector('.disc-scale-wrapper');
  return wrapper ? wrapper.querySelector('.disc') : null;
}

export function renderBoardFull(boardEl, board) {
  clearPreview(boardEl);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = getCell(boardEl, r, c);
      if (!cell) continue;
      cell.classList.remove('valid-move');

      const val = board[r][c];
      const disc = getRealDisc(cell);

      if (val === 0) {
        if (disc) {
          const w = disc.closest('.disc-scale-wrapper');
          if (w) { w.style.transition = 'opacity 0.18s ease'; w.style.opacity = '0'; setTimeout(() => w.remove(), 200); }
        }
      } else {
        if (!disc) {
          const newDisc = createDiscEl(val);
          const w = createWrapper(newDisc);
          w.style.opacity = '0';
          cell.appendChild(w);
          requestAnimationFrame(() => {
            w.style.transition = 'opacity 0.18s ease';
            w.style.opacity = '1';
          });
        } else {
          if (!disc.classList.contains('is-flipping')) {
            const want = val === 2 ? 'rotateY(180deg)' : 'rotateY(0deg)';
            if (disc.style.transform !== want) disc.style.transform = want;
          }
        }
      }
    }
  }
}

export function showValidMoves(boardEl, moves) {
  boardEl.querySelectorAll('.cell.valid-move').forEach(c => c.classList.remove('valid-move'));
  for (const [r, c] of moves) {
    const cell = getCell(boardEl, r, c);
    if (cell) cell.classList.add('valid-move');
  }
}

export function clearValidMoves(boardEl) {
  boardEl.querySelectorAll('.cell.valid-move').forEach(c => c.classList.remove('valid-move'));
}

export function showPreview(boardEl, row, col, flips, player) {
  clearPreview(boardEl);
  if (row === -1) return;

  const placingCell = getCell(boardEl, row, col);
  if (placingCell) {
    placingCell.classList.add('preview-placing');
    const ghost = createGhostEl(player);
    placingCell.appendChild(ghost);
    ghost._cancelled = false;
    requestAnimationFrame(() => {
      if (!ghost._cancelled) ghost.classList.add('ghost-visible');
    });
  }

  const toWhite = player === 2;
  for (const [r, c] of flips) {
    const fc = getCell(boardEl, r, c);
    if (!fc) continue;
    const disc = getRealDisc(fc);
    if (!disc || disc.classList.contains('is-flipping')) continue;
    fc.classList.add('preview-flip');
    const origTransform = player === 1 ? 'rotateY(180deg)' : 'rotateY(0deg)';
    disc.dataset.origTransform = origTransform;
    if (!disc.style.transform) disc.style.transform = origTransform;
    disc.style.transition = 'transform 0.18s ease';
    void disc.offsetWidth;
    disc.style.transform = toWhite ? 'rotateY(180deg)' : 'rotateY(0deg)';
  }
}

export function clearPreview(boardEl) {
  boardEl.querySelectorAll('.disc-ghost-wrapper').forEach(gw => {
    gw._cancelled = true;
    gw.remove();
  });
  boardEl.querySelectorAll('.cell.preview-placing').forEach(c => c.classList.remove('preview-placing'));
  boardEl.querySelectorAll('.cell.preview-flip').forEach(cell => {
    cell.classList.remove('preview-flip');
    const disc = getRealDisc(cell);
    if (disc && disc.dataset.origTransform !== undefined) {
      disc.style.transition = 'transform 0.2s ease';
      disc.style.transform = disc.dataset.origTransform;
      delete disc.dataset.origTransform;
    }
  });
}

export async function animatePlaceAndFlip(boardEl, row, col, player, flips) {
  const cell = getCell(boardEl, row, col);
  if (!cell) return;

  cell.querySelectorAll('.disc-ghost-wrapper').forEach(g => g.remove());
  cell.classList.remove('preview-placing');

  const previewFlipped = new Set();
  boardEl.querySelectorAll('.cell.preview-flip').forEach(fc => {
    fc.classList.remove('preview-flip');
    const d = getRealDisc(fc);
    if (d) {
      delete d.dataset.origTransform;
      previewFlipped.add(d);
    }
  });

  const existingWrapper = cell.querySelector('.disc-scale-wrapper');
  if (existingWrapper) existingWrapper.remove();

  const disc = createDiscEl(player);
  const wrapper = createWrapper(disc);
  wrapper.classList.add('place-anim');
  cell.appendChild(wrapper);

  await new Promise(r => setTimeout(r, 260));
  wrapper.classList.remove('place-anim');

  const FLIP_DURATION = 320;
  const FLIP_STAGGER = 45;
  const toWhite = player === 2;
  const cls = toWhite ? 'flip-to-white' : 'flip-to-black';
  const finalTransform = toWhite ? 'rotateY(180deg)' : 'rotateY(0deg)';

  let animIdx = 0;
  for (let i = 0; i < flips.length; i++) {
    const [fr, fc] = flips[i];
    const fcell = getCell(boardEl, fr, fc);
    if (!fcell) continue;
    const fd = getRealDisc(fcell);
    if (!fd) continue;

    if (previewFlipped.has(fd)) continue;

    const delay = animIdx * FLIP_STAGGER;
    animIdx++;
    setTimeout(() => {
      fd.style.transition = 'none';
      fd.classList.remove('flip-to-white', 'flip-to-black', 'is-flipping');
      fd.style.transform = toWhite ? 'rotateY(0deg)' : 'rotateY(180deg)';
      void fd.offsetWidth;
      fd.classList.add('is-flipping', cls);
      const onDone = () => {
        fd.classList.remove('is-flipping', cls);
        fd.style.transform = finalTransform;
      };
      fd.addEventListener('animationend', onDone, { once: true });
      setTimeout(onDone, FLIP_DURATION + 50);
    }, delay);
  }

  const waitTime = animIdx > 0 ? (animIdx - 1) * FLIP_STAGGER + FLIP_DURATION + 60 : 0;
  await new Promise(r => setTimeout(r, waitTime));
}

export function highlightWinners(boardEl, board, winner) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === winner) {
        const disc = getRealDisc(getCell(boardEl, r, c));
        if (disc) disc.classList.add('winning-disc');
      }
    }
  }
}

export function clearWinnerHighlight(boardEl) {
  boardEl.querySelectorAll('.disc.winning-disc').forEach(d => d.classList.remove('winning-disc'));
}

export function animateRestart(boardEl) {
  return new Promise(resolve => {
    boardEl.classList.add('shake');
    boardEl.style.transition = 'opacity 350ms ease';
    boardEl.style.opacity = '0.2';
    setTimeout(() => {
      boardEl.style.opacity = '1';
      setTimeout(() => boardEl.classList.remove('shake'), 350);
      resolve();
    }, 480);
  });
}

export function updateScoreBar(barEl, board) {
  if (!barEl) return;
  const { p1, p2 } = countDiscs(board);
  const p1El = barEl.querySelector('.black-count');
  const p2El = barEl.querySelector('.white-count');

  function bumpCount(el, newVal) {
    if (!el) return;
    const old = el.textContent;
    el.textContent = newVal;
    if (String(old) !== String(newVal)) {
      void el.offsetWidth;
      el.style.animation = 'scoreBump 0.35s cubic-bezier(0.34,1.56,0.64,1)';
      el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
    }
  }

  bumpCount(p1El, p1);
  bumpCount(p2El, p2);
}