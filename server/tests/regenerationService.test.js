const {
  calculateRemainingTopics,
} = require("../services/regenerationService");

describe("calculateRemainingTopics", () => {
  const topics = [
    {
      id: 1,
      title: "Variables",
      estimated_minutes: 120,
    },
    {
      id: 2,
      title: "Loops",
      estimated_minutes: 90,
    },
  ];

  test("returns all work when no tasks are completed", () => {
    const result = calculateRemainingTopics({
      topics,
      tasks: [],
    });

    expect(result.totalPlannedMinutes).toBe(210);
    expect(result.totalCompletedMinutes).toBe(0);
    expect(result.totalRemainingMinutes).toBe(210);
    expect(result.topics).toHaveLength(2);
  });

  test("subtracts completed minutes from a topic", () => {
    const result = calculateRemainingTopics({
      topics,
      tasks: [
        {
          topic_id: 1,
          status: "completed",
          estimated_minutes: 60,
        },
      ],
    });

    expect(result.topics[0].estimated_minutes).toBe(60);
    expect(result.topics[0].completed_minutes).toBe(60);
    expect(result.totalCompletedMinutes).toBe(60);
    expect(result.totalRemainingMinutes).toBe(150);
  });

  test("removes a fully completed topic from the remaining plan", () => {
    const result = calculateRemainingTopics({
      topics,
      tasks: [
        {
          topic_id: 1,
          status: "completed",
          estimated_minutes: 120,
        },
      ],
    });

    expect(result.topics).toHaveLength(1);
    expect(result.topics[0].id).toBe(2);
    expect(result.totalRemainingMinutes).toBe(90);
  });

  test("does not treat skipped tasks as completed work", () => {
    const result = calculateRemainingTopics({
      topics,
      tasks: [
        {
          topic_id: 1,
          status: "skipped",
          estimated_minutes: 60,
        },
      ],
    });

    expect(result.totalCompletedMinutes).toBe(0);
    expect(result.totalRemainingMinutes).toBe(210);
  });

  test("does not treat pending tasks as completed work", () => {
    const result = calculateRemainingTopics({
      topics,
      tasks: [
        {
          topic_id: 1,
          status: "pending",
          estimated_minutes: 60,
        },
      ],
    });

    expect(result.totalCompletedMinutes).toBe(0);
    expect(result.totalRemainingMinutes).toBe(210);
  });

  test("caps duplicated completed records at the topic duration", () => {
    const result = calculateRemainingTopics({
      topics: [
        {
          id: 1,
          title: "Variables",
          estimated_minutes: 120,
        },
      ],
      tasks: [
        {
          topic_id: 1,
          status: "completed",
          estimated_minutes: 60,
        },
        {
          topic_id: 1,
          status: "completed",
          estimated_minutes: 60,
        },
        {
          topic_id: 1,
          status: "completed",
          estimated_minutes: 60,
        },
      ],
    });

    expect(result.totalCompletedMinutes).toBe(120);
    expect(result.totalRemainingMinutes).toBe(0);
    expect(result.topics).toHaveLength(0);
  });
});