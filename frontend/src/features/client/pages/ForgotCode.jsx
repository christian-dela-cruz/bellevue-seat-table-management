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

  // Email recovery tab state
  const [activeTab,    setActiveTab]    = useState("combo");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [emailSending,  setEmailSending]  = useState(false);
  const [emailSent,     setEmailSent]     = useState(false);
  const [emailFocused,  setEmailFocused]  = useState(false);

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

  // ── Email recovery handler ──────────────────────────────────────────────────
  const handleEmailRecovery = async () => {
    const trimmed = recoveryEmail.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setEmailSending(true);
    setEmailSent(false);
    try {
      const res = await fetch(`${API_BASE}/reservations/recover-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Something went wrong. Please try again.");
      } else {
        setEmailSent(true);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setEmailSending(false);
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
        
        button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible {
          outline: 2px solid #C4A35A;
          outline-offset: 2px;
        }
        @media (max-width: 500px) {
          .action-buttons { flex-direction: column !important; gap: 10px !important; }
          .action-buttons > button { width: 100% !important; padding: 14px 16px !important; }
        }
      `}</style>

      <div style={{
        minHeight: "100vh", fontFamily: F.body,
        background: C.pageBg,
        position: "relative",
        transition: "background 0.30s",
      }}>

        {/* Background */}
        <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden" }}>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${towerShowcase})`,
            backgroundSize: "cover", backgroundPosition: "center",
            filter: isDark
              ? "blur(3px) brightness(0.40) saturate(1.15)"
              : "blur(3px) brightness(0.95) saturate(0.85)",
            transform: "scale(1.025)",
            transition: "filter 0.40s, transform 0.40s",
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: isDark
              ? "linear-gradient(135deg, rgba(17,16,9,0.88), rgba(17,16,9,0.70))"
              : "linear-gradient(135deg, rgba(250,246,238,0.88), rgba(242,234,219,0.70))",
            transition: "background 0.40s",
          }} />
        </div>

        {/* Navigation Controls */}
        <div style={{
          position: "fixed", top: "24px", left: "24px", right: "24px",
          display: "flex", justifyContent: "space-between", zIndex: 100,
          pointerEvents: "none",
        }}>
          <button
            onClick={() => navigate("/manage-booking")}
            title="Go back"
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: isDark ? "rgba(17,16,9,0.58)" : "rgba(255,255,255,0.58)",
              border: `1px solid ${C.borderDefault}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)", padding: 0,
              backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
              color: C.textSecondary,
              boxShadow: isDark ? "0 4px 12px rgba(0,0,0,0.15)" : "0 4px 12px rgba(78,60,32,0.06)",
              pointerEvents: "auto",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.background = C.goldFaint; e.currentTarget.style.color = C.gold; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = isDark ? "rgba(17,16,9,0.58)" : "rgba(255,255,255,0.58)"; e.currentTarget.style.color = C.textSecondary; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>

          <button
            onClick={toggleTheme}
            title="Toggle theme"
            style={{
              width: 44, height: 44, borderRadius: "50%",
              background: isDark ? "rgba(17,16,9,0.58)" : "rgba(255,255,255,0.58)",
              border: `1px solid ${C.borderDefault}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)", padding: 0,
              backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
              color: C.textSecondary,
              boxShadow: isDark ? "0 4px 12px rgba(0,0,0,0.15)" : "0 4px 12px rgba(78,60,32,0.06)",
              pointerEvents: "auto",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.background = C.goldFaint; e.currentTarget.style.color = C.gold; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = isDark ? "rgba(17,16,9,0.58)" : "rgba(255,255,255,0.58)"; e.currentTarget.style.color = C.textSecondary; }}
          >
            {isDark ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
        </div>

        {/* Page body */}
        <div style={{
          position: "relative",
          zIndex: 10,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "96px 24px 48px",
          boxSizing: "border-box",
        }}>
          <div style={{
            width: "100%",
            maxWidth: results ? 540 : 462,
            padding: results ? 0 : "clamp(24px,3vw,34px)",
            borderRadius: results ? 0 : 24,
            background: results ? "transparent" : (isDark
              ? "linear-gradient(145deg, rgba(255,250,241,0.075), rgba(255,250,241,0.025)), rgba(17,16,9,0.70)"
              : "linear-gradient(145deg, rgba(255,255,255,0.88), rgba(255,250,241,0.66)), rgba(255,255,255,0.62)"),
            border: results ? "none" : `1px solid ${isDark ? "rgba(255,250,241,0.13)" : "rgba(140,107,42,0.17)"}`,
            boxShadow: results ? "none" : (isDark
              ? "0 16px 40px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)"
              : "0 16px 40px rgba(78,60,32,0.08), inset 0 1px 0 rgba(255,255,255,0.72)"),
            backdropFilter: results ? undefined : "blur(18px) saturate(1.08)",
            WebkitBackdropFilter: results ? undefined : "blur(18px) saturate(1.08)",
            animation: "servicePanelIn 0.48s cubic-bezier(0.22,1,0.36,1) both",
          }}>

            {/* Header — hidden once results appear */}
            {!results && !emailSent && (
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
                  fontFamily: F.display, fontSize: 32, fontWeight: 400,
                  color: C.textPrimary, lineHeight: 1.2, margin: "0 0 12px",
                  letterSpacing: "0.01em",
                }}>
                  Recover Your Reference Code
                </h1>
                <p style={{
                  fontFamily: F.body, fontSize: 13.5, color: C.textSecondary,
                  margin: "0 0 22px", lineHeight: 1.72,
                }}>
                  {activeTab === "combo"
                    ? "Enter your combination code to locate your booking reference."
                    : "We'll send your reference code(s) to your email address."}
                </p>

                {/* ── Tab Switcher ── */}
                <div style={{
                  display: "flex", gap: 0,
                  background: isDark ? "rgba(255,250,241,0.04)" : "rgba(0,0,0,0.03)",
                  borderRadius: 10, padding: 3,
                  border: `1px solid ${C.borderDefault}`,
                }}>
                  {[
                    { key: "combo", label: "Combination Code", icon: (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )},
                    { key: "email", label: "Email Recovery", icon: (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    )},
                  ].map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() => { setActiveTab(key); setError(""); setResults(null); setEmailSent(false); }}
                      style={{
                        flex: 1, padding: "9px 14px",
                        background: activeTab === key
                          ? (isDark ? "rgba(196,163,90,0.15)" : "rgba(255,255,255,0.92)")
                          : "transparent",
                        border: activeTab === key
                          ? `1px solid ${C.borderAccent}`
                          : "1px solid transparent",
                        borderRadius: 8,
                        fontFamily: F.label, fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                        color: activeTab === key ? C.gold : C.textSecondary,
                        cursor: "pointer", transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                        boxShadow: activeTab === key
                          ? (isDark ? "0 2px 8px rgba(0,0,0,0.18)" : "0 2px 8px rgba(78,60,32,0.10)")
                          : "none",
                      }}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Combination code search form ── */}
            {!results && !emailSent && activeTab === "combo" && (
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
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
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

            {/* ── Email recovery form ── */}
            {!results && !emailSent && activeTab === "email" && (
              <div style={{ animation: "fadeUp 0.36s ease" }}>

                {/* Email input */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontFamily: F.label, fontSize: 9, letterSpacing: "0.22em",
                    color: emailFocused ? C.gold : C.textSecondary,
                    fontWeight: 700, textTransform: "uppercase", marginBottom: 8,
                    transition: "color 0.18s",
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    Email Address{" "}
                    <span style={{ color: C.red, marginLeft: 2 }}>*</span>
                  </label>
                  <input
                    value={recoveryEmail}
                    onChange={(e) => { setRecoveryEmail(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleEmailRecovery()}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    placeholder="e.g. juan@email.com"
                    type="email"
                    autoComplete="email"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      padding: "14px 18px",
                      border: `1px solid ${emailFocused ? C.borderAccent : C.borderDefault}`,
                      borderRadius: 12,
                      background: isDark ? "rgba(255,250,241,0.055)" : "rgba(255,255,255,0.76)",
                      fontFamily: F.body, fontSize: 15, fontWeight: 500,
                      color: C.textPrimary,
                      outline: "none",
                      transition: "border-color 0.18s, box-shadow 0.18s, background 0.18s",
                      boxShadow: emailFocused ? `${C.inputFocusShadow}, inset 0 1px 0 rgba(255,255,255,0.04)` : "inset 0 1px 0 rgba(255,255,255,0.035)",
                      colorScheme: isDark ? "dark" : "light",
                    }}
                  />
                </div>

                {/* Info hint */}
                <div style={{
                  padding: "10px 14px", borderRadius: 10, marginBottom: 14,
                  background: isDark ? "rgba(196,163,90,0.06)" : "rgba(140,107,42,0.05)",
                  border: `1px solid ${C.borderAccent}`,
                  display: "flex", gap: 10, alignItems: "flex-start",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  <span style={{ fontFamily: F.body, fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}>
                    We'll send all your active reservation reference codes to this email. Check your inbox (and spam folder) after submitting.
                  </span>
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

                {/* Submit button */}
                <button
                  onClick={handleEmailRecovery}
                  disabled={emailSending}
                  style={{
                    width: "100%", padding: "14px",
                    background: emailSending
                      ? (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)")
                      : `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`,
                    border: `1px solid ${emailSending ? C.borderDefault : "transparent"}`,
                    borderRadius: 12,
                    fontFamily: F.label, fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.18em", textTransform: "uppercase",
                    color: emailSending ? C.textSecondary : C.textOnAccent,
                    cursor: emailSending ? "not-allowed" : "pointer",
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 10,
                    boxShadow: emailSending ? "none" : "0 14px 26px rgba(140,107,42,0.22)",
                  }}
                  onMouseEnter={(e) => { if (!emailSending) e.currentTarget.style.background = C.goldLight; }}
                  onMouseLeave={(e) => { if (!emailSending) e.currentTarget.style.background = `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`; }}
                >
                  {emailSending ? (
                    <>
                      <span style={{
                        display: "inline-block", width: 13, height: 13,
                        border: `1.5px solid ${C.textSecondary}40`,
                        borderTopColor: C.textSecondary,
                        borderRadius: "50%",
                        animation: "spin 0.65s linear infinite",
                      }} />
                      Sending…
                    </>
                  ) : (
                    <>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                      Send to My Email
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

            {/* ── Email sent success ── */}
            {emailSent && (
              <div style={{ animation: "fadeUp 0.32s ease" }}>
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: C.greenFaint, border: `1px solid ${C.greenBorder}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.26em", color: C.green, fontWeight: 700, textTransform: "uppercase" }}>
                      Guest Services
                    </span>
                  </div>
                  <h1 style={{ fontFamily: F.display, fontSize: 32, fontWeight: 400, color: C.textPrimary, lineHeight: 1.2, margin: "0 0 12px", letterSpacing: "0.01em" }}>
                    Check Your Inbox
                  </h1>
                  <p style={{ fontFamily: F.body, fontSize: 13.5, color: C.textSecondary, margin: 0, lineHeight: 1.72 }}>
                    If a reservation exists with <strong style={{ color: C.textPrimary }}>{recoveryEmail}</strong>, we've sent your reference code(s) to your inbox. Please also check your spam/junk folder.
                  </p>
                </div>

                <div className="action-buttons" style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => { setEmailSent(false); setRecoveryEmail(""); setError(""); }}
                    style={{
                      flex: 1, padding: "11px 16px",
                      background: "transparent",
                      border: `1px solid ${C.borderDefault}`,
                      borderRadius: 8,
                      fontFamily: F.label, fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.10em", textTransform: "uppercase",
                      color: C.textSecondary, cursor: "pointer", transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
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
                    Try Again
                  </button>
                  <button
                    onClick={() => navigate("/manage-booking")}
                    style={{
                      flex: 1, padding: "11px 16px",
                      background: C.gold, border: "none",
                      borderRadius: 8,
                      fontFamily: F.label, fontSize: 10, fontWeight: 700,
                      letterSpacing: "0.10em", textTransform: "uppercase",
                      color: C.textOnAccent, cursor: "pointer", transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
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
                  const refCode    = r.reference_code  || r.referenceCode  || r.id       || "—";
                  const guestName  = r.name            || r.full_name      || r.fullName  || "—";
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
                      color: C.textSecondary, cursor: "pointer", transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
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
                      color: C.textOnAccent, cursor: "pointer", transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
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
      </div>
    </ThemeContext.Provider>
  );
}

