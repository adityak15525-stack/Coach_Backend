'use strict';
// ============================================================
// VOLUME TRACKER — Fenwick Tree over the lift timeline.
// In production the DB is hydrated into the BIT once per day;
// range queries (e.g. "volume in the last 14 days") run in O(log n).
// ============================================================
const { FenwickTree } = require('@ai-coach/dsa');

let tree = null;
let epochStart = null; // day index 0 anchor

function ensureTree() {
  if (!tree) {
    tree = new FenwickTree(365);
    epochStart = new Date(new Date().getFullYear(), 0, 1); // Jan 1
  }
  return tree;
}

function dayIndexOf(date = new Date()) {
  return Math.floor((date - epochStart) / 86400000);
}

// record lifted volume for a session
function recordVolume(volumeKg, date = new Date()) {
  const t = ensureTree();
  t.update(dayIndexOf(date), volumeKg);
}

// cumulative volume between two dates (inclusive)
function volumeBetween(from, to) {
  const t = ensureTree();
  const l = Math.max(0, dayIndexOf(from));
  const r = Math.min(364, dayIndexOf(to));
  return t.range(l, r);
}

// total volume year-to-date
function yearToDate() {
  const t = ensureTree();
  return t.range(0, dayIndexOf());
}

// which day of the year did cumulative volume cross `kg`?
function dayOfMilestone(kg) {
  const t = ensureTree();
  const idx = t.findKth(kg);
  return idx === t.n ? null : new Date(epochStart.getTime() + idx * 86400000);
}

function stats() {
  return {
    yearToDateKg: yearToDate(),
    engine: 'FenwickTree O(log n)',
    resolution: '1 day',
  };
}

module.exports = { recordVolume, volumeBetween, yearToDate, dayOfMilestone, stats };
