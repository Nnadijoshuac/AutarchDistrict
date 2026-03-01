import type { AgentDecision, AgentState, AgentStrategy } from "../types.js";

export class RandomSwapStrategy implements AgentStrategy {
  name = "randomSwap";

  constructor(private readonly maxAmount: number) {}

  decide(_state: AgentState): AgentDecision {
    const direction = Math.random() > 0.5 ? ("A_TO_B" as const) : ("B_TO_A" as const);
    const amount = Math.max(1, Math.floor(Math.random() * this.maxAmount));
    return {
      action: {
        kind: "swap" as const,
        direction,
        amount
      },
      confidence: 0.5,
      reason: "Fallback random policy."
    };
  }
}
