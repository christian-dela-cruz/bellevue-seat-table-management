import { useMemo, useState, useEffect } from "react";
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
  Volume2,
} from "lucide-react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import VerificationModal from "../components/VerificationModal";
import TwoFactorSetupModal from "../components/TwoFactorSetupModal";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import Sidebar from "../../../components/layout/Sidebar";
import { authAPI } from "../../../services/authAPI";
import { roleAPI } from "../../../services/roleAPI";
import { useAdminTheme, C, F } from "../../../context/AdminThemeContext";

const DEFAULT_PREFERENCES = {
  reservationAlerts: true,
  cancellationAlerts: true,
  reportNotifications: false,
  systemUpdates: true,
  // Notification Audio & Voice settings
  enableChimeAlerts: true,
  enableVoiceAlerts: true,
  voiceAnnouncePending: true,
  voiceAnnounceApproved: true,
  voiceAnnounceReminders: true,
  voiceGender: "female",
  voiceAccent: "default",
  voiceTone: "standard",
  voiceRate: 0.88,
  voicePitch: 1.0,
};

const PREFERENCE_KEY = "bellevue_account_preferences";

function readStoredPreferences() {
  try {
    const raw = localStorage.getItem(PREFERENCE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      voiceAnnouncePending: parsed.voiceAnnouncePending ?? true,
      voiceAnnounceApproved: parsed.voiceAnnounceApproved ?? true,
      voiceAnnounceReminders: parsed.voiceAnnounceReminders ?? true,
      enableChimeAlerts: parsed.enableChimeAlerts ?? true,
      enableVoiceAlerts: parsed.enableVoiceAlerts ?? true,
      voiceGender: parsed.voiceGender ?? "female",
      voiceAccent: parsed.voiceAccent ?? "default",
      voiceTone: parsed.voiceTone ?? "standard",
    };
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
    padding: "8px 12px",
    fontFamily: F.body,
    fontSize: 12.8,
    color: C.text,
    background: C.surface,
    outline: "none",
    transition: "border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease",
    ...extra,
  };
}

function buttonStyle(kind = "primary", disabled = false) {
  const primary = kind === "primary";
  const ghost = kind === "ghost";
  return {
    minHeight: 36,
    padding: "0 14px",
    border: ghost ? "1px solid transparent" : `1px solid ${primary ? "rgba(140,107,42,0.22)" : C.border}`,
    borderRadius: 8,
    background: disabled ? "rgba(0,0,0,0.04)" : primary ? C.gold : ghost ? "transparent" : C.surface,
    color: disabled ? C.faint : primary ? "#FFFFFF" : ghost ? C.muted : C.gold,
    fontFamily: F.label,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    whiteSpace: "nowrap",
    boxShadow: primary && !disabled ? "0 2px 6px rgba(140,107,42,0.08)" : "none",
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
    <label style={{ display: "grid", gap: 6, minWidth: 0, textAlign: "left" }}>
      <span style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: C.muted }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, lineHeight: 1.4, color: C.muted, display: "block", marginTop: 2 }}>{hint}</span>}
    </label>
  );
}

function Notice({ type = "success", children }) {
  const isError = type === "error";
  const color = isError ? C.red : C.green;
  const bg = isError ? C.redFaint : C.greenFaint;
  const Icon = isError ? AlertCircle : CheckCircle2;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: bg, color, border: `1px solid ${color}2A`, borderRadius: 8, fontSize: 12.5, lineHeight: 1.45 }}>
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
        minHeight: 38,
        border: "none",
        borderRadius: 8,
        background: active ? C.goldFaint : "transparent",
        color: active ? C.gold : C.muted,
        display: "flex",
        alignItems: "center",
        gap: 10,
        textAlign: "left",
        padding: "8px 12px",
        cursor: "pointer",
        fontFamily: F.body,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        transition: "background 0.16s ease, color 0.16s ease",
      }}
      onMouseEnter={(event) => {
        if (!active) {
          event.currentTarget.style.background = "rgba(24,20,14,0.03)";
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
      <Icon size={16} style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {section.label}
      </span>
    </button>
  );
}

function ToggleRow({ title, description, checked, onChange, disabled = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 0",
        borderBottom: `1px solid ${C.divider}`,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{ minWidth: 0, paddingRight: 16 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text }}>{title}</span>
        {description && <span style={{ display: "block", marginTop: 2, fontSize: 11.5, color: C.muted, lineHeight: 1.4 }}>{description}</span>}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        style={{
          width: 38,
          height: 20,
          borderRadius: 999,
          background: checked ? C.gold : "rgba(0,0,0,0.12)",
          border: "none",
          position: "relative",
          transition: "background 0.16s ease",
          cursor: "pointer",
          flexShrink: 0,
          outline: "none",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 20 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#FFFFFF",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            transition: "left 0.16s ease",
          }}
        />
      </button>
    </div>
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
        <Icon size={14} />
      </button>
    </div>
  );
}

export default function AccountSettings() {
  const { isDark, updateUser, updateAvatar } = useAdminTheme();
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

  const [sessions, setSessions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  // Available voices for speech synthesis
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices() || [];
      const englishVoices = allVoices.filter(v => v.lang.startsWith("en"));
      setVoices(englishVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const getVoiceConfiguration = (gender = "female", tone = "standard", voicesList, baseRate = 0.88, basePitch = 1.0) => {
    const result = {
      voice: null,
      rate: baseRate,
      pitch: basePitch
    };

    const list = (voicesList && voicesList.length > 0)
      ? voicesList
      : (typeof window !== "undefined" && window.speechSynthesis
         ? window.speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith("en"))
         : []);

    if (list.length === 0) return result;

    // 1. Filter by gender
    const isMalePref = gender === "male";
    let genderFiltered = [];
    if (isMalePref) {
      genderFiltered = list.filter(v => 
        /david|george|mark|ravi|daniel|richard|steve|alex|fred|male/i.test(v.name)
      );
    } else {
      genderFiltered = list.filter(v => 
        /zira|samantha|susan|hazel|heather|karen|moira|tessa|veena|siri|female/i.test(v.name)
      );
    }

    if (genderFiltered.length === 0) {
      if (isMalePref) {
        genderFiltered = list.filter(v => /david|george|mark|ravi|daniel|richard|steve|alex|fred|male/i.test(v.name));
      } else {
        genderFiltered = list.filter(v => /zira|samantha|susan|hazel|heather|karen|moira|tessa|veena|siri|female/i.test(v.name));
      }
    }

    const finalSelectionList = genderFiltered.length > 0 ? genderFiltered : list;

    // 2. Map tone parameters and choose different index voices if available to make them uniquely distinct
    let selectedVoice = null;
    let pitchMultiplier = 1.0;
    let rateMultiplier = 1.0;

    let genderPitchAdjustment = isMalePref ? 0.90 : 1.05;

    if (tone === "standard") {
      selectedVoice = finalSelectionList[0];
      pitchMultiplier = 1.0;
      rateMultiplier = 1.0;
    } else if (tone === "natural") {
      // Natural / Casual: slightly lower pitch, slower rate for a relaxed conversational cadence
      selectedVoice = finalSelectionList.find(v => /google|natural|premium|neural/i.test(v.name)) || finalSelectionList[1] || finalSelectionList[0];
      pitchMultiplier = 0.90;
      rateMultiplier = 0.85;
    } else if (tone === "clear") {
      // Energetic / Clear: higher pitch, faster rate to sound alert, energetic and crisp
      selectedVoice = finalSelectionList[2] || finalSelectionList[0];
      pitchMultiplier = 1.20;
      rateMultiplier = 1.15;
    } else if (tone === "warm") {
      // Deep / Warm: significantly lower pitch, slower speed for a warm, soothing character
      selectedVoice = finalSelectionList[3] || finalSelectionList[1] || finalSelectionList[0];
      pitchMultiplier = 0.75;
      rateMultiplier = 0.80;
    }

    result.voice = selectedVoice || list[0];
    result.pitch = Math.max(0.5, Math.min(2.0, basePitch * pitchMultiplier * genderPitchAdjustment));
    result.rate = Math.max(0.5, Math.min(2.0, baseRate * rateMultiplier));

    return result;
  };

  const handleTestVoice = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      showMessage({ type: "error", text: "Speech synthesis not supported on this device." });
      return;
    }
    
    window.speechSynthesis.cancel();
    
    const config = getVoiceConfiguration(
      preferences.voiceGender || "female",
      preferences.voiceTone || "standard",
      voices,
      parseFloat(preferences.voiceRate || 0.88),
      parseFloat(preferences.voicePitch || 1.0)
    );

    const textToSpeak = `Test announcement. This is a preview of your selected ${preferences.voiceGender} voice, using the ${preferences.voiceTone} tone settings.`;
    const u = new SpeechSynthesisUtterance(textToSpeak);
    
    u.rate = config.rate;
    u.pitch = config.pitch;
    u.volume = 1;
    if (config.voice) u.voice = config.voice;
    
    window.speechSynthesis.speak(u);
  };
  
  // Modals state
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [verifTargetEmail, setVerifTargetEmail] = useState("");
  const [verifTargetUsername, setVerifTargetUsername] = useState("");
  
  const [tfSetupModalOpen, setTfSetupModalOpen] = useState(false);
  const [tfSetupMode, setTfSetupMode] = useState("setup");

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await authAPI.getActiveSessions();
      if (res.success) {
        setSessions(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAuditLogs(true);
    try {
      const res = await authAPI.getAuditLogs();
      if (res.success) {
        setAuditLogs(res.data || []);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchAuditLogs();
  }, []);

  const handleRevokeSession = async (id) => {
    try {
      const res = await authAPI.revokeSession(id);
      if (res.success) {
        showMessage({ type: "success", text: "Session revoked successfully." });
        fetchSessions();
      }
    } catch (err) {
      showMessage({ type: "error", text: err.message || "Failed to revoke session." });
    }
  };
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
  const [savedPreferences, setSavedPreferences] = useState(() => readStoredPreferences());

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

  const securityDirty = Boolean(security.current_password || security.password || security.password_confirmation);

  const preferencesDirty = preferences.reservationAlerts !== savedPreferences.reservationAlerts
    || preferences.cancellationAlerts !== savedPreferences.cancellationAlerts
    || preferences.reportNotifications !== savedPreferences.reportNotifications
    || preferences.systemUpdates !== savedPreferences.systemUpdates
    || preferences.enableChimeAlerts !== savedPreferences.enableChimeAlerts
    || preferences.enableVoiceAlerts !== savedPreferences.enableVoiceAlerts
    || preferences.voiceAnnouncePending !== savedPreferences.voiceAnnouncePending
    || preferences.voiceAnnounceApproved !== savedPreferences.voiceAnnounceApproved
    || preferences.voiceAnnounceReminders !== savedPreferences.voiceAnnounceReminders
    || preferences.voiceGender !== savedPreferences.voiceGender
    || preferences.voiceAccent !== savedPreferences.voiceAccent
    || preferences.voiceTone !== savedPreferences.voiceTone
    || preferences.voiceRate !== savedPreferences.voiceRate
    || preferences.voicePitch !== savedPreferences.voicePitch;

  const isDirty = profileDirty || securityDirty || preferencesDirty;

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

  const groups = [
    {
      title: "General",
      items: [
        { id: "profile", label: "Profile", icon: UserCircle },
        { id: "notifications", label: "Notifications", icon: Bell },
      ]
    },
    {
      title: "Security & Access",
      items: [
        { id: "security", label: "Security", icon: Shield },
        { id: "sessions", label: "Sessions", icon: Laptop },
        { id: "audit-logs", label: "Security Log", icon: KeyRound },
      ]
    }
  ];

  const showMessage = (nextMessage) => {
    setMessage(nextMessage);
    window.setTimeout(() => setMessage(null), 4200);
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
      updateAvatar(result);
      showMessage({ type: "success", text: "Profile photo ready. Save changes to apply." });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const removeAvatar = () => {
    setAvatarPreview("");
    updateAvatar("");
    showMessage({ type: "success", text: "Profile photo removal ready. Save changes to apply." });
  };

  const resetAllDrafts = () => {
    // Revert profile inputs & avatar
    setProfile({
      name: currentUser.name || "",
      email: currentUser.email || "",
      username: currentUser.username || "",
    });
    setAvatarPreview(savedAvatar);
    updateAvatar(savedAvatar);

    // Revert password fields
    setSecurity({
      current_password: "",
      password: "",
      password_confirmation: "",
    });

    // Revert notification preferences
    setPreferences(savedPreferences);
  };

  const handleSaveSubmit = async (e) => {
    if (e) e.preventDefault();
    
    // Check if sensitive profile fields changed
    const emailChanged = profile.email !== (currentUser.email || "");
    const usernameChanged = profile.username !== (currentUser.username || "");
    
    if (emailChanged) {
      setVerifTargetEmail(profile.email);
      setVerifTargetUsername("");
      setVerificationModalOpen(true);
      return;
    }
    
    if (usernameChanged) {
      setVerifTargetEmail("");
      setVerifTargetUsername(profile.username);
      setVerificationModalOpen(true);
      return;
    }
    
    // Default direct save for non-sensitive edits
    saveAllChanges();
  };

  const handleVerificationSuccess = async (confirmedPassword) => {
    setVerificationModalOpen(false);
    setMessage(null);
    let successCount = 0;
    let failMessage = null;
    
    setSavingProfile(true);
    try {
      const emailChanged = profile.email !== (currentUser.email || "");
      const usernameChanged = profile.username !== (currentUser.username || "");
      
      let nextUser = currentUser;
      const previousAvatarKey = avatarKeyFor(currentUser);
      
      const payload = {
        name: profile.name,
        username: profile.username,
        email: profile.email,
      };
      
      if (usernameChanged) {
        payload.current_password = confirmedPassword;
      }
      
      const response = await authAPI.updateProfile(payload);
      nextUser = response?.admin || { ...currentUser, ...profile };
      
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
      updateUser(nextUser);
      updateAvatar(avatarPreview);
      setSavedAvatar(avatarPreview);
      successCount++;
      
      fetchSessions();
      fetchAuditLogs();
      
      // If there were security password changes, let's also update them now that we have confirmed password!
      if (securityDirty) {
        setSavingSecurity(true);
        try {
          if (security.password !== security.password_confirmation) {
            throw new Error("New password and confirmation do not match.");
          }
          await authAPI.updateProfile({
            ...profile,
            current_password: confirmedPassword,
            password: security.password,
            password_confirmation: security.password_confirmation,
          });
          setSecurity({ current_password: "", password: "", password_confirmation: "" });
          successCount++;
        } catch (secError) {
          failMessage = secError.message || "Password update failed.";
        } finally {
          setSavingSecurity(false);
        }
      }
      
      // Save preferences if dirty
      if (preferencesDirty) {
        setSavingPreferences(true);
        try {
          localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences));
          setSavedPreferences(preferences);
          successCount++;
        } catch {
          failMessage = "Unable to save preferences on this device.";
        } finally {
          setSavingPreferences(false);
        }
      }
      
      if (failMessage) {
        showMessage({ type: "error", text: failMessage });
      } else {
        showMessage({ type: "success", text: "All changes saved successfully." });
      }
      
    } catch (error) {
      showMessage({ type: "error", text: error.message || "Profile update failed." });
    } finally {
      setSavingProfile(false);
    }
  };

  const saveAllChanges = async () => {
    setMessage(null);
    let successCount = 0;
    let failMessage = null;

    // 1. Save profile
    if (profileDirty) {
      setSavingProfile(true);
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
        updateUser(nextUser);
        updateAvatar(avatarPreview);
        setSavedAvatar(avatarPreview);
        successCount++;
      } catch (error) {
        failMessage = error.message || "Profile update failed.";
      } finally {
        setSavingProfile(false);
      }
    }

    // 2. Save security
    if (securityDirty) {
      setSavingSecurity(true);
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
        successCount++;
      } catch (error) {
        failMessage = error.message || "Password update failed.";
      } finally {
        setSavingSecurity(false);
      }
    }

    // 3. Save preferences
    if (preferencesDirty) {
      setSavingPreferences(true);
      try {
        localStorage.setItem(PREFERENCE_KEY, JSON.stringify(preferences));
        setSavedPreferences(preferences);
        successCount++;
      } catch {
        failMessage = "Unable to save preferences on this device.";
      } finally {
        setSavingPreferences(false);
      }
    }

    if (failMessage) {
      showMessage({ type: "error", text: failMessage });
    } else if (successCount > 0) {
      showMessage({ type: "success", text: "All changes saved successfully." });
    }
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(`settings-section-${id}`);
    if (el) {
      const container = document.querySelector(".account-settings-shell");
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const scrollTop = container.scrollTop + elRect.top - containerRect.top - 20; // 20px offset
        container.scrollTo({ top: scrollTop, behavior: "smooth" });
      }
    }
  };

  useEffect(() => {
    const container = document.querySelector(".account-settings-shell");
    if (!container) return;

    const observerOptions = {
      root: container,
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0,
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id.replace("settings-section-", "");
          setActiveSection(id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    const targets = ["profile", "notifications", "security", "sessions", "audit-logs"].map((id) =>
      document.getElementById(`settings-section-${id}`)
    );

    targets.forEach((target) => {
      if (target) observer.observe(target);
    });

    return () => {
      targets.forEach((target) => {
        if (target) observer.unobserve(target);
      });
    };
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: F.body, background: C.pageBg, color: C.text }}>
      <style>{`
        @keyframes accountSettingsSpin { to { transform: rotate(360deg); } }
        .account-settings-shell input:focus,
        .account-settings-shell select:focus {
          border-color: rgba(140,107,42,0.34) !important;
          box-shadow: 0 0 0 3px rgba(140,107,42,0.10);
        }
        .account-settings-grid {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 28px;
          align-items: start;
        }
        .account-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(200px, 1fr));
          gap: 12px 16px;
          align-items: start;
          max-width: 800px;
        }
        .account-profile-form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .account-settings-grid { grid-template-columns: 1fr; }
          .account-settings-nav { position: static !important; display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 760px) {
          .account-form-grid,
          .account-profile-form-grid,
          .account-settings-nav { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activeNav="settings" />

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", flex: 1, minWidth: 0, overflow: "hidden" }}>
        <AdminNavbar />

        <main className="account-settings-shell" style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "30px 32px 42px", position: "relative" }}>
          <div style={{ maxWidth: 1080, display: "grid", gap: 18 }}>
            <AdminPageHeader
              eyebrow="ACCOUNT"
              title="Account Settings"
              description="Manage your profile settings, configure devices preferences, set passwords, and monitor login activity from a single consolidated page."
              C={C}
              F={F}
            />

            {message && <Notice type={message.type}>{message.text}</Notice>}

            <div className="account-settings-grid">
              {/* Sticky TOC */}
              <aside className="account-settings-nav" style={{ position: "sticky", top: 0, display: "grid", gap: 16, alignSelf: "start", zIndex: 10 }}>
                {groups.map((group) => (
                  <div key={group.title} style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: C.faint, paddingLeft: 12, marginBottom: 2 }}>
                      {group.title}
                    </div>
                    {group.items.map((section) => (
                      <SettingsNavButton
                        key={section.id}
                        section={section}
                        active={activeSection === section.id}
                        onClick={() => {
                          setActiveSection(section.id);
                          scrollToSection(section.id);
                        }}
                      />
                    ))}
                  </div>
                ))}
              </aside>

              {/* Main settings container (Multiple Cards Layout) */}
              <div style={{ display: "grid", gap: 24, minWidth: 0 }}>
                
                {/* 1. Profile Section Card */}
                <div id="settings-section-profile" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px 28px", boxShadow: "0 4px 18px rgba(0,0,0,0.015)", display: "grid", gap: 18, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>Profile Information</h2>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>Keep your account identity clear for reservation actions and audit trails.</p>
                    </div>
                    {profileDirty && (
                      <span style={{ padding: "4px 8px", borderRadius: 999, background: C.goldFaint, color: C.gold, fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                        Unsaved changes
                      </span>
                    )}
                  </div>

                  <form onSubmit={handleSaveSubmit} style={{ display: "grid", gap: 18 }}>
                    {/* Compact Horizontal Profile Photo Selector */}
                    <div style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: `1px solid ${C.divider}`, paddingBottom: 18, marginBottom: 4 }}>
                      <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.gold, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 850, overflow: "hidden", flexShrink: 0, boxShadow: "0 4px 12px rgba(140,107,42,0.12)" }}>
                        {avatarPreview ? (
                          <img src={avatarPreview} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Profile Picture</div>
                        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>PNG, JPG under 2 MB</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <label style={{ ...buttonStyle("secondary"), minHeight: 32, padding: "0 12px", border: `1px solid ${C.border}`, background: "transparent", color: C.text }}>
                          <Upload size={12} />
                          Upload photo
                          <input type="file" accept="image/*" onChange={uploadAvatar} style={{ display: "none" }} />
                        </label>
                        {avatarPreview && (
                          <button type="button" onClick={removeAvatar} style={{ ...buttonStyle("ghost"), minHeight: 32, padding: "0 10px", color: C.red }}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="account-profile-form-grid">
                      <div className="account-form-grid">
                        <Field label="Full Name">
                          <input value={profile.name} onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))} required style={inputStyle()} />
                        </Field>
                        <Field label="Username / Login ID">
                          <input value={profile.username} onChange={(event) => setProfile((prev) => ({ ...prev, username: event.target.value }))} required style={inputStyle()} />
                        </Field>
                        <Field label="Email Address">
                          <input type="email" value={profile.email} onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))} required style={inputStyle()} />
                        </Field>
                        <Field label="System Role" hint="Role changes are managed by authorized administrators.">
                          <input value={formatRole(role, availableRoles)} disabled style={inputStyle({ background: C.surfaceSoft, color: C.muted })} />
                        </Field>
                      </div>

                      {/* Venue Scopes */}
                      <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 14, display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: C.gold }}>
                            Assigned Venues & Outlets
                          </div>
                          <span style={{ fontSize: 11.5, color: C.muted }}>
                            {hasFullScope ? "Full access" : "Scoped access"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {hasFullScope ? (
                            <span style={{ padding: "5px 10px", borderRadius: 6, background: C.surfaceSoft, border: `1px solid ${C.border}`, color: C.text, fontFamily: F.label, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                              All venues and outlets
                            </span>
                          ) : assignedVenues.length ? (
                            assignedVenues.map((venue) => (
                              <span key={venue} style={{ padding: "5px 10px", borderRadius: 6, background: C.surfaceSoft, border: `1px solid ${C.border}`, color: C.text, fontFamily: F.label, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                                {venue}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: 11.5, color: C.muted }}>No venue or outlet assignments listed for this account.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </form>
                </div>

                {/* 2. Notifications Section Card */}
                <div id="settings-section-notifications" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px 28px", boxShadow: "0 4px 18px rgba(0,0,0,0.015)", display: "grid", gap: 0, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>Notification Preferences</h2>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>Choose which operational alerts should be emphasized for your current device.</p>
                    </div>
                    {preferencesDirty && (
                      <span style={{ padding: "4px 8px", borderRadius: 999, background: C.goldFaint, color: C.gold, fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                        Unsaved changes
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 2 }}>
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

                  {/* Sound & Voice Settings Subsection */}
                  <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${C.divider}` }}>
                    <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: C.text }}>Audio & Voice Alerts</h3>
                    <p style={{ margin: "2px 0 14px", fontSize: 11.5, color: C.muted }}>Customize real-time chime sounds and text-to-speech voice parameters.</p>

                    <div style={{ display: "grid", gap: 14 }}>
                      <ToggleRow
                        title="Enable Sound Chimes"
                        description="Play an attention-grabbing beep chime when a notification is triggered."
                        checked={preferences.enableChimeAlerts}
                        onChange={(value) => setPreferences((prev) => ({ ...prev, enableChimeAlerts: value }))}
                      />
                      <ToggleRow
                        title="Enable Voice Announcements"
                        description="Announce guest and outlet details aloud using text-to-speech."
                        checked={preferences.enableVoiceAlerts}
                        onChange={(value) => setPreferences((prev) => ({ ...prev, enableVoiceAlerts: value }))}
                      />
                      
                      {preferences.enableVoiceAlerts && (
                        <div style={{ paddingLeft: 20, borderLeft: `2px solid ${C.gold}24`, display: "grid", gap: 8, marginTop: 2, marginBottom: 8 }}>
                          <ToggleRow
                            title="New Reservation Requests"
                            description="Speak details when a new pending reservation is received."
                            checked={preferences.voiceAnnouncePending}
                            onChange={(value) => setPreferences((prev) => ({ ...prev, voiceAnnouncePending: value }))}
                          />
                          <ToggleRow
                            title="Approved Bookings"
                            description="Speak details when a reservation is approved or confirmed."
                            checked={preferences.voiceAnnounceApproved}
                            onChange={(value) => setPreferences((prev) => ({ ...prev, voiceAnnounceApproved: value }))}
                          />
                          <ToggleRow
                            title="Upcoming Event Reminders"
                            description="Speak reminder alerts for upcoming events."
                            checked={preferences.voiceAnnounceReminders}
                            onChange={(value) => setPreferences((prev) => ({ ...prev, voiceAnnounceReminders: value }))}
                          />
                        </div>
                      )}

                      {preferences.enableVoiceAlerts && (
                        <div style={{ display: "grid", gap: 14, padding: "14px 16px", background: C.surfaceSoft, border: `1px solid ${C.border}`, borderRadius: 10, marginTop: 6 }}>
                           {/* Voice Persona Selectors */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <Field label="Voice Gender" hint="Select the announcer's voice gender.">
                              <select
                                value={preferences.voiceGender}
                                onChange={(e) => setPreferences(prev => ({ ...prev, voiceGender: e.target.value }))}
                                style={inputStyle()}
                              >
                                <option value="female">Female Voice</option>
                                <option value="male">Male Voice</option>
                              </select>
                            </Field>

                            <Field label="Voice Tone / Character" hint="Choose sound profile or personality.">
                              <select
                                value={preferences.voiceTone}
                                onChange={(e) => setPreferences(prev => ({ ...prev, voiceTone: e.target.value }))}
                                style={inputStyle()}
                              >
                                <option value="standard">Standard Tone</option>
                                <option value="natural">Casual / Natural Tone</option>
                                <option value="clear">Energetic / Clear Tone</option>
                                <option value="warm">Deep / Warm Tone</option>
                              </select>
                            </Field>
                          </div>

                          {/* Sliders Grid */}
                          <div className="account-form-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <Field label={`Speech Speed: ${preferences.voiceRate}x`} hint="Adjust how fast the announcer speaks.">
                              <div style={{ display: "flex", alignItems: "center", gap: 10, height: 38 }}>
                                <input
                                  type="range"
                                  min="0.5"
                                  max="1.5"
                                  step="0.05"
                                  value={preferences.voiceRate}
                                  onChange={(e) => setPreferences(prev => ({ ...prev, voiceRate: parseFloat(e.target.value) }))}
                                  style={{ flex: 1, accentColor: C.gold }}
                                />
                              </div>
                            </Field>
                            <Field label={`Speech Pitch: ${preferences.voicePitch}`} hint="Adjust the pitch/tone of the voice.">
                              <div style={{ display: "flex", alignItems: "center", gap: 10, height: 38 }}>
                                <input
                                  type="range"
                                  min="0.5"
                                  max="1.5"
                                  step="0.05"
                                  value={preferences.voicePitch}
                                  onChange={(e) => setPreferences(prev => ({ ...prev, voicePitch: parseFloat(e.target.value) }))}
                                  style={{ flex: 1, accentColor: C.gold }}
                                />
                              </div>
                            </Field>
                          </div>

                          {/* Preview / Test Voice */}
                          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                            <button
                              type="button"
                              onClick={handleTestVoice}
                              style={{
                                ...buttonStyle("ghost"),
                                fontSize: 10,
                                padding: "6px 12px",
                                border: `1px solid ${C.gold}20`,
                                color: C.gold,
                                background: C.goldFaint,
                              }}
                            >
                              <Volume2 size={13} />
                              Test Voice Settings
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Security Section Card */}
                <div id="settings-section-security" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px 28px", boxShadow: "0 4px 18px rgba(0,0,0,0.015)", display: "grid", gap: 14, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>Password Management</h2>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>Update your password using your current password to secure operational access.</p>
                    </div>
                    {securityDirty && (
                      <span style={{ padding: "4px 8px", borderRadius: 999, background: C.goldFaint, color: C.gold, fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase" }}>
                        Unsaved changes
                      </span>
                    )}
                  </div>

                  <form onSubmit={handleSaveSubmit} style={{ display: "grid", gap: 14 }}>
                    <div className="account-form-grid">
                      <Field label="Current Password">
                        <PasswordInput
                          value={security.current_password}
                          onChange={(event) => setSecurity((prev) => ({ ...prev, current_password: event.target.value }))}
                          required
                          visible={showPasswords.current}
                          onToggle={() => setShowPasswords((prev) => ({ ...prev, current: !prev.current }))}
                        />
                      </Field>
                      <Field label="New Password">
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
                      <Field label="Password Strength">
                        <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: C.surfaceSoft, padding: "8px 12px", display: "grid", gap: 6, minHeight: 38, boxSizing: "border-box" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.text, fontSize: 11.5, fontWeight: 700 }}>
                              <LockKeyhole size={13} color={passwordStrength.color} />
                              {passwordStrength.label}
                            </span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 4 }}>
                            {[1, 2, 3, 4].map((step) => (
                              <span key={step} style={{ height: 3, borderRadius: 999, background: passwordStrength.score >= step ? passwordStrength.color : "rgba(0,0,0,0.08)" }} />
                            ))}
                          </div>
                        </div>
                      </Field>
                    </div>
                  </form>

                  {/* 2FA Toggle Card */}
                  <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 18, marginTop: 18, display: "grid", gap: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: C.text }}>Two-Factor Authentication (2FA)</h3>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: C.muted }}>Add an extra layer of security to your account using TOTP code verification.</p>
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 14px", border: `1px solid ${currentUser.two_factor_enabled ? C.gold + "40" : C.border}`, borderRadius: 10, background: currentUser.two_factor_enabled ? C.goldFaint : C.surfaceSoft }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: currentUser.two_factor_enabled ? C.gold : "rgba(0,0,0,0.06)", color: currentUser.two_factor_enabled ? "#FFFFFF" : C.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Shield size={16} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>
                            Status: {currentUser.two_factor_enabled ? "Enabled" : "Disabled"}
                          </div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                            {currentUser.two_factor_enabled 
                              ? "Your account is secured with 2FA authenticator verification." 
                              : "Authenticator protection is currently inactive."}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (currentUser.two_factor_enabled) {
                            setTfSetupMode("disable");
                          } else {
                            setTfSetupMode("setup");
                          }
                          setTfSetupModalOpen(true);
                        }}
                        style={{
                          ...buttonStyle(currentUser.two_factor_enabled ? "secondary" : "primary"),
                          minHeight: 30,
                          padding: "0 12px",
                          fontSize: 10,
                          border: currentUser.two_factor_enabled ? `1px solid ${C.red}30` : undefined,
                          color: currentUser.two_factor_enabled ? C.red : undefined,
                        }}
                      >
                        {currentUser.two_factor_enabled ? "Disable 2FA" : "Enable 2FA"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4. Sessions Section Card */}
                <div id="settings-section-sessions" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px 28px", boxShadow: "0 4px 18px rgba(0,0,0,0.015)", display: "grid", gap: 12, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: C.text }}>Device Sessions</h2>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted, lineHeight: 1.4 }}>Monitor the browser sessions logged into your account and revoke any unauthorized device logins.</p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                    {loadingSessions ? (
                      <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
                        <Spinner color={C.gold} size={16} />
                      </div>
                    ) : sessions.length > 0 ? (
                      sessions.map((sess) => (
                        <div key={sess.id} style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: `1px solid ${C.borderFaint}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: sess.is_current ? C.goldFaint : C.surfaceSoft, color: sess.is_current ? C.gold : C.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Monitor size={16} />
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{sess.device}</div>
                              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                                IP: <span style={{ fontFamily: "monospace" }}>{sess.ip_address}</span> • Last active: {sess.is_current ? "Active now" : sess.last_active_at ? new Date(sess.last_active_at).toLocaleString() : "Unknown"}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {sess.is_current ? (
                              <span style={{ padding: "4px 10px", borderRadius: 6, background: C.greenFaint, color: C.green, fontFamily: F.label, fontSize: 9, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                                Current
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRevokeSession(sess.id)}
                                style={{
                                  ...buttonStyle("ghost"),
                                  minHeight: 28,
                                  padding: "0 10px",
                                  color: C.red,
                                  border: `1px solid ${C.red}20`,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = C.redFaint;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "transparent";
                                }}
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{
                        border: `1.5px dashed ${C.border}`,
                        borderRadius: 12,
                        padding: "32px 24px",
                        textAlign: "center",
                        color: C.muted,
                        background: C.surfaceSoft,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                      }}>
                        <Monitor size={24} style={{ color: C.goldSoft, opacity: 0.8 }} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>No other active sessions</div>
                        <div style={{ fontSize: 11.5, color: C.muted, maxWidth: 300, lineHeight: 1.45 }}>
                          You are currently not signed in on any other devices or browsers.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Audit Logs Section Card */}
                <div id="settings-section-audit-logs" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "24px 28px", boxShadow: "0 4px 18px rgba(0,0,0,0.015)", display: "grid", gap: 10, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 14 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: C.text }}>Security Log</h2>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted, lineHeight: 1.4 }}>Review the history of security changes, sign-in logs, and profile updates made to your account.</p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {loadingAuditLogs ? (
                      <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
                        <Spinner color={C.gold} size={16} />
                      </div>
                    ) : auditLogs.length > 0 ? (
                      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", background: C.surfaceBase }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                          <thead>
                            <tr style={{ background: C.surfaceSoft, borderBottom: `1px solid ${C.border}` }}>
                              <th style={{ padding: "12px 16px", fontFamily: F.label, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>Action</th>
                              <th style={{ padding: "12px 16px", fontFamily: F.label, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>IP Address</th>
                              <th style={{ padding: "12px 16px", fontFamily: F.label, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>Date / Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {auditLogs.map((log) => {
                              const is2FA = log.action.includes("2fa");
                              const isEmail = log.action.includes("email");
                              const bg = is2FA ? C.goldFaint : isEmail ? C.blueFaint : C.surfaceSoft;
                              const textCol = is2FA ? C.gold : isEmail ? C.blue : C.textSecondary;
                              const borderCol = is2FA ? C.borderAccent : isEmail ? C.blueBorder : C.border;
                              
                              return (
                                <tr key={log.id} style={{ borderBottom: `1px solid ${C.borderFaint}`, background: C.surface }}>
                                  <td style={{ padding: "12px 16px" }}>
                                    <span style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                      background: bg,
                                      color: textCol,
                                      border: `1px solid ${borderCol}`,
                                      fontFamily: F.label,
                                      fontSize: 9,
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.04em",
                                      whiteSpace: "nowrap"
                                    }}>
                                      {log.action.replace(/_/g, " ")}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: C.textSecondary }}>{log.ip_address}</td>
                                  <td style={{ padding: "12px 16px", fontSize: 12, color: C.muted }}>{new Date(log.created_at).toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div style={{
                        border: `1.5px dashed ${C.border}`,
                        borderRadius: 12,
                        padding: "32px 24px",
                        textAlign: "center",
                        color: C.muted,
                        background: C.surfaceSoft,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                      }}>
                        <Shield size={24} style={{ color: C.goldSoft, opacity: 0.8 }} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>No recent events</div>
                        <div style={{ fontSize: 11.5, color: C.muted, maxWidth: 300, lineHeight: 1.45 }}>
                          No security events or settings updates have been performed on this account yet.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Global Action Bar */}
      <div
        style={{
          position: "fixed",
          bottom: isDirty ? 24 : -100,
          left: "50%",
          transform: "translateX(-50%)",
          width: "calc(100% - 64px)",
          maxWidth: 800,
          background: isDark ? "rgba(17, 16, 9, 0.95)" : "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          border: `1px solid ${C.gold}`,
          borderRadius: 16,
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 20px 48px rgba(0,0,0,0.15), 0 8px 20px rgba(140,107,42,0.1)",
          zIndex: 1000,
          opacity: isDirty ? 1 : 0,
          transition: "bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
          pointerEvents: isDirty ? "auto" : "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            You have unsaved changes
          </span>
          <span style={{ fontSize: 11.5, color: C.muted }}>
            Please save or reset your changes before leaving this page.
          </span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={resetAllDrafts}
            disabled={savingProfile || savingSecurity || savingPreferences}
            style={buttonStyle("ghost")}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSaveSubmit}
            disabled={savingProfile || savingSecurity || savingPreferences}
            style={buttonStyle("primary")}
          >
            {savingProfile || savingSecurity || savingPreferences ? (
              <Spinner color="#FFFFFF" />
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Save size={14} />
                Save Changes
              </span>
            )}
          </button>
        </div>
      </div>

      <VerificationModal
        isOpen={verificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
        targetEmail={verifTargetEmail}
        targetUsername={verifTargetUsername}
        onVerificationSuccess={handleVerificationSuccess}
      />
      
      <TwoFactorSetupModal
        isOpen={tfSetupModalOpen}
        onClose={() => setTfSetupModalOpen(false)}
        mode={tfSetupMode}
        onSuccess={() => {
          setTfSetupModalOpen(false);
          const updatedUser = { ...currentUser, two_factor_enabled: tfSetupMode === "setup" };
          setCurrentUser(updatedUser);
          updateUser(updatedUser);
          showMessage({
            type: "success",
            text: tfSetupMode === "setup"
              ? "Two-Factor Authentication enabled successfully."
              : "Two-Factor Authentication disabled successfully."
          });
          fetchAuditLogs();
        }}
      />
    </div>
  );
}
