'use strict';
// ============================================================
// PR TIMELINE — Monotonic stack over lift history.
// Yields every all-time PR and how many sessions each weight
// survived before being beaten. Powers the "PR Gems" timeline UI.
// ============================================================
const { allTimeRecords, nextGreaterGap } = require('@ai-coach/dsa');

// history: [{ date, weight }] (chronological)
function prTimeline(history) {
  const weights = history.map((h) => h.weight);
  const records = allTimeRecords(weights);
  const gaps = nextGreaterGap(weights);
  return records.map((i, pos) => {
    const survived = pos < records.length - 1 ? records[pos + 1] - i : history.length - i;
    return {
      date: history[i].date,
      weight: history[i].weight,
      type: survived > 3 ? 'breakthrough' : 'pr',
      sessionsUntilBeaten: gaps[i],
    };
  });
}

module.exports = { prTimeline };
