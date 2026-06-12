import { createContext, useContext, useState, useEffect } from "react";

const AdminThemeContext = createContext({
  isDark: false,
  toggleTheme: () => {}
});

export const useAdminTheme = () => useContext(AdminThemeContext);

let isDarkTheme = false;

export const C = {
  // Base Gold Colors
  get gold() { return isDarkTheme ? "#C4A35A" : "#8C6B2A"; },
  get goldLight() { return isDarkTheme ? "#D9BC7A" : "#A07D38"; },
  get goldSoft() { return isDarkTheme ? "#D9BC7A" : "#A07D38"; },
  get goldFaint() { return isDarkTheme ? "rgba(196,163,90,0.08)" : "rgba(140,107,42,0.08)"; },
  get goldFaintest() { return isDarkTheme ? "rgba(196,163,90,0.04)" : "rgba(140,107,42,0.04)"; },
  
  // Backgrounds & Surfaces
  get pageBg() { return isDarkTheme ? "#0A0908" : "#F7F4EE"; },
  get page() { return isDarkTheme ? "#0A0908" : "#F7F4EE"; },
  get surface() { return isDarkTheme ? "#111009" : "#FFFFFF"; },
  get surfaceBase() { return isDarkTheme ? "#111009" : "#FFFFFF"; },
  get surfaceSoft() { return isDarkTheme ? "#161410" : "#FAF8F4"; },
  get soft() { return isDarkTheme ? "#161410" : "#FAF8F4"; },
  get surfaceRaised() { return isDarkTheme ? "#161410" : "#FAF8F4"; },
  get surfaceInput() { return isDarkTheme ? "rgba(255,255,255,0.04)" : "#FFFFFF"; },
  get cardBg() { return isDarkTheme ? "#111009" : "#FFFFFF"; },
  get navBg() { return isDarkTheme ? "rgba(10,9,8,0.95)" : "rgba(247,244,238,0.97)"; },
  
  // Borders & Dividers
  get border() { return isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"; },
  get borderDefault() { return isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"; },
  get borderStrong() { return isDarkTheme ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.13)"; },
  get borderAccent() { return isDarkTheme ? "rgba(196,163,90,0.30)" : "rgba(140,107,42,0.28)"; },
  get borderFaint() { return isDarkTheme ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"; },
  get cardBorder() { return isDarkTheme ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"; },
  get navBorder() { return isDarkTheme ? "rgba(196,163,90,0.12)" : "rgba(140,107,42,0.14)"; },
  get divider() { return isDarkTheme ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; },
  
  // Typography
  get text() { return isDarkTheme ? "#EDE8DF" : "#18140E"; },
  get textPrimary() { return isDarkTheme ? "#EDE8DF" : "#18140E"; },
  get muted() { return isDarkTheme ? "#C7BEAF" : "#7A7060"; },
  get textSecondary() { return isDarkTheme ? "#C7BEAF" : "#7A7060"; },
  get faint() { return isDarkTheme ? "#9C9283" : "rgba(24,20,14,0.42)"; },
  get textTertiary() { return isDarkTheme ? "#9C9283" : "rgba(24,20,14,0.35)"; },
  get textOnAccent() { return isDarkTheme ? "#0A0908" : "#FFFFFF"; },
  
  // Status Colors (Red/Green)
  get red() { return isDarkTheme ? "#B85C5C" : "#A03838"; },
  get redFaint() { return isDarkTheme ? "rgba(184,92,92,0.08)" : "rgba(160,56,56,0.07)"; },
  get redBorder() { return isDarkTheme ? "rgba(184,92,92,0.20)" : "rgba(160,56,56,0.18)"; },
  get green() { return isDarkTheme ? "#4A9E7E" : "#2E7A5A"; },
  get greenFaint() { return isDarkTheme ? "rgba(74,158,126,0.08)" : "rgba(46,122,90,0.07)"; },
  get greenBorder() { return isDarkTheme ? "rgba(74,158,126,0.20)" : "rgba(46,122,90,0.18)"; },

  // Cancellation Accents / Slate
  get accent() { return isDarkTheme ? "#9CA3AF" : "#6B7280"; },
  get accentLight() { return isDarkTheme ? "#D1D5DB" : "#9CA3AF"; },
  get accentFaint() { return isDarkTheme ? "rgba(156,163,175,0.08)" : "rgba(107,114,128,0.08)"; },
  get accentFaintest() { return isDarkTheme ? "rgba(156,163,175,0.04)" : "rgba(107,114,128,0.04)"; },
  get accentBorder() { return isDarkTheme ? "rgba(156,163,175,0.22)" : "rgba(107,114,128,0.22)"; },
  get accentBorderStrong() { return isDarkTheme ? "rgba(156,163,175,0.35)" : "rgba(107,114,128,0.35)"; },
  get slate() { return isDarkTheme ? "#9CA3AF" : "#6B7280"; },
  get slateFaint() { return isDarkTheme ? "rgba(156,163,175,0.08)" : "rgba(107,114,128,0.08)"; },
  
  // Badges
  get badgePending() {
    return isDarkTheme
      ? { bg: "rgba(196,163,90,0.10)", color: "#C4A35A", dot: "#C4A35A" }
      : { bg: "rgba(140,107,42,0.09)", color: "#8C6B2A", dot: "#8C6B2A" };
  },
  get badgeApproved() {
    return isDarkTheme
      ? { bg: "rgba(74,158,126,0.10)", color: "#4A9E7E", dot: "#4A9E7E" }
      : { bg: "rgba(46,122,90,0.09)", color: "#2E7A5A", dot: "#2E7A5A" };
  },
  get badgeRejected() {
    return isDarkTheme
      ? { bg: "rgba(184,92,92,0.10)", color: "#B85C5C", dot: "#B85C5C" }
      : { bg: "rgba(160,56,56,0.09)", color: "#A03838", dot: "#A03838" };
  },
  get badgeCancelled() {
    return isDarkTheme
      ? { bg: "rgba(156,163,175,0.10)", color: "#9CA3AF", dot: "#9CA3AF" }
      : { bg: "rgba(107,114,128,0.10)", color: "#6B7280", dot: "#6B7280" };
  },
  
  // Status Note
  get statusNote() {
    return isDarkTheme
      ? { pending: "rgba(196,163,90,0.05)", approved: "rgba(74,158,126,0.05)", rejected: "rgba(184,92,92,0.05)", cancelled: "rgba(184,92,92,0.05)" }
      : { pending: "rgba(140,107,42,0.05)", approved: "rgba(46,122,90,0.05)", rejected: "rgba(160,56,56,0.05)", cancelled: "rgba(160,56,56,0.05)" };
  },
  get statusNoteBorder() {
    return isDarkTheme
      ? { pending: "rgba(196,163,90,0.15)", approved: "rgba(74,158,126,0.15)", rejected: "rgba(184,92,92,0.15)", cancelled: "rgba(184,92,92,0.15)" }
      : { pending: "rgba(140,107,42,0.18)", approved: "rgba(46,122,90,0.18)", rejected: "rgba(160,56,56,0.18)", cancelled: "rgba(160,56,56,0.18)" };
  },
  
  // Shadows & Misc
  get shadow() { return isDarkTheme ? "0 4px 20px rgba(0,0,0,0.6)" : "0 2px 8px rgba(44,36,24,0.035)"; },
  get shadowSoft() { return isDarkTheme ? "0 2px 10px rgba(0,0,0,0.4)" : "0 1px 5px rgba(44,36,24,0.025)"; },
  get inputFocusShadow() { return isDarkTheme ? "0 0 0 3px rgba(196,163,90,0.12)" : "0 0 0 3px rgba(140,107,42,0.10)"; },
  get modalOverlay() { return isDarkTheme ? "rgba(10,9,8,0.88)" : "rgba(0,0,0,0.42)"; },
  get headerGradient() { return isDarkTheme ? "linear-gradient(160deg,#1C1A16 0%,#131210 100%)" : "linear-gradient(160deg,#FAF8F4 0%,#F2EFE8 100%)"; },
  get spinnerBorder() { return isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"; },
  get spinnerTop() { return isDarkTheme ? "#C4A35A" : "#8C6B2A"; },

  // Blue Accent Status Colors (Notifications/Done states)
  get blue() { return isDarkTheme ? "#6CA0E6" : "#5B8FD4"; },
  get blueFaint() { return isDarkTheme ? "rgba(108,160,230,0.08)" : "rgba(91,143,212,0.08)"; },
  get blueBorder() { return isDarkTheme ? "rgba(108,160,230,0.20)" : "rgba(91,143,212,0.20)"; },

  // Blurs & Overlays
  get bgFilter() { return isDarkTheme ? "blur(6px) brightness(0.35) saturate(0.5)" : "blur(6px) brightness(0.45) saturate(0.4)"; },
  get bgOverlay() { return isDarkTheme ? "rgba(10,9,8,0.75)" : "rgba(237,233,224,0.65)"; }
};

export const F = {
  display: "'Inter','Helvetica Neue',Arial,sans-serif",
  body: "'Inter','Helvetica Neue',Arial,sans-serif",
  mono: "'Inter','Helvetica Neue',Arial,sans-serif",
  label: "'Inter','Helvetica Neue',Arial,sans-serif",
};

export const AdminThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem("bellevue-admin-theme");
      const val = saved === "dark";
      isDarkTheme = val;
      return val;
    } catch {
      isDarkTheme = false;
      return false;
    }
  });
  
  isDarkTheme = isDark;


  const toggleTheme = () => {
    setIsDark((prev) => {
      const newVal = !prev;
      isDarkTheme = newVal;
      try {
        localStorage.setItem("bellevue-admin-theme", newVal ? "dark" : "light");
      } catch {}
      return newVal;
    });
  };

  useEffect(() => {
    isDarkTheme = isDark;
    if (isDark) {
      document.body.classList.add("bellevue-admin-dark");
      document.body.classList.remove("bellevue-admin-light");
    } else {
      document.body.classList.add("bellevue-admin-light");
      document.body.classList.remove("bellevue-admin-dark");
    }
  }, [isDark]);

  return (
    <AdminThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </AdminThemeContext.Provider>
  );
};
