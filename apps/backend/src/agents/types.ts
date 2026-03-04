import type { PolicyProfile } from "../policy/policyProfile.js";

export type AgentDirection = "A_TO_B" | "B_TO_A";

export type AgentAction = {
  kind: "swap";
  direction: AgentDirection;
  amount: number;
};

export type AgentState = {
  agentId: string;
  publicKey: string;
  strategy: string;
  policyProfile: PolicyProfile;
  lastStatus: "idle" | "running" | "stopped" | "error";
  lastError?: string;
  lastSignature?: string;
};

export interface AgentStrategy {
  name: string;
  nextAction(state: AgentState): AgentAction | null;
}
