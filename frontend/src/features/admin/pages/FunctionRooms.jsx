import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  Layers,
  Plus,
  Search,
  SlidersHorizontal,
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
};

function normalizeRoom(room = {}) {
  return {
    ...emptyForm,
    ...room,
    parent_id: room.parent_id ? String(room.parent_id) : "",
    capacity: room.capacity ?? 0,
    display_order: room.display_order ?? 0,
    display_name: room.display_name || room.name || "",
    slug: room.slug || "",
    image: room.image || "",
    reservation_route: room.reservation_route || "",
    image_position: room.image_position || "center 50%",
  };
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
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ status: "all", visibility: "all", wing: "all", landing: "all" });
  const [sortBy, setSortBy] = useState("display_order");
  const canManage = authAPI.hasPermission("manage_venues");

  const loadRooms = async () => {
    setLoading(true);
    try {
      const data = await venueAPI.getAll({ type: "function_room" });
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load function rooms.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRooms(); }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
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
  }, [drawerOpen]);

  const uniqueRooms = useMemo(() => {
    const seen = new Set();
    return rooms.filter((room) => {
      const key = room.slug || canonical(room.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rooms]);

  const parentRooms = useMemo(() => uniqueRooms.filter((room) => !room.parent_id), [uniqueRooms]);
  const childrenByParent = useMemo(() => {
    const map = new Map();
    uniqueRooms.forEach((room) => {
      if (!room.parent_id) return;
      const key = Number(room.parent_id);
      map.set(key, [...(map.get(key) || []), room]);
    });
    map.forEach((items, key) => {
      map.set(key, items.sort(compareRooms("display_order")));
    });
    return map;
  }, [uniqueRooms]);

  const duplicateCount = Math.max(0, rooms.length - uniqueRooms.length);

  const roomMatches = (room, query) => {
    const matchesSearch = !query || [room.name, room.display_name, room.slug, room.wing].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = filters.status === "all" || (filters.status === "enabled" ? room.is_active : !room.is_active);
    const matchesVisibility = filters.visibility === "all" || (filters.visibility === "visible" ? room.is_visible : !room.is_visible);
    const matchesLanding = filters.landing === "all" || (filters.landing === "shown" ? room.show_on_landing : !room.show_on_landing);
    const matchesWing = filters.wing === "all" || room.wing === filters.wing;
    return matchesSearch && matchesStatus && matchesVisibility && matchesLanding && matchesWing;
  };

  const groupedRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const parents = parentRooms.sort(compareRooms(sortBy));
    const rows = [];
    const usedChildren = new Set();

    parents.forEach((parent) => {
      const children = childrenByParent.get(Number(parent.id)) || [];
      const matchingChildren = children.filter((child) => roomMatches(child, query));
      const parentMatches = roomMatches(parent, query);
      if (!parentMatches && matchingChildren.length === 0) return;

      rows.push({ room: parent, level: 0, childCount: children.length });
      matchingChildren.forEach((child) => {
        usedChildren.add(child.id);
        rows.push({ room: child, level: 1, childCount: 0, parent });
      });
    });

    uniqueRooms
      .filter((room) => room.parent_id && !usedChildren.has(room.id) && roomMatches(room, query))
      .sort(compareRooms(sortBy))
      .forEach((room) => rows.push({ room, level: 1, childCount: 0 }));

    if (sortBy === "parent_first") return rows;
    return rows;
  }, [uniqueRooms, parentRooms, childrenByParent, search, filters, sortBy]);

  const stats = {
    total: uniqueRooms.length,
    enabled: uniqueRooms.filter((room) => room.is_active).length,
    visible: uniqueRooms.filter((room) => room.is_visible && room.show_on_landing).length,
    grouped: uniqueRooms.filter((room) => room.parent_id).length,
  };

  const beginCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setError("");
    setDrawerOpen(true);
  };

  const beginEdit = (room) => {
    setEditing(room);
    setForm(normalizeRoom(room));
    setImageFile(null);
    setError("");
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setError("");
  };

  const updateForm = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "name" && !editing) {
        next.slug = slugify(value);
        next.display_name = value;
      }
      return next;
    });
  };

  const validate = () => {
    if (!form.name.trim()) return "Room name is required.";
    if (!form.slug.trim()) return "Room slug/code is required.";
    if (form.parent_id && editing && String(form.parent_id) === String(editing.id)) return "A room cannot be its own parent.";
    if (Number.isNaN(Number(form.display_order))) return "Display order must be numeric.";
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
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        capacity: Number(form.capacity || 0),
        display_order: Number(form.display_order || 0),
        display_name: form.display_name || form.name,
      };
      const saved = editing ? await venueAPI.update(editing.id, payload) : await venueAPI.create(payload);
      if (imageFile) await venueAPI.uploadImage(saved.id, imageFile);
      await loadRooms();
      setToast(editing ? "Function room updated." : "Function room created.");
      closeDrawer();
    } catch (err) {
      const messages = err.data?.errors ? Object.values(err.data.errors).flat().join(" ") : "";
      setError(messages || err.message || "Unable to save function room.");
    } finally {
      setSaving(false);
    }
  };

  const toggleRoom = async (room, key) => {
    if (!canManage) return;
    await venueAPI.update(room.id, { [key]: !room[key] });
    await loadRooms();
  };

  const preview = imageFile ? URL.createObjectURL(imageFile) : imageUrl(form.image);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .function-room-row { transition: background 0.14s ease; }
        .function-room-row:hover { background: rgba(140,107,42,0.032); }
        .function-room-action:hover { border-color: rgba(140,107,42,0.28) !important; color: ${C.gold} !important; transform: translateY(-1px); }
        .function-room-drawer-backdrop { animation: drawerFade 0.18s ease both; }
        .function-room-drawer { animation: drawerSlide 0.24s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes drawerFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes drawerSlide { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
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
            title="Function Room Management"
            description="Configure function rooms, grouped sub-rooms, photos, visibility, and reservation availability."
            C={C}
            F={F}
            actions={canManage && (
              <button type="button" onClick={beginCreate} style={{ ...buttonBase(), minHeight: 40, border: "none", background: C.gold, color: "#fff", padding: "0 14px" }}>
                <Plus size={14} /> New Room
              </button>
            )}
          />

          {toast && <div style={{ marginBottom: 14, padding: "9px 12px", borderRadius: 10, background: C.greenFaint, color: C.green, border: "1px solid rgba(46,122,90,0.16)", fontSize: 12.5 }}>{toast}</div>}
          {error && !drawerOpen && <div style={{ marginBottom: 14, padding: "9px 12px", borderRadius: 10, background: C.redFaint, color: C.red, border: "1px solid rgba(160,56,56,0.16)", fontSize: 12.5 }}>{error}</div>}

          <div className="function-room-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
            <SummaryCard icon={Layers} label="Configured Rooms" value={stats.total} />
            <SummaryCard icon={CheckCircle2} label="Enabled" value={stats.enabled} tone="green" />
            <SummaryCard icon={Eye} label="Landing Visible" value={stats.visible} tone="gold" />
            <SummaryCard icon={SlidersHorizontal} label="Sub-Rooms" value={stats.grouped} tone="green" />
          </div>

          {duplicateCount > 0 && (
            <div style={{ marginBottom: 14, padding: "9px 12px", borderRadius: 10, background: C.goldFaint, color: C.gold, border: "1px solid rgba(140,107,42,0.16)", fontSize: 12.5 }}>
              {duplicateCount} duplicate room record{duplicateCount > 1 ? "s are" : " is"} hidden from this workspace and the guest landing renderer.
            </div>
          )}

          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
            <div className="function-room-toolbar" style={{ display: "grid", gridTemplateColumns: "minmax(240px,1fr) repeat(5, minmax(128px, auto))", gap: 10, padding: 14, borderBottom: `1px solid ${C.divider}`, background: C.soft }}>
              <div style={{ position: "relative" }}>
                <Search size={15} style={{ position: "absolute", left: 11, top: 12, color: C.faint }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search rooms, slugs, wings" style={{ ...inputStyle(), paddingLeft: 34 }} />
              </div>
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
                <option value="Main Wing">Main Wing</option>
                <option value="Tower Wing">Tower Wing</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={inputStyle()}>
                <option value="display_order">Display order</option>
                <option value="parent_first">Parent rooms first</option>
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
                    {["Room Structure", "Status", "Display Settings", "Order", "Actions"].map((header) => (
                      <th key={header} style={{ padding: "11px 14px", textAlign: "left", color: C.faint, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", borderBottom: `1px solid ${C.divider}` }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} style={{ padding: 22, color: C.muted }}>Loading function rooms...</td></tr>
                  ) : groupedRows.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: 22, color: C.muted }}>No function rooms match the current filters.</td></tr>
                  ) : groupedRows.map(({ room, level, childCount, parent }) => (
                    <tr key={`${room.id}-${level}`} className="function-room-row" style={{ background: level ? "rgba(250,248,244,0.52)" : C.surface }}>
                      <td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.divider}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: level ? 26 : 0 }}>
                          {level ? (
                            <span style={{ width: 14, color: C.faint, display: "inline-flex", justifyContent: "center" }}><ChevronRight size={14} /></span>
                          ) : null}
                          <div style={{ width: level ? 48 : 58, height: level ? 34 : 40, borderRadius: 9, background: C.soft, overflow: "hidden", flexShrink: 0, border: `1px solid ${C.border}` }}>
                            {room.image ? <img src={imageUrl(room.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Camera size={17} style={{ margin: level ? 8 : 10, color: C.faint }} />}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <strong style={{ color: C.text, fontSize: level ? 12.5 : 13.5, fontWeight: level ? 560 : 640, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{room.display_name || room.name}</strong>
                              {!level && <Badge tone="gold" compact>{childCount ? `${childCount} sub-room${childCount > 1 ? "s" : ""}` : "Parent"}</Badge>}
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
                        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                          <button className="function-room-action" type="button" onClick={() => beginEdit(room)} style={{ ...buttonBase(), color: C.gold }} title="Edit room"><Edit3 size={14} /> Edit</button>
                          <button className="function-room-action" type="button" disabled={!canManage} onClick={() => toggleRoom(room, "is_active")} style={buttonBase()} title={room.is_active ? "Disable room" : "Enable room"}>{room.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}</button>
                          <button className="function-room-action" type="button" disabled={!canManage} onClick={() => toggleRoom(room, "is_visible")} style={buttonBase()} title={room.is_visible ? "Hide room" : "Show room"}>{room.is_visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
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

      {drawerOpen && (
        <div className="function-room-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }} style={{ position: "fixed", inset: 0, zIndex: 7000, background: "rgba(24,20,14,0.28)", display: "flex", justifyContent: "flex-end", backdropFilter: "blur(2px)" }}>
          <aside className="function-room-drawer" role="dialog" aria-modal="true" aria-label={editing ? "Edit function room" : "Create function room"} style={{ width: "min(520px, calc(100vw - 28px))", height: "100%", background: C.surface, borderLeft: `1px solid ${C.border}`, boxShadow: "0 24px 70px rgba(24,20,14,0.22)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ color: C.gold, fontSize: 8.5, fontWeight: 750, letterSpacing: "0.16em", textTransform: "uppercase" }}>Configuration</div>
                <h2 style={{ margin: "5px 0 0", color: C.text, fontSize: 21, lineHeight: 1.15, fontWeight: 640 }}>{editing ? "Edit Function Room" : "Create Function Room"}</h2>
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
                  <div style={sectionTitleStyle()}>Room Identity</div>
                  <Field label="Room Name"><input value={form.name} onChange={(e) => updateForm("name", e.target.value)} style={inputStyle()} /></Field>
                  <Field label="Customer Display Name"><input value={form.display_name} onChange={(e) => updateForm("display_name", e.target.value)} style={inputStyle()} /></Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 0.6fr", gap: 10 }}>
                    <Field label="Slug / Code"><input value={form.slug} onChange={(e) => updateForm("slug", slugify(e.target.value))} style={inputStyle()} /></Field>
                    <Field label="Order"><input type="number" min="0" value={form.display_order} onChange={(e) => updateForm("display_order", e.target.value)} style={inputStyle()} /></Field>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="Wing"><select value={form.wing} onChange={(e) => updateForm("wing", e.target.value)} style={inputStyle()}><option>Main Wing</option><option>Tower Wing</option></select></Field>
                    <Field label="Capacity"><input type="number" min="0" value={form.capacity} onChange={(e) => updateForm("capacity", e.target.value)} style={inputStyle()} /></Field>
                  </div>
                </section>

                <section style={formSectionStyle()}>
                  <div style={sectionTitleStyle()}>Grouping & Reservation</div>
                  <Field label="Parent Room" hint="Leave empty for a main room. Select a parent to create a child chip under that room.">
                    <select value={form.parent_id} onChange={(e) => updateForm("parent_id", e.target.value)} style={inputStyle()}>
                      <option value="">No parent room</option>
                      {parentRooms.filter((room) => !editing || room.id !== editing.id).map((room) => <option key={room.id} value={room.id}>{room.display_name || room.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Reservation Route"><input value={form.reservation_route} onChange={(e) => updateForm("reservation_route", e.target.value)} placeholder="/tower1" style={inputStyle()} /></Field>
                  <Field label="Description"><textarea value={form.description || ""} onChange={(e) => updateForm("description", e.target.value)} rows={3} style={{ ...inputStyle(), resize: "vertical" }} /></Field>
                </section>

                <section style={formSectionStyle()}>
                  <div style={sectionTitleStyle()}>Availability Settings</div>
                  {[
                    ["is_active", "Enabled"],
                    ["is_visible", "Visible in admin and guest surfaces"],
                    ["show_on_landing", "Show on landing page"],
                    ["reservations_enabled", "Allow guest reservations"],
                    ["parent_selectable", "Parent room selectable"],
                    ["child_selectable", "Child rooms selectable"],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: C.text }}>
                      {label}
                      <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => updateForm(key, e.target.checked)} style={{ accentColor: C.gold }} />
                    </label>
                  ))}
                </section>
              </div>

              <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.divider}`, background: C.soft, display: "flex", justifyContent: "flex-end", gap: 9 }}>
                <button type="button" onClick={closeDrawer} disabled={saving} style={buttonBase()}>Cancel</button>
                <button type="submit" disabled={!canManage || saving} style={{ ...buttonBase(), minWidth: 150, border: "none", background: canManage ? C.gold : C.faint, color: "#fff", cursor: canManage && !saving ? "pointer" : "not-allowed" }}>
                  {saving ? "Saving..." : editing ? "Save Changes" : "Create Room"}
                </button>
              </div>
            </form>
          </aside>
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
