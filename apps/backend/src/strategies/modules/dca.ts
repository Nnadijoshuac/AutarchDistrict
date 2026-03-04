import { PublicKey } from "@solana/web3.js";
import type { Strategy, StrategyContext, StrategyDecision } from "../strategy.js";

export class DcaStrategy implements Strategy {
  name = "dca";

  constructor(private readonly fixedAmount: number) {}

  async nextAction(context: StrategyContext): Promise<StrategyDecision> {
    const amount = Math.max(1, this.fixedAmount);
    const ix = context.protocol.buildSwapInstruction(new PublicKey(context.publicKey), "A_TO_B", amount);

    return {
      action: [ix],
      actionLabel: `swap:A_TO_B:${amount}`,
      rationale: `DCA strategy executes steady buy-side exposure with fixed amount ${amount}.`,
      riskScore: 0.25
    };
  }
}
