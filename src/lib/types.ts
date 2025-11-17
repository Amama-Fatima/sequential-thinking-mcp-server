export interface ThinkingStep {
  thought: string;
  thought_number: number;
  total_thoughts: number;
  timestamp: string;
  is_revision?: boolean;
  revises_thought?: number;
  branch_from_thought?: number;
  revised_by?: number; // Track if this step was later revised
  revisions?: ThinkingStep[]; // Store revision history
}

export interface ThinkingSession {
  sessionId: string;
  steps: ThinkingStep[];
  branches: Map<number, ThinkingStep[]>;
  createdAt: string;
  lastUpdated: string;
  initialQuery?: string; // Store the original problem/query
  metadata?: {
    totalRevisions: number;
    totalBranches: number;
    isComplete: boolean;
  };
}
