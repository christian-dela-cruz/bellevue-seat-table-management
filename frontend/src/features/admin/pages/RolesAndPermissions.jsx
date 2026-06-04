import { useEffect, useState, useMemo } from "react";
import { Plus, X, Edit2, ShieldAlert, Check, Trash2, Shield, Users, Search, AlertTriangle } from "lucide-react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import Sidebar from "../../../components/layout/Sidebar";
import { roleAPI } from "../../../services/roleAPI";
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
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [hasUnsavedPerms, setHasUnsavedPerms] = useState(false);
  const [impactModalOpen, setImpactModalOpen] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  const currentUser = authAPI.getCurrentUser();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const canEditRolePerms = selectedRole && (!selectedRole.is_system || (isSuperAdmin && selectedRole.slug !== "super_admin"));

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes, accountsRes] = await Promise.all([
        roleAPI.getAll().catch(() => ({ data: [] })),
        roleAPI.getPermissions().catch(() => ({ data: [] })),
        authAPI.getAccounts().catch(() => ({ data: [] }))
      ]);
      const loadedRoles = Array.isArray(rolesRes) ? rolesRes : (rolesRes.data || []);
      setRoles(loadedRoles);
      setAllPermissions(Array.isArray(permsRes) ? permsRes : (permsRes.data || []));
      setAccounts(accountsRes.data || []);
      if (!selectedRole && loadedRoles.length > 0) {
        setSelectedRole(loadedRoles[0]);
        setEditingPermissions((loadedRoles[0].permissions || []).map(p => p.slug));
        setHasUnsavedPerms(false);
      } else if (selectedRole) {
        const freshRole = loadedRoles.find(r => r.id === selectedRole.id);
        if (freshRole) {
          setSelectedRole(freshRole);
          setEditingPermissions((freshRole.permissions || []).map(p => p.slug));
          setHasUnsavedPerms(false);
        }
      }
    } catch (err) {
      console.error("Failed to load roles:", err);
      setToast({ type: "error", message: "Failed to load data." });
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
      if (selectedRole?.id === target.id) setSelectedRole(null);
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
        const res = await roleAPI.create({
          name: form.name,
          description: form.description,
          level: form.level,
          permissions: []
        });
        setToast({ type: "success", message: `Role "${form.name}" created successfully.` });
        if (res) {
          setSelectedRole(res);
          setEditingPermissions([]);
          setHasUnsavedPerms(false);
        }
      }
      setDrawerOpen(false);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to save role");
    } finally {
      setSaving(false);
    }
  };

  const togglePermission = (slug) => {
    if (!canEditRolePerms) return; // cannot edit system role permissions here
    
    setEditingPermissions(prev => {
      const next = prev.includes(slug) ? prev.filter(p => p !== slug) : [...prev, slug];
      const original = (selectedRole?.permissions || []).map(p => p.slug);
      
      const isChanged = next.length !== original.length || !next.every(n => original.includes(n));
      setHasUnsavedPerms(isChanged);
      return next;
    });
  };

  const savePermissions = async () => {
    setSaving(true);
    setImpactModalOpen(false);
    try {
      await roleAPI.update(selectedRole.id, {
        name: selectedRole.name,
        level: selectedRole.level,
        permissions: editingPermissions
      });
      setToast({ type: "success", message: "Permissions updated successfully." });
      loadData();
    } catch (err) {
      setToast({ type: "error", message: err.message || "Failed to save permissions." });
    } finally {
      setSaving(false);
    }
  };

  const groupedPermissions = useMemo(() => {
    return allPermissions.reduce((acc, perm) => {
      const mod = perm.module || "General";
      if (!acc[mod]) acc[mod] = [];
      acc[mod].push(perm);
      return acc;
    }, {});
  }, [allPermissions]);

  const filteredRoles = useMemo(() => {
    if (!roleSearch) return roles;
    return roles.filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase()) || r.slug.toLowerCase().includes(roleSearch.toLowerCase()));
  }, [roles, roleSearch]);

  const roleAccountsCount = selectedRole ? accounts.filter(a => a.role === selectedRole.slug && a.is_active !== false).length : 0;

  return (
    <div style={{ minHeight: "100vh", background: C.pageBg, fontFamily: F.body }}>
      <style>{`
        @keyframes rolesSpin { to { transform: rotate(360deg); } }
        @keyframes rolesSlideIn { from { opacity: 0; transform: translate3d(34px,0,0); } to { opacity: 1; transform: translate3d(0,0,0); } }
        @keyframes rolesFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .role-card:hover { border-color: ${C.gold} !important; background: ${C.goldFaint} !important; }
        .perm-row:hover { background: rgba(140,107,42,0.024) !important; }
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

            {loading && roles.length === 0 ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Spinner size={24} /></div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "start" }}>
                
                {/* Master: Role List */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ position: "relative" }}>
                    <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
                    <input 
                      value={roleSearch}
                      onChange={e => setRoleSearch(e.target.value)}
                      placeholder="Search roles..."
                      style={{ ...inputStyle(), paddingLeft: 34, background: C.surface, border: `1px solid ${C.border}` }}
                    />
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {filteredRoles.map(role => {
                      const isSelected = selectedRole?.id === role.id;
                      const roleAccts = accounts.filter(a => a.role === role.slug).length;
                      
                      return (
                        <div 
                          key={role.id}
                          className="role-card"
                          onClick={() => {
                            if (hasUnsavedPerms) {
                              if (!window.confirm("You have unsaved permission changes. Discard?")) return;
                            }
                            setSelectedRole(role);
                            setEditingPermissions((role.permissions || []).map(p => p.slug));
                            setHasUnsavedPerms(false);
                          }}
                          style={{
                            padding: 16,
                            background: isSelected ? C.surface : C.surfaceSoft,
                            border: `2px solid ${isSelected ? C.gold : C.border}`,
                            borderRadius: 12,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            boxShadow: isSelected ? C.shadow : "none"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{role.name}</div>
                            {role.is_system && (
                              <span style={{ fontSize: 9, padding: "2px 6px", background: C.goldFaint, color: C.gold, borderRadius: 4, fontWeight: 750, letterSpacing: "0.05em", textTransform: "uppercase" }}>System</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>{role.description || "No description"}</div>
                          
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", gap: 12 }}>
                              <span style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
                                <Shield size={12} /> Level {role.level}
                              </span>
                              <span style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
                                <Users size={12} /> {roleAccts}
                              </span>
                            </div>
                            
                            {isSelected && (
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleEdit(role); }}
                                  style={{ padding: "4px 8px", fontSize: 11, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                                >
                                  <Edit2 size={12} /> Edit
                                </button>
                                {!role.is_system && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(role); }}
                                    style={{ padding: "4px 8px", fontSize: 11, background: C.redFaint, border: `1px solid rgba(160,56,56,0.18)`, borderRadius: 6, color: C.red, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                                  >
                                    <Trash2 size={12} /> Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Detail: Permissions */}
                {selectedRole ? (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", boxShadow: C.shadowSoft, display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.divider}`, background: C.surfaceSoft, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 760 }}>{selectedRole.name} Permissions</h3>
                        {selectedRole.is_system && (
                          <div style={{ fontSize: 12, color: !canEditRolePerms ? C.red : C.gold, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                            <ShieldAlert size={14} /> 
                            {!isSuperAdmin 
                              ? "System roles cannot have their default permissions modified."
                              : selectedRole.slug === "super_admin"
                                ? "The Super Admin role cannot have its default permissions modified to prevent system lockouts."
                                : "System role default permissions can be modified by Super Admins. Changes will affect all users with this role."
                            }
                          </div>
                        )}
                      </div>
                      {hasUnsavedPerms && (
                        <div style={{ display: "flex", gap: 10 }}>
                          <button type="button" onClick={() => { setEditingPermissions((selectedRole.permissions || []).map(p => p.slug)); setHasUnsavedPerms(false); }} style={{ padding: "8px 14px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>Discard</button>
                          <button type="button" onClick={() => setImpactModalOpen(true)} style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: C.gold, color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            Save Changes
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ padding: 24, display: "grid", gap: 24 }}>
                      {Object.entries(groupedPermissions).map(([module, perms]) => (
                        <div key={module}>
                          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: C.gold, marginBottom: 12 }}>{module}</div>
                          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                            {perms.map((perm, idx) => {
                              const isChecked = editingPermissions?.includes(perm.slug);
                              return (
                                <div key={perm.slug} className="perm-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: idx < perms.length - 1 ? `1px solid ${C.divider}` : "none", cursor: !canEditRolePerms ? "default" : "pointer" }} onClick={() => togglePermission(perm.slug)}>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{perm.name}</div>
                                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{perm.description || perm.slug}</div>
                                  </div>
                                  <div>
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked} 
                                      disabled={!canEditRolePerms}
                                      onChange={() => togglePermission(perm.slug)}
                                      style={{ width: 18, height: 18, accentColor: C.gold, cursor: !canEditRolePerms ? "not-allowed" : "pointer" }}
                                      onClick={e => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 60, textAlign: "center", color: C.muted, border: `1px dashed ${C.border}`, borderRadius: 12 }}>
                    Select a role to view or edit permissions.
                  </div>
                )}

              </div>
            )}
          </div>
        </main>
      </div>

      {/* Impact Analysis Modal */}
      {impactModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(24,20,14,0.34)", backdropFilter: "blur(2px)", zIndex: 8000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "rolesFadeIn 200ms ease both" }}>
          <div style={{ width: "min(440px, 100%)", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", padding: 20 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: C.goldFaint, color: C.gold, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: C.text, fontWeight: 700 }}>Impact Analysis</h3>
                <p style={{ margin: "8px 0 16px", fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
                  You are about to modify the default permissions for the <strong>{selectedRole?.name}</strong> role.
                </p>
                <div style={{ padding: 12, background: C.surfaceSoft, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.text }}>
                  Warning: This will immediately affect <span style={{ color: C.gold }}>{roleAccountsCount} active accounts</span> currently assigned to this role.
                </div>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setImpactModalOpen(false)}
                style={{ padding: "0 16px", height: 34, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePermissions}
                disabled={saving}
                style={{ padding: "0 16px", height: 34, background: C.gold, border: "none", borderRadius: 8, color: "#fff", fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}
              >
                {saving && <Spinner color="#fff" size={12} />}
                {saving ? "Saving..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

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
