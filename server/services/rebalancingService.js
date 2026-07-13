const {
  dayMap,
  formatDate,
} = require("./schedulingService");

/**
 * Removes scheduling labels so fragments can be compared
 * using their underlying task name.
 *
 * Examples:
 * "Study: Loops - Part 2" becomes "Study: Loops".
 * "Study: Loops - Part 2 (Rescheduled)" becomes
 * "Study: Loops".
 */
function getBaseTaskText(taskText) {
  return String(taskText)
    .replace(/\s+\(Rescheduled\)$/i, "")
    .replace(/\s+- Part \d+$/i, "")
    .trim();
}

/**
 * Extracts an existing part number from a task label.
 *
 * Example:
 * "Study: Loops - Part 2" returns 2.
 */
function getOriginalPartNumber(taskText) {
  const match = String(taskText).match(
    /- Part (\d+)/i
  );

  return match ? Number(match[1]) : null;
}

/**
 * Combines consecutive fragments belonging to the same
 * logical topic before they are redistributed.
 *
 * Tasks are grouped only when they have the same status.
 * This prevents a skipped fragment from being merged with
 * a later pending fragment and incorrectly assigning
 * reschedule lineage to both.
 */
function groupTasksByTopic(tasks) {
  const groupedTasks = [];

  for (const task of tasks) {
    const baseTaskText = getBaseTaskText(
      task.task_text
    );

    const originalPartNumber =
      getOriginalPartNumber(task.task_text);

    const previousTask =
      groupedTasks[groupedTasks.length - 1];

    const canBeGrouped =
      previousTask &&
      previousTask.topic_id === task.topic_id &&
      previousTask.task_text === baseTaskText &&
      previousTask.status === task.status;

    if (canBeGrouped) {
      previousTask.estimated_minutes += Number(
        task.estimated_minutes
      );

      previousTask.source_task_ids.push(task.id);

      if (originalPartNumber !== null) {
        previousTask.original_part_numbers.push(
          originalPartNumber
        );
      }

      previousTask.was_previously_split =
        previousTask.was_previously_split ||
        originalPartNumber !== null;

      previousTask.includes_skipped_task =
        previousTask.includes_skipped_task ||
        task.status === "skipped";
    } else {
      groupedTasks.push({
        id: task.id,
        topic_id: task.topic_id,
        task_text: baseTaskText,
        status: task.status,
        estimated_minutes: Number(
          task.estimated_minutes
        ),
        source_task_ids: [task.id],
        original_part_numbers:
          originalPartNumber === null
            ? []
            : [originalPartNumber],
        was_previously_split:
          originalPartNumber !== null,
        includes_skipped_task:
          task.status === "skipped",
      });
    }
  }

  return groupedTasks;
}

/**
 * Determines which part number should be used first when
 * rebuilding a grouped task.
 */
function getStartingPartNumber(groupedTask) {
  if (
    groupedTask.original_part_numbers.length === 0
  ) {
    return 1;
  }

  return Math.min(
    ...groupedTask.original_part_numbers
  );
}

/**
 * Rebuilds skipped and future pending work across the
 * remaining available dates.
 *
 * Completed work is protected by the calling route and is
 * not supplied to this service.
 */
function rebalanceTasks({
  tasks,
  availability,
  workloadByDate,
  startDate,
  targetDate,
}) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return {
      complete: true,
      remainingMinutes: 0,
      tasks: [],
    };
  }

  const groupedTasks = groupTasksByTopic(tasks);

  const availabilityByDay = new Map(
    availability.map((entry) => [
      dayMap[entry.day_of_week],
      Number(entry.available_minutes),
    ])
  );

  const rebuiltTasks = [];

  let taskIndex = 0;

  let remainingTaskMinutes = Number(
    groupedTasks[0].estimated_minutes
  );

  let partNumber = getStartingPartNumber(
    groupedTasks[0]
  );

  let firstFragmentForGroupedTask = true;

  for (
    let date = new Date(startDate);
    date <= targetDate &&
    taskIndex < groupedTasks.length;
    date.setDate(date.getDate() + 1)
  ) {
    const dailyCapacity =
      availabilityByDay.get(date.getDay()) || 0;

    if (dailyCapacity <= 0) {
      continue;
    }

    const dateKey = formatDate(date);

    const protectedWorkload =
      Number(workloadByDate.get(dateKey)) || 0;

    let remainingDayCapacity =
      dailyCapacity - protectedWorkload;

    if (remainingDayCapacity <= 0) {
      continue;
    }

    while (
      remainingDayCapacity > 0 &&
      taskIndex < groupedTasks.length
    ) {
      const sourceTask =
        groupedTasks[taskIndex];

      const allocatedMinutes = Math.min(
        remainingTaskMinutes,
        remainingDayCapacity
      );

      const willBeSplit =
        remainingTaskMinutes >
        remainingDayCapacity;

      const startingPartNumber =
        getStartingPartNumber(sourceTask);

      const shouldDisplayPartNumber =
        sourceTask.was_previously_split ||
        willBeSplit ||
        partNumber > startingPartNumber;

      let rebuiltTaskText =
        sourceTask.task_text;

      if (shouldDisplayPartNumber) {
        rebuiltTaskText =
          `${sourceTask.task_text} - Part ${partNumber}`;
      }

      if (
        sourceTask.includes_skipped_task &&
        firstFragmentForGroupedTask
      ) {
        rebuiltTaskText += " (Rescheduled)";
      }

      rebuiltTasks.push({
        topicId: sourceTask.topic_id,
        scheduledDate: dateKey,
        taskText: rebuiltTaskText,
        estimatedMinutes: allocatedMinutes,
        status: "pending",
        sourceTaskIds:
          sourceTask.source_task_ids,
      });

      remainingTaskMinutes -= allocatedMinutes;
      remainingDayCapacity -= allocatedMinutes;

      firstFragmentForGroupedTask = false;

      if (remainingTaskMinutes === 0) {
        taskIndex += 1;

        if (taskIndex < groupedTasks.length) {
          const nextTask =
            groupedTasks[taskIndex];

          remainingTaskMinutes = Number(
            nextTask.estimated_minutes
          );

          partNumber =
            getStartingPartNumber(nextTask);

          firstFragmentForGroupedTask = true;
        }
      } else {
        partNumber += 1;
      }
    }
  }

  const complete =
    taskIndex === groupedTasks.length;

  const remainingMinutes = complete
    ? 0
    : remainingTaskMinutes +
      groupedTasks
        .slice(taskIndex + 1)
        .reduce(
          (total, task) =>
            total +
            Number(task.estimated_minutes),
          0
        );

  return {
    complete,
    remainingMinutes,
    tasks: rebuiltTasks,
  };
}

module.exports = {
  getBaseTaskText,
  getOriginalPartNumber,
  groupTasksByTopic,
  getStartingPartNumber,
  rebalanceTasks,
};