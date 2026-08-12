'use strict';
// End-to-end smoke test: boots the API, hits every endpoint, and
// streams a fake pose over WebSocket. No MySQL required (DSA
// endpoints + agent fallback keep everything green).
const { execFileSync } = require('child_process');
const assert = require('assert');
const WebSocket = require('ws');

const PORT = 4010;
const BASE = `http://localhost:${PORT}`;
const WS = `ws://localhost:${PORT}/live-session`;

const pass = (s) => console.log(`  ${s}`);
const fail = (s, e) => { console.error(`  ✗ ${s}: ${e.message}`); process.exit(1); };

async function main() {
  // ---- boot the server as a child process ----
  const child = require('child_process').spawn(process.execPath, ['src/index.js'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 1200));

  const j = (r) => r.json();
  const get = (p) => fetch(BASE + p).then(j);
  const post = (p, b) => fetch(BASE + p, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b),
  }).then(j);

  try {
    // 1) health
    const health = await get('/health');
    assert.strictEqual(health.status, 'ok');
    pass(`/health  compute=${health.compute.engine} db=${health.db}`);

    // 2) form analysis (KD-Tree NNS)
    const landmarks = [];
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return ((seed >> 16) & 0x7fff) / 32768; };
    for (let i = 0; i < 33; i++) landmarks.push([rnd(), rnd(), rnd(), 1]);
    const form = await post('/form/analyze', { exerciseId: 3, landmarks, sessionId: 'smoke-1' });
    assert.ok(typeof form.formScore === 'number');
    assert.ok(['perfect', 'minor', 'moderate', 'severe'].includes(form.verdict));
    pass(`/form/analyze  verdict=${form.verdict} risk=${form.risk} dist=${form.distance}`);

    // 3) DP scheduler
    const split = await post('/schedule/optimize', {});
    assert.ok(split.schedule.length >= 4);
    pass(`/schedule/optimize  score=${split.score}% latency=${split.latencyUs.toFixed(0)}µs`);

    // 4) search (Trie)
    const sq = await get('/search/exercises?q=bench');
    assert.ok(sq.suggestions.length > 0);
    const fy = await get('/search/exercises?q=skwat');
    pass(`/search/exercises  "bench"→[${sq.suggestions.slice(0, 3).join(', ')}] didYouMean(skwat)=${fy.didYouMean}`);

    // 5) analytics (Fenwick + monotonic stack)
    const vol = await get('/analytics/volume');
    assert.ok(vol.yearToDateKg >= 0);
    const pr = await get('/analytics/pr-timeline');
    assert.ok(pr.timeline.length > 0);
    pass(`/analytics  ytdVolume=${vol.yearToDateKg}kg PRs=${pr.timeline.length}`);

    // 6) session builder (topo sort)
    const order = await post('/sessions/build', {});
    assert.strictEqual(order.order.length, 7);
    pass(`/sessions/build  order=${order.order.map((o) => o.name).join(' → ')}`);

    // 7) agent swarm (uses live agents when up, local fallback otherwise)
    const done = await post('/sessions/4/complete', { volumeKg: 500, kcalBurned: 350, formVerdict: { verdict: 'minor', deviations: [{ joint: 'left_knee' }] } });
    assert.ok(['agent-swarm', 'local-fallback'].includes(done.agentSource), `source=${done.agentSource}`);
    pass(`/sessions/4/complete  swarm source=${done.agentSource} → "${done.swarm.summary.script.slice(0, 60)}..."`);

    // 8) coach cues (priority queue)
    await post('/form/analyze', { exerciseId: 3, landmarks: landmarks.map((l) => [l[0] + 0.3, l[1], l[2], 1]), sessionId: 'smoke-2' });
    const cue = await get('/coach/next-cue');
    pass(`/coach/next-cue  "${cue.cue?.text}" pending=${cue.pending}`);

    // 9) WebSocket live session
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS);
      let sawVerdict = false;
      const timer = setTimeout(() => {
        ws.close();
        sawVerdict ? (pass('/live-session  verdict received over WS'), resolve()) : reject(new Error('no verdict'));
      }, 1500);
      ws.on('message', (d) => {
        const msg = JSON.parse(d.toString());
        if (msg.type === 'connected') {
          ws.send(JSON.stringify({ type: 'frame', exerciseId: 2, sessionId: 'ws-1', landmarks }));
        }
        if (msg.type === 'verdict') sawVerdict = true;
      });
      ws.on('error', (e) => { clearTimeout(timer); reject(e); });
    });

    console.log('\n  ✅ API smoke test passed — all 9 surfaces green (no DB needed)');
  } finally {
    child.kill();
  }
}

main().catch((e) => fail('smoke', e));
