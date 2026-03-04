import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Connection,
  type SendOptions
} from "@solana/web3.js";
import type { PolicyProfile } from "../policy/policyProfile.js";
import { SANDBOX_PROFILE } from "../policy/policyProfile.js";
import { TxPolicyEngine } from "../policy/txPolicyEngine.js";
import type { SignerProvider } from "./signer.js";
import { sendWithRetry } from "./confirm.js";

export class WalletExecutor {
  constructor(
    private readonly connection: Connection,
    private readonly signerProvider: SignerProvider,
    private readonly policy: TxPolicyEngine
  ) {}

  async submitInstructions(
    agentId: string,
    instructions: TransactionInstruction[],
    options?: SendOptions,
    profile: PolicyProfile = SANDBOX_PROFILE,
    lamports = 0,
    slippageBps = 0
  ): Promise<string> {
    this.policy.assertTransaction({ instructions, lamports, slippageBps }, agentId, profile);

    const signer = await this.signerProvider.getSigner(agentId);
    const payer = signer.publicKey;

    const txBuilder = async () => {
      const latest = await this.connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({
        feePayer: payer,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight
      }).add(...instructions);

      const simulation = await this.connection.simulateTransaction(tx, [signer]);
      if (simulation.value.err) {
        const logs = simulation.value.logs?.join(" | ") ?? "no logs";
        throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)} :: ${logs}`);
      }

      tx.sign(signer);
      return { tx, lastValidBlockHeight: latest.lastValidBlockHeight };
    };

    return sendWithRetry(this.connection, txBuilder, options);
  }

  async transferSol(
    agentId: string,
    to: PublicKey,
    lamports: number,
    profile: PolicyProfile = SANDBOX_PROFILE
  ): Promise<string> {
    const from = (await this.signerProvider.getSigner(agentId)).publicKey;
    const ix = SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports });
    return this.submitInstructions(agentId, [ix], undefined, profile, lamports, 0);
  }

  async createAgent(): Promise<{ agentId: string; publicKey: string }> {
    return await this.signerProvider.createSigner();
  }

  async submitSwap(
    agentId: string,
    instruction: TransactionInstruction,
    amount: number,
    profile: PolicyProfile = SANDBOX_PROFILE
  ): Promise<string> {
    return this.submitInstructions(agentId, [instruction], undefined, profile, amount, 0);
  }

  async listAgents(): Promise<Array<{ agentId: string; publicKey: string; createdAt: string }>> {
    return await this.signerProvider.listSigners();
  }
}
