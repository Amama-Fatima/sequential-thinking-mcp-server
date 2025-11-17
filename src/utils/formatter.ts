import { ThinkingSession, ThinkingStep } from "../lib/types.js";

export function formatSessionSummary(session: ThinkingSession): string {
  let summary = `# Sequential Thinking Session: ${session.sessionId}\n\n`;

  if (session.initialQuery) {
    summary += `**Initial Query:** ${session.initialQuery}\n\n`;
  }

  summary += `**Created:** ${session.createdAt}\n`;
  summary += `**Last Updated:** ${session.lastUpdated}\n`;
  summary += `**Status:** ${
    session.metadata?.isComplete ? "Complete" : "In Progress"
  }\n`;
  summary += `**Main Path Steps:** ${session.steps.length}\n`;
  summary += `**Total Revisions:** ${session.metadata?.totalRevisions || 0}\n`;
  summary += `**Total Branches:** ${session.metadata?.totalBranches || 0}\n\n`;

  summary += `---\n\n`;
  summary += `## Main Thinking Path:\n\n`;

  session.steps.forEach((step) => {
    summary += `### Step ${step.thought_number}/${step.total_thoughts}`;

    if (step.revised_by) {
      summary += ` ⚠️ (Revised by step ${step.revised_by})`;
    }

    summary += `\n`;

    if (step.is_revision) {
      summary += `**[Revision of step ${step.revises_thought}]**\n`;
    }

    summary += `*Timestamp: ${step.timestamp}*\n\n`;
    summary += `${step.thought}\n\n`;

    // Show revision history if exists
    if (step.revisions && step.revisions.length > 0) {
      summary += `**Revision History:**\n`;
      step.revisions.forEach((revision, idx) => {
        summary += `  ${idx + 1}. (${
          revision.timestamp
        }) ${revision.thought.substring(0, 100)}${
          revision.thought.length > 100 ? "..." : ""
        }\n`;
      });
      summary += `\n`;
    }
  });

  if (session.branches.size > 0) {
    summary += `---\n\n`;
    summary += `## Alternative Branches:\n\n`;

    session.branches.forEach((branchSteps, branchPoint) => {
      summary += `### Branch from Step ${branchPoint}:\n\n`;
      branchSteps.forEach((step) => {
        summary += `**Step ${step.thought_number}** (${step.timestamp}):\n`;
        summary += `${step.thought}\n\n`;
      });
      summary += `---\n\n`;
    });
  }

  return summary;
}

export function formatThinkingCapabilities(
  currentThoughtNumber: number,
  totalThoughts: number
): string {
  let capabilities = `\n**Available Actions:**\n`;
  capabilities += `- 📊 Adjust total_thoughts (currently ${totalThoughts}) up or down as needed\n`;
  capabilities += `- 🔄 Revise any previous thought (1-${currentThoughtNumber})\n`;
  capabilities += `- 🌿 Branch from any step to explore alternatives\n`;
  capabilities += `- ➕ Use needs_more_thoughts=true if you need to continue beyond ${totalThoughts}\n`;
  capabilities += `- ❓ Express uncertainty and explore different approaches\n`;

  return capabilities;
}
