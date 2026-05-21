import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authAPI } from "../../../services/authAPI";
import loginBg from "../../../assets/bg-login.jpeg";
import bellevueLogo from "../../../assets/bellevue-logo.png";
import grandBallroomShowcase from "../../../assets/grand-ballroom-hires.jpg";
import diningShowcase from "../../../assets/hanakazu-dining-hires.jpg";
import towerShowcase from "../../../assets/tower-ballroom-hires.jpg";
import SharedNavbar from "../../../components/SharedNavbar.jsx";

function LoginScreen({ onLogin }) {
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [focusedField, setFocusedField] = useState("");

  const C = isDark
    ? {
        pageBg: "#0A0908",
        panelBg: "linear-gradient(145deg, rgba(255,250,241,0.075), rgba(255,250,241,0.025)), rgba(17,16,9,0.72)",
        panelBorder: "rgba(255,250,241,0.13)",
        panelShadow: "0 28px 70px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)",
        textPrimary: "#EDE8DF",
        textSecondary: "rgba(237,232,223,0.68)",
        textMuted: "rgba(237,232,223,0.42)",
        inputBg: "rgba(255,250,241,0.055)",
        inputBorder: "rgba(255,255,255,0.10)",
        gold: "#C4A35A",
        goldLight: "#D9BC7A",
        goldDeep: "#A47821",
        buttonText: "#0A0908",
        overlay: "radial-gradient(circle at 22% 42%, rgba(196,163,90,0.11), transparent 34%), linear-gradient(135deg, rgba(10,9,8,0.82), rgba(10,9,8,0.56))",
      }
    : {
        pageBg: "#F7F4EE",
        panelBg: "linear-gradient(145deg, rgba(255,255,255,0.88), rgba(255,250,241,0.66)), rgba(255,255,255,0.64)",
        panelBorder: "rgba(140,107,42,0.17)",
        panelShadow: "0 28px 70px rgba(78,60,32,0.16), inset 0 1px 0 rgba(255,255,255,0.72)",
        textPrimary: "#18140E",
        textSecondary: "rgba(24,20,14,0.68)",
        textMuted: "rgba(24,20,14,0.42)",
        inputBg: "rgba(255,255,255,0.76)",
        inputBorder: "rgba(24,20,14,0.10)",
        gold: "#8C6B2A",
        goldLight: "#A07D38",
        goldDeep: "#6B5020",
        buttonText: "#FFFFFF",
        overlay: "radial-gradient(circle at 22% 42%, rgba(196,163,90,0.13), transparent 36%), linear-gradient(135deg, rgba(250,246,238,0.82), rgba(242,234,219,0.62))",
      };

  const handle = async () => {
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
        setError(response.message || "Login failed");
      }
    } catch (err) {
      console.error("Login error details:", err);
      setError(`Login failed: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 16px",
    borderRadius: 12,
    border: `1px solid ${focusedField === field ? C.gold : C.inputBorder}`,
    background: C.inputBg,
    color: C.textPrimary,
    fontSize: 14,
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    outline: "none",
    transition: "border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
    boxShadow: focusedField === field
      ? `0 0 0 3px ${isDark ? "rgba(196,163,90,0.13)" : "rgba(140,107,42,0.12)"}, inset 0 1px 0 rgba(255,255,255,0.04)`
      : "inset 0 1px 0 rgba(255,255,255,0.035)",
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.pageBg,
        color: C.textPrimary,
        position: "relative",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        overflow: "hidden",
        transition: "background 0.30s ease, color 0.30s ease",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes loginSpin { to { transform: rotate(360deg); } }
        @keyframes loginPanelIn { from { opacity: 0; transform: translateY(18px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes loginVisualIn { from { opacity: 0; transform: translateX(18px); } to { opacity: 1; transform: translateX(0); } }
        .admin-login-shell {
          position: relative;
          z-index: 1;
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(340px, 40%) minmax(0, 60%);
          padding-top: 64px;
          padding-left: clamp(30px, 5vw, 84px);
          padding-right: clamp(30px, 5vw, 84px);
          padding-bottom: clamp(22px, 3.5vw, 48px);
          gap: clamp(28px, 4vw, 58px);
          align-items: center;
        }
        .admin-login-left {
          position: relative;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .admin-login-panel {
          width: 100%;
          max-width: 420px;
          padding: clamp(22px, 2.35vw, 30px);
          border-radius: 22px;
          backdrop-filter: blur(18px) saturate(1.08);
          -webkit-backdrop-filter: blur(18px) saturate(1.08);
          animation: loginPanelIn 0.48s cubic-bezier(0.22,1,0.36,1) both;
        }
        .admin-login-visual {
          display: flex;
          align-items: center;
          min-height: 0;
          padding: 0;
        }
        .admin-login-visual__frame {
          position: relative;
          flex: 1;
          overflow: hidden;
          border-radius: 24px;
          background-size: cover;
          background-position: center;
          height: min(650px, calc(100vh - 150px));
          min-height: 430px;
          max-height: 650px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.24), inset 0 0 0 1px rgba(255,250,241,0.12);
          animation: loginVisualIn 0.58s cubic-bezier(0.22,1,0.36,1) both;
        }
        .admin-login-visual__frame::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(10,9,8,0.64), rgba(10,9,8,0.12) 52%, rgba(10,9,8,0.48)),
            radial-gradient(circle at 24% 20%, rgba(196,163,90,0.24), transparent 34%);
        }
        .admin-login-visual__content {
          position: absolute;
          left: clamp(24px, 4vw, 56px);
          right: clamp(24px, 4vw, 56px);
          bottom: clamp(24px, 4vw, 56px);
          color: #fffaf1;
          max-width: 460px;
        }
        .admin-login-visual__tile {
          position: absolute;
          width: clamp(108px, 12vw, 178px);
          aspect-ratio: 1.38 / 1;
          border-radius: 15px;
          background-size: cover;
          background-position: center;
          box-shadow: 0 16px 34px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255,250,241,0.14);
          overflow: hidden;
        }
        .admin-login-visual__tile::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.34));
        }
        .admin-login-visual__tile--one {
          top: clamp(18px, 4vw, 50px);
          right: clamp(18px, 3vw, 42px);
        }
        .admin-login-visual__tile--two {
          top: clamp(126px, 16vw, 214px);
          right: clamp(70px, 9vw, 142px);
          width: clamp(96px, 10.5vw, 148px);
        }
        @media (max-width: 1080px) {
          .admin-login-shell {
            grid-template-columns: minmax(330px, 43%) minmax(0, 57%);
            padding-left: 28px;
            padding-right: 28px;
            gap: 28px;
          }
          .admin-login-visual__frame {
            min-height: 390px;
            height: min(560px, calc(100vh - 148px));
          }
          .admin-login-visual__tile--two {
            display: none;
          }
        }
        @media (max-width: 860px) {
          .admin-login-shell {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            overflow: auto;
            padding: 76px 20px 32px;
            gap: 20px;
          }
          .admin-login-visual {
            order: 1;
            width: 100%;
            min-height: 0;
          }
          .admin-login-visual__frame {
            min-height: 240px;
            height: 260px;
            border-radius: 22px;
          }
          .admin-login-left {
            order: 2;
            min-height: auto;
            width: 100%;
            padding: 0;
          }
          .admin-login-visual__tile {
            display: none;
          }
        }
        @media (max-width: 560px) {
          main {
            overflow: auto !important;
          }
          .admin-login-visual {
            min-height: 0;
          }
          .admin-login-visual__frame {
            min-height: 190px;
            height: 205px;
            border-radius: 18px;
          }
          .admin-login-visual__title {
            font-size: 34px;
          }
        }
      `}</style>

      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${loginBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: isDark ? "blur(3.5px) brightness(0.58) saturate(1.05)" : "blur(3.5px) brightness(0.82) saturate(0.82)",
            transform: "scale(1.025)",
            transition: "filter 0.40s ease, transform 0.40s ease",
          }}
        />
        <div style={{ position: "absolute", inset: 0, background: C.overlay, transition: "background 0.40s ease" }} />
      </div>

      <SharedNavbar
        isDark={isDark}
        toggle={() => setIsDark((value) => !value)}
        showNavigation={false}
        scrolled={false}
        height={64}
      />

      <div className="admin-login-shell">
        <section className="admin-login-left">
          <div
            className="admin-login-panel"
            style={{
              background: C.panelBg,
              border: `1px solid ${C.panelBorder}`,
              boxShadow: C.panelShadow,
            }}
          >
            <div style={{ marginBottom: 22 }}>
              <img
                src={bellevueLogo}
                alt="The Bellevue Manila"
                style={{
                  width: 104,
                  height: "auto",
                  objectFit: "contain",
                  marginBottom: 18,
                  filter: isDark ? "none" : "brightness(0) saturate(100%) invert(24%) sepia(22%) saturate(695%) hue-rotate(7deg)",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ width: 26, height: 1, background: C.gold, opacity: 0.72 }} />
                <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.22em", color: C.gold, textTransform: "uppercase" }}>
                  Admin Portal
                </span>
              </div>
              <h1 style={{ margin: "0 0 10px", fontSize: "clamp(30px,3.2vw,40px)", lineHeight: 1.03, fontWeight: 560, color: C.textPrimary }}>
                Seat & Table<br />Management
              </h1>
              <p style={{ margin: 0, color: C.textSecondary, fontSize: 13, lineHeight: 1.62 }}>
                Sign in to oversee reservations, outlet activity, reports, and operational service flow.
              </p>
            </div>

            {error && (
              <div
                style={{
                  marginBottom: 18,
                  padding: "11px 14px",
                  borderRadius: 12,
                  background: "rgba(184,92,92,0.10)",
                  border: "1px solid rgba(184,92,92,0.22)",
                  color: "#d47777",
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                {error}
              </div>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handle();
              }}
            >
              <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
                <label>
                  <span style={{ display: "block", marginBottom: 8, fontSize: 9, fontWeight: 800, letterSpacing: "0.20em", textTransform: "uppercase", color: focusedField === "user" ? C.gold : C.textMuted }}>
                    Username
                  </span>
                  <input
                    style={inputStyle("user")}
                    type="text"
                    disabled={loading}
                    value={user}
                    onFocus={() => setFocusedField("user")}
                    onBlur={() => setFocusedField("")}
                    onChange={(event) => { setUser(event.target.value); setError(""); }}
                    placeholder="Enter your username"
                    autoComplete="username"
                  />
                </label>

                <label>
                  <span style={{ display: "block", marginBottom: 8, fontSize: 9, fontWeight: 800, letterSpacing: "0.20em", textTransform: "uppercase", color: focusedField === "pass" ? C.gold : C.textMuted }}>
                    Password
                  </span>
                  <input
                    style={inputStyle("pass")}
                    type="password"
                    disabled={loading}
                    value={pass}
                    onFocus={() => setFocusedField("pass")}
                    onBlur={() => setFocusedField("")}
                    onChange={(event) => { setPass(event.target.value); setError(""); }}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px",
                  border: "1px solid transparent",
                  borderRadius: 12,
                  background: loading ? C.goldDeep : `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`,
                  color: C.buttonText,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.72 : 1,
                  transition: "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease",
                  boxShadow: loading ? "none" : "0 14px 26px rgba(140,107,42,0.24)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                }}
                onMouseEnter={(event) => { if (!loading) event.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(event) => { event.currentTarget.style.transform = "translateY(0)"; }}
              >
                {loading && (
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: `1.5px solid ${isDark ? "rgba(10,9,8,0.30)" : "rgba(255,255,255,0.42)"}`,
                      borderTopColor: C.buttonText,
                      display: "inline-block",
                      animation: "loginSpin 0.75s linear infinite",
                    }}
                  />
                )}
                {loading ? "Signing In" : "Sign In"}
              </button>

              {loading && (
                <div style={{ marginTop: 12, fontSize: 12, color: C.textMuted, textAlign: "center", fontWeight: 600 }}>
                  Verifying account access
                </div>
              )}
            </form>
          </div>
        </section>

        <aside className="admin-login-visual" aria-hidden="true">
          <div
            className="admin-login-visual__frame"
            style={{ backgroundImage: `url(${grandBallroomShowcase})` }}
          >
            <div
              className="admin-login-visual__tile admin-login-visual__tile--one"
              style={{ backgroundImage: `url(${diningShowcase})` }}
            />
            <div
              className="admin-login-visual__tile admin-login-visual__tile--two"
              style={{ backgroundImage: `url(${towerShowcase})` }}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}

export default LoginScreen;
