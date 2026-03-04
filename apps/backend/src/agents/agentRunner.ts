import { EventEmitter } from "node:events";
import Bottleneck from "bottleneck";
import pLimit from "p-limit";
import { PublicKey } from "@solana/web3.js";
import type { WalletExecutor } from "../wallet/txBuilder.js";
import type { AgentState, AgentStrategy } from "./types.js";
import type { MockDefiClient } from "../protocol/mockDefiClient.js";
import type { PolicyProfile } from "../policy/policyProfile.js";
import { PolicyViolationError } from "../policy/txPolicyEngine.js";

export type RunnerEvent = {
  timestamp: string;
  agentId: string;
  action: string;
  status: "ok" | "error";
  signature?: string;
  err?: string;
};

type RunnerHooks = {
  onAgentCreated?: (state: AgentState) => Promise<void>;
  onAgentStatusChanged?: (agentId: string, isActive: boolean) => Promise<void>;
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
    private readonly profileFactory: (agentId: string) => PolicyProfile,
    private readonly hooks: RunnerHooks = {},
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
        policyProfile: this.profileFactory(signer.agentId),
        lastStatus: "idle"
      };
      this.agents.set(signer.agentId, state);
      if (this.hooks.onAgentCreated) {
        await this.hooks.onAgentCreated(state);
      }
      created.push(state);
    }
    return created;
  }

  restoreAgents(signers: Array<{ agentId: string; publicKey: string }>): AgentState[] {
    const restored: AgentState[] = [];
    for (const signer of signers) {
      if (this.agents.has(signer.agentId)) {
        continue;
      }
      const state: AgentState = {
        agentId: signer.agentId,
        publicKey: signer.publicKey,
        strategy: this.strategyFactory(signer.agentId).name,
        policyProfile: this.profileFactory(signer.agentId),
        lastStatus: "idle"
      };
      this.agents.set(signer.agentId, state);
      restored.push(state);
    }
    return restored;
  }

  listAgents(): AgentState[] {
    return [...this.agents.values()];
  }

  getAgent(agentId: string): AgentState | undefined {
    return this.agents.get(agentId);
  }

  resumeActiveRunners(activeAgentIds: string[], intervalMs = 3000): void {
    if (activeAgentIds.length === 0) {
      return;
    }
    const enabled = new Set(activeAgentIds);
    for (const state of this.agents.values()) {
      if (!enabled.has(state.agentId) || this.timers.has(state.agentId)) {
        continue;
      }
      this.startAgent(state, intervalMs);
    }
  }

  start(intervalMs = 3000): void {
    for (const state of this.agents.values()) {
      if (this.timers.has(state.agentId)) {
        continue;
      }
      this.startAgent(state, intervalMs);
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
      void this.hooks.onAgentStatusChanged?.(agentId, false).catch(() => undefined);
    }
  }

  private startAgent(state: AgentState, intervalMs: number): void {
    state.lastStatus = "running";
    const strategy = this.strategyFactory(state.agentId);
    const timer = setInterval(() => {
      void this.actionLimit(() => this.runTick(state.agentId, strategy));
    }, intervalMs);
    this.timers.set(state.agentId, timer);
    void this.hooks.onAgentStatusChanged?.(state.agentId, true).catch(() => undefined);
  }

  private async runTick(agentId: string, strategy: AgentStrategy): Promise<void> {
    const state = this.agents.get(agentId);
    if (!state) {
      return;
    }

    const action = strategy.nextAction(state);
    if (!action) {
      return;
    }

    try {
      const signature = await this.limiter.schedule(async () => {
        const ix = this.protocol.buildSwapInstruction(
          new PublicKey(state.publicKey),
          action.direction,
          action.amount
        );
        return this.wallet.submitSwap(agentId, ix, action.amount, state.policyProfile);
      });

      state.lastSignature = signature;
      state.lastStatus = "running";
      state.lastError = undefined;
      this.emit("event", {
        timestamp: new Date().toISOString(),
        agentId,
        action: `${action.kind}:${action.direction}:${action.amount}`,
        status: "ok",
        signature
      } satisfies RunnerEvent);
    } catch (error) {
      const message =
        error instanceof PolicyViolationError
          ? JSON.stringify(error.detail)
          : error instanceof Error
            ? error.message
            : String(error);
      state.lastStatus = "error";
      state.lastError = message;
      this.emit("event", {
        timestamp: new Date().toISOString(),
        agentId,
        action: `${action.kind}:${action.direction}:${action.amount}`,
        status: "error",
        err: message
      } satisfies RunnerEvent);
    }
  }
}
