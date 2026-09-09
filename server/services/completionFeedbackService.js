const MAX_ACTUAL_MINUTES = 1440;

function validateCompletionFeedback({
  actualMinutes,
  difficultyRating,
}) {
  const actual = Number(actualMinutes);
  const difficulty = Number(difficultyRating);

  if (
    !Number.isInteger(actual) ||
    actual <= 0 ||
    actual > MAX_ACTUAL_MINUTES
  ) {
    return {
      valid: false,
      error:
        "Actual minutes must be a positive whole number no greater than 1440.",
    };
  }

  if (
    !Number.isInteger(difficulty) ||
    difficulty < 1 ||
    difficulty > 5
  ) {
    return {
      valid: false,
      error:
        "Difficulty rating must be a whole number from 1 to 5.",
    };
  }

  return {
    valid: true,
    actualMinutes: actual,
    difficultyRating: difficulty,
  };
}

module.exports = {
  MAX_ACTUAL_MINUTES,
  validateCompletionFeedback,
};
