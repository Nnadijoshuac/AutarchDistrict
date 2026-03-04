import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AgentRunner } from "../agents/agentRunner.js";
import type { Notifier } from "../notifications/notifier.js";
import type { AgentStore } from "../persistence/agentStore.js";
import type { PolicyProfile } from "../policy/policyProfile.js";

const createAgentsSchema = z.object({
  count: z.number().int().positive().max(50).default(1),
  strategyName: z.string().min(1).optional()
});

const updatePolicySchema = z.object({
  name: z.string().min(1),
  maxLamportsPerTx: z.number().int().positive(),
  maxDailyLamports: z.number().int().positive(),
  allowedPrograms: z.array(z.string().min(32)).default([]),
  maxConcurrentTx: z.number().int().positive().max(20),
  slippageBps: z.number().int().nonnegative().max(10_000)
});

const updateStrategySchema = z.object({
  strategyName: z.string().min(1)
});

export async function registerAgentRoutes(
  app: FastifyInstance,
  runner: AgentRunner,
  agentStore: AgentStore,
  notifier?: Notifier | null
) {
  app.get("/agents", async () => ({ agents: runner.listAgents() }));
  app.get("/strategies", async () => ({ strategies: runner.listStrategyNames() }));

  app.post("/agents", async (req) => {
    const parsed = createAgentsSchema.parse(req.body ?? {});
    const agents = await runner.createAgents(parsed.count, parsed.strategyName);
    void notifier?.send(`Autarch District\nProvisioned ${agents.length} new agent wallet(s).`).catch(() => undefined);
    return { agents };
  });

  app.patch("/agents/:agentId/policy", async (req, reply) => {
    const { agentId } = req.params as { agentId: string };
    const profile = updatePolicySchema.parse(req.body ?? {}) as PolicyProfile;
    try {
      const updated = runner.setAgentPolicy(agentId, profile);
      await agentStore.updateAgentPolicy(agentId, profile);
      return { agent: updated };
    } catch (error) {
      reply.code(404);
      return { message: error instanceof Error ? error.message : String(error) };
    }
  });

  app.patch("/agents/:agentId/strategy", async (req, reply) => {
    const { agentId } = req.params as { agentId: string };
    const { strategyName } = updateStrategySchema.parse(req.body ?? {});
    try {
      const updated = runner.setAgentStrategy(agentId, strategyName);
      await agentStore.updateAgentStrategy(agentId, strategyName);
      return { agent: updated };
    } catch (error) {
      reply.code(404);
      return { message: error instanceof Error ? error.message : String(error) };
    }
  });
}
