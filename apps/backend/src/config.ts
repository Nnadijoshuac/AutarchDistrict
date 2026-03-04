import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  SOLANA_RPC_URL: z.string().url().default("https://api.devnet.solana.com"),
  SOLANA_WS_URL: z.string().url().default("wss://api.devnet.solana.com"),
  KMS_PROVIDER: z.enum(["dev"]).default("dev"),
  KMS_MASTER_KEY_BASE64: z.string().min(1),
  PROGRAM_ID: z.string().min(32),
  DATA_DIR: z.string().default(process.env.VERCEL ? "/tmp/autarch-data" : "data"),
  DEMO_NUM_AGENTS: z.coerce.number().int().positive().default(5),
  DEMO_SWAP_AMOUNT: z.coerce.number().int().positive().default(1000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  TELEGRAM_NOTIFICATIONS_ENABLED: z.coerce.boolean().default(false),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_NOTIFY_AGENT_EVENTS: z.coerce.boolean().default(false)
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
