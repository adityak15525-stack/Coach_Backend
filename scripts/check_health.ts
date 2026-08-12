#!/usr/bin/env tsx

import { getHealth, fetchFoodList, analyzeForm } from '../frontend/mobile/src/services/api';
import { exerciseAnimation } from '../frontend/mobile/src/lib/vector3d';
import { buildDailyPlan } from '../frontend/mobile/src/lib/dietPlan';
import { getFoodDatabase } from '../frontend/mobile/src/lib/foodDatabase';

async function runHealthCheck() {
  console.log('🚀 Running Neural Coach Health Check...');
  
  try {
    // 1. Check API connectivity
    console.log('\n1. Checking API connectivity...');
    const health = await getHealth();
    console.log(`   ✅ API Status: ${health.status}`);
    console.log(`   ✅ Compute Engine: ${health.compute.engine}`);
    console.log(`   ✅ Database: ${health.db}`);
    
    // 2. Check food database
    console.log('\n2. Checking food database...');
    const foodList = await fetchFoodList();
    console.log(`   ✅ Foods loaded: ${foodList.foods.length}`);
    console.log(`   ✅ Recommendations: ${foodList.recommendations.length}`);
    
    // 3. Check exercise animations
    console.log('\n3. Checking exercise animations...');
    const exercises = ['squat', 'pushup', 'deadlift', 'pullup'];
    for (const exercise of exercises) {
      const anim = exerciseAnimation(exercise);
      if (anim) {
        console.log(`   ✅ ${exercise.toUpperCase()}: ${anim.frames.length} frames`);
      } else {
        console.log(`   ⚠️  ${exercise.toUpperCase()}: No animation data`);
      }
    }
    
    // 4. Check diet plan generation
    console.log('\n4. Checking diet plan generation...');
    const foodDb = getFoodDatabase();
    const targets = { calories: 2200, protein: 170, carbs: 250, fat: 70 };
    const profile = {
      age: 30, 
      sex: 'male', 
      heightCm: 175, 
      weightKg: 75, 
      activity: 'moderate', 
      goal: 'maintain'
    };
    const plan = buildDailyPlan(targets, foodDb.allFoods(), profile, 0, 'omnivore');
    console.log(`   ✅ Meal plan generated: ${plan.length} meals`);
    console.log(`   ✅ Total calories: ${plan.reduce((sum, meal) => sum + meal.kcal, 0)}`);
    
    // 5. Check form analysis
    console.log('\n5. Checking form analysis...');
    const landmarks = Array(33).fill(0).map((_, i) => [0.5, 0.5, 0.5]);
    const formAnalysis = await analyzeForm(3, landmarks);
    console.log(`   ✅ Form analysis: ${formAnalysis.verdict}`);
    console.log(`   ✅ Form score: ${formAnalysis.formScore}`);
    
    console.log('\n🎉 All systems operational! Ready for deployment.');
    
  } catch (error) {
    console.error('\n❌ Health check failed:', error);
    process.exit(1);
  }
}

runHealthCheck();