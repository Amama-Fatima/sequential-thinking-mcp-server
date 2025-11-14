import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sessionManager } from "../utils/session-manager.js";
import { ThinkingStep } from "../lib/types.js";
import { formatSessionSummary } from "../utils/formatter.js";
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
        const {
          thought,
          thought_number,
          total_thoughts,
          next_thought_needed = true,
          is_revision = false,
          revises_thought,
          branch_from_thought,
          session_id,
        } = args as {
          thought: string;
          thought_number: number;
          total_thoughts: number;
          next_thought_needed?: boolean;
          is_revision?: boolean;
          revises_thought?: number;
          branch_from_thought?: number;
          session_id?: string;
        };

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

        // Get or create session
        const session = sessionManager.getSession(session_id);

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
        sessionManager.storeThinkingStep(session, step);

        // Build response
        let responseText = `## Thought ${thought_number}/${total_thoughts}\n\n`;

        if (is_revision) {
          responseText += `**[Revision of thought ${revises_thought}]**\n\n`;
        }

        if (branch_from_thought !== undefined) {
          responseText += `**[Alternative branch from thought ${branch_from_thought}]**\n\n`;
        }

        responseText += `${thought}\n\n`;
        responseText += `---\n\n`;
        responseText += `**Session ID:** ${session.sessionId}\n`;
        responseText += `**Progress:** ${session.steps.length} steps completed\n`;

        if (next_thought_needed) {
          responseText += `**Status:** Continue thinking (${
            total_thoughts - thought_number
          } more thoughts estimated)\n`;
        } else {
          responseText += `**Status:** Thinking process complete\n\n`;
          responseText += formatSessionSummary(session);
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
