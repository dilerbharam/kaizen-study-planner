import {
  useEffect,
  useState,
} from "react";
import api from "../services/api";

function formatMinutes(minutes) {
  const value = Math.abs(
    Number(minutes) || 0
  );

  if (value < 60) {
    return `${value} min`;
  }

  const hours =
    Math.floor(value / 60);

  const remainder =
    value % 60;

  return remainder === 0
    ? `${hours} hr`
    : `${hours} hr ${remainder} min`;
}

function LearningAnalytics({
  goalId,
  tasks,
}) {
  const [analytics, setAnalytics] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    const loadAnalytics = async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await api.get(
            `/api/goals/${goalId}/analytics`
          );

        if (!cancelled) {
          setAnalytics(
            response.data.analytics
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setAnalytics(null);
          setError(
            requestError.response?.data
              ?.error ||
              "Learning analytics could not be calculated."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [goalId, tasks]);

  if (loading) {
    return (
      <section className="card">
        <h2>Learning Analytics</h2>
        <p>
          Analysing planned and observed
          study effort...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="card">
        <h2>Learning Analytics</h2>
        <p
          className="message error"
          role="alert"
        >
          {error}
        </p>
      </section>
    );
  }

  if (!analytics) {
    return null;
  }

  const difference =
    analytics.estimationDifference;

  const differenceLabel =
    difference > 0
      ? `${formatMinutes(
          difference
        )} over plan`
      : difference < 0
        ? `${formatMinutes(
            difference
          )} under plan`
        : "On estimate";

  return (
    <section className="card analytics-dashboard">
      <div className="section-header">
        <div>
          <h2>Learning Analytics</h2>
          <p>
            Compare planned effort with
            observed study behaviour.
          </p>
        </div>

        <span className="status">
          {
            analytics.counts
              .feedbackTasks
          }{" "}
          feedback task
          {analytics.counts
            .feedbackTasks === 1
            ? ""
            : "s"}
        </span>
      </div>

      <div className="analytics-grid">
        <article className="analytics-stat">
          <span>Completion rate</span>
          <strong>
            {analytics.completionRate}%
          </strong>
          <small>
            Skipped history excluded
          </small>
        </article>

        <article className="analytics-stat">
          <span>Actual study time</span>
          <strong>
            {formatMinutes(
              analytics.actualStudyMinutes
            )}
          </strong>
          <small>
            From completed feedback
          </small>
        </article>

        <article className="analytics-stat">
          <span>Estimation accuracy</span>
          <strong>
            {analytics.estimationAccuracy ===
            null
              ? "—"
              : `${analytics.estimationAccuracy}%`}
          </strong>
          <small>
            Mean task-level accuracy
          </small>
        </article>

        <article className="analytics-stat">
          <span>Average difficulty</span>
          <strong>
            {analytics.averageDifficulty ===
            null
              ? "—"
              : `${analytics.averageDifficulty}/5`}
          </strong>
          <small>
            Learner-rated
          </small>
        </article>
      </div>

      <div className="analytics-comparison">
        <div>
          <span>
            Planned time for feedback tasks
          </span>
          <strong>
            {formatMinutes(
              analytics.feedbackPlannedMinutes
            )}
          </strong>
        </div>

        <div>
          <span>Observed actual time</span>
          <strong>
            {formatMinutes(
              analytics.actualStudyMinutes
            )}
          </strong>
        </div>

        <div>
          <span>Difference</span>
          <strong>{differenceLabel}</strong>
        </div>
      </div>

      <div className="analytics-counts">
        <span>
          <strong>
            {analytics.counts.completed}
          </strong>{" "}
          completed
        </span>

        <span>
          <strong>
            {analytics.counts.pending}
          </strong>{" "}
          pending
        </span>

        <span>
          <strong>
            {analytics.counts.skipped}
          </strong>{" "}
          skipped
        </span>

        <span>
          <strong>
            {
              analytics.counts
                .rescheduledReplacements
            }
          </strong>{" "}
          replacement
          {analytics.counts
            .rescheduledReplacements === 1
            ? ""
            : "s"}
        </span>
      </div>

      <div
        className={`kaizen-insight kaizen-insight-${analytics.insight.status}`}
      >
        <span>Kaizen insight</span>
        <strong>
          {analytics.insight.title}
        </strong>
        <p>
          {analytics.insight.message}
        </p>
      </div>

      {analytics.topicAnalytics.length >
        0 && (
        <div className="topic-analytics">
          <h3>
            Feedback by topic
          </h3>

          <div className="topic-analytics-list">
            {analytics.topicAnalytics.map(
              (topic) => (
                <article
                  key={topic.topic}
                  className="topic-analytics-row"
                >
                  <div>
                    <strong>
                      {topic.topic}
                    </strong>
                    <span>
                      {
                        topic.completedWithFeedback
                      }{" "}
                      completed with feedback
                    </span>
                  </div>

                  <div>
                    <span>
                      Planned{" "}
                      {formatMinutes(
                        topic.plannedMinutes
                      )}
                    </span>

                    <span>
                      Actual{" "}
                      {formatMinutes(
                        topic.actualMinutes
                      )}
                    </span>

                    <span>
                      Difficulty{" "}
                      {
                        topic.averageDifficulty
                      }
                      /5
                    </span>
                  </div>
                </article>
              )
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default LearningAnalytics;
