'use strict';
const assert = require('assert');
const compute = require('../js/index.js');

function run() {
  // 1) NN correctness vs brute force
  const pts = [[0, 0], [1, 1], [5, 5], [-2, 3], [4, -1]];
  const idx = compute.buildIndex(2, pts, [10, 11, 12, 13, 14], [0, 1, 2, 3, 4]);
  const q = [3.5, 0.5];
  const nn = compute.nn(idx, q);
  assert.strictEqual(nn.id, 14, 'nearest should be [4,-1]');
  assert.ok(Math.abs(nn.distance - Math.sqrt(0.25 + 2.25)) < 1e-5, 'distance');
  const k5 = compute.knn(idx, q, 3);
  assert.strictEqual(k5.length, 3, 'kNN returns k results');
  assert.ok(k5[0].distance <= k5[1].distance, 'sorted ascending');
  const ball = compute.within(idx, q, 3.0);
  assert.ok(ball.includes(14) && ball.includes(11), 'ball query');

  // 2) DP scheduler sanity
  const blocks = JSON.stringify([
    { name: 'Squat', muscle: 'quads', sets: 4, timePerSetMin: 3, priority: 1, fatigueCost: 8 },
    { name: 'Curl', muscle: 'biceps', sets: 3, timePerSetMin: 1.5, priority: 0.2, fatigueCost: 2 },
  ]);
  const days = JSON.stringify([{ day: 'Mon', capacityMin: 20, fatigueBudget: 10 }]);
  const s = compute.optimizeSplit(blocks, days);
  const schedule = JSON.parse(s.schedule_json);
  const names = schedule[0].exercises.map((e) => e.name);
  assert.ok(names.includes('Squat'), 'priority block placed');
  assert.ok(names.includes('Curl'), 'fits in capacity');

  // 3) bench smoke
  const b = compute.bench(500, 30, 3);
  assert.ok(b.avg_query_us > 0);

  compute.destroyIndex(idx);
  assert.strictEqual(compute.nn(idx, q).distance, Infinity, 'destroyed index returns no match');

  console.log(`  ✅ all unit tests passed (engine: ${compute.engine})`);
}

run();
