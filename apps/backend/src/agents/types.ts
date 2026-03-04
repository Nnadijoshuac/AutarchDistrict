import type { PolicyProfile } from "../policy/policyProfile.js";

export type AgentState = {
  agentId: string;
  publicKey: string;
  strategy: string;
  policyProfile: PolicyProfile;
  lastStatus: "idle" | "running" | "stopped" | "error";
  lastError?: string;
  lastSignature?: string;
};
