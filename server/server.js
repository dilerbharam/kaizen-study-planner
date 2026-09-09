const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const pool = require("./db");

const authenticate =
  require("./middleware/authenticate");

const {
  AUTH_COOKIE_NAME,
  hashPassword,
  verifyPassword,
  createAuthToken,
  getAuthCookieOptions,
} = require("./services/authService");

const {
  findOwnedGoal,
  findOwnedMilestone,
  findOwnedTask,
} = require("./services/ownershipService");

const {
  normaliseDate,
  formatDate,
  validateAvailability,
  calculateAvailableCapacity,
} = require("./services/schedulingService");

const {
  rebalanceTasks,
} = require("./services/rebalancingService");

const {
  calculateGoalProgress,
} = require("./services/progressService");

const {
  calculateRemainingTopics,
} = require("./services/regenerationService");

const {
  evaluateRescheduleEligibility,
} = require("./services/rescheduleEligibilityService");

const {
  validateCompletionFeedback,
} = require("./services/completionFeedbackService");

const app = express();
const PORT = process.env.PORT || 5000;

const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN ||
  "http://localhost:5173";

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

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
 * Creates a new authenticated user account.
 */
app.post(
  "/api/auth/register",
  async (req, res) => {
    try {
      const name =
        String(req.body.name || "").trim();

      const email =
        String(req.body.email || "")
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password || ""
        );

      if (
        !name ||
        name.length > 100
      ) {
        return res.status(400).json({
          error:
            "Name is required and must be 100 characters or fewer.",
        });
      }

      if (
        !email ||
        email.length > 150 ||
        !email.includes("@")
      ) {
        return res.status(400).json({
          error:
            "Enter a valid email address.",
        });
      }

      if (password.length < 10) {
        return res.status(400).json({
          error:
            "Password must contain at least 10 characters.",
        });
      }

      const existingUser =
        await pool.query(
          `SELECT id
           FROM users
           WHERE LOWER(email) = LOWER($1)`,
          [email]
        );

      if (
        existingUser.rows.length > 0
      ) {
        return res.status(409).json({
          error:
            "An account with this email already exists.",
        });
      }

      const passwordHash =
        await hashPassword(password);

      const result =
        await pool.query(
          `INSERT INTO users
            (
              name,
              email,
              password_hash
            )
           VALUES ($1, $2, $3)
           RETURNING
             id,
             name,
             email,
             created_at`,
          [
            name,
            email,
            passwordHash,
          ]
        );

      const user = result.rows[0];

      const token =
        createAuthToken(user.id);

      res.cookie(
        AUTH_COOKIE_NAME,
        token,
        getAuthCookieOptions()
      );

      return res.status(201).json({
        message:
          "Account created successfully.",
        user,
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          error:
            "An account with this email already exists.",
        });
      }

      console.error(
        "Registration failed:",
        error
      );

      return res.status(500).json({
        error:
          "Account could not be created.",
      });
    }
  }
);

/*
 * Authenticates an existing user.
 */
app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const email =
        String(req.body.email || "")
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password || ""
        );

      if (!email || !password) {
        return res.status(400).json({
          error:
            "Email and password are required.",
        });
      }

      const result =
        await pool.query(
          `SELECT
             id,
             name,
             email,
             password_hash,
             created_at
           FROM users
           WHERE LOWER(email) = LOWER($1)`,
          [email]
        );

      const user = result.rows[0];

      const passwordMatches =
        user
          ? await verifyPassword(
              password,
              user.password_hash
            )
          : false;

      if (
        !user ||
        !passwordMatches
      ) {
        return res.status(401).json({
          error:
            "Invalid email or password.",
        });
      }

      const token =
        createAuthToken(user.id);

      res.cookie(
        AUTH_COOKIE_NAME,
        token,
        getAuthCookieOptions()
      );

      return res.json({
        message:
          "Login successful.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          created_at:
            user.created_at,
        },
      });
    } catch (error) {
      console.error(
        "Login failed:",
        error
      );

      return res.status(500).json({
        error:
          "Login could not be completed.",
      });
    }
  }
);

/*
 * Returns the currently authenticated user.
 */
app.get(
  "/api/auth/me",
  authenticate,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `SELECT
             id,
             name,
             email,
             created_at
           FROM users
           WHERE id = $1`,
          [req.user.id]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(401).json({
          error:
            "Authenticated user no longer exists.",
        });
      }

      return res.json({
        user: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Failed to retrieve authenticated user:",
        error
      );

      return res.status(500).json({
        error:
          "Authenticated user could not be retrieved.",
      });
    }
  }
);

/*
 * Ends the current authentication session.
 */
app.post(
  "/api/auth/logout",
  (req, res) => {
    res.clearCookie(
      AUTH_COOKIE_NAME,
      getAuthCookieOptions()
    );

    return res.json({
      message:
        "Logout successful.",
    });
  }
);

/*
 * Retrieves all goals belonging to a user.
 */
app.get("/api/goals", authenticate, async (req, res) => {
  try {
    const goalsResult = await pool.query(
      `SELECT *
       FROM goals
       WHERE user_id = $1
       ORDER BY id`,
      [req.user.id]
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
 * Retrieves one goal with its milestones and topics.
 */
app.get(
  "/api/goals/:goalId/details",
  authenticate,
  async (req, res) => {
    try {
      const { goalId } = req.params;

      const goal = await findOwnedGoal(
        pool,
        goalId,
        req.user.id
      );

      if (!goal) {
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
        goal,
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
app.post("/api/goals", authenticate, async (req, res) => {
  try {
    const {
      title,
      targetDate,
    } = req.body;

    if (
      !title?.trim() ||
      !targetDate
    ) {
      return res.status(400).json({
        error:
          "Goal title and target date are required.",
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
        req.user.id,
        title.trim(),
        targetDate,
      ]
    );

    return res.status(201).json({
      message: "Goal created successfully.",
      goal: goalResult.rows[0],
    });
  } catch (error) {
    console.error(
      "Failed to create goal:",
      error
    );

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
  authenticate,
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

      const goal = await findOwnedGoal(
        pool,
        goalId,
        req.user.id
      );

      if (!goal) {
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
  authenticate,
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

      const milestone =
        await findOwnedMilestone(
          pool,
          milestoneId,
          req.user.id
        );

      if (!milestone) {
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
  authenticate,
  async (req, res) => {
    try {
      const { goalId } = req.params;

      const goal = await findOwnedGoal(
        pool,
        goalId,
        req.user.id
      );

      if (!goal) {
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
  authenticate,
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

      const goal = await findOwnedGoal(
        client,
        goalId,
        req.user.id
      );

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
 * Generates or regenerates unfinished work.
 *
 * Completed and skipped records remain as history.
 * Pending replacement tasks with reschedule lineage are
 * protected. Only ordinary pending tasks are rebuilt.
 */
app.post(
  "/api/goals/:goalId/generate-tasks",
  authenticate,
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const { goalId } = req.params;

      const goal = await findOwnedGoal(
        client,
        goalId,
        req.user.id
      );

      if (!goal) {
        return res.status(404).json({
          error: "Goal not found.",
        });
      }

      const today = normaliseDate(
        new Date()
      );

      const targetDate = normaliseDate(
        goal.target_date
      );

      if (!today || !targetDate) {
        return res.status(400).json({
          error:
            "The goal contains an invalid target date.",
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

      const existingTasksResult =
        await client.query(
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

      const existingTasks =
        existingTasksResult.rows;

      const remainingPlan =
        calculateRemainingTopics({
          topics,
          tasks: existingTasks,
        });

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

      const completedTaskCount =
        existingTasks.filter(
          (task) =>
            task.status === "completed"
        ).length;

      const skippedTaskCount =
        existingTasks.filter(
          (task) =>
            task.status === "skipped"
        ).length;

      const protectedReplacementTasks =
        existingTasks.filter(
          (task) =>
            task.status === "pending" &&
            task.rescheduled_from_task_id !==
              null &&
            task.rescheduled_from_task_id !==
              undefined
        );

      /*
       * Record the daily capacity already occupied by
       * pending replacement tasks.
       */
      const protectedWorkloadByDate =
        new Map();

      for (
        const task of
          protectedReplacementTasks
      ) {
        const taskDate = normaliseDate(
          task.scheduled_date
        );

        if (
          !taskDate ||
          taskDate < today ||
          taskDate > targetDate
        ) {
          continue;
        }

        const dateKey =
          formatDate(taskDate);

        const existingMinutes =
          protectedWorkloadByDate.get(
            dateKey
          ) || 0;

        protectedWorkloadByDate.set(
          dateKey,
          existingMinutes +
            Number(
              task.estimated_minutes
            )
        );
      }

      const grossAvailableMinutes =
        calculateAvailableCapacity(
          today,
          targetDate,
          availability
        );

      const protectedMinutesInWindow =
        Array.from(
          protectedWorkloadByDate.values()
        ).reduce(
          (total, minutes) =>
            total + Number(minutes),
          0
        );

      const netAvailableMinutes =
        Math.max(
          grossAvailableMinutes -
            protectedMinutesInWindow,
          0
        );

      /*
       * When completed work and protected replacements
       * already cover the remaining plan, delete only
       * obsolete ordinary pending tasks.
       */
      if (
        remainingPlan.totalRemainingMinutes ===
        0
      ) {
        await client.query("BEGIN");
        transactionStarted = true;

        const deletedPendingResult =
          await client.query(
            `DELETE FROM tasks
             WHERE status = 'pending'
               AND rescheduled_from_task_id IS NULL
               AND topic_id IN (
                 SELECT topics.id
                 FROM topics
                 JOIN milestones
                   ON topics.milestone_id =
                      milestones.id
                 WHERE milestones.goal_id = $1
               )
             RETURNING id`,
            [goalId]
          );

        await client.query("COMMIT");
        transactionStarted = false;

        return res.json({
          message:
            "All unfinished work is already covered by completed or protected replacement tasks.",
          tasks_created: 0,
          removed_pending_tasks:
            deletedPendingResult.rowCount,
          preserved_completed_tasks:
            completedTaskCount,
          preserved_skipped_tasks:
            skippedTaskCount,
          preserved_replacement_tasks:
            protectedReplacementTasks.length,
          planned_minutes:
            remainingPlan.totalPlannedMinutes,
          completed_minutes:
            remainingPlan.totalCompletedMinutes,
          protected_pending_minutes:
            remainingPlan
              .totalProtectedPendingMinutes,
          remaining_minutes: 0,
          tasks: [],
        });
      }

      if (
        netAvailableMinutes <
        remainingPlan.totalRemainingMinutes
      ) {
        return res.status(422).json({
          error:
            "The remaining work cannot fit before the target date.",
          required_minutes:
            remainingPlan.totalRemainingMinutes,
          available_minutes:
            netAvailableMinutes,
          protected_pending_minutes:
            remainingPlan
              .totalProtectedPendingMinutes,
          shortfall_minutes:
            remainingPlan.totalRemainingMinutes -
            netAvailableMinutes,
        });
      }

      /*
       * Convert unfinished topics into task units for the
       * rebalancing service.
       */
      const tasksForRegeneration =
        remainingPlan.topics.map(
          (topic) => ({
            id: topic.id,
            topic_id: topic.id,
            task_text:
              `Study: ${topic.title}`,
            estimated_minutes:
              Number(
                topic.estimated_minutes
              ),
            status: "pending",
          })
        );

      const scheduleResult =
        rebalanceTasks({
          tasks: tasksForRegeneration,
          availability,
          workloadByDate:
            protectedWorkloadByDate,
          startDate: today,
          targetDate,
        });

      if (!scheduleResult.complete) {
        return res.status(422).json({
          error:
            "The remaining schedule could not be generated around protected replacement tasks.",
          tasks_created: 0,
          remaining_minutes:
            scheduleResult.remainingMinutes,
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      /*
       * Delete only ordinary pending tasks.
       * Pending replacement tasks retain their lineage.
       */
      const deletedPendingResult =
        await client.query(
          `DELETE FROM tasks
           WHERE status = 'pending'
             AND rescheduled_from_task_id IS NULL
             AND topic_id IN (
               SELECT topics.id
               FROM topics
               JOIN milestones
                 ON topics.milestone_id =
                    milestones.id
               WHERE milestones.goal_id = $1
             )
           RETURNING id`,
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
                status,
                rescheduled_from_task_id
              )
             VALUES (
               $1,
               $2,
               $3,
               $4,
               $5,
               NULL
             )
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
          `${generatedTasks.length} remaining tasks generated successfully.`,
        tasks_created:
          generatedTasks.length,
        removed_pending_tasks:
          deletedPendingResult.rowCount,
        preserved_completed_tasks:
          completedTaskCount,
        preserved_skipped_tasks:
          skippedTaskCount,
        preserved_replacement_tasks:
          protectedReplacementTasks.length,
        planned_minutes:
          remainingPlan.totalPlannedMinutes,
        completed_minutes:
          remainingPlan.totalCompletedMinutes,
        protected_pending_minutes:
          remainingPlan
            .totalProtectedPendingMinutes,
        required_minutes:
          remainingPlan.totalRemainingMinutes,
        available_minutes:
          netAvailableMinutes,
        tasks: generatedTasks,
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }

      console.error(
        "Failed to regenerate remaining tasks:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to regenerate remaining tasks.",
      });
    } finally {
      client.release();
    }
  }
);

/*
 * Retrieves tasks for a goal.
 *
 * Rescheduling eligibility is derived by the backend so the
 * interface does not offer actions that the scheduling rules
 * will subsequently reject.
 */
app.get(
  "/api/goals/:goalId/tasks",
  authenticate,
  async (req, res) => {
    try {
      const { goalId } = req.params;

      const goal = await findOwnedGoal(
        pool,
        goalId,
        req.user.id
      );

      if (!goal) {
        return res.status(404).json({
          error: "Goal not found.",
        });
      }

      const tasksResult = await pool.query(
        `SELECT
           tasks.*,
           goals.target_date,
           EXISTS (
             SELECT 1
             FROM tasks AS linked_replacement
             WHERE linked_replacement
                     .rescheduled_from_task_id =
                   tasks.id
           ) AS has_linked_replacement,
           EXISTS (
             SELECT 1
             FROM tasks AS active_equivalent
             WHERE active_equivalent.topic_id =
                   tasks.topic_id
               AND active_equivalent.status =
                   'pending'
               AND regexp_replace(
                     active_equivalent.task_text,
                     '\\s+\\(Rescheduled\\)$',
                     '',
                     'i'
                   )
                   =
                   regexp_replace(
                     tasks.task_text,
                     '\\s+\\(Rescheduled\\)$',
                     '',
                     'i'
                   )
           ) AS has_active_equivalent
         FROM tasks
         JOIN topics
           ON tasks.topic_id = topics.id
         JOIN milestones
           ON topics.milestone_id =
              milestones.id
         JOIN goals
           ON milestones.goal_id = goals.id
         WHERE milestones.goal_id = $1
         ORDER BY
           tasks.scheduled_date,
           tasks.id`,
        [goalId]
      );

      const tasks =
        tasksResult.rows.map((task) => {
          const eligibility =
            evaluateRescheduleEligibility({
              task,
              targetDate: task.target_date,
              hasLinkedReplacement:
                task.has_linked_replacement,
              hasActiveEquivalent:
                task.has_active_equivalent,
            });

          const {
            target_date,
            has_linked_replacement,
            has_active_equivalent,
            ...taskData
          } = task;

          return {
            ...taskData,
            can_reschedule:
              eligibility.canReschedule,
            reschedule_status:
              eligibility.status,
          };
        });

      return res.json(tasks);
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
 * Returns progress and feasibility information.
 */
app.get(
  "/api/goals/:goalId/progress",
  authenticate,
  async (req, res) => {
    try {
      const { goalId } = req.params;

      const goal = await findOwnedGoal(
        pool,
        goalId,
        req.user.id
      );

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
 * Updates a pending task's status.
 *
 * Completing a task records observed study time and perceived
 * difficulty for later Kaizen evaluation and adaptation.
 */
app.patch(
  "/api/tasks/:taskId/status",
  authenticate,
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const {
        status,
        actualMinutes,
        difficultyRating,
      } = req.body;

      const allowedStatuses = [
        "completed",
        "skipped",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          error:
            "Invalid status. Use completed or skipped.",
        });
      }

      const existingTask =
        await findOwnedTask(
          pool,
          taskId,
          req.user.id
        );

      if (!existingTask) {
        return res.status(404).json({
          error: "Task not found",
        });
      }

      if (
        existingTask.status !== "pending"
      ) {
        return res.status(409).json({
          error:
            "Only pending tasks can have their status updated.",
        });
      }

      let completionFeedback = null;

      if (status === "completed") {
        completionFeedback =
          validateCompletionFeedback({
            actualMinutes,
            difficultyRating,
          });

        if (!completionFeedback.valid) {
          return res.status(400).json({
            error:
              completionFeedback.error,
          });
        }
      }

      let updatedTaskResult;

      if (status === "completed") {
        updatedTaskResult =
          await pool.query(
            `UPDATE tasks
             SET
               status = 'completed',
               actual_minutes = $1,
               difficulty_rating = $2,
               completed_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [
              completionFeedback.actualMinutes,
              completionFeedback.difficultyRating,
              taskId,
            ]
          );
      } else {
        updatedTaskResult =
          await pool.query(
            `UPDATE tasks
             SET
               status = 'skipped',
               actual_minutes = NULL,
               difficulty_rating = NULL,
               completed_at = NULL
             WHERE id = $1
             RETURNING *`,
            [taskId]
          );
      }

      return res.json({
        message:
          status === "completed"
            ? "Task completed and learning feedback saved."
            : "Task skipped successfully.",
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
 * Rebalances a skipped task and later ordinary pending work.
 *
 * Existing replacement tasks are protected so their
 * reschedule lineage is not deleted or changed.
 *
 * Eligibility is checked before rebalancing so the API
 * rejects expired goals and duplicate replacement attempts
 * consistently with the task-list capability information.
 */
app.post(
  "/api/tasks/:taskId/reschedule",
  authenticate,
  async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      const { taskId } = req.params;

      const skippedTask =
        await findOwnedTask(
          client,
          taskId,
          req.user.id
        );

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

      const targetDate =
        normaliseDate(
          skippedTask.target_date
        );

      const skippedDate =
        normaliseDate(
          skippedTask.scheduled_date
        );

      const today =
        normaliseDate(new Date());

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

      const existingLinkedReplacementResult =
        await client.query(
          `SELECT id
           FROM tasks
           WHERE rescheduled_from_task_id = $1
           LIMIT 1`,
          [skippedTask.id]
        );

      /*
       * Prevent legacy duplicate skipped rows from
       * creating extra pending work when equivalent
       * work already exists.
       */
      const activeEquivalentResult =
        await client.query(
          `SELECT id
           FROM tasks
           WHERE topic_id = $1
             AND status = 'pending'
             AND regexp_replace(
                   task_text,
                   '\\s+\\(Rescheduled\\)$',
                   '',
                   'i'
                 )
                 =
                 regexp_replace(
                   $2::text,
                   '\\s+\\(Rescheduled\\)$',
                   '',
                   'i'
                 )
           LIMIT 1`,
          [
            skippedTask.topic_id,
            skippedTask.task_text,
          ]
        );

      const eligibility =
        evaluateRescheduleEligibility({
          task: skippedTask,
          targetDate,
          currentDate: today,
          hasLinkedReplacement:
            existingLinkedReplacementResult
              .rows.length > 0,
          hasActiveEquivalent:
            activeEquivalentResult
              .rows.length > 0,
        });

      if (!eligibility.canReschedule) {
        if (
          eligibility.status ===
          "Replacement created"
        ) {
          return res.status(409).json({
            error:
              "This skipped task has already been rescheduled.",
            reason:
              "replacement-created",
          });
        }

        if (
          eligibility.status ===
          "Covered by current schedule"
        ) {
          return res.status(409).json({
            error:
              "Equivalent pending work already exists for this skipped task.",
            reason:
              "covered-by-current-schedule",
          });
        }

        if (
          eligibility.status ===
          "Deadline passed"
        ) {
          return res.status(422).json({
            error:
              "This task cannot be rescheduled because the goal deadline has passed.",
            reason:
              "deadline-passed",
          });
        }

        return res.status(400).json({
          error:
            "This task cannot currently be rescheduled.",
          reason:
            "reschedule-unavailable",
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

      /*
       * Existing pending replacement tasks are excluded from
       * rebalancing and remain protected.
       */
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
             AND tasks.rescheduled_from_task_id
                   IS NULL
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
        const sourceTaskIds =
          Array.isArray(
            task.sourceTaskIds
          )
            ? task.sourceTaskIds.map(
                Number
              )
            : [];

        const isReplacementOfSkippedTask =
          sourceTaskIds.includes(
            Number(skippedTask.id)
          );

        const insertedTask =
          await client.query(
            `INSERT INTO tasks
              (
                topic_id,
                scheduled_date,
                task_text,
                estimated_minutes,
                status,
                rescheduled_from_task_id
              )
             VALUES (
               $1,
               $2,
               $3,
               $4,
               $5,
               $6
             )
             RETURNING *`,
            [
              task.topicId,
              task.scheduledDate,
              task.taskText,
              task.estimatedMinutes,
              task.status,
              isReplacementOfSkippedTask
                ? skippedTask.id
                : null,
            ]
          );

        rebuiltTasks.push(
          insertedTask.rows[0]
        );
      }

      const updatedSkippedTaskResult =
        await client.query(
          `UPDATE tasks
           SET rescheduled_at =
                 CURRENT_TIMESTAMP
           WHERE id = $1
             AND rescheduled_at IS NULL
           RETURNING *`,
          [skippedTask.id]
        );

      if (
        updatedSkippedTaskResult.rows
          .length === 0
      ) {
        throw new Error(
          "The skipped task was already rescheduled."
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        message:
          "Skipped task and future pending work rebalanced successfully.",
        original_skipped_task:
          updatedSkippedTaskResult.rows[0],
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