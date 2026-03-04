import { PublicKey } from "@solana/web3.js";
import type { Strategy, StrategyContext, StrategyDecision } from "../../strategies/strategy.js";

export class ConservativeSwapStrategy implements Strategy {
  name = "conservativeSwap";
  private failures = new Map<string, number>();

  constructor(private readonly fixedAmount: number) {}

  async nextAction(context: StrategyContext): Promise<StrategyDecision | null> {
    const count = this.failures.get(context.agentId) ?? 0;
    if (count >= 3) {
      return null;
    }
    this.failures.set(context.agentId, count);

    const ix = context.protocol.buildSwapInstruction(
      new PublicKey(context.publicKey),
      "A_TO_B",
      this.fixedAmount
    );

    return {
      action: [ix],
      actionLabel: `swap:A_TO_B:${this.fixedAmount}`,
      rationale: `Conservative strategy executed fixed-size A_TO_B swap (${this.fixedAmount}).`,
      riskScore: 0.2
    };
  }
}
