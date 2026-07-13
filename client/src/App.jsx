import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [goalDetails, setGoalDetails] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const goalId = 1;
  const API_BASE_URL = "http://localhost:5000";

  const showSuccessMessage = (text) => {
    setMessage(text);
    setMessageType("success");
  };

  const showErrorMessage = (text) => {
    setMessage(text);
    setMessageType("error");
  };

  const getErrorMessage = (error, fallbackMessage) => {
    return error.response?.data?.error || fallbackMessage;
  };

  const fetchGoalDetails = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/goals/${goalId}/details`
      );

      setGoalDetails(response.data);
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error, "Goal details could not be loaded.")
      );
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/goals/${goalId}/tasks`
      );

      setTasks(response.data);
    } catch (error) {
      showErrorMessage(
        getErrorMessage(error, "Tasks could not be loaded.")
      );
    }
  };

  const loadApplicationData = async () => {
    setIsLoading(true);

    try {
      await Promise.all([fetchGoalDetails(), fetchTasks()]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateTasks = async () => {
    setIsGenerating(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/goals/${goalId}/generate-tasks`
      );

      showSuccessMessage(response.data.message);
      await fetchTasks();
    } catch (error) {
      showErrorMessage(
        getErrorMessage(
          error,
          "Tasks could not be generated. Please try again."
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    setMessage("");
    setMessageType("");

    try {
      const response = await axios.patch(
        `${API_BASE_URL}/api/tasks/${taskId}/status`,
        { status }
      );

      showSuccessMessage(response.data.message);
      await fetchTasks();
    } catch (error) {
      showErrorMessage(
        getErrorMessage(
          error,
          "The task status could not be updated."
        )
      );
    }
  };

  const rescheduleTask = async (taskId) => {
    setMessage("");
    setMessageType("");

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/tasks/${taskId}/reschedule`
      );

      showSuccessMessage(response.data.message);
      await fetchTasks();
    } catch (error) {
      showErrorMessage(
        getErrorMessage(
          error,
          "The task could not be rescheduled."
        )
      );
    }
  };

  useEffect(() => {
    loadApplicationData();
  }, []);

  if (isLoading) {
    return (
      <div className="app-container">
        <h1>Kaizen Study Planner</h1>
        <p className="subtitle">
          Adaptive micro-task planner for structured learning
        </p>
        <p>Loading planner data...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      <h1>Kaizen Study Planner</h1>

      <p className="subtitle">
        Adaptive micro-task planner for structured learning
      </p>

      {message && (
        <p className={`message ${messageType}`}>
          {message}
        </p>
      )}

      {goalDetails ? (
        <section className="card">
          <h2>{goalDetails.goal.title}</h2>

          <p>
            <strong>Target date:</strong>{" "}
            {new Date(
              goalDetails.goal.target_date
            ).toLocaleDateString()}
          </p>

          <p>
            <strong>Status:</strong>{" "}
            {goalDetails.goal.status}
          </p>

          <h3>Milestones</h3>

          {goalDetails.milestones.length === 0 ? (
            <p>No milestones have been added.</p>
          ) : (
            <ul>
              {goalDetails.milestones.map((milestone) => (
                <li key={milestone.id}>
                  {milestone.title}
                </li>
              ))}
            </ul>
          )}

          <h3>Topics</h3>

          {goalDetails.topics.length === 0 ? (
            <p>No topics have been added.</p>
          ) : (
            <ul>
              {goalDetails.topics.map((topic) => (
                <li key={topic.id}>
                  {topic.title} — {topic.estimated_minutes} minutes
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="card">
          <p>Goal details are unavailable.</p>
        </section>
      )}

      <section className="card">
        <div className="section-header">
          <h2>Generated Daily Tasks</h2>

          <button
            type="button"
            onClick={generateTasks}
            disabled={isGenerating}
          >
            {isGenerating
              ? "Generating..."
              : "Regenerate Tasks"}
          </button>
        </div>

        {tasks.length === 0 ? (
          <p>No tasks generated yet.</p>
        ) : (
          <div className="task-list">
            {tasks.map((task) => (
              <div
                className={`task-card ${task.status}`}
                key={task.id}
              >
                <div>
                  <h3>{task.task_text}</h3>

                  <p>
                    {new Date(
                      task.scheduled_date
                    ).toLocaleDateString()}{" "}
                    · {task.estimated_minutes} minutes
                  </p>

                  <span className="status">
                    {task.status}
                  </span>
                </div>

                <div className="task-actions">
                  <button
                    type="button"
                    onClick={() =>
                      updateTaskStatus(
                        task.id,
                        "completed"
                      )
                    }
                    disabled={task.status === "completed"}
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
                    disabled={task.status === "skipped"}
                  >
                    Skip
                  </button>

                  {task.status === "skipped" && (
                    <button
                      type="button"
                      onClick={() =>
                        rescheduleTask(task.id)
                      }
                    >
                      Reschedule
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default App;