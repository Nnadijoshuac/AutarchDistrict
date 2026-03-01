export type AgentDirection = "A_TO_B" | "B_TO_A";

export type AgentAction = {
  kind: "swap";
  direction: AgentDirection;
  amount: number;
};

export type AgentDecision = {
  action: AgentAction | null;
  confidence: number;
  reason: string;
};

export type AgentState = {
  agentId: string;
  publicKey: string;
  strategy: string;
  lastStatus: "idle" | "running" | "stopped" | "error";
  lastError?: string;
  lastSignature?: string;
};

export interface AgentStrategy {
  name: string;
  decide(state: AgentState): AgentDecision;
}
