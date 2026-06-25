import { useState, useEffect } from "react";
import { X, Shield, QrCode, Download, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import QRCode from "qrcode";
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
        animation: "tfModalSpin 0.75s linear infinite",
      }}
    />
  );
}

export default function TwoFactorSetupModal({
  isOpen,
  onClose,
  mode = "setup", // "setup" | "disable"
  onSuccess,
}) {
  const { isDark, currentUser } = useAdminTheme();
  const [step, setStep] = useState(1); // For setup: 1 = QR & Scan, 2 = Recovery Codes
  const [secret, setSecret] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState(""); // For disable
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCode("");
      setPassword("");
      setError("");
      setCopied(false);
      
      if (mode === "setup") {
        fetchSetupData();
      }
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const fetchSetupData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authAPI.setup2FA();
      if (res.success) {
        setSecret(res.secret);
        
        // Generate QR code locally
        const userObj = currentUser || authAPI.getCurrentUser() || {};
        const username = encodeURIComponent(userObj.username || userObj.email || "Admin");
        const provisioningUri = `otpauth://totp/Bellevue%20Seat%20%26%20Table%3A${username}?secret=${res.secret}&issuer=Bellevue%20Seat%20%26%20Table`;
        
        try {
          const localQrUrl = await QRCode.toDataURL(provisioningUri, {
            margin: 1,
            width: 200,
          });
          setQrUrl(localQrUrl);
        } catch (qrErr) {
          console.error("Local QR generation failed, falling back to Google Charts API", qrErr);
          setQrUrl(res.qr_url);
        }
      } else {
        setError(res.message || "Failed to generate 2FA credentials.");
      }
    } catch (err) {
      setError(err.message || "An error occurred while setting up 2FA.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await authAPI.enable2FA(secret, code);
      if (res.success) {
        setRecoveryCodes(res.recovery_codes || []);
        setStep(2);
      } else {
        setError(res.message || "Incorrect verification code. Please try again.");
      }
    } catch (err) {
      setError(err.message || "An error occurred during 2FA enablement.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await authAPI.disable2FA(password);
      if (res.success) {
        onSuccess();
      } else {
        setError(res.message || "Incorrect password.");
      }
    } catch (err) {
      setError(err.message || "An error occurred while disabling 2FA.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCodes = () => {
    const text = recoveryCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadCodes = () => {
    const text = `Bellevue Seat & Table Two-Factor Recovery Codes\n\nGenerated: ${new Date().toLocaleString()}\n\nKeep these codes in a safe place. If you lose access to your authenticator device, you can use these to sign in.\n\n${recoveryCodes.join("\n")}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bellevue_2fa_recovery_codes_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        if (e.target === e.currentTarget && !loading && step !== 2) onClose();
      }}
    >
      <style>{`
        @keyframes tfModalSpin { to { transform: rotate(360deg); } }
        @keyframes tfModalIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <div
        style={{
          background: C.surfaceBase,
          borderRadius: 14,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 20px 60px rgba(0,0,0,0.20)",
          border: `1px solid ${C.borderDefault}`,
          fontFamily: F.body,
          animation: "tfModalIn 0.20s cubic-bezier(0.16,1,0.3,1)",
          overflow: "hidden",
        }}
      >
        <div style={{ height: "2px", background: `linear-gradient(90deg,transparent,${C.gold}80 30%,${C.gold}80 70%,transparent)` }} />
        
        {/* Header */}
        <div style={{ background: C.headerGradient, padding: "20px 22px 18px", borderBottom: `1px solid ${C.divider}`, position: "relative" }}>
          {!loading && step !== 2 && (
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
          
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Shield size={14} color={C.gold} />
            <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.22em", color: C.gold, fontWeight: 700, textTransform: "uppercase" }}>
              2-Factor Security
            </span>
          </div>
          <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 700, color: C.textPrimary, letterSpacing: "0.01em" }}>
            {mode === "setup"
              ? step === 1 ? "Enable Two-Factor Auth" : "Save Recovery Codes"
              : "Disable Two-Factor Auth"}
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

          {mode === "setup" && step === 1 && (
            <form onSubmit={handleVerifySetup} style={{ display: "grid", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>
                1. Scan this QR code using your authenticator application (e.g. Google Authenticator, Duo, 1Password):
              </p>
              
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0" }}>
                {loading ? (
                  <div style={{ width: 180, height: 180, border: `1px solid ${C.border}`, borderRadius: 8, background: C.surfaceSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Spinner color={C.gold} size={20} />
                  </div>
                ) : (
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, background: "#FFFFFF" }}>
                    <img src={qrUrl} alt="2FA QR Code" style={{ width: 170, height: 170, display: "block" }} />
                  </div>
                )}
              </div>

              {secret && (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: C.surfaceSoft, padding: "10px 12px", display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Or enter manual key:
                  </span>
                  <code style={{ fontSize: 13, fontWeight: 700, color: C.gold, letterSpacing: "0.12em", wordBreak: "break-all" }}>
                    {secret.replace(/(.{4})/g, "$1 ")}
                  </code>
                </div>
              )}

              <p style={{ margin: 0, fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>
                2. Enter the 6-digit confirmation code generated by your app below to complete setup:
              </p>

              <div style={{ display: "grid", gap: 6 }}>
                <span style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: C.muted }}>
                  Authenticator Code
                </span>
                <input
                  type="text"
                  required
                  pattern="[0-9 ]*"
                  maxLength={7}
                  value={code}
                  disabled={loading}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000 000"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    minHeight: 38,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontFamily: F.body,
                    fontSize: 14,
                    fontWeight: 700,
                    textAlign: "center",
                    letterSpacing: "0.2em",
                    color: C.text,
                    background: C.surfaceSoft,
                    outline: "none",
                  }}
                />
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
                  disabled={loading || code.trim().length < 6}
                  style={{
                    minHeight: 36,
                    padding: "0 16px",
                    border: "none",
                    borderRadius: 8,
                    background: C.gold,
                    color: "#FFFFFF",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: (loading || code.trim().length < 6) ? "not-allowed" : "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {loading ? <Spinner /> : null}
                  Verify & Activate
                </button>
              </div>
            </form>
          )}

          {mode === "setup" && step === 2 && (
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.greenFaint, color: C.green, border: `1px solid ${C.green}2A`, borderRadius: 8, fontSize: 12.5, lineHeight: 1.45 }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>Two-Factor Authentication activated successfully.</span>
              </div>

              <p style={{ margin: 0, fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>
                Write down or save these emergency recovery codes. Each code can be used <strong>once</strong> to log in if you lose access to your authenticator app.
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, background: C.surfaceSoft }}>
                {recoveryCodes.map((codeStr, idx) => (
                  <code key={idx} style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, letterSpacing: "0.05em", textAlign: "center" }}>
                    {codeStr}
                  </code>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={handleCopyCodes}
                  style={{
                    flex: 1,
                    minHeight: 34,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    background: "transparent",
                    color: C.textSecondary,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {copied ? <CheckCircle2 size={13} color={C.green} /> : <Copy size={13} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCodes}
                  style={{
                    flex: 1,
                    minHeight: 34,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    background: "transparent",
                    color: C.textSecondary,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Download size={13} />
                  Download TXT
                </button>
              </div>

              <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 16, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={onSuccess}
                  style={{
                    minHeight: 36,
                    padding: "0 22px",
                    border: "none",
                    borderRadius: 8,
                    background: C.gold,
                    color: "#FFFFFF",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  I've Saved the Codes
                </button>
              </div>
            </div>
          )}

          {mode === "disable" && (
            <form onSubmit={handleDisable2FA} style={{ display: "grid", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5 }}>
                Disabling 2FA will lower the security of your administrator account. To confirm, please enter your password.
              </p>

              <div style={{ display: "grid", gap: 6 }}>
                <span style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: C.muted }}>
                  Password
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    minHeight: 38,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontFamily: F.body,
                    fontSize: 13,
                    color: C.text,
                    background: C.surfaceSoft,
                    outline: "none",
                  }}
                />
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
                    background: C.red,
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
                  Disable 2FA
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
