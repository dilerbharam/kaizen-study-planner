const {
  calculateGoalProgress,
} = require("../services/progressService");

describe("calculateGoalProgress", () => {
  const standardAvailability = [
    {
      day_of_week: "Monday",
      available_minutes: 60,
    },
    {
      day_of_week: "Wednesday",
      available_minutes: 60,
    },
    {
      day_of_week: "Friday",
      available_minutes: 60,
    },
  ];

  test("calculates on-track progress correctly", () => {
    const result = calculateGoalProgress({
      topics: [
        {
          estimated_minutes: 120,
        },
        {
          estimated_minutes: 180,
        },
      ],
      tasks: [
        {
          status: "completed",
          estimated_minutes: 60,
        },
        {
          status: "pending",
          estimated_minutes: 60,
        },
        {
          status: "skipped",
          estimated_minutes: 60,
        },
      ],
      availability: standardAvailability,
      targetDate: new Date(2026, 6, 31),
      currentDate: new Date(2026, 6, 1),
    });

    expect(result.valid).toBe(true);
    expect(result.totalPlannedMinutes).toBe(300);
    expect(result.completedMinutes).toBe(60);
    expect(result.remainingMinutes).toBe(240);
    expect(result.completionPercentage).toBe(20);

    expect(result.taskCounts).toEqual({
      completed: 1,
      pending: 1,
      skipped: 1,
    });

    expect(
      result.availableMinutesBeforeDeadline
    ).toBeGreaterThanOrEqual(240);

    expect(result.feasible).toBe(true);
    expect(result.deadlinePassed).toBe(false);
    expect(result.feasibilityStatus).toBe(
      "on-track"
    );

    expect(result.feasibilityMessage).toBe(
      "The remaining work fits within the available study time."
    );
  });

  test("returns completed status when all planned minutes are completed", () => {
    const result = calculateGoalProgress({
      topics: [
        {
          estimated_minutes: 120,
        },
      ],
      tasks: [
        {
          status: "completed",
          estimated_minutes: 60,
        },
        {
          status: "completed",
          estimated_minutes: 60,
        },
      ],
      availability: standardAvailability,
      targetDate: new Date(2026, 6, 31),
      currentDate: new Date(2026, 6, 1),
    });

    expect(result.totalPlannedMinutes).toBe(120);
    expect(result.completedMinutes).toBe(120);
    expect(result.remainingMinutes).toBe(0);
    expect(result.completionPercentage).toBe(100);
    expect(result.feasibilityStatus).toBe(
      "completed"
    );

    expect(result.feasibilityMessage).toBe(
      "All planned learning minutes have been completed."
    );
  });

  test("returns at-risk status when remaining work exceeds available capacity", () => {
    const result = calculateGoalProgress({
      topics: [
        {
          estimated_minutes: 600,
        },
      ],
      tasks: [
        {
          status: "completed",
          estimated_minutes: 60,
        },
        {
          status: "pending",
          estimated_minutes: 540,
        },
      ],
      availability: [
        {
          day_of_week: "Monday",
          available_minutes: 60,
        },
      ],
      targetDate: new Date(2026, 6, 6),
      currentDate: new Date(2026, 6, 1),
    });

    expect(result.completedMinutes).toBe(60);
    expect(result.remainingMinutes).toBe(540);
    expect(result.feasible).toBe(false);
    expect(result.deadlinePassed).toBe(false);
    expect(result.capacityDifference).toBeLessThan(0);
    expect(result.feasibilityStatus).toBe(
      "at-risk"
    );

    expect(result.feasibilityMessage).toContain(
      "additional minutes"
    );
  });

  test("returns deadline-passed status when unfinished work remains after the deadline", () => {
    const result = calculateGoalProgress({
      topics: [
        {
          estimated_minutes: 300,
        },
      ],
      tasks: [
        {
          status: "completed",
          estimated_minutes: 60,
        },
        {
          status: "pending",
          estimated_minutes: 240,
        },
      ],
      availability: standardAvailability,
      targetDate: new Date(2026, 5, 30),
      currentDate: new Date(2026, 6, 1),
    });

    expect(result.remainingMinutes).toBe(240);
    expect(
      result.availableMinutesBeforeDeadline
    ).toBe(0);

    expect(result.feasible).toBe(false);
    expect(result.deadlinePassed).toBe(true);
    expect(result.feasibilityStatus).toBe(
      "deadline-passed"
    );

    expect(result.feasibilityMessage).toBe(
      "The target date has passed and unfinished work remains."
    );
  });

  test("handles a goal with no planned minutes", () => {
    const result = calculateGoalProgress({
      topics: [],
      tasks: [],
      availability: standardAvailability,
      targetDate: new Date(2026, 6, 31),
      currentDate: new Date(2026, 6, 1),
    });

    expect(result.totalPlannedMinutes).toBe(0);
    expect(result.completedMinutes).toBe(0);
    expect(result.remainingMinutes).toBe(0);
    expect(result.completionPercentage).toBe(0);
    expect(result.feasibilityStatus).toBe(
      "completed"
    );
  });

  test("does not allow duplicated completed records to exceed 100 percent", () => {
    const result = calculateGoalProgress({
      topics: [
        {
          estimated_minutes: 120,
        },
      ],
      tasks: [
        {
          status: "completed",
          estimated_minutes: 60,
        },
        {
          status: "completed",
          estimated_minutes: 60,
        },
        {
          status: "completed",
          estimated_minutes: 60,
        },
      ],
      availability: standardAvailability,
      targetDate: new Date(2026, 6, 31),
      currentDate: new Date(2026, 6, 1),
    });

    expect(result.totalPlannedMinutes).toBe(120);
    expect(result.completedMinutes).toBe(120);
    expect(result.remainingMinutes).toBe(0);
    expect(result.completionPercentage).toBe(100);

    expect(result.taskCounts.completed).toBe(3);
  });

  test("returns an error for an invalid target date", () => {
    const result = calculateGoalProgress({
      topics: [],
      tasks: [],
      availability: standardAvailability,
      targetDate: "not-a-date",
      currentDate: new Date(2026, 6, 1),
    });

    expect(result).toEqual({
      valid: false,
      error: "The goal contains an invalid date.",
    });
  });
});