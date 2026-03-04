export interface KMSProvider {
  encrypt(data: Buffer): Promise<{ ciphertext: Buffer; keyId: string }>;
  decrypt(ciphertext: Buffer, keyId: string): Promise<Buffer>;
  rotateKey(): Promise<string>;
}
