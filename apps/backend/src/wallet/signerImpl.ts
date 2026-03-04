import { Keypair } from "@solana/web3.js";
import { FileKeystore } from "../security/keystore.js";
import type { SignerProvider } from "./signer.js";

export class LocalEncryptedKeystoreSignerProvider implements SignerProvider {
  constructor(private readonly keystore: FileKeystore) {}

  async createSigner(): Promise<{ agentId: string; publicKey: string }> {
    return this.keystore.createSigner();
  }

  async getSigner(agentId: string): Promise<Keypair> {
    return this.keystore.getSigner(agentId);
  }

  async listSigners(): Promise<Array<{ agentId: string; publicKey: string; createdAt: string }>> {
    return this.keystore.listSigners();
  }
}

export class MockKmsSignerProvider implements SignerProvider {
  private readonly memory = new Map<string, Keypair>();

  async createSigner(): Promise<{ agentId: string; publicKey: string }> {
    const kp = Keypair.generate();
    const agentId = `kms-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    this.memory.set(agentId, kp);
    return { agentId, publicKey: kp.publicKey.toBase58() };
  }

  async getSigner(agentId: string): Promise<Keypair> {
    const kp = this.memory.get(agentId);
    if (!kp) {
      throw new Error(`MockKMS signer not found for ${agentId}`);
    }
    return kp;
  }

  async listSigners(): Promise<Array<{ agentId: string; publicKey: string; createdAt: string }>> {
    return [...this.memory.entries()].map(([agentId, kp]) => ({
      agentId,
      publicKey: kp.publicKey.toBase58(),
      createdAt: new Date().toISOString()
    }));
  }
}
