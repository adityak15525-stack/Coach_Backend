'use strict';
// ============================================================
// COACH CUES — PriorityQueue (max-heap) for real-time voice
// coaching. Cues from the KD-Tree form engine, RPE timers and
// fatigue alerts all funnel here; the most critical cue is
// always spoken first. `promote()` lets a cue escalate mid-rep.
// ============================================================
const { PriorityQueue } = require('@ai-coach/dsa');

const queue = new PriorityQueue((a, b) => b.priority - a.priority);
const history = [];

const SEVERITY = { perfect: 1, minor: 3, moderate: 6, severe: 10 };

function enqueue({ text, severity, ref }) {
  const cue = {
    id: history.length + 1,
    text,
    ref: ref || null,
    priority: SEVERITY[severity] ?? 5,
    ts: Date.now(),
  };
  queue.push(cue);
  history.push(cue);
  return cue;
}

// pull the single most critical cue (or null)
function nextCue() {
  return queue.pop() || null;
}

function peekCue() {
  return queue.peek() || null;
}

function pendingCount() {
  return queue.size;
}

module.exports = { enqueue, nextCue, peekCue, pendingCount, history };
