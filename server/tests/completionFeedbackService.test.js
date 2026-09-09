const {
  MAX_ACTUAL_MINUTES,
  validateCompletionFeedback,
} = require("../services/completionFeedbackService");

describe("completionFeedbackService", () => {
  test("accepts valid completion feedback", () => {
    expect(
      validateCompletionFeedback({
        actualMinutes: 45,
        difficultyRating: 4,
      })
    ).toEqual({
      valid: true,
      actualMinutes: 45,
      difficultyRating: 4,
    });
  });

  test("normalises numeric string input", () => {
    expect(
      validateCompletionFeedback({
        actualMinutes: "30",
        difficultyRating: "3",
      })
    ).toEqual({
      valid: true,
      actualMinutes: 30,
      difficultyRating: 3,
    });
  });

  test("rejects missing actual minutes", () => {
    expect(
      validateCompletionFeedback({
        difficultyRating: 3,
      }).valid
    ).toBe(false);
  });

  test("rejects fractional actual minutes", () => {
    expect(
      validateCompletionFeedback({
        actualMinutes: 12.5,
        difficultyRating: 3,
      }).valid
    ).toBe(false);
  });

  test("rejects actual minutes above the safety limit", () => {
    expect(
      validateCompletionFeedback({
        actualMinutes: MAX_ACTUAL_MINUTES + 1,
        difficultyRating: 3,
      }).valid
    ).toBe(false);
  });

  test("rejects missing difficulty rating", () => {
    expect(
      validateCompletionFeedback({
        actualMinutes: 30,
      }).valid
    ).toBe(false);
  });

  test("rejects a difficulty rating below 1", () => {
    expect(
      validateCompletionFeedback({
        actualMinutes: 30,
        difficultyRating: 0,
      }).valid
    ).toBe(false);
  });

  test("rejects a difficulty rating above 5", () => {
    expect(
      validateCompletionFeedback({
        actualMinutes: 30,
        difficultyRating: 6,
      }).valid
    ).toBe(false);
  });
});
