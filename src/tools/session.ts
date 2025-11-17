import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sessionManager } from "../utils/session-manager.js";
import { formatSessionSummary } from "../utils/formatter.js";
import {
  getThinkingSessionToolDescription,
  listThinkingSessionToolDescription,
  clearSessionToolDescription,
} from "../lib/descriptions.js";
import {
  getThinkingSessionSchema,
  listThinkingSessionsSchema,
  clearSessionSchema,
} from "../lib/schemas.js";

export function registerSessionTools(server: McpServer) {
  // Get thinking session
  server.registerTool(
    "get_thinking_session",
    {
      title: "Get Thinking Session",
      description: getThinkingSessionToolDescription,
      inputSchema: getThinkingSessionSchema.shape,
    },
    async (args) => {
      try {
        const { session_id } = args as { session_id: string };

        if (!sessionManager.hasSession(session_id)) {
          return {
            content: [
              {
                type: "text",
                text: `Session not found: ${session_id}\n\nUse list_thinking_sessions to see available sessions.`,
              },
            ],
            isError: true,
          };
        }

        const session = sessionManager.getSession(session_id);
        const summary = formatSessionSummary(session);

        return {
          content: [
            {
              type: "text",
              text: summary,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving session: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // List all thinking sessions
  server.registerTool(
    "list_thinking_sessions",
    {
      title: "List Thinking Sessions",
      description: listThinkingSessionToolDescription,
      inputSchema: listThinkingSessionsSchema.shape,
    },
    async () => {
      try {
        const sessionCount = sessionManager.getSessionCount();

        if (sessionCount === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No thinking sessions found.\n\nCreate a new session by using the sequential_thinking tool.",
              },
            ],
          };
        }

        let responseText = `# Available Thinking Sessions\n\n`;
        responseText += `**Total sessions:** ${sessionCount}\n\n`;
        responseText += `---\n\n`;

        const sessions = sessionManager.getAllSessions();

        // Sort by last updated (most recent first)
        sessions.sort(
          (a, b) =>
            new Date(b.lastUpdated).getTime() -
            new Date(a.lastUpdated).getTime()
        );

        sessions.forEach((session, index) => {
          const stats = sessionManager.getSessionStats(session);

          responseText += `## ${index + 1}. ${session.sessionId}\n\n`;

          if (session.initialQuery) {
            responseText += `**Query:** ${session.initialQuery}\n`;
          }

          responseText += `**Status:** ${
            session.metadata?.isComplete ? "✅ Complete" : "🔄 In Progress"
          }\n`;
          responseText += `**Created:** ${new Date(
            session.createdAt
          ).toLocaleString()}\n`;
          responseText += `**Last Updated:** ${new Date(
            session.lastUpdated
          ).toLocaleString()}\n`;
          responseText += `**Main Path Steps:** ${stats.mainPathLength}\n`;
          responseText += `**Total Steps:** ${stats.totalSteps}\n`;
          responseText += `**Revisions:** ${stats.totalRevisions}\n`;
          responseText += `**Branches:** ${stats.totalBranches}\n\n`;

          if (index < sessions.length - 1) {
            responseText += `---\n\n`;
          }
        });

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
              text: `Error listing sessions: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Clear thinking session
  server.registerTool(
    "clear_thinking_session",
    {
      title: "Clear Thinking Session",
      description: clearSessionToolDescription,
      inputSchema: clearSessionSchema.shape,
    },
    async (args) => {
      try {
        const { session_id } = args as { session_id: string };

        if (!sessionManager.hasSession(session_id)) {
          return {
            content: [
              {
                type: "text",
                text: `Session not found: ${session_id}\n\nUse list_thinking_sessions to see available sessions.`,
              },
            ],
            isError: true,
          };
        }

        const deleted = sessionManager.clearSession(session_id);

        if (deleted) {
          return {
            content: [
              {
                type: "text",
                text: `✅ Session ${session_id} has been cleared successfully.\n\nAll thinking steps, revisions, and branches have been permanently removed.`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Failed to clear session: ${session_id}`,
              },
            ],
            isError: true,
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error clearing session: ${
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
