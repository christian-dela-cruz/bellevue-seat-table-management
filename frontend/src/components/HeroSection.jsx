import { useState } from "react";
import mainWingImg  from "../assets/main-wing.jpeg";
import towerWingImg from "../assets/tower-wing.jpeg";

const DISPLAY = `'Inter', 'Helvetica Neue', Arial, sans-serif`;
const BODY    = `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;
const MONO    = `'JetBrains Mono', monospace`;

const HERO_CSS = `
  @keyframes hero-fade-up {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes hero-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes hero-line-grow {
    from { transform: scaleX(0); transform-origin: left; }
    to   { transform: scaleX(1); transform-origin: left; }
  }
  @keyframes wing-slide-in {
    from { opacity: 0; transform: translateX(28px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes scroll-bounce {
    0%, 100% { transform: translateY(0); opacity: 0.4; }
    50%       { transform: translateY(4px); opacity: 0.9; }
  }
  @keyframes counter-count {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .hero-btn-primary {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 13px 28px;
    background: #1A1510; border: 2px solid #1A1510; color: #F0E8D0;
    font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase;
    cursor: pointer; border-radius: 3px; white-space: nowrap;
    transition: background 0.3s, color 0.3s, border-color 0.3s, transform 0.2s;
  }
  .hero-btn-primary:hover {
    background: transparent; border-color: #1A1510; color: #1A1510;
    transform: translateY(-2px);
  }
  .hero-btn-primary.dark { background: #F0E8D0; border-color: #F0E8D0; color: #18140E; }
  .hero-btn-primary.dark:hover { background: transparent; border-color: #F0E8D0; color: #F0E8D0; }

  .hero-btn-ghost {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 0; background: none; border: none;
    font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase;
    cursor: pointer; color: #6A5830; transition: color 0.2s, gap 0.2s;
  }
  .hero-btn-ghost:hover { color: #1A1510; gap: 12px; }
  .hero-btn-ghost.dark  { color: rgba(240,232,208,0.55); }
  .hero-btn-ghost.dark:hover { color: #F0E8D0; }

  .wing-card {
    position: relative; overflow: hidden; cursor: pointer; flex: 1;
    transition: flex 0.5s cubic-bezier(0.4,0,0.2,1);
  }
  .wing-card:hover { flex: 1.12; }
  .wing-card img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    transition: transform 0.55s cubic-bezier(0.4,0,0.2,1);
  }
  .wing-card:hover img { transform: scale(1.06); }

  @media (max-width: 860px) {
    .hero-split { flex-direction: column !important; height: auto !important; }
    .hero-left  { width: 100% !important; height: auto !important; padding: 40px 24px 32px !important; }
    .hero-right {
      width: 100% !important; height: 42vw !important;
      min-height: 220px !important; max-height: 340px !important;
      flex-direction: row !important;
    }
    .hero-stat-bar { display: none !important; }
    .hero-scroll-indicator { display: none !important; }
  }
`;

const ChevRight = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

function WingCard({ img, num, name, sub, delay, isDark, onClick }) {
  const gold = isDark ? "#C9A84C" : "#9A6E1C";
  return (
    <div className="wing-card" onClick={onClick}
      style={{ animation: `wing-slide-in 0.85s cubic-bezier(0.4,0,0.2,1) ${delay}s both` }}>
      <img src={img} alt={name} />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, rgba(10,9,6,0.90) 0%, rgba(10,9,6,0.22) 42%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, top: 0, width: 3, background: gold, opacity: 0.85 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 18px 18px 20px" }}>
        <div style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 400,
          letterSpacing: "0.28em", textTransform: "uppercase",
          color: gold, marginBottom: 4, opacity: 0.9,
        }}>WING {num}</div>
        <div style={{
          fontFamily: DISPLAY, fontSize: 17, fontWeight: 600,
          color: "#F0E8D0", lineHeight: 1.1, letterSpacing: "-0.01em",
        }}>{name}</div>
        <div style={{
          fontFamily: BODY, fontSize: 10, fontWeight: 400,
          letterSpacing: "0.08em", color: "rgba(240,232,208,0.50)", marginTop: 3,
        }}>{sub}</div>
      </div>
    </div>
  );
}

function Stat({ value, label, delay, isDark }) {
  const text  = isDark ? "#F0E8D0" : "#1A1510";
  const muted = isDark ? "rgba(240,232,208,0.40)" : "rgba(26,21,16,0.40)";
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      animation: `counter-count 0.7s ease ${delay}s both`,
    }}>
      <span style={{
        fontFamily: DISPLAY, fontSize: "clamp(20px,2.6vw,32px)",
        fontWeight: 600, color: text, lineHeight: 1, letterSpacing: "-0.02em",
      }}>{value}</span>
      <span style={{
        fontFamily: BODY, fontSize: 9, fontWeight: 700,
        letterSpacing: "0.22em", textTransform: "uppercase", color: muted, marginTop: 4,
      }}>{label}</span>
    </div>
  );
}

export default function HeroSection({ loaded, onNavigateToVenues, onManageBooking, isDark = false }) {
  const gold        = isDark ? "#C9A84C" : "#9A6E1C";
  const pageBg      = isDark ? "#0E0D09" : "#EDE5D0";
  const textPrimary = isDark ? "#F0E8D0" : "#1A1510";
  const textMuted   = isDark ? "rgba(240,232,208,0.52)" : "rgba(26,21,16,0.52)";
  const borderColor = isDark ? "rgba(201,168,76,0.18)" : "rgba(154,110,28,0.18)";
  const statBg      = isDark ? "rgba(240,232,208,0.04)" : "rgba(26,21,16,0.05)";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HERO_CSS }} />

      <div className="hero-split" style={{
        display: "flex",
        height: "calc(100vh - 64px)",   /* ← exact viewport fit, no overflow */
        maxHeight: 900,
        minHeight: 480,
        background: pageBg,
        transition: "background 0.35s",
        overflow: "hidden",
      }}>

        {/* ── LEFT ── */}
        <div className="hero-left" style={{
          width: "53%",
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "clamp(28px,4.5vw,64px) clamp(24px,5vw,68px) clamp(28px,4.5vw,56px)",
          position: "relative", boxSizing: "border-box", overflow: "hidden",
        }}>

          {/* EST label */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            marginBottom: "clamp(12px,1.8vw,22px)",
            animation: "hero-fade-up 0.7s ease 0.1s both",
          }}>
            <div style={{ width: 28, height: 1, background: gold, animation: "hero-line-grow 0.6s ease 0.3s both" }} />
            <span style={{
              fontFamily: BODY, fontSize: 9, fontWeight: 700,
              letterSpacing: "0.38em", textTransform: "uppercase", color: gold,
            }}>EST. ALABANG, MANILA</span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: DISPLAY,
            fontSize: "clamp(32px,4.4vw,64px)",
            fontWeight: 700, lineHeight: 1.0, letterSpacing: "-0.025em",
            color: textPrimary,
            margin: "0 0 clamp(10px,1.8vw,20px)",
            animation: "hero-fade-up 0.85s cubic-bezier(0.4,0,0.2,1) 0.18s both",
          }}>
            Reserve<br />
            <em style={{ color: gold, fontStyle: "italic" }}>Your Perfect</em><br />
            Setting.
          </h1>

          {/* Subtext */}
          <p style={{
            fontFamily: BODY, fontSize: "clamp(11px,1vw,13px)",
            color: textMuted, lineHeight: 1.8, maxWidth: 340,
            margin: "0 0 clamp(18px,2.5vw,32px)",
            animation: "hero-fade-up 0.85s ease 0.30s both",
          }}>
            Two wings of premium event spaces and dining —<br />
            from intimate boardrooms to grand ballrooms.
          </p>

          {/* CTAs */}
          <div style={{
            display: "flex", alignItems: "center",
            gap: "clamp(12px,2vw,22px)", flexWrap: "wrap",
            animation: "hero-fade-up 0.8s ease 0.42s both",
          }}>
            <button className={`hero-btn-primary${isDark ? " dark" : ""}`} onClick={onNavigateToVenues}>
              Browse Venues
            </button>
            <button className={`hero-btn-ghost${isDark ? " dark" : ""}`} onClick={onManageBooking}>
              Manage Booking <ChevRight size={11} />
            </button>
          </div>

          {/* Stats */}
          <div className="hero-stat-bar" style={{
            display: "flex", alignItems: "center",
            marginTop: "clamp(20px,3vw,40px)",
            background: statBg,
            border: `1px solid ${borderColor}`,
            borderRadius: 4,
            padding: "clamp(10px,1.4vw,14px) clamp(14px,2.2vw,26px)",
            width: "fit-content",
            animation: "hero-fade-up 0.8s ease 0.55s both",
          }}>
            <Stat value="2" label="Wings"       delay={0.65} isDark={isDark} />
            <div style={{ width: 1, height: 28, background: borderColor, margin: "0 clamp(14px,2.2vw,26px)" }} />
            <Stat value="9" label="Venues"      delay={0.72} isDark={isDark} />
            <div style={{ width: 1, height: 28, background: borderColor, margin: "0 clamp(14px,2.2vw,26px)" }} />
            <Stat value="3" label="Restaurants" delay={0.79} isDark={isDark} />
          </div>

          {/* Scroll indicator */}
          <div className="hero-scroll-indicator" style={{
            position: "absolute", left: "clamp(12px,1.8vw,24px)", bottom: 20,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            animation: "hero-fade-in 1s ease 1.1s both",
          }}>
            <span style={{
              fontFamily: BODY, fontSize: 8, fontWeight: 700,
              letterSpacing: "0.38em", textTransform: "uppercase",
              color: textMuted, writingMode: "vertical-rl",
            }}>Scroll</span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke={gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: "scroll-bounce 2s ease-in-out infinite" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>

        {/* ── RIGHT — WING CARDS ── */}
        <div className="hero-right" style={{
          width: "47%",
          display: "flex", flexDirection: "column",
          gap: 3, overflow: "hidden",
        }}>
          <WingCard
            img={mainWingImg} num="01" name="Main Wing" sub="Corporate & Social Events"
            delay={0.35} isDark={isDark}
            onClick={() => onNavigateToVenues("main-wing")}
          />
          <WingCard
            img={towerWingImg} num="02" name="Tower Wing" sub="Grand Galas & Celebrations"
            delay={0.50} isDark={isDark}
            onClick={() => onNavigateToVenues("tower-wing")}
          />
        </div>

      </div>
    </>
  );
}