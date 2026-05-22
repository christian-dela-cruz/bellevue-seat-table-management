// src/components/admin/Sidebar.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, ClipboardList, Map, UserCog, BarChart3, LayoutDashboard, Settings, LogOut, ChevronUp, Building2 } from "lucide-react";
import { authAPI } from "../../services/authAPI";

const F = { body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };

const NAV_ITEMS = [
  { id: "reservations", label: "Reservations", icon: ClipboardList, iconStyle: "lucide" },
  { id: "cancelled",    label: "Cancelled",    icon: X,           iconStyle: "lucide" },
  { id: "outlets",      label: "Outlet Dashboard", icon: LayoutDashboard, iconStyle: "lucide", permission: "view_outlet_reports" },
  { id: "function-rooms", label: "Function Rooms", icon: Building2, iconStyle: "lucide", permission: "view_admin" },
  { id: "reports",      label: "Reports",      icon: BarChart3,   iconStyle: "lucide", permission: "view_outlet_reports" },
  {
    id: "accounts",
    label: "Account Manager",
    icon: UserCog,
    iconStyle: "lucide",
    permission: "manage_accounts",
  },
  { id: "seat-map", label: "Seat Map", icon: Map, iconStyle: "lucide" },
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
        background: hovered ? "rgba(140,107,42,0.12)" : "rgba(255,255,255,0.42)",
        border: "1px solid rgba(140,107,42,0.14)", cursor: "pointer",
        display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center",
        gap: 5, padding: 6, borderRadius: 6,
        transition: "background 0.2s, border-color 0.2s, transform 0.2s", flexShrink: 0,
        boxShadow: hovered ? "0 4px 10px rgba(55,39,17,0.035)" : "none",
        transform: hovered ? "translateY(-1px)" : "none",
      }}
    >
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          display: "block",
          width: i === 1 && isOpen ? 12 : 18,
          height: 2, background: "#8C6B2A", borderRadius: 2,
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

  const activeColor  = isCancelled ? "#7E5E25" : "#8C6B2A";
  const hoverColor   = isCancelled ? "#7E5E25" : "#8C6B2A";
  const activeBg     = isCancelled ? "rgba(140,107,42,0.13)"  : "rgba(140,107,42,0.13)";
  const hoverBg      = isCancelled ? "rgba(140,107,42,0.07)"  : "rgba(140,107,42,0.07)";
  const borderColor  = isCancelled ? "#8C6B2A" : "#C9A84C";

  const handleClick = () => {
    const routes = {
      "reservations": "/admin/reservations",
      "cancelled":    "/admin/cancelled",
      "outlets":      "/admin/outlets",
      "function-rooms": "/admin/function-rooms",
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={!isOpen ? item.label : undefined}
    >
      <div
        onClick={handleClick}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          margin: isOpen ? "3px 10px 3px 12px" : "4px 7px",
          padding: isOpen ? "10px 12px" : "10px 0",
          justifyContent: isOpen ? "flex-start" : "center",
          fontFamily: F.body, fontSize: 12.5,
          color: isActive ? activeColor : hovered ? hoverColor : "#5E5548",
          background: isActive
            ? `linear-gradient(135deg, ${activeBg}, rgba(255,255,255,0.56))`
            : hovered ? hoverBg : "transparent",
          border: `1px solid ${isActive ? "rgba(140,107,42,0.20)" : "transparent"}`,
          cursor: "pointer",
          fontWeight: isActive ? 700 : 540,
          transition: "background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
          userSelect: "none",
          borderRadius: 11,
          boxShadow: isActive ? "inset 0 0 0 1px rgba(255,255,255,0.46)" : "none",
          transform: hovered && !isActive ? "translateX(1px)" : "none",
          position: "relative",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: isOpen ? -1 : 4,
            top: "50%",
            width: 3,
            height: isActive ? 20 : 0,
            borderRadius: 999,
            background: borderColor,
            transform: "translateY(-50%)",
            transition: "height 0.18s ease",
          }}
        />
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

    </div>
  );
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, color, isOpen }) {
  if (!isOpen) return null;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 16px", fontFamily: F.body, fontSize: 11,
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
  const navigate = useNavigate();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || authAPI.hasPermission(item.permission));
  const currentUser = authAPI.getCurrentUser();
  const displayName = String(currentUser?.name || currentUser?.username || "Admin User");
  const roleLabel = String(currentUser?.role || "Administrator").replace(/_/g, " ");
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";

  useEffect(() => {
    const closeAccountMenu = (event) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeAccountMenu);
    return () => document.removeEventListener("mousedown", closeAccountMenu);
  }, []);

  const handleAccountSettings = () => {
    setAccountMenuOpen(false);
    window.dispatchEvent(new CustomEvent("bellevue:open-account-settings"));
  };

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    await authAPI.logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside style={{
      width: isOpen ? 236 : 58,
      height: "calc(100vh - 60px)",
      background: "linear-gradient(180deg, #FFFCF7 0%, #F7F0E5 54%, #EFE4D1 100%)",
      borderRight: "1px solid rgba(140,107,42,0.18)",
      display: "flex", flexDirection: "column",
      flexShrink: 0,
      transition: "width 0.25s ease",
      overflow: "hidden",
      boxShadow: "6px 0 18px rgba(55,39,17,0.035)",
      position: "relative",
      zIndex: 5,
    }}>
      <style>{`
        @keyframes sidebarAccountMenuIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* ── Top: logo area + hamburger ── */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: isOpen ? "space-between" : "center",
        padding: isOpen ? "18px 14px 18px 18px" : "18px 0",
        borderBottom: "1px solid rgba(140,107,42,0.12)",
        flexShrink: 0,
      }}>
        {isOpen && (
          <div style={{
            fontFamily: F.body, fontSize: 15, fontWeight: 800,
            color: "#18140E", letterSpacing: 0.3, lineHeight: 1.3,
            whiteSpace: "nowrap", overflow: "hidden",
          }}>
            <span style={{
              color: "#8C6B2A", fontSize: 9.5, fontFamily: F.body,
              letterSpacing: 2, fontWeight: 700,
            }}>ADMIN PANEL</span>
          </div>
        )}
        <HamburgerBtn isOpen={isOpen} onClick={onToggle} />
      </div>

      {/* ── Navigation ── */}
      <div style={{ paddingTop: 14, flexShrink: 0 }}>
        {isOpen && (
          <div style={{
            padding: "0 18px", marginBottom: 8,
            fontSize: 9, letterSpacing: 2, color: "#9B9285",
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
      <div style={{ height: 1, background: "rgba(140,107,42,0.12)", margin: "18px 14px 4px" }} />

      {/* ── Quick Stats ── */}
      {isOpen && (
        <div style={{ paddingBottom: 14 }}>
          <div style={{
            padding: "0 18px", marginBottom: 10,
            fontSize: 9, letterSpacing: 2, color: "#9B9285",
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

      <div style={{ flex: 1 }} />

      <div
        ref={accountMenuRef}
        style={{
        margin: isOpen ? "0 13px 12px" : "0 7px 12px",
        paddingTop: 10,
        borderTop: "1px solid rgba(140,107,42,0.10)",
        position: "relative",
      }}>
        {accountMenuOpen && (
          <div
            style={{
              position: "absolute",
              left: isOpen ? 0 : 48,
              right: isOpen ? 0 : "auto",
              bottom: "calc(100% + 7px)",
              width: isOpen ? "auto" : 204,
              padding: 6,
              borderRadius: 12,
              background: "rgba(255,252,247,0.96)",
              border: "1px solid rgba(140,107,42,0.14)",
              boxShadow: "0 12px 28px rgba(55,39,17,0.10)",
              zIndex: 20,
              display: "grid",
              gap: 3,
              animation: "sidebarAccountMenuIn 0.16s ease both",
            }}
          >
            <button
              type="button"
              onClick={handleAccountSettings}
              style={accountMenuButtonStyle("#5E5548")}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "rgba(140,107,42,0.08)";
                event.currentTarget.style.color = "#8C6B2A";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
                event.currentTarget.style.color = "#5E5548";
              }}
            >
              <Settings size={14} strokeWidth={2.25} />
              Account Settings
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={accountMenuButtonStyle("#A03838")}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "rgba(160,56,56,0.08)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "transparent";
              }}
            >
              <LogOut size={14} strokeWidth={2.25} />
              Logout
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setAccountMenuOpen((open) => !open)}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = "rgba(140,107,42,0.07)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = accountMenuOpen ? "rgba(140,107,42,0.09)" : "transparent";
          }}
          aria-expanded={accountMenuOpen}
          title={!isOpen ? `${displayName} account menu` : "Account menu"}
          style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: isOpen ? "flex-start" : "center",
          gap: 9,
          padding: isOpen ? "8px 7px" : "7px 0",
          borderRadius: 11,
          background: accountMenuOpen ? "rgba(140,107,42,0.09)" : "transparent",
          border: "1px solid transparent",
          boxShadow: "none",
          cursor: "pointer",
          transition: "background 0.18s ease, border-color 0.18s ease, transform 0.18s ease",
          fontFamily: F.body,
          textAlign: "left",
        }}>
          <span style={{
            width: 31,
            height: 31,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: "linear-gradient(135deg, #C9A84C, #8C6B2A)",
            color: "#fff",
            fontSize: 10.5,
            fontWeight: 850,
            letterSpacing: "0.05em",
            position: "relative",
          }}>
            {initials}
            <i aria-hidden="true" style={{ position: "absolute", right: -1, bottom: 1, width: 7, height: 7, borderRadius: "50%", background: "#4CAF79", border: "2px solid #F7F0E5" }} />
          </span>
          {isOpen && (
            <span style={{ minWidth: 0, display: "grid", gap: 2, flex: 1 }}>
              <span style={{ color: "#18140E", fontSize: 12.25, fontWeight: 670, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</span>
              <span style={{ color: "#7A7060", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{roleLabel}</span>
            </span>
          )}
          {isOpen && (
            <ChevronUp
              size={14}
              color="#8C6B2A"
              strokeWidth={2.4}
              style={{ flexShrink: 0, transition: "transform 0.18s ease", transform: accountMenuOpen ? "rotate(180deg)" : "none" }}
            />
          )}
        </button>
      </div>

    </aside>
  );
}

function accountMenuButtonStyle(color) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    padding: "8px 9px",
    border: 0,
    borderRadius: 9,
    background: "transparent",
    color,
    cursor: "pointer",
    fontFamily: F.body,
    fontSize: 12.25,
    fontWeight: 680,
    textAlign: "left",
    transition: "background 0.16s ease, color 0.16s ease",
  };
}
