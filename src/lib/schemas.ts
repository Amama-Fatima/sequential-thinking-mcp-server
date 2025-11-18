import { z } from "zod";

const sequentialThinkingSchema = z.object({
  thought: z.string(),

  thought_number: z.coerce.number().int().positive(),
  total_thoughts: z.coerce.number().int().positive(),

  next_thought_needed: z.coerce.boolean().default(true),
  needs_more_thoughts: z.coerce.boolean().default(false),
  is_revision: z.coerce.boolean().default(false),

  revises_thought: z.coerce.number().int().positive().optional(),
  branch_from_thought: z.coerce.number().int().positive().optional(),

  branch_name: z.string().optional(),
  session_id: z.string().optional(),
  initial_query: z.string().optional(),
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
