import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Container from "../components/layout/Container";
import { validateGA4, fetchStores, saveGA4, fetchGA4 } from "../api/platforms.api";
import { listConnections, saveConnection, removeConnection, testConnection } from "../api/connections.api";
import { getStoreId, setStoreId, reconcileStoreId } from "../utils/store";
import { useTranslation } from "../utils/i18n";
import metaIcon from "../assets/metaIcon.webp";

export default function Platforms() {
  const { t } = useTranslation();

  // active store (URL -> localStorage -> backend /platforms/stores fallback)
  const [activeStoreId, setActiveStoreId] = useState(() => getStoreId() || "");

  // stores dropdown
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(false);

  // GA4
  const [ga4MeasurementId, setGa4MeasurementId] = useState("");
  const [ga4ApiSecret, setGa4ApiSecret] = useState("");
  const [ga4Status, setGa4Status] = useState("disconnected");
  const [ga4Loading, setGa4Loading] = useState(false);
  const [ga4Error, setGa4Error] = useState("");
  const [ga4Disconnecting, setGa4Disconnecting] = useState(false);

  // Meta
  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaStatus, setMetaStatus] = useState("disconnected");
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaError, setMetaError] = useState("");
  const [metaWarn, setMetaWarn] = useState("");
  const [metaTesting, setMetaTesting] = useState(false);
  const [metaTestMsg, setMetaTestMsg] = useState("");

  // TikTok
  const [ttPixelId, setTtPixelId] = useState("");
  const [ttAccessToken, setTtAccessToken] = useState("");
  const [ttStatus, setTtStatus] = useState("disconnected");
  const [ttLoading, setTtLoading] = useState(false);
  const [ttError, setTtError] = useState("");
  const [ttWarn, setTtWarn] = useState("");
  const [ttTesting, setTtTesting] = useState(false);
  const [ttTestMsg, setTtTestMsg] = useState("");

  // Snap
  const [snapPixelId, setSnapPixelId] = useState("");
  const [snapToken, setSnapToken] = useState("");
  const [snapStatus, setSnapStatus] = useState("disconnected");
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapError, setSnapError] = useState("");
  const [snapWarn, setSnapWarn] = useState("");
  const [snapTesting, setSnapTesting] = useState(false);
  const [snapTestMsg, setSnapTestMsg] = useState("");

  useEffect(() => {
    let mounted = true;
    setStoresLoading(true);

    fetchStores()
      .then((resp) => {
        if (!mounted) return;

        const rows = Array.isArray(resp?.data) ? resp.data : [];
        setStores(rows);

        // keep the current store only if it's actually authorized; otherwise
        // fall back to a real store (prevents saving GA4 to a stale store id)
        const resolved = reconcileStoreId(rows);
        if (resolved) setActiveStoreId(String(resolved));
      })
      .catch(() => {})
      .finally(() => mounted && setStoresLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeStoreId) return;

    setGa4Error("");
    setGa4Status("disconnected");
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
      .catch(() => {});
  }, [activeStoreId]);

  useEffect(() => {
    if (!activeStoreId) return;

    setMetaStatus("disconnected");
    setMetaWarn("");
    setMetaTestMsg("");
    setTtStatus("disconnected");
    setTtWarn("");
    setTtTestMsg("");
    setSnapStatus("disconnected");
    setSnapWarn("");
    setSnapTestMsg("");

    listConnections(activeStoreId)
      .then((resp) => {
        const rows = Array.isArray(resp?.data) ? resp.data : [];
        for (const row of rows) {
          const p = String(row.platform || "").toLowerCase();
          const active = row.has_pixel_id && row.has_api_token;
          if (p === "meta" && active) {
            setMetaStatus("connected");
            if (row.validation_status === "error") setMetaWarn(t("validationWarning"));
          }
          if (p === "tiktok" && active) {
            setTtStatus("connected");
            if (row.validation_status === "error") setTtWarn(t("validationWarning"));
          }
          if (p === "snap" && active) {
            setSnapStatus("connected");
            if (row.validation_status === "error") setSnapWarn(t("validationWarning"));
          }
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStoreId]);

  const storeLabel = useMemo(() => {
    if (!activeStoreId) return "N/A";
    const found = (stores || []).find((s) => String(s.store_id) === String(activeStoreId));
    if (!found) return activeStoreId;
    return found.store_name
      ? `${found.store_name} (${found.store_id})`
      : `${found.store_id} (${found.status || "unknown"})`;
  }, [activeStoreId, stores]);

  function onChangeStore(nextId) {
    const id = String(nextId || "").trim();
    if (!id) return;

    setStoreId(id);
    setActiveStoreId(id);

    setGa4Status("disconnected");
    setMetaStatus("disconnected");
    setTtStatus("disconnected");
    setSnapStatus("disconnected");

    setGa4Error("");
    setMetaError("");
    setMetaWarn("");
    setMetaTestMsg("");
    setTtError("");
    setTtWarn("");
    setTtTestMsg("");
    setSnapError("");
    setSnapWarn("");
    setSnapTestMsg("");
  }

  async function connectGA4() {
    if (ga4Loading) return;
    setGa4Loading(true);
    setGa4Error("");

    try {
      if (!activeStoreId) throw new Error(t("storeIdNotSet"));

      const payload = {
        store_id: activeStoreId,
        measurement_id: ga4MeasurementId.trim(),
        api_secret: ga4ApiSecret.trim(),
        enabled: true,
      };

      if (!payload.measurement_id || !payload.api_secret) {
        throw new Error(t("enterMeasurementIdAndSecret"));
      }

      await validateGA4(payload);
      await saveGA4(payload);

      setGa4Status("connected");
    } catch (err) {
      setGa4Status("disconnected");
      setGa4Error(err?.message || t("failedToConnectGA4"));
    } finally {
      setGa4Loading(false);
    }
  }

  async function disconnectGA4() {
    if (!activeStoreId || ga4Disconnecting) return;
    setGa4Disconnecting(true);
    try {
      await saveGA4({
        store_id: activeStoreId,
        measurement_id: "",
        api_secret: "",
        enabled: false,
      });
    } catch {
      // ignore
    }
    setGa4Status("disconnected");
    setGa4MeasurementId("");
    setGa4ApiSecret("");
    setGa4Disconnecting(false);
  }

  async function connectMeta() {
    if (metaLoading) return;
    setMetaLoading(true);
    setMetaError("");
    setMetaWarn("");

    try {
      if (!activeStoreId) throw new Error(t("storeIdNotSet"));
      if (!metaPixelId.trim() || !metaAccessToken.trim()) {
        throw new Error(t("enterPixelIdAndToken"));
      }

      const result = await saveConnection({
        store_id: activeStoreId,
        platform: "meta",
        pixel_id: metaPixelId.trim(),
        api_token: metaAccessToken.trim()
      });

      setMetaStatus("connected");
      if (result.validation_status === "error") {
        setMetaWarn(result.validation_error || t("validationWarning"));
      }
    } catch (err) {
      setMetaStatus("disconnected");
      setMetaError(err?.message || t("failedToConnectMeta"));
    } finally {
      setMetaLoading(false);
    }
  }

  async function connectTikTok() {
    if (ttLoading) return;
    setTtLoading(true);
    setTtError("");
    setTtWarn("");

    try {
      if (!activeStoreId) throw new Error(t("storeIdNotSet"));
      if (!ttPixelId.trim() || !ttAccessToken.trim()) {
        throw new Error(t("enterPixelIdAndToken"));
      }

      const result = await saveConnection({
        store_id: activeStoreId,
        platform: "tiktok",
        pixel_id: ttPixelId.trim(),
        api_token: ttAccessToken.trim()
      });

      setTtStatus("connected");
      if (result.validation_status === "error") {
        setTtWarn(result.validation_error || t("validationWarning"));
      }
    } catch (err) {
      setTtStatus("disconnected");
      setTtError(err?.message || t("failedToConnectTikTok"));
    } finally {
      setTtLoading(false);
    }
  }

  async function connectSnap() {
    if (snapLoading) return;
    setSnapLoading(true);
    setSnapError("");
    setSnapWarn("");

    try {
      if (!activeStoreId) throw new Error(t("storeIdNotSet"));
      if (!snapPixelId.trim() || !snapToken.trim()) {
        throw new Error(t("enterPixelIdAndToken"));
      }

      const result = await saveConnection({
        store_id: activeStoreId,
        platform: "snap",
        pixel_id: snapPixelId.trim(),
        api_token: snapToken.trim()
      });

      setSnapStatus("connected");
      if (result.validation_status === "error") {
        setSnapWarn(result.validation_error || t("validationWarning"));
      }
    } catch (err) {
      setSnapStatus("disconnected");
      setSnapError(err?.message || t("failedToConnectSnap"));
    } finally {
      setSnapLoading(false);
    }
  }

  async function disconnectPlatform(platform) {
    if (!activeStoreId) return;
    try {
      await removeConnection(activeStoreId, platform);
    } catch {
      // ignore errors — reset state regardless
    }
    if (platform === "meta") {
      setMetaStatus("disconnected");
      setMetaPixelId("");
      setMetaAccessToken("");
      setMetaWarn("");
      setMetaTestMsg("");
    }
    if (platform === "tiktok") {
      setTtStatus("disconnected");
      setTtPixelId("");
      setTtAccessToken("");
      setTtWarn("");
      setTtTestMsg("");
    }
    if (platform === "snap") {
      setSnapStatus("disconnected");
      setSnapPixelId("");
      setSnapToken("");
      setSnapWarn("");
      setSnapTestMsg("");
    }
  }

  async function handleTestConnection(platform) {
    if (!activeStoreId) return;
    const setTesting = platform === "meta" ? setMetaTesting : platform === "tiktok" ? setTtTesting : setSnapTesting;
    const setMsg = platform === "meta" ? setMetaTestMsg : platform === "tiktok" ? setTtTestMsg : setSnapTestMsg;

    setTesting(true);
    setMsg("");

    try {
      const result = await testConnection(activeStoreId, platform);
      setMsg(result.ok ? t("testSuccess") : `${t("testFailed")}: ${result.error || "unknown"}`);
    } catch (err) {
      setMsg(`${t("testFailed")}: ${err?.message || "unknown"}`);
    } finally {
      setTesting(false);
    }
  }

  function maskValue(val) {
    if (!val || val.length <= 6) return val;
    return val.slice(0, 3) + "\u2022".repeat(Math.min(val.length - 6, 12)) + val.slice(-3);
  }

  return (
    <Container title={""} subtitle={""}>
      {/* Header */}
      <div className="pageHeader">
        <div className="pageHeaderLeft">
          <div className="pageSubtitle">
            {t("connectPlatformsSubtitle")} &bull; {t("store")}:{" "}
            <span className="storePill">{storeLabel}</span>
          </div>
        </div>
      </div>

      {/* Store picker */}
      <div className="storeRow">
        <div className="storeLeft">
          <div className="storeTitle">{t("activeStore")}</div>
          <div className="storeSub">{t("pickStore")}</div>
        </div>

        <div className="storeRight">
          <select
            className="storeSelect"
            value={activeStoreId || ""}
            onChange={(e) => onChangeStore(e.target.value)}
            disabled={storesLoading || (stores || []).length === 0}
          >
            <option value="" disabled>
              {storesLoading ? t("loadingStores") : t("selectStore")}
            </option>
            {(stores || []).map((s) => (
              <option key={String(s.store_id)} value={String(s.store_id)}>
                {s.store_name
                  ? `${s.store_name} \u2014 ${s.store_id}`
                  : `${s.store_id} (${s.status || "unknown"})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pxGrid">
        {/* Google / GA4 */}
        <BrandCard brand="google" title={t("googleAnalytics4")} desc={t("ga4Desc")} status={ga4Status}>
          {ga4Status !== "connected" ? (
            <>
              <div className="pxFormGrid">
                <Field
                  label={t("measurementId")}
                  placeholder="G-XXXXXXX"
                  value={ga4MeasurementId}
                  onChange={setGa4MeasurementId}
                  disabled={ga4Loading}
                  helpText={t("helpGA4MeasurementId")}
                />
                <Field
                  label={t("apiSecret")}
                  placeholder={t("enterApiSecret")}
                  value={ga4ApiSecret}
                  onChange={setGa4ApiSecret}
                  disabled={ga4Loading}
                  secret
                  helpText={t("helpGA4ApiSecret")}
                />
              </div>

              <div className="actionsRow">
                <button className="pxBtn" onClick={connectGA4} disabled={ga4Loading} type="button">
                  {ga4Loading ? t("validating") : t("connectGA4")}
                </button>
              </div>

              {ga4Error && <div className="pxMsg err">{ga4Error}</div>}
            </>
          ) : (
            <>
              <div className="pxMsg ok">{t("ga4Connected")}</div>
              {ga4MeasurementId && (
                <div className="credSummary">
                  <span className="credLabel">{t("measurementId")}:</span> {maskValue(ga4MeasurementId)}
                </div>
              )}
              <div className="actionsRow" style={{ gap: 8 }}>
                <button className="pxBtn danger" onClick={disconnectGA4} disabled={ga4Disconnecting} type="button">
                  {ga4Disconnecting ? t("disconnecting") : t("disconnect")}
                </button>
              </div>
            </>
          )}
        </BrandCard>

        {/* Meta */}
        <BrandCard brand="meta" title={t("meta")} desc={t("metaDesc")} status={metaStatus}>
          {metaStatus !== "connected" ? (
            <>
              <div className="pxFormGrid">
                <Field
                  label={t("pixelId")}
                  placeholder={t("pixelId")}
                  value={metaPixelId}
                  onChange={setMetaPixelId}
                  disabled={metaLoading}
                  helpText={t("helpMetaPixelId")}
                />
                <Field
                  label={t("accessToken")}
                  placeholder={t("enterAccessToken")}
                  value={metaAccessToken}
                  onChange={setMetaAccessToken}
                  disabled={metaLoading}
                  secret
                  helpText={t("helpMetaAccessToken")}
                />
              </div>

              <div className="actionsRow">
                <button className="pxBtn" onClick={connectMeta} disabled={metaLoading} type="button">
                  {metaLoading ? t("validating") : t("connectMeta")}
                </button>
              </div>

              {metaError && <div className="pxMsg err">{metaError}</div>}
            </>
          ) : (
            <>
              <div className="pxMsg ok">{t("metaConnected")}</div>
              {metaWarn && <div className="pxMsg warn">{metaWarn}</div>}
              {metaTestMsg && <div className={`pxMsg ${metaTestMsg.includes(t("testSuccess")) ? "ok" : "err"}`}>{metaTestMsg}</div>}
              <div className="actionsRow" style={{ gap: 8 }}>
                <button className="pxBtn ghost" onClick={() => handleTestConnection("meta")} disabled={metaTesting} type="button">
                  {metaTesting ? t("testing") : t("testConnection")}
                </button>
                <button className="pxBtn danger" onClick={() => disconnectPlatform("meta")} type="button">
                  {t("disconnect")}
                </button>
              </div>
            </>
          )}
        </BrandCard>

        {/* TikTok */}
        <BrandCard brand="tiktok" title={t("tiktok")} desc={t("tiktokDesc")} status={ttStatus}>
          {ttStatus !== "connected" ? (
            <>
              <div className="pxFormGrid">
                <Field
                  label={t("pixelId")}
                  placeholder={t("pixelId")}
                  value={ttPixelId}
                  onChange={setTtPixelId}
                  disabled={ttLoading}
                  helpText={t("helpTikTokPixelId")}
                />
                <Field
                  label={t("accessToken")}
                  placeholder={t("enterAccessToken")}
                  value={ttAccessToken}
                  onChange={setTtAccessToken}
                  disabled={ttLoading}
                  secret
                  helpText={t("helpTikTokAccessToken")}
                />
              </div>

              <div className="actionsRow">
                <button className="pxBtn" onClick={connectTikTok} disabled={ttLoading} type="button">
                  {ttLoading ? t("validating") : t("connectTikTok")}
                </button>
              </div>

              {ttError && <div className="pxMsg err">{ttError}</div>}
            </>
          ) : (
            <>
              <div className="pxMsg ok">{t("tiktokConnected")}</div>
              {ttWarn && <div className="pxMsg warn">{ttWarn}</div>}
              {ttTestMsg && <div className={`pxMsg ${ttTestMsg.includes(t("testSuccess")) ? "ok" : "err"}`}>{ttTestMsg}</div>}
              <div className="actionsRow" style={{ gap: 8 }}>
                <button className="pxBtn ghost" onClick={() => handleTestConnection("tiktok")} disabled={ttTesting} type="button">
                  {ttTesting ? t("testing") : t("testConnection")}
                </button>
                <button className="pxBtn danger" onClick={() => disconnectPlatform("tiktok")} type="button">
                  {t("disconnect")}
                </button>
              </div>
            </>
          )}
        </BrandCard>

        {/* Snap */}
        <BrandCard brand="snap" title={t("snap")} desc={t("snapDesc")} status={snapStatus}>
          {snapStatus !== "connected" ? (
            <>
              <div className="pxFormGrid">
                <Field
                  label={t("pixelId")}
                  placeholder={t("pixelId")}
                  value={snapPixelId}
                  onChange={setSnapPixelId}
                  disabled={snapLoading}
                  helpText={t("helpSnapPixelId")}
                />
                <Field
                  label={t("token")}
                  placeholder={t("token")}
                  value={snapToken}
                  onChange={setSnapToken}
                  disabled={snapLoading}
                  secret
                  helpText={t("helpSnapToken")}
                />
              </div>

              <div className="actionsRow">
                <button className="pxBtn" onClick={connectSnap} disabled={snapLoading} type="button">
                  {snapLoading ? t("validating") : t("connectSnap")}
                </button>
              </div>

              {snapError && <div className="pxMsg err">{snapError}</div>}
            </>
          ) : (
            <>
              <div className="pxMsg ok">{t("snapConnected")}</div>
              {snapWarn && <div className="pxMsg warn">{snapWarn}</div>}
              {snapTestMsg && <div className={`pxMsg ${snapTestMsg.includes(t("testSuccess")) ? "ok" : "err"}`}>{snapTestMsg}</div>}
              <div className="actionsRow" style={{ gap: 8 }}>
                <button className="pxBtn ghost" onClick={() => handleTestConnection("snap")} disabled={snapTesting} type="button">
                  {snapTesting ? t("testing") : t("testConnection")}
                </button>
                <button className="pxBtn danger" onClick={() => disconnectPlatform("snap")} type="button">
                  {t("disconnect")}
                </button>
              </div>
            </>
          )}
        </BrandCard>
      </div>

      <style>{`
        /* Page header */
        .pageHeader{
          width:100%;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:16px;
          padding: 12px 14px;
          margin-bottom: 12px;
          border: 1px solid rgba(15,23,42,0.10);
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 3px 10px rgba(2,6,23,0.06);
        }
        .pageHeaderLeft{ min-width:0; }
        .pageSubtitle{
          font-size: 12.5px;
          font-weight: 600;
          color: rgba(15,23,42,0.64);
          display:flex;
          flex-wrap:wrap;
          gap:6px;
          align-items:center;
        }
        .storePill{
          display:inline-flex;
          align-items:center;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(15,23,42,0.03);
          color: rgba(15,23,42,0.78);
          font-weight: 700;
        }

        /* Store row */
        .storeRow{
          width:100%;
          display:flex;
          align-items:flex-end;
          justify-content:space-between;
          gap:12px;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,0.10);
          background:#ffffff;
          margin-bottom: 16px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.06);
        }
        .storeTitle{ font-size: 13px; font-weight: 800; color:#0f172a; }
        .storeSub{ margin-top: 4px; font-size: 12px; font-weight: 600; color: rgba(15,23,42,0.60); }
        .storeRight{ min-width: 280px; max-width: 420px; width: 100%; }
        .storeSelect{
          width:100%;
          height:44px;
          border-radius:14px;
          border: 1px solid rgba(15,23,42,0.12);
          background: #ffffff;
          color:#0f172a;
          padding: 10px 12px;
          outline:none;
          font-weight:700;
        }
        .storeSelect:focus{
          border-color:rgba(2,6,23,0.28);
          box-shadow:0 0 0 4px rgba(2,6,23,0.08);
        }
        @media (max-width: 780px){
          .storeRow{ flex-direction: column; align-items: stretch; }
          .storeRight{ min-width: 0; max-width: none; }
        }

        /* Grid */
        .pxGrid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap:16px;
          width:100%;
        }
        @media (max-width: 980px){ .pxGrid{ grid-template-columns: 1fr; } }

        /* Card */
        .bCard{
          background:#ffffff;
          border-radius:18px;
          border: 1px solid rgba(15,23,42,0.10);
          box-shadow: 0 10px 26px rgba(2,6,23,0.08);
          overflow:hidden;
          position:relative;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .bCard:hover{
          transform: translateY(-2px);
          box-shadow: 0 14px 34px rgba(2,6,23,0.10);
        }

        .bHead{
          padding: 16px 18px;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 12px;
          border-bottom: 1px solid rgba(15,23,42,0.08);
          background: linear-gradient(180deg, rgba(15,23,42,0.03), rgba(255,255,255,1));
        }
        .bLeft{ display:flex; gap:12px; min-width:0; align-items:center; }

        .bLogo{
          width:46px;
          height:46px;
          border-radius:16px;
          display:grid;
          place-items:center;
          overflow:hidden;
          flex-shrink:0;
          background: #ffffff;
          border: 1px solid rgba(2,6,23,0.10);
          box-shadow: 0 10px 18px rgba(2,6,23,0.14);
        }
        .bLogo svg{ display:block; }

        .bTitle{
          font-size:15px;
          font-weight:800;
          color:#0f172a;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .bDesc{
          margin-top:4px;
          font-size:12px;
          font-weight:600;
          color: rgba(15,23,42,0.62);
        }

        .bBody{ padding:16px 18px 18px; background:#ffffff; }

        .bStatus{
          padding: 8px 10px;
          border-radius:999px;
          font-size:11px;
          font-weight:800;
          border: 1px solid rgba(15,23,42,0.12);
          background: rgba(15,23,42,0.04);
          color: rgba(15,23,42,0.72);
          flex-shrink:0;
        }
        .bStatus.ok{
          background: rgba(16,185,129,0.14);
          border-color: rgba(16,185,129,0.24);
          color:#0f6b4f;
        }
        .bStatus.off{
          background: rgba(239,68,68,0.12);
          border-color: rgba(239,68,68,0.22);
          color:#b91c1c;
        }

        .pxFormGrid{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
        @media (max-width: 560px){ .pxFormGrid{ grid-template-columns: 1fr; } }

        .fLabel{
          display:block;
          font-size:12px;
          font-weight:700;
          color: rgba(15,23,42,0.76);
          margin-bottom:6px;
        }
        .fInputWrap{
          position:relative;
          display:flex;
          align-items:center;
        }
        .fInput{
          width:100%;
          height:44px;
          border-radius:14px;
          border: 1px solid rgba(15,23,42,0.12);
          background: #ffffff;
          color:#0f172a;
          padding: 10px 12px;
          outline:none;
          font-weight:700;
        }
        .fInput.hasToggle{
          padding-right:44px;
        }
        .fInput::placeholder{ color: rgba(15,23,42,0.42); }
        .fInput:focus{
          border-color: rgba(2,6,23,0.28);
          box-shadow: 0 0 0 4px rgba(2,6,23,0.08);
        }
        .fToggle{
          position:absolute;
          right:8px;
          width:32px;
          height:32px;
          border-radius:10px;
          border:none;
          background:transparent;
          color:rgba(15,23,42,0.45);
          cursor:pointer;
          display:grid;
          place-items:center;
        }
        .fToggle:hover{
          background:rgba(15,23,42,0.06);
          color:rgba(15,23,42,0.7);
        }
        .fHelp{
          margin-top:4px;
          font-size:11px;
          font-weight:600;
          color:rgba(15,23,42,0.42);
        }

        .credSummary{
          margin-top:8px;
          padding:8px 12px;
          border-radius:12px;
          background:rgba(15,23,42,0.03);
          border:1px solid rgba(15,23,42,0.08);
          font-size:12px;
          font-weight:700;
          color:rgba(15,23,42,0.65);
          font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .credLabel{
          font-weight:700;
          color:rgba(15,23,42,0.5);
          font-family:Inter, system-ui, sans-serif;
        }

        .actionsRow{ display:flex; justify-content:flex-start; margin-top:12px; }
        [dir="rtl"] .actionsRow{ justify-content:flex-end; }

        .pxBtn{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding:0 18px;
          min-width:160px;
          height:44px;
          border: 1px solid rgba(2,6,23,0.18);
          border-radius:14px;
          cursor:pointer;
          font-weight:800;
          letter-spacing: 0.2px;
          transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
          color:#ffffff;
          background: linear-gradient(135deg, #0b1220 0%, #0f172a 45%, #111827 100%);
          box-shadow: 0 10px 20px rgba(2,6,23,0.20);
        }
        .pxBtn:hover{
          transform: translateY(-1px);
          box-shadow: 0 14px 26px rgba(2,6,23,0.26);
        }
        .pxBtn:disabled{
          opacity:0.65;
          cursor:not-allowed;
          transform:none;
          box-shadow: 0 8px 16px rgba(2,6,23,0.14);
        }

        .pxMsg{
          margin-top:10px;
          padding:10px 12px;
          border-radius:14px;
          font-size:12px;
          font-weight:700;
        }
        .pxMsg.ok{
          background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.22);
          color:#0f6b4f;
        }
        .pxMsg.err{
          background: rgba(239,68,68,0.10);
          border: 1px solid rgba(239,68,68,0.20);
          color:#b91c1c;
        }
        .pxMsg.warn{
          background: rgba(245,158,11,0.10);
          border: 1px solid rgba(245,158,11,0.22);
          color:#92400e;
        }

        .pxBtn.ghost{
          background: rgba(15,23,42,0.06);
          border-color: rgba(15,23,42,0.16);
          color: rgba(15,23,42,0.80);
          box-shadow: none;
        }
        .pxBtn.ghost:hover{
          background: rgba(15,23,42,0.10);
          box-shadow: none;
        }

        .pxBtn.danger{
          background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);
          border-color: rgba(153,27,27,0.40);
          box-shadow: 0 10px 20px rgba(153,27,27,0.20);
        }
        .pxBtn.danger:hover{
          box-shadow: 0 14px 26px rgba(153,27,27,0.28);
        }

        @media (max-width: 560px){
          .bHead{ flex-direction: column; align-items:flex-start; }
        }

        .bLogo img.brandImg{
          width: 34px !important;
          height: 34px !important;
          object-fit: contain !important;
          display: block !important;
          background: transparent !important;
          filter: none !important;
          opacity: 1 !important;
        }

        .bLogo img.brandImgMeta{
          transform: translateZ(0);
        }
      `}</style>
    </Container>
  );
}

/* ---------- UI Helpers ---------- */

function BrandCard({ brand, title, desc, status, children }) {
  const { t } = useTranslation();
  const connected = status === "connected";

  function renderLogo() {
    if (brand === "google") {
      return (
        <svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">
          <path fill="#EA4335" d="M24 20.1v7.7h10.7c-.4 2-1.6 3.7-3.3 4.8v5h5.4c3.2-2.9 5-7.2 5-12.5 0-1.2-.1-2.1-.3-3H24Z" />
          <path fill="#34A853" d="M24 42c4.6 0 8.5-1.5 11.3-4.1l-5.4-5c-1.5 1-3.4 1.7-5.9 1.7-4.5 0-8.2-3-9.6-7.1H8.9v5.2C11.7 38.2 17.4 42 24 42Z" />
          <path fill="#4285F4" d="M14.4 27.5c-.4-1.1-.6-2.2-.6-3.5s.2-2.4.6-3.5V15.3H8.9C7.7 17.7 7 20.7 7 24s.7 6.3 1.9 8.7l5.5-5.2Z" />
          <path fill="#FBBC05" d="M24 13.5c2.5 0 4.7.9 6.5 2.6l4.8-4.8C32.4 8.5 28.6 7 24 7 17.4 7 11.7 10.8 8.9 15.3l5.5 5.2c1.4-4.1 5.1-7 9.6-7Z" />
        </svg>
      );
    }

    if (brand === "meta") {
      return (
        <img src={metaIcon} alt="Meta" className="brandImg brandImgMeta" loading="eager" referrerPolicy="no-referrer" />
      );
    }

    if (brand === "tiktok") {
      return (
        <svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="#0B0F19" />
          <path d="M37.8 16v24.1c0 6.4-5.2 11.6-11.6 11.6-5.4 0-9.8-4.4-9.8-9.8s4.4-9.8 9.8-9.8c1 0 2 .2 2.9.5v6.3c-.7-.4-1.6-.6-2.5-.6-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c2.3 0 4.1-1.8 4.1-4.1V16h7.1c.6 3.6 2.8 6.1 6.3 6.8v6.3c-2.5-.2-4.8-1.1-6.8-2.6v13.6" fill="#25F4EE" opacity="0.95" transform="translate(-1.2,1.2)" />
          <path d="M37.8 16v24.1c0 6.4-5.2 11.6-11.6 11.6-5.4 0-9.8-4.4-9.8-9.8s4.4-9.8 9.8-9.8c1 0 2 .2 2.9.5v6.3c-.7-.4-1.6-.6-2.5-.6-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c2.3 0 4.1-1.8 4.1-4.1V16h7.1c.6 3.6 2.8 6.1 6.3 6.8v6.3c-2.5-.2-4.8-1.1-6.8-2.6v13.6" fill="#FE2C55" opacity="0.9" transform="translate(1.1,-1.0)" />
          <path d="M37.8 16v24.1c0 6.4-5.2 11.6-11.6 11.6-5.4 0-9.8-4.4-9.8-9.8s4.4-9.8 9.8-9.8c1 0 2 .2 2.9.5v6.3c-.7-.4-1.6-.6-2.5-.6-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c2.3 0 4.1-1.8 4.1-4.1V16h7.1c.6 3.6 2.8 6.1 6.3 6.8v6.3c-2.5-.2-4.8-1.1-6.8-2.6v13.6" fill="#FFFFFF" />
        </svg>
      );
    }

    if (brand === "snap") {
      return (
        <svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="#FFFC00" />
          <path d="M32 14 c-7.2 0-12.3 5.6-12.3 13.5 0 2.4.6 4.6 1 6.1 .4 1.4-.3 2.2-1.3 2.8 -1.2.8-3.4 1.7-5.3 2.1 -1.2.3-1.6 1.7-.9 2.6 1.2 1.6 3.6 2.7 6.2 3.1 .7 4.5 4.1 8.6 7.8 10.4 1.6.8 3.2 1 4.8 1 1.6 0 3.2-.2 4.8-1 3.7-1.8 7.1-5.9 7.8-10.4 2.6-.4 5-1.5 6.2-3.1 .7-.9.3-2.3-.9-2.6 -1.9-.4-4.1-1.3-5.3-2.1 -1-.6-1.7-1.4-1.3-2.8 .4-1.5 1-3.7 1-6.1 C44.3 19.6 39.2 14 32 14Z" fill="#FFFFFF" stroke="#111827" strokeWidth="2.6" strokeLinejoin="round" />
          <path d="M24.8 46.6c2.1 1.3 4.4 1.9 7.2 1.9s5.1-.6 7.2-1.9" fill="none" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    }

    return <span>{String(brand || "").slice(0, 1).toUpperCase()}</span>;
  }

  return (
    <section className="bCard">
      <div className="bHead">
        <div className="bLeft">
          <div className="bLogo">{renderLogo()}</div>
          <div style={{ minWidth: 0 }}>
            <div className="bTitle">{title}</div>
            <div className="bDesc">{desc}</div>
          </div>
        </div>

        <div className={`bStatus ${connected ? "ok" : "off"}`}>
          {connected ? t("connected") : t("disconnected")}
        </div>
      </div>

      <div className="bBody">{children}</div>
    </section>
  );
}

function Field({ label, placeholder, value, onChange, disabled, secret, helpText }) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="fLabel">{label}</label>
      <div className="fInputWrap">
        <input
          className={`fInput ${secret ? "hasToggle" : ""}`}
          type={secret && !visible ? "password" : "text"}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {secret && (
          <button
            type="button"
            className="fToggle"
            onClick={() => setVisible(!visible)}
            title={visible ? t("hide") : t("show")}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {helpText && <div className="fHelp">{helpText}</div>}
    </div>
  );
}
