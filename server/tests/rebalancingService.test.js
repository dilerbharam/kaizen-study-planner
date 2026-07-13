const {
  getBaseTaskText,
  rebalanceTasks,
} = require("../services/rebalancingService");

describe("rebalancingService", () => {
  describe("getBaseTaskText", () => {
    test("removes a rescheduled suffix", () => {
      expect(
        getBaseTaskText(
          "Study: Variables (Rescheduled)"
        )
      ).toBe("Study: Variables");
    });

    test("removes an existing part number", () => {
      expect(
        getBaseTaskText(
          "Study: Introduction to Pandas - Part 2"
        )
      ).toBe("Study: Introduction to Pandas");
    });

    test("returns unchanged ordinary task text", () => {
      expect(
        getBaseTaskText("Study: SQL joins")
      ).toBe("Study: SQL joins");
    });
  });

  describe("rebalanceTasks", () => {
    const availability = [
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
        available_minutes: 90,
      },
    ];

    test("moves skipped and future tasks into later availability", () => {
      const tasks = [
        {
          id: 1,
          topic_id: 10,
          task_text: "Study: Variables",
          estimated_minutes: 60,
        },
        {
          id: 2,
          topic_id: 11,
          task_text: "Study: Loops",
          estimated_minutes: 60,
        },
      ];

      const result = rebalanceTasks({
        tasks,
        availability,
        workloadByDate: new Map(),
        startDate: new Date(2026, 6, 15),
        targetDate: new Date(2026, 6, 17),
      });

      expect(result.complete).toBe(true);
      expect(result.remainingMinutes).toBe(0);
      expect(result.tasks).toHaveLength(2);

      expect(result.tasks[0]).toMatchObject({
        topicId: 10,
        scheduledDate: "2026-07-15",
        taskText: "Study: Variables",
        estimatedMinutes: 60,
      });

      expect(result.tasks[1]).toMatchObject({
        topicId: 11,
        scheduledDate: "2026-07-17",
        taskText: "Study: Loops",
        estimatedMinutes: 60,
      });
    });

    test("respects protected workload already assigned to a date", () => {
      const tasks = [
        {
          id: 1,
          topic_id: 10,
          task_text: "Study: Variables",
          estimated_minutes: 60,
        },
      ];

      const workloadByDate = new Map([
        ["2026-07-17", 90],
      ]);

      const result = rebalanceTasks({
        tasks,
        availability,
        workloadByDate,
        startDate: new Date(2026, 6, 17),
        targetDate: new Date(2026, 6, 20),
      });

      expect(result.complete).toBe(true);
      expect(result.tasks[0].scheduledDate).toBe(
        "2026-07-20"
      );
    });

    test("splits a task and labels each part clearly", () => {
      const tasks = [
        {
          id: 1,
          topic_id: 10,
          task_text: "Study: Introduction to Pandas",
          estimated_minutes: 120,
        },
      ];

      const result = rebalanceTasks({
        tasks,
        availability: [
          {
            day_of_week: "Monday",
            available_minutes: 60,
          },
          {
            day_of_week: "Wednesday",
            available_minutes: 60,
          },
        ],
        workloadByDate: new Map(),
        startDate: new Date(2026, 6, 13),
        targetDate: new Date(2026, 6, 15),
      });

      expect(result.complete).toBe(true);
      expect(result.tasks).toHaveLength(2);

      expect(result.tasks[0]).toMatchObject({
        taskText:
          "Study: Introduction to Pandas - Part 1",
        estimatedMinutes: 60,
      });

      expect(result.tasks[1]).toMatchObject({
        taskText:
          "Study: Introduction to Pandas - Part 2",
        estimatedMinutes: 60,
      });
    });

    test("uses the remaining capacity on a partially occupied day", () => {
      const tasks = [
        {
          id: 1,
          topic_id: 10,
          task_text: "Study: Loops",
          estimated_minutes: 60,
        },
      ];

      const workloadByDate = new Map([
        ["2026-07-17", 30],
      ]);

      const result = rebalanceTasks({
        tasks,
        availability,
        workloadByDate,
        startDate: new Date(2026, 6, 17),
        targetDate: new Date(2026, 6, 17),
      });

      expect(result.complete).toBe(true);
      expect(result.tasks[0]).toMatchObject({
        scheduledDate: "2026-07-17",
        estimatedMinutes: 60,
      });
    });

    test("reports unfinished minutes when the deadline is insufficient", () => {
      const tasks = [
        {
          id: 1,
          topic_id: 10,
          task_text: "Study: Large topic",
          estimated_minutes: 180,
        },
      ];

      const result = rebalanceTasks({
        tasks,
        availability: [
          {
            day_of_week: "Monday",
            available_minutes: 60,
          },
        ],
        workloadByDate: new Map(),
        startDate: new Date(2026, 6, 13),
        targetDate: new Date(2026, 6, 13),
      });

      expect(result.complete).toBe(false);
      expect(result.remainingMinutes).toBe(120);
      expect(result.tasks).toHaveLength(1);
    });

    test("returns an empty successful result when no tasks require rebalancing", () => {
      const result = rebalanceTasks({
        tasks: [],
        availability,
        workloadByDate: new Map(),
        startDate: new Date(2026, 6, 13),
        targetDate: new Date(2026, 6, 20),
      });

      expect(result).toEqual({
        complete: true,
        remainingMinutes: 0,
        tasks: [],
      });
    });
  });
});