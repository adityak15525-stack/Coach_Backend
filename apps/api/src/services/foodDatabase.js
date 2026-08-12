'use strict';
// ============================================================
// FOOD DATABASE — nutrition facts for the food scanner.
// Each entry: name, calories (kcal per 100g), protein (g),
// fat (g), carbs (g), category, and whether we recommend it.
// ============================================================

const FOOD_DB = [
  // ---- protein sources ----
  {
    id: 1, name: 'Chicken Breast', category: 'protein',
    calories: 165, protein: 31, fat: 3.6, carbs: 0,
    recommend: true, note: 'Lean protein — excellent for muscle recovery.',
  },
  {
    id: 2, name: 'Chicken Thigh', category: 'protein',
    calories: 209, protein: 26, fat: 10.9, carbs: 0,
    recommend: true, note: 'Higher fat but still a solid protein pick.',
  },
  {
    id: 3, name: 'Salmon', category: 'protein',
    calories: 206, protein: 22, fat: 13, carbs: 0,
    recommend: true, note: 'Omega-3 rich — anti-inflammatory for recovery.',
  },
  {
    id: 4, name: 'Tuna (Canned)', category: 'protein',
    calories: 132, protein: 29, fat: 1, carbs: 0,
    recommend: true, note: 'Convenient lean protein, watch sodium.',
  },
  {
    id: 5, name: 'Eggs', category: 'protein',
    calories: 155, protein: 13, fat: 11, carbs: 1.1,
    recommend: true, note: 'Complete amino acid profile — perfect post-workout.',
  },
  {
    id: 6, name: 'Greek Yogurt', category: 'protein',
    calories: 59, protein: 10, fat: 0.4, carbs: 3.6,
    recommend: true, note: 'High protein, probiotic — great for gut health.',
  },
  {
    id: 7, name: 'Whey Protein', category: 'protein',
    calories: 366, protein: 72, fat: 5, carbs: 9,
    recommend: true, note: 'Fast-absorbing — ideal within the anabolic window.',
  },
  {
    id: 8, name: 'Beef Mince (Lean)', category: 'protein',
    calories: 178, protein: 23, fat: 10, carbs: 0,
    recommend: true, note: 'Iron-rich — good for oxygen transport.',
  },

  // ---- carbs / grains ----
  {
    id: 9, name: 'White Rice', category: 'carb',
    calories: 130, protein: 2.7, fat: 0.3, carbs: 28,
    recommend: true, note: 'Quick energy — great after intense training.',
  },
  {
    id: 10, name: 'Brown Rice', category: 'carb',
    calories: 112, protein: 2.6, fat: 0.9, carbs: 23,
    recommend: true, note: 'Fiber-rich — slower energy release.',
  },
  {
    id: 11, name: 'Oats', category: 'carb',
    calories: 68, protein: 2.4, fat: 1.1, carbs: 12,
    recommend: true, note: 'Beta-glucan fiber — great pre-workout fuel.',
  },
  {
    id: 12, name: 'Sweet Potato', category: 'carb',
    calories: 86, protein: 1.6, fat: 0.1, carbs: 20,
    recommend: true, note: 'Vitamin A & complex carbs — sustained energy.',
  },
  {
    id: 13, name: 'Banana', category: 'carb',
    calories: 89, protein: 1.1, fat: 0.3, carbs: 23,
    recommend: true, note: 'Potassium — prevents cramps, great pre-workout.',
  },

  // ---- healthy fats ----
  {
    id: 14, name: 'Avocado', category: 'fat',
    calories: 160, protein: 2, fat: 14.7, carbs: 8.5,
    recommend: true, note: 'Monounsaturated fats — heart-healthy.',
  },
  {
    id: 15, name: 'Almonds', category: 'fat',
    calories: 579, protein: 21, fat: 49, carbs: 22,
    recommend: true, note: 'Vitamin E & magnesium — but portion control is key.',
  },
  {
    id: 16, name: 'Olive Oil', category: 'fat',
    calories: 884, protein: 0, fat: 100, carbs: 0,
    recommend: true, note: 'Extra virgin preferred — anti-inflammatory.',
  },
  {
    id: 17, name: 'Peanut Butter', category: 'fat',
    calories: 588, protein: 25, fat: 50, carbs: 20,
    recommend: 'moderate', note: 'Good protein but high calorie — measure your scoops.',
  },

  // ---- vegetables ----
  {
    id: 18, name: 'Broccoli', category: 'veg',
    calories: 34, protein: 2.8, fat: 0.4, carbs: 7,
    recommend: true, note: 'Fiber + micronutrients — minimal calories, high volume.',
  },
  {
    id: 19, name: 'Spinach', category: 'veg',
    calories: 23, protein: 2.9, fat: 0.4, carbs: 3.6,
    recommend: true, note: 'Iron + magnesium — supports muscle contraction.',
  },
  {
    id: 20, name: 'Blueberries', category: 'veg',
    calories: 57, protein: 0.7, fat: 0.3, carbs: 14.5,
    recommend: true, note: 'Antioxidants — fight oxidative stress from training.',
  },

  // ---- treats (not recommended) ----
  {
    id: 21, name: 'Chocolate Bar', category: 'treat',
    calories: 546, protein: 4.9, fat: 31, carbs: 61,
    recommend: false, note: 'High sugar — save for post-training reward, not daily.',
  },
  {
    id: 22, name: 'Chips (Bag)', category: 'treat',
    calories: 536, protein: 6.5, fat: 33, carbs: 50,
    recommend: false, note: 'Empty calories and sodium — limit intake.',
  },
  {
    id: 23, name: 'Soda (Can)', category: 'treat',
    calories: 42, protein: 0, fat: 0, carbs: 10.6,
    recommend: false, note: 'Liquid sugar — spikes insulin, no nutritional value.',
  },
  {
    id: 24, name: 'Ice Cream', category: 'treat',
    calories: 207, protein: 3.5, fat: 10.8, carbs: 25,
    recommend: 'occasional', note: 'High sugar + fat — small portions only.',
  },
];

// Build a lookup map for O(1) access
const FOOD_MAP = new Map(FOOD_DB.map((f) => [f.name.toLowerCase(), f]));

// Sorted list of names for trie seeding
const FOOD_NAMES = FOOD_DB.map((f) => f.name);

function lookup(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return null;
  // Exact match first
  const exact = FOOD_MAP.get(key);
  if (exact) return exact;
  // Substring match — "chicken" → "Chicken Breast", "rice" → "White Rice"
  return FOOD_DB.find((f) => f.name.toLowerCase().includes(key)) || null;
}

function allFoods() {
  return FOOD_DB;
}

function recommend(caloriesBurned = 0, targetProtein = 0) {
  // After a workout, recommend high-protein + carb foods
  const suggestions = FOOD_DB.filter((f) => f.recommend === true);

  if (caloriesBurned > 300) {
    // Prioritize protein + quick carbs after intense training
    return suggestions
      .filter((f) => f.category === 'protein' || f.category === 'carb')
      .sort((a, b) => {
        // Higher protein first, then lower calories per gram of protein
        const ap = a.protein / a.calories;
        const bp = b.protein / b.calories;
        return bp - ap;
      })
      .slice(0, 5);
  }

  // Rest of day: balanced suggestions
  return suggestions
    .filter((f) => f.category !== 'treat' || f.recommend === 'occasional')
    .sort((a, b) => a.calories - b.calories)
    .slice(0, 5);
}

// Daily intake targets used by the food scanner / tracker.
const DAILY_TARGETS = {
  calories: 2200,
  protein: 150,
  carbs: 250,
  fat: 70,
};

// Scale per-100g nutrition facts up/down to an actual portion weight.
function scaleNutrition(food, grams = 100) {
  const g = Math.max(0, Number(grams) || 0);
  const f = g / 100;
  return {
    grams: Math.round(g),
    calories: Math.round(food.calories * f),
    protein: Math.round(food.protein * f * 10) / 10,
    fat: Math.round(food.fat * f * 10) / 10,
    carbs: Math.round(food.carbs * f * 10) / 10,
  };
}

module.exports = { FOOD_DB, FOOD_MAP, FOOD_NAMES, DAILY_TARGETS, lookup, allFoods, recommend, scaleNutrition };
