-- 006_gemini_ai_plan_provenance.sql
-- Records provenance for learner-reviewed AI-assisted plans.
-- The learner's AI prompt itself is deliberately not persisted.

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS plan_source VARCHAR(20)
  NOT NULL DEFAULT 'manual';

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(40);

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS ai_model VARCHAR(80);

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMPTZ;

ALTER TABLE goals
  DROP CONSTRAINT IF EXISTS goals_plan_source_allowed;

ALTER TABLE goals
  ADD CONSTRAINT goals_plan_source_allowed
  CHECK (
    plan_source IN (
      'manual',
      'ai_assisted'
    )
  );
