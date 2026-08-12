'use strict';
// ============================================================
// AGENT ORCHESTRATOR — fires the Python agent swarm.
// 1. NutritionAgent consumes calories burned from MySQL.
// 2. LogisticsAgent simulates the grocery cart.
// 3. Summarizer synthesizes everything (KD-Tree verdict +
//    agent actions) into an engaging voice script.
// Falls back to a deterministic local plan if agents are down.
// ============================================================
const { env } = require('../config/env');

async function callAgents(endpoint, payload, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.agents.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`agents ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Orchestrate the full swarm for a day's summary
async function runSwarm({ userId, kcalBurned, formVerdict, date }) {
  try {
    const nutrition = await callAgents('/run/nutrition', { userId, kcalBurned, date });
    const cart = await callAgents('/run/logistics', { userId, nutritionPlanId: nutrition.plan_id, store: 'Instacart' });
    const summary = await callAgents('/run/summarize', {
      userId, date,
      nutrition,
      logistics: cart,
      form: formVerdict,
    });
    return { source: 'agent-swarm', nutrition, cart, summary };
  } catch (err) {
    // deterministic fallback keeps the API alive when agents are down
    return {
      source: 'local-fallback',
      nutrition: { target_kcal: Math.round(kcalBurned * 1.25), protein_g: 180, note: 'fallback plan' },
      cart: { items: ['chicken breast', 'rice', 'broccoli', 'olive oil'], total_estimate: 52.4 },
      summary: {
        script:
          'Great session today, ' +
          (formVerdict.verdict === 'perfect'
            ? 'flawless form on every rep.'
            : 'solid effort with some ' + (formVerdict.deviations?.[0]?.joint || 'alignment') + ' work to do.') +
          ' You burned ' + kcalBurned + ' kcal — here is the refuel: 180g protein, one grocery run, zero excuses.',
      },
    };
  }
}

module.exports = { runSwarm, callAgents };
