import { useEffect, useState } from "react";
import "./App.css";
import api from "./services/api";
import GoalSetupForm from "./components/GoalSetupForm";
import ProgressDashboard from "./components/ProgressDashboard";

function App() {
  const userId = 1;

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

  const getErrorMessage = (error, fallback) =>
    error.response?.data?.error || fallback;

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

  const loadApplication = async () => {
    setIsLoading(true);

    try {
      const loadedGoals = await fetchGoals();

      if (loadedGoals.length > 0) {
        const initialGoalId =
          loadedGoals[0].id;

        setSelectedGoalId(initialGoalId);

        await loadSelectedGoal(initialGoalId);
      } else {
        setShowSetupForm(true);
      }
    } catch (error) {
      showError(
        getErrorMessage(
          error,
          "The application data could not be loaded."
        )
      );
    } finally {
      setIsLoading(false);
    }
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
    loadApplication();
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
                        "skipped" && (
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