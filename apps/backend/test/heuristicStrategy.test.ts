import { describe, expect, it } from "vitest";
import { HeuristicAiSwapStrategy } from "../src/agents/strategies/heuristicAiSwap.js";

describe("heuristic ai strategy", () => {
  it("returns hold first, then actionable decision as context grows", () => {
    const strategy = new HeuristicAiSwapStrategy(1000, 0.5);
    const state = {
      agentId: "agent-1",
      publicKey: "pubkey",
      strategy: "heuristicAiSwap",
      lastStatus: "idle" as const
    };

    const first = strategy.decide(state);
    const second = strategy.decide(state);

    expect(first.action).toBeNull();
    expect(first.reason.length).toBeGreaterThan(0);
    expect(second.confidence).toBeGreaterThanOrEqual(0);
    expect(second.confidence).toBeLessThanOrEqual(0.95);

    if (second.action) {
      expect(second.action.kind).toBe("swap");
      expect(second.action.amount).toBeGreaterThan(0);
      expect(["A_TO_B", "B_TO_A"]).toContain(second.action.direction);
    }
  });
});
