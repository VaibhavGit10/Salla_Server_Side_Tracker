import crypto from "crypto";

/**
 * AES-256-GCM encryption (production-grade)
 * ENCRYPTION_KEY must be 32 bytes (or base64 that decodes to 32 bytes).
 */

// Accept plain 32-char string OR base64-encoded key
function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY missing");

  // If base64, decode it, else use utf8
  const buf = /^[A-Za-z0-9+/=]+$/.test(raw) ? Buffer.from(raw, "base64") : Buffer.from(raw, "utf8");

  if (buf.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be 32 bytes. Current length: ${buf.length}. Use a 32-byte key or base64 of 32 bytes.`
    );
  }

  return buf;
}

const ALGO = "aes-256-gcm";

export function encrypt(plainText) {
  if (plainText === undefined || plainText === null) return null;

  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM

  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  // store: iv + tag + encrypted (base64)
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(cipherText) {
  if (!cipherText) return null;

  const key = getKey();
  const raw = Buffer.from(String(cipherText), "base64");

  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(enc),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}
