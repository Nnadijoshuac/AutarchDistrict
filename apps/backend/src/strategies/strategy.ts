import type { TransactionInstruction } from "@solana/web3.js";
import type { PolicyProfile } from "../policy/policyProfile.js";
import type { MockDefiClient } from "../protocol/mockDefiClient.js";

export type StrategyDecision = {
  action: TransactionInstruction[];
  actionLabel: string;
  rationale: string;
  riskScore: number;
};

export type StrategyContext = {
  agentId: string;
  publicKey: string;
  policyProfile: PolicyProfile;
  protocol: MockDefiClient;
};

export interface Strategy {
  name: string;
  nextAction(context: StrategyContext): Promise<StrategyDecision | null>;
}
