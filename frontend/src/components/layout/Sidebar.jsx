// src/components/admin/Sidebar.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  ClipboardList,
  Map,
  UserCog,
  BarChart3,
  LayoutDashboard,
  Settings,
  LogOut,
  ChevronUp,
  ChevronDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
} from "lucide-react";
import { authAPI } from "../../services/authAPI";
import { useAdminTheme } from "../../context/AdminThemeContext";
import bellevueLogo from "../../assets/bellevue-logo.png";

const F = { body: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };

const NAV_GROUPS = [
  {
    id: "reservations",
    label: "Reservations",
    icon: ClipboardList,
    items: [
      { id: "reservations", label: "Reservation Queue", icon: ClipboardList, iconStyle: "lucide" },
      { id: "cancelled", label: "Cancelled Records", icon: X, iconStyle: "lucide" },
    ],
  },
  {
    id: "venue-operations",
    label: "Venue Operations",
    icon: Building2,
    items: [
      { id: "outlets", label: "Outlet Dashboard", icon: LayoutDashboard, iconStyle: "lucide", permission: "view_outlet_reports" },
      { id: "seat-map", label: "Seat Map", icon: Map, iconStyle: "lucide", permission: "manage_seat_maps" },
      { id: "function-rooms", label: "Venue Management", icon: Building2, iconStyle: "lucide", permission: "manage_venues" },
      { id: "events", label: "Event Management", icon: LayoutTemplate, iconStyle: "lucide", permission: "manage_venues" },
    ],
  },
  {
    id: "analytics",
    label: "Reports & Analytics",
    items: [
      { id: "reports", label: "Reports & Analytics", icon: BarChart3, iconStyle: "lucide", permission: "view_outlet_reports" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      { id: "accounts", label: "Account Manager", icon: UserCog, iconStyle: "lucide", permission: "manage_accounts" },
      { id: "roles", label: "Roles & Permissions", icon: Settings, iconStyle: "lucide", permission: "manage_accounts" },
    ],
  },
];

const NAV_ROUTES = {
  reservations: "/admin/reservations",
  cancelled: "/admin/cancelled",
  outlets: "/admin/outlets",
  "function-rooms": "/admin/function-rooms",
  events: "/admin/events",
  reports: "/admin/reports",
  accounts: "/admin/accounts",
  roles: "/admin/roles",
  "seat-map": "/admin/seatmap",
};

function SidebarCollapseBtn({ onClick, isOpen }) {
  const { isDark } = useAdminTheme();
  const [hovered, setHovered] = useState(false);
  const Icon = isOpen ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        style={{
          position: "absolute",
          top: 64, // Align exactly on the header divider border line
          right: -13, // Float exactly over the border (half of button width)
          transform: "translateY(-50%)",
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: isDark ? "#111009" : "#FFFFFF",
          border: isDark ? "1px solid rgba(196,163,90,0.35)" : "1px solid rgba(140,107,42,0.35)",
          padding: 0,
          boxShadow: hovered
            ? "0 4px 12px rgba(140,107,42,0.25)"
            : "0 2px 8px rgba(0,0,0,0.15)",
          cursor: "pointer",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 50,
          transition: "background 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s",
          outline: "none",
        }}
    >
      <Icon
        size={12}
        color={isDark ? "#C4A35A" : "#8C6B2A"}
        strokeWidth={2.5}
        style={{
          transition: "transform 0.2s ease",
          transform: hovered ? (isOpen ? "translateX(-1px)" : "translateX(1px)") : "none"
        }}
      />
    </button>
  );
}

function NavItem({ item, isActive, isOpen, onClick, nested = false }) {
  const { isDark } = useAdminTheme();
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();
  const activeColor = isDark ? "#D9BC7A" : "#7E5E25";
  const hoverColor = isDark ? "#C4A35A" : "#8C6B2A";
  const activeBg = isDark ? "rgba(196,163,90,0.15)" : "rgba(140,107,42,0.10)";
  const hoverBg = isDark ? "rgba(196,163,90,0.06)" : "rgba(140,107,42,0.04)";

  const handleClick = () => {
    navigate(NAV_ROUTES[item.id] || "/admin/dashboard");
    onClick?.(item.id);
  };

  const LucideIcon = ({ icon: Icon }) => (
    <span
      style={{
        width: isOpen ? 20 : 30,
        height: isOpen ? 20 : 30,
        borderRadius: 7,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        background: "transparent",
        transition: "background 0.18s ease",
      }}
    >
      <Icon
        size={nested ? 13.25 : 14}
        color={isActive ? activeColor : hovered ? hoverColor : (isDark ? "#8A8278" : "#8F8679")}
        strokeWidth={isActive ? 2.45 : 2.1}
        style={{ flexShrink: 0, transition: "color 0.15s, stroke-width 0.15s" }}
      />
    </span>
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
          display: "flex",
          alignItems: "center",
          gap: isOpen ? 9 : 0,
          margin: isOpen ? (nested ? "2px 10px 2px 24px" : "3px 10px") : "4px 7px",
          padding: isOpen ? (nested ? "7px 10px 7px 10px" : "8px 11px") : "9px 0",
          minHeight: isOpen ? (nested ? 36 : 38) : 40,
          justifyContent: isOpen ? "flex-start" : "center",
          fontFamily: F.body,
          fontSize: nested ? 12 : 12.35,
          color: isActive ? activeColor : hovered ? hoverColor : (isDark ? "#C7BEAF" : "#5E5548"),
          background: isActive
            ? activeBg
            : hovered ? hoverBg : "transparent",
          border: `1px solid ${isActive ? (isDark ? "rgba(196,163,90,0.25)" : "rgba(140,107,42,0.18)") : "transparent"}`,
          cursor: "pointer",
          fontWeight: isActive ? 680 : nested ? 490 : 540,
          transition: "background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
          userSelect: "none",
          borderRadius: 11,
          boxShadow: "none",
          transform: hovered && !isActive ? "translateX(1px)" : "none",
          position: "relative",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: isOpen ? (nested ? -9 : -1) : 4,
            top: "50%",
            width: 3,
            height: isActive ? (nested ? 18 : 22) : 0,
            borderRadius: 999,
            background: "#C9A84C",
            transform: "translateY(-50%)",
            transition: "height 0.18s ease",
          }}
        />
        {item.iconStyle === "lucide" ? (
          <LucideIcon icon={item.icon} />
        ) : (
          <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
        )}
        {isOpen && (
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.label}
          </span>
        )}
      </div>
    </div>
  );
}

function NavGroup({ group, activeNav, isOpen, onNavChange, defaultOpen }) {
  const { isDark } = useAdminTheme();
  const storageKey = `bellevue_sidebar_group_${group.id}_expanded`;
  const [expanded, setExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored === null ? defaultOpen : stored === "true";
    } catch {
      return defaultOpen;
    }
  });
  const [hovered, setHovered] = useState(false);
  const hasActiveItem = group.items.some((item) => item.id === activeNav);
  const isSingleDestination = group.items.length === 1;
  const GroupIcon = group.icon || ClipboardList;
  const activeColor = isDark ? "#D9BC7A" : "#7E5E25";
  const hoverColor = isDark ? "#C4A35A" : "#8C6B2A";
  const activeBg = isDark ? "rgba(196,163,90,0.15)" : "rgba(140,107,42,0.10)";
  const hoverBg = isDark ? "rgba(196,163,90,0.06)" : "rgba(140,107,42,0.04)";

  useEffect(() => {
    if (!hasActiveItem) return;
    setExpanded(true);
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // Group persistence is a convenience; navigation still works without storage.
    }
  }, [hasActiveItem, storageKey]);

  const toggleExpanded = () => {
    setExpanded((open) => {
      const next = !open;
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // Group persistence is a convenience; navigation still works without storage.
      }
      return next;
    });
  };

  if (isSingleDestination) {
    const item = group.items[0];
    return (
      <NavItem
        item={item}
        isActive={activeNav === item.id}
        isOpen={isOpen}
        onClick={onNavChange}
        nested={false}
      />
    );
  }

  if (!isOpen) {
    return (
      <div>
        {group.items.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activeNav === item.id}
            isOpen={isOpen}
            onClick={onNavChange}
            nested={false}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ margin: "3px 0 8px" }}>
      <button
        type="button"
        onClick={toggleExpanded}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-expanded={expanded}
        style={{
          width: "calc(100% - 20px)",
          margin: "3px 10px",
          padding: "8px 10px 8px 11px",
          minHeight: 38,
          borderRadius: 11,
          border: `1px solid ${hasActiveItem ? (isDark ? "rgba(196,163,90,0.25)" : "rgba(140,107,42,0.18)") : "transparent"}`,
          background: hasActiveItem
            ? activeBg
            : hovered ? hoverBg : "transparent",
          color: hasActiveItem ? activeColor : hovered ? hoverColor : (isDark ? "#C7BEAF" : "#5E5548"),
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 9,
          fontFamily: F.body,
          fontSize: 12.35,
          fontWeight: hasActiveItem ? 680 : 540,
          letterSpacing: 0,
          textTransform: "none",
          boxShadow: "none",
          transition: "background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
          transform: hovered && !hasActiveItem ? "translateX(1px)" : "none",
          position: "relative",
          outline: "none",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -1,
            top: "50%",
            width: 3,
            height: hasActiveItem ? 22 : 0,
            borderRadius: 999,
            background: "#C9A84C",
            transform: "translateY(-50%)",
            transition: "height 0.18s ease",
          }}
        />
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 7,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <GroupIcon
            size={14}
            color={hasActiveItem ? activeColor : hovered ? hoverColor : (isDark ? "#8A8278" : "#8F8679")}
            strokeWidth={hasActiveItem ? 2.45 : 2.1}
            style={{ flexShrink: 0, transition: "color 0.15s, stroke-width 0.15s" }}
          />
        </span>
        <span style={{ flex: 1, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {group.label}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.35}
          style={{
            flexShrink: 0,
            color: hasActiveItem ? (isDark ? "#C4A35A" : "#8C6B2A") : hovered ? (isDark ? "#C4A35A" : "#8C6B2A") : (isDark ? "#8A8278" : "#9B9285"),
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.22s cubic-bezier(.2,.8,.2,1), color 0.18s ease",
          }}
        />
      </button>

      <div
        style={{
          marginLeft: 17,
          paddingLeft: 7,
          borderLeft: expanded ? (isDark ? "1px solid rgba(196,163,90,0.18)" : "1px solid rgba(140,107,42,0.10)") : "1px solid transparent",
          display: "grid",
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transition: "grid-template-rows 0.24s cubic-bezier(.2,.8,.2,1), opacity 0.18s ease, border-color 0.18s ease",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div style={{ overflow: "hidden" }}>
          {group.items.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              isActive={activeNav === item.id}
              isOpen={isOpen}
              onClick={onNavChange}
              nested
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({
  activeNav,
  onNavChange,
  isOpen = true,
  onToggle = () => { },
}) {
  const { isDark } = useAdminTheme();
  const navigate = useNavigate();
  const [pinnedOpen, setPinnedOpen] = useState(() => {
    try {
      const stored = localStorage.getItem("bellevue_admin_sidebar_open");
      return stored === null ? Boolean(isOpen) : stored === "true";
    } catch {
      return Boolean(isOpen);
    }
  });
  const [hoverPreview, setHoverPreview] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const effectiveOpen = pinnedOpen || hoverPreview;
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || authAPI.hasPermission(item.permission)),
  })).filter((group) => group.items.length > 0);
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

  const togglePinnedOpen = () => {
    const next = !pinnedOpen;
    setPinnedOpen(next);
    if (!next) {
      setHoverPreview(false);
      setAccountMenuOpen(false);
    }
    try {
      localStorage.setItem("bellevue_admin_sidebar_open", String(next));
    } catch {
      // Persistence is a convenience; the sidebar still works without storage.
    }
    onToggle?.(next);
  };

  return (
    <aside
      onMouseEnter={() => {
        if (!pinnedOpen) setHoverPreview(true);
      }}
      onMouseLeave={() => {
        if (!pinnedOpen) {
          setHoverPreview(false);
          setAccountMenuOpen(false);
        }
      }}
      style={{
        width: effectiveOpen ? 228 : 58,
        height: "100vh",
        background: isDark ? "linear-gradient(180deg, #111009 0%, #0A0908 100%)" : "linear-gradient(180deg, #FFFCF8 0%, #F7F1E8 100%)",
        borderRight: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(140,107,42,0.12)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        transition: "width 0.26s cubic-bezier(.2,.8,.2,1)",
        overflow: "visible",
        boxShadow: isDark ? "4px 0 18px rgba(0,0,0,0.4)" : "4px 0 18px rgba(55,39,17,0.026)",
        position: "relative",
        zIndex: 3100,
      }}
    >
      <style>{`
        @keyframes sidebarAccountMenuIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .bellevue-sidebar-nav {
          scrollbar-width: thin;
          scrollbar-color: rgba(140,107,42,0.22) transparent;
        }
        .bellevue-sidebar-nav::-webkit-scrollbar {
          width: 6px;
        }
        .bellevue-sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(140,107,42,0.18);
          border-radius: 999px;
        }
      `}</style>

      {/* Floating Collapse/Expand Arrow Toggle */}
      <SidebarCollapseBtn isOpen={effectiveOpen} onClick={togglePinnedOpen} />

      <div
        style={{
          height: 64,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: effectiveOpen ? "space-between" : "center",
          padding: effectiveOpen ? "0 12px 0 18px" : "0",
          borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(140,107,42,0.09)",
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {effectiveOpen ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src={bellevueLogo}
              alt="The Bellevue Manila"
              style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontFamily: F.body,
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  color: isDark ? "#EDE8DF" : "#18140E",
                  fontSize: 14.5,
                  fontWeight: 600,
                  letterSpacing: 0.2,
                  lineHeight: 1.2,
                }}
              >
                Seat & Table
              </span>
              <span
                style={{
                  color: isDark ? "#8A8278" : "#7A7060",
                  fontSize: 11.5,
                  fontWeight: 500,
                  letterSpacing: 0.1,
                  lineHeight: 1.2,
                }}
              >
                Reservation System
              </span>
            </div>
          </div>
        ) : (
          <img
            src={bellevueLogo}
            alt="The Bellevue Manila"
            style={{ width: 32, height: 32, objectFit: "contain", flexShrink: 0 }}
          />
        )}
      </div>

      <div
        className="bellevue-sidebar-nav"
        style={{
          paddingTop: 14,
          paddingBottom: 12,
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >

        {visibleGroups.map((group) => (
          <NavGroup
            key={group.id}
            group={group}
            activeNav={activeNav}
            isOpen={effectiveOpen}
            onNavChange={onNavChange}
            defaultOpen={group.items.some((item) => item.id === activeNav)}
          />
        ))}
      </div>

      <div
        ref={accountMenuRef}
        style={{
          margin: effectiveOpen ? "0 12px 13px" : "0 7px 13px",
          paddingTop: 11,
          borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(140,107,42,0.10)",
          position: "relative",
        }}
      >
        {accountMenuOpen && (
          <div
            style={{
              position: "absolute",
              left: effectiveOpen ? 0 : 46,
              right: effectiveOpen ? 0 : "auto",
              bottom: "calc(100% + 9px)",
              width: effectiveOpen ? "auto" : 204,
              padding: 7,
              borderRadius: 14,
              background: isDark ? "rgba(22,20,16,0.98)" : "rgba(255,252,247,0.98)",
              border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(140,107,42,0.14)",
              boxShadow: isDark ? "0 16px 36px rgba(0,0,0,0.5)" : "0 16px 36px rgba(55,39,17,0.12)",
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
            event.currentTarget.style.background = "rgba(140,107,42,0.075)";
            event.currentTarget.style.borderColor = "rgba(140,107,42,0.12)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = accountMenuOpen ? "rgba(140,107,42,0.09)" : "transparent";
            event.currentTarget.style.borderColor = "transparent";
          }}
          aria-expanded={accountMenuOpen}
          title={!effectiveOpen ? `${displayName} account menu` : "Account menu"}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: effectiveOpen ? "flex-start" : "center",
            gap: 10,
            padding: effectiveOpen ? "8px 7px" : "8px 0",
            borderRadius: 13,
            background: accountMenuOpen ? "rgba(140,107,42,0.09)" : "transparent",
            border: "1px solid transparent",
            boxShadow: "none",
            cursor: "pointer",
            transition: "background 0.18s ease, border-color 0.18s ease, transform 0.18s ease",
            fontFamily: F.body,
            textAlign: "left",
            outline: "none",
          }}
        >
          <span
            style={{
              width: 33,
              height: 33,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background: "linear-gradient(135deg, #C9A84C, #8C6B2A)",
              color: "#fff",
              fontSize: 10.75,
              fontWeight: 850,
              letterSpacing: "0.05em",
              position: "relative",
            }}
          >
            {initials}
            <i
              aria-hidden="true"
              style={{
                position: "absolute",
                right: -1,
                bottom: 1,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#4CAF79",
                border: `2px solid ${isDark ? "#111009" : "#F7F0E5"}`,
              }}
            />
          </span>
          {effectiveOpen && (
            <span style={{ minWidth: 0, display: "grid", gap: 2, flex: 1 }}>
              <span style={{ color: isDark ? "#EDE8DF" : "#18140E", fontSize: 12.25, fontWeight: 670, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</span>
              <span style={{ color: isDark ? "#8A8278" : "#7A7060", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{roleLabel}</span>
            </span>
          )}
          {effectiveOpen && (
            <ChevronUp
              size={14}
              color={isDark ? "#C4A35A" : "#8C6B2A"}
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
