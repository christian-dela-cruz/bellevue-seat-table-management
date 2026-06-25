// src/features/admin/pages/UnifiedSeatMapEditor.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import Sidebar from "../../../components/layout/Sidebar";
import SeatMap from "../../../components/seatmap/SeatMap";
import { useAdminTheme, C as themeC, F as themeF } from "../../../context/AdminThemeContext";

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
    display: "'Inter','Helvetica Neue',Arial,sans-serif",
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
  const { isDark } = useAdminTheme();
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
  const venueColors = config.colors;
  const venueFonts  = FONTS[config.theme];

  // Migration script for scooping up local storage seatmaps
  useEffect(() => {
    const migrateSeatMaps = async () => {
      const migratedFlag = localStorage.getItem("seatmaps_migrated_to_db_v2");
      if (migratedFlag) return;

      const keys = Object.keys(localStorage).filter(k => k.startsWith("seatmap_layout:"));
      if (keys.length === 0) {
        localStorage.setItem("seatmaps_migrated_to_db_v2", "true");
        return;
      }

      console.log(`[SeatMap Migration] Found ${keys.length} local seatmaps. Migrating to backend...`);
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000/api' : `${window.location.protocol}//${window.location.host}/api`);
      const token = localStorage.getItem("admin_token") || localStorage.getItem("auth_token") || "";
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let successCount = 0;
      for (const key of keys) {
        try {
          const parts = key.split(":"); // ["seatmap_layout", wing, room]
          if (parts.length < 3) continue;
          const wing = parts[1];
          const room = parts.slice(2).join(":");
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          
          let data;
          try {
             data = JSON.parse(raw);
          } catch(e) { continue; }
          
          if (!data || !data.tables) continue;

          const res = await fetch(`${API_BASE_URL}/seatmap/${encodeURIComponent(wing)}/${encodeURIComponent(room)}`, {
            method: "POST",
            headers,
            body: JSON.stringify(data),
          });
          
          if (res.ok) successCount++;
        } catch (e) {
          console.error(`[SeatMap Migration] Failed to migrate ${key}`, e);
        }
      }
      
      console.log(`[SeatMap Migration] Migrated ${successCount} seatmaps successfully.`);
      localStorage.setItem("seatmaps_migrated_to_db_v2", "true");
    };

    migrateSeatMaps();
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: themeF.body, background: themeC.pageBg, color: themeC.textPrimary }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300;400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
      `}</style>

      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        activeNav="seat-map"
      />

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", minHeight: 0, flex: 1, minWidth: 0 }}>
        <AdminNavbar onLogout={handleLogout} />

        {/* Main content area */}
        <div style={{
          flex: 1,
          minWidth: 0,
          // Subtract the AdminNavbar height (60px) so the editor fills the rest
          // of the viewport without a scrollbar appearing on the outer page.
          height: "100vh",
          background: themeC.pageBg,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
          {/*
            SeatMap editor canvas.
            We pass wing + room so SeatMap initialises its internal activeWing /
            activeRoom state to the correct room on first render.  When the admin
            uses the internal WingRoomSidebar to switch rooms, SeatMap manages
            that state itself — no need for UnifiedSeatMapEditor to track it.
          */}
          <div style={{ flex: "1 1 0", minHeight: 0, overflow: "hidden" }}>
            <SeatMap
              key={`${config.wing}:${config.room}`}   /* remount on venue switch so state resets cleanly */
              editMode={true}
              wing={config.wing}
              room={config.room}
              virtualWidth={1200}
              virtualHeight={800}
              isDark={isDark}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
