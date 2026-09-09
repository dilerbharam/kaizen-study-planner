-- 005_adaptive_estimation.sql
-- Records human-approved calibration state for Kaizen estimate adaptation.

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS estimation_multiplier NUMERIC(5,3)
  NOT NULL DEFAULT 1.000;

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS adaptation_feedback_count INTEGER
  NOT NULL DEFAULT 0;

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS adaptation_updated_at TIMESTAMPTZ;

ALTER TABLE goals
  DROP CONSTRAINT IF EXISTS goals_estimation_multiplier_range;

ALTER TABLE goals
  ADD CONSTRAINT goals_estimation_multiplier_range
  CHECK (
    estimation_multiplier >= 0.500
    AND estimation_multiplier <= 2.000
  );

ALTER TABLE goals
  DROP CONSTRAINT IF EXISTS goals_adaptation_feedback_count_nonnegative;

ALTER TABLE goals
  ADD CONSTRAINT goals_adaptation_feedback_count_nonnegative
  CHECK (adaptation_feedback_count >= 0);
