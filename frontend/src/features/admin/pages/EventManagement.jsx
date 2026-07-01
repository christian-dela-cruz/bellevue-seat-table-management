import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Image as ImageIcon,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  AlertTriangle,
  Upload,
  X,
  LayoutTemplate
} from "lucide-react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import Sidebar from "../../../components/layout/Sidebar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import { eventAPI } from "../../../services/eventAPI";
import { venueAPI } from "../../../services/venueAPI";
import { authAPI } from "../../../services/authAPI";
import { useAdminTheme, C, F } from "../../../context/AdminThemeContext";
import ImageUploaderCropper from "../../../components/ImageUploaderCropper";
import BellevueDateTimePicker from "../../../components/BellevueDateTimePicker";



const DEFAULT_FORM = {
  title: "",
  slug: "",
  venue_id: "",
  description: "",
  banner_image: "",
  start_datetime: "",
  end_datetime: "",
  status: "draft",
};

function Spinner({ color = "#8C6B2A", size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "eventSpin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function formatDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return "N/A";
  // Force local time parsing by removing Z and T, e.g., "2026-06-20 17:00:00"
  const safeDateStr = dateStr.replace('T', ' ').replace('Z', '').split('.')[0];
  const d = new Date(safeDateStr);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function DeleteConfirmModal({ event, loading, onCancel, onConfirm }) {
  if (!event) return null;
  return (
    <div className="event-confirm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: 18, background: "rgba(24,20,14,0.34)", backdropFilter: "blur(3px)", animation: "modalFadeIn 200ms ease" }}>
      <section className="event-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-event-title" style={{ width: "min(420px, 100%)", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 26px 70px rgba(24,20,14,0.24)", padding: 20, animation: "modalIn 250ms cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: C.redFaint, color: C.red }}>
            <Trash2 size={18} />
          </span>
          <div>
            <h2 id="delete-event-title" style={{ margin: 0, fontSize: 18, lineHeight: 1.25, color: C.text, fontWeight: 650 }}>Delete Event?</h2>
            <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: C.muted }}>Are you sure you want to delete <strong>{event.title}</strong>? This action cannot be undone.</p>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }}>
          <button type="button" disabled={loading} onClick={onCancel} style={{ minHeight: 34, border: `1px solid ${C.border}`, borderRadius: 9, background: C.surface, color: C.muted, padding: "0 11px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", cursor: "pointer" }}>Cancel</button>
          <button type="button" disabled={loading} onClick={onConfirm} style={{ minHeight: 34, border: "none", borderRadius: 9, background: C.red, color: "#fff", padding: "0 11px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", cursor: "pointer", minWidth: 118 }}>
            {loading ? "Working..." : "Delete Event"}
          </button>
        </div>
      </section>
    </div>
  );
}

function SaveFeedbackModal({ type, item, onClose }) {
  if (!item) return null;
  const isDelete = type === "delete";
  return (
    <div className="event-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: 18, background: "rgba(24,20,14,0.34)", backdropFilter: "blur(3px)", animation: "modalFadeIn 200ms ease" }}>
      <section className="event-confirm" role="dialog" aria-modal="true" aria-labelledby="save-feedback-title" style={{ width: "min(460px, 100%)", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 24px 60px rgba(24,20,14,0.18)", padding: "26px 28px", animation: "modalIn 250ms cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
          <span style={{ width: 44, height: 44, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: isDelete ? "linear-gradient(135deg, rgba(160,56,56,0.08), rgba(160,56,56,0.15))" : "linear-gradient(135deg, rgba(46,122,90,0.08), rgba(46,122,90,0.15))", color: isDelete ? C.red : C.green }}>
            {isDelete ? <Trash2 size={24} /> : <CheckCircle2 size={24} />}
          </span>
          <div>
            <h2 id="save-feedback-title" style={{ margin: 0, fontSize: 18, lineHeight: 1.25, color: C.text, fontWeight: 700, fontFamily: F.label, letterSpacing: "-0.01em" }}>
              {type === "create" ? "Event Created" 
               : type === "update" ? "Event Updated"
               : "Event Deleted"}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.5, color: C.muted }}>
              {isDelete
               ? "The event has been completely removed from the system."
               : "Changes have been saved successfully and are now reflected in the events list."}
            </p>
          </div>
        </div>

        {!isDelete && (
        <div style={{ marginTop: 22, display: "grid", gap: 14, padding: "16px 0", borderTop: `1px solid ${C.divider}`, borderBottom: `1px solid ${C.divider}` }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ display: "block", fontSize: 8.5, fontWeight: 750, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase" }}>Event Title</span>
              <strong style={{ display: "block", marginTop: 3, color: C.text, fontSize: 12.5, fontWeight: 650 }}>{item.title}</strong>
            </div>
            <div>
              <span style={{ display: "block", fontSize: 8.5, fontWeight: 750, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase" }}>Status</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.status === "published" ? C.green : C.muted }} />
                <span style={{ color: C.text, fontSize: 12.5, fontWeight: 600, textTransform: "capitalize" }}>{item.status}</span>
              </span>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={{ display: "block", fontSize: 8.5, fontWeight: 750, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase" }}>Public URL Route</span>
              <span style={{ display: "block", marginTop: 3, color: C.text, fontFamily: "monospace", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                /{item.slug}
              </span>
            </div>
          </div>
        </div>
        )}
        <button type="button" onClick={onClose} style={{ width: "100%", minHeight: 38, border: `1px solid ${C.border}`, borderRadius: 9, background: C.soft, color: C.text, marginTop: 22, padding: "0 11px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", cursor: "pointer" }}>
          Close
        </button>
      </section>
    </div>
  );
}

function resolveEventImage(image) {
  if (!image) return "";
  if (/^(https?:|data:|blob:)/i.test(image)) return image;
  const defaultApiUrl = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:8000/api" : `${window.location.protocol}//${window.location.host}/api`;
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || defaultApiUrl).replace(/\/api\/?$/, "");
  let cleanPath = String(image).replace(/\\/g, "/").replace(/^\/+/, "");
  return `${apiRoot}/${cleanPath}`;
}

export default function EventManagement() {
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

  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [bannerImageFile, setBannerImageFile] = useState(null);
  const [initialForm, setInitialForm] = useState(DEFAULT_FORM);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saveFeedback, setSaveFeedback] = useState(null);
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!drawerOpen || saveFeedback || showDiscardConfirm) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen, form, initialForm, saveFeedback, showDiscardConfirm]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, venuesRes] = await Promise.allSettled([
        eventAPI.getAll(),
        venueAPI.getAll()
      ]);
      
      let parsedEvents = [];
      if (eventsRes.status === 'fulfilled') {
        const eData = eventsRes.value;
        parsedEvents = Array.isArray(eData) 
          ? eData 
          : (eData && Array.isArray(eData.data) ? eData.data : []);
      }
      setEvents(parsedEvents);

      let parsedVenues = [];
      if (venuesRes.status === 'fulfilled') {
        const vData = venuesRes.value;
        parsedVenues = Array.isArray(vData) 
          ? vData 
          : (vData && Array.isArray(vData.data) ? vData.data : []);
      }
      setVenues(parsedVenues);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setInitialForm(DEFAULT_FORM);
    setBannerImageFile(null);
    setDrawerClosing(false);
    setDrawerOpen(true);
  };

  const handleEdit = (ev) => {
    setEditingId(ev.id);
    const startVal = ev.start_datetime && typeof ev.start_datetime === 'string'
      ? ev.start_datetime.slice(0, 16)
      : "";
    const endVal = ev.end_datetime && typeof ev.end_datetime === 'string'
      ? ev.end_datetime.slice(0, 16)
      : "";
    const formData = {
      title: ev.title || "",
      slug: ev.slug || "",
      venue_id: ev.venue_id || "",
      description: ev.description || "",
      banner_image: ev.banner_image || "",
      start_datetime: startVal,
      end_datetime: endVal,
      status: ev.status || "draft",
    };
    setForm(formData);
    setInitialForm(formData);
    setBannerImageFile(null);
    setDrawerClosing(false);
    setDrawerOpen(true);
  };

  const closeDrawer = (forceDiscard = false) => {
    const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(initialForm);
    if (hasUnsavedChanges && !forceDiscard) {
      setShowDiscardConfirm(true);
      return;
    }
    setShowDiscardConfirm(false);
    setDrawerClosing(true);
    setTimeout(() => {
      setDrawerOpen(false);
      setDrawerClosing(false);
    }, 280);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let result;
      if (editingId) {
        result = await eventAPI.update(editingId, form);
      } else {
        result = await eventAPI.create(form);
      }
      
      const eventId = result.data?.id || editingId;
      if (bannerImageFile && eventId) {
        await eventAPI.uploadImage(eventId, bannerImageFile);
      }
      closeDrawer(true);
      setSaveFeedback({ type: editingId ? "update" : "create", item: result?.data || form });
      loadData();
    } catch (err) {
      alert(err.message || "Failed to save event.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await eventAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      setSaveFeedback({ type: "delete", item: deleteTarget });
      loadData();
    } catch (err) {
      alert(err.message || "Failed to delete event.");
    } finally {
      setSaving(false);
    }
  };

  const filteredEvents = events.filter(ev => {
    if (statusFilter !== "all" && ev.status !== statusFilter) return false;
    if (search && !ev.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: C.page, fontFamily: F.body }}>
      <style>{`
        @keyframes eventSpin { to { transform: rotate(360deg); } }
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .event-card { transition: all 0.2s ease; border: 1px solid ${C.border}; }
        .event-card:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(0,0,0,0.06); border-color: rgba(140,107,42,0.3); }
        .drawer-backdrop { opacity: 1; transition: opacity 260ms ease; }
        .drawer-backdrop:not(.closing) { animation: modalFadeIn 220ms ease both; }
        .drawer-panel { opacity: 1; transform: translateX(0); transition: transform 300ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease; }
        .drawer-backdrop:not(.closing) .drawer-panel { animation: slideIn 320ms cubic-bezier(0.22,1,0.36,1) both; }
        .drawer-backdrop.closing { opacity: 0; pointer-events: none; }
        .drawer-backdrop.closing .drawer-panel { opacity: 0; transform: translateX(36px); }
        @keyframes slideIn { from { opacity: 0; transform: translateX(34px); } to { opacity: 1; transform: translateX(0); } }
        .form-input { width: 100%; padding: 10px 12px; border: 1px solid ${C.border}; border-radius: 8px; font-family: ${F.body}; font-size: 13px; color: ${C.text}; background: ${C.surface}; outline: none; transition: border-color 0.2s; }
        .form-input:focus { border-color: ${C.gold}; }
        .form-label { display: block; font-family: ${F.label}; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${C.muted}; margin-bottom: 6px; }
      `}</style>

      <Sidebar activeNav="events" isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", flex: 1, minWidth: 0, overflow: "hidden" }}>
        <AdminNavbar />
        
        <main className="admin-page-content-container">
          <div style={{ display: "grid", gap: 18 }}>
            <AdminPageHeader 
              eyebrow="Event Engine"
              title="Event Management" 
              description="Create and publish special events. Events inherit parent venue floor plans while having unique dates and capacities." 
              C={C}
              F={F}
              actions={
                <button type="button" onClick={handleCreate} style={{ height: 40, padding: "0 14px", border: `1px solid rgba(140,107,42,0.20)`, borderRadius: 9, background: C.gold, color: "#fff", fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 2px 8px rgba(140,107,42,0.10)" }}>
                  <Plus size={14} /> New Event
                </button>
              }
            />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", background: C.surface, padding: 12, borderRadius: 12, border: `1px solid ${C.border}` }}>
              <div style={{ position: "relative", flex: "1 1 240px" }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
                <input 
                  type="text" 
                  placeholder="Search events..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px 10px 36px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, outline: "none", background: C.soft }}
                />
              </div>
              <div style={{ display: "flex", background: C.soft, padding: 4, borderRadius: 8, border: `1px solid ${C.border}` }}>
                {["all", "draft", "published", "cancelled"].map(status => (
                  <button 
                    key={status} 
                    onClick={() => setStatusFilter(status)}
                    style={{ padding: "6px 16px", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, background: statusFilter === status ? C.surface : "transparent", color: statusFilter === status ? C.text : C.muted, boxShadow: statusFilter === status ? "0 1px 4px rgba(0,0,0,0.06)" : "none", cursor: "pointer", textTransform: "capitalize" }}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: 60, textAlign: "center", color: C.muted }}>
                <Spinner size={32} color={C.gold} />
              </div>
            ) : filteredEvents.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center", background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
                <div style={{ width: 48, height: 48, background: C.soft, borderRadius: 24, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
                  <LayoutTemplate size={24} />
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: 16, color: C.text }}>No events found</h3>
                <p style={{ margin: 0, fontSize: 13, color: C.muted }}>{search ? "Try adjusting your filters." : "Create your first event to get started."}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
                {Array.isArray(filteredEvents) && filteredEvents.map(ev => {
                  if (!ev) return null;
                  const isPublished = ev.status === "published";
                  const isCancelled = ev.status === "cancelled";
                  const statusColor = isPublished ? C.green : isCancelled ? C.red : C.muted;
                  const statusBg = isPublished ? C.greenFaint : isCancelled ? C.redFaint : C.soft;
                  
                  return (
                    <div key={ev.id} className="event-card" style={{ background: C.surface, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <div style={{ height: 120, background: C.soft, backgroundImage: `url(${resolveEventImage(ev.banner_image)})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
                        {!ev.banner_image && <ImageIcon size={24} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: C.border }} />}
                        <div style={{ position: "absolute", top: 12, right: 12, padding: "4px 8px", background: statusBg, color: statusColor, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", borderRadius: 6, backdropFilter: "blur(4px)" }}>
                          {ev.status}
                        </div>
                      </div>
                      <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column" }}>
                        <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                          {ev.venue?.name || "No Venue Assigned"}
                        </div>
                        <h3 style={{ margin: "0 0 12px", fontSize: 16, color: C.text, lineHeight: 1.3 }}>{ev.title}</h3>
                        
                        <div style={{ display: "grid", gap: 6, marginTop: "auto" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.muted }}>
                            <CalendarDays size={14} />
                            {formatDate(ev.start_datetime)}
                          </div>
                        </div>
                        
                        <div style={{ display: "flex", gap: 8, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.divider}` }}>
                          <button onClick={() => handleEdit(ev)} style={{ flex: 1, padding: "8px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.text, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                            <Edit3 size={14} /> Edit
                          </button>
                          <button onClick={() => setDeleteTarget(ev)} style={{ padding: "8px 12px", border: `1px solid ${C.redFaint}`, borderRadius: 8, background: C.surface, color: C.red, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {drawerOpen && createPortal((
        <div className={`drawer-backdrop ${drawerClosing ? "closing" : ""}`} style={{ position: "fixed", inset: 0, background: "rgba(24,20,14,0.42)", backdropFilter: "blur(2px)", zIndex: 9999 }}>
          <div style={{ position: "absolute", inset: 0 }} onClick={() => closeDrawer()} />
          <div className="drawer-panel" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: C.surface, boxShadow: "-8px 0 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: `1px solid ${C.divider}` }}>
              <h2 style={{ margin: 0, fontSize: 18, color: C.text }}>{editingId ? "Edit Event" : "Create Event"}</h2>
              <button onClick={() => closeDrawer()} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
              
              <div>
                <label className="form-label">Event Title</label>
                <input required type="text" className="form-input" value={form.title} onChange={e => {
                  const val = e.target.value;
                  setForm(f => ({ ...f, title: val, slug: !editingId ? val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : f.slug }));
                }} placeholder="e.g. New Year's Eve Gala" />
              </div>

              <div>
                <label className="form-label">URL Slug</label>
                <input required type="text" className="form-input" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="new-years-eve" />
              </div>

              <div>
                <label className="form-label">Host Venue</label>
                <select required className="form-input" value={form.venue_id} onChange={e => setForm(f => ({ ...f, venue_id: e.target.value }))}>
                  <option value="" disabled>Select a physical venue</option>
                  {Array.isArray(venues) && venues.map(v => v && (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: C.muted }}>The event will inherit the seat map and structure of this venue.</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label">Start Date & Time</label>
                  <BellevueDateTimePicker
                    required
                    value={form.start_datetime}
                    onChange={(val) => setForm((f) => ({ ...f, start_datetime: val }))}
                    placeholder="Select start date & time"
                  />
                </div>
                <div>
                  <label className="form-label">End Date & Time</label>
                  <BellevueDateTimePicker
                    required
                    value={form.end_datetime}
                    onChange={(val) => setForm((f) => ({ ...f, end_datetime: val }))}
                    placeholder="Select end date & time"
                  />
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <ImageUploaderCropper 
                  value={form.banner_image}
                  onChange={(file) => {
                    setBannerImageFile(file);
                    if (file) {
                      setForm(f => ({ ...f, banner_image: "" }));
                    }
                  }}
                  aspect={16 / 9}
                  title="Banner Image"
                  description="Drag & drop a banner image here or click to upload"
                />
              </div>

              <div>
                <label className="form-label">Description (Optional)</label>
                <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of the event..." />
              </div>

              <div>
                <label className="form-label">Status</label>
                <select required className="form-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="draft">Draft (Hidden from public)</option>
                  <option value="published">Published (Visible & bookable)</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div style={{ borderTop: `1px solid ${C.divider}`, margin: "10px -24px", padding: "20px 24px" }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <button type="button" onClick={() => closeDrawer()} style={{ flex: 1, padding: "12px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.text, fontFamily: F.label, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>Cancel</button>
                  <button type="submit" disabled={saving} style={{ flex: 1, padding: "12px", border: "none", borderRadius: 8, background: C.gold, color: "#fff", fontFamily: F.label, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: saving ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {saving && <Spinner color="#fff" size={14} />}
                    {editingId ? "Save Changes" : "Create Event"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ), document.body)}

      <DeleteConfirmModal event={deleteTarget} loading={saving} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      
      {showDiscardConfirm && (
        <div className="event-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDiscardConfirm(false); }} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: 18, background: "rgba(24,20,14,0.34)", backdropFilter: "blur(3px)", animation: "modalFadeIn 200ms ease" }}>
          <section className="event-confirm" role="dialog" aria-modal="true" aria-labelledby="discard-changes-title" style={{ width: "min(420px, 100%)", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 26px 70px rgba(24,20,14,0.24)", padding: 20, animation: "modalIn 250ms cubic-bezier(0.22,1,0.36,1)" }}>
            <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: C.redFaint, color: C.red }}>
                <AlertTriangle size={18} />
              </span>
              <div>
                <h2 id="discard-changes-title" style={{ margin: 0, fontSize: 18, lineHeight: 1.25, color: C.text, fontWeight: 650 }}>Discard unsaved changes?</h2>
                <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: C.muted }}>You have unsaved event configuration changes. Leaving now will discard them.</p>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }}>
              <button type="button" onClick={() => setShowDiscardConfirm(false)} style={{ minHeight: 34, border: `1px solid ${C.border}`, borderRadius: 9, background: C.surface, color: C.muted, padding: "0 11px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", cursor: "pointer" }}>Keep Editing</button>
              <button type="button" onClick={() => closeDrawer(true)} style={{ minHeight: 34, border: "none", borderRadius: 9, background: C.gold, color: "#fff", padding: "0 11px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", cursor: "pointer", minWidth: 140 }}>
                Discard Changes
              </button>
            </div>
          </section>
        </div>
      )}

      <SaveFeedbackModal type={saveFeedback?.type} item={saveFeedback?.item} onClose={() => setSaveFeedback(null)} />

    </div>
  );
}
