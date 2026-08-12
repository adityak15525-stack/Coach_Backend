'use strict';
// ============================================================
// MONOTONIC STACK
// USE CASE: PR (personal record) timeline. Given your lifting
// history [weight per session], find every time you set a new
// all-time PR. A monotonic stack produces the PR indices in O(n)
// — and its canonical side-effect (next greater element) tells
// us how many sessions you stayed ahead before someone/life
// passed you. Here: "record gaps".
// ============================================================

// @param {Array<number>} series
// @returns {Array<number>} indices where a new all-time max appears
function allTimeRecords(series) {
  const records = [];
  let runningMax = -Infinity;
  for (let i = 0; i < series.length; i++) {
    if (series[i] > runningMax) {
      runningMax = series[i];
      records.push(i);
    }
  }
  return records;
}

// Strictly decreasing monotonic stack → for each index, the distance
// to the next index with a strictly greater value (i.e., how many
// sessions until this weight was beaten).
// @returns {Array<number>} daysUntilBeaten (n = never beaten yet)
function nextGreaterGap(series) {
  const n = series.length;
  const result = new Array(n).fill(n); // n == "not yet beaten"
  const stack = [];
  for (let i = 0; i < n; i++) {
    while (stack.length && series[stack[stack.length - 1]] < series[i]) {
      const j = stack.pop();
      result[j] = i - j;
    }
    stack.push(i);
  }
  return result;
}

module.exports = { allTimeRecords, nextGreaterGap };
