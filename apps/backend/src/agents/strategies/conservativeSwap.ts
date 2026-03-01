import type { AgentDecision, AgentState, AgentStrategy } from "../types.js";

export class ConservativeSwapStrategy implements AgentStrategy {
  name = "conservativeSwap";
  private failures = new Map<string, number>();

  constructor(private readonly fixedAmount: number) {}

  decide(state: AgentState): AgentDecision {
    const count = this.failures.get(state.agentId) ?? 0;
    if (count >= 3) {
      return {
        action: null,
        confidence: 0.85,
        reason: "Circuit-breaker active after repeated failures."
      };
    }
    if (state.lastStatus === "error") {
      this.failures.set(state.agentId, count + 1);
    }

    return {
      action: {
        kind: "swap" as const,
        direction: "A_TO_B" as const,
        amount: this.fixedAmount
      },
      confidence: 0.8,
      reason: "Conservative fixed-size strategy."
    };
  }
}
