const {
  calculateAvailableCapacity,
  normaliseDate,
} = require("./schedulingService");

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function clamp(value, minimum, maximum) {
  return Math.min(
    Math.max(value, minimum),
    maximum
  );
}

function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort(
    (left, right) => left - right
  );

  const middle = Math.floor(
    sorted.length / 2
  );

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return (
    sorted[middle - 1] +
    sorted[middle]
  ) / 2;
}

function isFeedbackAfter(
  completedAt,
  lastAdaptationAt
) {
  if (!completedAt) {
    return false;
  }

  if (!lastAdaptationAt) {
    return true;
  }

  const completedDate =
    new Date(completedAt);

  const adaptationDate =
    new Date(lastAdaptationAt);

  if (
    Number.isNaN(
      completedDate.getTime()
    ) ||
    Number.isNaN(
      adaptationDate.getTime()
    )
  ) {
    return false;
  }

  return completedDate >
    adaptationDate;
}

function getNewFeedbackTasks(
  tasks,
  lastAdaptationAt
) {
  return tasks.filter((task) => {
    const estimated =
      Number(task.estimated_minutes);

    const actual =
      Number(task.actual_minutes);

    return (
      task.status === "completed" &&
      Number.isFinite(estimated) &&
      estimated > 0 &&
      Number.isFinite(actual) &&
      actual > 0 &&
      isFeedbackAfter(
        task.completed_at,
        lastAdaptationAt
      )
    );
  });
}

function buildTopicAccounting(
  topics,
  tasks,
  adjustmentMultiplier
) {
  const completedByTopic =
    new Map();

  const protectedByTopic =
    new Map();

  for (const task of tasks) {
    const topicId =
      Number(task.topic_id);

    const minutes =
      Number(task.estimated_minutes);

    if (
      !Number.isFinite(topicId) ||
      !Number.isFinite(minutes) ||
      minutes <= 0
    ) {
      continue;
    }

    if (
      task.status === "completed"
    ) {
      completedByTopic.set(
        topicId,
        (completedByTopic.get(
          topicId
        ) || 0) + minutes
      );
    }

    const protectedReplacement =
      task.status === "pending" &&
      task.rescheduled_from_task_id !==
        null &&
      task.rescheduled_from_task_id !==
        undefined;

    if (protectedReplacement) {
      protectedByTopic.set(
        topicId,
        (protectedByTopic.get(
          topicId
        ) || 0) + minutes
      );
    }
  }

  const affectedTopics = [];

  let baselineRemainingMinutes = 0;
  let adjustedRemainingMinutes = 0;

  for (const topic of topics) {
    const topicId =
      Number(topic.id);

    const plannedMinutes =
      Math.max(
        Number(
          topic.estimated_minutes
        ) || 0,
        0
      );

    const completedMinutes =
      Math.min(
        completedByTopic.get(
          topicId
        ) || 0,
        plannedMinutes
      );

    const availableAfterCompletion =
      Math.max(
        plannedMinutes -
          completedMinutes,
        0
      );

    const protectedMinutes =
      Math.min(
        protectedByTopic.get(
          topicId
        ) || 0,
        availableAfterCompletion
      );

    const ordinaryRemainingMinutes =
      Math.max(
        plannedMinutes -
          completedMinutes -
          protectedMinutes,
        0
      );

    if (
      ordinaryRemainingMinutes <= 0
    ) {
      continue;
    }

    const adjustedOrdinaryMinutes =
      Math.max(
        Math.round(
          ordinaryRemainingMinutes *
            adjustmentMultiplier
        ),
        1
      );

    const adjustedTotalMinutes =
      completedMinutes +
      protectedMinutes +
      adjustedOrdinaryMinutes;

    baselineRemainingMinutes +=
      ordinaryRemainingMinutes;

    adjustedRemainingMinutes +=
      adjustedOrdinaryMinutes;

    affectedTopics.push({
      id: topic.id,
      title: topic.title,
      completed_minutes:
        completedMinutes,
      protected_pending_minutes:
        protectedMinutes,
      baseline_remaining_minutes:
        ordinaryRemainingMinutes,
      adjusted_remaining_minutes:
        adjustedOrdinaryMinutes,
      current_total_minutes:
        plannedMinutes,
      adjusted_total_minutes:
        adjustedTotalMinutes,
      difference_minutes:
        adjustedOrdinaryMinutes -
        ordinaryRemainingMinutes,
    });
  }

  return {
    affectedTopics,
    baselineRemainingMinutes,
    adjustedRemainingMinutes,
  };
}

function calculateProtectedCapacity({
  tasks,
  startDate,
  targetDate,
}) {
  let protectedMinutes = 0;

  for (const task of tasks) {
    const protectedReplacement =
      task.status === "pending" &&
      task.rescheduled_from_task_id !==
        null &&
      task.rescheduled_from_task_id !==
        undefined;

    if (!protectedReplacement) {
      continue;
    }

    const taskDate =
      normaliseDate(
        task.scheduled_date
      );

    if (
      !taskDate ||
      taskDate < startDate ||
      taskDate > targetDate
    ) {
      continue;
    }

    protectedMinutes +=
      Math.max(
        Number(
          task.estimated_minutes
        ) || 0,
        0
      );
  }

  return protectedMinutes;
}

function calculateAdaptiveEstimate({
  topics = [],
  tasks = [],
  availability = [],
  targetDate,
  currentMultiplier = 1,
  lastAdaptationAt = null,
  currentDate = new Date(),
}) {
  const today =
    normaliseDate(currentDate);

  const deadline =
    normaliseDate(targetDate);

  if (!today || !deadline) {
    return {
      valid: false,
      error:
        "The goal contains an invalid date.",
    };
  }

  const feedbackTasks =
    getNewFeedbackTasks(
      tasks,
      lastAdaptationAt
    );

  const feedbackCount =
    feedbackTasks.length;

  const ratios =
    feedbackTasks.map(
      (task) =>
        Number(
          task.actual_minutes
        ) /
        Number(
          task.estimated_minutes
        )
    );

  const observedMedianRatio =
    median(ratios);

  const confidence =
    feedbackCount >= 3
      ? "high"
      : feedbackCount === 2
        ? "medium"
        : feedbackCount === 1
          ? "low"
          : "none";

  let adjustmentMultiplier = 1;

  if (
    observedMedianRatio !== null
  ) {
    const evidenceWeight =
      Math.min(
        feedbackCount / 3,
        1
      );

    adjustmentMultiplier =
      1 +
      (
        observedMedianRatio - 1
      ) *
      evidenceWeight;

    adjustmentMultiplier =
      clamp(
        adjustmentMultiplier,
        0.75,
        1.5
      );

    if (
      Math.abs(
        adjustmentMultiplier - 1
      ) < 0.05
    ) {
      adjustmentMultiplier = 1;
    }
  }

  adjustmentMultiplier =
    round(
      adjustmentMultiplier,
      2
    );

  const current =
    clamp(
      Number(currentMultiplier) ||
        1,
      0.5,
      2
    );

  const proposedCumulativeMultiplier =
    round(
      clamp(
        current *
          adjustmentMultiplier,
        0.5,
        2
      ),
      3
    );

  const topicAccounting =
    buildTopicAccounting(
      topics,
      tasks,
      adjustmentMultiplier
    );

  const grossCapacity =
    deadline < today
      ? 0
      : calculateAvailableCapacity(
          today,
          deadline,
          availability
        );

  const protectedMinutes =
    deadline < today
      ? 0
      : calculateProtectedCapacity({
          tasks,
          startDate: today,
          targetDate: deadline,
        });

  const netAvailableMinutes =
    Math.max(
      grossCapacity -
        protectedMinutes,
      0
    );

  const feasible =
    deadline >= today &&
    topicAccounting
      .adjustedRemainingMinutes <=
      netAvailableMinutes;

  const differenceMinutes =
    topicAccounting
      .adjustedRemainingMinutes -
    topicAccounting
      .baselineRemainingMinutes;

  const hasMeaningfulChange =
    differenceMinutes !== 0;

  const hasRemainingWork =
    topicAccounting
      .baselineRemainingMinutes > 0;

  const canApply =
    feedbackCount > 0 &&
    hasRemainingWork &&
    hasMeaningfulChange &&
    feasible &&
    deadline >= today;

  let status = "ready";
  let title =
    "Adaptive calibration available";
  let message =
    "Review the suggested estimate calibration before applying it.";

  if (feedbackCount === 0) {
    status = lastAdaptationAt
      ? "up-to-date"
      : "needs-feedback";

    title = lastAdaptationAt
      ? "Calibration is up to date"
      : "More completion feedback needed";

    message = lastAdaptationAt
      ? "No new completed-task feedback has been recorded since the last approved adaptation."
      : "Complete at least one task with actual minutes and difficulty feedback before adapting future estimates.";
  } else if (!hasRemainingWork) {
    status = "no-remaining-work";
    title = "No unfinished work to adapt";
    message =
      "The current goal has no ordinary pending learning time that needs recalibration.";
  } else if (!hasMeaningfulChange) {
    status = "aligned";
    title =
      "Current estimates remain appropriate";
    message =
      "The new evidence is close enough to the current estimates that no adjustment is recommended.";
  } else if (!feasible) {
    status = "capacity-risk";
    title =
      "Suggested adjustment exceeds capacity";
    message =
      "The evidence suggests more study time is needed, but the adjusted remaining work would not fit before the target date.";
  } else if (
    adjustmentMultiplier > 1
  ) {
    status = "increase";
    title =
      "Increase remaining estimates";
    message =
      "Recent tasks took longer than estimated. A conservative increase is suggested for unfinished ordinary work.";
  } else {
    status = "decrease";
    title =
      "Reduce remaining estimates";
    message =
      "Recent tasks took less time than estimated. A conservative reduction is suggested for unfinished ordinary work.";
  }

  return {
    valid: true,
    status,
    title,
    message,
    feedbackCount,
    confidence,
    observedMedianRatio:
      observedMedianRatio === null
        ? null
        : round(
            observedMedianRatio,
            2
          ),
    recommendedAdjustmentMultiplier:
      adjustmentMultiplier,
    currentMultiplier:
      round(current, 3),
    proposedCumulativeMultiplier,
    baselineRemainingMinutes:
      topicAccounting
        .baselineRemainingMinutes,
    adjustedRemainingMinutes:
      topicAccounting
        .adjustedRemainingMinutes,
    differenceMinutes,
    protectedMinutes,
    netAvailableMinutes,
    feasible,
    shortfallMinutes:
      feasible
        ? 0
        : Math.max(
            topicAccounting
              .adjustedRemainingMinutes -
              netAvailableMinutes,
            0
          ),
    affectedTopics:
      topicAccounting
        .affectedTopics,
    canApply,
  };
}

module.exports = {
  calculateAdaptiveEstimate,
  getNewFeedbackTasks,
  median,
};
