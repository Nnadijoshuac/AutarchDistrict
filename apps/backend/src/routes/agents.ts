import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AgentRunner } from "../agents/agentRunner.js";
import type { Notifier } from "../notifications/notifier.js";

const createAgentsSchema = z.object({
  count: z.number().int().positive().max(50).default(1),
  strategyName: z.string().min(1).optional()
});

export async function registerAgentRoutes(app: FastifyInstance, runner: AgentRunner, notifier?: Notifier | null) {
  app.get("/agents", async () => ({ agents: runner.listAgents() }));
  app.get("/strategies", async () => ({ strategies: runner.listStrategyNames() }));

  app.post("/agents", async (req) => {
    const parsed = createAgentsSchema.parse(req.body ?? {});
    const agents = await runner.createAgents(parsed.count, parsed.strategyName);
    void notifier?.send(`Autarch District\nProvisioned ${agents.length} new agent wallet(s).`).catch(() => undefined);
    return { agents };
  });
}
