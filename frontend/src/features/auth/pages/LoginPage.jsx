import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../../../services/authAPI";
import bellevueLogo from "../../../assets/bellevue-logo.png";
import grandBallroomShowcase from "../../../assets/grand-ballroom-hires.jpg";
import TowerroomShowcase from "../../../assets/tower-ballroom-hires.jpg";
const F = {
  display: "'Inter','Helvetica Neue',Arial,sans-serif",
  body: "'Inter','Helvetica Neue',Arial,sans-serif",
  mono: "'DM Mono','Courier New',monospace",
  label: "'Inter','Helvetica Neue',Arial,sans-serif",
};

function ThemeToggle({ isDark, toggle, C }) {
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        border: `1px solid ${C.goldBorder}`,
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(140, 107, 42, 0.04)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0, // KEY FIX: overrides global button padding
        color: C.gold,
        transition: "all 0.2s ease",
        outline: "none"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = C.gold;
        e.currentTarget.style.background = isDark ? "rgba(196, 163, 90, 0.10)" : "rgba(140, 107, 42, 0.08)";
        e.currentTarget.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.goldBorder;
        e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.04)" : "rgba(140, 107, 42, 0.04)";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {isDark ? (
        /* Sun Icon when dark */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon Icon when light */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function LoginScreen({ onLogin }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      return localStorage.getItem("bellevue_remember_username") || "";
    } catch {
      return "";
    }
  });
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Light mode by default as requested
  const [formMode, setFormMode] = useState("login"); // 'login' | 'forgot' | 'forgot_success'
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [focusedField, setFocusedField] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem("bellevue_remember_me") === "true";
    } catch {
      return false;
    }
  });

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
        imageOverlay: "linear-gradient(to top, rgba(17, 16, 13, 0.70) 0%, rgba(17, 16, 13, 0.5) 50%, rgba(17, 16, 13, 0.1) 100%)",


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
        //imageOverlay: "transparent",
        imageOverlay: "linear-gradient(to top, rgba(17, 16, 13, 0.50) 0%, rgba(17, 16, 13, 0.45) 50%, rgba(17, 16, 13, 0.05) 100%)", // bottom-heavy gradient
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
        try {
          if (rememberMe) {
            localStorage.setItem("bellevue_remember_username", user);
            localStorage.setItem("bellevue_remember_me", "true");
          } else {
            localStorage.removeItem("bellevue_remember_username");
            localStorage.setItem("bellevue_remember_me", "false");
          }
        } catch (e) {
          console.warn("Storage error in LoginScreen", e);
        }

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

  const handleForgotPassword = async (event) => {
    if (event) event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await authAPI.requestPasswordReset(resetEmail);

      if (response.success) {
        setFormMode("forgot_success");
      } else {
        setError(response.message || "Failed to request password reset. Please try again.");
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      setError("Unable to connect to the authentication server. Please check your network.");
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
    border: `1.5px solid ${error
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

        @media (min-width: 821px) {
          html, body, #root, main {
            height: 100vh !important;
            overflow: hidden !important;
          }
        }

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
          grid-template-columns: 65% 35%;
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
            grid-template-columns: 60% 40%;
          }
        }

        @media (max-width: 1024px) {
          .login-grid {
            grid-template-columns: 55% 45%;
          }
        }

        @media (max-width: 880px) {
          .login-grid {
            grid-template-columns: 50% 50%;
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
          //style={{ backgroundImage: `url(${grandBallroomShowcase})` }}
          style={{ backgroundImage: `url(${TowerroomShowcase})` }}
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


        </aside>

        {/* Right Side: 35% Clean minimal sign-in form panel */}
        <section
          className="login-form-panel"
          style={{
            background: isDark
              ? "radial-gradient(circle at center, #1A1916 0%, #11100D 100%)"
              : "radial-gradient(circle at center, #FFFFFF 0%, #FAF8F4 100%)",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Watermark wrapper to prevent scrollbars */}
          <div style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 0
          }}>
            <img
              src={bellevueLogo}
              alt=""
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%) scale(2.2)",
                opacity: isDark ? 0.015 : 0.02,
                filter: "grayscale(100%)",
              }}
            />
          </div>

          <div style={{
            width: "100%",
            maxWidth: 380,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "space-between",
            boxSizing: "border-box",
            position: "relative",
            zIndex: 2,
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
                  height: 30,
                  width: "auto",
                  objectFit: "contain",
                  filter: isDark
                    ? "brightness(0) saturate(100%) invert(82%) sepia(18%) saturate(350%) hue-rotate(2deg)"
                    : "brightness(0) saturate(100%) invert(20%) sepia(30%) saturate(600%) hue-rotate(8deg)", // premium luxury filter in light mode
                }}
              />
              <ThemeToggle isDark={isDark} toggle={() => setIsDark(!isDark)} C={C} />
            </div>

            {/* Form Block centered in the column inside an elegant luxury card */}
            <div style={{
              width: "100%",
              margin: "auto 0",
              animation: "fadeUp 0.5s ease",
              background: isDark ? "rgba(17, 15, 11, 0.65)" : "rgba(255, 255, 255, 0.75)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(140, 107, 42, 0.07)"}`,
              borderRadius: 16,
              padding: "28px 24px",
              boxShadow: isDark
                ? "0 20px 40px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255,255,255,0.03)"
                : "0 20px 40px rgba(140, 107, 42, 0.03)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxSizing: "border-box"
            }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 18, height: 1, background: C.gold, opacity: 0.7 }} />
                  <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.22em", color: C.gold, textTransform: "uppercase", fontFamily: F.label }}>
                    {formMode === "login" ? "Admin Portal" : "Account Recovery"}
                  </span>
                </div>
                <h1 style={{
                  margin: formMode === "login" ? "0" : "0 0 10px",
                  fontSize: 32,
                  lineHeight: 1.1,
                  fontWeight: 600,
                  fontFamily: F.display,
                  color: C.textPrimary,
                  letterSpacing: "0.01em"
                }}>
                  {formMode === "login" ? "Sign In" : formMode === "forgot" ? "Reset Password" : "Check Your Email"}
                </h1>
                {formMode !== "login" && (
                  <p style={{ margin: 0, color: C.textSecondary, fontSize: 13, lineHeight: 1.62 }}>
                    {formMode === "forgot"
                      ? "Enter your registered email address below, and we will send you a secure link to reset your password."
                      : `A password reset link has been dispatched to ${resetEmail}. Please check your inbox and follow the instructions.`
                    }
                  </p>
                )}
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

              {formMode === "login" && (
                <form onSubmit={handle}>
                  <div style={{ display: "grid", gap: 16, marginBottom: 16 }}>
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

                  {/* Remember Me & Forgot Password Row */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 12,
                    marginBottom: 20,
                    userSelect: "none"
                  }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        style={{ display: "none" }}
                      />
                      <div style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: `1.5px solid ${rememberMe ? C.gold : C.inputBorder}`,
                        background: rememberMe ? C.gold : C.inputBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease"
                      }}>
                        {rememberMe && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke={C.buttonText} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 4 7 9 1" />
                          </svg>
                        )}
                      </div>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: C.textSecondary,
                        fontFamily: F.body
                      }}>
                        Remember me
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setFormMode("forgot");
                        setError("");
                      }}
                      tabIndex={-1}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        color: C.gold,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: F.body,
                        transition: "color 0.2s ease",
                        outline: "none"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = C.goldLight}
                      onMouseLeave={(e) => e.currentTarget.style.color = C.gold}
                    >
                      Forgot password?
                    </button>
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
              )}

              {formMode === "forgot" && (
                <form onSubmit={handleForgotPassword}>
                  <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
                    <label style={{ display: "block" }}>
                      <span style={{
                        display: "block",
                        marginBottom: 7,
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: error ? C.errorText : focusedField === "resetEmail" ? C.gold : C.textMuted
                      }}>
                        Email Address
                      </span>
                      <input
                        style={inputStyle("resetEmail")}
                        type="email"
                        disabled={loading}
                        value={resetEmail}
                        onFocus={() => setFocusedField("resetEmail")}
                        onBlur={() => setFocusedField("")}
                        onChange={(event) => { setResetEmail(event.target.value); setError(""); }}
                        placeholder="Enter registered email"
                        autoComplete="email"
                        required
                      />
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
                      outline: "none",
                      marginBottom: 16
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
                    {loading ? "Sending..." : "Send Reset Link"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormMode("login");
                      setError("");
                    }}
                    style={{
                      width: "100%",
                      padding: "13px 16px",
                      border: `1.5px solid ${C.goldBorder}`,
                      borderRadius: 8,
                      background: "transparent",
                      color: C.gold,
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      transition: "all 0.20s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      outline: "none"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(140, 107, 42, 0.05)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Back to Sign In
                  </button>
                </form>
              )}

              {formMode === "forgot_success" && (
                <div style={{ animation: "fadeUp 0.3s ease" }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "rgba(46,122,90,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 24px",
                    color: "#2E7A5A",
                    border: "1.5px solid rgba(46,122,90,0.18)"
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFormMode("login");
                      setResetEmail("");
                      setError("");
                    }}
                    style={{
                      width: "100%",
                      padding: "13px 16px",
                      border: `1.5px solid ${C.goldBorder}`,
                      borderRadius: 8,
                      background: "transparent",
                      color: C.gold,
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      transition: "all 0.20s ease",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      outline: "none"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(140, 107, 42, 0.05)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Back to Sign In
                  </button>
                </div>
              )}
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
