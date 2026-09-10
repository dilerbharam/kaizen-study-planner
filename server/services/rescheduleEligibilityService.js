const {
  normaliseDate,
} = require("./schedulingService");

/**
 * Determines whether a skipped task should be offered
 * a rescheduling action.
 *
 * This keeps UI capability signalling consistent with
 * the constraints enforced by the rescheduling endpoint.
 */
function evaluateRescheduleEligibility({
  task,
  targetDate,
  currentDate = new Date(),
  hasLinkedReplacement = false,
  hasActiveEquivalent = false,
}) {
  if (!task || task.status !== "skipped") {
    return {
      canReschedule: false,
      status: null,
    };
  }

  if (
    task.rescheduled_at ||
    hasLinkedReplacement
  ) {
    return {
      canReschedule: false,
      status: "Replacement created",
    };
  }

  if (hasActiveEquivalent) {
    return {
      canReschedule: false,
      status: "Covered by current schedule",
    };
  }

  const deadline = normaliseDate(targetDate);
  const today = normaliseDate(currentDate);

  if (!deadline || !today) {
    return {
      canReschedule: false,
      status: "Invalid goal deadline",
    };
  }

  if (deadline < today) {
    return {
      canReschedule: false,
      status: "Deadline passed",
    };
  }

  return {
    canReschedule: true,
    status: null,
  };
}

module.exports = {
  evaluateRescheduleEligibility,
};