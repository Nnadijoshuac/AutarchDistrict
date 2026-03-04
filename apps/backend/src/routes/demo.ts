import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo
} from "@solana/spl-token";
import type { AgentRunner } from "../agents/agentRunner.js";
import type { WalletExecutor } from "../wallet/txBuilder.js";
import type { MockDefiClient } from "../protocol/mockDefiClient.js";
import type { SignerProvider } from "../wallet/signer.js";
import type { Connection } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Notifier } from "../notifications/notifier.js";

type DemoContext = {
  runner: AgentRunner;
  wallet: WalletExecutor;
  protocol: MockDefiClient;
  connection: Connection;
  signerProvider: SignerProvider;
  programId: PublicKey;
  demoSwapAmount: number;
  notifier?: Notifier | null;
};

type DemoState = {
  adminAgentId?: string;
  mintA?: PublicKey;
  mintB?: PublicKey;
  poolState?: PublicKey;
  poolAuthority?: PublicKey;
  vaultA?: PublicKey;
  vaultB?: PublicKey;
  setupInProgress: boolean;
  signatures: string[];
};

const setupSchema = z.object({
  numAgents: z.number().int().positive().max(50).default(5),
  seedAmount: z.number().int().positive().default(100_000),
  adminFundLamports: z.number().int().positive().default(400_000_000),
  agentFundLamports: z.number().int().positive().default(80_000_000),
  reserveLamports: z.number().int().positive().default(120_000_000)
});

const runSchema = z.object({
  rounds: z.number().int().positive().max(30).default(3),
  amount: z.number().int().positive().default(1000)
});

export async function registerDemoRoutes(app: FastifyInstance, ctx: DemoContext) {
  const state: DemoState = { setupInProgress: false, signatures: [] };
  const defaultKeypairPath = join(homedir(), ".config", "solana", "id.json");
  const fundedKeypairPath = process.env.SOLANA_KEYPAIR_PATH ?? defaultKeypairPath;

  function loadFundedSigner(): Keypair {
    const raw = JSON.parse(readFileSync(fundedKeypairPath, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }

  async function fundWallet(from: Keypair, to: PublicKey, lamports: number): Promise<string> {
    const ix = SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports
    });
    const tx = new Transaction().add(ix);
    return sendAndConfirmTransaction(ctx.connection, tx, [from], { commitment: "confirmed" });
  }

  async function topUpWallet(from: Keypair, to: PublicKey, targetLamports: number): Promise<void> {
    const current = await ctx.connection.getBalance(to, "confirmed");
    if (current >= targetLamports) {
      return;
    }
    const needed = targetLamports - current;
    await fundWallet(from, to, needed);
  }

  app.post("/demo/setup", async (req) => {
    if (state.setupInProgress) {
      throw new Error("Setup already in progress. Wait for completion and try again.");
    }
    state.setupInProgress = true;
    try {
    const input = setupSchema.parse(req.body ?? {});
    const existing = ctx.runner.listAgents();
    if (existing.length < input.numAgents) {
      await ctx.runner.createAgents(input.numAgents - existing.length);
    }
    const setupAgents = ctx.runner.listAgents().slice(0, input.numAgents);

    const adminCreated = await ctx.signerProvider.createSigner();
    state.adminAgentId = adminCreated.agentId;
    const adminSigner = await ctx.signerProvider.getSigner(adminCreated.agentId);
    const fundedSigner = loadFundedSigner();

    const fundedBalance = await ctx.connection.getBalance(fundedSigner.publicKey, "confirmed");
    const requiredLamports =
      input.adminFundLamports + setupAgents.length * input.agentFundLamports + input.reserveLamports;
    if (fundedBalance < requiredLamports) {
      throw new Error(
        `Funded signer ${fundedSigner.publicKey.toBase58()} has insufficient SOL (${fundedBalance} lamports). Need at least ${requiredLamports} lamports for setup with ${setupAgents.length} agents.`
      );
    }

    await topUpWallet(fundedSigner, adminSigner.publicKey, input.adminFundLamports);

    const mintA = await createMint(ctx.connection, adminSigner, adminSigner.publicKey, null, 6);
    const mintB = await createMint(ctx.connection, adminSigner, adminSigner.publicKey, null, 6);

    const [poolStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_state"), mintA.toBuffer(), mintB.toBuffer()],
      ctx.programId
    );
    const [poolAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_authority"), poolStatePda.toBuffer()],
      ctx.programId
    );

    const vaultA = getAssociatedTokenAddressSync(mintA, poolAuthorityPda, true);
    const vaultB = getAssociatedTokenAddressSync(mintB, poolAuthorityPda, true);

    if (state.adminAgentId) {
      const initIx = ctx.protocol.buildInitializePoolInstruction(adminSigner.publicKey, mintA, mintB, {
        poolState: poolStatePda,
        poolAuthority: poolAuthorityPda,
        vaultA,
        vaultB
      });
      const sig = await ctx.wallet.submitInstructions(state.adminAgentId, [initIx]);
      state.signatures.push(sig);
    }

    await mintTo(
      ctx.connection,
      adminSigner,
      mintB,
      vaultB,
      adminSigner.publicKey,
      input.seedAmount
    );
    await mintTo(
      ctx.connection,
      adminSigner,
      mintA,
      vaultA,
      adminSigner.publicKey,
      input.seedAmount
    );

    for (const agent of setupAgents) {
      const signer = await ctx.signerProvider.getSigner(agent.agentId);
      await topUpWallet(fundedSigner, signer.publicKey, input.agentFundLamports);

      const agentAtaA = await getOrCreateAssociatedTokenAccount(
        ctx.connection,
        adminSigner,
        mintA,
        signer.publicKey
      );
      await getOrCreateAssociatedTokenAccount(ctx.connection, adminSigner, mintB, signer.publicKey);
      await mintTo(
        ctx.connection,
        adminSigner,
        mintA,
        agentAtaA.address,
        adminSigner.publicKey,
        input.seedAmount
      );
    }

    state.mintA = mintA;
    state.mintB = mintB;
    state.poolState = poolStatePda;
    state.poolAuthority = poolAuthorityPda;
    state.vaultA = vaultA;
    state.vaultB = vaultB;
    void ctx.notifier
      ?.send(
        `Autarch District\nDemo setup complete.\nAgents: ${setupAgents.length}\nMintA: ${mintA.toBase58()}\nMintB: ${mintB.toBase58()}`
      )
      .catch(() => undefined);

    return {
      ok: true,
      mintA: mintA.toBase58(),
      mintB: mintB.toBase58(),
      poolAuthority: poolAuthorityPda.toBase58(),
      agents: ctx.runner.listAgents().length
    };
    } finally {
      state.setupInProgress = false;
    }
  });

  app.post("/demo/run", async (req) => {
    if (state.setupInProgress) {
      throw new Error("Setup in progress. Wait for /demo/setup to complete.");
    }
    if (!state.mintA || !state.mintB || !state.poolState || !state.poolAuthority || !state.vaultA || !state.vaultB) {
      throw new Error("Demo not initialized. Call /demo/setup first.");
    }
    const parsed = runSchema.parse(req.body ?? {});
    const amount = Math.min(parsed.amount, ctx.demoSwapAmount);
    const agents = ctx.runner.listAgents();
    const signatures: string[] = [];
    const errors: Array<{ agentId: string; err: string }> = [];

    for (let round = 0; round < parsed.rounds; round += 1) {
      for (const agent of agents) {
        try {
          const user = new PublicKey(agent.publicKey);
          const userSourceAta = getAssociatedTokenAddressSync(state.mintA, user);
          const userDestAta = getAssociatedTokenAddressSync(state.mintB, user);
          const ix = ctx.protocol.buildSwapInstruction(user, "A_TO_B", amount, {
            poolState: state.poolState,
            poolAuthority: state.poolAuthority,
            userSource: userSourceAta,
            userDestination: userDestAta,
            vaultSource: state.vaultA,
            vaultDestination: state.vaultB,
            sourceMint: state.mintA,
            destinationMint: state.mintB
          });
          const sig = await ctx.wallet.submitSwap(agent.agentId, ix, amount);
          signatures.push(sig);
        } catch (err) {
          errors.push({
            agentId: agent.agentId,
            err: err instanceof Error ? err.message : String(err)
          });
        }
      }
    }

    state.signatures.push(...signatures);
    void ctx.notifier
      ?.send(
        `Autarch District\nDemo run complete.\nRounds: ${parsed.rounds}\nAmount: ${amount}\nSuccess: ${signatures.length}\nErrors: ${errors.length}`
      )
      .catch(() => undefined);
    return { ok: true, rounds: parsed.rounds, amount, signatures, errors };
  });

  app.post("/demo/stop", async () => {
    ctx.runner.stop();
    void ctx.notifier?.send("Autarch District\nDemo stopped. Agent execution halted.").catch(() => undefined);
    return { ok: true, signatures: state.signatures.slice(-50) };
  });
}
