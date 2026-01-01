import { useEffect, useMemo, useState } from "react";
import Container from "../components/layout/Container";
import { validateGA4, fetchStores, saveGA4, fetchGA4 } from "../api/platforms.api";
import { getStoreId, setStoreId } from "../utils/store";

export default function Platforms() {
  // ✅ active store (URL -> localStorage -> backend /platforms/stores fallback)
  const [activeStoreId, setActiveStoreId] = useState(() => getStoreId() || "");

  // ✅ stores dropdown
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(false);

  // ✅ GA4
  const [ga4MeasurementId, setGa4MeasurementId] = useState("");
  const [ga4ApiSecret, setGa4ApiSecret] = useState("");
  const [ga4Status, setGa4Status] = useState("disconnected");
  const [ga4Loading, setGa4Loading] = useState(false);
  const [ga4Error, setGa4Error] = useState("");

  // ✅ Meta
  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaStatus, setMetaStatus] = useState("disconnected");
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState("");

  // ✅ TikTok
  const [ttPixelId, setTtPixelId] = useState("");
  const [ttAccessToken, setTtAccessToken] = useState("");
  const [ttStatus, setTtStatus] = useState("disconnected");
  const [ttLoading, setTtLoading] = useState(false);
  const [ttError, setTtError] = useState("");

  // ✅ Snap
  const [snapPixelId, setSnapPixelId] = useState("");
  const [snapToken, setSnapToken] = useState("");
  const [snapStatus, setSnapStatus] = useState("disconnected");
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapError, setSnapError] = useState("");

  /**
   * ✅ Load stores from backend; choose default store if none in URL/localStorage
   * IMPORTANT: do NOT rely on stale activeStoreId inside this effect.
   */
  useEffect(() => {
    let mounted = true;
    setStoresLoading(true);

    fetchStores()
      .then((resp) => {
        if (!mounted) return;

        const rows = Array.isArray(resp?.data) ? resp.data : [];
        setStores(rows);

        const current = getStoreId(); // ✅ always read latest (not stale state)

        if (!current) {
          const picked =
            rows.find((s) => String(s.status || "").toLowerCase() === "active") || rows[0];

          if (picked?.store_id) {
            setStoreId(picked.store_id);
            setActiveStoreId(String(picked.store_id));
          }
        } else {
          // ensure state matches storage
          setActiveStoreId(String(current));
        }
      })
      .catch(() => {
        // ignore
      })
      .finally(() => mounted && setStoresLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * ✅ Prefill GA4 fields when activeStoreId changes
   */
  useEffect(() => {
    if (!activeStoreId) return;

    setGa4Error("");
    setGa4Status("disconnected");

    // reset GA4 fields on store switch (clean)
    setGa4MeasurementId("");
    setGa4ApiSecret("");

    fetchGA4(activeStoreId)
      .then((resp) => {
        const row = resp?.data;
        if (!row) return;

        setGa4MeasurementId(String(row.measurement_id || ""));
        setGa4ApiSecret(String(row.api_secret || ""));
        setGa4Status(row.enabled ? "connected" : "disconnected");
      })
      .catch(() => {
        // endpoint may not exist; ignore
      });
  }, [activeStoreId]);

  const storeLabel = useMemo(() => {
    if (!activeStoreId) return "N/A";
    const found = (stores || []).find((s) => String(s.store_id) === String(activeStoreId));
    return found ? `${found.store_id} (${found.status || "unknown"})` : activeStoreId;
  }, [activeStoreId, stores]);

  function onChangeStore(nextId) {
    const id = String(nextId || "").trim();
    if (!id) return;

    setStoreId(id);          // ✅ persists + dispatches store_id_changed event (your store.js)
    setActiveStoreId(id);    // ✅ updates dropdown immediately

    // reset statuses for clarity on store switch
    setGa4Status("disconnected");
    setMetaStatus("disconnected");
    setTtStatus("disconnected");
    setSnapStatus("disconnected");

    setGa4Error("");
    setMetaError("");
    setTtError("");
    setSnapError("");
  }

  async function connectGA4() {
    if (ga4Loading) return;
    setGa4Loading(true);
    setGa4Error("");

    try {
      if (!activeStoreId) throw new Error("Store ID not set yet.");

      const payload = {
        store_id: activeStoreId,
        measurement_id: ga4MeasurementId.trim(),
        api_secret: ga4ApiSecret.trim(),
        enabled: true
      };

      if (!payload.measurement_id || !payload.api_secret) {
        throw new Error("Please enter Measurement ID and API Secret");
      }

      await validateGA4(payload); // ✅ validate
      await saveGA4(payload);     // ✅ persist (/platforms/ga4/connect)

      setGa4Status("connected");
    } catch (err) {
      setGa4Status("disconnected");
      setGa4Error(err?.message || "Failed to connect GA4");
    } finally {
      setGa4Loading(false);
    }
  }

  async function connectMeta() {
    if (metaLoading) return;
    setMetaLoading(true);
    setMetaError("");

    try {
      if (!metaPixelId.trim() || !metaAccessToken.trim()) {
        throw new Error("Please enter Pixel ID and Access Token");
      }
      setMetaStatus("connected");
    } catch (err) {
      setMetaError(err?.message || "Failed to connect Meta");
    } finally {
      setMetaLoading(false);
    }
  }

  async function connectTikTok() {
    if (ttLoading) return;
    setTtLoading(true);
    setTtError("");

    try {
      if (!ttPixelId.trim() || !ttAccessToken.trim()) {
        throw new Error("Please enter Pixel ID and Access Token");
      }
      setTtStatus("connected");
    } catch (err) {
      setTtError(err?.message || "Failed to connect TikTok");
    } finally {
      setTtLoading(false);
    }
  }

  async function connectSnap() {
    if (snapLoading) return;
    setSnapLoading(true);
    setSnapError("");

    try {
      if (!snapPixelId.trim() || !snapToken.trim()) {
        throw new Error("Please enter Pixel ID and Token");
      }
      setSnapStatus("connected");
    } catch (err) {
      setSnapError(err?.message || "Failed to connect Snap");
    } finally {
      setSnapLoading(false);
    }
  }

  return (
    <Container
      title="Platform Connections"
      subtitle={`Connect platforms for server-side tracking • Store: ${storeLabel}`}
    >
      {/* ✅ Store picker */}
      <div className="storeRow">
        <div className="storeLeft">
          <div className="storeTitle">Active Store</div>
          <div className="storeSub">Pick which Salla store you want to configure</div>
        </div>

        <div className="storeRight">
          <select
            className="storeSelect"
            value={activeStoreId || ""}
            onChange={(e) => onChangeStore(e.target.value)}
            disabled={storesLoading || (stores || []).length === 0}
          >
            <option value="" disabled>
              {storesLoading ? "Loading stores..." : "Select a store"}
            </option>
            {(stores || []).map((s) => (
              <option key={String(s.store_id)} value={String(s.store_id)}>
                {String(s.store_id)} • {String(s.status || "unknown")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pxGrid">
        {/* Google / GA4 */}
        <BrandCard
          brand="google"
          logo="G"
          title="Google Analytics 4"
          desc="Server-side purchase and conversion events to GA4"
          status={ga4Status}
        >
          {ga4Status !== "connected" ? (
            <>
              <div className="pxFormGrid">
                <Field
                  label="Measurement ID"
                  placeholder="G-XXXXXXX"
                  value={ga4MeasurementId}
                  onChange={setGa4MeasurementId}
                  disabled={ga4Loading}
                />
                <Field
                  label="API Secret"
                  placeholder="Enter API Secret"
                  value={ga4ApiSecret}
                  onChange={setGa4ApiSecret}
                  disabled={ga4Loading}
                />
              </div>

              <button className="pxBtn btn-google" onClick={connectGA4} disabled={ga4Loading}>
                {ga4Loading ? "Validating..." : "Connect GA4"}
              </button>

              {ga4Error && <div className="pxMsg err">{ga4Error}</div>}
            </>
          ) : (
            <div className="pxMsg ok">✅ GA4 is successfully connected.</div>
          )}
        </BrandCard>

        {/* Meta */}
        <BrandCard
          brand="meta"
          logo="M"
          title="Meta"
          desc="Server-side events to Meta Pixel (CAPI)"
          status={metaStatus}
        >
          {metaStatus !== "connected" ? (
            <>
              <div className="pxFormGrid">
                <Field
                  label="Pixel ID"
                  placeholder="Meta Pixel ID"
                  value={metaPixelId}
                  onChange={setMetaPixelId}
                  disabled={metaLoading}
                />
                <Field
                  label="Access Token"
                  placeholder="Access Token"
                  value={metaAccessToken}
                  onChange={setMetaAccessToken}
                  disabled={metaLoading}
                />
              </div>

              <button className="pxBtn btn-meta" onClick={connectMeta} disabled={metaLoading}>
                {metaLoading ? "Validating..." : "Connect Meta"}
              </button>

              {metaError && <div className="pxMsg err">{metaError}</div>}
            </>
          ) : (
            <div className="pxMsg ok">✅ Meta is successfully connected.</div>
          )}
        </BrandCard>

        {/* TikTok */}
        <BrandCard
          brand="tiktok"
          logo="T"
          title="TikTok"
          desc="Server-side events to TikTok Pixel (Events API)"
          status={ttStatus}
        >
          {ttStatus !== "connected" ? (
            <>
              <div className="pxFormGrid">
                <Field
                  label="Pixel ID"
                  placeholder="TikTok Pixel ID"
                  value={ttPixelId}
                  onChange={setTtPixelId}
                  disabled={ttLoading}
                />
                <Field
                  label="Access Token"
                  placeholder="Access Token"
                  value={ttAccessToken}
                  onChange={setTtAccessToken}
                  disabled={ttLoading}
                />
              </div>

              <button className="pxBtn btn-tiktok" onClick={connectTikTok} disabled={ttLoading}>
                {ttLoading ? "Validating..." : "Connect TikTok"}
              </button>

              {ttError && <div className="pxMsg err">{ttError}</div>}
            </>
          ) : (
            <div className="pxMsg ok">✅ TikTok is successfully connected.</div>
          )}
        </BrandCard>

        {/* Snap */}
        <BrandCard
          brand="snap"
          logo="S"
          title="Snap"
          desc="Server-side events to Snap Pixel (Conversions API)"
          status={snapStatus}
        >
          {snapStatus !== "connected" ? (
            <>
              <div className="pxFormGrid">
                <Field
                  label="Pixel ID"
                  placeholder="Snap Pixel ID"
                  value={snapPixelId}
                  onChange={setSnapPixelId}
                  disabled={snapLoading}
                />
                <Field
                  label="Token"
                  placeholder="Token"
                  value={snapToken}
                  onChange={setSnapToken}
                  disabled={snapLoading}
                />
              </div>

              <button className="pxBtn btn-snap" onClick={connectSnap} disabled={snapLoading}>
                {snapLoading ? "Validating..." : "Connect Snap"}
              </button>

              {snapError && <div className="pxMsg err">{snapError}</div>}
            </>
          ) : (
            <div className="pxMsg ok">✅ Snap is successfully connected.</div>
          )}
        </BrandCard>
      </div>

      {/* ✅ styles unchanged (your original) */}
      <style>{`
        .storeRow{
          width:100%;
          display:flex;
          align-items:flex-end;
          justify-content:space-between;
          gap:12px;
          padding: 12px 14px;
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,0.08);
          background: rgba(255,255,255,0.86);
          margin-bottom: 14px;
        }
        .storeTitle{ font-size: 13px; font-weight: 1100; color:#111827; }
        .storeSub{ margin-top: 4px; font-size: 12px; font-weight: 800; color: rgba(17,24,39,0.62); }
        .storeRight{ min-width: 280px; max-width: 420px; width: 100%; }
        .storeSelect{
          width:100%;
          height:44px;
          border-radius:14px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.96);
          color:#111827;
          padding: 10px 12px;
          outline:none;
          font-weight:900;
        }
        @media (max-width: 780px){
          .storeRow{ flex-direction: column; align-items: stretch; }
          .storeRight{ min-width: 0; max-width: none; }
        }

        /* Grid */
        .pxGrid{ display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:14px; width:100%; }
        @media (max-width: 980px){ .pxGrid{ grid-template-columns: 1fr; } }

        /* Card */
        .bCard{
          background:#fff;
          border-radius:22px;
          border: 1px solid rgba(15,23,42,0.08);
          box-shadow: 0 20px 60px rgba(0,0,0,0.10);
          overflow:hidden;
          position:relative;
        }

        .bAccent{ height: 6px; width: 100%; }

        .bHead{
          padding: 16px;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 12px;
          border-bottom: 1px solid rgba(15,23,42,0.06);
        }

        .bLeft{ display:flex; gap:12px; min-width:0; align-items:center; }

        .bLogo{
          width:44px;height:44px;border-radius:16px;
          display:grid;place-items:center;
          font-weight:1100;color:#fff;
          flex-shrink:0;
        }

        .bTitle{
          font-size:15px;font-weight:1100;color:#111827;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        }
        .bDesc{
          margin-top:4px;
          font-size:12px;
          font-weight:800;
          color: rgba(17,24,39,0.62);
        }

        .bBody{ padding:16px; }

        .bStatus{
          padding: 8px 10px;
          border-radius:999px;
          font-size:11px;
          font-weight:1000;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(17,24,39,0.04);
          color: rgba(17,24,39,0.75);
          flex-shrink:0;
        }
        .bStatus.ok{
          background: rgba(25,135,84,0.12);
          border-color: rgba(25,135,84,0.20);
          color:#198754;
        }
        .bStatus.off{
          background: rgba(171,46,60,0.10);
          border-color: rgba(171,46,60,0.20);
          color:#AB2E3C;
        }

        .pxFormGrid{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
        @media (max-width: 560px){ .pxFormGrid{ grid-template-columns: 1fr; } }

        .fLabel{ display:block; font-size:12px; font-weight:1000; color: rgba(17,24,39,0.75); margin-bottom:6px; }

        .fInput{
          width:100%;
          height:44px;
          border-radius:14px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.96);
          color:#111827;
          padding: 10px 12px;
          outline:none;
          font-weight:800;
        }

        .fInput:focus{
          border-color: rgba(13,110,253,0.35);
          box-shadow: 0 0 0 6px rgba(13,110,253,0.10);
        }

        .pxBtn{
          width:100%;
          height:46px;
          margin-top:12px;
          border:0;
          border-radius:16px;
          cursor:pointer;
          font-weight:1100;
          transition: transform 0.12s ease, opacity 0.12s ease;
          color:#fff;
        }
        .pxBtn:hover{ transform: translateY(-1px); }
        .pxBtn:disabled{ opacity:0.65; cursor:not-allowed; transform:none; }

        .pxMsg{
          margin-top:10px;
          padding:10px 12px;
          border-radius:16px;
          font-size:12px;
          font-weight:1000;
        }
        .pxMsg.ok{
          background: rgba(25,135,84,0.12);
          border: 1px solid rgba(25,135,84,0.20);
          color:#198754;
        }
        .pxMsg.err{
          background: rgba(171,46,60,0.10);
          border: 1px solid rgba(171,46,60,0.20);
          color:#AB2E3C;
        }

        .accent-google{ background: linear-gradient(90deg,#4285F4,#34A853,#FBBC05,#EA4335); }
        .accent-meta{ background: linear-gradient(90deg,#1877F2,#42A5F5); }
        .accent-tiktok{ background: linear-gradient(90deg,#25F4EE,#000000,#FE2C55); }
        .accent-snap{ background: linear-gradient(90deg,#FFFC00,#FFE75A); }

        .logo-google{ background: linear-gradient(135deg,#4285F4,#34A853); }
        .logo-meta{ background: linear-gradient(135deg,#1877F2,#42A5F5); }
        .logo-tiktok{ background: linear-gradient(135deg,#25F4EE,#FE2C55); }
        .logo-snap{ background: linear-gradient(135deg,#FFFC00,#FFC107); color:#111827; }

        .btn-google{ background: linear-gradient(135deg,#4285F4,#34A853); }
        .btn-meta{ background: linear-gradient(135deg,#1877F2,#42A5F5); }
        .btn-tiktok{ background: linear-gradient(135deg,#25F4EE,#FE2C55); color:#111827; }
        .btn-snap{ background: linear-gradient(135deg,#FFFC00,#FFC107); color:#111827; }

        @media (max-width: 560px){ .bHead{ flex-direction: column; } }
      `}</style>
    </Container>
  );
}

/* ---------- UI Helpers ---------- */

function BrandCard({ brand, logo, title, desc, status, children }) {
  const connected = status === "connected";
  return (
    <section className="bCard">
      <div className={`bAccent accent-${brand}`} />
      <div className="bHead">
        <div className="bLeft">
          <div className={`bLogo logo-${brand}`}>{logo}</div>
          <div style={{ minWidth: 0 }}>
            <div className="bTitle">{title}</div>
            <div className="bDesc">{desc}</div>
          </div>
        </div>

        <div className={`bStatus ${connected ? "ok" : "off"}`}>
          {connected ? "Connected" : "Disconnected"}
        </div>
      </div>

      <div className="bBody">{children}</div>
    </section>
  );
}

function Field({ label, placeholder, value, onChange, disabled }) {
  return (
    <div>
      <label className="fLabel">{label}</label>
      <input
        className="fInput"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}