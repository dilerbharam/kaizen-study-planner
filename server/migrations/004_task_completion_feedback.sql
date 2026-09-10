-- 004_task_completion_feedback.sql

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS actual_minutes INTEGER;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS difficulty_rating SMALLINT;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_actual_minutes_positive;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_actual_minutes_positive
  CHECK (
    actual_minutes IS NULL
    OR actual_minutes > 0
  );

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_difficulty_rating_range;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_difficulty_rating_range
  CHECK (
    difficulty_rating IS NULL
    OR difficulty_rating BETWEEN 1 AND 5
  );
