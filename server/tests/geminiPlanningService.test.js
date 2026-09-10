const {
  calculatePlanningBudget,
  validateGeminiPlanRequest,
  normaliseGeminiDraft,
  buildGeminiSystemPrompt,
  buildGeminiUserPrompt,
  buildGeminiRequestBody,
  getGeminiOutputText,
  resolveThinkingLevel,
  generateGeminiPlanDraft,
} = require("../services/geminiPlanningService");

const availability = [
  {
    day_of_week: "Thursday",
    available_minutes: 120,
  },
  {
    day_of_week: "Friday",
    available_minutes: 120,
  },
  {
    day_of_week: "Saturday",
    available_minutes: 120,
  },
  {
    day_of_week: "Sunday",
    available_minutes: 120,
  },
];

const currentDate =
  new Date(
    "2026-09-10T10:00:00Z"
  );

const validDraft = {
  title:
    "Python for Data Analysis",
  summary:
    "A practical staged introduction to Python data analysis.",
  milestones: [
    {
      title:
        "Python and pandas foundations",
      rationale:
        "Build the core data-handling skills before analysis.",
      topics: [
        {
          title:
            "Python data structures",
          estimatedMinutes: 30,
        },
        {
          title:
            "DataFrames and Series",
          estimatedMinutes: 45,
        },
      ],
    },
  ],
  assumptions: [
    "The learner can install or access a Python environment.",
  ],
};

describe("geminiPlanningService", () => {
  test("reserves deterministic capacity headroom", () => {
    const result =
      calculatePlanningBudget({
        targetDate:
          "2026-09-13",
        availability,
        currentDate,
      });

    expect(result.valid)
      .toBe(true);

    expect(
      result
        .planningBudgetMinutes
    ).toBeLessThan(
      result.availableMinutes
    );
  });

  test("rejects invalid learner levels", () => {
    const result =
      validateGeminiPlanRequest({
        goalDescription:
          "Learn Python data analysis",
        targetDate:
          "2026-09-13",
        currentLevel:
          "unknown-level",
        preferences: "",
        availability,
        currentDate,
      });

    expect(result.valid)
      .toBe(false);
  });

  test("normalises a valid structured Gemini draft", () => {
    const result =
      normaliseGeminiDraft(
        validDraft,
        600
      );

    expect(result.title)
      .toBe(
        "Python for Data Analysis"
      );

    expect(
      result.totalEstimatedMinutes
    ).toBe(75);

    expect(
      result.adjustedToCapacity
    ).toBe(false);
  });

  test("deterministically fits an oversized AI draft to the capacity budget", () => {
    const oversized = {
      ...validDraft,
      milestones: [
        {
          title:
            "Oversized stage",
          rationale:
            "Test capacity enforcement.",
          topics: [
            {
              title: "Topic one",
              estimatedMinutes: 180,
            },
            {
              title: "Topic two",
              estimatedMinutes: 180,
            },
            {
              title: "Topic three",
              estimatedMinutes: 180,
            },
          ],
        },
      ],
    };

    const result =
      normaliseGeminiDraft(
        oversized,
        180
      );

    expect(
      result.totalEstimatedMinutes
    ).toBeLessThanOrEqual(
      180
    );

    expect(
      result.adjustedToCapacity
    ).toBe(true);
  });

  test("extracts model output text from the Interactions REST response", () => {
    const text =
      getGeminiOutputText({
        status:
          "completed",
        steps: [
          {
            type:
              "thought",
            signature:
              "ignored",
          },
          {
            type:
              "model_output",
            content: [
              {
                type:
                  "text",
                text:
                  '{"title":"Test"}',
              },
            ],
          },
        ],
      });

    expect(text)
      .toBe(
        '{"title":"Test"}'
      );
  });

  test("uses high thinking when configuration is invalid", () => {
    expect(
      resolveThinkingLevel(
        "not-a-level"
      )
    ).toBe("high");
  });

  test("builds the current Interactions API structured-output request", () => {
    const body =
      buildGeminiRequestBody({
        prompt:
          "Create a plan",
        model:
          "gemini-3.8-flash",
        thinkingLevel:
          "high",
      });

    expect(body.model)
      .toBe(
        "gemini-3.8-flash"
      );

    expect(body.store)
      .toBe(false);

    expect(
      body.generation_config
        .thinking_level
    ).toBe("high");

    expect(
      body.response_format
        .type
    ).toBe("text");

    expect(
      body.response_format
        .mime_type
    ).toBe(
      "application/json"
    );

    expect(
      body.response_format
        .schema.properties
        .milestones.type
    ).toBe("array");
  });

  test("encodes Kaizen planning principles in the Gemini system prompt", () => {
    const prompt =
      buildGeminiSystemPrompt();

    expect(prompt)
      .toContain(
        "continuous incremental improvement"
      );

    expect(prompt)
      .toContain(
        "small achievable steps"
      );

    expect(prompt)
      .toContain(
        "feedback loop adapts future estimates"
      );

    expect(prompt)
      .toContain(
        "Avoid overloading the learner"
      );
  });

  test("includes goal context and planning budget in the learner prompt", () => {
    const prompt =
      buildGeminiUserPrompt({
        goalDescription:
          "Learn SQL for analytics",
        targetDate:
          "2026-09-13",
        currentLevel:
          "beginner",
        preferences:
          "Practical exercises",
        planningBudgetMinutes:
          300,
        availableMinutes:
          360,
        availability,
      });

    expect(prompt)
      .toContain(
        "Learn SQL for analytics"
      );

    expect(prompt)
      .toContain(
        "Maximum AI planning budget: 300 minutes"
      );
  });

  test("returns a configuration error without a Gemini API key", async () => {
    const result =
      await generateGeminiPlanDraft({
        goalDescription:
          "Learn Python for data analysis",
        targetDate:
          "2026-09-13",
        currentLevel:
          "beginner",
        preferences: "",
        availability,
        apiKey: "",
        currentDate,
      });

    expect(result.valid)
      .toBe(false);

    expect(result.statusCode)
      .toBe(503);
  });

  test("uses the Interactions endpoint and keeps the API key out of the request body", async () => {
    const fetchImplementation =
      jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: "test-interaction",
          status:
            "completed",
          model:
            "gemini-3.8-flash",
          steps: [
            {
              type:
                "thought",
              signature:
                "test-signature",
            },
            {
              type:
                "model_output",
              content: [
                {
                  type:
                    "text",
                  text:
                    JSON.stringify(
                      validDraft
                    ),
                },
              ],
            },
          ],
        }),
      });

    const result =
      await generateGeminiPlanDraft({
        goalDescription:
          "Learn Python for data analysis",
        targetDate:
          "2026-09-13",
        currentLevel:
          "beginner",
        preferences:
          "Practical exercises",
        availability,
        apiKey:
          "secret-test-key",
        model:
          "gemini-3.8-flash",
        thinkingLevel:
          "high",
        fetchImplementation,
        currentDate,
      });

    expect(result.valid)
      .toBe(true);

    expect(
      fetchImplementation
    ).toHaveBeenCalledTimes(1);

    const [
      url,
      request,
    ] =
      fetchImplementation
        .mock.calls[0];

    expect(url)
      .toBe(
        "https://generativelanguage.googleapis.com/v1beta/interactions"
      );

    expect(request.body)
      .not.toContain(
        "secret-test-key"
      );

    expect(
      request.headers[
        "x-goog-api-key"
      ]
    ).toBe(
      "secret-test-key"
    );
  });
});
