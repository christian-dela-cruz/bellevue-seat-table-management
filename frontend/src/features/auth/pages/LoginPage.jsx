import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../../../services/authAPI";
import bellevueLogo from "../../../assets/bellevue-logo.png";
import grandBallroomShowcase from "../../../assets/grand-ballroom-hires.jpg";

const F = {
  display: "'Playfair Display','Georgia',serif",
  body:    "'Inter','Helvetica Neue',Arial,sans-serif",
  mono:    "'DM Mono','Courier New',monospace",
  label:   "'Inter','Helvetica Neue',Arial,sans-serif",
};

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
        outline: "none"
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
          <svg viewBox="0 0 24 24" role="presentation" style={{ width: "100%", height: "100%", fill: "currentColor", stroke: "none" }}>
            <path d="M20.3 15.4A7.8 7.8 0 0 1 8.6 3.7a8.2 8.2 0 1 0 11.7 11.7Z" />
          </svg>
        </span>
        <span style={{ width: 14, height: 14, color: isDark ? "rgba(255,250,241,0.42)" : "rgba(74,60,39,0.70)", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "color 0.25s ease" }}>
          <svg viewBox="0 0 24 24" role="presentation" style={{ width: "100%", height: "100%" }} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
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
            boxSizing: "border-box"
          }}
        >
          {isDark ? (
            <svg viewBox="0 0 24 24" role="presentation" style={{ width: "100%", height: "100%", fill: "currentColor", stroke: "none" }}>
              <path d="M20.3 15.4A7.8 7.8 0 0 1 8.6 3.7a8.2 8.2 0 1 0 11.7 11.7Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" role="presentation" style={{ width: "100%", height: "100%" }} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
            </svg>
          )}
        </span>
      </span>
    </button>
  );
}

function LoginScreen({ onLogin }) {
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Light mode by default as requested
  const [isDark, setIsDark] = useState(false);
  const [focusedField, setFocusedField] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const C = useMemo(() => {
    return isDark
      ? {
          pageBg: "#11100D", // Warm obsidian dark surface
          formPanelBg: "#11100D",
          textPrimary: "#EDE8DF",
          textSecondary: "#A39C90",
          textMuted: "#6E685D",
          inputBg: "#1A1916",
          inputBorder: "rgba(255, 255, 255, 0.08)",
          goldBorder: "rgba(196, 163, 90, 0.20)",
          gold: "#C4A35A",
          goldLight: "#D9BC7A",
          goldDeep: "#A47821",
          buttonText: "#0C0B08",
          buttonShadow: "none",
          divider: "rgba(255,255,255,0.06)",
          errorBg: "rgba(184,92,92,0.08)",
          errorBorder: "rgba(184,92,92,0.18)",
          errorText: "#D47777",
          focusShadow: "0 0 0 3px rgba(196,163,90,0.12)",
          imageOverlay: "linear-gradient(to top, rgba(17, 16, 13, 0.95) 0%, rgba(17, 16, 13, 0.5) 50%, rgba(17, 16, 13, 0.1) 100%)",
        }
      : {
          pageBg: "#FAF9F6", // Warm premium off-white/ivory
          formPanelBg: "#FFFFFF",
          textPrimary: "#18140E",
          textSecondary: "#4A4238",
          textMuted: "#8C8273",
          inputBg: "#FAF8F5", // warm off-white / light cream surface consistent with the system
          inputBorder: "rgba(140, 107, 42, 0.15)", // soft neutral border instead of default browser styles
          goldBorder: "rgba(140, 107, 42, 0.18)",
          gold: "#8C6B2A",
          goldLight: "#A07D38",
          goldDeep: "#6B5020",
          buttonText: "#FFFFFF",
          buttonShadow: "0 10px 24px rgba(140,107,42,0.16)",
          divider: "rgba(0,0,0,0.05)",
          errorBg: "rgba(160,56,56,0.06)",
          errorBorder: "rgba(160,56,56,0.15)",
          errorText: "#A03838",
          focusShadow: "0 0 0 3px rgba(140,107,42,0.12)", // glowing gold accent focus ring
          imageOverlay: "linear-gradient(to top, rgba(17, 16, 13, 0.92) 0%, rgba(17, 16, 13, 0.45) 50%, rgba(17, 16, 13, 0.05) 100%)", // bottom-heavy gradient
        };
  }, [isDark]);

  const handle = async (event) => {
    if (event) event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await authAPI.login({ username: user, password: pass });

      if (response.success) {
        if (typeof onLogin === "function") {
          onLogin(response.admin);
        } else {
          navigate("/admin/reservations", { replace: true });
        }
      } else {
        setError(response.message || "Invalid username or password. Please try again.");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Unable to connect to the authentication server. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 16px",
    paddingRight: field === "pass" ? "48px" : "16px", // prevent text overlap with eye icon
    borderRadius: 8,
    border: `1.5px solid ${
      error 
        ? C.errorBorder 
        : focusedField === field 
          ? C.gold 
          : C.inputBorder
    }`,
    background: C.inputBg,
    color: C.textPrimary,
    fontSize: 14,
    fontFamily: F.body,
    outline: "none",
    transition: "all 0.22s ease",
    boxShadow: focusedField === field 
      ? C.focusShadow 
      : error 
        ? "0 0 0 3px rgba(160,56,56,0.08)" 
        : "none",
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.pageBg,
        color: C.textPrimary,
        display: "flex",
        flexDirection: "column",
        fontFamily: F.body,
        position: "relative",
        transition: "all 0.3s ease",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@400;600;700&display=swap');
        @keyframes loginSpin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }

        /* Custom Autofill Styles to override pale blue autofill background */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px ${isDark ? "#1A1916" : "#FAF8F5"} inset !important;
          -webkit-text-fill-color: ${isDark ? "#EDE8DF" : "#18140E"} !important;
          transition: background-color 5000s ease-in-out 0s;
        }

        .login-grid {
          display: grid;
          grid-template-columns: 70% 30%;
          min-height: 100vh;
          width: 100%;
        }

        .login-visual-panel {
          position: relative;
          background-size: cover;
          background-position: center;
          height: 100vh;
          display: flex;
          align-items: flex-end;
          padding: 60px 48px;
          box-sizing: border-box;
          animation: slideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .login-form-panel {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 40px clamp(20px, 3vw, 48px);
          box-sizing: border-box;
          height: 100vh;
          overflow-y: auto;
          position: relative;
        }

        @media (max-width: 1280px) {
          .login-grid {
            grid-template-columns: 65% 35%;
          }
        }

        @media (max-width: 1024px) {
          .login-grid {
            grid-template-columns: 60% 40%;
          }
        }

        @media (max-width: 880px) {
          .login-grid {
            grid-template-columns: 55% 45%;
          }
        }

        @media (max-width: 820px) {
          .login-grid {
            display: flex;
            flex-direction: column;
            height: auto;
            min-height: 100vh;
          }
          .login-visual-panel {
            height: 200px;
            padding: 24px;
            align-items: center;
          }
          .login-form-panel {
            height: auto;
            min-height: calc(100vh - 200px);
            padding: 32px 24px;
          }
        }

        @media (max-width: 640px) {
          .login-visual-desc {
            display: none;
          }
        }
      `}</style>

      <div className="login-grid">
        {/* Left Side: 70% Luxury visual showcase panel */}
        <aside 
          className="login-visual-panel" 
          style={{ backgroundImage: `url(${grandBallroomShowcase})` }}
          aria-hidden="true"
        >
          {/* Subtle luxurious overlay */}
          <div 
            style={{ 
              position: "absolute", 
              inset: 0, 
              background: C.imageOverlay, 
              transition: "background 0.3s ease",
              zIndex: 1 
            }} 
          />

          <div style={{ position: "relative", zIndex: 2, maxWidth: 480 }}>
            <span style={{ 
              fontFamily: F.label, 
              fontSize: 9, 
              fontWeight: 800, 
              letterSpacing: "0.26em", 
              color: "#C4A35A", 
              textTransform: "uppercase", 
              display: "block", 
              marginBottom: 8 
            }}>
              The Bellevue Manila
            </span>
            
            <h2 style={{ 
              fontFamily: F.display, 
              fontSize: "clamp(26px, 3vw, 38px)", 
              color: "#FFFFFF", 
              fontWeight: 600, 
              lineHeight: 1.15, 
              margin: "0 0 12px" 
            }}>
              Reservation Operations Portal
            </h2>
            
            <p className="login-visual-desc" style={{ 
              color: "rgba(255,255,255,0.75)", 
              fontSize: 13.5, 
              lineHeight: 1.6, 
              margin: 0 
            }}>
              Manage reservations, venues, seating, and daily service flow.
            </p>
          </div>
        </aside>

        {/* Right Side: 30% Clean minimal sign-in form panel */}
        <section 
          className="login-form-panel"
          style={{ background: C.formPanelBg }}
        >
          <div style={{
            width: "100%",
            maxWidth: 380,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "space-between",
            boxSizing: "border-box"
          }}>
            {/* Header Row (Logo + Theme Toggle) aligned to form grid */}
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              width: "100%", 
              marginBottom: 32,
              animation: "fadeUp 0.4s ease"
            }}>
              <img
                src={bellevueLogo}
                alt="The Bellevue Manila"
                style={{
                  height: 30, // Increased size slightly as requested
                  width: "auto",
                  objectFit: "contain",
                  filter: isDark 
                    ? "brightness(0) saturate(100%) invert(82%) sepia(18%) saturate(350%) hue-rotate(2deg)" 
                    : "brightness(0) saturate(100%) invert(20%) sepia(30%) saturate(600%) hue-rotate(8deg)", // premium luxury filter in light mode
                }}
              />
              <ThemeToggle isDark={isDark} toggle={() => setIsDark(!isDark)} C={C} />
            </div>

            {/* Form Block centered in the column */}
            <div style={{ 
              width: "100%", 
              margin: "auto 0",
              animation: "fadeUp 0.5s ease"
            }}>
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 18, height: 1, background: C.gold, opacity: 0.7 }} />
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.22em", color: C.gold, textTransform: "uppercase", fontFamily: F.label }}>
                    Admin Portal
                  </span>
                </div>
                <h1 style={{ 
                  margin: "0 0 10px", 
                  fontSize: 32, 
                  lineHeight: 1.1, 
                  fontWeight: 600, 
                  fontFamily: F.display, 
                  color: C.textPrimary,
                  letterSpacing: "0.01em"
                }}>
                  Seat & Table Management
                </h1>
                <p style={{ margin: 0, color: C.textSecondary, fontSize: 13, lineHeight: 1.62 }}>
                  Sign in to manage reservations, outlets, venues, reports, and daily operations.
                </p>
              </div>

              {/* Error States */}
              {error && (
                <div
                  style={{
                    marginBottom: 20,
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: C.errorBg,
                    border: `1.5px solid ${C.errorBorder}`,
                    color: C.errorText,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    animation: "fadeUp 0.2s ease"
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handle}>
                <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
                  <label style={{ display: "block" }}>
                    <span style={{ 
                      display: "block", 
                      marginBottom: 7, 
                      fontSize: 9.5, 
                      fontWeight: 700, 
                      letterSpacing: "0.14em", 
                      textTransform: "uppercase", 
                      color: error ? C.errorText : focusedField === "user" ? C.gold : C.textMuted 
                    }}>
                      Username or Email
                    </span>
                    <input
                      style={inputStyle("user")}
                      type="text"
                      disabled={loading}
                      value={user}
                      onFocus={() => setFocusedField("user")}
                      onBlur={() => setFocusedField("")}
                      onChange={(event) => { setUser(event.target.value); setError(""); }}
                      placeholder="Enter username"
                      autoComplete="username"
                      required
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <span style={{ 
                      display: "block", 
                      marginBottom: 7, 
                      fontSize: 9.5, 
                      fontWeight: 700, 
                      letterSpacing: "0.14em", 
                      textTransform: "uppercase", 
                      color: error ? C.errorText : focusedField === "pass" ? C.gold : C.textMuted 
                    }}>
                      Password
                    </span>
                    
                    {/* Password with visibility eye toggle */}
                    <div style={{ position: "relative" }}>
                      <input
                        style={inputStyle("pass")}
                        type={showPassword ? "text" : "password"}
                        disabled={loading}
                        value={pass}
                        onFocus={() => setFocusedField("pass")}
                        onBlur={() => setFocusedField("")}
                        onChange={(event) => { setPass(event.target.value); setError(""); }}
                        placeholder="Enter password"
                        autoComplete="current-password"
                        required
                      />
                      
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: "absolute",
                          right: 14,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "transparent",
                          border: "none",
                          cursor: loading ? "not-allowed" : "pointer",
                          color: C.textSecondary,
                          opacity: 0.6,
                          padding: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          outline: "none",
                          transition: "opacity 0.2s ease"
                        }}
                        onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = 1; }}
                        onMouseLeave={e => { if (!loading) e.currentTarget.style.opacity = 0.6; }}
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "13px 16px",
                    border: "none",
                    borderRadius: 8,
                    background: loading ? C.goldDeep : C.gold,
                    color: C.buttonText,
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "all 0.20s ease",
                    boxShadow: loading ? "none" : C.buttonShadow,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    outline: "none"
                  }}
                  onMouseEnter={(event) => { if (!loading) event.currentTarget.style.background = C.goldLight; }}
                  onMouseLeave={(event) => { if (!loading) event.currentTarget.style.background = C.gold; }}
                >
                  {loading && (
                    <span
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: "50%",
                        border: "1.5px solid rgba(255,255,255,0.2)",
                        borderTopColor: C.buttonText,
                        display: "inline-block",
                        animation: "loginSpin 0.75s linear infinite",
                      }}
                    />
                  )}
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
            </div>

            {/* Footer Row aligned to form column */}
            <footer style={{ 
              fontSize: 11, 
              color: C.textMuted, 
              letterSpacing: "0.02em", 
              borderTop: `1px solid ${C.divider}`, 
              paddingTop: 16,
              marginTop: 32,
              animation: "fadeUp 0.6s ease"
            }}>
              © {new Date().getFullYear()} The Bellevue Manila. All rights reserved.
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}

export default LoginScreen;
