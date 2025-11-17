const sequentialThinkingToolDescription = `
Adaptive multi-step reflective reasoning tool for complex problem-solving.

This tool enables dynamic thinking processes where you can:
- Break down complex problems into sequential steps
- Adjust the total number of thoughts as understanding deepens (increase or decrease total_thoughts)
- Revise previous thoughts when new insights emerge (maintains revision history)
- Branch into alternative reasoning paths with optional naming
- Express uncertainty and explore different approaches
- Maintain context across multiple thinking steps
- Continue thinking even after reaching estimated total using needs_more_thoughts

The tool supports non-linear progress and iterative refinement, allowing for a natural problem-solving flow that adapts as you work through challenges.

Key parameters:
- next_thought_needed: Whether you need to continue (normal flow control)
- needs_more_thoughts: Signal that you need additional thoughts beyond the original estimate
- is_revision: Mark this as a revision of previous thinking
- branch_from_thought: Explore alternative paths from a specific thought

You can revise any previous thought (1 to current thought_number) and branch from any existing step.`;

const getThinkingSessionToolDescription = `
Retrieve the complete history of a sequential thinking session.

Returns all thinking steps, revisions, and branches for the specified session.
Includes metadata about the session's progress and structure.`;

const listThinkingSessionToolDescription = `
List all available sequential thinking sessions.

Shows session IDs, creation times, step counts, and completion status.
Useful for managing multiple parallel thinking processes.`;

const clearSessionToolDescription = `
Clear and reset a sequential thinking session.

Permanently removes all thinking steps and branches for the specified session.
Use this to start fresh or clean up completed sessions.`;

const healthCheckDescription = `
Health check tool for the Sequential Thinking MCP Server.

Returns server status, version information, available tools, and optionally current session statistics.
Use this to verify the server is running correctly before performing thinking operations.`;

export {
  sequentialThinkingToolDescription,
  getThinkingSessionToolDescription,
  listThinkingSessionToolDescription,
  clearSessionToolDescription,
  healthCheckDescription,
};
