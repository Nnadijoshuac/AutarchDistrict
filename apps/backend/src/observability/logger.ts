import pino from "pino";

export function createLogger(level: string) {
  return pino({
    level,
    redact: ["secretKey", "KEYSTORE_MASTER_KEY", "KMS_MASTER_KEY_BASE64"],
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime
  });
}
