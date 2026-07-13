/**
 * Calculates the unfinished duration of every topic.
 *
 * Completed task minutes reduce the remaining work.
 * Pending and skipped tasks do not count as completed.
 */
function calculateRemainingTopics({
  topics = [],
  tasks = [],
}) {
  const completedMinutesByTopic = new Map();

  for (const task of tasks) {
    if (task.status !== "completed") {
      continue;
    }

    const topicId = Number(task.topic_id);
    const minutes = Number(task.estimated_minutes);

    if (
      !Number.isFinite(topicId) ||
      !Number.isFinite(minutes) ||
      minutes <= 0
    ) {
      continue;
    }

    const currentMinutes =
      completedMinutesByTopic.get(topicId) || 0;

    completedMinutesByTopic.set(
      topicId,
      currentMinutes + minutes
    );
  }

  const remainingTopics = [];

  let totalPlannedMinutes = 0;
  let totalCompletedMinutes = 0;
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

    const remainingMinutes = Math.max(
      plannedMinutes - completedMinutes,
      0
    );

    totalPlannedMinutes += plannedMinutes;
    totalCompletedMinutes += completedMinutes;
    totalRemainingMinutes += remainingMinutes;

    if (remainingMinutes > 0) {
      remainingTopics.push({
        ...topic,
        estimated_minutes: remainingMinutes,
        original_estimated_minutes:
          plannedMinutes,
        completed_minutes:
          completedMinutes,
      });
    }
  }

  return {
    topics: remainingTopics,
    totalPlannedMinutes,
    totalCompletedMinutes,
    totalRemainingMinutes,
  };
}

module.exports = {
  calculateRemainingTopics,
};