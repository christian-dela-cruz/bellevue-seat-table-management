// src/features/booking/pages/ForgotCode.jsx
import { useState, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import bellevueLogo from "../../../assets/bellevue-logo.png";
import SharedNavbar from "../../../components/SharedNavbar.jsx";
import grandBallroomShowcase from "../../../assets/grand-ballroom-hires.jpg";
import diningShowcase from "../../../assets/qsina-dining-hires.jpg";
import towerShowcase from "../../../assets/tower-ballroom-hires.jpg";

const ThemeContext = createContext({ isDark: true, toggle: () => {} });
const useTheme = () => useContext(ThemeContext);

function getTokens(isDark) {
  return isDark
    ? {
        gold: "#C4A35A",
        goldLight: "#D9BC7A",
        goldDim: "#8C7240",
        goldFaint: "rgba(196,163,90,0.08)",
        goldFaintest: "rgba(196,163,90,0.04)",
        pageBg: "#0A0908",
        surfaceBase: "#111009",
        surfaceRaised: "#161410",
        surfaceInput: "rgba(255,255,255,0.04)",
        borderFaint: "rgba(255,255,255,0.04)",
        borderDefault: "rgba(255,255,255,0.08)",
        borderStrong: "rgba(255,255,255,0.12)",
        borderAccent: "rgba(196,163,90,0.30)",
        textPrimary: "#EDE8DF",
        textSecondary: "#8A8278",
        textTertiary: "rgba(237,232,223,0.32)",
        textOnAccent: "#0A0908",
        red: "#B85C5C",
        redFaint: "rgba(184,92,92,0.08)",
        redBorder: "rgba(184,92,92,0.20)",
        green: "#4A9E7E",
        greenFaint: "rgba(74,158,126,0.08)",
        greenBorder: "rgba(74,158,126,0.20)",
        badgePending:  { bg: "rgba(196,163,90,0.10)",  color: "#C4A35A",  dot: "#C4A35A"  },
        badgeApproved: { bg: "rgba(74,158,126,0.10)",  color: "#4A9E7E",  dot: "#4A9E7E"  },
        badgeRejected: { bg: "rgba(184,92,92,0.10)",   color: "#B85C5C",  dot: "#B85C5C"  },
        navBg: "rgba(10,9,8,0.95)",
        navBorder: "rgba(196,163,90,0.12)",
        divider: "rgba(255,255,255,0.05)",
        inputFocusShadow: "0 0 0 3px rgba(196,163,90,0.12)",
      }
    : {
        gold: "#8C6B2A",
        goldLight: "#A07D38",
        goldDim: "#6B5020",
        goldFaint: "rgba(140,107,42,0.07)",
        goldFaintest: "rgba(140,107,42,0.04)",
        pageBg: "#F7F4EE",
        surfaceBase: "#FFFFFF",
        surfaceRaised: "#FAF8F4",
        surfaceInput: "#FFFFFF",
        borderFaint: "rgba(0,0,0,0.04)",
        borderDefault: "rgba(0,0,0,0.08)",
        borderStrong: "rgba(0,0,0,0.13)",
        borderAccent: "rgba(140,107,42,0.28)",
        textPrimary: "#18140E",
        textSecondary: "#7A7060",
        textTertiary: "rgba(24,20,14,0.35)",
        textOnAccent: "#FFFFFF",
        red: "#A03838",
        redFaint: "rgba(160,56,56,0.07)",
        redBorder: "rgba(160,56,56,0.18)",
        green: "#2E7A5A",
        greenFaint: "rgba(46,122,90,0.07)",
        greenBorder: "rgba(46,122,90,0.18)",
        badgePending:  { bg: "rgba(140,107,42,0.09)",  color: "#8C6B2A",  dot: "#8C6B2A"  },
        badgeApproved: { bg: "rgba(46,122,90,0.09)",   color: "#2E7A5A",  dot: "#2E7A5A"  },
        badgeRejected: { bg: "rgba(160,56,56,0.09)",   color: "#A03838",  dot: "#A03838"  },
        navBg: "rgba(247,244,238,0.96)",
        navBorder: "rgba(140,107,42,0.14)",
        divider: "rgba(0,0,0,0.05)",
        inputFocusShadow: "0 0 0 3px rgba(140,107,42,0.10)",
      };
}

const F = {
  display: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  body:    "'Inter', 'Helvetica Neue', Arial, sans-serif",
  mono:    "'Inter', 'Helvetica Neue', Arial, sans-serif",
  label:   "'Inter', 'Helvetica Neue', Arial, sans-serif",
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// ─── Parsing helpers ──────────────────────────────────────────────────────────
function parseLookup(raw) {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^(.+?)(\d{2})$/);
  if (m && m[1].length > 0) return { surname: m[1], phone: m[2] };
  return null;
}

function extractList(data) {
  if (!data) return [];
  if (Array.isArray(data))              return data;
  if (Array.isArray(data.data))         return data.data;
  if (Array.isArray(data.reservations)) return data.reservations;
  if (Array.isArray(data.results))      return data.results;
  if (data.id || data.name)             return [data];
  return [];
}

function clientFilter(list, surname, phone) {
  const sLow = surname.toLowerCase();
  return list
    .filter((r) => {
      const fullName = (r.name || r.full_name || r.fullName || "").trim();
      const parts    = fullName.split(/\s+/);
      const lastWord = parts[parts.length - 1]?.toLowerCase() || "";
      const nameMatch =
        lastWord === sLow ||
        parts.some((p) => p.toLowerCase().startsWith(sLow)) ||
        fullName.toLowerCase().includes(sLow);
      const ph = String(
        r.phone || r.contact_number || r.mobile || r.phone_number || ""
      ).replace(/\D/g, "");
      const phoneMatch = ph.length >= 2 && ph.slice(-2) === phone;
      return nameMatch && phoneMatch;
    })
    .sort((a, b) => {
      const aName  = (a.name || a.full_name || a.fullName || "").trim();
      const bName  = (b.name || b.full_name || b.fullName || "").trim();
      const aParts = aName.split(/\s+/);
      const bParts = bName.split(/\s+/);
      const aLast  = aParts[aParts.length - 1]?.toLowerCase() || "";
      const bLast  = bParts[bParts.length - 1]?.toLowerCase() || "";
      const aExact = aLast === sLow;
      const bExact = bLast === sLow;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, C }) {
  const s = (status || "").toLowerCase();
  const cfg =
    s === "pending"  ? { ...C.badgePending,  label: "Awaiting Confirmation" } :
    s === "reserved" ? { ...C.badgeApproved, label: "Confirmed" } :
    s === "approved" ? { ...C.badgeApproved, label: "Confirmed" } :
    s === "rejected" ? { ...C.badgeRejected, label: "Cancelled" } :
    s === "cancelled"? { ...C.badgeRejected, label: "Cancelled" } :
    { bg: "rgba(130,130,130,0.10)", color: "#888", dot: "#888", label: status ?? "Unknown" };

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: cfg.bg, color: cfg.color,
      padding: "4px 10px 4px 8px", borderRadius: 4,
      fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
      textTransform: "uppercase", fontFamily: F.label,
      border: `1px solid ${cfg.color}24`,
      whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 4, height: 4, borderRadius: "50%",
        background: cfg.color, display: "inline-block", flexShrink: 0,
      }} />
      {cfg.label}
    </span>
  );
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  const C = getTokens(isDark);
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 12px 6px 8px",
        background: "transparent",
        border: `1px solid ${C.borderDefault}`,
        borderRadius: 20,
        cursor: "pointer", flexShrink: 0,
        transition: "all 0.22s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.borderAccent; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.borderDefault; }}
    >
      <span style={{
        position: "relative", width: 28, height: 16, borderRadius: 8,
        background: isDark ? "rgba(196,163,90,0.22)" : "rgba(0,0,0,0.08)",
        display: "inline-flex", alignItems: "center", flexShrink: 0,
        transition: "background 0.28s",
      }}>
        <span style={{
          position: "absolute",
          left: isDark ? 2 : "calc(100% - 14px)",
          width: 12, height: 12, borderRadius: "50%",
          background: isDark ? "#C4A35A" : "#8C6B2A",
          transition: "left 0.24s cubic-bezier(.4,0,.2,1)",
        }} />
      </span>
      <span style={{
        fontFamily: F.label, fontSize: 11, fontWeight: 500,
        letterSpacing: "0.03em", color: C.textSecondary,
      }}>
        {isDark ? "Dark" : "Light"}
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ForgotCode() {
  const navigate = useNavigate();

  const [isDark, setIsDark] = useState(() => {
    try {
      const s = localStorage.getItem("bellevue-theme");
      if (s !== null) return s === "dark";
    } catch {}
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  });

  const toggleTheme = () =>
    setIsDark((p) => {
      const n = !p;
      try { localStorage.setItem("bellevue-theme", n ? "dark" : "light"); } catch {}
      return n;
    });

  const C = getTokens(isDark);

  const [combination, setCombination] = useState("");
  const [searching,   setSearching]   = useState(false);
  const [error,       setError]       = useState("");
  const [results,     setResults]     = useState(null);
  const [focused,     setFocused]     = useState(false);

  // ── Date / time formatters ──────────────────────────────────────────────────
  // Parse without UTC shift: "2025-04-20" → local midnight, not UTC midnight
  const fmtDate = (d) => {
    if (!d) return "—";
    const dateStr = String(d).split("T")[0]; // strip any time portion
    const parts   = dateStr.split("-");
    if (parts.length !== 3) return d;
    const [year, month, day] = parts.map(Number);
    if (!year || !month || !day) return d;
    return new Date(year, month - 1, day).toLocaleDateString("en-PH", {
      year: "numeric", month: "long", day: "numeric",
    });
  };

  const fmtTime = (t) => {
    if (!t) return "—";
    const [h, m] = String(t).split(":");
    const hr  = parseInt(h, 10) || 0;
    const hr12 = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
    return `${hr12}:${m || "00"} ${hr < 12 ? "AM" : "PM"}`;
  };

  // ── Search handler ──────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const trimmed = combination.trim();
    if (!trimmed) {
      setError("Please enter your combination code.");
      return;
    }
    const parsed = parseLookup(trimmed);
    if (!parsed) {
      setError("Enter your surname followed by the last 2 digits of your phone number.");
      return;
    }

    const { surname, phone } = parsed;
    setError("");
    setSearching(true);
    setResults(null);

    const tryFetch = async (url) => {
      try {
        const res  = await fetch(url, { headers: { Accept: "application/json" } });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { return { ok: false }; }
        return { ok: res.ok, status: res.status, data };
      } catch {
        return { ok: false };
      }
    };
    try {
      const s1 = await tryFetch(`${API_BASE}/reservations?per_page=500&page=1`);
      if (s1.data) {
        const matched = clientFilter(extractList(s1.data), surname, phone);
        if (matched.length > 0) {
          // Dev helper — remove in production
          console.log("[ForgotCode] matched reservation object:", matched[0]);
          setResults([matched[0]]);
          return;
        }
      }

      const s2 = await tryFetch(`${API_BASE}/reservations`);
      if (s2.data) {
        const matched = clientFilter(extractList(s2.data), surname, phone);
        if (matched.length > 0) {
          console.log("[ForgotCode] matched reservation object:", matched[0]);
          setResults([matched[0]]);
          return;
        }
      }

      setError("No reservations found. Please double-check your surname and phone number.");
    } finally {
      setSearching(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <ThemeContext.Provider value={{ isDark, toggle: toggleTheme }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes spin   { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes servicePanelIn { from { opacity: 0; transform: translateY(18px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes serviceVisualIn { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: translateX(0); } }
        .guest-service-shell {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(380px, 42%) minmax(0, 58%);
          padding-top: 64px;
        }
        .guest-service-left {
          position: relative;
          min-height: calc(100vh - 64px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(34px, 5vw, 72px) clamp(24px, 5vw, 84px);
        }
        .guest-service-back {
          position: absolute;
          top: clamp(18px, 3vh, 34px);
          left: clamp(20px, 4vw, 52px);
        }
        .guest-service-visual {
          min-height: calc(100vh - 64px);
          display: flex;
          align-items: stretch;
          padding: clamp(22px, 3vw, 42px) clamp(22px, 4vw, 60px) clamp(22px, 3vw, 42px) 0;
        }
        .guest-service-visual__frame {
          position: relative;
          flex: 1;
          overflow: hidden;
          border-radius: 28px;
          background-size: cover;
          background-position: center;
          min-height: 520px;
          box-shadow: 0 34px 88px rgba(0,0,0,0.30), inset 0 0 0 1px rgba(255,250,241,0.12);
          animation: serviceVisualIn 0.58s cubic-bezier(0.22,1,0.36,1) both;
        }
        .guest-service-visual__frame::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(10,9,8,0.62), rgba(10,9,8,0.12) 52%, rgba(10,9,8,0.48)),
            radial-gradient(circle at 24% 20%, rgba(196,163,90,0.22), transparent 34%);
        }
        .guest-service-visual__content {
          position: absolute;
          left: clamp(24px, 4vw, 56px);
          right: clamp(24px, 4vw, 56px);
          bottom: clamp(24px, 4vw, 56px);
          color: #fffaf1;
          max-width: 440px;
        }
        .guest-service-visual__eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
          color: #d8bd78;
          font-family: ${F.label};
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .guest-service-visual__eyebrow::before {
          content: "";
          width: 28px;
          height: 1px;
          background: #d8bd78;
          opacity: 0.72;
        }
        .guest-service-visual__title {
          margin: 0 0 12px;
          font-family: ${F.display};
          font-size: clamp(34px, 4vw, 58px);
          font-weight: 500;
          line-height: 0.96;
        }
        .guest-service-visual__copy {
          margin: 0;
          color: rgba(255,250,241,0.74);
          font-size: 14px;
          line-height: 1.72;
          max-width: 370px;
        }
        .guest-service-visual__tile {
          position: absolute;
          width: clamp(126px, 15vw, 210px);
          aspect-ratio: 1.38 / 1;
          border-radius: 18px;
          background-size: cover;
          background-position: center;
          box-shadow: 0 20px 46px rgba(0,0,0,0.26), inset 0 0 0 1px rgba(255,250,241,0.14);
          overflow: hidden;
        }
        .guest-service-visual__tile::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.34));
        }
        .guest-service-visual__tile--one {
          top: clamp(22px, 5vw, 70px);
          right: clamp(20px, 4vw, 54px);
        }
        .guest-service-visual__tile--two {
          top: clamp(150px, 20vw, 260px);
          right: clamp(84px, 11vw, 178px);
          width: clamp(110px, 13vw, 178px);
        }
        @media (max-width: 1080px) {
          .guest-service-shell {
            grid-template-columns: minmax(360px, 46%) minmax(0, 54%);
          }
          .guest-service-visual {
            padding-right: clamp(18px, 3vw, 34px);
          }
          .guest-service-visual__frame {
            min-height: 460px;
          }
          .guest-service-visual__tile--two {
            display: none;
          }
        }
        @media (max-width: 860px) {
          .guest-service-shell {
            display: flex;
            flex-direction: column;
          }
          .guest-service-visual {
            order: 1;
            min-height: 300px;
            padding: 20px 20px 0;
          }
          .guest-service-visual__frame {
            min-height: 300px;
            border-radius: 22px;
          }
          .guest-service-left {
            order: 2;
            min-height: auto;
            padding: 26px 20px 44px;
          }
          .guest-service-back {
            top: 18px;
            left: 20px;
          }
          .guest-service-visual__tile {
            display: none;
          }
        }
        @media (max-width: 560px) {
          .guest-service-visual {
            min-height: 220px;
            padding: 14px 14px 0;
          }
          .guest-service-visual__frame {
            min-height: 220px;
            border-radius: 18px;
          }
          .guest-service-visual__title {
            font-size: 34px;
          }
          .guest-service-visual__copy {
            display: none;
          }
        }
      `}</style>

      <div style={{
        minHeight: "100vh", fontFamily: F.body,
        background: C.pageBg,
        position: "relative",
        transition: "background 0.30s",
      }}>

        {/* Background image */}
        <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "url('/src/assets/bg-login.jpeg')",
            backgroundSize: "cover", backgroundPosition: "center",
            filter: isDark
              ? "blur(3.5px) brightness(0.58) saturate(1.05)"
              : "blur(3.5px) brightness(0.82) saturate(0.82)",
            transform: "scale(1.025)",
            transition: "filter 0.40s, transform 0.40s",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: isDark
              ? "radial-gradient(circle at 50% 42%, rgba(196,163,90,0.10), transparent 34%), linear-gradient(135deg, rgba(10,9,8,0.78), rgba(10,9,8,0.56))"
              : "radial-gradient(circle at 50% 42%, rgba(196,163,90,0.12), transparent 36%), linear-gradient(135deg, rgba(250,246,238,0.78), rgba(242,234,219,0.62))",
            transition: "background 0.40s",
          }} />
        </div>

        {/* Navbar */}
        <SharedNavbar
          isDark={isDark}
          toggle={toggleTheme}
          showNavigation={false}
          scrolled={false}
          height={64}
        />

        {/* Page body */}
        <div className="guest-service-shell">
          <div className="guest-service-left">

            {/* Back button */}
            <div className="guest-service-back">
              <button
                onClick={() => navigate("/manage-booking")}
                title="Go back"
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: isDark ? "rgba(17,16,9,0.58)" : "rgba(255,255,255,0.58)",
                  border: `1px solid ${C.borderDefault}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", transition: "all 0.18s", padding: 0,
                  backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                  boxShadow: isDark ? "0 12px 28px rgba(0,0,0,0.22)" : "0 12px 28px rgba(78,60,32,0.12)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = C.borderAccent;
                  e.currentTarget.style.background  = C.goldFaint;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.borderDefault;
                  e.currentTarget.style.background  = isDark ? "rgba(17,16,9,0.58)" : "rgba(255,255,255,0.58)";
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-chevron-left-icon lucide-chevron-left"
                  style={{ color: C.textSecondary }}
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
            </div>

            {/* ── Card ── */}
            <div style={{
              width: "100%",
              maxWidth: results ? 520 : 462,
              padding: results ? 0 : "clamp(24px,3vw,34px)",
              borderRadius: results ? 0 : 24,
              background: results ? "transparent" : (isDark
                ? "linear-gradient(145deg, rgba(255,250,241,0.075), rgba(255,250,241,0.025)), rgba(17,16,9,0.70)"
                : "linear-gradient(145deg, rgba(255,255,255,0.88), rgba(255,250,241,0.66)), rgba(255,255,255,0.62)"),
              border: results ? "none" : `1px solid ${isDark ? "rgba(255,250,241,0.13)" : "rgba(140,107,42,0.17)"}`,
              boxShadow: results ? "none" : (isDark
                ? "0 28px 70px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)"
                : "0 28px 70px rgba(78,60,32,0.16), inset 0 1px 0 rgba(255,255,255,0.72)"),
              backdropFilter: results ? undefined : "blur(18px) saturate(1.08)",
              WebkitBackdropFilter: results ? undefined : "blur(18px) saturate(1.08)",
              animation: "servicePanelIn 0.48s cubic-bezier(0.22,1,0.36,1) both",
            }}>

              {/* Header — hidden once results appear */}
              {!results && (
                <div style={{ marginBottom: 28, animation: "fadeUp 0.32s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ display: "inline-block", width: 24, height: "1px", background: C.gold, opacity: 0.6 }} />
                    <span style={{
                      fontFamily: F.label, fontSize: 9, letterSpacing: "0.26em",
                      color: C.gold, fontWeight: 700, textTransform: "uppercase",
                    }}>
                      Guest Services
                    </span>
                  </div>
                  <h1 style={{
                    fontFamily: F.display, fontSize: "clamp(30px,5vw,44px)", fontWeight: 400,
                    color: C.textPrimary, lineHeight: 1.12, margin: "0 0 12px",
                    letterSpacing: "0.01em",
                  }}>
                    Recover Your<br />Reference Code
                  </h1>
                  <p style={{
                    fontFamily: F.body, fontSize: 13.5, color: C.textSecondary,
                    margin: 0, lineHeight: 1.72,
                  }}>
                    Enter your combination code to locate your booking reference.
                  </p>
                </div>
              )}

              {/* ── Search form ── */}
              {!results && (
                <div style={{ animation: "fadeUp 0.36s ease" }}>

                  {/* How-it-works hint */}
                  <div style={{
                    padding: "12px 14px", borderRadius: 12, marginBottom: 20,
                    background: isDark ? "rgba(196,163,90,0.075)" : "rgba(140,107,42,0.065)", border: `1px solid ${C.borderAccent}`,
                    display: "flex", gap: 12, alignItems: "flex-start",
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: C.goldFaintest, border: `1px solid ${C.borderAccent}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke={C.gold} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8"  x2="12"   y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <div>
                      <div style={{
                        fontFamily: F.label, fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.10em", textTransform: "uppercase",
                        color: C.gold, marginBottom: 3,
                      }}>
                        How it works
                      </div>
                      <div style={{
                        fontFamily: F.body, fontSize: 12,
                        color: C.textSecondary, lineHeight: 1.65,
                      }}>
                        Combine your surname with the last 2 digits of your phone number.
                      </div>
                    </div>
                  </div>

                  {/* Input */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{
                      display: "flex", alignItems: "center", gap: 6,
                      fontFamily: F.label, fontSize: 9, letterSpacing: "0.22em",
                      color: focused ? C.gold : C.textSecondary,
                      fontWeight: 700, textTransform: "uppercase", marginBottom: 8,
                      transition: "color 0.18s",
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Combination Code{" "}
                      <span style={{ color: C.red, marginLeft: 2 }}>*</span>
                    </label>
                    <input
                      value={combination}
                      onChange={(e) => { setCombination(e.target.value); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      placeholder="e.g. abane35"
                      autoComplete="off"
                      style={{
                        width: "100%", boxSizing: "border-box",
                        padding: "14px 18px",
                        border: `1px solid ${focused ? C.borderAccent : C.borderDefault}`,
                        borderRadius: 12,
                        background: isDark ? "rgba(255,250,241,0.055)" : "rgba(255,255,255,0.76)",
                        fontFamily: F.mono, fontSize: 17, fontWeight: 500,
                        letterSpacing: "0.06em", color: C.textPrimary,
                        outline: "none",
                        transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s",
                        boxShadow: focused ? `${C.inputFocusShadow}, inset 0 1px 0 rgba(255,255,255,0.04)` : "inset 0 1px 0 rgba(255,255,255,0.035)",
                        colorScheme: isDark ? "dark" : "light",
                      }}
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div style={{
                      padding: "10px 14px", borderRadius: 8, marginBottom: 14,
                      background: C.redFaint, borderLeft: `3px solid ${C.red}`,
                      fontSize: 12.5, color: C.red, lineHeight: 1.60,
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8"  x2="12"    y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {error}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleSearch}
                    disabled={searching}
                    style={{
                      width: "100%", padding: "14px",
                      background: searching
                        ? (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)")
                        : `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`,
                      border: `1px solid ${searching ? C.borderDefault : "transparent"}`,
                      borderRadius: 12,
                      fontFamily: F.label, fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.18em", textTransform: "uppercase",
                      color: searching ? C.textSecondary : C.textOnAccent,
                      cursor: searching ? "not-allowed" : "pointer",
                      transition: "all 0.20s",
                      display: "flex", alignItems: "center",
                      justifyContent: "center", gap: 10,
                      marginBottom: 0,
                      boxShadow: searching ? "none" : "0 14px 26px rgba(140,107,42,0.22)",
                    }}
                    onMouseEnter={(e) => { if (!searching) e.currentTarget.style.background = C.goldLight; }}
                    onMouseLeave={(e) => { if (!searching) e.currentTarget.style.background = `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`; }}
                  >
                    {searching ? (
                      <>
                        <span style={{
                          display: "inline-block", width: 13, height: 13,
                          border: `1.5px solid ${C.textSecondary}40`,
                          borderTopColor: C.textSecondary,
                          borderRadius: "50%",
                          animation: "spin 0.65s linear infinite",
                        }} />
                        Searching…
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        Find My Code
                      </>
                    )}
                  </button>

                  {/* Footer link */}
                  <div style={{
                    marginTop: 24, paddingTop: 22,
                    borderTop: `1px solid ${C.divider}`,
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between",
                  }}>
                    <span style={{ fontFamily: F.body, fontSize: 12.5, color: C.textSecondary }}>
                      Remember your code?
                    </span>
                    <button
                      onClick={() => navigate("/manage-booking")}
                      style={{
                        background: "none", border: "none",
                        fontFamily: F.label, fontSize: 11, fontWeight: 700,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        color: C.gold, cursor: "pointer", padding: 0,
                        display: "flex", alignItems: "center", gap: 4,
                      }}
                    >
                      Manage Booking
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* ── Results ── */}
              {results && (
                <div style={{ animation: "fadeUp 0.28s ease" }}>

                  {/* Result header */}
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: C.greenFaint, border: `1px solid ${C.greenBorder}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                          stroke={C.green} strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <span style={{
                        fontFamily: F.label, fontSize: 20, letterSpacing: "0.01em",
                        color: C.green, fontWeight: 700,
                      }}>
                        Booking Located
                      </span>
                    </div>
                    <p style={{ fontFamily: F.body, fontSize: 12.5, color: C.textSecondary, margin: 0 }}>
                      {results.length === 1
                        ? "Found 1 reservation matching your details."
                        : `Found ${results.length} reservations matching your details.`
                      }
                    </p>
                  </div>

                  {/* Result cards */}
                  {results.map((r, idx) => {
                    // ── Defensive field resolution ────────────────────────────
                    // Covers both camelCase and snake_case API responses
                    const refCode    = r.reference_code  || r.referenceCode  || r.id       || "—";
                    const guestName  = r.name            || r.full_name      || r.fullName  || "—";
                    // Try venue relationship first, then fallback to direct fields
                    const venueName  = r.room            || r.venue?.name    || r.venue_name || r.location || "No room assigned";
                    const eventDate  = r.event_date      || r.eventDate      || r.date      || null;
                    const eventTime  = r.event_time      || r.eventTime      || r.time      || null;
                    const guestCount = r.guests_count    ?? r.guests         ?? r.pax       ?? null;
                    const tableNum   = r.table_number    || r.table          || null;
                    const seatNum    = r.seat_number     || r.seat           || null;
                    const tableSeat  = [tableNum, seatNum].filter(Boolean).join(" / ") || "—";

                    return (
                      <div
                        key={r.id || idx}
                        style={{
                          background: C.surfaceBase,
                          borderRadius: 14,
                          border: `1px solid ${C.borderDefault}`,
                          overflow: "hidden",
                          marginBottom: 14,
                        }}
                      >
                        {/* Gold accent bar */}
                        <div style={{
                          height: "2px",
                          background: `linear-gradient(90deg, transparent 0%, ${C.gold}80 30%, ${C.gold}80 70%, transparent 100%)`,
                        }} />

                        <div style={{ padding: "20px 22px" }}>

                          {/* Reference code + status */}
                          <div style={{
                            display: "flex", alignItems: "flex-start",
                            justifyContent: "space-between", gap: 16, marginBottom: 18,
                          }}>
                            <div>
                              <div style={{
                                fontFamily: F.label, fontSize: 9, letterSpacing: "0.20em",
                                color: C.gold, fontWeight: 700,
                                textTransform: "uppercase", marginBottom: 6,
                              }}>
                                Reference Code
                              </div>
                              <div style={{
                                fontFamily: F.mono, fontSize: 28, fontWeight: 500,
                                color: C.textPrimary, letterSpacing: "0.06em", lineHeight: 1,
                              }}>
                                {refCode}
                              </div>
                            </div>
                            <StatusBadge status={r.status} C={C} />
                          </div>

                          <div style={{ height: "1px", background: C.divider, marginBottom: 16 }} />

                          {/* Guest name + venue */}
                          <div style={{ marginBottom: 16 }}>
                            <div style={{
                              fontSize: 15, fontWeight: 600,
                              color: C.textPrimary, marginBottom: 3,
                              fontFamily: F.body,
                            }}>
                              {guestName}
                            </div>
                            <div style={{ fontSize: 12.5, color: C.textSecondary, fontFamily: F.body }}>
                              {venueName}
                            </div>
                          </div>

                          {/* Detail grid */}
                          <div style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "12px 20px",
                          }}>
                            {[
                              ["Date",         fmtDate(eventDate)],
                              ["Time",         fmtTime(eventTime)],
                              ["Guests",       guestCount !== null ? `${guestCount} pax` : "—"],
                              ["Table / Seat", tableSeat],
                            ].map(([label, val]) => (
                              <div key={label}>
                                <div style={{
                                  fontFamily: F.label, fontSize: 9, letterSpacing: "0.14em",
                                  textTransform: "uppercase", color: C.textTertiary,
                                  fontWeight: 700, marginBottom: 3,
                                }}>
                                  {label}
                                </div>
                                <div style={{
                                  fontFamily: F.body, fontSize: 12.5,
                                  color: C.textPrimary, lineHeight: 1.5,
                                }}>
                                  {val}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                    <button
                      onClick={() => { setResults(null); setCombination(""); setError(""); }}
                      style={{
                        flex: 1, padding: "11px 16px",
                        background: "transparent",
                        border: `1px solid ${C.borderDefault}`,
                        borderRadius: 8,
                        fontFamily: F.label, fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.10em", textTransform: "uppercase",
                        color: C.textSecondary, cursor: "pointer", transition: "all 0.18s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = C.borderAccent;
                        e.currentTarget.style.color       = C.gold;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = C.borderDefault;
                        e.currentTarget.style.color       = C.textSecondary;
                      }}
                    >
                      Search Again
                    </button>
                    <button
                      onClick={() => navigate("/manage-booking")}
                      style={{
                        flex: 1, padding: "11px 16px",
                        background: C.gold, border: "none",
                        borderRadius: 8,
                        fontFamily: F.label, fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.10em", textTransform: "uppercase",
                        color: C.textOnAccent, cursor: "pointer", transition: "all 0.18s",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", gap: 8,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.goldLight; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = C.gold; }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      Manage Booking
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <aside className="guest-service-visual" aria-hidden="true">
            <div
              className="guest-service-visual__frame"
              style={{ backgroundImage: `url(${grandBallroomShowcase})` }}
            >
              <div
                className="guest-service-visual__tile guest-service-visual__tile--one"
                style={{ backgroundImage: `url(${diningShowcase})` }}
              />
              <div
                className="guest-service-visual__tile guest-service-visual__tile--two"
                style={{ backgroundImage: `url(${towerShowcase})` }}
              />
              <div className="guest-service-visual__content">
                <div className="guest-service-visual__eyebrow">The Bellevue Manila</div>
                <h2 className="guest-service-visual__title">Reference Recovery</h2>
                <p className="guest-service-visual__copy">
                  A refined guest-service path for finding your reservation details with less friction.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
