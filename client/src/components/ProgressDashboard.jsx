function formatMinutes(minutes) {
  const numericMinutes = Number(minutes);

  if (numericMinutes < 60) {
    return `${numericMinutes} min`;
  }

  const hours = Math.floor(numericMinutes / 60);
  const remainingMinutes = numericMinutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

function ProgressDashboard({
  progressData,
  loading,
  error,
}) {
  if (loading) {
    return (
      <section className="progress-dashboard">
        <h2>Goal Progress</h2>
        <p>Calculating progress and feasibility...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="progress-dashboard">
        <h2>Goal Progress</h2>

        <div className="progress-error">
          {error}
        </div>
      </section>
    );
  }

  if (!progressData) {
    return null;
  }

  const { goal, progress } = progressData;

  const statusLabel = {
    completed: "Completed",
    "on-track": "On track",
    "at-risk": "At risk",
    "deadline-passed": "Deadline passed",
  }[progress.feasibilityStatus];

  return (
    <section className="progress-dashboard">
      <div className="progress-heading">
        <div>
          <h2>Goal Progress</h2>
          <p>{goal.title}</p>
        </div>

        <span
          className={`feasibility-badge feasibility-${progress.feasibilityStatus}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="progress-bar-header">
        <span>Completion</span>

        <strong>
          {progress.completionPercentage}%
        </strong>
      </div>

      <div
        className="progress-bar-track"
        role="progressbar"
        aria-label="Goal completion"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={
          progress.completionPercentage
        }
      >
        <div
          className="progress-bar-fill"
          style={{
            width: `${progress.completionPercentage}%`,
          }}
        />
      </div>

      <div className="progress-stat-grid">
        <article className="progress-stat-card">
          <span>Total planned</span>
          <strong>
            {formatMinutes(
              progress.totalPlannedMinutes
            )}
          </strong>
        </article>

        <article className="progress-stat-card">
          <span>Completed</span>
          <strong>
            {formatMinutes(
              progress.completedMinutes
            )}
          </strong>
        </article>

        <article className="progress-stat-card">
          <span>Remaining</span>
          <strong>
            {formatMinutes(
              progress.remainingMinutes
            )}
          </strong>
        </article>

        <article className="progress-stat-card">
          <span>Available capacity</span>
          <strong>
            {formatMinutes(
              progress.availableMinutesBeforeDeadline
            )}
          </strong>
        </article>
      </div>

      <div className="task-count-grid">
        <div>
          <strong>
            {progress.taskCounts.completed}
          </strong>
          <span>Completed tasks</span>
        </div>

        <div>
          <strong>
            {progress.taskCounts.pending}
          </strong>
          <span>Pending tasks</span>
        </div>

        <div>
          <strong>
            {progress.taskCounts.skipped}
          </strong>
          <span>Skipped tasks</span>
        </div>
      </div>

      <div
        className={`feasibility-message feasibility-message-${progress.feasibilityStatus}`}
      >
        <strong>{statusLabel}</strong>
        <p>{progress.feasibilityMessage}</p>

        {progress.feasibilityStatus ===
          "on-track" && (
          <p>
            Capacity surplus:{" "}
            {formatMinutes(
              progress.capacityDifference
            )}
          </p>
        )}

        {progress.feasibilityStatus ===
          "at-risk" && (
          <p>
            Capacity shortfall:{" "}
            {formatMinutes(
              Math.abs(
                progress.capacityDifference
              )
            )}
          </p>
        )}
      </div>
    </section>
  );
}

export default ProgressDashboard;