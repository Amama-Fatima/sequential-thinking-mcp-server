import { ThinkingSession, ThinkingStep } from "./types.js";

class SessionManager {
  private sessions = new Map<string, ThinkingSession>();

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  getSession(sessionId?: string): ThinkingSession {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    const newSessionId = sessionId || this.generateSessionId();
    const newSession: ThinkingSession = {
      sessionId: newSessionId,
      steps: [],
      branches: new Map(),
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    this.sessions.set(newSessionId, newSession);
    return newSession;
  }

  storeThinkingStep(session: ThinkingSession, step: ThinkingStep): void {
    session.lastUpdated = new Date().toISOString();

    if (step.branch_from_thought !== undefined) {
      // Store as a branch
      if (!session.branches.has(step.branch_from_thought)) {
        session.branches.set(step.branch_from_thought, []);
      }
      session.branches.get(step.branch_from_thought)!.push(step);
    } else if (step.is_revision && step.revises_thought !== undefined) {
      // Update the revised thought
      const idx = session.steps.findIndex(
        (s) => s.thought_number === step.revises_thought
      );
      if (idx !== -1) {
        session.steps[idx] = step;
      }
    } else {
      // Add as regular step
      session.steps.push(step);
    }
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
}

export const sessionManager = new SessionManager();
