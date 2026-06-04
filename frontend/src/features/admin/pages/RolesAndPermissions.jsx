import { useEffect, useState, Fragment } from "react";
import { Plus, X, Edit2, ShieldAlert, Check, Trash2 } from "lucide-react";
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
  const [toast, setToast] = useState(null);
  const [savingCell, setSavingCell] = useState(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        roleAPI.getAll(),
        roleAPI.getPermissions()
      ]);
      setRoles(Array.isArray(rolesRes) ? rolesRes : (rolesRes.data || []));
      setAllPermissions(Array.isArray(permsRes) ? permsRes : (permsRes.data || []));
    } catch (err) {
      console.error("Failed to load roles:", err);
      setToast({ type: "error", message: "Failed to load roles and permissions." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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
    });
    setError("");
    setDrawerOpen(true);
  };

  const handleDeleteClick = (role) => {
    setDeleteConfirmTarget(role);
  };

  const handleConfirmDelete = async () => {
    const target = deleteConfirmTarget;
    if (!target) return;
    setDeleteConfirmTarget(null);
    setLoading(true);
    try {
      await roleAPI.delete(target.id);
      setToast({ type: "success", message: `Role "${target.name}" deleted successfully.` });
      loadData();
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to delete role." });
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        const existingRole = roles.find(r => r.id === editingId);
        const existingPerms = (existingRole?.permissions || []).map(p => p.slug);
        await roleAPI.update(editingId, {
          name: form.name,
          description: form.description,
          level: form.level,
          permissions: existingPerms
        });
        setToast({ type: "success", message: `Role "${form.name}" updated successfully.` });
      } else {
        await roleAPI.create({
          name: form.name,
          description: form.description,
          level: form.level,
          permissions: []
        });
        setToast({ type: "success", message: `Role "${form.name}" created successfully. Use the matrix grid to assign permissions.` });
      }
      setDrawerOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePermission = async (role, permSlug, isChecked) => {
    setSavingCell({ roleId: role.id, permSlug });
    try {
      const currentPerms = (role.permissions || []).map(p => p.slug);
      const newPerms = isChecked
        ? currentPerms.filter(slug => slug !== permSlug)
        : [...currentPerms, permSlug];
        
      await roleAPI.update(role.id, {
        name: role.name,
        level: role.level,
        permissions: newPerms
      });
      
      setRoles(prev => prev.map(r => {
        if (r.id === role.id) {
          const updatedPermissions = allPermissions.filter(p => newPerms.includes(p.slug));
          return { ...r, permissions: updatedPermissions };
        }
        return r;
      }));
      setToast({ type: "success", message: `Updated permissions for ${role.name}.` });
    } catch (err) {
      console.error(err);
      setToast({ type: "error", message: err.message || "Failed to update permissions." });
    } finally {
      setSavingCell(null);
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
        .perm-row:hover { background: rgba(140,107,42,0.024) !important; }
        .matrix-th { padding: 16px 12px; text-align: center; min-width: 106px; border-left: 1px solid ${C.divider}; vertical-align: top; }
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

            {toast && (
              <div style={{ padding: "10px 13px", borderRadius: 8, background: toast.type === "error" ? C.redFaint : C.greenFaint, color: toast.type === "error" ? C.red : C.green, border: `1px solid ${toast.type === "error" ? "rgba(160,56,56,0.18)" : "rgba(46,122,90,0.18)"}`, fontSize: 13, transition: "all 0.2s ease" }}>
                {toast.message}
              </div>
            )}

            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size={24} /></div>
            ) : (
              <div style={{ overflowX: "auto", paddingBottom: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", background: C.surface, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}`, boxShadow: C.shadowSoft, minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: C.surfaceSoft, borderBottom: `2px solid ${C.goldFaint}` }}>
                      <th style={{ padding: "18px 20px", textAlign: "left", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: C.muted, width: 280 }}>
                        System Capability
                      </th>
                      {roles.map(role => (
                        <th key={role.id} className="matrix-th">
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 760, color: C.text, display: "block" }}>{role.name}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                              <span style={{ fontSize: 8.5, color: C.muted, background: "rgba(0,0,0,0.035)", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>Level {role.level}</span>
                              {role.is_system && (
                                <span style={{ fontSize: 8, color: C.gold, background: C.goldFaint, padding: "1px 5px", borderRadius: 4, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>System</span>
                              )}
                            </div>
                            
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button
                                type="button"
                                onClick={() => handleEdit(role)}
                                title="Edit role info"
                                style={{ background: "transparent", cursor: "pointer", padding: "3px 5px", borderRadius: 4, color: C.muted, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border}` }}
                              >
                                <Edit2 size={10} />
                              </button>
                              {!role.is_system && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(role)}
                                  title="Delete role"
                                  style={{ cursor: "pointer", padding: "3px 5px", borderRadius: 4, color: C.red, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid rgba(160,56,56,0.14)`, background: C.redFaint }}
                                >
                                  <Trash2 size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedPermissions).map(([module, perms]) => (
                      <Fragment key={module}>
                        <tr style={{ background: C.surfaceSoft }}>
                          <td colSpan={roles.length + 1} style={{ padding: "10px 20px", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: C.gold, borderBottom: `1px solid ${C.border}` }}>
                            {module}
                          </td>
                        </tr>
                        {perms.map(perm => (
                          <tr key={perm.slug} className="perm-row" style={{ borderBottom: `1px solid ${C.divider}` }}>
                            <td style={{ padding: "14px 20px", textAlign: "left" }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{perm.name}</div>
                              <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{perm.slug}</div>
                            </td>
                            {roles.map(role => {
                              const isChecked = (role.permissions || []).some(p => p.slug === perm.slug);
                              const isSaving = savingCell && savingCell.roleId === role.id && savingCell.permSlug === perm.slug;
                              
                              return (
                                <td key={role.id} style={{ padding: "10px 12px", textAlign: "center", borderLeft: `1px solid ${C.divider}` }}>
                                  <div style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", minHeight: 20 }}>
                                    {isSaving ? (
                                      <Spinner size={12} />
                                    ) : (
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleTogglePermission(role, perm.slug, isChecked)}
                                        style={{
                                          width: 16,
                                          height: 16,
                                          accentColor: C.gold,
                                          cursor: "pointer",
                                        }}
                                      />
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    {Object.keys(groupedPermissions).length === 0 && (
                      <tr>
                        <td colSpan={roles.length + 1} style={{ padding: "40px 20px", textAlign: "center", color: C.muted, fontSize: 13 }}>
                          No permissions found in the system.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(24,20,14,0.34)", backdropFilter: "blur(2px)", zIndex: 8000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "rolesFadeIn 200ms ease both" }}>
          <div style={{ width: "min(400px, 100%)", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", padding: 20 }}>
            <h3 style={{ margin: 0, fontSize: 18, color: C.text, fontWeight: 700 }}>Delete Role?</h3>
            <p style={{ margin: "10px 0 20px", fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
              Are you sure you want to delete the custom role <strong>{deleteConfirmTarget.name}</strong>? This action cannot be undone and will affect any users assigned to this role.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget(null)}
                style={{ padding: "0 16px", height: 34, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                style={{ padding: "0 16px", height: 34, background: C.red, border: "none", borderRadius: 8, color: "#fff", fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Drawer */}
      {drawerOpen && (
        <div
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 7000, background: "rgba(24,20,14,0.28)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "flex-end", animation: "rolesFadeIn 220ms ease both" }}
        >
          <aside style={{ width: "min(480px, calc(100vw - 28px))", background: C.surface, height: "100%", borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", boxShadow: "0 24px 70px rgba(24,20,14,0.22)", animation: "rolesSlideIn 320ms cubic-bezier(0.22,1,0.36,1) both" }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ color: C.gold, fontSize: 8.5, fontWeight: 750, letterSpacing: "0.16em", textTransform: "uppercase" }}>Administration</div>
                <h2 style={{ margin: "5px 0 0", fontSize: 21, fontWeight: 640, color: C.text, lineHeight: 1.15 }}>{editingId ? "Edit Role Info" : "Create Role"}</h2>
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
