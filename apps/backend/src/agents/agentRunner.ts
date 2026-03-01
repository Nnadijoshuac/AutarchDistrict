import { EventEmitter } from "node:events";
import Bottleneck from "bottleneck";
import pLimit from "p-limit";
import { PublicKey } from "@solana/web3.js";
import type { WalletExecutor } from "../wallet/txBuilder.js";
import type { AgentState, AgentStrategy } from "./types.js";
import type { MockDefiClient } from "../protocol/mockDefiClient.js";

export type RunnerEvent = {
  timestamp: string;
  agentId: string;
  action: string;
  status: "ok" | "error";
  signature?: string;
  err?: string;
};

export class AgentRunner extends EventEmitter {
  private readonly agents = new Map<string, AgentState>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly limiter: Bottleneck;
  private readonly actionLimit;

  constructor(
    private readonly wallet: WalletExecutor,
    private readonly protocol: MockDefiClient,
    private readonly strategyFactory: (agentId: string) => AgentStrategy,
    maxRpcPerSecond = 10,
    maxConcurrentAgents = 5
  ) {
    super();
    this.limiter = new Bottleneck({ minTime: Math.ceil(1000 / Math.max(1, maxRpcPerSecond)) });
    this.actionLimit = pLimit(maxConcurrentAgents);
  }

  async createAgents(count: number): Promise<AgentState[]> {
    const created: AgentState[] = [];
    for (let i = 0; i < count; i += 1) {
      const signer = await this.wallet.createAgent();
      const state: AgentState = {
        agentId: signer.agentId,
        publicKey: signer.publicKey,
        strategy: this.strategyFactory(signer.agentId).name,
        lastStatus: "idle"
      };
      this.agents.set(signer.agentId, state);
      created.push(state);
    }
    return created;
  }

  listAgents(): AgentState[] {
    return [...this.agents.values()];
  }

  start(intervalMs = 3000): void {
    for (const state of this.agents.values()) {
      if (this.timers.has(state.agentId)) {
        continue;
      }
      state.lastStatus = "running";
      const strategy = this.strategyFactory(state.agentId);
      const timer = setInterval(() => {
        void this.actionLimit(() => this.runTick(state.agentId, strategy));
      }, intervalMs);
      this.timers.set(state.agentId, timer);
    }
  }

  stop(): void {
    for (const [agentId, timer] of this.timers.entries()) {
      clearInterval(timer);
      this.timers.delete(agentId);
      const state = this.agents.get(agentId);
      if (state) {
        state.lastStatus = "stopped";
      }
    }
  }

  private async runTick(agentId: string, strategy: AgentStrategy): Promise<void> {
    const state = this.agents.get(agentId);
    if (!state) {
      return;
    }

    const decision = strategy.decide(state);
    const action = decision.action;
    if (!action) {
      this.emit("event", {
        timestamp: new Date().toISOString(),
        agentId,
        action: `hold:${decision.confidence}`,
        status: "ok",
        err: decision.reason
      } satisfies RunnerEvent);
      return;
    }

    try {
      const signature = await this.limiter.schedule(async () => {
        const ix = this.protocol.buildSwapInstruction(
          new PublicKey(state.publicKey),
          action.direction,
          action.amount
        );
        return this.wallet.submitSwap(agentId, ix, action.amount);
      });

      state.lastSignature = signature;
      state.lastStatus = "running";
      state.lastError = undefined;
      this.emit("event", {
        timestamp: new Date().toISOString(),
        agentId,
        action: `${action.kind}:${action.direction}:${action.amount}:${decision.confidence}`,
        status: "ok",
        signature
      } satisfies RunnerEvent);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.lastStatus = "error";
      state.lastError = message;
      this.emit("event", {
        timestamp: new Date().toISOString(),
        agentId,
        action: `${action.kind}:${action.direction}:${action.amount}:${decision.confidence}`,
        status: "error",
        err: message
      } satisfies RunnerEvent);
    }
  }
}
