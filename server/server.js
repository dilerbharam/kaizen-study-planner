const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./db");

const {
  normaliseDate,
  formatDate,
  validateAvailability,
  calculateRequiredMinutes,
  calculateAvailableCapacity,
  createSchedule,
} = require("./services/schedulingService");

const {
  rebalanceTasks,
} = require("./services/rebalancingService");

const {
  calculateGoalProgress,
} = require("./services/progressService");

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
    console.error(
      "Database connection test failed:",
      error
    );

    return res.status(500).json({
      error: "Database connection failed",
    });
  }
});

/*
 * Retrieves all goals belonging to a user.
 */
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

/*
 * Retrieves a goal with its milestones and topics.
 */
app.get(
  "/api/goals/:goalId/details",
  async (req, res) => {
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
         ORDER BY
           milestones.sequence_order,
           topics.sequence_order`,
        [goalId]
      );

      return res.json({
        goal: goalResult.rows[0],
        milestones: milestonesResult.rows,
        topics: topicsResult.rows,
      });
    } catch (error) {
      console.error(
        "Failed to fetch goal details:",
        error
      );

      return res.status(500).json({
        error: "Failed to fetch goal details",
      });
    }
  }
);

/*
 * Creates a new learning goal.
 */
app.post("/api/goals", async (req, res) => {
  try {
    const {
      userId,
      title,
      targetDate,
    } = req.body;

    if (!userId || !title?.trim() || !targetDate) {
      return res.status(400).json({
        error:
          "User ID, goal title and target date are required.",
      });
    }

    const parsedTargetDate =
      normaliseDate(targetDate);

    const today = normaliseDate(new Date());

    if (!parsedTargetDate) {
      return res.status(400).json({
        error: "The target date is invalid.",
      });
    }

    if (parsedTargetDate < today) {
      return res.status(400).json({
        error:
          "The target date must be today or a future date.",
      });
    }

    const userResult = await pool.query(
      `SELECT id
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    const goalResult = await pool.query(
      `INSERT INTO goals
        (
          user_id,
          title,
          target_date,
          status
        )
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [
        userId,
        title.trim(),
        targetDate,
      ]
    );

    return res.status(201).json({
      message: "Goal created successfully.",
      goal: goalResult.rows[0],
    });
  } catch (error) {
    console.error("Failed to create goal:", error);

    return res.status(500).json({
      error: "Failed to create goal.",
    });
  }
});

/*
 * Creates a milestone belonging to a goal.
 */
app.post(
  "/api/goals/:goalId/milestones",
  async (req, res) => {
    try {
      const { goalId } = req.params;

      const {
        title,
        sequenceOrder,
      } = req.body;

      if (!title?.trim()) {
        return res.status(400).json({
          error: "Milestone title is required.",
        });
      }

      const goalResult = await pool.query(
        `SELECT id
         FROM goals
         WHERE id = $1`,
        [goalId]
      );

      if (goalResult.rows.length === 0) {
        return res.status(404).json({
          error: "Goal not found.",
        });
      }

      const milestoneResult =
        await pool.query(
          `INSERT INTO milestones
            (
              goal_id,
              title,
              sequence_order
            )
           VALUES (
             $1,
             $2,
             COALESCE(
               $3,
               (
                 SELECT
                   COALESCE(
                     MAX(sequence_order),
                     0
                   ) + 1
                 FROM milestones
                 WHERE goal_id = $1
               )
             )
           )
           RETURNING *`,
          [
            goalId,
            title.trim(),
            sequenceOrder || null,
          ]
        );

      return res.status(201).json({
        message:
          "Milestone created successfully.",
        milestone:
          milestoneResult.rows[0],
      });
    } catch (error) {
      console.error(
        "Failed to create milestone:",
        error
      );

      return res.status(500).json({
        error: "Failed to create milestone.",
      });
    }
  }
);

/*
 * Creates a topic belonging to a milestone.
 */
app.post(
  "/api/milestones/:milestoneId/topics",
  async (req, res) => {
    try {
      const { milestoneId } = req.params;

      const {
        title,
        estimatedMinutes,
        sequenceOrder,
      } = req.body;

      const minutes = Number(
        estimatedMinutes
      );

      if (!title?.trim()) {
        return res.status(400).json({
          error: "Topic title is required.",
        });
      }

      if (
        !Number.isInteger(minutes) ||
        minutes <= 0
      ) {
        return res.status(400).json({
          error:
            "Estimated minutes must be a positive whole number.",
        });
      }

      const milestoneResult =
        await pool.query(
          `SELECT id
           FROM milestones
           WHERE id = $1`,
          [milestoneId]
        );

      if (
        milestoneResult.rows.length === 0
      ) {
        return res.status(404).json({
          error: "Milestone not found.",
        });
      }

      const topicResult = await pool.query(
        `INSERT INTO topics
          (
            milestone_id,
            title,
            estimated_minutes,
            sequence_order
          )
         VALUES (
           $1,
           $2,
           $3,
           COALESCE(
             $4,
             (
               SELECT
                 COALESCE(
                   MAX(sequence_order),
                   0
                 ) + 1
               FROM topics
               WHERE milestone_id = $1
             )
           )
         )
         RETURNING *`,
        [
          milestoneId,
          title.trim(),
          minutes,
          sequenceOrder || null,
        ]
      );

      return res.status(201).json({
        message: "Topic created successfully.",
        topic: topicResult.rows[0],
      });
    } catch (error) {
      console.error(
        "Failed to create topic:",
        error
      );

      return res.status(500).json({
        error: "Failed to create topic.",
      });
    }
  }
);

/*
 * Retrieves weekly availability for a specific goal.
 */
app.get(
  "/api/goals/:goalId/availability",
  async (req, res) => {
    try {
      const { goalId } = req.params;

      const goalResult = await pool.query(
        `SELECT id
         FROM goals
         WHERE id = $1`,
        [goalId]
      );

      if (goalResult.rows.length === 0) {
        return res.status(404).json({
          error: "Goal not found.",
        });
      }

      const availabilityResult =
        await pool.query(
          `SELECT *
           FROM availability
           WHERE goal_id = $1
           ORDER BY id`,
          [goalId]
        );

      return res.json(
        availabilityResult.rows
      );
    } catch (error) {
      console.error(
        "Failed to fetch goal availability:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to fetch goal availability.",
      });
    }
  }
);

/*
 * Replaces weekly availability for a specific goal.
 */
app.put(
  "/api/goals/:goalId/availability",
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const { goalId } = req.params;
      const { availability } = req.body;

      const validation =
        validateAvailability(availability);

      if (!validation.valid) {
        return res.status(400).json({
          error: validation.error,
        });
      }

      const uniqueDays = new Set(
        availability.map(
          (entry) => entry.day_of_week
        )
      );

      if (
        uniqueDays.size !==
        availability.length
      ) {
        return res.status(400).json({
          error:
            "Each weekday can only appear once.",
        });
      }

      const goalResult = await client.query(
        `SELECT id, user_id
         FROM goals
         WHERE id = $1`,
        [goalId]
      );

      const goal = goalResult.rows[0];

      if (!goal) {
        return res.status(404).json({
          error: "Goal not found.",
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      await client.query(
        `DELETE FROM availability
         WHERE goal_id = $1`,
        [goalId]
      );

      const savedAvailability = [];

      for (const entry of availability) {
        const availabilityResult =
          await client.query(
            `INSERT INTO availability
              (
                user_id,
                goal_id,
                day_of_week,
                available_minutes
              )
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [
              goal.user_id,
              goalId,
              entry.day_of_week,
              Number(
                entry.available_minutes
              ),
            ]
          );

        savedAvailability.push(
          availabilityResult.rows[0]
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.json({
        message:
          "Goal availability updated successfully.",
        availability: savedAvailability,
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }

      console.error(
        "Failed to update goal availability:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to update goal availability.",
      });
    } finally {
      client.release();
    }
  }
);

/*
 * Generates a complete schedule for a goal.
 */
app.post(
  "/api/goals/:goalId/generate-tasks",
  async (req, res) => {
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

      const today = normaliseDate(
        new Date()
      );

      const targetDate = normaliseDate(
        goal.target_date
      );

      if (!targetDate) {
        return res.status(400).json({
          error:
            "The goal has an invalid target date.",
        });
      }

      if (targetDate < today) {
        return res.status(400).json({
          error:
            "The target date must be today or a future date.",
        });
      }

      const topicsResult =
        await client.query(
          `SELECT topics.*
           FROM topics
           JOIN milestones
             ON topics.milestone_id =
                milestones.id
           WHERE milestones.goal_id = $1
           ORDER BY
             milestones.sequence_order,
             topics.sequence_order`,
          [goalId]
        );

      const topics = topicsResult.rows;

      if (topics.length === 0) {
        return res.status(400).json({
          error:
            "No topics have been added to this goal.",
        });
      }

      const availabilityResult =
        await client.query(
          `SELECT *
           FROM availability
           WHERE goal_id = $1
           ORDER BY id`,
          [goalId]
        );

      const availability =
        availabilityResult.rows;

      const availabilityValidation =
        validateAvailability(availability);

      if (
        !availabilityValidation.valid
      ) {
        return res.status(400).json({
          error:
            availabilityValidation.error,
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

      if (
        totalAvailableMinutes <
        totalRequiredMinutes
      ) {
        return res.status(422).json({
          error:
            "The remaining work cannot fit before the target date.",
          required_minutes:
            totalRequiredMinutes,
          available_minutes:
            totalAvailableMinutes,
          remaining_minutes:
            totalRequiredMinutes -
            totalAvailableMinutes,
        });
      }

      const scheduleResult =
        createSchedule({
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
          remaining_minutes:
            scheduleResult.remainingMinutes,
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
             ON topics.milestone_id =
                milestones.id
           WHERE milestones.goal_id = $1
         )`,
        [goalId]
      );

      const generatedTasks = [];

      for (
        const task of scheduleResult.tasks
      ) {
        const insertedTask =
          await client.query(
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

        generatedTasks.push(
          insertedTask.rows[0]
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        message:
          `${generatedTasks.length} tasks generated successfully`,
        tasks_created:
          generatedTasks.length,
        required_minutes:
          totalRequiredMinutes,
        available_minutes:
          totalAvailableMinutes,
        tasks: generatedTasks,
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }

      console.error(
        "Failed to generate tasks:",
        error
      );

      return res.status(500).json({
        error: "Failed to generate tasks",
      });
    } finally {
      client.release();
    }
  }
);

/*
 * Retrieves all scheduled tasks for a goal.
 */
app.get(
  "/api/goals/:goalId/tasks",
  async (req, res) => {
    try {
      const { goalId } = req.params;

      const tasksResult = await pool.query(
        `SELECT tasks.*
         FROM tasks
         JOIN topics
           ON tasks.topic_id = topics.id
         JOIN milestones
           ON topics.milestone_id =
              milestones.id
         WHERE milestones.goal_id = $1
         ORDER BY
           tasks.scheduled_date,
           tasks.id`,
        [goalId]
      );

      return res.json(tasksResult.rows);
    } catch (error) {
      console.error(
        "Failed to fetch tasks:",
        error
      );

      return res.status(500).json({
        error: "Failed to fetch tasks",
      });
    }
  }
);

/*
 * Returns progress and feasibility information for a goal.
 */
app.get(
  "/api/goals/:goalId/progress",
  async (req, res) => {
    try {
      const { goalId } = req.params;

      const goalResult = await pool.query(
        `SELECT *
         FROM goals
         WHERE id = $1`,
        [goalId]
      );

      const goal = goalResult.rows[0];

      if (!goal) {
        return res.status(404).json({
          error: "Goal not found.",
        });
      }

      const topicsResult =
        await pool.query(
          `SELECT topics.*
           FROM topics
           JOIN milestones
             ON topics.milestone_id =
                milestones.id
           WHERE milestones.goal_id = $1
           ORDER BY
             milestones.sequence_order,
             topics.sequence_order`,
          [goalId]
        );

      const tasksResult = await pool.query(
        `SELECT tasks.*
         FROM tasks
         JOIN topics
           ON tasks.topic_id = topics.id
         JOIN milestones
           ON topics.milestone_id =
              milestones.id
         WHERE milestones.goal_id = $1
         ORDER BY
           tasks.scheduled_date,
           tasks.id`,
        [goalId]
      );

      const availabilityResult =
        await pool.query(
          `SELECT *
           FROM availability
           WHERE goal_id = $1
           ORDER BY id`,
          [goalId]
        );

      const progress =
        calculateGoalProgress({
          topics: topicsResult.rows,
          tasks: tasksResult.rows,
          availability:
            availabilityResult.rows,
          targetDate: goal.target_date,
        });

      if (!progress.valid) {
        return res.status(400).json({
          error: progress.error,
        });
      }

      return res.json({
        goal: {
          id: goal.id,
          title: goal.title,
          target_date: goal.target_date,
          status: goal.status,
        },
        progress,
      });
    } catch (error) {
      console.error(
        "Failed to calculate goal progress:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to calculate goal progress.",
      });
    }
  }
);

/*
 * Updates a task's status.
 */
app.patch(
  "/api/tasks/:taskId/status",
  async (req, res) => {
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

      const taskResult = await pool.query(
        `SELECT *
         FROM tasks
         WHERE id = $1`,
        [taskId]
      );

      const existingTask =
        taskResult.rows[0];

      if (!existingTask) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      if (existingTask.status !== "pending") {
        return res.status(409).json({
          error:
            "Only pending tasks can have their status updated.",
        });
      }

      const updatedTaskResult =
        await pool.query(
          `UPDATE tasks
           SET status = $1
           WHERE id = $2
           RETURNING *`,
          [status, taskId]
        );

      return res.json({
        message:
          "Task status updated successfully",
        task: updatedTaskResult.rows[0],
      });
    } catch (error) {
      console.error(
        "Failed to update task status:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to update task status",
      });
    }
  }
);

/*
 * Rebalances a skipped task together with future pending tasks.
 */
app.post(
  "/api/tasks/:taskId/reschedule",
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const { taskId } = req.params;

      const skippedTaskResult =
        await client.query(
          `SELECT
             tasks.*,
             goals.id AS goal_id,
             goals.user_id,
             goals.target_date
           FROM tasks
           JOIN topics
             ON tasks.topic_id = topics.id
           JOIN milestones
             ON topics.milestone_id =
                milestones.id
           JOIN goals
             ON milestones.goal_id = goals.id
           WHERE tasks.id = $1`,
          [taskId]
        );

      const skippedTask =
        skippedTaskResult.rows[0];

      if (!skippedTask) {
        return res.status(404).json({
          error: "Task not found.",
        });
      }

      if (
        skippedTask.status !== "skipped"
      ) {
        return res.status(400).json({
          error:
            "Only skipped tasks can be rescheduled.",
        });
      }

      const existingReplacementResult =
        await client.query(
          `SELECT id
           FROM tasks
           WHERE topic_id = $1
             AND task_text LIKE $2
             AND status = 'pending'
           LIMIT 1`,
          [
            skippedTask.topic_id,
            `${skippedTask.task_text}%`,
          ]
        );

      if (
        existingReplacementResult.rows.length >
        0
      ) {
        return res.status(409).json({
          error:
            "This skipped task has already been rescheduled.",
        });
      }

      const availabilityResult =
        await client.query(
          `SELECT *
           FROM availability
           WHERE goal_id = $1
           ORDER BY id`,
          [skippedTask.goal_id]
        );

      const availability =
        availabilityResult.rows;

      const availabilityValidation =
        validateAvailability(availability);

      if (
        !availabilityValidation.valid
      ) {
        return res.status(400).json({
          error:
            availabilityValidation.error,
        });
      }

      const targetDate =
        normaliseDate(
          skippedTask.target_date
        );

      const skippedDate =
        normaliseDate(
          skippedTask.scheduled_date
        );

      const today = normaliseDate(
        new Date()
      );

      if (
        !targetDate ||
        !skippedDate ||
        !today
      ) {
        return res.status(400).json({
          error:
            "The task contains an invalid date.",
        });
      }

      const searchStartDate =
        new Date(skippedDate);

      searchStartDate.setDate(
        searchStartDate.getDate() + 1
      );

      if (searchStartDate < today) {
        searchStartDate.setTime(
          today.getTime()
        );
      }

      const futurePendingResult =
        await client.query(
          `SELECT tasks.*
           FROM tasks
           JOIN topics
             ON tasks.topic_id = topics.id
           JOIN milestones
             ON topics.milestone_id =
                milestones.id
           WHERE milestones.goal_id = $1
             AND tasks.status = 'pending'
             AND (
               tasks.scheduled_date > $2
               OR (
                 tasks.scheduled_date = $2
                 AND tasks.id > $3
               )
             )
           ORDER BY
             tasks.scheduled_date,
             tasks.id`,
          [
            skippedTask.goal_id,
            skippedTask.scheduled_date,
            skippedTask.id,
          ]
        );

      const tasksToRebalance = [
        skippedTask,
        ...futurePendingResult.rows,
      ];

      const tasksToRebalanceIds =
        tasksToRebalance.map(
          (task) => task.id
        );

      const protectedWorkloadResult =
        await client.query(
          `SELECT
             tasks.scheduled_date,
             SUM(tasks.estimated_minutes)
               AS allocated_minutes
           FROM tasks
           JOIN topics
             ON tasks.topic_id = topics.id
           JOIN milestones
             ON topics.milestone_id =
                milestones.id
           WHERE milestones.goal_id = $1
             AND tasks.status <> 'skipped'
             AND NOT (
               tasks.id =
               ANY($2::int[])
             )
           GROUP BY
             tasks.scheduled_date`,
          [
            skippedTask.goal_id,
            tasksToRebalanceIds,
          ]
        );

      const workloadByDate = new Map(
        protectedWorkloadResult.rows.map(
          (row) => {
            const date =
              normaliseDate(
                row.scheduled_date
              );

            return [
              formatDate(date),
              Number(
                row.allocated_minutes
              ),
            ];
          }
        )
      );

      const rebalanceResult =
        rebalanceTasks({
          tasks: tasksToRebalance,
          availability,
          workloadByDate,
          startDate: searchStartDate,
          targetDate,
        });

      if (!rebalanceResult.complete) {
        return res.status(422).json({
          error:
            "The unfinished work cannot fit within the remaining availability before the target date.",
          remaining_minutes:
            rebalanceResult.remainingMinutes,
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const futurePendingIds =
        futurePendingResult.rows.map(
          (task) => task.id
        );

      if (
        futurePendingIds.length > 0
      ) {
        await client.query(
          `DELETE FROM tasks
           WHERE id = ANY($1::int[])`,
          [futurePendingIds]
        );
      }

      const rebuiltTasks = [];

      for (
        const task of
          rebalanceResult.tasks
      ) {
        const insertedTask =
          await client.query(
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

        rebuiltTasks.push(
          insertedTask.rows[0]
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        message:
          "Skipped task and future pending work rebalanced successfully.",
        original_skipped_task:
          skippedTask,
        removed_future_tasks:
          futurePendingIds.length,
        rebuilt_tasks:
          rebuiltTasks,
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }

      console.error(
        "Failed to rebalance tasks:",
        error
      );

      return res.status(500).json({
        error: "Failed to rebalance tasks.",
      });
    } finally {
      client.release();
    }
  }
);

app.listen(PORT, () => {
  console.log(
    `Server running on port ${PORT}`
  );
});