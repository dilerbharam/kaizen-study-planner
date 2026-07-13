const dayMap = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function normaliseDate(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function validateAvailability(availability) {
  if (!Array.isArray(availability) || availability.length === 0) {
    return {
      valid: false,
      error: "No availability has been configured for this user.",
    };
  }

  const invalidEntry = availability.find((entry) => {
    const minutes = Number(entry.available_minutes);

    return (
      dayMap[entry.day_of_week] === undefined ||
      !Number.isFinite(minutes) ||
      minutes <= 0
    );
  });

  if (invalidEntry) {
    return {
      valid: false,
      error:
        "Availability contains an invalid day or non-positive number of minutes.",
    };
  }

  return {
    valid: true,
    error: null,
  };
}

function calculateRequiredMinutes(topics) {
  return topics.reduce(
    (total, topic) => total + Number(topic.estimated_minutes),
    0
  );
}

function calculateAvailableCapacity(
  startDate,
  targetDate,
  availability
) {
  const availabilityByDay = new Map(
    availability.map((entry) => [
      dayMap[entry.day_of_week],
      Number(entry.available_minutes),
    ])
  );

  let totalCapacity = 0;

  for (
    let date = new Date(startDate);
    date <= targetDate;
    date.setDate(date.getDate() + 1)
  ) {
    totalCapacity += availabilityByDay.get(date.getDay()) || 0;
  }

  return totalCapacity;
}

function createSchedule({
  topics,
  availability,
  startDate,
  targetDate,
}) {
  const availableDays = availability.map((entry) => ({
    dayNumber: dayMap[entry.day_of_week],
    availableMinutes: Number(entry.available_minutes),
  }));

  const schedule = [];

  let topicIndex = 0;
  let remainingTopicMinutes = Number(
    topics[0]?.estimated_minutes || 0
  );
  let topicPart = 1;

  for (
    let date = new Date(startDate);
    date <= targetDate && topicIndex < topics.length;
    date.setDate(date.getDate() + 1)
  ) {
    const matchingAvailability = availableDays.find(
      (entry) => entry.dayNumber === date.getDay()
    );

    if (!matchingAvailability) {
      continue;
    }

    let remainingDayMinutes =
      matchingAvailability.availableMinutes;

    while (remainingDayMinutes > 0 && topicIndex < topics.length) {
      const topic = topics[topicIndex];

      const taskMinutes = Math.min(
        remainingTopicMinutes,
        remainingDayMinutes
      );

      const topicWasSplit =
        Number(topic.estimated_minutes) > taskMinutes ||
        topicPart > 1;

      schedule.push({
        topicId: topic.id,
        scheduledDate: formatDate(date),
        taskText: topicWasSplit
          ? `Study: ${topic.title} - Part ${topicPart}`
          : `Study: ${topic.title}`,
        estimatedMinutes: taskMinutes,
        status: "pending",
      });

      remainingDayMinutes -= taskMinutes;
      remainingTopicMinutes -= taskMinutes;

      if (remainingTopicMinutes === 0) {
        topicIndex += 1;
        topicPart = 1;

        if (topicIndex < topics.length) {
          remainingTopicMinutes = Number(
            topics[topicIndex].estimated_minutes
          );
        }
      } else {
        topicPart += 1;
      }
    }
  }

  const complete = topicIndex === topics.length;

  const remainingMinutes = complete
    ? 0
    : remainingTopicMinutes +
      topics
        .slice(topicIndex + 1)
        .reduce(
          (total, topic) =>
            total + Number(topic.estimated_minutes),
          0
        );

  return {
    complete,
    remainingMinutes,
    tasks: schedule,
  };
}

function findNextAvailableDate({
  startDate,
  targetDate,
  availability,
  workloadByDate,
  requiredMinutes,
}) {
  const availabilityByDay = new Map(
    availability.map((entry) => [
      dayMap[entry.day_of_week],
      Number(entry.available_minutes),
    ])
  );

  for (
    let date = new Date(startDate);
    date <= targetDate;
    date.setDate(date.getDate() + 1)
  ) {
    const dailyCapacity =
      availabilityByDay.get(date.getDay()) || 0;

    if (dailyCapacity === 0) {
      continue;
    }

    const dateKey = formatDate(date);
    const allocatedMinutes =
      Number(workloadByDate.get(dateKey)) || 0;

    const remainingCapacity =
      dailyCapacity - allocatedMinutes;

    if (remainingCapacity >= requiredMinutes) {
      return {
        found: true,
        date: dateKey,
        dailyCapacity,
        allocatedMinutes,
        remainingCapacity,
      };
    }
  }

  return {
    found: false,
    date: null,
    dailyCapacity: 0,
    allocatedMinutes: 0,
    remainingCapacity: 0,
  };
}

module.exports = {
  dayMap,
  normaliseDate,
  formatDate,
  validateAvailability,
  calculateRequiredMinutes,
  calculateAvailableCapacity,
  createSchedule,
  findNextAvailableDate,
};