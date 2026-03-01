import { describe, expect, it } from "vitest";
import { RandomSwapStrategy } from "../src/agents/strategies/randomSwap.js";

describe("agent runner strategy", () => {
  it("generates swap action", () => {
    const strategy = new RandomSwapStrategy(10);
    const decision = strategy.decide({
      agentId: "a",
      publicKey: "p",
      strategy: "randomSwap",
      lastStatus: "idle"
    });

    expect(decision.action?.kind).toBe("swap");
    expect(decision.action?.amount).toBeGreaterThan(0);
    expect(decision.confidence).toBeGreaterThanOrEqual(0);
  });
});
