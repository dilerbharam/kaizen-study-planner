/*
 * Migrates availability from one shared user-level profile
 * to separate availability profiles for each learning goal.
 */

BEGIN;

ALTER TABLE availability
ADD COLUMN goal_id integer;

ALTER TABLE availability
ADD CONSTRAINT availability_goal_fk
FOREIGN KEY (goal_id)
REFERENCES goals(id)
ON DELETE CASCADE;

/*
 * Copy the existing user availability profile to each
 * existing goal before removing the old shared rows.
 */
INSERT INTO availability (
  user_id,
  goal_id,
  day_of_week,
  available_minutes
)
SELECT
  goals.user_id,
  goals.id,
  availability.day_of_week,
  availability.available_minutes
FROM goals
CROSS JOIN availability
WHERE availability.goal_id IS NULL;

DELETE FROM availability
WHERE goal_id IS NULL;

ALTER TABLE availability
ALTER COLUMN goal_id SET NOT NULL;

ALTER TABLE availability
ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE availability
ADD CONSTRAINT availability_goal_day_unique
UNIQUE (goal_id, day_of_week);

COMMIT;