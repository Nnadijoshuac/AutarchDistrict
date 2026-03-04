import { createMint, getAccount, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { AgentRunner } from "./agents/agentRunner.js";
import { loadConfig } from "./config.js";
import { createLogger } from "./observability/logger.js";
import { SANDBOX_PROFILE, type PolicyProfile } from "./policy/policyProfile.js";
import { SpendDb } from "./policy/spendDb.js";
import { TxPolicyEngine } from "./policy/txPolicyEngine.js";
import { MockDefiClient } from "./protocol/mockDefiClient.js";
import { DevKmsProvider } from "./security/devKmsProvider.js";
import { FileKeystore } from "./security/keystore.js";
import { createConnection } from "./solana/connection.js";
import {
  ATA_PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  SPL_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID
} from "./solana/constants.js";
import { StrategyLoader } from "./strategies/strategyLoader.js";
import { LocalEncryptedKeystoreSignerProvider } from "./wallet/signerImpl.js";
import { WalletExecutor } from "./wallet/txBuilder.js";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL);
  const connection = createConnection(config.SOLANA_RPC_URL, config.SOLANA_WS_URL);
  const programId = new PublicKey(config.PROGRAM_ID);

  const kmsProvider = new DevKmsProvider(config.KMS_MASTER_KEY_BASE64);
  const keystore = new FileKeystore("data/keystore.json", kmsProvider);
  const spendDb = new SpendDb("data/spend-db.json");
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
  const protocol = new MockDefiClient(programId);
  const strategyLoader = await StrategyLoader.create(config.DEMO_SWAP_AMOUNT);
  const runner = new AgentRunner(
    wallet,
    protocol,
    strategyLoader,
    "randomSwap",
    buildAgentPolicyProfile
  );

  logger.info("Step 1: create admin + agents");
  const admin = await signerProvider.createSigner();
  const adminSigner = await signerProvider.getSigner(admin.agentId);
  await connection.requestAirdrop(adminSigner.publicKey, 2_000_000_000);
  const agents = await runner.createAgents(config.DEMO_NUM_AGENTS);

  logger.info("Step 2: create mints + seed");
  const mintA = await createMint(connection, adminSigner, adminSigner.publicKey, null, 6);
  const mintB = await createMint(connection, adminSigner, adminSigner.publicKey, null, 6);

  const allSignatures: string[] = [];
  for (const agent of agents) {
    const signer = await signerProvider.getSigner(agent.agentId);
    await connection.requestAirdrop(signer.publicKey, 1_000_000_000);
    const ataA = await getOrCreateAssociatedTokenAccount(connection, adminSigner, mintA, signer.publicKey);
    await getOrCreateAssociatedTokenAccount(connection, adminSigner, mintB, signer.publicKey);
    await mintTo(connection, adminSigner, mintA, ataA.address, adminSigner.publicKey, 100_000);
  }

  logger.info("Step 3: attempt pool init");
  try {
    const initIx = protocol.buildInitializePoolInstruction(adminSigner.publicKey, mintA, mintB);
    const sig = await wallet.submitInstructions(admin.agentId, [initIx]);
    allSignatures.push(sig);
  } catch (err) {
    logger.warn({ err }, "initialize_pool transaction failed (continuing)");
  }

  logger.info("Step 4: fixed swap rounds");
  for (let i = 0; i < 3; i += 1) {
    for (const agent of agents) {
      try {
        const ix = protocol.buildSwapInstruction(new PublicKey(agent.publicKey), "A_TO_B", config.DEMO_SWAP_AMOUNT);
        const sig = await wallet.submitSwap(agent.agentId, ix, config.DEMO_SWAP_AMOUNT);
        allSignatures.push(sig);
      } catch (err) {
        logger.warn({ agentId: agent.agentId, err }, "swap failed");
      }
    }
  }

  logger.info("Step 5: summary");
  const summary = [];
  for (const agent of agents) {
    const signer = await signerProvider.getSigner(agent.agentId);
    const sol = await connection.getBalance(signer.publicKey, "confirmed");
    const ataA = await getOrCreateAssociatedTokenAccount(connection, adminSigner, mintA, signer.publicKey);
    const ataB = await getOrCreateAssociatedTokenAccount(connection, adminSigner, mintB, signer.publicKey);
    const balA = await getAccount(connection, ataA.address);
    const balB = await getAccount(connection, ataB.address);
    summary.push({
      agentId: agent.agentId,
      publicKey: signer.publicKey.toBase58(),
      solLamports: sol,
      tokenA: balA.amount.toString(),
      tokenB: balB.amount.toString()
    });
  }

  logger.info({ mintA: mintA.toBase58(), mintB: mintB.toBase58(), signatures: allSignatures, summary }, "demo complete");
}

void main();
