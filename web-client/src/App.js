import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/layout/Sidebar";

import Dashboard from "./pages/Dashboard";
import Platforms from "./pages/Platforms";
import Logs from "./pages/Logs";

import "./App.css";

export default function App() {
  return (
    <BrowserRouter basename="/app">
      <div className="app-layout">
        <Sidebar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/connections" element={<Platforms />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
