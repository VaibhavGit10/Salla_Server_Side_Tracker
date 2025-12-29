import axios from "axios";

export async function exchangeCodeForToken(code) {
  // 🔹 TEMP MOCK MODE (DEV ONLY)
  // Remove this block when real store install works
  if (process.env.NODE_ENV !== "production") {
    return {
      access_token: `mock_access_token_${code}`,
      refresh_token: "mock_refresh_token",
      scope: "orders.read"
    };
  }

  // 🔹 REAL SALLA TOKEN EXCHANGE (PRODUCTION)
  const response = await axios.post(
    process.env.SALLA_TOKEN_URL,
    {
      grant_type: "authorization_code",
      client_id: process.env.SALLA_CLIENT_ID,
      client_secret: process.env.SALLA_CLIENT_SECRET,
      code
    },
    {
      headers: { "Content-Type": "application/json" }
    }
  );

  return response.data;
}
