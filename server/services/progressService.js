const {
  calculateAvailableCapacity,
  normaliseDate,
} = require("./schedulingService");

/**
 * Calculates progress and deadline feasibility for a learning goal.
 */
function calculateGoalProgress({
  topics,
  tasks,
  availability,
  targetDate,
  currentDate = new Date(),
}) {
  const totalPlannedMinutes = topics.reduce(
    (total, topic) =>
      total + Number(topic.estimated_minutes),
    0
  );

  const rawCompletedMinutes = tasks
    .filter((task) => task.status === "completed")
    .reduce(
      (total, task) =>
        total + Number(task.estimated_minutes),
      0
    );

  // Prevent historical or duplicated task records from making
  // progress exceed the original planned learning duration.
  const completedMinutes = Math.min(
    rawCompletedMinutes,
    totalPlannedMinutes
  );

  const remainingMinutes = Math.max(
    totalPlannedMinutes - completedMinutes,
    0
  );

  const completionPercentage =
    totalPlannedMinutes === 0
      ? 0
      : Math.round(
          (completedMinutes / totalPlannedMinutes) * 100
        );

  const taskCounts = tasks.reduce(
    (counts, task) => {
      if (task.status === "completed") {
        counts.completed += 1;
      } else if (task.status === "skipped") {
        counts.skipped += 1;
      } else if (task.status === "pending") {
        counts.pending += 1;
      }

      return counts;
    },
    {
      completed: 0,
      pending: 0,
      skipped: 0,
    }
  );

  const today = normaliseDate(currentDate);
  const deadline = normaliseDate(targetDate);

  if (!today || !deadline) {
    return {
      valid: false,
      error: "The goal contains an invalid date.",
    };
  }

  const deadlinePassed = deadline < today;

  const availableMinutesBeforeDeadline = deadlinePassed
    ? 0
    : calculateAvailableCapacity(
        today,
        deadline,
        availability
      );

  const feasible =
    !deadlinePassed &&
    remainingMinutes <= availableMinutesBeforeDeadline;

  const capacityDifference =
    availableMinutesBeforeDeadline - remainingMinutes;

  let feasibilityStatus = "on-track";
  let feasibilityMessage =
    "The remaining work fits within the available study time.";

  if (remainingMinutes === 0) {
    feasibilityStatus = "completed";
    feasibilityMessage =
      "All planned learning minutes have been completed.";
  } else if (deadlinePassed) {
    feasibilityStatus = "deadline-passed";
    feasibilityMessage =
      "The target date has passed and unfinished work remains.";
  } else if (!feasible) {
    feasibilityStatus = "at-risk";
    feasibilityMessage =
      `${Math.abs(capacityDifference)} additional minutes ` +
      "are required before the target date.";
  }

  return {
    valid: true,
    totalPlannedMinutes,
    completedMinutes,
    remainingMinutes,
    completionPercentage,
    taskCounts,
    availableMinutesBeforeDeadline,
    feasible,
    deadlinePassed,
    capacityDifference,
    feasibilityStatus,
    feasibilityMessage,
  };
}

module.exports = {
  calculateGoalProgress,
};