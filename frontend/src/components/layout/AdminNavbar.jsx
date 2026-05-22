// src/components/layout/AdminNavbar.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authAPI } from "../../services/authAPI";
import bellevueLogo from "../../assets/bellevue-logo.png";

function AdminNavbar({ pendingCount: pendingProp, leftContent = null }) {
  const navigate  = useNavigate();
  const location  = useLocation();
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
      } catch {}
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [pendingProp]);

  useEffect(() => {
    const openAccountSettings = () => {
      resetProfileForm();
      setSettingsOpen(true);
    };

    window.addEventListener("bellevue:open-account-settings", openAccountSettings);
    return () => window.removeEventListener("bellevue:open-account-settings", openAccountSettings);
  }, []);

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
      height: 60,
      background: "#FFFFFF",
      borderBottom: "1px solid #E1E4E8",
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
        <img
          src={bellevueLogo}
          alt="The Bellevue Manila"
          style={{ width: 40, height: "auto", objectFit: "contain" }}
        />
        {leftContent}
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

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
            // FIX: use a darker, more visible gray (#374151) instead of #6B7280
            color: isNotifActive ? "#C9A84C" : "#374151",
            outline: isNotifActive ? "1.5px solid rgba(201,168,76,0.35)" : "none",
            // FIX: prevent button baseline from collapsing the icon
            lineHeight: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isNotifActive
              ? "rgba(201,168,76,0.16)"
              : "rgba(107,114,128,0.08)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = isNotifActive
              ? "rgba(201,168,76,0.10)"
              : "transparent";
          }}
        >
          {/* FIX: explicit stroke color as fallback in case currentColor isn't inherited */}
          <svg
            width="20" height="20" viewBox="0 0 24 24"
            fill="none"
            stroke={isNotifActive ? "#C9A84C" : "#374151"}
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

      {settingsOpen && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.38)",zIndex:6000,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }} onClick={(event)=>{ if(event.target === event.currentTarget) closeSettings(); }}>
          <div style={{ width:"100%",maxWidth:480,background:"#FFFFFF",borderRadius:12,border:"1px solid rgba(0,0,0,0.10)",boxShadow:"0 20px 60px rgba(0,0,0,0.22)",overflow:"hidden",fontFamily:"'Inter','Helvetica Neue',Arial,sans-serif" }}>
            <div style={{ padding:"18px 20px",borderBottom:"1px solid rgba(0,0,0,0.06)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12 }}>
              <div>
                <div style={{ fontSize:9,fontWeight:800,letterSpacing:"0.18em",textTransform:"uppercase",color:"#8C6B2A",marginBottom:5 }}>Personal Account</div>
                <div style={{ fontSize:20,fontWeight:800,color:"#18140E" }}>{editingProfile ? "Update Account" : "Account Details"}</div>
              </div>
              <button onClick={closeSettings} style={{ width:32,height:32,borderRadius:"50%",border:"1px solid rgba(0,0,0,0.08)",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7A7060" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ padding:20,display:"grid",gap:12 }}>
              {profileMessage && (
                <div style={{ padding:"10px 12px",borderRadius:8,fontSize:13,background:profileMessage.type==="error"?"rgba(160,56,56,0.08)":"rgba(46,122,90,0.08)",color:profileMessage.type==="error"?"#A03838":"#2E7A5A",border:`1px solid ${profileMessage.type==="error"?"rgba(160,56,56,0.18)":"rgba(46,122,90,0.18)"}` }}>
                  {profileMessage.text}
                </div>
              )}

              {!editingProfile ? (
                <>
                  <div style={{ display:"grid",gap:10 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:12,padding:"12px",border:"1px solid rgba(140,107,42,0.14)",borderRadius:10,background:"rgba(140,107,42,0.04)" }}>
                      <div style={{ width:42,height:42,borderRadius:"50%",background:"#FFFFFF",border:"1px solid rgba(140,107,42,0.24)",color:"#8C6B2A",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:13,flexShrink:0 }}>{initials || "A"}</div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:15,fontWeight:800,color:"#18140E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{displayName}</div>
                        <div style={{ fontSize:12,color:"#7A7060",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{currentUser.email || currentUser.username || "Account"}</div>
                      </div>
                    </div>
                    <AccountDetailRow label="Name" value={currentUser.name || "-"} />
                    <AccountDetailRow label="Email" value={currentUser.email || "-"} />
                    <AccountDetailRow label="Username" value={currentUser.username || "-"} />
                    <AccountDetailRow label="Role" value={roleLabel} />
                  </div>
                  <div style={{ display:"flex",gap:8,justifyContent:"flex-end",paddingTop:4 }}>
                    <button type="button" onClick={closeSettings} style={{ padding:"10px 14px",border:"1px solid rgba(0,0,0,0.10)",borderRadius:8,background:"transparent",color:"#7A7060",fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer" }}>Close</button>
                    <button type="button" onClick={(event)=>{ event.preventDefault(); event.stopPropagation(); setProfileMessage(null); setEditingProfile(true); }} style={{ padding:"10px 16px",border:"none",borderRadius:8,background:"#8C6B2A",color:"#fff",fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer" }}>Update Account</button>
                  </div>
                </>
              ) : (
                <form onSubmit={submitProfile} style={{ display:"grid",gap:12 }}>
                  <ProfileField label="Name"><input value={profile.name} onChange={(event)=>setProfile({...profile,name:event.target.value})} style={profileInputStyle()} /></ProfileField>
                  <ProfileField label="Email"><input type="email" value={profile.email} onChange={(event)=>setProfile({...profile,email:event.target.value})} style={profileInputStyle()} /></ProfileField>
                  <ProfileField label="Username"><input value={profile.username} onChange={(event)=>setProfile({...profile,username:event.target.value})} style={profileInputStyle()} /></ProfileField>
                  <div style={{ height:1,background:"rgba(0,0,0,0.06)",margin:"2px 0" }} />
                  <ProfileField label="Current Password"><input type="password" value={profile.current_password} onChange={(event)=>setProfile({...profile,current_password:event.target.value})} placeholder="Required only when changing password" style={profileInputStyle()} /></ProfileField>
                  <ProfileField label="New Password"><input type="password" value={profile.password} onChange={(event)=>setProfile({...profile,password:event.target.value})} style={profileInputStyle()} /></ProfileField>
                  <ProfileField label="Confirm Password"><input type="password" value={profile.password_confirmation} onChange={(event)=>setProfile({...profile,password_confirmation:event.target.value})} style={profileInputStyle()} /></ProfileField>
                  <div style={{ display:"flex",gap:8,justifyContent:"flex-end",paddingTop:4 }}>
                    <button type="button" onClick={()=>{ resetProfileForm(); setEditingProfile(false); }} style={{ padding:"10px 14px",border:"1px solid rgba(0,0,0,0.10)",borderRadius:8,background:"transparent",color:"#7A7060",fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer" }}>Cancel</button>
                    <button type="submit" disabled={savingProfile} style={{ padding:"10px 16px",border:"none",borderRadius:8,background:"#8C6B2A",color:"#fff",fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",cursor:savingProfile?"not-allowed":"pointer" }}>
                      {savingProfile ? "Saving..." : "Save Account"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
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

function ProfileField({ label, children }) {
  return (
    <label style={{ display:"grid",gap:6 }}>
      <span style={{ fontSize:9,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(24,20,14,0.42)" }}>{label}</span>
      {children}
    </label>
  );
}

function AccountDetailRow({ label, value }) {
  return (
    <div style={{ display:"grid",gridTemplateColumns:"110px minmax(0,1fr)",gap:12,alignItems:"center",padding:"10px 0",borderBottom:"1px solid rgba(0,0,0,0.06)" }}>
      <span style={{ fontSize:9,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(24,20,14,0.42)" }}>{label}</span>
      <span style={{ fontSize:13,fontWeight:700,color:"#18140E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{value}</span>
    </div>
  );
}

function profileInputStyle() {
  return {
    width:"100%",
    minHeight:40,
    border:"1px solid rgba(0,0,0,0.10)",
    borderRadius:7,
    padding:"9px 11px",
    fontSize:13,
    color:"#18140E",
    background:"#FFFFFF",
    outline:"none",
  };
}

export default AdminNavbar;
