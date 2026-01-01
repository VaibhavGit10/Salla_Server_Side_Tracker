import crypto from "crypto";

/**
 * AES-256-GCM encryption (production-grade)
 *
 * Supports ENCRYPTION_KEY formats:
 * 1) 64-hex chars (represents 32 bytes) ✅ your current key
 * 2) base64 string that decodes to 32 bytes
 * 3) raw UTF-8 string that is exactly 32 bytes
 *
 * Output format: base64(iv + tag + ciphertext)
 * - iv: 12 bytes
 * - tag: 16 bytes
 * - ciphertext: variable
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;   // 96-bit nonce recommended for GCM
const TAG_LEN = 16;  // 128-bit auth tag

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY missing");

  let keyBuf;

  // ✅ Case 1: 64 hex chars => 32 bytes (your current format)
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    keyBuf = Buffer.from(raw, "hex");
  } else {
    // Case 2: base64 OR Case 3: utf8
    // Detect base64-ish strings; if decode fails, fallback to utf8
    const looksBase64 = /^[A-Za-z0-9+/=]+$/.test(raw);

    if (looksBase64) {
      try {
        keyBuf = Buffer.from(raw, "base64");
      } catch {
        keyBuf = Buffer.from(raw, "utf8");
      }
    } else {
      keyBuf = Buffer.from(raw, "utf8");
    }
  }

  if (keyBuf.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be 32 bytes. Current length: ${keyBuf.length}. ` +
      `Use: hex(64 chars) OR base64(32 bytes) OR raw utf8(32 chars).`
    );
  }

  return keyBuf;
}

export function encrypt(plainText) {
  if (plainText === undefined || plainText === null) return null;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);

  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag(); // 16 bytes

  // Store as base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decrypt(cipherText) {
  if (!cipherText) return null;

  const key = getKey();
  const raw = Buffer.from(String(cipherText), "base64");

  if (raw.length < IV_LEN + TAG_LEN) {
    throw new Error("Invalid cipherText: too short");
  }

  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN + TAG_LEN);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return plaintext.toString("utf8");
}
