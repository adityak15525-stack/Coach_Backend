'use strict';
// ============================================================
// RABIN-KARP ROLLING HASH
// USE CASE: Cheat-rep / pattern detection. Every rep produces a
// joint-trajectory signature. We hash a sliding window of that
// trajectory and compare it to the "textbook" rep hash in O(1)
// per step. Abrupt divergences (partial ROM, bouncing) surface
// as hash mismatches — even when the raw numbers "look fine".
// ============================================================

const BASE = 911382323;
const MOD = 1e9 + 7;

class RollingHash {
  constructor(sequence) {
    this.s = sequence;
    this.n = sequence.length;
    this.pow = new Array(this.n + 1);
    this.prefix = new Array(this.n + 1);
    this.pow[0] = 1;
    this.prefix[0] = 0;
    for (let i = 0; i < this.n; i++) {
      this.pow[i + 1] = Number((BigInt(this.pow[i]) * BigInt(BASE)) % BigInt(MOD));
      const code = (sequence[i] | 0) + 1; // +1 so zero-values still distinct
      this.prefix[i + 1] =
        (Number((BigInt(this.prefix[i]) * BigInt(BASE)) % BigInt(MOD)) + code) % MOD;
    }
  }

  // inclusive hash of [l, r]
  hash(l, r) {
    const len = r - l + 1;
    const val =
      (this.prefix[r + 1] -
        Number((BigInt(this.prefix[l]) * BigInt(this.pow[len])) % BigInt(MOD)) +
        MOD) %
      MOD;
    return val;
  }

  // ratio of matched windows — similarity score between a live rep
  // and a textbook rep across the whole trajectory
  similarity(other, window = 16) {
    if (other.n !== this.n) {
      // allow length mismatch: match on the smaller common span
      const span = Math.min(this.n, other.n);
      let hits = 0;
      for (let i = 0; i + window <= span; i += window) {
        if (this.hash(i, i + window - 1) === other.hash(i, i + window - 1)) hits++;
      }
      const windows = Math.max(1, Math.floor(span / window));
      return hits / windows;
    }
    let hits = 0;
    const windows = Math.max(1, Math.floor(this.n / window));
    for (let i = 0; i + window <= this.n; i += window) {
      if (this.hash(i, i + window - 1) === other.hash(i, i + window - 1)) hits++;
    }
    return hits / windows;
  }
}

module.exports = RollingHash;
