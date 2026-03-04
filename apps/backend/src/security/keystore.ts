import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { dirname } from "node:path";
import { Keypair } from "@solana/web3.js";
import type { KMSProvider } from "./kms.js";

const STORE_VERSION = 2;
const AES_GCM_ALGO = "aes-256-gcm";
const IV_SIZE = 12;
const TAG_SIZE = 16;

export type StoredAgentSecret = {
  agentId: string;
  encryptedSecret: string;
  encryptedDataKey: string;
  keyId: string;
  createdAt: string;
};

type KeystoreFile = {
  version: number;
  agents: StoredAgentSecret[];
};

function encryptWithDataKey(plaintext: Buffer, dataKey: Buffer): string {
  const iv = randomBytes(IV_SIZE);
  const cipher = createCipheriv(AES_GCM_ALGO, dataKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

function decryptWithDataKey(payloadBase64: string, dataKey: Buffer): Buffer {
  const payload = Buffer.from(payloadBase64, "base64");
  if (payload.length <= IV_SIZE + TAG_SIZE) {
    throw new Error("Invalid encrypted secret payload.");
  }

  const iv = payload.subarray(0, IV_SIZE);
  const tag = payload.subarray(IV_SIZE, IV_SIZE + TAG_SIZE);
  const ciphertext = payload.subarray(IV_SIZE + TAG_SIZE);

  const decipher = createDecipheriv(AES_GCM_ALGO, dataKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export class FileKeystore {
  constructor(
    private readonly filePath: string,
    private readonly kmsProvider: KMSProvider
  ) {
    this.ensureStore();
  }

  private ensureStore(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (!existsSync(this.filePath)) {
      const empty: KeystoreFile = { version: STORE_VERSION, agents: [] };
      writeFileSync(this.filePath, JSON.stringify(empty, null, 2));
    }
  }

  private readStore(): KeystoreFile {
    const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as KeystoreFile;
    if (parsed.version !== STORE_VERSION) {
      throw new Error(`Unsupported keystore version: ${parsed.version}`);
    }
    return parsed;
  }

  private writeStore(store: KeystoreFile): void {
    writeFileSync(this.filePath, JSON.stringify(store, null, 2));
  }

  async createSigner(): Promise<{ agentId: string; publicKey: string }> {
    const kp = Keypair.generate();
    const agentId = `agent-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

    const dataKey = randomBytes(32);
    const encryptedSecret = encryptWithDataKey(Buffer.from(kp.secretKey), dataKey);
    const { ciphertext, keyId } = await this.kmsProvider.encrypt(dataKey);

    const store = this.readStore();
    store.agents.push({
      agentId,
      encryptedSecret,
      encryptedDataKey: ciphertext.toString("base64"),
      keyId,
      createdAt: new Date().toISOString()
    });
    this.writeStore(store);

    return { agentId, publicKey: kp.publicKey.toBase58() };
  }

  async getSigner(agentId: string): Promise<Keypair> {
    const store = this.readStore();
    const found = store.agents.find((agent) => agent.agentId === agentId);
    if (!found) {
      throw new Error(`Signer not found for agentId=${agentId}`);
    }

    const dataKey = await this.kmsProvider.decrypt(Buffer.from(found.encryptedDataKey, "base64"), found.keyId);
    const secret = decryptWithDataKey(found.encryptedSecret, dataKey);
    return Keypair.fromSecretKey(secret);
  }

  async rotateAgentKey(agentId: string): Promise<void> {
    const store = this.readStore();
    const idx = store.agents.findIndex((agent) => agent.agentId === agentId);
    if (idx < 0) {
      throw new Error(`Signer not found for agentId=${agentId}`);
    }

    const current = store.agents[idx];
    const currentDataKey = await this.kmsProvider.decrypt(Buffer.from(current.encryptedDataKey, "base64"), current.keyId);
    const secret = decryptWithDataKey(current.encryptedSecret, currentDataKey);

    const newDataKey = randomBytes(32);
    const encryptedSecret = encryptWithDataKey(secret, newDataKey);
    const { ciphertext, keyId } = await this.kmsProvider.encrypt(newDataKey);

    store.agents[idx] = {
      ...current,
      encryptedSecret,
      encryptedDataKey: ciphertext.toString("base64"),
      keyId
    };
    this.writeStore(store);
  }

  async listSigners(): Promise<Array<{ agentId: string; publicKey: string; createdAt: string }>> {
    const store = this.readStore();
    const out: Array<{ agentId: string; publicKey: string; createdAt: string }> = [];

    for (const agent of store.agents) {
      const dataKey = await this.kmsProvider.decrypt(Buffer.from(agent.encryptedDataKey, "base64"), agent.keyId);
      const secret = decryptWithDataKey(agent.encryptedSecret, dataKey);
      const kp = Keypair.fromSecretKey(secret);
      out.push({
        agentId: agent.agentId,
        publicKey: kp.publicKey.toBase58(),
        createdAt: agent.createdAt
      });
    }

    return out;
  }

  getStoredAgent(agentId: string): StoredAgentSecret {
    const store = this.readStore();
    const found = store.agents.find((agent) => agent.agentId === agentId);
    if (!found) {
      throw new Error(`Signer metadata not found for agentId=${agentId}`);
    }
    return found;
  }
}
