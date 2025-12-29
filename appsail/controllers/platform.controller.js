export async function connectGA4(req, res) {
  const { measurement_id, api_secret } = req.body;

  if (!measurement_id || !api_secret) {
    return res.status(400).json({ error: "Invalid GA4 config" });
  }

  // TODO: save encrypted GA4 config
  res.json({ status: "ga4_connected" });
}
