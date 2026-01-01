import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getStoreId } from "../../utils/store";

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  const storeId = getStoreId();
  const storeName = storeId ? `Store ${storeId}` : "Default Store";


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

  return (
    <>
      {/* ✅ Mobile topbar */}
      <header className="sbTopbar">
        <button className="sbToggle" onClick={() => setOpen(true)} type="button" aria-label="Open menu">
          <span />
          <span />
          <span />
        </button>

        <div className="sbTopbarBrand">
          <div className="sbMiniLogo">∿</div>
          <div className="sbTopbarText">
            <div className="sbTopbarTitle">Salla Hub</div>
            <div className="sbTopbarSub">Attribution Console</div>
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

        {/* ✅ TOP: BRAND CARD */}
        <div className="sbBrandCard">
          <div className="sbBrandLeft">
            <div className="sbLogoMark">∿</div>
            <div className="sbBrandText">
              <div className="sbBrandName">Salla Hub</div>
              <div className="sbBrandTag">Executive Analytics</div>
            </div>
          </div>

          <div className="sbBrandRight">
            <span className="sbVersion">v1.0</span>
          </div>
        </div>

        {/* ✅ NAV SECTION */}
        <div className="sbSection">
          <div className="sbSectionTitle">Menu</div>

          <nav className="sbNav">
            <SBItem to="/" end icon="▦" label="Dashboard" accent="blue" onClick={close} />
            <SBItem to="/connections" icon="⛓" label="Connections" accent="cyan" onClick={close} />
            <SBItem to="/logs" icon="≡" label="Event Logs" accent="pink" onClick={close} />
          </nav>
        </div>

        {/* ✅ BOTTOM STACK (Store + User + Health) */}
        <div className="sbBottomStack">
          {/* Store Card */}
          <div className="sbStoreCard">
            <div className="sbStoreIcon">🏬</div>
            <div className="sbStoreMeta">
              <div className="sbStoreName">{storeName}</div>
              <div className="sbStoreId">Store ID: {storeId || "N/A"}</div>
            </div>
            <span className="sbStorePill">Active</span>
          </div>

       

          {/* Health Strip */}
          <div className="sbHealthStrip">
            <span className="sbHealthDot" />
            <span className="sbHealthText">System Healthy</span>
            <span className="sbHealthBadge">LIVE</span>
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
