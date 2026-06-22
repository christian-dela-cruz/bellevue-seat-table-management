import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { authAPI } from "../../../services/authAPI";
import bellevueLogo from "../../../assets/bellevue-logo.png";
import grandBallroomShowcase from "../../../assets/grand-ballroom-hires.jpg";

const F = {
  display: "'Inter','Helvetica Neue',Arial,sans-serif",
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
            ? "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(196,163,90,0.14)), rgba(10,8,6,0.24)"
            : "linear-gradient(135deg, rgba(164,120,33,0.10), rgba(255,255,255,0.62)), rgba(255,252,246,0.82)",
          boxShadow: isDark
            ? "inset 0 0 0 1px rgba(255,255,255,0.13)"
            : "inset 0 0 0 1px rgba(164,120,33,0.16)",
          overflow: "hidden",
          transition: "box-shadow 0.25s ease, background 0.25s ease",
        }}
      >
        <span style={{ width: 14, height: 14, color: isDark ? "rgba(255,255,255,0.72)" : "rgba(74,60,39,0.34)", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "color 0.25s ease" }}>
          <svg viewBox="0 0 24 24" role="presentation" style={{ width: "100%", height: "100%", fill: "currentColor", stroke: "none" }}>
            <path d="M20.3 15.4A7.8 7.8 0 0 1 8.6 3.7a8.2 8.2 0 1 0 11.7 11.7Z" />
          </svg>
        </span>
        <span style={{ width: 14, height: 14, color: isDark ? "rgba(255,255,255,0.42)" : "rgba(74,60,39,0.70)", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "color 0.25s ease" }}>
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

export default function ActivateAccount() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [checking, setChecking] = useState(true);
  const [invitedUser, setInvitedUser] = useState(null);
  const [tokenError, setTokenError] = useState("");
  
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  
  const [focusedField, setFocusedField] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const isResetMode = useMemo(() => {
    return new URLSearchParams(window.location.search).get("reset") === "1";
  }, []);

  const C = useMemo(() => {
    return isDark
      ? {
          pageBg: "#11100D",
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
          pageBg: "#FAF9F6",
          formPanelBg: "#FFFFFF",
          textPrimary: "#18140E",
          textSecondary: "#4A4238",
          textMuted: "#8C8273",
          inputBg: "#FAF8F5",
          inputBorder: "rgba(140, 107, 42, 0.15)",
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
          focusShadow: "0 0 0 3px rgba(140,107,42,0.12)",
          imageOverlay: "linear-gradient(to top, rgba(17, 16, 13, 0.92) 0%, rgba(17, 16, 13, 0.45) 50%, rgba(17, 16, 13, 0.05) 100%)",
        };
  }, [isDark]);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const res = await authAPI.getActivationDetails(token);
        if (res.success && res.data) {
          setInvitedUser(res.data);
        } else {
          setTokenError(res.message || "Invalid or expired invitation link.");
        }
      } catch (err) {
        setTokenError("Failed to verify activation token. It may be invalid or expired.");
      } finally {
        setChecking(false);
      }
    };
    verifyToken();
  }, [token]);

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: "None", color: "#666" };
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 1) return { score, label: "Weak", color: C.errorText || "#A03838" };
    if (score <= 3) return { score, label: "Good", color: C.gold || "#8C6B2A" };
    return { score, label: "Strong", color: "#2E7A5A" };
  }, [password, C]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await authAPI.activateAccount(token, {
        password: password,
        password_confirmation: passwordConfirmation
      });

      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.message || "Failed to activate account. Try again.");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = (field) => ({
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 16px",
    paddingRight: field === "pass" ? "48px" : "16px",
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
        @keyframes activateSpin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }

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

        @media (max-width: 1280px) { .login-grid { grid-template-columns: 65% 35%; } }
        @media (max-width: 1024px) { .login-grid { grid-template-columns: 60% 40%; } }
        @media (max-width: 880px) { .login-grid { grid-template-columns: 55% 45%; } }
        @media (max-width: 820px) {
          .login-grid { display: flex; flex-direction: column; height: auto; min-height: 100vh; }
          .login-visual-panel { height: 200px; padding: 24px; align-items: center; }
          .login-form-panel { height: auto; min-height: calc(100vh - 200px); padding: 32px 24px; }
        }
      `}</style>

      <div className="login-grid">
        {/* Left Visual side */}
        <aside 
          className="login-visual-panel" 
          style={{ backgroundImage: `url(${grandBallroomShowcase})` }}
          aria-hidden="true"
        >
          <div style={{ position: "absolute", inset: 0, background: C.imageOverlay, transition: "background 0.3s ease", zIndex: 1 }} />

        </aside>

        {/* Right Form panel */}
        <section className="login-form-panel" style={{ background: C.formPanelBg }}>
          <div style={{ width: "100%", maxWidth: 380, margin: "0 auto", display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", boxSizing: "border-box" }}>
            
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 32, animation: "fadeUp 0.4s ease" }}>
              <img
                src={bellevueLogo}
                alt="The Bellevue Manila"
                style={{
                  height: 30,
                  width: "auto",
                  objectFit: "contain",
                  filter: isDark 
                    ? "brightness(0) saturate(100%) invert(82%) sepia(18%) saturate(350%) hue-rotate(2deg)" 
                    : "brightness(0) saturate(100%) invert(20%) sepia(30%) saturate(600%) hue-rotate(8deg)",
                }}
              />
              <ThemeToggle isDark={isDark} toggle={() => setIsDark(!isDark)} C={C} />
            </div>

            {/* Content Switcher */}
            <div style={{ width: "100%", margin: "auto 0", animation: "fadeUp 0.5s ease" }}>
              {checking ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      border: `3px solid ${C.gold}33`,
                      borderTopColor: C.gold,
                      display: "inline-block",
                      animation: "activateSpin 0.75s linear infinite",
                    }}
                  />
                  <p style={{ marginTop: 14, color: C.textSecondary, fontSize: 13 }}>Verifying invitation details...</p>
                </div>
              ) : tokenError ? (
                /* Token Error State */
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.errorBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: C.errorText, border: `1.5px solid ${C.errorBorder}` }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <h2 style={{ fontFamily: F.display, fontSize: 24, fontWeight: 600, color: C.textPrimary, margin: "0 0 10px" }}>Invitation Expired</h2>
                  <p style={{ color: C.textSecondary, fontSize: 13.5, lineHeight: 1.6, marginBottom: 24 }}>
                    {tokenError} Invitation links are single-use and expire after 48 hours for security purposes.
                  </p>
                  <button
                    onClick={() => navigate("/login")}
                    style={{ width: "100%", padding: "12px", border: `1.5px solid ${C.goldBorder}`, borderRadius: 8, background: "transparent", color: C.gold, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.goldFaint; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Back to Login
                  </button>
                </div>
              ) : success ? (
                /* Activation Success State */
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(46,122,90,0.08)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", color: "#2E7A5A", border: "1.5px solid rgba(46,122,90,0.18)" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 600, color: C.textPrimary, margin: "0 0 8px" }}>
                    {isResetMode ? "Password Reset Complete" : "Account Activated"}
                  </h2>
                  <p style={{ color: C.textSecondary, fontSize: 13.5, lineHeight: 1.6, marginBottom: 28 }}>
                    {isResetMode
                      ? <>Your password has been successfully configured. You can now log into your administration dashboard using your username <strong>@{invitedUser?.username}</strong>.</>
                      : <>Welcome to the team, <strong>{invitedUser?.name}</strong>! Your password has been successfully configured. You can now log into your administration dashboard.</>
                    }
                  </p>
                  <button
                    onClick={() => navigate("/login")}
                    style={{ width: "100%", padding: "13px 16px", border: "none", borderRadius: 8, background: C.gold, color: C.buttonText, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.goldLight; }}
                    onMouseLeave={e => { e.currentTarget.style.background = C.gold; }}
                  >
                    Proceed to Login
                  </button>
                </div>
              ) : (
                /* Form Setup State */
                <div>
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ width: 18, height: 1, background: C.gold, opacity: 0.7 }} />
                      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.22em", color: C.gold, textTransform: "uppercase", fontFamily: F.label }}>
                        {isResetMode ? "Password Recovery" : "New Account Activation"}
                      </span>
                    </div>
                    <h1 style={{ margin: "0 0 10px", fontSize: 30, lineHeight: 1.15, fontWeight: 600, fontFamily: F.display, color: C.textPrimary }}>
                      {isResetMode ? "Reset Password" : <>Hello, {invitedUser?.name}</>}
                    </h1>
                    <p style={{ margin: 0, color: C.textSecondary, fontSize: 13.5, lineHeight: 1.55 }}>
                      {isResetMode
                        ? <>Please set up a new secure password for your administrative username <strong>@{invitedUser?.username}</strong>.</>
                        : <>Please set up a strong password for your staff username <strong>@{invitedUser?.username}</strong>.</>
                      }
                    </p>
                  </div>

                  {error && (
                    <div style={{ marginBottom: 18, padding: "12px 14px", borderRadius: 8, background: C.errorBg, border: `1.5px solid ${C.errorBorder}`, color: C.errorText, fontSize: 12.5, display: "flex", alignItems: "center", gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    <div style={{ display: "grid", gap: 16, marginBottom: 22 }}>
                      <label style={{ display: "block" }}>
                        <span style={{ display: "block", marginBottom: 7, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: focusedField === "pass" ? C.gold : C.textMuted }}>
                          Password
                        </span>
                        <div style={{ position: "relative" }}>
                          <input
                            style={inputStyle("pass")}
                            type={showPassword ? "text" : "password"}
                            disabled={saving}
                            value={password}
                            onFocus={() => setFocusedField("pass")}
                            onBlur={() => setFocusedField("")}
                            onChange={(e) => { setPassword(e.target.value); setError(""); }}
                            placeholder="Enter secure password"
                            required
                          />
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => setShowPassword(!showPassword)}
                            style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: C.textSecondary, opacity: 0.6, padding: 4, display: "flex", outline: "none" }}
                          >
                            {showPassword ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            )}
                          </button>
                        </div>
                      </label>

                      {/* Password strength meter */}
                      {password && (
                        <div style={{ marginTop: -8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, marginBottom: 5 }}>
                            <span style={{ color: C.textSecondary }}>Strength: <strong style={{ color: passwordStrength.color }}>{passwordStrength.label}</strong></span>
                            <span style={{ color: C.textMuted }}>Min. 8 characters</span>
                          </div>
                          <div style={{ height: 4, width: "100%", background: C.divider, borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(passwordStrength.score / 5) * 100}%`, background: passwordStrength.color, transition: "all 0.3s ease" }} />
                          </div>
                        </div>
                      )}

                      <label style={{ display: "block" }}>
                        <span style={{ display: "block", marginBottom: 7, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: focusedField === "confirm" ? C.gold : C.textMuted }}>
                          Confirm Password
                        </span>
                        <input
                          style={inputStyle("confirm")}
                          type="password"
                          disabled={saving}
                          value={passwordConfirmation}
                          onFocus={() => setFocusedField("confirm")}
                          onBlur={() => setFocusedField("")}
                          onChange={(e) => { setPasswordConfirmation(e.target.value); setError(""); }}
                          placeholder="Re-enter password"
                          required
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={saving || password.length < 8}
                      style={{
                        width: "100%",
                        padding: "13px 16px",
                        border: "none",
                        borderRadius: 8,
                        background: saving || password.length < 8 ? C.goldDeep : C.gold,
                        color: C.buttonText,
                        fontSize: 10.5,
                        fontWeight: 800,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        cursor: saving || password.length < 8 ? "not-allowed" : "pointer",
                        transition: "all 0.20s ease",
                        boxShadow: saving ? "none" : C.buttonShadow,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        outline: "none"
                      }}
                      onMouseEnter={(event) => { if (!saving && password.length >= 8) event.currentTarget.style.background = C.goldLight; }}
                      onMouseLeave={(event) => { if (!saving && password.length >= 8) event.currentTarget.style.background = C.gold; }}
                    >
                      {saving && (
                        <span
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: "50%",
                            border: "1.5px solid rgba(255,255,255,0.2)",
                            borderTopColor: C.buttonText,
                            display: "inline-block",
                            animation: "activateSpin 0.75s linear infinite",
                          }}
                        />
                      )}
                      {saving 
                        ? (isResetMode ? "Resetting password..." : "Activating account...") 
                        : (isResetMode ? "Reset Password" : "Activate Account")
                      }
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Footer Row */}
            <footer style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.02em", borderTop: `1px solid ${C.divider}`, paddingTop: 16, marginTop: 32, animation: "fadeUp 0.6s ease" }}>
              © {new Date().getFullYear()} The Bellevue Manila. All rights reserved.
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
