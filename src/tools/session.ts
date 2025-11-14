import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sessionManager } from "../session-manager.js";
import { formatSessionSummary } from "../utils/formatter.js";
import {
  getThinkingSessionToolDescription,
  listThinkingSessionToolDescription,
} from "../lib/descriptions.js";
import {
  getThinkingSessionSchema,
  listThinkingSessionsSchema,
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
                text: `Session not found: ${session_id}`,
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
                text: "No thinking sessions found.",
              },
            ],
          };
        }

        let responseText = `# Available Thinking Sessions\n\n`;
        responseText += `Total sessions: ${sessionCount}\n\n`;

        const sessions = sessionManager.getAllSessions();
        sessions.forEach((session) => {
          responseText += `## ${session.sessionId}\n`;
          responseText += `- Created: ${session.createdAt}\n`;
          responseText += `- Last Updated: ${session.lastUpdated}\n`;
          responseText += `- Steps: ${session.steps.length}\n`;
          responseText += `- Branches: ${session.branches.size}\n\n`;
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
}
