import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentRunner } from "../src/agents/agentRunner.js";
import type { AgentStore } from "../src/persistence/agentStore.js";
import { registerAgentRoutes } from "../src/routes/agents.js";

function buildRunnerMock() {
  const agents = [
    {
      agentId: "agent-1",
      publicKey: "11111111111111111111111111111111",
      strategy: "randomSwap",
      policyProfile: {
        name: "sandbox",
        maxLamportsPerTx: 10,
        maxDailyLamports: 100,
        allowedPrograms: [],
        maxConcurrentTx: 2,
        slippageBps: 200
      },
      lastStatus: "idle" as const
    }
  ];
  return {
    listAgents: vi.fn(() => agents),
    listStrategyNames: vi.fn(() => ["randomSwap", "dca"]),
    createAgents: vi.fn(async () => agents),
    setAgentPolicy: vi.fn((agentId: string, policy: (typeof agents)[number]["policyProfile"]) => ({
      ...agents[0],
      agentId,
      policyProfile: policy
    })),
    setAgentStrategy: vi.fn((agentId: string, strategyName: string) => ({
      ...agents[0],
      agentId,
      strategy: strategyName
    }))
  };
}

function buildStoreMock() {
  return {
    updateAgentPolicy: vi.fn(async () => undefined),
    updateAgentStrategy: vi.fn(async () => undefined)
  };
}

describe("agent routes api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists agents and strategies", async () => {
    const app = Fastify();
    const runner = buildRunnerMock();
    const store = buildStoreMock();
    await registerAgentRoutes(app, runner as unknown as AgentRunner, store as unknown as AgentStore);
    await app.ready();

    const agentsRes = await app.inject({ method: "GET", url: "/agents" });
    const strategyRes = await app.inject({ method: "GET", url: "/strategies" });

    expect(agentsRes.statusCode).toBe(200);
    expect(strategyRes.statusCode).toBe(200);
    expect(agentsRes.json().agents).toHaveLength(1);
    expect(strategyRes.json().strategies).toContain("dca");
  });

  it("updates policy and strategy", async () => {
    const app = Fastify();
    const runner = buildRunnerMock();
    const store = buildStoreMock();
    await registerAgentRoutes(app, runner as unknown as AgentRunner, store as unknown as AgentStore);
    await app.ready();

    const policyRes = await app.inject({
      method: "PATCH",
      url: "/agents/agent-1/policy",
      payload: {
        name: "sandbox",
        maxLamportsPerTx: 10,
        maxDailyLamports: 100,
        allowedPrograms: ["11111111111111111111111111111111"],
        maxConcurrentTx: 2,
        slippageBps: 100
      }
    });
    const strategyRes = await app.inject({
      method: "PATCH",
      url: "/agents/agent-1/strategy",
      payload: { strategyName: "dca" }
    });

    expect(policyRes.statusCode).toBe(200);
    expect(strategyRes.statusCode).toBe(200);
    expect(store.updateAgentPolicy).toHaveBeenCalledOnce();
    expect(store.updateAgentStrategy).toHaveBeenCalledOnce();
  });
});
