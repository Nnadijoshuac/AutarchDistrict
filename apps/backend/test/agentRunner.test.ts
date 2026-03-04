import { describe, expect, it } from "vitest";
import { MockDefiClient } from "../src/protocol/mockDefiClient.js";
import { RandomSwapStrategy } from "../src/strategies/modules/randomSwap.js";
import { SANDBOX_PROFILE } from "../src/policy/policyProfile.js";
import { Keypair } from "@solana/web3.js";

describe("agent runner strategy", () => {
  it("generates swap action with rationale", async () => {
    const strategy = new RandomSwapStrategy(10);
    const protocol = new MockDefiClient(Keypair.generate().publicKey);
    const user = Keypair.generate().publicKey.toBase58();
    const action = await strategy.nextAction({
      agentId: "a",
      publicKey: user,
      policyProfile: SANDBOX_PROFILE,
      protocol
    });

    expect(action.actionLabel.startsWith("swap:")).toBe(true);
    expect(action.action).toHaveLength(1);
    expect(action.rationale.length).toBeGreaterThan(10);
    expect(action.riskScore).toBeGreaterThanOrEqual(0);
  });
});
