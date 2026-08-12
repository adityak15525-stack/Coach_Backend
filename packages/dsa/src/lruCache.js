'use strict';
// ============================================================
// LRU CACHE (Least Recently Used — Map-based, O(1))
// USE CASE: Hot template cache. The KD-Tree index for the
// user's current exercise stays hot during a session; rarely
// used muscle/template lookups get evicted. Keeps the native
// memory footprint bounded while frames stream at 30fps.
// ============================================================

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map(); // insertion order == recency order
  }

  get(key) {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key);
    // re-insert to move to most-recent (tail)
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.capacity) {
      const lru = this.map.keys().next().value; // head = least recently used
      this.map.delete(lru);
    }
  }

  has(key) {
    return this.map.has(key);
  }

  get size() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }
}

module.exports = LRUCache;
