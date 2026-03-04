import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { loadFundedSigner } from "../src/solana/fundedSigner.js";

describe("funded signer loader", () => {
  it("loads keypair from SIGNER_PRIVATE_KEY json array", () => {
    const signer = Keypair.generate();
    const json = JSON.stringify(Array.from(signer.secretKey));

    const loaded = loadFundedSigner({ signerPrivateKey: json });
    expect(loaded.publicKey.toBase58()).toBe(signer.publicKey.toBase58());
  });

  it("loads keypair from SIGNER_PRIVATE_KEY base58", () => {
    const signer = Keypair.generate();
    const encoded = bs58.encode(signer.secretKey);

    const loaded = loadFundedSigner({ signerPrivateKey: encoded });
    expect(loaded.publicKey.toBase58()).toBe(signer.publicKey.toBase58());
  });

  it("falls back to SOLANA_KEYPAIR_PATH when env secret is not provided", () => {
    const signer = Keypair.generate();
    const dir = mkdtempSync(join(tmpdir(), "autarch-funded-signer-"));
    const path = join(dir, "id.json");
    writeFileSync(path, JSON.stringify(Array.from(signer.secretKey)));

    const loaded = loadFundedSigner({ solanaKeypairPath: path });
    expect(loaded.publicKey.toBase58()).toBe(signer.publicKey.toBase58());
  });
});
