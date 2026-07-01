import { useEffect, useState, useMemo } from "react";
import { Plus, X, Edit2, ShieldAlert, Check, Trash2, Shield, Users, Search, AlertTriangle, Info, ChevronDown, ChevronRight } from "lucide-react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import Sidebar from "../../../components/layout/Sidebar";
import { roleAPI } from "../../../services/roleAPI";
import { authAPI } from "../../../services/authAPI";

import { useAdminTheme, C, F } from "../../../context/AdminThemeContext";

// Custom Switch Component
function Switch({ checked, indeterminate, onChange, disabled }) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 44,
        height: 44,
        cursor: disabled ? "not-allowed" : "pointer",
        margin: "-12px -4px",
      }}
    >
      <div
        style={{
          width: 36,
          height: 20,
          borderRadius: 20,
          background: indeterminate ? C.gold : checked ? C.gold : C.border,
          position: "relative",
          opacity: disabled ? 0.6 : 1,
          transition: "background 0.2s ease"
        }}
      >
        <div
          style={{
            width: indeterminate ? 10 : 16,
            height: indeterminate ? 4 : 16,
            borderRadius: indeterminate ? 2 : "50%",
            background: "#fff",
            position: "absolute",
            top: indeterminate ? 8 : 2,
            left: indeterminate ? 13 : checked ? 18 : 2,
            transition: "all 0.2s ease",
            boxShadow: indeterminate ? "none" : "0 1px 3px rgba(0,0,0,0.2)"
          }}
        />
      </div>
    </div>
  );
}

const OPERATIONAL_GROUPS = [
  {
    title: "Admin Access",
    description: "Basic access to the admin portal and permitted dashboard modules.",
    permissions: ["View Admin Panel"]
  },
  {
    title: "Reservation Operations",
    description: "Controls reservation queue work, booking decisions, guest detail adjustments, and reservation lifecycle actions.",
    permissions: ["Manage Reservations", "Adjust Reservation Details", "Delete Reservations", "Acknowledge Notifications"]
  },
  {
    title: "Seat Map Operations",
    description: "Controls draft editing, publishing, and recovery of seat map layouts used by guest reservation pages.",
    permissions: ["Manage Seat Maps (Draft)", "Publish Seat Maps", "Restore Seat Map Versions"]
  },
  {
    title: "Venue & Outlet Operations",
    description: "Controls outlet, venue, room, and subroom setup used by guest-facing reservation flows.",
    permissions: ["Manage Venues", "Manage Events"]
  },
  {
    title: "Reports & Analytics",
    description: "Controls access to operational dashboards, outlet reports, global reports, and transaction views.",
    permissions: ["View Outlet Reports", "View Global Reports", "View Transactions"]
  },
  {
    title: "Account Administration",
    description: "Controls admin accounts, roles, scopes, permission overrides, and system-level user access.",
    permissions: ["Manage Accounts", "Manage System Users"]
  }
];

const PERMISSION_DESCRIPTIONS = {
  "View Admin Panel": "Allows the account to access the admin portal and view permitted admin modules.",
  "Manage Reservations": "Allows the account to approve, reject, revert, cancel, and process reservation requests.",
  "Adjust Reservation Details": "Allows the account to edit reservation details such as guest information, schedule, notes, coordination fields, assigned room, table, or seat details.",
  "Delete Reservations": "Allows the account to permanently delete reservation records. This should be limited to high-level administrators.",
  "Acknowledge Notifications": "Allows the account to mark admin notifications as acknowledged after reviewing them.",
  "Manage Seat Maps (Draft)": "Allows the account to create and edit seat map draft layouts for outlets, venues, rooms, and subrooms.",
  "Publish Seat Maps": "Allows the account to publish approved seat map layouts so they become visible on the guest reservation pages.",
  "Restore Seat Map Versions": "Allows the account to restore a previous published seat map version when a layout needs to be rolled back.",
  "Manage Venues": "Allows the account to create, edit, archive, activate, deactivate, and configure outlets, venues, rooms, and subrooms.",
  "Manage Events": "Allows the account to create, edit, publish, and configure special events, including event dates, banners, and capacities.",
  "View Outlet Reports": "Allows the account to view outlet and venue performance reports, reservation summaries, and operational dashboards.",
  "View Global Reports": "Allows the account to view system-wide reports across all outlets, venues, and reservation areas.",
  "View Transactions": "Allows the account to view transaction-related records, reservation activity, and operational logs where available.",
  "Manage Accounts": "Allows the account to create, edit, deactivate, reactivate, and configure admin accounts, roles, scopes, and permission overrides.",
  "Manage System Users": "Allows the account to manage higher-level system user access and user administration settings.",
};

function PermissionTooltip({ perm }) {
  const [show, setShow] = useState(false);
  const desc = PERMISSION_DESCRIPTIONS[perm.name] || perm.description || "No description has been added for this permission yet.";

  return (
    <div 
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <Info size={13} color={C.muted} style={{ cursor: "help", opacity: 0.7, outline: "none" }} tabIndex={0} />
      {show && (
        <div style={{
          position: "absolute",
          left: 24,
          top: "50%",
          transform: "translateY(-50%)",
          background: C.surfaceSoft,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          boxShadow: C.shadow,
          width: 240,
          padding: "12px 14px",
          zIndex: 100,
          animation: "rolesFadeIn 150ms ease-out",
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 4 }}>{perm.name}</div>
          <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{desc}</div>
        </div>
      )}
    </div>
  );
}

// Local F is replaced by context-imported F

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
  const { isDark } = useAdminTheme();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 960);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 960) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = sessionStorage.getItem("roles_collapsed_groups");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleCollapse = (groupTitle) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [groupTitle]: !prev[groupTitle] };
      sessionStorage.setItem("roles_collapsed_groups", JSON.stringify(next));
      return next;
    });
  };

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
    if (!canEditRolePerms) return;
    
    setEditingPermissions(prev => {
      let next = prev.includes(slug) ? prev.filter(p => p !== slug) : [...prev, slug];
      
      if (!prev.includes(slug) && slug !== "view_admin") {
        if (!next.includes("view_admin")) {
          next.push("view_admin");
        }
      }
      
      if (prev.includes(slug) && slug === "view_admin") {
        if (next.length > 0) {
          setToast({ type: "error", message: "Cannot disable View Admin Panel while other permissions are active." });
          return prev;
        }
      }

      const original = (selectedRole?.permissions || []).map(p => p.slug);
      const isChanged = next.length !== original.length || !next.every(n => original.includes(n));
      setHasUnsavedPerms(isChanged);
      return next;
    });
  };

  const toggleGroup = (groupPerms) => {
    if (!canEditRolePerms) return;
    
    setEditingPermissions(prev => {
      const groupSlugs = groupPerms.map(p => p.slug);
      const activeInGroup = groupSlugs.filter(s => prev.includes(s));
      
      let next = [...prev];
      if (activeInGroup.length === groupSlugs.length) {
        next = next.filter(s => !groupSlugs.includes(s));
        if (groupSlugs.includes("view_admin") && next.length > 0) {
           setToast({ type: "error", message: "Cannot disable View Admin Panel while permissions in other groups are active." });
           return prev;
        }
      } else {
        const missing = groupSlugs.filter(s => !prev.includes(s));
        next = [...next, ...missing];
        if (!next.includes("view_admin") && groupSlugs.length > 0) {
          next.push("view_admin");
        }
      }
      
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

  const operationalGroupings = useMemo(() => {
    return OPERATIONAL_GROUPS.map(group => {
      return {
        ...group,
        perms: group.permissions.map(permName => allPermissions.find(p => p.name === permName)).filter(Boolean)
      };
    }).filter(g => g.perms.length > 0);
  }, [allPermissions]);

  const filteredRoles = useMemo(() => {
    if (!roleSearch) return roles;
    return roles.filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase()) || r.slug.toLowerCase().includes(roleSearch.toLowerCase()));
  }, [roles, roleSearch]);

  const roleAccountsCount = selectedRole ? accounts.filter(a => a.role === selectedRole.slug && a.is_active !== false).length : 0;

  return (
    <div style={{ display: "flex", height: "100vh", minHeight: 0, overflow: "hidden", background: C.pageBg, fontFamily: F.body }}>
       <style>{`
        @keyframes rolesSpin { to { transform: rotate(360deg); } }
        @keyframes rolesSlideIn { from { opacity: 0; transform: translate3d(34px,0,0); } to { opacity: 1; transform: translate3d(0,0,0); } }
        @keyframes rolesFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .role-card:hover { border-color: ${C.gold} !important; background: ${C.goldFaint} !important; }
        .perm-row:hover { background: rgba(140,107,42,0.024) !important; }
        .roles-split-layout {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 768px) {
          .roles-split-layout {
            grid-template-columns: 1fr !important;
          }
          .role-drawer {
            width: 100% !important;
            max-width: 100vw !important;
          }
          .perm-group-header {
            flex-wrap: wrap !important;
            gap: 12px !important;
            padding: 14px 16px !important;
          }
          .perm-group-header-left {
            flex: 1 1 100% !important;
            min-width: 0 !important;
            padding-right: 0 !important;
          }
          .perm-group-toggle {
            width: 100% !important;
            justify-content: space-between !important;
            padding-left: 28px !important;
          }
          .perm-row {
            padding: 12px 16px !important;
            gap: 12px !important;
          }
          .perm-row-label {
            min-width: 0 !important;
            flex: 1 !important;
          }
          .perm-panel-header {
            padding: 14px 16px !important;
            flex-wrap: wrap !important;
            gap: 10px !important;
          }
          .perm-panel-header h3 {
            font-size: 16px !important;
          }
          .perm-panel-body {
            padding: 16px !important;
            gap: 16px !important;
          }
          .perm-save-actions {
            flex-wrap: wrap !important;
          }
          .perm-save-actions button {
            font-size: 10px !important;
            padding: 6px 10px !important;
          }
        }
      `}</style>

      <Sidebar activeNav="roles" isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", flex: 1, minWidth: 0, overflow: "hidden" }}>
        <AdminNavbar />

        <main className="admin-page-content-container">
          <div style={{ display: "grid", gap: 18 }}>
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
              <div className="roles-split-layout">
                
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
                  <div className="perm-panel-header" style={{ padding: "18px 24px", borderBottom: `1px solid ${C.divider}`, background: C.surfaceSoft, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
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
                        <div className="perm-save-actions" style={{ display: "flex", gap: 10 }}>
                          <button type="button" onClick={() => { setEditingPermissions((selectedRole.permissions || []).map(p => p.slug)); setHasUnsavedPerms(false); }} style={{ padding: "8px 14px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.muted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer" }}>Discard</button>
                          <button type="button" onClick={() => setImpactModalOpen(true)} style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: C.gold, color: "#fff", fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                            Save Changes
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="perm-panel-body" style={{ padding: 24, display: "grid", gap: 20 }}>
                      {operationalGroupings.map(group => {
                        const activeInGroupCount = group.perms.filter(p => editingPermissions?.includes(p.slug)).length;
                        const isGroupOn = activeInGroupCount === group.perms.length;
                        const isGroupPartial = activeInGroupCount > 0 && activeInGroupCount < group.perms.length;
                        const isCollapsed = collapsedGroups[group.title];

                        return (
                          <div key={group.title} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadowSoft, overflow: "hidden", display: "flex", flexDirection: "column", transition: "box-shadow 0.2s ease" }}>
                            {/* Card Header */}
                            <div 
                              className="perm-group-header"
                              style={{ padding: "16px 20px", background: C.surfaceSoft, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
                              onClick={() => toggleCollapse(group.title)}
                            >
                              <div className="perm-group-header-left" style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 20, flex: 1, minWidth: 0 }}>
                                <button type="button" style={{ background: "transparent", border: "none", color: C.muted, display: "flex", alignItems: "center", padding: 0, cursor: "pointer", outline: "none", flexShrink: 0 }}>
                                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                </button>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    {group.title}
                                    <span style={{ fontSize: 10, background: C.divider, padding: "2px 6px", borderRadius: 10, color: C.muted, fontWeight: 650 }}>{group.perms.length}</span>
                                  </div>
                                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>{group.description}</div>
                                </div>
                              </div>
                              <div className="perm-group-toggle" style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                                  {isGroupPartial ? "PARTIAL" : isGroupOn ? "ALL ENABLED" : "DISABLED"} ({activeInGroupCount}/{group.perms.length})
                                </span>
                                <Switch 
                                  checked={isGroupOn}
                                  indeterminate={isGroupPartial}
                                  disabled={!canEditRolePerms}
                                  onChange={() => toggleGroup(group.perms)}
                                />
                              </div>
                            </div>
                            
                            {/* Card Body */}
                            {!isCollapsed && (
                              <div style={{ borderTop: `1px solid ${C.divider}` }}>
                                {group.perms.map((perm, idx) => {
                                  const isChecked = editingPermissions?.includes(perm.slug);
                                  return (
                                    <div key={perm.slug} className="perm-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: idx < group.perms.length - 1 ? `1px solid ${C.divider}` : "none", gap: 16 }}>
                                      <div className="perm-row-label" style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
                                          {perm.name}
                                          <PermissionTooltip perm={perm} />
                                        </div>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                                        <Switch 
                                          checked={isChecked} 
                                          disabled={!canEditRolePerms}
                                          onChange={() => togglePermission(perm.slug)}
                                        />
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
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
          <aside className="role-drawer" style={{ width: "min(480px, calc(100vw - 28px))", background: C.surface, height: "100%", borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", boxShadow: "0 24px 70px rgba(24,20,14,0.22)", animation: "rolesSlideIn 320ms cubic-bezier(0.22,1,0.36,1) both" }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ color: C.gold, fontSize: 8.5, fontWeight: 750, letterSpacing: "0.16em", textTransform: "uppercase" }}>Administration</div>
                <h2 style={{ margin: "5px 0 0", fontSize: 21, fontWeight: 640, color: C.text, lineHeight: 1.15 }}>{editingId ? "Edit Role Info" : "Create Role"}</h2>
              </div>
              <button type="button" onClick={() => setDrawerOpen(false)} style={{ width: 36, height: 36, border: `1px solid rgba(140,107,42,0.22)`, borderRadius: 8, background: C.surface, color: C.gold, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
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
