import {
  useMemo,
  useState,
} from "react";
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

const LEVEL_OPTIONS = [
  {
    value: "beginner",
    label: "Beginner",
  },
  {
    value:
      "some-experience",
    label:
      "Some experience",
  },
  {
    value:
      "intermediate",
    label:
      "Intermediate",
  },
  {
    value: "advanced",
    label: "Advanced",
  },
];

const createEmptyTopic = () => ({
  title: "",
  estimatedMinutes: 30,
});

const createEmptyMilestone =
  () => ({
    title: "",
    rationale: "",
    topics: [
      createEmptyTopic(),
    ],
  });

function GoalSetupForm({
  onGoalCreated,
  onCancel,
}) {
  const [
    creationMode,
    setCreationMode,
  ] = useState("manual");

  const [title, setTitle] =
    useState("");

  const [
    goalDescription,
    setGoalDescription,
  ] = useState("");

  const [
    targetDate,
    setTargetDate,
  ] = useState("");

  const [
    currentLevel,
    setCurrentLevel,
  ] = useState("beginner");

  const [
    preferences,
    setPreferences,
  ] = useState("");

  const [
    milestones,
    setMilestones,
  ] = useState([
    createEmptyMilestone(),
  ]);

  const [
    availability,
    setAvailability,
  ] = useState(
    WEEKDAYS.map((day) => ({
      day_of_week: day,
      enabled: false,
      available_minutes: 60,
    }))
  );

  const [
    aiDraftMeta,
    setAiDraftMeta,
  ] = useState(null);

  const [
    aiDraftSignature,
    setAiDraftSignature,
  ] = useState("");

  const [
    isGenerating,
    setIsGenerating,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [message, setMessage] =
    useState("");

  const [
    messageType,
    setMessageType,
  ] = useState("");

  const selectedAvailability =
    useMemo(
      () =>
        availability
          .filter(
            (day) =>
              day.enabled
          )
          .map((day) => ({
            day_of_week:
              day.day_of_week,
            available_minutes:
              Number(
                day
                  .available_minutes
              ),
          })),
      [availability]
    );

  const aiContextSignature =
    useMemo(
      () =>
        JSON.stringify({
          goalDescription:
            goalDescription.trim(),
          targetDate,
          currentLevel,
          preferences:
            preferences.trim(),
          availability:
            selectedAvailability,
        }),
      [
        goalDescription,
        targetDate,
        currentLevel,
        preferences,
        selectedAvailability,
      ]
    );

  const aiDraftIsStale =
    Boolean(aiDraftMeta) &&
    aiDraftSignature !==
      aiContextSignature;

  const updateMilestoneTitle =
    (
      milestoneIndex,
      value
    ) => {
      setMilestones(
        (current) =>
          current.map(
            (
              milestone,
              index
            ) =>
              index ===
              milestoneIndex
                ? {
                    ...milestone,
                    title: value,
                  }
                : milestone
          )
      );
    };

  const addMilestone = () => {
    setMilestones(
      (current) => [
        ...current,
        createEmptyMilestone(),
      ]
    );
  };

  const removeMilestone =
    (milestoneIndex) => {
      setMilestones(
        (current) =>
          current.filter(
            (_, index) =>
              index !==
              milestoneIndex
          )
      );
    };

  const addTopic =
    (milestoneIndex) => {
      setMilestones(
        (current) =>
          current.map(
            (
              milestone,
              index
            ) =>
              index ===
              milestoneIndex
                ? {
                    ...milestone,
                    topics: [
                      ...milestone
                        .topics,
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
    setMilestones(
      (current) =>
        current.map(
          (
            milestone,
            currentMilestoneIndex
          ) => {
            if (
              currentMilestoneIndex !==
              milestoneIndex
            ) {
              return milestone;
            }

            return {
              ...milestone,
              topics:
                milestone.topics.map(
                  (
                    topic,
                    currentTopicIndex
                  ) =>
                    currentTopicIndex ===
                    topicIndex
                      ? {
                          ...topic,
                          [field]:
                            value,
                        }
                      : topic
                ),
            };
          }
        )
    );
  };

  const removeTopic = (
    milestoneIndex,
    topicIndex
  ) => {
    setMilestones(
      (current) =>
        current.map(
          (
            milestone,
            currentMilestoneIndex
          ) => {
            if (
              currentMilestoneIndex !==
              milestoneIndex
            ) {
              return milestone;
            }

            return {
              ...milestone,
              topics:
                milestone.topics.filter(
                  (
                    _,
                    currentTopicIndex
                  ) =>
                    currentTopicIndex !==
                    topicIndex
                ),
            };
          }
        )
    );
  };

  const updateAvailability =
    (
      dayIndex,
      field,
      value
    ) => {
      setAvailability(
        (current) =>
          current.map(
            (day, index) =>
              index === dayIndex
                ? {
                    ...day,
                    [field]:
                      value,
                  }
                : day
          )
      );
    };

  const validateContext =
    () => {
      if (!targetDate) {
        return "A target date is required.";
      }

      const parsedTargetDate =
        new Date(
          `${targetDate}T00:00:00`
        );

      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      if (
        parsedTargetDate <
        today
      ) {
        return "The target date must be today or a future date.";
      }

      if (
        selectedAvailability
          .length === 0
      ) {
        return "Select at least one available study day.";
      }

      const invalidAvailability =
        selectedAvailability.find(
          (day) =>
            !Number.isInteger(
              Number(
                day
                  .available_minutes
              )
            ) ||
            Number(
              day
                .available_minutes
            ) <= 0
        );

      if (
        invalidAvailability
      ) {
        return "Available minutes must be positive whole numbers.";
      }

      return null;
    };

  const validateForm = () => {
    const contextError =
      validateContext();

    if (contextError) {
      return contextError;
    }

    if (!title.trim()) {
      return "A goal title is required.";
    }

    if (
      creationMode ===
        "ai" &&
      !aiDraftMeta
    ) {
      return "Generate a KaizenAI draft before creating an AI-assisted plan.";
    }

    if (
      creationMode ===
        "ai" &&
      aiDraftIsStale
    ) {
      return "The goal context or availability changed after KaizenAI generated the draft. Regenerate it before approval.";
    }

    if (
      milestones.length === 0
    ) {
      return "At least one milestone is required.";
    }

    for (
      const milestone of
      milestones
    ) {
      if (
        !milestone.title.trim()
      ) {
        return "Every milestone must have a title.";
      }

      if (
        milestone.topics
          .length === 0
      ) {
        return `Milestone "${milestone.title}" requires at least one topic.`;
      }

      for (
        const topic of
        milestone.topics
      ) {
        if (
          !topic.title.trim()
        ) {
          return "Every topic must have a title.";
        }

        const minutes =
          Number(
            topic
              .estimatedMinutes
          );

        if (
          !Number.isInteger(
            minutes
          ) ||
          minutes <= 0
        ) {
          return "Every topic duration must be a positive whole number.";
        }
      }
    }

    return null;
  };

  const generateAiDraft =
    async () => {
      setMessage("");
      setMessageType("");

      if (
        goalDescription
          .trim()
          .length < 5
      ) {
        setMessage(
          "Describe what you want to learn before asking KaizenAI to create a plan."
        );
        setMessageType(
          "error"
        );
        return;
      }

      const contextError =
        validateContext();

      if (contextError) {
        setMessage(
          contextError
        );
        setMessageType(
          "error"
        );
        return;
      }

      setIsGenerating(true);

      try {
        const response =
          await api.post(
            "/api/ai/gemini-plan-draft",
            {
              goalDescription:
                goalDescription.trim(),
              targetDate,
              currentLevel,
              preferences:
                preferences.trim(),
              availability:
                selectedAvailability,
            }
          );

        const {
          draft,
          provider,
          model,
          thinkingLevel,
          planningBudgetMinutes,
          availableMinutes,
        } = response.data;

        setTitle(
          draft.title
        );

        setMilestones(
          draft.milestones.map(
            (milestone) => ({
              title:
                milestone.title,
              rationale:
                milestone.rationale ||
                "",
              topics:
                milestone.topics.map(
                  (topic) => ({
                    title:
                      topic.title,
                    estimatedMinutes:
                      topic
                        .estimatedMinutes,
                  })
                ),
            })
          )
        );

        setAiDraftMeta({
          provider,
          model,
          thinkingLevel,
          summary:
            draft.summary,
          assumptions:
            draft.assumptions ||
            [],
          totalEstimatedMinutes:
            draft
              .totalEstimatedMinutes,
          adjustedToCapacity:
            draft
              .adjustedToCapacity,
          planningBudgetMinutes,
          availableMinutes,
        });

        setAiDraftSignature(
          aiContextSignature
        );

        setMessage(
          "KaizenAI generated an editable draft. Review and change anything you disagree with before approval."
        );
        setMessageType(
          "success"
        );
      } catch (error) {
        setAiDraftMeta(null);
        setAiDraftSignature(
          ""
        );

        setMessage(
          error.response?.data
            ?.error ||
            "KaizenAI could not generate the draft. Try again later or use manual planning."
        );

        setMessageType(
          "error"
        );
      } finally {
        setIsGenerating(
          false
        );
      }
    };

  const submitForm =
    async (event) => {
      event.preventDefault();

      setMessage("");
      setMessageType("");

      const validationError =
        validateForm();

      if (validationError) {
        setMessage(
          validationError
        );
        setMessageType(
          "error"
        );
        return;
      }

      setIsSubmitting(true);

      try {
        const goalResponse =
          await api.post(
            "/api/goals",
            {
              title:
                title.trim(),
              targetDate,
              planSource:
                creationMode ===
                "ai"
                  ? "ai_assisted"
                  : "manual",
              aiProvider:
                creationMode ===
                  "ai"
                  ? aiDraftMeta
                      ?.provider
                  : null,
              aiModel:
                creationMode ===
                  "ai"
                  ? aiDraftMeta
                      ?.model
                  : null,
            }
          );

        const createdGoal =
          goalResponse.data
            .goal;

        await api.put(
          `/api/goals/${createdGoal.id}/availability`,
          {
            availability:
              selectedAvailability,
          }
        );

        for (
          let milestoneIndex = 0;
          milestoneIndex <
          milestones.length;
          milestoneIndex += 1
        ) {
          const milestone =
            milestones[
              milestoneIndex
            ];

          const milestoneResponse =
            await api.post(
              `/api/goals/${createdGoal.id}/milestones`,
              {
                title:
                  milestone
                    .title
                    .trim(),
                sequenceOrder:
                  milestoneIndex +
                  1,
              }
            );

          const createdMilestone =
            milestoneResponse
              .data.milestone;

          for (
            let topicIndex = 0;
            topicIndex <
            milestone.topics
              .length;
            topicIndex += 1
          ) {
            const topic =
              milestone.topics[
                topicIndex
              ];

            await api.post(
              `/api/milestones/${createdMilestone.id}/topics`,
              {
                title:
                  topic.title.trim(),
                estimatedMinutes:
                  Number(
                    topic
                      .estimatedMinutes
                  ),
                sequenceOrder:
                  topicIndex + 1,
              }
            );
          }
        }

        setMessage(
          creationMode ===
            "ai"
            ? "Reviewed KaizenAI learning plan created successfully."
            : "Learning plan created successfully."
        );

        setMessageType(
          "success"
        );

        await onGoalCreated(
          createdGoal.id
        );
      } catch (error) {
        setMessage(
          error.response?.data
            ?.error ||
            "The learning plan could not be created."
        );

        setMessageType(
          "error"
        );
      } finally {
        setIsSubmitting(
          false
        );
      }
    };

  const renderAvailability =
    () => (
      <div className="form-section">
        <h3>
          Weekly Availability
        </h3>

        <p>
          Select study days
          and maximum minutes.
          KaizenAI uses this
          context, while the
          deterministic planner
          remains responsible for
          feasibility.
        </p>

        <div className="availability-grid">
          {availability.map(
            (
              day,
              dayIndex
            ) => (
              <div
                className={`availability-row ${
                  day.enabled
                    ? "selected"
                    : ""
                }`}
                key={
                  day
                    .day_of_week
                }
              >
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={
                      day.enabled
                    }
                    onChange={(
                      event
                    ) =>
                      updateAvailability(
                        dayIndex,
                        "enabled",
                        event
                          .target
                          .checked
                      )
                    }
                    disabled={
                      isSubmitting ||
                      isGenerating
                    }
                  />

                  <span>
                    {
                      day
                        .day_of_week
                    }
                  </span>
                </label>

                <label>
                  Minutes

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      day
                        .available_minutes
                    }
                    onChange={(
                      event
                    ) =>
                      updateAvailability(
                        dayIndex,
                        "available_minutes",
                        event
                          .target
                          .value
                      )
                    }
                    disabled={
                      !day.enabled ||
                      isSubmitting ||
                      isGenerating
                    }
                  />
                </label>
              </div>
            )
          )}
        </div>
      </div>
    );

  const renderMilestones =
    () => (
      <div className="form-section">
        <div className="section-header">
          <div>
            <h3>
              Milestones and
              Topics
            </h3>

            <p>
              {creationMode ===
              "ai"
                ? "Review KaizenAI's suggestions carefully. Edit, add or remove content before approval."
                : "Break the goal into ordered stages and estimated learning topics."}
            </p>
          </div>

          <button
            type="button"
            onClick={
              addMilestone
            }
            disabled={
              isSubmitting ||
              isGenerating
            }
          >
            Add Milestone
          </button>
        </div>

        {milestones.map(
          (
            milestone,
            milestoneIndex
          ) => (
            <div
              className="milestone-editor"
              key={`milestone-${milestoneIndex}`}
            >
              <div className="editor-header">
                <h4>
                  Milestone{" "}
                  {milestoneIndex +
                    1}
                </h4>

                {milestones.length >
                  1 && (
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() =>
                      removeMilestone(
                        milestoneIndex
                      )
                    }
                    disabled={
                      isSubmitting ||
                      isGenerating
                    }
                  >
                    Remove
                    Milestone
                  </button>
                )}
              </div>

              <label>
                Milestone title

                <input
                  type="text"
                  value={
                    milestone.title
                  }
                  onChange={(
                    event
                  ) =>
                    updateMilestoneTitle(
                      milestoneIndex,
                      event.target
                        .value
                    )
                  }
                  placeholder="For example: Programming fundamentals"
                  disabled={
                    isSubmitting ||
                    isGenerating
                  }
                />
              </label>

              {creationMode ===
                "ai" &&
                milestone.rationale && (
                  <p className="ai-milestone-rationale">
                    KaizenAI
                    rationale:{" "}
                    {
                      milestone.rationale
                    }
                  </p>
                )}

              <div className="topic-editor-list">
                {milestone.topics.map(
                  (
                    topic,
                    topicIndex
                  ) => (
                    <div
                      className="topic-editor"
                      key={`topic-${milestoneIndex}-${topicIndex}`}
                    >
                      <label>
                        Topic{" "}
                        {topicIndex +
                          1}

                        <input
                          type="text"
                          value={
                            topic.title
                          }
                          onChange={(
                            event
                          ) =>
                            updateTopic(
                              milestoneIndex,
                              topicIndex,
                              "title",
                              event
                                .target
                                .value
                            )
                          }
                          disabled={
                            isSubmitting ||
                            isGenerating
                          }
                        />
                      </label>

                      <label>
                        Estimated
                        minutes

                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={
                            topic
                              .estimatedMinutes
                          }
                          onChange={(
                            event
                          ) =>
                            updateTopic(
                              milestoneIndex,
                              topicIndex,
                              "estimatedMinutes",
                              event
                                .target
                                .value
                            )
                          }
                          disabled={
                            isSubmitting ||
                            isGenerating
                          }
                        />
                      </label>

                      {milestone
                        .topics
                        .length >
                        1 && (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() =>
                            removeTopic(
                              milestoneIndex,
                              topicIndex
                            )
                          }
                          disabled={
                            isSubmitting ||
                            isGenerating
                          }
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
                  addTopic(
                    milestoneIndex
                  )
                }
                disabled={
                  isSubmitting ||
                  isGenerating
                }
              >
                Add Topic
              </button>
            </div>
          )
        )}
      </div>
    );

  return (
    <section className="card setup-card">
      <div className="section-header">
        <div>
          <h2>
            Create a Learning
            Plan
          </h2>

          <p>
            Build the structure
            yourself or ask KaizenAI
            for an editable draft.
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
        <p
          className={`message ${messageType}`}
          role={
            messageType ===
            "error"
              ? "alert"
              : "status"
          }
        >
          {message}
        </p>
      )}

      <div
        className="plan-mode-selector"
        role="radiogroup"
        aria-label="Learning plan creation method"
      >
        <label
          className={`plan-mode-card ${
            creationMode ===
            "manual"
              ? "selected"
              : ""
          }`}
        >
          <input
            type="radio"
            name="creationMode"
            checked={
              creationMode ===
              "manual"
            }
            onChange={() =>
              setCreationMode(
                "manual"
              )
            }
            disabled={
              isSubmitting ||
              isGenerating
            }
          />

          <strong>
            Build it myself
          </strong>

          <span>
            Define the goal,
            milestones, topics
            and estimates
            manually.
          </span>
        </label>

        <label
          className={`plan-mode-card ${
            creationMode ===
            "ai"
              ? "selected"
              : ""
          }`}
        >
          <input
            type="radio"
            name="creationMode"
            checked={
              creationMode ===
              "ai"
            }
            onChange={() =>
              setCreationMode(
                "ai"
              )
            }
            disabled={
              isSubmitting ||
              isGenerating
            }
          />

          <strong>
            Generate with
            KaizenAI
          </strong>

          <span>
            Describe your
            learning outcome.
            KaizenAI proposes a
            draft you must
            review before
            saving.
          </span>
        </label>
      </div>

      <form onSubmit={submitForm}>
        {creationMode ===
        "manual" ? (
          <>
            <div className="form-grid">
              <label>
                Goal title

                <input
                  type="text"
                  value={title}
                  onChange={(
                    event
                  ) =>
                    setTitle(
                      event.target
                        .value
                    )
                  }
                  placeholder="For example: Learn Java programming"
                  disabled={
                    isSubmitting
                  }
                />
              </label>

              <label>
                Target date

                <input
                  type="date"
                  value={
                    targetDate
                  }
                  onChange={(
                    event
                  ) =>
                    setTargetDate(
                      event.target
                        .value
                    )
                  }
                  disabled={
                    isSubmitting
                  }
                />
              </label>
            </div>

            {renderMilestones()}
            {renderAvailability()}
          </>
        ) : (
          <>
            <div className="ai-planning-intro">
              <strong>
                KaizenAI draft,
                learner-approved
                plan
              </strong>

              <p>
                KaizenAI can propose
                a learning structure
                and estimates. It
                cannot create the
                plan until you
                review the editable
                draft and approve
                it.
              </p>
            </div>

            <div className="form-section">
              <div className="form-grid">
                <label>
                  What do you want
                  to learn?

                  <textarea
                    value={
                      goalDescription
                    }
                    onChange={(
                      event
                    ) =>
                      setGoalDescription(
                        event.target
                          .value
                      )
                    }
                    maxLength="1200"
                    rows="5"
                    placeholder="For example: I want to learn Python for data analysis so I can clean datasets, analyse them with pandas and create clear visualisations."
                    disabled={
                      isSubmitting ||
                      isGenerating
                    }
                  />
                </label>

                <label>
                  Target date

                  <input
                    type="date"
                    value={
                      targetDate
                    }
                    onChange={(
                      event
                    ) =>
                      setTargetDate(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      isSubmitting ||
                      isGenerating
                    }
                  />
                </label>

                <label>
                  Current level

                  <select
                    value={
                      currentLevel
                    }
                    onChange={(
                      event
                    ) =>
                      setCurrentLevel(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      isSubmitting ||
                      isGenerating
                    }
                  >
                    {LEVEL_OPTIONS.map(
                      (option) => (
                        <option
                          key={
                            option.value
                          }
                          value={
                            option.value
                          }
                        >
                          {
                            option.label
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Preferences or
                  constraints
                  <span className="optional-label">
                    Optional
                  </span>

                  <textarea
                    value={
                      preferences
                    }
                    onChange={(
                      event
                    ) =>
                      setPreferences(
                        event.target
                          .value
                      )
                    }
                    maxLength="900"
                    rows="4"
                    placeholder="For example: practical exercises, 30–60 minute sessions, prioritise exam topics."
                    disabled={
                      isSubmitting ||
                      isGenerating
                    }
                  />
                </label>
              </div>
            </div>

            {renderAvailability()}

            <div className="ai-privacy-note">
              <strong>
                Before you
                generate
              </strong>

              <p>
                Only the learning
                description, level,
                preferences,
                deadline and
                availability are
                sent to Google Gemini 3.8 Flash. Do not
                enter sensitive or
                confidential
                information.
              </p>
            </div>

            <div className="ai-generation-panel">
              <div>
                <strong>
                  Generate a
                  structured draft
                </strong>

                <p>
                  KaizenAI
                  uses a high-reasoning planning model.
                  The server then
                  checks and, if
                  needed, reduces
                  estimates to fit
                  the deterministic
                  capacity budget.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  generateAiDraft
                }
                disabled={
                  isGenerating ||
                  isSubmitting
                }
              >
                {isGenerating
                  ? "KaizenAI is planning..."
                  : aiDraftMeta
                    ? "Regenerate KaizenAI Plan"
                    : "Generate KaizenAI Plan"}
              </button>
            </div>

            {aiDraftMeta && (
              <>
                <div
                  className={`ai-review-banner ${
                    aiDraftIsStale
                      ? "stale"
                      : ""
                  }`}
                  role="status"
                >
                  <div>
                    <strong>
                      {aiDraftIsStale
                        ? "Draft needs regeneration"
                        : "KaizenAI draft — review required"}
                    </strong>

                    <p>
                      {aiDraftIsStale
                        ? "The planning context changed after generation. Regenerate before approval."
                        : aiDraftMeta.summary}
                    </p>
                  </div>

                  <div className="ai-draft-meta">
                    <span className="ai-brand-chip">
                      KaizenAI
                    </span>

                    <span>
                      Draft:{" "}
                      {
                        aiDraftMeta
                          .totalEstimatedMinutes
                      }{" "}
                      min
                    </span>

                    <span>
                      Budget:{" "}
                      {
                        aiDraftMeta
                          .planningBudgetMinutes
                      }{" "}
                      min
                    </span>
                  </div>
                </div>

                <details className="ai-disclosure">
                  <summary>
                    About KaizenAI
                  </summary>
                  <p>
                    KaizenAI uses{" "}
                    {aiDraftMeta.provider}{" "}
                    {aiDraftMeta.model} as
                    its underlying generative
                    model. Suggestions are
                    capacity-checked by the
                    Kaizen planner and must be
                    reviewed before they are
                    saved.
                  </p>
                </details>

                {aiDraftMeta
                  .adjustedToCapacity && (
                  <p className="message success">
                    KaizenAI proposed
                    more learning
                    time than the
                    safe planning
                    budget. The
                    server
                    deterministically
                    reduced the
                    estimates before
                    showing this
                    draft.
                  </p>
                )}

                {aiDraftMeta
                  .assumptions
                  .length > 0 && (
                  <div className="ai-assumptions">
                    <strong>
                      Assumptions to
                      verify
                    </strong>

                    <ul>
                      {aiDraftMeta
                        .assumptions
                        .map(
                          (
                            assumption,
                            index
                          ) => (
                            <li
                              key={`${assumption}-${index}`}
                            >
                              {
                                assumption
                              }
                            </li>
                          )
                        )}
                    </ul>
                  </div>
                )}

                <div className="form-section">
                  <label>
                    Refined goal
                    title

                    <input
                      type="text"
                      value={title}
                      onChange={(
                        event
                      ) =>
                        setTitle(
                          event.target
                            .value
                        )
                      }
                      disabled={
                        isSubmitting ||
                        isGenerating
                      }
                    />
                  </label>
                </div>

                {renderMilestones()}
              </>
            )}
          </>
        )}

        <button
          type="submit"
          className="primary-action"
          disabled={
            isSubmitting ||
            isGenerating ||
            (
              creationMode ===
                "ai" &&
              (
                !aiDraftMeta ||
                aiDraftIsStale
              )
            )
          }
        >
          {isSubmitting
            ? "Creating Learning Plan..."
            : creationMode ===
                "ai"
              ? "Approve & Create Learning Plan"
              : "Create Learning Plan"}
        </button>
      </form>
    </section>
  );
}

export default GoalSetupForm;
