// src/components/admin/Sidebar.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ClipboardList, Map, UserCog, BarChart3 } from "lucide-react";
import { authAPI } from "../../services/authAPI";

const F = { body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };

const NAV_ITEMS = [
  { id: "reservations", label: "Reservations", icon: ClipboardList, iconStyle: "lucide" },
  { id: "cancelled",    label: "Cancelled",    icon: X,           iconStyle: "lucide" },
  { id: "reports",      label: "Reports",      icon: BarChart3,   iconStyle: "lucide", permission: "view_outlet_reports" },
  { id: "accounts",     label: "Accounts",     icon: UserCog,     iconStyle: "lucide", permission: "manage_accounts" },
  { 
    id: "seat-map", 
    label: "Seat Map", 
    icon: Map,         
    iconStyle: "lucide",
    subItems: [
      { id: "business-center", label: "Business Center", path: "/admin/seatmap" },
      { id: "20-20-a", label: "20/20 Room A", path: "/admin/seatmap/20-20-a" },
      { id: "20-20-b", label: "20/20 Room B", path: "/admin/seatmap/20-20-b" },
      { id: "20-20-c", label: "20/20 Room C", path: "/admin/seatmap/20-20-c" },
    ]
  },
];

// ─── Hamburger Toggle Button ──────────────────────────────────────────────────
function HamburgerBtn({ onClick, isOpen }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
      style={{
        width: 36, height: 36,
        background: hovered ? "rgba(201,168,76,0.12)" : "transparent",
        border: "none", cursor: "pointer",
        display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        gap: 5, padding: 6, borderRadius: 6,
        transition: "background 0.2s", flexShrink: 0,
      }}
    >
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: "block",
          width: i === 1 && isOpen ? 12 : 18,
          height: 2, background: "#C9A84C", borderRadius: 2,
          transition: "width 0.2s",
          marginLeft: i === 1 && isOpen ? "auto" : 0,
        }} />
      ))}
    </button>
  );
}

// ─── Nav Item ─────────────────────────────────────────────────────────────────
function NavItem({ item, isActive, isOpen, onClick }) {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  const isCancelled = item.id === "cancelled";

  const activeColor  = isCancelled ? "#8C6B2A" : "#C9A84C";
  const hoverColor   = isCancelled ? "#8C6B2A" : "#C9A84C";
  const activeBg     = isCancelled ? "rgba(140,107,42,0.10)"  : "rgba(201,168,76,0.10)";
  const hoverBg      = isCancelled ? "rgba(140,107,42,0.06)"  : "rgba(201,168,76,0.05)";
  const borderColor  = isCancelled ? "#8C6B2A" : "#C9A84C";

  const handleClick = () => {
    const routes = {
      "reservations": "/admin/reservations",
      "cancelled":    "/admin/cancelled",
      "reports":      "/admin/reports",
      "accounts":     "/admin/accounts",
      "seat-map":     "/admin/seatmap",
    };
    navigate(routes[item.id] || "/admin/dashboard");
    onClick?.(item.id);
  };

  // Lucide icon renderer
  const LucideIcon = ({ icon: Icon }) => (
    <Icon 
      size={14}
      color={isActive ? activeColor : hovered ? hoverColor : "#888"}
      strokeWidth={2.5}
      style={{ flexShrink: 0, transition: "color 0.15s" }}
    />
  );

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={!isOpen ? item.label : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: isOpen ? "11px 20px" : "11px 0",
        justifyContent: isOpen ? "flex-start" : "center",
        fontFamily: F.body, fontSize: 12,
        color: isActive ? activeColor : hovered ? hoverColor : "#555",
        background: isActive ? activeBg : hovered ? hoverBg : "transparent",
        borderLeft: isActive
          ? `3px solid ${borderColor}`
          : "3px solid transparent",
        cursor: "pointer",
        fontWeight: isActive ? 700 : 400,
        transition: "all 0.15s",
        userSelect: "none",
        borderRadius: isOpen ? "0 6px 6px 0" : 0,
      }}
    >
      {item.iconStyle === "lucide"
        ? <LucideIcon icon={item.icon} />
        : <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
      }
      {isOpen && (
        <span style={{ whiteSpace: "nowrap", overflow: "hidden" }}>
          {item.label}
        </span>
      )}
    </div>
  );
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, color, isOpen }) {
  if (!isOpen) return null;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "7px 20px", fontFamily: F.body, fontSize: 11,
    }}>
      <span style={{ color: "#777" }}>{label}</span>
      <span style={{
        color, fontWeight: 700,
        background: `${color}18`,
        padding: "2px 8px", borderRadius: 10, fontSize: 11,
        minWidth: 24, textAlign: "center",
      }}>{value}</span>
    </div>
  );
}

// ─── MAIN SIDEBAR COMPONENT ───────────────────────────────────────────────────
export default function Sidebar({
  activeNav,
  onNavChange,
  pending,
  approved,
  rejected,
  cancelled,
  isOpen = true,
  onToggle = () => {},
}) {
  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || authAPI.hasPermission(item.permission));

  return (
    <aside style={{
      width: isOpen ? 220 : 52,
      height: "calc(100vh - 60px)",
      background: "#FAF6F0",
      borderRight: "1px solid rgba(201,168,76,0.18)",
      display: "flex", flexDirection: "column",
      flexShrink: 0,
      transition: "width 0.25s ease",
      overflow: "hidden",
    }}>

      {/* ── Top: logo area + hamburger ── */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: isOpen ? "space-between" : "center",
        padding: isOpen ? "20px 16px 20px 20px" : "20px 0",
        borderBottom: "1px solid rgba(201,168,76,0.12)",
        flexShrink: 0,
      }}>
        {isOpen && (
          <div style={{
            fontFamily: F.body, fontSize: 16, fontWeight: 700,
            color: "#1B2A4A", letterSpacing: 0.5, lineHeight: 1.3,
            whiteSpace: "nowrap", overflow: "hidden",
          }}>
            <span style={{
              color: "#C9A84C", fontSize: 10, fontFamily: F.body,
              letterSpacing: 2, fontWeight: 700,
            }}>ADMIN PANEL</span>
          </div>
        )}
        <HamburgerBtn isOpen={isOpen} onClick={onToggle} />
      </div>

      {/* ── Navigation ── */}
      <div style={{ paddingTop: 16, flexShrink: 0 }}>
        {isOpen && (
          <div style={{
            padding: "0 20px", marginBottom: 8,
            fontSize: 9, letterSpacing: 2, color: "#BBBBBB",
            fontFamily: F.body, fontWeight: 700, textTransform: "uppercase",
          }}>
            Navigation
          </div>
        )}
        {visibleItems.map(item => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activeNav === item.id}
            isOpen={isOpen}
            onClick={onNavChange}
          />
        ))}
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: "rgba(201,168,76,0.12)", margin: "20px 0 4px" }} />

      {/* ── Quick Stats ── */}
      {isOpen && (
        <div style={{ paddingBottom: 16 }}>
          <div style={{
            padding: "0 20px", marginBottom: 10,
            fontSize: 9, letterSpacing: 2, color: "#BBBBBB",
            fontFamily: F.body, fontWeight: 700, textTransform: "uppercase",
          }}>
            Quick Stats
          </div>
          <StatRow label="Pending"   value={pending}   color="#E8A838" isOpen={isOpen} />
          <StatRow label="Approved"  value={approved}  color="#4CAF79" isOpen={isOpen} />
          <StatRow label="Rejected"  value={rejected}  color="#8C6B2A" isOpen={isOpen} />
          <StatRow label="Cancelled" value={cancelled} color="#8C6B2A" isOpen={isOpen} />
        </div>
      )}

      {/* ── Collapsed: dot indicators for stats ── */}
      {!isOpen && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 8 }}>
          {[
            ["#E8A838", pending],
            ["#4CAF79", approved],
            ["#8C6B2A", rejected],
            ["#8C6B2A", cancelled],
          ].map(([color, val], i) => (
            val > 0 && (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%",
                background: color,
                boxShadow: `0 0 0 2px ${color}33`,
              }} />
            )
          ))}
        </div>
      )}

    </aside>
  );
}
