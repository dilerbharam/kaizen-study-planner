const {
  calculateGoalAnalytics,
  calculateEstimationAccuracy,
  buildKaizenInsight,
} = require("../services/analyticsService");

const task = (overrides = {}) => ({
  id: 1,
  topic_id: 10,
  topic_title: "Arrays",
  estimated_minutes: 30,
  actual_minutes: null,
  difficulty_rating: null,
  status: "pending",
  rescheduled_from_task_id: null,
  ...overrides,
});

describe("analyticsService", () => {
  test("returns empty analytics for no tasks", () => {
    const result =
      calculateGoalAnalytics([]);

    expect(result.counts.completed)
      .toBe(0);
    expect(result.completionRate)
      .toBe(0);
    expect(result.estimationAccuracy)
      .toBeNull();
    expect(result.averageDifficulty)
      .toBeNull();
    expect(result.insight.status)
      .toBe("insufficient-data");
  });

  test("calculates completion rate without counting skipped history", () => {
    const result =
      calculateGoalAnalytics([
        task({
          status: "completed",
          actual_minutes: 30,
          difficulty_rating: 3,
        }),
        task({
          id: 2,
          status: "pending",
        }),
        task({
          id: 3,
          status: "skipped",
        }),
      ]);

    expect(result.completionRate)
      .toBe(50);
    expect(result.counts.skipped)
      .toBe(1);
  });

  test("calculates planned and actual completed effort", () => {
    const result =
      calculateGoalAnalytics([
        task({
          status: "completed",
          estimated_minutes: 30,
          actual_minutes: 45,
          difficulty_rating: 4,
        }),
        task({
          id: 2,
          status: "completed",
          estimated_minutes: 60,
          actual_minutes: 50,
          difficulty_rating: 3,
        }),
      ]);

    expect(
      result.feedbackPlannedMinutes
    ).toBe(90);
    expect(
      result.actualStudyMinutes
    ).toBe(95);
    expect(
      result.estimationDifference
    ).toBe(5);
  });

  test("calculates average difficulty", () => {
    const result =
      calculateGoalAnalytics([
        task({
          status: "completed",
          actual_minutes: 30,
          difficulty_rating: 2,
        }),
        task({
          id: 2,
          status: "completed",
          actual_minutes: 30,
          difficulty_rating: 4,
        }),
      ]);

    expect(
      result.averageDifficulty
    ).toBe(3);
  });

  test("calculates estimation accuracy using mean absolute percentage error", () => {
    const accuracy =
      calculateEstimationAccuracy([
        task({
          estimated_minutes: 30,
          actual_minutes: 30,
          difficulty_rating: 3,
          status: "completed",
        }),
        task({
          id: 2,
          estimated_minutes: 30,
          actual_minutes: 45,
          difficulty_rating: 4,
          status: "completed",
        }),
      ]);

    expect(accuracy).toBe(75);
  });

  test("counts replacement tasks with reschedule lineage", () => {
    const result =
      calculateGoalAnalytics([
        task({
          rescheduled_from_task_id: 5,
        }),
        task({
          id: 2,
        }),
      ]);

    expect(
      result.counts
        .rescheduledReplacements
    ).toBe(1);
  });

  test("aggregates analytics by topic", () => {
    const result =
      calculateGoalAnalytics([
        task({
          status: "completed",
          topic_title: "Arrays",
          estimated_minutes: 30,
          actual_minutes: 45,
          difficulty_rating: 4,
        }),
        task({
          id: 2,
          status: "completed",
          topic_title: "Arrays",
          estimated_minutes: 30,
          actual_minutes: 30,
          difficulty_rating: 2,
        }),
      ]);

    expect(
      result.topicAnalytics
    ).toEqual([
      {
        topic: "Arrays",
        completedWithFeedback: 2,
        plannedMinutes: 60,
        actualMinutes: 75,
        differenceMinutes: 15,
        averageDifficulty: 3,
      },
    ]);
  });

  test("flags higher-than-planned effort as a Kaizen signal", () => {
    const insight =
      buildKaizenInsight({
        feedbackTaskCount: 2,
        effortRatio: 1.3,
        averageDifficulty: 3.5,
      });

    expect(insight.status)
      .toBe("increase-support");
  });

  test("recognises broadly aligned estimates", () => {
    const insight =
      buildKaizenInsight({
        feedbackTaskCount: 3,
        effortRatio: 1.05,
        averageDifficulty: 3,
      });

    expect(insight.status)
      .toBe("aligned");
  });
});
