import { describe, expect, it } from "vitest";
import { StrategyLoader } from "../src/strategies/strategyLoader.js";

describe("strategy loader", () => {
  it("loads plugin modules and exposes strategy names", async () => {
    const loader = await StrategyLoader.create(1000);
    const names = loader.list();

    expect(names.includes("randomSwap")).toBe(true);
    expect(loader.get("randomSwap").name).toBe("randomSwap");
  });
});
