import { ThinkingSession, ThinkingStep } from "../lib/types.js";

const MAX_SESSIONS = 100;
const MAX_STEPS_PER_SESSION = 1000;

class SessionManager {
  private sessions = new Map<string, ThinkingSession>();

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  getSession(sessionId?: string, initialQuery?: string): ThinkingSession {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    // Check session limit
    if (this.sessions.size >= MAX_SESSIONS) {
      // Remove oldest session
      const oldestSession = Array.from(this.sessions.values()).sort(
        (a, b) =>
          new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
      )[0];
      this.sessions.delete(oldestSession.sessionId);
    }

    const newSessionId = sessionId || this.generateSessionId();
    const newSession: ThinkingSession = {
      sessionId: newSessionId,
      steps: [],
      branches: new Map(),
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      initialQuery,
      metadata: {
        totalRevisions: 0,
        totalBranches: 0,
        isComplete: false,
      },
    };

    this.sessions.set(newSessionId, newSession);
    return newSession;
  }

  storeThinkingStep(
    session: ThinkingSession,
    step: ThinkingStep,
    branchName?: string
  ): { success: boolean; error?: string } {
    // Check step limit
    const totalSteps =
      session.steps.length +
      Array.from(session.branches.values()).reduce(
        (sum, branch) => sum + branch.length,
        0
      );

    if (totalSteps >= MAX_STEPS_PER_SESSION) {
      return {
        success: false,
        error: `Session has reached maximum size of ${MAX_STEPS_PER_SESSION} steps`,
      };
    }

    session.lastUpdated = new Date().toISOString();

    if (step.branch_from_thought !== undefined) {
      // Validate branch point exists
      const branchPointExists = session.steps.some(
        (s) => s.thought_number === step.branch_from_thought
      );

      if (!branchPointExists) {
        return {
          success: false,
          error: `Cannot branch from thought ${step.branch_from_thought}: thought does not exist`,
        };
      }

      // Store as a branch
      const branchKey = branchName
        ? `${step.branch_from_thought}_${branchName}`
        : step.branch_from_thought.toString();

      if (!session.branches.has(step.branch_from_thought)) {
        session.branches.set(step.branch_from_thought, []);
        session.metadata!.totalBranches++;
      }
      session.branches.get(step.branch_from_thought)!.push(step);
    } else if (step.is_revision && step.revises_thought !== undefined) {
      // Validate revision target exists
      const idx = session.steps.findIndex(
        (s) => s.thought_number === step.revises_thought
      );

      if (idx === -1) {
        return {
          success: false,
          error: `Cannot revise thought ${step.revises_thought}: thought does not exist`,
        };
      }

      // Store revision history
      const originalStep = session.steps[idx];
      if (!originalStep.revisions) {
        originalStep.revisions = [];
      }
      originalStep.revisions.push(step);
      originalStep.revised_by = step.thought_number;

      // Also add revision as a new step to maintain sequence
      session.steps.push(step);
      session.metadata!.totalRevisions++;
    } else {
      // Validate thought_number sequence
      const existingStep = session.steps.find(
        (s) => s.thought_number === step.thought_number
      );

      if (existingStep && !step.is_revision) {
        return {
          success: false,
          error: `Thought number ${step.thought_number} already exists. Use is_revision=true to revise it.`,
        };
      }

      // Add as regular step
      session.steps.push(step);
    }

    return { success: true };
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getAllSessions(): ThinkingSession[] {
    return Array.from(this.sessions.values());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  clearSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  updateSessionMetadata(session: ThinkingSession, isComplete: boolean): void {
    if (session.metadata) {
      session.metadata.isComplete = isComplete;
    }
  }

  getSessionStats(session: ThinkingSession): {
    totalSteps: number;
    totalRevisions: number;
    totalBranches: number;
    mainPathLength: number;
  } {
    const totalBranchSteps = Array.from(session.branches.values()).reduce(
      (sum, branch) => sum + branch.length,
      0
    );

    return {
      totalSteps: session.steps.length + totalBranchSteps,
      totalRevisions: session.metadata?.totalRevisions || 0,
      totalBranches: session.metadata?.totalBranches || 0,
      mainPathLength: session.steps.length,
    };
  }
}

export const sessionManager = new SessionManager();
