import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authAPI } from "../../services/authAPI";
import { useAdminTheme } from "../../context/AdminThemeContext";

function AdminNavbar({ pendingCount: pendingProp, leftContent = null }) {
  const { isDark, toggleTheme } = useAdminTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(pendingProp ?? 0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  const currentUser = authAPI.getCurrentUser() || {};
  const [profile, setProfile] = useState({
    name: currentUser.name || "",
    email: currentUser.email || "",
    username: currentUser.username || "",
    current_password: "",
    password: "",
    password_confirmation: "",
  });

  // Keep badge in sync if parent passes pendingCount prop,
  // otherwise read from localStorage as a live fallback
  useEffect(() => {
    if (pendingProp !== undefined) { setPending(pendingProp); return; }
    const read = () => {
      try {
        const raw = localStorage.getItem("bellevue_pending_count");
        if (raw !== null) setPending(Number(raw));
      } catch { }
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [pendingProp]);

  useEffect(() => {
    const openAccountSettings = () => {
      navigate('/admin/settings');
    };

    window.addEventListener("bellevue:open-account-settings", openAccountSettings);
    return () => window.removeEventListener("bellevue:open-account-settings", openAccountSettings);
  }, [navigate]);

  const isNotifActive = location.pathname === "/admin/notifications";
  const roleLabel = roleLabels[currentUser.role] || currentUser.role || "Admin";
  const displayName = currentUser.name || currentUser.username || "Admin";
  const initials = String(displayName)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";

  const submitProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);

    try {
      const response = await authAPI.updateProfile({
        name: profile.name,
        email: profile.email,
        username: profile.username,
        ...(profile.password ? {
          current_password: profile.current_password,
          password: profile.password,
          password_confirmation: profile.password_confirmation,
        } : {}),
      });

      setProfile((prev) => ({
        ...prev,
        name: response.admin?.name || prev.name,
        email: response.admin?.email || prev.email,
        username: response.admin?.username || prev.username,
        current_password: "",
        password: "",
        password_confirmation: "",
      }));
      setProfileMessage({ type: "success", text: "Account updated." });
      setEditingProfile(false);
    } catch (error) {
      setProfileMessage({ type: "error", text: error.message || "Failed to update account." });
    } finally {
      setSavingProfile(false);
    }
  };

  const resetProfileForm = () => {
    const user = authAPI.getCurrentUser() || currentUser;
    setProfile({
      name: user.name || "",
      email: user.email || "",
      username: user.username || "",
      current_password: "",
      password: "",
      password_confirmation: "",
    });
    setProfileMessage(null);
  };

  const closeSettings = () => {
    resetProfileForm();
    setEditingProfile(false);
    setSettingsOpen(false);
  };

  return (
    <nav style={{
      height: 63,
      background: isDark ? "#111009" : "#FFFFFF",
      borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E1E4E8",
      display: "flex",
      alignItems: "center",
      padding: "0 32px",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 3000,
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {leftContent}
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            width: 38, height: 38,
            border: "none",
            background: "transparent",
            borderRadius: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s, color 0.15s",
            color: isDark ? "#C9A84C" : "#374151",
            lineHeight: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isDark
              ? "rgba(201,168,76,0.12)"
              : "rgba(107,114,128,0.08)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {isDark ? (
            /* Sun Icon when dark */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none", display: "block", flexShrink: 0 }}><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
          ) : (
            /* Moon Icon when light */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none", display: "block", flexShrink: 0 }}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          )}
        </button>

        {/* Bell icon — navigate to /admin/notifications */}
        <button
          onClick={() => navigate("/admin/notifications")}
          title="Notifications"
          style={{
            width: 38, height: 38,
            border: "none",
            background: isNotifActive ? "rgba(201,168,76,0.10)" : "transparent",
            borderRadius: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            transition: "background 0.15s",
            color: isNotifActive ? "#C9A84C" : (isDark ? "#EDE8DF" : "#374151"),
            outline: isNotifActive ? "1.5px solid rgba(201,168,76,0.35)" : "none",
            lineHeight: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isNotifActive
              ? "rgba(201,168,76,0.16)"
              : (isDark ? "rgba(255,255,255,0.08)" : "rgba(107,114,128,0.08)");
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = isNotifActive
              ? "rgba(201,168,76,0.10)"
              : "transparent";
          }}
        >
          <svg
            width="20" height="20" viewBox="0 0 24 24"
            fill="none"
            stroke={isNotifActive ? "#C9A84C" : (isDark ? "#EDE8DF" : "#374151")}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ pointerEvents: "none", display: "block", flexShrink: 0 }}
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>

          {/* Badge */}
          {pending > 0 && (
            <span style={{
              position: "absolute",
              top: 4, right: 4,
              background: "#EF4444",
              color: "#fff",
              borderRadius: "50%",
              minWidth: 16, height: 16,
              fontSize: 9,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Montserrat, sans-serif",
              padding: "0 3px",
              lineHeight: 1,
              pointerEvents: "none",
            }}>
              {pending > 99 ? "99+" : pending}
            </span>
          )}
        </button>

      </div>
    </nav>
  );
}

const roleLabels = {
  super_admin: "Super Admin",
  admin: "Admin",
  fb_director: "F&B Director",
  outlet_manager: "Outlet Manager",
  supervisor: "Supervisor",
  manager: "Outlet Manager",
  staff: "Staff",
  viewer: "Viewer",
  view_only: "Viewer",
};

export default AdminNavbar;
