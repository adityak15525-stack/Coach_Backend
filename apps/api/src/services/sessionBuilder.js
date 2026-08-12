'use strict';
// ============================================================
// SESSION BUILDER — Topological sort of exercises inside a day.
// Rules encoded as dependencies: warmup → compound → isolation,
// plus "don't hit a muscle group twice in a row". Cycles in a
// user's custom program are rejected with a clear error.
// ============================================================
const { topoSort } = require('@ai-coach/dsa');

function buildDayOrder(program) {
  // program: [{ id, name, muscle, deps: [] }]
  const orderedIds = topoSort(program);
  const byId = new Map(program.map((p) => [p.id, p]));
  return orderedIds.map((id) => byId.get(id));
}

// Derive deps automatically: warmup first, compounds before
// isolations, and unique muscle groups before repeats.
function autoDeps(program) {
  const byMuscle = new Map();
  const derived = program.map((p) => ({ ...p, deps: [] }));

  derived.forEach((p, i) => {
    if (p.kind === 'warmup') return;
    const warmups = derived.filter((d) => d.kind === 'warmup');
    if (warmups.length) p.deps.push(warmups[0].id);
    if (p.kind === 'isolation') {
      const compounds = derived.filter((d) => d.kind === 'compound' && d.id !== p.id);
      compounds.forEach((c) => p.deps.push(c.id));
    }
    if (byMuscle.has(p.muscle)) p.deps.push(byMuscle.get(p.muscle));
    byMuscle.set(p.muscle, p.id);
  });
  return derived;
}

module.exports = { buildDayOrder, autoDeps };
