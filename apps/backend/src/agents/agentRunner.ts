import { EventEmitter } from "node:events";
import Bottleneck from "bottleneck";
import pLimit from "p-limit";
import type { WalletExecutor } from "../wallet/txBuilder.js";
import type { AgentState } from "./types.js";
import type { MockDefiClient } from "../protocol/mockDefiClient.js";
import type { PolicyProfile } from "../policy/policyProfile.js";
import { PolicyViolationError } from "../policy/txPolicyEngine.js";
import type { StrategyLoader } from "../strategies/strategyLoader.js";

export type RunnerEvent = {
  timestamp: string;
  agentId: string;
  action: string;
  status: "ok" | "error";
  strategy?: string;
  rationale?: string;
  riskScore?: number;
  durationMs?: number;
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
    private readonly strategyLoader: StrategyLoader,
    private readonly defaultStrategyName: string,
    private readonly profileFactory: (agentId: string) => PolicyProfile,
    private readonly hooks: RunnerHooks = {},
    maxRpcPerSecond = 10,
    maxConcurrentAgents = 5
  ) {
    super();
    this.limiter = new Bottleneck({ minTime: Math.ceil(1000 / Math.max(1, maxRpcPerSecond)) });
    this.actionLimit = pLimit(maxConcurrentAgents);
  }

  async createAgents(count: number, strategyName = this.defaultStrategyName): Promise<AgentState[]> {
    const created: AgentState[] = [];
    for (let i = 0; i < count; i += 1) {
      const signer = await this.wallet.createAgent();
      const state: AgentState = {
        agentId: signer.agentId,
        publicKey: signer.publicKey,
        strategy: strategyName,
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

  restoreAgents(
    signers: Array<{ agentId: string; publicKey: string; strategyName?: string; policyProfile?: PolicyProfile }>
  ): AgentState[] {
    const restored: AgentState[] = [];
    for (const signer of signers) {
      if (this.agents.has(signer.agentId)) {
        continue;
      }
      const state: AgentState = {
        agentId: signer.agentId,
        publicKey: signer.publicKey,
        strategy: signer.strategyName ?? this.defaultStrategyName,
        policyProfile: signer.policyProfile ?? this.profileFactory(signer.agentId),
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

  listStrategyNames(): string[] {
    return this.strategyLoader.list();
  }

  setAgentPolicy(agentId: string, profile: PolicyProfile): AgentState {
    const state = this.agents.get(agentId);
    if (!state) {
      throw new Error(`Unknown agent: ${agentId}`);
    }
    state.policyProfile = profile;
    return state;
  }

  setAgentStrategy(agentId: string, strategyName: string): AgentState {
    const state = this.agents.get(agentId);
    if (!state) {
      throw new Error(`Unknown agent: ${agentId}`);
    }
    this.strategyLoader.get(strategyName);
    state.strategy = strategyName;
    return state;
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
    const timer = setInterval(() => {
      void this.actionLimit(() => this.runTick(state.agentId));
    }, intervalMs);
    this.timers.set(state.agentId, timer);
    void this.hooks.onAgentStatusChanged?.(state.agentId, true).catch(() => undefined);
  }

  private async runTick(agentId: string): Promise<void> {
    const state = this.agents.get(agentId);
    if (!state) {
      return;
    }

    const strategy = this.strategyLoader.get(state.strategy);
    const decision = await strategy.nextAction({
      agentId: state.agentId,
      publicKey: state.publicKey,
      policyProfile: state.policyProfile,
      protocol: this.protocol
    });
    if (!decision) {
      return;
    }

    const startedAt = Date.now();
    try {
      const signature = await this.limiter.schedule(async () => {
        return this.wallet.submitInstructions(
          agentId,
          decision.action,
          undefined,
          state.policyProfile,
          0,
          Math.floor(decision.riskScore * 100)
        );
      });

      state.lastSignature = signature;
      state.lastStatus = "running";
      state.lastError = undefined;
      this.emit("event", {
        timestamp: new Date().toISOString(),
        agentId,
        action: decision.actionLabel,
        status: "ok",
        strategy: state.strategy,
        rationale: decision.rationale,
        riskScore: decision.riskScore,
        durationMs: Date.now() - startedAt,
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
        action: decision.actionLabel,
        status: "error",
        strategy: state.strategy,
        rationale: decision.rationale,
        riskScore: decision.riskScore,
        durationMs: Date.now() - startedAt,
        err: message
      } satisfies RunnerEvent);
    }
  }
}
