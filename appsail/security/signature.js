import crypto from "crypto";

export function verifyWebhookSignature({ rawBody, signature, secret }) {
  if (!secret || !signature || !rawBody) return false;

  // Salla sends header "x-salla-signature"
  // Sometimes providers prefix like "sha256=..."
  const sig = signature.replace(/^sha256=/i, "").trim();

  // Assumption (matches common Salla pattern): HMAC-SHA256(secret, rawBody)
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  // timing-safe compare
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}
