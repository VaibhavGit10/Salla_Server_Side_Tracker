import { useEffect, useState } from "react";
import Container from "../components/layout/Container";
import { ConversionTrend, PlatformDistribution } from "../components/cards/Charts";
import Skeleton from "../components/ui/Skeleton";
import { getStoreId } from "../utils/store"

export default function Dashboard() {
  const storeId = getStoreId();

  const [loading, setLoading] = useState(true);

  const summary = {
    forwarded: 12,
    successRate: 92,
    revenue: 18450,
    signalLoss: 1
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
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <Container
      title="Executive Summary"
      subtitle={`Overview for store: ${storeId}`}
    >
      <div className="stats-grid">
        {loading
          ? [1, 2, 3, 4].map(i => (
              <div className="stat-card" key={i}>
                <Skeleton height={12} width="40%" />
                <div style={{ marginTop: 10 }}>
                  <Skeleton height={28} width="60%" />
                </div>
              </div>
            ))
          : (
            <>
              <Stat label="Events Forwarded" value={summary.forwarded} />
              <Stat label="Success Rate" value={`${summary.successRate}%`} />
              <Stat label="Attributed Value" value={`SAR ${summary.revenue}`} />
              <Stat label="Signal Loss" value={summary.signalLoss} />
            </>
          )}
      </div>

      <div className="charts-grid">
        <ConversionTrend data={trendData} loading={loading} />
        <PlatformDistribution data={platformData} loading={loading} />
      </div>
    </Container>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
