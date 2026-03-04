import { Keypair } from "@solana/web3.js";

export interface SignerProvider {
  createSigner(): Promise<{ agentId: string; publicKey: string }>;
  getSigner(agentId: string): Promise<Keypair>;
  listSigners(): Promise<Array<{ agentId: string; publicKey: string; createdAt: string }>>;
}
