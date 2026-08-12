'use strict';
// ============================================================
// FENWICK TREE (Binary Indexed Tree)
// USE CASE: Progressive-overload volume tracker. Users ask
// "total volume lifted in the last 30 days" constantly; naive
// re-summation is O(n). BIT gives prefix-sum & point-update in
// O(log n) — and it's amortized to microseconds on a phone.
// ============================================================

class FenwickTree {
  constructor(size) {
    this.n = size;
    this.tree = new Float64Array(size + 1); // 1-indexed
  }

  // add `delta` to index i (1-based or 0-based -> internally +1)
  update(i, delta) {
    let idx = i + 1;
    while (idx <= this.n) {
      this.tree[idx] += delta;
      idx += idx & -idx; // LSB trick: parent is the next power-of-two step
    }
  }

  // prefix sum of [0, i]
  prefix(i) {
    let idx = i + 1;
    let sum = 0;
    while (idx > 0) {
      sum += this.tree[idx];
      idx -= idx & -idx;
    }
    return sum;
  }

  // inclusive range sum [l, r]
  range(l, r) {
    if (l > r) return 0;
    return this.prefix(r) - (l > 0 ? this.prefix(l - 1) : 0);
  }

  // Binary-search for the smallest index whose prefix sum >= target
  // (e.g. "which day did I pass 10,000 kg cumulative volume?")
  findKth(k) {
    let idx = 0;
    let bitMask = 1 << Math.floor(Math.log2(this.n));
    while (bitMask > 0) {
      const next = idx + bitMask;
      if (next <= this.n && this.tree[next] < k) {
        idx = next;
        k -= this.tree[next];
      }
      bitMask >>= 1;
    }
    return idx; // 0-based index
  }
}

module.exports = FenwickTree;
