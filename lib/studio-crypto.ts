import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required to encrypt studio API keys");
  }
  cachedKey = scryptSync(secret, "openrouter-studio-api-key", 32, { N: 16384 });
  return cachedKey;
}

/** Encrypt for storage in SQLite (AES-256-GCM). */
export function encryptApiKey(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const key = getKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptApiKey(blob: string): string {
  if (!blob) return "";
  const buf = Buffer.from(blob, "base64");
  if (buf.length < 28) return "";
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = getKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
