import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DevKmsProvider } from "../src/security/devKmsProvider.js";
import { FileKeystore } from "../src/security/keystore.js";

const MASTER_KEY_B64 = Buffer.alloc(32, 7).toString("base64");

describe("keystore envelope encryption", () => {
  it("creates and restores encrypted signer", async () => {
    const dir = mkdtempSync(join(tmpdir(), "autarch-keystore-"));
    const kms = new DevKmsProvider(MASTER_KEY_B64);
    const keystore = new FileKeystore(join(dir, "keystore.json"), kms);

    const created = await keystore.createSigner();
    const signer = await keystore.getSigner(created.agentId);

    expect(signer.publicKey.toBase58()).toBe(created.publicKey);

    const raw = JSON.parse(readFileSync(join(dir, "keystore.json"), "utf8")) as {
      version: number;
      agents: Array<{
        agentId: string;
        encryptedSecret: string;
        encryptedDataKey: string;
        keyId: string;
        createdAt: string;
      }>;
    };

    expect(raw.version).toBe(2);
    expect(raw.agents).toHaveLength(1);
    expect(raw.agents[0]).toMatchObject({
      agentId: created.agentId
    });
    expect(raw.agents[0].encryptedSecret).not.toContain(created.publicKey);
  });

  it("rotates encrypted data key for an agent", async () => {
    const dir = mkdtempSync(join(tmpdir(), "autarch-keystore-rotate-"));
    const kms = new DevKmsProvider(MASTER_KEY_B64);
    const keystore = new FileKeystore(join(dir, "keystore.json"), kms);

    const created = await keystore.createSigner();
    const before = JSON.parse(readFileSync(join(dir, "keystore.json"), "utf8")) as {
      agents: Array<{ encryptedDataKey: string; keyId: string }>;
    };

    await kms.rotateKey();
    await keystore.rotateAgentKey(created.agentId);

    const after = JSON.parse(readFileSync(join(dir, "keystore.json"), "utf8")) as {
      agents: Array<{ encryptedDataKey: string; keyId: string }>;
    };

    expect(after.agents[0].encryptedDataKey).not.toBe(before.agents[0].encryptedDataKey);
    expect(after.agents[0].keyId).not.toBe(before.agents[0].keyId);

    const signer = await keystore.getSigner(created.agentId);
    expect(signer.publicKey.toBase58()).toBe(created.publicKey);
  });
});
