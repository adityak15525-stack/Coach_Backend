-- ============================================================
-- HYPER-ADAPTIVE LIFTING COACH — MySQL Schema
-- Engine: InnoDB, charset utf8mb4
-- ============================================================
CREATE DATABASE IF NOT EXISTS ai_coach
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ai_coach;

-- ------------------------------------------------------------
-- CORE: users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(80)  NOT NULL,
  avatar_url    VARCHAR(512) DEFAULT NULL,
  fitness_level ENUM('beginner','intermediate','advanced','elite') NOT NULL DEFAULT 'beginner',
  goal          ENUM('strength','hypertrophy','endurance','fat_loss','powerlifting') NOT NULL DEFAULT 'strength',
  height_cm     DECIMAL(5,2) DEFAULT NULL,
  weight_kg     DECIMAL(5,2) DEFAULT NULL,
  birth_year    SMALLINT UNSIGNED DEFAULT NULL,
  injury_flags  JSON DEFAULT NULL,            -- e.g. ["left_knee"] → KD-Tree risk bias
  timezone      VARCHAR(64) NOT NULL DEFAULT 'UTC',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_users_fitness (fitness_level)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CORE: body metrics (weight / body-fat trajectory)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS body_metrics (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  weight_kg   DECIMAL(5,2) NOT NULL,
  body_fat_pct DECIMAL(4,1) DEFAULT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_body_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_body_user_time (user_id, recorded_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CATALOG: exercises + muscle mapping
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercises (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug          VARCHAR(80) NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  equipment     ENUM('barbell','dumbbell','machine','cable','bodyweight','kettlebell') DEFAULT 'barbell',
  movement      ENUM('push','pull','squat','hinge','lunge','carry','isolation') NOT NULL,
  primary_muscle   VARCHAR(40) NOT NULL,
  secondary_muscle JSON DEFAULT NULL,
  is_compound      BOOLEAN NOT NULL DEFAULT TRUE,
  perfect_form_json JSON NOT NULL,           -- array of 33 "perfect form" joint vectors for KD-Tree
  risk_weights_json JSON DEFAULT NULL,       -- per-joint tolerance, overridden by user injury_flags
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- CATALOG: one perfect-form "take" per exercise (KD-Tree dataset rows)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_templates (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  exercise_id BIGINT UNSIGNED NOT NULL,
  phase       ENUM('setup','eccentric','bottom','concentric','lockout') NOT NULL,
  joint_vector_json JSON NOT NULL,           -- 33 landmarks: [x,y,z, visibility]
  confidence  DECIMAL(4,3) NOT NULL DEFAULT 1.0,
  CONSTRAINT fk_tpl_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
  KEY idx_tpl_exercise_phase (exercise_id, phase)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SESSIONS: a workout session (live session ledger)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  plan_id       BIGINT UNSIGNED DEFAULT NULL,     -- the weekly_split that spawned it
  title         VARCHAR(120) NOT NULL,
  status        ENUM('scheduled','active','paused','completed','aborted') NOT NULL DEFAULT 'scheduled',
  started_at    TIMESTAMP NULL DEFAULT NULL,
  ended_at      TIMESTAMP NULL DEFAULT NULL,
  total_volume_kg DOUBLE GENERATED ALWAYS AS (0) STORED,
  avg_form_quality DECIMAL(4,3) DEFAULT NULL,
  injury_risk_score DECIMAL(5,3) DEFAULT NULL,    -- 0..100 composite from KD-Tree deviations
  kcal_burned   INT UNSIGNED DEFAULT 0,
  voice_script_json JSON DEFAULT NULL,            -- GenAI synthesized summary/script
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sess_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_sess_user_time (user_id, started_at),
  KEY idx_sess_status (status)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SETS: per-exercise set logs with form telemetry
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_sets (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id      BIGINT UNSIGNED NOT NULL,
  exercise_id     BIGINT UNSIGNED NOT NULL,
  set_number      TINYINT UNSIGNED NOT NULL,
  reps            SMALLINT UNSIGNED NOT NULL,
  weight_kg       DECIMAL(6,2) NOT NULL DEFAULT 0,
  rpe             DECIMAL(3,1) DEFAULT NULL,
  form_quality    DECIMAL(4,3) DEFAULT NULL,      -- 0..1 from KD-Tree best-match
  max_deviation_mm DECIMAL(7,2) DEFAULT NULL,     -- worst joint deviation
  deviation_json  JSON DEFAULT NULL,              -- top-N deviations per phase
  fatigue_delta   DECIMAL(4,3) DEFAULT NULL,      -- muscle-fatigue delta contributed
  is_pr           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_set_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_set_exercise FOREIGN KEY (exercise_id) REFERENCES exercises(id),
  KEY idx_set_session (session_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- TELEMETRY: raw form events (frame-level, aggregated on flush)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_events (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  set_id        BIGINT UNSIGNED NOT NULL,
  phase         ENUM('setup','eccentric','bottom','concentric','lockout') NOT NULL,
  kd_match_distance DOUBLE NOT NULL,             -- raw nearest-neighbor distance
  deviating_joints JSON NOT NULL,                -- e.g. [{"joint":"left_knee","mm":42,"dir":"valgus"}]
  verdict       ENUM('perfect','minor','moderate','severe') NOT NULL,
  advice_key    VARCHAR(80) DEFAULT NULL,        -- lookup into coaching hint catalog
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evt_set FOREIGN KEY (set_id) REFERENCES workout_sets(id) ON DELETE CASCADE,
  KEY idx_evt_set (set_id),
  KEY idx_evt_verdict (verdict)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- MATH ENGINE: weekly split (DP scheduler output + provenance)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weekly_splits (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  week_start    DATE NOT NULL,
  hours_available DECIMAL(4,2) NOT NULL,
  objective     JSON NOT NULL,                   -- {strength, volume targets...}
  schedule_json JSON NOT NULL,                   -- day → [exercises]
  dp_score      DOUBLE NOT NULL,                 -- optimality score from DP
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_split_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_split_user_week (user_id, week_start)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- MATH ENGINE: per-muscle fatigue ledger (feeds DP constraints)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS muscle_fatigue (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  muscle        VARCHAR(40) NOT NULL,
  fatigue_level DECIMAL(5,3) NOT NULL DEFAULT 0,  -- 0..100
  decay_rate    DECIMAL(5,4) NOT NULL DEFAULT 0.02,
  last_touched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fatigue_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_fatigue_user_muscle (user_id, muscle)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- AGENTIC LAYER: nutrition plans (Nutrition Agent output)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nutrition_plans (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  plan_date     DATE NOT NULL,
  target_kcal   INT NOT NULL,
  protein_g     SMALLINT NOT NULL,
  carbs_g       SMALLINT NOT NULL,
  fat_g         SMALLINT NOT NULL,
  meals_json    JSON NOT NULL,                   -- [{meal, items, macros}]
  rationale     TEXT DEFAULT NULL,               -- LLM rationale
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_meal_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_meal_user_date (user_id, plan_date)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- AGENTIC LAYER: grocery carts (Logistics Agent simulation)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grocery_carts (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  nutrition_plan_id BIGINT UNSIGNED NOT NULL,
  store         VARCHAR(80) NOT NULL,
  items_json    JSON NOT NULL,                   -- [{sku, name, qty, est_price, stock}]
  total_estimate DECIMAL(8,2) DEFAULT NULL,
  fulfilled     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_plan FOREIGN KEY (nutrition_plan_id) REFERENCES nutrition_plans(id) ON DELETE CASCADE,
  KEY idx_cart_user (user_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- AGENTIC LAYER: long-term agent memory (RAG-able)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_memory (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  agent         ENUM('nutrition','logistics','form','summarizer','scheduler') NOT NULL,
  kind          ENUM('fact','preference','feedback','event','insight') NOT NULL,
  payload_json  JSON NOT NULL,
  embedding     JSON DEFAULT NULL,                -- stored embeddings (TiDB/MySQL/MariaDB compatible)
  importance    TINYINT UNSIGNED NOT NULL DEFAULT 5, -- decay weight for memory compaction
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mem_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_mem_user_agent (user_id, agent)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- GAMIFICATION: streak + XP ledger
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS streak_stats (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  current_streak_days INT UNSIGNED NOT NULL DEFAULT 0,
  longest_streak_days INT UNSIGNED NOT NULL DEFAULT 0,
  total_xp       INT UNSIGNED NOT NULL DEFAULT 0,
  last_workout_on DATE DEFAULT NULL,
  CONSTRAINT fk_streak_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_streak_user (user_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- GAMIFICATION: XP events (each logged set awards XP)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS xp_events (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  amount     SMALLINT UNSIGNED NOT NULL,
  reason     VARCHAR(80) NOT NULL,                -- e.g. 'set_completed','form_perfect','pr_lifted'
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_xp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_xp_user_time (user_id, created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- COACHING: persisted AI coaching messages (voice scripts)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coaching_messages (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  channel     ENUM('voice','push','ui') NOT NULL DEFAULT 'ui',
  text        TEXT NOT NULL,
  voice_script JSON DEFAULT NULL,                -- SSML / phoneme-timed cues
  ref_set_id  BIGINT UNSIGNED DEFAULT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_coach_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_coach_user_time (user_id, created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Optional: MySQL HeatWave vector index for agent_memory.embedding
-- CREATE VECTOR INDEX vec_mem ON agent_memory (embedding) ORGANIZATION INVERTED;
-- (skip silently on non-HeatWave engines)
-- ------------------------------------------------------------
