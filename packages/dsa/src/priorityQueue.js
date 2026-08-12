'use strict';
// ============================================================
// PRIORITY QUEUE (Binary Max-Heap)
// USE CASE: Live coaching cue scheduler. During a set, form
// deviations, RPE spikes and timer events arrive out of order.
// They're queued by criticality so the voice coach always says
// the most important thing first — and can `promote()` a cue
// when a deviation turns severe mid-rep.
// Complexity: push/pop O(log n), peek O(1).
// ============================================================

class PriorityQueue {
  constructor(compare = (a, b) => a.priority - b.priority) {
    this.heap = [];
    this.compare = compare; // returns < 0 if a has higher priority than b
  }

  push(item) {
    this.heap.push(item);
    this._siftUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  peek() {
    return this.heap[0];
  }

  promote(predicate, newPriority) {
    const i = this.heap.findIndex(predicate);
    if (i === -1) return false;
    this.heap[i].priority = newPriority;
    this._siftUp(i);
    return true;
  }

  get size() {
    return this.heap.length;
  }

  _siftUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.heap[i], this.heap[parent]) < 0) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else break;
    }
  }

  _siftDown(i) {
    const n = this.heap.length;
    for (;;) {
      let best = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.compare(this.heap[l], this.heap[best]) < 0) best = l;
      if (r < n && this.compare(this.heap[r], this.heap[best]) < 0) best = r;
      if (best === i) break;
      [this.heap[i], this.heap[best]] = [this.heap[best], this.heap[i]];
      i = best;
    }
  }
}

module.exports = PriorityQueue;
