/**
 * Calculates how much work still needs to be scheduled.
 *
 * Completed tasks reduce unfinished work.
 * Pending replacement tasks with reschedule lineage are
 * protected and also reduce the amount requiring regeneration.
 * Ordinary pending tasks are ignored because they will be
 * deleted and rebuilt.
 */
function calculateRemainingTopics({
  topics = [],
  tasks = [],
}) {
  const completedMinutesByTopic = new Map();
  const protectedPendingMinutesByTopic = new Map();

  for (const task of tasks) {
    const topicId = Number(task.topic_id);
    const minutes = Number(task.estimated_minutes);

    if (
      !Number.isFinite(topicId) ||
      !Number.isFinite(minutes) ||
      minutes <= 0
    ) {
      continue;
    }

    if (task.status === "completed") {
      const currentCompleted =
        completedMinutesByTopic.get(topicId) || 0;

      completedMinutesByTopic.set(
        topicId,
        currentCompleted + minutes
      );
    }

    const isProtectedReplacement =
      task.status === "pending" &&
      task.rescheduled_from_task_id !== null &&
      task.rescheduled_from_task_id !== undefined;

    if (isProtectedReplacement) {
      const currentProtected =
        protectedPendingMinutesByTopic.get(topicId) || 0;

      protectedPendingMinutesByTopic.set(
        topicId,
        currentProtected + minutes
      );
    }
  }

  const remainingTopics = [];

  let totalPlannedMinutes = 0;
  let totalCompletedMinutes = 0;
  let totalProtectedPendingMinutes = 0;
  let totalRemainingMinutes = 0;

  for (const topic of topics) {
    const topicId = Number(topic.id);

    const plannedMinutes = Math.max(
      Number(topic.estimated_minutes) || 0,
      0
    );

    const rawCompletedMinutes =
      completedMinutesByTopic.get(topicId) || 0;

    const completedMinutes = Math.min(
      rawCompletedMinutes,
      plannedMinutes
    );

    const availableAfterCompletion = Math.max(
      plannedMinutes - completedMinutes,
      0
    );

    const rawProtectedPendingMinutes =
      protectedPendingMinutesByTopic.get(topicId) || 0;

    const protectedPendingMinutes = Math.min(
      rawProtectedPendingMinutes,
      availableAfterCompletion
    );

    const remainingMinutes = Math.max(
      plannedMinutes -
        completedMinutes -
        protectedPendingMinutes,
      0
    );

    totalPlannedMinutes += plannedMinutes;
    totalCompletedMinutes += completedMinutes;
    totalProtectedPendingMinutes +=
      protectedPendingMinutes;
    totalRemainingMinutes += remainingMinutes;

    if (remainingMinutes > 0) {
      remainingTopics.push({
        ...topic,
        estimated_minutes: remainingMinutes,
        original_estimated_minutes: plannedMinutes,
        completed_minutes: completedMinutes,
        protected_pending_minutes:
          protectedPendingMinutes,
      });
    }
  }

  return {
    topics: remainingTopics,
    totalPlannedMinutes,
    totalCompletedMinutes,
    totalProtectedPendingMinutes,
    totalRemainingMinutes,
  };
}

module.exports = {
  calculateRemainingTopics,
};