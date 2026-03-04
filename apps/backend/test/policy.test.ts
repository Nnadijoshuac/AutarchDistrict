import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SANDBOX_PROFILE } from "../src/policy/policyProfile.js";
import { SpendDb } from "../src/policy/spendDb.js";
import { PolicyViolationError, TxPolicyEngine } from "../src/policy/txPolicyEngine.js";

function createSpendDb(): SpendDb {
  const dir = mkdtempSync(join(tmpdir(), "spend-db-"));
  return new SpendDb(join(dir, "spend.json"));
}

describe("tx policy", () => {
  it("blocks disallowed program", () => {
    const policy = new TxPolicyEngine(createSpendDb());

    const ix = new TransactionInstruction({
      programId: new PublicKey("BPFLoader1111111111111111111111111111111111"),
      keys: [],
      data: Buffer.alloc(0)
    });

    expect(() =>
      policy.assertTransaction(
        { instructions: [ix], lamports: 10 },
        "agent-1",
        { ...SANDBOX_PROFILE, allowedPrograms: [Keypair.generate().publicKey.toBase58()] }
      )
    ).toThrowError(PolicyViolationError);
  });

  it("enforces daily cap", () => {
    const policy = new TxPolicyEngine(createSpendDb());
    const allowedProgram = Keypair.generate().publicKey.toBase58();
    const profile = {
      ...SANDBOX_PROFILE,
      maxLamportsPerTx: 100,
      maxDailyLamports: 150,
      allowedPrograms: [allowedProgram]
    };
    const ix = new TransactionInstruction({
      programId: new PublicKey(allowedProgram),
      keys: [],
      data: Buffer.alloc(0)
    });

    policy.assertTransaction({ instructions: [ix], lamports: 100 }, "agent-1", profile);
    expect(() => policy.assertTransaction({ instructions: [ix], lamports: 60 }, "agent-1", profile)).toThrowError(
      PolicyViolationError
    );
  });
});
