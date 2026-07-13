import { useState } from "react";
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

const createEmptyTopic = () => ({
  title: "",
  estimatedMinutes: 30,
});

const createEmptyMilestone = () => ({
  title: "",
  topics: [createEmptyTopic()],
});

function GoalSetupForm({ userId, onGoalCreated, onCancel }) {
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");

  const [milestones, setMilestones] = useState([
    createEmptyMilestone(),
  ]);

  const [availability, setAvailability] = useState(
    WEEKDAYS.map((day) => ({
      day_of_week: day,
      enabled: false,
      available_minutes: 60,
    }))
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const updateMilestoneTitle = (milestoneIndex, value) => {
    setMilestones((current) =>
      current.map((milestone, index) =>
        index === milestoneIndex
          ? {
              ...milestone,
              title: value,
            }
          : milestone
      )
    );
  };

  const addMilestone = () => {
    setMilestones((current) => [
      ...current,
      createEmptyMilestone(),
    ]);
  };

  const removeMilestone = (milestoneIndex) => {
    setMilestones((current) =>
      current.filter((_, index) => index !== milestoneIndex)
    );
  };

  const addTopic = (milestoneIndex) => {
    setMilestones((current) =>
      current.map((milestone, index) =>
        index === milestoneIndex
          ? {
              ...milestone,
              topics: [
                ...milestone.topics,
                createEmptyTopic(),
              ],
            }
          : milestone
      )
    );
  };

  const updateTopic = (
    milestoneIndex,
    topicIndex,
    field,
    value
  ) => {
    setMilestones((current) =>
      current.map((milestone, currentMilestoneIndex) => {
        if (currentMilestoneIndex !== milestoneIndex) {
          return milestone;
        }

        return {
          ...milestone,
          topics: milestone.topics.map(
            (topic, currentTopicIndex) =>
              currentTopicIndex === topicIndex
                ? {
                    ...topic,
                    [field]: value,
                  }
                : topic
          ),
        };
      })
    );
  };

  const removeTopic = (milestoneIndex, topicIndex) => {
    setMilestones((current) =>
      current.map((milestone, currentMilestoneIndex) => {
        if (currentMilestoneIndex !== milestoneIndex) {
          return milestone;
        }

        return {
          ...milestone,
          topics: milestone.topics.filter(
            (_, currentTopicIndex) =>
              currentTopicIndex !== topicIndex
          ),
        };
      })
    );
  };

  const updateAvailability = (dayIndex, field, value) => {
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

  const validateForm = () => {
    if (!title.trim()) {
      return "A goal title is required.";
    }

    if (!targetDate) {
      return "A target date is required.";
    }

    const parsedTargetDate = new Date(`${targetDate}T00:00:00`);
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    if (parsedTargetDate < today) {
      return "The target date must be today or a future date.";
    }

    if (milestones.length === 0) {
      return "At least one milestone is required.";
    }

    for (const milestone of milestones) {
      if (!milestone.title.trim()) {
        return "Every milestone must have a title.";
      }

      if (milestone.topics.length === 0) {
        return `Milestone "${milestone.title}" requires at least one topic.`;
      }

      for (const topic of milestone.topics) {
        if (!topic.title.trim()) {
          return "Every topic must have a title.";
        }

        const minutes = Number(topic.estimatedMinutes);

        if (!Number.isInteger(minutes) || minutes <= 0) {
          return "Every topic duration must be a positive whole number.";
        }
      }
    }

    const selectedAvailability = availability.filter(
      (day) => day.enabled
    );

    if (selectedAvailability.length === 0) {
      return "Select at least one available study day.";
    }

    const invalidAvailability = selectedAvailability.find(
      (day) =>
        !Number.isInteger(Number(day.available_minutes)) ||
        Number(day.available_minutes) <= 0
    );

    if (invalidAvailability) {
      return "Available minutes must be positive whole numbers.";
    }

    return null;
  };

  const submitForm = async (event) => {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    const validationError = validateForm();

    if (validationError) {
      setMessage(validationError);
      setMessageType("error");
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedAvailability = availability
        .filter((day) => day.enabled)
        .map((day) => ({
          day_of_week: day.day_of_week,
          available_minutes: Number(
            day.available_minutes
          ),
        }));

      await api.put(
        `/api/users/${userId}/availability`,
        {
          availability: selectedAvailability,
        }
      );

      const goalResponse = await api.post("/api/goals", {
        userId,
        title: title.trim(),
        targetDate,
      });

      const createdGoal = goalResponse.data.goal;

      for (
        let milestoneIndex = 0;
        milestoneIndex < milestones.length;
        milestoneIndex += 1
      ) {
        const milestone = milestones[milestoneIndex];

        const milestoneResponse = await api.post(
          `/api/goals/${createdGoal.id}/milestones`,
          {
            title: milestone.title.trim(),
            sequenceOrder: milestoneIndex + 1,
          }
        );

        const createdMilestone =
          milestoneResponse.data.milestone;

        for (
          let topicIndex = 0;
          topicIndex < milestone.topics.length;
          topicIndex += 1
        ) {
          const topic = milestone.topics[topicIndex];

          await api.post(
            `/api/milestones/${createdMilestone.id}/topics`,
            {
              title: topic.title.trim(),
              estimatedMinutes: Number(
                topic.estimatedMinutes
              ),
              sequenceOrder: topicIndex + 1,
            }
          );
        }
      }

      setMessage("Learning plan created successfully.");
      setMessageType("success");

      await onGoalCreated(createdGoal.id);
    } catch (error) {
      setMessage(
        error.response?.data?.error ||
          "The learning plan could not be created."
      );
      setMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="card setup-card">
      <div className="section-header">
        <div>
          <h2>Create a Learning Plan</h2>
          <p>
            Define the goal, learning structure and weekly
            availability.
          </p>
        </div>

        {onCancel && (
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>

      {message && (
        <p className={`message ${messageType}`}>
          {message}
        </p>
      )}

      <form onSubmit={submitForm}>
        <div className="form-grid">
          <label>
            Goal title
            <input
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="For example: Learn Java programming"
              disabled={isSubmitting}
            />
          </label>

          <label>
            Target date
            <input
              type="date"
              value={targetDate}
              onChange={(event) =>
                setTargetDate(event.target.value)
              }
              disabled={isSubmitting}
            />
          </label>
        </div>

        <div className="form-section">
          <div className="section-header">
            <div>
              <h3>Milestones and Topics</h3>
              <p>
                Break the goal into ordered stages and
                estimated learning topics.
              </p>
            </div>

            <button
              type="button"
              onClick={addMilestone}
              disabled={isSubmitting}
            >
              Add Milestone
            </button>
          </div>

          {milestones.map(
            (milestone, milestoneIndex) => (
              <div
                className="milestone-editor"
                key={`milestone-${milestoneIndex}`}
              >
                <div className="editor-header">
                  <h4>
                    Milestone {milestoneIndex + 1}
                  </h4>

                  {milestones.length > 1 && (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() =>
                        removeMilestone(milestoneIndex)
                      }
                      disabled={isSubmitting}
                    >
                      Remove Milestone
                    </button>
                  )}
                </div>

                <label>
                  Milestone title
                  <input
                    type="text"
                    value={milestone.title}
                    onChange={(event) =>
                      updateMilestoneTitle(
                        milestoneIndex,
                        event.target.value
                      )
                    }
                    placeholder="For example: Programming fundamentals"
                    disabled={isSubmitting}
                  />
                </label>

                <div className="topic-editor-list">
                  {milestone.topics.map(
                    (topic, topicIndex) => (
                      <div
                        className="topic-editor"
                        key={`topic-${milestoneIndex}-${topicIndex}`}
                      >
                        <label>
                          Topic {topicIndex + 1}
                          <input
                            type="text"
                            value={topic.title}
                            onChange={(event) =>
                              updateTopic(
                                milestoneIndex,
                                topicIndex,
                                "title",
                                event.target.value
                              )
                            }
                            placeholder="For example: Variables and data types"
                            disabled={isSubmitting}
                          />
                        </label>

                        <label>
                          Estimated minutes
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={
                              topic.estimatedMinutes
                            }
                            onChange={(event) =>
                              updateTopic(
                                milestoneIndex,
                                topicIndex,
                                "estimatedMinutes",
                                event.target.value
                              )
                            }
                            disabled={isSubmitting}
                          />
                        </label>

                        {milestone.topics.length > 1 && (
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() =>
                              removeTopic(
                                milestoneIndex,
                                topicIndex
                              )
                            }
                            disabled={isSubmitting}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    addTopic(milestoneIndex)
                  }
                  disabled={isSubmitting}
                >
                  Add Topic
                </button>
              </div>
            )
          )}
        </div>

        <div className="form-section">
          <h3>Weekly Availability</h3>

          <p>
            Select the study days and maximum number of minutes
            available on each day.
          </p>

          <div className="availability-grid">
            {availability.map((day, dayIndex) => (
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
                    disabled={isSubmitting}
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
                      !day.enabled || isSubmitting
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="primary-action"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Creating Learning Plan..."
            : "Create Learning Plan"}
        </button>
      </form>
    </section>
  );
}

export default GoalSetupForm;