import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { PublicKey } from "@solana/web3.js";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadConfig } from "./config.js";
import { createConnection } from "./solana/connection.js";
import { FileKeystore } from "./keystore/keystore.js";
import { LocalEncryptedKeystoreSignerProvider } from "./wallet/signerImpl.js";
import { TxPolicyEngine } from "./wallet/txPolicy.js";
import { WalletExecutor } from "./wallet/txBuilder.js";
import { MockDefiClient } from "./protocol/mockDefiClient.js";
import { AgentRunner } from "./agents/agentRunner.js";
import { RandomSwapStrategy } from "./agents/strategies/randomSwap.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerDemoRoutes } from "./routes/demo.js";
import { SpendDb } from "./policy/spendDb.js";

export async function buildServer() {
  const config = loadConfig();
  const app = Fastify({ logger: { level: config.LOG_LEVEL } });

  await app.register(cors, { origin: config.WEB_ORIGIN });
  await app.register(websocket);

  const connection = createConnection(config.SOLANA_RPC_URL, config.SOLANA_WS_URL);
  const keystore = new FileKeystore(join(config.DATA_DIR, "keystore.json"), config.KEYSTORE_MASTER_KEY);
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

  const sockets = new Set<{ send: (msg: string) => void }>();
  app.get("/ws", { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  runner.on("event", (evt) => {
    const serialized = JSON.stringify(evt);
    for (const ws of sockets) {
      ws.send(serialized);
    }
  });

  await registerAgentRoutes(app, runner);
  await registerDemoRoutes(app, {
    runner,
    wallet,
    protocol,
    connection,
    signerProvider,
    programId: new PublicKey(config.PROGRAM_ID),
    demoSwapAmount: config.DEMO_SWAP_AMOUNT
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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const { app } = await vercelServerPromise;
  app.server.emit("request", req, res);
}
