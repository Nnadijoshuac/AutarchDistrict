import { PublicKey } from "@solana/web3.js";
import type { Strategy, StrategyContext, StrategyDecision } from "../strategy.js";

export class RandomSwapStrategy implements Strategy {
  name = "randomSwap";

  constructor(private readonly maxAmount: number) {}

  async nextAction(context: StrategyContext): Promise<StrategyDecision> {
    const direction = Math.random() > 0.5 ? ("A_TO_B" as const) : ("B_TO_A" as const);
    const amount = Math.max(1, Math.floor(Math.random() * this.maxAmount));
    const ix = context.protocol.buildSwapInstruction(new PublicKey(context.publicKey), direction, amount);
    const riskScore = amount > this.maxAmount * 0.6 ? 0.65 : 0.35;

    return {
      action: [ix],
      actionLabel: `swap:${direction}:${amount}`,
      rationale: `Randomized swap execution selected ${direction} with amount ${amount}.`,
      riskScore
    };
  }
}
