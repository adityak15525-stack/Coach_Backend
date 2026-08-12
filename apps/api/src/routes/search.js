'use strict';
const router = require('express').Router();
const search = require('../services/searchService');

const EXERCISES = [
  'Back Squat', 'Front Squat', 'Overhead Squat', 'Romanian Deadlift',
  'Conventional Deadlift', 'Bench Press', 'Incline Bench Press', 'Paused Bench Press',
  'Barbell Row', 'Pendlay Row', 'Pull-up', 'Chin-up', 'Overhead Press',
  'Push Press', 'Hip Thrust', 'Bulgarian Split Squat', 'Lateral Raise',
  'Chest Fly', 'Face Pull', 'Cable Row', 'Leg Press', 'Calf Raise', 'Plank',
];
EXERCISES.forEach((e, i) => search.seedExercises([{ name: e, rank: EXERCISES.length - i }]));
// curated aliases (rank 0 → always sort after full names) so "skwat"/"benc"
// resolve via did-you-mean instead of returning nothing
['Squat', 'Bench', 'Deadlift', 'Row', 'Press', 'Pull-up', 'Chin-up', 'Lunge',
 'Thrust', 'Raise', 'Fly', 'Curl', 'Plank', 'OHP', 'Cable Row']
  .forEach((a) => search.seedExercises([{ name: a, rank: 0 }]));

const FOODS = [
  'Chicken Breast', 'Chicken Thigh', 'Eggs', 'Greek Yogurt', 'Protein Powder',
  'White Rice', 'Brown Rice', 'Oats', 'Sweet Potato', 'Broccoli', 'Spinach',
  'Salmon', 'Tuna', 'Beef Mince', 'Olive Oil', 'Peanut Butter', 'Banana',
  'Blueberries', 'Almonds', 'Cottage Cheese', 'Whey', 'Casein',
];
FOODS.forEach((f, i) => search.seedFoods([{ name: f, rank: FOODS.length - i }]));

// Also seed the full food database into the trie for autocomplete
const foodDb = require('../services/foodDatabase');
foodDb.FOOD_NAMES.forEach((name, i) => search.seedFoods([{ name, rank: 1 }]));

// GET /api/search/exercises?q=bench
router.get('/search/exercises', (req, res) => {
  const { q } = req.query;
  res.json({ query: q, suggestions: search.suggestExercises(q), didYouMean: q && !search.suggestExercises(q).length ? search.fixExercise(q) : null });
});

// GET /api/search/foods?q=pro
router.get('/search/foods', (req, res) => {
  const { q } = req.query;
  res.json({ query: q, suggestions: search.suggestFoods(q) });
});

module.exports = router;
