import { useState } from "react";
import { useNavigate } from "react-router-dom";
import bellevueLogo from "../assets/bellevue-logo.png";

function getTokens(isDark) {
  return isDark ? {
    gold: "#C9A84C",
    goldLight: "#E2C96A",
    goldFaint: "rgba(201,168,76,0.08)",
    goldBorder: "rgba(201,168,76,0.20)",
    border: "rgba(201,168,76,0.14)",
    navText: "rgba(245,239,224,0.70)",
  } : {
    gold: "#9A6E1C",
    goldLight: "#C49A2C",
    goldFaint: "rgba(154,110,28,0.07)",
    goldBorder: "rgba(154,110,28,0.18)",
    border: "rgba(154,110,28,0.12)",
    navText: "rgba(26,22,18,0.65)",
  };
}

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

function ThemeToggle({ isDark, toggle, C }) {
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 58,
        height: 34,
        borderRadius: 999,
        border: `1px solid ${C.goldBorder}`,
        background: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.28)",
        cursor: "pointer",
        padding: "0 6px",
        flexShrink: 0,
        transition: "border-color 0.25s ease, background 0.25s ease, transform 0.25s ease",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = C.goldLight;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.goldBorder;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: 46,
          height: 24,
          padding: "3px 5px",
          borderRadius: 999,
          background: isDark
            ? "linear-gradient(135deg, rgba(255,250,241,0.18), rgba(196,163,90,0.14)), rgba(10,8,6,0.24)"
            : "linear-gradient(135deg, rgba(164,120,33,0.10), rgba(255,255,255,0.62)), rgba(255,252,246,0.82)",
          boxShadow: isDark
            ? "inset 0 0 0 1px rgba(255,255,255,0.13)"
            : "inset 0 0 0 1px rgba(164,120,33,0.16)",
          overflow: "hidden",
          transition: "box-shadow 0.25s ease, background 0.25s ease",
        }}
      >
        <span style={{ width: 14, height: 14, color: isDark ? "rgba(255,250,241,0.72)" : "rgba(74,60,39,0.34)", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "color 0.25s ease" }}>
          <svg viewBox="0 0 24 24" role="presentation" style={{ width: "100%", height: "100%", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </span>
        <span style={{ width: 14, height: 14, color: isDark ? "rgba(255,250,241,0.42)" : "rgba(74,60,39,0.70)", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "color 0.25s ease" }}>
          <svg viewBox="0 0 24 24" role="presentation" style={{ width: "100%", height: "100%", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
          </svg>
        </span>
        <span
          style={{
            position: "absolute",
            top: 3,
            left: 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: isDark ? "linear-gradient(135deg, #d8bd78, #a47821)" : "linear-gradient(135deg, #fffaf1, #d8bd78)",
            color: isDark ? "#17130e" : "#8a621c",
            padding: 4,
            transform: isDark ? "translateX(0)" : "translateX(22px)",
            transition: "transform 0.32s cubic-bezier(0.22,1,0.36,1), background 0.28s ease, color 0.28s ease, box-shadow 0.28s ease",
            boxShadow: "0 3px 9px rgba(0,0,0,0.24)",
            zIndex: 2,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isDark ? (
            <svg viewBox="0 0 24 24" role="presentation" style={{ width: "100%", height: "100%", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" role="presentation" style={{ width: "100%", height: "100%", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
            </svg>
          )}
        </span>
      </span>
    </button>
  );
}

export default function SharedNavbar({ isDark, toggle, showNavigation = false, scrolled = false, height = 58, variant = "standard" }) {
  const navigate = useNavigate();
  const C = getTokens(isDark);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isGlass = variant === "reservation";
  const navHeight = isGlass ? Math.min(height, 50) : height;
  const navBg = isGlass
    ? (isDark ? "rgba(17, 13, 9, 0.38)" : "rgba(255, 252, 246, 0.46)")
    : (isDark ? "#0E0C08" : "#F2EDE0");

  const navLinkBase = {
    background: "none", border: "none", cursor: "pointer", fontFamily: FONT,
    fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
    color: C.navText, padding: 0, whiteSpace: "nowrap", transition: "color 0.2s",
  };

  return (
    <>
      <style>{`
        #bv-nav.bv-nav-standard,
        #bv-nav.bv-nav-standard::before,
        #bv-nav.bv-nav-standard::after {
          border: none !important;
          border-top: none !important;
          border-bottom: none !important;
          box-shadow: none !important;
          -webkit-box-shadow: none !important;
          outline: none !important;
          background-image: none !important;
        }
        #bv-nav.bv-nav-standard::before,
        #bv-nav.bv-nav-standard::after {
          display: none !important;
          content: none !important;
        }
        @media (max-width:640px) {
          .bv-nav-desktop { display:none !important; }
          .bv-nav-burger  { display:flex !important; }
        }
        @media (min-width:641px) {
          .bv-nav-burger  { display:none !important; }
          .bv-nav-drawer  { display:none !important; }
        }
      `}</style>

      <nav id="bv-nav" className={isGlass ? "bv-nav-glass" : "bv-nav-standard"} style={{
        position: "fixed",
        top: isGlass ? 12 : 0,
        left: isGlass ? "clamp(16px,2vw,32px)" : 0,
        right: isGlass ? "clamp(16px,2vw,32px)" : 0,
        zIndex: 9000,
        height: navHeight,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isGlass ? "0 clamp(12px,2.2vw,28px)" : "0 clamp(24px,4vw,60px)",
        background: navBg,
        border: isGlass ? `1px solid ${isDark ? "rgba(255,250,241,0.10)" : "rgba(164,120,33,0.20)"}` : "none",
        borderTop: isGlass ? undefined : "none",
        borderBottom: isGlass ? undefined : "none",
        borderLeft: isGlass ? undefined : "none",
        borderRight: isGlass ? undefined : "none",
        borderRadius: isGlass ? 18 : 0,
        boxShadow: isGlass ? "0 14px 30px rgba(18,12,7,0.08)" : "none",
        outline: "none",
        boxSizing: "border-box",
        backdropFilter: isGlass ? "blur(18px)" : undefined,
        WebkitBackdropFilter: isGlass ? "blur(18px)" : undefined,
        transition: "background 0.35s, border-color 0.35s",
      }}>
        <img src={bellevueLogo} alt="The Bellevue Manila" onClick={() => navigate("/")}
          style={{
            height: isGlass ? 23 : (height === 58 ? 28 : 32), width: "auto", cursor: "pointer", display: "block", flexShrink: 0,
            filter: isDark
              ? (isGlass || height === 58 ? "brightness(0) saturate(100%) invert(82%) sepia(18%) saturate(350%) hue-rotate(2deg)" : "none")
              : (isGlass || height === 58 ? "brightness(0) saturate(100%) invert(20%) sepia(30%) saturate(600%) hue-rotate(8deg)" : "brightness(0) saturate(100%) invert(25%) sepia(40%) saturate(500%) hue-rotate(10deg)"),
            opacity: 0.90, transition: "filter 0.35s,opacity 0.25s"
          }} />

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
          {showNavigation && (
            <div className="bv-nav-desktop" style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button type="button" style={navLinkBase} onClick={() => navigate("/venues")}
                onMouseEnter={e => e.currentTarget.style.color = C.gold}
                onMouseLeave={e => e.currentTarget.style.color = C.navText}>
                Event
              </button>
              <button type="button" style={navLinkBase}
                onClick={() => { const el = document.getElementById("home-dining"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                onMouseEnter={e => e.currentTarget.style.color = C.gold}
                onMouseLeave={e => e.currentTarget.style.color = C.navText}>
                Dining
              </button>
              <div style={{ width: 1, height: 18, background: C.border, flexShrink: 0 }} />
            </div>
          )}
          <ThemeToggle isDark={isDark} toggle={toggle} C={C} />
        </div>

        {showNavigation && (
          <button className="bv-nav-burger" type="button" onClick={() => setMobileMenuOpen(p => !p)}
            style={{ display: "none", alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "none", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", flexDirection: "column", gap: 4, padding: 0, flexShrink: 0 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ display: "block", width: 18, height: 1.5, background: C.navText, borderRadius: 2 }} />
            ))}
          </button>
        )}
      </nav>

      {showNavigation && mobileMenuOpen && (
        <div className="bv-nav-drawer" style={{ position: "fixed", top: height, left: 0, right: 0, zIndex: 8999, background: isDark ? "#1A1812" : "#FFFFFF", borderBottom: `1px solid ${C.border}`, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <button type="button" style={{ ...navLinkBase, textAlign: "left" }} onClick={() => { navigate("/venues"); setMobileMenuOpen(false); }}>Event</button>
          <button type="button" style={{ ...navLinkBase, textAlign: "left" }}
            onClick={() => { setMobileMenuOpen(false); const el = document.getElementById("home-dining"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
            Dining
          </button>
          <div style={{ height: 1, background: C.border }} />
        </div>
      )}
    </>
  );
}
