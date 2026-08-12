'use strict';
// ============================================================
// TOPOLOGICAL SORT (Kahn's Algorithm — BFS on a DAG)
// USE CASE: Session builder. Every exercise has prerequisites
// (warm-up -> compound -> main lift -> accessory -> core), and
// muscle-group adjacency rules. We topologically order the
// blocks so the session flows safely and never fatigues a
// muscle before its compound hit. Cyclic programs are rejected.
// Complexity: O(V + E)
// ============================================================

// @param {Array<{id, deps: Array<string>}>} nodes
// @returns {Array<string>} ordered ids
function topoSort(nodes) {
  const order = [];
  const inDeg = new Map();
  const adj = new Map();
  const idSet = new Set(nodes.map((n) => n.id));

  for (const n of nodes) {
    inDeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const n of nodes) {
    for (const dep of n.deps || []) {
      if (!idSet.has(dep)) throw new Error(`Unknown dependency '${dep}' for '${n.id}'`);
      inDeg.set(n.id, inDeg.get(n.id) + 1);
      adj.get(dep).push(n.id);
    }
  }

  const queue = [];
  for (const [id, d] of inDeg) if (d === 0) queue.push(id);

  while (queue.length) {
    const u = queue.shift(); // O(V) deque — swap for a real queue at scale
    order.push(u);
    for (const v of adj.get(u)) {
      inDeg.set(v, inDeg.get(v) - 1);
      if (inDeg.get(v) === 0) queue.push(v);
    }
  }

  if (order.length !== nodes.length) {
    const cyclic = [...idSet].filter((id) => !order.includes(id));
    throw new Error(`Cycle detected in program: ${cyclic.join(', ')}`);
  }
  return order;
}

module.exports = { topoSort };
