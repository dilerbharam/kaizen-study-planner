import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [goalDetails, setGoalDetails] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [message, setMessage] = useState("");

  const goalId = 1;

  const fetchGoalDetails = async () => {
    const response = await axios.get(`http://localhost:5000/api/goals/${goalId}/details`);
    setGoalDetails(response.data);
  };

  const fetchTasks = async () => {
    const response = await axios.get(`http://localhost:5000/api/goals/${goalId}/tasks`);
    setTasks(response.data);
  };

  const generateTasks = async () => {
    const response = await axios.post(`http://localhost:5000/api/goals/${goalId}/generate-tasks`);
    setMessage(response.data.message);
    fetchTasks();
  };

  const updateTaskStatus = async (taskId, status) => {
    await axios.patch(`http://localhost:5000/api/tasks/${taskId}/status`, { status });
    fetchTasks();
  };

  const rescheduleTask = async (taskId) => {
    const response = await axios.post(`http://localhost:5000/api/tasks/${taskId}/reschedule`);
    setMessage(response.data.message);
    fetchTasks();
  };

  useEffect(() => {
    fetchGoalDetails();
    fetchTasks();
  }, []);

  return (
    <div className="app-container">
      <h1>Kaizen Study Planner</h1>
      <p className="subtitle">Adaptive micro-task planner for structured learning</p>

      {goalDetails && (
        <section className="card">
          <h2>{goalDetails.goal.title}</h2>
          <p>
            <strong>Target date:</strong>{" "}
            {new Date(goalDetails.goal.target_date).toLocaleDateString()}
          </p>

          <h3>Milestones</h3>
          <ul>
            {goalDetails.milestones.map((milestone) => (
              <li key={milestone.id}>{milestone.title}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <div className="section-header">
          <h2>Generated Daily Tasks</h2>
          <button onClick={generateTasks}>Regenerate Tasks</button>
        </div>

        {message && <p className="message">{message}</p>}

        {tasks.length === 0 ? (
          <p>No tasks generated yet.</p>
        ) : (
          <div className="task-list">
            {tasks.map((task) => (
              <div className={`task-card ${task.status}`} key={task.id}>
                <div>
                  <h3>{task.task_text}</h3>
                  <p>
                    {new Date(task.scheduled_date).toLocaleDateString()} ·{" "}
                    {task.estimated_minutes} minutes
                  </p>
                  <span className="status">{task.status}</span>
                </div>

                <div className="task-actions">
                  <button onClick={() => updateTaskStatus(task.id, "completed")}>
                    Complete
                  </button>
                  <button onClick={() => updateTaskStatus(task.id, "skipped")}>
                    Skip
                  </button>
                  {task.status === "skipped" && (
                    <button onClick={() => rescheduleTask(task.id)}>
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