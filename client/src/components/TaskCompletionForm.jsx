import { useState } from "react";

const difficultyOptions = [
  { value: 1, label: "1 — Very easy" },
  { value: 2, label: "2 — Easy" },
  { value: 3, label: "3 — About right" },
  { value: 4, label: "4 — Hard" },
  { value: 5, label: "5 — Very hard" },
];

function TaskCompletionForm({
  task,
  onComplete,
}) {
  const [isOpen, setIsOpen] =
    useState(false);

  const [actualMinutes, setActualMinutes] =
    useState(
      String(task.estimated_minutes || 30)
    );

  const [difficultyRating, setDifficultyRating] =
    useState("3");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    const minutes = Number(actualMinutes);
    const difficulty =
      Number(difficultyRating);

    if (
      !Number.isInteger(minutes) ||
      minutes <= 0 ||
      minutes > 1440
    ) {
      setError(
        "Enter actual study time as a whole number from 1 to 1440 minutes."
      );
      return;
    }

    if (
      !Number.isInteger(difficulty) ||
      difficulty < 1 ||
      difficulty > 5
    ) {
      setError(
        "Choose a difficulty rating from 1 to 5."
      );
      return;
    }

    setIsSubmitting(true);
    setError("");

    const succeeded = await onComplete({
      actualMinutes: minutes,
      difficultyRating: difficulty,
    });

    if (succeeded) {
      setIsOpen(false);
    }

    setIsSubmitting(false);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
      >
        Complete
      </button>
    );
  }

  return (
    <form
      className="completion-feedback-form"
      onSubmit={handleSubmit}
    >
      <div className="completion-feedback-heading">
        <strong>Complete task</strong>
        <span>
          Estimated: {task.estimated_minutes} min
        </span>
      </div>

      <div className="completion-feedback-fields">
        <label>
          Actual minutes
          <input
            type="number"
            min="1"
            max="1440"
            step="1"
            value={actualMinutes}
            onChange={(event) =>
              setActualMinutes(event.target.value)
            }
            disabled={isSubmitting}
            required
          />
        </label>

        <label>
          Difficulty
          <select
            value={difficultyRating}
            onChange={(event) =>
              setDifficultyRating(
                event.target.value
              )
            }
            disabled={isSubmitting}
          >
            {difficultyOptions.map(
              (option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              )
            )}
          </select>
        </label>
      </div>

      {error && (
        <p
          className="completion-feedback-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="completion-feedback-actions">
        <button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Saving..."
            : "Save Completion"}
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setError("");
            setIsOpen(false);
          }}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default TaskCompletionForm;
