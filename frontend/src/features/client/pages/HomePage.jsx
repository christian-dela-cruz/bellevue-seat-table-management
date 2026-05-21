// src/features/client/pages/HomePage.jsx
import { useState, useEffect, useRef, createContext, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import mainWingImg     from "../../../assets/main-wing.jpeg";
import towerWingImg    from "../../../assets/tower-wing.jpeg";
import SharedNavbar    from "../../../components/SharedNavbar.jsx";
import qsinaImg        from "../../../assets/qsina.jpeg";
import qsinaImg2       from "../../../assets/qsina2.jpeg";
import qsinaImg3       from "../../../assets/qsina3.jpeg";
import hanakazuImg     from "../../../assets/hanakazu.jpeg";
import hanakazuImg2    from "../../../assets/hanakazu2.jpeg";
import hanakazuImg3    from "../../../assets/hanakazu3.jpeg";
import phoenixCourtImg from "../../../assets/phoenix-court.jpeg";
import bellevueLogo    from "../../../assets/bellevue-logo.png";
import Loader          from "../../../components/Loader.jsx";

// ── CHEVRONS ──────────────────────────────────────────────────────────────────
const ChevRight = ({ size = 14, color = "currentColor", strokeWidth = 2.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ display: "block", flexShrink: 0 }}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const ChevLeft = ({ size = 14, color = "currentColor", strokeWidth = 2.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ display: "block", flexShrink: 0 }}>
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

// ── THEME CONTEXT ─────────────────────────────────────────────────────────────
const ThemeContext = createContext({ isDark: true, toggle: () => {} });
const useTheme = () => useContext(ThemeContext);

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
function getTokens(isDark) {
  return isDark ? {
    gold:        "#C9A84C",
    goldLight:   "#E2C96A",
    goldFaint:   "rgba(201,168,76,0.10)",
    pageBg:      "#0E0D09",
    cream:       "#F0E8D0",
    dark:        "#18140E",
    darkMid:     "#1E1B13",
    textPrimary: "#F0E8D0",
    textMuted:   "#7A6E58",
    textFaint:   "#4A4438",
    textDeep:    "#3A3428",
    border:      "rgba(201,168,76,0.18)",
    borderLight: "rgba(201,168,76,0.10)",
    nlBg:        "#1E1B13",
    footerBg:    "#0E0D09",
    diningBg:    "#111009",
    footerLink:  "#4A4438",
    heroSub:     "rgba(240,232,208,0.50)",
    heroBg:      "#18140E",
  } : {
    gold:        "#9A6E1C",
    goldLight:   "#C49A2C",
    goldFaint:   "rgba(154,110,28,0.08)",
    pageBg:      "#EDE5D0",
    cream:       "#1A1510",
    dark:        "#1A1510",
    darkMid:     "#E4DAC4",
    textPrimary: "#1A1510",
    textMuted:   "#6A5830",
    textFaint:   "#8A7A60",
    textDeep:    "#9A8A70",
    border:      "rgba(154,110,28,0.18)",
    borderLight: "rgba(154,110,28,0.12)",
    nlBg:        "#E4DAC4",
    footerBg:    "#EDE5D0",
    diningBg:    "#E8DEC8",
    footerLink:  "#6A5830",
    heroSub:     "rgba(26,21,16,0.52)",
    heroBg:      "#EDE5D0",
  };
}

const DISPLAY = `'Playfair Display', 'Times New Roman', serif`;
const BODY    = `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;
const MONO    = `'JetBrains Mono', monospace`;
const NAV_H   = 64;

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@300;400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  button { outline: none; }
  html { scroll-behavior: smooth; }

  @keyframes partners-scroll { from { transform:translateX(0); } to { transform:translateX(-50%); } }

  .grain::after {
    content: ""; position: absolute; inset: 0; pointer-events: none;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    opacity: 0.5; mix-blend-mode: overlay;
  }

  /* ── DINING BUTTON ── */
  .dining-reserve-btn {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 14px 32px;
    background: #C9A84C; border: 2px solid #C9A84C; color: #18140E;
    font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase;
    cursor: pointer; border-radius: 4px; position: relative; overflow: hidden;
    transition: background .32s, color .32s, border-color .32s, box-shadow .32s, transform .22s;
  }
  .dining-reserve-btn:hover {
    background: transparent; border-color: #C9A84C; color: #C9A84C;
    box-shadow: 0 0 0 3px rgba(201,168,76,0.15); transform: translateY(-2px);
  }
  .dining-reserve-btn-light { background: #9A6E1C; border-color: #9A6E1C; color: #F4EFE4; }
  .dining-reserve-btn-light:hover { background: transparent; border-color: #9A6E1C; color: #9A6E1C; }

  /* ── WING CARDS ── */
  .wing-card {
    position: relative; overflow: hidden; cursor: pointer;
    transition: box-shadow .45s;
  }
  .wing-card .wing-img {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover;
    transition: transform 1.1s cubic-bezier(.2,.8,.2,1), filter .6s;
    filter: brightness(0.65) saturate(1.05);
  }
  .wing-card:hover .wing-img { transform: scale(1.06); filter: brightness(0.50) saturate(1.15); }
  .wing-card .wing-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(10,9,6,0.04) 0%, rgba(10,9,6,0.82) 100%);
    transition: background .5s;
  }
  .wing-card:hover .wing-overlay { background: linear-gradient(180deg, rgba(10,9,6,0.10) 0%, rgba(10,9,6,0.92) 100%); }
  .wing-card .wing-content {
    position: absolute; left: 0; right: 0; bottom: 0;
    padding: 24px 24px 22px;
    display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
    color: #F0E8D0;
  }
  /* Chevron — always visible */
  .wing-card .wing-chev {
    width: 42px; height: 42px; border-radius: 50%;
    border: 1.5px solid rgba(240,232,208,0.55);
    display: flex; align-items: center; justify-content: center;
    background: rgba(10,9,6,0.42);
    flex-shrink: 0; color: #F0E8D0;
    opacity: 1;
    transition: background .3s, border-color .3s, color .3s, transform .3s;
  }
  .wing-card:hover .wing-chev { background: #C9A84C; border-color: #C9A84C; color: #18140E; transform: scale(1.08); }
  .wing-card .wing-title {
    font-family: 'Playfair Display', serif;
    font-size: clamp(20px, 2.2vw, 34px);
    font-weight: 600; letter-spacing: -0.01em;
    transition: color .3s ease;
  }
  .wing-card:hover .wing-title { color: #C9A84C; }
  .wing-card .wing-tag {
    font-family: 'Inter', sans-serif; font-size: 9px; font-weight: 700;
    letter-spacing: .30em; text-transform: uppercase; color: #C9A84C;
    margin-bottom: 7px; display: inline-block;
  }
  .wing-card .wing-desc {
    font-family: 'Inter', sans-serif; font-size: 11px; line-height: 1.65;
    color: rgba(240,232,208,0.60); margin-top: 5px;
  }

  /* ── HERO BUTTONS ── */
  .hero-cta {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 13px 24px; border-radius: 3px;
    font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700;
    letter-spacing: .20em; text-transform: uppercase;
    cursor: pointer; transition: all .26s cubic-bezier(.4,0,.2,1);
    border: 1.5px solid transparent;
    opacity: 1 !important;
    white-space: nowrap;
  }
  /* Light mode primary */
  .hero-cta-solid-light { background: #1A1510; color: #F0E8D0; border-color: #1A1510; }
  .hero-cta-solid-light:hover { background: #C9A84C; color: #fff; border-color: #C9A84C; transform: translateY(-2px); }
  /* Dark mode primary */
  .hero-cta-solid-dark { background: #F0E8D0; color: #18140E; border-color: #F0E8D0; }
  .hero-cta-solid-dark:hover { background: #C9A84C; color: #fff; border-color: #C9A84C; transform: translateY(-2px); }
  /* Outline only (no bg) */
  .hero-cta-outline-light { background: transparent; color: #1A1510; border-color: transparent; }
  .hero-cta-outline-light:hover { background: #C9A84C; color: #fff; border-color: #C9A84C; transform: translateY(-2px); }
  .hero-cta-outline-dark { background: transparent; color: #F0E8D0; border-color: transparent; }
  .hero-cta-outline-dark:hover { background: #C9A84C; color: #fff; border-color: #C9A84C; transform: translateY(-2px); }

  /* Ghost / quiet */
  .hero-cta-quiet { background: transparent; border-color: transparent; padding: 13px 4px; outline: none; }
  .hero-cta-quiet:hover { color: #C9A84C !important; transform: translateX(3px); }
  .hero-cta:focus, .hero-cta:focus-visible { outline: none; box-shadow: none; }

  .hero-stat { transition: transform .28s ease; cursor: default; }
  .hero-stat:hover { transform: translateY(-2px); }

  .full-section { min-height: calc(100vh - ${NAV_H}px); display: flex; flex-direction: column; justify-content: center; position: relative; }

  @media (max-width: 767px) {
    * { -webkit-tap-highlight-color: transparent; }
    body { overflow-x: hidden; }
    .full-section { min-height: auto; padding-top: 32px; padding-bottom: 32px; }
  }
`;

// ── DATA ──────────────────────────────────────────────────────────────────────
const RESTAURANTS = [
  { id:"qsina", name:"Qsina", tag:"All-Day Dining",
    description:"Qsina offers diverse culinary delights with both international buffets and à la carte options. From lavish breakfast spreads to intimate candlelit dinner experiences.",
    imgs:[qsinaImg,qsinaImg2,qsinaImg3],
    diningTimes:[{label:"Breakfast Buffet",hours:"6:00 – 10:00 AM"},{label:"Lunch",hours:"MON · TUE · SAT · SUN"},{label:"Light Lunch",hours:"WED · FRI"},{label:"Dinner",hours:"MON · THURS"},{label:"Dinner Buffet",hours:null}],
  },
  { id:"hanakazu", name:"Hanakazu", tag:"Japanese Specialty",
    description:"Hanakazu brings authentic Japanese cuisine to The Bellevue Manila. Savor fresh sushi, sashimi, and teppanyaki in an elegant zen-inspired setting.",
    imgs:[hanakazuImg,hanakazuImg2,hanakazuImg3],
    diningTimes:[{label:"Lunch",hours:"11:30 AM – 2:30 PM"},{label:"Dinner",hours:"6:00 PM – 10:00 PM"},{label:"Omakase",hours:"By reservation"}],
  },
  { id:"phoenix-court", name:"Phoenix Court", tag:"Cantonese Fine Dining",
    description:"Phoenix Court presents refined Cantonese cuisine — masterful dim sum, Peking duck, and classic dishes elevated to perfection in a sophisticated atmosphere.",
    imgs:[phoenixCourtImg,qsinaImg2,qsinaImg3],
    diningTimes:[{label:"Dim Sum",hours:"5:00 AM – 11:29 PM"},{label:"Lunch",hours:"11:30 AM – 2:30 PM"},{label:"Dinner",hours:"6:00 PM – 10:00 PM"}],
  },
];

const PARTNERS = ["Johnny's Steak & Grill at Cellar XXII","Pastry Corner","Vue Bar","Azurea Spa","Jing Monis Salon","Pretty Looks"];

// ── HOOKS ─────────────────────────────────────────────────────────────────────
function useIsMobile(bp = 768) {
  const [m, setM] = useState(() => typeof window !== "undefined" ? window.innerWidth < bp : false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp-1}px)`);
    const h = (e) => setM(e.matches);
    mq.addEventListener("change", h); setM(mq.matches);
    return () => mq.removeEventListener("change", h);
  }, [bp]);
  return m;
}

async function loadGsap() {
  if (!window.gsap) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  if (!window.ScrollTrigger) {
    await new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js";
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    window.gsap.registerPlugin(window.ScrollTrigger);
  }
}

function useGsapScroll(options = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const run = async () => {
      await loadGsap();
      if (!ref.current) return;
      const { y=48, opacity=0, duration=0.9, ease="power3.out", delay=0, stagger=0, selector=null, scrub=false, start="top 85%" } = options;
      const targets = selector ? ref.current.querySelectorAll(selector) : [ref.current];
      window.gsap.fromTo(targets,
        { y, opacity },
        { y:0, opacity:1, duration, ease, delay, stagger,
          scrollTrigger:{ trigger:ref.current, start, scrub, once: !scrub }
        }
      );
    };
    run().catch(console.error);
  }, []);
  return ref;
}

// ── NAV DOT ───────────────────────────────────────────────────────────────────
function NavDot({ disabled, icon, C, onClick }) {
  const [hov, setHov] = useState(false);
  const active = !disabled;
  return (
    <button
      type="button" disabled={disabled} onClick={onClick}
      onMouseEnter={() => { if (active) setHov(true); }}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 42, height: 42, borderRadius: "50%",
        border: hov && active ? "none" : `1.5px solid ${active ? C.gold : "rgba(201,168,76,0.22)"}`,
        background: hov && active ? C.gold : "transparent",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.28 : 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.22s cubic-bezier(0.4,0,0.2,1)",
        flexShrink: 0, outline: "none", boxShadow: "none",
      }}
    >
      {icon === "left"
        ? <ChevLeft  size={17} color={hov && active ? "#18140E" : C.gold} strokeWidth={2.8} />
        : <ChevRight size={17} color={hov && active ? "#18140E" : C.gold} strokeWidth={2.8} />
      }
    </button>
  );
}

// ── HERO SECTION ──────────────────────────────────────────────────────────────
function HeroSection({ loaded, isDark, onNavigateToVenues, onManageBooking }) {
  const C        = getTokens(isDark);
  const isMobile = useIsMobile();
  const ref      = useRef(null);

  const pageBg   = isDark ? "#161208" : "#EDE5D0";
  const textMain = isDark ? "#F0E8D0" : "#1A1510";
  const textSub  = isDark ? "rgba(240,232,208,0.55)" : "rgba(26,21,16,0.55)";
  const chipBg   = isDark ? "rgba(201,168,76,0.055)" : "rgba(26,21,16,0.045)";
  const chipBd   = isDark ? "rgba(201,168,76,0.20)"  : "rgba(26,21,16,0.13)";
  const btnClass = isDark ? "hero-cta hero-cta-solid-dark" : "hero-cta hero-cta-solid-light";

  useEffect(() => {
    if (!loaded) return;
    let ctx;
    loadGsap().then(() => {
      if (!ref.current) return;
      ctx = window.gsap.context(() => {
        const tl = window.gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from(".h-eyebrow",  { y: 16, opacity: 0, duration: 0.55, delay: 0.08 })
          .from(".h-line",     { y: 44, opacity: 0, duration: 0.80, stagger: 0.09 }, "-=0.28")
          .from(".h-sub",      { y: 14, opacity: 0, duration: 0.60 }, "-=0.48")
          .from(".h-cta",      { y: 12, opacity: 0, duration: 0.48, stagger: 0.07 }, "-=0.40")
          .from(".h-stat",     { y: 10, opacity: 0, duration: 0.46, stagger: 0.07 }, "-=0.34")
          .from(".h-scroll",   { opacity: 0, duration: 0.50 }, "-=0.28");

        window.gsap.utils.toArray(".wing-img").forEach((el) => {
          window.gsap.to(el, {
            yPercent: 7, ease: "none",
            scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true }
          });
        });
        window.gsap.to(".h-scroll-line", {
          scaleY: 0.38, transformOrigin: "top center",
          repeat: -1, yoyo: true, duration: 1.2, ease: "sine.inOut"
        });
      }, ref);
    });
    return () => { if (ctx) ctx.revert(); };
  }, [loaded]);

  // ── MOBILE ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <section ref={ref} style={{ background: pageBg, paddingTop: NAV_H, overflow: "hidden", transition: "background 0.35s" }}>
        <div style={{ padding: "28px 20px 24px" }}>
          {/* Eyebrow */}
          <div className="h-eyebrow" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <span style={{ width: 24, height: 1, background: C.gold, flexShrink: 0 }} />
            <span style={{ fontFamily: BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", color: C.gold }}>
              Est. Alabang, Manila
            </span>
          </div>
          {/* Headline */}
          <h1 style={{ fontFamily: DISPLAY, fontWeight: 600, color: textMain, lineHeight: 1.0, letterSpacing: "-0.022em", margin: 0 }}>
            <span className="h-line" style={{ display: "block", fontSize: "clamp(36px,10vw,58px)" }}>Reserve</span>
            <span className="h-line" style={{ display: "block", fontSize: "clamp(36px,10vw,58px)", fontStyle: "italic", color: C.gold }}>Your Perfect</span>
            <span className="h-line" style={{ display: "block", fontSize: "clamp(36px,10vw,58px)" }}>Setting.</span>
          </h1>
          {/* Sub */}
          <p className="h-sub" style={{ fontFamily: BODY, fontSize: 13, color: textSub, lineHeight: 1.75, marginTop: 16, maxWidth: 340 }}>
            Two wings of premium event spaces and dining — from intimate boardrooms to grand ballrooms.
          </p>
          {/* CTAs */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
            <button className={`h-cta ${btnClass}`} onClick={() => onNavigateToVenues && onNavigateToVenues()}>
              Browse Venues
            </button>
            <button className={`h-cta ${isDark ? "hero-cta hero-cta-outline-dark" : "hero-cta hero-cta-outline-light"}`} onClick={onManageBooking}>
              Manage Booking
            </button>
          </div>
          {/* Stats */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3,1fr)",
            marginTop: 22, height: 74,
            background: chipBg, border: `1px solid ${chipBd}`, borderRadius: 4,
          }}>
            {[["2","Wings"],["9","Venues"],["3","Restaurants"]].map(([n,l],i) => (
              <div key={l} className="h-stat" style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                height: "100%", borderLeft: i === 0 ? "none" : `1px solid ${chipBd}`,
              }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 26, color: textMain, lineHeight: 1, fontWeight: 600 }}>{n}</span>
                <span style={{ fontFamily: BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: C.gold, marginTop: 5 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Wing cards */}
        <div>
          <div className="wing-card" style={{ height: 210, borderRadius: 0 }}
            onClick={() => onNavigateToVenues && onNavigateToVenues("main-wing")}>
            <img className="wing-img" src={mainWingImg} alt="Main Wing" />
            <div className="wing-overlay" />
            <div className="wing-content">
              <div>
                <span className="wing-tag">Wing 01</span>
                <div className="wing-title" style={{ fontSize: 22 }}>Main Wing</div>
                <p className="wing-desc">Corporate &amp; Social Events</p>
              </div>
              <div className="wing-chev"><ChevRight size={15} color="currentColor" /></div>
            </div>
          </div>
          <div className="wing-card" style={{ height: 210, borderRadius: 0, marginTop: 2 }}
            onClick={() => onNavigateToVenues && onNavigateToVenues("tower-wing")}>
            <img className="wing-img" src={towerWingImg} alt="Tower Wing" />
            <div className="wing-overlay" />
            <div className="wing-content">
              <div>
                <span className="wing-tag">Wing 02</span>
                <div className="wing-title" style={{ fontSize: 22 }}>Tower Wing</div>
                <p className="wing-desc">Grand Galas &amp; Celebrations</p>
              </div>
              <div className="wing-chev"><ChevRight size={15} color="currentColor" /></div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── DESKTOP ───────────────────────────────────────────────────────────────
  return (
    <section
      ref={ref}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        // FIX: use full 100vh and no marginTop so right panel fills edge-to-edge
        height: "100vh",
        minHeight: 520,
        maxHeight: 940,
        marginTop: 0,
        background: pageBg,
        overflow: "hidden",
        position: "relative",
        transition: "background 0.35s",
      }}
    >
      {/* Scroll indicator */}
      <div className="h-scroll" style={{
        position: "absolute", left: 14, bottom: 26, zIndex: 3,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        writingMode: "vertical-rl", transform: "rotate(180deg)",
        fontFamily: BODY, fontSize: 8, fontWeight: 700,
        letterSpacing: "0.34em", textTransform: "uppercase", color: C.gold,
      }}>
        <span>Scroll</span>
        <span className="h-scroll-line" style={{ width: 1, height: 30, background: C.gold, display: "block" }} />
      </div>

      {/* ── LEFT PANEL ── */}
      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        // FIX: add paddingTop so content clears the fixed navbar
        padding: `${NAV_H + 36}px clamp(32px,5.2vw,70px) clamp(36px,4.8vw,76px)`,
        position: "relative", overflow: "hidden",
      }}>
        {/* Eyebrow */}
        <div className="h-eyebrow" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "clamp(16px,1.8vw,26px)" }}>
          <span style={{ width: 28, height: 1, background: C.gold, flexShrink: 0 }} />
          <span style={{ fontFamily: BODY, fontSize: 10, fontWeight: 700, letterSpacing: "0.34em", textTransform: "uppercase", color: C.gold }}>
            Est. Alabang, Manila
          </span>
        </div>

        {/* Headline */}
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 600, color: textMain, lineHeight: 0.97, letterSpacing: "-0.024em", margin: 0 }}>
          <span className="h-line" style={{ display: "block", fontSize: "clamp(38px,5.0vw,78px)" }}>Reserve</span>
          <span className="h-line" style={{ display: "block", fontSize: "clamp(38px,5.0vw,78px)", fontStyle: "italic", color: C.gold, fontWeight: 500 }}>Your Perfect</span>
          <span className="h-line" style={{ display: "block", fontSize: "clamp(38px,5.0vw,78px)" }}>Setting.</span>
        </h1>

        {/* Subtext */}
        <p className="h-sub" style={{
          fontFamily: BODY, fontSize: "clamp(12px,0.90vw,14px)", color: textSub,
          lineHeight: 1.85, marginTop: "clamp(12px,1.6vw,22px)", maxWidth: 390,
        }}>
          Two wings of premium event spaces and dining —<br />from intimate boardrooms to grand ballrooms.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: "clamp(16px,2.2vw,30px)" }}>
          <button className={`h-cta ${btnClass}`} onClick={() => onNavigateToVenues && onNavigateToVenues()}>
            Browse Venues
          </button>
          <button className={`h-cta ${isDark ? "hero-cta hero-cta-outline-dark" : "hero-cta hero-cta-outline-light"}`} onClick={onManageBooking}>
            Manage Booking
          </button>
        </div>

        {/* Stats bar */}
        <div style={{
          display: "flex", alignItems: "center",
          marginTop: "clamp(16px,2.4vw,32px)",
          background: chipBg, border: `1px solid ${chipBd}`,
          borderRadius: 4, width: "fit-content",
          padding: "clamp(10px,1.1vw,16px) clamp(14px,1.8vw,26px)",
        }}>
          {[["2","Wings"],["9","Venues"],["3","Restaurants"]].map(([n,l],i) => (
            <div key={l} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && (
                <div style={{ width: 1, height: 24, background: chipBd, margin: "0 clamp(12px,1.6vw,22px)" }} />
              )}
              <div className="h-stat" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontFamily: DISPLAY, fontSize: "clamp(20px,2.2vw,30px)", color: textMain, lineHeight: 1, fontWeight: 600 }}>{n}</span>
                <span style={{ fontFamily: BODY, fontSize: 9, fontWeight: 700, letterSpacing: "0.20em", textTransform: "uppercase", color: C.gold, marginTop: 5 }}>{l}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL — two stacked wing cards filling full height ── */}
      <div style={{
        display: "grid",
        gridTemplateRows: "1fr 1fr",
        gap: 2,
        height: "100%",
        overflow: "hidden",
      }}>
        <div className="wing-card" style={{ borderRadius: 0, overflow: "hidden", height: "100%" }}
          onClick={() => onNavigateToVenues && onNavigateToVenues("main-wing")}>
          <img className="wing-img" src={mainWingImg} alt="Main Wing" />
          <div className="wing-overlay" />
          <div className="wing-content">
            <div>
              <span className="wing-tag">Wing 01</span>
              <div className="wing-title">Main Wing</div>
              <p className="wing-desc">Corporate &amp; Social Events</p>
            </div>
            <div className="wing-chev"><ChevRight size={16} color="currentColor" /></div>
          </div>
        </div>

        <div className="wing-card" style={{ borderRadius: 0, overflow: "hidden", height: "100%" }}
          onClick={() => onNavigateToVenues && onNavigateToVenues("tower-wing")}>
          <img className="wing-img" src={towerWingImg} alt="Tower Wing" />
          <div className="wing-overlay" />
          <div className="wing-content">
            <div>
              <span className="wing-tag">Wing 02</span>
              <div className="wing-title">Tower Wing</div>
              <p className="wing-desc">Grand Galas &amp; Celebrations</p>
            </div>
            <div className="wing-chev"><ChevRight size={16} color="currentColor" /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── DINING ────────────────────────────────────────────────────────────────────
function DiningSection({ initialRestaurantId, onNavigateToDining }) {
  const { isDark } = useTheme();
  const C = getTokens(isDark);
  const isMobile = useIsMobile();
  const ref = useGsapScroll({ y:40, opacity:0, duration:0.9, selector:".da", stagger:0.10, start:"top 80%" });
  const [activeR,   setActiveR]   = useState(0);
  const [activeImg, setActiveImg] = useState(0);
  const [hovLabel,  setHovLabel]  = useState(null);

  const r    = RESTAURANTS[activeR];
  const imgs = r?.imgs ?? [];

  const goRestaurant = (nextIndex) => {
    const next = Math.max(0, Math.min(RESTAURANTS.length - 1, nextIndex));
    if (next === activeR) return;
    setActiveR(next);
    setActiveImg(0);
  };

  const restaurantTrackStyle = {
    display: "flex",
    height: "100%",
    transform: `translate3d(${-activeR * 100}%, 0, 0)`,
    transition: "transform 520ms cubic-bezier(0.16, 1, 0.3, 1)",
    willChange: "transform",
  };

  useEffect(() => {
    if (!initialRestaurantId) return;
    const idx = RESTAURANTS.findIndex(x => x.id === initialRestaurantId);
    if (idx >= 0 && idx !== activeR) {
      setActiveR(idx);
      setActiveImg(0);
    }
  }, [initialRestaurantId]);

  useEffect(() => {
    const id = setInterval(() => setActiveImg(n => (n + 1) % imgs.length), 4000);
    return () => clearInterval(id);
  }, [imgs.length]);

  const diningBgStyle = {
    background: C.diningBg,
    backgroundImage: isDark
      ? `radial-gradient(ellipse 70% 50% at 28% 60%, rgba(201,168,76,0.08) 0%, transparent 65%),
         radial-gradient(ellipse 60% 60% at 78% 30%, rgba(201,168,76,0.06) 0%, transparent 65%),
         linear-gradient(180deg, #111009 0%, #0E0D09 100%)`
      : `radial-gradient(ellipse 60% 40% at 20% 70%, rgba(154,110,28,0.10) 0%, transparent 65%),
         radial-gradient(ellipse 50% 50% at 80% 25%, rgba(154,110,28,0.08) 0%, transparent 65%),
         linear-gradient(180deg, #E8DEC8 0%, #E0D4B8 100%)`,
  };

  const imgBlock = (h) => (
    <div style={{ height:h, position:"relative", overflow:"hidden", borderRadius:4 }}>
      <div style={restaurantTrackStyle}>
        {RESTAURANTS.map((restaurant, restaurantIndex) => (
          <div key={restaurant.id} style={{ position:"relative", flex:"0 0 100%", height:"100%", overflow:"hidden" }}>
            {restaurant.imgs.map((src, i) => {
              const isCurrentRestaurant = restaurantIndex === activeR;
              const isVisible = isCurrentRestaurant ? activeImg === i : i === 0;
              return (
                <img
                  key={`${restaurant.id}-${i}`}
                  src={src}
                  alt=""
                  style={{
                    position:"absolute",
                    inset:0,
                    width:"100%",
                    height:"100%",
                    objectFit:"cover",
                    opacity:isVisible?1:0,
                    transition:"opacity 0.7s ease, transform 6s ease",
                    transform: isVisible ? "scale(1.05)" : "scale(1)",
                  }}
                />
              );
            })}
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,rgba(14,13,9,0.72) 0%,transparent 50%)" }} />
            <div style={{ position:"absolute", top:16, left:16, background:isDark?"rgba(0,0,0,0.56)":"rgba(255,255,255,0.90)", backdropFilter:"blur(12px)", padding:"6px 14px 6px 10px", display:"flex", alignItems:"center", gap:8, borderRadius:2 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:C.gold }} />
              <span style={{ fontFamily:BODY, fontSize:10, fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase", color:C.gold }}>{restaurant.tag}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position:"absolute", bottom:14, left:"50%", transform:"translateX(-50%)", display:"flex", gap:6 }}>
        {imgs.map((_, i) => (
          <button key={i} type="button" onClick={() => setActiveImg(i)}
            style={{ width:i===activeImg?18:6, height:6, borderRadius:3, border:"none", padding:0, cursor:"pointer", background:i===activeImg?C.gold:"rgba(255,255,255,0.35)", transition:"all 0.3s ease" }} />
        ))}
      </div>
    </div>
  );

  const chips = (restaurant = r) => (
    <div style={{ display:"flex", flexWrap:"wrap", gap:isMobile?6:8, marginBottom:isMobile?18:28 }}>
      {(restaurant?.diningTimes ?? []).map(d => {
        const key = `${restaurant.id}-${d.label}`;
        const hov = hovLabel === key;
        return (
          <div key={d.label} onMouseEnter={() => setHovLabel(key)} onMouseLeave={() => setHovLabel(null)}
            style={{ padding:isMobile?"5px 10px":"7px 14px", background:hov?C.goldFaint:"transparent", border:`1px solid ${hov?C.gold:C.border}`, display:"flex", flexDirection:"column", transition:"all 0.22s cubic-bezier(0.4,0,0.2,1)", userSelect:"none", cursor:"default", borderRadius:2, transform: hov ? "translateY(-2px)" : "none" }}>
            <div style={{ fontFamily:BODY, fontSize:isMobile?11:12, fontWeight:700, letterSpacing:"0.06em", color:C.gold }}>{d.label}</div>
            {d.hours && <div style={{ fontFamily:BODY, fontSize:isMobile?10:11, color:C.textMuted, marginTop:2 }}>{d.hours}</div>}
          </div>
        );
      })}
    </div>
  );

  const thumbs = () => (
    <div style={{ overflow:"hidden" }}>
      <div style={{ ...restaurantTrackStyle, height:"auto" }}>
        {RESTAURANTS.map((restaurant) => (
          <div key={restaurant.id} style={{ flex:"0 0 100%", display:"flex", gap:isMobile?6:8 }}>
            {restaurant.imgs.map((src, i) => (
              <div key={i} onClick={() => setActiveImg(i)}
                style={{ flex:1, height:isMobile?50:60, overflow:"hidden", cursor:"pointer", border:activeImg===i?`2px solid ${C.gold}`:"2px solid transparent", transition:"border 0.22s", borderRadius:2 }}>
                <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", transition:"transform 0.4s" }}
                  onMouseEnter={e => e.currentTarget.style.transform="scale(1.08)"}
                  onMouseLeave={e => e.currentTarget.style.transform="scale(1)"} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  const titleTrack = (titleStyle) => (
    <div style={{ overflow:"hidden" }}>
      <div style={{ ...restaurantTrackStyle, height:"auto" }}>
        {RESTAURANTS.map((restaurant) => (
          <h2 key={restaurant.id} style={{ ...titleStyle, flex:"0 0 100%" }}>
            {restaurant.name}
          </h2>
        ))}
      </div>
    </div>
  );

  const detailsTrack = () => (
    <div style={{ overflow:"hidden" }}>
      <div style={{ ...restaurantTrackStyle, alignItems:"flex-start", height:"auto" }}>
        {RESTAURANTS.map((restaurant) => (
          <div key={restaurant.id} style={{ flex:"0 0 100%" }}>
            <p style={{ fontFamily:BODY, fontSize:isMobile?13:14, color:C.textMuted, lineHeight:isMobile?1.78:1.88, marginBottom:isMobile?16:28, maxWidth:isMobile?"none":380 }}>{restaurant.description}</p>
            {chips(restaurant)}
            <button type="button" onClick={onNavigateToDining}
              className={`dining-reserve-btn${isDark?"":" dining-reserve-btn-light"}`}
              style={isMobile ? { width:"100%", justifyContent:"center", marginTop:8 } : undefined}>
              Reserve a Dining Venue
              <ChevRight size={14} color="currentColor" strokeWidth={2.5} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <section ref={ref} className="full-section grain" style={{ ...diningBgStyle, padding:"36px 16px 48px", overflow:"hidden" }}>
        <div style={{ maxWidth:520, margin:"0 auto", width:"100%" }}>
          <div className="da" style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, marginTop:20, opacity:0 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <div style={{ width:24, height:1, background:C.gold }} />
                <span style={{ fontFamily:BODY, fontSize:9, fontWeight:700, letterSpacing:"0.36em", textTransform:"uppercase", color:C.gold }}>Fine Dining</span>
              </div>
              {titleTrack({ fontFamily:DISPLAY, fontSize:28, fontWeight:600, color:C.textPrimary, lineHeight:1, letterSpacing:"-0.01em", margin:0 })}
            </div>
            <div style={{ display:"flex", gap:6, paddingTop:4 }}>
              <NavDot disabled={activeR===0}                    icon="left"  C={C} onClick={() => goRestaurant(activeR - 1)} />
              <NavDot disabled={activeR===RESTAURANTS.length-1} icon="right" C={C} onClick={() => goRestaurant(activeR + 1)} />
            </div>
          </div>
          <div className="da" style={{ marginBottom:12, opacity:0 }}>{imgBlock(220)}</div>
          <div className="da" style={{ marginBottom:14, opacity:0 }}>{thumbs()}</div>
          <div className="da" style={{ opacity:0 }}>{detailsTrack()}</div>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className="full-section grain" style={{ ...diningBgStyle, padding:"clamp(80px,10vw,120px) clamp(20px,5vw,56px)", overflow:"hidden" }}>
      <div style={{ maxWidth:1100, margin:"0 auto", width:"100%" }}>
        <div className="da" style={{ display:"flex", alignItems:"center", gap:14, marginBottom:60, opacity:0 }}>
          <div style={{ width:32, height:1, background:C.gold }} />
          <span style={{ fontFamily:BODY, fontSize:9, fontWeight:700, letterSpacing:"0.44em", textTransform:"uppercase", color:C.gold }}>Fine Dining</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"clamp(52px,6vw,88px)", alignItems:"start" }}>
          <div className="da" style={{ opacity:0 }}>
            {imgBlock(440)}
            <div style={{ marginTop:10 }}>{thumbs()}</div>
          </div>
          <div className="da" style={{ paddingTop:8, opacity:0 }}>
            <div style={{ display:"flex", gap:8, marginBottom:24 }}>
              <NavDot disabled={activeR===0}                    icon="left"  C={C} onClick={() => goRestaurant(activeR - 1)} />
              <NavDot disabled={activeR===RESTAURANTS.length-1} icon="right" C={C} onClick={() => goRestaurant(activeR + 1)} />
              <span style={{ fontFamily:MONO, fontSize:11, color:C.textFaint, alignSelf:"center", marginLeft:4 }}>
                {String(activeR+1).padStart(2,"0")} / {String(RESTAURANTS.length).padStart(2,"0")}
              </span>
            </div>
            {titleTrack({ fontFamily:DISPLAY, fontSize:"clamp(32px,4vw,56px)", fontWeight:600, color:C.textPrimary, marginBottom:14, lineHeight:0.95, letterSpacing:"-0.01em" })}
            {detailsTrack()}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── MARQUEE ───────────────────────────────────────────────────────────────────
function Marquee() {
  const { isDark } = useTheme();
  const C = getTokens(isDark);
  const bg = isDark ? "#0E0D09" : "#18140E";
  return (
    <div style={{ background:bg, padding:"28px 0", overflow:"hidden" }}>
      <div style={{ maxWidth:1100, margin:"0 auto clamp(10px,1.5vw,16px)", padding:"0 24px", display:"flex", alignItems:"center", gap:1 }}>
        <div style={{ flex:1, height:1, background:"rgba(201,168,76,0.15)" }} />
        <span style={{ fontFamily:BODY, fontSize:9, fontWeight:700, letterSpacing:"0.32em", textTransform:"uppercase", color:C.gold, flexShrink:0, whiteSpace:"nowrap", padding:"0 16px" }}>Official Partners &amp; Sponsors</span>
        <div style={{ flex:1, height:1, background:"rgba(201,168,76,0.15)" }} />
      </div>
      <div style={{ position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", left:0, top:0, bottom:0, width:80, background:`linear-gradient(to right,${bg},transparent)`, zIndex:2, pointerEvents:"none" }} />
        <div style={{ position:"absolute", right:0, top:0, bottom:0, width:80, background:`linear-gradient(to left,${bg},transparent)`, zIndex:2, pointerEvents:"none" }} />
        <div style={{ display:"flex", animation:"partners-scroll 28s linear infinite", whiteSpace:"nowrap" }}
          onMouseEnter={e => e.currentTarget.style.animationPlayState="paused"}
          onMouseLeave={e => e.currentTarget.style.animationPlayState="running"}>
          {[...PARTNERS,...PARTNERS].map((name, i) => (
            <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:10, marginRight:"clamp(40px,6vw,72px)", fontFamily:BODY, fontSize:11, fontWeight:700, letterSpacing:"0.22em", textTransform:"uppercase", color:"rgba(240,232,208,0.22)", transition:"color .25s" }}
              onMouseEnter={e=>e.currentTarget.style.color=C.gold}
              onMouseLeave={e=>e.currentTarget.style.color="rgba(240,232,208,0.22)"}>
              <span style={{ width:4, height:4, borderRadius:"50%", background:C.gold, display:"inline-block", flexShrink:0 }} />
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── NEWSLETTER ────────────────────────────────────────────────────────────────
function NewsletterSection() {
  const { isDark } = useTheme();
  const C = getTokens(isDark);
  const isMobile = useIsMobile();
  const ref = useGsapScroll({ y:30, opacity:0, duration:0.9, delay:0.05 });
  return (
    <section ref={ref} style={{ position:"relative", overflow:"hidden", background:C.nlBg, transition:"background 0.35s" }}>
      <div style={{ position:"absolute", inset:0, opacity:isDark?0.04:0.05, backgroundImage:`linear-gradient(${C.gold} 1px,transparent 1px),linear-gradient(90deg,${C.gold} 1px,transparent 1px)`, backgroundSize:"60px 60px", pointerEvents:"none" }} />
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:`linear-gradient(90deg,transparent,${C.gold},transparent)` }} />
      <div style={{ position:"relative", maxWidth:1100, margin:"0 auto", padding:"clamp(36px,6vw,72px) clamp(20px,5vw,60px)", display:"flex", alignItems:isMobile?"flex-start":"center", justifyContent:"space-between", flexDirection:isMobile?"column":"row", gap:isMobile?24:36, flexWrap:"wrap", width:"100%" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:0 }}>
            <div style={{ width:24, height:1, background:C.gold }} />
            <span style={{ fontFamily:BODY, fontSize:12, fontWeight:700, letterSpacing:"0.22em", textTransform:"uppercase", color:C.gold }}>Stay Connected</span>
          </div>
          <h3 style={{ fontFamily:DISPLAY, fontSize:"clamp(22px,3.5vw,42px)", fontWeight:600, color:C.textPrimary, lineHeight:1.1, margin:0 }}>
            Let's plan your<br /><em style={{ color:C.gold }}>event together.</em>
          </h3>
          <p style={{ fontFamily:BODY, fontSize:13, color:C.textMuted, lineHeight:1.85, maxWidth:400, marginTop:12 }}>Our events team is available to help you find the perfect space and ensure a flawless occasion.</p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14, alignItems:isMobile?"flex-start":"flex-end", flexShrink:0 }}>
          <a href="mailto:reservations@thebellevue.com"
            style={{ fontFamily:DISPLAY, fontSize:"clamp(14px,1.6vw,19px)", fontStyle:"italic", color:C.gold, textDecoration:"none", borderBottom:`1px solid ${C.border}`, paddingBottom:3, letterSpacing:"0.02em", transition:"color 0.2s,border-color 0.2s" }}
            onMouseEnter={e=>{e.currentTarget.style.color=C.goldLight;e.currentTarget.style.borderBottomColor=C.gold;}}
            onMouseLeave={e=>{e.currentTarget.style.color=C.gold;e.currentTarget.style.borderBottomColor=C.border;}}>
            reservations@thebellevue.com
          </a>
          <div style={{ display:"flex", gap:8 }}>
            {[["f","Facebook","https://www.facebook.com/thebellevuemanila/"],["t","X","https://x.com/bellevuemanila"],["i","Instagram","https://www.instagram.com/bellevuemanila/"],["y","YouTube","https://www.youtube.com/channel/UC01W6kRH_R-T0ok6RDT3aGg"]].map(([icon,label,href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" title={label}
                style={{ width:36, height:36, borderRadius:"50%", border:`1px solid ${C.border}`, color:C.textMuted, fontFamily:BODY, fontSize:13, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", textDecoration:"none", transition:"all 0.2s" }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.color=C.gold;e.currentTarget.style.transform="translateY(-3px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textMuted;e.currentTarget.style.transform="translateY(0)";}}>
                {icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function FooterLink({ children, onClick }) {
  const { isDark } = useTheme();
  const C = getTokens(isDark);
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ fontFamily:BODY, fontSize:13, color:hov?C.gold:C.footerLink, marginBottom:9, cursor:"pointer", transition:"color 0.2s, transform 0.2s", transform: hov ? "translateX(3px)" : "none" }}>
      {children}
    </div>
  );
}

function Footer({ onNavigate, onManageBooking }) {
  const { isDark } = useTheme();
  const C = getTokens(isDark);
  const ref = useGsapScroll({ y:24, opacity:0, duration:0.85, selector:".fc", stagger:0.08 });
  return (
    <footer ref={ref} style={{ background:C.footerBg, borderTop:`1px solid ${C.borderLight}`, transition:"background 0.35s" }}>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"clamp(44px,6vw,72px) clamp(20px,5vw,60px) clamp(28px,4vw,44px)" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:"clamp(24px,4vw,40px)", marginBottom:44 }}>
          <div className="fc">
            <div style={{ marginBottom:16 }}>
              <img src={bellevueLogo} alt="The Bellevue Manila" style={{ height:36, width:"auto", display:"block", filter:isDark?"none":"brightness(0) saturate(100%) invert(30%) sepia(50%) saturate(400%) hue-rotate(5deg)", transition:"filter 0.35s" }} />
            </div>
            <p style={{ fontFamily:BODY, fontSize:13, color:C.textFaint, lineHeight:1.85, margin:"0 0 14px" }}>Luxury event spaces and seamless reservations in the heart of Alabang.</p>
          </div>
          <div className="fc">
            <div style={{ fontFamily:BODY, fontSize:11, fontWeight:700, letterSpacing:"0.2em", textTransform:"uppercase", color:C.gold, marginBottom:13 }}>Venues</div>
            <FooterLink onClick={() => onNavigate("main-wing")}>Main Wing</FooterLink>
            <FooterLink onClick={() => onNavigate("tower-wing")}>Tower Wing</FooterLink>
            <FooterLink onClick={() => onNavigate("dining")}>Dining</FooterLink>
          </div>
          <div className="fc">
            <div style={{ fontFamily:BODY, fontSize:11, fontWeight:700, letterSpacing:"0.2em", textTransform:"uppercase", color:C.gold, marginBottom:13 }}>Reservations</div>
            <FooterLink onClick={() => onNavigate("main-wing")}>Book a Seat</FooterLink>
            <FooterLink onClick={() => onNavigate("dining")}>Book a Table</FooterLink>
            <FooterLink onClick={onManageBooking}>Manage Booking</FooterLink>
          </div>
          <div className="fc">
            <div style={{ fontFamily:BODY, fontSize:11, fontWeight:700, letterSpacing:"0.2em", textTransform:"uppercase", color:C.gold, marginBottom:13 }}>Contact</div>
            <p style={{ fontFamily:BODY, fontSize:13, color:C.textFaint, lineHeight:2, margin:0 }}>
              02-871-8181-5139<br />
              North Bridgeway, Filinvest City<br />
              Alabang, Muntinlupa City
            </p>
          </div>
        </div>
        <div style={{ height:1, background:C.borderLight, margin:"0 0 24px" }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <span style={{ fontFamily:BODY, fontSize:12, color:C.textDeep }}>© {new Date().getFullYear()} The Bellevue Manila. All rights reserved.</span>
          <span style={{ fontFamily:BODY, fontSize:12, color:C.textDeep }}>Seat &amp; Table Management Reservation</span>
        </div>
      </div>
    </footer>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loaded, setLoaded]  = useState(false);
  const [diningRestaurantId] = useState(null);

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem("bellevue-theme");
      if (saved !== null) return saved === "dark";
    } catch {}
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  });

  const toggleTheme = () => setIsDark(prev => {
    const next = !prev;
    try { localStorage.setItem("bellevue-theme", next?"dark":"light"); } catch {}
    return next;
  });

  const C = getTokens(isDark);

  const goToVenues        = (section) => section ? navigate(`/venues?section=${section}`) : navigate("/venues");
  const goToDining        = () => navigate("/venues?section=dining");
  const goToManageBooking = () => navigate("/manage-booking");

  useEffect(() => {
    const state = location.state;
    if (!state) return;
    if (state.scrollTo === "dining") {
      requestAnimationFrame(() => {
        const el = document.getElementById("home-dining");
        if (el) el.scrollIntoView({ behavior:"smooth", block:"start" });
      });
    }
    if (state.scrollTo === "event") window.scrollTo({ top:0, behavior:"smooth" });
    navigate(".", { replace:true, state:null });
  }, [location.state, navigate]);

  useEffect(() => {
    const markerY = NAV_H + 8;
    const inView = (id) => {
      const el = document.getElementById(id); if (!el) return false;
      const r = el.getBoundingClientRect(); return r.top <= markerY && r.bottom > markerY;
    };
    const onScroll = () => window.dispatchEvent(new CustomEvent("homeActiveSection", { detail: inView("home-dining") ? "dining" : null }));
    window.addEventListener("scroll", onScroll, { passive:true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <ThemeContext.Provider value={{ isDark, toggle:toggleTheme }}>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <div style={{ background:C.pageBg, minHeight:"100vh", transition:"background 0.35s" }}>
        {!loaded && <Loader onDone={() => setLoaded(true)} />}
        <div style={{ opacity:loaded?1:0, transition:"opacity 0.7s" }}>
          <SharedNavbar isDark={isDark} toggle={toggleTheme} showNavigation={true} scrolled={scrolled} height={NAV_H} />
          <HeroSection loaded={loaded} isDark={isDark} onNavigateToVenues={goToVenues} onManageBooking={goToManageBooking} />
          <div id="home-dining">
            <DiningSection initialRestaurantId={diningRestaurantId} onNavigateToDining={goToDining} />
          </div>
          <Marquee />
          <NewsletterSection />
          <Footer onNavigate={goToVenues} onManageBooking={goToManageBooking} />
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
