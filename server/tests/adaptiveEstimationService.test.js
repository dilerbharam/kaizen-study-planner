const {
  calculateAdaptiveEstimate,
  getNewFeedbackTasks,
  median,
} = require("../services/adaptiveEstimationService");

const topic = (overrides = {}) => ({
  id: 10,
  title: "Arrays",
  estimated_minutes: 120,
  ...overrides,
});

const task = (overrides = {}) => ({
  id: 1,
  topic_id: 10,
  scheduled_date: "2026-09-11",
  task_text: "Study: Arrays",
  estimated_minutes: 30,
  status: "pending",
  rescheduled_from_task_id: null,
  actual_minutes: null,
  difficulty_rating: null,
  completed_at: null,
  ...overrides,
});

const availability = [
  {
    day_of_week: "Friday",
    available_minutes: 300,
  },
  {
    day_of_week: "Saturday",
    available_minutes: 300,
  },
  {
    day_of_week: "Sunday",
    available_minutes: 300,
  },
  {
    day_of_week: "Monday",
    available_minutes: 300,
  },
];

const currentDate =
  new Date("2026-09-10T10:00:00Z");

describe("adaptiveEstimationService", () => {
  test("calculates a median for odd and even samples", () => {
    expect(median([3, 1, 2]))
      .toBe(2);

    expect(median([1, 3]))
      .toBe(2);
  });

  test("returns no recommendation before feedback exists", () => {
    const result =
      calculateAdaptiveEstimate({
        topics: [topic()],
        tasks: [task()],
        availability,
        targetDate: "2026-09-14",
        currentDate,
      });

    expect(result.feedbackCount)
      .toBe(0);
    expect(result.canApply)
      .toBe(false);
    expect(result.status)
      .toBe("needs-feedback");
  });

  test("uses only feedback recorded after the last adaptation", () => {
    const tasks = [
      task({
        status: "completed",
        actual_minutes: 60,
        difficulty_rating: 4,
        completed_at:
          "2026-09-09T10:00:00Z",
      }),
      task({
        id: 2,
        status: "completed",
        actual_minutes: 45,
        difficulty_rating: 4,
        completed_at:
          "2026-09-10T12:00:00Z",
      }),
    ];

    expect(
      getNewFeedbackTasks(
        tasks,
        "2026-09-10T11:00:00Z"
      )
    ).toHaveLength(1);
  });

  test("shrinks a single-sample overrun toward the current estimate", () => {
    const result =
      calculateAdaptiveEstimate({
        topics: [topic()],
        tasks: [
          task({
            status: "completed",
            actual_minutes: 45,
            difficulty_rating: 4,
            completed_at:
              "2026-09-10T11:00:00Z",
          }),
          task({
            id: 2,
            estimated_minutes: 90,
          }),
        ],
        availability,
        targetDate: "2026-09-14",
        currentDate,
      });

    expect(
      result.observedMedianRatio
    ).toBe(1.5);

    expect(
      result
        .recommendedAdjustmentMultiplier
    ).toBe(1.17);

    expect(result.confidence)
      .toBe("low");
  });

  test("uses full evidence weight after three feedback tasks", () => {
    const result =
      calculateAdaptiveEstimate({
        topics: [
          topic({
            estimated_minutes: 180,
          }),
        ],
        tasks: [
          task({
            status: "completed",
            actual_minutes: 45,
            completed_at:
              "2026-09-10T11:00:00Z",
          }),
          task({
            id: 2,
            status: "completed",
            actual_minutes: 45,
            completed_at:
              "2026-09-10T12:00:00Z",
          }),
          task({
            id: 3,
            status: "completed",
            actual_minutes: 45,
            completed_at:
              "2026-09-10T13:00:00Z",
          }),
          task({
            id: 4,
            estimated_minutes: 90,
          }),
        ],
        availability,
        targetDate: "2026-09-14",
        currentDate,
      });

    expect(
      result
        .recommendedAdjustmentMultiplier
    ).toBe(1.5);

    expect(result.confidence)
      .toBe("high");
  });

  test("can conservatively reduce remaining estimates", () => {
    const result =
      calculateAdaptiveEstimate({
        topics: [topic()],
        tasks: [
          task({
            status: "completed",
            actual_minutes: 15,
            completed_at:
              "2026-09-10T11:00:00Z",
          }),
          task({
            id: 2,
            estimated_minutes: 90,
          }),
        ],
        availability,
        targetDate: "2026-09-14",
        currentDate,
      });

    expect(
      result
        .recommendedAdjustmentMultiplier
    ).toBe(0.83);

    expect(result.status)
      .toBe("decrease");

    expect(result.canApply)
      .toBe(true);
  });

  test("preserves completed minutes while adapting only ordinary remaining work", () => {
    const result =
      calculateAdaptiveEstimate({
        topics: [topic()],
        tasks: [
          task({
            status: "completed",
            actual_minutes: 45,
            completed_at:
              "2026-09-10T11:00:00Z",
          }),
          task({
            id: 2,
            estimated_minutes: 90,
          }),
        ],
        availability,
        targetDate: "2026-09-14",
        currentDate,
      });

    const adjusted =
      result.affectedTopics[0];

    expect(
      adjusted.completed_minutes
    ).toBe(30);

    expect(
      adjusted
        .baseline_remaining_minutes
    ).toBe(90);

    expect(
      adjusted.adjusted_total_minutes
    ).toBe(
      30 +
      adjusted.adjusted_remaining_minutes
    );
  });

  test("does not adapt protected replacement minutes", () => {
    const result =
      calculateAdaptiveEstimate({
        topics: [topic()],
        tasks: [
          task({
            status: "completed",
            actual_minutes: 45,
            completed_at:
              "2026-09-10T11:00:00Z",
          }),
          task({
            id: 2,
            status: "pending",
            estimated_minutes: 30,
            rescheduled_from_task_id: 99,
          }),
          task({
            id: 3,
            status: "pending",
            estimated_minutes: 60,
          }),
        ],
        availability,
        targetDate: "2026-09-14",
        currentDate,
      });

    const adjusted =
      result.affectedTopics[0];

    expect(
      adjusted
        .protected_pending_minutes
    ).toBe(30);

    expect(
      adjusted
        .baseline_remaining_minutes
    ).toBe(60);
  });

  test("blocks applying an increase that would exceed deadline capacity", () => {
    const result =
      calculateAdaptiveEstimate({
        topics: [
          topic({
            estimated_minutes: 600,
          }),
        ],
        tasks: [
          task({
            status: "completed",
            actual_minutes: 60,
            completed_at:
              "2026-09-10T11:00:00Z",
          }),
          task({
            id: 2,
            estimated_minutes: 570,
          }),
        ],
        availability: [
          {
            day_of_week: "Friday",
            available_minutes: 100,
          },
        ],
        targetDate: "2026-09-11",
        currentDate,
      });

    expect(result.feasible)
      .toBe(false);

    expect(result.canApply)
      .toBe(false);

    expect(result.status)
      .toBe("capacity-risk");
  });

  test("reports calibration as up to date when no new feedback exists after an adaptation", () => {
    const result =
      calculateAdaptiveEstimate({
        topics: [topic()],
        tasks: [
          task({
            status: "completed",
            actual_minutes: 45,
            completed_at:
              "2026-09-09T11:00:00Z",
          }),
          task({
            id: 2,
            estimated_minutes: 90,
          }),
        ],
        availability,
        targetDate: "2026-09-14",
        currentDate,
        lastAdaptationAt:
          "2026-09-10T11:00:00Z",
      });

    expect(result.status)
      .toBe("up-to-date");

    expect(result.canApply)
      .toBe(false);
  });
});
