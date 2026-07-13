const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const dayMap = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

/**
 * Returns a Date set to midnight in the local timezone.
 */
function normaliseDate(dateValue) {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Formats a Date as YYYY-MM-DD without converting it to UTC.
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Calculates the total available study minutes between two dates.
 */
function calculateAvailableCapacity(startDate, targetDate, availability) {
  const availabilityByDay = new Map(
    availability.map((day) => [
      dayMap[day.day_of_week],
      Number(day.available_minutes),
    ])
  );

  let totalCapacity = 0;

  for (
    let date = new Date(startDate);
    date <= targetDate;
    date.setDate(date.getDate() + 1)
  ) {
    const availableMinutes = availabilityByDay.get(date.getDay()) || 0;
    totalCapacity += availableMinutes;
  }

  return totalCapacity;
}

app.get("/", (req, res) => {
  res.send("Kaizen Study Planner API is running");
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "Database connected successfully",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Database connection failed",
    });
  }
});

app.get("/api/goals/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const goals = await pool.query(
      "SELECT * FROM goals WHERE user_id = $1 ORDER BY id",
      [userId]
    );

    res.json(goals.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch goals",
    });
  }
});

app.get("/api/goals/:goalId/details", async (req, res) => {
  try {
    const { goalId } = req.params;

    const goalResult = await pool.query(
      "SELECT * FROM goals WHERE id = $1",
      [goalId]
    );

    if (goalResult.rows.length === 0) {
      return res.status(404).json({
        error: "Goal not found",
      });
    }

    const milestonesResult = await pool.query(
      `SELECT *
       FROM milestones
       WHERE goal_id = $1
       ORDER BY sequence_order`,
      [goalId]
    );

    const topicsResult = await pool.query(
      `SELECT topics.*
       FROM topics
       JOIN milestones
         ON topics.milestone_id = milestones.id
       WHERE milestones.goal_id = $1
       ORDER BY milestones.sequence_order, topics.sequence_order`,
      [goalId]
    );

    return res.json({
      goal: goalResult.rows[0],
      milestones: milestonesResult.rows,
      topics: topicsResult.rows,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to fetch goal details",
    });
  }
});

app.post("/api/goals/:goalId/generate-tasks", async (req, res) => {
  const client = await pool.connect();

  try {
    const { goalId } = req.params;

    const goalResult = await client.query(
      "SELECT * FROM goals WHERE id = $1",
      [goalId]
    );

    const goal = goalResult.rows[0];

    if (!goal) {
      return res.status(404).json({
        error: "Goal not found",
      });
    }

    const today = normaliseDate(new Date());
    const targetDate = normaliseDate(goal.target_date);

    if (Number.isNaN(targetDate.getTime())) {
      return res.status(400).json({
        error: "The goal has an invalid target date.",
      });
    }

    if (targetDate < today) {
      return res.status(400).json({
        error: "The target date must be today or a future date.",
      });
    }

    const topicsResult = await client.query(
      `SELECT topics.*
       FROM topics
       JOIN milestones
         ON topics.milestone_id = milestones.id
       WHERE milestones.goal_id = $1
       ORDER BY milestones.sequence_order, topics.sequence_order`,
      [goalId]
    );

    const topics = topicsResult.rows;

    if (topics.length === 0) {
      return res.status(400).json({
        error: "No topics have been added to this goal.",
      });
    }

    const availabilityResult = await client.query(
      `SELECT *
       FROM availability
       WHERE user_id = $1
       ORDER BY id`,
      [goal.user_id]
    );

    const availability = availabilityResult.rows;

    if (availability.length === 0) {
      return res.status(400).json({
        error: "No availability has been configured for this user.",
      });
    }

    const invalidAvailability = availability.find(
      (day) =>
        dayMap[day.day_of_week] === undefined ||
        Number(day.available_minutes) <= 0
    );

    if (invalidAvailability) {
      return res.status(400).json({
        error:
          "Availability contains an invalid day or non-positive number of minutes.",
      });
    }

    const totalRequiredMinutes = topics.reduce(
      (total, topic) => total + Number(topic.estimated_minutes),
      0
    );

    const totalAvailableMinutes = calculateAvailableCapacity(
      today,
      targetDate,
      availability
    );

    if (totalAvailableMinutes < totalRequiredMinutes) {
      return res.status(422).json({
        error: "The remaining work cannot fit before the target date.",
        required_minutes: totalRequiredMinutes,
        available_minutes: totalAvailableMinutes,
        remaining_minutes: totalRequiredMinutes - totalAvailableMinutes,
      });
    }

    const availableDays = availability.map((day) => ({
      dayNumber: dayMap[day.day_of_week],
      availableMinutes: Number(day.available_minutes),
      dayName: day.day_of_week,
    }));

    await client.query("BEGIN");

    await client.query(
      `DELETE FROM tasks
       WHERE topic_id IN (
         SELECT topics.id
         FROM topics
         JOIN milestones
           ON topics.milestone_id = milestones.id
         WHERE milestones.goal_id = $1
       )`,
      [goalId]
    );

    const generatedTasks = [];

    let topicIndex = 0;
    let remainingTopicMinutes = Number(topics[0].estimated_minutes);
    let topicPart = 1;

    for (
      let date = new Date(today);
      date <= targetDate && topicIndex < topics.length;
      date.setDate(date.getDate() + 1)
    ) {
      const matchingAvailability = availableDays.find(
        (day) => day.dayNumber === date.getDay()
      );

      if (!matchingAvailability) {
        continue;
      }

      let remainingDayMinutes = matchingAvailability.availableMinutes;

      while (remainingDayMinutes > 0 && topicIndex < topics.length) {
        const topic = topics[topicIndex];

        const taskMinutes = Math.min(
          remainingTopicMinutes,
          remainingDayMinutes
        );

        const isSplitTask =
          Number(topic.estimated_minutes) > taskMinutes || topicPart > 1;

        const taskText = isSplitTask
          ? `Study: ${topic.title} - Part ${topicPart}`
          : `Study: ${topic.title}`;

        const insertedTask = await client.query(
          `INSERT INTO tasks
            (
              topic_id,
              scheduled_date,
              task_text,
              estimated_minutes,
              status
            )
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING *`,
          [
            topic.id,
            formatDate(date),
            taskText,
            taskMinutes,
          ]
        );

        generatedTasks.push(insertedTask.rows[0]);

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

    if (topicIndex < topics.length) {
      await client.query("ROLLBACK");

      const unallocatedMinutes =
        remainingTopicMinutes +
        topics
          .slice(topicIndex + 1)
          .reduce(
            (total, topic) =>
              total + Number(topic.estimated_minutes),
            0
          );

      return res.status(422).json({
        error: "The complete schedule could not be generated.",
        tasks_created: 0,
        remaining_minutes: unallocatedMinutes,
      });
    }

    await client.query("COMMIT");

    return res.status(201).json({
      message: `${generatedTasks.length} tasks generated successfully`,
      tasks_created: generatedTasks.length,
      required_minutes: totalRequiredMinutes,
      available_minutes: totalAvailableMinutes,
      tasks: generatedTasks,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);

    return res.status(500).json({
      error: "Failed to generate tasks",
    });
  } finally {
    client.release();
  }
});

app.get("/api/goals/:goalId/tasks", async (req, res) => {
  try {
    const { goalId } = req.params;

    const tasks = await pool.query(
      `SELECT tasks.*
       FROM tasks
       JOIN topics
         ON tasks.topic_id = topics.id
       JOIN milestones
         ON topics.milestone_id = milestones.id
       WHERE milestones.goal_id = $1
       ORDER BY tasks.scheduled_date, tasks.id`,
      [goalId]
    );

    res.json(tasks.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch tasks",
    });
  }
});

app.patch("/api/tasks/:taskId/status", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "pending",
      "completed",
      "skipped",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error:
          "Invalid status. Use pending, completed, or skipped.",
      });
    }

    const updatedTask = await pool.query(
      `UPDATE tasks
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, taskId]
    );

    if (updatedTask.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    return res.json({
      message: "Task status updated successfully",
      task: updatedTask.rows[0],
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to update task status",
    });
  }
});

app.post("/api/tasks/:taskId/reschedule", async (req, res) => {
  try {
    const { taskId } = req.params;

    const taskResult = await pool.query(
      `SELECT
         tasks.*,
         goals.user_id,
         goals.target_date
       FROM tasks
       JOIN topics
         ON tasks.topic_id = topics.id
       JOIN milestones
         ON topics.milestone_id = milestones.id
       JOIN goals
         ON milestones.goal_id = goals.id
       WHERE tasks.id = $1`,
      [taskId]
    );

    const task = taskResult.rows[0];

    if (!task) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    if (task.status !== "skipped") {
      return res.status(400).json({
        error: "Only skipped tasks can be rescheduled.",
      });
    }

    const availabilityResult = await pool.query(
      `SELECT *
       FROM availability
       WHERE user_id = $1`,
      [task.user_id]
    );

    const availability = availabilityResult.rows;

    if (availability.length === 0) {
      return res.status(400).json({
        error: "No availability found for this user.",
      });
    }

    const availabilityByDay = new Map(
      availability.map((day) => [
        dayMap[day.day_of_week],
        Number(day.available_minutes),
      ])
    );

    const targetDate = normaliseDate(task.target_date);
    const newDate = normaliseDate(task.scheduled_date);

    newDate.setDate(newDate.getDate() + 1);

    let suitableDateFound = false;

    while (newDate <= targetDate) {
      const dailyCapacity =
        availabilityByDay.get(newDate.getDay()) || 0;

      if (dailyCapacity > 0) {
        suitableDateFound = true;
        break;
      }

      newDate.setDate(newDate.getDate() + 1);
    }

    if (!suitableDateFound) {
      return res.status(422).json({
        error:
          "The skipped task cannot be rescheduled before the target date.",
      });
    }

    const rescheduledTask = await pool.query(
      `INSERT INTO tasks
        (
          topic_id,
          scheduled_date,
          task_text,
          estimated_minutes,
          status
        )
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [
        task.topic_id,
        formatDate(newDate),
        `${task.task_text} (Rescheduled)`,
        task.estimated_minutes,
      ]
    );

    return res.status(201).json({
      message: "Skipped task rescheduled successfully",
      original_task: task,
      new_task: rescheduledTask.rows[0],
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to reschedule task",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});