'use strict';
// ============================================================
// SLIDING WINDOW + EMA
// USE CASE: Form-quality trend. MediaPipe streams a form score
// per rep (0..1). A fixed window keeps the trailing mean/std so
// the coach can say "your last 5 reps are drifting" and flag
// anomaly reps (a rep 2σ worse than the window = correction cue).
// Complexity: O(1) amortized per push.
// ============================================================

class SlidingWindowStats {
  constructor(windowSize = 10) {
    this.size = windowSize;
    this.items = new Array(windowSize);
    this.head = 0;
    this.len = 0;
    this.sum = 0;
    this.sqSum = 0;
  }

  push(v) {
    if (this.len === this.size) {
      const evicted = this.items[this.head];
      this.sum -= evicted;
      this.sqSum -= evicted * evicted;
    } else {
      this.len++;
    }
    this.items[this.head] = v;
    this.head = (this.head + 1) % this.size;
    this.sum += v;
    this.sqSum += v * v;
  }

  mean() {
    return this.len ? this.sum / this.len : 0;
  }

  // sample std-dev (n-1) — bias-corrected for anomaly thresholds
  std() {
    if (this.len < 2) return 0;
    const m = this.mean();
    const variance = (this.sqSum - this.len * m * m) / (this.len - 1);
    return Math.sqrt(Math.max(0, variance));
  }

  isAnomaly(v, sigma = 2.0) {
    const s = this.std();
    if (s === 0) return false;
    return Math.abs(v - this.mean()) / s > sigma;
  }

  zScore(v) {
    const s = this.std();
    return s === 0 ? 0 : (v - this.mean()) / s;
  }
}

// Exponential Moving Average with configurable smoothing α
class EMA {
  constructor(alpha = 0.25) {
    this.alpha = alpha;
    this.value = null;
  }

  push(v) {
    this.value = this.value === null ? v : this.alpha * v + (1 - this.alpha) * this.value;
    return this.value;
  }
}

module.exports = { SlidingWindowStats, EMA };
