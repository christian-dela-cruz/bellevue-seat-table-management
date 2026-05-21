// src/features/admin/pages/UnifiedSeatMapEditor.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import Sidebar from "../../../components/layout/Sidebar";
import SeatMap from "../../../components/seatmap/SeatMap";

/**
 * Venue configurations keyed by URL slug.
 *
 * NOTE: "business-center" is intentionally listed first — it is the default
 * venue for this editor page.  The wing/room values MUST match the constants
 * used in BusinessCenterReserve.jsx (WING = "Main Wing", ROOM = "Business Center")
 * AND in SeatMap's getActualWingForRoom mapping so all three files resolve to
 * the same localStorage key:
 *   seatmap_layout:Main Wing:Business Center
 */
const VENUE_CONFIGS = {
  "business-center": {
    wing:  "Main Wing",
    room:  "Business Center",
    title: "Business Center",
    theme: "light",
    colors: {
      gold:          "#8C6B2A",
      goldFaint:     "rgba(140,107,42,0.08)",
      pageBg:        "#F7F4EE",
      surfaceBase:   "#FFFFFF",
      borderDefault: "rgba(0,0,0,0.08)",
      borderAccent:  "rgba(140,107,42,0.28)",
      textPrimary:   "#18140E",
      textSecondary: "#7A7060",
      textTertiary:  "rgba(24,20,14,0.35)",
      navBg:         "rgba(247,244,238,0.98)",
      navBorder:     "rgba(140,107,42,0.14)",
      divider:       "rgba(0,0,0,0.06)",
      canvasBg:      "#EDEAE2",
      canvasBorder:  "rgba(140,107,42,0.18)",
    },
  },
  "20-20-a": {
    wing:  "Main Wing",
    room:  "20/20 Function Room A",
    title: "20/20 Function Room A",
    theme: "dark",
    colors: {
      gold: "#C4A35A", goldLight: "#D9BC7A", goldDim: "#8C7240",
      goldFaint: "rgba(196,163,90,0.08)", goldFaintest: "rgba(196,163,90,0.04)",
      pageBg: "#0A0908", surfaceBase: "#111009", surfaceRaised: "#161410",
      surfaceInput: "rgba(255,255,255,0.04)",
      borderFaint: "rgba(255,255,255,0.04)", borderDefault: "rgba(255,255,255,0.08)",
      borderStrong: "rgba(255,255,255,0.12)", borderAccent: "rgba(196,163,90,0.30)",
      textPrimary: "#EDE8DF", textSecondary: "#8A8278",
      textTertiary: "rgba(237,232,223,0.32)", textOnAccent: "#0A0908",
      red: "#B85C5C", redFaint: "rgba(184,92,92,0.08)", redBorder: "rgba(184,92,92,0.20)",
      green: "#4A9E7E", greenFaint: "rgba(74,158,126,0.08)", greenBorder: "rgba(74,158,126,0.20)",
    },
  },
  "20-20-b": {
    wing:  "Main Wing",
    room:  "20/20 Function Room B",
    title: "20/20 Function Room B",
    theme: "dark",
    colors: {
      gold: "#C4A35A", goldLight: "#D9BC7A", goldDim: "#8C7240",
      goldFaint: "rgba(196,163,90,0.08)", goldFaintest: "rgba(196,163,90,0.04)",
      pageBg: "#0A0908", surfaceBase: "#111009", surfaceRaised: "#161410",
      surfaceInput: "rgba(255,255,255,0.04)",
      borderFaint: "rgba(255,255,255,0.04)", borderDefault: "rgba(255,255,255,0.08)",
      borderStrong: "rgba(255,255,255,0.12)", borderAccent: "rgba(196,163,90,0.30)",
      textPrimary: "#EDE8DF", textSecondary: "#8A8278",
      textTertiary: "rgba(237,232,223,0.32)", textOnAccent: "#0A0908",
      red: "#B85C5C", redFaint: "rgba(184,92,92,0.08)", redBorder: "rgba(184,92,92,0.20)",
      green: "#4A9E7E", greenFaint: "rgba(74,158,126,0.08)", greenBorder: "rgba(74,158,126,0.20)",
    },
  },
  "20-20-c": {
    wing:  "Main Wing",
    room:  "20/20 Function Room C",
    title: "20/20 Function Room C",
    theme: "dark",
    colors: {
      gold: "#C4A35A", goldLight: "#D9BC7A", goldDim: "#8C7240",
      goldFaint: "rgba(196,163,90,0.08)", goldFaintest: "rgba(196,163,90,0.04)",
      pageBg: "#0A0908", surfaceBase: "#111009", surfaceRaised: "#161410",
      surfaceInput: "rgba(255,255,255,0.04)",
      borderFaint: "rgba(255,255,255,0.04)", borderDefault: "rgba(255,255,255,0.08)",
      borderStrong: "rgba(255,255,255,0.12)", borderAccent: "rgba(196,163,90,0.30)",
      textPrimary: "#EDE8DF", textSecondary: "#8A8278",
      textTertiary: "rgba(237,232,223,0.32)", textOnAccent: "#0A0908",
      red: "#B85C5C", redFaint: "rgba(184,92,92,0.08)", redBorder: "rgba(184,92,92,0.20)",
      green: "#4A9E7E", greenFaint: "rgba(74,158,126,0.08)", greenBorder: "rgba(74,158,126,0.20)",
    },
  },
};

const FONTS = {
  light: {
    body:    "'DM Sans', sans-serif",
    heading: "'Cormorant Garamond', Georgia, serif",
    label:   "'DM Sans', sans-serif",
  },
  dark: {
    display: "'Playfair Display','Times New Roman',serif",
    body:    "'Inter','Helvetica Neue',Arial,sans-serif",
    label:   "'Inter','Helvetica Neue',Arial,sans-serif",
  },
};

/**
 * Derives a venueType slug from the current URL path.
 * Falls back to "business-center" when no slug matches — so navigating
 * directly to /admin/seat-map (without a suffix) opens Business Center.
 */
function getVenueTypeFromPath(pathname) {
  if (pathname.includes("20-20A") || pathname.includes("20-20-a")) return "20-20-a";
  if (pathname.includes("20-20B") || pathname.includes("20-20-b")) return "20-20-b";
  if (pathname.includes("20-20C") || pathname.includes("20-20-c")) return "20-20-c";
  // Explicit Business Center slug — also the fallback for unrecognised paths
  return "business-center";
}

export default function UnifiedSeatMapEditor() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate  = useNavigate();
  const location  = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin');
  };

  // Derive venue type reactively from the URL so deep-links work correctly.
  const venueType = getVenueTypeFromPath(location.pathname);
  const config    = VENUE_CONFIGS[venueType] ?? VENUE_CONFIGS["business-center"];
  const C         = config.colors;
  const F         = FONTS[config.theme];

  return (
    <div style={{ height: "100vh", overflow: "hidden", fontFamily: F.body, background: C.pageBg, color: C.textPrimary }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
      `}</style>

      <AdminNavbar onLogout={handleLogout} />

      <div style={{ display: "flex", height: "calc(100vh - 60px)", minHeight: 0 }}>
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          activeNav="seat-map"
        />

        {/* Main content area */}
        <div style={{
          flex: 1,
          minWidth: 0,
          // Subtract the AdminNavbar height (60px) so the editor fills the rest
          // of the viewport without a scrollbar appearing on the outer page.
          height: "calc(100vh - 60px)",
          background: C.pageBg,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>

          {/* Top bar */}
          <div style={{
            flexShrink: 0,
            position: "sticky",
            top: 0,
            zIndex: 100,
            background: config.theme === "dark" ? C.surfaceBase : C.navBg,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: `1px solid ${config.theme === "dark" ? C.borderDefault : C.navBorder}`,
            height: 66,
            display: "flex",
            alignItems: "center",
            padding: "0 28px",
            justifyContent: "space-between",
            gap: 18,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ display: "inline-block", width: 20, height: 1, background: C.gold, opacity: 0.55 }} />
                <span style={{
                  fontFamily: F.label || F.body,
                  fontSize: 9,
                  letterSpacing: "0.20em",
                  color: C.gold,
                  fontWeight: 800,
                  textTransform: "uppercase",
                }}>
                  Seat Map Editor
                </span>
              </div>
              <div style={{
                fontFamily: F.heading || F.display || F.body,
                fontSize: config.theme === "dark" ? 18 : 19,
                fontWeight: 700,
                color: C.textPrimary,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {config.title}
              </div>
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              borderRadius: 999,
              border: `1px solid ${config.theme === "dark" ? C.borderDefault : C.borderAccent}`,
              background: config.theme === "dark" ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.58)",
              color: C.textSecondary,
              fontFamily: F.label || F.body,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold, boxShadow: `0 0 0 3px ${C.goldFaint || "rgba(140,107,42,0.10)"}` }} />
              Layout Workspace
            </div>
            {/* Breadcrumb */}
            <span style={{
              display: "none",
              fontFamily: F.label || F.body,
              fontSize: 9,
              letterSpacing: "0.20em",
              color: C.gold,
              fontWeight: 700,
              textTransform: "uppercase",
            }}>
              Seat Map Editor
            </span>
            <span style={{ display: "none", color: C.textTertiary, fontSize: 11 }}>·</span>
            <span style={{
              display: "none",
              fontFamily: F.label || F.body,
              fontSize: 9,
              letterSpacing: "0.14em",
              color: C.textSecondary,
              fontWeight: 600,
              textTransform: "uppercase",
            }}>
              {config.title}
            </span>

          </div>

          {/*
            SeatMap editor canvas.
            We pass wing + room so SeatMap initialises its internal activeWing /
            activeRoom state to the correct room on first render.  When the admin
            uses the internal WingRoomSidebar to switch rooms, SeatMap manages
            that state itself — no need for UnifiedSeatMapEditor to track it.

            height is: full viewport - AdminNavbar (60px) - top bar (66px).
          */}
          <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
            <SeatMap
              key={`${config.wing}:${config.room}`}   /* remount on venue switch so state resets cleanly */
              editMode={true}
              wing={config.wing}
              room={config.room}
              virtualWidth={1200}
              virtualHeight={800}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
