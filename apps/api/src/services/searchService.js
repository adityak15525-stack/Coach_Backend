'use strict';
// ============================================================
// SEARCH SERVICE — Trie-backed autocomplete for exercises &
// foods. Prefix queries are O(L); "did you mean" rides on
// Levenshtein bounded by the trie walk.
// ============================================================
const { Trie } = require('@ai-coach/dsa');

const exerciseTrie = new Trie();
const foodTrie = new Trie();

function seedExercises(rows) {
  rows.forEach((r, i) => exerciseTrie.insert(r.name, r.rank || i + 1));
}

function seedFoods(rows) {
  rows.forEach((r, i) => foodTrie.insert(r.name, r.rank || i + 1));
}

function suggestExercises(q, limit = 8) {
  if (!q) return [];
  return exerciseTrie.suggestions(q, limit);
}

function suggestFoods(q, limit = 8) {
  if (!q) return [];
  return foodTrie.suggestions(q, limit);
}

function fixExercise(q) {
  return exerciseTrie.didYouMean(q);
}

module.exports = { seedExercises, seedFoods, suggestExercises, suggestFoods, fixExercise };
