const {
  evaluateRescheduleEligibility,
} = require(
  "../services/rescheduleEligibilityService"
);

describe(
  "evaluateRescheduleEligibility",
  () => {
    const currentDate =
      new Date(2026, 8, 5);

    test("allows an untouched skipped task before its deadline", () => {
      const result =
        evaluateRescheduleEligibility({
          task: {
            status: "skipped",
            rescheduled_at: null,
          },
          targetDate:
            new Date(2026, 8, 30),
          currentDate,
        });

      expect(result).toEqual({
        canReschedule: true,
        status: null,
      });
    });

    test("does not allow rescheduling after the goal deadline", () => {
      const result =
        evaluateRescheduleEligibility({
          task: {
            status: "skipped",
            rescheduled_at: null,
          },
          targetDate:
            new Date(2026, 5, 30),
          currentDate,
        });

      expect(result).toEqual({
        canReschedule: false,
        status: "Deadline passed",
      });
    });

    test("allows rescheduling on the goal deadline", () => {
      const result =
        evaluateRescheduleEligibility({
          task: {
            status: "skipped",
            rescheduled_at: null,
          },
          targetDate:
            new Date(2026, 8, 5),
          currentDate,
        });

      expect(result).toEqual({
        canReschedule: true,
        status: null,
      });
    });

    test("does not allow a task that already has a replacement", () => {
      const result =
        evaluateRescheduleEligibility({
          task: {
            status: "skipped",
            rescheduled_at: null,
          },
          targetDate:
            new Date(2026, 8, 30),
          currentDate,
          hasLinkedReplacement: true,
        });

      expect(result).toEqual({
        canReschedule: false,
        status: "Replacement created",
      });
    });

    test("does not allow a task already marked as rescheduled", () => {
      const result =
        evaluateRescheduleEligibility({
          task: {
            status: "skipped",
            rescheduled_at:
              "2026-09-04T10:00:00Z",
          },
          targetDate:
            new Date(2026, 8, 30),
          currentDate,
        });

      expect(result).toEqual({
        canReschedule: false,
        status: "Replacement created",
      });
    });

    test("does not allow duplicate work when equivalent pending work exists", () => {
      const result =
        evaluateRescheduleEligibility({
          task: {
            status: "skipped",
            rescheduled_at: null,
          },
          targetDate:
            new Date(2026, 8, 30),
          currentDate,
          hasActiveEquivalent: true,
        });

      expect(result).toEqual({
        canReschedule: false,
        status:
          "Covered by current schedule",
      });
    });

    test("does not offer rescheduling for non-skipped tasks", () => {
      const result =
        evaluateRescheduleEligibility({
          task: {
            status: "pending",
            rescheduled_at: null,
          },
          targetDate:
            new Date(2026, 8, 30),
          currentDate,
        });

      expect(result).toEqual({
        canReschedule: false,
        status: null,
      });
    });

    test("fails safely when the goal deadline is invalid", () => {
      const result =
        evaluateRescheduleEligibility({
          task: {
            status: "skipped",
            rescheduled_at: null,
          },
          targetDate: "not-a-date",
          currentDate,
        });

      expect(result).toEqual({
        canReschedule: false,
        status: "Invalid goal deadline",
      });
    });
  }
);