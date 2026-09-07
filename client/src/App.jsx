import { useEffect, useState } from "react";
import "./App.css";
import api from "./services/api";
import GoalSetupForm from "./components/GoalSetupForm";
import ProgressDashboard from "./components/ProgressDashboard";

const DEFAULT_USER_ID = 1;

const getErrorMessage = (error, fallback) =>
  error.response?.data?.error || fallback;

/**
 * Loads the data required for the application's initial view.
 *
 * Keeping the asynchronous request outside the component effect means
 * React state is updated only after external data has been retrieved.
 */
async function fetchInitialApplicationData() {
  const goalsResponse = await api.get(
    `/api/goals/${DEFAULT_USER_ID}`
  );

  const loadedGoals = goalsResponse.data;

  if (loadedGoals.length === 0) {
    return {
      goals: [],
      initialGoalId: null,
      goalDetails: null,
      tasks: [],
      progressData: null,
      progressError: "",
    };
  }

  const initialGoalId = loadedGoals[0].id;

  const [
    goalDetailsResponse,
    tasksResponse,
    progressResult,
  ] = await Promise.all([
    api.get(`/api/goals/${initialGoalId}/details`),
    api.get(`/api/goals/${initialGoalId}/tasks`),

    api
      .get(`/api/goals/${initialGoalId}/progress`)
      .then((response) => ({
        data: response.data,
        error: "",
      }))
      .catch((error) => ({
        data: null,
        error: getErrorMessage(
          error,
          "Goal progress could not be calculated."
        ),
      })),
  ]);

  return {
    goals: loadedGoals,
    initialGoalId,
    goalDetails: goalDetailsResponse.data,
    tasks: tasksResponse.data,
    progressData: progressResult.data,
    progressError: progressResult.error,
  };
}

function App() {
  const userId = DEFAULT_USER_ID;

  const [goals, setGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] =
    useState(null);

  const [goalDetails, setGoalDetails] =
    useState(null);
  const [tasks, setTasks] = useState([]);
  const [progressData, setProgressData] =
    useState(null);
  const [isProgressLoading, setIsProgressLoading] =
    useState(false);
  const [progressError, setProgressError] =
    useState("");

  const [showSetupForm, setShowSetupForm] =
    useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(true);
  const [isGenerating, setIsGenerating] =
    useState(false);

  const showSuccess = (text) => {
    setMessage(text);
    setMessageType("success");
  };

  const showError = (text) => {
    setMessage(text);
    setMessageType("error");
  };

  const fetchGoals = async () => {
    const response = await api.get(
      `/api/goals/${userId}`
    );

    setGoals(response.data);

    return response.data;
  };

  const fetchGoalDetails = async (goalId) => {
    const response = await api.get(
      `/api/goals/${goalId}/details`
    );

    setGoalDetails(response.data);

    return response.data;
  };

  const fetchTasks = async (goalId) => {
    const response = await api.get(
      `/api/goals/${goalId}/tasks`
    );

    setTasks(response.data);

    return response.data;
  };

  const fetchProgress = async (goalId) => {
    if (!goalId) {
      setProgressData(null);
      return null;
    }

    setIsProgressLoading(true);
    setProgressError("");

    try {
      const response = await api.get(
        `/api/goals/${goalId}/progress`
      );

      setProgressData(response.data);

      return response.data;
    } catch (error) {
      const errorMessage = getErrorMessage(
        error,
        "Goal progress could not be calculated."
      );

      setProgressError(errorMessage);
      setProgressData(null);
      return null;
    } finally {
      setIsProgressLoading(false);
    }
  };

  const loadSelectedGoal = async (goalId) => {
    if (!goalId) {
      setGoalDetails(null);
      setTasks([]);
      setProgressData(null);
      setProgressError("");
      return;
    }

    try {
      await Promise.all([
        fetchGoalDetails(goalId),
        fetchTasks(goalId),
        fetchProgress(goalId),
      ]);
    } catch (error) {
      showError(
        getErrorMessage(
          error,
          "The selected learning plan could not be loaded."
        )
      );
    }
  };

  const refreshGoalData = async () => {
    if (!selectedGoalId) {
      return;
    }

    await Promise.all([
      fetchTasks(selectedGoalId),
      fetchProgress(selectedGoalId),
    ]);
  };

  const handleGoalSelection = async (
    event
  ) => {
    const goalId = Number(
      event.target.value
    );

    setSelectedGoalId(goalId);
    setMessage("");
    setProgressData(null);
    setProgressError("");

    await loadSelectedGoal(goalId);
  };

  const handleGoalCreated = async (
    goalId
  ) => {
    try {
      const updatedGoals =
        await fetchGoals();

      setGoals(updatedGoals);
      setSelectedGoalId(goalId);
      setShowSetupForm(false);

      await loadSelectedGoal(goalId);

      showSuccess(
        "Learning plan created. You can now generate its schedule."
      );
    } catch (error) {
      showError(
        getErrorMessage(
          error,
          "The new learning plan could not be loaded."
        )
      );
    }
  };

  const generateTasks = async () => {
    if (!selectedGoalId) {
      showError(
        "Select a learning goal first."
      );
      return;
    }

    setIsGenerating(true);
    setMessage("");

    try {
      const response = await api.post(
        `/api/goals/${selectedGoalId}/generate-tasks`
      );

      showSuccess(response.data.message);

      await refreshGoalData();
    } catch (error) {
      showError(
        getErrorMessage(
          error,
          "Tasks could not be generated."
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const updateTaskStatus = async (
    taskId,
    status
  ) => {
    setMessage("");

    try {
      const response = await api.patch(
        `/api/tasks/${taskId}/status`,
        { status }
      );

      showSuccess(response.data.message);

      await refreshGoalData();
    } catch (error) {
      showError(
        getErrorMessage(
          error,
          "The task status could not be updated."
        )
      );
    }
  };

  const rescheduleTask = async (taskId) => {
    setMessage("");

    try {
      const response = await api.post(
        `/api/tasks/${taskId}/reschedule`
      );

      showSuccess(response.data.message);

      await refreshGoalData();
    } catch (error) {
      showError(
        getErrorMessage(
          error,
          "The task could not be rescheduled."
        )
      );
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initialiseApplication = async () => {
      try {
        const initialData =
          await fetchInitialApplicationData();

        if (cancelled) {
          return;
        }

        setGoals(initialData.goals);
        setSelectedGoalId(
          initialData.initialGoalId
        );
        setGoalDetails(
          initialData.goalDetails
        );
        setTasks(initialData.tasks);
        setProgressData(
          initialData.progressData
        );
        setProgressError(
          initialData.progressError
        );

        if (initialData.goals.length === 0) {
          setShowSetupForm(true);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMessage(
          getErrorMessage(
            error,
            "The application data could not be loaded."
          )
        );
        setMessageType("error");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    initialiseApplication();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <main className="app-container">
        <h1>Kaizen Study Planner</h1>
        <p>Loading planner data...</p>
      </main>
    );
  }

  return (
    <main className="app-container">
      <header className="main-header">
        <div>
          <h1>Kaizen Study Planner</h1>

          <p className="subtitle">
            Adaptive micro-task planner for
            structured learning
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowSetupForm(
              (current) => !current
            )
          }
        >
          {showSetupForm
            ? "Return to Planner"
            : "Create New Goal"}
        </button>
      </header>

      {message && (
        <p
          className={`message ${messageType}`}
        >
          {message}
        </p>
      )}

      {showSetupForm ? (
        <GoalSetupForm
          userId={userId}
          onGoalCreated={
            handleGoalCreated
          }
          onCancel={
            goals.length > 0
              ? () =>
                  setShowSetupForm(false)
              : null
          }
        />
      ) : (
        <>
          <section className="card goal-selector-card">
            <label>
              Selected learning goal

              <select
                value={
                  selectedGoalId || ""
                }
                onChange={
                  handleGoalSelection
                }
              >
                {goals.map((goal) => (
                  <option
                    key={goal.id}
                    value={goal.id}
                  >
                    {goal.title}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {goalDetails && (
            <section className="card">
              <h2>
                {goalDetails.goal.title}
              </h2>

              <p>
                <strong>
                  Target date:
                </strong>{" "}
                {new Date(
                  goalDetails.goal
                    .target_date
                ).toLocaleDateString()}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                {goalDetails.goal.status}
              </p>

              <h3>Milestones</h3>

              <ol>
                {goalDetails.milestones.map(
                  (milestone) => (
                    <li
                      key={milestone.id}
                    >
                      {milestone.title}
                    </li>
                  )
                )}
              </ol>

              <h3>Topics</h3>

              <ul>
                {goalDetails.topics.map(
                  (topic) => (
                    <li key={topic.id}>
                      {topic.title} —{" "}
                      {
                        topic.estimated_minutes
                      }{" "}
                      minutes
                    </li>
                  )
                )}
              </ul>
            </section>
          )}

          <ProgressDashboard
            progressData={progressData}
            loading={isProgressLoading}
            error={progressError}
          />

          <section className="card">
            <div className="section-header">
              <h2>
                Generated Daily Tasks
              </h2>

              <button
                type="button"
                onClick={generateTasks}
                disabled={
                  isGenerating ||
                  !selectedGoalId
                }
              >
                {isGenerating
                  ? "Generating..."
                  : tasks.length === 0
                    ? "Generate Tasks"
                    : "Regenerate Tasks"}
              </button>
            </div>

            {tasks.length === 0 ? (
              <p>
                No tasks have been
                generated for this goal.
              </p>
            ) : (
              <div className="task-list">
                {tasks.map((task) => (
                  <article
                    className={`task-card ${task.status}`}
                    key={task.id}
                  >
                    <div>
                      <h3>
                        {task.task_text}
                      </h3>

                      <p>
                        {new Date(
                          task.scheduled_date
                        ).toLocaleDateString()}{" "}
                        ·{" "}
                        {
                          task.estimated_minutes
                        }{" "}
                        minutes
                      </p>

                      <span className="status">
                        {task.status}
                      </span>
                    </div>

                    <div className="task-actions">
                      {task.status ===
                        "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              updateTaskStatus(
                                task.id,
                                "completed"
                              )
                            }
                          >
                            Complete
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateTaskStatus(
                                task.id,
                                "skipped"
                              )
                            }
                          >
                            Skip
                          </button>
                        </>
                      )}

                      {task.status ===
                        "skipped" &&
                        task.can_reschedule && (
                          <button
                            type="button"
                            onClick={() =>
                              rescheduleTask(
                                task.id
                              )
                            }
                          >
                            Reschedule
                          </button>
                        )}

                      {task.status ===
                        "skipped" &&
                        !task.can_reschedule && (
                          <span className="rescheduled-label">
                            {task.reschedule_status ||
                              (task.rescheduled_at
                                ? "Replacement created"
                                : "Covered by current schedule")}
                          </span>
                        )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default App;