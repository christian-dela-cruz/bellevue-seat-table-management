import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Search, UserPlus } from "lucide-react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
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
  shadow: "0 2px 8px rgba(44,36,24,0.035)",
  shadowSoft: "0 1px 5px rgba(44,36,24,0.025)",
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
  supervisor: "Supervisor",
  venue_manager: "Venue Manager",
  staff: "Staff",
};

const DEFAULT_FORM = {
  name: "",
  email: "",
  username: "",
  password: "",
  role: "staff",
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

function roleOptionsFor(currentRole) {
  const roles = ["super_admin", "admin", "fb_director", "outlet_manager", "supervisor", "staff"];
  if (currentRole === "super_admin") return roles;
  if (currentRole === "admin") return ["fb_director", "outlet_manager", "supervisor", "staff"];
  return [];
}

function canManageAccount(currentUser, account) {
  if (!currentUser || !account || currentUser.id === account.id) return false;
  if (currentUser.role === "super_admin") return account.role !== "super_admin";
  if (currentUser.role === "admin") return !["super_admin", "admin"].includes(account.role);
  return false;
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

const OUTLET_SCOPE_TREE = [
  {
    id: "main-wing",
    label: "Main Wing",
    children: [
      { id: "alabang-function-room", label: "Alabang Function Room", value: "Alabang Function Room" },
      { id: "business-center", label: "Business Center", value: "Business Center" },
      {
        id: "laguna-ballroom",
        label: "Laguna Ballroom",
        children: [
          { id: "laguna-ballroom-1", label: "Laguna Ballroom 1", value: "Laguna Ballroom 1" },
          { id: "laguna-ballroom-2", label: "Laguna Ballroom 2", value: "Laguna Ballroom 2" },
        ],
      },
      {
        id: "twenty-twenty-function-room",
        label: "20/20 Function Room",
        children: [
          { id: "twenty-twenty-a", label: "20/20 Function Room A", value: "20/20 Function Room A" },
          { id: "twenty-twenty-b", label: "20/20 Function Room B", value: "20/20 Function Room B" },
          { id: "twenty-twenty-c", label: "20/20 Function Room C", value: "20/20 Function Room C" },
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
          { id: "tower-1", label: "Tower 1", value: "Tower 1" },
          { id: "tower-2", label: "Tower 2", value: "Tower 2" },
          { id: "tower-3", label: "Tower 3", value: "Tower 3" },
        ],
      },
      {
        id: "grand-ballroom",
        label: "Grand Ballroom",
        children: [
          { id: "grand-ballroom-a", label: "Grand Ballroom A", value: "Grand Ballroom A" },
          { id: "grand-ballroom-b", label: "Grand Ballroom B", value: "Grand Ballroom B" },
          { id: "grand-ballroom-c", label: "Grand Ballroom C", value: "Grand Ballroom C" },
        ],
      },
    ],
  },
  {
    id: "dining",
    label: "Dining",
    children: [
      { id: "hanakazu", label: "Hanakazu Japanese Restaurant", value: "Hanakazu Japanese Restaurant" },
      { id: "qsina", label: "Qsina Restaurant", value: "Qsina Restaurant" },
      { id: "phoenix-court", label: "Phoenix Court", value: "Phoenix Court" },
    ],
  },
];

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

function ScopeSelector({ value, disabled, onChange }) {
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
  const totalCount = OUTLET_SCOPE_TREE.flatMap(leafValues).length;

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
            {OUTLET_SCOPE_TREE.map((node) => (
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

function ConfirmStatusModal({ account, loading, onCancel, onConfirm }) {
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
            <strong style={{ color:C.text }}>{ROLE_LABELS[account.role] || account.role}</strong>
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
  const currentUser = authAPI.getCurrentUser();
  const canManage = authAPI.hasPermission("manage_accounts");
  const [sidebarOpen,setSidebarOpen] = useState(true);
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

  const assignableRoles = useMemo(() => roleOptionsFor(currentUser?.role), [currentUser?.role]);
  const newAccountForm = useMemo(() => ({
    ...DEFAULT_FORM,
    role: assignableRoles.includes("staff") ? "staff" : (assignableRoles[0] || "staff"),
    scope_type: defaultScopeForRole(assignableRoles.includes("staff") ? "staff" : (assignableRoles[0] || "staff")),
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

  const loadAccounts = async () => {
    if (!canManage) return;
    setLoadingAccounts(true);
    try {
      const response = await authAPI.getAccounts();
      setAccounts(response.data || []);
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

  const resetForm = () => {
    setEditingId(null);
    setForm(newAccountForm);
  };

  useEffect(() => {
    if (!editingId) setForm(newAccountForm);
  }, [newAccountForm, editingId]);

  const submitAccount = async (event) => {
    event.preventDefault();
    if (form.scope_type === "assigned" && parseScope(form.outlet_scope).length === 0) {
      setToast({ type:"error", message:"Select at least one outlet for assigned-scope accounts." });
      return;
    }
    setLoading(true);
    setActionLabel(editingId ? "Updating account..." : "Creating account...");

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
      setActionLabel("");
    }
  };

  const editAccount = (account) => {
    if (!canManageAccount(currentUser, account)) {
      setToast({ type:"error", message:"You cannot modify this account." });
      return;
    }

    setEditingId(account.id);
    const role = assignableRoles.includes(account.role) ? account.role : (assignableRoles[0] || "staff");
    setForm({
      name: account.name || "",
      email: account.email || "",
      username: account.username || "",
      password: "",
      role,
      scope_type: roleRequiresAssignedScope(role) ? "assigned" : (account.scope_type || "all"),
      outlet_scope: scopeText(account.outlet_scope),
    });
  };

  const requestStatusToggle = (account) => {
    if (!canManageAccount(currentUser, account)) {
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
    <div style={{ minHeight:"100vh",background:C.pageBg,fontFamily:F.body }}>
      <style>{`
        @keyframes accountSpin { to { transform: rotate(360deg); } }
        @media (max-width: 1120px) {
          .account-summary-grid { grid-template-columns: 1fr !important; }
          .account-manager-grid { grid-template-columns: 1fr !important; }
          .account-filter-grid { grid-template-columns: 1fr 1fr !important; }
          .account-editor-card { position: relative !important; top: auto !important; }
        }
        @media (max-width: 720px) {
          .account-filter-grid { grid-template-columns: 1fr !important; }
          .account-form-two-col { grid-template-columns: 1fr !important; }
          .account-pagination { align-items: flex-start !important; flex-direction: column !important; }
          .account-pagination-controls { flex-wrap: wrap !important; }
        }
      `}</style>
      <AdminNavbar />
      <div style={{ display:"flex", height:"calc(100vh - 60px)", minHeight:0, overflow:"hidden" }}>
        <Sidebar activeNav="accounts" isOpen={sidebarOpen} onToggle={()=>setSidebarOpen(!sidebarOpen)} />
        <main style={{ flex:1,padding:"30px 32px 42px",overflow:"auto",height:"calc(100vh - 60px)" }}>
          <div style={{ maxWidth:1440,display:"grid",gap:18 }}>
          <AdminPageHeader
            eyebrow="Access Control"
            title="Account Manager"
            description="Manage administrative access, role permissions, and outlet scope assignments from one controlled workspace."
            C={C}
            F={F}
            actions={canManage && (
              <button type="button" onClick={resetForm} style={{ height:40,padding:"0 14px",border:`1px solid rgba(140,107,42,0.20)`,borderRadius:9,background:C.gold,color:"#fff",fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8,boxShadow:"0 2px 8px rgba(140,107,42,0.10)",whiteSpace:"nowrap" }}>
                <UserPlus size={14} />
                New Account
              </button>
            )}
          />

          {canManage && (
            <div className="account-summary-grid" style={{ display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14 }}>
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
                    ? assignableRoles.map((role) => <RoleChip key={role}>{ROLE_LABELS[role]}</RoleChip>)
                    : <span style={{ fontSize:12,color:C.muted }}>No assignable roles</span>}
                </div>
              </SummaryCard>
              <SummaryCard
                eyebrow="Workspace"
                title="Current Action"
                description={editingId ? "Review changes carefully before updating the selected account." : "Ready to create a new operational account."}
                action={
                  <button type="button" onClick={resetForm} style={{ alignSelf:"flex-start",height:32,padding:"0 10px",border:`1px solid rgba(140,107,42,0.18)`,borderRadius:8,background:C.goldFaint,color:C.gold,fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.10em",textTransform:"uppercase",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6 }}>
                    <UserPlus size={13} />
                    Start New
                  </button>
                }
              />
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
            <div className="account-manager-grid" style={{ display:"grid",gridTemplateColumns:showEditor ? "minmax(0, 1.42fr) minmax(390px, 0.78fr)" : "minmax(0, 1fr)",gap:18,alignItems:"start" }}>
              {showEditor && (
                <div id="create" className="account-editor-card" style={{ position:"sticky",top:18,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:20,overflow:"hidden",order:2,boxShadow:C.shadow }}>
                  <LoadingOverlay label={actionLabel && showEditor ? actionLabel : ""} />
                  <SectionTitle eyebrow={editingId ? "Edit Account" : "New Account"} title={editingId ? "Update Account" : "Create Account"} />
                  <p style={{ margin:"-10px 0 18px",fontSize:12.5,lineHeight:1.55,color:C.muted }}>
                    Create operational accounts with a role first, then limit outlet access only when the role requires an assigned scope.
                  </p>
                  <form onSubmit={submitAccount} style={{ display:"grid",gap:18 }}>
                    <FormSection title="Account Information" subtitle="Use a clear staff name and a unique login identity." first>
                      <div className="account-form-two-col" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                        <Field label="Name">
                          <input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required style={inputStyle()} />
                        </Field>
                        <Field label="Email">
                          <input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} required style={inputStyle()} />
                        </Field>
                      </div>
                      <Field label="Username">
                        <input value={form.username} onChange={(e)=>setForm({...form,username:e.target.value})} required style={inputStyle()} />
                      </Field>
                      <Field label={editingId ? "New Password" : "Password"}>
                        <input type="password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} required={!editingId} minLength={8} placeholder={editingId ? "Leave blank to keep current" : ""} style={inputStyle()} />
                        <span style={{ fontSize:11.5,color:C.muted }}>{editingId ? "Leave blank if the password should not change." : "Use at least 8 characters."}</span>
                      </Field>
                    </FormSection>

                    <FormSection title="Role & Permissions" subtitle="Role selection controls account capabilities and visible admin modules.">
                      <Field label="Role">
                        <select value={form.role} onChange={(e)=>{
                          const role = e.target.value;
                          setForm({...form,role,scope_type:defaultScopeForRole(role),outlet_scope:defaultScopeForRole(role)==="all"?[]:form.outlet_scope});
                        }} style={inputStyle()}>
                          {assignableRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                        </select>
                      </Field>
                      <Field label="Scope">
                        <select value={form.scope_type} disabled={roleRequiresAssignedScope(form.role)} onChange={(e)=>setForm({...form,scope_type:e.target.value,outlet_scope:e.target.value==="all"?[]:form.outlet_scope})} style={{...inputStyle(),background:roleRequiresAssignedScope(form.role)?C.surfaceSoft:C.surface}}>
                          <option value="all">All outlets</option>
                          <option value="assigned">Assigned outlets</option>
                        </select>
                        <span style={{ fontSize:11.5,color:C.muted }}>
                          Outlet Manager and Staff accounts must be assigned to specific outlets.
                        </span>
                      </Field>
                    </FormSection>

                    <FormSection title="Outlet Scope" subtitle="Choose the specific outlets this account can work with when assigned scope is required.">
                      <Field label="Assigned Outlet(s)">
                        <ScopeSelector
                          value={form.outlet_scope}
                          disabled={form.scope_type==="all"}
                          onChange={(outlet_scope)=>setForm({...form,outlet_scope})}
                        />
                      </Field>
                    </FormSection>

                    <div style={{ display:"flex",gap:9,justifyContent:"flex-end",paddingTop:2 }}>
                      {editingId && <button type="button" onClick={resetForm} style={{ padding:"10px 14px",border:`1px solid ${C.border}`,borderRadius:8,background:"transparent",color:C.muted,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer" }}>Cancel</button>}
                      <button disabled={loading} style={{ padding:"10px 16px",border:"none",borderRadius:8,background:C.green,color:"#fff",fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:loading?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                        {loading && showEditor ? <Spinner color="#FFFFFF" size={12} /> : null}
                        {loading ? "Saving..." : editingId ? "Update Account" : "Create Account"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

                <div id="directory" style={{ position:"relative",background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",order:1,boxShadow:C.shadow }}>
                  <LoadingOverlay label={loadingAccounts ? "Loading accounts..." : (!showEditor ? actionLabel : "")} />
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
                          {roleFilterOptions.map((role) => <option key={role} value={role}>{ROLE_LABELS[role] || role}</option>)}
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
                        const manageable = canManageAccount(currentUser, account);
                        const inactive = account.is_active === false;

                        return (
                        <div key={account.id} style={{ display:"grid",gridTemplateColumns:"minmax(220px,1.3fr) 132px 82px 92px 148px",gap:12,alignItems:"center",padding:"14px 20px",borderBottom:`1px solid ${C.divider}`,background:inactive ? C.surfaceSoft : "transparent",textAlign:"left",opacity:inactive ? 0.72 : 1,transition:"background 0.15s" }}>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:13,fontWeight:700,color:C.text,marginBottom:3 }}>{account.name}</div>
                            <div style={{ fontSize:11.5,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{account.username}</div>
                            <div style={{ fontSize:11.5,color:C.faint,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{account.email}</div>
                          </div>
                          <span style={{ justifySelf:"start",padding:"4px 8px",borderRadius:999,background:C.goldFaint,color:C.gold,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap" }}>{ROLE_LABELS[account.role] || account.role}</span>
                          <span style={{ fontSize:11.5,color:C.muted }}>{account.scope_type === "assigned" ? `${Array.isArray(account.outlet_scope) ? account.outlet_scope.length : 0} outlets` : "All"}</span>
                          <span style={{ justifySelf:"start",padding:"4px 8px",borderRadius:999,background:inactive ? C.redFaint : C.greenFaint,color:inactive ? C.red : C.green,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em" }}>{inactive ? "Inactive" : "Active"}</span>
                          <div style={{ display:"flex",alignItems:"center",gap:7,justifyContent:"flex-end" }}>
                            <button type="button" title={manageable ? "Edit account" : "Not allowed for your role"} disabled={!manageable || loading} onClick={()=>editAccount(account)} style={{ padding:"7px 9px",border:`1px solid ${C.border}`,borderRadius:7,background:C.surface,color:manageable?C.text:C.faint,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",cursor:manageable&&!loading?"pointer":"not-allowed" }}>Edit</button>
                            <button type="button" title={manageable ? (inactive ? "Enable account" : "Disable account") : "Not allowed for your role"} disabled={!manageable || loading} onClick={()=>requestStatusToggle(account)} style={{ padding:"7px 9px",border:`1px solid ${inactive ? "rgba(46,122,90,0.20)" : "rgba(160,56,56,0.20)"}`,borderRadius:7,background:inactive?C.greenFaint:C.redFaint,color:inactive?C.green:C.red,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",cursor:manageable&&!loading?"pointer":"not-allowed",display:"inline-flex",alignItems:"center",gap:6 }}>
                              {loading && actionLabel && !showEditor ? <Spinner color={inactive ? C.green : C.red} size={11} /> : null}
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
          />
        </main>
      </div>
    </div>
  );
}
