import type { AppConfig } from "../config.js";
import type { AgentStrategy } from "./types.js";
import { HeuristicAiSwapStrategy } from "./strategies/heuristicAiSwap.js";
import { RandomSwapStrategy } from "./strategies/randomSwap.js";

export function createStrategyFactory(config: AppConfig): (agentId: string) => AgentStrategy {
  return (_agentId: string) => {
    if (config.AGENT_STRATEGY === "random") {
      return new RandomSwapStrategy(config.DEMO_SWAP_AMOUNT);
    }
    return new HeuristicAiSwapStrategy(config.DEMO_SWAP_AMOUNT, config.AI_MIN_CONFIDENCE);
  };
}
