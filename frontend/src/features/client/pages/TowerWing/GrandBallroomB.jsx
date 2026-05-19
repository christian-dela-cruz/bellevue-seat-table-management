// src/pages/GrandBallroomBReserve.jsx
import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SharedNavbar from "../../../../components/SharedNavbar.jsx";

import SeatMap, { STATUS_COLORS } from "../../../../components/seatmap/SeatMap";
import ScheduleGate, { normalizeSchedule, withSeatmapSchedule } from "../../../../components/seatmap/ScheduleGate";
import { mergeReservationStatusIntoLayout } from "../../../../utils/seatmapAvailability";
import Echo from "../../../../utils/websocket.js";

// ─── API base ─────────────────────────────────────────────────────────────────
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000/api";

// ─── Canonical wing resolver (must match SeatMap.jsx exactly) ─────────────────
function getActualWingForRoom(room) {
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
  return roomToWingMap[room] || "Main Wing";
}

// ─── Wing / Room constants ────────────────────────────────────────────────────
const ROOM     = "Grand Ballroom B";
const WING     = getActualWingForRoom(ROOM); // "Grand Ballroom" — matches SeatMap.jsx localStorage key
const API_WING = "Tower Wing";               // organizational wing sent to the API / DB

// ─── Theme context ────────────────────────────────────────────────────────────
const ThemeContext = createContext({ isDark: true, toggle: () => {} });
const useTheme = () => useContext(ThemeContext);

// ─── Design tokens ────────────────────────────────────────────────────────────
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
        statusNote: {
          pending:  "rgba(196,163,90,0.05)",
          approved: "rgba(74,158,126,0.05)",
          rejected: "rgba(184,92,92,0.05)",
        },
        statusNoteBorder: {
          pending:  "rgba(196,163,90,0.15)",
          approved: "rgba(74,158,126,0.15)",
          rejected: "rgba(184,92,92,0.15)",
        },
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
        statusNote: {
          pending:  "rgba(140,107,42,0.05)",
          approved: "rgba(46,122,90,0.05)",
          rejected: "rgba(160,56,56,0.05)",
        },
        statusNoteBorder: {
          pending:  "rgba(140,107,42,0.18)",
          approved: "rgba(46,122,90,0.18)",
          rejected: "rgba(160,56,56,0.18)",
        },
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

function mergeApiStatusIntoLayout(localLayout, apiData) {
  return mergeReservationStatusIntoLayout(localLayout, apiData);
}

function loadLayoutForClient(wing, room) {
  try {
    const key = layoutKey(wing, room);
    const raw = localStorage.getItem(key);
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
  created_at:   new Date().toISOString(),
  updated_at:   new Date().toISOString(),
});

// ─── API helper ───────────────────────────────────────────────────────────────
const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { "Content-Type": "application/json", Accept: "application/json", ...options.headers },
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      let msg = data?.message || `HTTP ${response.status}`;
      if (data?.errors) msg += "\n" + Object.values(data.errors).flat().join("\n");
      throw new Error(msg);
    }
    return data;
  } catch (error) {
    const isCreateReservation =
      endpoint === "/reservations" &&
      (options.method || "GET").toUpperCase() === "POST";
    if (isCreateReservation) {
      console.error("[apiCall] POST /reservations failed — falling back to offline:", error.message);
      const payload = JSON.parse(options.body || "{}");
      const offlineReservation = makeOfflineReservation(payload);
      const reservations = loadStoredReservations();
      reservations.push(offlineReservation);
      saveStoredReservations(reservations);
      return offlineReservation;
    }
    throw error;
  }
};

// ─── Seat / table helpers ─────────────────────────────────────────────────────
const getWholeSeatLabel = (guests, tableData = null) => {
  if (!guests || guests < 1) return "Seat 1";
  if (tableData?.seats?.length) {
    const bookable = tableData.seats
      .filter(s => s.status === "available")
      .slice(0, guests)
      .map(s => s.num ?? s.id);
    if (bookable.length > 0) return `Seat ${bookable.join(", ")}`;
  }
  return `Seat ${Array.from({ length: guests }, (_, i) => i + 1).join(", ")}`;
};

const getSeatRatio = (table) => {
  if (!table?.seats?.length) return null;
  const available = table.seats.filter(s => s.status === "available").length;
  return `${available}/${table.seats.length}`;
};

// ─── Shared primitives ────────────────────────────────────────────────────────
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

// ─── Step indicator ───────────────────────────────────────────────────────────
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

// ─── Field input ──────────────────────────────────────────────────────────────
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
function ModalGuestCount({ seatData, tableData, mode, isStandalone, onContinue, onCancel, C, isDark }) {
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
function ModalDetails({ tableData, seatData, mode, guests, isStandalone, onReview, onCancel, prefill, C, isDark, secondsLeft, onTimerExpired }) {
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
  const roomLabel = typeof ROOM !== "undefined" ? ROOM : "Selected Outlet";
  const wingLabel = typeof WING !== "undefined" ? WING : "Venue";

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
    ["Outlet", roomLabel],
    ["Wing", wingLabel],
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

          <SectionLabel C={C} style={{ marginTop: 8 }}>Event Details</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
            <Field label="Event Date" value={form.eventDate} onChange={set("eventDate")} type="date" min={today} C={C} isDark={isDark} required />
            <Field label="Event Time" value={form.eventTime} onChange={set("eventTime")} type="time" C={C} isDark={isDark} />
          </div>
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


// ─── MODAL 3: Review ──────────────────────────────────────────────────────────
function ModalReview({ form, guests, tableData, seatData, mode, isStandalone, onSubmit, onEdit, submitting, isRebook, rebookFrom, C }) {
  const [consentAccepted, setConsentAccepted] = useState(false);
  const fmt = t => { if (!t) return null; const [h, m] = t.split(":"); const hr = parseInt(h); return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`; };
  const roomLabel = typeof ROOM !== "undefined" ? ROOM : "Selected Outlet";
  const wingLabel = typeof WING !== "undefined" ? WING : "Venue";
  const seatDisplay = mode === "whole" ? getWholeSeatLabel(guests, tableData) : `Seat ${seatData?.num ?? seatData?.id ?? "-"}`;
  const canSubmit = consentAccepted && !submitting;

  const reservationRows = [
    ["Venue", "The Bellevue Manila"],
    ["Room", `${wingLabel} - ${roomLabel}`],
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
                I acknowledge and consent to the collection and processing of my personal information for reservation management and operational communication purposes.
              </span>
            </label>

            <div style={{ fontSize: 11.5, color: C.textTertiary, lineHeight: 1.6 }}>
              Personal details are used to process the reservation, coordinate operational requirements, and contact the guest regarding reservation status.
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


// ─── QR Code ──────────────────────────────────────────────────────────────────
function QRCodeWithRef({ value, size = 120, imgRef }) {
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
          if (qrCanvas) { const src = qrCanvas.toDataURL("image/png"); if (!cancelled) { setImgSrc(src); if (imgRef) imgRef.current = src; } document.body.removeChild(tmp); return; }
          const qrImg = tmp.querySelector("img");
          if (qrImg?.src) { if (!cancelled) { setImgSrc(qrImg.src); if (imgRef) imgRef.current = qrImg.src; } document.body.removeChild(tmp); return; }
          if (attempt < 5) setTimeout(() => tryExtract(attempt + 1), 100 * (attempt + 1));
          else document.body.removeChild(tmp);
        };
        tryExtract();
      } catch (e) { if (tmp.parentNode) document.body.removeChild(tmp); }
    };
    if (window.QRCode) { doRender(); } else {
      const existing = document.querySelector("script[data-qrcodejs]");
      if (existing) existing.addEventListener("load", doRender);
      else {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
        script.setAttribute("data-qrcodejs", "1");
        script.onload = doRender;
        document.head.appendChild(script);
      }
    }
    return () => { cancelled = true; };
  }, [value, size]);

  if (!imgSrc) return <div style={{ width: size, height: size, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "rgba(237,232,223,0.20)", fontFamily: F.label }}>QR</div>;
  return <img src={imgSrc} alt="QR Code" style={{ width: size, height: size, display: "block", borderRadius: 8, imageRendering: "pixelated" }} />;
}

const buildQrValue = ({ refCode }) => {
  const base = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
  const url = base.startsWith("http") ? base : `https://${base}`;
  return `${url}/grand-ballroom-b/${String(refCode || "").trim()}`;
};

// ─── Modal: Success ───────────────────────────────────────────────────────────
function ModalSuccess({ refCode, onBack, mode, guests, isRebook, bookingDetails, C }) {
  const qrImgRef  = useRef(null);
  const [saving,  setSaving]  = useState(false);
  const [qrReady, setQrReady] = useState(false);
  const qrValue = buildQrValue({ refCode: refCode || "" });

  const fmtDate = d => {
    if (!d) return "—";
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
    catch { return d; }
  };

  useEffect(() => {
    let tries = 0;
    const poll = setInterval(() => {
      if (qrImgRef.current) { setQrReady(true); clearInterval(poll); }
      if (++tries > 20) clearInterval(poll);
    }, 100);
    return () => clearInterval(poll);
  }, []);

  const handleSavePhoto = useCallback(async () => {
    if (saving || !qrReady) return;
    setSaving(true);
    try {
      const dpr = 3; const W = 320; const H = 380;
      const canvas = document.createElement("canvas");
      canvas.width = W * dpr; canvas.height = H * dpr;
      const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
      ctx.fillStyle = "#0A0908"; ctx.beginPath(); ctx.roundRect(0, 0, W, H, 16); ctx.fill();
      const barH = 6; ctx.fillStyle = "#C4A35A"; ctx.beginPath(); ctx.roundRect(0, 0, W, barH, [16, 16, 0, 0]); ctx.fill();
      const qrSize = 220; const qrX = (W - qrSize) / 2; const qrY = barH + 28;
      if (qrImgRef.current) {
        await new Promise(resolve => {
          const qImg = new Image();
          qImg.onload = () => {
            ctx.fillStyle = "#FFFFFF"; ctx.beginPath(); ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 10); ctx.fill();
            ctx.drawImage(qImg, qrX, qrY, qrSize, qrSize); resolve();
          };
          qImg.onerror = resolve; qImg.src = qrImgRef.current;
        });
      }
      const divY = qrY + qrSize + 20;
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(28, divY); ctx.lineTo(W - 28, divY); ctx.stroke();
      const guestDisplayName = (bookingDetails?.name || "").trim() || refCode || "—";
      ctx.fillStyle = "#8A8278"; ctx.font = "600 9px sans-serif"; ctx.textAlign = "center"; ctx.fillText("GUEST NAME", W / 2, divY + 20);
      ctx.fillStyle = "#EDE8DF"; ctx.font = "bold 22px sans-serif"; ctx.fillText(guestDisplayName, W / 2, divY + 52);
      const link = document.createElement("a");
      link.download = `bellevue-grand-ballroom-b-${refCode || "ticket"}.png`;
      link.href = canvas.toDataURL("image/png"); link.click();
    } catch { alert("Could not save photo. Please try again."); }
    finally { setSaving(false); }
  }, [refCode, saving, qrReady]);

  return (
    <ModalShell onClose={onBack} C={C} maxWidth={460}>
      <div style={{ padding: "26px 26px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, background: C.statusNote.approved, border: `1px solid ${C.statusNoteBorder.approved}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <div>
            <div style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.22em", color: isRebook ? C.gold : C.green, fontWeight: 700, textTransform: "uppercase", marginBottom: 3 }}>
              {isRebook ? "Seat Moved" : "Reservation Submitted"}
            </div>
            <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 600, color: C.textPrimary, lineHeight: 1.2 }}>Request Submitted</div>
          </div>
        </div>

        <div style={{ padding: "14px 16px", borderRadius: 10, marginBottom: 16, background: C.goldFaintest, border: `1px solid ${C.borderAccent}` }}>
          <div style={{ fontFamily: F.label, fontSize: 8, letterSpacing: "0.20em", fontWeight: 700, textTransform: "uppercase", color: C.textTertiary, marginBottom: 6 }}>Reference Code</div>
          <div style={{ fontFamily: F.mono, fontSize: 24, fontWeight: 800, color: C.textPrimary, letterSpacing: "0.12em" }}>{refCode || "—"}</div>
        </div>

        <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            {[
              { label: "Room",    value: ROOM },
              { label: "Date",    value: fmtDate(bookingDetails?.date) },
              { label: "Guests",  value: String(guests) },
              { label: "Status",  value: "Awaiting Confirmation", gold: true },
            ].map(({ label, value, gold }, i, arr) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.divider}` : "none" }}>
                <span style={{ fontFamily: F.label, fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", color: C.textTertiary, textTransform: "uppercase" }}>{label}</span>
                <span style={{ fontFamily: F.body, fontSize: 12, fontWeight: 600, color: gold ? C.gold : C.textPrimary }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ padding: 8, background: "#FFFFFF", borderRadius: 8, border: `1px solid ${C.borderDefault}` }}>
              <QRCodeWithRef value={qrValue} size={88} imgRef={qrImgRef} />
            </div>
            <div style={{ fontFamily: F.label, fontSize: 8, color: C.textTertiary, letterSpacing: "0.06em" }}>Scan to verify</div>
          </div>
        </div>

        <div style={{ fontFamily: F.body, fontSize: 12, color: C.textSecondary, lineHeight: 1.65, padding: "10px 14px", borderRadius: 8, background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, marginBottom: 20 }}>
          Your booking is awaiting confirmation. You'll be notified once an admin reviews your reservation.
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSavePhoto} disabled={saving || !qrReady}
            style={{ flex: 1, padding: "12px", background: "transparent", border: `1px solid ${(saving || !qrReady) ? C.borderDefault : C.borderStrong}`, borderRadius: 8, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: (saving || !qrReady) ? C.textTertiary : C.textSecondary, cursor: (saving || !qrReady) ? "not-allowed" : "pointer", transition: "all 0.18s", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
            onMouseEnter={e => { if (!saving && qrReady) { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.color = C.gold; } }}
            onMouseLeave={e => { if (!saving && qrReady) { e.currentTarget.style.borderColor = C.borderStrong; e.currentTarget.style.color = C.textSecondary; } }}
          >
            {saving ? <><Spinner C={C} />Saving…</> : !qrReady ? "Loading…" : (
              <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>Save Pass</>
            )}
          </button>
          <button onClick={onBack}
            style={{ flex: 1, padding: "12px", border: "none", borderRadius: 8, background: C.gold, color: C.textOnAccent, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", transition: "background 0.18s" }}
            onMouseEnter={e => { e.currentTarget.style.background = C.goldLight; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.gold; }}
          >Back to Map</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Mobile bottom sheet ──────────────────────────────────────────────────────
function MobileBottomSheet({ mode, selectedSeat, activeTable, guests, seatRatio, canProceed, rebookFrom, onReserve, C, isDark, isStandaloneSeat }) {
  const displayTable = isStandaloneSeat
    ? "Standalone"
    : mode === "whole"
      ? (activeTable ? `Table ${activeTable.id}` : "Tap a table")
      : (activeTable ? `Table ${activeTable.id}` : "—");

  const displaySeat = mode === "individual"
    ? (selectedSeat ? `Seat ${selectedSeat.num ?? selectedSeat.id}` : "Tap a seat")
    : getWholeSeatLabel(guests, activeTable);

  const canGo = mode === "whole" ? true : canProceed;

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 200, background: C.bottomSheet, borderTop: `1px solid ${C.borderAccent}`, borderRadius: "20px 20px 0 0", boxShadow: "0 -8px 32px rgba(0,0,0,0.28)", padding: "0 0 max(env(safe-area-inset-bottom), 12px) 0", animation: "slideUp 0.26s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${C.gold}80 30%, ${C.gold}80 70%, transparent)`, borderRadius: "20px 20px 0 0" }} />
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 8, paddingBottom: 4 }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.borderStrong }} />
      </div>
      <div style={{ padding: "10px 16px 14px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {!isStandaloneSeat && (
            <div style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: C.goldFaintest, border: `1px solid ${C.borderAccent}` }}>
              <div style={{ fontFamily: F.label, fontSize: 8, letterSpacing: "0.16em", color: C.textTertiary, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Table</div>
              <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: C.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayTable}</div>
              {seatRatio && <div style={{ fontFamily: F.label, fontSize: 8, color: C.gold, marginTop: 2 }}>{seatRatio} avail.</div>}
            </div>
          )}
          <div style={{ flex: 1, padding: "8px 12px", borderRadius: 10, background: mode === "individual" && selectedSeat ? C.goldFaint : C.surfaceInput, border: `1px solid ${mode === "individual" && selectedSeat ? C.borderAccent : C.borderDefault}` }}>
            <div style={{ fontFamily: F.label, fontSize: 8, letterSpacing: "0.16em", color: C.textTertiary, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>{mode === "whole" ? "Seats" : "Seat"}</div>
            <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 600, color: mode === "individual" && selectedSeat ? C.gold : C.textSecondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displaySeat}</div>
          </div>
          <div style={{ flex: 1.4, padding: "8px 12px", borderRadius: 10, background: C.surfaceInput, border: `1px solid ${C.borderDefault}` }}>
            <div style={{ fontFamily: F.label, fontSize: 8, letterSpacing: "0.16em", color: C.textTertiary, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Room</div>
            <div style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, color: C.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Grand Ballroom B</div>
          </div>
        </div>
        <button
          onClick={canGo ? onReserve : undefined}
          disabled={!canGo}
          style={{ width: "100%", padding: "15px", background: canGo ? C.gold : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"), border: "none", borderRadius: 12, fontFamily: F.label, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: canGo ? C.textOnAccent : C.textTertiary, cursor: canGo ? "pointer" : "not-allowed", transition: "all 0.18s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {mode === "whole"
            ? (rebookFrom ? "Move to This Table" : activeTable ? "Reserve This Table" : "Tap a Table to Reserve")
            : selectedSeat
              ? (rebookFrom ? "Move to This Seat" : "Reserve This Seat")
              : "Select a Seat First"
          }
        </button>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function GrandBallroomBReserve() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedRoom = location.state?.selectedSubRoom || ROOM;

  const [isDark, setIsDark] = useState(() => {
    try { const s = localStorage.getItem("bellevue-theme"); if (s !== null) return s === "dark"; } catch {}
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  });

  useEffect(() => {
    const onStorage = e => { if (e.key === "bellevue-theme") setIsDark(e.newValue === "dark"); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const C = getTokens(isDark);

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
  const [tableData,          setTableData]          = useState(() => loadLayoutForClient(WING, ROOM));

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

  // Timer countdown
  useEffect(() => {
    if (modal !== "details" && modal !== "review") return;
    if (holdSecondsLeft <= 0) { setModal(null); resetHoldTimer(); return; }
    const id = setInterval(() => setHoldSecondsLeft(s => s - 1), 1000);
    return () => clearInterval(id);
  }, [modal, holdSecondsLeft]);

  // Listen for localStorage / CustomEvent seatmap updates
  useEffect(() => {
    const onStorage = e => {
      if (e.key !== layoutKey(WING, ROOM)) return;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : null;
        if (parsed?.v === 2) {
          // CRITICAL FIX: Never trust admin-set statuses for client display
          // Reset all seats to available and fetch real API data
          const cleanLayout = mergeApiStatusIntoLayout(parsed, []);
          setTableData(cleanLayout);
          fetchAndMerge();
        }
      } catch {}
    };
    const onSeatMapSaved = e => {
      if (e.detail?.room !== ROOM) return;
      try {
        const parsed = e.detail.payload ? JSON.parse(e.detail.payload) : null;
        if (parsed?.v === 2) {
          // CRITICAL FIX: Never trust admin-set statuses for client display
          const cleanLayout = mergeApiStatusIntoLayout(parsed, []);
          setTableData(cleanLayout);
          fetchAndMerge();
        }
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("seatmap:saved", onSeatMapSaved);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("seatmap:saved", onSeatMapSaved);
    };
  }, [fetchAndMerge]);

  // ─── Fetch & merge API status into local layout ───────────────────────────
  const fetchAndMerge = useCallback(async () => {
    try {
      const res = await fetch(
        withSeatmapSchedule(`${API_BASE_URL}/reservations?room=${encodeURIComponent(ROOM)}&wing=${encodeURIComponent(API_WING)}&venue_id=3&per_page=9999`),
        { headers: { Accept: "application/json" } }
      );

      if (!res.ok) {
        try {
          const fallback = await fetch(
            withSeatmapSchedule(`${API_BASE_URL}/reservations?room=${encodeURIComponent(ROOM)}&per_page=9999`),
            { headers: { Accept: "application/json" } }
          );
          if (!fallback.ok) return;
          const fbData = await fallback.json();
          if (!fbData?.data) return;
          setTableData(prev => {
            const base   = prev || loadLayoutForClient(WING, ROOM);
            const merged = base ? mergeApiStatusIntoLayout(base, fbData.data) : fbData.data;
            try { localStorage.setItem(layoutKey(WING, ROOM), JSON.stringify(merged)); } catch {}
            return merged;
          });
        } catch {}
        return;
      }

      const json = await res.json();
      const rows = Array.isArray(json)
        ? json
        : Array.isArray(json?.data)
          ? json.data
          : [];

      const reservations = rows.filter(r =>
        !r.room || r.room === ROOM || r.wing === API_WING
      );

      const priority = { available: 0, pending: 1, unavailable: 1, reserved: 2 };
      const seatStatusMap = {};

      reservations.forEach(r => {
        const apiStatus   = normaliseApiStatus(r.status);
        const isStandalone =
          String(r.table_number ?? "").toUpperCase() === "STANDALONE" ||
          r.type === "standalone" ||
          r.is_standalone === 1 ||
          r.is_standalone === true;

        const tableKey = isStandalone ? "STANDALONE" : String(r.table_number ?? "").trim();
        const rawSeats = String(r.seat_number ?? r.seat ?? "").trim();
        if (!rawSeats) return;

        rawSeats.split(",").map(s => s.trim()).filter(Boolean).forEach(seatNum => {
          const key      = `${tableKey}|${seatNum}`;
          const existing = seatStatusMap[key];
          if (!existing || (priority[apiStatus] ?? -1) > (priority[existing] ?? -1)) {
            seatStatusMap[key] = apiStatus;
          }
        });
      });

      setTableData(prev => {
        const base = prev || loadLayoutForClient(WING, ROOM);
        if (!base) return prev;

        const updatedTables = (base.tables || []).map(t => {
          const tId     = String(t.id ?? "").trim();
          const tIdNorm = tId.replace(/^T/i, "");
          return {
            ...t,
            seats: (t.seats || []).map(s => {
              const sNum = String(s.num ?? s.id ?? "").trim();
              const resolved =
                seatStatusMap[`${tId}|${sNum}`]      ??
                seatStatusMap[`T${tIdNorm}|${sNum}`] ??
                seatStatusMap[`${tIdNorm}|${sNum}`];
              return { ...s, status: resolved ?? (s.status === "maintenance" ? "maintenance" : "available") };
            }),
          };
        });

        const updatedStandalone = (base.standaloneSeats || []).map(s => {
          const sNum = String(s.num ?? s.id ?? "").trim();
          const resolved =
            seatStatusMap[`STANDALONE|${sNum}`] ??
            seatStatusMap[`standalone|${sNum}`];
          return { ...s, status: resolved ?? (s.status === "maintenance" ? "maintenance" : "available") };
        });

        const updated = { ...base, tables: updatedTables, standaloneSeats: updatedStandalone };
        try { localStorage.setItem(layoutKey(WING, ROOM), JSON.stringify(updated)); } catch {}
        return updated;
      });
    } catch (err) {
      console.error("[GrandBallroomB] fetchAndMerge error:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const local = loadLayoutForClient(WING, ROOM);
    if (local) setTableData(local);
    fetchAndMerge();
  }, [fetchAndMerge]);
  useEffect(() => {
    const onScheduleChanged = () => {
      setSelectedSeat(null);
      setSelectedTable(null);
      fetchAndMerge();
    };
    window.addEventListener("seatmap:schedule-changed", onScheduleChanged);
    return () => window.removeEventListener("seatmap:schedule-changed", onScheduleChanged);
  }, [fetchAndMerge]);

  // Window resize
  useEffect(() => {
    const h = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // WebSocket / polling
  useEffect(() => {
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

    try { echoRef.current = new Echo({ broadcaster: "pusher", key: pusherKey, cluster: pusherCluster }); }
    catch (err) { startPolling(); return () => stopPolling(); }

    const echo = echoRef.current;
    try {
      const channel = echo.channel("reservations");
      const events  = ["ReservationCreated","ReservationUpdated","ReservationDeleted","ReservationApproved","ReservationRejected","SeatReserved","TableReserved"];
      events.forEach(ev => channel.listen(ev, () => {
        wsConnected = true; stopPolling(); fetchAndMerge();
      }));
      const fallbackTimer = setTimeout(() => { if (!wsConnected) startPolling(); }, 8_000);
      return () => {
        clearTimeout(fallbackTimer); stopPolling();
        try { events.forEach(ev => channel.stopListening(ev)); } catch {}
      };
    } catch (err) {
      startPolling();
      return () => stopPolling();
    }
  }, [fetchAndMerge]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, []);

  // ─── Derived helpers ────────────────────────────────────────────────────────
  const getTables          = () => { if (!tableData) return []; if (tableData.tables) return tableData.tables; if (Array.isArray(tableData)) return tableData; return [tableData]; };
  const getStandaloneSeats = () => tableData?.standaloneSeats || [];

  const isStandaloneSelected = useCallback(() => {
    if (!selectedSeat) return false;
    const inTable = getTables().some(t => (t.seats || []).some(s => s.id === selectedSeat.id));
    if (inTable) return false;
    return getStandaloneSeats().some(s => s.id === selectedSeat.id);
  }, [selectedSeat, tableData]);

  const resolveTableForSeat = seat => {
    if (!seat) return null;
    return getTables().find(t => t.seats?.some(s => s.id === seat.id)) || null;
  };

  const getActiveTable = () => selectedTable || getTables()[0] || null;

  // ─── Event handlers ─────────────────────────────────────────────────────────
  const handleTableClick    = table => { setSelectedTable(table); setModal("guestCount"); };
  const handleSeatClick     = seat  => {
    if (seat.status !== "available") { alert("This seat is unavailable for the selected schedule."); return; }
    setSelectedSeat(seat);
    setSelectedTable(resolveTableForSeat(seat));
  };
  const handleGuestContinue = g => { setGuests(g); startHoldTimer(); setModal("details"); };
  const handleReview        = form => { setFormData(form); setSchedule(normalizeSchedule({ eventDate: form.eventDate, eventTime: form.eventTime })); setModal("review"); };
  const handleEditDetails   = ()   => { setModal("details"); };

  const handleSubmit = async () => {
    if (!formData || submitting) return;
    setSubmitting(true);
    try {
      const isStandalone = isStandaloneSelected();
      const activeTable  = isStandalone ? null : getActiveTable();

      const seatNum = isStandalone
        ? String(selectedSeat?.num ?? selectedSeat?.label ?? selectedSeat?.id ?? "")
        : mode === "individual"
          ? String(selectedSeat?.num ?? selectedSeat?.id ?? "")
          : Array.from({ length: guests }, (_, i) => i + 1).join(",");

      const payload = {
        name:             `${formData.firstName} ${formData.lastName}`,
        email:            formData.email,
        phone:            formData.phone,
        venue_id:         1,
        wing:             API_WING,
        room:             selectedRoom,
        table_number:     isStandalone ? "STANDALONE" : String(activeTable?.id ?? "T1"),
        seat_number:      seatNum,
        guests_count:     isStandalone ? 1 : guests,
        event_date:       formData.eventDate,
        event_time:       formData.eventTime ? formData.eventTime.substring(0, 5) : null,
        event_area: formData.eventArea || null,
        setup_tables: formData.setupTables ? Number(formData.setupTables) : null,
        setup_chairs: formData.setupChairs ? Number(formData.setupChairs) : null,
        setup_requirements: formData.setupRequirements || null,
        special_requests: formData.specialRequests || "",
        type:             isStandalone ? "standalone" : mode,
        is_standalone:    isStandalone ? 1 : 0,
        seat_id:          isStandalone ? (selectedSeat?.id ?? null) : null,
      };

      const response   = await apiCall("/reservations", { method: "POST", body: JSON.stringify(payload) });
      const newRefCode = response.reference_code || "—";
      setRefCode(newRefCode);
      setLastBookingDetails({
        room:  selectedRoom,
        table: isStandalone ? "Standalone Seat" : `Table ${activeTable?.id ?? "—"}`,
        date:  formData.eventDate,
        name:  `${formData.firstName} ${formData.lastName}`,
      });

      if (rebookFrom) {
        try { await apiCall(`/reservations/${rebookFrom.db_id || rebookFrom.id}/reject`, { method: "PATCH" }); } catch {}
      }

      // Optimistic UI update
      setTableData(prev => {
        if (!prev) return prev;
        if (isStandalone && selectedSeat) {
          const updatedStandaloneSeats = (prev.standaloneSeats || []).map(s =>
            s.id === selectedSeat.id ? { ...s, status: "available" } : s
          );
          const updated = { ...prev, standaloneSeats: updatedStandaloneSeats };
          try { localStorage.setItem(layoutKey(WING, ROOM), JSON.stringify(updated)); } catch {}
          return updated;
        }
        if (activeTable) {
          const tables = (prev.tables || []).map(t => {
            if (t.id !== activeTable.id) return t;
            if (mode === "individual") {
              return { ...t, seats: t.seats.map(s => s.id === selectedSeat?.id ? { ...s, status: "available" } : s) };
            }
            let marked = 0;
            return {
              ...t,
              seats: t.seats.map(s => {
                if (marked < guests && s.status === "available") { marked++; return { ...s, status: "available" }; }
                return s;
              }),
            };
          });
          const updated = { ...prev, tables };
          try { localStorage.setItem(layoutKey(WING, ROOM), JSON.stringify(updated)); } catch {}
          return updated;
        }
        return prev;
      });

      setModal("success");
      resetHoldTimer();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally { setSubmitting(false); }
  };

  const handleBack = () => {
    setModal(null); setSelectedSeat(null); setSelectedTable(null);
    setRefCode(null); setFormData(null); setGuests(2);
    setRebookFrom(null); setLastBookingDetails(null); resetHoldTimer();
    fetchAndMerge();
  };

  // ─── Derived display values ─────────────────────────────────────────────────
  const isMobile     = windowSize.width < 640;
  const isTablet     = windowSize.width < 1024;
  const activeTable  = getActiveTable();
  const isStandalone = isStandaloneSelected();
  const canProceed   = mode === "individual" && selectedSeat && selectedSeat.status === "available";
  const seatRatio    = activeTable ? getSeatRatio(activeTable) : null;

  const displayTable = isStandalone
    ? "Standalone"
    : mode === "whole"
      ? (activeTable ? `Table ${activeTable.id}` : "—")
      : (selectedTable ? `Table ${selectedTable.id}` : "—");

  const displaySeat = mode === "individual"
    ? (selectedSeat ? `Seat ${selectedSeat.num ?? selectedSeat.id}` : "Select a seat")
    : getWholeSeatLabel(guests, activeTable);

  const rebookPrefill  = rebookFrom
    ? { firstName: (rebookFrom.name || "").split(/\s+/)[0] || "", lastName: (rebookFrom.name || "").split(/\s+/).slice(1).join(" ") || "", email: rebookFrom.email || "", phone: rebookFrom.phone || "", eventDate: rebookFrom.event_date || "", eventTime: rebookFrom.event_time || "19:00", specialRequests: rebookFrom.special_requests || "", eventArea: rebookFrom.event_area || rebookFrom.eventArea || "", setupTables: rebookFrom.setup_tables || rebookFrom.setupTables || "", setupChairs: rebookFrom.setup_chairs || rebookFrom.setupChairs || "", setupRequirements: rebookFrom.setup_requirements || rebookFrom.setupRequirements || "" }
    : null;
  const detailsPrefill = formData
    ? { firstName: formData.firstName || "", lastName: formData.lastName || "", email: formData.email || "", phone: formData.phone || "+63", eventDate: formData.eventDate || "", eventTime: formData.eventTime || "19:00", specialRequests: formData.specialRequests || "", eventArea: formData.eventArea || "", setupTables: formData.setupTables || "", setupChairs: formData.setupChairs || "", setupRequirements: formData.setupRequirements || "" }
    : (rebookPrefill || { firstName: "", lastName: "", email: "", phone: "+63", eventDate: schedule.eventDate || "", eventTime: schedule.eventTime || "19:00", specialRequests: "" });

  const BOTTOM_SHEET_H  = 180;
  const NAV_H           = 64;
  const mobileMapHeight = windowSize.height - NAV_H - BOTTOM_SHEET_H;

  const modalTableData = isStandalone ? null : (mode === "individual" ? resolveTableForSeat(selectedSeat) : activeTable);
  const legendEntries  = Object.entries(STATUS_COLORS).filter(([key]) => LEGEND_STATUSES.includes(key));

  return (
    <ThemeContext.Provider value={{ isDark, toggle: () => {} }}>
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

      <div style={{ minHeight: "100vh", fontFamily: F.body, background: C.pageBg, transition: "background 0.30s", position: "relative" }}>

        {/* Background */}
        <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "url('/assets/bg-login.jpeg')", backgroundSize: "cover", backgroundPosition: "center", filter: isDark ? "blur(6px) brightness(0.35)" : "blur(6px) brightness(0.45) saturate(0.4)", transform: "scale(1.05)", transition: "filter 0.40s" }} />
          <div style={{ position: "absolute", inset: 0, background: isDark ? "rgba(12,11,10,0.75)" : "rgba(237,233,224,0.65)", transition: "background 0.40s" }} />
        </div>

        <SharedNavbar />

        {/* ══════════════ MOBILE LAYOUT ══════════════ */}
        {isMobile ? (
          <div style={{ position: "relative", zIndex: 1, paddingTop: NAV_H }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 8px", background: isDark ? "rgba(10,9,8,0.85)" : "rgba(247,244,238,0.90)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: `1px solid ${C.borderAccent}` }}>
              <button onClick={() => navigate("/venues")} title="Back"
                style={{ width: 34, height: 34, borderRadius: "50%", background: "transparent", border: `1px solid ${C.borderDefault}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.textSecondary }}><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F.label, fontSize: 8, letterSpacing: "0.22em", color: C.gold, fontWeight: 700, textTransform: "uppercase" }}>Tower Wing · Seat Reservation</div>
                <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 600, color: C.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Grand Ballroom B</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 0, padding: "10px 16px", background: isDark ? "rgba(10,9,8,0.80)" : "rgba(247,244,238,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderBottom: `1px solid ${C.borderDefault}` }}>
              {[["whole", "Whole Table"], ["individual", "Individual Seat"]].map(([val, label], i) => (
                <button key={val}
                  onClick={() => { setMode(val); if (val === "whole") setSelectedSeat(null); else setSelectedTable(null); }}
                  style={{ flex: 1, padding: "9px 0", background: mode === val ? C.gold : "transparent", border: `1px solid ${mode === val ? C.gold : C.borderDefault}`, borderRadius: i === 0 ? "8px 0 0 8px" : "0 8px 8px 0", color: mode === val ? C.textOnAccent : C.textSecondary, fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.18s" }}
                >{label}</button>
              ))}
            </div>

            {rebookFrom && (
              <div style={{ margin: "8px 16px 0", padding: "10px 14px", borderRadius: 8, background: C.statusNote.pending, border: `1px solid ${C.statusNoteBorder.pending}`, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14 }}>🔄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F.label, fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>Rebooking Mode</div>
                  <div style={{ fontFamily: F.body, fontSize: 11, color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Prev: <strong style={{ color: C.textPrimary }}>{rebookFrom.reference_code || rebookFrom.id}</strong>
                  </div>
                </div>
                <button onClick={() => setRebookFrom(null)} style={{ background: "transparent", border: `1px solid ${C.borderDefault}`, borderRadius: 6, padding: "4px 8px", fontFamily: F.label, fontSize: 8, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: C.textSecondary, cursor: "pointer", flexShrink: 0 }}>Cancel</button>
              </div>
            )}

            <div style={{ width: "100%", height: mobileMapHeight, position: "relative", overflow: "hidden", background: C.surfaceBase }}>
              {tableData ? (
                <>
                  <div style={{ width: "100%", height: "100%", overflow: "auto", WebkitOverflowScrolling: "touch" }}>
                    <SeatMap tableData={tableData} editMode={false} mode={mode} selectedSeat={selectedSeat} onSeatClick={handleSeatClick} onTableClick={handleTableClick} windowWidth={windowSize.width} wing={WING} room={ROOM} />
                  </div>
                  <div style={{ position: "absolute", bottom: 10, left: 10, background: isDark ? "rgba(10,9,8,0.88)" : "rgba(247,244,238,0.92)", border: `1px solid ${C.borderDefault}`, borderRadius: 10, padding: "8px 10px", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 2, display: "flex", flexDirection: "column", gap: 3 }}>
                    {legendEntries.map(([key, color]) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                        <span style={{ fontFamily: F.body, fontSize: 10, color: C.textSecondary, fontWeight: 500, textTransform: "capitalize" }}>{key}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 32 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" /></svg>
                  </div>
                  <div style={{ fontFamily: F.body, fontSize: 13, color: C.textSecondary, textAlign: "center", lineHeight: 1.7 }}>
                    No seat layout published for Grand Ballroom B.<br />
                    <span style={{ fontSize: 12, color: C.textTertiary }}>Please check back later.</span>
                  </div>
                </div>
              )}
            </div>

            <MobileBottomSheet mode={mode} selectedSeat={selectedSeat} activeTable={activeTable} guests={guests} seatRatio={seatRatio} canProceed={canProceed} rebookFrom={rebookFrom} onReserve={() => setModal("guestCount")} C={C} isDark={isDark} isStandaloneSeat={isStandalone} />
          </div>

        ) : (
          /* ══════════════ TABLET / DESKTOP LAYOUT ══════════════ */
          <div style={{ position: "relative", zIndex: 1, paddingTop: 64, minHeight: "100vh" }}>
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
                {rebookFrom && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 8, marginBottom: 16, background: C.statusNote.pending, border: `1px solid ${C.statusNoteBorder.pending}` }}>
                    <span style={{ fontSize: 14 }}>🔄</span>
                    <div>
                      <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold, marginBottom: 2 }}>Rebooking Mode</div>
                      <div style={{ fontFamily: F.body, fontSize: 11, color: C.textSecondary }}>Previous booking <strong style={{ color: C.textPrimary }}>{rebookFrom.reference_code || rebookFrom.id}</strong> — select your new {mode === "individual" ? "seat" : "table"}</div>
                    </div>
                    <button onClick={() => setRebookFrom(null)} style={{ marginLeft: 8, background: "transparent", border: `1px solid ${C.borderDefault}`, borderRadius: 6, padding: "4px 10px", fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: C.textSecondary, cursor: "pointer" }}>Cancel</button>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ display: "inline-block", width: 24, height: "1px", background: C.gold, opacity: 0.6 }} />
                  <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.26em", color: C.gold, fontWeight: 700, textTransform: "uppercase" }}>Tower Wing · Seat Reservation</span>
                </div>
                <h1 style={{ fontFamily: F.display, fontSize: isTablet ? 34 : 42, fontWeight: 600, color: C.textPrimary, lineHeight: 1.1, margin: "0 0 10px", letterSpacing: "0.01em" }}>
                  Grand Ballroom B
                </h1>
                <p style={{ fontFamily: F.body, fontSize: 13.5, color: C.textSecondary, margin: 0, lineHeight: 1.70, maxWidth: 560 }}>
                  Book your preferred table in Grand Ballroom B. Select your reservation type and click on the map to get started.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, flexWrap: "wrap", animation: "fadeUp 0.34s ease" }}>
                <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.22em", color: C.textSecondary, fontWeight: 700, textTransform: "uppercase", flexShrink: 0 }}>Reserve a:</span>
                <div style={{ display: "flex", alignItems: "center", background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)", borderRadius: 8, padding: 3, gap: 3, border: `1px solid ${C.borderDefault}` }}>
                  {[["whole", "Whole Table"], ["individual", "Individual Seat"]].map(([val, label]) => (
                    <button key={val}
                      onClick={() => { setMode(val); if (val === "whole") setSelectedSeat(null); else setSelectedTable(null); }}
                      style={{ padding: "8px 18px", border: "none", background: mode === val ? C.gold : "transparent", color: mode === val ? C.textOnAccent : C.textSecondary, cursor: "pointer", fontSize: 10, letterSpacing: "0.12em", fontWeight: 700, fontFamily: F.label, borderRadius: 6, transition: "all 0.18s", outline: "none", textTransform: "uppercase" }}
                    >{label}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexDirection: isTablet ? "column" : "row", animation: "fadeUp 0.36s ease" }}>

                {/* Seatmap canvas */}
                <div style={{ flex: "1 1 0", width: isTablet ? "100%" : undefined, minWidth: 0, minHeight: 520, background: C.surfaceBase, borderRadius: 14, border: `1px solid ${C.borderDefault}`, overflow: "hidden", boxShadow: isDark ? "0 8px 40px rgba(0,0,0,0.40)" : "0 4px 24px rgba(0,0,0,0.08)", position: "relative", display: "flex", flexDirection: "column" }}>
                  <div style={{ height: "2px", flexShrink: 0, background: `linear-gradient(90deg, transparent 0%, ${C.gold}60 30%, ${C.gold}60 70%, transparent 100%)` }} />
                  {tableData ? (
                    <>
                      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
                        <SeatMap tableData={tableData} editMode={false} mode={mode} selectedSeat={selectedSeat} onSeatClick={handleSeatClick} onTableClick={handleTableClick} windowWidth={windowSize.width} wing={WING} room={ROOM} />
                      </div>
                      <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", background: isDark ? "rgba(10,9,8,0.88)" : "rgba(247,244,238,0.92)", border: `1px solid ${C.borderAccent}`, borderRadius: 20, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", whiteSpace: "nowrap", zIndex: 2 }}>
                        {mode === "whole" ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 15h6" /></svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></svg>
                        )}
                        <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>
                          {mode === "whole" ? "Click a table to reserve" : "Click a seat to select"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 48 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" /></svg>
                      </div>
                      <div style={{ fontFamily: F.body, fontSize: 13, color: C.textSecondary, textAlign: "center", lineHeight: 1.7 }}>
                        No seat layout has been published for Grand Ballroom B yet.<br />
                        <span style={{ fontSize: 12, color: C.textTertiary }}>Please check back later or contact the venue.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right panel */}
                <div style={{ width: isTablet ? "100%" : 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                  <ScheduleGate schedule={schedule} onChange={setSchedule} roomLabel={ROOM} isDark={isDark} />
                  <div style={{ display: isTablet ? "grid" : "flex", gridTemplateColumns: isTablet ? "1fr 1fr" : undefined, flexDirection: isTablet ? undefined : "column", gap: 14 }}>

                    {/* Legend */}
                    <div style={{ background: C.surfaceBase, borderRadius: 12, border: `1px solid ${C.borderDefault}`, overflow: "hidden", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.30)" : "0 2px 12px rgba(0,0,0,0.06)" }}>
                      <div style={{ height: "2px", background: `linear-gradient(90deg, transparent 0%, ${C.gold}60 50%, transparent 100%)` }} />
                      <div style={{ padding: "14px 16px" }}>
                        <div style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.20em", color: C.gold, fontWeight: 700, textTransform: "uppercase", marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.divider}` }}>Status Legend</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {legendEntries.map(([key, color]) => (
                            <div key={key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 0" }}>
                              <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0, display: "inline-block" }} />
                              <span style={{ fontFamily: F.body, fontSize: 12, color: C.textSecondary, fontWeight: 500 }}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Selection summary */}
                    <div style={{ background: C.surfaceBase, borderRadius: 12, border: `1px solid ${C.borderDefault}`, overflow: "hidden", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.30)" : "0 2px 12px rgba(0,0,0,0.06)" }}>
                      <div style={{ height: "2px", background: `linear-gradient(90deg, transparent 0%, ${C.gold}60 50%, transparent 100%)` }} />
                      <div style={{ padding: "14px 16px" }}>
                        <div style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.20em", color: C.gold, fontWeight: 700, textTransform: "uppercase", marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.divider}` }}>Your Selection</div>
                        {[
                          ...(!isStandalone ? [["Table", displayTable, false, seatRatio ?? null]] : []),
                          [mode === "whole" && guests > 1 ? "Seats" : "Seat", displaySeat, true, null],
                          ...(!isStandalone ? [["Wing", API_WING, false, null]] : []),
                          ["Room", ROOM, false, null],
                        ].map(([label, value, isGold, badge]) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.divider}` }}>
                            <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>{label}</span>
                            <span style={{ fontFamily: F.body, fontSize: 11, fontWeight: 600, color: isGold ? C.gold : C.textPrimary, textAlign: "right", display: "flex", alignItems: "center", gap: 5 }}>
                              {value}
                              {badge && <span style={{ background: C.goldFaint, border: `1px solid ${C.borderAccent}`, borderRadius: 4, padding: "1px 5px", fontSize: 9, color: C.gold, fontWeight: 700, fontFamily: F.label }}>{badge}</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Reserve button */}
                  <button
                    onClick={mode === "whole" ? () => setModal("guestCount") : (canProceed ? () => setModal("guestCount") : undefined)}
                    disabled={mode === "individual" && !canProceed}
                    style={{ width: "100%", padding: "13px", background: (mode === "whole" || canProceed) ? C.gold : (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"), border: "none", borderRadius: 8, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: (mode === "whole" || canProceed) ? C.textOnAccent : C.textTertiary, cursor: (mode === "whole" || canProceed) ? "pointer" : "not-allowed", transition: "all 0.20s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    onMouseEnter={e => { if (mode === "whole" || canProceed) e.currentTarget.style.background = C.goldLight; }}
                    onMouseLeave={e => { if (mode === "whole" || canProceed) e.currentTarget.style.background = C.gold; }}
                  >
                    {mode === "whole"
                      ? (rebookFrom ? "Move to This Table" : "Reserve This Table")
                      : selectedSeat ? (rebookFrom ? "Move to This Seat" : "Reserve This Seat") : "Select a Seat First"
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {modal === "guestCount" && (
        <ModalGuestCount
          seatData={mode === "individual" ? selectedSeat : null}
          tableData={modalTableData}
          mode={mode}
          isStandalone={isStandalone}
          onContinue={handleGuestContinue}
          onCancel={() => setModal(null)}
          C={C}
          isDark={isDark}
        />
      )}
      {modal === "details" && (
        <ModalDetails
          tableData={modalTableData}
          seatData={selectedSeat}
          mode={mode}
          guests={guests}
          isStandalone={isStandalone}
          onReview={handleReview}
          onCancel={() => { setModal(null); resetHoldTimer(); }}
          prefill={detailsPrefill}
          C={C}
          isDark={isDark}
          secondsLeft={holdSecondsLeft}
          onTimerExpired={() => { setModal(null); resetHoldTimer(); }}
        />
      )}
      {modal === "review" && formData && (
        <ModalReview
          form={formData}
          guests={guests}
          mode={mode}
          tableData={modalTableData}
          seatData={selectedSeat}
          isStandalone={isStandalone}
          onSubmit={handleSubmit}
          onEdit={handleEditDetails}
          submitting={submitting}
          isRebook={!!rebookFrom}
          rebookFrom={rebookFrom}
          C={C}
        />
      )}
      {modal === "success" && (
        <ModalSuccess
          refCode={refCode}
          onBack={handleBack}
          mode={mode}
          guests={guests}
          isRebook={!!rebookFrom}
          bookingDetails={lastBookingDetails}
          C={C}
          isDark={isDark}
        />
      )}
    </ThemeContext.Provider>
  );
}

