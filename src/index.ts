#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSequentialThinkingTool } from "./tools/sequential-thinking.js";
import { registerSessionTools } from "./tools/session.js";

const server = new McpServer({
  name: "sequential-thinking-mcp",
  version: "1.0.0",
});

registerSequentialThinkingTool(server);
registerSessionTools(server);

(async () => {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Sequential Thinking MCP Server running on stdio");
  } catch (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
})();
