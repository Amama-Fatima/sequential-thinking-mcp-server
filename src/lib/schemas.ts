import { z } from "zod";

const sequentialThinkingSchema = z.object({
  thought: z
    .string()
    .describe("The current thinking step or reasoning content"),
  thought_number: z
    .number()
    .int()
    .positive()
    .describe("The sequence number of this thought (1-indexed)"),
  total_thoughts: z
    .number()
    .int()
    .positive()
    .describe("Estimated total number of thoughts needed (can be adjusted)"),
  next_thought_needed: z
    .boolean()
    .default(true)
    .describe("Whether additional thinking steps are required"),
  needs_more_thoughts: z
    .boolean()
    .default(false)
    .describe(
      "Indicator that more thoughts are needed even after reaching estimated total"
    ),
  is_revision: z
    .boolean()
    .default(false)
    .describe("Whether this thought revises a previous one"),
  revises_thought: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("The thought number being revised (if is_revision is true)"),
  branch_from_thought: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Create an alternative branch from this thought number"),
  branch_name: z
    .string()
    .optional()
    .describe(
      "Optional name for this branch (e.g., 'optimistic_path', 'alternative_approach')"
    ),
  session_id: z
    .string()
    .optional()
    .describe("Optional session ID to maintain context across multiple calls"),
  initial_query: z
    .string()
    .optional()
    .describe(
      "The original problem or query (used when starting a new session)"
    ),
});

const getThinkingSessionSchema = z.object({
  session_id: z.string().describe("The session ID to retrieve"),
});

const listThinkingSessionsSchema = z.object({});

const clearSessionSchema = z.object({
  session_id: z.string().describe("The session ID to clear/reset"),
});

const healthCheckSchema = z.object({
  include_sessions: z
    .boolean()
    .default(false)
    .describe("Include current session statistics in the health check"),
});

export {
  sequentialThinkingSchema,
  getThinkingSessionSchema,
  listThinkingSessionsSchema,
  clearSessionSchema,
  healthCheckSchema,
};
