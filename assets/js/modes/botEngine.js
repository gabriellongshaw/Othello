const N = 8;
const CELLS = N * N;

const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

const RAYS = Array.from({ length: CELLS }, (_, i) => {
  const r0 = Math.floor(i / N), c0 = i % N;
  return DIRS.map(([dr, dc]) => {
    const ray = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < N && c >= 0 && c < N) { ray.push(r * N + c); r += dr; c += dc; }
    return ray;
  }).filter(ray => ray.length > 1);
});

const WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];

const CORNERS = [
  { corner: 0, near: [1, 8, 9] },
  { corner: 7, near: [6, 15, 14] },
  { corner: 56, near: [48, 57, 49] },
  { corner: 63, near: [55, 62, 54] },
];

export function toFlat(board) {
  const flat = new Int8Array(CELLS);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) flat[r * N + c] = board[r][c];
  return flat;
}

function flipsAt(b, idx, p) {
  const opp = 3 - p;
  let out = null;
  const rays = RAYS[idx];
  for (let d = 0; d < rays.length; d++) {
    const ray = rays[d];
    let k = 0;
    while (k < ray.length && b[ray[k]] === opp) k++;
    if (k > 0 && k < ray.length && b[ray[k]] === p) {
      if (!out) out = [];
      for (let j = 0; j < k; j++) out.push(ray[j]);
    }
  }
  return out;
}

function genMoves(b, p) {
  const moves = [];
  for (let i = 0; i < CELLS; i++) {
    if (b[i] !== 0) continue;
    const flips = flipsAt(b, i, p);
    if (flips) moves.push({ idx: i, flips });
  }
  return moves;
}

function countMoves(b, p) {
  let n = 0;
  for (let i = 0; i < CELLS; i++) if (b[i] === 0 && flipsAt(b, i, p)) n++;
  return n;
}

function play(b, move, p) {
  const next = b.slice();
  next[move.idx] = p;
  for (let i = 0; i < move.flips.length; i++) next[move.flips[i]] = p;
  return next;
}

function discDiff(b, p) {
  let s = 0;
  for (let i = 0; i < CELLS; i++) s += b[i] === p ? 1 : b[i] === 3 - p ? -1 : 0;
  return s;
}

function evaluate(b, p) {
  const opp = 3 - p;
  let score = 0;
  let empties = 0;
  for (let i = 0; i < CELLS; i++) {
    const v = b[i];
    if (v === 0) { empties++; continue; }
    let w = WEIGHTS[i];
    if (w < 0) {
      for (const { corner, near } of CORNERS) {
        if (b[corner] !== 0 && near.includes(i)) { w = 0; break; }
      }
    }
    score += v === p ? w : -w;
  }
  const mine = countMoves(b, p);
  const theirs = countMoves(b, opp);
  score += 12 * (mine - theirs);
  if (empties < 16) score += (16 - empties) * 2 * discDiff(b, p);
  return score;
}

class Timeout extends Error {}

function search(ctx, b, p, depth, alpha, beta, passed) {
  if ((++ctx.nodes & 511) === 0 && performance.now() > ctx.deadline) throw new Timeout();

  const moves = genMoves(b, p);
  if (moves.length === 0) {
    if (passed) return discDiff(b, p) * 1000;
    return -search(ctx, b, 3 - p, depth, -beta, -alpha, true);
  }
  if (depth === 0) return evaluate(b, p);

  moves.sort((a, c) => WEIGHTS[c.idx] - WEIGHTS[a.idx]);

  let best = -Infinity;
  for (const m of moves) {
    const v = -search(ctx, play(b, m, p), 3 - p, depth - 1, -beta, -alpha, false);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function findBestMove(board, player, { maxDepth = 8, timeMs = 1000 } = {}) {
  const b = toFlat(board);
  const rootMoves = genMoves(b, player);
  if (rootMoves.length === 0) return null;
  if (rootMoves.length === 1) return [Math.floor(rootMoves[0].idx / N), rootMoves[0].idx % N];

  let empties = 0;
  for (let i = 0; i < CELLS; i++) if (b[i] === 0) empties++;

  rootMoves.sort((a, c) => WEIGHTS[c.idx] - WEIGHTS[a.idx]);
  let bestIdx = rootMoves[0].idx;

  const ctx = { nodes: 0, deadline: performance.now() + timeMs };
  const limit = Math.min(empties, maxDepth);

  try {
    for (let depth = 1; depth <= limit; depth++) {
      let alpha = -Infinity;
      let depthBest = rootMoves[0];
      for (const m of rootMoves) {
        const v = -search(ctx, play(b, m, player), 3 - player, depth - 1, -Infinity, -alpha, false);
        if (v > alpha) { alpha = v; depthBest = m; }
      }
      bestIdx = depthBest.idx;
      const i = rootMoves.indexOf(depthBest);
      rootMoves.splice(i, 1);
      rootMoves.unshift(depthBest);
    }
  } catch (e) {
    if (!(e instanceof Timeout)) throw e;
  }

  return [Math.floor(bestIdx / N), bestIdx % N];
}