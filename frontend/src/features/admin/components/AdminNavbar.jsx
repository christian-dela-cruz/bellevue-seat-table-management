import { useState } from "react";

const C = {
  primary: "#1B2A4A",
  secondary: "#C9A74D",
  text: "#374151",
  textLight: "#9CA3AF",
  border: "#E5E7EB",
  background: "#F8FAFC",
};

const F = {
  body: "'DM Sans', sans-serif",
};

export default function AdminNavbar({ onLogout }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <nav style={{
      height: 70,
      background: C.primary,
      color: "white",
      padding: "0 30px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      position: "sticky",
      top: 0,
      zIndex: 1000,
    }}>
      <div style={{
        maxWidth: "1400px",
        margin: "0 auto",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        {/* Logo/Title */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "15px",
        }}>
          <div style={{
            width: "40px",
            height: "40px",
            background: "white",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: "18px",
            color: C.primary,
          }}>
            🏨
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: 700,
              fontFamily: "'Cormorant Garamond', Georgia, serif",
            }}>
              The Bellevue Manila
            </h1>
            <p style={{
              margin: "4px 0 0 0",
              fontSize: "12px",
              opacity: 0.8,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}>
              ADMIN PANEL
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <button
            onClick={onLogout}
            style={{
              padding: "10px 20px",
              background: "rgba(255,255,255,255,0.1)",
              color: "white",
              border: "1px solid rgba(255,255,255,255,0.2)",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.target.style.background = "rgba(255,255,255,255,0.2)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background = "rgba(255,255,255,255,0.1)";
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
