import { useEffect, useState } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";

import Dashboard from "./pages/Dashboard";
import Platforms from "./pages/Platforms";
import Logs from "./pages/Logs";

import { bootstrapEmbedded } from "./auth/embedded";

import "./App.css";

const API_BASE = window.__API_BASE__ || process.env.REACT_APP_API_BASE || "";

export default function App() {
  // Establish the embedded session before rendering. Inside Salla this verifies
  // the merchant and stores a session token; standalone it resolves instantly.
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let mounted = true;
    bootstrapEmbedded(API_BASE).finally(() => {
      if (mounted) setBooting(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (booting) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#7B2FF7",
          fontFamily: "system-ui, sans-serif"
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/connections" element={<Platforms />} />
          <Route path="/logs" element={<Logs />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
