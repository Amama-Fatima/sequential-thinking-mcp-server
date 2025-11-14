export interface ThinkingStep {
  thought: string;
  thought_number: number;
  total_thoughts: number;
  timestamp: string;
  is_revision?: boolean;
  revises_thought?: number;
  branch_from_thought?: number;
}

export interface ThinkingSession {
  sessionId: string;
  steps: ThinkingStep[];
  branches: Map<number, ThinkingStep[]>;
  createdAt: string;
  lastUpdated: string;
}
