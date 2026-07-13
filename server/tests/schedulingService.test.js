const {
  normaliseDate,
  formatDate,
  validateAvailability,
  calculateRequiredMinutes,
  calculateAvailableCapacity,
  createSchedule,
  findNextAvailableDate,
} = require("../services/schedulingService");

describe("schedulingService", () => {
  describe("normaliseDate", () => {
    test("returns a valid date set to midnight", () => {
      const result = normaliseDate("2026-07-13T15:30:00");

      expect(result).toBeInstanceOf(Date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });

    test("returns null for an invalid date", () => {
      const result = normaliseDate("not-a-date");

      expect(result).toBeNull();
    });
  });

  describe("formatDate", () => {
    test("formats a date as YYYY-MM-DD", () => {
      const date = new Date(2026, 6, 13);

      expect(formatDate(date)).toBe("2026-07-13");
    });
  });

  describe("validateAvailability", () => {
    test("accepts valid availability", () => {
      const availability = [
        {
          day_of_week: "Monday",
          available_minutes: 60,
        },
        {
          day_of_week: "Friday",
          available_minutes: 90,
        },
      ];

      expect(validateAvailability(availability)).toEqual({
        valid: true,
        error: null,
      });
    });

    test("rejects an empty availability list", () => {
      const result = validateAvailability([]);

      expect(result.valid).toBe(false);
      expect(result.error).toBe(
        "No availability has been configured for this user."
      );
    });

    test("rejects an invalid weekday", () => {
      const result = validateAvailability([
        {
          day_of_week: "Funday",
          available_minutes: 60,
        },
      ]);

      expect(result.valid).toBe(false);
    });

    test("rejects zero available minutes", () => {
      const result = validateAvailability([
        {
          day_of_week: "Monday",
          available_minutes: 0,
        },
      ]);

      expect(result.valid).toBe(false);
    });
  });

  describe("calculateRequiredMinutes", () => {
    test("adds the duration of all topics", () => {
      const topics = [
        { estimated_minutes: 60 },
        { estimated_minutes: 90 },
        { estimated_minutes: 30 },
      ];

      expect(calculateRequiredMinutes(topics)).toBe(180);
    });
  });

  describe("calculateAvailableCapacity", () => {
    test("calculates capacity between two dates", () => {
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

      const startDate = new Date(2026, 6, 13);
      const targetDate = new Date(2026, 6, 17);

      expect(
        calculateAvailableCapacity(
          startDate,
          targetDate,
          availability
        )
      ).toBe(210);
    });
  });

  describe("createSchedule", () => {
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

    test("creates tasks in topic order and respects daily capacity", () => {
      const topics = [
        {
          id: 1,
          title: "Variables",
          estimated_minutes: 60,
        },
        {
          id: 2,
          title: "Loops",
          estimated_minutes: 90,
        },
      ];

      const result = createSchedule({
        topics,
        availability,
        startDate: new Date(2026, 6, 13),
        targetDate: new Date(2026, 6, 17),
      });

      expect(result.complete).toBe(true);
      expect(result.remainingMinutes).toBe(0);
      expect(result.tasks).toHaveLength(3);

      expect(result.tasks[0]).toMatchObject({
        topicId: 1,
        scheduledDate: "2026-07-13",
        taskText: "Study: Variables",
        estimatedMinutes: 60,
      });

      expect(result.tasks[1]).toMatchObject({
        topicId: 2,
        scheduledDate: "2026-07-15",
        taskText: "Study: Loops - Part 1",
        estimatedMinutes: 60,
      });

      expect(result.tasks[2]).toMatchObject({
        topicId: 2,
        scheduledDate: "2026-07-17",
        taskText: "Study: Loops - Part 2",
        estimatedMinutes: 30,
      });
    });

    test("splits a topic across multiple study days", () => {
      const topics = [
        {
          id: 1,
          title: "Introduction to Pandas",
          estimated_minutes: 120,
        },
      ];

      const result = createSchedule({
        topics,
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
        startDate: new Date(2026, 6, 13),
        targetDate: new Date(2026, 6, 15),
      });

      expect(result.complete).toBe(true);
      expect(result.tasks).toHaveLength(2);

      expect(result.tasks[0]).toMatchObject({
        taskText: "Study: Introduction to Pandas - Part 1",
        estimatedMinutes: 60,
      });

      expect(result.tasks[1]).toMatchObject({
        taskText: "Study: Introduction to Pandas - Part 2",
        estimatedMinutes: 60,
      });
    });

    test("reports remaining work when the deadline is too early", () => {
      const topics = [
        {
          id: 1,
          title: "Large topic",
          estimated_minutes: 180,
        },
      ];

      const result = createSchedule({
        topics,
        availability: [
          {
            day_of_week: "Monday",
            available_minutes: 60,
          },
        ],
        startDate: new Date(2026, 6, 13),
        targetDate: new Date(2026, 6, 13),
      });

      expect(result.complete).toBe(false);
      expect(result.remainingMinutes).toBe(120);
      expect(result.tasks).toHaveLength(1);
    });

    test("does not schedule tasks on unavailable days", () => {
      const topics = [
        {
          id: 1,
          title: "Variables",
          estimated_minutes: 60,
        },
      ];

      const result = createSchedule({
        topics,
        availability: [
          {
            day_of_week: "Wednesday",
            available_minutes: 60,
          },
        ],
        startDate: new Date(2026, 6, 13),
        targetDate: new Date(2026, 6, 15),
      });

      expect(result.tasks[0].scheduledDate).toBe("2026-07-15");
    });
  });

  describe("findNextAvailableDate", () => {
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

    test("skips a day that is already full", () => {
      const workloadByDate = new Map([
        ["2026-07-17", 90],
        ["2026-07-20", 0],
      ]);

      const result = findNextAvailableDate({
        startDate: new Date(2026, 6, 17),
        targetDate: new Date(2026, 6, 20),
        availability,
        workloadByDate,
        requiredMinutes: 60,
      });

      expect(result.found).toBe(true);
      expect(result.date).toBe("2026-07-20");
      expect(result.remainingCapacity).toBe(60);
    });

    test("uses remaining capacity where the task fits", () => {
      const workloadByDate = new Map([
        ["2026-07-17", 30],
      ]);

      const result = findNextAvailableDate({
        startDate: new Date(2026, 6, 17),
        targetDate: new Date(2026, 6, 17),
        availability,
        workloadByDate,
        requiredMinutes: 60,
      });

      expect(result.found).toBe(true);
      expect(result.date).toBe("2026-07-17");
      expect(result.dailyCapacity).toBe(90);
      expect(result.allocatedMinutes).toBe(30);
      expect(result.remainingCapacity).toBe(60);
    });

    test("returns no slot when insufficient capacity remains", () => {
      const workloadByDate = new Map([
        ["2026-07-17", 60],
      ]);

      const result = findNextAvailableDate({
        startDate: new Date(2026, 6, 17),
        targetDate: new Date(2026, 6, 17),
        availability,
        workloadByDate,
        requiredMinutes: 60,
      });

      expect(result.found).toBe(false);
      expect(result.date).toBeNull();
    });
  });
});