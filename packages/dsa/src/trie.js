'use strict';
// ============================================================
// TRIE (Prefix Tree)
// USE CASE: Exercise & food autocomplete. `squat` finds
// "Back Squat", "Front Squat", "Overhead Squat" instantly.
// Complexity: insert/search O(L) where L = word length.
// ============================================================

class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEnd = false;
    this.rank = 0; // popularity for smarter suggestions
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
    this._count = 0;
  }

  insert(word, rank = 1) {
    let node = this.root;
    const w = word.toLowerCase();
    for (const ch of w) {
      if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
      node = node.children.get(ch);
    }
    node.isEnd = true;
    node.rank = Math.max(node.rank, rank);
    node.word = word; // preserve original casing for display
    this._count++;
  }

  search(word) {
    const node = this._walk(word.toLowerCase());
    return !!node && node.isEnd;
  }

  startsWith(prefix) {
    return !!this._walk(prefix.toLowerCase());
  }

  // DFS collect up to `limit` words that share `prefix`
  suggestions(prefix, limit = 8) {
    const p = prefix.toLowerCase();
    const node = this._walk(p);
    if (!node) return [];
    const out = [];
    const stack = [{ n: node, acc: p }];
    while (stack.length && out.length < limit) {
      const { n } = stack.pop();
      if (n.isEnd) out.push({ word: n.word, rank: n.rank });
      for (const [, child] of n.children) stack.push({ n: child });
    }
    out.sort((a, b) => b.rank - a.rank);
    return out.map((o) => o.word);
  }

  // "Did you mean?" — returns the closest complete word by edit distance ≤ k
  didYouMean(word, k = 2) {
    let best = null;
    let bestNode = null;
    const target = word.toLowerCase();
    const stack = [{ n: this.root, acc: '' }];
    while (stack.length) {
      const { n } = stack.pop();
      const dist = this._editDistance(target, n.word ? n.word.toLowerCase() : target);
      if (n.isEnd && dist <= k) {
        if (!bestNode || dist < this._editDistance(target, bestNode.word.toLowerCase())) {
          best = n.word;
          bestNode = n;
        }
      }
      for (const [ch, child] of n.children) stack.push({ n: child });
    }
    return best;
  }

  _walk(prefix) {
    let node = this.root;
    for (const ch of prefix) {
      node = node.children.get(ch);
      if (!node) return null;
    }
    return node;
  }

  _editDistance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      }
    }
    return dp[a.length][b.length];
  }

  get count() {
    return this._count;
  }
}

module.exports = Trie;
