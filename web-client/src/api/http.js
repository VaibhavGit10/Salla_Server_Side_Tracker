const BASE_URL = process.env.REACT_APP_API_BASE_URL || "";

export async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) throw new Error("API error");
  return res.json();
}
