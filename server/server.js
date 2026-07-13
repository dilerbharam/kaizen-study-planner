const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");

const {
  dayMap,
  normaliseDate,
  formatDate,
  validateAvailability,
  calculateRequiredMinutes,
  calculateAvailableCapacity,
  createSchedule,
  findNextAvailableDate,
} = require("./services/schedulingService");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Kaizen Study Planner API is running");
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    return res.json({
      message: "Database connected successfully",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database connection test failed:", error);

    return res.status(500).json({
      error: "Database connection failed",
    });
  }
});

app.get("/api/goals/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const goalsResult = await pool.query(
      `SELECT *
       FROM goals
       WHERE user_id = $1
       ORDER BY id`,
      [userId]
    );

    return res.json(goalsResult.rows);
  } catch (error) {
    console.error("Failed to fetch goals:", error);

    return res.status(500).json({
      error: "Failed to fetch goals",
    });
  }
});

app.get("/api/goals/:goalId/details", async (req, res) => {
  try {
    const { goalId } = req.params;

    const goalResult = await pool.query(
      `SELECT *
       FROM goals
       WHERE id = $1`,
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
    console.error("Failed to fetch goal details:", error);

    return res.status(500).json({
      error: "Failed to fetch goal details",
    });
  }
});

app.post("/api/goals/:goalId/generate-tasks", async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const { goalId } = req.params;

    const goalResult = await client.query(
      `SELECT *
       FROM goals
       WHERE id = $1`,
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

    if (!targetDate) {
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

    const availabilityValidation =
      validateAvailability(availability);

    if (!availabilityValidation.valid) {
      return res.status(400).json({
        error: availabilityValidation.error,
      });
    }

    const totalRequiredMinutes =
      calculateRequiredMinutes(topics);

    const totalAvailableMinutes =
      calculateAvailableCapacity(
        today,
        targetDate,
        availability
      );

    if (totalAvailableMinutes < totalRequiredMinutes) {
      return res.status(422).json({
        error:
          "The remaining work cannot fit before the target date.",
        required_minutes: totalRequiredMinutes,
        available_minutes: totalAvailableMinutes,
        remaining_minutes:
          totalRequiredMinutes - totalAvailableMinutes,
      });
    }

    const scheduleResult = createSchedule({
      topics,
      availability,
      startDate: today,
      targetDate,
    });

    if (!scheduleResult.complete) {
      return res.status(422).json({
        error:
          "The complete schedule could not be generated.",
        tasks_created: 0,
        remaining_minutes: scheduleResult.remainingMinutes,
      });
    }

    await client.query("BEGIN");
    transactionStarted = true;

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

    for (const task of scheduleResult.tasks) {
      const insertedTask = await client.query(
        `INSERT INTO tasks
          (
            topic_id,
            scheduled_date,
            task_text,
            estimated_minutes,
            status
          )
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          task.topicId,
          task.scheduledDate,
          task.taskText,
          task.estimatedMinutes,
          task.status,
        ]
      );

      generatedTasks.push(insertedTask.rows[0]);
    }

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      message: `${generatedTasks.length} tasks generated successfully`,
      tasks_created: generatedTasks.length,
      required_minutes: totalRequiredMinutes,
      available_minutes: totalAvailableMinutes,
      tasks: generatedTasks,
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error("Failed to generate tasks:", error);

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

    const tasksResult = await pool.query(
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

    return res.json(tasksResult.rows);
  } catch (error) {
    console.error("Failed to fetch tasks:", error);

    return res.status(500).json({
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

    const updatedTaskResult = await pool.query(
      `UPDATE tasks
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, taskId]
    );

    if (updatedTaskResult.rows.length === 0) {
      return res.status(404).json({
        error: "Task not found",
      });
    }

    return res.json({
      message: "Task status updated successfully",
      task: updatedTaskResult.rows[0],
    });
  } catch (error) {
    console.error("Failed to update task status:", error);

    return res.status(500).json({
      error: "Failed to update task status",
    });
  }
});

app.post("/api/tasks/:taskId/reschedule", async (req, res) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    const { taskId } = req.params;

    const taskResult = await client.query(
      `SELECT
         tasks.*,
         goals.id AS goal_id,
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

    const existingReplacementResult = await client.query(
      `SELECT id
       FROM tasks
       WHERE topic_id = $1
         AND task_text = $2
         AND status = 'pending'
       LIMIT 1`,
      [
        task.topic_id,
        `${task.task_text} (Rescheduled)`,
      ]
    );

    if (existingReplacementResult.rows.length > 0) {
      return res.status(409).json({
        error: "This skipped task has already been rescheduled.",
      });
    }

    const availabilityResult = await client.query(
      `SELECT *
       FROM availability
       WHERE user_id = $1
       ORDER BY id`,
      [task.user_id]
    );

    const availability = availabilityResult.rows;

    const availabilityValidation =
      validateAvailability(availability);

    if (!availabilityValidation.valid) {
      return res.status(400).json({
        error: availabilityValidation.error,
      });
    }

    const workloadResult = await client.query(
      `SELECT
         tasks.scheduled_date,
         SUM(tasks.estimated_minutes) AS allocated_minutes
       FROM tasks
       JOIN topics
         ON tasks.topic_id = topics.id
       JOIN milestones
         ON topics.milestone_id = milestones.id
       WHERE milestones.goal_id = $1
         AND tasks.status <> 'skipped'
         AND tasks.id <> $2
       GROUP BY tasks.scheduled_date
       ORDER BY tasks.scheduled_date`,
      [task.goal_id, taskId]
    );

    const workloadByDate = new Map(
      workloadResult.rows.map((row) => {
        const date = normaliseDate(row.scheduled_date);

        return [
          formatDate(date),
          Number(row.allocated_minutes),
        ];
      })
    );

    const targetDate = normaliseDate(task.target_date);
    const originalTaskDate = normaliseDate(
      task.scheduled_date
    );
    const today = normaliseDate(new Date());

    if (!targetDate || !originalTaskDate || !today) {
      return res.status(400).json({
        error: "The task contains an invalid date.",
      });
    }

    const searchStartDate = new Date(originalTaskDate);
    searchStartDate.setDate(searchStartDate.getDate() + 1);

    if (searchStartDate < today) {
      searchStartDate.setTime(today.getTime());
    }

    const slotResult = findNextAvailableDate({
      startDate: searchStartDate,
      targetDate,
      availability,
      workloadByDate,
      requiredMinutes: Number(task.estimated_minutes),
    });

    if (!slotResult.found) {
      return res.status(422).json({
        error:
          "The skipped task cannot fit into the remaining availability before the target date.",
      });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const rescheduledTaskResult = await client.query(
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
        slotResult.date,
        `${task.task_text} (Rescheduled)`,
        task.estimated_minutes,
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      message:
        "Skipped task rescheduled within the available daily workload.",
      original_task: task,
      new_task: rescheduledTaskResult.rows[0],
      capacity: {
        date: slotResult.date,
        daily_capacity: slotResult.dailyCapacity,
        previously_allocated:
          slotResult.allocatedMinutes,
        allocated_after_rescheduling:
          slotResult.allocatedMinutes +
          Number(task.estimated_minutes),
        remaining_after_rescheduling:
          slotResult.remainingCapacity -
          Number(task.estimated_minutes),
      },
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }

    console.error("Failed to reschedule task:", error);

    return res.status(500).json({
      error: "Failed to reschedule task",
    });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});