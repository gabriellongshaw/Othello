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

const NEIGHBOURS = Array.from({ length: CELLS }, (_, i) => {
  const r0 = Math.floor(i / N), c0 = i % N;
  const out = [];
  for (const [dr, dc] of DIRS) {
    const r = r0 + dr, c = c0 + dc;
    if (r >= 0 && r < N && c >= 0 && c < N) out.push(r * N + c);
  }
  return out;
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

const CORNERS = [0, 7, 56, 63];

const CORNER_OF = new Int8Array(CELLS).fill(-1);
for (const [corner, squares] of [
  [0, [1, 8, 9]], [7, [6, 15, 14]], [56, [48, 57, 49]], [63, [55, 62, 54]],
]) {
  for (const s of squares) CORNER_OF[s] = corner;
}

const X_SQUARES = new Set([9, 14, 49, 54]);

const EDGE_RUNS = [];
for (const [corner, steps] of [[0, [1, 8]], [7, [-1, 8]], [56, [1, -8]], [63, [-1, -8]]]) {
  for (const step of steps) {
    const run = [];
    for (let k = 1; k <= 6; k++) run.push(corner + step * k);
    EDGE_RUNS.push({ corner, run });
  }
}

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

function stableEdgeDiscs(b, p) {
  let n = 0;
  for (const { corner, run } of EDGE_RUNS) {
    if (b[corner] !== p) continue;
    for (const idx of run) {
      if (b[idx] !== p) break;
      n++;
    }
  }
  return n;
}

function squareValue(b, i, p) {
  const w = WEIGHTS[i];
  if (w >= 0) return w;
  const corner = CORNER_OF[i];
  if (corner < 0 || b[corner] === 0) return w;
  return b[corner] === p ? 6 : 0;
}

function evaluate(b, p) {
  const opp = 3 - p;
  let positional = 0;
  let mine = 0, theirs = 0;
  let frontierMine = 0, frontierTheirs = 0;
  let empties = 0;

  for (let i = 0; i < CELLS; i++) {
    const v = b[i];
    if (v === 0) { empties++; continue; }
    const sign = v === p ? 1 : -1;
    positional += sign * squareValue(b, i, v);
    if (v === p) mine++; else theirs++;
    const nb = NEIGHBOURS[i];
    for (let k = 0; k < nb.length; k++) {
      if (b[nb[k]] === 0) { if (v === p) frontierMine++; else frontierTheirs++; break; }
    }
  }

  let cornersMine = 0, cornersTheirs = 0;
  for (let k = 0; k < 4; k++) {
    const v = b[CORNERS[k]];
    if (v === p) cornersMine++; else if (v === opp) cornersTheirs++;
  }

  const myMoves = genMoves(b, p);
  const theirMoves = genMoves(b, opp);
  let myCornerMoves = 0, theirCornerMoves = 0;
  for (const m of myMoves) if (WEIGHTS[m.idx] === 120) myCornerMoves++;
  for (const m of theirMoves) if (WEIGHTS[m.idx] === 120) theirCornerMoves++;

  const mobilityWeight = empties > 20 ? 10 : 6;
  let score = positional;
  score += 90 * (cornersMine - cornersTheirs);
  score += 30 * (myCornerMoves - theirCornerMoves);
  score += 20 * (stableEdgeDiscs(b, p) - stableEdgeDiscs(b, opp));
  score += mobilityWeight * (myMoves.length - theirMoves.length);
  score -= 3 * (frontierMine - frontierTheirs);
  if (empties < 20) score += (20 - empties) * 2 * (mine - theirs);
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

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function toCoords(move) {
  return [Math.floor(move.idx / N), move.idx % N];
}

function givesAwayCorner(b, move, p) {
  const next = play(b, move, p);
  for (const m of genMoves(next, 3 - p)) if (WEIGHTS[m.idx] === 120) return true;
  return false;
}

function easyMove(b, moves, p) {
  const corners = moves.filter(m => WEIGHTS[m.idx] === 120);
  if (corners.length && Math.random() < 0.5) return pick(corners);
  const safe = moves.filter(m => !(X_SQUARES.has(m.idx) && b[CORNER_OF[m.idx]] === 0));
  if (safe.length && Math.random() < 0.5) return pick(safe);
  return pick(moves);
}

function positionalMove(b, moves, p) {
  let best = null, bestScore = -Infinity;
  for (const m of moves) {
    let s = squareValue(b, m.idx, p) + m.flips.length * 0.5;
    if (WEIGHTS[m.idx] !== 120 && givesAwayCorner(b, m, p)) s -= 60;
    s += Math.random() * 4;
    if (s > bestScore) { bestScore = s; best = m; }
  }
  return best;
}

export const LEVELS = {
  easy: { kind: 'easy' },
  medium: { kind: 'positional', randomRate: 0.2 },
  hard: { kind: 'search', maxDepth: 4, timeMs: 250, randomRate: 0.05 },
  expert: { kind: 'search', maxDepth: 6, timeMs: 600, randomRate: 0 },
  impossible: { kind: 'search', maxDepth: 14, timeMs: 1400, randomRate: 0 },
};

export function chooseMove(board, player, difficulty, overrides = {}) {
  const b = toFlat(board);
  const moves = genMoves(b, player);
  if (moves.length === 0) return null;

  const level = { ...(LEVELS[difficulty] || LEVELS.impossible), ...overrides };

  if (level.kind === 'easy') return toCoords(easyMove(b, moves, player));
  if (level.randomRate && Math.random() < level.randomRate) return toCoords(pick(moves));
  if (level.kind === 'positional') return toCoords(positionalMove(b, moves, player));

  try {
    return findBestMove(board, player, level) || toCoords(pick(moves));
  } catch (err) {
    console.error('bot search failed, falling back to a positional move', err);
    return toCoords(positionalMove(b, moves, player));
  }
}