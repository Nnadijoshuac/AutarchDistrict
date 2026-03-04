import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { PublicKey } from "@solana/web3.js";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Buffer } from "node:buffer";
import pino from "pino";
import { loadConfig } from "./config.js";
import { createConnection } from "./solana/connection.js";
import { DevKmsProvider } from "./security/devKmsProvider.js";
import { FileKeystore } from "./security/keystore.js";
import { LocalEncryptedKeystoreSignerProvider } from "./wallet/signerImpl.js";
import { WalletExecutor } from "./wallet/txBuilder.js";
import { MockDefiClient } from "./protocol/mockDefiClient.js";
import { AgentRunner } from "./agents/agentRunner.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerDemoRoutes } from "./routes/demo.js";
import { SANDBOX_PROFILE, type PolicyProfile } from "./policy/policyProfile.js";
import { SpendDb } from "./policy/spendDb.js";
import { TxPolicyEngine, type PolicyViolationDetail } from "./policy/txPolicyEngine.js";
import { createTelegramNotifier } from "./notifications/telegram.js";
import { AgentStore } from "./persistence/agentStore.js";
import { AppMetrics } from "./metrics.js";
import {
  ATA_PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  SPL_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID
} from "./solana/constants.js";
import { CircuitBreaker } from "./observability/circuitBreaker.js";
import { StrategyLoader } from "./strategies/strategyLoader.js";

export async function buildServer() {
  const config = loadConfig();
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      base: { module: "server" },
      timestamp: pino.stdTimeFunctions.isoTime,
      messageKey: "message",
      redact: ["secretKey", "KEYSTORE_MASTER_KEY", "KMS_MASTER_KEY_BASE64"]
    }
  });
  const notifier = createTelegramNotifier(config, app.log);
  const metrics = new AppMetrics();
  const circuitBreaker = new CircuitBreaker(0.4, 60_000, 10);
  await app.register(cors, { origin: true });
  if (!process.env.VERCEL) {
    await app.register(websocket);
  }

  const connection = createConnection(config.SOLANA_RPC_URL, config.SOLANA_WS_URL);
  const agentStore = new AgentStore();
  const kmsProvider = new DevKmsProvider(config.KMS_MASTER_KEY_BASE64);
  const keystore = new FileKeystore(join(config.DATA_DIR, "keystore.json"), kmsProvider);
  const spendDb = new SpendDb(join(config.DATA_DIR, "spend-db.json"));
  const signerProvider = new LocalEncryptedKeystoreSignerProvider(keystore);
  const baseAllowedPrograms = [
    SYSTEM_PROGRAM_ID.toBase58(),
    SPL_TOKEN_PROGRAM_ID.toBase58(),
    ATA_PROGRAM_ID.toBase58(),
    COMPUTE_BUDGET_PROGRAM_ID.toBase58(),
    config.PROGRAM_ID
  ];
  const buildAgentPolicyProfile = (_agentId: string): PolicyProfile => ({
    ...SANDBOX_PROFILE,
    allowedPrograms: baseAllowedPrograms
  });

  const policy = new TxPolicyEngine(spendDb);
  const wallet = new WalletExecutor(connection, signerProvider, policy);
  const protocol = new MockDefiClient(new PublicKey(config.PROGRAM_ID));
  const strategyLoader = await StrategyLoader.create(config.DEMO_SWAP_AMOUNT);
  const defaultStrategyName = strategyLoader.list().includes("randomSwap")
    ? "randomSwap"
    : strategyLoader.list()[0];
  const runner = new AgentRunner(
    wallet,
    protocol,
    strategyLoader,
    defaultStrategyName,
    buildAgentPolicyProfile,
    {
      onAgentCreated: async (state) => {
        const secret = keystore.getStoredAgent(state.agentId);
        await agentStore.upsertAgent(state, {
          encryptedSecret: secret.encryptedSecret,
          encryptedDataKey: secret.encryptedDataKey
        });
      },
      onAgentStatusChanged: async (agentId, isActive) => {
        await agentStore.setAgentActive(agentId, isActive);
      }
    }
  );

  const persistedAgents = await agentStore.listAgents();
  if (persistedAgents.length > 0) {
    const restoredAgents = runner.restoreAgents(
      persistedAgents.map((agent) => ({
        agentId: agent.agentId,
        publicKey: agent.publicKey,
        strategyName: agent.strategyName,
        policyProfile: agent.policyProfile as unknown as PolicyProfile
      }))
    );
    runner.resumeActiveRunners(persistedAgents.filter((agent) => agent.isActive).map((agent) => agent.agentId));
    metrics.setActiveAgents(persistedAgents.filter((agent) => agent.isActive).length);
    app.log.info({ count: restoredAgents.length }, "Restored agents from database.");
  } else {
    const restoredAgents = runner.restoreAgents(
      (await keystore.listSigners()).map((signer) => ({ ...signer, strategyName: defaultStrategyName }))
    );
    if (restoredAgents.length > 0) {
      for (const state of restoredAgents) {
        const secret = keystore.getStoredAgent(state.agentId);
        await agentStore.upsertAgent(state, {
          encryptedSecret: secret.encryptedSecret,
          encryptedDataKey: secret.encryptedDataKey
        });
      }
      app.log.info({ count: restoredAgents.length }, "Restored agents from keystore.");
    }
    metrics.setActiveAgents(0);
  }

  type WsClient = {
    socket: {
      send: (msg: string) => void;
      ping: () => void;
      on: (event: string, cb: (...args: unknown[]) => void) => void;
      close: () => void;
    };
    agentId?: string;
    isAlive: boolean;
    heartbeat: NodeJS.Timeout;
  };
  const sockets = new Set<WsClient>();
  if (!process.env.VERCEL) {
    app.get("/ws", { websocket: true }, (socket, req) => {
      const query = new URL(req.url ?? "/ws", "http://localhost").searchParams;
      const agentId = query.get("agentId") ?? undefined;
      const client: WsClient = {
        socket,
        agentId,
        isAlive: true,
        heartbeat: setInterval(() => {
          if (!client.isAlive) {
            client.socket.close();
            return;
          }
          client.isAlive = false;
          client.socket.ping();
        }, 10_000)
      };
      sockets.add(client);
      socket.on("pong", () => {
        client.isAlive = true;
      });
      socket.on("close", () => {
        clearInterval(client.heartbeat);
        sockets.delete(client);
      });
    });
  } else {
    app.get("/ws", async (_req, reply) => {
      reply.code(501).send({ ok: false, error: "WebSocket not supported on this deployment" });
    });
  }

  runner.on("event", (evt) => {
    const serialized = JSON.stringify(evt);
    for (const client of sockets) {
      if (!client.agentId || client.agentId === evt.agentId) {
        client.socket.send(serialized);
      }
    }

    void agentStore.recordTransaction({
      agentId: evt.agentId,
      status: evt.status,
      action: evt.action,
      strategy: evt.strategy,
      rationale: evt.rationale,
      riskScore: evt.riskScore,
      signature: evt.signature,
      reason: evt.err
    });

    if (evt.err) {
      try {
        const parsed = JSON.parse(evt.err) as PolicyViolationDetail;
        if (parsed.code?.startsWith("DENY_")) {
          void agentStore.recordPolicyViolation(parsed);
          metrics.incPolicyViolation();
        }
      } catch {
        // ignore non-policy errors
      }
    }

    if (evt.durationMs !== undefined) {
      metrics.observeRpcLatency(evt.durationMs);
    }
    if (evt.status === "ok") {
      metrics.incTxSuccess();
    } else {
      metrics.incTxFailure();
    }

    if (circuitBreaker.record(evt.status === "ok")) {
      runner.stop();
      metrics.setActiveAgents(0);
      const criticalEvt = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "critical",
        type: "CIRCUIT_BREAKER_TRIPPED",
        message: "Agent execution halted: failure rate exceeded 40% in a rolling 60s window."
      });
      for (const client of sockets) {
        client.socket.send(criticalEvt);
      }
      void notifier
        ?.send("Autarch District\nCRITICAL: Circuit breaker tripped. All agents paused.")
        .catch(() => undefined);
    }

    if (config.TELEGRAM_NOTIFY_AGENT_EVENTS) {
      const line = `Autarch District\nAgent: ${evt.agentId}\nAction: ${evt.action}\nStatus: ${evt.status}${
        evt.signature ? `\nSig: ${evt.signature}` : ""
      }${evt.err ? `\nError: ${evt.err}` : ""}`;
      void notifier?.send(line).catch(() => undefined);
    }
  });

  await registerAgentRoutes(app, runner, agentStore, notifier);
  await registerDemoRoutes(app, {
    runner,
    wallet,
    protocol,
    connection,
    signerProvider,
    programId: new PublicKey(config.PROGRAM_ID),
    demoSwapAmount: config.DEMO_SWAP_AMOUNT,
    notifier
  });
  app.get("/policy-violations", async () => ({ violations: await agentStore.listPolicyViolations(200) }));
  app.get("/metrics", async (_req, reply) => {
    reply.header("content-type", metrics.contentType());
    return metrics.expose();
  });
  app.post("/circuit-breaker/resume", async () => {
    circuitBreaker.reset();
    runner.start();
    metrics.setActiveAgents(runner.listAgents().length);
    return { ok: true };
  });
  app.get("/health", async () => ({ ok: true }));

  await app.ready();
  return { app };
}

export async function main() {
  const { app } = await buildServer();
  const config = loadConfig();
  await app.listen({ host: "0.0.0.0", port: config.PORT });
}

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  void main();
}

const vercelServerPromise = buildServer();

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const { app } = await vercelServerPromise;
    const payload = await readBody(req);
    const injectPromise = app.inject({
      method: req.method as
        | "GET"
        | "POST"
        | "PUT"
        | "PATCH"
        | "DELETE"
        | "HEAD"
        | "OPTIONS",
      url: req.url ?? "/",
      headers: req.headers as Record<string, string>,
      payload
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Request timed out inside Vercel handler")), 8000);
    });
    const reply = await Promise.race([injectPromise, timeoutPromise]);

    res.statusCode = reply.statusCode;
    for (const [key, value] of Object.entries(reply.headers)) {
      if (value !== undefined) {
        res.setHeader(key, value);
      }
    }
    res.end(reply.body);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    const message = error instanceof Error ? error.message : String(error);
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
