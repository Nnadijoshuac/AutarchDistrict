import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  SOLANA_RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
  SOLANA_WS_URL: z.string().url().default("wss://api.devnet.solana.com"),
  KEYSTORE_MASTER_KEY: z.string().min(32),
  PROGRAM_ID: z.string().min(32),
  DEMO_NUM_AGENTS: z.coerce.number().int().positive().default(5),
  DEMO_SWAP_AMOUNT: z.coerce.number().int().positive().default(1000),
  AGENT_STRATEGY: z.enum(["heuristic_ai", "random"]).default("heuristic_ai"),
  AI_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.5),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000")
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.parse(process.env);
  const rpc = parsed.SOLANA_RPC_URL.toLowerCase();
  if (!rpc.includes("devnet")) {
    throw new Error("Devnet-only enforcement: SOLANA_RPC_URL must point to devnet.");
  }
  return parsed;
}
