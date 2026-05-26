import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Clock, Mail, Phone, User, Users } from "lucide-react";
import bellevueLogo from "../../../assets/bellevue-logo.png";
import { reservationAPI } from "../../../services/reservationAPI";
import { venueAPI } from "../../../services/venueAPI";

const C = {
  page: "#111009",
  surface: "#17140E",
  soft: "rgba(255,255,255,0.045)",
  border: "rgba(201,168,76,0.16)",
  gold: "#C9A84C",
  goldDark: "#8C6B2A",
  text: "#F8F3E8",
  muted: "rgba(248,243,232,0.68)",
  faint: "rgba(248,243,232,0.42)",
  red: "#C96E6E",
  green: "#63B08D",
};

function imageUrl(image) {
  if (!image) return "";
  if (/^(https?:|data:|blob:)/i.test(image)) return image;
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");
  if (String(image).startsWith("/")) return `${apiRoot}${image}`;
  if (String(image).includes("/")) return `${apiRoot}/${String(image).replace(/^\/+/, "")}`;
  return `${apiRoot}/images/${image}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function routeKey(value) {
  return String(value || "").replace(/^\/+/, "").toLowerCase();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function Field({ label, icon: Icon, children }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={{ color: C.gold, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 7 }}>
        {Icon && <Icon size={13} />}
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle() {
  return {
    width: "100%",
    minHeight: 44,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    background: "rgba(255,255,255,0.07)",
    color: C.text,
    padding: "10px 12px",
    fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
    fontSize: 14,
    outline: "none",
  };
}

function findVenueByRoute(venues, slug) {
  const key = routeKey(slug);
  return venues.find((venue) => routeKey(venue.reservation_route) === key)
    || venues.find((venue) => routeKey(venue.reservation_route).split("/").pop() === key)
    || venues.find((venue) => routeKey(venue.slug) === key)
    || venues.find((venue) => slugify(venue.display_name || venue.name) === key)
    || null;
}

export default function DynamicVenueReservation() {
  const navigate = useNavigate();
  const { venueSlug } = useParams();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [date, setDate] = useState(today());
  const [guests, setGuests] = useState(2);
  const [slots, setSlots] = useState([]);
  const [slotMessage, setSlotMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    event_time: "",
    special_requests: "",
    event_area: "",
    setup_tables: "",
    setup_chairs: "",
    setup_requirements: "",
  });

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    venueAPI.getAll({ include_archived: false, _t: Date.now() })
      .then((rows) => {
        if (!mounted) return;
        setVenues(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (mounted) setError("Unable to load venue configuration.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const venue = useMemo(() => findVenueByRoute(venues, venueSlug), [venues, venueSlug]);
  const roomChoices = useMemo(() => {
    if (!venue) return [];
    const activeChildren = (venue.children || [])
      .filter((child) => child.is_active && child.is_visible && child.reservations_enabled && child.child_selectable !== false)
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    const choices = venue.parent_selectable !== false ? [venue] : [];
    return [...choices, ...activeChildren];
  }, [venue]);

  const selectedRoom = useMemo(() => {
    if (!venue) return null;
    return roomChoices.find((room) => String(room.id) === String(selectedRoomId)) || roomChoices[0] || venue;
  }, [roomChoices, selectedRoomId, venue]);

  useEffect(() => {
    if (!roomChoices.length) return;
    setSelectedRoomId((current) => current || String(roomChoices[0].id));
  }, [roomChoices]);

  useEffect(() => {
    if (!selectedRoom || !date) return;
    let mounted = true;
    setSlotMessage("Loading available times...");
    venueAPI.getTimeSlots({ venue_id: selectedRoom.id, room: selectedRoom.name, date, guests })
      .then((data) => {
        if (!mounted) return;
        const nextSlots = Array.isArray(data?.slots) ? data.slots : [];
        setSlots(nextSlots);
        setSlotMessage(data?.message || (nextSlots.length ? "" : "No reservation times are configured for this date."));
        const firstAvailable = nextSlots.find((slot) => slot.available);
        setForm((current) => ({
          ...current,
          event_time: firstAvailable?.time || "",
        }));
      })
      .catch((err) => {
        if (!mounted) return;
        setSlots([]);
        setSlotMessage(err.message || "Unable to load time slots for this venue.");
        setForm((current) => ({ ...current, event_time: "" }));
      });
    return () => { mounted = false; };
  }, [selectedRoom, date, guests]);

  const unavailable = !venue || !venue.is_active || !venue.is_visible || !venue.reservations_enabled || !roomChoices.length;
  const image = imageUrl(venue?.image);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess(null);
    if (!venue || !selectedRoom || unavailable) {
      setError("This venue is not available for reservation.");
      return;
    }
    if (!form.event_time) {
      setError("Please select an available reservation time.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        venue_id: venue.parent_id || venue.id,
        room: selectedRoom.name,
        table_number: "GENERAL",
        seat_number: "",
        guests_count: Number(guests || 1),
        event_date: date,
        event_time: form.event_time,
        special_requests: form.special_requests,
        type: "whole",
        ...(venue.type !== "dining" ? {
          event_area: form.event_area || "",
          setup_tables: form.setup_tables ? Number(form.setup_tables) : null,
          setup_chairs: form.setup_chairs ? Number(form.setup_chairs) : null,
          setup_requirements: form.setup_requirements || "",
        } : {}),
      };
      const reservation = await reservationAPI.create(payload);
      setSuccess(reservation);
    } catch (err) {
      setError(err.message || "Unable to submit this reservation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: `radial-gradient(circle at 18% 10%, rgba(201,168,76,0.14), transparent 30%), ${C.page}`, color: C.text, fontFamily: "Inter, Helvetica Neue, Arial, sans-serif", padding: "32px clamp(18px, 4vw, 54px)" }}>
      <style>{`
        @media (max-width: 900px) {
          .dynamic-reservation-grid,
          .dynamic-reservation-fields {
            grid-template-columns: 1fr !important;
          }
          .dynamic-reservation-hero,
          .dynamic-reservation-hero-inner {
            min-height: 420px !important;
          }
        }
      `}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 22 }}>
        <button type="button" onClick={() => navigate("/venues")} style={{ width: 56, height: 56, borderRadius: 16, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", display: "grid", placeItems: "center", cursor: "pointer" }}>
          <img src={bellevueLogo} alt="The Bellevue Manila" style={{ width: 34, height: 34, objectFit: "contain" }} />
        </button>

        {loading ? (
          <section style={{ border: `1px solid ${C.border}`, borderRadius: 22, padding: 28, background: C.surface }}>Loading venue...</section>
        ) : !venue ? (
          <section style={{ border: `1px solid ${C.border}`, borderRadius: 22, padding: 28, background: C.surface }}>
            <h1 style={{ margin: 0, fontSize: 34 }}>Venue Not Found</h1>
            <p style={{ color: C.muted }}>This reservation route is not connected to an active venue.</p>
          </section>
        ) : (
          <div className="dynamic-reservation-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 0.92fr) minmax(420px, 1.08fr)", gap: 22, alignItems: "stretch" }}>
            <section className="dynamic-reservation-hero" style={{ border: `1px solid ${C.border}`, borderRadius: 24, overflow: "hidden", minHeight: 560, background: C.surface, position: "relative" }}>
              {image && <img src={image} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: venue.type === "dining" ? "contain" : "cover", objectPosition: venue.image_position || "center 50%", opacity: venue.type === "dining" ? 0.82 : 0.72 }} />}
              <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.76))" }} />
              <div className="dynamic-reservation-hero-inner" style={{ position: "relative", minHeight: 560, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 30 }}>
                <div style={{ color: C.gold, fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>{venue.type === "dining" ? "Dining Reservation" : "Event Reservation"}</div>
                <h1 style={{ margin: "10px 0 0", fontSize: "clamp(34px, 5vw, 58px)", lineHeight: 1, fontFamily: "Georgia, serif" }}>{venue.display_name || venue.name}</h1>
                <p style={{ maxWidth: 540, color: C.muted, lineHeight: 1.65 }}>{venue.description || "Select your preferred reservation details and our team will review your request."}</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                  <span style={{ color: C.gold, border: `1px solid ${C.border}`, borderRadius: 999, padding: "7px 10px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>{venue.wing || "Bellevue Manila"}</span>
                  {venue.capacity > 0 && <span style={{ color: C.text, border: `1px solid ${C.border}`, borderRadius: 999, padding: "7px 10px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em" }}>Up to {venue.capacity} guests</span>}
                </div>
              </div>
            </section>

            <section style={{ border: `1px solid ${C.border}`, borderRadius: 24, background: "rgba(255,255,255,0.965)", color: "#18140E", padding: 26, display: "grid", alignContent: "start", gap: 18 }}>
              <div>
                <div style={{ color: C.goldDark, fontSize: 11, fontWeight: 850, letterSpacing: "0.18em", textTransform: "uppercase" }}>Reservation Request</div>
                <h2 style={{ margin: "8px 0 0", fontSize: 30, lineHeight: 1.1 }}>Complete Your Booking</h2>
                <p style={{ margin: "8px 0 0", color: "#746B5E", lineHeight: 1.55 }}>Reservation requests are reviewed by the operations team before final confirmation.</p>
              </div>

              {unavailable && (
                <div style={{ borderRadius: 13, border: "1px solid rgba(160,56,56,0.18)", background: "rgba(160,56,56,0.07)", color: "#A03838", padding: 13, fontSize: 13 }}>
                  This venue is currently unavailable for guest reservations.
                </div>
              )}
              {error && <div style={{ borderRadius: 13, border: "1px solid rgba(160,56,56,0.18)", background: "rgba(160,56,56,0.07)", color: "#A03838", padding: 13, fontSize: 13 }}>{error}</div>}
              {success && (
                <div style={{ borderRadius: 13, border: "1px solid rgba(46,122,90,0.18)", background: "rgba(46,122,90,0.07)", color: "#2E7A5A", padding: 13, fontSize: 13 }}>
                  Reservation submitted. Reference code: <strong>{success.reference_code || success.data?.reference_code || "Pending"}</strong>
                </div>
              )}

              <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
                {roomChoices.length > 1 && (
                  <Field label="Room / Section">
                    <select value={selectedRoom?.id || ""} onChange={(e) => setSelectedRoomId(e.target.value)} style={{ ...inputStyle(), color: "#18140E", background: "#fff" }}>
                      {roomChoices.map((room) => (
                        <option key={room.id} value={room.id}>{room.display_name || room.name}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Full Name" icon={User}><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inputStyle(), color: "#18140E", background: "#fff" }} /></Field>
                <div className="dynamic-reservation-fields" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Email" icon={Mail}><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ ...inputStyle(), color: "#18140E", background: "#fff" }} /></Field>
                  <Field label="Phone" icon={Phone}><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ ...inputStyle(), color: "#18140E", background: "#fff" }} /></Field>
                </div>
                <div className="dynamic-reservation-fields" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Date" icon={CalendarDays}><input required type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle(), color: "#18140E", background: "#fff" }} /></Field>
                  <Field label="Guests" icon={Users}><input required type="number" min="1" max="9999" value={guests} onChange={(e) => setGuests(e.target.value)} style={{ ...inputStyle(), color: "#18140E", background: "#fff" }} /></Field>
                </div>
                <Field label="Reservation Time" icon={Clock}>
                  <select required value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} style={{ ...inputStyle(), color: "#18140E", background: "#fff" }}>
                    <option value="">{slotMessage || "Select a time"}</option>
                    {slots.map((slot) => (
                      <option key={slot.time} value={slot.time} disabled={!slot.available}>
                        {slot.label || slot.time}{slot.available ? "" : ` - ${slot.reason || "Unavailable"}`}
                      </option>
                    ))}
                  </select>
                </Field>
                {venue?.type !== "dining" && (
                  <>
                    <Field label="Event Area / Specific Location (Optional)">
                      <input value={form.event_area || ""} onChange={(e) => setForm({ ...form, event_area: e.target.value })} placeholder="e.g., Whole Room, Stage Area" style={{ ...inputStyle(), color: "#18140E", background: "#fff" }} />
                    </Field>
                    <div className="dynamic-reservation-fields" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Tables Needed">
                        <input type="number" min="0" value={form.setup_tables || ""} onChange={(e) => setForm({ ...form, setup_tables: e.target.value })} placeholder="0" style={{ ...inputStyle(), color: "#18140E", background: "#fff" }} />
                      </Field>
                      <Field label="Chairs Needed">
                        <input type="number" min="0" value={form.setup_chairs || ""} onChange={(e) => setForm({ ...form, setup_chairs: e.target.value })} placeholder="0" style={{ ...inputStyle(), color: "#18140E", background: "#fff" }} />
                      </Field>
                    </div>
                    <Field label="Setup Requirements / Details">
                      <textarea value={form.setup_requirements || ""} onChange={(e) => setForm({ ...form, setup_requirements: e.target.value })} placeholder="e.g., Buffet setup, stage, LCD projector, microphone placement..." rows={3} style={{ ...inputStyle(), color: "#18140E", background: "#fff", resize: "vertical" }} />
                    </Field>
                  </>
                )}
                <Field label="Special Requests">
                  <textarea value={form.special_requests} onChange={(e) => setForm({ ...form, special_requests: e.target.value })} rows={4} style={{ ...inputStyle(), color: "#18140E", background: "#fff", resize: "vertical" }} />
                </Field>
                <button type="submit" disabled={submitting || unavailable} style={{ minHeight: 48, border: "none", borderRadius: 12, background: unavailable ? "#B7B0A4" : C.goldDark, color: "#fff", fontWeight: 850, letterSpacing: "0.12em", textTransform: "uppercase", cursor: unavailable ? "not-allowed" : "pointer" }}>
                  {submitting ? "Submitting..." : "Submit Booking"}
                </button>
              </form>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
