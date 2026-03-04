import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import type { KMSProvider } from "./kms.js";

const AES_GCM_ALGO = "aes-256-gcm";
const IV_SIZE = 12;
const TAG_SIZE = 16;

function encryptAesGcm(plaintext: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_SIZE);
  const cipher = createCipheriv(AES_GCM_ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

function decryptAesGcm(payload: Buffer, key: Buffer): Buffer {
  if (payload.length <= IV_SIZE + TAG_SIZE) {
    throw new Error("Invalid ciphertext payload.");
  }

  const iv = payload.subarray(0, IV_SIZE);
  const tag = payload.subarray(IV_SIZE, IV_SIZE + TAG_SIZE);
  const ciphertext = payload.subarray(IV_SIZE + TAG_SIZE);

  const decipher = createDecipheriv(AES_GCM_ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export class DevKmsProvider implements KMSProvider {
  private readonly keyRegistry = new Map<string, Buffer>();
  private activeKeyId: string;

  constructor(masterKeyBase64: string) {
    const masterKey = Buffer.from(masterKeyBase64, "base64");
    if (masterKey.length !== 32) {
      throw new Error("KMS_MASTER_KEY_BASE64 must decode to exactly 32 bytes.");
    }
    this.activeKeyId = `dev-${randomUUID()}`;
    this.keyRegistry.set(this.activeKeyId, masterKey);
  }

  async encrypt(data: Buffer): Promise<{ ciphertext: Buffer; keyId: string }> {
    const key = this.requireKey(this.activeKeyId);
    const ciphertext = encryptAesGcm(data, key);
    return { ciphertext, keyId: this.activeKeyId };
  }

  async decrypt(ciphertext: Buffer, keyId: string): Promise<Buffer> {
    const key = this.requireKey(keyId);
    return decryptAesGcm(ciphertext, key);
  }

  async rotateKey(): Promise<string> {
    const current = this.requireKey(this.activeKeyId);
    const nextKeyId = `dev-${randomUUID()}`;
    this.keyRegistry.set(nextKeyId, current);
    this.activeKeyId = nextKeyId;
    return nextKeyId;
  }

  private requireKey(keyId: string): Buffer {
    const key = this.keyRegistry.get(keyId);
    if (!key) {
      throw new Error(`Unknown KMS key id: ${keyId}`);
    }
    return key;
  }
}
