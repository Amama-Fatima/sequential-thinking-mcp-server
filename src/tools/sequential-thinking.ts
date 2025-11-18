import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sessionManager } from "../utils/session-manager.js";
import { ThinkingStep } from "../lib/types.js";
import {
  formatSessionSummary,
  formatThinkingCapabilities,
} from "../utils/formatter.js";
import { sequentialThinkingToolDescription } from "../lib/descriptions.js";
import { sequentialThinkingSchema } from "../lib/schemas.js";

export function registerSequentialThinkingTool(server: McpServer) {
  server.registerTool(
    "sequential_thinking",
    {
      title: "Sequential Thinking Tool",
      description: sequentialThinkingToolDescription,
      inputSchema: sequentialThinkingSchema.shape,
    },
    async (args) => {
      try {
        // Pre-process the input to handle zero values before Zod validation
        const processedArgs = { ...args };

        // Remove fields that have value "0" or 0 before validation
        if (processedArgs.revises_thought === 0) {
          delete processedArgs.revises_thought;
        }

        if (processedArgs.branch_from_thought === 0) {
          delete processedArgs.branch_from_thought;
        }

        // Also handle boolean string conversions
        if (typeof processedArgs.is_revision === "string") {
          processedArgs.is_revision = processedArgs.is_revision === "true";
        }
        if (typeof processedArgs.needs_more_thoughts === "string") {
          processedArgs.needs_more_thoughts =
            processedArgs.needs_more_thoughts === "true";
        }
        if (typeof processedArgs.next_thought_needed === "string") {
          processedArgs.next_thought_needed =
            processedArgs.next_thought_needed === "true";
        }

        const parsed = sequentialThinkingSchema.parse(processedArgs);

        // Now all types are guaranteed correct
        const {
          thought,
          thought_number,
          total_thoughts,
          next_thought_needed,
          needs_more_thoughts,
          is_revision,
          revises_thought,
          branch_from_thought,
          branch_name,
          session_id,
          initial_query,
        } = parsed;

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
          };
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
          };
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
          };
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
          };
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
          };
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
          };
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
        };
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
        };
      }
    }
  );
}
