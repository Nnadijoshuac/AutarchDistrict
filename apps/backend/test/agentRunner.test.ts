import { describe, expect, it } from "vitest";
import { RandomSwapStrategy } from "../src/agents/strategies/randomSwap.js";
import { SANDBOX_PROFILE } from "../src/policy/policyProfile.js";

describe("agent runner strategy", () => {
  it("generates swap action", () => {
    const strategy = new RandomSwapStrategy(10);
    const action = strategy.nextAction({
      agentId: "a",
      publicKey: "p",
      strategy: "randomSwap",
      policyProfile: SANDBOX_PROFILE,
      lastStatus: "idle"
    });

    expect(action?.kind).toBe("swap");
    expect(action?.amount).toBeGreaterThan(0);
  });
});
