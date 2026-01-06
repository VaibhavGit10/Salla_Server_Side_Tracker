import { useEffect, useMemo, useState } from "react";
import Container from "../components/layout/Container";
import { validateGA4, fetchStores, saveGA4, fetchGA4 } from "../api/platforms.api";
import { getStoreId, setStoreId } from "../utils/store";
import { useTranslation } from "../utils/i18n";
import metaIcon from "../assets/metaIcon.webp";

export default function Platforms() {
  const { t, lang, changeLanguage } = useTranslation();

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

    setStoreId(id); // ✅ persists + dispatches store_id_changed event (your store.js)
    setActiveStoreId(id); // ✅ updates dropdown immediately

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

      await validateGA4(payload); // ✅ validate
      await saveGA4(payload); // ✅ persist (/platforms/ga4/connect)

      setGa4Status("connected");
    } catch (err) {
      setGa4Status("disconnected");
      setGa4Error(err?.message || t("failedToConnectGA4"));
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
        throw new Error(t("enterPixelIdAndToken"));
      }
      setMetaStatus("connected");
    } catch (err) {
      setMetaError(err?.message || t("failedToConnectMeta"));
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
        throw new Error(t("enterPixelIdAndToken"));
      }
      setTtStatus("connected");
    } catch (err) {
      setTtError(err?.message || t("failedToConnectTikTok"));
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
        throw new Error(t("enterPixelIdAndToken"));
      }
      setSnapStatus("connected");
    } catch (err) {
      setSnapError(err?.message || t("failedToConnectSnap"));
    } finally {
      setSnapLoading(false);
    }
  }

  return (
    <Container title={""} subtitle={""}>
      {/* ✅ Header (Title/Sub + Language switcher inside header area) */}
      <div className="pageHeader">

        <div className="pageHeaderLeft">
          <div className="pageSubtitle">
            {t("connectPlatformsSubtitle")} • {t("store")}:{" "}
            <span className="storePill">{storeLabel}</span>
          </div>
        </div>

        <div className="pageHeaderRight">
          <div className="langSwitcher">
            <button
              className={`langBtn ${lang === "en" ? "active" : ""}`}
              onClick={() => changeLanguage("en")}
              type="button"
            >
              {t("english")}
            </button>
            <button
              className={`langBtn ${lang === "ar" ? "active" : ""}`}
              onClick={() => changeLanguage("ar")}
              type="button"
            >
              {t("arabic")}
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Store picker */}
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
                {String(s.store_id)} • {String(s.status || "unknown")}
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
                />
                <Field
                  label={t("apiSecret")}
                  placeholder={t("enterApiSecret")}
                  value={ga4ApiSecret}
                  onChange={setGa4ApiSecret}
                  disabled={ga4Loading}
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
            <div className="pxMsg ok">✅ {t("ga4Connected")}</div>
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
                />
                <Field
                  label={t("accessToken")}
                  placeholder={t("enterAccessToken")}
                  value={metaAccessToken}
                  onChange={setMetaAccessToken}
                  disabled={metaLoading}
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
            <div className="pxMsg ok">✅ {t("metaConnected")}</div>
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
                />
                <Field
                  label={t("accessToken")}
                  placeholder={t("enterAccessToken")}
                  value={ttAccessToken}
                  onChange={setTtAccessToken}
                  disabled={ttLoading}
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
            <div className="pxMsg ok">✅ {t("tiktokConnected")}</div>
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
                />
                <Field
                  label={t("token")}
                  placeholder={t("token")}
                  value={snapToken}
                  onChange={setSnapToken}
                  disabled={snapLoading}
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
            <div className="pxMsg ok">✅ {t("snapConnected")}</div>
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
          padding: 12px 4px 6px;
          margin-bottom: 12px;
        }
        .pageHeaderLeft{ min-width:0; }
        .pageTitle{
          font-size: 18px;
          font-weight: 1200;
          color:#0f172a;
          letter-spacing: -0.2px;
        }
        .pageSubtitle{
          margin-top:6px;
          font-size: 12.5px;
          font-weight: 850;
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
          font-weight: 1000;
        }

        /* Language Switcher (in header) */
        .pageHeaderRight{ flex-shrink:0; }
        .langSwitcher{
          display:flex;
          gap:8px;
          justify-content:flex-end;
        }
        .langBtn{
          padding:8px 12px;
          border-radius:12px;
          border:1px solid rgba(15,23,42,0.12);
          background:#ffffff;
          color:rgba(15,23,42,0.72);
          font-size:12.5px;
          font-weight:1000;
          cursor:pointer;
          transition:all 0.15s ease;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06);
        }
        .langBtn:hover{
          background:rgba(15,23,42,0.04);
          border-color:rgba(15,23,42,0.18);
          transform: translateY(-1px);
        }
        .langBtn.active{
          background: rgba(15,23,42,0.92);
          border-color: rgba(15,23,42,0.92);
          color:#ffffff;
          box-shadow: 0 8px 18px rgba(15,23,42,0.18);
        }
        [dir="rtl"] .langSwitcher{ justify-content:flex-start; }
        [dir="rtl"] .pageHeader{ flex-direction: row-reverse; }

        @media (max-width: 780px){
          .pageHeader{ flex-direction: column; align-items: stretch; }
          [dir="rtl"] .pageHeader{ flex-direction: column; }
          .pageHeaderRight{ display:flex; justify-content:flex-end; }
          [dir="rtl"] .pageHeaderRight{ justify-content:flex-start; }
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
        .storeTitle{ font-size: 13px; font-weight: 1100; color:#0f172a; }
        .storeSub{ margin-top: 4px; font-size: 12px; font-weight: 850; color: rgba(15,23,42,0.60); }
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
          font-weight:950;
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

        /* Logo container (looks premium + fits real SVG logos) */
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
          font-weight:1150;
          color:#0f172a;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
        }
        .bDesc{
          margin-top:4px;
          font-size:12px;
          font-weight:850;
          color: rgba(15,23,42,0.62);
        }

        .bBody{ padding:16px 18px 18px; background:#ffffff; }

        .bStatus{
          padding: 8px 10px;
          border-radius:999px;
          font-size:11px;
          font-weight:1100;
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
          font-weight:1050;
          color: rgba(15,23,42,0.76);
          margin-bottom:6px;
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
          font-weight:900;
        }
        .fInput::placeholder{ color: rgba(15,23,42,0.42); }
        .fInput:focus{
          border-color: rgba(2,6,23,0.28);
          box-shadow: 0 0 0 4px rgba(2,6,23,0.08);
        }

        .actionsRow{ display:flex; justify-content:flex-start; margin-top:12px; }
        [dir="rtl"] .actionsRow{ justify-content:flex-end; }

        /* Darker buttons */
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
          font-weight:1150;
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
          font-weight:1050;
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

        @media (max-width: 560px){
          .bHead{ flex-direction: column; align-items:flex-start; }
        }

        /* Make sure images inside logo container are not affected by global img styles */
.bLogo img.brandImg{
  width: 34px !important;
  height: 34px !important;
  object-fit: contain !important;
  display: block !important;
  background: transparent !important;
  filter: none !important;
  opacity: 1 !important;
}

/* Extra safety for Meta specifically */
.bLogo img.brandImgMeta{
  transform: translateZ(0);
}

.pageHeader{
  border: 1px solid rgba(15,23,42,0.10);
  background: #ffffff;
  border-radius: 16px;
  padding: 12px 14px;
  box-shadow: 0 3px 10px rgba(2,6,23,0.06);
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
    // ✅ More "real" looking brand logos (SVGs) — no external assets required.
    if (brand === "google") {
      return (
        <svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 20.1v7.7h10.7c-.4 2-1.6 3.7-3.3 4.8v5h5.4c3.2-2.9 5-7.2 5-12.5 0-1.2-.1-2.1-.3-3H24Z"
          />
          <path
            fill="#34A853"
            d="M24 42c4.6 0 8.5-1.5 11.3-4.1l-5.4-5c-1.5 1-3.4 1.7-5.9 1.7-4.5 0-8.2-3-9.6-7.1H8.9v5.2C11.7 38.2 17.4 42 24 42Z"
          />
          <path
            fill="#4285F4"
            d="M14.4 27.5c-.4-1.1-.6-2.2-.6-3.5s.2-2.4.6-3.5V15.3H8.9C7.7 17.7 7 20.7 7 24s.7 6.3 1.9 8.7l5.5-5.2Z"
          />
          <path
            fill="#FBBC05"
            d="M24 13.5c2.5 0 4.7.9 6.5 2.6l4.8-4.8C32.4 8.5 28.6 7 24 7 17.4 7 11.7 10.8 8.9 15.3l5.5 5.2c1.4-4.1 5.1-7 9.6-7Z"
          />
        </svg>
      );
    }

    if (brand === "meta") {
      return (
        <img
          src={metaIcon}
          alt="Meta"
          className="brandImg brandImgMeta"
          loading="eager"
          referrerPolicy="no-referrer"
        />
      );
    }


    if (brand === "tiktok") {
      // TikTok note with dual shadow colors (more "real" feeling)
      return (
        <svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="#0B0F19" />
          {/* cyan shadow */}
          <path
            d="M37.8 16v24.1c0 6.4-5.2 11.6-11.6 11.6-5.4 0-9.8-4.4-9.8-9.8s4.4-9.8 9.8-9.8c1 0 2 .2 2.9.5v6.3c-.7-.4-1.6-.6-2.5-.6-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c2.3 0 4.1-1.8 4.1-4.1V16h7.1c.6 3.6 2.8 6.1 6.3 6.8v6.3c-2.5-.2-4.8-1.1-6.8-2.6v13.6"
            fill="#25F4EE"
            opacity="0.95"
            transform="translate(-1.2,1.2)"
          />
          {/* red shadow */}
          <path
            d="M37.8 16v24.1c0 6.4-5.2 11.6-11.6 11.6-5.4 0-9.8-4.4-9.8-9.8s4.4-9.8 9.8-9.8c1 0 2 .2 2.9.5v6.3c-.7-.4-1.6-.6-2.5-.6-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c2.3 0 4.1-1.8 4.1-4.1V16h7.1c.6 3.6 2.8 6.1 6.3 6.8v6.3c-2.5-.2-4.8-1.1-6.8-2.6v13.6"
            fill="#FE2C55"
            opacity="0.9"
            transform="translate(1.1,-1.0)"
          />
          {/* main white */}
          <path
            d="M37.8 16v24.1c0 6.4-5.2 11.6-11.6 11.6-5.4 0-9.8-4.4-9.8-9.8s4.4-9.8 9.8-9.8c1 0 2 .2 2.9.5v6.3c-.7-.4-1.6-.6-2.5-.6-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c2.3 0 4.1-1.8 4.1-4.1V16h7.1c.6 3.6 2.8 6.1 6.3 6.8v6.3c-2.5-.2-4.8-1.1-6.8-2.6v13.6"
            fill="#FFFFFF"
          />
        </svg>
      );
    }

    if (brand === "snap") {
      // Snap ghost inside yellow circle (cleaner)
      return (
        <svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true">
          <circle cx="32" cy="32" r="30" fill="#FFFC00" />
          <path
            d="M32 14
               c-7.2 0-12.3 5.6-12.3 13.5
               0 2.4.6 4.6 1 6.1
               .4 1.4-.3 2.2-1.3 2.8
               -1.2.8-3.4 1.7-5.3 2.1
               -1.2.3-1.6 1.7-.9 2.6
               1.2 1.6 3.6 2.7 6.2 3.1
               .7 4.5 4.1 8.6 7.8 10.4
               1.6.8 3.2 1 4.8 1
               1.6 0 3.2-.2 4.8-1
               3.7-1.8 7.1-5.9 7.8-10.4
               2.6-.4 5-1.5 6.2-3.1
               .7-.9.3-2.3-.9-2.6
               -1.9-.4-4.1-1.3-5.3-2.1
               -1-.6-1.7-1.4-1.3-2.8
               .4-1.5 1-3.7 1-6.1
               C44.3 19.6 39.2 14 32 14Z"
            fill="#FFFFFF"
            stroke="#111827"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path
            d="M24.8 46.6c2.1 1.3 4.4 1.9 7.2 1.9s5.1-.6 7.2-1.9"
            fill="none"
            stroke="#111827"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
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
