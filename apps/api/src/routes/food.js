'use strict';
// GET  /api/food/scan?name=chicken breast  — scan a food by name
// GET  /api/food/scan?q=chicken            — autocomplete prefix
// GET  /api/food/list                      — full list with recommendations
const router = require('express').Router();
const foodDb = require('../services/foodDatabase');

// GET /api/food/scan?name=...
router.get('/food/scan', (req, res) => {
  const { name, q } = req.query;

  // If q is provided, return autocomplete suggestions from the Trie
  if (q) {
    const trie = require('../services/searchService');
    const suggestions = trie.suggestFoods(q, 8);
    return res.json({ query: q, suggestions });
  }

  // If name is provided, look up full nutrition info + recommendation
  if (name) {
    const food = foodDb.lookup(name);
    if (!food) {
      return res.status(404).json({ error: 'food not found', name });
    }
    return res.json({
      food,
      recommendation: analyzeFood(food, { calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat, grams: 100 }),
    });
  }

  // No params — return a sample scan prompt
  return res.json({ prompt: 'Scan a food by name: /api/food/scan?name=chicken breast' });
});

// GET /api/food/list
router.get('/food/list', (req, res) => {
  const { kcal } = req.query;
  const burned = kcal ? parseInt(kcal, 10) : 0;
  return res.json({
    foods: foodDb.allFoods(),
    recommendations: foodDb.recommend(burned, 0),
  });
});

// POST /api/food/analyze — analyze a food by name, quantity (grams),
// and the user's context (calories burned today + what's already eaten).
router.post('/food/analyze', (req, res) => {
  const { name, grams, kcalBurned, daily } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const food = foodDb.lookup(name);
  if (!food) {
    return res.status(404).json({ error: 'food not found', name });
  }

  const scaled = foodDb.scaleNutrition(food, grams);
  const dailyIntake = normalizeDaily(daily);

  return res.json({
    food,
    grams: scaled.grams,
    scaled,
    daily: dailyIntake,
    targets: foodDb.DAILY_TARGETS,
    recommendation: analyzeFood(food, scaled, kcalBurned || 0, dailyIntake),
  });
});

// POST /api/food/analyze-image — identify food from a camera photo via
// Gemini vision, then run the same nutrition/recommendation pipeline.
router.post('/food/analyze-image', async (req, res) => {
  const { image, mimeType = 'image/jpeg', grams, kcalBurned, daily } = req.body;
  if (!image) return res.status(400).json({ error: 'image (base64) is required' });

  const vision = require('../services/visionAnalyzer');
const { clampGrams } = vision;
  try {
    const guess = await vision.identifyFood(image, mimeType);
    if (!guess.name) {
      return res.status(422).json({
        error: 'could not identify food in this image — try a clearer shot',
        guess,
      });
    }

    const food = foodDb.lookup(guess.name);
    if (!food) {
      return res.status(404).json({
        error: `identified "${guess.name}" but it is not in the neural food database`,
        guess,
      });
    }

    const portion = grams ? clampGrams(grams) : (guess.grams || 100);
    const scaled = foodDb.scaleNutrition(food, portion);
    const dailyIntake = normalizeDaily(daily);

    return res.json({
      food,
      grams: scaled.grams,
      scaled,
      daily: dailyIntake,
      targets: foodDb.DAILY_TARGETS,
      recommendation: analyzeFood(food, scaled, kcalBurned || 0, dailyIntake),
      identified: {
        name: guess.name,
        confidence: guess.confidence,
        portionEstimate: guess.grams,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'vision analysis failed' });
  }
});

/** Coerce the client's "already eaten today" totals into safe numbers. */
function normalizeDaily(daily) {
  const d = daily || {};
  return {
    calories: Math.max(0, Number(d.calories) || 0),
    protein: Math.max(0, Number(d.protein) || 0),
    carbs: Math.max(0, Number(d.carbs) || 0),
    fat: Math.max(0, Number(d.fat) || 0),
  };
}

/** Analyze a food portion and produce a go/no-go recommendation. */
function analyzeFood(food, scaled, kcalBurned = 0, daily = {}) {
  const reasons = [];
  let verdict = 'take';
  const targets = foodDb.DAILY_TARGETS;

  if (food.recommend === false) {
    verdict = 'skip';
    reasons.push(food.note);
  } else if (food.recommend === 'moderate') {
    verdict = 'moderate';
    reasons.push(food.note);
  } else if (food.recommend === 'occasional') {
    verdict = 'occasional';
    reasons.push(food.note);
  } else {
    reasons.push(food.note);
  }

  // Portion-size check — a "healthy" food in a huge portion is still a lot.
  if (scaled.calories > 400 && food.category !== 'protein') {
    verdict = verdict === 'take' ? 'moderate' : verdict;
    reasons.push(`That portion is ${scaled.calories} kcal — consider a smaller serving.`);
  }

  // Calorie budget check against what's already eaten today.
  const remaining = Math.max(0, targets.calories - daily.calories);
  if (daily.calories > 0 && scaled.calories > remaining) {
    verdict = verdict === 'take' ? 'moderate' : verdict;
    reasons.push(`You've already eaten ${Math.round(daily.calories)} kcal today — this pushes you past your ${targets.calories} kcal target.`);
  }

  // Energy deficit from training → higher-calorie foods become more acceptable.
  if (kcalBurned > 300) {
    if (scaled.calories <= 500) {
      reasons.push(`You burned ~${Math.round(kcalBurned)} kcal training — this portion is well within your deficit.`);
    } else if (verdict === 'moderate') {
      reasons.push('Large portion after a big session — keep it balanced.');
    }
  }

  // Protein target check — advise based on what the user still needs.
  const proteinLeft = Math.max(0, targets.protein - daily.protein);
  if (proteinLeft > 0) {
    if (scaled.protein > 0 && scaled.protein >= proteinLeft * 0.5) {
      reasons.push(`Covers a big chunk of your remaining ${Math.round(proteinLeft)}g protein for today.`);
    } else if (food.category === 'protein' && scaled.protein < proteinLeft * 0.3) {
      reasons.push(`Low protein for this portion — you still need ${Math.round(proteinLeft)}g today.`);
    }
  } else if (food.category === 'protein' && daily.protein >= targets.protein) {
    reasons.push(`Protein target already hit (${Math.round(daily.protein)}g) — this is a bonus, not a need.`);
  }

  // Protein efficiency check
  const proteinPerCal = food.calories > 0 ? (food.protein * 4) / food.calories : 0;
  if (proteinPerCal > 0.45) {
    reasons.push('Excellent protein-to-calorie ratio.');
  }

  return { verdict, reasons, kcalBurned: Math.round(kcalBurned) };
}

module.exports = router;
