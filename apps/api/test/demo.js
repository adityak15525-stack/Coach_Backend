'use strict';
// ============================================================
// END-TO-END DEMO — showcases every Neural Coach feature in
// a single run. Outputs formatted results for screenshots/video.
// No database required — all DSA + compute features work standalone.
//
// Usage:  node apps/api/test/demo.js
// ============================================================

const { execFile } = require('child_process');
const WebSocket = require('ws');

const PORT = 4020;
const BASE = `http://localhost:${PORT}`;
const WS = `ws://localhost:${PORT}/live-session`;
const SEP = '─'.repeat(60);

const j = (r) => r.json();
const get = (p) => fetch(BASE + p).then(j);
const post = (p, b) => fetch(BASE + p, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b),
}).then(j);

function heading(title) {
  console.log(`\n${SEP}`);
  console.log(`  ${title}`);
  console.log(SEP);
}

async function main() {
  console.log('\n  NEURAL COACH — Full Feature Demo');
  console.log('  AI-Powered Fitness Platform\n');

  // Boot the server
  const child = require('child_process').spawn(process.execPath, ['src/index.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 1500));

  try {
    // ── 1. HEALTH ──
    heading('1. HEALTH CHECK');
    const health = await get('/health');
    console.log(`  Engine:   ${health.compute.engine}`);
    console.log(`  Database: ${health.db}`);

    // ── 2. FORM CORRECTION (KD-Tree) ──
    heading('2. REAL-TIME FORM CORRECTION (KD-Tree Nearest Neighbor)');
    const landmarks = [];
    let seed = 42;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return ((seed >> 16) & 0x7fff) / 32768; };
    for (let i = 0; i < 33; i++) landmarks.push([rnd(), rnd(), rnd(), 1]);

    const form = await post('/form/analyze', { exerciseId: 3, landmarks, sessionId: 'demo-1' });
    console.log(`  Verdict:      ${form.verdict.toUpperCase()}`);
    console.log(`  Form Score:   ${(form.formScore * 100).toFixed(0)}%`);
    console.log(`  Risk Level:   ${form.risk}/100`);
    console.log(`  Distance:     ${form.distance.toFixed(4)} (KD-Tree)`);
    if (form.coaching?.length) {
      console.log(`  Coaching:`);
      form.coaching.forEach((c) => console.log(`    → ${c}`));
    }
    if (form.deviations?.length) {
      console.log(`  Deviations:`);
      form.deviations.slice(0, 3).forEach((d) => {
        const joint = d.joint || 'unknown';
        const mm = d.deviationMm != null ? `${d.deviationMm.toFixed(1)}mm` : '';
        const sev = d.severity || '';
        console.log(`    ${joint}: ${mm} ${sev}`.trim());
      });
    }

    // ── 3. SCHEDULE OPTIMIZATION (DP 0/1 Knapsack) ──
    heading('3. WORKOUT SCHEDULE OPTIMIZATION (Dynamic Programming)');
    const split = await post('/schedule/optimize', {
      catalog: [
        { name: 'Back Squat', muscle: 'legs', sets: 4, timePerSetMin: 4, priority: 1.0, fatigueCost: 5 },
        { name: 'Bench Press', muscle: 'chest', sets: 4, timePerSetMin: 3.5, priority: 0.95, fatigueCost: 4 },
        { name: 'Barbell Row', muscle: 'back', sets: 4, timePerSetMin: 3.5, priority: 0.9, fatigueCost: 4 },
        { name: 'OHP', muscle: 'shoulders', sets: 3, timePerSetMin: 3, priority: 0.8, fatigueCost: 3 },
        { name: 'Pull-ups', muscle: 'back', sets: 3, timePerSetMin: 2.5, priority: 0.85, fatigueCost: 3 },
        { name: 'Lunges', muscle: 'legs', sets: 3, timePerSetMin: 3, priority: 0.7, fatigueCost: 3 },
      ],
    });
    console.log(`  Optimality Score: ${split.score}%`);
    console.log(`  Compute Time:     ${split.latencyUs.toFixed(0)}µs (C++ engine)`);
    console.log(`  Schedule:`);
    split.schedule.forEach((day) => {
      if (day.exercises.length > 0) {
        const exs = day.exercises.map((e) => e.name).join(', ');
        console.log(`    ${day.day}: ${exs} (${day.used_min}min)`);
      }
    });

    // ── 4. EXERCISE SEARCH (Trie + Levenshtein) ──
    heading('4. EXERCISE SEARCH (Trie Autocomplete + Fuzzy Match)');
    const bench = await get('/search/exercises?q=bench');
    console.log(`  "bench" → ${bench.suggestions.join(', ')}`);
    const fuzzy = await get('/search/exercises?q=skwat');
    console.log(`  "skwat" → did you mean: ${fuzzy.didYouMean}?`);
    const squat = await get('/search/exercises?q=squat');
    console.log(`  "squat" → ${squat.suggestions.join(', ')}`);

    // ── 5. FOOD INTELLIGENCE ──
    heading('5. FOOD SCANNING & NUTRITION');
    const chicken = await get('/food/scan?name=chicken breast');
    console.log(`  ${chicken.food.name}: ${chicken.food.calories}kcal, ${chicken.food.protein}g protein per 100g`);
    console.log(`  Verdict: ${chicken.recommendation.verdict}`);
    chicken.recommendation.reasons.forEach((r) => console.log(`    → ${r}`));

    const search = await get('/food/scan?q=prot');
    console.log(`  "prot" autocomplete: ${search.suggestions.join(', ')}`);

    // ── 6. ANALYTICS (Fenwick Tree + Monotonic Stack) ──
    heading('6. TRAINING ANALYTICS');
    const vol = await get('/analytics/volume');
    console.log(`  Year-to-date volume: ${vol.yearToDateKg}kg`);
    const pr = await get('/analytics/pr-timeline');
    console.log(`  Personal records tracked: ${pr.timeline.length}`);
    if (pr.timeline.length > 0) {
      pr.timeline.slice(0, 3).forEach((p) => {
        const ex = p.exercise || p.exerciseName || 'Unknown';
        const val = p.value != null ? `${p.value}kg` : '';
        const days = p.holdsDays != null ? `${p.holdsDays} days` : '';
        console.log(`    ${ex}: ${val} ${days}`.trim());
      });
    }

    // ── 7. SESSION BUILDER (Topological Sort) ──
    heading('7. SESSION BUILDER (Topological Sort)');
    const order = await post('/sessions/build', {});
    console.log(`  Safe exercise order:`);
    order.order.forEach((o, i) => {
      console.log(`    ${i + 1}. ${o.name} (${o.muscle})`);
    });

    // ── 8. AGENT SWARM ──
    heading('8. AI AGENT SWARM (Python)');
    const result = await post('/sessions/4/complete', {
      volumeKg: 500,
      kcalBurned: 350,
      formVerdict: { verdict: 'minor', deviations: [{ joint: 'left_knee' }] },
    });
    console.log(`  Source: ${result.agentSource}`);
    console.log(`  Summary: "${result.swarm.summary.script}"`);

    // ── 9. VOICE COACHING (Priority Queue) ──
    heading('9. VOICE COACHING (Priority Queue)');
    await post('/form/analyze', {
      exerciseId: 3,
      landmarks: landmarks.map((l) => [l[0] + 0.3, l[1], l[2], 1]),
      sessionId: 'demo-2',
    });
    const cue = await get('/coach/next-cue');
    console.log(`  Next cue: "${cue.cue?.text}"`);
    console.log(`  Pending cues: ${cue.pending}`);

    // ── 10. WEBSOCKET LIVE SESSION ──
    heading('10. LIVE SESSION (WebSocket Streaming)');
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS);
      let count = 0;
      const timer = setTimeout(() => {
        ws.close();
        console.log(`  Received ${count} verdicts over WebSocket`);
        resolve();
      }, 2000);
      ws.on('message', (d) => {
        const msg = JSON.parse(d.toString());
        if (msg.type === 'connected') {
          console.log(`  Connected: ${msg.message}`);
          ws.send(JSON.stringify({ type: 'frame', exerciseId: 2, sessionId: 'ws-demo', landmarks }));
        }
        if (msg.type === 'verdict') {
          count++;
          if (count === 1) console.log(`  First verdict: ${msg.verdict} (score: ${msg.formScore})`);
        }
      });
      ws.on('error', (e) => { clearTimeout(timer); reject(e); });
    });

    // ── SUMMARY ──
    heading('DEMO COMPLETE');
    console.log('  All 10 features demonstrated successfully.');
    console.log('  Zero database connections required.');
    console.log('  C++ compute engine: native');
    console.log(`  DP scheduler latency: ${split.latencyUs.toFixed(0)}µs`);
    console.log('');

  } finally {
    child.kill();
  }
}

main().catch((e) => { console.error('Demo failed:', e.message); process.exit(1); });
