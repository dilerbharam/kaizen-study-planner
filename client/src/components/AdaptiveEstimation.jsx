import {
  useEffect,
  useState,
} from "react";
import api from "../services/api";

function formatMinutes(minutes) {
  const value =
    Math.abs(
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

function formatMultiplier(value) {
  return `${Number(value).toFixed(2)}×`;
}

function AdaptiveEstimation({
  goalId,
  tasks,
  onPlannerChanged,
}) {
  const [preview, setPreview] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [applying, setApplying] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const loadPreview = async () => {
    setLoading(true);
    setError("");

    try {
      const response =
        await api.get(
          `/api/goals/${goalId}/adaptive-estimate`
        );

      setPreview(
        response.data.recommendation
      );
    } catch (requestError) {
      setPreview(null);
      setError(
        requestError.response?.data
          ?.error ||
          "Adaptive estimation could not be calculated."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await api.get(
            `/api/goals/${goalId}/adaptive-estimate`
          );

        if (!cancelled) {
          setPreview(
            response.data
              .recommendation
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setPreview(null);
          setError(
            requestError.response?.data
              ?.error ||
              "Adaptive estimation could not be calculated."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [goalId, tasks]);

  const applyRecommendation =
    async () => {
      setApplying(true);
      setMessage("");
      setError("");

      try {
        const response =
          await api.post(
            `/api/goals/${goalId}/adaptive-estimate/apply`
          );

        setMessage(
          response.data.message
        );

        if (onPlannerChanged) {
          await onPlannerChanged();
        }

        await loadPreview();
      } catch (requestError) {
        setError(
          requestError.response?.data
            ?.error ||
            "The adaptive estimate could not be applied."
        );
      } finally {
        setApplying(false);
      }
    };

  if (loading) {
    return (
      <section className="card">
        <h2>Adaptive Estimation</h2>
        <p>
          Reviewing recent completion
          evidence...
        </p>
      </section>
    );
  }

  if (error && !preview) {
    return (
      <section className="card">
        <h2>Adaptive Estimation</h2>
        <p
          className="message error"
          role="alert"
        >
          {error}
        </p>
      </section>
    );
  }

  if (!preview) {
    return null;
  }

  const change =
    preview.differenceMinutes;

  return (
    <section className="card adaptive-estimation-card">
      <div className="section-header">
        <div>
          <h2>Adaptive Estimation</h2>
          <p>
            Use new observed study-time
            evidence to review estimates
            for unfinished work.
          </p>
        </div>

        <span className="status">
          {preview.confidence} confidence
        </span>
      </div>

      {message && (
        <p
          className="message success"
          role="status"
        >
          {message}
        </p>
      )}

      {error && (
        <p
          className="message error"
          role="alert"
        >
          {error}
        </p>
      )}

      <div
        className={`adaptive-recommendation adaptive-recommendation-${preview.status}`}
      >
        <strong>{preview.title}</strong>
        <p>{preview.message}</p>
      </div>

      <div className="adaptive-metrics">
        <article>
          <span>New feedback</span>
          <strong>
            {preview.feedbackCount}
          </strong>
        </article>

        <article>
          <span>
            Observed / estimated
          </span>
          <strong>
            {preview.observedMedianRatio ===
            null
              ? "—"
              : formatMultiplier(
                  preview.observedMedianRatio
                )}
          </strong>
        </article>

        <article>
          <span>
            Suggested adjustment
          </span>
          <strong>
            {formatMultiplier(
              preview
                .recommendedAdjustmentMultiplier
            )}
          </strong>
        </article>

        <article>
          <span>
            Current calibration
          </span>
          <strong>
            {formatMultiplier(
              preview.currentMultiplier
            )}
          </strong>
        </article>
      </div>

      <div className="adaptive-comparison">
        <div>
          <span>
            Current ordinary remaining
          </span>
          <strong>
            {formatMinutes(
              preview
                .baselineRemainingMinutes
            )}
          </strong>
        </div>

        <div>
          <span>
            Suggested ordinary remaining
          </span>
          <strong>
            {formatMinutes(
              preview
                .adjustedRemainingMinutes
            )}
          </strong>
        </div>

        <div>
          <span>Estimated change</span>
          <strong>
            {change === 0
              ? "No change"
              : `${
                  change > 0
                    ? "+"
                    : "−"
                }${formatMinutes(
                  change
                )}`}
          </strong>
        </div>

        <div>
          <span>
            Capacity before deadline
          </span>
          <strong>
            {formatMinutes(
              preview
                .netAvailableMinutes
            )}
          </strong>
        </div>
      </div>

      {preview.affectedTopics.length >
        0 && (
        <div className="adaptive-topic-preview">
          <h3>
            Affected unfinished topics
          </h3>

          {preview.affectedTopics.map(
            (topic) => (
              <div
                key={topic.id}
                className="adaptive-topic-row"
              >
                <strong>
                  {topic.title}
                </strong>

                <span>
                  {formatMinutes(
                    topic
                      .baseline_remaining_minutes
                  )}{" "}
                  →{" "}
                  {formatMinutes(
                    topic
                      .adjusted_remaining_minutes
                  )}
                </span>
              </div>
            )
          )}
        </div>
      )}

      <div className="adaptive-approval">
        <div>
          <strong>
            Human approval required
          </strong>
          <p>
            The planner will not alter
            estimates automatically.
            Applying this suggestion
            updates unfinished ordinary
            work and rebalances it around
            preserved history and
            replacement tasks.
          </p>
        </div>

        <button
          type="button"
          onClick={
            applyRecommendation
          }
          disabled={
            applying ||
            !preview.canApply
          }
        >
          {applying
            ? "Applying..."
            : "Apply Suggestion & Rebalance"}
        </button>
      </div>
    </section>
  );
}

export default AdaptiveEstimation;
