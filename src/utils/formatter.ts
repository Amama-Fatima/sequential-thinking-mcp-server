import { ThinkingSession } from "../types.js";

export function formatSessionSummary(session: ThinkingSession): string {
  let summary = `# Sequential Thinking Session: ${session.sessionId}\n\n`;
  summary += `Created: ${session.createdAt}\n`;
  summary += `Last Updated: ${session.lastUpdated}\n`;
  summary += `Total Steps: ${session.steps.length}\n`;
  summary += `Branches: ${session.branches.size}\n\n`;

  summary += `## Thinking Steps:\n\n`;
  session.steps.forEach((step) => {
    summary += `### Step ${step.thought_number}/${step.total_thoughts}\n`;
    if (step.is_revision) {
      summary += `*(Revision of step ${step.revises_thought})*\n`;
    }
    summary += `${step.thought}\n\n`;
  });

  if (session.branches.size > 0) {
    summary += `## Alternative Branches:\n\n`;
    session.branches.forEach((branchSteps, branchPoint) => {
      summary += `### Branch from Step ${branchPoint}:\n`;
      branchSteps.forEach((step) => {
        summary += `- Step ${step.thought_number}: ${step.thought}\n`;
      });
      summary += `\n`;
    });
  }

  return summary;
}
