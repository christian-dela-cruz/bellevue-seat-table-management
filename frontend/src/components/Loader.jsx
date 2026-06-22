import React, { useEffect, useState, useRef } from 'react';
import bellevueLogo from '../assets/bellevue-logo.png';
import lottieData   from '../assets/loading.json';

const DISPLAY = `'Inter', 'Helvetica Neue', Arial, sans-serif`;
const BODY    = `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;

const LOADER_CSS = `
  @keyframes loader-text-in {
    from { opacity: 0; letter-spacing: 0.52em; }
    to   { opacity: 1; letter-spacing: 0.38em; }
  }
  @keyframes loader-tagline-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes loader-bar-grow {
    from { width: 0%; }
    to   { width: 100%; }
  }
  @keyframes loader-exit {
    0%   { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes logo-fade-in {
    from { opacity: 0; transform: translateY(-8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes grain-shift {
    0%, 100% { transform: translate(0, 0); }
    10%  { transform: translate(-2%, -3%); }
    20%  { transform: translate(3%, 2%); }
    30%  { transform: translate(-1%, 4%); }
    40%  { transform: translate(4%, -1%); }
    50%  { transform: translate(-3%, 3%); }
    60%  { transform: translate(2%, -4%); }
    70%  { transform: translate(-4%, 1%); }
    80%  { transform: translate(1%, -2%); }
    90%  { transform: translate(3%, 4%); }
  }
`;

function LottiePlayer({ animationData, style }) {
  const containerRef = useRef(null);
  const animRef      = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!window.lottie) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      if (cancelled || !containerRef.current) return;
      animRef.current = window.lottie.loadAnimation({
        container:     containerRef.current,
        renderer:      'svg',
        loop:          true,
        autoplay:      true,
        animationData: animationData,
      });
    };
    load().catch(console.error);
    return () => { cancelled = true; animRef.current?.destroy(); };
  }, [animationData]);

  return <div ref={containerRef} style={style} />;
}

export default function Loader({ onDone }) {
  const [phase, setPhase] = useState('in');
  const [exit,  setExit]  = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('out'), 2800);
    const t2 = setTimeout(() => { setExit(true); onDone?.(); }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  if (exit) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LOADER_CSS }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        /* Deep black gradient — no image dependency */
        background: 'radial-gradient(ellipse 80% 60% at 50% 40%, #1A1208 0%, #0A0804 40%, #000000 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        animation: phase === 'out' ? 'loader-exit 0.7s ease forwards' : 'none',
        overflow: 'hidden',
      }}>

        {/* Grain texture overlay */}
        <div style={{
          position: 'absolute', inset: '-50%',
          width: '200%', height: '200%',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
          opacity: 0.04,
          animation: 'grain-shift 0.5s steps(1) infinite',
          pointerEvents: 'none',
        }} />

        {/* Gold vignette glow */}
        <div style={{
          position: 'absolute',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Subtle top border */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)',
        }} />

        {/* Logo */}
        <div style={{
          position: 'relative', zIndex: 1,
          animation: 'logo-fade-in 0.8s ease 0.1s both',
          marginBottom: 0,
        }}>
          <img
            src={bellevueLogo}
            alt="The Bellevue Manila"
            style={{
              height: 48, width: 'auto', display: 'block',
              filter: 'brightness(0) saturate(100%) invert(72%) sepia(28%) saturate(600%) hue-rotate(5deg) brightness(0.95)',
            }}
          />
        </div>

        {/* Lottie */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <LottiePlayer
            animationData={lottieData}
            style={{ width: 130, height: 130 }}
          />
        </div>

        {/* Brand label */}
        <div style={{
          position: 'relative', zIndex: 1,
          fontFamily: BODY, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.38em', textTransform: 'uppercase',
          color: 'rgba(201,168,76,0.85)',
          marginTop: 4, marginBottom: 12,
          animation: 'loader-text-in 1s ease 0.4s both',
        }}>
          Seat and Table Reservation
        </div>

        {/* Tagline */}
        <div style={{
          position: 'relative', zIndex: 1,
          fontFamily: DISPLAY,
          fontSize: 'clamp(15px,2vw,20px)',
          fontWeight: 500, fontStyle: 'italic',
          color: '#F0E8D0',
          letterSpacing: '0.01em',
          textAlign: 'center', lineHeight: 1.5,
          animation: 'loader-tagline-in 0.9s ease 0.65s both',
          opacity: 0,
        }}>
          Always at Home in<br />World-Class Hospitality
        </div>

        {/* Progress bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 2, background: 'rgba(201,168,76,0.08)', zIndex: 1,
        }}>
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
            animation: 'loader-bar-grow 2.6s cubic-bezier(0.4,0,0.2,1) 0.1s forwards',
            width: 0,
          }} />
        </div>

      </div>
    </>
  );
}