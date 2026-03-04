import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

type LoadFundedSignerInput = {
  signerPrivateKey?: string;
  solanaKeypairPath?: string;
};

const DEFAULT_KEYPAIR_PATH = join(homedir(), ".config", "solana", "id.json");

function decodeSecretKey(secret: string): Uint8Array {
  const trimmed = secret.trim();

  // JSON array format: [12,34,...]
  if (trimmed.startsWith("[")) {
    const raw = JSON.parse(trimmed) as number[];
    return Uint8Array.from(raw);
  }

  // Base64 format
  try {
    const base64 = Buffer.from(trimmed, "base64");
    if (base64.length === 64) {
      return new Uint8Array(base64);
    }
  } catch {
    // ignore and try base58
  }

  // Base58 format
  return bs58.decode(trimmed);
}

export function loadFundedSigner(input: LoadFundedSignerInput): Keypair {
  const envSecret = input.signerPrivateKey?.trim();
  if (envSecret) {
    try {
      const decoded = decodeSecretKey(envSecret);
      return Keypair.fromSecretKey(decoded);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to decode SIGNER_PRIVATE_KEY: ${message}`);
    }
  }

  const keypairPath = input.solanaKeypairPath?.trim() || DEFAULT_KEYPAIR_PATH;
  const raw = JSON.parse(readFileSync(keypairPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}
