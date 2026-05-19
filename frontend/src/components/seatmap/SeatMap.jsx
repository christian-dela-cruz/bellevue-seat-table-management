// src/components/seatmap/SeatMap.jsx
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { dispatchSeatMapUpdate } from "../../utils/seatMapPersistence.js";
import { cleanupReservationsForDeletedTable, cleanupReservationsForDeletedSeat, cleanupReservationsForDeletedStandaloneSeat } from "../../utils/reservationCleanup.js";
import { authAPI } from "../../services/authAPI.js";
import { getScopedOutletGroups } from "../../constants/outletCatalog.js";

// Status Colors
export const STATUS_COLORS = {
  available: "#4A9E7E",
  unavailable: "#B85C5C",
  pending:   "#C4A35A",
  reserved:  "#B85C5C",
  rejected:  "#4A9E7E",
};
export const STATUS_LABELS = {
  available: "AVAILABLE",
  unavailable: "UNAVAILABLE",
  pending:   "PENDING",
  reserved:  "RESERVED",
  approved:  "APPROVED",
  rejected:  "REJECTED",
};
const SEAT_STATUS_CYCLE = ["available", "pending", "reserved"];

const F = "'Inter', 'Helvetica Neue', Arial, sans-serif";

// ─── VENUE STRUCTURE STORAGE KEY ─────────────────────────────────────────────
const VENUE_STRUCTURE_KEY = "bellevue_venue_structure";

// ─── DEFAULT VENUE STRUCTURE ──────────────────────────────────────────────────
const DEFAULT_VENUE_STRUCTURE = [
  {
    id: "main-wing",
    label: "Main Wing",
    rooms: [
      "Alabang Function Room",
      "Laguna Ballroom 1",
      "Laguna Ballroom 2",
      "20/20 Function Room A",
      "20/20 Function Room B",
      "20/20 Function Room C",
      "Business Center",
    ],
  },
  {
    id: "tower-wing",
    label: "Tower Wing",
    rooms: ["Tower 1", "Tower 2", "Tower 3", "Grand Ballroom A", "Grand Ballroom B", "Grand Ballroom C"],
  },
  {
    id: "dining",
    label: "Dining",
    rooms: ["Qsina", "Hanakazu", "Phoenix Court"],
  },
];

// ─── Venue structure persistence ─────────────────────────────────────────────
function loadVenueStructure() {
  try {
    const raw = localStorage.getItem(VENUE_STRUCTURE_KEY);
    if (!raw) return DEFAULT_VENUE_STRUCTURE;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return DEFAULT_VENUE_STRUCTURE;
  } catch { return DEFAULT_VENUE_STRUCTURE; }
}

function saveVenueStructure(structure) {
  try {
    localStorage.setItem(VENUE_STRUCTURE_KEY, JSON.stringify(structure));
    window.dispatchEvent(new CustomEvent("venue:structure:changed", { detail: { structure } }));
  } catch {}
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────
function getClientTokens(isDark) {
  return isDark
    ? {
        gold: "#C4A35A", goldFaint: "rgba(196,163,90,0.10)", goldFaintest: "rgba(196,163,90,0.05)",
        canvasBg: "#1A1712", canvasBorder: "rgba(196,163,90,0.20)",
        tableBg: "#1F1C15", tableSelected: "#2A2518", tableBgHov: "#252118",
        borderDefault: "rgba(255,255,255,0.08)", borderStrong: "rgba(255,255,255,0.14)",
        borderAccent: "rgba(196,163,90,0.35)",
        textPrimary: "#EDE8DF", textSecondary: "#8A8278", textTertiary: "rgba(237,232,223,0.32)",
        divider: "rgba(255,255,255,0.06)", cardShadow: "0 1px 4px rgba(0,0,0,0.30)",
        labelScreen: { bg: "#C4A35A", color: "#0A0908" },
        labelOther: { color: "#8A8278", border: "rgba(255,255,255,0.10)" },
      }
    : {
        gold: "#8C6B2A", goldFaint: "rgba(140,107,42,0.08)", goldFaintest: "rgba(140,107,42,0.04)",
        canvasBg: "#EDEAE2", canvasBorder: "rgba(140,107,42,0.18)",
        tableBg: "#FFFFFF", tableSelected: "#FFFBF2", tableBgHov: "#FAF8F2",
        borderDefault: "rgba(0,0,0,0.08)", borderStrong: "rgba(0,0,0,0.13)",
        borderAccent: "rgba(140,107,42,0.28)",
        textPrimary: "#18140E", textSecondary: "#7A7060", textTertiary: "rgba(24,20,14,0.35)",
        divider: "rgba(0,0,0,0.06)", cardShadow: "0 1px 4px rgba(0,0,0,0.06)",
        labelScreen: { bg: "#8C6B2A", color: "#FFFFFF" },
        labelOther: { color: "#7A7060", border: "rgba(0,0,0,0.10)" },
      };
}

const C = {
  gold: "#8C6B2A", goldLight: "#A07D38",
  goldFaint: "rgba(140,107,42,0.08)", goldFaintest: "rgba(140,107,42,0.04)",
  pageBg: "#F7F4EE", surfaceBase: "#FFFFFF", surfaceRaised: "#FAF8F4", surfaceInput: "#FFFFFF",
  borderDefault: "rgba(0,0,0,0.08)", borderStrong: "rgba(0,0,0,0.13)", borderAccent: "rgba(140,107,42,0.28)",
  textPrimary: "#18140E", textSecondary: "#7A7060", textTertiary: "rgba(24,20,14,0.35)", textOnAccent: "#FFFFFF",
  red: "#A03838", redFaint: "rgba(160,56,56,0.07)", redBorder: "rgba(160,56,56,0.18)",
  green: "#2E7A5A", greenFaint: "rgba(46,122,90,0.07)", greenBorder: "rgba(46,122,90,0.18)",
  navBg: "rgba(247,244,238,0.98)", navBorder: "rgba(140,107,42,0.14)",
  divider: "rgba(0,0,0,0.06)", canvasBg: "#EDEAE2", canvasBorder: "rgba(140,107,42,0.18)",
  tableBg: "#FFFFFF", tableSelected: "#FFFBF2",
  sidebarBg: "#FAF8F4", sidebarBorder: "rgba(0,0,0,0.06)",
  inputFocus: "0 0 0 3px rgba(140,107,42,0.10)", cardShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

// FIX: Use let so these can be reset when a room is loaded
let _tableCounter = 1, _standaloneCounter = 1;

function makeTable(x = 120, y = 80) {
  const id = `T${_tableCounter++}`;
  return {
    id, label: `Table ${id}`, x, y, shape: "rect", width: 110, height: 70,
    seats: Array.from({ length: 6 }, (_, i) => ({
      id: `${id}-S${i + 1}`, num: i + 1, label: `S${i + 1}`, status: "available"
    }))
  };
}

function makeStandaloneSeat(x = 100, y = 100) {
  const n = _standaloneCounter++;
  return { id: `SS${n}`, num: n, label: `S${n}`, status: "available", x, y };
}

const DEFAULT_LABELS = [
  { id: "screen", type: "screen", label: "SCREEN", x: 200, y: 16 },
  { id: "entrance", type: "entrance", label: "ENTRANCE", x: 16, y: 16 },
  { id: "exit", type: "exit", label: "EXIT", x: 16, y: 630 },
];

// ─── FIX: Canonical wing resolver — single source of truth ───────────────────
function getActualWingForRoom(room, venueStructure) {
  if (venueStructure) {
    for (const wing of venueStructure) {
      if (wing.rooms.includes(room)) return wing.label;
    }
  }
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
  return roomToWingMap[room] || "Main Wing";
}

// ─── FIX: layoutKey always derived from room name, never from caller's wing ──
function layoutKey(wing, room) {
  const actualWing = getActualWingForRoom(room);
  return `seatmap_layout:${actualWing}:${room}`;
}

function saveLayout(wing, room, { tables, labels, standaloneSeats }) {
  if (!wing || !room) return;
  const payload = JSON.stringify({ v: 2, tables, labels, standaloneSeats });
  try {
    localStorage.setItem(layoutKey(wing, room), payload);
    window.dispatchEvent(new CustomEvent("seatmap:saved", { detail: { wing, room, payload } }));
  } catch (err) {
    console.warn("SeatMap: could not save to localStorage", err);
  }
}

function loadLayout(wing, room) {
  try {
    const raw = localStorage.getItem(layoutKey(wing, room));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === 2) return parsed;
    if (Array.isArray(parsed)) return { tables: parsed, labels: DEFAULT_LABELS, standaloneSeats: [] };
    return null;
  } catch { return null; }
}

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  @keyframes sm-spin    { to { transform: rotate(360deg); } }
  @keyframes sm-fadeIn  { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
  @keyframes sm-fadeUp  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes sm-shake   { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-4px)} 40%,80%{transform:translateX(4px)} }
  .sm-scroll::-webkit-scrollbar { width: 4px; }
  .sm-scroll::-webkit-scrollbar-track { background: transparent; }
  .sm-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.10); border-radius: 4px; }
`;

// ─── ScaledCanvas ─────────────────────────────────────────────────────────────
function ScaledCanvas({ virtualW, virtualH, children, onScale, remountKey, fitMode = "width" }) {
  const sizerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!sizerRef.current) return;
    const measure = () => {
      if (!sizerRef.current) return;
      const availW = sizerRef.current.offsetWidth;
      const availH = sizerRef.current.offsetHeight;
      if (!availW) return;
      let s;
      if (fitMode === "contain" && availH) {
        s = Math.min(availW / virtualW, availH / virtualH, 1);
      } else {
        s = Math.min(availW / virtualW, 1);
      }
      setScale(s);
      onScale?.(s);
    };
    measure();
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(sizerRef.current);
    window.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [virtualW, virtualH, remountKey, fitMode]);

  const renderedH = Math.round(virtualH * scale);
  return (
    <div ref={sizerRef} style={{ width: "100%", position: "relative" }}>
      <div style={{ width: "100%", height: renderedH, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: 0, left: 0,
          width: virtualW, height: virtualH,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          overflow: "visible",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function StaticLabel({ item, T }) {
  const isScreen = item.type === "screen";
  return (
    <div style={{
      position: "absolute", left: (item.x || 0), top: (item.y || 0),
      background: isScreen ? T.labelScreen.bg : "transparent",
      color: isScreen ? T.labelScreen.color : T.labelOther.color,
      border: isScreen ? "none" : `1px solid ${T.labelOther.border}`,
      borderRadius: isScreen ? 6 : 18,
      padding: isScreen ? "6px 16px" : "5px 12px",
      fontFamily: F, fontWeight: 700, fontSize: isScreen ? 14 : 12,
      letterSpacing: "0.18em", textTransform: "uppercase",
      userSelect: "none", zIndex: 5, whiteSpace: "nowrap", pointerEvents: "none",
    }}>{item.label}</div>
  );
}

function DraggableLabel({ item, onDragStart, isDragging }) {
  const [hov, setHov] = useState(false);
  const isScreen = item.type === "screen";
  return (
    <div
      title={`Drag ${item.label}`}
      style={{
        position: "absolute", left: (item.x || 0), top: (item.y || 0),
        background: isScreen ? C.gold : "transparent",
        color: isScreen ? "#fff" : C.textSecondary,
        border: isScreen ? "none" : `1px solid ${hov || isDragging ? C.borderAccent : C.borderDefault}`,
        borderRadius: isScreen ? 6 : 18, padding: isScreen ? "6px 16px" : "5px 12px",
        fontFamily: F, fontWeight: 700, fontSize: isScreen ? 14 : 12,
        letterSpacing: "0.18em", textTransform: "uppercase",
        cursor: isDragging ? "grabbing" : "grab", userSelect: "none", zIndex: 5,
        whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
        transform: isDragging ? "scale(1.04)" : hov ? "scale(1.02)" : "scale(1)",
        transition: "transform 0.13s, border-color 0.13s", opacity: isDragging ? 0.80 : 1,
      }}
      onMouseDown={e => { e.stopPropagation(); onDragStart(e, item.id); }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
      {[0,1,2].map(i => (
        <span key={i} style={{ display: "flex", gap: 3 }}>
          <span style={{ width:4, height:4, borderRadius:"50%", background: isScreen ? "#fff" : C.gold, display:"block", flexShrink: 0, opacity: 1 }} />
          <span style={{ width:4, height:4, borderRadius:"50%", background: isScreen ? "#fff" : C.gold, display:"block", flexShrink: 0, opacity: 1 }} />
        </span>
      ))}
    </span>
      {item.label}
    </div>
  );
}

function StandaloneSeat({ seat, editMode, isSelected, isDragging, onDragStart, onSelect, onSeatClick, onDeleteClick, isMultiSelected, T }) {
  const [hov, setHov] = useState(false);
  const blocked = !editMode && seat.status !== "available";
  const color = blocked ? STATUS_COLORS.unavailable : (STATUS_COLORS[seat.status] || STATUS_COLORS.available);
  const SIZE = 38;
  const tokens = T || { gold: C.gold, cardShadow: C.cardShadow };
  return (
    <div
      style={{ position: "absolute", left: (seat.x || 0), top: (seat.y || 0), width: SIZE, height: SIZE, zIndex: isSelected ? 15 : 6 }}
      onMouseEnter={() => !blocked && setHov(true)} onMouseLeave={() => setHov(false)}
      onMouseDown={editMode ? e => { e.stopPropagation(); onDragStart(e, seat.id); } : undefined}
      onClick={e => {
        e.stopPropagation();
        if (editMode) {
          if (onDeleteClick) { onDeleteClick(seat); } else { onSelect(seat); }
          return;
        }
        if (blocked) {
          alert("This seat is unavailable for the selected schedule.");
          return;
        }
        onSeatClick?.(seat, null);
      }}
      title={blocked ? "Unavailable for selected schedule" : `Seat ${seat.num}`}
    >
      <div style={{
        width: SIZE, height: SIZE, borderRadius: "50%",
        background: (isSelected || isMultiSelected) ? "transparent" : color,
        border: (isSelected || isMultiSelected) ? `2px solid ${tokens.gold}` : `1.5px solid rgba(0,0,0,0.08)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: editMode ? (isDragging ? "grabbing" : "grab") : blocked ? "not-allowed" : "pointer",
        boxShadow: (isSelected || isMultiSelected) ? `0 0 0 3px ${tokens.gold}28` : hov ? "0 2px 8px rgba(0,0,0,0.18)" : tokens.cardShadow,
        transform: (isSelected || isMultiSelected) ? "scale(1.12)" : hov ? "scale(1.06)" : "scale(1)",
        opacity: blocked ? 0.48 : 1, userSelect: "none", transition: "all 0.15s ease", position: "relative",
      }}>
        <span style={{ color: (isSelected || isMultiSelected) ? tokens.gold : "#fff", fontSize: 10, fontWeight: 700, fontFamily: F, lineHeight: 1, pointerEvents: "none" }}>
          {seat.num}
        </span>
        {(isSelected || isMultiSelected) && (
          <div style={{ position: "absolute", top: "-4px", right: "-4px", width: "12px", height: "12px", borderRadius: "50%", background: tokens.gold, border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: "bold", color: "#fff", zIndex: 20 }}>✓</div>
        )}
      </div>
    </div>
  );
}

function SeatNode({ seat, isSelected, editMode, isDragging, onSeatClick, onSeatDragStart, T }) {
  const [hov, setHov] = useState(false);
  const blocked = !editMode && seat.status !== "available";
  const color = blocked ? STATUS_COLORS.unavailable : (STATUS_COLORS[seat.status] || STATUS_COLORS.available);
  const SIZE = 38;
  const tokens = T || { gold: C.gold, cardShadow: C.cardShadow };
  return (
    <div
      onClick={e => {
        e.stopPropagation();
        if (isDragging) return;
        if (blocked) {
          alert("This seat is unavailable for the selected schedule.");
          return;
        }
        onSeatClick?.(seat);
      }}
      onMouseDown={editMode ? e => { e.stopPropagation(); onSeatDragStart?.(e, seat.id); } : undefined}
      onMouseEnter={() => !blocked && !editMode && setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: SIZE, height: SIZE, borderRadius: "50%",
        background: isSelected ? "transparent" : color,
        border: isSelected ? `2px solid ${tokens.gold}` : `1.5px solid rgba(0,0,0,0.08)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: editMode ? "grab" : blocked ? "not-allowed" : "pointer",
        boxShadow: isSelected ? `0 0 0 3px ${tokens.gold}28` : hov ? "0 2px 8px rgba(0,0,0,0.18)" : tokens.cardShadow,
        transform: isSelected ? "scale(1.12)" : hov ? "scale(1.06)" : "scale(1)",
        opacity: blocked ? 0.48 : 1, flexShrink: 0, userSelect: "none", transition: "all 0.15s ease",
      }}
    >
      <span style={{ color: isSelected ? tokens.gold : "#fff", fontSize: 11, fontWeight: 700, fontFamily: F, lineHeight: 1, pointerEvents: "none" }}>
        {seat.num}
      </span>
    </div>
  );
}

function TableNode({ table, editMode, isTableSelected, selectedSeatId, onSelectTable, onDragStart, onResizeStart, onSeatClick, onLabelEdit, isDragging, onSeatMove, T, wing, room, mode }) {
  const [hov, setHov] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelVal, setLabelVal] = useState(table.label || table.id);
  const [draggingSeatId, setDraggingSeatId] = useState(null);
  const [dropSide, setDropSide] = useState(null);
  const [ghostXY, setGhostXY] = useState(null);
  const tableBodyRef = useRef(null);
  const seatDragRef = useRef(null);
  const tokens = T || {
    gold: C.gold, cardShadow: C.cardShadow, tableBg: C.tableBg, tableSelected: C.tableSelected,
    borderDefault: C.borderDefault, borderAccent: C.borderAccent,
    textPrimary: C.textPrimary, textTertiary: C.textTertiary, divider: C.divider,
  };
  const tableBlocked = !editMode && mode === "whole" && (table.seats || []).some(seat => seat.status !== "available");
  useEffect(() => setLabelVal(table.label || table.id), [table.label, table.id]);
  const SEAT_D = 38, SEAT_GAP = 6, SEAT_OFF = 8;
  const tableW = Math.max(table.width || 110, 80);
  const tableH = Math.max(table.height || 70, 50);
  const maxH = Math.max(1, Math.floor((tableW + SEAT_GAP) / (SEAT_D + SEAT_GAP)));
  const maxV = Math.max(1, Math.floor((tableH + SEAT_GAP) / (SEAT_D + SEAT_GAP)));
  const byPos = { top: [], bottom: [], left: [], right: [] };
  const free = [];
  (table.seats || []).forEach(s => s.position ? byPos[s.position].push(s) : free.push(s));
  free.forEach(s => {
    if (byPos.top.length < maxH) byPos.top.push(s);
    else if (byPos.bottom.length < maxH) byPos.bottom.push(s);
    else if (byPos.left.length < maxV) byPos.left.push(s);
    else byPos.right.push(s);
  });
  const topPad = byPos.top.length ? SEAT_D + SEAT_OFF : 0;
  const botPad = byPos.bottom.length ? SEAT_D + SEAT_OFF : 0;
  const leftPad = byPos.left.length ? SEAT_D + SEAT_OFF : 0;
  const rightPad = byPos.right.length ? SEAT_D + SEAT_OFF : 0;
  const contW = leftPad + tableW + rightPad;
  const contH = topPad + tableH + botPad;
  const tOffX = leftPad, tOffY = topPad;
  const startSeatDrag = useCallback((e, seatId) => {
    e.preventDefault(); e.stopPropagation();
    seatDragRef.current = { seatId };
    setDraggingSeatId(seatId); setGhostXY({ x: e.clientX, y: e.clientY });
  }, []);
  useEffect(() => {
    if (!draggingSeatId) return;
    const onMove = e => {
      setGhostXY({ x: e.clientX, y: e.clientY });
      if (!tableBodyRef.current) return;
      const r = tableBodyRef.current.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      const d = { top: cy, bottom: r.height - cy, left: cx, right: r.width - cx };
      setDropSide(Object.entries(d).sort((a, b) => a[1] - b[1])[0][0]);
    };
    const onUp = () => {
      if (seatDragRef.current?.seatId && dropSide) onSeatMove?.(table.id, seatDragRef.current.seatId, dropSide);
      seatDragRef.current = null;
      setDraggingSeatId(null); setDropSide(null); setGhostXY(null);
    };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [draggingSeatId, dropSide, onSeatMove, table.id]);
  const renderSide = (seats, side) => {
    if (!seats.length) return null;
    const horiz = side === "top" || side === "bottom";
    const rowPx = seats.length * (SEAT_D + SEAT_GAP) - SEAT_GAP;
    const pos = {
      top: { top: 0, left: tOffX + tableW / 2 - rowPx / 2 },
      bottom: { top: tOffY + tableH + SEAT_OFF, left: tOffX + tableW / 2 - rowPx / 2 },
      left: { left: 0, top: tOffY + tableH / 2 - rowPx / 2 },
      right: { left: tOffX + tableW + SEAT_OFF, top: tOffY + tableH / 2 - rowPx / 2 },
    }[side];
    return (
      <div key={side} style={{ position: "absolute", display: "flex", flexDirection: horiz ? "row" : "column", gap: SEAT_GAP, ...pos }}>
        {seats.map((seat, index) => (
          <SeatNode
            key={`${wing}-${room}-${table.id}-${seat.id ?? seat.num ?? index}`}
            seat={seat} editMode={editMode} isSelected={seat.id === selectedSeatId}
            isDragging={draggingSeatId === seat.id} onSeatDragStart={startSeatDrag}
            onSeatClick={s => { if (!draggingSeatId) onSeatClick(s, table.id); }} T={tokens}
          />
        ))}
      </div>
    );
  };
  return (
    <>
      {editMode && draggingSeatId && ghostXY && (() => {
        const seat = (table.seats || []).find(s => s.id === draggingSeatId);
        if (!seat) return null;
        return (
          <div style={{ position: "fixed", left: ghostXY.x - 19, top: ghostXY.y - 19, width: 38, height: 38, borderRadius: "50%", background: STATUS_COLORS[seat.status] || STATUS_COLORS.available, border: `2px solid ${tokens.gold}`, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 9999, boxShadow: `0 6px 20px rgba(0,0,0,0.15)`, transform: "scale(1.15)", opacity: 0.92 }}>
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: F }}>{seat.num}</span>
          </div>
        );
      })()}
      <div
        style={{ position: "absolute", left: (table.x || 0), top: (table.y || 0), width: contW, height: contH, overflow: "visible", zIndex: isTableSelected ? 10 : 4 }}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        onClick={e => e.stopPropagation()}
      >
        {["top", "bottom", "left", "right"].map(side => renderSide(byPos[side], side))}
        <div
          ref={tableBodyRef}
          style={{
            position: "absolute", left: tOffX, top: tOffY, width: tableW, height: tableH,
            background: isTableSelected ? tokens.tableSelected : tokens.tableBg, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
            border: isTableSelected ? `1.5px solid ${tokens.gold}` : hov ? `1.5px solid ${tokens.borderAccent}` : `1px solid ${tokens.borderDefault}`,
            boxShadow: isTableSelected ? `0 0 0 3px ${tokens.gold}10, 0 4px 16px rgba(0,0,0,0.12)` : hov ? "0 4px 12px rgba(0,0,0,0.12)" : tokens.cardShadow,
            transition: "border 0.15s, box-shadow 0.15s, background 0.18s",
            cursor: editMode ? (isDragging ? "grabbing" : "grab") : tableBlocked ? "not-allowed" : "pointer", zIndex: 2, overflow: "visible",
            opacity: tableBlocked ? 0.72 : 1,
          }}
          onMouseDown={editMode ? e => { if (!draggingSeatId) { e.stopPropagation(); onDragStart(e, table.id); } } : undefined}
          onClick={e => {
            e.stopPropagation();
            if (tableBlocked) {
              alert("This table is unavailable for the selected schedule.");
              return;
            }
            onSelectTable(table);
          }}
          onDoubleClick={editMode ? e => { e.stopPropagation(); setEditingLabel(true); } : undefined}
        >
          {editingLabel
            ? <input autoFocus value={labelVal} onChange={e => setLabelVal(e.target.value)}
                onBlur={() => { setEditingLabel(false); onLabelEdit?.(table.id, labelVal); }}
                onKeyDown={e => { if (e.key === "Enter") { setEditingLabel(false); onLabelEdit?.(table.id, labelVal); } e.stopPropagation(); }}
                onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
                style={{ background: "transparent", border: "none", outline: "none", color: tokens.textPrimary, fontFamily: F, fontWeight: 700, fontSize: 10, letterSpacing: "0.10em", textAlign: "center", width: "85%", textTransform: "uppercase" }}
              />
            : <>
                <div style={{ color: tokens.textPrimary, fontFamily: F, fontWeight: 700, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", lineHeight: 1.3, textAlign: "center", padding: "0 8px" }}>
                  {table.label || table.id}
                </div>
                {(table.seats?.length || 0) > 0 && (
                  <div style={{ color: tokens.textTertiary, fontFamily: F, fontSize: 9, marginTop: 2 }}>
                    {table.seats.length} seats
                  </div>
                )}
              </>
          }
        </div>
      </div>
    </>
  );
}

function ToolBtn({ active, onClick, label, accentColor }) {
  const [hov, setHov] = useState(false);
  const acc = accentColor || C.gold;
  return (
    <button
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", border: `1px solid ${active ? acc : hov ? C.borderAccent : C.borderDefault}`, background: active ? `${acc}12` : hov ? `${acc}06` : "transparent", color: active ? acc : hov ? C.textPrimary : C.textSecondary, borderRadius: 6, fontFamily: F, fontWeight: 700, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.14s", whiteSpace: "nowrap" }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >{label}</button>
  );
}

function DeleteConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: C.surfaceBase, borderRadius: 12, width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.20)", border: `1px solid ${C.borderDefault}`, overflow: "hidden", animation: "sm-fadeIn 0.18s ease" }}>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${C.red}80 40%, ${C.red}80 60%, transparent)` }} />
        <div style={{ padding: "20px 20px 18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: C.redFaint, border: `1px solid ${C.redBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: F, fontWeight: 700, fontSize: 14, color: C.textPrimary, marginBottom: 5 }}>Confirm Delete</div>
              <div style={{ fontFamily: F, fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}>{message}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onCancel} style={{ flex: 1, padding: "9px", background: "transparent", border: `1px solid ${C.borderDefault}`, borderRadius: 7, fontFamily: F, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.textSecondary, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.color = C.textPrimary; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.color = C.textSecondary; }}>Cancel</button>
            <button onClick={onConfirm} style={{ flex: 1, padding: "9px", background: C.red, border: "none", borderRadius: 7, fontFamily: F, fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fff", cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#C04040"; }}
              onMouseLeave={e => { e.currentTarget.style.background = C.red; }}>Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── VENUE MANAGER MODAL ──────────────────────────────────────────────────────
function VenueManagerModal({ venueStructure, onSave, onClose }) {
  const [structure, setStructure] = useState(() => JSON.parse(JSON.stringify(venueStructure)));
  const [newWingName, setNewWingName] = useState("");
  const [newRoomNames, setNewRoomNames] = useState({});
  const [editingWingId, setEditingWingId] = useState(null);
  const [editingWingVal, setEditingWingVal] = useState("");
  const [editingRoomKey, setEditingRoomKey] = useState(null);
  const [editingRoomVal, setEditingRoomVal] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const addWing = () => {
    const name = newWingName.trim();
    if (!name) return;
    const id = `wing-${Date.now()}`;
    setStructure(s => [...s, { id, label: name, rooms: [] }]);
    setNewWingName("");
  };

  const deleteWing = (wingId) => {
    setStructure(s => s.filter(w => w.id !== wingId));
    setConfirmDelete(null);
  };

  const addRoom = (wingId) => {
    const name = (newRoomNames[wingId] || "").trim();
    if (!name) return;
    setStructure(s => s.map(w => w.id !== wingId ? w : { ...w, rooms: [...w.rooms, name] }));
    setNewRoomNames(r => ({ ...r, [wingId]: "" }));
  };

  const deleteRoom = (wingId, roomIndex) => {
    setStructure(s => s.map(w => w.id !== wingId ? w : { ...w, rooms: w.rooms.filter((_, i) => i !== roomIndex) }));
    setConfirmDelete(null);
  };

  const saveWingEdit = (wingId) => {
    const val = editingWingVal.trim();
    if (val) setStructure(s => s.map(w => w.id !== wingId ? w : { ...w, label: val }));
    setEditingWingId(null);
  };

  const saveRoomEdit = (wingId, roomIndex) => {
    const val = editingRoomVal.trim();
    if (val) setStructure(s => s.map(w => w.id !== wingId ? w : { ...w, rooms: w.rooms.map((r, i) => i !== roomIndex ? r : val) }));
    setEditingRoomKey(null);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.60)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.surfaceBase, borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", border: `1px solid ${C.borderDefault}`, overflow: "hidden", animation: "sm-fadeIn 0.20s ease" }}>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${C.gold}80 40%, ${C.gold}80 60%, transparent)` }} />
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: F, fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", color: C.gold, textTransform: "uppercase", marginBottom: 3 }}>Venue Configuration</div>
            <div style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Manage Wings &amp; Rooms</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "transparent", border: `1px solid ${C.borderDefault}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="sm-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <div style={{ marginBottom: 20, padding: "12px 14px", background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, borderRadius: 10 }}>
            <div style={{ fontFamily: F, fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>Add New Wing</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newWingName}
                onChange={e => setNewWingName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addWing()}
                placeholder="Wing name (e.g. South Wing)"
                style={{ flex: 1, padding: "8px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 7, fontFamily: F, fontSize: 12, color: C.textPrimary, background: C.surfaceInput, outline: "none" }}
                onFocus={e => { e.target.style.borderColor = C.borderAccent; }}
                onBlur={e => { e.target.style.borderColor = C.borderDefault; }}
              />
              <button onClick={addWing} disabled={!newWingName.trim()}
                style={{ padding: "8px 16px", background: newWingName.trim() ? C.gold : C.borderDefault, border: "none", borderRadius: 7, fontFamily: F, fontWeight: 700, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: newWingName.trim() ? "#fff" : C.textTertiary, cursor: newWingName.trim() ? "pointer" : "not-allowed", transition: "all 0.15s" }}>
                + Wing
              </button>
            </div>
          </div>

          {structure.map((wing) => (
            <div key={wing.id} style={{ marginBottom: 16, border: `1px solid ${C.borderDefault}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: C.surfaceRaised, borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                {editingWingId === wing.id
                  ? <input autoFocus value={editingWingVal} onChange={e => setEditingWingVal(e.target.value)}
                      onBlur={() => saveWingEdit(wing.id)} onKeyDown={e => { if (e.key === "Enter") saveWingEdit(wing.id); if (e.key === "Escape") setEditingWingId(null); }}
                      style={{ flex: 1, padding: "3px 7px", border: `1px solid ${C.borderAccent}`, borderRadius: 5, fontFamily: F, fontWeight: 700, fontSize: 11, color: C.textPrimary, background: C.surfaceInput, outline: "none" }}
                    />
                  : <span style={{ flex: 1, fontFamily: F, fontWeight: 700, fontSize: 11, color: C.textPrimary, letterSpacing: "0.08em", textTransform: "uppercase" }}>{wing.label}</span>
                }
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => { setEditingWingId(wing.id); setEditingWingVal(wing.label); }}
                    style={{ padding: "3px 8px", background: "transparent", border: `1px solid ${C.borderDefault}`, borderRadius: 5, fontFamily: F, fontSize: 9, fontWeight: 600, color: C.textSecondary, cursor: "pointer", transition: "all 0.13s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.color = C.gold; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.color = C.textSecondary; }}>
                    Rename
                  </button>
                  <button onClick={() => setConfirmDelete({ type: "wing", wingId: wing.id, label: wing.label, roomCount: wing.rooms.length })}
                    style={{ padding: "3px 8px", background: "transparent", border: `1px solid ${C.redBorder}`, borderRadius: 5, fontFamily: F, fontSize: 9, fontWeight: 600, color: C.red, cursor: "pointer", transition: "background 0.13s" }}
                    onMouseEnter={e => e.currentTarget.style.background = C.redFaint}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    Delete
                  </button>
                </div>
              </div>

              <div style={{ padding: "8px 14px" }}>
                {wing.rooms.length === 0 && (
                  <div style={{ fontFamily: F, fontSize: 11, color: C.textTertiary, padding: "6px 0", fontStyle: "italic" }}>No rooms yet</div>
                )}
                {wing.rooms.map((room, rIdx) => {
                  const rKey = `${wing.id}:${rIdx}`;
                  return (
                    <div key={rKey} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: rIdx < wing.rooms.length - 1 ? `1px solid ${C.divider}` : "none" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold, opacity: 0.5, flexShrink: 0 }} />
                      {editingRoomKey === rKey
                        ? <input autoFocus value={editingRoomVal} onChange={e => setEditingRoomVal(e.target.value)}
                            onBlur={() => saveRoomEdit(wing.id, rIdx)} onKeyDown={e => { if (e.key === "Enter") saveRoomEdit(wing.id, rIdx); if (e.key === "Escape") setEditingRoomKey(null); }}
                            style={{ flex: 1, padding: "3px 7px", border: `1px solid ${C.borderAccent}`, borderRadius: 5, fontFamily: F, fontSize: 12, color: C.textPrimary, background: C.surfaceInput, outline: "none" }}
                          />
                        : <span style={{ flex: 1, fontFamily: F, fontSize: 12, color: C.textSecondary }}>{room}</span>
                      }
                      <button onClick={() => { setEditingRoomKey(rKey); setEditingRoomVal(room); }}
                        style={{ padding: "2px 7px", background: "transparent", border: `1px solid ${C.borderDefault}`, borderRadius: 4, fontFamily: F, fontSize: 9, fontWeight: 600, color: C.textTertiary, cursor: "pointer", flexShrink: 0, transition: "all 0.13s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.color = C.gold; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.color = C.textTertiary; }}>
                        ✎
                      </button>
                      <button onClick={() => setConfirmDelete({ type: "room", wingId: wing.id, roomIndex: rIdx, label: room })}
                        style={{ padding: "2px 7px", background: "transparent", border: `1px solid ${C.redBorder}`, borderRadius: 4, fontFamily: F, fontSize: 9, fontWeight: 600, color: C.red, cursor: "pointer", flexShrink: 0, transition: "background 0.13s" }}
                        onMouseEnter={e => e.currentTarget.style.background = C.redFaint}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        ✕
                      </button>
                    </div>
                  );
                })}

                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input
                    value={newRoomNames[wing.id] || ""}
                    onChange={e => setNewRoomNames(r => ({ ...r, [wing.id]: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && addRoom(wing.id)}
                    placeholder="New room name…"
                    style={{ flex: 1, padding: "6px 9px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 11, color: C.textPrimary, background: C.surfaceInput, outline: "none" }}
                    onFocus={e => e.target.style.borderColor = C.borderAccent}
                    onBlur={e => e.target.style.borderColor = C.borderDefault}
                  />
                  <button onClick={() => addRoom(wing.id)} disabled={!(newRoomNames[wing.id] || "").trim()}
                    style={{ padding: "6px 12px", background: (newRoomNames[wing.id] || "").trim() ? C.goldFaint : "transparent", border: `1px solid ${(newRoomNames[wing.id] || "").trim() ? C.borderAccent : C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 10, fontWeight: 700, color: (newRoomNames[wing.id] || "").trim() ? C.gold : C.textTertiary, cursor: (newRoomNames[wing.id] || "").trim() ? "pointer" : "not-allowed", transition: "all 0.13s", whiteSpace: "nowrap" }}>
                    + Room
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${C.divider}`, display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", background: "transparent", border: `1px solid ${C.borderDefault}`, borderRadius: 8, fontFamily: F, fontWeight: 600, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.textSecondary, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => { onSave(structure); onClose(); }}
            style={{ flex: 2, padding: "10px", background: C.gold, border: "none", borderRadius: 8, fontFamily: F, fontWeight: 700, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#fff", cursor: "pointer", transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = C.goldLight}
            onMouseLeave={e => e.currentTarget.style.background = C.gold}>
            Save Venue Structure
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10001, background: "rgba(0,0,0,0.40)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: C.surfaceBase, borderRadius: 12, maxWidth: 340, width: "100%", padding: "20px", boxShadow: "0 16px 40px rgba(0,0,0,0.20)", border: `1px solid ${C.borderDefault}` }}>
            <div style={{ fontFamily: F, fontWeight: 700, fontSize: 14, color: C.textPrimary, marginBottom: 8 }}>Confirm Delete</div>
            <div style={{ fontFamily: F, fontSize: 12, color: C.textSecondary, lineHeight: 1.6, marginBottom: 16 }}>
              {confirmDelete.type === "wing"
                ? `Delete wing "${confirmDelete.label}"? This will remove ${confirmDelete.roomCount} room(s) from the sidebar. Existing seat layouts are preserved in storage.`
                : `Remove room "${confirmDelete.label}" from this wing? The seat layout for this room is preserved in storage.`
              }
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "8px", background: "transparent", border: `1px solid ${C.borderDefault}`, borderRadius: 7, fontFamily: F, fontSize: 10, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: C.textSecondary, cursor: "pointer" }}>Cancel</button>
              <button onClick={() => {
                if (confirmDelete.type === "wing") deleteWing(confirmDelete.wingId);
                else deleteRoom(confirmDelete.wingId, confirmDelete.roomIndex);
              }} style={{ flex: 1, padding: "8px", background: C.red, border: "none", borderRadius: 7, fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "#fff", cursor: "pointer" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Wing/Room Sidebar ────────────────────────────────────────────────────────
function WingRoomSidebar({ activeWing, activeRoom, onSelect, venueStructure, onOpenVenueManager }) {
  const [expanded, setExpanded] = useState(() => Object.fromEntries(venueStructure.map(w => [w.id, true])));
  const toggle = id => setExpanded(e => ({ ...e, [id]: !e[id] }));

  useEffect(() => {
    setExpanded(prev => {
      const next = { ...prev };
      venueStructure.forEach(w => { if (!(w.id in next)) next[w.id] = true; });
      return next;
    });
  }, [venueStructure]);

  const rowStyle = (active) => ({
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "6px 13px 6px 28px", cursor: "pointer",
    background: active ? C.goldFaint : "transparent",
    borderRight: `2px solid ${active ? C.gold : "transparent"}`,
    transition: "all 0.14s",
  });

  return (
    <div className="sm-scroll" style={{ width: 220, flexShrink: 0, alignSelf: "stretch", background: C.sidebarBg, borderRight: `1px solid ${C.sidebarBorder}`, display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden" }}>
      <div style={{ padding: "14px 15px 10px", borderBottom: `1px solid ${C.divider}`, flexShrink: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", color: C.gold, textTransform: "uppercase", fontFamily: F, marginBottom: 1 }}>Venue</div>
        <div style={{ fontSize: 11, color: C.textSecondary, fontFamily: F }}>Wings &amp; Rooms</div>
      </div>

      <div style={{ flex: 1, paddingBottom: 8 }}>
        {venueStructure.map((wing) => (
          <div key={wing.id}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px 7px 11px", cursor: "pointer", userSelect: "none", transition: "background 0.14s" }}
              onClick={() => toggle(wing.id)}
              onMouseEnter={e => e.currentTarget.style.background = C.goldFaintest}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded[wing.id] ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.18s", flexShrink: 0 }}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", color: C.textPrimary, textTransform: "uppercase", fontFamily: F }}>{wing.label}</span>
              </div>
              <span style={{ fontSize: 9, color: C.textTertiary, fontFamily: F }}>{wing.rooms.length}</span>
            </div>
            {expanded[wing.id] && (
              <div>
                {wing.rooms.map((room, roomIndex) => {
                  const active = activeWing === wing.label && activeRoom === room;
                  return (
                    <div key={`${wing.id}-${roomIndex}-${room}`} onClick={() => onSelect(wing.label, room)} style={rowStyle(active)}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.goldFaintest; }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? C.goldFaint : "transparent"; }}>
                      <span style={{ fontSize: 11, color: active ? C.gold : C.textSecondary, fontFamily: F, fontWeight: active ? 600 : 400, lineHeight: 1.4, flex: 1, transition: "color 0.14s" }}>{room}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {onOpenVenueManager && (
        <div style={{ padding: "10px 12px 14px", borderTop: `1px solid ${C.divider}`, flexShrink: 0 }}>
          <button onClick={onOpenVenueManager}
            style={{ width: "100%", padding: "8px 0", background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, borderRadius: 7, fontFamily: F, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
            onMouseEnter={e => { e.currentTarget.style.background = C.goldFaint; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.goldFaintest; }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            Manage Venue
          </button>
        </div>
      )}
    </div>
  );
}

// ─── INSPECTOR PANEL ──────────────────────────────────────────────────────────
function InspectorPanel({ selected, selectedTable, selectedSeatObj, selectedStandaloneSeatObj, tables, setTables, addSeat, deleteSeat, deleteTable, deleteStandaloneSeat, updateTable, handleSeatLabelEdit, handleSeatStatus, onRequestDelete, handleStandaloneSeatStatus }) {
  const iLabel = t => (
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", color: C.gold, textTransform: "uppercase", marginBottom: 5, marginTop: 13 }}>{t}</div>
  );
  const iInput = props => (
    <input
      style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 12, color: C.textPrimary, background: C.surfaceInput, boxSizing: "border-box", outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" }}
      onFocus={e => { e.target.style.borderColor = C.borderAccent; e.target.style.boxShadow = C.inputFocus; }}
      onBlur={e => { e.target.style.borderColor = C.borderDefault; e.target.style.boxShadow = "none"; }}
      {...props}
    />
  );

  const StatusRow = ({ current, onSet }) => (
    <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
      {SEAT_STATUS_CYCLE.map((s, index) => (
        <button key={`${s}-${index}`} onClick={() => onSet(s)} style={{ flex: 1, padding: "6px 0", background: current === s ? STATUS_COLORS[s] : "transparent", border: `1px solid ${STATUS_COLORS[s]}80`, borderRadius: 5, fontFamily: F, fontWeight: 600, fontSize: 9, color: current === s ? "#fff" : STATUS_COLORS[s], cursor: "pointer", transition: "all 0.14s" }}>
          {s === "available" ? "Avail." : s === "pending" ? "Pending" : "Reserved"}
        </button>
      ))}
    </div>
  );

  const DeleteBtn = ({ label, deleteKey }) => (
    <button
      onClick={() => onRequestDelete(deleteKey)}
      style={{ width: "100%", marginTop: 10, padding: "8px 0", background: "transparent", color: C.red, border: `1px solid ${C.redBorder}`, borderRadius: 6, fontFamily: F, fontWeight: 600, fontSize: 10, cursor: "pointer", transition: "background 0.14s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      onMouseEnter={e => e.currentTarget.style.background = C.redFaint}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </svg>
      {label}
    </button>
  );

  // ── Reusable "Add Seat" button wired to a specific tableId ──────────────────
  const AddSeatBtn = ({ tableId }) => (
    <button
      onClick={() => addSeat(tableId)}
      style={{ flex: 1, padding: "6px 0", background: "transparent", color: C.green, border: `1px solid ${C.greenBorder}`, borderRadius: 5, fontFamily: F, fontWeight: 600, fontSize: 10, cursor: "pointer", transition: "background 0.14s", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
      onMouseEnter={e => e.currentTarget.style.background = C.greenFaint}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      Add Seat
    </button>
  );

  // ── Reusable "Remove Last" button ────────────────────────────────────────────
  const RemoveLastBtn = () => (
    <button
      onClick={deleteSeat}
      style={{ flex: 1, padding: "6px 0", background: "transparent", color: C.red, border: `1px solid ${C.redBorder}`, borderRadius: 5, fontFamily: F, fontWeight: 600, fontSize: 10, cursor: "pointer", transition: "background 0.14s" }}
      onMouseEnter={e => e.currentTarget.style.background = C.redFaint}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      − Remove Last
    </button>
  );

  return (
    <div style={{ fontFamily: F }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.20em", color: C.gold, textTransform: "uppercase", marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.divider}` }}>
        Inspector
      </div>

      {/* ── Nothing selected ── */}
      {!selected && (
        <div style={{ color: C.textTertiary, fontSize: 11, lineHeight: 1.65 }}>
          Select a table or seat to edit its properties.
        </div>
      )}

      {/* ── Table selected ── */}
      {selected?.type === "table" && (
        <>
          {selectedTable && (
            <>
              {iLabel("Table Label")}
              {iInput({ value: selectedTable.label || selectedTable.id, onChange: e => updateTable("label", e.target.value) })}

              {iLabel(`Seats · ${selectedTable.seats?.length || 0}`)}
              <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                <AddSeatBtn tableId={selectedTable.id} />
                <RemoveLastBtn />
              </div>

              <div style={{ marginTop: 8, padding: "7px 10px", background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, borderRadius: 5, fontSize: 10, color: C.textSecondary }}>
                Drag table to move · double-click to rename
              </div>
            </>
          )}
          <DeleteBtn label="Delete Table" deleteKey="table" />
        </>
      )}

      {/* ── Individual seat selected ── */}
      {selected?.type === "seat" && selectedSeatObj && (
        <>
          {iLabel("Seat Label")}
          {iInput({
            value: selectedSeatObj.label || selectedSeatObj.num,
            onChange: e => handleSeatLabelEdit(e.target.value),
          })}

          {iLabel("Seat Number")}
          {iInput({
            type: "number",
            value: selectedSeatObj.num,
            onChange: e => setTables(p => p.map(t =>
              t.id !== selected.tableId ? t : {
                ...t,
                seats: (t.seats || []).map(s =>
                  s.id === selected.seatId ? { ...s, num: Number(e.target.value) } : s
                ),
              }
            )),
          })}

          {iLabel("Status")}
          <StatusRow current={selectedSeatObj.status} onSet={handleSeatStatus} />

          <DeleteBtn label="Delete This Seat" deleteKey="seat" />

          {/* ── Parent table seat management ── */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.divider}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", color: C.textTertiary, textTransform: "uppercase" }}>
                Parent Table
              </div>
              {/* Live seat count badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, borderRadius: 10 }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.gold, fontFamily: F }}>
                  {tables.find(t => t.id === selected.tableId)?.seats?.length || 0} seats
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 5 }}>
              <AddSeatBtn tableId={selected.tableId} />
              <RemoveLastBtn />
            </div>

            <div style={{ marginTop: 8, padding: "6px 9px", background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, borderRadius: 5, fontSize: 10, color: C.textSecondary }}>
              Adds / removes seats on the parent table
            </div>
          </div>

          <div style={{ marginTop: 10, borderTop: `1px solid ${C.divider}` }} />
          <DeleteBtn label="Delete Entire Table" deleteKey="table" />
        </>
      )}

      {/* ── Standalone seat selected ── */}
      {selected?.type === "standaloneSeat" && (
        <>
          {iLabel("Standalone Seat")}
          {selectedStandaloneSeatObj && (
            <>
              {iLabel("Status")}
              <StatusRow
                current={selectedStandaloneSeatObj.status}
                onSet={status => handleStandaloneSeatStatus?.(selected.standaloneSeatId, status)}
              />
            </>
          )}
          <div style={{ marginTop: 8, padding: "7px 10px", background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, borderRadius: 5, fontSize: 10, color: C.textSecondary }}>
            Drag to reposition this seat on the canvas.
          </div>
          <DeleteBtn label="Delete Seat" deleteKey="standaloneSeat" />
        </>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function SeatMap({
  tableData, editMode = false, selectedSeat, highlightedTable,
  onSeatClick, onTableClick, windowWidth, virtualWidth, virtualHeight,
  wing, room, mode = "whole", isDark = false, onBack, sidebarWidth = 0,
}) {
  const normalize = useCallback(td => {
    if (!td) return [];
    if (Array.isArray(td)) return td.map(t => ({ shape: "rect", width: 110, height: 70, ...t }));
    return [{ shape: "rect", width: 110, height: 70, ...td }];
  }, []);

  const [tables, setTables]             = useState(() => editMode ? [] : normalize(tableData));
  const [labels, setLabels]             = useState(() => {
    if (!editMode && tableData && tableData.labels) return tableData.labels;
    return DEFAULT_LABELS;
  });
  const [standaloneSeats, setStandaloneSeats] = useState([]);
  const [selected, setSelected]         = useState(null);
  const [selectedStandaloneSeats, setSelectedStandaloneSeats] = useState(new Set());
  const [saved, setSaved]               = useState(false);
  const [tool, setTool]                 = useState("select");
  const [activeDragId, setActiveDragId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showVenueManager, setShowVenueManager] = useState(false);

  const [venueStructure, setVenueStructure] = useState(() => loadVenueStructure());
  const currentAdmin = useMemo(() => authAPI.getCurrentUser(), []);
  const visibleVenueStructure = useMemo(
    () => getScopedOutletGroups(currentAdmin, venueStructure),
    [currentAdmin, venueStructure]
  );
  const canManageVenues = authAPI.hasPermission("manage_venues");

  const [activeWing, setActiveWing] = useState(wing || "Main Wing");
  const [activeRoom, setActiveRoom] = useState(room || "Alabang Function Room");

  const loadedRef     = useRef(false);
  const dragging      = useRef(null);
  const canvasRef     = useRef(null);
  const adminScaleRef = useRef(1);
  const T = getClientTokens(isDark);

  useEffect(() => {
    const handler = e => {
      if (e.detail?.structure) setVenueStructure(e.detail.structure);
    };
    window.addEventListener("venue:structure:changed", handler);
    return () => window.removeEventListener("venue:structure:changed", handler);
  }, []);

  useEffect(() => {
    if (!editMode || !visibleVenueStructure.length) return;
    const activeAllowed = visibleVenueStructure.some((group) => group.label === activeWing && group.rooms.includes(activeRoom));
    if (activeAllowed) return;
    setActiveWing(visibleVenueStructure[0].label);
    setActiveRoom(visibleVenueStructure[0].rooms[0]);
  }, [activeRoom, activeWing, editMode, visibleVenueStructure]);

  // ── FIX: LOAD — reset counters before loading so new tables get clean IDs ───
  useEffect(() => {
    if (!editMode) return;
    loadedRef.current = false;

    // FIX: Always reset counters when switching rooms to prevent ID collisions
    _tableCounter = 1;
    _standaloneCounter = 1;

    const stored = loadLayout(activeWing, activeRoom);
    if (stored) {
      const norm = normalize(stored.tables).filter(t => t.seats?.length > 0);
      setTables(norm);
      // FIX: Derive counters from loaded data so new IDs don't collide
      norm.forEach(t => {
        const n = parseInt(t.id?.replace(/\D/g, "")) || 0;
        if (n >= _tableCounter) _tableCounter = n + 1;
      });
      setLabels(stored.labels?.length ? stored.labels : DEFAULT_LABELS);
      const ss = (stored.standaloneSeats || []).map(s => ({ ...s, status: s.status || "available" }));
      setStandaloneSeats(ss);
      ss.forEach(s => {
        const n = parseInt(s.id?.replace(/\D/g, "")) || 0;
        if (n >= _standaloneCounter) _standaloneCounter = n + 1;
      });
    } else {
      setTables([]); setLabels(DEFAULT_LABELS); setStandaloneSeats([]);
    }
    setSelected(null);
    const t = setTimeout(() => { loadedRef.current = true; }, 100);
    return () => clearTimeout(t);
  }, [editMode, activeWing, activeRoom, normalize]);

  // ── AUTO-SAVE ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editMode) return;
    if (!activeWing || !activeRoom) return;
    if (!loadedRef.current) return;
    const completeData = { tables, labels, standaloneSeats };
    saveLayout(activeWing, activeRoom, completeData);
    const actualWing = getActualWingForRoom(activeRoom);
    dispatchSeatMapUpdate(actualWing, activeRoom, completeData);
  }, [tables, labels, standaloneSeats, editMode, activeWing, activeRoom]);

  // ── Client: sync from prop ───────────────────────────────────────────────────
  useEffect(() => {
    if (editMode) return;
    if (!tableData) return;
    if (tableData.v === 2) {
      setTables(normalize(tableData.tables || []).filter(t => t.seats?.length > 0));
      setLabels(tableData.labels?.length ? tableData.labels : DEFAULT_LABELS);
      setStandaloneSeats(tableData.standaloneSeats || []);
    } else if (tableData.tables) {
      setTables(normalize(tableData.tables).filter(t => t.seats?.length > 0));
      setLabels(tableData.labels?.length ? tableData.labels : DEFAULT_LABELS);
      setStandaloneSeats(tableData.standaloneSeats || []);
    } else if (Array.isArray(tableData)) {
      setTables(normalize(tableData).filter(t => t.seats?.length > 0));
      setLabels(DEFAULT_LABELS); setStandaloneSeats([]);
    }
  }, [tableData, normalize, editMode]);

  const selectedTable             = selected?.type === "table"          ? tables.find(t => t.id === selected.tableId) : null;
  const selectedSeatObj           = selected?.type === "seat"           ? tables.find(t => t.id === selected.tableId)?.seats.find(s => s.id === selected.seatId) : null;
  const selectedStandaloneSeatObj = selected?.type === "standaloneSeat" ? standaloneSeats.find(s => s.id === selected.standaloneSeatId) : null;

  useEffect(() => {
    if (!editMode) return;
    const THRESHOLD = 4;
    const onMove = e => {
      const d = dragging.current; if (!d) return;
      const rawDx = e.clientX - d.startX, rawDy = e.clientY - d.startY;
      if (!d.active) {
        if (Math.abs(rawDx) < THRESHOLD && Math.abs(rawDy) < THRESHOLD) return;
        d.active = true; setActiveDragId(d.id);
      }
      const s = adminScaleRef.current || 1;
      const dx = rawDx / s, dy = rawDy / s;
      if      (d.type === "table")          setTables(p => p.map(t => t.id === d.id ? { ...t, x: Math.max(0, d.originX + dx), y: Math.max(0, d.originY + dy) } : t));
      else if (d.type === "label")          setLabels(p => p.map(l => l.id === d.id ? { ...l, x: Math.max(0, d.originX + dx), y: Math.max(0, d.originY + dy) } : l));
      else if (d.type === "standaloneSeat") setStandaloneSeats(p => p.map(ss => ss.id === d.id ? { ...ss, x: Math.max(0, d.originX + dx), y: Math.max(0, d.originY + dy) } : ss));
    };
    const onUp = () => { dragging.current = null; setActiveDragId(null); };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [editMode, labels]);

  useEffect(() => {
    const h = e => {
      if (e.key === "Escape") { setSelected(null); setTool("select"); }
      else if (e.key === "Delete" && editMode && selected) {
        if (selected.type === "table") {
          const tbl = tables.find(t => t.id === selected.tableId);
          setDeleteConfirm({ key: "table", message: `Delete "${tbl?.label || tbl?.id}"? This will also remove all ${tbl?.seats?.length || 0} seats and cannot be undone.` });
        } else if (selected.type === "seat") {
          const seatObj = tables.find(t => t.id === selected.tableId)?.seats.find(s => s.id === selected.seatId);
          setDeleteConfirm({ key: "seat", message: `Delete seat "${seatObj?.label || seatObj?.num}"? This cannot be undone.` });
        } else if (selected.type === "standaloneSeat") {
          setDeleteConfirm({ key: "standaloneSeat", message: "Delete this standalone seat? This cannot be undone." });
        }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [editMode, selected, tables]);

  const startTableDrag = useCallback((e, id) => {
    e.preventDefault(); const t = tables.find(t => t.id === id);
    dragging.current = { type: "table", id, startX: e.clientX, startY: e.clientY, originX: t?.x || 0, originY: t?.y || 0, active: false };
  }, [tables]);
  const startTableResize = useCallback((e) => { e.preventDefault(); }, []);
  const startLabelDrag = useCallback((e, id) => {
    e.preventDefault(); const l = labels.find(l => l.id === id);
    dragging.current = { type: "label", id, startX: e.clientX, startY: e.clientY, originX: l?.x || 0, originY: l?.y || 0, active: false };
  }, [labels]);
  const startStandaloneSeatDrag = useCallback((e, id) => {
    e.preventDefault(); const ss = standaloneSeats.find(s => s.id === id);
    dragging.current = { type: "standaloneSeat", id, startX: e.clientX, startY: e.clientY, originX: ss?.x || 0, originY: ss?.y || 0, active: false };
  }, [standaloneSeats]);

  const handleCanvasClick = e => {
    if (!editMode) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const s = adminScaleRef.current || 1;
    const cx = Math.max(0, (e.clientX - rect.left) / s), cy = Math.max(0, (e.clientY - rect.top) / s);
    if      (tool === "addTable") { const t = makeTable(cx - 55, cy - 27); setTables(p => [...p, t]); setSelected({ type: "table", tableId: t.id }); setTool("select"); }
    else if (tool === "addSeat")  { const ss = makeStandaloneSeat(cx - 19, cy - 19); setStandaloneSeats(p => [...p, ss]); setSelected({ type: "standaloneSeat", standaloneSeatId: ss.id }); setTool("select"); }
  };

  const handleRequestDelete = key => {
    if (key === "table") {
      const tbl = selectedTable || tables.find(t => t.id === selected?.tableId);
      setDeleteConfirm({ key, message: `Delete "${tbl?.label || tbl?.id || "this table"}"? This will also remove all ${tbl?.seats?.length || 0} seats and cannot be undone.` });
    } else if (key === "seat") {
      setDeleteConfirm({ key, message: `Delete seat "${selectedSeatObj?.label || selectedSeatObj?.num}"? This cannot be undone.` });
    } else if (key === "standaloneSeat") {
      setDeleteConfirm({ key, message: "Delete this standalone seat? This cannot be undone." });
    }
  };

  const handleConfirmDelete = async () => {
    const key = deleteConfirm?.key;
    setDeleteConfirm(null);
    if (key === "table") await deleteTable();
    else if (key === "seat") await deleteSeat();
    else if (key === "standaloneSeat") await deleteStandaloneSeat();
    else if (key === "bulkDeleteStandaloneSeats") await deleteBulkStandaloneSeats();
  };

  const deleteTable = async id => {
    const tid = id || selected?.tableId;
    if (!tid) return;
    const tableToDelete = tables.find(t => t.id === tid);
    if (tableToDelete) {
      try { await cleanupReservationsForDeletedTable(tableToDelete, activeWing, activeRoom, "admin"); } catch {}
    }
    setTables(p => p.filter(t => t.id !== tid));
    if (!id || selected?.tableId === tid) setSelected(null);
  };

  const deleteStandaloneSeat = async id => {
    const sid = id || selected?.standaloneSeatId;
    if (!sid) return;
    const seatToDelete = standaloneSeats.find(s => s.id === sid);
    if (seatToDelete) {
      try { await cleanupReservationsForDeletedStandaloneSeat(seatToDelete, activeWing, activeRoom, "admin"); } catch {}
    }
    setStandaloneSeats(p => p.filter(s => s.id !== sid));
    if (!id || selected?.standaloneSeatId === sid) setSelected(null);
  };

  const deleteBulkStandaloneSeats = async () => {
    if (selectedStandaloneSeats.size === 0) return;
    const seatsToDelete = standaloneSeats.filter(s => selectedStandaloneSeats.has(s.id));
    for (const seat of seatsToDelete) {
      try { await cleanupReservationsForDeletedStandaloneSeat(seat, activeWing, activeRoom, "admin"); } catch {}
    }
    setStandaloneSeats(p => p.filter(s => !selectedStandaloneSeats.has(s.id)));
    setSelectedStandaloneSeats(new Set());
    setSelected(null);
  };

  // ── UPDATED: accepts optional tableId so it works from any inspector context ─
  const addSeat = useCallback((tableId) => {
    const tid = tableId || selected?.tableId;
    if (!tid) return;
    setTables(p => p.map(t => {
      if (t.id !== tid) return t;
      const existingNums = (t.seats || []).map(s => s.num);
      // Find the next available number to avoid collisions
      let num = (t.seats || []).length + 1;
      while (existingNums.includes(num)) num++;
      return {
        ...t,
        seats: [
          ...(t.seats || []),
          { id: `${t.id}-S${num}-${Date.now()}`, num, label: `S${num}`, status: "available" },
        ],
      };
    }));
  }, [selected]);

  const deleteSeat = async () => {
    if (!selected?.tableId) return;
    const table = tables.find(t => t.id === selected.tableId);
    if (table?.seats?.length > 0) {
      try { await cleanupReservationsForDeletedSeat(table.seats[table.seats.length - 1], table, activeWing, activeRoom, "admin"); } catch {}
    }
    setTables(p => {
      const u = p.map(t => t.id !== selected.tableId ? t : { ...t, seats: (t.seats || []).slice(0, -1) });
      const f = u.filter(t => (t.seats || []).length > 0);
      if (f.length < u.length) setSelected(null);
      return f;
    });
  };

  const updateTable           = (k, v)    => { if (!selected?.tableId) return; setTables(p => p.map(t => t.id === selected.tableId ? { ...t, [k]: v } : t)); };
  const handleLabelEdit       = (id, val) => { setTables(p => p.map(t => t.id === id ? { ...t, label: val } : t)); };
  const handleSeatLabelEdit   = val       => { if (!selected?.seatId) return; setTables(p => p.map(t => t.id !== selected.tableId ? t : { ...t, seats: (t.seats || []).map(s => s.id === selected.seatId ? { ...s, label: val } : s) })); };
  const handleSeatStatus      = status    => { if (!selected?.seatId) return; setTables(p => p.map(t => t.id !== selected.tableId ? t : { ...t, seats: (t.seats || []).map(s => s.id === selected.seatId ? { ...s, status } : s) })); };
  const handleSeatMove        = (tableId, seatId, pos) => { setTables(p => p.map(t => t.id !== tableId ? t : { ...t, seats: (t.seats || []).map(s => s.id === seatId ? { ...s, position: pos } : s) })); };
  const handleStandaloneSeatStatus = (seatId, status) => { setStandaloneSeats(p => p.map(s => s.id === seatId ? { ...s, status } : s)); };
  const handleSeatClick       = (seat, tableId) => { if (!editMode) { onSeatClick?.(seat, tableId); return; } setSelected({ type: "seat", tableId, seatId: seat.id }); };
  const handleTableSelect     = table => { if (editMode) { setSelected({ type: "table", tableId: table.id }); return; } onTableClick?.(table); };
  const handleSelectRoom      = (w, r) => { setActiveWing(w); setActiveRoom(r); };
  const handleSaveVenue       = newStructure => { setVenueStructure(newStructure); saveVenueStructure(newStructure); };
  const handleSave            = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  // ─── CLIENT VIEW ──────────────────────────────────────────────────────────────
  if (!editMode) {
    const SEAT_OFF = 46, PAD = 40;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    tables.forEach(t => { const tw = t.width || 110, th = t.height || 70; minX = Math.min(minX, t.x - SEAT_OFF); minY = Math.min(minY, t.y - SEAT_OFF); maxX = Math.max(maxX, t.x + tw + SEAT_OFF); maxY = Math.max(maxY, t.y + th + SEAT_OFF); });
    standaloneSeats.forEach(s => { minX = Math.min(minX, s.x); minY = Math.min(minY, s.y); maxX = Math.max(maxX, s.x + 38); maxY = Math.max(maxY, s.y + 38); });
    labels.forEach(l => { const lw = l.type === "screen" ? 120 : 100, lh = l.type === "screen" ? 32 : 26; minX = Math.min(minX, l.x); minY = Math.min(minY, l.y); maxX = Math.max(maxX, l.x + lw); maxY = Math.max(maxY, l.y + lh); });
    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 1400; maxY = 780; }
    const VIRTUAL_W = virtualWidth  || Math.max(maxX - minX + PAD * 2, 500);
    const VIRTUAL_H = virtualHeight || Math.max(maxY - minY + PAD * 2, 400);
    const ox = -minX + PAD, oy = -minY + PAD;
    return (
      <div style={{ width: "100%", background: T.canvasBg, transition: "background 0.30s" }}>
        <ScaledCanvas virtualW={VIRTUAL_W} virtualH={VIRTUAL_H} fitMode="contain" remountKey={0}>
          <div style={{ position: "absolute", top: 0, left: 0, width: VIRTUAL_W, height: VIRTUAL_H }}>
            {labels.map(l => <StaticLabel key={`${wing}-${room}-label-${l.id}`} item={{ ...l, x: l.x + ox, y: l.y + oy }} T={T} />)}
            {standaloneSeats.map(s => (
              <StandaloneSeat key={`${wing}-${room}-standalone-${s.id}`} seat={{ ...s, x: s.x + ox, y: s.y + oy }}
                editMode={false} isSelected={selectedSeat ? selectedSeat.id === s.id : false}
                isDragging={false} onDragStart={() => {}} onSelect={() => {}}
                onSeatClick={mode === "individual" ? onSeatClick : undefined} T={T} />
            ))}
            {tables.map(t => (
              <TableNode key={`${wing}-${room}-table-${t.id}`} table={{ ...t, x: t.x + ox, y: t.y + oy }}
                editMode={false} isTableSelected={highlightedTable ? highlightedTable.id === t.id : false}
                selectedSeatId={selectedSeat ? selectedSeat.id : null}
                onSelectTable={handleTableSelect} onDragStart={() => {}} onResizeStart={() => {}}
                onSeatClick={handleSeatClick} isDragging={false} T={T} wing={wing} room={room} mode={mode} />
            ))}
          </div>
        </ScaledCanvas>
      </div>
    );
  }

  // ─── ADMIN / EDIT VIEW ────────────────────────────────────────────────────────
  const VIRTUAL_W = virtualWidth  || 1400;
  const VIRTUAL_H = virtualHeight || 780;
  const isAddMode = tool === "addTable" || tool === "addSeat";
  const isDeleteMode = tool === "deleteSeat";
  const isMultiSelectMode = tool === "multiSelect";
  const toolHint = {
    addTable: "Click on canvas to place a table",
    addSeat: "Click on canvas to place a standalone seat",
    deleteSeat: "Click on any standalone seat to delete it",
    multiSelect: "Click standalone seats to select multiple for bulk deletion",
  }[tool] || "";

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: F, color: C.textPrimary, overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>
      <style>{`html, body { overflow: hidden !important; height: 100vh !important; max-height: 100vh !important; } #root { overflow: hidden !important; height: 100vh !important; max-height: 100vh !important; }`}</style>

      {deleteConfirm && <DeleteConfirmModal message={deleteConfirm.message} onConfirm={handleConfirmDelete} onCancel={() => setDeleteConfirm(null)} />}
      {showVenueManager && canManageVenues && <VenueManagerModal venueStructure={venueStructure} onSave={handleSaveVenue} onClose={() => setShowVenueManager(false)} />}

      {/* Toolbar */}
      <div style={{ flexShrink: 0, padding: "12px 16px", background: C.surfaceBase, borderBottom: `1px solid ${C.borderDefault}`, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: "0.14em", textTransform: "uppercase" }}>{activeWing}</span>
          <span style={{ color: C.textTertiary, fontSize: 12 }}>·</span>
          <span style={{ fontSize: 12, color: C.textPrimary, fontWeight: 500 }}>{activeRoom}</span>
        </div>
        <div style={{ width: 1, height: 20, background: C.borderDefault, flexShrink: 0 }} />
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          <ToolBtn active={tool === "select"}      onClick={() => setTool("select")}      label="Select" />
          <ToolBtn active={tool === "addTable"}    onClick={() => setTool("addTable")}    label="+ Table" />
          <ToolBtn active={tool === "addSeat"}     onClick={() => setTool("addSeat")}     label="+ Seat" />
          <ToolBtn active={tool === "multiSelect"} onClick={() => { setTool("multiSelect"); setSelectedStandaloneSeats(new Set()); }} label="Multi-Select" />
        </div>

        {(isAddMode || isDeleteMode || isMultiSelectMode) && toolHint && (
          <div style={{ padding: "4px 10px", background: isDeleteMode ? C.redFaint : C.goldFaintest, color: isDeleteMode ? C.red : C.gold, fontFamily: F, fontWeight: 600, fontSize: 9, border: `1px solid ${isDeleteMode ? C.redBorder : C.borderAccent}`, borderRadius: 5, whiteSpace: "nowrap", animation: "sm-fadeIn 0.16s ease" }}>
            {isMultiSelectMode && selectedStandaloneSeats.size > 0 ? `${selectedStandaloneSeats.size} seat${selectedStandaloneSeats.size > 1 ? "s" : ""} selected` : toolHint}
          </div>
        )}
        {selected && !isAddMode && !isMultiSelectMode && (
          <div style={{ padding: "4px 10px", background: C.redFaint, color: C.red, fontFamily: F, fontWeight: 600, fontSize: 9, border: `1px solid ${C.redBorder}`, borderRadius: 5, whiteSpace: "nowrap", animation: "sm-fadeIn 0.16s ease" }}>
            Press <kbd style={{ background: C.surfaceBase, padding: "1px 4px", borderRadius: 3, border: `1px solid ${C.borderDefault}`, fontFamily: "monospace" }}>Delete</kbd> to remove {selected.type === "table" ? "table" : selected.type === "seat" ? "seat" : "standalone seat"}
          </div>
        )}
        {isMultiSelectMode && selectedStandaloneSeats.size > 0 && (
          <button onClick={() => setDeleteConfirm({ key: "bulkDeleteStandaloneSeats", message: `Delete ${selectedStandaloneSeats.size} selected standalone seat${selectedStandaloneSeats.size > 1 ? "s" : ""}? This cannot be undone.` })}
            style={{ padding: "6px 12px", background: C.red, color: "#fff", border: `1px solid ${C.redBorder}`, borderRadius: 5, fontFamily: F, fontWeight: 600, fontSize: 9, cursor: "pointer", whiteSpace: "nowrap", animation: "sm-fadeIn 0.16s ease" }}
            onMouseEnter={e => e.currentTarget.style.background = "#D64545"} onMouseLeave={e => e.currentTarget.style.background = C.red}>
            Delete {selectedStandaloneSeats.size} Seat{selectedStandaloneSeats.size > 1 ? "s" : ""}
          </button>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {saved && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: C.greenFaint, color: C.green, borderRadius: 5, fontFamily: F, fontWeight: 700, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", border: `1px solid ${C.greenBorder}`, animation: "sm-fadeIn 0.16s ease" }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Saved
            </span>
          )}
          <button onClick={handleSave}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", background: C.gold, color: "#fff", border: "none", borderRadius: 7, fontFamily: F, fontWeight: 700, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", transition: "background 0.14s", boxShadow: "0 2px 8px rgba(140,107,42,0.20)" }}
            onMouseEnter={e => e.currentTarget.style.background = C.goldLight} onMouseLeave={e => e.currentTarget.style.background = C.gold}>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 2h8l2 2v8a1 1 0 01-1 1H3a1 1 0 01-1-1V2z" stroke="currentColor" strokeWidth="1.3" fill="none"/><rect x="4" y="8" width="6" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none"/><rect x="4.5" y="2" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
            Save Layout
          </button>
        </div>
      </div>

      {/* Main editor area */}
      <div style={{ flex: "1 1 0", minHeight: 0, display: "flex", overflow: "hidden" }}>
        <WingRoomSidebar
          activeWing={activeWing} activeRoom={activeRoom} onSelect={handleSelectRoom}
          venueStructure={visibleVenueStructure}
          onOpenVenueManager={canManageVenues ? () => setShowVenueManager(true) : null}
        />

        {/* Canvas */}
        <div style={{ flex: "1 1 0", minWidth: 0, padding: 14, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: "1 1 0", minHeight: 0, background: C.canvasBg, border: `1.5px solid ${isAddMode ? C.gold : C.canvasBorder}`, borderRadius: 10, overflow: "hidden", transition: "border-color 0.2s", boxShadow: "0 1px 6px rgba(0,0,0,0.06)", position: "relative" }}>
            <ScaledCanvas virtualW={VIRTUAL_W} virtualH={VIRTUAL_H} fitMode="contain" onScale={s => { adminScaleRef.current = s; }}>
              <div ref={canvasRef} style={{ position: "absolute", inset: 0, cursor: isAddMode ? "crosshair" : "default" }}
                onClick={e => { if (e.target !== canvasRef.current) return; if (tool === "select") setSelected(null); handleCanvasClick(e); }} />
              {labels.map((l, index) => (
                <DraggableLabel key={`label-${l.id}-${index}`} item={l}
                  onDragStart={(e, id) => startLabelDrag(e, id)}
                  isDragging={activeDragId === l.id} />
              ))}
              {standaloneSeats.map((s, index) => (
                <StandaloneSeat key={`standalone-${s.id}-${index}`} seat={s} editMode={true}
                  isSelected={selected?.type === "standaloneSeat" && selected.standaloneSeatId === s.id}
                  isMultiSelected={selectedStandaloneSeats.has(s.id)}
                  isDragging={activeDragId === s.id}
                  onDragStart={startStandaloneSeatDrag}
                  onSelect={ss => {
                    if (tool === "multiSelect") {
                      setSelectedStandaloneSeats(prev => { const n = new Set(prev); n.has(ss.id) ? n.delete(ss.id) : n.add(ss.id); return n; });
                    } else { setSelected({ type: "standaloneSeat", standaloneSeatId: ss.id }); }
                  }}
                  onDeleteClick={tool === "deleteSeat" ? ss => {
                    setSelected({ type: "standaloneSeat", standaloneSeatId: ss.id });
                    setDeleteConfirm({ key: "standaloneSeat", message: `Delete standalone seat "${ss.label || ss.num}"? This cannot be undone.` });
                  } : null}
                  T={T} />
              ))}
              {tables.map((t, index) => (
                <TableNode key={`table-${t.id}-${index}`} table={t} editMode={true}
                  isTableSelected={selected?.tableId === t.id}
                  selectedSeatId={selected?.type === "seat" && selected?.tableId === t.id ? selected.seatId : null}
                  onDragStart={startTableDrag} onResizeStart={startTableResize}
                  onSeatClick={handleSeatClick} onLabelEdit={handleLabelEdit}
                  isDragging={activeDragId === t.id} onSeatMove={handleSeatMove}
                  T={T}
                  wing={activeWing} room={activeRoom} />
              ))}
              {tables.length === 0 && standaloneSeats.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 10, animation: "sm-fadeUp 0.3s ease" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, border: `1.5px dashed ${C.borderStrong}`, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.35 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  </div>
                  <p style={{ color: C.textSecondary, fontSize: 12, fontFamily: F, margin: 0 }}>Empty canvas — use the toolbar to add tables or seats</p>
                </div>
              )}
            </ScaledCanvas>
          </div>
        </div>

        {/* Inspector sidebar */}
        <div className="sm-scroll" style={{ flexShrink: 0, width: 252, borderLeft: `1px solid ${C.borderDefault}`, background: C.surfaceBase, overflowY: "auto", padding: "14px 13px 24px", display: "flex", flexDirection: "column", gap: 0 }}>
          <InspectorPanel
            selected={selected} selectedTable={selectedTable} selectedSeatObj={selectedSeatObj}
            selectedStandaloneSeatObj={selectedStandaloneSeatObj} tables={tables} setTables={setTables}
            addSeat={addSeat} deleteSeat={deleteSeat} deleteTable={deleteTable}
            deleteStandaloneSeat={deleteStandaloneSeat} updateTable={updateTable}
            handleSeatLabelEdit={handleSeatLabelEdit} handleSeatStatus={handleSeatStatus}
            handleStandaloneSeatStatus={handleStandaloneSeatStatus} onRequestDelete={handleRequestDelete}
          />
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.20em", color: C.gold, textTransform: "uppercase", marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.divider}` }}>Status Legend</div>
            {Object.entries(STATUS_COLORS).map(([key, color], index) => (
              <div key={`${key}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontFamily: F, fontSize: 11, color: C.textSecondary, fontWeight: 500 }}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
