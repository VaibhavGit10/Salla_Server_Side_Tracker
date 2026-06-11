

import crypto from "crypto";

function sha256hex(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

export function hashEmail(raw) {
  if (!raw) return null;
  const normalized = String(raw).toLowerCase().trim();
  if (!normalized) return null;
  return sha256hex(normalized);
}

export function hashPhone(raw, defaultCountryCode = "966") {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // Add country code if number looks local (≤ 10 digits, doesn't start with a known code)
  if (digits.length <= 10 && !digits.startsWith("1") && !digits.startsWith("9")) {
    digits = defaultCountryCode + digits;
  } else if (digits.length === 9) {
    digits = defaultCountryCode + digits;
  }
  return sha256hex(digits);
}

export function hashField(raw) {
  if (!raw) return null;
  const normalized = String(raw).toLowerCase().trim().replace(/\s+/g, "");
  if (!normalized) return null;
  return sha256hex(normalized);
}

/**
 * Build HashedUserData from a Salla customer object.
 * Returns only fields that have data — never includes null/undefined values.
 */
export function buildHashedUserData(customer) {
  if (!customer) return {};

  const result = {};

  // Email
  const email = customer.email;
  if (email) {
    const h = hashEmail(email);
    if (h) result.em = [h];
  }

  // Phone — try multiple field names Salla may use
  const phone = customer.mobile || customer.phone || customer.mobile_code;
  if (phone) {
    const countryCode = customer.country_code === "AE" ? "971"
      : customer.country_code === "KW" ? "965"
      : customer.country_code === "QA" ? "974"
      : "966"; // Default Saudi
    const h = hashPhone(phone, countryCode);
    if (h) result.ph = [h];
  }

  // Names
  if (customer.first_name) {
    const h = hashField(customer.first_name);
    if (h) result.fn = h;
  }
  if (customer.last_name) {
    const h = hashField(customer.last_name);
    if (h) result.ln = h;
  }

  // Address — try both direct fields and addresses array
  const addr = Array.isArray(customer.addresses) ? customer.addresses[0] : null;
  const city = customer.city || addr?.city;
  if (city) {
    const h = hashField(city);
    if (h) result.ct = h;
  }

  const zip = customer.zip || customer.postal_code || addr?.zip_code || addr?.postal_code;
  if (zip) {
    const h = hashField(zip);
    if (h) result.zp = h;
  }

  const country = (customer.country_code || addr?.country_code || "").toLowerCase();
  if (country) {
    const h = hashField(country);
    if (h) result.country = h;
  }

  // External ID (hashed customer ID)
  if (customer.id) {
    const h = hashField(String(customer.id));
    if (h) result.external_id = h;
  }

  return result;
}

/**
 * Build a deterministic dedup event ID per BRD spec.
 * dedup_id = SHA-256(store_id + ':' + order_id + ':' + event_type)
 */
export function buildDedupId(store_id, order_id, event_type) {
  return sha256hex(`${store_id}:${order_id}:${event_type}`);
}
