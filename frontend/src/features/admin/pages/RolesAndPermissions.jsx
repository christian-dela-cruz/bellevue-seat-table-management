import { useEffect, useState } from "react";
import { Plus, X, Edit2, ShieldAlert, Check } from "lucide-react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import Sidebar from "../../../components/layout/Sidebar";
import { roleAPI } from "../../../services/roleAPI";

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
  shadow: "0 2px 8px rgba(44,36,24,0.035)",
  shadowSoft: "0 1px 5px rgba(44,36,24,0.025)",
};

const F = {
  body: "'Inter','Helvetica Neue',Arial,sans-serif",
  label: "'Inter','Helvetica Neue',Arial,sans-serif",
};

const DEFAULT_FORM = {
  name: "",
  description: "",
  level: 50,
  permissions: []
};

function Spinner({ color = C.gold, size = 14 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${color}33`,
        borderTopColor: color,
        display: "inline-block",
        animation: "rolesSpin 0.75s linear infinite",
      }}
    />
  );
}

function Field({ label, children, hint }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11.5, color: C.muted, marginTop: -2 }}>{hint}</span>}
    </label>
  );
}

function inputStyle() {
  return {
    width: "100%",
    minHeight: 42,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    fontFamily: F.body,
    fontSize: 13,
    color: C.text,
    background: C.surface,
    outline: "none",
  };
}

export default function RolesAndPermissions() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        roleAPI.getAll(),
        roleAPI.getPermissions()
      ]);
      setRoles(rolesRes.data || []);
      setAllPermissions(permsRes.data || []);
    } catch (err) {
      console.error("Failed to load roles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setError("");
    setDrawerOpen(true);
  };

  const handleEdit = (role) => {
    setEditingId(role.id);
    setForm({
      name: role.name,
      description: role.description || "",
      level: role.level,
      permissions: (role.permissions || []).map(p => p.slug)
    });
    setError("");
    setDrawerOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await roleAPI.update(editingId, form);
      } else {
        await roleAPI.create(form);
      }
      setDrawerOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    const mod = perm.module || "General";
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(perm);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: F.body }}>
      <style>{`
        @keyframes rolesSpin { to { transform: rotate(360deg); } }
        @keyframes rolesSlideIn { from { opacity: 0; transform: translate3d(34px,0,0); } to { opacity: 1; transform: translate3d(0,0,0); } }
        @keyframes rolesFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .roles-card { transition: box-shadow 0.16s ease, border-color 0.16s ease !important; }
        .roles-card:hover { border-color: rgba(140,107,42,0.18) !important; box-shadow: 0 4px 16px rgba(44,36,24,0.06) !important; }
        .roles-edit-btn { transition: all 0.16s ease !important; }
        .roles-edit-btn:hover { border-color: rgba(140,107,42,0.28) !important; color: ${C.gold} !important; transform: translateY(-1px); }
      `}</style>

      <AdminNavbar />

      <div style={{ display: "flex", height: "calc(100vh - 60px)", minHeight: 0, overflow: "hidden" }}>
        <Sidebar activeNav="roles" isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        <main style={{ flex: 1, padding: "30px 32px 42px", overflow: "auto", height: "calc(100vh - 60px)" }}>
          <div style={{ maxWidth: 1440, display: "grid", gap: 18 }}>
            <AdminPageHeader
              eyebrow="Administration"
              title="Roles & Permissions"
              description="Manage dynamic access levels and system capabilities for all accounts."
              C={C}
              F={F}
              actions={
                <button
                  type="button"
                  onClick={handleCreate}
                  style={{ height: 40, padding: "0 14px", border: `1px solid rgba(140,107,42,0.20)`, borderRadius: 9, background: C.gold, color: "#fff", fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 2px 8px rgba(140,107,42,0.10)", whiteSpace: "nowrap" }}
                >
                  <Plus size={14} />
                  New Role
                </button>
              }
            />

            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size={24} /></div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {roles.map(role => (
                  <div key={role.id} className="roles-card" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, boxShadow: C.shadowSoft }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 760, color: C.text, lineHeight: 1.25 }}>{role.name}</h3>
                        {role.is_system && (
                          <span style={{ padding: "4px 8px", background: C.goldFaint, border: "1px solid rgba(140,107,42,0.14)", color: C.gold, fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", borderRadius: 999 }}>System</span>
                        )}
                        <span style={{ padding: "4px 8px", background: C.surfaceSoft, border: `1px solid ${C.border}`, color: C.muted, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 999 }}>Level {role.level}</span>
                      </div>
                      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>{role.description || "No description provided."}</p>
                      
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(role.permissions || []).slice(0, 5).map(p => (
                          <span key={p.id} style={{ padding: "4px 10px", background: C.surfaceSoft, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, color: C.text, fontWeight: 520 }}>{p.name}</span>
                        ))}
                        {(role.permissions || []).length > 5 && (
                          <span style={{ padding: "4px 10px", background: C.surfaceSoft, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, color: C.muted }}>+{role.permissions.length - 5} more</span>
                        )}
                        {(!role.permissions || role.permissions.length === 0) && (
                          <span style={{ fontSize: 12, color: C.faint, fontStyle: "italic" }}>No permissions assigned</span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      className="roles-edit-btn"
                      onClick={() => handleEdit(role)}
                      style={{ padding: "8px 12px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      <Edit2 size={13} /> Edit
                    </button>
                  </div>
                ))}

                {roles.length === 0 && !loading && (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "40px 24px", textAlign: "center", color: C.muted, fontSize: 13 }}>
                    No roles found. Create your first role to get started.
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <div
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 7000, background: "rgba(24,20,14,0.28)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "flex-end", animation: "rolesFadeIn 220ms ease both" }}
        >
          <aside style={{ width: "min(560px, calc(100vw - 28px))", background: C.surface, height: "100%", borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", boxShadow: "0 24px 70px rgba(24,20,14,0.22)", animation: "rolesSlideIn 320ms cubic-bezier(0.22,1,0.36,1) both" }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ color: C.gold, fontSize: 8.5, fontWeight: 750, letterSpacing: "0.16em", textTransform: "uppercase" }}>Administration</div>
                <h2 style={{ margin: "5px 0 0", fontSize: 21, fontWeight: 640, color: C.text, lineHeight: 1.15 }}>{editingId ? "Edit Role" : "Create Role"}</h2>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} style={{ width: 36, height: 36, border: `1px solid rgba(140,107,42,0.22)`, borderRadius: 8, background: C.surface, color: C.gold, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: 20, display: "grid", gap: 20 }}>
              {error && (
                <div style={{ padding: 12, background: C.redFaint, border: "1px solid rgba(160,56,56,0.18)", borderRadius: 9, color: C.red, fontSize: 12.5, lineHeight: 1.45, display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldAlert size={16} /> {error}
                </div>
              )}
              
              <Field label="Role Name" hint="Example: Front Desk, Auditor">
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inputStyle()} />
              </Field>
              
              <Field label="Description">
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={inputStyle()} />
              </Field>

              <Field label="Authority Level (1–100)" hint="Higher levels can manage lower levels. Super Admin is 100.">
                <input type="number" min="1" max="100" required value={form.level} onChange={e => setForm({...form, level: Number(e.target.value)})} style={inputStyle()} />
              </Field>

              <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 16 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 760, color: C.text, lineHeight: 1.3 }}>Permissions</h3>
                <div style={{ display: "grid", gap: 18 }}>
                  {Object.entries(groupedPermissions).map(([module, perms]) => (
                    <div key={module}>
                      <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, marginBottom: 8 }}>{module}</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {perms.map(p => {
                          const isChecked = form.permissions.includes(p.slug);
                          return (
                            <label key={p.slug} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 12px", borderRadius: 8, background: isChecked ? C.goldFaint : "transparent", border: `1px solid ${isChecked ? 'rgba(140,107,42,0.18)' : 'transparent'}`, transition: "all 0.15s ease" }}>
                              <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${isChecked ? C.gold : C.muted}`, background: isChecked ? C.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s ease" }}>
                                {isChecked && <Check size={12} color="#fff" strokeWidth={3} />}
                              </div>
                              <span style={{ fontSize: 13, color: isChecked ? C.text : C.muted, fontWeight: isChecked ? 600 : 400 }}>{p.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {Object.keys(groupedPermissions).length === 0 && (
                    <div style={{ fontSize: 12.5, color: C.muted, fontStyle: "italic" }}>No permissions available in the system.</div>
                  )}
                </div>
              </div>
            </form>
            
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.divider}`, display: "flex", gap: 10, justifyContent: "flex-end", background: C.surfaceSoft }}>
              <button type="button" onClick={() => setDrawerOpen(false)} style={{ padding: "0 16px", height: 34, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>Cancel</button>
              <button type="submit" onClick={handleSubmit} disabled={saving} style={{ padding: "0 18px", height: 34, background: C.green, border: "none", borderRadius: 8, color: "#fff", fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: saving ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {saving && <Spinner color="#fff" size={12} />}
                {saving ? "Saving..." : "Save Role"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
