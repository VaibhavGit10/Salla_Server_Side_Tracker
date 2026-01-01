import { useEffect, useMemo, useState } from "react";
import Skeleton from "../components/ui/Skeleton";
import { getStoreId } from "../utils/store";
import { fetchDashboardSummary } from "../api/platforms.api";

export default function Dashboard() {
  // ✅ make storeId reactive (so dashboard updates when you change store in Connections)
  const [storeId, setStoreIdState] = useState(() => getStoreId() || "");

  const [loading, setLoading] = useState(true);

  // ✅ backend-driven stats (defaults)
  const [stats, setStats] = useState({
    total: 0,
    by_status: {}
  });

  // ✅ listen for store changes (same-tab + cross-tab)
  useEffect(() => {
  const syncStore = () => setStoreIdState(getStoreId() || "");

  // ✅ cross-tab updates
  const onStorage = (e) => {
    if (e.key === "selected_store_id") syncStore();
  };

  // ✅ same-tab updates
  const onStoreChange = (e) => {
    const next = e?.detail?.storeId;
    if (next) setStoreIdState(String(next));
    else syncStore();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener("store_id_changed", onStoreChange);

  syncStore();

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("store_id_changed", onStoreChange);
  };
}, []);


  // ✅ load stats ONLY when storeId is available
  useEffect(() => {
    let mounted = true;

    // ✅ CRITICAL GUARD
    if (!storeId || !String(storeId).trim()) {
      setStats({ total: 0, by_status: {} });
      setLoading(false);
      return;
    }

    setLoading(true);

    fetchDashboardSummary(storeId, 24)
      .then((resp) => {
        const data = resp?.data || resp; // defensive
        if (mounted && data) {
          setStats({
            total: Number(data.total || 0),
            by_status: data.by_status || {}
          });
        }
      })
      .catch(() => {
        // keep defaults
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [storeId]);

  // ✅ derive KPI numbers from datastore statuses
  const summary = useMemo(() => {
    const by = stats.by_status || {};
    const total = Number(stats.total || 0);
    const sent = Number(by.sent || 0);
    const failed = Number(by.failed || 0);
    const skipped = Number(by.skipped || 0);
    const pending = Number(by.pending || 0);

    const delivered = sent + failed; // only attempted deliveries
    const successRate = delivered > 0 ? (sent / delivered) * 100 : 0;

    return {
      total,
      sent,
      failed,
      skipped,
      pending,
      successRate
    };
  }, [stats]);

  // keep your existing demo visuals for now
  const platformDistribution = [{ platform: "GA4", value: 100, color: "#0D6EFD" }];

  const trafficTrend = useMemo(
    () => ({
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      series: [{ name: "GA4", color: "#0D6EFD", data: [0, 0, 0, 0, 0, 0, 0] }]
    }),
    []
  );

  const platformCards = [
    {
      name: "GA4",
      desc: "Analytics events",
      pill: "Tracking",
      tone: "#0D6EFD",
      accent: "linear-gradient(90deg,#4285F4,#34A853,#FBBC05,#EA4335)",
      stats: {
        forwarded: summary.total,
        successRate: Number(summary.successRate.toFixed(1)),
        revenue: 0,
        loss:
          summary.total > 0
            ? Number(((summary.skipped / summary.total) * 100).toFixed(1))
            : 0
      }
    }
  ];

  const kpis = useMemo(
    () => [
      { label: "Total Events", value: summary.total, delta: 0, icon: "📤", tone: "blue" },
      { label: "Sent", value: summary.sent, delta: 0, icon: "✅", tone: "green" },
      { label: "Failed", value: summary.failed, delta: 0, icon: "❌", tone: "pink" },
      { label: "Skipped", value: summary.skipped, delta: 0, icon: "⏭️", tone: "yellow" }
    ],
    [summary]
  );

  return (
    <div className="dash">
      {/* TOP BAR */}
      <div className="topbar">
        <div className="brandArea">
          <div className="logoBubble">∿</div>
          <div>
            <div className="brandTitle">Salla Hub</div>
            <div className="brandSub">Server-side tracking overview</div>
          </div>
        </div>

        <div className="topbarRight">
          <div className="storeChip">
            <span className="dotLive" />
            Store: <b>{storeId || "N/A"}</b>
          </div>
          <div className="rangeChip">Last 24 hours</div>

          <button className="btn ghost" type="button">Export</button>
          <button className="btn primary" type="button">
            View Details <span className="shine" />
          </button>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div className="kpi" key={i}>
                <Skeleton height={14} width="55%" />
                <div style={{ marginTop: 12 }}>
                  <Skeleton height={34} width="65%" />
                </div>
                <div style={{ marginTop: 10 }}>
                  <Skeleton height={12} width="45%" />
                </div>
              </div>
            ))
          : kpis.map((k) => <KPI key={k.label} {...k} />)}
      </div>

      {/* MAIN GRID */}
      <div className="mainGrid">
        <div className="card premium">
          <div className="cardHead">
            <div>
              <div className="cardTitle">Traffic Trend (All Platforms)</div>
              <div className="cardSub">MVP: GA4 only</div>
            </div>
            <span className="pill blue">Traffic</span>
          </div>
          <div className="cardBody">
            <GroupedBarChart labels={trafficTrend.labels} series={trafficTrend.series} />
          </div>
        </div>

        <div className="card">
          <div className="cardHead">
            <div>
              <div className="cardTitle">Platform Distribution</div>
              <div className="cardSub">MVP: GA4 only</div>
            </div>
            <span className="pill cyan">Sources</span>
          </div>

          <div className="cardBody cardBodyDist">
            {loading ? (
              <>
                <Skeleton height={240} />
                <div style={{ marginTop: 12 }}>
                  <Skeleton height={12} width="70%" />
                </div>
                <div style={{ marginTop: 8 }}>
                  <Skeleton height={12} width="55%" />
                </div>
              </>
            ) : (
              <AnimatedDonutDistribution
                items={platformDistribution}
                centerTitle="Total Events"
                centerValue={formatMoney(summary.total)}
              />
            )}
          </div>
        </div>
      </div>

      {/* PLATFORM CARDS */}
      <div className="grid4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div className="pCard" key={i}>
                <Skeleton height={10} width="45%" />
                <div style={{ marginTop: 10 }}>
                  <Skeleton height={18} width="65%" />
                </div>
                <div style={{ marginTop: 14 }}>
                  <Skeleton height={48} />
                </div>
              </div>
            ))
          : platformCards.map((p) => <PlatformCard key={p.name} {...p} />)}
      </div>

      <style>{css}</style>
    </div>
  );
}

/* KPI */
function KPI({ label, value, delta, icon, tone }) {
  const isUp = typeof delta === "number" ? delta >= 0 : true;
  const abs = typeof delta === "number" ? Math.abs(delta) : 0;

  return (
    <div className={`kpi tone-${tone}`}>
      <div className="kpiTop">
        <div className="kpiLabel">{label}</div>
        <div className="kpiIcon">{icon}</div>
      </div>

      <div className="kpiValue">{value}</div>

      <div className="kpiBottom">
        <div className={`delta ${isUp ? "up" : "down"}`}>
          {isUp ? "▲" : "▼"} {abs}%
        </div>
        <div className="kpiHint">vs last period</div>
      </div>
    </div>
  );
}

/* Platform Card */
function PlatformCard({ name, desc, pill, tone, accent, stats }) {
  return (
    <div className="pCard">
      <div className="pAccent" style={{ background: accent }} />
      <div className="pBody">
        <div className="pTop">
          <div>
            <div className="pName">{name}</div>
            <div className="pDesc">{desc}</div>
          </div>
          <div className="pPill" style={{ color: tone, background: `${tone}12`, borderColor: `${tone}26` }}>
            {pill}
          </div>
        </div>

        <div className="pStats">
          <StatMini label="Forwarded" value={stats.forwarded} />
          <StatMini label="Success" value={`${stats.successRate}%`} />
          <StatMini label="Revenue" value={`SAR ${formatMoney(stats.revenue)}`} />
          <StatMini label="Loss" value={`${stats.loss}%`} />
        </div>
      </div>
    </div>
  );
}

function StatMini({ label, value }) {
  return (
    <div className="mini">
      <div className="miniLabel">{label}</div>
      <div className="miniValue">{value}</div>
    </div>
  );
}

/* Bar Chart */
function GroupedBarChart({ labels = [], series = [] }) {
  const [hover, setHover] = useState(null);

  const W = 980, H = 300;
  const PAD_X = 44, PAD_TOP = 20, PAD_BOTTOM = 40;

  const max = Math.max(1, ...series.flatMap((s) => s.data || []));
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const groups = labels.length || 1;
  const groupW = innerW / groups;

  const barCount = Math.max(1, series.length);
  const gap = Math.max(6, Math.floor(groupW * 0.06));
  const barW = Math.max(10, Math.floor((groupW - gap * (barCount + 1)) / barCount));

  const x0 = (i) => PAD_X + i * groupW;
  const barX = (i, j) => x0(i) + gap + j * (barW + gap);

  const y = (v) => PAD_TOP + (1 - v / max) * innerH;
  const barH = (v) => PAD_TOP + innerH - y(v);

  const onMove = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const mx = ((evt.clientX - rect.left) / rect.width) * W;
    const idx = Math.min(labels.length - 1, Math.max(0, Math.floor((mx - PAD_X) / groupW)));
    setHover({ idx });
  };
  const onLeave = () => setHover(null);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="300"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ display: "block" }}
    >
      {labels.map((lb, i) => (
        <text
          key={lb}
          x={x0(i) + groupW / 2}
          y={H - 12}
          textAnchor="middle"
          fontSize="12"
          fill="rgba(15,23,42,0.55)"
          fontWeight="900"
        >
          {lb}
        </text>
      ))}

      {labels.map((_, i) => (
        <g key={i}>
          {series.map((s, j) => {
            const v = s.data?.[i] ?? 0;
            const bx = barX(i, j);
            const by = y(v);
            const bh = barH(v);

            return (
              <rect
                key={`${i}-${j}`}
                x={bx}
                y={by}
                width={barW}
                height={bh}
                rx="10"
                fill={s.color}
                opacity={hover && hover.idx !== i ? 0.45 : 0.95}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}
/* ✅ FIXED + ALIGNED Donut Distribution */
function AnimatedDonutDistribution({ items = [], centerTitle, centerValue }) {
  const [active, setActive] = useState(null);

  const total = Math.max(1, items.reduce((s, it) => s + (Number(it.value) || 0), 0));
  const arcs = items.map((it) => ({ ...it, value: Number(it.value) || 0 }));
  const size = 230;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;
  const slices = arcs.map((it) => {
    const pct = it.value / total;
    const len = pct * c;
    const obj = { ...it, pct, len, offset };
    offset += len;
    return obj;
  });

  const activeSlice = typeof active === "number" ? slices[active] : null;

  return (
    <div className="donutWrap">
      {/* LEFT */}
      <div className="donutLeft">
        <div className="donutStage">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="rgba(15,23,42,0.08)"
              strokeWidth={stroke}
            />

            <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              {slices.map((a, i) => (
                <circle
                  key={a.platform}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${a.len} ${c - a.len}`}
                  strokeDashoffset={-a.offset}
                  className="donutArc"
                  style={{ opacity: active === null || active === i ? 1 : 0.35 }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                />
              ))}
            </g>

            <foreignObject x="52" y="78" width="126" height="90">
              <div className="donutCenter">
                <div className="donutTitle">{centerTitle}</div>
                <div className="donutValue">{centerValue}</div>
                {activeSlice ? (
                  <div className="donutActive">
                    <span className="dot" style={{ background: activeSlice.color }} />
                    {activeSlice.platform}: <b>{Math.round(activeSlice.pct * 100)}%</b>
                  </div>
                ) : (
                  <div className="donutActive muted">Hover a slice</div>
                )}
              </div>
            </foreignObject>
          </svg>
        </div>
      </div>

      {/* RIGHT */}
      <div className="donutRight">
        <div className="donutLegend">
          {slices.map((a, i) => (
            <div
              key={a.platform}
              className="donutItem"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="dot" style={{ background: a.color }} />
              <div className="donutItemText">
                <div className="donutItemName">{a.platform}</div>
                <div className="donutItemSub">
                  {formatMoney(a.value)} • <b>{Math.round(a.pct * 100)}%</b>
                </div>
              </div>
              <div className="donutPill">{Math.round(a.pct * 100)}%</div>
            </div>
          ))}
        </div>
      </div>
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

/* ✅ IMPORTANT: alignment fixes are inside css below */
const css = `
:root{
  --a:#AF1763;
  --b:#0D6EFD;
  --g:#198754;
  --c:#0DCAF0;
  --y:#FFC107;
}

.dash{
  width:100%;
  padding:18px;
  display:flex;
  flex-direction:column;
  gap:14px;
  background:
    radial-gradient(circle at 12% 10%, rgba(175,23,99,0.12), transparent 60%),
    radial-gradient(circle at 90% 10%, rgba(13,202,240,0.12), transparent 55%),
    #f3f4f6;
}

.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;}
.brandArea{display:flex;align-items:center;gap:10px;}
.logoBubble{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--a),var(--b));font-weight:1200;}
.brandTitle{font-size:16px;font-weight:1100;color:#0f172a;}
.brandSub{margin-top:2px;font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.topbarRight{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end;}
.storeChip{display:inline-flex;align-items:center;gap:8px;padding:10px 12px;border-radius:999px;background:rgba(255,255,255,0.90);border:1px solid rgba(15,23,42,0.10);font-size:12px;font-weight:950;color:rgba(15,23,42,0.72);}
.dotLive{width:10px;height:10px;border-radius:999px;background:var(--g);box-shadow:0 0 0 6px rgba(25,135,84,0.14);}
.rangeChip{padding:10px 12px;border-radius:999px;background:rgba(13,202,240,0.12);border:1px solid rgba(13,202,240,0.22);font-size:12px;font-weight:950;color:#055a66;}

.btn{border:0;cursor:pointer;padding:10px 14px;border-radius:14px;font-weight:950;font-size:14px;position:relative;overflow:hidden;white-space:nowrap;}
.btn.ghost{background:rgba(255,255,255,0.92);border:1px solid rgba(15,23,42,0.10);color:rgba(15,23,42,0.78);}
.btn.primary{color:#fff;background:linear-gradient(135deg,var(--a),var(--b));}
.shine{position:absolute;top:-60%;left:-40%;width:40%;height:220%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent);transform:rotate(25deg);animation:shine 2.8s ease-in-out infinite;}
@keyframes shine{0%{transform:translateX(-160%) rotate(25deg);opacity:0;}20%{opacity:1;}60%{transform:translateX(260%) rotate(25deg);opacity:0;}100%{opacity:0;}}

.heroStrip{display:flex;gap:14px;flex-wrap:wrap;padding:16px;border-radius:22px;border:1px solid rgba(15,23,42,0.10);background:linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.74));}
.heroLeft{flex:1;min-width:260px;}
.heroRight{width:280px;max-width:100%;}
.heroBadge{display:inline-flex;align-items:center;gap:10px;padding:9px 12px;border-radius:999px;background:rgba(255,255,255,0.90);border:1px solid rgba(15,23,42,0.10);font-size:13px;font-weight:900;}
.pulseDot{width:10px;height:10px;border-radius:999px;background:var(--g);box-shadow:0 0 0 6px rgba(25,135,84,0.16);}
.badgePill{padding:6px 10px;border-radius:999px;font-size:11px;font-weight:950;background:rgba(25,135,84,0.14);border:1px solid rgba(25,135,84,0.22);color:#0b3d1f;}
.heroTitle{margin-top:10px;font-size:20px;font-weight:1100;color:#0f172a;}
.heroSub{margin-top:4px;font-size:13px;font-weight:850;color:rgba(15,23,42,0.62);}

.healthCard{height:100%;border-radius:18px;padding:14px;border:1px solid rgba(15,23,42,0.10);background:rgba(255,255,255,0.82);display:flex;flex-direction:column;justify-content:space-between;}
.healthTop{display:flex;gap:10px;}
.healthIcon{width:40px;height:40px;border-radius:16px;display:grid;place-items:center;background:rgba(13,110,253,0.12);border:1px solid rgba(13,110,253,0.22);}
.healthTitle{font-size:13px;font-weight:1100;color:#0f172a;}
.healthSub{margin-top:4px;font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.healthPill{padding:8px 10px;border-radius:999px;font-size:12px;font-weight:1100;border:1px solid rgba(15,23,42,0.10);}
.healthPill.ok{background:rgba(25,135,84,0.14);border-color:rgba(25,135,84,0.22);color:#0b3d1f;}

.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;}
@media (max-width:1100px){.grid4{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media (max-width:560px){.dash{padding:12px;}.grid4{grid-template-columns:1fr;}}

/* ✅ MAIN ALIGN FIX */
.mainGrid{
  display:grid;
  grid-template-columns: 2fr 1fr;
  gap:14px;
  align-items: stretch;
}
@media (max-width:980px){.mainGrid{grid-template-columns:1fr;}}

.card{
  border-radius:22px;
  padding:14px;
  background:rgba(255,255,255,0.86);
  border:1px solid rgba(15,23,42,0.10);
  display:flex;
  flex-direction:column;     /* ✅ makes head + body align */
}
.cardBody{
  flex:1;                    /* ✅ stretch body to align height */
  padding-top:10px;
  min-height: 320px;         /* ✅ ensures right card doesn't collapse */
}
.cardBodyDist{
  display:flex;
  align-items:center;        /* ✅ vertical align donut nicely */
  justify-content:center;    /* ✅ center everything */
}
.cardHead{display:flex;justify-content:space-between;gap:12px;}
.cardTitle{font-size:15px;font-weight:1150;color:#0f172a;}
.cardSub{margin-top:4px;font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.card.premium{background:rgba(255,255,255,0.90);}

.pill{padding:7px 10px;border-radius:999px;font-size:12px;font-weight:1100;border:1px solid rgba(15,23,42,0.10);}
.pill.blue{background:rgba(13,110,253,0.14);border-color:rgba(13,110,253,0.22);color:#083b8a;}
.pill.cyan{background:rgba(13,202,240,0.14);border-color:rgba(13,202,240,0.22);color:#055a66;}

/* KPI */
.kpi{border-radius:22px;padding:16px;background:rgba(255,255,255,0.90);border:1px solid rgba(15,23,42,0.10);}
.kpiTop{display:flex;justify-content:space-between;align-items:center;}
.kpiLabel{font-size:13px;font-weight:950;color:rgba(15,23,42,0.65);}
.kpiIcon{width:44px;height:44px;border-radius:18px;display:grid;place-items:center;background:rgba(15,23,42,0.05);}
.kpiValue{margin-top:10px;font-size:28px;font-weight:1200;color:#0f172a;}
.kpiBottom{margin-top:10px;display:flex;justify-content:space-between;align-items:center;}
.kpiHint{font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.delta{font-size:12px;font-weight:1100;padding:7px 10px;border-radius:999px;border:1px solid rgba(15,23,42,0.10);}
.delta.up{background:rgba(25,135,84,0.14);border-color:rgba(25,135,84,0.22);color:#0b3d1f;}
.delta.down{background:rgba(171,46,60,0.14);border-color:rgba(171,46,60,0.22);color:#6b0d16;}

/* ✅ Donut alignment */
.donutWrap{
  width:100%;
  display:flex;
  gap:12px;
  align-items:center;
  justify-content:center;
}
.donutLeft{
  flex: 0 0 240px;
  display:flex;
  align-items:center;
  justify-content:center;
}
.donutRight{
  flex:1;
  min-width: 0;
  display:flex;
  justify-content:center;
}
@media (max-width:980px){
  .donutWrap{ flex-direction:column; }
  .donutLeft{ flex: 0 0 auto; }
  .donutRight{ width:100%; }
}

.donutStage{display:grid;place-items:center;}
.donutArc{transform-origin:50% 50%;animation:donutIn 900ms cubic-bezier(.2,.9,.2,1) both;}
@keyframes donutIn{from{stroke-dasharray:0 9999;opacity:0.2;}to{opacity:1;}}
.donutCenter{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;}
.donutTitle{font-size:12px;font-weight:950;color:rgba(15,23,42,0.55);}
.donutValue{font-size:16px;font-weight:1200;color:#0f172a;}
.donutActive{font-size:12px;font-weight:950;color:rgba(15,23,42,0.75);display:flex;align-items:center;gap:8px;}
.donutActive.muted{color:rgba(15,23,42,0.45);}
.dot{width:10px;height:10px;border-radius:999px;display:inline-block;}

.donutLegend{
  width:100%;
  max-width: 320px;
  display:flex;
  flex-direction:column;
  gap:10px;
  max-height: 260px;      /* ✅ prevent overflow */
  overflow:auto;          /* ✅ scroll if needed */
  padding-right: 4px;
}
.donutItem{display:flex;align-items:center;gap:10px;padding:10px;border-radius:16px;border:1px solid rgba(15,23,42,0.08);background:rgba(15,23,42,0.03);}
.donutItemText{flex:1;}
.donutItemName{font-size:13px;font-weight:1100;color:#0f172a;}
.donutItemSub{margin-top:4px;font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.donutPill{padding:7px 10px;border-radius:999px;font-size:12px;font-weight:1100;border:1px solid rgba(15,23,42,0.10);background:rgba(255,255,255,0.75);color:rgba(15,23,42,0.75);}

/* Platform cards (kept minimal) */
.pCard{border-radius:22px;overflow:hidden;border:1px solid rgba(15,23,42,0.10);background:rgba(255,255,255,0.86);}
.pAccent{height:6px;width:100%;}
.pBody{padding:14px 16px 16px;}
.pTop{display:flex;justify-content:space-between;gap:10px;}
.pName{font-size:14px;font-weight:1100;color:#0f172a;}
.pDesc{margin-top:3px;font-size:12px;font-weight:850;color:rgba(15,23,42,0.55);}
.pPill{padding:6px 10px;border-radius:999px;font-size:11px;font-weight:1050;border:1px solid rgba(15,23,42,0.10);}
.pStats{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.mini{border-radius:16px;padding:10px;border:1px solid rgba(15,23,42,0.08);background:rgba(15,23,42,0.03);}
.miniLabel{font-size:11px;font-weight:950;color:rgba(15,23,42,0.55);}
.miniValue{margin-top:6px;font-size:14px;font-weight:1150;color:#0f172a;}
`;
