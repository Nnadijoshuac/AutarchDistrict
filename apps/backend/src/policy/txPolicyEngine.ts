import { TransactionInstruction } from "@solana/web3.js";
import { SpendDb } from "./spendDb.js";
import type { PolicyProfile } from "./policyProfile.js";

export type PolicyViolationCode =
  | "DENY_PROGRAM_NOT_ALLOWED"
  | "DENY_MAX_SPEND"
  | "DENY_DAILY_LIMIT"
  | "DENY_SLIPPAGE_EXCEEDED";

export type PolicyViolationDetail = {
  code: PolicyViolationCode;
  message: string;
  agentId: string;
};

export class PolicyViolationError extends Error {
  constructor(public readonly detail: PolicyViolationDetail) {
    super(detail.message);
    this.name = "PolicyViolationError";
  }
}

export type PolicyTransaction = {
  instructions: TransactionInstruction[];
  lamports?: number;
  slippageBps?: number;
};

export class TxPolicyEngine {
  constructor(private readonly spendDb: SpendDb) {}

  assertTransaction(tx: PolicyTransaction, agentId: string, profile: PolicyProfile): void {
    this.assertPrograms(tx.instructions, agentId, profile);
    this.assertSpend(tx.lamports ?? 0, agentId, profile);
    this.assertSlippage(tx.slippageBps ?? 0, agentId, profile);

    if ((tx.lamports ?? 0) > 0) {
      this.spendDb.addDailySpend(agentId, tx.lamports ?? 0);
    }
  }

  private assertPrograms(
    instructions: TransactionInstruction[],
    agentId: string,
    profile: PolicyProfile
  ): void {
    const allowed = new Set(profile.allowedPrograms);
    for (const ix of instructions) {
      const pid = ix.programId.toBase58();
      if (!allowed.has(pid)) {
        throw new PolicyViolationError({
          code: "DENY_PROGRAM_NOT_ALLOWED",
          message: `Program not allowed: ${pid}`,
          agentId
        });
      }
    }
  }

  private assertSpend(lamports: number, agentId: string, profile: PolicyProfile): void {
    if (lamports > profile.maxLamportsPerTx) {
      throw new PolicyViolationError({
        code: "DENY_MAX_SPEND",
        message: `Amount exceeds maxLamportsPerTx: ${lamports}`,
        agentId
      });
    }

    const currentDaily = this.spendDb.getDailySpend(agentId);
    if (currentDaily + lamports > profile.maxDailyLamports) {
      throw new PolicyViolationError({
        code: "DENY_DAILY_LIMIT",
        message: `Daily limit exceeded: ${currentDaily + lamports}`,
        agentId
      });
    }
  }

  private assertSlippage(slippageBps: number, agentId: string, profile: PolicyProfile): void {
    if (slippageBps > profile.slippageBps) {
      throw new PolicyViolationError({
        code: "DENY_SLIPPAGE_EXCEEDED",
        message: `Slippage ${slippageBps} bps exceeds profile limit ${profile.slippageBps} bps`,
        agentId
      });
    }
  }
}
