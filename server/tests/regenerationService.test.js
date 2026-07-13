const {
  getBaseTaskText,
  getOriginalPartNumber,
  groupTasksByTopic,
  getStartingPartNumber,
  rebalanceTasks,
} = require("../services/rebalancingService");

describe("rebalancingService", () => {
  test("removes part and rescheduled labels from task text", () => {
    expect(
      getBaseTaskText("Study: Loops")
    ).toBe("Study: Loops");

    expect(
      getBaseTaskText(
        "Study: Loops - Part 2"
      )
    ).toBe("Study: Loops");

    expect(
      getBaseTaskText(
        "Study: Loops - Part 2 (Rescheduled)"
      )
    ).toBe("Study: Loops");

    expect(
      getBaseTaskText(
        "Study: Dictionaries (Rescheduled)"
      )
    ).toBe("Study: Dictionaries");
  });

  test("extracts an existing task part number", () => {
    expect(
      getOriginalPartNumber(
        "Study: Functions - Part 1"
      )
    ).toBe(1);

    expect(
      getOriginalPartNumber(
        "Study: Functions - Part 12 (Rescheduled)"
      )
    ).toBe(12);

    expect(
      getOriginalPartNumber(
        "Study: Functions"
      )
    ).toBeNull();
  });

  test("groups consecutive pending fragments of the same topic", () => {
    const tasks = [
      {
        id: 1,
        topic_id: 10,
        task_text:
          "Study: Loops - Part 1",
        estimated_minutes: 60,
        status: "pending",
      },
      {
        id: 2,
        topic_id: 10,
        task_text:
          "Study: Loops - Part 2",
        estimated_minutes: 30,
        status: "pending",
      },
    ];

    const groupedTasks =
      groupTasksByTopic(tasks);

    expect(groupedTasks).toHaveLength(1);

    expect(groupedTasks[0]).toEqual({
      id: 1,
      topic_id: 10,
      task_text: "Study: Loops",
      status: "pending",
      estimated_minutes: 90,
      source_task_ids: [1, 2],
      original_part_numbers: [1, 2],
      was_previously_split: true,
      includes_skipped_task: false,
    });

    expect(
      getStartingPartNumber(
        groupedTasks[0]
      )
    ).toBe(1);
  });

  test("does not group tasks from different topics", () => {
    const tasks = [
      {
        id: 1,
        topic_id: 10,
        task_text: "Study: Lists",
        estimated_minutes: 60,
        status: "pending",
      },
      {
        id: 2,
        topic_id: 11,
        task_text: "Study: Lists",
        estimated_minutes: 60,
        status: "pending",
      },
    ];

    const groupedTasks =
      groupTasksByTopic(tasks);

    expect(groupedTasks).toHaveLength(2);

    expect(
      groupedTasks[0].source_task_ids
    ).toEqual([1]);

    expect(
      groupedTasks[1].source_task_ids
    ).toEqual([2]);
  });

  test("does not group skipped and pending fragments of the same topic", () => {
    const tasks = [
      {
        id: 790,
        topic_id: 5,
        task_text:
          "Study: Functions - Part 1",
        estimated_minutes: 60,
        status: "skipped",
      },
      {
        id: 791,
        topic_id: 5,
        task_text:
          "Study: Functions - Part 2",
        estimated_minutes: 30,
        status: "pending",
      },
    ];

    const groupedTasks =
      groupTasksByTopic(tasks);

    expect(groupedTasks).toHaveLength(2);

    expect(
      groupedTasks[0].source_task_ids
    ).toEqual([790]);

    expect(
      groupedTasks[1].source_task_ids
    ).toEqual([791]);

    expect(groupedTasks[0].status).toBe(
      "skipped"
    );

    expect(groupedTasks[1].status).toBe(
      "pending"
    );

    expect(
      groupedTasks[0].estimated_minutes
    ).toBe(60);

    expect(
      groupedTasks[1].estimated_minutes
    ).toBe(30);
  });

  test("places tasks on available study days in order", () => {
    const result = rebalanceTasks({
      tasks: [
        {
          id: 1,
          topic_id: 10,
          task_text:
            "Study: Variables",
          estimated_minutes: 60,
          status: "pending",
        },
        {
          id: 2,
          topic_id: 11,
          task_text:
            "Study: Conditions",
          estimated_minutes: 60,
          status: "pending",
        },
      ],
      availability: [
        {
          day_of_week: "Monday",
          available_minutes: 60,
        },
        {
          day_of_week: "Tuesday",
          available_minutes: 60,
        },
      ],
      workloadByDate: new Map(),
      startDate: new Date(2026, 6, 13),
      targetDate: new Date(2026, 6, 14),
    });

    expect(result.complete).toBe(true);
    expect(result.remainingMinutes).toBe(0);
    expect(result.tasks).toHaveLength(2);

    expect(result.tasks[0]).toEqual({
      topicId: 10,
      scheduledDate: "2026-07-13",
      taskText: "Study: Variables",
      estimatedMinutes: 60,
      status: "pending",
      sourceTaskIds: [1],
    });

    expect(result.tasks[1]).toEqual({
      topicId: 11,
      scheduledDate: "2026-07-14",
      taskText: "Study: Conditions",
      estimatedMinutes: 60,
      status: "pending",
      sourceTaskIds: [2],
    });
  });

  test("respects workload already protected on a date", () => {
    const result = rebalanceTasks({
      tasks: [
        {
          id: 1,
          topic_id: 10,
          task_text:
            "Study: Variables",
          estimated_minutes: 60,
          status: "pending",
        },
      ],
      availability: [
        {
          day_of_week: "Monday",
          available_minutes: 60,
        },
        {
          day_of_week: "Tuesday",
          available_minutes: 60,
        },
      ],
      workloadByDate: new Map([
        ["2026-07-13", 30],
      ]),
      startDate: new Date(2026, 6, 13),
      targetDate: new Date(2026, 6, 14),
    });

    expect(result.complete).toBe(true);
    expect(result.tasks).toHaveLength(2);

    expect(result.tasks[0]).toMatchObject({
      scheduledDate: "2026-07-13",
      taskText:
        "Study: Variables - Part 1",
      estimatedMinutes: 30,
    });

    expect(result.tasks[1]).toMatchObject({
      scheduledDate: "2026-07-14",
      taskText:
        "Study: Variables - Part 2",
      estimatedMinutes: 30,
    });
  });

  test("splits a task when it exceeds one day's availability", () => {
    const result = rebalanceTasks({
      tasks: [
        {
          id: 1,
          topic_id: 10,
          task_text:
            "Study: Introduction to NumPy",
          estimated_minutes: 90,
          status: "pending",
        },
      ],
      availability: [
        {
          day_of_week: "Monday",
          available_minutes: 60,
        },
        {
          day_of_week: "Tuesday",
          available_minutes: 60,
        },
      ],
      workloadByDate: new Map(),
      startDate: new Date(2026, 6, 13),
      targetDate: new Date(2026, 6, 14),
    });

    expect(result.complete).toBe(true);
    expect(result.remainingMinutes).toBe(0);
    expect(result.tasks).toHaveLength(2);

    expect(result.tasks[0]).toMatchObject({
      scheduledDate: "2026-07-13",
      taskText:
        "Study: Introduction to NumPy - Part 1",
      estimatedMinutes: 60,
      sourceTaskIds: [1],
    });

    expect(result.tasks[1]).toMatchObject({
      scheduledDate: "2026-07-14",
      taskText:
        "Study: Introduction to NumPy - Part 2",
      estimatedMinutes: 30,
      sourceTaskIds: [1],
    });
  });

  test("keeps skipped and pending fragments separate during rebuilding", () => {
    const result = rebalanceTasks({
      tasks: [
        {
          id: 790,
          topic_id: 5,
          task_text:
            "Study: Functions - Part 1",
          estimated_minutes: 60,
          status: "skipped",
        },
        {
          id: 791,
          topic_id: 5,
          task_text:
            "Study: Functions - Part 2",
          estimated_minutes: 30,
          status: "pending",
        },
      ],
      availability: [
        {
          day_of_week: "Monday",
          available_minutes: 60,
        },
        {
          day_of_week: "Tuesday",
          available_minutes: 60,
        },
      ],
      workloadByDate: new Map(),
      startDate: new Date(2026, 6, 13),
      targetDate: new Date(2026, 6, 14),
    });

    expect(result.complete).toBe(true);
    expect(result.tasks).toHaveLength(2);

    expect(result.tasks[0]).toEqual({
      topicId: 5,
      scheduledDate: "2026-07-13",
      taskText:
        "Study: Functions - Part 1 (Rescheduled)",
      estimatedMinutes: 60,
      status: "pending",
      sourceTaskIds: [790],
    });

    expect(result.tasks[1]).toEqual({
      topicId: 5,
      scheduledDate: "2026-07-14",
      taskText:
        "Study: Functions - Part 2",
      estimatedMinutes: 30,
      status: "pending",
      sourceTaskIds: [791],
    });
  });

  test("reports unfinished minutes when capacity is insufficient", () => {
    const result = rebalanceTasks({
      tasks: [
        {
          id: 1,
          topic_id: 10,
          task_text:
            "Study: Functions",
          estimated_minutes: 90,
          status: "pending",
        },
      ],
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
    expect(result.remainingMinutes).toBe(30);
    expect(result.tasks).toHaveLength(1);

    expect(result.tasks[0]).toMatchObject({
      scheduledDate: "2026-07-13",
      taskText:
        "Study: Functions - Part 1",
      estimatedMinutes: 60,
    });
  });
});