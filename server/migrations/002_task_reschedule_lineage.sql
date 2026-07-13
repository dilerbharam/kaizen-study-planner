/*
 * Adds traceability between skipped tasks and the
 * replacement tasks created during rescheduling.
 *
 * Existing legacy records are not automatically linked
 * because matching historical tasks by text may be
 * ambiguous. Any required legacy correction should be
 * reviewed and applied manually.
 */

BEGIN;

ALTER TABLE tasks
ADD COLUMN rescheduled_from_task_id integer;

ALTER TABLE tasks
ADD COLUMN rescheduled_at timestamp with time zone;

ALTER TABLE tasks
ADD CONSTRAINT tasks_rescheduled_from_fk
FOREIGN KEY (rescheduled_from_task_id)
REFERENCES tasks(id)
ON DELETE SET NULL;

ALTER TABLE tasks
ADD CONSTRAINT tasks_no_self_reschedule
CHECK (
  rescheduled_from_task_id IS NULL
  OR rescheduled_from_task_id <> id
);

CREATE INDEX tasks_rescheduled_from_task_idx
ON tasks(rescheduled_from_task_id);

COMMIT;