import { HashRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";

import Dashboard from "./pages/Dashboard";
import Platforms from "./pages/Platforms";
import Logs from "./pages/Logs";

import "./App.css";

export default function App() {
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
