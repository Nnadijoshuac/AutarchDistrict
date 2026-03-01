import type { AgentDecision, AgentState, AgentStrategy } from "../types.js";

export class HeuristicAiSwapStrategy implements AgentStrategy {
  name = "heuristicAiSwap";

  private readonly history = new Map<string, number[]>();

  constructor(
    private readonly maxAmount: number,
    private readonly minConfidence: number
  ) {}

  decide(state: AgentState): AgentDecision {
    const nowBucket = Math.floor(Date.now() / 5000);
    const syntheticPrice = this.syntheticPrice(state.agentId, nowBucket);
    const recent = this.history.get(state.agentId) ?? [];
    const updated = [...recent.slice(-4), syntheticPrice];
    this.history.set(state.agentId, updated);

    if (updated.length < 2) {
      return {
        action: null,
        confidence: 0.35,
        reason: "Insufficient market context; waiting for next tick."
      };
    }

    const prev = updated[updated.length - 2];
    const momentum = syntheticPrice - prev;
    const momentumNorm = Math.min(1, Math.abs(momentum) / Math.max(1, prev));
    const confidence = Number(Math.min(0.95, 0.45 + momentumNorm * 3).toFixed(2));

    if (confidence < this.minConfidence) {
      return {
        action: null,
        confidence,
        reason: "Signal confidence below threshold; holding position."
      };
    }

    const direction = momentum >= 0 ? ("A_TO_B" as const) : ("B_TO_A" as const);
    const scaled = 0.25 + confidence * 0.55;
    const amount = Math.max(1, Math.min(this.maxAmount, Math.floor(this.maxAmount * scaled)));

    return {
      action: {
        kind: "swap",
        direction,
        amount
      },
      confidence,
      reason: `Momentum ${momentum >= 0 ? "up" : "down"} with confidence ${confidence}.`
    };
  }

  private syntheticPrice(agentId: string, bucket: number): number {
    const seed = this.hash(agentId);
    const wave = Math.sin((bucket + seed % 17) / 3.2) * 21;
    const micro = Math.cos((bucket + seed % 11) / 2.1) * 7;
    return 1000 + wave + micro;
  }

  private hash(input: string): number {
    let h = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
}
