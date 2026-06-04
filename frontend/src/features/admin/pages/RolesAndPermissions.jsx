import { useEffect, useState } from "react";
import { Search, Plus, X, Edit2, ShieldAlert, Check } from "lucide-react";
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
  red: "#A03838",
  text: "#18140E",
  muted: "#7A7060",
  faint: "rgba(24,20,14,0.42)",
  shadow: "0 2px 8px rgba(44,36,24,0.035)",
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
        animation: "accountSpin 0.75s linear infinite",
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

function inputStyle(hasError = false) {
  return {
    width: "100%",
    minHeight: 42,
    border: `1px solid ${hasError ? C.red : C.border}`,
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
      console.error(err);
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
      permissions: role.permissions.map(p => p.slug)
    });
    setError("");
    setDrawerOpen(true);
  };

  const togglePermission = (slug) => {
    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(slug) 
        ? prev.permissions.filter(p => p !== slug)
        : [...prev.permissions, slug]
    }));
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
    <div style={{ display: "flex", minHeight: "100vh", background: C.pageBg, fontFamily: F.body }}>
      <style>
        {`
          @keyframes accountSpin { to { transform: rotate(360deg); } }
          @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        `}
      </style>

      <Sidebar activePath="/admin/roles" isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <AdminNavbar
          title="Roles & Permissions"
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />

        <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto" }}>
          <AdminPageHeader
            title="Roles & Permissions"
            description="Manage dynamic access levels and system capabilities for all accounts."
            actions={
              <button
                onClick={handleCreate}
                style={{ height: 38, padding: "0 18px", background: C.gold, color: "#fff", border: "none", borderRadius: 8, fontFamily: F.label, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Plus size={15} /> Create Role
              </button>
            }
          />

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size={24} /></div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {roles.map(role => (
                <div key={role.id} style={{ background: C.surface, border: \`1px solid \${C.border}\`, borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", boxShadow: C.shadow }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 760, color: C.text }}>{role.name}</h3>
                      {role.is_system && (
                        <span style={{ padding: "4px 8px", background: C.goldFaint, color: C.gold, fontSize: 9, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", borderRadius: 999 }}>System Role</span>
                      )}
                    </div>
                    <p style={{ margin: "0 0 16px", fontSize: 13, color: C.muted }}>{role.description || "No description provided."}</p>
                    
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {role.permissions.slice(0, 5).map(p => (
                        <span key={p.id} style={{ padding: "4px 10px", background: C.surfaceSoft, border: \`1px solid \${C.border}\`, borderRadius: 6, fontSize: 11, color: C.text }}>{p.name}</span>
                      ))}
                      {role.permissions.length > 5 && (
                        <span style={{ padding: "4px 10px", background: C.surfaceSoft, border: \`1px solid \${C.border}\`, borderRadius: 6, fontSize: 11, color: C.muted }}>+{role.permissions.length - 5} more</span>
                      )}
                      {role.permissions.length === 0 && (
                        <span style={{ fontSize: 12, color: C.faint, fontStyle: "italic" }}>No permissions assigned</span>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
                    <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Level: {role.level}</div>
                    <button
                      onClick={() => handleEdit(role)}
                      style={{ padding: "8px 14px", background: C.surfaceSoft, border: \`1px solid \${C.border}\`, borderRadius: 8, color: C.text, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Edit2 size={14} /> Edit Role
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Drawer */}
      {drawerOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 7000, background: "rgba(24,20,14,0.28)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "flex-end" }}>
          <aside style={{ width: "min(600px, 100vw)", background: C.surface, height: "100%", borderLeft: \`1px solid \${C.border}\`, display: "flex", flexDirection: "column", animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <header style={{ padding: "20px 24px", borderBottom: \`1px solid \${C.border}\`, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surfaceSoft }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 760, color: C.text }}>{editingId ? "Edit Role" : "Create New Role"}</h2>
              <button onClick={() => setDrawerOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 8, color: C.muted }}><X size={20} /></button>
            </header>
            
            <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 24 }}>
              {error && (
                <div style={{ padding: 12, background: "rgba(160,56,56,0.08)", border: "1px solid rgba(160,56,56,0.2)", borderRadius: 8, color: C.red, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  <ShieldAlert size={16} /> {error}
                </div>
              )}
              
              <Field label="Role Name" hint="Example: Front Desk, Auditor">
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={inputStyle()} />
              </Field>
              
              <Field label="Description">
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={inputStyle()} />
              </Field>

              <Field label="Authority Level (1-100)" hint="Higher levels can manage lower levels. Super Admin is 100.">
                <input type="number" min="1" max="100" required value={form.level} onChange={e => setForm({...form, level: Number(e.target.value)})} style={inputStyle()} />
              </Field>

              <div style={{ borderTop: \`1px solid \${C.divider}\`, margin: "8px 0" }} />

              <div>
                <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 760, color: C.text }}>Permissions</h3>
                <div style={{ display: "grid", gap: 20 }}>
                  {Object.entries(groupedPermissions).map(([module, perms]) => (
                    <div key={module}>
                      <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: C.gold, marginBottom: 8 }}>{module}</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {perms.map(p => {
                          const isChecked = form.permissions.includes(p.slug);
                          return (
                            <label key={p.slug} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 12px", borderRadius: 8, background: isChecked ? C.goldFaint : "transparent", border: \`1px solid \${isChecked ? 'rgba(140,107,42,0.2)' : 'transparent'}\`, transition: "all 0.15s" }}>
                              <div style={{ width: 18, height: 18, borderRadius: 4, border: \`1.5px solid \${isChecked ? C.gold : C.muted}\`, background: isChecked ? C.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {isChecked && <Check size={12} color="#fff" strokeWidth={3} />}
                              </div>
                              <span style={{ fontSize: 13, color: isChecked ? C.text : C.muted, fontWeight: isChecked ? 600 : 400 }}>{p.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </form>
            
            <footer style={{ padding: "16px 24px", borderTop: \`1px solid \${C.border}\`, display: "flex", justifyContent: "flex-end", gap: 12, background: C.surfaceSoft }}>
              <button type="button" onClick={() => setDrawerOpen(false)} style={{ padding: "0 16px", height: 40, background: "transparent", border: \`1px solid \${C.border}\`, borderRadius: 8, color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button type="submit" onClick={handleSubmit} disabled={saving} style={{ padding: "0 20px", height: 40, background: C.gold, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                {saving && <Spinner color="#fff" />} {saving ? "Saving..." : "Save Role"}
              </button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
