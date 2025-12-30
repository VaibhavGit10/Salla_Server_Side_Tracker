import { useEffect, useMemo, useState } from "react";
import { ConversionTrend, PlatformDistribution } from "../components/cards/Charts";
import Skeleton from "../components/ui/Skeleton";
import { getStoreId } from "../utils/store";

export default function Dashboard() {
  const storeId = getStoreId();
  const [loading, setLoading] = useState(true);

  const summary = {
    forwarded: 12,
    successRate: 92,
    revenue: 18450,
    signalLoss: 1,
    forwardedDelta: 18,
    successDelta: 2.5,
    revenueDelta: 12.2,
    signalLossDelta: -0.3
  };

  const trendData = [
    { date: "Mon", value: 1200 },
    { date: "Tue", value: 2400 },
    { date: "Wed", value: 1800 },
    { date: "Thu", value: 3200 },
    { date: "Fri", value: 4100 }
  ];

  const platformData = [
    { platform: "GA4", value: 70 },
    { platform: "Meta", value: 20 },
    { platform: "TikTok", value: 10 }
  ];

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(t);
  }, []);

  const kpis = useMemo(
    () => [
      {
        label: "Events Forwarded",
        value: summary.forwarded,
        hint: "vs last period",
        delta: summary.forwardedDelta,
        icon: "📤",
        tone: "blue",
        glow: "rgba(13,110,253,0.22)"
      },
      {
        label: "Success Rate",
        value: `${summary.successRate}%`,
        hint: "vs last period",
        delta: summary.successDelta,
        icon: "✅",
        tone: "green",
        glow: "rgba(25,135,84,0.20)"
      },
      {
        label: "Attributed Value",
        value: `SAR ${formatMoney(summary.revenue)}`,
        hint: "vs last period",
        delta: summary.revenueDelta,
        icon: "💰",
        tone: "cyan",
        glow: "rgba(13,202,240,0.22)"
      },
      {
        label: "Signal Loss",
        value: summary.signalLoss,
        hint: "vs last period",
        delta: summary.signalLossDelta,
        icon: "📡",
        tone: "yellow",
        glow: "rgba(255,193,7,0.18)"
      }
    ],
    [summary]
  );

  return (
    <div className="dash">
      {/* ✅ HERO */}
      <section className="hero">
        <div className="heroLeft">
          <div className="heroBadge">
            <span className="pulseDot" />
            Live Dashboard
            <span className="badgePill">Realtime</span>
          </div>

          <div className="heroTitle">Executive Summary</div>
          <div className="heroSub">Overview for store: <b>{storeId}</b></div>
        </div>

        <div className="heroRight">
          <button className="btn ghost" type="button">Export</button>
          <button className="btn primary" type="button">
            View Details
            <span className="shine" />
          </button>
        </div>
      </section>

      {/* ✅ KPI GRID */}
      <section className="kpiGrid">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div className="kpiCard" key={i}>
                <div className="kpiTop">
                  <Skeleton height={14} width="60%" />
                  <Skeleton height={44} width={44} />
                </div>
                <div style={{ marginTop: 14 }}>
                  <Skeleton height={30} width="55%" />
                </div>
                <div style={{ marginTop: 12 }}>
                  <Skeleton height={12} width="45%" />
                </div>
              </div>
            ))
          : kpis.map(k => <KPI key={k.label} {...k} />)}
      </section>

      {/* ✅ CHARTS */}
      <section className="chartsGrid">
        <Card
          title="Conversion Trend"
          subtitle="Attributed value across days"
          right={<Chip tone="blue">Weekly</Chip>}
        >
          <ConversionTrend data={trendData} loading={loading} />
        </Card>

        <Card
          title="Platform Distribution"
          subtitle="Contribution by source"
          right={<Chip tone="cyan">Sources</Chip>}
        >
          <PlatformDistribution data={platformData} loading={loading} />
        </Card>
      </section>

      {/* ✅ INSIGHTS */}
      <section className="insightsGrid">
        <Insight
          loading={loading}
          title="Top Driver"
          value="GA4"
          note="Highest contribution this period"
          tone="green"
          tag="Healthy"
        />
        <Insight
          loading={loading}
          title="Recommendation"
          value="Scale Meta campaigns"
          note="Meta conversions are increasing"
          tone="blue"
          tag="Action"
        />
        <Insight
          loading={loading}
          title="Alert Monitor"
          value="Signal loss minimal"
          note="Tracking is stable"
          tone="red"
          tag="Stable"
        />
      </section>

      {/* ✅ INLINE THEME CSS */}
      <style>{`
        :root{
          --p:#191C24;
          --a:#AF1763;
          --b:#0D6EFD;
          --g:#198754;
          --c:#0DCAF0;
          --r:#AB2E3C;
          --y:#FFC107;
        }

        .dash{
          width: 100%;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: radial-gradient(circle at 10% 0%, rgba(175,23,99,0.12), transparent 60%),
                      radial-gradient(circle at 90% 10%, rgba(13,202,240,0.10), transparent 55%),
                      #f3f4f6;
        }

        /* HERO */
        .hero{
          width: 100%;
          display:flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          padding: 18px;
          border-radius: 22px;
          border: 1px solid rgba(15,23,42,0.10);
          background:
            radial-gradient(circle at 12% 20%, rgba(175,23,99,0.18), transparent 55%),
            radial-gradient(circle at 92% 20%, rgba(13,202,240,0.14), transparent 55%),
            linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.74));
          box-shadow: 0 22px 70px rgba(15,23,42,0.12);
          position: relative;
          overflow: hidden;
        }

        .hero::before{
          content:"";
          position:absolute;
          inset:0;
          background-image: radial-gradient(rgba(25,28,36,0.12) 1px, transparent 1px);
          background-size: 22px 22px;
          opacity: 0.08;
          pointer-events:none;
        }

        .heroLeft{ position: relative; z-index:1; }
        .heroTitle{
          margin-top: 10px;
          font-size: 20px;
          font-weight: 1100;
          color: #0f172a;
          letter-spacing: -0.4px;
        }
        .heroSub{
          margin-top: 4px;
          font-size: 13px;
          font-weight: 800;
          color: rgba(15,23,42,0.65);
        }

        .heroBadge{
          display:inline-flex;
          align-items:center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.90);
          border: 1px solid rgba(15,23,42,0.10);
          font-size: 13px;
          font-weight: 900;
          color: rgba(15,23,42,0.75);
          box-shadow: 0 12px 28px rgba(15,23,42,0.08);
        }

        .pulseDot{
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: var(--g);
          box-shadow: 0 0 0 6px rgba(25,135,84,0.16);
        }

        .badgePill{
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
          color: #0b3d1f;
          background: rgba(25,135,84,0.14);
          border: 1px solid rgba(25,135,84,0.22);
        }

        .heroRight{
          position: relative;
          z-index:1;
          display:flex;
          gap: 10px;
          align-items:center;
        }

        /* Buttons */
        .btn{
          border:0;
          cursor:pointer;
          padding: 10px 14px;
          border-radius: 14px;
          font-weight: 950;
          font-size: 14px;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
          position: relative;
          overflow:hidden;
          white-space: nowrap;
        }
        .btn:hover{ transform: translateY(-1px); }

        .btn.ghost{
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(15,23,42,0.10);
          color: rgba(15,23,42,0.78);
          box-shadow: 0 10px 24px rgba(15,23,42,0.06);
        }
        .btn.primary{
          color:#fff;
          background: linear-gradient(135deg, var(--a), var(--b));
          box-shadow: 0 16px 38px rgba(175,23,99,0.20);
        }
        .shine{
          position:absolute;
          top:-60%;
          left:-40%;
          width:40%;
          height:220%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: rotate(25deg);
          animation: shine 2.8s ease-in-out infinite;
          pointer-events:none;
        }
        @keyframes shine{
          0% { transform: translateX(-160%) rotate(25deg); opacity: 0; }
          20%{ opacity:1; }
          60%{ transform: translateX(260%) rotate(25deg); opacity: 0; }
          100%{ opacity: 0; }
        }

        /* KPI */
        .kpiGrid{
          display:grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .kpiCard{
          border-radius: 22px;
          padding: 16px;
          background: rgba(255,255,255,0.84);
          border: 1px solid rgba(15,23,42,0.10);
          box-shadow: 0 18px 55px rgba(15,23,42,0.12);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
          position: relative;
          overflow: hidden;
        }
        .kpiCard:hover{
          transform: translateY(-3px);
          box-shadow: 0 30px 85px rgba(15,23,42,0.16);
        }

        .kpiTop{
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap: 12px;
        }
        .kpiLabel{
          font-size: 13px;
          font-weight: 950;
          color: rgba(15,23,42,0.65);
        }
        .kpiValue{
          margin-top: 10px;
          font-size: 28px;
          font-weight: 1200;
          letter-spacing: -0.6px;
          color: #0f172a;
        }
        .kpiFooter{
          margin-top: 10px;
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap: 10px;
        }
        .kpiHint{
          font-size: 12px;
          font-weight: 850;
          color: rgba(15,23,42,0.55);
        }

        .delta{
          font-size: 12px;
          font-weight: 1100;
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.72);
        }
        .delta.up{
          background: rgba(25,135,84,0.14);
          border-color: rgba(25,135,84,0.22);
          color: #0b3d1f;
        }
        .delta.down{
          background: rgba(171,46,60,0.14);
          border-color: rgba(171,46,60,0.22);
          color: #6b0d16;
        }

        .kpiIcon{
          width: 44px;
          height: 44px;
          border-radius: 18px;
          display:grid;
          place-items:center;
          font-size: 18px;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(25,28,36,0.04);
        }

        .kpiIcon.blue{ background: rgba(13,110,253,0.14); border-color: rgba(13,110,253,0.22); }
        .kpiIcon.green{ background: rgba(25,135,84,0.14); border-color: rgba(25,135,84,0.22); }
        .kpiIcon.cyan{ background: rgba(13,202,240,0.14); border-color: rgba(13,202,240,0.22); }
        .kpiIcon.red{ background: rgba(171,46,60,0.14); border-color: rgba(171,46,60,0.22); }
        .kpiIcon.yellow{ background: rgba(255,193,7,0.16); border-color: rgba(255,193,7,0.24); }

        /* Charts */
        .chartsGrid{
          display:grid;
          grid-template-columns: 2fr 1fr;
          gap: 14px;
        }

        .card{
          border-radius: 22px;
          padding: 14px;
          background: rgba(255,255,255,0.72);
          border: 1px solid rgba(15,23,42,0.10);
          box-shadow: 0 14px 40px rgba(15,23,42,0.10);
        }
        .cardHead{
          display:flex;
          justify-content:space-between;
          gap: 12px;
          align-items:flex-start;
          margin-bottom: 10px;
        }
        .cardTitle{
          margin: 0;
          font-size: 15px;
          font-weight: 1150;
          color: #0f172a;
        }
        .cardSub{
          margin-top: 4px;
          font-size: 12px;
          font-weight: 850;
          color: rgba(15,23,42,0.55);
        }

        /* Chips */
        .chip{
          padding: 7px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 1100;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.75);
          color: rgba(15,23,42,0.70);
          white-space: nowrap;
        }
        .chip.blue{ background: rgba(13,110,253,0.14); border-color: rgba(13,110,253,0.22); color:#083b8a; }
        .chip.cyan{ background: rgba(13,202,240,0.14); border-color: rgba(13,202,240,0.22); color:#055a66; }

        /* Insights */
        .insightsGrid{
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .insight{
          border-radius: 22px;
          padding: 14px 16px;
          background: rgba(255,255,255,0.74);
          border: 1px solid rgba(15,23,42,0.10);
          box-shadow: 0 14px 40px rgba(15,23,42,0.10);
        }

        .insTop{
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap: 10px;
        }

        .insTitle{
          font-size: 12px;
          font-weight: 950;
          color: rgba(15,23,42,0.55);
        }

        .insValue{
          margin-top: 10px;
          font-size: 16px;
          font-weight: 1150;
          color: #0f172a;
        }
        .insNote{
          margin-top: 6px;
          font-size: 12px;
          font-weight: 850;
          color: rgba(15,23,42,0.55);
        }

        .tag{
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 1100;
          border: 1px solid rgba(15,23,42,0.10);
          background: rgba(255,255,255,0.75);
          color: rgba(15,23,42,0.70);
        }
        .tag.green{ background: rgba(25,135,84,0.14); border-color: rgba(25,135,84,0.22); color:#0b3d1f; }
        .tag.blue{ background: rgba(13,110,253,0.14); border-color: rgba(13,110,253,0.22); color:#083b8a; }
        .tag.red{ background: rgba(171,46,60,0.14); border-color: rgba(171,46,60,0.22); color:#6b0d16; }

        /* Responsive */
        @media (max-width: 1100px){
          .kpiGrid{ grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 980px){
          .chartsGrid{ grid-template-columns: 1fr; }
          .insightsGrid{ grid-template-columns: 1fr; }
        }
        @media (max-width: 560px){
          .dash{ padding: 12px; }
          .kpiGrid{ grid-template-columns: 1fr; }
          .hero{ padding: 14px; }
        }
      `}</style>
    </div>
  );
}

/* KPI Card */
function KPI({ label, value, hint, delta, icon, tone, glow }) {
  const isUp = typeof delta === "number" ? delta >= 0 : true;
  const abs = typeof delta === "number" ? Math.abs(delta) : 0;

  return (
    <div className="kpiCard" style={{ boxShadow: `0 18px 55px ${glow}` }}>
      <div className="kpiTop">
        <div className="kpiLabel">{label}</div>
        <div className={`kpiIcon ${tone}`}>{icon}</div>
      </div>

      <div className="kpiValue">{value}</div>

      <div className="kpiFooter">
        <div className="kpiHint">{hint}</div>
        <div className={`delta ${isUp ? "up" : "down"}`}>
          {isUp ? "▲" : "▼"} {abs}%
        </div>
      </div>
    </div>
  );
}

/* Card wrapper */
function Card({ title, subtitle, right, children }) {
  return (
    <div className="card">
      <div className="cardHead">
        <div>
          <p className="cardTitle">{title}</p>
          <div className="cardSub">{subtitle}</div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Chip({ tone, children }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

function Insight({ loading, title, value, note, tone, tag }) {
  return (
    <div className="insight">
      {loading ? (
        <>
          <Skeleton height={12} width="45%" />
          <div style={{ marginTop: 10 }}>
            <Skeleton height={18} width="70%" />
          </div>
          <div style={{ marginTop: 10 }}>
            <Skeleton height={12} width="60%" />
          </div>
        </>
      ) : (
        <>
          <div className="insTop">
            <div className="insTitle">{title}</div>
            <div className={`tag ${tone}`}>{tag}</div>
          </div>
          <div className="insValue">{value}</div>
          <div className="insNote">{note}</div>
        </>
      )}
    </div>
  );
}

function formatMoney(n) {
  try {
    return new Intl.NumberFormat("en-US").format(Number(n || 0));
  } catch {
    return n;
  }
}
