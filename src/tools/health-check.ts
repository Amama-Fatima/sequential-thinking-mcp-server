import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sessionManager } from "../utils/session-manager.js";
import { healthCheckDescription } from "../lib/descriptions.js";
import { healthCheckSchema } from "../lib/schemas.js";

export function registerHealthCheckTool(server: McpServer) {
  server.registerTool(
    "health_check",
    {
      title: "Health Check",
      description: healthCheckDescription,
      inputSchema: healthCheckSchema.shape,
    },
    async (args) => {
      try {
        const { include_sessions = false } = args as {
          include_sessions?: boolean;
        };

        const timestamp = new Date().toISOString();
        const sessionCount = sessionManager.getSessionCount();

        let responseText = `# 🏥 Sequential Thinking MCP Server - Health Check\n\n`;
        responseText += `**Status:** ✅ Healthy\n`;
        responseText += `**Timestamp:** ${timestamp}\n`;
        responseText += `**Version:** 1.0.0\n\n`;

        responseText += `---\n\n`;

        responseText += `## 🛠️ Available Tools\n\n`;
        responseText += `1. **sequential_thinking** - Main adaptive thinking tool\n`;
        responseText += `   - Break down complex problems into steps\n`;
        responseText += `   - Support for revisions and branching\n`;
        responseText += `   - Dynamic thought estimation\n\n`;

        responseText += `2. **get_thinking_session** - Retrieve session history\n`;
        responseText += `   - View complete thinking process\n`;
        responseText += `   - See revisions and branches\n\n`;

        responseText += `3. **list_thinking_sessions** - List all sessions\n`;
        responseText += `   - Overview of all thinking sessions\n`;
        responseText += `   - Session statistics and status\n\n`;

        responseText += `4. **clear_thinking_session** - Clear a session\n`;
        responseText += `   - Remove completed sessions\n`;
        responseText += `   - Clean up resources\n\n`;

        responseText += `5. **health_check** - Server health status\n`;
        responseText += `   - Verify server connectivity\n`;
        responseText += `   - Check system status\n\n`;

        responseText += `---\n\n`;

        responseText += `## 📊 Server Statistics\n\n`;
        responseText += `**Active Sessions:** ${sessionCount}\n`;
        responseText += `**Session Limit:** 100 sessions\n`;
        responseText += `**Per-Session Limit:** 1000 steps\n\n`;

        if (include_sessions && sessionCount > 0) {
          responseText += `---\n\n`;
          responseText += `## 📁 Current Sessions Overview\n\n`;

          const sessions = sessionManager.getAllSessions();
          sessions.forEach((session, index) => {
            const stats = sessionManager.getSessionStats(session);
            responseText += `${index + 1}. **${session.sessionId}**\n`;
            responseText += `   - Status: ${
              session.metadata?.isComplete ? "Complete" : "In Progress"
            }\n`;
            responseText += `   - Steps: ${stats.totalSteps}\n`;
            responseText += `   - Revisions: ${stats.totalRevisions}\n`;
            responseText += `   - Branches: ${stats.totalBranches}\n\n`;
          });
        }

        responseText += `---\n\n`;

        responseText += `## ✨ Quick Start\n\n`;
        responseText += `To start using the sequential thinking tool:\n\n`;
        responseText += `\`\`\`\n`;
        responseText += `Use sequential_thinking with:\n`;
        responseText += `- thought: "Your first thinking step"\n`;
        responseText += `- thought_number: 1\n`;
        responseText += `- total_thoughts: 5 (estimate, adjustable)\n`;
        responseText += `- initial_query: "Your problem description"\n`;
        responseText += `\`\`\`\n\n`;

        responseText += `## 🔍 Capabilities\n\n`;
        responseText += `✅ Adaptive thinking (adjust total_thoughts dynamically)\n`;
        responseText += `✅ Revision support (preserve history)\n`;
        responseText += `✅ Branch exploration (alternative paths)\n`;
        responseText += `✅ Session persistence (maintain context)\n`;
        responseText += `✅ Non-linear reasoning (backtrack and iterate)\n`;
        responseText += `✅ Comprehensive validation (helpful error messages)\n\n`;

        responseText += `---\n\n`;
        responseText += `**Server is ready for sequential thinking operations! 🚀**\n`;

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
              text: `❌ Health check failed: ${
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
