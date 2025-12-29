import { useState } from "react";
import Container from "../components/layout/Container";
import PlatformCard from "../components/cards/PlatformCard";
import { validateGA4 } from "../api/platforms.api";
import { getStoreId } from "../utils/store";

export default function Platforms() {
  const storeId = getStoreId();

  const [measurementId, setMeasurementId] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [status, setStatus] = useState("disconnected");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      await validateGA4({
        store_id: storeId,
        measurement_id: measurementId.trim(),
        api_secret: apiSecret.trim()
      });

      setStatus("connected");
    } catch (err) {
      setError(err?.message || "Failed to connect GA4");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container
      title="Platform Connections"
      subtitle="Connect ad platforms for server-side tracking"
    >
      <PlatformCard
        name="Google Analytics 4"
        description="Send server-side purchase events to GA4"
        status={status}
      >
        {status !== "connected" && (
          <>
            <div className="form-row">
              <input
                placeholder="Measurement ID (G-XXXXXXX)"
                value={measurementId}
                onChange={e => setMeasurementId(e.target.value)}
                disabled={loading}
              />
              <input
                placeholder="API Secret"
                value={apiSecret}
                onChange={e => setApiSecret(e.target.value)}
                disabled={loading}
              />
            </div>

            <button onClick={handleConnect} disabled={loading}>
              {loading ? "Validating..." : "Connect GA4"}
            </button>

            {error && <p className="error">{error}</p>}
          </>
        )}

        {status === "connected" && (
          <p className="success">GA4 is successfully connected.</p>
        )}
      </PlatformCard>
    </Container>
  );
}
