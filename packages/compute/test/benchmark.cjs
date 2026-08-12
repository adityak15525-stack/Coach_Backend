'use strict';
const compute = require('../js/index.js');

console.log('┌────────────────────────────────────────────────────────┐');
console.log('│  HYPER-ADAPTIVE COACH — COMPUTE ENGINE BENCHMARK       │');
console.log('└────────────────────────────────────────────────────────┘');
console.log(`Engine          : ${compute.engine}`);

// --- 1) KD-Tree build + NN against a realistic 33-landmark pose space ---
const LANDMARKS = 33;
const DIM = LANDMARKS * 3;            // 99-D pose vectors
const TEMPLATES = 2500;               // "perfect form" corpus per exercise set
const points = [];
const ids = [];
const phases = [];
let seed = 4242;
const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return ((seed >> 16) & 0x7fff) / 32768; };
for (let i = 0; i < TEMPLATES; i++) {
  const v = [];
  for (let d = 0; d < DIM; d++) v.push(rand());
  points.push(v); ids.push(i); phases.push(i % 5);
}

const t0 = Date.now();
const idx = compute.buildIndex(DIM, points, ids, phases);
const buildMs = Date.now() - t0;
console.log(`\n[KD-Tree Form Engine]`);
console.log(`  Build ${TEMPLATES} templates x ${DIM}D : ${buildMs} ms`);

const query = points[1234].map((v) => v + rand() * 0.02); // perturbed "live" frame
const t1 = process.hrtime.bigint();
const res = compute.nn(idx, query);
const t2 = process.hrtime.bigint();
console.log(`  Nearest-neighbor    : ${Number(t2 - t1) / 1000} µs  → template #${res.id} dist=${res.distance.toFixed(5)}`);

const t3 = process.hrtime.bigint();
const knn = compute.knn(idx, query, 5);
const t4 = process.hrtime.bigint();
console.log(`  5-NN                : ${Number(t4 - t3) / 1000} µs  → phases [${knn.map((k) => k.phase).join(',')}]`);

const t5 = process.hrtime.bigint();
const near = compute.within(idx, query, 0.05);
const t6 = process.hrtime.bigint();
console.log(`  Ball query r=0.05   : ${Number(t6 - t5) / 1000} µs  → ${near.length} neighbors`);

// --- 2) DP scheduler ---
console.log(`\n[DP Weekly Scheduler]`);
const blocks = JSON.stringify([
  { name: 'Back Squat',    muscle: 'quads',     sets: 5, timePerSetMin: 3, priority: 1.0, fatigueCost: 8 },
  { name: 'Bench Press',   muscle: 'chest',     sets: 5, timePerSetMin: 3, priority: 0.9, fatigueCost: 6 },
  { name: 'Deadlift',      muscle: 'posterior', sets: 3, timePerSetMin: 4, priority: 1.0, fatigueCost: 10 },
  { name: 'OHP',           muscle: 'shoulders', sets: 4, timePerSetMin: 3, priority: 0.7, fatigueCost: 5 },
  { name: 'Barbell Row',   muscle: 'back',      sets: 4, timePerSetMin: 3, priority: 0.8, fatigueCost: 7 },
  { name: 'Lunges',        muscle: 'glutes',    sets: 3, timePerSetMin: 2, priority: 0.6, fatigueCost: 5 },
  { name: 'Incline Press', muscle: 'chest',     sets: 3, timePerSetMin: 2, priority: 0.5, fatigueCost: 4 },
  { name: 'Pull-up',       muscle: 'back',      sets: 4, timePerSetMin: 2, priority: 0.7, fatigueCost: 6 },
  { name: 'Hip Thrust',    muscle: 'glutes',    sets: 4, timePerSetMin: 2, priority: 0.6, fatigueCost: 6 },
  { name: 'Curl',          muscle: 'biceps',    sets: 3, timePerSetMin: 1.5, priority: 0.3, fatigueCost: 2 },
  { name: 'Lateral Raise', muscle: 'shoulders', sets: 4, timePerSetMin: 1.5, priority: 0.3, fatigueCost: 2 },
  { name: 'Plank',         muscle: 'core',      sets: 3, timePerSetMin: 1, priority: 0.4, fatigueCost: 3 },
]);
const days = JSON.stringify([
  { day: 'Mon', capacityMin: 60, fatigueBudget: 12 },
  { day: 'Wed', capacityMin: 45, fatigueBudget: 10 },
  { day: 'Fri', capacityMin: 60, fatigueBudget: 12 },
  { day: 'Sat', capacityMin: 30, fatigueBudget: 8 },
]);
const t7 = process.hrtime.bigint();
const split = compute.optimizeSplit(blocks, days);
const t8 = process.hrtime.bigint();
console.log(`  Optimize (${JSON.parse(blocks).length} blocks / ${JSON.parse(days).length} days): ${Number(t8 - t7) / 1000} µs`);
console.log(`  Optimality score     : ${(split.score * 100).toFixed(1)}%`);
console.log(`  Schedule:\n${JSON.stringify(JSON.parse(split.schedule_json), null, 2)}`);

// --- 3) sustained latency proof (sub-50ms target) ---
console.log(`\n[Sustained kNN Latency]`);
const bench = compute.bench(5000, DIM, 1);
console.log(`  5,000-point tree      : ${bench.avg_query_us.toFixed(2)} µs/query  (${bench.queries_per_sec} qps)`);
const ok = bench.avg_query_us < 50000;
console.log(`\n  ${ok ? '✅' : '❌'} Sub-50ms guarantee: ${bench.avg_query_us.toFixed(2)} µs/query ${ok ? 'MET' : 'FAILED'}`);
