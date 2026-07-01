import React, { useState, useEffect, useMemo, useRef } from "react";
import { Check, ChevronRight, X, User, Shield, Map, Lock, ClipboardCheck, Search, ChevronDown, ChevronRight as ChevronRightIcon, RotateCcw, AlertCircle, Info } from "lucide-react";
import { authAPI } from "../../../services/authAPI";
import { useAdminTheme, C, F } from "../../../context/AdminThemeContext";



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

function inputStyle(hasError) {
  return {
    width: "100%",
    minHeight: 40,
    border: `1px solid ${hasError ? C.red : C.border}`,
    borderRadius: 8,
    padding: "8px 12px",
    fontFamily: F.body,
    fontSize: 13,
    color: C.text,
    background: C.surface,
    outline: "none",
    transition: "border 0.2s ease",
  };
}

function Field({ label, children, error }) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11, color: C.red }}>{error}</span>}
    </label>
  );
}

// Custom Switch Component
function Switch({ checked, onChange, disabled }) {
  return (
    <div
      onClick={() => !disabled && onChange(!checked)}
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
          background: checked ? C.gold : C.border,
          position: "relative",
          opacity: disabled ? 0.6 : 1,
          transition: "background 0.2s ease"
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            transition: "left 0.2s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
          }}
        />
      </div>
    </div>
  );
}

// Tri-state checkbox ref helper
function TriStateCheckbox({ checked, indeterminate, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} style={{ width: 15, height: 15, accentColor: C.gold, cursor: "pointer" }} />;
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

const STEPS = [
  { id: 1, title: "Account & Role", icon: <User size={14} /> },
  { id: 2, title: "Access Scope", icon: <Map size={14} /> },
  { id: 3, title: "Permissions", icon: <Shield size={14} /> },
  { id: 4, title: "Review", icon: <ClipboardCheck size={14} /> },
];

export default function AccountWizard({
  isOpen,
  isClosing,
  onClose,
  editingAccount,
  initialForm,
  availableRoles,
  assignableRoles,
  outletTree,
  permissionsList,
  onSave,
  loading,
  setHasUnsavedChanges
}) {
  const { isDark } = useAdminTheme();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [useRoleDefaults, setUseRoleDefaults] = useState(true);
  const [overrides, setOverrides] = useState([]); // [{ permission_id, effect }]

  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = sessionStorage.getItem("account_wizard_collapsed_groups");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleCollapse = (groupTitle) => {
    setCollapsedGroups(prev => {
      const next = { ...prev, [groupTitle]: !prev[groupTitle] };
      sessionStorage.setItem("account_wizard_collapsed_groups", JSON.stringify(next));
      return next;
    });
  };

  // Scopes state
  const [scopeSearch, setScopeSearch] = useState("");
  const [expandedNodes, setExpandedNodes] = useState({
    "main-wing": true,
    "tower-wing": true,
    "dining": true,
    "laguna-ballroom": true,
    "twenty-twenty-function-room": true,
    "tower-ballroom": true,
    "grand-ballroom": true,
  });
  const [reviewScopeExpanded, setReviewScopeExpanded] = useState(false);

  useEffect(() => {
    setForm(initialForm);
    setStep(1);

    if (editingAccount && editingAccount.overrides && editingAccount.overrides.length > 0) {
      setUseRoleDefaults(false);
      setOverrides(editingAccount.overrides.map(o => ({
        permission_id: o.permission_id,
        effect: o.effect
      })));
    } else {
      setUseRoleDefaults(true);
      setOverrides([]);
    }
  }, [initialForm, editingAccount, isOpen]);

  useEffect(() => {
    const formChanged = JSON.stringify(form) !== JSON.stringify(initialForm);
    const overridesChanged = editingAccount
      ? JSON.stringify(overrides) !== JSON.stringify(editingAccount.overrides?.map(o => ({ permission_id: o.permission_id, effect: o.effect })) || [])
      : overrides.length > 0;

    setHasUnsavedChanges(formChanged || overridesChanged);
  }, [form, overrides, initialForm, editingAccount, setHasUnsavedChanges]);

  // We moved the early return down to avoid breaking hook rules
  const roleRequiresAssignedScope = (role) => ["outlet_manager", "supervisor", "staff"].includes(role);

  const getRoleName = (slug) => {
    const r = availableRoles.find(ar => ar.slug === slug);
    return r ? r.name : slug;
  };

  const currentRole = availableRoles.find(r => r.slug === form.role);
  const currentRolePermissions = currentRole?.permissions || [];
  const currentRolePermSlugs = currentRolePermissions.map(p => p.slug);

  const operationalGroupings = useMemo(() => {
    return OPERATIONAL_GROUPS.map(group => {
      return {
        ...group,
        perms: group.permissions.map(permName => permissionsList.find(p => p.name === permName)).filter(Boolean)
      };
    }).filter(g => g.perms.length > 0);
  }, [permissionsList]);

  const handleNext = () => setStep(s => Math.min(4, s + 1));
  const handlePrev = () => setStep(s => Math.max(1, s - 1));

  const updateEffectiveAccess = (updaterFn) => {
    const currentUser = authAPI.getCurrentUser();
    const isSuperAdmin = currentUser?.role === "super_admin";

    setOverrides(prev => {
      let effectiveSlugs = permissionsList
        .filter(p => {
          const isDefault = currentRolePermSlugs.includes(p.slug);
          const override = prev.find(o => o.permission_id === p.id);
          return override ? override.effect === 'allow' : isDefault;
        })
        .map(p => p.slug);
      
      let nextSlugs = updaterFn([...effectiveSlugs]);
      
      return permissionsList.map(p => {
        const canEdit = isSuperAdmin || authAPI.hasPermission(p.slug);
        const wantsOn = canEdit ? nextSlugs.includes(p.slug) : effectiveSlugs.includes(p.slug);
        const isDefaultOn = currentRolePermSlugs.includes(p.slug);
        if (wantsOn !== isDefaultOn) {
          return { permission_id: p.id, effect: wantsOn ? 'allow' : 'deny' };
        }
        return null;
      }).filter(Boolean);
    });
  };

  const toggleOverride = (permission_id, grantAccess) => {
    const perm = permissionsList.find(p => p.id === permission_id);
    if (!perm) return;

    updateEffectiveAccess(prev => {
      let next = grantAccess ? [...prev, perm.slug] : prev.filter(s => s !== perm.slug);
      
      if (grantAccess && perm.slug !== "view_admin") {
        if (!next.includes("view_admin")) next.push("view_admin");
      }
      
      if (!grantAccess && perm.slug === "view_admin") {
        if (next.length > 0) return prev;
      }
      return next;
    });
  };

  const toggleOverrideGroup = (groupPerms, isGroupOn) => {
    updateEffectiveAccess(prev => {
      let next = [...prev];
      const groupSlugs = groupPerms.map(p => p.slug);
      
      if (isGroupOn) {
        next = next.filter(s => !groupSlugs.includes(s));
        if (groupSlugs.includes("view_admin") && next.length > 0) return prev;
      } else {
        const missing = groupSlugs.filter(s => !prev.includes(s));
        next = [...next, ...missing];
        if (!next.includes("view_admin") && groupSlugs.length > 0) {
          next.push("view_admin");
        }
      }
      return next;
    });
  };

  const resetAllOverrides = () => {
    setUseRoleDefaults(true);
    setOverrides([]);
  };

  const getEffectiveAccess = (permission_id) => {
    const perm = permissionsList.find(p => p.id === permission_id);
    if (!perm) return false;
    const isDefaultGranted = currentRolePermSlugs.includes(perm.slug);

    const override = overrides.find(o => o.permission_id === permission_id);
    if (override) {
      return override.effect === 'allow';
    }
    return isDefaultGranted;
  };

  // --- Scope selection logic ---
  const allLeafVenues = useMemo(() => {
    const leaves = [];
    const traverse = (node) => {
      if (node.value) leaves.push(node);
      if (node.children) node.children.forEach(traverse);
    };
    outletTree.forEach(traverse);
    return leaves;
  }, [outletTree]);

  const getLeafValues = (node) => {
    if (node.value) return [node.value];
    if (node.children) return node.children.flatMap(getLeafValues);
    return [];
  };

  const toggleNode = (node, isChecked) => {
    const leaves = getLeafValues(node);
    setForm(prev => {
      const nextScope = isChecked
        ? Array.from(new Set([...prev.outlet_scope, ...leaves]))
        : prev.outlet_scope.filter(v => !leaves.includes(v));
      return { ...prev, outlet_scope: nextScope };
    });
  };

  const renderNode = (node, depth = 0) => {
    const leaves = getLeafValues(node);
    if (leaves.length === 0) return null;

    if (scopeSearch) {
      const hasMatchingDescendant = (n) => {
        if (n.label.toLowerCase().includes(scopeSearch.toLowerCase())) return true;
        if (n.children) return n.children.some(hasMatchingDescendant);
        return false;
      };
      if (!hasMatchingDescendant(node)) return null;
    }

    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isExpanded = expandedNodes[node.id] !== false;

    const selectedCount = leaves.filter(v => form.outlet_scope.includes(v)).length;
    const isChecked = selectedCount === leaves.length;
    const isIndeterminate = selectedCount > 0 && selectedCount < leaves.length;

    return (
      <div key={node.id} style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: `6px 14px 6px ${14 + depth * 20}px`,
            background: (isChecked || isIndeterminate) ? C.goldFaint : "transparent",
            minHeight: 36,
            transition: "background 0.2s ease"
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpandedNodes(prev => ({ ...prev, [node.id]: !isExpanded }))}
              style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", color: C.muted, width: 16, height: 16, justifyContent: "center" }}
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
            </button>
          ) : (
            <div style={{ width: 16 }} />
          )}

          <TriStateCheckbox
            checked={isChecked}
            indeterminate={isIndeterminate}
            onChange={(e) => toggleNode(node, e.target.checked)}
          />

          <span
            style={{
              fontSize: 13,
              fontWeight: hasChildren ? 650 : 400,
              color: isChecked ? C.text : C.muted,
              cursor: "pointer",
              userSelect: "none",
              flex: 1,
              marginLeft: 4
            }}
            onClick={() => toggleNode(node, !isChecked)}
          >
            {node.label}
          </span>

          {hasChildren && (
            <span style={{ fontSize: 10, color: C.muted, background: C.border, padding: "2px 6px", borderRadius: 10, fontWeight: 600 }}>
              {selectedCount}/{leaves.length}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const isNextDisabled = () => {
    if (step === 1) return !form.name || !form.email || !form.username || !form.role;
    if (step === 2) return form.scope_type === "assigned" && (!form.outlet_scope || form.outlet_scope.length === 0);
    return false;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, overrides: useRoleDefaults ? [] : overrides });
  };

  // Build a nested object for the Review step's scope summary
  const groupedSelectedOutlets = useMemo(() => {
    const grouped = {};
    outletTree.forEach(wing => {
      const leaves = [];
      const traverse = (n) => { if (n.value) leaves.push(n); if (n.children) n.children.forEach(traverse); };
      traverse(wing);
      const selected = leaves.filter(l => form.outlet_scope.includes(l.value));
      if (selected.length > 0) {
        grouped[wing.label] = selected;
      }
    });
    return grouped;
  }, [form.outlet_scope, outletTree]);

  if (!isOpen && !isClosing) return null;

  return (
    <div className={`account-drawer-backdrop${isClosing ? " is-closing" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 7000, background: "rgba(24,20,14,0.28)", display: "flex", justifyContent: "flex-end", backdropFilter: "blur(2px)" }}>
      <style>{`
        @media (max-width: 720px) {
          .account-form-two-col {
            grid-template-columns: 1fr !important;
          }
          .review-account-left-pane {
            border-right: none !important;
            border-bottom: 1px solid ${C.divider} !important;
          }
          .account-drawer {
            border-left: none !important;
            border-radius: 0 !important;
          }
          .account-drawer > div:first-child {
            padding: 14px 16px !important;
          }
          .account-drawer > div:nth-child(2) {
            padding: 10px 16px !important;
          }
          .account-drawer > div:nth-child(3) {
            padding: 16px !important;
          }
          .account-drawer > div:last-child {
            padding: 12px 16px !important;
          }
          .account-drawer > div:last-child button {
            min-width: 60px !important;
            padding: 0 10px !important;
            font-size: 10px !important;
          }
        }
      `}</style>
      <aside className="account-drawer" style={{ width: "min(500px, 100vw)", height: "100%", background: C.surface, borderLeft: `1px solid ${C.border}`, boxShadow: "0 24px 70px rgba(24,20,14,0.22)", display: "flex", flexDirection: "column" }}>

        {/* Header (Fixed) */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ color: C.gold, fontSize: 9, fontWeight: 750, letterSpacing: "0.16em", textTransform: "uppercase" }}>Account Wizard</div>
            <h2 style={{ margin: "2px 0 0", color: C.text, fontSize: 20, fontWeight: 640 }}>{editingAccount ? "Edit Account" : "Create Account"}</h2>
          </div>
          <button type="button" onClick={onClose} style={{ minWidth: 32, height: 32, padding: 0, border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
            <X size={16} />
          </button>
        </div>

        {/* Stepper (Fixed) */}
        <div style={{ display: "flex", alignItems: "center", padding: "12px 20px", background: C.surfaceSoft, borderBottom: `1px solid ${C.divider}`, flexShrink: 0 }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  width: 22, 
                  height: 22, 
                  borderRadius: "50%", 
                  background: step >= s.id ? C.gold : C.divider, 
                  color: step >= s.id ? "#fff" : C.muted, 
                  opacity: step >= s.id ? 1 : 0.4,
                  flexShrink: 0,
                  transition: "background 0.25s ease, color 0.25s ease, opacity 0.25s ease"
                }}
              >
                {step > s.id ? <Check size={11} /> : s.icon}
              </div>
              {i < STEPS.length - 1 && (
                <div 
                  style={{ 
                    flex: 1, 
                    height: 2, 
                    background: step > s.id ? C.gold : C.divider, 
                    borderRadius: 2,
                    margin: "0 8px",
                    opacity: step > s.id ? 1 : 0.4,
                    transition: "background 0.25s ease, opacity 0.25s ease"
                  }} 
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {step === 1 && (
            <div style={{ display: "grid", gap: 24 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 650, color: C.text }}>Account & Role</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>Enter the staff member’s login information and select their default access role.</p>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                <div className="account-form-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
                  <Field label="Full Name">
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle(!form.name)} />
                  </Field>
                  <Field label="Email Address">
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle(!form.email)} />
                  </Field>
                </div>
                {editingAccount ? (
                  <>
                    <div className="account-form-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
                      <Field label="Username">
                        <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={inputStyle(!form.username)} />
                      </Field>
                      <Field label="New Password">
                        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current" style={inputStyle(false)} />
                      </Field>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: -6, paddingLeft: 2 }}>
                      Leave blank if the password should not change.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, alignItems: "start" }}>
                      <Field label="Username">
                        <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={inputStyle(!form.username)} />
                      </Field>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, background: C.goldFaint, border: `1px solid rgba(140,107,42,0.18)`, padding: "12px 14px", borderRadius: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.gold, display: "flex", alignItems: "center", gap: 6 }}>
                        <Info size={14} /> Password Auto-Setup
                      </span>
                      <span style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.4 }}>
                        No password is required. An invitation email with a secure link will be sent to the user's email to set their password.
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div>
                <Field label="Role Selection" />
                <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                  {assignableRoles.map(roleSlug => {
                    const r = availableRoles.find(ar => ar.slug === roleSlug);
                    if (!r) return null;
                    const isSelected = form.role === r.slug;
                    return (
                      <div key={r.slug} onClick={() => setForm({ ...form, role: r.slug, scope_type: roleRequiresAssignedScope(r.slug) ? "assigned" : "all", outlet_scope: roleRequiresAssignedScope(r.slug) ? form.outlet_scope : [] })} style={{ padding: "12px 14px", border: `2px solid ${isSelected ? C.gold : C.divider}`, borderRadius: 10, cursor: "pointer", background: isSelected ? C.goldFaint : C.surface, transition: "all 0.15s ease", display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${isSelected ? C.gold : C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.gold }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                            <div style={{ fontWeight: 650, color: C.text, fontSize: 14 }}>{r.name}</div>
                            {r.is_system ? <span style={{ fontSize: 9, padding: "2px 6px", background: C.border, color: C.muted, borderRadius: 4, fontWeight: 700 }}>SYSTEM</span> : <span style={{ fontSize: 9, padding: "2px 6px", background: C.greenFaint, color: C.green, borderRadius: 4, fontWeight: 700 }}>CUSTOM</span>}
                          </div>
                          <div style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.description || "Default access privileges."} • {r.permissions?.length || 0} permissions</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 650, color: C.text }}>Access Scope</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>Choose which outlets and venues this account can access.</p>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <label style={{ flex: 1, padding: 12, border: `2px solid ${form.scope_type === "all" ? C.gold : C.divider}`, borderRadius: 10, background: form.scope_type === "all" ? C.goldFaint : C.surface, cursor: roleRequiresAssignedScope(form.role) ? "not-allowed" : "pointer", opacity: roleRequiresAssignedScope(form.role) ? 0.6 : 1, display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="radio" name="scope_type" value="all" checked={form.scope_type === "all"} disabled={roleRequiresAssignedScope(form.role)} onChange={() => setForm({ ...form, scope_type: "all", outlet_scope: [] })} style={{ accentColor: C.gold, width: 16, height: 16 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 650, color: C.text }}>All Outlets</div>
                    <div style={{ fontSize: 11, color: C.muted }}>Unrestricted venue access</div>
                  </div>
                </label>
                <label style={{ flex: 1, padding: 12, border: `2px solid ${form.scope_type === "assigned" ? C.gold : C.divider}`, borderRadius: 10, background: form.scope_type === "assigned" ? C.goldFaint : C.surface, cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="radio" name="scope_type" value="assigned" checked={form.scope_type === "assigned"} onChange={() => setForm({ ...form, scope_type: "assigned" })} style={{ accentColor: C.gold, width: 16, height: 16 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 650, color: C.text }}>Selected Outlets</div>
                    <div style={{ fontSize: 11, color: C.muted }}>Specific assignments only</div>
                  </div>
                </label>
              </div>

              {form.scope_type === "assigned" && (
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column", height: 380 }}>
                  <div style={{ padding: "10px 14px", background: C.surfaceSoft, borderBottom: `1px solid ${C.divider}`, display: "flex", gap: 10, alignItems: "center" }}>
                    <Search size={14} color={C.muted} />
                    <input
                      placeholder="Search venues..."
                      value={scopeSearch}
                      onChange={e => setScopeSearch(e.target.value)}
                      style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, flex: 1 }}
                    />
                    {form.outlet_scope.length > 0 && (
                      <button type="button" onClick={() => setForm({ ...form, outlet_scope: [] })} style={{ fontSize: 11, background: "transparent", border: "none", color: C.red, cursor: "pointer", fontWeight: 600 }}>Clear all</button>
                    )}
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
                    {outletTree.map(node => renderNode(node, 0))}
                  </div>
                  <div style={{ padding: "8px 14px", background: C.surfaceSoft, borderTop: `1px solid ${C.divider}`, fontSize: 11, color: C.muted, textAlign: "right" }}>
                    {form.outlet_scope.length} venues selected
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 650, color: C.text }}>Permissions</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>Use the selected role’s default permissions or customize access for this account.</p>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, border: `1px solid ${useRoleDefaults ? C.gold : C.border}`, borderRadius: 10, background: useRoleDefaults ? C.goldFaint : C.surface, cursor: "pointer", transition: "all 0.2s ease" }} onClick={() => useRoleDefaults ? null : resetAllOverrides()}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 650, color: C.text }}>Use role-default permissions</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>The account will perfectly match the <strong>{getRoleName(form.role)}</strong> role capabilities.</div>
                </div>
                <Switch checked={useRoleDefaults} onChange={checked => {
                  if (checked) resetAllOverrides();
                  else setUseRoleDefaults(false);
                }} />
              </div>

              {!useRoleDefaults && (
                <div style={{ animation: "accountSpin 0.2s ease-out", animationName: "rolesFadeIn" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 650, display: "flex", alignItems: "center", gap: 6 }}><Lock size={14} color={C.gold} /> Customized Permissions</div>
                    <button type="button" onClick={resetAllOverrides} style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: C.muted, fontSize: 11, fontWeight: 650, cursor: "pointer", textTransform: "uppercase" }}><RotateCcw size={12} /> Reset to default</button>
                  </div>
                  <div style={{ padding: 24, display: "grid", gap: 20 }}>
                    {operationalGroupings.map((group) => {
                      const activeInGroupCount = group.perms.filter(p => getEffectiveAccess(p.id)).length;
                      const isGroupOn = activeInGroupCount === group.perms.length;
                      const isGroupPartial = activeInGroupCount > 0 && activeInGroupCount < group.perms.length;
                      const isCollapsed = collapsedGroups[group.title];

                      const currentUser = authAPI.getCurrentUser();
                      const isSuperAdmin = currentUser?.role === "super_admin";

                      return (
                        <div key={group.title} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: C.shadowSoft, overflow: "hidden", display: "flex", flexDirection: "column", transition: "box-shadow 0.2s ease" }}>
                          <div 
                            style={{ padding: "16px 20px", background: C.surfaceSoft, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
                            onClick={() => toggleCollapse(group.title)}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 20 }}>
                              <button type="button" style={{ background: "transparent", border: "none", color: C.muted, display: "flex", alignItems: "center", padding: 0, cursor: "pointer", outline: "none" }}>
                                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              </button>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
                                  {group.title}
                                  <span style={{ fontSize: 10, background: C.divider, padding: "2px 6px", borderRadius: 10, color: C.muted, fontWeight: 650 }}>{group.perms.length}</span>
                                </div>
                                <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.4 }}>{group.description}</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 14 }} onClick={e => e.stopPropagation()}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                                {isGroupPartial ? "PARTIAL" : isGroupOn ? "ALL ENABLED" : "DISABLED"} ({activeInGroupCount}/{group.perms.length})
                              </span>
                              <Switch 
                                checked={isGroupOn}
                                indeterminate={isGroupPartial}
                                disabled={false}
                                onChange={() => toggleOverrideGroup(group.perms, isGroupOn)}
                              />
                            </div>
                          </div>
                          
                          {!isCollapsed && (
                            <div style={{ borderTop: `1px solid ${C.divider}` }}>
                              {group.perms.map((perm, idx) => {
                                const isEffective = getEffectiveAccess(perm.id);
                                const isOverridden = overrides.some(o => o.permission_id === perm.id);
                                const hasThisPermission = isSuperAdmin || authAPI.hasPermission(perm.slug);
                                const isDefaultGranted = currentRolePermSlugs.includes(perm.slug);

                                return (
                                  <div key={perm.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: idx < group.perms.length - 1 ? `1px solid ${C.divider}` : "none", background: isOverridden ? "rgba(140,107,42,0.02)" : "transparent", opacity: hasThisPermission ? 1 : 0.6 }}>
                                    <div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
                                          {perm.name}
                                          <PermissionTooltip perm={perm} />
                                        </span>
                                        {isOverridden && <span style={{ fontSize: 9, padding: "2px 6px", background: C.gold, color: "#fff", borderRadius: 4, fontWeight: 700 }}>OVERRIDE</span>}
                                        {!hasThisPermission && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, padding: "2px 6px", background: C.divider, color: C.muted, borderRadius: 4, fontWeight: 700 }}><Lock size={9} /> LOCKED</span>}
                                      </div>
                                      {!hasThisPermission && (
                                        <div style={{ fontSize: 10, color: C.red, marginTop: 4, fontWeight: 550 }}>
                                          You do not possess this permission and cannot assign or revoke it.
                                        </div>
                                      )}
                                      {isOverridden && hasThisPermission && (
                                        <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                                          Default for this role is <strong>{isDefaultGranted ? "Allowed" : "Denied"}</strong>.
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                      {isOverridden && hasThisPermission && (
                                        <button type="button" onClick={() => toggleOverride(perm.id, isDefaultGranted)} title="Revert to role default" style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", display: "flex" }}><RotateCcw size={14} /></button>
                                      )}
                                      <Switch 
                                        checked={isEffective} 
                                        disabled={!hasThisPermission}
                                        onChange={(checked) => toggleOverride(perm.id, checked)}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div style={{ display: "grid", gap: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 650, color: C.text }}>Review & Save</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: C.muted }}>Confirm the account details, access scope, and effective permissions before saving.</p>
              </div>

              <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, overflow: "hidden" }}>
                <div className="account-form-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: `1px solid ${C.divider}` }}>
                  <div className="review-account-left-pane" style={{ padding: 14, borderRight: `1px solid ${C.divider}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Account</div>
                    <div style={{ fontSize: 14, fontWeight: 650 }}>{form.name}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{form.email}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>@{form.username}</div>
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Role</div>
                    <div style={{ fontSize: 14, fontWeight: 650, color: C.gold }}>{getRoleName(form.role)}</div>
                  </div>
                </div>

                <div style={{ padding: 14, borderBottom: `1px solid ${C.divider}`, background: C.surfaceSoft }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: "0.1em" }}>Access Scope</div>
                    <button type="button" onClick={() => setStep(2)} style={{ fontSize: 11, color: C.gold, background: "transparent", border: "none", cursor: "pointer", fontWeight: 650 }}>Edit</button>
                  </div>

                  {form.scope_type === "all" ? (
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>All Outlets and Venues</div>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      <div
                        onClick={() => setReviewScopeExpanded(!reviewScopeExpanded)}
                        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: C.text, cursor: "pointer" }}
                      >
                        {reviewScopeExpanded ? <ChevronDown size={14} color={C.muted} /> : <ChevronRightIcon size={14} color={C.muted} />}
                        {form.outlet_scope.length} outlets and venues assigned
                      </div>

                      {reviewScopeExpanded && (
                        <div style={{ marginTop: 10, marginLeft: 20, display: "grid", gap: 8 }}>
                          {Object.entries(groupedSelectedOutlets).map(([wing, venues]) => (
                            <div key={wing}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 2 }}>{wing}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {venues.map(v => (
                                  <span key={v.id} style={{ fontSize: 11, padding: "2px 8px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text }}>{v.label}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ padding: 14, background: C.surfaceSoft }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: "0.1em" }}>Permission Configuration</div>
                    <button type="button" onClick={() => setStep(3)} style={{ fontSize: 11, color: C.gold, background: "transparent", border: "none", cursor: "pointer", fontWeight: 650 }}>Edit</button>
                  </div>

                  {useRoleDefaults ? (
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                      <Check size={14} color={C.green} /> Using role defaults ({currentRolePermissions.length} permissions granted)
                    </div>
                  ) : (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Customized Permissions</div>
                      <div style={{ display: "flex", gap: 16 }}>
                        <div style={{ fontSize: 12, color: C.muted }}><strong style={{ color: C.green }}>{overrides.filter(o => o.effect === 'allow').length}</strong> explicitly granted</div>
                        <div style={{ fontSize: 12, color: C.muted }}><strong style={{ color: C.red }}>{overrides.filter(o => o.effect === 'deny').length}</strong> explicitly revoked</div>
                      </div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Total effective permissions: <strong>{currentRolePermissions.length + overrides.filter(o => o.effect === 'allow').length - overrides.filter(o => o.effect === 'deny').length}</strong></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer (Fixed) */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.divider}`, background: C.surfaceSoft, display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              type="button" 
              onClick={onClose} 
              disabled={loading} 
              style={{ minWidth: 80, height: 36, padding: "0 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, fontWeight: 700, fontSize: 11, cursor: "pointer" }}
            >
              Cancel
            </button>
            {step > 1 && (
              <button 
                type="button" 
                onClick={handlePrev} 
                disabled={loading} 
                style={{ minWidth: 80, height: 36, padding: "0 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, fontWeight: 700, fontSize: 11, cursor: "pointer" }}
              >
                Back
              </button>
            )}
          </div>
          
          {step < 4 ? (
            <button type="button" onClick={handleNext} disabled={isNextDisabled() || loading} style={{ minWidth: 90, height: 36, padding: "0 14px", borderRadius: 8, border: "none", background: C.gold, color: "#fff", fontWeight: 700, fontSize: 11, cursor: isNextDisabled() ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>Next <ChevronRight size={14} /></button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading} style={{ minWidth: 130, height: 36, padding: "0 14px", borderRadius: 8, border: "none", background: C.green, color: "#fff", fontWeight: 700, fontSize: 11, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading && <Spinner color="#fff" size={12} />}
              {editingAccount ? "Save Changes" : "Create Account"}
            </button>
          )}
        </div>

      </aside>
    </div>
  );
}
