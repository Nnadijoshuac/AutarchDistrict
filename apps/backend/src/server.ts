import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { PublicKey } from "@solana/web3.js";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Buffer } from "node:buffer";
import { loadConfig } from "./config.js";
import { createConnection } from "./solana/connection.js";
import { DevKmsProvider } from "./security/devKmsProvider.js";
import { FileKeystore } from "./security/keystore.js";
import { LocalEncryptedKeystoreSignerProvider } from "./wallet/signerImpl.js";
import { TxPolicyEngine } from "./wallet/txPolicy.js";
import { WalletExecutor } from "./wallet/txBuilder.js";
import { MockDefiClient } from "./protocol/mockDefiClient.js";
import { AgentRunner } from "./agents/agentRunner.js";
import { RandomSwapStrategy } from "./agents/strategies/randomSwap.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerDemoRoutes } from "./routes/demo.js";
import { SpendDb } from "./policy/spendDb.js";
import { createTelegramNotifier } from "./notifications/telegram.js";

export async function buildServer() {
  const config = loadConfig();
  const app = Fastify({ logger: { level: config.LOG_LEVEL } });
  const notifier = createTelegramNotifier(config, app.log);
  // Hackathon-safe default: allow cross-origin browser requests so hosted
  // frontends (Vercel/Render previews) can call the API without CORS mismatch.
  // You can tighten this later with explicit origin allowlists.
  await app.register(cors, { origin: true });
  if (!process.env.VERCEL) {
    await app.register(websocket);
  }

  const connection = createConnection(config.SOLANA_RPC_URL, config.SOLANA_WS_URL);
  const kmsProvider = new DevKmsProvider(config.KMS_MASTER_KEY_BASE64);
  const keystore = new FileKeystore(join(config.DATA_DIR, "keystore.json"), kmsProvider);
  const spendDb = new SpendDb(join(config.DATA_DIR, "spend-db.json"));
  const signerProvider = new LocalEncryptedKeystoreSignerProvider(keystore);
  const policy = new TxPolicyEngine(config.PROGRAM_ID, {
    maxLamportsPerTransfer: 2_000_000_000,
    maxTokenAmountPerSwap: config.DEMO_SWAP_AMOUNT,
    maxDailyVolume: config.DEMO_SWAP_AMOUNT * 100
  }, spendDb);
  const wallet = new WalletExecutor(connection, signerProvider, policy);
  const protocol = new MockDefiClient(new PublicKey(config.PROGRAM_ID));
  const runner = new AgentRunner(wallet, protocol, () => new RandomSwapStrategy(config.DEMO_SWAP_AMOUNT));
  const restoredAgents = runner.restoreAgents(await keystore.listSigners());
  if (restoredAgents.length > 0) {
    app.log.info({ count: restoredAgents.length }, "Restored agents from keystore.");
  }

  const sockets = new Set<{ send: (msg: string) => void }>();
  if (!process.env.VERCEL) {
    app.get("/ws", { websocket: true }, (socket) => {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
  } else {
    app.get("/ws", async (_req, reply) => {
      reply.code(501).send({ ok: false, error: "WebSocket not supported on this deployment" });
    });
  }

  runner.on("event", (evt) => {
    const serialized = JSON.stringify(evt);
    for (const ws of sockets) {
      ws.send(serialized);
    }
    if (config.TELEGRAM_NOTIFY_AGENT_EVENTS) {
      const line = `Autarch District\nAgent: ${evt.agentId}\nAction: ${evt.action}\nStatus: ${evt.status}${
        evt.signature ? `\nSig: ${evt.signature}` : ""
      }${evt.err ? `\nError: ${evt.err}` : ""}`;
      void notifier?.send(line).catch(() => undefined);
    }
  });

  await registerAgentRoutes(app, runner, notifier);
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

// Vercel serverless entrypoint expects a default function export.
// We reuse one lazily-initialized Fastify instance across invocations.
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
