function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toMinutes(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function calculateEstimationAccuracy(tasks) {
  if (tasks.length === 0) {
    return null;
  }

  const errors = tasks.map((task) => {
    const estimated = toMinutes(
      task.estimated_minutes
    );
    const actual = toMinutes(
      task.actual_minutes
    );

    if (estimated <= 0) {
      return 1;
    }

    return Math.abs(
      actual - estimated
    ) / estimated;
  });

  const meanAbsolutePercentageError =
    errors.reduce(
      (total, error) => total + error,
      0
    ) / errors.length;

  return Math.max(
    0,
    round(
      100 -
        meanAbsolutePercentageError * 100
    )
  );
}

function buildKaizenInsight({
  feedbackTaskCount,
  effortRatio,
  averageDifficulty,
}) {
  if (feedbackTaskCount === 0) {
    return {
      status: "insufficient-data",
      title: "More feedback needed",
      message:
        "Complete tasks with actual time and difficulty ratings to build a personal planning signal.",
    };
  }

  if (
    effortRatio >= 1.15 ||
    averageDifficulty >= 4
  ) {
    return {
      status: "increase-support",
      title: "Tasks are requiring more effort",
      message:
        "Observed effort is above the current plan. Consider increasing future estimates or splitting difficult work into smaller micro-tasks.",
    };
  }

  if (
    effortRatio <= 0.85 &&
    averageDifficulty <= 2.5
  ) {
    return {
      status: "reduce-estimate",
      title: "Tasks are taking less effort",
      message:
        "Observed effort is below the current plan. Future estimates could be reduced cautiously while continuing to collect feedback.",
    };
  }

  return {
    status: "aligned",
    title: "Estimates are broadly aligned",
    message:
      "Observed study effort is close to the planned estimates. Continue collecting feedback before making larger scheduling changes.",
  };
}

function calculateGoalAnalytics(tasks = []) {
  const normalisedTasks =
    Array.isArray(tasks) ? tasks : [];

  const completed =
    normalisedTasks.filter(
      (task) =>
        task.status === "completed"
    );

  const pending =
    normalisedTasks.filter(
      (task) =>
        task.status === "pending"
    );

  const skipped =
    normalisedTasks.filter(
      (task) =>
        task.status === "skipped"
    );

  const feedbackTasks =
    completed.filter(
      (task) =>
        task.actual_minutes !== null &&
        task.actual_minutes !== undefined &&
        task.difficulty_rating !== null &&
        task.difficulty_rating !== undefined
    );

  const activeTaskCount =
    completed.length + pending.length;

  const completionRate =
    activeTaskCount === 0
      ? 0
      : round(
          (completed.length /
            activeTaskCount) *
            100
        );

  const plannedCompletedMinutes =
    completed.reduce(
      (total, task) =>
        total +
        toMinutes(
          task.estimated_minutes
        ),
      0
    );

  const feedbackPlannedMinutes =
    feedbackTasks.reduce(
      (total, task) =>
        total +
        toMinutes(
          task.estimated_minutes
        ),
      0
    );

  const actualStudyMinutes =
    feedbackTasks.reduce(
      (total, task) =>
        total +
        toMinutes(
          task.actual_minutes
        ),
      0
    );

  const estimationDifference =
    actualStudyMinutes -
    feedbackPlannedMinutes;

  const effortRatio =
    feedbackPlannedMinutes > 0
      ? actualStudyMinutes /
        feedbackPlannedMinutes
      : 0;

  const averageDifficulty =
    feedbackTasks.length === 0
      ? null
      : round(
          feedbackTasks.reduce(
            (total, task) =>
              total +
              Number(
                task.difficulty_rating
              ),
            0
          ) / feedbackTasks.length
        );

  const estimationAccuracy =
    calculateEstimationAccuracy(
      feedbackTasks
    );

  const rescheduledReplacementCount =
    normalisedTasks.filter(
      (task) =>
        task.rescheduled_from_task_id !==
          null &&
        task.rescheduled_from_task_id !==
          undefined
    ).length;

  const topicMap = new Map();

  for (const task of feedbackTasks) {
    const topicKey =
      task.topic_title ||
      `Topic ${task.topic_id}`;

    if (!topicMap.has(topicKey)) {
      topicMap.set(topicKey, {
        topic: topicKey,
        completedWithFeedback: 0,
        plannedMinutes: 0,
        actualMinutes: 0,
        difficultyTotal: 0,
      });
    }

    const topic =
      topicMap.get(topicKey);

    topic.completedWithFeedback += 1;
    topic.plannedMinutes +=
      toMinutes(
        task.estimated_minutes
      );
    topic.actualMinutes +=
      toMinutes(task.actual_minutes);
    topic.difficultyTotal +=
      Number(
        task.difficulty_rating
      );
  }

  const topicAnalytics =
    Array.from(
      topicMap.values()
    ).map((topic) => ({
      topic: topic.topic,
      completedWithFeedback:
        topic.completedWithFeedback,
      plannedMinutes:
        topic.plannedMinutes,
      actualMinutes:
        topic.actualMinutes,
      differenceMinutes:
        topic.actualMinutes -
        topic.plannedMinutes,
      averageDifficulty: round(
        topic.difficultyTotal /
          topic.completedWithFeedback
      ),
    }));

  return {
    counts: {
      completed: completed.length,
      pending: pending.length,
      skipped: skipped.length,
      rescheduledReplacements:
        rescheduledReplacementCount,
      feedbackTasks:
        feedbackTasks.length,
    },
    completionRate,
    plannedCompletedMinutes,
    feedbackPlannedMinutes,
    actualStudyMinutes,
    estimationDifference,
    estimationAccuracy,
    averageDifficulty,
    effortRatio:
      feedbackTasks.length === 0
        ? null
        : round(effortRatio, 2),
    insight: buildKaizenInsight({
      feedbackTaskCount:
        feedbackTasks.length,
      effortRatio,
      averageDifficulty:
        averageDifficulty ?? 0,
    }),
    topicAnalytics,
  };
}

module.exports = {
  calculateGoalAnalytics,
  calculateEstimationAccuracy,
  buildKaizenInsight,
};
