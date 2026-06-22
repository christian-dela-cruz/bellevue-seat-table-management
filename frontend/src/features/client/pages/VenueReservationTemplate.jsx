// src/features/client/pages/VenueReservationTemplate.jsx
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
import BellevueDropdown from "../../../components/BellevueDropdown";

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
    "Alabang Function Room": "Main Wing",
    "Business Center": "Main Wing",
    "Laguna Ballroom 1": "Main Wing",
    "Laguna Ballroom 2": "Main Wing",
    "20/20 Function Room A": "Main Wing",
    "20/20 Function Room B": "Main Wing",
    "20/20 Function Room C": "Main Wing",
    "Grand Ballroom A": "Grand Ballroom",
    "Grand Ballroom B": "Grand Ballroom",
    "Grand Ballroom C": "Grand Ballroom",
    "Tower 1": "Tower Wing",
    "Tower 2": "Tower Wing",
    "Tower 3": "Tower Wing",
    "Qsina": "Dining",
    "Hanakazu": "Dining",
    "Phoenix Court": "Dining",
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
  } catch { }
  return "Main Wing";
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function imageUrl(image) {
  if (!image) return "";
  const value = String(image).trim();
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  
  const apiRoot = API_BASE_URL.replace(/\/api\/?$/, "");
  let cleanPath = value.replace(/\\/g, "/").replace(/^\/+/, "");
  
  if (!cleanPath.includes("/")) {
    return `${apiRoot}/images/${cleanPath}`;
  }
  
  if (cleanPath.startsWith("function-rooms/") && !cleanPath.startsWith("images/")) {
    cleanPath = "images/" + cleanPath;
  }
  
  return `${apiRoot}/${cleanPath}`;
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const ThemeContext = createContext({ isDark: true, toggle: () => { } });
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
      textPrimary: "#EDE8DF", textSecondary: "#C7BEAF", // Improved contrast from #8A8278
      textTertiary: "#9C9283", textOnAccent: "#0A0908", // Improved contrast from rgba(237,232,223,0.32)
      red: "#B85C5C", redFaint: "rgba(184,92,92,0.08)", redBorder: "rgba(184,92,92,0.20)",
      green: "#4A9E7E", greenFaint: "rgba(74,158,126,0.08)", greenBorder: "rgba(74,158,126,0.20)",
      badgePending: { bg: "rgba(196,163,90,0.10)", color: "#C4A35A", dot: "#C4A35A" },
      badgeApproved: { bg: "rgba(74,158,126,0.10)", color: "#4A9E7E", dot: "#4A9E7E" },
      badgeRejected: { bg: "rgba(184,92,92,0.10)", color: "#B85C5C", dot: "#B85C5C" },
      navBg: "rgba(10,9,8,0.95)", navBorder: "rgba(196,163,90,0.12)",
      divider: "rgba(255,255,255,0.05)", inputFocusShadow: "0 0 0 3px rgba(196,163,90,0.12)",
      modalOverlay: "rgba(10,9,8,0.88)",
      statusNote: { pending: "rgba(196,163,90,0.05)", approved: "rgba(74,158,126,0.05)", rejected: "rgba(184,92,92,0.05)" },
      statusNoteBorder: { pending: "rgba(196,163,90,0.15)", approved: "rgba(74,158,126,0.15)", rejected: "rgba(184,92,92,0.15)" },
      headerGradient: "linear-gradient(160deg,#1C1A16 0%,#131210 100%)",
      spinnerBorder: "rgba(255,255,255,0.15)", spinnerTop: "#C4A35A",
      cardBg: "#111009", cardBorder: "rgba(255,255,255,0.06)",
      bottomSheet: "#161410",
      btnDisabledBg: "#282622",
      btnDisabledText: "#6A645A",
    }
    : {
      gold: "#8C6B2A", goldLight: "#A07D38", goldDim: "#6B5020",
      goldFaint: "rgba(140,107,42,0.07)", goldFaintest: "rgba(140,107,42,0.04)",
      pageBg: "#F7F4EE", surfaceBase: "#FFFFFF", surfaceRaised: "#FAF8F4",
      surfaceInput: "#FFFFFF",
      borderFaint: "rgba(0,0,0,0.04)", borderDefault: "rgba(0,0,0,0.08)",
      borderStrong: "rgba(0,0,0,0.13)", borderAccent: "rgba(140,107,42,0.28)",
      textPrimary: "#18140E", textSecondary: "#4E4537", // Improved contrast from #7A7060
      textTertiary: "#7A7060", textOnAccent: "#FFFFFF", // Improved contrast from rgba(24,20,14,0.35)
      red: "#A03838", redFaint: "rgba(160,56,56,0.07)", redBorder: "rgba(160,56,56,0.18)",
      green: "#2E7A5A", greenFaint: "rgba(46,122,90,0.07)", greenBorder: "rgba(46,122,90,0.18)",
      badgePending: { bg: "rgba(140,107,42,0.09)", color: "#8C6B2A", dot: "#8C6B2A" },
      badgeApproved: { bg: "rgba(46,122,90,0.09)", color: "#2E7A5A", dot: "#2E7A5A" },
      badgeRejected: { bg: "rgba(160,56,56,0.09)", color: "#A03838", dot: "#A03838" },
      navBg: "rgba(247,244,238,0.96)", navBorder: "rgba(140,107,42,0.14)",
      divider: "rgba(0,0,0,0.05)", inputFocusShadow: "0 0 0 3px rgba(140,107,42,0.10)",
      modalOverlay: "rgba(10,9,8,0.65)",
      statusNote: { pending: "rgba(140,107,42,0.05)", approved: "rgba(46,122,90,0.05)", rejected: "rgba(160,56,56,0.05)" },
      statusNoteBorder: { pending: "rgba(140,107,42,0.18)", approved: "rgba(46,122,90,0.18)", rejected: "rgba(160,56,56,0.18)" },
      headerGradient: "linear-gradient(160deg,#FAF7F2 0%,#F3EDE0 100%)",
      spinnerBorder: "rgba(0,0,0,0.12)", spinnerTop: "#8C6B2A",
      cardBg: "#FFFFFF", cardBorder: "rgba(0,0,0,0.07)",
      bottomSheet: "#FFFFFF",
      btnDisabledBg: "#E1DDD5",
      btnDisabledText: "#8A8070",
    };
}

const F = {
  display: "'Inter','Helvetica Neue',Arial,sans-serif",
  body: "'Inter','Helvetica Neue',Arial,sans-serif",
  mono: "'DM Mono','Courier New',monospace",
  label: "'Inter','Helvetica Neue',Arial,sans-serif",
};

const LEGEND_STATUSES = ["available", "pending", "unavailable"];

function layoutKey(wing, room) {
  const actualWing = getActualWingForRoom(room);
  return `seatmap_layout:${actualWing}:${room}`;
}

function normaliseApiStatus(raw) {
  const s = (raw || "available").toLowerCase();
  if (s === "approved" || s === "reserved") return "reserved";
  if (s === "rejected") return "rejected";
  if (s === "pending") return "pending";
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

function seatMapPayloadTime(layout) {
  const raw =
    layout?.seatmap_saved_at ||
    layout?.seatmapSavedAt ||
    layout?.updated_at ||
    layout?.editor?.seatmap_saved_at ||
    layout?.editor?.updated_at;
  const time = Date.parse(raw || "");
  return Number.isFinite(time) ? time : 0;
}

function isIncomingSeatMapStale(currentLayout, incomingLayout) {
  if (!currentLayout || !incomingLayout) return false;
  const currentTime = seatMapPayloadTime(currentLayout);
  const incomingTime = seatMapPayloadTime(incomingLayout);
  if (!currentTime) return false;
  if (!incomingTime) return true;
  return incomingTime < currentTime;
}

const loadStoredReservations = () => {
  try {
    const raw = localStorage.getItem("bellevue_reservations");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveStoredReservations = (reservations) => {
  try { localStorage.setItem("bellevue_reservations", JSON.stringify(reservations)); } catch { }
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
    if (bookable.length > 0) {
      const first = String(bookable[0]);
      if (first.toLowerCase().startsWith("seat")) {
        return bookable.join(", ");
      }
      return `Seat ${bookable.join(", ")}`;
    }
  }
  return `Seat ${Array.from({ length: guests }, (_, i) => i + 1).join(", ")}`;
};

const formatSeatLabel = (seat) => {
  if (!seat) return "";
  const num = String(seat.num ?? seat.id ?? "");
  return num.toLowerCase().startsWith("seat") ? num : `Seat ${num}`;
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
        border: `1px solid ${C.borderDefault}`, cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "border-color 0.18s, background 0.18s", padding: 0, zIndex: 10,
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.background = C.goldFaint; } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = "transparent"; } }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke={C.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

function ModalShell({ children, onClose, disabled, C, maxWidth = 720 }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: C.modalOverlay, zIndex: 20000, display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 20px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={e => { if (e.target === e.currentTarget && !disabled) onClose(); }}
    >
      <div style={{ display: "flex", flexDirection: "column", background: C.surfaceBase, borderRadius: 16, width: "100%", maxWidth, maxHeight: "calc(100vh - 40px)", boxShadow: "0 30px 90px rgba(0,0,0,0.50)", border: `1px solid ${C.borderAccent}`, fontFamily: F.body, position: "relative", animation: "modalIn 0.22s cubic-bezier(0.16,1,0.3,1)", overflow: "hidden" }}>
        <div style={{ flexShrink: 0, height: "4px", background: `linear-gradient(90deg, transparent 0%, ${C.gold} 30%, ${C.gold} 70%, transparent 100%)` }} />
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ eyebrow, title, onClose, disabled, C, meta }) {
  return (
    <div style={{ flexShrink: 0, background: C.headerGradient, padding: "24px 28px 20px", position: "sticky", top: 0, zIndex: 2, borderBottom: `1px solid ${C.divider}` }}>
      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 20 }}>
        <CloseBtn onClick={onClose} disabled={disabled} C={C} />
      </div>
      <div style={{ textAlign: "center", paddingRight: 0 }}>
        {eyebrow && <div style={{ fontFamily: F.label, fontSize: 8.5, letterSpacing: "0.26em", color: C.gold, fontWeight: 800, textTransform: "uppercase", marginBottom: 6 }}>{eyebrow}</div>}
        <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 600, color: C.textPrimary, letterSpacing: "0.02em", lineHeight: 1.2 }}>{title}</div>
        {meta && <div style={{ width: "100%" }}>{meta}</div>}
      </div>
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled = false, loading = false, C, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled || loading}
      style={{ width: "100%", padding: "13px", background: disabled ? C.btnDisabledBg : C.gold, border: "none", borderRadius: 8, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: disabled ? C.btnDisabledText : C.textOnAccent, cursor: disabled || loading ? "not-allowed" : "pointer", transition: "all 0.20s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8, ...style }}
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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 18, width: "100%", maxWidth: 440, margin: "18px auto 0" }}>
      {steps.map((label, i) => {
        const idx = i + 1; const done = step > idx; const active = step === idx;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: done ? C.gold : active ? C.goldFaint : C.surfaceInput,
                border: done ? "none" : active ? `1.5px solid ${C.gold}` : `1.5px solid ${C.borderDefault}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.25s ease",
                boxShadow: active ? `0 0 10px ${C.gold}50` : "none"
              }}>
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textOnAccent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <span style={{ fontFamily: F.label, fontSize: 11, fontWeight: 700, color: active ? C.gold : C.textSecondary }}>
                    {idx}
                  </span>
                )}
              </div>
              <span style={{
                fontFamily: F.label,
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: done ? C.gold : active ? C.textPrimary : C.textSecondary,
                opacity: done || active ? 1 : 0.60,
                whiteSpace: "nowrap",
                textTransform: "uppercase",
                transition: "all 0.25s ease"
              }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1,
                height: 1.5,
                minWidth: 40,
                marginLeft: 12,
                marginRight: 12,
                background: done ? `linear-gradient(90deg, ${C.gold}, ${C.gold})` : `linear-gradient(90deg, ${C.borderDefault}, ${C.borderDefault})`,
                borderRadius: 2,
                transition: "background 0.25s ease"
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, onChange, onBlur, type = "text", placeholder = "", C, isDark, required = false, min, rows, error, isValid, touched }) {
  const [focused, setFocused] = useState(false);
  const isTextarea = type === "textarea";

  const hasError = touched && error;
  const isCorrect = touched && isValid && required;

  const borderColor = hasError
    ? C.red
    : isCorrect
      ? C.green
      : focused
        ? C.gold
        : C.borderDefault;

  const focusShadow = hasError
    ? "0 0 0 3px rgba(184,92,92,0.12)"
    : isCorrect
      ? "0 0 0 3px rgba(74,158,126,0.12)"
      : C.inputFocusShadow;

  const labelColor = hasError
    ? C.red
    : focused
      ? C.gold
      : C.textSecondary;

  const inputStyle = {
    width: "100%", boxSizing: "border-box", padding: "12px 14px",
    border: `1.5px solid ${borderColor}`,
    borderRadius: 8, background: C.surfaceInput, fontFamily: F.body, fontSize: 13,
    color: C.textPrimary, outline: "none", transition: "border-color 0.18s, box-shadow 0.18s",
    boxShadow: focused ? focusShadow : "none",
    colorScheme: isDark ? "dark" : "light",
    resize: isTextarea ? "vertical" : undefined,
    minHeight: isTextarea ? 72 : undefined,
  };

  const handleBlur = (e) => {
    setFocused(false);
    if (onBlur) onBlur(e);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontFamily: F.label, fontSize: 9.5, letterSpacing: "0.14em", color: labelColor, fontWeight: 700, textTransform: "uppercase", marginBottom: 7, transition: "color 0.18s" }}>
        {label}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
      </label>
      {isTextarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows || 3} onFocus={() => setFocused(true)} onBlur={handleBlur} style={inputStyle} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} min={min} onFocus={() => setFocused(true)} onBlur={handleBlur} style={inputStyle} />
      }
      {touched && error && (
        <div style={{ color: C.red, fontFamily: F.body, fontSize: 11, marginTop: 5, display: "flex", alignItems: "center", gap: 5, animation: "fadeUp 0.15s ease" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

// ─── Modal 1: Guest Count ─────────────────────────────────────────────────────
function ModalGuestCount({ seatData, tableData, mode, isStandalone, onContinue, onCancel, C, isDark, ROOM }) {
  const bookableSeats = (tableData?.seats || []).filter(s => s.status === "available");
  const pendingSeats = (tableData?.seats || []).filter(s => s.status === "pending");
  const capacity = bookableSeats.length || tableData?.capacity || 8;

  const [guests, setGuests] = useState(() => Math.min(2, capacity));
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

  const dec = () => { const n = Math.max(1, guests - 1); setGuests(n); setInputVal(String(n)); };
  const inc = () => { if (guests >= capacity) return; const n = guests + 1; setGuests(n); setInputVal(String(n)); };
  const atMax = guests >= capacity;
  const atMin = guests <= 1;

  const infoRows = [
    ["Room", ROOM, null],
    ...(tableData ? [["Table", `Table ${tableData?.id ?? "—"}`, null]] : []),
    ["Seat Number", `Seat ${seatData?.num ?? seatData?.id ?? "—"}`, null],
    ["Availability", seatData?.status === "available" ? "Available" : "Unavailable",
      seatData?.status === "available" ? C.green : C.gold],
  ];

  if (isStandalone) {
    return (
      <ModalShell onClose={onCancel} C={C}>
        <ModalHeader eyebrow="Seat Reservation" title="Reserve This Seat" onClose={onCancel} C={C} meta={<StepIndicator step={1} C={C} />} />
        <div style={{ padding: "22px 24px 26px", flex: 1, minHeight: 0, overflowY: "auto" }}>
          <div style={{ background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, borderRadius: 10, overflow: "hidden", marginBottom: 22 }}>
            {[
              ["Room", ROOM, null],
              ["Seat Number", `Seat ${seatData?.num ?? seatData?.id ?? "—"}`, null],
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
      <div style={{ padding: "22px 24px 26px", flex: 1, minHeight: 0, overflowY: "auto" }}>
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

  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    email: false,
    phone: false,
    eventDate: false
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
    } else {
      setForm(f => ({ ...f, [k]: v }));
    }
  };

  const handleBlur = (field) => () => {
    setTouched(t => ({ ...t, [field]: true }));
  };

  const errors = useMemo(() => {
    const err = {};
    if (!form.firstName.trim()) {
      err.firstName = "First name is required";
    }
    if (!form.lastName.trim()) {
      err.lastName = "Last name is required";
    }
    if (!form.email.trim()) {
      err.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      err.email = "Please enter a valid email address";
    }
    if (!form.phone.trim() || form.phone === "+63") {
      err.phone = "Phone number is required";
    } else {
      const digits = form.phone.replace(/[^0-9]/g, "");
      if (digits.length !== 12) {
        err.phone = "Phone number must be exactly 10 digits after +63";
      }
    }
    if (!form.eventDate.trim()) {
      err.eventDate = "Date is required";
    }
    return err;
  }, [form]);

  const allFilled = Object.keys(errors).length === 0;

  const seatDisplay = mode === "whole" ? getWholeSeatLabel(guests, tableData) : seatData ? formatSeatLabel(seatData) : "-";
  const summaryRows = [
    ["Venue", "The Bellevue Manila"],
    ["Outlet", ROOM],
    ["Wing", WING],
    ...(isStandalone || !tableData ? [] : [["Table", `Table ${tableData?.id ?? "-"}`]]),
    ["Seat", seatDisplay],
    ["Guests", `${guests} Guest${guests !== 1 ? "s" : ""}`],
    ["Date", form.eventDate || "Select Date"],
    ["Time", form.eventTime || "Select Time"],
  ];

  const SummaryRow = ({ label, value, accent }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "7px 0", borderBottom: `1px solid ${C.divider}` }}>
      <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: C.textTertiary }}>{label}</span>
      <span style={{ fontFamily: F.body, fontSize: 12.5, color: accent ? C.gold : C.textPrimary, fontWeight: accent ? 700 : 500, textAlign: "right", lineHeight: 1.45, maxWidth: 170, overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );

  return (
    <ModalShell onClose={onCancel} C={C} maxWidth={920}>
      <ModalHeader eyebrow={isStandalone ? "Standalone Seat Reservation" : mode === "individual" ? "Seat Reservation" : "Table Reservation"} title="Your Information" onClose={onCancel} C={C} meta={<StepIndicator step={2} C={C} />} />
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: window.innerWidth < 820 ? "1fr" : "minmax(0,1fr) 300px", gap: 0, overflow: "hidden" }}>
        <div style={{ padding: "24px 28px 28px", overflowY: "auto", WebkitOverflowScrolling: "touch", minHeight: 0 }}>

          <SectionLabel C={C}>1. Guest Information</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
            <Field label="First Name" value={form.firstName} onChange={set("firstName")} onBlur={handleBlur("firstName")} error={errors.firstName} isValid={!errors.firstName} touched={touched.firstName} C={C} isDark={isDark} required />
            <Field label="Last Name" value={form.lastName} onChange={set("lastName")} onBlur={handleBlur("lastName")} error={errors.lastName} isValid={!errors.lastName} touched={touched.lastName} C={C} isDark={isDark} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,0.8fr)", gap: 12 }}>
            <Field label="Email Address" value={form.email} onChange={set("email")} onBlur={handleBlur("email")} error={errors.email} isValid={!errors.email} touched={touched.email} type="email" C={C} isDark={isDark} required />
            <Field label="Phone Number" value={form.phone} onChange={set("phone")} onBlur={handleBlur("phone")} error={errors.phone} isValid={!errors.phone} touched={touched.phone} type="tel" C={C} isDark={isDark} required placeholder="+63 9XX XXX XXXX" />
          </div>

          <SectionLabel C={C} style={{ marginTop: 14 }}>2. Reservation Details</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
            <Field label="Date" value={form.eventDate} onChange={set("eventDate")} onBlur={handleBlur("eventDate")} error={errors.eventDate} isValid={!errors.eventDate} touched={touched.eventDate} type="date" min={today} C={C} isDark={isDark} required />
            <Field label="Time" value={form.eventTime} onChange={set("eventTime")} type="time" C={C} isDark={isDark} />
          </div>

          <SectionLabel C={C} style={{ marginTop: 14 }}>3. Special Requests</SectionLabel>
          <Field label="Special Requests (Optional)" value={form.specialRequests} onChange={set("specialRequests")} type="textarea" rows={3} C={C} isDark={isDark} placeholder="Optional requests, preferences, dietary restrictions, or notes for the reservation." />
        </div>

        <aside style={{ borderLeft: `1px solid ${C.divider}`, background: C.goldFaintest, padding: "20px 20px 20px", overflowY: "auto", minHeight: 0 }}>
          <div style={{ display: "grid", gap: 12, paddingBottom: 16 }}>

            {/* Elegant Seat Hold Timer Card */}
            <div style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: isUrgent ? C.redFaint : C.surfaceInput,
              border: `1.5px solid ${isUrgent ? C.red : C.borderAccent}`,
              boxShadow: isUrgent ? `0 0 12px ${C.red}30` : `0 0 10px ${C.gold}12`,
              transition: "all 0.3s ease",
              animation: isUrgent ? "pulseRed 2s infinite" : "none"
            }}>
              <div style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: isUrgent ? C.red : C.textSecondary, marginBottom: 4 }}>Seat Hold Timer</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 11, color: isUrgent ? C.red : C.textTertiary, fontWeight: 500 }}>{isUrgent ? "Hold expiring soon" : "Complete before expiry"}</span>
                <strong style={{ fontFamily: F.mono, fontSize: 20, color: isUrgent ? C.red : C.gold, letterSpacing: "0.04em", fontWeight: 700 }}>{mins}:{secs}</strong>
              </div>
            </div>

            <div>
              <SectionLabel C={C} style={{ marginBottom: 6 }}>Reservation Summary</SectionLabel>
              {summaryRows.map(([label, value]) => <SummaryRow key={label} label={label} value={value} accent={["Seat", "Date", "Time"].includes(label)} />)}
            </div>

            <button
              onClick={() => allFilled && onReview(form)}
              disabled={!allFilled}
              style={{
                width: "100%",
                padding: "11px",
                background: allFilled ? C.gold : C.btnDisabledBg,
                border: "none",
                borderRadius: 8,
                fontFamily: F.label,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: allFilled ? C.textOnAccent : C.btnDisabledText,
                cursor: allFilled ? "pointer" : "not-allowed",
                transition: "all 0.20s ease"
              }}
              onMouseEnter={e => { if (allFilled) e.currentTarget.style.background = C.goldLight; }}
              onMouseLeave={e => { if (allFilled) e.currentTarget.style.background = C.gold; }}
            >Review Booking</button>

            <GhostBtn onClick={onCancel} C={C} style={{ padding: "10px" }}>Back to Seats</GhostBtn>
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
  const seatDisplay = mode === "whole" ? getWholeSeatLabel(guests, tableData) : (seatData ? formatSeatLabel(seatData) : "-");
  const canSubmit = consentAccepted && !submitting;

  const reservationRows = [
    ["Venue", "The Bellevue Manila"],
    ["Room", `${WING} - ${ROOM}`],
    ...(isStandalone || !tableData ? [] : [["Table", `Table ${tableData?.id ?? "-"}`]]),
    ["Seat(s)", seatDisplay],
    ["Guests", `${guests} Guest${guests !== 1 ? "s" : ""}`],
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "8px 0" }}>
      <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary, minWidth: 96, flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: F.body, fontSize: 12.5, color: accent ? C.gold : C.textPrimary, fontWeight: accent ? 700 : 500, textAlign: "right", maxWidth: 300, lineHeight: 1.5, overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );

  return (
    <ModalShell onClose={onEdit} disabled={submitting} C={C} maxWidth={920}>
      <ModalHeader eyebrow={isRebook ? "Rebook / Move Seat" : isStandalone ? "Standalone Seat Reservation" : mode === "individual" ? "Seat Reservation" : "Table Reservation"} title="Review Your Booking" onClose={onEdit} disabled={submitting} C={C} meta={<StepIndicator step={3} C={C} />} />
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: window.innerWidth < 820 ? "1fr" : "minmax(0,1fr) 300px", gap: 0, overflow: "hidden" }}>
        <div style={{ padding: "24px 28px 28px", overflowY: "auto", display: "grid", gap: 20, minHeight: 0 }}>
          {isRebook && rebookFrom && (
            <div style={{ padding: "12px 14px", borderRadius: 8, background: C.statusNote?.pending || C.goldFaintest, border: `1px solid ${C.statusNoteBorder?.pending || C.borderAccent}`, fontSize: 12, color: C.gold, lineHeight: 1.65 }}>
              <strong style={{ color: C.gold }}>Rebooking Notice:</strong> Previous reservation <strong>{rebookFrom.reference_code || rebookFrom.id}</strong> will be cancelled automatically on submission.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: window.innerWidth < 820 ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 20 }}>
            {/* Reservation Details Card */}
            <div style={{ background: C.surfaceRaised, border: `1px solid ${C.borderDefault}`, borderRadius: 12, padding: "18px 20px" }}>
              <SectionLabel C={C} style={{ marginBottom: 12 }}>Reservation Details</SectionLabel>
              <div style={{ display: "grid", gap: 4 }}>
                {reservationRows.map(([k, v]) => <Row key={k} label={k} value={v} accent={["Seat(s)", "Event Date", "Event Time"].includes(k)} />)}
              </div>
            </div>

            {/* Guest Information Card */}
            <div style={{ background: C.surfaceRaised, border: `1px solid ${C.borderDefault}`, borderRadius: 12, padding: "18px 20px" }}>
              <SectionLabel C={C} style={{ marginBottom: 12 }}>Guest Information</SectionLabel>
              <div style={{ display: "grid", gap: 4 }}>
                {guestRows.map(([k, v]) => <Row key={k} label={k} value={v} />)}
              </div>
            </div>
          </div>
        </div>

        <aside style={{ borderLeft: `1px solid ${C.divider}`, background: C.goldFaintest, padding: "20px 20px 20px", overflowY: "auto", minHeight: 0 }}>
          <div style={{ display: "grid", gap: 12, paddingBottom: 16 }}>
            <div style={{ padding: "10px 14px", borderRadius: 12, background: C.surfaceInput, border: `1px solid ${C.borderAccent}`, boxShadow: `0 0 10px ${C.gold}08` }}>
              <div style={{ fontFamily: F.label, fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold, fontWeight: 800, marginBottom: 8 }}>Final Review</div>
              <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}>Your booking will be reviewed by our team after submission. You will receive updates through your contact details.</div>
            </div>

            {/* Redesigned Privacy Act and Consent Section */}
            <label style={{
              display: "grid",
              gridTemplateColumns: "20px minmax(0,1fr)",
              gap: 12,
              alignItems: "flex-start",
              padding: "10px 14px",
              borderRadius: 12,
              background: consentAccepted ? C.goldFaint : C.surfaceInput,
              border: `1.5px solid ${consentAccepted ? C.borderAccent : C.borderDefault}`,
              cursor: submitting ? "not-allowed" : "pointer",
              boxShadow: consentAccepted ? `0 0 10px ${C.gold}12` : "none",
              transition: "all 0.25s ease"
            }}>
              <input
                type="checkbox"
                checked={consentAccepted}
                disabled={submitting}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                style={{ marginTop: 2, width: 16, height: 16, accentColor: C.gold, cursor: submitting ? "not-allowed" : "pointer" }}
              />
              <span style={{ fontSize: 11.5, color: C.textSecondary, lineHeight: 1.6, userSelect: "none" }}>
                I consent to the collection, use, and processing of my personal information for managing my reservation in accordance with the Data Privacy Act of 2012.
              </span>
            </label>

            <div style={{ fontSize: 11, color: C.textTertiary, lineHeight: 1.6, padding: "0 4px" }}>
              Your personal information is secure and will only be used to process and coordinate your reservation and guest requests.
            </div>

            <button onClick={() => onSubmit(consentAccepted)} disabled={!canSubmit}
              style={{
                width: "100%",
                padding: "11px",
                border: "none",
                borderRadius: 8,
                background: canSubmit ? C.gold : C.btnDisabledBg,
                color: canSubmit ? C.textOnAccent : C.btnDisabledText,
                fontFamily: F.label,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: canSubmit ? "pointer" : "not-allowed",
                transition: "all 0.18s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
              onMouseEnter={e => { if (canSubmit) e.currentTarget.style.background = C.goldLight; }}
              onMouseLeave={e => { if (canSubmit) e.currentTarget.style.background = C.gold; }}
            >
              {submitting ? <><Spinner C={C} />Submitting...</> : isRebook ? "Confirm Rebook" : "Submit Booking"}
            </button>
            <GhostBtn onClick={onEdit} disabled={submitting} C={C} style={{ padding: "10px" }}>Edit Details</GhostBtn>
          </div>
        </aside>
      </div>
    </ModalShell>
  );
}

// ─── Modal: Success ───────────────────────────────────────────────────────────
function ModalSuccess({ refCode, onBack, mode, guests, isRebook, bookingDetails, C, isDark, ROOM }) {
  const [copied, setCopied] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  const qrValue = useMemo(() => {
    if (!refCode) return "";
    const base = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
    const url = base.startsWith("http") ? base : `https://${base}`;
    return `${url}/manage-booking?code=${String(refCode).trim()}`;
  }, [refCode]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showLightbox && e.key === "Escape") {
        setShowLightbox(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLightbox]);

  const handleCopy = () => {
    navigator.clipboard.writeText(refCode || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const [qrHovered, setQrHovered] = useState(false);

  return (
    <>
      <ModalShell onClose={onBack} C={C} maxWidth={520}>
        {/* Top Right Close button standard across all steps */}
        <div style={{ position: "absolute", top: 20, right: 20, zIndex: 20 }}>
          <CloseBtn onClick={onBack} C={C} />
        </div>

        <div style={{ padding: "40px 32px 34px", textAlign: "center", display: "grid", gap: 24, flex: 1, minHeight: 0, overflowY: "auto" }}>
          <div>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: C.greenFaint,
              border: `2px solid ${C.green}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              boxShadow: `0 0 15px ${C.green}30`,
              animation: "fadeUp 0.3s ease"
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3 style={{ fontFamily: F.display, fontSize: 24, fontWeight: 600, color: C.textPrimary, margin: 0 }}>Request Submitted</h3>
            <p style={{ fontSize: 13, color: C.textSecondary, marginTop: 8, lineHeight: 1.6 }}>
              {isRebook ? "Your rebooking request has been submitted successfully." : "Your reservation has been submitted successfully."}<br />
              Our hospitality team will review your booking details and contact you shortly.
            </p>
          </div>

          {/* Code display with integrated Copy Action */}
          <div style={{
            background: C.goldFaintest,
            border: `1.5px solid ${C.borderAccent}`,
            borderRadius: 12,
            padding: "18px 20px",
            position: "relative",
            boxShadow: `0 0 10px ${C.gold}05`
          }}>
            <div style={{ fontSize: 8.5, letterSpacing: "0.18em", textTransform: "uppercase", color: C.textTertiary, fontWeight: 800, marginBottom: 6 }}>Booking Reference Code</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <div style={{ fontFamily: F.mono, fontSize: 28, color: C.gold, fontWeight: 700, letterSpacing: "0.08em" }}>{refCode || "PENDING"}</div>
              {refCode && (
                <button
                  onClick={handleCopy}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "transparent",
                    border: `1px solid ${copied ? C.green : C.borderAccent}`,
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontFamily: F.label,
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: copied ? C.green : C.gold,
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  {copied ? (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      Copy
                    </>
                  )}
                </button>
              )}
            </div>

            <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 10, lineHeight: 1.5 }}>
              Use this code to check your status or update details under the <strong>Manage Booking</strong> page.
            </div>
          </div>

          {/* Scannable, Clickable Interactive QR Code */}
          {refCode && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div
                tabIndex={0}
                role="button"
                aria-label="Enlarge QR Code"
                onClick={() => setShowLightbox(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setShowLightbox(true);
                  }
                }}
                onMouseEnter={() => setQrHovered(true)}
                onMouseLeave={() => setQrHovered(false)}
                style={{
                  background: "#FFFFFF",
                  padding: 14,
                  borderRadius: 14,
                  border: `1.5px solid ${qrHovered ? C.gold : C.borderDefault}`,
                  cursor: "pointer",
                  boxShadow: qrHovered ? `0 0 15px ${C.gold}30` : "none",
                  transform: qrHovered ? "scale(1.04)" : "scale(1)",
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  outline: "none"
                }}
              >
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(qrValue)}`}
                  alt="QR Code"
                  style={{ display: "block", width: 110, height: 110 }}
                />
              </div>
              <span style={{ fontSize: 11, color: C.textTertiary, fontWeight: 500, letterSpacing: "0.02em" }}>
                Click or scan code to view booking instantly
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={onBack} style={{ flex: 1, padding: "14px", background: C.gold, border: "none", borderRadius: 8, fontFamily: F.label, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.textOnAccent, cursor: "pointer", transition: "all 0.18s ease" }} onMouseEnter={e => e.currentTarget.style.background = C.goldLight} onMouseLeave={e => e.currentTarget.style.background = C.gold}>Done</button>
          </div>
        </div>
      </ModalShell>

      {/* Enlarged QR Code Lightbox Modal */}
      {showLightbox && (
        <div
          onClick={() => setShowLightbox(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 9, 8, 0.94)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 30000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeUp 0.2s ease-out"
          }}
        >
          {/* Lightbox Close Button */}
          <div style={{ position: "absolute", top: 24, right: 24 }}>
            <CloseBtn onClick={() => setShowLightbox(false)} C={C} />
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FFFFFF",
              padding: 24,
              borderRadius: 20,
              boxShadow: "0 25px 60px rgba(0,0,0,0.60)",
              border: `1.5px solid ${C.gold}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              maxWidth: "90%",
              width: 320,
              animation: "modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrValue)}`}
              alt="Enlarged QR Code"
              style={{ display: "block", width: 260, height: 260, imageRendering: "crisp-edges" }}
            />

            <div style={{ textAlign: "center", marginTop: 4 }}>
              <div style={{ fontFamily: F.mono, fontSize: 18, color: "#18140E", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6 }}>
                {refCode}
              </div>
              <div style={{ fontFamily: F.body, fontSize: 12, color: "#7A7060", lineHeight: 1.5 }}>
                Scan or save this code to view your booking.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



// ─── THE MASTER RESERVATION LAYOUT TEMPLATE ──────────────────────────────────────────
export default function VenueReservationTemplate({ roomName = null, wingName = null, isDynamic = false, eventId = null, preselectedSchedule = null }) {
  const navigate = useNavigate();
  const { venueSlug } = useParams();
  const location = useLocation();

  const [isDark, setIsDark] = useState(() => {
    try { const s = localStorage.getItem("bellevue-theme"); if (s !== null) return s === "dark"; } catch { }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  });

  const toggleTheme = () => setIsDark(p => {
    const n = !p;
    try { localStorage.setItem("bellevue-theme", n ? "dark" : "light"); } catch { }
    return n;
  });

  const C = getTokens(isDark);

  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("whole");
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [modal, setModal] = useState(null);
  const [guests, setGuests] = useState(2);
  const [formData, setFormData] = useState(null);
  const [schedule, setSchedule] = useState(() => {
    if (preselectedSchedule && preselectedSchedule.date && preselectedSchedule.time) {
      return { eventDate: preselectedSchedule.date, eventTime: preselectedSchedule.time };
    }
    return normalizeSchedule();
  });
  const [refCode, setRefCode] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [rebookFrom, setRebookFrom] = useState(null);
  const [lastBookingDetails, setLastBookingDetails] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [roomAvailability, setRoomAvailability] = useState(null);
  const [layoutChecked, setLayoutChecked] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);

  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    event_time: "", special_requests: "",
    event_area: "", setup_tables: "", setup_chairs: "", setup_requirements: ""
  });

  const [holdSecondsLeft, setHoldSecondsLeft] = useState(24 * 60);
  const holdStartedRef = useRef(false);
  const echoRef = useRef(null);
  const pollingRef = useRef(null);
  const requestCounterRef = useRef(0);

  const startHoldTimer = useCallback(() => {
    if (!holdStartedRef.current) { holdStartedRef.current = true; setHoldSecondsLeft(24 * 60); }
  }, []);

  const resetHoldTimer = useCallback(() => {
    holdStartedRef.current = false; setHoldSecondsLeft(24 * 60);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModal(null);
    setSelectedTable(null);
    setSelectedSeat(null);
    resetHoldTimer();
  }, [resetHoldTimer]);

  useEffect(() => {
    if (modal !== "details" && modal !== "review") return;
    if (holdSecondsLeft <= 0) { setModal(null); resetHoldTimer(); return; }
    const id = setInterval(() => setHoldSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [modal, holdSecondsLeft]);

  useEffect(() => {
    if (modal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [modal]);

  // Load venues on mount
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    venueAPI.getAll({ include_archived: false, _t: Date.now() })
      .then((rows) => {
        if (!mounted) return;
        const rowsList = Array.isArray(rows) ? rows : [];
        setVenues(rowsList);

        // Populate venue structure
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

  // Determine current venue from slug or static prop overrides
  const venue = useMemo(() => {
    if (venues.length === 0) return null;
    let match = null;
    if (roomName) {
      // Find by static name match
      const canon = getCanonicalRoomName(roomName);
      match = venues.find((v) => getCanonicalRoomName(v.name) === canon)
        || venues.find((v) => getCanonicalRoomName(v.slug) === canon)
        || null;
    } else {
      const key = String(venueSlug || "").replace(/^\/+/, "").toLowerCase();
      match = venues.find((v) => String(v.reservation_route).replace(/^\/+/, "").toLowerCase() === key)
        || venues.find((v) => String(v.reservation_route).split("/").pop().toLowerCase() === key)
        || venues.find((v) => String(v.slug).toLowerCase() === key)
        || null;
    }

    if (match?.parent_id) {
      return venues.find((v) => v.id === match.parent_id) || match;
    }
    return match;
  }, [venues, venueSlug, roomName]);

  // Guests reserve the public parent venue only. Subrooms are assigned later by
  // the configured allocation mode: admin assignment, auto-assignment, or whole parent booking.
  const selectedRoom = venue;

  const ROOM = selectedRoom?.display_name || selectedRoom?.name || roomName || "";
  const WING = wingName || getActualWingForRoom(ROOM);

  const flag = (value, fallback = true) => value === undefined || value === null ? fallback : Boolean(value);
  const isVenueReservable =
    Boolean(venue) &&
    flag(venue?.is_active) &&
    flag(venue?.is_visible) &&
    flag(venue?.reservations_enabled);

  const fetchAndMerge = useCallback(async () => {
    if (!ROOM) return;
    const reqId = ++requestCounterRef.current;
    try {
      const venueId = venue?.id;
      if (!venueId) return;

      const params = new URLSearchParams();
      if (schedule.eventDate) params.set("event_date", schedule.eventDate);
      if (schedule.eventTime) params.set("event_time", schedule.eventTime);
      params.set("guests", String(guests || 1));
      params.set("_t", String(Date.now()));

      const res = await fetch(
        `${API_BASE_URL}/rooms/${venueId}/seats?${params.toString()}`,
        { headers: { Accept: "application/json" } }
      );
      if (reqId !== requestCounterRef.current) return;
      if (!res.ok) return;
      const json = await res.json();
      setRoomAvailability(json.availability || null);
      if (json.success && json.data) {
        setTableData((current) => {
          if (!current) return json.data;
          if (isIncomingSeatMapStale(current, json.data)) {
            return mergeReservationStatusIntoLayout(current, json.data);
          }
          return json.data;
        });
      } else {
        setTableData((current) => current ?? null);
      }
      setLayoutChecked(true);
    } catch (err) {
      if (reqId === requestCounterRef.current) {
        console.error("[VenueReservationTemplate] Failed to fetch seat map:", err);
        setLayoutChecked(true);
      }
    }
  }, [ROOM, venue?.id, schedule.eventDate, schedule.eventTime, guests]);

  useEffect(() => {
    if (!ROOM) return;
    setLayoutChecked(false);
    setTableData(null);
    setRoomAvailability(null);
    fetchAndMerge();
  }, [fetchAndMerge, ROOM]);

  useEffect(() => {
    const onScheduleChanged = () => {
      setSelectedSeat(null);
      setSelectedTable(null);
    };
    window.addEventListener("seatmap:schedule-changed", onScheduleChanged);
    return () => window.removeEventListener("seatmap:schedule-changed", onScheduleChanged);
  }, []);

  // Load classic slots if seatmap is not published
  const todayDate = new Date().toISOString().split("T")[0];
  const [classicDate, setClassicDate] = useState(preselectedSchedule?.date || todayDate);
  const [classicGuests, setClassicGuests] = useState(2);
  const [classicConsentAccepted, setClassicConsentAccepted] = useState(false);
  const [slots, setSlots] = useState([]);
  const [slotMessage, setSlotMessage] = useState("");

  useEffect(() => {
    if (tableData || !venue) return;
    setSlotMessage("Loading available times...");
    venueAPI.getTimeSlots({ venue_id: venue.id, room: ROOM, date: classicDate, guests: classicGuests, _t: Date.now() })
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
  }, [tableData, venue, ROOM, classicDate, classicGuests]);

  useEffect(() => {
    // Listen for seatmap published events to refresh the live map
    const onSeatMapPublished = e => {
      const publishedVenueId = e.detail?.venueId;
      if (publishedVenueId === venue?.id) {
        fetchAndMerge();
      }
    };

    const bc = new BroadcastChannel("seatmap_updates");
    bc.onmessage = e => {
      if (e.data?.type === "seatmap:published" && e.data?.venueId === venue?.id) {
        fetchAndMerge();
      }
    };

    window.addEventListener("seatmap:published", onSeatMapPublished);
    return () => {
      window.removeEventListener("seatmap:published", onSeatMapPublished);
      bc.close();
    };
  }, [venue?.id, fetchAndMerge]);

  // Real-time Websocket
  useEffect(() => {
    if (!ROOM) return;
    const pusherKey = import.meta.env.VITE_PUSHER_APP_KEY;
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
      const events = ["ReservationCreated", "ReservationUpdated", "ReservationDeleted", "ReservationApproved", "ReservationRejected", "SeatReserved", "TableReserved"];

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
        try { events.forEach(ev => channel.stopListening(ev)); } catch { }
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

  const getTables = () => {
    if (!tableData) return [];
    if (Array.isArray(tableData)) return tableData;
    return tableData.tables || [];
  };

  const getActiveTable = () => {
    const tables = getTables();
    if (selectedSeat && isStandaloneSelected()) return null;
    if (mode === "whole") return selectedTable || null;
    if (selectedTable) return selectedTable;
    if (selectedSeat && tables.length) {
      if (selectedSeat.parentTableId && selectedSeat.parentTableId !== "STANDALONE") {
        return tables.find(t => t.id === selectedSeat.parentTableId) || null;
      }
      return tables.find(t => t.seats && t.seats.some(s => s.id === selectedSeat.id));
    }
    return null;
  };

  const isStandaloneSelected = () => {
    if (selectedSeat?.parentTableId === "STANDALONE") return true;
    if (selectedSeat && tableData?.standaloneSeats) {
      return tableData.standaloneSeats.some(s => s.id === selectedSeat.id);
    }
    return false;
  };

  const handleSeatClick = (seat, tableId) => {
    if (!isVenueReservable) {
      alert("This venue is currently not available for online reservations.");
      return;
    }
    if (spaceUnavailable) {
      alert(roomAvailability?.reason || "This space is unavailable for the selected schedule.");
      return;
    }
    if (seat?.status !== "available") {
      alert("This seat is unavailable for the selected schedule.");
      return;
    }
    setSelectedTable(null);
    setSelectedSeat({ ...seat, parentTableId: tableId || "STANDALONE" });
  };

  const handleTableClick = (table) => {
    if (!isVenueReservable) {
      alert("This venue is currently not available for online reservations.");
      return;
    }
    if (spaceUnavailable) {
      alert(roomAvailability?.reason || "This space is unavailable for the selected schedule.");
      return;
    }
    const totalSeats = table?.seats?.length || 0;
    const availableSeats = (table?.seats || []).filter((seat) => seat.status === "available").length;
    if (mode === "whole" && availableSeats < totalSeats) {
      alert("This table is partially or fully reserved. Please select another table.");
      return;
    }
    if (mode === "individual" && availableSeats < 1) {
      alert("This table has no available seats for the selected schedule.");
      return;
    }
    setSelectedSeat(null);
    setSelectedTable(table);
    if (mode === "whole") setModal("guestCount");
  };

  const handleGuestContinue = (gCount) => {
    if (spaceUnavailable) {
      setError(roomAvailability?.reason || "This space is unavailable for the selected schedule.");
      setModal(null);
      return;
    }
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

  const handleSubmit = async (consentAccepted = false) => {
    if (!formData) return;
    if (!isVenueReservable) {
      setError("This venue is currently not available for online reservations.");
      setModal(null);
      return;
    }
    if (spaceUnavailable) {
      setError(roomAvailability?.reason || "This space is unavailable for the selected schedule.");
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
        venue_id: venue.id,
        room: ROOM,
        table_number: isStandalone ? "STANDALONE" : (activeTable ? String(activeTable.id) : "GENERAL"),
        seat_number: selectedSeatNumbers.filter(Boolean).join(","),
        guests_count: Number(guests || 1),
        event_date: formData.eventDate,
        event_time: formData.eventTime,
        special_requests: formData.specialRequests,
        type: mode,
        consent_accepted: consentAccepted,
        ...(venue.type !== "dining" ? {
          event_area: formData.eventArea || "",
          setup_tables: formData.setupTables ? Number(formData.setupTables) : null,
          setup_chairs: formData.setupChairs ? Number(formData.setupChairs) : null,
          setup_requirements: formData.setupRequirements || "",
        } : {}),
        ...(eventId ? { event_id: Number(eventId) } : {}),
      };

      const result = await reservationAPI.create(payload);
      setLastBookingDetails(result?.data || result);
      setRefCode(result?.reference_code || result?.data?.reference_code);
      await fetchAndMerge();

      setModal("success");
      resetHoldTimer();
    } catch (err) {
      setError(err.message || "Failed to submit booking");
      setModal(null);
      setSelectedSeat(null);
      setSelectedTable(null);
      fetchAndMerge();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClassicSubmit = async (e, classicConsentAccepted = false) => {
    e.preventDefault();
    if (!isVenueReservable) {
      setError("This venue is currently not available for online reservations.");
      return;
    }
    if (spaceUnavailable) {
      setError(roomAvailability?.reason || "This space is unavailable for the selected schedule.");
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
        venue_id: venue.id,
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
        ...(eventId ? { event_id: Number(eventId) } : {}),
      };

      const result = await reservationAPI.create(payload);
      setSuccess(result?.data || result);
      setForm({ name: "", email: "", phone: "", event_time: "", special_requests: "", event_area: "", setup_tables: "", setup_chairs: "", setup_requirements: "" });
      setRefCode(result?.reference_code || result?.data?.reference_code);
      setModal("success");
    } catch (err) {
      setError(err.message || "Failed to submit booking request");
      setSelectedSeat(null);
      setSelectedTable(null);
      fetchAndMerge();
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

  const isMobile = windowSize.width < 640;
  const isTablet = windowSize.width < 1024;
  const activeTable = getActiveTable();
  const isStandalone = isStandaloneSelected();
  const hasSeatLayout = Boolean(tableData && (((tableData.tables || []).length > 0) || ((tableData.standaloneSeats || []).length > 0)));
  const hasConfirmedSchedule = Boolean(schedule.eventDate && schedule.eventTime);
  const spaceUnavailable = Boolean(hasConfirmedSchedule && roomAvailability && roomAvailability.available === false);
  const spaceStatusLabel = roomAvailability?.status === "pending" ? "Pending Reservation" : "Schedule Unavailable";
  const spaceAvailabilityMessage = roomAvailability?.reason || "This space is unavailable for the selected schedule.";
  const isWholeTableAvailable = activeTable && (activeTable.seats || []).every(seat => seat.status === "available");
  const canProceed = isVenueReservable && !spaceUnavailable && mode === "individual" && selectedSeat && selectedSeat.status === "available";
  const canReserveWhole = isVenueReservable && !spaceUnavailable && mode === "whole" && (((activeTable && isWholeTableAvailable) || !hasSeatLayout));
  const seatRatio = activeTable ? getSeatRatio(activeTable) : null;
  const bookingButtonLabel = !isVenueReservable
    ? "Reservations Unavailable"
    : spaceUnavailable
      ? spaceStatusLabel
      : !hasSeatLayout
        ? "Reserve General Admission"
        : mode === "whole"
          ? (activeTable ? "Reserve This Table" : "Select a Table First")
          : selectedSeat ? "Reserve This Seat" : "Select a Seat First";

  const displayTable = !hasSeatLayout
    ? "General Admission"
    : isStandalone
      ? "Standalone"
      : mode === "whole"
        ? (activeTable ? `Table ${activeTable.id}` : "-")
        : (selectedTable ? `Table ${selectedTable.id}` : "-");
  const displaySeat = !hasSeatLayout
    ? "Whole Area"
    : mode === "individual"
      ? (selectedSeat ? formatSeatLabel(selectedSeat) : "Select a seat")
      : getWholeSeatLabel(guests, activeTable);
  const venueImage = imageUrl(venue?.image);

  const detailsPrefill = formData ? { firstName: formData.firstName || "", lastName: formData.lastName || "", email: formData.email || "", phone: formData.phone || "+63", eventDate: formData.eventDate || "", eventTime: formData.eventTime || "19:00", specialRequests: formData.specialRequests || "", eventArea: formData.eventArea || "", setupTables: formData.setupTables || "", setupChairs: formData.setupChairs || "", setupRequirements: formData.setupRequirements || "" } : { firstName: "", lastName: "", email: "", phone: "+63", eventDate: schedule.eventDate || classicDate || "", eventTime: schedule.eventTime || "19:00", specialRequests: "" };
  const reservationLabel = venue?.type === "dining" ? "Table Reservation" : "Seat Reservation";
  const venueTitle = selectedRoom?.display_name || selectedRoom?.name || venue?.display_name || venue?.name || "Venue";
  const venueDescription = venue?.description || `Book your preferred ${venue?.type === "dining" ? "table" : "space"} at ${venueTitle}. Select your reservation type and check availability before choosing from the map.`;

  const NAV_H = 64;
  const MOBILE_HEADER_H = 62;
  const MOBILE_TABS_H = 48;
  const BOTTOM_SHEET_H = 180;
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
        @keyframes pulseRed {
          0% { box-shadow: 0 0 0 0 rgba(184, 92, 92, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(184, 92, 92, 0); }
          100% { box-shadow: 0 0 0 0 rgba(184, 92, 92, 0); }
        }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>

      <div style={{ minHeight: "100dvh", fontFamily: F.body, background: C.pageBg, transition: "background 0.30s", position: "relative" }}>
        {/* Blurred Background */}
        <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: venueImage ? `url(${venueImage})` : "url('/src/assets/bg-login.jpeg')", backgroundSize: "cover", backgroundPosition: "center", filter: isDark ? "blur(6px) brightness(0.35)" : "blur(6px) brightness(0.45) saturate(0.4)", transform: "scale(1.05)", transition: "filter 0.40s" }} />
          <div style={{ position: "absolute", inset: 0, background: isDark ? "rgba(12,11,10,0.85)" : "rgba(237,233,224,0.88)", transition: "background 0.40s" }} />
        </div>

        {/* Premium Top Navigation Header */}
        <nav style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 64,
          background: isDark ? "rgba(10, 9, 8, 0.95)" : "rgba(247, 244, 238, 0.96)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.borderDefault}`,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          boxSizing: "border-box",
          transition: "all 0.3s ease"
        }}>
          {/* Left: Bellevue Logo */}
          <img
            src={bellevueLogo}
            alt="The Bellevue Manila"
            onClick={() => navigate("/")}
            style={{
              height: 28,
              width: "auto",
              cursor: "pointer",
              filter: isDark
                ? "brightness(0) saturate(100%) invert(82%) sepia(18%) saturate(350%) hue-rotate(2deg)"
                : "brightness(0) saturate(100%) invert(20%) sepia(30%) saturate(600%) hue-rotate(8deg)",
              opacity: 0.9,
              transition: "all 0.3s ease"
            }}
          />

          {/* Right: Single Theme Toggle */}
          <PageThemeToggle isDark={isDark} toggle={toggleTheme} C={C} />
        </nav>

        {/* Fallback Classic direct booking form if layout is not ready */}
        {!layoutChecked ? (
          <div style={{ paddingTop: 150, minHeight: "55vh", position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Spinner size={28} C={C} />
          </div>
        ) : (
          /* PREVENT CRAMPING: Responsive Premium Interactive Layout Grid */
          isMobile ? (
            /* MOBILE PORTRAIT VIEWPORT STACK */
            <div style={{ position: "relative", zIndex: 1, paddingTop: 64, display: "flex", flexDirection: "column", height: isDynamic ? "100dvh" : "calc(100vh - 0px)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", height: MOBILE_HEADER_H, boxSizing: "border-box", flexShrink: 0, background: isDark ? "rgba(10,9,8,0.92)" : "rgba(247,244,238,0.95)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: `1px solid ${C.borderAccent}` }}>
                <button onClick={() => navigate("/venues")} style={{ width: 34, height: 34, borderRadius: "50%", background: "transparent", border: `1px solid ${C.borderDefault}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 }} title="Back">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.textSecondary }}><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontFamily: F.label, fontSize: 8, letterSpacing: "0.22em", color: C.gold, fontWeight: 700, textTransform: "uppercase" }}>{venue.type === "dining" ? "Table Booking" : "Seat Booking"}</div>
                  <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600, color: C.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ROOM}</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 0, padding: "8px 16px", height: MOBILE_TABS_H, boxSizing: "border-box", flexShrink: 0, background: isDark ? "rgba(10,9,8,0.85)" : "rgba(247,244,238,0.90)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderBottom: `1px solid ${C.borderDefault}`, alignItems: "center" }}>
                {[["whole", venue?.type === "dining" ? "Whole Table" : "Whole Space"], ["individual", "Individual Seat"]].map(([val, label], i) => (
                  <button key={val} onClick={() => { setMode(val); if (val === "whole") setSelectedSeat(null); else setSelectedTable(null); }} style={{ flex: 1, padding: "9px 0", background: mode === val ? C.gold : "transparent", border: `1px solid ${mode === val ? C.gold : C.borderDefault}`, borderRadius: i === 0 ? "8px 0 0 8px" : "0 8px 8px 0", color: mode === val ? C.textOnAccent : C.textSecondary, fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.18s" }}>{label}</button>
                ))}
              </div>

              <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden", background: C.surfaceBase }}>
                <div style={{ padding: "10px 16px", background: isDark ? "rgba(10,9,8,0.88)" : "rgba(247,244,238,0.92)", borderBottom: `1px solid ${C.borderDefault}` }}>
                  <ScheduleGate schedule={schedule} onChange={setSchedule} roomLabel={ROOM} isDark={isDark} guests={guests} locked={!!preselectedSchedule} />
                </div>
                <div style={{ width: "100%", height: "100%", overflow: "auto", WebkitOverflowScrolling: "touch", display: "flex", alignItems: "flex-start", justifyContent: "flex-start" }}>
                  <div style={{ width: "100%", minHeight: "100%", transformOrigin: "top left" }}>
                    {!hasSeatLayout ? (
                      <div style={{ padding: "40px 24px", textAlign: "center", color: C.textSecondary, fontFamily: F.body, fontSize: 13, display: "flex", flexDirection: "column", gap: 14, alignItems: "center", justifyContent: "center", minHeight: 200 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.goldFaint, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.borderAccent}` }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          <strong style={{ fontFamily: F.display, fontSize: 16, color: C.textPrimary }}>No seat layout available</strong>
                          <span style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>This space does not have a configured seat map yet.</span>
                          {spaceUnavailable && (
                            <span style={{ fontSize: 11, color: roomAvailability?.status === "pending" ? C.gold : STATUS_COLORS.reserved, lineHeight: 1.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                              {spaceAvailabilityMessage}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <SeatMap tableData={tableData} editMode={false} mode={mode} selectedSeat={selectedSeat} onSeatClick={handleSeatClick} onTableClick={handleTableClick} windowWidth={windowSize.width} wing={WING} room={ROOM} isDark={isDark} />
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

              {/* Mobile bottom-anchored booking details sheet */}
              <div style={{ flexShrink: 0, background: isDark ? "rgba(10,9,8,0.95)" : "rgba(255,255,255,0.98)", borderTop: `1px solid ${C.borderDefault}`, padding: "14px 16px", display: "grid", gap: 12 }}>
                {error && (
                  <div style={{
                    background: isDark ? "rgba(160,56,56,0.15)" : "rgba(160,56,56,0.08)",
                    border: `1.5px solid ${C.red}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    color: isDark ? "#FFA8A8" : "#A03838",
                    fontSize: 11.5,
                    lineHeight: 1.4,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    animation: "fadeUp 0.15s ease"
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <div style={{ flex: 1 }}>{error}</div>
                    <button onClick={() => setError("")} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: C.surfaceInput, border: `1px solid ${C.borderDefault}` }}>
                    <div style={{ fontFamily: F.label, fontSize: 8, letterSpacing: "0.16em", color: C.textTertiary, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Selection</div>
                    <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, color: C.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displaySeat}</div>
                  </div>
                </div>
                <button
                  onClick={(canReserveWhole || canProceed) ? () => setModal("guestCount") : undefined}
                  disabled={!(canReserveWhole || canProceed)}
                  style={{ width: "100%", padding: "15px", background: (canReserveWhole || canProceed) ? C.gold : C.btnDisabledBg, border: "none", borderRadius: 12, fontFamily: F.label, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: (canReserveWhole || canProceed) ? C.textOnAccent : C.btnDisabledText, cursor: (canReserveWhole || canProceed) ? "pointer" : "not-allowed", transition: "all 0.18s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {bookingButtonLabel}
                </button>
              </div>
            </div>
          ) : (
            /* TWO-COLUMN PREMIUM DESKTOP LAYOUT WITH BALANCED MARGINS */
            <div style={{ position: "relative", zIndex: 1, paddingTop: 88, paddingBottom: 24, boxSizing: "border-box" }}>
              <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>

                {/* Compact Unified Header Row */}
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  marginBottom: 16, 
                  animation: "fadeUp 0.28s ease",
                  flexWrap: "wrap",
                  gap: 16
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <button onClick={() => navigate("/venues")} title="Back to venues"
                      style={{ width: 36, height: 36, borderRadius: "50%", background: "transparent", border: `1px solid ${C.borderDefault}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.18s", padding: 0, flexShrink: 0 }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.background = C.goldFaint; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = "transparent"; }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.textSecondary }}><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontFamily: F.label, fontSize: 8.5, letterSpacing: "0.20em", color: C.gold, fontWeight: 700, textTransform: "uppercase" }}>{reservationLabel}</span>
                        <span style={{ display: "inline-block", width: 4, height: 4, borderRadius: "50%", background: C.gold, opacity: 0.5 }} />
                        <span style={{ fontFamily: F.label, fontSize: 8.5, letterSpacing: "0.15em", color: C.textSecondary, fontWeight: 700, textTransform: "uppercase" }}>{WING}</span>
                      </div>
                      <h1 style={{ fontFamily: F.display, fontSize: isTablet ? 24 : 28, fontWeight: 700, color: C.textPrimary, lineHeight: 1.1, margin: 0, letterSpacing: "0.01em" }}>
                        {venueTitle}
                      </h1>
                    </div>
                  </div>

                  {/* Reserve Mode Switcher on the Right */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.18em", color: C.textSecondary, fontWeight: 700, textTransform: "uppercase" }}>Reserve:</span>
                    <div style={{ display: "flex", alignItems: "center", background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", borderRadius: 8, padding: 3, gap: 3, border: `1px solid ${C.borderDefault}` }}>
                      {[["whole", venue?.type === "dining" ? "Whole Table" : "Whole Space"], ["individual", "Individual Seat"]].map(([val, label]) => (
                        <button key={val}
                          onClick={() => { setMode(val); if (val === "whole") setSelectedSeat(null); else setSelectedTable(null); }}
                          style={{ padding: "6px 14px", border: "none", background: mode === val ? C.gold : "transparent", color: mode === val ? C.textOnAccent : C.textSecondary, cursor: "pointer", fontSize: 9.5, letterSpacing: "0.10em", fontWeight: 700, fontFamily: F.label, borderRadius: 6, transition: "all 0.18s", outline: "none", textTransform: "uppercase" }}
                        >{label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Subtext description in small compact size below */}
                {venueDescription && (
                  <p style={{ fontFamily: F.body, fontSize: 12.5, color: C.textSecondary, margin: "0 0 20px 50px", lineHeight: 1.6, maxWidth: 800, animation: "fadeUp 0.32s ease" }}>
                    {venueDescription}
                  </p>
                )}

                <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1fr) 320px", gap: 24, alignItems: "start", animation: "fadeUp 0.36s ease" }}>

                  {/* Left Column: Intentionally framed SeatMap container card */}
                  <div style={{ background: C.surfaceBase, border: `1.5px solid ${C.cardBorder}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", height: isTablet ? 500 : 540, boxShadow: isDark ? "0 20px 50px rgba(0,0,0,0.40)" : "0 12px 36px rgba(78,60,32,0.07)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: `1px solid ${C.divider}`, background: C.surfaceRaised }}>
                      <div>
                        <div style={{ fontFamily: F.body, fontSize: 11, color: C.textSecondary, fontWeight: 500 }}>Select a table or seat on the map below:</div>
                      </div>

                      {/* Deskop legend alignment */}
                      <div style={{ display: "flex", gap: 14 }}>
                        {legendEntries.map(([key, color]) => (
                          <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                            <span style={{ fontFamily: F.body, fontSize: 10, color: C.textSecondary, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{key}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ flex: 1, background: C.pageBg, position: "relative", overflow: "hidden" }}>
                      <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
                        {!hasSeatLayout ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: C.textSecondary, fontFamily: F.body, fontSize: 14, gap: 16, padding: 32 }}>
                            <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.goldFaint, display: "flex", alignItems: "center", justifyContent: "center", border: `1.5px solid ${C.borderAccent}` }}>
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
                            </div>
                            <div style={{ textAlign: "center", display: "grid", gap: 8 }}>
                              <strong style={{ fontFamily: F.display, fontSize: 18, color: C.textPrimary }}>No seat layout available</strong>
                              <span style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>This space does not have a configured seat map yet.</span>
                              {spaceUnavailable && (
                                <span style={{ fontSize: 11, color: roomAvailability?.status === "pending" ? C.gold : STATUS_COLORS.reserved, lineHeight: 1.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", maxWidth: 420, margin: "0 auto" }}>
                                  {spaceAvailabilityMessage}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <SeatMap tableData={tableData} editMode={false} mode={mode} selectedSeat={selectedSeat} onSeatClick={handleSeatClick} onTableClick={handleTableClick} windowWidth={windowSize.width} wing={WING} room={ROOM} isDark={isDark} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Sticky Availability schedule, selection summary, and action sidebar */}
                  <div style={{ display: "grid", gap: 16, position: isTablet ? "static" : "sticky", top: 72 }}>

                    {/* Schedule controls */}
                    <ScheduleGate schedule={schedule} onChange={setSchedule} roomLabel={ROOM} isDark={isDark} guests={guests} locked={!!preselectedSchedule} />

                    {error && (
                      <div style={{
                        background: isDark ? "rgba(160,56,56,0.15)" : "rgba(160,56,56,0.08)",
                        border: `1.5px solid ${C.red}`,
                        borderRadius: 10,
                        padding: "10px 14px",
                        color: isDark ? "#FFA8A8" : "#A03838",
                        fontSize: 11.5,
                        lineHeight: 1.4,
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 8,
                        margin: "0 0 16px 0",
                        animation: "fadeUp 0.15s ease"
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                        <div style={{ flex: 1 }}>{error}</div>
                        <button onClick={() => setError("")} style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                      </div>
                    )}

                    {/* Selection Summary details card */}
                    <div style={{ background: C.surfaceBase, border: `1.5px solid ${C.cardBorder}`, borderRadius: 16, padding: 22, boxShadow: isDark ? "0 15px 40px rgba(0,0,0,0.30)" : "0 10px 30px rgba(78,60,32,0.05)" }}>
                      <SectionLabel C={C}>Selection Summary</SectionLabel>
                      <div style={{ background: C.surfaceRaised, border: `1px solid ${C.borderDefault}`, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
                        {[
                          ...(!isStandalone ? [["Table", displayTable, false, seatRatio ?? null]] : []),
                          [mode === "whole" && guests > 1 ? "Seats" : "Seat", displaySeat, true, null],
                          ["Wing / Wing Area", WING, false, null]
                        ].map(([label, value, isGold, badge]) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: `1px solid ${C.divider}` }}>
                            <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>{label}</span>
                            <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: isGold ? C.gold : C.textPrimary, textAlign: "right", display: "flex", alignItems: "center", gap: 5 }}>
                              {value}
                              {badge && <span style={{ background: C.goldFaint, border: `1px solid ${C.borderAccent}`, borderRadius: 4, padding: "1px 5px", fontSize: 9, color: C.gold, fontWeight: 700, fontFamily: F.label }}>{badge}</span>}
                            </span>
                          </div>
                        ))}
                        {spaceUnavailable && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: `1px solid ${C.divider}` }}>
                            <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>Availability</span>
                            <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", color: roomAvailability?.status === "pending" ? C.gold : STATUS_COLORS.reserved, textAlign: "right", textTransform: "uppercase" }}>{spaceStatusLabel}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={(canReserveWhole || canProceed) ? () => setModal("guestCount") : undefined}
                        disabled={!(canReserveWhole || canProceed)}
                        style={{ width: "100%", padding: "13px", background: (canReserveWhole || canProceed) ? C.gold : C.btnDisabledBg, border: "none", borderRadius: 8, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: (canReserveWhole || canProceed) ? C.textOnAccent : C.btnDisabledText, cursor: (canReserveWhole || canProceed) ? "pointer" : "not-allowed", transition: "all 0.20s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                        onMouseEnter={e => { if (canReserveWhole || canProceed) e.currentTarget.style.background = C.goldLight; }}
                        onMouseLeave={e => { if (canReserveWhole || canProceed) e.currentTarget.style.background = C.gold; }}
                      >
                        {bookingButtonLabel}
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
        <ModalGuestCount seatData={mode === "individual" ? selectedSeat : null} tableData={modalTableData} mode={mode} isStandalone={isStandalone} onContinue={handleGuestContinue} onCancel={handleCloseModal} C={C} isDark={isDark} ROOM={ROOM} />
      )}
      {modal === "details" && (
        <ModalDetails tableData={modalTableData} seatData={selectedSeat} mode={mode} guests={guests} isStandalone={isStandalone} onReview={handleReview} onCancel={handleCloseModal} prefill={detailsPrefill} C={C} isDark={isDark} secondsLeft={holdSecondsLeft} onTimerExpired={handleCloseModal} ROOM={ROOM} WING={WING} venueType={venue?.type} />
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

// ─── CONSISTENT SICK PAGE THEME TOGGLE BUTTON ───────────────────────────────────
function PageThemeToggle({ isDark, toggle, C }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "transparent",
        border: `1px solid ${hov ? C.borderAccent : C.borderDefault}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "border-color 0.22s, background 0.22s",
        padding: 0,
        flexShrink: 0,
      }}
    >
      {isDark ? (
        /* Show Sun Icon in dark mode to switch to light */
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Show Moon Icon in light mode to switch to dark */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
