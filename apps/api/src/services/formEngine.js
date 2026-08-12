'use strict';
// ============================================================
// FORM ENGINE — the Vision Layer's brain.
//  1. C++ KD-Tree (Node-API) holds the "perfect form" corpus.
//  2. Live 33-landmark frames hit the tree → nearest template.
//  3. Per-joint deviation analysis → verdict + coaching cue.
//  4. Sliding-window tracks form trend across the set.
//  LRU cache keeps the hot exercise index pinned during a session.
// ============================================================
const compute = require('@ai-coach/compute');
const { SlidingWindowStats } = require('@ai-coach/dsa');
const LRUCache = require('@ai-coach/dsa').LRUCache;

const LANDMARKS = 33;
const DIM = LANDMARKS * 3;

// Joint names (MediaPipe pose order, simplified)
const JOINT_NAMES = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
  'left_heel', 'right_heel', 'left_foot_index', 'right_foot_index',
  'left_pinky', 'right_pinky', 'left_index', 'right_index',
  'left_thumb', 'right_thumb', 'left_hip_extra', 'right_hip_extra',
  'left_shoulder_extra', 'right_shoulder_extra', 'forehead', 'chin',
];

const PHASES = ['setup', 'eccentric', 'bottom', 'concentric', 'lockout'];

// KD-Tree `nn.distance` is a Euclidean distance over 99 dims (33 joints × 3
// coords). Calibrated against the synthetic corpus: a clean frame lands near
// ~0.115, a clearly broken rep (knee valgus + back rounding) near ~0.34.
const DIST_PERFECT = 0.16;  // clean form
const DIST_MINOR = 0.22;    // small drift
const DIST_MODERATE = 0.29; // watch the joint
const DIST_SEVERE = 0.35;   // broken rep — stop

// Thresholds: distance → verdict
const VERDICT_TABLE = [
  { max: DIST_PERFECT, verdict: 'perfect', advice: 'Keep it exactly like this.' },
  { max: DIST_MINOR, verdict: 'minor', advice: 'Small drift — brace your core.' },
  { max: DIST_MODERATE, verdict: 'moderate', advice: 'Watch the {joint} — tighten up.' },
  { max: Infinity, verdict: 'severe', advice: 'Stop the rep. Reset and re-engage {joint}.' },
];

const indexCache = new LRUCache(8); // exerciseId → { index, vectors: Map<id, flat> }
const trendCache = new Map();       // sessionId → SlidingWindowStats

function landmarkArrayToFlat(landmarks) {
  const flat = new Float64Array(DIM);
  for (let i = 0; i < LANDMARKS && i < landmarks.length; i++) {
    const l = landmarks[i] || [0, 0, 0, 0];
    flat[i * 3] = l[0];
    flat[i * 3 + 1] = l[1];
    flat[i * 3 + 2] = l[2];
  }
  return Array.from(flat);
}

// Generate a realistic synthetic "perfect form" corpus for an exercise
// (used when the DB isn't seeded). Each template = normalized joint angles.
function syntheticTemplates(exerciseId, count = 400) {
  let seed = (exerciseId * 7919) % 100000;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return ((seed >> 16) & 0x7fff) / 32768;
  };
  const points = [];
  const ids = [];
  const phases = [];
  for (let i = 0; i < count; i++) {
    const phase = i % 5;
    const v = new Array(DIM);
    // base pose: z-axis squat pattern with jitter
    const depth = [0.1, 0.4, 0.7, 0.4, 0.1][phase];
    for (let d = 0; d < DIM; d += 3) {
      const j = d / 3;
      const x = Math.sin(j) * 0.5 + rnd() * 0.02 - 0.01;
      const y = (j % 8) / 8 - depth * 0.3 + rnd() * 0.02 - 0.01;
      const z = depth * 0.6 + rnd() * 0.02 - 0.01;
      v[d] = x; v[d + 1] = y; v[d + 2] = z;
    }
    points.push(v);
    ids.push(exerciseId * 100000 + i);
    phases.push(phase);
  }
  return { points, ids, phases };
}

function getIndex(exerciseId) {
  const cached = indexCache.get(exerciseId);
  if (cached !== undefined) return cached;
  const { points, ids, phases } = syntheticTemplates(exerciseId);
  const index = compute.buildIndex(DIM, points, ids, phases);
  const vectors = new Map();
  points.forEach((vec, i) => vectors.set(ids[i], vec));
  const entry = { index, vectors };
  indexCache.set(exerciseId, entry);
  return entry;
}

// Top-level analysis of one live frame against perfect form.
function analyzeFrame({ exerciseId, landmarks, sessionId }) {
  const { index, vectors } = getIndex(exerciseId);
  const query = landmarkArrayToFlat(landmarks);
  const nn = compute.nn(index, query);
  const nnFlat = vectors.get(nn.id) || new Array(DIM).fill(0);

  // per-joint deviation (in mm-ish normalized space)
  const deviations = [];
  for (let i = 0; i < LANDMARKS; i++) {
    const dx = query[i * 3] - nnFlat[i * 3];
    const dy = query[i * 3 + 1] - nnFlat[i * 3 + 1];
    const dz = query[i * 3 + 2] - nnFlat[i * 3 + 2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist > 0.03) {
      deviations.push({
        joint: JOINT_NAMES[i],
        mm: +(dist * 100).toFixed(1),
        direction: dx > 0 ? 'anterior' : dy > 0 ? 'superior' : 'medial',
      });
    }
  }
  deviations.sort((a, b) => b.mm - a.mm);

  const row = VERDICT_TABLE.find((r) => nn.distance <= r.max);
  let advice = row.advice.replace('{joint}', deviations[0]?.joint || 'alignment');

  // Quadratic falloff over the [perfect → severe] band so a clean rep reads
  // ~0.9+ and a broken rep drops to ~0.
  const formScore = clamp01(1 - Math.pow(nn.distance / DIST_SEVERE, 2));

  // sliding-window trend per session
  let trend = trendCache.get(sessionId);
  if (!trend) { trend = new SlidingWindowStats(10); trendCache.set(sessionId, trend); }
  trend.push(formScore);

  // risk ramps from 0 at clean form to 100% at the "broken rep" band
  const risk = +(clamp01((nn.distance - DIST_PERFECT) / (DIST_MODERATE - DIST_PERFECT)) * 100).toFixed(1);

  return {
    distance: +nn.distance.toFixed(5),
    phase: PHASES[nn.phase] || 'unknown',
    matchedTemplate: nn.id,
    formScore: +formScore.toFixed(3),
    trend: { mean: +trend.mean().toFixed(3), z: +trend.zScore(formScore).toFixed(2) },
    deviations: deviations.slice(0, 5),
    verdict: row.verdict,
    risk,
    advice,
  };
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

module.exports = { analyzeFrame, syntheticTemplates, DIM, LANDMARKS, PHASES, JOINT_NAMES };
