import { NavLink } from "react-router-dom";
import "./Sidebar.css";

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">∿</div>
        <span>Salla Hub</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" end className="nav-item">
          <span className="icon">▦</span>
          Dashboard
        </NavLink>

        <NavLink to="/connections" className="nav-item">
          <span className="icon">⛓</span>
          Connections
        </NavLink>

        <NavLink to="/logs" className="nav-item">
          <span className="icon">≡</span>
          Event Logs
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="health-dot" />
        <span>System Healthy</span>
      </div>
    </aside>
  );
}
