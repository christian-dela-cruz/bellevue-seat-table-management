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
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function DeleteConfirmModal({ event, loading, onCancel, onConfirm }) {
  if (!event) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(24,20,14,0.42)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "min(400px,100%)", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", overflow: "hidden", animation: "modalIn 200ms ease" }}>
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.divider}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.red, marginBottom: 8 }}>
            <AlertTriangle size={18} />
            <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>Delete Event</div>
          </div>
          <h3 style={{ margin: 0, fontSize: 18, lineHeight: 1.2, color: C.text }}>Delete {event.title}?</h3>
        </div>
        <div style={{ padding: 20, display: "grid", gap: 14 }}>
          <p style={{ margin: 0, color: C.muted, fontSize: 13, lineHeight: 1.55 }}>
            Are you sure you want to delete this event? This action cannot be undone. Associated reservations may lose their event link.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 8 }}>
            <button type="button" onClick={onCancel} disabled={loading} style={{ minWidth: 100, padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.muted, fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer" }}>Cancel</button>
            <button type="button" onClick={onConfirm} disabled={loading} style={{ minWidth: 130, padding: "10px 14px", border: "none", borderRadius: 8, background: C.red, color: "#fff", fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? <Spinner color="#FFFFFF" size={12} /> : <Trash2 size={14} />} Delete Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveFeedbackModal({ type, item, onClose }) {
  if (!item) return null;
  const isDelete = type === "delete";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(24,20,14,0.42)", backdropFilter: "blur(2px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "modalFadeIn 200ms ease" }}>
      <div style={{ width: "min(340px,100%)", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 24px 80px rgba(0,0,0,0.22)", overflow: "hidden", textAlign: "center", animation: "modalIn 250ms cubic-bezier(0.22,1,0.36,1)" }}>
        <div style={{ padding: "32px 24px" }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: isDelete ? C.redFaint : C.greenFaint, color: isDelete ? C.red : C.green, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            {isDelete ? <Trash2 size={24} /> : <CheckCircle2 size={24} />}
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, color: C.text }}>Event {isDelete ? "Deleted" : "Saved"}</h3>
          <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
            {isDelete ? `"${item.title}" has been permanently removed.` : `"${item.title}" was saved successfully.`}
          </p>
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${C.divider}`, background: C.soft }}>
          <button onClick={onClose} style={{ width: "100%", padding: "12px", border: "none", borderRadius: 8, background: C.gold, color: "#fff", fontFamily: F.label, fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>Continue</button>
        </div>
      </div>
    </div>
  );
}

export default function EventManagement() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saveFeedback, setSaveFeedback] = useState(null);
  
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, venuesRes] = await Promise.allSettled([
        eventAPI.getAll(),
        venueAPI.getAll()
      ]);
      setEvents(eventsRes.status === 'fulfilled' ? (eventsRes.value.data || []) : []);
      if (venuesRes.status === 'fulfilled') {
        const vData = venuesRes.value;
        setVenues(Array.isArray(vData) ? vData : (vData && vData.data ? vData.data : []));
      } else {
        setVenues([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setDrawerClosing(false);
    setDrawerOpen(true);
  };

  const handleEdit = (ev) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title || "",
      slug: ev.slug || "",
      venue_id: ev.venue_id || "",
      description: ev.description || "",
      banner_image: ev.banner_image || "",
      start_datetime: ev.start_datetime ? ev.start_datetime.substring(0, 16) : "",
      end_datetime: ev.end_datetime ? ev.end_datetime.substring(0, 16) : "",
      status: ev.status || "draft",
    });
    setDrawerClosing(false);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
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
      if (editingId) {
        await eventAPI.update(editingId, form);
      } else {
        await eventAPI.create(form);
      }
      closeDrawer();
      setSaveFeedback({ type: editingId ? "update" : "create", item: form });
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
    <div style={{ minHeight: "100vh", background: C.page, fontFamily: F.body }}>
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

      <AdminNavbar />
      <div style={{ display: "flex", height: "calc(100vh - 60px)", minHeight: 0, overflow: "hidden" }}>
        <Sidebar activeNav="events" isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        
        <main style={{ flex: 1, padding: "30px 32px 42px", overflow: "auto", height: "calc(100vh - 60px)" }}>
          <div style={{ maxWidth: 1440, margin: "0 auto", display: "grid", gap: 18 }}>
            <AdminPageHeader 
              eyebrow="Event Engine"
              title="Event Management" 
              description="Create and publish special events. Events inherit parent venue floor plans while having unique dates and capacities." 
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
                {filteredEvents.map(ev => {
                  const isPublished = ev.status === "published";
                  const isCancelled = ev.status === "cancelled";
                  const statusColor = isPublished ? C.green : isCancelled ? C.red : C.muted;
                  const statusBg = isPublished ? C.greenFaint : isCancelled ? C.redFaint : C.soft;
                  
                  return (
                    <div key={ev.id} className="event-card" style={{ background: C.surface, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <div style={{ height: 120, background: C.soft, backgroundImage: `url(${ev.banner_image})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
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
          <div style={{ position: "absolute", inset: 0 }} onClick={closeDrawer} />
          <div className="drawer-panel" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "min(480px, 100vw)", background: C.surface, boxShadow: "-8px 0 32px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
            
            <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: C.soft }}>
              <div>
                <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: C.gold, marginBottom: 4 }}>
                  {editingId ? "Edit Configuration" : "New Configuration"}
                </div>
                <h2 style={{ margin: 0, fontSize: 18, color: C.text }}>{editingId ? "Edit Event" : "Create Event"}</h2>
              </div>
              <button onClick={closeDrawer} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}>
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
                  {venues.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: C.muted }}>The event will inherit the seat map and structure of this venue.</p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="form-label">Start Date & Time</label>
                  <input required type="datetime-local" className="form-input" value={form.start_datetime} onChange={e => setForm(f => ({ ...f, start_datetime: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">End Date & Time</label>
                  <input required type="datetime-local" className="form-input" value={form.end_datetime} onChange={e => setForm(f => ({ ...f, end_datetime: e.target.value }))} />
                </div>
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
                  <button type="button" onClick={closeDrawer} style={{ flex: 1, padding: "12px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.text, fontFamily: F.label, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>Cancel</button>
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
      <SaveFeedbackModal type={saveFeedback?.type} item={saveFeedback?.item} onClose={() => setSaveFeedback(null)} />

    </div>
  );
}
