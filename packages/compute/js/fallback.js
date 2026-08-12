'use strict';
// Pure-JS fallback of the C++ compute engine. Mirrors the native N-API
// surface exactly so the stack runs everywhere (dev machines, Expo Go).

class KDTree {
  constructor(points, dim) {
    this.dim = dim;
    this.points = points; // [{id, phase, vec}]
    this.root = points.length ? this._build(points.map((_, i) => i), 0) : null;
  }

  _build(idx, depth) {
    if (!idx.length) return null;
    const axis = depth % this.dim;
    idx.sort((a, b) => this.points[a].vec[axis] - this.points[b].vec[axis]);
    const mid = idx.length >> 1;
    const node = { i: idx[mid], axis, split: this.points[idx[mid]].vec[axis] };
    node.left = this._build(idx.slice(0, mid), depth + 1);
    node.right = this._build(idx.slice(mid + 1), depth + 1);
    return node;
  }

  _sd(a, b) {
    let acc = 0;
    for (let i = 0; i < this.dim; i++) { const d = a[i] - b[i]; acc += d * d; }
    return acc;
  }

  nearest(q) {
    let best = { distance: Infinity, id: 0, phase: -1 };
    if (!this.root) return best;
    const stack = [this.root];
    while (stack.length) {
      let node = stack.pop();
      while (node) {
        const d = this._sd(this.points[node.i].vec, q);
        if (d < best.distance) {
          best.distance = d;
          best.id = this.points[node.i].id;
          best.phase = this.points[node.i].phase;
        }
        const diff = q[node.axis] - node.split;
        const near = diff < 0 ? node.left : node.right;
        const far = diff < 0 ? node.right : node.left;
        if (far && diff * diff < best.distance) stack.push(far);
        node = near;
      }
    }
    best.distance = Math.sqrt(best.distance);
    return best;
  }

  knn(q, k) {
    const res = [];
    if (!this.root || k < 1) return res;
    const stack = [this.root];
    while (stack.length) {
      const node = stack.pop();
      const d = this._sd(this.points[node.i].vec, q);
      if (res.length < k) {
        res.push({ distance: d, id: this.points[node.i].id, phase: this.points[node.i].phase });
        res.sort((a, b) => b.distance - a.distance);
      } else if (d < res[0].distance) {
        res[0] = { distance: d, id: this.points[node.i].id, phase: this.points[node.i].phase };
        res.sort((a, b) => b.distance - a.distance);
      }
      const diff = q[node.axis] - node.split;
      if (node.left) stack.push(node.left);
      if (node.right) stack.push(node.right);
      const _ = null; // (unoptimized fallback keeps correctness over speed)
    }
    return res.map((r) => ({ ...r, distance: Math.sqrt(r.distance) })).sort((a, b) => a.distance - b.distance);
  }

  within(q, radius) {
    const out = [];
    if (!this.root) return out;
    const r2 = radius * radius;
    const stack = [this.root];
    while (stack.length) {
      const node = stack.pop();
      if (this._sd(this.points[node.i].vec, q) <= r2) out.push(this.points[node.i].id);
      if (node.left) stack.push(node.left);
      if (node.right) stack.push(node.right);
    }
    return out;
  }

  size() { return this.points.length; }
}

const trees = new Map();
let nextId = 1;

function buildIndex(dim, points, ids, phases) {
  const pts = points.map((vec, i) => ({ id: ids[i], phase: phases[i], vec: Array.from(vec).slice(0, dim) }));
  const t = new KDTree(pts, dim);
  const id = nextId++;
  trees.set(id, t);
  return id;
}

function destroyIndex(id) { trees.delete(id); }

function nn(id, q) {
  const t = trees.get(id);
  return t ? t.nearest(Array.from(q)) : { distance: Infinity, id: 0, phase: -1 };
}

function knn(id, q, k) { const t = trees.get(id); return t ? t.knn(Array.from(q), k) : []; }

function within(id, q, r) { const t = trees.get(id); return t ? t.within(Array.from(q), r) : []; }

// DP scheduler (JS twin of C++ scheduler.h)
function optimizeSplit(blocksJson, daysJson) {
  const blocks = JSON.parse(blocksJson);
  const days = JSON.parse(daysJson);
  let theoreticalMax = blocks.reduce((s, b) => s + (b.priority || 1) * b.sets, 0);

  const used = blocks.map(() => false);
  const assignment = days.map(() => []);
  const fatigue = {};

  let totalScore = 0;
  for (let d = 0; d < days.length; d++) {
    const cap = days[d].capacityMin;
    const fCap = days[d].fatigueBudget;
    const cand = [];
    for (let i = 0; i < blocks.length; i++) {
      if (used[i]) continue;
      const b = blocks[i];
      if ((fatigue[b.muscle] || 0) + b.fatigueCost > fCap) continue;
      if (b.sets * b.timePerSetMin > cap) continue;
      cand.push(i);
    }
    const TICK = 10;
    const C = Math.floor(cap * TICK) + 1;
    const dp = new Array(C).fill(0);
    const pick = cand.map(() => new Uint8Array(C));
    for (let ci = 0; ci < cand.length; ci++) {
      const b = blocks[cand[ci]];
      const w = Math.round(b.sets * b.timePerSetMin * TICK);
      const v = Math.round((b.priority || 1) * b.sets * 100);
      for (let t = C - 1; t >= w; t--) {
        if (dp[t - w] + v > dp[t]) { dp[t] = dp[t - w] + v; pick[ci][t] = 1; }
      }
    }
    let t = C - 1;
    for (let ci = cand.length - 1; ci >= 0; ci--) {
      const b = blocks[cand[ci]];
      const w = Math.round(b.sets * b.timePerSetMin * TICK);
      if (pick[ci][t]) { assignment[d].push(cand[ci]); t -= w; }
    }
    let dayScore = 0;
    for (const i of assignment[d]) {
      used[i] = true;
      fatigue[blocks[i].muscle] = (fatigue[blocks[i].muscle] || 0) + blocks[i].fatigueCost;
      dayScore += (blocks[i].priority || 1) * blocks[i].sets;
    }
    totalScore += dayScore;
  }

  const schedule_json = JSON.stringify(assignment.map((dayAssign, d) => ({
    day: days[d].dayName,
    exercises: dayAssign.map((i) => ({
      name: blocks[i].name, muscle: blocks[i].muscle,
      sets: blocks[i].sets, time_min: +(blocks[i].sets * blocks[i].timePerSetMin).toFixed(1),
    })),
    used_min: +dayAssign.reduce((s, i) => s + blocks[i].sets * blocks[i].timePerSetMin, 0).toFixed(1),
  })));

  return { score: theoreticalMax ? totalScore / theoreticalMax : 0, schedule_json };
}

function bench(n, dim, k) {
  const pts = [];
  let seed = 12345;
  for (let i = 0; i < n; i++) {
    const v = [];
    for (let d = 0; d < dim; d++) { seed = (seed * 1103515245 + 12345) >>> 0; v.push(((seed >> 16) & 0x7fff) / 32768); }
    pts.push({ id: i, phase: i % 5, vec: v });
  }
  const t = new KDTree(pts, dim);
  const q = new Array(dim).fill(0.5);
  for (let i = 0; i < 20; i++) t.knn(q, k);
  const iters = 2000;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) t.knn(q, k);
  const t1 = process.hrtime.bigint();
  const avgUs = Number(t1 - t0) / iters / 1000;
  return { points: n, dim, k, avg_query_us: +avgUs.toFixed(2), queries_per_sec: Math.round(1e6 / avgUs), engine: 'js-fallback' };
}

module.exports = {
  engine: 'js-fallback',
  buildIndex, destroyIndex, nn, knn, within, optimizeSplit, bench,
};
