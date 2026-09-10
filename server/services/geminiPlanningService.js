const {
  normaliseDate,
  calculateAvailableCapacity,
  validateAvailability,
} = require("./schedulingService");

const DEFAULT_GEMINI_PLAN_MODEL =
  process.env.GEMINI_PLAN_MODEL ||
  "gemini-3.8-flash";

const DEFAULT_GEMINI_THINKING_LEVEL =
  process.env.GEMINI_THINKING_LEVEL ||
  "high";

const ALLOWED_THINKING_LEVELS =
  new Set(["low", "medium", "high"]);

const ALLOWED_LEVELS = new Set([
  "beginner",
  "some-experience",
  "intermediate",
  "advanced",
]);

const MAX_GOAL_DESCRIPTION_LENGTH = 1200;
const MAX_PREFERENCES_LENGTH = 900;
const MAX_OUTPUT_TOKENS = 6000;

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description:
        "A concise, specific title for the learning goal.",
    },
    summary: {
      type: "string",
      description:
        "A short explanation of the proposed learning path.",
    },
    milestones: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: {
            type: "string",
            description:
              "A concrete stage in the learning progression.",
          },
          rationale: {
            type: "string",
            description:
              "Why this milestone appears at this point in the sequence.",
          },
          topics: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: {
                  type: "string",
                  description:
                    "A specific learnable topic or practice objective.",
                },
                estimatedMinutes: {
                  type: "integer",
                  minimum: 15,
                  maximum: 180,
                  description:
                    "Focused learning time for this topic in minutes.",
                },
              },
              required: [
                "title",
                "estimatedMinutes",
              ],
            },
          },
        },
        required: [
          "title",
          "rationale",
          "topics",
        ],
      },
    },
    assumptions: {
      type: "array",
      maxItems: 5,
      items: {
        type: "string",
      },
      description:
        "Assumptions the learner should check before accepting the draft.",
    },
  },
  required: [
    "title",
    "summary",
    "milestones",
    "assumptions",
  ],
};

function cleanText(value, maxLength) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function clamp(value, minimum, maximum) {
  return Math.min(
    Math.max(value, minimum),
    maximum
  );
}

function roundToFive(value) {
  return Math.max(
    15,
    Math.round(value / 5) * 5
  );
}

function calculatePlanningBudget({
  targetDate,
  availability,
  currentDate = new Date(),
}) {
  const availabilityValidation =
    validateAvailability(availability);

  if (!availabilityValidation.valid) {
    return {
      valid: false,
      error:
        availabilityValidation.error,
    };
  }

  const today =
    normaliseDate(currentDate);

  const deadline =
    normaliseDate(targetDate);

  if (!today || !deadline) {
    return {
      valid: false,
      error:
        "The target date is invalid.",
    };
  }

  if (deadline < today) {
    return {
      valid: false,
      error:
        "The target date must be today or a future date.",
    };
  }

  const availableMinutes =
    calculateAvailableCapacity(
      today,
      deadline,
      availability
    );

  if (availableMinutes < 30) {
    return {
      valid: false,
      error:
        "At least 30 minutes of study capacity is required before the target date.",
    };
  }

  const planningBudgetMinutes =
    Math.max(
      15,
      Math.min(
        Math.floor(
          availableMinutes * 0.85
        ),
        6000
      )
    );

  return {
    valid: true,
    availableMinutes,
    planningBudgetMinutes,
  };
}

function validateGeminiPlanRequest({
  goalDescription,
  targetDate,
  currentLevel,
  preferences,
  availability,
  currentDate,
}) {
  const description =
    cleanText(
      goalDescription,
      MAX_GOAL_DESCRIPTION_LENGTH
    );

  if (description.length < 5) {
    return {
      valid: false,
      error:
        "Describe what you want to learn in a little more detail.",
    };
  }

  const level =
    String(
      currentLevel || ""
    ).trim();

  if (!ALLOWED_LEVELS.has(level)) {
    return {
      valid: false,
      error:
        "Choose a valid current learning level.",
    };
  }

  const budget =
    calculatePlanningBudget({
      targetDate,
      availability,
      currentDate,
    });

  if (!budget.valid) {
    return budget;
  }

  return {
    valid: true,
    goalDescription: description,
    targetDate,
    currentLevel: level,
    preferences:
      cleanText(
        preferences,
        MAX_PREFERENCES_LENGTH
      ),
    availability,
    ...budget,
  };
}

function totalDraftMinutes(milestones) {
  return milestones.reduce(
    (milestoneTotal, milestone) =>
      milestoneTotal +
      milestone.topics.reduce(
        (topicTotal, topic) =>
          topicTotal +
          Number(
            topic.estimatedMinutes
          ),
        0
      ),
    0
  );
}

function normaliseGeminiDraft(
  rawDraft,
  planningBudgetMinutes
) {
  if (
    !rawDraft ||
    typeof rawDraft !== "object"
  ) {
    throw new Error(
      "Gemini did not return a usable learning-plan draft."
    );
  }

  const title =
    cleanText(rawDraft.title, 150);

  const summary =
    cleanText(rawDraft.summary, 900);

  const rawMilestones =
    Array.isArray(
      rawDraft.milestones
    )
      ? rawDraft.milestones
      : [];

  const milestones =
    rawMilestones
      .slice(0, 5)
      .map((milestone) => {
        const milestoneTitle =
          cleanText(
            milestone?.title,
            150
          );

        const rationale =
          cleanText(
            milestone?.rationale,
            450
          );

        const rawTopics =
          Array.isArray(
            milestone?.topics
          )
            ? milestone.topics
            : [];

        const topics =
          rawTopics
            .slice(0, 6)
            .map((topic) => {
              const topicTitle =
                cleanText(
                  topic?.title,
                  150
                );

              const rawMinutes =
                Number(
                  topic
                    ?.estimatedMinutes
                );

              const estimatedMinutes =
                Number.isFinite(
                  rawMinutes
                )
                  ? clamp(
                      roundToFive(
                        rawMinutes
                      ),
                      15,
                      180
                    )
                  : 30;

              return {
                title:
                  topicTitle,
                estimatedMinutes,
              };
            })
            .filter(
              (topic) =>
                topic.title.length > 0
            );

        return {
          title:
            milestoneTitle,
          rationale,
          topics,
        };
      })
      .filter(
        (milestone) =>
          milestone.title.length >
            0 &&
          milestone.topics.length >
            0
      );

  if (
    !title ||
    milestones.length === 0
  ) {
    throw new Error(
      "Gemini returned an incomplete learning-plan structure."
    );
  }

  let totalEstimatedMinutes =
    totalDraftMinutes(milestones);

  let adjustedToCapacity = false;

  if (
    totalEstimatedMinutes >
    planningBudgetMinutes
  ) {
    adjustedToCapacity = true;

    const scale =
      planningBudgetMinutes /
      totalEstimatedMinutes;

    for (
      const milestone of
      milestones
    ) {
      for (
        const topic of
        milestone.topics
      ) {
        topic.estimatedMinutes =
          clamp(
            roundToFive(
              topic
                .estimatedMinutes *
                scale
            ),
            15,
            180
          );
      }
    }

    totalEstimatedMinutes =
      totalDraftMinutes(
        milestones
      );

    let guard = 0;

    while (
      totalEstimatedMinutes >
        planningBudgetMinutes &&
      guard < 3000
    ) {
      let changed = false;

      for (
        let milestoneIndex =
          milestones.length - 1;
        milestoneIndex >= 0;
        milestoneIndex -= 1
      ) {
        const milestone =
          milestones[
            milestoneIndex
          ];

        for (
          let topicIndex =
            milestone.topics
              .length - 1;
          topicIndex >= 0;
          topicIndex -= 1
        ) {
          const topic =
            milestone.topics[
              topicIndex
            ];

          if (
            topic.estimatedMinutes >
            15
          ) {
            topic.estimatedMinutes -=
              5;

            totalEstimatedMinutes -=
              5;

            changed = true;
            break;
          }
        }

        if (changed) {
          break;
        }
      }

      if (!changed) {
        break;
      }

      guard += 1;
    }

    while (
      totalEstimatedMinutes >
        planningBudgetMinutes &&
      milestones.length > 0
    ) {
      const lastMilestone =
        milestones[
          milestones.length - 1
        ];

      if (
        lastMilestone.topics
          .length > 1
      ) {
        const removed =
          lastMilestone.topics.pop();

        totalEstimatedMinutes -=
          removed.estimatedMinutes;
      } else if (
        milestones.length > 1
      ) {
        const removedMilestone =
          milestones.pop();

        totalEstimatedMinutes -=
          totalDraftMinutes([
            removedMilestone,
          ]);
      } else {
        break;
      }
    }
  }

  if (
    totalEstimatedMinutes >
    planningBudgetMinutes
  ) {
    throw new Error(
      "The generated draft could not be fitted safely within the available study capacity."
    );
  }

  const assumptions =
    (
      Array.isArray(
        rawDraft.assumptions
      )
        ? rawDraft.assumptions
        : []
    )
      .map((assumption) =>
        cleanText(
          assumption,
          280
        )
      )
      .filter(Boolean)
      .slice(0, 5);

  return {
    title,
    summary,
    milestones,
    assumptions,
    totalEstimatedMinutes,
    adjustedToCapacity,
  };
}

function buildGeminiSystemPrompt() {
  return [
    "You are an expert instructional designer creating an editable learning-plan draft for a Kaizen-inspired adaptive micro-task planner.",
    "Use Kaizen principles explicitly: continuous incremental improvement, small achievable steps, sustainable workload, reflection on observed performance, and adjustment rather than one large fixed plan.",
    "The AI proposes the learning structure only; the application's deterministic scheduler later converts approved topics into dated micro-tasks and its feedback loop adapts future estimates.",
    "Design milestones as a gradual progression in capability, where each stage builds on the previous one and produces a clear, useful learning outcome.",
    "Design topics as focused units that can be split into manageable study sessions. Avoid broad topics that hide several unrelated skills inside one estimate.",
    "Prefer active practice, retrieval, application, small exercises, or mini-checkpoints over long blocks of passive study when suitable for the subject.",
    "Sequence prerequisites before advanced material and introduce complexity progressively.",
    "Avoid overloading the learner. Keep the plan within the supplied capacity budget and prioritise essential material when time is constrained.",
    "Do not falsely claim the first plan will be perfectly calibrated; later completion feedback is expected to improve estimates through the Kaizen adaptation loop.",
    "The output is a suggestion, not an authoritative curriculum. The learner must be able to review, edit, remove, or add content before approval.",
    "Use 2 to 5 milestones when the study budget permits and 1 to 6 topics per milestone.",
    "Keep each topic between 15 and 180 focused minutes.",
    "Do not claim completion proves mastery or professional competence.",
  ].join(" ");
}

function buildGeminiUserPrompt({
  goalDescription,
  targetDate,
  currentLevel,
  preferences,
  planningBudgetMinutes,
  availableMinutes,
  availability,
}) {
  const availabilityText =
    availability
      .map(
        (entry) =>
          `${entry.day_of_week}: ${entry.available_minutes} minutes`
      )
      .join(", ");

  return [
    `Learner goal: ${goalDescription}`,
    `Current level: ${currentLevel}`,
    `Target date: ${targetDate}`,
    `Weekly availability: ${availabilityText}`,
    `Total calculated capacity before target date: ${availableMinutes} minutes`,
    `Maximum AI planning budget: ${planningBudgetMinutes} minutes`,
    `Preferences or constraints: ${
      preferences ||
      "No additional preferences supplied."
    }`,
    "",
    "Create a coherent learning-plan draft with:",
    "- a concise refined goal title;",
    "- a short summary;",
    "- ordered milestones;",
    "- ordered concrete topics within each milestone;",
    "- realistic focused-minute estimates;",
    "- assumptions the learner should verify.",
    "",
    "Stay within the planning budget and prioritise the most useful material.",
  ].join("\n");
}

function resolveThinkingLevel(
  requestedThinkingLevel
) {
  const value =
    String(
      requestedThinkingLevel ||
        DEFAULT_GEMINI_THINKING_LEVEL
    )
      .trim()
      .toLowerCase();

  return ALLOWED_THINKING_LEVELS.has(
    value
  )
    ? value
    : "high";
}

/*
 * Current Gemini Interactions API request.
 *
 * Structured output is top-level response_format.
 * Model behaviour stays inside generation_config.
 */
function buildGeminiRequestBody({
  prompt,
  model,
  thinkingLevel,
}) {
  return {
    model,
    store: false,
    input: prompt,
    system_instruction:
      buildGeminiSystemPrompt(),
    generation_config: {
      thinking_level:
        resolveThinkingLevel(
          thinkingLevel
        ),
      max_output_tokens:
        MAX_OUTPUT_TOKENS,
    },
    response_format: {
      type: "text",
      mime_type:
        "application/json",
      schema: PLAN_SCHEMA,
    },
  };
}

/*
 * REST Interactions responses return output text inside:
 * steps[] -> model_output -> content[] -> text
 */
function getGeminiOutputText(
  responseBody
) {
  const steps =
    Array.isArray(
      responseBody?.steps
    )
      ? responseBody.steps
      : [];

  const outputTexts = [];

  for (const step of steps) {
    if (
      step?.type !==
      "model_output"
    ) {
      continue;
    }

    const content =
      Array.isArray(
        step?.content
      )
        ? step.content
        : [];

    for (const item of content) {
      if (
        item?.type ===
          "text" &&
        typeof item?.text ===
          "string" &&
        item.text.trim()
      ) {
        outputTexts.push(
          item.text
        );
      }
    }
  }

  return outputTexts.length
    ? outputTexts.join("")
    : null;
}

function mapProviderError(
  status,
  providerMessage
) {
  if (
    status === 401 ||
    status === 403
  ) {
    return "Gemini authentication was rejected. Check that the API key is valid and belongs to a project with Gemini API access.";
  }

  if (status === 404) {
    return "The configured Gemini model is not available to this API key/project. Check GEMINI_PLAN_MODEL.";
  }

  if (status === 429) {
    return "The free Gemini API limit is currently busy or exhausted. Try again later; manual planning remains available.";
  }

  if (status === 400) {
    return `Gemini rejected the request configuration${
      providerMessage
        ? `: ${providerMessage}`
        : "."
    }`;
  }

  return "Gemini rejected the planning request. Check the Gemini API/project configuration or try again later.";
}

async function generateGeminiPlanDraft({
  goalDescription,
  targetDate,
  currentLevel,
  preferences,
  availability,
  apiKey =
    process.env.GEMINI_API_KEY,
  model =
    DEFAULT_GEMINI_PLAN_MODEL,
  thinkingLevel =
    DEFAULT_GEMINI_THINKING_LEVEL,
  fetchImplementation =
    global.fetch,
  currentDate = new Date(),
}) {
  const validation =
    validateGeminiPlanRequest({
      goalDescription,
      targetDate,
      currentLevel,
      preferences,
      availability,
      currentDate,
    });

  if (!validation.valid) {
    return validation;
  }

  if (!apiKey) {
    return {
      valid: false,
      statusCode: 503,
      error:
        "Gemini AI planning is not configured on this server. Manual planning remains available.",
    };
  }

  if (
    typeof fetchImplementation !==
    "function"
  ) {
    return {
      valid: false,
      statusCode: 500,
      error:
        "The server cannot contact the Gemini API.",
    };
  }

  const prompt =
    buildGeminiUserPrompt(
      validation
    );

  const requestBody =
    buildGeminiRequestBody({
      prompt,
      model,
      thinkingLevel,
    });

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      60000
    );

  let providerResponse;

  try {
    providerResponse =
      await fetchImplementation(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            "x-goog-api-key":
              apiKey,
          },
          body:
            JSON.stringify(
              requestBody
            ),
          signal:
            controller.signal,
        }
      );
  } catch (error) {
    clearTimeout(timeout);

    return {
      valid: false,
      statusCode: 502,
      error:
        error?.name ===
        "AbortError"
          ? "Gemini took too long to generate the draft. Try again or use manual planning."
          : "The Gemini API could not be reached. Try again or use manual planning.",
    };
  }

  clearTimeout(timeout);

  let responseBody;

  try {
    responseBody =
      await providerResponse.json();
  } catch {
    return {
      valid: false,
      statusCode: 502,
      error:
        "Gemini returned an unreadable response.",
    };
  }

  if (!providerResponse.ok) {
    const providerMessage =
      cleanText(
        responseBody?.error
          ?.message,
        350
      );

    console.error(
      "Gemini planning provider error:",
      providerResponse.status,
      providerMessage
    );

    return {
      valid: false,
      statusCode:
        providerResponse.status ===
          429
          ? 429
          : providerResponse.status ===
                400
            ? 400
            : 502,
      error:
        mapProviderError(
          providerResponse.status,
          providerMessage
        ),
    };
  }

  if (
    responseBody?.status &&
    responseBody.status !==
      "completed"
  ) {
    return {
      valid: false,
      statusCode: 502,
      error:
        `Gemini returned interaction status "${responseBody.status}" instead of a completed draft.`,
    };
  }

  const outputText =
    getGeminiOutputText(
      responseBody
    );

  if (!outputText) {
    return {
      valid: false,
      statusCode: 502,
      error:
        "Gemini returned no structured learning-plan draft.",
    };
  }

  let rawDraft;

  try {
    rawDraft =
      JSON.parse(outputText);
  } catch {
    return {
      valid: false,
      statusCode: 502,
      error:
        "Gemini returned invalid structured plan data.",
    };
  }

  let draft;

  try {
    draft =
      normaliseGeminiDraft(
        rawDraft,
        validation
          .planningBudgetMinutes
      );
  } catch (error) {
    return {
      valid: false,
      statusCode: 502,
      error: error.message,
    };
  }

  return {
    valid: true,
    provider:
      "Google Gemini",
    model,
    thinkingLevel:
      resolveThinkingLevel(
        thinkingLevel
      ),
    availableMinutes:
      validation
        .availableMinutes,
    planningBudgetMinutes:
      validation
        .planningBudgetMinutes,
    draft,
  };
}

module.exports = {
  DEFAULT_GEMINI_PLAN_MODEL,
  DEFAULT_GEMINI_THINKING_LEVEL,
  PLAN_SCHEMA,
  calculatePlanningBudget,
  validateGeminiPlanRequest,
  normaliseGeminiDraft,
  buildGeminiSystemPrompt,
  buildGeminiUserPrompt,
  buildGeminiRequestBody,
  getGeminiOutputText,
  resolveThinkingLevel,
  mapProviderError,
  generateGeminiPlanDraft,
};
