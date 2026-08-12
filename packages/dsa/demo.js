'use strict';
// ============================================================
// DSA DEMO — one 45-second bench-press set, narrated by every
// algorithm in the toolkit. Run: npm run demo
// ============================================================
const {
  Trie, FenwickTree, topoSort, SlidingWindowStats, EMA, LRUCache,
  PriorityQueue, RollingHash, allTimeRecords, nextGreaterGap,
} = require('./index.js');

const line = (s) => console.log('  ' + s);
console.log('┌────────────────────────────────────────────────────────────┐');
console.log('│  THE 45-SECOND SET — A DSA WALKTHROUGH                    │');
console.log('└────────────────────────────────────────────────────────────┘');

// 1. You search "bench" → TRIE answers in O(L)
const ex = new Trie();
ex.insert('Bench Press', 100); ex.insert('Incline Bench Press', 70);
ex.insert('Bench Dips', 30); ex.insert('Paused Bench Press', 60);
line(`1) TRIE            "bench" → [${ex.suggestions('bench').join(', ')}]`);

// 2. The session is assembled → TOPOLOGICAL SORT respects prereqs
const program = topoSort([
  { id: 'warmup', deps: [] },
  { id: 'bench', deps: ['warmup'] },
  { id: 'tricep-iso', deps: ['bench'] },
  { id: 'core', deps: ['tricep-iso'] },
]);
line(`2) TOPO SORT       session order → ${program.join(' → ')}`);

// 3. Frames stream; the FORM ENGINE scores each rep → SLIDING WINDOW + EMA
const trend = new SlidingWindowStats(5);
const ema = new EMA(0.3);
let formScores = [0.91, 0.9, 0.88, 0.86, 0.83, 0.78];
let anomaly = 'none';
for (const s of formScores) { trend.push(s); ema.push(s); }
formScores.push(0.5); trend.push(0.5); ema.push(0.5);
if (trend.isAnomaly(0.5, 1.5)) anomaly = '⚠ anomaly detected (fatigue or form breakdown)';
line(`3) SLIDING WINDOW  form EMA ${ema.value.toFixed(2)}, last rep z=${trend.zScore(0.5).toFixed(1)} ${anomaly}`);

// 4. The coaching cues get queued → PRIORITY QUEUE (max-heap)
const cues = new PriorityQueue((a, b) => b.priority - a.priority);
cues.push({ cue: 'breathe', priority: 2 });
cues.push({ cue: 'driving through heels', priority: 6 });
cues.push({ cue: 'KEEP CHEST UP — back rounding', priority: 9 });
line(`4) PRIORITY QUEUE  next cue to speak → "${cues.pop().cue}"`);

// 5. Every completed rep gets hashed vs the textbook rep → ROLLING HASH
const textbook = new RollingHash([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]);
const lastRep = new RollingHash([10, 11, 12, 13, 14, 14, 14, 14, 14, 19, 20, 21, 22, 23, 24, 25]); // bounced
line(`5) RABIN-KARP      last rep similarity to textbook → ${(lastRep.similarity(textbook) * 100).toFixed(0)}% (partial-ROM flag)`);

// 6. The set logs 1,000kg of volume → FENWICK TREE tracks the month's total
const volume = new FenwickTree(30);
[220, 220, 250, 250, 260, 260, 280, 280].forEach((kg, i) => volume.update(i, kg));
line(`6) FENWICK TREE    July volume so far → ${volume.prefix(7)} kg, day you hit 1,500 kg total → day ${volume.findKth(1500) + 1}`);

// 7. The KD-Tree verdict gets cached for the hot exercise → LRU CACHE
const tplCache = new LRUCache(3);
tplCache.set('bench-eccentric', { idx: 12 }); tplCache.set('bench-bottom', { idx: 13 });
tplCache.set('bench-concentric', { idx: 14 });
line(`7) LRU CACHE       hot template 'bench-eccentric' hit → ${tplCache.get('bench-eccentric').idx !== undefined}`);

// 8. After the set — MONOTONIC STACK computes your PR timeline
const hist = [80, 85, 85, 90, 95, 95, 100, 100, 95, 102.5];
line(`8) MONOTONIC STACK PRs at sessions [${allTimeRecords(hist).join(', ')}], 95kg beaten after ${nextGreaterGap(hist)[4]} session(s)`);

console.log('\n  ...and the KD-Tree (C++) + DP scheduler (C++) are the two engines that power steps 3 & 6 in sub-50µs.');
console.log('  Ten algorithms. One set. Zero lag.');
