import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Search, UserPlus, X, AlertTriangle, Check } from "lucide-react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import Sidebar from "../../../components/layout/Sidebar";
import { authAPI } from "../../../services/authAPI";
import { venueAPI } from "../../../services/venueAPI";
import { roleAPI } from "../../../services/roleAPI";
import AccountWizard from "./AccountWizard";
import { useAdminTheme, C, F } from "../../../context/AdminThemeContext";



const DEFAULT_FORM = {
  name: "",
  email: "",
  username: "",
  password: "",
  role: "", // Will be set to first available role dynamically
  scope_type: "all",
  outlet_scope: [],
};

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name, A to Z" },
  { value: "name_desc", label: "Name, Z to A" },
  { value: "email_asc", label: "Email, A to Z" },
  { value: "username_asc", label: "Username, A to Z" },
];

function Spinner({ color = C.gold, size = 14 }) {
  return (
    <span
      style={{
        width:size,
        height:size,
        borderRadius:"50%",
        border:`2px solid ${color}33`,
        borderTopColor:color,
        display:"inline-block",
        animation:"accountSpin 0.75s linear infinite",
      }}
    />
  );
}

function LoadingOverlay({ label }) {
  if (!label) return null;
  return (
    <div style={{ position:"absolute",inset:0,background:"rgba(255,255,255,0.72)",backdropFilter:"blur(1px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:5 }}>
      <div style={{ display:"inline-flex",alignItems:"center",gap:10,padding:"10px 14px",border:`1px solid ${C.border}`,borderRadius:999,background:C.surface,boxShadow:"0 1px 5px rgba(24,20,14,0.035)",fontSize:12,color:C.muted,fontWeight:650 }}>
        <Spinner />
        {label}
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.20em",textTransform:"uppercase",color:C.gold,marginBottom:5 }}>
        {eyebrow}
      </div>
      <h2 style={{ margin:0,fontFamily:F.body,fontSize:22,lineHeight:1.18,color:C.text,fontWeight:760 }}>{title}</h2>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display:"grid",gap:7 }}>
      <span style={{ fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.faint }}>{label}</span>
      {children}
    </label>
  );
}

function FormSection({ title, subtitle, children, first = false }) {
  return (
    <section style={{ paddingTop:first ? 0 : 18,borderTop:first ? "none" : `1px solid ${C.divider}`,display:"grid",gap:12 }}>
      <div>
        <h3 style={{ margin:0,fontSize:13,fontWeight:760,color:C.text,lineHeight:1.3 }}>{title}</h3>
        {subtitle && <p style={{ margin:"4px 0 0",fontSize:12,lineHeight:1.45,color:C.muted }}>{subtitle}</p>}
      </div>
      <div style={{ display:"grid",gap:12 }}>{children}</div>
    </section>
  );
}

function RoleChip({ children }) {
  return (
    <span style={{ padding:"5px 8px",borderRadius:999,background:C.goldFaint,border:"1px solid rgba(140,107,42,0.14)",color:C.gold,fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}

function SummaryCard({ eyebrow, title, value, description, children, action }) {
  return (
    <div style={{ minHeight:136,background:`linear-gradient(180deg, ${C.surface} 0%, ${C.surfaceSoft} 100%)`,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px",boxShadow:C.shadowSoft,display:"flex",flexDirection:"column",justifyContent:"space-between",gap:12 }}>
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14 }}>
        <div style={{ minWidth:0 }}>
          <div style={{ fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gold,marginBottom:7 }}>{eyebrow}</div>
          <div style={{ fontSize:15,fontWeight:760,color:C.text,lineHeight:1.25 }}>{title}</div>
        </div>
        {value !== undefined && (
          <div style={{ minWidth:44,height:38,padding:"0 10px",borderRadius:10,background:C.goldFaint,color:C.gold,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:760,lineHeight:1 }}>
            {value}
          </div>
        )}
      </div>
      <div style={{ display:"grid",gap:9 }}>
        {children}
        {description && <p style={{ margin:0,fontSize:12,lineHeight:1.45,color:C.muted }}>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function FilterControl({ label, children }) {
  return (
    <label style={{ display:"grid",gap:5,minWidth:0 }}>
      <span style={{ fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.faint }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle() {
  return {
    width:"100%",
    minHeight:42,
    border:`1px solid ${C.border}`,
    borderRadius:8,
    padding:"10px 12px",
    fontFamily:F.body,
    fontSize:13,
    color:C.text,
    background:C.surface,
    outline:"none",
  };
}

function paginationButtonStyle(disabled = false) {
  return {
    minWidth:42,
    height:34,
    padding:"0 11px",
    border:`1px solid ${disabled ? "rgba(0,0,0,0.06)" : "rgba(140,107,42,0.22)"}`,
    borderRadius:8,
    background:disabled ? "rgba(0,0,0,0.025)" : C.surface,
    color:disabled ? C.faint : C.gold,
    cursor:disabled ? "not-allowed" : "pointer",
    display:"inline-flex",
    alignItems:"center",
    justifyContent:"center",
    gap:5,
    fontFamily:F.label,
    fontSize:10,
    fontWeight:800,
    letterSpacing:"0.10em",
    textTransform:"uppercase",
  };
}

const FALLBACK_LEVELS = {
  super_admin: 100,
  admin: 90,
  fb_director: 80,
  outlet_manager: 70,
  supervisor: 60,
  staff: 50,
  viewer: 10,
};

const ROLE_LABELS = {
  super_admin: "Super Admin",
  admin: "Admin",
  fb_director: "F&B Director",
  outlet_manager: "Outlet Manager",
  supervisor: "Supervisor",
  staff: "Staff",
  viewer: "Viewer",
};

function roleOptionsFor(currentUser, availableRoles) {
  if (!currentUser) return [];
  const rolesList = Array.isArray(availableRoles) && availableRoles.length > 0
    ? availableRoles
    : Object.keys(FALLBACK_LEVELS).map(slug => ({
        slug,
        name: ROLE_LABELS[slug] || slug,
        level: FALLBACK_LEVELS[slug]
      }));

  const currentRole = rolesList.find(r => r.slug === currentUser.role);
  const userLevel = currentRole ? currentRole.level : (FALLBACK_LEVELS[currentUser.role] || 0);

  if (currentUser.role === "super_admin") {
    return rolesList.map(r => r.slug);
  }
  return rolesList.filter(r => r.level < userLevel).map(r => r.slug);
}

function canManageAccount(currentUser, account, availableRoles) {
  if (!currentUser || !account || currentUser.id === account.id) return false;
  
  const rolesList = Array.isArray(availableRoles) && availableRoles.length > 0
    ? availableRoles
    : Object.keys(FALLBACK_LEVELS).map(slug => ({
        slug,
        name: ROLE_LABELS[slug] || slug,
        level: FALLBACK_LEVELS[slug]
      }));

  const currentRole = rolesList.find(r => r.slug === currentUser.role);
  const userLevel = currentRole ? currentRole.level : (FALLBACK_LEVELS[currentUser.role] || 0);
  
  const targetRole = rolesList.find(r => r.slug === account.role);
  const targetLevel = targetRole ? targetRole.level : (FALLBACK_LEVELS[account.role] || 0);
  
  return userLevel > targetLevel;
}

function roleRequiresAssignedScope(role) {
  return ["outlet_manager", "supervisor", "staff"].includes(role);
}

function defaultScopeForRole(role) {
  return roleRequiresAssignedScope(role) ? "assigned" : "all";
}

function parseScope(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (/^\d+$/.test(item) ? Number(item) : item));
}

function scopeText(scope) {
  return Array.isArray(scope) ? scope : [];
}

function buildOutletScopeTree(venues) {
  if (!venues || venues.length === 0) {
    return [
      {
        id: "main-wing",
        label: "Main Wing",
        children: [
          { id: "alabang-function-room", label: "Alabang Function Room", value: "alabang-function-room" },
          { id: "business-center", label: "Business Center", value: "business-center" },
          {
            id: "laguna-ballroom",
            label: "Laguna Ballroom",
            children: [
              { id: "laguna-ballroom-1", label: "Laguna Ballroom 1", value: "laguna-ballroom-1" },
              { id: "laguna-ballroom-2", label: "Laguna Ballroom 2", value: "laguna-ballroom-2" },
            ],
          },
          {
            id: "twenty-twenty-function-room",
            label: "20/20 Function Room",
            children: [
              { id: "twenty-twenty-a", label: "20/20 Function Room A", value: "twenty-twenty-a" },
              { id: "twenty-twenty-b", label: "20/20 Function Room B", value: "twenty-twenty-b" },
              { id: "twenty-twenty-c", label: "20/20 Function Room C", value: "twenty-twenty-c" },
            ],
          },
        ],
      },
      {
        id: "tower-wing",
        label: "Tower Wing",
        children: [
          {
            id: "tower-ballroom",
            label: "Tower Ballroom",
            children: [
              { id: "tower-1", label: "Tower 1", value: "tower-1" },
              { id: "tower-2", label: "Tower 2", value: "tower-2" },
              { id: "tower-3", label: "Tower 3", value: "tower-3" },
            ],
          },
          {
            id: "grand-ballroom",
            label: "Grand Ballroom",
            children: [
              { id: "grand-ballroom-a", label: "Grand Ballroom A", value: "grand-ballroom-a" },
              { id: "grand-ballroom-b", label: "Grand Ballroom B", value: "grand-ballroom-b" },
              { id: "grand-ballroom-c", label: "Grand Ballroom C", value: "grand-ballroom-c" },
            ],
          },
        ],
      },
      {
        id: "dining",
        label: "Dining",
        children: [
          { id: "hanakazu", label: "Hanakazu Japanese Restaurant", value: "hanakazu" },
          { id: "qsina", label: "Qsina Restaurant", value: "qsina" },
          { id: "phoenix-court", label: "Phoenix Court", value: "phoenix-court" },
        ],
      },
    ];
  }

  const parents = venues.filter((v) => !v.parent_id && v.is_active && !v.is_archived);
  const children = venues.filter((v) => v.parent_id && v.is_active && !v.is_archived);

  const wingGroups = {
    "Dining": [],
    "Main Wing": [],
    "Tower Wing": [],
  };

  parents.forEach((v) => {
    let wing = v.wing || "Main Wing";
    if (v.type === "dining") wing = "Dining";

    if (!wingGroups[wing]) {
      wingGroups[wing] = [];
    }

    const childVenues = children.filter((c) => Number(c.parent_id) === Number(v.id));

    const node = {
      id: `venue-${v.id}`,
      label: v.display_name || v.name,
    };

    if (childVenues.length > 0) {
      node.children = childVenues.map((c) => ({
        id: `venue-${c.id}`,
        label: c.display_name || c.name,
        value: String(c.id),
      }));
    } else {
      node.value = String(v.id);
    }

    wingGroups[wing].push(node);
  });

  const tree = [];

  if (wingGroups["Main Wing"] && wingGroups["Main Wing"].length > 0) {
    tree.push({
      id: "main-wing",
      label: "Main Wing",
      children: wingGroups["Main Wing"].sort((a, b) => a.label.localeCompare(b.label)),
    });
  }

  if (wingGroups["Tower Wing"] && wingGroups["Tower Wing"].length > 0) {
    tree.push({
      id: "tower-wing",
      label: "Tower Wing",
      children: wingGroups["Tower Wing"].sort((a, b) => a.label.localeCompare(b.label)),
    });
  }

  if (wingGroups["Dining"] && wingGroups["Dining"].length > 0) {
    tree.push({
      id: "dining",
      label: "Dining",
      children: wingGroups["Dining"].sort((a, b) => a.label.localeCompare(b.label)),
    });
  }

  Object.keys(wingGroups).forEach((wingName) => {
    if (["Main Wing", "Tower Wing", "Dining"].includes(wingName)) return;
    if (wingGroups[wingName].length > 0) {
      tree.push({
        id: wingName.toLowerCase().replace(/\s+/g, "-"),
        label: wingName,
        children: wingGroups[wingName].sort((a, b) => a.label.localeCompare(b.label)),
      });
    }
  });

  return tree;
}

function leafValues(node) {
  if (node.value) return [node.value];
  return (node.children || []).flatMap(leafValues);
}

function ScopeCheckbox({ checked, indeterminate, disabled, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      style={{ width:15,height:15,accentColor:C.gold,cursor:disabled ? "not-allowed" : "pointer" }}
    />
  );
}

function ScopeTreeNode({ node, selected, disabled, depth, expanded, setExpanded, onToggle }) {
  const leaves = leafValues(node);
  const selectedCount = leaves.filter((room) => selected.has(room)).length;
  const checked = selectedCount === leaves.length && leaves.length > 0;
  const indeterminate = selectedCount > 0 && selectedCount < leaves.length;
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = expanded[node.id] !== false;
  const isParent = hasChildren;

  const toggleExpand = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setExpanded((current) => ({ ...current, [node.id]: !isExpanded }));
  };

  return (
    <div>
      <label
        style={{
          display:"grid",
          gridTemplateColumns:"22px 18px minmax(0,1fr) auto",
          alignItems:"center",
          gap:8,
          minHeight:isParent ? 38 : 34,
          padding:`7px 12px 7px ${12 + depth * 18}px`,
          borderTop:depth === 0 ? `1px solid ${C.divider}` : "none",
          background:checked || indeterminate ? C.goldFaint : (isParent ? C.surfaceSoft : C.surface),
          color:C.text,
          cursor:disabled ? "not-allowed" : "pointer",
          transition:"background 160ms ease, border-color 160ms ease",
        }}
      >
        <ScopeCheckbox
          checked={checked}
          indeterminate={indeterminate}
          disabled={disabled}
          onChange={() => onToggle(leaves, checked)}
        />
        {hasChildren ? (
          <button
            type="button"
            onClick={toggleExpand}
            disabled={disabled}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${node.label}`}
            style={{ width:18,height:18,border:"none",background:"transparent",padding:0,color:C.muted,cursor:disabled ? "not-allowed" : "pointer",display:"inline-flex",alignItems:"center",justifyContent:"center" }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
          </button>
        ) : (
          <span />
        )}
        <span style={{ minWidth:0,fontSize:isParent ? 12.5 : 12,fontWeight:isParent ? 760 : 520,color:isParent ? C.text : C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
          {node.label}
        </span>
        {isParent && (
          <span style={{ padding:"3px 7px",borderRadius:999,background:C.surface,border:`1px solid ${C.border}`,fontSize:10.5,color:checked ? C.gold : C.muted,fontWeight:760 }}>
            {selectedCount}/{leaves.length}
          </span>
        )}
      </label>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <ScopeTreeNode
              key={child.id}
              node={child}
              selected={selected}
              disabled={disabled}
              depth={depth + 1}
              expanded={expanded}
              setExpanded={setExpanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScopeSelector({ value, disabled, onChange, tree = [] }) {
  const selected = new Set(Array.isArray(value) ? value : []);
  const [expanded, setExpanded] = useState({
    "main-wing": true,
    "laguna-ballroom": true,
    "twenty-twenty-function-room": true,
    "tower-wing": true,
    "tower-ballroom": true,
    "grand-ballroom": true,
    dining: true,
  });

  const toggleValues = (rooms, allSelected) => {
    if (disabled) return;
    const next = new Set(selected);
    rooms.forEach((room) => {
      if (allSelected) next.delete(room);
      else next.add(room);
    });
    onChange(Array.from(next).sort((a, b) => String(a).localeCompare(String(b))));
  };

  const selectedCount = selected.size;
  const totalCount = tree.flatMap(leafValues).length;

  return (
    <div style={{ border:`1px solid ${C.border}`,borderRadius:10,background:disabled ? C.surfaceSoft : C.surface,overflow:"hidden",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.65)" }}>
      {disabled ? (
        <div style={{ padding:12,fontSize:12,color:C.muted }}>All outlets are included for this account.</div>
      ) : (
        <div>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"10px 12px",background:C.surfaceSoft,borderBottom:`1px solid ${C.divider}` }}>
            <div>
              <div style={{ fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.gold }}>Outlet Assignment</div>
              <div style={{ marginTop:3,fontSize:11.5,color:C.muted }}>Select groups or individual rooms. Parent groups update automatically.</div>
            </div>
            <span style={{ flexShrink:0,padding:"5px 8px",borderRadius:999,background:C.surface,border:`1px solid ${C.border}`,fontSize:11,color:C.muted,fontWeight:760 }}>
              {selectedCount}/{totalCount} selected
            </span>
          </div>
          <div style={{ display:"grid",maxHeight:330,overflowY:"auto" }}>
            {tree.map((node) => (
              <ScopeTreeNode
                key={node.id}
                node={node}
                selected={selected}
                disabled={disabled}
                depth={0}
                expanded={expanded}
                setExpanded={setExpanded}
                onToggle={toggleValues}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmStatusModal({ account, loading, onCancel, onConfirm, getRoleName }) {
  if (!account) return null;
  const inactive = account.is_active === false;
  const action = inactive ? "Enable" : "Disable";
  const tone = inactive ? C.green : C.red;
  const toneBg = inactive ? C.greenFaint : C.redFaint;

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(24,20,14,0.42)",backdropFilter:"blur(2px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
      <div style={{ width:"min(440px,100%)",background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,boxShadow:"0 24px 80px rgba(0,0,0,0.22)",overflow:"hidden" }}>
        <div style={{ padding:"18px 20px",borderBottom:`1px solid ${C.divider}` }}>
          <div style={{ fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.18em",textTransform:"uppercase",color:tone,marginBottom:6 }}>
            Confirm Account Status
          </div>
          <h3 style={{ margin:0,fontSize:20,lineHeight:1.2,color:C.text }}>{action} {account.name}?</h3>
        </div>
        <div style={{ padding:20,display:"grid",gap:14 }}>
          <div style={{ padding:12,border:`1px solid ${inactive ? "rgba(46,122,90,0.18)" : "rgba(160,56,56,0.18)"}`,borderRadius:9,background:toneBg,color:C.muted,fontSize:13,lineHeight:1.55 }}>
            {inactive
              ? "This account will regain access based on its assigned role and outlet scope."
              : "This account will be marked inactive and will not be able to access the admin panel until enabled again."}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"120px 1fr",gap:8,fontSize:12 }}>
            <span style={{ fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.faint }}>Role</span>
            <strong style={{ color:C.text }}>{getRoleName(account.role)}</strong>
            <span style={{ fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.faint }}>Username</span>
            <span style={{ color:C.muted,overflow:"hidden",textOverflow:"ellipsis" }}>{account.username}</span>
          </div>
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end",paddingTop:4 }}>
            <button type="button" onClick={onCancel} disabled={loading} style={{ minWidth:110,padding:"10px 14px",border:`1px solid ${C.border}`,borderRadius:8,background:C.surface,color:C.muted,fontFamily:F.label,fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",cursor:loading?"not-allowed":"pointer" }}>
              Cancel
            </button>
            <button type="button" onClick={onConfirm} disabled={loading} style={{ minWidth:150,padding:"10px 14px",border:"none",borderRadius:8,background:tone,color:"#fff",fontFamily:F.label,fontSize:10,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",cursor:loading?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8 }}>
              {loading ? <Spinner color="#FFFFFF" size={12} /> : null}
              {action} Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Accounts() {
  const { isDark } = useAdminTheme();
  const currentUser = authAPI.getCurrentUser();
  const canManage = authAPI.hasPermission("manage_accounts");
  const [sidebarOpen,setSidebarOpen] = useState(() => window.innerWidth > 960);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 960) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [accounts,setAccounts] = useState([]);
  const [form,setForm] = useState(DEFAULT_FORM);
  const [editingId,setEditingId] = useState(null);
  const [loading,setLoading] = useState(false);
  const [loadingAccounts,setLoadingAccounts] = useState(false);
  const [actionLabel,setActionLabel] = useState("");
  const [toast,setToast] = useState(null);
  const [roleFilter,setRoleFilter] = useState("all");
  const [statusFilter,setStatusFilter] = useState("all");
  const [search,setSearch] = useState("");
  const [sortBy,setSortBy] = useState("name_asc");
  const [pageSize,setPageSize] = useState("5");
  const [page,setPage] = useState(1);
  const [statusTarget,setStatusTarget] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [permissionsList, setPermissionsList] = useState([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [initialFormSignature, setInitialFormSignature] = useState(JSON.stringify(DEFAULT_FORM));
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);

  const drawerVisible = drawerOpen || drawerClosing;

  const assignableRoles = useMemo(() => roleOptionsFor(currentUser, availableRoles), [currentUser?.role, availableRoles]);
  const newAccountForm = useMemo(() => ({
    ...DEFAULT_FORM,
    role: assignableRoles.includes("staff") ? "staff" : (assignableRoles[0] || ""),
    scope_type: defaultScopeForRole(assignableRoles.includes("staff") ? "staff" : (assignableRoles[0] || "")),
  }), [assignableRoles]);
  const visibleAccounts = useMemo(() => {
    const scopedAccounts = currentUser?.role === "super_admin"
      ? accounts
      : accounts.filter((account) => account.role !== "super_admin");

    return scopedAccounts.filter((account) => account.role !== "viewer");
  }, [accounts, currentUser?.role]);
  const roleFilterOptions = useMemo(
    () => Array.from(new Set(visibleAccounts.map((account) => account.role).filter(Boolean))).sort(),
    [visibleAccounts]
  );
  
  const getRoleName = (slug) => {
    const role = availableRoles.find(r => r.slug === slug);
    return role ? role.name : (ROLE_LABELS[slug] || slug);
  };
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
  const sortedAccounts = useMemo(() => {
    const textValue = (value) => String(value || "").toLowerCase();
    const sorted = [...filteredAccounts];

    sorted.sort((a, b) => {
      switch (sortBy) {
        case "name_desc":
          return textValue(b.name).localeCompare(textValue(a.name));
        case "email_asc":
          return textValue(a.email).localeCompare(textValue(b.email));
        case "username_asc":
          return textValue(a.username).localeCompare(textValue(b.username));
        case "name_asc":
        default:
          return textValue(a.name).localeCompare(textValue(b.name));
      }
    });

    return sorted;
  }, [filteredAccounts, sortBy]);
  const pageSizeNumber = pageSize === "all" ? Math.max(sortedAccounts.length, 1) : Number(pageSize);
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(sortedAccounts.length / pageSizeNumber));
  const currentPage = Math.min(page, totalPages);
  const pageStart = sortedAccounts.length ? (currentPage - 1) * pageSizeNumber + 1 : 0;
  const pageEnd = pageSize === "all" ? sortedAccounts.length : Math.min(sortedAccounts.length, currentPage * pageSizeNumber);
  const paginatedAccounts = pageSize === "all"
    ? sortedAccounts
    : sortedAccounts.slice((currentPage - 1) * pageSizeNumber, currentPage * pageSizeNumber);
  const activeCount = visibleAccounts.filter((account) => account.is_active !== false).length;
  const inactiveCount = visibleAccounts.length - activeCount;

  const [venues, setVenues] = useState([]);

  const outletTree = useMemo(() => buildOutletScopeTree(venues), [venues]);

  const loadAccounts = async () => {
    if (!canManage) return;
    setLoadingAccounts(true);
    try {
      const [accountsRes, venuesRes, rolesRes, permissionsRes] = await Promise.all([
        authAPI.getAccounts(),
        venueAPI.getAll({ include_archived: false, _t: Date.now() }).catch(() => []),
        roleAPI.getAll().catch(() => ({ data: [] })),
        roleAPI.getPermissions().catch(() => ({ data: [] }))
      ]);
      setAccounts(accountsRes.data || []);
      setVenues(Array.isArray(venuesRes) ? venuesRes : []);
      setAvailableRoles(Array.isArray(rolesRes) ? rolesRes : (rolesRes.data || []));
      setPermissionsList(Array.isArray(permissionsRes) ? permissionsRes : (permissionsRes.data || []));
    } catch (error) {
      setToast({ type:"error", message:error.message || "Failed to load accounts." });
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter, sortBy, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!drawerVisible || showDiscardConfirm || saveFeedback) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [drawerVisible, showDiscardConfirm, saveFeedback]);

  useEffect(() => {
    if (!showDiscardConfirm) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setShowDiscardConfirm(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showDiscardConfirm]);

  useEffect(() => {
    if (!saveFeedback) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSaveFeedback(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [saveFeedback]);

  const resetForm = () => {
    setEditingId(null);
    setForm(newAccountForm);
  };

  const beginCreate = () => {
    setDrawerClosing(false);
    setEditingId(null);
    const draft = newAccountForm;
    setForm(draft);
    setInitialFormSignature(JSON.stringify(draft));
    setHasUnsavedChanges(false);
    setDrawerOpen(true);
  };

  const beginEdit = (account) => {
    if (!canManageAccount(currentUser, account, availableRoles)) {
      setToast({ type: "error", message: "You cannot modify this account." });
      return;
    }
    setDrawerClosing(false);
    setEditingId(account.id);
    const role = assignableRoles.includes(account.role) ? account.role : (assignableRoles[0] || "staff");
    const editedForm = {
      name: account.name || "",
      email: account.email || "",
      username: account.username || "",
      password: "",
      role,
      scope_type: roleRequiresAssignedScope(role) ? "assigned" : (account.scope_type || "all"),
      outlet_scope: scopeText(account.outlet_scope),
    };
    setForm(editedForm);
    setInitialFormSignature(JSON.stringify(editedForm));
    setHasUnsavedChanges(false);
    setDrawerOpen(true);
  };

  const closeDrawer = (forceDiscard = false) => {
    if (loading && drawerOpen) return;
    if (!drawerOpen) return;
    if (hasUnsavedChanges && !forceDiscard) {
      setShowDiscardConfirm(true);
      return;
    }
    setShowDiscardConfirm(false);
    setDrawerClosing(true);
    setDrawerOpen(false);
    window.setTimeout(() => {
      setDrawerClosing(false);
      resetForm();
    }, 280);
  };

  useEffect(() => {
    if (!editingId) setForm(newAccountForm);
  }, [newAccountForm, editingId]);

  const submitAccount = async (formData) => {
    setLoading(true);
    setActionLabel(editingId ? "Updating account..." : "Creating account...");

    try {
      if (editingId) {
        await authAPI.updateAccount(editingId, formData);
        setToast({ type:"success", message:"Account updated." });
      } else {
        await authAPI.createAccount(formData);
        setToast({ type:"success", message:"Account created." });
      }
      setLoading(false);
      closeDrawer(true);
      setSaveFeedback({
        type: editingId ? "update" : "create",
        account: formData
      });
      await loadAccounts();
    } catch (error) {
      setLoading(false);
      setToast({ type:"error", message:error.message || "Failed to save account." });
    } finally {
      setActionLabel("");
    }
  };

  const requestStatusToggle = (account) => {
    if (!canManageAccount(currentUser, account, availableRoles)) {
      setToast({ type:"error", message:"You cannot modify this account." });
      return;
    }
    setStatusTarget(account);
  };

  const confirmStatusToggle = async () => {
    const account = statusTarget;
    if (!account) return;
    setLoading(true);
    setActionLabel(account.is_active === false ? "Reactivating account..." : "Disabling account...");
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
      setActionLabel("");
      setStatusTarget(null);
    }
  };

  const showEditor = canManage;
  const directoryTitle = "Accounts";
  const directoryEyebrow = "Directory";

  return (
    <div style={{ display: "flex", height: "100vh", minHeight: 0, overflow: "hidden", background: C.pageBg, fontFamily: F.body }}>
      <style>{`
        @keyframes accountSpin { to { transform: rotate(360deg); } }
        .account-row { transition: background 0.16s ease !important; }
        .account-row:hover { background: rgba(140,107,42,0.024) !important; }
        .account-btn { transition: all 0.16s ease !important; }
        .account-btn:hover { border-color: rgba(140,107,42,0.28) !important; color: ${C.gold} !important; transform: translateY(-1px); }
        .account-btn-danger { transition: all 0.16s ease !important; }
        .account-btn-danger:hover { border-color: rgba(160,56,56,0.28) !important; background: rgba(160,56,56,0.12) !important; color: ${C.red} !important; transform: translateY(-1px); }
        .account-btn-success { transition: all 0.16s ease !important; }
        .account-btn-success:hover { border-color: rgba(46,122,90,0.28) !important; background: rgba(46,122,90,0.12) !important; color: ${C.green} !important; transform: translateY(-1px); }
        .account-drawer-backdrop {
          opacity: 1;
          transition: opacity 260ms ease, backdrop-filter 260ms ease;
          will-change: opacity;
        }
        .account-drawer-backdrop:not(.is-closing) {
          animation: drawerFadeIn 220ms ease both;
        }
        .account-drawer {
          opacity: 1;
          transform: translate3d(0,0,0);
          transition: transform 300ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }
        .account-drawer-backdrop:not(.is-closing) .account-drawer {
          animation: drawerSlideIn 320ms cubic-bezier(0.22,1,0.36,1) both;
        }
        .account-drawer-backdrop.is-closing {
          opacity: 0;
          backdrop-filter: blur(0px) !important;
          pointer-events: none;
        }
        .account-drawer-backdrop.is-closing .account-drawer {
          opacity: 0;
          transform: translate3d(36px,0,0);
        }
        .account-confirm-backdrop { animation: confirmFade 180ms ease both; }
        .account-confirm { animation: confirmIn 220ms cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes drawerFadeIn { from { opacity: 0; backdrop-filter: blur(0); } to { opacity: 1; backdrop-filter: blur(2px); } }
        @keyframes drawerSlideIn { from { opacity: 0; transform: translate3d(34px,0,0); } to { opacity: 1; transform: translate3d(0,0,0); } }
        @keyframes confirmFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes confirmIn { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (max-width: 1120px) {
          .account-summary-grid { grid-template-columns: 1fr !important; }
          .account-manager-grid { grid-template-columns: 1fr !important; }
          .account-filter-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 920px) {
          .account-drawer { width: 100vw !important; }
        }
        @media (max-width: 720px) {
          .account-filter-grid { grid-template-columns: 1fr !important; }
          .account-form-two-col { grid-template-columns: 1fr !important; }
          .account-pagination { align-items: flex-start !important; flex-direction: column !important; }
          .account-pagination-controls { flex-wrap: wrap !important; }
        }
      `}</style>
      
      <Sidebar activeNav="accounts" isOpen={sidebarOpen} onToggle={()=>setSidebarOpen(!sidebarOpen)} />
      
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", flex: 1, minWidth: 0, overflow: "hidden" }}>
        <AdminNavbar />
        <main className="admin-page-content-container">
          <div style={{ display:"grid",gap:18 }}>
          <AdminPageHeader
            eyebrow="Access Control"
            title="Account Manager"
            description="Manage administrative access, role permissions, and outlet scope assignments from one controlled workspace."
            C={C}
            F={F}
            actions={canManage && (
              <button type="button" onClick={beginCreate} style={{ height:40,padding:"0 14px",border:`1px solid rgba(140,107,42,0.20)`,borderRadius:9,background:C.gold,color:"#fff",fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8,boxShadow:"0 2px 8px rgba(140,107,42,0.10)",whiteSpace:"nowrap" }}>
                <UserPlus size={14} />
                New Account
              </button>
            )}
          />

          {canManage && (
            <div className="account-summary-grid" style={{ display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14 }}>
              <SummaryCard
                eyebrow="Directory"
                title="Visible Accounts"
                value={visibleAccounts.length}
                description={`${activeCount} active and ${inactiveCount} inactive accounts are visible under your permission level.`}
              />
              <SummaryCard
                eyebrow="Permission Level"
                title="Roles You Can Manage"
                description="Available account roles are based on your current permission level."
              >
                <div style={{ display:"flex",flexWrap:"wrap",gap:7 }}>
                  {assignableRoles.length
                    ? assignableRoles.map((role) => <RoleChip key={role}>{getRoleName(role)}</RoleChip>)
                    : <span style={{ fontSize:12,color:C.muted }}>No assignable roles</span>}
                </div>
              </SummaryCard>
            </div>
          )}

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
            <div className="account-manager-grid" style={{ display:"grid",gridTemplateColumns:"minmax(0, 1fr)",gap:18,alignItems:"start" }}>
              <div id="directory" style={{ position:"relative",background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",boxShadow:C.shadow }}>
                <LoadingOverlay label={loadingAccounts ? "Loading accounts..." : ""} />
                  <div style={{ padding:"18px 20px 16px",borderBottom:`1px solid ${C.divider}`,display:"grid",gap:16,background:`linear-gradient(180deg, ${C.surface} 0%, ${C.surfaceSoft} 100%)` }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",gap:12 }}>
                      <div>
                        <span style={{ display:"block",fontFamily:F.label,fontSize:10,fontWeight:800,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gold }}>{directoryEyebrow}</span>
                        <h3 style={{ margin:"5px 0 3px",fontSize:18,lineHeight:1.25,color:C.text,fontWeight:760 }}>{directoryTitle}</h3>
                        <span style={{ display:"block",fontSize:12.5,color:C.muted }}>{sortedAccounts.length} matched from {visibleAccounts.length} visible accounts</span>
                      </div>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <span style={{ minHeight:26,padding:"6px 10px",borderRadius:999,background:C.greenFaint,color:C.green,fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.10em",textTransform:"uppercase",display:"inline-flex",alignItems:"center" }}>{activeCount} Active</span>
                        <span style={{ minHeight:26,padding:"6px 10px",borderRadius:999,background:C.redFaint,color:C.red,fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.10em",textTransform:"uppercase",display:"inline-flex",alignItems:"center" }}>{inactiveCount} Inactive</span>
                      </div>
                    </div>
                    <div className="account-filter-grid" style={{ display:"grid",gridTemplateColumns:"minmax(210px,1.4fr) repeat(3,minmax(120px,0.85fr))",gap:10,alignItems:"end" }}>
                      <FilterControl label="Search">
                        <div style={{ position:"relative" }}>
                          <Search size={14} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.faint,pointerEvents:"none" }} />
                          <input
                            value={search}
                            onChange={(e)=>setSearch(e.target.value)}
                            placeholder="Name, username, email"
                            style={{...inputStyle(),minHeight:36,padding:"7px 10px 7px 31px"}}
                          />
                        </div>
                      </FilterControl>
                      <FilterControl label="Role">
                        <select value={roleFilter} onChange={(e)=>setRoleFilter(e.target.value)} style={{...inputStyle(),minHeight:36,padding:"7px 10px"}}>
                          <option value="all">All roles</option>
                          {roleFilterOptions.map((role) => <option key={role} value={role}>{getRoleName(role)}</option>)}
                        </select>
                      </FilterControl>
                      <FilterControl label="Status">
                        <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} style={{...inputStyle(),minHeight:36,padding:"7px 10px"}}>
                          <option value="all">All status</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </FilterControl>
                      <FilterControl label="Sort">
                        <div style={{ position:"relative" }}>
                          <ArrowUpDown size={14} style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.faint,pointerEvents:"none" }} />
                          <select value={sortBy} onChange={(e)=>setSortBy(e.target.value)} style={{...inputStyle(),minHeight:36,padding:"7px 10px 7px 31px"}}>
                            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </div>
                      </FilterControl>
                    </div>
                  </div>

                  <div style={{ overflowX:"auto" }}>
                    <div style={{ display:"grid",gridTemplateColumns:"minmax(220px,1.3fr) 132px 82px 92px 148px",gap:12,alignItems:"center",padding:"10px 20px",borderBottom:`1px solid ${C.divider}`,background:C.surfaceSoft,minWidth:720 }}>
                      {["Account","Role","Scope","Status","Actions"].map((label) => (
                        <span key={label} style={{ fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.faint }}>{label}</span>
                      ))}
                    </div>
                    <div style={{ display:"grid",minWidth:720 }}>
                      {sortedAccounts.length === 0 && (
                        <div style={{ padding:"28px 18px",color:C.muted,fontSize:13,textAlign:"center" }}>
                          No accounts match the selected filters.
                        </div>
                      )}
                      {paginatedAccounts.map((account) => {
                        const manageable = canManageAccount(currentUser, account, availableRoles);
                        const inactive = account.is_active === false;

                        return (
                        <div key={account.id} className="account-row" style={{ display:"grid",gridTemplateColumns:"minmax(220px,1.3fr) 132px 82px 92px 148px",gap:12,alignItems:"center",padding:"14px 20px",borderBottom:`1px solid ${C.divider}`,background:inactive ? C.surfaceSoft : "transparent",textAlign:"left",opacity:inactive ? 0.72 : 1 }}>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:13,fontWeight:700,color:C.text,marginBottom:3 }}>{account.name}</div>
                            <div style={{ fontSize:11.5,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{account.username}</div>
                            <div style={{ fontSize:11.5,color:C.faint,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{account.email}</div>
                          </div>
                          <span style={{ justifySelf:"start",padding:"4px 8px",borderRadius:999,background:C.goldFaint,color:C.gold,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap" }}>{getRoleName(account.role)}</span>
                          <span style={{ fontSize:11.5,color:C.muted }}>{account.scope_type === "assigned" ? `${Array.isArray(account.outlet_scope) ? account.outlet_scope.length : 0} outlets` : "All"}</span>
                          <span style={{ justifySelf:"start",padding:"4px 8px",borderRadius:999,background:inactive ? C.redFaint : C.greenFaint,color:inactive ? C.red : C.green,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em" }}>{inactive ? "Inactive" : "Active"}</span>
                          <div style={{ display:"flex",alignItems:"center",gap:7,justifyContent:"flex-start" }}>
                            <button type="button" className="account-btn" title={manageable ? "Edit account" : "Not allowed for your role"} disabled={!manageable || loading} onClick={()=>beginEdit(account)} style={{ padding:"7px 9px",border:`1px solid ${C.border}`,borderRadius:7,background:C.surface,color:manageable?C.text:C.faint,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",cursor:manageable&&!loading?"pointer":"not-allowed" }}>Edit</button>
                            <button type="button" className={inactive ? "account-btn-success" : "account-btn-danger"} title={manageable ? (inactive ? "Enable account" : "Disable account") : "Not allowed for your role"} disabled={!manageable || loading} onClick={()=>requestStatusToggle(account)} style={{ padding:"7px 9px",border:`1px solid ${inactive ? "rgba(46,122,90,0.20)" : "rgba(160,56,56,0.20)"}`,borderRadius:7,background:inactive?C.greenFaint:C.redFaint,color:inactive?C.green:C.red,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",cursor:manageable&&!loading?"pointer":"not-allowed",display:"inline-flex",alignItems:"center",gap:6 }}>
                              {loading && actionLabel && !drawerVisible ? <Spinner color={inactive ? C.green : C.red} size={11} /> : null}
                              {inactive ? "Enable" : "Disable"}
                            </button>
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                  {sortedAccounts.length > 0 && (
                    <div className="account-pagination" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"14px 20px",borderTop:`1px solid ${C.divider}`,background:C.surfaceSoft }}>
                      <span style={{ fontSize:12,color:C.muted }}>
                        Showing {pageStart}-{pageEnd} of {sortedAccounts.length}
                      </span>
                      <div className="account-pagination-controls" style={{ display:"flex",alignItems:"center",gap:10 }}>
                        <label style={{ display:"inline-flex",alignItems:"center",gap:7,fontSize:12,color:C.muted }}>
                          Rows
                          <select value={pageSize} onChange={(e)=>setPageSize(e.target.value)} style={{...inputStyle(),width:96,minHeight:32,padding:"5px 8px",fontSize:12}}>
                            <option value="5">5</option>
                            <option value="10">10</option>
                            <option value="all">All</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          disabled={currentPage <= 1 || pageSize === "all"}
                          onClick={()=>setPage((value)=>Math.max(1, value - 1))}
                          style={paginationButtonStyle(currentPage <= 1 || pageSize === "all")}
                          title="Previous page"
                        >
                          <ChevronLeft size={15} />
                          Prev
                        </button>
                        <span style={{ minWidth:82,textAlign:"center",fontSize:12,color:C.muted }}>
                          Page {currentPage} of {totalPages}
                        </span>
                        <button
                          type="button"
                          disabled={currentPage >= totalPages || pageSize === "all"}
                          onClick={()=>setPage((value)=>Math.min(totalPages, value + 1))}
                          style={paginationButtonStyle(currentPage >= totalPages || pageSize === "all")}
                          title="Next page"
                        >
                          Next
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
            </div>
          )}
          </div>
          <ConfirmStatusModal
            account={statusTarget}
            loading={loading}
            onCancel={()=>setStatusTarget(null)}
            onConfirm={confirmStatusToggle}
            getRoleName={getRoleName}
          />

          <AccountWizard
            isOpen={drawerVisible}
            isClosing={drawerClosing}
            onClose={() => closeDrawer()}
            editingAccount={editingId ? accounts.find(a => a.id === editingId) : null}
            initialForm={form}
            availableRoles={availableRoles}
            assignableRoles={assignableRoles}
            outletTree={outletTree}
            permissionsList={permissionsList}
            onSave={submitAccount}
            loading={loading}
            setHasUnsavedChanges={setHasUnsavedChanges}
          />

          {showDiscardConfirm && (
            <div className="account-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDiscardConfirm(false); }} style={{ position: "fixed", inset: 0, zIndex: 8200, display: "grid", placeItems: "center", padding: 18, background: "rgba(24,20,14,0.34)", backdropFilter: "blur(3px)" }}>
              <section className="account-confirm" role="dialog" aria-modal="true" aria-labelledby="discard-changes-title" style={{ width: "min(420px, 100%)", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 26px 70px rgba(24,20,14,0.24)", padding: 20 }}>
                <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                  <span style={{ width: 38, height: 38, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: C.redFaint, color: C.red }}>
                    <AlertTriangle size={18} />
                  </span>
                  <div>
                    <h2 id="discard-changes-title" style={{ margin: 0, fontSize: 18, lineHeight: 1.25, color: C.text, fontWeight: 650 }}>Discard unsaved changes?</h2>
                    <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: C.muted }}>You have unsaved account configuration changes. Leaving now will discard them.</p>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }}>
                  <button type="button" onClick={() => setShowDiscardConfirm(false)} style={{ ...paginationButtonStyle(false), minWidth: 120 }}>Keep Editing</button>
                  <button type="button" onClick={() => closeDrawer(true)} style={{ padding: "0 16px", height: 34, border: "none", borderRadius: 8, background: C.gold, color: "#fff", fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 140 }}>
                    Discard Changes
                  </button>
                </div>
              </section>
            </div>
          )}

          {saveFeedback && (
            <div className="account-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSaveFeedback(null); }} style={{ position: "fixed", inset: 0, zIndex: 8200, display: "grid", placeItems: "center", padding: 18, background: "rgba(24,20,14,0.34)", backdropFilter: "blur(3px)" }}>
              <section className="account-confirm" role="dialog" aria-modal="true" aria-labelledby="save-feedback-title" style={{ width: "min(460px, 100%)", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 26px 70px rgba(24,20,14,0.24)", padding: "32px 32px 28px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 24 }}>
                  <span style={{ 
                    width: 60, 
                    height: 60, 
                    borderRadius: "50%", 
                    display: "inline-flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    background: C.greenFaint, 
                    color: C.green, 
                    border: `1px solid ${C.greenBorder}`, 
                    boxShadow: "0 4px 12px rgba(46,122,90,0.08)",
                    marginBottom: 16
                  }}>
                    <Check size={28} strokeWidth={2.5} />
                  </span>
                  <h2 id="save-feedback-title" style={{ margin: 0, fontSize: 20, lineHeight: 1.25, color: C.text, fontWeight: 760 }}>
                    {saveFeedback.type === "create" ? "Account Created" : "Account Updated"}
                  </h2>
                  <p style={{ margin: "8px 0 0", fontSize: 13.5, color: C.muted, maxWidth: 360, lineHeight: 1.5 }}>
                    The user account has been configured and saved successfully.
                  </p>
                </div>
                
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, background: C.surfaceSoft, padding: "20px 24px", display: "grid", gap: 14, marginBottom: 26, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)" }}>
                  <div>
                    <span style={{ display: "block", fontSize: 9, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.12em" }}>Full Name</span>
                    <div style={{ fontSize: 14.5, fontWeight: 650, color: C.text, marginTop: 4 }}>{saveFeedback.account.name}</div>
                  </div>
                  
                  <div style={{ height: 1, background: C.divider }} />
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <span style={{ display: "block", fontSize: 9, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.12em" }}>Assigned Role</span>
                      <div style={{ fontSize: 13.5, fontWeight: 750, color: C.gold, marginTop: 4 }}>
                        {getRoleName(saveFeedback.account.role)}
                      </div>
                    </div>
                    <div>
                      <span style={{ display: "block", fontSize: 9, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.12em" }}>Access Scope</span>
                      <div style={{ fontSize: 13.5, color: C.text, fontWeight: 650, marginTop: 4 }}>
                        {saveFeedback.account.scope_type === "all" 
                          ? "All Outlets" 
                          : `${saveFeedback.account.outlet_scope?.length || 0} venues`}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ height: 1, background: C.divider }} />
                  
                  <div>
                    <span style={{ display: "block", fontSize: 9, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.12em" }}>Username</span>
                    <div style={{ fontSize: 13.5, fontWeight: 550, color: C.text, marginTop: 4, wordBreak: "break-all" }}>
                      @{saveFeedback.account.username}
                    </div>
                  </div>
                  
                  <div style={{ height: 1, background: C.divider }} />
                  
                  <div>
                    <span style={{ display: "block", fontSize: 9, fontWeight: 800, color: C.faint, textTransform: "uppercase", letterSpacing: "0.12em" }}>Email Address</span>
                    <div style={{ fontSize: 13.5, color: C.muted, marginTop: 4, wordBreak: "break-all" }}>
                      {saveFeedback.account.email}
                    </div>
                  </div>
                </div>
                
                <button 
                  type="button" 
                  onClick={() => setSaveFeedback(null)} 
                  style={{ 
                    width: "100%", 
                    height: 44, 
                    border: "none", 
                    borderRadius: 10, 
                    background: C.gold, 
                    color: "#fff", 
                    fontFamily: F.label, 
                    fontSize: 11, 
                    fontWeight: 750, 
                    letterSpacing: "0.12em", 
                    textTransform: "uppercase", 
                    cursor: "pointer",
                    display: "inline-flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    boxShadow: `0 4px 12px rgba(140,107,42,0.15)`,
                    transition: "all 0.16s ease"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = C.goldLight;
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = `0 6px 16px rgba(140,107,42,0.22)`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = C.gold;
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = `0 4px 12px rgba(140,107,42,0.15)`;
                  }}
                >
                  Back to Accounts
                </button>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
