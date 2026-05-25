import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  Layers,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Upload,
  X,
} from "lucide-react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import Sidebar from "../../../components/layout/Sidebar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import { authAPI } from "../../../services/authAPI";
import { venueAPI } from "../../../services/venueAPI";

const C = {
  page: "#F7F4EE",
  surface: "#FFFFFF",
  soft: "#FAF8F4",
  border: "rgba(0,0,0,0.08)",
  divider: "rgba(0,0,0,0.055)",
  gold: "#8C6B2A",
  goldFaint: "rgba(140,107,42,0.075)",
  green: "#2E7A5A",
  greenFaint: "rgba(46,122,90,0.075)",
  red: "#A03838",
  redFaint: "rgba(160,56,56,0.075)",
  text: "#18140E",
  muted: "#746B5E",
  faint: "rgba(24,20,14,0.42)",
};

const F = {
  body: "'Inter','Helvetica Neue',Arial,sans-serif",
  label: "'Inter','Helvetica Neue',Arial,sans-serif",
};

const emptyForm = {
  parent_id: "",
  name: "",
  display_name: "",
  slug: "",
  wing: "Main Wing",
  type: "function_room",
  category: "function_room",
  capacity: 0,
  description: "",
  image: "",
  display_order: 0,
  is_active: true,
  is_visible: true,
  show_on_landing: true,
  reservations_enabled: true,
  parent_selectable: true,
  child_selectable: true,
  reservation_route: "",
  image_position: "center 50%",
  metadata: {},
  availability_enabled: true,
  availability_start_time: "08:00",
  availability_end_time: "23:00",
  availability_interval_minutes: 60,
  availability_max_reservations: 0,
  availability_slot_capacity: 0,
  availability_blocked_dates: "",
  availability_blocked_times: "",
  availability_periods: [],
  availability_overrides: [],
};

function normalizeRoom(room = {}) {
  const availability = room.metadata?.availability || {};
  const capacity = room.capacity ?? 0;
  return {
    ...emptyForm,
    ...room,
    parent_id: room.parent_id ? String(room.parent_id) : "",
    capacity,
    display_order: room.display_order ?? 0,
    display_name: room.display_name || room.name || "",
    slug: room.slug || "",
    image: room.image || "",
    reservation_route: room.reservation_route || "",
    image_position: room.image_position || "center 50%",
    metadata: room.metadata || {},
    availability_enabled: availability.enabled ?? true,
    availability_start_time: availability.start_time || (room.type === "dining" ? "11:00" : "08:00"),
    availability_end_time: availability.end_time || (room.type === "dining" ? "22:00" : "23:00"),
    availability_interval_minutes: availability.interval_minutes ?? (room.type === "dining" ? 30 : 60),
    availability_max_reservations: availability.max_reservations_per_slot ?? 0,
    availability_slot_capacity: availability.slot_capacity ?? capacity,
    availability_blocked_dates: Array.isArray(availability.blocked_dates) ? availability.blocked_dates.join(", ") : "",
    availability_blocked_times: blockedTimesToText(availability.blocked_times),
    availability_periods: normalizeSchedulePeriods(availability.periods, room),
    availability_overrides: normalizeScheduleOverrides(availability.overrides),
  };
}

const DAY_OPTIONS = [
  ["0", "Sun"],
  ["1", "Mon"],
  ["2", "Tue"],
  ["3", "Wed"],
  ["4", "Thu"],
  ["5", "Fri"],
  ["6", "Sat"],
];

function normalizedName(value) {
  return canonical(value).replace(/\s+/g, " ");
}

function makePeriod(data = {}) {
  return {
    id: data.id || `period-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label: data.label || "Reservation",
    service_type: data.service_type || data.service || "Reservation",
    days: Array.isArray(data.days) ? data.days.map(Number) : [0, 1, 2, 3, 4, 5, 6],
    start_time: String(data.start_time || "08:00").substring(0, 5),
    end_time: String(data.end_time || "23:00").substring(0, 5),
    interval_minutes: Number(data.interval_minutes || 30),
    max_reservations_per_slot: Number(data.max_reservations_per_slot || 0),
    slot_capacity: Number(data.slot_capacity || 0),
    min_guests: Number(data.min_guests || 0),
    max_guests: Number(data.max_guests || 0),
    enabled: data.enabled ?? true,
  };
}

function defaultSchedulePeriods(room = {}) {
  const capacity = Number(room.capacity || 0);
  const name = normalizedName(room.display_name || room.name);
  if (name.includes("hanakazu")) {
    return [
      makePeriod({ label: "Lunch", service_type: "À la carte", days: [2, 3, 4, 5, 6, 0], start_time: "11:30", end_time: "14:30", interval_minutes: 30, slot_capacity: capacity || 81 }),
      makePeriod({ label: "Dinner", service_type: "À la carte", days: [2, 3, 4, 5, 6, 0], start_time: "17:30", end_time: "22:00", interval_minutes: 30, slot_capacity: capacity || 81 }),
    ];
  }
  if (name.includes("qsina")) {
    return [
      makePeriod({ label: "Breakfast", service_type: "Breakfast buffet", days: [0, 1, 2, 3, 4, 5, 6], start_time: "06:00", end_time: "10:00", interval_minutes: 30, slot_capacity: capacity || 80 }),
      makePeriod({ label: "Lunch", service_type: "À la carte", days: [1, 2, 6, 0], start_time: "11:30", end_time: "14:30", interval_minutes: 30, slot_capacity: capacity || 80 }),
      makePeriod({ label: "Lunch", service_type: "Light lunch buffet", days: [3, 4, 5], start_time: "11:30", end_time: "14:30", interval_minutes: 30, slot_capacity: capacity || 80 }),
      makePeriod({ label: "Dinner", service_type: "À la carte", days: [1, 2, 3, 4], start_time: "18:00", end_time: "22:00", interval_minutes: 30, slot_capacity: capacity || 80 }),
      makePeriod({ label: "Dinner", service_type: "Dinner buffet", days: [5, 6, 0], start_time: "18:00", end_time: "22:00", interval_minutes: 30, slot_capacity: capacity || 80 }),
    ];
  }
  if (name.includes("phoenix")) {
    return [
      makePeriod({ label: "Lunch", service_type: "Chinese fine dining", days: [0, 1, 2, 3, 4, 5, 6], start_time: "11:00", end_time: "14:30", interval_minutes: 30, slot_capacity: capacity || 250 }),
      makePeriod({ label: "Dinner", service_type: "Chinese fine dining", days: [0, 1, 2, 3, 4, 5, 6], start_time: "18:00", end_time: "22:00", interval_minutes: 30, slot_capacity: capacity || 250 }),
    ];
  }
  return [
    makePeriod({
      label: room.type === "dining" ? "Dining Service" : "Event Window",
      service_type: room.type === "dining" ? "Reservation" : "Function reservation",
      days: [0, 1, 2, 3, 4, 5, 6],
      start_time: room.type === "dining" ? "11:00" : "08:00",
      end_time: room.type === "dining" ? "22:00" : "23:00",
      interval_minutes: room.type === "dining" ? 30 : 60,
      slot_capacity: capacity,
    }),
  ];
}

function normalizeSchedulePeriods(periods, room = {}) {
  const source = Array.isArray(periods) && periods.length ? periods : defaultSchedulePeriods(room);
  return source.map(makePeriod);
}

function makeOverride(data = {}) {
  return {
    id: data.id || `override-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: data.date || "",
    type: data.type || "closed",
    label: data.label || "Manual override",
    start_time: data.start_time || "",
    end_time: data.end_time || "",
    interval_minutes: Number(data.interval_minutes || 30),
    blocked_times_text: Array.isArray(data.blocked_times) ? data.blocked_times.join(", ") : (data.blocked_times_text || ""),
    slot_capacity: Number(data.slot_capacity || 0),
    max_reservations_per_slot: Number(data.max_reservations_per_slot || 0),
    note: data.note || "",
    enabled: data.enabled ?? true,
  };
}

function normalizeScheduleOverrides(overrides) {
  return Array.isArray(overrides) ? overrides.map(makeOverride) : [];
}

function blockedTimesToText(blockedTimes) {
  if (!blockedTimes || typeof blockedTimes !== "object") return "";
  return Object.entries(blockedTimes)
    .map(([date, times]) => `${date}: ${(Array.isArray(times) ? times : []).join(", ")}`)
    .join("\n");
}

function parseBlockedTimes(text) {
  return String(text || "")
    .split(/\n+/)
    .reduce((acc, line) => {
      const [date, values] = line.split(":");
      if (!date?.trim() || !values?.trim()) return acc;
      acc[date.trim()] = values.split(",").map((item) => item.trim().substring(0, 5)).filter(Boolean);
      return acc;
    }, {});
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function imageUrl(image) {
  if (!image) return "";
  if (/^(https?:|data:|blob:)/i.test(image)) return image;
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");
  if (image.startsWith("/")) return `${apiRoot}${image}`;
  if (image.includes("/")) return `${apiRoot}/${image.replace(/^\/+/, "")}`;
  return `${apiRoot}/images/${image}`;
}

function canonical(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9/ ]/g, "")
    .trim();
}

const canonicalParentNames = [
  "alabang function room",
  "laguna ballroom",
  "20/20 function room",
  "grand ballroom",
  "tower ballroom",
  "business center",
];

const childParentNameMap = {
  "laguna ballroom 1": "laguna ballroom",
  "laguna ballroom 2": "laguna ballroom",
  "laguna 1": "laguna ballroom",
  "laguna 2": "laguna ballroom",
  "20/20 function room a": "20/20 function room",
  "20/20 function room b": "20/20 function room",
  "20/20 function room c": "20/20 function room",
  "2020 function room a": "20/20 function room",
  "2020 function room b": "20/20 function room",
  "2020 function room c": "20/20 function room",
  "grand ballroom a": "grand ballroom",
  "grand ballroom b": "grand ballroom",
  "grand ballroom c": "grand ballroom",
  "tower 1": "tower ballroom",
  "tower 2": "tower ballroom",
  "tower 3": "tower ballroom",
};

const diningAliases = {
  "hanakazu": "hanakazu japanese restaurant",
  "hanakazu japanese restaurant": "hanakazu japanese restaurant",
  "hanakazujapaneserestaurant": "hanakazu japanese restaurant",
  "qsina": "qsina restaurant",
  "qsina restaurant": "qsina restaurant",
  "qsinarestaurant": "qsina restaurant",
  "phoenix court": "phoenix court",
  "phoenixcourt": "phoenix court",
};

function isArchivedRoom(room) {
  return Boolean(room?.is_archived || room?.metadata?.archived_reason);
}

function knownParentKey(room) {
  const name = canonical(room?.name);
  const display = canonical(room?.display_name);
  return canonicalParentNames.find((parent) => parent === name || parent === display) || null;
}

function knownChildParentKey(room) {
  const name = canonical(room?.name);
  const display = canonical(room?.display_name);
  return childParentNameMap[name] || childParentNameMap[display] || null;
}

function diningKey(room) {
  if (room?.type !== "dining") return null;
  const name = canonical(room?.name);
  const display = canonical(room?.display_name);
  const slug = canonical(String(room?.slug || "").replace(/-/g, " "));

  return diningAliases[name] || diningAliases[display] || diningAliases[slug] || name || display || slug || null;
}

function childGroupingKey(room, parentName) {
  const display = canonical(room?.display_name);
  const name = canonical(room?.name);
  const value = (display || name)
    .replace(parentName, "")
    .replace(/function room|ballroom/g, "")
    .trim();
  return value || name || String(room?.id || "");
}

function blockedDateList(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function availabilityPayload(form) {
  const periods = normalizeSchedulePeriods(form.availability_periods, form)
    .filter((period) => period.start_time && period.end_time)
    .map((period) => ({
      ...period,
      days: period.days.map(Number),
      interval_minutes: Number(period.interval_minutes || 30),
      max_reservations_per_slot: Number(period.max_reservations_per_slot || 0),
      slot_capacity: Number(period.slot_capacity || 0),
      min_guests: Number(period.min_guests || 0),
      max_guests: Number(period.max_guests || 0),
      enabled: Boolean(period.enabled),
    }));
  const overrides = normalizeScheduleOverrides(form.availability_overrides)
    .filter((override) => override.date)
    .map((override) => ({
      ...override,
      blocked_times: String(override.blocked_times_text || "")
        .split(",")
        .map((item) => item.trim().substring(0, 5))
        .filter(Boolean),
      interval_minutes: Number(override.interval_minutes || 30),
      slot_capacity: Number(override.slot_capacity || 0),
      max_reservations_per_slot: Number(override.max_reservations_per_slot || 0),
      enabled: Boolean(override.enabled),
    }));

  return {
    enabled: Boolean(form.availability_enabled),
    days: [0, 1, 2, 3, 4, 5, 6],
    start_time: String(form.availability_start_time || "08:00").substring(0, 5),
    end_time: String(form.availability_end_time || "23:00").substring(0, 5),
    interval_minutes: Number(form.availability_interval_minutes || 60),
    max_reservations_per_slot: Number(form.availability_max_reservations || 0),
    slot_capacity: Number(form.availability_slot_capacity || form.capacity || 0),
    blocked_dates: blockedDateList(form.availability_blocked_dates),
    blocked_times: parseBlockedTimes(form.availability_blocked_times),
    periods,
    overrides,
  };
}

function notifyVenueConfigUpdated() {
  const detail = { source: "function-rooms", updatedAt: Date.now() };
  window.dispatchEvent(new CustomEvent("venue-config-updated", { detail }));
  try {
    localStorage.setItem("venue_config_updated_at", String(detail.updatedAt));
  } catch {
    // Local storage can be blocked in private contexts; the in-tab event still refreshes.
  }
}

function inputStyle() {
  return {
    width: "100%",
    minHeight: 38,
    border: `1px solid ${C.border}`,
    borderRadius: 9,
    background: C.surface,
    color: C.text,
    padding: "8px 11px",
    fontFamily: F.body,
    fontSize: 12.5,
    outline: "none",
  };
}

function buttonBase() {
  return {
    minHeight: 34,
    border: `1px solid ${C.border}`,
    borderRadius: 9,
    background: C.surface,
    color: C.muted,
    padding: "0 11px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    transition: "background 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease",
  };
}

function Field({ label, children, hint }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: C.faint }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11.5, lineHeight: 1.45, color: C.muted }}>{hint}</span>}
    </label>
  );
}

function Badge({ tone = "neutral", children, compact = false }) {
  const map = {
    green: [C.green, C.greenFaint],
    gold: [C.gold, C.goldFaint],
    red: [C.red, C.redFaint],
    neutral: [C.muted, "rgba(0,0,0,0.035)"],
  };
  const [color, bg] = map[tone] || map.neutral;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: 999,
      background: bg,
      color,
      padding: compact ? "3px 6px" : "4px 8px",
      fontSize: compact ? 8.5 : 9,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function MenuAction({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`function-room-menu-item${danger ? " is-danger" : ""}`}
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 34,
        border: "none",
        borderRadius: 8,
        background: "transparent",
        color: danger ? C.red : C.muted,
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "0 9px",
        fontFamily: F.body,
        fontSize: 12,
        fontWeight: 600,
        textAlign: "left",
        cursor: "pointer",
        transition: "background 0.16s ease, color 0.16s ease",
      }}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  );
}

function SummaryCard({ icon: Icon, label, value, tone = "gold" }) {
  const color = tone === "green" ? C.green : tone === "red" ? C.red : C.gold;
  const bg = tone === "green" ? C.greenFaint : tone === "red" ? C.redFaint : C.goldFaint;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 14px", display: "flex", alignItems: "center", gap: 11 }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, background: bg, color, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon size={16} /></span>
      <div>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 21, fontWeight: 650, color: C.text }}>{value}</div>
      </div>
    </div>
  );
}

export default function FunctionRooms() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ type: "all", status: "all", visibility: "all", wing: "all", landing: "all" });
  const [sortBy, setSortBy] = useState("display_order");
  const [confirmAction, setConfirmAction] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [expandedParents, setExpandedParents] = useState(() => new Set());
  const canManage = authAPI.hasPermission("manage_venues");
  const drawerVisible = drawerOpen || drawerClosing;

  const loadRooms = async () => {
    setLoading(true);
    try {
      const data = await venueAPI.getAll({ include_archived: false, _t: Date.now() });
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load venue configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRooms(); }, []);

  useEffect(() => {
    if (!drawerVisible || confirmAction) return undefined;
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
  }, [drawerVisible, confirmAction]);

  useEffect(() => {
    if (!confirmAction) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !saving) setConfirmAction(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [confirmAction, saving]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const closeMenu = () => setOpenMenuId(null);
    const closeMenuOnEscape = (event) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [openMenuId]);

  const uniqueRooms = useMemo(() => {
    const childCounts = new Map();
    const liveRooms = rooms.filter((room) => !isArchivedRoom(room));

    liveRooms.forEach((room) => {
      if (room.parent_id) {
        childCounts.set(Number(room.parent_id), (childCounts.get(Number(room.parent_id)) || 0) + 1);
      }
    });

    const score = (room) =>
      (childCounts.get(Number(room.id)) || 0) * 10 +
      (room.slug ? 4 : 0) +
      (room.reservation_route ? 3 : 0) +
      (room.show_on_landing ? 2 : 0) +
      (room.is_active ? 1 : 0);

    const byKey = new Map();
    liveRooms.forEach((room) => {
      const nameKey = canonical(room.display_name || room.name);
      if (!nameKey) return;
      const diningGroup = diningKey(room);
      const derivedParent = knownChildParentKey(room);
      const parentKey = knownParentKey(room);
      const key = diningGroup
        ? `dining:${diningGroup}`
        : derivedParent
        ? `child:${derivedParent}:${childGroupingKey(room, derivedParent)}`
        : room.parent_id
          ? `child:${room.parent_id}:${nameKey}`
          : `parent:${parentKey || room.slug || nameKey}`;
      const existing = byKey.get(key);
      if (!existing || score(room) >= score(existing)) {
        byKey.set(key, room);
      }
    });

    return Array.from(byKey.values());
  }, [rooms]);

  const parentRooms = useMemo(
    () => uniqueRooms.filter((room) => !room.parent_id && !knownChildParentKey(room)),
    [uniqueRooms],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map();
    const parentIdByKey = new Map();

    parentRooms.forEach((room) => {
      const key = knownParentKey(room) || canonical(room.display_name || room.name);
      if (key) parentIdByKey.set(key, Number(room.id));
    });

    uniqueRooms.forEach((room) => {
      const derivedParent = knownChildParentKey(room);
      const parentId = room.parent_id || (derivedParent ? parentIdByKey.get(derivedParent) : null);
      if (!parentId) return;
      const key = Number(parentId);
      map.set(key, [...(map.get(key) || []), room]);
    });
    map.forEach((items, key) => {
      map.set(key, items.sort(compareRooms("display_order")));
    });
    return map;
  }, [uniqueRooms]);

  const duplicateCount = Math.max(0, rooms.filter((room) => !isArchivedRoom(room)).length - uniqueRooms.length);

  const roomMatches = (room, query) => {
    const matchesSearch = !query || [room.name, room.display_name, room.slug, room.wing].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = filters.status === "all" || (filters.status === "enabled" ? room.is_active : !room.is_active);
    const matchesVisibility = filters.visibility === "all" || (filters.visibility === "visible" ? room.is_visible : !room.is_visible);
    const matchesLanding = filters.landing === "all" || (filters.landing === "shown" ? room.show_on_landing : !room.show_on_landing);
    const matchesWing = filters.wing === "all" || room.wing === filters.wing;
    const matchesType = filters.type === "all"
      || (filters.type === "sub_room" ? Boolean(room.parent_id || knownChildParentKey(room)) : room.type === filters.type);
    return matchesSearch && matchesType && matchesStatus && matchesVisibility && matchesLanding && matchesWing;
  };

  const groupedRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const parents = parentRooms.sort(compareRooms(sortBy));
    const rows = [];
    const usedChildren = new Set();
    const attachedChildren = new Set();

    parents.forEach((parent) => {
      const children = childrenByParent.get(Number(parent.id)) || [];
      children.forEach((child) => attachedChildren.add(child.id));
      const matchingChildren = children.filter((child) => roomMatches(child, query));
      const parentMatches = roomMatches(parent, query);
      if (!parentMatches && matchingChildren.length === 0) return;

      rows.push({ room: parent, level: 0, childCount: children.length });
      const shouldShowChildren = query || expandedParents.has(Number(parent.id));
      if (!shouldShowChildren) return;
      matchingChildren.forEach((child) => {
        usedChildren.add(child.id);
        rows.push({ room: child, level: 1, childCount: 0, parent });
      });
    });

    uniqueRooms
      .filter((room) => (room.parent_id || knownChildParentKey(room)) && !attachedChildren.has(room.id) && !usedChildren.has(room.id) && roomMatches(room, query))
      .sort(compareRooms(sortBy))
      .forEach((room) => rows.push({ room, level: 1, childCount: 0 }));

    if (sortBy === "parent_first") return rows;
    return rows;
  }, [uniqueRooms, parentRooms, childrenByParent, search, filters, sortBy, expandedParents]);

  const stats = {
    total: uniqueRooms.length,
    dining: uniqueRooms.filter((room) => room.type === "dining").length,
    functionRooms: uniqueRooms.filter((room) => room.type === "function_room").length,
    enabled: uniqueRooms.filter((room) => room.is_active).length,
    visible: uniqueRooms.filter((room) => room.is_visible && room.show_on_landing).length,
    grouped: uniqueRooms.filter((room) => room.parent_id || knownChildParentKey(room)).length,
  };

  const beginCreate = () => {
    setOpenMenuId(null);
    setDrawerClosing(false);
    setEditing(null);
    setForm({ ...emptyForm, availability_periods: defaultSchedulePeriods(emptyForm) });
    setImageFile(null);
    setError("");
    setDrawerOpen(true);
  };

  const beginEdit = (room) => {
    setOpenMenuId(null);
    setDrawerClosing(false);
    setEditing(room);
    setForm(normalizeRoom(room));
    setImageFile(null);
    setError("");
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving && drawerOpen) return;
    if (!drawerOpen) return;
    setDrawerClosing(true);
    setDrawerOpen(false);
    window.setTimeout(() => {
      setDrawerClosing(false);
      setEditing(null);
      setForm(emptyForm);
      setImageFile(null);
      setError("");
    }, 280);
  };

  const updateForm = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "name" && !editing) {
        next.slug = slugify(value);
        next.display_name = value;
      }
      if (key === "type") {
        next.category = value === "dining" ? "dining" : "function_room";
        next.wing = value === "dining" ? "Dining" : (current.wing === "Dining" ? "Main Wing" : current.wing);
        next.parent_id = value === "dining" ? "" : current.parent_id;
        next.availability_start_time = value === "dining" ? "11:00" : "08:00";
        next.availability_end_time = value === "dining" ? "22:00" : "23:00";
        next.availability_interval_minutes = value === "dining" ? 30 : 60;
        next.availability_periods = defaultSchedulePeriods({ ...next, type: value });
      }
      return next;
    });
  };

  const applyDefaultSchedule = () => {
    setForm((current) => ({
      ...current,
      availability_periods: defaultSchedulePeriods(current),
    }));
  };

  const addPeriod = () => {
    setForm((current) => ({
      ...current,
      availability_periods: [
        ...normalizeSchedulePeriods(current.availability_periods, current),
        makePeriod({
          label: current.type === "dining" ? "Dining Service" : "Event Window",
          service_type: current.type === "dining" ? "Reservation" : "Function reservation",
          interval_minutes: current.type === "dining" ? 30 : 60,
          slot_capacity: Number(current.capacity || 0),
        }),
      ],
    }));
  };

  const updatePeriod = (periodId, key, value) => {
    setForm((current) => ({
      ...current,
      availability_periods: normalizeSchedulePeriods(current.availability_periods, current).map((period) =>
        period.id === periodId ? { ...period, [key]: value } : period,
      ),
    }));
  };

  const togglePeriodDay = (periodId, dayValue) => {
    const day = Number(dayValue);
    setForm((current) => ({
      ...current,
      availability_periods: normalizeSchedulePeriods(current.availability_periods, current).map((period) => {
        if (period.id !== periodId) return period;
        const days = new Set(period.days.map(Number));
        if (days.has(day)) days.delete(day);
        else days.add(day);
        return { ...period, days: Array.from(days).sort((a, b) => a - b) };
      }),
    }));
  };

  const removePeriod = (periodId) => {
    setForm((current) => ({
      ...current,
      availability_periods: normalizeSchedulePeriods(current.availability_periods, current).filter((period) => period.id !== periodId),
    }));
  };

  const addOverride = () => {
    setForm((current) => ({
      ...current,
      availability_overrides: [...normalizeScheduleOverrides(current.availability_overrides), makeOverride()],
    }));
  };

  const updateOverride = (overrideId, key, value) => {
    setForm((current) => ({
      ...current,
      availability_overrides: normalizeScheduleOverrides(current.availability_overrides).map((override) =>
        override.id === overrideId ? { ...override, [key]: value } : override,
      ),
    }));
  };

  const removeOverride = (overrideId) => {
    setForm((current) => ({
      ...current,
      availability_overrides: normalizeScheduleOverrides(current.availability_overrides).filter((override) => override.id !== overrideId),
    }));
  };

  const validate = () => {
    if (!form.name.trim()) return "Venue name is required.";
    if (!form.slug.trim()) return "Venue slug/code is required.";
    if (form.parent_id && editing && String(form.parent_id) === String(editing.id)) return "A venue cannot be assigned as its own parent.";
    if (Number.isNaN(Number(form.display_order))) return "Display order must be numeric.";
    if (Number(form.availability_interval_minutes) < 15) return "Reservation interval must be at least 15 minutes.";
    if (form.availability_start_time && form.availability_end_time && form.availability_start_time === form.availability_end_time) return "Opening and closing time cannot be the same.";
    const periods = normalizeSchedulePeriods(form.availability_periods, form);
    if (periods.length === 0) return "At least one reservation period is required.";
    for (const period of periods) {
      if (!period.days.length) return `${period.label || "A schedule period"} needs at least one day.`;
      if (!period.start_time || !period.end_time) return `${period.label || "A schedule period"} needs start and end times.`;
      if (period.start_time === period.end_time) return `${period.label || "A schedule period"} cannot start and end at the same time.`;
      if (Number(period.interval_minutes) < 15) return `${period.label || "A schedule period"} interval must be at least 15 minutes.`;
    }
    if (imageFile && !["image/jpeg", "image/png", "image/webp"].includes(imageFile.type)) return "Image must be JPG, PNG, or WEBP.";
    return "";
  };

  const saveRoom = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        parent_id: form.type === "dining" ? null : (form.parent_id ? Number(form.parent_id) : null),
        category: form.type === "dining" ? "dining" : (form.category || "function_room"),
        capacity: Number(form.capacity || 0),
        display_order: Number(form.display_order || 0),
        display_name: form.display_name || form.name,
        metadata: {
          ...(form.metadata || {}),
          availability: availabilityPayload(form),
        },
      };
      const saved = editing ? await venueAPI.update(editing.id, payload) : await venueAPI.create(payload);
      if (imageFile) await venueAPI.uploadImage(saved.id, imageFile);
      await loadRooms();
      notifyVenueConfigUpdated();
      setToast(editing ? "Venue updated." : "Venue created.");
      setDrawerClosing(true);
      setDrawerOpen(false);
      window.setTimeout(() => {
        setDrawerClosing(false);
        setEditing(null);
        setForm(emptyForm);
        setImageFile(null);
        setError("");
      }, 280);
    } catch (err) {
      const messages = err.data?.errors ? Object.values(err.data.errors).flat().join(" ") : "";
      setError(messages || err.message || "Unable to save venue.");
    } finally {
      setSaving(false);
    }
  };

  const actionCopy = (room, key, nextValue) => {
    const name = room.display_name || room.name || "this venue";
    const venueKind = room.type === "dining" ? "dining outlet" : "function room";
    if (key === "is_active") {
      return nextValue
        ? {
            title: `Enable ${venueKind}?`,
            message: `${name} will be enabled and can be reserved when visibility settings allow it.`,
            label: "Enable",
            tone: "green",
          }
        : {
            title: `Disable ${venueKind}?`,
            message: `${name} will no longer be reservable on the guest-facing venue page. Existing reservations remain preserved.`,
            label: "Disable",
            tone: "red",
          };
    }
    if (key === "is_visible") {
      return nextValue
        ? {
            title: `Show ${venueKind}?`,
            message: `${name} will become eligible to render on the guest-facing venue page when enabled and configured for landing display.`,
            label: "Show",
            tone: "green",
          }
        : {
            title: `Hide ${venueKind}?`,
            message: `${name} will be removed from guest-facing venue lists while remaining manageable in admin.`,
            label: "Hide",
            tone: "red",
          };
    }
    return nextValue
      ? {
          title: "Show on landing page?",
          message: `${name} will appear on the venue launcher when it is also enabled and visible.`,
          label: "Show on landing",
          tone: "green",
        }
      : {
          title: "Remove from landing page?",
          message: `${name} will stay in admin but will no longer appear on the venue launcher.`,
          label: "Remove",
          tone: "red",
        };
  };

  const requestToggle = (room, key) => {
    if (!canManage) return;
    setOpenMenuId(null);
    const nextValue = !room[key];
    setConfirmAction({
      type: "toggle",
      room,
      key,
      nextValue,
      ...actionCopy(room, key, nextValue),
    });
  };

  const requestDelete = (room) => {
    if (!canManage) return;
    setOpenMenuId(null);
    const name = room.display_name || room.name || "this venue";
    setConfirmAction({
      type: "delete",
      room,
      title: "Delete venue?",
      message: `${name} will be removed from configuration. Use this only for mistaken records; disabling or hiding is safer for historical venues.`,
      label: "Delete",
      tone: "red",
    });
  };

  const runConfirmedAction = async () => {
    if (!confirmAction || !canManage) return;
    setSaving(true);
    setError("");
    try {
      if (confirmAction.type === "delete") {
        await venueAPI.delete(confirmAction.room.id);
      } else {
        await venueAPI.update(confirmAction.room.id, { [confirmAction.key]: confirmAction.nextValue });
      }
      setConfirmAction(null);
      await loadRooms();
      notifyVenueConfigUpdated();
      setToast(confirmAction.type === "delete" ? "Venue deleted." : "Venue setting updated.");
    } catch (err) {
      setError(err.message || "Unable to update venue.");
    } finally {
      setSaving(false);
    }
  };

  const toggleParentExpanded = (roomId) => {
    setExpandedParents((current) => {
      const next = new Set(current);
      if (next.has(Number(roomId))) next.delete(Number(roomId));
      else next.add(Number(roomId));
      return next;
    });
  };

  const preview = imageFile ? URL.createObjectURL(imageFile) : imageUrl(form.image);
  const schedulePeriods = normalizeSchedulePeriods(form.availability_periods, form);
  const scheduleOverrides = normalizeScheduleOverrides(form.availability_overrides);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .function-room-row { transition: background 0.14s ease; }
        .function-room-row:hover { background: rgba(140,107,42,0.032); }
        .function-room-action:hover { border-color: rgba(140,107,42,0.28) !important; color: ${C.gold} !important; transform: translateY(-1px); }
        .function-room-action:disabled { opacity: 0.45; cursor: not-allowed; transform: none !important; }
        .function-room-menu-item:hover { background: rgba(140,107,42,0.07) !important; color: ${C.gold} !important; }
        .function-room-menu-item.is-danger:hover { background: rgba(160,56,56,0.075) !important; color: ${C.red} !important; }
        .function-room-drawer-backdrop {
          opacity: 1;
          transition: opacity 260ms ease, backdrop-filter 260ms ease;
          will-change: opacity;
        }
        .function-room-drawer-backdrop:not(.is-closing) {
          animation: drawerFadeIn 220ms ease both;
        }
        .function-room-drawer {
          opacity: 1;
          transform: translate3d(0,0,0);
          transition: transform 300ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }
        .function-room-drawer-backdrop:not(.is-closing) .function-room-drawer {
          animation: drawerSlideIn 320ms cubic-bezier(0.22,1,0.36,1) both;
        }
        .function-room-drawer-backdrop.is-closing {
          opacity: 0;
          backdrop-filter: blur(0px) !important;
          pointer-events: none;
        }
        .function-room-drawer-backdrop.is-closing .function-room-drawer {
          opacity: 0;
          transform: translate3d(36px,0,0);
        }
        .function-room-confirm-backdrop { animation: confirmFade 180ms ease both; }
        .function-room-confirm { animation: confirmIn 220ms cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes drawerFadeIn { from { opacity: 0; backdrop-filter: blur(0); } to { opacity: 1; backdrop-filter: blur(2px); } }
        @keyframes drawerSlideIn { from { opacity: 0; transform: translate3d(34px,0,0); } to { opacity: 1; transform: translate3d(0,0,0); } }
        @keyframes confirmFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes confirmIn { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (max-width: 920px) {
          .function-room-stats, .function-room-toolbar { grid-template-columns: 1fr !important; }
          .function-room-table-wrap { overflow-x: auto; }
          .function-room-drawer { width: min(100vw, 520px) !important; }
        }
      `}</style>
      <AdminNavbar />
      <div style={{ display: "flex", height: "calc(100vh - 60px)", minHeight: 0, overflow: "hidden", background: C.page }}>
        <Sidebar activeNav="function-rooms" isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main style={{ flex: 1, height: "calc(100vh - 60px)", overflow: "auto", padding: "30px 32px 42px" }}>
          <AdminPageHeader
            eyebrow="Venue Configuration"
            title="Venue Management"
            description="Configure dining outlets, function rooms, sub-rooms, photos, visibility, landing display, and reservation availability."
            C={C}
            F={F}
            actions={canManage && (
              <button type="button" onClick={beginCreate} style={{ ...buttonBase(), minHeight: 40, border: "none", background: C.gold, color: "#fff", padding: "0 14px" }}>
                <Plus size={14} /> New Venue
              </button>
            )}
          />

          {toast && <div style={{ marginBottom: 14, padding: "9px 12px", borderRadius: 10, background: C.greenFaint, color: C.green, border: "1px solid rgba(46,122,90,0.16)", fontSize: 12.5 }}>{toast}</div>}
          {error && !drawerOpen && <div style={{ marginBottom: 14, padding: "9px 12px", borderRadius: 10, background: C.redFaint, color: C.red, border: "1px solid rgba(160,56,56,0.16)", fontSize: 12.5 }}>{error}</div>}

          <div className="function-room-stats" style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
            <SummaryCard icon={Layers} label="Configured Venues" value={stats.total} />
            <SummaryCard icon={Camera} label="Dining Outlets" value={stats.dining} tone="gold" />
            <SummaryCard icon={Layers} label="Function Rooms" value={stats.functionRooms} />
            <SummaryCard icon={CheckCircle2} label="Enabled" value={stats.enabled} tone="green" />
            <SummaryCard icon={Eye} label="Landing Visible" value={stats.visible} tone="gold" />
          </div>

          {duplicateCount > 0 && (
            <div style={{ marginBottom: 14, padding: "9px 12px", borderRadius: 10, background: C.goldFaint, color: C.gold, border: "1px solid rgba(140,107,42,0.16)", fontSize: 12.5 }}>
              {duplicateCount} duplicate venue record{duplicateCount > 1 ? "s are" : " is"} hidden from this workspace and the guest landing renderer.
            </div>
          )}

          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "visible" }}>
            <div className="function-room-toolbar" style={{ display: "grid", gridTemplateColumns: "minmax(240px,1fr) repeat(6, minmax(128px, auto))", gap: 10, padding: 14, borderBottom: `1px solid ${C.divider}`, background: C.soft }}>
              <div style={{ position: "relative" }}>
                <Search size={15} style={{ position: "absolute", left: 11, top: 12, color: C.faint }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search venues, slugs, wings" style={{ ...inputStyle(), paddingLeft: 34 }} />
              </div>
              <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} style={inputStyle()}>
                <option value="all">All types</option>
                <option value="dining">Dining outlets</option>
                <option value="function_room">Function rooms</option>
                <option value="sub_room">Sub-rooms</option>
              </select>
              <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={inputStyle()}>
                <option value="all">All status</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
              <select value={filters.visibility} onChange={(e) => setFilters((f) => ({ ...f, visibility: e.target.value }))} style={inputStyle()}>
                <option value="all">All visibility</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
              <select value={filters.landing} onChange={(e) => setFilters((f) => ({ ...f, landing: e.target.value }))} style={inputStyle()}>
                <option value="all">All landing</option>
                <option value="shown">Shown</option>
                <option value="hidden">Not shown</option>
              </select>
              <select value={filters.wing} onChange={(e) => setFilters((f) => ({ ...f, wing: e.target.value }))} style={inputStyle()}>
                <option value="all">All wings</option>
                <option value="Dining">Dining</option>
                <option value="Main Wing">Main Wing</option>
                <option value="Tower Wing">Tower Wing</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={inputStyle()}>
                <option value="display_order">Display order</option>
                <option value="parent_first">Parents first</option>
                <option value="name">Alphabetical</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="status">Enabled first</option>
              </select>
            </div>

            <div className="function-room-table-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 940 }}>
                <thead>
                  <tr style={{ background: C.surface, position: "sticky", top: 0, zIndex: 1 }}>
                    {["Venue Structure", "Status", "Display Settings", "Order", "Manage"].map((header) => (
                      <th key={header} style={{ padding: "11px 14px", textAlign: "left", color: C.faint, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", borderBottom: `1px solid ${C.divider}` }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} style={{ padding: 22, color: C.muted }}>Loading venues...</td></tr>
                  ) : groupedRows.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 22, color: C.muted }}>No venues match the current filters.</td></tr>
                  ) : groupedRows.map(({ room, level, childCount, parent }) => (
                    <tr key={`${room.id}-${level}`} className="function-room-row" style={{ background: level ? "rgba(250,248,244,0.52)" : C.surface }}>
                      <td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.divider}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: level ? 26 : 0 }}>
                          {level ? (
                            <span style={{ width: 14, color: C.faint, display: "inline-flex", justifyContent: "center" }}><ChevronRight size={14} /></span>
                          ) : childCount ? (
                            <button
                              type="button"
                              onClick={() => toggleParentExpanded(room.id)}
                              aria-label={`${expandedParents.has(Number(room.id)) ? "Collapse" : "Expand"} ${room.display_name || room.name}`}
                              style={{ width: 18, height: 18, border: "none", background: "transparent", color: C.gold, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transform: expandedParents.has(Number(room.id)) ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.18s ease" }}
                            >
                              <ChevronRight size={15} />
                            </button>
                          ) : <span style={{ width: 18 }} />}
                          <div style={{ width: level ? 48 : 58, height: level ? 34 : 40, borderRadius: 9, background: C.soft, overflow: "hidden", flexShrink: 0, border: `1px solid ${C.border}` }}>
                            {room.image ? <img src={imageUrl(room.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Camera size={17} style={{ margin: level ? 8 : 10, color: C.faint }} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <strong style={{ color: C.text, fontSize: level ? 12.5 : 13.5, fontWeight: level ? 560 : 640, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{room.display_name || room.name}</strong>
                              {!level && (
                                <Badge tone={room.type === "dining" ? "gold" : "neutral"} compact>
                                  {room.type === "dining" ? "Dining" : childCount ? `${childCount} sub-room${childCount > 1 ? "s" : ""}` : "Function"}
                                </Badge>
                              )}
                            </div>
                            <div style={{ marginTop: 3, color: C.muted, fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {level && parent ? `${parent.display_name || parent.name} · ` : ""}{room.slug || "No slug"} · {room.wing}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.divider}` }}>
                        <Badge tone={room.is_active ? "green" : "red"}>{room.is_active ? "Enabled" : "Disabled"}</Badge>
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.divider}` }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          <Badge tone={room.is_visible ? "green" : "neutral"} compact>{room.is_visible ? "Visible" : "Hidden"}</Badge>
                          <Badge tone={room.show_on_landing ? "gold" : "neutral"} compact>{room.show_on_landing ? "Landing" : "No landing"}</Badge>
                          <Badge tone={room.reservations_enabled ? "green" : "red"} compact>{room.reservations_enabled ? "Reservable" : "Unavailable"}</Badge>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.divider}`, color: C.text, fontWeight: 560, fontSize: 12.5 }}>{room.display_order}</td>
                      <td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.divider}` }}>
                        <div style={{ display: "flex", gap: 7, justifyContent: "flex-end", position: "relative" }}>
                          <button className="function-room-action" type="button" onClick={() => beginEdit(room)} style={{ ...buttonBase(), color: C.gold }} title="Edit venue"><Edit3 size={14} /> Edit</button>
                          <button
                            className="function-room-action"
                            type="button"
                            disabled={!canManage}
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenMenuId((current) => current === room.id ? null : room.id);
                            }}
                            style={{ ...buttonBase(), width: 36, padding: 0 }}
                            aria-label={`Open actions for ${room.display_name || room.name}`}
                            aria-expanded={openMenuId === room.id}
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {openMenuId === room.id && (
                            <div
                              role="menu"
                              onClick={(event) => event.stopPropagation()}
                              style={{ position: "absolute", top: 40, right: 0, zIndex: 20, width: 210, padding: 6, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 18px 46px rgba(24,20,14,0.16)", display: "grid", gap: 2 }}
                            >
                              <MenuAction icon={room.is_active ? ToggleRight : ToggleLeft} label={room.is_active ? "Disable venue" : "Enable venue"} onClick={() => requestToggle(room, "is_active")} />
                              <MenuAction icon={room.is_visible ? EyeOff : Eye} label={room.is_visible ? "Hide from guests" : "Show to guests"} onClick={() => requestToggle(room, "is_visible")} />
                              <MenuAction icon={room.show_on_landing ? EyeOff : Eye} label={room.show_on_landing ? "Remove from landing" : "Add to landing"} onClick={() => requestToggle(room, "show_on_landing")} />
                              <div style={{ height: 1, background: C.divider, margin: "4px 3px" }} />
                              <MenuAction icon={Trash2} label="Delete venue" danger onClick={() => requestDelete(room)} />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>

      {drawerVisible && (
        <div className={`function-room-drawer-backdrop${drawerClosing ? " is-closing" : ""}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }} style={{ position: "fixed", inset: 0, zIndex: 7000, background: "rgba(24,20,14,0.28)", display: "flex", justifyContent: "flex-end", backdropFilter: "blur(2px)" }}>
          <aside className="function-room-drawer" role="dialog" aria-modal="true" aria-label={editing ? "Edit venue" : "Create venue"} style={{ width: "min(520px, calc(100vw - 28px))", height: "100%", background: C.surface, borderLeft: `1px solid ${C.border}`, boxShadow: "0 24px 70px rgba(24,20,14,0.22)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ color: C.gold, fontSize: 8.5, fontWeight: 750, letterSpacing: "0.16em", textTransform: "uppercase" }}>Configuration</div>
                <h2 style={{ margin: "5px 0 0", color: C.text, fontSize: 21, lineHeight: 1.15, fontWeight: 640 }}>{editing ? "Edit Venue" : "Create Venue"}</h2>
              </div>
              <button type="button" onClick={closeDrawer} style={{ ...buttonBase(), width: 36, padding: 0 }} aria-label="Close panel"><X size={16} /></button>
            </div>

            <form onSubmit={saveRoom} style={{ minHeight: 0, flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ flex: 1, overflow: "auto", padding: 20, display: "grid", gap: 16 }}>
                {error && <div style={{ padding: "9px 11px", borderRadius: 10, background: C.redFaint, color: C.red, border: "1px solid rgba(160,56,56,0.16)", fontSize: 12.5 }}>{error}</div>}

                <section style={formSectionStyle()}>
                  <div style={sectionTitleStyle()}>Display Photo</div>
                  <div style={{ height: 150, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}`, background: C.soft }}>
                    {preview ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ height: "100%", display: "grid", placeItems: "center", color: C.faint }}><Camera size={28} /></div>}
                  </div>
                  <Field label="Image path or URL"><input value={form.image} onChange={(e) => updateForm("image", e.target.value)} placeholder="Image URL or public image path" style={inputStyle()} /></Field>
                  <label style={{ ...buttonBase(), justifyContent: "center", cursor: canManage ? "pointer" : "not-allowed", opacity: canManage ? 1 : 0.55 }}>
                    <Upload size={14} /> Upload image
                    <input disabled={!canManage} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
                  </label>
                </section>

                <section style={formSectionStyle()}>
                  <div style={sectionTitleStyle()}>Venue Identity</div>
                  <Field label="Venue Type">
                    <select value={form.type} onChange={(e) => updateForm("type", e.target.value)} style={inputStyle()}>
                      <option value="function_room">Function Room</option>
                      <option value="dining">Dining Outlet</option>
                    </select>
                  </Field>
                  <Field label="Venue Name"><input value={form.name} onChange={(e) => updateForm("name", e.target.value)} style={inputStyle()} /></Field>
                  <Field label="Customer Display Name"><input value={form.display_name} onChange={(e) => updateForm("display_name", e.target.value)} style={inputStyle()} /></Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 0.6fr", gap: 10 }}>
                    <Field label="Slug / Code"><input value={form.slug} onChange={(e) => updateForm("slug", slugify(e.target.value))} style={inputStyle()} /></Field>
                    <Field label="Order"><input type="number" min="0" value={form.display_order} onChange={(e) => updateForm("display_order", e.target.value)} style={inputStyle()} /></Field>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="Location"><select value={form.wing} onChange={(e) => updateForm("wing", e.target.value)} style={inputStyle()}><option>Dining</option><option>Main Wing</option><option>Tower Wing</option></select></Field>
                    <Field label="Capacity"><input type="number" min="0" value={form.capacity} onChange={(e) => updateForm("capacity", e.target.value)} style={inputStyle()} /></Field>
                  </div>
                </section>

                <section style={formSectionStyle()}>
                  <div style={sectionTitleStyle()}>Grouping & Reservation</div>
                  <Field label="Parent Room" hint="Leave empty for a main venue. Function-room children become chips under their parent card.">
                    <select disabled={form.type === "dining"} value={form.parent_id} onChange={(e) => updateForm("parent_id", e.target.value)} style={inputStyle()}>
                      <option value="">No parent room</option>
                      {parentRooms.filter((room) => room.type === "function_room" && (!editing || room.id !== editing.id)).map((room) => <option key={room.id} value={room.id}>{room.display_name || room.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Reservation Route"><input value={form.reservation_route} onChange={(e) => updateForm("reservation_route", e.target.value)} placeholder="/tower1" style={inputStyle()} /></Field>
                  <Field label="Description"><textarea value={form.description || ""} onChange={(e) => updateForm("description", e.target.value)} rows={3} style={{ ...inputStyle(), resize: "vertical" }} /></Field>
                </section>

                <section style={formSectionStyle()}>
                  <div style={sectionTitleStyle()}>Availability Settings</div>
                  {[
                    ["is_active", "Enabled"],
                    ["is_visible", "Visible in guest surfaces"],
                    ["show_on_landing", "Show on landing page"],
                    ["reservations_enabled", "Allow guest reservations"],
                    ...(form.type === "dining" ? [] : [["parent_selectable", "Parent room selectable"], ["child_selectable", "Child rooms selectable"]]),
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: C.text }}>
                      {label}
                      <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => updateForm(key, e.target.checked)} style={{ accentColor: C.gold }} />
                    </label>
                  ))}
                </section>

                <section style={formSectionStyle()}>
                  <div style={sectionTitleStyle()}>Reservation Time Rules</div>
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: C.text }}>
                    Use schedule for guest reservations
                    <input type="checkbox" checked={Boolean(form.availability_enabled)} onChange={(e) => updateForm("availability_enabled", e.target.checked)} style={{ accentColor: C.gold }} />
                  </label>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <span style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
                      Add multiple service periods for breakfast, lunch, dinner, private dining, or event windows.
                    </span>
                    <button type="button" onClick={applyDefaultSchedule} style={{ ...buttonBase(), flexShrink: 0 }}>Apply template</button>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {schedulePeriods.map((period, index) => (
                      <div key={period.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, background: C.soft, display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <strong style={{ color: C.text, fontSize: 12.5, fontWeight: 650 }}>Service Period {index + 1}</strong>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 11.5 }}>
                              Enabled
                              <input type="checkbox" checked={Boolean(period.enabled)} onChange={(event) => updatePeriod(period.id, "enabled", event.target.checked)} style={{ accentColor: C.gold }} />
                            </label>
                            <button type="button" onClick={() => removePeriod(period.id)} style={{ ...buttonBase(), minHeight: 30, color: C.red }}>Remove</button>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <Field label="Label"><input value={period.label} onChange={(e) => updatePeriod(period.id, "label", e.target.value)} style={inputStyle()} /></Field>
                          <Field label="Service Type"><input value={period.service_type} onChange={(e) => updatePeriod(period.id, "service_type", e.target.value)} placeholder="Buffet, à la carte, private dining" style={inputStyle()} /></Field>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.75fr", gap: 10 }}>
                          <Field label="Start"><input type="time" value={period.start_time} onChange={(e) => updatePeriod(period.id, "start_time", e.target.value)} style={inputStyle()} /></Field>
                          <Field label="End"><input type="time" value={period.end_time} onChange={(e) => updatePeriod(period.id, "end_time", e.target.value)} style={inputStyle()} /></Field>
                          <Field label="Interval"><input type="number" min="15" step="15" value={period.interval_minutes} onChange={(e) => updatePeriod(period.id, "interval_minutes", e.target.value)} style={inputStyle()} /></Field>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {DAY_OPTIONS.map(([value, label]) => {
                            const checked = period.days.map(Number).includes(Number(value));
                            return (
                              <button
                                key={`${period.id}-${value}`}
                                type="button"
                                onClick={() => togglePeriodDay(period.id, value)}
                                style={{
                                  minHeight: 28,
                                  borderRadius: 999,
                                  border: checked ? "1px solid rgba(140,107,42,0.34)" : `1px solid ${C.border}`,
                                  background: checked ? C.goldFaint : C.surface,
                                  color: checked ? C.gold : C.muted,
                                  padding: "0 9px",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                          <Field label="Slot Capacity"><input type="number" min="0" value={period.slot_capacity} onChange={(e) => updatePeriod(period.id, "slot_capacity", e.target.value)} style={inputStyle()} /></Field>
                          <Field label="Min Guests"><input type="number" min="0" value={period.min_guests} onChange={(e) => updatePeriod(period.id, "min_guests", e.target.value)} style={inputStyle()} /></Field>
                          <Field label="Max Guests"><input type="number" min="0" value={period.max_guests} onChange={(e) => updatePeriod(period.id, "max_guests", e.target.value)} style={inputStyle()} /></Field>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addPeriod} style={{ ...buttonBase(), justifyContent: "center" }}>
                      <Plus size={14} /> Add service period
                    </button>
                  </div>
                  <Field label="Blocked Dates" hint="Comma-separated dates, for example: 2026-06-12, 2026-12-25">
                    <textarea value={form.availability_blocked_dates} onChange={(e) => updateForm("availability_blocked_dates", e.target.value)} rows={2} style={{ ...inputStyle(), resize: "vertical" }} />
                  </Field>
                  <Field label="Blocked Times" hint="One date per line. Example: 2026-06-12: 18:00, 18:30">
                    <textarea value={form.availability_blocked_times} onChange={(e) => updateForm("availability_blocked_times", e.target.value)} rows={2} style={{ ...inputStyle(), resize: "vertical" }} />
                  </Field>
                </section>

                <section style={formSectionStyle()}>
                  <div style={sectionTitleStyle()}>Manual Overrides</div>
                  <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
                    Use overrides for special closures, blocked periods, special opening hours, or one-day capacity changes.
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {scheduleOverrides.map((override, index) => (
                      <div key={override.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, background: C.soft, display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <strong style={{ color: C.text, fontSize: 12.5, fontWeight: 650 }}>Override {index + 1}</strong>
                          <button type="button" onClick={() => removeOverride(override.id)} style={{ ...buttonBase(), minHeight: 30, color: C.red }}>Remove</button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <Field label="Date"><input type="date" value={override.date} onChange={(e) => updateOverride(override.id, "date", e.target.value)} style={inputStyle()} /></Field>
                          <Field label="Type">
                            <select value={override.type} onChange={(e) => updateOverride(override.id, "type", e.target.value)} style={inputStyle()}>
                              <option value="closed">Closed full day</option>
                              <option value="block_time">Block time range</option>
                              <option value="special_hours">Special opening hours</option>
                              <option value="capacity">Capacity adjustment</option>
                            </select>
                          </Field>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <Field label="Start"><input type="time" value={override.start_time} onChange={(e) => updateOverride(override.id, "start_time", e.target.value)} style={inputStyle()} /></Field>
                          <Field label="End"><input type="time" value={override.end_time} onChange={(e) => updateOverride(override.id, "end_time", e.target.value)} style={inputStyle()} /></Field>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <Field label="Slot Capacity"><input type="number" min="0" value={override.slot_capacity} onChange={(e) => updateOverride(override.id, "slot_capacity", e.target.value)} style={inputStyle()} /></Field>
                          <Field label="Max Bookings"><input type="number" min="0" value={override.max_reservations_per_slot} onChange={(e) => updateOverride(override.id, "max_reservations_per_slot", e.target.value)} style={inputStyle()} /></Field>
                        </div>
                        <Field label="Blocked Times"><input value={override.blocked_times_text} onChange={(e) => updateOverride(override.id, "blocked_times_text", e.target.value)} placeholder="18:00, 18:30" style={inputStyle()} /></Field>
                        <Field label="Note"><input value={override.note} onChange={(e) => updateOverride(override.id, "note", e.target.value)} placeholder="Private event, maintenance, holiday closure" style={inputStyle()} /></Field>
                      </div>
                    ))}
                    <button type="button" onClick={addOverride} style={{ ...buttonBase(), justifyContent: "center" }}>
                      <Plus size={14} /> Add manual override
                    </button>
                  </div>
                </section>
              </div>

              <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.divider}`, background: C.soft, display: "flex", justifyContent: "flex-end", gap: 9 }}>
                <button type="button" onClick={closeDrawer} disabled={saving} style={buttonBase()}>Cancel</button>
                <button type="submit" disabled={!canManage || saving} style={{ ...buttonBase(), minWidth: 150, border: "none", background: canManage ? C.gold : C.faint, color: "#fff", cursor: canManage && !saving ? "pointer" : "not-allowed" }}>
                  {saving ? "Saving..." : editing ? "Save Changes" : "Create Venue"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {confirmAction && (
        <div className="function-room-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setConfirmAction(null); }} style={{ position: "fixed", inset: 0, zIndex: 8200, display: "grid", placeItems: "center", padding: 18, background: "rgba(24,20,14,0.34)", backdropFilter: "blur(3px)" }}>
          <section className="function-room-confirm" role="dialog" aria-modal="true" aria-labelledby="function-room-confirm-title" style={{ width: "min(420px, 100%)", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 26px 70px rgba(24,20,14,0.24)", padding: 20 }}>
            <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: confirmAction.tone === "red" ? C.redFaint : C.greenFaint, color: confirmAction.tone === "red" ? C.red : C.green }}>
                {confirmAction.tone === "red" ? <Trash2 size={18} /> : <CheckCircle2 size={18} />}
              </span>
              <div>
                <h2 id="function-room-confirm-title" style={{ margin: 0, fontSize: 18, lineHeight: 1.25, color: C.text, fontWeight: 650 }}>{confirmAction.title}</h2>
                <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: C.muted }}>{confirmAction.message}</p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }}>
              <button type="button" disabled={saving} onClick={() => setConfirmAction(null)} style={buttonBase()}>Cancel</button>
              <button type="button" disabled={saving} onClick={runConfirmedAction} style={{ ...buttonBase(), minWidth: 118, border: "none", background: confirmAction.tone === "red" ? C.red : C.green, color: "#fff" }}>
                {saving ? "Working..." : confirmAction.label}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function compareRooms(sortBy) {
  return (a, b) => {
    if (sortBy === "name") return String(a.display_name || a.name).localeCompare(String(b.display_name || b.name));
    if (sortBy === "newest") return new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0);
    if (sortBy === "oldest") return new Date(a.created_at || a.updated_at || 0) - new Date(b.created_at || b.updated_at || 0);
    if (sortBy === "status") return Number(b.is_active) - Number(a.is_active) || String(a.name).localeCompare(String(b.name));
    if (sortBy === "parent_first") return Number(Boolean(a.parent_id)) - Number(Boolean(b.parent_id)) || Number(a.display_order || 0) - Number(b.display_order || 0);
    return Number(a.display_order || 0) - Number(b.display_order || 0) || String(a.name).localeCompare(String(b.name));
  };
}

function formSectionStyle() {
  return {
    display: "grid",
    gap: 11,
    padding: 14,
    borderRadius: 13,
    background: C.soft,
    border: `1px solid ${C.divider}`,
  };
}

function sectionTitleStyle() {
  return {
    color: C.gold,
    fontSize: 9,
    fontWeight: 760,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  };
}
