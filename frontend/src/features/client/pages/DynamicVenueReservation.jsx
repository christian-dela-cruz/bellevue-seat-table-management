import { useState, useEffect, useRef, useCallback, createContext, useContext, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import SharedNavbar from "../../../components/SharedNavbar.jsx";
import SeatMap, { STATUS_COLORS } from "../../../components/seatmap/SeatMap";
import ScheduleGate, { normalizeSchedule, withSeatmapSchedule } from "../../../components/seatmap/ScheduleGate";
import { mergeReservationStatusIntoLayout } from "../../../utils/seatmapAvailability";
import Echo from "../../../utils/websocket.js";
import bellevueLogo from "../../../assets/bellevue-logo.png";
import { venueAPI } from "../../../services/venueAPI";
import { reservationAPI } from "../../../services/reservationAPI";

function getCanonicalRoomName(room) {
  const r = String(room || "").trim();
  if (r.toLowerCase() === "qsina restaurant" || r.toLowerCase() === "qsina") {
    return "Qsina";
  }
  if (r.toLowerCase() === "hanakazu japanese restaurant" || r.toLowerCase() === "hanakazu") {
    return "Hanakazu";
  }
  return r;
}

// ─── Canonical wing resolver (must match SeatMap.jsx exactly) ─────────────────
function getActualWingForRoom(room) {
  const canonicalRoom = getCanonicalRoomName(room);
  const roomToWingMap = {
    "Alabang Function Room":   "Main Wing",
    "Business Center":         "Main Wing",
    "Laguna Ballroom 1":       "Main Wing",
    "Laguna Ballroom 2":       "Main Wing",
    "20/20 Function Room A":   "Main Wing",
    "20/20 Function Room B":   "Main Wing",
    "20/20 Function Room C":   "Main Wing",
    "Grand Ballroom A":        "Grand Ballroom",
    "Grand Ballroom B":        "Grand Ballroom",
    "Grand Ballroom C":        "Grand Ballroom",
    "Tower 1":                 "Tower Wing",
    "Tower 2":                 "Tower Wing",
    "Tower 3":                 "Tower Wing",
    "Qsina":                   "Dining",
    "Hanakazu":                "Dining",
    "Phoenix Court":           "Dining",
  };
  if (roomToWingMap[canonicalRoom]) {
    return roomToWingMap[canonicalRoom];
  }

  try {
    const raw = localStorage.getItem("bellevue_venue_structure");
    if (raw) {
      const structure = JSON.parse(raw);
      for (const wing of structure) {
        if (wing.rooms?.includes(room) || wing.rooms?.includes(canonicalRoom)) return wing.label;
      }
    }
  } catch {}
  return "Main Wing";
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function imageUrl(image) {
  if (!image) return "";
  const value = String(image).trim();
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const apiRoot = API_BASE_URL.replace(/\/api\/?$/, "");
  if (value.startsWith("/")) return `${apiRoot}${value}`;
  if (value.includes("/")) return `${apiRoot}/${value.replace(/^\/+/, "")}`;
  return `${apiRoot}/images/${value}`;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const ThemeContext = createContext({ isDark: true, toggle: () => {} });
const useTheme = () => useContext(ThemeContext);

function getTokens(isDark) {
  return isDark
    ? {
        gold: "#C4A35A", goldLight: "#D9BC7A", goldDim: "#8C7240",
        goldFaint: "rgba(196,163,90,0.08)", goldFaintest: "rgba(196,163,90,0.04)",
        pageBg: "#0A0908", surfaceBase: "#111009", surfaceRaised: "#161410",
        surfaceInput: "rgba(255,255,255,0.04)",
        borderFaint: "rgba(255,255,255,0.04)", borderDefault: "rgba(255,255,255,0.08)",
        borderStrong: "rgba(255,255,255,0.12)", borderAccent: "rgba(196,163,90,0.30)",
        textPrimary: "#EDE8DF", textSecondary: "#8A8278",
        textTertiary: "rgba(237,232,223,0.32)", textOnAccent: "#0A0908",
        red: "#B85C5C", redFaint: "rgba(184,92,92,0.08)", redBorder: "rgba(184,92,92,0.20)",
        green: "#4A9E7E", greenFaint: "rgba(74,158,126,0.08)", greenBorder: "rgba(74,158,126,0.20)",
        badgePending:  { bg: "rgba(196,163,90,0.10)", color: "#C4A35A", dot: "#C4A35A" },
        badgeApproved: { bg: "rgba(74,158,126,0.10)", color: "#4A9E7E", dot: "#4A9E7E" },
        badgeRejected: { bg: "rgba(184,92,92,0.10)",  color: "#B85C5C", dot: "#B85C5C" },
        navBg: "rgba(10,9,8,0.95)", navBorder: "rgba(196,163,90,0.12)",
        divider: "rgba(255,255,255,0.05)", inputFocusShadow: "0 0 0 3px rgba(196,163,90,0.12)",
        modalOverlay: "rgba(0,0,0,0.82)",
        statusNote: { pending: "rgba(196,163,90,0.05)", approved: "rgba(74,158,126,0.05)", rejected: "rgba(184,92,92,0.05)" },
        statusNoteBorder: { pending: "rgba(196,163,90,0.15)", approved: "rgba(74,158,126,0.15)", rejected: "rgba(184,92,92,0.15)" },
        headerGradient: "linear-gradient(160deg,#111009 0%,#161410 100%)",
        spinnerBorder: "rgba(255,255,255,0.15)", spinnerTop: "#C4A35A",
        cardBg: "#111009", cardBorder: "rgba(255,255,255,0.06)",
        bottomSheet: "#161410",
      }
    : {
        gold: "#8C6B2A", goldLight: "#A07D38", goldDim: "#6B5020",
        goldFaint: "rgba(140,107,42,0.07)", goldFaintest: "rgba(140,107,42,0.04)",
        pageBg: "#F7F4EE", surfaceBase: "#FFFFFF", surfaceRaised: "#FAF8F4",
        surfaceInput: "#FFFFFF",
        borderFaint: "rgba(0,0,0,0.04)", borderDefault: "rgba(0,0,0,0.08)",
        borderStrong: "rgba(0,0,0,0.13)", borderAccent: "rgba(140,107,42,0.28)",
        textPrimary: "#18140E", textSecondary: "#7A7060",
        textTertiary: "rgba(24,20,14,0.35)", textOnAccent: "#FFFFFF",
        red: "#A03838", redFaint: "rgba(160,56,56,0.07)", redBorder: "rgba(160,56,56,0.18)",
        green: "#2E7A5A", greenFaint: "rgba(46,122,90,0.07)", greenBorder: "rgba(46,122,90,0.18)",
        badgePending:  { bg: "rgba(140,107,42,0.09)", color: "#8C6B2A", dot: "#8C6B2A" },
        badgeApproved: { bg: "rgba(46,122,90,0.09)",  color: "#2E7A5A", dot: "#2E7A5A" },
        badgeRejected: { bg: "rgba(160,56,56,0.09)",  color: "#A03838", dot: "#A03838" },
        navBg: "rgba(247,244,238,0.96)", navBorder: "rgba(140,107,42,0.14)",
        divider: "rgba(0,0,0,0.05)", inputFocusShadow: "0 0 0 3px rgba(140,107,42,0.10)",
        modalOverlay: "rgba(0,0,0,0.55)",
        statusNote: { pending: "rgba(140,107,42,0.05)", approved: "rgba(46,122,90,0.05)", rejected: "rgba(160,56,56,0.05)" },
        statusNoteBorder: { pending: "rgba(140,107,42,0.18)", approved: "rgba(46,122,90,0.18)", rejected: "rgba(160,56,56,0.18)" },
        headerGradient: "linear-gradient(160deg,#111009 0%,#1A160F 100%)",
        spinnerBorder: "rgba(0,0,0,0.12)", spinnerTop: "#8C6B2A",
        cardBg: "#FFFFFF", cardBorder: "rgba(0,0,0,0.07)",
        bottomSheet: "#FFFFFF",
      };
}

const F = {
  display: "'Playfair Display','Georgia',serif",
  body:    "'Inter','Helvetica Neue',Arial,sans-serif",
  mono:    "'DM Mono','Courier New',monospace",
  label:   "'Inter','Helvetica Neue',Arial,sans-serif",
};

const LEGEND_STATUSES = ["available", "unavailable"];

// ─── Persistence helpers ──────────────────────────────────────────────────────
function layoutKey(wing, room) {
  const actualWing = getActualWingForRoom(room);
  return `seatmap_layout:${actualWing}:${room}`;
}

function normaliseApiStatus(raw) {
  const s = (raw || "available").toLowerCase();
  if (s === "approved" || s === "reserved") return "reserved";
  if (s === "rejected") return "rejected";
  if (s === "pending") return "unavailable";
  return "available";
}

function loadLayoutForClient(wing, room) {
  try {
    const key = layoutKey(wing, room);
    let raw = localStorage.getItem(key);
    if (!raw) {
      const canonicalRoom = getCanonicalRoomName(room);
      const fullRoom = canonicalRoom === "Hanakazu" ? "Hanakazu Japanese Restaurant" : canonicalRoom === "Qsina" ? "Qsina Restaurant" : room;
      const actualWing = getActualWingForRoom(canonicalRoom);
      raw = localStorage.getItem(`seatmap_layout:${actualWing}:${fullRoom}`)
         || localStorage.getItem(`seatmap_layout:Main Wing:${fullRoom}`)
         || localStorage.getItem(`seatmap_layout:Dining:${fullRoom}`)
         || localStorage.getItem(`seatmap_layout:${actualWing}:${canonicalRoom}`)
         || localStorage.getItem(`seatmap_layout:Main Wing:${canonicalRoom}`);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.v === 2) return parsed;
    if (Array.isArray(parsed)) return { tables: parsed, labels: null, venueZones: [], standaloneSeats: [] };
    return null;
  } catch { return null; }
}

const loadStoredReservations = () => {
  try {
    const raw = localStorage.getItem("bellevue_reservations");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveStoredReservations = (reservations) => {
  try { localStorage.setItem("bellevue_reservations", JSON.stringify(reservations)); } catch {}
};

const makeOfflineReservation = (payload) => ({
  ...payload,
  id: `offline-${Date.now()}`,
  db_id: Date.now(),
  reference_code: `${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`,
  status: "pending",
  submitted_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// ─── Helpers shared with AlabangReserve ───────────────────────────────────────
const getWholeSeatLabel = (guests, tableData = null) => {
  if (!guests || guests < 1) return "Seat 1";
  if (tableData?.seats?.length) {
    const bookable = tableData.seats.filter(s => s.status === "available").slice(0, guests).map(s => s.num ?? s.id);
    if (bookable.length > 0) return `Seat ${bookable.join(", ")}`;
  }
  return `Seat ${Array.from({ length: guests }, (_, i) => i + 1).join(", ")}`;
};

const getSeatRatio = (table) => {
  if (!table?.seats?.length) return null;
  const available = table.seats.filter(s => s.status === "available").length;
  return `${available}/${table.seats.length}`;
};

function Spinner({ size = 13, C }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `1.5px solid ${C.spinnerBorder}`, borderTopColor: C.spinnerTop,
      borderRadius: "50%", animation: "spin 0.65s linear infinite", flexShrink: 0,
    }} />
  );
}

function SectionLabel({ children, C, style = {} }) {
  return (
    <div style={{
      fontFamily: F.label, fontSize: 9, letterSpacing: "0.20em",
      color: C.gold, fontWeight: 700, textTransform: "uppercase",
      marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${C.divider}`, ...style,
    }}>{children}</div>
  );
}

function CloseBtn({ onClick, disabled = false, C }) {
  return (
    <button onClick={onClick} disabled={disabled} title="Close"
      style={{
        width: 32, height: 32, borderRadius: "50%", background: "transparent",
        border: "1px solid rgba(255,255,255,0.10)", cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "border-color 0.18s, background 0.18s", padding: 0, zIndex: 10,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = C.goldFaint; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.background = "transparent"; } }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="rgba(237,232,223,0.50)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

function ModalShell({ children, onClose, disabled, C, maxWidth = 500 }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: C.modalOverlay, zIndex: 20000, display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 20px", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={e => { if (e.target === e.currentTarget && !disabled) onClose(); }}
    >
      <div style={{ background: C.surfaceBase, borderRadius: 14, width: "100%", maxWidth, maxHeight: "calc(100vh - 40px)", overflowY: "auto", boxShadow: "0 30px 90px rgba(0,0,0,0.42)", border: "none", fontFamily: F.body, position: "relative", animation: "modalIn 0.20s cubic-bezier(0.16,1,0.3,1)", overflow: "hidden" }}>
        <div style={{ height: "2px", background: `linear-gradient(90deg, transparent 0%, ${C.gold}80 30%, ${C.gold}80 70%, transparent 100%)` }} />
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ eyebrow, title, onClose, disabled, C, meta }) {
  return (
    <div style={{ background: C.headerGradient, padding: "26px 28px 22px", position: "sticky", top: 0, zIndex: 2, borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ position: "absolute", top: 18, right: 20, zIndex: 20 }}>
        <CloseBtn onClick={onClose} disabled={disabled} C={C} />
      </div>
      <div style={{ paddingRight: 44 }}>
        {eyebrow && <div style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.22em", color: C.gold, fontWeight: 700, textTransform: "uppercase", marginBottom: 6, opacity: 0.80 }}>{eyebrow}</div>}
        <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 600, color: "#EDE8DF", letterSpacing: "0.01em", lineHeight: 1.2 }}>{title}</div>
        {meta && <div style={{ marginTop: 8 }}>{meta}</div>}
      </div>
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled = false, loading = false, C, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{ width: "100%", padding: "13px", background: disabled ? C.textTertiary : C.gold, border: "none", borderRadius: 8, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: disabled ? C.textSecondary : C.textOnAccent, cursor: disabled || loading ? "not-allowed" : "pointer", transition: "all 0.20s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8, ...style }}
      onMouseEnter={e => { if (!disabled && !loading) e.currentTarget.style.background = C.goldLight; }}
      onMouseLeave={e => { if (!disabled && !loading) e.currentTarget.style.background = C.gold; }}
    >
      {loading ? <><Spinner C={C} />{children}</> : children}
    </button>
  );
}

function GhostBtn({ children, onClick, disabled = false, C, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width: "100%", padding: "12px", background: "transparent", border: `1px solid ${C.borderDefault}`, borderRadius: 8, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: C.textSecondary, cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.18s", ...style }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.color = C.gold; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.color = C.textSecondary; } }}
    >{children}</button>
  );
}

function StepIndicator({ step, C }) {
  const steps = ["Guest Count", "Details", "Confirm"];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginTop: 18 }}>
      {steps.map((label, i) => {
        const idx = i + 1; const done = step > idx; const active = step === idx;
        return (
          <div key={label} style={{ display: "flex", alignItems: "flex-start", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: done ? C.gold : active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)", border: done || active ? "none" : "1.5px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}>
                {done
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  : <span style={{ fontFamily: F.label, fontSize: 10, fontWeight: 700, color: active ? "#EDE8DF" : "rgba(237,232,223,0.40)" }}>{idx}</span>
                }
              </div>
              <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: done ? C.gold : active ? "#EDE8DF" : "rgba(237,232,223,0.35)", whiteSpace: "nowrap", textTransform: "uppercase" }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1.5, marginTop: 12, marginLeft: 6, marginRight: 6, background: done ? C.gold : "rgba(255,255,255,0.10)", borderRadius: 2, transition: "background 0.2s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "", C, isDark, required = false, min, rows }) {
  const [focused, setFocused] = useState(false);
  const isTextarea = type === "textarea";
  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "11px 14px",
    border: `1.5px solid ${focused ? C.borderAccent : C.borderDefault}`,
    borderRadius: 8, background: C.surfaceInput, fontFamily: F.body, fontSize: 13,
    color: C.textPrimary, outline: "none", transition: "border-color 0.18s, box-shadow 0.18s",
    boxShadow: focused ? C.inputFocusShadow : "none",
    colorScheme: isDark ? "dark" : "light",
    resize: isTextarea ? "vertical" : undefined,
    minHeight: isTextarea ? 72 : undefined,
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontFamily: F.label, fontSize: 9, letterSpacing: "0.18em", color: focused ? C.gold : C.textSecondary, fontWeight: 700, textTransform: "uppercase", marginBottom: 7, transition: "color 0.18s" }}>
        {label}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
      </label>
      {isTextarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows || 3} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={inputStyle} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} min={min} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={inputStyle} />
      }
    </div>
  );
}

// ─── Modal 1: Guest Count ─────────────────────────────────────────────────────
function ModalGuestCount({ seatData, tableData, mode, isStandalone, onContinue, onCancel, C, isDark, ROOM }) {
  const bookableSeats = (tableData?.seats || []).filter(s => s.status === "available");
  const pendingSeats  = (tableData?.seats || []).filter(s => s.status === "pending");
  const capacity = bookableSeats.length || tableData?.capacity || 8;

  const [guests,   setGuests]   = useState(() => Math.min(2, capacity));
  const [inputVal, setInputVal] = useState(String(Math.min(2, capacity)));

  useEffect(() => {
    setGuests(g => {
      const clamped = Math.min(g, capacity);
      setInputVal(String(clamped));
      return clamped;
    });
  }, [capacity]);

  const handleInputChange = e => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    if (raw === "") { setInputVal(""); return; }
    const n = parseInt(raw, 10);
    if (isNaN(n)) return;
    const clamped = Math.min(Math.max(1, n), capacity);
    setInputVal(String(clamped));
    setGuests(clamped);
  };

  const handleInputBlur = () => {
    let n = parseInt(inputVal, 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > capacity) n = capacity;
    setGuests(n);
    setInputVal(String(n));
  };

  const dec   = () => { const n = Math.max(1, guests - 1); setGuests(n); setInputVal(String(n)); };
  const inc   = () => { if (guests >= capacity) return; const n = guests + 1; setGuests(n); setInputVal(String(n)); };
  const atMax = guests >= capacity;
  const atMin = guests <= 1;

  const infoRows = [
    ["Room",         ROOM,                                                      null],
    ...(tableData ? [["Table", `Table ${tableData?.id ?? "—"}`, null]] : []),
    ["Seat Number",  `Seat ${seatData?.num ?? seatData?.id ?? "—"}`,           null],
    ["Availability", seatData?.status === "available" ? "Available" : "Unavailable",
                     seatData?.status === "available" ? C.green : C.gold],
  ];

  if (isStandalone) {
    return (
      <ModalShell onClose={onCancel} C={C}>
        <ModalHeader eyebrow="Seat Reservation" title="Reserve This Seat" onClose={onCancel} C={C} meta={<StepIndicator step={1} C={C} />} />
        <div style={{ padding: "22px 24px 26px" }}>
          <div style={{ background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, borderRadius: 10, overflow: "hidden", marginBottom: 22 }}>
            {[
              ["Room",         ROOM,                                                null],
              ["Seat Number",  `Seat ${seatData?.num ?? seatData?.id ?? "—"}`,     null],
              ["Availability", seatData?.status === "available" ? "Available" : "Unavailable",
               seatData?.status === "available" ? C.green : C.gold],
            ].map(([key, val, color], i, arr) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${C.divider}` : "none" }}>
                <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>{key}</span>
                <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: color || C.textPrimary }}>{val}</span>
              </div>
            ))}
          </div>
          <PrimaryBtn onClick={() => onContinue(1)} C={C}>Continue</PrimaryBtn>
          <GhostBtn onClick={onCancel} C={C}>Cancel</GhostBtn>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onCancel} C={C}>
      <ModalHeader
        eyebrow={mode === "individual" ? "Seat Reservation" : "Table Reservation"}
        title={mode === "individual" ? "Reserve This Seat" : "Reserve This Table"}
        onClose={onCancel} C={C}
        meta={<StepIndicator step={1} C={C} />}
      />
      <div style={{ padding: "22px 24px 26px" }}>
        {mode === "individual" && (
          <div style={{ background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, borderRadius: 10, overflow: "hidden", marginBottom: 22 }}>
            {infoRows.map(([key, val, color], i) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: i < infoRows.length - 1 ? `1px solid ${C.divider}` : "none" }}>
                <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>{key}</span>
                <span style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: color || C.textPrimary }}>{val}</span>
              </div>
            ))}
          </div>
        )}

        {mode === "whole" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.22em", color: C.textSecondary, fontWeight: 700, textTransform: "uppercase", marginBottom: 14 }}>Number of Guests</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 10 }}>
                <button onClick={dec} disabled={atMin}
                  style={{ width: 44, height: 52, border: `1.5px solid ${atMin ? C.borderFaint : C.borderDefault}`, borderRight: "none", borderRadius: "8px 0 0 8px", background: C.surfaceInput, color: atMin ? C.textTertiary : C.gold, fontSize: 20, fontWeight: 700, cursor: atMin ? "not-allowed" : "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", opacity: atMin ? 0.4 : 1 }}
                  onMouseEnter={e => { if (!atMin) e.currentTarget.style.background = C.goldFaint; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.surfaceInput; }}
                >−</button>
                <input type="text" inputMode="numeric" pattern="[0-9]*" value={inputVal}
                  onChange={handleInputChange} onBlur={handleInputBlur}
                  style={{ width: 80, height: 52, border: `1.5px solid ${C.borderAccent}`, borderLeft: "none", borderRight: "none", background: C.surfaceInput, textAlign: "center", fontFamily: F.display, fontSize: 28, fontWeight: 700, color: C.textPrimary, outline: "none", colorScheme: isDark ? "dark" : "light", MozAppearance: "textfield", WebkitAppearance: "none", boxSizing: "border-box" }}
                />
                <button onClick={inc} disabled={atMax}
                  style={{ width: 44, height: 52, border: `1.5px solid ${atMax ? C.borderFaint : C.borderDefault}`, borderLeft: "none", borderRadius: "0 8px 8px 0", background: C.surfaceInput, color: atMax ? C.textTertiary : C.gold, fontSize: 20, fontWeight: 700, cursor: atMax ? "not-allowed" : "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", opacity: atMax ? 0.4 : 1 }}
                  onMouseEnter={e => { if (!atMax) e.currentTarget.style.background = C.goldFaint; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.surfaceInput; }}
                >+</button>
              </div>
              <div style={{ fontFamily: F.body, fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}>
                Table <strong style={{ color: C.textPrimary }}>{tableData?.id}</strong> has{" "}
                <strong style={{ color: C.textPrimary }}>{capacity} available seat{capacity !== 1 ? "s" : ""}</strong>
                {pendingSeats.length > 0 && <span style={{ color: C.gold }}>{" "}({pendingSeats.length} temporarily unavailable)</span>}
              </div>
              {atMax && (
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 7, background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, fontFamily: F.body, fontSize: 11.5, color: C.gold, lineHeight: 1.5 }}>
                  Maximum reached — only <strong>{capacity}</strong> seat{capacity !== 1 ? "s" : ""} available on this table.
                </div>
              )}
            </div>
            <div style={{ padding: "12px 16px", borderRadius: 8, marginBottom: 20, background: C.goldFaintest, border: `1px solid ${C.borderAccent}` }}>
              <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: C.textTertiary, textTransform: "uppercase", marginBottom: 4 }}>Seats to be Reserved</div>
              <div style={{ fontFamily: F.body, fontSize: 13, color: C.gold, fontWeight: 600 }}>{getWholeSeatLabel(guests, tableData)}</div>
            </div>
          </>
        )}

        <PrimaryBtn onClick={() => onContinue(mode === "individual" ? 1 : guests)} C={C}>Continue</PrimaryBtn>
        <GhostBtn onClick={onCancel} C={C}>Cancel</GhostBtn>
      </div>
    </ModalShell>
  );
}

// ─── Modal 2: Details ─────────────────────────────────────────────────────────
function ModalDetails({ tableData, seatData, mode, guests, isStandalone, onReview, onCancel, prefill, C, isDark, secondsLeft, onTimerExpired, ROOM, WING, venueType }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    firstName: prefill?.firstName || "", lastName: prefill?.lastName || "",
    email: prefill?.email || "", phone: prefill?.phone || "+63",
    eventDate: prefill?.eventDate || today, eventTime: prefill?.eventTime || "19:00",
    specialRequests: prefill?.specialRequests || "",
    eventArea: prefill?.eventArea || "",
    setupTables: prefill?.setupTables || "",
    setupChairs: prefill?.setupChairs || "",
    setupRequirements: prefill?.setupRequirements || "",
  });

  useEffect(() => {
    if (prefill) setForm({ firstName: prefill.firstName || "", lastName: prefill.lastName || "", email: prefill.email || "", phone: prefill.phone || "+63", eventDate: prefill.eventDate || today, eventTime: prefill.eventTime || "19:00", specialRequests: prefill.specialRequests || "", eventArea: prefill.eventArea || "", setupTables: prefill.setupTables || "", setupChairs: prefill.setupChairs || "", setupRequirements: prefill.setupRequirements || "" });
  }, [prefill?.firstName, prefill?.lastName, prefill?.email, prefill?.phone, prefill?.eventDate, prefill?.eventTime, prefill?.specialRequests, prefill?.eventArea, prefill?.setupTables, prefill?.setupChairs, prefill?.setupRequirements, today]);

  useEffect(() => {
    if (secondsLeft <= 0) onTimerExpired();
  }, [secondsLeft]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");
  const isUrgent = secondsLeft <= 60;

  const set = k => v => {
    if (k === "phone") {
      const digits = (v.startsWith("+63") ? v.slice(3) : v).replace(/[^0-9]/g, "").slice(0, 10);
      setForm(f => ({ ...f, phone: "+63" + digits }));
    } else setForm(f => ({ ...f, [k]: v }));
  };

  const allFilled =
    form.firstName.trim() !== "" &&
    form.lastName.trim()  !== "" &&
    form.email.trim()     !== "" &&
    form.phone.trim()     !== "" && form.phone !== "+63" &&
    form.eventDate.trim() !== "";

  const seatDisplay = mode === "whole" ? getWholeSeatLabel(guests, tableData) : seatData ? `Seat ${seatData.num ?? seatData.id}` : "-";
  const summaryRows = [
    ["Venue", "The Bellevue Manila"],
    ["Outlet", ROOM],
    ["Wing", WING],
    ...(isStandalone || !tableData ? [] : [["Table", `Table ${tableData?.id ?? "-"}`]]),
    ["Seat", seatDisplay],
    ["Guests", `${guests} guest${guests !== 1 ? "s" : ""}`],
    ["Date", form.eventDate || "Select date"],
    ["Time", form.eventTime || "Select time"],
  ];

  const SummaryRow = ({ label, value, accent }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "9px 0", borderBottom: `1px solid ${C.divider}` }}>
      <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: C.textTertiary }}>{label}</span>
      <span style={{ fontFamily: F.body, fontSize: 12.5, color: accent ? C.gold : C.textPrimary, fontWeight: accent ? 700 : 560, textAlign: "right", lineHeight: 1.45, maxWidth: 170, overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );

  return (
    <ModalShell onClose={onCancel} C={C} maxWidth={960}>
      <ModalHeader eyebrow={isStandalone ? "Standalone Seat Reservation" : mode === "individual" ? "Seat Reservation" : "Table Reservation"} title="Your Information" onClose={onCancel} C={C} meta={<StepIndicator step={2} C={C} />} />
      <div style={{ display: "grid", gridTemplateColumns: window.innerWidth < 820 ? "1fr" : "minmax(0,1fr) 280px", gap: 0, maxHeight: window.innerWidth < 820 ? "calc(100vh - 180px)" : "calc(100vh - 214px)", overflow: "hidden" }}>
        <div style={{ padding: "28px 30px 30px", overflowY: "auto" }}>
          <SectionLabel C={C}>Personal Information</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
            <Field label="First Name" value={form.firstName} onChange={set("firstName")} C={C} isDark={isDark} required />
            <Field label="Last Name" value={form.lastName} onChange={set("lastName")} C={C} isDark={isDark} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(0,0.75fr)", gap: 12 }}>
            <Field label="Email Address" value={form.email} onChange={set("email")} type="email" C={C} isDark={isDark} required />
            <Field label="Phone Number" value={form.phone} onChange={set("phone")} type="tel" C={C} isDark={isDark} required placeholder="+63XXXXXXXXXX" />
          </div>

          <SectionLabel C={C} style={{ marginTop: 8 }}>Details</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
            <Field label="Date" value={form.eventDate} onChange={set("eventDate")} type="date" min={today} C={C} isDark={isDark} required />
            <Field label="Time" value={form.eventTime} onChange={set("eventTime")} type="time" C={C} isDark={isDark} />
          </div>

          {venueType !== "dining" && (
            <>
              <SectionLabel C={C} style={{ marginTop: 8 }}>Setup Configuration</SectionLabel>
              <Field label="Event Area / Specific Location (Optional)" value={form.eventArea} onChange={set("eventArea")} C={C} isDark={isDark} placeholder="e.g. Whole Room, Stage Area" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
                <Field label="Tables Needed" value={form.setupTables} onChange={set("setupTables")} type="number" min="0" C={C} isDark={isDark} placeholder="0" />
                <Field label="Chairs Needed" value={form.setupChairs} onChange={set("setupChairs")} type="number" min="0" C={C} isDark={isDark} placeholder="0" />
              </div>
              <Field label="Setup Requirements / Details" value={form.setupRequirements} onChange={set("setupRequirements")} type="textarea" rows={3} C={C} isDark={isDark} placeholder="e.g. Buffet table layout, projector placement..." />
            </>
          )}

          <Field label="Special Requests (Optional)" value={form.specialRequests} onChange={set("specialRequests")} type="textarea" rows={4} C={C} isDark={isDark} placeholder="Optional requests, preferences, or notes for the reservation." />
        </div>

        <aside style={{ borderLeft: `1px solid ${C.divider}`, background: C.goldFaintest, padding: "24px 22px 30px", overflowY: "auto" }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: isUrgent ? C.statusNote?.rejected || C.goldFaint : C.surfaceInput, border: `1px solid ${isUrgent ? C.statusNoteBorder?.rejected || C.borderAccent : C.borderAccent}` }}>
              <div style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: isUrgent ? C.red : C.textSecondary, marginBottom: 3 }}>Seat Hold Timer</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 11.5, color: isUrgent ? C.red : C.textTertiary }}>{isUrgent ? "Hold expiring soon" : "Complete before expiry"}</span>
                <strong style={{ fontFamily: F.mono, fontSize: 22, color: isUrgent ? C.red : C.gold, letterSpacing: "0.04em" }}>{mins}:{secs}</strong>
              </div>
            </div>
            <div>
              <SectionLabel C={C} style={{ marginBottom: 6 }}>Reservation Summary</SectionLabel>
              {summaryRows.map(([label, value]) => <SummaryRow key={label} label={label} value={value} accent={["Seat", "Date", "Time"].includes(label)} />)}
            </div>
            <button
              onClick={() => allFilled && onReview(form)}
              disabled={!allFilled}
              style={{ width: "100%", padding: "13px", background: allFilled ? C.gold : C.textTertiary, border: "none", borderRadius: 8, fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: allFilled ? C.textOnAccent : C.textSecondary, cursor: allFilled ? "pointer" : "not-allowed", transition: "all 0.20s" }}
              onMouseEnter={e => { if (allFilled) e.currentTarget.style.background = C.goldLight; }}
              onMouseLeave={e => { if (allFilled) e.currentTarget.style.background = C.gold; }}
            >Review Booking</button>
            <GhostBtn onClick={onCancel} C={C}>Back to Seats</GhostBtn>
          </div>
        </aside>
      </div>
    </ModalShell>
  );
}

// ─── Modal 3: Review ──────────────────────────────────────────────────────────
function ModalReview({ form, guests, tableData, seatData, mode, isStandalone, onSubmit, onEdit, submitting, isRebook, rebookFrom, C, ROOM, WING }) {
  const [consentAccepted, setConsentAccepted] = useState(false);
  const fmt = t => { if (!t) return null; const [h, m] = t.split(":"); const hr = parseInt(h); return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`; };
  const seatDisplay = mode === "whole" ? getWholeSeatLabel(guests, tableData) : `Seat ${seatData?.num ?? seatData?.id ?? "-"}`;
  const canSubmit = consentAccepted && !submitting;

  const reservationRows = [
    ["Venue", "The Bellevue Manila"],
    ["Room", `${WING} - ${ROOM}`],
    ...(isStandalone || !tableData ? [] : [["Table", `Table ${tableData?.id ?? "-"}`]]),
    ["Seat(s)", seatDisplay],
    ["Guests", `${guests} guest${guests !== 1 ? "s" : ""}`],
    ["Event Date", form.eventDate || "-"],
    ["Event Time", form.eventTime ? fmt(form.eventTime) : "-"],
  ];
  const guestRows = [
    ["Full Name", `${form.firstName} ${form.lastName}`],
    ["Email", form.email],
    ["Phone", form.phone],
    ["Special Requests", form.specialRequests || "None"],
  ];

  const Row = ({ label, value, accent }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "9px 0", borderBottom: `1px solid ${C.divider}` }}>
      <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary, minWidth: 96, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: F.body, fontSize: 12.5, color: accent ? C.gold : C.textPrimary, fontWeight: accent ? 720 : 520, textAlign: "right", maxWidth: 300, lineHeight: 1.5, overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );

  return (
    <ModalShell onClose={onEdit} disabled={submitting} C={C} maxWidth={960}>
      <ModalHeader eyebrow={isRebook ? "Rebook / Move Seat" : isStandalone ? "Standalone Seat Reservation" : mode === "individual" ? "Seat Reservation" : "Table Reservation"} title="Review Your Booking" onClose={onEdit} disabled={submitting} C={C} meta={<StepIndicator step={3} C={C} />} />
      <div style={{ display: "grid", gridTemplateColumns: window.innerWidth < 820 ? "1fr" : "minmax(0,1fr) 300px", gap: 0, maxHeight: window.innerWidth < 820 ? "calc(100vh - 180px)" : "calc(100vh - 214px)", overflow: "hidden" }}>
        <div style={{ padding: "28px 30px 30px", overflowY: "auto" }}>
          {isRebook && rebookFrom && (
            <div style={{ padding: "11px 14px", borderRadius: 8, marginBottom: 18, background: C.statusNote?.pending || C.goldFaintest, border: `1px solid ${C.statusNoteBorder?.pending || C.borderAccent}`, fontSize: 12, color: C.gold, lineHeight: 1.65 }}>
              <strong style={{ color: C.gold }}>Rebooking notice:</strong> Previous reservation <strong>{rebookFrom.reference_code || rebookFrom.id}</strong> will be cancelled on submit.
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: window.innerWidth < 820 ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 18 }}>
            <div>
              <SectionLabel C={C}>Reservation Details</SectionLabel>
              {reservationRows.map(([k, v]) => <Row key={k} label={k} value={v} accent={k === "Seat(s)" || k === "Event Date" || k === "Event Time"} />)}
            </div>
            <div>
              <SectionLabel C={C}>Guest Information</SectionLabel>
              {guestRows.map(([k, v]) => <Row key={k} label={k} value={v} />)}
            </div>
          </div>
        </div>

        <aside style={{ borderLeft: `1px solid ${C.divider}`, background: C.goldFaintest, padding: "24px 22px 30px", overflowY: "auto" }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: C.surfaceInput, border: `1px solid ${C.borderAccent}` }}>
              <div style={{ fontFamily: F.label, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold, fontWeight: 800, marginBottom: 8 }}>Final Review</div>
              <div style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.6 }}>Your booking will be reviewed by our team after submission. You will receive the final reservation status through the provided contact details.</div>
            </div>

            <label style={{ display: "grid", gridTemplateColumns: "18px minmax(0,1fr)", gap: 10, alignItems: "flex-start", padding: "14px 15px", borderRadius: 10, background: consentAccepted ? C.goldFaint : C.surfaceInput, border: `1px solid ${consentAccepted ? C.borderAccent : C.borderDefault}`, cursor: submitting ? "not-allowed" : "pointer" }}>
              <input type="checkbox" checked={consentAccepted} disabled={submitting} onChange={(e) => setConsentAccepted(e.target.checked)} style={{ marginTop: 2, width: 15, height: 15, accentColor: C.gold }} />
              <span style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.65 }}>
                I consent to the collection, use, and processing of my personal information for managing my reservation, communicating updates, and supporting related guest service operations, in accordance with the Data Privacy Act of 2012.
              </span>
            </label>

            <div style={{ fontSize: 11.5, color: C.textTertiary, lineHeight: 1.6 }}>
              Your personal information will only be used to process your reservation, coordinate guest service needs, and provide reservation status updates.
            </div>

            <button onClick={onSubmit} disabled={!canSubmit}
              style={{ width: "100%", padding: "13px", border: "none", borderRadius: 8, background: canSubmit ? C.gold : C.textTertiary, color: canSubmit ? C.textOnAccent : C.textSecondary, fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", cursor: canSubmit ? "pointer" : "not-allowed", transition: "all 0.18s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = C.goldLight; }}
              onMouseLeave={e => { if (canSubmit) e.currentTarget.style.background = C.gold; }}
            >
              {submitting ? <><Spinner C={C} />Submitting...</> : isRebook ? "Confirm Rebook" : "Submit Booking"}
            </button>
            <GhostBtn onClick={onEdit} disabled={submitting} C={C}>Edit Details</GhostBtn>
          </div>
        </aside>
      </div>
    </ModalShell>
  );
}

// ─── Modal: Success ───────────────────────────────────────────────────────────
function ModalSuccess({ refCode, onBack, mode, guests, isRebook, bookingDetails, C, isDark, ROOM }) {
  const qrValue = useMemo(() => {
    if (!refCode) return "";
    const base = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
    const url = base.startsWith("http") ? base : `https://${base}`;
    return `${url}/manage-booking?code=${String(refCode).trim()}`;
  }, [refCode]);

  return (
    <ModalShell onClose={onBack} C={C}>
      <div style={{ padding: "34px 28px 30px", textAlign: "center", display: "grid", gap: 20 }}>
        <div>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.greenFaint, border: `1.5px solid ${C.green}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h3 style={{ fontFamily: F.display, fontSize: 22, fontWeight: 600, color: C.textPrimary, margin: 0 }}>Request Submitted</h3>
          <p style={{ fontSize: 13, color: C.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
            {isRebook ? "Your rebooking request is complete." : "Your booking is pending and has been sent to our team for approval."}
          </p>
        </div>

        <div style={{ background: C.surfaceInput, border: `1px solid ${C.borderDefault}`, borderRadius: 10, padding: "16px 20px", display: "grid", gap: 14 }}>
          <div>
            <div style={{ fontFamily: F.label, fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: C.textTertiary, marginBottom: 4 }}>Booking Reference Code</div>
            <strong style={{ fontFamily: F.mono, fontSize: 24, color: C.gold, letterSpacing: "0.02em" }}>{refCode || "PENDING"}</strong>
          </div>
          <div style={{ display: "grid", gap: 8, borderTop: `1px solid ${C.divider}`, paddingTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ color: C.textSecondary }}>Outlet:</span>
              <strong style={{ color: C.textPrimary }}>{ROOM}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ color: C.textSecondary }}>Party Size:</span>
              <strong style={{ color: C.textPrimary }}>{guests} guest{guests !== 1 ? "s" : ""}</strong>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 140, height: 140, padding: 8, background: "#fff", borderRadius: 12, border: `1px solid ${C.borderStrong}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.06)" }}>
            <QRCodeWithRef value={qrValue} size={124} C={C} />
          </div>
          <span style={{ fontSize: 10.5, color: C.textTertiary }}>Scan QR to check status dynamically</span>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <PrimaryBtn onClick={onBack} C={C}>Done</PrimaryBtn>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── QR Code Helper ──────────────────────────────────────────────────────────
function QRCodeWithRef({ value, size = 120, C }) {
  const [imgSrc, setImgSrc] = useState(null);
  useEffect(() => {
    if (!value) return;
    let cancelled = false;
    const doRender = () => {
      const tmp = document.createElement("div");
      tmp.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden;";
      document.body.appendChild(tmp);
      try {
        new window.QRCode(tmp, { text: value, width: size * 4, height: size * 4, colorDark: "#000000", colorLight: "#FFFFFF", correctLevel: window.QRCode.CorrectLevel.L });
        const tryExtract = (attempt = 0) => {
          const qrCanvas = tmp.querySelector("canvas");
          if (qrCanvas) { const src = qrCanvas.toDataURL("image/png"); if (!cancelled) { setImgSrc(src); } document.body.removeChild(tmp); return; }
          const qrImg = tmp.querySelector("img");
          if (qrImg?.src) { if (!cancelled) { setImgSrc(qrImg.src); } document.body.removeChild(tmp); return; }
          if (attempt < 5) setTimeout(() => tryExtract(attempt + 1), 100 * (attempt + 1));
          else document.body.removeChild(tmp);
        };
        tryExtract();
      } catch (e) { if (tmp.parentNode) document.body.removeChild(tmp); }
    };
    if (window.QRCode) { doRender(); } else {
      const existing = document.querySelector("script[data-qrcodejs]");
      if (existing) existing.addEventListener("load", doRender);
      else { const script = document.createElement("script"); script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; script.setAttribute("data-qrcodejs", "1"); script.onload = doRender; document.head.appendChild(script); }
    }
    return () => { cancelled = true; };
  }, [value, size]);

  if (!imgSrc) return <div style={{ width: size, height: size, background: "rgba(0,0,0,0.05)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#8a8278" }}>QR</div>;
  return <img src={imgSrc} alt="QR Code" style={{ width: size, height: size, display: "block", borderRadius: 8 }} />;
}

// ─── CLASSIC FORM COMPONENT (FALLBACK FOR UNPUBLISHED SEATMAPS) ───────────────
function DynamicReservationForm({ venue, selectedRoom, date, setDate, guests, setGuests, slots, slotMessage, form, setForm, submitting, submit, error, success, C, isDark, WING, ROOM, isReservable = true }) {
  const heroImage = imageUrl(venue?.image);

  return (
    <div style={{ display: "grid", gridTemplateColumns: window.innerWidth < 900 ? "1fr" : "minmax(0, 0.92fr) minmax(420px, 1.08fr)", gap: 22, alignItems: "stretch", position: "relative", zIndex: 1, padding: "0 20px" }}>
      <section style={{ border: `1px solid ${C.borderStrong}`, borderRadius: 24, overflow: "hidden", minHeight: 560, background: C.surfaceRaised, position: "relative" }}>
        {heroImage && <img src={heroImage} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: venue.type === "dining" ? "contain" : "cover", objectPosition: venue.image_position || "center 50%", opacity: 0.75 }} />}
        <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.10), rgba(0,0,0,0.85))" }} />
        <div style={{ position: "relative", minHeight: 560, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 30 }}>
          <div style={{ color: C.gold, fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }}>{venue.type === "dining" ? "Dining Reservation" : "Event Reservation"}</div>
          <h1 style={{ margin: "10px 0 0", fontSize: "clamp(34px, 5vw, 58px)", lineHeight: 1.1, fontFamily: F.display, color: C.textPrimary }}>{selectedRoom.display_name || selectedRoom.name}</h1>
          <p style={{ maxWidth: 540, color: C.textSecondary, lineHeight: 1.65, fontSize: 14 }}>{venue.description || "Select your preferred reservation details and our team will review your request."}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <span style={{ color: C.gold, border: `1px solid ${C.borderStrong}`, borderRadius: 999, padding: "7px 10px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", background: C.surfaceBase }}>{WING}</span>
            {venue.capacity > 0 && <span style={{ color: C.textPrimary, border: `1px solid ${C.borderStrong}`, borderRadius: 999, padding: "7px 10px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", background: C.surfaceBase }}>Up to {venue.capacity} guests</span>}
          </div>
        </div>
      </section>

      <section style={{ border: `1px solid ${C.borderStrong}`, borderRadius: 24, background: C.surfaceBase, padding: 30, display: "grid", alignContent: "start", gap: 20 }}>
        <div>
          <div style={{ color: C.gold, fontSize: 11, fontWeight: 855, letterSpacing: "0.18em", textTransform: "uppercase" }}>Reservation Request</div>
          <h2 style={{ margin: "8px 0 0", fontSize: 28, lineHeight: 1.1, fontFamily: F.display, color: C.textPrimary }}>Complete Your Booking</h2>
          <p style={{ margin: "8px 0 0", color: C.textSecondary, lineHeight: 1.55, fontSize: 13.5 }}>No interactive seat layout has been published for this outlet yet, but you can book a reservation directly below.</p>
        </div>

        {error && <div style={{ borderRadius: 13, border: `1px solid ${C.redBorder}`, background: C.redFaint, color: C.red, padding: 13, fontSize: 13 }}>{error}</div>}
        {!isReservable && <div style={{ borderRadius: 13, border: `1px solid ${C.redBorder}`, background: C.redFaint, color: C.red, padding: 13, fontSize: 13 }}>This venue is currently not available for online reservations.</div>}
        {success && (
          <div style={{ borderRadius: 13, border: `1px solid ${C.greenBorder}`, background: C.greenFaint, color: C.green, padding: 13, fontSize: 13 }}>
            Reservation submitted. Reference code: <strong>{success.reference_code || success.data?.reference_code || "Pending"}</strong>
          </div>
        )}

        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <Field label="Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} C={C} isDark={isDark} required />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Email Address" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} C={C} isDark={isDark} required />
            <Field label="Phone Number" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} C={C} isDark={isDark} placeholder="+63XXXXXXXXXX" required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Date" type="date" min={new Date().toISOString().split("T")[0]} value={date} onChange={(v) => setDate(v)} C={C} isDark={isDark} required />
            <Field label="Guests" type="number" min="1" max="9999" value={guests} onChange={(v) => setGuests(v)} C={C} isDark={isDark} required />
          </div>
          <div style={{ display: "grid", gap: 7 }}>
            <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.18em", color: C.textSecondary, fontWeight: 700, textTransform: "uppercase" }}>Reservation Time <span style={{ color: C.red }}>*</span></span>
            <select required value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", border: `1.5px solid ${C.borderDefault}`, borderRadius: 8, background: C.surfaceInput, fontFamily: F.body, fontSize: 13, color: C.textPrimary, outline: "none", colorScheme: isDark ? "dark" : "light" }}>
              <option value="">{slotMessage || "Select a time"}</option>
              {slots.map((slot) => (
                <option key={slot.time} value={slot.time} disabled={!slot.available}>
                  {slot.label || slot.time}{slot.available ? "" : ` - ${slot.reason || "Unavailable"}`}
                </option>
              ))}
            </select>
          </div>

          {venue?.type !== "dining" && (
            <>
              <Field label="Event Area / Specific Location (Optional)" value={form.event_area} onChange={(v) => setForm({ ...form, event_area: v })} C={C} isDark={isDark} placeholder="e.g. Whole Room, Stage Area" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Tables Needed" type="number" min="0" value={form.setup_tables} onChange={(v) => setForm({ ...form, setup_tables: v })} C={C} isDark={isDark} placeholder="0" />
                <Field label="Chairs Needed" type="number" min="0" value={form.setup_chairs} onChange={(v) => setForm({ ...form, setup_chairs: v })} C={C} isDark={isDark} placeholder="0" />
              </div>
              <Field label="Setup Requirements / Details" type="textarea" value={form.setup_requirements} onChange={(v) => setForm({ ...form, setup_requirements: v })} C={C} isDark={isDark} placeholder="e.g. Buffet setup, stage, LCD projector placement..." />
            </>
          )}

          <Field label="Special Requests" type="textarea" value={form.special_requests} onChange={(v) => setForm({ ...form, special_requests: v })} C={C} isDark={isDark} placeholder="Optional requests, preferences, or notes." />
          <button type="submit" disabled={submitting || !isReservable} style={{ minHeight: 48, border: "none", borderRadius: 12, background: isReservable ? C.gold : C.textTertiary, color: C.textOnAccent, fontFamily: F.label, fontSize: 10, fontWeight: 850, letterSpacing: "0.14em", textTransform: "uppercase", cursor: submitting || !isReservable ? "not-allowed" : "pointer", transition: "all 0.20s", marginTop: 8 }}>
            {submitting ? "Submitting..." : "Submit Booking Request"}
          </button>
        </form>
      </section>
    </div>
  );
}

// ─── MAIN DYNAMIC COMPONENT ──────────────────────────────────────────────────
export default function DynamicVenueReservation() {
  const navigate = useNavigate();
  const { venueSlug } = useParams();
  const location = useLocation();

  const [isDark, setIsDark] = useState(() => {
    try { const s = localStorage.getItem("bellevue-theme"); if (s !== null) return s === "dark"; } catch {}
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  });
  const toggleTheme = () => setIsDark(p => {
    const n = !p;
    try { localStorage.setItem("bellevue-theme", n ? "dark" : "light"); } catch {}
    return n;
  });

  const C = getTokens(isDark);

  const [venues,             setVenues]             = useState([]);
  const [loading,            setLoading]            = useState(true);
  const [selectedRoomId,     setSelectedRoomId]     = useState("");
  const [mode,               setMode]               = useState("whole");
  const [selectedSeat,       setSelectedSeat]       = useState(null);
  const [selectedTable,      setSelectedTable]      = useState(null);
  const [windowSize,         setWindowSize]         = useState({ width: window.innerWidth, height: window.innerHeight });
  const [modal,              setModal]              = useState(null);
  const [guests,             setGuests]             = useState(2);
  const [formData,           setFormData]           = useState(null);
  const [schedule,           setSchedule]           = useState(() => normalizeSchedule());
  const [refCode,            setRefCode]            = useState(null);
  const [submitting,         setSubmitting]         = useState(false);
  const [rebookFrom,         setRebookFrom]         = useState(null);
  const [lastBookingDetails, setLastBookingDetails] = useState(null);
  const [tableData,          setTableData]          = useState(null);
  const [layoutChecked,      setLayoutChecked]      = useState(false);
  const [error,              setError]              = useState("");
  const [success,            setSuccess]            = useState(null);

  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    event_time: "", special_requests: "",
    event_area: "", setup_tables: "", setup_chairs: "", setup_requirements: ""
  });

  const [holdSecondsLeft, setHoldSecondsLeft] = useState(24 * 60);
  const holdStartedRef = useRef(false);
  const echoRef        = useRef(null);
  const pollingRef     = useRef(null);

  const startHoldTimer = useCallback(() => {
    if (!holdStartedRef.current) { holdStartedRef.current = true; setHoldSecondsLeft(24 * 60); }
  }, []);

  const resetHoldTimer = useCallback(() => {
    holdStartedRef.current = false; setHoldSecondsLeft(24 * 60);
  }, []);

  useEffect(() => {
    if (modal !== "details" && modal !== "review") return;
    if (holdSecondsLeft <= 0) { setModal(null); resetHoldTimer(); return; }
    const id = setInterval(() => setHoldSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [modal, holdSecondsLeft]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    venueAPI.getAll({ include_archived: false, _t: Date.now() })
      .then((rows) => {
        if (!mounted) return;
        const rowsList = Array.isArray(rows) ? rows : [];
        setVenues(rowsList);

        // Populate and cache bellevue_venue_structure dynamically
        try {
          const groups = {};
          rowsList.forEach((v) => {
            if (!v.name) return;
            let wingLabel = "Main Wing";
            if (v.parent_id) {
              const p = rowsList.find(parent => parent.id === v.parent_id);
              if (p) {
                const isDining = String(p.name || "").toLowerCase().includes("hanakazu")
                  || String(p.name || "").toLowerCase().includes("phoenix")
                  || String(p.name || "").toLowerCase().includes("qsina");
                wingLabel = isDining ? "Dining" : (p.wing || "Main Wing");
              }
            } else {
              const isDining = String(v.name || "").toLowerCase().includes("hanakazu")
                || String(v.name || "").toLowerCase().includes("phoenix")
                || String(v.name || "").toLowerCase().includes("qsina");
              wingLabel = isDining ? "Dining" : (v.wing || "Main Wing");
            }
            const wingId = String(wingLabel).toLowerCase().replace(/[^a-z0-9]+/g, "-");
            if (!groups[wingId]) {
              groups[wingId] = { id: wingId, label: wingLabel, rooms: [] };
            }
            if (!groups[wingId].rooms.includes(v.name)) {
              groups[wingId].rooms.push(v.name);
            }
          });
          const order = { "main-wing": 0, "grand-ballroom": 1, "tower-wing": 2, "dining": 3 };
          const sortedStructure = Object.values(groups).sort((a, b) => {
            const oA = order[a.id] ?? 99;
            const oB = order[b.id] ?? 99;
            if (oA !== oB) return oA - oB;
            return a.label.localeCompare(b.label);
          });
          if (sortedStructure.length > 0) {
            localStorage.setItem("bellevue_venue_structure", JSON.stringify(sortedStructure));
          }
        } catch (e) {
          console.warn("Failed to update venue structure in client:", e);
        }
      })
      .catch(() => {
        if (mounted) setError("Unable to load venue configuration.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  // Find dynamic venue base
  const venue = useMemo(() => {
    const key = String(venueSlug || "").replace(/^\/+/, "").toLowerCase();
    return venues.find((v) => String(v.reservation_route).replace(/^\/+/, "").toLowerCase() === key)
      || venues.find((v) => String(v.reservation_route).split("/").pop().toLowerCase() === key)
      || venues.find((v) => String(v.slug).toLowerCase() === key)
      || null;
  }, [venues, venueSlug]);

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

  const ROOM = selectedRoom?.name || "";
  const WING = getActualWingForRoom(ROOM);
  const flag = (value, fallback = true) => value === undefined || value === null ? fallback : Boolean(value);
  const isVenueReservable =
    Boolean(venue && selectedRoom) &&
    flag(venue?.is_active) &&
    flag(venue?.is_visible) &&
    flag(venue?.reservations_enabled) &&
    flag(selectedRoom?.is_active) &&
    flag(selectedRoom?.is_visible) &&
    flag(selectedRoom?.reservations_enabled);

  // Load layout from localStorage
  useEffect(() => {
    if (!ROOM) return;
    setLayoutChecked(false);
    const localLayout = loadLayoutForClient(WING, ROOM);
    setTableData(localLayout);
    setLayoutChecked(true);
  }, [ROOM, WING]);

  const fetchAndMerge = useCallback(async () => {
    if (!ROOM) return;
    try {
      const params = new URLSearchParams({
        room: ROOM,
        wing: WING,
        per_page: "9999",
      });
      const venueId = selectedRoom?.parent_id || selectedRoom?.id || venue?.parent_id || venue?.id;
      if (venueId) params.set("venue_id", String(venueId));
      const res = await fetch(
        withSeatmapSchedule(`${API_BASE_URL}/reservations?${params.toString()}`, schedule),
        { headers: { Accept: "application/json" } }
      );
      if (!res.ok) return;
      const data = await res.json();
      const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setTableData(prev => {
        const base = prev || loadLayoutForClient(WING, ROOM);
        const merged = base ? mergeReservationStatusIntoLayout(base, rows) : prev;
        if (merged) {
          try { localStorage.setItem(layoutKey(WING, ROOM), JSON.stringify(merged)); } catch {}
        }
        return merged;
      });
    } catch (err) {
      console.error("[DynamicVenueReservation] Failed to fetch seat status:", err);
    }
  }, [ROOM, WING, selectedRoom?.id, selectedRoom?.parent_id, venue?.id, venue?.parent_id, schedule.eventDate, schedule.eventTime]);

  useEffect(() => {
    if (!ROOM) return;
    fetchAndMerge();
  }, [fetchAndMerge, ROOM]);

  useEffect(() => {
    const onScheduleChanged = () => {
      setSelectedSeat(null);
      setSelectedTable(null);
      fetchAndMerge();
    };
    window.addEventListener("seatmap:schedule-changed", onScheduleChanged);
    return () => window.removeEventListener("seatmap:schedule-changed", onScheduleChanged);
  }, [fetchAndMerge]);

  // Load classic slots if seatmap is not published
  const todayDate = new Date().toISOString().split("T")[0];
  const [classicDate, setClassicDate] = useState(todayDate);
  const [classicGuests, setClassicGuests] = useState(2);
  const [slots, setSlots] = useState([]);
  const [slotMessage, setSlotMessage] = useState("");

  useEffect(() => {
    if (tableData || !selectedRoom) return;
    setSlotMessage("Loading available times...");
    venueAPI.getTimeSlots({ venue_id: selectedRoom.id, room: selectedRoom.name, date: classicDate, guests: classicGuests })
      .then((data) => {
        const nextSlots = Array.isArray(data?.slots) ? data.slots : [];
        setSlots(nextSlots);
        setSlotMessage(data?.message || (nextSlots.length ? "" : "No reservation times configured for this date."));
        const firstAvailable = nextSlots.find((slot) => slot.available);
        setForm((current) => ({
          ...current,
          event_time: firstAvailable?.time || "",
        }));
      })
      .catch((err) => {
        setSlots([]);
        setSlotMessage(err.message || "Unable to load time slots.");
        setForm((current) => ({ ...current, event_time: "" }));
      });
  }, [tableData, selectedRoom, classicDate, classicGuests]);

  useEffect(() => {
    const onStorage = e => {
      if (e.key !== layoutKey(WING, ROOM)) return;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : null;
        if (parsed?.v === 2) setTableData(parsed);
      } catch {}
    };
    const onSeatMapSaved = e => {
      if (e.detail?.wing !== WING || e.detail?.room !== ROOM) return;
      try {
        const parsed = e.detail.payload ? JSON.parse(e.detail.payload) : null;
        if (parsed?.v === 2) setTableData(parsed);
      } catch {}
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("seatmap:saved", onSeatMapSaved);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("seatmap:saved", onSeatMapSaved);
    };
  }, [ROOM, WING]);

  // Real-time Websocket + Polling falls
  useEffect(() => {
    if (!ROOM) return;
    const pusherKey     = import.meta.env.VITE_PUSHER_APP_KEY;
    const pusherCluster = import.meta.env.VITE_PUSHER_APP_CLUSTER;
    let wsConnected = false;

    const startPolling = () => {
      if (pollingRef.current) return;
      pollingRef.current = setInterval(() => { fetchAndMerge(); }, 10_000);
    };
    const stopPolling = () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };

    if (!pusherKey || pusherKey === "your_key") {
      startPolling();
      return () => stopPolling();
    }

    try {
      echoRef.current = new Echo({ broadcaster: "pusher", key: pusherKey, cluster: pusherCluster });
      const echo = echoRef.current;
      const channel = echo.channel("reservations");
      const events = ["ReservationCreated","ReservationUpdated","ReservationDeleted","ReservationApproved","ReservationRejected","SeatReserved","TableReserved"];

      events.forEach(ev => channel.listen(ev, () => {
        wsConnected = true;
        stopPolling();
        fetchAndMerge();
      }));

      const fallbackTimer = setTimeout(() => {
        if (!wsConnected) startPolling();
      }, 8_000);

      return () => {
        clearTimeout(fallbackTimer);
        stopPolling();
        try { events.forEach(ev => channel.stopListening(ev)); } catch {}
      };
    } catch {
      startPolling();
      return () => stopPolling();
    }
  }, [ROOM, fetchAndMerge]);

  useEffect(() => {
    const h = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // UI Resolvers
  const getTables = () => {
    if (!tableData) return [];
    if (Array.isArray(tableData)) return tableData;
    return tableData.tables || [];
  };

  const getActiveTable = () => {
    const tables = getTables();
    if (selectedSeat && isStandaloneSelected()) return null;
    if (mode === "whole") return selectedTable || tables[0] || null;
    if (selectedTable) return selectedTable;
    if (selectedSeat && tables.length) {
      return tables.find(t => t.seats && t.seats.some(s => s.id === selectedSeat.id));
    }
    return null;
  };
  const isStandaloneSelected = () => {
    if (selectedSeat && tableData?.standaloneSeats) {
      return tableData.standaloneSeats.some(s => s.id === selectedSeat.id);
    }
    return false;
  };

  const handleSeatClick = (seat) => {
    if (!isVenueReservable) {
      alert("This venue is currently not available for online reservations.");
      return;
    }
    if (seat?.status !== "available") {
      alert("This seat is unavailable for the selected schedule.");
      return;
    }
    setSelectedTable(null);
    setSelectedSeat(prev => (prev?.id === seat.id ? null : seat));
  };
  const handleTableClick = (table) => {
    if (!isVenueReservable) {
      alert("This venue is currently not available for online reservations.");
      return;
    }
    const availableSeats = (table?.seats || []).filter((seat) => seat.status === "available").length;
    if (mode === "whole" && availableSeats < 1) {
      alert("This table has no available seats for the selected schedule.");
      return;
    }
    setSelectedSeat(null);
    setSelectedTable(prev => (prev?.id === table.id ? null : table));
    if (mode === "whole") setModal("guestCount");
  };

  const handleGuestContinue = (gCount) => {
    setGuests(gCount);
    setModal("details");
    startHoldTimer();
  };
  const handleReview = (details) => {
    setFormData(details);
    setSchedule(normalizeSchedule({ eventDate: details.eventDate, eventTime: details.eventTime }));
    setModal("review");
  };
  const handleEditDetails = () => {
    setModal("details");
  };

  // Submit bookings
  const handleSubmit = async () => {
    if (!formData) return;
    if (!isVenueReservable) {
      setError("This venue is currently not available for online reservations.");
      setModal(null);
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const activeTable = getActiveTable();
      const isStandalone = isStandaloneSelected();
      if (mode === "whole" && !activeTable) {
        throw new Error("Please select a table before submitting.");
      }
      if (mode === "individual" && !selectedSeat) {
        throw new Error("Please select a seat before submitting.");
      }
      const selectedSeatNumbers = isStandalone
        ? [String(selectedSeat?.num ?? selectedSeat?.id ?? "")]
        : mode === "whole"
          ? (activeTable?.seats || [])
              .filter((seat) => seat.status === "available")
              .slice(0, Number(guests || 1))
              .map((seat) => String(seat.num ?? seat.id))
          : [String(selectedSeat?.num ?? selectedSeat?.id ?? "")];

      const payload = {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.phone,
        venue_id: selectedRoom?.parent_id || selectedRoom?.id || venue.parent_id || venue.id,
        room: ROOM,
        table_number: isStandalone ? "STANDALONE" : (activeTable ? String(activeTable.id) : "GENERAL"),
        seat_number: selectedSeatNumbers.filter(Boolean).join(","),
        guests_count: Number(guests || 1),
        event_date: formData.eventDate,
        event_time: formData.eventTime,
        special_requests: formData.specialRequests,
        type: mode,
        ...(venue.type !== "dining" ? {
          event_area: formData.eventArea || "",
          setup_tables: formData.setupTables ? Number(formData.setupTables) : null,
          setup_chairs: formData.setupChairs ? Number(formData.setupChairs) : null,
          setup_requirements: formData.setupRequirements || "",
        } : {}),
      };

      const result = await reservationAPI.create(payload);
      setLastBookingDetails(result?.data || result);
      setRefCode(result?.reference_code || result?.data?.reference_code);

      // Perform local seat state hold updates
      setTableData(prev => {
        if (!prev) return prev;
        if (activeTable) {
          const tables = (prev.tables || []).map(t => {
            if (t.id !== activeTable.id) return t;
            if (mode === "individual") {
              return { ...t, seats: t.seats.map(s => s.id === selectedSeat?.id ? { ...s, status: "unavailable" } : s) };
            }
            let marked = 0;
            return {
              ...t,
              seats: t.seats.map(s => {
                if (marked < guests && s.status === "available") { marked++; return { ...s, status: "unavailable" }; }
                return s;
              }),
            };
          });
          const updated = { ...prev, tables };
          try { localStorage.setItem(layoutKey(WING, ROOM), JSON.stringify(updated)); } catch {}
          return updated;
        }
        if (isStandalone && selectedSeat) {
          const updated = {
            ...prev,
            standaloneSeats: (prev.standaloneSeats || []).map((seat) =>
              seat.id === selectedSeat.id ? { ...seat, status: "unavailable" } : seat
            ),
          };
          try { localStorage.setItem(layoutKey(WING, ROOM), JSON.stringify(updated)); } catch {}
          return updated;
        }
        return prev;
      });

      setModal("success");
      resetHoldTimer();
    } catch (err) {
      setError(err.message || "Failed to submit booking");
      setModal(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Classic Form Submit
  const handleClassicSubmit = async (e) => {
    e.preventDefault();
    if (!isVenueReservable) {
      setError("This venue is currently not available for online reservations.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess(null);

    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        venue_id: selectedRoom?.parent_id || selectedRoom?.id || venue.parent_id || venue.id,
        room: ROOM,
        table_number: "GENERAL",
        seat_number: "",
        guests_count: Number(classicGuests || 1),
        event_date: classicDate,
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

      const result = await reservationAPI.create(payload);
      setSuccess(result?.data || result);
      setForm({ name: "", email: "", phone: "", event_time: "", special_requests: "", event_area: "", setup_tables: "", setup_chairs: "", setup_requirements: "" });
    } catch (err) {
      setError(err.message || "Failed to submit booking request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setModal(null); setSelectedSeat(null); setSelectedTable(null);
    setRefCode(null); setFormData(null); setGuests(2);
    resetHoldTimer();
    fetchAndMerge();
  };

  const isMobile   = windowSize.width < 640;
  const isTablet   = windowSize.width < 1024;
  const activeTable = getActiveTable();
  const isStandalone = isStandaloneSelected();
  const hasSeatLayout = Boolean(tableData && (((tableData.tables || []).length > 0) || ((tableData.standaloneSeats || []).length > 0)));
  const shouldUseClassicForm = false;
  const canProceed  = isVenueReservable && mode === "individual" && selectedSeat && selectedSeat.status === "available";
  const canReserveWhole = isVenueReservable && mode === "whole" && Boolean(activeTable);
  const seatRatio   = activeTable ? getSeatRatio(activeTable) : null;

  const displayTable = !hasSeatLayout
    ? "No layout yet"
    : isStandalone
      ? "Standalone"
      : mode === "whole"
        ? (activeTable ? `Table ${activeTable.id}` : "-")
        : (selectedTable ? `Table ${selectedTable.id}` : "-");
  const displaySeat  = !hasSeatLayout
    ? "No seats published"
    : mode === "individual"
      ? (selectedSeat ? `Seat ${selectedSeat.num ?? selectedSeat.id}` : "Select a seat")
      : getWholeSeatLabel(guests, activeTable);
  const venueImage = imageUrl(venue?.image);

  const detailsPrefill = formData ? { firstName: formData.firstName || "", lastName: formData.lastName || "", email: formData.email || "", phone: formData.phone || "+63", eventDate: formData.eventDate || "", eventTime: formData.eventTime || "19:00", specialRequests: formData.specialRequests || "", eventArea: formData.eventArea || "", setupTables: formData.setupTables || "", setupChairs: formData.setupChairs || "", setupRequirements: formData.setupRequirements || "" } : { firstName: "", lastName: "", email: "", phone: "+63", eventDate: schedule.eventDate || classicDate || "", eventTime: schedule.eventTime || "19:00", specialRequests: "" };
  const reservationLabel = venue?.type === "dining" ? "Table Reservation" : "Seat Reservation";
  const venueTitle = selectedRoom?.display_name || selectedRoom?.name || venue?.display_name || venue?.name || "Venue";
  const venueDescription = venue?.description || `Book your preferred ${venue?.type === "dining" ? "table" : "space"} at ${venueTitle}. Select your reservation type and check availability before choosing from the map.`;

  const NAV_H            = 64;
  const MOBILE_HEADER_H  = 62;
  const MOBILE_TABS_H    = 48;
  const BOTTOM_SHEET_H   = 180;
  const SAFE_AREA_BOTTOM = 34;

  const mobileMapHeight = Math.max(
    200,
    windowSize.height - NAV_H - MOBILE_HEADER_H - MOBILE_TABS_H - BOTTOM_SHEET_H - SAFE_AREA_BOTTOM
  );

  const modalTableData = isStandalone ? null : (mode === "individual" ? (selectedSeat ? tableData?.tables?.find(t => t.seats?.some(s => s.id === selectedSeat.id)) : null) : activeTable);
  const legendEntries = Object.entries(STATUS_COLORS).filter(([key]) => LEGEND_STATUSES.includes(key));

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.pageBg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.body }}>
        <Spinner size={34} C={C} />
      </div>
    );
  }

  if (!venue) {
    return (
      <div style={{ minHeight: "100vh", background: C.pageBg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: C.textPrimary, fontFamily: F.body }}>
        <h1 style={{ fontFamily: F.display, fontSize: 32, margin: 0 }}>Venue Not Found</h1>
        <p style={{ color: C.textSecondary }}>This route is not connected to any active venue.</p>
        <GhostBtn onClick={() => navigate("/venues")} C={C} style={{ maxWidth: 160 }}>Back to Venues</GhostBtn>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggle: toggleTheme }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.97) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>

      <div style={{ minHeight: "100dvh", fontFamily: F.body, background: C.pageBg, transition: "background 0.30s", position: "relative" }}>
        {/* Blurred Background */}
        <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: venueImage ? `url(${venueImage})` : "url('/src/assets/bg-login.jpeg')", backgroundSize: "cover", backgroundPosition: "center", filter: isDark ? "blur(6px) brightness(0.35)" : "blur(6px) brightness(0.45) saturate(0.4)", transform: "scale(1.05)", transition: "filter 0.40s" }} />
          <div style={{ position: "absolute", inset: 0, background: isDark ? "rgba(12,11,10,0.75)" : "rgba(237,233,224,0.65)", transition: "background 0.40s" }} />
        </div>

        <SharedNavbar isDark={isDark} toggle={toggleTheme} />

        {/* Dynamic Selector dropdown for room switching if children present */}
        {roomChoices.length > 1 && (
          <div style={{ position: "absolute", top: 80, left: 20, zIndex: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontFamily: F.label, textTransform: "uppercase", letterSpacing: "0.14em", color: C.gold, fontWeight: 700 }}>Select Area:</span>
            <select value={selectedRoomId} onChange={(e) => { setSelectedRoomId(e.target.value); setSelectedSeat(null); setSelectedTable(null); }} style={{ padding: "6px 12px", border: `1px solid ${C.borderAccent}`, borderRadius: 8, background: isDark ? "rgba(16,14,10,0.85)" : "rgba(255,255,255,0.92)", color: C.textPrimary, fontFamily: F.body, fontSize: 12, outline: "none", cursor: "pointer" }}>
              {roomChoices.map(c => (
                <option key={c.id} value={c.id}>{c.display_name || c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* If no seat layout exists, fallback to a consistent direct booking form. */}
        {!layoutChecked ? (
          <div style={{ paddingTop: 150, minHeight: "55vh", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Spinner size={28} C={C} />
          </div>
        ) : shouldUseClassicForm ? (
          <div style={{ paddingTop: 130, paddingBottom: 50, position: "relative", zIndex: 1 }}>
            <DynamicReservationForm
              venue={venue}
              selectedRoom={selectedRoom}
              date={classicDate}
              setDate={setClassicDate}
              guests={classicGuests}
              setGuests={setClassicGuests}
              slots={slots}
              slotMessage={slotMessage}
              form={form}
              setForm={setForm}
              submitting={submitting}
              submit={handleClassicSubmit}
              error={error}
              success={success}
              C={C}
              isDark={isDark}
              ROOM={ROOM}
              WING={WING}
              isReservable={isVenueReservable}
            />
          </div>
        ) : (
          /* OTHERWISE RENDER FULL PREMIUM INTERACTIVE SEATMAP EXPERIENCE */
          isMobile ? (
            /* MOBILE LAYOUT */
            <div style={{ position: "relative", zIndex: 1, paddingTop: NAV_H, display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", height: MOBILE_HEADER_H, boxSizing: "border-box", flexShrink: 0, background: isDark ? "rgba(10,9,8,0.92)" : "rgba(247,244,238,0.95)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: `1px solid ${C.borderAccent}` }}>
                <button onClick={() => navigate("/venues")} style={{ width: 34, height: 34, borderRadius: "50%", background: "transparent", border: `1px solid ${C.borderDefault}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 }} title="Back">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.textSecondary }}><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F.label, fontSize: 8, letterSpacing: "0.22em", color: C.gold, fontWeight: 700, textTransform: "uppercase" }}>{venue.type === "dining" ? "Table Reservation" : "Seat Reservation"}</div>
                  <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600, color: C.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ROOM}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 0, padding: "8px 16px", height: MOBILE_TABS_H, boxSizing: "border-box", flexShrink: 0, background: isDark ? "rgba(10,9,8,0.85)" : "rgba(247,244,238,0.90)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderBottom: `1px solid ${C.borderDefault}`, alignItems: "center" }}>
                {[["whole", "Whole Section/Table"], ["individual", "Individual Seat"]].map(([val, label], i) => (
                  <button key={val} onClick={() => { setMode(val); if (val === "whole") setSelectedSeat(null); else setSelectedTable(null); }} style={{ flex: 1, padding: "9px 0", background: mode === val ? C.gold : "transparent", border: `1px solid ${mode === val ? C.gold : C.borderDefault}`, borderRadius: i === 0 ? "8px 0 0 8px" : "0 8px 8px 0", color: mode === val ? C.textOnAccent : C.textSecondary, fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.18s" }}>{label}</button>
                ))}
              </div>

              <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", background: C.surfaceBase }}>
                <div style={{ padding: "10px 16px", background: isDark ? "rgba(10,9,8,0.88)" : "rgba(247,244,238,0.92)", borderBottom: `1px solid ${C.borderDefault}` }}>
                  <ScheduleGate schedule={schedule} onChange={setSchedule} roomLabel={ROOM} isDark={isDark} guests={guests} />
                </div>
                <div style={{ width: "100%", height: "100%", overflow: "auto", WebkitOverflowScrolling: "touch", display: "flex", alignItems: "flex-start", justifyContent: "flex-start" }}>
                  <div style={{ width: "100%", minHeight: "100%", transformOrigin: "top left" }}>
                    {hasSeatLayout ? (
                      <SeatMap tableData={tableData} editMode={false} mode={mode} selectedSeat={selectedSeat} onSeatClick={handleSeatClick} onTableClick={handleTableClick} windowWidth={windowSize.width} wing={WING} room={ROOM} />
                    ) : (
                      <div style={{ minHeight: mobileMapHeight, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, color: C.textSecondary, textAlign: "center", fontSize: 13, lineHeight: 1.7 }}>
                        No interactive seat layout has been published for this venue yet.
                      </div>
                    )}
                  </div>
                </div>
                {/* Legend overlay */}
                <div style={{ position: "absolute", bottom: 10, left: 10, background: isDark ? "rgba(10,9,8,0.88)" : "rgba(247,244,238,0.92)", border: `1px solid ${C.borderDefault}`, borderRadius: 10, padding: "8px 10px", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 2, display: "flex", flexDirection: "column", gap: 3 }}>
                  {legendEntries.map(([key, color]) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                      <span style={{ fontFamily: F.body, fontSize: 10, color: C.textSecondary, fontWeight: 500, textTransform: "capitalize" }}>{key}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile Reserve button sheet */}
              <div style={{ flexShrink: 0, background: isDark ? "rgba(10,9,8,0.95)" : "rgba(255,255,255,0.98)", borderTop: `1px solid ${C.borderDefault}`, padding: "14px 16px", display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: C.surfaceInput, border: `1px solid ${C.borderDefault}` }}>
                    <div style={{ fontFamily: F.label, fontSize: 8, letterSpacing: "0.16em", color: C.textTertiary, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Selection</div>
                    <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, color: C.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displaySeat}</div>
                  </div>
                </div>
                <button
                  onClick={(canReserveWhole || canProceed) ? () => setModal("guestCount") : undefined}
                  disabled={!(canReserveWhole || canProceed)}
                  style={{ width: "100%", padding: "15px", background: (canReserveWhole || canProceed) ? C.gold : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"), border: "none", borderRadius: 12, fontFamily: F.label, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: (canReserveWhole || canProceed) ? C.textOnAccent : C.textTertiary, cursor: (canReserveWhole || canProceed) ? "pointer" : "not-allowed", transition: "all 0.18s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {!isVenueReservable
                    ? "Reservations Unavailable"
                    : mode === "whole"
                    ? (activeTable ? "Reserve This Table" : "Tap a Table to Reserve")
                    : selectedSeat ? "Reserve This Seat" : "Select a Seat First"
                  }
                </button>
              </div>
            </div>
          ) : (
            /* DESKTOP LAYOUT */
            <div style={{ position: "relative", zIndex: 1, paddingTop: 64, paddingBottom: 32, minHeight: "calc(100vh - 64px)", boxSizing: "border-box" }}>
              <div style={{ maxWidth: 1280, margin: "0 auto", padding: isTablet ? "28px 24px" : "36px 48px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, animation: "fadeUp 0.28s ease" }}>
                  <button onClick={() => navigate("/venues")} title="Back to venues"
                    style={{ width: 36, height: 36, borderRadius: "50%", background: "transparent", border: `1px solid ${C.borderDefault}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.18s", padding: 0, flexShrink: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.background = C.goldFaint; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = "transparent"; }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.textSecondary }}><path d="m15 18-6-6 6-6" /></svg>
                  </button>
                  <span style={{ display: "inline-block", width: 20, height: "1px", background: C.gold, opacity: 0.5 }} />
                  <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.22em", color: C.gold, fontWeight: 700, textTransform: "uppercase" }}>All Venues</span>
                </div>

                <div style={{ marginBottom: 28, animation: "fadeUp 0.32s ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ display: "inline-block", width: 24, height: "1px", background: C.gold, opacity: 0.6 }} />
                    <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.26em", color: C.gold, fontWeight: 700, textTransform: "uppercase" }}>{reservationLabel}</span>
                  </div>
                  <h1 style={{ fontFamily: F.display, fontSize: isTablet ? 34 : 42, fontWeight: 600, color: C.textPrimary, lineHeight: 1.1, margin: "0 0 10px", letterSpacing: "0.01em" }}>
                    {venueTitle}
                  </h1>
                  <p style={{ fontFamily: F.body, fontSize: 13.5, color: C.textSecondary, margin: 0, lineHeight: 1.70, maxWidth: 640 }}>
                    {venueDescription}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, flexWrap: "wrap", animation: "fadeUp 0.34s ease" }}>
                  <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.22em", color: C.textSecondary, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>Reserve a:</span>
                  <div style={{ display: "flex", alignItems: "center", background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", borderRadius: 8, padding: 3, gap: 3, border: `1px solid ${C.borderDefault}` }}>
                    {[["whole", venue?.type === "dining" ? "Whole Table" : "Whole Space"], ["individual", "Individual Seat"]].map(([val, label]) => (
                      <button key={val}
                        onClick={() => { setMode(val); if (val === "whole") setSelectedSeat(null); else setSelectedTable(null); }}
                        style={{ padding: "8px 18px", border: "none", background: mode === val ? C.gold : "transparent", color: mode === val ? C.textOnAccent : C.textSecondary, cursor: "pointer", fontSize: 10, letterSpacing: "0.12em", fontWeight: 700, fontFamily: F.label, borderRadius: 6, transition: "all 0.18s", outline: "none", textTransform: "uppercase" }}
                      >{label}</button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) 314px", gap: 24, alignItems: "start", animation: "fadeUp 0.36s ease" }}>
                
                {/* Visual Workspace Card */}
                <div style={{ background: C.surfaceBase, border: `1px solid ${C.cardBorder}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", height: isTablet ? 580 : 660, boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: `1px solid ${C.divider}`, background: C.surfaceRaised }}>
                    <div>
                      <div style={{ fontFamily: F.label, fontSize: 8, letterSpacing: "0.20em", color: C.gold, fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>Interactive Space Planner</div>
                      <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 600, color: C.textPrimary }}>{ROOM} ({WING})</div>
                    </div>
                    {/* Legend desktop */}
                    <div style={{ display: "flex", gap: 14 }}>
                      {legendEntries.map(([key, color]) => (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                          <span style={{ fontFamily: F.body, fontSize: 10, color: C.textSecondary, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{key}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SeatMap workspace */}
                  <div style={{ flex: 1, background: C.pageBg, position: "relative", overflow: "hidden" }}>
                    <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
                      {hasSeatLayout ? (
                        <SeatMap tableData={tableData} editMode={false} mode={mode} selectedSeat={selectedSeat} onSeatClick={handleSeatClick} onTableClick={handleTableClick} windowWidth={windowSize.width} wing={WING} room={ROOM} />
                      ) : (
                        <div style={{ height: "100%", minHeight: 420, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 48 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: C.goldFaint, border: `1px solid ${C.borderAccent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" /></svg>
                          </div>
                          <div style={{ fontFamily: F.body, fontSize: 13, color: C.textSecondary, textAlign: "center", lineHeight: 1.7 }}>
                            No interactive seat layout has been published for this venue yet.<br />
                            <span style={{ fontSize: 12, color: C.textTertiary }}>Configure tables or seats in the admin Seat Map before accepting online reservations.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side booking workspace */}
                <div style={{ display: "grid", gap: 14 }}>
                  <ScheduleGate schedule={schedule} onChange={setSchedule} roomLabel={ROOM} isDark={isDark} guests={guests} />

                  <div style={{ background: C.surfaceBase, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 22, boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>
                    <SectionLabel C={C} style={{ marginBottom: 14 }}>Status Legend</SectionLabel>
                    <div style={{ display: "grid", gap: 8 }}>
                      {legendEntries.map(([key, color]) => (
                        <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                          <span style={{ fontFamily: F.body, fontSize: 12, color: C.textSecondary, fontWeight: 500 }}>
                            {key === "reserved" ? "Approved / Reserved" : key.charAt(0).toUpperCase() + key.slice(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: C.surfaceBase, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 22, boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>

                    <SectionLabel C={C}>Your Selection</SectionLabel>
                    <div style={{ background: C.surfaceRaised, border: `1px solid ${C.borderDefault}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
                      {[
                        ...(!isStandalone ? [["Table", displayTable, false, seatRatio ?? null]] : []),
                        [mode === "whole" && guests > 1 ? "Seats" : "Seat", displaySeat, true, null],
                        ["Wing / Area", WING, false, null]
                      ].map(([label, value, isGold, badge]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: `1px solid ${C.divider}` }}>
                          <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>{label}</span>
                          <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: isGold ? C.gold : C.textPrimary, textAlign: "right", display: "flex", alignItems: "center", gap: 5 }}>
                            {value}
                            {badge && <span style={{ background: C.goldFaint, border: `1px solid ${C.borderAccent}`, borderRadius: 4, padding: "1px 5px", fontSize: 9, color: C.gold, fontWeight: 700, fontFamily: F.label }}>{badge}</span>}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={(canReserveWhole || canProceed) ? () => setModal("guestCount") : undefined}
                      disabled={!(canReserveWhole || canProceed)}
                      style={{ width: "100%", padding: "13px", background: (canReserveWhole || canProceed) ? C.gold : C.surfaceInput, border: (canReserveWhole || canProceed) ? "none" : `1px solid ${C.borderDefault}`, borderRadius: 8, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: (canReserveWhole || canProceed) ? C.textOnAccent : C.textTertiary, cursor: (canReserveWhole || canProceed) ? "pointer" : "not-allowed", transition: "all 0.20s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      onMouseEnter={e => { if (canReserveWhole || canProceed) e.currentTarget.style.background = C.goldLight; }}
                      onMouseLeave={e => { if (canReserveWhole || canProceed) e.currentTarget.style.background = C.gold; }}
                    >
                      {!isVenueReservable ? "Reservations Unavailable" : mode === "whole" ? "Reserve This Table" : selectedSeat ? "Reserve This Seat" : "Select a Seat First"}
                    </button>
                  </div>
                </div>

              </div>
            </div>
            </div>
          )
        )}
      </div>

      {/* ── Booking Modals ── */}
      {modal === "guestCount" && (
        <ModalGuestCount seatData={mode === "individual" ? selectedSeat : null} tableData={modalTableData} mode={mode} isStandalone={isStandalone} onContinue={handleGuestContinue} onCancel={() => setModal(null)} C={C} isDark={isDark} ROOM={ROOM} />
      )}
      {modal === "details" && (
        <ModalDetails tableData={modalTableData} seatData={selectedSeat} mode={mode} guests={guests} isStandalone={isStandalone} onReview={handleReview} onCancel={() => { setModal(null); resetHoldTimer(); }} prefill={detailsPrefill} C={C} isDark={isDark} secondsLeft={holdSecondsLeft} onTimerExpired={() => { setModal(null); resetHoldTimer(); }} ROOM={ROOM} WING={WING} venueType={venue?.type} />
      )}
      {modal === "review" && formData && (
        <ModalReview form={formData} guests={guests} mode={mode} tableData={modalTableData} seatData={selectedSeat} isStandalone={isStandalone} onSubmit={handleSubmit} onEdit={handleEditDetails} submitting={submitting} isRebook={!!rebookFrom} rebookFrom={rebookFrom} C={C} ROOM={ROOM} WING={WING} />
      )}
      {modal === "success" && (
        <ModalSuccess refCode={refCode} onBack={handleBack} mode={mode} guests={guests} isRebook={!!rebookFrom} bookingDetails={lastBookingDetails} C={C} isDark={isDark} ROOM={ROOM} />
      )}
    </ThemeContext.Provider>
  );
}
