const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

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
    res.status(500).json({ error: "Database connection failed" });
  }
});

const PORT = process.env.PORT || 5000;

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
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});

app.get("/api/goals/:goalId/details", async (req, res) => {
  try {
    const { goalId } = req.params;

    const goal = await pool.query(
      "SELECT * FROM goals WHERE id = $1",
      [goalId]
    );

    const milestones = await pool.query(
      "SELECT * FROM milestones WHERE goal_id = $1 ORDER BY sequence_order",
      [goalId]
    );

    const topics = await pool.query(
      `SELECT topics.*
       FROM topics
       JOIN milestones ON topics.milestone_id = milestones.id
       WHERE milestones.goal_id = $1
       ORDER BY milestones.sequence_order, topics.sequence_order`,
      [goalId]
    );

    res.json({
      goal: goal.rows[0],
      milestones: milestones.rows,
      topics: topics.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch goal details" });
  }
});

app.post("/api/goals/:goalId/generate-tasks", async (req, res) => {
  try {
    const { goalId } = req.params;
    const userId = 1; // temporary test user

    const goalResult = await pool.query(
      "SELECT * FROM goals WHERE id = $1",
      [goalId]
    );

    const goal = goalResult.rows[0];

    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const topicsResult = await pool.query(
      `SELECT topics.*
       FROM topics
       JOIN milestones ON topics.milestone_id = milestones.id
       WHERE milestones.goal_id = $1
       ORDER BY milestones.sequence_order, topics.sequence_order`,
      [goalId]
    );

    const availabilityResult = await pool.query(
      "SELECT * FROM availability WHERE user_id = $1",
      [userId]
    );

    const topics = topicsResult.rows;
    const availability = availabilityResult.rows;

    if (topics.length === 0 || availability.length === 0) {
      return res.status(400).json({
        error: "Topics or availability data missing",
      });
    }

    await pool.query(
      `DELETE FROM tasks
       WHERE topic_id IN (
         SELECT topics.id
         FROM topics
         JOIN milestones ON topics.milestone_id = milestones.id
         WHERE milestones.goal_id = $1
       )`,
      [goalId]
    );

    const dayMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    const availableDays = availability.map((day) => ({
      dayNumber: dayMap[day.day_of_week],
      availableMinutes: day.available_minutes,
      dayName: day.day_of_week,
    }));

    const today = new Date();
    const targetDate = new Date(goal.target_date);
    const generatedTasks = [];

    let topicIndex = 0;
    let remainingTopicMinutes =
      topics.length > 0 ? topics[0].estimated_minutes : 0;
    let topicPart = 1;

    for (
      let date = new Date(today);
      date <= targetDate && topicIndex < topics.length;
      date.setDate(date.getDate() + 1)
    ) {
      const matchingAvailability = availableDays.find(
        (day) => day.dayNumber === date.getDay()
      );

      if (!matchingAvailability) continue;

      let remainingDayMinutes = matchingAvailability.availableMinutes;

      while (remainingDayMinutes > 0 && topicIndex < topics.length) {
        const topic = topics[topicIndex];

        const taskMinutes = Math.min(
          remainingTopicMinutes,
          remainingDayMinutes
        );

        const taskText =
          topic.estimated_minutes > taskMinutes || topicPart > 1
            ? `Study: ${topic.title} - Part ${topicPart}`
            : `Study: ${topic.title}`;

        const insertedTask = await pool.query(
          `INSERT INTO tasks 
           (topic_id, scheduled_date, task_text, estimated_minutes, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING *`,
          [
            topic.id,
            date.toISOString().split("T")[0],
            taskText,
            taskMinutes,
          ]
        );

        generatedTasks.push(insertedTask.rows[0]);

        remainingDayMinutes -= taskMinutes;
        remainingTopicMinutes -= taskMinutes;

        if (remainingTopicMinutes === 0) {
          topicIndex++;
          topicPart = 1;

          if (topicIndex < topics.length) {
            remainingTopicMinutes = topics[topicIndex].estimated_minutes;
          }
        } else {
          topicPart++;
        }
      }
    }

    res.json({
      message: "Tasks generated successfully",
      tasks_created: generatedTasks.length,
      tasks: generatedTasks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate tasks" });
  }
});

app.get("/api/goals/:goalId/tasks", async (req, res) => {
  try {
    const { goalId } = req.params;

    const tasks = await pool.query(
      `SELECT tasks.*
       FROM tasks
       JOIN topics ON tasks.topic_id = topics.id
       JOIN milestones ON topics.milestone_id = milestones.id
       WHERE milestones.goal_id = $1
       ORDER BY tasks.scheduled_date`,
      [goalId]
    );

    res.json(tasks.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.patch("/api/tasks/:taskId/status", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["pending", "completed", "skipped"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status. Use pending, completed, or skipped.",
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
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({
      message: "Task status updated successfully",
      task: updatedTask.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update task status" });
  }
});

app.post("/api/tasks/:taskId/reschedule", async (req, res) => {
  try {
    const { taskId } = req.params;

    const taskResult = await pool.query(
      `SELECT tasks.*, goals.user_id
       FROM tasks
       JOIN topics ON tasks.topic_id = topics.id
       JOIN milestones ON topics.milestone_id = milestones.id
       JOIN goals ON milestones.goal_id = goals.id
       WHERE tasks.id = $1`,
      [taskId]
    );

    const task = taskResult.rows[0];

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (task.status !== "skipped") {
      return res.status(400).json({
        error: "Only skipped tasks can be rescheduled",
      });
    }

    const availabilityResult = await pool.query(
      "SELECT * FROM availability WHERE user_id = $1",
      [task.user_id]
    );

    const availability = availabilityResult.rows;

    if (availability.length === 0) {
      return res.status(400).json({
        error: "No availability found for this user",
      });
    }

    const dayMap = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    const availableDayNumbers = availability.map(
      (day) => dayMap[day.day_of_week]
    );

    let newDate = new Date(task.scheduled_date);
    newDate.setDate(newDate.getDate() + 1);

    while (!availableDayNumbers.includes(newDate.getDay())) {
      newDate.setDate(newDate.getDate() + 1);
    }

    const rescheduledTask = await pool.query(
      `INSERT INTO tasks
       (topic_id, scheduled_date, task_text, estimated_minutes, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [
        task.topic_id,
        newDate.toISOString().split("T")[0],
        `${task.task_text} (Rescheduled)`,
        task.estimated_minutes,
      ]
    );

    res.json({
      message: "Skipped task rescheduled successfully",
      original_task: task,
      new_task: rescheduledTask.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reschedule task" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});