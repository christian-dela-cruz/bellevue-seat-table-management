import { useEffect, useMemo, useState } from "react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import Sidebar from "../../../components/layout/Sidebar";
import { authAPI } from "../../../services/authAPI";

const C = {
  pageBg: "#F7F4EE",
  surface: "#FFFFFF",
  surfaceSoft: "#FAF8F4",
  border: "rgba(0,0,0,0.08)",
  divider: "rgba(0,0,0,0.05)",
  gold: "#8C6B2A",
  goldFaint: "rgba(140,107,42,0.08)",
  green: "#2E7A5A",
  greenFaint: "rgba(46,122,90,0.08)",
  red: "#A03838",
  redFaint: "rgba(160,56,56,0.08)",
  text: "#18140E",
  muted: "#7A7060",
  faint: "rgba(24,20,14,0.42)",
};

const F = {
  body: "'Inter','Helvetica Neue',Arial,sans-serif",
  label: "'Inter','Helvetica Neue',Arial,sans-serif",
};

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  fb_director: "F&B Director",
  outlet_manager: "Outlet Manager",
  staff: "Staff",
  viewer: "Viewer",
};

const DEFAULT_FORM = {
  name: "",
  email: "",
  username: "",
  password: "",
  role: "viewer",
  scope_type: "all",
  outlet_scope: "",
};

function SectionTitle({ eyebrow, title }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.20em",textTransform:"uppercase",color:C.gold,marginBottom:5 }}>
        {eyebrow}
      </div>
      <h2 style={{ margin:0,fontFamily:F.body,fontSize:22,lineHeight:1.2,color:C.text }}>{title}</h2>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display:"grid",gap:6 }}>
      <span style={{ fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.faint }}>{label}</span>
      {children}
    </label>
  );
}

function inputStyle() {
  return {
    width:"100%",
    minHeight:40,
    border:`1px solid ${C.border}`,
    borderRadius:7,
    padding:"9px 11px",
    fontFamily:F.body,
    fontSize:13,
    color:C.text,
    background:C.surface,
    outline:"none",
  };
}

function roleOptionsFor(currentRole) {
  const roles = ["super_admin", "admin", "fb_director", "outlet_manager", "staff", "viewer"];
  return currentRole === "super_admin" ? roles : roles.filter((role) => role !== "super_admin");
}

function parseScope(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (/^\d+$/.test(item) ? Number(item) : item));
}

function scopeText(scope) {
  return Array.isArray(scope) ? scope.join(", ") : "";
}

export default function Accounts() {
  const currentUser = authAPI.getCurrentUser();
  const canManage = authAPI.hasPermission("manage_accounts");
  const [sidebarOpen,setSidebarOpen] = useState(true);
  const [accounts,setAccounts] = useState([]);
  const [form,setForm] = useState(DEFAULT_FORM);
  const [editingId,setEditingId] = useState(null);
  const [profile,setProfile] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    username: currentUser?.username || "",
    current_password: "",
    password: "",
    password_confirmation: "",
  });
  const [loading,setLoading] = useState(false);
  const [profileLoading,setProfileLoading] = useState(false);
  const [toast,setToast] = useState(null);

  const assignableRoles = useMemo(() => roleOptionsFor(currentUser?.role), [currentUser?.role]);

  const loadAccounts = async () => {
    if (!canManage) return;
    try {
      const response = await authAPI.getAccounts();
      setAccounts(response.data || []);
    } catch (error) {
      setToast({ type:"error", message:error.message || "Failed to load accounts." });
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
  };

  const submitAccount = async (event) => {
    event.preventDefault();
    setLoading(true);

    const payload = {
      name: form.name,
      email: form.email,
      username: form.username,
      role: form.role,
      scope_type: form.scope_type,
      outlet_scope: form.scope_type === "assigned" ? parseScope(form.outlet_scope) : [],
      ...(form.password ? { password: form.password } : {}),
    };

    try {
      if (editingId) {
        await authAPI.updateAccount(editingId, payload);
        setToast({ type:"success", message:"Account updated." });
      } else {
        await authAPI.createAccount(payload);
        setToast({ type:"success", message:"Account created." });
      }
      resetForm();
      await loadAccounts();
    } catch (error) {
      setToast({ type:"error", message:error.message || "Failed to save account." });
    } finally {
      setLoading(false);
    }
  };

  const editAccount = (account) => {
    setEditingId(account.id);
    setForm({
      name: account.name || "",
      email: account.email || "",
      username: account.username || "",
      password: "",
      role: account.role || "viewer",
      scope_type: account.scope_type || "all",
      outlet_scope: scopeText(account.outlet_scope),
    });
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setProfileLoading(true);

    try {
      const payload = {
        name: profile.name,
        email: profile.email,
        username: profile.username,
        ...(profile.password ? {
          current_password: profile.current_password,
          password: profile.password,
          password_confirmation: profile.password_confirmation,
        } : {}),
      };

      await authAPI.updateProfile(payload);
      setProfile((prev) => ({ ...prev, current_password:"", password:"", password_confirmation:"" }));
      setToast({ type:"success", message:"Profile updated. Log in again if you changed username or password." });
    } catch (error) {
      setToast({ type:"error", message:error.message || "Failed to update profile." });
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh",background:C.pageBg,fontFamily:F.body }}>
      <AdminNavbar />
      <div style={{ display:"flex" }}>
        <Sidebar activeNav="accounts" isOpen={sidebarOpen} onToggle={()=>setSidebarOpen(!sidebarOpen)} />
        <main style={{ flex:1,padding:"28px 32px",overflow:"auto",height:"calc(100vh - 60px)" }}>
          <SectionTitle eyebrow="Access Control" title="Accounts" />

          {toast && (
            <div style={{ marginBottom:14,padding:"10px 13px",borderRadius:8,background:toast.type==="error"?C.redFaint:C.greenFaint,color:toast.type==="error"?C.red:C.green,border:`1px solid ${toast.type==="error"?"rgba(160,56,56,0.18)":"rgba(46,122,90,0.18)"}`,fontSize:13 }}>
              {toast.message}
            </div>
          )}

          <div style={{ display:"grid",gridTemplateColumns:canManage?"minmax(360px, 0.85fr) minmax(460px, 1.15fr)":"minmax(360px, 620px)",gap:18,alignItems:"start" }}>
            <section style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:18 }}>
              <SectionTitle eyebrow="My Account" title="Profile" />
              <form onSubmit={submitProfile} style={{ display:"grid",gap:12 }}>
                <Field label="Name">
                  <input value={profile.name} onChange={(e)=>setProfile({...profile,name:e.target.value})} style={inputStyle()} />
                </Field>
                <Field label="Email">
                  <input type="email" value={profile.email} onChange={(e)=>setProfile({...profile,email:e.target.value})} style={inputStyle()} />
                </Field>
                <Field label="Username">
                  <input value={profile.username} onChange={(e)=>setProfile({...profile,username:e.target.value})} style={inputStyle()} />
                </Field>
                <div style={{ height:1,background:C.divider,margin:"4px 0" }} />
                <Field label="Current Password">
                  <input type="password" value={profile.current_password} onChange={(e)=>setProfile({...profile,current_password:e.target.value})} placeholder="Required only when changing password" style={inputStyle()} />
                </Field>
                <Field label="New Password">
                  <input type="password" value={profile.password} onChange={(e)=>setProfile({...profile,password:e.target.value})} style={inputStyle()} />
                </Field>
                <Field label="Confirm Password">
                  <input type="password" value={profile.password_confirmation} onChange={(e)=>setProfile({...profile,password_confirmation:e.target.value})} style={inputStyle()} />
                </Field>
                <button disabled={profileLoading} style={{ marginTop:4,padding:"11px 14px",border:"none",borderRadius:8,background:C.gold,color:"#fff",fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",cursor:profileLoading?"not-allowed":"pointer" }}>
                  {profileLoading ? "Saving..." : "Save Profile"}
                </button>
              </form>
            </section>

            {canManage && (
              <section style={{ display:"grid",gap:18 }}>
                <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:18 }}>
                  <SectionTitle eyebrow={editingId ? "Edit Account" : "New Account"} title={editingId ? "Update Role Account" : "Create Role Account"} />
                  <form onSubmit={submitAccount} style={{ display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12 }}>
                    <Field label="Name">
                      <input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required style={inputStyle()} />
                    </Field>
                    <Field label="Email">
                      <input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} required style={inputStyle()} />
                    </Field>
                    <Field label="Username">
                      <input value={form.username} onChange={(e)=>setForm({...form,username:e.target.value})} required style={inputStyle()} />
                    </Field>
                    <Field label={editingId ? "New Password" : "Password"}>
                      <input type="password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} required={!editingId} minLength={8} placeholder={editingId ? "Leave blank to keep current" : ""} style={inputStyle()} />
                    </Field>
                    <Field label="Role">
                      <select value={form.role} onChange={(e)=>setForm({...form,role:e.target.value})} style={inputStyle()}>
                        {assignableRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                      </select>
                    </Field>
                    <Field label="Scope">
                      <select value={form.scope_type} onChange={(e)=>setForm({...form,scope_type:e.target.value})} style={inputStyle()}>
                        <option value="all">All outlets</option>
                        <option value="assigned">Assigned outlets</option>
                      </select>
                    </Field>
                    <div style={{ gridColumn:"1 / -1" }}>
                      <Field label="Outlet Scope">
                        <input value={form.outlet_scope} onChange={(e)=>setForm({...form,outlet_scope:e.target.value})} disabled={form.scope_type==="all"} placeholder="Example: 1, 2, Business Center" style={{ ...inputStyle(),background:form.scope_type==="all"?C.surfaceSoft:C.surface }} />
                      </Field>
                    </div>
                    <div style={{ gridColumn:"1 / -1",display:"flex",gap:8,justifyContent:"flex-end" }}>
                      {editingId && <button type="button" onClick={resetForm} style={{ padding:"10px 14px",border:`1px solid ${C.border}`,borderRadius:8,background:"transparent",color:C.muted,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer" }}>Cancel</button>}
                      <button disabled={loading} style={{ padding:"10px 16px",border:"none",borderRadius:8,background:C.green,color:"#fff",fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:loading?"not-allowed":"pointer" }}>
                        {loading ? "Saving..." : editingId ? "Update Account" : "Create Account"}
                      </button>
                    </div>
                  </form>
                </div>

                <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden" }}>
                  <div style={{ padding:"14px 18px",borderBottom:`1px solid ${C.divider}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <span style={{ fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gold }}>Account List</span>
                    <span style={{ fontSize:12,color:C.muted }}>{accounts.length} accounts</span>
                  </div>
                  <div style={{ display:"grid" }}>
                    {accounts.map((account) => (
                      <button key={account.id} onClick={()=>editAccount(account)} style={{ display:"grid",gridTemplateColumns:"1fr auto",gap:14,alignItems:"center",padding:"13px 18px",border:"none",borderBottom:`1px solid ${C.divider}`,background:"transparent",textAlign:"left",cursor:"pointer" }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13,fontWeight:700,color:C.text,marginBottom:3 }}>{account.name}</div>
                          <div style={{ fontSize:11.5,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{account.username} - {account.email}</div>
                        </div>
                        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                          <span style={{ padding:"4px 8px",borderRadius:999,background:C.goldFaint,color:C.gold,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em" }}>{ROLE_LABELS[account.role] || account.role}</span>
                          <span style={{ fontSize:11,color:C.faint }}>{account.scope_type === "assigned" ? "Assigned" : "All"}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
