/**
 * Ownership lookup helpers.
 *
 * Each helper returns the requested resource only when it belongs to the
 * authenticated user. Returning null for both "missing" and "owned by
 * another user" avoids exposing whether another user's resource exists.
 */

async function findOwnedGoal(
  db,
  goalId,
  userId
) {
  const result = await db.query(
    `SELECT *
     FROM goals
     WHERE id = $1
       AND user_id = $2`,
    [goalId, userId]
  );

  return result.rows[0] || null;
}

async function findOwnedMilestone(
  db,
  milestoneId,
  userId
) {
  const result = await db.query(
    `SELECT milestones.*
     FROM milestones
     JOIN goals
       ON milestones.goal_id = goals.id
     WHERE milestones.id = $1
       AND goals.user_id = $2`,
    [milestoneId, userId]
  );

  return result.rows[0] || null;
}

async function findOwnedTask(
  db,
  taskId,
  userId
) {
  const result = await db.query(
    `SELECT
       tasks.*,
       goals.id AS goal_id,
       goals.user_id,
       goals.target_date
     FROM tasks
     JOIN topics
       ON tasks.topic_id = topics.id
     JOIN milestones
       ON topics.milestone_id =
          milestones.id
     JOIN goals
       ON milestones.goal_id = goals.id
     WHERE tasks.id = $1
       AND goals.user_id = $2`,
    [taskId, userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  findOwnedGoal,
  findOwnedMilestone,
  findOwnedTask,
};
