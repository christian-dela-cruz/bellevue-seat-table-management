// src/components/layout/AdminNavbar.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authAPI } from "../../services/authAPI";
import bellevueLogo from "../../assets/bellevue-logo.png";

function AdminNavbar({ onLogout, pendingCount: pendingProp }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [pending, setPending] = useState(pendingProp ?? 0);

  // Keep badge in sync if parent passes pendingCount prop,
  // otherwise read from localStorage as a live fallback
  useEffect(() => {
    if (pendingProp !== undefined) { setPending(pendingProp); return; }
    const read = () => {
      try {
        const raw = localStorage.getItem("bellevue_pending_count");
        if (raw !== null) setPending(Number(raw));
      } catch {}
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [pendingProp]);

  const isNotifActive = location.pathname === "/admin/notifications";

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
      return;
    }

    await authAPI.logout();
    navigate("/login", { replace: true });
  };

  return (
    <nav style={{
      height: 60,
      background: "#FFFFFF",
      borderBottom: "1px solid #E1E4E8",
      display: "flex",
      alignItems: "center",
      padding: "0 32px",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <img
          src={bellevueLogo}
          alt="The Bellevue Manila"
          style={{ width: 40, height: "auto", objectFit: "contain" }}
        />
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/* Bell icon — navigate to /admin/notifications */}
        <button
          onClick={() => navigate("/admin/notifications")}
          title="Notifications"
          style={{
            width: 38, height: 38,
            border: "none",
            background: isNotifActive ? "rgba(201,168,76,0.10)" : "transparent",
            borderRadius: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            transition: "background 0.15s",
            // FIX: use a darker, more visible gray (#374151) instead of #6B7280
            color: isNotifActive ? "#C9A84C" : "#374151",
            outline: isNotifActive ? "1.5px solid rgba(201,168,76,0.35)" : "none",
            // FIX: prevent button baseline from collapsing the icon
            lineHeight: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isNotifActive
              ? "rgba(201,168,76,0.16)"
              : "rgba(107,114,128,0.08)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = isNotifActive
              ? "rgba(201,168,76,0.10)"
              : "transparent";
          }}
        >
          {/* FIX: explicit stroke color as fallback in case currentColor isn't inherited */}
          <svg
            width="20" height="20" viewBox="0 0 24 24"
            fill="none"
            stroke={isNotifActive ? "#C9A84C" : "#374151"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ pointerEvents: "none", display: "block", flexShrink: 0 }}
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>

          {/* Badge */}
          {pending > 0 && (
            <span style={{
              position: "absolute",
              top: 4, right: 4,
              background: "#EF4444",
              color: "#fff",
              borderRadius: "50%",
              minWidth: 16, height: 16,
              fontSize: 9,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Montserrat, sans-serif",
              padding: "0 3px",
              lineHeight: 1,
              pointerEvents: "none",
            }}>
              {pending > 99 ? "99+" : pending}
            </span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Sign Out"
          style={{
            padding: "8px 12px",
            border: "1px solid rgba(201,168,76,0.3)",
            background: "transparent",
            color: "#C9A84C",
            borderRadius: 6,
            fontFamily: "Montserrat, sans-serif",
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(201,168,76,0.10)";
            e.currentTarget.style.borderColor = "#C9A84C";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)";
          }}
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ pointerEvents: "none" }}
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

export default AdminNavbar;
