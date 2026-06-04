import { useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  LockKeyhole,
  Monitor,
  Save,
  Shield,
  Upload,
  UserCircle,
} from "lucide-react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import Sidebar from "../../../components/layout/Sidebar";
import { authAPI } from "../../../services/authAPI";
import { roleAPI } from "../../../services/roleAPI";
import { useEffect } from "react";

const C = {
  pageBg: "#F7F4EE",
  surface: "#FFFFFF",
  surfaceSoft: "#FAF8F4",
  border: "rgba(0,0,0,0.08)",
  divider: "rgba(0,0,0,0.05)",
  gold: "#8C6B2A",
  goldSoft: "#A07D38",
  goldFaint: "rgba(140,107,42,0.08)",
  green: "#2E7A5A",
  greenFaint: "rgba(46,122,90,0.08)",
  red: "#A03838",
  redFaint: "rgba(160,56,56,0.08)",
  text: "#18140E",
  muted: "#7A7060",
  faint: "rgba(24,20,14,0.42)",
  shadowSoft: "0 1px 5px rgba(44,36,24,0.025)",
};

const F = {
  body: "'Inter','Helvetica Neue',Arial,sans-serif",
  label: "'Inter','Helvetica Neue',Arial,sans-serif",
  display: "'Inter','Helvetica Neue',Arial,sans-serif",
};

const DEFAULT_PREFERENCES = {
  reservationAlerts: true,
  cancellationAlerts: true,
  reportNotifications: false,
  systemUpdates: true,
};

const PREFERENCE_KEY = "bellevue_account_preferences";

function readStoredPreferences() {
  try {
    const raw = localStorage.getItem(PREFERENCE_KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function formatRole(roleSlug, availableRoles) {
  const roleObj = availableRoles?.find(r => r.slug === roleSlug);
  return roleObj ? roleObj.name : String(roleSlug || "Admin").replace(/_/g, " ");
}

function getInitials(name) {
  return String(name || "Admin")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

function avatarKeyFor(user) {
  return `bellevue_account_avatar:${user?.id || user?.username || "current"}`;
}

function readStoredAvatar(user) {
  try {
    return localStorage.getItem(avatarKeyFor(user)) || "";
  } catch {
    return "";
  }
}

function inputStyle(extra = {}) {
  return {
    width: "100%",
    minHeight: 38,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "8px 11px",
    fontFamily: F.body,
    fontSize: 13,
    color: C.text,
    background: C.surface,
    outline: "none",
    transition: "border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease",
    ...extra,
  };
}

function buttonStyle(kind = "primary", disabled = false) {
  const primary = kind === "primary";
  return {
    minHeight: 38,
    padding: "0 14px",
    border: `1px solid ${primary ? "rgba(140,107,42,0.22)" : C.border}`,
    borderRadius: 9,
    background: disabled ? "rgba(0,0,0,0.04)" : primary ? C.gold : C.surface,
    color: disabled ? C.faint : primary ? "#FFFFFF" : C.gold,
    fontFamily: F.label,
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    whiteSpace: "nowrap",
    boxShadow: primary && !disabled ? "0 2px 8px rgba(140,107,42,0.10)" : "none",
    transition: "background 0.16s ease, border-color 0.16s ease, transform 0.16s ease",
  };
}

function Spinner({ color = C.gold, size = 13 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${color}33`,
        borderTopColor: color,
        display: "inline-block",
        animation: "accountSettingsSpin 0.75s linear infinite",
      }}
    />
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: "grid", gap: 7, minWidth: 0 }}>
      <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11.5, lineHeight: 1.45, color: C.muted }}>{hint}</span>}
    </label>
  );
}

function Panel({ eyebrow, title, description, children, actions }) {
  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadowSoft, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px 15px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold, marginBottom: 6 }}>
              {eyebrow}
            </div>
          )}
          <h2 style={{ margin: 0, fontSize: 18, lineHeight: 1.25, color: C.text, fontWeight: 700 }}>{title}</h2>
          {description && <p style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.55, color: C.muted }}>{description}</p>}
        </div>
        {actions && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{actions}</div>}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </section>
  );
}

function Notice({ type = "success", children }) {
  const isError = type === "error";
  const color = isError ? C.red : C.green;
  const bg = isError ? C.redFaint : C.greenFaint;
  const Icon = isError ? AlertCircle : CheckCircle2;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", background: bg, color, border: `1px solid ${color}2A`, borderRadius: 9, fontSize: 12.5, lineHeight: 1.45 }}>
      <Icon size={16} />
      <span>{children}</span>
    </div>
  );
}

function SettingsNavButton({ section, active, onClick }) {
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 44,
        border: `1px solid ${active ? "rgba(140,107,42,0.18)" : "transparent"}`,
        borderRadius: 10,
        background: active ? C.goldFaint : "transparent",
        color: active ? C.gold : C.muted,
        display: "grid",
        gridTemplateColumns: "20px minmax(0,1fr)",
        gap: 10,
        alignItems: "center",
        textAlign: "left",
        padding: "10px 12px",
        cursor: "pointer",
        fontFamily: F.body,
        transition: "background 0.16s ease, border-color 0.16s ease, color 0.16s ease",
      }}
      onMouseEnter={(event) => {
        if (!active) {
          event.currentTarget.style.background = "rgba(140,107,42,0.045)";
          event.currentTarget.style.color = C.text;
        }
      }}
      onMouseLeave={(event) => {
        if (!active) {
          event.currentTarget.style.background = "transparent";
          event.currentTarget.style.color = C.muted;
        }
      }}
    >
      <Icon size={16} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: active ? 720 : 560 }}>{section.label}</span>
        <span style={{ display: "block", marginTop: 2, fontSize: 11, lineHeight: 1.3, color: active ? C.goldSoft : C.faint }}>{section.description}</span>
      </span>
    </button>
  );
}

function ToggleRow({ title, description, checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: "100%",
        border: `1px solid ${checked ? "rgba(46,122,90,0.18)" : C.border}`,
        borderRadius: 10,
        background: checked ? C.greenFaint : C.surfaceSoft,
        padding: "13px 14px",
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) auto",
        gap: 14,
        alignItems: "center",
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
        {description && <span style={{ display: "block", marginTop: 3, fontSize: 12, color: C.muted, lineHeight: 1.45 }}>{description}</span>}
      </span>
      <span
        aria-hidden="true"
        style={{
          width: 42,
          height: 24,
          borderRadius: 999,
          background: checked ? C.gold : "rgba(0,0,0,0.12)",
          position: "relative",
          transition: "background 0.16s ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 21 : 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#FFFFFF",
            boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
            transition: "left 0.16s ease",
          }}
        />
      </span>
    </button>
  );
}

function PasswordInput({ value, onChange, placeholder, visible, onToggle, required = false }) {
  const Icon = visible ? EyeOff : Eye;
  return (
    <div style={{ position: "relative" }}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        required={required}
        minLength={required ? 8 : undefined}
        placeholder={placeholder}
        style={inputStyle({ paddingRight: 42 })}
      />
      <button
        type="button"
        onClick={onToggle}
        style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", width: 30, height: 30, border: "none", borderRadius: 7, background: "transparent", color: C.faint, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        <Icon size={15} />
      </button>
    </div>
  );
}

export default function AccountSettings() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => authAPI.getCurrentUser() || {});
  const [activeSection, setActiveSection] = useState("profile");
  const [message, setMessage] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savedAvatar, setSavedAvatar] = useState(() => readStoredAvatar(currentUser));
  const [avatarPreview, setAvatarPreview] = useState(() => readStoredAvatar(currentUser));
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [availableRoles, setAvailableRoles] = useState([]);

  useEffect(() => {
    roleAPI.getAll()
      .then(res => setAvailableRoles(Array.isArray(res) ? res : (res.data || [])))
      .catch(() => setAvailableRoles([]));
  }, []);

  const [profile, setProfile] = useState({
    name: currentUser.name || "",
    email: currentUser.email || "",
    username: currentUser.username || "",
  });

  const [security, setSecurity] = useState({
    current_password: "",
    password: "",
    password_confirmation: "",
  });

  const [preferences, setPreferences] = useState(() => readStoredPreferences());

  const role = currentUser.role || "admin";
  const displayName = profile.name || currentUser.username || "Admin";
  const initials = getInitials(displayName);
  const assignedVenues = useMemo(
    () => Array.isArray(currentUser.outlet_scope)
      ? currentUser.outlet_scope.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    [currentUser.outlet_scope]
  );
  const hasFullScope = currentUser.scope_type !== "assigned";
  const profileTextDirty = profile.name !== (currentUser.name || "")
    || profile.email !== (currentUser.email || "")
    || profile.username !== (currentUser.username || "");
  const avatarDirty = avatarPreview !== savedAvatar;
  const profileDirty = profileTextDirty || avatarDirty;

  const passwordStrength = useMemo(() => {
    const value = security.password || "";
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[A-Z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    if (!value) return { label: "No password entered", score: 0, color: C.faint };
    if (score <= 1) return { label: "Weak", score, color: C.red };
    if (score <= 3) return { label: "Good", score, color: C.gold };
    return { label: "Strong", score, color: C.green };
  }, [security.password]);

  const sections = [
    { id: "profile", label: "Profile", description: "Identity and role", icon: UserCircle },
    { id: "security", label: "Security", description: "Password access", icon: Shield },
    { id: "notifications", label: "Notifications", description: "Operational alerts", icon: Bell },
    { id: "sessions", label: "Sessions", description: "Login activity", icon: Laptop },
  ];

  const scopedLabel = hasFullScope
    ? "All venues and outlets"
    : assignedVenues.length
      ? `${assignedVenues.length} assigned venue${assignedVenues.length === 1 ? "" : "s"}`
      : "No assigned venues listed";

  const showMessage = (nextMessage) => {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(null), 4200);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setMessage(null);

    try {
      const previousAvatarKey = avatarKeyFor(currentUser);
      let nextUser = currentUser;

      if (profileTextDirty) {
        const response = await authAPI.updateProfile(profile);
        nextUser = response?.admin || { ...currentUser, ...profile };
      }

      const nextAvatarKey = avatarKeyFor(nextUser);
      try {
        if (avatarPreview) {
          localStorage.setItem(nextAvatarKey, avatarPreview);
        } else {
          localStorage.removeItem(nextAvatarKey);
        }
        if (previousAvatarKey !== nextAvatarKey) {
          localStorage.removeItem(previousAvatarKey);
        }
      } catch {}

      setCurrentUser(nextUser);
      setProfile({
        name: nextUser.name || "",
        email: nextUser.email || "",
        username: nextUser.username || "",
      });
      setSavedAvatar(avatarPreview);
      showMessage({ type: "success", text: "Profile information updated." });
    } catch (error) {
      showMessage({ type: "error", text: error.message || "Profile update failed." });
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showMessage({ type: "error", text: "Please upload an image file for the profile photo." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showMessage({ type: "error", text: "Profile photo must be 2 MB or smaller." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setAvatarPreview(result);
      showMessage({ type: "success", text: "Profile photo ready. Save profile to apply it." });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const removeAvatar = () => {
    setAvatarPreview("");
    showMessage({ type: "success", text: "Profile photo removal ready. Save profile to apply it." });
  };

  const resetProfileDraft = () => {
    setProfile({
      name: currentUser.name || "",
      email: currentUser.email || "",
      username: currentUser.username || "",
    });
    setAvatarPreview(savedAvatar);
  };

  const saveSecurity = async (event) => {
    event.preventDefault();
    setSavingSecurity(true);
    setMessage(null);

    try {
      if (security.password !== security.password_confirmation) {
        throw new Error("New password and confirmation do not match.");
      }
      await authAPI.updateProfile({
        ...profile,
        current_password: security.current_password,
        password: security.password,
        password_confirmation: security.password_confirmation,
      });
      setSecurity({ current_password: "", password: "", password_confirmation: "" });
      showMessage({ type: "success", text: "Password updated successfully." });
    } catch (error) {
      showMessage({ type: "error", text: error.message || "Password update failed." });
    } finally {
      setSavingSecurity(false);
    }
  };

  const savePreferences = () => {
    setSavingPreferences(true);
    try {
      localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences));
      showMessage({ type: "success", text: "Notification preferences saved on this device." });
    } catch {
      showMessage({ type: "error", text: "Unable to save preferences on this device." });
    } finally {
      window.setTimeout(() => setSavingPreferences(false), 250);
    }
  };

  return (
    <div style={{ height: "100vh", overflow: "hidden", fontFamily: F.body, background: C.pageBg, color: C.text }}>
      <style>{`
        @keyframes accountSettingsSpin { to { transform: rotate(360deg); } }
        .account-settings-shell input:focus,
        .account-settings-shell select:focus {
          border-color: rgba(140,107,42,0.34) !important;
          box-shadow: 0 0 0 3px rgba(140,107,42,0.10);
        }
        .account-settings-grid {
          display: grid;
          grid-template-columns: 286px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }
        .account-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(230px, 1fr));
          gap: 13px 16px;
          align-items: start;
          max-width: 860px;
        }
        .account-preference-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .account-profile-form-grid {
          display: grid;
          grid-template-columns: 190px minmax(0, 1fr);
          gap: 22px;
          align-items: start;
        }
        .account-password-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(220px, 1fr));
          gap: 13px 16px;
          align-items: start;
          max-width: 620px;
        }
        @media (max-width: 1100px) {
          .account-settings-grid { grid-template-columns: 1fr; }
          .account-settings-nav { position: static !important; display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 760px) {
          .account-form-grid,
          .account-profile-form-grid,
          .account-password-grid,
          .account-preference-grid,
          .account-settings-nav { grid-template-columns: 1fr !important; }
          .account-profile-hero { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <AdminNavbar />

      <div style={{ display: "flex", height: "calc(100vh - 60px)", minHeight: 0, overflow: "hidden" }}>
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activeNav="settings" />

        <main className="account-settings-shell" style={{ flex: 1, minWidth: 0, height: "calc(100vh - 60px)", overflow: "auto", padding: "30px 32px 42px" }}>
          <div style={{ maxWidth: 1320, display: "grid", gap: 18 }}>
            <AdminPageHeader
              eyebrow="Account"
              title="Account Settings"
              description="Manage your profile, security, notification preferences, and account access from one consistent admin page."
              C={C}
              F={F}
            />

            {message && <Notice type={message.type}>{message.text}</Notice>}

            <section
              className="account-profile-hero"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) auto",
                gap: 18,
                alignItems: "center",
                padding: "18px 20px",
                border: `1px solid ${C.border}`,
                borderRadius: 12,
                background: `linear-gradient(180deg, ${C.surface} 0%, ${C.surfaceSoft} 100%)`,
                boxShadow: C.shadowSoft,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <div style={{ width: 58, height: 58, borderRadius: "50%", background: C.gold, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, boxShadow: "0 8px 18px rgba(140,107,42,0.16)", flexShrink: 0, overflow: "hidden" }}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 740, color: C.text, lineHeight: 1.25 }}>{displayName}</div>
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontSize: 12.5, color: C.muted }}>
                    <span>{currentUser.email || "No email on file"}</span>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.faint }} />
                    <span>{formatRole(role, availableRoles)}</span>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.faint }} />
                    <span>{scopedLabel}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <span style={{ padding: "6px 10px", borderRadius: 999, background: C.greenFaint, color: C.green, fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  Active Session
                </span>
                <span style={{ padding: "6px 10px", borderRadius: 999, background: C.goldFaint, color: C.gold, fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  {formatRole(role, availableRoles)}
                </span>
              </div>
            </section>

            <div className="account-settings-grid">
              <aside className="account-settings-nav" style={{ position: "sticky", top: 18, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, display: "grid", gap: 4, boxShadow: C.shadowSoft }}>
                {sections.map((section) => (
                  <SettingsNavButton
                    key={section.id}
                    section={section}
                    active={activeSection === section.id}
                    onClick={() => setActiveSection(section.id)}
                  />
                ))}
              </aside>

              <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
                {activeSection === "profile" && (
                  <Panel
                    eyebrow="Profile"
                    title="Profile Information"
                    description="Keep your account identity clear for reservation actions, reports, approvals, and audit trails."
                    actions={profileDirty && (
                      <span style={{ padding: "5px 9px", borderRadius: 999, background: C.goldFaint, color: C.gold, fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                        Unsaved changes
                      </span>
                    )}
                  >
                    <form onSubmit={saveProfile} style={{ display: "grid", gap: 18 }}>
                      <div className="account-profile-form-grid">
                        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.surfaceSoft, padding: 15, display: "grid", gap: 12, justifyItems: "center", textAlign: "center" }}>
                          <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>
                            Profile Photo
                          </div>
                          <div style={{ width: 82, height: 82, borderRadius: "50%", background: C.gold, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23, fontWeight: 850, overflow: "hidden", boxShadow: "0 8px 18px rgba(140,107,42,0.14)" }}>
                            {avatarPreview ? (
                              <img src={avatarPreview} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : initials}
                          </div>
                          <div style={{ width: "100%", display: "grid", gap: 8 }}>
                            <label style={{ ...buttonStyle("secondary"), minHeight: 34, padding: "0 11px", width: "100%" }}>
                              <Upload size={13} />
                              Upload Photo
                              <input type="file" accept="image/*" onChange={uploadAvatar} style={{ display: "none" }} />
                            </label>
                            {avatarPreview && (
                              <button type="button" onClick={removeAvatar} style={{ ...buttonStyle("secondary"), minHeight: 34, padding: "0 11px", width: "100%" }}>
                                Remove
                              </button>
                            )}
                          </div>
                          <span style={{ maxWidth: 150, fontSize: 11, lineHeight: 1.45, color: C.muted }}>
                            JPG or PNG, up to 2 MB. Save profile to apply changes.
                          </span>
                        </div>

                        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 760, color: C.text, lineHeight: 1.25 }}>{displayName}</div>
                              <div style={{ marginTop: 3, fontSize: 12.2, color: C.muted }}>{formatRole(role, availableRoles)}</div>
                            </div>
                            {avatarDirty && (
                              <span style={{ padding: "5px 8px", borderRadius: 999, background: C.goldFaint, color: C.gold, fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                                Photo pending save
                              </span>
                            )}
                          </div>
                          <div className="account-form-grid">
                            <Field label="Full Name">
                              <input value={profile.name} onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))} required style={inputStyle()} />
                            </Field>
                            <Field label="Email Address">
                              <input type="email" value={profile.email} onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))} required style={inputStyle()} />
                            </Field>
                            <Field label="Username / Login ID">
                              <input value={profile.username} onChange={(event) => setProfile((prev) => ({ ...prev, username: event.target.value }))} required style={inputStyle()} />
                            </Field>
                            <Field label="System Role" hint="Role changes are managed from Account Manager by authorized administrators.">
                              <input value={formatRole(role, availableRoles)} disabled style={inputStyle({ background: C.surfaceSoft, color: C.muted })} />
                            </Field>
                          </div>

                          <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 13, display: "grid", gap: 9 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                              <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>
                                Assigned Venues & Outlets
                              </div>
                              <span style={{ fontSize: 11.5, color: C.muted }}>
                                {hasFullScope ? "Full access" : "Scoped access"}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                              {hasFullScope ? (
                                <span style={{ padding: "5px 9px", borderRadius: 999, background: C.goldFaint, color: C.gold, fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                  All venues and outlets
                                </span>
                              ) : assignedVenues.length ? (
                                assignedVenues.map((venue) => (
                                  <span key={venue} style={{ padding: "5px 9px", borderRadius: 999, background: C.goldFaint, color: C.gold, fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                    {venue}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: 12.3, color: C.muted }}>No venue or outlet assignments are listed for this account.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 16, display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          disabled={!profileDirty || savingProfile}
                          onClick={resetProfileDraft}
                          style={buttonStyle("secondary", !profileDirty || savingProfile)}
                        >
                          Reset
                        </button>
                        <button type="submit" disabled={!profileDirty || savingProfile} style={buttonStyle("primary", !profileDirty || savingProfile)}>
                          {savingProfile ? <Spinner color="#FFFFFF" /> : <Save size={14} />}
                          Save Profile
                        </button>
                      </div>
                    </form>
                  </Panel>
                )}

                {activeSection === "security" && (
                  <Panel
                    eyebrow="Security"
                    title="Password Management"
                    description="Update your password using your current password. Stronger passwords help protect operational access."
                  >
                    <form onSubmit={saveSecurity} style={{ display: "grid", gap: 16, maxWidth: 660 }}>
                      <div style={{ maxWidth: 430 }}>
                        <Field label="Current Password">
                          <PasswordInput
                            value={security.current_password}
                            onChange={(event) => setSecurity((prev) => ({ ...prev, current_password: event.target.value }))}
                            required
                            visible={showPasswords.current}
                            onToggle={() => setShowPasswords((prev) => ({ ...prev, current: !prev.current }))}
                          />
                        </Field>
                      </div>
                      <div className="account-password-grid">
                        <Field label="New Password" hint="Use at least 8 characters. Add uppercase letters, numbers, or symbols for a stronger password.">
                          <PasswordInput
                            value={security.password}
                            onChange={(event) => setSecurity((prev) => ({ ...prev, password: event.target.value }))}
                            required
                            visible={showPasswords.next}
                            onToggle={() => setShowPasswords((prev) => ({ ...prev, next: !prev.next }))}
                          />
                        </Field>
                        <Field label="Confirm Password">
                          <PasswordInput
                            value={security.password_confirmation}
                            onChange={(event) => setSecurity((prev) => ({ ...prev, password_confirmation: event.target.value }))}
                            required
                            visible={showPasswords.confirm}
                            onToggle={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))}
                          />
                        </Field>
                      </div>

                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.surfaceSoft, padding: 13, display: "grid", gap: 9, maxWidth: 620 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.text, fontSize: 13, fontWeight: 700 }}>
                            <LockKeyhole size={15} color={passwordStrength.color} />
                            Password Strength
                          </span>
                          <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: passwordStrength.color }}>
                            {passwordStrength.label}
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
                          {[1, 2, 3, 4].map((step) => (
                            <span key={step} style={{ height: 5, borderRadius: 999, background: passwordStrength.score >= step ? passwordStrength.color : "rgba(0,0,0,0.08)" }} />
                          ))}
                        </div>
                      </div>

                      <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 16, display: "flex", justifyContent: "flex-end" }}>
                        <button type="submit" disabled={savingSecurity} style={buttonStyle("primary", savingSecurity)}>
                          {savingSecurity ? <Spinner color="#FFFFFF" /> : <KeyRound size={14} />}
                          Change Password
                        </button>
                      </div>
                    </form>
                  </Panel>
                )}

                {activeSection === "notifications" && (
                  <Panel
                    eyebrow="Notifications"
                    title="Notification Preferences"
                    description="Choose which operational alerts should be emphasized for your current device."
                    actions={
                      <button type="button" onClick={savePreferences} disabled={savingPreferences} style={buttonStyle("primary", savingPreferences)}>
                        {savingPreferences ? <Spinner color="#FFFFFF" /> : <Save size={14} />}
                        Save Preferences
                      </button>
                    }
                  >
                    <div className="account-preference-grid">
                      <ToggleRow
                        title="Reservation Alerts"
                        description="Highlight newly submitted reservations and pending action reminders."
                        checked={preferences.reservationAlerts}
                        onChange={(value) => setPreferences((prev) => ({ ...prev, reservationAlerts: value }))}
                      />
                      <ToggleRow
                        title="Cancellation Alerts"
                        description="Surface guest cancellations and records that require customer-service review."
                        checked={preferences.cancellationAlerts}
                        onChange={(value) => setPreferences((prev) => ({ ...prev, cancellationAlerts: value }))}
                      />
                      <ToggleRow
                        title="Report Notifications"
                        description="Show reminders for operational reporting and analytics review."
                        checked={preferences.reportNotifications}
                        onChange={(value) => setPreferences((prev) => ({ ...prev, reportNotifications: value }))}
                      />
                      <ToggleRow
                        title="System Updates"
                        description="Keep maintenance, access, and platform messages visible."
                        checked={preferences.systemUpdates}
                        onChange={(value) => setPreferences((prev) => ({ ...prev, systemUpdates: value }))}
                      />
                    </div>
                  </Panel>
                )}

                {activeSection === "sessions" && (
                  <Panel
                    eyebrow="Sessions"
                    title="Login Activity"
                    description="Review the current browser session. Broader session controls can be connected when backend activity tracking is available."
                  >
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.surfaceSoft, padding: 15, display: "grid", gridTemplateColumns: "42px minmax(0,1fr) auto", gap: 13, alignItems: "center" }}>
                        <div style={{ width: 42, height: 42, borderRadius: 10, background: C.goldFaint, color: C.gold, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Monitor size={18} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 730, color: C.text }}>Current Browser Session</div>
                          <div style={{ marginTop: 4, fontSize: 12, color: C.muted, lineHeight: 1.45 }}>
                            Signed in as {currentUser.username || profile.username || "admin"} on {new Date().toLocaleString()}.
                          </div>
                        </div>
                        <span style={{ padding: "5px 9px", borderRadius: 999, background: C.greenFaint, color: C.green, fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                          Active
                        </span>
                      </div>

                      <Notice>
                        Session history and logout-from-all-devices can be added once the backend exposes stored login activity.
                      </Notice>
                    </div>
                  </Panel>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
