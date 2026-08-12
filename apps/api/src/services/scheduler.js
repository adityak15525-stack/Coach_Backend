'use strict';
// ============================================================
// SCHEDULER SERVICE — wraps the C++ DP optimizer.
// Express feeds it fatigue from `muscle_fatigue`, time budgets
// from the user's calendar, and volume from `workout_sets`.
// Recalculation is O(D·n·C) and takes ~130µs — so the week
// re-plans itself live whenever a constraint changes.
// ============================================================
const compute = require('@ai-coach/compute');

const DEFAULT_DAYS = [
  { day: 'Mon', capacityMin: 60, fatigueBudget: 14 },
  { day: 'Tue', capacityMin: 30, fatigueBudget: 6 },
  { day: 'Wed', capacityMin: 45, fatigueBudget: 10 },
  { day: 'Thu', capacityMin: 30, fatigueBudget: 6 },
  { day: 'Fri', capacityMin: 60, fatigueBudget: 14 },
  { day: 'Sat', capacityMin: 40, fatigueBudget: 10 },
  { day: 'Sun', capacityMin: 0, fatigueBudget: 0 },
];

// Blocks come from the catalog; priority reflects the user's goal,
// fatigueCost reflects current `muscle_fatigue` + injury_flags.
function optimize(userState) {
  const blocks = (userState.catalog || []).map((b) => ({
    name: b.name,
    muscle: b.muscle,
    sets: b.sets,
    timePerSetMin: b.timePerSetMin,
    priority: b.priority,
    fatigueCost: b.fatigueCost,
  }));
  const days = userState.days || DEFAULT_DAYS;

  const t0 = process.hrtime.bigint();
  const result = compute.optimizeSplit(JSON.stringify(blocks), JSON.stringify(days));
  const t1 = process.hrtime.bigint();

  return {
    score: +(result.score * 100).toFixed(1),
    schedule: JSON.parse(result.schedule_json),
    latencyUs: Number(t1 - t0) / 1000,
    engine: compute.engine,
    recomputedAt: new Date().toISOString(),
  };
}

module.exports = { optimize };
