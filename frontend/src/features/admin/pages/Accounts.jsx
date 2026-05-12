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
  venue_manager: "Venue Manager",
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
  if (currentRole === "super_admin") return roles;
  if (currentRole === "admin") return ["fb_director", "outlet_manager", "staff", "viewer"];
  return [];
}

function canManageAccount(currentUser, account) {
  if (!currentUser || !account || currentUser.id === account.id) return false;
  if (currentUser.role === "super_admin") return account.role !== "super_admin";
  if (currentUser.role === "admin") return !["super_admin", "admin"].includes(account.role);
  return false;
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
  const [loading,setLoading] = useState(false);
  const [toast,setToast] = useState(null);
  const [roleFilter,setRoleFilter] = useState("all");
  const [statusFilter,setStatusFilter] = useState("all");
  const [search,setSearch] = useState("");

  const assignableRoles = useMemo(() => roleOptionsFor(currentUser?.role), [currentUser?.role]);
  const visibleAccounts = useMemo(
    () => currentUser?.role === "super_admin"
      ? accounts
      : accounts.filter((account) => account.role !== "super_admin"),
    [accounts, currentUser?.role]
  );
  const roleFilterOptions = useMemo(
    () => Array.from(new Set(visibleAccounts.map((account) => account.role).filter(Boolean))).sort(),
    [visibleAccounts]
  );
  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return visibleAccounts.filter((account) => {
      const active = account.is_active !== false;
      const matchesRole = roleFilter === "all" || account.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && active) ||
        (statusFilter === "inactive" && !active);
      const matchesSearch =
        !term ||
        [account.name, account.username, account.email, account.role]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));

      return matchesRole && matchesStatus && matchesSearch;
    });
  }, [visibleAccounts, roleFilter, statusFilter, search]);
  const activeCount = visibleAccounts.filter((account) => account.is_active !== false).length;
  const inactiveCount = visibleAccounts.length - activeCount;

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
    if (!canManageAccount(currentUser, account)) {
      setToast({ type:"error", message:"You cannot modify this account." });
      return;
    }

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

  const toggleAccountActive = async (account) => {
    if (!canManageAccount(currentUser, account)) {
      setToast({ type:"error", message:"You cannot modify this account." });
      return;
    }

    setLoading(true);
    try {
      if (account.is_active === false) {
        await authAPI.reactivateAccount(account.id);
        setToast({ type:"success", message:"Account reactivated." });
      } else {
        await authAPI.deactivateAccount(account.id);
        setToast({ type:"success", message:"Account deactivated." });
      }

      if (editingId === account.id) resetForm();
      await loadAccounts();
    } catch (error) {
      setToast({ type:"error", message:error.message || "Failed to update account status." });
    } finally {
      setLoading(false);
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

          {!canManage ? (
            <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:22,color:C.muted,fontSize:13,maxWidth:620 }}>
              Account creation and role management are restricted to authorized administrators. Use the account menu in the header to view or update your personal account.
            </div>
          ) : (
            <div style={{ display:"grid",gridTemplateColumns:"minmax(360px, 0.85fr) minmax(620px, 1.15fr)",gap:18,alignItems:"start",maxWidth:1380 }}>
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
                  <div style={{ padding:"14px 18px 12px",borderBottom:`1px solid ${C.divider}`,display:"grid",gap:12 }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:12 }}>
                      <div>
                        <span style={{ display:"block",fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gold }}>Account Directory</span>
                        <span style={{ display:"block",marginTop:4,fontSize:12,color:C.muted }}>{filteredAccounts.length} shown from {visibleAccounts.length} accounts</span>
                      </div>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{ padding:"5px 9px",borderRadius:999,background:C.greenFaint,color:C.green,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase" }}>{activeCount} Active</span>
                        <span style={{ padding:"5px 9px",borderRadius:999,background:C.redFaint,color:C.red,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase" }}>{inactiveCount} Inactive</span>
                      </div>
                    </div>
                    <div style={{ display:"grid",gridTemplateColumns:"minmax(180px,1fr) 150px 128px",gap:10 }}>
                      <input
                        value={search}
                        onChange={(e)=>setSearch(e.target.value)}
                        placeholder="Search name, username, email..."
                        style={{...inputStyle(),minHeight:36,padding:"7px 10px"}}
                      />
                      <select value={roleFilter} onChange={(e)=>setRoleFilter(e.target.value)} style={{...inputStyle(),minHeight:36,padding:"7px 10px"}}>
                        <option value="all">All roles</option>
                        {roleFilterOptions.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>)}
                      </select>
                      <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} style={{...inputStyle(),minHeight:36,padding:"7px 10px"}}>
                        <option value="all">All status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display:"grid",gridTemplateColumns:"minmax(220px,1.3fr) 132px 82px 92px 148px",gap:12,alignItems:"center",padding:"9px 18px",borderBottom:`1px solid ${C.divider}`,background:C.surfaceSoft }}>
                    {["Account","Role","Scope","Status","Actions"].map((label) => (
                      <span key={label} style={{ fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.faint }}>{label}</span>
                    ))}
                  </div>
                  <div style={{ display:"grid" }}>
                    {filteredAccounts.length === 0 && (
                      <div style={{ padding:"28px 18px",color:C.muted,fontSize:13,textAlign:"center" }}>
                        No accounts match the selected filters.
                      </div>
                    )}
                    {filteredAccounts.map((account) => {
                      const manageable = canManageAccount(currentUser, account);
                      const inactive = account.is_active === false;

                      return (
                      <div key={account.id} style={{ display:"grid",gridTemplateColumns:"minmax(220px,1.3fr) 132px 82px 92px 148px",gap:12,alignItems:"center",padding:"12px 18px",borderBottom:`1px solid ${C.divider}`,background:inactive ? C.surfaceSoft : "transparent",textAlign:"left",opacity:inactive ? 0.72 : 1 }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13,fontWeight:700,color:C.text,marginBottom:3 }}>{account.name}</div>
                          <div style={{ fontSize:11.5,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{account.username}</div>
                          <div style={{ fontSize:11.5,color:C.faint,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{account.email}</div>
                        </div>
                        <span style={{ justifySelf:"start",padding:"4px 8px",borderRadius:999,background:C.goldFaint,color:C.gold,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap" }}>{ROLE_LABELS[account.role] || account.role}</span>
                        <span style={{ fontSize:11.5,color:C.muted }}>{account.scope_type === "assigned" ? "Assigned" : "All"}</span>
                        <span style={{ justifySelf:"start",padding:"4px 8px",borderRadius:999,background:inactive ? C.redFaint : C.greenFaint,color:inactive ? C.red : C.green,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em" }}>{inactive ? "Inactive" : "Active"}</span>
                        <div style={{ display:"flex",alignItems:"center",gap:7,justifyContent:"flex-end" }}>
                          <button type="button" disabled={!manageable || loading} onClick={()=>editAccount(account)} style={{ padding:"7px 9px",border:`1px solid ${C.border}`,borderRadius:7,background:C.surface,color:manageable?C.text:C.faint,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",cursor:manageable&&!loading?"pointer":"not-allowed" }}>Edit</button>
                          <button type="button" disabled={!manageable || loading} onClick={()=>toggleAccountActive(account)} style={{ padding:"7px 9px",border:`1px solid ${inactive ? "rgba(46,122,90,0.20)" : "rgba(160,56,56,0.20)"}`,borderRadius:7,background:inactive?C.greenFaint:C.redFaint,color:inactive?C.green:C.red,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",cursor:manageable&&!loading?"pointer":"not-allowed" }}>{inactive ? "Enable" : "Disable"}</button>
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
