'use strict';
const assert = require('assert');
const {
  Trie, FenwickTree, topoSort, SlidingWindowStats, EMA,
  LRUCache, PriorityQueue, RollingHash, allTimeRecords, nextGreaterGap,
} = require('../index.js');

// 1) Trie
const t = new Trie();
['Squat', 'Squat Rack', 'Squat Shoes', 'Bench Press', 'Bench Dips'].forEach((w, i) => t.insert(w, i + 1));
assert.ok(t.search('squat rack'));
assert.deepStrictEqual(t.suggestions('squat'), ['Squat Shoes', 'Squat Rack', 'Squat']);
assert.deepStrictEqual(t.suggestions('bench'), ['Bench Dips', 'Bench Press']);
assert.strictEqual(t.didYouMean('sqat'), 'Squat');
assert.ok(!t.startsWith('zzz'));
console.log('  Trie autocomplete            ✔');

// 2) Fenwick
const bit = new FenwickTree(7);
for (let i = 0; i < 7; i++) bit.update(i, 100); // 100kg each day
assert.strictEqual(bit.range(0, 6), 700);
assert.strictEqual(bit.range(3, 5), 300);
assert.strictEqual(bit.findKth(350), 3); // day that passed cumulative 350kg
assert.strictEqual(bit.prefix(0), 100);
console.log('  Fenwick volume queries      ✔');

// 3) Topological sort
const ordered = topoSort([
  { id: 'warmup', deps: [] },
  { id: 'squat', deps: ['warmup'] },
  { id: 'legs-accessory', deps: ['squat'] },
  { id: 'core', deps: ['legs-accessory'] },
]);
assert.deepStrictEqual(ordered, ['warmup', 'squat', 'legs-accessory', 'core']);
assert.throws(() => topoSort([{ id: 'a', deps: ['b'] }, { id: 'b', deps: ['a'] }]), /Cycle/);
console.log('  TopoSort session builder    ✔');

// 4) Sliding window anomaly detection
const win = new SlidingWindowStats(5);
[0.9, 0.88, 0.92, 0.9, 0.91].forEach((v) => win.push(v));
assert.ok(win.isAnomaly(0.3)); // a terrible rep after a great streak
assert.ok(!win.isAnomaly(0.89));
const ema = new EMA(0.5);
assert.strictEqual(ema.push(10), 10);
assert.strictEqual(ema.push(20), 15);
console.log('  Sliding-window form trend   ✔');

// 5) LRU cache
const cache = new LRUCache(3);
cache.set('squat', 1); cache.set('bench', 2); cache.set('deadlift', 3);
cache.get('squat');            // make squat MRU
cache.set('ohp', 4);           // evicts bench (LRU)
assert.ok(cache.has('squat') && cache.has('deadlift') && cache.has('ohp'));
assert.ok(!cache.has('bench'));
console.log('  LRU template cache          ✔');

// 6) Priority queue
const pq = new PriorityQueue((a, b) => b.priority - a.priority);
pq.push({ cue: 'breathe', priority: 1 });
pq.push({ cue: 'knee valgus!', priority: 9 });
pq.push({ cue: 'elbow flare', priority: 5 });
assert.strictEqual(pq.pop().cue, 'knee valgus!'); // highest criticality first
pq.promote((c) => c.cue === 'elbow flare', 10);   // escalate mid-rep
assert.strictEqual(pq.pop().cue, 'elbow flare');
console.log('  PQ live cue scheduler       ✔');

// 7) Rolling hash similarity
const textbook = new RollingHash([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
const goodRep = new RollingHash([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
const cheatRep = new RollingHash([0, 1, 1, 1, 1, 1, 1, 1, 1, 9, 10, 11, 12, 13, 14, 15]);
assert.ok(textbook.similarity(goodRep) > 0.9);
assert.ok(textbook.similarity(cheatRep) < textbook.similarity(goodRep));
console.log('  Rabin-Karp rep similarity   ✔');

// 8) Monotonic stack
const records = allTimeRecords([60, 65, 60, 70, 70, 75, 72]);
assert.deepStrictEqual(records, [0, 1, 3, 5]);
const gaps = nextGreaterGap([100, 105, 102, 110, 90]);
assert.deepStrictEqual(gaps, [1, 2, 1, 5, 5]);
console.log('  Monotonic-stack PR timeline ✔');

console.log('\n  ✅ all 8 DSA applications passed');
