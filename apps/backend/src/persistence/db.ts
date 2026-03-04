import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

type LoggerLike = {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  warn: (obj: Record<string, unknown>, msg?: string) => void;
};

export async function ensureDatabaseReady(log?: LoggerLike): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Agent" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "publicKey" TEXT NOT NULL,
        "encryptedSecret" TEXT NOT NULL,
        "encryptedDataKey" TEXT NOT NULL,
        "policyProfile" JSONB NOT NULL,
        "strategy_name" TEXT NOT NULL DEFAULT 'randomSwap',
        "isActive" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Transaction" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "agentId" TEXT NOT NULL,
        "action" TEXT,
        "strategy" TEXT,
        "rationale" TEXT,
        "riskScore" DOUBLE PRECISION,
        "signature" TEXT,
        "status" TEXT NOT NULL,
        "reason" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PolicyViolation" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "agentId" TEXT NOT NULL,
        "code" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'Transaction_agentId_fkey'
        ) THEN
          ALTER TABLE "Transaction"
          ADD CONSTRAINT "Transaction_agentId_fkey"
          FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'PolicyViolation_agentId_fkey'
        ) THEN
          ALTER TABLE "PolicyViolation"
          ADD CONSTRAINT "PolicyViolation_agentId_fkey"
          FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Transaction_agentId_idx" ON "Transaction"("agentId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "PolicyViolation_agentId_idx" ON "PolicyViolation"("agentId")`
    );

    log?.info({ module: "db" }, "Database schema is ready.");
  } catch (error) {
    log?.warn({ module: "db", error: String(error) }, "Failed to auto-bootstrap database schema.");
    throw error;
  }
}
