import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY_NUMBERS = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const createAvailabilityEditor = (savedAvailability = []) => {
  const savedByDay = new Map(
    savedAvailability.map((entry) => [
      entry.day_of_week,
      Number(entry.available_minutes),
    ])
  );

  return WEEKDAYS.map((day) => ({
    day_of_week: day,
    enabled: savedByDay.has(day),
    available_minutes: savedByDay.get(day) || 60,
  }));
};

const getSelectedAvailability = (availability) =>
  availability
    .filter((day) => day.enabled)
    .map((day) => ({
      day_of_week: day.day_of_week,
      available_minutes: Number(day.available_minutes),
    }));

const serialiseAvailability = (availability) =>
  JSON.stringify(
    getSelectedAvailability(availability).map((entry) => [
      entry.day_of_week,
      entry.available_minutes,
    ])
  );

const normaliseDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
};

const calculateAvailableCapacity = (
  startDate,
  targetDate,
  availability
) => {
  const availabilityByDay = new Map(
    availability.map((entry) => [
      DAY_NUMBERS[entry.day_of_week],
      Number(entry.available_minutes),
    ])
  );

  let totalCapacity = 0;

  for (
    let date = new Date(startDate);
    date <= targetDate;
    date.setDate(date.getDate() + 1)
  ) {
    totalCapacity +=
      availabilityByDay.get(date.getDay()) || 0;
  }

  return totalCapacity;
};

const formatMinutes = (minutes) => {
  const numericMinutes = Math.max(
    Math.round(Number(minutes) || 0),
    0
  );

  if (numericMinutes < 60) {
    return `${numericMinutes} min`;
  }

  const hours = Math.floor(numericMinutes / 60);
  const remainder = numericMinutes % 60;

  return remainder === 0
    ? `${hours} hr`
    : `${hours} hr ${remainder} min`;
};

const buildPreview = ({
  availability,
  targetDate,
  progressData,
}) => {
  const selectedAvailability =
    getSelectedAvailability(availability);

  if (selectedAvailability.length === 0) {
    return {
      valid: false,
      status: "at-risk",
      message:
        "Select at least one study day to calculate feasibility.",
      capacity: 0,
      difference: 0,
    };
  }

  const invalidEntry = selectedAvailability.find(
    (entry) =>
      !Number.isInteger(entry.available_minutes) ||
      entry.available_minutes <= 0
  );

  if (invalidEntry) {
    return {
      valid: false,
      status: "at-risk",
      message:
        "Available minutes must be positive whole numbers.",
      capacity: 0,
      difference: 0,
    };
  }

  const remainingMinutes = Number(
    progressData?.progress?.remainingMinutes
  );

  if (!Number.isFinite(remainingMinutes)) {
    return {
      valid: false,
      status: "on-track",
      message:
        "Progress data is still loading. The preview will update automatically.",
      capacity: 0,
      difference: 0,
    };
  }

  const today = normaliseDate(new Date());
  const deadline = normaliseDate(targetDate);

  if (!today || !deadline) {
    return {
      valid: false,
      status: "at-risk",
      message:
        "The goal contains an invalid target date.",
      capacity: 0,
      difference: 0,
    };
  }

  const deadlinePassed = deadline < today;
  const capacity = deadlinePassed
    ? 0
    : calculateAvailableCapacity(
        today,
        deadline,
        selectedAvailability
      );

  const difference = capacity - remainingMinutes;

  if (remainingMinutes === 0) {
    return {
      valid: true,
      status: "completed",
      message:
        "All planned learning minutes are already complete.",
      capacity,
      difference,
      remainingMinutes,
    };
  }

  if (deadlinePassed) {
    return {
      valid: true,
      status: "deadline-passed",
      message:
        "The deadline has passed, so unfinished work cannot be rebalanced.",
      capacity,
      difference,
      remainingMinutes,
    };
  }

  if (difference >= 0) {
    return {
      valid: true,
      status: "on-track",
      message:
        "The remaining work fits within this proposed availability.",
      capacity,
      difference,
      remainingMinutes,
    };
  }

  return {
    valid: true,
    status: "at-risk",
    message:
      "The proposed availability does not provide enough time before the deadline.",
    capacity,
    difference,
    remainingMinutes,
  };
};

function AvailabilityManager({
  goalId,
  targetDate,
  progressData,
  onPlannerChanged,
}) {
  const [availability, setAvailability] =
    useState(() => createAvailabilityEditor());

  const [savedSignature, setSavedSignature] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    const loadAvailability = async () => {
      setIsLoading(true);
      setMessage("");
      setMessageType("");

      try {
        const response = await api.get(
          `/api/goals/${goalId}/availability`
        );

        if (cancelled) {
          return;
        }

        const editor = createAvailabilityEditor(
          response.data
        );

        setAvailability(editor);
        setSavedSignature(
          serialiseAvailability(editor)
        );
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error.response?.data?.error ||
              "Availability could not be loaded."
          );
          setMessageType("error");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [goalId]);

  const preview = useMemo(
    () =>
      buildPreview({
        availability,
        targetDate,
        progressData,
      }),
    [availability, targetDate, progressData]
  );

  const hasUnsavedChanges =
    serialiseAvailability(availability) !==
    savedSignature;

  const updateAvailability = (
    dayIndex,
    field,
    value
  ) => {
    setAvailability((current) =>
      current.map((day, index) =>
        index === dayIndex
          ? {
              ...day,
              [field]: value,
            }
          : day
      )
    );
  };

  const validateAvailability = () => {
    const selected =
      getSelectedAvailability(availability);

    if (selected.length === 0) {
      return "Select at least one available study day.";
    }

    const invalid = selected.find(
      (entry) =>
        !Number.isInteger(
          Number(entry.available_minutes)
        ) ||
        Number(entry.available_minutes) <= 0
    );

    if (invalid) {
      return "Available minutes must be positive whole numbers.";
    }

    return null;
  };

  const saveAvailability = async ({
    rebalance,
  }) => {
    const validationError =
      validateAvailability();

    if (validationError) {
      setMessage(validationError);
      setMessageType("error");
      return;
    }

    if (
      rebalance &&
      (!preview.valid ||
        preview.status === "at-risk" ||
        preview.status === "deadline-passed" ||
        preview.status === "completed")
    ) {
      setMessage(
        "Rebalancing is only available when unfinished work fits before the deadline."
      );
      setMessageType("error");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setMessageType("");

    try {
      const selectedAvailability =
        getSelectedAvailability(availability);

      await api.put(
        `/api/goals/${goalId}/availability`,
        {
          availability: selectedAvailability,
        }
      );

      setSavedSignature(
        serialiseAvailability(availability)
      );

      if (rebalance) {
        const rebalanceResponse =
          await api.post(
            `/api/goals/${goalId}/generate-tasks`
          );

        setMessage(
          `Availability saved and schedule rebalanced. ${rebalanceResponse.data.message}`
        );
      } else {
        setMessage(
          "Availability saved. Goal feasibility has been recalculated."
        );
      }

      setMessageType("success");

      if (onPlannerChanged) {
        await onPlannerChanged();
      }
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          "Availability could not be updated."
      );
      setMessageType("error");

      if (onPlannerChanged) {
        await onPlannerChanged();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const statusLabel = {
    completed: "Completed",
    "on-track": "On track",
    "at-risk": "At risk",
    "deadline-passed": "Deadline passed",
  }[preview.status];

  if (isLoading) {
    return (
      <section className="card">
        <h2>Adaptive Availability</h2>
        <p>Loading weekly availability...</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>Adaptive Availability</h2>
          <p>
            Change your weekly study capacity and
            preview the effect before rebuilding
            unfinished tasks.
          </p>
        </div>

        {hasUnsavedChanges && (
          <span className="status">
            Unsaved changes
          </span>
        )}
      </div>

      {message && (
        <p
          className={`message ${messageType}`}
          role={
            messageType === "error"
              ? "alert"
              : "status"
          }
        >
          {message}
        </p>
      )}

      <div className="availability-grid">
        {availability.map(
          (day, dayIndex) => (
            <div
              className={`availability-row ${
                day.enabled ? "selected" : ""
              }`}
              key={day.day_of_week}
            >
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(event) =>
                    updateAvailability(
                      dayIndex,
                      "enabled",
                      event.target.checked
                    )
                  }
                  disabled={isSaving}
                />

                <span>{day.day_of_week}</span>
              </label>

              <label>
                Minutes
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={day.available_minutes}
                  onChange={(event) =>
                    updateAvailability(
                      dayIndex,
                      "available_minutes",
                      event.target.value
                    )
                  }
                  disabled={
                    !day.enabled || isSaving
                  }
                />
              </label>
            </div>
          )
        )}
      </div>

      <div
        className={`feasibility-message feasibility-message-${preview.status}`}
        aria-live="polite"
      >
        <div className="section-header">
          <div>
            <strong>
              Live feasibility preview:{" "}
              {statusLabel}
            </strong>
            <p>{preview.message}</p>
          </div>
        </div>

        {preview.valid && (
          <div className="progress-stat-grid">
            <article className="progress-stat-card">
              <span>Remaining work</span>
              <strong>
                {formatMinutes(
                  preview.remainingMinutes
                )}
              </strong>
            </article>

            <article className="progress-stat-card">
              <span>Proposed capacity</span>
              <strong>
                {formatMinutes(
                  preview.capacity
                )}
              </strong>
            </article>

            <article className="progress-stat-card">
              <span>
                {preview.difference >= 0
                  ? "Capacity surplus"
                  : "Capacity shortfall"}
              </span>
              <strong>
                {formatMinutes(
                  Math.abs(
                    preview.difference
                  )
                )}
              </strong>
            </article>
          </div>
        )}
      </div>

      <div className="task-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            saveAvailability({
              rebalance: false,
            })
          }
          disabled={
            isSaving || !hasUnsavedChanges
          }
        >
          {isSaving
            ? "Saving..."
            : "Save Availability"}
        </button>

        <button
          type="button"
          className="primary-action"
          onClick={() =>
            saveAvailability({
              rebalance: true,
            })
          }
          disabled={
            isSaving ||
            !preview.valid ||
            preview.status !== "on-track"
          }
        >
          {isSaving
            ? "Updating..."
            : "Save & Rebalance Schedule"}
        </button>
      </div>
    </section>
  );
}

export default AvailabilityManager;
