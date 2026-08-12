'use strict';
// ============================================================
// EXERCISE CATALOG — the "every muscle task" 3D form library.
// Each entry carries an `id` (used by the KD-Tree form engine),
// a muscle group, and a keyword that resolves to an animated 3D
// pose pair in the frontend's vector3d renderer.
// ============================================================

const CATALOG = [
  // ---- legs ----
  { id: 1, name: 'Back Squat', muscle: 'Quads · Glutes', keyword: 'squat', equipment: 'barbell', compound: true },
  { id: 2, name: 'Front Squat', muscle: 'Quads · Core', keyword: 'squat', equipment: 'barbell', compound: true },
  { id: 3, name: 'Romanian Deadlift', muscle: 'Hamstrings · Glutes', keyword: 'deadlift', equipment: 'barbell', compound: true },
  { id: 4, name: 'Conventional Deadlift', muscle: 'Posterior Chain', keyword: 'deadlift', equipment: 'barbell', compound: true },
  { id: 5, name: 'Bulgarian Split Squat', muscle: 'Quads · Glutes', keyword: 'lunge', equipment: 'dumbbell', compound: true },
  { id: 6, name: 'Walking Lunge', muscle: 'Quads · Glutes', keyword: 'lunge', equipment: 'dumbbell', compound: true },
  { id: 7, name: 'Leg Press', muscle: 'Quads · Glutes', keyword: 'squat', equipment: 'machine', compound: true },
  { id: 8, name: 'Calf Raise', muscle: 'Calves', keyword: 'squat', equipment: 'machine', compound: false },

  // ---- chest ----
  { id: 9, name: 'Bench Press', muscle: 'Chest · Triceps', keyword: 'bench', equipment: 'barbell', compound: true },
  { id: 10, name: 'Incline Bench Press', muscle: 'Upper Chest · Shoulders', keyword: 'bench', equipment: 'barbell', compound: true },
  { id: 11, name: 'Push-up', muscle: 'Chest · Core', keyword: 'push', equipment: 'bodyweight', compound: true },
  { id: 12, name: 'Chest Fly', muscle: 'Chest', keyword: 'bench', equipment: 'cable', compound: false },

  // ---- back ----
  { id: 13, name: 'Pull-up', muscle: 'Back · Biceps', keyword: 'pull', equipment: 'bodyweight', compound: true },
  { id: 14, name: 'Chin-up', muscle: 'Biceps · Back', keyword: 'pull', equipment: 'bodyweight', compound: true },
  { id: 15, name: 'Barbell Row', muscle: 'Back · Rear Delts', keyword: 'row', equipment: 'barbell', compound: true },
  { id: 16, name: 'Pendlay Row', muscle: 'Back · Core', keyword: 'row', equipment: 'barbell', compound: true },
  { id: 17, name: 'Cable Row', muscle: 'Back · Lats', keyword: 'row', equipment: 'cable', compound: true },

  // ---- shoulders ----
  { id: 18, name: 'Overhead Press', muscle: 'Shoulders · Triceps', keyword: 'overhead', equipment: 'barbell', compound: true },
  { id: 19, name: 'Push Press', muscle: 'Shoulders · Legs', keyword: 'overhead', equipment: 'barbell', compound: true },
  { id: 20, name: 'Lateral Raise', muscle: 'Side Delts', keyword: 'overhead', equipment: 'dumbbell', compound: false },
  { id: 21, name: 'Face Pull', muscle: 'Rear Delts · Rotator Cuff', keyword: 'overhead', equipment: 'cable', compound: false },

  // ---- arms ----
  { id: 22, name: 'Barbell Curl', muscle: 'Biceps', keyword: 'pull', equipment: 'barbell', compound: false },
  { id: 23, name: 'Triceps Push-down', muscle: 'Triceps', keyword: 'overhead', equipment: 'cable', compound: false },
  { id: 24, name: 'Skull Crusher', muscle: 'Triceps', keyword: 'bench', equipment: 'barbell', compound: false },

  // ---- core ----
  { id: 25, name: 'Plank', muscle: 'Core', keyword: 'push', equipment: 'bodyweight', compound: false },
  { id: 26, name: 'Hanging Leg Raise', muscle: 'Abs · Hip Flexors', keyword: 'pull', equipment: 'bodyweight', compound: false },
  { id: 27, name: 'Hip Thrust', muscle: 'Glutes', keyword: 'squat', equipment: 'barbell', compound: true },
];

const MUSCLE_GROUPS = [
  { key: 'legs', label: 'LEGS', exercises: CATALOG.filter((e) => [1, 2, 3, 4, 5, 6, 7, 8].includes(e.id)) },
  { key: 'chest', label: 'CHEST', exercises: CATALOG.filter((e) => [9, 10, 11, 12].includes(e.id)) },
  { key: 'back', label: 'BACK', exercises: CATALOG.filter((e) => [13, 14, 15, 16, 17].includes(e.id)) },
  { key: 'shoulders', label: 'SHOULDERS', exercises: CATALOG.filter((e) => [18, 19, 20, 21].includes(e.id)) },
  { key: 'arms', label: 'ARMS', exercises: CATALOG.filter((e) => [22, 23, 24].includes(e.id)) },
  { key: 'core', label: 'CORE', exercises: CATALOG.filter((e) => [25, 26, 27].includes(e.id)) },
];

function catalog() {
  return CATALOG.map(({ id, name, muscle, keyword, equipment, compound }) => ({ id, name, muscle, keyword, equipment, compound }));
}

module.exports = { CATALOG, MUSCLE_GROUPS, catalog };
