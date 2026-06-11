import { useEffect, useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Link2, ScrollText, Globe, Layers } from "lucide-react";
import { getStoreId } from "../../utils/store";
import { useTranslation } from "../../utils/i18n";
import { apiGet } from "../../api/http";
import { fetchStores } from "../../api/platforms.api";

export default function Sidebar() {
  const { t, lang, changeLanguage } = useTranslation();
  const [open, setOpen] = useState(false);

  // Reactive store card
  const [storeId, setStoreIdLocal] = useState(() => getStoreId());
  const [storesMap, setStoresMap] = useState({});
  const storeName = storesMap[storeId]?.store_name || (storeId ? `Store ${storeId}` : "Default Store");

  useEffect(() => {
    const onStoreChange = (e) => {
      const next = String(e?.detail?.storeId || "").trim();
      if (next) setStoreIdLocal(next);
    };
    const onStorage = (e) => {
      if (e.key === "selected_store_id") {
        setStoreIdLocal(String(e.newValue || "").trim());
      }
    };
    window.addEventListener("store_id_changed", onStoreChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("store_id_changed", onStoreChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Fetch store names once on mount
  useEffect(() => {
    fetchStores()
      .then((res) => {
        const list = res?.data?.data || res?.data || [];
        const map = {};
        for (const s of list) {
          if (s?.store_id) map[s.store_id] = s;
        }
        setStoresMap(map);
      })
      .catch(() => {});
  }, []);

  // Dynamic health status
  const [health, setHealth] = useState("checking"); // "healthy" | "unhealthy" | "checking"

  const checkHealth = useCallback(async () => {
    try {
      await apiGet("/health");
      setHealth("healthy");
    } catch {
      setHealth("unhealthy");
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => (document.body.style.overflow = "");
  }, [open]);

  const close = () => setOpen(false);

  const healthDotClass = health === "healthy" ? "" : health === "unhealthy" ? "error" : "checking";
  const healthText = health === "healthy" ? t("sidebarHealthy") : health === "unhealthy" ? t("sidebarUnhealthy") : t("sidebarChecking");
  const healthBadge = health === "healthy" ? t("sidebarLive") : health === "unhealthy" ? t("sidebarDown") : "...";
  const healthBadgeClass = health === "healthy" ? "live" : health === "unhealthy" ? "down" : "";

  return (
    <>
      {/* Mobile topbar */}
      <header className="sbTopbar">
        <button className="sbToggle" onClick={() => setOpen(true)} type="button" aria-label="Open menu">
          <span />
          <span />
          <span />
        </button>

        <div className="sbTopbarBrand">
          <div className="sbMiniLogo">
            <Layers size={18} />
          </div>
          <div className="sbTopbarText">
            <div className="sbTopbarTitle">{t("sidebarBrandName")}</div>
            <div className="sbTopbarSub">{t("sidebarBrandTag")}</div>
          </div>
        </div>
      </header>

      {/* overlay */}
      <div className={`sbOverlay ${open ? "show" : ""}`} onClick={close} />

      {/* sidebar */}
      <aside className={`sb ${open ? "open" : ""}`}>
        <div className="sbCloseRow">
          <button className="sbClose" onClick={close} type="button" aria-label="Close menu">
            ✕
          </button>
        </div>

        {/* TOP: BRAND CARD */}
        <div className="sbBrandCard">
          <div className="sbBrandLeft">
            <div className="sbLogoMark">
              <Layers size={22} />
            </div>
            <div className="sbBrandText">
              <div className="sbBrandName">{t("sidebarBrandName")}</div>
              <div className="sbBrandTag">{t("sidebarBrandTag")}</div>
            </div>
          </div>

          <div className="sbBrandRight">
            <span className="sbVersion">v1.0</span>
          </div>
        </div>

        {/* NAV SECTION */}
        <div className="sbSection">
          <div className="sbSectionTitle">{t("sidebarMenu")}</div>

          <nav className="sbNav">
            <SBItem to="/" end icon={<LayoutDashboard size={18} />} label={t("sidebarDashboard")} accent="blue" onClick={close} />
            <SBItem to="/connections" icon={<Link2 size={18} />} label={t("sidebarConnections")} accent="cyan" onClick={close} />
            <SBItem to="/logs" icon={<ScrollText size={18} />} label={t("sidebarEventLogs")} accent="pink" onClick={close} />
          </nav>
        </div>

        {/* BOTTOM STACK */}
        <div className="sbBottomStack">
          {/* Language Toggle */}
          <div className="sbLangRow">
            <span className="sbLangLabel">
              <Globe size={14} />
              {t("language")}
            </span>
            <button
              type="button"
              className={`sbLangBtn ${lang === "en" ? "active" : ""}`}
              onClick={() => changeLanguage("en")}
            >
              {t("english")}
            </button>
            <button
              type="button"
              className={`sbLangBtn ${lang === "ar" ? "active" : ""}`}
              onClick={() => changeLanguage("ar")}
            >
              {t("arabic")}
            </button>
          </div>

          {/* Store Card */}
          <div className="sbStoreCard">
            <div className="sbStoreIcon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "rgba(255,193,7,0.85)" }}>
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div className="sbStoreMeta">
              <div className="sbStoreName">{storeName}</div>
              <div className="sbStoreId">ID: {storeId || "N/A"}</div>
            </div>
            <span className="sbStorePill">Active</span>
          </div>

          {/* Health Strip */}
          <div className="sbHealthStrip">
            <span className={`sbHealthDot ${healthDotClass}`} />
            <span className="sbHealthText">{healthText}</span>
            <span className={`sbHealthBadge ${healthBadgeClass}`}>{healthBadge}</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function SBItem({ to, end, icon, label, accent, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => `sbLink ${isActive ? "active" : ""}`}
    >
      <span className={`sbIcon ${accent}`} aria-hidden="true">
        {icon}
      </span>
      <span className="sbLabel">{label}</span>
    </NavLink>
  );
}
