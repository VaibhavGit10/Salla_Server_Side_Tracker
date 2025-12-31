import crypto from "crypto";

function normalizeSignature(sig) {
  if (!sig) return "";

  return String(sig)
    .replace(/^Bearer\s+/i, "")
    .replace(/^sha256=/i, "")
    .trim();
}

export function verifyWebhookSignature({ rawBody, signature, secret }) {
  if (!rawBody || !signature || !secret) return false;

  // rawBody MUST be Buffer (from express.json verify)
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), "utf8");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(buf)
    .digest("hex");

  const got = normalizeSignature(signature);

  // ✅ reject invalid formats early (prevents timingSafeEqual throw / mismatch)
  if (!/^[a-f0-9]{64}$/i.test(got)) return false;

  // ✅ timing-safe compare on Buffer (same length guaranteed now)
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(got, "hex")
  );
}
