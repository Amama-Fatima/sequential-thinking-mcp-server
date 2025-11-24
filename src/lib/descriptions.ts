const sequentialThinkingToolDescription = `
Enables sequential, step-by-step reasoning for complex problem-solving. Break down problems into numbered thoughts that build on each other. Supports revising previous thoughts and exploring alternative reasoning paths (branches).

REQUIRED parameters:
- thought (string): The content of this reasoning step
- thought_number (integer): Current step number, must be a positive integer (1-indexed), NOT a string
- total_thoughts (integer): Estimated total steps needed, must be a positive integer, NOT a string
- next_thought_needed (boolean): Set true to continue thinking, false when reasoning is complete

OPTIONAL parameters:
- needs_more_thoughts (boolean, default: false): Set true if you need more steps than originally estimated
- is_revision (boolean, default: false): Set true if revising a previous thought
- revises_thought (integer): Which thought number to revise (required if is_revision=true), must be a positive integer
- branch_from_thought (integer): Create alternative path from this thought number, must be a positive integer
- branch_name (string): Optional name for the alternative branch
- session_id (string): Continue existing session (auto-generated if omitted)
- initial_query (string): The original problem being solved

Example: {"thought": "First, analyze the requirements", "thought_number": 1, "total_thoughts": 5, "next_thought_needed": true}`;

const getThinkingSessionToolDescription = `
Retrieves the complete history and structure of a thinking session, including all thoughts, revisions, and alternative branches.

REQUIRED parameters:
- session_id (string): The ID of the session to retrieve

Returns: Full session details with all thinking steps, revision history, branch structure, and session metadata.`;

const listThinkingSessionToolDescription = `
Lists all available thinking sessions with their status, creation time, and progress statistics.

NO parameters required (pass empty object {})

Returns: List of all sessions showing session IDs, completion status, step counts, revisions, and branches. Sorted by most recently updated.`;

const clearSessionToolDescription = `
Permanently deletes a thinking session and all its data including thoughts, revisions, and branches. Cannot be undone.

REQUIRED parameters:
- session_id (string): The ID of the session to delete

Returns: Confirmation message on successful deletion.`;

const healthCheckDescription = `
Verifies the MCP server is running and returns server status, version, and available tools.

OPTIONAL parameters:
- include_sessions (boolean, default: false): Include current session count and statistics in the response

Returns: Server health status, version number, list of available tools, and optionally session statistics.`;

export {
  sequentialThinkingToolDescription,
  getThinkingSessionToolDescription,
  listThinkingSessionToolDescription,
  clearSessionToolDescription,
  healthCheckDescription,
};
