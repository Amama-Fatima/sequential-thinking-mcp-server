import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sessionManager } from "../utils/session-manager.js";
import { ThinkingStep } from "../lib/types.js";
import {
  formatSessionSummary,
  formatThinkingCapabilities,
} from "../utils/formatter.js";
import { sequentialThinkingToolDescription } from "../lib/descriptions.js";

export function registerSequentialThinkingTool(server: McpServer) {
  server.registerTool(
    "sequential_thinking",
    {
      title: "Sequential Thinking Tool",
      description: sequentialThinkingToolDescription,
      inputSchema: {
        type: "object",
        properties: {
          thought: {
            type: "string",
            description: "The content of the current thought or reasoning step",
          },
          thought_number: {
            oneOf: [{ type: "number" }, { type: "string" }],
            description:
              "The current thought number (1-indexed). Can be provided as a number or string.",
          },
          total_thoughts: {
            oneOf: [{ type: "number" }, { type: "string" }],
            description:
              "The estimated total number of thoughts needed. Can be adjusted if needs_more_thoughts is true. Can be provided as a number or string.",
          },
          next_thought_needed: {
            oneOf: [{ type: "boolean" }, { type: "string" }],
            description:
              "Whether another thought is needed after this one. Defaults to true.",
            default: true,
          },
          needs_more_thoughts: {
            oneOf: [{ type: "boolean" }, { type: "string" }],
            description:
              "Set to true if you realize you need more thoughts than initially estimated. Defaults to false.",
            default: false,
          },
          is_revision: {
            oneOf: [{ type: "boolean" }, { type: "string" }],
            description:
              "Set to true if this thought revises a previous thought. Defaults to false.",
            default: false,
          },
          revises_thought: {
            oneOf: [{ type: "number" }, { type: "string" }],
            description:
              "If is_revision is true, specify which thought number is being revised. Can be provided as a number or string.",
          },
          branch_from_thought: {
            oneOf: [{ type: "number" }, { type: "string" }],
            description:
              "To create an alternative reasoning path, specify which thought number to branch from. Can be provided as a number or string.",
          },
          branch_name: {
            type: "string",
            description:
              "Optional name for the alternative branch being created",
          },
          session_id: {
            type: "string",
            description:
              "Optional session ID to continue a previous thinking session",
          },
          initial_query: {
            type: "string",
            description:
              "The original query or problem being solved (used when starting a new session)",
          },
        },
        required: ["thought", "thought_number", "total_thoughts"],
      } as any,
    },
    async (args: any) => {
      try {
        // Handle all type coercion manually for maximum flexibility
        const processedArgs = { ...args };

        // Coerce thought_number to number
        let thought_number = 1;
        if (processedArgs.thought_number !== undefined) {
          thought_number = Number(processedArgs.thought_number);
          if (isNaN(thought_number)) thought_number = 1;
        }

        // Coerce total_thoughts to number
        let total_thoughts = thought_number;
        if (processedArgs.total_thoughts !== undefined) {
          total_thoughts = Number(processedArgs.total_thoughts);
          if (isNaN(total_thoughts)) total_thoughts = thought_number;
        }

        // Coerce revises_thought to number or undefined
        let revises_thought: number | undefined = undefined;
        if (
          processedArgs.revises_thought !== undefined &&
          processedArgs.revises_thought !== 0 &&
          processedArgs.revises_thought !== "0"
        ) {
          const parsed = Number(processedArgs.revises_thought);
          if (!isNaN(parsed) && parsed > 0) {
            revises_thought = parsed;
          }
        }

        // Coerce branch_from_thought to number or undefined
        let branch_from_thought: number | undefined = undefined;
        if (
          processedArgs.branch_from_thought !== undefined &&
          processedArgs.branch_from_thought !== 0 &&
          processedArgs.branch_from_thought !== "0"
        ) {
          const parsed = Number(processedArgs.branch_from_thought);
          if (!isNaN(parsed) && parsed > 0) {
            branch_from_thought = parsed;
          }
        }

        // Coerce boolean values
        const is_revision =
          processedArgs.is_revision === true ||
          processedArgs.is_revision === "true";
        const needs_more_thoughts =
          processedArgs.needs_more_thoughts === true ||
          processedArgs.needs_more_thoughts === "true";
        const next_thought_needed =
          processedArgs.next_thought_needed === true ||
          processedArgs.next_thought_needed === "true" ||
          processedArgs.next_thought_needed === undefined;

        // Get string values
        const thought = String(processedArgs.thought || "");
        const branch_name = processedArgs.branch_name
          ? String(processedArgs.branch_name)
          : undefined;
        const session_id = processedArgs.session_id
          ? String(processedArgs.session_id)
          : undefined;
        const initial_query = processedArgs.initial_query
          ? String(processedArgs.initial_query)
          : undefined;

        // Validate input
        if (!thought || thought.trim().length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Error: Thought content cannot be empty",
              },
            ],
            isError: true,
          } as any;
        }

        if (thought_number < 1) {
          return {
            content: [
              {
                type: "text",
                text: "Error: thought_number must be at least 1",
              },
            ],
            isError: true,
          } as any;
        }

        if (total_thoughts < thought_number) {
          return {
            content: [
              {
                type: "text",
                text: "Error: total_thoughts must be >= thought_number",
              },
            ],
            isError: true,
          } as any;
        }

        if (
          is_revision &&
          (revises_thought === undefined || revises_thought < 1)
        ) {
          return {
            content: [
              {
                type: "text",
                text: "Error: revises_thought must be specified when is_revision is true",
              },
            ],
            isError: true,
          } as any;
        }

        if (
          is_revision &&
          revises_thought &&
          revises_thought > thought_number
        ) {
          return {
            content: [
              {
                type: "text",
                text: "Error: cannot revise a future thought. revises_thought must be <= current thought_number",
              },
            ],
            isError: true,
          } as any;
        }

        // Get or create session
        const session = sessionManager.getSession(session_id, initial_query);

        // Create thinking step
        const step: ThinkingStep = {
          thought,
          thought_number,
          total_thoughts,
          timestamp: new Date().toISOString(),
          is_revision,
          revises_thought,
          branch_from_thought,
        };

        // Store the step
        const storeResult = sessionManager.storeThinkingStep(
          session,
          step,
          branch_name
        );

        if (!storeResult.success) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${storeResult.error}`,
              },
            ],
            isError: true,
          } as any;
        }

        // Update completion status
        const isComplete = !next_thought_needed && !needs_more_thoughts;
        sessionManager.updateSessionMetadata(session, isComplete);

        // Build response
        let responseText = `## Thought ${thought_number}/${total_thoughts}\n\n`;

        if (is_revision) {
          responseText += `**[Revision of thought ${revises_thought}]**\n`;
          responseText += `*Previous versions are preserved in revision history*\n\n`;
        }

        if (branch_from_thought !== undefined) {
          responseText += `**[Alternative branch from thought ${branch_from_thought}`;
          if (branch_name) {
            responseText += ` - "${branch_name}"`;
          }
          responseText += `]**\n\n`;
        }

        responseText += `${thought}\n\n`;
        responseText += `---\n\n`;

        const stats = sessionManager.getSessionStats(session);
        responseText += `**Session ID:** ${session.sessionId}\n`;
        responseText += `**Main Path Progress:** ${stats.mainPathLength} steps\n`;
        responseText += `**Total Steps (including branches):** ${stats.totalSteps}\n`;
        responseText += `**Revisions Made:** ${stats.totalRevisions}\n`;
        responseText += `**Active Branches:** ${stats.totalBranches}\n\n`;

        if (needs_more_thoughts) {
          responseText += `**Status:** ⚠️ More thoughts needed beyond initial estimate\n`;
          responseText += `*You can increase total_thoughts in the next call*\n\n`;
        } else if (next_thought_needed) {
          responseText += `**Status:** Continue thinking (${
            total_thoughts - thought_number
          } more thoughts estimated)\n\n`;
        } else {
          responseText += `**Status:** ✅ Thinking process complete\n\n`;
          responseText += `---\n\n`;
          responseText += formatSessionSummary(session);
        }

        // Add capabilities reminder
        if (next_thought_needed || needs_more_thoughts) {
          responseText += formatThinkingCapabilities(
            thought_number,
            total_thoughts
          );
        }

        return {
          content: [
            {
              type: "text",
              text: responseText,
            },
          ],
        } as any;
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error in sequential thinking: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        } as any;
      }
    }
  );
}
