import { useState, useRef, useEffect } from "react";
import { X, Lock, Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { authAPI } from "../../../services/authAPI";
import { useAdminTheme, C, F } from "../../../context/AdminThemeContext";

function Spinner({ color = "#FFFFFF", size = 14 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${color}33`,
        borderTopColor: color,
        display: "inline-block",
        animation: "verifModalSpin 0.75s linear infinite",
      }}
    />
  );
}

export default function VerificationModal({
  isOpen,
  onClose,
  targetEmail,
  targetUsername,
  onVerificationSuccess,
}) {
  const { isDark } = useAdminTheme();
  const [step, setStep] = useState(1); // 1 = password check, 2 = OTP check (only if email changed)
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const otpRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ];

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setPassword("");
      setOtp(["", "", "", "", "", ""]);
      setError("");
      setSuccessMsg("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isEmailChange = !!targetEmail;

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      if (isEmailChange) {
        // Call backend to request email change (verifies password and sends email verification code)
        const res = await authAPI.requestEmailChange(targetEmail, password);
        if (res.success) {
          setStep(2);
        } else {
          setError(res.message || "Failed to verify password. Please try again.");
        }
      } else {
        // Only username is changed, verify password first
        const res = await authAPI.verifyPassword(password);
        if (res.success) {
          setSuccessMsg("Identity verified.");
          setTimeout(() => {
            onVerificationSuccess(password);
          }, 1000);
        } else {
          setError(res.message || "Incorrect password.");
        }
      }
    } catch (err) {
      setError(err.message || "An error occurred during verification.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    // Only allow digits
    const cleanValue = value.replace(/[^0-9]/g, "");
    if (!cleanValue) {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = cleanValue.substring(cleanValue.length - 1);
    setOtp(newOtp);

    // Auto-focus next input
    if (index < 5 && otpRefs[index + 1].current) {
      otpRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      if (otpRefs[index - 1].current) {
        otpRefs[index - 1].current.focus();
      }
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }

    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await authAPI.confirmEmailChange(code);
      if (res.success) {
        setSuccessMsg("Email successfully verified and updated.");
        setTimeout(() => {
          onVerificationSuccess(password);
        }, 1200);
      } else {
        setError(res.message || "Invalid verification code.");
      }
    } catch (err) {
      setError(err.message || "Failed to confirm email update.");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await authAPI.requestEmailChange(targetEmail, password);
      if (res.success) {
        setSuccessMsg("A new verification code has been sent.");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        setError(res.message || "Resend failed.");
      }
    } catch (err) {
      setError(err.message || "Error resending verification code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: C.modalOverlay,
        zIndex: 5000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <style>{`
        @keyframes verifModalSpin { to { transform: rotate(360deg); } }
        @keyframes verifModalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        .verif-input-otp:focus {
          border-color: ${C.gold} !important;
          box-shadow: 0 0 0 3px ${C.gold}20 !important;
        }
      `}</style>

      <div
        style={{
          background: C.surfaceBase,
          borderRadius: 14,
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
          border: `1px solid ${C.borderDefault}`,
          fontFamily: F.body,
          animation: "verifModalIn 0.20s cubic-bezier(0.16,1,0.3,1)",
          overflow: "hidden",
        }}
      >
        <div style={{ height: "2px", background: `linear-gradient(90deg,transparent,${C.gold}80 30%,${C.gold}80 70%,transparent)` }} />
        
        {/* Header */}
        <div style={{ background: C.headerGradient, padding: "20px 22px 18px", borderBottom: `1px solid ${C.divider}`, position: "relative" }}>
          {!loading && (
            <button
              onClick={onClose}
              style={{
                position: "absolute",
                top: 14,
                right: 16,
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "transparent",
                border: `1px solid ${C.borderDefault}`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                transition: "all 0.18s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.gold;
                e.currentTarget.style.background = C.goldFaint;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.borderDefault;
                e.currentTarget.style.background = "transparent";
              }}
            >
              <X size={12} color={C.textSecondary} strokeWidth={2.5} />
            </button>
          )}
          
          <div style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.22em", color: C.gold, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
            Security Check
          </div>
          <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: C.textPrimary, letterSpacing: "0.01em" }}>
            {step === 1 ? "Verify Password" : "Verify New Email"}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 24, display: "grid", gap: 16 }}>
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.redFaint, color: C.red, border: `1px solid ${C.red}2A`, borderRadius: 8, fontSize: 12.5, lineHeight: 1.4 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.greenFaint, color: C.green, border: `1px solid ${C.green}2A`, borderRadius: 8, fontSize: 12.5, lineHeight: 1.4 }}>
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handlePasswordSubmit} style={{ display: "grid", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5 }}>
                To authorize changes to your credentials, please verify your identity by entering your current password.
              </p>
              
              <div style={{ display: "grid", gap: 6 }}>
                <span style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: C.muted }}>
                  Password
                </span>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted }}>
                    <Lock size={14} />
                  </span>
                  <input
                    type="password"
                    required
                    value={password}
                    disabled={loading}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter current password"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      minHeight: 38,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      padding: "8px 12px 8px 36px",
                      fontFamily: F.body,
                      fontSize: 13,
                      color: C.text,
                      background: C.surfaceSoft,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  style={{
                    minHeight: 36,
                    padding: "0 14px",
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    background: "transparent",
                    color: C.textSecondary,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !password}
                  style={{
                    minHeight: 36,
                    padding: "0 16px",
                    border: "none",
                    borderRadius: 8,
                    background: C.gold,
                    color: "#FFFFFF",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: (loading || !password) ? "not-allowed" : "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {loading ? <Spinner /> : null}
                  {isEmailChange ? "Send Verification" : "Confirm Update"}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleOtpSubmit} style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: C.goldFaint, border: `1px solid ${C.borderAccent}`, display: "flex", alignItems: "center", justifyCenter: "center", alignSelf: "flex-start", flexShrink: 0, justifyContent: "center" }}>
                  <Mail size={16} color={C.gold} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12.5, color: C.textSecondary, lineHeight: 1.45 }}>
                    Enter the 6-digit confirmation code sent to <strong style={{ color: C.textPrimary }}>{targetEmail}</strong>.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, margin: "8px 0" }}>
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={otpRefs[idx]}
                    type="text"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    disabled={loading}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    className="verif-input-otp"
                    style={{
                      width: 44,
                      height: 48,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      textAlign: "center",
                      fontSize: 18,
                      fontWeight: 700,
                      background: C.surfaceSoft,
                      color: C.textPrimary,
                      outline: "none",
                      transition: "all 0.16s ease",
                    }}
                  />
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={loading}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: C.gold,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Resend code
                </button>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    style={{
                      minHeight: 36,
                      padding: "0 14px",
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      background: "transparent",
                      color: C.textSecondary,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || otp.join("").length < 6}
                    style={{
                      minHeight: 36,
                      padding: "0 16px",
                      border: "none",
                      borderRadius: 8,
                      background: C.gold,
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: (loading || otp.join("").length < 6) ? "not-allowed" : "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {loading ? <Spinner /> : null}
                    Verify & Save
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
